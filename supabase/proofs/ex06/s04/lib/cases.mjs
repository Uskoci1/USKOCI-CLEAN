// EX-06 S04: the case and probe catalogue of the dispatch-lifecycle proof, and the findings it may raise. Pure data and pure evaluators (no database): scenarios.mjs produces the
// observations described below, judge.mjs decides, report.mjs renders.
//
// WHAT A CASE SAYS. `requirement` is the canonical requirement (plan 12.5 and 12.6, owner 21/21 row D-0114, W06 backend_work, runbook P5): what the product SHOULD do. `expect` states it as
// observable facts. When the product, read from its DEV bodies (md5-pinned), does something else, the case is a FINDING with an id (F5 ...) and a proposed fix as TEXT; nothing here changes a
// function body. A `documented` contract is a divergence the owner already knows (the S03 scope record, conflict 3): it is reported, never counted as a defect.
//
// THE OBSERVATIONS (the contract between scenarios.mjs and this file; reference_obs.mjs builds them by hand for the tests).
//   WorkerObs  {label, accountId, profileId, match: {responseAllowed, dispatchEligible, hardBlockers, dispatchBlockers, score}|null, cheap: boolean|null,
//               deliveries: [{round, status, score, expiresAt}], events: [{id, dedupeKey, entityVersion, urgency}], notifications: [{channel, state, suppressionReason, expiresAt}],
//               inboxListed: boolean|null, inboxError: string|null, cause: {observed: boolean, detail: string}}
//   WaveObs    {task: {needId, revision, scheduleKind}, waves: [{status, reason, inserted, batchSize, round, policyWaveNo}], rounds: [{round_no, status, stop_reason, batch_size}], workers: {label: WorkerObs}}
//   (the other scenarios: see the evaluators below and reference_obs.mjs)
import {eq, row, workerFacts} from './judge.mjs';

export const SCENARIO_IDS = Object.freeze(['reach', 'licence', 'worldReverse', 'capacity', 'target', 'calendar', 'window', 'waves', 'ticks', 'expiry', 'cancel', 'fill', 'search', 'revision',
  'requeue', 'resolver', 'push']);

/** The findings the proof may raise. A finding is raised only by a run (a case that is a FINDING, a probe whose requirement is NOT_MET); this is the text that goes with its id. */
export const FINDINGS = Object.freeze({
  F5: {title: 'A worker who already applied to a task is still sent the opportunity notification', severity: 'major', ownerDecision: false,
    summary: 'private.dispatch_cheap_candidate_admitted refuses a worker only when an opportunity_deliveries row exists for (worker, task, revision); a manual application made from Discovery creates no delivery row, so the next wave admits the worker and sends "Nova prilika" for a task they already applied to.',
    proposedFix: 'Add to private.dispatch_cheap_candidate_admitted a clause `and not exists (select 1 from public.marketplace_responses r where r.need_id = n.id and r.worker_account_id = p.account_id and r.status in (\'DRAFT\',\'SUBMITTED\',\'DELIVERED\',\'VIEWED\',\'SHORTLISTED\',\'SELECTED\'))`. A function-body candidate (EX-04 template: exact pin of the body md5 0132fae3, exact revert, read-only postflight, disposable proof fail-before/pass-after); the function is not in the certified closure list (to be asserted at candidate time); any raise it adds uses PT409, never 40001.'},
  F6: {title: 'A blocked, closing or opted-out worker takes a wave slot', severity: 'minor', ownerDecision: false,
    summary: 'match_detail and the candidate gate have no block, closure or notification-preference gate: the delivery row is inserted (a slot of the wave is spent) and only the notification rows are suppressed afterwards by the triggers safety_guard_delivery and closure_guard_delivery (ACCOUNT_BLOCKED, ACCOUNT_CLOSING) or by emit_event (CATEGORY_OFF). Reachable workers behind them wait for the next wave (one window, 15 minutes).',
    proposedFix: 'Filter such candidates before the insert: in private.dispatch_cheap_candidate_admitted add `and not private.safety_pair_blocked(n.requester_account_id, p.account_id) and not private.closure_account_restricted(p.account_id)`; the category opt-out needs the WORKER role preferences row (opportunities_enabled) read in the same function. Pin the body md5 0132fae3; keep PT409.'},
  F7: {title: 'Push enabled for the other role is created as CREATED at emit time and suppressed as PUSH_OFF at claim time', severity: 'minor', ownerDecision: true,
    summary: 'private.emit_event gives a role without its own preferences row the push choice of the account\'s other role (PKG-029a); private.push_suppression, which the claim uses, looks the exact role up and answers PUSH_OFF. The inheritance of PKG-029a is therefore undone at send time; the person gets no push although the emit-time row said CREATED.',
    proposedFix: 'One rule in both places. Either private.push_suppression takes the same fallback as emit_event (a role without a row inherits the other role\'s push_enabled), or emit_event stops inheriting. Owner decision (PKG-029a intent versus exact-role semantics); pins emit_event 67413eff and push_suppression 0e027760; both are function-body changes.'},
  F8: {title: 'Quiet hours suppress a push permanently; there is no deferral', severity: 'minor', ownerDecision: true,
    summary: 'A push that meets quiet hours at emit time is created SUPPRESSED/QUIET_HOURS, one that meets them at claim time becomes SUPPRESSED/QUIET_HOURS; no state or timer sends it later. The owner row D-0114 ("a delayed push must re-read the current entity and eligibility") has nothing to attach to.',
    proposedFix: 'Design only: a deferral needs a new delivery state or a not-before time (notification_deliveries.state is a CHECK list; whether the table is in the certified closure list must be asserted first), plus the re-read of F9 at send time. Owner decision: should a quiet-hours push be deferred at all.'},
  F9: {title: 'No send-time re-read of the task or of the worker; pending notification rows survive a fill and a closed search', severity: 'minor', ownerDecision: false,
    summary: 'private.push_suppression reads preferences, closure and block, never the task or the worker\'s eligibility: a PUSH row of a worker who became ineligible, or of a task that was filled, still passes the gate (the claim then needs only a device). rpc_cancel_need and expire_lifecycle close the pending rows, rpc_select_response (fill) and rpc_close_remaining_search do not: the IN_APP and PUSH rows stay CREATED until their own deadline (PUSH) or for ever (IN_APP).',
    proposedFix: 'Two function-body changes: (1) private.push_suppression adds, for an OPPORTUNITY_AVAILABLE event, a re-read `exists (select 1 from public.needs n where n.id = e.entity_id and n.status in (\'PUBLISHED\',\'SELECTION\') and n.remaining_search_closed_at is null)` and the worker\'s ACTIVE profile, answering NEED_NOT_OPEN / WORKER_NOT_ELIGIBLE; (2) rpc_select_response and rpc_close_remaining_search expire the pending opportunity notification rows of the task as rpc_cancel_need does (pins 0e027760, 7cbb8390, 39fa8301).'},
  F10: {title: 'A task whose remaining search is closed fails every tick, for ever, after an agreement cancellation', severity: 'major', ownerDecision: false,
    summary: 'rpc_cancel_agreement re-enqueues the task without looking at remaining_search_closed_at; the next wave then raises NEED_REMAINING_SEARCH_CLOSED from the trigger guard_closed_remaining_search_delivery on the first insert, dispatch_tick records ERROR and retries in ten minutes, again and again, until the task expires (a FLEXIBLE task never does).',
    proposedFix: 'private.dispatch_next_wave returns STOPPED / REMAINING_SEARCH_CLOSED when n.remaining_search_closed_at is not null and private.dispatch_tick dequeues on that reason (add it to the list with SLOTS_FILLED and NEED_NOT_OPEN); or rpc_cancel_agreement skips the enqueue for a closed search. Pins 1fd8c51e and e568b033 (or f3ca4d5f); a deterministic conflict stays PT409.'},
  F11: {title: 'A manual edit of skills, tools, vehicles or licences does not requeue the open tasks', severity: 'minor', ownerDecision: true,
    summary: 'Only rpc_complete_worker_profile, rpc_save_worker_availability, rpc_save_worker_location and rpc_save_worker_capacity call private.requeue_open_needs_for_worker_v5. The owner UPDATE of the four lists is a plain app_profiles update: a task that found nobody waits for its backoff (5 minutes, growing to 6 hours) before the changed worker is looked at.',
    proposedFix: 'A trigger on app_profiles (UPDATE OF skills, tools, vehicles, licenses, exclusions) calling private.requeue_open_needs_for_worker_v5: a TRIGGER function moves the closure certificate (owner recertification and a compatible APK); the alternative is a small service RPC the profile editor calls after saving. Owner decision.'},
  F12: {title: 'The Inbox opens an opportunity the worker can no longer act on', severity: 'minor', ownerDecision: false,
    summary: 'rpc_resolve_activity_event answers OPPORTUNITY for any NEED event whose task row the worker may read; only a task that left the open statuses is hidden by RLS (UNAVAILABLE). A worker who became ineligible, or who already applied, is sent to the opportunity screen without any eligibility or application re-check.',
    proposedFix: 'In rpc_resolve_activity_event, for entity_type NEED and a non-owner, return UNAVAILABLE when private.match_detail(need, worker profile) has responseAllowed false, and APPLICATIONS (the existing target) when the worker already has an application. Pin e5dc0577; the function is SECURITY INVOKER, keep it so.'},
});

const reachWorker = (id, worker, title, requirement, cause, expect, extra = {}) => ({id, kind: 'WORKER', scenario: 'reach', worker, title, requirement, cause: {text: cause}, expect, ...extra});
const REQ_REACH = 'Plan 12.5 / runbook P5: a dispatched wave never reaches a worker who cannot or must not be notified; the person sees no opportunity in the Inbox.';
const NOT_REACHED = {reached: false};
const NOT_DELIVERED = {delivered: false, reached: false};

const control = (id, scenario, worker, title) => ({id, kind: 'WORKER', scenario, worker, title, requirement: 'Control: an eligible worker IS reached, so that the negatives of this scenario cannot pass because the pipeline delivers nothing.', control: true,
  expect: {delivered: true, reached: true}});

// ---------------------------------------------------------------------------------------------- the checks of the lifecycle and the waves
const pendingCount = (pending, states = ['CREATED', 'QUEUED', 'FAILED_RETRYABLE']) => (pending ?? []).filter(item => states.includes(item.state)).reduce((sum, item) => sum + item.n, 0);
const openRounds = rounds => (rounds ?? []).filter(item => ['PLANNED', 'SENT'].includes(item.status)).length;

function closedTaskRows(obs, {status, stopReason}) {
  const after = obs.after, before = obs.before;
  return [
    pre('the wave reached workers before the task closed', true, (before.deliveries.READY ?? 0) > 0),
    pre('pending IN_APP and PUSH rows existed before (the workers have push on)', true, pendingCount(before.pending) >= 2),
    row('the task status', status, after.needStatus),
    row('no round is still PLANNED or SENT', 0, openRounds(after.rounds)),
    row('the SENT round was stopped with the reason', stopReason, after.rounds.find(item => item.round_no === 1)?.stop_reason ?? null),
    row('no delivery is still READY or SEEN', 0, (after.deliveries.READY ?? 0) + (after.deliveries.SEEN ?? 0)),
    row('no IN_APP or PUSH row of the opportunity events is still pending (all EXPIRED)', 0, pendingCount(after.pending)),
    row('the schedule row is gone', false, after.schedule.queued),
    row('a wave called directly sends nothing: STOPPED / NEED_NOT_OPEN / 0', {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0}, {status: obs.waveAfter.status, reason: obs.waveAfter.reason, inserted: obs.waveAfter.inserted}),
    row('a tick does not bring the task back into the queue', false, obs.tickAfter.scheduleQueued),
    row('a worker write that requeues the open tasks does not enqueue it', false, obs.requeue.scheduleQueued),
    row('a worker who becomes eligible afterwards gets no delivery and no event', {deliveries: 0, events: 0}, {deliveries: obs.lateWorker.deliveries, events: obs.lateWorker.events}),
  ];
}

const sizesOf = obs => obs.config.waveSizes;
/** A row about what the SCENARIO built (not about the product): when it fails the check is a harness error, never a finding. */
const pre = (field, expected, actual) => row('precondition: ' + field, expected, actual, {kind: 'PRECONDITION'});

export const CASES = Object.freeze([
  // ============================================================================ REACH: one task, many workers, waves until the dispatch stops
  control('R00a', 'reach', 'control-a', 'an eligible worker (A) is reached'),
  control('R00b', 'reach', 'control-b', 'an eligible worker (B) is reached'),
  reachWorker('R01', 'paused', 'a worker with paused availability', REQ_REACH, 'match_detail dispatchBlockers include CURRENT_AVAILABILITY_PAUSED', NOT_DELIVERED),
  reachWorker('R02', 'draft', 'a worker whose profile is not ACTIVE (DRAFT)', REQ_REACH, 'match_detail hardBlockers include ACCOUNT_OR_PROFILE_RESTRICTED (profile_status DRAFT)', NOT_DELIVERED),
  reachWorker('R03', 'suspended', 'a worker whose profile is SUSPENDED', REQ_REACH, 'profile_status SUSPENDED and hardBlockers include ACCOUNT_OR_PROFILE_RESTRICTED', NOT_DELIVERED),
  reachWorker('R04', 'closed-profile', 'a worker whose profile is CLOSED', REQ_REACH, 'profile_status CLOSED and hardBlockers include ACCOUNT_OR_PROFILE_RESTRICTED', NOT_DELIVERED),
  reachWorker('R05', 'test-world', 'a TEST-world worker of a REAL requester (outside the world)', REQ_REACH, 'private.account_visibility_world says TEST for the worker and REAL for the requester; the candidate gate refuses', NOT_DELIVERED),
  reachWorker('R06', 'proactive-off', 'a worker who turned proactive notifications off', REQ_REACH, 'match_detail dispatchBlockers include PROACTIVE_NOTIFICATIONS_PAUSED', NOT_DELIVERED),
  reachWorker('R07', 'requester-self', 'the requester themself (the same account has a worker profile)', REQ_REACH, 'match_detail hardBlockers include OWN_NEED', NOT_DELIVERED),
  reachWorker('R08', 'other-kind', 'a worker whose profile has another hidden work kind', REQ_REACH, 'match_detail dispatchBlockers include SERVICE_NOT_IN_WORK_PROFILE and the candidate gate refuses', NOT_DELIVERED),
  reachWorker('R09', 'excluded', 'a worker who excluded the task\'s work kind', REQ_REACH, 'match_detail hardBlockers include PROFILE_EXCLUSION', NOT_DELIVERED),
  reachWorker('R10', 'far', 'a worker outside the preferred radius (another city)', REQ_REACH, 'match_detail dispatchBlockers include OUTSIDE_PREFERRED_RADIUS', NOT_DELIVERED),
  reachWorker('R11', 'blocked-by-worker', 'a worker who blocked the requester', REQ_REACH, 'private.safety_pair_blocked is true (the worker is the blocker)', NOT_REACHED),
  reachWorker('R12', 'blocked-by-requester', 'a worker the requester blocked', REQ_REACH, 'private.safety_pair_blocked is true (the requester is the blocker)', NOT_REACHED),
  reachWorker('R13', 'closure', 'a worker under a closure restriction', REQ_REACH, 'private.closure_account_restricted is true (a closure request in READY)', NOT_REACHED),
  reachWorker('R14', 'applied', 'a worker who already applied to the task', REQ_REACH + ' (a worker who already acted needs no "new opportunity")', 'a SUBMITTED application of the worker exists for the current revision and no delivery row existed before the wave', NOT_REACHED,
    {findingId: 'F5'}),
  reachWorker('R15', 'opportunities-off', 'a worker who switched the opportunities category off', REQ_REACH, 'the WORKER notification preferences say opportunities_enabled = false', NOT_REACHED),

  // ============================================================================ resources (a licence, a tool)
  {id: 'L00', kind: 'WORKER', scenario: 'licence', worker: 'equipped', title: 'a worker with the required licence and tool is reached', requirement: 'Control.', control: true, expect: {delivered: true, reached: true}},
  {id: 'L01', kind: 'WORKER', scenario: 'licence', worker: 'unlicensed', title: 'a worker without the licence the task\'s work kind needs', requirement: REQ_REACH, cause: {text: 'match_detail hardBlockers include MISSING_REQUIRED_LICENSE'}, expect: NOT_DELIVERED},
  {id: 'L02', kind: 'WORKER', scenario: 'licence', worker: 'untooled', title: 'a worker without the required tool', requirement: REQ_REACH, cause: {text: 'match_detail hardBlockers include MISSING_REQUIRED_TOOL'}, expect: NOT_DELIVERED},

  // ============================================================================ the world, the other way round
  {id: 'V00', kind: 'WORKER', scenario: 'worldReverse', worker: 'test-worker', title: 'a TEST-world worker of a TEST-world requester is reached', requirement: 'Control.', control: true, expect: {delivered: true, reached: true}},
  {id: 'V01', kind: 'WORKER', scenario: 'worldReverse', worker: 'real-worker', title: 'a REAL-world worker of a TEST-world requester (outside the world)', requirement: REQ_REACH, cause: {text: 'private.account_visibility_world says REAL for the worker and TEST for the requester'}, expect: NOT_DELIVERED},

  // ============================================================================ capacity (three readings)
  {id: 'C00', kind: 'WORKER', scenario: 'capacity', worker: 'cap-high', title: 'a worker whose team capacity covers the people needed is reached', requirement: 'Control.', control: true, expect: {delivered: true, reached: true}},
  {id: 'C01', kind: 'WORKER', scenario: 'capacity', worker: 'cap-low', title: 'a worker whose team capacity is below the people the task needs', requirement: 'Plan 12.4 lists capacity among the hard exclusions; the shipped design checks it when applying and selecting (S03 scope record, conflict 3, section 10: changing the class of a gate is an owner-visible product change).',
    cause: {text: 'the worker\'s team_capacity (1) is below the task\'s required slots (3)'}, expect: NOT_DELIVERED,
    documented: {text: 'capacity is enforced at application time (TEAM_CAPACITY_EXCEEDED), not by the matcher or the candidate gate: the worker is delivered and may still apply for the slots the team can cover', expect: {delivered: true, reached: true}}},
  {id: 'C02', kind: 'CHECK', scenario: 'capacity', title: 'the application gate refuses a coverage above the team capacity', requirement: 'The documented substitute of C01: rpc_submit_response raises TEAM_CAPACITY_EXCEEDED when covered slots exceed the team capacity.',
    evaluate: obs => [row('the application of the low-capacity worker covering all three slots is refused', true, obs.application.ok === false), row('the refusal is TEAM_CAPACITY_EXCEEDED', true, /TEAM_CAPACITY_EXCEEDED/.test(obs.application.message ?? ''))]},
  {id: 'C03', kind: 'CHECK', scenario: 'target', title: 'once enough applications cover the task, a further wave sends nothing (the task\'s response capacity)', requirement: 'Plan 12.5: no more opportunity notifications once the task has what it needs (the target of three responses and the coverage of the remaining slots).',
    evaluate: obs => [
      pre('three applications were submitted (the dispatch target)', 3, obs.applications),
      row('the wave stops: STOPPED / RESPONSE_TARGET_AND_COVERAGE_REACHED / 0', {status: 'STOPPED', reason: 'RESPONSE_TARGET_AND_COVERAGE_REACHED', inserted: 0}, {status: obs.wave.status, reason: obs.wave.reason, inserted: obs.wave.inserted}),
      row('the eligible worker who had not applied gets no delivery and no event', {deliveries: 0, events: 0}, {deliveries: obs.lateWorker.deliveries, events: obs.lateWorker.events}),
      row('the tick takes the task out of the queue', false, obs.scheduleAfterTick.queued)]},
  {id: 'C04', kind: 'WORKER', scenario: 'calendar', worker: 'free', title: 'a worker with a free calendar is reached', requirement: 'Control.', control: true, expect: {delivered: true, reached: true}},
  {id: 'C05', kind: 'WORKER', scenario: 'calendar', worker: 'busy', title: 'a worker whose calendar is blocked by an agreement over the task window', requirement: REQ_REACH, cause: {text: 'match_detail hardBlockers include CALENDAR_CONFLICT (an agreement blocks the window)'}, expect: NOT_DELIVERED},

  // ============================================================================ the task window, incl. the ex06a derived window for "sutra" and "ove nedelje"
  {id: 'Z00a', kind: 'WORKER', scenario: 'window', worker: 'tomorrow/sched-only', pick: obs => obs.tomorrow?.workers?.['sched-only'], title: 'TOMORROW_FLEXIBLE without a stored window: a worker with real available time tomorrow is reached', requirement: 'Control (the ex06a derived window: the next local day).', control: true, expect: {delivered: true, reached: true}},
  {id: 'Z01', kind: 'WORKER', scenario: 'window', worker: 'tomorrow/live-only', pick: obs => obs.tomorrow?.workers?.['live-only'], title: 'TOMORROW_FLEXIBLE: a worker who is only available right now (live intent, no schedule)', requirement: REQ_REACH + ' Live intent alone is not availability tomorrow (ex06a decision D1).', cause: {text: 'match_detail dispatchBlockers include OUTSIDE_AVAILABILITY'}, expect: NOT_DELIVERED},
  {id: 'Z02', kind: 'WORKER', scenario: 'window', worker: 'tomorrow/other-day', pick: obs => obs.tomorrow?.workers?.['other-day'], title: 'TOMORROW_FLEXIBLE: a worker whose weekly schedule covers another weekday', requirement: REQ_REACH, cause: {text: 'match_detail dispatchBlockers include OUTSIDE_AVAILABILITY'}, expect: NOT_DELIVERED},
  {id: 'Z03', kind: 'WORKER', scenario: 'window', worker: 'tomorrow/blocked-window', pick: obs => obs.tomorrow?.workers?.['blocked-window'], title: 'TOMORROW_FLEXIBLE: a worker with an UNAVAILABLE exception over the whole day', requirement: REQ_REACH, cause: {text: 'match_detail dispatchBlockers include OUTSIDE_AVAILABILITY'}, expect: NOT_DELIVERED},
  {id: 'Z04a', kind: 'WORKER', scenario: 'window', worker: 'week/all-days', pick: obs => obs.week?.workers?.['all-days'], title: 'WEEK_FLEXIBLE without a stored window: a worker with a weekly schedule on every day is reached', requirement: 'Control (the ex06a derived window: the rest of the local week).', control: true, expect: {delivered: true, reached: true}},
  {id: 'Z04', kind: 'WORKER', scenario: 'window', worker: 'week/live-only', pick: obs => obs.week?.workers?.['live-only'], title: 'WEEK_FLEXIBLE: a worker who is only available right now', requirement: REQ_REACH, cause: {text: 'match_detail dispatchBlockers include OUTSIDE_AVAILABILITY'}, expect: NOT_DELIVERED},
  {id: 'Z05a', kind: 'WORKER', scenario: 'window', worker: 'fixed/covering', pick: obs => obs.fixed?.workers?.covering, title: 'FIXED_WINDOW: a worker whose availability covers the window is reached', requirement: 'Control.', control: true, expect: {delivered: true, reached: true}},
  {id: 'Z05', kind: 'WORKER', scenario: 'window', worker: 'fixed/no-cover', pick: obs => obs.fixed?.workers?.['no-cover'], title: 'FIXED_WINDOW: a worker available now but with nothing over the window', requirement: REQ_REACH, cause: {text: 'match_detail dispatchBlockers include OUTSIDE_AVAILABILITY'}, expect: NOT_DELIVERED},

  // ============================================================================ the waves: order, size, no duplicate, events once
  {id: 'W01', kind: 'CHECK', scenario: 'waves', title: 'wave order: each wave reaches exactly the best-scored eligible workers (ties by profile id)', requirement: 'Plan 12.4 / W06: bounded, explainable ranking: the wave takes the top of the matcher\'s own ranking.',
    evaluate: obs => [
      row('the eligible workers read from the matcher before the waves', obs.config.expectedEligible, obs.eligible.length),
      ...obs.expected.map((ids, index) => row(`wave ${index + 1} reached exactly the top ${ids.length} by (score desc, profile id)`, ids, obs.actual[index] ?? [])),
      row('no wave beyond the expected ones inserted a delivery', 0, obs.actual.slice(obs.expected.length).flat().length)]},
  {id: 'W02', kind: 'CHECK', scenario: 'waves', title: 'wave size: the configured sizes bound each wave; the wave after the last eligible worker stops', requirement: 'Plan 12.5: waves are bounded by the configured sizes (dispatch_normal waveSizes) and a check that found nobody reached nobody.',
    evaluate: obs => {
      const sizes = sizesOf(obs), sent = obs.waves.filter(item => item.status === 'SENT'), last = obs.waves.at(-1);
      return [
        ...sent.flatMap((item, index) => [row(`wave ${index + 1} batch size is the configured size`, sizes[index], item.batchSize),
          row(`wave ${index + 1} inserted at most its batch (and exactly the eligible workers left)`, Math.min(sizes[index], obs.expected[index]?.length ?? 0), item.inserted)]),
        row('the last call is STOPPED with nothing inserted', {status: 'STOPPED', inserted: 0}, {status: last.status, inserted: last.inserted}),
        row('it carries no reason key (the reason lives in the round row)', true, last.reason === null || last.reason === undefined),
        row('the round row says NO_ELIGIBLE_CANDIDATES', 'NO_ELIGIBLE_CANDIDATES', obs.rounds.at(-1)?.stop_reason ?? null),
        row('the stopped check does not use up a policy wave', sent.length + 1, last.policyWaveNo)];
    }},
  {id: 'W03', kind: 'CHECK', scenario: 'waves', title: 'no worker is reached twice across the waves', requirement: 'Plan 12.5: never the same opportunity twice to the same person.',
    evaluate: obs => [row('deliveries equal eligible workers', obs.eligible.length, obs.totals.deliveries), row('distinct workers equal deliveries', obs.totals.deliveries, obs.totals.distinctWorkers),
      row('every worker has exactly one delivery row', true, Object.values(obs.perWorker).every(item => item.rounds.length === 1))]},
  {id: 'W04', kind: 'CHECK', scenario: 'waves', title: 'one event, one IN_APP row and one PUSH row per delivery, with the documented dedupe key', requirement: 'Event/outbox contract: durable event idempotent on its dedupe key (opp:<task>:<revision>:<account>), IN_APP and PUSH rows once; the push sender is disabled and nothing is sent.',
    evaluate: obs => [row('events equal deliveries', obs.totals.deliveries, obs.totals.events), row('IN_APP rows equal deliveries', obs.totals.deliveries, obs.totals.inAppRows), row('PUSH rows equal deliveries', obs.totals.deliveries, obs.totals.pushRows),
      row('every IN_APP row is CREATED (visible) and every PUSH row SUPPRESSED/PUSH_OFF (no preference row: push is off by default)', true,
        Object.values(obs.perWorker).every(item => eq(item.inApp, ['CREATED']) && eq(item.push, ['SUPPRESSED:PUSH_OFF']))),
      row('every dedupe key is opp:<task>:<revision>:<account>', true, Object.values(obs.perWorker).every(item => item.dedupeKey === item.expectedDedupeKey)),
      row('every event carries the task revision as its entity version', true, Object.values(obs.perWorker).every(item => item.entityVersion === obs.task.revision))]},
  {id: 'W05', kind: 'CHECK', scenario: 'waves', title: 'a repeated wave and a replayed emit create nothing', requirement: 'Plan 12.6 Dispatch row: a repeated cron never spams the same person; emit_event is idempotent on its dedupe key.',
    evaluate: obs => [row('a wave called again after the last eligible worker stops with nothing', 'STOPPED', obs.replay.waveStatus), row('deliveries unchanged', obs.replay.deliveriesBefore, obs.replay.deliveriesAfter),
      row('events unchanged', obs.replay.eventsBefore, obs.replay.eventsAfter), row('the replayed emit_event returns NULL (already emitted)', true, obs.eventReplay.nilReturned),
      row('and adds no event', obs.eventReplay.eventsBefore, obs.eventReplay.eventsAfter)]},
  {id: 'W06', kind: 'CHECK', scenario: 'waves', title: 'the database itself refuses a second delivery for the same (worker, task, revision)', requirement: 'The once-per-revision unique constraint is the last line against a duplicate.',
    evaluate: obs => [row('the plain insert is refused by the unique constraint', true, obs.duplicateInsert.refused), row('and names opportunity_deliveries_once_per_revision_uq', true, /opportunity_deliveries_once_per_revision_uq/.test(obs.duplicateInsert.message ?? '')),
      row('the wave\'s own insert (on conflict do nothing) adds no row', 0, obs.duplicateInsert.onConflictRows)]},

  // ============================================================================ the tick: idempotent re-dispatch, requeue, expiry of a window, reclassification
  {id: 'I01', kind: 'CHECK', scenario: 'ticks', title: 'a second tick creates nothing', requirement: 'Plan 12.6: a repeated cron does not spam the same person.',
    evaluate: obs => {
      const s1 = obs.steps.s1, s2 = obs.steps.s2, s3 = obs.steps.s3;
      return [pre('exactly this task was due at the first tick', 1, s1.dueBefore), row('the first tick ran one wave and sent', {processed: 1, sent: 1, failed: 0}, {processed: s1.tick.processed, sent: s1.tick.sent, failed: s1.tick.failed}),
        row('nothing is due at the second tick (the next run is the window deadline)', 0, s2.dueBefore), row('the second tick processed nothing', 0, s2.tick.processed),
        row('deliveries and events are unchanged after the second tick', {deliveries: s1.counts.deliveries, events: s1.counts.events}, {deliveries: s2.counts.deliveries, events: s2.counts.events}),
        row('and after a third tick a minute later', {deliveries: s1.counts.deliveries, events: s1.counts.events}, {deliveries: s3.counts.deliveries, events: s3.counts.events})];
    }},
  {id: 'I02', kind: 'CHECK', scenario: 'ticks', title: 'a requeue (a worker write) creates no duplicate delivery or event', requirement: 'Plan 12.6: a requeue never sends the same opportunity twice.',
    evaluate: obs => {
      const s1 = obs.steps.s1, s4 = obs.steps.s4;
      return [pre('the worker write made the task due again', 1, s4.dueBefore), row('the tick that followed sent nothing', {sent: 0, stopped: 1}, {sent: s4.tick.sent, stopped: s4.tick.stopped}),
        row('deliveries and events are unchanged', {deliveries: s1.counts.deliveries, events: s1.counts.events}, {deliveries: s4.counts.deliveries, events: s4.counts.events}),
        row('the empty check is recorded as a stopped round (it uses up no wave)', 'NO_ELIGIBLE_CANDIDATES', s4.rounds.at(-1)?.stop_reason ?? null),
        row('and the schedule backs off (attempts 1)', 1, s4.schedule.attempts)];
    }},
  {id: 'I03', kind: 'CHECK', scenario: 'ticks', title: 'a delivery that expired is never re-sent for the same revision', requirement: 'Plan 12.5: the same revision is never notified twice, even after its window closed.',
    evaluate: obs => {
      const s5 = obs.steps.s5, s6 = obs.steps.s6;
      return [row('after the window the deliveries are EXPIRED', 0, s6.deliveryStatuses.READY ?? 0), row('no delivery was added', s5.counts.deliveries, s6.counts.deliveries), row('no event was added', s5.counts.events, s6.counts.events),
        row('the tick after the expiry found nobody new', 0, s6.tick.sent)];
    }},
  {id: 'I04', kind: 'CHECK', scenario: 'ticks', title: 'a worker who becomes eligible later is reached exactly once and the earlier workers are not repeated', requirement: 'Plan 12.5 / PKG-027a: the dispatch keeps looking, without repeating anybody.',
    evaluate: obs => {
      const s4 = obs.steps.s4, s5 = obs.steps.s5;
      return [row('the new worker is reached by the next wave', {sent: 1, deliveries: s4.counts.deliveries + 1, events: s4.counts.events + 1}, {sent: s5.tick.sent, deliveries: s5.counts.deliveries, events: s5.counts.events}),
        row('every earlier worker still has exactly one delivery and one event', true, ['A', 'B', 'C'].every(key => obs.workers[key].deliveries === 1 && obs.workers[key].events === 1)),
        row('the new worker has exactly one delivery and one event', {deliveries: 1, events: 1}, {deliveries: obs.workers.D.deliveries, events: obs.workers.D.events})];
    }},
  {id: 'I05', kind: 'CHECK', scenario: 'ticks', title: 'a re-classification of a worker (skills edited into another kind) does not re-notify', requirement: 'Plan 12.6: a re-classification does not spam the same person.',
    evaluate: obs => [pre('the worker edited the skills of an ACTIVE profile', true, obs.skillsEdited), row('the worker still has exactly one delivery and one event', {deliveries: 1, events: 1}, {deliveries: obs.workers.A.deliveries, events: obs.workers.A.events})]},

  // ============================================================================ the closing of the dispatch
  {id: 'T01', kind: 'CHECK', scenario: 'expiry', title: 'an expired task closes the dispatch', requirement: 'Plan 12.5: no notification after the task expired; the pending rows end EXPIRED; the queue lets go.', evaluate: obs => closedTaskRows(obs, {status: 'EXPIRED', stopReason: 'NEED_EXPIRED'})},
  {id: 'T02', kind: 'CHECK', scenario: 'cancel', title: 'a cancelled task closes the dispatch', requirement: 'Plan 12.5: no notification after the task was cancelled; the pending rows end EXPIRED; the queue lets go.', evaluate: obs => closedTaskRows(obs, {status: 'CANCELLED', stopReason: 'NEED_CANCELLED'})},
  {id: 'T03', kind: 'CHECK', scenario: 'fill', title: 'a filled task sends nothing more', requirement: 'Plan 12.5: no notification after the task is full.',
    evaluate: obs => [row('the task status after the selection', 'ACTIVE', obs.after.needStatus), row('the schedule row is gone', false, obs.after.schedule.queued),
      row('a wave called directly sends nothing: STOPPED / NEED_NOT_OPEN / 0', {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0}, {status: obs.waveAfter.status, reason: obs.waveAfter.reason, inserted: obs.waveAfter.inserted}),
      row('a worker who becomes eligible afterwards gets no delivery and no event', {deliveries: 0, events: 0}, {deliveries: obs.lateWorker.deliveries, events: obs.lateWorker.events}),
      row('the worker who applied has a RESPONDED delivery', true, (obs.after.respondedDeliveries ?? 0) >= 1)]},
  {id: 'T03b', kind: 'CHECK', scenario: 'fill', title: 'the pending notification rows of a filled task are closed', requirement: 'Plan 12.5: pending PUSH rows end SUPPRESSED or EXPIRED; here for a task that was filled (rpc_cancel_need and expire_lifecycle do it for a cancellation and an expiry).', findingId: 'F9',
    evaluate: obs => [row('no IN_APP or PUSH row of the opportunity events is still pending after the fill', 0, pendingCount(obs.after.pending))]},
  {id: 'T04', kind: 'CHECK', scenario: 'search', title: 'closing the remaining search closes the rounds, the deliveries and the queue, and no worker write brings it back', requirement: 'rpc_close_remaining_search: the requester stopped the search; nothing is sent afterwards.',
    evaluate: obs => [pre('an agreement exists and the search is closed', true, obs.afterClose.searchClosed), row('no round is PLANNED or SENT', 0, openRounds(obs.afterClose.rounds)),
      row('the stopped round says REMAINING_SEARCH_CLOSED', 'REMAINING_SEARCH_CLOSED', obs.afterClose.rounds.find(item => item.round_no === 1)?.stop_reason ?? null),
      row('no delivery is READY or SEEN', 0, (obs.afterClose.deliveries.READY ?? 0) + (obs.afterClose.deliveries.SEEN ?? 0)), row('the schedule row is gone', false, obs.afterClose.schedule.queued),
      row('a worker write that requeues the open tasks does not enqueue it (the requeue filters closed searches)', false, obs.requeueAfterClose.scheduleQueued)]},
  {id: 'T04b', kind: 'CHECK', scenario: 'search', title: 'an agreement cancellation does not send a closed-search task into an endless failing loop', requirement: 'A task that can never be dispatched again leaves the queue; the dispatch never fails every ten minutes for ever.', findingId: 'F10',
    evaluate: obs => [pre('the cancellation re-enqueued the task (rpc_cancel_agreement enqueues it)', true, obs.afterCancel.requeued),
      row('the tick that followed did not fail', 0, obs.afterCancel.tick.failed), row('the schedule row is not in ERROR', true, obs.afterCancel.schedule.lastStatus !== 'ERROR'),
      row('a later tick does not fail either', 0, obs.afterCancel.repeat.tick.failed)]},
  {id: 'T05', kind: 'CHECK', scenario: 'revision', title: 'a confirmed material edit closes the old dispatch and sends nothing while the task is a draft', requirement: 'Plan 12.5: no notification for a revision that is no longer the task (after_need_revision, rpc_confirm_need_edit).',
    evaluate: obs => [row('the edit moved the task to DRAFT, revision 2', {status: 'DRAFT', revision: 2}, {status: obs.edit.status, revision: obs.edit.revision}), row('the schedule row is gone', false, obs.edit.scheduleQueued),
      row('no delivery of revision 1 is still READY or SEEN', 0, (obs.edit.deliveries.READY ?? 0) + (obs.edit.deliveries.SEEN ?? 0)), row('the SENT round of revision 1 was stopped with NEED_REVISED', 'NEED_REVISED', obs.edit.round1StopReason),
      row('a wave called directly while the task is a draft sends nothing', {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0}, {status: obs.waveWhileDraft.status, reason: obs.waveWhileDraft.reason, inserted: obs.waveWhileDraft.inserted})]},

  // ============================================================================ the probes of the untested inferences (G03 / S04 section of the canonical scope)
  {id: 'PA', kind: 'PROBE', bodies: ['private.requeue_open_needs_for_worker_v5', 'public.rpc_save_worker_capacity', 'private.dispatch_tick', 'private.enqueue_dispatch', 'private.dispatch_cheap_candidate_admitted'], scenario: 'requeue', title: 'probe (a): a manual edit of skills, tools, vehicles or licences on an ACTIVE profile does not requeue the open tasks',
    inference: 'The owner UPDATE of the four lists is a plain app_profiles update; only four writers requeue; a task that found nobody waits for its backoff (5 minutes up to 6 hours).',
    requirement: 'Runbook P5 exit / plan 12.5: a profile or availability change has a clear consequence.', findingId: 'F11', decide: decidePA},
  {id: 'PB', kind: 'PROBE', bodies: ['private.dispatch_cheap_candidate_admitted', 'private.candidate_profile_ids', 'private.match_detail_without_calendar', 'private.dispatch_next_wave', 'private.safety_guard_delivery', 'private.closure_guard_delivery', 'private.emit_event'], scenario: 'reach', title: 'probe (b): a blocked, closing or opted-out pair consumes a wave slot',
    inference: 'match_detail has no block gate; safety_guard_delivery and closure_guard_delivery suppress the notification rows after the delivery row (and its slot) exist.',
    requirement: 'W06 / plan 12.5: the wave\'s slots go to workers who can be reached.', findingId: 'F6', decide: decidePB},
  {id: 'PC', kind: 'PROBE', bodies: ['private.emit_event', 'private.push_suppression', 'public.rpc_claim_push_transport'], scenario: 'push', title: 'probe (c): emit-time role inheritance (PKG-029a) versus the exact-role lookup of the claim, for push enabled on the other role only',
    inference: 'emit_event creates the PUSH row CREATED from the REQUESTER row; push_suppression, which the claim asks, looks the WORKER row up and answers PUSH_OFF.',
    requirement: 'PKG-029a: a person who switched push on once expects it on for the other role too.', findingId: 'F7', decide: decidePC},
  {id: 'PD1', kind: 'PROBE', bodies: ['private.emit_event', 'private.in_quiet_hours', 'public.rpc_claim_push_transport'], scenario: 'push', title: 'probe (d1): quiet hours at emit time suppress the push permanently',
    inference: 'The PUSH row is created SUPPRESSED/QUIET_HOURS; nothing re-opens it when the quiet hours end.', requirement: 'Owner 21/21 D-0114: a delayed push is re-read and sent later.', findingId: 'F8', decide: decidePD1},
  {id: 'PD2', kind: 'PROBE', bodies: ['private.push_suppression', 'public.rpc_claim_push_transport', 'private.in_quiet_hours'], scenario: 'push', title: 'probe (d2): quiet hours at claim time suppress the push permanently',
    inference: 'push_suppression answers QUIET_HOURS and the claim marks the row SUPPRESSED for good.', requirement: 'Owner 21/21 D-0114.', findingId: 'F8', decide: decidePD2},
  {id: 'PD3', kind: 'PROBE', bodies: ['private.push_suppression', 'public.rpc_claim_push_transport', 'public.rpc_select_response'], scenario: 'push', title: 'probe (d3): there is no send-time re-read of the task or of the worker\'s eligibility',
    inference: 'push_suppression reads preferences, closure and block only; a PUSH row of a suspended worker for a filled task passes the gate and is stopped only for want of a device.',
    requirement: 'Owner 21/21 D-0114: a delayed push re-reads the current entity and eligibility.', findingId: 'F9', decide: decidePD3},
  {id: 'PE', kind: 'PROBE', bodies: ['public.rpc_resolve_activity_event', 'public.rpc_read_task', 'public.rpc_list_inbox'], scenario: 'resolver', scenarios: ['resolver', 'expiry', 'cancel', 'fill'], title: 'probe (e): the Inbox resolver opens a stale opportunity without re-checking eligibility',
    inference: 'rpc_resolve_activity_event answers OPPORTUNITY for any NEED event whose task the worker may read; only a task that left the open statuses is hidden by RLS.',
    requirement: 'Owner 21/21 D-0114 / plan 12.5: an opportunity the worker can no longer act on is not opened.', findingId: 'F12', decide: decidePE},
  {id: 'PF', kind: 'PROBE', bodies: ['public.rpc_confirm_need_edit', 'private.after_need_revision', 'private.enqueue_on_need_change', 'private.dispatch_next_wave'], scenario: 'revision', title: 'probe (f): a material edit (revision bump) re-notifies the same worker once the task is published again',
    inference: 'The delivery and the event are keyed per revision, so the new revision is a new opportunity for everyone eligible, including the workers who got the old one.',
    requirement: 'Documented behaviour (S04 scope: "material edit (revision bump) behavior documented"); no canonical requirement says either way.', findingId: null, decide: decidePF},
  {id: 'PH', kind: 'PROBE', bodies: ['private.dispatch_tick', 'private.requeue_open_needs_for_worker_v5', 'private.enqueue_dispatch'], scenario: 'ticks', title: 'probe (h): a worker write brings the next wave forward before the previous window has closed',
    inference: 'PKG-027a requeues the task immediately; dispatch_tick then runs the next wave although the previous round\'s deadline is still ahead.',
    requirement: 'Documented design (PKG-027a: a changed worker puts the task back in the queue at once); recorded so that nobody reads it as a defect or as a pace guarantee.', findingId: null, decide: decidePH},
]);

// ---------------------------------------------------------------------------------------------- the probe deciders (pure)
const ms = value => (value === null || value === undefined ? NaN : Date.parse(value));

function decidePA(obs) {
  const s = obs.steps;
  const edited = {nextRunAt: s.afterManualEdit.nextRunAt, attempts: s.afterManualEdit.attempts}, first = {nextRunAt: s.afterFirstTick.nextRunAt, attempts: s.afterFirstTick.attempts};
  const waitMs = ms(s.afterManualEdit.nextRunAt) - ms(s.afterManualEdit.readAt);
  const writerDelayMs = ms(s.afterRequeueWriter.nextRunAt) - ms(s.afterRequeueWriter.readAt);
  const unchanged = eq(edited, first), waits = waitMs > 0, requeued = writerDelayMs <= 0;
  const rows = [row('precondition: before the edit the worker lacked the tool and no wave could reach it', {cheap: false, delivered: false}, {cheap: obs.cheapBeforeEdit, delivered: obs.deliveredBeforeEdit}),
    row('the manual edit made the worker admissible (the cheap gate now says yes)', true, obs.cheapAfterEdit),
    row('the schedule row is unchanged by the edit (same next run, same attempts)', true, unchanged),
    row('the task still waits for its backoff after the edit (ms until the next run > 0)', true, waits),
    row('a requeue writer (a changed team capacity) makes it due now', true, requeued),
    row('and the next tick then reaches the worker', true, obs.deliveredAfterRequeue),
    row('the longest backoff of the series is 360 minutes (6 hours)', 360, Math.max(...obs.backoff.map(item => item.delayMinutes)))];
  const note = `after the edit the task waited ${Math.round(waitMs / 1000)} s more; a requeue writer made it due at once; backoff series (minutes): ${obs.backoff.map(item => item.delayMinutes).join(', ')}`;
  if (!unchanged && !waits) return {result: 'REFUTED', requirement: 'MET', rows, note};
  if (!requeued) return {result: 'NOT_REACHED', requirement: 'NOT_APPLICABLE', rows, note: 'the requeue writer did not requeue either: ' + note};
  return {result: 'CONFIRMED', requirement: 'NOT_MET', rows, note};
}

function decidePB(obs) {
  const consumers = ['blocked-by-worker', 'blocked-by-requester', 'closure', 'opportunities-off'];
  const facts = Object.fromEntries(consumers.map(label => [label, workerFacts(obs.workers[label])]));
  const rounds = obs.rounds ?? [];
  const wave1 = Object.entries(obs.workers).filter(([, item]) => (item.deliveries ?? []).some(delivery => delivery.round === 1)).map(([label]) => label);
  const wave1Reached = wave1.filter(label => workerFacts(obs.workers[label]).reached);
  const rows = consumers.map(label => row(`${label}: a delivery row exists (a slot was spent) and the person cannot see the opportunity`, {delivered: true, reached: false}, {delivered: facts[label].delivered, reached: facts[label].reached}));
  rows.push(row('wave 1 slots spent / reachable workers among them', {slots: rounds.find(item => item.round_no === 1)?.batch_size ?? null, reached: wave1Reached.length}, {slots: wave1.length, reached: wave1Reached.length}, {info: true}));
  const spent = consumers.filter(label => facts[label].delivered && !facts[label].reached);
  const note = `wave 1 spent ${wave1.length} slot(s) on ${wave1.join(', ')}; only ${wave1Reached.join(', ') || 'nobody'} could see it; slot consumers: ${spent.join(', ') || 'none'}`;
  if (spent.length === 0) return {result: 'REFUTED', requirement: 'MET', rows: rows.filter(item => !item.info), note};
  return {result: 'CONFIRMED', requirement: 'NOT_MET', rows: rows.filter(item => !item.info), note, evidence: {wave1, wave1Reached, spent}};
}

function decidePC(obs) {
  const p = obs.workers.inherit, c = obs.workers['worker-on'];
  const rows = [row('emit time: the PUSH row of the worker with push enabled on the REQUESTER role only is CREATED (inherited)', 'CREATED', p.emit.push),
    row('the sender gate (push_suppression) says PUSH_OFF for that row', 'PUSH_OFF', p.suppressionBefore), row('the claim marks it SUPPRESSED / PUSH_OFF', {state: 'SUPPRESSED', reason: 'PUSH_OFF'}, {state: p.claimed.state, reason: p.claimed.reason}),
    row('control: a worker with push enabled on the WORKER role passes the gate', '<null>', c.suppressionBefore)];
  const note = `emit ${p.emit.push}, gate ${p.suppressionBefore}, claim ${p.claimed.state}/${p.claimed.reason}`;
  if (p.emit.push !== 'CREATED') return {result: 'REFUTED', requirement: 'MET', rows, note: 'no inheritance happened at emit time: ' + note};
  if (p.suppressionBefore === '<null>') return {result: 'REFUTED', requirement: 'MET', rows, note: 'the sender gate inherits too: ' + note};
  return {result: 'CONFIRMED', requirement: 'NOT_MET', rows, note};
}

function decidePD1(obs) {
  const q = obs.workers['quiet-emit'];
  const rows = [row('emit time: the PUSH row is SUPPRESSED / QUIET_HOURS', 'SUPPRESSED:QUIET_HOURS', q.emit.push), row('after the quiet hours are switched off the row is unchanged', {state: 'SUPPRESSED', reason: 'QUIET_HOURS'}, {state: q.afterQuietOff.state, reason: q.afterQuietOff.reason}),
    row('after the claim it is still the same row in the same state (the claim does not pick a suppressed row)', {state: 'SUPPRESSED', reason: 'QUIET_HOURS'}, {state: q.claimed.state, reason: q.claimed.reason})];
  const permanent = rows.every(item => item.ok);
  return {result: permanent ? 'CONFIRMED' : 'REFUTED', requirement: permanent ? 'NOT_MET' : 'MET', rows, note: permanent ? 'suppressed at birth and never re-opened' : 'the row changed after the quiet hours ended'};
}

function decidePD2(obs) {
  const q = obs.workers['quiet-claim'];
  const rows = [row('emit time: the PUSH row is CREATED (quiet hours were off)', 'CREATED', q.emit.push), row('after the quiet hours start the sender gate says QUIET_HOURS', 'QUIET_HOURS', q.suppressionAfter),
    row('the claim marks the row SUPPRESSED / QUIET_HOURS for good', {state: 'SUPPRESSED', reason: 'QUIET_HOURS'}, {state: q.claimed.state, reason: q.claimed.reason})];
  const permanent = rows.every(item => item.ok);
  return {result: permanent ? 'CONFIRMED' : 'REFUTED', requirement: permanent ? 'NOT_MET' : 'MET', rows, note: permanent ? 'suppressed at claim time, no deferral' : 'the row was not suppressed permanently'};
}

function decidePD3(obs) {
  const s = obs.workers.stale, w = obs.workers['worker-on'];
  const rows = [row('precondition: the task was filled after the emit (status ACTIVE) and the worker suspended', {need: 'ACTIVE', profile: 'SUSPENDED'}, {need: obs.fill.needStatusAfter, profile: s.profileStatusAfter}),
    row('the sender gate passes the PUSH row of the suspended worker for the filled task', '<null>', s.suppressionAfter),
    row('the claim stops it only for want of a device (a reason about the device, not about the task or the worker)', 'NO_ACTIVE_DEVICE', s.claimed.reason),
    row('control: the worker who applied also passes the gate', '<null>', w.suppressionAfter),
    row('static: the body of private.push_suppression reads neither the task nor the worker eligibility (DEV capture, md5 pinned)', false, obs.static.pushSuppressionReadsTaskOrEligibility)];
  const reread = s.suppressionAfter !== '<null>';
  return {result: reread ? 'REFUTED' : 'CONFIRMED', requirement: reread ? 'MET' : 'NOT_MET', rows, note: reread ? 'the gate re-read something: ' + s.suppressionAfter : 'a filled task and a suspended worker still pass the sender gate'};
}

function decidePE(obs) {
  const states = [];
  for (const item of obs.resolver.states) states.push({name: item.name, kind: item.kind ?? item.error ?? null, listed: item.listedInInbox, taskRead: item.taskFound});
  for (const [key, label] of [['expiry', 'task expired'], ['cancel', 'task cancelled'], ['fill', 'task filled']]) {
    const resolver = obs[key].resolver;
    states.push({name: label, kind: resolver.kind ?? resolver.error ?? null, listed: resolver.listedInInbox, taskRead: resolver.taskFound});
  }
  const live = states.filter(item => item.name.startsWith('live'));
  const terminal = states.filter(item => !item.name.startsWith('live'));
  const staleOpen = live.filter(item => item.name !== 'live, eligible' && item.kind === 'OPPORTUNITY');
  const rows = [...live.map(item => row(`${item.name}: what the Inbox does with the event`, item.name === 'live, eligible' ? 'OPPORTUNITY' : 'UNAVAILABLE', item.kind)),
    ...terminal.map(item => row(`${item.name}: what the Inbox does with the event`, 'UNAVAILABLE', item.kind))];
  const note = states.map(item => `${item.name}: ${item.kind}`).join('; ');
  if (live.find(item => item.name === 'live, eligible')?.kind !== 'OPPORTUNITY') return {result: 'NOT_REACHED', requirement: 'NOT_APPLICABLE', rows, note: 'the control did not resolve: ' + note};
  if (staleOpen.length === 0) return {result: 'REFUTED', requirement: 'MET', rows, note};
  return {result: 'CONFIRMED', requirement: 'NOT_MET', rows, note, evidence: {staleOpen: staleOpen.map(item => item.name), terminalHidden: terminal.every(item => item.kind === 'UNAVAILABLE')}};
}

function decidePF(obs) {
  const v1 = obs.v1.events.filter(item => item.account === obs.worker), v2 = obs.v2.events.filter(item => item.account === obs.worker);
  const rows = [row('precondition: the worker got the opportunity for revision 1', 1, v1.length), row('after the confirmed edit and the new publication the same worker has a second event, for revision 2', 2, v2.length),
    row('the new event has its own dedupe key and entity version 2', {version: 2, differentKey: true}, {version: v2.at(-1)?.entityVersion ?? null, differentKey: (v2.at(-1)?.dedupeKey ?? '') !== (v2[0]?.dedupeKey ?? '')})];
  const renotified = v2.length === 2;
  return {result: renotified ? 'CONFIRMED' : 'REFUTED', requirement: 'NOT_APPLICABLE', rows, note: renotified ? 'the new revision is a new opportunity: the same worker is notified again (documented)' : 'the worker was not notified for revision 2'};
}

function decidePH(obs) {
  const s5 = obs.steps.s5;
  const ahead = ms(s5.previousRoundDeadlineAt) > ms(s5.at);
  const rows = [row('the tick after a new worker joined ran the next wave', 1, s5.tick.sent), row('although the previous round\'s deadline was still in the future', true, ahead)];
  const confirmed = s5.tick.sent === 1 && ahead;
  return {result: confirmed ? 'CONFIRMED' : 'REFUTED', requirement: 'NOT_APPLICABLE', rows, note: confirmed ? 'a worker write requeues the task at once; the next wave does not wait for the window (PKG-027a, by design)' : 'the next wave waited for the window'};
}


/** The pinned function bodies each scenario's observations depend on (the report prints the chain md5 of each next to every case and probe, so a verdict always says what it ran against). */
export const SCENARIO_BODIES = Object.freeze({
  reach: Object.freeze(['private.dispatch_next_wave', 'private.dispatch_cheap_candidate_admitted', 'private.candidate_profile_ids', 'private.match_detail', 'private.match_detail_without_calendar', 'private.emit_event', 'private.safety_guard_delivery', 'private.closure_guard_delivery', 'private.accounts_same_world', 'public.rpc_list_inbox', 'public.rpc_submit_response']),
  licence: Object.freeze(['private.dispatch_next_wave', 'private.dispatch_cheap_candidate_admitted', 'private.match_detail_without_calendar', 'private.emit_event']),
  worldReverse: Object.freeze(['private.dispatch_next_wave', 'private.dispatch_cheap_candidate_admitted', 'private.accounts_same_world', 'private.account_visibility_world']),
  capacity: Object.freeze(['private.dispatch_next_wave', 'private.dispatch_cheap_candidate_admitted', 'private.match_detail_without_calendar', 'public.rpc_submit_response']),
  target: Object.freeze(['private.dispatch_next_wave', 'private.dispatch_tick', 'public.rpc_submit_response']),
  calendar: Object.freeze(['private.dispatch_next_wave', 'private.match_detail', 'private.match_detail_for_calendar_interval', 'private.worker_calendar_conflict', 'public.rpc_select_response']),
  window: Object.freeze(['private.worker_dispatch_time_admitted', 'private.match_detail_without_calendar', 'private.availability_is_future', 'private.worker_available_periods', 'private.schedule_fit', 'private.dispatch_next_wave']),
  waves: Object.freeze(['private.dispatch_next_wave', 'private.candidate_budget', 'private.match_detail', 'private.emit_event']),
  ticks: Object.freeze(['private.dispatch_tick', 'private.dispatch_next_wave', 'private.requeue_open_needs_for_worker_v5', 'private.enqueue_dispatch', 'private.expire_lifecycle']),
  expiry: Object.freeze(['private.expire_lifecycle', 'private.dispatch_next_wave', 'private.dispatch_tick', 'private.enqueue_on_need_change']),
  cancel: Object.freeze(['public.rpc_cancel_need', 'private.dispatch_next_wave', 'private.dispatch_tick', 'private.enqueue_on_need_change']),
  fill: Object.freeze(['public.rpc_select_response', 'private.dispatch_next_wave', 'private.enqueue_on_need_change', 'public.rpc_resolve_activity_event']),
  search: Object.freeze(['public.rpc_close_remaining_search', 'public.rpc_cancel_agreement', 'private.guard_closed_remaining_search_delivery', 'private.dispatch_tick', 'private.dispatch_next_wave']),
  revision: Object.freeze(['public.rpc_confirm_need_edit', 'private.after_need_revision', 'private.enqueue_on_need_change', 'private.dispatch_next_wave']),
  requeue: Object.freeze(['private.requeue_open_needs_for_worker_v5', 'public.rpc_save_worker_capacity', 'private.dispatch_tick', 'private.dispatch_cheap_candidate_admitted']),
  resolver: Object.freeze(['public.rpc_resolve_activity_event', 'public.rpc_read_task', 'public.rpc_list_inbox']),
  push: Object.freeze(['private.push_suppression', 'public.rpc_claim_push_transport', 'private.emit_event', 'public.rpc_set_notification_preferences']),
});

/** The bodies a case or probe ran against: a probe names its own, any other entry inherits those of its scenario(s). Sorted, unique. */
export const bodiesOf = def => (def.bodies ? [...def.bodies] : [...new Set((def.scenarios ?? [def.scenario]).flatMap(id => SCENARIO_BODIES[id] ?? []))].sort());

/** The case ids in the order of the catalogue, for the tests and the report. */
export const CASE_IDS = Object.freeze(CASES.map(item => item.id));
export const REQUIRED_SCENARIOS = Object.freeze([...new Set(CASES.flatMap(item => item.scenarios ?? [item.scenario]))].sort());
