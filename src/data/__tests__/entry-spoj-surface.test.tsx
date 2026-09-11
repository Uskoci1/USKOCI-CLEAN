import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet } from 'react-native';

let mockPhase: 'loading' | 'intro' | 'welcome' = 'welcome';
let mockReduced = false;
let mockFrameTime: number | null = null;
jest.mock('../../hooks/useSystemReducedMotion', () => ({ useSystemReducedMotion: () => mockReduced }));
jest.mock('../../ui/entry/spojBrandMath', () => {
  const actual = jest.requireActual('../../ui/entry/spojBrandMath');
  return { ...actual, brandFrame: (time: number, ...args: unknown[]) => actual.brandFrame(mockFrameTime ?? time, ...args) };
});
let mockAccount = { accountRevision: 0, user: null as null | { id: string } };
let mockFontScale = 1;
const mockFinish = jest.fn();
const mockForeground = new Set<(state: string) => void>();
const mockTiming = jest.fn((value: number) => value);
const mockCancel = jest.fn();
const mockReadyLayout = jest.fn();
const mockSceneReady = jest.fn();
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 844, fontScale: mockFontScale });
    if (key === 'AppState') return { addEventListener: (_: string, callback: (state: string) => void) => { mockForeground.add(callback); return { remove: () => mockForeground.delete(callback) }; } };
    return ['View', 'ScrollView', 'Pressable', 'Text'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 33, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => ({ __esModule: true,
  default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
  useReducedMotion: () => mockReduced,
  Easing: { linear: (t: number) => t, bezierFn: () => (t: number) => t },
  useAnimatedProps: () => ({}), useAnimatedStyle: (read: () => unknown) => read(),
  useFrameCallback: () => {
    const React = jest.requireActual('react');
    return React.useRef({ setActive: jest.fn() }).current;
  },
  useSharedValue: (value: number) => {
    const React = jest.requireActual('react');
    return React.useRef({ get: () => value, set: jest.fn() }).current;
  },
  withTiming: (...args: Parameters<typeof mockTiming>) => mockTiming(...args), cancelAnimation: (...args: unknown[]) => mockCancel(...args),
}));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: () => void) => fn() }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', SvgXml: 'SvgXml', G: 'G', Path: 'Path', Rect: 'Rect', Defs: 'Defs', ClipPath: 'ClipPath' }));
jest.mock('phosphor-react-native', () => ({ ArrowRight: 'Icon', ArrowLeft: 'Icon' }));
jest.mock('../../hooks/useEntryIntro', () => ({ useEntryIntro: () => ({ phase: mockPhase, prepared: mockPhase !== 'loading', finish: mockFinish }) }));
jest.mock('../../hooks/useEntrySplashReady', () => ({ useEntrySplashReady: () => ({ readiness: 'ready', onLayout: mockReadyLayout, onSceneReady: mockSceneReady }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount, useSesija: () => mockAccount }));
jest.mock('../../ui/Press', () => ({ Press: 'Pressable' }));
import { EntryWelcome } from '../../ui/entry/EntryWelcome';

let tree: ReactTestRenderer;
const requester = jest.fn(), worker = jest.fn(), signIn = jest.fn();
const element = (busy = false) => <EntryWelcome onRequester={requester} onWorker={worker} onSignIn={signIn} busy={busy} />;
const button = (label: string) => tree.root.findAll(node => String(node.type) === 'Pressable' && node.props.accessibilityLabel === label)[0];
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const render = async () => { await act(async () => { tree = create(element()); }); };
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockForeground.clear(); mockFrameTime = null; mockPhase = 'welcome'; mockReduced = false; mockFontScale = 1; mockAccount = { accountRevision: 0, user: null }; requester.mockResolvedValue(undefined); worker.mockResolvedValue(undefined); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });

it('shows the vector lockup and two real intent controls without dispatching on mount', async () => {
  await render();
  expect(button('Meni treba').props.disabled).toBe(false);
  expect(button('Ja mogu').props.disabled).toBe(false);
  expect(tree.root.findAll(node => node.props.accessibilityLabel === 'USKOČI').length).toBeGreaterThan(0);
  expect(requester).not.toHaveBeenCalled(); expect(worker).not.toHaveBeenCalled();
  await press('Prijavi se'); expect(signIn).toHaveBeenCalledTimes(1);
});
it.each([[0, 0], [3500, 0], [3590, 0], [3895, .039375], [4200, .045], [4380, .045]])('keeps the panel boundary synchronized with original rIntroFrame at %i ms', async (time, alpha) => {
  mockFrameTime = time; await render();
  const style = StyleSheet.flatten(tree.root.findByProps({ testID: 'entry-brand-panel' }).props.style);
  expect(style.backgroundColor).toBe('#FFFFFF');
  expect(style.boxShadow[0]).toMatchObject({ offsetX: 0, offsetY: 16, blurRadius: 36 });
  expect(Number(style.boxShadow[0].color.match(/,([^,]+)\)$/)[1])).toBeCloseTo(alpha, 10);
});
it.each(['Meni treba', 'Ja mogu'])('visually removes both lower text groups during %s sweep, keeping the white lockup', async label => {
  mockFrameTime = 4380; await render();
  const groups = () => tree.root.findAll(node => String(node.type) === 'AnimatedView' && node.props.importantForAccessibility);
  expect(groups().map(node => StyleSheet.flatten(node.props.style).opacity)).toEqual([1, 1]);
  await press(label);
  expect(groups().map(node => StyleSheet.flatten(node.props.style).opacity)).toEqual([0, 0]);
  expect(tree.root.findByProps({ testID: 'entry-brand-panel' })).toBeTruthy();
});
it.each([['Meni treba', requester], ['Ja mogu', worker]] as const)('hides both choices immediately and delivers %s exactly once after 760ms', async (label, callback) => {
  await render(); const oldPress = button(label).props.onPress;
  await act(async () => { oldPress(); oldPress(); });
  for (const name of ['Meni treba', 'Ja mogu', 'Prijavi se']) expect(button(name).props.disabled).toBe(true);
  const groups = tree.root.findAll(node => String(node.type) === 'AnimatedView' && node.props.importantForAccessibility === 'no-hide-descendants');
  expect(groups).toHaveLength(2);
  groups.forEach(group => { expect(StyleSheet.flatten(group.props.style).opacity).toBe(0); expect(group.props.pointerEvents).toBe('none'); });
  expect(tree.root.findByProps({ testID: 'entry-brand-panel' })).toBeDefined();
  await advance(759); expect(callback).not.toHaveBeenCalled();
  await advance(1); expect(callback).toHaveBeenCalledTimes(1);
});
it('keeps the selected state while the real owned callback is pending', async () => {
  let finish!: () => void; requester.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  await render(); await press('Meni treba'); await advance(760);
  expect(button('Meni treba').props.disabled).toBe(true);
  await act(async () => finish()); expect(button('Meni treba').props.disabled).toBe(false);
});
it.each(['background', 'inactive'])('cancels a pending choice on %s', async state => {
  await render(); await press('Meni treba');
  await act(async () => mockForeground.forEach(callback => callback(state)));
  await advance(1000); expect(requester).not.toHaveBeenCalled(); expect(button('Meni treba').props.disabled).toBe(false);
});
it('cancels on explicit cancellation and allows a fresh opposite choice', async () => {
  await render(); await press('Meni treba'); await press('Otkaži izbor'); await advance(1000);
  expect(requester).not.toHaveBeenCalled(); await press('Ja mogu'); await advance(760); expect(worker).toHaveBeenCalledTimes(1);
});
it('rejects A→B→A before callback even when React has not rerendered yet', async () => {
  await render(); await press('Meni treba'); mockAccount = { accountRevision: 2, user: null };
  await advance(760); expect(requester).not.toHaveBeenCalled();
  await act(async () => tree.update(element())); expect(button('Meni treba').props.disabled).toBe(false);
});
it('does not deliver after unmount', async () => {
  await render(); await press('Meni treba'); await act(async () => tree.unmount()); await advance(1000);
  expect(requester).not.toHaveBeenCalled(); expect(mockForeground.size).toBe(0);
});
it('reduces selection motion to an immediate real callback', async () => {
  mockReduced = true; await render(); await press('Ja mogu');
  expect(worker).toHaveBeenCalledTimes(1); expect(mockTiming).not.toHaveBeenCalled();
});
it('cancels an in-progress sweep when the system preference changes and accepts an immediate fresh choice', async () => {
  await render(); await press('Meni treba');
  mockReduced = true; await act(async () => tree.update(element()));
  await advance(1000); expect(requester).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'entry-intent-fill' })).toHaveLength(0);
  await press('Ja mogu'); expect(worker).toHaveBeenCalledTimes(1);
});
it('retains all controls with a vertical large-text composition', async () => {
  mockFontScale = 2; await render();
  const choices = tree.root.findAll(node => String(node.type) === 'AnimatedView' && node.props.importantForAccessibility === 'auto')[0];
  expect(StyleSheet.flatten(choices.props.style).flexDirection).toBe('column');
  expect(button('Ja mogu').props.disabled).toBe(false);
  expect(tree.root.findByType('ScrollView' as React.ElementType).props.scrollEnabled).toBe(true);
});
it('waits for measured geometry before starting the intro and keeps actions unavailable', async () => {
  mockPhase = 'intro'; await render(); expect(mockTiming).not.toHaveBeenCalled();
  expect(mockSceneReady).not.toHaveBeenCalled();
  expect(button('Meni treba').props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ testID: 'entry-brand-panel' }).props.onLayout({ nativeEvent: { layout: { x: 24, y: 158.765625, width: 342, height: 227.328125 } } }));
  // Layout alone cannot release the cover: the source t=0 artwork is empty.
  // The real clock's UI-frame acknowledgement is covered in its focused suite.
  expect(mockSceneReady).not.toHaveBeenCalled();
  expect(mockTiming).toHaveBeenCalledWith(4380, expect.objectContaining({ duration: 4380 }), expect.any(Function));
  await press('Preskoči uvod'); expect(mockFinish).toHaveBeenCalledTimes(1);
});
