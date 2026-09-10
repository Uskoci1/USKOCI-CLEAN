import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'phosphor-react-native';
import { SvgXml } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { useEntryIntro } from '../../hooks/useEntryIntro';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';
import { sesijaSada, useSesija } from '../../store/sesija';
import { Press } from '../Press';
import { BrandArtwork, BrandLockup, useBrandClock } from './BrandScene';
import { brandFrame, type Box } from './spojBrandMath';
import { intentRequesterSvg, intentWorkerSvg } from './spojBrandData';

const fillEase = Easing.bezierFn(.2, .8, .2, 1);
const motifEase = Easing.bezierFn(.25, .1, .25, 1);
type Intent = 'REQUESTER' | 'WORKER';

export function EntryWelcome({ onRequester, onWorker, onSignIn, busy = false, error }: {
  onRequester: () => void | Promise<void>; onWorker: () => void | Promise<void>; onSignIn: () => void; busy?: boolean; error?: string | null;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets(), reduced = useSystemReducedMotion();
  const { readiness, onLayout, onSceneReady } = useEntrySplashReady({ waitForScene: true });
  const { phase, prepared, finish } = useEntryIntro(readiness);
  const account = useSesija().accountRevision;
  const [logo, setLogo] = useState<Box | null>(null);
  const [selected, setSelected] = useState<Intent | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const pending = useRef<{ generation: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const generation = useRef(0);
  const selectionTime = useSharedValue(0);
  const large = fontScale > 1.3;
  const panelWidth = Math.min(width - (large || width <= 380 ? 32 : 48), 344);
  const logoWidth = panelWidth - (large ? 32 : 38);
  const phone = { x: 0, y: 0, width, height };
  const measuredLogo = logo ?? { x: (width - logoWidth) / 2, y: 180, width: logoWidth, height: logoWidth * 104 / 320 };
  const intro = phase === 'intro';
  const time = useBrandClock(intro && !!logo, phase === 'loading' || (intro && !logo), finish);
  const green = useAnimatedStyle(() => ({ transform: [{ translateX: brandFrame(time.get(), phone, measuredLogo).background.greenPercent * width / 200 }] }));
  const orange = useAnimatedStyle(() => ({ transform: [{ translateX: brandFrame(time.get(), phone, measuredLogo).background.orangePercent * width / 200 }] }));
  const panel = useAnimatedStyle(() => {
    const background = brandFrame(time.get(), phone, measuredLogo).background;
    const alpha = .045 * (1 + background.greenPercent / 101);
    return { boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 36, color: `rgba(20,61,53,${alpha})` }] };
  });
  const slogan = useAnimatedStyle(() => { const f = brandFrame(time.get(), phone, measuredLogo).slogan; return { opacity: f.opacity, transform: [{ translateY: f.y }] }; });
  const choices = useAnimatedStyle(() => { const f = brandFrame(time.get(), phone, measuredLogo).choices; return { opacity: selected ? 0 : f.opacity, transform: [{ translateY: f.y }] }; });
  const sweep = useAnimatedStyle(() => {
    const q = fillEase(Math.max(0, Math.min(1, (selectionTime.get() - 110) / 530)));
    return { transform: [{ translateX: (selected === 'REQUESTER' ? -1 : 1) * width / 2 * (1 - q) }] };
  });
  const motif = useAnimatedStyle(() => ({ opacity: motifEase(Math.max(0, Math.min(1, (selectionTime.get() - 250) / 240))) }));

  useEffect(() => {
    // The paused artwork and final geometry are committed before native reveal.
    // Cosmetic storage resolves independently; no part of the clock runs hidden.
    if (logo && prepared) onSceneReady();
  }, [logo, prepared, onSceneReady]);

  useEffect(() => {
    const cancel = () => {
      generation.current += 1;
      if (pending.current?.timer) clearTimeout(pending.current.timer);
      pending.current = null; cancelAnimation(selectionTime); setSelected(null);
    };
    cancel();
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    return () => {
      generation.current += 1;
      if (pending.current?.timer) clearTimeout(pending.current.timer);
      pending.current = null; cancelAnimation(selectionTime); subscription.remove();
    };
  }, [account, selectionTime, reduced]);

  const choose = (intent: Intent) => {
    if (phase !== 'welcome' || busy || pending.current || sesijaSada().accountRevision !== account || sesijaSada().user) return;
    const id = ++generation.current;
    pending.current = { generation: id }; setSelected(intent); setSelectionError(null);
    const callback = intent === 'REQUESTER' ? onRequester : onWorker;
    const deliver = async () => {
      if (generation.current !== id || sesijaSada().accountRevision !== account || sesijaSada().user) return;
      try { await callback(); }
      catch { if (generation.current === id) setSelectionError('Izbor trenutno nije potvrđen. Pokušajte ponovo.'); }
      finally { if (generation.current === id) { pending.current = null; setSelected(null); } }
    };
    if (reduced) { void deliver(); return; }
    selectionTime.set(0);
    selectionTime.set(withTiming(760, { duration: 760, easing: Easing.linear }));
    pending.current.timer = setTimeout(() => { void deliver(); }, 760);
  };
  const cancelChoice = () => {
    if (busy) return;
    generation.current += 1;
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    pending.current = null; cancelAnimation(selectionTime); setSelected(null);
  };
  const enabled = phase === 'welcome' && !busy && !selected;
  return <View onLayout={onLayout} style={styles.root}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.half, { width: width / 2, backgroundColor: '#2E7A6A' }, green]} />
      <Animated.View style={[styles.half, { left: width / 2, width: width / 2, backgroundColor: '#FF7908' }, orange]} />
      {selected && !reduced ? <>
        <Animated.View testID="entry-intent-fill" style={[StyleSheet.absoluteFill, { backgroundColor: selected === 'REQUESTER' ? '#2E7A6A' : '#FF7908' }, sweep]} />
        <Animated.View style={[StyleSheet.absoluteFill, motif]}>
          <View style={styles.motif}><SvgXml xml={selected === 'REQUESTER' ? intentRequesterSvg : intentWorkerSvg} width="100%" height="100%" style={{ opacity: .085 }} /></View>
          <View style={[styles.ring, { width: width * .73, height: width * .73, borderRadius: width }]} />
        </Animated.View>
      </> : null}
    </View>
    <ScrollView scrollEnabled={!intro && !selected} contentContainerStyle={[styles.scroll, { minHeight: height, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View testID="entry-brand-panel" onLayout={event => {
        const box = event.nativeEvent.layout;
        const next = { x: box.x + (large ? 16 : 19), y: box.y + (large ? 20 : 26), width: logoWidth, height: logoWidth * 104 / 320 };
        setLogo(previous => previous && Object.keys(next).every(key => previous[key as keyof Box] === next[key as keyof Box]) ? previous : next);
      }} style={[styles.panel, { width: panelWidth }, large && styles.largePanel, panel]}>
        <View style={{ width: logoWidth, height: logoWidth * 104 / 320 }}>
          {phase === 'welcome' ? <BrandLockup width={logoWidth} /> : null}
        </View>
        <Animated.View style={[styles.slogan, slogan]} accessible accessibilityLabel="Tvoj partner za svaki zadatak.">
          <Text style={[styles.tagline, width <= 380 && styles.smallTagline]}>Tvoj partner</Text>
          <Text style={[styles.tagline, styles.orangeText, width <= 380 && styles.smallTagline]}>za svaki zadatak.</Text>
        </Animated.View>
      </Animated.View>
      <Animated.View pointerEvents={enabled ? 'auto' : 'none'} accessibilityElementsHidden={!enabled} importantForAccessibility={enabled ? 'auto' : 'no-hide-descendants'}
        style={[styles.choices, large && styles.largeChoices, choices]}>
        <Press accessibilityRole="button" accessibilityLabel="Meni treba" disabled={!enabled} haptic={enabled ? 'light' : 'none'} scaleTo={1} hitSlop={0}
          onPress={() => choose('REQUESTER')} style={[styles.intent, large && styles.largeRequester]}>
          <Text style={[styles.kicker, styles.whiteText]}>Meni treba</Text>
          <Text style={[styles.intentTitle, styles.whiteText]}>Objavi{`\n`}zadatak</Text>
          <Text style={[styles.intentCopy, styles.whiteText]}>Pronađi ljude{`\n`}koji mogu da pomognu.</Text>
          <View style={[styles.arrow, styles.whiteBorder]}><ArrowRight size={22} color="#FFFFFF" /></View>
        </Press>
        <Press accessibilityRole="button" accessibilityLabel="Ja mogu" disabled={!enabled} haptic={enabled ? 'light' : 'none'} scaleTo={1} hitSlop={0}
          onPress={() => choose('WORKER')} style={[styles.intent, styles.worker, large && styles.largeWorker]}>
          <Text style={[styles.kicker, styles.rightText]}>Ja mogu</Text>
          <Text style={[styles.intentTitle, styles.rightText]}>Uskoči{`\n`}i zaradi</Text>
          <Text style={[styles.intentCopy, styles.rightText]}>Pronađi zadatak{`\n`}koji ti odgovara.</Text>
          <View style={styles.arrow}><ArrowLeft size={22} color="#13382F" /></View>
        </Press>
      </Animated.View>
      <Animated.View pointerEvents={enabled ? 'auto' : 'none'} accessibilityElementsHidden={!enabled} importantForAccessibility={enabled ? 'auto' : 'no-hide-descendants'}
        style={[styles.footer, large && styles.largeWorker, choices]}>
        <Press accessibilityRole="button" accessibilityLabel="Prijavi se" disabled={!enabled} haptic={enabled ? 'select' : 'none'} onPress={onSignIn} style={styles.signIn}>
          <Text style={styles.signInText}>Već imaš nalog? Prijavi se</Text>
        </Press>
        {(error || selectionError) ? <Text accessibilityRole="alert" style={styles.error}>{error || selectionError}</Text> : null}
        <Text style={styles.note}>Jedan nalog. Obe mogućnosti.</Text>
      </Animated.View>
    </ScrollView>
    {phase !== 'welcome' && logo ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><BrandArtwork time={time} phone={phone} logo={logo} /></View> : null}
    {intro ? <Pressable accessibilityRole="button" accessibilityLabel="Preskoči uvod" onPress={finish} style={[styles.skip, { top: Math.max(12, insets.top) }]}><Text style={styles.skipText}>Preskoči</Text></Pressable> : null}
    {selected && !busy ? <Pressable accessibilityRole="button" accessibilityLabel="Otkaži izbor" onPress={cancelChoice} style={[styles.skip, { top: Math.max(12, insets.top) }]}><Text style={styles.skipText}>Otkaži</Text></Pressable> : null}
  </View>;
}

// Final computed .phone.repaired/.v2 entry rules in the executable SPOJ V2 HTML.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  half: { position: 'absolute', top: 0, bottom: 0 },
  scroll: { flexGrow: 1, alignItems: 'center' },
  panel: { backgroundColor: '#FFFFFF', marginTop: 'auto', marginBottom: 28, paddingTop: 26, paddingHorizontal: 19, paddingBottom: 25, borderRadius: 30 },
  largePanel: { marginTop: 24, marginBottom: 20, paddingVertical: 20, paddingHorizontal: 16 },
  slogan: { marginTop: 18, alignItems: 'center', gap: 1 },
  tagline: { color: '#2E7A6A', fontSize: 24, lineHeight: 29.28, fontWeight: '700', fontStyle: 'italic', letterSpacing: -.65, textAlign: 'center' },
  smallTagline: { fontSize: 22, lineHeight: 26.84 },
  orangeText: { color: '#FF7908' },
  choices: { width: '100%', flexDirection: 'row', marginTop: 26, paddingBottom: 20 },
  largeChoices: { flexDirection: 'column', marginTop: 0, paddingBottom: 0 },
  intent: { flex: 1, paddingVertical: 24, paddingHorizontal: 23, alignItems: 'flex-start' },
  worker: { alignItems: 'flex-end' },
  largeRequester: { backgroundColor: '#2E7A6A' },
  largeWorker: { backgroundColor: '#FF7908' },
  kicker: { color: '#13382F', fontSize: 13, lineHeight: 19.5, fontWeight: '600', marginBottom: 9 },
  intentTitle: { color: '#13382F', fontSize: 29, lineHeight: 32.48, fontWeight: '700', letterSpacing: -.7, marginBottom: 12 },
  intentCopy: { color: '#13382F', fontSize: 14, lineHeight: 19.6, marginBottom: 18 },
  whiteText: { color: '#FFFFFF' },
  rightText: { textAlign: 'right' },
  arrow: { width: 46, height: 46, borderWidth: 1.2, borderColor: '#13382F', borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  whiteBorder: { borderColor: '#FFFFFF' },
  footer: { width: '100%', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28 },
  signIn: { minHeight: 44, backgroundColor: '#FFFFFF', borderRadius: 30, paddingVertical: 12, paddingHorizontal: 18, justifyContent: 'center' },
  signInText: { color: '#143D35', fontSize: 13, lineHeight: 19.5, fontWeight: '600', textAlign: 'center' },
  note: { marginTop: 11, color: '#FFFFFF', backgroundColor: '#143D3533', borderRadius: 16, paddingVertical: 4, paddingHorizontal: 11, fontSize: 12, lineHeight: 18, textAlign: 'center', overflow: 'hidden' },
  error: { marginTop: 12, color: '#943A30', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 21 },
  skip: { position: 'absolute', right: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#FFFFFF', borderRadius: 24 },
  skipText: { color: '#143D35', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  motif: { position: 'absolute', left: '15%', bottom: '11%', width: '70%', height: '25%' },
  ring: { position: 'absolute', right: '-20%', bottom: '6%', borderWidth: 1, borderColor: '#FFFFFF14' },
});
