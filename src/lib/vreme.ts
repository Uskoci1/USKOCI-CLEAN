import { displayDate, zonedParts } from '../ui/calendar/calendarPresentation';

/**
 * One way to write a moment, everywhere (the forensic UI/UX analysis, 2026-09-23): "24. sep · 12:00".
 *
 * Thirteen places wrote a moment their own way before this: `toLocaleString('sr-Latn-RS')` with seconds ("23. 9. 2026.
 * 14:05:33"), day and month as numbers ("23.09. 14:05"), the year always, the year never. The rule is one:
 * - the day as "24. sep", the year only when it is not the current one;
 * - the clock to the minute, seconds never (the stored instant keeps its full precision; a person reads minutes);
 * - a moment of the reader's own life (a notification, a message, a receipt, an export that expires) reads in the
 *   phone's zone; an agreed TERM reads in Serbian time and says so on a phone set elsewhere (dogovorenoVreme.ts);
 * - two times of one day are joined, "12:00–19:00", by needScheduleText.
 */
export function zonaTelefona(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
}

export type VremeOpcije = {
  /** The zone the moment is read in; the phone's own when absent. An agreed term passes Serbian time. */
  zona?: string;
  /** A moment of today is its clock alone ("14:05"), as a conversation or an inbox writes it. */
  danas?: boolean;
  /** What to write when there is no valid moment to write. */
  inace?: string;
  /** "Now", for the current year and for today; fixed only by tests. */
  sada?: Date;
};

export function vreme(value: string | number | Date | null | undefined, { zona, danas = false, inace = '', sada }: VremeOpcije = {}): string {
  const instant = value instanceof Date ? value : typeof value === 'number' || (typeof value === 'string' && value) ? new Date(value) : null;
  if (!instant || Number.isNaN(instant.getTime())) return inace;
  try {
    const zone = zona ?? zonaTelefona() ?? 'UTC';
    const parts = zonedParts(instant, zone), today = zonedParts(sada ?? new Date(), zone);
    const clock = parts.time.slice(0, 5);
    if (danas && parts.date === today.date) return clock;
    const year = parts.date.slice(0, 4);
    const day = year === today.date.slice(0, 4) ? displayDate(parts.date) : `${displayDate(parts.date)} ${year}`;
    return `${day} · ${clock}`;
  } catch { return inace; }
}

/**
 * A window, spelled once: "24. sep · 09:15–10:45" inside one day, "24. sep · 22:00 – 25. sep · 06:00" across two, and a
 * single time when both ends fall in the same minute.
 */
export function raspon(start: string | Date | null | undefined, end: string | Date | null | undefined, opcije: VremeOpcije = {}): string {
  const from = vreme(start, { ...opcije, danas: false }), to = vreme(end, { ...opcije, danas: false });
  if (!from || !to) return from || to || opcije.inace || '';
  const [fromDay, fromClock] = from.split(' · '), [toDay, toClock] = to.split(' · ');
  if (fromDay !== toDay) return `${from} – ${to}`;
  return fromClock === toClock ? from : `${fromDay} · ${fromClock}–${toClock}`;
}
