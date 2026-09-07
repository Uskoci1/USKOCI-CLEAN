/** Display reference only: keep stored instants unchanged and name the displayed timezone. */
const date = new Intl.DateTimeFormat('sr-Latn-RS', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'numeric', year: 'numeric' });
const clock = new Intl.DateTimeFormat('sr-Latn-RS', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const suffix = ' (vreme u Srbiji)';

export function discoverySchedule(kind: string, startsAt: string | null, endsAt: string | null): string {
  const start = startsAt ? new Date(startsAt) : null, end = endsAt ? new Date(endsAt) : null;
  if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime()))) return 'Termin nije potpun';
  if (start && end) {
    if (end.getTime() <= start.getTime()) return 'Termin nije ispravan';
    const firstDay = date.format(start), lastDay = date.format(end);
    return firstDay === lastDay
      ? `${firstDay} · ${clock.format(start)}–${clock.format(end)}${suffix}`
      : `${firstDay} · ${clock.format(start)} – ${lastDay} · ${clock.format(end)}${suffix}`;
  }
  if (kind === 'FIXED_WINDOW') return 'Termin nije potpun';
  if (start) return `Od ${date.format(start)} · ${clock.format(start)}${suffix}`;
  if (end) return `Do ${date.format(end)} · ${clock.format(end)}${suffix}`;
  if (kind === 'FLEXIBLE') return 'Termin po dogovoru';
  if (kind === 'REMOTE_ANYTIME') return 'Vreme po dogovoru';
  // These legacy relative labels have no stored confirmation-date anchor.
  // Never turn an old "today/tomorrow" value into a new date using the device clock.
  if (kind === 'WEEK_FLEXIBLE') return 'Fleksibilno tokom nedelje · datumi nisu precizirani';
  if (kind === 'TODAY_FLEXIBLE' || kind === 'TOMORROW_FLEXIBLE') return 'Fleksibilno tokom dana · datum nije preciziran';
  return 'Termin nije naveden';
}

export function discoveryArea(mode: string, area: string, city: string): string {
  if (mode === 'REMOTE') return 'Na daljinu';
  const place = [area.trim(), city.trim()].filter(Boolean).join(', ') || 'Područje nije navedeno';
  if (mode === 'POINT_TO_POINT') return `Polazište: ${place}`;
  if (mode === 'MULTI_STOP') return `Prva stanica: ${place}`;
  if (mode === 'AREA_BASED') return `Područje rada: ${place}`;
  return place;
}
