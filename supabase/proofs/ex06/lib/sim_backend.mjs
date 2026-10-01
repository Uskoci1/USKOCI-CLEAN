// A SIMULATED backend for the offline end-to-end test of the proof orchestration (proof_main.test.mjs). Not a test file, not evidence about the chain.
//
// It stands in for the proof adapter (closure_runtime.mjs: Auth, PostgREST, psql) with just enough behaviour to let the REAL fixtures (lib/fixtures.mjs), the REAL runner and the REAL
// S02 adapter run a whole proof offline: accounts and profiles, the worker writers, the product path of a task (conversation -> review -> accept -> evaluate -> publish), a matcher oracle
// (a small re-implementation of match_detail's gates, written for this simulation from the migrations, NOT the product's code), a dispatch wave, deliveries, events and rounds. Any SQL
// the fixtures send that the simulation does not know throws SIM_UNHANDLED_SQL, so a new statement cannot slip through unnoticed. Quirks switch single behaviours (a differing pin, a moved
// certificate, a matcher that ignores tools, a publish that is refused) so the tests can break the pipeline on purpose.
import {randomUUID} from 'node:crypto';
import {TEST_LINEAGES} from './fixtures.mjs';
import {DEPENDENCY_FUNCTIONS, EXTRA_PINS, PINS} from './pins.mjs';
import {haversineKm} from './geo.mjs';
import {parseIso, zonedParts} from './timeutil.mjs';

const lower = list => (list ?? []).map(item => String(item).trim().toLowerCase());
const overlaps = (a, b) => a.some(item => b.includes(item));
const contains = (a, b) => b.every(item => a.includes(item));

// The hidden kinds of work (supabase/candidates/pkg031b_work_kinds_for_matching.sql), written out again for the simulation.
const KIND_STEMS = [['SELIDBE_PREVOZ', /(selid|prevoz|transport|kombi|moving|removal)/], ['FIZICKI_POSLOVI', /(fizick|nosenj|nosac|utovar|istovar|iznosenj|unosenj|labou?r|loading)/],
  ['MONTAZA_NAMESTAJA', /(montaz|sklapanj|namestaj|ikea|furniture|assembl)/], ['SITNE_POPRAVKE', /(popravk|majstor|handyman|repair)/], ['MOLERSKI_RADOVI', /(moler|krecenj|farbanj|gletovanj|painting|painter)/],
  ['ELEKTRO', /(elektr|electr|struj|uticnic|prekidac|rasvet|sijalic)/], ['VODOINSTALATER', /(vodoinst|vodovod|slavin|odvod|bojler|plumb)/], ['CISCENJE', /(cisc|odrzavanj|clean|usisav)/],
  ['PRANJE_PEGLANJE', /(pegl|pranje vesa|laundry|ironing)/], ['BASTA_DVORISTE', /(bast|dvorist|kosenj|travnjak|garden|lawn)/], ['DOSTAVA', /(dostav|kurir|delivery|courier)/]];
export function workKinds(values) {
  const out = new Set();
  for (const value of values ?? []) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim().toLowerCase().replace(/[čć]/g, 'c').replace(/š/g, 's').replace(/đ/g, 'd').replace(/ž/g, 'z');
    for (const [kind, pattern] of KIND_STEMS) if (pattern.test(text)) out.add(kind);
  }
  return [...out].sort();
}

const round2 = value => Math.round(value * 100) / 100;

// ------------------------------------------------------------------ a tiny reader of the direct INSERT the fixtures send (the guard of private.guard_need_write is modelled on it)
/** Splits a SQL list at its top-level commas (quotes, parentheses, brackets and braces nest). */
function splitTop(text) {
  const out = [];
  let depth = 0, quoted = false, current = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      current += ch;
      if (ch === "'") { if (text[i + 1] === "'") { current += "'"; i += 1; } else quoted = false; }
      continue;
    }
    if (ch === "'") { quoted = true; current += ch; continue; }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (ch === ',' && depth === 0) { out.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  if (current.trim() !== '') out.push(current.trim());
  return out;
}
/** The text between the parenthesis that opens at `from` and its match (quotes respected): {inner, end}. */
function readParen(text, from) {
  let depth = 0, quoted = false;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) { if (ch === "'") { if (text[i + 1] === "'") i += 1; else quoted = false; } continue; }
    if (ch === "'") { quoted = true; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') { depth -= 1; if (depth === 0) return {inner: text.slice(from + 1, i), end: i}; }
  }
  throw new Error('SIM_UNHANDLED_SQL: unbalanced parenthesis');
}
function sqlValue(token) {
  if (token === 'null') return null;
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
  let match;
  if ((match = /^array\[(.*)\]::text\[\]$/s.exec(token))) return match[1].trim() === '' ? [] : splitTop(match[1]).map(sqlValue);
  if ((match = /^'((?:[^']|'')*)'(?:::\w+)?$/s.exec(token))) return match[1].replaceAll("''", "'");
  return {expression: token};
}

export function createSimulatedBackend({foreignWorkers = 2, quirks = {}, startMs = Date.UTC(2026, 9, 1, 12, 0, 0)} = {}) {
  const state = {accounts: new Map(), profiles: new Map(), needs: new Map(), conversations: new Map(), reviews: new Map(), deliveries: [], rounds: [], schedule: new Map(), events: [],
    geography: new Map(), directInserts: [], terminated: [], actorCalls: 0, sqlSeen: [], rpcSeen: [], tick: 0, quirks};
  const now = () => startMs + state.tick * 1000;
  const worldOf = accountId => (TEST_LINEAGES.includes(state.accounts.get(accountId)?.lineage) ? 'TEST' : 'REAL');

  function newAccount(label) {
    const id = randomUUID(), requester = randomUUID(), worker = randomUUID();
    state.accounts.set(id, {id, label, lineage: 'UNCLASSIFIED', revision: 0});
    const base = {account_id: id, display_name: '', city: '', skills: [], tools: [], vehicles: [], licenses: [], exclusions: [], radius_km: 15, team_capacity: 1, years_experience: 0,
      minimum_fee_rsd: 0, available_now: false, pref: null, rules: [], windows: []};
    state.profiles.set(requester, {...base, id: requester, kind: 'REQUESTER', profile_status: 'ACTIVE'});
    state.profiles.set(worker, {...base, id: worker, kind: 'WORKER', profile_status: 'DRAFT'});
    return {id, requesterProfile: requester, workerProfile: worker};
  }
  const profileOf = (accountId, kind) => [...state.profiles.values()].find(item => item.account_id === accountId && item.kind === kind);

  // ---------------------------------------------------------------- the matcher oracle and the wave
  function isFuture(need) {
    const s = need.starts_at ? Date.parse(need.starts_at) : null, e = need.ends_at ? Date.parse(need.ends_at) : null;
    return s !== null && e !== null && s < e && e > now() && (s > now() || ['TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(need.schedule_kind));
  }
  function covers(profile, startMs, endMs, whole) {
    const windows = profile.windows.filter(item => item.state === 'AVAILABLE').map(item => [Date.parse(item.startsAt), Date.parse(item.endsAt)]);
    if (windows.some(([a, b]) => (whole ? a <= startMs && b >= endMs : a < endMs && b > startMs))) return true;
    const s = zonedParts(startMs, 'Europe/Belgrade'), e = zonedParts(endMs, 'Europe/Belgrade');
    return profile.rules.some(rule => rule.active && s.date === e.date && rule.weekdays.includes(s.weekday) && rule.startsOn <= s.date && (!rule.endsOn || rule.endsOn >= s.date)
      && rule.startTime <= s.time && (rule.endTime === '24:00:00' || rule.endTime >= e.time));
  }
  function timeAdmitted(need, profile) {
    if (isFuture(need)) {
      const s = Date.parse(need.starts_at), e = Date.parse(need.ends_at);
      return need.schedule_kind === 'FIXED_WINDOW' ? covers(profile, s, e, true) : covers(profile, Math.max(s, now()), e, false);
    }
    if (['TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(need.schedule_kind) || (need.ends_at && Date.parse(need.ends_at) <= now())) return false;
    return profile.available_now;
  }
  function matchDetail(needId, profileId) {
    const need = state.needs.get(needId), profile = state.profiles.get(profileId);
    if (!need) return {responseAllowed: false, dispatchEligible: false, hardBlockers: ['NEED_NOT_FOUND']};
    if (!profile || profile.kind !== 'WORKER') return {responseAllowed: false, dispatchEligible: false, hardBlockers: ['WORKER_PROFILE_NOT_FOUND']};
    const hard = [], soft = [], reasons = [];
    const tools = lower(profile.tools), skills = lower(profile.skills);
    if (profile.profile_status !== 'ACTIVE') hard.push('ACCOUNT_OR_PROFILE_RESTRICTED');
    if (need.requester_account_id === profile.account_id) hard.push('OWN_NEED');
    if (!state.quirks.ignoreTools && !contains(tools, lower(need.required_tools))) hard.push('MISSING_REQUIRED_TOOL');
    if (!contains(lower(profile.licenses), lower(need.required_licenses))) hard.push('MISSING_REQUIRED_LICENSE');
    if (!contains(lower(profile.vehicles), lower(need.required_vehicles))) hard.push('MISSING_REQUIRED_VEHICLE');
    if ((need.minimum_experience_years ?? 0) > 0 && (profile.years_experience ?? 0) < need.minimum_experience_years) hard.push('INSUFFICIENT_EXPERIENCE');
    const needInput = [need.category, ...need.required_skills];
    if (overlaps(lower(profile.exclusions), lower(needInput)) || overlaps(workKinds(profile.exclusions), workKinds(needInput))) hard.push('PROFILE_EXCLUSION');
    const future = isFuture(need);
    if (!profile.available_now && !future) soft.push('CURRENT_AVAILABILITY_PAUSED');
    const svc = need.required_skills.length === 0 || overlaps(skills, lower(need.required_skills)) || overlaps(workKinds(profile.skills), workKinds(need.required_skills));
    if (!svc) soft.push('SERVICE_NOT_IN_WORK_PROFILE');
    const sched = timeAdmitted(need, profile);
    if (!sched) soft.push('OUTSIDE_AVAILABILITY');
    const radius = Math.max(1, Math.min(300, profile.radius_km ?? 15));
    let dist = null, radiusOk;
    if (need.execution_location_mode === 'REMOTE') radiusOk = true;
    else {
      dist = need.approximate_lat !== null && profile.pref?.lat !== null && profile.pref?.lat !== undefined ? haversineKm(need.approximate_lat, need.approximate_lng, profile.pref.lat, profile.pref.lng) : null;
      radiusOk = dist !== null ? dist <= radius : String(need.approximate_city ?? '').trim() !== '' && String(need.approximate_city).toLowerCase() === String(profile.city ?? '').toLowerCase();
    }
    if (!radiusOk) soft.push('OUTSIDE_PREFERRED_RADIUS');
    if (svc) reasons.push('SERVICE_MATCH');
    if (sched) reasons.push('SCHEDULE_MATCH');
    // quirk everyoneEligibleFromNeed: N: an "everyone eligible" stub once N tasks exist (so the canary, which runs first on the first N-1 tasks, passes): only a DRAFT / restricted profile is
    // refused, every other gate is dropped. The corpus run must NOT survive it.
    if (state.quirks.everyoneEligibleFromNeed && state.needs.size >= state.quirks.everyoneEligibleFromNeed) {
      hard.splice(0, hard.length, ...hard.filter(code => code === 'ACCOUNT_OR_PROFILE_RESTRICTED'));
      soft.length = 0;
    }
    const score = (svc ? 30 : 0) + (sched ? 25 : 0) + (radiusOk ? 15 : 0) + 10;
    return {workerAccountId: profile.account_id, workerProfileId: profile.id, responseAllowed: hard.length === 0, dispatchEligible: hard.length === 0 && soft.length === 0, hardBlockers: hard,
      dispatchBlockers: soft, reasonCodes: reasons, distanceToStartKm: dist, effectiveRadiusKm: radius, taskLocationMode: need.execution_location_mode, distanceSource: dist === null ? null : 'GEODESIC',
      score, scoreComponents: {}};
  }
  function dispatchNextWave(needId) {
    const need = state.needs.get(needId);
    if (!need) throw new Error('NEED_NOT_FOUND');
    if (need.status !== 'PUBLISHED') return {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0};
    const rounds = state.rounds.filter(item => item.need_id === needId);
    const reached = rounds.filter(item => !(item.status === 'STOPPED' && item.stop_reason === 'NO_ELIGIBLE_CANDIDATES')).length;
    const batch = 5;
    const round = {id: randomUUID(), need_id: needId, round_no: rounds.length + 1, need_revision: 1, urgency: 'NORMAL', batch_size: batch, target_responses: 3, candidate_limit_used: 40, budget_source: 'SIM',
      status: 'SENT', stop_reason: null, deadline_at: new Date(now() + 3600000).toISOString()};
    state.rounds.push(round);
    // private.dispatch_cheap_candidate_admitted (PKG-015b) holds the same-world gate: nobody is offered work from the other world. match_detail does not read the world.
    const candidates = [...state.profiles.values()].filter(item => item.kind === 'WORKER' && item.profile_status === 'ACTIVE' && (state.quirks.noWorldGate || worldOf(item.account_id) === worldOf(need.requester_account_id)))
      .map(item => matchDetail(needId, item.id)).filter(item => item.dispatchEligible).sort((a, b) => b.score - a.score || a.workerProfileId.localeCompare(b.workerProfileId));
    let inserted = 0;
    for (const match of candidates) {
      if (inserted >= batch) break;
      if (state.deliveries.some(item => item.worker_profile_id === match.workerProfileId && item.need_id === needId)) continue;
      state.deliveries.push({worker_account_id: match.workerAccountId, worker_profile_id: match.workerProfileId, need_id: needId, need_revision: 1, status: 'READY', match_score: match.score,
        reason_codes: match.reasonCodes, dispatch_round_id: round.id, created_at: new Date(now()).toISOString()});
      state.events.push({id: randomUUID(), event_type: 'OPPORTUNITY_AVAILABLE', entity_type: 'NEED', entity_id: needId, entity_version: 1, recipient_role: 'WORKER', urgency: 'NORMAL',
        dedupe_key: `opp:${needId}:1:${match.workerAccountId}`, created_at: new Date(now()).toISOString(), recipient_user_id: match.workerAccountId, deliveries: [{channel: 'IN_APP', state: 'CREATED'}]});
      inserted += 1;
    }
    if (inserted === 0) { round.status = 'STOPPED'; round.stop_reason = 'NO_ELIGIBLE_CANDIDATES'; }
    return {status: inserted > 0 ? 'SENT' : 'STOPPED', round: round.round_no, policyWaveNo: reached + 1, urgency: 'NORMAL', inserted, batchSize: batch, deadlineAt: round.deadline_at,
      activeResponses: 0, activeCoverage: 0, selectedSlots: 0, remainingSlots: need.required_slots, candidateLimit: 40, budgetSource: 'SIM', routingCallsUsed: 0, candidateRetrieval: 'SIM', authoritative: true};
  }

  // ---------------------------------------------------------------- RPC handlers (PostgREST)
  const fail = (code, message) => ({data: null, error: {code, message}});
  const succeed = data => ({data, error: null});
  const REV = 'a'.repeat(64);
  function rpc(accountId, name, args) {
    state.rpcSeen.push({accountId, name});
    const own = kind => profileOf(accountId, kind);
    if (state.quirks.timeoutAt === name) return fail('20', 'TimeoutError: The operation was aborted due to timeout');
    switch (name) {
      case 'rpc_get_worker_location': return succeed({revision: REV});
      case 'rpc_save_worker_location': {
        const p = own('WORKER'), v = args.p_value;
        if (args.p_confirmed !== true) return fail('22023', 'LOCATION_CONFIRMATION_REQUIRED');
        const keys = Object.keys(v).sort().join(',');
        if (keys !== 'approximatePosition,city,operatingCountryCode,radiusKm') return fail('22023', 'LOCATION_INPUT_INVALID keys ' + keys);
        if (v.approximatePosition && (round2(v.approximatePosition.latitude) !== v.approximatePosition.latitude || round2(v.approximatePosition.longitude) !== v.approximatePosition.longitude)) return fail('22023', 'LOCATION_INPUT_INVALID decimals');
        p.city = v.city; p.radius_km = v.radiusKm;
        p.pref = {...(p.pref ?? {proactive: true, sameDay: true, timezone: 'Europe/Belgrade'}), lat: v.approximatePosition ? v.approximatePosition.latitude : null, lng: v.approximatePosition ? v.approximatePosition.longitude : null};
        return succeed({saved: true});
      }
      case 'rpc_get_worker_capacity': return succeed({revision: REV});
      case 'rpc_save_worker_capacity': own('WORKER').team_capacity = Number(args.p_team_capacity); return succeed({saved: true});
      case 'rpc_get_worker_availability': { const p = own('WORKER'); return succeed({revision: REV, timezone: 'Europe/Belgrade', availableNow: p.available_now, rules: p.rules, windows: p.windows}); }
      case 'rpc_save_worker_availability': {
        const p = own('WORKER'), v = args.p_value;
        if (Object.keys(v).sort().join(',') !== 'availableNow,rules,timezone,windows') return fail('22023', 'AVAILABILITY_INPUT_INVALID');
        for (const rule of v.rules) {
          if (Object.keys(rule).sort().join(',') !== 'active,endTime,endsOn,id,label,startTime,startsOn,weekdays') return fail('22023', 'AVAILABILITY_ITEM_INVALID rule keys');
          if (!(rule.startTime < rule.endTime || rule.endTime === '24:00:00')) return fail('22023', 'AVAILABILITY_ITEM_INVALID rule order');
        }
        for (const window of v.windows) {
          if (Object.keys(window).sort().join(',') !== 'endsAt,id,label,startsAt,state') return fail('22023', 'AVAILABILITY_ITEM_INVALID window keys');
          parseIso(window.startsAt); parseIso(window.endsAt);
        }
        p.available_now = v.availableNow; p.rules = v.rules.map(item => ({...item, ...(state.quirks.mangleRules ? {startTime: '00:00:00'} : {})})); p.windows = v.windows.map(item => ({...item}));
        if (p.pref === null) p.pref = {lat: null, lng: null, proactive: true, sameDay: true, timezone: v.timezone};
        return succeed({saved: true});
      }
      case 'rpc_complete_worker_profile': {
        const p = state.profiles.get(args.p_profile_id);
        if (!p || p.account_id !== accountId) return fail('42501', 'WORKER_PROFILE_REQUIRED');
        if (p.skills.length === 0) return fail('P0001', 'SKILL_REQUIRED');
        if (String(p.display_name).trim().length < 2 || String(p.city).trim().length < 2) return fail('P0001', 'PROFILE_INCOMPLETE');
        p.profile_status = 'ACTIVE';
        return succeed({profileStatus: 'ACTIVE'});
      }
      case 'rpc_read_account_lineage_service': {
        const account = state.accounts.get(args.p_account_id);
        return succeed({accountId: account.id, lineage: account.lineage, revision: account.revision, nonProduction: TEST_LINEAGES.includes(account.lineage), authoritative: true});
      }
      case 'rpc_admit_account_lineage_service': {
        // the revision is checked BEFORE the identical restatement is recognised (pkg015_dev_data_lineage.sql): a stale revision is 40001, which PostgREST 14 re-executes without end on a chain without B24 part 1
        const account = state.accounts.get(args.p_account_id);
        if (account.revision !== args.p_expected_revision) return fail('40001', 'ACCOUNT_LINEAGE_REVISION_CONFLICT');
        account.lineage = args.p_lineage;
        account.revision += 1;
        return succeed({changed: true, revision: account.revision});
      }
      case 'rpc_ai_open_need_conversation_v2': { const id = randomUUID(); state.conversations.set(id, {accountId, proposals: []}); return succeed(id); }
      case 'rpc_ai_claim_need_turn_v2_service': return succeed({claim: {attemptId: randomUUID()}});
      case 'rpc_ai_dispatch_need_turn_v2_service': return succeed(true);
      case 'rpc_ai_complete_need_turn_v2_service': {
        if (args.p_proposals.length > 12) return fail('22023', 'TOO_MANY_PROPOSALS');
        state.conversations.get(args.p_conversation_id).proposals.push(...args.p_proposals);
        return succeed({state: 'SUCCEEDED'});
      }
      case 'rpc_get_need_location_review': return succeed({revision: REV});
      case 'rpc_prepare_ai_task_review': {
        const conv = state.conversations.get(args.p_conversation_id), facts = Object.fromEntries(conv.proposals.map(item => [item.key, item.value]));
        const canAccept = ['need.title', 'need.description', 'need.category', 'need.price_mode', 'need.schedule_kind', 'need.people_needed'].every(key => key in facts);
        const reviewId = randomUUID();
        state.reviews.set(reviewId, {conversationId: args.p_conversation_id, accountId, location: args.p_location.value, facts, responseDeadline: args.p_response_deadline ?? null});
        return succeed({canAccept, reviewId, displayedContentDigest: 'digest'});
      }
      case 'rpc_accept_ai_task_review': {
        const review = state.reviews.get(args.p_review_id), f = review.facts, loc = review.location;
        const geography = loc.geography, first = loc.resolvedLocation?.points?.[0] ?? null;
        const id = randomUUID();
        const requester = profileOf(accountId, 'REQUESTER');
        state.needs.set(id, {id, requester_account_id: accountId, requester_profile_id: requester.id, status: 'DRAFT', title: f['need.title'], description: f['need.description'], category: f['need.category'],
          required_skills: f['need.required_skills'] ?? [], required_tools: f['need.required_tools'] ?? [], required_vehicles: f['need.required_vehicles'] ?? [], required_licenses: f['need.required_licenses'] ?? [],
          minimum_experience_years: f['need.minimum_experience_years'] ?? 0, verified_identity_required: false, required_slots: f['need.people_needed'], schedule_kind: f['need.schedule_kind'],
          starts_at: f['need.starts_at'] ?? null, ends_at: f['need.ends_at'] ?? null, execution_location_mode: geography.mode, approximate_city: geography.mode === 'REMOTE' ? '' : (geography.start?.city ?? geography.serviceArea?.city ?? ''),
          approximate_lat: first ? round2(first.latitudeE6 / 1e6) : null, approximate_lng: first ? round2(first.longitudeE6 / 1e6) : null, mode: f['need.price_mode'],
          requester_price_rsd: f['need.price_mode'] === 'MY_PRICE' ? f['need.price_rsd'] ?? null : null, revision: 1, response_deadline: review.responseDeadline ?? new Date(now() + 2 * 86400000).toISOString(),
          urgent: Boolean(state.quirks.urgentNeed), published_at: null});
        review.needId = id;
        return succeed({needId: id, needRevision: 1, reviewId: args.p_review_id, clientRequestId: args.p_client_request_id});
      }
      case 'rpc_get_need_publication_context': return succeed({kind: 'READY', binding: {sim: true}});
      case 'rpc_claim_ai_task_review_evaluation_service': return succeed({acquired: true, attemptId: randomUUID()});
      case 'rpc_complete_ai_task_review_evaluation_service': return succeed({state: 'DONE'});
      case 'rpc_publish_accepted_ai_task_review': {
        if (state.quirks.refusePublish) return fail('P0001', 'PUBLICATION_REFUSED_BY_THE_SIMULATION');
        const need = state.needs.get(state.reviews.get(args.p_review_id).needId);
        // quirk refuseCorpusPublishEvery: N: every Nth publish of a task that is not a canary is refused (the canary passes, the corpus is refused in part)
        if (state.quirks.refuseCorpusPublishEvery && !need.title.startsWith('Kanarinac')) {
          state.corpusPublishes = (state.corpusPublishes ?? 0) + 1;
          if (state.corpusPublishes % state.quirks.refuseCorpusPublishEvery === 0) return fail('P0001', 'PUBLICATION_REFUSED_BY_THE_SIMULATION_FOR_A_CORPUS_CASE');
        }
        need.status = 'PUBLISHED'; need.published_at = new Date(now()).toISOString();
        state.schedule.set(need.id, {next_run_at: need.published_at, locked_until: null, attempts: 0, last_status: null, last_reason: null});
        return succeed({state: 'PUBLISHED'});
      }
      default: return fail('42883', 'SIM_UNKNOWN_RPC ' + name);
    }
  }
  function makeClient(accountId) {
    return {
      rpc: (name, args) => {
        let signal = null;
        const builder = {abortSignal: value => { signal = value; return builder; }, signal: () => signal,
          then: (resolve, reject) => Promise.resolve().then(() => rpc(accountId, name, args ?? {})).then(resolve, reject)};
        return builder;
      },
      from: table => {
        const eqs = {}; let patch = null;
        const builder = {update: value => { patch = value; return builder; }, eq: (column, value) => { eqs[column] = value; return builder; }, select: () => builder, single: () => builder, abortSignal: () => builder,
          then: (resolve, reject) => Promise.resolve().then(() => {
            if (table !== 'app_profiles') return fail('42P01', 'SIM_UNKNOWN_TABLE ' + table);
            const p = state.profiles.get(eqs.id);
            if (!p || p.account_id !== accountId) return fail('42501', 'NOT_YOUR_PROFILE');
            for (const [key, value] of Object.entries(patch)) {
              if (['skills', 'tools', 'vehicles', 'licenses'].includes(key) && !(Array.isArray(value) && value.every(item => typeof item === 'string'))) return fail('22023', 'V2_FACT_TYPE_INVALID ' + key);
              if (!['display_name', 'skills', 'tools', 'vehicles', 'licenses'].includes(key)) return fail('42501', 'COLUMN_NOT_WRITABLE ' + key);
              p[key] = Array.isArray(value) ? [...value] : value;
            }
            return succeed({id: p.id});
          }).then(resolve, reject)};
        return builder;
      },
    };
  }

  // ---------------------------------------------------------------- SQL (psql)
  const uuids = text => [...text.matchAll(/'([0-9a-f-]{36})'::uuid/g)].map(match => match[1]);
  const pinRows = text => {
    const wanted = [...text.matchAll(/\('(\w+)','(\w+)'\)/g)].map(match => `${match[1]}.${match[2]}`);
    const out = [];
    for (const name of wanted) {
      const pin = [...PINS, ...EXTRA_PINS].find(item => item.name === name);
      if (pin) out.push({name, nargs: pin.nargs, args: 'x', md5: state.quirks.pinMd5?.[name] ?? pin.md5, derived_b24_part1_pt409: 'f'.repeat(32)});
      else if (DEPENDENCY_FUNCTIONS.includes(name)) out.push({name, nargs: 1, args: 'x', md5: 'd'.repeat(32), derived_b24_part1_pt409: undefined});
    }
    return out;
  };
  function neededProfile(profileId) { const p = state.profiles.get(profileId); if (!p) throw new Error('SIM_NO_PROFILE ' + profileId); return p; }
  function applyStatement(statement) {
    let match;
    if ((match = /^update public\.app_profiles set profile_status = 'SUSPENDED', available_now = false where id = any\(array\[(.*)\]::uuid\[\]\)/s.exec(statement))) {
      for (const id of uuids(match[1])) neededProfile(id).profile_status = 'SUSPENDED', neededProfile(id).available_now = false;
      return true;
    }
    if ((match = /^update public\.app_profiles set profile_status = '(\w+)', available_now = (true|false) where id = '([0-9a-f-]{36})'::uuid/.exec(statement))) {
      const p = neededProfile(match[3]); p.profile_status = match[1]; p.available_now = match[2] === 'true';
      return true;
    }
    if ((match = /^update public\.app_profiles set profile_status = '(\w+)'(?:, available_now = false)? where id = '([0-9a-f-]{36})'::uuid/.exec(statement))) {
      neededProfile(match[2]).profile_status = match[1];
      return true;
    }
    if ((match = /^update public\.app_profiles set (.*) where id = '([0-9a-f-]{36})'::uuid$/s.exec(statement))) {
      const p = neededProfile(match[2]);
      for (const part of match[1].split(/,\s*(?=\w+ = )/)) {
        const [column, value] = part.split(' = ');
        if (column === 'exclusions') p.exclusions = [...value.matchAll(/'((?:[^']|'')*)'/g)].map(item => item[1].replaceAll("''", "'"));
        else if (column === 'years_experience') p.years_experience = Number(value);
        else if (column === 'minimum_fee_rsd') p.minimum_fee_rsd = Number(value);
        else if (column === 'rating_worker') p.rating_worker = Number(value);
        else throw new Error('SIM_UNHANDLED_SQL column ' + column);
      }
      return true;
    }
    if ((match = /^insert into public\.worker_match_preferences\(worker_profile_id, worker_account_id, (.*?)\)\s+values \('([0-9a-f-]{36})'::uuid, '([0-9a-f-]{36})'::uuid, (.*?)\)\s+on conflict/s.exec(statement))) {
      const p = neededProfile(match[2]);
      p.pref ??= {lat: null, lng: null, proactive: true, sameDay: true, timezone: 'Europe/Belgrade'};
      const columns = match[1].split(',').map(item => item.trim()), values = match[4].split(',').map(item => item.trim());
      columns.forEach((column, index) => { if (column === 'proactive_notifications') p.pref.proactive = values[index] === 'true'; if (column === 'same_day_urgent_notifications') p.pref.sameDay = values[index] === 'true'; });
      return true;
    }
    if ((match = /^delete from private\.dispatch_schedule where need_id = any\(array\[(.*)\]::uuid\[\]\)/s.exec(statement))) {
      for (const id of uuids(match[1])) state.schedule.delete(id);
      return true;
    }
    if (/^delete from private\.dispatch_schedule/.test(statement)) { state.schedule.clear(); return true; }
    if (/^(begin|commit|set local session_replication_role = replica)$/.test(statement)) return true;
    return false;
  }
  /**
   * The direct INSERT of public.needs the fixtures send (directPath): the guard of private.guard_need_write (a task_country_code or task_timezone needs uskoci.need_region =
   * 'CONFIRMED_REVIEW'; a PUBLISHED row needs uskoci.need_lifecycle = 'PUBLISH'), the need_geography row, and the task row for the columns the matcher oracle reads.
   */
  function directInsert(flat) {
    const open = flat.indexOf('insert into public.needs(');
    const columns = readParen(flat, open + 'insert into public.needs'.length);
    const valuesAt = flat.indexOf('values (', columns.end);
    const values = readParen(flat, valuesAt + 'values '.length);
    const names = splitTop(columns.inner), tokens = splitTop(values.inner);
    if (names.length !== tokens.length) throw new Error(`SIM_UNHANDLED_SQL: the direct insert has ${names.length} columns and ${tokens.length} values`);
    const row = Object.fromEntries(names.map((name, index) => [name, sqlValue(tokens[index])]));
    const before = flat.slice(0, open);
    const lifecycle = /set_config\('uskoci\.need_lifecycle', 'PUBLISH', true\)/.test(before);
    const region = /set_config\('uskoci\.need_region', 'CONFIRMED_REVIEW', true\)/.test(before);
    if ((row.task_country_code !== null && row.task_country_code !== undefined) || (row.task_timezone !== null && row.task_timezone !== undefined)) {
      if (!region) throw new Error('NEED_COUNTRY_REQUIRES_CONFIRMED_REVIEW');
    }
    if (row.status === 'PUBLISHED' && !lifecycle) throw new Error('NEED_MUST_START_AS_DRAFT');
    const geography = /insert into public\.need_geography\(need_id, public_topology\) values \('([0-9a-f-]{36})'::uuid, '((?:[^']|'')*)'::jsonb\)/.exec(flat.slice(values.end));
    const id = row.id;
    state.needs.set(id, {id, requester_account_id: row.requester_account_id, requester_profile_id: row.requester_profile_id, status: row.status, title: row.title, description: row.description,
      category: row.category, required_skills: row.required_skills, required_tools: row.required_tools, required_vehicles: row.required_vehicles, required_licenses: row.required_licenses,
      minimum_experience_years: row.minimum_experience_years, verified_identity_required: row.verified_identity_required, required_slots: row.required_slots, schedule_kind: row.schedule_kind,
      starts_at: row.starts_at, ends_at: row.ends_at, execution_location_mode: row.execution_location_mode, approximate_city: row.approximate_city, approximate_lat: row.approximate_lat,
      approximate_lng: row.approximate_lng, mode: row.mode, requester_price_rsd: row.requester_price_rsd, revision: 1,
      response_deadline: typeof row.response_deadline === 'string' ? row.response_deadline : new Date(now() + 2 * 86400000).toISOString(), urgent: false, published_at: new Date(now()).toISOString()});
    state.schedule.set(id, {next_run_at: new Date(now()).toISOString(), locked_until: null, attempts: 0, last_status: null, last_reason: null});
    const topology = geography ? JSON.parse(geography[2].replaceAll("''", "'")) : null;
    if (topology) state.geography.set(id, topology);
    state.directInserts.push({id, lifecycle, region, geography: topology, columns: names});
    return '';
  }

  function handleSql(text) {
    state.sqlSeen.push(text);
    const flat = text.replace(/\s+/g, ' ').trim();
    let match;
    if (/to_regclass\('cron\.job'\)/.test(flat)) return 'f';
    if (/^notify pgrst/.test(flat)) return '';
    if (/from pg_proc p join pg_namespace n on n\.oid = p\.pronamespace where \(n\.nspname, p\.proname\) in \(/.test(flat)) return pinRows(flat);
    if (/pg_get_triggerdef\(t\.oid\)/.test(flat)) {
      state.catalogReads = (state.catalogReads ?? 0) + 1;
      // catalogMoves: the catalog changes between the first read (the baseline) and the later ones; catalogExtension: this chain is the EXTENDED one (every read differs from a plain chain)
      const moved = state.quirks.catalogMoves && state.catalogReads > 1;
      return [{name: 'function:private.match_detail(nid uuid, pid uuid)', md5: state.quirks.catalogExtension ? 'e'.repeat(32) : 'a'.repeat(32)}, {name: 'trigger:public.needs.enqueue', md5: 'b'.repeat(32)},
        ...(moved ? [{name: 'function:private.changed_by_the_harness()', md5: 'c'.repeat(32)}] : []),
        ...(state.quirks.catalogExtension ? [{name: 'function:private.platform_price_add_version(p text)', md5: 'd'.repeat(32)}] : [])];
    }
    if (/from private\.marketplace_config where key in/.test(flat)) return ['dispatch_normal', 'dispatch_urgent', 'urgent_activation_policy'].map(key => ({key, sha256: key.length.toString(16).padStart(64, '0'), wave_sizes: [5, 5, 10, 20], target_responses: '3', window_minutes: '15'}));
    if (/private\.closure_source_digest_v5\(\) as live/.test(flat)) {
      state.closureReads = (state.closureReads ?? 0) + 1;
      const live = state.quirks.certificateMovesAfter && state.closureReads > 1 ? 'f'.repeat(64) : '58'.repeat(32);
      return [{live, certified: state.quirks.certificateInconsistent ? '00'.repeat(32) : live, erasure: live, binding: live, ready: true}];
    }
    if (/as active_workers/.test(flat)) return [{active_workers: [...state.profiles.values()].filter(p => p.kind === 'WORKER' && p.profile_status === 'ACTIVE').length, open_needs: state.needs.size, schedule_rows: state.schedule.size,
      deliveries: state.deliveries.length, ledger: 219}];
    if ((match = /^select id from public\.app_profiles where account_id = '([0-9a-f-]{36})'::uuid and kind = '(\w+)'$/.exec(flat))) return [{id: profileOf(match[1], match[2])?.id}].filter(item => item.id);
    if (/select p\.profile_status, p\.available_now, p\.skills/.test(flat) && (match = /where p\.id = '([0-9a-f-]{36})'::uuid and p\.kind = 'WORKER'/.exec(flat))) {
      const p = neededProfile(match[1]);
      return [{profile_status: p.profile_status, available_now: p.available_now, skills: p.skills, tools: p.tools, vehicles: p.vehicles, licenses: p.licenses, exclusions: p.exclusions, radius_km: p.radius_km, city: p.city,
        team_capacity: p.team_capacity, years_experience: p.years_experience, minimum_fee_rsd: p.minimum_fee_rsd, lat: p.pref?.lat ?? null, lng: p.pref?.lng ?? null,
        proactive_notifications: p.pref?.proactive ?? true, same_day_urgent_notifications: p.pref?.sameDay ?? true, timezone: p.pref?.timezone ?? null, rules: p.rules.filter(r => r.active).length, windows: p.windows.length,
        rule_docs: p.rules.map(r => ({id: r.id, weekdays: r.weekdays, startTime: r.startTime, endTime: r.endTime, startsOn: r.startsOn, endsOn: r.endsOn ?? null, active: r.active})),
        window_docs: p.windows.map(w => ({id: w.id, startMs: Date.parse(w.startsAt), endMs: Date.parse(w.endsAt), state: w.state})),
        lineage: state.accounts.get(p.account_id).lineage}];
    }
    if (/^select status, category, required_skills/.test(flat) && (match = /from public\.needs where id = '([0-9a-f-]{36})'::uuid$/.exec(flat))) {
      const n = state.needs.get(match[1]);
      return n ? [{...n}] : [];
    }
    if ((match = /^select private\.match_detail\('([0-9a-f-]{36})'::uuid, '([0-9a-f-]{36})'::uuid\)$/.exec(flat))) return matchDetail(match[1], match[2]);
    if ((match = /^select private\.dispatch_next_wave\('([0-9a-f-]{36})'::uuid\)$/.exec(flat))) return state.quirks.waveNull ? '' : dispatchNextWave(match[1]);
    if ((match = /from public\.opportunity_deliveries where need_id = '([0-9a-f-]{36})'::uuid/.exec(flat))) return state.deliveries.filter(item => item.need_id === match[1]);
    if ((match = /from public\.dispatch_rounds where need_id = '([0-9a-f-]{36})'::uuid/.exec(flat))) return state.rounds.filter(item => item.need_id === match[1]);
    if ((match = /from private\.dispatch_schedule where need_id = '([0-9a-f-]{36})'::uuid/.exec(flat))) {
      const row = state.schedule.get(match[1]);
      return row ? [row] : [];
    }
    if ((match = /from public\.user_activity_events e where e\.recipient_user_id = '([0-9a-f-]{36})'::uuid and e\.event_type = '(\w+)'(?: and e\.entity_id = '([0-9a-f-]{36})'::uuid)?/.exec(flat))) {
      return state.events.filter(item => item.recipient_user_id === match[1] && item.event_type === match[2] && (!match[3] || item.entity_id === match[3]));
    }
    if ((match = /^select to_jsonb\(private\.work_kinds_v5\((array_prepend\(n\.category, n\.required_skills\)|n\.required_skills)\)\) from public\.needs n where n\.id = '([0-9a-f-]{36})'::uuid$/.exec(flat))) {
      const n = state.needs.get(match[2]);
      return workKinds(match[1].startsWith('array_prepend') ? [n.category, ...n.required_skills] : n.required_skills);
    }
    if (/^select id, profile_status, available_now from public\.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE'/.test(flat)) {
      const ownIds = new Set([...flat.matchAll(/'([0-9a-f-]{36})'::uuid/g)].map(item => item[1]));
      return [...state.profiles.values()].filter(p => p.kind === 'WORKER' && p.profile_status === 'ACTIVE' && !ownIds.has(p.id)).map(p => ({id: p.id, profile_status: p.profile_status, available_now: p.available_now}))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
    if (/^select count\(\*\) from public\.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE'/.test(flat)) {
      const ownIds = new Set([...flat.matchAll(/'([0-9a-f-]{36})'::uuid/g)].map(item => item[1]));
      return [...state.profiles.values()].filter(p => p.kind === 'WORKER' && p.profile_status === 'ACTIVE' && !ownIds.has(p.id)).length;
    }
    if (/^select count\(\*\) from private\.dispatch_schedule/.test(flat)) return state.schedule.size;
    if (/from pg_stat_activity/.test(flat)) {
      // the active backends after an aborted call (quirk stuckBackends: [{pid, usename, state, age_s, query}]); pg_terminate_backend answers for the ones that are old enough
      const stuck = state.quirks.stuckBackends ?? [];
      if (/pg_terminate_backend/.test(flat)) {
        const old = stuck.filter(item => Number(item.age_s) >= 25);
        state.terminated.push(...old.map(item => item.pid));
        return old.map(item => ({pid: item.pid, terminated: true}));
      }
      return stuck.map(item => ({wait_event_type: null, wait_event: null, ...item}));
    }
    if (/insert into public\.needs\(/.test(flat)) return directInsert(flat);
    // one or more write statements
    const parts = flat.split(/;\s*/).map(item => item.trim()).filter(Boolean);
    if (parts.length && parts.every(applyStatement)) return '';
    throw new Error('SIM_UNHANDLED_SQL: ' + flat.slice(0, 300));
  }
  const asText = value => (value === null || value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value));

  const service = makeClient(null);
  const rt = {
    q: value => "'" + String(value).replaceAll("'", "''") + "'", randomUUID,
    ok: async promise => { const result = await promise; if (result.error) throw new Error('LOCAL_RPC:' + result.error.code + ':' + result.error.message); return result.data; },
    sql: text => asText(handleSql(text)),
    rows: text => { const value = handleSql(text); return Array.isArray(value) ? value : []; },
    service,
    actor: async label => {
      state.actorCalls += 1;
      // quirk rateLimitedFirst: the first N Auth calls are refused with GoTrue's rate limit (HTTP 429 over_request_rate_limit), as the local stack does when many accounts sign in at once
      if (state.quirks.rateLimitedFirst && state.actorCalls <= state.quirks.rateLimitedFirst) throw Object.assign(new Error('Request rate limit reached'), {status: 429, code: 'over_request_rate_limit'});
      const account = newAccount(label);
      return {id: account.id, client: makeClient(account.id)};
    },
  };
  const flow = {
    review: async (a, conversationId, location) => {
      const l = await rt.ok(a.client.rpc('rpc_get_need_location_review', {p_conversation_id: conversationId}));
      return rt.ok(a.client.rpc('rpc_prepare_ai_task_review', {p_conversation_id: conversationId, p_response_deadline: null, p_location: {expectedRevision: l.revision, value: location}}));
    },
    accept: (a, review, key = randomUUID()) => rt.ok(a.client.rpc('rpc_accept_ai_task_review', {p_review_id: review.reviewId, p_displayed_content_digest: review.displayedContentDigest, p_client_request_id: key})),
    publish: (a, accepted) => a.client.rpc('rpc_publish_accepted_ai_task_review', {p_review_id: accepted.reviewId, p_client_request_id: accepted.clientRequestId}),
  };
  // workers that were on the chain before the harness (earlier stages' fixtures): ACTIVE, available, and able to be reached by any task
  for (let i = 0; i < foreignWorkers; i += 1) {
    const account = newAccount('foreign-' + i), p = state.profiles.get(account.workerProfile);
    Object.assign(p, {profile_status: 'ACTIVE', available_now: true, skills: [], display_name: 'Foreign ' + i, city: 'Novi Sad', pref: {lat: 45.27, lng: 19.83, proactive: true, sameDay: true, timezone: 'Europe/Belgrade'}});
  }
  return {rt, flow, state, oracle: {matchDetail, dispatchNextWave, workKinds}};
}
