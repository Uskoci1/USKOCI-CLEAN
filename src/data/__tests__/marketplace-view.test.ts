import { initialMarketplaceView, marketplaceItems, publicBounds, publicFeatures, publicInitialBounds, publicPoint, publicViewport, type MarketplaceItem } from '../marketplaceView';
const item = (id: string, patch = {}): MarketplaceItem => ({ id, naslov: `Pomoć ${id}`, podrucjeTekst: 'Novi Sad', vremeTekst: 'Po dogovoru', uslovi: ['Alat'], statusTekst: 'Otvoren', rezimCene: 'MY_PRICE', pokrivenost: { ukupno: 2, popunjeno: 0, preostalo: 2, udeo: 0 }, priblizno: { lat: 45.25456, lng: 19.83456 }, ...patch } as MarketplaceItem);
const ids = (items: MarketplaceItem[]) => items.map(row => row.id);
test('Remote never contributes a map feature even with a stale supplied approximation', () => {
  const remote = item('remote', { detalji: { rezimLokacije: 'REMOTE' } });
  expect(publicPoint(remote)).toBeNull();
  expect(publicFeatures([remote]).features).toEqual([]);
  expect(ids(marketplaceItems([remote], initialMarketplaceView(), false))).toEqual(['remote']);
});
test('one result order and filter subset is shared by List and Map; viewport alone does not filter', () => {
 const rows = [item('a'), item('b', { rezimCene: 'OFFERS' }), item('c', { priblizno: null })];
 const view = { ...initialMarketplaceView(), query: 'nOVI sad', price: 'MY_PRICE' as const };
 expect(ids(marketplaceItems(rows, view, false))).toEqual(['a', 'c']);
 expect(ids(marketplaceItems(rows, { ...view, mode: 'map', viewport: { bounds: [0, 0, 1, 1], center: [0, 0], zoom: 4 } }, false))).toEqual(['a', 'c']);
 expect(ids(marketplaceItems(rows, { ...view, area: [19, 45, 20, 46] }, false))).toEqual(['a']);
});
test('owned tabs and attention use existing actual state and counts; public filter never infers price', () => {
 const rows = [item('draft', { stanje: 'NACRT', brojPrijava: 5 }), item('active', { stanje: 'OBJAVLJENA', brojPrijava: 1 }), item('closed', { stanje: 'ZATVORENA', brojPrijava: 1 })];
 expect(ids(marketplaceItems(rows, initialMarketplaceView(), true))).toEqual(['active']);
 expect(ids(marketplaceItems(rows, { ...initialMarketplaceView(), section: 'drafts' }, true))).toEqual(['draft']);
 expect(ids(marketplaceItems(rows, { ...initialMarketplaceView(), section: 'history' }, true))).toEqual(['closed']);
 expect(ids(marketplaceItems(rows, { ...initialMarketplaceView(), section: 'all', attention: true }, true))).toEqual(['active']);
 expect(marketplaceItems([item('unknown', { rezimCene: undefined })], { ...initialMarketplaceView(), price: 'OFFERS' }, false)).toEqual([]);
});
test('public map only receives ID and rounded existing approximation; zero is a real value', () => {
 const row = item('zero', { priblizno: { lat: 0, lng: 0 }, privateLocation: { lat: 1, lng: 2 }, address: 'Private' });
 expect(publicPoint(row)).toEqual({ lat: 0, lng: 0 });
 expect(publicFeatures([row, item('ordinary')])).toEqual({ type: 'FeatureCollection', features: [
 { type: 'Feature', id: 'zero', properties: { needId: 'zero' }, geometry: { type: 'Point', coordinates: [0, 0] } },
 { type: 'Feature', id: 'ordinary', properties: { needId: 'ordinary' }, geometry: { type: 'Point', coordinates: [19.83, 45.25] } }] });
});
test.each([null, undefined, { lat: '45', lng: 19 }, { lat: NaN, lng: 19 }, { lat: 91, lng: 19 }, { lat: 45, lng: 181 }, { lat: 45, lng: Infinity }])('malformed/absent public point stays absent: %p', priblizno => {
 const row = item('x', { priblizno, latitude: 45, longitude: 19, resolvedLocation: { lat: 45, lng: 19 } });
 expect(publicPoint(row)).toBeNull(); expect(publicFeatures([row]).features).toHaveLength(0);
 expect(marketplaceItems([row], initialMarketplaceView(), false)).toHaveLength(1);
});
test('explicit antimeridian area contains either side, not unrelated longitudes', () => {
 const rows = [item('east', { priblizno: { lat: 0, lng: 179 } }), item('west', { priblizno: { lat: 0, lng: -179 } }), item('zero', { priblizno: { lat: 0, lng: 0 } })];
 expect(ids(marketplaceItems(rows, { ...initialMarketplaceView(), area: [170, -1, -170, 1] }, false))).toEqual(['east', 'west']);
});
test('native viewport decoder discards extra native properties and rejects unbounded values', () => {
 expect(publicViewport({ center: [0, 0], zoom: 4, bounds: [-1, -1, 1, 1], privateData: 'discarded' })).toEqual({ center: [0, 0], zoom: 4, bounds: [-1, -1, 1, 1] });
 expect(publicViewport({ center: ['0', 0], zoom: 4, bounds: [-1, -1, 1, 1] })).toBeNull();
 expect(publicViewport({ center: [0, 0], zoom: 25, bounds: [-1, -1, 1, 1] })).toBeNull();
 expect(publicBounds([0, 4, 1, 3])).toBeNull(); expect(publicBounds([0, -91, 1, 3])).toBeNull();
});
test('initial camera remains bounded even at poles, without changing public geometry', () => {
 for (const lat of [-90, 0, 90]) { const rows = [item('pole', { priblizno: { lat, lng: 180 } })]; expect(publicBounds(publicInitialBounds(rows))).not.toBeNull(); expect(publicPoint(rows[0])!.lat).toBe(lat); }
 expect(publicInitialBounds([])).toBeNull();
});
