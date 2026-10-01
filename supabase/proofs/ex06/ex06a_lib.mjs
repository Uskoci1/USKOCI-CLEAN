// EX-06 ex06a (flexible-window dispatch fix): the pure part of the proof. No database, no dependency, no import of supabase/proofs/ex06/lib (that directory has another writer): everything here
// is tested offline by ex06a_lib.test.mjs, and ex06a_proof.mjs only adds the database calls around it.
//
//   * zone arithmetic written independently of the SQL (Intl only);
//   * derivedWindow() / SEMANTICS: the OWNER SEMANTIC for a TOMORROW_FLEXIBLE / WEEK_FLEXIBLE task stored without a window (mirrors WINDOW_BLOCK of build_ex06a.py: change both together);
//   * admittedOracle(): an executable JS port of the whole first target (stored window, derived window, flexible rule, live-intent path) and codesOracle(): the two schedule codes of the second target
//     (private.match_detail_without_calendar, including the CURRENT_AVAILABILITY_PAUSED coupling that ex06a edits). Both take the semantics as a parameter so the offline tests can replay the matrix with a
//     MUTANT semantics and show that a wrong implementation is killed (the mutation tests of ex06a_lib.test.mjs);
//   * buildMatrix(): the function-level scenario matrix with deterministic anchors (the anchor is published_at, so the proof can place it months ahead and test DST days, week boundaries, the
//     local-versus-UTC day and the anchor day of a New York task without controlling the clock); buildClockFamily(): the cases that depend on the clock (the week that is still running, the rest of
//     today), which the proof installs afresh before every read;
//   * fixtureSql() / evaluationSql(): the labelled direct fixtures (replica role, like ex04a) and the read of the functions per (task, worker) pair;
//   * pairProblems(): what the proof asserts of one pair (the gate, the COMPLETE blocker lists, the eligibility); detailProblems() / detailDelta(): what the full match_detail may and may not change
//     between the predecessor and the candidate;
//   * outcomeOf() / diffOutcomes() / checkFlips() / corpusCoverageProblems(): the corpus before/after diff, the explicit allow-list of the intended flips (INTENDED_FLIPS) and the guards against a
//     vacuous corpus pass (coverage, exact adjusted-worker list, detail capture, product path, the narrow-fixture assumptions, the same stored times and rebase in every pass);
//   * augmentSpec(): the one fixture adjustment of the proof (documented there).
import {createHash} from 'node:crypto';

export const TARGET = 'private.worker_dispatch_time_admitted(uuid,uuid)';
export const DETAIL_TARGET = 'private.match_detail_without_calendar(uuid,uuid)';
export const OLD_MD5 = '5b5f0deef20d76ae4e752fe2a7dcc41f';
export const DETAIL_OLD_MD5 = '9180606a038f3606b0906ab4aefdd0c1';
export const BELGRADE = 'Europe/Belgrade';
export const NEW_YORK = 'America/New_York';
export const DAY = 86400000, HOUR = 3600000, MINUTE = 60000;
export const FLEXIBLE_KINDS = Object.freeze(['TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE']);
export const SCHEDULE_CODES = Object.freeze(['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY']);
/** The definition the candidate implements (the words of WINDOW_BLOCK in build_ex06a.py). Printed in the report; changing the semantic means changing this, the block and the oracle together. */
export const WINDOW_DEFINITION = Object.freeze({
  owner: '"sutra" = the corresponding next local calendar day; "ove nedelje" = the remaining part of the corresponding local week; no invented hour and no narrower window (owner, 2026-10-01)',
  anchor: 'needs.published_at, as private.relative_schedule_end_v5; a task without published_at keeps the refusal (no rolling anchor)',
  zone: 'needs.task_timezone when it is a valid zone, else Europe/Belgrade (never the worker zone); the weekly rules are read on the worker zone',
  tomorrow: '[local midnight after the anchor day, the next local midnight)',
  week: '[local midnight of the anchor day, local midnight after the Sunday of that local Monday-Sunday week) = the remaining part of the week once the existing body clips the start to now',
  oneBound: 'a task with exactly one stored bound is NOT derived (it stays refused: open finding F4)',
  rule: 'unchanged: some real available time inside the window (private.worker_available_periods <> empty); the live intent (available_now) does not count',
  pausedCode: 'private.match_detail_without_calendar: a window-less published TOMORROW/WEEK task counts as future availability for CURRENT_AVAILABILITY_PAUSED (as W02 does for a stored window); live intent alone invents no availability',
});

// ------------------------------------------------------------------ zone arithmetic
const formats = new Map();
function format(zone) {
  if (!formats.has(zone)) {
    formats.set(zone, new Intl.DateTimeFormat('en-US', {timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short'}));
  }
  return formats.get(zone);
}
/** The test of private.availability_timezone_valid for the zones the proof uses: 'UTC' or a zone with a slash that the platform knows. */
export function validZone(zone) {
  if (typeof zone !== 'string' || zone.length === 0 || zone.length > 100) return false;
  if (!(zone === 'UTC' || zone.includes('/')) || zone.startsWith('posix/') || zone.startsWith('right/')) return false;
  try { format(zone); return true; } catch { return false; }
}
const WEEKDAY = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6};
/** {date: 'YYYY-MM-DD', time: 'HH:MM:SS', weekday: 0 (Sunday) .. 6} of an instant on a zone's wall clock. */
export function localParts(ms, zone) {
  const parts = Object.fromEntries(format(zone).formatToParts(new Date(ms)).map(part => [part.type, part.value]));
  return {date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}`, weekday: WEEKDAY[parts.weekday]};
}
const wholeSeconds = ms => ms - (((ms % 1000) + 1000) % 1000);
/** Milliseconds the zone is ahead of UTC at an instant (the DST-aware offset). */
export function offsetMs(ms, zone) {
  const {date, time} = localParts(ms, zone);
  const [y, m, d] = date.split('-').map(Number), [hh, mm, ss] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm, ss) - wholeSeconds(ms);
}
/** The instant whose wall clock on the zone reads the given date and time (a time that exists exactly once: midnight and the hours the proof uses). */
export function localToMs(date, time, zone) {
  const [y, m, d] = date.split('-').map(Number), parts = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, parts[0], parts[1] ?? 0, parts[2] ?? 0);
  let guess = wall - offsetMs(wall, zone);
  guess = wall - offsetMs(guess, zone);
  return guess;
}
const ymd = ms => new Date(ms).toISOString().slice(0, 10);
/** 'YYYY-MM-DD' + n days (calendar arithmetic, no zone). */
export const addDays = (date, n) => ymd(Date.parse(date + 'T12:00:00Z') + n * DAY);
/** ISO weekday 1 (Monday) .. 7 (Sunday) of a date. */
export const isoDow = date => ((new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1;
/** extract(dow) weekday 0 (Sunday) .. 6 of a date. */
export const dow = date => new Date(date + 'T12:00:00Z').getUTCDay();
export const iso = ms => new Date(ms).toISOString();
export const sha256 = text => createHash('sha256').update(text).digest('hex');

// ------------------------------------------------------------------ the semantic (the owner's words) and its parts, overridable by a mutant
/**
 * The pieces of the candidate's definition. The default is the candidate; the offline tests replace ONE piece to build a mutant and replay the matrix on it (it must be killed).
 *   zoneFor(task, worker, kind)  the zone of the window: the task zone when valid, else Europe/Belgrade (never the worker's)
 *   anchorDay(publishedMs, zone, worker, task) the local calendar date of the publication instant IN THE ZONE OF THE WINDOW (the worker and the task are passed so that a test can express "the anchor day of the worker zone" or "of UTC for a task without a valid zone")
 *   tomorrow / week              the window of a local anchor day
 *   deriveWhen(task)             a window is derived only for a flexible-day/week task stored with NO bound
 *   refusesWithoutPublished      a task without published_at keeps the refusal (no rolling anchor)
 *   clipStart(startMs, nowMs)    the start of the part of the window that is still to come (the existing body: greatest(ws, now))
 *   pausedCountsDerived          match_detail_without_calendar counts such a task as future availability for CURRENT_AVAILABILITY_PAUSED
 *   pausedWhen(task)             which tasks the matcher edit counts: no stored bound, published, of a flexible-day/week kind (the condition of DETAIL_REPLACEMENT in build_ex06a.py)
 */
export const SEMANTICS = Object.freeze({
  zoneFor: (task, _worker, _kind) => (validZone(task.taskZone) ? task.taskZone : BELGRADE),
  anchorDay: (publishedMs, zone, _worker, _task) => localParts(publishedMs, zone).date,
  tomorrow: (anchor, zone) => ({startMs: localToMs(addDays(anchor, 1), '00:00:00', zone), endMs: localToMs(addDays(anchor, 2), '00:00:00', zone)}),
  week: (anchor, zone) => ({startMs: localToMs(anchor, '00:00:00', zone), endMs: localToMs(addDays(anchor, 8 - isoDow(anchor)), '00:00:00', zone)}),
  deriveWhen: task => (task.startsAt ?? null) === null && (task.endsAt ?? null) === null && FLEXIBLE_KINDS.includes(task.kind),
  refusesWithoutPublished: true,
  clipStart: (startMs, nowMs) => Math.max(startMs, nowMs),
  pausedCountsDerived: true,
  pausedWhen: task => (task.startsAt ?? null) === null && (task.endsAt ?? null) === null && (task.publishedAt ?? null) !== null && FLEXIBLE_KINDS.includes(task.kind),
});
function windowFor(semantics, task, worker, nowMs) {
  const zone = semantics.zoneFor(task, worker, task.kind), anchor = semantics.anchorDay(task.publishedAt ?? nowMs, zone, worker, task);
  return {zone, anchor, ...(task.kind === 'TOMORROW_FLEXIBLE' ? semantics.tomorrow(anchor, zone) : semantics.week(anchor, zone))};
}
/**
 * The matching window of a flexible-day/week task stored without a window, or null for any other kind or a task without a publication instant. Independent of the SQL: the offline test compares it
 * with values read from a real PostgreSQL (the expressions of WINDOW_BLOCK evaluated on canonical DEV with a SELECT) and the proof compares its edges with the behaviour of the function.
 */
export function derivedWindow(kind, publishedMs, {taskZone = null} = {}) {
  if (!FLEXIBLE_KINDS.includes(kind) || publishedMs === null || publishedMs === undefined) return null;
  return windowFor(SEMANTICS, {kind, publishedAt: publishedMs, taskZone}, null, 0);
}

// ------------------------------------------------------------------ an executable port of the two targets (the oracle)
const merge = intervals => {
  const sorted = intervals.filter(([a, b]) => a < b).sort((x, y) => x[0] - y[0] || x[1] - y[1]), out = [];
  for (const [a, b] of sorted) {
    if (out.length && a <= out[out.length - 1][1]) out[out.length - 1][1] = Math.max(out[out.length - 1][1], b);
    else out.push([a, b]);
  }
  return out;
};
const subtract = (periods, blocked) => {
  let rest = merge(periods);
  for (const [ba, bb] of merge(blocked)) {
    const next = [];
    for (const [a, b] of rest) {
      if (bb <= a || ba >= b) { next.push([a, b]); continue; }
      if (a < ba) next.push([a, ba]);
      if (bb < b) next.push([bb, b]);
    }
    rest = next;
  }
  return rest;
};
/** private.worker_available_periods as a list of [startMs, endMs): AVAILABLE windows and the weekly rules of every local day, minus UNAVAILABLE windows. worker = {zone, rules, windows}. */
export function availablePeriods(worker, sMs, eMs) {
  if (!(sMs < eMs)) return [];
  const zone = worker.zone ?? BELGRADE, found = [];
  for (const w of worker.windows ?? []) if (w.state === 'AVAILABLE' && w.startsAt < eMs && w.endsAt > sMs) found.push([Math.max(w.startsAt, sMs), Math.min(w.endsAt, eMs)]);
  const first = localParts(sMs, zone).date, last = localParts(eMs, zone).date;
  for (let d = first; d <= last; d = addDays(d, 1)) {
    for (const r of worker.rules ?? []) {
      if (r.active === false || !r.weekdays.includes(dow(d)) || r.startsOn > d || (r.endsOn !== null && r.endsOn !== undefined && r.endsOn < d)) continue;
      const a = localToMs(d, r.startTime, zone), b = localToMs(d, r.endTime, zone);
      if (a < b && a < eMs && b > sMs) found.push([Math.max(a, sMs), Math.min(b, eMs)]);
    }
  }
  const blocked = (worker.windows ?? []).filter(w => w.state === 'UNAVAILABLE' && w.startsAt < eMs && w.endsAt > sMs).map(w => [Math.max(w.startsAt, sMs), Math.min(w.endsAt, eMs)]);
  return subtract(found, blocked);
}
const covers = (periods, s, e) => merge(periods).some(([a, b]) => a <= s && b >= e);
/** private.availability_is_future (IMMUTABLE sql) on raw values. */
export const isFuture = (kind, s, e, nowMs) => s !== null && s !== undefined && e !== null && e !== undefined && s < e && e > nowMs && (s > nowMs || FLEXIBLE_KINDS.includes(kind));
/** Can the candidate derive a window for this task (a window-less flexible-day/week task that has a publication instant)? */
export const derivable = (task, semantics = SEMANTICS) => semantics.deriveWhen(task) && !(semantics.refusesWithoutPublished && (task.publishedAt ?? null) === null);
/**
 * private.worker_dispatch_time_admitted for a task {kind, startsAt, endsAt (ms or null), publishedAt (ms or null), taskZone} and a worker {status, availableNow, zone, rules, windows}.
 * derive=false is the predecessor, derive=true the candidate. Models what the proof uses; a FIXED_WINDOW that is not in the future (schedule_fit) is not modelled and throws.
 */
export function admittedOracle({task, worker, nowMs, derive = true, semantics = SEMANTICS}) {
  if ((worker.status ?? 'ACTIVE') !== 'ACTIVE') return false;
  const zone = worker.zone ?? BELGRADE;
  let ws = task.startsAt ?? null, we = task.endsAt ?? null;
  if (derive && semantics.deriveWhen(task)) {
    if (semantics.refusesWithoutPublished && (task.publishedAt ?? null) === null) return false;
    const w = windowFor(semantics, task, worker, nowMs);
    ws = w.startMs; we = w.endMs;
  }
  if (isFuture(task.kind, ws, we, nowMs)) {
    const periods = availablePeriods({...worker, zone}, semantics.clipStart(ws, nowMs), we);
    return task.kind === 'FIXED_WINDOW' ? covers(periods, ws, we) : periods.length > 0;
  }
  if (FLEXIBLE_KINDS.includes(task.kind) || (task.endsAt !== null && task.endsAt !== undefined && task.endsAt <= nowMs)) return false;
  if (!worker.availableNow) return false;
  if ((worker.windows ?? []).some(w => w.state === 'UNAVAILABLE' && w.startsAt <= nowMs && w.endsAt > nowMs)) return false;
  if (task.kind === 'FIXED_WINDOW') throw new Error('ORACLE_NOT_MODELLED: a FIXED_WINDOW that is not in the future');
  return true;
}
/** The schedule codes of private.match_detail_without_calendar: CURRENT_AVAILABILITY_PAUSED reads the stored window, or (the ex06a edit) a published window-less flexible-day/week task (semantics.pausedWhen); OUTSIDE_AVAILABILITY the admission above. */
export function codesOracle({task, worker, nowMs, derive = true, semantics = SEMANTICS}) {
  const codes = [];
  const future = isFuture(task.kind, task.startsAt ?? null, task.endsAt ?? null, nowMs) || (derive && semantics.pausedCountsDerived && semantics.pausedWhen(task));
  if (!worker.availableNow && !future) codes.push('CURRENT_AVAILABILITY_PAUSED');
  if (!admittedOracle({task, worker, nowMs, derive, semantics})) codes.push('OUTSIDE_AVAILABILITY');
  return codes.sort();
}
export const scheduleCodesOf = detail => (Array.isArray(detail?.dispatchBlockers) ? detail.dispatchBlockers.filter(code => SCHEDULE_CODES.includes(code)).sort() : null);

// ------------------------------------------------------------------ deterministic anchors
/** The first instant 10:00 UTC on a Belgrade calendar date >= the date of minMs whose ISO weekday is isoWeekday (10:00 UTC is the same date in Belgrade, UTC and New York). */
export function pubOn(minMs, isoWeekday) {
  let date = localParts(minMs, BELGRADE).date;
  while (isoDow(date) !== isoWeekday) date = addDays(date, 1);
  return Date.parse(date + 'T10:00:00Z');
}
/**
 * The first instant HH:MM UTC on a UTC date >= the date of minMs whose ISO weekday (of the UTC date) is isoWeekday and, when offsetHours is given, at which Belgrade is that many hours ahead of UTC
 * (2 = summer time, 1 = winter time). A late-evening UTC instant is the NEXT local day in Belgrade: the day the UTC date and the local date disagree.
 */
export function pubUtcAt(minMs, isoWeekday, hhmm, {offsetHours = null} = {}) {
  let date = ymd(minMs);
  for (let i = 0; i < 800; i++, date = addDays(date, 1)) {
    if (isoDow(date) !== isoWeekday) continue;
    const ms = Date.parse(`${date}T${hhmm}:00Z`);
    if (offsetHours !== null && offsetMs(ms, BELGRADE) !== offsetHours * HOUR) continue;
    return ms;
  }
  throw new Error('NO_ANCHOR_DATE_FOUND');
}
/** The first instant at the Belgrade wall-clock time on a Belgrade date >= the date of minMs whose ISO weekday is isoWeekday. */
export function pubLocalAt(minMs, isoWeekday, time) {
  let date = localParts(minMs, BELGRADE).date;
  while (isoDow(date) !== isoWeekday) date = addDays(date, 1);
  return localToMs(date, time, BELGRADE);
}
/** The last Sunday of a month (monthIndex 0..11) of a year, as a date: the EU DST change days are the last Sundays of March (index 2) and October (index 9). */
export function lastSunday(year, monthIndex) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  return addDays(ymd(last.getTime()), -last.getUTCDay());
}
/** The first DST change Sunday (month index 2 or 9) that is at least minMs ahead. */
export function nextDstSunday(minMs, monthIndex) {
  for (let year = new Date(minMs).getUTCFullYear(); ; year++) {
    const sunday = lastSunday(year, monthIndex);
    if (Date.parse(sunday + 'T12:00:00Z') >= minMs) return sunday;
  }
}
/**
 * Milliseconds to wait so that the clock-relative cases of the matrix and the corpus passes are safe: no local midnight lies within guardMinutes ahead of now (a pass takes minutes, a week task would
 * end under it), and the local day is at least afterMinutes old (the stale-availability case needs a window that is already over). 0 when neither holds.
 */
export function clockWaitMs(nowMs, {zone = BELGRADE, guardMinutes = 10, afterMinutes = 2} = {}) {
  const today = localParts(nowMs, zone).date;
  const next = localToMs(addDays(today, 1), '00:00:00', zone), previous = localToMs(today, '00:00:00', zone);
  if (next - nowMs < guardMinutes * MINUTE) return next - nowMs + (afterMinutes + 1) * MINUTE;
  if (nowMs - previous < afterMinutes * MINUTE) return previous + (afterMinutes + 1) * MINUTE - nowMs;
  return 0;
}

// ------------------------------------------------------------------ the scenario matrix
const rule = (weekdays, startTime, endTime, extra = {}) => ({weekdays, startTime, endTime, startsOn: '2026-01-01', endsOn: null, active: true, ...extra});
const win = (startsAt, endsAt, state = 'AVAILABLE') => ({startsAt, endsAt, state});
const worker = (availableNow, rules = [], windows = [], extra = {}) => ({status: 'ACTIVE', availableNow, zone: null, rules, windows, ...extra});
const OUT = ['OUTSIDE_AVAILABILITY'], PAUSED_OUT = ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY'];
const REFUSED = {admitted: false, codes: OUT}, ADMITTED = {admitted: true, codes: []};
/** The weekdays (extract(dow): Sunday 0) of the matrix: the anchors are a Wednesday (10:00Z), so "tomorrow" is the Thursday. */
const WED = 3, THU = 4, FRI = 5;

/**
 * Everything the function-level matrix needs, from the clock of the run (nowMs). Every anchor of a window test lies at least 90 days ahead, so the derived window is in the future and the
 * result does not depend on when the proof runs (the matrix is read four times over about an hour); the anchors that are not (a closed window, a missing published_at) are the point of their case.
 * The cases that DO depend on the clock (the week that is still running, the rest of today) live in buildClockFamily(), which the proof installs afresh before every read.
 * Returns {tasks, workers, cases, unchanged, anchors}. A case = {id, task, worker, note, before: {admitted, codes}, after: {...}} (codes null = not asserted);
 * an unchanged pair = {id, task, worker, admitted, codes}. `before` is the predecessor, `after` the candidate; `codes` are the COMPLETE dispatch blockers of private.match_detail for an ACTIVE worker
 * (the fixtures carry no other gate: no required skill, REMOTE, OFFERS, default preferences), i.e. the schedule codes only.
 */
export function buildMatrix(nowMs) {
  const minFuture = nowMs + 90 * DAY;
  const wed = pubOn(minFuture, 3), sun = pubOn(minFuture, 7), mon = pubOn(minFuture, 1);
  const springSunday = nextDstSunday(minFuture, 2), fallSunday = nextDstSunday(minFuture, 9);
  const springSat = Date.parse(addDays(springSunday, -1) + 'T10:00:00Z'), springWed = Date.parse(addDays(springSunday, -4) + 'T10:00:00Z');
  const fallSat = Date.parse(addDays(fallSunday, -1) + 'T10:00:00Z'), fallWed = Date.parse(addDays(fallSunday, -4) + 'T10:00:00Z');
  const lateWedUtc = pubUtcAt(minFuture, 3, '23:30'), lateSunUtc = pubUtcAt(minFuture, 7, '23:30');
  const cestWed = pubUtcAt(minFuture, 3, '22:30', {offsetHours: 2}), cetWed = pubUtcAt(minFuture, 3, '22:30', {offsetHours: 1});
  const cestSun = pubUtcAt(minFuture, 7, '22:30', {offsetHours: 2}), cetSun = pubUtcAt(minFuture, 7, '22:30', {offsetHours: 1});
  const localWed2359 = pubLocalAt(minFuture, 3, '23:59:30'), localThu0001 = pubLocalAt(minFuture, 4, '00:00:30');
  // the TASK zone is not Belgrade: 03:30Z is the evening of the PREVIOUS day in New York (22:30 or 23:30) while UTC and Belgrade (05:30 or 04:30) are already on the new date, so the date of the task
  // zone differs from the UTC date, from the Belgrade date and from the date of a Belgrade worker
  const nyLateThu = pubUtcAt(minFuture, 4, '03:30'), nyLateMon = pubUtcAt(minFuture, 1, '03:30');
  const task = (kind, publishedAt, taskZone = BELGRADE, startsAt = null, endsAt = null) => ({kind, startsAt, endsAt, publishedAt, taskZone});
  const tasks = {
    A: task('TOMORROW_FLEXIBLE', wed), A_null: task('TOMORROW_FLEXIBLE', wed, null), A_bad: task('TOMORROW_FLEXIBLE', wed, 'Nope/Zone'), A_ny: task('TOMORROW_FLEXIBLE', wed, NEW_YORK),
    B_past: task('TOMORROW_FLEXIBLE', nowMs - 10 * DAY), B_null: task('TOMORROW_FLEXIBLE', null),
    C_sun: task('WEEK_FLEXIBLE', sun), C_mon: task('WEEK_FLEXIBLE', mon), C_wed: task('WEEK_FLEXIBLE', wed), C_past: task('WEEK_FLEXIBLE', nowMs - 14 * DAY),
    C_ny: task('WEEK_FLEXIBLE', wed, NEW_YORK), C_null: task('WEEK_FLEXIBLE', wed, null), C_bad: task('WEEK_FLEXIBLE', wed, 'Nope/Zone'),
    D_spring: task('TOMORROW_FLEXIBLE', springSat), D_fall: task('TOMORROW_FLEXIBLE', fallSat), D_wspring: task('WEEK_FLEXIBLE', springWed), D_wfall: task('WEEK_FLEXIBLE', fallWed),
    // the local day is not the UTC day: an instant late in the evening UTC is already the next day in Belgrade (CEST and CET differ at 22:30Z)
    F_late: task('TOMORROW_FLEXIBLE', lateWedUtc), F_cest: task('TOMORROW_FLEXIBLE', cestWed), F_cet: task('TOMORROW_FLEXIBLE', cetWed),
    F_2359: task('TOMORROW_FLEXIBLE', localWed2359), F_0001: task('TOMORROW_FLEXIBLE', localThu0001),
    G_late: task('WEEK_FLEXIBLE', lateSunUtc), G_cest: task('WEEK_FLEXIBLE', cestSun), G_cet: task('WEEK_FLEXIBLE', cetSun),
    // the anchor day follows the zone of the WINDOW (the task zone, else Belgrade), never UTC, never the worker's zone: late-publication families for a New York task and for the Belgrade fallback
    N_ny: task('TOMORROW_FLEXIBLE', nyLateThu, NEW_YORK), N_bel: task('TOMORROW_FLEXIBLE', nyLateThu, BELGRADE),
    N_null: task('TOMORROW_FLEXIBLE', lateWedUtc, null), N_bad: task('TOMORROW_FLEXIBLE', lateWedUtc, 'Nope/Zone'),
    M_ny: task('WEEK_FLEXIBLE', nyLateMon, NEW_YORK), M_bel: task('WEEK_FLEXIBLE', nyLateMon, BELGRADE),
    M_null: task('WEEK_FLEXIBLE', lateSunUtc, null), M_bad: task('WEEK_FLEXIBLE', lateSunUtc, 'Nope/Zone'),
  };
  const windowOf = key => derivedWindow(tasks[key].kind, tasks[key].publishedAt, {taskZone: tasks[key].taskZone});
  const mondayDate = localParts(mon, BELGRADE).date;
  const aWindow = windowOf('A'), weekBel = windowOf('C_wed');
  const workers = {
    on_thu: worker(true, [rule([THU], '09:00:00', '17:00:00')]),
    off_thu: worker(false, [rule([THU], '09:00:00', '17:00:00')]),
    off_none: worker(false),
    on_thu_nextweek: worker(true, [rule([THU], '09:00:00', '17:00:00', {startsOn: addDays(addDays(localParts(wed, BELGRADE).date, 1), 7)})]),
    on_mon: worker(true, [rule([1], '09:00:00', '17:00:00')]),
    on_none: worker(true),
    on_thu_blocked: worker(true, [rule([THU], '09:00:00', '17:00:00')], [win(aWindow.startMs, aWindow.endMs, 'UNAVAILABLE')]),
    draft_thu: worker(true, [rule([THU], '09:00:00', '17:00:00')], [], {status: 'DRAFT'}),
    ny_thu: worker(true, [rule([THU], '09:00:00', '17:00:00')], [], {zone: NEW_YORK}),
    ny_thu_late: worker(true, [rule([THU], '20:00:00', '23:00:00')], [], {zone: NEW_YORK}),
    ny_wed_late: worker(true, [rule([WED], '19:00:00', '23:00:00')], [], {zone: NEW_YORK}),
    fri_early: worker(true, [rule([FRI], '04:00:00', '05:00:00')]),
    alldays: worker(true, [rule([0, 1, 2, 3, 4, 5, 6], '00:00:00', '23:59:00')]),
    off_alldays: worker(false, [rule([0, 1, 2, 3, 4, 5, 6], '00:00:00', '23:59:00')]),
    sun: worker(true, [rule([0], '09:00:00', '17:00:00')]), mon: worker(true, [rule([1], '09:00:00', '17:00:00')]),
    tue: worker(true, [rule([2], '09:00:00', '17:00:00')]), wed: worker(true, [rule([WED], '09:00:00', '17:00:00')]),
    thu: worker(true, [rule([THU], '09:00:00', '17:00:00')]), fri: worker(true, [rule([FRI], '09:00:00', '17:00:00')]),
    off_fri: worker(false, [rule([FRI], '09:00:00', '17:00:00')]),
    mon_next: worker(true, [rule([1], '09:00:00', '17:00:00', {startsOn: addDays(mondayDate, 7)})]),
    mon_ended: worker(true, [rule([1], '09:00:00', '17:00:00', {endsOn: addDays(mondayDate, -1)})]),
    // the week edges of the zone cases, relative to the Belgrade week of C_wed (the NY week starts and ends hours later)
    wk_hi_after_bel: worker(true, [], [win(weekBel.endMs + 30 * MINUTE, weekBel.endMs + 90 * MINUTE)]),
    wk_lo_in_bel: worker(true, [], [win(weekBel.startMs + 30 * MINUTE, weekBel.startMs + 90 * MINUTE)]),
    ny_sun_late: worker(true, [rule([0], '20:00:00', '23:00:00')], [], {zone: NEW_YORK}),
    ny_fri: worker(true, [rule([FRI], '09:00:00', '17:00:00')], [], {zone: NEW_YORK}),
  };
  const cases = [];
  const add = (taskKey, workerKey, before, after, note) => cases.push({id: `${taskKey}/${workerKey}`, task: taskKey, worker: workerKey, note, before, after});
  const same = (taskKey, workerKey, note) => add(taskKey, workerKey, REFUSED, REFUSED, note);
  const flips = (taskKey, workerKey, note) => add(taskKey, workerKey, REFUSED, ADMITTED, note);

  // sutra: the next local calendar day. A real weekly slot on it admits; live intent alone, a wrong weekday, next week only and a personal exception do not.
  flips('A', 'on_thu', 'a weekly rule covering tomorrow, live intent on: admitted and eligible');
  add('A', 'off_thu', {admitted: false, codes: PAUSED_OUT}, ADMITTED, 'live intent OFF but a real weekly rule on tomorrow (the scheduled-only worker): admitted by the gate AND by the matcher (no CURRENT_AVAILABILITY_PAUSED), the W02 canon FUTURE_OFF_MATCHES_REAL_WEEKLY_SCHEDULE');
  add('A', 'off_none', {admitted: false, codes: PAUSED_OUT}, REFUSED, 'live intent OFF and nothing declared (NONE_DECLARED): still refused (OUTSIDE_AVAILABILITY), and no longer also "paused": the corpus says OUTSIDE_AVAILABILITY only (S03 F3)');
  same('A', 'on_thu_nextweek', 'the rule starts next week: nothing on tomorrow');
  same('A', 'on_mon', 'the rule is on another weekday');
  same('A', 'on_none', 'live intent alone is not availability tomorrow (the existing flexible rule)');
  same('A', 'on_thu_blocked', 'a personal UNAVAILABLE window over tomorrow wins over the weekly rule');
  add('A', 'draft_thu', {admitted: false, codes: null}, {admitted: false, codes: null}, 'a worker who is not ACTIVE is never admitted');
  flips('A', 'ny_thu', 'worker zone New York, task zone Belgrade: the rule is read on the worker clock, the day is the task day (Thursday 09-17 New York lies inside Thursday Belgrade)');
  same('A', 'ny_thu_late', 'Thursday 20-23 New York is already Friday in Belgrade, outside the task day');
  flips('A', 'ny_wed_late', 'Wednesday 19-23 New York is already Thursday in Belgrade: inside the task day (the task zone is Belgrade)');
  same('A', 'fri_early', 'Friday 04-05 Belgrade is outside Thursday Belgrade');
  // the zone of the window: the task zone when valid, else Europe/Belgrade, NEVER the worker's zone
  for (const key of ['A_null', 'A_bad']) {
    const label = key === 'A_null' ? 'no task zone' : 'an invalid task zone';
    flips(key, 'on_thu', `${label} and a worker without a timezone row: Europe/Belgrade`);
    flips(key, 'ny_thu', `${label}: Belgrade Thursday, the New York worker's Thursday 09-17 is inside it`);
    same(key, 'ny_thu_late', `${label} falls back to Belgrade, NOT to the worker zone: Thursday 20-23 New York is Friday in Belgrade`);
    flips(key, 'ny_wed_late', `${label} falls back to Belgrade: Wednesday 19-23 New York is Thursday in Belgrade`);
    same(key, 'fri_early', `${label}: Friday 04-05 Belgrade is outside Thursday Belgrade`);
  }
  flips('A_ny', 'on_thu', 'task zone New York: the Belgrade worker Thursday 09-17 lies inside Thursday New York');
  flips('A_ny', 'ny_thu', 'task zone New York: Thursday 09-17 New York');
  flips('A_ny', 'ny_thu_late', 'task zone New York: Thursday 20-23 New York is inside Thursday New York');
  same('A_ny', 'ny_wed_late', 'task zone New York: Wednesday 19-23 New York is before Thursday New York');
  flips('A_ny', 'fri_early', 'task zone New York: Friday 04-05 Belgrade is still Thursday evening in New York');
  same('B_past', 'alldays', 'the publication day was ten days ago: tomorrow is over, nobody is admitted');
  same('B_null', 'alldays', 'no published_at: no rolling anchor, the refusal stays (a published task always has the instant)');
  add('B_null', 'off_alldays', {admitted: false, codes: PAUSED_OUT}, {admitted: false, codes: PAUSED_OUT}, 'no published_at: the task is not future availability for the paused test either: exactly as before');
  // ove nedelje: the publication day to the end of the local Monday-Sunday week (the remaining part of it).
  flips('C_sun', 'sun', 'published on a Sunday: the week is that Sunday alone');
  same('C_sun', 'mon', 'a Monday rule is next week for a Sunday task');
  flips('C_mon', 'mon', 'published on a Monday: that Monday is in the week');
  flips('C_mon', 'sun', 'the Sunday six days later is the last day of the week');
  same('C_mon', 'mon_next', 'the rule starts the Monday after the week');
  same('C_mon', 'mon_ended', 'the rule ended the day before the week');
  same('C_wed', 'tue', 'published on a Wednesday: the Tuesday before and the Tuesday after the week are not in it');
  flips('C_wed', 'fri', 'published on a Wednesday: Friday is in the week');
  add('C_wed', 'off_fri', {admitted: false, codes: PAUSED_OUT}, ADMITTED, 'WEEK, live intent OFF with a real Friday rule: admitted by the gate and by the matcher');
  flips('C_wed', 'sun', 'published on a Wednesday: the Sunday after is the last day of the week');
  same('C_past', 'alldays', 'the publication week is over');
  // the zone of the WEEK window: the Belgrade week [Wed 00:00, Mon 00:00) Belgrade versus the New York one, which starts and ends hours later
  const weekEdge = (key, hiAfter, loIn, nySun, note) => {
    (hiAfter ? flips : same)(key, 'wk_hi_after_bel', `${note}: 30 to 90 minutes after the end of the Belgrade week`);
    (loIn ? flips : same)(key, 'wk_lo_in_bel', `${note}: 30 to 90 minutes after the start of the Belgrade week (before the New York week starts)`);
    (nySun ? flips : same)(key, 'ny_sun_late', `${note}: Sunday 20-23 New York is Monday 00-04 UTC, after the Belgrade week and inside the New York week`);
  };
  weekEdge('C_wed', false, true, false, 'task zone Belgrade');
  weekEdge('C_ny', true, false, true, 'task zone New York');
  weekEdge('C_null', false, true, false, 'no task zone falls back to Belgrade (not the worker zone)');
  weekEdge('C_bad', false, true, false, 'an invalid task zone falls back to Belgrade (not the worker zone)');
  for (const key of ['C_ny', 'C_null', 'C_bad']) flips(key, 'sun', `${key}: the Sunday of the week is inside it in every zone`);
  // DST change days: the window edges are the local midnights, 23 and 25 hours apart.
  const edges = {};
  for (const key of ['D_spring', 'D_fall', 'D_wspring', 'D_wfall']) {
    const w = windowOf(key);
    edges[key] = {startMs: w.startMs, endMs: w.endMs};
    // 30 minutes of overlap, 1 SECOND of overlap (the very first and the very last second of the window: a window that ends at 23:59, or one that starts or ends a second off, is killed), and touching
    const entries = {lo_in: [win(w.startMs - 30 * MINUTE, w.startMs + 30 * MINUTE), '30 minutes'], lo_in1: [win(w.startMs - MINUTE, w.startMs + 1000), '1 second'], lo_out: [win(w.startMs - 60 * MINUTE, w.startMs), 'touching'],
      hi_in: [win(w.endMs - 30 * MINUTE, w.endMs + 30 * MINUTE), '30 minutes'], hi_in1: [win(w.endMs - 1000, w.endMs + MINUTE), '1 second'], hi_out: [win(w.endMs, w.endMs + 60 * MINUTE), 'touching']};
    for (const [name, [window, size]] of Object.entries(entries)) {
      const workerKey = `${key}:${name}`;
      workers[workerKey] = worker(true, [], [window]);
      (name.includes('_in') ? flips : same)(key, workerKey, `${name.startsWith('lo') ? 'start' : 'end'} edge of the derived window (${iso(w.startMs)} .. ${iso(w.endMs)}), ${size === 'touching' ? 'touching it outside' : 'overlapping by ' + size}`);
    }
  }
  // the LOCAL day, not the UTC day: a publication late in the evening UTC is already the next day in Belgrade
  flips('F_late', 'fri', 'published Wednesday 23:30Z = Thursday local: tomorrow is Friday (a UTC date would give Thursday)');
  same('F_late', 'thu', 'published Wednesday 23:30Z = Thursday local: Thursday is today, not tomorrow');
  flips('F_cest', 'fri', 'published Wednesday 22:30Z in summer time = Thursday 00:30 local: tomorrow is Friday');
  same('F_cest', 'thu', 'published Wednesday 22:30Z in summer time = Thursday 00:30 local: Thursday is today');
  flips('F_cet', 'thu', 'published Wednesday 22:30Z in winter time = Wednesday 23:30 local: tomorrow is Thursday');
  same('F_cet', 'fri', 'published Wednesday 22:30Z in winter time = Wednesday 23:30 local: Friday is the day after tomorrow');
  flips('F_2359', 'thu', 'published Wednesday 23:59:30 local: tomorrow is Thursday');
  same('F_2359', 'fri', 'published Wednesday 23:59:30 local: Friday is the day after tomorrow');
  flips('F_0001', 'fri', 'published Thursday 00:00:30 local: tomorrow is Friday');
  same('F_0001', 'thu', 'published Thursday 00:00:30 local: Thursday is today');
  flips('G_late', 'wed', 'WEEK published Sunday 23:30Z = Monday local: the week is Monday to Sunday (a UTC date would give Sunday alone)');
  flips('G_late', 'mon', 'WEEK published Sunday 23:30Z = Monday local: that Monday is in the week');
  flips('G_cest', 'wed', 'WEEK published Sunday 22:30Z in summer time = Monday 00:30 local: the week is Monday to Sunday');
  flips('G_cest', 'mon', 'WEEK published Sunday 22:30Z in summer time = Monday 00:30 local: that Monday is in the week');
  flips('G_cet', 'sun', 'WEEK published Sunday 22:30Z in winter time = Sunday 23:30 local: the week is that Sunday alone');
  same('G_cet', 'wed', 'WEEK published Sunday 22:30Z in winter time = Sunday 23:30 local: Wednesday is next week');
  same('G_cet', 'mon', 'WEEK published Sunday 22:30Z in winter time = Sunday 23:30 local: Monday is next week');
  flips('M_null', 'wed', 'WEEK published Sunday 23:30Z, no task zone = Monday local (Belgrade): the week is Monday to Sunday (a UTC date would give Sunday alone)');
  flips('M_null', 'mon', 'WEEK published Sunday 23:30Z, no task zone: that Monday is in the week');
  flips('M_bad', 'wed', 'WEEK published Sunday 23:30Z, an invalid task zone = Monday local (Belgrade): the week is Monday to Sunday');
  flips('M_bad', 'mon', 'WEEK published Sunday 23:30Z, an invalid task zone: that Monday is in the week');
  // the anchor day in the zone of the WINDOW, for a task zone that is not Belgrade: published Thursday 03:30Z = Wednesday evening in New York (UTC and Belgrade are already on Thursday)
  flips('N_ny', 'thu', 'task zone New York, published Thursday 03:30Z = Wednesday evening there: tomorrow is Thursday (New York), so the Belgrade Thursday rule is inside (a Belgrade or UTC anchor says Friday)');
  same('N_ny', 'fri', 'task zone New York, published Wednesday evening there: Friday is the day after tomorrow');
  same('N_ny', 'wed', 'task zone New York, published Wednesday evening there: Wednesday is today, not tomorrow');
  flips('N_ny', 'ny_thu', 'task zone New York: the New York worker Thursday 09-17 is inside Thursday New York');
  same('N_ny', 'ny_fri', 'task zone New York: the New York worker Friday 09-17 is the day after tomorrow');
  flips('N_ny', 'fri_early', 'task zone New York: Friday 04-05 Belgrade is still Thursday evening in New York');
  flips('N_bel', 'fri', 'task zone Belgrade, the same instant (Thursday 05:30 or 04:30 local): tomorrow is Friday');
  same('N_bel', 'thu', 'task zone Belgrade, the same instant: Thursday is today');
  same('N_bel', 'ny_thu', 'task zone Belgrade, the same instant: the New York Thursday 09-17 (Belgrade afternoon) is today, not tomorrow (the anchor is NOT the date of the worker zone, which is still Wednesday)');
  flips('N_bel', 'ny_fri', 'task zone Belgrade, the same instant: the New York Friday 09-17 lies inside Friday Belgrade');
  for (const key of ['N_null', 'N_bad']) {
    const label = key === 'N_null' ? 'no task zone' : 'an invalid task zone';
    flips(key, 'fri', `${label}, published Wednesday 23:30Z = Thursday local (Belgrade): tomorrow is Friday (a UTC date would give Thursday)`);
    same(key, 'thu', `${label}, published Wednesday 23:30Z = Thursday local: Thursday is today`);
    same(key, 'ny_thu', `${label}: the anchor is the Belgrade date (Thursday), NOT the worker zone date (Wednesday): the New York Thursday rule is today`);
    flips(key, 'ny_fri', `${label}: the New York Friday 09-17 lies inside Friday Belgrade`);
  }
  flips('M_ny', 'sun', 'WEEK, task zone New York, published Monday 03:30Z = Sunday evening there: the week is that Sunday alone (New York), the Belgrade Sunday rule is inside');
  same('M_ny', 'mon', 'WEEK, task zone New York, published Sunday evening there: the Belgrade Monday rule is next week (a Belgrade or UTC anchor says Monday)');
  same('M_ny', 'wed', 'WEEK, task zone New York, published Sunday evening there: Wednesday is next week');
  flips('M_ny', 'ny_sun_late', 'WEEK, task zone New York: the New York worker Sunday 20-23 lies inside that Sunday');
  flips('M_bel', 'mon', 'WEEK, task zone Belgrade, published Monday 03:30Z (still Sunday evening in New York): the week is Monday to Sunday, that Monday is in it');
  flips('M_bel', 'sun', 'WEEK, task zone Belgrade, published Monday: the Sunday after is the last day of the week');
  flips('M_bel', 'ny_sun_late', 'WEEK, task zone Belgrade: the New York worker Sunday 20-23 (Monday 00-04 UTC) lies inside the Belgrade week (the anchor is NOT the date of the worker zone, which is still Sunday)');
  // Unchanged behaviour: a stored window (or one endpoint) and every other kind give the same answer before and after (and after the revert).
  const day3 = localParts(nowMs + 3 * DAY, BELGRADE).date, sMs = localToMs(day3, '10:00:00', BELGRADE), eMs = localToMs(day3, '11:00:00', BELGRADE), pub = nowMs - HOUR;
  const stored = (kind, startsAt, endsAt) => task(kind, pub, BELGRADE, startsAt, endsAt);
  Object.assign(tasks, {
    E_fixed: stored('FIXED_WINDOW', sMs, eMs), E_tomorrow_win: stored('TOMORROW_FLEXIBLE', sMs, eMs), E_week_win: stored('WEEK_FLEXIBLE', sMs, eMs), E_flex_win: stored('FLEXIBLE', sMs, eMs),
    E_flex_none: stored('FLEXIBLE', null, null), E_today_none: stored('TODAY_FLEXIBLE', null, null), E_remote_none: stored('REMOTE_ANYTIME', null, null),
    E_tomorrow_start: stored('TOMORROW_FLEXIBLE', sMs, null), E_week_end: stored('WEEK_FLEXIBLE', null, eMs),
  });
  Object.assign(workers, {
    e_cov_on: worker(true, [rule([dow(day3)], '09:00:00', '12:00:00')]), e_cov_off: worker(false, [rule([dow(day3)], '09:00:00', '12:00:00')]),
    e_oth_on: worker(true, [rule([(dow(day3) + 2) % 7], '09:00:00', '12:00:00')]), e_none_on: worker(true), e_none_off: worker(false),
    // availability on EVERY day: the one-bound controls refuse it on any weekday only because nothing is derived for them (the weekday rules above fall into a derived day by calendar chance)
    e_all_on: worker(true, [rule([0, 1, 2, 3, 4, 5, 6], '00:00:00', '23:59:00')]), e_all_off: worker(false, [rule([0, 1, 2, 3, 4, 5, 6], '00:00:00', '23:59:00')]),
  });
  const order = ['e_cov_on', 'e_cov_off', 'e_oth_on', 'e_none_on', 'e_none_off', 'e_all_on', 'e_all_off'];
  const table = {
    E_fixed: [true, true, false, false, false, true, true], E_tomorrow_win: [true, true, false, false, false, true, true], E_week_win: [true, true, false, false, false, true, true],
    E_flex_win: [true, true, false, false, false, true, true],
    E_flex_none: [true, false, true, true, false, true, false], E_today_none: [true, false, true, true, false, true, false], E_remote_none: [true, false, true, true, false, true, false],
    E_tomorrow_start: [false, false, false, false, false, false, false], E_week_end: [false, false, false, false, false, false, false],
  };
  // The complete schedule codes of an unchanged pair are the predecessor's (the oracle models the predecessor and is read against 34 real answers of DEV): the candidate must not move one of them either.
  const unchanged = [];
  for (const [taskKey, answers] of Object.entries(table)) {
    order.forEach((workerKey, i) => unchanged.push({id: `${taskKey}/${workerKey}`, task: taskKey, worker: workerKey, admitted: answers[i],
      codes: codesOracle({task: tasks[taskKey], worker: workers[workerKey], nowMs, derive: false})}));
  }
  return {tasks, workers, cases, unchanged, anchors: {wed: iso(wed), sun: iso(sun), mon: iso(mon), springSunday, fallSunday, springSat: iso(springSat), fallSat: iso(fallSat), day3, edges,
    late: {lateWedUtc: iso(lateWedUtc), lateSunUtc: iso(lateSunUtc), cestWed: iso(cestWed), cetWed: iso(cetWed), cestSun: iso(cestSun), cetSun: iso(cetSun), localWed2359: iso(localWed2359), localThu0001: iso(localThu0001),
      nyLateThu: iso(nyLateThu), nyLateMon: iso(nyLateMon)}}};
}

/**
 * The cases that depend on the CLOCK: a WEEK task published now (so the part of the week before now is over) and what is still to come of it, today included. They cannot sit in the matrix, which is read
 * four times over about an hour (a window that is "still to come" at the first read is over at the last), so the proof installs this family afresh before EVERY read (a few seconds before it) and
 * reads it at once. Workers (live intent on unless named off): h_stale (a window that ended seconds into this week: over, refused), h_late (a window in the last hour of the week: still to come, only when
 * the week has two hours left), h_today_rule (a weekly rule on today's weekday all day: the REST OF TODAY is part of the week), h_today_off (the same, live intent off: the scheduled-only worker) and
 * h_today_win (an availability window 20 to 40 minutes from now: only when the local day has an hour left). Together they kill a start that is not clipped to now (h_stale), one that is clipped to
 * tomorrow's midnight or to now plus twelve hours (h_today_rule, h_today_win).
 * Throws CLOCK_TOO_CLOSE_AFTER_MIDNIGHT (under 2 minutes into the local day: the stale window would not be over yet) and CLOCK_TOO_CLOSE_BEFORE_MIDNIGHT (under 10 minutes to the local midnight: the
 * all-day rule would end under the read); the proof waits first (clockWaitMs with its guard).
 */
export function buildClockFamily(nowMs) {
  const today = localParts(nowMs, BELGRADE), midnight = localToMs(addDays(today.date, 1), '00:00:00', BELGRADE);
  const tasks = {H_week: {kind: 'WEEK_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: nowMs, taskZone: BELGRADE}};
  const w = derivedWindow('WEEK_FLEXIBLE', nowMs, {taskZone: BELGRADE});
  if (w.startMs + 2 * MINUTE > nowMs) throw new Error('CLOCK_TOO_CLOSE_AFTER_MIDNIGHT: the stale-availability case needs a window that is already over');
  if (midnight - nowMs < 10 * MINUTE) throw new Error('CLOCK_TOO_CLOSE_BEFORE_MIDNIGHT: the all-day rule of today would end under the read');
  const lateOk = w.endMs - nowMs > 2 * HOUR, winOk = midnight - nowMs > HOUR;
  const todayRule = rule([today.weekday], '00:00:00', '23:59:00');
  const workers = {
    h_stale: worker(true, [], [win(w.startMs, w.startMs + 30 * 1000)]),
    ...(lateOk ? {h_late: worker(true, [], [win(w.endMs - 60 * MINUTE, w.endMs - 30 * MINUTE)])} : {}),
    h_today_rule: worker(true, [todayRule]), h_today_off: worker(false, [todayRule]),
    ...(winOk ? {h_today_win: worker(true, [], [win(nowMs + 20 * MINUTE, nowMs + 40 * MINUTE)])} : {}),
  };
  const cases = [], add = (workerKey, before, after, note) => cases.push({id: `H_week/${workerKey}`, task: 'H_week', worker: workerKey, note, before, after});
  add('h_stale', REFUSED, REFUSED, 'WEEK published now, one availability window that ended seconds into the week: the part of the week before now is over');
  if (lateOk) add('h_late', REFUSED, ADMITTED, 'WEEK published now, an availability window in the last hour of the week: still to come');
  add('h_today_rule', REFUSED, ADMITTED, 'WEEK published now, a weekly rule on today all day: the rest of today is part of the remaining week');
  add('h_today_off', {admitted: false, codes: PAUSED_OUT}, ADMITTED, 'WEEK published now, live intent off, a weekly rule on today all day: the scheduled-only worker, admitted by the gate and the matcher');
  if (winOk) add('h_today_win', REFUSED, ADMITTED, 'WEEK published now, an availability window 20 to 40 minutes from now: still to come today, inside the remaining part of the week');
  return {tasks, workers, cases, unchanged: [], anchors: {weekStart: iso(w.startMs), weekEnd: iso(w.endMs), localMidnight: iso(midnight), lateTwin: lateOk ? 'INCLUDED' : 'OMITTED_LAST_HOURS_OF_THE_WEEK', windowTwin: winOk ? 'INCLUDED' : 'OMITTED_LAST_HOUR_OF_THE_DAY'}};
}

// ------------------------------------------------------------------ the direct fixtures and the reads (SQL text)
const timeLiteral = (q, ms) => (ms === null || ms === undefined ? 'null::timestamptz' : `${q(iso(ms))}::timestamptz`);
/**
 * ONE transaction of labelled direct fixtures under the replica role (as ex04a_proof.mjs does: no trigger, no foreign-key check runs): a requester, one account and one WORKER profile per worker
 * of the plan, their weekly rules, windows and timezone rows, and one PUBLISHED task row per task of the plan. ids = {requester: {account, profile}, workers: {key: {account, profile}}, tasks: {key: uuid}}.
 * This bypasses the product path and the publish lifecycle on purpose: the matrix characterises the FUNCTION; the product path is exercised by the corpus.
 */
export function fixtureSql(plan, ids, q) {
  const out = ['begin;', 'set local session_replication_role = replica;'];
  const req = ids.requester;
  out.push(`insert into auth.users(id,email) values (${q(req.account)}::uuid,${q(req.account + '@proof.invalid')});`,
    `insert into public.app_accounts(id,email) values (${q(req.account)}::uuid,${q(req.account + '@proof.invalid')});`,
    `insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values (${q(req.profile)}::uuid,${q(req.account)}::uuid,'REQUESTER','EX06A requester','Novi Sad','ACTIVE','{}',1,false);`);
  for (const [key, w] of Object.entries(plan.workers)) {
    const id = ids.workers[key];
    out.push(`insert into auth.users(id,email) values (${q(id.account)}::uuid,${q(id.account + '@proof.invalid')});`,
      `insert into public.app_accounts(id,email) values (${q(id.account)}::uuid,${q(id.account + '@proof.invalid')});`,
      `insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values (${q(id.profile)}::uuid,${q(id.account)}::uuid,'WORKER',${q('EX06A ' + key)},'Novi Sad',${q(w.status ?? 'ACTIVE')},'{ciscenje}',3,${w.availableNow ? 'true' : 'false'});`);
    if (w.zone) out.push(`insert into public.worker_match_preferences(worker_profile_id,worker_account_id,timezone) values (${q(id.profile)}::uuid,${q(id.account)}::uuid,${q(w.zone)});`);
    for (const r of w.rules ?? []) {
      out.push(`insert into public.profile_availability_rules(profile_id,weekdays,start_time,end_time,starts_on,ends_on,label,active) values (${q(id.profile)}::uuid,array[${r.weekdays.join(',')}]::smallint[],${q(r.startTime)}::time,${q(r.endTime)}::time,${q(r.startsOn)}::date,${r.endsOn ? q(r.endsOn) + '::date' : 'null::date'},'EX06A matrix',${r.active === false ? 'false' : 'true'});`);
    }
    for (const x of w.windows ?? []) {
      out.push(`insert into public.profile_availability_windows(profile_id,starts_at,ends_at,label,availability_state) values (${q(id.profile)}::uuid,${timeLiteral(q, x.startsAt)},${timeLiteral(q, x.endsAt)},'EX06A matrix',${q(x.state)});`);
    }
  }
  for (const [key, t] of Object.entries(plan.tasks)) {
    out.push(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at,execution_location_mode,task_timezone)
      values (${q(ids.tasks[key])}::uuid,${q(req.account)}::uuid,${q(req.profile)}::uuid,'PUBLISHED',${q('EX06A ' + key)},'Direct fixture of the ex06a function matrix, not a product-path task','PROOF','Novi Sad','Liman','OFFERS',1,${q(t.kind)},${timeLiteral(q, t.startsAt)},${timeLiteral(q, t.endsAt)},statement_timestamp() + interval '2 days',${timeLiteral(q, t.publishedAt)},'REMOTE',${t.taskZone === null ? 'null' : q(t.taskZone)});`);
  }
  out.push('commit;');
  return out.join('\n');
}
/** The SELECT that reads, for the given pairs [{key, nid, pid}], the target, the cheap candidate gate and the matcher. */
export function evaluationSql(pairs, q) {
  const values = pairs.map(p => `(${q(p.key)}, ${q(p.nid)}::uuid, ${q(p.pid)}::uuid)`).join(', ');
  return `select v.pair, private.worker_dispatch_time_admitted(v.nid, v.pid) as admitted, private.dispatch_cheap_candidate_admitted(v.nid, v.pid) as cheap, private.match_detail(v.nid, v.pid) as detail
    from (values ${values}) v(pair, nid, pid) order by v.pair`;
}
/** The pairs the matrix reads: every case and every unchanged pair, once. */
export function pairsOf(plan, ids) {
  const seen = new Map();
  for (const item of [...plan.cases, ...plan.unchanged]) if (!seen.has(item.id)) seen.set(item.id, {key: item.id, nid: ids.tasks[item.task], pid: ids.workers[item.worker].profile});
  return [...seen.values()];
}

// ------------------------------------------------------------------ what the full match_detail may change
const sortedSet = list => [...new Set(Array.isArray(list) ? list : [])].sort();
const SCORE_KEYS = ['capability', 'schedule', 'distanceToStart', 'resources', 'reliability', 'fairness'];
const close = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-6;
/**
 * Structural invariants of ONE match_detail given whether the schedule gate admitted the worker: the schedule component is 25 exactly when admitted (else 0), SCHEDULE_MATCH is among the reason codes
 * exactly when admitted, dispatchEligible follows the two blocker lists, the score is the capped sum of the components. [] when the detail is as the matcher defines it.
 */
export function detailProblems(detail, {admitted}) {
  const problems = [];
  if (!detail || typeof detail !== 'object') return ['DETAIL_MISSING'];
  const schedule = detail.scoreComponents?.schedule;
  if (!close(schedule, admitted ? 25 : 0)) problems.push(`SCHEDULE_COMPONENT ${JSON.stringify(schedule)} (admitted ${admitted})`);
  if (sortedSet(detail.reasonCodes).includes('SCHEDULE_MATCH') !== admitted) problems.push(`SCHEDULE_MATCH_REASON (admitted ${admitted})`);
  if (detail.dispatchEligible !== ((detail.hardBlockers ?? []).length === 0 && (detail.dispatchBlockers ?? []).length === 0)) problems.push('DISPATCH_ELIGIBLE_NOT_FROM_BLOCKERS');
  const sum = SCORE_KEYS.reduce((total, key) => total + Number(detail.scoreComponents?.[key] ?? NaN), 0);
  if (!(Math.abs(Number(detail.score) - Math.min(100, sum)) <= 0.051)) problems.push(`SCORE_NOT_THE_COMPONENT_SUM ${detail.score} vs ${sum}`);
  return problems;
}
const withoutIds = detail => { const copy = {...detail}; delete copy.workerAccountId; delete copy.workerProfileId; return copy; };
/**
 * The whole difference between the predecessor's and the candidate's match_detail of ONE pair, as problems ([] = exactly the intended change): everything is equal except the schedule component, the
 * score, the reason codes, the dispatch blockers and the eligibility, and those change only as intended. flips = the gate went from refused to admitted (schedule 0 -> 25, score +25, SCHEDULE_MATCH
 * appears, OUTSIDE_AVAILABILITY goes); pausedGone = CURRENT_AVAILABILITY_PAUSED goes (the matcher edit); otherwise the sets are identical.
 */
export function detailDelta(before, after, {flips = false, pausedGone = false} = {}) {
  const problems = [];
  if (!before || !after) return ['DETAIL_MISSING'];
  const a = withoutIds(before), b = withoutIds(after);
  if (!flips && !pausedGone && JSON.stringify(a) === JSON.stringify(b)) return [];   // identical is what a pair that must not change looks like
  const rest = detail => { const copy = {...detail}; for (const key of ['dispatchBlockers', 'dispatchEligible', 'reasonCodes', 'score', 'scoreComponents']) delete copy[key]; return copy; };
  if (JSON.stringify(rest(a)) !== JSON.stringify(rest(b))) problems.push('UNINTENDED_FIELD_CHANGED ' + Object.keys(rest(a)).filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])).join(','));
  for (const key of SCORE_KEYS) if (key !== 'schedule' && !close(a.scoreComponents?.[key], b.scoreComponents?.[key])) problems.push('SCORE_COMPONENT_CHANGED ' + key);
  const expectedBlockers = sortedSet(a.dispatchBlockers).filter(code => !(flips && code === 'OUTSIDE_AVAILABILITY') && !(pausedGone && code === 'CURRENT_AVAILABILITY_PAUSED'));
  if (JSON.stringify(expectedBlockers) !== JSON.stringify(sortedSet(b.dispatchBlockers))) problems.push(`DISPATCH_BLOCKERS ${JSON.stringify(sortedSet(a.dispatchBlockers))} -> ${JSON.stringify(sortedSet(b.dispatchBlockers))}`);
  if (flips && !sortedSet(a.dispatchBlockers).includes('OUTSIDE_AVAILABILITY')) problems.push('FLIP_WITHOUT_OUTSIDE_AVAILABILITY_BEFORE');
  if (pausedGone && !sortedSet(a.dispatchBlockers).includes('CURRENT_AVAILABILITY_PAUSED')) problems.push('PAUSED_GONE_WITHOUT_PAUSED_BEFORE');
  const expectedReasons = sortedSet(a.reasonCodes).concat(flips ? ['SCHEDULE_MATCH'] : []).sort();
  if (JSON.stringify(expectedReasons) !== JSON.stringify(sortedSet(b.reasonCodes))) problems.push(`REASON_CODES ${JSON.stringify(sortedSet(a.reasonCodes))} -> ${JSON.stringify(sortedSet(b.reasonCodes))}`);
  if (!close(a.scoreComponents?.schedule, 0) && flips) problems.push('FLIP_FROM_A_NONZERO_SCHEDULE_COMPONENT');
  if (!close(b.scoreComponents?.schedule, flips ? 25 : Number(a.scoreComponents?.schedule))) problems.push(`SCHEDULE_COMPONENT_AFTER ${b.scoreComponents?.schedule}`);
  if (!close(b.score, Number(a.score) + (flips ? 25 : 0))) problems.push(`SCORE ${a.score} -> ${b.score}`);
  const eligibleAfter = (b.hardBlockers ?? []).length === 0 && (b.dispatchBlockers ?? []).length === 0;
  if (b.dispatchEligible !== eligibleAfter) problems.push('DISPATCH_ELIGIBLE_NOT_FROM_BLOCKERS_AFTER');
  return problems;
}

// ------------------------------------------------------------------ the candidate text
/** The pins the candidate enforces, [{signature, md5}], read from its own text (the proof asserts exactly these on the chain): the two targets first, then the neighbours. */
export function parsePins(candidateText) {
  const start = candidateText.indexOf('for pin in select * from (values'), end = candidateText.indexOf(') p(signature, body_md5) loop', start);
  if (start < 0 || end < 0) throw new Error('CANDIDATE_PINS_NOT_FOUND');
  const found = [...candidateText.slice(start, end).matchAll(/\('([^']+)',\s*'([0-9a-f]{32})'\)/g)].map(match => ({signature: match[1], md5: match[2]}));
  if (found.length < 2) throw new Error('CANDIDATE_PINS_NOT_PARSED');
  return found;
}
/** The text between $name$ ... $name$ (the first such literal). */
export function dollarLiteral(text, name) {
  const open = `$${name}$`, start = text.indexOf(open);
  if (start < 0) throw new Error('DOLLAR_LITERAL_NOT_FOUND:' + name);
  const from = start + open.length, end = text.indexOf(open, from);
  if (end < 0) throw new Error('DOLLAR_LITERAL_NOT_CLOSED:' + name);
  return text.slice(from, end);
}
/** The candidate with one pin's md5 replaced by zeros (the drift refusal test). */
export function tamperPin(candidateText, signature) {
  const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\('${escaped}',\\s*')[0-9a-f]{32}('\\))`);
  if (!pattern.test(candidateText)) throw new Error('PIN_NOT_FOUND:' + signature);
  return candidateText.replace(pattern, (whole, head, tail) => head + '0'.repeat(32) + tail);
}

// ------------------------------------------------------------------ catalog and surface deltas
/** {added, removed, changed:[{name, before, after}]} between two [{name, md5}] lists. */
export function diffNamed(before, after) {
  const a = new Map(before.map(row => [row.name, row.md5])), b = new Map(after.map(row => [row.name, row.md5]));
  const added = [...b.keys()].filter(name => !a.has(name)).sort(), removed = [...a.keys()].filter(name => !b.has(name)).sort();
  const changed = [...b.keys()].filter(name => a.has(name) && a.get(name) !== b.get(name)).sort().map(name => ({name, before: a.get(name), after: b.get(name)}));
  return {added, removed, changed};
}
/**
 * The surface lines (function:signature:md5:definer=...:volatility=...:config=...:acl=...) that differ: {removed, added, names} and whether ONLY bodies changed (every removed line has exactly one
 * added line with the same name and the same metadata, so no attribute, ACL or definer moved).
 */
export function surfaceDelta(before, after) {
  const removed = before.filter(line => !after.includes(line)), added = after.filter(line => !before.includes(line));
  const name = line => line.split(':')[1];
  const metadata = line => line.split(':').slice(3).join(':');
  const onlyBodiesChanged = removed.length === added.length && removed.every(line => added.filter(other => name(other) === name(line) && metadata(other) === metadata(line)).length === 1)
    && new Set(removed.map(name)).size === removed.length;
  return {removed, added, onlyBodiesChanged, names: [...new Set([...removed, ...added].map(name))].sort()};
}

// ------------------------------------------------------------------ the corpus passes
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** What a corpus pass is compared on, from one entry of runner.runCase: the observed answer of every worker, the wave and the round rows. */
export function outcomeOf(entry) {
  const workers = {};
  for (const w of entry.workers ?? []) {
    const o = w.observed ?? {};
    workers[w.label] = {hardBlockers: [...(o.hardBlockers ?? [])].sort(), dispatchBlockers: [...(o.dispatchBlockers ?? [])].sort(), dispatchEligible: o.dispatchEligible ?? null,
      delivery: o.delivery ?? null, event: o.event ?? null, score: typeof o.score === 'number' ? o.score : null};
  }
  return {id: entry.id, refused: entry.status === 'PRODUCT_PATH_REFUSED', wave: entry.wave ? {status: entry.wave.status ?? null, inserted: entry.wave.inserted ?? null} : null,
    rounds: (entry.rounds ?? []).map(r => ({round_no: r.round_no, status: r.status, stop_reason: r.stop_reason ?? null})), workers};
}
/** Every difference between two passes ({caseId: outcome} each): [{caseId, worker (null = the case), field, before, after}]. Scores differ only beyond 1e-6. */
export function diffOutcomes(before, after, {tolerance = 1e-6} = {}) {
  const diffs = [];
  const push = (caseId, worker, field, b, a) => diffs.push({caseId, worker, field, before: b, after: a});
  for (const caseId of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const a = before[caseId], b = after[caseId];
    if (!a || !b) { push(caseId, null, 'PRESENT', Boolean(a), Boolean(b)); continue; }
    if (a.refused !== b.refused) push(caseId, null, 'refused', a.refused, b.refused);
    if (!eq(a.wave, b.wave)) {
      if (a.wave?.status !== b.wave?.status) push(caseId, null, 'wave.status', a.wave?.status ?? null, b.wave?.status ?? null);
      if (a.wave?.inserted !== b.wave?.inserted) push(caseId, null, 'wave.inserted', a.wave?.inserted ?? null, b.wave?.inserted ?? null);
    }
    if (!eq(a.rounds, b.rounds)) push(caseId, null, 'rounds', a.rounds, b.rounds);
    for (const label of [...new Set([...Object.keys(a.workers), ...Object.keys(b.workers)])].sort()) {
      const x = a.workers[label], y = b.workers[label];
      if (!x || !y) { push(caseId, label, 'PRESENT', Boolean(x), Boolean(y)); continue; }
      for (const field of ['hardBlockers', 'dispatchBlockers', 'dispatchEligible', 'delivery', 'event']) if (!eq(x[field], y[field])) push(caseId, label, field, x[field], y[field]);
      const bothNumbers = typeof x.score === 'number' && typeof y.score === 'number';
      if (bothNumbers ? Math.abs(x.score - y.score) > tolerance : x.score !== y.score) push(caseId, label, 'score', x.score, y.score);
    }
  }
  return diffs;
}
const fitsFlip = caseId => [
  {caseId, worker: 'fits', field: 'dispatchEligible', before: false, after: true},
  {caseId, worker: 'fits', field: 'dispatchBlockers', before: ['OUTSIDE_AVAILABILITY'], after: []},
  {caseId, worker: 'fits', field: 'delivery', before: false, after: true},
  {caseId, worker: 'fits', field: 'event', before: false, after: true},
  {caseId, worker: 'fits', field: 'score', scoreDelta: 25},
  {caseId, worker: null, field: 'wave.status', check: (b, a) => b !== 'SENT' && a === 'SENT'},
  {caseId, worker: null, field: 'wave.inserted', before: 0, after: 1},
  {caseId, worker: null, field: 'rounds', check: (b, a) => b.length === 1 && a.length === 1 && b[0].status !== 'SENT' && a[0].status === 'SENT'},
];
const pausedGone = (caseId, worker) => ({caseId, worker, field: 'dispatchBlockers', before: ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY'], after: ['OUTSIDE_AVAILABILITY']});
/**
 * THE INTENDED FLIPS of the candidate on the real S02 corpus, written down BEFORE any run and derived from the corpus expectations (T-003 and T-006: FITS "declares exactly what the task needs,
 * available" is ELIGIBLE; DOES_NOT_FIT and UNKNOWN_CAPABILITY are MANUAL_ONLY with only the named soft blocker) and from S03 finding F1, not from the after-state:
 *   * the FITS worker of T-003 (TOMORROW_FLEXIBLE) and T-006 (WEEK_FLEXIBLE) becomes eligible and is delivered (the one wave inserts exactly one delivery), +25 points of the schedule component;
 *   * the DOES_NOT_FIT worker of T-003 (another city) loses OUTSIDE_AVAILABILITY and keeps only OUTSIDE_PREFERRED_RADIUS, which is what the corpus says (+25 points as well: it declares the schedule);
 *   * the NONE_DECLARED workers (T-003 UNKNOWN_CAPABILITY, T-006 DOES_NOT_FIT and UNKNOWN_CAPABILITY) keep OUTSIDE_AVAILABILITY and every other blocker, and lose only CURRENT_AVAILABILITY_PAUSED:
 *     the matcher edit (decision D2) counts the window-less task as future availability, so the code the corpus never expected (S03 F3, the known corpus v1.1 item) is no longer added. No score, no eligibility.
 * Every other difference between the passes is UNINTENDED.
 */
export const INTENDED_FLIPS = Object.freeze([
  ...fitsFlip('T-003'),
  {caseId: 'T-003', worker: 'does-not-fit', field: 'dispatchBlockers', before: ['OUTSIDE_AVAILABILITY', 'OUTSIDE_PREFERRED_RADIUS'], after: ['OUTSIDE_PREFERRED_RADIUS']},
  {caseId: 'T-003', worker: 'does-not-fit', field: 'score', scoreDelta: 25},
  pausedGone('T-003', 'unknown-capability'),
  ...fitsFlip('T-006'),
  pausedGone('T-006', 'does-not-fit'),
  pausedGone('T-006', 'unknown-capability'),
]);
/** The unmodified S03 fixtures (no adjustment) of T-003 and T-006 change only where the matcher edit applies: the NONE_DECLARED workers lose the paused code; the live-intent-only FITS worker stays refused (decision D1). */
export const VANILLA_INTENDED_FLIPS = Object.freeze([pausedGone('T-003', 'unknown-capability'), pausedGone('T-006', 'does-not-fit'), pausedGone('T-006', 'unknown-capability')]);
/** The same intent for the FULL match_detail of every corpus worker: key `caseId|label` -> {flips, pausedGone} (every other worker's detail must be identical). */
export const CORPUS_DETAIL_EXPECTATIONS = Object.freeze({
  'T-003|fits': {flips: true}, 'T-003|does-not-fit': {flips: true}, 'T-003|unknown-capability': {pausedGone: true},
  'T-006|fits': {flips: true}, 'T-006|does-not-fit': {pausedGone: true}, 'T-006|unknown-capability': {pausedGone: true},
});
/** The findings (`case|worker|field`) of the S03 run that this candidate closes: F1 (the five flips) and, as the D2 side effect, the three F3 paused-code disagreements. */
export const FINDINGS_CLOSED = Object.freeze(['T-003|fits|dispatchEligible', 'T-003|fits|dispatchBlockers', 'T-003|does-not-fit|dispatchBlockers', 'T-006|fits|dispatchEligible', 'T-006|fits|dispatchBlockers',
  'T-003|unknown-capability|dispatchBlockers', 'T-006|does-not-fit|dispatchBlockers', 'T-006|unknown-capability|dispatchBlockers']);
/** Splits diffs into {matched, unintended, missing} against an allow-list (entries with before/after, a check(before, after), or a scoreDelta). Each entry may be used once. */
export function checkFlips(diffs, allowed, {tolerance = 1e-6} = {}) {
  const used = new Set(), unintended = [], matched = [];
  const fits = (entry, diff) => entry.caseId === diff.caseId && entry.worker === diff.worker && entry.field === diff.field
    && (entry.scoreDelta !== undefined ? typeof diff.before === 'number' && typeof diff.after === 'number' && Math.abs(diff.after - diff.before - entry.scoreDelta) <= tolerance
      : entry.check ? Boolean(entry.check(diff.before, diff.after)) : eq(entry.before, diff.before) && eq(entry.after, diff.after));
  for (const diff of diffs) {
    const index = allowed.findIndex((entry, i) => !used.has(i) && fits(entry, diff));
    if (index < 0) unintended.push(diff);
    else { used.add(index); matched.push(diff); }
  }
  const missing = allowed.filter((_, i) => !used.has(i)).map(entry => ({caseId: entry.caseId, worker: entry.worker, field: entry.field}));
  return {matched, unintended, missing};
}
/** The full match_detail of every corpus worker, before against after, as problems: each pair equal except as CORPUS_DETAIL_EXPECTATIONS says (detailDelta). */
export function corpusDetailProblems(before, after, expectations = CORPUS_DETAIL_EXPECTATIONS) {
  const problems = [];
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    if (!before[key] || !after[key]) { problems.push(`${key}: DETAIL_MISSING (${before[key] ? 'after' : 'before'})`); continue; }
    for (const problem of detailDelta(before[key], after[key], expectations[key] ?? {})) problems.push(`${key}: ${problem}`);
  }
  for (const key of Object.keys(expectations)) if (!before[key] && !after[key]) problems.push(`${key}: EXPECTED_DETAIL_NOT_READ`);
  return problems;
}

// ------------------------------------------------------------------ guards against a vacuous corpus pass
/** The corpus the proof is pinned to: a different file, a smaller selection or another id set is a different proof. sha256 is over the LF-normalised text (a CRLF checkout must not matter). */
export const CORPUS_PIN = Object.freeze({path: 'supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json', sha256: '00f43182f3b9923f868c3c2c8094b6b20c1b264b1a2bb6c72915d14fc1fdb08e', buildableCases: 37,
  idsSha256: '435e1544c87f50e604afd15fe82b60de9c465217277a4792df6acd10d5969c15'});
export const corpusTextSha256 = text => sha256(text.replace(/\r\n/g, '\n'));
export const corpusIdsSha256 = ids => sha256(ids.join('\n'));
/** Problems with the corpus FILE and selection (path, LF-normalised sha256, buildable cases, id list): [] when it is exactly the pinned one. */
export function corpusPinProblems({path, text, ids}) {
  const problems = [];
  if (path !== CORPUS_PIN.path) problems.push(`CORPUS_PATH ${path}`);
  if (corpusTextSha256(text) !== CORPUS_PIN.sha256) problems.push(`CORPUS_SHA256 ${corpusTextSha256(text)}`);
  if (ids.length !== CORPUS_PIN.buildableCases) problems.push(`CORPUS_BUILDABLE_CASES ${ids.length}`);
  if (corpusIdsSha256(ids) !== CORPUS_PIN.idsSha256) problems.push(`CORPUS_ID_LIST ${corpusIdsSha256(ids)}`);
  return problems;
}
const BAD_STATUSES = ['PRODUCT_PATH_REFUSED', 'UNASSERTED', 'HARNESS_ERROR', 'RUN'];
/**
 * A pass must have really covered its cases: the outcome count is the expected one, no case was refused by the product path (a case refused in two passes would compare as "identical" and be
 * covered by nothing), and no status of the summary is a refusal, an unasserted case or a harness error. [] when the pass is fully covered.
 */
export function corpusCoverageProblems({outcomes, summary, expectedCases}) {
  const problems = [], keys = Object.keys(outcomes ?? {});
  if (keys.length !== expectedCases) problems.push(`CASES_COVERED ${keys.length} of ${expectedCases}`);
  for (const key of keys) if (outcomes[key].refused) problems.push(`PRODUCT_PATH_REFUSED ${key}`);
  for (const status of Object.keys(summary?.statuses ?? {})) if (BAD_STATUSES.includes(status)) problems.push(`STATUS ${status} x${summary.statuses[status]}`);
  const total = Object.values(summary?.statuses ?? {}).reduce((sum, n) => sum + n, 0);
  if (total !== expectedCases) problems.push(`STATUS_TOTAL ${total} of ${expectedCases}`);
  return problems;
}
/**
 * The workers the fixture adjustment may touch, exactly: (case, spec label) pairs. Written down: T-003 and T-006 only, the workers that declare AVAILABLE_NOW_AND_SCHEDULED (the FITS worker, the
 * DOES_NOT_FIT worker of T-003 and the DRAFT control that is a copy of the FITS worker). NONE_DECLARED and AVAILABLE_NOW_ONLY workers are never adjusted.
 */
export const EXPECTED_ADJUSTED_WORKERS = Object.freeze([['T-003', 'fits-T-003'], ['T-003', 'does-not-fit-T-003'], ['T-003', 'control-restricted-T-003'], ['T-006', 'fits-T-006'], ['T-006', 'control-restricted-T-006']]);
export const adjustedList = adjusted => adjusted.map(item => [item.caseId, item.worker]).sort((x, y) => (x.join('|') < y.join('|') ? -1 : 1));
/** [] when the adjusted workers of a pass are exactly the expected ones (restricted to the cases the pass ran; none at all for an unmodified pass). */
export function adjustedProblems(adjusted, {augment, caseIds = null}) {
  const want = augment ? EXPECTED_ADJUSTED_WORKERS.filter(([caseId]) => !caseIds || caseIds.includes(caseId)) : [];
  const got = adjustedList(adjusted), wanted = adjustedList(want.map(([caseId, worker]) => ({caseId, worker})));
  return JSON.stringify(got) === JSON.stringify(wanted) ? [] : [`ADJUSTED_WORKERS ${JSON.stringify(got)} instead of ${JSON.stringify(wanted)}`];
}

/**
 * The one fixture adjustment of the proof. The S02 corpus gives the FITS worker of T-003 and T-006 the shape AVAILABLE_NOW_AND_SCHEDULED ("a weekly rule covers the task time"), but these two
 * tasks carry no window, so the S03 harness (timeutil.availabilityFor) can only build "available now" and no rule: the worker the corpus describes cannot be built from a window that does not
 * exist. The proof gives such a worker (shape AVAILABLE_NOW_AND_SCHEDULED or SCHEDULED_ONLY, no task window, kind TOMORROW_FLEXIBLE or WEEK_FLEXIBLE) the schedule the shape stands for, NARROW so
 * that the product path discriminates the window and not only the wiring: for "sutra" ONE rule on tomorrow's local weekday, 09:00-17:00 (the clock of the pass); for "ove nedelje" ONE rule on
 * Sunday (the last day of the local week, so always inside the remaining part of it), the whole day. The predecessor refuses such a worker too (a null window refuses everyone), which the BEFORE pass
 * shows. Nothing else is touched. Returns the spec unchanged when the adjustment does not apply (so an identity check tells the caller).
 */
export function augmentSpec(spec, scheduleKind, newId, {nowMs} = {}) {
  const a = spec?.availability;
  if (!FLEXIBLE_KINDS.includes(scheduleKind) || spec.interval || !a || typeof a !== 'object' || !('shape' in a)) return spec;
  if (!['AVAILABLE_NOW_AND_SCHEDULED', 'SCHEDULED_ONLY'].includes(a.shape)) return spec;
  if (typeof nowMs !== 'number') throw new Error('AUGMENT_NEEDS_THE_PASS_CLOCK');
  const narrow = scheduleKind === 'TOMORROW_FLEXIBLE'
    ? {weekdays: [(localParts(nowMs, BELGRADE).weekday + 1) % 7], startTime: '09:00:00', endTime: '17:00:00'}
    : {weekdays: [0], startTime: '00:00:00', endTime: '23:59:00'};
  return {...spec, availability: {timezone: BELGRADE, availableNow: a.shape === 'AVAILABLE_NOW_AND_SCHEDULED', windows: [],
    rules: [{id: newId(), ...narrow, startsOn: '2026-01-01', endsOn: null, label: 'EX-06 ex06a fixture', active: true}]}};
}

// ------------------------------------------------------------------ what the proof asserts of one matrix pair
/**
 * Everything the proof asserts of ONE (task, worker) pair read through the real functions, as problems ([] = as written): the schedule gate, the cheap candidate gate, the COMPLETE blocker lists
 * and the eligibility of match_detail, and the structure of the detail. An ACTIVE matrix worker has no hard blocker and its dispatch blockers are EXACTLY the schedule codes (the fixtures carry no other
 * gate: no required skill, REMOTE, OFFERS, default preferences), so a flip must also be dispatchEligible (the W02 canon FUTURE_OFF_MATCHES_REAL_WEEKLY_SCHEDULE: a scheduled-only worker is eligible) and
 * an admitted pair that stays ineligible for another reason is a problem. A DRAFT worker is never eligible (ACCOUNT_OR_PROFILE_RESTRICTED).
 *   expect = {admitted, codes (null = not asserted)}; got = {admitted, cheap, detail, codes}; active = the worker's profile_status is ACTIVE.
 */
export function pairProblems({expect, got, active}) {
  const problems = [], d = got?.detail ?? {};
  if (got.admitted !== expect.admitted) problems.push(`GATE worker_dispatch_time_admitted ${got.admitted} instead of ${expect.admitted}`);
  if (expect.codes && JSON.stringify(got.codes) !== JSON.stringify([...expect.codes].sort())) problems.push(`SCHEDULE_CODES ${JSON.stringify(got.codes)} instead of ${JSON.stringify(expect.codes)}`);
  if (got.cheap !== (active ? got.admitted : false)) problems.push(`CHEAP_GATE ${got.cheap} does not follow the schedule gate (${got.admitted}, active ${active})`);
  problems.push(...detailProblems(got.detail, {admitted: got.admitted}));
  if (active) {
    if ((d.hardBlockers ?? []).length !== 0) problems.push(`HARD_BLOCKERS ${JSON.stringify(d.hardBlockers)} on a fixture worker that has none`);
    if (d.responseAllowed !== true) problems.push(`RESPONSE_ALLOWED ${d.responseAllowed}`);
    if (expect.codes) {
      if (JSON.stringify(sortedSet(d.dispatchBlockers)) !== JSON.stringify([...expect.codes].sort())) problems.push(`DISPATCH_BLOCKERS ${JSON.stringify(sortedSet(d.dispatchBlockers))} instead of exactly the schedule codes ${JSON.stringify([...expect.codes].sort())}`);
      const eligible = expect.admitted && expect.codes.length === 0;
      if (d.dispatchEligible !== eligible) problems.push(`DISPATCH_ELIGIBLE ${d.dispatchEligible} instead of ${eligible}`);
    }
  } else {
    if (!(d.hardBlockers ?? []).includes('ACCOUNT_OR_PROFILE_RESTRICTED')) problems.push(`DRAFT_WORKER_WITHOUT_ACCOUNT_OR_PROFILE_RESTRICTED ${JSON.stringify(d.hardBlockers)}`);
    if (d.dispatchEligible !== false) problems.push(`DRAFT_WORKER_ELIGIBLE ${d.dispatchEligible}`);
  }
  return problems;
}

// ------------------------------------------------------------------ the corpus passes: guards that make a pass comparable and honest
/** The corpus cases the claim "proved on the product path" rests on: the window-less TOMORROW (T-003) and WEEK (T-006) tasks. */
export const PRODUCT_PATH_CASES = Object.freeze(['T-003', 'T-006']);
/** The corpus clock is rebased ONCE (at the first pass) and every pass reuses it, so the stored starts_at of a case is the same in every pass (see createPassRunner); it may age this much. */
export const REBASE_MAX_AGE_MS = 3 * HOUR;
/**
 * The CLOCK-DERIVED fields of private.match_detail, found by reading its body on DEV (md5 38c7894a for the wrapper, 9180606a for the body): `liveStateDate` = (needs.starts_at at the worker zone)::date
 * (derived from a stored time: constant across passes only when the stored starts_at is, which the shared rebase and corpusTimeProblems guarantee); the `fairness` component (a fresh account has no
 * exposure in the last seven days) and the soft codes CURRENT_AVAILABILITY_PAUSED / SAME_DAY_URGENT_NOTIFICATIONS_PAUSED read the clock (every corpus start is a day or more ahead; the corpus has no
 * urgent task: fixtures.mjs asserts it). Nothing is normalised away: the detail comparison stays strict, and a pass whose stored times differ from the reference is refused first, with a clear name.
 */
export const CLOCK_DERIVED_DETAIL_FIELDS = Object.freeze(['liveStateDate', 'scoreComponents.fairness', 'dispatchBlockers:CURRENT_AVAILABILITY_PAUSED', 'dispatchBlockers:SAME_DAY_URGENT_NOTIFICATIONS_PAUSED']);
/** The keys `case|worker label` of the full details of a pass must be exactly the workers of its outcomes: a worker whose detail could not be matched must not drop out of the comparison silently. */
export function detailCoverageProblems({outcomes, details}) {
  const want = Object.entries(outcomes).flatMap(([id, item]) => Object.keys(item.workers).map(label => `${id}|${label}`)).sort(), got = Object.keys(details).sort();
  const problems = [];
  for (const key of want) if (!got.includes(key)) problems.push(`DETAIL_NOT_CAPTURED ${key}`);
  for (const key of got) if (!want.includes(key)) problems.push(`DETAIL_WITHOUT_AN_OUTCOME ${key}`);
  return problems;
}
/** The cases the product-path claim rests on must have been materialised by the product path itself (never a direct insert): entries = [{id, materialisation, degraded}]. */
export function productPathProblems(entries, cases = PRODUCT_PATH_CASES) {
  const problems = [];
  for (const id of cases) {
    const entry = entries.find(item => item.id === id);
    if (!entry) continue;
    if (entry.materialisation !== 'PRODUCT_PATH' || entry.degraded) problems.push(`PRODUCT_PATH_NOT_USED ${id}: ${entry.materialisation}${entry.degraded ? ' (degraded)' : ''}`);
  }
  return problems;
}
/**
 * The assumptions behind the NARROW fixture rule (augmentSpec), read from the stored task: the schedule kind is the expected one, the product stored NO window (else the derived window is not what
 * is tested), the task zone is Europe/Belgrade or none (the rule is written in Belgrade time), and the publication day is the pass-clock day (tomorrow's weekday is computed from the pass clock).
 * stored = {schedule_kind, starts_at, ends_at, published_at, task_timezone} of the needs row.
 */
export function narrowFixtureProblems({caseId, expectedKind, stored, passNowMs}) {
  if (!stored) return [`NARROW_FIXTURE_TASK_NOT_READ ${caseId}`];
  const problems = [], absent = value => value === null || value === undefined;
  if (stored.schedule_kind !== expectedKind) problems.push(`NARROW_FIXTURE_SCHEDULE_KIND ${caseId}: ${stored.schedule_kind} instead of ${expectedKind}`);
  if (!absent(stored.starts_at) || !absent(stored.ends_at)) problems.push(`NARROW_FIXTURE_THE_PRODUCT_STORED_A_WINDOW ${caseId}: ${stored.starts_at} .. ${stored.ends_at}`);
  if (!(absent(stored.task_timezone) || stored.task_timezone === BELGRADE)) problems.push(`NARROW_FIXTURE_TASK_ZONE ${caseId}: ${stored.task_timezone}`);
  if (absent(stored.published_at)) problems.push(`NARROW_FIXTURE_NOT_PUBLISHED ${caseId}`);
  else if (localParts(Date.parse(stored.published_at), BELGRADE).date !== localParts(passNowMs, BELGRADE).date) {
    problems.push(`NARROW_FIXTURE_ANCHOR_DAY_MOVED ${caseId}: published ${stored.published_at}, the pass clock is ${iso(passNowMs)}`);
  }
  return problems;
}
/** {caseId: {starts_at, ends_at}} of the stored times of a pass, from its runner entries (readBack.need). */
export function timesOf(entries) {
  const times = {};
  for (const entry of entries) if (entry.readBack?.need) times[entry.id] = {starts_at: entry.readBack.need.starts_at ?? null, ends_at: entry.readBack.need.ends_at ?? null};
  return times;
}
/** Every case of `other` must carry the same stored starts_at / ends_at (as instants) as in `reference`, and the same rebase: the stored time is the one clock-derived input of the full detail. */
export function corpusTimeProblems(reference, other, {referenceRebase = null, otherRebase = null} = {}) {
  const problems = [], ms = value => (value === null || value === undefined ? null : Date.parse(value));
  if ((referenceRebase?.deltaMs ?? null) !== (otherRebase?.deltaMs ?? null)) problems.push(`CORPUS_REBASE_DIFFERS ${referenceRebase?.deltaMs ?? null} -> ${otherRebase?.deltaMs ?? null}`);
  for (const [id, times] of Object.entries(other)) {
    const ref = reference[id];
    if (!ref) { problems.push(`CORPUS_TIMES_CASE_NOT_IN_THE_REFERENCE ${id}`); continue; }
    for (const field of ['starts_at', 'ends_at']) if (ms(ref[field]) !== ms(times[field])) problems.push(`CORPUS_TIMES_DIFFER ${id} ${field}: ${ref[field]} -> ${times[field]}`);
  }
  return problems;
}
