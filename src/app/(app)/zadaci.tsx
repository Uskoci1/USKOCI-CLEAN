import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { initialMarketplaceView, publicPoint, type MarketplaceItem, type MarketplaceView } from '../../data/marketplaceView';
import { sameId } from '../../data/serverReceipt';
import { publicationIsCurrent, readPublicationHandoff } from '../../data/publicationHandoff';
import type { TaskRelationIndex } from '../../data/taskRelation';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { DiscoveryPresentation, type DiscoveryTrace } from '../../ui/v2/DiscoveryPresentation';

/**
 * Zadaci, the middle tab: open tasks with this account's relationship labeled (Početna | Zadaci |
 * Dogovori). The Mapa tab and the root `/prilike` used to show this same discovery twice, under two names; both
 * addresses now redirect here, so an old notification, a remembered route or a deep link still lands on it. Since owner
 * step 4 (2026-09-24) the map and the list are one screen: the map under a list sheet (DiscoveryPresentation).
 */
export default function Zadaci() {
  const { user, accountRevision } = useSesija();
  return <Discovery key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function Discovery() {
  const params = useLocalSearchParams<{ discoveryTrace?: string; publishedNeedId?: string | string[];
    publishedRevision?: string | string[]; publishedHandoff?: string | string[] }>();
  const handoff = readPublicationHandoff(params);
  const publishedNeedId = handoff?.needId ?? null;
  // Bounded native diagnosis only: the gallery's package gate, narrowed to this exact DEV package.
  // No __DEV__ override, persisted flag, UI entry, identifiers, free text or native event objects.
  const traceEnabled = Constants.expoConfig?.android?.package === 'rs.uskoci.dev' && params.discoveryTrace === '1';
  const traceGate = useRef(traceEnabled); traceGate.current = traceEnabled;
  const traceCount = useRef(0);
  const traceSamples = useRef(0);
  const trace = useCallback<DiscoveryTrace>((event, ...values) => {
    if (!traceGate.current || traceCount.current >= 120 || !TRACE_EVENTS.has(event) || values.length > 20
      || values.some(value => typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value)))) return;
    // A swipe/initial map layout cannot consume the allowance reserved for opening and returning.
    if (TRACE_SAMPLES.has(event)) { if (traceSamples.current >= 32) return; traceSamples.current++; }
    const safe = values.map(value => typeof value === 'boolean' ? value : Math.round(Math.max(-10_000_000, Math.min(10_000_000, value)) * 10) / 10);
    console.info(`[USKOCI_DISCOVERY_TRACE] ${JSON.stringify([++traceCount.current, event, ...safe])}`);
  }, []);
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }));
  const publicationToken = handoff?.token ?? null;
  const publicationRequested = useRef<string | null>(null);
  const publicationCompleted = useRef<string | null>(null);
  const [publication, setPublication] = useState<{ token: string; id: string; status: 'loading' | 'read' | 'map' | 'list' | 'missing' | 'error' } | null>(null);
  const traceView = useRef(view); traceView.current = view;
  useEffect(() => { if (traceEnabled) trace('route-trace', traceView.current.listOffset ?? 0, traceSheet(traceView.current)); }, [traceEnabled, trace]);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    trace('route-focus', traceView.current.listOffset ?? 0, traceSheet(traceView.current));
    // Publish the focus token as state, exactly as Početna does. A ref written inside an effect
    // re-renders nothing, so a screen that read it during render kept the token of its FIRST
    // visit: come back to the screen and the guard compared an old token against a new one and
    // refused every press, silently, for the rest of that screen's life.
    setScope(owner);
    return () => { trace('route-blur', traceView.current.listOffset ?? 0, traceSheet(traceView.current)); if (focus.current === owner) focus.current = null;
      // A read retired by blur must be requested again on the next focus. A completed landing
      // stays consumed, so returning from its detail keeps the person's map/list position.
      if (publicationRequested.current === publicationToken && publicationCompleted.current !== publicationToken)
        publicationRequested.current = null;
    };
  }, [trace, publicationToken]));
  const load = useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([source.otvorenePrilike(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load, { coalesce: true });
  // The public list may still contain the snapshot from a previous visit. A publication handoff waits
  // for one fresh public read before it claims that the task has a pin or is in Discovery at all.
  useEffect(() => {
    if (!handoff || !publicationIsCurrent(handoff) || !publicationToken || !publishedNeedId
      || !scope || focus.current !== scope || publicationRequested.current === publicationToken) return;
    publicationRequested.current = publicationToken;
    setPublication({ token: publicationToken, id: publishedNeedId, status: 'loading' });
    void resource.refresh(true).then(() => {
      if (publicationIsCurrent(handoff) && publicationRequested.current === publicationToken && focus.current === scope
        && sesijaSada().user?.id === user?.id && sesijaSada().accountRevision === accountRevision)
        setPublication({ token: publicationToken, id: publishedNeedId, status: 'read' });
    });
  }, [handoff, publicationToken, publishedNeedId, scope, resource.refresh, user?.id, accountRevision, publication?.status]);
  useEffect(() => {
    if (!handoff || !publicationIsCurrent(handoff) || !publication || publication.status !== 'read'
      || publication.token !== publicationToken || resource.loading || resource.refreshing) return;
    if (!scope || focus.current !== scope || sesijaSada().user?.id !== user?.id || sesijaSada().accountRevision !== accountRevision) return;
    if (resource.error || !resource.data) { setPublication({ ...publication, status: 'error' }); return; }
    const item = resource.data.find(row => sameId(row.id, publication.id));
    if (!item) { setPublication({ ...publication, status: 'missing' }); return; }
    const status = publicPoint(item) ? 'map' : 'list';
    setView({ ...initialMarketplaceView(), mode: 'map', selectedId: status === 'map' ? item.id : null,
      sheet: status === 'map' ? 'peek' : 'full', listOffset: 0 });
    setPublication({ ...publication, id: item.id, status });
  }, [handoff, publication, publicationToken, resource.loading, resource.refreshing, resource.error, resource.data, scope, user?.id, accountRevision]);
  useEffect(() => {
    if (publication?.token === publicationToken && (publication.status === 'map' || publication.status === 'list')
      && scope && focus.current === scope) publicationCompleted.current = publicationToken;
  }, [publication, publicationToken, scope]);
  // Which of these tasks are mine and which I have applied to: labels only, read beside the list so
  // that a failure here costs the labels and never the list. Since PKG-023b it is one bounded call
  // for the tasks actually on this page, instead of my whole task list and my whole application
  // list; the server answers for those ids and says nothing about any other task.
  const visible = (resource.data ?? []).map(row => row.id).join(',');
  // The same 15 s limit as the list read: a read that never answers is a failed read, not one still running, so it costs
  // the labels and never the count, the sheet's start or the map (review r3b).
  const loadRelations = useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([source.odnosiPremaZadacima(visible ? visible.split(',') : []), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('TASK_RELATIONS_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source, visible]);
  const relations = useFocusedResource(loadRelations, { coalesce: true });
  const labeledRelations = useMemo<TaskRelationIndex | undefined>(() => {
    const base = relations.data ?? undefined;
    const ownRow = handoff && resource.data?.find(item => sameId(item.id, handoff.needId));
    if (!ownRow) return base;
    // Reuse the existing "Tvoj zadatak" presentation for this proved owner. Other relationships stay unknown
    // until their own read returns; the handoff never invents an application or changes marketplace membership.
    return { owned: new Set([...(base?.owned ?? []), ownRow.id]), applied: base?.applied ?? new Set<string>(),
      relation: id => id === ownRow.id ? { kind: 'OWNER' } : base?.relation(id) ?? { kind: 'UNKNOWN' } };
  }, [relations.data, handoff, resource.data]);
  // Ownership is an overlay, never a visibility filter. A missing answer stays unknown while the
  // public rows, counts and map remain usable. Every explicit refresh retries both reads, even if
  // the public task IDs did not change since a failed overlay read.
  const relationsPending = relations.loading || relations.refreshing;
  const latestResource = useRef(resource); latestResource.current = resource;
  const latestRelations = useRef(relations); latestRelations.current = relations;
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  const open = (item: MarketplaceItem) => {
    const latest = latestResource.current;
    trace('route-open', current(), navigating.current, latest.loading, !!latest.error, traceView.current.listOffset ?? 0, traceSheet(traceView.current));
    if (latest.loading || latest.error || !latest.data?.some(row => row.id === item.id)) return;
    // The canonical owner read on the review screen already proved this one relationship. A slow or failed
    // optional relation overlay must not send the publisher through somebody else's public-detail path.
    const owned = (!!handoff && publicationIsCurrent(handoff) && sameId(item.id, handoff.needId))
      || latestRelations.current.data?.relation(item.id).kind === 'OWNER';
    navigate(() => router.navigate({ pathname: owned ? '/potrebe/[id]/pregled' : '/prilike/[id]', params: { id: item.id } }));
  };
  // Looking for work, seeing my own tasks and publishing a new one are three things one account
  // does; none of them switches the app into another mode first (owner decision 1, 2026-09-19).
  return <DiscoveryPresentation items={resource.data ?? []} loading={resource.loading} refreshing={resource.refreshing || relations.refreshing} error={!!resource.error}
      scopeKey={`${user?.id ?? ''}:${accountRevision}`} view={view} relations={labeledRelations} relationsPending={relationsPending}
      relationsError={relations.error}
      publicationFocus={publication?.token === publicationToken && (publication.status === 'map' || publication.status === 'list')
        ? { token: publication.token, id: publication.id, kind: publication.status } : undefined}
      publicationUnavailable={publication?.token === publicationToken && (publication.status === 'missing' || publication.status === 'error')
        ? publication.status : undefined}
      onOpenPublishedTask={handoff && publication?.token === publicationToken && publication.id ? () => {
        if (publicationIsCurrent(handoff)) navigate(() => router.navigate({
          pathname: '/potrebe/[id]/pregled', params: { id: handoff.needId },
        }));
      } : undefined}
      trace={traceEnabled ? trace : undefined}
      onView={next => { const accepted = current(); trace('route-view', accepted, traceView.current.listOffset ?? 0, next.listOffset ?? 0, traceSheet(next)); if (accepted) setView(next); }} onRefresh={() => {
        if (current()) {
          if (publication?.token === publicationToken && (publication.status === 'missing' || publication.status === 'error')) {
            publicationRequested.current = null;
            setPublication(null); // the publication effect starts one fresh public read and re-evaluates its row
          } else void resource.refresh(true);
          void relations.refresh(true);
        }
      }} onOpen={open}
      onProfile={() => navigate(() => router.navigate('/profil'))}
      onNotifications={() => navigate(() => router.navigate('/obavestenja'))}
      onNew={() => navigate(() => router.navigate('/nova'))} />;
}

const traceSheet = (view: MarketplaceView) => view.sheet === 'full' ? 2 : view.sheet === 'half' ? 1 : view.sheet === 'peek' ? 0 : -1;
const TRACE_EVENTS = new Set<Parameters<DiscoveryTrace>[0]>(['route-trace', 'route-focus', 'route-blur', 'route-open', 'route-view',
  'focus', 'blur', 'preopen', 'write-offset', 'seed', 'ready', 'geometry', 'index', 'content', 'layout',
  'restore-check', 'clamp0', 'request', 'ack', 'scroll0', 'scroll', 'scroll-reject', 'search-change', 'fold', 'drag', 'refresh']);
const TRACE_SAMPLES = new Set<Parameters<DiscoveryTrace>[0]>(['scroll', 'scroll0', 'scroll-reject', 'restore-check', 'content', 'layout', 'geometry']);
