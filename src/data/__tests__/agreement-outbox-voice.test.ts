// Voice messages B2-a (2026-09-30): the durable outbox sends a voice message with the SAME identity, retry and readback rules as text and photos,
// in its own storage namespace so that an older build reading the text journal never meets a voice entry.
import { AgreementMessageError, type AgreementMessagePort } from '../../contracts/agreementMessages';
import { createAgreementOutbox, forgetAgreementOutboxes, type AgreementOutboxOptions } from '../agreementOutbox';

const accountId = '11111111-1111-4111-8111-111111111111';
const agreementId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const otherMessageId = '44444444-4444-4444-8444-444444444444';
const assetId = '55555555-5555-4555-8555-555555555555';
const otherAssetId = '66666666-6666-4666-8666-666666666666';
const voice = { agreementVersion: 2, assetId };
const voiceKey = `uskoci:agreement-voice-outbox:v1:${accountId}:${agreementId}`;
const textKey = `uskoci:agreement-outbox:v1:${accountId}:${agreementId}`;
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) };
}
let next = 0;
const models: ReturnType<typeof createAgreementOutbox>[] = [];
function setup(patch: Partial<AgreementOutboxOptions> = {}) {
  const storage = memory();
  const send = jest.fn<ReturnType<AgreementMessagePort['send']>, Parameters<AgreementMessagePort['send']>>().mockResolvedValue({ messageId });
  const options: AgreementOutboxOptions = { accountId, agreementId, namespace: 'voice', messagePort: { send }, newId: () => `voice-key-${++next}`,
    isCurrent: () => true, canSendNew: () => true, storage, ...patch };
  const model = createAgreementOutbox(options); models.push(model);
  return { model, storage, send, options };
}
const first = (model: ReturnType<typeof createAgreementOutbox>) => model.getSnapshot().entries[0];
const record = (storage: ReturnType<typeof memory>) => JSON.parse(storage.values.get(voiceKey)!);
afterEach(() => { for (const model of models.splice(0)) model.stop(); });

it('keeps the voice journal in its own namespace: the text journal and the text draft are never touched', async () => {
  const { model, storage, send } = setup();
  await model.start(); await model.sendVoice(voice);
  expect([...storage.values.keys()].filter(key => key.startsWith('uskoci:agreement-voice-outbox:v1:'))).toEqual([voiceKey]);
  expect([...storage.values.keys()].some(key => key.startsWith('uskoci:agreement-outbox:') || key.startsWith('uskoci:agreement-draft:'))).toBe(false);
  expect(storage.values.has(textKey)).toBe(false);
  expect(send).toHaveBeenCalledTimes(1);
  expect(first(model)).toMatchObject({ state: 'confirmed', messageId, persisted: true });
  expect(first(model).command).toEqual({ accountId, agreementId, clientMessageId: 'voice-key-' + next, body: '', voice });
  expect(Object.isFrozen(first(model).command.voice)).toBe(true);
});
it('the text namespace keeps its exact keys and refuses a voice send', async () => {
  const { model, storage, send } = setup({ namespace: 'text' });
  await model.start(); await model.sendVoice(voice);
  expect(model.getSnapshot().error).toBe('INVALID_MESSAGE'); expect(send).not.toHaveBeenCalled(); expect(storage.values.has(voiceKey)).toBe(false);
  model.setDraft('Zdravo'); await Promise.resolve();
  await model.sendDraft();
  expect(storage.values.has(textKey)).toBe(true);
});
it.each([
  ['a malformed asset', { agreementVersion: 2, assetId: 'bad' }], ['a zero version', { agreementVersion: 0, assetId }], ['an extra key', { agreementVersion: 2, assetId, url: 'x' }],
])('refuses %s without persisting anything or calling the port', async (_name, bad) => {
  const { model, storage, send } = setup();
  await model.start(); await model.sendVoice(bad as never);
  expect(model.getSnapshot().error).toBe('INVALID_MESSAGE'); expect(send).not.toHaveBeenCalled(); expect(storage.values.has(voiceKey)).toBe(false);
});
it('an unknown outcome persists the exact command, survives a restart as unknown and retries the SAME key and asset', async () => {
  const { model, storage, send, options } = setup(); send.mockRejectedValueOnce(new AgreementMessageError('UNAVAILABLE'));
  await model.start(); await model.sendVoice(voice);
  const original = first(model).command;
  expect(first(model)).toMatchObject({ state: 'unknown', error: 'UNAVAILABLE', persisted: true });
  expect(record(storage).entries[0].command).toEqual(original);
  model.stop(); const restarted = createAgreementOutbox({ ...options, storage }); models.push(restarted); await restarted.start();
  expect(first(restarted).state).toBe('unknown'); expect(send).toHaveBeenCalledTimes(1);
  send.mockResolvedValue({ messageId }); await restarted.retry(original.clientMessageId);
  expect(send).toHaveBeenCalledTimes(2); expect(send.mock.calls[1][0]).toEqual(original);
  expect(first(restarted)).toMatchObject({ state: 'confirmed', messageId });
});
it('reconciles only an exactly matching voice row (empty body, same version, same asset); anything else is a conflict', async () => {
  const { model, send } = setup(); send.mockRejectedValue(new AgreementMessageError('UNAVAILABLE'));
  await model.start(); await model.sendVoice(voice); const { clientMessageId } = first(model).command;
  const row = { senderAccountId: accountId, clientMessageId, messageId, body: '', voice };
  for (const wrong of [{ voice: { ...voice, assetId: otherAssetId } }, { voice: { ...voice, agreementVersion: 3 } }, { voice: undefined }, { body: 'text' }]) {
    await model.reconcile([{ ...row, ...wrong } as never]);
    expect(first(model).state).toBe('unknown');
  }
  await model.reconcile([row]);
  expect(first(model)).toMatchObject({ state: 'confirmed', messageId });
});
it('capacity counts voice intents like any other pending intent and never drops one', async () => {
  const { model, send } = setup({ maxPending: 2 }); send.mockRejectedValue(new AgreementMessageError('UNAVAILABLE'));
  await model.start(); await model.sendVoice(voice); await model.sendVoice({ ...voice, assetId: otherAssetId });
  expect(model.getSnapshot().entries).toHaveLength(2);
  await model.sendVoice({ ...voice, assetId: '77777777-7777-4777-8777-777777777777' });
  expect(model.getSnapshot().error).toBe('CAPACITY'); expect(model.getSnapshot().entries).toHaveLength(2); expect(send).toHaveBeenCalledTimes(2);
});
it('a read-only Agreement refuses a new voice message without persisting it', async () => {
  const { model, storage, send } = setup({ canSendNew: () => false });
  await model.start(); await model.sendVoice(voice);
  expect(model.getSnapshot().error).toBe('READ_ONLY'); expect(send).not.toHaveBeenCalled(); expect(storage.values.has(voiceKey)).toBe(false);
});
it.each([
  ['a voice entry with a body', { body: 'words' }], ['a voice entry with photos', { photos: { agreementVersion: 2, assetIds: [otherAssetId] } }],
  ['a voice entry with a malformed asset', { voice: { agreementVersion: 2, assetId: 'bad' } }], ['an empty entry with neither photos nor voice', { voice: undefined }],
])('refuses to load a stored journal holding %s', async (_name, patch) => {
  const { model, storage } = setup();
  const command = { accountId, agreementId, clientMessageId: 'voice-key-stored', body: '', voice, ...patch };
  storage.values.set(voiceKey, JSON.stringify({ version: 1, accountId, agreementId, revision: 1, entries: [{ command, state: 'unknown', persisted: true, attempt: 1 }] }));
  await model.start();
  expect(model.getSnapshot().phase).toBe('error'); expect(model.getSnapshot().error).toBe('STORAGE_INVALID');
});
it('an explicit logout forgets the voice journal and its draft key with the text ones', async () => {
  const other = '99999999-9999-4999-8999-999999999999';
  const keys = [voiceKey, textKey, `uskoci:agreement-draft:v1:${accountId}:${agreementId}`, `uskoci:agreement-voice-draft:v1:${accountId}:${agreementId}`,
    `uskoci:agreement-voice-outbox:v1:${other}:${agreementId}`];
  const removed: string[] = [];
  const count = await forgetAgreementOutboxes(accountId, { getAllKeys: async () => keys, multiRemove: async list => { removed.push(...list); } });
  expect(count).toBe(4); expect(removed.sort()).toEqual(keys.slice(0, 4).sort());
});
