import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DotsThree, Info, Keyboard as KeyboardIcon, Microphone, PaperPlaneTilt, Plus } from 'phosphor-react-native';
import { T } from '../Text';
import { Press } from '../Press';
import { DetailTopBar } from '../system/DetailTopBar';
import { iconButton, sys } from '../system/tokens';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { aiFirst as a } from './tokens';

export type ConversationMessage = { id: string; fromAi: boolean; body: string;
  /** What this turn actually took from what was said, shown under it. A sentence saying
   *  "zabelezio sam" is a claim; this is the claim made checkable. */
  understood?: readonly { key: string; label: string; value: string }[] };
export type AiConversationShellProps = {
  title: string; subtitle?: string; card: (compact: boolean) => ReactNode;
  messages: readonly ConversationMessage[]; welcome: string; welcomeDetail: string;
  value: string; canEdit: boolean; canSend: boolean; pending: boolean; busy: boolean;
  onChange: (value: string) => void; onSend: () => void; onBack: () => void; onOptions: () => void;
  onAdd?: () => void; addDisabled?: boolean; addLabel?: string;
  status?: ReactNode; actions?: ReactNode; voice?: ReactNode; children?: ReactNode;
  /** Openings offered before the first word. 38 of the first 62 conversations never got one. */
  openings?: readonly string[];
  /** A sentence already sent and not yet read back from the server. It belongs on screen. */
  sentMessage?: string | null;
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
  const [inputFocused, setInputFocused] = useState(false);
  // Voice is the default way in; the text row is one tap away and stays open once used.
  const [typing, setTyping] = useState(false);
  const input = useRef<TextInput>(null);
  // A draft has to be readable wherever it came from, so speech opens the field too.
  const draft = typing || !p.voice || p.value.length > 0 || p.pending;
  const showSend = !p.voice || p.value.trim().length > 0 || p.pending;
  const thread = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const reduced = useSystemReducedMotion();
  // Everything present on the first render is history; anything after it is news.
  const seen = useRef<Set<string>>(new Set());
  const settled = useRef(false);
  if (!settled.current) { settled.current = true; p.messages.forEach(message => seen.current.add(message.id)); }
  const compact = keyboard || height < 700 || fontScale >= 1.5 || p.pending;
  const pinned = p.card(compact);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return <SafeAreaView edges={['top']} style={s.canvas}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DetailTopBar eyebrow={p.subtitle} title={p.title} onBack={p.onBack}
        right={<Press accessibilityRole="button" accessibilityLabel="Opcije" accessibilityHint="Opcije razgovora." onPress={p.onOptions} haptic="select" style={iconButton}>
          <DotsThree size={26} weight="bold" color={sys.color.ink} /></Press>} />
      {/* Before the first word there is no draft to pin, and an empty card pushed the one
          invitation on the screen below the fold. The caller returns null until it has something. */}
      {pinned ? <View testID="ai-pinned-card" style={[s.cardArea, compact && s.cardCompact]}>{pinned}</View> : null}
      <ScrollView ref={thread} testID="ai-conversation-thread" style={s.flex}
        // Before the first word the invitation was the only thing on screen and it hung from the
        // top edge, with half a phone of nothing under it. With nothing to scroll, it sits in the
        // space it has. As soon as there is a thread, the thread starts at the top as threads do.
        contentContainerStyle={[s.thread, p.messages.length === 0 && !p.sentMessage && !p.status && s.threadEmpty]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; }} scrollEventThrottle={100}
        // With no messages the intro is the entire content, and scrolling to the end of it
        // cuts its first line off the top. There is nothing to follow, so stay put.
        onContentSizeChange={() => { if (nearBottom.current && p.messages.length) thread.current?.scrollToEnd({ animated: false }); }}>
        {p.messages.length === 0 && !p.sentMessage ? <View style={s.welcome}>
          <T accessibilityRole="header" variant="title" style={s.welcomeTitle}>{p.welcome}</T>
          {p.welcomeDetail ? <T variant="copy" tone="muted" style={s.welcomeCopy}>{p.welcomeDetail}</T> : null}
          {p.openings?.length && p.canEdit ? <View style={s.openings}>
            {p.openings.map(opening => <Press key={opening} accessibilityRole="button" accessibilityLabel={opening}
              accessibilityHint="Upisuje ovo u poruku da možeš da dopuniš." haptic="select" style={s.opening}
              onPress={() => { p.onChange(opening + ' '); setTyping(true); requestAnimationFrame(() => input.current?.focus()); }}>
              <T variant="meta" style={s.openingText}>{opening}</T></Press>)}
          </View> : null}
        </View> : p.messages.map(message => <ConversationBubble key={message.id} {...message}
          // The motion gate in DESIGN_SKILLS.md is explicit: frequent updates and streamed text get
          // no decorative entrance. A turn that arrives while you are watching is feedback; the
          // thread you already had when the screen opened is not, and must not replay.
          reduced={reduced || seen.current.has(message.id)} />)}
        {/* Until the server read brings it back, what was said is still what was said. Without this
            the thread stayed on "Reci šta ti treba." while the answer streamed in underneath, and
            nothing on screen confirmed the app had heard the person at all. */}
        {p.sentMessage ? <View accessibilityLabel={`Ti: ${p.sentMessage}`} style={[s.message, s.userMessage, s.sending]}>
          <T selectable style={s.userBody}>{p.sentMessage}</T>
        </View> : null}
        {p.streamingText ? <View style={s.message}><T selectable style={s.body}>{p.streamingText}</T></View> : null}
        {/* A spinner beside "Sređujem podatke…" is a progress bar in a conversation. Three dots are
            what a person waiting for an answer already understands. */}
        {p.busy && !p.streamingText ? <View accessibilityLiveRegion="polite" accessibilityLabel="USKOČI piše odgovor" style={s.typing}>
          {[0, 1, 2].map(index => <TypingDot key={index} index={index} reduced={reduced} />)}
        </View> : null}
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
        {draft ? <View style={[s.composer, inputFocused && s.composerFocused]}>
          {p.onAdd ? <Press accessibilityRole="button" accessibilityLabel={p.addLabel ?? 'Dodaj u zadatak'}
            accessibilityState={{ disabled: !!p.addDisabled }} disabled={!!p.addDisabled}
            haptic={p.addDisabled ? 'none' : 'select'} style={[s.composerWell, p.addDisabled && s.disabled]} onPress={p.onAdd}>
            <Plus size={24} color={sys.color.ink} weight="bold" /></Press> : null}
          <TextInput ref={input} accessibilityLabel="Poruka za AI" value={p.value} onChangeText={p.onChange} editable={p.canEdit}
            onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
            placeholder="Napiši šta ti treba…" placeholderTextColor={a.color.muted} multiline maxLength={4000} style={s.input} />
          {p.voice ? <Press accessibilityRole="button" accessibilityLabel="Govori umesto da pišeš" haptic="select" style={s.voiceSwitch}
            onPress={() => { setTyping(false); Keyboard.dismiss(); }}>
            <Microphone size={22} color={sys.color.green} weight="bold" /></Press> : null}
          {showSend ? <Press accessibilityRole="button" accessibilityLabel={p.pending ? 'Ponovi istu poruku' : 'Pošalji poruku'}
            accessibilityState={{ disabled: !p.canSend }} disabled={!p.canSend} onPress={p.onSend}
            haptic={p.canSend ? 'light' : 'none'} style={[s.send, !p.canSend && s.disabled]}>
            <PaperPlaneTilt size={22} weight="fill" color={a.color.surface} /></Press> : null}
        </View> : null}
        {p.voice && !draft ? <View testID="ai-composer-bar" style={s.bar}>
          {p.onAdd ? <Press accessibilityRole="button" accessibilityLabel={p.addLabel ?? 'Dodaj u zadatak'}
            accessibilityState={{ disabled: !!p.addDisabled }} disabled={!!p.addDisabled}
            haptic={p.addDisabled ? 'none' : 'select'} style={[s.barWell, p.addDisabled && s.disabled]} onPress={p.onAdd}>
            <Plus size={24} color={sys.color.ink} weight="bold" /></Press> :
            <Press accessibilityRole="button" accessibilityLabel="Piši umesto da govoriš" haptic="select" style={s.barWell}
              onPress={() => { setTyping(true); requestAnimationFrame(() => input.current?.focus()); }}>
              <KeyboardIcon size={23} color={sys.color.ink} /></Press>}
          <View style={s.barCentre}>{p.voice}</View>
          <View style={s.barRight}>
            {p.onAdd ? <Press accessibilityRole="button" accessibilityLabel="Piši umesto da govoriš" haptic="select" style={s.smallWell}
              onPress={() => { setTyping(true); requestAnimationFrame(() => input.current?.focus()); }}>
              <KeyboardIcon size={21} color={sys.color.ink} /></Press> : null}
            <Press accessibilityRole="button" accessibilityLabel="O govornom unosu i privatnosti" haptic="select" style={s.smallWell}
              onPress={() => Alert.alert('Govorni unos i privatnost', VOICE_PROCESSING_NOTICE)}>
              <Info size={21} color={sys.color.muted} /></Press>
          </View>
        </View> : null}
      </View>
    </KeyboardAvoidingView>
    {p.children}
  </SafeAreaView>;
}

/** One of three dots that rise and fall while an answer is being written. */
function TypingDot({ index, reduced }: { index: number; reduced: boolean }) {
  const life = useSharedValue(0);
  useEffect(() => {
    if (reduced) { life.value = 0.5; return; }
    life.value = withDelay(index * 140, withRepeat(withTiming(1, { duration: 520 }), -1, true));
  }, [index, life, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + life.value * 0.6, transform: [{ translateY: -life.value * 3 }] }));
  return <Animated.View style={[s.dot, style]} />;
}

/**
 * Persisted messages do not rerender for each keystroke or incoming draft chunk.
 *
 * Every turn used to carry a printed role — "USKOČI" over one side, "Ti" over the other — and what
 * the AI had taken was a bordered two-column table underneath, so a conversation read as a form.
 * Side, colour and shape say who is speaking; the labels are for a screen reader, where they belong.
 * What was taken is a row of quiet chips, which is a summary rather than a spreadsheet.
 */
const ConversationBubble = memo(function ConversationBubble({ fromAi, body, understood, reduced }: ConversationMessage & { reduced: boolean }) {
  return <Animated.View entering={reduced ? undefined : FadeInDown.duration(sys.motion.enter).withInitialValues({ transform: [{ translateY: 8 }] })}
    accessibilityLabel={fromAi ? `USKOČI: ${body}` : `Ti: ${body}`}
    style={[s.message, !fromAi && s.userMessage]}>
    <T selectable style={fromAi ? s.body : s.userBody}>{body}</T>
    {understood?.length ? <View accessibilityLabel={`Iz ovoga je uzeto: ${understood.map(item => `${item.label} ${item.value}`).join(', ')}`}
      style={s.understood}>
      {understood.map(item => <View key={item.key} style={s.chip}>
        <T variant="meta" tone="muted" numberOfLines={1}>{item.label}</T>
        <T variant="meta" style={s.chipValue} numberOfLines={1}>{item.value}</T>
      </View>)}
    </View> : null}
  </Animated.View>;
});

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: a.color.surface }, flex: { flex: 1, minHeight: 0 },
  body: { ...sys.type.speech, color: sys.color.ink },
  userBody: { ...sys.type.body, color: sys.color.ink },
  cardArea: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 10 }, cardCompact: { paddingTop: 0, paddingBottom: 8 },
  thread: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 20 },
  threadEmpty: { justifyContent: 'center', paddingBottom: 60 },
  welcome: { gap: 12, paddingTop: 14, paddingBottom: 8, maxWidth: 330 },
  welcomeTitle: { color: sys.color.ink },
  welcomeCopy: { lineHeight: 24 },
  openings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  opening: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: a.color.cardLine, backgroundColor: a.color.wash },
  openingText: { color: a.color.green, fontWeight: '600' },
  message: { gap: 8, alignSelf: 'flex-start', maxWidth: '90%' },
  // What the turn took, as a row of quiet chips rather than a bordered table.
  understood: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'baseline', gap: 5, maxWidth: '100%',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: sys.radius.pill, backgroundColor: a.color.wash },
  chipValue: { color: sys.color.ink, flexShrink: 1 },
  typing: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 8, paddingLeft: 2 },
  dot: { width: 7, height: 7, borderRadius: sys.radius.pill, backgroundColor: a.color.green },
  userMessage: { alignSelf: 'flex-end', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 22, borderBottomRightRadius: 7,
    backgroundColor: a.color.greenSoft, marginLeft: 40 },
  recovery: { gap: 10, padding: 14, borderRadius: sys.radius.control, backgroundColor: a.color.wash },
  actions: { gap: 10 },
  footer: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, gap: 8, backgroundColor: a.color.surface },
  // Text and voice are two states of the same floating composer family. The shell keeps one clear
  // bottom object instead of stacking a text box and a separate microphone stage.
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    minHeight: 64, paddingVertical: 6, paddingHorizontal: 7, borderRadius: 32, backgroundColor: a.color.surface,
    borderWidth: 1, borderColor: a.color.cardLine, shadowColor: a.color.ink, shadowOpacity: 0.08,
    shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  barCentre: { flex: 1, minWidth: 0, alignItems: 'center' },
  barRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barWell: { width: 50, height: 50, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: a.color.wash },
  smallWell: { width: 42, height: 42, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  composerWell: { width: 50, height: 50, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: a.color.wash },
  voiceSwitch: { width: 42, height: 50, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  composer: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', minHeight: 64, borderRadius: 32,
    borderWidth: 1, borderColor: a.color.cardLine, backgroundColor: a.color.surface, paddingVertical: 6, paddingHorizontal: 7,
    shadowColor: a.color.ink, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  composerFocused: { borderColor: a.color.green, shadowOpacity: 0.11 },
  input: { ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: 50, maxHeight: 116, paddingHorizontal: 10, paddingVertical: 12, textAlignVertical: 'top' },
  send: { width: 50, height: 50, borderRadius: sys.radius.pill, backgroundColor: a.color.green, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  /** Sent, not yet confirmed by a read: present and readable, visibly not yet part of the record. */
  sending: { opacity: 0.6 },
});
