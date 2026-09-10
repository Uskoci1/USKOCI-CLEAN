import { locationPayloadFits, normalizeNeedLocation } from '../../lib/location';
import type { NeedLocationInput } from '../../contracts/location';

const physical = (): NeedLocationInput => {
  const geography = { mode: 'POINT_TO_POINT' as const, start: { city: 'Novi Sad' }, end: { city: 'Beograd' } };
  return { taskCountryCode: 'RS', geography, exactAddress: null, accessNotes: null,
    resolvedLocation: { version: 1, binding: { taskCountryCode: 'RS', geography, exactAddress: null }, points: [
      { slot: 'end', latitudeE6: 44786123, longitudeE6: 20448123, origin: { kind: 'MANUAL_PIN' } },
      { slot: 'start', latitudeE6: 45255123, longitudeE6: 19845123, origin: {
        kind: 'PROVIDER_CANDIDATE', providerHint: 'configured-test', candidateHint: 'candidate-2',
      }, address: '  Privatno mesto 2  ', accessNotes: 'Ulaz A\nSprat 1' },
    ] } };
};
it('keeps private point details outside the public topology and sorts by existing route slots', () => {
  const input = physical(), value = normalizeNeedLocation(input)!;
  expect(value.resolvedLocation?.points.map(point => point.slot)).toEqual(['start', 'end']);
  expect(value.resolvedLocation?.points[0].address).toBe('Privatno mesto 2');
  expect(value.geography).toEqual(input.geography);
  expect(JSON.stringify(value.geography)).not.toMatch(/latitude|longitude|Privatno|Ulaz|candidate/);
});
it.each(['country', 'geography', 'address', 'route-order'])('rejects an old location witness after changing %s', kind => {
  const input = JSON.parse(JSON.stringify(physical()));
  if (kind === 'country') input.taskCountryCode = 'BA';
  if (kind === 'geography') input.geography.start.city = 'Subotica';
  if (kind === 'address') input.exactAddress = 'Nova privatna adresa';
  if (kind === 'route-order') [input.geography.start, input.geography.end] = [input.geography.end, input.geography.start];
  expect(normalizeNeedLocation(input)).toBeNull();
});
it('accepts changed access instructions without silently changing confirmed coordinates', () => {
  const input = physical();
  const value = normalizeNeedLocation({ ...input, accessNotes: 'Drugi ulaz' });
  expect(value?.resolvedLocation?.points[0].latitudeE6).toBe(45255123);
});
it.each(['duplicate', 'absent-slot', 'fraction', 'out-of-range', 'string-coordinate', 'provider-attestation', 'client-confirmation'])('refuses malformed precise data: %s', kind => {
  const input = JSON.parse(JSON.stringify(physical())), p = input.resolvedLocation.points[0];
  if (kind === 'duplicate') input.resolvedLocation.points.push(p);
  if (kind === 'absent-slot') p.slot = 'waypoints/0';
  if (kind === 'fraction') p.latitudeE6 = 1.5;
  if (kind === 'out-of-range') p.longitudeE6 = -180000001;
  if (kind === 'string-coordinate') p.latitudeE6 = '45255123';
  if (kind === 'provider-attestation') p.origin = { kind: 'SERVER_VERIFIED' };
  if (kind === 'client-confirmation') input.resolvedLocation.confirmedAt = new Date().toISOString();
  expect(normalizeNeedLocation(input)).toBeNull();
});
it('accepts genuine zero coordinates, while legacy and Remote stay unresolved', () => {
  const input = physical();
  const value = normalizeNeedLocation({ ...input, resolvedLocation: { ...input.resolvedLocation!, points: [
    { slot: 'start', latitudeE6: 0, longitudeE6: 0, origin: { kind: 'MANUAL_PIN' } },
  ] } });
  expect(value?.resolvedLocation?.points[0].latitudeE6).toBe(0);
  expect(normalizeNeedLocation({ ...input, resolvedLocation: undefined })?.resolvedLocation).toBeNull();
  expect(normalizeNeedLocation({ ...input, geography: { mode: 'REMOTE' } })).toBeNull();
  expect(normalizeNeedLocation({ taskCountryCode: 'RS', geography: { mode: 'REMOTE' }, exactAddress: null, accessNotes: null })?.resolvedLocation).toBeNull();
});
it('counts PostgreSQL separators and actual UTF-8 bytes without counting punctuation inside strings', () => {
  expect(locationPayloadFits({ x: 'a'.repeat(65527) })).toBe(true); // {"x": "..."} is 65536 bytes
  expect(locationPayloadFits({ x: 'a'.repeat(65528) })).toBe(false);
  expect(locationPayloadFits({ x: '😀'.repeat(16381) })).toBe(true);
  expect(locationPayloadFits({ x: '😀'.repeat(16382) })).toBe(false);
  expect(locationPayloadFits({ x: ',:'.repeat(32763) })).toBe(true);
});
