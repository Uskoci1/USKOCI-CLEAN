import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, DotsThree, PaperPlaneTilt } from 'phosphor-react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { iconButton, sys } from '../system/tokens';
import { aiFirst as a } from './tokens';

export type ConversationMessage = { id: string; fromAi: boolean; body: string };
export type AiConversationShellProps = {
  title: string; subtitle: string; card: (compact: boolean) => ReactNode;
  messages: readonly ConversationMessage[]; welcome: string; welcomeDetail: string;
  value: string; canEdit: boolean; canSend: boolean; pending: boolean; busy: boolean;
  onChange: (value: string) => void; onSend: () => void; onBack: () => void; onOptions: () => void;
  status?: ReactNode; actions?: ReactNode; voice?: ReactNode; children?: ReactNode;
  /** Only real server text deltas belong here. No typewriter animation. */
  streamingText?: string;
};

/**
 * V5 AI-FIRST shell: a quiet head (back well, eyeline, 21px title, options well), the
 * live card pinned above an independent thread, a 32px intro when the thread is
 * empty, and one composer footer that hosts the voice control above the text row.
 * No domain mutations: card, transcript and composer share one bounded surface.
 */
export function AiConversationShell(p: AiConversationShellProps) {
  const { height, fontScale } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  const thread = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const compact = keyboard || height < 700 || fontScale >= 1.5 || p.pending;
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
      <View testID="ai-pinned-card" style={[s.cardArea, compact && s.cardCompact]}>{p.card(compact)}</View>
      <ScrollView ref={thread} testID="ai-conversation-thread" style={s.flex} contentContainerStyle={s.thread}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; }} scrollEventThrottle={100}
        onContentSizeChange={() => { if (nearBottom.current) thread.current?.scrollToEnd({ animated: false }); }}>
        {p.messages.length === 0 ? <View style={s.welcome}>
          <T accessibilityRole="header" variant="display" style={s.welcomeTitle}>{p.welcome}</T>
          <T variant="copy" tone="muted" style={s.welcomeCopy}>{p.welcomeDetail}</T>
        </View> : p.messages.map(message => <ConversationBubble key={message.id} fromAi={message.fromAi} body={message.body} />)}
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
        {p.voice}
        <View style={s.composer}>
          <TextInput accessibilityLabel="Poruka za AI" value={p.value} onChangeText={p.onChange} editable={p.canEdit}
            placeholder="Napiši šta ti treba ili šta da promenim…" placeholderTextColor={a.color.muted} multiline maxLength={4000} style={s.input} />
          <Press accessibilityRole="button" accessibilityLabel={p.pending ? 'Ponovi istu poruku' : 'Pošalji poruku'}
            accessibilityState={{ disabled: !p.canSend }} disabled={!p.canSend} onPress={p.onSend}
            haptic={p.canSend ? 'light' : 'none'} style={[s.send, !p.canSend && s.disabled]}>
            <PaperPlaneTilt size={20} weight="fill" color={a.color.surface} /></Press>
        </View>
      </View>
    </KeyboardAvoidingView>
    {p.children}
  </SafeAreaView>;
}

/** Persisted messages do not rerender for each keystroke or incoming draft chunk. */
const ConversationBubble = memo(function ConversationBubble({ fromAi, body }: { fromAi: boolean; body: string }) {
  return <View style={[s.message, !fromAi && s.userMessage]}>
    {fromAi ? <T variant="label" style={s.assistantLabel}>USKOČI</T> : <T variant="label" style={s.userLabel}>Ti</T>}
    <T selectable style={fromAi ? s.body : s.userBody}>{body}</T>
  </View>;
});

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: a.color.surface }, flex: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 62, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  eyeline: { color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 },
  title: { color: sys.color.ink },
  body: { fontSize: 16, lineHeight: 26, color: '#284B3C' },
  userBody: { fontSize: 15, lineHeight: 23, color: '#3B5246' },
  cardArea: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 }, cardCompact: { paddingTop: 0, paddingBottom: 8 },
  thread: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 6, paddingBottom: 24, gap: 20 },
  welcome: { gap: 12, paddingTop: 14, paddingBottom: 8, maxWidth: 330 },
  welcomeTitle: { color: sys.color.ink },
  welcomeCopy: { lineHeight: 24 },
  assistantLabel: { color: a.color.green, letterSpacing: 0.9 },
  userLabel: { color: sys.color.muted, letterSpacing: 0.6 },
  message: { gap: 6, alignSelf: 'flex-start', maxWidth: '96%' },
  userMessage: { alignSelf: 'flex-end', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 20, borderBottomRightRadius: 5, backgroundColor: a.color.wash, marginLeft: 30 },
  recovery: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: a.color.wash },
  actions: { gap: 10 },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  footer: { borderTopWidth: 1, borderTopColor: '#EEF2EF', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10, gap: 8, backgroundColor: a.color.surface },
  composer: { flexDirection: 'row', gap: 9, alignItems: 'flex-end', borderRadius: a.radius.composer,
    borderWidth: 1, borderColor: '#C7DACF', backgroundColor: a.color.surface, padding: 7 },
  input: { fontSize: 16, lineHeight: 23, color: sys.color.ink, flex: 1, minHeight: 44, maxHeight: 116, paddingHorizontal: 8, paddingVertical: 10, textAlignVertical: 'top' },
  send: { width: 44, height: 44, borderRadius: 13, backgroundColor: a.color.green, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
