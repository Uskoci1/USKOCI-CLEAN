jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { accountClosureClientService as service } from '../accountClosureClientService';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', R = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
const preparation = () => ({ observedAt: '2026-09-12T13:00:00Z', blockers: [] as string[],
  notReadyReasons: ['LEGAL_POLICY_NOT_READY', 'RETENTION_POLICY_NOT_READY', 'CLOSURE_EXECUTION_NOT_READY'],
  legalReady: false, retentionReady: false, executionReady: false, authClosureReady: false, mediaCleanupReady: false });
const request = () => ({ accountId: A, requestId: R, state: 'NOT_READY', revision: 1,
  requestedAt: '2026-09-12T13:00:00Z', preparedAt: '2026-09-12T13:00:00Z', preparation: preparation(),
  restricted: false, canExecute: false, authoritative: true });
const receipt = () => ({ ...request(), clientRequestId: K, idempotentReplay: false });
const command = () => ({ expectedRevision: 0, clientRequestId: K });
beforeEach(() => { mockSession = { user: { id: A }, accountRevision: 1 }; mockRpc.mockReset(); });
it('does not manufacture a closure request from an empty owned status', async () => {
  const status = { accountId: A, request: null, revision: 0, restricted: false, canExecute: false, authoritative: true };
  mockRpc.mockResolvedValue({ data: status, error: null });
  expect(await service.read()).toEqual({ ok: true, podatak: status });
  expect(mockRpc).toHaveBeenCalledWith('rpc_get_account_closure', { p_expected_user_id: A });
});
it('copies one immutable prepare command without inferring READY', async () => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), privateNarrative: 'DO_NOT_ECHO' }, error: null });
  const c = command(), pending = service.prepare(c); c.expectedRevision = 99;
  expect(await pending).toEqual({ ok: true, podatak: receipt() });
  expect(mockRpc).toHaveBeenCalledWith('rpc_prepare_account_closure', { p_expected_user_id: A, p_expected_revision: 0, p_client_request_id: K });
});
it('accepts an authoritative active-agreement blocker separately from missing execution', async () => {
  const r = { ...receipt(), state: 'BLOCKED', preparation: { ...preparation(), blockers: ['ACTIVE_AGREEMENT'] } };
  mockRpc.mockResolvedValue({ data: r, error: null }); expect(await service.prepare(command())).toEqual({ ok: true, podatak: r });
});
it.each([{ expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: 2147483647 }, { expectedRevision: NaN }, { clientRequestId: 'bad' }])('rejects invalid input before network %j', async patch => {
  expect((await service.prepare({ ...command(), ...patch })).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{ accountId: B }, { requestId: 'bad' }, { clientRequestId: B }, { revision: 0 }, { revision: 2 }, { revision: 1.5 },
  { state: 'READY' }, { state: 'EXECUTING' }, { state: 'CLOSED' }, { state: 'BLOCKED' }, { canExecute: true }, { restricted: true },
  { authoritative: false }, { idempotentReplay: 'true' }, { preparedAt: 'yesterday' }, { requestedAt: '2027-01-01T00:00:00Z' }])('rejects uncorrelated or invented success %j', async patch => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), ...patch }, error: null });
  expect(await service.prepare(command())).toMatchObject({ ok: false, kod: 'CLOSURE_INVALID_RECEIPT' });
});
it.each([{ blockers: ['PRIVATE_HOLD_REASON'] }, { blockers: ['OPEN_TASK', 'OPEN_TASK'] }, { notReadyReasons: [] }, { executionReady: true },
  { authClosureReady: true }, { mediaCleanupReady: true }, { legalReady: true }, { retentionReady: true }, { observedAt: '2026-09-12T13:00:01Z' }])('rejects contradictory preparation %j', async patch => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), preparation: { ...preparation(), ...patch } }, error: null });
  expect((await service.prepare(command())).ok).toBe(false);
});
it('recovers a lost response from the exact owned command ledger without submitting again', async () => {
  mockRpc.mockRejectedValueOnce(new Error('SQL DETAIL PRIVATE_SECRET'));
  const unknown = await service.prepare(command()); expect(unknown).toMatchObject({ ok: false, kod: 'CLOSURE_OUTCOME_UNKNOWN' });
  expect(JSON.stringify(unknown)).not.toContain('PRIVATE_SECRET');
  const lookup = { accountId: A, clientRequestId: K, found: true, receipt: receipt(), authoritative: true };
  mockRpc.mockResolvedValue({ data: lookup, error: null }); expect(await service.readReceipt(K)).toEqual({ ok: true, podatak: lookup });
  expect(mockRpc).toHaveBeenCalledTimes(2); expect(mockRpc.mock.calls[1][0]).toBe('rpc_get_account_closure_receipt');
});
it.each([{ accountId: B }, { clientRequestId: B }, { found: false }, { receipt: null }])('rejects inconsistent ledger readback %j', async patch => {
  mockRpc.mockResolvedValue({ data: { accountId: A, clientRequestId: K, found: true, receipt: receipt(), authoritative: true, ...patch }, error: null });
  expect((await service.readReceipt(K)).ok).toBe(false);
});
it('does not convert unknown backend strings into product error messages', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'constraint_private_table_PROVIDER_TOKEN' } });
  const r = await service.prepare(command()); expect(r).toMatchObject({ ok: false, kod: 'CLOSURE_OUTCOME_UNKNOWN' });
  expect(JSON.stringify(r)).not.toContain('TOKEN');
});
it.each(['CLOSURE_REVISION_CONFLICT', 'REQUEST_ID_REUSED', 'ACCOUNT_CLOSING', 'AUTH_CONTEXT_CHANGED'])('preserves bounded server error %s', async code => {
  mockRpc.mockResolvedValue({ data: null, error: { message: code } }); expect(await service.prepare(command())).toMatchObject({ ok: false, kod: code });
});
it('fences an account switch and the A-B-A incarnation case', async () => {
  let resolve!: (value: unknown) => void; mockRpc.mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = service.prepare(command()); mockSession = { user: { id: A }, accountRevision: 3 };
  resolve({ data: receipt(), error: null }); expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('does no IO without a signed-in account', async () => {
  mockSession = { user: null, accountRevision: 2 }; expect(await service.prepare(command())).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  expect(mockRpc).not.toHaveBeenCalled();
});
