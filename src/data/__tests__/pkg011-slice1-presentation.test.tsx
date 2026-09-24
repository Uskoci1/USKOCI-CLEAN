import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { brandAction } from '../../ui/system/tokens';
// The one primary action is the Press whose own surface is the brand surface (last style wins, as in React Native).
const surfaceOf = (style: unknown): unknown => Array.isArray(style) ? style.map(surfaceOf).filter(value => value !== undefined).pop()
  : style && typeof style === 'object' ? (style as { backgroundColor?: unknown }).backgroundColor : undefined;
import type { DogovorProjekcija } from '../../contracts/projections';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return ({ data, renderItem, ListEmptyComponent, ...props }: any) => React.createElement('List', props, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent);
    if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
    if (key === 'Keyboard') return { dismiss: jest.fn() };
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/icons', () => ({ V2Icon: 'Icon' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';
import { AgreementCollectionPresentation, type AgreementCollectionSection } from '../../ui/v2/AgreementCollectionPresentation';

const row = (id: string, patch = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.83 }, ...patch } as unknown as MarketplaceItem);
const agreement = (id: string, state: DogovorProjekcija['stanje']): DogovorProjekcija => ({
  id, verzija: 1, naslov: `Posao ${id}`, stanje: state, cena: { iznos: 2500, valuta: 'RSD', prikaz: '2.500 RSD' }, vremeTekst: 'sutra 10:00', putanjaTekst: 'Novi Sad',
  pokrivenost: { ukupno: 1, popunjeno: 1, preostalo: 0, udeo: 1 }, rezim: 'FIZICKI',
  ucesnici: [{ id: 'me', profilId: null, ime: 'Ja', inicijali: 'JA', uloga: 'narucilac', mesta: null, viSte: true, telefon: null }, { id: 'o', profilId: null, ime: 'Mila', inicijali: 'MI', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null, pocinje: null, izmenaCeka: null, izvor: { zadatakId: null, prijavaId: null },
});
let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const labels = () => tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel);
const roleOf = (label: string) => tree.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === label)!.props;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

function Marketplace({ owned, rows, loading = false }: { owned: boolean; rows: MarketplaceItem[]; loading?: boolean }) {
  const [view, setView] = useState<MarketplaceView>(initialMarketplaceView);
  return <MarketplacePresentation owned={owned} items={rows} loading={loading} error={false} scopeKey="a:1" view={view} onView={setView}
    onOpen={() => {}} onRefresh={() => {}} onProfile={() => {}} onNew={owned ? () => {} : undefined} />;
}
test('the header says what the list is in the two names the product uses and never an app mode; the title is a header and the list/map switch is a real tab list', async () => {
  await act(async () => { tree = create(<Marketplace owned={false} rows={[row('one')]} />); });
  // Both tabs used this presentation and both were titled Zadaci, so two different screens
  // carried one name. "Mapa" was the tab label, the screen title and one of the two segments at the same time, so the
  // word identified nothing. The invariant is unchanged: the title is a header, and it is never an app mode.
  // V41 (2026-09-23): the tab header draws the mark, not the section name; the name reaches a screen reader as the
  // header's label. Since the owner's information architecture of 2026-09-23 discovery IS the Zadaci tab, so the header
  // is read as the tab is named ("Pronađi zadatak" before), and my own tasks below are "Moji zadaci".
  expect(texts()).not.toContain('Uskoči i zaradi'); expect(texts()).not.toMatch(/Ja mogu|Meni treba/);
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'header' && node.props.accessibilityLabel === 'USKOČI, Zadaci').length).toBeGreaterThan(0);
  expect(tree.root.findAll(node => String(node.props.accessibilityLabel).includes('Pronađi zadatak'))).toHaveLength(0);
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.accessibilityRole === 'header' && node.children.includes('Mapa'))).toBe(false);
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.accessibilityRole === 'header' && node.children.includes('Zadaci'))).toBe(false);
  expect(roleOf('Lista').accessibilityRole).toBe('tab'); expect(roleOf('Lista').accessibilityState).toEqual({ selected: true });
  expect(roleOf('Mapa').accessibilityState).toEqual({ selected: false });
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' }).length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Marketplace owned rows={[row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 })]} />); });
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'header' && String(node.props.accessibilityLabel).includes('Moji zadaci')).length).toBeGreaterThan(0); expect(texts()).not.toMatch(/Ja mogu|Meni treba/); expect(roleOf('Aktivni').accessibilityRole).toBe('tab');
});
test('loading shows placeholder geometry and a spoken status, never a stale card', async () => {
  await act(async () => { tree = create(<Marketplace owned={false} rows={[row('one')]} loading />); });
  expect(labels().some(label => String(label).startsWith('Otvori'))).toBe(false);
  expect(texts()).toContain('Učitavamo zadatke…');
  expect(tree.root.findAllByProps({ importantForAccessibility: 'no-hide-descendants' }).length).toBeGreaterThan(0);
});
test('an owner draft shows a quiet draft status and "Nastavi uređivanje", never an application count', async () => {
  await act(async () => { tree = create(<Marketplace owned rows={[row('d', { stanje: 'NACRT', brojPrijava: 0 })]} />); });
  await act(async () => roleOf('Nacrti').onPress());
  // One task card (step 5a, 2026-09-24): the own-task status words are Nacrt / Delimično popunjen / Popunjen / Zatvoren,
  // so the draft reads "Nacrt" (was "Privatan nacrt"); a draft still draws no places and no application count.
  const copy = texts(); expect(copy).toContain('Nastavi uređivanje'); expect(copy).not.toMatch(/prijava|0 ?\/ ?2/);
  // The whole word, not the "Nacrti" tab that contains it.
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.children === 'Nacrt')).toBe(true);
  expect(roleOf('Otvori Zadatak Pomoć d')).toBeTruthy();
});
test('the filter sheet offers price modes as radios and the primary action is the only brand action', async () => {
  await act(async () => { tree = create(<Marketplace owned={false} rows={[row('one')]} />); });
  await act(async () => roleOf('Filteri').onPress());
  expect(roleOf('Tražim ponude').accessibilityRole).toBe('radio'); expect(roleOf('Svi načini').accessibilityState).toEqual({ checked: true });
  const brand = tree.root.findAllByType('Press' as React.ElementType).filter(node => surfaceOf(node.props.style) === brandAction.backgroundColor);
  expect(brand.map(node => node.props.accessibilityLabel)).toEqual(['Prikaži 1 zadatak']);
});

function Agreements({ rows, loading = false }: { rows: DogovorProjekcija[]; loading?: boolean }) {
  const [section, setSection] = useState<AgreementCollectionSection>('active'), [only, setOnly] = useState(false);
  return <AgreementCollectionPresentation items={rows} loading={loading} error={false} section={section} confirmationOnly={only}
    onSection={setSection} onConfirmationOnly={setOnly} onOpen={() => {}} onRefresh={() => {}} onHome={() => {}} onCalendar={() => {}} onProfile={() => {}} />;
}
test('agreements are one list for both sides, keep the accepted facts, say the side on each row and mark an open problem in words', async () => {
  const rows = [agreement('a', 'CONFIRMED'), agreement('b', 'AWAITING_REQUESTER')]; rows[1].problemOtvoren = true;
  await act(async () => { tree = create(<Agreements rows={rows} />); });
  const copy = texts();
  expect(copy).not.toContain('Tvoje saradnje'); expect(copy).not.toMatch(/Ja mogu|Meni treba/); expect(copy).toContain('2.500 RSD'); expect(copy).toContain('1 osoba');
  expect(tree.root.findAll(node => node.props.accessibilityRole === 'header' && String(node.props.accessibilityLabel).includes('Dogovori')).length).toBeGreaterThan(0);
  expect(copy).not.toContain('Dogovoreno'); expect(copy).toContain('Čeka se potvrda završetka'); expect(copy).toContain('Prijavljen je problem · pogledaj Dogovor');
  // Mila is the other side of this Dogovor, so the row says what Mila did, not what I did.
  expect(copy).toContain('Mila'); expect(copy).toContain('Uskače'); expect(copy).not.toContain('Objavio si'); expect(copy).not.toContain('Uskočio');
  expect(roleOf('Aktivni').accessibilityRole).toBe('tab'); expect(labels()).toContain('Kalendar obaveza');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Agreements rows={rows} />); });
  expect(texts()).not.toContain('Tvoje saradnje'); expect(labels()).toContain('Kalendar obaveza');
});
test('agreements loading shows placeholders and a spoken status without private rows', async () => {
  await act(async () => { tree = create(<Agreements rows={[agreement('a', 'CONFIRMED')]} loading />); });
  expect(labels().some(label => String(label).startsWith('Otvori Dogovor'))).toBe(false); expect(texts()).toContain('Učitavamo Dogovore…');
});
