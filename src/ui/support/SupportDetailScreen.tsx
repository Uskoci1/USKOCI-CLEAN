import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { SupportAction, SupportDetail, SupportSnapshot } from '../../data/supportCaseTypes';
import { SettingsAction, SettingsGroup, SettingsPanel, SettingsRow, SettingsText as T } from '../settings/SettingsPresentation';
import { supportActionAllowed } from './SupportController';
import { SupportField, SupportFrame, SupportLoading, SupportNotice, SupportPrivacy, supportLabel, supportStyles as styles, supportTime } from './SupportPresentation';
import { SupportRecoveryPanel } from './SupportRecoveryPanel';
import { useSupportController } from './useSupportController';
import { SupportReferenceView, supportReferenceNames } from './SupportReferenceView';

export function SupportDetailScreen({ caseId }: { caseId: string }) {
  const model = useSupportController({ type: 'DETAIL', caseId }), { state, current, controller, navigate } = model;
  const [cursors, setCursors] = useState<string[]>(['0']);
  useEffect(() => { setCursors(['0']); }, [model.incarnation]);
  const detail = state.detail, busy = state.phase === 'LOADING' || state.phase === 'SENDING';
  const page = (cursor: string, back = false) => {
    if (!current() || busy) return;
    setCursors(previous => back ? previous.slice(0, -1) : [...previous, cursor]);
    void controller?.page(cursor, state);
  };
  return <SupportFrame title={detail ? `Zahtev #${detail.case.caseNumber}` : 'Detalj zahteva'}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/podrska'))}>
    <SupportRecoveryPanel model={model} caseId={caseId} />
    {state.message ? <SupportNotice error={state.phase === 'ERROR'}>{state.message}</SupportNotice> : null}
    {state.phase === 'LOADING' ? <SupportLoading /> : null}
    {detail ? <>
      <SettingsPanel><T variant="display" accessibilityRole="header">{detail.case.title}</T>
        <View style={styles.status}><T variant="bodyStrong">{supportLabel(detail.case.status)}</T></View>
        <T variant="meta" tone="muted">{supportLabel(detail.case.topic)}</T>
        <T variant="meta" tone="muted">Primljeno {supportTime(detail.case.createdAt)}</T>
        <SupportPrivacy safety={detail.case.channel === 'SAFETY'} />
        {detail.case.desiredOutcome ? <><T variant="bodyStrong">Željeni ishod</T><T>{detail.case.desiredOutcome}</T></> : null}
        {'kind' in detail.case.context ? <SupportReferenceView value={detail.case.context as SupportSnapshot} caseId={caseId} /> : null}
      </SettingsPanel>
      <T variant="heading" accessibilityRole="header">Istorija predmeta</T>
      {detail.events.map(event => <View key={event.id} style={styles.event}>
        <T variant="bodyStrong">{supportLabel(event.kind)}</T>
        <T variant="meta" tone="muted">{supportLabel(event.authorRole)} · {supportTime(event.createdAt)}</T>
        {event.body ? <T>{event.body}</T> : null}
        {detail.evidence.filter(item => item.eventId === event.id).map(item => <SupportReferenceView key={item.id} value={item.reference} caseId={caseId} />)}
      </View>)}
      {detail.decisions.length ? <SettingsPanel><T variant="heading">Odluke na ovoj stranici</T>
        {detail.decisions.map(decision => <View key={decision.id} style={styles.row}>
          <T variant="bodyStrong">{decision.reviewType === 'RECONSIDERATION' ? 'Odluka posle ponovnog pregleda' : 'Odluka o zahtevu'}</T>
          <T>{supportLabel(decision.outcome)}</T><T>{decision.explanation}</T>
          <T variant="meta" tone="muted">{supportTime(decision.createdAt)}</T>
          {decision.reviewType === 'RECONSIDERATION' ? <T variant="meta" tone="muted">Ponovni pregled u okviru podrške. Originalna odluka ostaje u istoriji.</T> : null}
          <T variant="meta" tone="muted">Ova odluka o zahtevu sama ne menja Zadatak, Dogovor, novčani iznos ili ocenu.</T>
        </View>)}
      </SettingsPanel> : null}
      {/* Four quiet links used to stack under the history, one per line, and two of them were the
          same control pointing opposite ways. Paging is one row; what you do with what you have read
          is the line under it. */}
      {detail.nextAfterSequence || cursors.length > 1 ? <View style={styles.pager}>
        {cursors.length > 1 ? <SettingsAction label="Prethodni događaji" kind="quiet" disabled={busy} onPress={() => page(cursors[cursors.length - 2], true)} /> : null}
        {detail.nextAfterSequence ? <SettingsAction label="Sledeći događaji" kind="quiet" disabled={busy} onPress={() => page(detail.nextAfterSequence!)} /> : null}
      </View> : null}
      {detail.events.length ? <SettingsAction label="Označi prikazane događaje kao pročitane" kind="quiet" disabled={busy}
        onPress={() => { if (current()) void controller?.markRead(state); }} /> : null}
      <DetailActions key={`${detail.case.id}:${detail.case.revision}`} model={model} detail={detail} />
    </> : null}
    {state.phase !== 'LOADING' ? <SettingsAction label="Osveži predmet" kind="quiet" disabled={busy}
      onPress={() => { if (current()) void controller?.load(); }} /> : null}
  </SupportFrame>;
}
type FormAction = 'AUTHOR_REPLY' | 'OPERATOR_REPLY' | 'REQUEST_INFO' | 'DECIDE' | 'APPEAL' | 'DECIDE_APPEAL';
function DetailActions({ model, detail }: { model: ReturnType<typeof useSupportController>; detail: SupportDetail }) {
  const { state, current, controller } = model;
  const [form, setForm] = useState<FormAction | null>(null), [targetId, setTargetId] = useState<string | null>(null);
  const [body, setBody] = useState(''), [reason, setReason] = useState(''), [outcome, setOutcome] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const disabled = state.phase !== 'READY' || !!state.pending;
  const draftView = useMemo(() => ({}), [form, targetId, body, reason, outcome, evidenceIds, disabled]);
  const latestDraft = useRef(draftView); latestDraft.current = draftView;
  const allowed = (action: SupportAction) => supportActionAllowed(detail, action);
  const open = (action: FormAction, id: string | null = null) => {
    if (!current() || disabled || !allowed(action)) return;
    setForm(action); setTargetId(id); setBody(''); setReason(''); setEvidenceIds([]);
  };
  const deciding = form === 'DECIDE' || form === 'DECIDE_APPEAL';
  const valid = !!body.trim() && Array.from(body).length <= 4000 && (!deciding || /^[A-Z][A-Z0-9_]{0,63}$/.test(reason));
  const submit = () => {
    if (!current() || latestDraft.current !== draftView || disabled || !form || !allowed(form) || !valid) return;
    if (form === 'AUTHOR_REPLY') void controller?.submit(form, { body, evidence: [] }, state);
    else if (form === 'APPEAL') { if (targetId) void controller?.submit(form, { decisionId: targetId, body }, state); }
    else if (form === 'DECIDE') void controller?.submit(form, { outcome, reasonCode: reason, body, evidenceIds, appealId: null }, state);
    else if (form === 'DECIDE_APPEAL') { if (targetId) void controller?.submit(form, { outcome, reasonCode: reason, body, evidenceIds, appealId: targetId }, state); }
    else void controller?.submit(form, { body }, state);
  };
  return <View style={styles.actions}>
    {detail.viewerRole === 'OPERATOR' ? <T variant="meta" tone="muted">Operaterske radnje za ovaj nalog i trenutno stanje predmeta.</T> : null}
    {allowed('CLAIM') ? <SettingsAction label="Preuzmi predmet" disabled={disabled} onPress={() => { if (current()) void controller?.submit('CLAIM', {}, state); }} /> : null}
    {(['AUTHOR_REPLY', 'OPERATOR_REPLY', 'REQUEST_INFO', 'DECIDE'] as const).filter(allowed).map(action =>
      <SettingsAction key={action} label={action === 'AUTHOR_REPLY' ? 'Dopuni zahtev' : action === 'OPERATOR_REPLY' ? 'Odgovori podnosiocu'
        : action === 'REQUEST_INFO' ? 'Zatraži dopunu' : 'Donesi odluku'} kind="quiet" disabled={disabled} onPress={() => open(action)} />)}
    {allowed('APPEAL') ? <SettingsGroup title="Ponovni pregled odluke">{detail.decisions.filter(decision => !detail.appeals.some(appeal => appeal.decisionId === decision.id && appeal.status !== 'DECIDED')).map((decision, index, all) =>
      <SettingsRow key={decision.id} label={`Zatraži ponovni pregled · ${supportTime(decision.createdAt)}`} detail={decision.explanation}
        last={index === all.length - 1} disabled={disabled} onPress={() => open('APPEAL', decision.id)} />)}</SettingsGroup> : null}
    {detail.appeals.map(appeal => <SettingsPanel key={appeal.id} soft><T variant="bodyStrong">Ponovni pregled</T>
      <T>{appeal.status === 'RECEIVED' ? 'Žalba je primljena' : appeal.status === 'IN_REVIEW' ? 'Ponovni pregled je u toku' : 'Ponovni pregled je završen'}</T>
      <T variant="meta" tone="muted">{supportTime(appeal.createdAt)}</T>
      {allowed('CLAIM_APPEAL') && appeal.status === 'RECEIVED' ? <SettingsAction label="Preuzmi ponovni pregled" disabled={disabled}
        onPress={() => { if (current()) void controller?.submit('CLAIM_APPEAL', { appealId: appeal.id }, state); }} /> : null}
      {allowed('DECIDE_APPEAL') && appeal.status === 'IN_REVIEW' ? <SettingsAction label="Odluči o ponovnom pregledu" disabled={disabled} onPress={() => open('DECIDE_APPEAL', appeal.id)} /> : null}
    </SettingsPanel>)}
    {form ? <SettingsPanel soft><T variant="heading">{form === 'APPEAL' ? 'Razlog za ponovni pregled' : deciding ? 'Obrazložena odluka' : 'Poruka u predmetu'}</T>
      {form === 'APPEAL' ? <T variant="meta" tone="muted">Žalba se odnosi na izabranu stvarnu odluku. Ovo je ponovni pregled podrške; ne predstavlja nezavisan žalbeni organ.</T> : null}
      {deciding ? <><SettingsAction label={`${outcome === 'ACCEPTED' ? 'Izabrano: ' : ''}Prihvati zahtev`} kind="quiet" disabled={disabled} onPress={() => { if (current()) setOutcome('ACCEPTED'); }} />
        <SettingsAction label={`${outcome === 'REJECTED' ? 'Izabrano: ' : ''}Odbij zahtev`} kind="quiet" disabled={disabled} onPress={() => { if (current()) setOutcome('REJECTED'); }} />
        <SupportField label="Oznaka razloga" value={reason} onChange={value => { if (current() && !disabled) setReason(value); }} maximum={64} disabled={disabled} />
        <T variant="meta" tone="muted">Velika slova A–Z, brojevi i donja crta. Oznaka opisuje odgovor; ne uvodi novo pravilo ili sankciju.</T></> : null}
      {deciding && detail.evidence.length ? <SettingsGroup title="Dokazi na koje se odluka oslanja">
        {detail.evidence.map((item, index, all) => <SettingsRow key={item.id}
          label={`${evidenceIds.includes(item.id) ? 'Izabrano: ' : ''}${supportReferenceNames[item.reference.kind]}`}
          detail={supportTime(item.createdAt)} last={index === all.length - 1} disabled={disabled}
          onPress={() => { if (current() && !disabled) setEvidenceIds(ids => ids.includes(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id]); }} />)}
      </SettingsGroup> : null}
      <SupportField label={deciding ? 'Obrazloženje' : form === 'APPEAL' ? 'Razlog i nove činjenice' : 'Tekst poruke'} value={body} onChange={value => { if (current() && !disabled) setBody(value); }} maximum={4000} multiline disabled={disabled} />
      <SettingsAction label={form === 'APPEAL' ? 'Pošalji zahtev za ponovni pregled' : deciding ? 'Sačuvaj odluku' : 'Pošalji poruku'} disabled={disabled || !valid} onPress={submit} />
      {/* The reason the button is grey, written beside it (owner rule, 2026-09-23). */}
      {!disabled && !valid ? <T variant="note" tone="muted">{!body.trim() ? (deciding ? 'Unesi obrazloženje pre čuvanja odluke.' : 'Unesi tekst pre slanja.')
        : Array.from(body).length > 4000 ? 'Skrati tekst do 4000 znakova.' : 'Oznaka razloga: velika slova, brojevi i donja crta, do 64 znaka.'}</T> : null}
      <SettingsAction label="Zatvori unos" kind="quiet" disabled={disabled} onPress={() => { if (current()) { setForm(null); setBody(''); setReason(''); } }} />
    </SettingsPanel> : null}
    {allowed('CLOSE') ? <SettingsAction label="Zatvori obrađeni predmet" kind="quiet" disabled={disabled}
      onPress={() => { if (current()) void controller?.submit('CLOSE', {}, state); }} /> : null}
  </View>;
}
