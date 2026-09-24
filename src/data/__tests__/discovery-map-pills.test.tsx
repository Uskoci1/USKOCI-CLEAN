import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { MarketplaceItem, PublicViewport } from '../marketplaceView';
let mockFocused = true, mockReduced = false, mockRendered: unknown[] = [], mockLeaves: unknown[] = [];
const mockExpand = jest.fn(), mockEase = jest.fn(), mockJump = jest.fn(), mockZoom = jest.fn(), mockProject = jest.fn(), mockUnproject = jest.fn();
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const host = (name: string, handle: () => object) => React.forwardRef(({ children, ...props }: any, ref: any) => {
    React.useImperativeHandle(ref, handle); return React.createElement(name, props, children);
  });
  return { Layer: 'Layer', ViewAnnotation: 'Annotation',
    Map: host('NativeMap', () => ({ queryRenderedFeatures: async () => mockRendered, project: mockProject, unproject: mockUnproject })),
    Camera: host('Camera', () => ({ easeTo: mockEase, jumpTo: mockJump, zoomTo: mockZoom })),
    GeoJSONSource: host('Source', () => ({ getClusterExpansionZoom: mockExpand, getClusterLeaves: async () => mockLeaves })) };
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } }); });
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { DiscoveryMap, PILL_LIMIT } from '../../ui/v2/DiscoveryMap';
import { PricePill } from '../../ui/v2/discovery/PricePill';
import { sys } from '../../ui/system/tokens';

/**
 * The Zadaci map's pins (owner step 4, 2026-09-24; critique B10). The native source still carries only IDs and rounded
 * points; the map says which pins stand on their own at this zoom, and those become price pills drawn from the current
 * read. Tasks rounded to one public point are one place that can be reached, and a chosen pin is brought into view.
 */
const row = (id: string, lat: number, lng: number, patch: Record<string, unknown> = {}) => ({ id, naslov: `Posao ${id}`, rezimCene: 'MY_PRICE',
  ponudjenaCena: { iznos: 6000, valuta: 'RSD', prikaz: '6.000 RSD' }, priblizno: { lat, lng }, pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 },
  uslovi: [], podrucjeTekst: 'Beograd', vremeTekst: 'Po dogovoru', ...patch } as unknown as MarketplaceItem);
const HITNO = { urgency: { level: 'HITNO', expiresAt: '2999-01-01T00:00:00Z' } };
const base = () => [row('money', 44.81, 20.46), row('offer', 44.83, 20.41, { rezimCene: 'OFFERS', ponudjenaCena: undefined }),
  row('stack-1', 44.79, 20.45), row('stack-2', 44.7904, 20.4498), row('urgent', 44.80, 20.50, HITNO), row('noprice', 44.85, 20.40, { ponudjenaCena: undefined })];
const feature = (needId: string) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { needId } });
let rows = base(), selectedId: string | null = null, selectedPlace: string | null = null, busy = false, extra: Record<string, unknown> = {};
const select = jest.fn(), selectPlace = jest.fn(), setViewport = jest.fn(), search = jest.fn(), list = jest.fn();
function Screen() {
  return <DiscoveryMap items={rows} scopeKey="a:1" viewport={null as PublicViewport | null} selectedId={selectedId} selectedPlace={selectedPlace}
    onSelect={select} onSelectPlace={selectPlace} onViewport={setViewport} onSearchArea={search} onList={list} busy={busy} {...extra} />;
}
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Screen />); });
const update = async () => act(async () => tree.update(<Screen />));
const native = () => tree.root.findByType('NativeMap' as React.ElementType);
const source = () => tree.root.findByType('Source' as React.ElementType);
const annotations = () => tree.root.findAllByType('Annotation' as React.ElementType);
const pills = () => tree.root.findAllByType(PricePill).map(pill => pill.props);
const ready = async () => act(async () => { native().props.onDidFinishLoadingMap(); });
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style);
beforeEach(() => {
  jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {});
  rows = base(); selectedId = null; selectedPlace = null; busy = false; extra = {}; mockFocused = true; mockReduced = false;
  mockRendered = ['money', 'offer', 'stack-1', 'stack-2', 'urgent', 'noprice', 'money'].map(feature); mockLeaves = [];
  for (const fn of [mockExpand, mockEase, mockJump, mockZoom, mockProject, mockUnproject, select, selectPlace, setViewport, search, list]) fn.mockReset();
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('pins that stand alone become price pills; the native source still holds only IDs and rounded points', async () => {
  await render(); await ready();
  expect(source().props.data.features.map((item: { properties: object }) => item.properties)).toEqual(rows.map(item => ({ needId: item.id })));
  expect(JSON.stringify(source().props.data)).not.toMatch(/RSD|Ponude|Posao/);
  expect(source().props.cluster).toBe(true);
  // One pill per public point: the duplicate rendered feature and the second task of the stack add none.
  expect(annotations()).toHaveLength(5);
  expect(pills().map(pill => [pill.content.text, pill.content.tone, !!pill.urgent])).toEqual([
    ['6.000 RSD', 'money', false], ['Ponude', 'offer', false], ['2 zadatka', 'count', false], ['6.000 RSD', 'money', true], ['', 'none', false]]);
});

test('a word about money never wears the money colour or weight; the amount does; HITNO keeps its danger cue', async () => {
  const draw = async (content: React.ComponentProps<typeof PricePill>['content'], urgent = false) => {
    let pill!: ReactTestRenderer; await act(async () => { pill = create(<PricePill content={content} urgent={urgent} />); });
    const words = pill.root.findAllByType('T' as React.ElementType)[0];
    const frame = pill.root.findByProps({ testID: 'price-pill' });
    return { words: words && flat(words), frame: flat(frame), lightning: pill.root.findAllByType('Lightning' as React.ElementType) };
  };
  const money = await draw({ text: '6.000 RSD', tone: 'money', spoken: '6.000 RSD' });
  expect(money.words).toMatchObject({ color: sys.color.money, fontWeight: '600', fontSize: 13, lineHeight: 16 });
  expect(money.frame).toMatchObject({ backgroundColor: sys.color.surface, borderColor: sys.color.line });
  const offer = await draw({ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' });
  expect(offer.words.color).toBe(sys.color.muted); expect(offer.words.color).not.toBe(sys.color.money); expect(offer.words.fontWeight).not.toBe('600');
  const none = await draw({ text: '', tone: 'none', spoken: 'Cena nije navedena' });
  expect(none.words).toBeUndefined();
  const urgent = await draw({ text: '6.000 RSD', tone: 'money', spoken: '6.000 RSD' }, true);
  expect(urgent.frame.borderColor).toBe(sys.color.danger); expect(urgent.lightning[0].props.color).toBe(sys.color.danger);
  let chosen!: ReactTestRenderer; await act(async () => { chosen = create(<PricePill content={{ text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' }} selected />); });
  expect(flat(chosen.root.findByProps({ testID: 'price-pill' }))).toMatchObject({ backgroundColor: sys.color.green });
  expect(flat(chosen.root.findAllByType('T' as React.ElementType)[0]).color).toBe(sys.color.onGreen);
});

test('pressing a pill chooses its task, and a pill several tasks share chooses the place', async () => {
  await render(); await ready();
  const byText = (text: string) => annotations().find(node => node.findByType(PricePill).props.content.text === text)!;
  await act(async () => byText('Ponude').props.onPress()); expect(select).toHaveBeenCalledWith('offer');
  await act(async () => byText('2 zadatka').props.onPress()); expect(selectPlace).toHaveBeenCalledWith('44.79,20.45'); expect(select).toHaveBeenCalledTimes(1);
});

test('the chosen task or place is one green pill of its own at the canonical point', async () => {
  await render(); await ready();
  selectedId = 'money'; await update();
  const chosen = annotations().filter(node => node.props.id === 'selected-need');
  expect(chosen).toHaveLength(1); expect(chosen[0].props.lngLat).toEqual([20.46, 44.81]);
  expect(chosen[0].findByType(PricePill).props).toMatchObject({ selected: true, content: { text: '6.000 RSD', tone: 'money' } });
  expect(annotations().filter(node => node.props.id === 'pill-44.81,20.46')).toHaveLength(0);
  selectedId = null; selectedPlace = '44.79,20.45'; await update();
  const place = annotations().find(node => node.props.id === 'selected-place')!;
  expect(place.findByType(PricePill).props).toMatchObject({ selected: true, content: { text: '2 zadatka', tone: 'count' } });
});

test('a cluster that is only one stacked point opens the place instead of zooming to a spot where one pin hides the other', async () => {
  await render(); await ready();
  const cluster = { type: 'Feature', geometry: { type: 'Point', coordinates: [20.45, 44.79] }, properties: { cluster: true, cluster_id: 3, point_count: 2 } };
  mockLeaves = [feature('stack-1'), feature('stack-2')];
  await act(async () => source().props.onPress({ nativeEvent: { features: [cluster] }, stopPropagation: jest.fn() }));
  expect(selectPlace).toHaveBeenCalledWith('44.79,20.45'); expect(mockExpand).not.toHaveBeenCalled();
  // A cluster of different points still opens by zooming in.
  mockLeaves = [feature('stack-1'), feature('money')]; mockExpand.mockResolvedValue(14);
  await act(async () => source().props.onPress({ nativeEvent: { features: [cluster] }, stopPropagation: jest.fn() }));
  expect(mockExpand).toHaveBeenCalledWith(3); expect(selectPlace).toHaveBeenCalledTimes(1);
});

test('a newly chosen pin is eased into the clear band between the tools and its card, at once under reduced motion', async () => {
  extra = { toolsBottom: 60, focusBottom: 300 }; mockProject.mockResolvedValue([200, 500]); mockUnproject.mockResolvedValue([20.47, 44.8]);
  await render();
  const frame = tree.root.find(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
  await act(async () => frame.props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } }));
  await ready();
  selectedId = 'money'; await update();
  // The clear band runs from 60 to 800 − 300; its middle is 280, so the pin at y 500 moves by 400 − 280.
  expect(mockProject).toHaveBeenCalledWith([20.46, 44.81]); expect(mockUnproject).toHaveBeenCalledWith([200, 620]);
  expect(mockEase).toHaveBeenCalledWith({ center: [20.47, 44.8], duration: sys.motion.camera });
  await act(async () => tree.unmount());
  mockReduced = true; selectedId = null; mockEase.mockReset(); await render(); await ready(); selectedId = 'offer'; await update();
  expect(mockJump).toHaveBeenCalledWith({ center: [20.41, 44.83] }); expect(mockEase).not.toHaveBeenCalled();
});

test('many pins stay a bounded number of pills; the rest remain dots', async () => {
  rows = Array.from({ length: 60 }, (_, index) => row(`n${index}`, 44 + index / 50, 20));
  mockRendered = rows.map(item => feature(item.id));
  await render(); await ready();
  expect(annotations()).toHaveLength(PILL_LIMIT);
});

test('"Pretraži ovu oblast" waits while the list is being read again', async () => {
  const region = { center: [20.4, 44.8], zoom: 12, bounds: [20.3, 44.7, 20.5, 44.9], userInteraction: true };
  await render(); await ready();
  await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži ovu oblast' })).toHaveLength(1);
  busy = true; await update();
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži ovu oblast' })).toHaveLength(0);
});
