import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

import { FlowFooter } from '../FlowFooter';
import { sys } from '../tokens';

/**
 * The pinned foot of a flow step (round 6): the step's one action on the surface under a hairline, at the screen gutter,
 * in the closure footer's measure. It trusts the screen's own safe area unless the screen asks it to keep the bottom edge.
 */
let tree: ReactTestRenderer;
afterEach(async () => { await act(async () => tree?.unmount()); });
const render = async (element: React.ReactElement) => { await act(async () => { tree = create(element); }); };
const foot = () => tree.root.findAll(node => typeof node.type === 'string' && node.props.testID === 'flow-footer');

it('pins the action on the surface under a hairline, at the screen gutter, inside the screen\'s own safe area', async () => {
  await render(<FlowFooter><Text>Pošalji predlog izmene</Text></FlowFooter>);
  expect(foot()).toHaveLength(1);
  expect(foot()[0].type).toBe('View');
  expect(StyleSheet.flatten(foot()[0].props.style)).toMatchObject({ backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line,
    paddingHorizontal: sys.space.lg, paddingTop: sys.space.md, paddingBottom: sys.space.md, gap: sys.space.sm });
  expect(tree.root.findAllByType('SafeAreaView' as never)).toHaveLength(0);
  expect(foot()[0].findByType(Text).props.children).toBe('Pošalji predlog izmene');
});

it('keeps clear of the bottom edge itself only where the screen asks it to, with the same surface reaching the edge', async () => {
  await render(<FlowFooter edge="bottom"><Text>Pošalji predlog izmene</Text></FlowFooter>);
  expect(foot()).toHaveLength(1);
  expect(foot()[0].type).toBe('SafeAreaView');
  expect(foot()[0].props.edges).toEqual(['bottom']);
  expect(StyleSheet.flatten(foot()[0].props.style)).toMatchObject({ backgroundColor: sys.color.surface, borderTopWidth: 1, borderTopColor: sys.color.line });
});
