import type { AvailabilityRule } from '../../contracts/workerAvailability';

/**
 * Copy one day of the regular week onto other days (round-1 critique A18: a Monday-to-Friday week took five complete
 * flows). The target days end up with exactly the slots the source day shows, and nothing else:
 *
 * - every rule loses the target days (a slot that was the target's own is gone from it);
 * - every rule that holds the source day gains the target days (the same slot, shared, not a copy);
 * - a rule left with no day at all is removed.
 *
 * Ids, dates, labels and the active flag are kept, so no rule is invented and the number of rules never grows. The
 * source day itself is never a target. Applying the same copy twice gives the same week.
 *
 * What a day shows includes the 00:00 continuation of the night before (an overnight slot is stored as two rules on
 * adjacent days), so that continuation is copied with it, and replacing a target day removes the continuation that
 * belonged to the target's own previous night. The sheet and the confirmation say that the target's slots are replaced.
 */
export function copyDay(rules: readonly AvailabilityRule[], source: number, targets: readonly number[]): AvailabilityRule[] {
  const into = [...new Set(targets)].filter(day => day !== source);
  if (!into.length) return [...rules];
  return rules.flatMap(rule => {
    const kept = rule.weekdays.filter(day => !into.includes(day));
    const days = rule.weekdays.includes(source) ? [...kept, ...into] : kept;
    if (!days.length) return [];
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    return [sorted.length === rule.weekdays.length && sorted.every((day, index) => day === rule.weekdays[index])
      ? rule : { ...rule, weekdays: sorted }];
  });
}
