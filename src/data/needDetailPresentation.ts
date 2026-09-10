import type { NeedScheduleProjection, PotrebaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { locationSlots } from '../lib/location';
import { displayDate, zonedParts } from '../ui/calendar/calendarPresentation';

const SCHEDULE: Record<NeedScheduleProjection['kind'], string> = {
  FIXED_WINDOW: 'Tačan termin', FLEXIBLE: 'Fleksibilan termin', REMOTE_ANYTIME: 'Na daljinu, fleksibilno',
  TODAY_FLEXIBLE: 'Danas, fleksibilno', TOMORROW_FLEXIBLE: 'Sutra, fleksibilno', WEEK_FLEXIBLE: 'Ove nedelje, fleksibilno',
};
const GEOGRAPHY = { STATIONARY: 'Na jednom mestu', POINT_TO_POINT: 'Od mesta do mesta', MULTI_STOP: 'Više stanica', AREA_BASED: 'Na području', REMOTE: 'Na daljinu' };
/** Presentation follows the saved task zone. Historical unknown zones are explicitly UTC. */
export function needScheduleText(schedule: NeedScheduleProjection, timezone?: string): string {
  const zone = timezone ?? 'UTC';
  const instant = (value: string | null) => {
    const parsed = calendarInstant(value);
    if (parsed === null) return null;
    const ms = parsed >= 0n ? parsed / 1000n : (parsed - 999n) / 1000n;
    try {
      const parts = zonedParts(new Date(Number(ms)), zone);
      const fraction = /\.(\d+)(?:Z|[+-])/.exec(value!)?.[1];
      const time = parts.time.endsWith(':00') && !fraction?.replace(/0/g, '') ? parts.time.slice(0, 5)
        : parts.time + (fraction ? `.${fraction}` : '');
      const wall = calendarInstant(`${parts.date}T${parts.time}Z`)!;
      const second = parsed >= 0n ? parsed / 1_000_000n : (parsed - 999_999n) / 1_000_000n;
      const offsetMinutes = Number((wall - second * 1_000_000n) / 60_000_000n);
      const offset = `UTC${offsetMinutes < 0 ? '−' : '+'}${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;
      return { text: `${displayDate(parts.date)} ${parts.date.slice(0, 4)} · ${time}`, offset };
    } catch { return null; }
  };
  const start = instant(schedule.startsAt), end = instant(schedule.endsAt);
  // Repeated civil times across a DST change need both offsets to remain exact.
  const shifted = start && end && start.offset !== end.offset;
  const range = start && end ? `${start.text}${shifted ? ` ${start.offset}` : ''} – ${end.text}${shifted ? ` ${end.offset}` : ''}`
    : start ? `Od ${start.text}` : end ? `Do ${end.text}` : null;
  const preference = schedule.kind === 'FIXED_WINDOW' ? '' : schedule.kind === 'REMOTE_ANYTIME' ? 'Na daljinu, fleksibilno · ' : 'Fleksibilan raspon · ';
  return range ? `${preference}${range} (${timezone ?? 'UTC · zona nije navedena'})`
    : schedule.kind === 'FIXED_WINDOW' ? 'Tačan termin nije potpun' : SCHEDULE[schedule.kind];
}
export function needGeographyRows(need: PotrebaProjekcija): { label: string; value: string }[] {
  const geo = need.detalji?.geografija;
  if (!geo) return [{ label: 'Približno područje', value: need.podrucjeTekst }];
  if (geo.mode === 'REMOTE') return [{ label: 'Način izvršenja', value: 'Na daljinu' }];
  return [{ label: 'Način izvršenja', value: GEOGRAPHY[geo.mode] }, ...locationSlots(geo).map(slot => {
    const point = slot === 'start' ? geo.start : slot === 'end' ? geo.end : slot === 'serviceArea' ? geo.serviceArea : geo.waypoints?.[Number(slot.split('/')[1])];
    return { label: slot === 'start' ? geo.mode === 'STATIONARY' ? 'Mesto' : 'Polazište' : slot === 'end' ? 'Odredište'
      : slot === 'serviceArea' ? 'Područje' : `Stanica ${Number(slot.split('/')[1]) + 1}`,
      value: [point?.label, point?.city, point?.area].filter(value => value !== undefined).join(' · ') };
  })];
}
export function needRequirementRows(need: PotrebaProjekcija): { label: string; value: string }[] {
  const requirements = need.detalji?.zahtevi;
  if (!requirements) return need.uslovi.length ? [{ label: 'Uslovi', value: need.uslovi.map(value => `• ${value}`).join('\n') }] : [];
  const groups: [string, string[] | null][] = [['Veštine', requirements.vestine], ['Alat', requirements.alati], ['Vozilo', requirements.vozila],
    ['Dozvole', requirements.dozvole], ['Bitni uslovi', requirements.bitniUslovi]];
  return [...groups.filter(([, values]) => values?.length).map(([label, values]) => ({ label, value: values!.map(value => `• ${value}`).join('\n') })),
    ...(requirements.iskustvoGodina !== null ? [{ label: 'Najmanje iskustva', value: `${requirements.iskustvoGodina} god.` }] : []),
    ...(requirements.potvrdjenIdentitet ? [{ label: 'Identitet', value: 'Potreban je potvrđen identitet' }] : [])];
}
export function needPeopleText(count: number): string {
  const last = count % 10, lastTwo = count % 100;
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? 'osoba' : last >= 2 && last <= 4 ? 'osobe' : 'osoba'}`;
}
