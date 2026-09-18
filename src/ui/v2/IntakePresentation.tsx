import { lazy, Suspense, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { ArrowRight, CaretRight, Clock, MapPin, Users } from 'phosphor-react-native';
import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { NeedTaskGeography } from '../../contracts/needFactsV2';
import { safetyMessage } from '../../data/aiNeedV2Ui';
import { factDisplayLabel } from '../../contracts/needFactsV2';
import { calendarInstant } from '../../lib/calendarTime';
import { displayDate, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { pointsMissing } from '../../lib/location';
import { V2Icon } from './icons';
import { AiConversationShell } from '../aiFirst/AiConversationShell';
import { aiFirst as a } from '../aiFirst/tokens';

// The point sheet reaches the native map through the point editor, so it loads only when opened.
const ConversationPointAsk = lazy(() => import('../location/ConversationPointAsk'));

type Props = {
  conversation: AiNeedV2Conversation; value: string; busy: boolean; error: string | null;
  canSubmit: boolean; canEdit: boolean; canReview: boolean; reviewLabel: string;
  pending: boolean; statusCopy: string | null; showReadback: boolean; readbackDisabled: boolean;
  showAbandon: boolean; abandonDisabled: boolean; abandonLabel: string;
  onBack: () => void; onChange: (value: string) => void; onSend: () => void;
  onReview: () => void; onRefresh: () => void; onAbandon: () => void;
  onNewTask?: () => void; newTaskDisabled?: boolean; voice?: ReactNode; streamingText?: string;
  onPhotos?: () => void; photosDisabled?: boolean;
  onCancelPending?: () => void; cancelPendingDisabled?: boolean; cancelPendingDispatched?: boolean;
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
        <View style={s.handle} />
        <View style={s.row}><T accessibilityRole="header" variant="title" style={[s.ink, { flex: 1 }]}>{title}</T>
          <V2Action kind="quiet" label="Zatvori" onPress={close} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.sheetContent}>{children}</ScrollView>
      </SafeAreaView>
    </View>
  </Modal>;
}

export function IntakeUnavailable({ loading, error, retry, back, recover }: {
  loading: boolean; error: string; retry?: () => void; back: () => void; recover?: () => void;
}) {
  return <SafeAreaView style={s.canvas}><View style={s.unavailable}>
    <View style={s.unavailableMark}><V2Icon name="chat" size={30} color={sys.color.green} /></View>
    <T accessibilityRole="header" variant="title" style={[s.ink, s.center]}>{loading ? 'Otvaramo razgovor' : 'Razgovor nije dostupan'}</T>
    {loading ? <ActivityIndicator accessibilityLabel="Učitavamo razgovor" color={sys.color.green} />
      : <><T accessibilityRole="alert" variant="copy" tone="muted" style={s.center}>{error}</T>
        {recover ? <V2Action kind="primary" label="Otvori prethodni razgovor" onPress={recover} /> : null}
        {retry ? <V2Action kind="primary" label="Učitaj razgovor ponovo" onPress={retry} /> : null}</>}
    <V2Action kind="quiet" label="Nazad" onPress={back} />
  </View></SafeAreaView>;
}

/**
 * Presentation only. The owned editor retains command, focus and receipt authority.
 * The live card follows the V5 anatomy: a kicker with a signal dot, the title, the
 * place and time as icon rows, then a hairline foot with the price and the people.
 */
export function IntakePresentation(props: Props) {
  const { conversation, busy, value, pending } = props;
  const [panel, setPanel] = useState<'options' | 'points' | null>(null);
  // Asked inline, so the map sits beside the words. Dismissing it leaves a way back.
  const [pointAskHidden, setPointAskHidden] = useState(false);
  const reduced = useReducedMotion();
  const summary = publicSummary(conversation.facts);
  const safetyCopy = safetyMessage(conversation.safety);
  const close = () => setPanel(null);
  // The map point is the one thing publishing cannot do without and the AI may not propose, so
  // the conversation asks for it rather than leaving it to be discovered. Read from the facts
  // the conversation already holds, including the owner-private one; no extra server call.
  const held = (key: AiNeedV2Fact['key']) => conversation.facts.find(fact => fact.key === key)?.value;
  const gap = pointsMissing(held('need.task_geography'), held('need.resolved_location'));
  const needsPoint = conversation.status === 'OPEN' && gap.total > 0 && gap.done < gap.total;
  // Each turn carries the ids of the facts it proposed, so the sentence it wrote can be shown
  // beside what it actually took. A private value is named but never printed here: the thread is
  // the conversation surface, not the place to restate an exact address.
  const messages = conversation.messages.map(message => {
    if (!message.fromAi || !message.proposedFactIds.length) return message;
    const understood = message.proposedFactIds
      .map(id => conversation.facts.find(fact => fact.id === id))
      .filter((fact): fact is AiNeedV2Fact => !!fact)
      .map(fact => ({ key: fact.id, label: factDisplayLabel(fact.key),
        value: fact.privacyClass === 'PRIVATE' ? 'privatno, vidi samo onaj s kim se dogovoriš' : fact.displayValue }));
    return understood.length ? { ...message, understood } : message;
  });
  return <AiConversationShell title={conversation.review.boundNeedId ? 'Izmena zadatka' : 'Novi zadatak'}
    subtitle="Razgovorom do zadatka" value={value} canEdit={props.canEdit} canSend={props.canSubmit}
    messages={messages} pending={pending} busy={busy} streamingText={props.streamingText}
    welcome="Reci šta ti treba." welcomeDetail=""
    onBack={props.onBack} onChange={props.onChange} onSend={props.onSend}
    onOptions={() => { Keyboard.dismiss(); setPanel('options'); }} voice={props.voice}
    card={compact => <Press testID="intake-task-summary" accessibilityRole="button" accessibilityLabel="Otvori sažetak Zadatka"
      accessibilityHint="Detaljan pregled svih podataka pre objave." accessibilityState={{ disabled: !props.canReview }}
      disabled={!props.canReview} onPress={props.onReview} haptic={props.canReview ? 'select' : 'none'} scaleTo={1}
      style={[s.taskCard, compact && s.taskCardCompact, !conversation.facts.length && s.taskCardEmpty]}>
      <View style={s.row}>
        <View style={[s.dot, busy && s.dotBusy]} />
        <T variant="label" style={s.kicker}>TVOJ ZADATAK · {busy ? 'USKLAĐUJEM' : 'NACRT'}</T>
        {props.canReview ? <View style={s.detailLink}><T variant="meta" tone="muted">Detalji</T><CaretRight size={14} color={sys.color.muted} /></View> : null}
      </View>
      <T style={[s.cardTitle, compact && s.cardTitleCompact, !conversation.facts.length && s.cardTitleEmpty]} numberOfLines={compact ? 1 : 2}>{summary.title}</T>
      {!compact && (summary.zone || summary.schedule) ? <View style={s.metaRows}>
        {summary.zone ? <View style={s.metaRow}><MapPin size={16} color={sys.color.muted} /><T variant="meta" tone="muted" numberOfLines={1} style={s.metaText}>{summary.zone}</T></View> : null}
        {summary.schedule ? <View style={s.metaRow}><Clock size={16} color={sys.color.muted} /><T variant="meta" tone="muted" style={s.metaText}>{summary.schedule}</T></View> : null}
      </View> : null}
      {compact && summary.zone ? <T variant="meta" tone="muted" numberOfLines={1}>{summary.zone}</T> : null}
      {!compact && (summary.price || summary.people) ? <View style={s.cardFoot}>
        {summary.price ? <T style={s.money}>{summary.price}</T> : <View style={s.grow} />}
        {summary.people ? <View style={s.peopleRow}><Users size={18} color={sys.color.ink} /><T variant="meta" style={s.people}>{summary.people}</T></View> : null}
      </View> : null}
    </Press>}
    actions={<>
      {/* Only a hard block belongs in the thread. REVIEW and CLARIFY are descriptions of
          state, not requests, and they live in the options panel with the commands. */}
      {safetyCopy && conversation.safety === 'BLOCK'
        ? <T accessibilityRole="alert" variant="note" style={s.danger}>{safetyCopy}</T> : null}
    </>}
    // A fragment is truthy even when every branch inside it is null, which drew an empty
    // panel in the thread. The slot is filled only when there is something to act on.
    status={!props.error && !props.statusCopy && !props.onCancelPending && !props.showReadback && !needsPoint ? undefined : <>
      {needsPoint && !pointAskHidden ? <>
        <T variant="note" style={s.muted}>{gap.total > 1
          ? 'Fali još mesto na mapi, da onaj ko uskoči zna gde da dođe. Dve tačke, dva dodira.'
          : 'Fali još mesto na mapi, da onaj ko uskoči zna gde da dođe.'}</T>
        <Suspense fallback={<T accessibilityLiveRegion="polite" tone="muted">Otvaram mapu…</T>}>
          <ConversationPointAsk conversationId={conversation.conversationId}
            onSaved={props.onRefresh} onClose={() => setPointAskHidden(true)} />
        </Suspense>
      </> : null}
      {needsPoint && pointAskHidden
        ? <V2Action kind="primary" label="Pokaži mesto na mapi" onPress={() => { Keyboard.dismiss(); setPointAskHidden(false); }} /> : null}
      {props.error ? <T accessibilityRole="alert" variant="note" style={s.danger}>{props.error}</T> : null}
      {props.statusCopy ? <T accessibilityLiveRegion="polite" variant="note" style={s.muted}>{props.statusCopy}</T> : null}
      {props.onCancelPending ? <>
        <T variant="note" style={s.muted}>Odustajanje sprečava da kasniji odgovor promeni podatke. Ako je obrada već počela, rezervisana potrošnja ostaje zadržana.</T>
        <V2Action kind="quiet" label={props.cancelPendingDispatched ? 'Odustani od odgovora' : 'Otkaži slanje poruke'}
          disabled={props.cancelPendingDisabled} onPress={props.onCancelPending} />
      </> : null}
      {props.showReadback ? <V2Action label="Proveri ishod" disabled={props.readbackDisabled} onPress={props.onRefresh} /> : null}
    </>}>
    {panel === 'points' ? <Panel title="Mesto zadatka" close={close} reduced={reduced}>
      <Suspense fallback={<T accessibilityLiveRegion="polite" tone="muted">Otvaram mapu…</T>}>
        <ConversationPointAsk conversationId={conversation.conversationId}
          onSaved={props.onRefresh} onClose={close} />
      </Suspense>
    </Panel> : null}
    {panel === 'options' ? <Panel title="Opcije razgovora" close={close} reduced={reduced}>
      <T variant="copy" tone="muted">{conversation.status === 'OPEN'
        ? 'Povratak čuva razgovor. Možeš da ga nastaviš kasnije.' : 'Ovde možeš da pregledaš sačuvane poruke.'}</T>
      {safetyCopy && conversation.safety !== 'BLOCK'
        ? <T variant="note" style={s.muted}>{safetyCopy}</T> : null}
      <V2Action label="Osveži razgovor" disabled={props.readbackDisabled} onPress={() => { close(); props.onRefresh(); }} />
      {/* Reachable whenever the task has a place, not only while a point is missing, so a point
          can also be moved without hunting for the long form. */}
      {conversation.status === 'OPEN' && gap.total > 0
        ? <V2Action label={needsPoint ? 'Mesto na mapi' : 'Izmeni mesto na mapi'} kind="quiet"
          onPress={() => { close(); setPointAskHidden(false); setPanel(gap.done < gap.total ? null : 'points'); }} /> : null}
      {props.canReview ? <V2Action label={props.reviewLabel} onPress={() => { close(); props.onReview(); }} /> : null}
      {props.onPhotos ? <V2Action label="Fotografije zadatka" kind="quiet" disabled={props.photosDisabled}
        onPress={() => { close(); props.onPhotos?.(); }} /> : null}
      {props.onNewTask ? <V2Action label="Novi Zadatak" kind="primary" disabled={props.newTaskDisabled}
        onPress={() => { close(); props.onNewTask?.(); }} /> : null}
      {props.showAbandon ? <V2Action kind="destructive" label={props.abandonLabel} disabled={props.abandonDisabled}
        onPress={() => { close(); props.onAbandon(); }} /> : null}
    </Panel> : null}
  </AiConversationShell>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.color.surface },
  ink: { color: sys.color.ink }, muted: { color: sys.color.muted }, danger: { color: sys.color.danger }, center: { textAlign: 'center' },
  grow: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskCard: { backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine, borderRadius: sys.radius.card, paddingVertical: 16, paddingHorizontal: 17, gap: 10, overflow: 'hidden', ...sys.elevation.soft },
  // Before the conversation has said anything the card is a label, not a panel.
  taskCardEmpty: { paddingVertical: 10, gap: 4 },
  taskCardCompact: { borderRadius: sys.radius.cardCompact, paddingVertical: 10, paddingHorizontal: 14, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  dotBusy: { backgroundColor: sys.color.orange },
  kicker: { flex: 1, color: sys.color.green, letterSpacing: 0.9 },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardTitle: { ...sys.type.cardTitle, color: sys.color.ink },
  cardTitleCompact: { ...sys.type.cardTitleCompact },
  cardTitleEmpty: { ...sys.type.heading, color: sys.color.muted },
  metaRows: { gap: 5 }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, metaText: { flexShrink: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: 12, marginTop: 3 },
  money: { ...sys.type.price, color: sys.color.money },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  people: { color: sys.color.ink, fontWeight: '600' },
  reviewLink: { backgroundColor: sys.color.greenSoft, borderWidth: 0, minHeight: 51, borderRadius: sys.radius.control, justifyContent: 'flex-start', paddingHorizontal: 14 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: sys.color.scrim },
  sheet: { maxHeight: '85%', borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    paddingHorizontal: 24, paddingTop: 10, backgroundColor: sys.color.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: sys.radius.pill, backgroundColor: sys.color.lineStrong, marginBottom: 10 },
  sheetContent: { gap: 12, paddingVertical: 12, paddingBottom: 20 },
  unavailable: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  unavailableMark: { width: 60, height: 60, borderRadius: sys.radius.card, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
});
