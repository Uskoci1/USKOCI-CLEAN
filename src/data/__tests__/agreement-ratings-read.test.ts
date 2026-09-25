import type { DogovorProjekcija } from '../../contracts/projections';
import { AGREEMENT_RATING_BUDGET_MS, withAgreementRatings } from '../agreementRatingsRead';
import { REVIEW_TAGS } from '../reviewsClientService';
import { agreementClientService } from '../agreementClientService';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = (n: number) => `dddddddd-dddd-4ddd-8ddd-${String(n).padStart(12, '0')}`;
const owner = { accountId: A, accountRevision: 1 };
let mockSession = { user: { id: A } as { id: string } | null, accountRevision: 1 };
const mockRpc = jest.fn(), mockGetUser = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, auth: { getUser: mockGetUser } }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
const row = (n: number) => ({ id: id(n), stanje: 'COMPLETED', ocenaMoguca: true } as DogovorProjekcija);
const context = (agreementId: string, eligible = true) => ({ accountId: A, agreementId, targetAccountId: B,
  eligible, review: null, tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: [...REVIEW_TAGS] }, authoritative: true });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => { mockSession = { user: { id: A }, accountRevision: 1 }; mockRpc.mockReset();
  mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: A } }, error: null }); jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

it('500 completed rows use at most four simultaneous reads and preserve accepted active work', async () => {
  let peak = 0, active = 0;
  mockRpc.mockImplementation((_name, args) => {
    active++; peak = Math.max(peak, active);
    return new Promise(resolve => setTimeout(() => { active--; resolve({ data: context(args.p_agreement_id), error: null }); }, 1));
  });
  const accepted = { ...row(1001), stanje: 'CONFIRMED' } as DogovorProjekcija;
  const pending = withAgreementRatings([...Array.from({ length: 500 }, (_, n) => row(n)), accepted], owner);
  await jest.advanceTimersByTimeAsync(200);
  const result = await pending;
  expect(peak).toBe(4); expect(mockRpc).toHaveBeenCalledTimes(500);
  expect(result.filter(item => item.stanjeProvereOcene === 'DUE')).toHaveLength(500);
  expect(result[500]).toBe(accepted); expect(jest.getTimerCount()).toBe(0);
});

it('a stalled pool releases active work at one collection deadline, aborts its transport and fences late answers', async () => {
  let late!: (value: unknown) => void;
  const signals: AbortSignal[] = [];
  mockRpc.mockImplementation(() => {
    const pending = new Promise(resolve => { late = resolve; });
    return Object.assign(pending, { abortSignal: (signal: AbortSignal) => { signals.push(signal); return pending; } });
  });
  const accepted = { ...row(1001), stanje: 'CONFIRMED' } as DogovorProjekcija;
  const pending = withAgreementRatings([...Array.from({ length: 30 }, (_, n) => row(n)), accepted], owner);
  await jest.advanceTimersByTimeAsync(AGREEMENT_RATING_BUDGET_MS);
  const result = await pending;
  expect(mockRpc).toHaveBeenCalledTimes(4); expect(signals).toHaveLength(4); expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(result.slice(0, 30).every(item => item.stanjeProvereOcene === 'UNAVAILABLE' && !item.ocenaMoguca)).toBe(true);
  expect(result[30]).toBe(accepted);
  late({ data: context(id(3)), error: null }); await flush();
  expect(result[3].stanjeProvereOcene).toBe('UNAVAILABLE'); expect(mockRpc).toHaveBeenCalledTimes(4);
});

it('one stalled read does not stop the other slots from reading and retains proved, not guessed, eligibility', async () => {
  mockRpc.mockImplementation((_name, args) => args.p_agreement_id === id(0) ? new Promise(() => {})
    : Promise.resolve({ data: context(args.p_agreement_id, args.p_agreement_id !== id(2)), error: null }));
  const pending = withAgreementRatings([row(0), row(1), row(2)], owner);
  await jest.advanceTimersByTimeAsync(AGREEMENT_RATING_BUDGET_MS);
  expect((await pending).map(item => item.stanjeProvereOcene)).toEqual(['UNAVAILABLE', 'DUE', 'NOT_DUE']);
});

it.each(['accountId', 'agreementId', 'authoritative', 'targetAccountId', 'tagCatalog'])('a wrong %s never becomes due or settled', async field => {
  mockRpc.mockImplementation((_name, args) => Promise.resolve({ data: { ...context(args.p_agreement_id), [field]: 'wrong' }, error: null }));
  expect((await withAgreementRatings([row(1)], owner))[0]).toMatchObject({ ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' });
});

it('account retirement aborts pending work, starts no queued requests and rejects even an A-B-A switch', async () => {
  const signals: AbortSignal[] = [];
  mockRpc.mockImplementation(() => ({ abortSignal: (signal: AbortSignal) => { signals.push(signal); return new Promise(() => {}); } }));
  const pending = withAgreementRatings(Array.from({ length: 10 }, (_, n) => row(n)), owner);
  const assertion = expect(pending).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  mockSession = { user: { id: A }, accountRevision: 3 };
  await jest.advanceTimersByTimeAsync(100); await assertion;
  expect(signals.every(signal => signal.aborted)).toBe(true); expect(mockRpc).toHaveBeenCalledTimes(4);
});

it('a retired account cannot continue pagination or start enrichment', async () => {
  mockRpc.mockImplementation(async () => { mockSession = { user: { id: B }, accountRevision: 2 };
    return { data: { items: [{ id: id(1), sortAt: '2026-09-25T10:00:00Z' }], hasMore: true }, error: null }; });
  await expect(agreementClientService.mojiDogovori()).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
