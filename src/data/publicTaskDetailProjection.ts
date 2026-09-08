import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../contracts/needFactsV2';
import type { JavniMaterijal, PrilikaDetaljiProjekcija } from '../contracts/publicTaskDetail';

type Row = Record<string, unknown>;
type Material = Pick<PrilikaDetaljiProjekcija,
  'revision' | 'opis' | 'kategorija' | 'zahtevi' | 'javnaGeografija' | 'kriticniUslovi'>;
const MODES = ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE'];
const STATUSES = ['DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(): never { throw new Error('PUBLIC_TASK_MATERIAL_INVALID'); }
function record(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Row;
}
function keys(row: Row, allowed: readonly string[]) {
  if (Object.keys(row).some(key => !allowed.includes(key))) invalid();
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > max) return invalid();
  return value;
}
function list(value: unknown): string[] {
  // Existing V2 text-array contract: at most50 nonblank strings, each at most500 codepoints.
  if (!Array.isArray(value) || value.length > 50) return invalid();
  return value.map(item => {
    const result = text(item, 500);
    if (Array.from(result).length > 500) return invalid();
    return result;
  });
}
function point(value: unknown): NeedTaskGeographyPoint | undefined {
  if (value === undefined || value === null) return undefined;
  const row = record(value);
  keys(row, ['label', 'city', 'area']);
  const result: NeedTaskGeographyPoint = {};
  for (const key of ['label', 'city', 'area'] as const) {
    // Canonical public topology accepts nullable/absent reference members.
    if (row[key] === undefined || row[key] === null) continue;
    if (typeof row[key] !== 'string') return invalid();
    const value = row[key].trim();
    if (Array.from(value).length > (key === 'label' ? 240 : 160)) return invalid();
    if (value) result[key] = value;
  }
  if (!Object.keys(result).length) return invalid();
  return result;
}
function geography(value: unknown, parentMode: unknown): NeedTaskGeography {
  const row = record(value);
  keys(row, ['mode', 'start', 'end', 'waypoints', 'serviceArea']);
  if (typeof row.mode !== 'string' || !MODES.includes(row.mode) || row.mode !== parentMode) return invalid();
  const start = point(row.start), end = point(row.end), serviceArea = point(row.serviceArea);
  const rawWaypoints = row.waypoints === undefined ? [] : row.waypoints;
  if (!Array.isArray(rawWaypoints) || rawWaypoints.length > 20) return invalid();
  const waypoints = rawWaypoints.map(value => point(value) ?? invalid());
  if ((row.mode === 'REMOTE' && (start || end || serviceArea || waypoints.length))
    || (row.mode === 'STATIONARY' && (!start || end || serviceArea || waypoints.length))
    || (row.mode === 'POINT_TO_POINT' && (!start || !end || serviceArea || waypoints.length))
    || (row.mode === 'MULTI_STOP' && (!start || serviceArea || (!end && !waypoints.length)))
    || (row.mode === 'AREA_BASED' && (end || waypoints.length || (!start && !serviceArea)))) return invalid();
  return {
    mode: row.mode as NeedTaskGeography['mode'],
    ...(start ? { start } : {}), ...(end ? { end } : {}),
    ...(waypoints.length ? { waypoints } : {}), ...(serviceArea ? { serviceArea } : {}),
  };
}
function child<T>(value: unknown, id: string, field: string, parse: (value: unknown) => T): JavniMaterijal<T> {
  if (value === null) return { state: 'unavailable' };
  const row = record(value);
  // PK/FK embeds are one-to-one objects. Never silently choose an array's first child.
  keys(row, ['need_id', field]);
  if (row.need_id !== id) return invalid();
  return { state: 'available', value: parse(row[field]) };
}

/** Projects only the documented public material; extra parent fields cannot flow into the DTO. */
export function publicTaskMaterial(raw: unknown, requestedId: string): Material {
  const row = record(raw);
  if (row.id !== requestedId || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1
    || (row.revision as number) > 2147483647
    || typeof row.requester_profile_id !== 'string' || row.requester_profile_id.length !== 36 || !UUID.test(row.requester_profile_id)
    || typeof row.status !== 'string' || !STATUSES.includes(row.status)
    || typeof row.verified_identity_required !== 'boolean'
    || (row.minimum_experience_years !== null && (!Number.isInteger(row.minimum_experience_years)
      || (row.minimum_experience_years as number) < 0 || (row.minimum_experience_years as number) > 60))) return invalid();
  text(row.title, 140);
  return {
    revision: row.revision as number, opis: text(row.description, 6000), kategorija: text(row.category, 120),
    zahtevi: {
      vestine: list(row.required_skills), alati: list(row.required_tools), vozila: list(row.required_vehicles),
      licence: list(row.required_licenses), minimalnoIskustvoGodina: row.minimum_experience_years as number | null,
      zahtevaProverenIdentitet: row.verified_identity_required,
    },
    javnaGeografija: child(row.geography, requestedId, 'public_topology', value => geography(value, row.execution_location_mode)),
    kriticniUslovi: child(row.requirementDetails, requestedId, 'critical_conditions', list),
  };
}
