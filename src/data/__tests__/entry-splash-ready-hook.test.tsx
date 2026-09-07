import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { LayoutChangeEvent } from 'react-native';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';

const mockHide = jest.fn();
const mockOptions = jest.fn();
jest.mock('expo-splash-screen', () => ({
  hideAsync: () => mockHide(), setOptions: (options: unknown) => mockOptions(options),
}));

let tree: ReactTestRenderer;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let timers: jest.SpyInstance;
let clearTimers: jest.SpyInstance;
function Probe() { return React.createElement('Snapshot', { snapshot: useEntrySplashReady() }); }
const snapshot = () => tree.root.findByType('Snapshot' as React.ElementType).props.snapshot;
const layout = (width = 390, height = 844) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } }) as LayoutChangeEvent;
async function mount() { await act(async () => { tree = create(<Probe />); }); }
async function draw() {
  const callbacks = [...frames.values()]; frames.clear();
  await act(async () => { callbacks.forEach(callback => callback(0)); });
}
function expectDeadlineCleared() {
  const ownTimer = timers.mock.calls.findIndex(([, delay]) => delay === 1000);
  expect(ownTimer).toBeGreaterThanOrEqual(0);
  expect(clearTimers).toHaveBeenCalledWith(timers.mock.results[ownTimer].value);
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); frames = new Map(); nextFrame = 0;
  mockHide.mockResolvedValue(undefined);
  timers = jest.spyOn(global, 'setTimeout');
  clearTimers = jest.spyOn(global, 'clearTimeout');
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++nextFrame, callback); return nextFrame;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => { if (id != null) frames.delete(id); });
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  jest.restoreAllMocks(); jest.useRealTimers();
});

it('requires nonzero layout, fulfilled hide, and a draw before the following frame', async () => {
  let hidden!: () => void;
  mockHide.mockReturnValue(new Promise<void>(resolve => { hidden = resolve; }));
  await mount(); expect(snapshot().readiness).toBe('pending'); expect(mockHide).not.toHaveBeenCalled();
  await act(async () => snapshot().onLayout(layout(0)));
  expect(mockHide).not.toHaveBeenCalled();
  await act(async () => snapshot().onLayout(layout()));
  expect(mockOptions).toHaveBeenCalledWith({ duration: 0, fade: false });
  expect(mockHide).toHaveBeenCalledTimes(1); expect(frames.size).toBe(0);
  await act(async () => hidden()); expect(snapshot().readiness).toBe('pending');
  await draw(); expect(snapshot().readiness).toBe('pending');
  await draw(); expect(snapshot().readiness).toBe('ready'); expectDeadlineCleared();
});

it('does not restart readiness on duplicate layout or a later resize', async () => {
  await mount(); await act(async () => snapshot().onLayout(layout()));
  await act(async () => snapshot().onLayout(layout(430, 900)));
  await draw(); await draw();
  await act(async () => snapshot().onLayout(layout()));
  expect(snapshot().readiness).toBe('ready'); expect(mockHide).toHaveBeenCalledTimes(1);
});

it('skips motion on a native rejection without pretending readiness or scheduling frames', async () => {
  mockHide.mockRejectedValueOnce(new Error('native unavailable'));
  await mount(); await act(async () => snapshot().onLayout(layout()));
  expect(snapshot().readiness).toBe('skip'); expect(frames.size).toBe(0);
  expectDeadlineCleared();
});

it('bounds a hung native hide and ignores its late completion', async () => {
  let hidden!: () => void;
  mockHide.mockReturnValue(new Promise<void>(resolve => { hidden = resolve; }));
  await mount(); await act(async () => snapshot().onLayout(layout()));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(snapshot().readiness).toBe('skip');
  await act(async () => hidden()); expect(frames.size).toBe(0);
  expect(snapshot().readiness).toBe('skip');
});

it('cancels stalled frames at the deadline instead of starting a late animation', async () => {
  await mount(); await act(async () => snapshot().onLayout(layout()));
  const queued = [...frames.values()][0];
  await act(async () => jest.advanceTimersByTime(1000));
  expect(snapshot().readiness).toBe('skip'); expect(frames.size).toBe(0);
  await act(async () => queued(0)); expect(frames.size).toBe(0);
});

it('ignores native completion after unmount and clears the deadline', async () => {
  let hidden!: () => void;
  mockHide.mockReturnValue(new Promise<void>(resolve => { hidden = resolve; }));
  await mount(); await act(async () => snapshot().onLayout(layout()));
  await act(async () => tree.unmount()); await act(async () => hidden());
  expect(frames.size).toBe(0); expectDeadlineCleared();
});

it('cancels the second frame on unmount and rejects an already queued callback', async () => {
  await mount(); await act(async () => snapshot().onLayout(layout())); await draw();
  const queued = [...frames.values()][0];
  await act(async () => tree.unmount()); expect(frames.size).toBe(0);
  await act(async () => queued(0)); expect(frames.size).toBe(0);
  expectDeadlineCleared();
});
