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
  // Native linking resolves asynchronously. An empty route is not a request
  // for the welcome screen; do not overwrite its incoming Auth/recovery link.
  // Stack.Protected continues to enforce access while the route resolves.
  const routeResolved = segments.length > 0;
  const naAuth = segments[0] === 'auth';
  const naOporavku = segments[0] === 'oporavak';

  // Protected-route authority: unauthenticated users never remain inside the
  // marketplace shell. Auth is one screen in the same app, not a second app.
  useEffect(() => {
    if (!isLoaded || !routeResolved) return;
    if (sesijaSada().sessionEpoch !== sessionEpoch ||
      sesijaSada().user?.id !== session?.user.id) return;
    if (!session && !naAuth && !naOporavku) {
      router.replace(pathname === '/' ? '/auth' : { pathname: '/auth', params: { form: 'login' } });
      return;
    }
    if (session && naAuth) {
      router.replace('/');
    }
  }, [isLoaded, routeResolved, session, sessionEpoch, naAuth, naOporavku, pathname, router]);

  // Consume a completed pre-auth intent exactly once after a real session has
  // been restored/created. The store itself guards which user completed it.
  useEffect(() => {
    if (!isLoaded || !routeResolved || !session || naOporavku) return;
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
  }, [isLoaded, routeResolved, session, sessionEpoch, returnTargetRevision, naOporavku, router]);

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
          <Stack.Screen name="oporavak" options={{ animation: 'none' }} />
          <Stack.Protected guard={!session}>
            <Stack.Screen name="auth" options={{ animation: 'none' }} />
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
