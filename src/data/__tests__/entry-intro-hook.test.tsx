import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEntryIntro } from '../../hooks/useEntryIntro';
import type { EntrySplashReadiness } from '../../hooks/useEntrySplashReady';

const mockRead = jest.fn();
const mockWrite = jest.fn();
const mockRemove = jest.fn();
let mockReduced = false;
let mockForeground: (state: string) => void;
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockRead(...args),
  setItem: (...args: unknown[]) => mockWrite(...args),
}));
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => mockReduced }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'AppState' ? { addEventListener: (_: unknown, callback: typeof mockForeground) => {
      mockForeground = callback; return { remove: mockRemove };
    } } : Reflect.get(target, key);
  } });
});
function Probe({ readiness = 'ready' }: { readiness?: EntrySplashReadiness }) {
  return React.createElement('Snapshot', { snapshot: useEntryIntro(readiness) });
}
let tree: ReactTestRenderer;
const snapshot = () => tree.root.findByType('Snapshot' as React.ElementType).props.snapshot;
async function mount() { await act(async () => { tree = create(<Probe />); }); }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); mockReduced = false;
  mockRead.mockResolvedValue(null); mockWrite.mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

it('plays once, lets skip win over completion, and persists only cosmetic state', async () => {
  await mount(); expect(snapshot().phase).toBe('intro');
  await act(async () => { snapshot().finish(); snapshot().finish(); });
  expect(snapshot().phase).toBe('welcome');
  expect(mockWrite).toHaveBeenCalledTimes(1);
  expect(mockWrite).toHaveBeenCalledWith('uskoci.presentation.intro-seen.v1', '1');
});
it('skips motion for accessibility without waiting on storage', async () => {
  mockReduced = true; await mount();
  expect(snapshot().phase).toBe('welcome'); expect(mockRead).not.toHaveBeenCalled();
});
it('does not replay after the persisted first visit', async () => {
  mockRead.mockResolvedValue('1'); await mount(); expect(snapshot().phase).toBe('welcome');
});
it('finishes an active intro when reduced motion changes and never replays when disabled again', async () => {
  await mount(); expect(snapshot().phase).toBe('intro');
  mockReduced = true; await act(async () => tree.update(<Probe />));
  expect(snapshot().phase).toBe('welcome');
  mockReduced = false; await act(async () => tree.update(<Probe />));
  expect(snapshot().phase).toBe('welcome'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('opens welcome if storage hangs and rejects the late first-visit response', async () => {
  let resolve!: (value: null) => void;
  mockRead.mockReturnValue(new Promise(done => { resolve = done; }));
  await mount(); expect(snapshot().phase).toBe('loading');
  await act(async () => jest.advanceTimersByTime(500)); expect(snapshot().phase).toBe('welcome');
  await act(async () => resolve(null)); expect(snapshot().phase).toBe('welcome');
});
it('opens welcome on a failed read and never blocks on a failed cosmetic write', async () => {
  mockRead.mockRejectedValue(new Error('storage unavailable'));
  mockWrite.mockRejectedValue(new Error('storage full'));
  await mount(); expect(snapshot().phase).toBe('welcome');
  await act(async () => snapshot().finish()); expect(snapshot().phase).toBe('welcome');
});
it('finishes on background and discards an already queued completion after unmount', async () => {
  await mount(); const complete = snapshot().finish;
  await act(async () => mockForeground('background')); expect(snapshot().phase).toBe('welcome');
  await act(async () => tree.unmount()); expect(mockRemove).toHaveBeenCalledTimes(1);
  await act(async () => complete()); expect(mockWrite).toHaveBeenCalledTimes(1);
});
it('does not persist a delayed animation completion after leaving the screen', async () => {
  await mount(); const complete = snapshot().finish;
  await act(async () => tree.unmount()); await act(async () => complete());
  expect(mockWrite).not.toHaveBeenCalled();
});

it('holds the entire intro until splash readiness, independent of early cosmetic storage', async () => {
  await act(async () => { tree = create(<Probe readiness="pending" />); });
  expect(snapshot().phase).toBe('loading');
  await act(async () => jest.advanceTimersByTime(4500));
  expect(snapshot().phase).toBe('loading'); expect(mockWrite).not.toHaveBeenCalled();
  await act(async () => tree.update(<Probe readiness="ready" />));
  expect(snapshot().phase).toBe('intro'); expect(mockRead).toHaveBeenCalledTimes(1);
});

it('shows static welcome on failed readiness, and preserves reduced motion without waiting', async () => {
  await act(async () => { tree = create(<Probe readiness="skip" />); });
  expect(snapshot().phase).toBe('welcome');
  await act(async () => tree.unmount());
  mockReduced = true;
  await act(async () => { tree = create(<Probe readiness="pending" />); });
  expect(snapshot().phase).toBe('welcome');
});

it('does not revive an intro after Back/skip or background while visibility was pending', async () => {
  await act(async () => { tree = create(<Probe readiness="pending" />); });
  await act(async () => mockForeground('background'));
  expect(snapshot().phase).toBe('welcome');
  await act(async () => tree.update(<Probe readiness="ready" />));
  expect(snapshot().phase).toBe('welcome'); expect(mockWrite).toHaveBeenCalledTimes(1);
});
