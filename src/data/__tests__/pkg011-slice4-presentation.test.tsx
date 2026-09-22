import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { sys } from '../../ui/system/tokens';
import type { PotrebaProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { NeedPresentation } from '../../ui/v2/NeedPresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const brand = () => presses().filter(node => JSON.stringify(node.props.style).includes(sys.color.orange)).map(node => node.props.accessibilityLabel);
const byLabel = (label: string) => presses().find(node => node.props.accessibilityLabel === label)!;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const need = (patch: Partial<PotrebaProjekcija> = {}): PotrebaProjekcija => ({ id: 'need', revizija: 3, naslov: 'Prenos ormara', opis: 'Ormar sa trećeg sprata.', stanje: 'OBJAVLJENA',
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, vremeTekst: 'Sutra', podrucjeTekst: 'Novi Sad, Liman', uslovi: ['Trake'], brojPrijava: 3, rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 4000, valuta: 'RSD', prikaz: '4.000 RSD' }, ...patch });
const noop = () => {};

test('PKG-035: task detail retains history without promising an unavailable selection', async () => {
  await act(async () => { tree = create(<Screen value={Object.assign(need({ brojPrijava: 7 }), { brojPrijavaZaIzbor: 0 })} />); });
  expect(texts()).toContain('Trenutno nema prijava za izbor.');
  expect(texts()).toContain('Ukupno 7 prijava');
  expect(texts()).not.toContain('Sledeće: izbor.');
  expect(labels()).toContain('Otvori prijave, ukupno 7');
});
function Screen({ value, loading = false, error = null, remainingClosed = false }: {
  value: PotrebaProjekcija | null; loading?: boolean; error?: string | null; remainingClosed?: boolean;
  }) {
  return <NeedPresentation need={value} loading={loading} error={error} busy={false} remainingClosed={remainingClosed}
    onBack={noop} onRefresh={noop} onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} />;
}

test('my own draft is mine to act on from wherever I opened it: no way across is needed and none is drawn', async () => {
  // Owner decision 1 (2026-09-19) supersedes the owner decision of 2026-09-18 here. A draft opened
  // while the app stood in the other mode used to be read-only, with a notice offering to switch the
  // whole app. The screen is the view of the owner, read through the owner-only read, so it simply acts.
  await act(async () => { tree = create(<Screen value={need({ stanje: 'NACRT', brojPrijava: 0 })} />); });
  expect(texts()).not.toMatch(/Ovo radiš kao|JA MOGU|MENI TREBA|iz Profila/);
  expect(labels()).not.toContain('Pređi u MENI TREBA'); expect(labels()).toContain('Izmeni nacrt');
});
test('a published Task leads with its state, price and people, shows the applications row with a count, and has one brand action: the applications', async () => {
  await act(async () => { tree = create(<Screen value={need({ brojPrijavaZaIzbor: 3 })} />); });
  const copy = texts();
  expect(copy).toContain('Objavljen'); expect(copy).toContain('Prenos ormara'); expect(copy).toContain('4.000 RSD'); expect(copy).toContain('2 osobe');
  expect(copy).toContain('Ormar sa trećeg sprata.'); expect(copy).toContain('3 prijave za izbor');
  expect(labels()).toContain('Otvori prijave, ukupno 3'); expect(labels()).toContain('Izmeni Zadatak');
  expect(brand()).toEqual(['Pogledaj prijave']);
  expect(byLabel('Mesto izvršenja').props.accessibilityState).toEqual({ expanded: false });
  // Required equipment is now readable immediately, before any disclosure is opened.
  expect(copy).toContain('Trake');
});
test('a private draft explains the next step and leads with the review; a closed remaining search is stated, not offered', async () => {
  await act(async () => { tree = create(<Screen value={need({ stanje: 'NACRT', brojPrijava: 0 })} />); });
  expect(texts()).toContain('Privatan nacrt'); expect(texts()).toContain('Spremi zadatak za objavu'); expect(brand()).toEqual(['Pregledaj za objavu']);
  expect(labels()).toContain('Izmeni nacrt'); expect(labels()).not.toContain('Izmeni Zadatak');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={need({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } })} remainingClosed />); });
  expect(texts()).toContain('Preostala potraga je zatvorena'); expect(labels()).not.toContain('Ne traži više nikoga'); expect(labels()).not.toContain('Izmeni Zadatak');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={need({ stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } })} />); });
  expect(labels()).toContain('Ne traži više nikoga');
});
test('loading shows placeholder geometry with a spoken status; an error keeps one retry', async () => {
  await act(async () => { tree = create(<Screen value={null} loading />); });
  expect(texts()).toContain('Učitavamo Zadatak…'); expect(brand()).toEqual([]);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Screen value={null} error="Zadatak trenutno nije moguće učitati." />); });
  expect(texts()).toContain('Zadatak nije dostupan'); expect(byLabel('Pokušaj ponovo')).toBeTruthy(); expect(brand()).toEqual(['Pokušaj ponovo']);
});
