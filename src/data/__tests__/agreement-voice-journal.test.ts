// Voice messages B2-a (2026-09-30): the voice upload journal keeps identities only, in its own key space, with its own capacity, and is forgotten at logout.
import { createAgreementPhotoJournal, createAgreementVoiceJournal } from '../agreementPhotoJournal';
import { forgetAgreementOutboxes } from '../agreementOutbox';

const account = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const agreement = '33333333-3333-4333-8333-333333333333';
const request = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
const ref = (n: number, version = 2) => ({ agreementId: agreement, agreementVersion: version, clientRequestId: request(n) });
function memory() {
  const values = new Map<string, string>();
  return { values, getItem: jest.fn(async (key: string) => values.get(key) ?? null), setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) };
}
const yes = () => true;

it('stores opaque identities only, under its own key, and never touches the photo journal', async () => {
  const storage = memory(), voice = createAgreementVoiceJournal(storage), photos = createAgreementPhotoJournal(storage);
  await voice.save(account, ref(1), yes);
  expect([...storage.values.keys()]).toEqual([`uskoci.agreement.voice.v1.${account}.${agreement}`]);
  expect(JSON.parse(storage.values.get(`uskoci.agreement.voice.v1.${account}.${agreement}`)!)).toEqual({ version: 1, accountId: account, agreementId: agreement, uploads: [ref(1)] });
  expect(await voice.load(account, agreement)).toEqual([ref(1)]); expect(await photos.load(account, agreement)).toEqual([]);
});
it('is idempotent for the same identity, refuses a conflicting one and clears exactly what was saved', async () => {
  const voice = createAgreementVoiceJournal(memory());
  await voice.save(account, ref(1), yes); await voice.save(account, ref(1), yes); expect(await voice.load(account, agreement)).toEqual([ref(1)]);
  await expect(voice.save(account, ref(1, 3), yes)).rejects.toThrow('VOICE_JOURNAL_CONFLICT');
  await voice.save(account, ref(2), yes); await voice.clear(account, ref(1), yes); expect(await voice.load(account, agreement)).toEqual([ref(2)]);
  await voice.clear(account, ref(2), yes); expect(await voice.load(account, agreement)).toEqual([]);
});
it('holds at most three unsent recordings while the photo journal keeps six', async () => {
  const storage = memory(), voice = createAgreementVoiceJournal(storage), photos = createAgreementPhotoJournal(storage);
  for (const n of [1, 2, 3]) await voice.save(account, ref(n), yes);
  await expect(voice.save(account, ref(4), yes)).rejects.toThrow('VOICE_JOURNAL_CAPACITY');
  for (const n of [1, 2, 3, 4, 5, 6]) await photos.save(account, ref(n), yes);
  await expect(photos.save(account, ref(7), yes)).rejects.toThrow('PHOTO_JOURNAL_CAPACITY');
});
it('refuses a stale scope without writing and rejects a corrupt or foreign stored record', async () => {
  const storage = memory(), voice = createAgreementVoiceJournal(storage);
  await expect(voice.save(account, ref(1), () => false)).rejects.toThrow('VOICE_SCOPE_CHANGED'); expect(storage.setItem).not.toHaveBeenCalled();
  const key = `uskoci.agreement.voice.v1.${account}.${agreement}`;
  for (const stored of ['{"version":1}', JSON.stringify({ version: 1, accountId: other, agreementId: agreement, uploads: [] }),
    JSON.stringify({ version: 1, accountId: account, agreementId: agreement, uploads: [{ ...ref(1), extra: 1 }] }),
    JSON.stringify({ version: 1, accountId: account, agreementId: agreement, uploads: [ref(1), ref(1)] }), 'x'.repeat(3001)]) {
    storage.values.set(key, stored); await expect(voice.load(account, agreement)).rejects.toThrow();
  }
  await expect(voice.load('not-a-uuid', agreement)).rejects.toThrow('VOICE_JOURNAL_INVALID');
});
it('an explicit logout forgets this account\'s voice and photo journals with the outbox keys and nothing of another account', async () => {
  const keys = [`uskoci.agreement.voice.v1.${account}.${agreement}`, `uskoci.agreement.photos.v1.${account}.${agreement}`, `uskoci:agreement-outbox:v1:${account}:${agreement}`,
    `uskoci.agreement.voice.v1.${other}.${agreement}`, `uskoci.agreement.photos.v1.${other}.${agreement}`, 'unrelated'];
  const store = new Set(keys);
  const count = await forgetAgreementOutboxes(account, { getAllKeys: async () => [...store], multiRemove: async remove => { remove.forEach(key => store.delete(key)); } });
  expect(count).toBe(3); expect([...store].sort()).toEqual([`uskoci.agreement.voice.v1.${other}.${agreement}`, `uskoci.agreement.photos.v1.${other}.${agreement}`, 'unrelated'].sort());
});
