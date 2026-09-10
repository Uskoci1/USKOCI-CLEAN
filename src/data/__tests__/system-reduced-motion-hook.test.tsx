import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';

const mockCurrent = jest.fn();
const mockPreferenceSubscribe = jest.fn();
const mockForegroundSubscribe = jest.fn();
let mockStartup = false;
type Subscription<T> = { callback: (value: T) => void; remove: jest.Mock };
const mockPreferences: Subscription<boolean>[] = [];
const mockForegrounds: Subscription<string>[] = [];

jest.mock('react-native-reanimated', () => ({ useReducedMotion: () => mockStartup }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AccessibilityInfo') return {
      isReduceMotionEnabled: (...args: unknown[]) => mockCurrent(...args),
      addEventListener: (...args: unknown[]) => mockPreferenceSubscribe(...args),
    };
    if (key === 'AppState') return { addEventListener: (...args: unknown[]) => mockForegroundSubscribe(...args) };
    return Reflect.get(target, key);
  } });
});

function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const rendered: boolean[] = [];
function Probe() {
  const reduced = useSystemReducedMotion();
  rendered.push(reduced);
  return React.createElement('Snapshot', { reduced });
}
let tree: ReactTestRenderer | undefined;
const snapshot = () => tree!.root.findByType('Snapshot' as React.ElementType).props.reduced as boolean;
function mount() { act(() => { tree = create(<Probe />); }); }
function unmount() { act(() => { tree?.unmount(); tree = undefined; }); }
function preference(value: boolean) { act(() => { mockPreferences.at(-1)!.callback(value); }); }
function foreground(value: string) { act(() => { mockForegrounds.at(-1)!.callback(value); }); }

beforeEach(() => {
  jest.clearAllMocks(); mockStartup = false;
  mockPreferences.length = 0; mockForegrounds.length = 0; rendered.length = 0;
  mockCurrent.mockImplementation(() => new Promise<boolean>(() => {}));
  mockPreferenceSubscribe.mockImplementation((name: string, callback: (value: boolean) => void) => {
    expect(name).toBe('reduceMotionChanged');
    const subscription = { callback, remove: jest.fn() };
    mockPreferences.push(subscription); return subscription;
  });
  mockForegroundSubscribe.mockImplementation((name: string, callback: (value: string) => void) => {
    expect(name).toBe('change');
    const subscription = { callback, remove: jest.fn() };
    mockForegrounds.push(subscription); return subscription;
  });
});
afterEach(unmount);

it.each([false, true])('renders the Reanimated startup snapshot %s while the current native query is pending', startup => {
  mockStartup = startup; mount();
  expect(rendered).toEqual([startup]); expect(snapshot()).toBe(startup);
  expect(mockCurrent).toHaveBeenCalledTimes(1);
  expect(mockPreferenceSubscribe.mock.invocationCallOrder[0]).toBeLessThan(mockCurrent.mock.invocationCallOrder[0]);
  expect(mockForegroundSubscribe.mock.invocationCallOrder[0]).toBeLessThan(mockCurrent.mock.invocationCallOrder[0]);
});

it.each([false, true])('replaces a stale cached startup value with the native current preference %s', async current => {
  const query = pending<boolean>();
  mockStartup = !current; mockCurrent.mockReturnValue(query.promise); mount();
  expect(snapshot()).toBe(!current);
  await act(async () => { query.resolve(current); }); expect(snapshot()).toBe(current);
});

it('applies runtime on/off events without waiting for a hanging startup query', () => {
  mount(); preference(true); expect(snapshot()).toBe(true);
  preference(false); expect(snapshot()).toBe(false);
  expect(mockCurrent).toHaveBeenCalledTimes(1);
  expect(mockPreferenceSubscribe).toHaveBeenCalledTimes(1);
});

it('rejects the startup query after a newer preference event, including an on/off ABA transition', async () => {
  const query = pending<boolean>(); mockCurrent.mockReturnValue(query.promise); mount();
  preference(true); preference(false);
  await act(async () => { query.resolve(true); });
  expect(snapshot()).toBe(false);
});

it('refreshes on foreground and ignores older native query completions', async () => {
  const initial = pending<boolean>(), resumed = pending<boolean>();
  mockCurrent.mockReturnValueOnce(initial.promise).mockReturnValueOnce(resumed.promise); mount();
  foreground('inactive'); foreground('background'); expect(mockCurrent).toHaveBeenCalledTimes(1);
  foreground('active'); expect(mockCurrent).toHaveBeenCalledTimes(2);
  await act(async () => { resumed.resolve(true); }); expect(snapshot()).toBe(true);
  await act(async () => { initial.resolve(false); }); expect(snapshot()).toBe(true);
});

it('lets a newer runtime event win over an in-flight foreground refresh', async () => {
  const resumed = pending<boolean>();
  mockCurrent.mockImplementationOnce(() => Promise.resolve(false)).mockReturnValueOnce(resumed.promise);
  mount(); await act(async () => {});
  foreground('active'); preference(true);
  await act(async () => { resumed.resolve(false); }); expect(snapshot()).toBe(true);
});

it('keeps the known preference after native query failure and recovers on a later foreground', async () => {
  const initial = pending<boolean>(), failed = pending<boolean>(), recovered = pending<boolean>();
  mockStartup = true;
  mockCurrent.mockReturnValueOnce(initial.promise).mockReturnValueOnce(failed.promise).mockReturnValueOnce(recovered.promise);
  mount(); await act(async () => { initial.reject(new Error('native query unavailable')); });
  expect(snapshot()).toBe(true);
  preference(false); foreground('active');
  await act(async () => { failed.reject(new Error('temporary failure')); }); expect(snapshot()).toBe(false);
  foreground('active'); await act(async () => { recovered.resolve(true); }); expect(snapshot()).toBe(true);
});

it('does not reset a current runtime preference or replace listeners on rerender', () => {
  mockStartup = true; mount(); preference(false);
  act(() => { tree!.update(<Probe />); });
  expect(snapshot()).toBe(false);
  expect(mockPreferenceSubscribe).toHaveBeenCalledTimes(1);
  expect(mockForegroundSubscribe).toHaveBeenCalledTimes(1);
  expect(mockCurrent).toHaveBeenCalledTimes(1);
});

it('removes both native subscriptions and isolates late responses and queued events from a remount', async () => {
  const oldQuery = pending<boolean>(), newQuery = pending<boolean>();
  mockCurrent.mockReturnValueOnce(oldQuery.promise).mockReturnValueOnce(newQuery.promise);
  mount(); const oldPreference = mockPreferences[0], oldForeground = mockForegrounds[0];
  unmount(); expect(oldPreference.remove).toHaveBeenCalledTimes(1); expect(oldForeground.remove).toHaveBeenCalledTimes(1);
  const rendersAtUnmount = rendered.length;
  await act(async () => { oldPreference.callback(true); oldQuery.resolve(true); });
  expect(rendered).toHaveLength(rendersAtUnmount);
  mount(); expect(snapshot()).toBe(false);
  act(() => { oldPreference.callback(true); }); expect(snapshot()).toBe(false);
  await act(async () => { newQuery.resolve(true); }); expect(snapshot()).toBe(true);
  preference(false); expect(snapshot()).toBe(false);
  expect(mockPreferences).toHaveLength(2); expect(mockForegrounds).toHaveLength(2);
  expect(mockPreferences[1].remove).not.toHaveBeenCalled();
});
