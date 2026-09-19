import { useCallback, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import type { AgreementChangeTerms } from '../../data/agreementClientService';
import { sesijaSada, useSesija } from '../../store/sesija';

import { noviUuidZahtevId } from '../../lib/idempotencija';
import { calendarInstant } from '../../lib/calendarTime';
import { needScheduleText } from '../../data/needDetailPresentation';
import { CivilField } from '../calendar/CalendarControls';
import { civilInstant, zonedParts } from '../calendar/calendarPresentation';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';
import { AgreementActionsController, type AgreementActionsState } from './AgreementActionsController';
import { journalFor, normalizeAgreementCommand, validProposal, type AgreementActionCommand } from './agreementActionsModel';

type Form = { token: object; kind: 'PROPOSE' | 'CANCEL'; reentry: boolean; key: string;
  price: string; scope: string; reason: string; zone: string; startDate: string; startTime: string; endDate: string; endTime: string;
  priceChanged: boolean; scopeChanged: boolean; startChanged: boolean; endChanged: boolean };
const initial: AgreementActionsState = { phase: 'LOADING', snapshot: null, journal: null, error: null, message: null, canRetry: false, needsReentry: false };
const deviceZone = (): string | undefined => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
};
/** The same zone the form below types in, so the review and the fields cannot disagree. */
const schedule = (terms: AgreementChangeTerms) => terms.startsAt === null && terms.endsAt === null ? 'Termin nije potvrđen'
  : needScheduleText({ kind: 'FIXED_WINDOW', startsAt: terms.startsAt, endsAt: terms.endsAt }, deviceZone());
function Terms({ title, terms }: { title: string; terms: AgreementChangeTerms | null }) {
  return <View style={s.group}><T style={s.heading}>{title}</T>{terms ? <>
    <T style={s.copy}>Cena: {terms.priceRsd.toLocaleString('sr-Latn-RS')} RSD</T>
    <T style={s.copy}>{schedule(terms)}</T><T style={s.copy}>Obim: {terms.scopeNote || 'Nije dodat opis'}</T>
  </> : <T style={s.copy}>Uslovi nisu dostupni za pregled.</T>}</View>;
}
const actionLabel = (command: AgreementActionCommand) => command.kind === 'PROPOSE' ? 'Pošalji predlog izmene'
  : command.kind === 'CANCEL' ? 'Otkaži Dogovor' : command.kind === 'WITHDRAW' ? 'Povuci predlog' : command.accept ? 'Prihvati izmenu' : 'Odbij predlog';
export function AgreementActionsScreen({ agreementId }: { agreementId: string }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id ?? '';
  const [state, setState] = useState(initial), [form, setForm] = useState<Form | null>(null);
  const [review, setReview] = useState<AgreementActionCommand | null>(null), [error, setError] = useState<string | null>(null), [epoch, setEpoch] = useState(0);
  const owner = useRef<object | null>(null), engine = useRef<AgreementActionsController | null>(null);
  const formRef = useRef(form); formRef.current = form;
  const reviewRef = useRef(review); reviewRef.current = review;
  const reviewBase = useRef(state.snapshot), submitting = useRef(false);
  useFocusEffect(useCallback(() => {
    const scope = {}; owner.current = scope; submitting.current = false; setState(initial); setForm(null); setReview(null); setError(null);
    const current = () => owner.current === scope && !['background','inactive'].includes(AppState.currentState)
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const controller = new AgreementActionsController({ agreementId, account: { accountId, accountRevision }, current, storage: AsyncStorage });
    engine.current = controller;
    controller.subscribe(() => { if (current()) setState(controller.snapshot()); }); void controller.load();
    const listener = AppState.addEventListener('change', next => {
      if (next !== 'active') { controller.dispose(); owner.current = null; }
      else setEpoch(value => value + 1);
    });
    return () => { listener.remove(); controller.dispose(); if (owner.current === scope) owner.current = null; if (engine.current === controller) engine.current = null; };
  }, [agreementId, accountId, accountRevision, epoch]));
  const renderedOwner = owner.current, controller = engine.current;
  const current = () => renderedOwner !== null && owner.current === renderedOwner && engine.current === controller
    && !['background','inactive'].includes(AppState.currentState) && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision;
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING', snapshot = state.snapshot;
  const actionCurrent = () => current() && controller?.snapshot() === state;
  const openForm = (kind: Form['kind'], reentry = false) => {
    if (!actionCurrent() || !snapshot || busy || submitting.current || formRef.current || reviewRef.current) return;
    if (reentry ? !state.journal || !state.canRetry || state.journal.kind !== kind
      : state.phase !== 'READY' || !(kind === 'PROPOSE' ? snapshot.actions.canProposeChange && snapshot.terms : snapshot.actions.canCancel)) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', terms = snapshot.terms;
    const start = terms?.startsAt ? zonedParts(new Date(terms.startsAt), zone) : { date: '', time: '' };
    const end = terms?.endsAt ? zonedParts(new Date(terms.endsAt), zone) : { date: '', time: '' };
    const next: Form = { token: {}, kind, reentry, key: reentry ? state.journal!.clientRequestId ?? '' : noviUuidZahtevId(),
      price: String(terms?.priceRsd ?? ''), scope: terms?.scopeNote ?? '', reason: '', zone,
      startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time,
      priceChanged: false, scopeChanged: false, startChanged: false, endChanged: false }; formRef.current = next; setForm(next); setError(null);
  };
  const edit = (patch: Partial<Form>) => { if (current() && !busy && form && formRef.current?.token === form.token && !reviewRef.current) setForm({ ...formRef.current, ...patch }); };
  const prepare = (command: AgreementActionCommand, fromForm = false) => {
    if (!actionCurrent() || busy || submitting.current || !snapshot || reviewRef.current || (!fromForm && formRef.current)) return;
    const normalized = normalizeAgreementCommand(command);
    if (state.journal && journalFor(normalized).payloadHash !== state.journal.payloadHash) {
      setError('Unos se razlikuje od prvobitnog zahteva. Ponovo unesi iste izmenjene podatke i isti razlog.'); return;
    }
    reviewBase.current = snapshot; reviewRef.current = normalized; setReview(normalized); formRef.current = null; setForm(null); setError(null);
  };
  const prepareForm = () => {
    if (!form || formRef.current !== form || !current() || busy || !snapshot) return;
    const version = form.reentry ? state.journal!.agreementVersion : snapshot.agreementVersion;
    if (form.kind === 'CANCEL') {
      if (!form.reason.trim()) { setError('Unesi razlog otkazivanja.'); return; }
      prepare({ kind: 'CANCEL', agreementId, version, reason: form.reason }, true); return;
    }
    const patch: { cenaIznos?: number; cenaValuta?: string; obim?: string; pocetakIso?: string; krajIso?: string } = {};
    if (form.priceChanged && (form.reentry || Number(form.price) !== snapshot.terms?.priceRsd)) {
      if (!/^[1-9][0-9]*$/.test(form.price.trim()) || !Number.isSafeInteger(Number(form.price))) { setError('Unesi pozitivan ceo iznos u RSD.'); return; }
      patch.cenaIznos = Number(form.price); patch.cenaValuta = 'RSD';
    }
    if (form.scopeChanged && (form.reentry || form.scope.trim() !== (snapshot.terms?.scopeNote ?? ''))) patch.obim = form.scope;
    if (form.startChanged || form.endChanged) {
      // An endpoint the user did not edit retains its accepted precision. Civil
      // controls show minutes; they must not silently round the other endpoint.
      const start = !form.startChanged && snapshot.terms?.startsAt ? { value: snapshot.terms.startsAt, error: null }
        : civilInstant(form.startDate, form.startTime, form.zone);
      const end = !form.endChanged && snapshot.terms?.endsAt ? { value: snapshot.terms.endsAt, error: null }
        : civilInstant(form.endDate, form.endTime, form.zone);
      if (!start.value || !end.value || calendarInstant(start.value)! >= calendarInstant(end.value)!) { setError(start.error || end.error || 'Kraj mora biti posle početka.'); return; }
      patch.pocetakIso = start.value; patch.krajIso = end.value;
    }
    const value = { dogovorId: agreementId, ocekivanaVerzija: version, clientRequestId: form.key, izmena: patch, razlog: form.reason };
    if (!validProposal(value)) { setError('Izmeni bar jedan podatak. Oba kraja termina moraju biti određena.'); return; }
    prepare({ kind: 'PROPOSE', value }, true);
  };
  const send = async () => {
    if (!current() || busy || submitting.current || !review || reviewRef.current !== review || controller?.snapshot().snapshot !== reviewBase.current) return;
    submitting.current = true;
    try { await controller.submit(review); if (current()) { setReview(null); reviewRef.current = null; } }
    finally { if (current()) submitting.current = false; }
  };
  const run = (name: 'refresh' | 'retry' | 'acknowledge') => { if (actionCurrent() && !busy && !submitting.current && !formRef.current && !reviewRef.current) void controller?.[name](); };
  const field = (label: string, value: string, change: (text: string) => void, multiline = false) => <View style={s.field}>
    <T style={s.label}>{label}</T><TextInput accessibilityLabel={label} value={value} onChangeText={change} editable={!busy}
      multiline={multiline} maxLength={multiline ? 4000 : 100} style={[s.input, multiline && s.multiline]} /></View>;
  let proposed: AgreementChangeTerms | null = null;
  if (review?.kind === 'PROPOSE' && snapshot?.terms) { const patch = review.value.izmena; proposed = { ...snapshot.terms,
    priceRsd: patch.cenaIznos ?? snapshot.terms.priceRsd, scopeNote: patch.obim ?? snapshot.terms.scopeNote,
    startsAt: patch.pocetakIso ?? snapshot.terms.startsAt, endsAt: patch.krajIso ?? snapshot.terms.endsAt }; }
  else if (review?.kind === 'RESPOND' || review?.kind === 'WITHDRAW') proposed = review.proposal.terms;
  return <SafeAreaView edges={['top','bottom']} style={s.screen}><KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={s.header}><V2Action label="Nazad" kind="quiet" onPress={() => { if (current()) { if (router.canGoBack()) router.back(); else router.replace({ pathname: '/dogovor/[id]', params: { id: agreementId } }); } }} />
      <T accessibilityRole="header" style={s.heading}>Izmene Dogovora</T></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {busy ? <T accessibilityLiveRegion="polite" style={s.copy}>{state.phase === 'SENDING' ? 'Šaljem pregledanu radnju…' : 'Učitavam važeće uslove i potvrdu…'}</T> : null}
      {error || state.error ? <T accessibilityLiveRegion="polite" style={s.error}>{error || state.error}</T> : null}
      {state.message ? <T accessibilityLiveRegion="polite" style={s.heading}>{state.message}</T> : null}
      {snapshot ? <Terms title="Važeći uslovi" terms={snapshot.terms} /> : null}
      {state.phase === 'ERROR' ? <V2Action label="Ponovo učitaj Dogovor" onPress={() => run('refresh')} /> : null}
      {form ? <View style={s.form}>
        <T style={s.heading}>{form.reentry ? 'Ponovni unos prvobitnog zahteva' : form.kind === 'CANCEL' ? 'Razlog otkazivanja' : 'Predlog novih uslova'}</T>
        {form.reentry ? <T style={s.copy}>Sadržaj prethodnog zahteva nije sačuvan na uređaju. Ponovo unesi iste podatke iz tog pokušaja i isti razlog. Provera mora da potvrdi potpuno isti zahtev.</T> : null}
        {form.kind === 'PROPOSE' ? <>
          {field('Predložena cena u RSD', form.price, price => edit({ price, priceChanged: true }))}
          {field('Predloženi obim posla', form.scope, scope => edit({ scope, scopeChanged: true }), true)}
          <T style={s.label}>Vremenska zona za unos: {form.zone}</T>
          <CivilField label="Datum početka" mode="date" value={form.startDate} disabled={busy} onChange={startDate => edit({ startDate, startChanged: true })} />
          <CivilField label="Vreme početka" mode="time" value={form.startTime} disabled={busy} onChange={startTime => edit({ startTime, startChanged: true })} />
          <CivilField label="Datum kraja" mode="date" value={form.endDate} disabled={busy} onChange={endDate => edit({ endDate, endChanged: true })} />
          <CivilField label="Vreme kraja" mode="time" value={form.endTime} disabled={busy} onChange={endTime => edit({ endTime, endChanged: true })} />
        </> : null}
        {field(form.kind === 'CANCEL' ? 'Razlog otkazivanja Dogovora' : 'Razlog predloga — opciono', form.reason, reason => edit({ reason }), true)}
        <V2Action label="Pregledaj radnju" disabled={busy} onPress={prepareForm} />
        <V2Action label="Odustani od unosa" kind="quiet" disabled={busy} onPress={() => { if (current() && formRef.current === form) { formRef.current = null; setForm(null); setError(null); } }} />
      </View> : review ? <View style={s.form}>
        {review.kind === 'CANCEL' ? <><T style={s.heading}>Otkazivanje Dogovora</T><T style={s.copy}>Dogovor se završava otkazivanjem. Deljeni kontakt i precizna lokacija se opozivaju. Radnja sama ne određuje krivicu ili dug.</T><T style={s.copy}>{review.reason}</T></>
          : <><Terms title="Predloženi uslovi" terms={proposed} /><T style={s.copy}>{review.kind === 'PROPOSE' ? review.value.razlog : review.proposal.reason}</T>
            <T style={s.copy}>{review.kind === 'PROPOSE' ? 'Uslovi se menjaju tek kada druga strana prihvati predlog.' : review.kind === 'WITHDRAW' ? 'Povlačiš svoj predlog. Važeći uslovi ostaju.' : review.accept ? 'Prihvatanjem odmah počinju da važe prikazani novi uslovi. Server ponovo proverava raspored.' : 'Odbijaš ovaj predlog. Važeći uslovi ostaju.'}</T></>}
        <V2Action label={actionLabel(review)} disabled={busy} onPress={() => { void send(); }} />
        <V2Action label="Odustani od radnje" kind="quiet" disabled={busy} onPress={() => { if (current() && reviewRef.current === review && !submitting.current) { reviewRef.current = null; setReview(null); setError(null); } }} />
      </View> : state.phase === 'UNKNOWN' ? <View style={s.form}>
        <V2Action label="Proveri ishod radnje" kind="quiet" onPress={() => run('refresh')} />
        {state.needsReentry && (state.journal?.kind === 'PROPOSE' || state.journal?.kind === 'CANCEL')
          ? <V2Action label="Unesi prvobitni zahtev" disabled={!state.canRetry} onPress={() => openForm(state.journal!.kind as Form['kind'], true)} />
          : <V2Action label="Ponovi istu radnju" disabled={!state.canRetry || state.needsReentry} onPress={() => run('retry')} />}
      </View> : state.phase === 'CONFIRMED' || state.phase === 'REJECTED' ? <V2Action label="Prikaži aktuelni Dogovor" onPress={() => run('acknowledge')} />
        : state.phase === 'READY' && snapshot ? <View style={s.form}>
          {snapshot.proposals.map(proposal => <View key={proposal.proposalId} style={s.form}>
            <Terms title={proposal.proposedBy === accountId ? 'Tvoj predlog čeka odgovor' : 'Predlog druge strane'} terms={proposal.terms} />
            {proposal.reason ? <T style={s.copy}>{proposal.reason}</T> : null}
            {snapshot.actions.canRespondChange && proposal.proposedBy !== accountId ? <>
              <V2Action label="Pregledaj prihvatanje izmene" disabled={!proposal.termsAvailable} onPress={() => prepare({ kind: 'RESPOND', proposal, accept: true })} />
              <V2Action label="Pregledaj odbijanje predloga" kind="quiet" onPress={() => prepare({ kind: 'RESPOND', proposal, accept: false })} />
            </> : null}
            {snapshot.actions.canWithdrawChange && proposal.proposedBy === accountId ? <V2Action label="Pregledaj povlačenje predloga" kind="quiet" onPress={() => prepare({ kind: 'WITHDRAW', proposal })} /> : null}
          </View>)}
          {snapshot.actions.canProposeChange && snapshot.terms ? <V2Action label="Predloži izmenu uslova" onPress={() => openForm('PROPOSE')} /> : null}
          {snapshot.actions.canCancel ? <V2Action label="Otkazivanje Dogovora" kind="quiet" onPress={() => openForm('CANCEL')} /> : null}
          <V2Action label="Osveži uslove Dogovora" kind="quiet" onPress={() => run('refresh')} />
        </View> : null}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
/** PKG-011: same controller, journal and copies; cards, ground and type on the shared system. */
const s = StyleSheet.create({ screen: { flex: 1, backgroundColor: sys.color.ground }, header: { paddingHorizontal: 12, paddingVertical: 8, gap: 4, flexDirection: 'row', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 32, gap: 16 }, heading: { ...sys.type.heading, color: sys.color.ink, flexShrink: 1 },
  copy: { ...sys.type.copy, color: sys.color.muted }, label: { ...sys.type.meta, color: sys.color.ink },
  error: { ...sys.type.copy, color: sys.color.danger },
  group: { gap: 8, padding: 16, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  form: { gap: 12, padding: 16, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface }, field: { gap: 6 },
  input: { minHeight: 50, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control, padding: 12, backgroundColor: sys.color.surface,
    ...sys.type.body, color: sys.color.ink }, multiline: { minHeight: 100, textAlignVertical: 'top' } });
