'use strict';

/**
 * Reanimated under Jest.
 *
 * The real package needs its native worklets runtime, which the test environment does not have, so
 * a screen suite crashed the moment any component it reached imported reanimated — even a shared
 * one it never renders. That was answered with a hand-written mock per test file, so the same
 * object was written six slightly different ways and every new animated component broke unrelated
 * suites until each of them was found and patched.
 *
 * Jest picks this up automatically for a node_modules package, and a test that wants different
 * behaviour still overrides it with its own `jest.mock`. What it provides is exactly what the app
 * imports: nothing here pretends to animate, it only lets a render finish.
 */
const React = require('react');

const passthrough = (name) => {
  // `entering` and friends are passed through rather than dropped: whether a component asked for an
  // entrance, and under which conditions it asks for none, is behaviour worth asserting.
  const Component = React.forwardRef(({ children, ...props }, ref) =>
    React.createElement(name, { ...props, ref }, children));
  Component.displayName = `Animated.${name}`;
  return Component;
};

/** An entering/exiting animation is a builder: every method returns it again. */
const builder = () => {
  const self = {};
  for (const method of ['duration', 'delay', 'springify', 'damping', 'stiffness', 'easing',
    'withInitialValues', 'randomDelay', 'reduceMotion', 'build']) self[method] = () => self;
  return self;
};

const Animated = {
  View: passthrough('View'),
  Text: passthrough('Text'),
  ScrollView: passthrough('ScrollView'),
  Image: passthrough('Image'),
  createAnimatedComponent: (Component) => Component,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  FadeIn: builder(),
  FadeInDown: builder(),
  FadeInUp: builder(),
  FadeOut: builder(),
  FadeOutDown: builder(),
  SlideInDown: builder(),
  SlideOutDown: builder(),
  Layout: builder(),
  LinearTransition: builder(),
  Easing: { bezier: () => ({}), linear: () => ({}), out: (value) => value, inOut: (value) => value, ease: () => ({}) },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  useReducedMotion: () => false,
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: () => ({}),
  useAnimatedReaction: () => undefined,
  useAnimatedProps: () => ({}),
  useFrameCallback: () => ({ setActive: () => undefined, isActive: false }),
  useDerivedValue: (factory) => ({ value: typeof factory === 'function' ? factory() : undefined }),
  withTiming: (value) => value,
  withSpring: (value) => value,
  withDelay: (_delay, value) => value,
  withRepeat: (value) => value,
  withSequence: (...values) => values[values.length - 1],
  cancelAnimation: () => undefined,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (value) => value,
  interpolateColor: (_value, _input, output) => output[0],
};
