// EX-06 S04: a SIMULATED world for the offline tests (test support, not imported by the proof). It implements the three seams of scenarios.mjs (fx, db, api) in memory, with the dispatch lifecycle
// as READ from the DEV bodies on 2026-10-02 (md5 pins in pins.mjs; the bodies of dispatch_next_wave, dispatch_cheap_candidate_admitted, push_suppression and marketplace_tick are kept
// byte-exact in ../dev_bodies). Every rule below names the function it mirrors. `fixes` is a set of finding ids (F5 ... F12): a fixed world behaves as the finding's proposed fix would.
//
// What this is NOT: a model of PostgreSQL, of PostgREST or of the real fixtures. It lets the scenario drivers and the judge run end to end and show that they can both pass and fail; it says
// nothing about what the chain does. The real answer comes from the CI run.
import {readFileSync} from 'node:fs';
import {tomorrowOf} from './clock.mjs';

const BELGRADE = 'Europe/Belgrade';
const MIN = 60000;
const KINDS = {'fizicki poslovi': 'FIZICKI_POSLOVI', selidba: 'SELIDBE_PREVOZ', 'sredjivanje baste': 'BASTA_DVORISTE', moler: 'MOLERSKI_RADOVI'};
const kindsOf = list => new Set((list ?? []).map(item => KINDS[String(item).toLowerCase()] ?? 'OTHER:' + String(item).toLowerCase()));
const overlaps = (a, b) => [...a].some(item => b.has(item));
const lower = list => (list ?? []).map(item => String(item).toLowerCase());
const contains = (have, need) => lower(need).every(item => lower(have).includes(item));
const pidOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sim = text => new URL('../dev_bodies/' + text, import.meta.url);
export const DEV_PUSH_SUPPRESSION_BODY = readFileSync(sim('push_suppression.txt'), 'utf8');
const NIL = '00000000-0000-0000-0000-000000000000';

export class World {
  constructor({fixes = [], startMs = Date.parse('2026-10-02T10:00:00.000Z'), waveSizes = [5, 5, 10, 20], windowMinutes = 15, targetResponses = 3, failScenario = null} = {}) {
    this.fixes = new Set(fixes);
    this.clock = startMs;
    this.config = {waveSizes, windowMinutes, targetResponses};
    this.failScenario = failScenario;
    this.seq = 0;
    this.accounts = new Map(); this.profiles = new Map(); this.needs = new Map(); this.deliveries = []; this.rounds = []; this.events = []; this.notifications = []; this.schedule = new Map();
    this.responses = []; this.agreements = []; this.blocks = []; this.calls = [];
    this.created = {requesters: [], workers: [], needs: []};
    this.foreign = {workers: 0};
    this.fx = this.makeFx(); this.db = this.makeDb(); this.api = this.makeApi();
  }

  id(prefix) { this.seq += 1; return `${prefix}-${String(this.seq).padStart(5, '0')}`; }
  now() { this.clock += 5; return this.clock; }
  advance(ms) { this.clock += ms; }
  has(fix) { return this.fixes.has(fix); }
  log(name) { this.calls.push(name); }

  // ------------------------------------------------------------------------------------------ the rules of the product
  isOpen(need) { return ['PUBLISHED', 'SELECTION'].includes(need.status); }
  sameWorld(a, b) { return this.accounts.get(a).world === this.accounts.get(b).world; }
  blocked(a, b) { return this.blocks.some(item => item.active && ((item.blocker === a && item.blocked === b) || (item.blocker === b && item.blocked === a))); }
  restricted(accountId) { return this.accounts.get(accountId)?.closure === true; }
  covered(need) { return this.agreements.filter(item => item.needId === need.id && item.status === 'CONFIRMED').reduce((sum, item) => sum + item.slots, 0); }
  selectedSlots(need) { return this.covered(need); }

  /** private.worker_dispatch_time_admitted (with the ex06a derived window): is the worker available for the task's window. */
  scheduleAdmitted(need, w) {
    if (w.status !== 'ACTIVE') return false;
    const a = w.availability, rules = (a.rules ?? []).filter(rule => rule.active !== false), windows = a.windows ?? [];
    if (['TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(need.scheduleKind) && need.startsAt === null) {
      if (need.publishedAt === null) return false;
      if (need.scheduleKind === 'TOMORROW_FLEXIBLE') {
        const tomorrow = tomorrowOf(need.publishedAt, need.taskTimezone ?? BELGRADE);
        if (!rules.some(rule => rule.weekdays.includes(tomorrow.weekday))) return false;
        return !windows.some(item => item.state === 'UNAVAILABLE' && Date.parse(item.startsAt) <= tomorrow.startMs && Date.parse(item.endsAt) >= tomorrow.endMs);
      }
      return rules.length > 0;
    }
    if (need.scheduleKind === 'FIXED_WINDOW') return w.coversWindow === true;
    return a.availableNow === true;
  }

  /** private.match_detail_without_calendar (+ match_detail_for_calendar_interval for a fixed window). */
  match(need, w) {
    const hard = [], disp = [];
    const tasks = {tools: need.requiredTools, licenses: need.requiredLicenses, vehicles: need.requiredVehicles};
    if (w.status !== 'ACTIVE') hard.push('ACCOUNT_OR_PROFILE_RESTRICTED');
    if (need.requesterAccountId === w.accountId) hard.push('OWN_NEED');
    if (!contains(w.tools, tasks.tools)) hard.push('MISSING_REQUIRED_TOOL');
    if (!contains(w.licenses, tasks.licenses)) hard.push('MISSING_REQUIRED_LICENSE');
    if (!contains(w.vehicles, tasks.vehicles)) hard.push('MISSING_REQUIRED_VEHICLE');
    const needKinds = kindsOf([need.category, ...need.requiredSkills]);
    if (lower(w.exclusions).some(item => lower([need.category, ...need.requiredSkills]).includes(item)) || overlaps(kindsOf(w.exclusions), needKinds)) hard.push('PROFILE_EXCLUSION');
    if (need.scheduleKind === 'FIXED_WINDOW' && w.busy) hard.push('CALENDAR_CONFLICT');
    const svc = need.requiredSkills.length === 0 || overlaps(kindsOf(w.skills), kindsOf(need.requiredSkills));
    const sched = this.scheduleAdmitted(need, w);
    const derived = ['TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(need.scheduleKind) && need.startsAt === null && need.publishedAt !== null;
    if (!w.availability.availableNow && !(need.scheduleKind === 'FIXED_WINDOW' && w.coversWindow) && !derived) disp.push('CURRENT_AVAILABILITY_PAUSED');
    if (w.proactive === false) disp.push('PROACTIVE_NOTIFICATIONS_PAUSED');
    if (!svc) disp.push('SERVICE_NOT_IN_WORK_PROFILE');
    if (!sched) disp.push('OUTSIDE_AVAILABILITY');
    const radiusOk = w.city === need.city;
    if (!radiusOk) disp.push('OUTSIDE_PREFERRED_RADIUS');
    const exposure = this.deliveries.filter(item => item.accountId === w.accountId && item.createdAt > this.clock - 7 * 24 * 60 * MIN).length;
    const rels = Math.round(Math.max(0, Math.min(100, w.rating === null ? 50 : w.rating * 20)) / 10 * 10) / 10;
    const fair = w.rating === null ? 5 : Math.max(0, 5 - Math.min(5, exposure));
    const resources = !hard.includes('MISSING_REQUIRED_TOOL') && !hard.includes('MISSING_REQUIRED_LICENSE') && !hard.includes('MISSING_REQUIRED_VEHICLE');
    const score = Math.round(Math.min(100, (svc ? 30 : 0) + (sched ? 25 : 0) + (radiusOk ? 14.8 : 0) + (resources ? 15 : 0) + rels + fair) * 10) / 10;
    return {responseAllowed: hard.length === 0, dispatchEligible: hard.length === 0 && disp.length === 0, hardBlockers: hard, dispatchBlockers: disp, score, workerProfileId: w.profileId};
  }

  /** private.dispatch_cheap_candidate_admitted (the candidate gate). F5 and F6 add the clauses their fix proposes. */
  cheap(need, w) {
    if (w.status !== 'ACTIVE' || !this.scheduleAdmitted(need, w) || w.accountId === need.requesterAccountId || !this.sameWorld(need.requesterAccountId, w.accountId) || w.proactive === false) return false;
    if (!(need.requiredSkills.length === 0 || overlaps(kindsOf(w.skills), kindsOf(need.requiredSkills)))) return false;
    if (!contains(w.licenses, need.requiredLicenses) || !contains(w.tools, need.requiredTools) || !contains(w.vehicles, need.requiredVehicles)) return false;
    if (lower(w.exclusions).some(item => lower([need.category, ...need.requiredSkills]).includes(item)) || overlaps(kindsOf(w.exclusions), kindsOf([need.category, ...need.requiredSkills]))) return false;
    if (this.deliveries.some(item => item.accountId === w.accountId && item.needId === need.id && item.revision === need.revision)) return false;
    if (this.has('F5') && this.responses.some(item => item.needId === need.id && item.accountId === w.accountId && ['DRAFT', 'SUBMITTED', 'DELIVERED', 'VIEWED', 'SHORTLISTED', 'SELECTED'].includes(item.status))) return false;
    if (this.has('F6') && (this.blocked(need.requesterAccountId, w.accountId) || this.restricted(w.accountId) || this.prefsOf(w.accountId, 'WORKER')?.opportunities_enabled === false)) return false;
    return true;
  }

  prefsOf(accountId, role) { return this.accounts.get(accountId).prefs[role] ?? null; }

  /** private.in_quiet_hours / the quiet-hours test of emit_event and push_suppression: a whole-day window is the only one the proof uses. */
  quietNow(prefs) { return Boolean(prefs?.quiet_hours_enabled && prefs.quiet_start === '00:00:00' && String(prefs.quiet_end).startsWith('23:59:59')); }

  /** private.emit_event with its two delivery rows and the BEFORE INSERT triggers pre_v3_closure_delivery then pre_v3_safety_delivery. */
  emit(accountId, role, need, dedupeKey, urgency, expiresAt) {
    if (this.events.some(item => item.dedupeKey === dedupeKey)) return null;
    const event = {id: this.id('event'), accountId, role, type: 'OPPORTUNITY_AVAILABLE', entityType: 'NEED', entityId: need.id, version: need.revision, urgency, dedupeKey, createdAt: this.clock};
    this.events.push(event);
    const own = this.prefsOf(accountId, role), other = this.prefsOf(accountId, role === 'WORKER' ? 'REQUESTER' : 'WORKER');
    const prefs = own ?? {in_app_enabled: true, push_enabled: other ? other.push_enabled === true : false, opportunities_enabled: true, quiet_hours_enabled: false, quiet_start: null, quiet_end: null, urgent_overrides_quiet_hours: false};
    const categoryOn = prefs.opportunities_enabled !== false;
    const rows = [{channel: 'IN_APP', state: prefs.in_app_enabled && categoryOn ? 'CREATED' : 'SUPPRESSED', reason: prefs.in_app_enabled && categoryOn ? null : categoryOn ? 'IN_APP_OFF' : 'CATEGORY_OFF'}];
    const pushReason = !prefs.push_enabled ? 'PUSH_OFF' : !categoryOn ? 'CATEGORY_OFF' : this.quietNow(prefs) && !this.has('F8') && !(urgency === 'HITNO' && prefs.urgent_overrides_quiet_hours) ? 'QUIET_HOURS' : null;
    rows.push({channel: 'PUSH', state: pushReason === null ? 'CREATED' : 'SUPPRESSED', reason: pushReason});
    for (const row of rows) {
      const delivery = {id: this.id('notif'), eventId: event.id, accountId, role, channel: row.channel, state: row.state, reason: row.reason, expiresAt, pushStartedAt: null, createdAt: this.clock};
      if (this.restricted(accountId) || this.restricted(need.requesterAccountId)) { delivery.state = 'SUPPRESSED'; delivery.reason = 'ACCOUNT_CLOSING'; }
      if (this.blocked(accountId, need.requesterAccountId)) { delivery.state = 'SUPPRESSED'; delivery.reason = 'ACCOUNT_BLOCKED'; }
      this.notifications.push(delivery);
    }
    return event.id;
  }

  enqueue(needId, atMs) {
    const row = this.schedule.get(needId);
    if (!row) this.schedule.set(needId, {nextRunAt: atMs, lockedUntil: null, attempts: 0, lastStatus: null, lastReason: null});
    else row.nextRunAt = Math.min(row.nextRunAt, atMs);
  }

  /** private.requeue_open_needs_for_worker_v5. */
  requeueFor(accountId) {
    const profile = [...this.profiles.values()].find(item => item.accountId === accountId);
    if (!profile || profile.status !== 'ACTIVE') return 0;
    let count = 0;
    for (const need of this.needs.values()) {
      if (!this.isOpen(need) || need.publishedAt === null || need.searchClosed || need.requesterAccountId === accountId || (need.responseDeadline !== null && need.responseDeadline <= this.clock) || !this.sameWorld(need.requesterAccountId, accountId)) continue;
      this.enqueue(need.id, this.clock);
      count += 1;
    }
    return count;
  }

  /** private.dispatch_next_wave. */
  wave(needId) {
    const need = this.needs.get(needId);
    if (!need) throw new Error('NEED_NOT_FOUND');
    if (!this.isOpen(need)) return {status: 'STOPPED', reason: 'NEED_NOT_OPEN', inserted: 0};
    const remaining = Math.max(0, need.requiredSlots - this.selectedSlots(need));
    if (remaining === 0) return {status: 'STOPPED', reason: 'SLOTS_FILLED', inserted: 0};
    const active = this.responses.filter(item => item.needId === needId && item.revision === need.revision && ['SUBMITTED', 'DELIVERED', 'VIEWED', 'SHORTLISTED'].includes(item.status));
    const coverage = active.reduce((sum, item) => sum + item.coveredSlots, 0);
    if (active.length >= this.config.targetResponses && coverage >= remaining) return {status: 'STOPPED', reason: 'RESPONSE_TARGET_AND_COVERAGE_REACHED', inserted: 0};
    if (need.searchClosed && this.has('F10')) return {status: 'STOPPED', reason: 'REMAINING_SEARCH_CLOSED', inserted: 0};
    const rounds = this.rounds.filter(item => item.needId === needId && item.revision === need.revision);
    const roundNo = Math.max(0, ...rounds.map(item => item.roundNo)) + 1;
    const policyWaveNo = rounds.filter(item => !(item.status === 'STOPPED' && item.stopReason === 'NO_ELIGIBLE_CANDIDATES')).length + 1;
    if (policyWaveNo > this.config.waveSizes.length) return {status: 'STOPPED', reason: 'WAVES_EXHAUSTED', inserted: 0};
    const batch = this.config.waveSizes[policyWaveNo - 1];
    const deadline = this.now() + this.config.windowMinutes * MIN;
    const round = {id: this.id('round'), needId, revision: need.revision, roundNo, batchSize: batch, status: 'SENT', stopReason: null, deadlineAt: deadline};
    this.rounds.push(round);
    const candidates = [...this.profiles.values()].filter(w => this.cheap(need, w)).map(w => ({w, m: this.match(need, w)})).filter(item => item.m.dispatchEligible)
      .sort((a, b) => (b.m.score - a.m.score) || pidOrder(a.w.profileId, b.w.profileId));
    let inserted = 0;
    for (const {w, m} of candidates) {
      if (inserted >= batch) break;
      if (need.searchClosed) { this.rounds.pop(); throw new Error('NEED_REMAINING_SEARCH_CLOSED'); }
      this.deliveries.push({id: this.id('delivery'), accountId: w.accountId, profileId: w.profileId, needId, revision: need.revision, status: 'READY', score: m.score, expiresAt: deadline, roundId: round.id, createdAt: this.clock});
      inserted += 1;
      this.emit(w.accountId, 'WORKER', need, `opp:${need.id}:${need.revision}:${w.accountId}`, 'NORMAL', deadline);
    }
    if (inserted === 0) { round.status = 'STOPPED'; round.stopReason = 'NO_ELIGIBLE_CANDIDATES'; }
    return {status: inserted > 0 ? 'SENT' : 'STOPPED', round: roundNo, policyWaveNo, urgency: 'NORMAL', inserted, batchSize: batch, deadlineAt: new Date(deadline).toISOString()};
  }

  /** private.dispatch_tick. */
  tick(atMs) {
    const due = [...this.schedule.entries()].filter(([, row]) => row.nextRunAt <= atMs && (row.lockedUntil === null || row.lockedUntil < atMs)).map(([id]) => id).slice(0, 25);
    const out = {processed: 0, sent: 0, stopped: 0, failed: 0, batch: 25, claimed: due.length};
    for (const needId of due) {
      out.processed += 1;
      const row = this.schedule.get(needId);
      try {
        const result = this.wave(needId);
        const reason = result.reason ?? result.status;
        if (result.status === 'SENT') { out.sent += 1; row.nextRunAt = Date.parse(result.deadlineAt); row.attempts = 0; row.lastStatus = 'SENT'; row.lastReason = null; row.lockedUntil = null; }
        else if (['SLOTS_FILLED', 'NEED_NOT_OPEN', 'WAVES_EXHAUSTED', 'RESPONSE_TARGET_AND_COVERAGE_REACHED'].includes(reason) || (this.has('F10') && reason === 'REMAINING_SEARCH_CLOSED')) { out.stopped += 1; this.schedule.delete(needId); }
        else { out.stopped += 1; row.nextRunAt = atMs + Math.min(360, Math.max(5, Math.floor(2 ** Math.min(row.attempts, 9)))) * MIN; row.attempts += 1; row.lastStatus = 'STOPPED'; row.lastReason = reason; row.lockedUntil = null; }
      } catch (error) {
        out.failed += 1; row.attempts += 1; row.lockedUntil = null; row.nextRunAt = atMs + 10 * MIN; row.lastStatus = 'ERROR'; row.lastReason = String(error.message).slice(0, 200);
      }
    }
    return out;
  }

  /** private.expire_lifecycle. */
  expire(atMs) {
    const out = {needsExpired: 0};
    for (const need of this.needs.values()) {
      const hasExpiredDelivery = this.deliveries.some(item => item.needId === need.id && ['READY', 'SEEN'].includes(item.status) && item.expiresAt <= atMs);
      const due = this.isOpen(need) && need.responseDeadline !== null && need.responseDeadline <= atMs && this.selectedSlots(need) === 0;
      if (due) {
        need.status = 'EXPIRED'; out.needsExpired += 1;
        this.schedule.delete(need.id);
        for (const round of this.rounds.filter(item => item.needId === need.id && ['PLANNED', 'SENT'].includes(item.status))) { round.status = 'STOPPED'; round.stopReason = 'NEED_EXPIRED'; }
        for (const delivery of this.deliveries.filter(item => item.needId === need.id && ['READY', 'SEEN'].includes(item.status))) delivery.status = 'EXPIRED';
        for (const row of this.notifications) if (['CREATED', 'QUEUED', 'FAILED_RETRYABLE'].includes(row.state) && this.events.find(item => item.id === row.eventId)?.entityId === need.id) row.state = 'EXPIRED';
      } else if (hasExpiredDelivery) {
        for (const delivery of this.deliveries.filter(item => item.needId === need.id && ['READY', 'SEEN'].includes(item.status) && item.expiresAt <= atMs)) delivery.status = 'EXPIRED';
        for (const round of this.rounds.filter(item => item.needId === need.id && item.status === 'SENT' && item.deadlineAt <= atMs)) round.status = 'EXPIRED';
      }
    }
    return out;
  }

  /** The pending IN_APP and PUSH rows of the opportunity events of a task end EXPIRED (rpc_cancel_need and expire_lifecycle do it; the F9 fix makes the fill and the search close do it too). */
  expirePending(needId) {
    for (const row of this.notifications) if (['CREATED', 'QUEUED', 'FAILED_RETRYABLE'].includes(row.state) && this.events.find(item => item.id === row.eventId)?.entityId === needId) row.state = 'EXPIRED';
  }

  /** The closing of every pending side effect of a cancelled task (rpc_cancel_need). */
  cancel(need) {
    need.status = 'CANCELLED';
    this.schedule.delete(need.id);
    for (const round of this.rounds.filter(item => item.needId === need.id && ['PLANNED', 'SENT'].includes(item.status))) { round.status = 'STOPPED'; round.stopReason = 'NEED_CANCELLED'; }
    for (const delivery of this.deliveries.filter(item => item.needId === need.id && ['READY', 'SEEN'].includes(item.status))) delivery.status = 'EXPIRED';
    for (const row of this.notifications) if (['CREATED', 'QUEUED', 'FAILED_RETRYABLE'].includes(row.state) && this.events.find(item => item.id === row.eventId)?.entityId === need.id) row.state = 'EXPIRED';
  }

  /** The push sender's gate (private.push_suppression); fixes F7 (the fallback of emit), F8 (no permanent quiet-hours suppression) and F9 (the task is re-read). */
  pushGate(row) {
    if (row.channel !== 'PUSH' || ['SUPPRESSED', 'EXPIRED', 'READ', 'DELIVERED', 'FAILED_FINAL'].includes(row.state)) return 'DELIVERY_CLOSED';
    if (row.expiresAt <= this.clock) return 'EXPIRED';
    const event = this.events.find(item => item.id === row.eventId), need = this.needs.get(event.entityId);
    if (this.restricted(row.accountId) || this.restricted(need.requesterAccountId)) return 'ACCOUNT_CLOSING';
    if (this.blocked(row.accountId, need.requesterAccountId)) return 'ACCOUNT_BLOCKED';
    let prefs = this.prefsOf(row.accountId, row.role);
    if (!prefs && this.has('F7')) prefs = this.prefsOf(row.accountId, row.role === 'WORKER' ? 'REQUESTER' : 'WORKER');
    if (!prefs || !prefs.push_enabled) return 'PUSH_OFF';
    if (prefs.opportunities_enabled === false) return 'CATEGORY_OFF';
    if (this.quietNow(prefs) && !this.has('F8')) return 'QUIET_HOURS';
    if (this.has('F9') && (!this.isOpen(need) || need.searchClosed || this.profileOf(row.accountId)?.status !== 'ACTIVE')) return 'NEED_NOT_OPEN';
    return '<null>';
  }

  profileOf(accountId) { return [...this.profiles.values()].find(item => item.accountId === accountId); }

  // ------------------------------------------------------------------------------------------ the fixtures seam (the S03 fixtures' methods and return shapes)
  makeFx() {
    const world = this;
    const person = (label, kind, accountWorld) => {
      const accountId = world.id('acct'), profileId = world.id('prof-' + kind);
      world.accounts.set(accountId, {id: accountId, label, world: accountWorld, prefs: {WORKER: null, REQUESTER: null}, closure: false});
      return {id: accountId, client: {accountId}, profileId, label, role: kind, world: accountWorld};
    };
    const fx = {
      defaultPath: 'product', created: world.created,
      async createRequester({label = 'requester', world: accountWorld = 'REAL'} = {}) { world.log('createRequester'); const requester = person(label, 'REQUESTER', accountWorld); world.created.requesters.push(requester); return requester; },
      async createWorker(spec = {}) {
        world.log('createWorker');
        const {label = 'worker', account: given = null, interval = null, ...profile} = spec;
        const accountPerson = given ?? person(label, 'WORKER', profile.world ?? 'REAL');
        if (given) world.accounts.get(given.id).world = profile.world ?? given.world ?? 'REAL';
        else world.accounts.get(accountPerson.id).world = profile.world ?? 'REAL';
        const profileId = world.id('prof-worker');
        const availability = profile.availability === undefined ? {timezone: BELGRADE, availableNow: true, rules: [], windows: []}
          : profile.availability === null ? null : 'shape' in profile.availability ? {timezone: BELGRADE, availableNow: profile.availability.shape.includes('NOW'), rules: [], windows: []} : {...profile.availability};
        const status = profile.status ?? 'ACTIVE';
        const w = {profileId, accountId: accountPerson.id, label, status, skills: [...(profile.skills ?? [])], tools: [...(profile.tools ?? [])], vehicles: [...(profile.vehicles ?? [])], licenses: [...(profile.licenses ?? [])],
          exclusions: [...(profile.bypass?.exclusions ?? [])], teamCapacity: profile.teamCapacity ?? 1, city: profile.location?.city ?? 'Novi Sad', radiusKm: profile.radiusKm ?? 15, rating: profile.bypass?.ratingWorker ?? null,
          proactive: profile.bypass?.proactiveNotifications ?? true, availability: availability ?? {timezone: BELGRADE, availableNow: false, rules: [], windows: []}, coversWindow: Boolean(profile.availability && 'shape' in profile.availability && interval),
          busy: false, notes: []};
        world.profiles.set(profileId, w);
        if (status === 'ACTIVE') world.requeueFor(w.accountId);
        const worker = {...accountPerson, profileId, label, role: 'WORKER', world: world.accounts.get(accountPerson.id).world, bypassed: [], notes: [],
          spec: {status, radiusKm: w.radiusKm, teamCapacity: profile.teamCapacity, location: {city: w.city}, availability: {...w.availability}, bypass: profile.bypass ?? {}, world: world.accounts.get(accountPerson.id).world,
            final: {skills: w.skills, tools: w.tools, vehicles: w.vehicles, licenses: w.licenses}}};
        world.created.workers.push(worker);
        return worker;
      },
      async createNeedFromFacts(requester, facts, {nowMs = world.clock, interval = null} = {}) {
        world.log('createNeedFromFacts');
        const id = world.id('need');
        const need = {id, requesterAccountId: requester.id, status: 'PUBLISHED', revision: 1, title: facts['need.title'], category: facts['need.category'], requiredSkills: [...(facts['need.required_skills'] ?? [])],
          requiredTools: [...(facts['need.required_tools'] ?? [])], requiredVehicles: [...(facts['need.required_vehicles'] ?? [])], requiredLicenses: [...(facts['need.required_licenses'] ?? [])],
          requiredSlots: facts['need.people_needed'] ?? 1, scheduleKind: facts['need.schedule_kind'] ?? 'FLEXIBLE', startsAt: facts['need.starts_at'] ? Date.parse(facts['need.starts_at']) : null,
          endsAt: facts['need.ends_at'] ? Date.parse(facts['need.ends_at']) : null, publishedAt: world.now(), taskTimezone: BELGRADE, responseDeadline: null, searchClosed: false,
          city: facts['need.task_geography']?.start?.city ?? 'Novi Sad'};
        world.needs.set(id, need);
        world.created.needs.push(id);
        world.enqueue(id, world.clock);
        void nowMs;
        return {needId: id, needRevision: 1, materialisation: 'PRODUCT_PATH', droppedFacts: [], synthetic: [], intent: {facts, interval}};
      },
      readBackNeed(needId) { const need = world.needs.get(needId); return {row: {status: need.status, revision: need.revision, schedule_kind: need.scheduleKind, required_slots: need.requiredSlots}, mismatches: []}; },
      readBackWorker() { return {row: {}, mismatches: []}; },
      setWorkerStatusBypass(worker, status) { world.profiles.get(worker.profileId).status = status; if (status !== 'ACTIVE') world.profiles.get(worker.profileId).availability.availableNow = false; worker.bypassed.push('status=' + status); },
      async setCapacity(worker, n) { const w = world.profiles.get(worker.profileId); if (w.teamCapacity !== n) { w.teamCapacity = n; world.requeueFor(w.accountId); } worker.spec.teamCapacity = n; return {saved: true}; },
      async setAvailability(worker, value) { const w = world.profiles.get(worker.profileId); w.availability = {...value}; world.requeueFor(w.accountId); return {saved: true}; },
      async setLocation(worker, value) { const w = world.profiles.get(worker.profileId); w.city = value.city ?? w.city; world.requeueFor(w.accountId); return {saved: true}; },
      async setNotificationPreferences(person, role, patch) {
        const account = world.accounts.get(person.id);
        account.prefs[role] = {in_app_enabled: true, push_enabled: false, opportunities_enabled: true, quiet_hours_enabled: false, quiet_start: null, quiet_end: null, quiet_timezone: BELGRADE, urgent_overrides_quiet_hours: false, ...(account.prefs[role] ?? {}), ...patch};
        return {saved: true};
      },
      readMatch(needId, profileId) { return world.match(world.needs.get(needId), world.profiles.get(profileId)); },
      readSchedule(needId) {
        const row = world.schedule.get(needId);
        return {queued: Boolean(row), nextRunAt: row ? new Date(row.nextRunAt).toISOString() : null, attempts: row?.attempts ?? null, lastStatus: row?.lastStatus ?? null, lastReason: row?.lastReason ?? null, lockedUntil: null};
      },
      readRounds(needId) {
        return world.rounds.filter(item => item.needId === needId).sort((a, b) => a.roundNo - b.roundNo).map(item => ({id: item.id, round_no: item.roundNo, need_revision: item.revision, urgency: 'NORMAL', batch_size: item.batchSize,
          target_responses: 3, candidate_limit_used: 40, budget_source: 'ADAPTIVE_FLOOR', status: item.status, stop_reason: item.stopReason, deadline_at: new Date(item.deadlineAt).toISOString()}));
      },
      runWave(needId) { world.log('runWave'); return world.wave(needId); },
      runTick(at) { world.log('runTick'); return world.tick(Date.parse(at)); },
      runExpiry(at) { world.log('runExpiry'); return world.expire(Date.parse(at)); },
      async submitApplication(worker, need, {slots = 1} = {}) {
        const w = world.profiles.get(worker.profileId), n = world.needs.get(need.needId);
        if (slots > w.teamCapacity) return {ok: false, error: {code: '22023', message: 'TEAM_CAPACITY_EXCEEDED'}};
        const hard = world.match(n, w).hardBlockers;
        if (hard.length) return {ok: false, error: {code: 'P0001', message: 'WORKER_NOT_ELIGIBLE'}};
        if (!world.isOpen(n)) return {ok: false, error: {code: '22023', message: 'NEED_NOT_OPEN'}};
        const response = {id: world.id('resp'), needId: n.id, accountId: worker.id, status: 'SUBMITTED', coveredSlots: slots, revision: n.revision, version: 1, hash: 'h'};
        world.responses.push(response);
        for (const delivery of world.deliveries.filter(item => item.needId === n.id && item.accountId === worker.id && ['READY', 'SEEN'].includes(item.status))) delivery.status = 'RESPONDED';
        return {ok: true, data: {responseId: response.id, applicationId: response.id, version: 1, needRevision: n.revision, contentHash: 'h', status: 'SUBMITTED'}};
      },
      async selectResponse(requester, need, application) {
        const n = world.needs.get(need.needId), response = world.responses.find(item => item.id === application.responseId);
        response.status = 'SELECTED';
        const agreement = {id: world.id('agreement'), needId: n.id, workerAccountId: response.accountId, status: 'CONFIRMED', slots: response.coveredSlots};
        world.agreements.push(agreement);
        n.status = world.covered(n) >= n.requiredSlots ? 'ACTIVE' : 'SELECTION';
        if (n.status === 'ACTIVE') world.schedule.delete(n.id);
        if (world.has('F9')) world.expirePending(n.id);
        return agreement.id;
      },
      async cancelNeed(requester, need) { world.cancel(world.needs.get(need.needId)); return {state: 'CANCELLED'}; },
      async bookWorker(worker) { if (world.failScenario === 'calendar') throw new Error('EX06_BOOKING_APPLICATION_REFUSED:simulated'); world.profiles.get(worker.profileId).busy = true; return {needId: world.id('need'), application: {}, agreement: world.id('agreement')}; },
      mark() { return {workers: world.created.workers.length, needs: world.created.needs.length}; },
      retireSince(since) {
        for (const worker of world.created.workers.slice(since.workers)) world.profiles.get(worker.profileId).status = 'SUSPENDED';
        for (const needId of world.created.needs.slice(since.needs)) world.schedule.delete(needId);
      },
      parkAll() { fx.retireSince({workers: 0, needs: 0}); },
      parkForeign() { return {parkedWorkers: 0, scheduleRowsRemoved: 0, restore: []}; },
      restoreForeign() { return 0; },
      countForeignActive() { return 0; },
      pauseSchedulers() { return {available: true, jobs: []}; },
      closureState() { return {live: 'digest', certified: 'digest', erasure: 'digest', binding: 'digest', ready: true}; },
      chainCounts() { return {active_workers: 0, open_needs: 0, schedule_rows: 0, deliveries: 0, ledger: 221}; },
      diagnoseActiveBackends() { return {backends: [], terminated: []}; },
      authStats() { return {accountsCreated: world.accounts.size, retries: 0, rateLimited: 0, waitedMs: 0, failures: 0}; },
      async reloadSchema() { return undefined; },
    };
    return fx;
  }

  // ------------------------------------------------------------------------------------------ the database seam
  makeDb() {
    const world = this;
    const iso = ms => (ms === null || ms === undefined ? null : new Date(ms).toISOString());
    const notificationRow = row => ({id: row.id, channel: row.channel, state: row.state, suppression_reason: row.reason, push_started_at: row.pushStartedAt === null ? null : iso(row.pushStartedAt), expires_at: iso(row.expiresAt)});
    return {
      needState(needId) { const n = world.needs.get(needId); return {status: n.status, revision: n.revision, published_at: iso(n.publishedAt), response_deadline: iso(n.responseDeadline), search_closed: n.searchClosed, required_slots: n.requiredSlots,
        schedule_kind: n.scheduleKind, approximate_city: n.city, task_timezone: n.taskTimezone}; },
      deliveries(needId) {
        return world.deliveries.filter(item => item.needId === needId).map(item => ({worker_account_id: item.accountId, worker_profile_id: item.profileId, need_revision: item.revision, status: item.status, match_score: item.score,
          expires_at: iso(item.expiresAt), created_at: iso(item.createdAt), round_no: world.rounds.find(round => round.id === item.roundId)?.roundNo ?? null, round_status: world.rounds.find(round => round.id === item.roundId)?.status ?? null,
          stop_reason: null})).sort((a, b) => (a.round_no - b.round_no) || (b.match_score - a.match_score) || pidOrder(a.worker_profile_id, b.worker_profile_id));
      },
      opportunityNotifications(needId) {
        const out = [];
        for (const event of world.events.filter(item => item.entityId === needId && item.type === 'OPPORTUNITY_AVAILABLE')) {
          for (const row of world.notifications.filter(item => item.eventId === event.id).sort((a, b) => (a.channel < b.channel ? -1 : 1))) {
            out.push({event_id: event.id, recipient_user_id: event.accountId, entity_version: event.version, urgency: event.urgency, dedupe_key: event.dedupeKey, delivery_id: row.id, channel: row.channel, state: row.state,
              suppression_reason: row.reason, expires_at: iso(row.expiresAt), push_started_at: row.pushStartedAt === null ? null : iso(row.pushStartedAt)});
          }
        }
        return out;
      },
      pendingOpportunityNotifications(needId) {
        const counts = new Map();
        for (const row of world.notifications) { const event = world.events.find(item => item.id === row.eventId); if (event?.entityId !== needId) continue; const key = row.channel + '|' + row.state; counts.set(key, (counts.get(key) ?? 0) + 1); }
        return [...counts.entries()].map(([key, n]) => ({channel: key.split('|')[0], state: key.split('|')[1], n})).sort((a, b) => (a.channel + a.state < b.channel + b.state ? -1 : 1));
      },
      scheduleDueCount(at) { return [...world.schedule.values()].filter(row => row.nextRunAt <= Date.parse(at) && (row.lockedUntil === null || row.lockedUntil < Date.parse(at))).length; },
      scheduleRowsExcept(needId) { return [...world.schedule.keys()].filter(id => id !== needId).length; },
      cheapGate(needId, profileId) { return world.cheap(world.needs.get(needId), world.profiles.get(profileId)); },
      pairBlocked(a, b) { return world.blocked(a, b); },
      accountRestricted(accountId) { return world.restricted(accountId); },
      accountWorld(accountId) { return world.accounts.get(accountId).world; },
      profileState(profileId) { const w = world.profiles.get(profileId); return {profile_status: w.status, available_now: w.availability.availableNow, team_capacity: w.teamCapacity, skills: w.skills, tools: w.tools, vehicles: w.vehicles,
        licenses: w.licenses, exclusions: w.exclusions, rating_worker: w.rating}; },
      responsesOf(needId) { return world.responses.filter(item => item.needId === needId).map(item => ({worker_account_id: item.accountId, status: item.status, covered_slots: item.coveredSlots, submitted_against_need_revision: item.revision})); },
      pushSuppression(deliveryId) { return world.pushGate(world.notifications.find(item => item.id === deliveryId)); },
      notificationDelivery(deliveryId) { return notificationRow(world.notifications.find(item => item.id === deliveryId)); },
      notificationDeliveries(ids) { return world.notifications.filter(item => ids.includes(item.id)).map(notificationRow); },
      materialSnapshot(needId) { const n = world.needs.get(needId); return {title: n.title, description: 'd', category: n.category, requiredSlots: n.requiredSlots, mode: 'OFFERS', requesterPriceRsd: null, requiredSkills: n.requiredSkills,
        requiredTools: n.requiredTools, requiredVehicles: n.requiredVehicles, requiredLicenses: n.requiredLicenses, minimumExperienceYears: 0, verifiedIdentityRequired: false, scheduleKind: n.scheduleKind, startsAt: null, endsAt: null,
        executionLocationMode: 'STATIONARY', approximateLat: null, approximateLng: null, approximateCity: n.city, approximateArea: '', publicPhotoPaths: [], privateLocation: null}; },
      emitEventReplay({accountId, needId, revision}) { const need = world.needs.get(needId); return world.emit(accountId, 'WORKER', {...need, revision}, `opp:${needId}:${revision}:${accountId}`, 'NORMAL', null) ?? NIL; },
      schemaColumns() { return []; },
      functionBody() { return DEV_PUSH_SUPPRESSION_BODY; },
      closureFixture(accountId) { world.accounts.get(accountId).closure = true; },
      republishFixture(needId) { const n = world.needs.get(needId); if (n.status === 'DRAFT') { n.status = 'PUBLISHED'; n.publishedAt = world.now(); world.enqueue(needId, world.clock); } },
      retireNeeds(ids) { for (const id of ids) { const n = world.needs.get(id); if (n && ['DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE'].includes(n.status)) n.status = 'CANCELLED'; world.schedule.delete(id); } },
      retireAllNeeds() { for (const n of world.needs.values()) if (['DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE'].includes(n.status)) n.status = 'CANCELLED'; world.schedule.clear(); },
      deleteOtherSchedules(needId) { for (const id of [...world.schedule.keys()]) if (id !== needId) world.schedule.delete(id); },
      responseDeadlineFixture(needId, at) { world.needs.get(needId).responseDeadline = Date.parse(at); },
      duplicateDeliveryInsert({accountId, needId, revision}) {
        const exists = world.deliveries.some(item => item.accountId === accountId && item.needId === needId && item.revision === revision);
        return exists ? {refused: true, message: 'ERROR:  duplicate key value violates unique constraint "opportunity_deliveries_once_per_revision_uq"'} : {refused: false, message: null};
      },
      duplicateDeliveryOnConflict({accountId, needId, revision}) { return world.deliveries.some(item => item.accountId === accountId && item.needId === needId && item.revision === revision) ? 0 : 1; },
    };
  }

  // ------------------------------------------------------------------------------------------ the product-RPC seam
  makeApi() {
    const world = this;
    const visible = (need, accountId) => (world.isOpen(need) && world.sameWorld(need.requesterAccountId, accountId)) || world.agreements.some(item => item.needId === need.id && item.workerAccountId === accountId);
    return {
      async block(blocker, target) { world.blocks.push({blocker: blocker.id, blocked: target.id, active: true}); return {blocked: true}; },
      async workerPreferences(worker) { const prefs = world.accounts.get(worker.id).prefs.WORKER ?? {opportunities_enabled: true}; return {settings: prefs}; },
      async listInbox(worker) {
        const items = world.events.filter(item => item.accountId === worker.id && world.notifications.some(row => row.eventId === item.id && row.channel === 'IN_APP' && row.state !== 'SUPPRESSED')).map(item => ({id: item.id, eventType: item.type}));
        return {ok: true, data: {items}};
      },
      async resolveEvent(worker, eventId) {
        const event = world.events.find(item => item.id === eventId);
        if (!event || !world.notifications.some(row => row.eventId === eventId && row.channel === 'IN_APP' && row.state !== 'SUPPRESSED')) return {ok: false, error: {code: 'P0002', message: 'EVENT_NOT_FOUND'}};
        const need = world.needs.get(event.entityId);
        if (!visible(need, worker.id)) return {ok: true, data: {kind: 'UNAVAILABLE'}};
        const w = world.profileOf(worker.id);
        if (world.has('F12') && (world.match(need, w).hardBlockers.length > 0 || world.responses.some(item => item.needId === need.id && item.accountId === worker.id))) return {ok: true, data: {kind: 'UNAVAILABLE'}};
        return {ok: true, data: {kind: 'OPPORTUNITY', id: need.id, role: 'WORKER'}};
      },
      async readTask(worker, needId) { const need = world.needs.get(needId); return {ok: true, data: visible(need, worker.id) ? {id: needId, status: need.status} : null}; },
      async confirmNeedEdit(requester, {needId, revision, material}) {
        const need = world.needs.get(needId);
        if (need.revision !== revision) throw new Error('STALE_REVIEW_REQUIRED');
        need.title = material.title; need.status = 'DRAFT'; need.revision += 1; need.publishedAt = null; need.responseDeadline = null; world.schedule.delete(needId);
        for (const delivery of world.deliveries.filter(item => item.needId === needId && item.revision === revision && ['READY', 'SEEN'].includes(item.status))) delivery.status = 'EXPIRED';
        for (const round of world.rounds.filter(item => item.needId === needId && item.revision === revision && ['PLANNED', 'SENT'].includes(item.status))) { round.status = 'STOPPED'; round.stopReason = 'NEED_REVISED'; }
        return {needId, fromRevision: revision, revision: need.revision, status: 'DRAFT'};
      },
      async closeRemainingSearch(requester, {needId}) { const need = world.needs.get(needId); need.searchClosed = true; world.schedule.delete(needId);
        for (const round of world.rounds.filter(item => item.needId === needId && ['PLANNED', 'SENT'].includes(item.status))) { round.status = 'STOPPED'; round.stopReason = 'REMAINING_SEARCH_CLOSED'; }
        for (const delivery of world.deliveries.filter(item => item.needId === needId && ['READY', 'SEEN'].includes(item.status))) delivery.status = 'EXPIRED';
        if (world.has('F9')) world.expirePending(needId);
        return {remainingSearchClosed: true}; },
      async cancelAgreement(person, agreementId) { const agreement = world.agreements.find(item => item.id === agreementId); agreement.status = 'CANCELLED'; const need = world.needs.get(agreement.needId);
        if (world.covered(need) < need.requiredSlots && ['ACTIVE', 'SELECTION'].includes(need.status)) { need.status = 'SELECTION'; world.enqueue(need.id, world.now()); } },
      async claimPush() {
        for (const row of world.notifications.filter(item => item.channel === 'PUSH' && ['CREATED', 'QUEUED', 'FAILED_RETRYABLE'].includes(item.state) && item.pushStartedAt === null)) {
          const why = world.pushGate(row);
          row.state = 'SUPPRESSED'; row.reason = why === '<null>' ? 'NO_ACTIVE_DEVICE' : why; row.pushStartedAt = world.clock;
        }
        return {kind: 'NONE'};
      },
      async updateProfile(worker, patch) { const w = world.profiles.get(worker.profileId); Object.assign(w, patch); if (world.has('F11') && ['skills', 'tools', 'vehicles', 'licenses', 'exclusions'].some(key => key in patch)) world.requeueFor(w.accountId); return {id: worker.profileId}; },
    };
  }

  /** The context the scenarios run with. */
  context({say = () => {}} = {}) {
    const evidence = [];
    let counter = 0;
    return {fx: this.fx, db: this.db, api: this.api, newId: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`, now: () => this.now(), sleep: async ms => { this.advance(ms); }, say,
      config: {...this.config}, evidence: (label, data) => evidence.push({label, data}), evidenceLog: evidence};
  }
}

