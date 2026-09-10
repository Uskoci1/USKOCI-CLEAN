import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { LayoutChangeEvent } from 'react-native';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { brandParts } from '../../ui/entry/spojBrandData';
import { BRAND_PARTS } from '../../ui/entry/spojBrandMath';

const mockHide = jest.fn();
const mockOptions = jest.fn();
const mockStartupOrder: string[] = [];
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

it.each([false, true])('configures zero fade before Router startup while preserving recovery capture (bridge failure %s)', bridgeFailure => {
  mockStartupOrder.length = 0;
  mockOptions.mockImplementationOnce(options => {
    expect(options).toEqual({ duration: 0, fade: false }); mockStartupOrder.push('splash');
    if (bridgeFailure) throw new Error('cosmetic bridge unavailable');
  });
  jest.doMock('../../bootstrap/passwordRecoveryBootstrap', () => { mockStartupOrder.push('recovery'); return {}; });
  jest.doMock('expo-router/entry', () => { mockStartupOrder.push('router'); return {}; });
  try {
    // Execute the actual entry/import order. The Router and URL-capture module
    // boundaries are isolated; the new splash bootstrap itself is real.
    jest.isolateModules(() => { require('../../../index'); });
    expect(mockStartupOrder).toEqual(['recovery', 'splash', 'router']);
    expect(mockHide).not.toHaveBeenCalled();
  } finally {
    jest.dontMock('../../bootstrap/passwordRecoveryBootstrap');
    jest.dontMock('expo-router/entry');
  }
});

it('uses a visible original mark on white for both native themes instead of an empty drawable', () => {
  const project = resolve(__dirname, '../../..');
  const config = JSON.parse(readFileSync(resolve(project, 'app.json'), 'utf8')).expo;
  const splash = config.plugins.find((item: unknown) => Array.isArray(item) && item[0] === 'expo-splash-screen')[1];
  expect(splash).toEqual({ backgroundColor: '#FFFFFF', image: './assets/entry-splash-mark.png',
    imageWidth: 144, resizeMode: 'contain', dark: { backgroundColor: '#FFFFFF', image: './assets/entry-splash-mark.png' } });
  const png = readFileSync(resolve(project, splash.image));
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(640); expect(png.readUInt32BE(20)).toBe(640);
  expect(png.byteLength).toBeGreaterThan(1000);
  const svg = readFileSync(resolve(project, 'assets/entry-splash-mark.svg'), 'utf8');
  // Exact same paths/fills/translations as the real BrandMark; only an outer
  // centered safe-area pad is added for the native OS icon canvas.
  const paths = [...svg.matchAll(/<path d="([^"]+)" fill="([^"]+)"\/>/g)].map(match => ({ d: match[1], fill: match[2] }));
  expect(paths).toEqual(brandParts.flat());
  const transforms = [...svg.matchAll(/<g transform="([^"]+)"/g)].map(match => match[1]);
  expect(transforms).toEqual(['translate(20 14.5)', ...BRAND_PARTS.map(part => `translate(${part[0]} ${part[1]})`)]);
  expect(svg).toContain('25162f9bc7e7f822e77bd4ff078b8295a50796e9af49ffbdac98dac04d17ae97');
});
