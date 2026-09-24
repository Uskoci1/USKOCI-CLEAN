import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const OWNER = '11111111-1111-4111-8111-111111111111', CID = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockFocused = true, mockParams: { conversationId?: string } = { conversationId: CID };
const mockGet = jest.fn(), mockSet = jest.fn(), mockRemoveJournal = jest.fn(), mockPick = jest.fn();
const mockRead = jest.fn(), mockReceipt = jest.fn(), mockUpload = jest.fn(), mockRemove = jest.fn(), mockBack = jest.fn(), mockCancel = jest.fn();
const mockReplace = jest.fn(), mockCanGoBack = jest.fn(() => true);
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: (...a: unknown[]) => mockGet(...a), setItem: (...a: unknown[]) => mockSet(...a), removeItem: (...a: unknown[]) => mockRemoveJournal(...a) } }));
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readTaskPhotos: (...a: unknown[]) => mockRead(...a), readUploadCommand: (...a: unknown[]) => mockReceipt(...a),
  uploadTaskPhoto: (...a: unknown[]) => mockUpload(...a), removeTaskPhoto: (...a: unknown[]) => mockRemove(...a),
  cancelUploadCommand: (...a: unknown[]) => mockCancel(...a) } }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhoto: (...a: unknown[]) => mockPick(...a), photoSelectionMessage: () => 'Nije pripremljeno.' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams,
  router: { canGoBack: () => mockCanGoBack(), back: () => mockBack(), replace: (...a: unknown[]) => mockReplace(...a) },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'Photo' }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsAction: 'Action' }));
jest.mock('../../ui/system/PermissionRecovery', () => ({ PermissionRecovery: 'PermissionRecovery' }));
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
  jest.clearAllMocks(); for (const m of [mockRead, mockReceipt, mockUpload, mockGet, mockSet, mockPick, mockCancel]) m.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockFocused = true; mockParams = { conversationId: CID };
  mockCanGoBack.mockReturnValue(true);
  mockGet.mockResolvedValue(null); mockSet.mockResolvedValue(undefined); mockRead.mockResolvedValue(ok(listing()));
  mockReceipt.mockResolvedValue(absent()); mockPick.mockResolvedValue(photo); mockUpload.mockResolvedValue({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
  mockCancel.mockResolvedValue({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
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
// Opened from a link on a cold start, the arrow used to replace to a blank new conversation.
it('the arrow with no screen behind it returns to this conversation; with one, it goes back', async () => {
  await render();
  const arrow = () => tree.root.findByType('Screen' as React.ElementType).props.onBack;
  mockCanGoBack.mockReturnValue(false); await act(async () => arrow()());
  expect(mockBack).not.toHaveBeenCalled(); expect(mockReplace).toHaveBeenCalledWith({ pathname: '/nova', params: { conversationId: CID } });
  await act(async () => tree.unmount()); mockCanGoBack.mockReturnValue(true); await render(); await act(async () => arrow()());
  expect(mockBack).toHaveBeenCalledTimes(1); expect(mockReplace).toHaveBeenCalledTimes(1);
});
it('says why adding is grey once six photos are in the draft', async () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ assetId: `6666666${i}-6666-4666-8666-666666666666`, state: 'READY' }));
  mockRead.mockResolvedValue(ok({ ...listing(), photos: six })); await render();
  expect(action('Izaberi iz galerije').disabled).toBe(true); expect(action('Fotografiši').disabled).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Dodato je najviše fotografija');
  expect(JSON.stringify(tree.toJSON())).toContain('6 fotografija od 6');
});
it('invalid conversation routes cause no photo reads, picker, or writes', async () => {
  mockParams = { conversationId: 'invalid' }; await render();
  expect(mockRead).not.toHaveBeenCalled(); expect(mockGet).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  expect(action('Izaberi iz galerije').disabled).toBe(true);
});
describe('PKG-008 safe exit from an unconfirmed Task photo upload (GAP-0036)', () => {
  const JOURNAL = `uskoci:media-upload:${OWNER}:TASK:${CID}`;
  const shown = () => JSON.stringify(tree.toJSON());
  const has = (label: string) => tree.root.findAllByProps({ label }).length > 0;
  const cancelled = (previousState: string | null = null, assetId: string | null = null) => ({ accountId: OWNER, conversationId: CID,
    clientRequestId: REQUEST, previousState, assetId, selected: false, cancelled: true, authoritative: true });
  // The durable journal is stateful: a confirmed removal is what a later read observes.
  beforeEach(() => { mockRemoveJournal.mockImplementation(async () => { mockGet.mockResolvedValue(null); }); });
  it('after remount without bytes and an absent command the user can explicitly cancel the original identity; nothing is erased before the server confirms', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    expect(mockReceipt).toHaveBeenCalledWith(REQUEST);
    expect(action('Izaberi iz galerije').disabled).toBe(true); expect(has('Nastavi slanje iste fotografije')).toBe(false);
    expect(shown()).toContain('Slanje nije primljeno'); expect(mockRemoveJournal).not.toHaveBeenCalled();
    mockCancel.mockResolvedValueOnce(ok(cancelled()));
    await act(async () => action('Odustani od nepotvrđenog slanja').onPress());
    expect(mockCancel).toHaveBeenCalledWith({ conversationId: CID, clientRequestId: REQUEST });
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL);
    expect(action('Izaberi iz galerije').disabled).toBe(false); expect(has('Odustani od nepotvrđenog slanja')).toBe(false);
    expect(shown()).toContain('Slanje je otkazano'); expect(mockUpload).not.toHaveBeenCalled(); expect(mockPick).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
  it('an unconfirmed cancellation keeps the identity and the exit; only a confirmed cancellation clears it', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    await act(async () => action('Odustani od nepotvrđenog slanja').onPress());
    expect(mockCancel).toHaveBeenCalledTimes(1); expect(mockRemoveJournal).not.toHaveBeenCalled();
    expect(action('Izaberi iz galerije').disabled).toBe(true); expect(has('Odustani od nepotvrđenog slanja')).toBe(true);
    expect(shown()).toContain('Ishod nije potvrđen.');
    mockCancel.mockResolvedValueOnce(ok(cancelled()));
    await act(async () => action('Odustani od nepotvrđenog slanja').onPress());
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL); expect(action('Izaberi iz galerije').disabled).toBe(false);
  });
  it('cancelling a command the server already admitted deselects it and re-reads the draft', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    mockCancel.mockResolvedValueOnce(ok(cancelled('PROCESSING', '55555555-5555-4555-8555-555555555555')));
    await act(async () => action('Odustani od nepotvrđenog slanja').onPress());
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL); expect(shown()).toContain('nije u nacrtu');
    expect(mockRead).toHaveBeenCalledTimes(2); expect(action('Izaberi iz galerije').disabled).toBe(false);
  });
  it('a same-session unknown ACK offers the same-key retry and the cancel; the cancel never resends', async () => {
    const held = deferred(); mockUpload.mockReturnValueOnce(held.promise); await render();
    await act(async () => { void action('Izaberi iz galerije').onPress(); });
    await act(async () => held.resolve({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' }));
    expect(has('Nastavi slanje iste fotografije')).toBe(true); expect(has('Odustani od nepotvrđenog slanja')).toBe(true);
    expect(shown()).toContain('Slanje nije primljeno');
    mockCancel.mockResolvedValueOnce(ok(cancelled()));
    await act(async () => action('Odustani od nepotvrđenog slanja').onPress());
    expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL);
    expect(has('Nastavi slanje iste fotografije')).toBe(false); expect(action('Izaberi iz galerije').disabled).toBe(false);
  });
  it('a cancellation confirmed after the account changed erases nothing', async () => {
    mockGet.mockResolvedValue(REQUEST); await render();
    mockCancel.mockImplementationOnce(async () => { mockSession = { user: { id: '44444444-4444-4444-8444-444444444444' }, accountRevision: 2 }; return ok(cancelled()); });
    await act(async () => action('Odustani od nepotvrđenog slanja').onPress());
    expect(mockRemoveJournal).not.toHaveBeenCalled();
  });
  it('an unknown command read keeps the exit without claiming the server has no command', async () => {
    mockGet.mockResolvedValue(REQUEST); mockReceipt.mockResolvedValue({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
    await render();
    expect(shown()).toContain('Ishod slanja nije učitan'); expect(shown()).not.toContain('Slanje nije primljeno');
    expect(has('Odustani od nepotvrđenog slanja')).toBe(true); expect(has('Nastavi slanje iste fotografije')).toBe(false);
    expect(mockRemoveJournal).not.toHaveBeenCalled(); expect(action('Izaberi iz galerije').disabled).toBe(true);
  });
  it('a settled command on remount is retired without offering a cancel', async () => {
    mockGet.mockResolvedValue(REQUEST);
    mockReceipt.mockResolvedValue(ok({ scope: 'TASK', conversationId: CID, clientRequestId: REQUEST, state: 'READY', selected: true }));
    await render();
    expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL); expect(has('Odustani od nepotvrđenog slanja')).toBe(false);
    expect(mockCancel).not.toHaveBeenCalled(); expect(shown()).toContain('Fotografija je dodata privatnom nacrtu.');
  });
  it('a corrupt journal value is discarded and the picker recovers without any command read', async () => {
    mockGet.mockResolvedValue('not-a-command-id'); await render();
    expect(mockReceipt).not.toHaveBeenCalled(); expect(mockRemoveJournal).toHaveBeenCalledWith(JOURNAL);
    expect(action('Izaberi iz galerije').disabled).toBe(false); expect(shown()).toContain('nije čitljiv');
  });
});
