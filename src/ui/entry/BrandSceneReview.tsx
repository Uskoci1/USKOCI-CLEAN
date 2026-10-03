import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandArtwork } from './BrandScene';
import { INTRO_DURATION_MS } from './spojBrandMath';
import { useReducedMotion } from '../system/motion';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';

/** Existing internal gallery only. Real artwork/clock, no Auth/storage/session operations. */
export function BrandSceneReview() {
  const { width, height } = useWindowDimensions(), reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const time = useSharedValue(INTRO_DURATION_MS);
  const logoWidth = Math.min(width - 48, 320);
  return <View style={s.root}>
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BrandArtwork time={time} phone={{ x: 0, y: 0, width, height }}
        logo={{ x: (width - logoWidth) / 2, y: 180, width: logoWidth, height: logoWidth * 104 / 320 }}
        onArtReady={() => setReady(true)} />
    </Animated.View>
    <SafeAreaView edges={['bottom']} style={s.controls}>
      <T variant="note" style={s.note}>Stvarna animacija znaka · lokalni pregled</T>
      <View style={s.row}>
        {[760, 1700, 3000, INTRO_DURATION_MS].map(ms => <Press key={ms} accessibilityRole="button"
          accessibilityLabel={`Logo na ${ms} milisekundi`} onPress={() => time.set(ms)} style={s.sample}>
          <T variant="label">{`${ms / 1000}s`}</T>
        </Press>)}
      </View>
      <Press accessibilityRole="button" accessibilityLabel="Ponovi animaciju znaka" disabled={!ready}
        onPress={() => { time.set(reduced ? INTRO_DURATION_MS : 0); if (!reduced) time.set(withTiming(INTRO_DURATION_MS, { duration: INTRO_DURATION_MS, easing: Easing.linear })); }} style={s.replay}>
        <T variant="action">Ponovi animaciju</T>
      </Press>
    </SafeAreaView>
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: sys.color.surface },
  controls: { marginTop: 'auto', padding: 24, gap: 16 },
  note: { textAlign: 'center', color: sys.color.muted },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  sample: { minHeight: 48, minWidth: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.wash, borderRadius: 16 },
  replay: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: sys.color.line },
});
