import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, Platform, ActivityIndicator, KeyboardAvoidingView, TextInput, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { Ishod } from '../../data/ports';
import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { v2 } from '../../ui/v2/tokens';
import { V2Icon } from '../../ui/v2/icons';
import { V2Action } from '../../ui/v2/V2Action';
import { AgreementHero, AgreementPeople, AgreementSection, AgreementTabs, type AgreementTab } from '../../ui/v2/AgreementPresentation';
import { useIzvor, useUloga, ulogaSada } from '../../store/uloga';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { useAgreementOutbox } from '../../hooks/useAgreementOutbox';
import { useSesija, sesijaSada } from '../../store/sesija';
import { AgreementChat } from '../../ui/AgreementChat';
import { AgreementPrivateLocation } from '../../ui/AgreementPrivateLocation';
import { needScheduleText } from '../../data/needDetailPresentation';

const bodyStyle = { ...v2.text.body, color: v2.color.ink };
const metaStyle = { ...v2.text.label, color: v2.color.muted };
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
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: v2.color.canvas }}>
    <Press accessibilityRole="button" accessibilityLabel="Nazad" onPress={backToAgreements}
      style={{ minHeight: 44, padding: 18, justifyContent: 'center' }}><V2Icon name="back" /></Press>
    <View style={{ padding: 24, gap: 18 }}>
      {loading ? <ActivityIndicator accessibilityLabel="Učitavanje Dogovora" color={v2.color.teal} /> : <>
        <T accessibilityRole="header" style={{ ...v2.text.hero, color: v2.color.ink }}>{error ? 'Dogovor nije učitan' : 'Dogovor nije dostupan'}</T>
        <T style={bodyStyle}>{error ? 'Proverite internet vezu i pokušajte ponovo.' : 'Veza je zastarela ili nemate pristup ovom Dogovoru.'}</T>
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
  const ownsAccount = useCallback(() => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision
    && ulogaSada() === intent, [accountId, accountRevision, intent]);
  const read = useCallback(async (): Promise<Ishod<DogovorProjekcija | null>> => {
    if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvorite Dogovor.' };
    try {
      const data = await bounded(() => izvor.dogovor(id));
      if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvorite Dogovor.' };
      if (data && data.id !== id) return { ok: false, kod: 'INVALID_RESPONSE', poruka: 'Dogovor nije dostupan.' };
      return { ok: true, podatak: data };
    } catch { return { ok: false, kod: 'AGREEMENT_READ_FAILED', poruka: 'Dogovor nije učitan. Proverite vezu i pokušajte ponovo.' }; }
  }, [izvor, id, ownsAccount]);
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
  const messages = useFocusedResource(useCallback(() => izvor.poruke(id, accountId), [izvor, id, accountId]));
  const dogovor = workspace.data;
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.error && !workspace.busy && !workspace.uncertain;
  const writable = enabled && dogovor?.chatDostupan === true;
  const { model: outbox, state: outboxState } = useAgreementOutbox(accountId, id, writable);
  const osvezi = workspace.refresh;
  useEffect(() => {
    if (messages.data && !messages.error) void outbox.reconcile(messages.data
      .filter(message => !!message.clientMessageId && !!message.posiljalacAccountId)
      .map(message => ({ clientMessageId: message.clientMessageId!, senderAccountId: message.posiljalacAccountId!, messageId: message.id, body: message.telo })));
  }, [messages.data, messages.error, outbox, outboxState.phase]);
  const deniedAttempt = outboxState.entries.filter(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE')
    .map(entry => `${entry.command.clientMessageId}:${entry.attempt}`).join('|');
  useEffect(() => { if (deniedAttempt) void osvezi(); }, [deniedAttempt, osvezi]);
  useEffect(() => { setProblemOpen(false); setProblemText(''); }, [dogovor]);
  if (!foreground || resumeRequired) return <AgreementStatus loading />;
  if (!dogovor) return <AgreementStatus loading={workspace.loading} error={!!workspace.error} retry={() => void osvezi()} />;

  // Party identity comes from the Agreement, not the user's currently selected intent.
  const me = dogovor.ucesnici.find(party => party.viSte && party.id === accountId);
  const worker = me?.uloga === 'uskocer', requester = me?.uloga === 'narucilac';
  const active = dogovor.stanje === 'CONFIRMED' || dogovor.stanje === 'AWAITING_REQUESTER';
  const canComplete = active && !!me && (requester || dogovor.stanje === 'CONFIRMED');
  const other = dogovor.ucesnici.find(party => !party.viSte);
  const mutate = async (command: () => Promise<Ishod<unknown>>) => {
    if (!enabled || !me || !ownsAccount() || !activeRef.current || !freshRef.current) return;
    await workspace.save(async () => {
      const result = await bounded(command);
      if (!result.ok) return { ok: false as const, kod: 'AGREEMENT_ACTION_UNCONFIRMED', poruka: 'Promena nije potvrđena. Osvežite Dogovor pre novog pokušaja.' };
      return read();
    });
  };
  const complete = () => { if (canComplete) void mutate(() => worker ? izvor.oznaciZavrsetak(id) : izvor.potvrdiZavrsetak(id)); };
  const deadline = dogovor.rokPotvrdeIso ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: dogovor.rokPotvrdeIso }, 'Europe/Belgrade') : 'Rok trenutno nije dostupan';
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: v2.color.canvas }}>
    {/* Keyboard screenY and this full-screen parent share the same origin. */}
    <KeyboardAvoidingView style={{ flex: 1 }} enabled={tab === 'poruke' || problemOpen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Press accessibilityRole="button" accessibilityLabel="Nazad" haptic="select" onPress={backToAgreements}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><V2Icon name="back" /></Press>
        <View style={{ flex: 1, gap: 2 }}><T style={metaStyle}>{tab === 'poruke' ? other?.ime ?? 'Razgovor o Dogovoru' : active ? 'Prihvaćeni uslovi' : 'Zatvoreni Dogovor'}</T>
          <T accessibilityRole="header" style={{ ...v2.text.title, color: v2.color.ink }}>{tab === 'poruke' ? 'Poruke' : 'Dogovor'}</T></View>
      </View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 12, gap: 10 }}>
        {tab === 'poruke' ? <AgreementHero agreement={dogovor} compact onOpen={() => setTab('pregled')} /> : null}
        <AgreementTabs tab={tab} onChange={setTab} />
      </View>
      {tab === 'poruke' ? <AgreementChat messages={messages.data ?? []} loading={messages.loading} error={messages.error}
        writable={writable} terminal={!dogovor.chatDostupan} refresh={messages.refresh} refreshWorkspace={workspace.refresh} outbox={outbox} state={outboxState} /> : <>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 20 }}>
          <AgreementHero agreement={dogovor} />
          <AgreementPeople agreement={dogovor} />
          <AgreementSection label="Kontakt" summary={dogovor.kontakt.mojTelefonPodeljen ? 'Vaš broj je podeljen' : 'Podelite svoj broj kada vam odgovara'}>
            <T style={metaStyle}>Deljenje je odvojeno u oba smera. Kada podelite svoj broj, druga strana ne deli automatski svoj.</T>
            <T style={bodyStyle}>Broj druge strane: {dogovor.kontakt.njihovTelefon ?? 'Nisu podelili svoj broj'}</T>
            {active && me ? <V2Action label={dogovor.kontakt.mojTelefonPodeljen ? 'Opozovi deljenje broja' : 'Podeli svoj broj'} disabled={!enabled}
              onPress={() => void mutate(() => dogovor.kontakt.mojTelefonPodeljen ? izvor.opoziviTelefon(id) : izvor.podeliTelefon(id))} /> : null}
          </AgreementSection>
          {dogovor.rezim !== 'DALJINSKI' && dogovor.kontakt.lokacijaPostoji ? <AgreementSection label="Lokacija i pristup" summary="Precizni podaci samo uz dozvoljen pristup">
            <AgreementPrivateLocation agreement={dogovor} enabled={enabled} />
          </AgreementSection> : null}
          {dogovor.hronologija.length ? <AgreementSection label="Tok Dogovora" summary="Sačuvani događaji">
            {dogovor.hronologija.map((event, index) => <View key={index} style={{ gap: 3 }}><T style={bodyStyle}>{event.tekst}</T><T style={metaStyle}>{event.vremeTekst}</T></View>)}
          </AgreementSection> : null}
          {dogovor.stanje === 'AWAITING_REQUESTER' ? <View style={{ gap: 12, padding: 18, borderRadius: 18, backgroundColor: v2.color.context }}>
            <T style={{ ...bodyStyle, fontWeight: '700' }}>{worker ? 'Čeka se Naručilac' : 'Uskočer je označio da je završio'}</T>
            <T style={metaStyle}>{dogovor.problemOtvoren ? 'Prijavljen je problem — Dogovor se neće zatvoriti sam dok se to ne reši.'
              : `${deadline}. Bez odgovora se Dogovor zatvara sam.`}</T>
            {requester && !dogovor.problemOtvoren ? <V2Action label="Prijavi problem" disabled={!enabled} kind="quiet" onPress={() => { if (enabled) setProblemOpen(true); }} /> : null}
            {problemOpen && requester ? <View style={{ gap: 10 }}>
              <TextInput accessibilityLabel="Opišite problem" value={problemText} onChangeText={setProblemText} multiline maxLength={2000}
                editable={enabled} placeholder="Šta je ostalo nerešeno?" placeholderTextColor={v2.color.muted}
                style={{ ...bodyStyle, minHeight: 100, padding: 12, textAlignVertical: 'top', borderWidth: 1, borderColor: v2.color.controlLine, borderRadius: 11, backgroundColor: v2.color.surface }} />
              <V2Action label="Pošalji prijavu problema" disabled={!enabled || !problemText.trim()} onPress={() => {
                if (problemText.trim()) void mutate(() => izvor.prijaviProblem(id, problemText.trim()));
              }} />
              <V2Action label="Odustani od prijave problema" kind="quiet" disabled={!enabled} onPress={() => setProblemOpen(false)} />
            </View> : null}
          </View> : null}
          {dogovor.stanje === 'CONFIRMED' && me ? <T style={metaStyle}>{worker
            ? 'Kada završite, označite završetak. Naručilac tada ima 48h da potvrdi ili prijavi problem.'
            : 'Završetak možete potvrditi kada je posao obavljen, i pre nego što ga Uskočer označi.'}</T> : null}
          {dogovor.stanje === 'COMPLETED' ? <T style={{ ...bodyStyle, color: v2.color.teal }}>Dogovor je završen</T> : null}
          {dogovor.stanje === 'CANCELLED' ? <T style={metaStyle}>Dogovor je otkazan.</T> : null}
          {workspace.error ? <View style={{ gap: 8 }}><T accessibilityRole="alert" style={{ ...bodyStyle, color: v2.color.danger }}>{workspace.error}</T>
            <V2Action label="Osveži status Dogovora" disabled={workspace.busy} onPress={() => void osvezi()} /></View> : null}
        </ScrollView>
        <View style={{ padding: 18, gap: 6, borderTopWidth: 1, borderColor: v2.color.line, backgroundColor: v2.color.surface }}>
          <V2Action label="Otvori poruke" kind="primary" onPress={() => setTab('poruke')} style={{ backgroundColor: v2.color.orange, borderWidth: 0, minHeight: 50, borderRadius: 16 }} />
          {canComplete ? <V2Action label={workspace.busy ? 'Čuvamo promenu…' : worker ? 'Završio sam' : 'Potvrdi završetak'} kind="quiet" disabled={!enabled} onPress={complete} /> : null}
        </View>
      </>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
