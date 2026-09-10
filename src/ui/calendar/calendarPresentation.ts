import { calendarInstant } from '../../lib/calendarTime';

const pad = (value: number) => String(value).padStart(2, '0');
export function deviceDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
export function deviceTime(value: Date): string { return `${pad(value.getHours())}:${pad(value.getMinutes())}`; }
export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function zonedParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` };
}
/** Resolve civil input in its saved zone; DST gaps and repeated times require an explicit choice. */
export function civilInstant(date: string, time: string, timezone: string): { value: string | null; error: string | null } {
  const fullTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const target = calendarInstant(`${date}T${fullTime}Z`);
  if (target === null) return { value: null, error: 'Izaberite ispravan datum i vreme.' };
  const milliseconds = Number(target / 1000n);
  try {
    // Sample both sides of every possible nearby transition, then round-trip candidates.
    const offsets = new Set<number>();
    for (const hours of [-48, -24, 0, 24, 48]) {
      const probe = new Date(milliseconds + hours * 3_600_000);
      const wall = zonedParts(probe, timezone);
      offsets.add(Date.parse(`${wall.date}T${wall.time}Z`) - probe.getTime());
    }
    const candidates = [...offsets].map(offset => new Date(milliseconds - offset))
      .filter(candidate => {
        const wall = zonedParts(candidate, timezone);
        return wall.date === date && wall.time === fullTime;
      });
    if (candidates.length !== 1) return { value: null, error: candidates.length === 0
      ? 'Ovo vreme ne postoji zbog pomeranja sata. Izaberite drugo vreme.'
      : 'Ovo vreme se ponavlja zbog pomeranja sata. Izaberite nedvosmisleno vreme.' };
    return { value: candidates[0].toISOString(), error: null };
  } catch { return { value: null, error: 'Proverite vremensku zonu.' }; }
}
export function weekDates(selected: string): string[] {
  const day = new Date(`${selected}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(selected, -((day + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
export function localDayRange(day: string) {
  // Calendar navigation follows the device zone, including 23/25-hour local days.
  return { from: new Date(`${day}T00:00:00`).toISOString(), to: new Date(`${shiftDate(day, 1)}T00:00:00`).toISOString() };
}
export function displayDate(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('sr-Latn-RS', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}
export function overlapsInterval(start: string, end: string, from: string, to: string): boolean {
  const starts = calendarInstant(start), ends = calendarInstant(end), rangeStart = calendarInstant(from), rangeEnd = calendarInstant(to);
  return starts !== null && ends !== null && rangeStart !== null && rangeEnd !== null && starts < rangeEnd && ends > rangeStart;
}
export function displayTime(instant: string): string {
  const match = /T\d{2}:\d{2}:(\d{2})(?:\.(\d+))?/.exec(instant);
  const fraction = (match?.[2] ?? '').replace(/0+$/, '');
  const detailed = match?.[1] !== '00' || !!fraction;
  const time = new Date(instant).toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit', ...(detailed ? { second: '2-digit' as const } : {}) });
  return fraction ? `${time}.${fraction}` : time;
}
export const weekdays = [
  { day: 1, short: 'Pon', name: 'Ponedeljak' }, { day: 2, short: 'Uto', name: 'Utorak' },
  { day: 3, short: 'Sre', name: 'Sreda' }, { day: 4, short: 'Čet', name: 'Četvrtak' },
  { day: 5, short: 'Pet', name: 'Petak' }, { day: 6, short: 'Sub', name: 'Subota' },
  { day: 0, short: 'Ned', name: 'Nedelja' },
] as const;
