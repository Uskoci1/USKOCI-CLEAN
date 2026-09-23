import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { Press } from '../Press';
import { useReducedMotionRoot } from '../system/motion';
import { sys } from '../system/tokens';

/**
 * Press is every tap in the app. Under reduced motion the surface must not scale at all — the press still happens,
 * only the movement goes — and it must follow the setting while the app is open, because it reads the one store
 * (ui/system/motion) that the root keeps current, not a value frozen at launch.
 */

const mockSet = jest.fn();
const mockTiming = jest.fn((value: number, _config?: unknown) => ({ timing: value }));
const mockSpring = jest.fn((value: number, _config?: unknown) => ({ spring: value }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useSharedValue: () => ({ get: () => 1, set: (value: unknown) => mockSet(value) }),
  useAnimatedStyle: () => ({}),
  withTiming: (value: number, config?: unknown) => mockTiming(value, config),
  withSpring: (value: number, config?: unknown) => mockSpring(value, config),
  Easing: { bezier: () => 'ease-out' },
  ReduceMotion: { System: 'system' },
}));

let mockPreference: ((value: boolean) => void) | undefined;
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'AccessibilityInfo') return {
      isReduceMotionEnabled: () => new Promise<boolean>(() => {}),
      addEventListener: (_name: string, callback: (value: boolean) => void) => { mockPreference = callback; return { remove: () => { mockPreference = undefined; } }; },
    };
    if (key === 'AppState') return { addEventListener: () => ({ remove: () => undefined }) };
    return Reflect.get(target, key);
  } });
});

function Root({ children }: { children: React.ReactNode }) {
  useReducedMotionRoot(false);
  return <>{children}</>;
}

const onPressIn = jest.fn(), onPressOut = jest.fn();
let tree: ReactTestRenderer | undefined;
function render() {
  act(() => {
    tree = create(<Root><Press accessibilityRole="button" accessibilityLabel="Nastavi" scaleTo={0.9}
      onPressIn={onPressIn} onPressOut={onPressOut} /></Root>);
  });
}
/** The pressable surface Press draws (Reanimated's wrapper is the plain Pressable here), not the Press element itself. */
const surface = (): ReactTestInstance => tree!.root.findAll(node => node.props.accessibilityLabel === 'Nastavi'
  && typeof node.props.onPressIn === 'function' && node.props.onPressIn !== onPressIn)[0];
function reduceMotion(value: boolean) { act(() => { mockPreference!(value); }); }
function press() {
  act(() => { surface().props.onPressIn({}); });
  act(() => { surface().props.onPressOut({}); });
}

beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { act(() => { tree?.unmount(); tree = undefined; }); });

it('does not scale under reduced motion; the press itself still happens', () => {
  render(); reduceMotion(true);
  press();
  expect(mockTiming).not.toHaveBeenCalled();
  expect(mockSpring).not.toHaveBeenCalled();
  // The only write puts the surface back at rest, instantly.
  expect(mockSet.mock.calls).toEqual([[1]]);
  expect(onPressIn).toHaveBeenCalledTimes(1);
  expect(onPressOut).toHaveBeenCalledTimes(1);
});

it('scales on the press duration and springs back when motion is allowed', () => {
  render();
  press();
  expect(mockTiming).toHaveBeenCalledWith(0.9, expect.objectContaining({ duration: sys.motion.press }));
  expect(mockSpring).toHaveBeenCalledWith(1, expect.objectContaining(sys.motion.spring));
  expect(mockSet.mock.calls).toEqual([[{ timing: 0.9 }], [{ spring: 1 }]]);
});

it('follows the setting while the app is open: turning motion off stops the next press from scaling', () => {
  render();
  press(); expect(mockTiming).toHaveBeenCalledTimes(1);
  reduceMotion(true); jest.clearAllMocks();
  press(); expect(mockTiming).not.toHaveBeenCalled(); expect(mockSet.mock.calls).toEqual([[1]]);
  reduceMotion(false); jest.clearAllMocks();
  press(); expect(mockTiming).toHaveBeenCalledTimes(1);
});
