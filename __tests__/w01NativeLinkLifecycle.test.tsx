/** Installed Expo Router with an asynchronous Android URL; no mocked router/Stack. */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, Linking } from 'react-native';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { inMemoryContext } from 'expo-router/build/testing-library/context-stubs';
import { useLocalSearchParams, useSegments, usePathname, Stack } from 'expo-router';
import RootLayout from '../src/app/_layout';

const mockCurrent = { isLoaded: true, session: null, user: null, sessionEpoch: 1,
  accountRevision: 0, returnTargetRevision: 0 };
jest.mock('../src/store/sesija', () => ({ useSesija: () => mockCurrent, sesijaSada: () => mockCurrent }));
jest.mock('../src/store/povratniCilj', () => ({ povratniCilj: { consumeCompleted: jest.fn() } }));
jest.mock('../src/store/uloga', () => ({ postaviUlogu: jest.fn() }));
jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'GestureHandlerRootView' }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native', () => {
  const native = jest.requireActual('react-native');
  return new Proxy(native, { get(target, key) {
    return key === 'Platform' ? { ...native.Platform, OS: 'android' } : Reflect.get(target, key);
  } });
});

const frames: { params: Record<string, unknown>; segments: string[]; pathname: string }[] = [];
function AuthProbe() {
  const params = useLocalSearchParams();
  const segments = useSegments();
  const pathname = usePathname();
  frames.push({ params, segments, pathname });
  return <Text>{String(params.form ?? 'intro')}</Text>;
}
function PrivateProbe() { return <Text>private</Text>; }
function RecoveryProbe() { return <Text>recovery</Text>; }
function Group() { return <Stack />; }
const context = inMemoryContext({
  _layout: RootLayout, auth: AuthProbe, oporavak: RecoveryProbe,
  '(app)/_layout': Group, '(app)/index': PrivateProbe,
  'dogovor/[id]': PrivateProbe, obavestenja: PrivateProbe, prijave: PrivateProbe,
});

it('keeps the cold Android Auth query after the installed router completes initial navigation', async () => {
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('uskociapp://auth?form=login');
  let tree: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      tree = create(<ExpoRoot context={context} />);
      await new Promise(done => setTimeout(done, 300));
    });
    // Before the fix the real router first rendered form=login, then our root
    // effect replaced it with /auth and dropped the query. Testing only a
    // mocked Stack or an initially available web URL misses that transition.
    expect(frames.at(-1)).toMatchObject({ params: { form: 'login' }, pathname: '/auth' });
    expect(frames.every(frame => frame.params.form === 'login')).toBe(true);
  } finally {
    await act(async () => tree?.unmount());
    jest.restoreAllMocks();
  }
});
