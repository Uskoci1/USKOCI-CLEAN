// EX-06 S04: local-calendar helpers of the window scenario (pure; Intl only). A "tomorrow" task is matched against the local calendar day after its PUBLICATION instant (ex06a decision), so
// the fixtures must be built from the stored published_at and the task's zone, never from the clock of the proof.
import {DAY, MINUTE, utcOffsetMinutes, zonedParts} from '../../lib/timeutil.mjs';

/** A calendar date 'YYYY-MM-DD' moved by n days (pure date arithmetic, no zone). */
export const addDays = (dateText, n) => new Date(Date.parse(dateText + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);

/** The UTC instant (ms) of a wall-clock moment ('YYYY-MM-DD', 'HH:MM:SS') in a time zone. Two passes make it right on the days the offset changes; an ambiguous or missing hour is not asked for. */
export function localInstantMs(dateText, timeText, tz) {
  const [year, month, day] = dateText.split('-').map(Number);
  const [hour, minute, second] = timeText.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second ?? 0);
  const first = wall - utcOffsetMinutes(wall, tz) * MINUTE;
  return wall - utcOffsetMinutes(first, tz) * MINUTE;
}

const weekdayOfDate = dateText => new Date(Date.parse(dateText + 'T00:00:00Z')).getUTCDay();

/**
 * The local day after the instant `ms` in `tz`: its date, its weekday (0 = Sunday, as extract(dow)), its start and end as instants (a 23 or 25 hour day on a DST change) and the day after
 * it ({date, weekday}).
 */
export function tomorrowOf(ms, tz) {
  const today = zonedParts(ms, tz).date;
  const date = addDays(today, 1), after = addDays(today, 2);
  return {today, date, weekday: weekdayOfDate(date), startMs: localInstantMs(date, '00:00:00', tz), endMs: localInstantMs(after, '00:00:00', tz), dayAfter: {date: after, weekday: weekdayOfDate(after)}};
}

/**
 * How long to wait before a scenario that depends on the local day (tomorrow, the rest of the week) may start: 0 unless the local clock is within `guardMinutes` before midnight, then until three
 * minutes after that midnight. A publication a minute before midnight would move "tomorrow" under the fixtures.
 */
export function midnightGuardWaitMs(nowMs, tz, {guardMinutes = 12} = {}) {
  const parts = zonedParts(nowMs, tz);
  const intoDay = (parts.hour * 60 + parts.minute) * MINUTE + parts.second * 1000;
  const untilMidnight = DAY - intoDay;
  return untilMidnight <= guardMinutes * MINUTE ? untilMidnight + 3 * MINUTE : 0;
}
