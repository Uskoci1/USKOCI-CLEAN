import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { Microphone, StopCircle } from 'phosphor-react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { VOICE_ERROR_COPY, type HoldToTalkController, type VoiceSnapshot } from '../../features/voice/holdToTalk';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { aiFirst as a } from './tokens';

/**
 * V5 microphone: one 66px round control in the middle of the composer, its state
 * spoken and written under it, the measured level shown only while listening.
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
  const active = ['PERMISSION_PENDING', 'STARTING', 'LISTENING'].includes(p.state.phase);
  const occupied = p.state.phase !== 'IDLE' && !active;
  const blocked = (p.disabled && !active) || occupied;
  const begin = () => {
    if (p.disabled || occupied || active) return;
    const id = noviUuidZahtevId(); gesture.current = id;
    void p.controller.begin(id, explicit ? 'accessible' : 'hold');
  };
  const release = () => { const id = gesture.current; gesture.current = null; if (id) void p.controller.release(id); };
  const label = p.state.phase === 'LISTENING' ? explicit ? 'Zaustavi i pregledaj tekst' : 'Slušam — pusti za tekst'
    : p.state.phase === 'PERMISSION_PENDING' ? 'Čekam dozvolu mikrofona' : p.state.phase === 'STARTING' ? 'Povezujem mikrofon…'
      : p.state.phase === 'FINALIZING' ? 'Završavam transkript…' : explicit ? 'Pokreni govorni unos' : 'Drži da govoriš';
  const listening = p.state.phase === 'LISTENING';
  return <View style={s.wrap}>
    {(p.state.finalText || p.state.interimText) && active ? <T selectable style={s.transcript}>{p.state.finalText}{p.state.finalText && p.state.interimText ? ' ' : ''}{p.state.interimText}</T> : null}
    <T variant="label" style={[s.caption, listening && s.captionActive]}>{label}</T>
    <View style={s.stage}>
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
          {active && explicit ? <StopCircle size={24} color={a.color.surface} weight="fill" />
            : <Microphone size={24} color={listening ? a.color.ink : a.color.surface} weight="fill" />}
        </Pressable>
      </View>
      {listening && p.state.audioLevel !== null ? <View importantForAccessibility="no" style={s.levels}>
        {[0.08, 0.2, 0.4, 0.65, 0.85].map((threshold, i) => <View key={threshold}
          style={{ width: 3, height: 6 + i * 4, borderRadius: 2, backgroundColor: p.state.audioLevel! >= threshold ? a.color.green : '#CFE0D6' }} />)}
      </View> : null}
      {active ? <V2Action kind="quiet" label="Otkaži govor" onPress={() => { gesture.current = null; p.controller.cancel('gesture'); }} /> : null}
    </View>
    {!active && !reader && p.state.phase === 'IDLE' ? <V2Action kind="quiet"
      label={accessibleMode ? 'Koristi držanje mikrofona' : 'Govor bez držanja'}
      onPress={() => setAccessibleMode(value => !value)} /> : null}
    {active ? <T accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.center}>
      {explicit ? 'Zaustavi, pregledaj tekst i izaberi Pošalji.' : 'Pusti, pregledaj tekst i izaberi Pošalji.'}
    </T> : null}
    {p.state.error === 'MIC_PERMISSION_DENIED' ? <PermissionRecovery compact message={VOICE_ERROR_COPY[p.state.error]} />
      : p.state.error ? <T accessibilityLiveRegion="polite" variant="note" style={s.error}>{VOICE_ERROR_COPY[p.state.error]}</T> : null}
    {p.state.fallbackText && p.state.phase === 'IDLE' ? <V2Action kind="quiet" label="Uredi sačuvani tekst" onPress={() => p.controller.useFallback(p.onKeepText)} /> : null}
  </View>;
}
const s = StyleSheet.create({
  // The bar is one row: the shell puts the keyboard on its left and the privacy info on
  // its right, so everything here stays centred and short. Anything taller steals the
  // conversation, which is what it used to do.
  wrap: { gap: 1, alignItems: 'center' }, center: { textAlign: 'center' },
  stage: { alignItems: 'center', gap: 4, paddingTop: 1 },
  // The idle ring was decoration that widened the control to 80px, and the microphone
  // itself was 66. Together they took half the screen on a real phone. The halo now
  // appears only while listening, when it actually says something.
  ringActive: { padding: 3, borderRadius: 30, borderWidth: 1, borderColor: '#FFD2A8' },
  mic: { width: 48, height: 48, borderRadius: 24, backgroundColor: a.color.green, borderWidth: 1, borderColor: '#226B52', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#18583F', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  micListening: { backgroundColor: a.color.orange, borderColor: '#E57917' },
  disabled: { opacity: 0.5 },
  caption: { color: a.color.muted, fontWeight: '500', letterSpacing: 0.2, textAlign: 'center' },
  captionActive: { color: a.color.green, fontWeight: '600' },
  levels: { flexDirection: 'row', gap: 3, height: 24, alignItems: 'center' },
  transcript: { color: a.color.ink, fontSize: 16, lineHeight: 24, maxHeight: 72, padding: 10, borderRadius: 16, backgroundColor: '#F5F8F5' },
  error: { color: a.color.danger, textAlign: 'center' },
  // The speech disclosure is a legal notice, so it must never be clipped. A single
  // non-wrapping row overflowed both edges on a real phone at 1080px with the system
  // font scale: 'Govor' was cut off on the left and 'Detalji' on the right.
});
