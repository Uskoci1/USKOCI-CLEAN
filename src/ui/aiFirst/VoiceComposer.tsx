import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Microphone, StopCircle } from 'phosphor-react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { VOICE_ERROR_COPY, type HoldToTalkController, type VoiceSnapshot } from '../../features/voice/holdToTalk';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { aiFirst as a } from './tokens';

export function VoiceComposer(p: { controller: HoldToTalkController; state: VoiceSnapshot; disabled: boolean;
  onKeepText: (text: string) => boolean }) {
  const [reader, setReader] = useState(false), [accessibleMode, setAccessibleMode] = useState(false);
  const gesture = useRef<string | null>(null), startY = useRef(0);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (alive) setReader(enabled); });
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    return () => { alive = false; listener.remove(); };
  }, []);
  const explicit = reader || accessibleMode;
  const active = ['PERMISSION_PENDING', 'STARTING', 'LISTENING'].includes(p.state.phase);
  const occupied = p.state.phase !== 'IDLE' && !active;
  const begin = () => {
    if (p.disabled || occupied || active) return;
    const id = noviUuidZahtevId(); gesture.current = id;
    void p.controller.begin(id, explicit ? 'accessible' : 'hold');
  };
  const release = () => { const id = gesture.current; gesture.current = null; if (id) void p.controller.release(id); };
  const label = p.state.phase === 'LISTENING' ? explicit ? 'Zaustavi i pregledaj tekst' : 'Slušam — pusti za tekst'
    : p.state.phase === 'PERMISSION_PENDING' ? 'Čekam dozvolu mikrofona' : p.state.phase === 'STARTING' ? 'Povezujem mikrofon…'
      : p.state.phase === 'FINALIZING' ? 'Završavam transkript…' : explicit ? 'Pokreni govorni unos' : 'Drži da govoriš';
  return <View style={s.wrap}>
    <View style={s.notice}><T style={s.noticeText}>Govor obrađuje Google. USKOČI ne čuva audio.</T>
      <V2Action kind="quiet" label="Detalji" onPress={() => Alert.alert('Govorni unos i privatnost', VOICE_PROCESSING_NOTICE)} /></View>
    {(p.state.finalText || p.state.interimText) && active ? <T selectable style={s.transcript}>{p.state.finalText}{p.state.finalText && p.state.interimText ? ' ' : ''}{p.state.interimText}</T> : null}
    <View style={s.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={label}
        accessibilityHint={explicit ? 'Zaustavljanje priprema tekst za pregled i izmenu. Poruku šalješ zasebnim dugmetom.' : 'Drži tokom govora. Puštanje priprema tekst za pregled i izmenu. Povuci prst naviše da otkažeš.'}
        accessibilityState={{ disabled: (p.disabled && !active) || occupied }} disabled={(p.disabled && !active) || occupied}
        onPressIn={explicit ? undefined : event => { startY.current = event.nativeEvent.pageY; begin(); }}
        onPressOut={explicit ? undefined : release}
        onPress={explicit ? () => active ? release() : begin() : undefined}
        onTouchMove={explicit ? undefined : event => { if (gesture.current && startY.current - event.nativeEvent.pageY > 70) {
          gesture.current = null; p.controller.cancel('gesture'); } }}
        style={[s.mic, active && s.active, ((p.disabled && !active) || occupied) && s.disabled]}>
        {active && explicit ? <StopCircle size={24} color={a.color.surface} weight="fill" /> : <Microphone size={24} color={active ? a.color.surface : a.color.green} weight="fill" />}
        <T style={[s.label, active && s.light]}>{label}</T>
        {p.state.phase === 'LISTENING' && p.state.audioLevel !== null ? <View accessible={false} style={s.levels}>
          {[0.08, 0.2, 0.4, 0.65, 0.85].map((threshold, i) => <View key={threshold}
            style={{ width: 3, height: 6 + i * 3, borderRadius: 2, backgroundColor: p.state.audioLevel! >= threshold ? '#FFFFFF' : '#7EAD9D' }} />)}
        </View> : null}
      </Pressable>
      {active ? <V2Action kind="quiet" label="Otkaži govor" onPress={() => { gesture.current = null; p.controller.cancel('gesture'); }} /> : null}
    </View>
    {active ? <T accessibilityLiveRegion="polite" style={s.noticeText}>Pusti, pregledaj tekst i izaberi Pošalji.</T>
      : !reader && p.state.phase === 'IDLE' ? <V2Action kind="quiet" label={accessibleMode ? 'Koristi držanje mikrofona' : 'Govor bez držanja'} onPress={() => setAccessibleMode(value => !value)} /> : null}
    {p.state.error ? <T accessibilityLiveRegion="polite" style={s.error}>{VOICE_ERROR_COPY[p.state.error]}</T> : null}
    {p.state.fallbackText && p.state.phase === 'IDLE' ? <V2Action kind="quiet" label="Uredi sačuvani tekst" onPress={() => p.controller.useFallback(p.onKeepText)} /> : null}
  </View>;
}
const s = StyleSheet.create({
  wrap: { gap: 4 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 4 }, noticeText: { flex: 1, color: a.color.muted, fontSize: 11, lineHeight: 16 },
  mic: { flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: a.color.wash, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 10 },
  active: { backgroundColor: a.color.green }, disabled: { opacity: 0.5 }, label: { color: a.color.green, fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  light: { color: a.color.surface }, transcript: { color: a.color.ink, fontSize: 15, lineHeight: 22, maxHeight: 88 },
  levels: { flexDirection: 'row', gap: 3, height: 26, alignItems: 'center' }, error: { color: a.color.danger, fontSize: 12, lineHeight: 18 },
});
