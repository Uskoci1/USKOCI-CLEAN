import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction, sys } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
import type { PotrebaProjekcija } from '../../contracts/projections';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ScrollView', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
import { ArrowRight } from 'phosphor-react-native';
import { NeedPresentation } from '../../ui/v2/NeedPresentation';

let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const presses = () => tree.root.findAllByType('Press' as React.ElementType);
const labels = () => presses().map(node => node.props.accessibilityLabel);
const brand = () => presses().filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor).map(node => node.props.accessibilityLabel);
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
  // The footer counts what the screen counts: a known zero is not drawn as "· 0", and the total is said, not shown as choosable.
  expect(texts()).not.toContain('Pregledaj prijave · ');
  expect(brand()).toEqual(['Pregledaj prijave, trenutno nema prijava za izbor, ukupno 7 prijava']);
});
test('PKG-035: when the server has not said how many can be chosen, the footer counts the total and says so', async () => {
  await act(async () => { tree = create(<Screen value={need({ brojPrijava: 5 })} />); });
  expect(texts()).toContain('Pregledaj prijave · 5');
  expect(brand()).toEqual(['Pregledaj prijave, ukupno 5 prijava']);
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
  // V41 (2026-09-23): the one orange action carries the count of the applications that can be chosen.
  expect(copy).toContain('Pregledaj prijave · 3');
  expect(brand()).toEqual(['Pregledaj prijave, 3 prijave za izbor']);
  expect(byLabel('Mesto izvršenja').props.accessibilityState).toEqual({ expanded: false });
  // Required equipment is now readable immediately, before any disclosure is opened.
  expect(copy).toContain('Trake');
  // Potrebno says how many places are taken; a price with no stated basis stays the bare amount, with no invented note.
  expect(copy).toContain('0 / 2 popunjeno');
  expect(copy).not.toMatch(/Ukupno za ceo zadatak|Po osobi/);
});
test('V41 facts: the place, Termin as day and hours, Potrebno, and the price with what it covers', async () => {
  const fixed = need({ vremeTekst: '20. sep 2026 · 18:00 – 19:00 (po vremenu u Srbiji)', rezimCene: 'MY_PRICE', osnovaCene: 'PER_PERSON',
    ponudjenaCena: { iznos: 3000, valuta: 'RSD', prikaz: '3.000 RSD' },
    schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-20T16:00:00Z', endsAt: '2026-09-20T17:00:00Z' } });
  await act(async () => { tree = create(<Screen value={fixed} />); });
  const spoken = tree.root.findAll(node => typeof node.props.accessibilityLabel === 'string').map(node => node.props.accessibilityLabel);
  // The saved sentence is only split where it is exactly a day and its hours; nothing is reworded, and it is still heard whole.
  expect(texts()).toContain('20. sep 2026 18:00 – 19:00 (po vremenu u Srbiji)');
  expect(spoken).toContain('Termin: 20. sep 2026 · 18:00 – 19:00 (po vremenu u Srbiji)');
  expect(spoken).toContain('Lokacija: Novi Sad, Liman');
  expect(spoken).toContain('Potrebno: 2 osobe, popunjeno 0 od 2 mesta');
  // The figure stays large and what it covers goes quietly beside it, in the words the rest of the app uses.
  expect(texts()).toContain('3.000 RSD Po osobi · ukupno 6.000 RSD');
  expect(spoken).toContain('Budžet: 3.000 RSD, Po osobi · ukupno 6.000 RSD');
  await act(async () => tree.unmount());
  // A flexible range is never split into a day and an hour it does not have.
  await act(async () => { tree = create(<Screen value={need({ vremeTekst: 'Fleksibilan raspon · 13. sep 2026 – 14. sep 2026',
    schedule: { kind: 'FLEXIBLE', startsAt: '2026-09-12T22:00:00Z', endsAt: '2026-09-14T22:00:00Z' } })} />); });
  expect(texts()).toContain('Fleksibilan raspon · 13. sep 2026 – 14. sep 2026');
});
test('an open price is a word, not an amount, and the owner is told who names it; a draft has no places to fill yet', async () => {
  await act(async () => { tree = create(<Screen value={need({ stanje: 'NACRT', brojPrijava: 0, rezimCene: 'OFFERS', ponudjenaCena: undefined })} />); });
  const price = tree.root.findAll(node => node.type === ('T' as React.ElementType) && node.props.children === 'Tražim ponude')[0];
  expect(JSON.stringify(price.props.style)).not.toContain(sys.color.money);
  expect(texts()).toContain('Svako u prijavi predlaže ukupan iznos.');
  expect(texts()).not.toContain('popunjeno');
});
test('the footer leads somewhere with an arrow; while an action runs it says so, is disabled and points nowhere', async () => {
  await act(async () => { tree = create(<Screen value={need({ brojPrijavaZaIzbor: 3 })} />); });
  expect(byLabel('Pregledaj prijave, 3 prijave za izbor').findAllByType(ArrowRight)).toHaveLength(1);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<NeedPresentation need={need()} loading={false} error={null} busy remainingClosed={false}
    onBack={noop} onRefresh={noop} onReview={noop} onEdit={noop} onCloseRemaining={noop} onCandidates={noop} />); });
  const footer = byLabel('Radnja je u toku…');
  expect(footer.props.disabled).toBe(true);
  expect(footer.findAllByType(ArrowRight)).toHaveLength(0);
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
