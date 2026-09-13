jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: jest.fn() }));
jest.mock('../../store/sesija', () => ({ sesijaSada: jest.fn() }));
import { createAgreementPhotoJournal } from '../agreementPhotoJournal';
const account = '11111111-1111-4111-8111-111111111111', agreementId = '22222222-2222-4222-8222-222222222222';
const ref = (n = 1) => ({ agreementId, agreementVersion: 3, clientRequestId: `33333333-3333-4333-8333-${String(n).padStart(12, '0')}` });
function setup() { const values = new Map<string, string>(); const storage = { getItem: jest.fn(async (key: string) => values.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }) }; return { values, storage, journal: createAgreementPhotoJournal(storage) }; }
it('stores only six opaque upload identities and serializes concurrent additions without lost keys', async () => {
  const { journal, values } = setup(); await Promise.all(Array.from({ length: 6 }, (_, i) => journal.save(account, ref(i + 1), () => true)));
  expect(await journal.load(account, agreementId)).toEqual(Array.from({ length: 6 }, (_, i) => ref(i + 1)));
  await expect(journal.save(account, ref(7), () => true)).rejects.toThrow('PHOTO_JOURNAL_CAPACITY');
  const raw = [...values.values()][0]; expect(raw).not.toMatch(/bytes|uri|file:|body|caption|base64|sha256/);
  expect(Object.keys(JSON.parse(raw))).toEqual(['version', 'accountId', 'agreementId', 'uploads']);
});
it('clears only the exact version/key and cannot erase a later upload', async () => {
  const { journal } = setup(); await journal.save(account, ref(1), () => true); await journal.save(account, ref(2), () => true);
  await expect(journal.clear(account, { ...ref(1), agreementVersion: 4 }, () => true)).rejects.toThrow('PHOTO_JOURNAL_CONFLICT');
  await journal.clear(account, ref(1), () => true); await journal.clear(account, ref(1), () => true);
  expect(await journal.load(account, agreementId)).toEqual([ref(2)]);
});
it('fences ownership again after awaiting disk and rejects extra local narrative/path fields', async () => {
  const { journal, storage, values } = setup(); let current = true;
  storage.getItem.mockImplementationOnce(async () => { current = false; return null; });
  await expect(journal.save(account, ref(), () => current)).rejects.toThrow('PHOTO_SCOPE_CHANGED'); expect(storage.setItem).not.toHaveBeenCalled();
  const key = `uskoci.agreement.photos.v1.${account}.${agreementId}`;
  values.set(key, JSON.stringify({ version: 1, accountId: account, agreementId, uploads: [{ ...ref(), uri: 'file:///private' }] }));
  await expect(journal.load(account, agreementId)).rejects.toThrow('PHOTO_JOURNAL_INVALID');
});
