import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEntryIntro } from '../../hooks/useEntryIntro';

const mockRead = jest.fn();
const mockWrite = jest.fn();
const mockRemove = jest.fn();
let mockReduced = false;
let mockForeground: (state: string) => void;
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args: unknown[]) => mockRead(...args),
  setItem: (...args: unknown[]) => mockWrite(...args),
}));
jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'AppState' ? { addEventListener: (_: unknown, callback: typeof mockForeground) => {
      mockForeground = callback; return { remove: mockRemove };
    } } : Reflect.get(target, key);
  } });
});
function Probe() { return React.createElement('Snapshot', { snapshot: useEntryIntro() }); }
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
