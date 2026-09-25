import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('../motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../Text', () => ({ T: 'T' }));

import { Segmented, type SegmentedOption } from '../Segmented';
import { sys } from '../tokens';

type Key = 'active' | 'history';
const options: SegmentedOption<Key>[] = [{ key: 'active', label: 'Aktivni', badge: 3, badgeLabel: '3 Dogovora' },
  { key: 'history', label: 'Istorija', badge: 2, badgeLabel: '2 Dogovora' }];
const change = jest.fn();
let tree: ReactTestRenderer;
const control = (value: Key = 'active', extra: Partial<React.ComponentProps<typeof Segmented<Key>>> = {}) =>
  <Segmented options={options} value={value} onChange={change} appearance="underline" {...extra} />;
const render = async (element = control()) => act(async () => { tree = create(element); });
const update = async (element: React.ReactElement) => act(async () => tree.update(element));
const tab = (label: string) => tree.root.findByProps({ accessibilityLabel: label });
const measure = async (label: string, x: number, width: number) => act(async () =>
  tab(label).props.onLayout({ nativeEvent: { layout: { x, y: 0, width, height: 48 } } }));
const indicator = () => tree.root.findByType(Animated.View);
const flatIndicator = () => StyleSheet.flatten(indicator().props.style);

beforeEach(() => { jest.useFakeTimers(); change.mockClear(); });
afterEach(async () => {
  await act(async () => tree?.unmount());
  mockReduced = false; jest.restoreAllMocks(); jest.useRealTimers();
});

test('paints selection before measurement, then moves one native underline while tab semantics change immediately', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  await render();
  expect(StyleSheet.flatten(tab('Aktivni').props.style).borderBottomColor).toBe(sys.color.green);
  expect(tree.root.findAllByType(Animated.View)).toHaveLength(0);
  await measure('Aktivni', 0, 86);
  expect(timing).not.toHaveBeenCalled();
  expect(flatIndicator()).toMatchObject({ width: 1, height: 3, backgroundColor: sys.color.green });
  const firstTransforms = flatIndicator().transform;
  const firstWidth = firstTransforms[1].scaleX.__getValue();
  expect(firstWidth).toBe(86);
  // The scaled one-dp line's left edge is exactly the measured x on its first native frame.
  expect(firstTransforms[0].translateX.__getValue() + (1 - firstWidth) / 2).toBe(0);
  expect(StyleSheet.flatten(tab('Aktivni').props.style).borderBottomColor).toBe('transparent');
  await measure('Istorija', 106, 110);
  await act(async () => tab('Istorija').props.onPress());
  expect(change).toHaveBeenCalledWith('history');
  await update(control('history'));
  expect(tab('Istorija').props.accessibilityState).toEqual({ selected: true });
  expect(tab('Aktivni').props.accessibilityState).toEqual({ selected: false });
  expect(tab('Istorija').props.accessibilityValue).toEqual({ text: '2 Dogovora' });
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    toValue: 160.5, duration: sys.motion.toggle, useNativeDriver: true,
  }));
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 110, useNativeDriver: true }));
  expect(tree.root.findAllByType(Animated.View)).toHaveLength(1);
});

test('remeasures label/count width and the following tab position instead of assuming equal segments', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  await render();
  await measure('Aktivni', 0, 86); await measure('Istorija', 106, 110);
  const counted = [{ ...options[0], badge: 123, badgeLabel: '123 Dogovora' }, options[1]];
  await update(control('active', { options: counted }));
  expect(tab('Aktivni').props.accessibilityValue).toEqual({ text: '123 Dogovora' });
  await measure('Aktivni', 0, 124); await measure('Istorija', 144, 110);
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 124, useNativeDriver: true }));
  timing.mockClear();
  await update(control('history', { options: counted }));
  expect(timing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ toValue: 198.5, useNativeDriver: true }));
});

test('reduced motion places the underline at the measured target and updated width without starting a transition', async () => {
  mockReduced = true;
  const timing = jest.spyOn(Animated, 'timing');
  await render();
  await measure('Aktivni', 0, 86); await measure('Istorija', 106, 110);
  await update(control('history'));
  await measure('Istorija', 140, 150);
  expect(timing).not.toHaveBeenCalled();
  const transforms = flatIndicator().transform;
  expect(transforms[0].translateX.__getValue()).toBe(214.5);
  expect(transforms[1].scaleX.__getValue()).toBe(150);
  expect(tab('Istorija').props.accessibilityState.selected).toBe(true);
});

test('a scrolling underline belongs to the measured content row, while the fixed pill keeps its first-frame fallback', async () => {
  await render(control('active', { scroll: true }));
  await measure('Aktivni', 0, 86);
  expect(indicator().parent).toBe(tab('Aktivni').parent);
  await act(async () => tree.unmount());
  await render(control('active', { appearance: 'pill' }));
  expect(StyleSheet.flatten(tab('Aktivni').props.style).backgroundColor).toBe(sys.color.surface);
  await measure('Aktivni', 4, 150);
  expect(flatIndicator().width).toBe(150);
  expect(flatIndicator().transform[0].translateX.__getValue()).toBe(4);
});
