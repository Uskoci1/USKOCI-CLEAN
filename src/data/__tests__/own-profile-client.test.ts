jest.mock('../../store/sesija', () => ({ sesijaSada: jest.fn() }));
import { sesijaSada } from '../../store/sesija';
const session = sesijaSada as jest.Mock;
jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockFrom = jest.fn();
  return {
    supabaseKlijent: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
    __testMocks: { mockGetUser, mockFrom },
  };
});

import { ownProfileClientService } from '../ownProfileClientService';
import { createFocusedResource } from '../focusedResource';

const { mockGetUser, mockFrom } = jest.requireMock('../supabaseClient').__testMocks as {
  mockGetUser: jest.Mock; mockFrom: jest.Mock;
};

function configure(result: unknown = {
  data: { id: 'profile-a', account_id: 'account-a', kind: 'REQUESTER', display_name: ' Ana Petrović ', city: ' Novi Sad ' },
  error: null,
}) {
  const eq = jest.fn();
  const select = jest.fn();
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const chain = { eq, maybeSingle };
  eq.mockReturnValue(chain);
  select.mockReturnValue(chain);
  mockFrom.mockReturnValue({ select });
  mockGetUser.mockResolvedValue({ data: { user: { id: 'account-a' } }, error: null });
  return { eq, select, maybeSingle };
}

beforeEach(() => { jest.clearAllMocks(); session.mockReturnValue({ user: { id: 'account-a' }, accountRevision: 1 }); });

describe('own profile identity boundary', () => {
  it('reads only the authenticated account and intended profile kind, excluding trust/private fields', async () => {
    const { eq, select } = configure();
    expect(await ownProfileClientService.read('account-a', 'narucilac')).toEqual({
      accountId: 'account-a', profileId: 'profile-a', kind: 'REQUESTER', ime: 'Ana Petrović', grad: 'Novi Sad',
    });
    expect(mockFrom).toHaveBeenCalledWith('app_profiles');
    expect(select).toHaveBeenCalledWith('id,account_id,kind,display_name,city');
    expect(eq.mock.calls).toEqual([['account_id', 'account-a'], ['kind', 'REQUESTER']]);
  });

  it('worker intent uses its own Worker identity; blank fields stay unknown', async () => {
    const { eq } = configure({ data: {
      id: 'worker-a', account_id: 'account-a', kind: 'WORKER', display_name: '   ', city: null,
    }, error: null });
    expect(await ownProfileClientService.read('account-a', 'uskocer')).toEqual({
      accountId: 'account-a', profileId: 'worker-a', kind: 'WORKER', ime: null, grad: null,
    });
    expect(eq).toHaveBeenCalledWith('kind', 'WORKER');
  });

  it('does not query for a session that changed while identity was being verified', async () => {
    configure();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'account-b' } }, error: null });
    await expect(ownProfileClientService.read('account-a', 'narucilac')).rejects.toThrow('PROFILE_ACCOUNT_CHANGED');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('requires authentication before accessing profile rows', async () => {
    configure();
    await expect(ownProfileClientService.read('', 'narucilac')).rejects.toThrow('AUTH_REQUIRED');
    expect(mockGetUser).not.toHaveBeenCalled();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'unverified' } });
    await expect(ownProfileClientService.read('account-a', 'narucilac')).rejects.toThrow('AUTH_REQUIRED');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it.each([
    { id: 'foreign', account_id: 'account-b', kind: 'REQUESTER' },
    { id: 'wrong-kind', account_id: 'account-a', kind: 'WORKER' },
    { id: null, account_id: 'account-a', kind: 'REQUESTER' },
  ])('rejects a response outside the exact identity projection', async row => {
    configure({ data: row, error: null });
    await expect(ownProfileClientService.read('account-a', 'narucilac')).rejects.toThrow('OWN_PROFILE_INVALID_SCOPE');
  });

  it('distinguishes a missing profile from a backend failure without exposing raw error text', async () => {
    configure({ data: null, error: null });
    await expect(ownProfileClientService.read('account-a', 'narucilac')).resolves.toBeNull();
    configure({ data: null, error: { message: 'sensitive server diagnostic' } });
    await expect(ownProfileClientService.read('account-a', 'narucilac')).rejects.toThrow('OWN_PROFILE_READ_FAILED');
  });

  it('does not publish an old own-profile identity after account switch or blur', async () => {
    const { maybeSingle } = configure();
    let resolve!: (value: unknown) => void;
    maybeSingle.mockImplementation(() => new Promise(done => { resolve = done; }));
    let current = true;
    const model = createFocusedResource(() => ownProfileClientService.read('account-a', 'narucilac'), () => current);
    model.start();
    await Promise.resolve();
    current = false;
    model.stop();
    resolve({ data: {
      id: 'old', account_id: 'account-a', kind: 'REQUESTER', display_name: 'Old private identity', city: 'Beograd',
    }, error: null });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(model.snapshot().data).toBeNull();
  });
});

describe('own-profile service generation fencing independent of the screen', () => {
  it.each(['account-b', 'account-a'])('rejects a late response after an account transition ending in %s', async accountId => {
    const { maybeSingle } = configure(); let resolve!: (x: unknown) => void;
    maybeSingle.mockImplementation(() => new Promise(done => { resolve = done; }));
    const request = ownProfileClientService.read('account-a', 'narucilac');
    await Promise.resolve();
    session.mockReturnValue({ user: { id: accountId }, accountRevision: 3 });
    resolve({ data: { id: 'profile-a', account_id: 'account-a', kind: 'REQUESTER', display_name: 'PRIVATE OLD NAME', city: 'OLD CITY' }, error: null });
    await expect(request).rejects.toThrow('PROFILE_ACCOUNT_CHANGED');
  });
  it('does not query a private profile when getUser was in flight during A to B to A', async () => {
    configure(); let resolve!: (x: unknown) => void;
    mockGetUser.mockImplementation(() => new Promise(done => { resolve = done; }));
    const request = ownProfileClientService.read('account-a', 'narucilac');
    session.mockReturnValue({ user: { id: 'account-a' }, accountRevision: 3 });
    resolve({ data: { user: { id: 'account-a' } }, error: null });
    await expect(request).rejects.toThrow('PROFILE_ACCOUNT_CHANGED'); expect(mockFrom).not.toHaveBeenCalled();
  });
});

it('never leaks rejected provider/database exceptions from the own identity service', async () => {
  configure(); mockGetUser.mockRejectedValue(new Error('RAW PRIVATE TOKEN'));
  await expect(ownProfileClientService.read('account-a', 'narucilac')).rejects.toThrow('OWN_PROFILE_READ_FAILED');
});
