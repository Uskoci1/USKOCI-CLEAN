jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { safetyClientService as service } from '../safetyClientService';

/**
 * EX-07 S06: the displayed name of a safety target comes from the server result of rpc_read_safety_target, only in a build compiled with the flag. With the flag off
 * the receipt is exactly what it was (whatever the server sends); with it on the name is a decoration that never makes the safety action fail.
 */
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', P = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NAME = 'EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
const target = (patch: Record<string, unknown> = {}) => ({ profileId: P, accountId: A, targetAccountId: B, blocked: false, revision: 2, authoritative: true, ...patch });
const block = { accountId: A, targetAccountId: B, blocked: false, revision: 2, authoritative: true };

beforeEach(() => { delete process.env[NAME]; mockSession = { user: { id: A }, accountRevision: 1 }; mockRpc.mockReset(); });
afterEach(() => { delete process.env[NAME]; jest.restoreAllMocks(); });

describe('flag off: the receipt is what it was', () => {
  it('returns exactly the profile, the availability and the block, and ignores a name the server sends', async () => {
    mockRpc.mockResolvedValue({ data: target({ displayName: 'Marko Petrovic' }), error: null });
    const result = await service.readTarget(P);
    expect(result).toStrictEqual({ ok: true, podatak: { profileId: P, available: true, target: block } });
    expect(JSON.stringify(result)).not.toContain('Marko');
    expect(mockRpc).toHaveBeenCalledWith('rpc_read_safety_target', { p_profile_id: P });
  });

  it('treats a hidden profile as no target exactly as before', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await service.readTarget(P)).toStrictEqual({ ok: true, podatak: { profileId: P, available: false, target: null } });
  });

  it.each(['0', 'true', 'on', ' 1', ''])('stays off for the flag value %p', async value => {
    process.env[NAME] = value;
    mockRpc.mockResolvedValue({ data: target({ displayName: 'Marko Petrovic' }), error: null });
    expect(await service.readTarget(P)).toStrictEqual({ ok: true, podatak: { profileId: P, available: true, target: block } });
  });
});

describe('flag on: the name is read from the server result', () => {
  beforeEach(() => { process.env[NAME] = '1'; });

  it('returns the displayed name of the profile that was asked for, trimmed, beside the unchanged target', async () => {
    mockRpc.mockResolvedValue({ data: target({ displayName: '  Marko Petrović ' }), error: null });
    expect(await service.readTarget(P)).toStrictEqual({ ok: true, podatak: { profileId: P, available: true, target: block, displayName: 'Marko Petrović' } });
    expect(mockRpc).toHaveBeenCalledWith('rpc_read_safety_target', { p_profile_id: P });
  });

  it.each([null, undefined, '', '   ', '\t\n'])('a missing or blank name (%p) is null, never invented', async displayName => {
    mockRpc.mockResolvedValue({ data: target(displayName === undefined ? {} : { displayName }), error: null });
    expect(await service.readTarget(P)).toStrictEqual({ ok: true, podatak: { profileId: P, available: true, target: block, displayName: null } });
  });

  it.each([123, true, {}, [], ['Marko'], 'x'.repeat(201), 'Mar\u0000ko', 'Mar\nko', 'Mar\u007fko', 'Mar\u0085ko', 'Mar\ud800ko'])('a name the screen could not draw safely (%p) is null and the target still resolves', async displayName => {
    mockRpc.mockResolvedValue({ data: target({ displayName }), error: null });
    expect(await service.readTarget(P)).toStrictEqual({ ok: true, podatak: { profileId: P, available: true, target: block, displayName: null } });
  });

  it('keeps a name of exactly 200 characters', async () => {
    const name = 'Ž'.repeat(200);
    mockRpc.mockResolvedValue({ data: target({ displayName: name }), error: null });
    expect(await service.readTarget(P)).toMatchObject({ ok: true, podatak: { displayName: name } });
  });

  it('a hidden profile is still no target, with no name', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await service.readTarget(P)).toStrictEqual({ ok: true, podatak: { profileId: P, available: false, target: null } });
  });

  it('passes nothing else the server sends through', async () => {
    mockRpc.mockResolvedValue({ data: target({ displayName: 'Marko', email: 'm@example.test', phone: '+381600000000', city: 'Novi Sad' }), error: null });
    const result = await service.readTarget(P);
    expect(Object.keys((result as { podatak: object }).podatak).sort()).toEqual(['available', 'displayName', 'profileId', 'target']);
    expect(JSON.stringify(result)).not.toMatch(/example\.test|\+381|Novi Sad/);
  });

  it.each([{ profileId: B }, { targetAccountId: A }, { targetAccountId: 'bad' }, { accountId: B }, { revision: -1 }, { authoritative: false }, { blocked: 'no' }])
  ('still rejects an uncorrelated safety target %j', async patch => {
    mockRpc.mockResolvedValue({ data: target({ displayName: 'Marko', ...patch }), error: null });
    expect(await service.readTarget(P)).toMatchObject({ ok: false, kod: 'SAFETY_TARGET_INVALID_RECEIPT' });
  });

  it('never writes the name to a log, in a success or in a failure', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => jest.spyOn(console, method).mockImplementation(() => {}));
    mockRpc.mockResolvedValueOnce({ data: target({ displayName: 'Marko Tajni' }), error: null });
    await service.readTarget(P);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Marko Tajni' } });
    const failed = await service.readTarget(P);
    mockRpc.mockRejectedValueOnce(new Error('Marko Tajni'));
    const thrown = await service.readTarget(P);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('Marko');
    expect(JSON.stringify([failed, thrown])).not.toContain('Marko');
  });

  it('refuses a malformed profile before any IO', async () => {
    expect((await service.readTarget('not-a-profile')).ok).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
