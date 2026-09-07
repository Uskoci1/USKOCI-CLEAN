import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { DiscoveryMapProps } from '../../ui/discovery/DiscoveryMap.types';

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
type Listener = (event: any) => void;
type MapMock = ReturnType<typeof makeMap>;
const mockConstruct = jest.fn(), mockNavigation = jest.fn();
let mockImport: ReturnType<typeof deferred<object>>;
const moduleExports = () => ({ Map: mockConstruct, NavigationControl: mockNavigation });
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'Text', 'Pressable', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
const importBoundary = {
  __esModule: true,
  // Keep the actual component's import() asynchronous and externally controlled.
  // This mock is an import boundary, not a browser/WebGL/tile provider proof.
  then(resolve: (module: object) => void, reject: (reason: Error) => void) {
    mockImport.promise.then(resolve, reject);
  },
};

// Expo's Jest transform leaves native import() untouched, while MapLibre6 is
// import-only ESM. Compile the exact TSX file for this CommonJS test runtime;
// only external imports are injected. No application source text is replaced.
// These assertions cover React ownership, not Metro resolution/WebGL/provider IO.
const compiled = ts.transpileModule(readFileSync(join(__dirname, '../../ui/discovery/DiscoveryMap.web.tsx'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  fileName: 'DiscoveryMap.web.tsx', reportDiagnostics: true,
});
if (compiled.diagnostics?.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) {
  throw new Error('WEB_RENDERER_TEST_TRANSPILE_FAILED');
}
const dependencies: Record<string, unknown> = {
  react: require('react'), 'react/jsx-runtime': require('react/jsx-runtime'), 'react-native': require('react-native'),
  'maplibre-gl': importBoundary, 'maplibre-gl/dist/maplibre-gl.css': {},
  './DiscoveryMap.types': require('../../ui/discovery/DiscoveryMap.types'), './MapFeedback': require('../../ui/discovery/MapFeedback'),
};
const webModule = { exports: {} as { DiscoveryMap: React.ComponentType<DiscoveryMapProps> } };
new Function('require', 'module', 'exports', compiled.outputText)((name: string) => {
  if (!Object.prototype.hasOwnProperty.call(dependencies, name)) throw new Error(`WEB_RENDERER_TEST_UNEXPECTED_IMPORT:${name}`);
  return dependencies[name];
}, webModule, webModule.exports);
const { DiscoveryMap } = webModule.exports;

function makeMap() {
  const listeners = new Map<string, Listener[]>();
  let hasSource = false;
  const source = { setData: jest.fn(), getClusterExpansionZoom: jest.fn() };
  return {
    source,
    on: jest.fn((event: string, layerOrListener: string | Listener, listener?: Listener) => {
      const key = typeof layerOrListener === 'string' ? `${event}:${layerOrListener}` : event;
      listeners.set(key, [...(listeners.get(key) ?? []), listener ?? layerOrListener as Listener]);
    }),
    emit: (key: string, event: object = {}) => { for (const listener of listeners.get(key) ?? []) listener(event); },
    addControl: jest.fn(),
    addSource: jest.fn((_id: string, _source: any) => { hasSource = true; }),
    addLayer: jest.fn((_layer: any) => undefined),
    getSource: jest.fn(() => hasSource ? source : undefined),
    setPaintProperty: jest.fn(),
    jumpTo: jest.fn(),
    remove: jest.fn(),
    getCenter: jest.fn(() => ({ lng: 20.2, lat: 44.4 })),
    getZoom: jest.fn(() => 9),
  };
}
const collection = (id = 'public-a'): DiscoveryMapProps['pins'] => ({ type: 'FeatureCollection', features: [
  { type: 'Feature', geometry: { type: 'Point', coordinates: [20.4, 44.8] }, properties: { id, label: 'Javni zadatak' } },
] });
let tree: ReactTestRenderer | undefined, props: DiscoveryMapProps, instances: MapMock[];
const latestMap = () => instances[instances.length - 1];
const labels = () => tree!.root.findAllByType('Text' as any).flatMap(node => node.children).join(' ');
const press = (label: string) => tree!.root.findAllByType('Pressable' as any)
  .find(node => node.props.accessibilityLabel === label || node.findAllByType('Text' as any).some(text => text.children.includes(label)))!.props.onPress;
async function mount() {
  await act(async () => { tree = create(<DiscoveryMap {...props} />, { createNodeMock: element => element.type === 'div' ? { testContainer: true } : null }); });
}
async function loadModule() { await act(async () => mockImport.resolve(moduleExports())); }
async function ready(instance = latestMap()) { await act(async () => instance.emit('load')); }
async function cluster(id: number, coordinates = [20, 44], instance = latestMap()) {
  await act(async () => instance.emit('click:task-clusters', {
    features: [{ geometry: { type: 'Point', coordinates }, properties: { cluster_id: id } }],
  }));
}
async function mountedReady() { await mount(); await loadModule(); await ready(); }
beforeEach(() => {
  jest.useFakeTimers(); instances = []; mockImport = deferred<object>();
  mockConstruct.mockReset().mockImplementation(() => { const instance = makeMap(); instances.push(instance); return instance; });
  mockNavigation.mockReset();
  props = { pins: collection(), selectedId: null, viewport: { center: [20.8, 44.1], zoom: 5.4 },
    onSelect: jest.fn(), onViewport: jest.fn(), onList: jest.fn() };
});
afterEach(async () => { await act(async () => tree?.unmount()); tree = undefined; jest.restoreAllMocks(); jest.useRealTimers(); });

describe('actual web discovery renderer with mocked asynchronous MapLibre boundary', () => {
  it('uses latest viewport/pins after deferred import and exposes actual canvas locale plus list escape', async () => {
    await mount();
    expect(mockConstruct).not.toHaveBeenCalled(); expect(labels()).toContain('Učitavamo mapu');
    await act(async () => press('Otvorite listu')()); expect(props.onList).toHaveBeenCalledTimes(1);
    props = { ...props, pins: collection('public-b'), viewport: { center: [21, 45], zoom: 7 } };
    await act(async () => tree!.update(<DiscoveryMap {...props} />));
    await loadModule(); await ready();
    expect(mockConstruct).toHaveBeenCalledTimes(1);
    expect(mockConstruct.mock.calls[0][0]).toMatchObject({ center: [21, 45], zoom: 7,
      dragRotate: false, pitchWithRotate: false, attributionControl: { compact: false },
      locale: { 'Map.Title': 'Mapa približnih područja zadataka', 'NavigationControl.ZoomIn': 'Uvećajte mapu', 'NavigationControl.ZoomOut': 'Umanjite mapu' } });
    expect(latestMap().addSource).toHaveBeenCalledWith('uskoci-public-tasks', expect.objectContaining({ data: props.pins, cluster: true }));
    expect(latestMap().addLayer).toHaveBeenCalledTimes(3);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('does not instantiate a late import after unmount and clears its owned timeout', async () => {
    const schedule = jest.spyOn(global, 'setTimeout'), clear = jest.spyOn(global, 'clearTimeout');
    await mount();
    const index = schedule.mock.calls.findIndex(call => call[1] === 15000);
    expect(index).toBeGreaterThanOrEqual(0);
    const ownedTimer = schedule.mock.results[index].value;
    await act(async () => { tree!.unmount(); tree = undefined; });
    await loadModule();
    expect(mockConstruct).not.toHaveBeenCalled(); expect(clear).toHaveBeenCalledWith(ownedTimer);
  });

  it('allows retry after import failure and never renders error details', async () => {
    await mount(); await act(async () => mockImport.reject(new Error('internal provider detail')));
    expect(labels()).toContain('Mapa trenutno nije dostupna'); expect(labels()).not.toContain('internal');
    await act(async () => press('Otvorite listu')()); expect(props.onList).toHaveBeenCalledTimes(1);
    mockImport = deferred<object>();
    await act(async () => press('Ponovo učitajte mapu')());
    await loadModule(); await ready();
    expect(mockConstruct).toHaveBeenCalledTimes(1); expect(labels()).not.toContain('Mapa trenutno nije dostupna');
  });

  it('bounds a pending import and creates only the active retry attempt when it later resolves', async () => {
    await mount(); await act(async () => jest.advanceTimersByTime(15000));
    expect(labels()).toContain('Mapa trenutno nije dostupna');
    await act(async () => press('Ponovo učitajte mapu')());
    await loadModule(); await ready();
    expect(mockConstruct).toHaveBeenCalledTimes(1); expect(labels()).not.toContain('Mapa trenutno nije dostupna');
  });

  it('contains a synchronous map construction failure and keeps the list escape', async () => {
    mockConstruct.mockImplementationOnce(() => { throw new Error('WebGL unavailable'); });
    await mount(); await loadModule();
    expect(labels()).toContain('Mapa trenutno nije dostupna'); expect(labels()).not.toContain('WebGL');
    await act(async () => press('Otvorite listu')()); expect(props.onList).toHaveBeenCalledTimes(1);
  });

  it('uses current pins and selection when data changes before the map load event', async () => {
    await mount(); await loadModule();
    props = { ...props, pins: collection('public-b'), selectedId: 'public-b' };
    await act(async () => tree!.update(<DiscoveryMap {...props} />)); await ready();
    expect(latestMap().addSource.mock.calls[0][1].data).toBe(props.pins);
    const pointLayer = latestMap().addLayer.mock.calls.find(call => call[0].id === 'task-points')![0];
    expect(pointLayer.paint['circle-radius']).toEqual(['case', ['==', ['get', 'id'], 'public-b'], 18, 14]);
  });

  it('retains only the latest cluster intent when expansion responses arrive backwards', async () => {
    await mountedReady(); const instance = latestMap(), a = deferred<number>(), b = deferred<number>();
    instance.source.getClusterExpansionZoom.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    await cluster(1, [19, 43]); await cluster(2, [21, 45]);
    await act(async () => b.resolve(20)); await act(async () => a.resolve(8));
    expect(instance.jumpTo.mock.calls).toEqual([[{ center: [21, 45], zoom: 16 }]]);
    expect(instance.source.getClusterExpansionZoom.mock.calls).toEqual([[1], [2]]);
  });

  it.each(['resolve', 'reject'] as const)('ignores an obsolete cluster %s after replacing public pins', async outcome => {
    await mountedReady(); const instance = latestMap(), old = deferred<number>();
    instance.source.getClusterExpansionZoom.mockReturnValueOnce(old.promise); await cluster(1);
    props = { ...props, pins: collection('public-b'), selectedId: 'public-b' };
    await act(async () => tree!.update(<DiscoveryMap {...props} />));
    await act(async () => outcome === 'resolve' ? old.resolve(12) : old.reject(new Error('old dataset')));
    expect(instance.jumpTo).not.toHaveBeenCalled(); expect(labels()).not.toContain('Mapa trenutno nije dostupna');
    expect(instance.source.setData).toHaveBeenLastCalledWith(props.pins);
    expect(instance.setPaintProperty).toHaveBeenLastCalledWith('task-points', 'circle-radius', ['case', ['==', ['get', 'id'], 'public-b'], 18, 14]);
  });

  it.each([true, false])('supersedes cluster expansion only for user movement: %s', async userMovement => {
    await mountedReady(); const instance = latestMap(), pending = deferred<number>();
    instance.source.getClusterExpansionZoom.mockReturnValueOnce(pending.promise); await cluster(1);
    await act(async () => instance.emit('movestart', userMovement ? { originalEvent: { type: 'pointermove' } } : {}));
    await act(async () => pending.resolve(12));
    expect(instance.jumpTo).toHaveBeenCalledTimes(userMovement ? 0 : 1);
  });

  it('uses current point/callback ownership and lets selection supersede cluster work', async () => {
    await mountedReady(); const instance = latestMap(), pending = deferred<number>();
    instance.source.getClusterExpansionZoom.mockReturnValueOnce(pending.promise); await cluster(1);
    const previousSelect = props.onSelect;
    props = { ...props, onSelect: jest.fn(), onViewport: jest.fn() };
    await act(async () => tree!.update(<DiscoveryMap {...props} />));
    await act(async () => {
      instance.emit('click:task-points', { features: [{ properties: { id: 'not-current' } }] });
      instance.emit('click:task-points', { features: [{ properties: { id: 'public-a' } }] });
      instance.emit('moveend');
      pending.resolve(12);
    });
    expect(props.onSelect).toHaveBeenCalledTimes(1); expect(props.onSelect).toHaveBeenCalledWith('public-a');
    expect(previousSelect).not.toHaveBeenCalled(); expect(instance.jumpTo).not.toHaveBeenCalled();
    expect(props.onViewport).toHaveBeenCalledWith({ center: [20.2, 44.4], zoom: 9 });
  });

  it('removes the old instance on retry and ignores its pending cluster/error/viewport events', async () => {
    await mountedReady(); const old = latestMap(), pending = deferred<number>();
    old.source.getClusterExpansionZoom.mockReturnValueOnce(pending.promise); await cluster(1);
    await act(async () => old.emit('error'));
    await act(async () => press('Ponovo učitajte mapu')()); await ready();
    const current = latestMap(); expect(current).not.toBe(old); expect(old.remove).toHaveBeenCalledTimes(1);
    await act(async () => { pending.reject(new Error('old attempt')); old.emit('error'); old.emit('moveend'); old.emit('load'); });
    expect(old.jumpTo).not.toHaveBeenCalled(); expect(current.jumpTo).not.toHaveBeenCalled();
    expect(props.onViewport).not.toHaveBeenCalled(); expect(labels()).not.toContain('Mapa trenutno nije dostupna');
    expect(old.addLayer).toHaveBeenCalledTimes(3);
    await act(async () => { tree!.unmount(); tree = undefined; });
    expect(old.remove).toHaveBeenCalledTimes(1); expect(current.remove).toHaveBeenCalledTimes(1);
  });

  it('discards pending expansion and all state/callback publication after unmount', async () => {
    await mountedReady(); const instance = latestMap(), pending = deferred<number>();
    instance.source.getClusterExpansionZoom.mockReturnValueOnce(pending.promise); await cluster(1);
    await act(async () => { tree!.unmount(); tree = undefined; });
    await act(async () => { pending.resolve(12); instance.emit('moveend'); instance.emit('error'); instance.emit('load'); });
    expect(instance.remove).toHaveBeenCalledTimes(1); expect(instance.jumpTo).not.toHaveBeenCalled();
    expect(props.onViewport).not.toHaveBeenCalled(); expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('keeps current expansion failure recoverable without leaking its message', async () => {
    await mountedReady(); const pending = deferred<number>();
    latestMap().source.getClusterExpansionZoom.mockReturnValueOnce(pending.promise); await cluster(1);
    await act(async () => pending.reject(new Error('internal source failure')));
    expect(labels()).toContain('Mapa trenutno nije dostupna'); expect(labels()).not.toContain('internal');
    await act(async () => press('Otvorite listu')()); expect(props.onList).toHaveBeenCalledTimes(1);
  });
});
