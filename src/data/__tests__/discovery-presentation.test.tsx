import React, { useState } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import BottomSheet from '@gorhom/bottom-sheet';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import { taskRelationIndex, type TaskRelationIndex } from '../taskRelation';
let mockReduced = false, mockFocused = true;
const mockNearbyPermission = jest.fn(), mockNearbyWatch = jest.fn();
jest.mock('../../ui/v2/discovery/nearbyLocation', () => ({ loadNearbyLocation: async () => ({ Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: () => mockNearbyPermission(), hasServicesEnabledAsync: async () => true,
  watchPositionAsync: (...args: unknown[]) => mockNearbyWatch(...args) }) }));
// The window: React Native's Jest default (a 2× text size, so "large text") unless a test says otherwise.
let mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  const List = ({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ...props }: any) => React.createElement('List', props,
    ListHeaderComponent,
    data.length ? data.map((item: any, index: number) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item, index }))) : ListEmptyComponent);
  // One stable function: a new one on every read would be a new component type, and React would mount the sheet again.
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const Keyboard = { dismiss: () => undefined };
  const useWindowDimensions = () => mockWindow;
  return new Proxy(native, { get(target, key) {
    if (key === 'FlatList') return List;
    if (key === 'Modal') return Modal;
    if (key === 'Keyboard') return Keyboard;
    if (key === 'useWindowDimensions') return useWindowDimensions;
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
jest.mock('../../ui/v2/TaskPublisherPortrait', () => ({ TaskPublisherPortrait: 'TaskPublisherPortrait' }));
import { AREA_ANNOUNCE_MS, DiscoveryPresentation, HIDDEN, OFFSET_SETTLE_MS } from '../../ui/v2/DiscoveryPresentation';
import { DiscoveryPeek } from '../../ui/v2/discovery/DiscoveryPeek';
import { DiscoverySearchBar } from '../../ui/v2/discovery/DiscoverySearchBar';
import { ActionSheet } from '../../ui/system/ActionSheet';
import { TaskCard } from '../../ui/v2/TaskCard';
import { sys } from '../../ui/system/tokens';
/** TaskCard is memoised; the test renderer holds the function it wraps. */
const CARD = (TaskCard as unknown as { type: React.ElementType }).type;

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; round-1 critique A5–A7, B8, B12). The map is under a list sheet; the
 * sheet is the list (no Lista/Mapa switch), starts where the pin coverage says, and is never reached by a gesture only.
 * Own tasks are distinctly labeled without changing public visibility/counts. A pin opens its card over the map; a point several
 * tasks share opens as one place. Filters are a draft applied at once. Presentation only: the route's guards are
 * pinned by the route suites.
 */
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Beograd',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 44.8 + Number(id.length) / 100, lng: 20.4 + id.charCodeAt(0) / 1000 },
  ...patch } as unknown as MarketplaceItem);
const at = (lat: number, lng: number) => ({ priblizno: { lat, lng } });
let rows: MarketplaceItem[] = [], loading = false, refreshing = false, error = false, relations: TaskRelationIndex | undefined;
let relationsPending = false, relationsError = false;
const relationIndex = (own: string[], applied: string[] = [], covered = rows.map(item => item.id)) => taskRelationIndex([
  ...own.map(needId => ({ needId, relation: 'OWNER' })),
  ...applied.map(needId => ({ needId, relation: 'APPLIED', applicationId: `application-${needId}`, applicationState: 'SUBMITTED' })),
], covered);
let snapshot: MarketplaceView, initial: MarketplaceView;
/** Set once a task is opened: like the route, the screen then takes no more changes of its view (it is not in front). */
let navigated = false;
const open = jest.fn(), refresh = jest.fn(), newTask = jest.fn(), profile = jest.fn();
function Screen() {
  const [view, setView] = useState(initial); snapshot = view;
  return <DiscoveryPresentation items={rows} loading={loading} refreshing={refreshing} error={error} scopeKey="a:1" view={view}
    onView={next => { if (!navigated) setView(next); }}
    onOpen={open} onRefresh={refresh} onProfile={profile} onNew={newTask} relations={relations} relationsPending={relationsPending} relationsError={relationsError} />;
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
const listSheet = () => sheets().find(node => !node.props.detached)!;
const peek = () => sheets().find(node => node.props.detached);
// The cards in the list (TaskCard says "Otvori priliku"). Since review r3 item 7 a place's rows say "Pogledaj zadatak",
// as the single card's action does, so this reads the list sheet alone and never counts a pin card's rows.
const cards = () => listSheet().findAll(node => String(node.type) === 'Press' && /^Otvori (?:priliku|Zadatak) /.test(node.props.accessibilityLabel ?? ''))
  .map(node => String(node.props.accessibilityLabel).replace(/^Otvori (?:priliku|Zadatak) Pomoć /, ''));
// Discovery V47: the search is a panel opened from the pill over the map. Its words are a draft that "Prikaži N zadataka"
// applies; the one green action is found by its label, which says the count (or that nothing is left).
const panel = () => tree.root.findAllByType('Modal' as React.ElementType);
const list = () => tree.root.findByType('List' as React.ElementType);
/** The body under the chrome, laid out: the sheet's heights become numbers. */
const layOutBody = async (height = 800) => act(async () => map().parent!.parent!.props.onLayout({ nativeEvent: { layout: { height } } }));
/** A quick chip over the map (a toggle, spoken as selected or not). */
const quick = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label
  && node.props.accessibilityState && 'selected' in node.props.accessibilityState)[0];
const removable = () => tree.root.findAll(node => /^Ukloni /.test(String(node.props.accessibilityLabel ?? '')));
const tomorrowFlexible = { schedule: { kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null } };
const showAction = () => tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat|^Nema zadataka za ove uslove$/.test(node.props.label))!;
const radioOf = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label)[0];
const search = async (words: string) => {
  await tap('Pretraži zadatke');
  await act(async () => press('Pretraži mesta i zadatke').props.onChangeText(words));
  await act(async () => showAction().props.onPress());
};
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  initial = { ...initialMarketplaceView(), mode: 'map' }; loading = refreshing = error = mockReduced = relationsPending = relationsError = navigated = false; mockFocused = true; relations = undefined;
  mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
  rows = [row('a'), row('bb'), row('ccc')];
  for (const fn of [open, refresh, newTask, profile, scrollToOffset]) fn.mockReset();
  (AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
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
  await tap('Ukloni uslov: „bb“'); expect(snapshot.query).toBe(''); expect(cards()).toEqual(['a', 'bb', 'ccc']);
});

test('portraits mount only for visible rows and unmount behind a pin, a collapsed sheet or an unfocused route', async () => {
  rows = rows.map(item => ({ ...item, narucilacIme: 'Ana', narucilacProfilId: 'profile-a' }));
  initial = { ...initial, sheet: 'full' }; await render();
  const portraits = () => list().findAllByType('TaskPublisherPortrait' as React.ElementType).map(node => node.props.item.id);
  expect(portraits()).toEqual([]);
  await act(async () => list().props.onViewableItemsChanged({ viewableItems: [
    { item: rows[0], isViewable: true }, { item: rows[1], isViewable: false },
  ] }));
  expect(portraits()).toEqual(['a']);
  await act(async () => map().props.onSelect('bb'));
  expect(portraits()).toEqual([]);
  // Closing a pin deliberately returns to the collapsed map sheet; photos resume only when the list opens.
  await tap('Zatvori pregled zadatka'); expect(portraits()).toEqual([]);
  await act(async () => listSheet().props.onChange(2)); expect(portraits()).toEqual(['a']);
  await act(async () => listSheet().props.onChange(0)); expect(portraits()).toEqual([]);
  await act(async () => listSheet().props.onChange(1)); expect(portraits()).toEqual([]);
  await act(async () => listSheet().props.onChange(2)); expect(portraits()).toEqual(['a']);
  mockFocused = false; await update(); expect(portraits()).toEqual([]);
});

test('confirmed own, applied, other and uncovered tasks stay visible with distinct truthful labels on list and pin', async () => {
  rows = [row('mine'), row('other'), row('applied'), row('remote', { priblizno: null })];
  relations = relationIndex(['mine'], ['applied'], ['mine', 'other', 'applied']);
  await render();
  expect(cards()).toEqual(['mine', 'other', 'applied', 'remote']);
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['mine', 'other', 'applied', 'remote']);
  const relationOf = (id: string) => tree.root.findAllByType(CARD).find(node => node.props.item.id === id)!.props.relation;
  expect(relationOf('mine')).toBe('OWNED'); expect(relationOf('other')).toBeUndefined();
  expect(relationOf('applied')).toBe('APPLIED'); expect(relationOf('remote')).toBe('UNKNOWN');
  expect(texts()).toContain('Tvoj zadatak'); expect(texts()).toContain('Prijava poslata'); expect(texts()).toContain('Tvoj status nije potvrđen');
  // The top line counts what is listed, and how many of those the map cannot show.
  expect(texts()).toContain('4 zadatka'); expect(texts()).toContain(' · 1 zadatak bez tačke na mapi');
  await act(async () => map().props.onSelect('mine'));
  expect(texts(peek()!)).toContain('Tvoj zadatak');
  await tap('Zatvori pregled zadatka');
  relations = undefined; relationsError = true; await update();
  expect(cards()).toEqual(['mine', 'other', 'applied', 'remote']); expect(texts()).toContain('4 zadatka');
  expect(texts()).not.toContain('Tvoj zadatak'); expect(texts()).not.toContain('Prijava poslata');
  await tap('Proveri status zadataka'); expect(refresh).toHaveBeenCalledTimes(1);
  await act(async () => map().props.onSelect('mine'));
  expect(texts(peek()!)).toContain('Tvoj status nije potvrđen');
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
  // The top line is never blank: while the list is read it says so, and it is still the way into the list.
  expect(countLine().props.accessibilityLabel).toBe('Učitavamo zadatke…');
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
  expect(countLine().props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: '6 zadataka', accessibilityHint: 'Otvara listu zadataka.',
    accessibilityState: { expanded: false }, accessibilityLiveRegion: 'polite' });
  // Centred, as the one line the top of the sheet says.
  expect(StyleSheet.flatten(countLine().findByType('T' as React.ElementType).props.style).textAlign).toBe('center');
  await act(async () => countLine().props.onPress()); expect(listSheet().props.index).toBe(1);
  expect(countLine().props.accessibilityHint).toBe('Otvara celu listu.'); expect(countLine().props.accessibilityState).toEqual({ expanded: true });
  await act(async () => countLine().props.onPress()); expect(listSheet().props.index).toBe(2);
  // At the full height the count is words, not a button: the way back to the map is "Mapa". They are still heard when
  // they change (a polite live region).
  expect(countLine()).toBeUndefined(); expect(texts()).toContain('6 zadataka');
  expect(tree.root.findByProps({ testID: 'list-count-words' }).props.accessibilityLiveRegion).toBe('polite');
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
  // It stands over the list's end, which keeps 80 clear under it (the pill is 48 high, 16 above the bottom).
  expect(StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(80);
  await tap('Mapa'); expect(listSheet().props.index).toBe(0); expect(pressable('Mapa')).toHaveLength(0);
  expect(StyleSheet.flatten(list().props.contentContainerStyle).paddingBottom).toBe(sys.space.xxl);
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
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOutBody();
  const top = listSheet().props.snapPoints[0];
  expect(top).toBeGreaterThan(HIDDEN);
  await act(async () => map().props.onSelect('t1'));
  expect(snapshot).toMatchObject({ selectedId: 't1', selectedPlace: null }); expect(listSheet().props.index).toBe(0);
  expect(map().props.selectedId).toBe('t1');
  expect(peek()!.props).toMatchObject({ detached: true, accessibilityLabel: 'Zadatak na mapi', bottomInset: sys.space.md, handleComponent: null });
  expect(peek()!.props.backdropComponent).toBeUndefined();
  // The list's top line is not a second strip under the card: it sinks behind it, draws nothing there (no hairline, no
  // shadow as a sliver under the card), and a screen reader does not reach anything in it.
  expect(listSheet().props.snapPoints[0]).toBe(HIDDEN);
  expect(listSheet().props.accessibilityLabel).toBeNull();
  const content = () => listSheet().findByProps({ testID: 'list-sheet-content' });
  expect(content().props).toMatchObject({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  const Sunk = listSheet().props.backgroundComponent;
  let drawn!: ReactTestRenderer; await act(async () => { drawn = create(<Sunk style={{}} />); });
  expect(StyleSheet.flatten(drawn.root.findByType('View' as React.ElementType).props.style).opacity).toBe(0);
  // Its coming up is said to a screen reader: the focus stays on the map, so nothing else would tell it.
  expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Pregled zadatka: Pomoć t1');
  // No separate "Pogledaj zadatak" button: the whole card is the one press, named for what it opens.
  expect(tree.root.findAll(node => node.props.label === 'Pogledaj zadatak')).toHaveLength(0);
  const card = press('Otvori zadatak: Pomoć t1');
  expect(card.props.accessibilityRole).toBe('button');
  await act(async () => card.props.onPress()); expect(open).toHaveBeenCalledWith(rows[1]); expect(open.mock.calls[0][0].id).toBe('t1');
  // ×: the selection is cleared and the top line comes back.
  await tap('Zatvori pregled zadatka');
  expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
  expect(listSheet().props.snapPoints[0]).toBe(top);
  expect(listSheet().props.accessibilityLabel).toBe('Lista zadataka');
  expect(content().props).toMatchObject({ accessibilityElementsHidden: false, importantForAccessibility: 'auto' });
  expect(listSheet().props.backgroundComponent).not.toBe(Sunk);
  // A tap on the empty map closes it too.
  await act(async () => map().props.onSelect('t2')); expect(peek()).toBeDefined();
  await act(async () => map().props.onClear()); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
  // Pulling the list up is looking at the list: the card does not stay over it.
  await act(async () => map().props.onSelect('t0')); expect(peek()).toBeDefined();
  await act(async () => listSheet().props.onChange(1)); expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
});

// Emulator, round 3c: a card inside a card. The floating card is the card; what it says sits in it bare. Owner decision
// (2026-09-24): no photos in the list, the map preview or any card; a task's photos appear only in the task itself.
test('pin and discovery list keep the truthful task face without redundant surrounding frames', async () => {
  rows = [row('a'), row('bb', { naslov: 'Selidba klavira u Zemunu', podrucjeTekst: 'Zemun, Beograd', osnovaCene: 'TOTAL', narucilacIme: 'Mila',
    narucilacOcena: '4,8', narucilacBrojOcena: 12, pokrivenost: { ukupno: 3, popunjeno: 1, preostalo: 2, udeo: 0.33 },
    schedule: { kind: 'FIXED_WINDOW', startsAt: '2026-09-26T10:00:00+02:00', endsAt: '2026-09-26T12:00:00+02:00' }, taskTimezone: 'Europe/Belgrade' }),
  row('ponude', { rezimCene: 'OFFERS', ponudjenaCena: undefined })];
  await render();
  await act(async () => map().props.onSelect('bb'));
  const card = press('Otvori zadatak: Selidba klavira u Zemunu');
  const words = texts(peek()!);
  expect(words).toContain('Selidba klavira u Zemunu'); expect(words).toContain('Zemun, Beograd'); expect(words).toContain('26. sep · 10:00–12:00');
  expect(words).toContain('2.000 RSD'); expect(words).toContain('ukupno'); expect(words).toContain('Još 2 od 3 mesta'); expect(words).toContain('Mila');
  expect(card.props.accessibilityValue.text).toContain('2.000 RSD ukupno');
  // Nothing in it is framed as a card of its own, and nothing is a photo or a place for one.
  const edged = card.findAll(node => String(node.type) === 'View' && (StyleSheet.flatten(node.props.style)?.borderWidth ?? 0) > 0);
  expect(edged).toHaveLength(0);
  // Bundled FactArt pictograms may use Image; task photos/remote image sources must still never enter these cards.
  const isTaskPhoto = (node: ReactTestInstance) => /Photo/i.test(String(node.type)) || /photo|foto/i.test(String(node.props.testID ?? ''))
    || (/Image/i.test(String(node.type)) && !!node.props.source?.uri);
  expect(peek()!.findAll(isTaskPhoto)).toHaveLength(0);
  expect(listSheet().findAll(isTaskPhoto)).toHaveLength(0);
  // A task that asks for offers says so in words that never look like an amount.
  await tap('Zatvori pregled zadatka'); await act(async () => map().props.onSelect('ponude'));
  expect(texts(peek()!)).toContain('Tražim ponude');
  // The results sheet already provides the list surface; its rows have quiet separators instead of nested cards.
  const listed = listSheet().findAllByType(CARD);
  expect(listed.length).toBeGreaterThan(0); expect(listed.every(node => node.props.bare)).toBe(true);
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

// Review of V47, item 2: "Prikaži sve u listi" was an area around the point, and under an area every task without a point
// joins the list: the whole set of one place came with every online task. It is now exactly that one point.
test('a crowded place lists exactly its own tasks: no task without a point joins them, and it is not an area', async () => {
  rows = [...['p1', 'p2', 'p3', 'p4'].map(id => row(id, at(44.79, 20.45))), row('far', at(45.2, 19.8)),
    row('online', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } })];
  await render();
  await act(async () => map().props.onSelectPlace('44.79,20.45'));
  expect(texts(peek()!)).toContain('4 zadatka na ovom mestu');
  await click('Prikaži sve u listi');
  expect(snapshot).toMatchObject({ pinPlace: '44.79,20.45', area: null, selectedPlace: null }); expect(listSheet().props.index).toBe(2);
  expect(cards()).toEqual(['p1', 'p2', 'p3', 'p4']);
  expect(tree.root.findAll(node => node.props.testID === 'section-without-point')).toHaveLength(0);
  expect(texts(tree.root.findByProps({ testID: 'list-count-words' }))).toBe('4 zadatka na ovom mestu');
  // The map still draws every task.
  expect(map().props.items).toHaveLength(6);
  // It is said by the search pill, "Na ovom mestu", and the pill's × takes it away; nothing is added under the count.
  expect(press('Pretraži zadatke').props.accessibilityValue.text).toMatch(/^Na ovom mestu, /);
  expect(removable()).toHaveLength(0);
  await tap('Prikaži sve zadatke'); expect(snapshot).toMatchObject({ pinPlace: null, area: null }); expect(cards()).toHaveLength(6);
  // The next move of the map the person makes lets it go as well, and the list follows the map's area again.
  await act(async () => map().props.onSelectPlace('44.79,20.45')); await click('Prikaži sve u listi');
  expect(snapshot.pinPlace).toBe('44.79,20.45');
  await act(async () => map().props.onArea([20.4, 44.7, 20.5, 44.9]));
  expect(snapshot).toMatchObject({ pinPlace: null, area: [20.4, 44.7, 20.5, 44.9] });
  expect(cards()).toEqual(['p1', 'p2', 'p3', 'p4', 'online']);
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
    await choose('Tražim ponude'); expect(showAction().props.label).toBe('Prikaži 1 zadatak');
    expect(radio('Tražim ponude').props.accessibilityState).toEqual({ checked: true });
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
    expect(press('Pretraži zadatke').props.accessibilityValue).toEqual({ text: 'Svi zadaci, Sutra · Tražim ponude' });
    expect(chip('Sutra').props.accessibilityState).toEqual({ selected: true });
    await act(async () => chip('Sutra').props.onPress()); expect(snapshot.when).toBe('any');
    await act(async () => chip('Tražim ponude').props.onPress()); expect(snapshot.price).toBe('all'); expect(cards()).toHaveLength(3);
    expect(press('Uslovi pretrage')).toBeTruthy();
  });
  test('closing the panel any other way leaves the list exactly as it was; "Obriši uslove" empties the draft', async () => {
    await render(); await tap('Uslovi pretrage');
    await choose('Danas'); await act(async () => press('Povećaj broj osoba').props.onPress());
    await tap('Zatvori pretragu');
    expect(panel()).toHaveLength(0);
    expect(snapshot).toMatchObject({ when: 'any', places: 1, price: 'all' });
    await tap('Uslovi pretrage');
    expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true }); // the discarded draft is gone
    await choose('Danas'); await choose('Navedena cena');
    await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Obriši uslove')!.props.onPress());
    expect(radio('Sve').props.accessibilityState).toEqual({ checked: true });
    expect(radio('Bilo kada').props.accessibilityState).toEqual({ checked: true });
    expect(showAction().props.label).toBe('Prikaži 3 zadatka');
  });
  test('"Kako se radi" is offered only when a task says how it is done, in the panel and as quick chips', async () => {
    await render(); await tap('Uslovi pretrage');
    expect(texts()).not.toContain('Kako se radi'); expect(texts()).toContain('Kada'); expect(texts()).toContain('Koliko vas dolazi');
    expect(tree.root.findAll(node => node.props.accessibilityLabel === 'Na daljinu')).toHaveLength(0);
    await tap('Zatvori pretragu'); await act(async () => tree.unmount());
    rows = [...rows, row('daljina', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } })];
    await render(); await tap('Uslovi pretrage');
    expect(texts()).toContain('Kako se radi');
    await choose('Na daljinu'); expect(showAction().props.label).toBe('Prikaži 1 zadatak');
    await tap('Zatvori pretragu');
    expect(chip('Na daljinu').props.accessibilityState).toEqual({ selected: false });
  });
  // Discovery V47: the chips over the map toggle the very filters the panel sets, at once, and only those the loaded tasks
  // can back (a task that says how it is done; a price mode some task uses; a task with two open places).
  test('a quick chip toggles the same filter the panel sets, and only chips the tasks can back are offered', async () => {
    await render();
    const offered = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityState && 'selected' in node.props.accessibilityState
      && !/^Uslovi|^Dodaj/.test(node.props.accessibilityLabel)).map(node => node.props.accessibilityLabel);
    expect(offered()).toEqual(['Danas', 'Sutra', 'Ove nedelje', 'Navedena cena', 'Tražim ponude', '2+ mesta']);
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
    await tap('Uslovi pretrage, 1 aktivan');
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
    await tap('Ukloni uslov: Vračar, Beograd'); expect(snapshot.place).toBeNull(); expect(cards()).toEqual(['a', 'b']);
  });
});

test('secondary entries stay reachable from one menu without taking map space with a second header', async () => {
  await render();
  expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
  expect(press('Pretraži zadatke')).toBeTruthy();
  await tap('Još mogućnosti');
  const menu = tree.root.findByType(ActionSheet);
  expect(menu.props.actions.map((action: { label: string }) => action.label)).toEqual(['Objavi zadatak', 'Moj profil']);
  expect(newTask).not.toHaveBeenCalled(); expect(profile).not.toHaveBeenCalled();
  await act(async () => menu.props.actions[0].onPress()); expect(newTask).toHaveBeenCalledTimes(1);
  await act(async () => menu.props.actions[1].onPress()); expect(profile).toHaveBeenCalledTimes(1);
  await act(async () => menu.props.onClose());
  expect(tree.root.findAllByType(ActionSheet)).toHaveLength(0);
});

test('reading, not read and nothing in this view keep their meanings, through the one state view', async () => {
  error = true; rows = []; await render();
  expect(texts()).toContain('Zadatke trenutno nije moguće učitati'); await click('Pokušaj ponovo'); expect(refresh).toHaveBeenCalledTimes(1);
  // The top line says it too, never a blank.
  expect(countLine().props.accessibilityLabel).toBe('Zadaci nisu učitani');
  await act(async () => tree.unmount());
  error = false; rows = []; await render();
  expect(texts()).toContain('Trenutno nema otvorenih zadataka'); await click('Dopuni radni profil'); expect(profile).toHaveBeenCalledTimes(1);
  expect(countLine().props.accessibilityLabel).toBe('Nema zadataka');
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
  // The one reset of the app: "Obriši uslove", on the empty list as in the panel.
  expect(tree.root.findAll(node => node.props.label === 'Poništi filtere')).toHaveLength(0);
  await click('Obriši uslove'); expect(snapshot.query).toBe(''); expect(cards()).toHaveLength(6);
});

test('pull to refresh is the list\'s own; the list follows the area the map hands up, and the pill\'s × takes it away', async () => {
  refreshing = true; await render();
  expect(list().props.refreshing).toBe(true);
  await act(async () => list().props.onRefresh()); expect(refresh).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži ovu oblast' })).toHaveLength(0);
  await act(async () => map().props.onArea([20, 44, 21, 45])); expect(snapshot.area).toEqual([20, 44, 21, 45]);
  await tap('Prikaži sve zadatke'); expect(snapshot.area).toBeNull();
});

// Review of V47, item 3: the "Oblast sa mape ×" chip under the count came and went with every move of the map, and the
// sheet's measured top line, and the sheet with it, jumped each time. The area is said by the search pill instead, whose
// × at its right end takes it away; the × lies over the pill's end, so the pill is exactly as tall with it as without.
test('a map area adds nothing under the count; the search pill says it, and its × (48 wide, over its end) takes it away', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(tree.root.findAllByProps({ testID: 'clear-where' })).toHaveLength(0);
  const before = StyleSheet.flatten(press('Pretraži zadatke').props.style);
  await act(async () => map().props.onArea([20.3, 44.7, 20.5, 44.9]));
  expect(removable()).toHaveLength(0);
  const clear = tree.root.findByProps({ testID: 'clear-where' });
  expect(clear.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Prikaži sve zadatke', hitSlop: 0 });
  expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ position: 'absolute', top: 0, bottom: 0, width: 48 });
  const after = StyleSheet.flatten(press('Pretraži zadatke').props.style);
  expect([after.minHeight, after.paddingVertical, after.borderWidth]).toEqual([before.minHeight, before.paddingVertical, before.borderWidth]);
  expect(after.paddingRight).toBe(48);
  expect(press('Pretraži zadatke').props.accessibilityValue.text).toMatch(/^Oblast sa mape, /);
  await tap('Prikaži sve zadatke'); expect(snapshot.area).toBeNull();
  expect(tree.root.findAllByProps({ testID: 'clear-where' })).toHaveLength(0);
});

// Discovery V47: the list follows the map, and the map keeps every pin whatever the area. A task with no public point
// (online work, or a task placed nowhere) is never lost to an area: it follows the area's own tasks under its own quiet
// heading, and the top line says both counts honestly. No coordinate is invented for it.
test('under a map area the list holds the area\'s tasks, then those without a point under "Bez tačke na mapi"; the count says both', async () => {
  rows = [row('in1', at(44.81, 20.41)), row('far', at(45.5, 19.5)), row('online', { priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }),
    row('in2', at(44.82, 20.42)), row('nowhere', { priblizno: null })];
  await render();
  expect(cards()).toEqual(['in1', 'far', 'online', 'in2', 'nowhere']);
  expect(countLine().props.accessibilityLabel).toBe('5 zadataka · 2 zadatka bez tačke na mapi');
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
  expect(countLine().props.accessibilityLabel).toBe('2 zadatka u oblasti · 2 zadatka bez tačke na mapi');
  // The map keeps every pin: moving it never takes one away.
  expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['in1', 'far', 'online', 'in2', 'nowhere']);
  // An area with none of its own still keeps the tasks without a point, and says so.
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  expect(cards()).toEqual(['online', 'nowhere']); expect(countLine().props.accessibilityLabel).toBe('U oblasti nema zadataka · 2 zadatka bez tačke na mapi');
  // "Prikaži N zadataka" counts the same list.
  await tap('Uslovi pretrage');
  expect(showAction().props.label).toBe('Prikaži 2 zadatka');
});

test('an area that holds nothing says so and offers every task back; the sheet the person placed stays where it is', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
  expect(listSheet().props.index).toBe(0);
  await act(async () => map().props.onArea([0, 0, 1, 1]));
  // Moving the map never moves the sheet: the reason is on the top line itself.
  expect(listSheet().props.index).toBe(0); expect(countLine().props.accessibilityLabel).toBe('U oblasti nema zadataka');
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

// Review of V47, item 13: folding the chips gives the list their room; a list only a little longer than its window then
// fit, fell back to its top and brought them back, over and over. They now fold only for a list that stays longer than
// its window without them, and come back only at its very top.
test('at the full height the quick chips fold only for a list longer than its window without them, and return at its top', async () => {
  jest.useFakeTimers();
  try {
    mockWindow = { width: 390, height: 844, scale: 2, fontScale: 1 };
    rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOutBody();
    const chips = () => tree.root.findAllByProps({ accessibilityLabel: 'Brzi filteri' });
    const scroll = async (y: number) => act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y } } }));
    await act(async () => list().props.onContentSizeChange(400, 3000));
    await scroll(300);
    expect(chips()).toHaveLength(1); // not at the full height
    await act(async () => listSheet().props.onChange(2));
    const [low, , full] = listSheet().props.snapPoints as number[];
    const window = full - low;
    // A list only a little longer than its window (less than the chips' room, 56, and 8 more): the chips stay.
    await scroll(0); await act(async () => list().props.onContentSizeChange(400, window + 60)); await scroll(30);
    expect(chips()).toHaveLength(1);
    // A long list folds them once scrolled; the pill stays.
    await act(async () => list().props.onContentSizeChange(400, window + 64)); await scroll(30);
    expect(chips()).toHaveLength(0); expect(press('Pretraži zadatke')).toBeTruthy();
    // Back up a little: still folded. At the very top: back.
    await scroll(4); expect(chips()).toHaveLength(0);
    await scroll(0); expect(chips()).toHaveLength(1);
    // The room is the chips' own, as the bar measures it (the row and the gap above it): taller chips need a longer list.
    await act(async () => chips()[0].props.onLayout({ nativeEvent: { layout: { height: 60 } } }));
    await act(async () => list().props.onContentSizeChange(400, window + 70)); await scroll(30);
    expect(chips()).toHaveLength(1);
    await scroll(0); await act(async () => list().props.onContentSizeChange(400, window + 76)); await scroll(30);
    expect(chips()).toHaveLength(0);
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
  await tap('Ukloni uslov: „prevod“'); await act(async () => listSheet().props.onChange(1));
  await search('prevod'); expect(listSheet().props.index).toBe(1);
});

// DN-01: ownership labels are independent of public count and sheet geometry.
test('pending, confirmed and failed ownership keep identical counts, rows and sheet start', async () => {
  rows = Array.from({ length: 5 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); relationsPending = true;
  await render();
  expect(texts()).toContain('5 zadataka'); expect(listSheet().props.index).toBe(0);
  expect(texts()).toContain('Proveravam tvoj status…');
  relations = relationIndex(['t0', 't1']); relationsPending = false; await update();
  expect(texts()).toContain('5 zadataka'); expect(listSheet().props.index).toBe(0);
  // A failed read is not pending: the list counts what it shows.
  await act(async () => tree.unmount()); relations = undefined; await render();
  expect(texts()).toContain('5 zadataka');
});

// Review r3 item 3: the first fit of the pins keeps them above where the sheet starts.
test('camera layout is ready only after body and tools measurements replace whole-window estimates', async () => {
  mockWindow = { width: 411, height: 924, scale: 2.625, fontScale: 1 };
  rows = [row('one', at(45.25, 19.83)), row('two', at(45.26, 19.85))];
  await render();
  expect(map().props.cameraLayoutReady).toBe(false);
  expect(map().props.fitBottom).toBe(534);
  await layOutBody(790);
  expect(map().props.cameraLayoutReady).toBe(false);
  await act(async () => tree.root.findByType(DiscoverySearchBar).props.onLayout(124));
  expect(map().props.cameraLayoutReady).toBe(true);
  expect(map().props.fitBottom).toBe(467);
  expect(listSheet().props.snapPoints[1]).toBe(395);
});

test('the map is told where the sheet starts, so the first fit keeps the pins above it', async () => {
  const layOut = async () => act(async () => map().parent!.parent!.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render(); await layOut();
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[0] + 48 + 2 * sys.space.md);
  await act(async () => tree.unmount());
  rows = rows.slice(0, 3); await render(); await layOut();
  expect(listSheet().props.index).toBe(1);
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[1] + 48 + 2 * sys.space.md);
  expect(map().props.fitBottom).toBeGreaterThan(listSheet().props.snapPoints[0] + sys.space.md);
});

// DN-01: the same map fits every visible public pin before the labels arrive.
test('the map mounts without waiting for ownership and keeps the same pins after it resolves', async () => {
  rows = Array.from({ length: 5 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); relationsPending = true;
  await render();
  const body = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function'
    && JSON.stringify(StyleSheet.flatten(node.props.style)) === JSON.stringify({ flex: 1 }))[0];
  await act(async () => body.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(1);
  expect(map().props.items).toHaveLength(5);
  const publicPins = map().props.items;
  relations = relationIndex(['t0', 't1']); relationsPending = false; await update();
  expect(map().props.items).toHaveLength(5);
  expect(map().props.items).toBe(publicPins);
  expect(listSheet().props.index).toBe(0);
  expect(map().props.fitBottom).toBe(listSheet().props.snapPoints[0] + 48 + 2 * sys.space.md);
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

// Review of V47, item 11 (restores the weakened test): a sheet at its top line rises to half when a filter leaves
// nothing, so the reason can be read. The list here starts at its top line (six tasks, all on the map), and the one
// thing that changes is a quick chip; without the rise the sheet would stay at its top line.
test('a sheet resting at its top line rises to half when a quick chip leaves nothing, so the reason is seen', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, { ...at(44.7 + i / 50, 20.4), ...tomorrowFlexible }));
  await render();
  expect(listSheet().props.index).toBe(0);
  await act(async () => quick('Danas').props.onPress());
  expect(snapshot.when).toBe('today'); expect(cards()).toEqual([]);
  expect(texts()).toContain('Nema zadataka u ovom prikazu');
  expect(listSheet().props.index).toBe(1);
});

// Review of V47, item 10: the empty list's own green action and the floating green "Mapa" must never be on one screen.
test('an empty list over the map rests at half at most, so its green action and "Mapa" are never on screen together', async () => {
  rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, { ...at(44.7 + i / 50, 20.4), ...tomorrowFlexible }));
  // A camera the person already looked at: the map stays even when the filter leaves no pin on it.
  initial = { ...initial, viewport: { center: [20.4, 44.8], zoom: 11, bounds: [20.2, 44.6, 20.6, 45] } };
  await render();
  await act(async () => listSheet().props.onChange(2)); expect(press('Mapa')).toBeTruthy();
  await act(async () => quick('Danas').props.onPress());
  expect(cards()).toEqual([]); expect(listSheet().props.index).toBe(1); expect(pressable('Mapa')).toHaveLength(0);
  expect(action('Obriši uslove')).toBeDefined();
  // Its top line says why and is not a button that would take the list up only to see it come back.
  expect(countLine()).toBeUndefined(); expect(texts(tree.root.findByProps({ testID: 'list-count-words' }))).toBe('Nema zadataka');
  // Pulled up anyway, it comes back to half.
  await act(async () => listSheet().props.onChange(2)); expect(listSheet().props.index).toBe(1); expect(pressable('Mapa')).toHaveLength(0);
  // With tasks again, the whole list is open to it.
  await act(async () => quick('Danas').props.onPress()); await act(async () => listSheet().props.onChange(2));
  expect(listSheet().props.index).toBe(2); expect(press('Mapa')).toBeTruthy();
});

// Review of V47, item 14: Back with the whole list up over the map lowers it, as it closes the card and the panel.
test('Android Back with the whole list up over the map lowers it to its top line, only while the screen is in front', async () => {
  const listeners: (() => boolean)[] = [], remove = jest.fn();
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, handler: () => boolean) => {
    listeners.push(handler); return { remove };
  }) as never);
  try {
    rows = Array.from({ length: 6 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4))); await render();
    expect(listeners).toHaveLength(0);
    await act(async () => listSheet().props.onChange(2));
    expect(listeners).toHaveLength(1);
    let consumed = false; await act(async () => { consumed = listeners[0](); });
    expect(consumed).toBe(true); expect(listSheet().props.index).toBe(0); expect(remove).toHaveBeenCalledTimes(1);
    // A task opened over the map: Back belongs to it, not to this list.
    mockFocused = false; await act(async () => listSheet().props.onChange(2));
    expect(listeners).toHaveLength(1);
    // A list with nothing on the map takes the whole screen; Back then leaves the screen as usual.
    mockFocused = true; await act(async () => tree.unmount()); rows = [row('remote', { priblizno: null })]; listeners.length = 0; await render();
    expect(listSheet().props.index).toBe(2); expect(listeners).toHaveLength(0);
  } finally { spy.mockRestore(); }
});

// Review of V47, item 12: a restore still waiting for the rows must not pull the list away from the person, and a scroll
// not yet written when a task is opened must not be lost (the route takes no changes once the task is in front).
test('a waiting restore is dropped when the list is taken hold of or refreshed; opening a task writes the scroll first', async () => {
  jest.useFakeTimers();
  try {
    rows = Array.from({ length: 12 }, (_, i) => row(`t${i}`, at(44.7 + i / 50, 20.4)));
    initial = { ...initial, sheet: 'full', listOffset: 640 }; await render();
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: false });
    // The person takes hold of the list before the rows are long enough: the list is not moved under their finger.
    scrollToOffset.mockReset();
    await act(async () => list().props.onScrollBeginDrag({ nativeEvent: {} }));
    await act(async () => list().props.onContentSizeChange(400, 2000));
    expect(scrollToOffset).not.toHaveBeenCalled();
    // A refresh drops it too.
    await act(async () => tree.unmount()); scrollToOffset.mockReset(); await render();
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 640, animated: false }); scrollToOffset.mockReset();
    await act(async () => list().props.onRefresh()); expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => list().props.onContentSizeChange(400, 2000));
    expect(scrollToOffset).not.toHaveBeenCalled();
    // Scrolled, and a task opened at once: the scroll is written before the task opens.
    open.mockImplementation(() => { navigated = true; });
    await act(async () => list().props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }));
    await tap('Otvori priliku Pomoć t3');
    expect(open).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(OFFSET_SETTLE_MS * 2); });
    expect(snapshot.listOffset).toBe(300);
  } finally { jest.useRealTimers(); }
});

// Review of V47, item 9: TalkBack hears the count line (a polite live region); iOS has none, so VoiceOver hears the new
// count once the list's area has stayed still for a second (a new move inside that second starts it again).
test('on iOS the new count is said once the list\'s area has stayed still for a second', async () => {
  jest.useFakeTimers();
  try {
    rows = [row('in1', at(44.81, 20.41)), row('in2', at(44.82, 20.42)), row('far', at(45.5, 19.5))]; await render();
    const announce = AccessibilityInfo.announceForAccessibility as jest.Mock; announce.mockClear();
    await act(async () => map().props.onArea([20.3, 44.7, 20.5, 44.9]));
    await act(async () => { jest.advanceTimersByTime(AREA_ANNOUNCE_MS / 2); });
    await act(async () => map().props.onArea([20.3, 44.7, 20.6, 44.9]));
    await act(async () => { jest.advanceTimersByTime(AREA_ANNOUNCE_MS - 1); }); expect(announce).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(announce.mock.calls).toEqual([['2 zadatka u oblasti']]);
    // A screen left before the second is over says nothing.
    await act(async () => map().props.onArea([0, 0, 1, 1])); mockFocused = false; await update();
    await act(async () => { jest.advanceTimersByTime(AREA_ANNOUNCE_MS * 2); }); expect(announce).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

test('the search panel waits for public rows, but counts them while ownership is still pending', async () => {
  loading = true; rows = []; await render();
  expect(press('Pretraži zadatke').props.accessibilityValue.text).not.toMatch(/\d+ zadat/);
  await tap('Uslovi pretrage');
  expect(action('Učitavamo zadatke…').props.disabled).toBe(true);
  await tap('Gde'); expect(radioOf('Svi zadaci')).toBeDefined();
  await tap('Zatvori pretragu'); await act(async () => tree.unmount());
  loading = false; relationsPending = true; rows = [row('a'), row('bb')]; await render();
  await tap('Pretraži zadatke');
  expect(action('Prikaži 2 zadatka').props.disabled).toBe(false); expect(radioOf('Svi zadaci, 2 zadatka')).toBeDefined();
  await tap('Zatvori pretragu'); await act(async () => tree.unmount());
  relationsPending = false; error = true; rows = []; await render(); await tap('Uslovi pretrage');
  expect(action('Zadaci nisu učitani').props.disabled).toBe(true);
});

// Review of V47, item 20: "now" is read again when the panel opens, so a panel opened after midnight knows the new day.
test('the search panel reads today again when it opens', async () => {
  jest.useFakeTimers({ now: new Date('2026-09-24T21:58:00Z') });
  try {
    await render();
    jest.setSystemTime(new Date('2026-09-24T22:02:00Z')); // 00:02 on the 25th in Belgrade
    await tap('Uslovi pretrage');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
    const day = (n: number) => tree.root.findAll(node => String(node.type) === 'Press' && new RegExp(`, ${n}\\. sep`).test(node.props.accessibilityLabel ?? ''))[0];
    expect(day(24).props.accessibilityLabel).toMatch(/prošao dan$/); expect(day(25).props.accessibilityLabel).toMatch(/, danas$/);
  } finally { jest.useRealTimers(); }
});

// Review of V47, item 20: a chosen pin whose task a new read no longer has is let go, not kept as a hidden selection.
test('a chosen pin whose task is gone from a newly landed read is let go', async () => {
  await render();
  await act(async () => map().props.onSelect('bb')); expect(peek()).toBeDefined();
  rows = [row('a'), row('ccc')]; await update();
  expect(snapshot.selectedId).toBeNull(); expect(peek()).toBeUndefined();
});

// Review of V47, item 21 (coverage): the note under the list for the tasks a time choice leaves out.
test('a time choice says under the list how many tasks it leaves out because they name no day', async () => {
  rows = [row('danas', { schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null } }), row('bez-datuma'), row('bez-datuma-2')];
  await render();
  expect(list().props.ListFooterComponent).toBeNull();
  await act(async () => quick('Danas').props.onPress());
  expect(cards()).toEqual(['danas']);
  expect(list().props.ListFooterComponent.props.children).toBe('2 zadatka bez datuma nisu u ovom izboru.');
  await act(async () => quick('Danas').props.onPress()); expect(list().props.ListFooterComponent).toBeNull();
});

// R10: large text gets the whole search row, instead of four squeezed lines beside two tools.
test('at large text the search stays two lines with separate tools and the pin preview may use more room', async () => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1 }; await render();
  const lines = () => press('Pretraži zadatke').findAllByType('T' as React.ElementType).map(node => node.props.numberOfLines);
  expect(lines()).toEqual([1, 1]);
  await act(async () => map().props.onSelect('bb'));
  expect(peek()!.props.maxDynamicContentSize).toBe(640 * 0.5);
  await act(async () => tree.unmount());
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1.3 }; await render();
  expect(lines()).toEqual([1, 1]);
  const searchRow = tree.root.findByProps({ testID: 'discovery-search-row' });
  expect(searchRow.findAllByProps({ accessibilityLabel: 'Uslovi pretrage' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'discovery-search-tools' }).findByProps({ accessibilityLabel: 'Uslovi pretrage' })).toBeTruthy();
  await act(async () => map().props.onSelect('bb'));
  expect(peek()!.props.maxDynamicContentSize).toBe(640 * 0.75);
});

// Review of V47, items 17 and 19: over the map the pill is drawn by the card edge, and the chips carry no shadow that the
// scrolling row would cut off; a chosen chip is the one chosen-chip look (pale green, green edge and words, a tick).
test('over the map: search and tools share one edge; a quick chip has no shadow and selection stays visible', async () => {
  await render();
  expect(StyleSheet.flatten(press('Pretraži zadatke').props.style).borderWidth).toBeUndefined();
  const free = StyleSheet.flatten(quick('Navedena cena').props.style);
  expect(free.boxShadow).toBeUndefined(); expect(free.elevation).toBeUndefined();
  await act(async () => quick('Navedena cena').props.onPress());
  const chosen = quick('Navedena cena'), style = StyleSheet.flatten(chosen.props.style);
  expect(style).toMatchObject({ backgroundColor: sys.color.greenSoft, borderWidth: 2, borderColor: sys.color.green });
  expect(chosen.findByType('Check' as React.ElementType).props.color).toBe(sys.color.green);
  expect(StyleSheet.flatten(chosen.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.green);
  // A condition under the count removes itself by name, and takes 48 to a finger.
  await act(async () => tree.unmount()); initial = { ...initial, query: 'Pomoć' }; await render();
  const remove = press('Ukloni uslov: „Pomoć“');
  expect(StyleSheet.flatten(remove.props.style).minHeight + remove.props.hitSlop.top + remove.props.hitSlop.bottom).toBeGreaterThanOrEqual(48);
});

test('measured credits reserve space above the full list and a selected preview, including after resizing', async () => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 2 }; await render(); await layOutBody(500);
  const searchBar = tree.root.findByProps({ testID: 'discovery-search-row' }).parent!;
  await act(async () => searchBar.props.onLayout({ nativeEvent: { layout: { y: 12, height: 144 } } }));
  await act(async () => map().props.onCreditsHeight(56));
  const clearTop = 156 + 56 + 2 * sys.space.md;
  expect(500 - listSheet().props.snapPoints[2]).toBe(clearTop);
  await act(async () => map().props.onSelect('bb'));
  const preview = () => tree.root.findByType(DiscoveryPeek);
  const cap = peek()!.props.maxDynamicContentSize;
  expect(cap).toBeLessThan(640 * 0.75);
  const body = preview().findAll(node => String(node.type) === 'View' && node.props.onLayout?.name === 'measureCard')[0];
  await act(async () => body.props.onLayout({ nativeEvent: { layout: { height: 800 } } }));
  const creditsEdge = () => 500 - HIDDEN - map().props.coverBottom;
  expect(creditsEdge() - sys.space.md - 56).toBeGreaterThanOrEqual(156 + sys.space.md);
  // A larger map increases the cap even if the preview's long content needs no new layout.
  await layOutBody(600);
  expect(peek()!.props.maxDynamicContentSize).toBeGreaterThan(cap);
  expect(map().props.coverBottom).toBe(Math.round(peek()!.props.maxDynamicContentSize) + 2 * sys.space.md);
  expect(snapshot.selectedId).toBe('bb'); expect(open).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});

test.each([false, true])('a tall filter header scrolls at the capped full stop without covering credits (empty: %s)', async empty => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 2 };
  initial = { ...initial, query: empty ? 'Nema takvog zadatka' : 'Pomoć', place: 'Beograd', when: 'next7',
    viewport: { center: [20.45, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.6, 44.9] } };
  rows = rows.map(item => ({ ...item, schedule: { kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null } } as MarketplaceItem));
  await render(); await layOutBody(430);
  const bar = tree.root.findByProps({ testID: 'discovery-search-row' }).parent!;
  await act(async () => bar.props.onLayout({ nativeEvent: { layout: { y: 12, height: 144 } } }));
  await act(async () => map().props.onCreditsHeight(48));
  const header = () => tree.root.findByProps({ testID: 'discovery-list-header' });
  await act(async () => tree.root.findByProps({ testID: 'discovery-list-header-lead' }).props.onLayout({ nativeEvent: { layout: { height: 88 } } }));
  await act(async () => header().props.onLayout({ nativeEvent: { layout: { height: 240 } } }));
  expect(listSheet().props.snapPoints).toEqual([96, 201, 202]);
  expect(430 - listSheet().props.snapPoints[2]).toBe(156 + 48 + 2 * sys.space.md);
  expect(list().findByProps({ testID: 'discovery-scrolling-header' }).findByProps({ testID: 'discovery-list-header' })).toBe(header());
  expect(tree.root.findAllByProps({ testID: 'discovery-list-header' })).toHaveLength(1);
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'discovery-scrolling-header' }).props.style).marginHorizontal).toBe(-sys.space.lg);
  expect(removable()).toHaveLength(3);
  // Repeating native measurement in the new container leaves the same cap/mode rather than an expanding header loop.
  await act(async () => header().props.onLayout({ nativeEvent: { layout: { height: 240 } } }));
  expect(listSheet().props.snapPoints[2]).toBe(202);
  await act(async () => listSheet().props.onChange(2));
  expect(listSheet().props.index).toBe(2);
  if (empty) expect(pressable('Mapa')).toHaveLength(0);
  await tap('Ukloni uslov: Beograd');
  expect(snapshot.place).toBeNull(); expect(refresh).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  // Once the map has room again the exact same header can return to the fixed slot.
  await layOutBody(700);
  expect(tree.root.findAllByProps({ testID: 'discovery-scrolling-header' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'discovery-list-header' })).toHaveLength(1);
});

describe('U blizini: an explicit camera-only location capture', () => {
  let receive: (value: { timestamp: number; coords: { latitude: number; longitude: number } }) => void;
  const remove = jest.fn();
  beforeEach(() => {
    mockNearbyPermission.mockReset().mockResolvedValue({ granted: true });
    mockNearbyWatch.mockReset().mockImplementation(async (_options, next) => { receive = next; return { remove }; });
    remove.mockClear();
  });
  test('offers a real 48 dp chip first, asks only on tap, and keeps list/filter data unchanged', async () => {
    rows = [row('a'), row('b')]; await render();
    const chip = press('U blizini');
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(tree.root.findByProps({ accessibilityLabel: 'Brzi filteri' }).findAllByType('Press' as React.ElementType)[0]).toBe(chip);
    expect(mockNearbyPermission).not.toHaveBeenCalled(); expect(mockNearbyWatch).not.toHaveBeenCalled();
    const before = { ...snapshot }, beforeCards = cards();
    await tap('U blizini'); expect(mockNearbyPermission).toHaveBeenCalledTimes(1); expect(press('U blizini').props.disabled).toBe(true);
    // Even an old native press callback cannot start a second attempt.
    await act(async () => chip.props.onPress()); expect(mockNearbyWatch).toHaveBeenCalledTimes(1);
    await act(async () => receive({ timestamp: Date.now(), coords: { latitude: 44.812345, longitude: 20.412345 } }));
    expect(map().props.centerNearby).toEqual({ key: 1, center: [20.412345, 44.812345] }); expect(remove).toHaveBeenCalledTimes(1);
    expect(cards()).toEqual(beforeCards); expect(map().props.items).toEqual(rows);
    expect(snapshot).toMatchObject({ query: before.query, price: before.price, area: before.area, viewport: before.viewport, place: before.place });
    expect(JSON.stringify(snapshot)).not.toContain('20.412345'); expect(refresh).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
  });
  test('permission refusal leaves the map usable and offers settings without starting a watch', async () => {
    mockNearbyPermission.mockResolvedValue({ granted: false }); await render(); await tap('U blizini');
    expect(mockNearbyWatch).not.toHaveBeenCalled(); expect(map()).toBeTruthy();
    expect(texts()).toContain('Dozvoli lokaciju u podešavanjima'); expect(press('Podešavanja lokacije')).toBeTruthy();
    expect(press('U blizini').props.disabled).toBe(false);
  });
  test('consuming Nearby keeps an otherwise empty map mounted until its native viewport arrives', async () => {
    rows = []; await render(); expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
    await tap('U blizini');
    await act(async () => receive({ timestamp: Date.now(), coords: { latitude: 44.8, longitude: 20.4 } }));
    const request = map().props.centerNearby;
    await act(async () => map().props.onNearbyConsumed(request.key));
    expect(map().props.centerNearby).toBeNull(); expect(snapshot.viewport).toBeNull();
    const settled = { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9] };
    await act(async () => map().props.onViewport(settled)); expect(snapshot.viewport).toEqual(settled);
  });
});
