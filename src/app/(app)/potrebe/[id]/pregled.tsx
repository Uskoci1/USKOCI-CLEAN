import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { PotrebaProjekcija, StanjePotrebe } from '../../../../contracts/projections';
import type { Ishod } from '../../../../data/ports';
import { aiNeedV2Izvor } from '../../../../data';
import { failure, positiveInteger, sameId, uuid } from '../../../../data/serverReceipt';
import { ru4Production } from '../../../../data/ru4Production';
import { retainRemainingSearchCloseAttempt, type RemainingSearchCloseAttempt } from '../../../../data/remainingSearchCloseAttempt';
import { needPublicationReadiness, type NeedPublicationReadiness } from '../../../../data/needPublicationReadiness';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { NeedPresentation } from '../../../../ui/v2/NeedPresentation';
import { NeedPhotos } from '../../../../ui/media/ContextPhotos';
import { NeedLifecycleActions } from '../../../../ui/needs/NeedLifecycleActions';
import { TaskQaEntry } from '../../../../ui/qa/TaskQaEntry';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { ulogaSada, useIzvor, useUloga } from '../../../../store/uloga';

const STATUS: Record<StanjePotrebe, string> = { NACRT: 'Nacrt', OBJAVLJENA: 'Objavljena', CEKA_PRIJAVE: 'Čeka prijave',
  DELIMICNO_POPUNJENA: 'Delimično popunjena', POPUNJENA: 'Popunjena', ZATVORENA: 'Zatvorena' };
type Snapshot = { need: PotrebaProjekcija; remainingClosed: boolean };
const changed = () => failure('REVIEW_CHANGED', 'Ponovo otvori Zadatak i pregledaj trenutno stanje.');

export default function PregledPotrebe() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { user, accountRevision } = useSesija();
  const intent = useUloga();
  return <OwnedNeed key={`${id}:${user?.id ?? ''}:${accountRevision}:${intent}`} id={id} />;
}
function OwnedNeed({ id }: { id: string }) {
  const izvor = useIzvor(), intent = useUloga();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const identity = useMemo(() => ({}), [id, izvor, intent, accountId, accountRevision]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const focus = useRef<object | null>(null), life = useRef(0), navigating = useRef(false), dialog = useRef<object | null>(null);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [lifecycle, setLifecycle] = useState(0);
  const reading = useRef<object | null>(null);
  // An unconfirmed close keeps its command identity for the explicit retry; the
  // owner remounts on id/account/intent, so the attempt never outlives them.
  const closeAttempt = useRef<RemainingSearchCloseAttempt | null>(null);
  const [terminalActive, setTerminalActive] = useState(false);
  const terminalActiveRef = useRef(false);
  const setTerminal = useCallback((active: boolean) => { terminalActiveRef.current = active; setTerminalActive(active); }, []);
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; life.current++; navigating.current = false;
    foreground.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (active === foreground.current) return;
      foreground.current = active; life.current++; dialog.current = null;
      setLifecycle(value => value + 1);
    });
    return () => { subscription.remove(); if (focus.current === scope) focus.current = null;
      life.current++; dialog.current = null; };
  }, [identity]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const owner = focus.current, generation = life.current, invocation = {};
    reading.current = invocation;
    const current = () => owner !== null && focus.current === owner && foreground.current && life.current === generation
      && reading.current === invocation
      && latestIdentity.current === identity && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
    const load = async (): Promise<Ishod<Snapshot>> => {
      if (!current()) return changed();
      if (!uuid(id)) return failure('NEED_REQUIRED', 'Zadatak nije izabran.');
      const need = await izvor.potreba(id);
      if (!current()) return changed();
      if (!need || !sameId(need.id, id) || !positiveInteger(need.revizija) || !Object.hasOwn(STATUS, need.stanje)) {
        return failure('NEED_UNAVAILABLE', 'Zadatak nije pronađen ili više nije dostupan.');
      }
      const search = await ru4Production.remainingSearchState(id);
      if (!current()) return changed();
      if (!search || typeof search.closed !== 'boolean') return failure('NEED_INVALID_RESPONSE', 'Pregled Zadatka nije potvrđen.');
      return { ok: true, podatak: { need, remainingClosed: search.closed } };
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([load(), new Promise<Ishod<Snapshot>>(resolve => {
        timer = setTimeout(() => resolve(failure('NEED_READ_TIMEOUT', 'Učitavanje traje predugo. Proveri vezu i pokušaj ponovo.')), 15_000);
      })]);
    } catch { return failure('NEED_READ_FAILED', 'Zadatak trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo.'); }
    finally {
      if (timer !== undefined) clearTimeout(timer);
      // SDK reads may finish after the timeout. Retire their side-effect authority.
      if (reading.current === invocation) reading.current = null;
    }
  }, [id, identity, izvor, accountId, accountRevision, intent, lifecycle]);
  const editor = useOwnedEditor(read);
  const potreba = editor.data?.need ?? null;
  // A draft is told why it cannot be published, by the gate that decides it rather than by a
  // guess. Read-only: it reports, and the server decides again when publishing is attempted.
  const [readiness, setReadiness] = useState<NeedPublicationReadiness | null>(null);
  const preostalaPotragaZatvorena = editor.data?.remainingClosed ?? false;
  const ucitava = editor.loading, greska = editor.error, akcijaUToku = editor.busy || editor.uncertain;
  const renderedFocus = focus.current, renderedLife = life.current;
  const latestData = useRef(editor.data); latestData.current = editor.data;
  const current = () => focus.current !== null && focus.current === renderedFocus && foreground.current
    && life.current === renderedLife && latestIdentity.current === identity && latestData.current === editor.data
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent;
  useEffect(() => {
    setReadiness(null);
    // Gated on intent, this never ran while the owner was in JA MOGU, so his own draft answered
    // with the old promise "Sledeće: pregled i objava jednim korakom" - for a draft the publish gate
    // would have refused. Ownership is the server's business and it checks it.
    const draft = potreba && potreba.stanje === 'NACRT';
    if (!draft || !potreba) return;
    const scope = focus.current, lifeAt = life.current, ownedBy = latestIdentity.current;
    let alive = true;
    void needPublicationReadiness.read(potreba.id, potreba.revizija).then(result => {
      // A late answer must not land on another account, another task or another focus.
      if (!alive || focus.current !== scope || life.current !== lifeAt || latestIdentity.current !== ownedBy) return;
      setReadiness(result.ok ? result.podatak : { kind: 'UNKNOWN' });
    }, () => {});
    return () => { alive = false; };
  }, [potreba?.id, potreba?.revizija, potreba?.stanje, intent, identity, lifecycle]);
  const canAct = () => current() && intent === 'narucilac' && !terminalActiveRef.current && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain && !!editor.data;
  const navigate = (action: () => void) => { if (!current() || navigating.current) return;
    dialog.current = null; navigating.current = true; action(); };
  const refresh = () => { if (!current() || editor.busy) return; dialog.current = null;
    void editor.refresh(); };
  const ask = (title: string, description: string, label: string, command: () => Promise<void>) => {
    if (!canAct() || dialog.current) return;
    const confirmation = {}; dialog.current = confirmation;
    const cancel = () => { if (dialog.current === confirmation) dialog.current = null; };
    Alert.alert(title, description, [{ text: 'Odustani', style: 'cancel', onPress: cancel }, {
      text: label, onPress: () => { if (dialog.current !== confirmation || !canAct()) return;
        dialog.current = null; void command(); },
    }], { cancelable: true, onDismiss: cancel });
  };
  const zatvoriPreostaluPotragu = () => {
    if (!canAct() || !potreba || preostalaPotragaZatvorena || potreba.pokrivenost.popunjeno <= 0 || potreba.pokrivenost.preostalo <= 0) return;
    ask('Ne traži više nikoga?', `Zatvorićemo potragu za preostalih ${potreba.pokrivenost.preostalo} mesta. Postojeći Dogovori i originalni uslovi Zadatka ostaju nepromenjeni.`,
      'Zatvori potragu', async () => { await editor.save(async () => {
        const attempt = retainRemainingSearchCloseAttempt(closeAttempt.current, potreba.id, potreba.revizija, () => noviZahtevId('zatvori-preostalu-potragu'));
        closeAttempt.current = attempt;
        const result = await ru4Production.closeRemainingSearch(attempt.needId, attempt.revision, attempt.clientRequestId);
        if (!current()) return changed();
        if (!result.ok) return failure('REMAINING_SEARCH_CLOSE_FAILED', 'Potraga nije potvrđeno zatvorena. Učitaj trenutno stanje.');
        const after = await read();
        if (!current()) return changed();
        if (!after.ok) return after;
        if (after.podatak.remainingClosed) closeAttempt.current = null;
        return after.podatak.remainingClosed ? after
          : failure('REMAINING_SEARCH_CLOSE_NOT_CONFIRMED', 'Server nije potvrdio zatvaranje preostale potrage. Učitaj trenutno stanje.');
      }); });
  };
  const openOwnedReview = async (destination: '/nova' | '/pregled-zadatka') => {
    if (!canAct() || !potreba || potreba.pokrivenost.popunjeno !== 0 || preostalaPotragaZatvorena || potreba.stanje === 'ZATVORENA') return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.openEditConversation(potreba.id);
      if (!current()) return changed();
      if (!result.ok) return result;
      if (!sameId(result.podatak.needId, potreba.id) || !uuid(result.podatak.conversationId) || !positiveInteger(result.podatak.revision)
        || result.podatak.authoritative !== true || !['DRAFT', 'PUBLISHED', 'SELECTION'].includes(result.podatak.needStatus)) {
        return failure('NEED_EDIT_INVALID_RESPONSE', 'Otvaranje izmene nije potvrđeno. Učitaj Zadatak ponovo.');
      }
      if (result.podatak.revision !== potreba.revizija || (potreba.stanje === 'NACRT' && result.podatak.needStatus !== 'DRAFT')) {
        return failure('STALE_REVIEW_REQUIRED', 'Zadatak je promenjen. Učitaj trenutno stanje pre otvaranja izmene.');
      }
      navigate(() => router.push({ pathname: destination, params: { conversationId: result.podatak.conversationId } }));
      return { ok: true, podatak: editor.data! };
    });
  };
  const otvoriIzmenu = () => {
    if (!canAct() || !potreba) return;
    if (potreba.stanje === 'NACRT') { void openOwnedReview('/nova'); return; }
    ask('Izmena Zadatka', 'Izmene pregledaš pre objave. Prihvatanje nove verzije ponovo pokreće proveru za objavu i postojeće Prijave tada moraju da se osveže.',
      'Nastavi', async () => openOwnedReview('/nova'));
  };

  return <NeedPresentation key={`${potreba?.id ?? id}:${potreba?.revizija ?? ''}`} need={potreba} loading={ucitava}
    photos={potreba ? <NeedPhotos needId={potreba.id} owned={intent === 'narucilac'} /> : undefined}
    qaAction={potreba && intent === 'narucilac' ? <TaskQaEntry disabled={!canAct()}
      onPress={() => { if (canAct()) navigate(() => router.push({ pathname: '/pitanja-zadatka', params: { needId: potreba.id } })); }} /> : undefined}
    lifecycleActions={intent === 'narucilac' && uuid(id) ? <NeedLifecycleActions need={potreba} needId={id}
      disabled={akcijaUToku || ucitava || !!greska} onActiveChange={setTerminal} onRefresh={refresh} /> : undefined}
    error={greska} busy={akcijaUToku || terminalActive} ownerIntent={intent === 'narucilac'} remainingClosed={preostalaPotragaZatvorena}
    readiness={readiness}
    onBack={() => navigate(() => router.back())} onRefresh={refresh} onReview={() => { void openOwnedReview('/pregled-zadatka'); }} onEdit={otvoriIzmenu} onCloseRemaining={zatvoriPreostaluPotragu}
    onCandidates={() => navigate(() => router.push({ pathname: '/potrebe/[id]/kandidati', params: { id } }))} />;
}
