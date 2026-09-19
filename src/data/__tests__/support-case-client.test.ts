jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockOwner }));
jest.mock('@react-native-async-storage/async-storage', () => { const values = new Map<string, string>(); return {
  getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { values.delete(key); }), clear: jest.fn(async () => values.clear()),
}; });
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => mockKey }));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createHash } from 'node:crypto';
import { supportCaseClientService as service, decodeSupportCommand, serializeSupportPayload, supportInputHash, type SupportIntent, type SupportScope } from '../supportCaseClientService';
import { parseSupportIntent, supportCaseJournal as journal } from '../supportCaseJournal';
const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002';
const C = '20000000-0000-4000-8000-000000000001', K = '30000000-0000-4000-8000-000000000001', E = '40000000-0000-4000-8000-000000000001';
const time = '2026-09-13T05:00:00.123456Z', mockRpc = jest.fn(); let mockKey = K, mockOwner = { user: { id: A }, accountRevision: 3 };
const scope: SupportScope = { accountId: A, accountRevision: 3 };
const payload = () => ({ channel: 'SERVICE' as const, topic: 'TECHNICAL' as const, title: 'Pomoć', body: 'Privatno: не ради 🙂', desiredOutcome: null, context: null, evidence: [] });
const prepare = () => service.prepare('CREATE', null, null, payload(), scope);
const ok = (data: unknown) => ({ data, error: null });
const command = (j: SupportIntent, state: 'COMMITTED' | 'CANCELLED' | 'ABSENT' = 'COMMITTED') => ({ accountId: A, clientRequestId: j.clientRequestId,
  kind: state === 'COMMITTED' ? j.kind : null, state, caseId: state === 'COMMITTED' ? j.caseId ?? C : null,
  expectedRevision: state === 'COMMITTED' ? j.expectedRevision : null, inputSha256: state === 'COMMITTED' ? j.inputSha256 : null,
  receipt: state === 'COMMITTED' ? { accountId: A, clientRequestId: j.clientRequestId, kind: j.kind, caseId: j.caseId ?? C, caseNumber: '71',
    expectedRevision: j.expectedRevision, inputSha256: j.inputSha256, eventId: E, sequence: j.kind === 'CREATE' ? '1' : '8',
    caseRevision: (j.expectedRevision ?? 0) + 1, createdAt: time, authoritative: true } : null, authoritative: true });
beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); mockRpc.mockReset(); mockKey = K; mockOwner = { user: { id: A }, accountRevision: 3 }; });
it('hashes exact ordered TEXT as real UTF8 SHA256, including Cyrillic, emoji and escaped newline', () => {
  const p = { ...payload(), body: 'Čekam\nодговор 🙂', context: { kind: 'AGREEMENT' as const, id: C, revision: 2 } };
  const encoded = serializeSupportPayload('CREATE', p);
  expect(encoded).toBe(JSON.stringify(p));
  expect(supportInputHash('CREATE', null, null, encoded)).toBe(createHash('sha256').update('CREATE\n\n\n' + encoded, 'utf8').digest('hex'));
  const reversed = { evidence: p.evidence, context: p.context, desiredOutcome: null, body: p.body, title: p.title, topic: p.topic, channel: p.channel };
  expect(serializeSupportPayload('CREATE', reversed)).toBe(encoded);
  expect(supportInputHash('CLAIM', C, 2, '{}')).not.toBe(supportInputHash('CLAIM', C, 3, '{}'));
});
it.each([{ title: 'x'.repeat(201) }, { body: '🙂'.repeat(4001) }, { body: '\ud800' }, { desiredOutcome: 'x'.repeat(1001) },
  { context: { kind: 'TASK', id: C, revision: null } }, { context: { kind: 'TASK', id: C, revision: 1, private: 'leak' } },
  { channel: 'SAFETY', topic: 'SAFETY_REPORT' }, { topic: 'NO_SHOW' }, { topic: 'PUBLICATION_REVIEW', channel: 'TASK', context: null },
  { unexpected: 'SECRET' }])('rejects invalid inputs before transport %#', patch => {
  expect(() => serializeSupportPayload('CREATE', { ...payload(), ...patch } as never)).toThrow(); expect(mockRpc).not.toHaveBeenCalled();
});
it('keeps account-bound opaque intent, rejects raw narrative, and does not overwrite another unresolved command', async () => {
  const j = prepare().intent; await journal.save(j);
  expect(await journal.load(A)).toEqual(j); expect(await journal.load(B)).toBeNull();
  const stored = String((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
  expect(Object.keys(JSON.parse(stored)).length).toBe(7); expect(stored).not.toContain('Privatno');
  expect(() => parseSupportIntent(JSON.stringify({ ...j, body: 'SECRET' }), A)).toThrow();
  expect(() => parseSupportIntent(JSON.stringify(j), B)).toThrow();
  await expect(journal.save({ ...j, clientRequestId: B })).rejects.toThrow('SUPPORT_UNRESOLVED_INTENT');
  await journal.clear({ ...j, inputSha256: 'f'.repeat(64) }); expect(await journal.load(A)).toEqual(j);
});
it('serializes competing journal saves and preserves malformed persisted data for explicit recovery', async () => {
  const j = prepare().intent;
  expect((await Promise.allSettled([journal.save(j), journal.save({ ...j, clientRequestId: B })])).map(x => x.status)).toEqual(['fulfilled', 'rejected']);
  const key = `uskoci.support.command.v1.${A}`;
  await AsyncStorage.setItem(key, '{bad'); await expect(journal.save(j)).rejects.toThrow(); await expect(journal.clear(j)).rejects.toThrow();
  expect(await AsyncStorage.getItem(key)).toBe('{bad');
});
it('clears only after canonical matching read, never from the submit ACK', async () => {
  const p = prepare(); let resolveRead!: (v: unknown) => void;
  mockRpc.mockImplementation((name: string) => name === 'rpc_support_submit_v5' ? Promise.resolve(ok(command(p.intent))) : new Promise(resolve => { resolveRead = resolve; }));
  const pending = service.submit(p, scope);
  for (let n = 0; n < 20 && !resolveRead; n++) await Promise.resolve();
  expect(await journal.load(A)).toEqual(p.intent);
  resolveRead(ok(command(p.intent))); expect(await pending).toEqual({ ok: true, podatak: command(p.intent) }); expect(await journal.load(A)).toBeNull();
  expect(mockRpc.mock.calls.map(c => c[0])).toEqual(['rpc_support_submit_v5', 'rpc_support_read_command_v5']);
  expect(mockRpc.mock.calls[0][1].p_payload_text).toBe(p.payloadText); expect(mockRpc.mock.calls[0][1]).not.toHaveProperty('p_payload');
});
it('recovers a lost HTTP acknowledgement without replay or a new key', async () => {
  const p = prepare(); mockRpc.mockRejectedValueOnce(new Error('lost')).mockResolvedValueOnce(ok(command(p.intent)));
  expect((await service.submit(p, scope)).ok).toBe(true); expect(mockRpc).toHaveBeenCalledTimes(2); expect(await journal.load(A)).toBeNull();
});
it('ABSENT remains unresolved across restart; only a matching terminal read following cancel unlocks it', async () => {
  const p = prepare(); mockRpc.mockResolvedValue(ok(command(p.intent, 'ABSENT')));
  expect(await service.submit(p, scope)).toEqual({ ok: true, podatak: command(p.intent, 'ABSENT') });
  expect(await service.loadPending(scope)).toEqual(p.intent);
  mockKey = B; expect(await service.submit(prepare(), scope)).toMatchObject({ ok: false, kod: 'SUPPORT_UNRESOLVED_INTENT' });
  expect(mockRpc).toHaveBeenCalledTimes(2);
  mockRpc.mockRejectedValueOnce(new Error('lost cancel ack')).mockResolvedValueOnce(ok(command(p.intent, 'CANCELLED')));
  expect(await service.cancel(p.intent, scope)).toEqual({ ok: true, podatak: command(p.intent, 'CANCELLED') }); expect(await journal.load(A)).toBeNull();
});
it('cancel losing a race returns the original committed case and preserves its receipt', async () => {
  const p = prepare(); await journal.save(p.intent); mockRpc.mockResolvedValue(ok(command(p.intent)));
  expect(await service.cancel(p.intent, scope)).toEqual({ ok: true, podatak: command(p.intent) }); expect(await journal.load(A)).toBeNull();
});
it.each([{ accountId: B }, { clientRequestId: B }, { inputSha256: 'f'.repeat(64) }, { kind: 'CLAIM' }, { expectedRevision: 9 },
  { authoritative: false }, { body: 'PRIVATE' }])('rejects wrong canonical command without clearing local state %#', async patch => {
  const p = prepare(); await journal.save(p.intent); mockRpc.mockResolvedValue(ok({ ...command(p.intent), ...patch }));
  expect((await service.recover(p.intent, scope)).ok).toBe(false); expect(await journal.load(A)).toEqual(p.intent);
});
it.each([{ accountId: B }, { caseId: B }, { expectedRevision: 1 }, { inputSha256: 'f'.repeat(64) }, { caseRevision: 2 }, { sequence: '0' },
  { clientRequestId: B }, { effect: 'ALLOW_PUBLICATION' }, { caseNumber: '01' }, { createdAt: 'today' }])('binds every receipt field to the original intent %#', patch => {
  const p = prepare(), r = command(p.intent); expect(decodeSupportCommand({ ...r, receipt: { ...r.receipt, ...patch } }, p.intent)).toBeNull();
});
it('freezes caller-owned arguments and prevents duplicate inflight submit', async () => {
  const p = prepare(), original = { ...p.intent }; let release!: (v: unknown) => void;
  mockRpc.mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue(ok(command(original)));
  const pending = service.submit(p, scope);
  expect(await service.submit(p, scope)).toMatchObject({ ok: false, kod: 'SUPPORT_BUSY' });
  for (let n = 0; n < 20 && !release; n++) await Promise.resolve();
  p.intent.inputSha256 = 'f'.repeat(64); p.payloadText = 'PRIVATE replacement'; release(ok(command(original)));
  expect((await pending).ok).toBe(true); expect(mockRpc).toHaveBeenCalledTimes(2);
});
it('a late blur or account ABA cannot clear the old opaque intent or issue recovery HTTP', async () => {
  for (const change of ['blur', 'aba']) {
    await AsyncStorage.clear(); const p = prepare(); let active = true, release!: (v: unknown) => void;
    mockRpc.mockReset().mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const pending = service.submit(p, { ...scope, isCurrent: () => active });
    for (let n = 0; n < 20 && !release; n++) await Promise.resolve();
    if (change === 'blur') active = false; else mockOwner.accountRevision = 4;
    release(ok(command(p.intent))); expect((await pending).ok).toBe(false); expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(await journal.load(A)).toEqual(p.intent); mockOwner.accountRevision = 3;
  }
});
it('does not clear from a recovery read which finishes after the screen loses focus', async () => {
  const p = prepare(); await journal.save(p.intent); let active = true;
  mockRpc.mockImplementation(async () => { active = false; return ok(command(p.intent)); });
  expect((await service.recover(p.intent, { ...scope, isCurrent: () => active })).ok).toBe(false); expect(await journal.load(A)).toEqual(p.intent);
});
it('rejects a modified RAM payload before write, and never returns arbitrary backend text', async () => {
  const p = prepare(); p.payloadText = JSON.stringify({ ...payload(), body: 'different' });
  expect((await service.submit(p, scope)).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled();
  mockRpc.mockResolvedValue({ data: null, error: { message: 'PRIVATE PROVIDER SECRET' } });
  expect(JSON.stringify(await service.capabilities(scope))).not.toContain('SECRET');
});
it('keeps a real quota explanation without treating ABSENT as a safe cancellation', async () => {
  const p = prepare(); mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'SUPPORT_CASE_DAILY_LIMIT' } }).mockResolvedValueOnce(ok(command(p.intent, 'ABSENT')));
  expect(await service.submit(p, scope)).toMatchObject({ ok: false, kod: 'SUPPORT_CASE_DAILY_LIMIT' });
  expect(await journal.load(A)).toEqual(p.intent);
});
it('acknowledges only an explicit visible event, allowing a previously higher read watermark', async () => {
  mockRpc.mockResolvedValue(ok({ accountId: A, caseId: C, sequence: '12', authoritative: true }));
  expect(await service.markRead(C, '10', scope)).toEqual({ ok: true, podatak: { accountId: A, caseId: C, sequence: '12', authoritative: true } });
  expect(mockRpc.mock.calls[0]).toEqual(['rpc_support_mark_read_v5', { p_expected_user_id: A, p_case_id: C, p_sequence: '10' }]);
  mockRpc.mockResolvedValue(ok({ accountId: A, caseId: C, sequence: '9', authoritative: true }));
  expect((await service.markRead(C, '10', scope)).ok).toBe(false);
  mockRpc.mockClear(); expect((await service.markRead(C, '0', scope)).ok).toBe(false); expect(mockRpc).not.toHaveBeenCalled();
});
