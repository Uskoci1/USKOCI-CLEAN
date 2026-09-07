import type { FeatureCollection, Point } from 'geojson';

export type DiscoveryFilters = {
  query: string;
  city: string;
  location: 'ALL' | 'PHYSICAL' | 'REMOTE';
  price: 'ALL' | 'OFFERS' | 'MY_PRICE';
};
export type DiscoveryViewport = { center: [number, number]; zoom: number };
export type DiscoveryPins = FeatureCollection<Point, { id: string; label: string }>;
export const EMPTY_DISCOVERY_FILTERS: DiscoveryFilters = { query: '', city: '', location: 'ALL', price: 'ALL' };
/** Overview, not an inferred user location. No location permission is requested here. */
export const DISCOVERY_INITIAL_VIEW: DiscoveryViewport = { center: [20.8, 44.1], zoom: 5.4 };
