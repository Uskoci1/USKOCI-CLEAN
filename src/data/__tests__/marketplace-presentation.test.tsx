import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import BottomSheet from '@gorhom/bottom-sheet';
let mockReduced = false;
jest.mock('react-native', () => {
 const native = jest.requireActual('react-native'), React = require('react');
 return new Proxy(native, { get(target, key) {
  if (key === 'FlatList') return ({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ...props }: any) => React.createElement('List', props, ListHeaderComponent, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent);
  if (key === 'Modal') return ({ visible, children, ...props }: any) => visible ? React.createElement('Modal', props, children) : null;
  if (key === 'Keyboard') return { dismiss: jest.fn() };
  return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput'].includes(String(key)) ? key : Reflect.get(target, key);
 } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'View' },
  FadeInDown: { duration: () => ({ delay: () => ({}) }) } }));
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';
const row = (id: string, patch = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', uslovi: ['Alat', 'Iskustvo', 'Prevoz'], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.83 }, ...patch } as MarketplaceItem);
let rows = [row('one'), row('two', { priblizno: null, rezimCene: 'OFFERS' })], owned = false, loading = false, error = false;
let snapshot: MarketplaceView, initial: MarketplaceView; const open = jest.fn(), refresh = jest.fn(), newTask = jest.fn(); let allowNew = true;
let relations: { owned: ReadonlySet<string>; applied: ReadonlySet<string> } | undefined;
let withBack = false; const back = jest.fn();
function Screen() { const [view, setView] = useState(initial); snapshot = view; return <MarketplacePresentation owned={owned} items={rows} loading={loading} error={error} scopeKey="a:1" view={view} onView={setView} onOpen={open} onRefresh={refresh} onProfile={() => {}} onNew={allowNew ? newTask : undefined} onBack={withBack ? back : undefined} relations={relations} />; }
let tree: ReactTestRenderer;
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const action = (label: string) => tree.root.findByProps({ label });
const tap = async (label: string) => act(async () => press(label).props.onPress());
const click = async (label: string) => act(async () => (label === 'Prikaži zadatke'
 ? tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat/.test(node.props.label))!
 : action(label)).props.onPress());
const map = () => tree.root.findByType('DiscoveryMap' as React.ElementType);
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async () => act(async () => { tree = create(<Screen />); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); initial = initialMarketplaceView(); rows = [row('one'), row('two', { priblizno: null, rezimCene: 'OFFERS' })]; owned = loading = error = mockReduced = false; allowNew = true; relations = undefined; withBack = false; open.mockClear(); refresh.mockClear(); newTask.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });
test('List/Map preserves search and viewport; panning alone keeps same exact result set', async () => {
 await render(); await act(async () => press('Pretraži zadatke').props.onChangeText('Novi Sad')); await tap('Mapa');
 expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['one', 'two']);
 const viewport = { center: [0, 0], zoom: 6, bounds: [-1, -1, 1, 1] };
 await act(async () => map().props.onViewport(viewport)); expect(map().props.items).toHaveLength(2); expect(snapshot.area).toBeNull();
 await tap('Lista'); expect(press('Pretraži zadatke').props.value).toBe('Novi Sad'); await tap('Mapa'); expect(map().props.viewport).toEqual(viewport);
});
test('discovery search is available immediately without opening the keyboard; clearing it preserves other choices', async () => {
 initial.price = 'MY_PRICE'; initial.area = [19, 45, 20, 46];
 await render(); expect(press('Pretraži zadatke').props.autoFocus).toBe(false);
 await act(async () => press('Pretraži zadatke').props.onChangeText('Nema takvog posla'));
 expect(texts()).toContain('Nema zadataka u ovom prikazu');
 await tap('Obriši pretragu');
 expect(snapshot).toMatchObject({ query: '', price: 'MY_PRICE', area: initial.area });
 expect(press('Otvori priliku Pomoć one')).toBeTruthy();
});

test('removing the visible price filter preserves search, area and map position', async () => {
 initial.price = 'OFFERS'; initial.query = 'Pomoć'; initial.mode = 'map';
 initial.area = [19, 45, 20, 46];
 initial.viewport = { center: [19.83, 45.25], zoom: 12, bounds: initial.area };
 await render(); expect(texts()).toContain('Nema zadataka u ovom prikazu');
 await tap('Ukloni filter cene');
 expect(snapshot).toMatchObject({ price: 'all', query: 'Pomoć', area: initial.area, viewport: initial.viewport, mode: 'map' });
 expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['one']);
 expect(press('Mapa').props.accessibilityState.selected).toBe(true);
 expect(press('Lista').props.accessibilityState.selected).toBe(false);
 expect(open).not.toHaveBeenCalled();
});
test('explicit area applies identical subset to both modes and removal restores unlocated items', async () => {
 await render(); await tap('Mapa'); await act(async () => map().props.onSearchArea([19, 45, 20, 46])); expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['one']);
 await tap('Lista'); expect(tree.root.findAllByType('List' as React.ElementType)[0].findAllByProps({ accessibilityLabel: 'Otvori priliku Pomoć two' })).toHaveLength(0);
 await click('Ukloni oblast'); expect(press('Otvori priliku Pomoć two')).toBeTruthy();
});
test('filter working copy can cancel and hardware back does not apply; Apply preserves selected choice', async () => {
 await render(); await tap('Filteri'); await tap('Tražim ponude'); await click('Odustani od filtera'); expect(snapshot.price).toBe('all');
 await tap('Filteri'); await tap('Navedena cena'); await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose()); expect(snapshot.price).toBe('all');
 await tap('Filteri'); await tap('Tražim ponude'); await click('Prikaži zadatke'); expect(snapshot.price).toBe('OFFERS'); expect(press('Otvori priliku Pomoć two')).toBeTruthy(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvori priliku Pomoć one' })).toHaveLength(0);
});
test('only a visible real point produces selected preview; actual detail callback receives same row', async () => {
 await render(); await tap('Mapa'); await act(async () => map().props.onSelect('two')); expect(tree.root.findAllByProps({ label: 'Otvori detalj Zadatka' })).toHaveLength(0);
 await act(async () => map().props.onSelect('unknown')); expect(tree.root.findAllByProps({ label: 'Otvori detalj Zadatka' })).toHaveLength(0);
 await act(async () => map().props.onSelect('one')); await click('Otvori detalj Zadatka'); expect(open).toHaveBeenCalledWith(rows[0]);
 expect(snapshot.selectedId).toBeNull(); expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
 await act(async () => map().props.onSelect('one')); await click('Zatvori pregled pina'); expect(snapshot.selectedId).toBeNull();
});

test('drag/backdrop closure discards filter drafts and clears only the selected map preview', async () => {
 await render(); await tap('Filteri'); await tap('Tražim ponude');
 expect(action('Prikaži 1 zadatak')).toBeTruthy();
 await act(async () => tree.root.findByType(BottomSheet).props.onClose());
 expect(snapshot.price).toBe('all'); expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
 await tap('Filteri'); expect(press('Svi načini').props.accessibilityState.checked).toBe(true);
 await click('Odustani od filtera'); await tap('Mapa');
 const viewport = { center: [19.83, 45.25], zoom: 12, bounds: [19, 45, 20, 46] };
 await act(async () => map().props.onViewport(viewport)); await act(async () => map().props.onSelect('one'));
 await act(async () => tree.root.findByType(BottomSheet).props.onClose());
 expect(snapshot).toMatchObject({ selectedId: null, viewport, mode: 'map', price: 'all' });
 expect(open).not.toHaveBeenCalled();
});

test('filter count uses the same search and map area as Apply, including zero real matches', async () => {
 initial.mode = 'map'; initial.area = [19, 45, 20, 46]; initial.query = 'Pomoć';
 await render(); await tap('Filteri'); expect(action('Prikaži 1 zadatak')).toBeTruthy();
 await tap('Tražim ponude'); expect(action('Prikaži 0 zadataka')).toBeTruthy();
 await click('Prikaži zadatke'); expect(snapshot).toMatchObject({ price: 'OFFERS', query: 'Pomoć', area: initial.area });
 expect(texts()).toContain('Nema zadataka u ovom prikazu');
});
test.each(['loading', 'error'])('%s removes stale cards/map; retry is bound', async status => {
 initial.mode = 'map'; loading = status === 'loading'; error = status === 'error'; await render();
 expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0); expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvori priliku Pomoć one' })).toHaveLength(0);
 if (error) { await click('Pokušaj ponovo'); expect(refresh).toHaveBeenCalledTimes(1); }
});
test('owned active/draft/attention filters use actual rows and full long title remains readable', async () => {
 owned = true; const long = 'Pomoć pri prenošenju i raspoređivanju nameštaja u Novom Sadu '.repeat(3); rows = [row('one', { naslov: long, stanje: 'OBJAVLJENA', brojPrijava: 1 }), row('two', { stanje: 'NACRT', brojPrijava: 0 })];
 await render(); expect(texts()).toContain(long); await tap('Filteri'); await tap('Treba moja radnja');
 expect(snapshot.attention).toBe(false); await click('Prikaži zadatke'); expect(snapshot.attention).toBe(true);
 await tap('Nacrti'); expect(texts()).toContain('Nema zadataka u ovom prikazu');
 await tap('Filteri, aktivni'); await tap('Treba moja radnja'); await click('Prikaži zadatke'); expect(press('Otvori Zadatak Pomoć two')).toBeTruthy();
});

test('attention and price are one filter draft: cancel, system back and reset have consistent effects', async () => {
 owned = true; rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 1 })];
 await render(); await tap('Filteri'); await tap('Treba moja radnja'); await tap('Tražim ponude');
 await click('Odustani od filtera'); expect(snapshot).toMatchObject({ attention: false, price: 'all' });
 await tap('Filteri'); await tap('Treba moja radnja');
 await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose());
 expect(snapshot.attention).toBe(false);
 await tap('Filteri'); await tap('Treba moja radnja'); await tap('Navedena cena'); await click('Prikaži zadatke');
 expect(snapshot).toMatchObject({ attention: true, price: 'MY_PRICE' });
 await tap('Filteri, aktivni'); await click('Poništi izbor');
 expect(snapshot).toMatchObject({ attention: true, price: 'MY_PRICE' });
 await click('Prikaži zadatke'); expect(snapshot).toMatchObject({ attention: false, price: 'all' });
});
test('requester creation stays reachable from both discovery list and map, while worker discovery has no creation action', async () => {
 await render(); expect(press('Dodaj zadatak')).toBeTruthy(); await tap('Dodaj zadatak'); expect(newTask).toHaveBeenCalledTimes(1);
 // It is never a floating button over content: on the map it hid a task pin, in the list it covered the price
 // a person compares down the cards (phone, 2026-09-23). It sits in the tools row beside search and filters,
 // the same press in both views, and no second creation action is drawn anywhere.
 await tap('Mapa');
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj zadatak' })).toHaveLength(1);
 expect(tree.root.findAllByProps({ label: 'Dodaj zadatak' })).toHaveLength(0);
 await tap('Dodaj zadatak'); expect(newTask).toHaveBeenCalledTimes(2);
 await act(async () => tree.unmount()); allowNew = false; await render();
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj zadatak' })).toHaveLength(0);
 expect(tree.root.findAllByProps({ label: 'Dodaj zadatak' })).toHaveLength(0);
});
// Owner's information architecture, 2026-09-23: my own tasks are reached from Početna, where "Objavi zadatak" is.
// The orange "+" that floated over their cards covered a price, and the eyebrow "Moje aktivnosti" only said where you are.
test('my own tasks carry no floating creation action and no eyebrow; an empty list still offers the first task inline', async () => {
 owned = true; withBack = true; rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 }), row('two', { stanje: 'OBJAVLJENA', brojPrijava: 0 })];
 await render();
 expect(press('Otvori Zadatak Pomoć one')).toBeTruthy();
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj zadatak' })).toHaveLength(0);
 expect(texts()).toContain('Moji zadaci'); expect(texts()).not.toContain('Moje aktivnosti');
 await act(async () => tree.unmount()); rows = []; await render();
 // The same words as Početna's "Moji zadaci" door for an account with no task: "Zadatak" is the product's noun.
 expect(texts()).toContain('Još nemaš Zadatak');
 await click('Napravi prvi Zadatak'); expect(newTask).toHaveBeenCalledTimes(1);
});
test('reduced motion sheet is immediate; no unbound GPS, proximity or geocoding controls appear', async () => {
 mockReduced = true; await render(); await tap('Filteri'); expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
 expect(tree.root.findByType(BottomSheet).props.animateOnMount).toBe(false);
 expect(tree.root.findByType(BottomSheet).props.animationConfigs.duration).toBe(0);
 expect(JSON.stringify(tree.toJSON())).not.toMatch(/GPS|Moja lokacija|km od|geocod/i);
});

// The tasks a person posted are not what they came to Prilike for (owner's rule of place: what you
// need constantly is on the screen, the rest is one tap away).
test('discovery hides the tasks I posted by default, says how many, and shows them on a tap — in the list and on the map', async () => {
 rows = [row('one'), row('mine'), row('two', { priblizno: null, rezimCene: 'OFFERS' })];
 relations = { owned: new Set(['mine']), applied: new Set() };
 await render();
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvori priliku Pomoć mine' })).toHaveLength(0);
 expect(texts()).toContain('2 zadatka'); expect(texts()).toContain('1 tvoj zadatak je sakriven · Prikaži');
 await tap('Prikaži i moje zadatke');
 expect(press('Otvori priliku Pomoć mine')).toBeTruthy(); expect(texts()).toContain('3 zadatka'); expect(texts()).toContain('Sakrij moje');
 await tap('Sakrij moje zadatke');
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvori priliku Pomoć mine' })).toHaveLength(0);
 await tap('Mapa');
 expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['one', 'two']);
});
test('Moji zadaci and a discovery without relations show everything, as before', async () => {
 rows = [row('one'), row('mine')]; relations = undefined; await render();
 expect(press('Otvori priliku Pomoć mine')).toBeTruthy(); expect(texts()).not.toContain('sakriven');
});
