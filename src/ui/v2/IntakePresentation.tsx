import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { NeedTaskGeography } from '../../contracts/needFactsV2';
import { safetyMessage } from '../../data/aiNeedV2Ui';
import { calendarInstant } from '../../lib/calendarTime';
import { displayDate, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';
import { v2 } from './tokens';
import { AiConversationShell } from '../aiFirst/AiConversationShell';
import { aiFirst as a } from '../aiFirst/tokens';

type Props = {
  conversation: AiNeedV2Conversation; value: string; busy: boolean; error: string | null;
  canSubmit: boolean; canEdit: boolean; canReview: boolean; reviewLabel: string;
  pending: boolean; statusCopy: string | null; showReadback: boolean; readbackDisabled: boolean;
  showAbandon: boolean; abandonDisabled: boolean; abandonLabel: string;
  onBack: () => void; onChange: (value: string) => void; onSend: () => void;
  onReview: () => void; onRefresh: () => void; onAbandon: () => void;
  onNewTask?: () => void; newTaskDisabled?: boolean; voice?: ReactNode; streamingText?: string;
};

const schedules: Record<string, string> = { FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Bilo kada',
  TODAY_FLEXIBLE: 'Danas', TOMORROW_FLEXIBLE: 'Sutra', WEEK_FLEXIBLE: 'Ove nedelje' };
function fixedRange(startsAt: unknown, endsAt: unknown): string | undefined {
  const start = calendarInstant(startsAt), end = calendarInstant(endsAt);
  if (start === null || end === null || end <= start) return undefined;
  try {
    // Existing candidate presentation zone, display-only; never inferred or saved
    // as the task's timezone. The label makes this explicit for other countries.
    const from = zonedParts(new Date(Number(start / 1000n)), 'Europe/Belgrade');
    const to = zonedParts(new Date(Number(end / 1000n)), 'Europe/Belgrade');
    return `${displayDate(from.date)} · ${from.time.slice(0, 5)}–${from.date === to.date ? '' : `${displayDate(to.date)} · `}${to.time.slice(0, 5)} (vreme u Beogradu)`;
  } catch { return undefined; }
}
function publicSummary(facts: AiNeedV2Fact[]) {
  // A compact public projection has an explicit field allowlist. Never use the
  // private exact address, access notes, resolved points or arbitrary displayValue.
  const value = (key: AiNeedV2Fact['key']) => facts.find(fact => fact.key === key && fact.privacyClass === 'PUBLIC')?.value;
  const title = value('need.title'), geography = value('need.task_geography') as NeedTaskGeography | undefined;
  const mode = value('need.price_mode'), amount = value('need.price_rsd'), people = value('need.people_needed');
  const schedule = value('need.schedule_kind');
  const zone = geography?.mode === 'REMOTE' ? 'Na daljinu' : [geography?.start?.city ?? geography?.serviceArea?.city,
    geography?.start?.area ?? geography?.serviceArea?.area].filter(item => typeof item === 'string' && item.trim()).join(' · ');
  return { title: typeof title === 'string' ? title : 'Zadatak u nastajanju', zone,
    schedule: schedule === 'FIXED_WINDOW' ? fixedRange(value('need.starts_at'), value('need.ends_at'))
      : typeof schedule === 'string' ? schedules[schedule] : undefined,
    price: mode === 'OFFERS' ? 'Tražim ponude' : mode === 'MY_PRICE' && typeof amount === 'number' ? `${amount.toLocaleString('sr-Latn-RS')} RSD` : null,
    people: typeof people === 'number' ? `${people} ${people % 100 >= 11 && people % 100 <= 14 ? 'osoba'
      : people % 10 >= 2 && people % 10 <= 4 ? 'osobe' : 'osoba'}` : null };
}

function Panel({ title, children, close, reduced }: { title: string; children: ReactNode; close: () => void; reduced: boolean }) {
  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={close}>
    <View style={s.scrim}>
      <Press accessibilityRole="button" accessibilityLabel="Zatvori panel" onPress={close} style={{ flex: 1, minHeight: 44 }} />
      <SafeAreaView edges={['bottom']} accessibilityViewIsModal style={s.sheet}>
        <View style={s.row}><T accessibilityRole="header" style={[s.title, { flex: 1 }]}>{title}</T>
          <V2Action kind="quiet" label="Zatvori" onPress={close} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>{children}</ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}

export function IntakeUnavailable({ loading, error, retry, back }: {
  loading: boolean; error: string; retry?: () => void; back: () => void;
}) {
  return <SafeAreaView style={s.canvas}><View style={s.unavailable}>
    <V2Icon name="chat" size={36} color={v2.color.teal} />
    <T accessibilityRole="header" style={s.title}>{loading ? 'Otvaramo razgovor' : 'Razgovor nije dostupan'}</T>
    {loading ? <ActivityIndicator accessibilityLabel="Učitavamo razgovor" color={v2.color.teal} />
      : <><T accessibilityRole="alert" style={[s.body, s.center]}>{error}</T>
        {retry ? <V2Action kind="primary" label="Učitajte razgovor ponovo" onPress={retry} /> : null}</>}
    <V2Action kind="quiet" label="Nazad" onPress={back} />
  </View></SafeAreaView>;
}

/** Presentation only. The owned editor retains command, focus and receipt authority. */
export function IntakePresentation(props: Props) {
  const { conversation, busy, value, pending } = props;
  const [panel, setPanel] = useState<'options' | null>(null);
  const reduced = useReducedMotion();
  const summary = publicSummary(conversation.facts);
  const safetyCopy = safetyMessage(conversation.safety);
  const close = () => setPanel(null);
  return <AiConversationShell title={conversation.review.boundNeedId ? 'Izmena zadatka' : 'Novi zadatak'}
    subtitle="Razgovorom do zadatka" value={value} canEdit={props.canEdit} canSend={props.canSubmit}
    messages={conversation.messages} pending={pending} busy={busy} streamingText={props.streamingText}
    welcome="Šta treba da se uradi?" welcomeDetail="Opiši svojim rečima. Mesto, termin, ljude i cenu možeš dodati ili promeniti u razgovoru."
    onBack={props.onBack} onChange={props.onChange} onSend={props.onSend}
    onOptions={() => { Keyboard.dismiss(); setPanel('options'); }} voice={props.voice}
    card={compact => <Press testID="intake-task-summary" accessibilityRole="button" accessibilityLabel="Otvori sažetak Zadatka"
      accessibilityHint="Detaljan pregled svih podataka pre objave." accessibilityState={{ disabled: !props.canReview }}
      disabled={!props.canReview} onPress={props.onReview} haptic={props.canReview ? 'select' : 'none'} scaleTo={1}
      style={[s.taskCard, { backgroundColor: a.color.wash, borderColor: a.color.line, borderRadius: compact ? 18 : 23, padding: compact ? 12 : 20 }]}>
      <View style={s.row}><T style={[s.label, { color: a.color.green, flex: 1 }]}>TVOJ ZADATAK · {busy ? 'USKLAĐUJEM' : 'NACRT'}</T>
        {props.canReview ? <V2Icon name="chevron" size={18} color={a.color.green} /> : null}</View>
      <T style={[s.cardTitle, { color: a.color.ink, fontSize: compact ? 17 : 20, lineHeight: compact ? 23 : 27 }]}
        numberOfLines={compact ? 1 : 2}>{summary.title}</T>
      {summary.zone ? <T style={[s.label, { fontSize: 13, lineHeight: 19 }]} numberOfLines={1}>{summary.zone}</T> : null}
      {!compact && summary.schedule ? <T style={[s.label, { fontSize: 13, lineHeight: 19 }]}>{summary.schedule}</T> : null}
      {summary.price || summary.people ? <View style={[s.row, { flexWrap: 'wrap' }]}>
        {summary.price ? <T style={{ ...a.text.money, fontSize: compact ? 18 : 23, color: a.color.money, flexGrow: 1 }}>{summary.price}</T> : null}
        {summary.people ? <T style={s.people}>{summary.people}</T> : null}</View> : null}
      {!compact ? <T style={[s.label, { fontSize: 13, lineHeight: 19 }]}>{conversation.facts.length
        ? 'Pregledaj sve podatke pre objave.' : 'Kartica se popunjava iz razgovora.'}</T> : null}
    </Press>}
    actions={<>
      {safetyCopy ? <T accessibilityRole={conversation.safety === 'BLOCK' ? 'alert' : undefined}
        style={[s.label, conversation.safety === 'BLOCK' ? { color: a.color.danger } : null]}>{safetyCopy}</T> : null}
      {props.canReview ? <V2Action label={props.reviewLabel} onPress={props.onReview} /> : null}
      {props.onNewTask ? <V2Action label="Novi Zadatak" kind="primary" disabled={props.newTaskDisabled} onPress={props.onNewTask} /> : null}
    </>}
    status={<>
      {props.error ? <T accessibilityRole="alert" style={[s.label, { color: a.color.danger }]}>{props.error}</T> : null}
      {props.statusCopy ? <T accessibilityLiveRegion="polite" style={s.label}>{props.statusCopy}</T> : null}
      {props.showReadback ? <V2Action label="Proverite ishod" disabled={props.readbackDisabled} onPress={props.onRefresh} /> : null}
    </>}>
    {panel ? <Panel title="Opcije razgovora" close={close} reduced={reduced}>
      <T style={s.body}>{conversation.status === 'OPEN'
        ? 'Povratak čuva razgovor. Možeš da ga nastaviš kasnije.' : 'Ovde možeš da pregledaš sačuvane poruke.'}</T>
      <V2Action label="Osveži razgovor" disabled={props.readbackDisabled} onPress={() => { close(); props.onRefresh(); }} />
      {props.canReview ? <V2Action label={props.reviewLabel} onPress={() => { close(); props.onReview(); }} /> : null}
      {props.showAbandon ? <V2Action kind="destructive" label={props.abandonLabel} disabled={props.abandonDisabled}
        onPress={() => { close(); props.onAbandon(); }} /> : null}
    </Panel> : null}
  </AiConversationShell>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: v2.color.canvas },
  body: { ...v2.text.body, color: v2.color.ink }, label: { ...v2.text.label, color: v2.color.muted },
  title: { ...v2.text.title, color: v2.color.ink },
  cardTitle: { ...v2.text.title, fontSize: 17, lineHeight: 22, letterSpacing: -0.45, color: v2.color.ink },
  hero: { ...v2.text.hero, fontSize: 23, lineHeight: 29, letterSpacing: -0.55, color: v2.color.ink }, center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: v2.space.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: v2.space.xs, paddingHorizontal: v2.space.md, paddingVertical: v2.space.sm,
    backgroundColor: v2.color.header },
  iconButton: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: v2.space.lg, paddingBottom: v2.space.md, gap: v2.space.xl },
  taskCard: { backgroundColor: v2.color.context, borderWidth: 1, borderColor: v2.color.contextLine, borderRadius: v2.radius.card,
    padding: v2.space.lg, gap: v2.space.sm, overflow: 'hidden' },
  people: { ...v2.text.label, color: v2.color.ink, paddingHorizontal: v2.space.sm, paddingVertical: v2.space.xs,
    backgroundColor: v2.color.surface, borderRadius: v2.radius.input },
  exchange: { gap: v2.space.md, flexGrow: 1 },
  answer: { backgroundColor: v2.color.answer, padding: v2.space.md, gap: v2.space.xs,
    borderRadius: 16, marginLeft: v2.space.xl },
  // Native reading size is 15px, one step above the reference's 14px answer.
  answerText: { ...v2.text.body, fontSize: 15, lineHeight: 23, color: v2.color.ink },
  composerArea: { backgroundColor: v2.color.surface, borderTopColor: v2.color.line, borderTopWidth: 1,
    paddingHorizontal: v2.space.lg, paddingTop: v2.space.md, paddingBottom: v2.space.sm, gap: v2.space.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: v2.space.sm, borderWidth: 1, borderColor: v2.color.controlLine,
    borderRadius: 20, padding: v2.space.sm },
  input: { flex: 1, ...v2.text.body, fontSize: 15, lineHeight: 21, color: v2.color.ink, minHeight: v2.target.minimum, maxHeight: 112,
    paddingHorizontal: v2.space.xs, paddingVertical: v2.space.md, textAlignVertical: 'top' },
  send: { width: v2.target.minimum, height: v2.target.minimum, borderRadius: v2.radius.button,
    backgroundColor: v2.color.ink, alignItems: 'center', justifyContent: 'center' },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#143D3566' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: v2.radius.sheet, borderTopRightRadius: v2.radius.sheet,
    paddingHorizontal: v2.space.lg, paddingTop: v2.space.md, backgroundColor: v2.color.canvas },
  sheetContent: { gap: v2.space.md, paddingVertical: v2.space.md },
  historyMessage: { gap: v2.space.xs, paddingVertical: v2.space.sm },
  unavailable: { flex: 1, padding: v2.space.xl, gap: v2.space.lg, alignItems: 'center', justifyContent: 'center' },
});
