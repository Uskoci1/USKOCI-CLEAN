import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

// The Mapa tab and the root `/prilike` list became the one Zadaci tab (owner's information architecture, 2026-09-23).
// Both addresses stay alive as redirects, because an older build's notification, a route remembered before sign-in and
// a shared link can still name them. This suite mounts the REAL Expo Router runtime — root Stack, the real `(app)` Tabs
// layout and the real redirect screens — and checks where such an address actually lands.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../Press', () => { const React = require('react'); const { Pressable } = require('react-native');
  return { Press: (props: Record<string, unknown>) => React.createElement(Pressable, props) }; });
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => 'uskoci://' + path,
  resolveScheme: () => 'uskoci', addEventListener: () => ({ remove() {} }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('../system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => false }));
jest.mock('../Text', () => ({ T: 'T' }));

import { ExpoRoot, router, Stack } from 'expo-router';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import RealTabsLayout from '../../app/(app)/_layout';
import RetiredMapa from '../../app/(app)/mapa';
import RetiredPrilike from '../../app/(app)/prilike';

function RootLayout() { return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(app)" /></Stack>; }
const Screen = (name: string) => function Stub() { return <Text>{`screen:${name}`}</Text>; };
const routes = inMemoryContext({ _layout: RootLayout, '(app)/_layout': RealTabsLayout, '(app)/index': Screen('pocetna'),
  '(app)/zadaci': Screen('zadaci'), '(app)/dogovori': Screen('dogovori'), '(app)/mapa': RetiredMapa, '(app)/prilike': RetiredPrilike,
  '(app)/prilike/[id]': Screen('zadatak') });

let tree: ReactTestRenderer;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const shown = () => tree.root.findAllByType(Text).map(node => node.props.children).filter(text => String(text).startsWith('screen:'));
const tab = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityLabel === label)[0];
const selectedTabs = () => tree.root.findAll(node => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string'
  && node.props.accessibilityState?.selected).map(node => node.props.accessibilityLabel);
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test.each(['/mapa', '/prilike'])('a link to the retired %s opens Zadaci, with the Zadaci tab selected', async path => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location={path} />); });
  await settle();
  expect(shown()).toContain('screen:zadaci');
  expect(tab('Zadaci')).toBeDefined();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
});

test('the three tabs are Početna, Zadaci and Dogovori, and a task opened from Zadaci keeps Zadaci selected', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  const labels = [...new Set(tree.root.findAll(node => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string')
    .map(node => node.props.accessibilityLabel))];
  expect(labels).toEqual(['Početna', 'Zadaci', 'Dogovori']);
  await act(async () => router.navigate('/zadaci')); await settle();
  await act(async () => router.navigate({ pathname: '/prilike/[id]', params: { id: 'task-1' } })); await settle();
  expect(shown()).toContain('screen:zadatak');
  // The bar is hidden on a task (a detail is not a root screen); where it is drawn, Zadaci is the section.
  expect(selectedTabs().filter(label => label !== 'Zadaci')).toEqual([]);
});

test('Back from Zadaci reached through a retired address does not bounce into Zadaci again', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/mapa')); await settle();
  expect(shown()).toContain('screen:zadaci');
  await act(async () => router.back()); await settle();
  expect(shown()).toContain('screen:pocetna');
  expect([...new Set(selectedTabs())]).toEqual(['Početna']);
});

/** The names in the `(app)` tab navigator's Back history, read from the live navigation state. */
function tabHistory(): string[] {
  type Nav = { type?: string; routes?: { name: string; key: string; state?: Nav }[]; history?: { key: string }[] };
  const find = (state: Nav | undefined): Nav | undefined => !state ? undefined : state.type === 'tab' ? state
    : state.routes?.map(route => find(route.state)).find(Boolean);
  const tabs = find(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState());
  return (tabs?.history ?? []).map(entry => tabs!.routes!.find(route => route.key === entry.key)!.name);
}

test('a retired address never stays in the Back history, whether reached from Početna or opened cold', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/prilike')); await settle();
  expect(tabHistory()).toEqual(['index', 'zadaci']);
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/mapa" />); });
  await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
  // Nothing behind Zadaci: the system Back leaves the app instead of redirecting into Zadaci again.
  expect(tabHistory()).toEqual(['zadaci']); expect(router.canGoBack()).toBe(false);
});

// After signing in through "Uskoči i zaradi" the app lands on Početna and the root layout replaces it with Zadaci
// (src/app/_layout.tsx). Zadaci is second in the tab list, and this tab router's own replace dropped the history entry
// before that position — Početna — so Back from Zadaci left the app.
test('the sign-in shortcut replaces Početna with Zadaci and Back still returns to Početna', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.replace('/zadaci')); await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
  expect(tabHistory()).toEqual(['index', 'zadaci']);
  await act(async () => router.back()); await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Početna']);
});

// A task opened cold with nothing behind it replaces itself with Zadaci on its back arrow (prilike/[id].tsx). It must
// not stay behind Zadaci, or Back from Zadaci would open the task again and its arrow would send you back to Zadaci.
test('a task opened cold and replaced by Zadaci does not stay in the Back history', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/prilike/task-1" />); });
  await settle();
  expect(shown()).toContain('screen:zadatak');
  await act(async () => router.replace('/zadaci')); await settle();
  expect([...new Set(selectedTabs())]).toEqual(['Zadaci']);
  expect(tabHistory()).toEqual(['zadaci']);
});
