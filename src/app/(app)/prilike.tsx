import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { initialMarketplaceView, type MarketplaceItem } from '../../data/marketplaceView';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

export default function Prilike({ initialMode = 'list' }: { initialMode?: 'map' | 'list' } = {}) {
  const { user, accountRevision } = useSesija();
  return <OwnedCollection key={`${user?.id ?? ''}:${accountRevision}`} initialMode={initialMode} />;
}
function OwnedCollection({ initialMode }: { initialMode: 'map' | 'list' }) {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState(() => ({ ...initialMarketplaceView(), mode: initialMode }));
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
  const resource = useFocusedResource(load);
  // Which of these tasks are mine and which I have applied to: labels only, read beside the list so
  // that a failure here costs the labels and never the list. Since PKG-023b it is one bounded call
  // for the tasks actually on this page, instead of my whole task list and my whole application
  // list; the server answers for those ids and says nothing about any other task.
  const visible = (resource.data ?? []).map(row => row.id).join(',');
  const loadRelations = useCallback(() => source.odnosiPremaZadacima(visible ? visible.split(',') : []), [source, visible]);
  const relations = useFocusedResource(loadRelations);
  const latestResource = useRef(resource); latestResource.current = resource;
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  const open = (item: MarketplaceItem) => {
    const latest = latestResource.current;
    if (latest.loading || latest.error || !latest.data?.some(row => row.id === item.id)) return;
    navigate(() => router.navigate({ pathname: '/prilike/[id]', params: { id: item.id } }));
  };
  // Looking for work, seeing my own tasks and publishing a new one are three things one account
  // does; none of them switches the app into another mode first (owner decision 1, 2026-09-19).
  return <MarketplacePresentation owned={false} items={resource.data ?? []} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
      scopeKey={`${user?.id ?? ''}:${accountRevision}`} view={view} relations={relations.data ?? undefined}
      onView={next => { if (current()) setView(next); }} onRefresh={() => { if (current()) void resource.refresh(true); }} onOpen={open}
      onSwitch={() => navigate(() => router.navigate('/potrebe'))} onProfile={() => navigate(() => router.navigate('/profil'))}
      onNew={() => navigate(() => router.navigate('/nova'))} />;
}
