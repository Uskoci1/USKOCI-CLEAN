import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'phosphor-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useEntryIntro } from '../../hooks/useEntryIntro';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';
import { BrandScene } from './BrandScene';

export function EntryWelcome({ onRequester, onWorker, onSignIn, busy = false, error }: {
  onRequester: () => void; onWorker: () => void; onSignIn: () => void; busy?: boolean; error?: string | null;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { readiness, onLayout } = useEntrySplashReady();
  const { phase, finish } = useEntryIntro(readiness);
  const scale = Math.min(width / 390, 1.12);
  const intro = phase === 'intro';
  return <View onLayout={onLayout} style={styles.root}>
    {phase !== 'welcome' ? <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs><LinearGradient id="entry-warm" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFF5EC" /><Stop offset="1" stopColor="#FFE0C5" /></LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#entry-warm)" />
    </Svg> : null}
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
      <View style={[styles.column, { minHeight: intro ? 700 * scale : undefined }]}>
        <View style={{ height: 330 * scale, alignItems: 'center' }}>
          <View style={{ width: 390, height: 844, transformOrigin: 'top center', transform: [{ scale }] }}>
            <BrandScene animate={intro} paused={phase === 'loading'} onComplete={finish} />
          </View>
        </View>
        {phase === 'welcome' ? <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>Meni treba.{`\n`}Ja mogu.</Text>
          <Text style={styles.copy}>Velike i male stvari.{`\n`}Ljudi koji mogu da uskoče.</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onRequester} style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}>
              <Text style={styles.primaryText}>Meni treba</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={onWorker} style={({ pressed }) => [styles.secondary, (pressed || busy) && styles.pressed]}>
              <Text style={styles.secondaryText}>Ja mogu</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Prijavi se" disabled={busy} onPress={onSignIn} style={({ pressed }) => [styles.signIn, (pressed || busy) && styles.pressed]}>
              <Text style={styles.secondaryText}>Već imate nalog? Prijavite se</Text><ArrowRight size={18} color="#142F30" />
            </Pressable>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Text style={styles.note}>Jedan nalog. Možeš i da tražiš pomoć i da uskočiš.</Text>
        </View> : null}
      </View>
    </ScrollView>
    {intro ? <Pressable accessibilityRole="button" accessibilityLabel="Preskoči uvod" onPress={finish} style={[styles.skip, { top: Math.max(12, insets.top) }]}><Text style={styles.secondaryText}>Preskoči</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F8F5' },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: 438, flexGrow: 1 },
  content: { paddingHorizontal: 24, flexGrow: 1, paddingBottom: 8 },
  title: { color: '#142F30', fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -0.7, textAlign: 'center' },
  copy: { marginTop: 14, color: '#5D6E6D', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  actions: { marginTop: 48, gap: 12 },
  primary: { minHeight: 56, borderRadius: 16, backgroundColor: '#FA6B32', paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#142F30', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  secondary: { minHeight: 56, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#142F30', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  signIn: { minHeight: 48, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  error: { color: '#A03328', fontSize: 14, lineHeight: 21, marginTop: 12 },
  note: { marginTop: 18, marginBottom: 8, color: '#52645C', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  skip: { position: 'absolute', right: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14 },
  pressed: { opacity: 0.72 },
});
