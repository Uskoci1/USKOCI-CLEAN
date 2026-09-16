import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { initialMarketplaceView, type MarketplaceItem } from '../../data/marketplaceView';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, postaviUlogu, ulogaSada, useIzvor, useUloga } from '../../store/uloga';
import { IntentTransition, type IntentTransitionRequest } from '../../ui/system/IntentTransition';
import { MarketplacePresentation } from '../../ui/v2/MarketplacePresentation';

export default function Prilike({ initialMode = 'list' }: { initialMode?: 'map' | 'list' } = {}) {
  const { user, accountRevision } = useSesija(), intent = useUloga();
  return <OwnedCollection key={`${user?.id ?? ''}:${accountRevision}:${intent}`} initialMode={initialMode} />;
}
type Transition = IntentTransitionRequest & { go: () => void };
function OwnedCollection({ initialMode }: { initialMode: 'map' | 'list' }) {
  const source = useIzvor(), intent = useUloga(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [view, setView] = useState(() => ({ ...initialMarketplaceView(), mode: initialMode }));
  const [transition, setTransition] = useState<Transition | null>(null);
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
  const resource = useFocusedResource(load), scope = focus.current;
  const latestResource = useRef(resource); latestResource.current = resource;
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && ulogaSada() === intent && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  const open = (item: MarketplaceItem) => {
    const latest = latestResource.current;
    if (latest.loading || latest.error || !latest.data?.some(row => row.id === item.id)) return;
    navigate(() => router.navigate({ pathname: '/prilike/[id]', params: { id: item.id } }));
  };
  // Owner decision 2 (2026-09-16): a worker's "Moji" / "+" never switch the intent
  // silently. The sheet asks; one confirm does the switch and the navigation.
  const ask = (request: Transition) => { if (current()) setTransition(request); };
  const confirmTransition = () => {
    const pending = transition; setTransition(null);
    if (pending) navigate(() => { postaviUlogu(pending.target); pending.go(); });
  };
  return <>
    <MarketplacePresentation owned={false} intent={intent} items={resource.data ?? []} loading={resource.loading} error={!!resource.error}
      scopeKey={`${user?.id ?? ''}:${accountRevision}:${intent}`} view={view}
      onView={next => { if (current()) setView(next); }} onRefresh={() => { if (current()) void resource.refresh(); }} onOpen={open}
      onSwitch={() => {
        if (intent === 'narucilac') navigate(() => router.navigate('/potrebe'));
        else ask({ target: 'narucilac', confirmLabel: 'Pređi na moje Zadatke', go: () => router.replace('/potrebe'),
          reason: 'Vaši Zadaci kao naručioca stoje u MENI TREBA. Prelazak menja donju navigaciju na Zadaci | Mapa | Dogovori.' });
      }} onProfile={() => navigate(() => router.navigate('/profil'))}
      onNew={() => {
        if (intent === 'narucilac') navigate(() => router.navigate('/nova'));
        else ask({ target: 'narucilac', confirmLabel: 'Pređi i napravi Zadatak', go: () => router.replace('/nova'),
          reason: 'Novi Zadatak pravite kao naručilac. Prelazak menja donju navigaciju na Zadaci | Mapa | Dogovori.' });
      }} />
    <IntentTransition request={transition} current={intent} onConfirm={confirmTransition} onCancel={() => setTransition(null)} />
  </>;
}
