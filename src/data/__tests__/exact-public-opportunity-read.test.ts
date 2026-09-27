jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return { supabaseKlijent: () => ({ rpc: mockRpc }), __testMocks: { mockRpc } };
});
jest.mock('../publicProfileClientService', () => ({ publicProfileClientService: { javniProfil: jest.fn() } }));
let mockSession: { user: { id: string } | null; accountRevision: number; sessionEpoch: number } = {
  user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1,
};
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));

import { supabaseIzvor } from '../supabaseIzvor';
import { publicProfileClientService } from '../publicProfileClientService';
import { lazniIzvor, resetujLazniIzvor, izmeniPotrebuMaterijalno } from '../lazniIzvor';

const { mockRpc } = jest.requireMock('../supabaseClient').__testMocks as { mockRpc: jest.Mock };
const publicProfile = publicProfileClientService.javniProfil as jest.Mock;
const NEED = 'abcdefab-2222-4222-8222-222222222222';
const OTHER = 'abcdefab-3333-4333-8333-333333333333';
const AS_OF = '2026-09-27T16:00:00.123456Z';
const item = (patch: Record<string, unknown> = {}) => ({
  id: NEED, revision: 7, sortAt: '2026-09-18T10:00:00.123456Z', publishedAt: '2026-09-18T10:00:00.123456Z',
  title: 'Pomoć pri selidbi', category: 'Selidbe', status: 'PUBLISHED', urgent: false,
  scheduleKind: 'FLEXIBLE', startsAt: null, endsAt: null, executionLocationMode: 'STATIONARY',
  approximateCity: 'Beograd', approximateArea: 'Centar', pin: { lat: 44.8, lng: 20.4, precision: 'COARSE_1KM' },
  requiredSlots: 2, coveredSlots: 0, requiredSkills: ['Selidbe'], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
  minimumExperienceYears: null, verifiedIdentityRequired: false, taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade',
  priceMode: 'OFFERS', requesterPriceRsd: null, requesterProfileId: '11111111-3333-4333-8333-333333333333',
  responseDeadline: null, acceptsApplications: true, publicTopology: null, criticalConditions: null,
  ...patch,
});
const page = (items: unknown[], patch: Record<string, unknown> = {}) => ({ data: { items, hasMore: false, asOf: AS_OF, ...patch }, error: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
beforeEach(() => {
  mockRpc.mockReset(); publicProfile.mockReset().mockResolvedValue(null);
  mockSession = { user: { id: '11111111-1111-4111-8111-111111111111' }, accountRevision: 1, sessionEpoch: 1 };
});
afterEach(() => { jest.useRealTimers(); });

it('uses one exact-ID request and preserves the same allowlisted public projection with its revision', async () => {
  mockRpc.mockResolvedValue(page([item({ description: 'private description', exact_address: 'private address', requester_account_id: 'private account' })]));
  const result = await supabaseIzvor.otvorenaPrilika(NEED.toUpperCase());
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(mockRpc).toHaveBeenCalledWith('rpc_list_open_tasks_v3', {
    p_bbox: null, p_filters: { needId: NEED }, p_limit: 1, p_before_at: null, p_before_id: null,
  });
  expect(result).toMatchObject({ item: { id: NEED, revision: 7, naslov: 'Pomoć pri selidbi', opis: '', priblizno: { lat: 44.8, lng: 20.4 } }, asOf: AS_OF });
  expect(JSON.stringify(result)).not.toContain('private');
  const { revision, ...projected } = result.item!;
  expect(revision).toBe(7);
  const ordinary = await supabaseIzvor.otvorenePrilike();
  expect(projected).toEqual(ordinary[0]);
  expect(ordinary[0]).not.toHaveProperty('revision');
});

it('returns an admitted empty read without enrichment', async () => {
  mockRpc.mockResolvedValue(page([]));
  await expect(supabaseIzvor.otvorenaPrilika(NEED)).resolves.toEqual({ item: null, asOf: AS_OF });
  expect(publicProfile).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each([
  ['missing transport envelope', null],
  ['missing transport error marker', { data: { items: [], hasMore: false, asOf: AS_OF } }],
  ['missing response', { data: null, error: null }],
  ['missing items', page([], { items: undefined })],
  ['two rows', page([item(), item({ id: OTHER })])],
  ['wrong ID', page([item({ id: OTHER })])],
  ['missing revision', page([item({ revision: undefined })])],
  ['string revision', page([item({ revision: '7' })])],
  ['zero revision', page([item({ revision: 0 })])],
  ['fractional revision', page([item({ revision: 1.5 })])],
  ['overflow revision', page([item({ revision: 2_147_483_648 })])],
  ['hasMore', page([item()], { hasMore: true })],
  ['missing hasMore', page([item()], { hasMore: undefined })],
  ['invalid asOf', page([item()], { asOf: '2026-02-30T00:00:00Z' })],
  ['invalid empty timestamp', page([], { asOf: null })],
  ['invalid sort instant', page([item({ sortAt: 'yesterday' })])],
  ['unpublished row', page([item({ publishedAt: null })])],
  ['draft row', page([item({ status: 'DRAFT' })])],
  ['empty title', page([item({ title: '' })])],
  ['invalid required slots', page([item({ requiredSlots: 0 })])],
  ['negative covered slots', page([item({ coveredSlots: -1 })])],
  ['unknown price mode', page([item({ priceMode: 'UNKNOWN' })])],
  ['invalid public profile', page([item({ requesterProfileId: null })])],
  ['invalid pin shape', page([item({ pin: {} })])],
  ['out-of-range pin', page([item({ pin: { lat: 91, lng: 20, precision: 'COARSE_1KM' } })])],
  ['unrecognized precision', page([item({ pin: { lat: 44.8, lng: 20.4, precision: 'EXACT' } })])],
])('refuses %s before optional enrichment', async (_label, response) => {
  mockRpc.mockResolvedValue(response);
  await expect(supabaseIzvor.otvorenaPrilika(NEED)).rejects.toThrow('EXACT_OPPORTUNITY_RESPONSE_INVALID');
  expect(publicProfile).not.toHaveBeenCalled(); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each([
  ['invalid schedule', { scheduleKind: 'UNKNOWN' }],
  ['impossible date', { startsAt: '2026-02-30T10:00:00Z' }],
  ['invalid capability list', { requiredSkills: 42 }],
  ['unknown location mode', { executionLocationMode: 'UNKNOWN' }],
])('reuses strict public-detail validation for %s before enrichment', async (_label, patch) => {
  mockRpc.mockResolvedValue(page([item(patch)]));
  await expect(supabaseIzvor.otvorenaPrilika(NEED)).rejects.toThrow('NEED_DETAIL_INVALID_PROJECTION');
  expect(publicProfile).not.toHaveBeenCalled();
});

it.each(['', 'not-a-uuid', ` ${NEED}`])('refuses malformed requested ID %s before IO', async id => {
  await expect(supabaseIzvor.otvorenaPrilika(id)).rejects.toThrow('EXACT_OPPORTUNITY_ID_INVALID');
  expect(mockRpc).not.toHaveBeenCalled();
});

it('keeps an old-server refusal as an error, without a collection or private-row fallback', async () => {
  const error = { code: '22023', message: 'INVALID_FILTER' };
  mockRpc.mockResolvedValue({ data: null, error });
  await expect(supabaseIzvor.otvorenaPrilika(NEED)).rejects.toBe(error);
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(publicProfile).not.toHaveBeenCalled();
});

it.each(['REMOTE', 'STATIONARY'])('keeps a point-free %s task point-free', async executionLocationMode => {
  mockRpc.mockResolvedValue(page([item({ executionLocationMode, pin: null })]));
  const result = await supabaseIzvor.otvorenaPrilika(NEED);
  expect(result.item?.priblizno).toBeNull(); expect(result.item?.revision).toBe(7);
});

it('refuses an unauthenticated or already aborted read before IO', async () => {
  mockSession.user = null;
  await expect(supabaseIzvor.otvorenaPrilika(NEED)).rejects.toThrow('AUTH_REQUIRED');
  mockSession.user = { id: 'reader' };
  const abort = new AbortController(); abort.abort();
  await expect(supabaseIzvor.otvorenaPrilika(NEED, { signal: abort.signal })).rejects.toThrow('EXACT_OPPORTUNITY_READ_ABORTED');
  expect(mockRpc).not.toHaveBeenCalled();
});

it('forwards abort to transport and rejects a late completion before enrichment', async () => {
  const pending = deferred<ReturnType<typeof page>>(), abort = new AbortController();
  const abortSignal = jest.fn(() => pending.promise); mockRpc.mockReturnValue({ abortSignal });
  const result = supabaseIzvor.otvorenaPrilika(NEED, { signal: abort.signal });
  const refused = expect(result).rejects.toThrow('EXACT_OPPORTUNITY_READ_ABORTED');
  expect(abortSignal).toHaveBeenCalledWith(abort.signal);
  abort.abort(); pending.resolve(page([item()])); await refused;
  expect(publicProfile).not.toHaveBeenCalled();
});

it('rejects A-B-A account revision after transport even when the account ID is the same again', async () => {
  const pending = deferred<ReturnType<typeof page>>(); mockRpc.mockReturnValue(pending.promise);
  const result = supabaseIzvor.otvorenaPrilika(NEED);
  const refused = expect(result).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  mockSession = { ...mockSession, accountRevision: 3 }; pending.resolve(page([item()])); await refused;
  expect(publicProfile).not.toHaveBeenCalled();
});

it('admits token refresh within the same account revision', async () => {
  const pending = deferred<ReturnType<typeof page>>(); mockRpc.mockReturnValue(pending.promise);
  const result = supabaseIzvor.otvorenaPrilika(NEED);
  mockSession = { ...mockSession, sessionEpoch: 2 }; pending.resolve(page([item()]));
  await expect(result).resolves.toMatchObject({ item: { revision: 7 } });
});

it.each(['abort', 'account'] as const)('rejects completion retired during public enrichment by %s', async boundary => {
  const pending = deferred<null>(), abort = new AbortController();
  mockRpc.mockResolvedValue(page([item()])); publicProfile.mockReturnValue(pending.promise);
  const result = supabaseIzvor.otvorenaPrilika(NEED, { signal: abort.signal });
  const refused = expect(result).rejects.toThrow(boundary === 'abort' ? 'EXACT_OPPORTUNITY_READ_ABORTED' : 'AUTH_ACCOUNT_CHANGED');
  await flush(); expect(publicProfile).toHaveBeenCalledTimes(1);
  if (boundary === 'abort') abort.abort();
  else mockSession = { ...mockSession, accountRevision: 3 };
  pending.resolve(null); await refused;
});

it('returns the explicit fake task with the fake state revision and no real RPC', async () => {
  jest.useFakeTimers(); resetujLazniIzvor();
  const first = lazniIzvor.otvorenaPrilika('ormar'); await jest.runAllTimersAsync();
  const initial = await first; expect(initial.item?.revision).toBe(3);
  izmeniPotrebuMaterijalno();
  const next = lazniIzvor.otvorenaPrilika('ormar'); await jest.runAllTimersAsync();
  expect((await next).item?.revision).toBe(4);
  const absent = lazniIzvor.otvorenaPrilika('missing'); await jest.runAllTimersAsync();
  expect((await absent).item).toBeNull(); expect(mockRpc).not.toHaveBeenCalled();
});

it('retires a fake-source delayed read on abort too', async () => {
  jest.useFakeTimers(); resetujLazniIzvor();
  const abort = new AbortController(), result = lazniIzvor.otvorenaPrilika('ormar', { signal: abort.signal });
  const refused = expect(result).rejects.toThrow('EXACT_OPPORTUNITY_READ_ABORTED');
  abort.abort(); await jest.runAllTimersAsync(); await refused;
});
