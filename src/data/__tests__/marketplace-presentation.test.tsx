import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../marketplaceView';
import BottomSheet from '@gorhom/bottom-sheet';
import { sys } from '../../ui/system/tokens';
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
// Reanimated is the shared Jest stand-in (__mocks__/react-native-reanimated.js): since review r3 item 9 the task card's
// frame is an Animated.View that gives under the finger, so a hand-written partial copy here no longer suffices.
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: 'InboxBell' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

/**
 * Moji zadaci (MarketplacePresentation). Since owner step 4 (2026-09-24) the Zadaci tab is DiscoveryPresentation, the map
 * under a list sheet, and this presentation draws only my own tasks. The discovery cases that used to live here moved
 * with the screen they guard (review r3b):
 *   - list/map switch, pin preview, "Pogledaj listu", hidden-own-tasks line: retired with the switch, and pinned as
 *     absent in discovery-presentation ("one screen", "my own tasks are simply not listed");
 *   - search over the map, applied price filter, area, filter draft, "Dodaj zadatak", pin card: discovery-presentation;
 *   - the discovery header name, stale cards while reading or failing, reduced motion, no GPS wording, the brand action
 *     in the filter sheet and "Obriši uslove" keeping the map: zadaci-guards-from-marketplace;
 *   - discovery cards carry no applications foot: marketplace-owned-screens and task-card-face.
 */
const row = (id: string, patch = {}): MarketplaceItem => ({ id, revizija: 1, naslov: `Pomoć ${id}`, opis: '', stanje: 'OBJAVLJENA', podrucjeTekst: 'Novi Sad',
  vremeTekst: 'Po dogovoru', uslovi: ['Alat', 'Iskustvo', 'Prevoz'], rezimCene: 'MY_PRICE', ponudjenaCena: { prikaz: '2.000 RSD' },
  pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, brojPrijava: 0, brojPrijavaZaIzbor: 0, priblizno: null, ...patch } as MarketplaceItem);
const baseRows = () => [row('one'), row('two', { rezimCene: 'OFFERS' })];
let rows = baseRows(), loading = false, error = false;
let snapshot: MarketplaceView, initial: MarketplaceView; const open = jest.fn(), refresh = jest.fn(), newTask = jest.fn(), applications = jest.fn(); let allowNew = true;
let withBack = false; const back = jest.fn();
function Screen() { const [view, setView] = useState(initial); snapshot = view; return <MarketplacePresentation items={rows} loading={loading} error={error} view={view} onView={setView} onOpen={open} onRefresh={refresh} onProfile={() => {}} onNew={allowNew ? newTask : undefined} onBack={withBack ? back : undefined} onApplications={applications} />; }
let tree: ReactTestRenderer;
const press = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const action = (label: string) => tree.root.findByProps({ label });
const tap = async (label: string) => act(async () => press(label).props.onPress());
const click = async (label: string) => act(async () => (label === 'Prikaži zadatke'
 ? tree.root.findAllByType('Action' as React.ElementType).find(node => /^Prikaži \d+ zadat/.test(node.props.label))!
 : action(label)).props.onPress());
const texts = () => tree.root.findAllByType('T' as React.ElementType).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const words = () => tree.root.findAllByType('T' as React.ElementType).map(node => node.props.children);
const cards = () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^Otvori Zadatak /.test(node.props.accessibilityLabel ?? ''));
const render = async () => act(async () => { tree = create(<Screen />); });
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); initial = initialMarketplaceView(); rows = baseRows(); loading = error = mockReduced = false; allowNew = true; withBack = false; open.mockClear(); refresh.mockClear(); newTask.mockClear(); applications.mockClear(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('search opens from the header with the keyboard; clearing it keeps price, attention and section', async () => {
 initial.price = 'MY_PRICE';
 await render(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži zadatke' })).toHaveLength(0);
 await tap('Pretraga'); expect(press('Pretraži zadatke').props.autoFocus).toBe(true);
 await act(async () => press('Pretraži zadatke').props.onChangeText('Nema takvog posla'));
 expect(texts()).toContain('Nema zadataka u ovom prikazu');
 await tap('Obriši pretragu');
 expect(snapshot).toMatchObject({ query: '', price: 'MY_PRICE', attention: false, section: 'active' });
 expect(press('Otvori Zadatak Pomoć one')).toBeTruthy();
});
test('the active tab speaks tasks waiting for a choice, then removes the count when none remain', async () => {
 rows = [row('waiting', { brojPrijavaZaIzbor: 3 }), row('ready'), row('draft', { stanje: 'NACRT', brojPrijavaZaIzbor: 5 })];
 await render();
 expect(press('Aktivni').props.accessibilityValue).toEqual({ text: 'Za tvoj izbor: 1 zadatak' });
 expect(cards()).toHaveLength(2);
 rows = rows.map(item => ({ ...item, brojPrijavaZaIzbor: 0 }));
 await act(async () => tree.update(<Screen />));
 expect(press('Aktivni').props.accessibilityValue).toEqual({ text: '' });
 expect(cards()).toHaveLength(2);
});
test('filter working copy can cancel and hardware back does not apply; Apply preserves selected choice', async () => {
 await render(); await tap('Filteri'); await tap('Tražim ponude'); await click('Odustani od filtera'); expect(snapshot.price).toBe('all');
 await tap('Filteri'); await tap('Navedena cena'); await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose()); expect(snapshot.price).toBe('all');
 await tap('Filteri'); await tap('Tražim ponude'); await click('Prikaži zadatke'); expect(snapshot.price).toBe('OFFERS'); expect(press('Otvori Zadatak Pomoć two')).toBeTruthy(); expect(tree.root.findAllByProps({ accessibilityLabel: 'Otvori Zadatak Pomoć one' })).toHaveLength(0);
});
test('drag/backdrop closure discards filter drafts and opens nothing', async () => {
 await render(); await tap('Filteri'); await tap('Tražim ponude');
 expect(action('Prikaži 1 zadatak')).toBeTruthy();
 await act(async () => tree.root.findByType(BottomSheet).props.onClose());
 expect(snapshot.price).toBe('all'); expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
 await tap('Filteri'); expect(press('Svi načini').props.accessibilityState.checked).toBe(true);
 expect(open).not.toHaveBeenCalled();
});
test('filter count uses the same search and section as Apply, including zero real matches', async () => {
 rows = [...baseRows(), row('three', { stanje: 'NACRT' })]; initial.query = 'Pomoć one';
 await render(); await tap('Filteri'); expect(action('Prikaži 1 zadatak')).toBeTruthy();
 await tap('Tražim ponude'); expect(action('Prikaži 0 zadataka')).toBeTruthy();
 await click('Prikaži zadatke'); expect(snapshot).toMatchObject({ price: 'OFFERS', query: 'Pomoć one', section: 'active' });
 expect(texts()).toContain('Nema zadataka u ovom prikazu');
});
test.each(['loading', 'error'])('%s removes stale cards; retry is bound', async status => {
 loading = status === 'loading'; error = status === 'error'; await render();
 expect(cards()).toHaveLength(0);
 if (error) { await click('Pokušaj ponovo'); expect(refresh).toHaveBeenCalledTimes(1); }
});
test('owned active/draft/attention filters use actual rows and full long title remains readable', async () => {
 const long = 'Pomoć pri prenošenju i raspoređivanju nameštaja u Novom Sadu '.repeat(3); rows = [row('one', { naslov: long, stanje: 'OBJAVLJENA', brojPrijava: 1 }), row('two', { stanje: 'NACRT', brojPrijava: 0 })];
 await render(); expect(texts()).toContain(long); await tap('Filteri'); await tap('Treba moja radnja');
 expect(snapshot.attention).toBe(false); await click('Prikaži zadatke'); expect(snapshot.attention).toBe(true);
 await tap('Nacrti'); expect(texts()).toContain('Nema zadataka u ovom prikazu');
 await tap('Filteri, aktivni'); await tap('Treba moja radnja'); await click('Prikaži zadatke'); expect(press('Otvori Zadatak Pomoć two')).toBeTruthy();
});

test('attention and price are one filter draft: cancel, system back and reset have consistent effects', async () => {
 rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 1 })];
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
// Owner's information architecture, 2026-09-23: my own tasks are reached from Početna, where "Objavi zadatak" is.
// The orange "+" that floated over their cards covered a price, and the eyebrow "Moje aktivnosti" only said where you are.
test('my own tasks carry no floating creation action and no eyebrow; an empty list still offers the first task inline', async () => {
 withBack = true; rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijava: 0 }), row('two', { stanje: 'OBJAVLJENA', brojPrijava: 0 })];
 await render();
 expect(press('Otvori Zadatak Pomoć one')).toBeTruthy();
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Dodaj zadatak' })).toHaveLength(0);
 expect(texts()).toContain('Moji zadaci'); expect(texts()).not.toContain('Moje aktivnosti');
 // Nothing of the retired discovery branch is drawn: no list/map switch and no map.
 for (const retired of ['Lista', 'Mapa', 'Prikaz zadataka', 'Pogledaj listu']) expect(tree.root.findAllByProps({ accessibilityLabel: retired })).toHaveLength(0);
 expect(tree.root.findAllByType('DiscoveryMap' as React.ElementType)).toHaveLength(0);
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
// Review r3 item 7: the filtered-empty view's one way forward clears what was chosen, and only that.
test('"Obriši uslove" clears search, price, attention and section, and asks for nothing', async () => {
 Object.assign(initial, { query: 'Nema takvog posla', price: 'MY_PRICE', attention: true, section: 'drafts' });
 await render(); expect(texts()).toContain('Nema zadataka u ovom prikazu');
 await click('Obriši uslove');
 expect(snapshot).toEqual(initialMarketplaceView()); expect(press('Otvori Zadatak Pomoć two')).toBeTruthy();
 expect(open).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
});
test('"Pokušaj ponovo" after a failed read asks for the list again and changes nothing else', async () => {
 error = true; initial.query = 'Pomoć'; initial.section = 'history'; await render();
 expect(texts()).toContain('Zadatke trenutno nije moguće učitati');
 await click('Pokušaj ponovo');
 expect(refresh).toHaveBeenCalledTimes(1); expect(snapshot).toMatchObject({ query: 'Pomoć', section: 'history' });
});

// One task card (step 5a, 2026-09-24): on my own list the card's foot goes straight to the applications waiting for my
// choice, with the very row that was pressed; the body still opens the task.
test('my own task\'s foot opens its applications with that row; the body still opens the task', async () => {
 withBack = true; rows = [row('one', { stanje: 'CEKA_PRIJAVE', brojPrijava: 3, brojPrijavaZaIzbor: 2 }), row('two', { stanje: 'OBJAVLJENA', brojPrijava: 0, brojPrijavaZaIzbor: 0 })];
 await render();
 expect(tree.root.findAllByProps({ accessibilityLabel: '2 prijave čekaju izbor, Pomoć one' }).length).toBeGreaterThan(0);
 await tap('2 prijave čekaju izbor, Pomoć one'); expect(applications).toHaveBeenCalledWith(rows[0]); expect(open).not.toHaveBeenCalled();
 await tap('Otvori Zadatak Pomoć one'); expect(open).toHaveBeenCalledWith(rows[0]); expect(applications).toHaveBeenCalledTimes(1);
 // Nothing to choose is said quietly and is not a target.
 expect(texts()).toContain('Još nema prijava za izbor');
 expect(tree.root.findAll(node => String(node.props.accessibilityLabel).includes('Pomoć two') && node.props.accessibilityLabel !== 'Otvori Zadatak Pomoć two' && typeof node.props.onPress === 'function')).toHaveLength(0);
});
// Review r3 item 8: the box's corner is the named `check` token, not a magic 6 dressed up as a nested corner.
test('"Treba moja radnja" is a square checkbox, not a round radio', async () => {
 rows = [row('one', { stanje: 'OBJAVLJENA', brojPrijavaZaIzbor: 1 })]; await render(); await tap('Filteri');
 const box = press('Treba moja radnja').findAllByType('View' as React.ElementType)[0];
 const radio = press('Svi načini').findAllByType('View' as React.ElementType)[0];
 expect(box.props.style[0]).toMatchObject({ width: 22, height: 22, borderRadius: sys.radius.check });
 expect(sys.radius.check).toBe(6);
 expect(radio.props.style[0]).toMatchObject({ width: 22, height: 22, borderRadius: 999 });
});
// Review r3 item 10: a card under a section named for its state does not say that state again ("Nacrt" on every card
// under Nacrti, "Zatvoren" under Istorija); where the section does not say it, the card still does.
test('a card does not repeat the state its section is named for, and still says it elsewhere', async () => {
 rows = [row('draft', { stanje: 'NACRT' }), row('closed', { stanje: 'ZATVORENA' }), row('partial', { stanje: 'DELIMICNO_POPUNJENA', pokrivenost: { ukupno: 2, popunjeno: 1, preostalo: 1, udeo: 0.5 } })];
 await render(); expect(words()).toContain('Delimično popunjen');
 await tap('Nacrti'); expect(press('Otvori Zadatak Pomoć draft')).toBeTruthy(); expect(words()).not.toContain('Nacrt');
 await tap('Istorija'); expect(press('Otvori Zadatak Pomoć closed')).toBeTruthy(); expect(words()).not.toContain('Zatvoren');
 await act(async () => tree.unmount()); initial.section = 'all'; await render();
 for (const state of ['Nacrt', 'Zatvoren', 'Delimično popunjen']) expect(words()).toContain(state);
});
