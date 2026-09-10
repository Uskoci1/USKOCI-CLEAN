import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
let mockReduced = false;
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
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('phosphor-react-native', () => ({ Clock: 'Icon', MapPin: 'Icon', Users: 'Icon', MagnifyingGlass: 'Icon', SlidersHorizontal: 'Icon', User: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/v2/DiscoveryMap', () => ({ DiscoveryMap: 'DiscoveryMap' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';
const row = (id: string, patch = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', uslovi: ['Alat', 'Iskustvo', 'Prevoz'], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' }, pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25, lng: 19.83 }, ...patch } as MarketplaceItem);
let rows = [row('one'), row('two', { priblizno: null, rezimCene: 'OFFERS' })], owned = false, loading = false, error = false;
let snapshot: MarketplaceView, initial: MarketplaceView; const open = jest.fn(), refresh = jest.fn(), switchView = jest.fn();
function Screen() { const [view, setView] = useState(initial); snapshot = view; return <MarketplacePresentation owned={owned} items={rows} loading={loading} error={error} scopeKey="a:1" view={view} onView={setView} onOpen={open} onRefresh={refresh} onSwitch={switchView} onProfile={() => {}} onNew={() => {}} />; }
let tree: ReactTestRenderer;
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const action = (label: string) => tree.root.findByProps({ label });
const tap = async (label: string) => act(async () => press(label).props.onPress());
const click = async (label: string) => act(async () => action(label).props.onPress());
const map = () => tree.root.findByType('DiscoveryMap' as React.ElementType);
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async () => act(async () => { tree = create(<Screen />); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); initial = initialMarketplaceView(); rows = [row('one'), row('two', { priblizno: null, rezimCene: 'OFFERS' })]; owned = loading = error = mockReduced = false; open.mockClear(); refresh.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });
test('List/Map preserves search and viewport; panning alone keeps same exact result set', async () => {
 await render(); await act(async () => press('Pretraži zadatke').props.onChangeText('Novi Sad')); await tap('Mapa');
 expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['one', 'two']);
 const viewport = { center: [0, 0], zoom: 6, bounds: [-1, -1, 1, 1] };
 await act(async () => map().props.onViewport(viewport)); expect(map().props.items).toHaveLength(2); expect(snapshot.area).toBeNull();
 await tap('Lista'); expect(press('Pretraži zadatke').props.value).toBe('Novi Sad'); await tap('Mapa'); expect(map().props.viewport).toEqual(viewport);
});
test('explicit area applies identical subset to both modes and removal restores unlocated items', async () => {
 await render(); await tap('Mapa'); await act(async () => map().props.onSearchArea([19, 45, 20, 46])); expect(map().props.items.map((item: MarketplaceItem) => item.id)).toEqual(['one']);
 await tap('Lista'); expect(tree.root.findAllByType('List' as React.ElementType)[0].findAllByProps({ accessibilityLabel: 'Otvorite priliku Pomoć two' })).toHaveLength(0);
 await click('Ukloni oblast'); expect(press('Otvorite priliku Pomoć two')).toBeTruthy();
});
test('filter working copy can cancel and hardware back does not apply; Apply preserves selected choice', async () => {
 await render(); await tap('Filteri'); await tap('Tražim ponude'); await click('Odustani od filtera'); expect(snapshot.price).toBe('all');
 await tap('Filteri'); await tap('Navedena cena'); await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose()); expect(snapshot.price).toBe('all');
 await tap('Filteri'); await tap('Tražim ponude'); await click('Prikaži zadatke'); expect(snapshot.price).toBe('OFFERS'); expect(press('Otvorite priliku Pomoć two')).toBeTruthy(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvorite priliku Pomoć one' })).toHaveLength(0);
});
test('only a visible real point produces selected preview; actual detail callback receives same row', async () => {
 await render(); await tap('Mapa'); await act(async () => map().props.onSelect('two')); expect(tree.root.findAllByProps({ label: 'Otvori detalj Zadatka' })).toHaveLength(0);
 await act(async () => map().props.onSelect('unknown')); expect(tree.root.findAllByProps({ label: 'Otvori detalj Zadatka' })).toHaveLength(0);
 await act(async () => map().props.onSelect('one')); await click('Otvori detalj Zadatka'); expect(open).toHaveBeenCalledWith(rows[0]);
 await click('Zatvori pregled pina'); expect(snapshot.selectedId).toBeNull();
});
test.each(['loading', 'error'])('%s removes stale cards/map; retry is bound', async status => {
 initial.mode = 'map'; loading = status === 'loading'; error = status === 'error'; await render();
 expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0); expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvorite priliku Pomoć one' })).toHaveLength(0);
 if (error) { await click('Pokušajte ponovo'); expect(refresh).toHaveBeenCalledTimes(1); }
});
test('owned active/draft/attention filters use actual rows and full long title remains readable', async () => {
 owned = true; const long = 'Pomoć pri prenošenju i raspoređivanju nameštaja u Novom Sadu '.repeat(3); rows = [row('one', { naslov: long, stanje: 'OBJAVLJENA', brojPrijava: 1 }), row('two', { stanje: 'NACRT', brojPrijava: 0 })];
 await render(); expect(texts()).toContain(long); await tap('Treba moja radnja'); expect(snapshot.attention).toBe(true); await tap('Nacrti'); expect(texts()).toContain('Nema zadataka u ovom prikazu');
 await tap('Treba moja radnja'); expect(press('Otvorite Zadatak Pomoć two')).toBeTruthy();
});
test('reduced motion sheet is immediate; no unbound GPS, proximity or geocoding controls appear', async () => {
 mockReduced = true; await render(); await tap('Filteri'); expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
 expect(JSON.stringify(tree.toJSON())).not.toMatch(/GPS|Moja lokacija|km od|geocod/i);
});
