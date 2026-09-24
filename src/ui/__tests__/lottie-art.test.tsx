import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { LottieArt } from '../system/LottieArt';

let mockReduced = false;
// One store answers both names (ui/system/motion, 2026-09-24): mocking it covers useSystemReducedMotion and every
// component that reads useReducedMotion directly, so the whole tree sees the value this suite chose.
jest.mock('../system/motion', () => ({ useReducedMotion: () => mockReduced }));

const source = { v: '5.7.4', fr: 30, ip: 0, op: 30, w: 100, h: 100, nm: 'proof', ddd: 0, assets: [], layers: [] };
let tree: ReactTestRenderer;
const view = () => tree.root.findByType('LottieView' as React.ElementType).props;

afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

test('plays and loops by default, sized square, and stays silent to a screen reader without a label', async () => {
  mockReduced = false;
  await act(async () => { tree = create(<LottieArt source={source} size={120} />); });
  expect(view()).toMatchObject({ autoPlay: true, loop: true, speed: 1, accessible: false, importantForAccessibility: 'no-hide-descendants' });
  expect(view().progress).toBeUndefined();
  expect(view().style).toEqual([{ width: 120, height: 120 }, undefined]);
});

test('under reduced motion it stands on its first frame and does not loop', async () => {
  mockReduced = true;
  await act(async () => { tree = create(<LottieArt source={source} size={120} label="Asistent sluša" />); });
  expect(view()).toMatchObject({ autoPlay: false, loop: false, progress: 0, accessible: true, accessibilityLabel: 'Asistent sluša', importantForAccessibility: 'yes' });
});

test('an explicit autoPlay={false} is a still picture even when motion is allowed', async () => {
  mockReduced = false;
  await act(async () => { tree = create(<LottieArt source={source} autoPlay={false} />); });
  expect(view()).toMatchObject({ autoPlay: false, loop: false, progress: 0 });
});
