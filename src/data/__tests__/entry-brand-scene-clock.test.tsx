import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { BrandArtwork, BrandScene } from '../../ui/entry/BrandScene';
import { brandWords } from '../../ui/entry/spojBrandData';
import referenceFrames from './fixtures/spoj-brand-reference-frames.json';

const mockTiming = jest.fn();
const mockCancel = jest.fn();
const mockSchedule = jest.fn();
let mockClock: { get: () => number; set: jest.Mock };
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  Easing: { bezierFn: () => (value: number) => value, linear: (value: number) => value },
  useAnimatedStyle: (read: () => unknown) => read(),
  useAnimatedProps: () => ({}),
  useSharedValue: (initial: number) => {
    const React = jest.requireActual('react');
    const clock = React.useRef({ get: () => initial, set: jest.fn() });
    mockClock = clock.current; return clock.current;
  },
  withTiming: (...args: unknown[]) => mockTiming(...args),
  cancelAnimation: (...args: unknown[]) => mockCancel(...args),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (...args: unknown[]) => mockSchedule(...args) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', G: 'G', Path: 'Path', Rect: 'Rect', Defs: 'Defs', ClipPath: 'ClipPath' }));

let tree: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); mockTiming.mockReturnValue('UI-runtime-timing'); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('mounts the actual SVG scene at time zero while paused and starts the full unchanged clock only on release', async () => {
  const complete = jest.fn();
  await act(async () => { tree = create(<BrandScene paused onComplete={complete} />); });
  expect(tree.root.findAllByType('Svg' as React.ElementType)).toHaveLength(2);
  expect(tree.root.findAllByType('Path' as React.ElementType).length).toBeGreaterThanOrEqual(11);
  expect(mockClock.set).toHaveBeenLastCalledWith(0); expect(mockTiming).not.toHaveBeenCalled();
  await act(async () => tree.update(<BrandScene animate onComplete={complete} />));
  expect(mockTiming).toHaveBeenCalledTimes(1);
  expect(mockTiming).toHaveBeenCalledWith(4380, expect.objectContaining({ duration: 4380 }), expect.any(Function));
  expect(mockClock.set).toHaveBeenLastCalledWith('UI-runtime-timing');
  await act(async () => tree.update(<BrandScene animate onComplete={complete} />));
  expect(mockTiming).toHaveBeenCalledTimes(1);
});

it('shows the final static frame without allocating a timing animation for reduced/skipped entry', async () => {
  await act(async () => { tree = create(<BrandScene />); });
  expect(mockClock.set).toHaveBeenLastCalledWith(4380); expect(mockTiming).not.toHaveBeenCalled();
});

it('cancels on skip and unmount and does not report a cancelled clock as completion', async () => {
  const complete = jest.fn();
  await act(async () => { tree = create(<BrandScene animate onComplete={complete} />); });
  const callback = mockTiming.mock.calls[0][2];
  callback(false); expect(mockSchedule).not.toHaveBeenCalled();
  await act(async () => tree.update(<BrandScene onComplete={complete} />));
  expect(mockCancel).toHaveBeenCalledWith(mockClock);
  expect(mockClock.set).toHaveBeenLastCalledWith(4380);
  await act(async () => tree.update(<BrandScene animate onComplete={complete} />));
  mockCancel.mockClear(); await act(async () => tree.unmount());
  expect(mockCancel).toHaveBeenCalledWith(mockClock);
});

// These clip widths are original browser observations, not a second evaluation of brandFrame.
it.each(referenceFrames.filter(frame => [2690, 3000, 3500].includes(frame.time)))('clips the original fixed word artwork at $time ms / $phone.width px before phase completion', async frame => {
  const time = { get: () => frame.time } as SharedValue<number>;
  await act(async () => { tree = create(<BrandArtwork time={time} phone={frame.phone} logo={frame.logo} />); });
  const viewport = tree.root.findByProps({ testID: 'entry-word-reveal' });
  const style = StyleSheet.flatten(viewport.props.style), k = frame.logo.width / 320;
  expect(style.width).toBeCloseTo(frame.clip * k, 10);
  expect(style.opacity).toBe(frame.time < 2700 ? 0 : 1);
  expect(style.left).toBeCloseTo(frame.logo.x - 39 * k + 138 * k, 10);
  expect(style.top).toBeCloseTo(frame.logo.y - 174 * k + 170 * k, 10);
  expect(style.height).toBeCloseTo(108 * k, 10);
  expect(style.overflow).toBe('hidden');
  expect(viewport.props.collapsable).toBe(false);
  const artwork = viewport.findByType('Svg' as React.ElementType);
  expect(artwork.props.viewBox).toBe('138 170 225 108');
  expect(artwork.props.width).toBeCloseTo(225 * k, 10);
  expect(artwork.props.height).toBeCloseTo(108 * k, 10);
  expect(artwork.findAllByType('Path' as React.ElementType).map(path => path.props.d)).toEqual(brandWords.flatMap(word => word.paths.map(path => path.d)));
  expect(tree.root.findAllByType('ClipPath' as React.ElementType)).toHaveLength(0);
  expect(mockTiming).not.toHaveBeenCalled();
});
