import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { palette } from '../theme/tokens';
import { useSesija } from '../store/sesija';
import { povratniCilj } from '../store/povratniCilj';
import { postaviUlogu } from '../store/uloga';

export default function RootLayout() {
  const { isLoaded, session } = useSesija();
  const router = useRouter();
  const segments = useSegments();
  const naAuth = segments[0] === 'auth';

  // Protected-route authority: unauthenticated users never remain inside the
  // marketplace shell. Auth is one screen in the same app, not a second app.
  useEffect(() => {
    if (!isLoaded) return;
    if (!session && !naAuth) {
      router.replace('/auth');
      return;
    }
    if (session && naAuth) {
      router.replace('/');
    }
  }, [isLoaded, session, naAuth, router]);

  // Consume a completed pre-auth intent exactly once after a real session has
  // been restored/created. The store itself guards which user completed it.
  useEffect(() => {
    if (!isLoaded || !session) return;
    let aktivan = true;
    void povratniCilj.consumeCompleted(session.user.id).then((record) => {
      if (!aktivan || !record) return;
      if (record.intent.intent === 'WORKER') postaviUlogu('uskocer');
      else postaviUlogu('narucilac');

      const target = record.intent.returnTarget;
      if (!target || target.kind === 'NONE') return;
      if (target.kind === 'REQUESTER_DRAFT') {
        router.replace({ pathname: '/nova', params: { conversationId: target.draftKey } });
      } else if (target.kind === 'NEED') {
        router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: target.needId } });
      } else if (target.kind === 'DOGOVOR') {
        router.replace({ pathname: '/dogovor/[id]', params: { id: target.agreementId } });
      }
    });
    return () => {
      aktivan = false;
    };
  }, [isLoaded, session, router]);

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
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.ground },
            animation: 'slide_from_right',
          }}
        />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
