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
import { DiscoveryPresentation } from '../../ui/v2/DiscoveryPresentation';
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
const render = async () => act(async () => { tree = create(<Screen />); });
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
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  initial = { ...initialMarketplaceView(), mode: 'map' }; loading = refreshing = error = mockReduced = relationsPending = false; mockFocused = true; relations = undefined;
  rows = [row('a'), row('bb'), row('ccc')];
  for (const fn of [open, refresh, newTask, profile]) fn.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('one screen: the map under the tools and the list as its sheet; no Lista/Mapa switch and no "Pogledaj listu"', async () => {
  await render();
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['a', 'bb', 'ccc']);
  for (const retired of ['Lista', 'Mapa', 'Pogledaj listu', 'Prikaz zadataka']) expect(pressable(retired)).toHaveLength(0);
  expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0);
  expect(listSheet().props).toMatchObject({ enablePanDownToClose: false, enableDynamicSizing: false });
  expect(cards()).toEqual(['a', 'bb', 'ccc']);
  // Search stays over the map; clearing it keeps everything else.
  await act(async () => press('Pretraži zadatke').props.onChangeText('bb'));
  expect(snapshot.query).toBe('bb'); expect(cards()).toEqual(['bb']);
  await tap('Obriši pretragu'); expect(snapshot.query).toBe(''); expect(cards()).toEqual(['a', 'bb', 'ccc']);
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

test('"Prikaži listu" and "Prikaži mapu" move the sheet, so nothing is reached by a gesture only', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  // Its words are the system's quiet copy in the action green (review r3 item 5), not a size of their own.
  expect(StyleSheet.flatten(press('Prikaži listu').findByType('T' as React.ElementType).props.style))
    .toEqual({ ...sys.type.copy, fontWeight: '600', color: sys.color.green });
  await tap('Prikaži listu'); expect(listSheet().props.index).toBe(2);
  await tap('Prikaži mapu'); expect(listSheet().props.index).toBe(0);
  // The map's `onList` still opens the whole list. The map draws no "Pogledaj listu" of its own here (with `sheetTop`
  // passed, the sheet's top line already offers the list), so this is the prop's contract, not a second button.
  await act(async () => map().props.onList()); expect(listSheet().props.index).toBe(2);
});

test('a chosen pin rests the list at its top line and opens its card with one green "Pogledaj zadatak"; X, Back or a pull up close it', async () => {
  await render();
  await act(async () => map().props.onSelect('bb'));
  expect(snapshot).toMatchObject({ selectedId: 'bb', selectedPlace: null }); expect(listSheet().props.index).toBe(0);
  expect(map().props.selectedId).toBe('bb');
  expect(peek()!.props).toMatchObject({ detached: true, accessibilityLabel: 'Zadatak na mapi' });
  expect(peek()!.props.backdropComponent).toBeUndefined();
  expect(texts(peek()!)).toContain('Pomoć bb');
  await click('Pogledaj zadatak'); expect(open).toHaveBeenCalledWith(rows[1]);
  expect(action('Pogledaj zadatak').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: sys.color.green })]));
  await tap('Zatvori pregled'); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
  // Pulling the list up is looking at the list: the card does not stay over it.
  await act(async () => map().props.onSelect('a')); expect(peek()).toBeDefined();
  await act(async () => listSheet().props.onChange(1)); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
});

// Emulator, round 3c: the pin's card showed the task card INSIDE the sheet with its own edge and corner, a card inside a
// card. The sheet is the card; the task's face sits in it bare, and keeps its one press and what it says.
test('a chosen pin\'s card is the sheet itself: the task\'s face sits in it bare, with its one press and its words', async () => {
  await render();
  await act(async () => map().props.onSelect('bb'));
  const face = peek()!.findByType(CARD);
  expect(face.props.bare).toBe(true);
  const edged = face.findAll(node => String(node.type) === 'View' && (StyleSheet.flatten(node.props.style)?.borderWidth ?? 0) > 0);
  expect(edged).toHaveLength(0);
  const opens = peek()!.findAll(node => String(node.type) === 'Press' && /^Otvori priliku /.test(node.props.accessibilityLabel ?? ''));
  expect(opens.map(node => node.props.accessibilityLabel)).toEqual(['Otvori priliku Pomoć bb']);
  expect(opens[0].props.accessibilityValue.text).toContain('2.000 RSD');
  await act(async () => opens[0].props.onPress()); expect(open).toHaveBeenCalledWith(rows[1]);
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

describe('Filteri', () => {
  const flexible = (kind: string) => ({ schedule: { kind, startsAt: null, endsAt: null } });
  beforeEach(() => { rows = [row('danas', flexible('TODAY_FLEXIBLE')), row('sutra', flexible('TOMORROW_FLEXIBLE')),
    row('ponude', { rezimCene: 'OFFERS', ponudjenaCena: undefined, ...flexible('TOMORROW_FLEXIBLE') })]; });
  const radio = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label)[0];
  const choose = async (label: string) => act(async () => radio(label).props.onPress());
  const show = () => action(/^Prikaži \d+ zadat/);

  test('a draft applied at once with "Prikaži N zadataka", which counts what the list will show', async () => {
    await render(); await tap('Filteri');
    expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(1);
    expect(show().props.label).toBe('Prikaži 3 zadatka');
    await choose('Sutra'); expect(show().props.label).toBe('Prikaži 2 zadatka');
    await choose('Tražim ponude'); expect(show().props.label).toBe('Prikaži 1 zadatak');
    expect(radio('Sutra').props.accessibilityState).toEqual({ checked: true });
    expect(snapshot.when).toBe('any'); // nothing applies before the person says so
    await act(async () => show().props.onPress());
    expect(snapshot).toMatchObject({ when: 'tomorrow', price: 'OFFERS' }); expect(cards()).toEqual(['ponude']);
    expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
    expect(press('Filteri, aktivni')).toBeTruthy();
    // Its dot is green: the "+" beside it is the screen's one orange accent (review r3 item 6).
    const dots = press('Filteri, aktivni').findAll(node => String(node.type) === 'View' && StyleSheet.flatten(node.props.style)?.width === 10);
    expect(dots).toHaveLength(1); expect(StyleSheet.flatten(dots[0].props.style).backgroundColor).toBe(sys.color.green);
    // Each filter that is on says itself under the count and removes itself.
    await tap('Ukloni filter: Sutra'); expect(snapshot.when).toBe('any');
    await tap('Ukloni filter: Tražim ponude'); expect(snapshot.price).toBe('all'); expect(cards()).toHaveLength(3);
  });
  test('closing the sheet any other way leaves the list exactly as it was; "Poništi" empties the draft', async () => {
    await render(); await tap('Filteri');
    await choose('Danas'); await choose('2 ili više');
    await tap('Zatvori filtere');
    expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
    expect(snapshot).toMatchObject({ when: 'any', places: 'any', price: 'all' });
    await tap('Filteri');
    expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true }); // the discarded draft is gone
    await choose('Danas'); await choose('Navedena cena');
    await click('Poništi');
    expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true }); expect(radio('Sve').props.accessibilityState).toEqual({ checked: true });
    expect(show().props.label).toBe('Prikaži 3 zadatka');
  });
  test('"Gde se radi" is offered only when a task says how it is done', async () => {
    await render(); await tap('Filteri');
    expect(texts()).not.toContain('Gde se radi'); expect(texts()).toContain('Kada'); expect(texts()).toContain('Slobodna mesta');
    await tap('Zatvori filtere'); await act(async () => tree.unmount());
    rows = [...rows, row('daljina', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } })];
    await render(); await tap('Filteri');
    expect(texts()).toContain('Gde se radi');
    await choose('Na daljinu'); expect(show().props.label).toBe('Prikaži 1 zadatak');
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
  await act(async () => press('Pretraži zadatke').props.onChangeText('nema takvog'));
  // A sheet resting at its top line rises so the reason is seen.
  expect(texts()).toContain('Nema zadataka u ovom prikazu'); expect(listSheet().props.index).toBe(1);
  await click('Poništi filtere'); expect(snapshot.query).toBe(''); expect(cards()).toHaveLength(6);
});

test('pull to refresh is the list\'s own; "Pretraži ovu oblast" applies the area and waits while a read runs', async () => {
  refreshing = true; await render();
  const list = tree.root.findByType('List' as React.ElementType);
  expect(list.props.refreshing).toBe(true);
  await act(async () => list.props.onRefresh()); expect(refresh).toHaveBeenCalledTimes(1);
  expect(map().props.busy).toBe(true);
  await act(async () => map().props.onSearchArea([20, 44, 21, 45])); expect(snapshot.area).toEqual([20, 44, 21, 45]);
  expect(press('Ukloni filter: Oblast sa mape')).toBeTruthy();
});

// Review r3 item 4: a list whose tasks all lack a pin must be seen, not left under a top line over an empty map.
test('when a search or filter leaves only tasks without a point on the map, the list rises to the whole screen', async () => {
  rows = [...Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))), row('prevod', { priblizno: null })];
  await render();
  expect(listSheet().props.index).toBe(0);
  await act(async () => press('Pretraži zadatke').props.onChangeText('prevod'));
  expect(cards()).toEqual(['prevod']);
  expect(listSheet().props.index).toBe(2);
  // A sheet the person has placed elsewhere is left where it is.
  await act(async () => press('Pretraži zadatke').props.onChangeText('')); await act(async () => listSheet().props.onChange(1));
  await act(async () => press('Pretraži zadatke').props.onChangeText('prevod')); expect(listSheet().props.index).toBe(1);
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

// Review r3 item 11: a chosen pin's card rests where the zoom and the credits ride, so they step up above it.
test('a chosen pin\'s card tells the map how much it covers, and closing it gives that back', async () => {
  await render();
  expect(map().props.coverBottom).toBe(0);
  await act(async () => map().props.onSelect('bb'));
  const card = tree.root.findByType(DiscoveryPeek);
  // The card measures its content; the PeekSheet's 20 px handle and `base` padding are added to it.
  const content = card.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function' && node.props.onLayout.name === 'measure');
  expect(content).toHaveLength(1);
  await act(async () => content[0].props.onLayout({ nativeEvent: { layout: { height: 200 } } }));
  expect(map().props.coverBottom).toBe(20 + sys.space.base + 200 + sys.space.md);
  await tap('Zatvori pregled'); expect(peek()).toBeUndefined(); expect(map().props.coverBottom).toBe(0);
});
