import type { MarketplaceItem, PublicViewport, PublicBounds } from '../../data/marketplaceView';
export type DiscoveryMapProps = { items: readonly MarketplaceItem[]; selectedId: string | null; viewport: PublicViewport | null;
  scopeKey: string; onSelect: (id: string) => void; onViewport: (value: PublicViewport) => void; onSearchArea: (bounds: PublicBounds) => void;
  onList: () => void };
