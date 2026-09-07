import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { palette } from '../theme/tokens';
import { sesijaSada, useSesija } from '../store/sesija';
import { povratniCilj } from '../store/povratniCilj';
import { postaviUlogu } from '../store/uloga';

export default function RootLayout() {
  const { isLoaded, session, sessionEpoch, accountRevision, returnTargetRevision } = useSesija();
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const naAuth = segments[0] === 'auth';

  // Protected-route authority: unauthenticated users never remain inside the
  // marketplace shell. Auth is one screen in the same app, not a second app.
  useEffect(() => {
    if (!isLoaded) return;
    if (sesijaSada().sessionEpoch !== sessionEpoch ||
      sesijaSada().user?.id !== session?.user.id) return;
    if (!session && !naAuth) {
      router.replace(pathname === '/' ? '/auth' : { pathname: '/auth', params: { form: 'login' } });
      return;
    }
    if (session && naAuth) {
      router.replace('/');
    }
  }, [isLoaded, session, sessionEpoch, naAuth, pathname, router]);

  // Consume a completed pre-auth intent exactly once after a real session has
  // been restored/created. The store itself guards which user completed it.
  useEffect(() => {
    if (!isLoaded || !session) return;
    let aktivan = true;
    const isCurrent = () => aktivan && sesijaSada().sessionEpoch === sessionEpoch &&
      sesijaSada().user?.id === session.user.id;
    void povratniCilj.consumeCompleted(session.user.id, isCurrent).then((record) => {
      if (!isCurrent() || !record) return;
      if (record.intent.intent === 'WORKER') postaviUlogu('uskocer');
      else postaviUlogu('narucilac');

      const target = record.intent.returnTarget;
      if (!target || target.kind === 'NONE') {
        router.replace(record.intent.intent === 'WORKER' ? '/prilike' : '/nova');
        return;
      }
      if (target.kind === 'REQUESTER_DRAFT') {
        router.replace({ pathname: '/nova', params: { conversationId: target.draftKey } });
      } else if (target.kind === 'NEED') {
        router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: target.needId } });
      } else if (target.kind === 'DOGOVOR') {
        router.replace({ pathname: '/dogovor/[id]', params: { id: target.agreementId } });
      }
    }).catch(() => {});
    return () => {
      aktivan = false;
    };
  }, [isLoaded, session, sessionEpoch, returnTargetRevision, router]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.ground, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.ink} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.ground }}>
        <StatusBar style="dark" />
        <Stack
          key={`${session?.user.id ?? 'signed-out'}:${accountRevision}`}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.ground },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Protected guard={!session}>
            <Stack.Screen name="auth" />
          </Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(app)" />
            <Stack.Screen name="dogovor/[id]" />
            <Stack.Screen name="obavestenja" />
            <Stack.Screen name="prijave" />
          </Stack.Protected>
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
