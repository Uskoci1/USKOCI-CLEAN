import type { ReactElement, ReactNode, Ref } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type RefreshControlProps,
  type ScrollView as ScrollViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, Check, PaperPlaneTilt } from 'phosphor-react-native';
import type { SupportChannel, SupportStatus } from '../../data/supportCaseTypes';
import { vreme } from '../../lib/vreme';
import { InlineNote, QuietLine } from '../privacy/InlineNote';
import { Press } from '../Press';
import { SettingsAction, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { cardCompact, field, inset, sys } from '../system/tokens';

const supportLabels = {
  RECEIVED: 'Zahtev je primljen', IN_REVIEW: 'U obradi', WAITING_FOR_AUTHOR: 'Čeka tvoju dopunu',
  DECIDED: 'Odgovor sa odlukom', CLOSED: 'Predmet je zatvoren',
  SERVICE: 'USKOČI podrška', TASK: 'Pomoć oko zadatka', LEGAL_PRIVACY: 'Sadržaj i privatnost', SAFETY: 'Privatna bezbednosna prijava',
  TECHNICAL: 'Tehnička pomoć', SERVICE_COMPLAINT: 'Reklamacija na USKOČI uslugu', OTHER: 'Drugo',
  COLLABORATION: 'Pomoć oko saradnje', NO_SHOW: 'Prijava nedolaska', PUBLICATION_REVIEW: 'Pregled odluke o objavi',
  CONTENT_NOTICE: 'Prijava sadržaja ili recenzije', PRIVACY_RIGHTS: 'Privatnost i prava', SAFETY_REPORT: 'Bezbednost',
  AUTHOR: 'Podnosilac', OPERATOR: 'Operater', SYSTEM: 'USKOČI',
  CREATED: 'Zahtev je primljen', CREATE: 'Zahtev je primljen', AUTHOR_REPLY: 'Dopuna zahteva',
  CLAIM: 'Predmet je preuzet', OPERATOR_REPLY: 'Odgovor operatera', REQUEST_INFO: 'Zahtev za dopunu',
  DECIDE: 'Odluka o zahtevu', APPEAL: 'Zahtev za ponovni pregled', CLAIM_APPEAL: 'Ponovni pregled je preuzet',
  DECIDE_APPEAL: 'Odluka posle ponovnog pregleda', CLOSE: 'Predmet je zatvoren',
  ACCEPTED: 'Zahtev je prihvaćen', REJECTED: 'Zahtev je odbijen',
} as const;
export const supportLabel = (value: string) => supportLabels[value as keyof typeof supportLabels] ?? 'Događaj u predmetu';
export function supportTime(value: string) {
  return vreme(value, { inace: 'Vreme nije dostupno' });
}

export function SupportFrame({ title, onBack, children, footer }: {
  title: string; onBack: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return <KeyboardAvoidingView style={supportStyles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SettingsScreen title={title} onBack={onBack} footer={footer}>{children}</SettingsScreen>
  </KeyboardAvoidingView>;
}

/**
 * The conversation frame of one case: the detail chrome (arrow, the case's own title, its number under it), a strip with
 * its state, the thread, and the composer area pinned under it. The keyboard lifts the composer as on Poruke.
 */
export function SupportThreadFrame({ title, subtitle, onBack, strip, refresh, scrollRef, onContentSizeChange, composer, children }: {
  title: string; subtitle?: string; onBack: () => void; strip?: ReactNode;
  refresh?: ReactElement<RefreshControlProps>; scrollRef?: Ref<ScrollViewType>;
  onContentSizeChange?: (width: number, height: number) => void; composer?: ReactNode; children: ReactNode;
}) {
  return <SafeAreaView edges={['top', 'bottom']} style={supportStyles.screen}>
    <KeyboardAvoidingView style={supportStyles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenChrome variant="detail" onBack={onBack} title={title} subtitle={subtitle} />
      {strip ? <View style={supportStyles.strip}>{strip}</View> : null}
      <ScrollView ref={scrollRef} style={supportStyles.fill} contentContainerStyle={supportStyles.thread} keyboardShouldPersistTaps="handled"
        refreshControl={refresh} onContentSizeChange={onContentSizeChange}>{children}</ScrollView>
      {composer ? <View style={supportStyles.composerArea}>{composer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** A note in the flow. `info` is the quiet wash, `warn` waits for the person, `danger` failed. Never a card. */
export function SupportNote({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'danger'; children: ReactNode }) {
  return <InlineNote tone={tone === 'info' ? 'neutral' : tone} alert={tone !== 'info'}>{children}</InlineNote>;
}
/** The older name of the same note, kept for the callers that say `error`. */
export function SupportNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <SupportNote tone={error ? 'danger' : 'info'}>{children}</SupportNote>;
}
export function SupportLoading() {
  return <StateView kind="loading" title="Učitavamo sačuvano stanje…" skeleton={{ count: 3, rows: 2 }} />;
}
export function SupportPrivacy({ safety = false }: { safety?: boolean }) {
  return <QuietLine art="shield">{safety
    ? 'Ovaj predmet je privatan. Prijavljena osoba i grupa ne dobijaju sadržaj tvoje prijave.'
    : 'Zahtev vide podnosilac i posebno ovlašćeni operater. Sadržaj se ne prosleđuje drugoj strani u saradnji.'}</QuietLine>;
}
export function SupportField({ label, value, onChange, maximum, disabled = false, multiline = false, optional = false }: {
  label: string; value: string; onChange: (value: string) => void; maximum: number; disabled?: boolean; multiline?: boolean; optional?: boolean;
}) {
  const count = Array.from(value).length, invalid = count > maximum;
  // The count is noise until it matters: it appears from 80% of the limit, and always when the text is too long.
  const counted = invalid || count >= maximum * 0.8;
  return <View style={supportStyles.field}>
    <T variant="bodyStrong">{label}{optional ? ' (opciono)' : ''}</T>
    <TextInput accessibilityLabel={label} accessibilityHint={`Najviše ${maximum} znakova`} value={value}
      onChangeText={onChange} editable={!disabled} multiline={multiline} maxLength={maximum * 2}
      autoCapitalize="sentences" textAlignVertical={multiline ? 'top' : 'center'} placeholderTextColor={sys.color.muted}
      style={[supportStyles.input, multiline && supportStyles.multiline, invalid && supportStyles.invalid, disabled && supportStyles.inputDisabled]} />
    {counted ? <T variant="meta" tone={invalid ? 'danger' : 'muted'} accessibilityLiveRegion={invalid ? 'polite' : 'none'}>
      {count} / {maximum}{invalid ? ' · Skrati tekst pre slanja.' : ''}
    </T> : null}
  </View>;
}
export function SupportRecovery({ busy, absent, onRead, onCancel, onReplay }: {
  busy: boolean; absent: boolean; onRead: () => void; onCancel: () => void; onReplay?: () => void;
}) {
  return <View style={supportStyles.recovery}>
    <InlineNote tone="warn" alert>
      <T variant="bodyStrong" accessibilityRole="header">Najpre proveri prethodno slanje</T>
      <T variant="note">{absent ? 'Potvrda još nije pronađena. Prethodni zahtev i dalje može da stigne.'
        : 'Ishod prethodne radnje nije potvrđen. Novo slanje je zaustavljeno dok ne proveriš stanje.'}</T>
      <T variant="note" tone="muted">Provera ne šalje ponovo tekst. Zaustavljanje važi samo za ovu radnju; ne briše ranije primljen predmet.</T>
    </InlineNote>
    <View style={supportStyles.recoveryActions}>
      <SettingsAction kind="secondary" label="Proveri ishod" disabled={busy} onPress={onRead} />
      <SettingsAction label="Zaustavi prethodno slanje" kind="quiet" disabled={busy} onPress={onCancel} />
      {onReplay ? <SettingsAction label="Ponovi isto slanje" kind="quiet" disabled={busy} onPress={onReplay} /> : null}
    </View>
  </View>;
}

/**
 * The state of a case as a small chip: the words, on a tint that matches them. Waiting for the person is the one orange
 * tint (it asks something of them); in progress and decided are green; received and closed are quiet.
 */
const chipTone: Record<SupportStatus, { ground: string; ink: string }> = {
  RECEIVED: { ground: sys.color.wash, ink: sys.color.muted }, IN_REVIEW: { ground: sys.color.greenSoft, ink: sys.color.green },
  WAITING_FOR_AUTHOR: { ground: sys.color.orangeSoft, ink: sys.color.waitingInk }, DECIDED: { ground: sys.color.greenSoft, ink: sys.color.green },
  CLOSED: { ground: sys.color.wash, ink: sys.color.muted },
};
export function SupportStatusChip({ status }: { status: SupportStatus }) {
  const tone = chipTone[status] ?? chipTone.RECEIVED;
  return <View style={[supportStyles.chip, { backgroundColor: tone.ground }]}>
    <T variant="meta" style={[supportStyles.chipText, { color: tone.ink }]}>{supportLabel(status)}</T>
  </View>;
}

const channelArt: Record<SupportChannel, FactArtKind> = { SERVICE: 'chat', TASK: 'agreements', LEGAL_PRIVACY: 'shield', SAFETY: 'lock' };
/**
 * One request in the list: what it is about (the name), its state and when it last moved; the case number is said, not
 * shown (support uses it; a person recognises the topic). News is an orange dot and the word "novo", never colour alone.
 */
export function SupportCaseRow({ topic, status, channel, time, caseNumber, unread, disabled, last, onPress }: {
  topic: string; status: SupportStatus; channel: SupportChannel; time: string; caseNumber: string; unread: boolean;
  disabled: boolean; last: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={`${topic}, ${supportLabel(status)}${unread ? ', novo' : ''}, ${time}, zahtev #${caseNumber}`}
    accessibilityState={{ disabled }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={0.99} onPress={onPress}
    style={[supportStyles.caseRow, !last && supportStyles.rowLine, disabled && supportStyles.faded]}>
    <View style={supportStyles.caseArt}><FactArt kind={channelArt[channel] ?? 'chat'} size={26} /></View>
    <View style={supportStyles.caseCopy}>
      <T variant="bodyStrong" numberOfLines={2}>{topic}</T>
      <View style={supportStyles.caseMeta}>
        <SupportStatusChip status={status} />
        <T variant="meta" tone="muted" style={supportStyles.tabular}>{time}</T>
      </View>
    </View>
    <View style={supportStyles.caseEnd}>
      {unread ? <View style={supportStyles.unread} /> : null}
      <CaretRight size={18} color={sys.color.muted} />
    </View>
  </Press>;
}

/**
 * One choice among several: a radio (one topic, one outcome) or a checkbox (which evidence). The control is drawn, the
 * state is spoken, and the whole row is the touch target (at least 56 high).
 */
export function SupportChoiceRow({ kind, label, detail, selected, disabled = false, last = false, onPress }: {
  kind: 'radio' | 'check'; label: string; detail?: string; selected: boolean; disabled?: boolean; last?: boolean; onPress: () => void;
}) {
  const radio = kind === 'radio';
  return <Press accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityLabel={label} accessibilityHint={detail}
    accessibilityState={{ checked: selected, disabled }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={0.99}
    onPress={onPress} style={[supportStyles.choice, !last && supportStyles.rowLine, disabled && supportStyles.faded]}>
    <View style={[radio ? supportStyles.radio : supportStyles.check, selected && (radio ? supportStyles.radioOn : supportStyles.checkOn)]}>
      {selected ? radio ? <View style={supportStyles.radioDot} /> : <Check size={14} weight="bold" color={sys.color.onGreen} /> : null}
    </View>
    <View style={supportStyles.choiceCopy}>
      <T variant={selected ? 'bodyStrong' : 'body'}>{label}</T>
      {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    </View>
  </Press>;
}

/**
 * One message of the case. Mine sits on the right on the pale green, the other side's on the left on white with the
 * card's edge, as on Poruke; a run of one author keeps close, a turn opens a little air.
 */
export function SupportBubble({ mine, sender, kindLabel, body, time, first, children }: {
  mine: boolean; sender?: string; kindLabel?: string; body: string; time: string; first: boolean; children?: ReactNode;
}) {
  return <View style={[supportStyles.bubbleColumn, mine ? supportStyles.mineColumn : supportStyles.theirsColumn, { marginTop: first ? 12 : 4 }]}>
    {sender && !mine && first ? <T variant="meta" tone="muted" style={supportStyles.sender}>{sender}</T> : null}
    <View style={[supportStyles.bubble, mine ? supportStyles.mine : supportStyles.theirs]}>
      {kindLabel ? <T variant="meta" tone="muted">{kindLabel}</T> : null}
      <T selectable style={supportStyles.bubbleText}>{body}</T>
      <T variant="meta" tone="muted" style={supportStyles.bubbleTime}>{time}</T>
    </View>
    {children}
  </View>;
}
/** A change of state in the thread, said once and quietly in the middle. */
export function SupportSystemLine({ children }: { children: string }) {
  return <T variant="meta" tone="muted" style={supportStyles.system}>{children}</T>;
}
/** A decision where it happened: a block across the thread, its outcome in words, and what it does not change. */
export function SupportDecisionBlock({ reconsideration, outcome, explanation, time, children }: {
  reconsideration: boolean; outcome: string; explanation: string; time: string; children?: ReactNode;
}) {
  return <View style={supportStyles.decision}>
    <View style={supportStyles.decisionHead}><FactArt kind="document" size={22} />
      <T variant="bodyStrong" accessibilityRole="header" style={supportStyles.grow}>{reconsideration ? 'Odluka posle ponovnog pregleda' : 'Odluka o zahtevu'}</T></View>
    <T variant="bodyStrong">{supportLabel(outcome)}</T>
    <T selectable>{explanation}</T>
    <T variant="note" tone="muted">{time}</T>
    {reconsideration ? <T variant="note" tone="muted">Ponovni pregled u okviru podrške. Originalna odluka ostaje u istoriji.</T> : null}
    <T variant="note" tone="muted">Ova odluka o zahtevu sama ne menja Zadatak, Dogovor, novčani iznos ili ocenu.</T>
    {children}
  </View>;
}

/**
 * The reply field of a case: the pill of Poruke (copied, not imported: the conversation belongs to another unit) with
 * the text and a 48 px send area. The send is green only when there is something to send; otherwise a grey well that
 * says why.
 */
export function SupportComposer({ value, onChange, placeholder, editable, canSend, sending, onSend }: {
  value: string; onChange: (value: string) => void; placeholder: string; editable: boolean; canSend: boolean; sending: boolean; onSend: () => void;
}) {
  const empty = !value.trim();
  return <View style={supportStyles.pill}>
    <TextInput accessibilityLabel="Tekst poruke" placeholder={placeholder} placeholderTextColor={sys.color.muted} value={value}
      onChangeText={onChange} editable={editable} multiline textAlignVertical="center" style={supportStyles.pillInput} />
    <Press accessibilityRole="button" accessibilityLabel="Pošalji poruku" accessibilityHint={empty ? 'Unesi tekst pre slanja.' : undefined}
      accessibilityState={{ disabled: !canSend || sending, busy: sending }} disabled={!canSend || sending} haptic={canSend ? 'light' : 'none'}
      onPress={onSend} style={supportStyles.sendArea}>
      <View style={[supportStyles.send, canSend || sending ? supportStyles.sendOn : supportStyles.sendOff]}>
        {sending ? <ActivityIndicator size="small" color={sys.color.onGreen} />
          : <PaperPlaneTilt size={20} weight="fill" color={canSend ? sys.color.onGreen : sys.color.muted} />}
      </View>
    </Press>
  </View>;
}

export const supportStyles = StyleSheet.create({
  fill: { flex: 1 }, grow: { flex: 1, minWidth: 0 }, center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: sys.color.ground },
  strip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  thread: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexGrow: 1, justifyContent: 'flex-end', gap: 0 },
  composerArea: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 10, gap: 8, backgroundColor: sys.color.surface,
    borderTopWidth: 1, borderTopColor: sys.color.line },
  field: { gap: 8, marginBottom: 20 },
  input: { ...field },
  inputDisabled: { backgroundColor: sys.color.wash },
  multiline: { minHeight: 144 }, invalid: { borderColor: sys.color.danger },
  row: { gap: 6, paddingVertical: 12 },
  recovery: { gap: 8 },
  recoveryActions: { gap: 4 },
  chip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: sys.radius.pill },
  chipText: { fontWeight: '600' },
  tabular: { fontVariant: ['tabular-nums'] },
  caseRow: { minHeight: 72, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: sys.color.line },
  faded: { opacity: 0.45 },
  caseArt: { width: 40, height: 40, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' },
  caseCopy: { flex: 1, minWidth: 0, gap: 6 },
  caseMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  caseEnd: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unread: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  choice: { minHeight: 56, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  choiceCopy: { flex: 1, minWidth: 0, gap: 2 },
  radio: { width: 22, height: 22, borderRadius: sys.radius.pill, borderWidth: 2, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: sys.color.green },
  radioDot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  check: { width: 22, height: 22, borderRadius: sys.radius.check, borderWidth: 2, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: sys.color.green, borderColor: sys.color.green },
  bubbleColumn: { maxWidth: '82%', gap: 4 },
  mineColumn: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirsColumn: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { paddingHorizontal: 4 },
  bubble: { borderRadius: sys.radius.card, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, gap: 4 },
  mine: { backgroundColor: sys.color.greenSoft, borderBottomRightRadius: 8 },
  theirs: { backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine, borderBottomLeftRadius: 8 },
  bubbleText: { ...sys.type.body, color: sys.color.ink, lineHeight: 22 },
  bubbleTime: { alignSelf: 'flex-end', fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  system: { textAlign: 'center', marginVertical: 8 },
  decision: { ...cardCompact, gap: 8, marginTop: 12 },
  decisionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { ...inset, backgroundColor: sys.color.wash, gap: 8, marginBottom: 4 },
  pill: { flexDirection: 'row', alignItems: 'flex-end', padding: 4, borderRadius: sys.radius.sheet, backgroundColor: sys.color.wash },
  pillInput: { flex: 1, minHeight: 48, maxHeight: 140, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    ...sys.type.body, lineHeight: 22, color: sys.color.ink },
  sendArea: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  sendOn: { backgroundColor: sys.color.green },
  sendOff: { backgroundColor: sys.color.control },
  pager: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  list: { borderTopWidth: 1, borderTopColor: sys.color.line },
});
