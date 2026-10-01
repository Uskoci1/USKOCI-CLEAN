// Shared scaffolding of the offline tests (no database, no network, no dependency). Not a test file itself.
//   * registryFromSource(): the need-fact registry parsed from src/contracts/needFactsV2.ts (the same text the proof loads through ts_loader), so the S02 adapter is exercised against
//     the real keys and value types without TypeScript;
//   * fakeFixtures(): a scripted stand-in of lib/fixtures.mjs for the runner (what a matcher and a wave could answer, including every wrong answer the runner must refuse);
//   * fakeRuntime(): a recording stand-in of the proof adapter (closure_runtime.mjs) for lib/fixtures.mjs.
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';

const here = relative => new URL(relative, import.meta.url);

export const readText = relative => readFileSync(here(relative), 'utf8');
export const S01_PATH = '../../../../docs/implementation/product-v1-closure-20260926/finalization-20260927/ex06/EX06_S01_DEV_BEFORE_BASELINE_20261001.md';
export const CORPUS_PATH = '../../ai/corpus/ex06_contract_corpus_v1.json';

/** {key: {valueType, requiredForDraft}} from src/contracts/needFactsV2.ts. */
export function registryFromSource() {
  const text = readText('../../../../src/contracts/needFactsV2.ts');
  const registry = {};
  for (const match of text.matchAll(/'(need\.[a-z_]+)': \{ valueType: '([A-Z_]+)', privacyClass: '[A-Z]+', requiredForDraft: (true|false)/g)) registry[match[1]] = {valueType: match[2], requiredForDraft: match[3] === 'true'};
  return registry;
}

/** A small stand-in registry for tests that build their own corpora. */
export const STAND_IN_REGISTRY = {
  'need.title': {valueType: 'TEXT', requiredForDraft: true}, 'need.description': {valueType: 'TEXT', requiredForDraft: true}, 'need.category': {valueType: 'TEXT', requiredForDraft: true},
  'need.price_mode': {valueType: 'ENUM', requiredForDraft: true}, 'need.schedule_kind': {valueType: 'ENUM', requiredForDraft: true}, 'need.people_needed': {valueType: 'INTEGER', requiredForDraft: true},
  'need.required_skills': {valueType: 'TEXT_ARRAY', requiredForDraft: false}, 'need.required_tools': {valueType: 'TEXT_ARRAY', requiredForDraft: false},
  'need.required_vehicles': {valueType: 'TEXT_ARRAY', requiredForDraft: false}, 'need.required_licenses': {valueType: 'TEXT_ARRAY', requiredForDraft: false},
  'need.task_country_code': {valueType: 'TEXT', requiredForDraft: true}, 'need.task_geography': {valueType: 'OBJECT', requiredForDraft: true},
  'need.starts_at': {valueType: 'TIMESTAMPTZ', requiredForDraft: false}, 'need.ends_at': {valueType: 'TIMESTAMPTZ', requiredForDraft: false},
  'need.verified_identity_required': {valueType: 'BOOLEAN', requiredForDraft: false}, 'need.minimum_experience_years': {valueType: 'INTEGER', requiredForDraft: false},
  'need.price_rsd': {valueType: 'INTEGER', requiredForDraft: false},
};

// ------------------------------------------------------------------ what a correct matcher says about the SMOKE reference workers
export const BLOCKER = {'smoke-fit-tool': 'MISSING_REQUIRED_TOOL', 'smoke-missing-van': 'MISSING_REQUIRED_VEHICLE', 'smoke-unknown-capability': 'MISSING_REQUIRED_LICENSE',
  'canary-fit-unfit': 'MISSING_REQUIRED_TOOL', 'canary-scheduled': 'MISSING_REQUIRED_VEHICLE'};

export function agreeing(label, caseId) {
  const base = {hardBlockers: [], dispatchBlockers: [], dispatchEligible: true, responseAllowed: true, reasonCodes: ['SERVICE_MATCH'], score: 80};
  if (caseId === 'canary-radius' && (label === 'unfit' || label === 'unknown')) return {...base, dispatchBlockers: ['SERVICE_NOT_IN_WORK_PROFILE'], dispatchEligible: false};
  if (label === 'unfit' || label === 'unknown') return {...base, hardBlockers: [BLOCKER[caseId] ?? 'MISSING_REQUIRED_TOOL'], dispatchEligible: false, responseAllowed: false};
  if (label === 'paused') return {...base, dispatchBlockers: ['CURRENT_AVAILABILITY_PAUSED', 'OUTSIDE_AVAILABILITY'], dispatchEligible: false};
  if (label === 'draft' || label === 'control-restricted') return {...base, hardBlockers: ['ACCOUNT_OR_PROFILE_RESTRICTED'], dispatchEligible: false, responseAllowed: false};
  if (label === 'far') return {...base, dispatchBlockers: ['OUTSIDE_PREFERRED_RADIUS'], dispatchEligible: false};
  return base;   // 'test-world' is eligible for the matcher too: only the dispatch admission refuses it (it is simply not in `delivered`)
}

const KNOWN_LABELS = ['fit', 'unfit', 'unknown', 'paused', 'draft', 'far', 'booked', 'second', 'control-restricted', 'fits', 'does-not-fit', 'unknown-capability', 'test-world'];

/**
 * A scripted fixture factory for the runner. Options (all optional):
 *   outcome(label, caseId) -> the matcher result (without the identity fields, which the fake adds)   delivered: labels the wave reaches (default ['fit', 'fits'])
 *   failWorker: a label whose createWorker throws          wave / rounds / schedule / need / needBack / workerBack: scripted answers (a function receives the default)
 *   kinds: what kindsOfStoredNeed returns                  foreignActive: what countForeignActive returns         refuseAt: product path step that throws (error.ex06Step)
 *   matchPatch(label, match) -> patched match (e.g. null)  distance: the distanceToStartKm every non-remote match reports (default 0)
 *   shapeGot: {label: 'NONE' | 'RULE' | 'WINDOW'} the coverage createWorker reports for the labelled worker (default: no shapeCoverage at all, like a derived worker)
 */
export function fakeFixtures({caseId, outcome = agreeing, delivered = ['fit', 'fits'], alsoDeliver = [], failWorker = null, wave = null, rounds = null, schedule = null, need = null, needBack = null,
  workerBack = null, kinds = null, foreignActive = 0, refuseAt = null, refuseMessage = null, matchPatch = null, distance = 0, materialisation = 'PRODUCT_PATH', droppedFacts = [], shapeGot = {}} = {}) {
  const calls = {retired: [], marks: 0, waves: 0, workers: [], specs: [], parked: 0, needs: [], paths: []};
  const labelOfProfile = new Map();
  const labelOf = text => KNOWN_LABELS.filter(label => text.startsWith(label + '-')).sort((a, b) => b.length - a.length)[0] ?? text;
  const currentCase = () => (typeof caseId === 'function' ? caseId(calls.needs.at(-1)?.facts ?? {}) : caseId);
  calls.reached = [];
  const defaultWave = () => (calls.reached.length ? {status: 'SENT', round: 1, policyWaveNo: 1, inserted: calls.reached.length, batchSize: 5} : {status: 'STOPPED', round: 1, policyWaveNo: 1, inserted: 0, batchSize: 5});
  const fx = {calls,
    mark: () => { calls.marks += 1; return {workers: 0, needs: 0}; },
    retireSince: since => calls.retired.push(since),
    createRequester: async spec => ({id: 'req', profileId: 'reqp', label: spec?.label}),
    createWorker: async spec => {
      const label = labelOf(spec.label);
      if (failWorker === label) throw new Error('FIXTURE_WORKER_FAILED');
      const worker = {id: 'acct-' + label, profileId: 'prof-' + label, bypassed: [], notes: [], label,
        ...(label in shapeGot ? {shapeCoverage: {shape: 'AVAILABLE_NOW_AND_SCHEDULED', wanted: true, got: shapeGot[label]}} : {})};
      labelOfProfile.set(worker.profileId, label);
      calls.workers.push(label);
      calls.specs.push({label, spec});
      return worker;
    },
    bookWorker: async (worker, interval) => { calls.booked ??= []; calls.booked.push({label: worker.label, interval}); return {needId: 'booking'}; },
    parkForeign: () => { calls.parked += 1; return {parkedWorkers: 0, scheduleRowsRemoved: 0, restore: []}; },
    countForeignActive: () => foreignActive,
    createNeedFromFacts: async (_requester, facts, options) => {
      calls.needs.push({facts, options});
      calls.paths.push(options?.path);
      calls.reached = [];
      if (refuseAt) { const error = new Error(refuseMessage ?? 'PRODUCT_REFUSED_AT_' + refuseAt); error.ex06Step = refuseAt; throw error; }
      const base = {needId: 'need-1', needRevision: 1, materialisation, synthetic: ['S'], droppedFacts, intent: {facts, interval: options?.interval ?? null}};
      return need ? need(base) : base;
    },
    readBackNeed: (_needId, intent) => {
      const geography = intent.facts['need.task_geography'] ?? {mode: 'STATIONARY'};
      const row = {status: 'PUBLISHED', approximate_lat: geography.mode === 'REMOTE' ? null : 45.27, approximate_lng: geography.mode === 'REMOTE' ? null : 19.83};
      return needBack ? needBack({row, mismatches: []}) : {row, mismatches: []};
    },
    readBackWorker: worker => {
      const row = {profile_status: 'ACTIVE', lat: 45.27, lng: 19.83};
      return workerBack ? workerBack(worker, {row, mismatches: []}) : {row, mismatches: []};
    },
    readSchedule: () => (schedule ?? {queued: true, nextRunAt: 'x', attempts: 0, lastStatus: null, lastReason: null, lockedUntil: null}),
    readMatch: (_needId, profileId) => {
      const label = labelOfProfile.get(profileId);
      const geography = calls.needs.at(-1)?.facts['need.task_geography'] ?? {mode: 'STATIONARY'};
      let match = {workerProfileId: profileId, workerAccountId: 'acct-' + label, ...outcome(label, currentCase()), distanceToStartKm: geography.mode === 'REMOTE' ? null : distance,
        taskLocationMode: geography.mode ?? 'STATIONARY'};
      if (matchPatch) match = matchPatch(label, match);
      if ((match && match.dispatchEligible && delivered.includes(label)) || alsoDeliver.includes(label)) calls.reached.push(profileId);
      return match;
    },
    runWave: () => { calls.waves += 1; const base = defaultWave(); return wave ? wave(base) : base; },
    readDeliveries: () => calls.reached.map(profileId => ({worker_profile_id: profileId})),
    readRounds: () => {
      const base = calls.reached.length ? [{round_no: 1, status: 'SENT', stop_reason: null, batch_size: 5}] : [{round_no: 1, status: 'STOPPED', stop_reason: 'NO_ELIGIBLE_CANDIDATES', batch_size: 5}];
      return rounds ? rounds(base) : base;
    },
    readEvents: accountId => (calls.reached.includes('prof-' + accountId.replace(/^acct-/, '')) ? [{id: 'e'}] : []),
    kindsOfStoredNeed: () => {
      const given = typeof kinds === 'function' ? kinds(calls.needs.at(-1)?.facts) : kinds;
      const category = calls.needs.at(-1)?.facts['need.category'];
      const byCategory = {'Fizicki poslovi': ['FIZICKI_POSLOVI'], 'Selidba i prevoz': ['SELIDBE_PREVOZ'], Dostava: ['DOSTAVA']}[category] ?? [];
      return {exclusionInput: given ?? byCategory, skillsOnly: given ?? byCategory};
    },
  };
  return fx;
}

// ------------------------------------------------------------------ a recording stand-in of the proof adapter
export function fakeRuntime({flowFails = false, rows: rowsOverride = null, sqlAnswers = null} = {}) {
  const log = [];
  const response = {
    rpc_get_worker_location: {revision: 'r'.repeat(64)}, rpc_get_worker_capacity: {revision: 'c'.repeat(64)},
    rpc_get_worker_availability: {revision: 'a'.repeat(64), timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: []},
    rpc_ai_open_need_conversation_v2: 'conv-1', rpc_ai_claim_need_turn_v2_service: {claim: {attemptId: 'att-1'}}, rpc_ai_dispatch_need_turn_v2_service: true,
    rpc_ai_complete_need_turn_v2_service: {state: 'SUCCEEDED'},
    rpc_get_need_publication_context: {kind: 'READY', binding: {b: 1}}, rpc_claim_ai_task_review_evaluation_service: {acquired: true, attemptId: 'ev-1'},
    rpc_complete_ai_task_review_evaluation_service: {state: 'DONE'},
    rpc_submit_response: {responseId: 'resp-1', version: 1, needRevision: 1, contentHash: 'h'}, rpc_select_response: {agreementId: 'agr-1'},
    rpc_withdraw_response: {state: 'WITHDRAWN'}, rpc_cancel_need: {state: 'CANCELLED'}, rpc_admit_account_lineage_service: {changed: true},
    rpc_read_account_lineage_service: {lineage: 'UNCLASSIFIED', revision: 0},
    rpc_get_need_location_review: {revision: 'l'.repeat(64)}, rpc_prepare_ai_task_review: {canAccept: true, reviewId: 'rev-2', displayedContentDigest: 'dig'},
  };
  const makeClient = who => ({
    rpc: (name, args) => {
      const entry = {who, kind: 'rpc', name, args, signal: null};
      log.push(entry);
      const builder = {abortSignal: signal => { entry.signal = signal; return builder; }, then: (resolve, reject) => Promise.resolve({data: name in response ? response[name] : null, error: null}).then(resolve, reject)};
      return builder;
    },
    from: table => {
      const entry = {who, kind: 'update', table, patch: null, signal: null};
      const builder = {update: patch => { entry.patch = patch; log.push(entry); return builder; }, eq: () => builder, select: () => builder, single: () => builder,
        abortSignal: signal => { entry.signal = signal; return builder; }, then: (resolve, reject) => Promise.resolve({data: {id: 'p'}, error: null}).then(resolve, reject)};
      return builder;
    },
  });
  const sqlLog = [];
  const rt = {
    q: value => "'" + String(value).replaceAll("'", "''") + "'", randomUUID,
    ok: async promise => { const result = await promise; if (result.error) throw new Error('LOCAL_RPC:' + result.error.message); return result.data; },
    sql: text => {
      sqlLog.push(text);
      if (sqlAnswers) { const hit = sqlAnswers.find(([pattern]) => pattern.test(text)); if (hit) return hit[1]; }
      return /select private\.dispatch_next_wave/.test(text) ? '{"inserted":1,"batchSize":5}' : /closure_source_digest|work_kinds|match_detail/.test(text) ? '[]' : '';
    },
    rows: text => {
      sqlLog.push(text);
      if (rowsOverride) { const hit = rowsOverride.find(([pattern]) => pattern.test(text)); if (hit) return typeof hit[1] === 'function' ? hit[1](text) : hit[1]; }
      return /app_profiles where account_id/.test(text) ? [{id: 'profile-' + log.length}] : [];
    },
    service: makeClient('service'), actor: async label => ({id: 'acct-' + label, client: makeClient('actor:' + label)}),
  };
  const flow = {
    review: async (a, cid, location) => { log.push({kind: 'flow.review', cid, location}); return {canAccept: true, reviewId: 'rev-1', displayedContentDigest: 'dig'}; },
    accept: async () => { log.push({kind: 'flow.accept'}); return {needId: 'need-1', needRevision: 1, reviewId: 'rev-1', clientRequestId: 'crq'}; },
    publish: a => { if (flowFails) return Promise.resolve({data: null, error: {message: 'POLICY_NOT_READY'}}); return Promise.resolve({data: {state: 'PUBLISHED'}, error: null}); },
  };
  if (flowFails) response.rpc_get_need_publication_context = {kind: 'NOT_READY', code: 'POLICY_NOT_READY'};
  return {rt, flow, log, sqlLog, response};
}
