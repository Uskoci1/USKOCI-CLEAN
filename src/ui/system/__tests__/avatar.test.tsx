import React from 'react';
import { StyleSheet, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Avatar, type AvatarSize } from '../Avatar';
import { T } from '../../Text';
import { inicijali } from '../../../lib/inicijali';
import { sys } from '../tokens';

/** One stand-in for a person's photo (2026-09-24). A missing name draws a person, never letters of its own. */
let tree: ReactTestRenderer;
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
afterEach(async () => { await act(async () => tree?.unmount()); });
/** FactArt is memoised, so it is found by what it draws. */
const art = () => tree.root.findAll(node => typeof node.type !== 'string' && node.props.kind !== undefined && node.props.size !== undefined);
const disc = () => StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style);

it.each([32, 40, 56] as AvatarSize[])('draws the initials in a %i px disc, never under 12 px, and keeps them inside it', async size => {
  await render(<Avatar initials={inicijali('Miloš Šljivić')} size={size} />);
  const letters = tree.root.findByType(T);
  expect(letters.props.children).toBe('MŠ');
  expect(StyleSheet.flatten(letters.props.style).fontSize).toBeGreaterThanOrEqual(12);
  expect(letters.props.maxFontSizeMultiplier).toBe(1);
  expect(disc()).toMatchObject({ width: size, height: size, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft });
  expect(art()).toHaveLength(0);
});

it.each([null, undefined, '', '  '])('no initials (%j) draw a person, not letters', async initials => {
  await render(<Avatar initials={initials} size={56} />);
  expect(tree.root.findAllByType(T)).toHaveLength(0);
  expect(art().map(node => node.props.kind)).toContain('person');
});

it('a name with no letters in it reaches the disc as the person, through inicijali()', async () => {
  await render(<Avatar initials={inicijali('—')} />);
  expect(art().map(node => node.props.kind)).toContain('person');
  expect(disc()).toMatchObject({ width: 40, height: 40 });
});

it('is decoration beside the name: a screen reader does not hear it', async () => {
  await render(<Avatar initials="AN" />);
  const root = tree.root.findAllByType(View)[0];
  expect(root.props.accessible).toBe(false);
  expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(root.props.accessibilityElementsHidden).toBe(true);
});
