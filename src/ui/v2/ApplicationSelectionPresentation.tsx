import { useEffect, useRef, useState, type ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarBlank, CaretRight, Clock, PaperPlaneTilt, Star, Users } from 'phosphor-react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import { calendarInstant } from '../../lib/calendarTime';
import type { Ishod } from '../../data/ports';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, displayDate, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { PublicProfileSheet, type PublicProfileState } from '../system/PublicProfileSheet';
import { ProfilePhoto } from '../media/ContextPhotos';
import { DetailTopBar } from '../system/DetailTopBar';
import { dolaziOsoba, osoba } from '../system/plural';
import { brandAction, card, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';

export type ApplicationDraft = { price: string; people: string; note: string; start: string | null; end: string | null };
function applicationInterval(start: string | null | undefined, end: string | null | undefined, timezone?: string): string | null {
  const from = calendarInstant(start), to = calendarInstant(end);
  if (from === null || to === null || from >= to) return null;
  try {
    const zone = timezone ?? 'UTC';
    const a = zonedParts(new Date(Number(from / 1000n)), zone), b = zonedParts(new Date(Number(to / 1000n)), zone);
    return `${displayDate(a.date)} · ${a.time.slice(0, 5)}–${a.date === b.date ? '' : `${displayDate(b.date)} · `}${b.time.slice(0, 5)} (${zone})`;
  } catch { return null; }
}
function candidateState(k: KandidatProjekcija): string {
  return ({ SELECTABLE: 'Poslata prijava', STALE: 'Potrebna nova provera', OVERFILL: 'Više ljudi nego što je preostalo',
    SELECTED: 'Izabrana prijava', WITHDRAWN: 'Povučena prijava', CLOSED: 'Zadatak je zatvoren', FULL: 'Sva mesta su popunjena' })[k.stanje];
}
const candidateTone = (k: KandidatProjekcija) => k.stanje === 'SELECTABLE' ? sys.color.green : k.stanje === 'SELECTED' ? sys.color.green
  : k.stanje === 'STALE' || k.stanje === 'OVERFILL' ? sys.color.warn : sys.color.muted;

/** Full-screen frame of the application/selection flow: back, eyebrow, title, keyboard-safe body, sticky footer. */
function SelectionFrame({ title, subtitle, back, children, footer, scroll = true }: {
  title: string; subtitle?: string; back: () => void; children: ReactNode; footer?: ReactNode; scroll?: boolean;
}) {
  const reduced = useReducedMotion();
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar backLabel="Nazad na zadatak" eyebrow={subtitle} title={title} onBack={back} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.grow}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(sys.motion.enter)} style={s.stack}>{children}</Animated.View>
      </ScrollView> : <View style={s.grow}>{children}</View>}{footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function SelectionUnavailable({ loading, message, retry, back }: { loading: boolean; message: string; retry?: () => void; back: () => void }) {
  return <SelectionFrame title="Prijave" back={back}><View style={s.card}>
    {loading ? <ActivityIndicator accessibilityLabel="Učitavanje prijava" color={sys.color.green} /> : null}
    <T accessibilityRole={loading ? undefined : 'alert'} variant="body" style={loading ? s.muted : s.ink}>{loading ? 'Učitavamo aktuelne podatke…' : message}</T>
    {!loading && retry ? <V2Action label="Pokušaj ponovo" onPress={retry} style={brandAction} /> : null}
  </View></SelectionFrame>;
}
/** The Task the offer belongs to, as a compact context card. */
function TaskContext({ need }: { need: PotrebaProjekcija | PrilikaProjekcija }) {
  return <View style={s.context}><T variant="meta" style={s.eyebrow}>Zadatak</T><T style={s.contextTitle}>{readableTitle(need.naslov)}</T>
    <T variant="meta" tone="muted">{need.podrucjeTekst}</T><T variant="meta" tone="muted">{need.vremeTekst}</T>
    <View style={s.row}><T style={[s.contextPrice, need.rezimCene !== 'MY_PRICE' && s.offers]}>{need.rezimCene === 'MY_PRICE' ? need.ponudjenaCena?.prikaz : 'Tražim ponude'}</T>
      <View style={s.pill}><T variant="meta" style={s.pillText}>{need.pokrivenost.popunjeno} / {need.pokrivenost.ukupno} ljudi</T></View></View>
  </View>;
}
function BrandAction({ label, onPress, disabled, send }: { label: string; onPress: () => void; disabled?: boolean; send?: boolean }) {
  return <V2Action label={label} onPress={onPress} disabled={disabled} icon={send ? <PaperPlaneTilt size={20} color={sys.color.onOrange}  weight="fill" /> : undefined} style={brandAction} />;
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
        <T variant="meta" style={s.eyebrow}>Vreme bez izmišljanja</T><T accessibilityRole="header" variant="title" style={s.ink}>Ponudi tačan početak i kraj.</T>
        <T variant="body" tone="muted">Vremenska zona: {timezone}. Ovaj predlog pripada tvojoj Prijavi.</T>
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
export function ApplicationSelectionPresentation({ need, opportunity, draft, change, submit, back, busy, pending, uncertain, refresh, error, confirmed, openApplications, canSubmit, reset }: {
  need: PotrebaProjekcija; opportunity: PrilikaProjekcija; draft: ApplicationDraft; change: (value: ApplicationDraft) => void;
  submit: () => void; back: () => void; busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void;
  error: string | null; confirmed: boolean; openApplications: () => void; canSubmit: boolean; reset?: () => void;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const disabled = busy || pending || confirmed;
  const exact = applicationInterval(draft.start, draft.end, need.taskTimezone);
  const fixed = need.schedule?.kind === 'FIXED_WINDOW' ? applicationInterval(need.schedule.startsAt, need.schedule.endsAt, need.taskTimezone) : null;
  const priceLocked = opportunity.rezimCene === 'MY_PRICE';
  return <SelectionFrame title="Tvoja prijava" back={back} footer={<>
    <View style={s.summaryRow}><T variant="meta" tone="muted">Tvoja ponuda</T><T style={s.summary}>{draft.price || '—'} RSD ukupno · {/^[1-9]\d*$/.test(draft.people) ? dolaziOsoba(Number(draft.people)) : 'broj ljudi nije unet'}</T></View>
    {confirmed ? <BrandAction label="Otvori moje prijave" onPress={openApplications} />
      : uncertain ? <BrandAction label="Proveri ishod" onPress={refresh} disabled={busy} />
      : <BrandAction label={busy ? 'Slanje…' : pending ? 'Ponovi istu Prijavu' : 'Pošalji ovu Prijavu'} onPress={submit}
        disabled={busy || (!pending && !canSubmit)} send />}
  </>}>
    <TaskContext need={opportunity} />
    <View style={s.card}><T variant="meta" style={s.eyebrow}>Tvoja ponuda</T>
      <View style={s.offerRow}>
        <Field label="Ukupna cena za ljude koje dovodiš (RSD)">
          <TextInput accessibilityLabel="Ukupna cena za ljude koje dovodiš (RSD)" keyboardType="number-pad" maxLength={10} value={draft.price}
            editable={!disabled && !priceLocked} style={[s.amountInput, priceLocked && s.inputLocked]}
            onChangeText={price => { if (!disabled && !priceLocked) change({ ...draft, price }); }} />
        </Field>
        <Field label="Ljudi">
          <TextInput accessibilityLabel="Ljudi" keyboardType="number-pad" maxLength={4} value={draft.people} editable={!disabled} style={s.amountInput}
            onChangeText={people => { if (!disabled) change({ ...draft, people }); }} />
        </Field>
      </View>
      <T variant="meta" tone="muted">{priceLocked ? 'Cena je navedena u Zadatku. ' : ''}Ovo je ukupan iznos za sve ljude koje dovodiš, ne cena po osobi.</T>
    </View>
    {/* One card used to be called "Termin i poruka" and hold both, so the word Termin appeared
        twice inside it and neither half was a whole thought. Two blocks, one idea each. */}
    <View style={s.card}><T variant="meta" style={s.eyebrow}>Termin</T>
      <Press accessibilityRole="button" accessibilityLabel="Termin Prijave" disabled={disabled} accessibilityState={{ disabled }} haptic="select" scaleTo={0.99}
        onPress={() => setEditingTime(true)} style={s.term}>
        <CalendarBlank size={22} color={sys.color.green} />
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
  </SelectionFrame>;
}
/** The screen where one offer is accepted showed a monogram, while the list that leads to it shows
 *  a face. Same person, two screens, two different people as far as the eye is concerned. */
function CandidateIdentity({ candidate, publicProfile }: { candidate: KandidatProjekcija; publicProfile: () => void }) {
  return <View style={s.identity}><ProfilePhoto profileId={candidate.radnikProfilId} size={64} initial={candidate.inicijali} />
    <View style={[s.grow, { gap: 3 }]}>
      <T style={s.candidateName}>{candidate.ime}</T>
      {candidate.ocenaTekst !== '—' ? <View style={s.inline}><Star size={13} weight="fill" color={sys.color.orange} />
        <T variant="meta" tone="muted">{candidate.ocenaTekst} · {candidate.recenzijeTekst}</T></View>
        : <T variant="meta" tone="muted">Nov na USKOČI</T>}
      <V2Action label="Javni profil" kind="quiet" onPress={publicProfile} style={s.quietLeft} />
    </View></View>;
}
/**
 * One candidate as the eye meets it while scanning: the face, the name, how they are rated, how
 * much, how many people. Nothing else.
 *
 * The row used to carry nine lines and its own orange button. Five offers meant five orange
 * buttons, so the screen where a person makes one decision was a wall of the colour that is
 * supposed to mean "this is the step". The whole card is the button now, the orange waits for the
 * offer screen, and the term, the declared skills and the message wait with it — none of them
 * decides who you open first.
 *
 * The state band is the same idea. "Poslata prijava" printed on every row is not information; it
 * is the ordinary case. So the band appears only when the answer is something else, and then it
 * is a full line instead of a chip squeezed into 45% of the width.
 */
function CandidateRow({ candidate: k, open }: { candidate: KandidatProjekcija; open: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={`Pogledaj ponudu: ${k.ime}`} haptic="select" scaleTo={0.985}
    onPress={open} style={s.candidate}>
    <View style={s.candidateHead}>
      <ProfilePhoto profileId={k.radnikProfilId} size={56} initial={k.inicijali} />
      <View style={s.grow}>
        <T style={s.candidateName} numberOfLines={1}>{k.ime}</T>
        {k.ocenaTekst === '—' ? <T variant="meta" tone="muted">Nov na USKOČI</T>
          : <View style={s.inline}><Star size={13} weight="fill" color={sys.color.orange} />
            <T variant="meta" tone="muted">{k.ocenaTekst} · {k.recenzijeTekst}</T></View>}
      </View>
      <CaretRight size={20} color={sys.color.muted} />
    </View>
    <View style={s.candidateFoot}>
      <T style={s.price}>{k.cena.prikaz}</T>
      <View style={s.inline}><Users size={16} color={sys.color.muted} /><T variant="meta" tone="muted">{osoba(k.pokrivaMesta)}</T></View>
    </View>
    {k.stanje === 'SELECTABLE' ? null
      : <View style={s.stateBand}><T variant="meta" style={{ color: candidateTone(k), fontWeight: '600' }}>{candidateState(k)}</T></View>}
  </Press>;
}

/** Two offers side by side. A comparison only compares if the same three cells line up in both
 *  columns, so the free-text capabilities line — which is a different length for everyone — moved
 *  to the offer screen where it can have the room it needs. */
function CompareCell({ candidate: k, need, open }: { candidate: KandidatProjekcija; need: PotrebaProjekcija; open: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={`Otvori prijavu: ${k.ime}`} haptic="select" scaleTo={0.985}
    onPress={open} style={s.comparison}>
    <T variant="bodyStrong" style={s.ink} numberOfLines={1}>{k.ime}</T>
    <T variant="meta" tone="muted" numberOfLines={1}>{k.ocenaTekst === '—' ? 'Nov na USKOČI' : `${k.ocenaTekst} · ${k.recenzijeTekst}`}</T>
    <View style={s.compareCell}><T variant="label" tone="muted" style={s.compareLabel}>Ukupno</T><T style={s.comparePrice}>{k.cena.prikaz}</T></View>
    <View style={s.compareCell}><T variant="label" tone="muted" style={s.compareLabel}>Ljudi</T><T variant="bodyStrong" style={s.ink}>{osoba(k.pokrivaMesta)}</T></View>
    <View style={s.compareCell}><T variant="label" tone="muted" style={s.compareLabel}>Termin</T>
      <T variant="meta" style={s.ink}>{applicationInterval(k.predlozeniPocetak, k.predlozeniKraj, need.taskTimezone) ?? need.vremeTekst}</T></View>
    {k.stanje === 'SELECTABLE' ? null : <T variant="meta" style={{ color: candidateTone(k), fontWeight: '600' }}>{candidateState(k)}</T>}
  </Press>;
}

/** Candidates of one Task: offers as cards, or side by side for a fast decision (owner decision 3, TARG-034). */
export function CandidateListPresentation({ need, candidates, open, back, refresh }: {
  need: PotrebaProjekcija; candidates: KandidatProjekcija[]; open: (candidate: KandidatProjekcija) => void; back: () => void; refresh: () => void;
}) {
  const [compare, setCompare] = useState(false);
  // A new offer arriving is the news this screen exists to carry, so it is the one thing that moves.
  // The list that was already there settles silently, and switching to the comparison and back is
  // not an arrival either — `seen` belongs to this component, not to the FlatList it remounts.
  const appear = useAppear();
  appear.settle(candidates.map(k => k.prijavaId));
  return <SelectionFrame title={compare ? 'Uporedi prijave' : 'Prijave'} subtitle="Ponude ljudi koji mogu da uskoče" back={compare ? () => setCompare(false) : back} scroll={false}>
    <FlatList key={compare ? 'comparison' : 'offers'} numColumns={compare ? 2 : 1} data={candidates} keyExtractor={k => k.prijavaId} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
      contentContainerStyle={s.content} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={<View style={s.listHeader}><TaskContext need={need} />
        <View style={s.row}><T variant="body" tone="muted" style={s.grow}>{candidates.length} konkretnih ponuda · još {need.pokrivenost.preostalo} ljudi</T>
          {candidates.length > 1 ? <V2Action label={compare ? 'Prikaži ponude' : 'Uporedi'} kind={compare ? 'quiet' : 'secondary'} onPress={() => setCompare(v => !v)} /> : null}</View>
        {compare ? <View style={s.compareIntro}><T variant="meta" style={s.eyebrow}>Konkretne ponude</T><T accessibilityRole="header" variant="title" style={s.ink}>Uporedi isti obim, ne samo cenu.</T>
          <T variant="meta" tone="muted">Cena, broj ljudi i termin pripadaju svakoj pojedinačnoj ponudi.</T></View> : null}
      </View>}
      ListEmptyComponent={<View style={s.card}><T accessibilityRole="header" variant="title" style={s.ink}>Još nema prijava.</T><T variant="body" tone="muted">Kada neko pošalje ponudu za ovaj Zadatak, pojaviće se ovde.</T></View>}
      renderItem={({ item: k, index }) => <Appear index={index} animate={appear.isNew(k.prijavaId)}>
        {compare ? <CompareCell candidate={k} need={need} open={() => open(k)} />
          : <CandidateRow candidate={k} open={() => open(k)} />}
      </Appear>}
      ListFooterComponent={<V2Action label="Osveži prijave" kind="quiet" onPress={refresh} style={s.footerAction} />} />
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
  return <><T variant="meta" tone="muted">{state.loading ? 'Proveravamo Dogovor uz ovu Prijavu…' : 'Veza sa Dogovorom trenutno nije dostupna.'}</T>
    <V2Action label="Proveri Dogovor" onPress={() => { if (!state.loading) void read(); }} disabled={state.loading} /></>;
}
/** One offer in full, the public profile as a sheet, and the one choice that forms the Agreement. */
export function CandidateSelectionPresentation({ need, candidate, back, publicProfile, choose, busy, pending, uncertain, refresh, error, confirmed, openAgreement, reset, readAgreement, openLinkedAgreement, publicPhoto }: {
  need: PotrebaProjekcija; candidate: KandidatProjekcija; back: () => void; publicProfile: () => Promise<JavniProfilProjekcija | null>; choose: () => void;
  busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void; error: string | null; confirmed: boolean;
  openAgreement: () => void; reset?: () => void;
  readAgreement: () => Promise<Ishod<{ dogovorId: string | null }>>; openLinkedAgreement: (id: string) => void;
  publicPhoto?: (profileId: string) => ReactNode;
}) {
  const [review, setReview] = useState(false);
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
  const evidence = candidate.dokazPrijave;
  return <SelectionFrame title={review || pending ? 'Pregled izbora' : 'Ponuda'} subtitle="Izbor konkretne Prijave" back={back}
    footer={confirmed ? <BrandAction label="Otvori Dogovor" onPress={openAgreement} />
      : candidate.stanje === 'SELECTED' && !pending ? <SelectedAgreementAction load={readAgreement} open={openLinkedAgreement} />
      : uncertain ? <BrandAction label="Proveri ishod" onPress={refresh} disabled={busy} />
      : review || pending ? <BrandAction label={busy ? 'Povezivanje…' : pending ? 'Ponovi isti izbor' : 'Izaberi ovu Prijavu'} onPress={choose}
        disabled={busy || (!pending && !candidate.mozeIzabrati)} />
      : candidate.mozeIzabrati ? <BrandAction label="Pregledaj povezivanje" onPress={() => setReview(true)} /> : undefined}>
    <TaskContext need={need} />
    <View style={s.card}><CandidateIdentity candidate={candidate} publicProfile={() => { void openProfile(); }} />
      <View style={s.divider} />
      <T variant="label" tone="muted" style={s.compareLabel}>Ukupno za {dolaziOsoba(candidate.pokrivaMesta)}</T>
      <T style={s.priceLarge}>{candidate.cena.prikaz}</T>
      <View style={s.factRow}>
        <View style={s.fact}><View style={s.inline}><Users size={16} color={sys.color.muted} /><T variant="label" tone="muted" style={s.compareLabel}>Ljudi</T></View>
          <T variant="bodyStrong" style={s.ink}>{osoba(candidate.pokrivaMesta)}</T></View>
        <View style={s.fact}><View style={s.inline}><Clock size={16} color={sys.color.muted} /><T variant="label" tone="muted" style={s.compareLabel}>Termin</T></View>
          <T variant="bodyStrong" style={s.ink}>{applicationInterval(candidate.predlozeniPocetak, candidate.predlozeniKraj, need.taskTimezone) ?? need.vremeTekst}</T></View>
      </View>
      {candidate.stanje === 'SELECTABLE' ? null
        : <View style={s.stateBand}><T variant="bodyStrong" style={{ color: candidateTone(candidate) }}>{candidateState(candidate)}</T></View>}</View>
    <View style={s.card}><T variant="meta" style={s.eyebrow}>Poruka uz prijavu</T><T variant="body" style={s.ink}>{candidate.napomena || 'Nema dodatne poruke.'}</T></View>
    <View style={s.card}><T variant="meta" style={s.eyebrow}>Uslovi uz ovu prijavu</T>
      {evidence.sema === 'APPLICATION_V1_SELF_DECLARED' ? <><T variant="body" style={s.ink}>{[...(evidence.vestine ?? []), ...(evidence.alati ?? []),
        ...(evidence.vozila ?? []), ...(evidence.licence ?? [])].join(' · ') || 'Nema dodatno navedenih sposobnosti.'}</T>
        <T variant="meta" tone="muted">Sačuvana samoizjava uz ovu Prijavu. Kasnija izmena radnog profila je ne prepisuje.</T></>
        : <T variant="meta" tone="muted">Za ovu stariju Prijavu sačuvani dokazi o sposobnostima nisu dostupni.</T>}
    </View>
    {review || pending ? <View style={s.warnCard}><T accessibilityRole="alert" variant="title" style={s.ink}>Jedan izbor sklapa Dogovor.</T><T variant="body" style={s.ink}>
      Izborom prihvataš ovu ponudu: {candidate.cena.prikaz} ukupno, {dolaziOsoba(candidate.pokrivaMesta)}. Dogovor odmah važi za obe strane.</T>
      <T variant="meta" tone="muted">Tvoji paralelni zadaci ostaju odvojeni. Termin izabrane osobe ponovo se proverava pri izboru.</T></View> : null}
    {confirmed ? <T accessibilityRole="alert" variant="title" style={s.ink}>Dogovor je sklopljen.</T> : candidate.stanje === 'SELECTED' && !pending ? <T variant="body" style={s.ink}>Ova ponuda je izabrana.</T>
      : !candidate.mozeIzabrati && !pending ? <T variant="body" tone="muted">{candidateState(candidate)}. Osveži Prijave da proveriš aktuelno stanje.</T> : null}
    <ErrorMessage error={error} />{reset ? <V2Action label="Pregledaj aktuelne prijave" onPress={reset} disabled={busy} /> : null}
    <PublicProfileSheet state={profile} onClose={closeProfile} onRetry={() => { void openProfile(); }} photo={publicPhoto} roleLabel="Prijavio se" />
  </SelectionFrame>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, stack: { gap: 14 },
  eyebrow: { ...sys.type.label, color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 }, ink: { color: sys.color.ink }, muted: { color: sys.color.muted },
  content: { padding: 20, paddingTop: 4, paddingBottom: 28 },
  card: { ...card, gap: 10 },
  cardSuccess: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  warnCard: { backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.card, padding: 18, gap: 8 },
  notice: { padding: 14, backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.control },
  context: { ...card, gap: 4 },
  contextTitle: { ...sys.type.cardTitle, color: sys.color.ink, marginBottom: 4 },
  contextPrice: { ...sys.type.priceSmall, color: sys.color.money, flex: 1 }, offers: { ...sys.type.bodyStrong, color: sys.color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pill: { paddingVertical: 4 }, pillText: { color: sys.color.ink, fontWeight: '600' },
  offerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' }, field: { flex: 1, gap: 6 },
  input: { ...sys.type.body, color: sys.color.ink, borderWidth: 1, borderRadius: sys.radius.control, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface, padding: 12 },
  amountInput: { ...sys.type.price, color: sys.color.ink, borderWidth: 1, borderRadius: sys.radius.control, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface, minHeight: 54, paddingHorizontal: 12, paddingVertical: 10 },
  inputLocked: { backgroundColor: sys.color.wash, color: sys.color.muted },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  term: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  priceLarge: { ...sys.type.priceLarge, color: sys.color.money },
  factRow: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderColor: sys.color.line },
  fact: { flex: 1, minWidth: 0, gap: 4 },
  footer: { backgroundColor: sys.color.surface, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderColor: sys.color.line, gap: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }, summary: { ...sys.type.bodyStrong, color: sys.color.ink, fontVariant: ['tabular-nums'] },
  listHeader: { gap: 14, marginBottom: 14 }, compareIntro: { gap: 4 },
  candidate: { ...card, gap: 12, padding: 18 },
  candidateHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  candidateName: { ...sys.type.cardTitle, color: sys.color.ink },
  candidateFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateBand: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control, paddingHorizontal: 12, paddingVertical: 8 },
  price: { ...sys.type.price, color: sys.color.money },
  comparison: { ...card, flex: 1, minWidth: 0, padding: 14, marginHorizontal: 4, gap: 8 },
  compareCell: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderColor: sys.color.line }, compareLabel: { letterSpacing: 0.2 },
  comparePrice: { ...sys.type.priceSmall, color: sys.color.money },
  divider: { height: 1, backgroundColor: sys.color.line, marginVertical: 2 },
  avatar: { width: 44, height: 44, borderRadius: sys.radius.chip, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' }, initial: { color: sys.color.green },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 }, footerAction: { alignSelf: 'center', marginTop: 8 },
});
