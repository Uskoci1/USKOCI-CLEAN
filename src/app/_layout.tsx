import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useReducedMotion as useLaunchReducedMotion } from 'react-native-reanimated';
import { sys } from '../ui/system/tokens';
import { useReducedMotionRoot } from '../ui/system/motion';
import { sesijaSada, useSesija } from '../store/sesija';
import { povratniCilj } from '../store/povratniCilj';
import { pendingRoute } from '../store/pendingRoute';
import { PushRuntime } from '../ui/notifications/PushRuntime';
import { BrandMark } from '../ui/entry/BrandAssets';
import { T } from '../ui/Text';
import { useEntrySplashReady } from '../hooks/useEntrySplashReady';

// A screen that throws while rendering shows a way out instead of a white page (release, 2026-09-23). The
// screen-level boundary catches it at the screen, so "Pokušaj ponovo" redraws that screen and the back stack stays;
// the root export is the last resort for an error in the layout itself.
import { AppErrorBoundary } from '../ui/system/AppErrorBoundary';
export { AppErrorBoundary as ErrorBoundary };
export const unstable_settings = { screenErrorBoundary: AppErrorBoundary };

export default function RootLayout() {
  // The one reduced-motion store starts here: Reanimated read the system setting natively at launch, so the first frame
  // of the first screen already respects it, and from here the store follows every change (ui/system/motion.ts).
  useReducedMotionRoot(useLaunchReducedMotion());
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
  const { onLayout: onRouteLayout } = useEntrySplashReady({
    enabled: isLoaded && routeResolved && (naOporavku || (!!session && !naAuth)),
  });

  // Protected-route authority: unauthenticated users never remain inside the
  // marketplace shell. Auth is one screen in the same app, not a second app.
  // Two and a half seconds of nothing is where a person decides the app is frozen.
  const [slowStart, setSlowStart] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlowStart(true), 2500);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!isLoaded || !routeResolved) return;
    if (sesijaSada().sessionEpoch !== sessionEpoch ||
      sesijaSada().user?.id !== session?.user.id) return;
    if (!session && !naAuth && !naOporavku) {
      // The path was used to choose the form and then thrown away, so a tapped Dogovor became the
      // tab home after signing in. Remember it; the consumer below hands it back exactly once.
      pendingRoute.remember(pathname);
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
      if (!isCurrent()) return;
      // Where they were going wins over where the app would otherwise drop them. A person who was
      // sent to sign in by a link or a push is finishing that journey, not starting a new one.
      const resumed = pendingRoute.take();
      if (resumed) {
        router.replace(resumed as Parameters<typeof router.replace>[0]);
        return;
      }
      if (!record) return;

      const target = record.intent.returnTarget;
      if (!target || target.kind === 'NONE') {
        // What the person chose before signing in is where they go, not what the app becomes:
        // "Uskoči i zaradi" opens Zadaci, "Objavi zadatak" opens a new task.
        router.replace(record.intent.intent === 'WORKER' ? '/zadaci' : '/nova');
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
      <View style={{ flex: 1, backgroundColor: sys.color.surface, justifyContent: 'center', alignItems: 'center' }}>
        {/* Same original mark and nominal size as the padded native splash. */}
        <BrandMark size={126} />
        <View style={{ position: 'absolute', alignSelf: 'center', top: '65%', alignItems: 'center', gap: 10 }}>
          <ActivityIndicator accessibilityLabel="Učitavanje" size="small" color={sys.color.ink} />
          {/* A wordless white field says nothing about whether anything is happening. The restore
              is bounded at 8s, so this sentence is never the last thing on screen for long. */}
          {slowStart ? <T variant="copy" tone="muted">Otvaramo aplikaciju…</T> : null}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView onLayout={onRouteLayout} style={{ flex: 1, backgroundColor: sys.color.surface }}>
        <StatusBar style="dark" />
        <Stack
          key={`${session?.user.id ?? 'signed-out'}:${accountRevision}`}
          initialRouteName={session ? '(app)' : 'auth'}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: sys.color.surface },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Protected guard={!session}>
            <Stack.Screen name="auth" options={{ animation: 'none' }} />
          </Stack.Protected>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(app)" options={{ contentStyle: { backgroundColor: sys.color.ground } }} />
            <Stack.Screen name="dogovor/[id]" />
            <Stack.Screen name="obavestenja" />
            <Stack.Screen name="prijave" />
          </Stack.Protected>
          {/* Recovery remains a public link destination, never the cold-start
              fallback when Protected removes the private index route. */}
          <Stack.Screen name="oporavak" options={{ animation: 'none' }} />
        </Stack>
        <PushRuntime ready={routeResolved && !naAuth && !naOporavku} />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
