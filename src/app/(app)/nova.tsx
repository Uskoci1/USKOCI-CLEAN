import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import type { AiNeedTurnRecovery, AiNeedTurnStatus, AiNeedV2Conversation } from '../../contracts/aiNeedV2';
import { aiNeedV2Izvor } from '../../data';
import { aiTurnIntentJournal } from '../../data/aiTurnIntentJournal';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';

import { IntakePresentation, IntakeUnavailable } from '../../ui/v2/IntakePresentation';
import { useHoldToTalk } from '../../features/voice/useHoldToTalk';
import { VoiceComposer } from '../../ui/aiFirst/VoiceComposer';

type IntakeSnapshot = { conversation: AiNeedV2Conversation; turn: AiNeedTurnStatus | null; recovery: AiNeedTurnRecovery | null };
type PendingTurn = { id: string; body: string | null; voice?: boolean };

export default function NovaPotrebaV2() {
  const params = useLocalSearchParams<{ conversationId?: string | string[]; entryKey?: string | string[] }>();
  const { user, accountRevision } = useSesija(), intent = useUloga();
  const resumeId = typeof params.conversationId === 'string' ? params.conversationId : undefined;
  const entryKey = typeof params.entryKey === 'string' ? params.entryKey : undefined;
  const invalidRoute = (params.conversationId !== undefined && (!resumeId || !uuid(resumeId)))
    || (params.entryKey !== undefined && (!entryKey || !uuid(entryKey)));
  return <OwnedIntake key={`${user?.id ?? ''}:${accountRevision}:${intent}:${resumeId ?? ''}:${entryKey ?? ''}:${invalidRoute}`}
    resumeId={resumeId} invalidRoute={invalidRoute} />;
}

function OwnedIntake({ resumeId, invalidRoute }: { resumeId?: string; invalidRoute: boolean }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id, intent = useUloga();
  const [openRequestId] = useState(noviUuidZahtevId);
  const conversation = useRef<string | null>(resumeId ?? null);
  const request = useRef<PendingTurn | null>(null), abandoning = useRef(false);
  const [unos, setUnos] = useState('');
  const [recoveryConversation, setRecoveryConversation] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const streamAbort = useRef<AbortController | null>(null);
  const focus = useRef<object | null>(null), navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null;
      streamAbort.current?.abort(); streamAbort.current = null; setStreamingText(''); };
  }, [accountId, accountRevision, intent]));
  const read = useCallback(async (): Promise<Ishod<IntakeSnapshot>> => {
    const scope = focus.current;
    const current = () => scope !== null && scope === focus.current && !!accountId
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    const unavailable = (): Ishod<never> => ({ ok: false, kod: 'AI_INTAKE_UNAVAILABLE',
      poruka: 'Razgovor trenutno nije dostupan. Proverite vezu i učitajte ga ponovo.' });
    if (invalidRoute || !current()) return unavailable();
    try {
      const stored = await aiTurnIntentJournal.load(accountId!);
      if (!current()) return unavailable();
      if (stored) {
        if (resumeId && resumeId !== stored.conversationId) {
          setRecoveryConversation(stored.conversationId);
          return { ok: false, kod: 'AI_OTHER_TURN_PENDING', poruka: 'Najpre proverite prethodno slanje poruke.' };
        }
        if (conversation.current && conversation.current !== stored.conversationId) return unavailable();
        conversation.current = stored.conversationId;
        if (!request.current || request.current.id !== stored.clientRequestId)
          request.current = { id: stored.clientRequestId, body: null };
      }
      if (!conversation.current) {
        const opened = await aiNeedV2Izvor.openConversation(openRequestId);
        if (!current()) return unavailable();
        if (!opened.ok) return opened;
        conversation.current = opened.podatak.conversationId;
      }
      const id = conversation.current;
      const pending = request.current;
      let turn: AiNeedTurnStatus | null = null;
      let recovery: AiNeedTurnRecovery | null = null;
      if (pending) {
        const status = await aiNeedV2Izvor.recoverTurn(id, pending.id);
        if (!current()) return unavailable();
        if (!status.ok) return status;
        recovery = status.podatak; turn = recovery.turn;
      }
      const next = await aiNeedV2Izvor.loadConversation(id);
      if (!current() || !next || next.conversationId !== id) return unavailable();
      // Persisted FAILED after dispatch is terminal: SQL cannot reclaim this key
      // or complete a late attempt. PROCESSING (including expired) stays unknown.
      const terminalFailure = turn?.state === 'FAILED' && recovery?.providerDispatched && !turn.retryAllowed;
      if (pending && recovery && (recovery.cancelled || turn?.state === 'SUCCEEDED' || terminalFailure || next.status === 'ABANDONED')) {
        await aiTurnIntentJournal.clear({ accountId: accountId!, conversationId: id, clientRequestId: pending.id });
        if (!current()) return unavailable();
        if (request.current?.id === pending.id) {
          request.current = null;
          if (turn?.state === 'SUCCEEDED' && !pending.voice) setUnos('');
          setStreamingText('');
        }
      }
      return { ok: true, podatak: { conversation: next, turn, recovery } };
    } catch { return unavailable(); }
  }, [accountId, accountRevision, intent, invalidRoute, openRequestId, resumeId]);
  const editor = useOwnedEditor(read);
  const stanje = editor.data?.conversation ?? null, turn = editor.data?.turn ?? null;
  const razgovorId = stanje?.conversationId ?? null;
  const radi = editor.busy, greska = editor.error;
  const view = useMemo(() => ({}), [editor.data]), currentView = useRef(view);
  currentView.current = view;
  const renderedFocus = focus.current;
  const isCurrent = () => renderedFocus !== null && focus.current === renderedFocus && currentView.current === view
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  const canAct = () => isCurrent() && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain && !!stanje;
  const navigate = (action: () => void) => { if (!isCurrent() || navigating.current) return; navigating.current = true; action(); };
  const back = () => navigate(() => router.canGoBack() ? router.back() : router.replace('/potrebe'));
  const pending = request.current;
  const knownRetry = !!pending?.body && turn?.clientRequestId === pending.id && turn.retryAllowed;
  const writable = stanje?.status === 'OPEN' && stanje.safety !== 'BLOCK' && !abandoning.current;
  const canSubmit = writable && !editor.loading && !radi && !editor.uncertain && (!pending || knownRetry);

  const submitTurn = async (body: string, supplied?: { id: string; signal: AbortSignal; isCurrent: () => boolean }) => {
    let outcome: 'accepted' | 'rejected' | 'unknown' = 'unknown';
    if (!canAct() || !canSubmit || !razgovorId || !body || (supplied && !supplied.isCurrent())) return { kind: outcome };
    await editor.save(async () => {
      if (supplied && !supplied.isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvorite razgovor.' };
      const command = request.current ?? { id: supplied?.id ?? noviUuidZahtevId(), body, voice: !!supplied };
      request.current = command;
      try {
        await aiTurnIntentJournal.save({ accountId: accountId!, conversationId: razgovorId, clientRequestId: command.id });
      } catch {
        return { ok: false, kod: 'AI_LOCAL_INTENT_NOT_SAVED', poruka: 'Slanje nije pokrenuto. Proverite stanje pre ponovnog pokušaja.' };
      }
      // Storage completion is asynchronous: recheck focus/account before HTTP.
      if (!isCurrent() || (supplied && !supplied.isCurrent()) || !command.body)
        return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvorite razgovor.' };
      const abort = new AbortController(); streamAbort.current?.abort(); streamAbort.current = abort;
      const stop = () => abort.abort(); supplied?.signal.addEventListener('abort', stop, { once: true });
      if (supplied?.signal.aborted) stop();
      setStreamingText('');
      let result: Ishod<AiNeedTurnStatus>;
      try {
        result = await aiNeedV2Izvor.sendMessage(razgovorId, command.body, command.id, { signal: abort.signal,
          onText: delta => { if (isCurrent() && !abort.signal.aborted && request.current === command) setStreamingText(previous => previous + delta); } });
      } finally {
        supplied?.signal.removeEventListener('abort', stop);
        if (streamAbort.current === abort) { streamAbort.current = null; if (isCurrent()) setStreamingText(''); }
      }
      if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvorite razgovor.' };
      if (!result.ok) return result;
      const snapshot = await read();
      if (snapshot.ok && snapshot.podatak.turn?.clientRequestId === command.id) {
        if (snapshot.podatak.turn.state === 'SUCCEEDED') outcome = 'accepted';
        else if (snapshot.podatak.turn.state === 'FAILED' && snapshot.podatak.turn.retryAllowed) outcome = 'rejected';
      }
      return snapshot;
    });
    return { kind: outcome as 'accepted' | 'rejected' | 'unknown' };
  };
  const cancelPendingTurn = () => {
    const command = request.current;
    if (!canAct() || !razgovorId || !command || !editor.data?.recovery?.canCancel) return;
    void editor.save(async () => {
      const result = await aiNeedV2Izvor.cancelTurn(razgovorId, command.id);
      if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvorite razgovor.' };
      if (!result.ok) return result;
      // A competing dispatch can win; only exact readback retires this intent.
      return read();
    });
  };
  const voice = useHoldToTalk({ conversationId: razgovorId, submit: input => submitTurn(input.text,
    { id: input.clientRequestId, signal: input.signal, isCurrent: input.isCurrent }) });
  useEffect(() => {
    const submission = voice.state.submission;
    if (!submission || turn?.clientRequestId !== submission.clientRequestId) return;
    if (turn.state === 'SUCCEEDED') voice.controller.resolveSubmission(submission.clientRequestId, { kind: 'accepted' });
    else if (editor.data?.recovery?.cancelled || (turn.state === 'FAILED' && editor.data?.recovery?.providerDispatched)
      || ((turn.state === 'FAILED' || turn.state === 'ABSENT') && turn.retryAllowed))
      voice.controller.resolveSubmission(submission.clientRequestId, { kind: 'rejected' });
  }, [turn, editor.data?.recovery?.cancelled, voice.controller, voice.state.submission]);
  const voiceBusy = voice.state.phase !== 'IDLE' && voice.state.phase !== 'UNKNOWN_OUTCOME';
  const posalji = async () => {
    if (voiceBusy) return;
    await submitTurn(request.current?.body ?? unos.trim());
  };
  const noviZadatak = () => {
    if (!canAct() || request.current || (stanje?.status !== 'COMPLETED' && stanje?.status !== 'ABANDONED')) return;
    // Replace drops the old resume parameter. Keying the retained tab starts a
    // fresh owned opener; it does not delete or reopen the terminal conversation.
    navigate(() => router.replace({ pathname: '/nova', params: { entryKey: noviUuidZahtevId() } }));
  };
  const osvezi = () => { if (!isCurrent() || navigating.current || radi || editor.loading) return; void editor.refresh(); };
  const napusti = () => {
    if (!canAct() || !razgovorId || stanje?.status !== 'OPEN' || stanje.review.boundNeedId) return;
    const submit = () => {
      if (!canAct()) return;
      void editor.save(async () => {
        abandoning.current = true;
        const result = await aiNeedV2Izvor.abandonConversation(razgovorId);
        if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvorite razgovor.' };
        if (!result.ok) return result;
        return read();
      });
    };
    if (abandoning.current) { submit(); return; }
    Alert.alert('Napustiti razgovor?', 'Ovaj razgovor više nećete moći da nastavite. Podaci se čuvaju prema objavljenim pravilima; ovo ih ne briše odmah.',
      [{ text: 'Nastavi razgovor', style: 'cancel' }, { text: 'Napusti razgovor', style: 'destructive', onPress: submit }]);
  };

  if (!stanje) return <IntakeUnavailable loading={editor.loading}
    error={greska ?? 'Razgovor nije dostupan.'} retry={invalidRoute || recoveryConversation ? undefined : osvezi} back={back}
    recover={recoveryConversation ? () => navigate(() => router.replace({ pathname: '/nova', params: { conversationId: recoveryConversation } })) : undefined} />;

  const statusCopy = stanje.status !== 'OPEN'
    ? stanje.status === 'ABANDONED' ? 'Razgovor je napušten.'
      : stanje.status === 'COMPLETED' ? 'Razgovor je završen. Sačuvani Zadatak možete otvoriti iz pregleda.'
        : 'Nastavak ovog razgovora nije dostupan.'
    : abandoning.current ? 'Napuštanje razgovora još nije potvrđeno. Proverite stanje pre ponovnog pokušaja.'
      : pending ? turn?.state === 'PROCESSING' ? 'AI još obrađuje poruku. Proverite ishod.'
        : knownRetry ? 'Poruka je sačuvana za ponovni pokušaj. Ponovite isti zahtev.'
          : editor.data?.recovery?.canCancel ? 'Prethodno slanje nije završeno. Otkažite ga da biste ponovo uneli poruku.'
          : 'Ishod slanja nije potvrđen. Proverite ga pre sledeće poruke.'
        : turn?.state === 'FAILED' && editor.data?.recovery?.providerDispatched
          ? 'AI nije primenio prethodnu poruku. Možete je izmeniti i poslati ponovo.' : null;

  return <IntakePresentation conversation={stanje} value={unos} busy={radi} error={greska}
    canSubmit={!!canSubmit && !voiceBusy && !!(request.current?.body ?? unos).trim()}
    canEdit={!!canSubmit && !voiceBusy && !request.current} pending={!!request.current} statusCopy={statusCopy}
    streamingText={streamingText}
    photosDisabled={!canAct() || !writable || !!request.current || voiceBusy}
    onPhotos={writable ? () => {
      if (!canAct() || !razgovorId || !writable || request.current || voiceBusy) return;
      navigate(() => router.push({ pathname: '/fotografije-zadatka', params: { conversationId: razgovorId } }));
    } : undefined}
    voice={stanje.status === 'OPEN' ? <VoiceComposer controller={voice.controller} state={voice.state} disabled={!canSubmit || !!request.current}
      onKeepText={value => { if (canAct() && writable && !request.current) setUnos(previous => previous ? previous + '\n' + value : value); }} /> : undefined}
    canReview={!!razgovorId && stanje.facts.length > 0 && !radi && !editor.loading && !editor.uncertain && !request.current}
    reviewLabel={stanje.review.boundNeedId ? 'Pregledaj izmene' : 'Pregledaj zadatak'}
    showReadback={!!(editor.uncertain || ((request.current || abandoning.current) && stanje.status === 'OPEN') || greska)}
    readbackDisabled={radi || editor.loading}
    onCancelPending={pending && editor.data?.recovery?.canCancel ? cancelPendingTurn : undefined}
    cancelPendingDisabled={!canAct()}
    showAbandon={stanje.status === 'OPEN' && !stanje.review.boundNeedId}
    abandonDisabled={radi || editor.loading || editor.uncertain}
    abandonLabel={abandoning.current ? 'Ponovite napuštanje razgovora' : 'Napusti razgovor'}
    onNewTask={stanje.status === 'COMPLETED' || stanje.status === 'ABANDONED' ? noviZadatak : undefined}
    newTaskDisabled={!canAct() || !!request.current}
    onBack={back} onSend={posalji} onRefresh={osvezi} onAbandon={napusti}
    onChange={value => { if (canAct() && writable && !request.current) setUnos(value); }}
    onReview={() => {
      if (!canAct() || !razgovorId || request.current) return;
      navigate(() => router.push({ pathname: '/pregled-zadatka', params: { conversationId: razgovorId } }));
    }} />;
}
