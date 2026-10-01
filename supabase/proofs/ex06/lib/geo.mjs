// EX-06 S03/S04: the documented city -> coordinates table of the harness fixtures, and the haversine the matcher uses.
// Pure module (no database, no network).
//
// Why a table. The matcher compares geodesic distance (private.haversine_km of needs.approximate_lat/lng and worker_match_preferences.approximate_lat/lng) whenever
// both positions exist, and falls back to a city-NAME comparison only when one is missing. The product derives a task's pin and its city text from the same confirmation,
// so "task in Nis, pin in Novi Sad" is not a state the product can produce. The fixtures therefore take the task pin AND the worker position from this one table.
// Every value is a hand-set, two-decimal (about 1 km) city centre: the worker location writer refuses more than two decimals, and the task's coarse grid reads two decimals.
// They are fixture inputs, not a geocoder and not product data; a city that is not listed is refused (EX06_CITY_UNKNOWN), never defaulted.
import {HarnessInputError} from './compare.mjs';

export const CITY_CENTRES = Object.freeze({
  'Novi Sad': Object.freeze({latitude: 45.27, longitude: 19.83}),
  'Petrovaradin': Object.freeze({latitude: 45.25, longitude: 19.87}),
  'Futog': Object.freeze({latitude: 45.24, longitude: 19.71}),
  'Beograd': Object.freeze({latitude: 44.82, longitude: 20.46}),
  'Zrenjanin': Object.freeze({latitude: 45.38, longitude: 20.39}),
  'Subotica': Object.freeze({latitude: 46.1, longitude: 19.67}),
  'Sremska Mitrovica': Object.freeze({latitude: 44.98, longitude: 19.61}),
  'Niš': Object.freeze({latitude: 43.32, longitude: 21.9}),
});

export const DEFAULT_CITY = 'Novi Sad';

/** The table's coordinates of a city (a copy). Throws EX06_CITY_UNKNOWN for any city that is not listed. */
export function cityCentre(city) {
  const name = typeof city === 'string' ? city.normalize('NFC').trim() : '';
  const centre = CITY_CENTRES[name];
  if (!centre) throw new HarnessInputError('EX06_CITY_UNKNOWN', JSON.stringify(city) + ' (known: ' + Object.keys(CITY_CENTRES).join(', ') + ')');
  return {latitude: centre.latitude, longitude: centre.longitude};
}

/** How far inside its 0.01 degree cell a task pin sits: rounding and flooring then give the same coarse value (the 45.251234 / 19.831234 pin of pkg023_flow.mjs sits 0.001234 inside its cell, too). */
export const PIN_CELL_OFFSET_DEGREES = 0.0025;

/**
 * The confirmed-pin shape of the task location value (latitudeE6 / longitudeE6) for a city. The pin is the city centre moved 0.0025 degrees into its cell, so whichever way the product
 * coarsens it (round or floor to two decimals) the stored approximate_lat / approximate_lng equal the city table's centre, which is exactly what the worker's position is.
 */
export function pinFor(slot, city) {
  const centre = cityCentre(city);
  return {slot, latitudeE6: Math.round((centre.latitude + PIN_CELL_OFFSET_DEGREES) * 1e6), longitudeE6: Math.round((centre.longitude + PIN_CELL_OFFSET_DEGREES) * 1e6), origin: {kind: 'MANUAL_PIN'}};
}

/** The city a task's geography is anchored on (the start of the route, else the service area), or null when the task is remote. */
export function primaryCity(geography) {
  if (!geography || geography.mode === 'REMOTE') return null;
  return geography.start?.city ?? geography.serviceArea?.city ?? null;
}

/** private.haversine_km: round(6371 * 2 * asin(least(1, sqrt(...))), 2), null when a coordinate is missing. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some(value => value === null || value === undefined || Number.isNaN(Number(value)))) return null;
  const rad = degrees => (Number(degrees) * Math.PI) / 180;
  const a = Math.sin(rad(Number(lat2) - Number(lat1)) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(Number(lng2) - Number(lng1)) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a))) * 100) / 100;
}
