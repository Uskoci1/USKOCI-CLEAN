import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MarketplaceItem, PublicViewport } from '../marketplaceView';
let mockFocused = true, mockReduced = false;
const mockExpand = jest.fn(), mockEase = jest.fn(), mockJump = jest.fn(), mockZoom = jest.fn();
jest.mock('@maplibre/maplibre-react-native', () => {
 const React = require('react');
 return { Map: 'NativeMap', Layer: 'Layer', ViewAnnotation: 'Annotation',
 Camera: React.forwardRef((props: any, ref: any) => { React.useImperativeHandle(ref, () => ({ easeTo: mockEase, jumpTo: mockJump, zoomTo: mockZoom })); return React.createElement('Camera', props); }),
 GeoJSONSource: React.forwardRef(({ children, ...props }: any, ref: any) => { React.useImperativeHandle(ref, () => ({ getClusterExpansionZoom: mockExpand })); return React.createElement('Source', props, children); }) };
});
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) { return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key); } }); });
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('phosphor-react-native', () => ({ MapPin: 'Icon' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { DiscoveryMap } from '../../ui/v2/DiscoveryMap';
import { DiscoveryMap as WebMap } from '../../ui/v2/DiscoveryMap.web';
const row = (id = 'one', lat = 0, lng = 0) => ({ id, naslov: 'Privatan naslov van source properties', priblizno: { lat, lng } } as MarketplaceItem);
let rows = [row()], key = 'owner:1', viewport: PublicViewport | null = null, selectedId: string | null = null;
const select = jest.fn(), setViewport = jest.fn(), search = jest.fn(), list = jest.fn();
function Screen() { return <DiscoveryMap items={rows} scopeKey={key} viewport={viewport} selectedId={selectedId} onSelect={select} onViewport={setViewport} onSearchArea={search} onList={list} />; }
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Screen />); });
const update = async () => act(async () => tree.update(<Screen />));
const native = () => tree.root.findByType('NativeMap' as React.ElementType);
const source = () => tree.root.findByType('Source' as React.ElementType);
const ready = async () => act(async () => native().props.onDidFinishLoadingMap());
const region = { center: [0, 0], zoom: 4, bounds: [-1, -1, 1, 1] };
const cluster = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { cluster: true, cluster_id: 7 } };
const pressFeature = async (features: unknown[]) => act(async () => source().props.onPress({ nativeEvent: { features }, stopPropagation: jest.fn() }));
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {}); rows = [row()]; key = 'owner:1'; viewport = null; selectedId = null; mockFocused = true; mockReduced = false; for (const fn of [mockExpand, mockEase, mockJump, mockZoom, select, setViewport, search, list]) fn.mockReset(); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
test('native clustering contains only rounded existing public points; zero is admitted', async () => {
 rows = [row(), row('two', 45.25444, 19.83444), { id: 'absent' } as MarketplaceItem]; await render();
 expect(source().props.cluster).toBe(true); expect(source().props.data.features).toHaveLength(2);
 expect(source().props.data.features[0].geometry.coordinates).toEqual([0, 0]); expect(source().props.data.features[1].geometry.coordinates).toEqual([19.83, 45.25]);
 expect(source().props.data.features[0].properties).toEqual({ needId: 'one' }); expect(JSON.stringify(source().props.data)).not.toContain('Privatan');
});
test('only an existing current public ID selects; unknown and malformed features are rejected', async () => {
 await render(); await ready(); const feature = source().props.data.features[0]; await pressFeature([feature]); expect(select).toHaveBeenCalledWith('one'); select.mockClear();
 await pressFeature([{ ...feature, properties: { needId: 'unknown' } }]);
 for (const coordinates of [[181, 0], [0, 91], [NaN, 0], [0], null]) await pressFeature([{ ...feature, geometry: { type: 'Point', coordinates } }]);
 await pressFeature([]); expect(select).not.toHaveBeenCalled();
});
test('rendered geometry resolves only the owned ID; selected pin keeps the canonical coarse point', async () => {
 rows = [row('novi-sad', 45.25444, 19.83444)]; await render(); await ready();
 const feature = source().props.data.features[0];
 await pressFeature([{ ...feature, geometry: { type: 'Point', coordinates: [19.830093383789, 45.249960548] } }]);
 expect(select).toHaveBeenCalledTimes(1); expect(select).toHaveBeenCalledWith('novi-sad');
 selectedId = 'novi-sad'; await update();
 expect(tree.root.findByType('Annotation' as React.ElementType).props.lngLat).toEqual([19.83, 45.25]);
 expect(rows[0]).toMatchObject({ priblizno: { lat: 45.25444, lng: 19.83444 } });
});
test.each(['dataset', 'account', 'blur', 'remote'])('old rendered pin cannot select after %s changes', async kind => {
 await render(); await ready(); const callback = source().props.onPress, feature = source().props.data.features[0];
 if (kind === 'dataset') rows = [row('new', 45, 19)];
 if (kind === 'account') key = 'owner:2';
 if (kind === 'blur') mockFocused = false;
 if (kind === 'remote') rows = [{ ...row(), detalji: { rezimLokacije: 'REMOTE' } } as MarketplaceItem];
 await update();
 await act(async () => callback({ nativeEvent: { features: [feature] }, stopPropagation: jest.fn() }));
 expect(select).not.toHaveBeenCalled();
});
test('cluster expands installed v11 cluster ID; reduced motion jumps without animation', async () => {
 mockReduced = true; mockExpand.mockResolvedValue(11); await render(); await ready(); await pressFeature([cluster]);
 expect(mockExpand).toHaveBeenCalledWith(7); expect(mockJump).toHaveBeenCalledWith({ center: [0, 0], zoom: 11 }); expect(mockEase).not.toHaveBeenCalled();
});
test.each(['dataset', 'account', 'blur'])('late cluster result is discarded after %s retires', async kind => {
 let resolve!: (value: number) => void; mockExpand.mockReturnValue(new Promise<number>(done => { resolve = done; })); await render(); await ready(); await pressFeature([cluster]);
 if (kind === 'dataset') rows = [row('new', 45, 19)]; if (kind === 'account') key = 'owner:2'; if (kind === 'blur') mockFocused = false; await update();
 await act(async () => resolve(10)); expect(mockEase).not.toHaveBeenCalled(); expect(mockJump).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
});
test('observed valid viewport enables explicit area; panning never searches by itself', async () => {
 await render(); await ready(); expect(tree.root.findByProps({ label: 'Pretraži ovu oblast' }).props.disabled).toBe(true);
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region })); expect(setViewport).toHaveBeenCalledWith(region); expect(search).not.toHaveBeenCalled();
 await act(async () => tree.root.findByProps({ label: 'Pretraži ovu oblast' }).props.onPress()); expect(search).toHaveBeenCalledWith(region.bounds);
 await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...region, bounds: [-181, -1, 1, 1] } }));
 expect(tree.root.findByProps({ label: 'Pretraži ovu oblast' }).props.disabled).toBe(true);
});
test('bounded native load failure rejects late ready; explicit retry remounts and saved viewport survives', async () => {
 viewport = region as PublicViewport; await render(); const late = native().props.onDidFinishLoadingMap;
 expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toEqual({ center: [0, 0], zoom: 4 });
 await act(async () => jest.advanceTimersByTime(15_001)); await act(async () => late()); expect(tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' })).toBeTruthy();
 await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' }).props.onPress()); await ready(); expect(tree.root.findByProps({ label: 'Pretraži ovu oblast' })).toBeTruthy();
});
test('web fallback has real List action and creates no schematic map', async () => {
 await act(async () => { tree = create(<WebMap items={rows} scopeKey={key} selectedId={null} viewport={null} onSelect={select} onViewport={setViewport} onSearchArea={search} onList={list} />); });
 expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0); await act(async () => tree.root.findByProps({ label: 'Pogledaj listu' }).props.onPress()); expect(list).toHaveBeenCalledTimes(1);
});
