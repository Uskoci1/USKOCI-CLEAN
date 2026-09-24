import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { initialMarketplaceView, type MarketplaceItem } from '../../data/marketplaceView';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

export default function Potrebe() {
  const { user, accountRevision } = useSesija();
  return <OwnedCollection key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function OwnedCollection() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState(initialMarketplaceView);
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
    try { return await Promise.race([source.mojePotrebe(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load);
  const latestResource = useRef(resource); latestResource.current = resource;
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  // Only a task of the latest successful read opens, and only once per visit: a stale card from before a refresh is
  // refused like a blurred or backgrounded screen.
  const known = (item: MarketplaceItem) => {
    const latest = latestResource.current;
    return !latest.loading && !latest.error && !!latest.data?.some(row => row.id === item.id);
  };
  const open = (item: MarketplaceItem) => {
    if (known(item)) navigate(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: item.id } }));
  };
  // The card's foot goes straight to the applications that wait for my choice, the same entry Početna and the
  // notifications use; that screen owns its own read and guards.
  const applications = (item: MarketplaceItem) => {
    if (known(item)) navigate(() => router.navigate({ pathname: '/potrebe/[id]/kandidati', params: { id: item.id } }));
  };
  return <MarketplacePresentation owned={true} items={resource.data ?? []} loading={resource.loading} refreshing={resource.refreshing} error={!!resource.error}
    scopeKey={`${user?.id ?? ''}:${accountRevision}`} view={view}
    onView={next => { if (current()) setView(next); }} onRefresh={() => { if (current()) void resource.refresh(true); }} onOpen={open}
    onApplications={applications}
    onProfile={() => navigate(() => router.navigate('/profil'))}
    onBack={() => navigate(() => { if (router.canGoBack()) router.back(); else router.replace('/'); })}
    onNew={() => navigate(() => router.navigate('/nova'))} />;
}
