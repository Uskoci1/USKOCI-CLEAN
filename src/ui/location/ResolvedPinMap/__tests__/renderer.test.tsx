import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ResolvedPinMap } from '../../ResolvedPinMap';
import { ResolvedPinMap as WebPinMap } from '../../ResolvedPinMap.web';
import type { ResolvedPinMapProps } from '../../ResolvedPinMap.types';

let mockFocused = true;
const mockJump = jest.fn();
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('@maplibre/maplibre-react-native', () => ({ Map: 'NativeMap', ViewAnnotation: 'NativeAnnotation',
  Camera: require('react').forwardRef((props: object, ref: unknown) => {
    require('react').useImperativeHandle(ref, () => ({ jumpTo: mockJump }));
    return require('react').createElement('NativeCamera', props);
  }),
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../../Button', () => ({ Button: 'Button' }));
jest.mock('../../LocationControls', () => ({ locationStyles: { notice: {} } }));

let tree: ReactTestRenderer;
const onChoose = jest.fn();
const initial: ResolvedPinMapProps = { position: null, onChoose, scopeKey: 'account-incarnation:point:revision' };
const map = () => tree.root.findByType('NativeMap' as React.ElementType);
const annotation = () => tree.root.findByType('NativeAnnotation' as React.ElementType);
const tap = (longitude: number, latitude: number) => ({ nativeEvent: { lngLat: [longitude, latitude], point: [1, 1] } });
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
async function render(props: Partial<ResolvedPinMapProps> = {}) {
  await act(async () => { tree = create(<ResolvedPinMap {...initial} {...props} />); });
}
async function ready() { await act(async () => map().props.onDidFinishLoadingMap()); }
beforeEach(() => { mockFocused = true; jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

it('shows a neutral real map with no pin or selection when position is absent', async () => {
  await render();
  expect(map().props.mapStyle).toBe('https://tiles.openfreemap.org/styles/positron');
  expect(map().props.attribution).toBe(true);
  expect(tree.root.findAllByType('NativeAnnotation' as React.ElementType)).toHaveLength(0);
  await ready();
  expect(text()).toContain('Tačka nije izabrana');
  expect(onChoose).not.toHaveBeenCalled();
});

it('renders only the two-decimal coarse position and emits only a user-selected coarse proposal', async () => {
  await render({ position: { latitude: 45.123456, longitude: 19.654321 }, coarse: true });
  expect(annotation().props.lngLat).toEqual([19.65, 45.12]);
  await act(async () => map().props.onPress(tap(20.123456, 44.654321)));
  expect(onChoose).not.toHaveBeenCalled();
  await ready();
  expect(mockJump).toHaveBeenCalledWith({ center: [19.65, 45.12], zoom: 10 });
  await act(async () => map().props.onPress(tap(20.123456, 44.654321)));
  expect(onChoose).toHaveBeenCalledWith({ latitude: 44.65, longitude: 20.12 });
  expect(annotation().props.lngLat).toEqual([19.65, 45.12]); // Parent owns accepting the proposal.
});

it('keeps a valid precise position and proposes a drag only after its own drag-start', async () => {
  await render({ position: { latitude: 45.123456, longitude: 19.654321 } }); await ready();
  expect(annotation().props.lngLat).toEqual([19.654321, 45.123456]);
  await act(async () => annotation().props.onDragEnd(tap(20.123456, 44.654321)));
  expect(onChoose).not.toHaveBeenCalled();
  await act(async () => annotation().props.onDragStart());
  await act(async () => annotation().props.onDragEnd(tap(20.123456, 44.654321)));
  expect(onChoose).toHaveBeenCalledTimes(1);
  expect(onChoose).toHaveBeenCalledWith({ latitude: 44.654321, longitude: 20.123456 });
});

it('rejects a retained tap/drag callback after the input position or disabled state changes', async () => {
  const props = { ...initial, position: { latitude: 45, longitude: 19 } };
  await render(props); await ready();
  const oldTap = map().props.onPress, oldDragEnd = annotation().props.onDragEnd;
  await act(async () => annotation().props.onDragStart());
  await act(async () => tree.update(<ResolvedPinMap {...props} position={{ latitude: 44, longitude: 20 }} disabled />));
  await act(async () => { oldTap(tap(21, 43)); oldDragEnd(tap(21, 43)); map().props.onPress(tap(21, 43)); });
  expect(onChoose).not.toHaveBeenCalled(); expect(annotation().props.draggable).toBe(false);
});

it('does not let a previous scope revive after A → B → A', async () => {
  await render({ scopeKey: 'A' }); await ready();
  const oldTap = map().props.onPress, oldLoaded = map().props.onDidFinishLoadingMap;
  await act(async () => tree.update(<ResolvedPinMap {...initial} scopeKey="B" />));
  await act(async () => tree.update(<ResolvedPinMap {...initial} scopeKey="A" />));
  await act(async () => { oldLoaded(); oldTap(tap(19, 45)); });
  expect(text()).toContain('Učitavamo mapu'); expect(onChoose).not.toHaveBeenCalled();
  await ready(); await act(async () => map().props.onPress(tap(20, 44)));
  expect(onChoose).toHaveBeenCalledTimes(1);
});

it('unmounts the map on blur and rejects old callbacks after refocus', async () => {
  await render(); await ready(); const retained = map().props.onPress;
  mockFocused = false;
  await act(async () => tree.update(<ResolvedPinMap {...initial} />));
  expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0);
  await act(async () => retained(tap(19, 45))); expect(onChoose).not.toHaveBeenCalled();
  mockFocused = true;
  await act(async () => tree.update(<ResolvedPinMap {...initial} />)); await ready();
  await act(async () => retained(tap(19, 45))); expect(onChoose).not.toHaveBeenCalled();
});

it('times out without accepting a late load, then retries a new real map instance', async () => {
  await render(); const old = map().props;
  await act(async () => jest.advanceTimersByTime(15_001));
  expect(text()).toContain('Mapa nije učitana');
  await act(async () => { old.onDidFinishLoadingMap(); old.onPress(tap(19, 45)); });
  expect(text()).toContain('Mapa nije učitana'); expect(onChoose).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ label: 'Pokušaj ponovo sa mapom' }).props.onPress());
  expect(text()).toContain('Učitavamo mapu'); await ready();
  await act(async () => { old.onPress(tap(19, 45)); map().props.onPress(tap(20, 44)); });
  expect(onChoose).toHaveBeenCalledTimes(1); expect(onChoose).toHaveBeenCalledWith({ latitude: 44, longitude: 20 });
});

it('rejects malformed positions and native coordinates without manufacturing a pin', async () => {
  await render({ position: { latitude: 91, longitude: 19 } }); await ready();
  expect(tree.root.findAllByType('NativeAnnotation' as React.ElementType)).toHaveLength(0);
  for (const event of [tap(Infinity, 44), tap(19, NaN), tap(181, 44), tap(19, -91), { nativeEvent: { lngLat: null } }]) {
    await act(async () => map().props.onPress(event));
  }
  expect(onChoose).not.toHaveBeenCalled();
});

it('web fallback reports native map requirement without rendering or choosing a point', async () => {
  await act(async () => { tree = create(<WebPinMap {...initial} position={{ latitude: 45.123456, longitude: 19.123456 }} />); });
  expect(text()).toContain('mobilnu aplikaciju');
  expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('45.123456'); expect(onChoose).not.toHaveBeenCalled();
});
