import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * "Moje aktivnosti" had no entry left once my own tasks and my applications became two front doors on Početna
 * (2026-09-23), so since 2026-09-24 its address redirects to Početna, like `/mapa` and `/prilike` redirect to Zadaci.
 * The screen tests that held its list are replaced by this redirect, mounted on the REAL Expo Router runtime (root
 * Stack, the real `(app)` Tabs layout with every route of the group registered, the real redirect screen), and by the
 * focus-guard scan below, which still guards every route of the group.
 */
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../../ui/Press', () => { const React = require('react'); const { Pressable } = require('react-native');
  return { Press: (props: Record<string, unknown>) => React.createElement(Pressable, props) }; });
jest.mock('expo-linking', () => ({ ...jest.requireActual('expo-linking'), createURL: (path: string) => 'uskoci://' + path,
  resolveScheme: () => 'uskoci', addEventListener: () => ({ remove() {} }) }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: () => 'Icon' }));
jest.mock('../../ui/system/FactArt', () => ({ FactArt: 'FactArt' }));
jest.mock('../../ui/system/motion', () => ({ useReducedMotion: () => false }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));

import { ExpoRoot, router, Stack } from 'expo-router';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import RealTabsLayout from '../../app/(app)/_layout';
import RetiredMojeAktivnosti from '../../app/(app)/moje-aktivnosti';

const APP = join(__dirname, '..', '..', 'app', '(app)');
function routeNames(dir: string, prefix = ''): string[] {
  return readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory() ? routeNames(join(dir, name), `${prefix}${name}/`)
    : name.endsWith('.tsx') && name !== '_layout.tsx' ? [`${prefix}${name.slice(0, -4)}`] : []);
}
function RootLayout() { return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(app)" /></Stack>; }
const Screen = (name: string) => function Stub() { return <Text>{`screen:${name}`}</Text>; };
const STUB_NAMES: Record<string, string> = { index: 'pocetna' };
const routes = inMemoryContext({ _layout: RootLayout, '(app)/_layout': RealTabsLayout,
  ...Object.fromEntries(routeNames(APP).map(name => [`(app)/${name}`,
    name === 'moje-aktivnosti' ? RetiredMojeAktivnosti : Screen(STUB_NAMES[name] ?? name)])) });

let tree: ReactTestRenderer | undefined;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await Promise.resolve(); }); };
const shown = () => tree!.root.findAllByType(Text).map(node => node.props.children).filter(text => String(text).startsWith('screen:'));
const selectedTabs = () => [...new Set(tree!.root.findAll(node => node.props.accessibilityRole === 'tab' && typeof node.type !== 'string'
  && node.props.accessibilityState?.selected).map(node => node.props.accessibilityLabel))];
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; jest.useRealTimers(); jest.restoreAllMocks(); });

/** The names in the `(app)` tab navigator's Back history, read from the live navigation state. */
function tabHistory(): string[] {
  type Nav = { type?: string; routes?: { name: string; key: string; state?: Nav }[]; history?: { key: string }[] };
  const find = (state: Nav | undefined): Nav | undefined => !state ? undefined : state.type === 'tab' ? state
    : state.routes?.map(route => find(route.state)).find(Boolean);
  const tabs = find(require('expo-router/build/global-state/store').store.navigationRef.current.getRootState());
  return (tabs?.history ?? []).map(entry => tabs!.routes!.find(route => route.key === entry.key)!.name);
}

it('a link to the retired /moje-aktivnosti opens Početna, with Početna selected and nothing behind it', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/moje-aktivnosti" />); });
  await settle();
  expect(shown()).toContain('screen:pocetna');
  expect(selectedTabs()).toEqual(['Početna']);
  expect(tabHistory()).toEqual(['index']);
});

it('Back after the redirect leaves for where the person came from, never into the retired address again', async () => {
  await act(async () => { tree = create(<ExpoRoot context={routes} location="/" />); });
  await settle();
  await act(async () => router.navigate('/dogovori')); await settle();
  await act(async () => router.navigate('/moje-aktivnosti')); await settle();
  expect(selectedTabs()).toEqual(['Početna']);
  expect(tabHistory()).toEqual(['dogovori', 'index']);
  await act(async () => router.back()); await settle();
  expect(selectedTabs()).toEqual(['Dogovori']);
});

it('no screen compares its focus guard against a token it read while rendering', () => {
  // Kept from the retired screen's suite, where the defect was found: on the owner's phone every row of Moje
  // aktivnosti was dead because the screen read its focus token out of a ref during render. This harness can only
  // focus a screen by re-rendering it, which is exactly what hides the defect, so the property is checked where it
  // lives. A screen that holds a focus token for its guard must publish it with setScope, not read focus.current in
  // its body: a ref written in an effect re-renders nothing, so the rendered value stays the token of the previous
  // visit.
  const routeFiles = readdirSync(join(__dirname, '..', '..', 'app', '(app)'), { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => join(entry.parentPath, entry.name));
  // Two spaces of indentation is the component body, where the value is captured once per render.
  // Deeper than that is inside a callback, where reading focus.current at call time is correct and
  // is what several screens rightly do.
  const offenders = routeFiles
    .filter(file => /^ {2}const [^\n]*scope = focus[.]current/m.test(readFileSync(file, 'utf8')))
    .map(file => file.split(/[\\/]/).slice(-2).join('/'));
  expect(offenders).toEqual([]);
});
