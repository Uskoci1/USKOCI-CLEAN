import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretDown, CaretRight, Check, PaperPlaneTilt } from 'phosphor-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useReducedMotion } from '../system/motion';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import type { Ishod } from '../../data/ports';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import type { AvatarSize } from '../system/Avatar';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { PublicProfileSheet, type PublicProfileState, type SafetyEntry } from '../system/PublicProfileSheet';
import { ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { FactArt } from '../system/FactArt';
import { dolaziOsoba, osobuAkuz, prijava } from '../system/plural';
import { StateView } from '../system/StateView';
import { SuccessMark } from '../system/SuccessMark';
import { useTextScale } from '../system/textScale';
import { brandAction, cardCompact, sys, inset } from '../system/tokens';
import { T } from '../Text';
import { CandidateCard, CandidateCompareCard, CandidatePerson, CandidateStatusLine, UNPRICED, candidateStatus, candidateTime, candidateValue } from './CandidateFace';
import { ACTION_MIN_HEIGHT, V2Action } from './V2Action';
import { splitFirstSentence } from './ApplicationComposerPresentation';

/**
 * The worker's application composer lives in its own module since round 6 (unit `prijava`, 2026-09-24). It is re-exported
 * here under its old name, as the same function, so every caller and test that found it here still finds it.
 */
export { ApplicationComposerPresentation as ApplicationSelectionPresentation, type ApplicationDraft } from './ApplicationComposerPresentation';

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
/** `loading` is this action's own write in flight: the button keeps its green and its words, with a spinner. */
function BrandAction({ label, onPress, disabled, loading, reason, send }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; reason?: string | null; send?: boolean;
}) {
  return <V2Action label={label} onPress={onPress} disabled={disabled} loading={loading} reason={reason}
    icon={send ? <PaperPlaneTilt size={20} color={sys.color.onGreen} weight="fill" /> : undefined} style={brandAction} />;
}
function ErrorMessage({ error }: { error?: string | null }) {
  return error ? <View style={s.notice}><T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="body" style={s.ink}>{error}</T></View> : null;
}
/** A person's picture at the size its place asks for, handed in by the screen; the Avatar with their letters when absent. */
export type CandidatePhoto = (candidate: KandidatProjekcija, size: AvatarSize) => ReactNode;

/** The side padding of a screen body here (the list). */
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
  const face = photo?.(candidate, compare ? 40 : 56);
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
 * text size under the owner's Large (read rounded, since Android hands Large over as 1.2999999523). Every list row gives
 * identity and terms their own width. An offer opens as a sheet over this list, so the list is still where the person
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
        {candidates.length ? <View style={s.toolbar}><T variant="bodyStrong" style={s.counts}>{counts}</T>
          {candidates.length > 1 ? <Press accessibilityRole="button" accessibilityLabel={`Redosled prijava: ${SORT_LABEL[sort]}`}
            accessibilityHint="Otvara izbor redosleda" accessibilityState={{ expanded: sorting }} haptic="select"
            onPress={() => setSorting(value => !value)} style={s.sortButton}>
            <T variant="note" style={s.sortText}>{SORT_LABEL[sort]}</T><CaretDown size={18} color={sys.color.ink} />
          </Press> : null}</View> : null}
        {sorting && candidates.length > 1 ? <View accessibilityRole="radiogroup" style={s.sortMenu}>{SORTS.map((option, at) =>
          <Press key={option} accessibilityRole="radio" accessibilityLabel={SORT_LABEL[option]} accessibilityState={{ checked: sort === option }}
            haptic="select" scaleTo={0.99} onPress={() => choose(option)} style={[s.sortOption, at > 0 && s.sortDivider]}>
            <T variant="body" style={[s.grow, s.ink]}>{SORT_LABEL[option]}</T>{sort === option ? <Check size={18} weight="bold" color={sys.color.green} /> : null}
          </Press>)}</View> : null}
      </View>}
      // What happens next, without promising that anyone will apply.
      // Comparing needs two offers, so the first one promises nothing about it (review r4 rk item 8).
      ListEmptyComponent={<StateView kind="empty" art="offers" title="Još nema prijava"
        body="Kad neko pošalje ponudu za ovaj zadatak, videćeš je ovde."
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
/** The one name of the choice: the offer's green button and the confirm of the question it asks. */
const CHOOSE_LABEL = 'Izaberi ovu ponudu';

/**
 * One offer in full, as a sheet over the list (owner's step 7, 2026-09-24; it was a page of its own with a review page
 * behind it). The person leads — their name as the sheet's title, then their picture and rating, which open their public
 * profile — then the offer: the total and whom it is for, the time, their whole message and what they declared with it.
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
  const confirmedAtMount = useRef(confirmed).current;
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
    // The confirm says the words of the button that asked (review r4 rk item 5): one command, one name.
    confirmation.ask({ title: CHOICE_TITLE, message: `${choiceTerms(candidate)} ${CHOICE_NOTE}`, confirmLabel: CHOOSE_LABEL,
      onConfirm: () => choose() });
  };
  const value = candidateValue(candidate), time = candidateTime(candidate, need.taskTimezone), status = candidateStatus(candidate);
  const message = candidate.napomena?.trim() ?? '';
  const selected = candidate.stanje === 'SELECTED' && !pending;
  // An offer that cannot be chosen has no green action; the band says so and carries the one thing to do about it.
  const blocked = !candidate.mozeIzabrati && !pending && !confirmed && !selected;
  const primary = confirmed ? <BrandAction label="Otvori Dogovor" onPress={openAgreement} />
    : selected ? <SelectedAgreementAction load={readAgreement} open={openLinkedAgreement} />
    : uncertain ? <BrandAction label="Proveri ishod" onPress={refresh} disabled={busy} />
    : pending || busy ? <BrandAction label={busy ? 'Povezivanje…' : 'Ponovi isti izbor'} onPress={() => { void choose(); }} disabled={busy} loading={busy} />
    : candidate.mozeIzabrati ? <BrandAction label={CHOOSE_LABEL} onPress={askToChoose} />
    : null;
  const quiet = reset ? <V2Action label="Pregledaj aktuelne prijave" kind="quiet" onPress={reset} disabled={busy} /> : null;
  // The person's name is the sheet's title (review r4 rk item 3): a real heading for a screen reader, and the sheet's own
  // visible × beside it, which a sighted person on iOS had no way to find before (only the handle, a tap outside and
  // Android Back closed it). The row under it keeps the picture and the rating, and opens the public profile.
  return <ProductSheet title={candidate.ime} closeLabel={pending ? 'Nazad na zadatak' : 'Zatvori ponudu'}
    backdropHint={pending ? 'Vraća na zadatak.' : 'Zatvara ponudu i vraća na prijave.'} dismissible={!busy} onClose={back}
    footer={primary || quiet ? () => <View style={s.sheetFooter}>{primary}{quiet}</View> : undefined}>
    {() => <View style={s.offerContent}>
      <CandidatePerson candidate={candidate} photo={photo} onPress={() => { void openProfile(); }} disabled={busy} />
      {status || blocked ? <View style={[s.band, status?.tone === 'warn' ? s.bandWarn : status?.tone === 'green' ? s.bandGreen : null]}>
        {status ? <CandidateStatusLine status={status} /> : null}
        {blocked ? <><T variant="note" style={s.ink}>Ovu prijavu možeš da pročitaš, ali je sada ne možeš izabrati. Osveži prijave da proveriš aktuelno stanje.</T>
          <V2Action label="Osveži prijave" kind="quiet" compact onPress={refresh} disabled={busy} style={s.bandAction} /></> : null}
      </View> : null}
      <View style={s.offerTerms}>
        <View accessible accessibilityLabel={`Ukupno za ${osobuAkuz(candidate.pokrivaMesta)}: ${value.kind === 'amount' ? value.amount : UNPRICED}`} style={s.offerPrice}>
          <T variant="note" tone="muted">Ukupno za {osobuAkuz(candidate.pokrivaMesta)}</T>
          {value.kind === 'amount' ? <T style={s.offerAmount}>{value.amount}</T> : <T variant="bodyStrong" tone="muted">{UNPRICED}</T>}
        </View>
        <View accessible accessibilityLabel={`Termin: ${time ?? need.vremeTekst}${time ? '' : ', Termin zadatka'}`} style={s.offerTime}>
          <FactArt kind="calendar" size={24} />
          <View style={s.offerTimeCopy}><T variant="bodyStrong" style={s.ink}>{time ?? need.vremeTekst}</T>
            <T variant="note" tone="muted">{time ? 'Predloženi termin' : 'Termin zadatka'}</T></View>
        </View>
      </View>
      <View style={s.offerMessage}>
        <T accessibilityRole="header" variant="heading" style={s.ink}>Poruka</T>
        {message ? <T selectable variant="body" style={s.ink}>{candidate.napomena}</T> : <T variant="body" tone="muted">Bez poruke.</T>}
      </View>
      {/* No "Sposobnosti" here (owner decision 2026-09-24): the applicant's self-declared skills are not shown to the task
          owner as labels; what the applicant wants to say is in the message above. */}
      {pending && !confirmed ? <View style={s.warnCard}><T accessibilityRole="alert" variant="heading" style={s.ink}>{CHOICE_TITLE}</T>
        <T variant="body" style={s.ink}>{choiceTerms(candidate)}</T><T variant="meta" tone="muted">{CHOICE_NOTE}</T></View> : null}
      {/* Fresh only when the choice was confirmed while this sheet was open: reopened on an outcome that was already
          confirmed (back from the profile's safety screen), the mark stands still and no haptic plays (review r4 rk
          item 2; SuccessMark's own contract). */}
      {confirmed ? <View style={s.done}><SuccessMark fresh={!confirmedAtMount} size={48} />
        <T accessibilityRole="alert" variant="title" style={[s.ink, s.grow]}>Dogovor je sklopljen.</T></View> : null}
      <ErrorMessage error={error} />
      {confirmation.sheet}
      <PublicProfileSheet state={profile} onClose={closeProfile} onRetry={() => { void openProfile(); }} photo={publicPhoto} safety={safety} />
    </View>}
  </ProductSheet>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, stack: { gap: 14 },
  ink: { color: sys.color.ink },
  content: { padding: LIST_PADDING, paddingTop: 16, paddingBottom: 28 },
  warnCard: { ...inset, backgroundColor: sys.color.warnSoft, padding: 16, gap: 8 },
  notice: { padding: 14, backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.control },
  footer: { backgroundColor: sys.color.surface, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderColor: sys.color.line, gap: 8 },
  center: { textAlign: 'center' },
  listHeader: { gap: sys.space.md, marginBottom: sys.space.xs },
  // A row that opens something is a command: never under 48.
  brief: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: ACTION_MIN_HEIGHT,
    padding: sys.space.base, backgroundColor: sys.color.wash, borderRadius: sys.radius.control },
  briefCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm, minHeight: 52 },
  counts: { flexGrow: 1, color: sys.color.ink },
  sortButton: { minHeight: ACTION_MIN_HEIGHT, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortText: { flexShrink: 1, color: sys.color.ink, fontWeight: '600' },
  sortMenu: { ...cardCompact, padding: 0, marginBottom: 8, overflow: 'hidden' },
  sortOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  sortDivider: { borderTopWidth: 1, borderColor: sys.color.line },
  separator: { height: sys.space.sm },
  columnRow: { gap: sys.space.md },
  listFooter: { gap: 4, paddingTop: 12 },
  footnote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  footerAction: { alignSelf: 'center', marginTop: 8 },
  // The offer sheet: its pinned actions, a state band on a flat tint (never a card inside the sheet), the outcome.
  sheetFooter: { gap: sys.space.xs },
  offerContent: { gap: sys.space.lg },
  offerTerms: { backgroundColor: sys.color.wash, borderRadius: sys.radius.card, padding: sys.space.lg, gap: sys.space.base },
  offerPrice: { gap: sys.space.xs },
  offerAmount: { ...sys.type.pageTitle, color: sys.color.money, fontVariant: ['tabular-nums'] },
  offerTime: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, borderTopWidth: 1, borderTopColor: sys.color.line, paddingTop: sys.space.base },
  offerTimeCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  offerMessage: { gap: sys.space.md },
  band: { ...inset, backgroundColor: sys.color.wash, gap: sys.space.sm },
  bandWarn: { backgroundColor: sys.color.warnSoft },
  bandGreen: { backgroundColor: sys.color.greenSoft },
  bandAction: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  done: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
});
