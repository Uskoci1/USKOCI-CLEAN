// Offline tests of ex06a_lib.mjs and of the consistency of the generated files (no database, no dependency): node --test supabase/proofs/ex06/ex06a_lib.test.mjs
// What they show: the JS oracle reproduces, to the millisecond, the window expressions that were evaluated with a SELECT on canonical DEV (golden vectors below); the hand-written expectations of
// the scenario matrix agree with an executable port of the two functions (so a slip in a table is caught here, not in CI); the diff rule, the allow-list, the detail rule and the coverage guards behave;
// the three generated files agree; and - the MUTATION TESTS - a WRONG implementation of each thing the matrix and the passes are meant to pin is killed: the matrix is replayed on the JS oracle with a
// mutant semantics and must report a violation (VAC-1 .. VAC-8 and the semantic decisions), and every guard that could let a vacuous pass through is shown to refuse a vacuous pass.
// What they do NOT show: how the SQL behaves (nothing here runs SQL); that is the job of the disposable proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as lib from './ex06a_lib.mjs';
import {PROOF_POINT_PINS} from './lib/pins.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const md5 = text => createHash('md5').update(text).digest('hex');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const at = text => Date.parse(text);

// ------------------------------------------------------------------ the oracle against real PostgreSQL
// Each vector: [kind, published instant, task zone, expected start, expected end]; the expected instants are what the SQL expressions of WINDOW_BLOCK returned when evaluated with a SELECT
// on canonical DEV (leqcwgzvjsxugfgzdmth) on 2026-10-01 for the same inputs (wtz = the task zone when private.availability_timezone_valid, else Europe/Belgrade; anchor_day:=(published at time zone wtz)::date;
// then the TOMORROW and WEEK expressions). The first 11 are the first author's; the next 17 are the late-publication, zone-fallback and local-edge vectors added in round 2; the last 10 (round 3, read with
// a SELECT on DEV on 2026-10-01) pin the ANCHOR day for a task zone that is not Belgrade: a New York task published at 03:30Z is still the evening of the previous day there.
const GOLDEN = [
  ['TOMORROW_FLEXIBLE', '2026-10-01T14:00:00Z', 'Europe/Belgrade', '2026-10-01T22:00:00Z', '2026-10-02T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', 'Europe/Belgrade', '2026-10-02T22:00:00Z', '2026-10-03T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-03-28T12:00:00Z', 'Europe/Belgrade', '2026-03-28T23:00:00Z', '2026-03-29T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-10-24T12:00:00Z', 'Europe/Belgrade', '2026-10-24T22:00:00Z', '2026-10-25T23:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', 'America/New_York', '2026-10-02T04:00:00Z', '2026-10-03T04:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', 'UTC', '2026-10-02T00:00:00Z', '2026-10-03T00:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-05T08:00:00Z', 'Europe/Belgrade', '2026-10-04T22:00:00Z', '2026-10-11T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-07T08:00:00Z', 'Europe/Belgrade', '2026-10-06T22:00:00Z', '2026-10-11T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-04T10:00:00Z', 'Europe/Belgrade', '2026-10-03T22:00:00Z', '2026-10-04T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-04T23:30:00Z', 'Europe/Belgrade', '2026-10-04T22:00:00Z', '2026-10-11T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-21T08:00:00Z', 'Europe/Belgrade', '2026-10-20T22:00:00Z', '2026-10-25T23:00:00Z'],
  // VAC-1: the local day is not the UTC day (the three vectors of the review, verified on DEV, and their winter/summer twins)
  ['TOMORROW_FLEXIBLE', '2026-12-02T23:30:00Z', 'Europe/Belgrade', '2026-12-03T23:00:00Z', '2026-12-04T23:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2027-07-06T23:30:00Z', 'Europe/Belgrade', '2027-07-07T22:00:00Z', '2027-07-08T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2027-07-04T22:30:00Z', 'Europe/Belgrade', '2027-07-04T22:00:00Z', '2027-07-11T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2027-07-04T23:30:00Z', 'Europe/Belgrade', '2027-07-04T22:00:00Z', '2027-07-11T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-12-06T23:30:00Z', 'Europe/Belgrade', '2026-12-06T23:00:00Z', '2026-12-13T23:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-12-02T22:30:00Z', 'Europe/Belgrade', '2026-12-02T23:00:00Z', '2026-12-03T23:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2027-07-06T22:30:00Z', 'Europe/Belgrade', '2027-07-07T22:00:00Z', '2027-07-08T22:00:00Z'],
  // the zone fallback: no zone and an invalid zone are Europe/Belgrade (never a worker zone); a valid zone is used, for WEEK as well
  ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', null, '2026-10-02T22:00:00Z', '2026-10-03T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', 'Nope/Zone', '2026-10-02T22:00:00Z', '2026-10-03T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-07T08:00:00Z', null, '2026-10-06T22:00:00Z', '2026-10-11T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-07T08:00:00Z', 'Nope/Zone', '2026-10-06T22:00:00Z', '2026-10-11T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-07T08:00:00Z', 'America/New_York', '2026-10-07T04:00:00Z', '2026-10-12T04:00:00Z'],
  ['WEEK_FLEXIBLE', '2026-10-04T23:30:00Z', 'America/New_York', '2026-10-04T04:00:00Z', '2026-10-05T04:00:00Z'],
  // the local-time edges of the publication instant (23:59:30 and 00:00:30 Belgrade): the anchor day flips with the local midnight
  ['TOMORROW_FLEXIBLE', '2026-10-21T21:59:30Z', 'Europe/Belgrade', '2026-10-21T22:00:00Z', '2026-10-22T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-10-21T22:00:30Z', 'Europe/Belgrade', '2026-10-22T22:00:00Z', '2026-10-23T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-12-02T22:59:30Z', 'Europe/Belgrade', '2026-12-02T23:00:00Z', '2026-12-03T23:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2026-12-02T23:00:30Z', 'Europe/Belgrade', '2026-12-03T23:00:00Z', '2026-12-04T23:00:00Z'],
  // round 3: the anchor day in the TASK zone (New York), in the Belgrade fallback (null, invalid) and in Belgrade at the same instants
  ['TOMORROW_FLEXIBLE', '2027-07-08T03:30:00Z', 'America/New_York', '2027-07-08T04:00:00Z', '2027-07-09T04:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2027-12-09T03:30:00Z', 'America/New_York', '2027-12-09T05:00:00Z', '2027-12-10T05:00:00Z'],
  ['WEEK_FLEXIBLE', '2027-07-12T03:30:00Z', 'America/New_York', '2027-07-11T04:00:00Z', '2027-07-12T04:00:00Z'],
  ['WEEK_FLEXIBLE', '2027-12-13T03:30:00Z', 'America/New_York', '2027-12-12T05:00:00Z', '2027-12-13T05:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2027-07-08T03:30:00Z', 'Europe/Belgrade', '2027-07-08T22:00:00Z', '2027-07-09T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2027-07-07T23:30:00Z', null, '2027-07-08T22:00:00Z', '2027-07-09T22:00:00Z'],
  ['TOMORROW_FLEXIBLE', '2027-07-07T23:30:00Z', 'Nope/Zone', '2027-07-08T22:00:00Z', '2027-07-09T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2027-07-12T03:30:00Z', 'Europe/Belgrade', '2027-07-11T22:00:00Z', '2027-07-18T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2027-07-11T23:30:00Z', null, '2027-07-11T22:00:00Z', '2027-07-18T22:00:00Z'],
  ['WEEK_FLEXIBLE', '2027-07-11T23:30:00Z', 'Nope/Zone', '2027-07-11T22:00:00Z', '2027-07-18T22:00:00Z'],
];
test('derivedWindow reproduces the SQL expressions evaluated on a real PostgreSQL', () => {
  assert.equal(GOLDEN.length, 38);
  for (const [kind, published, zone, start, end] of GOLDEN) {
    const w = lib.derivedWindow(kind, at(published), {taskZone: zone});
    assert.equal(lib.iso(w.startMs), new Date(start).toISOString(), `${kind} ${published} ${zone} start`);
    assert.equal(lib.iso(w.endMs), new Date(end).toISOString(), `${kind} ${published} ${zone} end`);
  }
});

test('the DST change days of next year are 23 and 25 hours long and the week across them ends at the next local midnight', () => {
  const spring = lib.derivedWindow('TOMORROW_FLEXIBLE', at('2027-03-27T10:00:00Z'), {taskZone: 'Europe/Belgrade'});
  assert.equal((spring.endMs - spring.startMs) / lib.HOUR, 23);
  assert.equal(lib.iso(spring.startMs), '2027-03-27T23:00:00.000Z');
  assert.equal(lib.iso(spring.endMs), '2027-03-28T22:00:00.000Z');
  const fall = lib.derivedWindow('TOMORROW_FLEXIBLE', at('2027-10-30T10:00:00Z'), {taskZone: 'Europe/Belgrade'});
  assert.equal((fall.endMs - fall.startMs) / lib.HOUR, 25);
  assert.equal(lib.iso(fall.endMs), '2027-10-31T23:00:00.000Z');
  const week = lib.derivedWindow('WEEK_FLEXIBLE', at('2027-03-24T10:00:00Z'), {taskZone: 'Europe/Belgrade'});
  assert.equal(lib.iso(week.endMs), '2027-03-28T22:00:00.000Z');
  assert.equal(lib.lastSunday(2027, 2), '2027-03-28');
  assert.equal(lib.lastSunday(2027, 9), '2027-10-31');
});

test('the zone: the task zone when valid, else Europe/Belgrade, never the worker zone; no publication instant, no window', () => {
  const published = at('2027-06-09T10:00:00Z');
  assert.equal(lib.derivedWindow('TOMORROW_FLEXIBLE', published, {taskZone: null}).zone, 'Europe/Belgrade');
  assert.equal(lib.derivedWindow('TOMORROW_FLEXIBLE', published, {taskZone: 'Nope/Zone'}).zone, 'Europe/Belgrade');
  assert.equal(lib.derivedWindow('TOMORROW_FLEXIBLE', published, {taskZone: 'America/New_York'}).zone, 'America/New_York');
  assert.equal(lib.derivedWindow('WEEK_FLEXIBLE', published, {taskZone: 'UTC'}).zone, 'UTC');
  assert.equal(lib.derivedWindow('WEEK_FLEXIBLE', published, {taskZone: null}).zone, 'Europe/Belgrade');
  assert.equal(lib.derivedWindow('TOMORROW_FLEXIBLE', null, {taskZone: 'Europe/Belgrade'}), null, 'a task without published_at keeps the refusal: no window, no rolling anchor');
  assert.equal(lib.derivedWindow('TODAY_FLEXIBLE', published), null);
  assert.equal(lib.derivedWindow('FIXED_WINDOW', published), null);
  assert.equal(lib.validZone('Europe/Belgrade'), true);
  assert.equal(lib.validZone('posix/Europe/Belgrade'), false);
  assert.equal(lib.validZone('CET'), false, 'a zone without a slash is not valid for the function');
  assert.equal(lib.validZone('Nope/Zone'), false);
  // the worker zone is passed to the oracle and ignored by the window: the same task has ONE window for every worker
  const task = {kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: published, taskZone: null};
  const ny = {status: 'ACTIVE', availableNow: true, zone: lib.NEW_YORK, rules: [], windows: []}, plain = {...ny, zone: null};
  const rule = {weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00:00', endTime: '23:59:00', startsOn: '2026-01-01', endsOn: null, active: true};
  assert.equal(lib.admittedOracle({task, worker: {...ny, rules: [rule]}, nowMs: published}), lib.admittedOracle({task, worker: {...plain, rules: [rule]}, nowMs: published}));
});

test('a later wave does not move tomorrow: the window follows the publication instant, not the matching time', () => {
  const published = at('2027-06-09T10:00:00Z');
  const task = {kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: published, taskZone: 'Europe/Belgrade'};
  const worker = {status: 'ACTIVE', availableNow: false, zone: null, rules: [{weekdays: [4], startTime: '09:00:00', endTime: '17:00:00', startsOn: '2026-01-01', endsOn: null, active: true}], windows: []};
  assert.equal(lib.admittedOracle({task, worker, nowMs: published}), true);
  assert.equal(lib.admittedOracle({task, worker, nowMs: published + 3 * lib.HOUR}), true, 'three hours later: still tomorrow (Thursday)');
  assert.equal(lib.admittedOracle({task, worker, nowMs: published + 2 * lib.DAY}), false, 'after the day is over the task is refused again');
});

// ------------------------------------------------------------------ the oracle against the hand-written expectations
const CLOCKS = ['2026-10-01T12:00:00Z', '2026-12-31T23:55:00Z', '2027-02-14T08:00:00Z', '2027-03-26T22:30:00Z', '2027-06-30T09:00:00Z', '2026-10-04T10:00:00Z'];
const DAYS14 = Array.from({length: 14}, (_, i) => at('2026-10-01T12:00:00Z') + i * lib.DAY);
/** Local (Belgrade) times of day on a Saturday, a Sunday and the two DST change days: every clock of a day the proof could start at (the clock family refuses the first 2 and the last 10 minutes of the local day). */
const DAY_CLOCKS = ['2026-10-03', '2026-10-04', '2026-10-25', '2027-03-28'].flatMap(date => ['00:03:00', '00:30:00', '03:30:00', '06:00:00', '08:00:00', '10:30:00', '12:00:00', '14:00:00', '16:30:00', '18:00:00',
  '20:00:00', '20:30:00', '21:45:00', '22:30:00', '23:00:00', '23:30:00', '23:49:00'].map(time => lib.localToMs(date, time, lib.BELGRADE)));
/** Every expectation of the matrix AND of the clock family that the semantics violates (case or unchanged id, with the field), at one clock. [] = the semantics is the candidate. */
function violations(semantics, nowMs, {skipWorkers = []} = {}) {
  const plan = lib.buildMatrix(nowMs), family = lib.buildClockFamily(nowMs), found = [];
  for (const part of [plan, family]) {
    for (const item of part.cases) {
      const input = {task: part.tasks[item.task], worker: part.workers[item.worker], nowMs, derive: true, semantics};
      if (lib.admittedOracle(input) !== item.after.admitted) found.push(item.id + ' admitted');
      if (item.after.codes && JSON.stringify(lib.codesOracle(input)) !== JSON.stringify(item.after.codes)) found.push(item.id + ' codes');
    }
  }
  for (const item of plan.unchanged) {
    if (skipWorkers.includes(item.worker)) continue;
    const input = {task: plan.tasks[item.task], worker: plan.workers[item.worker], nowMs, derive: true, semantics};
    if (lib.admittedOracle(input) !== item.admitted) found.push(item.id + ' unchanged');
    if (JSON.stringify(lib.codesOracle(input)) !== JSON.stringify(item.codes)) found.push(item.id + ' unchanged codes');
  }
  return found;
}
test('the scenario matrix agrees with the executable port of the functions, whatever the clock of the run', () => {
  for (const clock of CLOCKS) {
    const now = at(clock), plan = lib.buildMatrix(now);
    assert.ok(plan.cases.length >= 120, 'the matrix is not thin: ' + plan.cases.length);
    for (const item of plan.cases) {
      const input = {task: plan.tasks[item.task], worker: plan.workers[item.worker], nowMs: now};
      assert.equal(lib.admittedOracle({...input, derive: false}), item.before.admitted, `${clock} ${item.id} before`);
      assert.equal(lib.admittedOracle({...input, derive: true}), item.after.admitted, `${clock} ${item.id} after`);
      if (item.before.codes) assert.deepEqual(lib.codesOracle({...input, derive: false}), item.before.codes, `${clock} ${item.id} before codes`);
      if (item.after.codes) assert.deepEqual(lib.codesOracle({...input, derive: true}), item.after.codes, `${clock} ${item.id} after codes`);
    }
    for (const item of plan.unchanged) {
      const input = {task: plan.tasks[item.task], worker: plan.workers[item.worker], nowMs: now};
      assert.equal(lib.admittedOracle({...input, derive: false}), item.admitted, `${clock} ${item.id} predecessor`);
      assert.equal(lib.admittedOracle({...input, derive: true}), item.admitted, `${clock} ${item.id} candidate`);
      assert.deepEqual(lib.codesOracle({...input, derive: false}), lib.codesOracle({...input, derive: true}), `${clock} ${item.id} codes unchanged`);
      assert.deepEqual(item.codes, lib.codesOracle({...input, derive: false}), `${clock} ${item.id} the expectation carries the complete schedule codes`);
      assert.equal(item.codes.includes('OUTSIDE_AVAILABILITY'), !item.admitted, `${clock} ${item.id} the gate and the code agree`);
    }
  }
  // the clock family, at every clock of the day (it is installed afresh before every read of the proof, so only the clock of the read matters)
  for (const now of [...CLOCKS.map(at), ...DAY_CLOCKS]) {
    const family = lib.buildClockFamily(now);
    for (const item of family.cases) {
      const input = {task: family.tasks[item.task], worker: family.workers[item.worker], nowMs: now};
      assert.equal(lib.admittedOracle({...input, derive: false}), item.before.admitted, `${lib.iso(now)} ${item.id} before`);
      assert.equal(lib.admittedOracle({...input, derive: true}), item.after.admitted, `${lib.iso(now)} ${item.id} after`);
      assert.deepEqual(lib.codesOracle({...input, derive: false}), item.before.codes, `${lib.iso(now)} ${item.id} before codes`);
      assert.deepEqual(lib.codesOracle({...input, derive: true}), item.after.codes, `${lib.iso(now)} ${item.id} after codes`);
    }
  }
});

test('the matrix covers every dedicated case and is not vacuous in either direction', () => {
  const plan = lib.buildMatrix(at('2026-10-01T12:00:00Z'));
  const ids = new Set(plan.cases.map(item => item.id));
  assert.equal(ids.size, plan.cases.length, 'case ids are unique');
  for (const need of ['A/on_thu', 'A/off_thu', 'A/off_none', 'A/on_thu_nextweek', 'A/on_mon', 'A/on_none', 'A/ny_thu', 'A/ny_thu_late', 'A/ny_wed_late', 'A/fri_early', 'A_null/ny_thu_late', 'A_bad/ny_thu_late',
    'A_null/ny_wed_late', 'A_null/on_thu', 'A_ny/ny_thu_late', 'A_ny/fri_early', 'B_past/alldays', 'B_null/alldays', 'B_null/off_alldays', 'C_sun/sun', 'C_sun/mon', 'C_mon/sun', 'C_mon/mon_next', 'C_wed/tue', 'C_wed/fri',
    'C_wed/off_fri', 'C_ny/wk_hi_after_bel', 'C_ny/ny_sun_late', 'C_null/ny_sun_late', 'C_bad/wk_lo_in_bel', 'D_spring/D_spring:lo_in', 'D_spring/D_spring:hi_out', 'D_fall/D_fall:hi_in', 'D_fall/D_fall:hi_out',
    'D_wspring/D_wspring:hi_in', 'D_wfall/D_wfall:hi_out', 'D_spring/D_spring:lo_in1', 'D_spring/D_spring:hi_in1', 'D_fall/D_fall:hi_in1', 'D_wspring/D_wspring:lo_in1', 'D_wfall/D_wfall:hi_in1',
    'F_late/fri', 'F_late/thu', 'F_cest/fri', 'F_cet/thu', 'F_2359/thu', 'F_0001/fri', 'G_late/wed', 'G_cest/mon', 'G_cet/sun',
    'N_ny/thu', 'N_ny/fri', 'N_ny/ny_thu', 'N_ny/ny_fri', 'N_bel/fri', 'N_bel/ny_thu', 'N_bel/ny_fri', 'N_null/ny_thu', 'N_bad/ny_fri', 'M_ny/sun', 'M_ny/mon', 'M_ny/ny_sun_late', 'M_bel/mon', 'M_bel/ny_sun_late', 'M_null/wed', 'M_bad/mon']) {
    assert.ok(ids.has(need), 'missing case ' + need);
  }
  const family = lib.buildClockFamily(at('2026-10-01T12:00:00Z'));
  for (const need of ['H_week/h_stale', 'H_week/h_late', 'H_week/h_today_rule', 'H_week/h_today_off', 'H_week/h_today_win']) assert.ok(family.cases.some(item => item.id === need), 'missing clock-family case ' + need);
  assert.ok(!ids.has('H_week/h_stale'), 'the clock-relative cases are not in the matrix (it is read four times over an hour)');
  assert.ok(plan.cases.filter(item => !item.before.admitted && item.after.admitted).length >= 50, 'enough intended flips');
  assert.ok(plan.cases.filter(item => !item.before.admitted && !item.after.admitted).length >= 50, 'enough cases that must stay refused');
  assert.ok(plan.cases.every(item => item.before.admitted === false), 'the predecessor refuses every window-less flexible-day/week task for everyone');
  assert.ok(plan.unchanged.some(item => item.admitted) && plan.unchanged.some(item => !item.admitted));
  assert.ok(plan.unchanged.length >= 60);
  // the DST edges: the derived window is 23 and 25 hours, so a 24-hour implementation would admit the touching windows or refuse the overlapping ones
  const spring = plan.anchors.edges.D_spring, fall = plan.anchors.edges.D_fall;
  assert.equal((spring.endMs - spring.startMs) / lib.HOUR, 23);
  assert.equal((fall.endMs - fall.startMs) / lib.HOUR, 25);
  assert.ok(spring.startMs > at('2026-10-01T12:00:00Z') + 80 * lib.DAY, 'the anchors lie months ahead, so the derived windows are in the future');
  // the late-publication anchors really are the next local day: the local weekday differs from the UTC weekday
  const dayOf = (ms, zone) => lib.localParts(ms, zone).weekday;
  const late = plan.tasks;
  assert.equal(dayOf(late.F_late.publishedAt, 'UTC'), 3); assert.equal(dayOf(late.F_late.publishedAt, lib.BELGRADE), 4);
  assert.equal(dayOf(late.F_cest.publishedAt, 'UTC'), 3); assert.equal(dayOf(late.F_cest.publishedAt, lib.BELGRADE), 4, 'summer time: 22:30Z is already Thursday');
  assert.equal(dayOf(late.F_cet.publishedAt, 'UTC'), 3); assert.equal(dayOf(late.F_cet.publishedAt, lib.BELGRADE), 3, 'winter time: 22:30Z is still Wednesday');
  assert.equal(dayOf(late.G_late.publishedAt, 'UTC'), 0); assert.equal(dayOf(late.G_late.publishedAt, lib.BELGRADE), 1);
  assert.equal(dayOf(late.G_cest.publishedAt, lib.BELGRADE), 1); assert.equal(dayOf(late.G_cet.publishedAt, lib.BELGRADE), 0);
  assert.equal(lib.localParts(late.F_2359.publishedAt, lib.BELGRADE).time, '23:59:30'); assert.equal(lib.localParts(late.F_0001.publishedAt, lib.BELGRADE).time, '00:00:30');
  // round 3: the New York task is published when the date of ITS zone differs from the UTC date, from the Belgrade date and from the date of a Belgrade worker (the three would otherwise agree)
  for (const key of ['N_ny', 'N_bel']) {
    const ms = late[key].publishedAt;
    assert.equal(lib.localParts(ms, 'UTC').date, lib.localParts(ms, lib.BELGRADE).date, key + ': UTC and Belgrade agree');
    assert.notEqual(lib.localParts(ms, lib.NEW_YORK).date, lib.localParts(ms, 'UTC').date, key + ': New York is the previous day');
    assert.equal(dayOf(ms, 'UTC'), 4); assert.equal(dayOf(ms, lib.NEW_YORK), 3);
  }
  assert.equal(late.N_ny.taskZone, lib.NEW_YORK); assert.equal(late.N_bel.taskZone, lib.BELGRADE); assert.equal(late.N_null.taskZone, null); assert.equal(late.N_bad.taskZone, 'Nope/Zone');
  for (const key of ['N_null', 'N_bad']) {
    const ms = late[key].publishedAt;
    assert.notEqual(lib.localParts(ms, 'UTC').date, lib.localParts(ms, lib.BELGRADE).date, key + ': the Belgrade date is the next day (the fallback zone is not UTC)');
    assert.notEqual(lib.localParts(ms, lib.NEW_YORK).date, lib.localParts(ms, lib.BELGRADE).date, key + ': nor the date of a New York worker');
  }
  for (const key of ['M_ny', 'M_bel']) {
    const ms = late[key].publishedAt;
    assert.equal(dayOf(ms, 'UTC'), 1); assert.equal(dayOf(ms, lib.BELGRADE), 1); assert.equal(dayOf(ms, lib.NEW_YORK), 0, key + ': Sunday evening in New York');
  }
});

test('decision D2 and the F3 characterisation: a scheduled-only worker is admitted by the gate AND the matcher; live intent alone invents nothing; a task without published_at is as before', () => {
  const plan = lib.buildMatrix(at('2026-10-01T12:00:00Z')), byId = id => plan.cases.find(item => item.id === id);
  assert.deepEqual(byId('A/off_thu').after, {admitted: true, codes: []});
  assert.deepEqual(byId('A/off_thu').before, {admitted: false, codes: ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY']});
  assert.deepEqual(byId('A/off_none').after, {admitted: false, codes: ['OUTSIDE_AVAILABILITY']}, 'S03 F3: NONE_DECLARED is OUTSIDE_AVAILABILITY only, as the corpus says');
  assert.deepEqual(byId('A/on_none').after, {admitted: false, codes: ['OUTSIDE_AVAILABILITY']}, 'D1: live intent alone is not availability');
  assert.deepEqual(byId('B_null/off_alldays').after, byId('B_null/off_alldays').before);
  assert.deepEqual(byId('C_wed/off_fri').after, {admitted: true, codes: []});
});

test('the oracle models the predecessor: a stored window is read as it is, the live path needs live intent', () => {
  const now = at('2026-10-01T12:00:00Z');
  const worker = {status: 'ACTIVE', availableNow: true, zone: null, rules: [], windows: []};
  assert.equal(lib.admittedOracle({task: {kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: now}, worker, nowMs: now}), true);
  assert.equal(lib.admittedOracle({task: {kind: 'TODAY_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: now}, worker: {...worker, availableNow: false}, nowMs: now}), false);
  assert.equal(lib.admittedOracle({task: {kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: now}, worker, nowMs: now, derive: false}), false);
  assert.equal(lib.admittedOracle({task: {kind: 'FIXED_WINDOW', startsAt: now - 3 * lib.HOUR, endsAt: now - lib.HOUR, publishedAt: now}, worker, nowMs: now}), false, 'a window that is over is refused');
  assert.throws(() => lib.admittedOracle({task: {kind: 'FIXED_WINDOW', startsAt: now - lib.HOUR, endsAt: now + lib.HOUR, publishedAt: now}, worker, nowMs: now}), /ORACLE_NOT_MODELLED/);
  assert.equal(lib.admittedOracle({task: {kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: null}, worker: {...worker, rules: [{weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00:00', endTime: '23:59:00', startsOn: '2026-01-01', endsOn: null, active: true}]}, nowMs: now}),
    false, 'no published_at: the refusal stays');
});

test('availablePeriods: adjacent rules merge, a gap does not, a personal exception is subtracted, half-open edges do not overlap', () => {
  const day = '2027-06-10', s = lib.localToMs(day, '00:00:00', lib.BELGRADE), e = lib.localToMs(lib.addDays(day, 1), '00:00:00', lib.BELGRADE);
  const rule = (a, b) => ({weekdays: [lib.dow(day)], startTime: a, endTime: b, startsOn: '2026-01-01', endsOn: null, active: true});
  assert.equal(lib.availablePeriods({rules: [rule('08:00:00', '10:00:00'), rule('10:00:00', '12:00:00')], windows: []}, s, e).length, 1);
  assert.equal(lib.availablePeriods({rules: [rule('08:00:00', '10:00:00'), rule('10:01:00', '12:00:00')], windows: []}, s, e).length, 2);
  const blocked = lib.availablePeriods({rules: [rule('08:00:00', '12:00:00')], windows: [{startsAt: lib.localToMs(day, '09:00:00', lib.BELGRADE), endsAt: lib.localToMs(day, '10:00:00', lib.BELGRADE), state: 'UNAVAILABLE'}]}, s, e);
  assert.equal(blocked.length, 2);
  assert.deepEqual(lib.availablePeriods({rules: [], windows: [{startsAt: s - 3600000, endsAt: s, state: 'AVAILABLE'}]}, s, e), []);
});

// ------------------------------------------------------------------ the MUTATION tests: a wrong implementation is killed by the matrix
const S = lib.SEMANTICS;
const MUTANTS = {
  // VAC-1: the local calendar day of the publication instant, not the UTC date (and not a fixed winter offset)
  UTC_ANCHOR: {...S, anchorDay: ms => new Date(ms).toISOString().slice(0, 10)},
  FIXED_WINTER_OFFSET_ANCHOR: {...S, anchorDay: ms => new Date(ms + lib.HOUR).toISOString().slice(0, 10)},
  // VAC-2: the remaining part of the week: the start of the window is clipped to now
  NO_CLIP: {...S, clipStart: startMs => startMs},
  // VAC-3: only a task with NO stored bound is derived
  ONE_BOUND_DERIVES: {...S, deriveWhen: task => ((task.startsAt ?? null) === null || (task.endsAt ?? null) === null) && lib.FLEXIBLE_KINDS.includes(task.kind)},
  // VAC-6 and SEM-4: the zone of the window is the task zone, else Belgrade, for WEEK as well; never the worker's
  WEEK_USES_THE_WORKER_ZONE: {...S, zoneFor: (task, w, kind) => (kind === 'WEEK_FLEXIBLE' ? (w?.zone ?? lib.BELGRADE) : S.zoneFor(task, w, kind))},
  WEEK_IGNORES_THE_TASK_ZONE: {...S, zoneFor: (task, w, kind) => (kind === 'WEEK_FLEXIBLE' ? lib.BELGRADE : S.zoneFor(task, w, kind))},
  ZONE_FALLBACK_IS_THE_WORKER_ZONE: {...S, zoneFor: (task, w) => (lib.validZone(task.taskZone) ? task.taskZone : (w?.zone ?? lib.BELGRADE))},
  TOMORROW_IGNORES_THE_TASK_ZONE: {...S, zoneFor: (task, w, kind) => (kind === 'TOMORROW_FLEXIBLE' ? lib.BELGRADE : S.zoneFor(task, w, kind))},
  // SEM-5: a task without published_at keeps the refusal (no rolling anchor)
  ROLLING_ANCHOR: {...S, refusesWithoutPublished: false},
  // SEM-1 / D2: the matcher counts the window-less task as future availability
  PAUSED_READS_THE_RAW_WINDOW: {...S, pausedCountsDerived: false},
  // the owner's definition: the remaining part of the local week, one local calendar day for tomorrow (23/25 hours on a DST change day)
  WEEK_IS_SEVEN_DAYS: {...S, week: (anchor, zone) => ({startMs: lib.localToMs(anchor, '00:00:00', zone), endMs: lib.localToMs(lib.addDays(anchor, 7), '00:00:00', zone)})},
  TOMORROW_IS_24_HOURS: {...S, tomorrow: (anchor, zone) => { const start = lib.localToMs(lib.addDays(anchor, 1), '00:00:00', zone); return {startMs: start, endMs: start + 24 * lib.HOUR}; }},
  WEEK_STARTS_ON_SUNDAY: {...S, week: (anchor, zone) => ({startMs: lib.localToMs(anchor, '00:00:00', zone), endMs: lib.localToMs(lib.addDays(anchor, 7 - lib.dow(anchor)), '00:00:00', zone)})},
  // round 3 / vacuity 1: the ANCHOR zone. Each is right for a Belgrade task with a default-zone worker, so only the New York / fallback families can kill it
  ANCHOR_IN_BELGRADE_FOR_EVERY_ZONE: {...S, anchorDay: ms => lib.localParts(ms, lib.BELGRADE).date},
  ANCHOR_IN_UTC_FOR_OTHER_ZONES: {...S, anchorDay: (ms, zone) => (zone === lib.BELGRADE ? lib.localParts(ms, zone).date : new Date(ms).toISOString().slice(0, 10))},
  ANCHOR_IN_THE_WORKER_ZONE: {...S, anchorDay: (ms, _zone, w) => lib.localParts(ms, w?.zone ?? lib.BELGRADE).date},
  ANCHOR_IN_UTC_FOR_THE_FALLBACK_ZONE: {...S, anchorDay: (ms, zone, _w, task) => (lib.validZone(task.taskZone) ? lib.localParts(ms, zone).date : new Date(ms).toISOString().slice(0, 10))},
  // round 3 / vacuity 5a: the part of the week still to come starts at now, not later
  CLIP_TO_NOW_PLUS_12H: {...S, clipStart: (startMs, nowMs) => Math.max(startMs, nowMs + 12 * lib.HOUR)},
  CLIP_TO_TOMORROW_MIDNIGHT: {...S, clipStart: (startMs, nowMs) => Math.max(startMs, lib.localToMs(lib.addDays(lib.localParts(nowMs, lib.BELGRADE).date, 1), '00:00:00', lib.BELGRADE))},
  // round 3 / vacuity 5b: the first and the last SECOND of the derived window, and the last minute of the day and of the week
  TOMORROW_END_2359: {...S, tomorrow: (anchor, zone) => ({startMs: S.tomorrow(anchor, zone).startMs, endMs: S.tomorrow(anchor, zone).endMs - lib.MINUTE})},
  WEEK_END_SUNDAY_2359: {...S, week: (anchor, zone) => ({startMs: S.week(anchor, zone).startMs, endMs: S.week(anchor, zone).endMs - lib.MINUTE})},
  TOMORROW_END_MINUS_1S: {...S, tomorrow: (anchor, zone) => ({startMs: S.tomorrow(anchor, zone).startMs, endMs: S.tomorrow(anchor, zone).endMs - 1000})},
  TOMORROW_START_PLUS_1S: {...S, tomorrow: (anchor, zone) => ({startMs: S.tomorrow(anchor, zone).startMs + 1000, endMs: S.tomorrow(anchor, zone).endMs})},
  WEEK_END_MINUS_1S: {...S, week: (anchor, zone) => ({startMs: S.week(anchor, zone).startMs, endMs: S.week(anchor, zone).endMs - 1000})},
  WEEK_START_PLUS_1S: {...S, week: (anchor, zone) => ({startMs: S.week(anchor, zone).startMs + 1000, endMs: S.week(anchor, zone).endMs})},
  // round 3 / vacuity 5c: the paused-code edit of the second function without a part of its condition (killed through the COMPLETE codes of the unchanged pairs)
  PAUSED_WITHOUT_THE_KIND_RESTRICTION: {...S, pausedWhen: task => (task.startsAt ?? null) === null && (task.endsAt ?? null) === null && (task.publishedAt ?? null) !== null},
  PAUSED_WITHOUT_THE_PUBLICATION_CONDITION: {...S, pausedWhen: task => (task.startsAt ?? null) === null && (task.endsAt ?? null) === null && lib.FLEXIBLE_KINDS.includes(task.kind)},
  PAUSED_ALSO_FOR_ONE_STORED_BOUND: {...S, pausedWhen: task => ((task.startsAt ?? null) === null || (task.endsAt ?? null) === null) && (task.publishedAt ?? null) !== null && lib.FLEXIBLE_KINDS.includes(task.kind)},
};
// ------------------------------------------------------------------ the oracle against the REAL helper functions of canonical DEV (read with SELECT on 2026-10-01, no write)
// Two real workers of DEV (a Monday-Friday 09-17 rule since 2026-09-16, live intent off; an every-day 16-23 rule since 2026-09-26, live intent on; both Europe/Belgrade, no windows).
const REAL_WORKERS = [
  {status: 'ACTIVE', availableNow: false, zone: 'Europe/Belgrade', windows: [], rules: [{weekdays: [1, 2, 3, 4, 5], startTime: '09:00:00', endTime: '17:00:00', startsOn: '2026-09-16', endsOn: null, active: true}]},
  {status: 'ACTIVE', availableNow: true, zone: 'Europe/Belgrade', windows: [], rules: [{weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '16:00:00', endTime: '23:00:00', startsOn: '2026-09-26', endsOn: null, active: true}]},
];
test('availablePeriods reproduces private.worker_available_periods as canonical DEV answered it for the two real rule sets (DST days of 23 and 25 hours, second edges, starts_on)', () => {
  const intervals = {1: ['2026-10-02T00:00:00Z', '2026-10-09T00:00:00Z'], 2: ['2026-10-24T20:00:00Z', '2026-10-26T01:00:00Z'], 3: ['2027-03-27T20:00:00Z', '2027-03-29T22:00:00Z'], 4: ['2026-10-05T10:00:00Z', '2026-10-05T11:00:00Z'],
    5: ['2026-10-05T14:59:59Z', '2026-10-05T15:00:01Z'], 6: ['2026-09-20T00:00:00Z', '2026-09-28T00:00:00Z'], 7: ['2026-10-05T05:00:00Z', '2026-10-05T20:30:00Z']};
  const parse = text => [...text.matchAll(/\["(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\+00","(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\+00"\)/g)].map(m => [Date.parse(m[1].replace(' ', 'T') + 'Z'), Date.parse(m[2].replace(' ', 'T') + 'Z')]);
  const real = {
    '1:1': '{["2026-10-02 07:00:00+00","2026-10-02 15:00:00+00"),["2026-10-05 07:00:00+00","2026-10-05 15:00:00+00"),["2026-10-06 07:00:00+00","2026-10-06 15:00:00+00"),["2026-10-07 07:00:00+00","2026-10-07 15:00:00+00"),["2026-10-08 07:00:00+00","2026-10-08 15:00:00+00")}',
    '1:2': '{}', '1:3': '{["2027-03-29 07:00:00+00","2027-03-29 15:00:00+00")}', '1:4': '{["2026-10-05 10:00:00+00","2026-10-05 11:00:00+00")}', '1:5': '{["2026-10-05 14:59:59+00","2026-10-05 15:00:00+00")}',
    '1:6': '{["2026-09-21 07:00:00+00","2026-09-21 15:00:00+00"),["2026-09-22 07:00:00+00","2026-09-22 15:00:00+00"),["2026-09-23 07:00:00+00","2026-09-23 15:00:00+00"),["2026-09-24 07:00:00+00","2026-09-24 15:00:00+00"),["2026-09-25 07:00:00+00","2026-09-25 15:00:00+00")}',
    '1:7': '{["2026-10-05 07:00:00+00","2026-10-05 15:00:00+00")}',
    '2:1': '{["2026-10-02 14:00:00+00","2026-10-02 21:00:00+00"),["2026-10-03 14:00:00+00","2026-10-03 21:00:00+00"),["2026-10-04 14:00:00+00","2026-10-04 21:00:00+00"),["2026-10-05 14:00:00+00","2026-10-05 21:00:00+00"),["2026-10-06 14:00:00+00","2026-10-06 21:00:00+00"),["2026-10-07 14:00:00+00","2026-10-07 21:00:00+00"),["2026-10-08 14:00:00+00","2026-10-08 21:00:00+00")}',
    '2:2': '{["2026-10-24 20:00:00+00","2026-10-24 21:00:00+00"),["2026-10-25 15:00:00+00","2026-10-25 22:00:00+00")}',
    '2:3': '{["2027-03-27 20:00:00+00","2027-03-27 22:00:00+00"),["2027-03-28 14:00:00+00","2027-03-28 21:00:00+00"),["2027-03-29 14:00:00+00","2027-03-29 21:00:00+00")}',
    '2:4': '{}', '2:5': '{["2026-10-05 14:59:59+00","2026-10-05 15:00:01+00")}', '2:6': '{["2026-09-26 14:00:00+00","2026-09-26 21:00:00+00"),["2026-09-27 14:00:00+00","2026-09-27 21:00:00+00")}',
    '2:7': '{["2026-10-05 14:00:00+00","2026-10-05 20:30:00+00")}',
  };
  assert.equal(Object.keys(real).length, 14);
  for (const [key, text] of Object.entries(real)) {
    const [workerNo, interval] = key.split(':'), [s, e] = intervals[interval].map(Date.parse);
    assert.deepEqual(lib.availablePeriods(REAL_WORKERS[Number(workerNo) - 1], s, e), parse(text), `worker ${workerNo} interval ${interval}`);
  }
});
test('the predecessor model reproduces private.worker_dispatch_time_admitted as canonical DEV answered it for 34 real (task, worker) pairs (FIXED, FLEXIBLE, TODAY, TOMORROW; one or no bound; the live path)', () => {
  // [kind, starts_at, ends_at, published_at, task_timezone, answer for worker 1, answer for worker 2] at 2026-10-01T20:40:56.946Z
  const rows = [
    ['TODAY_FLEXIBLE', null, null, '2026-09-20T01:52:02.005Z', 'Europe/Belgrade', false, true], ['FLEXIBLE', null, null, '2026-09-20T18:33:17.802Z', 'Europe/Belgrade', false, true],
    ['FIXED_WINDOW', '2026-09-24T08:00:00.000Z', '2026-09-24T10:00:00.000Z', '2026-09-24T07:34:40.999Z', 'Europe/Belgrade', false, false],
    ['FIXED_WINDOW', '2026-10-02T14:00:00.000Z', '2026-10-02T15:00:00.000Z', '2026-10-01T18:04:54.837Z', 'Europe/Belgrade', true, true],
    ['FLEXIBLE', null, '2026-09-27T21:59:59.000Z', '2026-09-25T20:33:05.921Z', 'Europe/Belgrade', false, false], ['TODAY_FLEXIBLE', null, null, null, 'Europe/Belgrade', false, true],
    ['FLEXIBLE', null, null, '2026-09-28T16:11:50.252Z', 'Europe/Belgrade', false, true], ['FLEXIBLE', null, null, '2026-08-30T17:07:09.237Z', null, false, true],
    ['FLEXIBLE', null, '2026-10-31T22:59:59.000Z', '2026-09-24T05:38:34.486Z', 'Europe/Belgrade', false, true], ['FLEXIBLE', null, '2026-12-31T22:59:59.000Z', '2026-09-20T01:12:26.269Z', 'Europe/Belgrade', false, true],
    ['TODAY_FLEXIBLE', '2026-09-25T16:00:00.000Z', null, '2026-09-25T14:45:41.675Z', 'Europe/Belgrade', false, true], ['TODAY_FLEXIBLE', null, null, '2026-09-30T06:19:52.312Z', 'Europe/Belgrade', false, true],
    ['TOMORROW_FLEXIBLE', null, null, '2026-09-23T09:01:04.207Z', 'Europe/Belgrade', false, false], ['TOMORROW_FLEXIBLE', null, null, '2026-09-28T17:52:15.729Z', 'Europe/Belgrade', false, false],
    ['TOMORROW_FLEXIBLE', null, null, '2026-09-20T05:46:34.980Z', 'Europe/Belgrade', false, false], ['FIXED_WINDOW', '2026-09-26T13:00:00.000Z', '2026-09-26T15:00:00.000Z', '2026-09-25T13:26:06.596Z', 'Europe/Belgrade', false, false],
    ['FLEXIBLE', null, '2026-09-30T21:59:59.000Z', '2026-09-27T20:57:03.851Z', 'Europe/Belgrade', false, false],
  ];
  const now = at('2026-10-01T20:40:56.946Z');
  let compared = 0;
  for (const [kind, s, e, pub, zone, ...answers] of rows) {
    const task = {kind, startsAt: s ? at(s) : null, endsAt: e ? at(e) : null, publishedAt: pub ? at(pub) : null, taskZone: zone};
    answers.forEach((answer, i) => { compared++; assert.equal(lib.admittedOracle({task, worker: REAL_WORKERS[i], nowMs: now, derive: false}), answer, `${kind} ${s} ${e} worker ${i + 1}`); });
  }
  assert.equal(compared, 34);
  // the live DEV fact behind F1: every window-less TOMORROW_FLEXIBLE task is refused for both real workers, the live-on one included
  for (const index of [12, 13, 14]) assert.deepEqual([rows[index][0], rows[index][5], rows[index][6]], ['TOMORROW_FLEXIBLE', false, false]);
});
test('the candidate semantics reproduces what the real helper functions of DEV compute for the derived window (the SELECT replays the new expressions with the real availability_is_future and worker_available_periods): 38 pairs', () => {
  // [kind, published_at, task zone, answer for worker 1, answer for worker 2] at 2026-10-01T20:41:57.391Z (1 = admitted)
  const tasks = [['TOMORROW_FLEXIBLE', '2026-10-01T20:40:00Z', 'Europe/Belgrade', 1, 1], ['WEEK_FLEXIBLE', '2026-10-01T20:40:00Z', 'Europe/Belgrade', 1, 1], ['WEEK_FLEXIBLE', '2026-10-03T10:00:00Z', 'Europe/Belgrade', 0, 1],
    ['WEEK_FLEXIBLE', '2026-10-04T10:00:00Z', 'Europe/Belgrade', 0, 1], ['TOMORROW_FLEXIBLE', '2026-10-01T21:30:00Z', 'Europe/Belgrade', 1, 1], ['TOMORROW_FLEXIBLE', '2026-10-02T22:30:00Z', 'Europe/Belgrade', 0, 1],
    ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', 'Europe/Belgrade', 0, 1], ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', null, 0, 1], ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', 'Nope/Zone', 0, 1],
    ['TOMORROW_FLEXIBLE', '2026-10-01T22:30:00Z', 'America/New_York', 1, 1], ['WEEK_FLEXIBLE', '2026-10-07T08:00:00Z', 'Europe/Belgrade', 1, 1], ['WEEK_FLEXIBLE', '2026-10-07T08:00:00Z', 'America/New_York', 1, 1],
    ['WEEK_FLEXIBLE', '2026-10-24T12:00:00Z', 'Europe/Belgrade', 0, 1], ['TOMORROW_FLEXIBLE', '2026-10-24T12:00:00Z', 'Europe/Belgrade', 0, 1], ['TOMORROW_FLEXIBLE', '2026-09-23T09:01:04Z', 'Europe/Belgrade', 0, 0],
    ['WEEK_FLEXIBLE', '2026-09-23T09:01:04Z', 'Europe/Belgrade', 0, 0], ['TOMORROW_FLEXIBLE', '2026-10-01T10:00:00Z', 'Europe/Belgrade', 1, 1], ['WEEK_FLEXIBLE', '2026-09-28T10:00:00Z', 'Europe/Belgrade', 1, 1],
    ['WEEK_FLEXIBLE', '2026-09-27T10:00:00Z', 'Europe/Belgrade', 0, 0]];
  const now = at('2026-10-01T20:41:57.391Z');
  let compared = 0;
  for (const [kind, pub, zone, ...answers] of tasks) {
    const task = {kind, startsAt: null, endsAt: null, publishedAt: at(pub), taskZone: zone};
    answers.forEach((answer, i) => { compared++; assert.equal(lib.admittedOracle({task, worker: REAL_WORKERS[i], nowMs: now, derive: true}), Boolean(answer), `${kind} ${pub} ${zone} worker ${i + 1}`); });
  }
  assert.equal(compared, 38);
  // among them the case that tells the local day from the UTC date: Thursday 22:30Z is already Friday in Belgrade, tomorrow is Saturday (no weekday rule for worker 1); a UTC-date anchor says Friday
  const late = {kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: at('2026-10-01T22:30:00Z'), taskZone: lib.BELGRADE};
  assert.equal(lib.admittedOracle({task: late, worker: REAL_WORKERS[0], nowMs: now}), false);
  assert.equal(lib.admittedOracle({task: late, worker: REAL_WORKERS[0], nowMs: now, semantics: MUTANTS.UTC_ANCHOR}), true, 'the UTC-date mutant answers differently on the real worker');
});

test('the baseline: the candidate semantics violates no expectation of the matrix or of the clock family at any of the clocks', () => {
  for (const clock of CLOCKS) assert.deepEqual(violations(S, at(clock)), [], clock);
  for (const now of DAY_CLOCKS) assert.deepEqual(violations(S, now), [], lib.iso(now));
});
test('VAC-1 mutation: an anchor taken from the UTC date (or a fixed offset) is killed by the late-publication family at every clock', () => {
  for (const name of ['UTC_ANCHOR', 'FIXED_WINTER_OFFSET_ANCHOR']) {
    for (const clock of CLOCKS) {
      const found = violations(MUTANTS[name], at(clock));
      assert.ok(found.length > 0, `${name} survives at ${clock}`);
      assert.ok(found.some(item => /^(F_late|F_cest|G_late|G_cest)\//.test(item)), `${name} at ${clock}: the late-publication cases are what kills it: ${found.slice(0, 4)}`);
    }
  }
  // the old matrix (every anchor at 10:00Z) could not tell: replay the UTC-date mutant on the 10:00Z cases only
  for (const clock of CLOCKS) assert.deepEqual(violations(MUTANTS.UTC_ANCHOR, at(clock)).filter(item => !/^(F_|G_|N_|M_)/.test(item)), [], 'the first author matrix (10:00Z anchors) survives this mutant: the family is new');
});
test('round 3 / vacuity 1: the ANCHOR zone for a task zone that is not Belgrade (New York, none, invalid) is pinned: a Belgrade, UTC or worker-zone anchor is killed at every clock, and only by the new families', () => {
  for (const name of ['ANCHOR_IN_BELGRADE_FOR_EVERY_ZONE', 'ANCHOR_IN_UTC_FOR_OTHER_ZONES', 'ANCHOR_IN_UTC_FOR_THE_FALLBACK_ZONE', 'ANCHOR_IN_THE_WORKER_ZONE']) {
    for (const clock of [...CLOCKS, ...DAYS14.map(lib.iso)]) {
      const found = violations(MUTANTS[name], at(clock));
      assert.ok(found.length > 0, `${name} survives at ${clock}`);
      assert.ok(found.every(item => /^(N_|M_)/.test(item)), `${name} at ${clock}: the cases that existed before cannot tell, the N_ and M_ families are what kills it: ${found.filter(item => !/^(N_|M_)/.test(item))}`);
    }
  }
  // each family kills what it is for: the New York task (a Belgrade, UTC or worker-zone anchor), the Belgrade task with a New York worker (a worker-zone anchor), the fallback zones
  const kills = name => new Set(violations(MUTANTS[name], at(CLOCKS[0])).map(item => item.split('/')[0]));
  assert.ok(kills('ANCHOR_IN_BELGRADE_FOR_EVERY_ZONE').has('N_ny') && kills('ANCHOR_IN_BELGRADE_FOR_EVERY_ZONE').has('M_ny'));
  assert.ok(kills('ANCHOR_IN_UTC_FOR_OTHER_ZONES').has('N_ny') && kills('ANCHOR_IN_UTC_FOR_OTHER_ZONES').has('M_ny'));
  assert.ok(kills('ANCHOR_IN_UTC_FOR_THE_FALLBACK_ZONE').has('N_null') && kills('ANCHOR_IN_UTC_FOR_THE_FALLBACK_ZONE').has('N_bad') && kills('ANCHOR_IN_UTC_FOR_THE_FALLBACK_ZONE').has('M_null') && kills('ANCHOR_IN_UTC_FOR_THE_FALLBACK_ZONE').has('M_bad'));
  assert.ok(kills('ANCHOR_IN_THE_WORKER_ZONE').has('N_bel') && kills('ANCHOR_IN_THE_WORKER_ZONE').has('N_null') && kills('ANCHOR_IN_THE_WORKER_ZONE').has('M_bel'));
});
test('VAC-2 mutation: dropping the clip of the start to now (the remaining part of the week) is killed by the stale-availability case at every clock', () => {
  for (const clock of [...CLOCKS.map(at), ...DAY_CLOCKS]) {
    const found = violations(MUTANTS.NO_CLIP, clock);
    assert.ok(found.includes('H_week/h_stale admitted'), `NO_CLIP survives at ${lib.iso(clock)}: ${found}`);
  }
  const now = at('2026-10-01T12:00:00Z'), family = lib.buildClockFamily(now);
  assert.equal(family.workers.h_late.windows[0].startsAt > now, true, 'the twin window is still to come');
  assert.equal(family.workers.h_stale.windows[0].endsAt < now, true, 'the stale window is over');
  assert.equal(lib.admittedOracle({task: family.tasks.H_week, worker: family.workers.h_late, nowMs: now}), true);
  assert.equal(lib.admittedOracle({task: family.tasks.H_week, worker: family.workers.h_stale, nowMs: now}), false);
  assert.throws(() => lib.buildClockFamily(at('2026-10-01T22:00:30Z')), /CLOCK_TOO_CLOSE_AFTER_MIDNIGHT/, 'the family refuses a clock too close after the local midnight (the proof waits first)');
  assert.throws(() => lib.buildClockFamily(at('2026-10-01T21:55:00Z')), /CLOCK_TOO_CLOSE_BEFORE_MIDNIGHT/, 'and one too close before it (the all-day rule of today would end under the read)');
  assert.equal(lib.buildClockFamily(at('2026-10-04T21:00:00Z')).anchors.lateTwin, 'OMITTED_LAST_HOURS_OF_THE_WEEK', 'the last-hour twin is omitted (and said so) when the week has no hours left');
  assert.equal(lib.buildClockFamily(at('2026-10-01T21:15:00Z')).anchors.windowTwin, 'OMITTED_LAST_HOUR_OF_THE_DAY', 'the 20-40 minute twin is omitted (and said so) in the last hour of the local day');
  assert.equal(lib.buildClockFamily(now).anchors.windowTwin, 'INCLUDED');
});
test('round 3 / vacuity 5a: the REST OF TODAY is part of the remaining week: a start clipped to now plus twelve hours or to tomorrow midnight is killed at every clock of the day', () => {
  for (const name of ['CLIP_TO_NOW_PLUS_12H', 'CLIP_TO_TOMORROW_MIDNIGHT']) {
    for (const now of [...CLOCKS.map(at), ...DAY_CLOCKS]) {
      const found = violations(MUTANTS[name], now);
      assert.ok(found.some(item => /^H_week\/h_today_(rule|off|win) admitted/.test(item)), `${name} survives at ${lib.iso(now)}: ${found}`);
    }
  }
  // the 20-40 minute window is what kills the twelve-hour clip in the morning and afternoon (the all-day rule still has its evening left); at night the all-day rule alone kills it
  assert.ok(violations(MUTANTS.CLIP_TO_NOW_PLUS_12H, lib.localToMs('2026-10-03', '08:00:00', lib.BELGRADE)).includes('H_week/h_today_win admitted'));
  assert.ok(!violations(MUTANTS.CLIP_TO_NOW_PLUS_12H, lib.localToMs('2026-10-03', '08:00:00', lib.BELGRADE)).includes('H_week/h_today_rule admitted'), 'the all-day rule alone cannot tell at 08:00 (its evening survives a 12 hour clip)');
  assert.ok(violations(MUTANTS.CLIP_TO_NOW_PLUS_12H, lib.localToMs('2026-10-03', '21:45:00', lib.BELGRADE)).includes('H_week/h_today_rule admitted'));
  // the fixture of the family really is "the rest of today": its rule is today's weekday, all day, and it is the only availability of the worker
  const now = lib.localToMs('2026-10-03', '10:30:00', lib.BELGRADE), family = lib.buildClockFamily(now);
  assert.deepEqual(family.workers.h_today_rule.rules.map(r => [r.weekdays, r.startTime, r.endTime]), [[[6], '00:00:00', '23:59:00']]);
  assert.deepEqual(family.workers.h_today_rule.windows, []);
  assert.deepEqual(family.workers.h_today_off.availableNow, false);
});
test('round 3 / vacuity 5b: the first and the last SECOND of the derived window, the last minute of the day and of the week are pinned (1 second of overlap, 30 minutes of overlap cannot tell)', () => {
  for (const name of ['TOMORROW_END_2359', 'WEEK_END_SUNDAY_2359', 'TOMORROW_END_MINUS_1S', 'WEEK_END_MINUS_1S']) {
    for (const clock of [...CLOCKS, ...DAYS14.map(lib.iso)]) {
      const found = violations(MUTANTS[name], at(clock));
      assert.ok(found.some(item => /:hi_in1 admitted/.test(item)), `${name} survives at ${clock}: ${found}`);
      assert.ok(!found.some(item => /:(lo|hi)_in admitted/.test(item)), `${name} at ${clock}: the 30-minute entries could not tell, the 1-second entries are what kills it`);
    }
  }
  for (const name of ['TOMORROW_START_PLUS_1S', 'WEEK_START_PLUS_1S']) {
    for (const clock of [...CLOCKS, ...DAYS14.map(lib.iso)]) {
      const found = violations(MUTANTS[name], at(clock));
      assert.ok(found.some(item => /:lo_in1 admitted/.test(item)), `${name} survives at ${clock}: ${found}`);
      assert.ok(!found.some(item => /:(lo|hi)_in admitted/.test(item)), `${name} at ${clock}: the 30-minute entries could not tell`);
    }
  }
  // a TOMORROW mutant is killed by a TOMORROW task and a WEEK mutant by a WEEK task (so both kinds are pinned, not one of them)
  assert.ok(violations(MUTANTS.TOMORROW_END_2359, at(CLOCKS[0])).every(item => /^D_(spring|fall)\//.test(item)));
  assert.ok(violations(MUTANTS.WEEK_END_SUNDAY_2359, at(CLOCKS[0])).every(item => /^D_w(spring|fall)\//.test(item)));
});
test('round 3 / vacuity 5c: the paused-code edit without a part of its condition is killed through the complete codes of the unchanged pairs and the B_null case', () => {
  for (const name of ['PAUSED_WITHOUT_THE_KIND_RESTRICTION', 'PAUSED_WITHOUT_THE_PUBLICATION_CONDITION', 'PAUSED_ALSO_FOR_ONE_STORED_BOUND']) {
    for (const clock of CLOCKS) {
      const found = violations(MUTANTS[name], at(clock));
      assert.ok(found.length > 0, `${name} survives at ${clock}`);
      assert.ok(found.every(item => /codes$/.test(item)), `${name} at ${clock}: only the codes move, never the gate: ${found}`);
    }
  }
  assert.ok(violations(MUTANTS.PAUSED_WITHOUT_THE_KIND_RESTRICTION, at(CLOCKS[0])).some(item => /^E_(flex|today|remote)_none\/.* unchanged codes$/.test(item)), 'killed by an unchanged pair (another kind, no window, live intent off)');
  assert.ok(violations(MUTANTS.PAUSED_WITHOUT_THE_PUBLICATION_CONDITION, at(CLOCKS[0])).some(item => item.startsWith('B_null/')), 'killed by the task without published_at');
  assert.ok(violations(MUTANTS.PAUSED_ALSO_FOR_ONE_STORED_BOUND, at(CLOCKS[0])).some(item => /^E_(tomorrow_start|week_end)\//.test(item)), 'killed by the one-bound controls');
});
test('VAC-3 mutation: deriving a window when EITHER endpoint is missing is killed on every one of 14 consecutive run days; the old table survived on some of them', () => {
  const surviving = [];
  for (const nowMs of DAYS14) {
    assert.ok(violations(MUTANTS.ONE_BOUND_DERIVES, nowMs).length > 0, 'killed on ' + lib.iso(nowMs));
    if (violations(MUTANTS.ONE_BOUND_DERIVES, nowMs, {skipWorkers: ['e_all_on', 'e_all_off']}).length === 0) surviving.push(lib.iso(nowMs).slice(0, 10));
  }
  assert.ok(surviving.length >= 1, 'without the all-days workers the control passes by calendar chance on some days: ' + surviving.length + ' of 14');
  const plan = lib.buildMatrix(DAYS14[0]);
  for (const key of ['E_tomorrow_start', 'E_week_end']) for (const worker of ['e_all_on', 'e_all_off']) assert.equal(plan.unchanged.find(item => item.id === `${key}/${worker}`).admitted, false);
  for (const key of ['E_flex_none', 'E_today_none', 'E_remote_none']) assert.equal(plan.unchanged.find(item => item.id === `${key}/e_all_on`).admitted, true);
});
test('VAC-6 / SEM-4 mutation: the zone of the WEEK window, the zone fallback and the TOMORROW zone are pinned; every wrong zone is killed at every clock', () => {
  for (const name of ['WEEK_USES_THE_WORKER_ZONE', 'WEEK_IGNORES_THE_TASK_ZONE', 'ZONE_FALLBACK_IS_THE_WORKER_ZONE', 'TOMORROW_IGNORES_THE_TASK_ZONE']) {
    for (const clock of CLOCKS) assert.ok(violations(MUTANTS[name], at(clock)).length > 0, `${name} survives at ${clock}`);
  }
  // each WEEK mutant is killed by the WEEK zone cases specifically (not only by the TOMORROW ones)
  for (const name of ['WEEK_USES_THE_WORKER_ZONE', 'WEEK_IGNORES_THE_TASK_ZONE']) assert.ok(violations(MUTANTS[name], at(CLOCKS[0])).some(item => /^C_(ny|null|bad|wed)\//.test(item)), name);
  assert.ok(violations(MUTANTS.ZONE_FALLBACK_IS_THE_WORKER_ZONE, at(CLOCKS[0])).some(item => /^(A_null|A_bad|C_null|C_bad)\//.test(item)));
});
test('SEM-5 / SEM-1 / the owner definition: a rolling anchor, a paused code that reads the raw window, a seven-day week and a 24-hour day are all killed', () => {
  for (const name of ['ROLLING_ANCHOR', 'PAUSED_READS_THE_RAW_WINDOW', 'WEEK_IS_SEVEN_DAYS', 'TOMORROW_IS_24_HOURS', 'WEEK_STARTS_ON_SUNDAY']) {
    for (const clock of CLOCKS) assert.ok(violations(MUTANTS[name], at(clock)).length > 0, `${name} survives at ${clock}`);
  }
  assert.ok(violations(MUTANTS.ROLLING_ANCHOR, at(CLOCKS[0])).some(item => item.startsWith('B_null/')));
  assert.ok(violations(MUTANTS.PAUSED_READS_THE_RAW_WINDOW, at(CLOCKS[0])).some(item => item.startsWith('A/off_thu')));
  assert.ok(violations(MUTANTS.WEEK_IS_SEVEN_DAYS, at(CLOCKS[0])).some(item => item.startsWith('C_')), 'the owner definition (the remaining part of the local week) is pinned against the lifecycle seven days (SEM-2, rejected)');
  assert.ok(violations(MUTANTS.TOMORROW_IS_24_HOURS, at(CLOCKS[0])).some(item => item.startsWith('D_')));
});

// ------------------------------------------------------------------ the corpus diff rule
const outcome = (id, workers, wave = {status: 'SENT', inserted: 1}, rounds = [{round_no: 1, status: 'SENT', stop_reason: null}]) => ({id, refused: false, wave, rounds, workers});
const w = (overrides = {}) => ({hardBlockers: [], dispatchBlockers: [], dispatchEligible: true, delivery: true, event: true, score: 80, ...overrides});
const entryOf = (id, workers, wave, rounds) => ({id, status: 'PASS', wave, rounds, workers: workers.map(([label, observed]) => ({label, observed}))});
const noneDeclared = (blockers, score = 55) => w({dispatchEligible: false, delivery: false, event: false, dispatchBlockers: blockers, score});
function beforeAfter() {
  const stopped = {status: 'STOPPED', inserted: 0}, stoppedRounds = [{round_no: 1, status: 'STOPPED', stop_reason: 'NO_ELIGIBLE_CANDIDATES'}];
  const before = {
    'T-001': outcome('T-001', {fits: w(), 'does-not-fit': w({dispatchEligible: false, delivery: false, event: false, dispatchBlockers: ['OUTSIDE_PREFERRED_RADIUS']})}),
    'T-003': outcome('T-003', {fits: w({dispatchEligible: false, delivery: false, event: false, dispatchBlockers: ['OUTSIDE_AVAILABILITY'], score: 70}),
      'does-not-fit': noneDeclared(['OUTSIDE_AVAILABILITY', 'OUTSIDE_PREFERRED_RADIUS']), 'unknown-capability': noneDeclared(['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY'])}, stopped, stoppedRounds),
    'T-006': outcome('T-006', {fits: w({dispatchEligible: false, delivery: false, event: false, dispatchBlockers: ['OUTSIDE_AVAILABILITY'], score: 70}),
      'does-not-fit': noneDeclared(['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY']), 'unknown-capability': noneDeclared(['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY'])}, stopped, stoppedRounds),
  };
  const after = JSON.parse(JSON.stringify(before)), sent = {status: 'SENT', inserted: 1}, sentRounds = [{round_no: 1, status: 'SENT', stop_reason: null}];
  after['T-003'].workers.fits = w({score: 95}); after['T-003'].workers['does-not-fit'] = noneDeclared(['OUTSIDE_PREFERRED_RADIUS'], 80); after['T-003'].workers['unknown-capability'] = noneDeclared(['OUTSIDE_AVAILABILITY']);
  after['T-003'].wave = {...sent}; after['T-003'].rounds = JSON.parse(JSON.stringify(sentRounds));
  after['T-006'].workers.fits = w({score: 95}); after['T-006'].workers['does-not-fit'] = noneDeclared(['OUTSIDE_AVAILABILITY']); after['T-006'].workers['unknown-capability'] = noneDeclared(['OUTSIDE_AVAILABILITY']);
  after['T-006'].wave = {...sent}; after['T-006'].rounds = JSON.parse(JSON.stringify(sentRounds));
  return {before, after};
}
test('the intended flips are exactly the differences between a before and an after pass', () => {
  const {before, after} = beforeAfter();
  const result = lib.checkFlips(lib.diffOutcomes(before, after), lib.INTENDED_FLIPS);
  assert.deepEqual(result.unintended, []);
  assert.deepEqual(result.missing, []);
  assert.equal(result.matched.length, lib.INTENDED_FLIPS.length);
  assert.equal(lib.INTENDED_FLIPS.length, 21, 'eight entries per FITS worker case, two for the does-not-fit worker of T-003, one per NONE_DECLARED worker (3)');
});
test('an unintended flip, a missing flip, a wrong score and a NONE_DECLARED worker that loses another blocker are all reported', () => {
  const {before, after} = beforeAfter();
  after['T-001'].workers['does-not-fit'].dispatchBlockers = [];
  after['T-001'].workers['does-not-fit'].dispatchEligible = true;
  let result = lib.checkFlips(lib.diffOutcomes(before, after), lib.INTENDED_FLIPS);
  assert.ok(result.unintended.some(diff => diff.caseId === 'T-001' && diff.field === 'dispatchEligible'));
  const {before: b2, after: a2} = beforeAfter();
  a2['T-006'].workers.fits = JSON.parse(JSON.stringify(b2['T-006'].workers.fits));
  a2['T-006'].wave = {...b2['T-006'].wave}; a2['T-006'].rounds = JSON.parse(JSON.stringify(b2['T-006'].rounds));
  result = lib.checkFlips(lib.diffOutcomes(b2, a2), lib.INTENDED_FLIPS);
  assert.ok(result.missing.some(item => item.caseId === 'T-006' && item.field === 'dispatchEligible'));
  const {before: b3, after: a3} = beforeAfter();
  a3['T-003'].workers.fits.score = 99;
  result = lib.checkFlips(lib.diffOutcomes(b3, a3), lib.INTENDED_FLIPS);
  assert.ok(result.unintended.some(diff => diff.caseId === 'T-003' && diff.worker === 'fits' && diff.field === 'score'));
  assert.ok(result.missing.some(item => item.caseId === 'T-003' && item.worker === 'fits' && item.field === 'score'));
  // a NONE_DECLARED worker must keep every other blocker: losing OUTSIDE_AVAILABILITY as well (an "everyone eligible" drift) is unintended
  const {before: b4, after: a4} = beforeAfter();
  a4['T-006'].workers['unknown-capability'].dispatchBlockers = [];
  result = lib.checkFlips(lib.diffOutcomes(b4, a4), lib.INTENDED_FLIPS);
  assert.ok(result.unintended.some(diff => diff.caseId === 'T-006' && diff.worker === 'unknown-capability'));
  assert.ok(result.missing.some(item => item.caseId === 'T-006' && item.worker === 'unknown-capability'));
});
test('two identical passes have no difference; a missing case or worker is a difference', () => {
  const {before} = beforeAfter();
  assert.deepEqual(lib.diffOutcomes(before, JSON.parse(JSON.stringify(before))), []);
  const trimmed = JSON.parse(JSON.stringify(before)); delete trimmed['T-006']; delete trimmed['T-001'].workers.fits;
  const diffs = lib.diffOutcomes(before, trimmed);
  assert.ok(diffs.some(diff => diff.caseId === 'T-006' && diff.field === 'PRESENT'));
  assert.ok(diffs.some(diff => diff.caseId === 'T-001' && diff.worker === 'fits' && diff.field === 'PRESENT'));
});
test('outcomeOf reads the observed answer of a runner entry', () => {
  const entry = entryOf('T-003', [['fits', {hardBlockers: [], dispatchBlockers: ['B', 'A'], dispatchEligible: false, delivery: false, event: false, score: 70.1}]], {status: 'STOPPED', inserted: 0}, [{round_no: 1, status: 'STOPPED', stop_reason: 'NO_ELIGIBLE_CANDIDATES', batch_size: 5}]);
  assert.deepEqual(lib.outcomeOf(entry), {id: 'T-003', refused: false, wave: {status: 'STOPPED', inserted: 0}, rounds: [{round_no: 1, status: 'STOPPED', stop_reason: 'NO_ELIGIBLE_CANDIDATES'}],
    workers: {fits: {hardBlockers: [], dispatchBlockers: ['A', 'B'], dispatchEligible: false, delivery: false, event: false, score: 70.1}}});
  assert.equal(lib.outcomeOf({...entry, status: 'PRODUCT_PATH_REFUSED'}).refused, true);
});
test('the intended flips of the corpus follow the corpus expectations (T-003 / T-006 FITS eligible; the other workers keep their other blockers) and name exactly the findings they close', () => {
  const corpus = JSON.parse(read('supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json'));
  for (const id of ['T-003', 'T-006']) {
    const item = corpus.cases.find(entry => entry.id === id), byShape = Object.fromEntries(item.referenceWorkers.map(worker => [worker.shape, worker.expect]));
    assert.equal(byShape.FITS.dispatchEligible, true); assert.deepEqual(byShape.FITS.dispatchBlockers, []);
    assert.equal(byShape.UNKNOWN_CAPABILITY.dispatchEligible, false); assert.deepEqual(byShape.UNKNOWN_CAPABILITY.dispatchBlockers, ['OUTSIDE_AVAILABILITY']);
  }
  const t3 = corpus.cases.find(entry => entry.id === 'T-003').referenceWorkers.find(worker => worker.shape === 'DOES_NOT_FIT').expect;
  assert.deepEqual(t3.dispatchBlockers, ['OUTSIDE_PREFERRED_RADIUS'], 'T-003 DOES_NOT_FIT: only the radius remains');
  assert.deepEqual(lib.FINDINGS_CLOSED.length, 8);
  assert.deepEqual(Object.keys(lib.CORPUS_DETAIL_EXPECTATIONS).sort(), ['T-003|does-not-fit', 'T-003|fits', 'T-003|unknown-capability', 'T-006|does-not-fit', 'T-006|fits', 'T-006|unknown-capability']);
  // the vanilla (unmodified S03) fixture changes only the paused code of the NONE_DECLARED workers: three entries
  assert.equal(lib.VANILLA_INTENDED_FLIPS.length, 3);
});

// ------------------------------------------------------------------ VAC-4: the guards against a vacuous corpus pass
const realCorpusText = read('supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json');
const goodIds = ['T-001', 'T-002', 'T-003', 'T-004', 'T-005', 'T-006', 'T-007', 'T-008', 'T-009', 'T-010', 'T-011', 'T-012', 'T-013', 'T-014', 'T-015', 'T-022', 'T-023', 'T-024', 'T-025', 'T-026', 'T-027', 'T-028', 'T-029',
  'T-030', 'T-031', 'T-032', 'T-036', 'T-037', 'T-038', 'T-041', 'T-042', 'T-043', 'T-044', 'T-046', 'T-047', 'T-048', 'T-050'];
const fullOutcomes = () => Object.fromEntries(goodIds.map(id => [id, outcome(id, {fits: w()})]));
const fullSummary = () => ({statuses: {PASS: 30, FINDING: 3, POSITIVE_ONLY: 3, SHAPE_DEGRADED: 1}});
test('VAC-4: the pinned corpus (file sha256, 37 buildable cases, the id list) is exactly the one in the repository', () => {
  assert.equal(goodIds.length, 37);
  assert.deepEqual(lib.corpusPinProblems({path: lib.CORPUS_PIN.path, text: realCorpusText, ids: goodIds}), []);
  assert.equal(lib.corpusTextSha256(realCorpusText.replace(/\n/g, '\r\n')), lib.CORPUS_PIN.sha256, 'a CRLF checkout does not change the pin');
  assert.equal(lib.CORPUS_PIN.sha256.slice(0, 16), '00f43182f3b9923f', 'the sha256 the S03 report records');
});
test('VAC-4 mutation: a smaller or different corpus, another path or a corpus file that changed fails the pin; a pass that covered fewer cases or refused cases fails the coverage', () => {
  assert.ok(lib.corpusPinProblems({path: 'other.json', text: realCorpusText, ids: goodIds}).some(item => item.startsWith('CORPUS_PATH')));
  assert.ok(lib.corpusPinProblems({path: lib.CORPUS_PIN.path, text: realCorpusText + ' ', ids: goodIds}).some(item => item.startsWith('CORPUS_SHA256')));
  assert.ok(lib.corpusPinProblems({path: lib.CORPUS_PIN.path, text: realCorpusText, ids: goodIds.slice(1)}).some(item => item.startsWith('CORPUS_BUILDABLE_CASES')));
  assert.ok(lib.corpusPinProblems({path: lib.CORPUS_PIN.path, text: realCorpusText, ids: [...goodIds.slice(1), 'T-099']}).some(item => item.startsWith('CORPUS_ID_LIST')));
  assert.deepEqual(lib.corpusCoverageProblems({outcomes: fullOutcomes(), summary: fullSummary(), expectedCases: 37}), []);
  const smaller = fullOutcomes(); delete smaller['T-050'];
  assert.ok(lib.corpusCoverageProblems({outcomes: smaller, summary: {statuses: {PASS: 36}}, expectedCases: 37}).some(item => item.startsWith('CASES_COVERED')));
  const refused = fullOutcomes(); refused['T-010'].refused = true;
  assert.ok(lib.corpusCoverageProblems({outcomes: refused, summary: {statuses: {PASS: 36, PRODUCT_PATH_REFUSED: 1}}, expectedCases: 37}).some(item => item.startsWith('PRODUCT_PATH_REFUSED')));
  for (const status of ['PRODUCT_PATH_REFUSED', 'UNASSERTED', 'HARNESS_ERROR', 'RUN']) {
    assert.ok(lib.corpusCoverageProblems({outcomes: fullOutcomes(), summary: {statuses: {PASS: 36, [status]: 1}}, expectedCases: 37}).some(item => item.startsWith('STATUS ' + status)), status);
  }
  assert.ok(lib.corpusCoverageProblems({outcomes: fullOutcomes(), summary: {statuses: {PASS: 30}}, expectedCases: 37}).some(item => item.startsWith('STATUS_TOTAL')));
});
test('VAC-4: a case refused by the product path in BOTH passes compares as identical (the vacuity); only the coverage guard sees it', () => {
  const before = fullOutcomes(), after = fullOutcomes();
  for (const outcomes of [before, after]) outcomes['T-003'] = {id: 'T-003', refused: true, wave: null, rounds: [], workers: {}};
  const flips = lib.checkFlips(lib.diffOutcomes(before, after), []);
  assert.deepEqual([flips.unintended, flips.missing], [[], []], 'identical refusals are no difference');
  assert.ok(lib.corpusCoverageProblems({outcomes: before, summary: {statuses: {PASS: 36, PRODUCT_PATH_REFUSED: 1}}, expectedCases: 37}).length > 0);
});

// ------------------------------------------------------------------ VAC-5: the exact adjusted-worker list
test('VAC-5: the adjusted-worker list is exact; an extra, a missing or a NONE_DECLARED worker is refused; an unmodified pass adjusts nobody', () => {
  const good = lib.EXPECTED_ADJUSTED_WORKERS.map(([caseId, worker]) => ({caseId, worker}));
  assert.equal(good.length, 5);
  assert.deepEqual(lib.adjustedProblems(good, {augment: true}), []);
  assert.deepEqual(lib.adjustedProblems([...good].reverse(), {augment: true}), [], 'the order does not matter');
  assert.ok(lib.adjustedProblems([...good, {caseId: 'T-003', worker: 'unknown-capability-T-003'}], {augment: true}).length > 0, 'a NONE_DECLARED worker adjusted');
  assert.ok(lib.adjustedProblems([...good, {caseId: 'T-007', worker: 'fits-T-007'}], {augment: true}).length > 0, 'a worker of another case adjusted');
  assert.ok(lib.adjustedProblems(good.slice(1), {augment: true}).length > 0, 'a missing adjustment');
  assert.ok(lib.adjustedProblems(good, {augment: false}).length > 0, 'an unmodified pass adjusts nobody');
  assert.deepEqual(lib.adjustedProblems([], {augment: false}), []);
  assert.deepEqual(lib.adjustedProblems(good.filter(item => item.caseId === 'T-003'), {augment: true, caseIds: ['T-003']}), [], 'a pass of one case is checked against that case only');
  // no corpus worker of shape NONE_DECLARED or AVAILABLE_NOW_ONLY is among the expected ones: the shapes are read from the corpus itself
  const corpus = JSON.parse(realCorpusText), flexible = corpus.cases.filter(item => goodIds.includes(item.id) && lib.FLEXIBLE_KINDS.includes(item.expected.facts['need.schedule_kind']));
  const wanted = [];
  for (const item of flexible) {
    for (const worker of item.referenceWorkers ?? []) if (['AVAILABLE_NOW_AND_SCHEDULED', 'SCHEDULED_ONLY'].includes(worker.profile.availability)) wanted.push(`${item.id}|${worker.shape}`);
  }
  assert.deepEqual(wanted.sort(), ['T-003|DOES_NOT_FIT', 'T-003|FITS', 'T-006|FITS'], 'the corpus workers (of the 37 buildable cases) that declare a schedule on a window-less flexible-day/week task');
  assert.deepEqual(lib.EXPECTED_ADJUSTED_WORKERS.filter(([, label]) => !label.startsWith('control-restricted')).map(([caseId, label]) => `${caseId}|${label.startsWith('fits') ? 'FITS' : 'DOES_NOT_FIT'}`).sort(), wanted,
    'the written list is the corpus-derived one plus the two DRAFT controls (copies of the FITS worker)');
});

// ------------------------------------------------------------------ VAC-7: the full detail
const detailOf = (over = {}) => ({workerAccountId: 'a', workerProfileId: 'p', responseAllowed: true, dispatchEligible: true, hardBlockers: [], dispatchBlockers: [], reasonCodes: ['SERVICE_MATCH', 'SCHEDULE_MATCH', 'REMOTE_LOCATION_NOT_REQUIRED', 'RESOURCES_MATCH', 'NEWCOMER_FAIRNESS'],
  distanceToStartKm: null, effectiveRadiusKm: 15, taskLocationMode: 'REMOTE', distanceSource: null, routingProvider: null, liveStateDate: null, score: 95,
  scoreComponents: {capability: 30, schedule: 25, distanceToStart: 15, resources: 15, reliability: 5, fairness: 5}, ...over});
const refusedDetail = (over = {}) => detailOf({dispatchEligible: false, dispatchBlockers: ['OUTSIDE_AVAILABILITY'], reasonCodes: ['SERVICE_MATCH', 'REMOTE_LOCATION_NOT_REQUIRED', 'RESOURCES_MATCH', 'NEWCOMER_FAIRNESS'], score: 70,
  scoreComponents: {capability: 30, schedule: 0, distanceToStart: 15, resources: 15, reliability: 5, fairness: 5}, ...over});
test('VAC-7: the full detail of a flip carries schedule 25, SCHEDULE_MATCH and +25 points, and nothing else changes; a stay pair is identical', () => {
  assert.deepEqual(lib.detailProblems(detailOf(), {admitted: true}), []);
  assert.deepEqual(lib.detailProblems(refusedDetail(), {admitted: false}), []);
  assert.deepEqual(lib.detailDelta(refusedDetail(), detailOf(), {flips: true}), []);
  assert.deepEqual(lib.detailDelta(refusedDetail(), refusedDetail(), {}), []);
  const paused = refusedDetail({dispatchBlockers: ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY']});
  assert.deepEqual(lib.detailDelta(paused, refusedDetail(), {pausedGone: true}), []);
  assert.deepEqual(lib.detailDelta(refusedDetail({dispatchBlockers: ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY']}), detailOf(), {flips: true, pausedGone: true}), []);
});
test('VAC-7 mutation: a flip whose detail is wrong in any field is reported (schedule component, reason code, score, a blocker kept, another field changed, eligibility)', () => {
  const flipped = detailOf(), before = refusedDetail();
  const bad = (mutated, label, expectProblem) => assert.ok(lib.detailDelta(before, mutated, {flips: true}).some(item => item.includes(expectProblem)), `${label}: ${JSON.stringify(lib.detailDelta(before, mutated, {flips: true}))}`);
  bad({...flipped, scoreComponents: {...flipped.scoreComponents, schedule: 0}}, 'schedule component stayed 0', 'SCHEDULE_COMPONENT_AFTER');
  bad({...flipped, reasonCodes: flipped.reasonCodes.filter(code => code !== 'SCHEDULE_MATCH')}, 'SCHEDULE_MATCH missing', 'REASON_CODES');
  bad({...flipped, score: 70}, 'score unchanged', 'SCORE');
  bad({...flipped, dispatchBlockers: ['OUTSIDE_AVAILABILITY'], dispatchEligible: false}, 'the blocker is still there', 'DISPATCH_BLOCKERS');
  bad({...flipped, effectiveRadiusKm: 20}, 'another field changed', 'UNINTENDED_FIELD_CHANGED');
  bad({...flipped, scoreComponents: {...flipped.scoreComponents, capability: 10}}, 'another component changed', 'SCORE_COMPONENT_CHANGED');
  bad({...flipped, dispatchEligible: false}, 'eligibility not from the blockers', 'DISPATCH_ELIGIBLE');
  assert.ok(lib.detailDelta(before, before, {flips: true}).length > 0, 'a flip that did not happen is reported');
  assert.ok(lib.detailDelta(before, flipped, {}).length > 0, 'a stay pair whose detail changed is reported');
  assert.ok(lib.detailProblems({...flipped, scoreComponents: {...flipped.scoreComponents, schedule: 0}}, {admitted: true}).length > 0);
  assert.ok(lib.detailProblems(refusedDetail({reasonCodes: ['SCHEDULE_MATCH']}), {admitted: false}).length > 0);
  assert.ok(lib.detailProblems(detailOf({score: 80}), {admitted: true}).some(item => item.startsWith('SCORE_NOT_THE_COMPONENT_SUM')));
  assert.ok(lib.detailProblems(null, {admitted: true}).length > 0);
  const detailsBefore = {'T-003|fits': refusedDetail(), 'T-003|control-restricted': refusedDetail()}, detailsAfter = {'T-003|fits': detailOf(), 'T-003|control-restricted': refusedDetail()};
  assert.deepEqual(lib.corpusDetailProblems(detailsBefore, detailsAfter, {'T-003|fits': {flips: true}}), []);
  assert.ok(lib.corpusDetailProblems(detailsBefore, {...detailsAfter, 'T-003|control-restricted': detailOf()}, {'T-003|fits': {flips: true}}).some(item => item.startsWith('T-003|control-restricted')), 'a control that flips is unintended');
  assert.ok(lib.corpusDetailProblems(detailsBefore, {'T-003|fits': detailOf()}, {'T-003|fits': {flips: true}}).some(item => /DETAIL_MISSING/.test(item)));
});

// ------------------------------------------------------------------ VAC-8: the corpus fixture adjustment is narrow
test('the one fixture adjustment gives a window-less flexible-day/week worker a NARROW schedule (tomorrow weekday 09-17; Sunday for the week), and nothing else', () => {
  let n = 0;
  const id = () => 'rule-' + (++n);
  const spec = {label: 'fits', skills: ['dostava'], interval: null, availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, location: {city: 'Novi Sad'}};
  const thursday = at('2026-10-01T12:00:00Z');   // Thursday in Belgrade
  const tomorrow = lib.augmentSpec(spec, 'TOMORROW_FLEXIBLE', id, {nowMs: thursday});
  assert.notEqual(tomorrow, spec);
  assert.equal(tomorrow.availability.availableNow, true);
  assert.equal(tomorrow.availability.rules.length, 1);
  assert.deepEqual([tomorrow.availability.rules[0].weekdays, tomorrow.availability.rules[0].startTime, tomorrow.availability.rules[0].endTime], [[5], '09:00:00', '17:00:00'], 'tomorrow (Friday) 09-17');
  assert.deepEqual(lib.augmentSpec(spec, 'TOMORROW_FLEXIBLE', id, {nowMs: at('2026-10-03T12:00:00Z')}).availability.rules[0].weekdays, [0], 'Saturday: tomorrow is Sunday');
  assert.deepEqual(lib.augmentSpec(spec, 'TOMORROW_FLEXIBLE', id, {nowMs: at('2026-10-04T12:00:00Z')}).availability.rules[0].weekdays, [1], 'Sunday: tomorrow is Monday');
  const week = lib.augmentSpec(spec, 'WEEK_FLEXIBLE', id, {nowMs: thursday});
  assert.deepEqual([week.availability.rules[0].weekdays, week.availability.rules[0].startTime, week.availability.rules[0].endTime], [[0], '00:00:00', '23:59:00'], 'the last day of the local week, the whole day: inside the remaining part of the week on any day');
  assert.deepEqual(Object.keys(tomorrow).sort(), Object.keys(spec).sort(), 'no key is added to the spec (the harness validates its keys)');
  assert.equal(lib.augmentSpec({...spec, availability: {shape: 'SCHEDULED_ONLY'}}, 'WEEK_FLEXIBLE', id, {nowMs: thursday}).availability.availableNow, false);
  for (const same of [lib.augmentSpec(spec, 'FIXED_WINDOW', id, {}), lib.augmentSpec(spec, 'TODAY_FLEXIBLE', id, {}), lib.augmentSpec({...spec, interval: {startMs: 1, endMs: 2}}, 'TOMORROW_FLEXIBLE', id, {}),
    lib.augmentSpec({...spec, availability: {shape: 'NONE_DECLARED'}}, 'TOMORROW_FLEXIBLE', id, {}), lib.augmentSpec({...spec, availability: {shape: 'AVAILABLE_NOW_ONLY'}}, 'WEEK_FLEXIBLE', id, {}),
    lib.augmentSpec({...spec, availability: null}, 'WEEK_FLEXIBLE', id, {})]) assert.ok(same !== undefined);
  assert.equal(lib.augmentSpec(spec, 'FIXED_WINDOW', id, {}), spec);
  assert.equal(lib.augmentSpec({...spec, availability: {shape: 'NONE_DECLARED'}}, 'TOMORROW_FLEXIBLE', id, {}).availability.shape, 'NONE_DECLARED');
  assert.throws(() => lib.augmentSpec(spec, 'TOMORROW_FLEXIBLE', id, {}), /AUGMENT_NEEDS_THE_PASS_CLOCK/);
});
/** The corpus FITS worker as the oracle sees it: the adjusted spec turned into a plan worker. */
function corpusWorker(adjustedSpec) {
  const a = adjustedSpec.availability;
  return {status: 'ACTIVE', availableNow: a.availableNow, zone: null, windows: [], rules: a.rules.map(r => ({weekdays: r.weekdays, startTime: r.startTime, endTime: r.endTime, startsOn: r.startsOn, endsOn: r.endsOn, active: r.active}))};
}
const everyDay = [{weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00:00', endTime: '23:59:00', startsOn: '2026-01-01', endsOn: null, active: true}];
test('VAC-8 mutation: the narrow corpus worker discriminates the window on the product path; the first author every-day worker could not', () => {
  const spec = {label: 'fits', skills: ['dostava'], interval: null, availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}};
  const todayOnly = {...S, tomorrow: (anchor, zone) => ({startMs: lib.localToMs(anchor, '00:00:00', zone), endMs: lib.localToMs(lib.addDays(anchor, 1), '00:00:00', zone)})};
  const tomorrowOnlyWeek = {...S, week: (anchor, zone) => S.tomorrow(anchor, zone)};
  const todayOnlyWeek = {...S, week: (anchor, zone) => todayOnly.tomorrow(anchor, zone)};
  let nWeek = 0;
  for (const nowMs of DAYS14) {
    const taskT = {kind: 'TOMORROW_FLEXIBLE', startsAt: null, endsAt: null, publishedAt: nowMs, taskZone: lib.BELGRADE}, taskW = {...taskT, kind: 'WEEK_FLEXIBLE'};
    const narrowT = corpusWorker(lib.augmentSpec(spec, 'TOMORROW_FLEXIBLE', () => 'r', {nowMs})), narrowW = corpusWorker(lib.augmentSpec(spec, 'WEEK_FLEXIBLE', () => 'r', {nowMs}));
    const oldWorker = {status: 'ACTIVE', availableNow: true, zone: null, windows: [], rules: everyDay};
    // the candidate admits the narrow worker (it is the FITS worker of the corpus)
    assert.equal(lib.admittedOracle({task: taskT, worker: narrowT, nowMs}), true, lib.iso(nowMs));
    assert.equal(lib.admittedOracle({task: taskW, worker: narrowW, nowMs}), true, lib.iso(nowMs));
    // a window that is only today is refused for the narrow tomorrow worker and admitted for the every-day worker (the old fixture cannot see it)
    assert.equal(lib.admittedOracle({task: taskT, worker: narrowT, nowMs, semantics: todayOnly}), false, 'killed ' + lib.iso(nowMs));
    assert.equal(lib.admittedOracle({task: taskT, worker: oldWorker, nowMs, semantics: todayOnly}), true, 'the every-day worker survives ' + lib.iso(nowMs));
    // a week that is only today, or only tomorrow, is refused for the narrow week worker (Sunday), except a tomorrow-only week on a Saturday; the every-day worker admits it always
    assert.equal(lib.admittedOracle({task: taskW, worker: narrowW, nowMs, semantics: todayOnlyWeek}), lib.localParts(nowMs, lib.BELGRADE).weekday === 0, 'today-only week killed except on a Sunday ' + lib.iso(nowMs));
    assert.equal(lib.admittedOracle({task: taskW, worker: narrowW, nowMs, semantics: tomorrowOnlyWeek}), lib.localParts(nowMs, lib.BELGRADE).weekday === 6, 'tomorrow-only week killed except on a Saturday ' + lib.iso(nowMs));
    assert.equal(lib.admittedOracle({task: taskW, worker: oldWorker, nowMs, semantics: tomorrowOnlyWeek}), true);
    if (lib.localParts(nowMs, lib.BELGRADE).weekday !== 6) nWeek++;
  }
  assert.ok(nWeek >= 12);
});

// ------------------------------------------------------------------ the clock guard, the deltas, the SQL text
test('the clock guard waits when a local midnight is close and when the local day has only just begun (the stale-availability case needs a window that is already over)', () => {
  assert.equal(lib.clockWaitMs(at('2027-06-10T12:00:00Z')), 0);
  const nearMidnight = at('2027-06-10T21:55:00Z');   // 23:55 in Belgrade (CEST)
  assert.equal(lib.clockWaitMs(nearMidnight), 5 * lib.MINUTE + 3 * lib.MINUTE);
  assert.equal(lib.clockWaitMs(at('2027-06-10T21:49:00Z')), 0);
  assert.equal(lib.clockWaitMs(at('2027-06-10T21:49:00Z'), {guardMinutes: 20}), 11 * lib.MINUTE + 3 * lib.MINUTE);
  const justAfter = at('2027-06-10T22:00:30Z');      // 00:00:30 in Belgrade
  assert.equal(lib.clockWaitMs(justAfter), 3 * lib.MINUTE - 30 * 1000);
  assert.equal(lib.clockWaitMs(at('2027-06-10T22:03:00Z')), 0);
});
test('diffNamed and surfaceDelta (two bodies)', () => {
  assert.deepEqual(lib.diffNamed([{name: 'a', md5: '1'}, {name: 'b', md5: '2'}], [{name: 'a', md5: '1'}, {name: 'b', md5: '3'}, {name: 'c', md5: '4'}]), {added: ['c'], removed: [], changed: [{name: 'b', before: '2', after: '3'}]});
  const meta = ':definer=true:volatility=s:config=search_path=pg_catalog:acl={postgres=X/postgres}';
  const before = ['function:private.f(a uuid):111' + meta, 'function:private.h(a uuid):333' + meta, 'function:private.g():222:definer=false'];
  const after = ['function:private.f(a uuid):999' + meta, 'function:private.h(a uuid):444' + meta, before[2]];
  const delta = lib.surfaceDelta(before, after);
  assert.equal(delta.onlyBodiesChanged, true);
  assert.deepEqual(delta.names, ['private.f(a uuid)', 'private.h(a uuid)']);
  const moved = lib.surfaceDelta(before, [after[0].replace('definer=true', 'definer=false'), after[1], before[2]]);
  assert.equal(moved.onlyBodiesChanged, false);
  assert.equal(lib.surfaceDelta(before, [after[0], before[1], before[2]]).onlyBodiesChanged, true);
});
test('fixtureSql and evaluationSql are well formed and cover the plan', () => {
  const plan = lib.buildMatrix(at('2026-10-01T12:00:00Z'));
  let counter = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
  const ids = {requester: {account: uuid(), profile: uuid()}, workers: {}, tasks: {}};
  for (const key of Object.keys(plan.workers)) ids.workers[key] = {account: uuid(), profile: uuid()};
  for (const key of Object.keys(plan.tasks)) ids.tasks[key] = uuid();
  const sql = lib.fixtureSql(plan, ids, q);
  assert.ok(sql.startsWith('begin;\nset local session_replication_role = replica;') && sql.endsWith('commit;'));
  assert.equal((sql.match(/insert into public\.needs\(/g) ?? []).length, Object.keys(plan.tasks).length);
  assert.equal((sql.match(/'WORKER'/g) ?? []).length, Object.keys(plan.workers).length);
  const rules = Object.values(plan.workers).reduce((sum, worker) => sum + worker.rules.length, 0), windows = Object.values(plan.workers).reduce((sum, worker) => sum + worker.windows.length, 0);
  assert.equal((sql.match(/insert into public\.profile_availability_rules/g) ?? []).length, rules);
  assert.equal((sql.match(/insert into public\.profile_availability_windows/g) ?? []).length, windows);
  assert.equal((sql.match(/insert into public\.worker_match_preferences/g) ?? []).length, Object.values(plan.workers).filter(worker => worker.zone).length);
  assert.ok(!/\$/.test(sql), 'no dollar sign in the fixture text');
  const pairs = lib.pairsOf(plan, ids);
  assert.equal(pairs.length, new Set(pairs.map(pair => pair.key)).size);
  assert.equal(pairs.length, plan.cases.length + plan.unchanged.length);
  const select = lib.evaluationSql(pairs.slice(0, 3), q);
  assert.match(select, /private\.worker_dispatch_time_admitted\(v\.nid, v\.pid\)/);
  assert.match(select, /private\.dispatch_cheap_candidate_admitted\(v\.nid, v\.pid\)/);
  assert.match(select, /private\.match_detail\(v\.nid, v\.pid\)/);
});

// ------------------------------------------------------------------ the generated files agree with each other and with the pinned predecessors
const strip = text => text.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
test('the candidate, the revert and the postflight agree (pins, bodies, md5, the two targets)', () => {
  const candidate = read('supabase/candidates/ex06a_flexible_window.sql'), revert = read('supabase/candidates/ex06a_flexible_window_revert.sql');
  const postflight = read('supabase/proofs/ex06/ex06a_postflight.readonly.sql');
  for (const text of [candidate, revert, postflight]) assert.ok(!text.includes('\r'), 'LF only');
  const pins = lib.parsePins(candidate);
  assert.equal(pins[0].signature, lib.TARGET); assert.equal(pins[0].md5, lib.OLD_MD5);
  assert.equal(pins[1].signature, lib.DETAIL_TARGET); assert.equal(pins[1].md5, lib.DETAIL_OLD_MD5);
  assert.equal(pins.length, 12, 'two targets and ten neighbours');
  assert.ok(!pins.slice(2).some(pin => pin.signature === lib.DETAIL_TARGET || pin.signature === lib.TARGET), 'a target is not also a neighbour');
  assert.deepEqual(lib.parsePins(revert).map(pin => pin.signature), pins.slice(2).map(pin => pin.signature), 'the revert reports the same ten neighbours (informational)');
  // chain finding 8: the function that turns dispatchEligible into deliveries (and the corpus evidence was produced against) is pinned at the APPLICATION as well, with the md5 of the S03 pin gate
  const wave = pins.find(pin => pin.signature === 'private.dispatch_next_wave(uuid)');
  assert.ok(wave, 'private.dispatch_next_wave is pinned by the candidate');
  assert.equal(wave.md5, PROOF_POINT_PINS.find(pin => pin.name === 'private.dispatch_next_wave').md5, 'with the md5 of the S03 pin gate (read on DEV 2026-10-01)');
  assert.ok(pins.indexOf(wave) >= 2, 'a neighbour: blocking at the application, informational in the revert and the postflight');
  const newBody = lib.dollarLiteral(candidate, 'new_body'), oldBody = lib.dollarLiteral(revert, 'old_body');
  assert.equal(md5(oldBody), lib.OLD_MD5, 'the revert restores exactly the pinned predecessor');
  assert.equal(lib.dollarLiteral(revert, 'new_body'), newBody, 'the revert refuses unless the body is the applied one');
  assert.equal(lib.dollarLiteral(revert, 'detail_anchor'), lib.dollarLiteral(candidate, 'detail_anchor'));
  assert.equal(lib.dollarLiteral(revert, 'detail_replacement'), lib.dollarLiteral(candidate, 'detail_replacement'));
  const detailNew = candidate.match(/detail_new_md5 constant text := '([0-9a-f]{32})'/)[1];
  assert.equal(revert.match(/detail_new_md5 constant text := '([0-9a-f]{32})'/)[1], detailNew);
  assert.match(postflight, new RegExp(`'${lib.TARGET.replace(/[()]/g, '\\$&')}','${md5(newBody)}','boolean'`), 'the postflight pins the applied body of the first target');
  assert.match(postflight, new RegExp(`'${lib.DETAIL_TARGET.replace(/[()]/g, '\\$&')}','${detailNew}','jsonb'`), 'the postflight pins the applied body of the second target');
  assert.notEqual(md5(newBody), lib.OLD_MD5);
  for (const text of [newBody, oldBody, lib.dollarLiteral(candidate, 'detail_anchor'), lib.dollarLiteral(candidate, 'detail_replacement')]) assert.ok(!/[$\\]/.test(text), 'no dollar sign or backslash in a dollar-quoted literal');
  // the second function: the edit is exactly invertible and produces the pinned md5 from the DEV body (kept byte-exact in the repository)
  const preImage = read('supabase/proofs/ex06/ex06a_match_detail_without_calendar_dev_body.txt').replace(/\r\n/g, '\n');
  assert.equal(md5(preImage), lib.DETAIL_OLD_MD5, 'the stored body is the DEV predecessor');
  const anchor = lib.dollarLiteral(candidate, 'detail_anchor'), replacement = lib.dollarLiteral(candidate, 'detail_replacement');
  assert.equal(preImage.split(anchor).length - 1, 1, 'the anchor occurs once');
  const detailBody = preImage.replace(anchor, replacement);
  assert.equal(md5(detailBody), detailNew);
  assert.equal(detailBody.replace(replacement, anchor), preImage, 'the revert inverts the edit exactly');
  assert.equal(detailBody.split(replacement).length - 1, 1);
  // exactly two functions are replaced, nothing is created or dropped, nothing is granted
  assert.equal((candidate.match(/create or replace function/g) ?? []).length, 1, 'the first target is replaced by text, the second through its own definition (pg_get_functiondef)');
  assert.match(candidate, /pg_get_functiondef\(detail_oid\)/);
  const code = strip(candidate).replace(/\$new_body\$[\s\S]*?\$new_body\$/, '').replace(/\$detail_anchor\$[\s\S]*?\$detail_anchor\$/, '').replace(/\$detail_replacement\$[\s\S]*?\$detail_replacement\$/, '');
  for (const forbidden of [/\bcreate\s+(?!or replace function private\.worker_dispatch_time_admitted)(?!temporary table ex06a_functions)\w/i, /\balter\s/i, /\bdrop\s+(function|table|trigger|policy|index|schema|column|constraint|extension|type|view)\b/i,
    /\bgrant\s/i, /\brevoke\s/i, /\binsert\s+into\b/i, /\bupdate\s+\w/i, /\bdelete\s+from\b/i]) {
    assert.ok(!forbidden.test(code), 'the candidate is function-only: ' + forbidden);
  }
  assert.ok(!/40001/.test(candidate + revert), 'no 40001: a conflict would use PT409');
  for (const name of ['EX06A_CLOSURE_MOVED', 'EX06A_FUNCTION_ROSTER_DELTA', 'EX06A_UNRELATED_FUNCTION_DELTA', 'EX06A_PREDECESSOR_DRIFT', 'EX06A_ALREADY_APPLIED', 'EX06A_CRLF_TEXT', 'EX06A_DETAIL_ANCHOR_NOT_UNIQUE', 'EX06A_TARGET_IS_CERTIFIED']) assert.match(candidate, new RegExp(name));
  assert.match(revert, /EX06A_REVERT_STATE_NOT_THE_APPLIED_ONE/); assert.match(revert, /EX06A_REVERT_CRLF_TEXT/);
});
test('CHAIN-1: the one-shot guard and the application strip carriage returns; the revert and the postflight treat the neighbours as information, not as a condition (CHAIN-2)', () => {
  const candidate = read('supabase/candidates/ex06a_flexible_window.sql'), revert = read('supabase/candidates/ex06a_flexible_window_revert.sql'), postflight = read('supabase/proofs/ex06/ex06a_postflight.readonly.sql');
  assert.match(candidate, /md5\(replace\(new_body, E'\\r', ''\)\)/, 'the one-shot check compares LF-normalised text');
  assert.match(candidate, /position\(E'\\r' in new_body\) > 0/);
  assert.match(revert, /position\(E'\\r' in old_body\) > 0/);
  assert.ok(!/EX06A_REVERT_PREDECESSOR_DRIFT/.test(revert), 'a changed neighbour does not stop the revert');
  assert.match(revert, /raise notice 'EX06A_REVERT_NEIGHBOUR_CHANGED/);
  assert.match(revert, /EX06A_REVERT_TARGET_ATTRIBUTE_DRIFT/); assert.match(revert, /EX06A_REVERT_CLOSURE_NOT_READY/);
  assert.match(postflight, /'NEIGHBOUR_CHANGED'/); assert.match(postflight, /'informational'/);
  assert.ok(!/'BODY_DRIFT' as kind[\s\S]*neighbours/.test(postflight.split('informational as')[0]), 'the neighbours are not part of the problems');
  assert.equal((postflight.match(/^\s*\('(?:private|public)\.[^']+','[0-9a-f]{32}'/gm) ?? []).length, 12, 'twelve pins read: two targets and ten neighbours');
  assert.match(postflight, /'private\.dispatch_next_wave\(uuid\)','1fd8c51ef026ece24471e2f68250ecc5'/);
  assert.ok(!/EX06A_REVERT_PREDECESSOR_DRIFT/.test(revert) && /raise notice 'EX06A_REVERT_NEIGHBOUR_CHANGED/.test(revert), 'the pinned consumer is informational in the revert');
  assert.ok(/raise exception 'EX06A_PREDECESSOR_DRIFT: %'/.test(candidate), 'and blocking at the application');
  // the repository pins the candidate and revert bytes to LF (CHAIN-1)
  const attributes = readFileSync(resolve(root, '.gitattributes'), 'utf8');
  assert.match(attributes, /^supabase\/candidates\/ex06\*\.sql text eol=lf$/m);
  assert.match(attributes, /^supabase\/proofs\/ex06\/ex06a_\* text eol=lf$/m);
});
test('the new bodies differ from the predecessors only by the anchored edits', () => {
  const candidate = read('supabase/candidates/ex06a_flexible_window.sql'), revert = read('supabase/candidates/ex06a_flexible_window_revert.sql');
  const newBody = lib.dollarLiteral(candidate, 'new_body'), oldBody = lib.dollarLiteral(revert, 'old_body');
  const oldLines = oldBody.split('\n'), newLines = newBody.split('\n');
  const removed = oldLines.filter(line => !newLines.includes(line)), added = newLines.filter(line => !oldLines.includes(line));
  assert.deepEqual(removed, [
    'declare n public.needs; p public.app_profiles; tz text; at_now timestamptz:=statement_timestamp(); periods tstzmultirange;',
    '  if private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,at_now) then',
    '    periods:=private.worker_available_periods(pid,greatest(n.starts_at,at_now),n.ends_at,tz);',
    "    if n.schedule_kind='FIXED_WINDOW' then return periods @> tstzrange(n.starts_at,n.ends_at,'[)'); end if;",
  ], 'exactly the declare line and the three lines of the future branch are replaced');
  assert.ok(added.some(line => line.includes('anchor_day:=(n.published_at at time zone wtz)::date;')));
  assert.ok(added.some(line => line.includes("if n.starts_at is null and n.ends_at is null and n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then")));
  assert.ok(added.some(line => line.includes('if n.published_at is null then return false; end if;')), 'SEM-5: no rolling anchor');
  assert.ok(added.some(line => line.includes("else 'Europe/Belgrade' end;")) && !added.some(line => /coalesce\(n\.published_at/.test(line)) && !added.some(line => /else tz end/.test(line)), 'SEM-4: the fallback is Belgrade, never the worker zone');
  for (const kept of ['  tz:=coalesce(tz,\'Europe/Belgrade\');', '    return periods<>\'{}\'::tstzmultirange;', '  if n.schedule_kind=\'FIXED_WINDOW\' then return private.schedule_fit(pid,n.starts_at,n.ends_at,tz); end if;']) {
    assert.ok(newLines.includes(kept), 'unchanged line kept: ' + kept);
  }
  // the second function: exactly one line removed, one condition widened
  const preImage = read('supabase/proofs/ex06/ex06a_match_detail_without_calendar_dev_body.txt').replace(/\r\n/g, '\n').split('\n');
  const detailNew = read('supabase/proofs/ex06/ex06a_match_detail_without_calendar_dev_body.txt').replace(/\r\n/g, '\n').replace(lib.dollarLiteral(candidate, 'detail_anchor'), lib.dollarLiteral(candidate, 'detail_replacement')).split('\n');
  assert.deepEqual(preImage.filter(line => !detailNew.includes(line)), ['    and not private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,statement_timestamp())']);
  assert.equal(detailNew.filter(line => !preImage.includes(line)).length, 5);
  assert.equal(lib.INTENDED_FLIPS.length, 21);
});
test('tamperPin changes exactly one pin; parsePins rejects a text without pins', () => {
  const candidate = read('supabase/candidates/ex06a_flexible_window.sql');
  const pins = lib.parsePins(candidate);
  for (const index of [0, 1, 2]) {
    const tampered = lib.tamperPin(candidate, pins[index].signature);
    assert.equal(lib.parsePins(tampered)[index].md5, '0'.repeat(32));
    assert.equal(lib.parsePins(tampered).filter(pin => pin.md5 === '0'.repeat(32)).length, 1);
  }
  assert.throws(() => lib.parsePins('select 1'), /CANDIDATE_PINS_NOT_FOUND/);
  assert.throws(() => lib.tamperPin(candidate, 'private.nope()'), /PIN_NOT_FOUND/);
});

// ------------------------------------------------------------------ vacuity 3: what the proof asserts of one pair (the gate, the complete blockers, the eligibility)
/** What the real functions would answer for a pair, built from the oracle: the full match_detail of an ACTIVE fixture worker has no hard blocker and exactly the schedule codes as dispatch blockers. */
function simulatedGot(part, item, state, nowMs, expect) {
  const worker = part.workers[item.worker], task = part.tasks[item.task], active = (worker.status ?? 'ACTIVE') === 'ACTIVE', derive = state === 'after';
  const admitted = lib.admittedOracle({task, worker, nowMs, derive}), codes = lib.codesOracle({task, worker, nowMs, derive});
  const reasons = ['SERVICE_MATCH', 'REMOTE_LOCATION_NOT_REQUIRED', 'RESOURCES_MATCH', 'NEWCOMER_FAIRNESS', ...(admitted ? ['SCHEDULE_MATCH'] : [])];
  const detail = {workerAccountId: 'a', workerProfileId: 'p', responseAllowed: active, dispatchEligible: active && codes.length === 0, hardBlockers: active ? [] : ['ACCOUNT_OR_PROFILE_RESTRICTED'], dispatchBlockers: codes,
    reasonCodes: reasons, distanceToStartKm: null, effectiveRadiusKm: 15, taskLocationMode: 'REMOTE', distanceSource: null, routingProvider: null, liveStateDate: null, score: admitted ? 95 : 70,
    scoreComponents: {capability: 30, schedule: admitted ? 25 : 0, distanceToStart: 15, resources: 15, reliability: 5, fairness: 5}};
  return {admitted, cheap: active ? admitted : false, detail, codes: lib.scheduleCodesOf(detail), active, expect};
}
test('vacuity 3: every pair of the matrix and of the clock family, answered the way the oracle says, has no problem: the gate, the complete blocker list, the eligibility (a flip is dispatchEligible), at every clock', () => {
  let flips = 0, scheduledOnlyFlips = 0;
  for (const now of [...CLOCKS.map(at), ...DAY_CLOCKS.filter((_, i) => i % 5 === 0)]) {
    const plan = lib.buildMatrix(now), family = lib.buildClockFamily(now);
    for (const state of ['before', 'after']) {
      for (const part of [plan, family]) {
        for (const item of part.cases) {
          const got = simulatedGot(part, item, state, now, item[state]);
          assert.deepEqual(lib.pairProblems({expect: item[state], got, active: got.active}), [], `${lib.iso(now)} ${state} ${item.id}`);
          if (state === 'after' && item.after.admitted && item.after.codes.length === 0 && !part.workers[item.worker].availableNow) scheduledOnlyFlips++;
          if (state === 'after' && !item.before.admitted && item.after.admitted) { flips++; assert.equal(got.detail.dispatchEligible, true, `${item.id}: a flip is dispatchEligible`); }
        }
      }
      for (const item of plan.unchanged) {
        const got = simulatedGot(plan, item, state, now, {admitted: item.admitted, codes: item.codes});
        assert.deepEqual(lib.pairProblems({expect: {admitted: item.admitted, codes: item.codes}, got, active: true}), [], `${lib.iso(now)} ${state} ${item.id} unchanged`);
      }
    }
  }
  assert.ok(flips > 200 && scheduledOnlyFlips > 20, `the flips are many and the scheduled-only worker (live intent off) is among them: ${flips} / ${scheduledOnlyFlips}`);
});
test('vacuity 3 mutation: an admitted pair that stays ineligible, an extra or a missing blocker, a hard blocker, a wrong eligibility or a draft that is eligible is reported', () => {
  const now = at('2026-10-01T12:00:00Z'), plan = lib.buildMatrix(now);
  const item = plan.cases.find(entry => entry.id === 'A/off_thu');   // the scheduled-only worker (live intent off, a real Thursday rule): admitted and eligible after the candidate
  const good = simulatedGot(plan, item, 'after', now, item.after);
  assert.deepEqual(lib.pairProblems({expect: item.after, got: good, active: true}), []);
  const bad = (mutate, pattern, label) => assert.ok(lib.pairProblems({expect: item.after, got: mutate(structuredClone(good)), active: true}).some(problem => pattern.test(problem)), label);
  bad(got => { got.detail.dispatchEligible = false; return got; }, /DISPATCH_ELIGIBLE|DISPATCH_ELIGIBLE_NOT_FROM_BLOCKERS/, 'admitted but not eligible');
  bad(got => { got.detail.dispatchBlockers = ['BELOW_MINIMUM_FEE']; got.detail.dispatchEligible = false; return got; }, /DISPATCH_BLOCKERS/, 'admitted but another soft blocker keeps it out: the complete list is asserted');
  bad(got => { got.detail.dispatchBlockers = ['CURRENT_AVAILABILITY_PAUSED']; got.detail.dispatchEligible = false; return got; }, /DISPATCH_BLOCKERS/, 'the paused code is still there (the second function was not changed)');
  bad(got => { got.detail.hardBlockers = ['OWN_NEED']; got.detail.dispatchEligible = false; got.detail.responseAllowed = false; return got; }, /HARD_BLOCKERS/, 'a hard blocker');
  bad(got => { got.admitted = false; return got; }, /GATE/, 'the gate refuses');
  bad(got => { got.cheap = false; return got; }, /CHEAP_GATE/, 'the cheap candidate gate does not follow');
  bad(got => { got.codes = ['OUTSIDE_AVAILABILITY']; return got; }, /SCHEDULE_CODES/, 'the schedule codes');
  const stay = plan.cases.find(entry => entry.id === 'A/on_none'), stayGot = simulatedGot(plan, stay, 'after', now, stay.after);
  assert.deepEqual(lib.pairProblems({expect: stay.after, got: stayGot, active: true}), []);
  assert.ok(lib.pairProblems({expect: stay.after, got: {...stayGot, detail: {...stayGot.detail, dispatchEligible: true}}, active: true}).length > 0, 'a refused pair that is eligible');
  const draft = plan.cases.find(entry => entry.id === 'A/draft_thu'), draftGot = simulatedGot(plan, draft, 'after', now, draft.after);
  assert.deepEqual(lib.pairProblems({expect: draft.after, got: draftGot, active: false}), []);
  assert.ok(lib.pairProblems({expect: draft.after, got: {...draftGot, detail: {...draftGot.detail, hardBlockers: []}}, active: false}).some(problem => /DRAFT_WORKER_WITHOUT/.test(problem)));
  assert.ok(lib.pairProblems({expect: draft.after, got: {...draftGot, cheap: true}, active: false}).some(problem => /CHEAP_GATE/.test(problem)));
});
test('the full-detail delta of every matrix case from before to after, as the proof computes it (flip, paused code gone), has no problem for the oracle-built details; a stay pair is identical', () => {
  for (const now of CLOCKS.map(at)) {
    const plan = lib.buildMatrix(now);
    for (const item of plan.cases) {
      const before = simulatedGot(plan, item, 'before', now, item.before).detail, after = simulatedGot(plan, item, 'after', now, item.after).detail;
      const flips = !item.before.admitted && item.after.admitted;
      const pausedGone = (item.before.codes ?? []).includes('CURRENT_AVAILABILITY_PAUSED') && !(item.after.codes ?? []).includes('CURRENT_AVAILABILITY_PAUSED');
      assert.deepEqual(lib.detailDelta(before, after, {flips, pausedGone}), [], `${lib.iso(now)} ${item.id} (flip ${flips}, paused gone ${pausedGone})`);
      if (!flips && !pausedGone) assert.deepEqual(before, after, `${item.id}: a stay pair is identical`);
    }
    for (const item of plan.unchanged) assert.deepEqual(simulatedGot(plan, item, 'before', now, {}).detail, simulatedGot(plan, item, 'after', now, {}).detail, `${item.id}: unchanged`);
  }
});
test('the unchanged pairs carry the complete schedule codes of the predecessor (live intent off and no window: paused AND outside; one stored bound: refused for everyone)', () => {
  const plan = lib.buildMatrix(at('2026-10-01T12:00:00Z')), byId = id => plan.unchanged.find(item => item.id === id);
  assert.deepEqual(byId('E_flex_none/e_none_off').codes, ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY']);
  assert.deepEqual(byId('E_flex_none/e_cov_on').codes, []);
  assert.deepEqual(byId('E_fixed/e_cov_on').codes, []);
  assert.deepEqual(byId('E_fixed/e_cov_off').codes, [], 'a fixed window in the future is future availability: not paused');
  assert.deepEqual(byId('E_tomorrow_start/e_all_on').codes, ['OUTSIDE_AVAILABILITY']);
  assert.deepEqual(byId('E_tomorrow_start/e_all_off').codes, ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY']);
  assert.ok(plan.unchanged.every(item => Array.isArray(item.codes)));
});

// ------------------------------------------------------------------ the clock family and its fixtures
test('the clock family installs as well-formed direct fixtures (one WEEK task published now; every worker and rule it names)', () => {
  const now = lib.localToMs('2026-10-03', '10:30:00', lib.BELGRADE), family = lib.buildClockFamily(now);
  let counter = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
  const ids = {requester: {account: uuid(), profile: uuid()}, workers: {}, tasks: {}};
  for (const key of Object.keys(family.workers)) ids.workers[key] = {account: uuid(), profile: uuid()};
  for (const key of Object.keys(family.tasks)) ids.tasks[key] = uuid();
  const sql = lib.fixtureSql(family, ids, q);
  assert.equal((sql.match(/insert into public\.needs\(/g) ?? []).length, 1);
  assert.equal((sql.match(/'WORKER'/g) ?? []).length, Object.keys(family.workers).length);
  assert.equal(Object.keys(family.workers).length, 5);
  assert.deepEqual(Object.keys(family.workers).sort(), ['h_late', 'h_stale', 'h_today_off', 'h_today_rule', 'h_today_win']);
  assert.ok(!/\$/.test(sql));
  assert.equal(lib.pairsOf(family, ids).length, family.cases.length);
  assert.equal(family.cases.length, 5);
  assert.equal(family.tasks.H_week.publishedAt, now, 'published now: the week window starts at the local midnight of today and the start is clipped to now by the function');
});

// ------------------------------------------------------------------ the corpus-pass guards (vacuity 2 and 4): pure
test('vacuity 4a: a worker whose full detail was not captured, or a detail without an outcome, is a problem', () => {
  const outcomes = {'T-003': {workers: {fits: {}, 'does-not-fit': {}}}, 'T-006': {workers: {fits: {}}}};
  const details = {'T-003|fits': {}, 'T-003|does-not-fit': {}, 'T-006|fits': {}};
  assert.deepEqual(lib.detailCoverageProblems({outcomes, details}), []);
  const dropped = {...details}; delete dropped['T-003|does-not-fit'];
  assert.deepEqual(lib.detailCoverageProblems({outcomes, details: dropped}), ['DETAIL_NOT_CAPTURED T-003|does-not-fit']);
  assert.deepEqual(lib.detailCoverageProblems({outcomes, details: {...details, 'T-009|fits': {}}}), ['DETAIL_WITHOUT_AN_OUTCOME T-009|fits']);
});
test('vacuity 4b/4c: the product path and the narrow-fixture assumptions are problems when they do not hold', () => {
  assert.deepEqual(lib.productPathProblems([{id: 'T-003', materialisation: 'PRODUCT_PATH', degraded: false}, {id: 'T-001', materialisation: 'DIRECT', degraded: true}]), [], 'only the evidence cases are required to use the product path');
  assert.deepEqual(lib.productPathProblems([{id: 'T-006', materialisation: 'DIRECT', degraded: true}]), ['PRODUCT_PATH_NOT_USED T-006: DIRECT (degraded)']);
  const ok = {schedule_kind: 'TOMORROW_FLEXIBLE', starts_at: null, ends_at: null, published_at: '2026-10-01T10:00:00Z', task_timezone: null};
  const now = at('2026-10-01T10:05:00Z');
  assert.deepEqual(lib.narrowFixtureProblems({caseId: 'T-003', expectedKind: 'TOMORROW_FLEXIBLE', stored: ok, passNowMs: now}), []);
  assert.deepEqual(lib.narrowFixtureProblems({caseId: 'T-003', expectedKind: 'TOMORROW_FLEXIBLE', stored: {...ok, task_timezone: 'Europe/Belgrade'}, passNowMs: now}), []);
  const problem = (patch, pattern) => assert.ok(lib.narrowFixtureProblems({caseId: 'T-003', expectedKind: 'TOMORROW_FLEXIBLE', stored: {...ok, ...patch}, passNowMs: now}).some(item => pattern.test(item)), JSON.stringify(patch));
  problem({starts_at: '2026-10-02T08:00:00Z'}, /STORED_A_WINDOW/); problem({ends_at: '2026-10-02T08:00:00Z'}, /STORED_A_WINDOW/); problem({task_timezone: 'America/New_York'}, /TASK_ZONE/);
  problem({schedule_kind: 'WEEK_FLEXIBLE'}, /SCHEDULE_KIND/); problem({published_at: null}, /NOT_PUBLISHED/); problem({published_at: '2026-09-30T10:00:00Z'}, /ANCHOR_DAY_MOVED/);
  // the local day, not the UTC day: 22:30Z is already the next day in Belgrade
  assert.deepEqual(lib.narrowFixtureProblems({caseId: 'T-003', expectedKind: 'TOMORROW_FLEXIBLE', stored: {...ok, published_at: '2026-10-01T22:30:00Z'}, passNowMs: at('2026-10-01T22:45:00Z')}), []);
  assert.ok(lib.narrowFixtureProblems({caseId: 'T-003', expectedKind: 'TOMORROW_FLEXIBLE', stored: {...ok, published_at: '2026-10-01T21:50:00Z'}, passNowMs: at('2026-10-01T22:05:00Z')}).some(item => /ANCHOR_DAY_MOVED/.test(item)));
  assert.deepEqual(lib.narrowFixtureProblems({caseId: 'T-003', expectedKind: 'TOMORROW_FLEXIBLE', stored: null, passNowMs: now}), ['NARROW_FIXTURE_TASK_NOT_READ T-003']);
});
test('vacuity 2: the stored times and the rebase of two passes are compared; a different rebase or a different stored time is a problem; the clock-derived detail fields are named', () => {
  const rebase = {deltaMs: 123456};
  const a = {'T-001': {starts_at: '2026-10-12T21:50:00Z', ends_at: '2026-10-13T00:50:00Z'}, 'T-003': {starts_at: null, ends_at: null}};
  assert.deepEqual(lib.corpusTimeProblems(a, JSON.parse(JSON.stringify(a)), {referenceRebase: rebase, otherRebase: {deltaMs: 123456}}), []);
  assert.deepEqual(lib.corpusTimeProblems(a, {'T-001': {starts_at: '2026-10-12T23:50:00+02:00', ends_at: '2026-10-13T00:50:00.000Z'}}, {referenceRebase: rebase, otherRebase: rebase}), [], 'the same instants in another format');
  assert.ok(lib.corpusTimeProblems(a, a, {referenceRebase: rebase, otherRebase: {deltaMs: 123456 + lib.MINUTE}}).some(item => /^CORPUS_REBASE_DIFFERS/.test(item)));
  assert.ok(lib.corpusTimeProblems(a, {'T-001': {starts_at: '2026-10-12T22:15:00Z', ends_at: '2026-10-13T01:15:00Z'}}, {referenceRebase: rebase, otherRebase: rebase}).some(item => /^CORPUS_TIMES_DIFFER T-001 starts_at/.test(item)));
  assert.ok(lib.corpusTimeProblems(a, {'T-009': {starts_at: null, ends_at: null}}, {referenceRebase: rebase, otherRebase: rebase}).some(item => /NOT_IN_THE_REFERENCE/.test(item)));
  assert.deepEqual(lib.timesOf([{id: 'T-001', readBack: {need: {starts_at: 'x', ends_at: 'y', other: 1}}}, {id: 'T-002', readBack: {}}]), {'T-001': {starts_at: 'x', ends_at: 'y'}});
  // the clock-derived fields of match_detail (read from its body on DEV) are named; liveStateDate is among them and the strict detail comparison reports it
  assert.ok(lib.CLOCK_DERIVED_DETAIL_FIELDS.includes('liveStateDate'));
  const base = detailOf({liveStateDate: '2026-10-12'});
  assert.ok(lib.corpusDetailProblems({'T-001|fits': base}, {'T-001|fits': detailOf({liveStateDate: '2026-10-13'})}, {}).some(item => /UNINTENDED_FIELD_CHANGED liveStateDate/.test(item)), 'the comparison stays strict: nothing is normalised away');
  const body = read('supabase/proofs/ex06/ex06a_match_detail_without_calendar_dev_body.txt');
  for (const token of ['local_day := case when n.starts_at is not null then (n.starts_at at time zone tz)::date end;', "'liveStateDate', local_day,", 'd.created_at > statement_timestamp() - interval \'7 days\'']) assert.ok(body.includes(token), 'the DEV body carries the clock-derived field: ' + token);
});

// ------------------------------------------------------------------ the oracle against the real worker_available_periods with the zone parameter America/New_York (round 3)
// The New York workers of the matrix (ny_thu, ny_fri, ny_sun_late ...) are read on the NEW YORK clock. The real function takes the zone as a parameter, so the two real DEV rule sets were evaluated
// with the zone America/New_York and Europe/Belgrade over nine intervals around the New York late-publication windows (read-only SELECT on canonical DEV, 2026-10-01): 36 answers, all equal.
test('availablePeriods reproduces private.worker_available_periods as canonical DEV answered it with the zone parameter America/New_York and Europe/Belgrade (36 answers: Sunday evening, cross-midnight, 23 and 25 hour days)', () => {
  const W = {w1: REAL_WORKERS[0], w2: REAL_WORKERS[1]};
  const IV = {1: ['2027-07-08T04:00:00Z', '2027-07-09T04:00:00Z'], 2: ['2027-12-09T05:00:00Z', '2027-12-10T05:00:00Z'], 3: ['2027-07-11T04:00:00Z', '2027-07-12T04:00:00Z'], 4: ['2027-07-08T22:00:00Z', '2027-07-09T22:00:00Z'],
    5: ['2027-07-11T22:00:00Z', '2027-07-18T22:00:00Z'], 6: ['2027-07-11T22:00:00Z', '2027-07-12T08:00:00Z'], 7: ['2027-12-12T05:00:00Z', '2027-12-13T05:00:00Z'], 8: ['2027-07-09T21:30:00Z', '2027-07-09T22:30:00Z'],
    9: ['2027-07-07T22:00:00Z', '2027-07-08T22:00:00Z']};
  const p = (a, b) => [Date.parse(a.replace(' ', 'T') + 'Z'), Date.parse(b.replace(' ', 'T') + 'Z')];
  const days = (first, last, from, to) => Array.from({length: last - first + 1}, (_, i) => p(`2027-07-${String(first + i).padStart(2, '0')} ${from}`, `2027-07-${String(first + i).padStart(2, '0')} ${to}`));
  const REAL = {
    'w2:NY': {1: [p('2027-07-08 20:00:00', '2027-07-09 03:00:00')], 2: [p('2027-12-09 21:00:00', '2027-12-10 04:00:00')], 3: [p('2027-07-11 20:00:00', '2027-07-12 03:00:00')],
      4: [p('2027-07-08 22:00:00', '2027-07-09 03:00:00'), p('2027-07-09 20:00:00', '2027-07-09 22:00:00')],
      5: [p('2027-07-11 22:00:00', '2027-07-12 03:00:00'), ...days(12, 17, '20:00:00', '03:00:00').map(([a], i) => [a, Date.parse(`2027-07-${String(13 + i).padStart(2, '0')}T03:00:00Z`)]), p('2027-07-18 20:00:00', '2027-07-18 22:00:00')],
      6: [p('2027-07-11 22:00:00', '2027-07-12 03:00:00')], 7: [p('2027-12-12 21:00:00', '2027-12-13 04:00:00')], 8: [p('2027-07-09 21:30:00', '2027-07-09 22:30:00')],
      9: [p('2027-07-07 22:00:00', '2027-07-08 03:00:00'), p('2027-07-08 20:00:00', '2027-07-08 22:00:00')]},
    'w2:BEL': {1: [p('2027-07-08 14:00:00', '2027-07-08 21:00:00')], 2: [p('2027-12-09 15:00:00', '2027-12-09 22:00:00')], 3: [p('2027-07-11 14:00:00', '2027-07-11 21:00:00')], 4: [p('2027-07-09 14:00:00', '2027-07-09 21:00:00')],
      5: days(12, 18, '14:00:00', '21:00:00'), 6: [], 7: [p('2027-12-12 15:00:00', '2027-12-12 22:00:00')], 8: [], 9: [p('2027-07-08 14:00:00', '2027-07-08 21:00:00')]},
    'w1:NY': {1: [p('2027-07-08 13:00:00', '2027-07-08 21:00:00')], 2: [p('2027-12-09 14:00:00', '2027-12-09 22:00:00')], 3: [], 4: [p('2027-07-09 13:00:00', '2027-07-09 21:00:00')], 5: days(12, 16, '13:00:00', '21:00:00'),
      6: [], 7: [], 8: [], 9: [p('2027-07-08 13:00:00', '2027-07-08 21:00:00')]},
    'w1:BEL': {1: [p('2027-07-08 07:00:00', '2027-07-08 15:00:00')], 2: [p('2027-12-09 08:00:00', '2027-12-09 16:00:00')], 3: [], 4: [p('2027-07-09 07:00:00', '2027-07-09 15:00:00')], 5: days(12, 16, '07:00:00', '15:00:00'),
      6: [p('2027-07-12 07:00:00', '2027-07-12 08:00:00')], 7: [], 8: [], 9: [p('2027-07-08 07:00:00', '2027-07-08 15:00:00')]},
  };
  let compared = 0;
  for (const [key, byInterval] of Object.entries(REAL)) {
    const [worker, z] = key.split(':'), zone = z === 'NY' ? lib.NEW_YORK : lib.BELGRADE;
    for (const [n, expected] of Object.entries(byInterval)) {
      const [s, e] = IV[n].map(Date.parse);
      assert.deepEqual(lib.availablePeriods({...W[worker], zone}, s, e), expected, `${key} interval ${n}`);
      compared++;
    }
  }
  assert.equal(compared, 36);
});
