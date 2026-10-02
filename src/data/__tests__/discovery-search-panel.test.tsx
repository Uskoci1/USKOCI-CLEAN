import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type PublicBounds } from '../marketplaceView';
import { discoveryV1SearchPreviewKey, type DiscoveryV1SearchSnapshot } from '../discoveryV1SearchOwner';
// The window the panel is drawn in: React Native's Jest default (a 2× text size) unless a test says otherwise.
let mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native'), React = require('react');
  // One stable function: a new one on every read would be a new component type, and React would mount the panel again.
  const Modal = ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  const Keyboard = { dismiss: () => undefined };
  const useWindowDimensions = () => mockWindow;
  return new Proxy(native, { get(target, key) {
    if (key === 'Modal') return Modal;
    if (key === 'Keyboard') return Keyboard;
    if (key === 'useWindowDimensions') return useWindowDimensions;
    return ['View', 'ScrollView', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { DiscoverySearchPanel, NO_SEARCH, type DiscoveryV1SearchPanelSeam, type SearchDraft, type SearchReadiness, type SearchStep } from '../../ui/v2/discovery/DiscoverySearchPanel';
import { sys } from '../../ui/system/tokens';

/**
 * The Zadaci search panel: directly editable groups with focused place/date expansion. Choices stay where they are
 * made, with every selected value visible. "Gde" offers only places the loaded tasks name. The
 * choices are a draft: the one green action applies it and counts it, "Obriši uslove" empties it, × leaves the list as it was.
 */
// Thursday 24 September 2026, 10:00 in Belgrade: the 23rd is past, the 26th and 27th are the weekend.
const NOW = new Date('2026-09-24T08:00:00Z');
const day = (date: string) => ({ schedule: { kind: 'FIXED_WINDOW' as const, startsAt: `${date}T10:00:00+02:00`, endsAt: `${date}T12:00:00+02:00` } });
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.84 }, taskTimezone: 'Europe/Belgrade',
  ...day('2026-09-26'), ...patch } as unknown as MarketplaceItem);
let rows: MarketplaceItem[] = [], view: MarketplaceView, mine: ReadonlySet<string> | undefined, mapArea: PublicBounds | null, start: SearchStep;
let readiness: SearchReadiness = 'ready', p6Search: DiscoveryV1SearchPanelSeam | undefined;
const apply = jest.fn(), close = jest.fn();
let tree: ReactTestRenderer;
const panelOf = () => <DiscoverySearchPanel items={rows} view={view} mine={mine} now={NOW} mapArea={mapArea}
  start={start} reduced={false} readiness={readiness} p6Search={p6Search} onApply={apply} onClose={close} />;
const render = async () => act(async () => { tree = create(panelOf()); });
const byLabel = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label);
const tap = async (label: string) => act(async () => byLabel(label)[0].props.onPress());
const radio = (label: string | RegExp) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio'
  && (typeof label === 'string' ? node.props.accessibilityLabel === label : label.test(node.props.accessibilityLabel)));
const choose = async (label: string | RegExp) => act(async () => radio(label)[0].props.onPress());
const texts = (root: ReactTestInstance = tree.root) => root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
const stepIds: Record<string, SearchStep> = { 'search-place-toggle': 'gde', 'search-kada-toggle': 'kada',
  'search-kako-toggle': 'kako', 'search-koliko-toggle': 'koliko', 'search-cena-toggle': 'cena' };
const openStep = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityState?.expanded && stepIds[node.props.testID])
  .map(node => stepIds[node.props.testID]);
const placeValue = () => tree.root.findByProps({ testID: 'search-place-toggle' }).props.accessibilityValue.text;
const dateValue = () => tree.root.findByProps({ testID: 'search-date-toggle' }).props.accessibilityValue.text;
const offeredPlaces = () => tree.root.findByProps({ accessibilityLabel: 'Mesta' })
  .findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio');
const show = () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.style !== undefined && node.props.kind === undefined)!;
const dayCell = (dayOfMonth: number) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'button'
  && new RegExp(`, ${dayOfMonth}\\. sep`).test(node.props.accessibilityLabel ?? ''))[0];
const lastDraft = (): SearchDraft => apply.mock.calls[apply.mock.calls.length - 1][0];

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  rows = [row('a'), row('b', { podrucjeTekst: 'Vračar, Beograd', priblizno: { lat: 44.8, lng: 20.48 } }),
    row('c', { podrucjeTekst: 'Liman,  Novi Sad', rezimCene: 'OFFERS', ponudjenaCena: undefined, ...day('2026-09-30') }),
    row('remote', { podrucjeTekst: 'Na daljinu', priblizno: null, detalji: { rezimLokacije: 'REMOTE' } }),
    row('mine', { podrucjeTekst: 'Zemun, Beograd' })];
  view = { ...initialMarketplaceView(), mode: 'map' }; mine = new Set(['mine']); mapArea = null; start = 'gde'; readiness = 'ready'; p6Search = undefined;
  mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
  apply.mockReset(); close.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

const p6Snapshot = (patch: Partial<DiscoveryV1SearchSnapshot> = {}): DiscoveryV1SearchSnapshot => ({
  active: true, generation: 1, key: discoveryV1SearchPreviewKey(view, mapArea), status: 'ready', count: 37, undated: 6,
  availability: { hasKnownWorkMode: true, hasKnownSchedule: true, priceModes: ['MY_PRICE', 'OFFERS'] },
  places: [{ key: 'novi sad, liman', text: 'Novi Sad, Liman', count: 21 }, { key: 'beograd, vračar', text: 'Beograd, Vračar', count: 9 }],
  placeHasMore: false, placePaging: false, everywhere: 80, inMapArea: mapArea ? 23 : null, facetError: false, ...patch,
});
const p6Seam = (snapshot: DiscoveryV1SearchSnapshot): DiscoveryV1SearchPanelSeam => ({
  snapshot, onDraft: jest.fn(), onNextPlaces: jest.fn(),
});

test('P6 search count and locality suggestions come from server preview, never the bounded loaded rows', async () => {
  rows = [row('only-loaded-row')]; mapArea = [19, 44, 21, 46]; p6Search = p6Seam(p6Snapshot());
  await render();
  expect(show().props.label).toBe('Prikaži 37 zadataka');
  expect(offeredPlaces().map(node => node.props.accessibilityLabel)).toEqual([
    'Svi zadaci, 80 zadataka', 'Ova oblast, 23 zadatka', 'Novi Sad, Liman, 21 zadatak', 'Beograd, Vračar, 9 zadataka',
  ]);
});

test('a stale P6 preview shows loading and never falls back to local row counts', async () => {
  rows = [row('a'), row('b')]; p6Search = p6Seam(p6Snapshot({ key: 'old-key', count: 999 }));
  await render();
  expect(show().props).toMatchObject({ label: 'Učitavamo zadatke…', disabled: true });
  expect(offeredPlaces()[0].props.accessibilityLabel).toBe('Svi zadaci');
  expect(texts()).not.toContain('999');
});

test('P6 facet failure keeps authoritative task count usable and does not fabricate place zeroes', async () => {
  p6Search = p6Seam(p6Snapshot({ facetError: true, places: [], everywhere: null, inMapArea: null, count: 14 }));
  await render();
  expect(show().props).toMatchObject({ label: 'Prikaži 14 zadataka', disabled: false });
  expect(texts()).toContain('Mesta trenutno nisu dostupna. Pretraga zadataka i dalje radi.');
  expect(offeredPlaces()[0].props.accessibilityLabel).toBe('Svi zadaci');
});

test('P6 place continuation and draft preview are explicit server callbacks', async () => {
  mapArea = [19, 44, 21, 46];
  const seam=p6Seam(p6Snapshot({ placeHasMore: true }));p6Search=seam;
  await render();
  expect(seam.onDraft).toHaveBeenCalledWith(expect.objectContaining({ query: '' }), mapArea);
  const more=tree.root.findAllByType('Action' as React.ElementType).find(node=>node.props.label==='Prikaži još mesta')!;
  await act(async()=>more.props.onPress());expect(seam.onNextPlaces).toHaveBeenCalledTimes(1);
  await act(async()=>tree.root.findByProps({ accessibilityLabel:'Pretraži mesta i zadatke' }).props.onChangeText('vrač'));
  expect(seam.onDraft).toHaveBeenLastCalledWith(expect.objectContaining({ query:'vrač' }), mapArea);
  expect(show().props.label).toBe('Učitavamo zadatke…');
});

test('choosing remote clears geographic scope in the draft, retains conditions, and applies only on confirmation', async () => {
  view = { ...view, place: 'Liman, Novi Sad', area: [19.8, 45.2, 19.9, 45.3], pinPlace: '45.25,19.84',
    price: 'MY_PRICE', query: 'Pomoć', places: 2 };
  await render(); await tap('Kako se radi'); await choose('Na daljinu');
  expect(show().props.label).toBe('Prikaži 1 zadatak');
  expect(placeValue()).toBe('Na daljinu · „Pomoć“');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Mesta' })).toHaveLength(0);
  expect(apply).not.toHaveBeenCalled(); expect(view.pinPlace).toBe('45.25,19.84');
  await act(async () => show().props.onPress());
  expect(lastDraft()).toMatchObject({ where: 'remote', area: null, place: null, pinPlace: null,
    query: 'Pomoć', price: 'MY_PRICE', places: 2 });
});

test('search and filters open their own single accordion group, retaining the local date editor', async () => {
  await render();
  expect(openStep()).toEqual(['gde']); expect(texts()).toContain('Pretraga');
  expect(radio('Bilo kada')).toHaveLength(0);
  await tap('Kada'); expect(radio('Bilo kada')[0].props.accessibilityState.checked).toBe(true);
  await tap('Kako se radi'); expect(radio('Bilo gde')[0].props.accessibilityState.checked).toBe(true);
  await tap('Cena'); expect(radio('Sve')[0].props.accessibilityState.checked).toBe(true);
  await tap('Koliko vas dolazi'); expect(byLabel('Povećaj broj osoba')).toHaveLength(1);
  // "Uslovi pretrage" opens the panel at its conditions.
  await act(async () => tree.unmount()); start = 'kada'; await render();
  expect(texts()).toContain('Filteri'); expect(openStep()).toEqual(['kada']);
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži mesta i zadatke' })).toHaveLength(0);
  await tap('Datumi'); expect(openStep()).toEqual(['kada']);
  await tap('Gde'); expect(openStep()).toEqual(['gde']);
  expect(byLabel('Datumi')).toHaveLength(0);
  await tap('Kada'); expect(tree.root.findAllByProps({ testID: 'search-date-editor' })).toHaveLength(1);
  await tap('Datumi'); expect(openStep()).toEqual(['kada']);
  expect(tree.root.findAllByProps({ testID: 'search-date-editor' })).toHaveLength(0);
  // The whole panel sits over the map as a veil with its own way out.
  expect(tree.root.findByType('Modal' as React.ElementType).props).toMatchObject({ transparent: true, animationType: 'fade' });
  expect(byLabel('Zatvori pretragu')).toHaveLength(1);
});

test('choices stay in context and remain selected, without applying or collapsing the active editor', async () => {
  view = { ...view, where: 'remote' }; await render();
  expect(placeValue()).toBe('Na daljinu');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Mesta' })).toHaveLength(0);
  expect(openStep()).toEqual(['gde']);
  await tap('Kada'); await choose('Ovaj vikend');
  expect(openStep()).toEqual(['kada']);
  expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
  await tap('Kako se radi');
  expect(radio('Na daljinu')[0].props.accessibilityState.checked).toBe(true);
  await tap('Kada');
  expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
  await tap('Cena');
  await choose('Tražim ponude'); expect(radio('Tražim ponude')[0].props.accessibilityState.checked).toBe(true);
  expect(openStep()).toEqual(['cena']); expect(apply).not.toHaveBeenCalled();
});

test('"Gde" offers only the places the loaded tasks name, with their counts; typing narrows them; a place, the map\'s area or every task', async () => {
  await render();
  // Own tasks participate in the same count; remote words are not places. Two spellings of one place are one.
  const offered = offeredPlaces().map(node => node.props.accessibilityLabel);
  expect(offered).toEqual(['Svi zadaci, 5 zadataka', 'Liman, Novi Sad, 2 zadatka', 'Vračar, Beograd, 1 zadatak', 'Zemun, Beograd, 1 zadatak']);
  expect(offered.join(' ')).not.toMatch(/Na daljinu|U blizini|Moja lokacija/);
  expect(texts()).not.toContain('Mesta iz dostupnih zadataka');
  // Typing narrows the places; the words themselves also search the tasks, so the count follows them.
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta i zadatke' }).props.onChangeText('vrač'));
  expect(offeredPlaces().map(node => node.props.accessibilityLabel)).toEqual(['Svi zadaci, 5 zadataka', 'Vračar, Beograd, 1 zadatak']);
  await choose('Vračar, Beograd, 1 zadatak');
  expect(openStep()).toEqual(['gde']);
  expect(placeValue()).toBe('Vračar, Beograd');
  expect(show().props.label).toBe('Prikaži 1 zadatak');
  await act(async () => show().props.onPress());
  expect(lastDraft()).toMatchObject({ place: 'Vračar, Beograd', query: '', area: null }); expect(close).toHaveBeenCalledTimes(1);
  // The map's current area is offered once the map has settled somewhere, with what the list would then hold: the two
  // public tasks (including mine) inside it and the online one, which no area leaves out.
  await act(async () => tree.unmount()); mapArea = [19.8, 45.2, 19.9, 45.3]; await render();
  await choose('Ova oblast, 4 zadatka');
  await act(async () => show().props.onPress());
  expect(lastDraft()).toMatchObject({ place: null, area: [19.8, 45.2, 19.9, 45.3] });
});

test('a range of dates needs two taps and stays open until its end; a past day cannot be chosen and says so', async () => {
  start = 'kada'; await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  expect(texts()).toContain('Septembar 2026');
  const past = dayCell(23);
  expect(past.props.accessibilityLabel).toBe('Sreda, 23. sep, prošao dan');
  expect(past.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true, selected: false } });
  expect(dayCell(24).props.accessibilityLabel).toBe('Četvrtak, 24. sep, danas');
  // The first tap starts the range and nothing moves on; it is already a choice of that one day, and counted so (the
  // four tasks of the 26th, including mine; the one of the 30th is not).
  await act(async () => dayCell(26).props.onPress());
  expect(openStep()).toEqual(['kada']); expect(texts()).toContain('Izaberi poslednji dan.');
  expect(dayCell(26).props.accessibilityState).toEqual({ disabled: false, selected: true });
  expect(show().props.label).toBe('Prikaži 4 zadatka');
  // The second tap ends it without moving the calendar: the days between are shaded and both ends are chosen.
  await act(async () => dayCell(28).props.onPress());
  expect(openStep()).toEqual(['kada']);
  expect(dateValue()).toBe('26–28. sep');
  expect([26, 27, 28].map(n => dayCell(n).props.accessibilityState.selected)).toEqual([true, true, true]);
  expect(dayCell(29).props.accessibilityState.selected).toBe(false);
  expect(tree.root.findAll(node => node.props.testID === 'range-band')).toHaveLength(3);
  expect(show().props.label).toBe('Prikaži 4 zadatka');
  // A day before the pending start starts the range again.
  await act(async () => dayCell(30).props.onPress()); await act(async () => dayCell(25).props.onPress());
  expect(openStep()).toEqual(['kada']); expect(texts()).toContain('Izaberi poslednji dan.');
});

test('tasks without a date are said, not hidden silently, when a time choice leaves them out', async () => {
  rows = [...rows, row('undated', { schedule: undefined }), row('incomplete', { schedule: { kind: 'FIXED_WINDOW', startsAt: null, endsAt: '2026-09-26T12:00:00+02:00' } })];
  start = 'kada'; await render();
  expect(texts()).not.toMatch(/bez datuma/);
  await choose('Ovaj vikend');
  expect(texts()).toContain('2 zadatka bez datuma nisu u ovom izboru.');
});

test('"Koliko vas dolazi" counts people from one: minus cannot go below one, and the count remains directly editable', async () => {
  start = 'koliko'; await render();
  const minus = () => byLabel('Smanji broj osoba')[0], plus = () => byLabel('Povećaj broj osoba')[0];
  expect(texts()).toContain('1 osoba');
  expect(minus().props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  expect(show().props.label).toBe('Prikaži 5 zadataka');
  await act(async () => plus().props.onPress()); await act(async () => plus().props.onPress());
  expect(texts()).toContain('3 osobe'); expect(openStep()).toEqual(['koliko']);
  expect(minus().props.disabled).toBe(false);
  // No task here has three open places: the one green action says so and cannot be pressed.
  expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
  await act(async () => minus().props.onPress());
  expect(show().props).toMatchObject({ label: 'Prikaži 5 zadataka', disabled: false });
  await act(async () => show().props.onPress());
  expect(lastDraft().places).toBe(2);
});

test('"Obriši uslove" empties the draft and counts every task again; × leaves the list exactly as it was', async () => {
  view = { ...view, price: 'OFFERS', when: 'weekend', place: 'Vračar, Beograd' }; await render();
  expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
  await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Obriši uslove')!.props.onPress());
  expect(show().props.label).toBe('Prikaži 5 zadataka');
  for (const [group, choice] of [['Kada', 'Bilo kada'], ['Kako se radi', 'Bilo gde'], ['Cena', 'Sve']]) {
    await tap(group); expect(radio(choice)[0].props.accessibilityState.checked).toBe(true);
  }
  expect(texts()).toContain('1 osoba');
  await act(async () => show().props.onPress());
  expect(lastDraft()).toEqual(NO_SEARCH);
  // A new panel starts from the list's own view again; × applies nothing.
  apply.mockReset(); close.mockReset(); await act(async () => tree.unmount()); await render();
  await tap('Kada'); expect(radio('Ovaj vikend')[0].props.accessibilityState.checked).toBe(true);
  await tap('Gde');
  await choose(/^Svi zadaci/);
  await tap('Zatvori pretragu');
  expect(apply).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
});

test('"Kako se radi" is offered only when a task says how it is done', async () => {
  rows = rows.filter(item => item.id !== 'remote'); await render();
  expect(tree.root.findAllByProps({ testID: 'search-step-kako' })).toHaveLength(0);
});

// Review of V47, item 15: a single tapped day is a choice of its own. Applied as it is, it is that one day.
test('one tapped day applies as a one-day range, and the step and the draft say that day', async () => {
  start = 'kada'; await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  await act(async () => dayCell(30).props.onPress());
  expect(show().props.label).toBe('Prikaži 1 zadatak');
  await tap('Datumi');
  expect(dateValue()).toBe('30. sep');
  await act(async () => show().props.onPress());
  expect(lastDraft()).toMatchObject({ dates: { from: '2026-09-30', to: '2026-09-30' }, when: 'any' });
});

// Review of V47, item 1: nothing is counted before the list is known. While it is read, or when it could not be read,
// "Gde" says no count at all (never "0 zadataka") and the one action says why it cannot be pressed; while only what is
// mine is still read, the action applies the draft without a number.
test.each([
  ['loading', 'Učitavamo zadatke…', true],
  ['error', 'Zadaci nisu učitani', true],
  ['pending', 'Prikaži zadatke', false],
] as const)('while the list is %s the panel counts nothing and its action says so', async (state, label, disabled) => {
  readiness = state; if (state !== 'pending') rows = []; mapArea = [19.8, 45.2, 19.9, 45.3];
  await render();
  expect(show().props).toMatchObject({ label, disabled });
  const offered = offeredPlaces().map(node => node.props.accessibilityLabel);
  expect(offered[0]).toBe('Svi zadaci'); expect(offered).toContain('Ova oblast');
  expect(offered.join(' ')).not.toMatch(/zadat/);
  expect(texts()).not.toMatch(/\d+ zadat/);
  if (state === 'pending') {
    await act(async () => show().props.onPress());
    expect(apply).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
  }
  // Once the list is known, the counts are back.
  readiness = 'ready'; await act(async () => tree.update(panelOf()));
  expect(radio(/^Svi zadaci/)[0].props.accessibilityLabel).toMatch(/^Svi zadaci, \d+ zadat/);
});

// Review of V47, item 9: with a screen reader on, a choice never moves the open card away from where the focus is.
test('with a screen reader on, a single-tap choice stays on its step', async () => {
  const reader = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  const listeners: ((enabled: boolean) => void)[] = [], remove = jest.fn();
  const listen = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
    if (event !== 'screenReaderChanged') return { remove: jest.fn() };
    listeners.push(handler); return { remove };
  }) as never);
  try {
    start = 'kada'; await render();
    await choose('Ovaj vikend');
    expect(openStep()).toEqual(['kada']);
    expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
    // Turning the screen reader off also leaves the selection in place.
    await act(async () => listeners[0](false));
    await choose('Sutra');
    expect(openStep()).toEqual(['kada']);
    await act(async () => tree.unmount());
    expect(remove).toHaveBeenCalledTimes(1);
  } finally { reader.mockRestore(); listen.mockRestore(); }
});

test('what changes is heard: the action\'s count, the month and the prompt for the last day are polite live regions', async () => {
  start = 'kada'; await render();
  expect(tree.root.findByProps({ testID: 'search-show' }).props.accessibilityLiveRegion).toBe('polite');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  const month = tree.root.findAllByType('T' as React.ElementType).find(node => node.children.includes('Septembar 2026'))!;
  expect(month.props.accessibilityLiveRegion).toBe('polite');
  await act(async () => dayCell(26).props.onPress());
  const prompt = tree.root.findAllByType('T' as React.ElementType).find(node => node.children.join('') === 'Izaberi poslednji dan.')!;
  expect(prompt.props.accessibilityLiveRegion).toBe('polite');
});

// Review of V47, item 10: one chosen-chip look over the map and in the panel, and never the primary action's green fill.
// A chosen day's number is written in the system's words-on-dark-green colour, as the calendar's chosen day.
test('a chosen chip has a neutral well, ink edge and words, and a confirmation tick; a chosen day is written in onDark', async () => {
  start = 'kada'; await render();
  await choose('Sutra');
  const chip = radio('Sutra')[0], style = StyleSheet.flatten(chip.props.style);
  expect(style).toMatchObject({ backgroundColor: sys.color.greenSoft, borderWidth: 2, borderColor: sys.color.ink });
  expect(style.backgroundColor).not.toBe(sys.color.green);
  expect(chip.findByType('Check' as React.ElementType).props.color).toBe(sys.color.green);
  expect(StyleSheet.flatten(chip.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.ink);
  const free = StyleSheet.flatten(radio('Danas')[0].props.style);
  // The free chip's 1 px edge plus its padding is the chosen chip's 2 px edge plus its padding: the words do not move.
  expect(Number(free.borderWidth) + Number(free.paddingHorizontal)).toBe(Number(style.borderWidth) + Number(style.paddingHorizontal));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  await act(async () => dayCell(26).props.onPress());
  const end = tree.root.findByProps({ testID: 'range-end' });
  expect(StyleSheet.flatten(end.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.onDark);
});

// The place summary keeps a full text column; calendar selection never spills into its neighbouring cell.
test('at large text place and condition labels can wrap, and the chosen circle never spills out of its cell', async () => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1 }; await render();
  const place = () => tree.root.findByProps({ testID: 'search-place-toggle' });
  expect(StyleSheet.flatten(place().props.style).flexDirection).toBe('row');
  await act(async () => tree.unmount());
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1.3 }; await render();
  await tap('Kada'); // The closed Gde card exposes its real summary; only Kada's editor is mounted.
  expect(StyleSheet.flatten(place().props.style).flexDirection).toBe('row');
  const [label, value] = place().findAllByType('T' as React.ElementType);
  expect(label.parent).toBe(value.parent);
  expect(StyleSheet.flatten(value.parent!.props.style)).toMatchObject({ flex: 1, minWidth: 0 });
  expect(value.props.numberOfLines).toBe(3);
  const chip = radio('Narednih 7 dana')[0];
  expect(StyleSheet.flatten(chip.props.style).maxWidth).toBe('100%');
  expect(StyleSheet.flatten(chip.findByType('T' as React.ElementType).props.style).flexShrink).toBe(1);
  expect(chip.findByType('T' as React.ElementType).props.numberOfLines).toBeUndefined();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  const grid = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function'
    && StyleSheet.flatten(node.props.style)?.marginHorizontal === -sys.space.md)[0];
  expect(grid).toBeDefined();
  // 320 dp, less the panel's and the card's side paddings, plus the grid's bleed: 294 across, 42 a day.
  await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 294, height: 300 } } }));
  await act(async () => dayCell(26).props.onPress());
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 40, height: 40, borderRadius: 20 });
  await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 266, height: 300 } } }));
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 36, height: 36, borderRadius: 18 });
});

test('the 361dp phone gives the people label its own row without changing the draft or footer behavior', async () => {
  start = 'koliko';
  mockWindow = { ...mockWindow, width: 411, fontScale: 1 }; await render();
  const layout = () => StyleSheet.flatten(tree.root.findByProps({ testID: 'search-people-layout' }).props.style);
  expect(layout().flexDirection).toBe('row');
  await tap('Povećaj broj osoba');
  mockWindow = { ...mockWindow, width: 361, fontScale: 1.15 };
  await act(async () => tree.update(panelOf()));
  expect(layout()).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
  expect(StyleSheet.flatten(byLabel('Povećaj broj osoba')[0].parent!.props.style).width).toBe('100%');
  expect(texts()).toContain('2 osobe');
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-actions' }).props.style).flexDirection).toBe('row');
  expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  await act(async () => show().props.onPress());
  expect(lastDraft().places).toBe(2); expect(close).toHaveBeenCalledTimes(1);
});

test('the clear-text button and the suggestions take no touch beyond themselves, and the field is the system\'s one field', async () => {
  await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta i zadatke' }).props.onChangeText('vrač'));
  const clear = byLabel('Obriši pretragu')[0];
  expect(clear.props.hitSlop).toBe(0); expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ width: 48, height: 48 });
  for (const suggestion of offeredPlaces()) expect(suggestion.props.hitSlop).toBe(0);
  const field = tree.root.findAll(node => String(node.type) === 'View' && StyleSheet.flatten(node.props.style)?.minHeight === 52)[0];
  expect(StyleSheet.flatten(field.props.style)).toMatchObject({ borderColor: sys.color.lineStrong, borderRadius: sys.radius.control });
});

test('search text uses the bundled medium face without asking the platform to synthesize its weight', async () => {
  await render();
  const style = StyleSheet.flatten(tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta i zadatke' }).props.style);
  expect(style.fontFamily).toBe('Inter-Medium');
  expect(style.fontWeight).toBeUndefined();
});

test('expanding the calendar reveals it once after current natural measurements; later layouts keep manual scroll', async () => {
  const scrollTo = jest.fn();
  const frames: FrameRequestCallback[] = [];
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  start = 'kada';
  await act(async () => { tree = create(panelOf(), { createNodeMock: node => node.type === 'ScrollView' ? { scrollTo } : null }); });
  await tap('Datumi');
  const editor = () => tree.root.findByProps({ testID: 'search-date-editor' });
  await act(async () => editor().props.onLayout({ nativeEvent: { layout: { y: 252 } } }));
  expect(scrollTo).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'search-body-kada' }).props.onLayout({ nativeEvent: { layout: { y: 72 } } }));
  await act(async () => tree.root.findByProps({ testID: 'search-step-kada' }).props.onLayout({ nativeEvent: { layout: { y: 88 } } }));
  await act(async () => tree.root.findByType('ScrollView' as React.ElementType).props.onContentSizeChange(400, 1200));
  await act(async () => { frames.splice(0).forEach(frame => frame(0)); });
  expect(scrollTo).toHaveBeenCalledWith({ y: 88 + 72 + 252 - sys.touch.min - 2 * sys.space.md, animated: false });
  await act(async () => editor().props.onLayout({ nativeEvent: { layout: { y: 280 } } }));
  await act(async () => { frames.splice(0).forEach(frame => frame(0)); });
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(apply).not.toHaveBeenCalled();
});

describe('native-height disclosure and owned reveal', () => {
  let frames: Map<number, FrameRequestCallback>, nextFrame: number, scrollTo: jest.Mock;
  const layout = async (id: string, y: number) => act(async () => {
    tree.root.findByProps({ testID: id }).props.onLayout({ nativeEvent: { layout: { y } } });
  });
  const settle = async () => act(async () => {
    tree.root.findByType('ScrollView' as React.ElementType).props.onContentSizeChange(400, 1600);
    const pending = [...frames.values()]; frames.clear(); pending.forEach(frame => frame(0));
  });
  const measureCalendar = async () => {
    await layout('search-step-kada', 88); await layout('search-body-kada', 72); await layout('search-date-editor', 252);
  };
  beforeEach(async () => {
    frames = new Map(); nextFrame = 0; scrollTo = jest.fn(); start = 'kada';
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => { if (typeof id === 'number') frames.delete(id); });
    await act(async () => { tree = create(panelOf(), { createNodeMock: node => node.type === 'ScrollView' ? { scrollTo } : null }); });
  });

  test('calendar weeks and helper stay in intrinsic native View containers without height/clipping animation', async () => {
    await tap('Datumi');
    for (const id of ['search-step-kada', 'search-body-kada', 'search-date-editor']) {
      const node = tree.root.findByProps({ testID: id }), style = StyleSheet.flatten(node.props.style);
      expect(node.type).toBe('View');
      expect(node.props.layout).toBeUndefined(); expect(node.props.entering).toBeUndefined();
      expect(style.height).toBeUndefined(); expect(style.maxHeight).toBeUndefined(); expect(style.overflow).toBeUndefined();
    }
    expect(texts(tree.root.findByProps({ testID: 'search-date-editor' }))).toContain('Izaberi prvi i poslednji dan.');
    await tap('Sledeći mesec'); await tap('Sledeći mesec'); // November has six week rows, September has five.
    expect(texts()).toContain('Novembar 2026');
    expect(texts(tree.root.findByProps({ testID: 'search-date-editor' }))).toContain('Izaberi prvi i poslednji dan.');
    expect(scrollTo).not.toHaveBeenCalled();
  });

  test('old group/body positions cannot admit the newly opened calendar', async () => {
    await layout('search-step-kada', 12); await layout('search-body-kada', 72);
    await tap('Datumi'); await layout('search-date-editor', 252); await settle();
    expect(scrollTo).not.toHaveBeenCalled();
    await layout('search-step-kada', 88); await settle(); expect(scrollTo).not.toHaveBeenCalled();
    await layout('search-body-kada', 72); await settle();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 88 + 72 + 252 - sys.touch.min - 2 * sys.space.md, animated: false });
  });

  test('content-size settling uses the newest current measurements once', async () => {
    await tap('Datumi'); await measureCalendar();
    await layout('search-date-editor', 280); await settle();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 88 + 72 + 280 - sys.touch.min - 2 * sys.space.md, animated: false });
    await layout('search-date-editor', 300); await settle(); expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  test('an equal-height replacement editor can reveal without another content-size event', async () => {
    await tap('Cena'); await layout('search-step-cena', 500); await layout('search-body-cena', 72);
    await act(async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(frame => frame(0)); });
    expect(scrollTo).toHaveBeenCalledWith({ y: 500 - sys.space.md, animated: false });
  });

  test.each(['manual', 'switch', 'close', 'unmount'] as const)('%s retires even an already queued reveal callback', async boundary => {
    await tap('Datumi'); await measureCalendar();
    const oldFrame = [...frames.values()].at(-1)!;
    const oldEditor = tree.root.findByProps({ testID: 'search-date-editor' }).props.onLayout;
    const oldContent = tree.root.findByType('ScrollView' as React.ElementType).props.onContentSizeChange;
    if (boundary === 'manual') await act(async () => tree.root.findByType('ScrollView' as React.ElementType).props.onScrollBeginDrag());
    else if (boundary === 'switch') await tap('Cena');
    else if (boundary === 'close') await tap('Zatvori pretragu');
    else await act(async () => tree.unmount());
    await act(async () => {
      oldFrame(0); oldEditor({ nativeEvent: { layout: { y: 999 } } }); oldContent(400, 1600);
      const pending = [...frames.values()]; frames.clear(); pending.forEach(frame => frame(0));
    });
    expect(scrollTo).not.toHaveBeenCalled();
    if (boundary === 'switch') {
      await layout('search-step-cena', 500); await layout('search-body-cena', 72); await settle();
      expect(scrollTo).toHaveBeenCalledWith({ y: 500 - sys.space.md, animated: false });
    }
  });

  test('screen reader admission suppresses pending automatic scrolling', async () => {
    // The hook follows an accessibility event; a reader enabled after the gesture still owns focus.
    let readerChanged!: (enabled: boolean) => void;
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((event: string, handler: (enabled: boolean) => void) => {
      if (event !== 'screenReaderChanged') return { remove: jest.fn() };
      readerChanged = handler; return { remove: jest.fn() };
    }) as never);
    await act(async () => tree.unmount());
    await act(async () => { tree = create(panelOf(), { createNodeMock: node => node.type === 'ScrollView' ? { scrollTo } : null }); });
    await tap('Datumi'); await measureCalendar();
    await act(async () => readerChanged(true));
    await act(async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(frame => frame(0)); });
    expect(scrollTo).not.toHaveBeenCalled();
    await act(async () => readerChanged(false));
    await layout('search-date-editor', 280); await settle();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

test.each([[320, 1], [320, 2], [412, 1.3], [412, 2]])(
  'at %i dp / %s text, both footer actions have their own width without applying the draft during reflow', async (width, fontScale) => {
    mockWindow = { ...mockWindow, width: 412, fontScale: 1 }; await render();
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-actions' }).props.style).flexDirection).toBe('row');
    await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta i zadatke' }).props.onChangeText('Vračar'));
    mockWindow = { ...mockWindow, width, fontScale };
    await act(async () => tree.update(panelOf()));
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-actions' }).props.style)).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
    expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'search-show' }).props.style)).toMatchObject({ flex: 0, width: '100%' });
    expect(apply).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
    expect(show().props.label).toBe('Prikaži 1 zadatak');
    await act(async () => show().props.onPress());
    expect(lastDraft().query).toBe('Vračar'); expect(close).toHaveBeenCalledTimes(1);
  },
);

test('P6 draft preview follows the map area by value: an equal clone asks for nothing, another area asks once', async () => {
  mapArea = [19, 44, 21, 46];
  const seam = p6Seam(p6Snapshot());p6Search = seam;
  await render();
  expect(seam.onDraft).toHaveBeenCalledTimes(1);
  // The route hands the panel a fresh clone of its view with every snapshot; the same area in another array is not a new question.
  for (let again = 0; again < 3; again++) { mapArea = [...mapArea!] as PublicBounds; await act(async () => tree.update(panelOf())); }
  expect(seam.onDraft).toHaveBeenCalledTimes(1);
  mapArea = [19.5, 44.5, 20.5, 45.5];
  await act(async () => tree.update(panelOf()));
  expect(seam.onDraft).toHaveBeenCalledTimes(2);
  expect(seam.onDraft).toHaveBeenLastCalledWith(expect.anything(), [19.5, 44.5, 20.5, 45.5]);
});
