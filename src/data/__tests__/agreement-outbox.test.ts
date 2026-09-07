import { AgreementMessageError, type AgreementMessagePort } from '../../contracts/agreementMessages';
import { createAgreementOutbox, type AgreementOutboxOptions } from '../agreementOutbox';

const accountId = '11111111-1111-4111-8111-111111111111';
const anotherAccount = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const agreementId = '22222222-2222-4222-8222-222222222222';
const anotherAgreement = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const messageId = '33333333-3333-4333-8333-333333333333';
const anotherMessage = '44444444-4444-4444-8444-444444444444';
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function until(condition: () => boolean) { for (let i = 0; i < 100; i++) { if (condition()) return; await Promise.resolve(); } throw new Error('Expected async boundary not reached'); }
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) };
}
let next = 0;
const models: ReturnType<typeof createAgreementOutbox>[] = [];
function setup(patch: Partial<AgreementOutboxOptions> = {}) {
  const storage = memory(); const send = jest.fn<ReturnType<AgreementMessagePort['send']>, Parameters<AgreementMessagePort['send']>>().mockResolvedValue({ messageId });
  const options = { accountId, agreementId, storage, messagePort: { send }, newId: () => `message-key-${++next}`, isCurrent: () => true, canSendNew: () => true, ...patch };
  const model = createAgreementOutbox(options); models.push(model);
  return { model, storage, send, options };
}
const first = (model: ReturnType<typeof createAgreementOutbox>) => model.getSnapshot().entries[0];
const stored = (storage: ReturnType<typeof memory>) => JSON.parse([...storage.values.values()][0]);
afterEach(() => { for (const model of models.splice(0)) model.stop(); });

it('persists the immutable scoped command before invoking the actual injected port', async () => {
  const { model, storage, send } = setup(); await model.start();
  send.mockImplementation(async command => {
    expect(stored(storage).entries[0].command).toEqual(command);
    expect(Object.isFrozen(command)).toBe(true);
    expect(command).toMatchObject({ accountId, agreementId, body: 'Stižem.' });
    return { messageId };
  });
  model.setDraft('  Stižem.  '); await model.sendDraft();
  expect(first(model)).toMatchObject({ state: 'confirmed', messageId, persisted: true });
  expect(model.getSnapshot().draft).toBe('');
  expect([...storage.values.keys()][0]).toContain(`${accountId}:${agreementId}`);
});

it('captures double taps synchronously while allowing a second draft during another RPC', async () => {
  const one = deferred<{ messageId: string }>(), two = deferred<{ messageId: string }>();
  const { model, send } = setup(); send.mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise);
  await model.start(); model.setDraft('Prva'); const a = model.sendDraft(), duplicate = model.sendDraft();
  await until(() => send.mock.calls.length === 1); await duplicate;
  model.setDraft('Druga'); const b = model.sendDraft(); await until(() => send.mock.calls.length === 2);
  expect(send.mock.calls.map(([command]) => command.body)).toEqual(['Prva', 'Druga']);
  expect(send.mock.calls[0][0].clientMessageId).not.toBe(send.mock.calls[1][0].clientMessageId);
  two.resolve({ messageId: anotherMessage }); one.resolve({ messageId }); await Promise.all([a, b]);
  expect(model.getSnapshot().entries.map(entry => entry.state)).toEqual(['confirmed', 'confirmed']);
});

it('an earlier RPC completion cannot release a later draft persistence latch', async () => {
  const old = deferred<{ messageId: string }>(), writing = deferred<void>(); const { model, storage, send } = setup();
  send.mockReturnValueOnce(old.promise); await model.start(); model.setDraft('Prva'); const a = model.sendDraft();
  await until(() => send.mock.calls.length === 1);
  storage.setItem.mockImplementationOnce(async (key, value) => { await writing.promise; storage.values.set(key, value); });
  model.setDraft('Druga'); const b = model.sendDraft(); await until(() => storage.setItem.mock.calls.length === 2);
  old.resolve({ messageId }); await Promise.resolve(); await model.sendDraft();
  expect(model.getSnapshot().capturing).toBe(true);
  writing.resolve(); await Promise.all([a, b]);
  expect(send.mock.calls.map(([command]) => command.body)).toEqual(['Prva', 'Druga']);
});

it('preserves the draft and performs no RPC when durable capture fails', async () => {
  const { model, storage, send } = setup(); await model.start(); storage.setItem.mockRejectedValueOnce(new Error('disk details'));
  model.setDraft('Sačuvaj tekst'); await model.sendDraft();
  expect(model.getSnapshot()).toMatchObject({ draft: 'Sačuvaj tekst', error: 'STORAGE_UNAVAILABLE', capturing: false });
  expect(send).not.toHaveBeenCalled(); expect(storage.values.size).toBe(0);
  await model.sendDraft(); expect(send).toHaveBeenCalledTimes(1);
});

it('retains both captured and newly composed text if storage fails mid-edit', async () => {
  const write = deferred<void>(); const { model, storage, send } = setup(); await model.start();
  storage.setItem.mockImplementationOnce(async () => { await write.promise; throw new Error('disk'); });
  model.setDraft('Prva poruka'); const sending = model.sendDraft(); await until(() => storage.setItem.mock.calls.length === 1);
  model.setDraft('Sledeća poruka'); write.resolve(); await sending;
  expect(model.getSnapshot().draft).toBe('Sledeća poruka'); expect(first(model)).toMatchObject({ state: 'failed', persisted: false, command: { body: 'Prva poruka' } });
  const frozen = first(model).command; await model.retry(frozen.clientMessageId);
  expect(send.mock.calls[0][0]).toEqual(frozen); expect(model.getSnapshot().draft).toBe('Sledeća poruka');
  expect(first(model)).toMatchObject({ state: 'confirmed', persisted: true });
});

it('storage read failure is explicit and start retries loading without any send', async () => {
  const { model, storage, send } = setup(); storage.getItem.mockRejectedValueOnce(new Error('read'));
  await model.start(); expect(model.getSnapshot()).toMatchObject({ phase: 'error', error: 'STORAGE_UNAVAILABLE' });
  await model.start(); expect(model.getSnapshot()).toMatchObject({ phase: 'ready', error: null }); expect(send).not.toHaveBeenCalled();
});

it.each(['not json', JSON.stringify({ version: 1, accountId: anotherAccount, agreementId, revision: 1, entries: [] })])('refuses corrupt or foreign stored state without overwriting it', async value => {
  const { model, storage, send } = setup(); storage.getItem.mockResolvedValue(value);
  await model.start(); expect(model.getSnapshot()).toMatchObject({ phase: 'error', error: 'STORAGE_INVALID' });
  model.setDraft('Tekst'); await model.sendDraft(); expect(send).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
});

it('rechecks ownership after a queued storage read and before persistence', async () => {
  let current = true; const read = deferred<string | null>(); const { model, storage, send } = setup({ isCurrent: () => current });
  await model.start(); storage.getItem.mockReturnValueOnce(read.promise); model.setDraft('Za A'); const pending = model.sendDraft();
  await until(() => storage.getItem.mock.calls.length === 2); current = false; read.resolve(null); await pending;
  expect(storage.setItem).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
});

it('rechecks the account immediately before RPC when it changes during durable capture', async () => {
  let current = true; const { model, storage, send } = setup({ isCurrent: () => current }); await model.start();
  storage.setItem.mockImplementationOnce(async (key, value) => { storage.values.set(key, value); current = false; });
  model.setDraft('Za prethodni nalog'); await model.sendDraft(); expect(send).not.toHaveBeenCalled();
  expect(stored(storage).accountId).toBe(accountId);
  const nextModel = setup({ storage, accountId: anotherAccount }).model; await nextModel.start(); expect(nextModel.getSnapshot().entries).toEqual([]);
});

it('stop/start during durable capture cannot revive the old dispatch after re-entry', async () => {
  const write = deferred<void>(); const { model, storage, send } = setup(); await model.start();
  storage.setItem.mockImplementationOnce(async (key, value) => { await write.promise; storage.values.set(key, value); });
  model.setDraft('Pre odlaska'); const old = model.sendDraft(); await until(() => storage.setItem.mock.calls.length === 1);
  model.stop(); const resumed = model.start(); model.setDraft('Novi nacrt'); write.resolve(); await Promise.all([old, resumed]);
  expect(send).not.toHaveBeenCalled(); expect(model.getSnapshot().draft).toBe('Novi nacrt'); expect(first(model).state).toBe('unknown');
  await model.retry(first(model).command.clientMessageId); expect(send).toHaveBeenCalledTimes(1); expect(send.mock.calls[0][0].body).toBe('Pre odlaska');
});

it('stop/start also invalidates a retry waiting for storage without changing its durable key', async () => {
  const write = deferred<void>(); const { model, storage, send } = setup(); send.mockRejectedValueOnce(new AgreementMessageError('UNAVAILABLE'));
  await model.start(); model.setDraft('Isti ključ'); await model.sendDraft(); const key = first(model).command.clientMessageId;
  storage.setItem.mockImplementationOnce(async (name, value) => { await write.promise; storage.values.set(name, value); });
  const before = storage.setItem.mock.calls.length; const retry = model.retry(key); await until(() => storage.setItem.mock.calls.length === before + 1);
  model.stop(); const resumed = model.start(); write.resolve(); await Promise.all([retry, resumed]);
  expect(send).toHaveBeenCalledTimes(1); expect(first(model)).toMatchObject({ state: 'unknown', command: { clientMessageId: key } });
  await model.retry(key); expect(send).toHaveBeenCalledTimes(2); expect(first(model).state).toBe('confirmed');
});

it('a stale account acknowledgment writes and publishes nothing into the new account', async () => {
  let current = true; const ack = deferred<{ messageId: string }>(); const { model, storage, send } = setup({ isCurrent: () => current });
  send.mockReturnValue(ack.promise); await model.start(); model.setDraft('Privatna A'); const pending = model.sendDraft(); await until(() => send.mock.calls.length === 1);
  const listener = jest.fn(); model.subscribe(listener); current = false; model.stop();
  const b = setup({ storage, accountId: anotherAccount }).model; await b.start(); const before = storage.setItem.mock.calls.length;
  ack.resolve({ messageId }); await pending;
  expect(storage.setItem.mock.calls.length).toBe(before); expect(listener).not.toHaveBeenCalled(); expect(b.getSnapshot().entries).toEqual([]);
});

it('remount restores sending as unknown and never automatically resends', async () => {
  const ack = deferred<{ messageId: string }>(); const a = setup(); a.send.mockReturnValue(ack.promise);
  await a.model.start(); a.model.setDraft('Isti pokušaj'); const pending = a.model.sendDraft(); await until(() => a.send.mock.calls.length === 1); a.model.stop();
  const b = setup({ storage: a.storage }); await b.model.start(); expect(first(b.model).state).toBe('unknown'); expect(b.send).not.toHaveBeenCalled();
  ack.resolve({ messageId }); await pending; expect(first(b.model)).toMatchObject({ state: 'confirmed', messageId });
});

it('late acknowledgments merge with new remounted commands across different storage wrappers', async () => {
  const old = deferred<{ messageId: string }>(), newer = deferred<{ messageId: string }>(); const a = setup(); a.send.mockReturnValue(old.promise);
  await a.model.start(); a.model.setDraft('Prva'); const pendingA = a.model.sendDraft(); await until(() => a.send.mock.calls.length === 1); a.model.stop();
  const b = setup({ storage: { getItem: a.storage.getItem, setItem: a.storage.setItem } }); b.send.mockReturnValue(newer.promise);
  await b.model.start(); b.model.setDraft('Druga'); const pendingB = b.model.sendDraft(); await until(() => b.send.mock.calls.length === 1);
  old.resolve({ messageId }); await pendingA;
  expect(b.model.getSnapshot().entries.map(entry => [entry.command.body, entry.state])).toEqual([['Prva', 'confirmed'], ['Druga', 'sending']]);
  newer.resolve({ messageId: anotherMessage }); await pendingB; expect(stored(a.storage).entries).toHaveLength(2);
});

it('unknown acknowledgment retries the identical durable command after terminal transition', async () => {
  let open = true; const a = setup({ canSendNew: () => open }); a.send.mockRejectedValueOnce(new AgreementMessageError('UNAVAILABLE'));
  await a.model.start(); a.model.setDraft('Stabilna'); await a.model.sendDraft(); const command = first(a.model).command;
  expect(first(a.model).state).toBe('unknown'); a.model.stop(); open = false;
  const b = setup({ storage: a.storage, canSendNew: () => open }); await b.model.start(); b.model.setDraft('Nova zabranjena'); await b.model.sendDraft();
  expect(b.send).not.toHaveBeenCalled(); expect(b.model.getSnapshot()).toMatchObject({ draft: 'Nova zabranjena', error: 'READ_ONLY' });
  await b.model.retry(command.clientMessageId); expect(b.send.mock.calls[0][0]).toEqual(command); expect(first(b.model).state).toBe('confirmed');
});

it('fresh eligibility is checked again after persistence, before a new RPC', async () => {
  let open = true; const { model, storage, send } = setup({ canSendNew: () => open }); await model.start();
  storage.setItem.mockImplementationOnce(async (key, value) => { storage.values.set(key, value); open = false; });
  model.setDraft('Kasno'); await model.sendDraft(); expect(send).not.toHaveBeenCalled(); expect(first(model)).toMatchObject({ state: 'failed', error: 'READ_ONLY' });
});

it('acknowledgment persistence failure retains an unknown stable key for safe manual retry', async () => {
  const { model, storage, send } = setup(); await model.start();
  storage.setItem.mockImplementationOnce(async (key, value) => { storage.values.set(key, value); }).mockRejectedValueOnce(new Error('ack disk'));
  model.setDraft('Jednom'); await model.sendDraft(); expect(first(model)).toMatchObject({ state: 'unknown', error: 'STORAGE_UNAVAILABLE' });
  const command = first(model).command; await model.retry(command.clientMessageId);
  expect(send.mock.calls.map(([entry]) => entry)).toEqual([command, command]); expect(first(model).state).toBe('confirmed');
});

it('reconciliation checks owner, key, exact body and UUID and preserves uncertainty on conflict', async () => {
  const { model, send } = setup(); send.mockRejectedValue(new AgreementMessageError('UNAVAILABLE')); await model.start(); model.setDraft('Tačna poruka'); await model.sendDraft();
  const clientMessageId = first(model).command.clientMessageId;
  await model.reconcile([{ senderAccountId: anotherAccount, clientMessageId, messageId, body: 'Tačna poruka' }]); expect(first(model).state).toBe('unknown');
  await model.reconcile([{ senderAccountId: accountId, clientMessageId, messageId, body: 'Druga poruka' }]); expect(model.getSnapshot().error).toBe('CONFLICT'); expect(first(model).state).toBe('unknown');
  await model.reconcile([{ senderAccountId: accountId, clientMessageId, messageId, body: 'Tačna poruka' }]); expect(first(model)).toMatchObject({ state: 'confirmed', messageId });
  expect(model.getSnapshot().error).toBeNull();
  await model.reconcile([{ senderAccountId: accountId, clientMessageId, messageId: anotherMessage, body: 'Tačna poruka' }]); expect(first(model).messageId).toBe(messageId); expect(model.getSnapshot().error).toBe('CONFLICT');
  expect(send).toHaveBeenCalledTimes(1);
});

it('repeated committed reads do not rewrite storage or repeatedly publish unchanged outbox state', async () => {
  const { model, send, storage } = setup(); send.mockRejectedValue(new AgreementMessageError('UNAVAILABLE')); await model.start(); model.setDraft('Pročitana sa servera'); await model.sendDraft();
  const command = first(model).command;
  const rows = [{ senderAccountId: accountId, clientMessageId: command.clientMessageId, messageId, body: command.body }];
  await model.reconcile(rows); const listener = jest.fn(); model.subscribe(listener); const writes = storage.setItem.mock.calls.length;
  await model.reconcile(rows); await model.reconcile(rows);
  expect(storage.setItem.mock.calls.length).toBe(writes); expect(listener).not.toHaveBeenCalled();
});

it('a refreshed committed row cannot be regressed by a late request timeout', async () => {
  const reply = deferred<{ messageId: string }>(); const { model, send } = setup(); send.mockReturnValue(reply.promise);
  await model.start(); model.setDraft('Potvrđena'); const pending = model.sendDraft(); await until(() => send.mock.calls.length === 1);
  const command = send.mock.calls[0][0]; await model.reconcile([{ senderAccountId: accountId, clientMessageId: command.clientMessageId, messageId, body: command.body }]);
  reply.reject(new AgreementMessageError('UNAVAILABLE')); await pending; expect(first(model)).toMatchObject({ state: 'confirmed', messageId });
});

it('an older failed request cannot replace a newer remounted retry state', async () => {
  const old = deferred<{ messageId: string }>(), fresh = deferred<{ messageId: string }>(); const a = setup(); a.send.mockReturnValue(old.promise);
  await a.model.start(); a.model.setDraft('Ponovi'); const oldSend = a.model.sendDraft(); await until(() => a.send.mock.calls.length === 1); const key = first(a.model).command.clientMessageId; a.model.stop();
  const b = setup({ storage: a.storage }); b.send.mockReturnValue(fresh.promise); await b.model.start(); const newSend = b.model.retry(key); await until(() => b.send.mock.calls.length === 1);
  old.reject(new AgreementMessageError('UNAVAILABLE')); await oldSend; expect(first(b.model).state).toBe('sending');
  fresh.resolve({ messageId }); await newSend; expect(first(b.model).state).toBe('confirmed');
});

it('two mounted instances serialize distinct durable additions instead of losing either', async () => {
  const store = memory(); const a = setup({ storage: store }), b = setup({ storage: { getItem: store.getItem, setItem: store.setItem } });
  await Promise.all([a.model.start(), b.model.start()]); a.model.setDraft('Leva'); b.model.setDraft('Desna');
  await Promise.all([a.model.sendDraft(), b.model.sendDraft()]); expect(stored(store).entries.map((entry: any) => entry.command.body)).toEqual(['Leva', 'Desna']);
  expect(a.model.getSnapshot().entries).toHaveLength(2); expect(b.model.getSnapshot().entries).toHaveLength(2);
});

it('capacity rejects new drafts without dropping unknown commands and recovers after confirmed read', async () => {
  const { model, send, storage } = setup({ maxPending: 2 }); send.mockRejectedValue(new AgreementMessageError('UNAVAILABLE')); await model.start();
  for (const text of ['Prva', 'Druga']) { model.setDraft(text); await model.sendDraft(); }
  model.setDraft('Treća'); await model.sendDraft(); expect(model.getSnapshot()).toMatchObject({ error: 'CAPACITY', draft: 'Treća' });
  expect(stored(storage).entries).toHaveLength(2); expect(send).toHaveBeenCalledTimes(2);
  const one = first(model).command; await model.reconcile([{ senderAccountId: accountId, clientMessageId: one.clientMessageId, messageId, body: one.body }]);
  await model.sendDraft(); expect(send).toHaveBeenCalledTimes(3); expect(model.getSnapshot().entries.filter(entry => entry.state === 'unknown')).toHaveLength(2);
});

it('duplicate generated IDs conflict without a second command or losing the new draft', async () => {
  const { model, send } = setup({ newId: () => 'same-command-key' }); await model.start(); model.setDraft('Prva'); await model.sendDraft();
  model.setDraft('Druga'); await model.sendDraft(); expect(model.getSnapshot()).toMatchObject({ error: 'CONFLICT', draft: 'Druga' }); expect(send).toHaveBeenCalledTimes(1);
});

it.each(['READ_ONLY', 'AUTH_CONTEXT_CHANGED', 'NOT_AVAILABLE', 'CONFLICT', 'INVALID_MESSAGE'] as const)('keeps an explicit failed row for server refusal %s', async code => {
  const { model, send } = setup(); send.mockRejectedValue(new AgreementMessageError(code)); await model.start(); model.setDraft('Pokušaj'); await model.sendDraft();
  expect(first(model)).toMatchObject({ state: 'failed', error: code });
});

it('malformed acknowledgment remains unknown and exposes no fabricated UUID', async () => {
  const { model, send } = setup(); send.mockResolvedValue({ messageId: 'garbage' }); await model.start(); model.setDraft('Pokušaj'); await model.sendDraft();
  expect(first(model)).toMatchObject({ state: 'unknown', error: 'INVALID_RESPONSE' }); expect(first(model).messageId).toBeUndefined();
});

it.each([' ', 'x'.repeat(2001), 'bad\0text', 'lone\ud800'])('rejects malformed new intent before persistence and dispatch', async text => {
  const { model, storage, send } = setup(); await model.start(); model.setDraft(text); await model.sendDraft();
  expect(model.getSnapshot().error).toBe('INVALID_MESSAGE'); expect(storage.setItem).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
});

it('account and Agreement scopes remain distinct even with a coincident command key', async () => {
  const store = memory(); const a = setup({ storage: store, newId: () => 'same-local-key' }); await a.model.start(); a.model.setDraft('Samo A'); await a.model.sendDraft();
  for (const patch of [{ accountId: anotherAccount }, { agreementId: anotherAgreement }]) {
    const b = setup({ storage: store, ...patch }); await b.model.start(); expect(b.model.getSnapshot().entries).toEqual([]);
  }
});

it('captures scope options at construction so later caller edits cannot retarget storage or RPC', async () => {
  const { model, storage, options, send } = setup(); options.accountId = anotherAccount; options.agreementId = anotherAgreement;
  await model.start(); model.setDraft('Izvorni kontekst'); await model.sendDraft();
  expect(send.mock.calls[0][0]).toMatchObject({ accountId, agreementId }); expect(stored(storage)).toMatchObject({ accountId, agreementId });
});

it('refuses stored untrimmed command bodies instead of silently changing retry intent', async () => {
  const a = setup(); a.send.mockRejectedValue(new AgreementMessageError('UNAVAILABLE')); await a.model.start(); a.model.setDraft('Tačna'); await a.model.sendDraft(); a.model.stop();
  const key = [...a.storage.values.keys()][0], record = stored(a.storage); record.entries[0].command.body = ' Tačna ';
  a.storage.values.set(key, JSON.stringify(record)); const writes = a.storage.setItem.mock.calls.length;
  const b = setup({ storage: a.storage }); await b.model.start(); expect(b.model.getSnapshot()).toMatchObject({ phase: 'error', error: 'STORAGE_INVALID' });
  expect(b.send).not.toHaveBeenCalled(); expect(a.storage.setItem.mock.calls.length).toBe(writes);
});

it('rejects an oversized stored envelope without truncating or overwriting commands', async () => {
  const { model, storage } = setup(); storage.getItem.mockResolvedValue(JSON.stringify({ version: 1, accountId, agreementId, revision: 1, entries: [], extra: 'x'.repeat(2_000_000) }));
  await model.start(); expect(model.getSnapshot()).toMatchObject({ phase: 'error', error: 'STORAGE_INVALID' }); expect(storage.setItem).not.toHaveBeenCalled();
});

it('rejects an oversized stored entry list without dropping pending intents', async () => {
  const a = setup(); a.send.mockRejectedValue(new AgreementMessageError('UNAVAILABLE')); await a.model.start(); a.model.setDraft('Čuva se'); await a.model.sendDraft(); a.model.stop();
  const key = [...a.storage.values.keys()][0], record = stored(a.storage);
  record.entries = Array.from({ length: 101 }, (_, index) => ({ ...record.entries[0], command: { ...record.entries[0].command, clientMessageId: `stored-key-${index}` } }));
  a.storage.values.set(key, JSON.stringify(record)); const writes = a.storage.setItem.mock.calls.length;
  const b = setup({ storage: a.storage }); await b.model.start(); expect(b.model.getSnapshot()).toMatchObject({ phase: 'error', error: 'STORAGE_INVALID' }); expect(a.storage.setItem.mock.calls.length).toBe(writes);
});
