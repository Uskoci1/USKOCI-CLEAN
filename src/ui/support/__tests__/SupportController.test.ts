jest.mock('../../../data/supportCaseClientService', () => ({ supportCaseClientService: {} }));
import { SupportController, supportActionAllowed, type SupportTarget } from '../SupportController';
import type { SupportCommand, SupportDetail, SupportIntent, SupportKind, SupportPayloads, SupportReceipt } from '../../../data/supportCaseTypes';

const A = '10000000-0000-4000-8000-000000000001', C = '20000000-0000-4000-8000-000000000001';
const K = '30000000-0000-4000-8000-000000000001', E = '40000000-0000-4000-8000-000000000001';
const time = '2026-09-13T05:00:00Z';
const payload: SupportPayloads['CREATE'] = { channel: 'SERVICE', topic: 'TECHNICAL', title: 'Pomoć', body: 'Privatni tekst', desiredOutcome: null, context: null, evidence: [] };
const ok = <T>(podatak: T) => ({ ok: true as const, podatak });
const unknown = { ok: false as const, kod: 'UNKNOWN', poruka: 'Ishod nije poznat.' };
const journal = (kind: SupportKind = 'CREATE'): SupportIntent => ({ version: 1, accountId: A, clientRequestId: K, kind,
  caseId: kind === 'CREATE' ? null : C, expectedRevision: kind === 'CREATE' ? null : 2, inputSha256: 'a'.repeat(64) });
function command(j: SupportIntent, state: 'ABSENT' | 'CANCELLED' | 'COMMITTED' = 'ABSENT'): SupportCommand {
  if (state !== 'COMMITTED') return { accountId: A, clientRequestId: K, state, kind: null, caseId: null, expectedRevision: null,
    inputSha256: null, receipt: null, authoritative: true };
  const receipt: SupportReceipt = { accountId: A, clientRequestId: K, kind: j.kind, caseId: C, caseNumber: '18', expectedRevision: j.expectedRevision,
    inputSha256: j.inputSha256, eventId: E, sequence: j.kind === 'CREATE' ? '1' : '3', caseRevision: (j.expectedRevision ?? 0) + 1, createdAt: time, authoritative: true };
  return { ...receipt, state, receipt };
}
function detail(): SupportDetail { return { accountId: A, case: { id: C, caseNumber: '18', authorAccountId: A, title: 'Sačuvan zahtev', desiredOutcome: null,
  channel: 'SERVICE', topic: 'TECHNICAL', status: 'IN_REVIEW', revision: 2, lastSequence: '9', createdAt: time, updatedAt: time, context: {} },
  viewerRole: 'AUTHOR', operatorAvailable: false, allowedActions: ['AUTHOR_REPLY', 'APPEAL'],
  events: [{ id: E, caseId: C, sequence: '2', kind: 'AUTHOR_REPLY', authorRole: 'AUTHOR', body: 'Samo vidljivo', createdAt: time, decisionId: null, appealId: null }],
  decisions: [], appeals: [], evidence: [], nextAfterSequence: '2', authoritative: true }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture(target: SupportTarget = { type: 'NEW' }, saved: SupportIntent | null = null) {
  let current = true;
  const events: string[] = [];
  const service = {
    loadPending: jest.fn(async () => { events.push('loadPending'); return saved; }),
    recover: jest.fn(async (j: SupportIntent) => { events.push('recover'); return ok(command(j)); }),
    capabilities: jest.fn(async () => { events.push('capabilities'); return ok({ accountId: A, operatorAvailable: false, canCreate: true, authoritative: true }); }),
    inbox: jest.fn().mockResolvedValue(ok({ accountId: A, mode: 'OWN', operatorAvailable: false, cases: [], nextBeforeCaseNumber: null, authoritative: true })),
    detail: jest.fn().mockResolvedValue(ok(detail())),
    prepare: jest.fn((kind: SupportKind, caseId: string | null, revision: number | null, value: object) => ({
      intent: { ...journal(kind), caseId, expectedRevision: revision }, payloadText: JSON.stringify(value) })),
    submit: jest.fn().mockResolvedValue(unknown), cancel: jest.fn().mockResolvedValue(unknown), markRead: jest.fn().mockResolvedValue(ok({ sequence: '9' })),
  };
  const scope = { accountId: A, accountRevision: 4, isCurrent: () => current };
  const controller = new SupportController({ target, scope, service: service as never });
  return { controller, service, scope, events, setCurrent: (value: boolean) => { current = value; } };
}

it('loads the opaque account command and recovers before presenting new actions without a write', async () => {
  const j = journal(), f = fixture({ type: 'NEW' }, j); await f.controller.load();
  expect(f.events).toEqual(['loadPending', 'recover', 'capabilities']); expect(f.service.recover).toHaveBeenCalledWith(j, f.scope);
  expect(f.controller.snapshot()).toMatchObject({ phase: 'READY', pending: j, absent: true, canReplay: false });
  await f.controller.submit('CREATE', payload, f.controller.snapshot()); await f.controller.replay(f.controller.snapshot());
  expect(f.service.prepare).not.toHaveBeenCalled(); expect(f.service.submit).not.toHaveBeenCalled();
});
it('does not bypass a corrupt local journal after repeated reads', async () => {
  const f = fixture(); f.service.loadPending.mockRejectedValue(new Error('INVALID')); await f.controller.load(); await f.controller.load();
  await f.controller.submit('CREATE', payload, f.controller.snapshot()); expect(f.controller.snapshot().phase).toBe('ERROR');
  expect(f.service.capabilities).not.toHaveBeenCalled(); expect(f.service.prepare).not.toHaveBeenCalled();
});
it('serializes a double tap to one prepared command and retains the exact RAM payload on unknown outcome', async () => {
  const f = fixture(), held = deferred<unknown>(); await f.controller.load(); f.service.submit.mockReturnValue(held.promise);
  const rendered = f.controller.snapshot(), running = f.controller.submit('CREATE', payload, rendered);
  void f.controller.submit('CREATE', { ...payload, body: 'Other body' }, rendered);
  expect(f.service.prepare).toHaveBeenCalledTimes(1); expect(f.service.submit).toHaveBeenCalledTimes(1);
  expect(f.controller.snapshot()).toMatchObject({ phase: 'SENDING', pending: journal() });
  held.resolve(unknown); await running; const state = f.controller.snapshot();
  expect(state).toMatchObject({ phase: 'READY', pending: journal(), canReplay: false });
  expect(JSON.stringify(state)).not.toContain('Privatni tekst');
  await f.controller.submit('CREATE', payload, state); expect(f.service.submit).toHaveBeenCalledTimes(1);
});
it('a read never replays; a deliberate replay after ABSENT reuses only the original in-memory identity and body', async () => {
  const f = fixture(); await f.controller.load(); await f.controller.submit('CREATE', payload, f.controller.snapshot());
  await f.controller.load(); expect(f.service.submit).toHaveBeenCalledTimes(1); expect(f.controller.snapshot().canReplay).toBe(true);
  const original = f.service.submit.mock.calls[0][0]; f.service.submit.mockResolvedValue(ok(command(journal(), 'COMMITTED')));
  await f.controller.replay(f.controller.snapshot()); expect(f.service.submit).toHaveBeenNthCalledWith(2, original, f.scope);
  expect(f.service.prepare).toHaveBeenCalledTimes(1); expect(f.controller.snapshot()).toMatchObject({ pending: null, receipt: { caseId: C }, canReplay: false });
});
it.each(['CANCELLED', 'COMMITTED'] as const)('cancel accepts only the authoritative %s readback supplied by the service', async state => {
  const j = journal(), f = fixture({ type: 'NEW' }, j); await f.controller.load(); const held = deferred<unknown>();
  f.service.cancel.mockReturnValue(held.promise); const running = f.controller.cancel(f.controller.snapshot());
  expect(f.controller.snapshot().pending).toEqual(j); held.resolve(ok(command(j, state))); await running;
  expect(f.service.cancel).toHaveBeenCalledWith(j, f.scope); expect(f.controller.snapshot().pending).toBeNull();
  expect(f.controller.snapshot().receipt?.caseId ?? null).toBe(state === 'COMMITTED' ? C : null);
  expect(f.service.submit).not.toHaveBeenCalled();
});
it('an unknown cancellation leaves the same identity pending and subsequent checks remain reads', async () => {
  const j = journal(), f = fixture({ type: 'NEW' }, j); await f.controller.load(); await f.controller.cancel(f.controller.snapshot()); await f.controller.load();
  expect(f.controller.snapshot().pending).toEqual(j); expect(f.service.cancel).toHaveBeenCalledTimes(1);
  expect(f.service.recover).toHaveBeenCalledTimes(2); expect(f.service.submit).not.toHaveBeenCalled();
});
it.each(['read', 'submit', 'cancel'] as const)('ignores a late %s result after its owner scope ends', async operation => {
  const f = fixture({ type: 'NEW' }, operation === 'cancel' ? journal() : null), held = deferred<unknown>();
  await f.controller.load(); const listener = jest.fn(); f.controller.subscribe(listener);
  if (operation === 'read') f.service.capabilities.mockReturnValue(held.promise as never);
  else f.service[operation].mockReturnValue(held.promise);
  const running = operation === 'read' ? f.controller.load() : operation === 'submit'
    ? f.controller.submit('CREATE', payload, f.controller.snapshot()) : f.controller.cancel(f.controller.snapshot());
  for (let i = 0; i < 5; i++) await Promise.resolve();
  f.setCurrent(false); f.controller.dispose(); listener.mockClear();
  held.resolve(operation === 'read' ? ok({ accountId: A, canCreate: true, operatorAvailable: true, authoritative: true }) : ok(command(journal(), 'COMMITTED')));
  await running; expect(listener).not.toHaveBeenCalled(); expect(f.controller.snapshot().receipt).toBeNull();
  f.setCurrent(true); await f.controller.submit('CREATE', payload, f.controller.snapshot());
  expect(f.service.submit).toHaveBeenCalledTimes(operation === 'submit' ? 1 : 0);
});
it('uses exact current case revision and forbids a retained action after a refresh changed the view', async () => {
  const f = fixture({ type: 'DETAIL', caseId: C }); await f.controller.load(); const old = f.controller.snapshot();
  f.service.detail.mockResolvedValue(ok({ ...detail(), case: { ...detail().case, revision: 7 } })); await f.controller.load();
  await f.controller.submit('AUTHOR_REPLY', { body: 'Stara radnja', evidence: [] }, old); expect(f.service.prepare).not.toHaveBeenCalled();
  await f.controller.submit('AUTHOR_REPLY', { body: 'Sada', evidence: [] }, f.controller.snapshot());
  expect(f.service.prepare).toHaveBeenCalledWith('AUTHOR_REPLY', C, 7, { body: 'Sada', evidence: [] }, f.scope);
});
it('requires both server allowedActions and actual viewerRole for every operator action', async () => {
  const d = { ...detail(), allowedActions: ['CLAIM', 'DECIDE', 'AUTHOR_REPLY'] as const };
  expect(supportActionAllowed(d as unknown as SupportDetail, 'CLAIM')).toBe(false);
  expect(supportActionAllowed({ ...detail(), viewerRole: 'OPERATOR' }, 'AUTHOR_REPLY')).toBe(false);
  expect(supportActionAllowed({ ...detail(), viewerRole: 'OPERATOR', allowedActions: ['CLAIM'] }, 'CLAIM')).toBe(true);
  const f = fixture({ type: 'DETAIL', caseId: C }); f.service.detail.mockResolvedValue(ok(d)); await f.controller.load();
  await f.controller.submit('CLAIM', {}, f.controller.snapshot()); expect(f.service.prepare).not.toHaveBeenCalled();
  f.service.detail.mockResolvedValue(unknown); await f.controller.load();
  await f.controller.submit('AUTHOR_REPLY', { body: 'stale', evidence: [] }, f.controller.snapshot());
  expect(f.service.prepare).not.toHaveBeenCalled(); expect(f.controller.snapshot().detail).toBeNull();
});
it('never marks read from a load and explicitly submits only the last actually rendered sequence', async () => {
  const f = fixture({ type: 'DETAIL', caseId: C }); await f.controller.load(); expect(f.service.markRead).not.toHaveBeenCalled();
  await f.controller.markRead(f.controller.snapshot()); expect(f.service.markRead).toHaveBeenCalledWith(C, '2', f.scope);
  expect(f.controller.snapshot().message).toContain('Prikazani događaji');
});
it('pages by an exact explicit cursor and refuses stale or busy pagination', async () => {
  const f = fixture({ type: 'DETAIL', caseId: C }); await f.controller.load(); const old = f.controller.snapshot();
  await f.controller.page('2', old); expect(f.service.detail).toHaveBeenLastCalledWith(C, '2', f.scope);
  await f.controller.page('8', old); expect(f.service.detail).toHaveBeenCalledTimes(2);
});
it('denies new creation when current server capability is closed', async () => {
  const f = fixture(); f.service.capabilities.mockResolvedValue(ok({ accountId: A, canCreate: false, operatorAvailable: false, authoritative: true }));
  await f.controller.load(); await f.controller.submit('CREATE', payload, f.controller.snapshot()); expect(f.service.prepare).not.toHaveBeenCalled();
});
