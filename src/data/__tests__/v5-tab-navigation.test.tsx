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
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });

/**
 * Owner decision 1 (2026-09-19): one shell, Početna | Mapa | Dogovori, for an account that may at
 * the same moment own tasks, have applied to others, and hold Dogovori on both sides. Until then the
 * shell had two shapes chosen by a global mode, and `Tabs key={intent}` remounted the whole
 * navigator — every screen under it — whenever the mode changed.
 */
it('is one shell: Početna | Mapa | Dogovori, in that order, whoever the account is to a task', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  const visible = screens.filter(screen => screen.props.options.href !== null);
  expect(visible.map(screen => screen.props.name)).toEqual(['index', 'mapa', 'dogovori']);
  expect(visible.map(screen => screen.props.options.title)).toEqual(['Početna', 'Mapa', 'Dogovori']);
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
  // A Task opened from Početna, from Mapa or from a list is the same hidden route. With any other
  // back behaviour Back would land on the first tab, whichever of them the person had come from.
  expect(tree.root.findByType('Tabs' as React.ElementType).props.backBehavior).toBe('history');
});

it('keeps every earlier destination registered and reachable by its URL, only no longer as a tab', async () => {
  await act(async () => { tree = create(<Tabs />); });
  const screens = tree.root.findAllByType('Screen' as React.ElementType);
  const hidden = (name: string) => screens.find(screen => screen.props.name === name)?.props.options.href;
  for (const name of ['potrebe', 'moje-prijave', 'prilike', 'nova', 'pregled-nacrta', 'pregled-zadatka', 'moje-aktivnosti',
    'profil', 'potrebe/[id]/pregled', 'potrebe/[id]/kandidati', 'prilike/[id]', 'prilike/[id]/prijava']) expect(hidden(name)).toBeNull();
});
