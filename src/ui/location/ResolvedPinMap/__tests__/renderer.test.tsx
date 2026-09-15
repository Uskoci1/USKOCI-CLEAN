import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ResolvedPinMap } from '../../ResolvedPinMap';
import { ResolvedPinMap as WebPinMap } from '../../ResolvedPinMap.web';
import type { ResolvedPinMapProps } from '../../ResolvedPinMap.types';

let mockFocused = true;
const mockJump = jest.fn();
const mockProject = jest.fn();
const mockUnproject = jest.fn();
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) =>
  require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('@maplibre/maplibre-react-native', () => ({ Marker: 'NativeMarker',
  Map: require('react').forwardRef((props: object, ref: unknown) => {
    require('react').useImperativeHandle(ref, () => ({ project: mockProject, unproject: mockUnproject }));
    return require('react').createElement('NativeMap', props);
  }),
  Camera: require('react').forwardRef((props: object, ref: unknown) => {
    require('react').useImperativeHandle(ref, () => ({ jumpTo: mockJump }));
    return require('react').createElement('NativeCamera', props);
  }),
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ActivityIndicator', 'Image'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('../../../Text', () => ({ T: 'T' }));
jest.mock('../../../Button', () => ({ Button: 'Button' }));
jest.mock('../../LocationControls', () => ({ locationStyles: { notice: {} } }));

let tree: ReactTestRenderer;
const onChoose = jest.fn();
const initial: ResolvedPinMapProps = { position: null, onChoose, scopeKey: 'account-incarnation:point:revision' };
const map = () => tree.root.findByType('NativeMap' as React.ElementType);
const annotation = () => tree.root.findByType('NativeMarker' as React.ElementType);
const handle = () => annotation().findByProps({ collapsable: false });
const frame = () => tree.root.find(node => String(node.type) === 'View' && typeof node.props.onLayout === 'function');
const gesture = (pageX: number, pageY: number, count = 1) => ({ nativeEvent: { pageX, pageY, touches: Array(count).fill({}) }, stopPropagation: jest.fn() });
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const markerImage = () => tree.root.findByType('Image' as React.ElementType);
const tap = (longitude: number, latitude: number) => ({ nativeEvent: { lngLat: [longitude, latitude], point: [1, 1] } });
const text = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
async function render(props: Partial<ResolvedPinMapProps> = {}) {
  await act(async () => { tree = create(<ResolvedPinMap {...initial} {...props} />); });
}
async function ready() { await act(async () => map().props.onDidFinishLoadingMap()); }
async function dragReady(center = [19, 45], zoom = 15) {
  await ready();
  await act(async () => { frame().props.onLayout({ nativeEvent: { layout: { width: 340, height: 320 } } });
    markerImage().props.onLoad(); map().props.onRegionDidChange({ nativeEvent: { center, zoom } }); });
}
beforeEach(() => { mockFocused = true; jest.clearAllMocks(); jest.useFakeTimers(); mockProject.mockResolvedValue([170, 160]); mockUnproject.mockResolvedValue([20.123456, 44.654321]); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

it('shows a neutral real map with no pin or selection when position is absent', async () => {
  await render();
  expect(map().props.mapStyle).toBe('https://tiles.openfreemap.org/styles/positron');
  expect(map().props.attribution).toBe(true);
  expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
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

it('keeps the original native overlay asset and resolves real marker movement through native projection once', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  expect(annotation().props.lngLat).toEqual([19, 45]); expect(annotation().props.anchor).toBe('bottom');
  expect(handle().props).toMatchObject({ accessible: true, accessibilityRole: 'image', accessibilityLabel: 'Oznaka izabrane tačke na mapi' });
  expect(handle().props.onStartShouldSetResponder()).toBe(true);
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(onChoose).not.toHaveBeenCalled();
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  expect(map().props.dragPan).toBe(false);
  await act(async () => handle().props.onResponderMove(gesture(110, 130)));
  expect(handle().props.style[1]).toEqual({ transform: [{ translateX: 10 }, { translateY: 30 }] });
  await act(async () => { handle().props.onResponderRelease(gesture(110, 130)); handle().props.onResponderRelease(gesture(110, 130)); });
  expect(mockProject).toHaveBeenCalledWith([19, 45]); expect(mockUnproject).toHaveBeenCalledTimes(1); expect(mockUnproject).toHaveBeenCalledWith([180, 190]);
  expect(onChoose).toHaveBeenCalledTimes(1);
  expect(onChoose).toHaveBeenCalledWith({ latitude: 44.654321, longitude: 20.123456 });
  expect(annotation().props.lngLat).toEqual([19, 45]); expect(map().props.dragPan).toBe(true);
});

it('rejects a retained tap/drag callback after the input position or disabled state changes', async () => {
  const props = { ...initial, position: { latitude: 45, longitude: 19 } };
  await render(props); await dragReady();
  const oldTap = map().props.onPress, oldDragEnd = handle().props.onResponderRelease;
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => tree.update(<ResolvedPinMap {...props} position={{ latitude: 44, longitude: 20 }} disabled />));
  await act(async () => { oldTap(tap(21, 43)); oldDragEnd(gesture(110, 130)); map().props.onPress(tap(21, 43)); });
  expect(onChoose).not.toHaveBeenCalled(); expect(handle().props.onStartShouldSetResponder()).toBe(false);
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
  expect(tree.root.findAllByType('NativeMarker' as React.ElementType)).toHaveLength(0);
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

it('announces real selected coordinates outside the Android bitmap and updates only after parent acceptance', async () => {
  await render(); await ready();
  await act(async () => map().props.onPress(tap(19.8312344, 45.2512344)));
  expect(text()).not.toContain('Geografska širina');
  const position = onChoose.mock.calls[0][0];
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={position} />));
  await act(async () => markerImage().props.onLoad());
  const status = tree.root.findByProps({ accessibilityLabel: 'Predložena tačka na mapi. Geografska širina 45.251234; geografska dužina 19.831234.' });
  expect(status.props.accessible).toBe(true);
  expect(annotation().findAllByProps({ accessibilityRole: 'text' })).toHaveLength(0);
  expect(text()).toContain('Proverite položaj oznake');
  await act(async () => map().props.onRegionDidChange({ nativeEvent: { center: [19.8312344, 45.2512344], zoom: 15 } }));
  expect(text()).toContain('Mapa je centrirana na izabranu tačku.');
});

it('camera readiness requires the current native center and zoom, then clears on movement', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } }); await ready();
  await act(async () => markerImage().props.onLoad());
  for (const state of [{ center: [19.83, 45.25], zoom: 1 }, { center: [0, 0], zoom: 15 }, { center: [NaN, 45.25], zoom: 15 }, null]) {
    await act(async () => map().props.onRegionDidChange({ nativeEvent: state }));
    expect(text()).not.toContain('Mapa je centrirana');
  }
  await act(async () => map().props.onRegionDidChange({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  expect(text()).toContain('Mapa je centrirana');
  await act(async () => map().props.onRegionWillChange());
  expect(text()).not.toContain('Mapa je centrirana');
});

it('coarse accessibility rounds both coordinates and never announces private precision', async () => {
  await render({ position: { latitude: 45.123456, longitude: 19.654321 }, coarse: true }); await ready();
  expect(tree.root.findByProps({ accessibilityLabel: 'Približna tačka na mapi. Geografska širina 45.12; geografska dužina 19.65.' })).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).not.toContain('45.123456');
  expect(JSON.stringify(tree.toJSON())).not.toContain('19.654321');
});

it('clears selected-coordinate and idle state on point removal, account switch, blur and unmount', async () => {
  const position = { latitude: 45.25, longitude: 19.83 };
  await render({ position }); await ready(); const oldIdle = map().props.onRegionDidChange;
  await act(async () => markerImage().props.onLoad());
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  await act(async () => tree.update(<ResolvedPinMap {...initial} />));
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  expect(text()).not.toContain('Geografska'); expect(text()).not.toContain('Mapa je centrirana');
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={position} scopeKey="other-account" />));
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
  expect(text()).not.toContain('Mapa je centrirana');
  mockFocused = false;
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={position} scopeKey="other-account" />));
  expect(text()).not.toContain('Geografska');
  await act(async () => tree.unmount());
  await act(async () => oldIdle({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } }));
});

it('keeps decoded image readiness separate from actual camera idle without any offscreen refresh', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } }); await ready();
  const marker = markerImage();
  expect(marker.props).toMatchObject({ accessible: false, fadeDuration: 0, resizeMode: 'contain', style: { width: 44, height: 48 } });
  expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await act(async () => {
    map().props.onRegionDidChange({ nativeEvent: { center: [19.83, 45.25], zoom: 15 } });
    jest.advanceTimersByTime(500);
  });
  expect(mockProject).not.toHaveBeenCalled();
  expect(text()).not.toContain('Mapa je centrirana');
  await act(async () => marker.props.onLoad());
  expect(text()).toContain('Mapa je centrirana');
  expect(annotation().props.onDragEnd).toBeUndefined();
});

it('retains early decoded pixels until map readiness but rejects stale image events after point or scope changes', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } });
  const oldImage = markerImage().props;
  await act(async () => oldImage.onLoad());
  expect(text()).not.toContain('Mapa je centrirana');
  await ready();
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={{ latitude: 45.26, longitude: 19.84 }} />));
  await act(async () => { oldImage.onLoad(); oldImage.onError(); });
  expect(text()).not.toContain('Mapa nije učitana');
  await act(async () => markerImage().props.onLoad());
  const currentImage = markerImage().props;
  await act(async () => tree.update(<ResolvedPinMap {...initial} position={{ latitude: 45.26, longitude: 19.84 }} disabled />));
  await act(async () => { currentImage.onLoad(); currentImage.onError(); });
  expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await act(async () => markerImage().props.onLoad());
  await act(async () => tree.update(<ResolvedPinMap {...initial} scopeKey="other-account" />));
  await act(async () => { currentImage.onLoad(); currentImage.onError(); });
  expect(text()).not.toContain('Mapa nije učitana');
  mockFocused = false;
  await act(async () => tree.update(<ResolvedPinMap {...initial} />));
  await act(async () => { oldImage.onLoad(); currentImage.onLoad(); });
  await act(async () => tree.unmount());
  await act(async () => { currentImage.onLoad(); currentImage.onError(); });
  expect(mockProject).not.toHaveBeenCalled();
});

it('fails the map visibly if its local marker cannot load and does not accept late image success as recovery', async () => {
  await render({ position: { latitude: 45.25, longitude: 19.83 } }); await ready();
  const marker = markerImage().props;
  await act(async () => marker.onError());
  expect(text()).toContain('Mapa nije učitana'); expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await act(async () => { marker.onLoad(); map().props.onPress(tap(19.84, 45.26)); });
  expect(mockProject).not.toHaveBeenCalled(); expect(onChoose).not.toHaveBeenCalled();
  expect(text()).not.toContain('Mapa je centrirana');
});

it.each(['project', 'unproject'] as const)('fences late native %s after cancel, failed map, timeout, disable, point ABA, account ABA, blur or unmount', async phase => {
  for (const change of ['cancel', 'map-failure', 'timeout', 'disabled', 'point-ABA', 'account-ABA', 'blur', 'unmount']) {
    mockFocused = true; onChoose.mockClear(); mockProject.mockReset(); mockUnproject.mockReset();
    const delayed = deferred<[number, number]>(), props = { ...initial, position: { latitude: 45, longitude: 19 }, scopeKey: 'A' };
    mockProject.mockReturnValue(phase === 'project' ? delayed.promise : Promise.resolve([170, 160]));
    mockUnproject.mockReturnValue(phase === 'unproject' ? delayed.promise : Promise.resolve([20, 44]));
    await render(props); await dragReady();
    const retained = handle().props;
    await act(async () => { retained.onResponderGrant(gesture(100, 100)); retained.onResponderRelease(gesture(110, 130)); });
    await act(async () => {
      if (change === 'cancel') retained.onResponderTerminate();
      if (change === 'map-failure') map().props.onDidFailLoadingMap();
      if (change === 'timeout') jest.advanceTimersByTime(15_001);
      if (change === 'disabled') tree.update(<ResolvedPinMap {...props} disabled />);
      if (change === 'point-ABA') tree.update(<ResolvedPinMap {...props} position={{ latitude: 44, longitude: 20 }} />);
      if (change === 'account-ABA') tree.update(<ResolvedPinMap {...props} scopeKey="B" />);
      if (change === 'blur') { mockFocused = false; tree.update(<ResolvedPinMap {...props} />); }
      if (change === 'unmount') tree.unmount();
    });
    if (change.endsWith('ABA')) await act(async () => tree.update(<ResolvedPinMap {...props} />));
    await act(async () => delayed.resolve(phase === 'project' ? [170, 160] : [20, 44]));
    expect(onChoose).not.toHaveBeenCalled();
    expect(mockUnproject).toHaveBeenCalledTimes(phase === 'project' ? 0 : 1);
    await act(async () => tree.unmount());
  }
});

it('cancels invalid native projection or movement without manufacturing coordinates or locking the map', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  for (const result of [null, [NaN, 1], [170], 'wrong']) {
    mockProject.mockResolvedValueOnce(result); mockUnproject.mockClear();
    await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(gesture(110, 130)); });
    expect(mockUnproject).not.toHaveBeenCalled(); expect(map().props.dragPan).toBe(true);
  }
  mockProject.mockRejectedValueOnce(new Error('Native projection unavailable'));
  await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(gesture(110, 130)); });
  expect(mockUnproject).not.toHaveBeenCalled();
  for (const end of [gesture(100, 100), gesture(101, 101), gesture(1000, 1000), gesture(110, 130, 2)]) {
    await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(end); });
    expect(mockUnproject).not.toHaveBeenCalled(); expect(map().props.dragPan).toBe(true);
  }
  expect(onChoose).not.toHaveBeenCalled();
});

it('keeps coarse drag private precision out and does not let old cancellation cancel the next coordinate gesture', async () => {
  const props = { ...initial, position: { latitude: 45.123456, longitude: 19.654321 }, coarse: true };
  await render(props); await dragReady([19.65, 45.12], 10);
  const old = handle().props;
  await act(async () => tree.update(<ResolvedPinMap {...props} position={{ latitude: 44.111111, longitude: 20.222222 }} />));
  await dragReady([20.22, 44.11], 10);
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => old.onResponderTerminate());
  expect(map().props.dragPan).toBe(false);
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(mockProject).toHaveBeenLastCalledWith([20.22, 44.11]);
  expect(onChoose).toHaveBeenCalledTimes(1); expect(onChoose).toHaveBeenCalledWith({ latitude: 44.65, longitude: 20.12 });
});

it('cancels an active marker gesture when the viewport moves or its measured frame changes', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => map().props.onRegionWillChange());
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(mockUnproject).not.toHaveBeenCalled(); expect(handle().props.onStartShouldSetResponder()).toBe(false);
  await dragReady();
  await act(async () => handle().props.onResponderGrant(gesture(100, 100)));
  await act(async () => frame().props.onLayout({ nativeEvent: { layout: { width: 640, height: 320 } } }));
  await act(async () => handle().props.onResponderRelease(gesture(110, 130)));
  expect(mockUnproject).not.toHaveBeenCalled(); expect(onChoose).not.toHaveBeenCalled();
});

it('allows a visible marker to be dragged after a user-changed viewport becomes idle without demanding a centered camera', async () => {
  await render({ position: { latitude: 45, longitude: 19 } });
  await dragReady([19.001, 45.001], 14);
  expect(text()).not.toContain('Mapa je centrirana');
  expect(handle().props.onStartShouldSetResponder()).toBe(true);
  await act(async () => { handle().props.onResponderGrant(gesture(100, 100)); handle().props.onResponderRelease(gesture(110, 130)); });
  expect(mockUnproject).toHaveBeenCalledWith([180, 190]);
  expect(onChoose).toHaveBeenCalledWith({ latitude: 44.654321, longitude: 20.123456 });
});

it('retires camera readiness synchronously before retained responder callbacks can run in the same native turn', async () => {
  await render({ position: { latitude: 45, longitude: 19 } }); await dragReady();
  const beforeCameraMove = handle().props;
  act(() => {
    map().props.onRegionWillChange();
    expect(beforeCameraMove.onStartShouldSetResponder()).toBe(false);
    beforeCameraMove.onResponderGrant(gesture(100, 100));
  });
  expect(mockProject).not.toHaveBeenCalled();
  await dragReady(); const beforeResize = handle().props;
  act(() => {
    frame().props.onLayout({ nativeEvent: { layout: { width: 640, height: 320 } } });
    expect(beforeResize.onStartShouldSetResponder()).toBe(false);
    beforeResize.onResponderGrant(gesture(100, 100));
  });
  expect(mockProject).not.toHaveBeenCalled(); expect(onChoose).not.toHaveBeenCalled();
});
