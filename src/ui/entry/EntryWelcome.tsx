import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight } from 'phosphor-react-native';
import Svg, { Defs, Ellipse, LinearGradient, Rect, Stop, SvgXml } from 'react-native-svg';
import { Image } from 'expo-image';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { useEntryIntro } from '../../hooks/useEntryIntro';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';
import { sesijaSada, useSesija } from '../../store/sesija';
import { Press } from '../Press';
import { BrandArtwork, BrandLockup, useBrandClock } from './BrandScene';
import { brandFrame, type Box } from './spojBrandMath';
import { ENTRY_V49, entryV49Intent, entryV49Intro, entryV49Layout, type EntryV49Layout } from './entryV49Math';
import { requesterNoteXml, workerNoteXml } from './entryV49Notes';

type Intent = 'REQUESTER' | 'WORKER';
type Measurements = { brand?: number; requester?: number; worker?: number; requesterNote?: number; workerNote?: number; footer?: number };
const requesterPhoto = require('../../../assets/brand/entry-v49/requester.webp');
const workerPhoto = require('../../../assets/brand/entry-v49/worker.png');
// CSS gradient angles are measured clockwise from up, including the rectangle's
// aspect ratio. Reusing percentage diagonals would visibly change these fields.
function gradientLine(width: number, height: number, degrees: number) {
  const angle = degrees * Math.PI / 180, dx = Math.sin(angle), dy = -Math.cos(angle);
  const extent = Math.abs(width * dx) + Math.abs(height * dy);
  return { x1: width / 2 - dx * extent / 2, y1: height / 2 - dy * extent / 2,
    x2: width / 2 + dx * extent / 2, y2: height / 2 + dy * extent / 2 };
}

function IntentColumn({ intent, selected, enabled, layout: g, time, selectionTime, reduced, phone, logo, measure, choose }: {
  intent: Intent; selected: Intent | null; enabled: boolean; layout: EntryV49Layout; time: SharedValue<number>;
  selectionTime: SharedValue<number>; reduced: boolean; phone: Box; logo: Box;
  measure: (key: keyof Measurements, height: number) => void; choose: (intent: Intent) => void;
}) {
  const requester = intent === 'REQUESTER', chosen = selected === intent, sign = requester ? 1 : -1;
  const column = useAnimatedStyle(() => {
    const bg = brandFrame(time.get(), phone, logo).background, f = entryV49Intent(selectionTime.get(), g.width, g.motionPhotoH);
    return { opacity: selected && !chosen ? f.otherOpacity : 1,
      transform: [{ translateX: selected ? (chosen ? sign * f.sceneTravel : 0) : (requester ? bg.greenPercent : bg.orangePercent) * g.width / 200 }] };
  });
  const copy = useAnimatedStyle(() => {
    const a = entryV49Intro(time.get(), reduced).copy, f = entryV49Intent(selectionTime.get(), g.width, g.motionPhotoH);
    return { opacity: a.opacity, transform: [{ translateY: chosen ? f.copyY : a.y }] };
  });
  const photo = useAnimatedStyle(() => {
    const a = entryV49Intro(time.get(), reduced).photo, f = entryV49Intent(selectionTime.get(), g.width, g.motionPhotoH);
    return { opacity: a.opacity, transform: [{ translateY: chosen ? f.photoY : a.y }, { scale: chosen ? f.photoScale : 1 }] };
  });
  const note = useAnimatedStyle(() => {
    const a = entryV49Intro(time.get(), reduced).note, f = entryV49Intent(selectionTime.get(), g.width, g.motionPhotoH);
    return { opacity: chosen ? f.noteOpacity : a.opacity, transform: [{ translateY: chosen ? f.noteY : a.y }] };
  });
  const ink = requester ? '#F2F9F0' : ENTRY_V49.ink;
  const noteText = requester ? 'Više vremena za ono što voliš.' : 'Tvoje vreme i trud imaju vrednost.';
  return <Animated.View testID={`entry-${intent.toLowerCase()}-scene`} style={[styles.column, { left: requester ? 0 : g.half, width: g.half, height: g.height }, column]}>
    <Svg pointerEvents="none" accessible={false} width={g.half} height={phone.height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`${intent}-field`} gradientUnits="userSpaceOnUse" {...gradientLine(g.half, phone.height, requester ? 160 : 210)}>
          <Stop offset="0" stopColor={requester ? '#123D31' : '#FFF1D2'} stopOpacity={requester ? 28 / 255 : 16 / 255} />
          <Stop offset={requester ? '.4' : '.55'} stopColor="#FFFFFF" stopOpacity={0} />
          <Stop offset="1" stopColor={requester ? '#102F24' : '#A63C06'} stopOpacity={requester ? 22 / 255 : 16 / 255} />
        </LinearGradient>
        <LinearGradient id={`${intent}-curve`} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="#C8E4D5" stopOpacity={10 / 255} /><Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={g.half} height={phone.height} fill={`url(#${intent}-field)`} />
      <Ellipse cx={g.half * (requester ? -.45 : 1.45)} cy={phone.height * .6} rx={g.half * .85} ry={phone.height * .37}
        rotation={requester ? -24 : 24} originX={g.half * (requester ? -.45 : 1.45)} originY={phone.height * .6}
        stroke="#FFFFFF" strokeOpacity={12 / 255} strokeWidth={1} fill={`url(#${intent}-curve)`} />
    </Svg>
    <Animated.View pointerEvents="none" onLayout={event => measure(requester ? 'requester' : 'worker', event.nativeEvent.layout.height)}
      style={[styles.copy, { top: g.copyY, left: g.gutter, right: g.gutter }, copy]}>
      <Text accessible={false} style={[styles.title, { color: ink, fontSize: g.titleSize, lineHeight: g.titleSize * (g.large ? 1.1 : 1.055),
        marginBottom: g.copyGap, textAlign: requester ? 'left' : 'right', paddingLeft: !requester && !g.large ? 35 : 0, paddingRight: requester && !g.large ? 35 : 0 }]}>
        {requester ? 'Objavi\nzadatak' : 'Uskoči\ni zaradi'}
      </Text>
      {!g.large ? <Text accessible={false} style={[styles.body, { color: ink, fontSize: g.bodySize, lineHeight: g.bodySize * 1.4, textAlign: requester ? 'left' : 'right' }]}>
        {requester ? 'Pronađi ljude za ono što ti treba.' : 'Pronađi zadatak koji ti odgovara.'}
      </Text> : null}
      <View style={[styles.arrow, g.large ? { position: 'relative', alignSelf: requester ? 'flex-end' : 'flex-start', marginTop: 8 } :
        { top: g.arrowY, ...(requester ? { right: 0 } : { left: 0 }) }]}>
        {requester ? <ArrowRight size={20} color={ENTRY_V49.ink} /> : <ArrowLeft size={20} color={ENTRY_V49.ink} />}
      </View>
    </Animated.View>
    <Animated.View pointerEvents="none" testID={`entry-${intent.toLowerCase()}-photo-frame`}
      style={[styles.photo, { left: g.edge, top: g.photoY, width: g.photoW, height: g.photoH }, photo]}>
      <Image source={requester ? requesterPhoto : workerPhoto} accessible={false} style={StyleSheet.absoluteFill}
        contentFit="cover" contentPosition={{ left: '50%', top: '4%' }} transition={0} />
    </Animated.View>
    <Animated.View pointerEvents="none" testID={`entry-${intent.toLowerCase()}-note`}
      onLayout={event => measure(requester ? 'requesterNote' : 'workerNote', event.nativeEvent.layout.height)}
      style={[styles.annotation, { top: g.noteY, width: g.noteW, ...(requester ? { left: g.gutter } : { right: g.gutter }) }, note]}>
      {g.large ? <Text accessible={false} style={[styles.readableNote, { color: requester ? '#FFF9EB' : ENTRY_V49.ink, textAlign: requester ? 'left' : 'right' }]}>{noteText}</Text> :
        <SvgXml accessible={false} xml={requester ? requesterNoteXml : workerNoteXml} width={g.noteW} height={g.noteW * 107 / (requester ? 248.56 : 277.12)} />}
    </Animated.View>
    <Press accessibilityRole="button" accessibilityLabel={requester ? 'Objavi zadatak' : 'Uskoči i zaradi'}
      accessibilityHint={`${requester ? 'Objavi zadatak. Pronađi ljude za ono što ti treba.' : 'Uskoči i zaradi. Pronađi zadatak koji ti odgovara.'} ${noteText}`}
      disabled={!enabled} haptic={enabled ? 'light' : 'none'} scaleTo={1} hitSlop={0} onPress={() => choose(intent)}
      style={{ position: 'absolute', left: 0, top: g.copyY, width: g.half, height: g.footY - g.copyY }} />
  </Animated.View>;
}

export function EntryWelcome({ onRequester, onWorker, onSignIn, onSignUp, busy = false, error }: {
  onRequester: () => void | Promise<void>; onWorker: () => void | Promise<void>; onSignIn: () => void;
  onSignUp?: () => void; busy?: boolean; error?: string | null;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets(), reduced = useSystemReducedMotion();
  const { readiness, onLayout, onSceneReady } = useEntrySplashReady({ waitForScene: true });
  const { phase, prepared, finish } = useEntryIntro(readiness);
  const account = useSesija().accountRevision;
  const [logo, setLogo] = useState<Box | null>(null);
  const [measured, setMeasured] = useState<Measurements>({});
  const [selected, setSelected] = useState<Intent | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const pending = useRef<{ generation: number; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const generation = useRef(0), selectionTime = useSharedValue(0);
  const g = entryV49Layout(width, height, fontScale, { brand: measured.brand,
    copy: measured.requester && measured.worker ? Math.max(measured.requester, measured.worker) : undefined,
    note: measured.requesterNote && measured.workerNote ? Math.max(measured.requesterNote, measured.workerNote) : undefined,
    footer: measured.footer }, insets.top, insets.bottom);
  const measure = (key: keyof Measurements, next: number) => {
    if (Number.isFinite(next) && next > 0) setMeasured(old => Math.abs((old[key] ?? 0) - next) < .1 ? old : { ...old, [key]: next });
  };
  const phone = { x: 0, y: 0, width, height };
  const measuredLogo = logo ?? { x: (width - g.logoW) / 2, y: g.brandY + g.padY + 1, width: g.logoW, height: g.logoH };
  const intro = phase === 'intro';
  const time = useBrandClock(intro && !!logo, phase === 'loading' || (intro && !logo), finish,
    logo && prepared ? onSceneReady : undefined, logo && prepared ? { readiness, phone, logo } : undefined);
  const green = useAnimatedStyle(() => ({ transform: [{ translateX: brandFrame(time.get(), phone, measuredLogo).background.greenPercent * width / 200 }] }));
  const orange = useAnimatedStyle(() => ({ transform: [{ translateX: brandFrame(time.get(), phone, measuredLogo).background.orangePercent * width / 200 }] }));
  const panel = useAnimatedStyle(() => {
    const background = brandFrame(time.get(), phone, measuredLogo).background;
    const alpha = .045 * (1 + background.greenPercent / 101);
    return { boxShadow: [{ offsetX: 0, offsetY: 16, blurRadius: 36, color: `rgba(20,61,53,${alpha})` }] };
  });
  const slogan = useAnimatedStyle(() => { const f = brandFrame(time.get(), phone, measuredLogo).slogan; return { opacity: f.opacity, transform: [{ translateY: f.y }] }; });
  const footer = useAnimatedStyle(() => {
    const f = brandFrame(time.get(), phone, measuredLogo).choices, s = entryV49Intent(selectionTime.get(), width, g.motionPhotoH);
    return { opacity: selected ? s.footerOpacity : f.opacity, transform: [{ translateY: selected ? 0 : f.y }] };
  });
  const sweep = useAnimatedStyle(() => {
    const f = entryV49Intent(selectionTime.get(), width, g.motionPhotoH);
    return { transform: [{ translateX: (selected === 'REQUESTER' ? -1 : 1) * (width / 2 - f.fillTravel) }] };
  });
  const seam = useAnimatedStyle(() => {
    const a = entryV49Intro(time.get(), reduced), f = entryV49Intent(selectionTime.get(), width, g.motionPhotoH);
    return { opacity: selected ? f.seamOpacity : a.seam,
      transform: [{ translateX: selected ? (selected === 'REQUESTER' ? 1 : -1) * f.fillTravel : 0 }] };
  });
  const doorway = useAnimatedStyle(() => {
    const f = entryV49Intent(selectionTime.get(), width, g.motionPhotoH);
    return { opacity: f.doorwayOpen > 0 ? 1 : 0, borderTopLeftRadius: f.doorwayRadius, borderTopRightRadius: f.doorwayRadius,
      transform: [{ translateY: height * (1 - f.doorwayOpen) }] };
  });

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
  }, [account, selectionTime, reduced, width, height, fontScale]);

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
    selectionTime.set(withTiming(ENTRY_V49.duration, { duration: ENTRY_V49.duration, easing: Easing.linear }));
    pending.current.timer = setTimeout(() => { void deliver(); }, ENTRY_V49.duration);
  };
  const cancelChoice = () => {
    if (busy) return;
    generation.current += 1;
    if (pending.current?.timer) clearTimeout(pending.current.timer);
    pending.current = null; cancelAnimation(selectionTime); setSelected(null);
  };
  const enabled = phase === 'welcome' && !busy && !selected;
  const openAuth = (callback?: () => void) => {
    if (enabled && !pending.current && sesijaSada().accountRevision === account && !sesijaSada().user) callback?.();
  };
  return <View onLayout={onLayout} style={styles.root}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.half, { width: width / 2, backgroundColor: ENTRY_V49.green }, green]} />
      <Animated.View style={[styles.half, { left: width / 2, width: width / 2, backgroundColor: ENTRY_V49.orange }, orange]} />
      {selected && !reduced ? <Animated.View testID="entry-intent-fill" style={[StyleSheet.absoluteFill,
        { backgroundColor: selected === 'REQUESTER' ? ENTRY_V49.green : ENTRY_V49.orange }, sweep]} /> : null}
    </View>
    <ScrollView scrollEnabled={!intro && !selected} contentContainerStyle={{ minHeight: g.height }}>
      <View testID="entry-intents" pointerEvents={enabled ? 'box-none' : 'none'} accessibilityElementsHidden={!enabled}
        importantForAccessibility={enabled ? 'auto' : 'no-hide-descendants'} style={StyleSheet.absoluteFill}>
        {(['REQUESTER', 'WORKER'] as const).map(intent => <IntentColumn key={intent} intent={intent} selected={selected} enabled={enabled}
          layout={g} time={time} selectionTime={selectionTime} reduced={reduced} phone={phone} logo={measuredLogo} measure={measure} choose={choose} />)}
      </View>
      <Animated.View pointerEvents="none" testID="entry-center-seam" style={[styles.seam, { left: width / 2 - 1.5, height: g.height }, seam]} />
      <Animated.View testID="entry-brand-panel" onLayout={event => {
        const box = event.nativeEvent.layout;
        measure('brand', box.height);
        const next = { x: box.x + g.padX + 1, y: box.y + g.padY + 1, width: g.logoW, height: g.logoH };
        setLogo(previous => previous && Object.keys(next).every(key => Math.abs(previous[key as keyof Box] - next[key as keyof Box]) < .1) ? previous : next);
      }} style={[styles.panel, { left: (width - g.brandW) / 2, top: g.brandY, width: g.brandW, paddingVertical: g.padY, paddingHorizontal: g.padX, borderRadius: g.radius }, panel]}>
        <View style={{ width: g.logoW, height: g.logoH }}>{phase === 'welcome' ? <BrandLockup width={g.logoW} /> : null}</View>
        <Animated.View style={[styles.slogan, { marginTop: g.sloganGap }, slogan]} accessible accessibilityLabel="Tvoj partner za svaki zadatak.">
          <Text style={[styles.tagline, { fontSize: g.tagSize, lineHeight: g.tagSize * 1.2 }]}>Tvoj partner</Text>
          <Text style={[styles.tagline, { fontSize: g.tagSize, lineHeight: g.tagSize * 1.2, color: '#C44F08' }]}>za svaki zadatak.</Text>
        </Animated.View>
      </Animated.View>
      <Animated.View testID="entry-auth-footer" onLayout={event => measure('footer', event.nativeEvent.layout.height)}
        pointerEvents={enabled ? 'auto' : 'none'} accessibilityElementsHidden={!enabled} importantForAccessibility={enabled ? 'auto' : 'no-hide-descendants'}
        style={[styles.footer, { top: g.footY }, footer]}>
        <Press accessibilityRole="button" accessibilityLabel="Prijavi se" disabled={!enabled} haptic={enabled ? 'select' : 'none'} hitSlop={0}
          onPress={() => openAuth(onSignIn)} style={[styles.signIn, { minWidth: g.large ? 182 : 172 }]}>
          <Text style={[styles.signInText, g.large && { fontSize: 19, lineHeight: 24.7 }]}>Prijavi se</Text><ArrowRight size={18} color={ENTRY_V49.ink} />
        </Press>
        {onSignUp ? <Press accessibilityRole="button" accessibilityLabel="Napravi nalog" disabled={!enabled} haptic={enabled ? 'select' : 'none'} hitSlop={0}
          onPress={() => openAuth(onSignUp)} style={styles.registerHitArea}>
          <View style={styles.registerPill}><Text style={[styles.registerText, g.large && { fontSize: 16, lineHeight: 20.8 }]}>Napravi nalog</Text></View>
        </Press> : null}
        {(error || selectionError) ? <Text accessibilityRole="alert" style={styles.error}>{error || selectionError}</Text> : null}
      </Animated.View>
    </ScrollView>
    {phase !== 'welcome' && logo ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><BrandArtwork time={time} phone={phone} logo={logo} /></View> : null}
    {selected && !reduced ? <Animated.View pointerEvents="none" testID="entry-intent-doorway" style={[StyleSheet.absoluteFill, styles.doorway, doorway]} /> : null}
    {intro ? <Pressable accessibilityRole="button" accessibilityLabel="Preskoči uvod" onPress={finish} style={[styles.skip, { top: Math.max(12, insets.top) }]}><Text style={styles.skipText}>Preskoči</Text></Pressable> : null}
    {selected && !busy ? <Pressable accessibilityRole="button" accessibilityLabel="Otkaži izbor" onPress={cancelChoice} style={[styles.skip, { top: Math.max(12, insets.top) }]}><Text style={styles.skipText}>Otkaži</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  half: { position: 'absolute', top: 0, bottom: 0 },
  column: { position: 'absolute', top: 0 },
  panel: { position: 'absolute', zIndex: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FFFFFF9C' },
  slogan: { alignItems: 'center', gap: 1 },
  tagline: { color: ENTRY_V49.green, fontWeight: '700', fontStyle: 'italic', letterSpacing: -.45, textAlign: 'center', includeFontPadding: false },
  copy: { position: 'absolute' },
  title: { fontWeight: '800', letterSpacing: -.8, includeFontPadding: false },
  body: { fontWeight: '400', includeFontPadding: false },
  arrow: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFBEE', alignItems: 'center', justifyContent: 'center' },
  photo: { position: 'absolute', borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF50', overflow: 'hidden', transformOrigin: 'top center',
    boxShadow: [{ offsetX: 0, offsetY: 14, blurRadius: 28, color: '#102F2A33' }, { inset: true, offsetX: 0, offsetY: 1, blurRadius: 0, color: '#FFFFFF50' }] },
  annotation: { position: 'absolute' },
  readableNote: { fontFamily: 'serif', fontSize: 10, lineHeight: 12.7, fontStyle: 'italic', includeFontPadding: false },
  seam: { position: 'absolute', top: 0, zIndex: 2, width: 3, backgroundColor: '#FFFFFFF5',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 4, color: '#FFFFFFEB' }, { offsetX: 0, offsetY: 0, blurRadius: 10, color: '#FFFFFF70' }, { offsetX: 0, offsetY: 0, blurRadius: 18, color: '#FFFFFF29' }] },
  footer: { position: 'absolute', zIndex: 3, width: '100%', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 2 },
  signIn: { minHeight: 48, maxWidth: '94%', backgroundColor: '#FFFDF5', borderRadius: 25, paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  signInText: { color: ENTRY_V49.ink, fontSize: 14, lineHeight: 18.2, fontWeight: '700', textAlign: 'center', flexShrink: 1, includeFontPadding: false },
  registerHitArea: { minHeight: 48, minWidth: 112, alignItems: 'center', justifyContent: 'flex-start' },
  registerPill: { minHeight: 32, backgroundColor: '#FFF7E2ED', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  registerText: { color: ENTRY_V49.ink, fontSize: 12, lineHeight: 14.4, fontWeight: '600', textAlign: 'center', includeFontPadding: false },
  error: { color: '#943A30', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 21 },
  doorway: { backgroundColor: '#F5F7F3' },
  skip: { position: 'absolute', right: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#FFFFFF', borderRadius: 24 },
  skipText: { color: ENTRY_V49.ink, fontSize: 14, lineHeight: 22, fontWeight: '600' },
});
