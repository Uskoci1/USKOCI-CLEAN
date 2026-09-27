import { AgreementMessageError, type AgreementMessagePort } from '../../contracts/agreementMessages';
import { createAgreementOutbox, forgetAgreementOutboxes, type AgreementOutboxOptions } from '../agreementOutbox';

const accountId = '11111111-1111-4111-8111-111111111111';
const agreementId = '22222222-2222-4222-8222-222222222222';
const otherId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const messageId = '33333333-3333-4333-8333-333333333333';
const draftKey = `uskoci:agreement-draft:v1:${accountId}:${agreementId}`;
const outboxKey = `uskoci:agreement-outbox:v1:${accountId}:${agreementId}`;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
async function until(condition: () => boolean) { for (let n = 0; n < 100; n++) { if (condition()) return; await Promise.resolve(); } throw new Error('Missing async boundary'); }
function memory() {
  const values = new Map<string, string>();
  return { values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    getAllKeys: jest.fn(async () => [...values.keys()]),
    multiRemove: jest.fn(async (keys: readonly string[]) => { keys.forEach(key => values.delete(key)); }),
  };
}
let next = 0;
const models: ReturnType<typeof createAgreementOutbox>[] = [];
function setup(storage = memory(), patch: Partial<AgreementOutboxOptions> = {}) {
  const send = jest.fn<ReturnType<AgreementMessagePort['send']>, Parameters<AgreementMessagePort['send']>>().mockResolvedValue({ messageId });
  const model = createAgreementOutbox({ accountId, agreementId, storage, messagePort: { send },
    isCurrent: () => true, canSendNew: () => true, newId: () => `draft-command-${++next}`, ...patch });
  models.push(model); return { model, storage, send };
}
const draft = (storage: ReturnType<typeof memory>) => JSON.parse(storage.values.get(draftKey)!);
afterEach(() => { models.splice(0).forEach(model => model.stop()); });

it('restores raw unsent text across remount without a command or send, scoped to account and Agreement', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('  Prva\nDruga 😊  '); a.model.stop();
  const b = setup(a.storage); await b.model.start();
  expect(b.model.getSnapshot().draft).toBe('  Prva\nDruga 😊  ');
  expect(a.storage.values.has(outboxKey)).toBe(false); expect(b.send).not.toHaveBeenCalled();
  for (const patch of [{ accountId: otherId }, { agreementId: otherId }]) {
    const scoped = setup(a.storage, patch); await scoped.model.start(); expect(scoped.model.getSnapshot().draft).toBe('');
  }
});

it('keeps over-send-limit input intact and reports oversize storage failure without truncation', async () => {
  const a = setup(); await a.model.start(); const long = ` ${'x'.repeat(2500)} `;
  await a.model.setDraft(long); expect(draft(a.storage).text).toBe(long);
  await a.model.sendDraft(); expect(a.model.getSnapshot().error).toBe('INVALID_MESSAGE'); expect(a.send).not.toHaveBeenCalled();
  const oversized = 'y'.repeat(32_001); await a.model.setDraft(oversized);
  expect(a.model.getSnapshot()).toMatchObject({ draft: oversized, error: 'STORAGE_UNAVAILABLE' });
  expect(draft(a.storage).text).toBe(long);
});

it('does not overwrite typing that arrived during a late initial draft read', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('Stored'); a.model.stop();
  const reading = deferred<string | null>();
  a.storage.getItem.mockImplementation(key => key === draftKey ? reading.promise : Promise.resolve(a.storage.values.get(key) ?? null));
  const b = setup(a.storage); const loading = b.model.start();
  await until(() => a.storage.getItem.mock.calls.filter(([key]) => key === draftKey).length >= 3);
  const typing = b.model.setDraft('Typed during load'); reading.resolve(a.storage.values.get(draftKey)!);
  await Promise.all([loading, typing]);
  expect(b.model.getSnapshot().draft).toBe('Typed during load'); expect(draft(a.storage).text).toBe('Typed during load');
});

it('lets an admitted edit finish after blur and makes the next instance read it', async () => {
  const a = setup(); await a.model.start(); const writing = deferred<void>(); let entered = false;
  a.storage.setItem.mockImplementation(async (key, value) => { entered = true; await writing.promise; a.storage.values.set(key, value); });
  const saving = a.model.setDraft('Before leaving'); await until(() => entered); a.model.stop();
  const b = setup(a.storage); const loading = b.model.start(); writing.resolve(); await Promise.all([saving, loading]);
  expect(b.model.getSnapshot().draft).toBe('Before leaving'); expect(b.send).not.toHaveBeenCalled();
});

it('preserves new typing while an older command is being durably captured', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('First');
  const writing = deferred<void>(); let captured = false;
  a.storage.setItem.mockImplementation(async (key, value) => { if (key === outboxKey && !captured) { captured = true; await writing.promise; } a.storage.values.set(key, value); });
  const sending = a.model.sendDraft(); await until(() => captured); await a.model.setDraft('Next'); writing.resolve(); await sending;
  expect(a.send.mock.calls[0][0].body).toBe('First'); expect(a.model.getSnapshot().draft).toBe('Next'); expect(draft(a.storage).text).toBe('Next');
});

it.each(['before capture', 'during capture'])('never erases another instance edit made %s', async when => {
  const a = setup(); await a.model.start(); await a.model.setDraft('First');
  const b = setup(a.storage); await b.model.start();
  const writing = deferred<void>(); let captured = false;
  a.storage.setItem.mockImplementation(async (key, value) => { if (key === outboxKey && !captured) { captured = true; await writing.promise; } a.storage.values.set(key, value); });
  if (when === 'before capture') await b.model.setDraft('Other instance');
  const sending = a.model.sendDraft(); await until(() => captured);
  if (when === 'during capture') await b.model.setDraft('Other instance');
  writing.resolve(); await sending;
  expect(draft(a.storage).text).toBe('Other instance');
  const c = setup(a.storage); await c.model.start(); expect(c.model.getSnapshot().draft).toBe('Other instance');
});

it('recovers exact captured identity when clearing the draft fails, preserving unknown-command recovery', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('  Captured  ');
  a.storage.setItem.mockImplementation(async (key, value) => {
    if (key === draftKey && JSON.parse(value).text === '') throw new Error('disk');
    a.storage.values.set(key, value);
  });
  a.send.mockRejectedValueOnce(new AgreementMessageError('UNAVAILABLE')); await a.model.sendDraft();
  const original = a.model.getSnapshot().entries[0].command;
  expect(draft(a.storage)).toMatchObject({ text: '  Captured  ', capturedClientMessageId: original.clientMessageId });
  expect(a.model.getSnapshot().error).toBe('STORAGE_UNAVAILABLE'); a.model.stop();
  const b = setup(a.storage); await b.model.start(); expect(b.model.getSnapshot()).toMatchObject({ draft: '', entries: [{ state: 'unknown', command: original }] });
  await b.model.sendDraft({ agreementVersion: 1, assetIds: [messageId] }); expect(b.send).not.toHaveBeenCalled();
  expect(b.send).not.toHaveBeenCalled(); await b.model.retry(original.clientMessageId); expect(b.send.mock.calls[0][0]).toEqual(original);
  a.storage.setItem.mockImplementation(async (key, value) => { a.storage.values.set(key, value); }); await b.model.start();
  expect(draft(a.storage)).toMatchObject({ text: '' }); expect(draft(a.storage).capturedClientMessageId).toBeUndefined();
  expect(b.model.getSnapshot().error).toBeNull();
});

it('keeps the exact marked command inside a bounded confirmed cache until its draft can be cleared', async () => {
  const a = setup(undefined, { maxPending: 1 }); await a.model.start(); await a.model.setDraft('Captured text');
  a.storage.setItem.mockImplementation(async (key, value) => {
    if (key === draftKey && JSON.parse(value).text === '') throw new Error('disk');
    a.storage.values.set(key, value);
  });
  await a.model.sendDraft(); const capturedKey = a.model.getSnapshot().entries[0].command.clientMessageId;
  await a.model.sendDraft({ agreementVersion: 1, assetIds: [messageId] });
  expect(a.send).toHaveBeenCalledTimes(2);
  expect(JSON.parse(a.storage.values.get(outboxKey)!).entries).toHaveLength(1);
  expect(a.model.getSnapshot().entries[0].command.clientMessageId).toBe(capturedKey);
  a.model.stop(); const b = setup(a.storage, { maxPending: 1 }); await b.model.start();
  expect(b.model.getSnapshot()).toMatchObject({ draft: '', error: 'STORAGE_UNAVAILABLE' });
});

it('optional draft-read failure defers cache pruning but preserves recovery and the total storage bound', async () => {
  const a = setup();
  const entries = Array.from({ length: 100 }, (_, index) => ({
    command: { accountId, agreementId, clientMessageId: `retained-command-${index}`, body: `Body ${index}` },
    state: index === 99 ? 'unknown' : 'confirmed', persisted: true, attempt: 1,
    ...(index === 99 ? { error: 'UNAVAILABLE' } : { messageId }),
  }));
  a.storage.values.set(outboxKey, JSON.stringify({ version: 1, accountId, agreementId, revision: 1, entries }));
  a.storage.getItem.mockImplementation(async key => { if (key === draftKey) throw new Error('disk'); return a.storage.values.get(key) ?? null; });
  await a.model.start(); await a.model.retry('retained-command-99');
  expect(a.send).toHaveBeenCalledTimes(1); expect(a.model.getSnapshot().entries).toHaveLength(100);
  expect(a.model.getSnapshot().entries.every(entry => entry.state === 'confirmed')).toBe(true);
  let marked = false;
  a.storage.getItem.mockImplementation(async key => { if (key === draftKey && marked) throw new Error('draft read'); return a.storage.values.get(key) ?? null; });
  await a.model.setDraft('New draft');
  a.storage.setItem.mockImplementation(async (key, value) => { a.storage.values.set(key, value); if (key === draftKey && JSON.parse(value).capturedClientMessageId) marked = true; });
  await a.model.sendDraft();
  expect(a.model.getSnapshot()).toMatchObject({ draft: 'New draft', error: 'CAPACITY' });
  expect(a.send).toHaveBeenCalledTimes(1); expect(JSON.parse(a.storage.values.get(outboxKey)!).entries).toHaveLength(100);
});

it('restores a marked draft if its command capture failed, never using text equality as proof', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('Same words');
  a.storage.setItem.mockImplementation(async (key, value) => { if (key === outboxKey) throw new Error('disk'); a.storage.values.set(key, value); });
  await a.model.sendDraft(); expect(a.send).not.toHaveBeenCalled(); a.model.stop();
  const b = setup(a.storage); await b.model.start(); expect(b.model.getSnapshot().draft).toBe('Same words'); expect(b.model.getSnapshot().entries).toHaveLength(0);
});

it('keeps draft write failures visible through exact-key recovery of a prior command', async () => {
  const a = setup(); a.send.mockRejectedValueOnce(new AgreementMessageError('UNAVAILABLE'));
  await a.model.start(); await a.model.setDraft('Old'); await a.model.sendDraft(); const key = a.model.getSnapshot().entries[0].command.clientMessageId;
  a.storage.setItem.mockImplementation(async (name, value) => { if (name === draftKey) throw new Error('disk'); a.storage.values.set(name, value); });
  await a.model.setDraft('Unsaved next'); await a.model.retry(key);
  expect(a.model.getSnapshot()).toMatchObject({ draft: 'Unsaved next', error: 'STORAGE_UNAVAILABLE', entries: [{ state: 'confirmed' }] });
});

it('draft-read failure keeps unknown commands retryable but refuses a new send', async () => {
  const a = setup(); a.send.mockRejectedValueOnce(new AgreementMessageError('UNAVAILABLE'));
  await a.model.start(); await a.model.setDraft('Old'); await a.model.sendDraft(); const key = a.model.getSnapshot().entries[0].command.clientMessageId; a.model.stop();
  a.storage.getItem.mockImplementation(async name => { if (name === draftKey) throw new Error('disk'); return a.storage.values.get(name) ?? null; });
  const b = setup(a.storage); await b.model.start(); expect(b.model.getSnapshot()).toMatchObject({ phase: 'ready', error: 'STORAGE_UNAVAILABLE' });
  await b.model.sendDraft(); expect(b.send).not.toHaveBeenCalled(); await b.model.retry(key); expect(b.send).toHaveBeenCalledTimes(1);
});

it('a failed write survives stop/start and retries the same dirty text instead of restoring older text', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('Old');
  a.storage.setItem.mockRejectedValueOnce(new Error('disk')); await a.model.setDraft('New unsaved');
  expect(a.model.getSnapshot().error).toBe('STORAGE_UNAVAILABLE'); a.model.stop(); await a.model.start();
  expect(a.model.getSnapshot()).toMatchObject({ draft: 'New unsaved', error: null }); expect(draft(a.storage).text).toBe('New unsaved');
});

it('a dirty reload retains local text and reports failure if another instance saved a newer revision', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('Old');
  a.storage.setItem.mockRejectedValueOnce(new Error('disk')); await a.model.setDraft('Local unsaved'); a.model.stop();
  const b = setup(a.storage); await b.model.start(); await b.model.setDraft('Other newer'); await a.model.start();
  expect(a.model.getSnapshot()).toMatchObject({ draft: 'Local unsaved', error: 'STORAGE_UNAVAILABLE' }); expect(draft(a.storage).text).toBe('Other newer');
  await a.model.sendDraft(); expect(a.send).not.toHaveBeenCalled(); expect(draft(a.storage).text).toBe('Other newer');
  await a.model.setDraft('Local explicit edit'); expect(draft(a.storage).text).toBe('Local explicit edit');
});

it('the existing start action reloads saved draft after a transient read failure without clearing commands', async () => {
  const a = setup(); await a.model.start(); await a.model.setDraft('Saved'); a.model.stop();
  // Target only the independent draft read; command readiness remains available.
  a.storage.getItem.mockImplementation(async key => { if (key === draftKey) throw new Error('disk'); return a.storage.values.get(key) ?? null; });
  const b = setup(a.storage); await b.model.start(); expect(b.model.getSnapshot().error).toBe('STORAGE_UNAVAILABLE');
  a.storage.getItem.mockImplementation(async key => a.storage.values.get(key) ?? null); await b.model.start();
  expect(b.model.getSnapshot()).toMatchObject({ draft: 'Saved', phase: 'ready', error: null }); expect(b.send).not.toHaveBeenCalled();
});

it('rechecks the account after a draft read before issuing a write', async () => {
  let current = true; const a = setup(undefined, { isCurrent: () => current }); await a.model.start();
  const reading = deferred<string | null>(); a.storage.getItem.mockImplementation(key => key === draftKey ? reading.promise : Promise.resolve(null));
  const saving = a.model.setDraft('Private'); await until(() => a.storage.getItem.mock.calls.filter(([key]) => key === draftKey).length === 2);
  current = false; reading.resolve(null); await saving; expect(a.storage.setItem).not.toHaveBeenCalled();
});

it('logout waits for an issued draft write before removing only that account keys', async () => {
  let current = true; const a = setup(undefined, { isCurrent: () => current }); await a.model.start();
  const otherKey = `uskoci:agreement-draft:v1:${otherId}:${agreementId}`; a.storage.values.set(otherKey, 'other');
  const writing = deferred<void>(); let entered = false;
  a.storage.setItem.mockImplementation(async (key, value) => { entered = true; await writing.promise; a.storage.values.set(key, value); });
  const saving = a.model.setDraft('Leaving account'); await until(() => entered); current = false; a.model.stop();
  const forgetting = forgetAgreementOutboxes(accountId, a.storage); await Promise.resolve(); expect(a.storage.getAllKeys).not.toHaveBeenCalled();
  writing.resolve(); await Promise.all([saving, forgetting]); expect([...a.storage.values.keys()]).toEqual([otherKey]);
});
