import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { STANJA_POTREBE, type PotrebaProjekcija } from '../../../../contracts/projections';
import type { Ishod } from '../../../../data/ports';
import { aiNeedV2Izvor } from '../../../../data';
import { failure, positiveInteger, sameId, uuid } from '../../../../data/serverReceipt';
import { knownRemainingSearchRefusal, ru4Production } from '../../../../data/ru4Production';
import { retainRemainingSearchCloseAttempt, type RemainingSearchCloseAttempt } from '../../../../data/remainingSearchCloseAttempt';
import { needPublicationReadiness, type NeedPublicationReadiness } from '../../../../data/needPublicationReadiness';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { NeedPresentation } from '../../../../ui/v2/NeedPresentation';
import { ResolvedPinMap } from '../../../../ui/location/ResolvedPinMap';
import { NeedPhotos } from '../../../../ui/media/ContextPhotos';
import { NeedLifecycleActions, needLifecycleEntries, type NeedLifecycleMenu } from '../../../../ui/needs/NeedLifecycleActions';
import type { SheetAction } from '../../../../ui/system/ActionSheet';
import { TaskQaEntry } from '../../../../ui/qa/TaskQaEntry';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { plural } from '../../../../ui/system/plural';
import { useConfirmSheet } from '../../../../ui/system/ConfirmSheet';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { useIzvor } from '../../../../store/uloga';

type Snapshot = { need: PotrebaProjekcija; remainingClosed: boolean };
const changed = () => failure('REVIEW_CHANGED', 'Ponovo otvori Zadatak i pregledaj trenutno stanje.');

export default function PregledPotrebe() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { user, accountRevision } = useSesija();
  return <OwnedNeed key={`${id}:${user?.id ?? ''}:${accountRevision}`} id={id} />;
}
function OwnedNeed({ id }: { id: string }) {
  const izvor = useIzvor();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const identity = useMemo(() => ({}), [id, izvor, accountId, accountRevision]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const focus = useRef<object | null>(null), life = useRef(0), navigating = useRef(false), dialog = useRef<object | null>(null);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [lifecycle, setLifecycle] = useState(0);
  const reading = useRef<object | null>(null);
  // An unconfirmed close keeps its command identity for the explicit retry; the
  // owner remounts on id/account, so the attempt never outlives them.
  const closeAttempt = useRef<RemainingSearchCloseAttempt | null>(null);
  const [terminalActive, setTerminalActive] = useState(false);
  const terminalActiveRef = useRef(false);
  const setTerminal = useCallback((active: boolean) => { terminalActiveRef.current = active; setTerminalActive(active); }, []);
  // Wherever the screen retires `dialog.current`, the open question it belonged to leaves the screen too.
  const confirmSheet = useConfirmSheet(), retireConfirmation = confirmSheet.close;
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; life.current++; navigating.current = false;
    foreground.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (active === foreground.current) return;
      foreground.current = active; life.current++; dialog.current = null; retireConfirmation();
      setLifecycle(value => value + 1);
    });
    return () => { subscription.remove(); if (focus.current === scope) focus.current = null;
      life.current++; dialog.current = null; retireConfirmation(); };
  }, [identity, retireConfirmation]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const owner = focus.current, generation = life.current, invocation = {};
    reading.current = invocation;
    const current = () => owner !== null && focus.current === owner && foreground.current && life.current === generation
      && reading.current === invocation
      && latestIdentity.current === identity && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision;
    const load = async (): Promise<Ishod<Snapshot>> => {
      if (!current()) return changed();
      if (!uuid(id)) return failure('NEED_REQUIRED', 'Zadatak nije izabran.');
      const need = await izvor.potreba(id);
      if (!current()) return changed();
      if (!need || !sameId(need.id, id) || !positiveInteger(need.revizija) || !STANJA_POTREBE.includes(need.stanje)) {
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
  }, [id, identity, izvor, accountId, accountRevision, lifecycle]);
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
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  useEffect(() => {
    setReadiness(null);
    // Gated on the app's mode, this once never ran for an owner standing in the other mode, so his own draft answered
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
  }, [potreba?.id, potreba?.revizija, potreba?.stanje, identity, lifecycle]);
  // This screen shows a Zadatak returned by the owner-only read, so whoever sees it owns it; the
  // server checks that again on every command. No app-wide mode stands in for that any more.
  const canAct = () => current() && !terminalActiveRef.current && !navigating.current && !editor.loading && !editor.busy && !editor.uncertain && !!editor.data;
  const navigate = (action: () => void) => { if (!current() || navigating.current) return;
    dialog.current = null; retireConfirmation(); navigating.current = true; action(); };
  const refresh = () => { if (!current() || editor.busy) return; dialog.current = null; retireConfirmation();
    void editor.refresh(); };
  // `danger` for a question whose confirm cannot be undone (closing the search), drawn like izvoz's withdrawals.
  const ask = (title: string, description: string, label: string, tone: 'default' | 'danger', command: () => Promise<void>) => {
    if (!canAct() || dialog.current) return;
    const confirmation = {}; dialog.current = confirmation;
    const cancel = () => { if (dialog.current === confirmation) dialog.current = null; };
    // The sheet waits on the command it started (a busy confirm; Back returns after a few seconds without cancelling it)
    // and shows no outcome of its own.
    confirmSheet.ask({ title, message: description, cancelLabel: 'Odustani', onCancel: cancel, confirmLabel: label, tone,
      onConfirm: () => { if (dialog.current !== confirmation || !canAct()) return;
        dialog.current = null; return command(); } });
  };
  const zatvoriPreostaluPotragu = () => {
    if (!canAct() || !potreba || preostalaPotragaZatvorena || potreba.pokrivenost.popunjeno <= 0 || potreba.pokrivenost.preostalo <= 0) return;
    // "za preostalih 1 mesta" counted the English way; the case follows the number.
    ask('Ne traži više nikoga?', `Zatvorićemo potragu za ${plural(potreba.pokrivenost.preostalo, 'preostalo mesto', 'preostala mesta', 'preostalih mesta')}. Postojeći Dogovori i originalni uslovi Zadatka ostaju nepromenjeni.`,
      'Zatvori potragu', 'danger', async () => { await editor.save(async () => {
        const attempt = retainRemainingSearchCloseAttempt(closeAttempt.current, potreba.id, potreba.revizija, () => noviZahtevId('zatvori-preostalu-potragu'));
        closeAttempt.current = attempt;
        const result = await ru4Production.closeRemainingSearch(attempt.needId, attempt.revision, attempt.clientRequestId);
        if (!current()) return changed();
        if (!result.ok) return knownRemainingSearchRefusal(result.kod) ? result
          : failure('REMAINING_SEARCH_CLOSE_FAILED', 'Potraga nije potvrđeno zatvorena. Učitaj trenutno stanje.');
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
      'Nastavi', 'default', async () => openOwnedReview('/nova'));
  };
  // Cancelling and deleting sit behind the screen's "···" (owner step 5b, 2026-09-24). The menu only knocks: each press
  // passes this screen's fence and then the lifecycle's own guards, and the lifecycle asks, sends, persists and recovers
  // exactly as it did inline.
  const lifecycleMenu = useRef<NeedLifecycleMenu | null>(null);
  const entries = needLifecycleEntries(potreba);
  const lifecycleMenuActions: SheetAction[] = [
    ...(entries.agreements ? [{ key: 'agreements', label: 'Otvori moje Dogovore', icon: 'agreements' as const, hint: 'Postojeći Dogovori se otkazuju zasebno.',
      onPress: () => { if (canAct()) lifecycleMenu.current?.openAgreements(); } }] : []),
    ...(entries.deleteDraft ? [{ key: 'delete-draft', label: 'Obriši nacrt', icon: 'document' as const, destructive: true,
      onPress: () => { if (canAct()) lifecycleMenu.current?.request('DELETE_DRAFT'); } }] : []),
    ...(entries.cancel ? [{ key: 'cancel', label: 'Otkaži zadatak', icon: 'tasks' as const, destructive: true,
      onPress: () => { if (canAct()) lifecycleMenu.current?.request('CANCEL'); } }] : []),
  ];

  return <><NeedPresentation key={`${potreba?.id ?? id}:${potreba?.revizija ?? ''}`} need={potreba} loading={ucitava}
    photos={potreba ? <NeedPhotos needId={potreba.id} owned /> : undefined}
    map={potreba?.priblizno
      ? <ResolvedPinMap position={{ latitude: potreba.priblizno.lat, longitude: potreba.priblizno.lng }} coarse disabled height={184}
        onChoose={() => {}} scopeKey={`potreba:${potreba.id}:${potreba.revizija}:${potreba.priblizno.lat}:${potreba.priblizno.lng}`} />
      : undefined}
    qaAction={potreba ? <TaskQaEntry disabled={!canAct()}
      onPress={() => { if (canAct()) navigate(() => router.push({ pathname: '/pitanja-zadatka', params: { needId: potreba.id, own: '1' } })); }} /> : undefined}
    lifecycleActions={uuid(id) ? <NeedLifecycleActions need={potreba} needId={id} menu={lifecycleMenu}
      disabled={akcijaUToku || ucitava || !!greska} onActiveChange={setTerminal} onRefresh={refresh} /> : undefined}
    lifecycleMenu={lifecycleMenuActions}
    error={greska} busy={akcijaUToku || terminalActive} remainingClosed={preostalaPotragaZatvorena}
    readiness={readiness}
    // Opened from a notification on a cold start there is nothing behind this screen; the arrow then
    // lands on the person's own tasks instead of doing nothing.
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/potrebe'))} onRefresh={refresh} onReview={() => { void openOwnedReview('/pregled-zadatka'); }} onEdit={otvoriIzmenu} onCloseRemaining={zatvoriPreostaluPotragu}
    onCandidates={() => navigate(() => router.push({ pathname: '/potrebe/[id]/kandidati', params: { id } }))} />{confirmSheet.sheet}</>;
}
