import { agreementProblemService } from '../agreementClientService';
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const ID = '20000000-0000-4000-8000-000000000001';
let mockAccount: string | undefined = A, mockRevision = 1;
const mockRpc = jest.fn(), mockSingle = jest.fn();
const mockQuery = { select: jest.fn(), eq: jest.fn(), maybeSingle: mockSingle };
const mockFrom = jest.fn(() => mockQuery);
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc, from: mockFrom }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
const receipt = { agreementId: ID, problemOpenedAt: '2026-09-10T12:10:11.123456+00:00', problemOpenedBy: A,
  idempotentReplay: false, noAutomaticFaultOrDebt: true, authoritative: true };
const row = { agreement_id: ID, agreement_version: 7, problem_opened_at: receipt.problemOpenedAt,
  problem_opened_by: A, problem_narrative: 'Oštećen ormar.' };
const account = { accountId: A, accountRevision: 1 };
const submit = (text = 'Problem') => agreementProblemService.submit(ID, text, account);
const read = () => agreementProblemService.read(ID, 7, [A, B], account);
beforeEach(() => { jest.clearAllMocks(); mockRpc.mockReset(); mockSingle.mockReset(); mockAccount = A; mockRevision = 1;
  mockQuery.select.mockReturnValue(mockQuery); mockQuery.eq.mockReturnValue(mockQuery);
  mockRpc.mockResolvedValue({ data: receipt, error: null }); mockSingle.mockResolvedValue({ data: row, error: null }); });
afterEach(() => jest.useRealTimers());
it('returns the original first reporter when the counterparty won the race', async () => {
  const replay = { ...receipt, problemOpenedBy: B, idempotentReplay: true };
  mockRpc.mockResolvedValue({ data: replay, error: null }); expect(await submit()).toEqual({ ok: true, podatak: replay });
});
it('uses PostgreSQL character bounds without losing Unicode input', async () => {
  expect((await submit('😀'.repeat(4000))).ok).toBe(true); mockRpc.mockClear();
  expect(await submit('x'.repeat(4001))).toMatchObject({ ok: false, kod: 'NARRATIVE_TOO_LONG' }); expect(mockRpc).not.toHaveBeenCalled();
});
it.each([null, {}, { ...receipt, agreementId: B }, { ...receipt, authoritative: false },
  { ...receipt, noAutomaticFaultOrDebt: false }, { ...receipt, idempotentReplay: 'true' },
  { ...receipt, problemOpenedBy: 'unknown' }, { ...receipt, problemOpenedAt: '2026-02-30T12:00:00Z' },
  { ...receipt, privateOtherAccount: 'secret' }])('rejects malformed or unrelated acknowledgment %#', async data => {
  mockRpc.mockResolvedValue({ data, error: null }); expect(await submit()).toMatchObject({ ok: false, kod: 'PROBLEM_REPORT_INVALID' });
});
it('maps a known lifecycle rejection without exposing backend details', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'AGREEMENT_NOT_REPORTABLE', details: 'private' } });
  expect(await submit()).toEqual({ ok: false, kod: 'AGREEMENT_NOT_REPORTABLE', poruka: 'Problem se može prijaviti samo dok je Dogovor aktivan.' });
});
it('reads only the exact existing participant projection and original narrative', async () => {
  expect(await read()).toEqual({ ok: true, podatak: { agreementId: ID, agreementVersion: 7, state: 'AVAILABLE',
    report: { openedAt: receipt.problemOpenedAt, openedBy: A, narrative: row.problem_narrative } } });
  expect(mockFrom.mock.calls).toEqual([['agreement_execution']]);
  expect(mockQuery.select.mock.calls).toEqual([['agreement_id,agreement_version,problem_opened_at,problem_opened_by,problem_narrative']]);
  expect(mockQuery.eq.mock.calls).toEqual([['agreement_id', ID]]);
});
it('recognizes a missing report only when every report field is null', async () => {
  mockSingle.mockResolvedValue({ data: { ...row, problem_opened_at: null, problem_opened_by: null, problem_narrative: null }, error: null });
  expect(await read()).toEqual({ ok: true, podatak: { agreementId: ID, agreementVersion: 7, state: 'ABSENT', report: null } });
});
it.each([
  { ...row, problem_opened_by: null, problem_narrative: null },
  { ...row, problem_opened_by: null },
  { ...row, problem_narrative: null },
  { ...row, problem_narrative: 'x'.repeat(4001) },
])('recognizes a schema-valid historical report without inventing details or exposing long text %#', async data => {
  mockSingle.mockResolvedValue({ data, error: null });
  expect(await read()).toEqual({ ok: true, podatak: { agreementId: ID, agreementVersion: 7, state: 'LEGACY_UNAVAILABLE', report: null } });
});
it.each([
  { ...row, problem_opened_by: ID, problem_narrative: null },
  { ...row, problem_opened_at: 'invalid', problem_narrative: 'x'.repeat(4001) },
  { ...row, problem_opened_by: null, problem_narrative: 42 },
  { ...row, problem_opened_by: null, problem_narrative: '   ' },
])('does not relabel malformed or foreign details as a known legacy report %#', async data => {
  mockSingle.mockResolvedValue({ data, error: null });
  expect(await read()).toMatchObject({ ok: false, kod: 'PROBLEM_REPORT_INVALID' });
});
it.each([null, { ...row, agreement_id: B }, { ...row, agreement_version: 8 }, { ...row, agreement_version: '7' },
  { ...row, problem_opened_by: ID }, { ...row, problem_opened_at: null }, { ...row, problem_narrative: '' },
  { ...row, hidden_field: 'secret' }])('fails closed for stale/foreign/malformed readback %#', async data => {
  mockSingle.mockResolvedValue({ data, error: null }); expect((await read()).ok).toBe(false);
});
it('denies another account or missing participant context before querying', async () => {
  expect((await agreementProblemService.read(ID, 7, [B, ID], account)).ok).toBe(false); mockAccount = B;
  expect((await submit()).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled(); expect(mockFrom).not.toHaveBeenCalled();
});
it.each(['submit', 'read'] as const)('fences late %s after batched account A→B→A', async kind => {
  let resolve!: (data: unknown) => void;
  (kind === 'submit' ? mockRpc : mockSingle).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const pending = kind === 'submit' ? submit() : read(); mockRevision += 2;
  resolve({ data: kind === 'submit' ? receipt : row, error: null });
  expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('bounds a hanging write without automatic replay or a late success', async () => {
  jest.useFakeTimers(); let resolve!: (data: unknown) => void;
  mockRpc.mockImplementationOnce(() => new Promise(done => { resolve = done; })); const pending = submit();
  await jest.advanceTimersByTimeAsync(15_000);
  expect(await pending).toMatchObject({ ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED' });
  resolve({ data: receipt, error: null }); await Promise.resolve(); expect(mockRpc).toHaveBeenCalledTimes(1);
});
