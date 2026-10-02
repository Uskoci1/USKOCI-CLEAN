// EX-06 S04: offline tests of the local-calendar helpers the window scenario needs (the next local day of a publication instant, a wall-clock moment as an instant, the midnight guard).
import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays, localInstantMs, midnightGuardWaitMs, tomorrowOf} from './clock.mjs';

const BG = 'Europe/Belgrade';

test('addDays moves a calendar date, across month and year ends', () => {
  assert.equal(addDays('2026-10-02', 1), '2026-10-03');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-02', 0), '2026-10-02');
});

test('localInstantMs: a Belgrade wall-clock moment as a UTC instant, in summer, in winter and on the two DST change days', () => {
  assert.equal(new Date(localInstantMs('2026-07-15', '08:00:00', BG)).toISOString(), '2026-07-15T06:00:00.000Z');
  assert.equal(new Date(localInstantMs('2026-12-15', '08:00:00', BG)).toISOString(), '2026-12-15T07:00:00.000Z');
  assert.equal(new Date(localInstantMs('2026-03-29', '00:00:00', BG)).toISOString(), '2026-03-28T23:00:00.000Z', 'midnight of the day the clock goes forward is still winter time');
  assert.equal(new Date(localInstantMs('2026-03-30', '00:00:00', BG)).toISOString(), '2026-03-29T22:00:00.000Z', 'the next midnight is summer time');
  assert.equal(new Date(localInstantMs('2026-10-25', '00:00:00', BG)).toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(new Date(localInstantMs('2026-10-26', '00:00:00', BG)).toISOString(), '2026-10-25T23:00:00.000Z');
  assert.equal(new Date(localInstantMs('2026-10-02', '18:30:15', 'America/New_York')).toISOString(), '2026-10-02T22:30:15.000Z');
});

test('tomorrowOf: the local day after the publication instant, its weekday (0 = Sunday), and its start and end as instants', () => {
  const published = Date.parse('2026-10-02T09:30:00.000Z');   // Friday 11:30 in Belgrade
  const tomorrow = tomorrowOf(published, BG);
  assert.equal(tomorrow.date, '2026-10-03');
  assert.equal(tomorrow.weekday, 6, 'Saturday');
  assert.equal(new Date(tomorrow.startMs).toISOString(), '2026-10-02T22:00:00.000Z');
  assert.equal(new Date(tomorrow.endMs).toISOString(), '2026-10-03T22:00:00.000Z');
  assert.equal(tomorrow.dayAfter.weekday, 0, 'the day after tomorrow is a Sunday');
  assert.equal(tomorrow.dayAfter.date, '2026-10-04');
  // a publication just before local midnight: the "day" is the local one, not the UTC one
  const late = tomorrowOf(Date.parse('2026-10-02T21:59:00.000Z'), BG);   // 23:59 Friday in Belgrade
  assert.equal(late.date, '2026-10-03');
  const after = tomorrowOf(Date.parse('2026-10-02T22:01:00.000Z'), BG);  // 00:01 Saturday
  assert.equal(after.date, '2026-10-04');
  // a 23 hour day (the clock goes forward) and a 25 hour day (it goes back)
  assert.equal((tomorrowOf(Date.parse('2026-03-28T10:00:00.000Z'), BG).endMs - tomorrowOf(Date.parse('2026-03-28T10:00:00.000Z'), BG).startMs) / 3600000, 23);
  assert.equal((tomorrowOf(Date.parse('2026-10-24T10:00:00.000Z'), BG).endMs - tomorrowOf(Date.parse('2026-10-24T10:00:00.000Z'), BG).startMs) / 3600000, 25);
});

test('midnightGuardWaitMs waits only when the local clock is within the guard before midnight, and then until a few minutes after it', () => {
  assert.equal(midnightGuardWaitMs(Date.parse('2026-10-02T09:30:00.000Z'), BG), 0);
  assert.equal(midnightGuardWaitMs(Date.parse('2026-10-02T21:30:00.000Z'), BG), 0, '23:30 local is outside a 12 minute guard');
  const near = Date.parse('2026-10-02T21:50:00.000Z');   // 23:50 local
  const wait = midnightGuardWaitMs(near, BG);
  assert.equal(wait, 13 * 60000, 'ten minutes to midnight plus three');
  assert.equal(midnightGuardWaitMs(near, BG, {guardMinutes: 5}), 0);
  assert.equal(midnightGuardWaitMs(Date.parse('2026-10-02T22:00:30.000Z'), BG), 0, 'just after midnight is safe');
});
