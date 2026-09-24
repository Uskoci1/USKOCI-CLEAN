import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fixedApplicationPeople, needPriceText, needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, CaretRight, Check, PaperPlaneTilt } from 'phosphor-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useReducedMotion } from '../system/motion';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import { calendarInstant } from '../../lib/calendarTime';
import { novac } from '../../lib/novac';
import type { Ishod } from '../../data/ports';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, displayDate, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import type { AvatarSize } from '../system/Avatar';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { PublicProfileSheet, type PublicProfileState, type SafetyEntry } from '../system/PublicProfileSheet';
import { DetailSection, ProductFact, ProductFacts, ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { FactArt } from '../system/FactArt';
import { dolaziOsoba, osoba, osobuAkuz, prijava } from '../system/plural';
import { StateView } from '../system/StateView';
import { SuccessMark } from '../system/SuccessMark';
import { useTextScale } from '../system/textScale';
import { brandAction, card, cardCompact, sys, inset, field } from '../system/tokens';
import { T } from '../Text';
import { CandidateCard, CandidateCompareCard, CandidatePerson, CandidateStatusLine, UNPRICED, candidateStatus, candidateTime, candidateValue } from './CandidateFace';
import { V2Action } from './V2Action';

export type ApplicationDraft = { price: string; people: string; note: string; start: string | null; end: string | null };
function applicationInterval(start: string | null | undefined, end: string | null | undefined, timezone?: string): string | null {
  const from = calendarInstant(start), to = calendarInstant(end);
  if (from === null || to === null || from >= to) return null;
  try {
    const zone = timezone ?? 'UTC';
    const a = zonedParts(new Date(Number(from / 1000n)), zone), b = zonedParts(new Date(Number(to / 1000n)), zone);
    return `${displayDate(a.date)} · ${a.time.slice(0, 5)}–${a.date === b.date ? '' : `${displayDate(b.date)} · `}${b.time.slice(0, 5)} (${zone === 'Europe/Belgrade' ? 'po vremenu u Srbiji' : zone})`;
  } catch { return null; }
}

/** Shared identity, keyboard-safe body and one next action. */
function SelectionFrame({ title, back, children, footer, scroll = true, backLabel = 'Nazad na zadatak', right }: {
  title: string; back: () => void; children: ReactNode; footer?: ReactNode; scroll?: boolean; backLabel?: string;
  /** One quiet control at the end of the top bar, for a list's own view switch. */
  right?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader backLabel={backLabel} title={title} back={back} right={right} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.grow}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(sys.motion.enter)} style={s.stack}>{children}</Animated.View>
      </ScrollView> : <View style={s.grow}>{children}</View>}{footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
/**
 * While the read runs, the shape of what is coming stands in for it — cards, not a spinner — so nothing jumps when the rows
 * arrive; a read that failed says so the one way every screen does (`StateView`): its first sentence as the title, the
 * rest under it, and the retry as the green action.
 */
export function SelectionUnavailable({ loading, message, retry, back }: { loading: boolean; message: string; retry?: () => void; back: () => void }) {
  const [title, body] = splitFirstSentence(message);
  return <SelectionFrame title="Prijave" back={back}>
    {loading ? <StateView kind="loading" title="Učitavamo aktuelne podatke…" skeleton={{ count: 3, rows: 2 }} />
      : <StateView kind="error" title={title} body={body ?? undefined} primary={retry ? { label: 'Pokušaj ponovo', onPress: retry } : undefined} />}
  </SelectionFrame>;
}
/** "Zadatak se upravo promenio. Učitaj Prijave ponovo." → the first sentence and the rest; one sentence stays whole. */
function splitFirstSentence(message: string): [string, string | null] {
  const match = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(message.trim());
  return match ? [match[1], match[2]] : [message.trim(), null];
}
/** The Task the offer belongs to, as a compact context card. The green title is the task; no word
 *  above it says so (owner's rule, 2026-09-23: nothing explains where you are). */
function TaskContext({ need }: { need: PotrebaProjekcija | PrilikaProjekcija }) {
  const price = needPriceText(need);
  // "Tražim ponude" and "Cena nije navedena" are words about a price, never dressed as an amount.
  const priceIsAmount = need.rezimCene === 'MY_PRICE' && /\d/.test(price);
  return <View style={s.context}><T style={s.contextTitle}>{readableTitle(need.naslov)}</T>
    <T variant="meta" tone="muted">{need.podrucjeTekst}</T><T variant="meta" tone="muted">{need.vremeTekst}</T>
    <View style={s.row}><T style={[s.contextPrice, !priceIsAmount && s.offers]}>{price}</T>
      <View style={s.pill}><T variant="meta" style={s.pillText}>{need.pokrivenost.popunjeno} / {need.pokrivenost.ukupno} mesta</T></View></View>
  </View>;
}
/** `loading` is this action's own write in flight: the button keeps its green and its words, with a spinner. */
function BrandAction({ label, onPress, disabled, loading, reason, send }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; reason?: string | null; send?: boolean;
}) {
  return <V2Action label={label} onPress={onPress} disabled={disabled} loading={loading} reason={reason}
    icon={send ? <PaperPlaneTilt size={20} color={sys.color.onGreen} weight="fill" /> : undefined} style={brandAction} />;
}
function ErrorMessage({ error }: { error?: string | null }) {
  return error ? <View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{error}</T></View> : null;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <View style={s.field}><T variant="meta" tone="muted">{label}</T>{children}</View>;
}
function IntervalEditor({ draft, timezone, close, accept }: {
  draft: ApplicationDraft; timezone: string; close: () => void; accept: (start: string | null, end: string | null) => void;
}) {
  const reduced = useReducedMotion();
  const [start, setStart] = useState(() => draft.start ? zonedParts(new Date(draft.start), timezone) : { date: '', time: '' });
  const [end, setEnd] = useState(() => draft.end ? zonedParts(new Date(draft.end), timezone) : { date: '', time: '' });
  const [dirtyStart, setDirtyStart] = useState(false), [dirtyEnd, setDirtyEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apply = () => {
    const from = draft.start && !dirtyStart ? { value: draft.start, error: null } : civilInstant(start.date, start.time, timezone);
    const to = draft.end && !dirtyEnd ? { value: draft.end, error: null } : civilInstant(end.date, end.time, timezone);
    if (!from.value || !to.value) { setError(from.error ?? to.error); return; }
    const a = calendarInstant(from.value), b = calendarInstant(to.value);
    if (a === null || b === null || a >= b) { setError('Kraj termina mora biti posle početka.'); return; }
    accept(from.value, to.value);
  };
  return <Modal visible presentationStyle="pageSheet" animationType={reduced ? 'none' : 'slide'} onRequestClose={close}>
    <SelectionFrame title="Predlog termina" back={close} footer={<BrandAction label="Potvrdi termin" onPress={apply} />}>
      <View style={s.card}>
        <T accessibilityRole="header" variant="title" style={s.ink}>Ponudi tačan početak i kraj.</T>
        <T variant="body" tone="muted">{timezone === 'Europe/Belgrade' ? 'Vreme je po vremenu u Srbiji.' : `Vremenska zona: ${timezone}.`} Ovaj predlog pripada tvojoj Prijavi.</T>
      </View>
      <View style={s.card}>
        <CivilField label="Datum početka" mode="date" value={start.date} onChange={value => { setStart(v => ({ ...v, date: value })); setDirtyStart(true); }} />
        <CivilField label="Početak" mode="time" value={start.time} onChange={value => { setStart(v => ({ ...v, time: value })); setDirtyStart(true); }} />
        <CivilField label="Datum kraja" mode="date" value={end.date} onChange={value => { setEnd(v => ({ ...v, date: value })); setDirtyEnd(true); }} />
        <CivilField label="Kraj" mode="time" value={end.time} onChange={value => { setEnd(v => ({ ...v, time: value })); setDirtyEnd(true); }} />
      </View>
      <ErrorMessage error={error} /><V2Action label="Koristi termin Zadatka" onPress={() => accept(null, null)} />
    </SelectionFrame>
  </Modal>;
}
/** Composer of one application: price for the offered scope, people, optional exact interval, short note, one send. */
export function ApplicationSelectionPresentation({ need, opportunity, draft, change, submit, back, busy, pending, uncertain, refresh, error, confirmed, openApplications, canSubmit, reset, blocked }: {
  need: PotrebaProjekcija; opportunity: PrilikaProjekcija; draft: ApplicationDraft; change: (value: ApplicationDraft) => void;
  submit: () => void; back: () => void; busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void;
  error: string | null; confirmed: boolean; openApplications: () => void; canSubmit: boolean; reset?: () => void;
  /** Why the brand action is grey, said next to it, with the one place that fixes it when there is one. */
  blocked?: { reason: string; actionLabel?: string; onAction?: () => void } | null;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const [review, setReview] = useState<{ key: string } | null>(null);
  const reduced = useReducedMotion();
  // The review only stages presentation. The route still validates, journals and sends the command.
  // A changed draft/task cannot be sent through a retained confirmation from the previous review.
  const reviewKey = JSON.stringify([need.id, need.revizija, need.naslov, need.vremeTekst, need.taskTimezone, need.schedule, draft]);
  const reviewing = !!review && review.key === reviewKey && !busy && !pending && !confirmed && canSubmit;
  const liveReview = useRef<typeof review>(null);
  liveReview.current = reviewing ? review : null;
  const closeReview = () => { liveReview.current = null; setReview(null); };
  const confirmReview = () => {
    if (!review || liveReview.current !== review) return;
    closeReview(); submit();
  };
  const disabled = busy || pending || confirmed;
  const exact = applicationInterval(draft.start, draft.end, need.taskTimezone);
  const fixed = need.schedule?.kind === 'FIXED_WINDOW' ? applicationInterval(need.schedule.startsAt, need.schedule.endsAt, need.taskTimezone) : null;
  const reviewPrice = /^\d+$/.test(draft.price) && Number.isSafeInteger(Number(draft.price)) && Number(draft.price) > 0 ? novac(Number(draft.price)) : null;
  const reviewTime = exact ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: draft.start, endsAt: draft.end }, need.taskTimezone)
    : fixed && need.schedule ? needScheduleText(need.schedule, need.taskTimezone) : need.vremeTekst;
  const priceLocked = opportunity.rezimCene === 'MY_PRICE';
  // The rule behind the locked price is said in words, from the same Need read the price came from (8.10).
  const peopleLocked = fixedApplicationPeople(need) !== null;
  const priceRule = !priceLocked ? 'Ovo je ukupan iznos za sve ljude koje dovodiš, ne cena po osobi.'
    : need.osnovaCene === 'PER_PERSON' ? `Cena je ${need.ponudjenaCena?.prikaz ?? 'navedena'} po osobi, pa se ukupan iznos računa po broju ljudi koje dovodiš.`
    : peopleLocked ? `Cena važi za ceo Zadatak, pa prijava pokriva sva mesta: ${osoba(need.pokrivenost.ukupno)}.`
    : 'Cena je navedena u Zadatku. Ovo je ukupan iznos za sve ljude koje dovodiš, ne cena po osobi.';
  const shownBlock = !canSubmit && !confirmed && !pending && blocked ? blocked : null;
  // The footer's last branch: nothing sent, nothing uncertain, nothing in flight, so "Pregledaj ponudu" is the action.
  const reviewAction = !confirmed && !uncertain && !pending && !busy;
  return <SelectionFrame title="Tvoja prijava" back={back} footer={<>
    <View style={s.summaryRow}><T variant="meta" tone="muted">Tvoja ponuda</T><T style={s.summary}>{reviewPrice ?? 'Proveri unetu cenu'}{reviewPrice ? ' ukupno' : ''} · {/^[1-9]\d*$/.test(draft.people) ? dolaziOsoba(Number(draft.people)) : 'broj ljudi nije unet'}</T></View>
    {confirmed ? <BrandAction label="Otvori moje prijave" onPress={openApplications} />
      : uncertain ? <BrandAction label="Proveri ishod" onPress={refresh} disabled={busy} />
      : pending || busy ? <BrandAction label={busy ? 'Slanje…' : 'Ponovi istu Prijavu'} onPress={submit} disabled={busy} loading={busy} send />
      : <BrandAction label="Pregledaj ponudu" onPress={() => {
        if (!disabled && canSubmit && !reviewing) { Keyboard.dismiss(); setReview({ key: reviewKey }); }
      }} disabled={!canSubmit || reviewing} reason={shownBlock && reviewAction ? shownBlock.reason : null} />}
    {/* A grey button with nothing beside it is a dead end; the reason stands under it, with the way out. On the review
        button the reason is the button's own line (and its spoken hint); beside the other actions it stands here. */}
    {shownBlock && (!reviewAction || !!(shownBlock.actionLabel && shownBlock.onAction)) ? <View style={s.blocked}>
      {reviewAction ? null : <T accessibilityLiveRegion="polite" variant="meta" tone="muted" style={s.center}>{shownBlock.reason}</T>}
      {shownBlock.actionLabel && shownBlock.onAction ? <V2Action kind="quiet" compact label={shownBlock.actionLabel} onPress={shownBlock.onAction} /> : null}
    </View> : null}
  </>}>
    <TaskContext need={opportunity} />
    <View style={s.card}><T variant="meta" style={s.eyebrow}>Tvoja ponuda</T>
      <View style={s.offerRow}>
        <Field label="Ukupno (RSD)">
          <TextInput accessibilityLabel="Ukupna cena za ljude koje dovodiš (RSD)" keyboardType="number-pad" maxLength={10} value={draft.price}
            editable={!disabled && !priceLocked} style={[s.amountInput, priceLocked && s.inputLocked]}
            onChangeText={price => { if (!disabled && !priceLocked) change({ ...draft, price }); }} />
        </Field>
        <Field label="Ljudi">
          <TextInput accessibilityLabel="Ljudi" keyboardType="number-pad" maxLength={4} value={draft.people} editable={!disabled && !peopleLocked}
            style={[s.amountInput, peopleLocked && s.inputLocked]} onChangeText={people => { if (!disabled && !peopleLocked) change({ ...draft, people }); }} />
        </Field>
      </View>
      <T variant="meta" tone="muted">{priceRule}</T>
    </View>
    {/* One card used to be called "Termin i poruka" and hold both, so the word Termin appeared
        twice inside it and neither half was a whole thought. Two blocks, one idea each. */}
    <View style={s.card}><T variant="meta" style={s.eyebrow}>Termin</T>
      <Press accessibilityRole="button" accessibilityLabel="Termin Prijave" disabled={disabled} accessibilityState={{ disabled }} haptic="select" scaleTo={0.99}
        onPress={() => setEditingTime(true)} style={s.term}>
        <FactArt kind="calendar" size={32} />
        <T variant="bodyStrong" style={[s.ink, s.grow]}>{exact ?? fixed ?? need.vremeTekst}</T>
        <CaretRight size={20} color={sys.color.muted} />
      </Press>
      {!exact && !fixed ? <T variant="meta" tone="muted">Tačan termin još nije ponuđen. Fleksibilno vreme ne rezerviše tačan interval.</T> : null}
    </View>
    <View style={s.card}><T variant="meta" style={s.eyebrow}>Poruka uz prijavu</T>
      <TextInput accessibilityLabel="Kratka napomena" multiline maxLength={4000} value={draft.note} editable={!disabled} style={[s.input, s.multiline]}
        placeholder="Ono što pomaže da se tvoja ponuda razume." placeholderTextColor={sys.color.muted}
        onChangeText={note => { if (!disabled) change({ ...draft, note }); }} />
    </View>
    <ErrorMessage error={error} />
    {error && !pending ? <V2Action label="Osveži Zadatak" onPress={refresh} disabled={busy} /> : null}
    {pending && !confirmed ? <T variant="meta" tone="muted">Sačuvana je ista ponuda za proveru ishoda. Ponavljanje koristi njen prvobitni termin, cenu i broj ljudi.</T> : null}
    {confirmed ? <View style={[s.card, s.cardSuccess]}><T accessibilityRole="alert" variant="title" style={s.ink}>Prijava je poslata.</T><T variant="body" tone="muted">Onaj ko je objavio zadatak može da izabere ovu konkretnu ponudu. Izbor odmah sklapa Dogovor.</T></View> : null}
    {reset ? <V2Action label="Pregledaj uslove i uredi novu ponudu" onPress={reset} disabled={busy} /> : null}
    {editingTime && !disabled ? <IntervalEditor draft={draft} timezone={need.taskTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
      close={() => setEditingTime(false)} accept={(start, end) => { change({ ...draft, start, end }); setEditingTime(false); }} /> : null}
    {reviewing ? <Modal visible presentationStyle="pageSheet" animationType={reduced ? 'none' : 'slide'} onRequestClose={closeReview}>
      <SelectionFrame title="Pregled ponude" backLabel="Nazad na izmenu ponude" back={closeReview}
        footer={<BrandAction label="Pošalji ovu Prijavu" onPress={confirmReview} send />}>
        <View style={s.reviewContext}>
          <T style={s.contextTitle}>{readableTitle(opportunity.naslov)}</T>
          <T variant="meta" tone="muted">{opportunity.podrucjeTekst}</T></View>
        <View style={s.card}>
          <T variant="meta" style={s.eyebrow}>Ovo šalješ</T>
          <ProductFacts>
            <ProductFact art="money" label="Ukupna ponuda" prominent={reviewPrice !== null}
              value={reviewPrice ?? 'Proveri unetu cenu'} note={reviewPrice ? 'Ukupno za sve ljude koje dovodiš' : undefined} />
            <ProductFact art="users" label="Ljudi" value={/^[1-9]\d*$/.test(draft.people) ? osoba(Number(draft.people)) : 'Proveri broj ljudi'} />
            <ProductFact art="calendar" label="Termin" value={reviewTime}
              note={!exact && !fixed ? 'Tačan početak i kraj još nisu dogovoreni.' : undefined} />
          </ProductFacts>
        </View>
        <View style={s.card}><T variant="meta" style={s.eyebrow}>Tvoja poruka</T>
          <T variant="body" style={s.ink}>{draft.note.trim() || 'Bez dodatne poruke.'}</T></View>
        <T variant="meta" tone="muted">Ponuda ide uz ovaj zadatak. Ako bude izabrana, nastaje Dogovor.</T>
        <V2Action label="Izmeni ponudu" kind="quiet" onPress={closeReview} />
      </SelectionFrame>
    </Modal> : null}
  </SelectionFrame>;
}
/** A person's picture at the size its place asks for, handed in by the screen; the Avatar with their letters when absent. */
export type CandidatePhoto = (candidate: KandidatProjekcija, size: AvatarSize) => ReactNode;

/** The side padding of a screen body here (the list and the composer). */
const LIST_PADDING = 20;
const candidateKey = (k: KandidatProjekcija) => k.prijavaId;
const CandidateSeparator = () => <View style={s.separator} />;
/**
 * One candidate in the list, as a card or as a comparison column. Memoised on the row's own object
 * and primitives so a re-render of the screen touches only the rows whose offer changed; the
 * closure over `candidate` is made here, from the list's one stable `open`.
 */
const CandidateItem = memo(function CandidateItem({ candidate, need, index, animate, compare, columnWidth, large, narrow, open, photo }: {
  candidate: KandidatProjekcija; need: PotrebaProjekcija; index: number; animate: boolean; compare: boolean;
  /** The width of one of two comparison columns; null in one column. A lone last offer keeps it instead of the whole row. */
  columnWidth: number | null; large: boolean; narrow: boolean; open: (candidate: KandidatProjekcija) => void; photo?: CandidatePhoto;
}) {
  const openThis = useCallback(() => open(candidate), [open, candidate]);
  const face = photo?.(candidate, 40);
  return <Appear index={index} animate={animate} style={columnWidth ? { width: columnWidth } : undefined}>
    {compare ? <CandidateCompareCard candidate={candidate} timezone={need.taskTimezone} fallbackTime={need.vremeTekst} onOpen={openThis}
      photo={face} aligned={columnWidth !== null} />
      : <CandidateCard candidate={candidate} timezone={need.taskTimezone} onOpen={openThis} photo={face} large={large} narrow={narrow} />}
  </Appear>;
});

/**
 * How the loaded offers are ordered, on the phone and without a new request. The rows carry no time of
 * sending, so there is no "newest" to promise: the first order is the server's own, which
 * `rpc_list_need_candidates` sends by `submitted_at asc` (earliest first), and the other is by the
 * total asked. Both are stable, so offers that tie keep their order of arrival.
 */
export type CandidateSort = 'ARRIVAL' | 'PRICE';
const SORTS: readonly CandidateSort[] = ['ARRIVAL', 'PRICE'];
const SORT_LABEL: Record<CandidateSort, string> = { ARRIVAL: 'Redom pristizanja', PRICE: 'Najniža cena' };
export function sortCandidates(candidates: readonly KandidatProjekcija[], sort: CandidateSort): readonly KandidatProjekcija[] {
  // The server's order is the list exactly as read: the same array, so the default draws what it always drew.
  if (sort === 'ARRIVAL') return candidates;
  return candidates.map((k, at) => ({ k, at })).sort((a, b) => a.k.cena.iznos - b.k.cena.iznos || a.at - b.at).map(({ k }) => k);
}

/** The Task these offers answer, as one row that opens it: its title and how many places are still free. */
function TaskBrief({ need, open }: { need: PotrebaProjekcija; open?: () => void }) {
  const title = readableTitle(need.naslov), { preostalo, ukupno } = need.pokrivenost;
  const places = preostalo > 0 ? `${preostalo} od ${ukupno} mesta je slobodno` : 'Sva mesta su popunjena';
  const body = <><FactArt kind="tasks" size={28} />
    <View style={s.briefCopy}><T variant="bodyStrong" style={s.ink} numberOfLines={2}>{title}</T><T variant="meta" tone="muted">{places}</T></View>
    {open ? <CaretRight size={18} color={sys.color.muted} /> : null}</>;
  return open ? <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${title}`} accessibilityHint={places}
    haptic="select" scaleTo={0.99} onPress={open} style={s.brief}>{body}</Press>
    : <View accessible accessibilityLabel={`${title}. ${places}`} style={s.brief}>{body}</View>;
}

/**
 * Candidates of one Task (owner's step 7, 2026-09-24): the offers as person-first cards (`CandidateFace`), or side by
 * side for a fast decision (owner decision 3, TARG-034). Two columns only while they fit: a phone at least 360 wide and a
 * text size under the owner's Large (read rounded, since Android hands Large over as 1.2999999523); the same two conditions
 * move a card's total under the person. An offer opens as a sheet over this list, so the list is still where the person
 * left it when they close it.
 */
export function CandidateListPresentation({ need, candidates, open, back, refresh, openTask, sort: chosenSort, onSort, photo, textScale: forcedScale }: {
  need: PotrebaProjekcija; candidates: KandidatProjekcija[]; open: (candidate: KandidatProjekcija) => void; back: () => void; refresh: () => void;
  /** The row at the top opens the Task these offers answer. */
  openTask?: () => void;
  /** The order the route keeps, so it survives opening an offer and coming back. Held here when absent. */
  sort?: CandidateSort; onSort?: (sort: CandidateSort) => void;
  /** The person's photo in a row; the Avatar with their letters when absent. */
  photo?: CandidatePhoto;
  /** The text size the layout follows; the phone's own (rounded) when absent. Only the internal gallery sets it. */
  textScale?: number;
}) {
  const [compare, setCompare] = useState(false);
  const [ownSort, setOwnSort] = useState<CandidateSort>('ARRIVAL');
  const [sorting, setSorting] = useState(false);
  const sort = chosenSort ?? ownSort;
  const { width } = useWindowDimensions();
  // Rounded: Android's "Large" arrives as 1.2999999523 and must count as the 1.3 it is.
  const phoneScale = useTextScale();
  const textScale = forcedScale ?? phoneScale;
  const large = textScale >= 1.3, narrow = width < 360;
  const columns = compare && !narrow && !large ? 2 : 1;
  // Two columns share the list's width less its side padding and the gap between them.
  const columnWidth = columns === 2 ? Math.floor((width - 2 * LIST_PADDING - sys.space.md) / 2) : null;
  // A new offer arriving is the news this screen exists to carry, so it is the one thing that moves.
  // The list that was already there settles silently, and switching to the comparison and back is
  // not an arrival either — `seen` belongs to this component, not to the FlatList it remounts.
  const appear = useAppear();
  appear.settle(candidates.map(candidateKey));
  // The route's `open` is a fresh closure every render (its guards read the latest read); the rows
  // get one function that never changes. `useAppear` is read through a ref for the same reason.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(open); openRef.current = open;
  const openCandidate = useCallback((k: KandidatProjekcija) => openRef.current(k), []);
  const renderItem = useCallback(({ item: k, index }: ListRenderItemInfo<KandidatProjekcija>) =>
    <CandidateItem candidate={k} need={need} index={index} animate={appearRef.current.isNew(candidateKey(k))} compare={compare} columnWidth={columnWidth}
      large={large} narrow={narrow} open={openCandidate} photo={photo} />,
  [need, compare, columnWidth, large, narrow, openCandidate, photo]);
  // Ordering only rearranges the row objects already read; a memoised row redraws only if its place changed.
  const rows = useMemo(() => sortCandidates(candidates, sort), [candidates, sort]);
  const choose = (value: CandidateSort) => { setSorting(false); if (onSort) onSort(value); else setOwnSort(value); };
  // PKG-035: the list keeps every application, historical ones included; the ones that can still be
  // chosen are a different number and are named as such, never mixed into the total.
  const selectable = candidates.filter(k => k.stanje === 'SELECTABLE').length;
  const counts = `${prijava(candidates.length)}${selectable !== candidates.length ? ` · ${selectable} za izbor` : ''}`;
  // An offer that can be read but not chosen says why on its own card; this says once what that means.
  const unavailable = candidates.some(k => k.stanje !== 'SELECTABLE' && k.stanje !== 'SELECTED');
  return <SelectionFrame title={compare ? 'Uporedi prijave' : 'Prijave'} back={compare ? () => setCompare(false) : back} scroll={false}
    right={candidates.length > 1 ? <V2Action label={compare ? 'Prikaži ponude' : 'Uporedi'} kind="quiet" compact onPress={() => setCompare(v => !v)} /> : undefined}>
    <FlatList key={`${compare ? 'comparison' : 'offers'}:${columns}`} numColumns={columns} data={rows} keyExtractor={candidateKey} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
      contentContainerStyle={s.content} ItemSeparatorComponent={CandidateSeparator} columnWrapperStyle={columns > 1 ? s.columnRow : undefined}
      ListHeaderComponent={<View style={s.listHeader}><TaskBrief need={need} open={openTask} />
        {candidates.length ? <View style={s.toolbar}><T variant="meta" tone="muted" style={s.grow}>{counts}</T>
          {candidates.length > 1 ? <Press accessibilityRole="button" accessibilityLabel={`Redosled prijava: ${SORT_LABEL[sort]}`}
            accessibilityHint="Otvara izbor redosleda" accessibilityState={{ expanded: sorting }} haptic="select"
            onPress={() => setSorting(value => !value)} style={s.sortButton}>
            <T variant="meta" style={s.sortText}>{SORT_LABEL[sort]}</T><CaretDown size={16} color={sys.color.ink} />
          </Press> : null}</View> : null}
        {sorting && candidates.length > 1 ? <View accessibilityRole="radiogroup" style={s.sortMenu}>{SORTS.map((option, at) =>
          <Press key={option} accessibilityRole="radio" accessibilityLabel={SORT_LABEL[option]} accessibilityState={{ checked: sort === option }}
            haptic="select" scaleTo={0.99} onPress={() => choose(option)} style={[s.sortOption, at > 0 && s.sortDivider]}>
            <T variant="body" style={[s.grow, s.ink]}>{SORT_LABEL[option]}</T>{sort === option ? <Check size={18} weight="bold" color={sys.color.green} /> : null}
          </Press>)}</View> : null}
      </View>}
      // What happens next, without promising that anyone will apply.
      ListEmptyComponent={<StateView kind="empty" art="offers" title="Još nema prijava"
        body="Kad neko pošalje ponudu za ovaj zadatak, videćeš je ovde i moći ćeš da je uporediš pre izbora."
        quiet={{ label: 'Osveži prijave', onPress: refresh }} />}
      renderItem={renderItem}
      ListFooterComponent={candidates.length ? <View style={s.listFooter}>
        {unavailable ? <View style={s.footnote}><FactArt kind="info" size={20} muted />
          <T variant="note" tone="muted" style={s.grow}>Prijavu koja sada nije za izbor možeš da pročitaš, ali ne i da izabereš. Razlog piše na njenoj kartici.</T></View> : null}
        <V2Action label="Osveži prijave" kind="quiet" onPress={refresh} style={s.footerAction} />
      </View> : null} />
  </SelectionFrame>;
}
function SelectedAgreementAction({ load, open }: { load: () => Promise<Ishod<{ dogovorId: string | null }>>; open: (id: string) => void }) {
  const [state, setState] = useState<{ loading: boolean; id: string | null }>({ loading: true, id: null });
  const request = useRef(0);
  const read = async () => {
    const generation = ++request.current;
    setState({ loading: true, id: null });
    try {
      const result = await load();
      if (request.current === generation) setState({ loading: false, id: result.ok ? result.podatak.dogovorId : null });
    } catch { if (request.current === generation) setState({ loading: false, id: null }); }
  };
  useEffect(() => { void read(); return () => { request.current++; }; }, [load]);
  if (state.id) return <BrandAction label="Otvori Dogovor" onPress={() => { if (state.id) open(state.id); }} />;
  return <><T variant="meta" tone="muted" style={s.center}>{state.loading ? 'Proveravamo Dogovor uz ovu Prijavu…' : 'Veza sa Dogovorom trenutno nije dostupna.'}</T>
    <V2Action label="Proveri Dogovor" onPress={() => { if (!state.loading) void read(); }} loading={state.loading} /></>;
}

/** The words that stand before the one choice that forms the Agreement; the same in the question and while it is retried. */
const CHOICE_TITLE = 'Jedan izbor sklapa Dogovor.';
const choiceTerms = (candidate: KandidatProjekcija) =>
  `Izborom prihvataš ovu ponudu: ${candidate.cena.prikaz} ukupno, ${dolaziOsoba(candidate.pokrivaMesta)}. Dogovor odmah važi za obe strane.`;
const CHOICE_NOTE = 'Tvoji paralelni zadaci ostaju odvojeni. Termin izabrane osobe ponovo se proverava pri izboru.';

/**
 * One offer in full, as a sheet over the list (owner's step 7, 2026-09-24; it was a page of its own with a review page
 * behind it). The person leads — their picture, name and rating, which open their public profile — then the offer: the
 * total and whom it is for, the time, their whole message and what they declared with it.
 *
 * The sheet's pinned footer holds the ONE green action. "Izaberi ovu ponudu" asks first, in an in-app confirmation with
 * the words that always stood before this choice; only its confirm runs the route's `choose`, which keeps every guard it
 * had (the read revision and account, the offer's own version and hash, the selectable classifier, one idempotent
 * command). A retained confirmation is retired the moment the offer it asked about changes. After a choice the footer
 * carries its outcome: the Dogovor, a check of an unknown outcome, or the same command again.
 *
 * Closing the sheet is the screen's Back: it returns to the list, or, once a choice was made, leaves as Back always did.
 * Nothing closes it while the choice runs.
 */
export function CandidateSelectionPresentation({ need, candidate, back, publicProfile, choose, busy, pending, uncertain, refresh, error, confirmed, openAgreement, reset, readAgreement, openLinkedAgreement, publicPhoto, safety, photo }: {
  need: PotrebaProjekcija; candidate: KandidatProjekcija; back: () => void; publicProfile: () => Promise<JavniProfilProjekcija | null>;
  /** The route's one choice. A returned promise keeps the confirmation busy until the command settles. */
  choose: () => void | Promise<unknown>;
  busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void; error: string | null; confirmed: boolean;
  openAgreement: () => void; reset?: () => void;
  readAgreement: () => Promise<Ishod<{ dogovorId: string | null }>>; openLinkedAgreement: (id: string) => void;
  publicPhoto?: (profileId: string, size?: number) => ReactNode;
  /** PKG-047 (F05): report or block this candidate from their own public profile. */
  safety?: SafetyEntry;
  /** The person's picture at the head of the offer (56); the Avatar with their letters when absent. */
  photo?: ReactNode;
}) {
  const [profile, setProfile] = useState<PublicProfileState>(null);
  const profileRequest = useRef(0);
  useEffect(() => () => { profileRequest.current++; }, []);
  const closeProfile = () => { profileRequest.current++; setProfile(null); };
  const openProfile = async () => {
    if (profile?.loading) return;
    const request = ++profileRequest.current;
    setProfile({ loading: true, data: null });
    try {
      const value = await publicProfile();
      if (request === profileRequest.current) setProfile({ loading: false, data: value?.profilId === candidate.radnikProfilId ? value : null });
    } catch { if (request === profileRequest.current) setProfile({ loading: false, data: null }); }
  };
  const confirmation = useConfirmSheet(), retireConfirmation = confirmation.close;
  // A question asked about one exact offer is not an answer about a changed one.
  const offerKey = [need.id, need.revizija, candidate.prijavaId, candidate.verzija, candidate.hash, candidate.stanje, candidate.mozeIzabrati].join(':');
  useEffect(() => { retireConfirmation(); }, [offerKey, retireConfirmation]);
  const askToChoose = () => {
    if (!candidate.mozeIzabrati || busy || pending || confirmed) return;
    confirmation.ask({ title: CHOICE_TITLE, message: `${choiceTerms(candidate)} ${CHOICE_NOTE}`, confirmLabel: 'Izaberi ovu Prijavu',
      onConfirm: () => choose() });
  };
  const value = candidateValue(candidate), time = candidateTime(candidate, need.taskTimezone), status = candidateStatus(candidate);
  const evidence = candidate.dokazPrijave;
  const declared = evidence.sema === 'APPLICATION_V1_SELF_DECLARED'
    ? [...(evidence.vestine ?? []), ...(evidence.alati ?? []), ...(evidence.vozila ?? []), ...(evidence.licence ?? [])].join(' · ') : null;
  const message = candidate.napomena?.trim() ?? '';
  const selected = candidate.stanje === 'SELECTED' && !pending;
  // An offer that cannot be chosen has no green action; the band says so and carries the one thing to do about it.
  const blocked = !candidate.mozeIzabrati && !pending && !confirmed && !selected;
  const primary = confirmed ? <BrandAction label="Otvori Dogovor" onPress={openAgreement} />
    : selected ? <SelectedAgreementAction load={readAgreement} open={openLinkedAgreement} />
    : uncertain ? <BrandAction label="Proveri ishod" onPress={refresh} disabled={busy} />
    : pending || busy ? <BrandAction label={busy ? 'Povezivanje…' : 'Ponovi isti izbor'} onPress={() => { void choose(); }} disabled={busy} loading={busy} />
    : candidate.mozeIzabrati ? <BrandAction label="Izaberi ovu ponudu" onPress={askToChoose} />
    : null;
  const quiet = reset ? <V2Action label="Pregledaj aktuelne prijave" kind="quiet" onPress={reset} disabled={busy} /> : null;
  return <ProductSheet label={`Ponuda: ${candidate.ime}`} closeLabel={pending ? 'Nazad na zadatak' : 'Zatvori ponudu'}
    backdropHint={pending ? 'Vraća na zadatak.' : 'Zatvara ponudu i vraća na prijave.'} dismissible={!busy} onClose={back}
    footer={primary || quiet ? () => <View style={s.sheetFooter}>{primary}{quiet}</View> : undefined}>
    {() => <>
      <CandidatePerson candidate={candidate} photo={photo} onPress={() => { void openProfile(); }} disabled={busy} />
      {status || blocked ? <View style={[s.band, status?.tone === 'warn' ? s.bandWarn : status?.tone === 'green' ? s.bandGreen : null]}>
        {status ? <CandidateStatusLine status={status} /> : null}
        {blocked ? <><T variant="note" style={s.ink}>Ovu prijavu možeš da pročitaš, ali je sada ne možeš izabrati. Osveži prijave da proveriš aktuelno stanje.</T>
          <V2Action label="Osveži prijave" kind="quiet" compact onPress={refresh} disabled={busy} style={s.bandAction} /></> : null}
      </View> : null}
      <ProductFacts>
        <ProductFact art="money" label={`Ukupno za ${osobuAkuz(candidate.pokrivaMesta)}`} value={value.kind === 'amount' ? value.amount : UNPRICED}
          prominent prominentAs={value.kind === 'amount' ? 'amount' : 'label'} />
        <ProductFact art="calendar" label="Termin" value={time ?? need.vremeTekst} note={time ? undefined : 'Termin zadatka'} />
      </ProductFacts>
      <DetailSection title="Poruka">
        {message ? <T selectable variant="body" style={s.ink}>{candidate.napomena}</T> : <T variant="body" tone="muted">Bez poruke.</T>}
      </DetailSection>
      <DetailSection title="Sposobnosti">
        {declared !== null ? <><T variant="body" tone={declared ? 'ink' : 'muted'}>{declared || 'Nema dodatno navedenih sposobnosti.'}</T>
          <T variant="meta" tone="muted">Sačuvana samoizjava uz ovu Prijavu. Kasnija izmena radnog profila je ne prepisuje.</T></>
          : <T variant="meta" tone="muted">Za ovu stariju Prijavu sačuvani dokazi o sposobnostima nisu dostupni.</T>}
      </DetailSection>
      {pending && !confirmed ? <View style={s.warnCard}><T accessibilityRole="alert" variant="heading" style={s.ink}>{CHOICE_TITLE}</T>
        <T variant="body" style={s.ink}>{choiceTerms(candidate)}</T><T variant="meta" tone="muted">{CHOICE_NOTE}</T></View> : null}
      {confirmed ? <View style={s.done}><SuccessMark fresh size={48} />
        <T accessibilityRole="alert" variant="title" style={[s.ink, s.grow]}>Dogovor je sklopljen.</T></View> : null}
      <ErrorMessage error={error} />
      {confirmation.sheet}
      <PublicProfileSheet state={profile} onClose={closeProfile} onRetry={() => { void openProfile(); }} photo={publicPhoto} safety={safety} />
    </>}
  </ProductSheet>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, stack: { gap: 14 },
  eyebrow: { ...sys.type.label, color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 }, ink: { color: sys.color.ink },
  content: { padding: LIST_PADDING, paddingTop: 16, paddingBottom: 28 },
  card: { ...card, gap: 10 },
  cardSuccess: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  warnCard: { ...inset, backgroundColor: sys.color.warnSoft, padding: 16, gap: 8 },
  notice: { padding: 14, backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.control },
  context: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.card, gap: 4 },
  reviewContext: { gap: 4, paddingBottom: 4 },
  contextTitle: { ...sys.type.cardTitle, color: sys.color.green, marginBottom: 4 },
  contextPrice: { ...sys.type.priceSmall, color: sys.color.money, flex: 1 }, offers: { ...sys.type.bodyStrong, color: sys.color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pill: { paddingVertical: 4 }, pillText: { color: sys.color.ink, fontWeight: '600' },
  offerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' }, field: { flex: 1, gap: 6 },
  input: { ...field },
  amountInput: { ...sys.type.price, color: sys.color.ink, borderWidth: 1, borderRadius: sys.radius.control, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface, minHeight: 54, paddingHorizontal: 12, paddingVertical: 10 },
  inputLocked: { backgroundColor: sys.color.wash, color: sys.color.muted },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  term: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  footer: { backgroundColor: sys.color.surface, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderColor: sys.color.line, gap: 8 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }, summary: { ...sys.type.bodyStrong, color: sys.color.ink, flexShrink: 1, fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  blocked: { alignItems: 'center', gap: 2, paddingTop: 4 },
  listHeader: { gap: 4, marginBottom: 12 },
  // A row that opens something is a command: never under 48.
  brief: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingTop: 4, paddingBottom: 14,
    borderBottomWidth: 1, borderColor: sys.color.line },
  briefCopy: { flex: 1, minWidth: 0, gap: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  sortButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8 },
  sortText: { color: sys.color.ink, fontWeight: '600' },
  sortMenu: { ...cardCompact, padding: 0, marginBottom: 8, overflow: 'hidden' },
  sortOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  sortDivider: { borderTopWidth: 1, borderColor: sys.color.line },
  separator: { height: sys.space.md },
  columnRow: { gap: sys.space.md },
  listFooter: { gap: 4, paddingTop: 12 },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  footerAction: { alignSelf: 'center', marginTop: 8 },
  // The offer sheet: its pinned actions, a state band on a flat tint (never a card inside the sheet), the outcome.
  sheetFooter: { gap: sys.space.xs },
  band: { ...inset, backgroundColor: sys.color.wash, gap: sys.space.sm },
  bandWarn: { backgroundColor: sys.color.warnSoft },
  bandGreen: { backgroundColor: sys.color.greenSoft },
  bandAction: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  done: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
});
