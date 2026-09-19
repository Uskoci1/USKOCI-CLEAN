import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { readHomeSection } from '../../data/homeSnapshot';
import { initialMarketplaceView, type MarketplaceItem } from '../../data/marketplaceView';
import { relationIndex } from '../../data/taskRelation';
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
  const [view, setView] = useState(() => ({ ...initialMarketplaceView(), mode: initialMode }));
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const load = useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([source.otvorenePrilike(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  // Which of these tasks are mine and which I have applied to: labels only, read beside the list so
  // that a failure here costs the labels and never the list. Both reads are account-scoped.
  const loadRelations = useCallback(async () => {
    const [needs, applications] = await Promise.all([readHomeSection(() => source.mojePotrebe()), readHomeSection(() => source.mojePrijave())]);
    return relationIndex({ needs, applications });
  }, [source]);
  const relations = useFocusedResource(loadRelations);
  const resource = useFocusedResource(load), scope = focus.current;
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
