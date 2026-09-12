import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const OWNER = '11111111-1111-4111-8111-111111111111', CID = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockFocused = true, mockParams: { conversationId?: string } = { conversationId: CID };
const mockGet = jest.fn(), mockSet = jest.fn(), mockRemoveJournal = jest.fn(), mockPick = jest.fn();
const mockRead = jest.fn(), mockReceipt = jest.fn(), mockUpload = jest.fn(), mockRemove = jest.fn(), mockBack = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...a: unknown[]) => mockGet(...a), setItem: (...a: unknown[]) => mockSet(...a), removeItem: (...a: unknown[]) => mockRemoveJournal(...a) } }));
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readTaskPhotos: (...a: unknown[]) => mockRead(...a), readUploadCommand: (...a: unknown[]) => mockReceipt(...a),
  uploadTaskPhoto: (...a: unknown[]) => mockUpload(...a), removeTaskPhoto: (...a: unknown[]) => mockRemove(...a) } }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhoto: (...a: unknown[]) => mockPick(...a), photoSelectionMessage: () => 'Nije pripremljeno.' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  router: { canGoBack: () => true, back: () => mockBack(), replace: () => mockBack() },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'Photo' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsAction: 'Action' }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(t, k) { return k === 'View' ? 'View' : Reflect.get(t, k); } }); });
import Route from '../../app/(app)/fotografije-zadatka';
const ok = (podatak: unknown) => ({ ok: true, podatak });
const absent = () => ({ ok: false, kod: 'MEDIA_NOT_FOUND', poruka: 'Fotografija nije dostupna.' });
const photo = { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg', width: 1, height: 1 };
const listing = () => ({ conversationId: CID, accountId: OWNER, photos: [], ready: true, authoritative: true });
function deferred() { let resolve!: (v: unknown) => void; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;
beforeEach(() => {
  jest.clearAllMocks(); for (const m of [mockRead, mockReceipt, mockUpload, mockGet, mockSet, mockPick]) m.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockFocused = true; mockParams = { conversationId: CID };
  mockGet.mockResolvedValue(null); mockSet.mockResolvedValue(undefined); mockRead.mockResolvedValue(ok(listing()));
  mockReceipt.mockResolvedValue(absent()); mockPick.mockResolvedValue(photo); mockUpload.mockResolvedValue({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('restores only the opaque upload identity and reads its result without resending or allocating a new photo', async () => {
  mockGet.mockResolvedValue(REQUEST); await render();
  expect(mockReceipt).toHaveBeenCalledWith(REQUEST); expect(mockUpload).not.toHaveBeenCalled();
  expect(mockPick).not.toHaveBeenCalled(); expect(action('Izaberi iz galerije').disabled).toBe(true);
  expect(mockSet).not.toHaveBeenCalled();
});
it('retires a definitively rejected staged upload without claiming a photo was added or resending', async () => {
  mockGet.mockResolvedValue(REQUEST);
  mockReceipt.mockResolvedValue(ok({ scope: 'TASK', conversationId: CID, clientRequestId: REQUEST, state: 'STAGED', selected: false }));
  await render();
  expect(mockRemoveJournal).toHaveBeenCalledWith(`uskoci:media-upload:${OWNER}:TASK:${CID}`);
  expect(action('Izaberi iz galerije').disabled).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('Fotografija nije dodata.');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Fotografija je dodata privatnom nacrtu.');
  expect(mockUpload).not.toHaveBeenCalled();
});
it('persists only the UUID before upload and retains identical bytes and identity after unknown I/O', async () => {
  const held = deferred(); mockUpload.mockReturnValueOnce(held.promise); await render(); const retained = action('Izaberi iz galerije').onPress;
  await act(async () => { void retained(); void retained(); });
  expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockPick).toHaveBeenCalledTimes(1);
  expect(mockSet).toHaveBeenCalledWith(`uskoci:media-upload:${OWNER}:TASK:${CID}`, REQUEST);
  expect(mockSet.mock.invocationCallOrder[0]).toBeLessThan(mockUpload.mock.invocationCallOrder[0]);
  const original = mockUpload.mock.calls[0][0];
  await act(async () => held.resolve({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' }));
  expect(action('Izaberi iz galerije').disabled).toBe(true); expect(mockReceipt).toHaveBeenCalledWith(REQUEST);
  await act(async () => action('Nastavi slanje iste fotografije').onPress());
  expect(mockUpload).toHaveBeenCalledTimes(2); expect(mockUpload.mock.calls[1][0]).toEqual(original);
  expect(mockUpload.mock.calls[1][0].bytes).toBe(photo.bytes); expect(mockPick).toHaveBeenCalledTimes(1);
});
it('performs no upload when durable identity storage fails, including an explicit retry', async () => {
  mockSet.mockRejectedValue(new Error('unavailable')); await render();
  await act(async () => action('Izaberi iz galerije').onPress());
  expect(mockUpload).not.toHaveBeenCalled();
  await act(async () => action('Osveži i proveri fotografije').onPress());
  await act(async () => action('Nastavi slanje iste fotografije').onPress());
  expect(mockUpload).not.toHaveBeenCalled();
});
it('discards a picker result if the account changes before upload', async () => {
  const picked = deferred(); mockPick.mockReturnValueOnce(picked.promise); await render();
  await act(async () => { void action('Izaberi iz galerije').onPress(); });
  mockSession = { user: { id: '44444444-4444-4444-8444-444444444444' }, accountRevision: 2 };
  await act(async () => { tree.update(<Route />); picked.resolve(photo); });
  expect(mockUpload).not.toHaveBeenCalled(); expect(mockSet).not.toHaveBeenCalled();
});
it('does not start upload after account revision changes while the identity is being stored', async () => {
  const stored = deferred(); mockSet.mockReturnValueOnce(stored.promise); await render();
  await act(async () => { void action('Izaberi iz galerije').onPress(); });
  mockSession = { user: { id: OWNER }, accountRevision: 3 };
  await act(async () => { tree.update(<Route />); stored.resolve(undefined); });
  expect(mockUpload).not.toHaveBeenCalled();
});
it('invalid conversation routes cause no photo reads, picker, or writes', async () => {
  mockParams = { conversationId: 'invalid' }; await render();
  expect(mockRead).not.toHaveBeenCalled(); expect(mockGet).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(action('Izaberi iz galerije').disabled).toBe(true);
});
