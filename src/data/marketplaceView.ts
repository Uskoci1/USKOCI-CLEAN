import type { PotrebaProjekcija, PrilikaProjekcija } from '../contracts/projections';
export type MarketplaceItem = PotrebaProjekcija | PrilikaProjekcija;
export type PublicBounds = [west: number, south: number, east: number, north: number];
export type PublicViewport = { center: [number, number]; zoom: number; bounds: PublicBounds };
export type MarketplaceView = { query: string; section: 'active' | 'drafts' | 'history' | 'all'; attention: boolean;
  price: 'all' | 'MY_PRICE' | 'OFFERS'; mode: 'list' | 'map'; area: PublicBounds | null; viewport: PublicViewport | null; selectedId: string | null };
export const initialMarketplaceView = (): MarketplaceView => ({ query: '', section: 'active', attention: false,
  price: 'all', mode: 'list', area: null, viewport: null, selectedId: null });
export const isOwnedNeed = (item: MarketplaceItem): item is PotrebaProjekcija => 'stanje' in item;
/** Only the existing public approximation is admitted. This never reads private pins or asks for GPS. */
export function publicPoint(item: MarketplaceItem): { lat: number; lng: number } | null {
  if (!('priblizno' in item)) return null;
  const point = item.priblizno;
  return point && typeof point.lat === 'number' && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
    && typeof point.lng === 'number' && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180
    ? { lat: Number(point.lat.toFixed(2)), lng: Number(point.lng.toFixed(2)) } : null;
}
export function publicBounds(raw: unknown): PublicBounds | null {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(value => typeof value === 'number' && Number.isFinite(value))) return null;
  const [west, south, east, north] = raw;
  return Math.abs(west) <= 180 && Math.abs(east) <= 180 && south >= -90 && north <= 90 && south <= north
    ? [west, south, east, north] : null;
}
export function publicViewport(raw: unknown): PublicViewport | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<PublicViewport>, bounds = publicBounds(value.bounds);
  return bounds && Array.isArray(value.center) && value.center.length === 2 && value.center.every(Number.isFinite)
    && Math.abs(value.center[0]) <= 180 && Math.abs(value.center[1]) <= 90 && typeof value.zoom === 'number'
    && Number.isFinite(value.zoom) && value.zoom >= 0 && value.zoom <= 24
    ? { center: [value.center[0], value.center[1]], zoom: value.zoom, bounds } : null;
}
export function hasNeedAttention(item: PotrebaProjekcija): boolean {
  return item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA' && item.pokrivenost.preostalo > 0 && item.brojPrijava > 0;
}
/** One presentation subset of one existing read. No matching/eligibility/ranking authority. */
export function marketplaceItems(items: readonly MarketplaceItem[], view: MarketplaceView, owned: boolean): MarketplaceItem[] {
  const query = view.query.trim().toLocaleLowerCase('sr-Latn-RS');
  return items.filter(item => {
    if (owned) {
      if (!isOwnedNeed(item)) return false;
      if (view.section === 'drafts' && item.stanje !== 'NACRT' || view.section === 'history' && item.stanje !== 'ZATVORENA'
        || view.section === 'active' && (item.stanje === 'NACRT' || item.stanje === 'ZATVORENA')) return false;
      if (view.attention && !hasNeedAttention(item)) return false;
    }
    if (view.price !== 'all' && item.rezimCene !== view.price) return false;
    if (query && ![item.naslov, item.podrucjeTekst, ...item.uslovi].join(' ').toLocaleLowerCase('sr-Latn-RS').includes(query)) return false;
    if (view.area) {
      const point = publicPoint(item); if (!point) return false;
      const [west, south, east, north] = view.area;
      if (point.lat < south || point.lat > north || (west <= east ? point.lng < west || point.lng > east : point.lng < west && point.lng > east)) return false;
    }
    return true;
  });
}
/** IDs and rounded public points only; no titles, accounts, exact locations or other properties enter the map SDK. */
export function publicFeatures(items: readonly MarketplaceItem[]): GeoJSON.FeatureCollection<GeoJSON.Point, { needId: string }> {
  return { type: 'FeatureCollection', features: items.flatMap(item => {
    const point = publicPoint(item);
    return point ? [{ type: 'Feature' as const, id: item.id, properties: { needId: item.id }, geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] } }] : [];
  }) };
}
export function publicInitialBounds(items: readonly MarketplaceItem[]): PublicBounds | null {
  const points = items.flatMap(item => { const value = publicPoint(item); return value ? [value] : []; });
  if (!points.length) return null;
  return [Math.max(-180, Math.min(...points.map(point => point.lng)) - 0.02), Math.max(-85, Math.min(84.98, Math.min(...points.map(point => point.lat)) - 0.02)),
    Math.min(180, Math.max(...points.map(point => point.lng)) + 0.02), Math.min(85, Math.max(-84.98, Math.max(...points.map(point => point.lat)) + 0.02))];
}
