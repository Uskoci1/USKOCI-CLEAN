import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, Platform, KeyboardAvoidingView, TextInput, AppState, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { Ishod } from '../../data/ports';
import { T } from '../../ui/Text';
import { sys } from '../../ui/system/tokens';
import { SkeletonCard } from '../../ui/system/Skeleton';
import { V2Action } from '../../ui/v2/V2Action';
import { AgreementHero, AgreementPeople, AgreementSection, AgreementTabs, agreementStateText, type AgreementTab } from '../../ui/v2/AgreementPresentation';
import { NextStepCard, WorkspaceCard, WorkspaceFooter, WorkspaceNote, WorkspaceRow, WorkspaceRows, stateTone } from '../../ui/agreements/AgreementWorkspace';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { useIzvor, useUloga, ulogaSada } from '../../store/uloga';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { useAgreementOutbox } from '../../hooks/useAgreementOutbox';
import { useAgreementPhotos } from '../../hooks/useAgreementPhotos';
import { agreementPhotoClientService } from '../../data/agreementPhotoClientService';
import { useSesija, sesijaSada } from '../../store/sesija';
import { AgreementChat } from '../../ui/AgreementChat';
import { AgreementPrivateLocation } from '../../ui/AgreementPrivateLocation';
import { GroupConversationEntry } from '../../ui/groups/GroupConversationEntry';
import { needScheduleText } from '../../data/needDetailPresentation';
import { agreementProblemService, type AgreementProblemSnapshot } from '../../data/agreementClientService';
import { completionDenial } from '../../data/agreementCompletion';
import { calendarInstant } from '../../lib/calendarTime';

type ProblemWorkspace = DogovorProjekcija & {
  problemReport: AgreementProblemSnapshot['report'];
  problemReportState: AgreementProblemSnapshot['state'] | 'UNAVAILABLE';
};
async function bounded<T>(operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Caller timeout does not claim that the server cancelled or rejected a write.
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AGREEMENT_REQUEST_UNCONFIRMED')), 15_000);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
function backToAgreements() { if (router.canGoBack()) router.back(); else router.replace('/dogovori'); }
function AgreementStatus({ loading = false, error = false, retry }: { loading?: boolean; error?: boolean; retry?: () => void }) {
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar eyebrow={loading ? 'Učitavamo' : error ? 'Nije učitano' : 'Nije dostupno'} title="Dogovor" onBack={backToAgreements} />
    <View style={s.status} accessibilityLiveRegion="polite">
      {loading ? <><SkeletonCard rows={2} /><T accessibilityLabel="Učitavanje Dogovora" variant="meta" tone="muted" style={s.center}>Učitavamo Dogovor…</T></> : <>
        <T accessibilityRole="header" variant="title" style={s.ink}>{error ? 'Dogovor nije učitan' : 'Dogovor nije dostupan'}</T>
        <T variant="body" tone="muted">{error ? 'Proveri internet vezu i pokušaj ponovo.' : 'Veza je zastarela ili nemaš pristup ovom Dogovoru.'}</T>
        {retry ? <V2Action label="Ponovo učitaj Dogovor" onPress={retry} /> : null}
      </>}
    </View>
  </SafeAreaView>;
}
export default function Dogovor() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const session = useSesija(), intent = useUloga(), accountId = session.user?.id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !accountId) return <AgreementStatus />;
  return <DogovorContent key={`${accountId}:${session.accountRevision}:${intent}:${id}`} id={id} accountId={accountId} accountRevision={session.accountRevision} />;
}
function DogovorContent({ id, accountId, accountRevision }: { id: string; accountId: string; accountRevision: number }) {
  const izvor = useIzvor(), intent = useUloga();
  const [tab, setTab] = useState<AgreementTab>('pregled');
  const [problemOpen, setProblemOpen] = useState(false), [problemText, setProblemText] = useState('');
  const [problemAttempt, setProblemAttempt] = useState<string | null>(null);
  const problemAttemptRef = useRef<string | null>(null);
  const formFocus = useRef<object | null>(null);
  useFocusEffect(useCallback(() => {
    const focus = {}; formFocus.current = focus;
    return () => { if (formFocus.current === focus) formFocus.current = null; };
  }, [accountId, accountRevision, intent]));
  const renderedFormFocus = formFocus.current;
  const ownsAccount = useCallback(() => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision
    && ulogaSada() === intent, [accountId, accountRevision, intent]);
  const read = useCallback(async (): Promise<Ishod<ProblemWorkspace | null>> => {
    if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' };
    try {
      const data = await bounded(() => izvor.dogovor(id));
      if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' };
      if (data && data.id !== id) return { ok: false, kod: 'INVALID_RESPONSE', poruka: 'Dogovor nije dostupan.' };
      if (!data) return { ok: true, podatak: null };
      if (data.problemOtvoren) {
        const result = await agreementProblemService.read(id, data.verzija, data.ucesnici.map(party => party.id), { accountId, accountRevision })
          .catch(() => null);
        if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvori Dogovor.' };
        if (result?.ok && result.podatak.state === 'AVAILABLE') {
          return { ok: true, podatak: { ...data, problemReport: result.podatak.report, problemReportState: 'AVAILABLE' } };
        }
        // Optional report details cannot erase an independently read Agreement.
        // The base open flag remains authoritative; absent/conflicting detail is unknown.
        return { ok: true, podatak: { ...data, problemReport: null,
          problemReportState: result?.ok && result.podatak.state === 'LEGACY_UNAVAILABLE' ? 'LEGACY_UNAVAILABLE' : 'UNAVAILABLE' } };
      }
      return { ok: true, podatak: { ...data, problemReport: null, problemReportState: 'ABSENT' } };
    } catch { return { ok: false, kod: 'AGREEMENT_READ_FAILED', poruka: 'Dogovor nije učitan. Proveri vezu i pokušaj ponovo.' }; }
  }, [izvor, id, accountId, accountRevision, ownsAccount]);
  const workspace = useOwnedEditor(read);
  const activeRef = useRef(!AppState.currentState || AppState.currentState === 'active');
  const freshRef = useRef(activeRef.current), resumeGeneration = useRef(0);
  const [foreground, setForeground] = useState(activeRef.current);
  const [resumeRequired, setResumeRequired] = useState(!activeRef.current);
  const [resumeEpoch, setResumeEpoch] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active';
      freshRef.current = false;
      resumeGeneration.current++;
      setResumeEpoch(resumeGeneration.current);
      setForeground(activeRef.current); setResumeRequired(true);
    });
    return () => { subscription.remove(); activeRef.current = false; freshRef.current = false; resumeGeneration.current++; };
  }, []);
  useEffect(() => {
    // Wait for an in-flight mutation, then replace the pre-background snapshot.
    // A retained callback remains fenced throughout the resume read.
    if (!foreground || !resumeRequired || workspace.busy) return;
    let current = true;
    const generation = resumeGeneration.current;
    void workspace.refresh().then(() => {
      if (!current || !activeRef.current || generation !== resumeGeneration.current) return;
      freshRef.current = true; setResumeRequired(false);
    });
    return () => { current = false; };
  }, [foreground, resumeRequired, resumeEpoch, workspace.busy, workspace.refresh]);
  const messages = useFocusedResource(useCallback(async () => {
    const rows = await izvor.poruke(id, accountId);
    if (!ownsAccount()) throw new Error('MESSAGE_AUTH_CONTEXT_CHANGED');
    return agreementPhotoClientService.messages(id, rows, { accountId, accountRevision });
  }, [izvor, id, accountId, accountRevision, ownsAccount]));
  const dogovor = workspace.data;
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.error && !workspace.busy && !workspace.uncertain;
  const writable = enabled && dogovor?.chatDostupan === true;
  const { model: outbox, state: outboxState } = useAgreementOutbox(accountId, id, writable);
  const photos = useAgreementPhotos(accountId, id, dogovor?.verzija ?? null, writable, outbox);
  const osvezi = workspace.refresh;
  useEffect(() => {
    if (messages.data && !messages.error) void outbox.reconcile(messages.data
      .filter(message => !!message.clientMessageId && !!message.posiljalacAccountId)
      .map(message => ({ clientMessageId: message.clientMessageId!, senderAccountId: message.posiljalacAccountId!, messageId: message.id, body: message.telo,
        ...(message.fotografije?.length ? { photos: { agreementVersion: message.dogovorVerzija!, assetIds: message.fotografije.map(photo => photo.assetId) } } : {}) })));
  }, [messages.data, messages.error, outbox, outboxState.phase]);
  const deniedAttempt = outboxState.entries.filter(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE')
    .map(entry => `${entry.command.clientMessageId}:${entry.attempt}`).join('|');
  useEffect(() => { if (deniedAttempt) void osvezi(); }, [deniedAttempt, osvezi]);
  if (!foreground || resumeRequired) return <AgreementStatus loading />;
  if (!dogovor) return <AgreementStatus loading={workspace.loading} error={!!workspace.error} retry={() => void osvezi()} />;

  // Party identity comes from the Agreement, not the user's currently selected intent.
  const me = dogovor.ucesnici.find(party => party.viSte && party.id === accountId);
  const worker = me?.uloga === 'uskocer', requester = me?.uloga === 'narucilac';
  const active = dogovor.stanje === 'CONFIRMED' || dogovor.stanje === 'AWAITING_REQUESTER';
  // PKG-007: the server's actionState (already excluding a pending change) is the only
  // completion authority; status and party stay a necessary display condition, never a
  // substitute. Missing or unconfirmed permissions fail closed until an explicit readback.
  const radnje = dogovor.radnje ?? null;
  const canComplete = active && !!me && !!radnje && (worker ? radnje.mozeOznacitiZavrsetak : requester && radnje.mozePotvrditiZavrsetak);
  const other = dogovor.ucesnici.find(party => !party.viSte);
  const formCurrent = () => enabled && !!me && ownsAccount() && activeRef.current && freshRef.current &&
    renderedFormFocus !== null && formFocus.current === renderedFormFocus;
  const report = dogovor.problemReport;
  const reportProblem = async () => {
    if (!formCurrent() || !active || dogovor.problemOtvoren || !(problemAttempt ?? problemText.trim())) return;
    await workspace.save(async () => {
      // Keep the original description after an unknown outcome. Only explicit
      // readback may reopen writes; a retry cannot silently replace this intent.
      const narrative = problemAttempt ?? problemText.trim();
      problemAttemptRef.current = narrative;
      setProblemAttempt(narrative);
      const receipt = await agreementProblemService.submit(id, narrative, { accountId, accountRevision });
      if (!receipt.ok) return { ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED', poruka: 'Prijava nije potvrđena. Proveri status Dogovora pre ponovnog pokušaja.' };
      const next = await read();
      if (!next.ok) return next;
      const stored = next.podatak?.problemReport;
      if (!stored || stored.openedBy !== receipt.podatak.problemOpenedBy || calendarInstant(stored.openedAt) !== calendarInstant(receipt.podatak.problemOpenedAt)) {
        return { ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED', poruka: 'Sačuvana prijava nije potvrđena. Osveži status Dogovora.' };
      }
      return next;
    });
  };
  const mutate = async (command: () => Promise<Ishod<unknown>>) => {
    if (!enabled || !me || !ownsAccount() || !activeRef.current || !freshRef.current) return;
    await workspace.save(async () => {
      const result = await bounded(command);
      if (!result.ok) return { ok: false as const, kod: 'AGREEMENT_ACTION_UNCONFIRMED', poruka: 'Promena nije potvrđena. Osveži Dogovor pre novog pokušaja.' };
      return read();
    });
  };
  const complete = async () => {
    if (!canComplete || !enabled || !me || !ownsAccount() || !activeRef.current || !freshRef.current) return;
    await workspace.save(async () => {
      const result = await bounded<Ishod<unknown>>(() => worker ? izvor.oznaciZavrsetak(id) : izvor.potvrdiZavrsetak(id));
      // A known server denial keeps its own copy; anything else is an unconfirmed outcome.
      if (!result.ok) return { ok: false as const, kod: result.kod, poruka: completionDenial(result.kod) ?? 'Promena nije potvrđena. Osveži Dogovor pre novog pokušaja.' };
      const next = await read();
      if (!next.ok) return next;
      // Only the server's own terminal readback confirms; an unchanged state stays unconfirmed.
      const state = next.podatak?.stanje;
      const confirmed = worker ? state === 'AWAITING_REQUESTER' || state === 'COMPLETED' : state === 'COMPLETED';
      if (!confirmed) return { ok: false as const, kod: 'COMPLETION_NOT_CONFIRMED', poruka: 'Server nije potvrdio završetak. Osveži status Dogovora.' };
      return next;
    });
  };
  const deadline = dogovor.rokPotvrdeIso ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: dogovor.rokPotvrdeIso }, 'Europe/Belgrade') : 'Rok trenutno nije dostupan';

  // ---- presentation (state above is untouched by PKG-011) ----
  const tone = stateTone(dogovor.stanje);
  const openMessages = () => setTab('poruke');
  const completeLabel = workspace.busy ? 'Čuvamo promenu…' : worker ? 'Završio sam' : 'Potvrdi završetak';
  const review = () => { if (enabled && ownsAccount() && activeRef.current && freshRef.current) router.navigate({ pathname: '/oceni-dogovor', params: { agreementId: id } }); };
  // One brand action per state: completion when the server allows it, the review after
  // completion, otherwise the conversation. "Otvori poruke" stays one tap away in every case.
  const brand = canComplete ? { label: completeLabel, disabled: !enabled, onPress: () => { void complete(); } }
    : dogovor.stanje === 'COMPLETED' && me ? { label: 'Oceni saradnju', disabled: !enabled, onPress: review }
      : { label: 'Otvori poruke', onPress: openMessages };
  const secondary = brand.label === 'Otvori poruke' ? null : { label: 'Otvori poruke', onPress: openMessages };
  const nextStep = dogovor.stanje === 'COMPLETED' ? { tone: 'green' as const, title: 'Dogovor je završen', body: me ? 'Hvala na saradnji. Ocena pomaže drugima da izaberu.' : null }
    : dogovor.stanje === 'CANCELLED' ? { tone: 'muted' as const, title: 'Dogovor je otkazan.', body: null }
      : dogovor.stanje === 'AWAITING_REQUESTER' ? { tone: 'warn' as const, title: worker ? 'Čeka se Naručilac' : 'Uskočer je označio da je završio',
        body: dogovor.problemOtvoren ? 'Prijavljen je problem — automatski završetak je zaustavljen.' : `${deadline}. Bez odgovora se Dogovor zatvara sam.` }
        : { tone: 'green' as const, title: worker ? 'Kada završi, označi završetak' : 'Potvrdi završetak kada je posao obavljen',
          body: !me ? null : worker ? 'Kada završi, označi završetak. Naručilac tada ima 48h da potvrdi ili prijavi problem.'
            : 'Završetak možeš potvrditi kada je posao obavljen, i pre nego što ga Uskočer označi.' };
  const problemPanel = report ? <WorkspaceCard tone="warn">
    <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>Problem je prijavljen</T>
    <T variant="meta" tone="muted">{report.openedBy === accountId ? 'Prijava je tvoja.' : 'Prijavila je druga strana.'}</T>
    <T variant="meta" tone="muted">{new Date(report.openedAt).toLocaleString('sr-Latn-RS')}</T>
    <T variant="body" style={s.ink}>{report.narrative}</T>
    <T variant="meta" tone="muted">Ovaj opis vide oba učesnika i sačuvan je u Porukama.</T>
    {problemAttempt && problemAttempt !== report.narrative ? <T variant="meta" tone="muted">Sačuvan je prvi opis prijave. Tvoj novi opis nije dodat. Za dopunu koristiš Poruke.</T> : null}
    {active ? <T variant="meta" tone="muted">Automatski završetak je zaustavljen. Naručilac i dalje može potvrditi završetak. Prijava sama ne određuje krivicu ili dug.</T> : null}
  </WorkspaceCard> : dogovor.problemOtvoren ? <WorkspaceCard tone="warn">
    <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>Problem je prijavljen</T>
    <T variant="meta" tone="muted">{dogovor.problemReportState === 'LEGACY_UNAVAILABLE'
      ? 'Detalji starije prijave nisu dostupni u ovom prikazu. Postojeća prijava ostaje sačuvana.'
      : 'Detalji prijave trenutno nisu učitani. Osveži status Dogovora da pokušate ponovo.'}</T>
    {active ? <T variant="meta" tone="muted">Automatski završetak je zaustavljen. Naručilac i dalje može potvrditi završetak. Prijava sama ne određuje krivicu ili dug.</T> : null}
    {dogovor.problemReportState === 'UNAVAILABLE' ? <V2Action label="Osveži detalje prijave" kind="quiet" disabled={!enabled} onPress={() => void osvezi()} /> : null}
  </WorkspaceCard> : active && me ? <WorkspaceCard>
    {!problemOpen ? <>
      <T variant="bodyStrong" style={s.ink}>Nešto nije u redu?</T>
      <T variant="meta" tone="muted">Prijava problema zaustavlja automatski završetak i vidi je druga strana.</T>
      <V2Action label="Prijavi problem" kind="quiet" disabled={!enabled} onPress={() => { if (formCurrent()) setProblemOpen(true); }} />
    </> : <>
      <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>Problem u Dogovoru</T>
      <T variant="meta" tone="muted">Opis će videti druga strana u Porukama. Ovo nije poverljiva prijava podršci.</T>
      <TextInput accessibilityLabel="Opiši problem" value={problemText}
        onChangeText={value => { if (formCurrent() && !problemAttemptRef.current) setProblemText(value); }} multiline maxLength={4000}
        editable={enabled && !problemAttempt} placeholder="Šta je ostalo nerešeno?" placeholderTextColor={sys.color.muted} style={s.input} />
      <V2Action label={workspace.busy ? 'Čuvamo prijavu…' : problemAttempt ? 'Ponovi istu prijavu problema' : 'Pošalji prijavu problema'}
        disabled={!enabled || !(problemAttempt ?? problemText.trim())} onPress={() => { void reportProblem(); }} />
      {!problemAttempt ? <V2Action label="Odustani od prijave problema" kind="quiet" disabled={!enabled}
        onPress={() => { if (formCurrent() && !problemAttemptRef.current) setProblemOpen(false); }} /> : <T variant="meta" tone="muted">Opis je sačuvan na ovom ekranu. Pre ponavljanja proveri serverski status.</T>}
    </>}
  </WorkspaceCard> : null;

  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    {/* Keyboard screenY and this full-screen parent share the same origin. */}
    <KeyboardAvoidingView style={s.screen} enabled={tab === 'poruke' || problemOpen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <DetailTopBar onBack={backToAgreements} tone={tab === 'poruke' ? 'muted' : tone}
        eyebrow={tab === 'poruke' ? other?.ime ?? 'Razgovor o Dogovoru' : agreementStateText(dogovor.stanje)} title={tab === 'poruke' ? 'Poruke' : 'Dogovor'} />
      <View style={s.tabs}>
        {tab === 'poruke' ? <AgreementHero agreement={dogovor} compact onOpen={() => setTab('pregled')} /> : null}
        <AgreementTabs tab={tab} onChange={setTab} />
      </View>
      {tab === 'poruke' ? <AgreementChat messages={messages.data ?? []} loading={messages.loading} error={messages.error}
        writable={writable} terminal={!dogovor.chatDostupan} refresh={messages.refresh} refreshWorkspace={workspace.refresh} outbox={outbox} state={outboxState} photos={photos}
        support={{ canAct: formCurrent, navigate: action => { if (formCurrent()) { formFocus.current = null; action(); } } }} /> : <>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <WorkspaceCard><AgreementHero agreement={dogovor} /></WorkspaceCard>
          <NextStepCard tone={nextStep.tone} title={nextStep.title} body={nextStep.body}>
            {active && me && !radnje ? <View style={s.stack}>
              <T variant="meta" tone="muted">Dozvole za završetak nisu potvrđene sa servera. Osveži status Dogovora pre završetka.</T>
              <V2Action label="Osveži dozvole za završetak" kind="quiet" disabled={!enabled} onPress={() => void osvezi()} />
            </View> : null}
            {active && me && radnje?.izmenaNaCekanju ? <T variant="meta" tone="muted">Predlog izmene čeka odgovor. Završetak je moguć tek kada se predlog prihvati, odbije ili povuče.</T> : null}
          </NextStepCard>
          <AgreementPeople agreement={dogovor} />
          {me && enabled ? <GroupConversationEntry agreementId={id} /> : null}
          {me ? <WorkspaceRows>
            <WorkspaceRow label="Izmene i otkazivanje Dogovora" hint="Cena, obim, termin ili otkazivanje uz razlog" disabled={!enabled}
              onPress={() => { if (formCurrent()) router.push({ pathname: '/dogovor/[id]/izmene', params: { id } }); }} />
            {active && dogovor.rezim !== 'DALJINSKI' ? <WorkspaceRow label="Dobrovoljna lokacija Uskočera" hint="Jedna tačka, samo uz pristanak" disabled={!enabled}
              onPress={() => { if (formCurrent()) router.push({ pathname: '/dogovor/[id]/lokacija', params: { id } }); }} /> : null}
            {other ? <WorkspaceRow label="Bezbednost i privatna prijava" hint="Blokiranje i poverljiva prijava podršci" disabled={!enabled}
              onPress={() => { if (enabled && ownsAccount() && activeRef.current && freshRef.current)
                router.navigate({ pathname: '/bezbednost', params: { targetAccountId: other.id, agreementId: id } }); }} /> : null}
          </WorkspaceRows> : null}
          <AgreementSection label="Kontakt" summary={dogovor.kontakt.mojTelefonPodeljen ? 'Tvoj broj je podeljen' : 'Podeli svoj broj kada ti odgovara'}>
            <T variant="meta" tone="muted">Deljenje je odvojeno u oba smera. Kada podeliš svoj broj, druga strana ne deli automatski svoj.</T>
            <T variant="body" style={s.ink}>Broj druge strane: {dogovor.kontakt.njihovTelefon ?? 'Nisu podelili svoj broj'}</T>
            {active && me ? <V2Action label={dogovor.kontakt.mojTelefonPodeljen ? 'Opozovi deljenje broja' : 'Podeli svoj broj'} disabled={!enabled}
              onPress={() => void mutate(() => dogovor.kontakt.mojTelefonPodeljen ? izvor.opoziviTelefon(id) : izvor.podeliTelefon(id))} /> : null}
          </AgreementSection>
          {/* The child renders nothing once the agreement is finished or cancelled, so this section
              opened onto an empty card on exactly the agreements a person revisits. */}
          {dogovor.rezim !== 'DALJINSKI' && dogovor.kontakt.lokacijaPostoji ? <AgreementSection label="Lokacija i pristup" summary="Precizni podaci samo uz dozvoljen pristup">
            {dogovor.stanje === 'CONFIRMED' || dogovor.stanje === 'AWAITING_REQUESTER'
              ? <AgreementPrivateLocation agreement={dogovor} enabled={enabled} />
              : <T variant="note" tone="muted">Pristup lokaciji je zatvoren kada se Dogovor završi ili otkaže.</T>}
          </AgreementSection> : null}
          {dogovor.hronologija.length ? <AgreementSection label="Tok Dogovora" summary="Sačuvani događaji">
            {dogovor.hronologija.map((event, index) => <View key={index} style={s.event}>
              <View style={s.eventLine} /><View style={s.eventCopy}><T variant="body" style={s.ink}>{event.tekst}</T><T variant="meta" tone="muted">{event.vremeTekst}</T></View>
            </View>)}
          </AgreementSection> : null}
          {problemPanel}
          {workspace.error ? <WorkspaceNote tone="danger"><T accessibilityRole="alert" variant="body" style={s.danger}>{workspace.error}</T>
            <V2Action label="Osveži status Dogovora" disabled={workspace.busy} onPress={() => void osvezi()} /></WorkspaceNote> : null}
        </ScrollView>
        <WorkspaceFooter brand={brand} secondary={secondary} />
      </>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  status: { padding: 24, gap: 16 }, center: { textAlign: 'center' },
  ink: { color: sys.color.ink }, danger: { color: sys.color.danger },
  tabs: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16 },
  stack: { gap: 8, marginTop: 4 },
  input: { ...sys.type.body, color: sys.color.ink, minHeight: 100, padding: 12, textAlignVertical: 'top', borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control, backgroundColor: sys.color.surface },
  event: { flexDirection: 'row', gap: 12 }, eventLine: { width: 2, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, marginVertical: 4 }, eventCopy: { flex: 1, gap: 2 },
});
