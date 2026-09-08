import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { DiscoveryMapProps } from '../../ui/discovery/DiscoveryMap.types';
import { createDiscoveryMapScope } from '../../ui/discovery/discoveryMapScope';

const mockZoom = jest.fn();
const mockJump = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'Text', 'Pressable', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  return {
    Map: 'NativeMapView', Layer: 'MapLayer',
    Camera: React.forwardRef((props: unknown, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ jumpTo: mockJump }));
      return React.createElement('MapCamera', props);
    }),
    GeoJSONSource: React.forwardRef((props: unknown, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ getClusterExpansionZoom: mockZoom }));
      return React.createElement('MapSource', props);
    }),
  };
});

import { DiscoveryMap } from '../../ui/discovery/DiscoveryMap';

function deferred() {
  let resolve!: (zoom: number) => void, reject!: (error: Error) => void;
  const promise = new Promise<number>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const collection = (id = 'public-a'): DiscoveryMapProps['pins'] => ({ type: 'FeatureCollection', features: [
  { type: 'Feature', geometry: { type: 'Point', coordinates: [20.4, 44.8] }, properties: { id, label: 'Javni zadatak' } },
] });
let tree: ReactTestRenderer | undefined, props: DiscoveryMapProps, scope: ReturnType<typeof createDiscoveryMapScope>;
const map = () => tree!.root.findByType('NativeMapView' as any).props;
const source = () => tree!.root.findByType('MapSource' as any).props;
const labels = () => tree!.root.findAllByType('Text' as any).flatMap(node => node.children).join(' ');
const button = (label: string) => tree!.root.findAllByType('Pressable' as any)
  .find(node => node.props.accessibilityLabel === label || node.findAllByType('Text' as any).some(text => text.children.includes(label)))!.props.onPress;
async function mount() { await act(async () => { tree = create(<DiscoveryMap {...props} />); }); }
async function ready() { await act(async () => map().onDidFinishLoadingMap()); }
async function press(properties: object, coordinates = [20, 44]) {
  const stopPropagation = jest.fn();
  await act(async () => source().onPress({ stopPropagation, nativeEvent: { features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates }, properties },
  ] } }));
  expect(stopPropagation).toHaveBeenCalledTimes(1);
}
beforeEach(() => {
  jest.useFakeTimers(); mockZoom.mockReset(); mockJump.mockReset();
  scope = createDiscoveryMapScope(); scope.enter();
  props = { scope, pins: collection(), selectedId: null, viewport: { center: [20.8, 44.1], zoom: 5.4 },
    onSelect: jest.fn(), onViewport: jest.fn(), onList: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });

describe('actual native discovery renderer with mocked MapLibre transport', () => {
  it('synchronously suppresses pending expansion and point/viewport events when opening detail before blur', async () => {
    const old = deferred(); mockZoom.mockReturnValueOnce(old.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    await act(async () => map().onRegionWillChange({ nativeEvent: { userInteraction: false } }));
    scope.suspend();
    await act(async () => old.resolve(12));
    await press({ id: 'public-a' });
    await act(async () => map().onRegionDidChange({ nativeEvent: { center: [21, 45], zoom: 12 } }));
    expect(mockJump).not.toHaveBeenCalled(); expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onViewport).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)('does not revive the pre-detail cluster %s after blur and Back refocus', async outcome => {
    const old = deferred(); mockZoom.mockReturnValueOnce(old.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    const originalMap = tree!.root.findByType('NativeMapView' as any);
    scope.leave(); scope.enter();
    await act(async () => outcome === 'resolve' ? old.resolve(12) : old.reject(new Error('old focus')));
    expect(mockJump).not.toHaveBeenCalled(); expect(props.onViewport).not.toHaveBeenCalled();
    expect(labels()).not.toContain('Mapa trenutno nije dostupna');
    expect(tree!.root.findByType('NativeMapView' as any)).toBe(originalMap);
    expect(tree!.root.findByType('MapCamera' as any).props.initialViewState).toEqual(props.viewport);
    mockZoom.mockResolvedValueOnce(10); await press({ cluster_id: 2 });
    expect(mockJump).toHaveBeenCalledWith({ center: [20, 44], zoom: 10 });
  });

  it('rejects a prior-focus movement finish but accepts a new real movement after Back', async () => {
    await mount(); await ready();
    await act(async () => map().onRegionWillChange({ nativeEvent: { userInteraction: true } }));
    scope.leave(); scope.enter();
    await act(async () => map().onRegionDidChange({ nativeEvent: { center: [22, 46], zoom: 13 } }));
    expect(props.onViewport).not.toHaveBeenCalled();
    await act(async () => {
      map().onRegionWillChange({ nativeEvent: { userInteraction: true } });
      map().onRegionDidChange({ nativeEvent: { center: [20, 44], zoom: 7 } });
    });
    expect(props.onViewport).toHaveBeenCalledTimes(1);
    expect(props.onViewport).toHaveBeenCalledWith({ center: [20, 44], zoom: 7 });
  });

  it('passes only supplied public GeoJSON and exposes named map plus loading/list escape', async () => {
    await mount();
    expect(source().data).toBe(props.pins);
    expect(map().accessibilityLabel).toBe('Mapa približnih područja zadataka');
    expect(map().touchPitch).toBe(false); expect(map().touchRotate).toBe(false);
    expect(tree!.root.findByType('MapCamera' as any).props.initialViewState).toEqual(props.viewport);
    expect(labels()).toContain('Učitavamo mapu');
    await act(async () => button('Otvorite listu')());
    expect(props.onList).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('keeps the later cluster press when two expansion responses resolve backwards', async () => {
    const a = deferred(), b = deferred(); mockZoom.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    await mount(); await ready(); await press({ cluster_id: 1 }, [19, 43]); await press({ cluster_id: 2 }, [21, 45]);
    await act(async () => b.resolve(20)); await act(async () => a.resolve(8));
    expect(mockJump.mock.calls).toEqual([[{ center: [21, 45], zoom: 16 }]]);
    expect(mockZoom.mock.calls).toEqual([[1], [2]]);
  });

  it.each(['resolve', 'reject'] as const)('ignores an old expansion %s after pins change', async outcome => {
    const old = deferred(); mockZoom.mockReturnValueOnce(old.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    props = { ...props, pins: collection('public-b') };
    await act(async () => tree!.update(<DiscoveryMap {...props} />));
    await act(async () => outcome === 'resolve' ? old.resolve(10) : old.reject(new Error('old source')));
    expect(mockJump).not.toHaveBeenCalled(); expect(labels()).not.toContain('Mapa trenutno nije dostupna');
    expect(source().data).toBe(props.pins);
  });

  it('discards unfinished expansion and viewport callbacks after unmount', async () => {
    const old = deferred(); mockZoom.mockReturnValueOnce(old.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    const onRegion = map().onRegionDidChange;
    await act(async () => { tree!.unmount(); tree = undefined; });
    await act(async () => { old.resolve(10); onRegion({ nativeEvent: { center: [20, 44], zoom: 10 } }); });
    expect(mockJump).not.toHaveBeenCalled(); expect(props.onViewport).not.toHaveBeenCalled();
  });

  it('owns a fresh retry mount and ignores the prior failed attempt promise', async () => {
    const old = deferred(); mockZoom.mockReturnValueOnce(old.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    await act(async () => map().onDidFailLoadingMap());
    await act(async () => button('Ponovo učitajte mapu')());
    expect(labels()).toContain('Učitavamo mapu');
    await ready(); await act(async () => old.reject(new Error('prior attempt')));
    expect(labels()).not.toContain('Mapa trenutno nije dostupna'); expect(mockJump).not.toHaveBeenCalled();
  });

  it('lets the user pan supersede a pending cluster expansion', async () => {
    const old = deferred(); mockZoom.mockReturnValueOnce(old.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    await act(async () => map().onRegionWillChange({ nativeEvent: { userInteraction: true } }));
    await act(async () => old.resolve(12)); expect(mockJump).not.toHaveBeenCalled();
  });

  it('does not confuse programmatic region events with a later user gesture', async () => {
    const current = deferred(); mockZoom.mockReturnValueOnce(current.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    await act(async () => map().onRegionWillChange({ nativeEvent: { userInteraction: false } }));
    await act(async () => current.resolve(12));
    expect(mockJump).toHaveBeenCalledWith({ center: [20, 44], zoom: 12 });
  });

  it('validates point selection against current pins and cancels earlier cluster work', async () => {
    const old = deferred(); mockZoom.mockReturnValueOnce(old.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    await press({ id: 'public-a' }); await press({ id: 'not-in-current-pins' });
    await act(async () => old.resolve(12));
    expect(props.onSelect).toHaveBeenCalledTimes(1); expect(props.onSelect).toHaveBeenCalledWith('public-a');
    expect(mockJump).not.toHaveBeenCalled();
  });

  it('offers list and retry after current provider failure without exposing its error', async () => {
    const current = deferred(); mockZoom.mockReturnValueOnce(current.promise);
    await mount(); await ready(); await press({ cluster_id: 1 });
    await act(async () => current.reject(new Error('provider internal detail')));
    expect(labels()).toContain('Mapa trenutno nije dostupna'); expect(labels()).not.toContain('internal');
    await act(async () => button('Otvorite listu')()); expect(props.onList).toHaveBeenCalledTimes(1);
    await act(async () => button('Ponovo učitajte mapu')()); await ready();
    expect(labels()).not.toContain('Mapa trenutno nije dostupna');
  });

  it('bounds loading and clears its timer after teardown', async () => {
    const schedule = jest.spyOn(global, 'setTimeout'), clear = jest.spyOn(global, 'clearTimeout');
    await mount();
    const index = schedule.mock.calls.findIndex(call => call[1] === 15000);
    expect(index).toBeGreaterThanOrEqual(0);
    const ownedTimer = schedule.mock.results[index].value;
    await act(async () => jest.advanceTimersByTime(15000));
    expect(labels()).toContain('Mapa trenutno nije dostupna');
    await act(async () => button('Otvorite listu')()); expect(props.onList).toHaveBeenCalledTimes(1);
    await act(async () => { tree!.unmount(); tree = undefined; });
    expect(clear).toHaveBeenCalledWith(ownedTimer);
  });
});
