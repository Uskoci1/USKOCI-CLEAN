// EX-06 S03/S04: reusable fixture builders for a disposable chain with actual Auth and PostgREST. S04 (the dispatch-lifecycle proof) imports them.
//
//   import * as rt from '../pre_v3/closure_runtime.mjs';          // the existing proof-only local adapter (refuses any non-loopback target)
//   import {createFixtures} from './lib/fixtures.mjs';
//   const fx = createFixtures(rt, {needPath: 'product'});
//
// Every helper names the real product function(s) it wraps and says where it BYPASSES the product and why. Nothing here calls DEV, a provider or a paid service.
// The product's task path is the post-W03 one that supabase/proofs/pkg023/pkg023_flow.mjs already uses: open conversation -> claim/dispatch/complete a turn (the service writes the
// provider's proposals; here synthetic) -> prepare review with a confirmed location -> accept -> evaluate (service; the decision is a synthetic ALLOW, no provider) -> publish.
// The direct service writer rpc_ai_apply_interview_turn_v2_service is REVOKED from service_role since W03, so it is not used.
//
// Every RPC the fixtures send carries an abort signal (30 s): PostgREST 14 re-executes a function that raises 40001 without end, and on a chain that does not carry B24 part 1 a
// first-run mismatch would otherwise hang a case until the job timeout. Every fixture is READ BACK (readBackNeed / readBackWorker): a field the product dropped or normalised is a
// harness error, never a worker that is "blocked for the wrong reason".
//
// Isolation: the matcher and the wave look at EVERY worker profile of the database. After a case, retireSince() suspends that case's workers (including a half-built one) and removes
// the schedule rows of its tasks (including an orphan accepted-but-unpublished one); parkForeign() suspends the workers that were on the chain before the harness and restoreForeign()
// puts them back.
import {BYPASS_FACT_KEYS, LOCATION_AUTHORITY_KEYS, checkWorkerProfile, factsAtTime} from './corpus.mjs';
import {HarnessInputError, sortedSet} from './compare.mjs';
import {DEFAULT_CITY, anchorCity, cityCentre, pinFor, primaryCity} from './geo.mjs';
import {availabilityFor, shapeWantsCoverage} from './timeutil.mjs';

export const DEFAULT_GEOGRAPHY = Object.freeze({mode: 'STATIONARY', start: {city: DEFAULT_CITY}});
export const DEFAULT_AVAILABILITY = Object.freeze({timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []});
export const ABORT_MS = 30000;
export const TEST_WORLD_LINEAGE = 'SYNTHETIC_ACCEPTANCE_FIXTURE';   // private.accounts_same_world: TEST = DEV_ACCEPTANCE_QA, SYNTHETIC_ACCEPTANCE_FIXTURE or OPERATOR
export const TEST_LINEAGES = Object.freeze(['DEV_ACCEPTANCE_QA', 'SYNTHETIC_ACCEPTANCE_FIXTURE', 'OPERATOR']);
// The steps of the product path that are infrastructure: a conversation that cannot be opened is a harness error; so is a turn that cannot be CLAIMED (EX06_TURN_NOT_CLAIMED), a timeout and an
// abort (isInfrastructureFailure). A refusal at any other step, 'provider_turns' included (the proposals are the corpus's own facts, which the service RPC validates: V2_FACT_* errors),
// is the PRODUCT refusing a READY case: a finding of that case, not a failure of the whole run.
export const INFRA_STEPS = Object.freeze(['open_conversation']);
/** A call that timed out (the 30 s abort signal) or was aborted is the harness or the chain failing, never the product refusing a task: a harness error at every step. */
export const ABORT_PATTERN = /AbortError|TimeoutError|operation was aborted|aborted due to timeout/i;
/** True when a failure of the product path is the harness's (infrastructure) and not a refusal of the product: an infrastructure step, a turn that was not claimed, a timeout or an abort. */
export function isInfrastructureFailure(step, error) {
  const message = String(error?.message ?? error);
  return INFRA_STEPS.includes(step) || (step === 'provider_turns' && /EX06_TURN_NOT_CLAIMED/.test(message)) || ABORT_PATTERN.test(message);
}
/** GoTrue's per-IP rate limit as the supabase-js adapter reports it: HTTP 429 / over_request_rate_limit / over_email_send_rate_limit / "rate limit" / "too many requests". */
export const RATE_LIMIT_PATTERN = /\b429\b|over_request_rate_limit|over_email_send_rate_limit|rate limit|too many requests/i;
export const isRateLimit = error => error?.status === 429 || error?.code === 'over_request_rate_limit' || RATE_LIMIT_PATTERN.test(String(error?.message ?? error));
/** The defaults of the bounded Auth retry: 30 s steps (the limits are per 5 minutes) up to 6 minutes per account and 20 minutes per run. */
export const AUTH_RETRY_DEFAULTS = Object.freeze({backoffMs: 30000, maxWaitMs: 6 * 60000, maxTotalWaitMs: 20 * 60000});
// Every need.* fact the direct insert writes. Anything else in the facts is DROPPED by it and listed.
const DIRECT_WRITES = Object.freeze(['need.title', 'need.description', 'need.category', 'need.required_skills', 'need.required_tools', 'need.required_vehicles', 'need.required_licenses',
  'need.minimum_experience_years', 'need.verified_identity_required', 'need.people_needed', 'need.schedule_kind', 'need.starts_at', 'need.ends_at', 'need.task_country_code',
  'need.task_geography', 'need.price_mode', 'need.price_rsd']);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const asList = value => (Array.isArray(value) ? value : []);
const lowerSet = list => sortedSet(asList(list).filter(item => typeof item === 'string').map(item => item.trim().toLowerCase()));

/** The slots a geography needs a confirmed pin for (the vocabulary of supabase/proofs/policy/publication_fixtures.mjs locationCases). REMOTE needs none. */
export function slotsForGeography(geography) {
  switch (geography.mode) {
    case 'STATIONARY': return ['start'];
    case 'POINT_TO_POINT': return ['start', 'end'];
    case 'MULTI_STOP': return ['start', ...asList(geography.waypoints).map((_, i) => `waypoints/${i}`), 'end'];
    case 'AREA_BASED': return ['serviceArea', 'start'];
    default: return [];
  }
}

/** The city a slot of a geography is pinned in: the slot's own city, else the route's primary city (a waypoint with only a label sits in the route's city). */
export function slotCity(geography, slot) {
  const own = slot === 'start' ? geography.start?.city : slot === 'end' ? geography.end?.city : slot === 'serviceArea' ? geography.serviceArea?.city
    : geography.waypoints?.[Number(/^waypoints\/(\d+)$/.exec(slot)?.[1])]?.city;
  const city = own ?? primaryCity(geography);
  if (!city) throw new HarnessInputError('EX06_CITY_UNKNOWN', `no city for the slot ${slot} of ${JSON.stringify(geography)}`);
  return city;
}

/** The location value of rpc_prepare_ai_task_review / rpc_save_need_location_review for a task's facts (shape of locationFixture() in publication_fixtures.mjs). Pins come from the city table. */
export function locationValueFor(facts) {
  const geography = facts['need.task_geography'] ?? DEFAULT_GEOGRAPHY;
  const country = facts['need.task_country_code'] ?? 'RS';
  const exactAddress = facts['need.exact_address'] ?? null;
  const accessNotes = facts['need.access_notes'] ?? null;
  const slots = slotsForGeography(geography);
  const resolvedLocation = facts['need.resolved_location'] ?? (slots.length === 0 ? null
    : {version: 1, binding: {taskCountryCode: country, geography, exactAddress}, points: slots.map(slot => pinFor(slot, slotCity(geography, slot)))});
  return {taskCountryCode: country, geography, exactAddress, accessNotes, resolvedLocation};
}

/** The AI proposals of a task's facts: every fact the product's AI path can carry, as the provider's output would arrive (synthetic here). */
export function proposalsFor(facts) {
  return Object.entries(facts).filter(([key]) => !LOCATION_AUTHORITY_KEYS.includes(key) && !BYPASS_FACT_KEYS.includes(key))
    .map(([key, value]) => ({key, value, displayValue: Array.isArray(value) ? value.join(', ') : String(value), evidence: 'Synthetic EX-06 fixture input', confidence: 1}));
}

/** A weekly availability rule in the shape rpc_save_worker_availability accepts (needs a uuid id and an endsOn key). */
export const weeklyRule = (id, {weekdays, startTime, endTime, startsOn = '2026-01-01', endsOn = null, label = 'EX-06 fixture', active = true}) =>
  ({id, weekdays, startTime, endTime, startsOn, endsOn, label, active});
/** An availability exception window. state: 'AVAILABLE' | 'UNAVAILABLE'. */
export const availabilityWindow = (id, {startsAt, endsAt, state = 'UNAVAILABLE', label = 'EX-06 fixture'}) => ({id, startsAt, endsAt, state, label});

// ------------------------------------------------------------------ read-back comparisons (pure)
const near = (a, b, tolerance) => a !== null && a !== undefined && b !== null && b !== undefined && Math.abs(Number(a) - Number(b)) <= tolerance;

/**
 * What a published task row must say about the intent. `intent` = {facts (materialised), interval}. Returns [{field, expected, actual}] (empty = applied).
 * The only product normalisations allowed are order and case/surrounding whitespace of the capability lists, and a stored approximate_city that is empty (not compared, but then the
 * coordinates must be there). starts_at / ends_at are compared as instants.
 */
export function diffNeedReadBack(intent, row) {
  const f = intent.facts, out = [];
  const same = (field, expected, actual) => { if (JSON.stringify(expected) !== JSON.stringify(actual)) out.push({field, expected, actual}); };
  same('status', 'PUBLISHED', row.status);
  same('category', String(f['need.category'] ?? '').trim().toLowerCase(), String(row.category ?? '').trim().toLowerCase());
  for (const [key, column] of [['need.required_skills', 'required_skills'], ['need.required_tools', 'required_tools'], ['need.required_vehicles', 'required_vehicles'], ['need.required_licenses', 'required_licenses']]) {
    same(column, lowerSet(f[key]), lowerSet(row[column]));
  }
  same('minimum_experience_years', Number(f['need.minimum_experience_years'] ?? 0), Number(row.minimum_experience_years ?? 0));
  same('verified_identity_required', f['need.verified_identity_required'] === true, row.verified_identity_required === true);
  same('required_slots', Number(f['need.people_needed'] ?? 1), Number(row.required_slots));
  same('schedule_kind', f['need.schedule_kind'] ?? 'FLEXIBLE', row.schedule_kind);
  const geography = f['need.task_geography'] ?? DEFAULT_GEOGRAPHY;
  same('execution_location_mode', geography.mode, row.execution_location_mode);
  same('mode', f['need.price_mode'] ?? 'OFFERS', row.mode);
  // urgent picks dispatch_urgent against dispatch_normal wave sizes and the same-day-urgent soft gate. The corpus says every task is non-urgent (HITNO is off by policy, no such fact exists),
  // so a stored urgent flag is a task the product turned urgent behind the harness's back: FIXTURE_NOT_APPLIED:urgent, not a worker that is "blocked for the wrong reason".
  same('urgent', f['need.urgent'] === true, row.urgent === true);
  if ((f['need.price_mode'] ?? 'OFFERS') === 'MY_PRICE' && f['need.price_rsd'] !== undefined) same('requester_price_rsd', Number(f['need.price_rsd']), row.requester_price_rsd === null ? null : Number(row.requester_price_rsd));
  if (intent.interval) {
    for (const [column, key] of [['starts_at', 'startMs'], ['ends_at', 'endMs']]) {
      const actual = row[column] ? Date.parse(row[column]) : null;
      if (actual !== intent.interval[key]) out.push({field: column, expected: new Date(intent.interval[key]).toISOString(), actual: row[column] ?? null});
    }
  }
  // The coarse coordinates sit on the ANCHOR point (for AREA_BASED with a service area: the service area's, even when the route names a start in another city); the city TEXT is the
  // start's first. They differ only when the geography names two cities, which no S02 case does; the product does exactly this (w02_resolved_location_authority).
  const anchor = anchorCity(geography), city = primaryCity(geography);
  if (anchor) {
    const centre = cityCentre(anchor);
    if (!near(row.approximate_lat, centre.latitude, 0.0051)) out.push({field: 'approximate_lat', expected: centre.latitude, actual: row.approximate_lat ?? null});
    if (!near(row.approximate_lng, centre.longitude, 0.0051)) out.push({field: 'approximate_lng', expected: centre.longitude, actual: row.approximate_lng ?? null});
  }
  if (city && String(row.approximate_city ?? '').trim() !== '' && String(row.approximate_city).trim().toLowerCase() !== city.trim().toLowerCase()) out.push({field: 'approximate_city', expected: city, actual: row.approximate_city});
  return out;
}

const timeText = value => (typeof value === 'string' && /^\d{2}:\d{2}$/.test(value) ? value + ':00' : value);
const weekdaysOf = list => JSON.stringify([...(Array.isArray(list) ? list : [])].map(Number).sort((a, b) => a - b));

/**
 * What a worker's stored availability rules and windows must say about the spec (by id: the product stores the ids the document carries). A writer that normalised the generated rule
 * (weekday, start / end time, startsOn, a '24:00:00' end) or the window (instants, state) would otherwise be reported as a matcher finding (OUTSIDE_AVAILABILITY on the fit worker) instead
 * of FIXTURE_NOT_APPLIED. rule_docs / window_docs are the rows read back by readBackWorker; when they are missing the read-back itself failed.
 */
export function diffAvailabilityContent(availability, row) {
  const out = [];
  if (!Array.isArray(row.rule_docs) || !Array.isArray(row.window_docs)) return [{field: 'availability_content', expected: 'the stored rules and windows (rule_docs, window_docs)', actual: null}];
  const storedRules = new Map(row.rule_docs.map(item => [item.id, item])), storedWindows = new Map(row.window_docs.map(item => [item.id, item]));
  for (const rule of availability.rules) {
    const stored = storedRules.get(rule.id);
    const wanted = {weekdays: weekdaysOf(rule.weekdays), startTime: timeText(rule.startTime), endTime: timeText(rule.endTime), startsOn: rule.startsOn ?? null, endsOn: rule.endsOn ?? null, active: rule.active !== false};
    const actual = stored ? {weekdays: weekdaysOf(stored.weekdays), startTime: timeText(stored.startTime), endTime: timeText(stored.endTime), startsOn: stored.startsOn ?? null, endsOn: stored.endsOn ?? null, active: stored.active === true} : null;
    if (JSON.stringify(wanted) !== JSON.stringify(actual)) out.push({field: 'availability_rule_content', expected: wanted, actual});
  }
  for (const window of availability.windows) {
    const stored = storedWindows.get(window.id);
    const wanted = {startMs: Date.parse(window.startsAt), endMs: Date.parse(window.endsAt), state: window.state ?? 'UNAVAILABLE'};
    const actual = stored ? {startMs: Number(stored.startMs), endMs: Number(stored.endMs), state: stored.state} : null;
    if (JSON.stringify(wanted) !== JSON.stringify(actual)) out.push({field: 'availability_window_content', expected: wanted, actual});
  }
  return out;
}

/**
 * What a worker's stored rows must say about the spec the fixture built (spec as stored in worker.spec). Returns [{field, expected, actual}] (empty = applied).
 * Compared only what the fixture wrote: lists (order and case free), status, available_now, radius, city, capacity, coordinates, the bypass columns and preferences it set, the number of
 * active weekly rules and windows AND their content (diffAvailabilityContent), and the world (lineage) it was admitted to.
 */
export function diffWorkerReadBack(spec, row) {
  const out = [];
  const same = (field, expected, actual) => { if (JSON.stringify(expected) !== JSON.stringify(actual)) out.push({field, expected, actual}); };
  same('profile_status', spec.status, row.profile_status);
  for (const key of ['skills', 'tools', 'vehicles', 'licenses']) same(key, lowerSet(spec.final[key]), lowerSet(row[key]));
  same('exclusions', lowerSet(spec.bypass?.exclusions ?? []), lowerSet(row.exclusions));
  if (spec.location) {
    same('radius_km', spec.radiusKm, Number(row.radius_km));
    same('city', spec.location.city, row.city);
    if (spec.location.position) {
      if (!near(row.lat, spec.location.position.latitude, 0.0051)) out.push({field: 'approximate_lat', expected: spec.location.position.latitude, actual: row.lat ?? null});
      if (!near(row.lng, spec.location.position.longitude, 0.0051)) out.push({field: 'approximate_lng', expected: spec.location.position.longitude, actual: row.lng ?? null});
    }
  }
  if (spec.teamCapacity !== undefined) same('team_capacity', spec.teamCapacity, Number(row.team_capacity));
  if (spec.availability) {
    same('available_now', spec.availability.availableNow, row.available_now === true);
    same('availability_rules', spec.availability.rules.filter(rule => rule.active !== false).length, Number(row.rules));
    same('availability_windows', spec.availability.windows.length, Number(row.windows));
    out.push(...diffAvailabilityContent(spec.availability, row));
  }
  if (spec.bypass?.yearsExperience !== undefined) same('years_experience', spec.bypass.yearsExperience, Number(row.years_experience));
  if (spec.bypass?.minimumFeeRsd !== undefined) same('minimum_fee_rsd', spec.bypass.minimumFeeRsd, Number(row.minimum_fee_rsd));
  if (spec.bypass?.proactiveNotifications !== undefined) same('proactive_notifications', spec.bypass.proactiveNotifications, row.proactive_notifications === true);
  if (spec.bypass?.sameDayUrgentNotifications !== undefined) same('same_day_urgent_notifications', spec.bypass.sameDayUrgentNotifications, row.same_day_urgent_notifications === true);
  same('world', spec.world, TEST_LINEAGES.includes(row.lineage) ? 'TEST' : 'REAL');
  return out;
}

export function createFixtures(rt, options = {}) {
  const {q, sql, rows, ok, randomUUID, service, actor} = rt;
  const defaultPath = options.needPath ?? process.env.EX06_NEED_PATH ?? 'product';
  if (!['product', 'direct', 'auto'].includes(defaultPath)) throw new Error('EX06_NEED_PATH_INVALID:' + defaultPath);
  const abortMs = options.abortMs ?? ABORT_MS;
  const retry = {...AUTH_RETRY_DEFAULTS, ...(options.authRetry ?? {})};
  const pause = options.sleep ?? sleep;
  const auth = {accountsCreated: 0, retries: 0, rateLimited: 0, waitedMs: 0, failures: 0, backoffMs: retry.backoffMs, maxWaitMs: retry.maxWaitMs, maxTotalWaitMs: retry.maxTotalWaitMs};
  let flowPromise = null;
  const flow = () => options.flow ? Promise.resolve(options.flow) : (flowPromise ??= import('../../pkg023/pkg023_flow.mjs'));
  const created = {requesters: [], workers: [], needs: []};
  const uuidList = list => `array[${list.map(id => q(id) + '::uuid').join(',')}]::uuid[]`;
  const textList = list => `array[${asList(list).map(item => q(item)).join(',')}]::text[]`;
  const jsonOrNull = text => (text === '' ? null : JSON.parse(text));
  const stamp = value => (value ? `${q(value)}::timestamptz` : 'null::timestamptz');
  let bookingRequester = null;

  // ------------------------------------------------------------------ abortable fixture calls
  const withSignal = builder => (typeof builder?.abortSignal === 'function' ? builder.abortSignal(AbortSignal.timeout(abortMs)) : builder);
  /** A fixture RPC: the call carries an abort signal and an error becomes an exception. */
  const call = (client, name, args) => ok(withSignal(client.rpc(name, args)));
  /** The client a product-path helper receives: every rpc() of it carries the abort signal. */
  const abortable = client => ({rpc: (name, args) => withSignal(client.rpc(name, args)), from: table => client.from(table)});
  const rawCall = (client, name, args) => withSignal(client.rpc(name, args));

  // ------------------------------------------------------------------ people
  /** A promise that fails with a TimeoutError after `ms` (the timer is always cleared, so a finished call never keeps the process alive). */
  const withTimeout = (promise, ms, message) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });

  /**
   * One Auth account through the proof adapter (rt.actor = service.auth.admin.createUser + signInWithPassword), with a BOUNDED retry on GoTrue's rate limit. The whole corpus signs in about
   * 200 accounts in minutes (every other proof makes ten or fewer), and a 429 / over_request_rate_limit in the middle would end the run as HARNESS_BROKEN after the hour of chain replay.
   * A rate-limited attempt sleeps `backoffMs` and tries again until `maxWaitMs` (one account) or `maxTotalWaitMs` (the run) is used up; any other error, a timeout of the call itself
   * (2 x the abort window) and an exhausted retry are thrown. A retry creates a NEW account (the failed attempt may have created one; an orphan with a DRAFT worker profile is not a candidate
   * and the stack is disposable). auth = {accountsCreated, retries, rateLimited, waitedMs, failures} goes into the report.
   */
  async function newAccount(label) {
    let waitedHere = 0;
    for (;;) {
      try {
        const made = await withTimeout(actor(label), abortMs * 2, `TimeoutError: the Auth call for ${label} did not finish within ${abortMs * 2} ms (aborted due to timeout)`);
        auth.accountsCreated += 1;
        return made;
      } catch (error) {
        const step = retry.backoffMs;
        if (!isRateLimit(error) || step <= 0 || waitedHere + step > retry.maxWaitMs || auth.waitedMs + step > retry.maxTotalWaitMs) {
          auth.failures += 1;
          throw error;
        }
        auth.rateLimited += 1;
        auth.retries += 1;
        auth.waitedMs += step;
        waitedHere += step;
        await pause(step);
      }
    }
  }

  /**
   * Puts an account in the TEST world through the service-only lineage writer (rpc_admit_account_lineage_service, PKG-015). The writer checks the revision BEFORE it recognises an identical
   * restatement and raises ACCOUNT_LINEAGE_REVISION_CONFLICT (40001, which PostgREST 14 re-executes without end on a chain that lacks B24 part 1) for a stale one, so the account is READ first
   * (rpc_read_account_lineage_service: UNCLASSIFIED / revision 0 when absent): an account already in a TEST lineage is left alone, any other is admitted at its CURRENT revision.
   * Returns {lineage, revision, admitted}.
   */
  async function admitTestWorld(accountId) {
    const current = await call(service, 'rpc_read_account_lineage_service', {p_account_id: accountId});
    if (current === null || typeof current !== 'object' || typeof current.lineage !== 'string') throw new Error('EX06_LINEAGE_READ_UNUSABLE: ' + JSON.stringify(current));
    if (TEST_LINEAGES.includes(current.lineage)) return {lineage: current.lineage, revision: Number(current.revision ?? 0), admitted: false};
    const revision = Number(current.revision ?? 0);
    await call(service, 'rpc_admit_account_lineage_service', {p_account_id: accountId, p_lineage: TEST_WORLD_LINEAGE, p_reason: 'EX-06 harness fixture account',
      p_source_ref: 'EX06_FIXTURE', p_expected_revision: revision});
    return {lineage: TEST_WORLD_LINEAGE, revision: revision + 1, admitted: true};
  }

  /**
   * A requester through REAL Auth: rt.actor() = service.auth.admin.createUser + signInWithPassword; the sign-up trigger public.handle_uskoci_auth_user_created writes the account and
   * both profiles (REQUESTER ACTIVE, WORKER DRAFT). world 'REAL' (default: UNCLASSIFIED, which is REAL) or 'TEST'. Returns {id, client, profileId, world}. No bypass.
   */
  async function createRequester({label = 'requester', world = 'REAL'} = {}) {
    if (!['REAL', 'TEST'].includes(world)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', 'world');
    const account = await newAccount('ex06-' + label);
    const profile = rows(`select id from public.app_profiles where account_id = ${q(account.id)}::uuid and kind = 'REQUESTER'`)[0];
    if (!profile) throw new Error('EX06_FIXTURE_REQUESTER_PROFILE_MISSING');
    const requester = {...account, label, role: 'REQUESTER', profileId: profile.id, world};
    created.requesters.push(requester);
    if (world === 'TEST') await admitTestWorld(account.id);
    return requester;
  }

  /**
   * Reads and writes the worker availability through the product writers rpc_get_worker_availability / rpc_save_worker_availability (revision-bound, owner only). The worker's spec follows
   * (spec.availability), so a later readBackWorker compares the stored rules and windows with what was last written, not with what the worker was first built with. S04 re-drives the
   * requeue triggers of PKG-027a (a location, capacity, availability or activation write re-enqueues the open tasks) through this and setLocation / setCapacity.
   */
  async function setAvailability(worker, value) {
    const doc = await call(worker.client, 'rpc_get_worker_availability');
    const next = {timezone: value.timezone ?? doc.timezone ?? 'Europe/Belgrade', availableNow: value.availableNow ?? doc.availableNow, rules: value.rules ?? doc.rules, windows: value.windows ?? doc.windows};
    const saved = await call(worker.client, 'rpc_save_worker_availability', {p_expected_revision: doc.revision, p_value: next});
    if (worker.spec) worker.spec.availability = next;
    return saved;
  }

  /**
   * Writes the worker's location through rpc_get_worker_location / rpc_save_worker_location (revision-bound, confirmed): {city, radiusKm, position, countryCode}; every key that is left out keeps
   * the worker's current value, except that a new city without a position takes the city table's coordinates (the city text and the position always agree). A city that is not in the table
   * is refused (EX06_CITY_UNKNOWN). The worker's spec follows.
   */
  async function setLocation(worker, {city, radiusKm, position, countryCode} = {}) {
    const current = worker.spec?.location ?? null;
    const nextCity = city ?? current?.city ?? DEFAULT_CITY;
    const nextPosition = position !== undefined ? position : city !== undefined || !current ? cityCentre(nextCity) : current.position;
    const next = {countryCode: countryCode ?? current?.countryCode ?? 'RS', city: nextCity, position: nextPosition};
    const radius = radiusKm ?? worker.spec?.radiusKm ?? 15;
    checkWorkerProfile({radiusKm: radius, location: next}, 'setLocation');
    const doc = await call(worker.client, 'rpc_get_worker_location', {});
    const saved = await call(worker.client, 'rpc_save_worker_location', {p_expected_revision: doc.revision, p_confirmed: true,
      p_value: {operatingCountryCode: next.countryCode, city: next.city, radiusKm: radius, approximatePosition: next.position === null ? null : {...next.position}}});
    if (worker.spec) { worker.spec.location = next; worker.spec.radiusKm = radius; }
    return saved;
  }

  /** Writes the worker's team capacity through rpc_get_worker_capacity / rpc_save_worker_capacity (revision-bound; an integer 1..50). The worker's spec follows. */
  async function setCapacity(worker, teamCapacity) {
    checkWorkerProfile({teamCapacity}, 'setCapacity');
    const doc = await call(worker.client, 'rpc_get_worker_capacity', {});
    const saved = await call(worker.client, 'rpc_save_worker_capacity', {p_expected_revision: doc.revision, p_team_capacity: teamCapacity});
    if (worker.spec) worker.spec.teamCapacity = teamCapacity;
    return saved;
  }

  /**
   * The owner UPDATE of the worker's own profile row through PostgREST (the call of workerProfileClientService.azurirajRadnikProfil). The abort signal goes on BEFORE single():
   * in postgrest-js only the filter/transform builder has abortSignal, the builder single() returns does not.
   */
  const updateProfile = (account, profileId, patch) => ok(account.client.from('app_profiles').update(patch).eq('id', profileId).eq('account_id', account.id).eq('kind', 'WORKER').select('id')
    .abortSignal(AbortSignal.timeout(abortMs)).single());

  /**
   * A worker through the product's own writers, as the profile editor and the location/availability/capacity editors do:
   *   rt.actor (real Auth) -> [world TEST: rpc_admit_account_lineage_service] -> owner UPDATE of app_profiles (display_name, skills, tools, vehicles, licenses: the PostgREST call of
   *   workerProfileClientService.azurirajRadnikProfil) -> rpc_save_worker_location (city, radius, coordinates) -> rpc_save_worker_capacity -> rpc_save_worker_availability
   *   -> rpc_complete_worker_profile (DRAFT -> ACTIVE) -> [skillsAfterActivation: the owner UPDATE of the lists again].
   * spec: {label, account?, interval?, displayName, skills, tools, vehicles, licenses, radiusKm=15, teamCapacity, availability, location, status='ACTIVE', bypass, world, skillsAfterActivation}
   *   interval: {startMs, endMs} of the (rebased) task window; an availability {shape} (the S02 shapes) is resolved against it (timeutil.availabilityFor).
   *   availability: undefined = available now, no schedule; null = never written; {shape}; or {timezone, availableNow, rules, windows}.
   *     The returned worker carries shapeCoverage = {shape, wanted, got}: wanted = the shape promises a weekly rule or window covering the task time, got = 'RULE' | 'WINDOW' | 'NONE'. A
   *     shape that wanted coverage and got 'NONE' (the task stores no window: AVAILABLE_NOW_AND_SCHEDULED is then built as available-now-only) is a worker that was NOT built as the corpus
   *     says; the runner reports the case SHAPE_DEGRADED and the worker's notes say so.
   *   world: 'REAL' | 'TEST'; left out it is the world of the given account (a TEST requester that becomes a TEST worker is not admitted twice), else 'REAL'.
   *   location: undefined = the default city (Novi Sad) with the city table's coordinates; null = never written; or {countryCode, city, position}. A city that is not in the table is refused
   *     (EX06_CITY_UNKNOWN); the position defaults to the city's table coordinates, so the worker's city text and position always agree.
   *   status: 'ACTIVE' (rpc_complete_worker_profile) or 'DRAFT' (left a draft: a draft profile is not ACTIVE).
   *   skillsAfterActivation: [] = "activate-then-clear": rpc_complete_worker_profile refuses an empty skill list (SKILL_REQUIRED), but the owner can empty the list afterwards (the guard validates
   *     only changed values), so an ACTIVE worker with no skills IS a product state. The worker is activated with the given skills and the lists are then overwritten.
   *   account: an existing {id, client} (e.g. a requester, for a person who has both roles); its WORKER profile is the one built.
   * BYPASS (labelled, superuser SQL with triggers off, because no product writer or collector exists for these fields; scope gap G04): bypass = {exclusions, minimumFeeRsd, yearsExperience,
   * ratingWorker, proactiveNotifications, sameDayUrgentNotifications}. The report lists every bypass that was used. The worker is registered in `created` BEFORE its first write, so a
   * half-built worker is retired too.
   */
  async function createWorker(spec = {}) {
    const {label = 'worker', account: given = null, interval = null, ...profileSpec} = spec;
    checkWorkerProfile(profileSpec, 'createWorker');
    const {displayName = 'EX-06 radnik', skills = [], tools = [], vehicles = [], licenses = [], radiusKm = 15, teamCapacity, status = 'ACTIVE', bypass = {}, skillsAfterActivation} = profileSpec;
    const world = profileSpec.world ?? given?.world ?? 'REAL';
    if (status === 'ACTIVE' && skills.length === 0) throw new HarnessInputError('EX06_ACTIVE_WORKER_NEEDS_A_SKILL', `${label}: rpc_complete_worker_profile refuses an empty skill list (SKILL_REQUIRED); pass skillsAfterActivation: [] to clear it after activation`);
    const account = given ?? await newAccount('ex06-' + label);
    const profile = rows(`select id from public.app_profiles where account_id = ${q(account.id)}::uuid and kind = 'WORKER'`)[0];
    if (!profile) throw new Error('EX06_FIXTURE_WORKER_PROFILE_MISSING');
    // what the stored rows must say afterwards
    const location = profileSpec.location === null ? null : (() => {
      const place = profileSpec.location ?? {};
      const city = place.city ?? DEFAULT_CITY;
      return {countryCode: place.countryCode ?? 'RS', city, position: place.position === undefined ? cityCentre(city) : place.position};
    })();
    let availability = null, shapeCoverage = {shape: null, wanted: false, got: 'NONE'};
    if (profileSpec.availability !== null) {
      const wanted = profileSpec.availability ?? {availableNow: true};
      if ('shape' in wanted) {
        const made = availabilityFor(wanted.shape, interval, {newId: randomUUID});
        availability = made.availability;
        shapeCoverage = {shape: wanted.shape, wanted: shapeWantsCoverage(wanted.shape), got: made.coverage};
      } else {
        availability = {timezone: wanted.timezone ?? 'Europe/Belgrade', availableNow: wanted.availableNow ?? true, rules: wanted.rules ?? [], windows: wanted.windows ?? []};
      }
    }
    const final = {skills: skillsAfterActivation ?? skills, tools, vehicles, licenses};
    const worker = {...account, label, role: 'WORKER', profileId: profile.id, world, bypassed: [], notes: [], shapeCoverage,
      spec: {status, radiusKm, teamCapacity, location, availability, bypass, world, final, skillsAfterActivation}};
    created.workers.push(worker);
    if (world === 'TEST') await admitTestWorld(account.id);
    await updateProfile(account, profile.id, {display_name: displayName, skills, tools, vehicles, licenses});
    if (location) await setLocation(worker, {countryCode: location.countryCode, city: location.city, position: location.position, radiusKm});
    if (teamCapacity !== undefined) await setCapacity(worker, teamCapacity);
    if (availability) await setAvailability(worker, availability);
    if (shapeCoverage.wanted && shapeCoverage.got === 'NONE') worker.notes.push(`SHAPE_DEGRADED: ${shapeCoverage.shape} wants a rule or window covering the task time, but the task has none (coverage NONE): built as ${availability.availableNow ? 'available now' : 'not available now'} only`);
    if (status === 'ACTIVE') await call(account.client, 'rpc_complete_worker_profile', {p_profile_id: profile.id});
    if (skillsAfterActivation !== undefined) {
      await updateProfile(account, profile.id, {skills: skillsAfterActivation});
      worker.notes.push('ACTIVATE_THEN_CLEAR: activated with ' + JSON.stringify(skills) + ', then skills := ' + JSON.stringify(skillsAfterActivation));
    }
    if (availability) worker.notes.push(`availability ${availability.availableNow ? 'available now' : 'not available now'}, ${availability.rules.length} rule(s), ${availability.windows.length} window(s)`);
    applyProfileBypass(worker, bypass);
    return worker;
  }

  function applyProfileBypass(worker, bypass) {
    const sets = [];
    if (bypass.exclusions !== undefined) sets.push(`exclusions = ${textList(bypass.exclusions)}`);
    if (bypass.minimumFeeRsd !== undefined) sets.push(`minimum_fee_rsd = ${Number(bypass.minimumFeeRsd)}`);
    if (bypass.yearsExperience !== undefined) sets.push(`years_experience = ${Number(bypass.yearsExperience)}`);
    if (bypass.ratingWorker !== undefined) sets.push(`rating_worker = ${Number(bypass.ratingWorker)}`);
    if (sets.length) {
      sql(`begin; set local session_replication_role = replica; update public.app_profiles set ${sets.join(', ')} where id = ${q(worker.profileId)}::uuid; commit;`);
      worker.bypassed.push('app_profiles:' + sets.map(set => set.split(' = ')[0]).join(','));
    }
    const prefs = [];
    if (bypass.proactiveNotifications !== undefined) prefs.push(['proactive_notifications', Boolean(bypass.proactiveNotifications)]);
    if (bypass.sameDayUrgentNotifications !== undefined) prefs.push(['same_day_urgent_notifications', Boolean(bypass.sameDayUrgentNotifications)]);
    if (prefs.length) {
      sql(`begin; set local session_replication_role = replica;
        insert into public.worker_match_preferences(worker_profile_id, worker_account_id, ${prefs.map(([column]) => column).join(', ')})
          values (${q(worker.profileId)}::uuid, ${q(worker.id)}::uuid, ${prefs.map(([, value]) => value).join(', ')})
          on conflict (worker_profile_id) do update set ${prefs.map(([column]) => `${column} = excluded.${column}`).join(', ')};
        commit;`);
      worker.bypassed.push('worker_match_preferences:' + prefs.map(([column]) => column).join(','));
    }
  }

  /** LABELLED BYPASS for S04: the profile status of a worker (e.g. SUSPENDED, CLOSED), written with triggers off; the product derives it (PROFILE_STATUS_IS_SERVER_DERIVED). */
  function setWorkerStatusBypass(worker, profileStatus) {
    sql(`begin; set local session_replication_role = replica; update public.app_profiles set profile_status = ${q(profileStatus)}${profileStatus === 'ACTIVE' ? '' : ', available_now = false'} where id = ${q(worker.profileId)}::uuid; commit;`);
    worker.bypassed.push('app_profiles:profile_status=' + profileStatus);
  }

  /** Reads the worker's stored rows back and compares them with what the fixture built: {row, mismatches}. A mismatch is a harness error (FIXTURE_NOT_APPLIED:<field>) for the caller. */
  function readBackWorker(worker) {
    const row = rows(`select p.profile_status, p.available_now, p.skills, p.tools, p.vehicles, p.licenses, p.exclusions, p.radius_km, p.city, p.team_capacity, p.years_experience, p.minimum_fee_rsd,
        w.approximate_lat::float8 as lat, w.approximate_lng::float8 as lng, w.proactive_notifications, w.same_day_urgent_notifications, w.timezone,
        (select count(*) from public.profile_availability_rules r where r.profile_id = p.id and r.active)::integer as rules,
        (select count(*) from public.profile_availability_windows x where x.profile_id = p.id)::integer as windows,
        coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'weekdays', r.weekdays, 'startTime', r.start_time::text, 'endTime', r.end_time::text, 'startsOn', r.starts_on::text,
          'endsOn', r.ends_on::text, 'active', r.active) order by r.id) from public.profile_availability_rules r where r.profile_id = p.id), '[]'::jsonb) as rule_docs,
        coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'startMs', (extract(epoch from x.starts_at) * 1000)::bigint, 'endMs', (extract(epoch from x.ends_at) * 1000)::bigint,
          'state', x.availability_state) order by x.id) from public.profile_availability_windows x where x.profile_id = p.id), '[]'::jsonb) as window_docs,
        coalesce(private.account_lineage(p.account_id), 'UNCLASSIFIED') as lineage
      from public.app_profiles p left join public.worker_match_preferences w on w.worker_profile_id = p.id where p.id = ${q(worker.profileId)}::uuid and p.kind = 'WORKER'`)[0];
    if (!row) return {row: null, mismatches: [{field: 'profile', expected: 'a WORKER profile', actual: null}]};
    return {row, mismatches: diffWorkerReadBack(worker.spec, row)};
  }

  // ------------------------------------------------------------------ tasks
  /**
   * A PUBLISHED task from facts in the needFactsV2 shape ('need.*' keys). path: 'product' | 'direct' | 'auto' (default EX06_NEED_PATH or 'product').
   *   product: the real chain, see the header. Bypassed/synthetic parts: the provider's output (the facts arrive as service-written proposals, 12 per turn) and the evaluator's decision
   *   (a synthetic ALLOW recorded through the SERVICE RPCs, provider ref NO_REAL_PROVIDER). The publication policy gate, the review/accept/publish RPCs and their triggers are the product's.
   *   A refusal throws (error.ex06Step names the step); it is NEVER turned into a direct insert, so a task the product would not publish is not matched on a different row.
   *   direct: an INSERT of a PUBLISHED row under the publish lifecycle token (what closure_runtime.need() and the W02 proofs do); bypasses conversation, review, evaluation and publish RPC;
   *   writes the city's coarse coordinates (so the radius branch is the one the product path feeds) but drops every fact it cannot carry (listed in droppedFacts). It is the labelled path for
   *   facts the AI path cannot carry (need.verified_identity_required, need.public_photo_paths) and a diagnostic mode; the caller counts such a case as DEGRADED.
   *   auto (diagnostic only): product first; if it fails, the failing step is recorded (productPathFailure) and the direct path is used.
   * responseDeadline (ISO string or null): the product path prepares the review with p_response_deadline (rpc_prepare_ai_task_review, the shape of pkg023_flow.review but with the deadline
   * instead of null: S04's expiry and past-deadline cases); the direct path writes response_deadline. Left out, the product's own default applies.
   * Returns {needId, needRevision, materialisation, synthetic, droppedFacts, intent, productPathFailure?, reason?}.
   */
  async function createNeedFromFacts(requester, rawFacts, {path = defaultPath, nowMs = Date.now(), interval = null, responseDeadline = null} = {}) {
    const facts = factsAtTime(rawFacts, nowMs);
    const bypassKeys = Object.keys(facts).filter(key => BYPASS_FACT_KEYS.includes(key));
    if (path === 'product' && bypassKeys.length) throw new Error('EX06_FACT_NOT_CARRIABLE_BY_THE_PRODUCT_AI_PATH:' + bypassKeys.join(','));   // never drop a fact silently
    let result;
    if (path === 'direct' || bypassKeys.length) {
      result = {...directPath(requester, facts, {responseDeadline}), reason: bypassKeys.length ? 'FACT_NOT_CARRIABLE_BY_THE_PRODUCT_AI_PATH:' + bypassKeys.join(',') : 'EX06_NEED_PATH=direct'};
    } else if (path === 'product') {
      result = await productPath(requester, facts, {responseDeadline});
    } else {
      try {
        result = await productPath(requester, facts, {responseDeadline});
      } catch (error) {
        result = {...directPath(requester, facts, {responseDeadline}), productPathFailure: {step: error.ex06Step ?? 'unknown', message: String(error.message).slice(0, 300)}};
      }
    }
    if (!created.needs.includes(result.needId)) created.needs.push(result.needId);
    return {...result, intent: {facts, interval}};
  }

  /** The conversation, review, accept, evaluate and publish calls of the product path, each with an abort signal. */
  async function evaluateReview(requester, review, accepted) {
    const context = await call(requester.client, 'rpc_get_need_publication_context', {p_need_id: accepted.needId, p_expected_revision: accepted.needRevision});
    if (context.kind !== 'READY') throw new Error('EX06_PUBLICATION_CONTEXT_NOT_READY:' + context.kind + ':' + context.code);
    const claim = await call(service, 'rpc_claim_ai_task_review_evaluation_service', {p_account_id: requester.id, p_review_id: review.reviewId, p_need_id: accepted.needId,
      p_need_revision: accepted.needRevision, p_binding: context.binding});
    if (claim?.acquired !== true) throw new Error('EX06_EVALUATION_NOT_CLAIMED');
    // The values below are exactly the proven pkg023_flow.mjs evaluate(): a synthetic ALLOW, no real provider.
    return call(service, 'rpc_complete_ai_task_review_evaluation_service', {p_account_id: requester.id, p_review_id: review.reviewId, p_attempt_id: claim.attemptId, p_outcome: 'ALLOW',
      p_rule_ids: ['RS-MIN-001'], p_safe_reason_codes: ['CLEAR_CONCRETE_TASK'], p_provider_ref: 'DISPOSABLE_PKG023', p_model_ref: 'NO_REAL_PROVIDER', p_not_ready_code: null});
  }

  /** The review of the product path: pkg023_flow.review (a null response deadline), or, with a deadline, the same two calls with p_response_deadline set. */
  async function prepareReview(f, a, requester, conversationId, location, responseDeadline) {
    if (responseDeadline === null || responseDeadline === undefined) return f.review(a, conversationId, location);
    const l = await call(requester.client, 'rpc_get_need_location_review', {p_conversation_id: conversationId});
    return call(requester.client, 'rpc_prepare_ai_task_review', {p_conversation_id: conversationId, p_response_deadline: responseDeadline, p_location: {expectedRevision: l.revision, value: location}});
  }

  async function productPath(requester, facts, {responseDeadline = null} = {}) {
    const f = await flow();
    const a = {id: requester.id, client: abortable(requester.client)};
    let step = 'open_conversation';
    try {
      const conversationId = await call(requester.client, 'rpc_ai_open_need_conversation_v2');
      step = 'provider_turns';
      const proposals = proposalsFor(facts);
      for (let from = 0; from === 0 || from < proposals.length; from += 12) {
        const key = randomUUID(), message = 'EX06 synthetic request ' + from;
        const identity = {p_account_id: requester.id, p_conversation_id: conversationId, p_client_request_id: key};
        const claim = await call(service, 'rpc_ai_claim_need_turn_v2_service', {...identity, p_user_message: message});
        if (!claim?.claim?.attemptId) throw new Error('EX06_TURN_NOT_CLAIMED');
        await call(service, 'rpc_ai_dispatch_need_turn_v2_service', {...identity, p_attempt_id: claim.claim.attemptId});
        await call(service, 'rpc_ai_complete_need_turn_v2_service', {...identity, p_attempt_id: claim.claim.attemptId, p_user_message: message,
          p_assistant_message: 'EX06 synthetic proposal', p_safety: 'ALLOW', p_proposals: proposals.slice(from, from + 12)});
      }
      step = 'review';
      const review = await prepareReview(f, a, requester, conversationId, locationValueFor(facts), responseDeadline);
      if (review.canAccept !== true) throw new Error('EX06_REVIEW_CANNOT_BE_ACCEPTED');
      step = 'accept';
      const accepted = await f.accept(a, review);
      if (accepted?.needId && !created.needs.includes(accepted.needId)) created.needs.push(accepted.needId);   // an accepted task that never publishes is still retired
      step = 'evaluate';
      await evaluateReview(requester, review, accepted);
      step = 'publish';
      const receipt = await ok(f.publish(a, accepted));
      if (receipt.state !== 'PUBLISHED') throw new Error('EX06_NOT_PUBLISHED:' + receipt.state);
      return {needId: accepted.needId, needRevision: accepted.needRevision, conversationId, materialisation: 'PRODUCT_PATH', droppedFacts: [],
        synthetic: ['PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS', 'EVALUATOR_DECISION_SYNTHETIC_ALLOW']};
    } catch (error) {
      error.ex06Step = step;
      throw error;
    }
  }

  /**
   * The labelled direct insert. The final private.guard_need_write (20260910144644_clean_w05_publication_evaluator_authority.sql, same rule since W02) refuses an INSERT that names
   * task_country_code or task_timezone with NEED_COUNTRY_REQUIRES_CONFIRMED_REVIEW (42501) unless the transaction carries uskoci.need_region = 'CONFIRMED_REVIEW', so BOTH tokens are set,
   * as supabase/proofs/pkg040/pkg040_proof.mjs does; a non-remote task also gets its public.need_geography row (the public topology: the task_geography fact is PUBLIC), which the later
   * readers of the geography expect. Coarse coordinates sit on the ANCHOR city (anchorCity), the city text on the primary city.
   */
  function directPath(requester, facts, {responseDeadline = null} = {}) {
    const geography = facts['need.task_geography'] ?? DEFAULT_GEOGRAPHY;
    const remote = geography.mode === 'REMOTE';
    const city = remote ? '' : primaryCity(geography) ?? '';
    const anchor = remote ? null : anchorCity(geography);
    const area = remote ? '' : geography.start?.area ?? geography.serviceArea?.area ?? '';
    const centre = anchor ? cityCentre(anchor) : null;
    const mode = facts['need.price_mode'] ?? 'OFFERS';
    const id = randomUUID();
    const time = value => (value === undefined ? 'null' : `${q(value)}::timestamptz`);
    const topology = remote ? '' : `insert into public.need_geography(need_id, public_topology) values (${q(id)}::uuid, ${q(JSON.stringify(geography))}::jsonb);`;
    sql(`begin; select set_config('uskoci.need_lifecycle', 'PUBLISH', true); select set_config('uskoci.need_region', 'CONFIRMED_REVIEW', true);
      insert into public.needs(id, requester_account_id, requester_profile_id, status, title, description, category, required_skills, required_tools, required_vehicles, required_licenses,
        minimum_experience_years, verified_identity_required, approximate_city, approximate_area, approximate_lat, approximate_lng, mode, required_slots, schedule_kind, starts_at, ends_at,
        execution_location_mode, task_country_code, task_timezone, requester_price_rsd, response_deadline, published_at)
      values (${q(id)}::uuid, ${q(requester.id)}::uuid, ${q(requester.profileId)}::uuid, 'PUBLISHED', ${q(facts['need.title'])}, ${q(facts['need.description'])}, ${q(facts['need.category'])},
        ${textList(facts['need.required_skills'])}, ${textList(facts['need.required_tools'])}, ${textList(facts['need.required_vehicles'])}, ${textList(facts['need.required_licenses'])},
        ${Number(facts['need.minimum_experience_years'] ?? 0)}, ${facts['need.verified_identity_required'] === true}, ${q(city)}, ${q(area)}, ${centre ? centre.latitude : 'null'},
        ${centre ? centre.longitude : 'null'}, ${q(mode)}, ${Number(facts['need.people_needed'] ?? 1)}, ${q(facts['need.schedule_kind'] ?? 'FLEXIBLE')}, ${time(facts['need.starts_at'])},
        ${time(facts['need.ends_at'])}, ${q(geography.mode)}, ${q(facts['need.task_country_code'] ?? 'RS')}, 'Europe/Belgrade',
        ${mode === 'MY_PRICE' && facts['need.price_rsd'] !== undefined ? Number(facts['need.price_rsd']) : 'null'},
        ${responseDeadline ? q(responseDeadline) + '::timestamptz' : "statement_timestamp() + interval '2 days'"}, statement_timestamp());
      ${topology}
      commit;`);
    return {needId: id, needRevision: 1, materialisation: 'DIRECT_INSERT_PUBLISHED', synthetic: ['TASK_ROW_INSERTED_UNDER_THE_PUBLISH_TOKEN_NO_PRODUCT_RPC'],
      droppedFacts: Object.keys(facts).filter(key => !DIRECT_WRITES.includes(key))};
  }

  /** The stored task row compared with the intent it was built from: {row, mismatches}. A mismatch is a harness error (FIXTURE_NOT_APPLIED:<field>) for the caller. */
  function readBackNeed(needId, intent) {
    const row = rows(`select status, category, required_skills, required_tools, required_vehicles, required_licenses, minimum_experience_years, verified_identity_required, required_slots,
        schedule_kind, starts_at, ends_at, execution_location_mode, approximate_city, approximate_lat::float8 as approximate_lat, approximate_lng::float8 as approximate_lng, mode,
        requester_price_rsd, revision, response_deadline, urgent, requester_account_id
      from public.needs where id = ${q(needId)}::uuid`)[0];
    if (!row) return {row: null, mismatches: [{field: 'need', expected: 'a published task row', actual: null}]};
    return {row, mismatches: diffNeedReadBack(intent, row)};
  }

  // ------------------------------------------------------------------ the matcher and the dispatch
  /**
   * Wraps private.match_detail(nid, pid): the function the dispatch wave calls for every candidate and the pin gate pins. It chooses the calendar interval itself (the need's starts_at and
   * ends_at when both are present), so this read and a delivery are about the same matcher inputs.
   */
  function readMatch(needId, profileId) {
    return jsonOrNull(sql(`select private.match_detail(${q(needId)}::uuid, ${q(profileId)}::uuid)`));
  }

  /** Wraps private.match_detail_for_calendar_interval(nid, pid, s, e): the interval-aware matcher, for an interval that is NOT the task's own (application-time questions). */
  function readMatchForInterval(needId, profileId, interval) {
    return jsonOrNull(sql(`select private.match_detail_for_calendar_interval(${q(needId)}::uuid, ${q(profileId)}::uuid, ${stamp(interval?.startsAt)}, ${stamp(interval?.endsAt)})`));
  }

  /** Wraps private.dispatch_next_wave(nid): ONE wave for one task (what the scheduler tick calls per claimed task), without touching any other task. */
  function runWave(needId) {
    return jsonOrNull(sql(`select private.dispatch_next_wave(${q(needId)}::uuid)`));
  }

  /**
   * Wraps private.dispatch_tick(batch, at): claims EVERY due row of private.dispatch_schedule (not only a fixture's). For isolation call parkForeign({schedule: true}) and
   * retireFixtures({needs: <every other task>}) right before it: the product re-enqueues open tasks whenever a worker's availability, location, capacity or activation is written (PKG-027a).
   * `at` only drives claiming and backoff; deadlines inside a wave use the real statement_timestamp(). at: ISO string or null = now.
   */
  function runTick(at = null, batch = 25) {
    return jsonOrNull(sql(`select private.dispatch_tick(${Number(batch)}, ${at ? q(at) + '::timestamptz' : 'statement_timestamp()'})`));
  }

  /** Wraps private.expire_lifecycle(p_at): expires past-deadline tasks, deliveries and rounds as of `at` (ISO string or null = now). */
  function runExpiry(at = null) {
    return jsonOrNull(sql(`select private.expire_lifecycle(${at ? q(at) + '::timestamptz' : 'statement_timestamp()'})`));
  }

  /** The full private.dispatch_schedule row of a task (enqueued by the needs trigger on publish): {queued, nextRunAt, attempts, lastStatus, lastReason, lockedUntil}. */
  function readSchedule(needId) {
    const row = rows(`select next_run_at, locked_until, attempts, last_status, last_reason from private.dispatch_schedule where need_id = ${q(needId)}::uuid`)[0];
    return {queued: Boolean(row), nextRunAt: row?.next_run_at ?? null, attempts: row?.attempts ?? null, lastStatus: row?.last_status ?? null, lastReason: row?.last_reason ?? null, lockedUntil: row?.locked_until ?? null};
  }

  /** public.dispatch_rounds of a task, oldest first (status, stop_reason, deadline): what each wave decided. */
  function readRounds(needId) {
    return rows(`select id, round_no, need_revision, urgency, batch_size, target_responses, candidate_limit_used, budget_source, status, stop_reason, deadline_at
      from public.dispatch_rounds where need_id = ${q(needId)}::uuid order by round_no, id`);
  }

  /** public.opportunity_deliveries of a task (one row per worker, need and revision). */
  function readDeliveries(needId) {
    return rows(`select worker_account_id, worker_profile_id, need_revision, status, match_score, reason_codes, dispatch_round_id, created_at
      from public.opportunity_deliveries where need_id = ${q(needId)}::uuid order by created_at, worker_profile_id`);
  }

  /** public.user_activity_events of a recipient with their notification_deliveries (IN_APP / PUSH, state, suppression_reason). type default OPPORTUNITY_AVAILABLE. */
  function readEvents(recipientAccountId, {type = 'OPPORTUNITY_AVAILABLE', entityId = null} = {}) {
    return rows(`select e.id, e.event_type, e.entity_type, e.entity_id, e.entity_version, e.recipient_role, e.urgency, e.dedupe_key, e.created_at,
        coalesce((select jsonb_agg(jsonb_build_object('channel', d.channel, 'state', d.state, 'suppressionReason', d.suppression_reason, 'title', d.title) order by d.channel)
          from public.notification_deliveries d where d.event_id = e.id), '[]'::jsonb) as deliveries
      from public.user_activity_events e where e.recipient_user_id = ${q(recipientAccountId)}::uuid and e.event_type = ${q(type)}
        ${entityId ? `and e.entity_id = ${q(entityId)}::uuid` : ''} order by e.created_at, e.id`);
  }

  // ------------------------------------------------------------------ application, selection, withdrawal, cancellation (S04 reuse)
  /**
   * Wraps the product's rpc_submit_response as the worker (a manual application: hard gates apply, soft gates do not). Returns {ok, data} or {ok:false, error:{code,message}}.
   * Not exercised by S03. proposedStartAt / proposedEndAt are ISO strings or null.
   */
  async function submitApplication(worker, need, {slots = 1, price = 3000, proposedStartAt = null, proposedEndAt = null, scopeNote = null} = {}) {
    const result = await rawCall(worker.client, 'rpc_submit_response', {p_need_id: need.needId, p_need_revision: need.needRevision, p_worker_profile_id: worker.profileId,
      p_covered_slots: slots, p_price_rsd: price, p_proposed_start_at: proposedStartAt, p_proposed_end_at: proposedEndAt, p_scope_note: scopeNote, p_client_request_id: randomUUID()});
    return result.error ? {ok: false, error: {code: result.error.code, message: result.error.message}} : {ok: true, data: result.data};
  }

  /** Wraps rpc_select_response as the requester (creates the Agreement; the calendar sync then blocks the worker's window). `application` = the data of submitApplication. */
  async function selectResponse(requester, need, application) {
    return call(requester.client, 'rpc_select_response', {p_need_id: need.needId, p_need_revision: application.needRevision, p_response_id: application.responseId,
      p_response_version: application.version, p_content_hash: application.contentHash, p_client_request_id: randomUUID()});
  }

  /** Wraps rpc_withdraw_response as the worker. */
  async function withdrawApplication(worker, application, {reason = null} = {}) {
    return call(worker.client, 'rpc_withdraw_response', {p_response_id: application.responseId, p_need_revision: application.needRevision, p_response_version: application.version,
      p_client_request_id: randomUUID(), p_reason: reason});
  }

  /** Wraps rpc_cancel_need as the requester. */
  async function cancelNeed(requester, need, {reason = 'EX-06 fixture'} = {}) {
    return call(requester.client, 'rpc_cancel_need', {p_need_id: need.needId, p_need_revision: need.needRevision, p_reason: reason});
  }

  /**
   * Wraps closure_runtime's prefs(): rpc_get_notification_preferences then rpc_set_notification_preferences as the person, role 'WORKER' | 'REQUESTER', patch = the settings to change.
   * Without a preferences row every PUSH delivery is SUPPRESSED / PUSH_OFF, so S04's push-side probes start here. Not exercised by S03 (events are read, push is not).
   */
  async function setNotificationPreferences(person, role, patch) {
    if (typeof rt.prefs !== 'function') throw new Error('EX06_PREFS_HELPER_MISSING: the proof adapter has no prefs()');
    return rt.prefs(person.client, person.id, role, patch);
  }

  /**
   * Makes a worker BUSY over a window the way the product does: an Agreement (agreement_calendar_sync, W2C, writes the worker_calendar_events BLOCKING row). A booking requester publishes a
   * FIXED_WINDOW REMOTE task over the window (a labelled direct insert: only the task row is a bypass), the worker applies with the same proposed window and the requester selects.
   * Not exercised by S03 (calendar-busy workers are reported UNCONSUMED); S04 and a later S03 version call it. interval: {startsAt, endsAt} ISO strings.
   */
  async function bookWorker(worker, interval, {requester = null} = {}) {
    const owner = requester ?? (bookingRequester ??= await createRequester({label: 'booking'}));
    const facts = {'need.title': 'EX-06 zauzece termina', 'need.description': 'Sinteticki zadatak koji zauzima termin radnika (EX-06 fixture).', 'need.category': 'EX06 zauzece',
      'need.required_skills': [], 'need.required_tools': [], 'need.required_vehicles': [], 'need.required_licenses': [], 'need.people_needed': 1, 'need.schedule_kind': 'FIXED_WINDOW',
      'need.starts_at': interval.startsAt, 'need.ends_at': interval.endsAt, 'need.task_geography': {mode: 'REMOTE'}, 'need.price_mode': 'OFFERS', 'need.task_country_code': 'RS'};
    const need = directPath(owner, facts);
    created.needs.push(need.needId);
    const application = await submitApplication(worker, need, {proposedStartAt: interval.startsAt, proposedEndAt: interval.endsAt});
    if (!application.ok) throw new Error('EX06_BOOKING_APPLICATION_REFUSED:' + application.error.code + ':' + application.error.message);
    const agreement = await selectResponse(owner, need, application.data);
    worker.bypassed.push('booking:task row inserted directly, application and selection through the product');
    return {needId: need.needId, application: application.data, agreement};
  }

  // ------------------------------------------------------------------ isolation, state, certificate
  /** The marks of what has been created so far; retireSince(mark) retires everything created after it (workers, including half-built ones, and tasks, including orphans). */
  const mark = () => ({workers: created.workers.length, needs: created.needs.length});

  /** Suspends the given workers and removes the schedule rows of the given tasks (superuser SQL, triggers off): the fixtures of a finished case stop competing. Foreign rows are untouched. */
  function retireFixtures({workers = [], needs = []}) {
    const parts = [];
    if (workers.length) parts.push(`update public.app_profiles set profile_status = 'SUSPENDED', available_now = false where id = any(${uuidList(workers.map(w => w.profileId ?? w))});`);
    if (needs.length) parts.push(`delete from private.dispatch_schedule where need_id = any(${uuidList(needs.map(n => n.needId ?? n))});`);
    if (parts.length) sql(`begin; set local session_replication_role = replica; ${parts.join(' ')} commit;`);
  }

  function retireSince(since) {
    retireFixtures({workers: created.workers.slice(since.workers), needs: created.needs.slice(since.needs)});
  }

  /** Retires every worker and task this factory created so far. */
  function parkAll() {
    retireFixtures({workers: created.workers, needs: created.needs});
  }

  /**
   * Suspends every ACTIVE worker that is not a fixture of this factory (they would crowd a wave of batch 5), so a case is matched against its own workers only. Returns a token for
   * restoreForeign(): [{id, profile_status, available_now}]. schedule: also delete the schedule rows of every task that is not a fixture (for a tick, S04). Disposable chain only.
   */
  function parkForeign({schedule = false} = {}) {
    const own = created.workers.map(worker => worker.profileId);
    const foreign = rows(`select id, profile_status, available_now from public.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE' ${own.length ? `and id <> all(${uuidList(own)})` : ''} order by id`);
    const parts = [];
    if (foreign.length) parts.push(`update public.app_profiles set profile_status = 'SUSPENDED', available_now = false where id = any(${uuidList(foreign.map(row => row.id))});`);
    let scheduleRows = 0;
    if (schedule) {
      const ours = created.needs;
      scheduleRows = Number(sql(`select count(*) from private.dispatch_schedule ${ours.length ? `where need_id <> all(${uuidList(ours)})` : ''}`));
      parts.push(`delete from private.dispatch_schedule ${ours.length ? `where need_id <> all(${uuidList(ours)})` : ''};`);
    }
    if (parts.length) sql(`begin; set local session_replication_role = replica; ${parts.join(' ')} commit;`);
    return {parkedWorkers: foreign.length, scheduleRowsRemoved: scheduleRows, restore: foreign};
  }

  /** Puts the workers parkForeign suspended back as they were (the schedule rows it deleted are not restored: the disposable chain re-enqueues on the next worker write). */
  function restoreForeign(token) {
    const list = token?.restore ?? [];
    if (!list.length) return 0;
    const parts = list.map(row => `update public.app_profiles set profile_status = ${q(row.profile_status)}, available_now = ${row.available_now === true} where id = ${q(row.id)}::uuid;`);
    sql(`begin; set local session_replication_role = replica; ${parts.join(' ')} commit;`);
    return list.length;
  }

  /** How many ACTIVE workers on the chain are not fixtures of this factory (must be 0 right after parkForeign). */
  function countForeignActive() {
    const own = created.workers.map(worker => worker.profileId);
    return Number(sql(`select count(*) from public.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE' ${own.length ? `and id <> all(${uuidList(own)})` : ''}`));
  }

  /**
   * The pg_cron jobs of the chain are paused: the production minute tick exists in the disposable database too and would run a wave for a fixture before the harness does.
   * Returns [{jobname, activeBefore, activeAfter}] or {available: false} when the cron schema does not exist.
   */
  function pauseSchedulers() {
    if (sql("select to_regclass('cron.job') is not null") !== 't') return {available: false, jobs: []};
    const before = rows('select jobid, jobname, active from cron.job order by jobid');
    sql("select cron.alter_job(j.jobid, active := false) from cron.job j where j.active and j.jobname like 'uskoci%'");
    const after = rows('select jobid, jobname, active from cron.job order by jobid');
    return {available: true, jobs: before.map(job => ({jobname: job.jobname, activeBefore: job.active, activeAfter: after.find(item => item.jobid === job.jobid)?.active ?? null}))};
  }

  /**
   * {live, certified, erasure, binding, ready}: private.closure_source_digest_v5(), the certified value in private.closure_source_v5, the erasure source in private.closure_erasure_source_v5,
   * private.closure_erasure_binding_v5()->>'sourceSha256', and private.retention_ai_source_ready(). Certified AND consistent = ready and all four equal.
   */
  function closureState() {
    return rows(`select private.closure_source_digest_v5() as live, (select sha256 from private.closure_source_v5 where singleton) as certified,
      (select sha256 from private.closure_erasure_source_v5 where singleton) as erasure, private.closure_erasure_binding_v5() ->> 'sourceSha256' as binding,
      private.retention_ai_source_ready() as ready`)[0];
  }

  /** Counts the report prints as the chain baseline (aggregate only). */
  function chainCounts() {
    return rows(`select (select count(*) from public.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE')::integer as active_workers,
      (select count(*) from public.needs where status in ('PUBLISHED', 'SELECTION'))::integer as open_needs,
      (select count(*) from private.dispatch_schedule)::integer as schedule_rows,
      (select count(*) from public.opportunity_deliveries)::integer as deliveries,
      (select count(*) from supabase_migrations.schema_migrations)::integer as ledger`)[0];
  }

  /** The hidden kinds (private.work_kinds_v5) of the STORED task: over category + required skills (the input of the exclusion gate) and over the required skills alone (the service-match arm). */
  function kindsOfStoredNeed(needId) {
    const text = expression => exactKindsArray(sql(`select to_jsonb(private.work_kinds_v5(${expression})) from public.needs n where n.id = ${q(needId)}::uuid`), 'the stored task ' + needId);
    return {exclusionInput: text('array_prepend(n.category, n.required_skills)'), skillsOnly: text('n.required_skills')};
  }

  /**
   * Exactly one row and a JSON ARRAY, or a harness error. work_kinds_v5 never returns NULL (it coalesces to '{}'), so an EMPTY result (psql prints nothing: zero rows, a mismatched id, a task
   * that is gone) must not be read as "the task has no kinds": seven S02 cases expect 'unclassified' (the empty set) and would pass vacuously on it.
   */
  function exactKindsArray(raw, what) {
    const lines = String(raw).split('\n').filter(line => line.trim() !== '');
    if (lines.length !== 1 || !lines[0].trim().startsWith('[')) throw new HarnessInputError('EX06_KINDS_NOT_READ', `${what}: expected exactly one row holding a JSON array, psql returned ${JSON.stringify(String(raw).slice(0, 80))}`);
    let parsed;
    try { parsed = JSON.parse(lines[0]); } catch { throw new HarnessInputError('EX06_KINDS_NOT_READ', `${what}: the row is not valid JSON`); }
    if (!Array.isArray(parsed)) throw new HarnessInputError('EX06_KINDS_NOT_READ', `${what}: the value is not an array`);
    return parsed;
  }

  /** `kinds(category + required_skills)` of facts (read-only, immutable): the legacy probe on corpus text; a run asserts the STORED row through kindsOfStoredNeed. Same strictness. */
  function kindsOf(facts) {
    const values = [facts['need.category'], ...asList(facts['need.required_skills'])].filter(item => typeof item === 'string');
    return exactKindsArray(sql(`select to_jsonb(private.work_kinds_v5(${textList(values)}))`), 'the corpus text');
  }

  /**
   * The active client backends of the disposable database (pg_stat_activity), and the stuck ones (active longer than minAgeSeconds, never this session) terminated: what a timed-out or
   * aborted call leaves behind. PostgREST 14 re-executes a function that raises 40001 without end, and on a chain that lacks B24 part 1 (the proof runs BEFORE the extension that adds it)
   * the loop keeps running after the harness gave up; the 30 s abort says THAT a call hung, this says WHICH query. Disposable database only. Returns {backends, terminated}.
   */
  function diagnoseActiveBackends({terminate = true, minAgeSeconds = 25} = {}) {
    const backends = rows(`select pid, usename, state, wait_event_type, wait_event, round(extract(epoch from now() - query_start))::integer as age_s,
        left(regexp_replace(query, '\\s+', ' ', 'g'), 200) as query
      from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid() and backend_type = 'client backend' and state = 'active' order by query_start`);
    let terminated = [];
    if (terminate && backends.some(item => Number(item.age_s) >= minAgeSeconds)) {
      terminated = rows(`select pid, pg_terminate_backend(pid) as terminated from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()
        and backend_type = 'client backend' and state = 'active' and query_start < now() - interval '${Number(minAgeSeconds)} seconds'`).filter(item => item.terminated === true).map(item => item.pid);
    }
    return {backends, terminated};
  }

  /** Reload the PostgREST schema cache (the proof stages that ran psql files do not) and give it a moment. */
  async function reloadSchema() {
    sql("notify pgrst, 'reload schema'");
    await sleep(options.reloadDelayMs ?? 1500);
  }

  /** {accountsCreated, retries, rateLimited, waitedMs, failures, ...limits}: what the Auth adapter did for this run (a copy). */
  const authStats = () => ({...auth});

  return {createRequester, createWorker, createNeedFromFacts, setAvailability, setLocation, setCapacity, setWorkerStatusBypass, readBackNeed, readBackWorker, runTick, runWave, runExpiry, readDeliveries, readEvents,
    readMatch, readMatchForInterval, readSchedule, readRounds, submitApplication, selectResponse, withdrawApplication, cancelNeed, bookWorker, setNotificationPreferences, mark, retireSince, retireFixtures, parkAll,
    parkForeign, restoreForeign, countForeignActive, pauseSchedulers, closureState, chainCounts, kindsOfStoredNeed, kindsOf, diagnoseActiveBackends, authStats, reloadSchema, admitTestWorld, created, defaultPath};
}
