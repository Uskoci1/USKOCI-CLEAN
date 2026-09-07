/** Formats persisted public fields only. It never reconstructs lost facts with AI. */
function strings(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) throw new Error('NEED_REQUIREMENTS_INVALID');
  return [...value];
}
function relation(value: any) {
  if (!Array.isArray(value)) return value;
  if (value.length > 1) throw new Error('NEED_PUBLIC_RELATION_INVALID');
  return value[0] ?? null;
}
function point(value: any): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('NEED_GEOGRAPHY_INVALID');
  const parts = [value.label, value.area, value.city].filter(part => part !== null && part !== undefined && part !== '');
  if (!parts.length || parts.some(part => typeof part !== 'string')) throw new Error('NEED_GEOGRAPHY_INVALID');
  return [...new Set(parts)].join(', ');
}
function geography(raw: any): string {
  const geo = relation(raw.need_geography)?.public_topology;
  if (!geo) {
    if (raw.execution_location_mode === 'REMOTE') return 'Daljinski';
    if (['POINT_TO_POINT', 'MULTI_STOP'].includes(raw.execution_location_mode)) throw new Error('NEED_ROUTE_NOT_LOADED');
    return [raw.approximate_area, raw.approximate_city].filter(Boolean).join(', ') || 'Lokacija nije navedena';
  }
  switch (geo.mode) {
    case 'REMOTE': return 'Daljinski';
    case 'STATIONARY': return point(geo.start);
    case 'AREA_BASED': return [geo.start, geo.serviceArea].filter(Boolean).map(point).join(' · ');
    case 'POINT_TO_POINT': return `${point(geo.start)} → ${point(geo.end)}`;
    case 'MULTI_STOP': {
      if (!Array.isArray(geo.waypoints)) throw new Error('NEED_GEOGRAPHY_INVALID');
      return [point(geo.start), ...geo.waypoints.map(point), ...(geo.end ? [point(geo.end)] : [])].join(' → ');
    }
    default: throw new Error('NEED_GEOGRAPHY_INVALID');
  }
}
function timestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('NEED_SCHEDULE_INVALID');
  return new Date(value).toLocaleString('sr-Latn-RS', { timeZone: 'Europe/Belgrade', timeZoneName: 'short' });
}
function schedule(raw: any): string {
  const start = timestamp(raw.starts_at), end = timestamp(raw.ends_at);
  const labels: Record<string, string> = { FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Daljinski, bilo kada',
    TODAY_FLEXIBLE: 'Fleksibilno · potvrđeno kao „danas“', TOMORROW_FLEXIBLE: 'Fleksibilno · potvrđeno kao „sutra“', WEEK_FLEXIBLE: 'Fleksibilno · potvrđeno kao „ove nedelje“' };
  if (raw.schedule_kind === 'FIXED_WINDOW') {
    if (!start || !end || Date.parse(raw.ends_at) <= Date.parse(raw.starts_at)) throw new Error('NEED_SCHEDULE_INVALID');
    return `${start} – ${end}`;
  }
  if (!raw.schedule_kind) return start ? `${start}${end ? ` – ${end}` : ''}` : 'Termin nije naveden';
  const label = labels[raw.schedule_kind];
  if (!label) throw new Error('NEED_SCHEDULE_INVALID');
  return `${label}${start ? ` · ${start}` : ''}${end ? ` – ${end}` : ''}`;
}
export function needDisplayProjection(raw: any) {
  const uslovi = [...strings(raw.required_skills), ...strings(raw.required_tools), ...strings(raw.required_vehicles),
    ...strings(raw.required_licenses).map(value => `Dozvola: ${value}`),
    ...strings(relation(raw.need_requirement_details)?.critical_conditions)];
  if (raw.minimum_experience_years !== null && raw.minimum_experience_years !== undefined) {
    if (!Number.isSafeInteger(raw.minimum_experience_years) || raw.minimum_experience_years < 0) throw new Error('NEED_REQUIREMENTS_INVALID');
    uslovi.push(`Iskustvo: najmanje ${raw.minimum_experience_years} godina`);
  }
  if (raw.verified_identity_required !== null && raw.verified_identity_required !== undefined) {
    if (typeof raw.verified_identity_required !== 'boolean') throw new Error('NEED_REQUIREMENTS_INVALID');
    if (raw.verified_identity_required) uslovi.push('Potreban potvrđen identitet');
  }
  return { podrucjeTekst: geography(raw), vremeTekst: schedule(raw), uslovi,
    kategorija: typeof raw.category === 'string' && raw.category.trim() ? raw.category : undefined,
    brojFotografija: strings(raw.public_photo_paths).length };
}
