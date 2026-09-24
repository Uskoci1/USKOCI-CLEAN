import type { AvailabilityRule } from '../../../contracts/workerAvailability';
import { copyDay } from '../weekCopy';

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

  it('copies the 00:00 continuation a day shows, and replacing a day cuts the continuation it had', () => {
    // Sunday 22:00–24:00 continues Monday 00:00–02:00; Monday also has its own 09:00–12:00.
    const week = [rule('late', [0], '22:00:00', '24:00:00'), rule('cont', [1], '00:00:00', '02:00:00'), rule('day', [1], '09:00:00', '12:00:00'),
      rule('tue', [2], '00:00:00', '03:00:00')];
    const result = copyDay(week, 1, [2]);
    // Tuesday gets both of Monday's slots, and its own 00:00–03:00 (a Monday night's continuation) is gone.
    expect(result).toEqual([rule('late', [0], '22:00:00', '24:00:00'), rule('cont', [1, 2], '00:00:00', '02:00:00'),
      rule('day', [1, 2], '09:00:00', '12:00:00')]);
  });
});
