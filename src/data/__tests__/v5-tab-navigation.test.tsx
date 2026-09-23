import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
jest.mock('expo-router', () => { const React = require('react');
  const Tabs = (props: object) => React.createElement('Tabs', props);
  Tabs.Screen = (props: object) => React.createElement('Screen', props); return { Tabs };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock('phosphor-react-native', () => ({ House: 'Icon', Handshake: 'Icon' }));
jest.mock('../../ui/referenceEntry/ReferenceEntryHero', () => ({ CanonicalMark: 'Mark' }));
import Tabs from '../../app/(app)/_layout';
import { Press } from '../../ui/Press';
let tree: ReactTestRenderer;
const routes = ['index', 'zadaci', 'dogovori', 'profil', 'profil/obavestenja', 'moje-aktivnosti', 'prilike', 'mapa', 'prilike/[id]', 'oceni-dogovor']
  .map(name => ({ name, key: name }));
function optionsFor(name: string, history: string[]) {
  const options = tree.root.findByType('Tabs' as React.ElementType).props.screenOptions;
  const state = { index: routes.findIndex(route => route.name === history[history.length - 1]), routes,
    history: history.map(key => ({ type: 'route', key })) };
  return typeof options === 'function' ? options({ route: routes.find(route => route.name === name), navigation: { getState: () => state } }) : options;
}
function tabButton(name: string, history: string[]) {
  return optionsFor(name, history).tabBarButton({ children: name, 'aria-selected': name === history[history.length - 1] });
}
afterEach(async () => { await act(async () => tree?.unmount()); });

/**
 * Owner decision 1 (2026-09-19): one shell for an account that may at
 * the same moment own tasks, have applied to others, and hold Dogovori on both sides. Until then the
 * shell had two shapes chosen by a global mode, and `Tabs key={intent}` remounted the whole
 * navigator — every screen under it — whenever the mode changed. Since the owner's information architecture of
 * 2026-09-23 the shell is Početna | Zadaci | Dogovori: Zadaci replaced the Mapa tab and the duplicate `/prilike` root.
 */
it('is one shell: Početna | Zadaci | Dogovori, in that order, whoever the account is to a task', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  const visible = screens.filter(screen => screen.props.options.href !== null);
  expect(visible.map(screen => screen.props.name)).toEqual(['index', 'zadaci', 'dogovori']);
  expect(visible.map(screen => screen.props.options.title)).toEqual(['Početna', 'Zadaci', 'Dogovori']);
  expect(visible.map(screen => screen.props.options.tabBarAccessibilityLabel)).toEqual(['Početna', 'Zadaci', 'Dogovori']);
  expect(tree.root.findByType('Tabs' as React.ElementType).props.initialRouteName).toBe('index');
});

it('never remounts the navigator: it has no key and reads no mode', async () => {
  await act(async () => { tree = create(<Tabs />); });
  // A key on the navigator is what reset every screen beneath it. React does not expose `key` as a
  // prop, so the source is the witness, together with the absence of the store that fed it.
  const source = readFileSync(join(__dirname, '../../app/(app)/_layout.tsx'), 'utf8');
  expect(source).not.toMatch(/<Tabs\s+key=/);
  expect(source).not.toMatch(/store\/uloga/);
});

it('Back leads to where the person actually came from: the navigator walks its own history', async () => {
  await act(async () => { tree = create(<Tabs />); });
  // A Task opened from Početna, from Zadaci or from a list is the same hidden route. With any other
  // back behaviour Back would land on the first tab, whichever of them the person had come from.
  expect(tree.root.findByType('Tabs' as React.ElementType).props.backBehavior).toBe('history');
});

it('keeps every earlier destination registered and reachable by its URL, only no longer as a tab', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  const hidden = (name: string) => screens.find(screen => screen.props.name === name)?.props.options.href;
  for (const name of ['potrebe', 'moje-prijave', 'prilike', 'mapa', 'nova', 'pregled-nacrta', 'pregled-zadatka', 'moje-aktivnosti',
    'profil', 'potrebe/[id]/pregled', 'potrebe/[id]/kandidati', 'prilike/[id]', 'prilike/[id]/prijava']) expect(hidden(name)).toBeNull();
});

it('the new tab surface preserves navigator press/long-press handlers and exposes the selected tab', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const renderButton = optionsFor('zadaci', ['index', 'zadaci']).tabBarButton;
  const onPress = jest.fn(), onLongPress = jest.fn();
  const button = renderButton({ children: 'Zadaci', onPress, onLongPress, 'aria-label': 'Zadaci', 'aria-selected': true, testID: 'tasks-tab' });
  expect(button.type).toBe(Press);
  expect(button.props.accessibilityRole).toBe('tab');
  expect(button.props.accessibilityLabel).toBe('Zadaci');
  expect(button.props.accessibilityState).toEqual({ selected: true });
  const event = { nativeEvent: {} };
  button.props.onPress(event); button.props.onLongPress(event);
  expect(onPress).toHaveBeenCalledWith(event); expect(onLongPress).toHaveBeenCalledWith(event);
  expect(tabButton('index', ['index', 'zadaci']).props.accessibilityState).toEqual({ selected: false });
});

it.each(['index', 'zadaci', 'dogovori'])('profile settings preserve the originating %s tab across two inner screens', async origin => {
  await act(async () => { tree = create(<Tabs />); });
  const history = [origin, 'profil', 'profil/obavestenja'];
  const selected = ['index', 'zadaci', 'dogovori'].filter(name => tabButton(name, history).props.accessibilityState.selected);
  expect(selected).toEqual([origin]);
  expect(optionsFor(origin, history).tabBarIcon({ focused: false }).props.muted).toBe(false);
});

it('returning through history updates the section and never hijacks the actual tab action', async () => {
  await act(async () => { tree = create(<Tabs />); });
  expect(tabButton('dogovori', ['index', 'zadaci', 'dogovori', 'profil']).props.accessibilityState.selected).toBe(true);
  expect(tabButton('zadaci', ['index', 'zadaci', 'profil']).props.accessibilityState.selected).toBe(true);
  const onPress = jest.fn();
  optionsFor('zadaci', ['index', 'zadaci', 'profil']).tabBarButton({ onPress, 'aria-selected': false }).props.onPress();
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('an inner link without tab history still has one truthful section fallback', async () => {
  await act(async () => { tree = create(<Tabs />); });
  // A task and the two retired discovery addresses belong to Zadaci.
  for (const inner of ['prilike', 'prilike/[id]', 'mapa']) expect(tabButton('zadaci', [inner]).props.accessibilityState.selected).toBe(true);
  expect(tabButton('dogovori', ['oceni-dogovor']).props.accessibilityState.selected).toBe(true);
  expect(tabButton('index', ['profil']).props.accessibilityState.selected).toBe(true);
});

it('the publishing, review and location flows still hide the tabs', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  for (const name of ['nova', 'pregled-zadatka', 'mesto-zadatka']) {
    expect(screens.find(screen => screen.props.name === name)?.props.options.tabBarStyle.display).toBe('none');
  }
});

// Početna got its own house (2026-09-23): the clipboard sat next to a tab called Zadaci. Zadaci keeps the map.
it('draws Početna as a house, Zadaci as the map and Dogovori as agreements', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const kinds = ['index', 'zadaci', 'dogovori'].map(name => optionsFor(name, [name]).tabBarIcon({ focused: true }).props.kind);
  expect(kinds).toEqual(['home', 'map', 'agreements']);
});

it('keeps the retired discovery addresses as hidden redirects that never show the bar', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  for (const name of ['mapa', 'prilike']) {
    const options = screens.find(screen => screen.props.name === name)?.props.options;
    expect(options.href).toBeNull(); expect(options.tabBarStyle.display).toBe('none'); expect(options.animation).toBe('none');
  }
});
