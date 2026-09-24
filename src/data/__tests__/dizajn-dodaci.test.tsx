import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The gallery of the Dogovor additions (round 6) draws every scene from fixtures, reads nothing, and returns to its list.
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'Platform') return { OS: 'web' };
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
    if (key === 'FlatList') return (p: any) => require('react').createElement('List', p, p.ListHeaderComponent,
      p.data.map((item: any) => require('react').createElement('Row', { key: item.messageId }, p.renderItem({ item }))), p.ListFooterComponent);
    return ['View', 'ScrollView', 'ActivityIndicator', 'TextInput', 'KeyboardAvoidingView', 'Modal', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/ui/community/datetime-picker', () => ({ DateTimePicker: 'DateTimePicker' }));
jest.mock('expo-constants', () => ({ expoConfig: { android: { package: 'rs.uskoci.app.dev' } } }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../ui/location/ResolvedPinMap', () => ({ ResolvedPinMap: 'PinMap' }));
// The photo tray's only reader; no scene may draw it (no prepared photo carries a receipt).
jest.mock('../../ui/media/AuthorizedPhoto', () => ({ AuthorizedPhoto: 'AuthorizedPhoto' }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true, replace: jest.fn(), push: jest.fn() }, useFocusEffect: () => undefined }));
const fail = () => { throw new Error('the gallery must not reach a data service'); };
jest.mock('../supabaseClient', () => fail());
jest.mock('../qaRecoveryClientService', () => fail());
jest.mock('../qaSubmissionClientService', () => fail());
jest.mock('../preselectionQaClientService', () => fail());
jest.mock('../agreementClientService', () => fail());
jest.mock('../agreementCurrentLocationService', () => fail());
jest.mock('../groupConversationService', () => fail());
jest.mock('../supportCaseClientService', () => fail());
jest.mock('../mediaClientService', () => fail());

import DizajnDodaci from '../../app/dizajn-dodaci';

let tree: ReactTestRenderer;
const pressHost = async (label: string) => {
  await act(async () => tree.root.findAll(node => node.type === ('Press' as React.ElementType) && node.props.accessibilityLabel === label)[0].props.onPress());
};
const text = () => tree.root.findAll(node => node.type === ('T' as React.ElementType)).flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it('opens every scene by its visible label and comes back with "Nazad"', async () => {
  await act(async () => { tree = create(<DizajnDodaci />); });
  const labels = tree.root.findAll(node => node.type === ('Press' as React.ElementType) && /^(Pitanja|Izmene|Lokacija|Grupa|Poruke) · /.test(String(node.props.accessibilityLabel)))
    .map(node => String(node.props.accessibilityLabel));
  expect(labels).toHaveLength(28);
  for (const label of labels) {
    await pressHost(label);
    expect(text()).not.toContain('Dogovor · dodaci · galerija');
    expect(tree.root.findAllByType('AuthorizedPhoto' as React.ElementType)).toHaveLength(0);
    await pressHost('Nazad na scene');
    expect(text()).toContain(label);
  }
});

it('draws the binding words of cancellation and the one-point promise of location sharing as they are', async () => {
  await act(async () => { tree = create(<DizajnDodaci />); });
  await pressHost('Izmene · otkazivanje, korak 2');
  expect(text()).toContain('Dogovor se završava otkazivanjem. Deljeni kontakt i precizna lokacija se opozivaju. Radnja sama ne određuje krivicu ili dug.');
  expect(text()).toContain('Korak 2 od 2');
  await pressHost('Nazad na scene'); await pressHost('Lokacija · poslednja tačka');
  expect(text()).toContain('Ovo je ranije zabeležena tačka. Ne potvrđuje sadašnji položaj.');
  expect(tree.root.findByType('PinMap' as React.ElementType).props.disabled).toBe(true);
});
