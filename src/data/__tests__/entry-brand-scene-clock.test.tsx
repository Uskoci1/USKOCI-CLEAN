import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { BrandScene } from '../../ui/entry/BrandScene';

const mockTiming = jest.fn();
const mockCancel = jest.fn();
const mockSchedule = jest.fn();
let mockClock: { get: () => number; set: jest.Mock };
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' },
  Easing: { bezierFn: () => (value: number) => value, linear: (value: number) => value },
  useAnimatedStyle: () => ({}),
  useSharedValue: (initial: number) => {
    const React = jest.requireActual('react');
    const clock = React.useRef({ get: () => initial, set: jest.fn() });
    mockClock = clock.current; return clock.current;
  },
  withTiming: (...args: unknown[]) => mockTiming(...args),
  cancelAnimation: (...args: unknown[]) => mockCancel(...args),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (...args: unknown[]) => mockSchedule(...args) }));
jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml' }));

let tree: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); mockTiming.mockReturnValue('UI-runtime-timing'); });
afterEach(async () => { await act(async () => tree?.unmount()); });

it('mounts the actual SVG scene at time zero while paused and starts the full unchanged clock only on release', async () => {
  const complete = jest.fn();
  await act(async () => { tree = create(<BrandScene paused onComplete={complete} />); });
  expect(tree.root.findAllByType('SvgXml' as React.ElementType)).toHaveLength(11);
  expect(mockClock.set).toHaveBeenLastCalledWith(0); expect(mockTiming).not.toHaveBeenCalled();
  await act(async () => tree.update(<BrandScene animate onComplete={complete} />));
  expect(mockTiming).toHaveBeenCalledTimes(1);
  expect(mockTiming).toHaveBeenCalledWith(4500, expect.objectContaining({ duration: 4500 }), expect.any(Function));
  expect(mockClock.set).toHaveBeenLastCalledWith('UI-runtime-timing');
  await act(async () => tree.update(<BrandScene animate onComplete={complete} />));
  expect(mockTiming).toHaveBeenCalledTimes(1);
});

it('shows the final static frame without allocating a timing animation for reduced/skipped entry', async () => {
  await act(async () => { tree = create(<BrandScene />); });
  expect(mockClock.set).toHaveBeenLastCalledWith(4500); expect(mockTiming).not.toHaveBeenCalled();
});

it('cancels on skip and unmount and does not report a cancelled clock as completion', async () => {
  const complete = jest.fn();
  await act(async () => { tree = create(<BrandScene animate onComplete={complete} />); });
  const callback = mockTiming.mock.calls[0][2];
  callback(false); expect(mockSchedule).not.toHaveBeenCalled();
  await act(async () => tree.update(<BrandScene onComplete={complete} />));
  expect(mockCancel).toHaveBeenCalledWith(mockClock);
  expect(mockClock.set).toHaveBeenLastCalledWith(4500);
  await act(async () => tree.update(<BrandScene animate onComplete={complete} />));
  mockCancel.mockClear(); await act(async () => tree.unmount());
  expect(mockCancel).toHaveBeenCalledWith(mockClock);
});
