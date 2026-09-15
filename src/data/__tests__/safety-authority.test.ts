jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { safetyClientService as service, type SafetyReportCommand } from '../safetyClientService';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const K = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', R = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
const report = (): SafetyReportCommand => ({ targetAccountId: B, needId: null, agreementId: R, category: 'HARASSMENT', reason: 'Privatan razlog', narrative: 'Privatan opis', clientRequestId: K });
const receipt = () => ({ reportId: R, received: true, createdAt: '2026-09-12T08:00:00Z', clientRequestId: K, idempotentReplay: false, authoritative: true });
const state = () => ({ accountId: A, targetAccountId: B, blocked: true, revision: 1, authoritative: true });
beforeEach(() => { mockSession = { user: { id: A }, accountRevision: 1 }; mockRpc.mockReset(); });
it('reads only the outgoing choice without passing or exposing a peer block decision', async () => {
  mockRpc.mockResolvedValue({ data: { ...state(), incomingBlocked: true }, error: null });
  expect(await service.readBlock(B)).toEqual({ ok: true, podatak: state() });
  expect(mockRpc).toHaveBeenCalledWith('rpc_get_account_block', { p_target_account_id: B });
});
it.each([{ accountId: B }, { targetAccountId: A }, { revision: 1.5 }, { blocked: 'true' }, { authoritative: false }])('rejects malformed/foreign block state %j', async patch => {
  mockRpc.mockResolvedValue({ data: { ...state(), ...patch }, error: null }); expect((await service.readBlock(B)).ok).toBe(false);
});
it('binds one immutable CAS command and validates replay receipt', async () => {
  mockRpc.mockResolvedValue({ data: { ...state(), clientRequestId: K, idempotentReplay: true }, error: null });
  const input = { targetAccountId: B, blocked: true, expectedRevision: 0, clientRequestId: K };
  const pending = service.setBlock(input); input.blocked = false;
  expect(await pending).toMatchObject({ ok: true, podatak: { blocked: true, revision: 1, idempotentReplay: true } });
  expect(mockRpc).toHaveBeenCalledWith('rpc_set_account_block', { p_target_account_id: B, p_blocked: true, p_expected_revision: 0, p_client_request_id: K });
});
it.each([{ targetAccountId: A }, { targetAccountId: 'bad' }, { expectedRevision: -1 }, { expectedRevision: 0.5 }, { clientRequestId: '' }, { blocked: null }])('rejects malformed block intent %j', async patch => {
  expect((await service.setBlock({ targetAccountId: B, blocked: true, expectedRevision: 0, clientRequestId: K, ...patch } as never)).ok).toBe(false);
  expect(mockRpc).not.toHaveBeenCalled();
});
it('submits private content once and returns only a correlated safe receipt', async () => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), narrative: 'PRIVATE_ECHO' }, error: null });
  const input = report(); const pending = service.report(input); input.narrative = 'edited later';
  expect(await pending).toEqual({ ok: true, podatak: receipt() });
  expect(mockRpc.mock.calls[0][1].p_narrative).toBe('Privatan opis');
});
it.each([{ category: 'OTHER_ENUM' }, { reason: '' }, { reason: 'x'.repeat(201) }, { narrative: 'x'.repeat(2001) }, { narrative: '\ud800' }, { needId: 'bad' }, { targetAccountId: A }])('bounds report before IO %j', async patch => {
  expect((await service.report({ ...report(), ...patch } as never)).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled();
});
it.each([{ received: false }, { reportId: 'bad' }, { clientRequestId: B }, { authoritative: false }, { idempotentReplay: 'true' }, { createdAt: 'invalid' }])('rejects uncorrelated report confirmation %j', async patch => {
  mockRpc.mockResolvedValue({ data: { ...receipt(), ...patch }, error: null });
  expect(await service.report(report())).toMatchObject({ ok: false, kod: 'SAFETY_REPORT_INVALID_RECEIPT' });
});
it('does not expose backend errors or retry an uncertain private report', async () => {
  mockRpc.mockRejectedValue(new Error('PRIVATE_NARRATIVE_TOKEN'));
  const r = await service.report(report()); expect(r).toMatchObject({ ok: false, kod: 'SAFETY_REPORT_OUTCOME_UNKNOWN' });
  expect(JSON.stringify(r)).not.toContain('TOKEN'); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('fences a late private receipt after an account switch', async () => {
  let resolve!: (v: unknown) => void; mockRpc.mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = service.report(report()); mockSession = { user: { id: B }, accountRevision: 2 };
  resolve({ data: receipt(), error: null }); expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
