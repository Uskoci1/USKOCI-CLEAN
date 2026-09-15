jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: null, accountRevision: 0 }) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: jest.fn() }) }));
import { createNeedLifecycleController } from '../needLifecycleController';
import type { NeedLifecycleCommand } from '../../contracts/needLifecycle';
import type { ReceiptAccount } from '../serverReceipt';
const NEED = '11111111-2222-4333-8444-555555555555';
const OTHER = '22222222-2222-4333-8444-555555555555';
const receipt = { needId: NEED, revision: 3, deleted: true as const, idempotentReplay: false };
const success = { ok: true as const, podatak: receipt };
const unknown = { ok: false as const, kod: 'DRAFT_DELETE_FAILED', poruka: 'Ishod nije potvrđen.' };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup(action: NeedLifecycleCommand['action'] = 'DELETE_DRAFT') {
  const account: ReceiptAccount = { accountId: 'account-a', accountRevision: 1 };
  let current: ReceiptAccount | null = { ...account };
  const command: NeedLifecycleCommand = { action, needId: NEED, expectedRevision: 3, reason: 'Kontrolisan zahtev' };
  const service = {
    deleteDraftNeed: jest.fn().mockResolvedValue(success),
    cancelNeed: jest.fn().mockResolvedValue({ ok: true, podatak: { needId: NEED, revision: 3, status: 'CANCELLED', affectedResponses: 2, idempotentReplay: false } }),
    readCommandReceipt: jest.fn().mockResolvedValue({ ok: true, podatak: { state: 'NOT_CONFIRMED' } }),
  };
  const refresh = jest.fn().mockResolvedValue([]);
  const controller = createNeedLifecycleController({ account, command, service, refreshOwnedNeeds: refresh, currentAccount: () => current });
  return { controller, service, refresh, command, setAccount(value: ReceiptAccount | null) { current = value; } };
}

test('two taps and a reentrant subscriber issue exactly one immutable delete command', async () => {
  const h = setup(); const wait = deferred<typeof success>(); h.service.deleteDraftNeed.mockReturnValue(wait.promise);
  h.controller.subscribe(() => { void h.controller.submit(); });
  const first = h.controller.submit(), second = h.controller.submit();
  expect(first).toBe(second); await Promise.resolve();
  expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1);
  expect(h.service.deleteDraftNeed).toHaveBeenCalledWith(NEED, 3, 'Kontrolisan zahtev');
  wait.resolve(success); await first;
  expect(h.controller.snapshot()).toMatchObject({ phase: 'CONFIRMED', confirmation: { action: 'DELETE_DRAFT', receipt } });
  expect(h.refresh).toHaveBeenCalledWith({ accountId: 'account-a', accountRevision: 1 });
  await h.controller.submit(); expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1);
});

test('a lost delete reply remains unknown even if an owned list is empty', async () => {
  const h = setup(); h.service.deleteDraftNeed.mockResolvedValueOnce(unknown);
  await h.controller.submit(); await h.controller.retrySame(); await h.controller.submit();
  expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1);
  expect(h.controller.snapshot().phase).toBe('UNKNOWN_OUTCOME');
  expect(h.refresh).not.toHaveBeenCalled();
  await h.controller.reconcile();
  expect(h.service.readCommandReceipt).toHaveBeenCalledWith(h.command);
  expect(h.controller.snapshot()).toMatchObject({ phase: 'UNKNOWN_OUTCOME', confirmation: null });
});

test('only an owner-bound authoritative readback confirms the lost delete', async () => {
  const h = setup(); h.service.deleteDraftNeed.mockResolvedValueOnce(unknown);
  h.service.readCommandReceipt.mockResolvedValue({ ok: true, podatak: { state: 'CONFIRMED', confirmation: { action: 'DELETE_DRAFT', receipt: { ...receipt, idempotentReplay: true } } } });
  await h.controller.submit(); await h.controller.reconcile();
  expect(h.controller.snapshot()).toMatchObject({ phase: 'CONFIRMED', confirmation: { receipt: { idempotentReplay: true } } });
  expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1); expect(h.refresh).toHaveBeenCalledTimes(1);
});

test('explicit retry is readback-first and retains original identity/revision/reason', async () => {
  const h = setup(); h.service.deleteDraftNeed.mockResolvedValueOnce(unknown);
  await h.controller.submit();
  (h.command as { needId: string; expectedRevision: number; reason: string }).needId = OTHER;
  (h.command as { expectedRevision: number }).expectedRevision = 90;
  await h.controller.retrySame(); expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1);
  await h.controller.reconcile(); await h.controller.retrySame();
  expect(h.service.deleteDraftNeed.mock.calls).toEqual([[NEED, 3, 'Kontrolisan zahtev'], [NEED, 3, 'Kontrolisan zahtev']]);
  expect(h.controller.snapshot().phase).toBe('CONFIRMED');
});

test('failed readback does not license another mutation', async () => {
  const h = setup(); h.service.deleteDraftNeed.mockResolvedValue(unknown);
  h.service.readCommandReceipt.mockResolvedValue({ ok: false, kod: 'NEED_RECEIPT_READ_FAILED', poruka: 'Nedostupno.' });
  await h.controller.submit(); await h.controller.reconcile(); await h.controller.retrySame();
  expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1);
  expect(h.controller.snapshot().phase).toBe('UNKNOWN_OUTCOME');
});

test.each(['STALE_REVIEW_REQUIRED', 'NEED_NOT_DELETABLE_DRAFT', 'DRAFT_HAS_AUTHORITATIVE_HISTORY', 'NEED_CANCELLATION_REQUIRES_AGREEMENT_FLOW'])(
  'authoritative %s requires fresh review instead of forced retry', async kod => {
    const h = setup(); h.service.deleteDraftNeed.mockResolvedValue({ ok: false, kod, poruka: 'Pregledajte aktuelno stanje.' });
    await h.controller.submit(); await h.controller.reconcile(); await h.controller.retrySame();
    expect(h.controller.snapshot()).toMatchObject({ phase: 'REJECTED', error: { kod } });
    expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1); expect(h.service.readCommandReceipt).not.toHaveBeenCalled();
  });

test('cancel uses its own authoritative receipt and never falls through to deletion', async () => {
  const h = setup('CANCEL'); await h.controller.submit();
  expect(h.service.deleteDraftNeed).not.toHaveBeenCalled();
  expect(h.controller.snapshot()).toMatchObject({ phase: 'CONFIRMED', confirmation: { action: 'CANCEL', receipt: { affectedResponses: 2 } } });
});

test.each([null, { accountId: 'account-b', accountRevision: 2 }, { accountId: 'account-a', accountRevision: 3 }])(
  'logout, A→B and A→B→A discard late receipts and suppress collection refresh: %j', async next => {
    const h = setup(); const wait = deferred<typeof success>(); h.service.deleteDraftNeed.mockReturnValue(wait.promise);
    const pending = h.controller.submit(); await Promise.resolve(); h.setAccount(next); wait.resolve(success); await pending;
    expect(h.controller.snapshot()).toMatchObject({ phase: 'ACCOUNT_CHANGED', confirmation: null });
    expect(h.refresh).not.toHaveBeenCalled(); await h.controller.retrySame(); expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1);
  });

test('account switch before queued command prevents transport completely', async () => {
  const h = setup(); const pending = h.controller.submit(); h.setAccount({ accountId: 'account-b', accountRevision: 2 });
  await pending; expect(h.service.deleteDraftNeed).not.toHaveBeenCalled();
});

test('transport throw is unknown, not failed/successful deletion', async () => {
  const h = setup(); h.service.deleteDraftNeed.mockRejectedValueOnce(new Error('private SQL body'));
  await h.controller.submit(); expect(h.controller.snapshot()).toMatchObject({ phase: 'UNKNOWN_OUTCOME', error: { kod: 'UNKNOWN_OUTCOME' } });
  expect(JSON.stringify(h.controller.snapshot())).not.toContain('SQL');
});

test('list refresh failure cannot undo success or send another terminal command', async () => {
  const h = setup(); h.refresh.mockRejectedValueOnce(new Error('read failed'));
  await h.controller.submit(); expect(h.controller.snapshot()).toMatchObject({ phase: 'CONFIRMED', collectionRefreshRequired: true });
  await h.controller.refreshCollection(); expect(h.controller.snapshot()).toMatchObject({ phase: 'CONFIRMED', collectionRefreshRequired: false });
  expect(h.service.deleteDraftNeed).toHaveBeenCalledTimes(1);
});

test('disposed owner suppresses late readback confirmation', async () => {
  const h = setup(); h.service.deleteDraftNeed.mockResolvedValue(unknown); await h.controller.submit();
  const read = deferred<unknown>(); h.service.readCommandReceipt.mockReturnValue(read.promise);
  const pending = h.controller.reconcile(); await Promise.resolve(); h.controller.dispose();
  read.resolve({ ok: true, podatak: { state: 'CONFIRMED', confirmation: { action: 'DELETE_DRAFT', receipt } } }); await pending;
  expect(h.controller.snapshot().phase).toBe('ACCOUNT_CHANGED'); expect(h.refresh).not.toHaveBeenCalled();
});

test.each([{ action: 'TYPO' }, { needId: 'bad' }, { expectedRevision: 0 }, { reason: 'x'.repeat(501) }])(
  'invalid command cannot become an implicit delete: %j', async patch => {
    const service = { cancelNeed: jest.fn(), deleteDraftNeed: jest.fn(), readCommandReceipt: jest.fn() };
    const c = createNeedLifecycleController({ account: { accountId: 'a', accountRevision: 1 },
      currentAccount: () => ({ accountId: 'a', accountRevision: 1 }), refreshOwnedNeeds: async () => [], service,
      command: { action: 'DELETE_DRAFT', needId: NEED, expectedRevision: 3, reason: '', ...patch } as NeedLifecycleCommand });
    await c.submit(); expect(c.snapshot()).toMatchObject({ phase: 'REJECTED', error: { kod: 'NEED_COMMAND_INVALID_INPUT' } });
    expect(service.deleteDraftNeed).not.toHaveBeenCalled(); expect(service.cancelNeed).not.toHaveBeenCalled();
  });
