import { NeedSearchRecoveryController } from '../../ui/needs/NeedSearchRecoveryController';
import type { NeedSearchState, ReopenSearchCommand } from '../../contracts/needSearchRecovery';
import { needSearchRecoveryCopy } from '../../ui/needs/needSearchRecoveryCopy';

const ACCOUNT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLOSED_AT = '2026-10-05T08:00:00.123456Z';

const base = (): NeedSearchState => ({
  schemaVersion: 1, authoritative: true, serverAsOf: '2026-10-05T09:00:00Z', needId: NEED, revision: 3, status: 'SELECTION',
  requiredSlots: 2, coveredSlots: 1, missingSlots: 1, searchAuthority: 'CLOSED', closedAt: CLOSED_AT,
  searchTimeAdmitted: true, canReopen: true, reason: 'CAN_REOPEN', nextAction: 'REOPEN_SEARCH',
  agreementCount: 1, activeAgreementCount: 1, awaitingConfirmationCount: 0, openProblemCount: 0,
});
const ok = <T,>(podatak: T) => ({ ok: true as const, podatak });

function setup() {
  let current = true;
  let state = base();
  let stored: string | null = null;
  let committed = false;
  const receipt = {
    command: 'REOPEN_REMAINING_SEARCH_V1' as const, authoritative: true as const, needId: NEED, revision: 3,
    observedClosedAt: CLOSED_AT, remainingSearchClosed: false as const, reopenedAt: '2026-10-05T09:00:00Z',
    requiredSlots: 2, selectedSlots: 1, reopenedRemainingSlots: 1, idempotentReplay: true,
  };
  const services = {
    read: jest.fn(async () => ok({ ...state })),
    readReceipt: jest.fn(async () => ok(committed ? { state: 'CONFIRMED' as const, receipt } : { state: 'NOT_CONFIRMED' as const })),
    reopen: jest.fn(async (_command: ReopenSearchCommand) => {
      committed = true;
      state = { ...state, searchAuthority: 'OPEN', closedAt: null, canReopen: false,
        reason: 'SEARCH_ALREADY_OPEN', nextAction: 'SEARCH_IN_PROGRESS' };
      return ok({ ...receipt, idempotentReplay: false });
    }),
    knownRefusal: jest.fn((code: string) => code === 'STALE_SEARCH_STATE'),
  };
  const storage = {
    getItem: jest.fn(async () => stored),
    setItem: jest.fn(async (_key: string, text: string) => { stored = text; }),
    removeItem: jest.fn(async () => { stored = null; }),
  };
  const build = () => new NeedSearchRecoveryController({
    needId: NEED,
    accountId: ACCOUNT,
    current: () => current,
    services,
    storage,
    newKey: () => 'test-reopen-1234',
  });
  return {
    build, services, storage,
    setState: (next: NeedSearchState) => { state = next; },
    setStored: (next: string) => { stored = next; },
    retire: () => { current = false; },
    getStored: () => stored,
  };
}

it('loading and refresh never write a reopen command', async () => {
  const fixture = setup(), controller = fixture.build();
  await controller.load(); await controller.check();
  expect(fixture.services.reopen).not.toHaveBeenCalled();
  expect(controller.snapshot().phase).toBe('READY');
});

it('review can be cancelled without storage or network writes', async () => {
  const fixture = setup(), controller = fixture.build();
  await controller.load();
  expect(controller.prepare()?.closedAt).toBe(CLOSED_AT);
  controller.cancelReview();
  expect(fixture.storage.setItem).not.toHaveBeenCalled();
  expect(fixture.services.reopen).not.toHaveBeenCalled();
});

it('persists before sending, sends once, then confirms history and current state', async () => {
  const fixture = setup(), controller = fixture.build();
  await controller.load();
  const command = controller.prepare()!;
  await Promise.all([controller.submit(command), controller.submit(command)]);
  expect(fixture.services.reopen).toHaveBeenCalledTimes(1);
  expect(fixture.storage.setItem).toHaveBeenCalledTimes(1);
  expect(fixture.storage.setItem.mock.invocationCallOrder[0]).toBeLessThan(fixture.services.reopen.mock.invocationCallOrder[0]);
  expect(controller.snapshot().phase).toBe('RESOLVED');
  expect(controller.snapshot().snapshot?.searchAuthority).toBe('OPEN');
  expect(needSearchRecoveryCopy(controller.snapshot())?.title).toBe('Potraga je ponovo otvorena');
});

it('a cancelled review callback cannot later send', async () => {
  const fixture = setup(), controller = fixture.build();
  await controller.load();
  const command = controller.prepare()!;
  controller.cancelReview();
  await controller.submit(command);
  expect(fixture.services.reopen).not.toHaveBeenCalled();
});

it('startup with an unknown command uses only the receipt and state readers', async () => {
  const fixture = setup();
  fixture.setStored(JSON.stringify({ version: 1, accountId: ACCOUNT,
    command: { needId: NEED, revision: 3, closedAt: CLOSED_AT, clientRequestId: 'test-reopen-1234', reason: '' } }));
  const controller = fixture.build();
  await controller.load();
  expect(controller.snapshot().phase).toBe('UNKNOWN');
  expect(controller.snapshot().retryAllowed).toBe(true);
  expect(fixture.services.readReceipt).toHaveBeenCalledTimes(1);
  expect(fixture.services.reopen).not.toHaveBeenCalled();
  await controller.check();
  expect(fixture.services.reopen).not.toHaveBeenCalled();
});

it('an old successful receipt never overrides a newer closed state', async () => {
  const fixture = setup(), controller = fixture.build();
  await controller.load();
  const command = controller.prepare()!;
  await controller.submit(command);
  fixture.setState({ ...base(), closedAt: '2026-10-05T10:00:00.999999Z' });
  await controller.check();
  expect(controller.snapshot().snapshot?.searchAuthority).toBe('CLOSED');
  expect(needSearchRecoveryCopy(controller.snapshot())?.title).not.toBe('Potraga je ponovo otvorena');
  expect(fixture.services.reopen).toHaveBeenCalledTimes(1);
});

it('refuses another account journal without any writer', async () => {
  const fixture = setup();
  fixture.setStored(JSON.stringify({ version: 1, accountId: 'other',
    command: { needId: NEED, revision: 3, closedAt: CLOSED_AT, clientRequestId: 'test-reopen-1234', reason: '' } }));
  const controller = fixture.build();
  await controller.load();
  expect(controller.snapshot().phase).toBe('ERROR');
  expect(controller.prepare()).toBeNull();
  expect(fixture.services.reopen).not.toHaveBeenCalled();
});

it('leaving during journal persistence retains the journal but starts no writer', async () => {
  const fixture = setup(), controller = fixture.build();
  await controller.load();
  const command = controller.prepare()!;
  let finish!: () => void;
  fixture.storage.setItem.mockImplementationOnce(async (_key: string, text: string) => {
    fixture.setStored(text);
    await new Promise<void>(resolve => { finish = resolve; });
  });
  const pending = controller.submit(command);
  await Promise.resolve();
  fixture.retire();
  finish();
  await pending;
  expect(fixture.getStored()).not.toBeNull();
  expect(fixture.services.reopen).not.toHaveBeenCalled();
});

it('storage failure starts no server writer', async () => {
  const fixture = setup(), controller = fixture.build();
  await controller.load();
  fixture.storage.setItem.mockRejectedValueOnce(new Error('disk'));
  await controller.submit(controller.prepare()!);
  expect(fixture.services.reopen).not.toHaveBeenCalled();
});

it('expired state exposes existing Agreement navigation instead of reopening', async () => {
  const fixture = setup();
  fixture.setState({ ...base(), searchTimeAdmitted: false, canReopen: false,
    reason: 'SEARCH_WINDOW_CLOSED', nextAction: 'OPEN_AGREEMENTS' });
  const controller = fixture.build();
  await controller.load();
  expect(controller.prepare()).toBeNull();
  expect(needSearchRecoveryCopy(controller.snapshot())?.primary?.action).toBe('AGREEMENTS');
});

it('ordinary OPEN state adds no recovery panel or false promise', async () => {
  const fixture = setup();
  fixture.setState({ ...base(), closedAt: null, searchAuthority: 'OPEN', canReopen: false,
    reason: 'SEARCH_ALREADY_OPEN', nextAction: 'SEARCH_IN_PROGRESS' });
  const controller = fixture.build();
  await controller.load();
  expect(needSearchRecoveryCopy(controller.snapshot())).toBeNull();
});
