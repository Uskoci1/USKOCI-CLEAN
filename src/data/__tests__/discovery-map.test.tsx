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
// Reduced motion is read from the one store (ui/system/motion) since 2026-09-24, no longer from Reanimated.
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import { AREA_SETTLE_MS, DiscoveryMap } from '../../ui/v2/DiscoveryMap';
import { DiscoveryMap as WebMap } from '../../ui/v2/DiscoveryMap.web';
import { sys } from '../../ui/system/tokens';
const row = (id = 'one', lat = 0, lng = 0) => ({ id, naslov: 'Privatan naslov van source properties', priblizno: { lat, lng } } as MarketplaceItem);
let rows = [row()], key = 'owner:1', viewport: PublicViewport | null = null, selectedId: string | null = null;
const select = jest.fn(), setViewport = jest.fn(), search = jest.fn(), list = jest.fn(), clear = jest.fn();
function Screen() { return <DiscoveryMap items={rows} scopeKey={key} viewport={viewport} selectedId={selectedId} onSelect={select} onViewport={setViewport} onArea={search} onList={list} onClear={clear} />; }
let tree: ReactTestRenderer;
const render = async () => act(async () => { tree = create(<Screen />); });
const update = async () => act(async () => tree.update(<Screen />));
const native = () => tree.root.findByType('NativeMap' as React.ElementType);
const source = () => tree.root.findByType('Source' as React.ElementType);
const ready = async () => act(async () => native().props.onDidFinishLoadingMap());
const region = { center: [0, 0], zoom: 4, bounds: [-1, -1, 1, 1] };
const cluster = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { cluster: true, cluster_id: 7 } };
const pressFeature = async (features: unknown[]) => act(async () => source().props.onPress({ nativeEvent: { features }, stopPropagation: jest.fn() }));
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {}); rows = [row()]; key = 'owner:1'; viewport = null; selectedId = null; mockFocused = true; mockReduced = false; for (const fn of [mockExpand, mockEase, mockJump, mockZoom, select, setViewport, search, list, clear]) fn.mockReset(); });
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
// Discovery V47: the list follows the map. Critique B8's "Pretraži ovu oblast" pill (and the button before it) is gone:
// a move of the person's own settles, the map waits AREA_SETTLE_MS, and hands up exactly the settled bounds. What the old
// tests guarded still holds: the camera's own moves never become an area, the area is exactly the settled viewport, and a
// malformed native region offers nothing.
const moved = (value: object) => ({ nativeEvent: { ...value, userInteraction: true } });
const wait = async (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });
test('a move of the person\'s own settles, and after a short wait the list follows exactly the bounds the map shows', async () => {
 await render(); await ready();
 expect(tree.root.findAllByProps({ accessibilityLabel: 'Pretraži ovu oblast' })).toHaveLength(0);
 // The camera's own settle (a fit, a chosen pin) is remembered as where the map stands, and is never an area.
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region })); expect(setViewport).toHaveBeenCalledWith(region);
 await wait(5_000); expect(search).not.toHaveBeenCalled();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS - 1); expect(search).not.toHaveBeenCalled();
 await wait(1); expect(search).toHaveBeenCalledTimes(1); expect(search).toHaveBeenCalledWith(region.bounds);
 expect(AREA_SETTLE_MS).toBe(450);
 // A malformed region offers nothing.
 await act(async () => native().props.onRegionDidChange(moved({ ...region, bounds: [-181, -1, 1, 1] })));
 await wait(AREA_SETTLE_MS * 2); expect(search).toHaveBeenCalledTimes(1);
});
test('a pan in several strokes asks once, for where it ended; taking hold of the map again restarts the wait', async () => {
 await render(); await ready();
 const second = { ...region, bounds: [0, 0, 2, 2] }, third = { ...region, bounds: [1, 1, 3, 3] };
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS - 100);
 await act(async () => native().props.onRegionDidChange(moved(second)));
 await wait(AREA_SETTLE_MS - 100); expect(search).not.toHaveBeenCalled();
 await wait(100); expect(search.mock.calls).toEqual([[second.bounds]]);
 // The person takes hold of the map before the wait is over: that settle was not where they stopped.
 await act(async () => native().props.onRegionDidChange(moved(third)));
 await act(async () => native().props.onRegionWillChange(moved(third)));
 await wait(AREA_SETTLE_MS * 2); expect(search).toHaveBeenCalledTimes(1);
 // The app's own move starting does not cancel a wait of the person's.
 await act(async () => native().props.onRegionDidChange(moved(third)));
 await act(async () => native().props.onRegionWillChange({ nativeEvent: { ...third, userInteraction: false } }));
 await wait(AREA_SETTLE_MS); expect(search.mock.calls).toEqual([[second.bounds], [third.bounds]]);
});
test('a zoom button or a cluster tap counts as the person\'s move; a chosen pin brought into view never does', async () => {
 await render(); await ready(); await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 // "+" moves the camera by the app's hand; the map reports that settle as the app's, and it is still the person's intent.
 await act(async () => zoomButton('Uvećaj mapu').props.onPress());
 const zoomed = { ...region, zoom: 5, bounds: [-0.5, -0.5, 0.5, 0.5] };
 await act(async () => native().props.onRegionDidChange({ nativeEvent: zoomed }));
 await wait(AREA_SETTLE_MS); expect(search.mock.calls).toEqual([[zoomed.bounds]]);
 // The intent is used once: the next settle of the app's own is not the person's.
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region })); await wait(AREA_SETTLE_MS * 2);
 expect(search).toHaveBeenCalledTimes(1);
 // A cluster tap flies the camera in; where it lands is the person's.
 mockExpand.mockResolvedValue(9); await pressFeature([cluster]);
 const opened = { ...region, zoom: 9, bounds: [-0.1, -0.1, 0.1, 0.1] };
 await act(async () => native().props.onRegionDidChange({ nativeEvent: opened })); await wait(AREA_SETTLE_MS);
 expect(search.mock.calls[1]).toEqual([opened.bounds]);
 // A zoom tap that is followed by a chosen pin: the pin is brought into view by the camera, and that is never an area.
 await act(async () => zoomButton('Uvećaj mapu').props.onPress());
 selectedId = 'one'; await update();
 await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...region, bounds: [-0.2, -0.2, 0.2, 0.2] } }));
 await wait(AREA_SETTLE_MS * 2); expect(search).toHaveBeenCalledTimes(2);
 // An intent too old to be this settle's is not carried over either.
 selectedId = null; await update();
 await act(async () => zoomButton('Umanji mapu').props.onPress()); await wait(5_000);
 await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...region, bounds: [-3, -3, 3, 3] } })); await wait(AREA_SETTLE_MS);
 expect(search).toHaveBeenCalledTimes(2);
});
// Review of V47 (coverage): the wait after a move of the person's own belongs to the map that is on screen. A map taken
// away, or a screen left for another one, never hands an area up to the list afterwards.
test('the area wait never fires after the map is unmounted or while its screen is not in front', async () => {
 await render(); await ready();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS - 1);
 await act(async () => tree.unmount());
 await wait(AREA_SETTLE_MS * 2); expect(search).not.toHaveBeenCalled();
 // Blurred: the screen is still mounted under the one in front, and its map no longer owns the list.
 await render(); await ready();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 mockFocused = false; await update();
 await wait(AREA_SETTLE_MS * 2); expect(search).not.toHaveBeenCalled();
 // Back in front, a move of the person's own is followed again.
 mockFocused = true; await update(); await ready();
 await act(async () => native().props.onRegionDidChange(moved(region)));
 await wait(AREA_SETTLE_MS); expect(search).toHaveBeenCalledTimes(1);
});
test('a tap on the empty map closes whatever card is open', async () => {
 await render(); await ready();
 await act(async () => native().props.onPress({ nativeEvent: {} }));
 expect(clear).toHaveBeenCalledTimes(1);
});
test('the region the camera settles into on first load arms the area control without being remembered', async () => {
 // On a phone this was the whole map's first impression: "Pretraži ovu oblast" and both zoom
 // buttons dead, with no reason beside them, until the person happened to drag the map. The region
 // event that the initial camera fit produces arrives before the map reports itself ready, and it
 // used to be discarded — and nothing else produces a viewport.
 await render();
 // The camera fit settles, and the map has not called itself ready yet. The controls are not on
 // screen during loading, so nothing is visible here — but this is the event that used to be lost.
 await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 // Not remembered: a position seen while the map is still loading must never become the viewport
 // a person returns to.
 expect(setViewport).not.toHaveBeenCalled();
 await ready();
 // The controls appear already armed, instead of dead until the person drags the map. (The zoom capsule is what this
 // first region arms; that first region is the camera's own and never becomes the list's area.)
 expect(zoomButton('Uvećaj mapu').props.disabled).toBe(false);
 await wait(AREA_SETTLE_MS * 2); expect(search).not.toHaveBeenCalled();
 // And from ready on, where the person moves the map is remembered as before, and the list follows it.
 await act(async () => native().props.onRegionDidChange(moved(region)));
 expect(setViewport).toHaveBeenCalledWith(region);
 await wait(AREA_SETTLE_MS);
 expect(search).toHaveBeenCalledWith(region.bounds);
});
test('bounded native load failure rejects late ready; explicit retry remounts and saved viewport survives', async () => {
 viewport = region as PublicViewport; await render(); const late = native().props.onDidFinishLoadingMap;
 expect(tree.root.findByType('Camera' as React.ElementType).props.initialViewState).toEqual({ center: [0, 0], zoom: 4 });
 await act(async () => jest.advanceTimersByTime(15_001)); await act(async () => late()); expect(tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' })).toBeTruthy();
 // The live map is back: its controls (the zoom capsule since critique B11) are on screen again.
 await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' }).props.onPress()); await ready(); expect(zoomButton('Uvećaj mapu')).toBeTruthy();
});
test('web fallback has real List action and creates no schematic map', async () => {
 await act(async () => { tree = create(<WebMap items={rows} scopeKey={key} selectedId={null} viewport={null} onSelect={select} onViewport={setViewport} onArea={search} onList={list} />); });
 expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0); await act(async () => tree.root.findByProps({ label: 'Pogledaj listu' }).props.onPress()); expect(list).toHaveBeenCalledTimes(1);
});
// Review r1 items 1-2 (2026-09-24): the zoom buttons computed from `viewport`, which updates only when the camera
// settles, so a second tap inside the animation asked for the same level again; and the motion path had no test.
const zoomButton = (label: 'Uvećaj mapu' | 'Umanji mapu') => tree.root.findByProps({ accessibilityLabel: label });
test('two quick taps on "+" before the camera settles zoom two levels, at the toggle pace', async () => {
 await render(); await ready(); await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 await act(async () => { zoomButton('Uvećaj mapu').props.onPress(); zoomButton('Uvećaj mapu').props.onPress(); });
 expect(mockZoom.mock.calls).toEqual([[5, { duration: sys.motion.toggle }], [6, { duration: sys.motion.toggle }]]);
 // Where the camera settled is the new base; the next tap builds on it, and "−" never goes below the world view.
 await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...region, zoom: 6 } }));
 await act(async () => zoomButton('Uvećaj mapu').props.onPress());
 expect(mockZoom).toHaveBeenLastCalledWith(7, { duration: sys.motion.toggle });
 await act(async () => native().props.onRegionDidChange({ nativeEvent: { ...region, zoom: 0.5 } }));
 await act(async () => zoomButton('Umanji mapu').props.onPress());
 expect(mockZoom).toHaveBeenLastCalledWith(0, { duration: sys.motion.toggle });
 // The cluster flight keeps the camera pace.
 expect(sys.motion.toggle).toBeLessThan(sys.motion.camera);
});
test('under reduced motion the zoom buttons jump without animation', async () => {
 mockReduced = true; await render(); await ready(); await act(async () => native().props.onRegionDidChange({ nativeEvent: region }));
 await act(async () => zoomButton('Umanji mapu').props.onPress());
 expect(mockZoom).toHaveBeenCalledWith(3, { duration: 0 });
});
test('a cluster flies at the camera pace when motion is allowed', async () => {
 mockExpand.mockResolvedValue(9); await render(); await ready(); await pressFeature([cluster]);
 expect(mockEase).toHaveBeenCalledWith({ center: [0, 0], zoom: 9, duration: sys.motion.camera }); expect(mockJump).not.toHaveBeenCalled();
});
