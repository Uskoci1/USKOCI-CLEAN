import type { DiscoveryPins, DiscoveryViewport } from '../../contracts/discoveryView';

export type DiscoveryMapProps = {
  pins: DiscoveryPins;
  selectedId: string | null;
  viewport: DiscoveryViewport;
  onSelect: (id: string) => void;
  onViewport: (viewport: DiscoveryViewport) => void;
  onList: () => void;
};
export const DISCOVERY_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
