import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../contracts/needFactsV2';
import type { CoarsePosition, NeedLocationInput, WorkerLocationInput } from '../contracts/location';

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function only(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
/** Keep Unicode text verbatim except SQL btrim-compatible outer spaces. No guessing. */
export function locationText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const text = value.replace(/^ +| +$/g, '');
  return text.length > 0 && Array.from(text).length <= max ? text : null;
}
export function locationPrivateText(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return undefined;
  const text = value.replace(/^ +| +$/g, '');
  return text.length && Array.from(text).length <= max ? text : undefined;
}
function point(value: unknown): NeedTaskGeographyPoint | null {
  const input = object(value);
  if (!input || !only(input, ['city', 'area', 'label'])) return null;
  const result: NeedTaskGeographyPoint = {};
  for (const key of ['city', 'area', 'label'] as const) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const text = locationText(input[key], key === 'label' ? 240 : 160);
    if (!text) return null;
    result[key] = text;
  }
  return Object.keys(result).length ? result : null;
}
export function normalizeTaskGeography(value: unknown): NeedTaskGeography | null {
  const input = object(value);
  if (!input || !only(input, ['mode', 'start', 'end', 'waypoints', 'serviceArea'])) return null;
  const modes = ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE'] as const;
  if (!modes.some(mode => mode === input.mode)) return null;
  // Null optional endpoints from old V2 providers mean absent, never GPS (0,0).
  const start = input.start == null ? undefined : point(input.start);
  const end = input.end == null ? undefined : point(input.end);
  const serviceArea = input.serviceArea == null ? undefined : point(input.serviceArea);
  if (start === null || end === null || serviceArea === null) return null;
  let waypoints: NeedTaskGeographyPoint[] = [];
  if (input.waypoints != null) {
    if (!Array.isArray(input.waypoints) || input.waypoints.length > 20) return null;
    for (const raw of input.waypoints) {
      const item = point(raw);
      if (!item) return null;
      waypoints.push(item);
    }
  }
  switch (input.mode) {
    case 'REMOTE': return start || end || serviceArea || waypoints.length ? null : { mode: 'REMOTE' };
    case 'STATIONARY': return !start || end || serviceArea || waypoints.length ? null : { mode: 'STATIONARY', start };
    case 'POINT_TO_POINT': return !start || !end || serviceArea || waypoints.length ? null : { mode: 'POINT_TO_POINT', start, end };
    case 'MULTI_STOP': return !start || serviceArea || (!end && !waypoints.length) ? null
      : { mode: 'MULTI_STOP', start, ...(end ? { end } : {}), ...(waypoints.length ? { waypoints } : {}) };
    case 'AREA_BASED': return end || waypoints.length || (!start && !serviceArea) ? null
      : { mode: 'AREA_BASED', ...(start ? { start } : {}), ...(serviceArea ? { serviceArea } : {}) };
    default: return null;
  }
}
export function normalizeNeedLocation(value: unknown): NeedLocationInput | null {
  const input = object(value);
  if (!input || !only(input, ['geography', 'exactAddress', 'accessNotes'])) return null;
  const geography = normalizeTaskGeography(input.geography);
  const exactAddress = locationPrivateText(input.exactAddress, 1000);
  const accessNotes = locationPrivateText(input.accessNotes, 2000);
  if (!geography || exactAddress === undefined || accessNotes === undefined) return null;
  if (geography.mode === 'REMOTE' && (exactAddress !== null || accessNotes !== null)) return null;
  return { geography, exactAddress, accessNotes };
}
export function coarsePosition(value: unknown): CoarsePosition | null {
  const input = object(value);
  if (!input || !only(input, ['latitude', 'longitude'])) return null;
  const { latitude, longitude } = input;
  const bounded = (x: unknown, bound: number): x is number => typeof x === 'number' && Number.isFinite(x)
    && Math.abs(x) <= bound && x === Number(x.toFixed(2));
  return bounded(latitude, 90) && bounded(longitude, 180) ? { latitude, longitude } : null;
}
export function normalizeWorkerLocation(value: unknown, allowIncomplete = false): WorkerLocationInput | null {
  const input = object(value);
  if (!input || !only(input, ['city', 'radiusKm', 'approximatePosition'])) return null;
  const city = allowIncomplete && input.city === '' ? '' : locationText(input.city, 160);
  const radiusKm = input.radiusKm;
  const position = input.approximatePosition === null ? null : coarsePosition(input.approximatePosition);
  if (city === null || typeof radiusKm !== 'number' || !Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 200
    || (input.approximatePosition !== null && !position)) return null;
  return { city, radiusKm, approximatePosition: position };
}
export const locationRevision = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export function sameNeedLocation(left: NeedLocationInput, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(normalizeNeedLocation(right));
}
export function sameWorkerLocation(left: WorkerLocationInput, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(normalizeWorkerLocation(right));
}
