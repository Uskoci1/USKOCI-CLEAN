import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Microphone, StopCircle } from 'phosphor-react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { VOICE_ERROR_COPY, type HoldToTalkController, type VoiceSnapshot } from '../../features/voice/holdToTalk';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
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
    <View style={s.stage}>
      <View style={[s.ring, listening && s.ringActive]}>
        <Pressable accessibilityRole="button" accessibilityLabel={label}
          accessibilityHint={explicit ? 'Zaustavljanje priprema tekst za pregled i izmenu. Poruku šalješ zasebnim dugmetom.' : 'Drži tokom govora. Puštanje priprema tekst za pregled i izmenu. Povuci prst naviše da otkažeš.'}
          accessibilityState={{ disabled: blocked }} disabled={blocked}
          onPressIn={explicit ? undefined : event => { startY.current = event.nativeEvent.pageY; begin(); }}
          onPressOut={explicit ? undefined : release}
          onPress={explicit ? () => active ? release() : begin() : undefined}
          onTouchMove={explicit ? undefined : event => { if (gesture.current && startY.current - event.nativeEvent.pageY > 70) {
            gesture.current = null; p.controller.cancel('gesture'); } }}
          style={[s.mic, listening && s.micListening, blocked && s.disabled]}>
          {active && explicit ? <StopCircle size={30} color={a.color.surface} weight="fill" />
            : <Microphone size={30} color={listening ? a.color.ink : a.color.surface} weight="fill" />}
        </Pressable>
      </View>
      {listening && p.state.audioLevel !== null ? <View importantForAccessibility="no" style={s.levels}>
        {[0.08, 0.2, 0.4, 0.65, 0.85].map((threshold, i) => <View key={threshold}
          style={{ width: 3, height: 6 + i * 4, borderRadius: 2, backgroundColor: p.state.audioLevel! >= threshold ? a.color.green : '#CFE0D6' }} />)}
      </View> : null}
      <T variant="label" style={[s.caption, listening && s.captionActive]}>{label}</T>
      {active ? <V2Action kind="quiet" label="Otkaži govor" onPress={() => { gesture.current = null; p.controller.cancel('gesture'); }} />
        : !reader && p.state.phase === 'IDLE' ? <V2Action kind="quiet"
          label={accessibleMode ? 'Koristi držanje mikrofona' : 'Govor bez držanja'}
          onPress={() => setAccessibleMode(value => !value)} /> : null}
    </View>
    {active ? <T accessibilityLiveRegion="polite" variant="note" tone="muted" style={s.center}>
      {explicit ? 'Zaustavi, pregledaj tekst i izaberi Pošalji.' : 'Pusti, pregledaj tekst i izaberi Pošalji.'}
    </T> : null}
    {p.state.error === 'MIC_PERMISSION_DENIED' ? <PermissionRecovery compact message={VOICE_ERROR_COPY[p.state.error]} />
      : p.state.error ? <T accessibilityLiveRegion="polite" variant="note" style={s.error}>{VOICE_ERROR_COPY[p.state.error]}</T> : null}
    {p.state.fallbackText && p.state.phase === 'IDLE' ? <V2Action kind="quiet" label="Uredi sačuvani tekst" onPress={() => p.controller.useFallback(p.onKeepText)} /> : null}
    <View style={s.notice}><T variant="label" style={s.noticeText}>Govor obrađuje Google. USKOČI ne čuva audio.</T>
      <V2Action kind="quiet" label="Detalji" onPress={() => Alert.alert('Govorni unos i privatnost', VOICE_PROCESSING_NOTICE)} /></View>
  </View>;
}
const s = StyleSheet.create({
  wrap: { gap: 2 }, center: { textAlign: 'center' },
  stage: { alignItems: 'center', gap: 6, paddingTop: 4 },
  ring: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: '#D9E9DE', alignItems: 'center', justifyContent: 'center' },
  ringActive: { borderColor: '#FFD2A8' },
  mic: { width: 66, height: 66, borderRadius: 33, backgroundColor: a.color.green, borderWidth: 1, borderColor: '#226B52', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#18583F', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  micListening: { backgroundColor: a.color.orange, borderColor: '#E57917' },
  disabled: { opacity: 0.5 },
  caption: { color: a.color.muted, fontWeight: '500', letterSpacing: 0.2, textAlign: 'center' },
  captionActive: { color: a.color.green, fontWeight: '600' },
  levels: { flexDirection: 'row', gap: 3, height: 24, alignItems: 'center' },
  transcript: { color: a.color.ink, fontSize: 16, lineHeight: 24, maxHeight: 96, padding: 12, borderRadius: 16, backgroundColor: '#F5F8F5' },
  error: { color: a.color.danger, textAlign: 'center' },
  // The speech disclosure is a legal notice, so it must never be clipped. A single
  // non-wrapping row overflowed both edges on a real phone at 1080px with the system
  // font scale: 'Govor' was cut off on the left and 'Detalji' on the right.
  notice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 8 },
  noticeText: { color: a.color.muted, fontWeight: '500', letterSpacing: 0, flexShrink: 1, textAlign: 'center' },
});
