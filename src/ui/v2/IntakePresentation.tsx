import { lazy, Suspense, useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight } from 'phosphor-react-native';
import { FactArt } from '../system/FactArt';
import type { AiNeedV2Conversation, AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { safetyMessage } from '../../data/aiNeedV2Ui';
import { factDisplayLabel } from '../../contracts/needFactsV2';
import { Press } from '../Press';
import { brandAction, cardCompact, floating, sys } from '../system/tokens';
import { useReducedMotion } from '../system/motion';
import { useTextScale } from '../system/textScale';
import { ActionSheet, type SheetAction } from '../system/ActionSheet';
import { ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { CardFact, CardTitle, CardValue, valueSpoken } from './TaskFace';
import { pointsMissing } from '../../lib/location';
import { AiConversationShell } from '../aiFirst/AiConversationShell';
import type { VoiceInput } from '../aiFirst/VoiceComposer';
import { publicSummary, type Summary } from './draftSummary';

// The point sheet reaches the native map through the point editor, so it loads only when opened.
const ConversationPointAsk = lazy(() => import('../location/ConversationPointAsk'));

type Props = {
  /** Stable through first-send server ID assignment; replaced only when the owned route changes. */
  conversationKey?: string;
  conversation: AiNeedV2Conversation; value: string; busy: boolean; error: string | null;
  canSubmit: boolean; canEdit: boolean; canReview: boolean; reviewLabel: string;
  pending: boolean; statusCopy: string | null; showReadback: boolean; readbackDisabled: boolean;
  /** The sentence that was sent and is waiting for its answer. */
  sentMessage?: string | null;
  showAbandon: boolean; abandonDisabled: boolean; abandonLabel: string;
  onBack: () => void; onChange: (value: string) => void; onSend: () => void;
  onReview: () => void; onRefresh: () => void; onAbandon: () => void;
  onNewTask?: () => void; newTaskDisabled?: boolean; voice?: VoiceInput; streamingText?: string;
  onPhotos?: () => void; photosDisabled?: boolean;
  onCancelPending?: () => void; cancelPendingDisabled?: boolean; cancelPendingDispatched?: boolean;
};

// The live card's public summary is the shared pure one (src/ui/v2/draftSummary.ts), also used by the publish review.
export type { Summary } from './draftSummary';

export function IntakeUnavailable({ loading, error, retry, back, recover }: {
  loading: boolean; error: string; retry?: () => void; back: () => void; recover?: () => void;
}) {
  const primary = recover ? { label: 'Otvori prethodni razgovor', onPress: recover } : retry ? { label: 'Pokušaj ponovo', onPress: retry } : undefined;
  return <SafeAreaView edges={['top', 'bottom']} style={s.canvas}>
    <ScreenChrome variant="detail" tone="conversation" onBack={back} />
    <View style={s.unavailable}>
      {loading ? <View style={s.loading}>
        <View style={s.unavailableMark}><FactArt kind="chat" size={36} /></View>
        <T accessibilityRole="header" variant="title" style={s.ink}>Otvaramo razgovor</T>
        <ActivityIndicator accessibilityLabel="Učitavamo razgovor" color={sys.color.green} />
      </View> : <StateView kind="error" art="chat" title="Razgovor nije dostupan" body={error} primary={primary} />}
    </View>
  </SafeAreaView>;
}

/** Three ways in, taken from what people actually opened a conversation to ask for. */
const OPENINGS = ['Treba mi prevoz', 'Treba mi majstor', 'Treba mi pomoć oko selidbe'] as const;

/**
 * The draft the conversation is building, as ONE card that changes in place (owner step 6): the task card's own parts
 * (TaskFace) — the state, the title with its value slot, where, when, how many people — and one quiet line saying what
 * is still missing or that the review is ready. It is one target: the whole card opens the review. What it says is
 * spoken once as its hint, so a screen reader does not stop on each fact.
 */
export function DraftCard({ summary, stillNeeded, open, busy, compact, canReview, onReview, note, reviewLabel = 'Pregledaj zadatak',
  editing = false, hiddenMissing = false }: {
  summary: Summary; stillNeeded: string | null; open: boolean; busy: boolean; compact: boolean; canReview: boolean;
  onReview: () => void; note: string | null;
  /** The review's own name, the one the "···" menu uses ("Pregledaj izmene" while a published task is being changed). */
  reviewLabel?: string;
  /** The conversation changes a task that already exists (review r4 ra item 9): the card says "Izmena", not "Nacrt". */
  editing?: boolean;
  /** Something the server still needs is one people never see (the category): the card claims nothing is missing. */
  hiddenMissing?: boolean;
}) {
  const large = useTextScale() >= 1.3;
  const status = `${editing ? 'Izmena' : 'Nacrt'}${busy ? ' · dopunjuje se' : ''}`;
  const next = !open ? null : stillNeeded ? `Još treba: ${stillNeeded}` : null;
  const ready = open && !stillNeeded && !hiddenMissing;
  const spoken = [status, summary.title ?? 'Zadatak u nastajanju', summary.value ? valueSpoken(summary.value) : null,
    summary.zone || null, summary.schedule ?? null, summary.people, next, note].filter(Boolean).join(', ');
  return <Press testID="intake-task-summary" accessibilityRole="button" accessibilityLabel="Otvori sažetak Zadatka"
    accessibilityHint={`${spoken}. ${editing ? 'Otvara pregled izmena.' : 'Otvara pregled svih podataka pre objave.'}`}
    accessibilityState={{ disabled: !canReview }}
    disabled={!canReview} onPress={onReview} haptic={canReview ? 'select' : 'none'} scaleTo={0.99}
    style={[s.card, compact && s.cardCompact]}>
    <View style={s.statusRow}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><FactArt kind="document" size={compact ? 24 : 28} /></View>
      <View style={[s.dot, busy && s.dotBusy]} />
      <T variant="label" numberOfLines={1} style={s.status}>{status}</T>
      {/* The card opens the review; once the review is the next step, its own line carries the one arrow. */}
      {canReview && !ready ? <CaretRight size={20} weight="bold" color={sys.color.green} /> : null}
    </View>
    <View style={large ? s.headStacked : s.head}>
      <CardTitle title={summary.title ?? 'Zadatak u nastajanju'} lines={2}
        style={[!large && s.titleSide, compact && s.compactTitle, !summary.title && s.titleEmpty]} />
      {summary.value ? <CardValue value={summary.value} large={large} /> : null}
    </View>
    {compact ? null : <>
      {summary.zone ? <CardFact art={<FactArt kind={summary.zone === 'Na daljinu' ? 'remote' : 'pin'} size={20} />} text={summary.zone} /> : null}
      {summary.schedule ? <CardFact art={<FactArt kind="calendar" size={20} />} text={summary.schedule} lines={2} /> : null}
      {summary.people ? <CardFact art={<FactArt kind="users" size={20} />} text={summary.people} /> : null}
    </>}
    {/* The safety note stays on the compact card too (large text, a small phone, a pending turn), in two lines there
        (review r4 ra item 6): it used to live in the options panel, and hiding it on compact lost it for those people. */}
    {note ? <T variant="note" tone="muted" numberOfLines={compact ? 2 : 3}>{note}</T> : null}
    {next ? <T variant="note" tone="muted" numberOfLines={compact ? 1 : 2} style={s.next}>{next}</T>
      : ready && canReview ? <View style={s.ready}><T style={s.readyText} numberOfLines={1}>{reviewLabel}</T>
        <CaretRight size={16} weight="bold" color={sys.color.green} /></View>
        : ready ? <T variant="note" tone="muted" numberOfLines={1} style={s.next}>Sve traženo je uneto.</T> : null}
  </Press>;
}

/**
 * Presentation only. The owned editor retains command, focus and receipt authority.
 */
export function IntakePresentation(props: Props) {
  const { conversation, busy, value, pending } = props;
  const [panel, setPanel] = useState<'options' | null>(null);
  // Asked inline, so the map sits beside the words. Dismissing it leaves a way back.
  const [pointAskHidden, setPointAskHidden] = useState(false);
  const reduced = useReducedMotion();
  const summary = publicSummary(conversation.facts);
  const safetyCopy = safetyMessage(conversation.safety);
  const open = conversation.status === 'OPEN';
  const hasConversation = !!conversation.conversationId;
  // The map point is the one thing publishing cannot do without and the AI may not propose, so
  // the conversation asks for it rather than leaving it to be discovered. Read from the facts
  // the conversation already holds, including the owner-private one; no extra server call.
  const held = (key: AiNeedV2Fact['key']) => conversation.facts.find(fact => fact.key === key)?.value;
  const gap = pointsMissing(held('need.task_geography'), held('need.resolved_location'));
  const needsPoint = open && gap.total > 0 && gap.done < gap.total;
  // What is still missing, counted where the person is, including the map point (the server's required list cannot
  // contain it, because the AI is not allowed to propose it). A required fact the AI has already proposed is not listed:
  // confirming what it proposed is the review screen's job, and the card's heading already shows it.
  const proposed = new Set(conversation.facts.filter(fact => fact.status !== 'UNKNOWN').map(fact => fact.key));
  const missing = conversation.review.missingRequired.filter(key => !proposed.has(key));
  // People never see a category (owner, PKG-031; the review screen leaves it out too): the AI writes it for matching only,
  // so it is never named as "still needed" (review r4 ra item 4). While it is missing the card claims nothing is.
  const hiddenMissing = missing.includes('need.category');
  const stillNeeded = [...missing.filter(key => key !== 'need.category').map(factDisplayLabel),
    ...(needsPoint ? ['tačka na mapi'] : [])];
  // At the start nothing is filled, so the full list is eight items long; the card names the first few and counts the rest.
  const stillNeededText = !stillNeeded.length ? null : stillNeeded.length <= 3 ? stillNeeded.join(' · ')
    : `${stillNeeded.slice(0, 3).join(' · ')} · i još ${stillNeeded.length - 3}`;
  // Current facts belong in the live card and the explicit full review. Decorating
  // old replies with today's fact values repeated the summary and rewrote history.
  const messages = conversation.messages;
  // The "···" of this conversation. Each row runs once the menu has gone, so a navigation or the next sheet never starts
  // underneath it. Photos are the composer's "+", not a row here. Before the first word there is no conversation to act
  // on, so there is no menu either.
  const menu: SheetAction[] = [];
  if (props.canReview) menu.push({ key: 'review', label: props.reviewLabel, icon: 'document', onPress: props.onReview });
  // A missing point is asked for in the thread, beside the words; the row brings that ask back only once it was put
  // away (review r4 ra item 13). A point already saved is changed in the task's review, where the place is edited:
  // the conversation's point editor has nothing to show once every point is saved, so a row for it led nowhere and
  // warned about points that were already saved (review r4 ra item 3).
  if (needsPoint && pointAskHidden) menu.push({ key: 'place', label: 'Mesto na mapi', icon: 'pin', onPress: () => setPointAskHidden(false) });
  if (hasConversation) menu.push({ key: 'refresh', label: 'Osveži razgovor', icon: 'check', disabled: props.readbackDisabled, onPress: props.onRefresh });
  if (props.onNewTask) menu.push({ key: 'new', label: 'Novi Zadatak', icon: 'tasks', disabled: props.newTaskDisabled, onPress: props.onNewTask });
  if (props.showAbandon) menu.push({ key: 'abandon', label: props.abandonLabel, icon: 'chat', destructive: true,
    disabled: props.abandonDisabled, subtitle: 'Povratak čuva razgovor. Napušten razgovor više ne možeš da nastaviš.', onPress: props.onAbandon });
  const note = safetyCopy && conversation.safety !== 'BLOCK' ? safetyCopy : null;
  return <AiConversationShell conversationKey={props.conversationKey ?? conversation.conversationId} title={conversation.review.boundNeedId ? 'Izmena zadatka' : 'Novi zadatak'}
    value={value} canEdit={props.canEdit} canSend={props.canSubmit}
    messages={messages} pending={pending} busy={busy} streamingText={props.streamingText}
    sentMessage={props.sentMessage}
    welcome="Reci šta ti treba."
    welcomeDetail="Opiši posao svojim rečima. Zajedno ćemo složiti detalje, a pre objave sve pregledaš."
    openings={OPENINGS} openingArts={['vehicle', 'tool', 'home']} placeholder="Opiši šta ti treba"
    onBack={props.onBack} onChange={props.onChange} onSend={props.onSend}
    onOptions={menu.length ? () => { Keyboard.dismiss(); setPanel('options'); } : undefined} voice={props.voice}
    attach={props.onPhotos ? { label: 'Fotografije zadatka', hint: 'Dodaj ili pregledaj fotografije zadatka.',
      onPress: props.onPhotos, disabled: props.photosDisabled } : undefined}
    // Nothing is pinned until the conversation has said or taken something: an empty card at the
    // top of a fresh screen states a draft that does not exist yet and buries the invitation.
    card={compact => !conversation.facts.length && !messages.length ? null : <DraftCard summary={summary}
      stillNeeded={stillNeededText} open={open} busy={busy} compact={compact} canReview={props.canReview}
      onReview={props.onReview} note={note} reviewLabel={props.reviewLabel} editing={!!conversation.review.boundNeedId}
      hiddenMissing={hiddenMissing} />}
    actions={
      // Only a hard block belongs in the thread. REVIEW and CLARIFY describe the draft, so they sit on its card.
      safetyCopy && conversation.safety === 'BLOCK' ? <T accessibilityRole="alert" variant="note" style={s.danger}>{safetyCopy}</T> : undefined}
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
    {panel === 'options' ? <ActionSheet label="Opcije razgovora" actions={menu} reduced={reduced} onClose={() => setPanel(null)} /> : null}
  </AiConversationShell>;
}

const s = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: sys.conversation.ground },
  ink: { color: sys.color.ink }, muted: { color: sys.color.muted }, danger: { color: sys.color.danger },
  // The living draft is a distinct summary above the thread, with the task card's facts and rhythm.
  card: { ...cardCompact, ...floating, gap: 8, backgroundColor: sys.conversation.summary, borderColor: sys.conversation.edge },
  cardCompact: { paddingVertical: 12, gap: 4 },
  compactTitle: { ...sys.type.cardTitleCompact },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.muted },
  // While the conversation changes the draft, the dot is the screen's orange accent: a dot, never a fill.
  dotBusy: { backgroundColor: sys.color.orange },
  status: { flex: 1, color: sys.color.muted, letterSpacing: 0.3 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headStacked: { gap: 4 },
  titleSide: { flex: 1, minWidth: 0 },
  titleEmpty: { color: sys.color.muted },
  next: { marginTop: 2 },
  ready: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  // The card's own fact size (`note`), in the weight of a way forward (verify r4b ra item C: it was a raw 14/19).
  readyText: { ...sys.type.note, fontWeight: '600', color: sys.color.green },
  unavailable: { flex: 1, paddingHorizontal: sys.space.xl, justifyContent: 'center' },
  loading: { gap: 16, alignItems: 'center' },
  unavailableMark: { width: 80, height: 80, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
});
