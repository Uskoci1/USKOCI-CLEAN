import { needLifecycleClientService as needs } from '../needLifecycleClientService';
import { preselectionQaClientService as qa } from '../preselectionQaClientService';

const mockRpc = jest.fn();
let mockAccount: { user: { id: string } | null; accountRevision: number };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
const NEED = '11111111-2222-4333-8444-555555555555';
const Q = '66666666-7777-4888-9999-000000000000';
const REQUEST = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const cancellation = { needId: NEED, revision: 4, status: 'CANCELLED', affectedResponses: 2, idempotentReplay: false, authoritative: true };
const deletion = { needId: NEED, revision: 4, deleted: true, idempotentReplay: false, authoritative: true };
const ask = { ok: true, questionId: Q, status: 'PENDING_ANSWER', needRevision: 4, idempotentReplay: false };
const answer = { ok: true, questionId: Q, status: 'ANSWERED_PUBLIC', answerVersion: 1, edited: false, idempotentReplay: false };
const disposition = { ok: true, questionId: Q, status: 'REPORTED', idempotentReplay: false };
const owner = { question_id: Q, need_revision: 4, question_text: 'Alat?', status: 'PENDING_ANSWER',
  created_at: '2026-09-08T10:00:00+00:00', answer_version: null, answer_text: null, edited: false };
const published = { question_id: Q, need_revision: 4, question_text: 'Alat?', answer_version: 1, answer_text: 'Da.',
  answered_at: '2026-09-08T10:00:00+00:00', edited: false };
const operations = [
  { name: 'cancel', call: () => needs.cancelNeed(NEED, 4), receipt: cancellation },
  { name: 'delete', call: () => needs.deleteDraftNeed(NEED, 4), receipt: deletion },
  { name: 'ask', call: () => qa.askQuestion(NEED, 4, 'Pitanje?', REQUEST), receipt: ask },
  { name: 'answer', call: () => qa.answerQuestion(Q, 'Da.', REQUEST), receipt: answer },
  { name: 'disposition', call: () => qa.dispositionQuestion(Q, 'REPORT', REQUEST), receipt: disposition },
];
function respond(data: unknown) { mockRpc.mockResolvedValue({ data, error: null }); }
beforeEach(() => {
  mockRpc.mockReset(); mockAccount = { user: { id: 'account-a' }, accountRevision: 1 };
});
afterEach(() => jest.useRealTimers());

for (const operation of operations) {
  describe('strict ' + operation.name + ' receipt', () => {
    for (const field of Object.keys(operation.receipt)) {
      it('refuses a missing ' + field + ' instead of inventing a successful outcome', async () => {
        const incomplete: Record<string, unknown> = { ...operation.receipt }; delete incomplete[field]; respond(incomplete);
        await expect(operation.call()).resolves.toMatchObject({ ok: false });
        expect(mockRpc).toHaveBeenCalledTimes(1);
      });
    }
    it('accepts the exact complete receipt but not null or a list', async () => {
      respond(operation.receipt); await expect(operation.call()).resolves.toMatchObject({ ok: true });
      for (const raw of [null, [], [operation.receipt], false, 'success']) {
        respond(raw); await expect(operation.call()).resolves.toMatchObject({ ok: false });
      }
    });
    it('never leaks a raw error through either code or copy', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'private bearer token-value', code: 'internal-secret' } });
      const result = await operation.call(); expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/private|bearer|token-value|internal-secret/);
    });
    it('sanitizes a thrown transport error, without automatically retrying a write', async () => {
      mockRpc.mockRejectedValue(new Error('private token-value'));
      const result = await operation.call(); expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('token-value'); expect(mockRpc).toHaveBeenCalledTimes(1);
    });
    it('refuses a signed-out call before the network', async () => {
      mockAccount.user = null; respond(operation.receipt);
      await expect(operation.call()).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
      expect(mockRpc).not.toHaveBeenCalled();
    });
    it('drops a late receipt after A→B→A, even when account A is rendered again', async () => {
      let resolve!: (value: unknown) => void;
      mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
      const pending = operation.call();
      mockAccount = { user: { id: 'account-a' }, accountRevision: 3 };
      resolve({ data: operation.receipt, error: null });
      await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    });
  });
}

it.each([undefined, '4', -1, 0, 4.5, Infinity, NaN, 2_147_483_648])('rejects an invalid numeric revision %p', async revision => {
  respond({ ...cancellation, revision }); await expect(needs.cancelNeed(NEED, 4)).resolves.toMatchObject({ ok: false });
  respond({ ...published, need_revision: revision }); await expect(qa.publicQa(NEED)).resolves.toMatchObject({ ok: false });
});
it('does not attribute another object receipt or changed revision to the requested mutation', async () => {
  respond({ ...cancellation, needId: Q }); await expect(needs.cancelNeed(NEED, 4)).resolves.toMatchObject({ ok: false });
  respond({ ...cancellation, revision: 5 }); await expect(needs.cancelNeed(NEED, 4)).resolves.toMatchObject({ ok: false });
  respond({ ...deletion, needId: Q }); await expect(needs.deleteDraftNeed(NEED, 4)).resolves.toMatchObject({ ok: false });
  respond({ ...answer, questionId: NEED }); await expect(qa.answerQuestion(Q, 'Da.', REQUEST)).resolves.toMatchObject({ ok: false });
  respond({ ...disposition, status: 'IGNORED' }); await expect(qa.dispositionQuestion(Q, 'REPORT', REQUEST)).resolves.toMatchObject({ ok: false });
});
it('preserves the server-authorized already-cancelled replay revision rather than reinterpreting its contract', async () => {
  respond({ ...cancellation, revision: 5, affectedResponses: 0, idempotentReplay: true });
  await expect(needs.cancelNeed(NEED, 4)).resolves.toMatchObject({ ok: true, podatak: { revision: 5, affectedResponses: 0, idempotentReplay: true } });
  respond({ ...cancellation, revision: 5, affectedResponses: 2, idempotentReplay: true });
  await expect(needs.cancelNeed(NEED, 4)).resolves.toMatchObject({ ok: false });
});
it.each([0, -1, '1', NaN, Infinity, 1.5])('rejects a malformed answer version %p', async answerVersion => {
  respond({ ...answer, answerVersion }); await expect(qa.answerQuestion(Q, 'Da.', REQUEST)).resolves.toMatchObject({ ok: false });
});
it('never fabricates an edited flag, replay flag, or counter from a truthy value', async () => {
  for (const idempotentReplay of [0, 1, 'true', null]) {
    respond({ ...ask, idempotentReplay }); await expect(qa.askQuestion(NEED, 4, '?', REQUEST)).resolves.toMatchObject({ ok: false });
  }
  for (const affectedResponses of ['0', -1, 0.5, Infinity, NaN]) {
    respond({ ...cancellation, affectedResponses }); await expect(needs.cancelNeed(NEED, 4)).resolves.toMatchObject({ ok: false });
  }
  respond({ ...answer, edited: true }); await expect(qa.answerQuestion(Q, 'Da.', REQUEST)).resolves.toMatchObject({ ok: false });
});
it.each(['owner', 'public'])('accepts only a real array for %s Q&A, never a false empty result', async view => {
  const call = () => view === 'owner' ? qa.ownerQuestions(NEED) : qa.publicQa(NEED);
  for (const raw of [null, undefined, {}, false, '', { rows: [] }]) {
    respond(raw); await expect(call()).resolves.toMatchObject({ ok: false });
  }
  respond([]); await expect(call()).resolves.toEqual({ ok: true, podatak: [] });
});
for (const [name, fixture, call] of [
  ['owner', owner, () => qa.ownerQuestions(NEED)], ['public', published, () => qa.publicQa(NEED)],
] as const) {
  for (const field of Object.keys(fixture)) {
    it(name + ' projection refuses missing ' + field, async () => {
      const incomplete: Record<string, unknown> = { ...fixture }; delete incomplete[field];
      respond([incomplete]); await expect(call()).resolves.toMatchObject({ ok: false });
    });
  }
  it(name + ' projection whitelists public fields and drops late reads after account change', async () => {
    respond([{ ...fixture, asker_account_id: 'private-account', email: 'private-email', token: 'private-token' }]);
    const result = await call(); expect(result.ok).toBe(true); expect(JSON.stringify(result)).not.toContain('private');
    let resolve!: (value: unknown) => void;
    mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = call(); mockAccount = { user: { id: 'b' }, accountRevision: 2 };
    resolve({ data: [fixture], error: null });
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
}
it('bounds a lost response, does not replay automatically, and cannot publish a late success', async () => {
  jest.useFakeTimers(); let resolve!: (value: unknown) => void;
  mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const pending = needs.cancelNeed(NEED, 4);
  await jest.advanceTimersByTimeAsync(15_001);
  const result = await pending; expect(result).toMatchObject({ ok: false, kod: 'NEED_CANCEL_FAILED' });
  resolve({ data: cancellation, error: null }); await Promise.resolve();
  expect(result.ok).toBe(false); expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('preserves a same-account refresh and exact text bytes with the same caller-owned request id', async () => {
  let resolve!: (value: unknown) => void;
  mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const pending = qa.askQuestion(NEED, 4, '  Pitanje?  ', REQUEST);
  mockAccount = { user: { id: 'account-a' }, accountRevision: 1 };
  resolve({ data: ask, error: null }); await expect(pending).resolves.toMatchObject({ ok: true });
  expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_question_text: '  Pitanje?  ', p_request_id: REQUEST });
});
it('rejects invalid input before starting a transport or a permission-dependent mutation', async () => {
  await expect(needs.cancelNeed('not-id', 4)).resolves.toMatchObject({ ok: false });
  await expect(needs.deleteDraftNeed(NEED, NaN)).resolves.toMatchObject({ ok: false });
  await expect(qa.askQuestion(NEED, 0, '?', REQUEST)).resolves.toMatchObject({ ok: false });
  await expect(qa.answerQuestion(Q, 'Da.', 'bad-request-id')).resolves.toMatchObject({ ok: false, kod: 'REQUEST_ID_INVALID' });
  expect(mockRpc).not.toHaveBeenCalled();
});
