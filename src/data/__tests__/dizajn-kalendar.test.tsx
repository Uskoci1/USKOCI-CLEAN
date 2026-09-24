import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The calendar gallery (owner step 10) draws every scene from fixtures, reads nothing, and returns to its list.
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Switch', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), navigate: jest.fn() } }));
jest.mock('../workerCalendarClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../agreementClientService', () => { throw new Error('the gallery must not reach a data service'); });
jest.mock('../workerAvailabilityClientService', () => { throw new Error('the gallery must not reach a data service'); });

import DizajnKalendar from '../../app/dizajn-kalendar';

let tree: ReactTestRenderer;
const pressHost = async (label: string) => {
  await act(async () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === label)[0].props.onPress());
};
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it('opens every scene by its visible label and comes back with "Nazad"', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  const labels = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^(Kalendar|Dostupnost|List) · /.test(String(node.props.accessibilityLabel)))
    .map(node => String(node.props.accessibilityLabel));
  expect(labels).toHaveLength(19);
  for (const label of labels) {
    await pressHost(label);
    expect(text()).not.toContain('Kalendar · galerija');
    await pressHost('Nazad na scene');
    expect(text()).toContain(label);
  }
});

it('draws both sides, a finished Dogovor and the row of Dogovori without an exact time', async () => {
  await act(async () => { tree = create(<DizajnKalendar />); });
  await pressHost('Kalendar · dan sa Dogovorima');
  expect(text()).toContain('Uskačeš · Ana'); expect(text()).toContain('Tvoj zadatak · Marko');
  expect(text()).toContain('Završeno'); expect(text()).toContain('Čeka se potvrda završetka');
  expect(text()).toContain('Bez tačnog termina');
});
