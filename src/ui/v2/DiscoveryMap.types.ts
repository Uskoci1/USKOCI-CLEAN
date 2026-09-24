import type { SharedValue } from 'react-native-reanimated';
import type { MarketplaceItem, PublicViewport, PublicBounds } from '../../data/marketplaceView';
export type DiscoveryMapProps = { items: readonly MarketplaceItem[]; selectedId: string | null; viewport: PublicViewport | null;
  scopeKey: string; onSelect: (id: string) => void; onViewport: (value: PublicViewport) => void; onSearchArea: (bounds: PublicBounds) => void;
  onList: () => void;
  /** Several tasks on one public point: pressing that point selects the place (its `pointKey`) instead of one task. */
  onSelectPlace?: (key: string) => void;
  /** The chosen place, drawn as the green pill that says how many tasks it holds. */
  selectedPlace?: string | null;
  /** The list sheet's top edge, in pixels from the map's top; the zoom and the credits ride on it. */
  sheetTop?: SharedValue<number>;
  /** The floating tools row's bottom edge, in pixels from the map's top: "Pretraži ovu oblast" sits under it. */
  toolsBottom?: number;
  /** How much of the map's bottom a chosen pin's card covers, so the camera brings the pin into the clear band. */
  focusBottom?: number;
  /**
   * How much of the map's bottom the list sheet covers where it starts, so the first fit of the pins keeps them above
   * it (a sheet that starts half open would otherwise hide the pins it was opened for). Without it the fit keeps 56.
   */
  fitBottom?: number;
  /**
   * The height of a card resting on the sheet's top line (a chosen pin's card), gap included; 0 when there is none. The
   * zoom and the credits ride above it instead of lying under it.
   */
  coverBottom?: number;
  /** The list is being read again: "Pretraži ovu oblast" waits for it. */
  busy?: boolean };
