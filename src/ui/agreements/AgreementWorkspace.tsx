import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { brandAction, sys, inset } from '../system/tokens';
import { useTextScale } from '../system/textScale';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/**
 * Presentation pieces of the Agreement workspace, recomposed from zero (owner, 2026-09-23: the HTML
 * prototypes document function, not layout). A Dogovor is read in one pass: the terms, where it
 * stands, the people, then everything that can be opened as flat rows under hairlines. A tint is
 * spent only where something waits for a person (a proposal, a confirmation, a problem); nothing
 * else is a box. No state lives here; the route owns reads, writes, journals and guards.
 * This module must stay free of reanimated hooks and inbox reads (route tests isolate those),
 * so it uses only Press/T/icons/V2Action.
 */

export type WorkspaceTone = 'green' | 'warn' | 'muted' | 'danger';
const toneColor: Record<WorkspaceTone, string> = { green: sys.color.green, warn: sys.color.warn, muted: sys.color.muted, danger: sys.color.danger };
const toneSoft: Record<WorkspaceTone, string> = { green: sys.color.greenSoft, warn: sys.color.warnSoft, muted: sys.color.wash, danger: sys.color.dangerSoft };

export const stateTone = (state: DogovorProjekcija['stanje']): WorkspaceTone =>
  state === 'CANCELLED' ? 'muted' : state === 'AWAITING_REQUESTER' ? 'warn' : 'green';

/** A part of the workspace. A tone tints it only when it asks for attention (warn, danger); otherwise it is a hairline and air. */
export function WorkspaceCard({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: WorkspaceTone }) {
  const tinted = tone === 'warn' || tone === 'danger';
  return <View style={[tinted ? [inset, s.tinted, { backgroundColor: toneSoft[tone!] }] : s.flat, style]}>{children}</View>;
}

export type AgreementStep = { tone: WorkspaceTone; title: string; body: string | null };

/**
 * Where the Dogovor stands and what comes next, as the one place that says its state (round-1 critique A13: the bar,
 * the step and the people rows used to say it two or three times). The title is the state, or what waits when something
 * does; the body is the next step. Pure words: the route decides what can be done, and nothing here enables an action.
 *
 * - `party`: I am one of the two sides (a Dogovor read for someone else says the state and nothing to do).
 * - `change`: a proposal waits; `mine` is null when its content could not be read.
 * - `deadline`: the server's confirmation window, already written, used only while the requester's answer is awaited.
 */
export function agreementNextStep({ state, party, worker, change, ownRating, problemOpen, deadline }: {
  state: DogovorProjekcija['stanje']; party: boolean; worker: boolean;
  change: { waits: boolean; mine: boolean | null };
  ownRating: 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE';
  problemOpen: boolean; deadline: string;
}): AgreementStep {
  if (change.waits) return { tone: 'warn',
    title: change.mine === true ? 'Tvoj predlog izmene čeka odgovor' : change.mine === false ? CHANGE_WAITS_FOR_ME : 'Predlog izmene čeka odgovor',
    body: 'Završetak je moguć tek kada se predlog prihvati, odbije ili povuče.' };
  if (state === 'COMPLETED') return { tone: 'green', title: 'Dogovor je završen', body: !party ? null
    : ownRating === 'GIVEN' ? 'Hvala na saradnji. Tvoja ocena je sačuvana.'
      : ownRating === 'CLOSED' ? 'Hvala na saradnji.' : 'Hvala na saradnji. Ocena pomaže drugima da izaberu.' };
  if (state === 'CANCELLED') return { tone: 'muted', title: 'Dogovor je otkazan.', body: null };
  if (state === 'AWAITING_REQUESTER') return { tone: 'warn', title: worker ? 'Čeka se potvrda druge strane' : CONFIRM_WAITS_FOR_ME,
    body: problemOpen ? 'Prijavljen je problem — automatski završetak je zaustavljen.' : `${deadline}. Bez odgovora se Dogovor zatvara sam.` };
  // Confirmed: the state is the title and the next step its sentence. The title used to be the step, and the body
  // then said the same step again ("Kada završiš, označi završetak. Kada završiš, označi završetak…").
  return { tone: 'green', title: 'Dogovoreno', body: !party ? null : worker
    ? 'Kada završiš, označi završetak. Druga strana tada ima 48h da potvrdi ili prijavi problem.'
    : 'Završetak možeš potvrditi kada je posao obavljen, i pre nego što ga druga strana označi.' };
}

/** The step's own words where the step is mine, shared by the step card and the head of Poruke. */
const CHANGE_WAITS_FOR_ME = 'Predlog izmene čeka tvoj odgovor';
const CONFIRM_WAITS_FOR_ME = 'Završetak je označen i čeka tvoju potvrdu';
/** A finished Dogovor while my rating is due, in the Dogovori list's words for it (owner, 2026-09-23). */
export const RATING_WAITS_FOR_ME = 'Čeka tvoju ocenu';

/**
 * What this Dogovor waits for from ME, if anything, in the step's order and words: a change the other side proposed (it
 * blocks both completions, so it comes first), then a completion the other side marked, which I as the requester
 * confirm, then my rating once the review read says it is due. A change I proposed, a completion the other side has to
 * confirm, or a rating the read could not answer for ("UNKNOWN" is no claim that it waits) gives null. The head of Poruke
 * says it (review r4 rd: the bar used to show the state there, and Poruke no longer said that the Dogovor waits for me).
 */
export function agreementWaitsForMe({ state, requester, change, ownRating }: {
  state: DogovorProjekcija['stanje']; requester: boolean;
  change: { waits: boolean; mine: boolean | null };
  ownRating: 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE';
}): string | null {
  if (change.waits) return change.mine === false ? CHANGE_WAITS_FOR_ME : null;
  if (state === 'AWAITING_REQUESTER') return requester ? CONFIRM_WAITS_FOR_ME : null;
  return state === 'COMPLETED' && ownRating === 'DUE' ? RATING_WAITS_FOR_ME : null;
}

/**
 * Where the Dogovor stands and what comes next, said once: a dot in the state's colour and a sentence.
 * The eyebrow "Sledeći korak" is gone (owner, 2026-09-23: no copy explaining where you are); a soft
 * tint remains only when the step waits for someone.
 */
export function NextStepCard({ title, body, tone = 'green', children }: { title: string; body?: string | null; tone?: WorkspaceTone; children?: ReactNode }) {
  const previousTitle = useRef(title);
  useEffect(() => {
    if (title === previousTitle.current) return;
    previousTitle.current = title;
    // Android reads the persistent live text below. VoiceOver needs the changed step explicitly, never its initial title.
    if (title && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(title);
  }, [title]);
  const waits = tone === 'warn' || tone === 'danger';
  return <View accessibilityRole="summary" style={waits ? [inset, s.tinted, { backgroundColor: toneSoft[tone] }] : s.next}>
    <View style={s.nextHead}><View style={[s.dot, { backgroundColor: toneColor[tone] }]} />
      <T variant="bodyStrong" accessibilityLiveRegion="polite" style={s.nextTitle}>{title}</T></View>
    {body ? <T variant="note" tone="muted" style={s.nextBody}>{body}</T> : null}
    {children}
  </View>;
}

/** Contextual action as a row: its art, the label, an optional hint, the caret. Label stays the screen's contract. */
export function WorkspaceRow({ label, hint, art, disabled = false, onPress }: { label: string; hint?: string; art?: FactArtKind; disabled?: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={0.99}
    onPress={onPress} style={[s.row, disabled && s.rowDisabled]}>
    {art ? <View style={s.rowArt}><FactArt kind={art} size={26} /></View> : null}
    <View style={s.rowCopy}><T variant="bodyStrong" style={[s.rowLabel, disabled && s.rowLabelOff]}>{label}</T>{hint ? <T variant="note" tone="muted">{hint}</T> : null}</View>
    <CaretRight size={20} color={sys.color.muted} />
  </Press>;
}

/** Rows one under the other, each under its own hairline; no card around them. */
export function WorkspaceRows({ children }: { children: ReactNode }) { return <View>{children}</View>; }

export function WorkspaceNote({ children, tone = 'muted' }: { children: ReactNode; tone?: WorkspaceTone }) {
  return <View style={[s.note, { backgroundColor: toneSoft[tone] }]}>{children}</View>;
}

/** Native ScrollView has no useful intrinsic height here. Measure only the message; both commands stay outside it. */
function RecoveryMessage({ message, limit }: { message: string; limit: number }) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  return <ScrollView testID="agreement-action-recovery" style={[s.feedbackScroll, { height: Math.min(contentHeight ?? limit, limit) }]}
    keyboardShouldPersistTaps="handled" nestedScrollEnabled scrollEnabled={contentHeight === null || contentHeight > limit}
    onContentSizeChange={(_width, height) => {
      if (!Number.isFinite(height) || height <= 0) return;
      const measured = Math.ceil(height);
      setContentHeight(current => current === measured ? current : measured);
    }}>
    <T accessibilityRole="alert" variant="note" style={s.feedbackText}>{message}</T>
  </ScrollView>;
}

/**
 * Sticky footer: exactly one brand action per state. The second button, "Otvori poruke", is gone: the
 * Poruke tab stands at the top of the same screen, so the footer said it twice and took a quarter of it.
 */
export function WorkspaceFooter({ brand, loading = false, statusText, notice }: {
  brand: { label: string; onPress: () => void; disabled?: boolean };
  loading?: boolean;
  statusText?: string | null;
  notice?: { message: string; refresh: () => void; refreshing: boolean } | null;
}) {
  const { width, height } = useWindowDimensions(), textScale = useTextScale();
  // Bound the reading area, never the footer: enlarged command labels keep their full natural touch height.
  const messageLimit = Math.max(48, Math.min(180, Math.floor(height / 4)));
  const recoveryMessage = notice?.message || null;
  const announcedRecovery = useRef<string | null>(null);
  useEffect(() => {
    if (recoveryMessage === announcedRecovery.current) return;
    announcedRecovery.current = recoveryMessage;
    // The recovery mounts with its text, so announce it directly on both platforms instead of also using a live region.
    // Clearing the message resets the episode: the same failure after a later attempt must be heard again.
    if (recoveryMessage) AccessibilityInfo.announceForAccessibility(recoveryMessage);
  }, [recoveryMessage]);
  return <View testID="agreement-action-footer" style={s.footer}>
    {notice ? <View style={s.feedback}>
      <RecoveryMessage key={JSON.stringify([notice.message, width, textScale])} message={notice.message} limit={messageLimit} />
      <V2Action label="Osveži status Dogovora" kind="quiet" loading={notice.refreshing}
        disabled={notice.refreshing} onPress={notice.refresh} />
    </View> : statusText ? <T variant="note" style={s.feedbackText}>{statusText}</T> : null}
    <V2Action label={brand.label} disabled={brand.disabled} loading={loading && !!brand.disabled}
      onPress={brand.onPress} style={brandAction} />
  </View>;
}

const s = StyleSheet.create({
  flat: { gap: 10, paddingTop: 18, borderTopWidth: 1, borderTopColor: sys.color.line },
  tinted: { gap: 8, padding: 16 },
  next: { gap: 6 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill },
  nextTitle: { color: sys.color.ink, flexShrink: 1, fontSize: 17, lineHeight: 23 },
  nextBody: { paddingLeft: 17 },
  row: { minHeight: 60, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderColor: sys.color.line },
  rowArt: { width: 32, alignItems: 'center' },
  rowDisabled: { backgroundColor: sys.color.wash },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowLabel: { color: sys.color.ink },
  rowLabelOff: { color: sys.color.muted },
  note: { ...inset, padding: 16, gap: 8 },
  footer: { flexShrink: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  feedbackScroll: { flexGrow: 0, flexShrink: 0 },
  feedback: { padding: 12, gap: 4, borderRadius: sys.radius.control, backgroundColor: sys.color.warnSoft },
  feedbackText: { color: sys.color.ink },
});
