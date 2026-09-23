import { lazy, Suspense, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { CaretRight } from 'phosphor-react-native';
import { FactArt } from '../system/FactArt';
import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { NeedTaskGeography } from '../../contracts/needFactsV2';
import { safetyMessage } from '../../data/aiNeedV2Ui';
import { needPriceBasisNote, type PriceBasis } from '../../data/needDetailPresentation';
import { osoba } from '../system/plural';
import { factDisplayLabel } from '../../contracts/needFactsV2';
import { calendarInstant } from '../../lib/calendarTime';
import { displayDate, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { pointsMissing } from '../../lib/location';
import { AiConversationShell } from '../aiFirst/AiConversationShell';
import { aiFirst as a } from '../aiFirst/tokens';
import { novac } from '../../lib/novac';

// The point sheet reaches the native map through the point editor, so it loads only when opened.
const ConversationPointAsk = lazy(() => import('../location/ConversationPointAsk'));

type Props = {
  conversation: AiNeedV2Conversation; value: string; busy: boolean; error: string | null;
  canSubmit: boolean; canEdit: boolean; canReview: boolean; reviewLabel: string;
  pending: boolean; statusCopy: string | null; showReadback: boolean; readbackDisabled: boolean;
  /** The sentence that was sent and is waiting for its answer. */
  sentMessage?: string | null;
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
  const value = (key: AiNeedV2Fact['key']) => facts.find(fact => fact.key === key && fact.privacyClass === 'PUBLIC' && fact.status !== 'UNKNOWN')?.value;
  const title = value('need.title'), geography = value('need.task_geography') as NeedTaskGeography | undefined;
  const mode = value('need.price_mode'), amount = value('need.price_rsd'), people = value('need.people_needed');
  const basis = value('need.price_basis');
  const schedule = value('need.schedule_kind');
  const zone = geography?.mode === 'REMOTE' ? 'Na daljinu' : [geography?.start?.city ?? geography?.serviceArea?.city,
    geography?.start?.area ?? geography?.serviceArea?.area].filter(item => typeof item === 'string' && item.trim()).join(' · ');
  return { title: typeof title === 'string' ? title : 'Zadatak u nastajanju', zone,
    schedule: schedule === 'FIXED_WINDOW' ? fixedRange(value('need.starts_at'), value('need.ends_at'))
      : typeof schedule === 'string' ? schedules[schedule] : undefined,
    price: mode === 'OFFERS' ? 'Tražim ponude' : mode === 'MY_PRICE' && typeof amount === 'number' ? novac(amount) : null,
    // The big number alone said 5.000 for a three-person task costing 15.000. The number stays the
    // card's signature; what it is FOR goes quietly under it.
    priceNote: mode === 'MY_PRICE' && typeof amount === 'number'
      ? needPriceBasisNote({ osnovaCene: basis as PriceBasis, ponudjenaCena: { iznos: amount },
          pokrivenost: typeof people === 'number' ? { ukupno: people } : undefined })
      : null,
    people: typeof people === 'number' ? osoba(people) : null };
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
    <View style={s.unavailableMark}><FactArt kind="chat" size={36} /></View>
    <T accessibilityRole="header" variant="title" style={[s.ink, s.center]}>{loading ? 'Otvaramo razgovor' : 'Razgovor nije dostupan'}</T>
    {loading ? <ActivityIndicator accessibilityLabel="Učitavamo razgovor" color={sys.color.green} />
      : <><T accessibilityRole="alert" variant="copy" tone="muted" style={s.center}>{error}</T>
        {recover ? <V2Action label="Otvori prethodni razgovor" onPress={recover} style={brandAction} /> : null}
        {retry ? <V2Action label="Učitaj razgovor ponovo" onPress={retry} style={recover ? undefined : brandAction} /> : null}</>}
    <V2Action kind="quiet" label="Nazad" onPress={back} />
  </View></SafeAreaView>;
}

/**
 * Presentation only. The owned editor retains command, focus and receipt authority.
 * The live card follows the V5 anatomy: a kicker with a signal dot, the title, the
 * place and time as icon rows, then a hairline foot with the price and the people.
 */
/** Three ways in, taken from what people actually opened a conversation to ask for. */
const OPENINGS = ['Treba mi prevoz', 'Treba mi majstor', 'Treba mi pomoć oko selidbe'] as const;

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
  // What is still missing belonged only to the review screen, so the one question a person has
  // during the conversation - am I two answers away or eight - could only be answered by leaving it.
  // The map point is counted here too: the server's required list cannot contain it, because the AI
  // is not allowed to propose it, and leaving it out is how "spremno" became a promise that failed.
  // A required fact stays in the server's list until it is confirmed, so a title the AI has already
  // proposed — and which this very card is showing as its heading — was listed underneath as still
  // needed. What the conversation still has to ask for is what has no value at all; confirming what
  // it proposed is the review screen's job, and the card's heading already shows it.
  const proposed = new Set(conversation.facts.filter(fact => fact.status !== 'UNKNOWN').map(fact => fact.key));
  const stillNeeded = [...conversation.review.missingRequired.filter(key => !proposed.has(key)).map(factDisplayLabel),
    ...(needsPoint ? ['tačka na mapi'] : [])];
  // At the start nothing is filled, so the full list is eight items long — a wall exactly when it
  // helps least, and it was being cut mid-word to fit two lines. The AI asks for them one at a time
  // anyway, so the card names the first few and counts the rest.
  const stillNeededText = stillNeeded.length <= 3 ? stillNeeded.join(' · ')
    : `${stillNeeded.slice(0, 3).join(' · ')} · i još ${stillNeeded.length - 3}`;
  // Current facts belong in the live card and the explicit full review. Decorating
  // old replies with today's fact values repeated the summary and rewrote history.
  const messages = conversation.messages;
  return <AiConversationShell title={conversation.review.boundNeedId ? 'Izmena zadatka' : 'Novi zadatak'}
    subtitle="Razgovorom do zadatka" value={value} canEdit={props.canEdit} canSend={props.canSubmit}
    messages={messages} pending={pending} busy={busy} streamingText={props.streamingText}
    sentMessage={props.sentMessage}
    welcome="Reci šta ti treba."
    welcomeDetail="Ispričaj svojim rečima — glasom ili kucanjem. Ja hvatam detalje sa strane, ti potvrđuješ šta je tačno."
    openings={OPENINGS}
    onBack={props.onBack} onChange={props.onChange} onSend={props.onSend}
    onOptions={() => { Keyboard.dismiss(); setPanel('options'); }} voice={props.voice}
    // Nothing is pinned until the conversation has said or taken something: an empty card at the
    // top of a fresh screen states a draft that does not exist yet and buries the invitation.
    card={compact => !conversation.facts.length && !messages.length ? null : <Press testID="intake-task-summary" accessibilityRole="button" accessibilityLabel="Otvori sažetak Zadatka"
      accessibilityHint="Detaljan pregled svih podataka pre objave." accessibilityState={{ disabled: !props.canReview }}
      disabled={!props.canReview} onPress={props.onReview} haptic={props.canReview ? 'select' : 'none'} scaleTo={1}
      style={[s.taskCard, compact && s.taskCardCompact, !conversation.facts.length && s.taskCardEmpty]}>
      <View style={s.row}>
        <View style={[s.dot, busy && s.dotBusy]} />
        <T variant="label" style={s.kicker}>Tvoj zadatak · {busy ? 'usklađujem' : 'nacrt'}</T>
        {props.canReview ? <View style={s.detailLink}><T variant="meta" tone="muted">Detalji</T><CaretRight size={14} color={sys.color.muted} /></View> : null}
      </View>
      <T style={[s.cardTitle, compact && s.cardTitleCompact, !conversation.facts.length && s.cardTitleEmpty]} numberOfLines={compact ? 1 : 2}>{summary.title}</T>
      {conversation.status === 'OPEN' ? <T variant="meta" tone="muted" numberOfLines={2}>
        {stillNeeded.length ? `Još treba: ${stillNeededText}` : 'Sve traženo je uneto — otvori pregled'}
      </T> : null}
      {!compact && (summary.zone || summary.schedule) ? <View style={s.metaRows}>
        {summary.zone ? <View style={s.metaRow}><FactArt kind="pin" size={22} /><T variant="meta" tone="muted" numberOfLines={1} style={s.metaText}>{summary.zone}</T></View> : null}
        {summary.schedule ? <View style={s.metaRow}><FactArt kind="calendar" size={22} /><T variant="meta" tone="muted" style={s.metaText}>{summary.schedule}</T></View> : null}
      </View> : null}
      {compact && summary.zone ? <T variant="meta" tone="muted" numberOfLines={1}>{summary.zone}</T> : null}
      {!compact && (summary.price || summary.people) ? <View style={s.cardFoot}>
        {summary.price ? <View style={s.priceBlock}>
          <T style={s.money}>{summary.price}</T>
          {summary.priceNote ? <T variant="meta" tone="muted" numberOfLines={1}>{summary.priceNote}</T> : null}
        </View> : <View style={s.grow} />}
        {summary.people ? <View style={s.peopleRow}><FactArt kind="users" size={22} /><T variant="meta" style={s.people}>{summary.people}</T></View> : null}
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
        <Suspense fallback={<T accessibilityLiveRegion="polite" tone="muted">Otvaramo mapu…</T>}>
          <ConversationPointAsk conversationId={conversation.conversationId}
            onSaved={props.onRefresh} onClose={() => setPointAskHidden(true)} />
        </Suspense>
      </> : null}
      {needsPoint && pointAskHidden
        ? <V2Action label="Pokaži mesto na mapi" style={brandAction} onPress={() => { Keyboard.dismiss(); setPointAskHidden(false); }} /> : null}
      {props.error ? <T accessibilityRole="alert" variant="note" style={s.danger}>{props.error}</T> : null}
      {props.statusCopy ? <T accessibilityLiveRegion="polite" variant="note" style={s.muted}>{props.statusCopy}</T> : null}
      {props.onCancelPending ? <>
        <T variant="note" style={s.muted}>Odustajanje sprečava da kasniji odgovor promeni podatke. Ako je odgovor već počeo da se sprema, taj pokušaj se ipak računa.</T>
        <V2Action kind="quiet" label={props.cancelPendingDispatched ? 'Odustani od odgovora' : 'Otkaži slanje poruke'}
          disabled={props.cancelPendingDisabled} onPress={props.onCancelPending} />
      </> : null}
      {props.showReadback ? <V2Action label="Proveri ishod" disabled={props.readbackDisabled} onPress={props.onRefresh} /> : null}
    </>}>
    {panel === 'points' ? <Panel title="Mesto zadatka" close={close} reduced={reduced}>
      <Suspense fallback={<T accessibilityLiveRegion="polite" tone="muted">Otvaramo mapu…</T>}>
        <ConversationPointAsk conversationId={conversation.conversationId}
          onSaved={props.onRefresh} onClose={close} />
      </Suspense>
    </Panel> : null}
    {panel === 'options' ? <Panel title="Opcije razgovora" close={close} reduced={reduced}>
      <T variant="copy" tone="muted">{conversation.status === 'OPEN'
        ? 'Povratak čuva razgovor. Možeš da ga nastaviš kasnije.' : 'Ovde možeš da pregledaš sačuvane poruke.'}</T>
      {safetyCopy && conversation.safety !== 'BLOCK'
        ? <T variant="note" style={s.muted}>{safetyCopy}</T> : null}
      {/* The sheet used to lead with "Osveži razgovor" and give its one strong control to
          "Novi Zadatak" — so the loudest thing offered to a person in the middle of describing a
          task was to abandon it and start another. The review is what finishes this one, so it
          goes first and it is the strong one; starting over is an ordinary choice near the end,
          beside abandoning. */}
      {props.canReview ? <V2Action label={props.reviewLabel} onPress={() => { close(); props.onReview(); }} style={brandAction} /> : null}
      {props.onPhotos ? <V2Action label="Fotografije zadatka" disabled={props.photosDisabled}
        onPress={() => { close(); props.onPhotos?.(); }} /> : null}
      {/* Reachable whenever the task has a place, not only while a point is missing, so a point
          can also be moved without hunting for the long form. */}
      {conversation.status === 'OPEN' && gap.total > 0
        ? <V2Action label={needsPoint ? 'Mesto na mapi' : 'Izmeni mesto na mapi'}
          onPress={() => { close(); setPointAskHidden(false); setPanel(gap.done < gap.total ? null : 'points'); }} /> : null}
      <V2Action label="Osveži razgovor" kind="quiet" disabled={props.readbackDisabled} onPress={() => { close(); props.onRefresh(); }} />
      {props.onNewTask ? <V2Action label="Novi Zadatak" kind="quiet" disabled={props.newTaskDisabled}
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
  // A bordered panel over the thread made the conversation look like a form with a header. It is
  // a quiet summary on the app's own wash now, and the shadow and outline are gone.
  taskCard: { backgroundColor: sys.color.wash, borderRadius: sys.radius.card, paddingVertical: 14, paddingHorizontal: 16, gap: 8, overflow: 'hidden' },
  // Before the conversation has said anything the card is a label, not a panel.
  taskCardEmpty: { paddingVertical: 10, gap: 4 },
  taskCardCompact: { borderRadius: sys.radius.cardCompact, paddingVertical: 10, paddingHorizontal: 14, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  dotBusy: { backgroundColor: sys.color.orange },
  kicker: { flex: 1, color: sys.color.green, letterSpacing: 0.2 },
  detailLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cardTitle: { ...sys.type.cardTitle, color: sys.color.ink },
  cardTitleCompact: { ...sys.type.cardTitleCompact },
  cardTitleEmpty: { ...sys.type.heading, color: sys.color.muted },
  metaRows: { gap: 5 }, metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 }, metaText: { flexShrink: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: 12, marginTop: 3 },
  priceBlock: { flexShrink: 1, gap: 2 },
  money: { ...sys.type.price, color: sys.color.money },
  peopleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  people: { color: sys.color.ink, fontWeight: '600' },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: sys.color.scrim },
  sheet: { maxHeight: '85%', borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    paddingHorizontal: 24, paddingTop: 10, backgroundColor: sys.color.surface },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: sys.radius.pill, backgroundColor: sys.color.lineStrong, marginBottom: 10 },
  sheetContent: { gap: 12, paddingVertical: 12, paddingBottom: 20 },
  unavailable: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  unavailableMark: { width: 60, height: 60, borderRadius: sys.radius.card, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' },
});
