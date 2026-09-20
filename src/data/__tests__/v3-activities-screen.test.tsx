import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

/**
 * Moje aktivnosti, and the one thing nothing covered: that a row still opens after you have left
 * the screen and come back.
 *
 * On the owner's phone every row of this list was dead — the first one, the last one, a draft, a
 * published task. Taps work everywhere else in the app, so it was not the finger. The cause is one
 * word of difference from Početna, which does the same job with the same guards and works.
 *
 * Both screens refuse an action whose focus token is not the current one, which is how a callback
 * retained from an earlier visit is stopped from acting on a newer account. Početna publishes that
 * token with `setScope(owner)` — state, so focusing re-renders and the guard sees the new token.
 * Moje aktivnosti read it out of the ref during render instead. A ref written inside an effect does
 * not re-render anything, so after the second focus the rendered `scope` was the token of the first
 * visit, the guard compared it against a newer one, and every press returned silently for the rest
 * of the screen's life.
 */
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let mockSession = { user: { id: A }, accountRevision: 1 };
let mockFocused = true;
const mockSource = { mojePotrebe: jest.fn(), mojePrijave: jest.fn(), mojiDogovori: jest.fn() };
const mockRouter = { navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('../../store/uloga', () => ({ useIzvor: () => mockSource, izvorSada: () => mockSource }));
jest.mock('expo-router', () => ({ get router() { return mockRouter; },
  useFocusEffect: (effect: () => void) => require('react').useEffect(() => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => { const native = jest.requireActual('react-native'); return new Proxy(native, { get(target, key) {
  if (key === 'AppState') return { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) };
  return ['View', 'ScrollView', 'RefreshControl'].includes(String(key)) ? key : Reflect.get(target, key);
} }); });
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_target, key) => key === '__esModule' ? false : String(key) }));
jest.mock('../../ui/Text', () => ({ T: 'T' }));
jest.mock('../../ui/Press', () => ({ Press: 'Press' }));
jest.mock('../../ui/v2/V2Action', () => ({ V2Action: 'Action' }));
import MojeAktivnosti from '../../app/(app)/moje-aktivnosti';

let tree: ReactTestRenderer;
const need = (id: string, patch: object = {}) => ({ id, revizija: 1, naslov: `Moj ${id}`, stanje: 'OBJAVLJENA', vremeTekst: 'sutra',
  pokrivenost: { ukupno: 1, popunjeno: 0, preostalo: 1, udeo: 0 }, brojPrijava: 0, ...patch });
const row = (start: string) => tree.root.findAll(node => String(node.type) === 'Press'
  && String(node.props.accessibilityLabel).startsWith(start))[0].props;
const render = async () => { await act(async () => { tree = create(<MojeAktivnosti />); }); };
/** Leaving the screen and coming back, which is what the app does every time you press Back. */
const refocus = async () => {
  await act(async () => { mockFocused = false; tree.update(<MojeAktivnosti />); });
  await act(async () => { mockFocused = true; tree.update(<MojeAktivnosti />); });
};

beforeEach(() => {
  jest.clearAllMocks(); mockSession = { user: { id: A }, accountRevision: 1 }; mockFocused = true;
  mockSource.mojePotrebe.mockResolvedValue([need('orman')]);
  mockSource.mojePrijave.mockResolvedValue([]); mockSource.mojiDogovori.mockResolvedValue([]);
});
afterEach(async () => { await act(async () => tree?.unmount()); });

it('opens a row on the first visit', async () => {
  await render();
  await act(async () => row('Moj orman').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'orman' } });
});

it('still opens a row after leaving the screen and coming back', async () => {
  await render();
  await refocus();
  await act(async () => row('Moj orman').onPress());
  expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: '/potrebe/[id]/pregled', params: { id: 'orman' } });
});

it('refuses a press while the screen is not focused, which is what the guard is for', async () => {
  await render();
  await act(async () => { mockFocused = false; tree.update(<MojeAktivnosti />); });
  await act(async () => row('Moj orman').onPress());
  expect(mockRouter.navigate).not.toHaveBeenCalled();
});

it('refuses a second press of the same row, so one tap cannot open two screens', async () => {
  await render();
  await act(async () => { row('Moj orman').onPress(); row('Moj orman').onPress(); });
  expect(mockRouter.navigate).toHaveBeenCalledTimes(1);
});

it('no screen compares its focus guard against a token it read while rendering', () => {
  // The four tests above pass whether the screen is fixed or broken, and that is the point worth
  // recording: this harness mocks useFocusEffect as a useEffect, so focus can only change when the
  // component re-renders, and a re-render is exactly what hides the defect. On a phone a screen is
  // focused again without rendering again, and that is the case nothing here can stage.
  //
  // So the property is checked where it lives. A screen that holds a focus token for its guard must
  // publish it with setScope, not read focus.current in its body: a ref written in an effect
  // re-renders nothing, so the rendered value stays the token of the previous visit.
  const routes = readdirSync(join(__dirname, '..', '..', 'app', '(app)'), { withFileTypes: true, recursive: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.tsx'))
    .map(entry => join(entry.parentPath, entry.name));
  // Two spaces of indentation is the component body, where the value is captured once per render.
  // Deeper than that is inside a callback, where reading focus.current at call time is correct and
  // is what several screens rightly do.
  const offenders = routes
    .filter(file => /^ {2}const [^\n]*scope = focus[.]current/m.test(readFileSync(file, 'utf8')))
    .map(file => file.split(/[\\/]/).slice(-2).join('/'));
  expect(offenders).toEqual([]);
});
