import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Icon } from '../v2/icons';
import { V2Action } from '../v2/V2Action';
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

/** No domain mutations: card, transcript and composer share one bounded surface. */
export function AiConversationShell(p: AiConversationShellProps) {
  const { height, fontScale } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(false);
  const thread = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const compact = keyboard || height < 700 || fontScale >= 1.5;
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <SafeAreaView edges={['top']} style={s.canvas}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={p.onBack} haptic="select" style={s.icon}>
          <V2Icon name="back" color={a.color.ink} /></Press>
        <View style={s.flex}><T style={s.meta}>{p.subtitle}</T><T accessibilityRole="header" style={s.title}>{p.title}</T></View>
        <V2Action kind="quiet" label="Opcije" onPress={p.onOptions} />
      </View>
      <View testID="ai-pinned-card" style={[s.cardArea, compact && s.cardCompact]}>{p.card(compact)}</View>
      <ScrollView ref={thread} testID="ai-conversation-thread" style={s.flex} contentContainerStyle={s.thread}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; }} scrollEventThrottle={100}
        onContentSizeChange={() => { if (nearBottom.current) thread.current?.scrollToEnd({ animated: false }); }}>
        {p.messages.length === 0 ? <View style={s.welcome}>
          <T style={s.assistantLabel}>USKOČI ASISTENT</T>
          <T accessibilityRole="header" style={s.welcomeTitle}>{p.welcome}</T><T style={s.meta}>{p.welcomeDetail}</T>
        </View> : p.messages.map(message => <View key={message.id} style={[s.message, !message.fromAi && s.userMessage]}>
          <T style={message.fromAi ? s.assistantLabel : s.meta}>{message.fromAi ? 'USKOČI' : 'Ti'}</T>
          <T selectable style={s.body}>{message.body}</T>
        </View>)}
        {p.streamingText ? <View style={s.message}><T style={s.assistantLabel}>USKOČI</T>
          <T selectable style={s.body}>{p.streamingText}</T></View> : null}
        {p.busy ? <View accessibilityLiveRegion="polite" style={s.processing}><ActivityIndicator color={a.color.green} />
          <T style={s.meta}>Sređujem podatke…</T></View> : null}
        {p.actions}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={s.footer}>
        {p.status}
        {p.voice}
        <View style={s.composer}>
          <TextInput accessibilityLabel="Poruka za AI" value={p.value} onChangeText={p.onChange} editable={p.canEdit}
            placeholder="Napiši poruku ili ispravku…" placeholderTextColor={a.color.muted} multiline maxLength={4000} style={s.input} />
          <Press accessibilityRole="button" accessibilityLabel={p.pending ? 'Ponovi istu poruku' : 'Pošalji poruku'}
            accessibilityState={{ disabled: !p.canSend }} disabled={!p.canSend} onPress={p.onSend}
            haptic={p.canSend ? 'light' : 'none'} style={[s.send, !p.canSend && s.disabled]}>
            <V2Icon name="send" color={a.color.surface} /></Press>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
    {p.children}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: a.color.surface }, flex: { flex: 1 },
  header: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  title: { ...a.text.title, color: a.color.ink }, meta: { ...a.text.meta, color: a.color.muted },
  body: { ...a.text.body, color: a.color.ink }, icon: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  dots: { fontSize: 28, lineHeight: 34, color: a.color.ink, fontWeight: '700' },
  cardArea: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }, cardCompact: { paddingTop: 0, paddingBottom: 8 },
  thread: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 20, gap: 18 },
  welcome: { gap: 10, paddingTop: 14, maxWidth: 520 }, welcomeTitle: { fontSize: 26, lineHeight: 34, color: a.color.ink, fontWeight: '600' },
  assistantLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 0.8, color: a.color.green },
  message: { gap: 5, alignSelf: 'flex-start', maxWidth: '96%' }, userMessage: { alignSelf: 'flex-end', padding: 14,
    borderRadius: 18, borderBottomRightRadius: 5, backgroundColor: a.color.wash, marginLeft: 24 },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  footer: { borderTopWidth: 1, borderTopColor: a.color.line, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 10 },
  composer: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', borderRadius: a.radius.composer,
    borderWidth: 1, borderColor: a.color.line, backgroundColor: a.color.surface, padding: 6 },
  input: { ...a.text.body, color: a.color.ink, flex: 1, minHeight: 48, maxHeight: 112, paddingHorizontal: 10, paddingVertical: 12, textAlignVertical: 'top' },
  send: { width: 48, height: 48, borderRadius: 15, backgroundColor: a.color.green, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
});
