import { PublicNeedPresentation } from '../../../ui/v2/PublicNeedPresentation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useIzvor, useUloga, ulogaSada } from '../../../store/uloga';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import type { PrilikaProjekcija } from '../../../contracts/projections';

type ActionScope = { id: string | null; accountId: string | undefined; epoch: number; intent: ReturnType<typeof useUloga>; busy: boolean; refreshing: boolean };

export default function PrilikaDetaljiEkran() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = typeof params.id === 'string' && params.id.trim() ? params.id : null;
  const router = useRouter();
  const izvor = useIzvor();
  const intent = useUloga();
  const { user, sessionEpoch: epoch } = useSesija();
  const accountId = user?.id;
  const readRequest = useRef(0);
  const readCancellations = useRef(new Set<() => void>());
  const load = useCallback(async () => {
    const request = ++readRequest.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    let prilika: PrilikaProjekcija | null;
    try {
      prilika = id ? await Promise.race([izvor.prilika(id), new Promise<never>((_, reject) => {
        cancel = () => reject(new Error('TASK_READ_RETIRED'));
        readCancellations.current.add(cancel);
        timer = setTimeout(() => reject(new Error('TASK_READ_TIMEOUT')), 15_000);
      })]) : null;
    } finally { if (timer !== undefined) clearTimeout(timer); if (cancel) readCancellations.current.delete(cancel); }
    if (sesijaSada().sessionEpoch !== epoch || sesijaSada().user?.id !== accountId) throw new Error('STALE_TASK_READ');
    return { prilika, request };
  }, [id, izvor, accountId, epoch]);
  useEffect(() => () => { readCancellations.current.forEach(cancel => cancel()); readCancellations.current.clear(); }, [load]);
  const resource = useFocusedResource(load);
  // The cache is display-only and cannot survive a task, account, session or intent change.
  const cache = useMemo(() => ({ data: null as PrilikaProjekcija | null }), [load, intent]);
  const fresh = resource.data?.prilika?.id === id ? resource.data.prilika : null;
  const deadlineAt = fresh?.rokZaPrijaveIso === null ? null
    : typeof fresh?.rokZaPrijaveIso === 'string' ? Date.parse(fresh.rokZaPrijaveIso) : undefined;
  const [deadlineTick, setDeadlineTick] = useState(0);
  const deadlineOpen = () => deadlineAt === null || (typeof deadlineAt === 'number' && deadlineAt > Date.now());
  useFocusEffect(useCallback(() => {
    if (typeof deadlineAt !== 'number' || !Number.isFinite(deadlineAt)) return;
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) return;
    // Long deadlines are rechecked before scheduling another bounded timer.
    const timer = setTimeout(() => setDeadlineTick(tick => tick + 1), Math.min(remaining, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [deadlineAt, deadlineTick]));
  useEffect(() => {
    if (!resource.loading && !resource.error) cache.data = fresh;
  }, [cache, fresh, resource.loading, resource.error]);
  const prilika = fresh ?? ((resource.loading || resource.error) ? cache.data : null);
  const scopeRef = useRef<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope = { id, accountId, epoch, intent, busy: false, refreshing: false };
    scopeRef.current = scope;
    setBusy(false);
    return () => { if (scopeRef.current === scope) scopeRef.current = null; };
  }, [id, accountId, epoch, intent]));

  function currentScope() {
    const scope = scopeRef.current;
    const session = sesijaSada();
    if (!scope || scope.id !== id || scope.accountId !== accountId || scope.epoch !== epoch || scope.intent !== intent
      || !accountId || session.user?.id !== accountId || session.sessionEpoch !== epoch || ulogaSada() !== intent) return null;
    return scope;
  }

  function navigate(action: () => void) {
    const scope = currentScope();
    if (!scope || scope.busy) return;
    scope.busy = true;
    setBusy(true);
    action();
  }

  function retry() {
    const scope = currentScope();
    if (!scope || scope.busy || scope.refreshing) return;
    scope.refreshing = true;
    void resource.refresh().finally(() => { if (scopeRef.current === scope) scope.refreshing = false; });
  }

  function compose() {
    // A saved press from before refresh/blur/id/account change cannot navigate.
    if (!fresh || resource.loading || resource.error || resource.data?.request !== readRequest.current
      || fresh.primaNovePrijave !== true || !deadlineOpen() || intent !== 'uskocer') return;
    navigate(() => router.navigate({ pathname: '/prilike/[id]/prijava', params: { id: fresh.id } }));
  }

  return <PublicNeedPresentation key={`${accountId}:${epoch}:${intent}:${id}`}
    need={prilika} loading={!!id && resource.loading} error={!!resource.error} missing={!fresh}
    stale={!!prilika && (resource.loading || !!resource.error)} busy={busy} canRetry={!!id}
    canApply={!!fresh && fresh.primaNovePrijave === true && deadlineOpen() && intent === 'uskocer'}
    back={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/prilike'))}
    retry={retry} apply={compose} />;
}
