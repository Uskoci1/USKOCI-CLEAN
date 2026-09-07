import type { PrilikaProjekcija } from '../contracts/projections';
import type { DiscoveryFilters, DiscoveryPins } from '../contracts/discoveryView';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('sr-Latn').trim();

/** Local display filtering over the loaded public page window, never eligibility authority. */
export function filterDiscovery(items: PrilikaProjekcija[], filter: DiscoveryFilters) {
  const query = normalize(filter.query), city = normalize(filter.city);
  return items.filter(item => {
    if (query && !normalize([item.naslov, item.podrucjeTekst, ...item.uslovi].join(' ')).includes(query)) return false;
    if (city && !normalize(item.grad ?? '').includes(city)) return false;
    if (filter.location === 'REMOTE' && item.executionLocationMode !== 'REMOTE') return false;
    if (filter.location === 'PHYSICAL' && !['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED'].includes(item.executionLocationMode ?? '')) return false;
    return filter.price === 'ALL' || item.rezimCene === filter.price;
  });
}

export function discoveryPrice(item: PrilikaProjekcija): string {
  if (item.rezimCene === 'OFFERS') return 'Traže se ponude';
  return item.ponudjenaCena?.prikaz ?? 'Cena nije navedena';
}

/** Only approximate public coordinates enter the renderer; remote tasks stay in the list. */
export function discoveryPins(items: PrilikaProjekcija[]): DiscoveryPins {
  return { type: 'FeatureCollection', features: items.flatMap(item => {
    const point = item.priblizno;
    if (item.executionLocationMode === 'REMOTE' || !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return [];
    return [{ type: 'Feature' as const, id: item.id, geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] },
      properties: { id: item.id, label: discoveryPrice(item) } }];
  }) };
}
