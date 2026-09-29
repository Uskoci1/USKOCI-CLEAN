import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { Izvor } from '../../../data/ports';
import { createDiscoveryV1SupabaseTransport } from '../../../data/discoveryV1ClientTransport';
import { createDiscoveryV1ExistingOverlayLoaders, discoveryV1OverlayRelation } from '../../../data/discoveryV1OverlayOwner';
import { createDiscoveryV1RouteCoordinator, type DiscoveryV1RouteSnapshot } from '../../../data/discoveryV1RouteCoordinator';
import type { DiscoveryV1MapMarker } from '../../../data/discoveryV1MarketplaceAdapter';
import type { MarketplaceItem, MarketplaceView, PublicBounds } from '../../../data/marketplaceView';
import type { WorkAreaCamera } from '../../../data/discoveryWorkArea';
import type { TaskRelation } from '../../../data/taskRelation';
import { DiscoveryV1PresentationBridge } from '../../../data/discoveryV1PresentationBridge';
import type { SearchDraft } from './DiscoverySearchPanel';
import { StateView } from '../../system/StateView';
import type { DiscoveryTrace } from '../DiscoveryPresentation';

type Coordinator = ReturnType<typeof createDiscoveryV1RouteCoordinator>;

export type DiscoveryV1NativeProofScreenProps = {
  source: Pick<Izvor, 'odnosiPremaZadacima'>;
  scopeKey: string;
  initialView: MarketplaceView;
  initialWorkArea?: WorkAreaCamera | null;
  onInitialWorkAreaHandled?: (key: string) => void;
  isCurrent: () => boolean;
  onPersistView: (view: MarketplaceView) => void;
  onOpen: (item: MarketplaceItem, relation: TaskRelation) => void;
  onProfile: () => void;
  onNew: () => void;
  onNotifications: () => void;
  trace?: DiscoveryTrace;
};

const SEARCH_SETTLE_MS = 250;

export function DiscoveryV1NativeProofScreen(props: DiscoveryV1NativeProofScreenProps) {
  const initialViewRef = useRef(props.initialView);
  const currentRef = useRef(props.isCurrent); currentRef.current = props.isCurrent;
  const persistRef = useRef(props.onPersistView); persistRef.current = props.onPersistView;
  const optionalCommitRef = useRef<() => void>(() => {});
  const coordinator = useMemo<Coordinator>(() => createDiscoveryV1RouteCoordinator(
    createDiscoveryV1SupabaseTransport(),
    createDiscoveryV1ExistingOverlayLoaders(props.source),
    () => currentRef.current(),
    () => optionalCommitRef.current(),
  ), [props.source]);
  const [state, setState] = useState<DiscoveryV1RouteSnapshot | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const mounted = useRef(true), searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null), searchGeneration = useRef(0);

  const commit = useCallback(() => {
    if (!mounted.current || !currentRef.current()) return;
    const next = coordinator.snapshot();
    setState(next);
    if (next.view) persistRef.current(next.view);
  }, [coordinator]);
  optionalCommitRef.current = commit;

  const execute = useCallback(async (action: () => Promise<unknown>, busy = false) => {
    if (busy && mounted.current) { setLoading(true); setError(false); }
    try {
      await action();
      commit();
    } catch {
      if (mounted.current && currentRef.current()) setError(true);
    } finally {
      if (busy && mounted.current) setLoading(false);
    }
  }, [commit]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true); setError(false);
    void coordinator.open(initialViewRef.current).then(() => {
      if (!mounted.current || !currentRef.current()) return;
      commit(); setLoading(false);
    }, () => {
      if (!mounted.current || !currentRef.current()) return;
      setError(true); setLoading(false);
    });
    return () => {
      mounted.current = false;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      coordinator.retire();
    };
  }, [coordinator, commit]);

  const handleView = useCallback((view: MarketplaceView) => { void execute(() => coordinator.updateView(view)); }, [coordinator, execute]);
  const handleRefresh = useCallback(() => {
    const view = coordinator.snapshot().view;
    if (view) void execute(() => coordinator.open(view), true);
  }, [coordinator, execute]);
  const selectMarker = useCallback((marker: DiscoveryV1MapMarker) => {
    void execute(async () => {
      const result = await coordinator.selectMarker(marker);
      if (result.kind === 'CLUSTER') await coordinator.settleMap(result.bounds);
    });
  }, [coordinator, execute]);
  const onArea = useCallback((bounds: PublicBounds) => { void execute(() => coordinator.settleMap(bounds)); }, [coordinator, execute]);
  const onShowPlace = useCallback(() => {
    const peek = coordinator.snapshot().screen.peek;
    if (peek?.kind === 'PLACE') void execute(() => coordinator.showPoint(peek.point));
  }, [coordinator, execute]);
  const onShowAll = useCallback(() => { void execute(() => coordinator.showAll()); }, [coordinator, execute]);
  const onNextPage = useCallback(() => { void execute(() => coordinator.nextPage()); }, [coordinator, execute]);
  const onClearPeek = useCallback(() => { coordinator.clearPeek(); commit(); }, [coordinator, commit]);

  const onSearchDraft = useCallback((draft: SearchDraft, mapArea: PublicBounds | null) => {
    const generation = ++searchGeneration.current;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (generation !== searchGeneration.current || !mounted.current || !currentRef.current()) return;
      void execute(() => coordinator.previewSearch(draft, mapArea));
    }, SEARCH_SETTLE_MS);
  }, [coordinator, execute]);
  const onNextSearchPlaces = useCallback(() => { void execute(() => coordinator.nextSearchPlaces()); }, [coordinator, execute]);

  if (!state?.screen.active || !state.screen.view) {
    return <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
      <StateView kind={error ? 'error' : 'loading'} title={error ? 'Zadaci trenutno nisu dostupni' : 'Učitavamo zadatke…'}
        body={error ? 'Proveri vezu i pokušaj ponovo.' : undefined}
        primary={error ? { label: 'Pokušaj ponovo', onPress: handleRefresh } : undefined} skeleton={{ variant: 'task' }} />
    </View>;
  }

  return <DiscoveryV1PresentationBridge snapshot={state.screen} overlay={state.overlay} search={state.search}
    selectedMarkerKey={state.selectedMarkerKey} loadingMore={state.loadingMore}
    actions={{ onSelectMarker: selectMarker, onArea, onClearPeek, onShowPlace, onShowAll, onNextPage, onSearchDraft, onNextSearchPlaces }}
    loading={loading} refreshing={loading} error={error} scopeKey={props.scopeKey}
    initialWorkArea={props.initialWorkArea} onInitialWorkAreaHandled={props.onInitialWorkAreaHandled}
    trace={props.trace} onView={handleView} onRefresh={handleRefresh}
    onOpen={item => props.onOpen(item, discoveryV1OverlayRelation(state.overlay, item.id))}
    onProfile={props.onProfile} onNew={props.onNew} onNotifications={props.onNotifications} />;
}
