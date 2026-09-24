import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * The internal profile gallery (uskociapp://dizajn-profil): every scene the lead photographs must draw, reachable by its
 * visible name, with a "Nazad" back to the list, and none may read or write anything.
 */
const mockBack = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Image'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('expo-router', () => ({ router: { back: (...a: unknown[]) => mockBack(...a), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn(), push: jest.fn() },
  useFocusEffect: (effect: () => void | (() => void)) => require('react').useEffect(effect, [effect]) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => { throw new Error('The gallery must not reach the data layer.'); } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'ResolvedPinMap' }));

import Gallery from '../../app/dizajn-profil';

let tree: ReactTestRenderer;
const presses = () => tree.root.findAll(node => String(node.type) === 'Press');
const texts = () => tree.root.findAll(node => String(node.type) === 'T').flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { await act(async () => tree?.unmount()); });

it('lists every scene by its visible name and draws each one, with Nazad back to the list', async () => {
  await act(async () => { tree = create(<Gallery />); });
  const labels = presses().map(node => node.props.accessibilityLabel as string).filter(label => label.includes(':'));
  expect(labels.length).toBeGreaterThanOrEqual(40);
  for (const label of labels) {
    expect(texts()).toContain(label);
    await act(async () => presses().find(node => node.props.accessibilityLabel === label)!.props.onPress());
    expect(presses().some(node => node.props.accessibilityLabel === 'Nazad na listu scena')).toBe(true);
    expect(texts()).toContain('Nazad');
    await act(async () => presses().find(node => node.props.accessibilityLabel === 'Nazad na listu scena')!.props.onPress());
    expect(presses().some(node => node.props.accessibilityLabel === label)).toBe(true);
  }
  expect(mockBack).not.toHaveBeenCalled();
  // Forty-five scenes in one walk: under the full parallel run this takes longer than the 5 s default.
}, 60_000);

it('a scene edits only its own copy: a quick pick changes the tile, and nothing is sent', async () => {
  await act(async () => { tree = create(<Gallery />); });
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Radni profil: aktivan')!.props.onPress());
  await act(async () => presses().find(node => node.props.accessibilityLabel === 'Brzi izbor vozila')!.props.onPress());
  const tile = () => presses().find(node => node.props.accessibilityLabel === 'Automobil')!;
  expect(tile().props.accessibilityState.checked).toBe(false);
  await act(async () => tile().props.onPress());
  expect(tile().props.accessibilityState.checked).toBe(true);
});
