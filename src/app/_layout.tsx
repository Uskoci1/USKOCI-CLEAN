import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { palette } from '../theme/tokens';
import { useSesija } from '../store/sesija';
import { povratniCilj } from '../store/povratniCilj';
import { postaviUlogu } from '../store/uloga';

export default function RootLayout() {
  const { isLoaded, session } = useSesija();
  const router = useRouter();
  const segments = useSegments();
  const [initialUrlHandled, setInitialUrlHandled] = useState(false);

  // Deep linking & Intent resolution
  useEffect(() => {
    async function handleIntent() {
      if (!isLoaded) return;
      
      const pending = await povratniCilj.snapshot();
      if (session) {
        // Authenticated: Resolve intent if it exists
        if (pending && pending.status === 'PENDING') {
          await povratniCilj.markCompleted(session.user.id, pending.intent);
          if (pending.intent.intent === 'WORKER') postaviUlogu('uskocer');
          else postaviUlogu('narucilac');
          
          if ((pending.intent as any).returnTarget?.kind === 'DEEP_LINK') {
             const path = (pending.intent as any).returnTarget.path;
             if (path) router.replace(path);
          }
        }
      } else {
        // Unauthenticated: Record deep link intent if app opened via URL
        if (!initialUrlHandled) {
          const url = await Linking.getInitialURL();
          if (url) {
            const path = url.split('uskoci://')[1] || url.split('exp://')[1];
            if (path && !pending) {
              await povratniCilj.prepare({ intent: 'REQUESTER', returnTarget: { kind: 'DEEP_LINK', path } } as any);
            }
          }
          setInitialUrlHandled(true);
        }
      }
    }
    handleIntent();
  }, [isLoaded, session, initialUrlHandled]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.ground, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.ink} />
      </View>
    );
  }

  return (
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
  );
}