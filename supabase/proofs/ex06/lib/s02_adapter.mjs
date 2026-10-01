// EX-06 S03: the TOTAL adapter from the S02 contract corpus (supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json, EX06_CONTRACT_CORPUS) to the normalised corpus the harness runs.
// Pure module: no database, no network, no file access (the caller reads the file).
//
// Total means: every key of the corpus root, of a case, of `expected`, of `expected.review`, of `expected.kind`, of a reference worker, of its profile and of its `expect` is either MAPPED (the
// harness uses it) or listed in an IGNORED table below WITH A REASON. An unknown key throws (S02_KEY_UNKNOWN): a new S02 key must be decided here before a run can happen, never dropped silently.
// What S03 cannot exercise is not ignored but reported as UNCONSUMED (a corpus expectation that stays unverified): application-time blockers, the eligibility classes of cases that publish no
// task, a calendar-busy worker, the referenceTasks of the WORKER family. Every skipped case carries a reason. Nothing is adjusted: the corpus says what it says.
//
// Text of the corpus is synthetic and stays in the corpus file: the adapter reads it at run time and builds the fixtures from the expected FACTS (words, canonical items, numbers, geography);
// the conversation turns are an input of the AI slice and are never sent anywhere.
import {HarnessInputError} from './compare.mjs';
import {AVAILABILITY_SHAPES, parseIso, zonedParts} from './timeutil.mjs';
import {cityCentre} from './geo.mjs';
import {clone, finalizeCase, sha256Hex} from './corpus.mjs';

export const S02_CORPUS_ID = 'EX06_CONTRACT_CORPUS';
export const ACTIVATION_PLACEHOLDER_SKILL = 'ex06 aktivacija';   // the one skill a worker with no skills is activated with; the owner UPDATE then clears it ("activate-then-clear")

const M = 'MAPPED';
const ignored = reason => ({ignore: reason});
const mapped = {use: M};

// ------------------------------------------------------------------ the key tables
export const ROOT_KEYS = Object.freeze({
  corpusId: mapped, corpusVersion: mapped, synthetic: mapped, clock: mapped, cases: mapped, caseCount: mapped, referenceWorkerShapes: mapped, eligibilityValues: mapped, availabilityShapes: mapped,
  workKinds: mapped, runAgainstProvider: mapped, runAgainstMatcher: mapped, providerCalls: mapped,
  kind: ignored('corpus label (SYNTHETIC_CONTRACT_CORPUS_NOT_A_MODEL_QUALITY_SCORE): the harness states its own claims'),
  createdOn: ignored('provenance date'),
  sliceRef: ignored('provenance pointer to the scope document'),
  statement: ignored('the corpus author\'s statement that all text is synthetic; the harness checks personal-data patterns itself'),
  language: ignored('language of the synthetic message texts (the harness never sends them)'),
  contractSources: ignored('pointers to the source files the expectations were read from (documentation of the corpus, not an expectation)'),
  kindOutcomeValues: ignored('the closed list of kind outcomes; kind.expected is validated against workKinds + unclassified/refused instead'),
  consumerClassLegend: ignored('legend of matcherConsumerClasses (documentation)'),
  openAssumptions: ignored('the corpus author\'s open assumptions A1-A6 (documentation; A3 is the very thing S03 diffs)'),
  planCoverage: ignored('plan-chapter coverage map of the cases (coverage report input, not an expectation)'),
});

export const CASE_KEYS = Object.freeze({
  id: mapped, family: mapped, title: mapped, expected: mapped, referenceWorkers: mapped, referenceWorkersNote: mapped,
  planRefs: ignored('plan / runbook cross-references of the case (coverage metadata)'),
  matcherConsumerClasses: ignored('which matcher gate consumes a fact (HARD / SOFT / SCORE / APPLICATION_TIME / NONE): classification metadata; S03 observes the matcher itself'),
  turns: ignored('the synthetic user message of the AI interview: input of the AI/provider slice; S03 builds the task from the expected facts and sends only synthetic proposals'),
  mustNot: ignored('negative statements about the AI\'s behaviour (provider / prompt level), not a matcher expectation'),
  synonymGroup: ignored('names the synonym group of the case for the corpus coverage report'),
  newNiche: ignored('marks a case that introduces a new kind of work (coverage report)'),
  concurrencyGroup: ignored('names the concurrent-creation group of the case (taxonomy slice, not matching)'),
  a02Probe: ignored('marks the A02 category-dead-end probe (AI slice)'),
  variantOf: ignored('names the case this one is a variant of (coverage report)'),
  script: ignored('script of the text (CYRILLIC / LATIN) of the synthetic message (AI slice)'),
  stemTrap: ignored('marks a case built to trip the work-kind stems; its effect is exactly what kind.expected and the reference workers assert'),
  licenceNote: ignored('a note about self-declared licences (no verification badge); documentation'),
  writerlessFields: ignored('lists the worker fields that have no product writer; the harness reports every bypass it uses itself'),
  referenceAssumes: ignored('WORKER family: the profile defaults the reference tasks assume (the family is not consumed by S03)'),
  referenceTasks: ignored('WORKER family: reference tasks of a worker (the family is not consumed by S03; its expectations are reported UNCONSUMED)'),
  note: ignored('free-text note of the case author'),
  startingCandidate: ignored('a candidate starting point recorded by the corpus author (documentation)'),
  openQuestion: ignored('an open owner question recorded by the corpus author (documentation)'),
});

export const TASK_EXPECTED_KEYS = Object.freeze({
  facts: mapped, review: mapped, kind: mapped,
  turn: ignored('expected AI turn behaviour (safety, next step, task relation, price unit, schedule pattern, guard): provider / prompt level'),
  softFacts: ignored('facts the AI proposes as free text, compared by words in the AI slice'),
  unknownFacts: ignored('facts that must stay unknown in the AI slice'),
  mustNotFacts: ignored('facts the AI must not invent (AI slice)'),
  publicationOutcome: ignored('publication-policy expectation (ALLOW / REVIEW / BLOCK); the product path of S03 records a synthetic ALLOW, the policy slice owns the rest'),
  factsOptional: ignored('marks facts that need not be carried by the AI turn'),
  correctedKeys: ignored('keys a user correction turn changes (AI slice)'),
});
const WORKER_FAMILY = 'WORKER family (the worker interview is not consumed by S03)';
export const WORKER_EXPECTED_KEYS = Object.freeze({
  turn: ignored(WORKER_FAMILY), patch: ignored(WORKER_FAMILY), unknownFields: ignored(WORKER_FAMILY), profileAfterTurn: ignored(WORKER_FAMILY), review: ignored(WORKER_FAMILY),
  kind: ignored(WORKER_FAMILY), asksFor: ignored(WORKER_FAMILY), derivedStateAfter: ignored(WORKER_FAMILY), patchNote: ignored(WORKER_FAMILY),
});
export const REFERENCE_TASK_KEYS = Object.freeze({
  label: ignored(WORKER_FAMILY), requires: ignored(WORKER_FAMILY), workerAvailabilityForThisTask: ignored(WORKER_FAMILY), workerProfileStatus: ignored(WORKER_FAMILY),
  expect: ignored(WORKER_FAMILY + '; its expectations are reported UNCONSUMED'), window: ignored(WORKER_FAMILY),
});
export const REVIEW_KEYS = Object.freeze({
  state: mapped,
  missingRequired: ignored('what the review still misses (AI / review slice)'),
  askableMissing: ignored('what the interview may still ask (AI slice)'),
  mapPointsToConfirm: ignored('the map points the person confirms (the fixtures confirm every slot of the geography)'),
  humanConfirmationRequired: ignored('review contract (the product path always goes through review and accept)'),
  canPublishFromAiAlone: ignored('review contract (the product path always goes through review and accept)'),
});
export const KIND_KEYS = Object.freeze({
  expected: mapped,
  probeTexts: ignored('the texts the corpus author probed work_kinds_v5 with (the harness probes the STORED category and skills instead)'),
  currentStemsYield: ignored('the author\'s source reading of what the stems yield (a prediction, not an expectation; the harness runs the real function)'),
  currentStemsRelation: ignored('the author\'s recorded relation of that prediction and kind.expected'),
  rawProbes: ignored('extra raw probe texts of the author'),
});
export const WORKER_ROW_KEYS = Object.freeze({
  shape: mapped, profile: mapped, expect: mapped, unknownCapability: mapped, note: mapped, sourceReadingPrediction: mapped,
});
export const PROFILE_KEYS = Object.freeze({
  skills: mapped, tools: mapped, vehicles: mapped, licenses: mapped, exclusions: mapped, teamCapacity: mapped, city: mapped, radiusKm: mapped, availability: mapped, busy: mapped,
  profileStatus: mapped, yearsExperience: mapped,
});
export const EXPECT_KEYS = Object.freeze({
  eligibility: mapped, responseAllowed: mapped, dispatchEligible: mapped, hardBlockers: mapped, dispatchBlockers: mapped,
  applicationTimeBlockers: ignored('enforced when applying or selecting (TEAM_CAPACITY_EXCEEDED), not by match_detail or the dispatch wave: REPORTED UNCONSUMED, never dropped'),
});

export const SHAPE_LABELS = Object.freeze({FITS: 'fits', DOES_NOT_FIT: 'does-not-fit', UNKNOWN_CAPABILITY: 'unknown-capability'});
export const KNOWN_REVIEW_STATES = Object.freeze(['READY_FOR_REVIEW', 'COLLECTING', 'BLOCKED', 'NEEDS_POLICY_REVIEW']);
const ELIGIBILITY_CLASSES = Object.freeze(['ELIGIBLE', 'MANUAL_ONLY', 'HARD_BLOCKED', 'NO_PUBLISHED_NEED', 'NOT_PUBLISHABLE']);
const UNPUBLISHED_CLASSES = Object.freeze(['NO_PUBLISHED_NEED', 'NOT_PUBLISHABLE']);
const KNOWN_UNKNOWN_CAPABILITY = Object.freeze(['skills', 'tools', 'vehicles', 'licenses', 'availability', 'teamCapacity', 'yearsExperience']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isStringList = value => Array.isArray(value) && value.every(item => typeof item === 'string');

// ------------------------------------------------------------------ bookkeeping
function newBook() {
  return {mapped: new Map(), ignored: new Map(), unconsumed: {total: 0, byKey: {}, list: []}, leaves: {present: 0, consumed: 0, unconsumed: 0},
    counts: {cases: {total: 0, task: 0, worker: 0, mapped: 0, skipped: 0}, workers: {rows: 0, built: 0, skipped: 0}}};
}
const bump = (map, key, by = 1) => map.set(key, (map.get(key) ?? 0) + by);

/** Every key of `object` must be in `table`: MAPPED keys are counted, IGNORED keys are counted with their reason, an unknown key throws. */
function classifyKeys(object, table, path, book) {
  if (!isObject(object)) throw new HarnessInputError('S02_SHAPE_INVALID', `${path} must be an object`);
  for (const key of Object.keys(object)) {
    const rule = table[key];
    if (!rule) throw new HarnessInputError('S02_KEY_UNKNOWN', `${path}.${key}: decide whether the harness consumes it (lib/s02_adapter.mjs) before a run`);
    if (rule.use) bump(book.mapped, `${path}.${key}`);
    else {
      bump(book.ignored, `${path}.${key}`);
      book.ignoredReasons ??= {};
      book.ignoredReasons[`${path}.${key}`] = rule.ignore;
    }
  }
}

function addUnconsumed(book, entry, {leaf = true} = {}) {
  book.unconsumed.total += 1;
  book.unconsumed.byKey[entry.key] = (book.unconsumed.byKey[entry.key] ?? 0) + 1;
  book.unconsumed.list.push(entry);
  if (leaf) { book.leaves.present += 1; book.leaves.unconsumed += 1; }
}

// ------------------------------------------------------------------ facts
function syntheticText(key, mentions, where) {
  if (!(Array.isArray(mentions) && mentions.length > 0 && mentions.every(item => typeof item === 'string' && item.length > 0))) throw new HarnessInputError('S02_FACT_SHAPE_UNKNOWN', `${where}: mustMentionAnyOf`);
  const first = mentions[0];
  switch (key) {
    case 'need.title': return `EX-06 proba: ${first}`;
    case 'need.description': return `Sintetički opis zadatka za EX-06 probu: ${mentions.join(', ')}.`;
    case 'need.access_notes': return `Sintetička napomena EX-06: ${first}.`;
    case 'need.exact_address': return `Sintetička adresa EX-06 (${first}), bez broja.`;
    default: throw new HarnessInputError('S02_FREE_TEXT_FACT_UNSUPPORTED', `${where}: ${key}`);
  }
}

/** One S02 fact -> the value of the needFactsV2 key: {free, canonicalText} -> text, {free, canonicalItems} -> list, {free, mustMentionAnyOf} -> synthetic text, anything else as is. */
export function factValue(key, value, where) {
  if (isObject(value) && 'free' in value) {
    const keys = Object.keys(value).sort().join('+');
    if (value.free !== true) throw new HarnessInputError('S02_FACT_SHAPE_UNKNOWN', `${where}: free must be true`);
    if (keys === 'canonicalText+free') return String(value.canonicalText);
    if (keys === 'canonicalItems+free') return clone(value.canonicalItems);
    if (keys === 'free+mustMentionAnyOf') return syntheticText(key, value.mustMentionAnyOf, where);
    throw new HarnessInputError('S02_FACT_SHAPE_UNKNOWN', `${where}: keys ${keys}`);
  }
  return clone(value);
}

// ------------------------------------------------------------------ workers
function checkClassConsistency(expect, where) {
  const cls = expect.eligibility;
  if (!ELIGIBILITY_CLASSES.includes(cls)) throw new HarnessInputError('S02_ELIGIBILITY_UNKNOWN', `${where}: ${String(cls)}`);
  if (UNPUBLISHED_CLASSES.includes(cls)) return;
  const checks = {ELIGIBLE: () => expect.responseAllowed === true && expect.dispatchEligible === true, MANUAL_ONLY: () => expect.responseAllowed === true && expect.dispatchEligible === false,
    HARD_BLOCKED: () => expect.responseAllowed === false && expect.dispatchEligible === false};
  if (!checks[cls]()) throw new HarnessInputError('S02_ELIGIBILITY_INCONSISTENT', `${where}: ${cls} with responseAllowed ${expect.responseAllowed} / dispatchEligible ${expect.dispatchEligible}`);
}

function workerFromRow(row, caseId, index, book, {consumeBusy}) {
  const where = `${caseId}.referenceWorkers[${index}]`;
  classifyKeys(row, WORKER_ROW_KEYS, 'case.referenceWorkers[]', book);
  const label = SHAPE_LABELS[row.shape];
  if (!label) throw new HarnessInputError('S02_SHAPE_UNKNOWN', `${where}: ${String(row.shape)}`);
  classifyKeys(row.profile, PROFILE_KEYS, 'case.referenceWorkers[].profile', book);
  classifyKeys(row.expect, EXPECT_KEYS, 'case.referenceWorkers[].expect', book);
  const p = row.profile;
  if (!(row.unknownCapability === undefined || (Array.isArray(row.unknownCapability) && row.unknownCapability.every(item => KNOWN_UNKNOWN_CAPABILITY.includes(item))))) {
    throw new HarnessInputError('S02_UNKNOWN_CAPABILITY_VALUE', `${where}: ${JSON.stringify(row.unknownCapability)}`);
  }
  for (const item of row.unknownCapability ?? []) {
    if (['skills', 'tools', 'vehicles', 'licenses'].includes(item) && !(Array.isArray(p[item]) && p[item].length === 0)) throw new HarnessInputError('S02_UNKNOWN_CAPABILITY_INCONSISTENT', `${where}: ${item} is unknown but the profile declares some`);
    if (item === 'availability' && p.availability !== 'NONE_DECLARED') throw new HarnessInputError('S02_UNKNOWN_CAPABILITY_INCONSISTENT', `${where}: availability is unknown but the profile says ${p.availability}`);
  }
  if (!(p.availability in AVAILABILITY_SHAPES)) throw new HarnessInputError('S02_AVAILABILITY_SHAPE_UNKNOWN', `${where}: ${String(p.availability)}`);
  if (!['NONE', 'OVERLAPS_TASK_WINDOW'].includes(p.busy)) throw new HarnessInputError('S02_BUSY_UNKNOWN', `${where}: ${String(p.busy)}`);
  if (!['ACTIVE', 'DRAFT'].includes(p.profileStatus)) throw new HarnessInputError('S02_PROFILE_STATUS_UNKNOWN', `${where}: ${String(p.profileStatus)}`);
  cityCentre(p.city);   // EX06_CITY_UNKNOWN
  const e = row.expect;
  for (const key of ['eligibility', 'responseAllowed', 'dispatchEligible', 'hardBlockers', 'dispatchBlockers']) if (!(key in e)) throw new HarnessInputError('S02_EXPECT_INCOMPLETE', `${where}: ${key}`);
  if (typeof e.responseAllowed !== 'boolean' || typeof e.dispatchEligible !== 'boolean' || !isStringList(e.hardBlockers) || !isStringList(e.dispatchBlockers)) throw new HarnessInputError('S02_EXPECT_SHAPE', where);
  for (const key of ['skills', 'tools', 'vehicles', 'licenses', 'exclusions']) if (!isStringList(p[key])) throw new HarnessInputError('S02_PROFILE_SHAPE', `${where}: ${key}`);
  const profile = {skills: [...p.skills], tools: [...p.tools], vehicles: [...p.vehicles], licenses: [...p.licenses], radiusKm: p.radiusKm, teamCapacity: p.teamCapacity,
    availability: {shape: p.availability}, location: {city: p.city}, status: p.profileStatus};
  const bypass = {};
  if (p.exclusions.length) bypass.exclusions = [...p.exclusions];
  if (p.yearsExperience > 0) bypass.yearsExperience = p.yearsExperience;
  if (Object.keys(bypass).length) profile.bypass = bypass;
  if (p.profileStatus === 'ACTIVE' && p.skills.length === 0) { profile.skills = [ACTIVATION_PLACEHOLDER_SKILL]; profile.skillsAfterActivation = []; }
  const annotations = {shape: row.shape, unknownCapability: row.unknownCapability ?? [], corpusAvailability: p.availability, ...(row.sourceReadingPrediction ? {sourceReadingPrediction: clone(row.sourceReadingPrediction)} : {})};
  const worker = {label, profile, note: row.note ?? null, annotations, unconsumed: [], skip: null, expect: null};
  const present = Object.keys(e).length;
  // eligibility class: validated against the booleans (the corpus must not contradict itself), then consumed through them
  if (UNPUBLISHED_CLASSES.includes(e.eligibility)) throw new HarnessInputError('S02_ELIGIBILITY_UNEXPECTED', `${where}: ${e.eligibility} in a case that publishes a task`);
  checkClassConsistency(e, where);
  worker.expect = {responseAllowed: e.responseAllowed, dispatchEligible: e.dispatchEligible, hardBlockers: [...e.hardBlockers], dispatchBlockers: [...e.dispatchBlockers]};
  // The leaves of this worker's `expect`: eligibility (validated against the booleans), responseAllowed, dispatchEligible, hardBlockers and dispatchBlockers are consumed unless the worker
  // is not built; applicationTimeBlockers never is.
  let consumedLeaves = 5, unconsumedLeaves = 0;
  if ('applicationTimeBlockers' in e) {
    if (!(Array.isArray(e.applicationTimeBlockers) && e.applicationTimeBlockers.every(item => typeof item === 'string'))) throw new HarnessInputError('S02_EXPECT_SHAPE', `${where}: applicationTimeBlockers`);
    unconsumedLeaves += 1;
    if (e.applicationTimeBlockers.length) {
      const entry = {caseId, worker: label, key: 'applicationTimeBlockers', value: [...e.applicationTimeBlockers],
        reason: 'enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply'};
      worker.unconsumed.push(entry);
      addUnconsumed(book, entry, {leaf: false});
    }
  }
  if (p.busy === 'OVERLAPS_TASK_WINDOW') {
    if (consumeBusy) profile.busy = 'OVERLAPS_TASK_WINDOW';
    else {
      const entry = {caseId, worker: label, key: 'busy', value: 'OVERLAPS_TASK_WINDOW',
        reason: 'a calendar-busy worker needs an Agreement over the task window (agreement_calendar_sync); S03 does not book workers, so the worker is not built and its expectation (' + JSON.stringify({hardBlockers: e.hardBlockers}) + ') stays unverified'};
      worker.unconsumed.push(entry);
      addUnconsumed(book, entry, {leaf: false});
      worker.skip = 'busy OVERLAPS_TASK_WINDOW: UNCONSUMED (S03 does not book workers)';
      unconsumedLeaves += consumedLeaves;
      consumedLeaves = 0;
    }
  }
  book.leaves.present += present;
  book.leaves.consumed += consumedLeaves;
  book.leaves.unconsumed += unconsumedLeaves;
  return worker;
}

// ------------------------------------------------------------------ cases
function checkRoot(root, book) {
  classifyKeys(root, ROOT_KEYS, 'corpus', book);
  if (root.corpusId !== S02_CORPUS_ID) throw new HarnessInputError('S02_CORPUS_ID', String(root.corpusId));
  if (root.synthetic !== true) throw new HarnessInputError('CORPUS_NOT_SYNTHETIC', 'the harness accepts synthetic text only');
  if (root.providerCalls !== 0 || root.runAgainstProvider !== false || root.runAgainstMatcher !== false) throw new HarnessInputError('S02_CORPUS_CLAIMS_A_RUN', 'the corpus says it was run against a provider or the matcher');
  if (!Array.isArray(root.cases) || root.cases.length === 0) throw new HarnessInputError('CORPUS_EMPTY');
  if (JSON.stringify(Object.keys(root.availabilityShapes ?? {}).sort()) !== JSON.stringify(Object.keys(AVAILABILITY_SHAPES).sort())) throw new HarnessInputError('S02_AVAILABILITY_SHAPES_CHANGED', JSON.stringify(Object.keys(root.availabilityShapes ?? {})));
  if (JSON.stringify([...(root.referenceWorkerShapes ?? [])].sort()) !== JSON.stringify(Object.keys(SHAPE_LABELS).sort())) throw new HarnessInputError('S02_WORKER_SHAPES_CHANGED', JSON.stringify(root.referenceWorkerShapes));
  if (!Array.isArray(root.eligibilityValues) || root.eligibilityValues.some(value => !ELIGIBILITY_CLASSES.includes(value))) throw new HarnessInputError('S02_ELIGIBILITY_VALUES_CHANGED', JSON.stringify(root.eligibilityValues));
  if (!Array.isArray(root.workKinds) || root.workKinds.some(kind => typeof kind !== 'string')) throw new HarnessInputError('S02_WORK_KINDS_INVALID');
  const clock = root.clock;
  if (!isObject(clock) || clock.timeZone !== 'Europe/Belgrade') throw new HarnessInputError('S02_CLOCK_INVALID', JSON.stringify(clock));
  const instant = parseIso(clock.nowUtc);
  const local = zonedParts(instant.ms, clock.timeZone);
  if (local.date !== clock.localDate || local.time !== clock.localTime) throw new HarnessInputError('S02_CLOCK_INCONSISTENT', `${clock.nowUtc} is ${local.date} ${local.time} in ${clock.timeZone}, not ${clock.localDate} ${clock.localTime}`);
  const total = root.cases.length;
  const family = name => root.cases.filter(item => item?.family === name).length;
  if (!isObject(root.caseCount) || root.caseCount.total !== total || root.caseCount.task !== family('TASK') || root.caseCount.worker !== family('WORKER') || family('TASK') + family('WORKER') !== total) {
    throw new HarnessInputError('S02_CASE_COUNT_MISMATCH', JSON.stringify(root.caseCount) + ` vs ${total} cases (${family('TASK')} TASK, ${family('WORKER')} WORKER)`);
  }
  return clock;
}

function skippedTaskCase(item, book, reason) {
  for (const [index, row] of (item.referenceWorkers ?? []).entries()) {
    classifyKeys(row, WORKER_ROW_KEYS, 'case.referenceWorkers[]', book);
    classifyKeys(row.profile, PROFILE_KEYS, 'case.referenceWorkers[].profile', book);
    classifyKeys(row.expect, EXPECT_KEYS, 'case.referenceWorkers[].expect', book);
    book.counts.workers.rows += 1;
    book.counts.workers.skipped += 1;
    const label = SHAPE_LABELS[row.shape];
    if (!label) throw new HarnessInputError('S02_SHAPE_UNKNOWN', `${item.id}.referenceWorkers[${index}]: ${String(row.shape)}`);
    for (const key of Object.keys(row.expect)) {
      addUnconsumed(book, {caseId: item.id, worker: label, key: key === 'eligibility' ? 'eligibility:' + row.expect.eligibility : key, value: row.expect[key], reason: 'the case publishes no task (' + reason + '), so no worker can be matched'});
    }
  }
}

/**
 * Convert the parsed S02 corpus into the normalised corpus of lib/corpus.mjs. Throws HarnessInputError on any key or value the adapter has not decided about.
 * Options: registry (NEED_FACT_V2_DEFINITIONS), label, consumeBusy (default false: a calendar-busy worker is reported UNCONSUMED and not built).
 * Returns {label, schema, version, id, totalCases, cases, skipped, unconsumed, leaves, clock, counts, keyCoverage}.
 */
export function adaptS02(raw, {registry, label = 'CORPUS', consumeBusy = false} = {}) {
  if (!registry) throw new HarnessInputError('CORPUS_REGISTRY_REQUIRED');
  const book = newBook();
  const clock = checkRoot(raw, book);
  const seen = new Set(), cases = [], skipped = [];
  for (const item of raw.cases) {
    classifyKeys(item, CASE_KEYS, 'case', book);
    const id = item.id;
    if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]{1,80}$/.test(id)) throw new HarnessInputError('CASE_ID_INVALID', String(id));
    if (seen.has(id)) throw new HarnessInputError('CASE_ID_DUPLICATE', id);
    seen.add(id);
    book.counts.cases.total += 1;
    if (item.family === 'WORKER') {
      book.counts.cases.worker += 1;
      classifyKeys(item.expected, WORKER_EXPECTED_KEYS, 'case.expected(WORKER)', book);
      for (const task of item.referenceTasks ?? []) {
        classifyKeys(task, REFERENCE_TASK_KEYS, 'case.referenceTasks[]', book);
        const leaves = isObject(task.expect) ? Object.keys(task.expect).length : 0;
        addUnconsumed(book, {caseId: id, worker: task.label ?? null, key: 'referenceTasks[].expect', value: task.expect?.eligibility ?? null,
          reason: 'WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow'}, {leaf: false});
        book.leaves.present += leaves;
        book.leaves.unconsumed += leaves;
      }
      skipped.push({id, family: 'WORKER', reason: 'WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED'});
      book.counts.cases.skipped += 1;
      continue;
    }
    if (item.family !== 'TASK') throw new HarnessInputError('S02_FAMILY_UNKNOWN', `${id}: ${String(item.family)}`);
    book.counts.cases.task += 1;
    classifyKeys(item.expected, TASK_EXPECTED_KEYS, 'case.expected(TASK)', book);
    classifyKeys(item.expected.review, REVIEW_KEYS, 'case.expected.review', book);
    classifyKeys(item.expected.kind, KIND_KEYS, 'case.expected.kind', book);
    const state = item.expected.review.state;
    if (!KNOWN_REVIEW_STATES.includes(state)) throw new HarnessInputError('S02_REVIEW_STATE_UNKNOWN', `${id}: ${String(state)}`);
    if (state !== 'READY_FOR_REVIEW') {
      const reason = `review.state ${state}: the task is not published by the contract`;
      skippedTaskCase(item, book, reason);
      skipped.push({id, family: 'TASK', reason: reason + '; its reference-worker eligibility classes are reported UNCONSUMED'});
      book.counts.cases.skipped += 1;
      continue;
    }
    const facts = {};
    if (!isObject(item.expected.facts)) throw new HarnessInputError('CASE_FACTS_MISSING', id);
    for (const [key, value] of Object.entries(item.expected.facts)) facts[key] = factValue(key, value, `${id}.${key}`);
    if (!Array.isArray(item.referenceWorkers) || item.referenceWorkers.length === 0) throw new HarnessInputError('S02_REFERENCE_WORKERS_MISSING', id);
    const kind = item.expected.kind.expected;
    let expectedKinds;
    if (kind === 'unclassified') expectedKinds = [];
    else if (raw.workKinds.includes(kind)) expectedKinds = [kind];
    else throw new HarnessInputError('S02_KIND_UNKNOWN', `${id}: ${String(kind)}`);
    const workers = item.referenceWorkers.map((row, index) => {
      book.counts.workers.rows += 1;
      const worker = workerFromRow(row, id, index, book, {consumeBusy});
      book.counts.workers[worker.skip ? 'skipped' : 'built'] += 1;
      return worker;
    });
    const annotations = {title: item.title ?? null, ...(item.referenceWorkersNote ? {referenceWorkersNote: item.referenceWorkersNote} : {})};
    cases.push(finalizeCase({id, family: 'TASK', expectedFacts: facts, expectedKinds, referenceWorkers: workers, deriveWorkers: false, annotations}, {registry}));
    book.counts.cases.mapped += 1;
  }
  if (cases.length === 0) throw new HarnessInputError('CORPUS_NOTHING_TO_RUN', `all ${raw.cases.length} cases were skipped`);
  if (cases.length + skipped.length !== raw.cases.length) throw new HarnessInputError('S02_CASES_LOST', `${cases.length} + ${skipped.length} != ${raw.cases.length}`);
  return {label, schema: S02_CORPUS_ID, version: raw.corpusVersion ?? null, id: S02_CORPUS_ID, totalCases: raw.cases.length, cases, skipped, unconsumed: book.unconsumed, leaves: book.leaves, clock,
    counts: book.counts, keyCoverage: {mapped: Object.fromEntries([...book.mapped].sort()), ignored: Object.fromEntries([...book.ignored].sort()), ignoredReasons: book.ignoredReasons ?? {}}};
}

/**
 * The corpus loader: the S02 contract is converted by the adapter; the harness-native shape ({synthetic: true, cases: [{expectedFacts...}]}) by normaliseCorpus (injected, to keep this module
 * free of a cycle). A document that is neither is refused: the default path never silently picks a file of a different contract.
 */
export function loadCorpus(raw, {registry, label = 'CORPUS', normaliseNative, consumeBusy = false} = {}) {
  if (isObject(raw) && raw.corpusId === S02_CORPUS_ID) return adaptS02(raw, {registry, label, consumeBusy});
  if (isObject(raw) && raw.corpusId !== undefined) throw new HarnessInputError('CORPUS_SHAPE_UNRECOGNISED', `corpusId ${JSON.stringify(raw.corpusId)} is not ${S02_CORPUS_ID}`);
  if (typeof normaliseNative !== 'function') throw new HarnessInputError('CORPUS_SHAPE_UNRECOGNISED', 'a harness-native corpus needs normaliseNative');
  return normaliseNative(raw, {registry, label});
}

export {sha256Hex};
