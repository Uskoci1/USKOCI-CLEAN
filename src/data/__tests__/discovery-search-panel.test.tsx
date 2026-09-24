import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView, type PublicBounds } from '../marketplaceView';
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
import { DiscoverySearchPanel, NO_SEARCH, type SearchDraft, type SearchReadiness, type SearchStep } from '../../ui/v2/discovery/DiscoverySearchPanel';
import { sys } from '../../ui/system/tokens';

/**
 * The Zadaci search panel (Discovery V47): Airbnb's step cards in USKOČI's look. One card is open at a time and every other
 * is a row that says its value; a single-tap choice moves on to the next step still unset, a choice of several taps (a
 * range of dates, the count of people) waits until it is complete. "Gde" offers only places the loaded tasks name. The
 * choices are a draft: the one green action applies it and counts it, "Obriši sve" empties it, × leaves the list as it was.
 */
// Thursday 24 September 2026, 10:00 in Belgrade: the 23rd is past, the 26th and 27th are the weekend.
const NOW = new Date('2026-09-24T08:00:00Z');
const day = (date: string) => ({ schedule: { kind: 'FIXED_WINDOW' as const, startsAt: `${date}T10:00:00+02:00`, endsAt: `${date}T12:00:00+02:00` } });
const row = (id: string, patch: Record<string, unknown> = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Liman, Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: [], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 2000, valuta: 'RSD', prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.84 }, taskTimezone: 'Europe/Belgrade',
  ...day('2026-09-26'), ...patch } as unknown as MarketplaceItem);
let rows: MarketplaceItem[] = [], view: MarketplaceView, mine: ReadonlySet<string> | undefined, mapArea: PublicBounds | null, start: SearchStep;
let readiness: SearchReadiness = 'ready';
const apply = jest.fn(), close = jest.fn();
let tree: ReactTestRenderer;
const panelOf = () => <DiscoverySearchPanel items={rows} view={view} mine={mine} now={NOW} mapArea={mapArea}
  start={start} reduced={false} readiness={readiness} onApply={apply} onClose={close} />;
const render = async () => act(async () => { tree = create(panelOf()); });
const byLabel = (label: string) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityLabel === label);
const tap = async (label: string) => act(async () => byLabel(label)[0].props.onPress());
const radio = (label: string | RegExp) => tree.root.findAll(node => String(node.type) === 'Press' && node.props.accessibilityRole === 'radio'
  && (typeof label === 'string' ? node.props.accessibilityLabel === label : label.test(node.props.accessibilityLabel)));
const choose = async (label: string | RegExp) => act(async () => radio(label)[0].props.onPress());
const texts = (root: ReactTestInstance = tree.root) => root.findAllByType('T' as React.ElementType)
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' | ');
/** Which step is open: the one card that asks its question. */
const openStep = () => tree.root.findAll(node => String(node.type) === 'View' && /^search-step-/.test(node.props.testID ?? ''))
  .map(node => String(node.props.testID).replace('search-step-', ''));
/** The closed steps: collapsed buttons that say their value. */
const rowsSaid = () => tree.root.findAll(node => String(node.type) === 'Press' && /^search-step-/.test(node.props.testID ?? ''))
  .map(node => [node.props.accessibilityLabel, node.props.accessibilityValue.text, node.props.accessibilityState.expanded]);
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
  view = { ...initialMarketplaceView(), mode: 'map' }; mine = new Set(['mine']); mapArea = null; start = 'gde'; readiness = 'ready';
  mockWindow = { width: 750, height: 1334, scale: 2, fontScale: 2 };
  apply.mockReset(); close.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('exactly one step is open and asks its question; every other is one collapsed row that says its value, and a tap opens only it', async () => {
  await render();
  expect(openStep()).toEqual(['gde']); expect(texts()).toContain('Gde?');
  expect(rowsSaid()).toEqual([['Kada', 'Bilo kada', false], ['Kako se radi', 'Bilo gde', false], ['Koliko vas dolazi', 'Bilo koliko', false], ['Cena', 'Sve', false]]);
  await tap('Cena');
  expect(openStep()).toEqual(['cena']);
  expect(rowsSaid().map(([label]) => label)).toEqual(['Gde', 'Kada', 'Kako se radi', 'Koliko vas dolazi']);
  // "Uslovi pretrage" opens the panel at its conditions.
  await act(async () => tree.unmount()); start = 'kada'; await render();
  expect(openStep()).toEqual(['kada']);
  // The whole panel sits over the map as a veil with its own way out.
  expect(tree.root.findByType('Modal' as React.ElementType).props).toMatchObject({ transparent: true, animationType: 'fade' });
  expect(byLabel('Zatvori pretragu')).toHaveLength(1);
});

test('a single-tap choice moves on to the next step still unset, skipping one already chosen; the chosen value is said on its row', async () => {
  view = { ...view, where: 'remote' }; await render();
  await choose(/^Svi zadaci/);
  expect(openStep()).toEqual(['kada']);
  await choose('Ovaj vikend');
  // "Kako se radi" is already chosen (Na daljinu), so the choice moves on to "Koliko vas dolazi".
  expect(openStep()).toEqual(['koliko']);
  expect(rowsSaid()).toEqual(expect.arrayContaining([['Kada', 'Ovaj vikend', false], ['Kako se radi', 'Na daljinu', false]]));
  // A tap on a closed row reopens only that step.
  await tap('Kada'); expect(openStep()).toEqual(['kada']);
  expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
  // The last step with nothing unset after it stays open once chosen.
  await tap('Cena'); await choose('Tražim ponude'); expect(openStep()).toEqual(['cena']);
});

test('"Gde" offers only the places the loaded tasks name, with their counts; typing narrows them; a place, the map\'s area or every task', async () => {
  await render();
  // My own task's place and a remote task's words are never offered; two spellings of one place are one.
  const offered = radio(/./).map(node => node.props.accessibilityLabel);
  expect(offered).toEqual(['Svi zadaci, 4 zadatka', 'Liman, Novi Sad, 2 zadatka', 'Vračar, Beograd, 1 zadatak']);
  expect(texts()).not.toMatch(/Zemun|Na daljinu|U blizini|Moja lokacija/);
  // Typing narrows the places; the words themselves also search the tasks, so the count follows them.
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta i zadatke' }).props.onChangeText('vrač'));
  expect(radio(/./).map(node => node.props.accessibilityLabel)).toEqual(['Svi zadaci, 4 zadatka', 'Vračar, Beograd, 1 zadatak']);
  await choose('Vračar, Beograd, 1 zadatak');
  expect(openStep()).toEqual(['kada']);
  expect(rowsSaid()[0]).toEqual(['Gde', 'Vračar, Beograd', false]);
  expect(show().props.label).toBe('Prikaži 1 zadatak');
  await act(async () => show().props.onPress());
  expect(lastDraft()).toMatchObject({ place: 'Vračar, Beograd', query: '', area: null }); expect(close).toHaveBeenCalledTimes(1);
  // The map's current area is offered once the map has settled somewhere, with what the list would then hold: the two
  // tasks inside it and the online one, which no area leaves out.
  await act(async () => tree.unmount()); mapArea = [19.8, 45.2, 19.9, 45.3]; await render();
  await choose('Oblast sa mape, 3 zadatka');
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
  // three tasks of the 26th; the one of the 30th is not).
  await act(async () => dayCell(26).props.onPress());
  expect(openStep()).toEqual(['kada']); expect(texts()).toContain('Izaberi poslednji dan.');
  expect(dayCell(26).props.accessibilityState).toEqual({ disabled: false, selected: true });
  expect(show().props.label).toBe('Prikaži 3 zadatka');
  // The second tap ends it: the days between are shaded, both ends are chosen, and the next unset step opens.
  await act(async () => dayCell(28).props.onPress());
  expect(openStep()).toEqual(['kako']);
  expect(rowsSaid()[1]).toEqual(['Kada', '26–28. sep', false]);
  await tap('Kada');
  expect([26, 27, 28].map(n => dayCell(n).props.accessibilityState.selected)).toEqual([true, true, true]);
  expect(dayCell(29).props.accessibilityState.selected).toBe(false);
  expect(tree.root.findAll(node => node.props.testID === 'range-band')).toHaveLength(3);
  expect(show().props.label).toBe('Prikaži 3 zadatka');
  // A day before the pending start starts the range again.
  await act(async () => dayCell(30).props.onPress()); await act(async () => dayCell(25).props.onPress());
  expect(openStep()).toEqual(['kada']); expect(texts()).toContain('Izaberi poslednji dan.');
});

test('tasks without a date are said, not hidden silently, when a time choice leaves them out', async () => {
  rows = [...rows, row('undated', { schedule: undefined }), row('incomplete', { schedule: { kind: 'FIXED_WINDOW', startsAt: null, endsAt: '2026-09-26T12:00:00+02:00' } })];
  start = 'kada'; await render();
  expect(texts()).not.toMatch(/bez datuma/);
  await choose('Ovaj vikend');
  await tap('Kada');
  expect(texts()).toContain('2 zadatka bez datuma nisu u ovom izboru.');
});

test('"Koliko vas dolazi" counts people from one: minus cannot go below one, and the count stays open for more taps', async () => {
  start = 'koliko'; await render();
  const minus = () => byLabel('Smanji broj osoba')[0], plus = () => byLabel('Povećaj broj osoba')[0];
  expect(texts()).toContain('1 osoba');
  expect(minus().props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
  expect(show().props.label).toBe('Prikaži 4 zadatka');
  await act(async () => plus().props.onPress()); await act(async () => plus().props.onPress());
  expect(texts()).toContain('3 osobe'); expect(openStep()).toEqual(['koliko']);
  expect(minus().props.disabled).toBe(false);
  // No task here has three open places: the one green action says so and cannot be pressed.
  expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
  await act(async () => minus().props.onPress());
  expect(show().props).toMatchObject({ label: 'Prikaži 4 zadatka', disabled: false });
  await act(async () => show().props.onPress());
  expect(lastDraft().places).toBe(2);
});

test('"Obriši sve" empties the draft and counts every task again; × leaves the list exactly as it was', async () => {
  view = { ...view, price: 'OFFERS', when: 'weekend', place: 'Vračar, Beograd' }; await render();
  expect(show().props).toMatchObject({ label: 'Nema zadataka za ove uslove', disabled: true });
  await act(async () => tree.root.findAllByType('Action' as React.ElementType).find(node => node.props.label === 'Obriši sve')!.props.onPress());
  expect(show().props.label).toBe('Prikaži 4 zadatka');
  expect(rowsSaid()).toEqual([['Kada', 'Bilo kada', false], ['Kako se radi', 'Bilo gde', false], ['Koliko vas dolazi', 'Bilo koliko', false], ['Cena', 'Sve', false]]);
  await act(async () => show().props.onPress());
  expect(lastDraft()).toEqual(NO_SEARCH);
  // A new panel starts from the list's own view again; × applies nothing.
  apply.mockReset(); close.mockReset(); await act(async () => tree.unmount()); await render();
  expect(rowsSaid()[0]).toEqual(['Kada', 'Ovaj vikend', false]);
  await choose(/^Svi zadaci/);
  await tap('Zatvori pretragu');
  expect(apply).not.toHaveBeenCalled(); expect(close).toHaveBeenCalledTimes(1);
});

test('"Kako se radi" is offered only when a task says how it is done', async () => {
  rows = rows.filter(item => item.id !== 'remote'); await render();
  expect(rowsSaid().map(([label]) => label)).toEqual(['Kada', 'Koliko vas dolazi', 'Cena']);
});

// Review of V47, item 15: a single tapped day is a choice of its own. Applied as it is, it is that one day.
test('one tapped day applies as a one-day range, and the step and the draft say that day', async () => {
  start = 'kada'; await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  await act(async () => dayCell(30).props.onPress());
  expect(show().props.label).toBe('Prikaži 1 zadatak');
  await tap('Cena');
  expect(rowsSaid()[1]).toEqual(['Kada', '30. sep', false]);
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
  const offered = radio(/./).map(node => node.props.accessibilityLabel);
  expect(offered[0]).toBe('Svi zadaci'); expect(offered).toContain('Oblast sa mape');
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
  const listen = jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: string, handler: (enabled: boolean) => void) => {
    listeners.push(handler); return { remove };
  }) as never);
  try {
    start = 'kada'; await render();
    await choose('Ovaj vikend');
    expect(openStep()).toEqual(['kada']);
    expect(radio('Ovaj vikend')[0].props.accessibilityState).toEqual({ checked: true });
    // The screen reader is turned off: the panel moves on again, as it does for everyone.
    await act(async () => listeners[0](false));
    await choose('Sutra');
    expect(openStep()).toEqual(['kako']);
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
test('a chosen chip is pale green with a 2 px green edge, green words and a tick; a chosen day is written in onDark', async () => {
  start = 'kada'; await render();
  await choose('Sutra'); await tap('Kada');
  const chip = radio('Sutra')[0], style = StyleSheet.flatten(chip.props.style);
  expect(style).toMatchObject({ backgroundColor: sys.color.greenSoft, borderWidth: 2, borderColor: sys.color.green });
  expect(style.backgroundColor).not.toBe(sys.color.green);
  expect(chip.findByType('Check' as React.ElementType).props.color).toBe(sys.color.green);
  expect(StyleSheet.flatten(chip.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.green);
  const free = StyleSheet.flatten(radio('Danas')[0].props.style);
  // The free chip's 1 px edge plus its padding is the chosen chip's 2 px edge plus its padding: the words do not move.
  expect(Number(free.borderWidth) + Number(free.paddingHorizontal)).toBe(Number(style.borderWidth) + Number(style.paddingHorizontal));
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  await act(async () => dayCell(26).props.onPress());
  const end = tree.root.findByProps({ testID: 'range-end' });
  expect(StyleSheet.flatten(end.findByType('T' as React.ElementType).props.style).color).toBe(sys.color.onDark);
});

// Review of V47, item 16: at large text (320 dp, 1.3 and up) a closed step says its name over its value, so neither is cut
// to a few letters; at the usual size they share one row. The month grid gives each day all the width there is, and a
// chosen day's circle is never wider than its cell.
test('at large text a closed step stacks its name over its value; the chosen circle never spills out of its cell', async () => {
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1 }; await render();
  const kada = () => tree.root.findAll(node => String(node.type) === 'Press' && node.props.testID === 'search-step-kada')[0];
  expect(StyleSheet.flatten(kada().props.style).flexDirection).toBe('row');
  await act(async () => tree.unmount());
  mockWindow = { width: 320, height: 640, scale: 2, fontScale: 1.3 }; await render();
  expect(StyleSheet.flatten(kada().props.style).flexDirection).toBe('column');
  const [label, value] = kada().findAllByType('T' as React.ElementType);
  expect(StyleSheet.flatten(label.props.style).flexShrink).toBe(1);
  expect(value.props.numberOfLines).toBe(2); expect(StyleSheet.flatten(value.props.style).textAlign).toBe('left');
  await tap('Kada');
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Datumi' }).props.onPress());
  const grid = tree.root.findAll(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function'
    && StyleSheet.flatten(node.props.style)?.marginHorizontal === -sys.space.md)[0];
  expect(grid).toBeDefined();
  // 320 dp, less the panel's and the card's side paddings, plus the grid's bleed: 294 across, 42 a day.
  await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 294, height: 300 } } }));
  await act(async () => dayCell(26).props.onPress());
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 40, height: 40 });
  await act(async () => grid.props.onLayout({ nativeEvent: { layout: { width: 266, height: 300 } } }));
  expect(StyleSheet.flatten(tree.root.findByProps({ testID: 'range-end' }).props.style)).toMatchObject({ width: 36, height: 36 });
});

test('the clear-text button and the suggestions take no touch beyond themselves, and the field is the system\'s one field', async () => {
  await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Pretraži mesta i zadatke' }).props.onChangeText('vrač'));
  const clear = byLabel('Obriši pretragu')[0];
  expect(clear.props.hitSlop).toBe(0); expect(StyleSheet.flatten(clear.props.style)).toMatchObject({ width: 48, height: 48 });
  for (const suggestion of radio(/./)) expect(suggestion.props.hitSlop).toBe(0);
  const field = tree.root.findAll(node => String(node.type) === 'View' && StyleSheet.flatten(node.props.style)?.minHeight === 52)[0];
  expect(StyleSheet.flatten(field.props.style)).toMatchObject({ borderColor: sys.color.lineStrong, borderRadius: sys.radius.control });
});
