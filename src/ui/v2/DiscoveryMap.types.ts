import type { SharedValue } from 'react-native-reanimated';
import type { MarketplaceItem, PublicViewport, PublicBounds } from '../../data/marketplaceView';
/** Ephemeral camera instruction, never a public pin, task location, search filter, or stored location. */
export type NearbyCameraTarget = { key: number; center: [longitude: number, latitude: number] };
export type DiscoveryMapProps = { items: readonly MarketplaceItem[]; selectedId: string | null; viewport: PublicViewport | null;
  scopeKey: string; onSelect: (id: string) => void; onViewport: (value: PublicViewport) => void;
  /**
   * The list follows the map (Discovery V47): once a move of the person's own (a drag, a pinch, a zoom button, a cluster
   * tap) has settled and stayed still for `AREA_SETTLE_MS`, the map hands up the bounds it shows. The camera's own moves
   * (the first fit, a chosen pin brought into view, a fit to a chosen place) never do.
   */
  onArea: (bounds: PublicBounds) => void;
  onList: () => void;
  /** A tap on the map where there is no pin: whatever pin's card is open closes. */
  onClear?: () => void;
  /**
   * Bring these bounds into view once (a place chosen in the search), keeping `bottom` clear for the list sheet: the
   * camera's own move, so it never becomes an area. `key` says which request it is; `onFitted` hears it was carried out.
   */
  fitTo?: { key: number; bounds: PublicBounds; bottom: number } | null;
  centerNearby?: NearbyCameraTarget | null;
  /** Retire this exact one-shot request after camera dispatch; later remounts restore the remembered viewport. */
  onNearbyConsumed?: (key: number) => void;
  onFitted?: (key: number) => void;
  /** Several tasks on one public point: pressing that point selects the place (its `pointKey`) instead of one task. */
  onSelectPlace?: (key: string) => void;
  /** The chosen place, drawn as the green pill that says how many tasks it holds. */
  selectedPlace?: string | null;
  /** The list sheet's top edge, in pixels from the map's top; the zoom and the credits ride on it. */
  sheetTop?: SharedValue<number>;
  /** The floating search bar's bottom edge, in pixels from the map's top: fits and the credits keep clear of it. */
  toolsBottom?: number;
  /** Measured independent attribution strip; the screen reserves it above the list and selected preview. */
  onCreditsHeight?: (height: number) => void;
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
  coverBottom?: number };
