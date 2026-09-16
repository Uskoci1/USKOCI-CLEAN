import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
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
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => false }));
jest.mock('phosphor-react-native', () => Object.fromEntries(['Clock', 'MapPin', 'Users', 'MagnifyingGlass', 'Plus', 'SlidersHorizontal', 'User', 'CalendarBlank', 'Check', 'X', 'Lightning'].map(name => [name, 'Icon'])));
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
  ucesnici: [{ id: 'me', ime: 'Ja', inicijali: 'JA', uloga: 'narucilac', mesta: null, viSte: true, telefon: null }, { id: 'o', ime: 'Mila', inicijali: 'MI', uloga: 'uskocer', mesta: 1, viSte: false, telefon: null }],
  kontakt: { mojTelefonPodeljen: false, njihovTelefon: null, lokacijaPostoji: false, tacnaLokacija: null, emailNijeDeljen: true },
  chatDostupan: true, rokPotvrdeIso: null, problemOtvoren: false, ocenaMoguca: false, hronologija: [], radnje: null,
});
let tree: ReactTestRenderer;
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const labels = () => tree.root.findAllByType('Press' as React.ElementType).map(node => node.props.accessibilityLabel);
const roleOf = (label: string) => tree.root.findAllByType('Press' as React.ElementType).find(node => node.props.accessibilityLabel === label)!.props;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

function Marketplace({ owned, intent, rows, loading = false }: { owned: boolean; intent?: 'narucilac' | 'uskocer'; rows: MarketplaceItem[]; loading?: boolean }) {
  const [view, setView] = useState<MarketplaceView>(initialMarketplaceView);
  return <MarketplacePresentation owned={owned} intent={intent} items={rows} loading={loading} error={false} scopeKey="a:1" view={view} onView={setView}
    onOpen={() => {}} onRefresh={() => {}} onSwitch={() => {}} onProfile={() => {}} onNew={owned ? () => {} : undefined} />;
}
test('header names the intent the user is in, the screen title is a header, and the mode switch is a real tab list', async () => {
  await act(async () => { tree = create(<Marketplace owned={false} intent="uskocer" rows={[row('one')]} />); });
  expect(texts()).toContain('Ja mogu'); expect(texts()).toContain('Zadaci');
  expect(tree.root.findAllByType('T' as React.ElementType).some(node => node.props.accessibilityRole === 'header' && node.children.includes('Zadaci'))).toBe(true);
  expect(roleOf('Lista').accessibilityRole).toBe('tab'); expect(roleOf('Lista').accessibilityState).toEqual({ selected: true });
  expect(roleOf('Mapa').accessibilityState).toEqual({ selected: false });
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' }).length).toBeGreaterThan(0);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Marketplace owned intent="narucilac" rows={[row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 })]} />); });
  expect(texts()).toContain('Meni treba'); expect(roleOf('Aktivni').accessibilityRole).toBe('tab');
});
test('loading shows placeholder geometry and a spoken status, never a stale card', async () => {
  await act(async () => { tree = create(<Marketplace owned={false} rows={[row('one')]} loading />); });
  expect(labels().some(label => String(label).startsWith('Otvorite'))).toBe(false);
  expect(texts()).toContain('Učitavamo zadatke…');
  expect(tree.root.findAllByProps({ importantForAccessibility: 'no-hide-descendants' }).length).toBeGreaterThan(0);
});
test('an owner draft shows a quiet draft status and "Nastavi uređivanje", never an application count', async () => {
  await act(async () => { tree = create(<Marketplace owned intent="narucilac" rows={[row('d', { stanje: 'NACRT', brojPrijava: 0 })]} />); });
  await act(async () => roleOf('Nacrti').onPress());
  const copy = texts(); expect(copy).toContain('Privatan nacrt'); expect(copy).toContain('Nastavi uređivanje'); expect(copy).not.toMatch(/prijava|0 \/ 2/);
  expect(roleOf('Otvorite Zadatak Pomoć d')).toBeTruthy();
});
test('the filter sheet offers price modes as radios and the primary action is the only brand action', async () => {
  await act(async () => { tree = create(<Marketplace owned={false} rows={[row('one')]} />); });
  await act(async () => roleOf('Filteri').onPress());
  expect(roleOf('Tražim ponude').accessibilityRole).toBe('radio'); expect(roleOf('Svi načini').accessibilityState).toEqual({ checked: true });
  const brand = tree.root.findAllByType('Press' as React.ElementType).filter(node => JSON.stringify(node.props.style).includes('#FF850F'));
  expect(brand.map(node => node.props.accessibilityLabel)).toEqual(['Prikaži zadatke']);
});

function Agreements({ intent, rows, loading = false }: { intent?: 'narucilac' | 'uskocer'; rows: DogovorProjekcija[]; loading?: boolean }) {
  const [section, setSection] = useState<AgreementCollectionSection>('active'), [only, setOnly] = useState(false);
  return <AgreementCollectionPresentation items={rows} loading={loading} error={false} requester={intent !== 'uskocer'} intent={intent} section={section} confirmationOnly={only}
    onSection={setSection} onConfirmationOnly={setOnly} onOpen={() => {}} onRefresh={() => {}} onTasks={() => {}} onCalendar={() => {}} onProfile={() => {}} />;
}
test('agreements name the intent, keep the accepted facts and mark an open problem in words', async () => {
  const rows = [agreement('a', 'CONFIRMED'), agreement('b', 'AWAITING_REQUESTER')]; rows[1].problemOtvoren = true;
  await act(async () => { tree = create(<Agreements intent="narucilac" rows={rows} />); });
  const copy = texts();
  expect(copy).toContain('Meni treba'); expect(copy).toContain('Dogovori'); expect(copy).toContain('2.500 RSD'); expect(copy).toContain('1 osoba');
  expect(copy).not.toContain('Dogovoreno'); expect(copy).toContain('Čeka se potvrda završetka'); expect(copy).toContain('Prijavljen je problem · pogledajte Dogovor');
  expect(copy).toContain('Mila'); expect(copy).toContain('radi za tebe');
  expect(roleOf('Aktivni').accessibilityRole).toBe('tab'); expect(labels()).not.toContain('Radni raspored (JA MOGU)');
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Agreements intent="uskocer" rows={rows} />); });
  expect(texts()).toContain('Ja mogu'); expect(labels()).toContain('Radni raspored (JA MOGU)');
});
test('agreements loading shows placeholders and a spoken status without private rows', async () => {
  await act(async () => { tree = create(<Agreements intent="narucilac" rows={[agreement('a', 'CONFIRMED')]} loading />); });
  expect(labels().some(label => String(label).startsWith('Otvorite Dogovor'))).toBe(false); expect(texts()).toContain('Učitavamo Dogovore…');
});
