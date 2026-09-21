/**
 * A time that two people agreed on, written so both of them read the same thing.
 *
 * The distinction this file exists to hold: a moment in the reader's own life — when a notification
 * arrived, when a receipt was written, when an export expires — belongs in the reader's timezone,
 * and `toLocaleString` with no zone is right for it. A time that is a TERM, proposed by one person
 * and accepted by another, does not. It must read the same on both phones.
 *
 * It was not reading the same. The requester saw a worker's proposed start through
 * `candidateClientService`, which pins Europe/Belgrade. The worker saw their own proposal through
 * `applicationClientService`, which called `toLocaleString` with no zone at all. Same instant, two
 * screens, and on a phone set to another zone, two different times for the thing being agreed.
 *
 * A task's own schedule has a better answer than this one: `needScheduleText` uses the timezone
 * saved with the task and names it. An application's proposed window does not carry that timezone
 * in its payload, so this pins the zone the reviewed code already pinned, rather than inventing a
 * third behaviour. When the payload starts carrying the task's timezone, this is the one place that
 * has to change.
 */
const ZONE = 'Europe/Belgrade';

export function dogovorenoVreme(value: unknown, fallback = 'Po dogovoru'): string {
  if (typeof value !== 'string' || !value) return fallback;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return fallback;
  return instant.toLocaleString('sr-Latn-RS', {
    timeZone: ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
