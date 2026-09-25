import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUp, DotsThree, Info, Plus, Waveform } from 'phosphor-react-native';
import Animated, { cancelAnimation, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { T } from '../Text';
import { withInter } from '../interFont';
import { Press } from '../Press';
import { BrandMark } from '../entry/BrandAssets';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { useReducedMotion } from '../system/motion';
import { useTextScale } from '../system/textScale';
import { floating, sys } from '../system/tokens';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { HOLD_HINT, VoiceComposer, VoiceMode, VoiceNotice, type VoiceInput } from './VoiceComposer';

export type ConversationMessage = { id: string; fromAi: boolean; body: string };
export type AiConversationShellProps = {
  /** The chrome's title; the chrome draws no line under it (no copy that explains where you are). */ title: string;
  /** The one live card pinned above the thread; null until there is something to pin. */ card: (compact: boolean) => ReactNode;
  messages: readonly ConversationMessage[]; welcome: string; welcomeDetail: string;
  value: string; canEdit: boolean; canSend: boolean; pending: boolean; busy: boolean;
  onChange: (value: string) => void; onSend: () => void; onBack: () => void;
  /** The "···" of rare actions. Left out when there is nothing to offer, so the chrome shows no dead control. */
  onOptions?: () => void;
  status?: ReactNode; actions?: ReactNode; children?: ReactNode;
  /** Speech: the microphone in the composer, the voice mode behind the waveform button. Left out when speech is closed. */
  voice?: VoiceInput;
  /** The "+" at the start of the composer (the task's photos). Left out when there is nothing to attach to. */
  attach?: { label: string; hint?: string; onPress: () => void; disabled?: boolean };
  placeholder?: string;
  /** Openings offered before the first word. 38 of the first 62 conversations never got one. */
  openings?: readonly string[];
  /** A sentence already sent and not yet read back from the server. It belongs on screen. */
  sentMessage?: string | null;
  /** Only real server text deltas belong here. No typewriter animation. */
  streamingText?: string;
};

/**
 * The AI conversation (owner step 6, 2026-09-24, after the owner's Gemini reference): one chrome (the arrow back, the
 * title, "···"), the live card pinned above an independent thread, and a floating composer.
 *
 * - The assistant speaks as plain, large, calm text on white, under a small USKOČI mark; the person's own words are
 *   compact pills on the right in the pale green. Nothing is typed out that has not arrived: streamed text is the
 *   server's own deltas, and while nothing has arrived three dots say that an answer is being written.
 * - The composer is one white pill that floats over the ground with a hairline and the floating shadow: "+" when there
 *   is something to attach, the field, the microphone (held, it sends on release), and on the right the waveform that
 *   opens voice mode while the field is empty, or the round green send once there is text. A send that cannot go now
 *   is drawn disabled and says why, above the pill and to a screen reader.
 *
 * No domain mutations: card, transcript and composer share one bounded surface, and every command is the screen's own.
 */
export function AiConversationShell(p: AiConversationShellProps) {
  const { height } = useWindowDimensions();
  const textScale = useTextScale();
  const [keyboard, setKeyboard] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  // Voice mode opened from the hold advice while the field has a draft starts with the review on, so what is said joins
  // the draft instead of going out as a message of its own.
  const [voiceReview, setVoiceReview] = useState(false);
  const [holdHint, setHoldHint] = useState(false);
  const input = useRef<TextInput>(null);
  const thread = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const reduced = useReducedMotion();
  const notice = useConfirmSheet({ reduced });
  // Everything present on the first render is history; anything after it is news.
  const seen = useRef<Set<string>>(new Set());
  const settled = useRef(false);
  if (!settled.current) { settled.current = true; p.messages.forEach(message => seen.current.add(message.id)); }
  const compact = keyboard || height < 700 || textScale >= 1.5 || p.pending;
  const pinned = p.card(compact);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const phase = p.voice?.state.phase ?? 'IDLE';
  // The advice after a tap goes as soon as the microphone does anything.
  useEffect(() => { if (phase !== 'IDLE') setHoldHint(false); }, [phase]);
  // Speech that closes (the conversation ended, or it cannot take speech any more) takes voice mode with it.
  useEffect(() => { if (!p.voice) setVoiceMode(false); }, [p.voice]);

  const hasText = p.value.trim().length > 0;
  const sendShown = hasText || p.pending;
  const voiceIdle = phase === 'IDLE';
  const sendReason = p.canSend || !sendShown ? null
    : p.pending ? p.busy ? 'Poruka se šalje.' : 'Prethodna poruka čeka ishod. Proveri ga u razgovoru.'
      : !voiceIdle ? 'Završi govor pa pošalji.' : p.busy ? 'Sačekaj da stigne odgovor.' : 'Poruku sada ne možeš da pošalješ.';
  const privacy = () => notice.ask({ title: 'Govorni unos i privatnost', message: VOICE_PROCESSING_NOTICE, confirmLabel: 'U redu', cancelLabel: null });

  // Voice mode shows the last exchange: what the person said last and the answer to it, or the answer being written.
  const last = p.messages.at(-1), beforeLast = p.messages.at(-2);
  const answer = p.streamingText || (!p.sentMessage && last?.fromAi ? last.body : null);
  const said = p.sentMessage ?? (last && !last.fromAi ? last.body : last?.fromAi && beforeLast && !beforeLast.fromAi ? beforeLast.body : null);

  return <SafeAreaView edges={['top']} style={s.canvas}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenChrome variant="detail" onBack={p.onBack} title={p.title}
        right={p.onOptions ? <ChromeIconButton label="Opcije" hint="Opcije razgovora." icon={DotsThree} onPress={p.onOptions} /> : undefined} />
      {/* Before the first word there is no draft to pin, and an empty card pushed the one invitation on the screen
          below the fold. The caller returns null until it has something. */}
      {pinned ? <View testID="ai-pinned-card" style={[s.cardArea, compact && s.cardAreaCompact]}>{pinned}</View> : null}
      <ScrollView ref={thread} testID="ai-conversation-thread" style={s.flex}
        // Before the first word the invitation is the only thing on screen, so it sits in the space it has. As soon as
        // there is a thread, the thread starts at the top as threads do.
        contentContainerStyle={[s.thread, p.messages.length === 0 && !p.sentMessage && !p.status && s.threadEmpty]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        onScroll={event => { const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80; }} scrollEventThrottle={100}
        // With no messages the intro is the entire content, and scrolling to its end cuts its first line off the top.
        onContentSizeChange={() => { if (nearBottom.current && p.messages.length) thread.current?.scrollToEnd({ animated: false }); }}>
        {p.messages.length === 0 && !p.sentMessage ? <View style={s.welcome}>
          <AssistantPresence reduced={reduced} />
          <T accessibilityRole="header" variant="title" style={s.welcomeTitle}>{p.welcome}</T>
          {p.welcomeDetail ? <T variant="copy" tone="muted" style={s.welcomeCopy}>{p.welcomeDetail}</T> : null}
          {p.openings?.length && p.canEdit ? <View style={s.openings}>
            {p.openings.map(opening => <Press key={opening} accessibilityRole="button" accessibilityLabel={opening}
              accessibilityHint="Upisuje ovo u poruku da možeš da dopuniš." haptic="select" style={s.opening}
              onPress={() => { p.onChange(opening + ' '); requestAnimationFrame(() => input.current?.focus()); }}>
              <T variant="meta" style={s.openingText}>{opening}</T></Press>)}
          </View> : null}
          {/* The speech disclosure is reachable before the first word, and from voice mode at any time. */}
          {p.voice ? <Press accessibilityRole="button" accessibilityLabel="O govornom unosu i privatnosti" haptic="select"
            onPress={privacy} style={s.privacy}>
            <Info size={16} color={sys.color.muted} /><T variant="meta" tone="muted">O govornom unosu i privatnosti</T>
          </Press> : null}
        </View> : p.messages.map(message => <Turn key={message.id} {...message}
          // Frequent updates and streamed text get no decorative entrance. A turn that arrives while you are watching is
          // feedback; the thread you already had when the screen opened is not, and must not replay.
          reduced={reduced || seen.current.has(message.id)} />)}
        {/* Until the server read brings it back, what was said is still what was said: present, readable, and visibly
            not yet part of the record. */}
        {p.sentMessage ? <View accessibilityLabel={`Ti, šalje se: ${p.sentMessage}`} style={[s.person, s.sending]}>
          <T selectable style={s.personText}>{p.sentMessage}</T>
        </View> : null}
        {p.streamingText ? <View style={s.assistant}><Mark /><T selectable style={s.answer}>{p.streamingText}</T></View> : null}
        {/* Three dots are what a person waiting for an answer already understands; they stop under reduced motion. */}
        {p.busy && !p.streamingText ? <View accessibilityLiveRegion="polite" accessibilityLabel="USKOČI piše odgovor" style={s.assistant}>
          <Mark />
          <View style={s.typing}>{[0, 1, 2].map(index => <TypingDot key={index} index={index} reduced={reduced} />)}</View>
        </View> : null}
        {/* Recovery belongs to scrollable content, not a second fixed footer. */}
        {p.status ? <View testID="ai-recovery-in-thread" style={s.recovery}>{p.status}</View> : null}
        {p.actions ? <View style={s.actions}>{p.actions}</View> : null}
      </ScrollView>
      {/* Above the keyboard the composer needs no inset of its own; without it, the gesture bar is the phone's. No tab bar
          is drawn under a conversation (`_layout`), so this is the composer's own inset on both conversations. */}
      <SafeAreaView edges={keyboard ? [] : ['bottom']} testID="ai-composer-footer" style={s.footer}>
        {/* The hold advice carries the way to speak without holding (review r4 ra item 7): once the field has text the
            waveform button gives way to send, and a person who cannot hold would otherwise have no speech at all. */}
        {p.voice ? <VoiceNotice {...p.voice} hint={holdHint ? HOLD_HINT : null}
          hintAction={holdHint && !p.voice.disabled && voiceIdle ? { label: 'Govori bez držanja', onPress: () => {
            Keyboard.dismiss(); setHoldHint(false); setVoiceReview(hasText); setVoiceMode(true); } } : undefined} /> : null}
        {/* When the thread's own recovery note already explains the wait, the line here would say it twice; the send
            button still says it to a screen reader. */}
        {sendReason && voiceIdle && !p.status ? <T testID="ai-send-reason" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          variant="note" tone="muted" style={s.reason}>{sendReason}</T> : null}
        <View testID="ai-composer" style={[s.pill, floating]}>
          {p.attach ? <Press accessibilityRole="button" accessibilityLabel={p.attach.label} accessibilityHint={p.attach.hint}
            accessibilityState={{ disabled: !!p.attach.disabled }} disabled={p.attach.disabled} haptic={p.attach.disabled ? 'none' : 'select'}
            hitSlop={0} onPress={p.attach.onPress} style={s.target}>
            <Plus size={22} color={p.attach.disabled ? sys.color.muted : sys.color.ink} />
          </Press> : null}
          <TextInput ref={input} accessibilityLabel="Poruka za AI" value={p.value} editable={p.canEdit}
            onChangeText={text => { setHoldHint(false); p.onChange(text); }}
            placeholder={p.placeholder ?? 'Napiši poruku'} placeholderTextColor={sys.color.muted} multiline maxLength={4000}
            // A field that cannot be edited now says so in its ink: the words in it are held, not a draft to change.
            style={[s.input, !p.attach && s.inputFirst, !p.canEdit && s.inputOff]} />
          {p.voice ? <VoiceComposer {...p.voice} onTooShort={() => setHoldHint(true)} /> : null}
          {sendShown ? <Press testID="ai-send" accessibilityRole="button" accessibilityLabel={p.pending ? 'Ponovi istu poruku' : 'Pošalji poruku'}
            accessibilityHint={sendReason ?? undefined} accessibilityState={{ disabled: !p.canSend }} disabled={!p.canSend}
            onPress={p.onSend} haptic={p.canSend ? 'light' : 'none'} hitSlop={0} style={s.target}>
            <View style={[s.round, s.send, !p.canSend && s.roundOff]}>
              <ArrowUp size={22} weight="bold" color={p.canSend ? sys.color.onGreen : sys.color.muted} /></View>
          </Press> : p.voice ? <Press testID="ai-voice-mode" accessibilityRole="button" accessibilityLabel="Razgovaraj glasom"
            accessibilityHint="Govoriš umesto da kucaš; odgovor stiže kao tekst."
            accessibilityState={{ disabled: p.voice.disabled || !voiceIdle }} disabled={p.voice.disabled || !voiceIdle}
            haptic="select" hitSlop={0} onPress={() => { Keyboard.dismiss(); setVoiceReview(false); setVoiceMode(true); }} style={s.target}>
            <View style={[s.round, s.voiceRound, (p.voice.disabled || !voiceIdle) && s.roundOff]}>
              <Waveform size={22} weight="bold" color={p.voice.disabled || !voiceIdle ? sys.color.muted : sys.color.green} /></View>
          </Press> : null}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
    {voiceMode && p.voice ? <VoiceMode voice={p.voice} prompt={p.welcome} answer={answer} said={said}
      thinking={p.busy && !p.streamingText} reviewFirst={voiceReview}
      onClose={reason => { setVoiceMode(false); if (reason === 'review') requestAnimationFrame(() => input.current?.focus()); }} /> : null}
    {p.children}
    {notice.sheet}
  </SafeAreaView>;
}

/** The small USKOČI mark that says who is speaking; a screen reader hears the turn's own label instead. */
function Mark() {
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.mark}><BrandMark size={20} /></View>;
}

/**
 * The assistant, present before the first word: the brand mark on a soft disc that breathes — a slow, small swell, the
 * way something alive and waiting does. Gate: the welcome is seen once per conversation, so it may carry this; purpose:
 * state indication, "somebody is here and listening". Under reduced motion it holds still.
 */
function AssistantPresence({ reduced }: { reduced: boolean }) {
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced) { cancelAnimation(breath); breath.set(0); return; }
    breath.set(withRepeat(withTiming(1, { duration: 1800 }), -1, true));
    return () => cancelAnimation(breath);
  }, [breath, reduced]);
  const halo = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breath.get() * 0.08 }], opacity: 0.55 + breath.get() * 0.45 }));
  return <View importantForAccessibility="no-hide-descendants" style={s.presence}>
    {/* Under reduced motion the halo is a plain view: nothing here animates. */}
    {reduced ? <View style={s.presenceHalo} /> : <Animated.View style={[s.presenceHalo, halo]} />}
    <View style={s.presenceDisc}><BrandMark size={40} /></View>
  </View>;
}

/** One of three dots that rise and fall while an answer is being written. */
function TypingDot({ index, reduced }: { index: number; reduced: boolean }) {
  const life = useSharedValue(0);
  useEffect(() => {
    if (reduced) { cancelAnimation(life); life.set(0.5); return; }
    life.set(withDelay(index * 140, withRepeat(withTiming(1, { duration: 520 }), -1, true)));
    return () => cancelAnimation(life);
  }, [index, life, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + life.get() * 0.6, transform: [{ translateY: reduced ? 0 : -life.get() * 3 }] }));
  return reduced ? <View style={[s.dot, s.dotStill]} /> : <Animated.View style={[s.dot, style]} />;
}

/**
 * One turn. The assistant's is plain text under the mark, the width of the thread; the person's is a pill on the right.
 * Persisted turns do not rerender for each keystroke or incoming chunk. Side, colour and shape say who is speaking; the
 * labels are for a screen reader.
 */
const Turn = memo(function Turn({ fromAi, body, reduced }: ConversationMessage & { reduced: boolean }) {
  const entering = reduced ? undefined : FadeInDown.duration(sys.motion.enter).withInitialValues({ transform: [{ translateY: 8 }] });
  return fromAi
    ? <Animated.View entering={entering} accessibilityLabel={`USKOČI: ${body}`} style={s.assistant}>
      <Mark /><T selectable style={s.answer}>{body}</T></Animated.View>
    : <Animated.View entering={entering} accessibilityLabel={`Ti: ${body}`} style={s.person}>
      <T selectable style={s.personText}>{body}</T></Animated.View>;
});

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.surface }, flex: { flex: 1, minHeight: 0 },
  cardArea: { paddingHorizontal: sys.space.lg, paddingTop: 2, paddingBottom: sys.space.md },
  cardAreaCompact: { paddingTop: 0, paddingBottom: sys.space.sm },
  thread: { flexGrow: 1, paddingHorizontal: sys.space.lg, paddingTop: sys.space.sm, paddingBottom: sys.space.xl, gap: sys.space.xl },
  threadEmpty: { justifyContent: 'center', paddingBottom: 60 },
  welcome: { gap: sys.space.md, paddingTop: 14, paddingBottom: sys.space.sm, maxWidth: 360 },
  presence: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  presenceHalo: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: sys.color.greenSoft },
  presenceDisc: { width: 64, height: 64, borderRadius: 32, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center', ...sys.elevation.soft },
  welcomeTitle: { ...sys.type.hero, color: sys.color.green },
  welcomeCopy: { lineHeight: 24 },
  openings: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, marginTop: 2 },
  // An opening is an action that is not the screen's primary: white with a green label and the hairline.
  opening: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.cardLine, backgroundColor: sys.color.surface },
  openingText: { color: sys.color.green, fontWeight: '600' },
  privacy: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  // The assistant: plain, large and calm, the whole width of the thread, no bubble.
  assistant: { gap: 8, alignSelf: 'stretch' },
  mark: { width: 20, height: 21 },
  // The type scale's own voice for a sentence said in the conversation (review r4 ra item 11; it was a raw 17/27).
  answer: { ...sys.type.speech, color: sys.color.ink },
  // The person: a compact pill on the right, in the pale green.
  person: { alignSelf: 'flex-end', maxWidth: '85%', marginLeft: 40, paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: sys.radius.card, backgroundColor: sys.color.greenSoft },
  personText: { ...sys.type.body, color: sys.color.ink },
  /** Sent, not yet confirmed by a read: present and readable, visibly not yet part of the record. */
  sending: { opacity: 0.6 },
  // One line of the answer's type (`speech`, 26), so the dots sit where the first line of the answer will.
  typing: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 26, paddingLeft: 2 },
  dot: { width: 7, height: 7, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  dotStill: { opacity: 0.55 },
  recovery: { gap: 10, padding: 14, borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  actions: { gap: 10 },
  footer: { paddingHorizontal: sys.space.md, paddingTop: sys.space.xs, paddingBottom: sys.space.sm, gap: sys.space.sm, backgroundColor: sys.color.surface },
  reason: { paddingHorizontal: sys.space.sm },
  // The floating composer: a white pill with the hairline and the floating shadow, its controls on 48 px targets.
  pill: { flexDirection: 'row', alignItems: 'flex-end', minHeight: 56, paddingHorizontal: 4, paddingVertical: 4,
    borderRadius: sys.radius.sheet, borderWidth: 1, borderColor: sys.color.cardLine, backgroundColor: sys.color.surface },
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: withInter({ ...sys.type.body, color: sys.color.ink, flex: 1, minWidth: 0, minHeight: 48, maxHeight: 132,
    paddingHorizontal: 4, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' }),
  inputFirst: { paddingLeft: 12 },
  inputOff: { color: sys.color.muted },
  round: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  send: { backgroundColor: sys.color.green },
  voiceRound: { backgroundColor: sys.color.greenSoft },
  // Disabled is a quiet wash with a muted glyph, never a faded ghost of the live control.
  roundOff: { backgroundColor: sys.color.wash },
});
