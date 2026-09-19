import { PublicNeedPresentation } from '../../../ui/v2/PublicNeedPresentation';
import { NeedPhotos, ProfilePhoto } from '../../../ui/media/ContextPhotos';
import { TaskQaEntry } from '../../../ui/qa/TaskQaEntry';
import type { PublicProfileState } from '../../../ui/system/PublicProfileSheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useIzvor } from '../../../store/uloga';
import { readHomeSection } from '../../../data/homeSnapshot';
import { taskRelation, type TaskRelation } from '../../../data/taskRelation';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import type { PrilikaProjekcija } from '../../../contracts/projections';

type ActionScope = { id: string | null; accountId: string | undefined; epoch: number; busy: boolean; refreshing: boolean };

export default function PrilikaDetaljiEkran() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = typeof params.id === 'string' && params.id.trim() ? params.id : null;
  const router = useRouter();
  const izvor = useIzvor();
  const { user, sessionEpoch: epoch } = useSesija();
  const accountId = user?.id;
  const readRequest = useRef(0);
  const readCancellations = useRef(new Set<() => void>());
  const load = useCallback(async () => {
    const request = ++readRequest.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    let prilika: PrilikaProjekcija | null;
    // What I am to this task is read beside the task, from my own tasks and my own applications.
    // It can fail on its own without taking the task with it; it then reads as UNKNOWN, never NONE.
    const relationReads = id ? Promise.all([readHomeSection(() => izvor.mojePotrebe()), readHomeSection(() => izvor.mojePrijave())]) : null;
    try {
      prilika = id ? await Promise.race([izvor.prilika(id), new Promise<never>((_, reject) => {
        cancel = () => reject(new Error('TASK_READ_RETIRED'));
        readCancellations.current.add(cancel);
        timer = setTimeout(() => reject(new Error('TASK_READ_TIMEOUT')), 15_000);
      })]) : null;
    } finally { if (timer !== undefined) clearTimeout(timer); if (cancel) readCancellations.current.delete(cancel); }
    if (sesijaSada().sessionEpoch !== epoch || sesijaSada().user?.id !== accountId) throw new Error('STALE_TASK_READ');
    const [needs, applications] = relationReads ? await relationReads : [{ kind: 'unavailable' as const }, { kind: 'unavailable' as const }];
    if (sesijaSada().sessionEpoch !== epoch || sesijaSada().user?.id !== accountId) throw new Error('STALE_TASK_READ');
    const relation: TaskRelation = id ? taskRelation(id, { needs, applications }) : { kind: 'UNKNOWN' };
    return { prilika, request, relation };
  }, [id, izvor, accountId, epoch]);
  useEffect(() => () => { readCancellations.current.forEach(cancel => cancel()); readCancellations.current.clear(); }, [load]);
  const resource = useFocusedResource(load);
  // The cache is display-only and cannot survive a task, account, session or intent change.
  const cache = useMemo(() => ({ data: null as PrilikaProjekcija | null }), [load]);
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
  const relation: TaskRelation = fresh && resource.data ? resource.data.relation : { kind: 'UNKNOWN' };
  const scopeRef = useRef<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope = { id, accountId, epoch, busy: false, refreshing: false };
    scopeRef.current = scope;
    setBusy(false);
    return () => { if (scopeRef.current === scope) scopeRef.current = null; };
  }, [id, accountId, epoch]));

  function currentScope() {
    const scope = scopeRef.current;
    const session = sesijaSada();
    if (!scope || scope.id !== id || scope.accountId !== accountId || scope.epoch !== epoch
      || !accountId || session.user?.id !== accountId || session.sessionEpoch !== epoch) return null;
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
      || fresh.primaNovePrijave !== true || !deadlineOpen() || relation.kind !== 'NONE') return;
    navigate(() => router.navigate({ pathname: '/prilike/[id]/prijava', params: { id: fresh.id } }));
  }

  // Owner decision 3 (2026-09-16): the requester's public profile is a sheet over the
  // existing `javniProfil` read; opened only by an explicit press, retired with the scope.
  const [requesterProfile, setRequesterProfile] = useState<PublicProfileState>(null);
  const profileRequest = useRef(0);
  useEffect(() => { profileRequest.current++; setRequesterProfile(null); }, [id, accountId, epoch]);
  useEffect(() => () => { profileRequest.current++; }, []);
  function openRequesterProfile() {
    const scope = currentScope();
    if (!scope || !fresh || resource.data?.request !== readRequest.current || requesterProfile?.loading) return;
    const request = ++profileRequest.current, profileId = fresh.narucilacProfilId;
    setRequesterProfile({ loading: true, data: null });
    void izvor.javniProfil(profileId)
      .then(value => { if (request === profileRequest.current && currentScope()) setRequesterProfile({ loading: false, data: value?.profilId === profileId ? value : null }); })
      .catch(() => { if (request === profileRequest.current && currentScope()) setRequesterProfile({ loading: false, data: null }); });
  }
  function closeRequesterProfile() { profileRequest.current++; setRequesterProfile(null); }

  return <PublicNeedPresentation key={`${accountId}:${epoch}:${id}`}
    qa={fresh && !resource.loading && !resource.error ? <TaskQaEntry disabled={busy} onPress={() => {
      if (resource.data?.request !== readRequest.current || !currentScope()) return;
      navigate(() => router.navigate({ pathname: '/pitanja-zadatka', params: { needId: fresh.id, own: '0' } }));
    }} /> : undefined}
    photos={fresh && !resource.loading && !resource.error ? <NeedPhotos needId={fresh.id} /> : undefined}
    need={prilika} loading={!!id && resource.loading} error={!!resource.error} missing={!fresh}
    stale={!!prilika && (resource.loading || !!resource.error)} busy={busy} canRetry={!!id}
    canApply={!!fresh && fresh.primaNovePrijave === true && deadlineOpen() && relation.kind === 'NONE'}
    relation={fresh ? relation : { kind: 'UNKNOWN' }}
    onOwnTask={() => { if (fresh && relation.kind === 'OWNER') navigate(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: fresh.id } })); }}
    onOwnApplication={() => { if (relation.kind !== 'APPLIED') return;
      const { agreementId, applicationId } = relation;
      navigate(() => agreementId ? router.navigate({ pathname: '/dogovor/[id]', params: { id: agreementId } })
        : router.navigate({ pathname: '/moje-prijave', params: { prijavaId: applicationId } })); }}
    back={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/mapa'))}
    retry={retry} apply={compose}
    onRequesterProfile={fresh ? openRequesterProfile : undefined} requesterProfile={requesterProfile} onCloseRequesterProfile={closeRequesterProfile}
    publicPhoto={profileId => <ProfilePhoto profileId={profileId} size={96} initial={null} />} />;
}
