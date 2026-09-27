import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
let mockSession = { user: { id: 'worker' }, accountRevision: 1 };
let mockFocused = true;
let mockState = 'active';
let mockListener: (state: string) => void;
const mockOpen = jest.fn();
jest.mock('../../../store/sesija', () => ({ useSesija: () => mockSession, sesijaSada: () => mockSession }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => require('react').useEffect(
  () => mockFocused ? effect() : undefined, [effect, mockFocused]) }));
jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  return new Proxy(rn, { get(target, key) {
    if (key === 'AppState') return { currentState: mockState, addEventListener: (_: string, fn: typeof mockListener) => { mockListener = fn; return { remove: jest.fn() }; } };
    if (key === 'Linking') return { openURL: (...args: unknown[]) => mockOpen(...args) };
    if (key === 'Modal' || key === 'ScrollView') return key;
    if (key === 'useWindowDimensions') return () => ({ width: 390, height: 800 });
    return Reflect.get(target, key);
  } });
});
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../../Text', () => ({ T: 'T' }));
jest.mock('../../Press', () => ({ Press: 'Press' }));
jest.mock('../../product/ProductDetails', () => ({ ProductHeader: 'ProductHeader' }));
jest.mock('../../system/motion', () => ({ useReducedMotion: () => true }));
jest.mock('../../v2/V2Action', () => ({ V2Action: 'Action' }));
jest.mock('../LocationOverviewMap', () => ({ LocationOverviewMap: 'Canvas' }));
import { LocationMapPreview } from '../LocationMapPreview';
const points = [{ id: 'start', label: 'Početno mesto', latitude: 45.271234, longitude: 19.831234 },
  { id: 'end', label: 'Završno mesto', latitude: 46, longitude: 20 }];
let tree: ReactTestRenderer;
let scopeKey = 'grant1';
const render = async (coarse = false) => { await act(async () => { tree = create(<LocationMapPreview points={points} scopeKey={scopeKey} coarse={coarse} route />); }); };
const update = async () => { await act(async () => { tree.update(<LocationMapPreview points={points} scopeKey={scopeKey} route />); }); };
const press = async (props: object) => { await act(async () => { tree.root.findByProps(props).props.onPress(); }); };
beforeEach(() => { jest.clearAllMocks(); mockOpen.mockResolvedValue(undefined); mockFocused = true; mockState = 'active';
  mockSession = { user: { id: 'worker' }, accountRevision: 1 }; scopeKey = 'grant1'; });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });
describe('task map expansion and explicit navigation', () => {
  it('opens the same points, selects a stop, returns without a route push or provider request', async () => {
    await render(); expect(mockOpen).not.toHaveBeenCalled();
    await press({ accessibilityLabel: 'Otvori mapu' });
    expect(tree.root.findByType('Canvas' as React.ElementType).props).toMatchObject({ points, interactive: true });
    await press({ accessibilityLabel: 'Prikaži na mapi: Završno mesto' });
    expect(tree.root.findByType('Canvas' as React.ElementType).props.selectedId).toBe('end');
    await press({ label: 'Navigacija: Završno mesto' });
    expect(mockOpen).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=46%2C20&dir_action=navigate');
    await act(async () => tree.root.findByType('Modal' as React.ElementType).props.onRequestClose());
    expect(tree.root.findByType('Canvas' as React.ElementType).props.interactive).toBe(false);
  });
  it('offers approximate search only for a public point, never exact-route action', async () => {
    await render(true); await press({ accessibilityLabel: 'Otvori mapu' });
    expect(tree.root.findAllByProps({ label: 'Cela putanja u Google mapama' })).toHaveLength(0);
    await press({ label: 'Otvori područje u Google mapama' });
    expect(mockOpen.mock.calls[0][0]).toContain('query=45.27%2C19.83');
  });
  it('retires navigation, stop selection and close callbacks between modal visits', async () => {
    await render(); await press({ accessibilityLabel: 'Otvori mapu' });
    const oldNavigate = tree.root.findByProps({ label: 'Navigacija: Početno mesto' }).props.onPress;
    const oldChoose = tree.root.findByProps({ accessibilityLabel: 'Prikaži na mapi: Završno mesto' }).props.onPress;
    const oldClose = tree.root.findByType('Modal' as React.ElementType).props.onRequestClose;
    await act(async () => { oldClose(); oldNavigate(); }); expect(mockOpen).not.toHaveBeenCalled();
    await press({ accessibilityLabel: 'Otvori mapu' });
    await act(async () => { oldNavigate(); oldChoose(); oldClose(); });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(1);
    expect(tree.root.findByType('Canvas' as React.ElementType).props.selectedId).toBeUndefined();
  });
  it.each(['account', 'scope', 'blur', 'background'] as const)('retires modal and retained navigation on %s', async change => {
    await render(); await press({ accessibilityLabel: 'Otvori mapu' });
    const old = tree.root.findByProps({ label: 'Navigacija: Početno mesto' }).props.onPress;
    if (change === 'account') mockSession = { ...mockSession, accountRevision: 2 };
    if (change === 'scope') scopeKey = 'grant2';
    if (change === 'blur') mockFocused = false;
    if (change === 'background') await act(async () => { mockState = 'background'; mockListener('background'); old(); });
    await update(); await act(async () => old());
    expect(mockOpen).not.toHaveBeenCalled(); expect(tree.root.findAllByType('Modal' as React.ElementType)).toHaveLength(0);
  });
  it('shows a retry after bridge rejection and suppresses duplicate launch while unresolved', async () => {
    await render(); await press({ accessibilityLabel: 'Otvori mapu' });
    let reject!: (error: Error) => void;
    mockOpen.mockImplementationOnce(() => new Promise<void>((_, no) => { reject = no; }));
    const action = tree.root.findByProps({ label: 'Navigacija: Početno mesto' }).props.onPress;
    await act(async () => { action(); action(); }); expect(mockOpen).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error('unavailable')));
    expect(tree.root.findByProps({ label: 'Navigacija: Početno mesto' }).props.error).toContain('Pokušaj ponovo');
    await press({ label: 'Navigacija: Početno mesto' }); expect(mockOpen).toHaveBeenCalledTimes(2);
  });
});
