import { decodeHomeAttention, homeAttentionClientService } from '../homeAttentionClientService';
const mockRpc = jest.fn();
let mockAccount: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
const ID = '11111111-2222-4333-8444-555555555555', OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const AS_OF = '2026-09-22T10:00:00.123456+00:00';
const counts = { attention: 1, attentionMore: 0, activeAgreements: 0, agreementsMore: 0,
  ownActiveTasks: 1, activeApplications: 0, activities: 1, activitiesMore: 0 };
const item = { reason: 'TASK_APPLICATIONS', subjectId: ID, taskId: ID, agreementId: null, applicationId: null,
  taskTitle: 'Prenos ormara', applicationCount: 2, sortAt: AS_OF };
const payload = () => ({ schemaVersion: 1, asOf: AS_OF, items: [{ ...item }], counts: { ...counts } });
beforeEach(() => { mockRpc.mockReset(); mockAccount = { user: { id: OTHER }, accountRevision: 1 }; });
afterEach(() => jest.useRealTimers());

it('strictly words and routes the server-owned task count', async () => {
  mockRpc.mockResolvedValue({ data: payload(), error: null });
  expect(await homeAttentionClientService.paznjaZaPocetnu()).toEqual({ asOf: AS_OF, more: 0, rows: [{
    id: `need:${ID}:applications`, title: '2 prijave', detail: 'Prenos ormara · čeka tvoj izbor', target: { kind: 'CANDIDATES', needId: ID } }] });
  expect(mockRpc).toHaveBeenCalledWith('rpc_home_attention', {}); expect(mockRpc).toHaveBeenCalledTimes(1);
});

it.each(['AGREEMENT_CONFIRM_COMPLETION', 'AGREEMENT_OPEN_PROBLEM', 'APPLICATION_STALE', 'APPLICATION_ATTENTION'])(
  'routes %s to the exact subject, never to its task instead', reason => {
    const application = reason.startsWith('APPLICATION');
    const raw = { schemaVersion: 1, asOf: AS_OF, counts: { ...counts, activeAgreements: application ? 0 : 1,
      activeApplications: application ? 1 : 0, ownActiveTasks: 0, activities: application ? 1 : 0 },
      items: [{ ...item, reason, taskId: OTHER, applicationCount: null,
        agreementId: application ? null : ID, applicationId: application ? ID : null, sortAt: application ? null : AS_OF }] };
    const parsed = decodeHomeAttention(raw)!;
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].target).toEqual(application ? { kind: 'APPLICATION', applicationId: ID } : { kind: 'AGREEMENT', agreementId: ID });
  });

it('keeps two different reasons for one Agreement and the exact overflow total', () => {
  const raw = payload() as any;
  raw.counts = { ...counts, attention: 20, attentionMore: 17, activeAgreements: 11, agreementsMore: 9 };
  raw.items = ['AGREEMENT_CONFIRM_COMPLETION','AGREEMENT_OPEN_PROBLEM','TASK_APPLICATIONS'].map(reason => ({
    ...item, reason, agreementId: reason === 'TASK_APPLICATIONS' ? null : ID,
    applicationCount: reason === 'TASK_APPLICATIONS' ? 2 : null }));
  const parsed = decodeHomeAttention(raw)!;
  expect(parsed.more).toBe(17); expect(new Set(parsed.rows.map(row => row.id)).size).toBe(3);
});

it('accepts a complete empty result only when all counts agree', () => {
  const raw = { schemaVersion: 1, asOf: AS_OF, items: [], counts: Object.fromEntries(Object.keys(counts).map(key => [key, 0])) };
  expect(decodeHomeAttention(raw)).toEqual({ rows: [], more: 0, asOf: AS_OF });
  expect(decodeHomeAttention({ ...raw, counts })).toBeNull();
});

it.each([
  ['unknown version', (r: any) => { r.schemaVersion = 2; }],
  ['missing instant', (r: any) => { delete r.asOf; }],
  ['unknown reason', (r: any) => { r.items[0].reason = 'SECRET'; }],
  ['foreign task identity', (r: any) => { r.items[0].taskId = OTHER; }],
  ['missing title', (r: any) => { delete r.items[0].taskTitle; }],
  ['malformed identity', (r: any) => { r.items[0].subjectId = '../bad'; }],
  ['null task timestamp', (r: any) => { r.items[0].sortAt = null; }],
  ['wrong relation', (r: any) => { r.items[0].agreementId = OTHER; }],
  ['missing relation', (r: any) => { delete r.items[0].agreementId; }],
  ['zero application count', (r: any) => { r.items[0].applicationCount = 0; }],
  ['string application count', (r: any) => { r.items[0].applicationCount = '2'; }],
  ['duplicate identity', (r: any) => { r.items.push({ ...r.items[0] }); r.counts.attention = 2; }],
  ['unbounded items', (r: any) => { r.items = Array(4).fill(item); }],
  ['incorrect overflow', (r: any) => { r.counts.attentionMore = 3; }],
  ['incorrect activity sum', (r: any) => { r.counts.activities = 7; }],
  ['incorrect agreement overflow', (r: any) => { r.counts.agreementsMore = 2; }],
  ['incorrect activity overflow', (r: any) => { r.counts.activitiesMore = 4; }],
  ['missing full count', (r: any) => { delete r.counts.activeApplications; }],
  ['negative full count', (r: any) => { r.counts.activeApplications = -1; }],
  ['fractional count', (r: any) => { r.counts.ownActiveTasks = 1.5; }],
  ['unsafe count', (r: any) => { r.counts.attention = Number.MAX_SAFE_INTEGER + 1; }],
] as const)('refuses %s rather than showing fabricated facts', (_name, change) => {
  const raw = payload(); change(raw); expect(decodeHomeAttention(raw)).toBeNull();
});

it('does not publish a late result after account A→B→A', async () => {
  let resolve!: (value: unknown) => void; mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const pending = homeAttentionClientService.paznjaZaPocetnu();
  mockAccount.accountRevision += 2; resolve({ data: payload(), error: null });
  await expect(pending).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
});

it('refuses signed-out reads before the network', async () => {
  mockAccount.user = null;
  await expect(homeAttentionClientService.paznjaZaPocetnu()).rejects.toThrow('AUTH_REQUIRED');
  expect(mockRpc).not.toHaveBeenCalled();
});

it('times out and sanitizes backend failures without replay or an empty fallback', async () => {
  jest.useFakeTimers(); mockRpc.mockReturnValue(new Promise(() => {}));
  const pending = expect(homeAttentionClientService.paznjaZaPocetnu()).rejects.toThrow('HOME_ATTENTION_UNAVAILABLE');
  await jest.advanceTimersByTimeAsync(15_001); await pending; expect(mockRpc).toHaveBeenCalledTimes(1);
  mockRpc.mockResolvedValue({ data: null, error: { message: 'PRIVATE_BACKEND_DETAIL' } });
  await expect(homeAttentionClientService.paznjaZaPocetnu()).rejects.toThrow('HOME_ATTENTION_UNAVAILABLE');
  mockRpc.mockResolvedValue({ data: null, error: null });
  await expect(homeAttentionClientService.paznjaZaPocetnu()).rejects.toThrow('HOME_ATTENTION_INVALID');
});
