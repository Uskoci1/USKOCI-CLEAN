import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { MarketplaceItem } from '../../../data/marketplaceView';

let mockStyle: unknown = null;
jest.mock('../mapStyle', () => ({ useMapStyle: () => mockStyle }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => unknown) => require('react').useEffect(() => effect(), [effect]) }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) { return ['View', 'ActivityIndicator', 'Image'].includes(String(key)) ? key : Reflect.get(target, key); } });
});
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../LocationControls', () => ({ locationStyles: { notice: {} } }));
import { ResolvedPinMap } from '../ResolvedPinMap';
import { DiscoveryMap } from '../../v2/DiscoveryMap';

/**
 * Both maps draw place names in Serbian Latin (2026-09-24): each hands MapLibre the rewritten style once it is known,
 * and until then shows its own loading state rather than a map that would have to reload its style under the person.
 * Since review r3 item 12 the style is its JSON text, made once (useMapStyle returns it so), and the maps pass that very
 * string through: this pinned an object before.
 */
const LATIN = JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'label_city', type: 'symbol', layout: { 'text-field': ['coalesce', ['get', 'name:sr-Latn']] } }] });
const rows = [{ id: 'one', naslov: 'Posao', priblizno: { lat: 44.81, lng: 20.46 } } as unknown as MarketplaceItem];
const maps: [string, () => React.ReactElement][] = [
  ['ResolvedPinMap', () => <ResolvedPinMap position={{ latitude: 44.81, longitude: 20.46 }} onChoose={() => {}} scopeKey="a:1" coarse disabled />],
  ['DiscoveryMap', () => <DiscoveryMap items={rows} scopeKey="a:1" viewport={null} selectedId={null} onSelect={() => {}} onViewport={() => {}}
    onArea={() => {}} onList={() => {}} />],
];
let tree: ReactTestRenderer;
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'error').mockImplementation(() => {}); mockStyle = null; });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

it.each(maps)('%s waits for the style, then hands MapLibre the Latin style text', async (_name, element) => {
  await act(async () => { tree = create(element()); });
  expect(tree.root.findAllByType('NativeMap' as React.ElementType)).toHaveLength(0);
  expect(tree.root.findAll(node => String(node.type) === 'T' && node.children.includes('Učitavamo mapu…'))).not.toHaveLength(0);
  mockStyle = LATIN;
  await act(async () => { tree.update(element()); });
  expect(tree.root.findByType('NativeMap' as React.ElementType).props.mapStyle).toBe(LATIN);
});
