import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fixedApplicationPeople, needPriceText, needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaretRight, PaperPlaneTilt, Star } from 'phosphor-react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import { calendarInstant } from '../../lib/calendarTime';
import { novac } from '../../lib/novac';
import type { Ishod } from '../../data/ports';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, displayDate, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { PublicProfileSheet, type PublicProfileState } from '../system/PublicProfileSheet';
import { ProfilePhoto } from '../media/ContextPhotos';
import { ProductFact, ProductFacts, ProductHeader } from '../product/ProductDetails';
import { FactArt } from '../system/FactArt';
import { dolaziOsoba, osoba, prijava, plural } from '../system/plural';
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

/** Shared identity, keyboard-safe body and one next action. */
function SelectionFrame({ title, back, children, footer, scroll = true, backLabel = 'Nazad na zadatak' }: {
  title: string; back: () => void; children: ReactNode; footer?: ReactNode; scroll?: boolean; backLabel?: string;
}) {
  const reduced = useReducedMotion();
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader backLabel={backLabel} title={title} back={back} />
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
    <View style={s.row}><T style={[s.contextPrice, need.rezimCene !== 'MY_PRICE' && s.offers]}>{needPriceText(need)}</T>
      <View style={s.pill}><T variant="meta" style={s.pillText}>{need.pokrivenost.popunjeno} / {need.pokrivenost.ukupno} mesta</T></View></View>
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
  return <SelectionFrame title="Tvoja prijava" back={back} footer={<>
    <View style={s.summaryRow}><T variant="meta" tone="muted">Tvoja ponuda</T><T style={s.summary}>{reviewPrice ?? 'Proveri unetu cenu'}{reviewPrice ? ' ukupno' : ''} · {/^[1-9]\d*$/.test(draft.people) ? dolaziOsoba(Number(draft.people)) : 'broj ljudi nije unet'}</T></View>
    {confirmed ? <BrandAction label="Otvori moje prijave" onPress={openApplications} />
      : uncertain ? <BrandAction label="Proveri ishod" onPress={refresh} disabled={busy} />
      : pending || busy ? <BrandAction label={busy ? 'Slanje…' : 'Ponovi istu Prijavu'} onPress={submit} disabled={busy} send />
      : <BrandAction label="Pregledaj ponudu" onPress={() => {
        if (!disabled && canSubmit && !reviewing) { Keyboard.dismiss(); setReview({ key: reviewKey }); }
      }} disabled={!canSubmit || reviewing} />}
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
        <View style={s.reviewContext}><T variant="meta" style={s.eyebrow}>Zadatak</T>
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
/** The same public-profile photo follows the person from list to full offer. */
function CandidateIdentity({ candidate, publicProfile }: { candidate: KandidatProjekcija; publicProfile: () => void }) {
  return <View style={s.identity}><ProfilePhoto profileId={candidate.radnikProfilId} size={80} initial={candidate.inicijali} />
    <View style={[s.grow, { gap: 3 }]}>
      <T style={s.candidateName}>{candidate.ime}</T>
      {candidate.ocenaTekst !== '—' ? <View style={s.inline}><Star size={13} weight="fill" color={sys.color.orange} />
        <T variant="meta" tone="muted">{candidate.ocenaTekst} · {candidate.recenzijeTekst}</T></View>
        : <T variant="meta" tone="muted">Ocena nije dostupna</T>}
      <V2Action label="Javni profil" kind="quiet" onPress={publicProfile} style={s.quietLeft} />
    </View></View>;
}
/** Price, offered capacity and proposed time are visible before opening an offer. */
function CandidateRow({ candidate: k, need, open }: { candidate: KandidatProjekcija; need: PotrebaProjekcija; open: () => void }) {
  const time = applicationInterval(k.predlozeniPocetak, k.predlozeniKraj, need.taskTimezone) ?? need.vremeTekst;
  const message = k.napomena?.trim() ?? '';
  const messagePreview = Array.from(message).slice(0, 180).join('');
  // This card is one accessible button: its explicit name replaces child text, so expose the
  // same offer facts and a bounded message before opening the offer marks it viewed.
  const hint = `Ukupno ${k.cena.prikaz}; ${osoba(k.pokrivaMesta)}; termin ${time}.${message
    ? ` Poruka: „${messagePreview}${messagePreview.length < message.length ? '…' : ''}“. Otvori ponudu za celu poruku.` : ''}`;
  return <Press accessibilityRole="button" accessibilityLabel={`Pogledaj ponudu: ${k.ime}`} haptic="select" scaleTo={0.985}
    accessibilityHint={hint} onPress={open} style={s.candidate}>
    <View style={s.candidateHead}>
      <ProfilePhoto profileId={k.radnikProfilId} size={64} initial={k.inicijali} />
      <View style={s.grow}>
        <T style={s.candidateName}>{k.ime}</T>
        {k.ocenaTekst === '—' ? <T variant="meta" tone="muted">Ocena nije dostupna</T>
          : <View style={s.inline}><Star size={13} weight="fill" color={sys.color.orange} />
            <T variant="meta" tone="muted">{k.ocenaTekst} · {k.recenzijeTekst}</T></View>}
      </View>
      <CaretRight size={20} color={sys.color.muted} />
    </View>
    <View style={s.candidateFoot}>
      <View style={s.offerTotal}><T style={s.price}>{k.cena.prikaz}</T><T variant="meta" tone="muted">Ukupno</T></View>
      <View style={s.inline}><FactArt kind="users" size={26} /><T variant="bodyStrong" style={s.ink}>{osoba(k.pokrivaMesta)}</T></View>
    </View>
    <View style={s.inline}><FactArt kind="calendar" size={24} /><T variant="meta" tone="muted" style={s.grow}>
      {time}</T></View>
    {message ? <View style={s.messagePreview}><T variant="note" style={s.ink} numberOfLines={2} ellipsizeMode="tail">{message}</T></View> : null}
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
    <View style={s.compareIdentity}><ProfilePhoto profileId={k.radnikProfilId} size={64} initial={k.inicijali} />
      <T variant="bodyStrong" style={s.ink}>{k.ime}</T>
      <T variant="meta" tone="muted">{k.ocenaTekst === '—' ? 'Ocena nije dostupna' : `${k.ocenaTekst} · ${k.recenzijeTekst}`}</T></View>
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
  const { width, fontScale } = useWindowDimensions();
  const columns = compare && width >= 360 && fontScale < 1.3 ? 2 : 1;
  // A new offer arriving is the news this screen exists to carry, so it is the one thing that moves.
  // The list that was already there settles silently, and switching to the comparison and back is
  // not an arrival either — `seen` belongs to this component, not to the FlatList it remounts.
  const appear = useAppear();
  appear.settle(candidates.map(k => k.prijavaId));
  return <SelectionFrame title={compare ? 'Uporedi prijave' : 'Prijave'} back={compare ? () => setCompare(false) : back} scroll={false}>
    <FlatList key={`${compare ? 'comparison' : 'offers'}:${columns}`} numColumns={columns} data={candidates} keyExtractor={k => k.prijavaId} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
      contentContainerStyle={s.content} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={<View style={s.listHeader}><TaskContext need={need} />
        <View style={s.row}><T variant="body" tone="muted" style={s.grow}>{prijava(candidates.length)} · još {plural(need.pokrivenost.preostalo, 'mesto', 'mesta', 'mesta')}</T>
          {candidates.length > 1 ? <V2Action label={compare ? 'Prikaži ponude' : 'Uporedi'} kind={compare ? 'quiet' : 'secondary'} onPress={() => setCompare(v => !v)} /> : null}</View>
      </View>}
      ListEmptyComponent={<View style={s.card}><T accessibilityRole="header" variant="title" style={s.ink}>Još nema prijava.</T><T variant="body" tone="muted">Kada neko pošalje ponudu za ovaj Zadatak, pojaviće se ovde.</T></View>}
      renderItem={({ item: k, index }) => <Appear index={index} animate={appear.isNew(k.prijavaId)} style={columns === 2 ? s.comparisonColumn : undefined}>
        {compare ? <CompareCell candidate={k} need={need} open={() => open(k)} />
          : <CandidateRow candidate={k} need={need} open={() => open(k)} />}
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
  return <SelectionFrame title={review || pending ? 'Pregled izbora' : 'Ponuda'} back={back}
    footer={confirmed ? <BrandAction label="Otvori Dogovor" onPress={openAgreement} />
      : candidate.stanje === 'SELECTED' && !pending ? <SelectedAgreementAction load={readAgreement} open={openLinkedAgreement} />
      : uncertain ? <BrandAction label="Proveri ishod" onPress={refresh} disabled={busy} />
      : review || pending ? <BrandAction label={busy ? 'Povezivanje…' : pending ? 'Ponovi isti izbor' : 'Izaberi ovu Prijavu'} onPress={choose}
        disabled={busy || (!pending && !candidate.mozeIzabrati)} />
      : candidate.mozeIzabrati ? <BrandAction label="Pregledaj povezivanje" onPress={() => setReview(true)} /> : undefined}>
    <TaskContext need={need} />
    <View style={s.card}><CandidateIdentity candidate={candidate} publicProfile={() => { void openProfile(); }} />
      <ProductFacts>
        <ProductFact art="money" label={`Ukupno za ${dolaziOsoba(candidate.pokrivaMesta)}`} value={candidate.cena.prikaz} prominent />
        <ProductFact art="users" label="Ljudi" value={osoba(candidate.pokrivaMesta)} />
        <ProductFact art="calendar" label="Termin" value={applicationInterval(candidate.predlozeniPocetak, candidate.predlozeniKraj, need.taskTimezone) ?? need.vremeTekst} />
      </ProductFacts>
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
  compareIdentity: { minHeight: 156, gap: 8 },
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 }, stack: { gap: 14 },
  eyebrow: { ...sys.type.label, color: sys.color.muted, fontWeight: '600', letterSpacing: 0.4, marginBottom: 2 }, ink: { color: sys.color.ink }, muted: { color: sys.color.muted },
  content: { padding: 20, paddingTop: 16, paddingBottom: 28 },
  card: { ...card, gap: 10 },
  cardSuccess: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  warnCard: { backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.card, padding: 18, gap: 8 },
  notice: { padding: 14, backgroundColor: sys.color.warnSoft, borderRadius: sys.radius.control },
  context: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: sys.color.greenSoft, borderRadius: sys.radius.card, gap: 4 },
  reviewContext: { gap: 4, paddingBottom: 4 },
  contextTitle: { ...sys.type.cardTitle, color: sys.color.green, marginBottom: 4 },
  contextPrice: { ...sys.type.priceSmall, color: sys.color.money, flex: 1 }, offers: { ...sys.type.bodyStrong, color: sys.color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pill: { paddingVertical: 4 }, pillText: { color: sys.color.ink, fontWeight: '600' },
  offerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' }, field: { flex: 1, gap: 6 },
  input: { ...sys.type.body, color: sys.color.ink, borderWidth: 1, borderRadius: sys.radius.control, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface, padding: 12 },
  amountInput: { ...sys.type.price, color: sys.color.ink, borderWidth: 1, borderRadius: sys.radius.control, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface, minHeight: 54, paddingHorizontal: 12, paddingVertical: 10 },
  inputLocked: { backgroundColor: sys.color.wash, color: sys.color.muted },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  term: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  footer: { backgroundColor: sys.color.surface, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderColor: sys.color.line, gap: 8 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }, summary: { ...sys.type.bodyStrong, color: sys.color.ink, flexShrink: 1, fontVariant: ['tabular-nums'] },
  listHeader: { gap: 14, marginBottom: 14 },
  candidate: { ...card, gap: 12, padding: 18 },
  candidateHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  candidateName: { ...sys.type.cardTitle, color: sys.color.ink },
  candidateFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  offerTotal: { flexGrow: 1, flexBasis: 160, maxWidth: '100%' },
  messagePreview: { borderLeftWidth: 2, borderColor: sys.color.lineStrong, paddingLeft: 12, paddingVertical: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stateBand: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control, paddingHorizontal: 12, paddingVertical: 8 },
  price: { ...sys.type.price, color: sys.color.money },
  comparison: { ...card, flex: 1, minWidth: 0, padding: 14, marginHorizontal: 4, gap: 8 },
  comparisonColumn: { flex: 1, minWidth: 0 },
  compareCell: { gap: 2, paddingTop: 8, borderTopWidth: 1, borderColor: sys.color.line }, compareLabel: { letterSpacing: 0.2 },
  comparePrice: { ...sys.type.priceSmall, color: sys.color.money },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 }, footerAction: { alignSelf: 'center', marginTop: 8 },
});
