import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { initialMarketplaceView, type MarketplaceItem } from '../../data/marketplaceView';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, ulogaSada, useIzvor, useUloga } from '../../store/uloga';
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

export default function Potrebe() {
  const { user, accountRevision } = useSesija(), intent = useUloga();
  return <OwnedCollection key={`${user?.id ?? ''}:${accountRevision}:${intent}`} />;
}
function OwnedCollection() {
  const source = useIzvor(), intent = useUloga(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [view, setView] = useState(initialMarketplaceView);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const load = useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([source.mojePotrebe(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load), scope = focus.current;
  const latestResource = useRef(resource); latestResource.current = resource;
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  const open = (item: MarketplaceItem) => {
    const latest = latestResource.current;
    if (latest.loading || latest.error || !latest.data?.some(row => row.id === item.id)) return;
    navigate(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: item.id } }));
  };
  return <MarketplacePresentation owned={true} items={resource.data ?? []} loading={resource.loading} error={!!resource.error}
    scopeKey={`${user?.id ?? ''}:${accountRevision}:${intent}`} view={view}
    onView={next => { if (current()) setView(next); }} onRefresh={() => { if (current()) void resource.refresh(); }} onOpen={open}
    onSwitch={() => navigate(() => router.navigate('/prilike'))} onProfile={() => navigate(() => router.navigate('/profil'))}
    onNew={intent === 'narucilac' ? () => navigate(() => router.navigate('/nova')) : undefined} />;
}
