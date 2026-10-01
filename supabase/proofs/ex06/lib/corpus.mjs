// EX-06 S03/S04: the NORMALISED corpus contract the harness consumes, its validation, the built-in SMOKE and CANARY corpora, and the derivation of reference workers.
// Pure module. The real corpus (slice S02, supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json) has its own shape and is converted by lib/s02_adapter.mjs into the shape below;
// nothing here encodes a product policy: every expectation comes from the corpus (or from the SMOKE / CANARY corpora, which are labelled as such everywhere).
//
// Normalised case:
//   {id, family, outcomeClass: 'READY',
//    expectedFacts: {'need.*': value}        needFactsV2 keys and value types (checked against the real registry src/contracts/needFactsV2.ts); times may be '@now+3d' or absolute
//    expectedKinds: ['SELIDBE_PREVOZ'] | null  asserted against private.work_kinds_v5(array_prepend(category, required_skills)) of the STORED task row (the input of the exclusion gate)
//    referenceWorkers: [{label, profile, expect | null, note, annotations?, unconsumed?: [{key, value, reason}], skip?: reason}]
//    deriveWorkers: boolean                  true = add fit / unfit / unknown derived from the task (the harness-native SMOKE shape); false = the corpus lists every worker
//    positiveOnly?: true + positiveOnlyReason  noEligibleWorker?: true   explicit, listed opt-outs of the per-case discrimination checks (a case needs a negative of the CORPUS that names its
//      cause: the harness's own control does NOT count; positiveOnly needs the reason the corpus gives and the report lists the case)
//    annotations?: {...}}
import {createHash} from 'node:crypto';
import {HarnessInputError, validateExpectation} from './compare.mjs';
import {cityCentre} from './geo.mjs';
import {AVAILABILITY_SHAPES, resolveRelativeTime} from './timeutil.mjs';

export {resolveRelativeTime};
export const STANDARD_LABELS = Object.freeze(['fit', 'unfit', 'unknown']);
// Facts the product writes through the location editor (or never through the AI): they are not sent as AI proposals by the fixtures.
export const LOCATION_AUTHORITY_KEYS = Object.freeze(['need.task_country_code', 'need.task_geography', 'need.resolved_location', 'need.exact_address', 'need.access_notes']);
// Facts the product's AI path cannot carry (manualOnly in needFactsV2.ts, and the manual writer rpc_set_manual_need_fact_v2 is not on DEV): the task is written by a labelled direct insert.
export const BYPASS_FACT_KEYS = Object.freeze(['need.verified_identity_required', 'need.public_photo_paths']);
// States the product cannot reach at all on this chain (identity verification is fail-closed, photos are public-media rows): their cases are counted apart as UNREACHABLE_STATE.
export const UNREACHABLE_STATE_RULES = Object.freeze([
  {key: 'need.verified_identity_required', test: value => value === true, reason: 'a task that requires verified identity cannot be produced by the product on DEV (the AI path forbids it, rpc_set_manual_need_fact_v2 is not on DEV, the client refuses to publish it)'},
  {key: 'need.public_photo_paths', test: value => Array.isArray(value) && value.length > 0, reason: 'public photo paths are media rows the harness does not create; the direct insert drops them'},
]);

const MISMATCH = Object.freeze({tools: ['nepovezan alat'], vehicles: ['nepovezano vozilo'], licenses: ['nepovezana dozvola']});
const asList = value => (Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
export const clone = value => JSON.parse(JSON.stringify(value));

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?:\+\d{8,}|\b0\d{2}[ /-]?\d{3}[ /-]?\d{3,4}\b)/;
export const containsPersonalDataPattern = text => EMAIL.test(text) || PHONE.test(text);

const TYPE_CHECKS = {
  TEXT: value => typeof value === 'string',
  ENUM: value => typeof value === 'string',
  TIMESTAMPTZ: value => typeof value === 'string',
  INTEGER: value => Number.isInteger(value),
  BOOLEAN: value => typeof value === 'boolean',
  TEXT_ARRAY: value => Array.isArray(value) && value.every(item => typeof item === 'string'),
  OBJECT: value => value !== null && typeof value === 'object' && !Array.isArray(value),
};

/** The facts of a case with every relative time resolved (starts_at / ends_at only; no other fact is rewritten). Absolute times are left alone: see timeutil.materialiseTimes for the rebase. */
export function factsAtTime(facts, nowMs) {
  const out = clone(facts);
  for (const key of ['need.starts_at', 'need.ends_at']) if (key in out) out[key] = resolveRelativeTime(out[key], nowMs);
  return out;
}

/** True when the facts carry a key the product's AI path cannot carry (BYPASS_FACT_KEYS): the task can only be written by the labelled direct insert. */
export const hasBypassFacts = facts => Object.keys(facts).some(key => BYPASS_FACT_KEYS.includes(key));

/** Why a case cannot be reached in the product, or null (see UNREACHABLE_STATE_RULES). */
export function unreachableReason(facts) {
  const hit = UNREACHABLE_STATE_RULES.find(rule => rule.key in facts && rule.test(facts[rule.key]));
  return hit ? hit.reason : null;
}

// ------------------------------------------------------------------ worker profiles (validated exactly, nested keys included)
export const WORKER_PROFILE_KEYS = Object.freeze(['skills', 'tools', 'vehicles', 'licenses', 'radiusKm', 'teamCapacity', 'availability', 'location', 'status', 'displayName', 'bypass',
  'world', 'skillsAfterActivation', 'busy']);
export const AVAILABILITY_KEYS = Object.freeze(['timezone', 'availableNow', 'rules', 'windows']);
export const LOCATION_KEYS = Object.freeze(['countryCode', 'city', 'position']);
export const BYPASS_KEYS = Object.freeze(['exclusions', 'minimumFeeRsd', 'yearsExperience', 'ratingWorker', 'proactiveNotifications', 'sameDayUrgentNotifications']);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isStringList = value => Array.isArray(value) && value.every(item => typeof item === 'string');
function noUnknownKeys(value, allowed, code, where) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new HarnessInputError(code, `${where}: ${key}`);
}

/** Exact validation of a worker profile spec. An unknown key, a string where an object is required or a wrong type is a HarnessInputError; nothing silently falls back to a default. */
export function checkWorkerProfile(profile, where) {
  if (!isObject(profile)) throw new HarnessInputError('WORKER_PROFILE_NOT_AN_OBJECT', where);
  noUnknownKeys(profile, WORKER_PROFILE_KEYS, 'WORKER_PROFILE_UNKNOWN_KEY', where);
  for (const key of ['skills', 'tools', 'vehicles', 'licenses']) {
    if (profile[key] !== undefined && !isStringList(profile[key])) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: ${key}`);
  }
  if (profile.skillsAfterActivation !== undefined && !isStringList(profile.skillsAfterActivation)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: skillsAfterActivation`);
  if (profile.displayName !== undefined && !(typeof profile.displayName === 'string' && profile.displayName.trim().length >= 2)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: displayName`);
  if (profile.status !== undefined && !['ACTIVE', 'DRAFT'].includes(profile.status)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: status`);
  if (profile.world !== undefined && !['REAL', 'TEST'].includes(profile.world)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: world`);
  if (profile.busy !== undefined && !['NONE', 'OVERLAPS_TASK_WINDOW'].includes(profile.busy)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: busy`);
  if (profile.radiusKm !== undefined && !(Number.isInteger(profile.radiusKm) && profile.radiusKm >= 1 && profile.radiusKm <= 200)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: radiusKm (an integer 1..200)`);
  if (profile.teamCapacity !== undefined && !(Number.isInteger(profile.teamCapacity) && profile.teamCapacity >= 1 && profile.teamCapacity <= 50)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: teamCapacity (an integer 1..50)`);
  if (profile.availability !== undefined && profile.availability !== null) {
    if (!isObject(profile.availability)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: availability must be an object (or null)`);
    const keys = Object.keys(profile.availability);
    if (keys.length === 1 && keys[0] === 'shape') {
      if (!(profile.availability.shape in AVAILABILITY_SHAPES)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: availability.shape ${String(profile.availability.shape)}`);
    } else {
      noUnknownKeys(profile.availability, AVAILABILITY_KEYS, 'WORKER_PROFILE_UNKNOWN_KEY', where + '.availability');
      const a = profile.availability;
      if (a.timezone !== undefined && typeof a.timezone !== 'string') throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: availability.timezone`);
      if (a.availableNow !== undefined && typeof a.availableNow !== 'boolean') throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: availability.availableNow`);
      for (const key of ['rules', 'windows']) if (a[key] !== undefined && !Array.isArray(a[key])) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: availability.${key}`);
    }
  }
  if (profile.location !== undefined && profile.location !== null) {
    if (!isObject(profile.location)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: location must be an object (or null)`);
    noUnknownKeys(profile.location, LOCATION_KEYS, 'WORKER_PROFILE_UNKNOWN_KEY', where + '.location');
    const l = profile.location;
    if (l.countryCode !== undefined && !(typeof l.countryCode === 'string' && /^[A-Z]{2}$/.test(l.countryCode))) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: location.countryCode`);
    if (l.city !== undefined) cityCentre(l.city);   // EX06_CITY_UNKNOWN for a city that is not in the table
    if (l.position !== undefined && l.position !== null) {
      if (!isObject(l.position)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: location.position`);
      noUnknownKeys(l.position, ['latitude', 'longitude'], 'WORKER_PROFILE_UNKNOWN_KEY', where + '.location.position');
      for (const key of ['latitude', 'longitude']) {
        if (typeof l.position[key] !== 'number' || Math.round(l.position[key] * 100) / 100 !== l.position[key]) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: location.position.${key} (a number with at most two decimals)`);
      }
    }
  }
  if (profile.bypass !== undefined) {
    if (!isObject(profile.bypass)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: bypass must be an object`);
    noUnknownKeys(profile.bypass, BYPASS_KEYS, 'WORKER_PROFILE_UNKNOWN_KEY', where + '.bypass');
    const b = profile.bypass;
    if (b.exclusions !== undefined && !isStringList(b.exclusions)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: bypass.exclusions`);
    for (const key of ['minimumFeeRsd', 'yearsExperience']) {
      if (b[key] !== undefined && !(Number.isInteger(b[key]) && b[key] >= 0)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: bypass.${key}`);
    }
    if (b.ratingWorker !== undefined && !(typeof b.ratingWorker === 'number' && b.ratingWorker >= 0 && b.ratingWorker <= 5)) throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: bypass.ratingWorker`);
    for (const key of ['proactiveNotifications', 'sameDayUrgentNotifications']) {
      if (b[key] !== undefined && typeof b[key] !== 'boolean') throw new HarnessInputError('WORKER_PROFILE_WRONG_TYPE', `${where}: bypass.${key}`);
    }
  }
  return profile;
}

// ------------------------------------------------------------------ the reference workers of a task
/**
 * The three reference workers of a task, derived only from what the task requires (the harness-native shape). fit: declares everything and is available for the task's time (the shape
 * is resolved against the rebased window at run time). unfit: an explicit, non-matching set for the first required resource group (vehicles, then tools, then licences), or a different
 * skill when the task requires no resource. unknown: declares no tools, vehicles or licences at all. A label that cannot be derived is omitted, never invented.
 * A minimum_experience_years > 0 gives all three the years of experience by a labelled bypass (years_experience has no product writer: scope gap G04).
 */
export function deriveReferenceWorkers(facts) {
  const need = {skills: asList(facts['need.required_skills']), tools: asList(facts['need.required_tools']), vehicles: asList(facts['need.required_vehicles']), licenses: asList(facts['need.required_licenses'])};
  const years = Number(facts['need.minimum_experience_years'] ?? 0);
  const base = {availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, ...(years > 0 ? {bypass: {yearsExperience: years}} : {})};
  const fit = {...base, skills: need.skills.length ? [...need.skills] : ['pomocni poslovi'], tools: [...need.tools], vehicles: [...need.vehicles], licenses: [...need.licenses]};
  const out = {fit: {profile: clone(fit), note: 'declares everything the task requires'}};
  const group = ['vehicles', 'tools', 'licenses'].find(name => need[name].length > 0);
  if (group) {
    out.unfit = {profile: {...clone(fit), [group]: [...MISMATCH[group]]}, note: `declares ${group} that do not match the requirement`};
    out.unknown = {profile: {...clone(fit), tools: [], vehicles: [], licenses: []}, note: 'declares no tools, vehicles or licences at all (unknown capability)'};
  } else if (need.skills.length) {
    out.unfit = {profile: {...clone(fit), skills: ['nepovezano zanimanje']}, note: 'declares a different skill'};
  }
  return out;
}

/** The task-independent negative control every case carries: the fit profile left a DRAFT. The matcher's hard gate "profile_status <> ACTIVE" is the matcher body's own, not a corpus policy. */
export const CONTROL_RESTRICTED = Object.freeze({label: 'control-restricted', note: 'HARNESS CONTROL: the fit profile left a DRAFT (not ACTIVE)',
  expect: Object.freeze({hardBlockersInclude: Object.freeze(['ACCOUNT_OR_PROFILE_RESTRICTED']), responseAllowed: false, dispatchEligible: false, delivery: false, event: false})});

/** The reference workers of one normalised case, in build order: [{label, profile, expect, note, control, skip, annotations}]. Controls are appended unless the case opts out. */
export function referenceWorkerPlan(caseItem, {controls = true} = {}) {
  const plan = caseItem.referenceWorkers.map(worker => ({label: worker.label, profile: clone(worker.profile), expect: worker.expect ? clone(worker.expect) : null, note: worker.note ?? null, control: false,
    skip: worker.skip ?? null, annotations: worker.annotations ?? null, unconsumed: worker.unconsumed ?? []}));
  if (controls) {
    const fit = plan.find(worker => !worker.skip && worker.expect?.dispatchEligible === true && (worker.profile.status ?? 'ACTIVE') === 'ACTIVE') ?? plan.find(worker => !worker.skip && (worker.profile.status ?? 'ACTIVE') === 'ACTIVE');
    if (fit) {
      const profile = clone(fit.profile);
      delete profile.skillsAfterActivation;   // a DRAFT is never activated, so there is nothing to clear afterwards
      delete profile.busy;
      profile.status = 'DRAFT';
      plan.push({label: CONTROL_RESTRICTED.label, profile, expect: clone(CONTROL_RESTRICTED.expect), note: CONTROL_RESTRICTED.note, control: true, skip: null, annotations: null, unconsumed: []});
    }
  }
  return plan;
}

// ------------------------------------------------------------------ validation and normalisation
function checkFacts(id, facts, registry) {
  if (facts === null || typeof facts !== 'object' || Array.isArray(facts) || Object.keys(facts).length === 0) throw new HarnessInputError('CASE_FACTS_MISSING', id);
  for (const [key, value] of Object.entries(facts)) {
    const definition = registry[key];
    if (!definition) throw new HarnessInputError('CASE_FACT_KEY_UNKNOWN', `${id}: ${key}`);
    if (!TYPE_CHECKS[definition.valueType]?.(value)) throw new HarnessInputError('CASE_FACT_VALUE_TYPE', `${id}: ${key} must be ${definition.valueType}`);
    if (containsPersonalDataPattern(JSON.stringify(value))) throw new HarnessInputError('CASE_PERSONAL_DATA_PATTERN', `${id}: ${key}`);
  }
  const missing = Object.entries(registry).filter(([key, def]) => def.requiredForDraft && !(key in facts) && !LOCATION_AUTHORITY_KEYS.includes(key)).map(([key]) => key);
  if (missing.length) throw new HarnessInputError('CASE_REQUIRED_FACTS_MISSING', `${id}: ${missing.join(',')}`);
  const geography = facts['need.task_geography'];
  if (geography) {
    for (const point of [geography.start, geography.end, geography.serviceArea, ...(Array.isArray(geography.waypoints) ? geography.waypoints : [])]) {
      if (point?.city !== undefined) cityCentre(point.city);   // EX06_CITY_UNKNOWN: the task pin comes from the city table
    }
  }
}

/** Validate a normalised case and fill its defaults. Throws HarnessInputError; the result is a fresh object. */
export function finalizeCase(item, {registry, where = item?.id}) {
  const id = item?.id;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(id)) throw new HarnessInputError('CASE_ID_INVALID', String(id));
  checkFacts(id, item.expectedFacts, registry);
  if (item.expectedKinds !== null && item.expectedKinds !== undefined && !(isStringList(item.expectedKinds))) throw new HarnessInputError('CASE_KINDS_INVALID', id);
  if (!Array.isArray(item.referenceWorkers)) throw new HarnessInputError('CASE_BLOCK_INVALID', `${where}.referenceWorkers`);
  const labels = new Set(), workers = [];
  for (const worker of item.referenceWorkers) {
    if (!isObject(worker) || typeof worker.label !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(worker.label)) throw new HarnessInputError('REFERENCE_WORKER_LABEL_INVALID', `${where}: ${JSON.stringify(worker?.label)}`);
    if (labels.has(worker.label)) throw new HarnessInputError('REFERENCE_WORKER_LABEL_DUPLICATE', `${where}: ${worker.label}`);
    labels.add(worker.label);
    if (!worker.profile) throw new HarnessInputError('REFERENCE_WORKER_WITHOUT_PROFILE', `${where}/${worker.label}: the task requires nothing it can be derived from; give a profile`);
    checkWorkerProfile(worker.profile, `${where}/${worker.label}`);
    if (worker.expect !== null && worker.expect !== undefined) validateExpectation(worker.expect, `${where}.referenceWorkers.${worker.label}.expect`);
    workers.push({label: worker.label, profile: clone(worker.profile), expect: worker.expect ? clone(worker.expect) : null, note: worker.note ?? null, annotations: worker.annotations ?? null,
      unconsumed: worker.unconsumed ?? [], skip: worker.skip ?? null});
  }
  // positiveOnly is an explicit, visible opt-out of the "every case needs a corpus-named negative" rule: it needs the reason the corpus gives, and the report lists it.
  if (item.positiveOnly === true && !(typeof item.positiveOnlyReason === 'string' && item.positiveOnlyReason.length >= 20)) throw new HarnessInputError('POSITIVE_ONLY_NEEDS_A_REASON', `${id}: positiveOnly:true needs positiveOnlyReason (the reason the corpus gives, at least 20 characters)`);
  if (item.positiveOnly !== true && item.positiveOnlyReason !== undefined) throw new HarnessInputError('POSITIVE_ONLY_REASON_WITHOUT_FLAG', id);
  return {id, family: item.family ?? null, outcomeClass: 'READY', expectedFacts: clone(item.expectedFacts), expectedKinds: item.expectedKinds ?? null, referenceWorkers: workers,
    deriveWorkers: item.deriveWorkers === true, positiveOnly: item.positiveOnly === true, positiveOnlyReason: item.positiveOnly === true ? item.positiveOnlyReason : null,
    noEligibleWorker: item.noEligibleWorker === true, annotations: item.annotations ?? null};
}

/** Convert a harness-native case ({expectedFacts, expectedEligibility?, referenceWorkers?: {label: {profileFrom?, profile?, expect?}}}) into the normalised array form (derived workers included). */
function fromNative(item) {
  const derived = deriveReferenceWorkers(item.expectedFacts ?? {});
  const explicit = item.referenceWorkers ?? {}, eligibility = item.expectedEligibility ?? {};
  for (const [name, block] of [['expectedEligibility', item.expectedEligibility], ['referenceWorkers', item.referenceWorkers]]) {
    if (block === undefined) continue;
    if (block === null || typeof block !== 'object' || Array.isArray(block)) throw new HarnessInputError('CASE_BLOCK_INVALID', `${item.id}.${name}`);
  }
  const labels = [...new Set([...Object.keys(derived), ...Object.keys(explicit), ...Object.keys(eligibility)])];
  const workers = labels.map(label => {
    const given = explicit[label] ?? {};
    const base = given.profileFrom ? derived[given.profileFrom]?.profile : derived[label]?.profile;
    if (given.profileFrom && !base) throw new HarnessInputError('REFERENCE_WORKER_PROFILE_FROM_UNKNOWN', `${item.id}/${label} -> ${given.profileFrom}`);
    const profile = {...(base ? clone(base) : {}), ...(given.profile ? clone(given.profile) : {})};
    if (!base && !given.profile) throw new HarnessInputError('REFERENCE_WORKER_WITHOUT_PROFILE', `${item.id}/${label}: the task requires nothing it can be derived from; give a profile`);
    return {label, profile, expect: given.expect ?? eligibility[label] ?? null, note: derived[label]?.note ?? (given.profileFrom ? `copy of ${given.profileFrom} with overrides` : 'explicit profile')};
  });
  return {...item, referenceWorkers: workers, deriveWorkers: true};
}

/**
 * Validate and normalise a parsed harness-native corpus ({synthetic: true, cases: [...]}). `registry` = NEED_FACT_V2_DEFINITIONS of src/contracts/needFactsV2.ts (or a stand-in).
 * Returns {label, schema, version, id, totalCases, cases, skipped, unconsumed, leaves, clock}. CORPUS_EMPTY is checked before AND after skipping: a corpus whose cases are all skipped is refused.
 */
export function normaliseCorpus(raw, {registry, label = 'CORPUS'} = {}) {
  if (!registry) throw new HarnessInputError('CORPUS_REGISTRY_REQUIRED');
  const root = Array.isArray(raw) ? {cases: raw} : raw;
  if (root === null || typeof root !== 'object' || !Array.isArray(root.cases)) throw new HarnessInputError('CORPUS_SHAPE_UNRECOGNISED', 'expected {cases: [...]}');
  if (root.synthetic === false) throw new HarnessInputError('CORPUS_NOT_SYNTHETIC', 'the harness accepts synthetic text only');
  if (root.cases.length === 0) throw new HarnessInputError('CORPUS_EMPTY');
  const seen = new Set(), cases = [], skipped = [];
  for (const item of root.cases) {
    const id = item?.id;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(id)) throw new HarnessInputError('CASE_ID_INVALID', String(id));
    if (seen.has(id)) throw new HarnessInputError('CASE_ID_DUPLICATE', id);
    seen.add(id);
    if (item.outcomeClass !== undefined && item.outcomeClass !== 'READY') {
      skipped.push({id, family: item.family ?? null, reason: `outcomeClass ${item.outcomeClass} is not a built task (only READY is materialised)`});
      continue;
    }
    cases.push(finalizeCase(fromNative(item), {registry}));
  }
  if (cases.length === 0) throw new HarnessInputError('CORPUS_NOTHING_TO_RUN', `all ${root.cases.length} cases were skipped`);
  return {label, schema: root.schema ?? null, version: root.version ?? null, id: root.schema ?? null, totalCases: root.cases.length, cases, skipped,
    unconsumed: {total: 0, byKey: {}, list: []}, leaves: {present: 0, consumed: 0, unconsumed: 0}, clock: root.clock ?? null};
}

/** A cap from EX06_MAX_CASES: unset = no cap; otherwise a positive integer (NaN, 0, a negative number or text is a HarnessInputError, never "run nothing"). */
export function capFromEnv(value) {
  if (value === undefined || value === null || value === '') return null;
  if (!/^[1-9]\d*$/.test(String(value))) throw new HarnessInputError('CASE_CAP_INVALID', JSON.stringify(value) + ' (EX06_MAX_CASES is a positive integer)');
  return Number(value);
}

/**
 * Chooses the corpus file: EX06_CORPUS, else supabase/proofs/ai/corpus/..., else supabase/proofs/ex06/corpus/...; null when none exists (then the SMOKE corpus may run).
 * EX06_REQUIRE_CORPUS=1 makes "no file" an error (CORPUS_REQUIRED_BUT_MISSING) instead of a silent fall back to SMOKE.
 */
export function chooseCorpusPath(env, exists) {
  const candidates = [env.EX06_CORPUS, 'supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json', 'supabase/proofs/ex06/corpus/ex06_contract_corpus_v1.json'].filter(Boolean);
  if (env.EX06_CORPUS && !exists(env.EX06_CORPUS)) throw new HarnessInputError('CORPUS_FILE_MISSING', env.EX06_CORPUS);
  const found = candidates.find(path => exists(path)) ?? null;
  if (!found && env.EX06_REQUIRE_CORPUS === '1') throw new HarnessInputError('CORPUS_REQUIRED_BUT_MISSING', 'EX06_REQUIRE_CORPUS=1 and no corpus file exists (' + candidates.join(', ') + ')');
  return found;
}

export const sha256Hex = text => createHash('sha256').update(text).digest('hex');

// ------------------------------------------------------------------ the built-in SMOKE and CANARY corpora
const GEO = {mode: 'STATIONARY', start: {city: 'Novi Sad'}};
const common = {'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE', 'need.people_needed': 1, 'need.task_country_code': 'RS', 'need.task_geography': GEO};
const blockedByResource = code => ({hardBlockers: [code], dispatchBlockers: [], dispatchEligible: false, responseAllowed: false, delivery: false, event: false});
const fitExpectation = {hardBlockers: [], dispatchBlockers: [], dispatchEligible: true, responseAllowed: true, delivery: true, event: true};

/**
 * SMOKE corpus: three inline synthetic cases that exercise the harness mechanics (fit / missing van / unknown capability). The expectations are the author's reading of the matcher
 * bodies (private.match_detail_without_calendar: hard gates for tools, licences and vehicles, soft gates for availability and radius; dispatch_cheap_candidate_admitted prefilter).
 * They are NOT the contract corpus and prove nothing about task text. A run on this corpus is SMOKE_ONLY, never PASS. Each gate class has a deliberately negative expectation.
 */
export const SMOKE_CORPUS = Object.freeze({
  schema: 'EX06_HARNESS_SMOKE', version: 'smoke-1', synthetic: true,
  cases: [
    {id: 'smoke-fit-tool', family: 'smoke', expectedKinds: ['FIZICKI_POSLOVI'],
      expectedFacts: {...common, 'need.title': 'Prenos ormara na isti sprat', 'need.description': 'Sintetički primer za probu harnessa: treba preneti jedan ormar iz sobe u hodnik.',
        'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi'], 'need.required_tools': ['kolica za prenos']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_TOOL'), unknown: blockedByResource('MISSING_REQUIRED_TOOL')}},
    {id: 'smoke-missing-van', family: 'smoke', expectedKinds: ['SELIDBE_PREVOZ'],
      expectedFacts: {...common, 'need.title': 'Selidba garsonjere', 'need.description': 'Sintetički primer za probu harnessa: selidba garsonjere, potreban je kombi.',
        'need.category': 'Selidba i prevoz', 'need.required_skills': ['selidba'], 'need.required_vehicles': ['kombi']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_VEHICLE'), unknown: blockedByResource('MISSING_REQUIRED_VEHICLE')}},
    {id: 'smoke-unknown-capability', family: 'smoke', expectedKinds: ['DOSTAVA'],
      expectedFacts: {...common, 'need.title': 'Dostava paketa po gradu', 'need.description': 'Sintetički primer za probu harnessa: dostava dva paketa po gradu, potrebna je vozačka dozvola.',
        'need.category': 'Dostava', 'need.required_skills': ['dostava'], 'need.required_licenses': ['kategorija b']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_LICENSE'), unknown: blockedByResource('MISSING_REQUIRED_LICENSE')},
      referenceWorkers: {
        paused: {profileFrom: 'fit', profile: {availability: {timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: []}},
          expect: {hardBlockers: [], responseAllowed: true, dispatchEligible: false, dispatchBlockersInclude: ['CURRENT_AVAILABILITY_PAUSED'], delivery: false, event: false}},
        draft: {profileFrom: 'fit', profile: {status: 'DRAFT'},
          expect: {hardBlockersInclude: ['ACCOUNT_OR_PROFILE_RESTRICTED'], responseAllowed: false, dispatchEligible: false, delivery: false, event: false}},
      }},
  ],
});

/** The reason a REAL requester's task is not delivered to a TEST-world worker: private.dispatch_cheap_candidate_admitted (PKG-015b) holds the same-world gate, match_detail does not. */
const worldNotDelivered = Object.freeze({hardBlockers: [], dispatchBlockers: [], dispatchEligible: true, responseAllowed: true, delivery: false, event: false, notDeliveredBecause: 'REQUESTER_AND_WORKER_IN_DIFFERENT_WORLDS'});

/**
 * CANARY corpus: seven product-path cases that run FIRST. They prove, before any corpus case, that the pipeline can produce an eligible and a delivered worker, a worker refused for a
 * named hard blocker, a scheduled task the fit worker's covering availability admits, a worker beyond the radius (the city table's coordinates reach the matcher), EVERY geography shape the
 * S02 corpus uses (STATIONARY above, REMOTE, POINT_TO_POINT, MULTI_STOP: a fixture defect in a location value, a waypoint pin or the end slot is a canary failure and not a quiet
 * PRODUCT_PATH_REFUSED finding of a corpus case), and the world gate (a REAL requester's task reaches a REAL worker and not a TEST-world worker, which match_detail still calls eligible).
 * Any disagreement is a HARNESS_ERROR (a fixture or chain defect), never a finding. Nothing here is a contract expectation.
 */
export const CANARY_CORPUS = Object.freeze({
  schema: 'EX06_HARNESS_CANARY', version: 'canary-2', synthetic: true,
  cases: [
    {id: 'canary-fit-unfit', family: 'canary',
      expectedFacts: {...common, 'need.title': 'Kanarinac: prenos stvari', 'need.description': 'Sintetički kanarinac harnessa: prenos jedne kutije, potrebna su kolica.',
        'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi'], 'need.required_tools': ['kolica za prenos']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_TOOL')}},
    {id: 'canary-scheduled', family: 'canary',
      expectedFacts: {...common, 'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': '@now+2d', 'need.ends_at': '@now+2d+2h', 'need.title': 'Kanarinac: zakazan prevoz',
        'need.description': 'Sintetički kanarinac harnessa: zakazan prevoz u budućem terminu, potreban je kombi.', 'need.category': 'Selidba i prevoz', 'need.required_skills': ['selidba'],
        'need.required_vehicles': ['kombi']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_VEHICLE')}},
    {id: 'canary-radius', family: 'canary',
      expectedFacts: {...common, 'need.title': 'Kanarinac: poslovi u Novom Sadu', 'need.description': 'Sintetički kanarinac harnessa: poslovi u Novom Sadu, radnik iz drugog grada.',
        'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi']},
      expectedEligibility: {fit: fitExpectation},
      referenceWorkers: {far: {profileFrom: 'fit', profile: {location: {city: 'Niš'}},
        expect: {hardBlockers: [], responseAllowed: true, dispatchEligible: false, dispatchBlockers: ['OUTSIDE_PREFERRED_RADIUS'], delivery: false, event: false}}}},
    {id: 'canary-remote', family: 'canary',
      expectedFacts: {...common, 'need.schedule_kind': 'REMOTE_ANYTIME', 'need.task_geography': {mode: 'REMOTE'}, 'need.title': 'Kanarinac: posao na daljinu',
        'need.description': 'Sintetički kanarinac harnessa: posao na daljinu, potreban je računar.', 'need.category': 'Prepisivanje dokumenta', 'need.required_skills': ['prepisivanje teksta'],
        'need.required_tools': ['racunar']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_TOOL')}},
    {id: 'canary-point-to-point', family: 'canary',
      expectedFacts: {...common, 'need.task_geography': {mode: 'POINT_TO_POINT', start: {label: 'Liman', city: 'Novi Sad'}, end: {label: 'Detelinara', city: 'Novi Sad'}}, 'need.title': 'Kanarinac: prevoz od tačke do tačke',
        'need.description': 'Sintetički kanarinac harnessa: prevoz iz jednog dela grada u drugi, potrebna su kolica.', 'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi'],
        'need.required_tools': ['kolica za prenos']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_TOOL')}},
    {id: 'canary-multi-stop', family: 'canary',
      expectedFacts: {...common, 'need.task_geography': {mode: 'MULTI_STOP', start: {label: 'Liman', city: 'Novi Sad'}, waypoints: [{label: 'Grbavica', city: 'Novi Sad'}], end: {label: 'Podbara', city: 'Novi Sad'}},
        'need.title': 'Kanarinac: prevoz sa usputnom stanicom', 'need.description': 'Sintetički kanarinac harnessa: prevoz sa jednom usputnom stanicom, potrebna su kolica.',
        'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi'], 'need.required_tools': ['kolica za prenos']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_TOOL')}},
    {id: 'canary-world', family: 'canary',
      expectedFacts: {...common, 'need.title': 'Kanarinac: svet radnika', 'need.description': 'Sintetički kanarinac harnessa: ista prilika za radnika iz istog i iz drugog sveta, potrebna su kolica.',
        'need.category': 'Fizicki poslovi', 'need.required_skills': ['fizicki poslovi'], 'need.required_tools': ['kolica za prenos']},
      expectedEligibility: {fit: fitExpectation, unfit: blockedByResource('MISSING_REQUIRED_TOOL')},
      referenceWorkers: {'test-world': {profileFrom: 'fit', profile: {world: 'TEST'}, expect: worldNotDelivered}}},
  ],
});
