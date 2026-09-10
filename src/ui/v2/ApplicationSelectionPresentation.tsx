import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija, PrilikaProjekcija } from '../../contracts/projections';
import { calendarInstant } from '../../lib/calendarTime';
import type { Ishod } from '../../data/ports';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, displayDate, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from './V2Action';
import { V2Icon } from './icons';
import { v2 } from './tokens';

export type ApplicationDraft = { price: string; people: string; note: string; start: string | null; end: string | null };
export function applicationInterval(start: string | null | undefined, end: string | null | undefined, timezone?: string): string | null {
  const from = calendarInstant(start), to = calendarInstant(end);
  if (from === null || to === null || from >= to) return null;
  try {
    const zone = timezone ?? 'UTC';
    const a = zonedParts(new Date(Number(from / 1000n)), zone), b = zonedParts(new Date(Number(to / 1000n)), zone);
    return `${displayDate(a.date)} · ${a.time.slice(0, 5)}–${a.date === b.date ? '' : `${displayDate(b.date)} · `}${b.time.slice(0, 5)} (${zone})`;
  } catch { return null; }
}
export function candidateState(k: KandidatProjekcija): string {
  return ({ SELECTABLE: 'Poslata prijava', STALE: 'Potrebna nova provera', OVERFILL: 'Više ljudi nego što je preostalo',
    SELECTED: 'Izabrana prijava', WITHDRAWN: 'Povučena prijava', CLOSED: 'Zadatak je zatvoren', FULL: 'Sva mesta su popunjena' })[k.stanje];
}
export function SelectionFrame({ title, subtitle, back, children, footer, scroll = true }: {
  title: string; subtitle?: string; back: () => void; children: ReactNode; footer?: ReactNode; scroll?: boolean;
}) {
  const reduced = useReducedMotion();
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <View style={s.header}><Press accessibilityRole="button" accessibilityLabel="Nazad na zadatak" onPress={back} style={s.back}>
      <V2Icon name="back" size={20} /></Press><View style={{ flex: 1 }}>{subtitle ? <T style={s.eyebrow}>{subtitle}</T> : null}
      <T accessibilityRole="header" style={s.title}>{title}</T></View></View>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(v2.motion.screenMs)} style={{ gap: 18 }}>{children}</Animated.View>
      </ScrollView> : <View style={{ flex: 1 }}>{children}</View>}{footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export function SelectionUnavailable({ loading, message, retry, back }: { loading: boolean; message: string; retry?: () => void; back: () => void }) {
  return <SelectionFrame title="Prijave" back={back}><View style={s.context}>
    {loading ? <ActivityIndicator accessibilityLabel="Učitavanje prijava" color={v2.color.teal} /> : null}
    <T accessibilityRole={loading ? undefined : 'alert'} style={s.body}>{loading ? 'Učitavamo aktuelne podatke…' : message}</T>
    {!loading && retry ? <V2Action label="Pokušajte ponovo" onPress={retry} /> : null}
  </View></SelectionFrame>;
}
export function TaskContext({ need }: { need: PotrebaProjekcija | PrilikaProjekcija }) {
  return <View style={s.context}><T style={s.title}>{need.naslov}</T>
    <T style={s.caption}>{need.podrucjeTekst}</T><T style={s.caption}>{need.vremeTekst}</T>
    <View style={s.row}><T style={[s.title, { flex: 1 }]}>{need.rezimCene === 'MY_PRICE' ? need.ponudjenaCena?.prikaz : 'Tražim ponude'}</T>
      <View style={s.badge}><T style={s.caption}>{need.pokrivenost.popunjeno} / {need.pokrivenost.ukupno} ljudi</T></View></View>
  </View>;
}
function OrangeAction({ label, onPress, disabled, send }: { label: string; onPress: () => void; disabled?: boolean; send?: boolean }) {
  return <V2Action label={label} onPress={onPress} disabled={disabled} kind="secondary"
    icon={send ? <V2Icon name="send" size={20} /> : undefined}
    style={{ minHeight: 50, backgroundColor: v2.color.orange, borderWidth: 0 }} />;
}
function ErrorMessage({ error }: { error?: string | null }) {
  return error ? <View style={s.notice}><T accessibilityRole="alert" style={s.body}>{error}</T></View> : null;
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
    <SelectionFrame title="Predlog termina" back={close} footer={<OrangeAction label="Potvrdi termin" onPress={apply} />}>
      <T style={s.eyebrow}>VREME BEZ IZMIŠLJANJA</T><T style={s.hero}>Ponudite tačan početak i kraj.</T>
      <T style={s.body}>Vremenska zona: {timezone}. Ovaj predlog pripada Vašoj Prijavi.</T>
      <CivilField label="Datum početka" mode="date" value={start.date} onChange={value => { setStart(v => ({ ...v, date: value })); setDirtyStart(true); }} />
      <CivilField label="Početak" mode="time" value={start.time} onChange={value => { setStart(v => ({ ...v, time: value })); setDirtyStart(true); }} />
      <CivilField label="Datum kraja" mode="date" value={end.date} onChange={value => { setEnd(v => ({ ...v, date: value })); setDirtyEnd(true); }} />
      <CivilField label="Kraj" mode="time" value={end.time} onChange={value => { setEnd(v => ({ ...v, time: value })); setDirtyEnd(true); }} />
      <ErrorMessage error={error} /><V2Action label="Koristi termin Zadatka" onPress={() => accept(null, null)} />
    </SelectionFrame>
  </Modal>;
}
export function ApplicationSelectionPresentation({ need, opportunity, draft, change, submit, back, busy, pending, uncertain, refresh, error, confirmed, openApplications, canSubmit, reset }: {
  need: PotrebaProjekcija; opportunity: PrilikaProjekcija; draft: ApplicationDraft; change: (value: ApplicationDraft) => void;
  submit: () => void; back: () => void; busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void;
  error: string | null; confirmed: boolean; openApplications: () => void; canSubmit: boolean; reset?: () => void;
}) {
  const [editingTime, setEditingTime] = useState(false);
  const disabled = busy || pending || confirmed;
  const exact = applicationInterval(draft.start, draft.end, need.taskTimezone);
  const fixed = need.schedule?.kind === 'FIXED_WINDOW' ? applicationInterval(need.schedule.startsAt, need.schedule.endsAt, need.taskTimezone) : null;
  return <SelectionFrame title="Tvoja prijava" back={back} footer={<>
    <T style={s.caption}>Tvoja ponuda</T><T style={s.strong}>{draft.price || '—'} RSD · {draft.people || '—'} ljudi</T>
    {confirmed ? <OrangeAction label="Otvori moje prijave" onPress={openApplications} />
      : uncertain ? <OrangeAction label="Proverite ishod" onPress={refresh} disabled={busy} />
      : <OrangeAction label={busy ? 'Slanje…' : pending ? 'Ponovi istu Prijavu' : 'Pošalji ovu Prijavu'} onPress={submit}
        disabled={busy || (!pending && !canSubmit)} send />}
  </>}>
    <TaskContext need={opportunity} />
    <View style={s.offer}><T style={s.eyebrow}>TVOJA PONUDA</T><View style={[s.row, { alignItems: 'flex-start' }]}>
      <View style={{ flex: 2, gap: 8 }}><T style={s.fieldLabel}>Cena za ponuđeni obim (RSD)</T>
        <TextInput accessibilityLabel="Cena za ponuđeni obim (RSD)" keyboardType="number-pad" maxLength={10} value={draft.price}
          editable={!disabled && opportunity.rezimCene !== 'MY_PRICE'} style={s.amountInput}
          onChangeText={price => { if (!disabled && opportunity.rezimCene !== 'MY_PRICE') change({ ...draft, price }); }} /></View>
      <View style={{ flex: 1, gap: 8 }}><T style={s.fieldLabel}>Ljudi</T>
        <TextInput accessibilityLabel="Ljudi" keyboardType="number-pad" maxLength={4} value={draft.people} editable={!disabled} style={s.amountInput}
          onChangeText={people => { if (!disabled) change({ ...draft, people }); }} /></View></View>
      <T style={s.caption}>Cena se čita zajedno sa brojem ljudi koje obezbeđujete. Ne deli se automatski na osobe.</T>
    </View>
    <T style={s.eyebrow}>TERMIN I PORUKA</T>
    <Press accessibilityRole="button" accessibilityLabel="Termin Prijave" disabled={disabled} accessibilityState={{ disabled }}
      onPress={() => setEditingTime(true)} style={s.term}>
      <View style={{ flex: 1 }}><T style={s.strong}>Termin</T><T style={s.caption}>{exact ?? fixed ?? need.vremeTekst}</T></View><V2Icon name="chevron" />
    </Press>
    {!exact && !fixed ? <T style={s.caption}>Tačan termin još nije ponuđen. Fleksibilno vreme ne rezerviše tačan interval.</T> : null}
    <View style={{ gap: 8 }}><T style={s.strong}>Kratka napomena</T><TextInput accessibilityLabel="Kratka napomena" multiline maxLength={4000}
      value={draft.note} editable={!disabled} style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]}
      onChangeText={note => { if (!disabled) change({ ...draft, note }); }} /><T style={s.caption}>Napišite ono što pomaže Naručiocu da razume Vašu ponudu.</T></View>
    <ErrorMessage error={error} />
    {error && !pending ? <V2Action label="Osveži Zadatak" onPress={refresh} disabled={busy} /> : null}
    {pending && !confirmed ? <T style={s.caption}>Sačuvana je ista ponuda za proveru ishoda. Ponavljanje koristi njen prvobitni termin, cenu i broj ljudi.</T> : null}
    {confirmed ? <View style={s.offer}><T style={s.title}>Prijava je poslata.</T><T style={s.body}>Naručilac može da izabere ovu konkretnu ponudu. Izbor odmah sklapa Dogovor.</T></View> : null}
    {reset ? <V2Action label="Pregledaj uslove i uredi novu ponudu" onPress={reset} disabled={busy} /> : null}
    {editingTime && !disabled ? <IntervalEditor draft={draft} timezone={need.taskTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
      close={() => setEditingTime(false)} accept={(start, end) => { change({ ...draft, start, end }); setEditingTime(false); }} /> : null}
  </SelectionFrame>;
}
function CandidateIdentity({ candidate, publicProfile }: { candidate: KandidatProjekcija; publicProfile: () => void }) {
  return <View style={s.row}><View style={s.avatar}><T style={s.title}>{candidate.inicijali}</T></View><View style={{ flex: 1, gap: 4 }}>
    <T style={s.title}>{candidate.ime}</T><T style={s.caption}>{candidate.pokrivaMesta} {candidate.pokrivaMesta === 1 ? 'osoba · dolazi samostalno' : 'osobe · dolazi tim'}</T>
    {candidate.ocenaTekst !== '—' ? <T style={s.caption}>{candidate.ocenaTekst} · {candidate.recenzijeTekst}</T> : null}
    <V2Action label="Javni profil" kind="quiet" onPress={publicProfile} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
  </View></View>;
}
export function CandidateListPresentation({ need, candidates, open, back, refresh }: {
  need: PotrebaProjekcija; candidates: KandidatProjekcija[]; open: (candidate: KandidatProjekcija) => void; back: () => void; refresh: () => void;
}) {
  const [compare, setCompare] = useState(false);
  return <SelectionFrame title={compare ? 'Uporedi prijave' : 'Prijave'} subtitle="Ponude ljudi koji mogu da uskoče" back={compare ? () => setCompare(false) : back} scroll={false}>
    <FlatList key={compare ? 'comparison' : 'offers'} numColumns={compare ? 2 : 1} data={candidates} keyExtractor={k => k.prijavaId} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
      contentContainerStyle={s.content} ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
      ListHeaderComponent={<View style={{ gap: 18, marginBottom: 18 }}><TaskContext need={need} /><View style={s.row}><T style={[s.caption, { flex: 1 }]}>{candidates.length} konkretnih ponuda · još {need.pokrivenost.preostalo} ljudi</T>
      {candidates.length > 1 ? <V2Action label={compare ? 'Prikaži ponude' : 'Uporedi'} kind="quiet" onPress={() => setCompare(v => !v)} /> : null}</View>
      {compare ? <><T style={s.eyebrow}>KONKRETNE PONUDE</T><T style={s.hero}>Uporedi isti obim, ne samo cenu.</T>
        <T style={s.body}>Cena, broj ljudi i termin pripadaju svakoj pojedinačnoj ponudi.</T></> : null}
      </View>}
      ListEmptyComponent={<View style={s.context}><T style={s.title}>Još nema prijava.</T><T style={s.body}>Kada neko pošalje ponudu za ovaj Zadatak, pojaviće se ovde.</T></View>}
      renderItem={({ item: k }) => compare ? <View style={s.comparison}>
        <T style={s.strong}>{k.ime}</T><T style={s.caption}>{candidateState(k)}</T><View style={s.divider} />
        <T style={s.fieldLabel}>CENA ZA PONUĐENI OBIM</T><T style={s.strong}>{k.cena.prikaz}</T><View style={s.divider} />
        <T style={s.fieldLabel}>LJUDI</T><T style={s.strong}>{k.pokrivaMesta} {k.pokrivaMesta === 1 ? 'osoba' : 'osobe'}</T><View style={s.divider} />
        <T style={s.fieldLabel}>TERMIN</T><T style={s.caption}>{applicationInterval(k.predlozeniPocetak, k.predlozeniKraj, need.taskTimezone) ?? need.vremeTekst}</T><View style={s.divider} />
        <T style={s.fieldLabel}>UZ OVU PRIJAVU</T><T style={s.caption}>{[...(k.dokazPrijave.vestine ?? []), ...(k.dokazPrijave.alati ?? []), ...(k.dokazPrijave.vozila ?? [])].join(' · ') || 'Nema dodatno navedenih sposobnosti.'}</T>
        <V2Action label={`Otvori prijavu: ${k.ime}`} onPress={() => open(k)} />
      </View> : <View style={s.candidate}><View style={s.row}><View style={s.avatar}><T style={s.strong}>{k.inicijali}</T></View>
      <View style={{ flex: 1 }}><T style={s.strong}>{k.ime}</T><T style={s.caption}>{k.pokrivaMesta} {k.pokrivaMesta === 1 ? 'osoba · dolazi samostalno' : 'osobe · dolazi tim'}</T></View></View>
      <View style={s.row}><T style={[s.hero, { flex: 1 }]}>{k.cena.prikaz}</T><T style={s.badge}>{candidateState(k)}</T></View>
      <T style={s.caption}>{applicationInterval(k.predlozeniPocetak, k.predlozeniKraj, need.taskTimezone) ?? need.vremeTekst}</T>
      {k.napomena ? <T style={s.body}>{k.napomena}</T> : null}
      <View style={s.divider} /><View style={s.row}><T style={[s.caption, { flex: 1 }]}>Za {k.pokrivaMesta} ljudi</T>
        <V2Action label={`Pogledaj ponudu: ${k.ime}`} onPress={() => open(k)} style={{ backgroundColor: v2.color.soft }} /></View>
    </View>}
      ListFooterComponent={<V2Action label="Osveži prijave" kind="quiet" onPress={refresh} />} />
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
  if (state.id) return <OrangeAction label="Otvori Dogovor" onPress={() => { if (state.id) open(state.id); }} />;
  return <><T style={s.caption}>{state.loading ? 'Proveravamo Dogovor uz ovu Prijavu…' : 'Veza sa Dogovorom trenutno nije dostupna.'}</T>
    <V2Action label="Proveri Dogovor" onPress={() => { if (!state.loading) void read(); }} disabled={state.loading} /></>;
}
export function CandidateSelectionPresentation({ need, candidate, back, publicProfile, choose, busy, pending, uncertain, refresh, error, confirmed, openAgreement, reset, readAgreement, openLinkedAgreement }: {
  need: PotrebaProjekcija; candidate: KandidatProjekcija; back: () => void; publicProfile: () => Promise<JavniProfilProjekcija | null>; choose: () => void;
  busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void; error: string | null; confirmed: boolean;
  openAgreement: () => void; reset?: () => void;
  readAgreement: () => Promise<Ishod<{ dogovorId: string | null }>>; openLinkedAgreement: (id: string) => void;
}) {
  const reduced = useReducedMotion();
  const [review, setReview] = useState(false);
  const [profile, setProfile] = useState<{ loading: boolean; data: JavniProfilProjekcija | null } | null>(null);
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
    footer={confirmed ? <OrangeAction label="Otvori Dogovor" onPress={openAgreement} />
      : candidate.stanje === 'SELECTED' && !pending ? <SelectedAgreementAction load={readAgreement} open={openLinkedAgreement} />
      : uncertain ? <OrangeAction label="Proverite ishod" onPress={refresh} disabled={busy} />
      : review || pending ? <OrangeAction label={busy ? 'Povezivanje…' : pending ? 'Ponovi isti izbor' : 'Izaberi ovu Prijavu'} onPress={choose}
        disabled={busy || (!pending && !candidate.mozeIzabrati)} />
      : candidate.mozeIzabrati ? <OrangeAction label="Pregledaj povezivanje" onPress={() => setReview(true)} /> : undefined}>
    <TaskContext need={need} /><View style={s.offer}><CandidateIdentity candidate={candidate} publicProfile={() => { void openProfile(); }} />
      <T style={s.hero}>{candidate.cena.prikaz}</T><T style={s.caption}>Za ponuđeni obim · {candidate.pokrivaMesta} ljudi</T>
      <T style={s.caption}>{applicationInterval(candidate.predlozeniPocetak, candidate.predlozeniKraj, need.taskTimezone) ?? need.vremeTekst}</T>
      <T style={s.strong}>{candidateState(candidate)}</T></View>
    <T style={s.eyebrow}>PORUKA UZ PRIJAVU</T><T style={s.body}>{candidate.napomena || 'Nema dodatne poruke.'}</T><View style={s.divider} />
    <View style={s.offer}><T style={s.eyebrow}>USLOVI UZ OVU PRIJAVU</T>
      {evidence.sema === 'APPLICATION_V1_SELF_DECLARED' ? <><T style={s.body}>{[...(evidence.vestine ?? []), ...(evidence.alati ?? []),
        ...(evidence.vozila ?? []), ...(evidence.licence ?? [])].join(' · ') || 'Nema dodatno navedenih sposobnosti.'}</T>
        <T style={s.caption}>Sačuvana samoizjava uz ovu Prijavu. Kasnija izmena radnog profila je ne prepisuje.</T></>
        : <T style={s.caption}>Za ovu stariju Prijavu sačuvani dokazi o sposobnostima nisu dostupni.</T>}
    </View>
    {review || pending ? <View style={s.notice}><T style={s.title}>Jedan izbor sklapa Dogovor.</T><T style={s.body}>
      Izborom prihvatate ovu ponudu: {candidate.cena.prikaz} za {candidate.pokrivaMesta} ljudi. Dogovor odmah važi za obe strane.</T>
      <T style={s.caption}>Vaši paralelni zadaci ostaju odvojeni. Termin Uskočera ponovo se proverava pri izboru.</T></View> : null}
    {confirmed ? <T style={s.title}>Dogovor je sklopljen.</T> : candidate.stanje === 'SELECTED' && !pending ? <T style={s.body}>Ova ponuda je izabrana.</T>
      : !candidate.mozeIzabrati && !pending ? <T style={s.body}>{candidateState(candidate)}. Osvežite Prijave da proverite aktuelno stanje.</T> : null}
    <ErrorMessage error={error} />{reset ? <V2Action label="Pregledaj aktuelne prijave" onPress={reset} disabled={busy} /> : null}
    {profile ? <Modal visible presentationStyle="pageSheet" animationType={reduced ? 'none' : 'slide'} onRequestClose={closeProfile}>
      <SelectionFrame title="Javni profil" back={closeProfile}>
        {profile.loading ? <ActivityIndicator accessibilityLabel="Učitavanje javnog profila" color={v2.color.teal} />
          : !profile.data ? <><ErrorMessage error="Javni profil trenutno nije dostupan." /><V2Action label="Pokušajte ponovo" onPress={() => { void openProfile(); }} /></>
          : <View style={s.offer}><T style={s.hero}>{profile.data.ime ?? 'Uskočer'}</T>
            {profile.data.grad ? <T style={s.caption}>{profile.data.grad}</T> : null}
            {profile.data.naslov ? <T style={s.title}>{profile.data.naslov}</T> : null}
            {profile.data.biografija ? <T style={s.body}>{profile.data.biografija}</T> : null}
            {profile.data.poverenje.ocenaDostupna ? <T style={s.body}>Ocena: {profile.data.poverenje.ocenaProsek ?? '—'}</T> : <T style={s.caption}>Ocena nije dostupna.</T>}
            {profile.data.poverenje.verifikacijaIdentitetaDostupna && profile.data.poverenje.identitetVerifikovan ? <T style={s.strong}>Identitet je potvrđen.</T> : null}
          </View>}
      </SelectionFrame>
    </Modal> : null}
  </SelectionFrame>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2.color.canvas }, header: { paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-start' }, content: { padding: 18, paddingTop: 6, paddingBottom: 26 },
  title: { ...v2.text.title, color: v2.color.ink }, hero: { ...v2.text.hero, color: v2.color.ink }, body: { ...v2.text.body, color: v2.color.muted },
  strong: { ...v2.text.body, fontWeight: '700', color: v2.color.ink }, caption: { fontSize: 13, lineHeight: 19, color: v2.color.muted },
  eyebrow: { fontSize: 11, lineHeight: 16, letterSpacing: 1.1, fontWeight: '600', color: v2.color.teal }, fieldLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: v2.color.muted },
  context: { padding: 20, borderWidth: 1, borderRadius: 18, borderColor: v2.color.contextLine, backgroundColor: v2.color.context, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, badge: { fontSize: 12, lineHeight: 17, color: v2.color.muted, backgroundColor: v2.color.soft, padding: 8, borderRadius: 10, flexShrink: 1 },
  offer: { borderWidth: 1, borderColor: v2.color.controlLine, borderRadius: 22, backgroundColor: v2.color.contextEnd, padding: 18, gap: 12 },
  candidate: { borderWidth: 1, borderColor: v2.color.line, borderRadius: 24, backgroundColor: v2.color.surface, padding: 18, gap: 14 },
  comparison: { flex: 1, minWidth: 0, padding: 14, marginHorizontal: 4, borderWidth: 1, borderRadius: 18, borderColor: v2.color.controlLine, backgroundColor: v2.color.surface, gap: 10 },
  input: { fontSize: 16, lineHeight: 24, color: v2.color.ink, borderWidth: 1, borderRadius: 11, borderColor: v2.color.controlLine, backgroundColor: v2.color.surface, padding: 12 },
  amountInput: { fontSize: 22, fontWeight: '700', color: v2.color.ink, borderWidth: 1, borderRadius: 11, borderColor: v2.color.controlLine, backgroundColor: v2.color.surface, minHeight: 52, padding: 12 },
  term: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: v2.color.line, paddingBottom: 8 },
  footer: { backgroundColor: v2.color.surface, paddingHorizontal: 18, paddingVertical: 12, borderTopWidth: 1, borderColor: v2.color.line, gap: 6 },
  notice: { padding: 16, backgroundColor: v2.color.warm, borderRadius: 16, gap: 10 }, divider: { height: 1, backgroundColor: v2.color.line },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#D6E9E0', alignItems: 'center', justifyContent: 'center' },
});
