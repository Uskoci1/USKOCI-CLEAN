import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PrilikaDetaljiProjekcija } from '../../contracts/publicTaskDetail';

jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get: (target, key) => key === 'View' ? 'View' : Reflect.get(target, key) });
});
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Button', () => ({ Card: 'Card' }));
import { PublicTaskMaterial } from '../../ui/task/PublicTaskMaterial';

const base: PrilikaDetaljiProjekcija = {
  id: 'need', naslov: 'Prevoz ormara', statusTekst: 'Objavljen zadatak', revision: 3,
  opis: 'Preneti ormar uz dva stepeništa.', kategorija: 'Prevoz',
  podrucjeTekst: 'Polazište: Novi Sad', vremeTekst: '9. 9. 2026. · 16:00–19:00 (vreme u Srbiji)',
  pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 }, uslovi: ['Kombi'],
  narucilacProfilId: 'requester', narucilacIme: '', narucilacOcena: null, priblizno: null,
  rezimCene: 'OFFERS', zahtevi: { vestine: ['Nošenje'], alati: ['Kaiševi'], vozila: ['Kombi'],
    licence: ['B kategorija'], minimalnoIskustvoGodina: 2, zahtevaProverenIdentitet: true },
  javnaGeografija: { state: 'available', value: { mode: 'POINT_TO_POINT', start: { city: 'Novi Sad', area: 'Centar' }, end: { city: 'Kalenić' } } },
  kriticniUslovi: { state: 'available', value: ['Bez lifta', 'Dve osobe'] },
};
let tree: ReactTestRenderer | undefined;
const text = () => tree!.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
async function render(task: PrilikaDetaljiProjekcija) { await act(async () => { tree = create(<PublicTaskMaterial task={task} />); }); }
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; });

it('shows actual public description, all requirements and distinct route endpoints', async () => {
  await render(base);
  for (const value of ['Preneti ormar uz dva stepeništa.', 'Prevoz', 'Nošenje', 'Kaiševi', 'Kombi', 'B kategorija',
    'najmanje 2 god.', 'traži se proveren identitet', 'Polazište', 'Odredište', 'Centar, Novi Sad', 'Kalenić', 'Bez lifta', 'Dve osobe',
    '16:00–19:00', 'Traži ponude']) expect(text()).toContain(value);
  expect(text()).not.toContain('Korisnik je proveren');
});

it('keeps unavailable child material distinct from an explicitly empty conditions list', async () => {
  await render({ ...base, javnaGeografija: { state: 'unavailable' }, kriticniUslovi: { state: 'unavailable' } });
  expect(text()).toContain('Detalji mesta i kretanja nisu dostupni');
  expect(text()).toContain('Dodatni uslovi nisu dostupni');
  expect(text()).not.toContain('Nisu navedeni dodatni uslovi.');
  expect(text()).not.toContain('Kalenić');
  await act(async () => tree!.update(<PublicTaskMaterial task={{ ...base, kriticniUslovi: { state: 'available', value: [] } }} />));
  expect(text()).toContain('Nisu navedeni dodatni uslovi.');
  expect(text()).not.toContain('Dodatni uslovi nisu dostupni');
});

it.each([null, 0])('preserves absent versus explicitly zero experience: %s', async value => {
  await render({ ...base, zahtevi: { ...base.zahtevi, minimalnoIskustvoGodina: value, zahtevaProverenIdentitet: false } });
  expect(text()).toContain(value === null ? 'Uslov za iskustvo nije naveden.' : 'Prethodno iskustvo nije obavezno.');
  expect(text()).not.toContain('traži se proveren identitet');
});

it('renders remote work without fabricating a route or a visit', async () => {
  await render({ ...base, podrucjeTekst: 'Na daljinu', javnaGeografija: { state: 'available', value: { mode: 'REMOTE' } } });
  expect(text()).toContain('Na daljinu, bez dolaska na lokaciju.');
  expect(text()).not.toContain('Odredište'); expect(text()).not.toContain('Kalenić');
});

it('renders every ordered public waypoint and the service area for their actual modes', async () => {
  await render({ ...base, javnaGeografija: { state: 'available', value: { mode: 'MULTI_STOP',
    start: { city: 'Novi Sad' }, waypoints: [{ area: 'Stanica A' }, { area: 'Stanica B' }], end: { city: 'Kalenić' } } } });
  expect(text()).toContain('Stanica 1'); expect(text()).toContain('Stanica 2');
  expect(text().indexOf('Stanica A')).toBeLessThan(text().indexOf('Stanica B'));
  await act(async () => tree!.update(<PublicTaskMaterial task={{ ...base, javnaGeografija: { state: 'available', value: {
    mode: 'AREA_BASED', serviceArea: { city: 'Beograd', area: 'Zemun' } } } }} />));
  expect(text()).toContain('Područje rada'); expect(text()).toContain('Zemun, Beograd');
  expect(text()).not.toContain('Stanica A');
});

it('shows an offered price without claiming that offers are requested', async () => {
  await render({ ...base, rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' } });
  expect(text()).toContain('4.500 RSD'); expect(text()).not.toContain('Traži ponude');
});

it('preserves a valid area start anchor and does not invent a final stop', async () => {
  await render({ ...base, javnaGeografija: { state: 'available', value: { mode: 'AREA_BASED', start: { area: 'Telep', city: 'Novi Sad' } } } });
  expect(text()).toContain('Telep, Novi Sad'); expect(text()).not.toContain('Područje nije navedeno');
  await act(async () => tree!.update(<PublicTaskMaterial task={{ ...base, javnaGeografija: { state: 'available', value: {
    mode: 'MULTI_STOP', start: { city: 'Novi Sad' }, waypoints: [{ area: 'Petrovaradin' }] } } }} />));
  expect(text()).toContain('Petrovaradin'); expect(text()).not.toContain('Odredište');
});
