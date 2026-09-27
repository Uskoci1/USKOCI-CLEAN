import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

let mockReduced = false, mockAppState = 'active';
const mockListeners = new Set<(state: string) => void>();
jest.mock('../system/motion', () => ({ useReducedMotion: () => mockReduced }));
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  return new Proxy(rn, { get(target, key) {
    if (key === 'AppState') return {
      get currentState() { return mockAppState; },
      addEventListener: (_: string, listener: (state: string) => void) => {
        mockListeners.add(listener); return { remove: () => mockListeners.delete(listener) };
      },
    };
    return ['View', 'Image'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('lottie-react-native', () => ({ __esModule: true, default: 'LottieView' }));
import { CatalogArt } from '../system/CatalogArt';
import { CatalogMoment } from '../system/CatalogMoment';

let tree: ReactTestRenderer;
type Props = React.ComponentProps<typeof CatalogMoment>;
let props: Props;
const animations = () => tree.root.findAllByType('LottieView' as React.ElementType);
const image = () => tree.root.findByType('Image' as React.ElementType);
const mount = async (patch: Partial<Props> = {}) => {
  props = { focused: true, ...patch };
  await act(async () => { tree = create(<CatalogMoment {...props} />); });
};
const update = async (patch: Partial<Props> = {}) => {
  props = { ...props, ...patch };
  await act(async () => tree.update(<CatalogMoment {...props} />));
};
const appState = async (state: string) => {
  mockAppState = state;
  await act(async () => mockListeners.forEach(listener => listener(state)));
};
beforeEach(() => { mockReduced = false; mockAppState = 'active'; });
afterEach(async () => { await act(async () => tree?.unmount()); expect(mockListeners.size).toBe(0); });

it('rests on the exact matching PNG and is decorative at 32 dp', async () => {
  await mount();
  expect(animations()).toHaveLength(0);
  expect(image().props.source).toEqual(require('../../../assets/catalog27/support.png'));
  expect(StyleSheet.flatten(image().props.style)).toMatchObject({ width: 32, height: 32 });
  expect(tree.root.findAllByProps({ importantForAccessibility: 'no-hide-descendants' }).length).toBeGreaterThan(0);
  expect(image().props.accessible).toBe(false);
});

it('plays one explicit event without a loop and returns to the PNG after finishing', async () => {
  await mount({ event: 1 });
  expect(animations()[0].props).toMatchObject({ autoPlay: true, loop: false });
  expect(animations()[0].props.progress).toBeUndefined();
  await act(async () => animations()[0].props.onAnimationFinish(false));
  expect(animations()).toHaveLength(0);
  expect(image().props.source).toEqual(require('../../../assets/catalog27/support.png'));
  await update();
  expect(animations()).toHaveLength(0);
});

it('a stale native finish cannot retire a newer explicit event', async () => {
  await mount({ event: 1 });
  const oldFinish = animations()[0].props.onAnimationFinish;
  await update({ event: 2 });
  await act(async () => oldFinish(true));
  expect(animations()).toHaveLength(1);
  await act(async () => animations()[0].props.onAnimationFinish(false));
  expect(animations()).toHaveLength(0);
});

it('blur stops playback and events while hidden never replay on refocus', async () => {
  await mount({ event: 1 });
  await update({ focused: false });
  expect(animations()).toHaveLength(0);
  await update({ event: 2 });
  await update({ focused: true });
  expect(animations()).toHaveLength(0);
  await update({ event: 3 });
  expect(animations()).toHaveLength(1);
});

it.each(['inactive', 'background'])('%s stops playback and foreground never replays it', async state => {
  await mount({ event: 1 });
  await appState(state);
  expect(animations()).toHaveLength(0);
  await update({ event: 2 });
  await appState('active');
  expect(animations()).toHaveLength(0);
  await update({ event: 3 });
  expect(animations()).toHaveLength(1);
});

it('a background mount consumes the event without playing after foreground', async () => {
  mockAppState = 'background';
  await mount({ event: 1 });
  await appState('active');
  expect(animations()).toHaveLength(0);
});

it('reduced motion shows the matching PNG, consumes events, and cancels current playback', async () => {
  mockReduced = true;
  await mount({ event: 1 });
  expect(animations()).toHaveLength(0);
  expect(image().props.source).toEqual(require('../../../assets/catalog27/support.png'));
  mockReduced = false; await update();
  expect(animations()).toHaveLength(0);
  await update({ event: 2 });
  expect(animations()).toHaveLength(1);
  mockReduced = true; await update();
  expect(animations()).toHaveLength(0);
  mockReduced = false; await update();
  expect(animations()).toHaveLength(0);
});

it('disabled decoration stays muted and does not queue animation', async () => {
  await mount({ event: 1, muted: true });
  expect(animations()).toHaveLength(0);
  expect(StyleSheet.flatten(image().props.style).tintColor).toBeTruthy();
  await update({ muted: false });
  expect(animations()).toHaveLength(0);
});

it('a player failure returns to the matching still', async () => {
  await mount({ event: 1 });
  await act(async () => animations()[0].props.onAnimationFailure('unsupported layer'));
  expect(animations()).toHaveLength(0);
  expect(tree.root.findByType(CatalogArt).props.kind).toBe('support');
});
