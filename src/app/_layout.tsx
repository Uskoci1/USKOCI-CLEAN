import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { palette } from '../theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.ground }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.ground },
          // Prelaz ne pišemo ručno. Native stack ga već radi — sa smerom,
          // sa gestom nazad i sa prekidljivošću. Ručno pisan gubi sve troje.
          animation: 'slide_from_right',
        }}
      />
    </GestureHandlerRootView>
  );
}
