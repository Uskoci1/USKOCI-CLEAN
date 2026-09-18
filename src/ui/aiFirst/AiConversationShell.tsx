import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, DotsThree, Info, Keyboard as KeyboardIcon, Microphone, PaperPlaneTilt } from 'phosphor-react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { iconButton, sys } from '../system/tokens';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { aiFirst as a } from './tokens';

export type ConversationMessage = { id: string; fromAi: boolean; body: string;
  /** What this turn actually took from what was said, shown under it. A sentence saying
   *  "zabelezio sam" is a claim; this is the claim made checkable. */
  understood?: readonly { key: string; label: string; value: string }[] };
export type AiConversationShellProps = {
  title: string; subtitle: string; card: (compact: boolean) => ReactNode;
  messages: readonly ConversationMessage[]; welcome: string; welcomeDetail: string;
  value: string; canEdit: boolean; canSend: boolean; pending: boolean; busy: boolean;
  onChange: (value: string) => void; onSend: () => void; onBack: () => void; onOptions: () => void;
  status?: ReactNode; actions?: ReactNode; voice?: ReactNode; children?: ReactNode;
  /** Openings offered before the first word. 38 of the first 62 conversations never got one. */
  openings?: readonly string[];
  /** Only real server text deltas belong here. No typewriter animation. */
  streamingText?: string;
};

/**
 * V5 AI-FIRST shell: a quiet head (back well, eyeline, 21px title, options well), the
 * live card pinned above an independent thread, a 32px intro when the thread is
 * empty, and one bottom bar.
 *
 * The bar carries the keyboard on the left, the microphone in the middle and the
 * speech-privacy info on the right, and the text row appears only once the keyboard is
 * chosen. That ordering is the point: the voice stage used to sit above a permanent
 * text row, and together they took so much of a real phone that the conversation itself
 * was not visible. The thread comes first now.
 *
 * No domain mutations: card, transcript and composer share one bounded surface.
 */
export function AiConversationShell(p: AiConversationShellProps) {
  const { height, fontScale } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  // Voice is the default way in; the text row is one tap away and stays open once used.
  const [typing, setTyping] = useState(false);
  const input = useRef<TextInput>(null);
  // A draft has to be readable wherever it came from, so speech opens the field too.
  const draft = typing || !p.voice || p.value.length > 0 || p.pending;
  const thread = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const compact = keyboard || height < 700 || fontScale >= 1.5 || p.pending;
  const pinned = p.card(compact);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <SafeAreaView edges={['top']} style={s.canvas}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={p.onBack} haptic="select" style={iconButton}>
          <ArrowLeft size={22} color={sys.color.ink} /></Press>
        <View style={s.flex}><T variant="label" style={s.eyeline}>{p.subtitle}</T><T accessibilityRole="header" variant="title" style={s.title}>{p.title}</T></View>
        <Press accessibilityRole="button" accessibilityLabel="Opcije" accessibilityHint="Opcije razgovora." onPress={p.onOptions} haptic="select" style={iconButton}>
          <DotsThree size={26} weight="bold" color={sys.color.ink} /></Press>
      </View>
      {/* Before the first word there is no draft to pin, and an empty card pushed the one
          invitation on the screen below the fold. The caller returns null until it has something. */}
      {pinned ? <View testID="ai-pinned-card" style={[s.cardArea, compact && s.cardCompact]}>{pinned}</View> : null}
      <ScrollView ref={thread} testID="ai-conversation-thread" style={s.flex} contentContainerStyle={s.thread}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; }} scrollEventThrottle={100}
        // With no messages the intro is the entire content, and scrolling to the end of it
        // cuts its first line off the top. There is nothing to follow, so stay put.
        onContentSizeChange={() => { if (nearBottom.current && p.messages.length) thread.current?.scrollToEnd({ animated: false }); }}>
        {p.messages.length === 0 ? <View style={s.welcome}>
          <T accessibilityRole="header" variant="title" style={s.welcomeTitle}>{p.welcome}</T>
          {p.welcomeDetail ? <T variant="copy" tone="muted" style={s.welcomeCopy}>{p.welcomeDetail}</T> : null}
          {p.openings?.length && p.canEdit ? <View style={s.openings}>
            {p.openings.map(opening => <Press key={opening} accessibilityRole="button" accessibilityLabel={opening}
              accessibilityHint="Upisuje ovo u poruku da možeš da dopuniš." haptic="select" style={s.opening}
              onPress={() => { p.onChange(opening + ' '); setTyping(true); requestAnimationFrame(() => input.current?.focus()); }}>
              <T variant="meta" style={s.openingText}>{opening}</T></Press>)}
          </View> : null}
        </View> : p.messages.map(message => <ConversationBubble key={message.id} {...message} />)}
        {p.streamingText ? <View style={s.message}><T variant="label" style={s.assistantLabel}>USKOČI</T>
          <T selectable style={s.body}>{p.streamingText}</T></View> : null}
        {p.busy ? <View accessibilityLiveRegion="polite" style={s.processing}><ActivityIndicator color={a.color.green} />
          <T variant="note" tone="muted">Sređujem podatke…</T></View> : null}
        {/* Recovery belongs to scrollable content, not a second fixed footer. */}
        {p.status ? <View testID="ai-recovery-in-thread" style={s.recovery}>{p.status}</View> : null}
        {p.actions ? <View style={s.actions}>{p.actions}</View> : null}
      </ScrollView>
      {/* Both current consumers live under the tab navigator, which owns bottom insets. */}
      <View testID="ai-composer-footer" style={s.footer}>
        {/* Typing and speaking are two modes. The field appears when the keyboard is
            chosen and the microphone steps aside, rather than the two sharing the screen.
            A draft also opens it unprompted, because speech lands here for review before
            sending and must never end up somewhere the user cannot see it. */}
        {draft ? <View style={s.composer}>
          <Press accessibilityRole="button" accessibilityLabel="Govori umesto da pišeš" haptic="select" style={s.composerWell}
            onPress={() => { setTyping(false); Keyboard.dismiss(); }}>
            <Microphone size={20} color={sys.color.ink} /></Press>
          <TextInput ref={input} accessibilityLabel="Poruka za AI" value={p.value} onChangeText={p.onChange} editable={p.canEdit}
            placeholder="Napiši šta ti treba ili šta da promenim…" placeholderTextColor={a.color.muted} multiline maxLength={4000} style={s.input} />
          <Press accessibilityRole="button" accessibilityLabel={p.pending ? 'Ponovi istu poruku' : 'Pošalji poruku'}
            accessibilityState={{ disabled: !p.canSend }} disabled={!p.canSend} onPress={p.onSend}
            haptic={p.canSend ? 'light' : 'none'} style={[s.send, !p.canSend && s.disabled]}>
            <PaperPlaneTilt size={20} weight="fill" color={a.color.surface} /></Press>
        </View> : null}
        {p.voice && !draft ? <View testID="ai-composer-bar" style={s.bar}>
          <Press accessibilityRole="button" accessibilityLabel="Piši umesto da govoriš" haptic="select" style={s.barWell}
            onPress={() => { setTyping(true); requestAnimationFrame(() => input.current?.focus()); }}>
            <KeyboardIcon size={22} color={sys.color.ink} /></Press>
          <View style={s.barCentre}>{p.voice}</View>
          <Press accessibilityRole="button" accessibilityLabel="O govornom unosu i privatnosti" haptic="select" style={s.barWell}
            onPress={() => Alert.alert('Govorni unos i privatnost', VOICE_PROCESSING_NOTICE)}>
            <Info size={22} color={sys.color.muted} /></Press>
        </View> : null}
      </View>
    </KeyboardAvoidingView>
    {p.children}
  </SafeAreaView>;
}

/** Persisted messages do not rerender for each keystroke or incoming draft chunk. */
const ConversationBubble = memo(function ConversationBubble({ fromAi, body, understood }: ConversationMessage) {
  return <View style={[s.message, !fromAi && s.userMessage]}>
    {fromAi ? <T variant="label" style={s.assistantLabel}>USKOČI</T> : <T variant="label" style={s.userLabel}>Ti</T>}
    <T selectable style={fromAi ? s.body : s.userBody}>{body}</T>
    {understood?.length ? <View accessibilityLabel={`Iz ovoga je uzeto: ${understood.map(item => `${item.label} ${item.value}`).join(', ')}`}
      style={s.understood}>
      {understood.map(item => <View key={item.key} style={s.understoodRow}>
        <T variant="meta" tone="muted" style={s.understoodLabel} numberOfLines={1}>{item.label}</T>
        <T variant="meta" style={s.understoodValue} numberOfLines={2}>{item.value}</T>
      </View>)}
    </View> : null}
  </View>;
});

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: a.color.surface }, flex: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 62, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  eyeline: { color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  title: { color: sys.color.ink },
  body: { ...sys.type.speech, color: sys.color.ink },
  userBody: { ...sys.type.copy, color: sys.color.muted },
  cardArea: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 }, cardCompact: { paddingTop: 0, paddingBottom: 8 },
  thread: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24, gap: 20 },
  welcome: { gap: 12, paddingTop: 14, paddingBottom: 8, maxWidth: 330 },
  welcomeTitle: { color: sys.color.ink },
  welcomeCopy: { lineHeight: 24 },
  openings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  opening: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: a.color.cardLine, backgroundColor: a.color.wash },
  openingText: { color: a.color.green, fontWeight: '600' },
  assistantLabel: { color: a.color.green, letterSpacing: 0.9 },
  userLabel: { color: sys.color.muted, letterSpacing: 0.6 },
  message: { gap: 6, alignSelf: 'flex-start', maxWidth: '96%' },
  // A quiet ledger under the sentence, never louder than the words above it.
  understood: { gap: 4, marginTop: 2, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: a.color.cardLine },
  understoodRow: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  understoodLabel: { minWidth: 76 },
  understoodValue: { flex: 1, color: sys.color.ink },
  userMessage: { alignSelf: 'flex-end', paddingVertical: 12, paddingHorizontal: 15, borderRadius: sys.radius.card, borderBottomRightRadius: 5, backgroundColor: a.color.wash, marginLeft: 30 },
  recovery: { gap: 10, padding: 14, borderRadius: sys.radius.control, backgroundColor: a.color.wash },
  actions: { gap: 10 },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  footer: { borderTopWidth: 1, borderTopColor: a.color.line, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 8, backgroundColor: a.color.surface },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  barCentre: { flex: 1, alignItems: 'center' },
  barWell: { width: 46, height: 46, borderRadius: sys.radius.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: a.color.wash },
  composerWell: { width: 40, height: 40, borderRadius: sys.radius.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: a.color.wash },
  composer: { flexDirection: 'row', gap: 9, alignItems: 'flex-end', borderRadius: sys.radius.control,
    borderWidth: 1, borderColor: a.color.lineStrong, backgroundColor: a.color.surface, padding: 7 },
  input: { ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 44, maxHeight: 116, paddingHorizontal: 8, paddingVertical: 10, textAlignVertical: 'top' },
  send: { width: 44, height: 44, borderRadius: sys.radius.chip, backgroundColor: a.color.green, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
