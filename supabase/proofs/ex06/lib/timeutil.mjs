// EX-06 S03/S04: time helpers of the harness fixtures. Pure module (Intl only; no database, no network).
//   * relative times ('@now+3d') and the REBASE of a corpus that carries absolute timestamps written against its own clock (corpus.clock.nowUtc);
//   * the Europe/Belgrade local weekday / time of day of an instant (DST-safe, through Intl);
//   * the weekly rule or availability window that covers a task's window, and the worker availability a corpus availability SHAPE stands for.
import {randomUUID} from 'node:crypto';
import {HarnessInputError} from './compare.mjs';

export const BELGRADE = 'Europe/Belgrade';
export const MINUTE = 60000, HOUR = 3600000, DAY = 86400000;
/** A fixed window must start at least this far after the CI clock, otherwise the fixture is refused (the corpus has aged out or the rebase is wrong). */
export const FUTURE_MARGIN_MS = 30 * MINUTE;

const ISO = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
const formatters = new Map();
function formatter(tz) {
  if (!formatters.has(tz)) {
    formatters.set(tz, new Intl.DateTimeFormat('en-US', {timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}));
  }
  return formatters.get(tz);
}
const two = value => String(value).padStart(2, '0');

/** The wall-clock parts of an instant in a time zone: {year, month, day, hour, minute, second, weekday (0 = Sunday, as extract(dow)), date 'YYYY-MM-DD', time 'HH:MM:SS'}. */
export function zonedParts(ms, tz = BELGRADE) {
  const parts = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  const hour = parts.hour % 24;
  return {year: parts.year, month: parts.month, day: parts.day, hour, minute: parts.minute, second: parts.second, weekday: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(),
    date: `${parts.year}-${two(parts.month)}-${two(parts.day)}`, time: `${two(hour)}:${two(parts.minute)}:${two(parts.second)}`};
}

/** The UTC offset of a time zone at an instant, in minutes (Europe/Belgrade: 60 in winter, 120 in summer). */
export function utcOffsetMinutes(ms, tz = BELGRADE) {
  const parts = zonedParts(ms, tz);
  return Math.round((Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - Math.floor(ms / 1000) * 1000) / MINUTE);
}

const nextDate = date => new Date(Date.parse(date + 'T00:00:00Z') + DAY).toISOString().slice(0, 10);
const trimZ = iso => iso.replace(/\.\d{3}Z$/, 'Z');

/** '@now', '@now+3d', '@now+1d+2h', '@now-90m' -> ISO-8601 UTC without milliseconds. Any other value is returned unchanged. Pure given nowMs. */
export function resolveRelativeTime(value, nowMs) {
  if (typeof value !== 'string' || !value.startsWith('@now')) return value;
  const match = /^@now((?:[+-]\d+[dhm])*)$/.exec(value);
  if (!match) throw new HarnessInputError('RELATIVE_TIME_INVALID', value);
  let offset = 0;
  for (const part of match[1].matchAll(/([+-])(\d+)([dhm])/g)) {
    const unit = {d: DAY, h: HOUR, m: MINUTE}[part[3]];
    offset += (part[1] === '-' ? -1 : 1) * Number(part[2]) * unit;
  }
  return trimZ(new Date(nowMs + offset).toISOString());
}

/** {ms, offsetMinutes, offsetText} of an ISO-8601 timestamp with an offset (the only shape the product accepts); anything else throws. */
export function parseIso(value) {
  const match = typeof value === 'string' ? ISO.exec(value) : null;
  if (!match) throw new HarnessInputError('TIMESTAMP_SHAPE_INVALID', String(value));
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new HarnessInputError('TIMESTAMP_SHAPE_INVALID', String(value));
  const offsetText = match[3];
  const offsetMinutes = offsetText === 'Z' ? 0 : (offsetText[0] === '-' ? -1 : 1) * (Number(offsetText.slice(1, 3)) * 60 + Number(offsetText.slice(4, 6)));
  return {ms, offsetMinutes, offsetText};
}

/** The instant shifted by deltaMs and written with the SAME offset text as the original ('+02:00' stays '+02:00'): durations are preserved, fractions of a second are dropped. */
export function rebaseIso(value, deltaMs) {
  const {ms, offsetMinutes, offsetText} = parseIso(value);
  const local = new Date(ms + deltaMs + offsetMinutes * MINUTE).toISOString().slice(0, 19);
  return local + offsetText;
}

/** delta = CI now - corpus clock. Recorded in the report so a reader can reverse it. */
export function computeRebase({ciNowMs, corpusNowUtc}) {
  const corpusMs = Date.parse(corpusNowUtc);
  if (Number.isNaN(corpusMs)) throw new HarnessInputError('CORPUS_CLOCK_INVALID', String(corpusNowUtc));
  const deltaMs = ciNowMs - corpusMs;
  return {deltaMs, deltaHours: Math.round((deltaMs / HOUR) * 100) / 100, ciNowUtc: trimZ(new Date(ciNowMs).toISOString()), corpusNowUtc: trimZ(new Date(corpusMs).toISOString())};
}

/**
 * The facts of a case with every time made concrete: '@now' forms resolved against the CI clock, absolute timestamps shifted by the rebase delta (when the corpus has a clock),
 * the shape checked, and a window that is not in the future refused (CASE_TIME_NOT_FUTURE). Only need.starts_at / need.ends_at are touched.
 * Returns {facts, interval: {startMs, endMs, startsAt, endsAt} | null, rebased: [keys]}.
 */
export function materialiseTimes(facts, {nowMs, rebase = null, marginMs = FUTURE_MARGIN_MS} = {}) {
  const out = JSON.parse(JSON.stringify(facts)), rebased = [];
  for (const key of ['need.starts_at', 'need.ends_at']) {
    if (!(key in out)) continue;
    const raw = out[key];
    if (typeof raw === 'string' && raw.startsWith('@now')) out[key] = resolveRelativeTime(raw, nowMs);
    else if (rebase) { out[key] = rebaseIso(raw, rebase.deltaMs); rebased.push(key); }
    parseIso(out[key]);
  }
  const startMs = 'need.starts_at' in out ? parseIso(out['need.starts_at']).ms : null, endMs = 'need.ends_at' in out ? parseIso(out['need.ends_at']).ms : null;
  if ((startMs === null) !== (endMs === null)) throw new HarnessInputError('CASE_TIME_INCOMPLETE', 'need.starts_at and need.ends_at must both be present or both absent');
  if (startMs === null) return {facts: out, interval: null, rebased};
  if (startMs >= endMs) throw new HarnessInputError('CASE_TIME_ORDER', `${out['need.starts_at']} >= ${out['need.ends_at']}`);
  const fixed = out['need.schedule_kind'] === 'FIXED_WINDOW';
  if ((fixed ? startMs : endMs) < nowMs + marginMs) {
    throw new HarnessInputError('CASE_TIME_NOT_FUTURE', `${out['need.starts_at']}..${out['need.ends_at']} is not at least ${Math.round(marginMs / MINUTE)} minutes after ${trimZ(new Date(nowMs).toISOString())} (rebase it with the corpus clock)`);
  }
  return {facts: out, interval: {startMs, endMs, startsAt: out['need.starts_at'], endsAt: out['need.ends_at']}, rebased};
}

/**
 * What covers [startMs, endMs) in the worker's availability: a weekly rule when the window sits inside ONE local day of the zone (or ends exactly at local midnight) and no DST
 * transition lies within three hours of either end; otherwise an AVAILABLE window with the exact instants. Rules use the 0 = Sunday weekday of extract(dow).
 */
export function coverageFor(startMs, endMs, {tz = BELGRADE, newId = randomUUID, label = 'EX-06 fixture'} = {}) {
  if (!(Number.isFinite(startMs) && Number.isFinite(endMs) && startMs < endMs)) throw new HarnessInputError('COVERAGE_WINDOW_INVALID', `${startMs}..${endMs}`);
  const s = zonedParts(startMs, tz), e = zonedParts(endMs, tz);
  const endsAtMidnight = e.time === '00:00:00' && nextDate(s.date) === e.date;
  const offsets = [startMs - 3 * HOUR, startMs, endMs, endMs + 3 * HOUR].map(ms => utcOffsetMinutes(ms, tz));
  const stable = offsets.every(offset => offset === offsets[0]);
  if ((s.date === e.date || endsAtMidnight) && stable) {
    const endTime = endsAtMidnight ? '24:00:00' : e.time;
    if (s.time < endTime) return {kind: 'RULE', rule: {id: newId(), weekdays: [s.weekday], startTime: s.time, endTime, startsOn: s.date, endsOn: null, label, active: true}};
  }
  return {kind: 'WINDOW', window: {id: newId(), startsAt: trimZ(new Date(startMs).toISOString()), endsAt: trimZ(new Date(endMs).toISOString()), state: 'AVAILABLE', label}};
}

// The four availability shapes of the S02 corpus (availabilityShapes), and what each stands for in the product's availability document.
export const AVAILABILITY_SHAPES = Object.freeze({
  AVAILABLE_NOW_AND_SCHEDULED: 'availableNow true and a weekly rule (or window) covers the task time',
  SCHEDULED_ONLY: 'availableNow false, a weekly rule (or window) covers the task time',
  AVAILABLE_NOW_ONLY: 'availableNow true, nothing covers the task time',
  NONE_DECLARED: 'availableNow false and nothing covers the task time',
});

/** {startMs, endMs} of a task window: given as such, or read from materialised task facts ('need.starts_at' / 'need.ends_at'); null for a task without one. */
export function intervalOf(taskFactsOrInterval) {
  const value = taskFactsOrInterval;
  if (value === null || value === undefined) return null;
  if ('startMs' in value) return value;
  if (!('need.starts_at' in value) || !('need.ends_at' in value)) return null;
  return {startMs: parseIso(value['need.starts_at']).ms, endMs: parseIso(value['need.ends_at']).ms};
}

/**
 * The worker availability document of a shape for a task. `taskFactsOrInterval` = the materialised facts of the task ('need.starts_at' / 'need.ends_at') or {startMs, endMs} of its (rebased)
 * window, or null for a task without one (then nothing can be "covered": a shape that needs coverage is refused). Returns {availability: {timezone, availableNow, rules, windows},
 * coverage: 'RULE'|'WINDOW'|'NONE'}.
 */
export function availabilityFor(shape, taskFactsOrInterval, {tz = BELGRADE, newId = randomUUID} = {}) {
  const interval = intervalOf(taskFactsOrInterval);
  if (!(shape in AVAILABILITY_SHAPES)) throw new HarnessInputError('AVAILABILITY_SHAPE_UNKNOWN', String(shape));
  const wantsCoverage = shape === 'AVAILABLE_NOW_AND_SCHEDULED' || shape === 'SCHEDULED_ONLY';
  const availableNow = shape === 'AVAILABLE_NOW_AND_SCHEDULED' || shape === 'AVAILABLE_NOW_ONLY';
  if (!wantsCoverage || !interval) {
    if (shape === 'SCHEDULED_ONLY' && !interval) throw new HarnessInputError('AVAILABILITY_SHAPE_NEEDS_A_TASK_WINDOW', shape);
    return {availability: {timezone: tz, availableNow, rules: [], windows: []}, coverage: 'NONE'};
  }
  const cover = coverageFor(interval.startMs, interval.endMs, {tz, newId});
  return {availability: {timezone: tz, availableNow, rules: cover.kind === 'RULE' ? [cover.rule] : [], windows: cover.kind === 'WINDOW' ? [cover.window] : []}, coverage: cover.kind};
}
