// EX-06 S04: the observation helpers of the scenarios: what a task, a worker and a tick look like, as plain data. They read through the three seams of the proof (ctx.fx the S03 fixtures, ctx.db the
// database, ctx.api the product RPCs) and never talk to anything else, so the offline tests can run the whole of it against a simulated world.
import {sortedUnique, visibleInInbox} from './judge.mjs';

/** A failure of a SCENARIO's own fixtures (a field the product did not store, an impossible shape): the scenario ends as a harness error, its cases are NOT_RUN. Never a finding. */
export class ScenarioError extends Error {
  constructor(code, detail) {
    super(code + (detail ? ': ' + detail : ''));
    this.code = code;
  }
}

export const iso = ms => new Date(ms).toISOString();
export const MINUTE = 60000;
const sortList = list => sortedUnique(Array.isArray(list) ? list : []);

export function statusCounts(statuses) {
  const out = {};
  for (const status of statuses) out[status] = (out[status] ?? 0) + 1;
  return out;
}

/** The compact matcher answer of a worker for a task (private.match_detail: the function the wave calls), shape-checked. */
export function matchSnapshot(ctx, task, worker) {
  const match = ctx.fx.readMatch(task.needId, worker.profileId);
  if (!match || typeof match.dispatchEligible !== 'boolean' || typeof match.responseAllowed !== 'boolean' || !Array.isArray(match.hardBlockers) || !Array.isArray(match.dispatchBlockers)) {
    throw new ScenarioError('MATCH_SHAPE_UNUSABLE', `${worker.label}: ${JSON.stringify(match)?.slice(0, 200)}`);
  }
  return {responseAllowed: match.responseAllowed, dispatchEligible: match.dispatchEligible, hardBlockers: sortList(match.hardBlockers), dispatchBlockers: sortList(match.dispatchBlockers), score: Number(match.score)};
}

/** Everything the dispatch wrote about a task: the task row, the deliveries (with their round), the notification rows of the opportunity events, the rounds and the schedule row. */
export function ledgerOf(ctx, needId) {
  return {need: ctx.db.needState(needId), deliveries: ctx.db.deliveries(needId), notifications: ctx.db.opportunityNotifications(needId), rounds: ctx.fx.readRounds(needId), schedule: ctx.fx.readSchedule(needId)};
}

export const roundOf = row => ({round_no: Number(row.round_no), status: row.status, stop_reason: row.stop_reason ?? null, batch_size: Number(row.batch_size), deadline_at: row.deadline_at ?? null, created_at: row.created_at ?? null});

/** A worker as one scenario saw it, from the ledger of the task. extras = {match, cheap, cause}. */
export function workerObservation(ledger, worker, extras = {}) {
  const mine = ledger.notifications.filter(item => item.recipient_user_id === worker.id);
  const eventIds = sortedUnique(mine.map(item => item.event_id));
  const events = eventIds.map(id => {
    const row = mine.find(item => item.event_id === id);
    return {id, dedupeKey: row.dedupe_key, entityVersion: row.entity_version === null || row.entity_version === undefined ? null : Number(row.entity_version), urgency: row.urgency};
  });
  const notifications = mine.filter(item => item.channel).map(item => ({channel: item.channel, state: item.state, suppressionReason: item.suppression_reason ?? null, deliveryId: item.delivery_id, eventId: item.event_id,
    expiresAt: item.expires_at ?? null}));
  const deliveries = ledger.deliveries.filter(item => item.worker_profile_id === worker.profileId).map(item => ({round: item.round_no === null || item.round_no === undefined ? null : Number(item.round_no),
    status: item.status, score: Number(item.match_score), expiresAt: item.expires_at ?? null}));
  return {label: worker.label, accountId: worker.id, profileId: worker.profileId, match: extras.match ?? null, cheap: extras.cheap ?? null, deliveries, events, notifications, inboxListed: null, inboxError: null,
    cause: extras.cause ?? {observed: false, detail: 'no cause was computed'}};
}

/**
 * The Inbox as the person sees it (rpc_list_inbox): sets inboxListed / inboxError on each observation that has events and CROSS-CHECKS it with the rows: the rule "reached = an event with an IN_APP
 * row that is not SUPPRESSED" is the definition of the whole proof, so a disagreement means the proof's own model is wrong (a harness error), never a finding.
 */
export async function checkInbox(ctx, workers, observations) {
  for (const [label, worker] of Object.entries(workers)) {
    const obs = observations[label];
    if (!obs || obs.events.length === 0) continue;
    const result = await ctx.api.listInbox(worker);
    if (!result.ok) { obs.inboxError = result.error.message; continue; }
    const ids = new Set((result.data?.items ?? []).map(item => item.id));
    obs.inboxListed = obs.events.some(event => ids.has(event.id));
    if (obs.inboxListed !== visibleInInbox(obs.notifications)) throw new ScenarioError('INBOX_DISAGREES_WITH_THE_ROWS', `${label}: rpc_list_inbox says ${obs.inboxListed}, the IN_APP rows say ${visibleInInbox(obs.notifications)}`);
  }
}

/** Waves until one does not send (or the cap): [{status, reason, inserted, batchSize, round, policyWaveNo}]. Shape-checked: a wave that is neither SENT nor STOPPED is a harness error. */
export function wavesUntilStopped(ctx, needId, {max = 6} = {}) {
  const waves = [];
  for (let index = 0; index < max; index += 1) {
    const result = ctx.fx.runWave(needId);
    if (!result || !['SENT', 'STOPPED'].includes(result.status)) throw new ScenarioError('WAVE_SHAPE_UNUSABLE', JSON.stringify(result)?.slice(0, 200));
    waves.push({status: result.status, reason: result.reason ?? null, inserted: Number(result.inserted ?? 0), batchSize: result.batchSize === undefined ? null : Number(result.batchSize),
      round: result.round === undefined ? null : Number(result.round), policyWaveNo: result.policyWaveNo === undefined ? null : Number(result.policyWaveNo), deadlineAt: result.deadlineAt ?? null});
    if (result.status !== 'SENT') break;
  }
  return waves;
}

/** The closing snapshot of a task: status, rounds, deliveries by status, the pending notification rows (channel, state, count) and whether the schedule still holds it. */
export function snapshotOf(ctx, needId) {
  const ledger = ledgerOf(ctx, needId);
  return {needStatus: ledger.need?.status ?? null, rounds: ledger.rounds.map(roundOf), deliveries: statusCounts(ledger.deliveries.map(item => item.status)), pending: ctx.db.pendingOpportunityNotifications(needId),
    schedule: {queued: ledger.schedule.queued}, respondedDeliveries: ledger.deliveries.filter(item => item.status === 'RESPONDED').length};
}

export const countsOf = ledger => ({deliveries: ledger.deliveries.length, events: sortedUnique(ledger.notifications.map(item => item.event_id)).length, recipients: sortedUnique(ledger.notifications.map(item => item.recipient_user_id)).length});

/**
 * One tick of the production scheduler as the proof drives it: how many schedule rows were due at `atMs`, the tick itself (private.dispatch_tick, the function marketplace_tick calls after
 * private.expire_lifecycle), and what the dispatch looks like afterwards.
 */
export function tickStep(ctx, needId, atMs) {
  const at = iso(atMs);
  const dueBefore = ctx.db.scheduleDueCount(at);
  const tick = ctx.fx.runTick(at);
  if (!tick || typeof tick.processed !== 'number') throw new ScenarioError('TICK_SHAPE_UNUSABLE', JSON.stringify(tick)?.slice(0, 200));
  const ledger = ledgerOf(ctx, needId);
  return {at, dueBefore, tick: {processed: tick.processed, sent: tick.sent, stopped: tick.stopped, failed: tick.failed, claimed: tick.claimed}, schedule: ctx.fx.readSchedule(needId),
    counts: countsOf(ledger), rounds: ledger.rounds.map(roundOf), deliveryStatuses: statusCounts(ledger.deliveries.map(item => item.status)), previousRoundDeadlineAt: null};
}

/** Isolation before a tick: every other schedule row is gone and the proof's task is the only row there is. Throws when something else is still queued. */
export function isolateForTick(ctx, needId) {
  ctx.db.deleteOtherSchedules(needId);
  const other = ctx.db.scheduleRowsExcept(needId);
  if (other !== 0) throw new ScenarioError('FOREIGN_SCHEDULE_ROWS_REMAIN', String(other));
}

/** The event id and the Inbox resolution of the first opportunity event of a worker: {eventId, kind | error, listedInInbox, taskFound, taskStatus}. */
export async function resolveOpportunity(ctx, worker, needId, ledger = ledgerOf(ctx, needId)) {
  const event = ledger.notifications.find(item => item.recipient_user_id === worker.id);
  if (!event) throw new ScenarioError('NO_EVENT_TO_RESOLVE', `${worker.label} has no opportunity event`);
  const listed = await ctx.api.listInbox(worker);
  const resolved = await ctx.api.resolveEvent(worker, event.event_id);
  const read = await ctx.api.readTask(worker, needId);
  return {eventId: event.event_id, kind: resolved.ok ? resolved.data?.kind ?? null : null, error: resolved.ok ? null : resolved.error.message,
    listedInInbox: listed.ok ? (listed.data?.items ?? []).some(item => item.id === event.event_id) : null, taskFound: read.ok && read.data !== null && read.data !== undefined, taskStatus: read.ok ? read.data?.status ?? null : null};
}

/**
 * Pure: does a function body read the task or the worker's eligibility? True when it names a table or function through which a task status, a delivery, a response, a profile status or the
 * matcher could be re-read. Used for the static half of probe (d3): the body of private.push_suppression (the sender gate) on the chain, and its DEV capture in the offline tests.
 */
export const bodyReadsTaskOrEligibility = body => /public\.needs\b|opportunity_deliveries|marketplace_responses|match_detail|profile_status|app_profiles|need_selections/.test(String(body ?? ''));
