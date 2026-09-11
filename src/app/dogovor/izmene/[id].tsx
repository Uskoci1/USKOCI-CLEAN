import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { agreementChangeService, type AgreementChangeProposal, type AgreementChangeSnapshot, type AgreementChangeTerms } from '../../../data/agreementClientService';
import type { Ishod, IzmenaKomanda } from '../../../data/ports';
import { failure, positiveInteger, uuid } from '../../../data/serverReceipt';
import { needScheduleText } from '../../../data/needDetailPresentation';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { calendarInstant } from '../../../lib/calendarTime';
import { noviZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { ulogaSada, useUloga } from '../../../store/uloga';
import { CalendarScreen, CivilField, calendarStyles as s } from '../../../ui/calendar/CalendarControls';
import { civilInstant, zonedParts } from '../../../ui/calendar/calendarPresentation';
import { T } from '../../../ui/Text';
import { v2 } from '../../../ui/v2/tokens';
import { V2Action } from '../../../ui/v2/V2Action';

type Attempt = { kind: 'propose'; command: IzmenaKomanda } | { kind: 'respond'; proposal: AgreementChangeProposal; accept: boolean };
type Draft = { base: AgreementChangeSnapshot; price: string; scope: string; reason: string; editTime: boolean;
  start: { date: string; time: string }; end: { date: string; time: string }; dirtyStart: boolean; dirtyEnd: boolean };
const body = { ...v2.text.body, color: v2.color.ink }, meta = { ...v2.text.label, color: v2.color.muted };
const unconfirmed = () => failure('AGREEMENT_CHANGE_UNCONFIRMED', 'Promena nije potvrđena. Osvežite sačuvane predloge pre ponovnog pokušaja.');
function matchesCommand(proposal: AgreementChangeProposal, command: IzmenaKomanda) {
  if (!proposal.termsAvailable || proposal.baseVersion !== command.ocekivanaVerzija ||
    proposal.reason !== (command.razlog?.trim() || null)) return false;
  const delta = command.izmena, terms = proposal.terms;
  return (delta.cenaIznos === undefined || terms.priceRsd === delta.cenaIznos) &&
    (delta.cenaValuta === undefined || terms.currency === delta.cenaValuta) &&
    (delta.obim === undefined || terms.scopeNote === delta.obim) &&
    (delta.pocetakIso === undefined || calendarInstant(terms.startsAt) === calendarInstant(delta.pocetakIso)) &&
    (delta.krajIso === undefined || calendarInstant(terms.endsAt) === calendarInstant(delta.krajIso));
}
function back(id: string) { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/dogovor/[id]', params: { id } }); }
function Terms({ terms }: { terms: AgreementChangeTerms }) {
  return <View style={{ gap: 8 }}><T style={{ ...v2.text.title, color: v2.color.ink }}>{terms.priceRsd.toLocaleString('sr-Latn-RS')} RSD</T>
    <T style={body}>{terms.scopeNote || 'Nema dodatnog opisa obima.'}</T>
    <T style={meta}>{terms.startsAt === null && terms.endsAt === null ? 'Termin nije potvrđen' : needScheduleText({
      kind: 'FIXED_WINDOW', startsAt: terms.startsAt, endsAt: terms.endsAt })}</T></View>;
}
export default function AgreementChanges() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const session = useSesija(), intent = useUloga(), accountId = session.user?.id;
  if (!uuid(id) || !accountId) return <CalendarScreen title="Izmene Dogovora" back={() => router.replace('/dogovori')}>
    <T style={body}>Dogovor nije dostupan. Prijavite se i ponovo ga otvorite.</T></CalendarScreen>;
  return <Changes key={`${accountId}:${session.accountRevision}:${intent}:${id}`} id={id} accountId={accountId} accountRevision={session.accountRevision} />;
}
function Changes({ id, accountId, accountRevision }: { id: string; accountId: string; accountRevision: number }) {
  const intent = useUloga();
  const [draft, setDraft] = useState<Draft | null>(null), draftRef = useRef<Draft | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null), attemptRef = useRef<Attempt | null>(null);
  const [notice, setNotice] = useState<string | null>(null), [rejected, setRejected] = useState(false);
  const dialog = useRef<object | null>(null), generation = useRef(0), focus = useRef<object | null>(null);
  const active = useRef(!AppState.currentState || AppState.currentState === 'active');
  const fresh = useRef(active.current), epoch = useRef(0);
  const [foreground, setForeground] = useState(active.current), [resume, setResume] = useState(!active.current);
  const [resumeEpoch, setResumeEpoch] = useState(0);
  const [zone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const owns = useCallback(() => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision
    && ulogaSada() === intent, [accountId, accountRevision, intent]);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner;
    return () => { if (focus.current === owner) { focus.current = null; dialog.current = null; } };
  }, [owns]));
  const read = useCallback(async () => {
    generation.current++; dialog.current = null;
    return agreementChangeService.read(id, { accountId, accountRevision });
  }, [id, accountId, accountRevision]);
  const editor = useOwnedEditor(read);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      dialog.current = null; active.current = state === 'active'; fresh.current = false; epoch.current++;
      setForeground(active.current); setResume(true); setResumeEpoch(epoch.current);
    });
    return () => { subscription.remove(); active.current = false; fresh.current = false; epoch.current++; };
  }, []);
  useEffect(() => {
    if (!foreground || !resume || editor.busy) return;
    let current = true; const stamp = epoch.current;
    void editor.refresh().then(() => {
      if (current && active.current && epoch.current === stamp) { fresh.current = true; setResume(false); }
    });
    return () => { current = false; };
  }, [foreground, resume, resumeEpoch, editor.busy, editor.refresh]);
  const snapshot = editor.data, renderedGeneration = generation.current, renderedFocus = focus.current;
  const enabled = foreground && !resume && !editor.loading && !editor.error && !editor.busy && !editor.uncertain;
  const current = () => enabled && owns() && active.current && fresh.current && renderedFocus !== null
    && focus.current === renderedFocus && generation.current === renderedGeneration;
  const update = (value: Draft | null) => { dialog.current = null; draftRef.current = value; setDraft(value); };
  const begin = () => {
    if (!current() || !snapshot || snapshot.agreementStatus !== 'CONFIRMED' || attemptRef.current) return;
    const parts = (iso: string | null) => iso ? zonedParts(new Date(iso), zone) : { date: '', time: '' };
    update({ base: snapshot, price: String(snapshot.terms.priceRsd), scope: snapshot.terms.scopeNote, reason: '', editTime: false,
      start: parts(snapshot.terms.startsAt), end: parts(snapshot.terms.endsAt), dirtyStart: false, dirtyEnd: false });
    setNotice(null);
  };
  const change = (patch: Partial<Draft>) => { if (current() && draftRef.current && !attemptRef.current) update({ ...draftRef.current, ...patch }); };
  const run = async (command: Attempt) => {
    if (!current()) return;
    const owner = renderedFocus, stamp = epoch.current;
    const owned = () => owns() && focus.current === owner && active.current && fresh.current && epoch.current === stamp;
    await editor.save(async (): Promise<Ishod<AgreementChangeSnapshot>> => {
      attemptRef.current = command; setAttempt(command); setRejected(false); setNotice(null);
      const receipt = command.kind === 'propose'
        ? await agreementChangeService.propose(command.command, { accountId, accountRevision })
        : await agreementChangeService.respond(command.proposal, command.accept, { accountId, accountRevision });
      if (!owned()) return unconfirmed();
      if (!receipt.ok) {
        // These explicit transaction refusals permit a new intent only after
        // a successful refresh. Unknown/timeout/invalid receipts keep the same key.
        setRejected(['VERSION_CONFLICT', 'PROPOSAL_NOT_PENDING', 'AGREEMENT_NOT_ACTIVE', 'WORKER_CALENDAR_CONFLICT',
          'AGREEMENT_CALENDAR_INTERVAL_INVALID', 'CHANGE_TERMS_INVALID'].includes(receipt.kod));
        return receipt;
      }
      const next = await read();
      if (!owned() || !next.ok) return unconfirmed();
      const stored = next.podatak.proposals.find(proposal => proposal.proposalId === receipt.podatak.proposalId);
      if (!stored || (command.kind === 'propose' && (stored.proposedBy !== accountId || !matchesCommand(stored, command.command))) ||
        (command.kind === 'respond' && (stored.baseVersion !== command.proposal.baseVersion ||
          stored.status !== (command.accept ? 'ACCEPTED' : 'REJECTED') || stored.respondedBy !== accountId))) return unconfirmed();
      attemptRef.current = null; setAttempt(null); update(null);
      setNotice(command.kind === 'propose' ? 'Predlog je sačuvan. Važeći uslovi se menjaju tek kada ga druga strana prihvati.'
        : command.accept ? 'Prihvatanje je potvrđeno. Prikazani su aktuelni sačuvani uslovi.' : 'Predlog je odbijen. Važeći uslovi ostaju sačuvani.');
      return next;
    });
  };
  const submit = () => {
    if (!current() || !snapshot || !draftRef.current || attemptRef.current) return;
    const value = draftRef.current;
    if (snapshot.agreementVersion !== value.base.agreementVersion || snapshot.agreementStatus !== 'CONFIRMED') {
      setNotice('Dogovor je promenjen. Otvorite novi predlog prema važećim uslovima.'); return;
    }
    if (!/^\d+$/.test(value.price.trim()) || !positiveInteger(Number(value.price))) { setNotice('Unesite pozitivan ceo iznos u RSD.'); return; }
    const patch: IzmenaKomanda['izmena'] = {};
    if (Number(value.price) !== value.base.terms.priceRsd) patch.cenaIznos = Number(value.price);
    if (value.scope !== value.base.terms.scopeNote) patch.obim = value.scope;
    if (value.editTime && (value.dirtyStart || value.dirtyEnd)) {
      const start = value.dirtyStart ? civilInstant(value.start.date, value.start.time, zone) : { value: value.base.terms.startsAt, error: null };
      const end = value.dirtyEnd ? civilInstant(value.end.date, value.end.time, zone) : { value: value.base.terms.endsAt, error: null };
      const a = calendarInstant(start.value), b = calendarInstant(end.value);
      if (!start.value || !end.value || a === null || b === null || a >= b) {
        setNotice(start.error ?? end.error ?? 'Izaberite tačan početak i kraj termina. Kraj mora biti kasnije.'); return;
      }
      patch.pocetakIso = start.value; patch.krajIso = end.value;
    }
    if (!Object.keys(patch).length) { setNotice('Izmenite cenu, obim posla ili termin.'); return; }
    void run({ kind: 'propose', command: { dogovorId: id, ocekivanaVerzija: value.base.agreementVersion,
      izmena: patch, razlog: value.reason.trim() || undefined, clientRequestId: noviZahtevId('agreement-change') } });
  };
  const respond = (proposal: AgreementChangeProposal, accept: boolean) => {
    if (!current() || !snapshot || attemptRef.current || dialog.current || proposal.status !== 'PENDING' ||
      proposal.baseVersion !== snapshot.agreementVersion || snapshot.agreementStatus !== 'CONFIRMED' ||
      proposal.proposedBy === accountId || (accept && !proposal.termsAvailable)) return;
    const token = {}; dialog.current = token;
    const retire = () => { if (dialog.current === token) dialog.current = null; };
    Alert.alert(accept ? 'Prihvati ove uslove?' : 'Odbij ovaj predlog?', accept
      ? 'Cena, obim i termin iz predloga odmah postaju novi uslovi Dogovora.' : 'Važeći uslovi ostaju nepromenjeni.', [
      { text: 'Nazad', style: 'cancel', onPress: retire },
      { text: accept ? 'Prihvati izmenu' : 'Odbij predlog', onPress: () => {
        if (dialog.current !== token || !current()) return; retire(); void run({ kind: 'respond', proposal, accept });
      } },
    ], { cancelable: true, onDismiss: retire });
  };
  const loading = !foreground || resume || editor.loading;
  return <CalendarScreen title="Izmene Dogovora" back={() => back(id)}>
    {loading ? <ActivityIndicator accessibilityLabel="Učitavanje izmena Dogovora" color={v2.color.teal} /> : null}
    {editor.error ? <T accessibilityRole="alert" style={body}>{editor.error}</T> : null}
    {!loading ? <V2Action label="Osveži sačuvane predloge" disabled={editor.busy} onPress={() => void editor.refresh()} /> : null}
    {notice && !loading ? <T accessibilityRole="alert" style={body}>{notice}</T> : null}
    {snapshot && !loading ? <>
      <View style={s.note}><T style={meta}>VAŽEĆI USLOVI · VERZIJA {snapshot.agreementVersion}</T><Terms terms={snapshot.terms} /></View>
      {attempt ? <View style={s.card}><T style={body}>Sačuvan je isti pokušaj. Prvo osvežite podatke, pa proverite njegov ishod.</T>
        <V2Action label="Ponovi isti zahtev" disabled={!enabled} onPress={() => { if (attemptRef.current) void run(attemptRef.current); }} />
        {rejected && enabled ? <V2Action label="Otvori novi predlog" onPress={() => {
          if (!current()) return; attemptRef.current = null; setAttempt(null); update(null); setRejected(false); begin();
        }} /> : null}</View> : null}
      {snapshot.agreementStatus === 'CONFIRMED' && !draft && !attempt ? <V2Action label="Predloži izmenu" kind="primary" disabled={!enabled} onPress={begin} /> : null}
      {draft ? <View style={s.card}>
        <T accessibilityRole="header" style={{ ...v2.text.title, color: v2.color.ink }}>Novi predlog</T>
        <T style={meta}>Oba učesnika vide predlog. Uslovi ostaju važeći do prihvatanja.</T>
        <T style={body}>Cena u RSD</T><TextInput accessibilityLabel="Nova cena u RSD" value={draft.price} editable={enabled && !attempt}
          keyboardType="number-pad" style={s.input} onChangeText={price => change({ price })} />
        <T style={body}>Obim posla</T><TextInput accessibilityLabel="Novi obim posla" value={draft.scope} editable={enabled && !attempt}
          multiline style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]} onChangeText={scope => change({ scope })} />
        <V2Action label={draft.editTime ? 'Zadrži postojeći termin' : 'Predloži drugi termin'} disabled={!enabled || !!attempt}
          onPress={() => change({ editTime: !draft.editTime })} />
        {draft.editTime ? <View style={{ gap: 12 }}><T style={meta}>Vreme unosite u zoni uređaja: {zone}.</T>
          <CivilField label="Datum početka" mode="date" value={draft.start.date} disabled={!enabled || !!attempt} onChange={date => change({ start: { ...draft.start, date }, dirtyStart: true })} />
          <CivilField label="Početak" mode="time" value={draft.start.time} disabled={!enabled || !!attempt} onChange={time => change({ start: { ...draft.start, time }, dirtyStart: true })} />
          <CivilField label="Datum kraja" mode="date" value={draft.end.date} disabled={!enabled || !!attempt} onChange={date => change({ end: { ...draft.end, date }, dirtyEnd: true })} />
          <CivilField label="Kraj" mode="time" value={draft.end.time} disabled={!enabled || !!attempt} onChange={time => change({ end: { ...draft.end, time }, dirtyEnd: true })} />
        </View> : null}
        <T style={body}>Razlog izmene, opciono</T><TextInput accessibilityLabel="Razlog izmene" value={draft.reason} editable={enabled && !attempt}
          multiline style={s.input} onChangeText={reason => change({ reason })} />
        {!attempt ? <><V2Action label="Pošalji predlog izmene" kind="primary" disabled={!enabled} onPress={submit} />
          <V2Action label="Odustani od nacrta" disabled={!enabled} onPress={() => { if (current()) update(null); }} /></> : null}
      </View> : null}
      <T accessibilityRole="header" style={{ ...v2.text.title, color: v2.color.ink }}>Predlozi</T>
      {!snapshot.proposals.length ? <T style={meta}>Još nema predloga izmene.</T> : snapshot.proposals.map(proposal => <View key={proposal.proposalId} style={s.card}>
        <T style={meta}>{proposal.proposedBy === accountId ? 'VAŠ PREDLOG' : 'PREDLOG DRUGE STRANE'} · VERZIJA {proposal.baseVersion}</T>
        <T style={body}>{({ PENDING: 'Čeka odgovor', ACCEPTED: 'Prihvaćen', REJECTED: 'Odbijen', SUPERSEDED: 'Zamenjen novim uslovima' })[proposal.status]}</T>
        {proposal.termsAvailable ? <Terms terms={proposal.terms} /> : <T style={body}>Uslovi starijeg predloga nisu dostupni za prihvatanje.</T>}
        {proposal.reason ? <T style={meta}>{proposal.reason}</T> : null}
        {proposal.status === 'PENDING' && proposal.baseVersion === snapshot.agreementVersion && snapshot.agreementStatus === 'CONFIRMED' && proposal.proposedBy !== accountId ? <>
          <V2Action label="Prihvati izmenu" kind="primary" disabled={!enabled || !!attempt || !proposal.termsAvailable} onPress={() => respond(proposal, true)} />
          <V2Action label="Odbij predlog" disabled={!enabled || !!attempt} onPress={() => respond(proposal, false)} />
        </> : null}
      </View>)}
    </> : null}
  </CalendarScreen>;
}
