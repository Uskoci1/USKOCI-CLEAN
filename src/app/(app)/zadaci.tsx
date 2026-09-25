import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../../data/marketplaceView';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { DiscoveryPresentation } from '../../ui/v2/DiscoveryPresentation';

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
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }));
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    // Publish the focus token as state, exactly as Početna does. A ref written inside an effect
    // re-renders nothing, so a screen that read it during render kept the token of its FIRST
    // visit: come back to the screen and the guard compared an old token against a new one and
    // refused every press, silently, for the rest of that screen's life.
    setScope(owner);
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const load = useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([source.otvorenePrilike(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load, { coalesce: true });
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
    if (latest.loading || latest.error || !latest.data?.some(row => row.id === item.id)) return;
    const owned = latestRelations.current.data?.relation(item.id).kind === 'OWNER';
    navigate(() => router.navigate({ pathname: owned ? '/potrebe/[id]/pregled' : '/prilike/[id]', params: { id: item.id } }));
  };
  // Looking for work, seeing my own tasks and publishing a new one are three things one account
  // does; none of them switches the app into another mode first (owner decision 1, 2026-09-19).
  return <DiscoveryPresentation items={resource.data ?? []} loading={resource.loading} refreshing={resource.refreshing || relations.refreshing} error={!!resource.error}
      scopeKey={`${user?.id ?? ''}:${accountRevision}`} view={view} relations={relations.data ?? undefined} relationsPending={relationsPending}
      relationsError={relations.error}
      onView={next => { if (current()) setView(next); }} onRefresh={() => {
        if (current()) { void resource.refresh(true); void relations.refresh(true); }
      }} onOpen={open}
      onProfile={() => navigate(() => router.navigate('/profil'))}
      onNotifications={() => navigate(() => router.navigate('/obavestenja'))}
      onNew={() => navigate(() => router.navigate('/nova'))} />;
}
