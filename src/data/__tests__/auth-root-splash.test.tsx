import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mockOnLayout = jest.fn();
const mockReadiness = jest.fn();
const mockReplace = jest.fn();
let mockSegments: string[] = ['auth'];
let mockPath = '/auth';
let mockState = { isLoaded: true, session: null as null | { user: { id: string } },
  sessionEpoch: 1, accountRevision: 0, returnTargetRevision: 0 };
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return ['View', 'ActivityIndicator'].includes(String(key)) ? key : Reflect.get(target, key);
  } });
});
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureRoot' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaProvider: 'SafeAreaProvider' }));
jest.mock('expo-status-bar', () => ({ StatusBar: 'StatusBar' }));
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments, usePathname: () => mockPath, useRouter: () => ({ replace: mockReplace }),
  Stack: Object.assign(({ children }: { children: React.ReactNode }) => children, { Protected: ({ children }: { children: React.ReactNode }) => children, Screen: () => null }),
}));
jest.mock('../../hooks/useEntrySplashReady', () => ({ useEntrySplashReady: (options: unknown) => {
  mockReadiness(options); return { onLayout: mockOnLayout };
} }));
jest.mock('../../store/sesija', () => ({ useSesija: () => mockState,
  sesijaSada: () => ({ ...mockState, user: mockState.session?.user }) }));
jest.mock('../../store/povratniCilj', () => ({ povratniCilj: { consumeCompleted: () => Promise.resolve(null) } }));
jest.mock('../../store/uloga', () => ({ postaviUlogu: jest.fn() }));
jest.mock('../../ui/entry/BrandAssets', () => ({ BrandMark: 'BrandMark' }));
import RootLayout from '../../app/_layout';

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks(); mockSegments = ['auth']; mockPath = '/auth';
  mockState = { isLoaded: true, session: null, sessionEpoch: 1, accountRevision: 0, returnTargetRevision: 0 };
});
afterEach(async () => { await act(async () => tree?.unmount()); });
async function render() { await act(async () => { tree = create(<RootLayout />); }); }

it('retains the real branded restoration loader without releasing the cover early', async () => {
  mockState.isLoaded = false; await render();
  expect(tree.root.findAllByType('BrandMark' as React.ElementType)).toHaveLength(1);
  expect(mockReadiness).toHaveBeenLastCalledWith({ enabled: false });
  expect(mockReplace).not.toHaveBeenCalled();
});

it.each([{ segments: [] }, { segments: ['auth'] }, { segments: ['(app)'] }])('does not reveal unresolved, Entry or redirecting signed-out routes: $segments', async ({ segments }) => {
  mockSegments = segments; mockPath = '/'; await render();
  expect(mockReadiness).toHaveBeenLastCalledWith({ enabled: false });
  expect(mockOnLayout).not.toHaveBeenCalled();
});

it.each([false, true])('releases a laid-out recovery destination independently of session presence: %s', async signedIn => {
  mockSegments = ['oporavak']; mockPath = '/oporavak';
  if (signedIn) mockState.session = { user: { id: 'current-account' } };
  await render(); expect(mockReadiness).toHaveBeenLastCalledWith({ enabled: true });
  await act(async () => tree.root.findByType('GestureRoot' as React.ElementType).props.onLayout({ nativeEvent: { layout: { width: 390, height: 844 } } }));
  expect(mockOnLayout).toHaveBeenCalledTimes(1); expect(mockReplace).not.toHaveBeenCalled();
});

it('releases the restored signed-in destination without an Auth redirect', async () => {
  mockSegments = ['(app)']; mockPath = '/'; mockState.session = { user: { id: 'current-account' } };
  await render(); expect(mockReadiness).toHaveBeenLastCalledWith({ enabled: true });
  expect(mockReplace).not.toHaveBeenCalled();
});

it('keeps signed-in Auth redirect covered until the real destination is resolved', async () => {
  mockState.session = { user: { id: 'current-account' } }; await render();
  expect(mockReadiness).toHaveBeenLastCalledWith({ enabled: false });
  expect(mockReplace).toHaveBeenCalledWith('/');
});
