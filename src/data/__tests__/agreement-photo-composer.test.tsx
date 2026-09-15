import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AgreementPhotosController } from '../../hooks/useAgreementPhotos';
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  return ['View', 'ScrollView'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
import { AgreementPhotoComposer } from '../../ui/media/AgreementPhotoComposer';
const gid = '22222222-2222-4222-8222-222222222222', rid = '33333333-3333-4333-8333-333333333333', asset = '44444444-4444-4444-8444-444444444444';
const ref = { agreementId: gid, agreementVersion: 2, clientRequestId: rid };
const receipt = { ...ref, accountId: gid, assetId: asset, state: 'READY' as const, attachedMessageId: null,
  photo: { assetId: asset, width: 1600, height: 900, byteSize: 30, contentType: 'image/jpeg' as const }, authoritative: true as const };
let tree: ReactTestRenderer, photos: AgreementPhotosController;
const button = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(v => typeof v === 'string')).join(' ');
beforeEach(() => { photos = { agreementId: gid, loaded: true, busy: false, items: [], saved: [], message: null, available: true,
  hasSelection: false, selected: [], versionConflict: false, ready: false, capture: jest.fn(() => null), canSubmit: () => true,
  reserved: () => false, canRetry: () => false, refresh: jest.fn().mockResolvedValue(undefined), pick: jest.fn().mockResolvedValue(undefined),
  retry: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined), restore: jest.fn().mockResolvedValue(undefined) }; });
afterEach(async () => { await act(async () => tree?.unmount()); });
it('starts only an explicit picker, keeps media uncertainty recoverable, and bounds the independent preview scroller', async () => {
  photos.items = [{ ref, receipt: null }]; photos.available = false; photos.message = 'Ishod nije potvrđen.';
  await act(async () => { tree = create(<AgreementPhotoComposer photos={photos} capturing={false} />); });
  expect(photos.pick).not.toHaveBeenCalled(); expect(photos.refresh).not.toHaveBeenCalled();
  expect(button('Dodaj fotografiju iz galerije').props.disabled).toBe(true);
  expect(button('Fotografiši za poruku').props.disabled).toBe(true);
  expect(tree.root.findByType('ScrollView' as React.ElementType).props.style.maxHeight).toBe(180);
  await act(async () => button('Ukloni pripremljenu fotografiju 1').props.onPress()); expect(photos.remove).toHaveBeenCalledWith(ref);
  await act(async () => button('Proveri fotografije poruke').props.onPress()); expect(photos.refresh).toHaveBeenCalledTimes(1);
});
it('shows a visible old-version conflict without dropping the photo or canceling an outbox-reserved attachment', async () => {
  photos.items = [{ ref, receipt }]; photos.versionConflict = true; photos.reserved = () => true;
  await act(async () => { tree = create(<AgreementPhotoComposer photos={photos} capturing={false} />); });
  expect(texts()).toContain('Uslovi Dogovora su promenjeni');
  expect(tree.root.findByType('AuthorizedPhoto' as React.ElementType).props).toMatchObject({ assetId: asset, agreementId: gid });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Ukloni pripremljenu fotografiju 1' })).toHaveLength(0);
  expect(photos.remove).not.toHaveBeenCalled(); expect(photos.pick).not.toHaveBeenCalled();
});
it('does not load or attach all server inventory pictures when offering recovery', async () => {
  photos.saved = [receipt]; await act(async () => { tree = create(<AgreementPhotoComposer photos={photos} capturing={false} />); });
  expect(tree.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0); expect(photos.restore).not.toHaveBeenCalled();
  await act(async () => button('Prikaži ranije pripremljene fotografije').props.onPress());
  await act(async () => button('Vrati sačuvanu fotografiju 1').props.onPress()); expect(photos.restore).toHaveBeenCalledWith(rid);
  expect(photos.pick).not.toHaveBeenCalled(); expect(tree.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
});
