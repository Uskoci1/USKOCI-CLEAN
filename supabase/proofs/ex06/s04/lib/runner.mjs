// EX-06 S04: the scenario runner. Each scenario runs in isolation: its own marks, its own evidence, and a cleanup that ALWAYS runs (the tasks it created are cancelled and leave the schedule, its
// workers are suspended), so that one scenario can neither crowd the next nor leave a task that a later worker write would requeue into a later tick. A failing scenario is data, not an
// exception: it becomes {status: 'HARNESS_ERROR', error}, its cases are NOT_RUN and the run goes on with the next one.
import {ABORT_PATTERN} from '../../lib/fixtures.mjs';

/**
 * Runs the scenarios in order. ctx = the seams (fx, db, api) and helpers; only = a list of scenario ids to run (a focused re-run; the others are not run and the caller marks them SKIPPED).
 * Returns [{id, title, optional, status, obs, error, abort, evidence, cleanupError, durationMs}].
 */
export async function runScenarios(ctx, scenarios, {say = ctx.say ?? (() => {}), only = null, now = () => Date.now(), onResult = () => {}} = {}) {
  const results = [];
  for (const scenario of scenarios) {
    if (only && !only.includes(scenario.id)) continue;
    const started = now();
    const evidence = [];
    const scoped = {...ctx, evidence: (label, data) => evidence.push({label, data})};
    const since = ctx.fx.mark();
    const entry = {id: scenario.id, title: scenario.title, optional: scenario.optional === true, status: 'OK', obs: null, error: null, abort: false, evidence, cleanupError: null, durationMs: 0};
    try {
      entry.obs = await scenario.run(scoped);
      say(`PASS scenario ${scenario.id}`);
    } catch (error) {
      entry.status = 'HARNESS_ERROR';
      entry.error = String(error?.message ?? error).slice(0, 600);
      entry.abort = ABORT_PATTERN.test(entry.error);
      say(`${entry.optional ? 'OPTIONAL_' : ''}HARNESS_ERROR scenario ${scenario.id}: ${entry.error}`);
    } finally {
      try {
        ctx.db.retireNeeds(ctx.fx.created.needs.slice(since.needs));
        ctx.fx.retireSince(since);
      } catch (error) {
        entry.cleanupError = String(error?.message ?? error).slice(0, 300);
      }
      entry.durationMs = now() - started;
    }
    results.push(entry);
    onResult(entry);
  }
  return results;
}

/** {scenarioId: {status, obs, error}}: the shape judgeCase reads. */
export const scenarioMap = results => Object.fromEntries(results.map(item => [item.id, {status: item.status, obs: item.obs, error: item.error}]));
