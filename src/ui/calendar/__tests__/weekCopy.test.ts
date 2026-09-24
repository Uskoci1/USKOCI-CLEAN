import type { AvailabilityRule } from '../../../contracts/workerAvailability';
import { copyDay, copyTakesAway, nightContinuation } from '../weekCopy';

// Owner step 10 (critique A18): a Monday-to-Friday week was five complete flows. Copying a day shares its slots.
const rule = (id: string, weekdays: number[], startTime: string, endTime: string, patch: Partial<AvailabilityRule> = {}): AvailabilityRule =>
  ({ id, weekdays, startTime, endTime, startsOn: '2026-09-01', endsOn: null, label: '', active: true, ...patch });

describe('copyDay', () => {
  it('shares the source day\'s rule with the targets instead of copying it', () => {
    expect(copyDay([rule('a', [1], '09:00:00', '17:00:00')], 1, [2, 3, 4, 5])).toEqual([rule('a', [1, 2, 3, 4, 5], '09:00:00', '17:00:00')]);
  });

  it('takes a target\'s own slot away from it, and keeps it on its other days', () => {
    const result = copyDay([rule('a', [1], '09:00:00', '12:00:00'), rule('b', [2, 6], '18:00:00', '20:00:00')], 1, [2]);
    expect(result).toEqual([rule('a', [1, 2], '09:00:00', '12:00:00'), rule('b', [6], '18:00:00', '20:00:00')]);
  });

  it('removes a rule that was only on the targets', () => {
    expect(copyDay([rule('a', [1], '09:00:00', '12:00:00'), rule('b', [2], '13:00:00', '15:00:00')], 1, [2]))
      .toEqual([rule('a', [1, 2], '09:00:00', '12:00:00')]);
  });

  it('is idempotent, never adds a rule, and keeps ids, dates, labels and pauses', () => {
    const week = [rule('a', [1], '09:00:00', '12:00:00', { label: 'Jutro', endsOn: '2026-12-31', active: false }), rule('b', [3], '13:00:00', '15:00:00')];
    const once = copyDay(week, 1, [2, 3]), twice = copyDay(once, 1, [2, 3]);
    expect(twice).toEqual(once);
    expect(once.length).toBeLessThanOrEqual(week.length);
    expect(once[0]).toEqual({ ...week[0], weekdays: [1, 2, 3] });
  });

  it('never makes the source its own target, and leaves the week alone with no target', () => {
    const week = [rule('a', [1], '09:00:00', '12:00:00')];
    expect(copyDay(week, 1, [1])).toEqual(week);
    expect(copyDay(week, 1, [])).toEqual(week);
  });

  it('copies the 00:00 slot a day shows, and replacing a day cuts an early slot of its own', () => {
    // Monday shows 00:00–02:00 after a Sunday 22:00–24:00 (same dates here, so they are not one saved night) and its
    // own 09:00–12:00. Tuesday has an early 00:00–03:00 with no Monday night before it.
    const week = [rule('late', [0], '22:00:00', '24:00:00'), rule('cont', [1], '00:00:00', '02:00:00'), rule('day', [1], '09:00:00', '12:00:00'),
      rule('tue', [2], '00:00:00', '03:00:00')];
    const result = copyDay(week, 1, [2]);
    // Tuesday gets both of Monday's slots, and its own 00:00–03:00 is gone.
    expect(result).toEqual([rule('late', [0], '22:00:00', '24:00:00'), rule('cont', [1, 2], '00:00:00', '02:00:00'),
      rule('day', [1, 2], '09:00:00', '12:00:00')]);
  });
});

// Review of owner step 10: a slot over midnight is saved as two rules (22:00–24:00 on its day, 00:00–06:00 on the next
// day, dated one day later). Copying the day used to delete the source's own part after midnight and give no target one.
describe('copyDay with a slot over midnight', () => {
  const night = (days: number[]) => rule('late', days, '22:00:00', '24:00:00');
  const after = (days: number[], patch: Partial<AvailabilityRule> = {}) => rule('cont', days, '00:00:00', '06:00:00', { startsOn: '2026-09-02', ...patch });
  const copied = (week: AvailabilityRule[], source: number, targets: number[]) =>
    Object.fromEntries(copyDay(week, source, targets).map(item => [item.id, item.weekdays]));

  it('copies the whole night onto every target and keeps the source\'s own part after midnight', () => {
    expect(copyDay([night([1]), after([2])], 1, [2, 3, 4, 5])).toEqual([night([1, 2, 3, 4, 5]), after([2, 3, 4, 5, 6])]);
    expect(copyTakesAway([night([1]), after([2])], 1, [2, 3, 4, 5])).toBe(false);
  });

  it('is idempotent with nights, and the week never gains a rule', () => {
    const week = [night([1]), after([2]), rule('day', [3], '09:00:00', '12:00:00')];
    const once = copyDay(week, 1, [2, 3, 4, 5]);
    expect(copyDay(once, 1, [2, 3, 4, 5])).toEqual(once);
    expect(once).toHaveLength(2);
  });

  it('never cuts the night before a target: the part after midnight stays while its night stays', () => {
    // Monday and Wednesday nights share one rule; copying Monday onto Thursday keeps Wednesday's night whole.
    expect(copied([night([1, 3]), after([2, 4])], 1, [4])).toEqual({ late: [1, 3, 4], cont: [2, 4, 5] });
    expect(copyTakesAway([night([1, 3]), after([2, 4])], 1, [4])).toBe(false);
  });

  it('takes a replaced target night\'s part after midnight with it, and asks first', () => {
    const week = [rule('day', [1], '09:00:00', '17:00:00'), rule('fri', [5], '22:00:00', '24:00:00'),
      rule('sat', [6], '00:00:00', '02:00:00', { startsOn: '2026-09-02' })];
    expect(copied(week, 1, [2, 3, 4, 5])).toEqual({ day: [1, 2, 3, 4, 5] });
    expect(copyTakesAway(week, 1, [2, 3, 4, 5])).toBe(true);
  });

  it("never changes the source day, even when its 00:00 slot ends a target's night", () => {
    const week = [night([1]), after([2]), rule('day', [2], '09:00:00', '17:00:00')];
    expect(copied(week, 2, [1, 3, 4, 5])).toEqual({ cont: [1, 2, 3, 4, 5], day: [1, 2, 3, 4, 5] });
    expect(copyTakesAway(week, 2, [1, 3, 4, 5])).toBe(true);
    const once = copyDay(week, 2, [1, 3, 4, 5]);
    expect(copyDay(once, 2, [1, 3, 4, 5])).toEqual(once);
  });

  it("finds the part after midnight of a day's own night, and nothing for a day without one", () => {
    const week = [night([1]), after([2]), rule('day', [2], '09:00:00', '17:00:00')];
    expect(nightContinuation(week, 1)?.id).toBe('cont');
    expect(nightContinuation(week, 2)).toBeUndefined();
    // An early slot that does not continue a night is not one.
    expect(nightContinuation([night([1]), after([2], { startsOn: '2026-09-01' })], 1)).toBeUndefined();
  });

  it('pairs a night only with its own continuation: the next dates, the same name and pause', () => {
    // An early slot with the same dates as the night is an ordinary Tuesday slot, and Tuesday is replaced.
    expect(copied([night([1]), after([2], { startsOn: '2026-09-01' })], 1, [2])).toEqual({ late: [1, 2] });
    expect(copied([night([1]), after([2], { label: 'Drugo' })], 1, [2])).toEqual({ late: [1, 2] });
    expect(copied([night([1]), after([2], { active: false })], 1, [2])).toEqual({ late: [1, 2] });
    // With an end date, the continuation ends one day later too.
    expect(copied([rule('late', [1], '22:00:00', '24:00:00', { endsOn: '2026-12-31' }),
      after([2], { endsOn: '2027-01-01' })], 1, [2])).toEqual({ late: [1, 2], cont: [2, 3] });
  });

  it('says a target loses its own slot only when it really does', () => {
    const week = [rule('a', [1], '09:00:00', '12:00:00'), rule('b', [3], '13:00:00', '15:00:00')];
    expect(copyTakesAway(week, 1, [2])).toBe(false);
    expect(copyTakesAway(week, 1, [2, 3])).toBe(true);
    expect(copyTakesAway(week, 1, [1])).toBe(false);
  });
});
