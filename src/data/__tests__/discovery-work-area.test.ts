import { initialMarketplaceView } from '../marketplaceView';
import { maySeedWorkArea, workAreaBounds } from '../discoveryWorkArea';
const area = { city: 'Novi Sad', operatingCountryCode: 'RS' as const, radiusKm: 20,
  approximatePosition: { latitude: 45.25444, longitude: 19.83444 } };
it('uses the saved coarse point and radius, in longitude/latitude bounds order, without changing the stored value', () => {
  const original = JSON.stringify(area), bounds = workAreaBounds(area)!;
  expect(bounds).not.toBeNull(); expect((bounds[0] + bounds[2]) / 2).toBeCloseTo(19.83, 8);
  expect((bounds[1] + bounds[3]) / 2).toBeCloseTo(45.25, 8);
  expect(bounds[2] - bounds[0]).toBeGreaterThan(0.5); expect(bounds[3] - bounds[1]).toBeGreaterThan(0.35);
  expect(JSON.stringify(area)).toBe(original);
});
it('zero coordinates are valid and a larger saved radius produces a larger camera footprint', () => {
  const atZero = { ...area, approximatePosition: { latitude: 0, longitude: 0 } };
  const small = workAreaBounds({ ...atZero, radiusKm: 1 })!, large = workAreaBounds({ ...atZero, radiusKm: 200 })!;
  expect(small[0]).toBeLessThan(0); expect(small[2]).toBeGreaterThan(0);
  expect(large[2] - large[0]).toBeGreaterThan(small[2] - small[0]);
});
it.each([null, { latitude: NaN, longitude: 19 }, { latitude: 45, longitude: Infinity },
  { latitude: 90, longitude: 19 }, { latitude: 45, longitude: 181 }, { latitude: 0, longitude: 179.99 }])
('does not invent a locality for a missing/unsupported point %j', approximatePosition => {
  expect(workAreaBounds({ ...area, approximatePosition })).toBeNull();
});
it.each([0, 201, 1.5, NaN, Infinity])('rejects invalid saved radius %s', radiusKm => {
  expect(workAreaBounds({ ...area, radiusKm })).toBeNull();
});
it('does not geocode a city or infer an unknown country', () => {
  expect(workAreaBounds({ ...area, approximatePosition: null })).toBeNull();
  expect(workAreaBounds({ ...area, city: '  ' })).toBeNull();
  expect(workAreaBounds({ ...area, operatingCountryCode: null })).toBeNull();
});
it('admits only a pristine map; existing choices and remembered geography win', () => {
  const view = { ...initialMarketplaceView(), mode: 'map' as const };
  expect(maySeedWorkArea(view)).toBe(true);
  for (const patch of [{ mode: 'list' }, { query: 'montaža' }, { selectedId: 'task' }, { selectedPlace: 'point' },
    { pinPlace: 'point' }, { place: 'Beograd' }, { where: 'remote' }, { when: 'today' }, { price: 'OFFERS' },
    { places: 2 }, { attention: true }, { listOffset: 120 }, { area: [19, 44, 20, 45] },
    { dates: { from: '2026-09-28', to: '2026-09-29' } },
    { viewport: { center: [19, 45], zoom: 12, bounds: [18, 44, 20, 46] } }]) {
    expect(maySeedWorkArea({ ...view, ...patch } as typeof view)).toBe(false);
  }
});
