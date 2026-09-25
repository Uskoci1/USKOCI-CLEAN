import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import { TaskPublisherPortrait } from '../../ui/v2/TaskPublisherPortrait';
import { Avatar } from '../../ui/system/Avatar';

// Stop at the existing reader's boundary: this test never starts a real media or profile request.
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('../../ui/system/Avatar', () => ({ Avatar: 'Avatar' }));

const PROFILE = '22222222-2222-4222-8222-222222222222';
const ASSET = '33333333-3333-4333-8333-333333333333';
const task = (patch: Partial<PrilikaProjekcija> = {}): PrilikaProjekcija => ({
  id: 'task-a', naslov: 'Prenos kutija', statusTekst: 'Traži ponude', podrucjeTekst: 'Novi Sad', vremeTekst: 'Fleksibilno',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, uslovi: [], priblizno: null,
  narucilacProfilId: PROFILE, narucilacAvatarId: ASSET, narucilacIme: 'Ana Anić', narucilacOcena: null, ...patch,
});
let tree: ReactTestRenderer | undefined;
const render = async (item: PrilikaProjekcija | PotrebaProjekcija, size: 40 | 56 = 40) => {
  await act(async () => { tree = create(<TaskPublisherPortrait item={item} size={size} />); });
};
afterEach(async () => { await act(async () => { tree?.unmount(); }); tree = undefined; });

it.each([40, 56] as const)('binds a %s dp portrait to its public profile and retains the same honest fallback', async size => {
  await render(task(), size);
  const photo = tree!.root.findByType('AuthorizedPhoto' as React.ElementType);
  expect(photo.props).toEqual({ assetId: ASSET, profileId: PROFILE, label: 'Profilna fotografija', contentFit: 'cover',
    style: { width: size, height: size, borderRadius: size / 2, aspectRatio: 1 }, unavailable: expect.anything() });
  expect(photo.props.unavailable.type).toBe(Avatar);
  expect(photo.props.unavailable.props).toEqual({ initials: 'AA', size });
});

it.each([
  { narucilacAvatarId: undefined }, { narucilacAvatarId: null }, { narucilacProfilId: '' }, { narucilacIme: '  ' },
])('does not mount an authorized read without the required public identity: %p', async patch => {
  await render(task(patch));
  expect(tree!.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
  expect(tree!.root.findByType('Avatar' as React.ElementType).props).toEqual({ size: 40,
    initials: patch.narucilacIme !== undefined ? null : 'AA' });
});

it('does not turn an owned-task projection into a publisher photo request', async () => {
  const own: PotrebaProjekcija = { id: 'own-task', revizija: 1, naslov: 'Prenos kutija', opis: '', stanje: 'CEKA_PRIJAVE',
    pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, vremeTekst: 'Fleksibilno', podrucjeTekst: 'Novi Sad',
    uslovi: [], brojPrijava: 0 };
  await render(own);
  expect(tree!.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
  expect(tree!.root.findByType('Avatar' as React.ElementType).props).toEqual({ initials: null, size: 40 });
});

it('replaces the complete asset/profile pair when a virtualized row is reused', async () => {
  await render(task());
  const profileId = '44444444-4444-4444-8444-444444444444', assetId = '55555555-5555-4555-8555-555555555555';
  await act(async () => tree!.update(<TaskPublisherPortrait item={task({ narucilacProfilId: profileId,
    narucilacAvatarId: assetId, narucilacIme: 'Milan Marić' })} size={56} />));
  const photo = tree!.root.findByType('AuthorizedPhoto' as React.ElementType);
  expect(photo.props).toMatchObject({ profileId, assetId });
  expect(photo.props.unavailable.props).toEqual({ initials: 'MM', size: 56 });
});
