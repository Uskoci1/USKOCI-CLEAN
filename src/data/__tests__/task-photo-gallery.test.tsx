import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

let mockSession = { user: { id: 'account-a' }, accountRevision: 1 }, mockFocused = true, mockReduced = false;
const mockRead = jest.fn(), mockProfile = jest.fn(), mockScroll = jest.fn();
jest.mock('../mediaClientService', () => ({ mediaClientService: {
  readNeedPhotos: (...args: unknown[]) => mockRead(...args), readProfilePhoto: (...args: unknown[]) => mockProfile(...args),
} }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ScrollView', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/ScreenChrome', () => ({ ChromeIconButton: 'ChromeIconButton' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));

import { NeedPhotos, ProfilePhoto } from '../../ui/media/ContextPhotos';

const photos = [{ assetId: 'photo-a', width: 1000, height: 750, contentType: 'image/jpeg' },
  { assetId: 'photo-b', width: 900, height: 1200, contentType: 'image/jpeg' }];
const listing = (needId = 'need-a', entries = photos) => ({ ok: true, podatak: { needId, photos: entries, authoritative: true } });
let tree: ReactTestRenderer;
const host = (type: string) => tree.root.findAll(node => node.type === (type as React.ElementType));
const words = () => host('T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const byId = (testID: string) => tree.root.findByProps({ testID });
const render = async (element = <NeedPhotos needId="need-a" />) => {
  await act(async () => { tree = create(element, { createNodeMock: element => element.type === 'ScrollView' ? { scrollTo: mockScroll } : null }); });
};
const measure = async (testID: string, width = 280, height = 210) => {
  await act(async () => byId(testID).props.onLayout({ nativeEvent: { layout: { width, height, x: 0, y: 0 } } }));
};
const settle = async (testID: string, x: number) => {
  await act(async () => byId(testID).props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x, y: 0 } } }));
};
const open = async (page = 1) => {
  await act(async () => tree.root.findByProps({ accessibilityLabel: `Otvori fotografiju ${page} od 2` }).props.onPress());
};
const modalPhotos = (): ReactTestInstance[] => host('Modal')[0].findAll(node => node.type === ('AuthorizedPhoto' as React.ElementType));

beforeEach(() => {
  jest.clearAllMocks(); mockRead.mockReset(); mockProfile.mockReset();
  mockSession = { user: { id: 'account-a' }, accountRevision: 1 }; mockFocused = true; mockReduced = false;
  mockRead.mockImplementation(async (id: string) => listing(id));
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('uses measured width for each authorized page, updates the real counter, and keeps the chosen page on resizing', async () => {
  await render(); expect(host('AuthorizedPhoto')).toHaveLength(0);
  await measure('task-photo-viewport');
  expect(byId('task-photo-pages').props.pagingEnabled).toBe(true);
  expect(host('AuthorizedPhoto').map(node => [node.props.assetId, node.props.needId, node.props.style.width, node.props.style.height]))
    .toEqual([['photo-a', 'need-a', 280, 210], ['photo-b', 'need-a', 280, 210]]);
  expect(words()).toContain('1 / 2');
  await settle('task-photo-pages', 280); expect(words()).toContain('2 / 2');
  await measure('task-photo-viewport', 400, 300);
  expect(mockScroll).toHaveBeenLastCalledWith({ x: 400, animated: false });
  expect(host('AuthorizedPhoto')[0].props.style.width).toBe(400);
  await settle('task-photo-pages', 99999); expect(words()).toContain('2 / 2');
  await settle('task-photo-pages', -50); expect(words()).toContain('1 / 2');
});

it('opens the pressed photo in a full-screen authorized viewer and synchronizes the page when closed with Android Back', async () => {
  await render(); await measure('task-photo-viewport'); await settle('task-photo-pages', 280); await open(2);
  expect(host('Modal')[0].props).toMatchObject({ visible: true, presentationStyle: 'fullScreen', animationType: 'fade' });
  await measure('task-photo-viewer-viewport', 360, 540);
  expect(modalPhotos().map(node => [node.props.assetId, node.props.needId, node.props.contentFit])).toEqual([
    ['photo-a', 'need-a', 'contain'], ['photo-b', 'need-a', 'contain'],
  ]);
  expect(byId('task-photo-viewer-pages').props.contentOffset).toEqual({ x: 360, y: 0 });
  expect(tree.root.findByProps({ label: 'Sledeća fotografija' }).props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ label: 'Prethodna fotografija' }).props.onPress());
  expect(tree.root.findByProps({ label: 'Prethodna fotografija' }).props.disabled).toBe(true);
  await act(async () => host('Modal')[0].props.onRequestClose());
  expect(host('Modal')).toHaveLength(0); expect(words()).toContain('1 / 2');
  expect(byId('task-photo-pages').props.contentOffset).toEqual({ x: 0, y: 0 });
});

it('respects reduced motion and exposes an explicit close control', async () => {
  mockReduced = true; await render(); await measure('task-photo-viewport'); await open();
  expect(host('Modal')[0].props.animationType).toBe('none');
  await act(async () => tree.root.findByProps({ label: 'Zatvori fotografije' }).props.onPress());
  expect(host('Modal')).toHaveLength(0);
});

it('closes the viewer and retires old photos when the task or account revision changes', async () => {
  await render(); await measure('task-photo-viewport'); await open();
  mockRead.mockImplementation(async (id: string) => listing(id, [{ ...photos[0], assetId: 'photo-new' }]));
  await act(async () => tree.update(<NeedPhotos needId="need-b" />));
  expect(host('Modal')).toHaveLength(0); await measure('task-photo-viewport');
  expect(host('AuthorizedPhoto').map(node => [node.props.assetId, node.props.needId])).toEqual([['photo-new', 'need-b']]);
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Otvori fotografiju 1 od 1' }).props.onPress());
  mockSession = { user: { id: 'account-b' }, accountRevision: 2 };
  mockRead.mockImplementation(() => new Promise(() => {}));
  await act(async () => tree.update(<NeedPhotos needId="need-b" />));
  expect(host('Modal')).toHaveLength(0); expect(host('AuthorizedPhoto')).toHaveLength(0);
});

it('does not preserve an open native viewer after leaving the route', async () => {
  await render(); await measure('task-photo-viewport'); await open();
  mockFocused = false; await act(async () => tree.update(<NeedPhotos needId="need-a" />));
  expect(host('Modal')).toHaveLength(0); expect(host('AuthorizedPhoto')).toHaveLength(0);
});

it('distinguishes a real empty list from a read failure and retries without invented pictures', async () => {
  mockRead.mockResolvedValue(listing('need-a', [])); await render();
  expect(tree.toJSON()).toBeNull();
  await act(async () => tree.update(<NeedPhotos needId="need-a" owned />));
  expect(tree.toJSON()).toBeNull(); expect(host('AuthorizedPhoto')).toHaveLength(0);
  mockRead.mockResolvedValue({ ok: false, kod: 'MEDIA_UNAVAILABLE', poruka: 'Nije dostupno.' });
  await act(async () => tree.update(<NeedPhotos needId="need-b" owned />));
  expect(words()).toContain('Fotografije trenutno nisu učitane.'); expect(words()).not.toContain('Još nema fotografija');
  mockRead.mockResolvedValue(listing('need-b'));
  await act(async () => tree.root.findByProps({ label: 'Učitaj fotografije' }).props.onPress());
  await measure('task-photo-viewport'); expect(host('AuthorizedPhoto')).toHaveLength(2);
  expect(words()).not.toContain('Fotografije trenutno nisu učitane.');
});

it('keeps ProfilePhoto on its original authorized portrait contract', async () => {
  mockProfile.mockResolvedValue({ ok: true, podatak: { profileId: 'profile-a', photo: photos[0], authoritative: true } });
  await render(<ProfilePhoto profileId="profile-a" size={56} />);
  expect(mockRead).not.toHaveBeenCalled(); expect(mockProfile).toHaveBeenCalledWith('profile-a');
  expect(host('AuthorizedPhoto')[0].props).toMatchObject({ assetId: 'photo-a', profileId: 'profile-a', contentFit: 'cover',
    style: { width: 56, height: 56, borderRadius: 28, aspectRatio: 1 } });
  expect(host('Modal')).toHaveLength(0);
});
