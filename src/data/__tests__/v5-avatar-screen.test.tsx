import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const OWNER = '11111111-1111-4111-8111-111111111111', PROFILE = '22222222-2222-4222-8222-222222222222';
const REQUEST = '33333333-3333-4333-8333-333333333333', ASSET = '44444444-4444-4444-8444-444444444444';
let mockSession = { user: { id: OWNER }, accountRevision: 1 }, mockFocused = true;
const mockJournal = new Map<string, string>(), mockSet = jest.fn(), mockPick = jest.fn(), mockRead = jest.fn();
const mockReceipt = jest.fn(), mockUpload = jest.fn(), mockApply = jest.fn(), mockClear = jest.fn(), mockDiscard = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: async (key: string) => mockJournal.get(key) ?? null, setItem: (...a: unknown[]) => mockSet(...a),
  removeItem: async (key: string) => { mockJournal.delete(key); } } }));
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readProfileAvatar: (...a: unknown[]) => mockRead(...a), readUploadCommand: (...a: unknown[]) => mockReceipt(...a),
  uploadAvatar: (...a: unknown[]) => mockUpload(...a), applyAvatar: (...a: unknown[]) => mockApply(...a),
  clearAvatar: (...a: unknown[]) => mockClear(...a), discardAvatar: (...a: unknown[]) => mockDiscard(...a) } }));
jest.mock('../../features/media/nativePhotoPicker', () => ({ pickPreparedPhoto: (...a: unknown[]) => mockPick(...a), photoSelectionMessage: () => 'Nije pripremljeno.' }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ profileId: '22222222-2222-4222-8222-222222222222' }),
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useUloga: () => 'narucilac', ulogaSada: () => 'narucilac' }));
jest.mock('../../lib/idempotencija', () => ({ noviUuidZahtevId: () => '33333333-3333-4333-8333-333333333333' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'Photo', mediaAssetId: (value: string) => value.split('/')[2] }));
jest.mock('../../ui/settings/SettingsPresentation', () => ({ SettingsText: 'T', SettingsScreen: 'Screen', SettingsPanel: 'Panel', SettingsAction: 'Action' }));
import Route from '../../app/(app)/profil/fotografija';
const journalKey = `uskoci:media-upload:${OWNER}:AVATAR:${PROFILE}`;
const ok = (podatak: unknown) => ({ ok: true, podatak }), unknown = () => ({ ok: false, kod: 'MEDIA_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' });
const photo = { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/jpeg', width: 1, height: 1 };
const ref = `${OWNER}/v5/${ASSET}/${'a'.repeat(64)}.jpg`;
const asset = () => ({ assetId: ASSET, accountId: OWNER, scope: 'AVATAR', profileId: PROFILE, conversationId: null,
  clientRequestId: REQUEST, state: 'READY', selected: true, ref, sha256: 'a'.repeat(64), width: 1, height: 1, byteSize: 3, contentType: 'image/jpeg', authoritative: true });
const profile = (avatarPath: string | null = null) => ({ profileId: PROFILE, accountId: OWNER, avatarPath, authoritative: true });
let tree: ReactTestRenderer;
const render = async () => { await act(async () => { tree = create(<Route />); }); };
const action = (label: string) => tree.root.findByProps({ label }).props;
beforeEach(() => {
  jest.clearAllMocks(); mockJournal.clear();
  for (const m of [mockRead, mockReceipt, mockUpload, mockSet, mockPick, mockApply, mockDiscard]) m.mockReset();
  mockSession = { user: { id: OWNER }, accountRevision: 1 }; mockFocused = true;
  mockSet.mockImplementation(async (key: string, value: string) => { mockJournal.set(key, value); });
  mockRead.mockResolvedValue(ok(profile())); mockReceipt.mockResolvedValue(ok(asset()));
  mockUpload.mockResolvedValue(ok(asset())); mockPick.mockResolvedValue(photo); mockApply.mockResolvedValue(unknown());
  mockDiscard.mockResolvedValue(ok({ assetId: ASSET, profileId: PROFILE, accountId: OWNER, discarded: true, authoritative: true }));
});
afterEach(async () => { await act(async () => tree?.unmount()); });
it('stages the chosen picture and publishes it only through the explicit profile action', async () => {
  await render(); const retained = action('Izaberi iz galerije').onPress;
  await act(async () => { void retained(); void retained(); });
  expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockApply).not.toHaveBeenCalled();
  expect(mockUpload.mock.calls[0][0]).toMatchObject({ profileId: PROFILE, clientRequestId: REQUEST, bytes: photo.bytes });
  const stored = JSON.parse(mockJournal.get(journalKey)!); expect(stored).toEqual({ phase: 'UPLOAD', requestId: REQUEST, assetId: null, expectedPath: null });
  await act(async () => action('Sačuvaj fotografiju').onPress());
  expect(mockApply).toHaveBeenCalledWith({ profileId: PROFILE, assetId: ASSET, expectedAvatarPath: null });
});
it('restores an unknown apply by read only and replays its exact original avatar precondition', async () => {
  const prior = `${OWNER}/legacy.jpg`;
  mockJournal.set(journalKey, JSON.stringify({ phase: 'APPLY', requestId: REQUEST, assetId: ASSET, expectedPath: prior }));
  mockRead.mockResolvedValue(ok(profile(prior))); await render();
  expect(mockReceipt).toHaveBeenCalledWith(REQUEST); expect(mockApply).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
  await act(async () => action('Ponovi istu promenu').onPress());
  expect(mockApply).toHaveBeenCalledWith({ profileId: PROFILE, assetId: ASSET, expectedAvatarPath: prior });
});
it('retires a definitively rejected staged upload and never offers to apply it', async () => {
  mockJournal.set(journalKey, JSON.stringify({ phase: 'UPLOAD', requestId: REQUEST, assetId: null, expectedPath: null }));
  mockReceipt.mockResolvedValue(ok({ ...asset(), state: 'STAGED', selected: false, ref: null }));
  await render();
  expect(mockJournal.size).toBe(0); expect(action('Izaberi iz galerije').disabled).toBe(false);
  expect(tree.root.findAllByProps({ label: 'Sačuvaj fotografiju' })).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Fotografija nije dodata.');
  expect(mockApply).not.toHaveBeenCalled(); expect(mockUpload).not.toHaveBeenCalled();
});
it('retires the staged choice without applying it and prevents a retained apply callback', async () => {
  await render(); await act(async () => action('Izaberi iz galerije').onPress()); const apply = action('Sačuvaj fotografiju').onPress;
  await act(async () => action('Odustani od izabrane fotografije').onPress());
  expect(mockDiscard).toHaveBeenCalledWith(ASSET); expect(mockJournal.size).toBe(0);
  await act(async () => apply()); expect(mockApply).not.toHaveBeenCalled();
});
it('does not send pixels when opaque intent persistence fails', async () => {
  mockSet.mockRejectedValue(new Error('unavailable')); await render();
  await act(async () => action('Izaberi iz galerije').onPress()); expect(mockUpload).not.toHaveBeenCalled(); expect(mockApply).not.toHaveBeenCalled();
});
it('clears a completed apply intent but renders newer current state without replaying the old picture', async () => {
  const newer = `${OWNER}/newer.jpg`;
  mockJournal.set(journalKey, JSON.stringify({ phase: 'APPLY', requestId: REQUEST, assetId: ASSET, expectedPath: null }));
  mockRead.mockResolvedValue(ok(profile(newer))); mockApply.mockResolvedValue(ok({ profileId: PROFILE, accountId: OWNER, assetId: ASSET, avatarPath: ref, saved: true, authoritative: true }));
  await render(); await act(async () => action('Ponovi istu promenu').onPress());
  expect(mockJournal.size).toBe(0); expect(mockApply).toHaveBeenCalledTimes(1); expect(mockUpload).not.toHaveBeenCalled();
  expect(action('Izaberi iz galerije').disabled).toBe(false);
});
