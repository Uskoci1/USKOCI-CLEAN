import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
let mockReduced = false, mockFocused = true;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const List = ({ data, renderItem, ListEmptyComponent, ...props }: any) => React.createElement('List', props,
    data.length ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }))) : ListEmptyComponent);
  // One stable function: a new one on every read would be a new component type, and React would mount the sheet again.
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const Keyboard = { dismiss: () => undefined };
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return List;
    if (key === 'Modal') return Modal;
    if (key === 'Keyboard') return Keyboard;
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
import { DiscoveryPresentation, HIDDEN, OFFSET_SETTLE_MS } from '../../ui/v2/DiscoveryPresentation';
import { DiscoveryPeek } from '../../ui/v2/discovery/DiscoveryPeek';
import { TaskCard } from '../../ui/v2/TaskCard';
import { sys } from '../../ui/system/tokens';
/** TaskCard is memoised; the test renderer holds the function it wraps. */
const CARD = (TaskCard as unknown as { type: React.ElementType }).type;

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; round-1 critique A5–A7, B8, B12). The map is under a list sheet; the
 * sheet is the list (no Lista/Mapa switch), starts where the pin coverage says, and is never reached by a gesture only.
 * My own tasks are not listed, and nothing says they are hidden. A pin opens its card over the map; a point several
 * tasks share opens as one place. Filters are a draft applied at once. Presentation only: the route's guards are
 * pinned by the route suites.
 */
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Beograd',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 44.8 + Number(id.length) / 100, lng: 20.4 + id.charCodeAt(0) / 1000 },
  ...patch } as unknown as MarketplaceItem);
const at = (lat: number, lng: number) => ({ priblizno: { lat, lng } });
let rows: MarketplaceItem[] = [], loading = false, refreshing = false, error = false, relations: { owned: ReadonlySet<string>; applied: ReadonlySet<string> } | undefined;
let relationsPending = false;
let snapshot: MarketplaceView, initial: MarketplaceView;
const open = jest.fn(), refresh = jest.fn(), newTask = jest.fn(), profile = jest.fn();
function Screen() {
  const [view, setView] = useState(initial); snapshot = view;
  return <DiscoveryPresentation items={rows} loading={loading} refreshing={refreshing} error={error} scopeKey="a:1" view={view} onView={setView}
    onOpen={open} onRefresh={refresh} onProfile={profile} onNew={newTask} relations={relations} relationsPending={relationsPending} />;
}
let tree: ReactTestRenderer;
const scrollToOffset = jest.fn();
// The list's ref is its native scroll view on a phone; here it is a stand-in that hears where the list is asked to scroll.
const render = async () => act(async () => { tree = create(<Screen />, { createNodeMock: element => element.type === 'List' ? { scrollToOffset } : null }); });
const update = async () => act(async () => tree.update(<Screen />));
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const pressable = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label });
const tap = async (label: string) => act(async () => press(label).props.onPress());
const action = (label: string | RegExp) => tree.root.findAllByType('Action' as React.ElementType)
  .find(node => typeof label === 'string' ? node.props.label === label : label.test(node.props.label))!;
const click = async (label: string | RegExp) => act(async () => action(label).props.onPress());
const texts = (root: ReactTestInstance = tree.root) => root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const map = () => tree.root.findByType('DiscoveryMap' as React.ElementType);
const sheets = () => tree.root.findAllByType(BottomSheet);
const listSheet = () => sheets().find(node => node.props.accessibilityLabel === 'Lista zadataka')!;
const peek = () => sheets().find(node => node.props.detached);
// The cards in the list (TaskCard says "Otvori priliku"). Since review r3 item 7 a place's rows say "Pogledaj zadatak",
// as the single card's action does, so this reads the list sheet alone and never counts a pin card's rows.
const cards = () => listSheet().findAll(node => String(node.type) === 'Press' && /^Otvori priliku /.test(node.props.accessibilityLabel ?? ''))
  .map(node => String(node.props.accessibilityLabel).replace('Otvori priliku Pomoć ', ''));
// Discovery V47: the search is a panel opened from the pill over the map. Its words are a draft that "Prikaži N zadataka"
// applies; the one green action is found by its label, which says the count (or that nothing is left).
const panel = () => tree.root.findAllByType('Modal' as React.ElementType);
const showAction = () => tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat|^Nema zadataka za ove uslove$/.test(node.props.label))!;
const radioOf = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label)[0];
const search = async (words: string) => {
  await tap('Pretraži zadatke');
  await act(async () => press('Pretraži mesta i zadatke').props.onChangeText(words));
  await act(async () => showAction().props.onPress());
};
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  initial = { ...initialMarketplaceView(), mode: 'map' }; loading = refreshing = error = mockReduced = relationsPending = false; mockFocused = true; relations = undefined;
  rows = [row('a'), row('bb'), row('ccc')];
  for (const fn of [open, refresh, newTask, profile, scrollToOffset]) fn.mockReset();
});
// The sheet's top line: the honest count, which is also the button that opens the list (Discovery V47).
const countLine = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'list-count')[0];
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('one screen: the map under the tools and the list as its sheet; no Lista/Mapa switch and no "Pogledaj listu"', async () => {
  await render();
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['a', 'bb', 'ccc']);
  for (const retired of ['Lista', 'Mapa', 'Pogledaj listu', 'Prikaz zadataka']) expect(pressable(retired)).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0);
  expect(listSheet().props).toMatchObject({ enablePanDownToClose: false, enableDynamicSizing: false });
  expect(cards()).toEqual(['a', 'bb', 'ccc']);
  // Discovery V47: the search over the map is one pill that says the search in two lines and opens the panel; the words
  // searched there narrow the list, and the chip under the count takes them away again, keeping everything else.
  expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Svi zadaci, Bilo kada · Dodaj uslove' });
  expect(tree.root.findAllByType('TextInput' as React.ElementType)).toHaveLength(0);
  await search('bb');
  expect(snapshot.query).toBe('bb'); expect(cards()).toEqual(['bb']); expect(panel()).toHaveLength(0);
  expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: '„bb“, Bilo kada · Dodaj uslove' });
  await tap('Ukloni filter: „bb“'); expect(snapshot.query).toBe(''); expect(cards()).toEqual(['a', 'bb', 'ccc']);
});

test('my own tasks are simply not listed, nothing says they are hidden, and a task I applied to says so', async () => {
  rows = [row('mine'), row('other'), row('applied'), row('remote', { priblizno: null })];
  relations = { owned: new Set(['mine']), applied: new Set(['applied']) };
  await render();
  expect(cards()).toEqual(['other', 'applied', 'remote']);
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['other', 'applied', 'remote']);
  expect(texts()).not.toMatch(/sakriven|Prikaži i moje|Sakrij moje|Tvoj zadatak/);
  expect(texts()).toContain('Prijava poslata');
  // The top line counts what is listed, and how many of those the map cannot show.
  expect(texts()).toContain('3 zadatka'); expect(texts()).toContain(' · 1 bez tačke na mapi');
});

test.each([
  ['six tasks, four without a pin', 6, 4, 1],
  ['six tasks, all on the map', 6, 0, 0],
  ['two tasks on the map', 2, 0, 1],
  ['three tasks, none on the map', 3, 3, 2],
])('the sheet starts by pin coverage: %s', async (_name, count, withoutPin, index) => {
  rows = Array.from({ length: count }, (_, i) => row(`t${i}`, i < withoutPin ? { priblizno: null } : at(44.7 + i / 50, 20.4)));
  await render();
  expect(listSheet().props.index).toBe(index);
});

test('while reading, the sheet is half open over breathing placeholders; the start is chosen once the read lands', async () => {
  loading = true; rows = []; await render();
  expect(listSheet().props.index).toBe(1); expect(texts()).toContain('Učitavamo zadatke…');
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
  loading = false; rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await update();
  expect(listSheet().props.index).toBe(0);
  // Chosen once: a later read does not move the sheet the person has placed.
  await act(async () => listSheet().props.onChange(1)); rows = [...rows]; await update();
  expect(listSheet().props.index).toBe(1);
});

// Discovery V47: the in-header "Prikaži listu" / "Prikaži mapu" words are gone. Nothing is still reached by a gesture
// only: the top line itself is the button that opens the list, and at the full height a floating "Mapa" brings the map.
test('the sheet\'s top line is the button that opens the list: from the top line to half, from half to the whole list', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(pressable('Prikaži listu')).toHaveLength(0); expect(pressable('Prikaži mapu')).toHaveLength(0);
  expect(listSheet().props.index).toBe(0);
  expect(countLine().props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: '6 zadataka', accessibilityHint: 'Otvara listu zadataka.' });
  // Centred, as the one line the top of the sheet says.
  expect(StyleSheet.flatten(countLine().findByType('T' as React.ElementType).props.style).textAlign).toBe('center');
  await act(async () => countLine().props.onPress()); expect(listSheet().props.index).toBe(1);
  expect(countLine().props.accessibilityHint).toBe('Otvara celu listu.');
  await act(async () => countLine().props.onPress()); expect(listSheet().props.index).toBe(2);
  // At the full height the count is words, not a button: the way back to the map is "Mapa".
  expect(countLine()).toBeUndefined(); expect(texts()).toContain('6 zadataka');
  // The map's `onList` still opens the whole list (the prop's contract; the map draws no button for it here).
  await act(async () => listSheet().props.onChange(0)); await act(async () => map().props.onList()); expect(listSheet().props.index).toBe(2);
});

test.each([[1, '1 zadatak'], [3, '3 zadatka'], [5, '5 zadataka'], [11, '11 zadataka'], [21, '21 zadatak'], [24, '24 zadatka']])(
  'the top line counts %i tasks in honest Serbian: "%s"', async (count, words) => {
    rows = Array.from({ length: count }, (_, i) => row(`t${i}`, at(44 + i / 100, 20.4))); await render();
    expect(countLine().props.accessibilityLabel).toBe(words);
  });

test('at the full height a floating dark-green "Mapa" lowers the list to its top line; it fades only when motion is allowed', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(pressable('Mapa')).toHaveLength(0);
  await act(async () => listSheet().props.onChange(2));
  const pill = press('Mapa');
  expect(pill.props).toMatchObject({ accessibilityRole: 'button', accessibilityHint: 'Spušta listu i prikazuje mapu.' });
  expect(StyleSheet.flatten(pill.props.style)).toMatchObject({ backgroundColor: sys.color.green, minHeight: 48 });
  expect(pill.findByType('MapTrifold' as React.ElementType).props.color).toBe(sys.color.onGreen);
  expect(StyleSheet.flatten(pill.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.onGreen);
  expect(pill.parent!.props.entering).toBeDefined();
  await tap('Mapa'); expect(listSheet().props.index).toBe(0); expect(pressable('Mapa')).toHaveLength(0);
  // Under reduced motion it is simply there, and simply gone.
  await act(async () => tree.unmount()); mockReduced = true; await render();
  await act(async () => listSheet().props.onChange(2));
  expect(press('Mapa').parent!.props.entering).toBeUndefined(); expect(press('Mapa').parent!.props.exiting).toBeUndefined();
  // A list with nothing on the map offers no way to a map that shows nothing.
  await act(async () => tree.unmount()); mockReduced = false; rows = [row('remote', { priblizno: null })]; await render();
  expect(listSheet().props.index).toBe(2); expect(pressable('Mapa')).toHaveLength(0);
});

// Discovery V47 (addendum 2, Airbnb's selected pin in USKOČI's look): one floating card over the map, just above the tab
// bar, with the list's top line stepped out of sight behind it. The WHOLE card opens the task; a round × in its corner, a
// tap on the empty map, a pull up of the list or Back close it, and closing brings the top line back.
test('a chosen pin opens one floating card whose whole face opens the task; ×, the empty map or a pull up close it and bring the top line back', async () => {
  const layOut = async () => act(async () => map().parent!.parent!.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOut();
  const top = listSheet().props.snapPoints[0];
  expect(top).toBeGreaterThan(HIDDEN);
  await act(async () => map().props.onSelect('t1'));
  expect(snapshot).toMatchObject({ selectedId: 't1', selectedPlace: null }); expect(listSheet().props.index).toBe(0);
  expect(map().props.selectedId).toBe('t1');
  expect(peek()!.props).toMatchObject({ detached: true, accessibilityLabel: 'Zadatak na mapi', bottomInset: sys.space.md, handleComponent: null });
  expect(peek()!.props.backdropComponent).toBeUndefined();
  // The list's top line is not a second strip under the card: it sinks behind it, and a screen reader does not reach it.
  expect(listSheet().props.snapPoints[0]).toBe(HIDDEN);
  const header = countLine().parent!;
  expect(header.props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  // No separate "Pogledaj zadatak" button: the whole card is the one press, named for what it opens.
  expect(tree.root.findAll(node => node.props.label === 'Pogledaj zadatak')).toHaveLength(0);
  const card = press('Otvori zadatak: Pomoć t1');
  expect(card.props.accessibilityRole).toBe('button');
  await act(async () => card.props.onPress()); expect(open).toHaveBeenCalledWith(rows[1]); expect(open.mock.calls[0][0].id).toBe('t1');
  // ×: the selection is cleared and the top line comes back.
  await tap('Zatvori pregled zadatka');
  expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
  expect(listSheet().props.snapPoints[0]).toBe(top);
  expect(countLine().parent!.props).toMatchObject({ accessibilityElementsHidden: false, importantForAccessibility: 'auto' });
  // A tap on the empty map closes it too.
  await act(async () => map().props.onSelect('t2')); expect(peek()).toBeDefined();
  await act(async () => map().props.onClear()); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
  // Pulling the list up is looking at the list: the card does not stay over it.
  await act(async () => map().props.onSelect('t0')); expect(peek()).toBeDefined();
  await act(async () => listSheet().props.onChange(1)); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
});

// Emulator, round 3c: a card inside a card. The floating card is the card; what it says sits in it bare. Owner decision
// (2026-09-24): no photos in the list, the map preview or any card; a task's photos appear only in the task itself.
test('the pin card says the task bare and honestly, with no photo; the list\'s cards keep their frame', async () => {
  rows = [row('a'), row('bb', { naslov: 'Selidba klavira u Zemunu', podrucjeTekst: 'Zemun, Beograd', osnovaCene: 'TOTAL', narucilacIme: 'Mila',
    narucilacOcena: '4,8', narucilacBrojOcena: 12, pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 0.33 },
    schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T10:00:00+02:00', endsAt: '2026-09-26T12:00:00+02:00' }, taskTimezone: 'Europe/Belgrade' }),
  row('ponude', { rezimCene: 'OFFERS', ponudjenaCena: undefined })];
  await render();
  await act(async () => map().props.onSelect('bb'));
  const card = press('Otvori zadatak: Selidba klavira u Zemunu');
  const words = texts(peek()!);
  expect(words).toContain('Selidba klavira u Zemunu'); expect(words).toContain('Zemun, Beograd · 26. sep · 10:00–12:00');
  expect(words).toContain('2.000 RSD'); expect(words).toContain('ukupno'); expect(words).toContain('Još 2 od 3 mesta'); expect(words).toContain('Mila');
  expect(card.props.accessibilityValue.text).toContain('2.000 RSD ukupno');
  // Nothing in it is framed as a card of its own, and nothing is a photo or a place for one.
  const edged = card.findAll(node => String(node.type) === 'View' && (StyleSheet.flatten(node.props.style)?.borderWidth ?? 0) > 0);
  expect(edged).toHaveLength(0);
  expect(peek()!.findAll(node => /Image|Photo/i.test(String(node.type)) || /photo|foto/i.test(String(node.props.testID ?? '')))).toHaveLength(0);
  expect(listSheet().findAll(node => /Image|Photo/i.test(String(node.type)))).toHaveLength(0);
  // A task that asks for offers says so in words that never look like an amount.
  await tap('Zatvori pregled zadatka'); await act(async () => map().props.onSelect('ponude'));
  expect(texts(peek()!)).toContain('Tražim ponude');
  // The list's cards keep their frame.
  const listed = listSheet().findAllByType(CARD);
  expect(listed.length).toBeGreaterThan(0); expect(listed.every(node => !node.props.bare)).toBe(true);
});

test('tasks on one public point are one place: its card says how many and each row opens its own task', async () => {
  rows = [row('s1', at(44.79, 20.45)), row('s2', at(44.7902, 20.4501)), row('other', at(44.9, 20.5))];
  await render();
  await act(async () => map().props.onSelect('s2'));
  expect(snapshot).toMatchObject({ selectedId: null, selectedPlace: '44.79,20.45' });
  expect(map().props.selectedPlace).toBe('44.79,20.45');
  expect(peek()!.props.accessibilityLabel).toBe('Zadaci na ovom mestu');
  expect(texts(peek()!)).toContain('2 zadatka na ovom mestu');
  // One verb for one action: each row says what the single card's action says (review r3 item 7).
  const inPeek = peek()!.findAll(node => String(node.type) === 'Press' && /^Pogledaj zadatak /.test(node.props.accessibilityLabel ?? ''));
  expect(inPeek.map(node => node.props.accessibilityLabel)).toEqual(['Pogledaj zadatak Pomoć s1', 'Pogledaj zadatak Pomoć s2']);
  expect(peek()!.findAll(node => /^Otvori priliku /.test(String(node.props.accessibilityLabel ?? '')))).toHaveLength(0);
  await act(async () => inPeek[1].props.onPress()); expect(open).toHaveBeenCalledWith(rows[1]);
  // The map's own place press lands on the same place; a place of one is just that task.
  await act(async () => map().props.onSelectPlace('44.90,20.50')); expect(snapshot).toMatchObject({ selectedId: 'other', selectedPlace: null });
});

test('a crowded place offers the whole set in the list instead of a scroll inside its card', async () => {
  rows = [...['p1', 'p2', 'p3', 'p4'].map(id => row(id, at(44.79, 20.45))), row('far', at(45.2, 19.8))];
  await render();
  await act(async () => map().props.onSelectPlace('44.79,20.45'));
  expect(texts(peek()!)).toContain('4 zadatka na ovom mestu');
  await click('Prikaži sve u listi');
  expect(snapshot.selectedPlace).toBeNull(); expect(listSheet().props.index).toBe(2);
  expect(cards()).toEqual(['p1', 'p2', 'p3', 'p4']);
  // It is an area like any other, and says so under the count, where it can be removed.
  await tap('Ukloni filter: Oblast sa mape'); expect(snapshot.area).toBeNull(); expect(cards()).toHaveLength(5);
});

describe('Pretraga i uslovi (Discovery V47)', () => {
  const flexible = (kind: string) => ({ schedule: { kind, startsAt: null, endsAt: null } });
  beforeEach(() => { rows = [row('danas', flexible('TODAY_FLEXIBLE')), row('sutra', flexible('TOMORROW_FLEXIBLE')),
    row('ponude', { rezimCene: 'OFFERS', ponudjenaCena: undefined, ...flexible('TOMORROW_FLEXIBLE') })]; });
  const radio = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label)[0];
  const choose = async (label: string) => act(async () => radio(label).props.onPress());
  const chip = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label
    && node.props.accessibilityState && 'selected' in node.props.accessibilityState)[0];

  test('a draft applied at once with "Prikaži N zadataka", which counts what the list will show', async () => {
    await render(); await tap('Uslovi pretrage');
    expect(panel()).toHaveLength(1);
    expect(showAction().props.label).toBe('Prikaži 3 zadatka');
    await choose('Sutra'); expect(showAction().props.label).toBe('Prikaži 2 zadatka');
    await tap('Cena'); await choose('Ponude'); expect(showAction().props.label).toBe('Prikaži 1 zadatak');
    expect(radio('Ponude').props.accessibilityState).toEqual({ checked: true });
    expect(snapshot.when).toBe('any'); // nothing applies before the person says so
    await act(async () => showAction().props.onPress());
    expect(snapshot).toMatchObject({ when: 'tomorrow', price: 'OFFERS' }); expect(cards()).toEqual(['ponude']);
    expect(panel()).toHaveLength(0);
    // "Uslovi pretrage" counts what is on, in green: the "+" beside it is the screen's one orange accent (review r3 item 6).
    expect(press('Uslovi pretrage, 2 aktivna')).toBeTruthy();
    const badge = press('Uslovi pretrage, 2 aktivna').findByProps({ testID: 'conditions-badge' });
    expect(StyleSheet.flatten(badge.props.style).backgroundColor).toBe(sys.color.green);
    expect(texts(badge)).toBe('2');
    // The pill says them, and each one that is on is a chosen quick chip that takes itself away.
    expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Svi zadaci, Sutra · Ponude' });
    expect(chip('Sutra').props.accessibilityState).toEqual({ selected: true });
    await act(async () => chip('Sutra').props.onPress()); expect(snapshot.when).toBe('any');
    await act(async () => chip('Ponude').props.onPress()); expect(snapshot.price).toBe('all'); expect(cards()).toHaveLength(3);
    expect(press('Uslovi pretrage')).toBeTruthy();
  });
  test('closing the panel any other way leaves the list exactly as it was; "Obriši sve" empties the draft', async () => {
    await render(); await tap('Uslovi pretrage');
    await choose('Danas'); await act(async () => press('Povećaj broj osoba').props.onPress());
    await tap('Zatvori pretragu');
    expect(panel()).toHaveLength(0);
    expect(snapshot).toMatchObject({ when: 'any', places: 1, price: 'all' });
    await tap('Uslovi pretrage');
    expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true }); // the discarded draft is gone
    await choose('Danas'); await tap('Cena'); await choose('Moja cena');
    await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Obriši sve')!.props.onPress());
    expect(radio('Sve').props.accessibilityState).toEqual({ checked: true });
    await tap('Kada'); expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true });
    expect(showAction().props.label).toBe('Prikaži 3 zadatka');
  });
  test('"Kako se radi" is offered only when a task says how it is done, in the panel and as quick chips', async () => {
    await render(); await tap('Uslovi pretrage');
    expect(texts()).not.toContain('Kako se radi'); expect(texts()).toContain('Kada?'); expect(texts()).toContain('Koliko vas dolazi');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Onlajn')).toHaveLength(0);
    await tap('Zatvori pretragu'); await act(async () => tree.unmount());
    rows = [...rows, row('daljina', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } })];
    await render(); await tap('Uslovi pretrage');
    expect(texts()).toContain('Kako se radi');
    await tap('Kako se radi'); await choose('Onlajn'); expect(showAction().props.label).toBe('Prikaži 1 zadatak');
    await tap('Zatvori pretragu');
    expect(chip('Onlajn').props.accessibilityState).toEqual({ selected: false });
  });
  // Discovery V47: the chips over the map toggle the very filters the panel sets, at once, and only those the loaded tasks
  // can back (a task that says how it is done; a price mode some task uses; a task with two open places).
  test('a quick chip toggles the same filter the panel sets, and only chips the tasks can back are offered', async () => {
    await render();
    const offered = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityState && 'selected' in node.props.accessibilityState
      && !/^Uslovi|^Dodaj/.test(node.props.accessibilityLabel)).map(node => node.props.accessibilityLabel);
    expect(offered()).toEqual(['Danas', 'Sutra', 'Ove nedelje', 'Moja cena', 'Ponude', '2+ mesta']);
    await act(async () => chip('Danas').props.onPress());
    expect(snapshot.when).toBe('today'); expect(cards()).toEqual(['danas']);
    await tap('Uslovi pretrage, 1 aktivan');
    expect(radio('Danas').props.accessibilityState).toEqual({ checked: true });
    // The panel's choice shows on the chip the same way.
    await choose('Sutra'); await act(async () => showAction().props.onPress());
    expect(chip('Sutra').props.accessibilityState).toEqual({ selected: true }); expect(chip('Danas').props.accessibilityState).toEqual({ selected: false });
    await act(async () => chip('2+ mesta').props.onPress()); expect(snapshot.places).toBe(2);
    await act(async () => chip('2+ mesta').props.onPress()); expect(snapshot.places).toBe(1);
    // The choice the panel can make beyond two people is said on the same chip, and removed by it.
    await tap('Uslovi pretrage, 1 aktivan'); await tap('Koliko vas dolazi');
    for (const _ of [1, 2]) await act(async () => press('Povećaj broj osoba').props.onPress());
    await act(async () => showAction().props.onPress());
    expect(snapshot.places).toBe(3); expect(chip('3+ mesta').props.accessibilityState).toEqual({ selected: true });
  });
  test('a place chosen in "Gde" is said by the pill and under the count, and taken away there', async () => {
    rows = [row('a', { podrucjeTekst: 'Liman, Novi Sad' }), row('b', { podrucjeTekst: 'Vračar, Beograd' })];
    await render(); await tap('Pretraži zadatke');
    await choose('Vračar, Beograd, 1 zadatak'); await act(async () => showAction().props.onPress());
    expect(snapshot.place).toBe('Vračar, Beograd'); expect(cards()).toEqual(['b']);
    expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Vračar, Beograd, Bilo kada · Dodaj uslove' });
    await tap('Ukloni filter: Vračar, Beograd'); expect(snapshot.place).toBeNull(); expect(cards()).toEqual(['a', 'b']);
  });
});

test('"Dodaj zadatak" is the chrome\'s icon button with an orange glyph on white, and keeps its route command', async () => {
  await render();
  const add = press('Dodaj zadatak');
  // Review r3 item 2: this pinned `orangeEdge` (2.97:1 on white, under the 3:1 a control's only glyph needs); the glyph
  // is now the orange that reads, `orangeInk`. Still an orange glyph on white, never an orange fill.
  expect(add.findByType('Plus' as React.ElementType).props.color).toBe(sys.color.orangeInk);
  expect(StyleSheet.flatten(add.findByProps({ testID: 'chrome-circle' }).props.style).backgroundColor).toBe(sys.color.surface);
  await act(async () => add.props.onPress()); expect(newTask).toHaveBeenCalledTimes(1);
});

test('reading, not read and nothing in this view keep their meanings, through the one state view', async () => {
  error = true; rows = []; await render();
  expect(texts()).toContain('Zadatke trenutno nije moguće učitati'); await click('Pokušaj ponovo'); expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  error = false; rows = []; await render();
  expect(texts()).toContain('Trenutno nema otvorenih zadataka'); await click('Dopuni radni profil'); expect(profile).toHaveBeenCalledTimes(1);
  await act(async () => tree.unmount());
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(listSheet().props.index).toBe(0);
  // Words that find nothing: the panel's one action says so and cannot apply them; the list keeps what it had.
  await tap('Pretraži zadatke'); await act(async () => press('Pretraži mesta i zadatke').props.onChangeText('nema takvog'));
  expect(showAction().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
  await tap('Zatvori pretragu'); expect(snapshot.query).toBe('');
  // A list that is already empty under its search (a search kept from before) rises so the reason is seen.
  await act(async () => tree.unmount()); initial = { ...initial, query: 'nema takvog' }; await render();
  expect(texts()).toContain('Nema zadataka u ovom prikazu'); expect(listSheet().props.index).toBe(1);
  await click('Poništi filtere'); expect(snapshot.query).toBe(''); expect(cards()).toHaveLength(6);
});

test('pull to refresh is the list\'s own; the list follows the area the map hands up, and its chip takes it away', async () => {
  refreshing = true; await render();
  const list = tree.root.findByType('List' as React.ElementType);
  expect(list.props.refreshing).toBe(true);
  await act(async () => list.props.onRefresh()); expect(refresh).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži ovu oblast' })).toHaveLength(0);
  await act(async () => map().props.onArea([20, 44, 21, 45])); expect(snapshot.area).toEqual([20, 44, 21, 45]);
  await tap('Ukloni filter: Oblast sa mape'); expect(snapshot.area).toBeNull();
});

// Discovery V47: the list follows the map, and the map keeps every pin whatever the area. A task with no public point
// (online work, or a task placed nowhere) is never lost to an area: it follows the area's own tasks under its own quiet
// heading, and the top line says both counts honestly. No coordinate is invented for it.
test('under a map area the list holds the area\'s tasks, then those without a point under "Bez tačke na mapi"; the count says both', async () => {
  rows = [row('in1', at(44.81, 20.41)), row('far', at(45.5, 19.5)), row('online', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }),
    row('in2', at(44.82, 20.42)), row('nowhere', { priblizno: null })];
  await render();
  expect(cards()).toEqual(['in1', 'far', 'online', 'in2', 'nowhere']);
  expect(countLine().props.accessibilityLabel).toBe('5 zadataka · 2 bez tačke na mapi');
  expect(tree.root.findAll(node => node.props.testID === 'section-without-point')).toHaveLength(0);
  await act(async () => map().props.onArea([20.3, 44.7, 20.5, 44.9]));
  expect(cards()).toEqual(['in1', 'in2', 'online', 'nowhere']);
  const heading = tree.root.findAll(node => node.props.testID === 'section-without-point');
  expect(heading).toHaveLength(1);
  expect(heading[0].props).toMatchObject({ accessibilityRole: 'header', accessibilityLabel: 'Bez tačke na mapi, 2 zadatka' });
  expect(texts(heading[0])).toBe('Bez tačke na mapi 2');
  // The heading stands right before the first task without a point.
  const order = listSheet().findAll(node => node.props.testID === 'section-without-point'
    || (String(node.type) === 'Press' && /^Otvori priliku /.test(node.props.accessibilityLabel ?? ''))).map(node => node.props.testID ?? node.props.accessibilityLabel);
  expect(order).toEqual(['Otvori priliku Pomoć in1', 'Otvori priliku Pomoć in2', 'section-without-point', 'Otvori priliku Pomoć online', 'Otvori priliku Pomoć nowhere']);
  expect(countLine().props.accessibilityLabel).toBe('2 zadatka u oblasti + 2 bez tačke');
  // The map keeps every pin: moving it never takes one away.
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['in1', 'far', 'online', 'in2', 'nowhere']);
  // An area with none of its own still keeps the tasks without a point, and says so.
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  expect(cards()).toEqual(['online', 'nowhere']); expect(countLine().props.accessibilityLabel).toBe('Nema zadataka u oblasti + 2 bez tačke');
  // "Prikaži N zadataka" counts the same list.
  await tap('Uslovi pretrage');
  expect(showAction().props.label).toBe('Prikaži 2 zadatka');
});

test('an area that holds nothing says so and offers every task back; the sheet the person placed stays where it is', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(listSheet().props.index).toBe(0);
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  // Moving the map never moves the sheet: the reason is on the top line itself.
  expect(listSheet().props.index).toBe(0); expect(countLine().props.accessibilityLabel).toBe('Nema zadataka u oblasti');
  expect(texts()).toContain('Nema zadataka u ovoj oblasti');
  await click('Prikaži sve zadatke'); expect(snapshot.area).toBeNull(); expect(cards()).toHaveLength(6);
});

test('a chosen pin is never dropped when the list follows the map, and the same area twice changes nothing', async () => {
  await render();
  await act(async () => map().props.onSelect('bb'));
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  expect(snapshot).toMatchObject({ selectedId: 'bb', area: [0, 0, 1, 1] }); expect(peek()).toBeDefined();
  const before = snapshot;
  await act(async () => map().props.onArea([0, 0, 1, 1])); expect(snapshot).toBe(before);
});

test('choosing a place in the search brings its pins into view once, as the camera\'s own move, and never sets the area', async () => {
  rows = [row('ns1', { podrucjeTekst: 'Liman, Novi Sad', ...at(45.24, 19.84) }), row('ns2', { podrucjeTekst: 'Liman, Novi Sad', ...at(45.25, 19.85) }),
    row('bg', { podrucjeTekst: 'Vračar, Beograd', ...at(44.8, 20.47) })];
  initial = { ...initial, area: [20.4, 44.7, 20.6, 44.9] };
  await render();
  expect(map().props.fitTo).toBeNull();
  await tap('Pretraži zadatke'); await act(async () => radioOf('Liman, Novi Sad, 2 zadatka').props.onPress());
  await act(async () => showAction().props.onPress());
  expect(snapshot).toMatchObject({ place: 'Liman, Novi Sad', area: null });
  expect(map().props.fitTo).toMatchObject({ key: 1, bounds: [19.82, 45.22, 19.87, 45.27] });
  // The map says it brought them into view; the request is then gone, so a map mounted again does not fly there again.
  await act(async () => map().props.onFitted(1)); expect(map().props.fitTo).toBeNull();
  // Applying the same place again does not fly the map again.
  await tap('Pretraži zadatke'); await act(async () => showAction().props.onPress()); expect(map().props.fitTo).toBeNull();
});

// Discovery V47: where the sheet rests, how far the list is scrolled and where the camera stands live in the route's view
// (in memory), so a return to Zadaci finds all three as they were.
test('where the sheet rests and how far the list is scrolled are kept in the route\'s view and found again', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 12 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
    expect(snapshot.sheet).toBe('peek');
    await act(async () => listSheet().props.onChange(2)); expect(snapshot.sheet).toBe('full');
    const list = () => tree.root.findByType('List' as React.ElementType);
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 640 } } }));
    expect(snapshot.listOffset).toBeUndefined();
    await act(async () => { jest.advanceTimersByTime(OFFSET_SETTLE_MS); });
    expect(snapshot.listOffset).toBe(640);
    // The screen is drawn again from the view it left (the camera was already kept there).
    const kept = snapshot; await act(async () => tree.unmount()); initial = kept; scrollToOffset.mockReset(); await render();
    expect(listSheet().props.index).toBe(2);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: false });
    // A list read anew (it was empty while it read) is scrolled back where it was once it has rows again.
    scrollToOffset.mockReset(); loading = true; await update(); loading = false; await update();
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: false });
    // A new search starts the list at its top.
    scrollToOffset.mockReset(); await act(async () => map().props.onArea([20.3, 44.6, 20.5, 45]));
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false }); expect(snapshot.listOffset).toBe(0);
  } finally { jest.useRealTimers(); }
});

test('at the full height a scrolled list folds the quick chips away; the search pill stays', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
    const chips = () => tree.root.findAllByProps({ accessibilityLabel: 'Brzi filteri' });
    const list = () => tree.root.findByType('List' as React.ElementType);
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }));
    expect(chips()).toHaveLength(1); // not at the full height
    await act(async () => listSheet().props.onChange(2));
    expect(chips()).toHaveLength(0); expect(press('Pretraži zadatke')).toBeTruthy();
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } }));
    expect(chips()).toHaveLength(1);
  } finally { jest.useRealTimers(); }
});

// Review r3 item 4: a list whose tasks all lack a pin must be seen, not left under a top line over an empty map.
test('when a search or filter leaves only tasks without a point on the map, the list rises to the whole screen', async () => {
  rows = [...Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))), row('prevod', { priblizno: null })];
  await render();
  expect(listSheet().props.index).toBe(0);
  await search('prevod');
  expect(cards()).toEqual(['prevod']);
  expect(listSheet().props.index).toBe(2);
  // A sheet the person has placed elsewhere is left where it is.
  await tap('Ukloni filter: „prevod“'); await act(async () => listSheet().props.onChange(1));
  await search('prevod'); expect(listSheet().props.index).toBe(1);
});

// Review r3 item 9: until the list knows which tasks are mine it cannot leave them out, so it says no count yet.
test('while it is still read which tasks are mine, the list says no count and does not yet choose where the sheet starts', async () => {
  rows = Array.from({ length: 5 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); relationsPending = true;
  await render();
  expect(texts()).not.toMatch(/\d+ zadat|bez tačke/); expect(listSheet().props.index).toBe(1);
  // Two of the five were mine: three are listed, and three or fewer start half open (five would have started at the top line).
  relations = { owned: new Set(['t0', 't1']), applied: new Set() }; relationsPending = false; await update();
  expect(texts()).toContain('3 zadatka'); expect(listSheet().props.index).toBe(1);
  // A failed read is not pending: the list counts what it shows.
  await act(async () => tree.unmount()); relations = undefined; await render();
  expect(texts()).toContain('5 zadataka');
});

// Review r3 item 3: the first fit of the pins keeps them above where the sheet starts.
test('the map is told where the sheet starts, so the first fit keeps the pins above it', async () => {
  const layOut = async () => act(async () => map().parent!.parent!.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOut();
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[0] + sys.space.md);
  await act(async () => tree.unmount());
  rows = rows.slice(0, 3); await render(); await layOut();
  expect(listSheet().props.index).toBe(1);
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[1] + sys.space.md);
  expect(map().props.fitBottom).toBeGreaterThan(listSheet().props.snapPoints[0] + sys.space.md);
});

// Review r3b: the map fits its pins once, when it mounts. A mount before the labels land would fit my own tasks for a
// sheet start the sheet then does not take, so its first mount waits exactly as the sheet's start does.
test('the map\'s first mount waits for what is mine, then fits only what is listed above where the sheet starts', async () => {
  rows = Array.from({ length: 5 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); relationsPending = true;
  await render();
  const body = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function'
    && JSON.stringify(StyleSheet.flatten(node.props.style)) === JSON.stringify({ flex: 1 }))[0];
  await act(async () => body.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
  relations = { owned: new Set(['t0', 't1']), applied: new Set() }; relationsPending = false; await update();
  expect(map().props.items).toHaveLength(3);
  expect(listSheet().props.index).toBe(1);
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[1] + sys.space.md);
  // A later read of the labels (a new list) does not take the map away again.
  relationsPending = true; await update();
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(1);
});

// Review r3 item 11: a chosen pin's card rests where the zoom and the credits ride, so they step up above it. Discovery
// V47: the card sits just above the tab bar (its gap under it counts) and spans its whole face, padding included.
test('a chosen pin\'s card tells the map how much it covers, and closing it gives that back', async () => {
  await render();
  expect(map().props.coverBottom).toBe(0);
  await act(async () => map().props.onSelect('bb'));
  const card = tree.root.findByType(DiscoveryPeek);
  const whole = card.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function' && node.props.onLayout.name === 'measureCard');
  expect(whole).toHaveLength(1);
  await act(async () => whole[0].props.onLayout({ nativeEvent: { layout: { height: 200 } } }));
  expect(map().props.coverBottom).toBe(200 + sys.space.md + sys.space.md);
  await tap('Zatvori pregled zadatka'); expect(peek()).toBeUndefined(); expect(map().props.coverBottom).toBe(0);
  // A place's rows sit in the card's padding, which is added to them.
  rows = [row('s1', at(44.79, 20.45)), row('s2', at(44.79, 20.45))]; await act(async () => tree.unmount()); await render();
  await act(async () => map().props.onSelectPlace('44.79,20.45'));
  const content = tree.root.findByType(DiscoveryPeek).findAll(node => String(node.type) === 'View' && node.props.onLayout?.name === 'measureRows');
  await act(async () => content[0].props.onLayout({ nativeEvent: { layout: { height: 150 } } }));
  expect(map().props.coverBottom).toBe(2 * sys.space.base + 150 + sys.space.md + sys.space.md);
  await tap('Zatvori pregled zadataka'); expect(peek()).toBeUndefined();
});
