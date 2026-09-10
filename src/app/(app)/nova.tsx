import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import type { AiNeedTurnStatus, AiNeedV2Conversation } from '../../contracts/aiNeedV2';
import { aiNeedV2Izvor } from '../../data';
import type { Ishod } from '../../data/ports';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ulogaSada, useUloga } from '../../store/uloga';

import { IntakePresentation, IntakeUnavailable } from '../../ui/v2/IntakePresentation';

type IntakeSnapshot = { conversation: AiNeedV2Conversation; turn: AiNeedTurnStatus | null };
type PendingTurn = { id: string; body: string };

export default function NovaPotrebaV2() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>();
  const { user, accountRevision } = useSesija(), intent = useUloga();
  const resumeId = typeof params.conversationId === 'string' ? params.conversationId : undefined;
  const invalidRoute = params.conversationId !== undefined && (!resumeId || !uuid(resumeId));
  return <OwnedIntake key={`${user?.id ?? ''}:${accountRevision}:${intent}:${resumeId ?? ''}:${invalidRoute}`}
    resumeId={resumeId} invalidRoute={invalidRoute} />;
}

function OwnedIntake({ resumeId, invalidRoute }: { resumeId?: string; invalidRoute: boolean }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id, intent = useUloga();
  const [openRequestId] = useState(noviUuidZahtevId);
  const conversation = useRef<string | null>(resumeId ?? null);
  const request = useRef<PendingTurn | null>(null), abandoning = useRef(false);
  const [unos, setUnos] = useState('');
  const focus = useRef<object | null>(null), navigating = useRef(false);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false;
    return () => { if (focus.current === scope) focus.current = null; };
  }, [accountId, accountRevision, intent]));
  const read = useCallback(async (): Promise<Ishod<IntakeSnapshot>> => {
    const scope = focus.current;
    const current = () => scope !== null && scope === focus.current && !!accountId
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    const unavailable = (): Ishod<never> => ({ ok: false, kod: 'AI_INTAKE_UNAVAILABLE',
      poruka: 'Razgovor trenutno nije dostupan. Proverite vezu i učitajte ga ponovo.' });
    if (invalidRoute || !current()) return unavailable();
    try {
      if (!conversation.current) {
        const opened = await aiNeedV2Izvor.openConversation(openRequestId);
        if (!current()) return unavailable();
        if (!opened.ok) return opened;
        conversation.current = opened.podatak.conversationId;
      }
      const id = conversation.current;
      const pending = request.current;
      let turn: AiNeedTurnStatus | null = null;
      if (pending) {
        const status = await aiNeedV2Izvor.readTurn(id, pending.id);
        if (!current()) return unavailable();
        if (!status.ok) return status;
        turn = status.podatak;
      }
      const next = await aiNeedV2Izvor.loadConversation(id);
      if (!current() || !next || next.conversationId !== id) return unavailable();
      return { ok: true, podatak: { conversation: next, turn } };
    } catch { return unavailable(); }
  }, [accountId, accountRevision, intent, invalidRoute, openRequestId]);
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
  const knownRetry = !!pending && turn?.clientRequestId === pending.id && turn.retryAllowed;
  const writable = stanje?.status === 'OPEN' && stanje.safety !== 'BLOCK' && !abandoning.current;
  const canSubmit = writable && !editor.loading && !radi && !editor.uncertain && (!pending || knownRetry);

  useEffect(() => {
    if (turn?.state !== 'SUCCEEDED' || request.current?.id !== turn.clientRequestId) return;
    request.current = null; setUnos('');
  }, [turn]);

  const posalji = async () => {
    if (!canAct() || !canSubmit || !razgovorId) return;
    const body = request.current?.body ?? unos.trim();
    if (!body) return;
    await editor.save(async () => {
      const command = request.current ?? { id: noviUuidZahtevId(), body };
      request.current = command;
      const result = await aiNeedV2Izvor.sendMessage(razgovorId, command.body, command.id);
      if (!isCurrent()) return { ok: false, kod: 'AI_INTAKE_CHANGED', poruka: 'Ponovo otvorite razgovor.' };
      if (!result.ok) return result;
      return read();
    });
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
    error={greska ?? 'Razgovor nije dostupan.'} retry={invalidRoute ? undefined : osvezi} back={back} />;

  const statusCopy = stanje.status !== 'OPEN'
    ? stanje.status === 'ABANDONED' ? 'Razgovor je napušten.'
      : stanje.status === 'COMPLETED' ? 'Razgovor je završen. Sačuvani Zadatak možete otvoriti iz pregleda.'
        : 'Nastavak ovog razgovora nije dostupan.'
    : abandoning.current ? 'Napuštanje razgovora još nije potvrđeno. Proverite stanje pre ponovnog pokušaja.'
      : pending ? turn?.state === 'PROCESSING' ? 'AI još obrađuje poruku. Proverite ishod.'
        : knownRetry ? 'Poruka je sačuvana za ponovni pokušaj. Ponovite isti zahtev.'
          : 'Ishod slanja nije potvrđen. Proverite ga pre sledeće poruke.' : null;

  return <IntakePresentation conversation={stanje} value={unos} busy={radi} error={greska}
    canSubmit={!!canSubmit && !!(request.current?.body ?? unos).trim()}
    canEdit={!!canSubmit && !request.current} pending={!!request.current} statusCopy={statusCopy}
    canReview={!!razgovorId && stanje.facts.length > 0 && !radi && !editor.loading && !editor.uncertain && !request.current}
    reviewLabel={stanje.review.boundNeedId ? 'Pregledajte izmene' : 'Pregledajte nacrt'}
    showReadback={!!(editor.uncertain || ((request.current || abandoning.current) && stanje.status === 'OPEN') || greska)}
    readbackDisabled={radi || editor.loading}
    showAbandon={stanje.status === 'OPEN' && !stanje.review.boundNeedId}
    abandonDisabled={radi || editor.loading || editor.uncertain}
    abandonLabel={abandoning.current ? 'Ponovite napuštanje razgovora' : 'Napusti razgovor'}
    onBack={back} onSend={posalji} onRefresh={osvezi} onAbandon={napusti}
    onChange={value => { if (canAct() && writable && !request.current) setUnos(value); }}
    onReview={() => {
      if (!canAct() || !razgovorId || request.current) return;
      navigate(() => router.push({ pathname: '/pregled-nacrta', params: { conversationId: razgovorId } }));
    }} />;
}
