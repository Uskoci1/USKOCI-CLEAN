// EX-06 S04: hand-built reference observations for the offline tests (test support, not imported by the proof itself). They are the written-down SPECIFICATION of the observation shapes
// that scenarios.mjs must produce and cases.mjs reads, in two worlds:
//   AS_BUILT  the product as read from its DEV bodies on 2026-10-02: what the author predicts the chain will show (the findings F5 ... F12 expected);
//   FIXED     the same product with every proposed fix applied: every finding case passes and every probe is refuted (the mutation that proves the cases CAN pass and CAN fail).
// A mutation of ONE fact (e.g. a blocked worker that is not delivered) must flip exactly the case that names it: cases.test.mjs does that.
import {expectedWaves} from './judge.mjs';

/** The verdict the author predicts for every case and probe in the AS_BUILT world (the product as read from its DEV bodies): the findings expected are exactly F5 ... F12. */
export const AS_BUILT_VERDICTS = Object.freeze({
  R00a: 'PASS', R00b: 'PASS', R01: 'PASS', R02: 'PASS', R03: 'PASS', R04: 'PASS', R05: 'PASS', R06: 'PASS', R07: 'PASS', R08: 'PASS', R09: 'PASS', R10: 'PASS', R11: 'PASS', R12: 'PASS', R13: 'PASS',
  R14: 'FINDING', R15: 'PASS', L00: 'PASS', L01: 'PASS', L02: 'PASS', V00: 'PASS', V01: 'PASS', C00: 'PASS', C01: 'DOCUMENTED', C02: 'PASS', C03: 'PASS', C04: 'PASS', C05: 'PASS',
  Z00a: 'PASS', Z01: 'PASS', Z02: 'PASS', Z03: 'PASS', Z04a: 'PASS', Z04: 'PASS', Z05a: 'PASS', Z05: 'PASS', W01: 'PASS', W02: 'PASS', W03: 'PASS', W04: 'PASS', W05: 'PASS', W06: 'PASS',
  I01: 'PASS', I02: 'PASS', I03: 'PASS', I04: 'PASS', I05: 'PASS', T01: 'PASS', T02: 'PASS', T03: 'PASS', T03b: 'FINDING', T04: 'PASS', T04b: 'FINDING', T05: 'PASS',
  PA: 'CONFIRMED', PB: 'CONFIRMED', PC: 'CONFIRMED', PD1: 'CONFIRMED', PD2: 'CONFIRMED', PD3: 'CONFIRMED', PE: 'CONFIRMED', PF: 'CONFIRMED', PH: 'CONFIRMED',
});

export const ALL_FIXES = Object.freeze(['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);
const T0 = Date.parse('2026-10-02T10:00:00.000Z');
const iso = offsetMs => new Date(T0 + offsetMs).toISOString();
const MIN = 60000;

let sequence = 0;
const uid = prefix => `${prefix}-${++sequence}`;

export const worker = (label, over = {}) => ({label, accountId: uid('acct-' + label), profileId: uid('prof-' + label), match: null, cheap: null, deliveries: [], events: [], notifications: [], inboxListed: null, inboxError: null,
  cause: {observed: true, detail: 'observed'}, ...over});
export const reachedParts = (round, {inApp = ['CREATED', null], push = ['SUPPRESSED', 'PUSH_OFF'], version = 1} = {}) => ({
  deliveries: [{round, status: 'READY', score: 99, expiresAt: iso(15 * MIN)}], events: [{id: uid('event'), dedupeKey: 'opp:n:' + version + ':a', entityVersion: version, urgency: 'NORMAL'}],
  notifications: [{channel: 'IN_APP', state: inApp[0], suppressionReason: inApp[1], expiresAt: iso(15 * MIN)}, {channel: 'PUSH', state: push[0], suppressionReason: push[1], expiresAt: iso(15 * MIN)}]});
const reached = (label, round = 1, options = {}) => worker(label, reachedParts(round, options));
const suppressed = (label, round, reason) => worker(label, reachedParts(round, {inApp: ['SUPPRESSED', reason], push: ['SUPPRESSED', reason]}));

const task = (over = {}) => ({needId: 'need-1', revision: 1, scheduleKind: 'FLEXIBLE', ...over});
const sentWave = (round, inserted, batchSize) => ({status: 'SENT', reason: null, inserted, batchSize, round, policyWaveNo: round});
const stoppedWave = (round, policyWaveNo, batchSize = 5) => ({status: 'STOPPED', reason: null, inserted: 0, batchSize, round, policyWaveNo});
const round = (round_no, status, stop_reason, batch_size = 5) => ({round_no, status, stop_reason, batch_size});

function reachObservation(fixes) {
  const fixed = id => fixes.has(id);
  const untouched = ['paused', 'draft', 'suspended', 'closed-profile', 'test-world', 'proactive-off', 'requester-self', 'other-kind', 'excluded', 'far'];
  const workers = Object.fromEntries(untouched.map(label => [label, worker(label)]));
  workers['control-a'] = reached('control-a', 2);
  workers['control-b'] = reached('control-b', 2);
  // the ranking of the scenario puts the three consumers (the best-rated) first
  if (fixed('F6')) {
    workers['blocked-by-worker'] = worker('blocked-by-worker'); workers['blocked-by-requester'] = worker('blocked-by-requester'); workers.closure = worker('closure'); workers['opportunities-off'] = worker('opportunities-off');
    workers['control-a'] = reached('control-a', 1); workers['control-b'] = reached('control-b', 1);
  } else {
    workers['blocked-by-worker'] = suppressed('blocked-by-worker', 1, 'ACCOUNT_BLOCKED'); workers['blocked-by-requester'] = suppressed('blocked-by-requester', 1, 'ACCOUNT_BLOCKED');
    workers.closure = suppressed('closure', 1, 'ACCOUNT_CLOSING'); workers['control-a'] = reached('control-a', 1); workers['control-b'] = reached('control-b', 1);
    workers['opportunities-off'] = suppressed('opportunities-off', 2, 'CATEGORY_OFF');
  }
  workers.applied = fixed('F5') ? worker('applied') : reached('applied', 2);
  const rounds = fixed('F6') ? [round(1, 'SENT', null), round(2, 'STOPPED', 'NO_ELIGIBLE_CANDIDATES', 5)] : [round(1, 'SENT', null), round(2, 'SENT', null), round(3, 'STOPPED', 'NO_ELIGIBLE_CANDIDATES', 10)];
  const waves = fixed('F6') ? [sentWave(1, 2, 5), stoppedWave(2, 2)] : [sentWave(1, 5, 5), sentWave(2, workers.applied.deliveries.length ? 2 : 1, 5), stoppedWave(3, 3, 10)];
  return {task: task(), waves, rounds, workers};
}

const simpleReach = (workers, extra = {}) => ({task: task(), waves: [sentWave(1, Object.values(workers).filter(item => item.deliveries.length).length, 5), stoppedWave(2, 2)], rounds: [round(1, 'SENT', null), round(2, 'STOPPED', 'NO_ELIGIBLE_CANDIDATES')], workers, ...extra});

function wavesObservation() {
  const labels = Array.from({length: 12}, (_, index) => 'w' + String(index + 1).padStart(2, '0'));
  const eligible = labels.map((label, index) => ({label, profileId: 'prof-' + label, score: Math.round((100 - index * 0.2) * 10) / 10}));
  const sizes = [5, 5, 10, 20];
  const expected = expectedWaves(eligible, sizes);
  const perWorker = Object.fromEntries(eligible.map(item => [item.profileId, {rounds: [expected.findIndex(ids => ids.includes(item.profileId)) + 1], events: 1, inApp: ['CREATED'], push: ['SUPPRESSED:PUSH_OFF'],
    dedupeKey: `opp:need-1:1:acct-${item.label}`, expectedDedupeKey: `opp:need-1:1:acct-${item.label}`, entityVersion: 1}]));
  return {task: task(), config: {waveSizes: sizes, windowMinutes: 15, targetResponses: 3, expectedEligible: 12}, eligible, expected, actual: expected,
    waves: [sentWave(1, 5, 5), sentWave(2, 5, 5), sentWave(3, 2, 10), stoppedWave(4, 4, 20)], rounds: [round(1, 'SENT', null), round(2, 'SENT', null), round(3, 'SENT', null, 10), round(4, 'STOPPED', 'NO_ELIGIBLE_CANDIDATES', 20)],
    perWorker, totals: {deliveries: 12, distinctWorkers: 12, events: 12, inAppRows: 12, pushRows: 12},
    replay: {waveStatus: 'STOPPED', deliveriesBefore: 12, deliveriesAfter: 12, eventsBefore: 12, eventsAfter: 12}, eventReplay: {nilReturned: true, eventsBefore: 12, eventsAfter: 12},
    duplicateInsert: {refused: true, message: 'ERROR:  duplicate key value violates unique constraint "opportunity_deliveries_once_per_revision_uq"', onConflictRows: 0}};
}

const step = (over = {}) => ({at: iso(0), dueBefore: 0, tick: {processed: 0, sent: 0, stopped: 0, failed: 0, claimed: 0}, schedule: {queued: true, nextRunAt: iso(15 * MIN), attempts: 0, lastStatus: 'SENT', lastReason: null},
  counts: {deliveries: 3, events: 3, recipients: 3}, rounds: [], deliveryStatuses: {READY: 3}, previousRoundDeadlineAt: null, ...over});

function ticksObservation() {
  const r1 = {round_no: 1, status: 'SENT', stop_reason: null, deadline_at: iso(15 * MIN)};
  return {task: task(), skillsEdited: true, config: {windowMinutes: 15}, workers: {A: {deliveries: 1, events: 1}, B: {deliveries: 1, events: 1}, C: {deliveries: 1, events: 1}, D: {deliveries: 1, events: 1}},
    steps: {
      s1: step({at: iso(1000), dueBefore: 1, tick: {processed: 1, sent: 1, stopped: 0, failed: 0, claimed: 1}, rounds: [r1]}),
      s2: step({at: iso(2000), dueBefore: 0, rounds: [r1]}), s3: step({at: iso(62000), dueBefore: 0, rounds: [r1]}),
      s4: step({at: iso(70000), dueBefore: 1, tick: {processed: 1, sent: 0, stopped: 1, failed: 0, claimed: 1}, schedule: {queued: true, nextRunAt: iso(75 * MIN), attempts: 1, lastStatus: 'STOPPED', lastReason: 'NO_ELIGIBLE_CANDIDATES'},
        rounds: [r1, {round_no: 2, status: 'STOPPED', stop_reason: 'NO_ELIGIBLE_CANDIDATES', deadline_at: iso(70000 + 15 * MIN)}]}),
      s5: step({at: iso(80000), dueBefore: 1, tick: {processed: 1, sent: 1, stopped: 0, failed: 0, claimed: 1}, counts: {deliveries: 4, events: 4, recipients: 4}, previousRoundDeadlineAt: iso(15 * MIN),
        rounds: [r1, {round_no: 2, status: 'STOPPED', stop_reason: 'NO_ELIGIBLE_CANDIDATES', deadline_at: null}, {round_no: 3, status: 'SENT', stop_reason: null, deadline_at: iso(80000 + 15 * MIN)}], deliveryStatuses: {READY: 4}}),
      s6: step({at: iso(17 * MIN), dueBefore: 1, tick: {processed: 1, sent: 0, stopped: 1, failed: 0, claimed: 1}, counts: {deliveries: 4, events: 4, recipients: 4}, deliveryStatuses: {EXPIRED: 4}}),
    }};
}

const closedSnapshotBefore = () => ({needStatus: 'PUBLISHED', rounds: [{round_no: 1, status: 'SENT', stop_reason: null}], deliveries: {READY: 3}, pending: [{channel: 'IN_APP', state: 'CREATED', n: 3}, {channel: 'PUSH', state: 'CREATED', n: 3}], schedule: {queued: true}});
const closedSnapshotAfter = (status, stopReason) => ({needStatus: status, rounds: [{round_no: 1, status: 'STOPPED', stop_reason: stopReason}], deliveries: {EXPIRED: 3},
  pending: [{channel: 'IN_APP', state: 'EXPIRED', n: 3}, {channel: 'PUSH', state: 'EXPIRED', n: 3}], schedule: {queued: false}});
const resolverUnavailable = () => ({kind: 'UNAVAILABLE', error: null, listedInInbox: true, taskFound: false});
const closedTaskObservation = (status, stopReason) => ({task: task(), before: closedSnapshotBefore(), after: closedSnapshotAfter(status, stopReason), waveAfter: {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0},
  tickAfter: {scheduleQueued: false, tick: {processed: 0}}, requeue: {scheduleQueued: false}, lateWorker: {deliveries: 0, events: 0}, resolver: resolverUnavailable()});

function fillObservation(fixes) {
  const pending = fixes.has('F9') ? [{channel: 'IN_APP', state: 'EXPIRED', n: 3}, {channel: 'PUSH', state: 'EXPIRED', n: 3}] : [{channel: 'IN_APP', state: 'CREATED', n: 3}, {channel: 'PUSH', state: 'CREATED', n: 3}];
  return {task: task(), before: closedSnapshotBefore(), after: {needStatus: 'ACTIVE', rounds: [{round_no: 1, status: 'SENT', stop_reason: null}], deliveries: {RESPONDED: 1, READY: 2}, respondedDeliveries: 1, pending, schedule: {queued: false}},
    waveAfter: {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0}, tickAfter: {scheduleQueued: false, tick: {processed: 0}}, requeue: {scheduleQueued: false}, lateWorker: {deliveries: 0, events: 0}, resolver: resolverUnavailable()};
}

function searchObservation(fixes) {
  const looping = !fixes.has('F10');
  return {task: task({requiredSlots: 2}), afterClose: {searchClosed: true, rounds: [{round_no: 1, status: 'STOPPED', stop_reason: 'REMAINING_SEARCH_CLOSED'}], deliveries: {RESPONDED: 1, EXPIRED: 1}, schedule: {queued: false}},
    requeueAfterClose: {scheduleQueued: false},
    afterCancel: {requeued: true, tick: {processed: 1, sent: 0, stopped: looping ? 0 : 1, failed: looping ? 1 : 0},
      schedule: {queued: true, nextRunAt: iso(10 * MIN), attempts: 1, lastStatus: looping ? 'ERROR' : 'STOPPED', lastReason: looping ? 'NEED_REMAINING_SEARCH_CLOSED' : 'REMAINING_SEARCH_CLOSED'},
      repeat: {tick: {processed: 1, sent: 0, stopped: looping ? 0 : 1, failed: looping ? 1 : 0}, schedule: {queued: true, attempts: 2, lastStatus: looping ? 'ERROR' : 'STOPPED', lastReason: 'x'}}}};
}

function revisionObservation() {
  const a = 'acct-A';
  return {task: task(), worker: a, v1: {events: [{account: a, entityVersion: 1, dedupeKey: `opp:need-1:1:${a}`}], deliveries: {READY: 1}},
    edit: {status: 'DRAFT', revision: 2, scheduleQueued: false, deliveries: {EXPIRED: 1}, round1StopReason: 'NEED_REVISED'}, waveWhileDraft: {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0},
    republished: {status: 'PUBLISHED', revision: 2, scheduleQueued: true}, v2: {events: [{account: a, entityVersion: 1, dedupeKey: `opp:need-1:1:${a}`}, {account: a, entityVersion: 2, dedupeKey: `opp:need-1:2:${a}`}], deliveries: {EXPIRED: 1, READY: 1}}};
}

function requeueObservation(fixes) {
  const edited = fixes.has('F11');
  const readAt = iso(2 * MIN);
  return {task: task(), worker: 'W', cheapBeforeEdit: false, deliveredBeforeEdit: false, cheapAfterEdit: true, deliveredAfterRequeue: true,
    steps: {afterFirstTick: {nextRunAt: iso(5 * MIN), attempts: 1, readAt: iso(MIN)}, afterManualEdit: {nextRunAt: edited ? iso(MIN) : iso(5 * MIN), attempts: edited ? 0 : 1, readAt},
      afterRequeueWriter: {nextRunAt: iso(3 * MIN), attempts: 1, readAt: iso(3 * MIN)}},
    backoff: [5, 5, 5, 8, 16, 32, 64, 128, 256, 360, 360].map((delayMinutes, index) => ({attempts: index + 1, delayMinutes}))};
}

function resolverObservation(fixes) {
  const staleKind = fixes.has('F12') ? 'UNAVAILABLE' : 'OPPORTUNITY';
  return {states: [{name: 'live, eligible', kind: 'OPPORTUNITY', error: null, listedInInbox: true, taskFound: true}, {name: 'live, worker suspended', kind: staleKind, error: null, listedInInbox: true, taskFound: true},
    {name: 'live, worker already applied', kind: staleKind, error: null, listedInInbox: true, taskFound: true}]};
}

function pushObservation(fixes) {
  const claimed = (state, reason) => ({state, reason, pushStartedAt: true});
  return {task: task(), fill: {needStatusAfter: 'ACTIVE'}, static: {pushSuppressionReadsTaskOrEligibility: false}, claim: {calls: 1},
    workers: {
      inherit: {label: 'inherit', emit: {inApp: 'CREATED', push: 'CREATED'}, suppressionBefore: fixes.has('F7') ? '<null>' : 'PUSH_OFF', suppressionAfter: fixes.has('F7') ? '<null>' : 'PUSH_OFF',
        claimed: fixes.has('F7') ? claimed('SUPPRESSED', 'NO_ACTIVE_DEVICE') : claimed('SUPPRESSED', 'PUSH_OFF')},
      'worker-on': {label: 'worker-on', emit: {inApp: 'CREATED', push: 'CREATED'}, suppressionBefore: '<null>', suppressionAfter: '<null>', claimed: claimed('SUPPRESSED', 'NO_ACTIVE_DEVICE')},
      'quiet-emit': {label: 'quiet-emit', emit: {inApp: 'CREATED', push: 'SUPPRESSED:QUIET_HOURS'}, afterQuietOff: fixes.has('F8') ? {state: 'CREATED', reason: null} : {state: 'SUPPRESSED', reason: 'QUIET_HOURS'},
        claimed: fixes.has('F8') ? claimed('SUPPRESSED', 'NO_ACTIVE_DEVICE') : claimed('SUPPRESSED', 'QUIET_HOURS')},
      'quiet-claim': {label: 'quiet-claim', emit: {inApp: 'CREATED', push: 'CREATED'}, suppressionAfter: fixes.has('F8') ? '<null>' : 'QUIET_HOURS', claimed: fixes.has('F8') ? claimed('SUPPRESSED', 'NO_ACTIVE_DEVICE') : claimed('SUPPRESSED', 'QUIET_HOURS')},
      stale: {label: 'stale', emit: {inApp: 'CREATED', push: 'CREATED'}, profileStatusAfter: 'SUSPENDED', suppressionAfter: fixes.has('F9') ? 'NEED_NOT_OPEN' : '<null>',
        claimed: fixes.has('F9') ? claimed('SUPPRESSED', 'NEED_NOT_OPEN') : claimed('SUPPRESSED', 'NO_ACTIVE_DEVICE')},
    }};
}

/** {scenarioId: {status: 'OK', obs}} for every scenario of the catalogue; `fixes` = the findings that are fixed in this world (ALL_FIXES = the FIXED world, [] = AS_BUILT). */
export function referenceScenarios(fixList = []) {
  const fixes = new Set(fixList);
  const ok = obs => ({status: 'OK', obs});
  return {
    reach: ok(reachObservation(fixes)),
    licence: ok(simpleReach({equipped: reached('equipped'), unlicensed: worker('unlicensed'), untooled: worker('untooled')})),
    worldReverse: ok(simpleReach({'test-worker': reached('test-worker'), 'real-worker': worker('real-worker')})),
    capacity: ok({...simpleReach({'cap-high': reached('cap-high'), 'cap-low': reached('cap-low')}), application: {ok: false, code: '22023', message: 'TEAM_CAPACITY_EXCEEDED'}}),
    target: ok({task: task(), applications: 3, wave: {status: 'STOPPED', reason: 'RESPONSE_TARGET_AND_COVERAGE_REACHED', inserted: 0}, lateWorker: {deliveries: 0, events: 0}, scheduleAfterTick: {queued: false}}),
    calendar: ok(simpleReach({free: reached('free'), busy: worker('busy')})),
    window: ok({tomorrow: simpleReach({'sched-only': reached('sched-only'), 'live-only': worker('live-only'), 'other-day': worker('other-day'), 'blocked-window': worker('blocked-window')}),
      week: simpleReach({'all-days': reached('all-days'), 'live-only': worker('live-only')}), fixed: simpleReach({covering: reached('covering'), 'no-cover': worker('no-cover')})}),
    waves: ok(wavesObservation()), ticks: ok(ticksObservation()), expiry: ok(closedTaskObservation('EXPIRED', 'NEED_EXPIRED')), cancel: ok(closedTaskObservation('CANCELLED', 'NEED_CANCELLED')),
    fill: ok(fillObservation(fixes)), search: ok(searchObservation(fixes)), revision: ok(revisionObservation()), requeue: ok(requeueObservation(fixes)), resolver: ok(resolverObservation(fixes)), push: ok(pushObservation(fixes)),
  };
}
