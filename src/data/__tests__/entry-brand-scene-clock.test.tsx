import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { BrandArtwork, BrandScene, entryPreparationSourceTime, useBrandClock } from '../../ui/entry/BrandScene';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';
import type { EntrySplashReadiness } from '../../hooks/useEntrySplashReady';
import { brandFrame } from '../../ui/entry/spojBrandMath';
import { brandWords } from '../../ui/entry/spojBrandData';
import referenceFrames from './fixtures/spoj-brand-reference-frames.json';

const mockTiming = jest.fn();
const mockCancel = jest.fn();
const mockSchedule = jest.fn();
let mockClock: { get: () => number; set: jest.Mock };
let mockFrame: (frame: { timestamp: number }) => void;
let mockObserver: { setActive: jest.Mock };
const mockHide = jest.fn();
jest.mock('expo-splash-screen', () => ({ setOptions: jest.fn() }));
jest.mock('../../bootstrap/entrySplashBootstrap', () => ({ releaseEntrySplash: () => mockHide() }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  Easing: { bezierFn: () => (value: number) => value, linear: (value: number) => value },
  useAnimatedStyle: (read: () => unknown) => read(),
  useAnimatedProps: () => ({}),
  useFrameCallback: (callback: typeof mockFrame) => {
    const React = jest.requireActual('react');
    mockFrame = callback;
    mockObserver = React.useRef({ setActive: jest.fn() }).current;
    return mockObserver;
  },
  useSharedValue: (initial: unknown) => {
    const React = jest.requireActual('react');
    const value = React.useRef(initial);
    const clock = React.useRef({ get: () => value.current, set: jest.fn((next: unknown) => {
      if (next !== 'UI-runtime-timing') value.current = next;
    }) });
    if (!mockClock) mockClock = clock.current;
    return clock.current;
  },
  withTiming: (...args: unknown[]) => mockTiming(...args),
  cancelAnimation: (...args: unknown[]) => mockCancel(...args),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (...args: unknown[]) => mockSchedule(...args) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', G: 'G', Path: 'Path', Rect: 'Rect', Defs: 'Defs', ClipPath: 'ClipPath' }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks(); mockClock = undefined as unknown as typeof mockClock;
  mockTiming.mockReturnValue('UI-runtime-timing'); mockHide.mockResolvedValue(undefined);
});
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

function FrameProbe({ animate = true, paused = false, onVisible }: {
  animate?: boolean; paused?: boolean; onVisible: (sourceTime: number) => void;
}) {
  useBrandClock(animate, paused, undefined, onVisible);
  return null;
}
const uiFrame = (sourceTime: number, timestamp: number) => {
  mockClock.set(sourceTime); mockFrame({ timestamp });
};
const deliverFrame = () => {
  const [callback, ...args] = mockSchedule.mock.calls[mockSchedule.mock.calls.length - 1];
  callback(...args);
};

it('requires nonzero original artwork and a later UI frame, not layout or exactly40ms', async () => {
  const visible = jest.fn();
  await act(async () => { tree = create(<FrameProbe onVisible={visible} />); });
  expect(mockObserver.setActive).toHaveBeenLastCalledWith(true);
  for (const time of [0, 16, 40]) uiFrame(time, time);
  expect(mockSchedule).not.toHaveBeenCalled();
  uiFrame(41, 48); expect(mockSchedule).not.toHaveBeenCalled();
  uiFrame(55, 48); expect(mockSchedule).not.toHaveBeenCalled();
  uiFrame(64, 64); expect(mockSchedule).toHaveBeenCalledTimes(1);
  expect(visible).not.toHaveBeenCalled();
  await act(async () => deliverFrame());
  expect(visible).toHaveBeenCalledWith(64);
  expect(mockObserver.setActive).toHaveBeenLastCalledWith(false);
  uiFrame(80, 80); expect(mockSchedule).toHaveBeenCalledTimes(1);
  expect(mockTiming).toHaveBeenCalledTimes(1);
  expect(mockTiming).toHaveBeenCalledWith(4380, expect.objectContaining({ duration: 4380 }), expect.any(Function));
});

it('discards a queued old frame on skip and accepts the committed static frame without replay', async () => {
  const visible = jest.fn();
  await act(async () => { tree = create(<FrameProbe onVisible={visible} />); });
  uiFrame(50, 50); uiFrame(66, 66);
  const old = mockSchedule.mock.calls[0];
  await act(async () => tree.update(<FrameProbe animate={false} onVisible={visible} />));
  await act(async () => old[0](...old.slice(1)));
  expect(visible).not.toHaveBeenCalled();
  mockFrame({ timestamp: 82 }); mockFrame({ timestamp: 98 });
  await act(async () => deliverFrame());
  expect(visible).toHaveBeenCalledTimes(1); expect(visible).toHaveBeenCalledWith(4380);
  expect(mockTiming).toHaveBeenCalledTimes(1);
});

it('never releases from an unmounted frame callback and never observes paused geometry', async () => {
  const visible = jest.fn();
  await act(async () => { tree = create(<FrameProbe paused onVisible={visible} />); });
  expect(mockObserver.setActive).toHaveBeenLastCalledWith(false);
  await act(async () => tree.update(<FrameProbe onVisible={visible} />));
  uiFrame(50, 50); uiFrame(66, 66);
  await act(async () => tree.unmount());
  deliverFrame(); expect(visible).not.toHaveBeenCalled();
  expect(mockObserver.setActive).toHaveBeenLastCalledWith(false);
});

function HandoffProbe() {
  const splash = useEntrySplashReady({ waitForScene: true });
  useBrandClock(true, false, undefined, splash.onSceneReady,
    { readiness: splash.readiness, phone: testPhone, logo: testLogo });
  return React.createElement('Snapshot', { splash });
}
const testPhone = { x: 0, y: 0, width: 390, height: 844 };
const testLogo = { x: 43, y: 185, width: 304, height: 98.8 };
function HeldProbe({ readiness = 'pending', animate = true, paused = false, prepared, complete }: {
  readiness?: EntrySplashReadiness; animate?: boolean; paused?: boolean;
  prepared?: (time: number) => void; complete?: () => void;
}) {
  useBrandClock(animate, paused, complete, prepared, { readiness, phone: testPhone, logo: testLogo });
  return null;
}

it('derives the first in-viewport 8-bit source sample, preserving the empty0-40 boundary and every following track', () => {
  expect(brandFrame(40, testPhone, testLogo).parts.every(part => part.opacity === 0)).toBe(true);
  for (const frame of referenceFrames) expect(entryPreparationSourceTime(frame.phone, frame.logo)).toBe(41);
  const first = brandFrame(41, testPhone, testLogo);
  expect(first.parts.map(part => Math.floor(part.opacity * 255))).toEqual([0, 0, 0, 0, 0, 1, 1]);
  expect(first.wordOpacity).toBe(0); expect(first.slogan.opacity).toBe(0);
  expect(first.background.greenPercent).toBe(-101); expect(first.choices.opacity).toBe(0);
});

it('holds the exact prepared source state across delayed RN delivery, without allocating a running timeline', async () => {
  const prepared = jest.fn();
  await act(async () => { tree = create(<HeldProbe prepared={prepared} />); });
  expect(mockClock.get()).toBe(41); expect(mockTiming).not.toHaveBeenCalled();
  mockFrame({ timestamp: 10 }); mockFrame({ timestamp: 26 });
  expect(mockSchedule).toHaveBeenCalledTimes(1);
  const queued = mockSchedule.mock.calls[0];
  // The RN queue may be busy. UI frames keep the original preparation sample;
  // no absolute wall-clock catch-up is allowed under the native cover.
  for (const timestamp of [42, 100, 500, 1500, 2500]) mockFrame({ timestamp });
  expect(mockClock.get()).toBe(41); expect(mockTiming).not.toHaveBeenCalled();
  await act(async () => queued[0](...queued.slice(1)));
  expect(prepared).toHaveBeenCalledWith(41);
  expect(mockObserver.setActive).toHaveBeenLastCalledWith(true);
  mockFrame({ timestamp: 3000 }); expect(mockTiming).not.toHaveBeenCalled();
});

it('resumes the same source sample once after acknowledgement and later UI frames, without replay or acceleration', async () => {
  const prepared = jest.fn(), complete = jest.fn();
  await act(async () => { tree = create(<HeldProbe prepared={prepared} complete={complete} />); });
  mockFrame({ timestamp: 10 }); mockFrame({ timestamp: 26 });
  await act(async () => deliverFrame());
  await act(async () => tree.update(<HeldProbe readiness="ready" prepared={prepared} complete={complete} />));
  expect(mockClock.get()).toBe(41); expect(mockTiming).not.toHaveBeenCalled();
  mockFrame({ timestamp: 1600 }); mockFrame({ timestamp: 1600 });
  expect(mockTiming).not.toHaveBeenCalled();
  mockFrame({ timestamp: 1616 });
  expect(mockTiming).toHaveBeenCalledTimes(1);
  expect(mockTiming).toHaveBeenCalledWith(4380, expect.objectContaining({ duration: 4339 }), expect.any(Function));
  expect(mockClock.set.mock.calls.filter(([value]) => value === 0)).toHaveLength(0);
  mockFrame({ timestamp: 1632 }); mockFrame({ timestamp: 1800 });
  await act(async () => tree.update(<HeldProbe readiness="ready" prepared={prepared} complete={complete} />));
  expect(mockTiming).toHaveBeenCalledTimes(1);
  const done = mockTiming.mock.calls[0][2];
  done(false); expect(complete).not.toHaveBeenCalled();
  done(true); await act(async () => deliverFrame());
  expect(complete).toHaveBeenCalledTimes(1);
});

it('holds preparation until the real hide request settles and later frame handoff completes', async () => {
  jest.useFakeTimers();
  try {
    let acknowledge!: () => void;
    mockHide.mockReturnValue(new Promise<void>(resolve => { acknowledge = resolve; }));
    await act(async () => { tree = create(<HandoffProbe />); });
    const state = () => tree.root.findByType('Snapshot' as React.ElementType).props.splash;
    await act(async () => state().onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } } }));
    expect(mockTiming).not.toHaveBeenCalled(); expect(mockClock.get()).toBe(41);
    expect(mockHide).not.toHaveBeenCalled(); expect(state().readiness).toBe('pending');
    mockFrame({ timestamp: 0 });
    expect(mockHide).not.toHaveBeenCalled(); expect(mockSchedule).not.toHaveBeenCalled();
    mockFrame({ timestamp: 16 });
    expect(mockHide).not.toHaveBeenCalled();
    await act(async () => deliverFrame());
    expect(mockHide).toHaveBeenCalledTimes(1);
    for (const timestamp of [100, 250, 500]) mockFrame({ timestamp });
    expect(mockClock.get()).toBe(41); expect(mockTiming).not.toHaveBeenCalled();
    await act(async () => acknowledge());
    expect(state().readiness).toBe('pending'); expect(mockTiming).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(40));
    expect(state().readiness).toBe('ready'); expect(mockTiming).not.toHaveBeenCalled();
    mockFrame({ timestamp: 600 }); expect(mockTiming).not.toHaveBeenCalled();
    mockFrame({ timestamp: 616 });
    expect(mockTiming).toHaveBeenCalledWith(4380, expect.objectContaining({ duration: 4339 }), expect.any(Function));
    await act(async () => tree.unmount());
  } finally { jest.useRealTimers(); }
});

it.each(['skip', 'reduced'] as const)('discards a delayed prepared acknowledgement after %s, showing static welcome with no replay', async reason => {
  const prepared = jest.fn();
  await act(async () => { tree = create(<HeldProbe prepared={prepared} />); });
  mockFrame({ timestamp: 0 }); mockFrame({ timestamp: 16 });
  const old = mockSchedule.mock.calls[0];
  await act(async () => tree.update(<HeldProbe animate={false} readiness={reason === 'skip' ? 'skip' : 'pending'} prepared={prepared} />));
  await act(async () => old[0](...old.slice(1)));
  expect(prepared).not.toHaveBeenCalled(); expect(mockClock.get()).toBe(4380);
  expect(mockTiming).not.toHaveBeenCalled();
  mockFrame({ timestamp: 32 }); mockFrame({ timestamp: 48 });
  await act(async () => deliverFrame());
  expect(prepared).toHaveBeenCalledWith(4380);
  await act(async () => tree.update(<HeldProbe animate={false} readiness="ready" prepared={prepared} />));
  mockFrame({ timestamp: 64 }); mockFrame({ timestamp: 80 });
  expect(mockTiming).not.toHaveBeenCalled();
});

it('invalidates queued preparation and completion when the lifetime ends', async () => {
  const prepared = jest.fn(), complete = jest.fn();
  await act(async () => { tree = create(<HeldProbe prepared={prepared} complete={complete} />); });
  mockFrame({ timestamp: 0 }); mockFrame({ timestamp: 16 });
  const old = mockSchedule.mock.calls[0];
  await act(async () => tree.unmount());
  await act(async () => old[0](...old.slice(1)));
  expect(prepared).not.toHaveBeenCalled(); expect(mockTiming).not.toHaveBeenCalled();
  await act(async () => { tree = create(<HeldProbe readiness="ready" prepared={prepared} complete={complete} />); });
  mockFrame({ timestamp: 32 }); mockFrame({ timestamp: 48 });
  mockFrame({ timestamp: 64 }); mockFrame({ timestamp: 80 });
  const done = mockTiming.mock.calls[0][2];
  await act(async () => tree.unmount());
  done(true); await act(async () => deliverFrame());
  expect(complete).not.toHaveBeenCalled();
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
