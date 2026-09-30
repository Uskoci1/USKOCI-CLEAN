import { DiscoveryPresentation, type DiscoveryPresentationProps, type DiscoveryV1PresentationSeam } from '../ui/v2/DiscoveryPresentation';
import type { SearchDraft } from '../ui/v2/discovery/DiscoverySearchPanel';
import type { DiscoveryV1ScreenSnapshot } from './discoveryV1ScreenSession';
import { discoveryV1ApplyOverlays, type DiscoveryV1OverlaySnapshot } from './discoveryV1OverlayOwner';
import type { DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import type { MarketplaceView, PublicBounds } from './marketplaceView';
import type { DiscoveryV1SearchSnapshot } from './discoveryV1SearchOwner';

export type DiscoveryV1PresentationActions = {
  onSelectMarker: (marker: DiscoveryV1MapMarker) => void;
  /** A camera move that is not the person's own settled here: the markers are read again over that region (the list is not). */
  onViewportSettled?: (bounds: PublicBounds) => void;
  onArea: (bounds: PublicBounds) => void;
  onClearPeek: () => void;
  onShowPlace: () => void;
  onShowAll: () => void;
  onNextPage: () => void;
  onSearchDraft?: (draft: SearchDraft, mapArea: PublicBounds | null) => void;
  onNextSearchPlaces?: () => void;
};

export type DiscoveryV1PresentationBridgeModel = {
  items: DiscoveryPresentationProps['items'];
  relations: DiscoveryPresentationProps['relations'];
  relationsPending: boolean;
  relationsError: boolean;
  view: MarketplaceView;
  p6Seam: DiscoveryV1PresentationSeam;
};

export function discoveryV1PresentationBridgeModel(snapshot: DiscoveryV1ScreenSnapshot, overlay: DiscoveryV1OverlaySnapshot,
  selectedMarkerKey: string | null, loadingMore: boolean, actions: DiscoveryV1PresentationActions,
  search?: DiscoveryV1SearchSnapshot): DiscoveryV1PresentationBridgeModel {
  if (!snapshot.active || !snapshot.view) throw new Error('DISCOVERY_V1_PRESENTATION_INACTIVE');
  const items = discoveryV1ApplyOverlays(snapshot.wireItems, overlay);
  const peek = snapshot.peek?.kind === 'TASK'
    ? { key: 'task:' + snapshot.peek.item.id, item: snapshot.peek.item, place: [] as const }
    : snapshot.peek?.kind === 'PLACE'
      ? { key: 'place:' + snapshot.peek.point.lat + ':' + snapshot.peek.point.lng, item: null, place: snapshot.peek.items }
      : null;
  return {
    items,
    relations: overlay.relations ?? undefined,
    relationsPending: overlay.loading,
    relationsError: overlay.errors.relations,
    view: snapshot.view,
    p6Seam: {
      map: { markers: snapshot.mapMarkers, selectedKey: selectedMarkerKey, wholeBounds: snapshot.mapWholeBounds,
        onSelect: actions.onSelectMarker, ...(actions.onViewportSettled ? { onViewportSettled: actions.onViewportSettled } : {}) },
      peek,
      counts: snapshot.counts,
      ...(search && actions.onSearchDraft && actions.onNextSearchPlaces ? { search: {
        snapshot: search, onDraft: actions.onSearchDraft, onNextPlaces: actions.onNextSearchPlaces,
      } } : {}),
      pageHasMore: snapshot.pageHasMore,
      loadingMore,
      onArea: actions.onArea,
      onClearPeek: actions.onClearPeek,
      onShowPlace: actions.onShowPlace,
      onShowAll: actions.onShowAll,
      onNextPage: actions.onNextPage,
    },
  };
}

export type DiscoveryV1PresentationBridgeProps =
  Omit<DiscoveryPresentationProps, 'items' | 'view' | 'relations' | 'relationsPending' | 'relationsError' | 'p6Seam'> & {
    snapshot: DiscoveryV1ScreenSnapshot;
    overlay: DiscoveryV1OverlaySnapshot;
    selectedMarkerKey: string | null;
    loadingMore?: boolean;
    search?: DiscoveryV1SearchSnapshot;
    actions: DiscoveryV1PresentationActions;
  };

/**
 * P6 integration seam over the real DiscoveryPresentation. It is not an alternate screen: the existing
 * list/sheet/search/Peek/Map components remain the UI. The Zadaci route reaches it only through DiscoveryV1Route,
 * and only in a build compiled with the P6 reader (`selectDiscoveryReader`), against a backend that carries the rollout.
 */
export function DiscoveryV1PresentationBridge({ snapshot, overlay, selectedMarkerKey, loadingMore = false, search, actions, ...props }
  : DiscoveryV1PresentationBridgeProps) {
  const model = discoveryV1PresentationBridgeModel(snapshot, overlay, selectedMarkerKey, loadingMore, actions, search);
  return <DiscoveryPresentation {...props} items={model.items} view={model.view} relations={model.relations}
    relationsPending={model.relationsPending} relationsError={model.relationsError} p6Seam={model.p6Seam} />;
}
