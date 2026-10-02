// EX-06 S04: the scenarios. Each one builds people and a task through the PRODUCT path (real Auth and PostgREST, the S03 fixtures), drives the dispatch (a wave, a tick, an expiry sweep, a
// cancellation, a selection ...) and returns ONE observation: plain data that cases.mjs judges. A scenario never judges and never fixes: it observes.
//
// Where the product has no writer the proof says so: LABELLED fixtures (a closure request, the stored response deadline, the re-publication after a confirmed edit, the status of a
// profile, the proactive/rating/exclusion columns of a worker, a rated worker for a deterministic ranking). Everything else is a product RPC.
//
// ctx = {fx (the S03 fixtures), db (lib/db.mjs), api (lib/api.mjs), newId, now, sleep, say, config: {waveSizes, windowMinutes, targetResponses}, evidence(label, data)}.
import {availabilityWindow, weeklyRule} from '../../lib/fixtures.mjs';
import {resolveRelativeTime} from '../../lib/timeutil.mjs';
import {NIL_UUID} from './db.mjs';
import {expectedWaves, sortedUnique} from './judge.mjs';
import {midnightGuardWaitMs, tomorrowOf} from './clock.mjs';
import {MINUTE, ScenarioError, bodyReadsTaskOrEligibility, checkInbox, countsOf, iso, isolateForTick, ledgerOf, matchSnapshot, resolveOpportunity, roundOf, snapshotOf, tickStep, wavesUntilStopped,
  workerObservation} from './observe.mjs';

const BELGRADE = 'Europe/Belgrade';

export const BASE_FACTS = Object.freeze({
  'need.title': 'S04 zadatak: prenos stvari za proveru slanja',
  'need.description': 'Sintetički primer za EX-06 S04: prenos jedne kutije iz sobe u hodnik, potrebno je jedno radno lice.',
  'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi'], 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE', 'need.people_needed': 1, 'need.task_country_code': 'RS',
  'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}},
});
export const BASE_WORKER = Object.freeze({skills: ['fizicki poslovi'], tools: [], vehicles: [], licenses: [], radiusKm: 15});

// ---------------------------------------------------------------------------------------------- small helpers
const cause = (observed, detail) => ({observed: Boolean(observed), detail: String(detail)});
const hasCode = (match, code) => match.hardBlockers.includes(code) || match.dispatchBlockers.includes(code);
const blockers = match => JSON.stringify({hard: match.hardBlockers, dispatch: match.dispatchBlockers});

/** A published task through the product path (conversation, review, accept, evaluate, publish), read back: what the product stored is what the scenario intended. */
async function publishTask(ctx, requester, over = {}, {interval = null} = {}) {
  const need = await ctx.fx.createNeedFromFacts(requester, {...BASE_FACTS, ...over}, {nowMs: ctx.now(), interval});
  if (need.materialisation !== 'PRODUCT_PATH') throw new ScenarioError('TASK_NOT_ON_THE_PRODUCT_PATH', String(need.materialisation));
  const back = ctx.fx.readBackNeed(need.needId, need.intent);
  if (back.mismatches.length) throw new ScenarioError('FIXTURE_NOT_APPLIED:' + back.mismatches[0].field, JSON.stringify(back.mismatches).slice(0, 300));
  return {needId: need.needId, needRevision: Number(back.row.revision), revision: Number(back.row.revision), scheduleKind: back.row.schedule_kind, requiredSlots: Number(back.row.required_slots)};
}

const spawn = (ctx, label, spec = {}) => ctx.fx.createWorker({...BASE_WORKER, ...spec, label: 's04-' + label});

function assertStored(ctx, worker) {
  const back = ctx.fx.readBackWorker(worker);
  if (back.mismatches.length) throw new ScenarioError('FIXTURE_NOT_APPLIED:' + back.mismatches[0].field, `${worker.label} ${JSON.stringify(back.mismatches).slice(0, 300)}`);
}

/** The status a worker profile cannot be given by the product (it is server derived): a labelled bypass; the worker's spec follows so that the read-back compares what was written. */
function setStatus(ctx, worker, status) {
  ctx.fx.setWorkerStatusBypass(worker, status);
  worker.spec.status = status;
  worker.spec.availability = {...worker.spec.availability, availableNow: false};
}

const pushOn = (ctx, worker, role = 'WORKER', extra = {}) => ctx.fx.setNotificationPreferences(worker, role, {push_enabled: true, ...extra});

function preRead(ctx, task, workers) {
  return Object.fromEntries(Object.entries(workers).map(([label, worker]) => [label, {match: matchSnapshot(ctx, task, worker), cheap: ctx.db.cheapGate(task.needId, worker.profileId)}]));
}

/** The WaveObs of cases.mjs: the task, the waves, the rounds and one WorkerObs per worker, with the Inbox cross-check. */
async function waveObservation(ctx, task, workers, pre, causes, waves) {
  const ledger = ledgerOf(ctx, task.needId);
  const observations = Object.fromEntries(Object.entries(workers).map(([label, worker]) => [label, workerObservation(ledger, worker, {match: pre[label]?.match, cheap: pre[label]?.cheap, cause: causes[label]})]));
  await checkInbox(ctx, workers, observations);
  ctx.evidence('ledger of ' + task.needId.slice(0, 8), {deliveries: ledger.deliveries.slice(0, 40), notifications: ledger.notifications.slice(0, 80), rounds: ledger.rounds});
  return {task: {needId: task.needId, revision: task.revision, scheduleKind: task.scheduleKind}, waves, rounds: ledger.rounds.map(roundOf), workers: observations};
}

const distinctEvents = (ledger, accountId) => sortedUnique(ledger.notifications.filter(item => item.recipient_user_id === accountId).map(item => item.event_id)).length;
const deliveriesOf = (ledger, worker) => ledger.deliveries.filter(item => item.worker_profile_id === worker.profileId).length;

// ---------------------------------------------------------------------------------------------- reach: one task, many workers, waves until the dispatch stops
async function reach(ctx) {
  const {fx, db, api} = ctx;
  const requester = await fx.createRequester({label: 's04-reach-requester', world: 'REAL'});
  const rated = value => ({bypass: {ratingWorker: value}});
  // The ratings make the ranking deterministic: the three workers a wave should never spend a slot on rank first, then the two controls, then the two later ones.
  const plan = [['blocked-by-worker', rated(5)], ['blocked-by-requester', rated(4.9)], ['closure', rated(4.8)], ['control-a', rated(4.7)], ['control-b', rated(4.6)], ['opportunities-off', rated(4.5)], ['applied', rated(4.4)],
    ['paused', {availability: {timezone: BELGRADE, availableNow: false, rules: [], windows: []}}], ['draft', {status: 'DRAFT'}], ['suspended', {}], ['closed-profile', {}], ['test-world', {world: 'TEST'}],
    ['proactive-off', {bypass: {proactiveNotifications: false}}], ['other-kind', {skills: ['selidba']}], ['excluded', {bypass: {exclusions: ['fizicki poslovi']}}], ['far', {location: {city: 'Niš'}}]];
  const workers = {};
  for (const [label, extra] of plan) workers[label] = await spawn(ctx, label, extra);
  workers['requester-self'] = await fx.createWorker({...BASE_WORKER, account: requester, label: 's04-requester-self'});
  setStatus(ctx, workers.suspended, 'SUSPENDED');
  setStatus(ctx, workers['closed-profile'], 'CLOSED');
  await fx.setNotificationPreferences(workers['opportunities-off'], 'WORKER', {opportunities_enabled: false});
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  // the product's block writer (either side), then the labelled closure fixture LAST: a closing account can no longer write
  await api.block(workers['blocked-by-worker'], requester);
  await api.block(requester, workers['blocked-by-requester']);
  db.closureFixture(workers.closure.id);
  // a manual application, made from Discovery before any wave: no delivery row exists for it
  const application = await fx.submitApplication(workers.applied, task);
  if (!application.ok) throw new ScenarioError('APPLICATION_REFUSED', JSON.stringify(application.error));
  const before = ledgerOf(ctx, task.needId);
  if (before.deliveries.length !== 0) throw new ScenarioError('A_DELIVERY_EXISTS_BEFORE_THE_WAVE', String(before.deliveries.length));
  const pre = preRead(ctx, task, workers);
  const preferences = await api.workerPreferences(workers['opportunities-off']);
  const responses = db.responsesOf(task.needId);
  const profile = label => db.profileState(workers[label].profileId);
  const causes = {
    'control-a': cause(true, 'control'), 'control-b': cause(true, 'control'),
    paused: cause(hasCode(pre.paused.match, 'CURRENT_AVAILABILITY_PAUSED'), blockers(pre.paused.match)),
    draft: cause(profile('draft').profile_status === 'DRAFT' && hasCode(pre.draft.match, 'ACCOUNT_OR_PROFILE_RESTRICTED'), blockers(pre.draft.match)),
    suspended: cause(profile('suspended').profile_status === 'SUSPENDED' && hasCode(pre.suspended.match, 'ACCOUNT_OR_PROFILE_RESTRICTED'), blockers(pre.suspended.match)),
    'closed-profile': cause(profile('closed-profile').profile_status === 'CLOSED' && hasCode(pre['closed-profile'].match, 'ACCOUNT_OR_PROFILE_RESTRICTED'), blockers(pre['closed-profile'].match)),
    'test-world': cause(db.accountWorld(workers['test-world'].id) === 'TEST' && db.accountWorld(requester.id) === 'REAL' && pre['test-world'].cheap === false,
      `worker ${db.accountWorld(workers['test-world'].id)}, requester ${db.accountWorld(requester.id)}, cheap gate ${pre['test-world'].cheap}`),
    'proactive-off': cause(hasCode(pre['proactive-off'].match, 'PROACTIVE_NOTIFICATIONS_PAUSED'), blockers(pre['proactive-off'].match)),
    'requester-self': cause(hasCode(pre['requester-self'].match, 'OWN_NEED'), blockers(pre['requester-self'].match)),
    'other-kind': cause(pre['other-kind'].cheap === false && hasCode(pre['other-kind'].match, 'SERVICE_NOT_IN_WORK_PROFILE'), `cheap ${pre['other-kind'].cheap} ${blockers(pre['other-kind'].match)}`),
    excluded: cause(hasCode(pre.excluded.match, 'PROFILE_EXCLUSION'), blockers(pre.excluded.match)),
    far: cause(hasCode(pre.far.match, 'OUTSIDE_PREFERRED_RADIUS'), blockers(pre.far.match)),
    'blocked-by-worker': cause(db.pairBlocked(workers['blocked-by-worker'].id, requester.id), 'private.safety_pair_blocked(worker, requester)'),
    'blocked-by-requester': cause(db.pairBlocked(requester.id, workers['blocked-by-requester'].id), 'private.safety_pair_blocked(requester, worker)'),
    closure: cause(db.accountRestricted(workers.closure.id), 'private.closure_account_restricted(worker)'),
    applied: cause(responses.some(item => item.worker_account_id === workers.applied.id && item.status === 'SUBMITTED') && before.deliveries.length === 0, `responses ${JSON.stringify(responses.map(item => item.status))}, deliveries before the wave ${before.deliveries.length}`),
    'opportunities-off': cause(preferences?.settings?.opportunities_enabled === false, 'rpc_get_notification_preferences(WORKER).settings.opportunities_enabled'),
  };
  const waves = wavesUntilStopped(ctx, task.needId);
  return waveObservation(ctx, task, workers, pre, causes, waves);
}

// ---------------------------------------------------------------------------------------------- licence and tool
async function licence(ctx) {
  const requester = await ctx.fx.createRequester({label: 's04-licence-requester', world: 'REAL'});
  const equipped = {tools: ['kolica za prenos'], licenses: ['kategorija b']};
  const workers = {equipped: await spawn(ctx, 'equipped', equipped), unlicensed: await spawn(ctx, 'unlicensed', {...equipped, licenses: []}), untooled: await spawn(ctx, 'untooled', {...equipped, tools: []})};
  const task = await publishTask(ctx, requester, {'need.required_tools': ['kolica za prenos'], 'need.required_licenses': ['kategorija b']});
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  const pre = preRead(ctx, task, workers);
  const causes = {equipped: cause(true, 'control'), unlicensed: cause(hasCode(pre.unlicensed.match, 'MISSING_REQUIRED_LICENSE'), blockers(pre.unlicensed.match)), untooled: cause(hasCode(pre.untooled.match, 'MISSING_REQUIRED_TOOL'), blockers(pre.untooled.match))};
  return waveObservation(ctx, task, workers, pre, causes, wavesUntilStopped(ctx, task.needId));
}

// ---------------------------------------------------------------------------------------------- the world, the other way round
async function worldReverse(ctx) {
  const {db} = ctx;
  const requester = await ctx.fx.createRequester({label: 's04-world-requester', world: 'TEST'});
  const workers = {'test-worker': await spawn(ctx, 'test-worker', {world: 'TEST'}), 'real-worker': await spawn(ctx, 'real-worker', {world: 'REAL'})};
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  const pre = preRead(ctx, task, workers);
  const causes = {'test-worker': cause(true, 'control'), 'real-worker': cause(db.accountWorld(workers['real-worker'].id) === 'REAL' && db.accountWorld(requester.id) === 'TEST' && pre['real-worker'].cheap === false,
    `worker ${db.accountWorld(workers['real-worker'].id)}, requester ${db.accountWorld(requester.id)}, cheap gate ${pre['real-worker'].cheap}`)};
  return waveObservation(ctx, task, workers, pre, causes, wavesUntilStopped(ctx, task.needId));
}

// ---------------------------------------------------------------------------------------------- capacity: the team capacity (documented split) and its application-time substitute
async function capacity(ctx) {
  const requester = await ctx.fx.createRequester({label: 's04-capacity-requester', world: 'REAL'});
  const workers = {'cap-high': await spawn(ctx, 'cap-high', {teamCapacity: 3}), 'cap-low': await spawn(ctx, 'cap-low', {teamCapacity: 1})};
  const task = await publishTask(ctx, requester, {'need.people_needed': 3});
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  const pre = preRead(ctx, task, workers);
  const low = ctx.db.profileState(workers['cap-low'].profileId);
  const causes = {'cap-high': cause(true, 'control'), 'cap-low': cause(Number(low.team_capacity) === 1 && task.requiredSlots === 3, `team_capacity ${low.team_capacity}, required slots ${task.requiredSlots}`)};
  const waves = wavesUntilStopped(ctx, task.needId);
  const observation = await waveObservation(ctx, task, workers, pre, causes, waves);
  const application = await ctx.fx.submitApplication(workers['cap-low'], task, {slots: 3});
  return {...observation, application: {ok: application.ok, code: application.ok ? null : application.error.code, message: application.ok ? null : application.error.message}};
}

// ---------------------------------------------------------------------------------------------- target: enough applications, a further wave sends nothing
async function target(ctx) {
  const requester = await ctx.fx.createRequester({label: 's04-target-requester', world: 'REAL'});
  const appliers = [];
  for (const label of ['apply-1', 'apply-2', 'apply-3']) appliers.push(await spawn(ctx, label));
  const late = await spawn(ctx, 'late');
  const task = await publishTask(ctx, requester);
  for (const worker of [...appliers, late]) assertStored(ctx, worker);
  for (const worker of appliers) {
    const application = await ctx.fx.submitApplication(worker, task);
    if (!application.ok) throw new ScenarioError('APPLICATION_REFUSED', JSON.stringify(application.error));
  }
  const applications = ctx.db.responsesOf(task.needId).filter(item => item.status === 'SUBMITTED').length;
  isolateForTick(ctx, task.needId);
  const wave = ctx.fx.runWave(task.needId);
  const step = tickStep(ctx, task.needId, ctx.now() + 1000);
  const ledger = ledgerOf(ctx, task.needId);
  ctx.evidence('target', {applications, wave, tick: step.tick, schedule: step.schedule, deliveries: ledger.deliveries.length});
  return {task: {needId: task.needId, revision: task.revision}, applications, wave: {status: wave.status, reason: wave.reason ?? null, inserted: Number(wave.inserted ?? 0)},
    lateWorker: {deliveries: deliveriesOf(ledger, late), events: distinctEvents(ledger, late.id)}, scheduleAfterTick: {queued: step.schedule.queued}, tick: step.tick};
}

// ---------------------------------------------------------------------------------------------- calendar: an agreement over the window blocks the worker (optional: the booking fixture is not proved yet)
async function calendar(ctx) {
  const nowMs = ctx.now();
  const startsAt = resolveRelativeTime('@now+2d', nowMs), endsAt = resolveRelativeTime('@now+2d+2h', nowMs);
  const interval = {startMs: Date.parse(startsAt), endMs: Date.parse(endsAt), startsAt, endsAt};
  const requester = await ctx.fx.createRequester({label: 's04-calendar-requester', world: 'REAL'});
  const shape = {availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, interval};
  const workers = {free: await spawn(ctx, 'free', shape), busy: await spawn(ctx, 'busy', shape)};
  const task = await publishTask(ctx, requester, {'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': startsAt, 'need.ends_at': endsAt}, {interval});
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  await ctx.fx.bookWorker(workers.busy, {startsAt, endsAt});
  const pre = preRead(ctx, task, workers);
  const causes = {free: cause(true, 'control'), busy: cause(hasCode(pre.busy.match, 'CALENDAR_CONFLICT'), blockers(pre.busy.match))};
  return waveObservation(ctx, task, workers, pre, causes, wavesUntilStopped(ctx, task.needId));
}

// ---------------------------------------------------------------------------------------------- window: TOMORROW_FLEXIBLE, WEEK_FLEXIBLE (the ex06a derived windows) and FIXED_WINDOW
async function windowScenario(ctx) {
  const guard = midnightGuardWaitMs(ctx.now(), BELGRADE);
  if (guard > 0) { ctx.say(`MIDNIGHT_GUARD waiting ${Math.round(guard / 1000)} s`); await ctx.sleep(guard); }
  const availability = (availableNow, rules = [], windows = []) => ({timezone: BELGRADE, availableNow, rules, windows});
  const rule = weekdays => weeklyRule(ctx.newId(), {weekdays, startTime: '08:00:00', endTime: '18:00:00', label: 'EX-06 S04'});

  // ---- sutra: a TOMORROW_FLEXIBLE task stored without a window is matched against the local day after its publication
  const requesterT = await ctx.fx.createRequester({label: 's04-window-tomorrow', world: 'REAL'});
  const taskT = await publishTask(ctx, requesterT, {'need.schedule_kind': 'TOMORROW_FLEXIBLE'});
  const stored = ctx.db.needState(taskT.needId);
  const zone = stored.task_timezone && stored.task_timezone !== '' ? stored.task_timezone : BELGRADE;
  const tomorrow = tomorrowOf(Date.parse(stored.published_at), zone);
  const workersT = {
    'sched-only': await spawn(ctx, 'tomorrow-sched-only', {availability: availability(false, [rule([tomorrow.weekday])])}),
    'live-only': await spawn(ctx, 'tomorrow-live-only', {availability: availability(true)}),
    'other-day': await spawn(ctx, 'tomorrow-other-day', {availability: availability(false, [rule([tomorrow.dayAfter.weekday])])}),
    'blocked-window': await spawn(ctx, 'tomorrow-blocked-window', {availability: availability(false, [rule([tomorrow.weekday])],
      [availabilityWindow(ctx.newId(), {startsAt: iso(tomorrow.startMs), endsAt: iso(tomorrow.endMs), state: 'UNAVAILABLE', label: 'EX-06 S04'})])}),
  };
  for (const worker of Object.values(workersT)) assertStored(ctx, worker);
  const preT = preRead(ctx, taskT, workersT);
  const outside = label => cause(hasCode(preT[label].match, 'OUTSIDE_AVAILABILITY'), blockers(preT[label].match));
  const causesT = {'sched-only': cause(true, 'control'), 'live-only': outside('live-only'), 'other-day': outside('other-day'), 'blocked-window': outside('blocked-window')};
  const tomorrowObs = await waveObservation(ctx, taskT, workersT, preT, causesT, wavesUntilStopped(ctx, taskT.needId));
  tomorrowObs.derived = {zone, publishedAt: stored.published_at, tomorrow: tomorrow.date, weekday: tomorrow.weekday, otherWeekday: tomorrow.dayAfter.weekday};

  // ---- ove nedelje: a WEEK_FLEXIBLE task stored without a window is matched against the rest of the local week
  const requesterW = await ctx.fx.createRequester({label: 's04-window-week', world: 'REAL'});
  const taskW = await publishTask(ctx, requesterW, {'need.schedule_kind': 'WEEK_FLEXIBLE'});
  const everyDay = weeklyRule(ctx.newId(), {weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00:00', endTime: '23:59:00', label: 'EX-06 S04'});
  const workersW = {'all-days': await spawn(ctx, 'week-all-days', {availability: availability(false, [everyDay])}), 'live-only': await spawn(ctx, 'week-live-only', {availability: availability(true)})};
  for (const worker of Object.values(workersW)) assertStored(ctx, worker);
  const preW = preRead(ctx, taskW, workersW);
  const causesW = {'all-days': cause(true, 'control'), 'live-only': cause(hasCode(preW['live-only'].match, 'OUTSIDE_AVAILABILITY'), blockers(preW['live-only'].match))};
  const weekObs = await waveObservation(ctx, taskW, workersW, preW, causesW, wavesUntilStopped(ctx, taskW.needId));

  // ---- a fixed window: availability must cover it
  const nowMs = ctx.now();
  const startsAt = resolveRelativeTime('@now+2d', nowMs), endsAt = resolveRelativeTime('@now+2d+2h', nowMs);
  const interval = {startMs: Date.parse(startsAt), endMs: Date.parse(endsAt), startsAt, endsAt};
  const requesterF = await ctx.fx.createRequester({label: 's04-window-fixed', world: 'REAL'});
  const workersF = {covering: await spawn(ctx, 'fixed-covering', {availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, interval}), 'no-cover': await spawn(ctx, 'fixed-no-cover', {availability: availability(true)})};
  const taskF = await publishTask(ctx, requesterF, {'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': startsAt, 'need.ends_at': endsAt}, {interval});
  for (const worker of Object.values(workersF)) assertStored(ctx, worker);
  const preF = preRead(ctx, taskF, workersF);
  const causesF = {covering: cause(true, 'control'), 'no-cover': cause(hasCode(preF['no-cover'].match, 'OUTSIDE_AVAILABILITY'), blockers(preF['no-cover'].match))};
  const fixedObs = await waveObservation(ctx, taskF, workersF, preF, causesF, wavesUntilStopped(ctx, taskF.needId));
  return {tomorrow: tomorrowObs, week: weekObs, fixed: fixedObs};
}

// ---------------------------------------------------------------------------------------------- waves: order, size, no duplicate, the events once
async function waves(ctx) {
  const requester = await ctx.fx.createRequester({label: 's04-waves-requester', world: 'REAL'});
  const workers = {};
  for (let index = 0; index < 12; index += 1) {
    const label = 'w' + String(index + 1).padStart(2, '0');
    workers[label] = await spawn(ctx, label, {bypass: {ratingWorker: Math.round((5 - index * 0.1) * 10) / 10}});
  }
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  const pre = preRead(ctx, task, workers);
  const eligible = Object.entries(workers).filter(([label]) => pre[label].match.dispatchEligible && pre[label].cheap).map(([label, worker]) => ({label, profileId: worker.profileId, score: pre[label].match.score}));
  if (eligible.length !== 12) throw new ScenarioError('NOT_EVERY_WORKER_IS_ELIGIBLE', `${eligible.length} of 12: ${JSON.stringify(Object.fromEntries(Object.entries(pre).map(([label, item]) => [label, item.match.hardBlockers.concat(item.match.dispatchBlockers)])))}`.slice(0, 400));
  const expected = expectedWaves(eligible, ctx.config.waveSizes);
  const run = wavesUntilStopped(ctx, task.needId, {max: 8});
  const ledger = ledgerOf(ctx, task.needId);
  const sent = run.filter(item => item.status === 'SENT');
  const actual = sent.map(item => ledger.deliveries.filter(row => Number(row.round_no) === item.round).map(row => row.worker_profile_id));
  const perWorker = {};
  for (const [label, worker] of Object.entries(workers)) {
    const mine = ledger.notifications.filter(item => item.recipient_user_id === worker.id), first = mine[0];
    perWorker[worker.profileId] = {label, rounds: ledger.deliveries.filter(row => row.worker_profile_id === worker.profileId).map(row => Number(row.round_no)),
      events: sortedUnique(mine.map(item => item.event_id)).length, inApp: sortedUnique(mine.filter(item => item.channel === 'IN_APP').map(item => item.state + (item.suppression_reason ? ':' + item.suppression_reason : ''))),
      push: sortedUnique(mine.filter(item => item.channel === 'PUSH').map(item => item.state + (item.suppression_reason ? ':' + item.suppression_reason : ''))),
      dedupeKey: first?.dedupe_key ?? null, expectedDedupeKey: `opp:${task.needId}:${task.revision}:${worker.id}`, entityVersion: first ? Number(first.entity_version) : null};
  }
  const totals = {deliveries: ledger.deliveries.length, distinctWorkers: sortedUnique(ledger.deliveries.map(row => row.worker_profile_id)).length, events: sortedUnique(ledger.notifications.map(item => item.event_id)).length,
    inAppRows: ledger.notifications.filter(item => item.channel === 'IN_APP').length, pushRows: ledger.notifications.filter(item => item.channel === 'PUSH').length};
  // a wave called again, and a replayed emit: nothing is added
  const before = countsOf(ledger);
  const again = ctx.fx.runWave(task.needId);
  const afterAgain = countsOf(ledgerOf(ctx, task.needId));
  const first = Object.values(workers)[0];
  const replayed = ctx.db.emitEventReplay({accountId: first.id, needId: task.needId, revision: task.revision});
  const afterReplay = countsOf(ledgerOf(ctx, task.needId));
  const duplicateInsert = ctx.db.duplicateDeliveryInsert({accountId: first.id, profileId: first.profileId, needId: task.needId, revision: task.revision});
  const onConflictRows = ctx.db.duplicateDeliveryOnConflict({accountId: first.id, profileId: first.profileId, needId: task.needId, revision: task.revision});
  ctx.evidence('waves', {config: ctx.config, expected, actual, run});
  return {task: {needId: task.needId, revision: task.revision}, config: {...ctx.config, expectedEligible: 12}, eligible, expected, actual, waves: run, rounds: ledger.rounds.map(roundOf), perWorker, totals,
    replay: {waveStatus: again.status, deliveriesBefore: before.deliveries, deliveriesAfter: afterAgain.deliveries, eventsBefore: before.events, eventsAfter: afterAgain.events},
    eventReplay: {nilReturned: replayed === NIL_UUID, eventsBefore: before.events, eventsAfter: afterReplay.events}, duplicateInsert: {...duplicateInsert, onConflictRows}};
}

// ---------------------------------------------------------------------------------------------- ticks: idempotent re-dispatch, requeue, a new worker, an expired window, a re-classification
async function ticks(ctx) {
  const {fx, api} = ctx;
  const requester = await fx.createRequester({label: 's04-ticks-requester', world: 'REAL'});
  const workers = {A: await spawn(ctx, 'tick-a'), B: await spawn(ctx, 'tick-b'), C: await spawn(ctx, 'tick-c')};
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  isolateForTick(ctx, task.needId);
  const at = offset => ctx.now() + offset;
  const s1 = tickStep(ctx, task.needId, at(1000));
  const s2 = tickStep(ctx, task.needId, at(2000));
  const s3 = tickStep(ctx, task.needId, at(62000));
  // a re-classification (the worker's skills are edited into one more kind) and a requeue writer (a changed team capacity: an unchanged one requeues nothing)
  await api.updateProfile(workers.A, {skills: ['fizicki poslovi', 'selidba']});
  workers.A.spec.final = {...workers.A.spec.final, skills: ['fizicki poslovi', 'selidba']};
  await fx.setCapacity(workers.A, 2);
  const s4 = tickStep(ctx, task.needId, at(1000));
  // a new eligible worker: activation requeues the task at once
  workers.D = await spawn(ctx, 'tick-d');
  assertStored(ctx, workers.D);
  const s5 = tickStep(ctx, task.needId, at(1000));
  s5.previousRoundDeadlineAt = s1.rounds[0]?.deadline_at ?? null;
  // the windows close: the sweep expires the deliveries, the next tick finds nobody new
  const sweepAt = at(16 * MINUTE);
  fx.runExpiry(iso(sweepAt));
  const s6 = tickStep(ctx, task.needId, sweepAt + 1000);
  const ledger = ledgerOf(ctx, task.needId);
  const workerCounts = Object.fromEntries(Object.entries(workers).map(([key, worker]) => [key, {deliveries: deliveriesOf(ledger, worker), events: distinctEvents(ledger, worker.id)}]));
  ctx.evidence('ticks', {steps: {s1, s2, s3, s4, s5, s6}, workerCounts});
  return {task: {needId: task.needId, revision: task.revision}, skillsEdited: true, config: {windowMinutes: ctx.config.windowMinutes}, steps: {s1, s2, s3, s4, s5, s6}, workers: workerCounts};
}

// ---------------------------------------------------------------------------------------------- the closing of the dispatch: expiry and cancellation
async function closing(ctx, kind) {
  const {fx, db} = ctx;
  const requester = await fx.createRequester({label: `s04-${kind}-requester`, world: 'REAL'});
  const workers = {A: await spawn(ctx, kind + '-a'), B: await spawn(ctx, kind + '-b'), C: await spawn(ctx, kind + '-c')};
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) { assertStored(ctx, worker); await pushOn(ctx, worker); }
  if (kind === 'expiry') db.responseDeadlineFixture(task.needId, iso(ctx.now() + 3 * 60 * MINUTE));
  isolateForTick(ctx, task.needId);
  const waveRun = wavesUntilStopped(ctx, task.needId, {max: 1});
  if (waveRun[0].status !== 'SENT' || waveRun[0].inserted !== 3) throw new ScenarioError('THE_WAVE_DID_NOT_REACH_THE_THREE_WORKERS', JSON.stringify(waveRun[0]));
  const before = snapshotOf(ctx, task.needId);
  if (kind === 'expiry') fx.runExpiry(iso(ctx.now() + 4 * 60 * MINUTE));
  else await fx.cancelNeed(requester, task);
  const after = snapshotOf(ctx, task.needId);
  const waveAfter = fx.runWave(task.needId);
  const late = await spawn(ctx, kind + '-late');
  assertStored(ctx, late);
  const requeue = {scheduleQueued: fx.readSchedule(task.needId).queued};
  const step = tickStep(ctx, task.needId, ctx.now() + 1000);
  const ledger = ledgerOf(ctx, task.needId);
  const resolver = await resolveOpportunity(ctx, workers.A, task.needId, ledger);
  ctx.evidence(kind, {before, after, waveAfter, requeue, tick: step.tick, resolver});
  return {task: {needId: task.needId, revision: task.revision}, before, after, waveAfter: {status: waveAfter.status, reason: waveAfter.reason ?? null, inserted: Number(waveAfter.inserted ?? 0)},
    tickAfter: {scheduleQueued: step.schedule.queued, tick: step.tick}, requeue, lateWorker: {deliveries: deliveriesOf(ledger, late), events: distinctEvents(ledger, late.id)}, resolver};
}

// ---------------------------------------------------------------------------------------------- fill: the task is full
async function fill(ctx) {
  const {fx} = ctx;
  const requester = await fx.createRequester({label: 's04-fill-requester', world: 'REAL'});
  const workers = {A: await spawn(ctx, 'fill-a'), B: await spawn(ctx, 'fill-b'), C: await spawn(ctx, 'fill-c')};
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) { assertStored(ctx, worker); await pushOn(ctx, worker); }
  isolateForTick(ctx, task.needId);
  const waveRun = wavesUntilStopped(ctx, task.needId, {max: 1});
  if (waveRun[0].status !== 'SENT' || waveRun[0].inserted !== 3) throw new ScenarioError('THE_WAVE_DID_NOT_REACH_THE_THREE_WORKERS', JSON.stringify(waveRun[0]));
  const before = snapshotOf(ctx, task.needId);
  const application = await fx.submitApplication(workers.A, task);
  if (!application.ok) throw new ScenarioError('APPLICATION_REFUSED', JSON.stringify(application.error));
  await fx.selectResponse(requester, task, application.data);
  const after = snapshotOf(ctx, task.needId);
  const waveAfter = fx.runWave(task.needId);
  const late = await spawn(ctx, 'fill-late');
  assertStored(ctx, late);
  const step = tickStep(ctx, task.needId, ctx.now() + 1000);
  const ledger = ledgerOf(ctx, task.needId);
  const resolver = await resolveOpportunity(ctx, workers.B, task.needId, ledger);
  ctx.evidence('fill', {before, after, waveAfter, tick: step.tick, resolver});
  return {task: {needId: task.needId, revision: task.revision}, before, after, waveAfter: {status: waveAfter.status, reason: waveAfter.reason ?? null, inserted: Number(waveAfter.inserted ?? 0)},
    tickAfter: {scheduleQueued: step.schedule.queued, tick: step.tick}, requeue: {scheduleQueued: false}, lateWorker: {deliveries: deliveriesOf(ledger, late), events: distinctEvents(ledger, late.id)}, resolver};
}

// ---------------------------------------------------------------------------------------------- search: the remaining search is closed, then an agreement is cancelled (optional: close and cancel are not proved yet)
async function search(ctx) {
  const {fx, db, api} = ctx;
  const requester = await fx.createRequester({label: 's04-search-requester', world: 'REAL'});
  const workers = {A: await spawn(ctx, 'search-a'), B: await spawn(ctx, 'search-b')};
  const task = await publishTask(ctx, requester, {'need.people_needed': 2});
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  isolateForTick(ctx, task.needId);
  const waveRun = wavesUntilStopped(ctx, task.needId, {max: 1});
  if (waveRun[0].status !== 'SENT' || waveRun[0].inserted !== 2) throw new ScenarioError('THE_WAVE_DID_NOT_REACH_THE_TWO_WORKERS', JSON.stringify(waveRun[0]));
  const application = await fx.submitApplication(workers.A, task, {slots: 1});
  if (!application.ok) throw new ScenarioError('APPLICATION_REFUSED', JSON.stringify(application.error));
  const agreementId = await fx.selectResponse(requester, task, application.data);
  await api.closeRemainingSearch(requester, {needId: task.needId, revision: task.revision});
  const closed = db.needState(task.needId);
  const afterClose = {...snapshotOf(ctx, task.needId), searchClosed: closed.search_closed === true, needStatus: closed.status};
  // a worker who becomes eligible: the requeue filters closed searches
  const c = await spawn(ctx, 'search-c');
  assertStored(ctx, c);
  const requeueAfterClose = {scheduleQueued: fx.readSchedule(task.needId).queued};
  // the selected worker cancels the agreement: the task is re-enqueued
  await api.cancelAgreement(workers.A, agreementId);
  isolateForTick(ctx, task.needId);
  const requeued = fx.readSchedule(task.needId).queued;
  const first = tickStep(ctx, task.needId, ctx.now() + 1000);
  const repeat = tickStep(ctx, task.needId, ctx.now() + 11 * MINUTE);
  ctx.evidence('search', {afterClose, requeueAfterClose, first, repeat});
  return {task: {needId: task.needId, revision: task.revision}, afterClose, requeueAfterClose,
    afterCancel: {requeued, tick: first.tick, schedule: first.schedule, repeat: {tick: repeat.tick, schedule: repeat.schedule}}};
}

// ---------------------------------------------------------------------------------------------- revision: a confirmed material edit (optional: the confirm and the re-publication fixture are not proved yet)
async function revision(ctx) {
  const {fx, db, api} = ctx;
  const requester = await fx.createRequester({label: 's04-revision-requester', world: 'REAL'});
  const workers = {A: await spawn(ctx, 'revision-a'), B: await spawn(ctx, 'revision-b')};
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  isolateForTick(ctx, task.needId);
  const waveRun = wavesUntilStopped(ctx, task.needId, {max: 1});
  if (waveRun[0].status !== 'SENT' || waveRun[0].inserted !== 2) throw new ScenarioError('THE_WAVE_DID_NOT_REACH_THE_TWO_WORKERS', JSON.stringify(waveRun[0]));
  const eventsOf = ledger => sortedUnique(ledger.notifications.map(item => item.event_id)).map(id => {
    const row = ledger.notifications.find(item => item.event_id === id);
    return {account: row.recipient_user_id, entityVersion: Number(row.entity_version), dedupeKey: row.dedupe_key};
  });
  const ledger1 = ledgerOf(ctx, task.needId);
  const v1 = {events: eventsOf(ledger1), deliveries: snapshotOf(ctx, task.needId).deliveries};
  const material = db.materialSnapshot(task.needId);
  await api.confirmNeedEdit(requester, {needId: task.needId, revision: task.revision, material: {...material, title: material.title + ' (izmenjeno)'}});
  const edited = db.needState(task.needId), snapshot = snapshotOf(ctx, task.needId);
  const edit = {status: edited.status, revision: Number(edited.revision), scheduleQueued: snapshot.schedule.queued, deliveries: snapshot.deliveries,
    round1StopReason: snapshot.rounds.find(item => item.round_no === 1)?.stop_reason ?? null};
  const waveWhileDraft = fx.runWave(task.needId);
  db.republishFixture(task.needId);
  const republishedState = db.needState(task.needId);
  const republished = {status: republishedState.status, revision: Number(republishedState.revision), scheduleQueued: fx.readSchedule(task.needId).queued};
  const second = wavesUntilStopped(ctx, task.needId, {max: 1});
  const ledger2 = ledgerOf(ctx, task.needId);
  const v2 = {events: eventsOf(ledger2), deliveries: snapshotOf(ctx, task.needId).deliveries};
  ctx.evidence('revision', {v1, edit, republished, second, v2});
  return {task: {needId: task.needId, revision: task.revision}, worker: workers.A.id, v1, edit, waveWhileDraft: {status: waveWhileDraft.status, reason: waveWhileDraft.reason ?? null, inserted: Number(waveWhileDraft.inserted ?? 0)},
    republished, v2};
}

// ---------------------------------------------------------------------------------------------- requeue: probe (a), the manual edit of a profile does not requeue
async function requeue(ctx) {
  const {fx, db, api} = ctx;
  const requester = await fx.createRequester({label: 's04-requeue-requester', world: 'REAL'});
  const worker = await spawn(ctx, 'requeue-w');
  const task = await publishTask(ctx, requester, {'need.required_tools': ['kolica za prenos']});
  assertStored(ctx, worker);
  isolateForTick(ctx, task.needId);
  const schedule = () => fx.readSchedule(task.needId);
  const read = () => ({nextRunAt: schedule().nextRunAt, attempts: schedule().attempts, readAt: iso(ctx.now())});
  const cheapBeforeEdit = db.cheapGate(task.needId, worker.profileId);
  const first = tickStep(ctx, task.needId, ctx.now() + 1000);
  const deliveredBeforeEdit = deliveriesOf(ledgerOf(ctx, task.needId), worker) > 0;
  const afterFirstTick = read();
  // the manual edit of an ACTIVE profile: the owner UPDATE of the tools list
  await api.updateProfile(worker, {tools: ['kolica za prenos']});
  worker.spec.final = {...worker.spec.final, tools: ['kolica za prenos']};
  const cheapAfterEdit = db.cheapGate(task.needId, worker.profileId);
  const afterManualEdit = read();
  const beforeDue = tickStep(ctx, task.needId, ctx.now() + 60000);
  // a writer that requeues: the team capacity changes (1 -> 2)
  await fx.setCapacity(worker, 2);
  const afterRequeueWriter = read();
  const final = tickStep(ctx, task.needId, ctx.now() + 1000);
  const deliveredAfterRequeue = deliveriesOf(ledgerOf(ctx, task.needId), worker) > 0;
  // the worst case: a task nobody can serve backs off 5, 5, 5, 8, 16 ... up to 360 minutes
  const requesterB = await fx.createRequester({label: 's04-requeue-backoff', world: 'REAL'});
  const hopeless = await publishTask(ctx, requesterB, {'need.required_tools': ['nepostojeci alat']});
  isolateForTick(ctx, hopeless.needId);
  const backoff = [];
  let atMs = ctx.now() + 1000;
  for (let index = 0; index < 11; index += 1) {
    const step = tickStep(ctx, hopeless.needId, atMs);
    if (step.tick.processed !== 1) throw new ScenarioError('THE_HOPELESS_TASK_WAS_NOT_CLAIMED', JSON.stringify(step.tick));
    backoff.push({attempts: step.schedule.attempts, delayMinutes: Math.round((Date.parse(step.schedule.nextRunAt) - Date.parse(step.at)) / MINUTE)});
    atMs = Date.parse(step.schedule.nextRunAt) + 1000;
  }
  ctx.evidence('requeue', {afterFirstTick, afterManualEdit, afterRequeueWriter, first: first.tick, beforeDue: beforeDue.tick, final: final.tick, backoff});
  return {task: {needId: task.needId, revision: task.revision}, worker: worker.label, cheapBeforeEdit, deliveredBeforeEdit, cheapAfterEdit, deliveredAfterRequeue, steps: {afterFirstTick, afterManualEdit, afterRequeueWriter}, backoff};
}

// ---------------------------------------------------------------------------------------------- resolver: probe (e) for tasks that are still open
async function resolver(ctx) {
  const {fx} = ctx;
  const requester = await fx.createRequester({label: 's04-resolver-requester', world: 'REAL'});
  const workers = {eligible: await spawn(ctx, 'resolver-eligible'), suspended: await spawn(ctx, 'resolver-suspended'), applied: await spawn(ctx, 'resolver-applied')};
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  isolateForTick(ctx, task.needId);
  const waveRun = wavesUntilStopped(ctx, task.needId, {max: 1});
  if (waveRun[0].status !== 'SENT' || waveRun[0].inserted !== 3) throw new ScenarioError('THE_WAVE_DID_NOT_REACH_THE_THREE_WORKERS', JSON.stringify(waveRun[0]));
  setStatus(ctx, workers.suspended, 'SUSPENDED');
  const application = await fx.submitApplication(workers.applied, task);
  if (!application.ok) throw new ScenarioError('APPLICATION_REFUSED', JSON.stringify(application.error));
  const ledger = ledgerOf(ctx, task.needId);
  const state = async (name, worker) => ({name, ...(await resolveOpportunity(ctx, worker, task.needId, ledger))});
  const states = [await state('live, eligible', workers.eligible), await state('live, worker suspended', workers.suspended), await state('live, worker already applied', workers.applied)];
  ctx.evidence('resolver', {states});
  return {task: {needId: task.needId, revision: task.revision}, states};
}

// ---------------------------------------------------------------------------------------------- push: probes (c) and (d). Runs LAST: its claim closes the pending PUSH rows of every earlier scenario.
async function push(ctx) {
  const {fx, db, api} = ctx;
  const requester = await fx.createRequester({label: 's04-push-requester', world: 'REAL'});
  const labels = ['inherit', 'worker-on', 'quiet-emit', 'quiet-claim', 'stale'];
  const workers = {};
  for (const label of labels) workers[label] = await spawn(ctx, 'push-' + label);
  const task = await publishTask(ctx, requester);
  for (const worker of Object.values(workers)) assertStored(ctx, worker);
  // push enabled on the OTHER role only (the PKG-029a inheritance), on the WORKER role, with quiet hours covering the whole day, and plain
  await pushOn(ctx, workers.inherit, 'REQUESTER');
  await pushOn(ctx, workers['worker-on']);
  await pushOn(ctx, workers['quiet-emit'], 'WORKER', {quiet_hours_enabled: true, quiet_start: '00:00:00', quiet_end: '23:59:59.999999'});
  await pushOn(ctx, workers['quiet-claim']);
  await pushOn(ctx, workers.stale);
  isolateForTick(ctx, task.needId);
  const run = wavesUntilStopped(ctx, task.needId, {max: 1});
  if (run[0].status !== 'SENT' || run[0].inserted !== 5) throw new ScenarioError('THE_WAVE_DID_NOT_REACH_THE_FIVE_WORKERS', JSON.stringify(run[0]));
  const ledger = ledgerOf(ctx, task.needId);
  const rowOf = (label, channel) => {
    const row = ledger.notifications.find(item => item.recipient_user_id === workers[label].id && item.channel === channel);
    if (!row) throw new ScenarioError('NO_NOTIFICATION_ROW', `${label} ${channel}`);
    return row;
  };
  const stateText = row => row.state + (row.suppression_reason ? ':' + row.suppression_reason : '');
  const result = Object.fromEntries(labels.map(label => [label, {label, emit: {inApp: stateText(rowOf(label, 'IN_APP')), push: stateText(rowOf(label, 'PUSH'))}, pushDeliveryId: rowOf(label, 'PUSH').delivery_id}]));
  // the sender gate before anything changes
  for (const label of labels) result[label].suppressionBefore = db.pushSuppression(result[label].pushDeliveryId);
  // what happens afterwards: the stale worker is suspended, quiet hours begin for one and end for the other
  setStatus(ctx, workers.stale, 'SUSPENDED');
  await fx.setNotificationPreferences(workers['quiet-claim'], 'WORKER', {push_enabled: true, quiet_hours_enabled: true, quiet_start: '00:00:00', quiet_end: '23:59:59.999999'});
  await fx.setNotificationPreferences(workers['quiet-emit'], 'WORKER', {push_enabled: true, quiet_hours_enabled: false});
  // the task is filled by the worker who applied
  const application = await fx.submitApplication(workers['worker-on'], task);
  if (!application.ok) throw new ScenarioError('APPLICATION_REFUSED', JSON.stringify(application.error));
  await fx.selectResponse(requester, task, application.data);
  const needStatusAfter = db.needState(task.needId).status;
  if (needStatusAfter !== 'ACTIVE') throw new ScenarioError('THE_TASK_IS_NOT_FILLED', String(needStatusAfter));
  for (const label of labels) {
    result[label].suppressionAfter = db.pushSuppression(result[label].pushDeliveryId);
    const row = db.notificationDelivery(result[label].pushDeliveryId);
    result[label].afterChange = {state: row.state, reason: row.suppression_reason ?? null};
  }
  result['quiet-emit'].afterQuietOff = result['quiet-emit'].afterChange;
  result.stale.profileStatusAfter = db.profileState(workers.stale.profileId).profile_status;
  // the push sender's claim (database only: no Edge function, no device, nothing is sent): until none of the five rows is CREATED any more
  const ids = labels.map(label => result[label].pushDeliveryId);
  let calls = 0;
  for (; calls < 6;) {
    await api.claimPush();
    calls += 1;
    if (!db.notificationDeliveries(ids).some(row => row.state === 'CREATED')) break;
  }
  for (const label of labels) {
    const row = db.notificationDelivery(result[label].pushDeliveryId);
    result[label].claimed = {state: row.state, reason: row.suppression_reason ?? null, pushStartedAt: row.push_started_at !== null && row.push_started_at !== undefined};
  }
  const body = db.functionBody('private.push_suppression(public.notification_deliveries)');
  ctx.evidence('push', {workers: result, claimCalls: calls});
  return {task: {needId: task.needId, revision: task.revision}, fill: {needStatusAfter}, static: {pushSuppressionReadsTaskOrEligibility: bodyReadsTaskOrEligibility(body), bodyLength: String(body ?? '').length}, claim: {calls}, workers: result};
}

/** The scenarios in the order they run. optional = rests on a fixture path no CI run has proved yet: its failure is PARTIAL, not a broken harness. */
export const SCENARIOS = Object.freeze([
  {id: 'reach', title: 'reach: sixteen workers, one task, waves until the dispatch stops', run: reach},
  {id: 'licence', title: 'a licence and a tool', run: licence},
  {id: 'worldReverse', title: 'the world, the other way round', run: worldReverse},
  {id: 'capacity', title: 'team capacity (documented split) and its application-time gate', run: capacity},
  {id: 'target', title: 'the response target is reached', run: target},
  {id: 'calendar', title: 'a busy calendar', optional: true, run: calendar},
  {id: 'window', title: 'sutra, ove nedelje and a fixed window', run: windowScenario},
  {id: 'waves', title: 'wave order, size, no duplicate, events once', run: waves},
  {id: 'ticks', title: 'tick idempotency, requeue, a new worker, an expired window, a re-classification', run: ticks},
  {id: 'expiry', title: 'an expired task closes the dispatch', run: ctx => closing(ctx, 'expiry')},
  {id: 'cancel', title: 'a cancelled task closes the dispatch', run: ctx => closing(ctx, 'cancel')},
  {id: 'fill', title: 'a filled task sends nothing more', run: fill},
  {id: 'search', title: 'a closed remaining search and an agreement cancellation', optional: true, run: search},
  {id: 'revision', title: 'a confirmed material edit', optional: true, run: revision},
  {id: 'requeue', title: 'probe (a): the manual edit of a profile', run: requeue},
  {id: 'resolver', title: 'probe (e): the Inbox resolver for an open task', run: resolver},
  {id: 'push', title: 'probes (c) and (d): the push sender gate', run: push},
]);
