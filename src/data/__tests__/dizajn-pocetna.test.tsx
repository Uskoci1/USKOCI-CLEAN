import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockPackage: string | undefined = 'rs.uskoci.app.dev';
let mockParams: { scene?: string | string[]; [key: string]: unknown } = {};
const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
const mockInbox = jest.fn();
jest.mock('expo-constants', () => ({ get expoConfig() { return { android: { package: mockPackage } }; } }));
jest.mock('expo-router', () => ({ router: mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, scale: 3, fontScale: 1 });
  return ['View', 'ScrollView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) }));
jest.mock('../../ui/entry/BrandAssets', () => ({ BrandLockup: 'BrandLockup' }));
jest.mock('../../ui/home/HomeIllustration', () => ({ HomeIllustration: 'HomeIllustration' }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../../ui/InboxBell', () => ({ InboxBell: () => { mockInbox(); throw new Error('The Home gallery must not mount a live inbox.'); } }));
jest.mock('../supabaseClient', () => { throw new Error('The Home gallery must not load a data client.'); });
jest.mock('../../store/uloga', () => { throw new Error('The Home gallery must not read account data.'); });

import Gallery from '../../app/dizajn-pocetna';
import { HomePresentation } from '../../ui/home/HomePresentation';

let tree: ReactTestRenderer;
const originalDev = __DEV__;
const testRuntime = globalThis as unknown as { __DEV__: boolean };
const text = () => tree.root.findAll(node => String(node.type) === 'T')
  .flatMap(node => node.children.filter(child => typeof child === 'string')).join(' ');
const render = async () => { await act(async () => { tree = create(<Gallery />); }); };

beforeEach(() => { jest.clearAllMocks(); testRuntime.__DEV__ = false; mockPackage = 'rs.uskoci.app.dev'; mockParams = {}; });
afterEach(async () => { await act(async () => tree?.unmount()); testRuntime.__DEV__ = originalDev; });

it.each(['rs.uskoci.app', 'rs.uskoci.app.dev.store', undefined])('refuses fixture content in a store build (%s), regardless of the scene query', async packageName => {
  mockPackage = packageName;
  mockParams = { scene: 'flexible', internal: 'true', dev: 'true' };
  await render();
  expect(text()).toBe('Nije dostupno.');
  expect(tree.root.findAllByType(HomePresentation)).toHaveLength(0);
  expect(mockInbox).not.toHaveBeenCalled();
});

it('retains the development-runtime boundary used by the other galleries', async () => {
  testRuntime.__DEV__ = true; mockPackage = 'rs.uskoci.app';
  await render();
  expect(tree.root.findAllByType(HomePresentation)).toHaveLength(1);
});

it.each([
  ['upcoming', '26. sep · 17:00–19:00', 'Jelena Nikolić'],
  ['flexible', 'Fleksibilno · tokom sledeće nedelje', 'Aleksandra Konstantinović-Radovanović'],
  ['untimed', 'Prevod uputstva na engleski', 'Druga strana'],
  ['empty', 'Šta rešavamo', 'Još nemaš prijavu'],
  ['unavailable', 'Dogovori trenutno nisu učitani.', 'Podaci o obavezama trenutno nisu učitani.'],
])('renders the real Home for %s without a gallery wrapper or live action', async (scene, first, second) => {
  mockParams = { scene };
  await render();
  const presentation = tree.root.findByType(HomePresentation);
  expect(presentation.parent?.type).toBe(Gallery);
  expect(tree.root.findAllByType('SafeAreaView' as React.ElementType)).toHaveLength(1);
  expect(tree.root.findAllByType('ScrollView' as React.ElementType)).toHaveLength(1);
  expect(text()).toContain(first); expect(text()).toContain(second);
  if (scene === 'untimed') expect(presentation.props.home.agreements.value.rows[0].appointment.timeText).toBe('');
  await act(async () => {
    for (const control of tree.root.findAll(node => ['Press', 'Action'].includes(String(node.type)))) control.props.onPress?.();
    tree.root.findByType('ScrollView' as React.ElementType).props.refreshControl.props.onRefresh();
  });
  expect(mockInbox).not.toHaveBeenCalled();
  for (const navigate of Object.values(mockRouter)) expect(navigate).not.toHaveBeenCalled();
});

it.each([undefined, 'not-a-scene', ['flexible'], ['empty', 'upcoming']])('falls back to the fixed upcoming example for an unallowlisted query (%j)', async scene => {
  mockParams = { scene };
  await render();
  expect(text()).toContain('Montaža police u hodniku');
  expect(text()).toContain('26. sep · 17:00–19:00');
});
