import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The application and rating gallery (round 6, unit prijava) draws every scene from fixtures, reads nothing, writes
// nothing, and returns to its list.
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('../reviewsClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../applicationSelectionClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../applicationCommandJournal', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../supabaseClient', () => { throw new Error('the gallery must not reach a data service'); });

import DizajnPrijava from '../../app/dizajn-prijava';

let tree: ReactTestRenderer;
const pressHost = async (label: string) => {
  await act(async () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === label)[0].props.onPress());
};
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it('opens every scene by its visible label and comes back with "Nazad na listu scena"', async () => {
  await act(async () => { tree = create(<DizajnPrijava />); });
  const labels = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && String(node.props.accessibilityLabel).startsWith('Galerija: '))
    .map(node => String(node.props.accessibilityLabel));
  expect(labels).toHaveLength(28);
  for (const label of labels) {
    await pressHost(label);
    // The scene replaces the list: none of the list's rows is left on screen.
    expect(tree.root.findAll(node => node.type === ('Press' as React.ElementType) && String(node.props.accessibilityLabel).startsWith('Galerija: '))).toHaveLength(0);
    await pressHost('Nazad na listu scena');
    expect(text()).toContain(label.slice('Galerija: '.length));
  }
});

it('draws the composer, its review and the sent state, and the rating with its person', async () => {
  await act(async () => { tree = create(<DizajnPrijava />); });
  await pressHost('Galerija: Pregled pre slanja');
  expect(text()).toContain('Ovo šalješ'); expect(text()).toContain('4.500 RSD');
  await pressHost('Nazad na listu scena');
  await pressHost('Galerija: Prijava poslata');
  expect(text()).toContain('Prijava je poslata.');
  await pressHost('Nazad na listu scena');
  await pressHost('Galerija: Ocena: izbor');
  expect(text()).toContain('Nikola Petrović'); expect(text()).toContain('Kako je prošla saradnja?');
  await pressHost('Ocena 4 od 5'); expect(text()).toContain('Vrlo dobro');
  // The scene's own back arrow also returns to the list.
  await pressHost('Nazad na Dogovor'); expect(text()).toContain('Ocena: sačuvana');
});
