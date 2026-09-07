import { discoveryPins, discoveryPrice, filterDiscovery } from '../discoveryView';
import { EMPTY_DISCOVERY_FILTERS } from '../../contracts/discoveryView';
import type { PrilikaProjekcija } from '../../contracts/projections';

function item(id: string, override: Partial<PrilikaProjekcija> = {}): PrilikaProjekcija {
  return { id, naslov: 'Pomoć pri selidbi', statusTekst: 'Traže se ponude', podrucjeTekst: 'Centar, Čačak',
    vremeTekst: 'Fleksibilno', grad: 'Čačak', executionLocationMode: 'STATIONARY',
    pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, uslovi: ['Kombi', 'Bušilica'],
    narucilacProfilId: 'public-profile-id', narucilacIme: 'Javno ime', narucilacOcena: null,
    priblizno: { lat: 44.5, lng: 20.2 }, rezimCene: 'OFFERS', ...override };
}

describe('shared loaded-window discovery projection', () => {
  it('filters only supplied items, preserving identity/order and leaving the source untouched', () => {
    const first = item('one'), second = item('two', { naslov: 'Montaža police', uslovi: ['Bušilica'], grad: 'Novi Sad' });
    const items = [first, second];
    const original = JSON.stringify(items);
    expect(filterDiscovery(items, EMPTY_DISCOVERY_FILTERS)).toEqual(items);
    expect(filterDiscovery(items, { ...EMPTY_DISCOVERY_FILTERS, query: '  BUŠILICA  ' })).toEqual(items);
    expect(filterDiscovery(items, { ...EMPTY_DISCOVERY_FILTERS, city: 'cacak', query: 'pomoc' })).toEqual([first]);
    expect(filterDiscovery(items, { ...EMPTY_DISCOVERY_FILTERS, query: 'kombi', city: 'Novi Sad' })).toEqual([]);
    expect(filterDiscovery(items, { ...EMPTY_DISCOVERY_FILTERS, query: 'Javno ime' })).toEqual([]);
    expect(JSON.stringify(items)).toBe(original);
    expect(filterDiscovery(items, EMPTY_DISCOVERY_FILTERS)[0]).toBe(first);
  });

  it('intersects physical/remote and price filters without turning filters into eligibility', () => {
    const stationary = item('stationary');
    const route = item('route', { executionLocationMode: 'POINT_TO_POINT', rezimCene: 'MY_PRICE', primaNovePrijave: false });
    const stops = item('stops', { executionLocationMode: 'MULTI_STOP' });
    const area = item('area', { executionLocationMode: 'AREA_BASED' });
    const remote = item('remote', { executionLocationMode: 'REMOTE', grad: '', priblizno: null });
    const unknown = item('unknown', { executionLocationMode: undefined, rezimCene: undefined });
    const all = [stationary, route, stops, area, remote, unknown];
    expect(filterDiscovery(all, { ...EMPTY_DISCOVERY_FILTERS, location: 'PHYSICAL' })).toEqual([stationary, route, stops, area]);
    expect(filterDiscovery(all, { ...EMPTY_DISCOVERY_FILTERS, location: 'REMOTE' })).toEqual([remote]);
    expect(filterDiscovery(all, { ...EMPTY_DISCOVERY_FILTERS, location: 'PHYSICAL', price: 'MY_PRICE' })).toEqual([route]);
    expect(filterDiscovery(all, { ...EMPTY_DISCOVERY_FILTERS, price: 'OFFERS' })).toEqual([stationary, stops, area, remote]);
    expect(filterDiscovery(all, EMPTY_DISCOVERY_FILTERS)).toContain(route); // Server hint is not a hidden client admission filter.
  });

  it('preserves actual provided currency copy and has truthful missing/offers fallbacks', () => {
    const dinars = item('rsd', { rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 4500, valuta: 'RSD', prikaz: '4.500 RSD' } });
    const euros = item('eur', { rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 25, valuta: 'EUR', prikaz: '25 EUR' } });
    expect(discoveryPrice(dinars)).toBe('4.500 RSD');
    expect(discoveryPrice(euros)).toBe('25 EUR'); // No invented currency conversion/default.
    expect(discoveryPrice(item('missing', { rezimCene: 'MY_PRICE' }))).toBe('Cena nije navedena');
    expect(discoveryPrice(item('offers', { ponudjenaCena: dinars.ponudjenaCena }))).toBe('Traže se ponude');
    expect(discoveryPrice(item('unknown', { rezimCene: undefined }))).toBe('Cena nije navedena');
  });

  it('retains genuine zero coordinates and converts only coordinate order to GeoJSON', () => {
    const data = [item('origin', { priblizno: { lat: 0, lng: 0 } }),
      item('equator', { priblizno: { lat: 0, lng: 20 } }),
      item('meridian', { priblizno: { lat: 44, lng: 0 } }),
      item('edge', { priblizno: { lat: -90, lng: 180 } })];
    const pins = discoveryPins(data);
    expect(pins.type).toBe('FeatureCollection');
    expect(pins.features.map(pin => pin.id)).toEqual(data.map(value => value.id));
    expect(pins.features.map(pin => pin.geometry.coordinates)).toEqual([[0, 0], [20, 0], [0, 44], [180, -90]]);
  });

  it('keeps REMOTE, missing and invalid points in the list while excluding their map pins', () => {
    const data = [item('remote', { executionLocationMode: 'REMOTE', priblizno: { lat: 44, lng: 20 } }),
      item('missing', { priblizno: null }), item('bad-lat', { priblizno: { lat: 91, lng: 20 } }),
      item('bad-lng', { priblizno: { lat: 44, lng: -181 } }),
      item('nan', { priblizno: { lat: NaN, lng: 20 } }), item('infinity', { priblizno: { lat: 44, lng: Infinity } }),
      item('incomplete', { priblizno: { lat: 44 } as { lat: number; lng: number } }),
      item('valid', { priblizno: { lat: 44, lng: 20 } })];
    const visible = filterDiscovery(data, EMPTY_DISCOVERY_FILTERS);
    expect(visible).toHaveLength(8);
    expect(discoveryPins(visible).features.map(pin => pin.id)).toEqual(['valid']);
  });

  it('constructs a minimal GeoJSON allowlist and cannot forward extra private/source properties', () => {
    const extra = { ...item('safe', { rezimCene: 'MY_PRICE', ponudjenaCena: { iznos: 900, valuta: 'RSD', prikaz: '900 RSD' } }),
      requester_account_id: 'private-account', exact_address: 'private-address',
      private_terms: { note: 'private-note' }, sender_account_id: 'private-sender',
      description: 'private-description', exact_lat: 44.123456, exact_lng: 20.123456 };
    const pins = discoveryPins([extra]);
    expect(pins).toEqual({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 'safe',
      geometry: { type: 'Point', coordinates: [20.2, 44.5] }, properties: { id: 'safe', label: '900 RSD' } }] });
    expect(JSON.stringify(pins)).not.toMatch(/private-|narucilac|description|exact_|profile|status|uslovi/);
  });
});
