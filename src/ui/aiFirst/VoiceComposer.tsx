import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { Microphone, StopCircle, Waveform } from 'phosphor-react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { VOICE_ERROR_COPY, type HoldToTalkController, type VoiceSnapshot } from '../../features/voice/holdToTalk';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { aiFirst as a } from './tokens';
import { sys } from '../system/tokens';

/**
 * Compact microphone state for the shared floating composer. Hold-to-talk remains the default;
 * screen-reader/no-hold mode keeps an explicit start/stop path. The measured level appears only
 * while listening, so the voice state is visible without turning the composer into a second panel.
 * Hold-to-talk, the accessible start/stop mode and every controller call are unchanged.
 */
export function VoiceComposer(p: { controller: HoldToTalkController; state: VoiceSnapshot; disabled: boolean;
  onKeepText: (text: string) => boolean }) {
  const [reader, setReader] = useState(false), [accessibleMode, setAccessibleMode] = useState(false);
  const gesture = useRef<string | null>(null), startY = useRef(0);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (alive) setReader(enabled); }).catch(() => undefined);
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => { alive = false; listener.remove(); };
  }, []);
  const explicit = reader || accessibleMode;
  const active = ['PERMISSION_PENDING', 'PREPARING', 'STARTING', 'LISTENING'].includes(p.state.phase);
  const occupied = p.state.phase !== 'IDLE' && !active;
  const blocked = (p.disabled && !active) || occupied;
  const begin = () => {
    if (p.disabled || occupied || active) return;
    const id = noviUuidZahtevId(); gesture.current = id;
    void p.controller.begin(id, explicit ? 'accessible' : 'hold');
  };
  const release = () => { const id = gesture.current; gesture.current = null; if (id) void p.controller.release(id); };
  const label = p.state.phase === 'LISTENING' ? explicit ? 'Zaustavi i pregledaj tekst' : 'Slušam — pusti za tekst'
    : p.state.phase === 'PERMISSION_PENDING' ? 'Čekam dozvolu mikrofona' : p.state.phase === 'PREPARING' ? 'Pripremam govorni unos…'
      : p.state.phase === 'STARTING' ? 'Povezujem mikrofon…'
      : p.state.phase === 'FINALIZING' ? 'Završavam transkript…' : explicit ? 'Pokreni govorni unos' : 'Drži da govoriš';
  const listening = p.state.phase === 'LISTENING';
  return <View style={s.wrap}>
    {(p.state.finalText || p.state.interimText) && active ? <T selectable style={s.transcript}>{p.state.finalText}{p.state.finalText && p.state.interimText ? ' ' : ''}{p.state.interimText}</T> : null}
    {/* Idle, the microphone speaks for itself; its accessibility label still says what it does. */}
    {p.state.phase !== 'IDLE' ? <T variant="label" style={[s.caption, listening && s.captionActive]}>{label}</T> : null}
    <View style={[s.stage, (active || (!reader && p.state.phase === 'IDLE')) && s.stageInline]}>
      <View style={listening ? s.ringActive : undefined}>
        <Pressable accessibilityRole="button" accessibilityLabel={label}
          accessibilityHint={explicit ? 'Zaustavljanje priprema tekst za pregled i izmenu. Poruku šalješ zasebnim dugmetom.' : 'Drži tokom govora. Puštanje priprema tekst za pregled i izmenu. Povuci prst naviše da otkažeš.'}
          accessibilityState={{ disabled: blocked }} disabled={blocked}
          onPressIn={explicit ? undefined : event => { startY.current = event.nativeEvent.pageY; begin(); }}
          onPressOut={explicit ? undefined : release}
          onPress={explicit ? () => active ? release() : begin() : undefined}
          onTouchMove={explicit ? undefined : event => { if (gesture.current && startY.current - event.nativeEvent.pageY > 70) {
            gesture.current = null; p.controller.cancel('gesture'); } }}
          style={[s.mic, listening && s.micListening, blocked && s.disabled]}>
          {active && explicit ? <StopCircle size={26} color={a.color.surface} weight="fill" />
            : <Microphone size={26} color={listening ? a.color.ink : a.color.surface} weight="fill" />}
        </Pressable>
      </View>
      {listening && p.state.audioLevel !== null ? <View importantForAccessibility="no" style={s.levels}>
        {[0.08, 0.2, 0.4, 0.65, 0.85].map((threshold, i) => <View key={threshold}
          style={{ width: 3, height: 6 + i * 4, borderRadius: sys.radius.pill, backgroundColor: p.state.audioLevel! >= threshold ? a.color.green : a.color.lineStrong }} />)}
      </View> : null}
      {active ? <V2Action kind="quiet" compact label="Otkaži govor" onPress={() => { gesture.current = null; p.controller.cancel('gesture'); }} /> : null}
      {!active && !reader && p.state.phase === 'IDLE' ? <Pressable accessibilityRole="button"
        accessibilityLabel={accessibleMode ? 'Vrati držanje mikrofona' : 'Govor bez držanja'}
        accessibilityHint={accessibleMode ? 'Mikrofon ponovo radi dok ga držiš.' : 'Jedan dodir pokreće govor, sledeći ga zaustavlja.'}
        onPress={() => setAccessibleMode(value => !value)}
        style={[s.modeToggle, accessibleMode && s.modeToggleOn]}>
        <Waveform size={21} weight={accessibleMode ? 'fill' : 'regular'} color={accessibleMode ? a.color.ink : a.color.green} />
      </Pressable> : null}
    </View>
    {active && explicit ? <T accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.center}>
      Zaustavi, pregledaj tekst i izaberi Pošalji.
    </T> : null}
    {p.state.error === 'MIC_PERMISSION_DENIED' ? <PermissionRecovery compact message={VOICE_ERROR_COPY[p.state.error]} />
      : p.state.error ? <T accessibilityLiveRegion="polite" variant="meta" style={s.error}>{VOICE_ERROR_COPY[p.state.error]}</T> : null}
    {p.state.fallbackText && p.state.phase === 'IDLE' ? <V2Action kind="quiet" compact label="Uredi sačuvani tekst" onPress={() => p.controller.useFallback(p.onKeepText)} /> : null}
  </View>;
}
const s = StyleSheet.create({
  // The bar is one row: the shell puts the keyboard on its left and the privacy info on
  // its right, so everything here stays centred and short. Anything taller steals the
  // conversation, which is what it used to do.
  wrap: { gap: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 }, center: { textAlign: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 0 },
  stageInline: { flexDirection: 'row', gap: 8 },
  // The idle ring was decoration that widened the control to 80px, and the microphone
  // itself was 66. Together they took half the screen on a real phone. The halo now
  // appears only while listening, when it actually says something.
  ringActive: { padding: 3, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: a.color.orangeHalo },
  mic: { width: 48, height: 48, borderRadius: sys.radius.pill, backgroundColor: a.color.green, borderWidth: 1, borderColor: a.color.greenEdge, alignItems: 'center', justifyContent: 'center',
    shadowColor: a.color.ink, shadowOpacity: 0.10, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  micListening: { width: 52, height: 52, backgroundColor: a.color.orange, borderColor: a.color.orangeEdge },
  modeToggle: { width: 38, height: 38, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: a.color.iconWell },
  modeToggleOn: { backgroundColor: a.color.orangeSoft, borderWidth: 1, borderColor: a.color.orangeHalo },
  disabled: { opacity: 0.5 },
  caption: { color: a.color.muted, fontWeight: '500', letterSpacing: 0.2, textAlign: 'center' },
  captionActive: { color: a.color.green, fontWeight: '600' },
  levels: { flexDirection: 'row', gap: 3, height: 24, alignItems: 'center' },
  transcript: { ...sys.type.note, color: a.color.ink, maxHeight: 44, paddingHorizontal: 10, paddingVertical: 6, borderRadius: sys.radius.control, backgroundColor: a.color.iconWell },
  error: { color: a.color.danger, textAlign: 'center' },
  // The speech disclosure is a legal notice, so it must never be clipped. A single
  // non-wrapping row overflowed both edges on a real phone at 1080px with the system
  // font scale: 'Govor' was cut off on the left and 'Detalji' on the right.
});
