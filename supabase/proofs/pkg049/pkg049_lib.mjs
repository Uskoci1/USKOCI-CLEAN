// B09 / PKG-049 price-authority characterization: the pure parts of the proof (reference model of the rule, case generator, outcome helpers, the weakening edits and plan, the markdown report).
// PURE module: no database, no network, no environment. Unit-tested in pkg049_pins.test.mjs and pkg049_lib.test.mjs; the proof (pkg049_proof.mjs) drives the real stack with it.
import {PINS, renderPinGateMarkdown} from './pkg049_pins.mjs';
export const INT4_MAX = 2147483647;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// The reference model: a second, independent transcription of what private.assert_application_price_v5 does (docs: B09 finding section 1 step 2, section 5), used only to
// GENERATE the expected outcome of every case. The server is never trusted to describe itself: the proof compares the real server to this model, and this model is
// unit-tested against the literal cases the finding and the owner's decisions name (6 people at 3000 = 3000 / 9000 / 18000, TOTAL is one amount for the whole task, ...).
// Capacity checks (INVALID_COVERED_SLOTS, TEAM_CAPACITY_EXCEEDED, NEED_REMAINING_CAPACITY_EXCEEDED) fire BEFORE the price check and are outside this model.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export function priceOutcome(task, covered, sent) {
  if (sent === null || sent === undefined || sent <= 0) return {ok: false, message: 'INVALID_PRICE'};
  if (task.mode !== 'MY_PRICE') return {ok: true};
  if (task.price === null || task.price === undefined || task.price <= 0) return {ok: false, message: 'FIXED_PRICE_NOT_READY'};
  const mismatch = {ok: false, message: 'FIXED_PRICE_MISMATCH'};
  if (task.basis === null || task.basis === undefined) return sent === task.price ? {ok: true} : mismatch;
  if (task.basis === 'PER_PERSON') return sent === task.price * covered ? {ok: true} : mismatch;
  if (task.basis === 'TOTAL') {
    if (covered !== task.slots) return {ok: false, message: 'TOTAL_PRICE_REQUIRES_ALL_SLOTS'};
    return sent === task.price ? {ok: true} : mismatch;
  }
  return {ok: false, message: 'UNKNOWN_PRICE_BASIS'};
}
/** The one amount the rule accepts for MY_PRICE (null when the task has none, or when no sendable int4 can equal it). OFFERS has no canonical amount. */
export function canonicalPrice(task, covered) {
  if (task.mode !== 'MY_PRICE' || task.price === null || task.price === undefined || task.price <= 0) return null;
  if (task.basis === null || task.basis === undefined) return task.price;
  if (task.basis === 'PER_PERSON') return task.price * covered <= INT4_MAX ? task.price * covered : null;
  if (task.basis === 'TOTAL') return covered === task.slots ? task.price : null;
  return null;
}
/** The DETAIL the helper attaches (finding / pkg033a format strings), or null when it attaches none. PostgREST returns it as `details`. */
export function expectedDetail(task, covered, sent, message) {
  if (message === 'FIXED_PRICE_MISMATCH' && task.basis === 'PER_PERSON') return `basis=PER_PERSON,perPerson=${task.price},covered=${covered},expected=${task.price * covered},sent=${sent}`;
  if (message === 'FIXED_PRICE_MISMATCH' && task.basis === 'TOTAL') return `basis=TOTAL,total=${task.price},sent=${sent}`;
  if (message === 'TOTAL_PRICE_REQUIRES_ALL_SLOTS') return `required=${task.slots},covered=${covered}`;
  return null;
}

/** The amounts a MODIFIED client may send for one (task, covered): the canonical one, one unit off, the bare amounts, zero, negative, null, the int4 maximum. */
export function candidateSents(task, covered) {
  const list = [];
  const add = (label, sent) => { const same = list.find(item => item.sent === sent); if (same) same.label += '+' + label; else list.push({label, sent}); };
  const canon = canonicalPrice(task, covered), amount = task.price;
  if (canon !== null) add('canonical', canon);
  if (task.mode === 'MY_PRICE' && amount > 0) {
    add('taskAmount', amount);
    if (amount * covered <= INT4_MAX) add('taskAmountTimesCovered', amount * covered);
    add('taskAmountPlusOne', amount + 1);
    if (amount > 1) add('taskAmountMinusOne', amount - 1);
    if (task.basis === 'TOTAL' && task.slots > 1 && amount % task.slots === 0) add('barePerPersonShare', amount / task.slots);
    if (canon !== null) { if (canon + 1 <= INT4_MAX) add('canonicalPlusOne', canon + 1); if (canon > 1) add('canonicalMinusOne', canon - 1); }
  }
  if (task.mode === 'MY_PRICE' && !(amount > 0)) { add('anyPositive', 3000); add('one', 1); }
  if (task.mode === 'OFFERS') { add('one', 1); add('typical', 7777); }
  add('int4Max', INT4_MAX); add('zero', 0); add('negative', -1); add('null', null);
  const cases = list.map(item => ({...item, expect: priceOutcome(task, covered, item.sent)}));
  return {refusals: cases.filter(item => !item.expect.ok), oks: cases.filter(item => item.expect.ok)};
}

/**
 * The shapes of task the matrix covers; `covered` = how many people the application brings.
 * `defined` / `decision` follow the finding (section 5, `defined` column): `defined: false` means the canonical text does not define that cell, so the proof CHARACTERISES it as it behaves
 * today and does not judge it (D1 NULL basis with more than one person, D6 one-person PER_PERSON / TOTAL). OFFERS is defined, but WHICH amounts it accepts (lower and upper bound) is the
 * open decision D4: see `cellLabel`.
 */
export const TASK_SHAPES = Object.freeze([
  {id: 'my_null_n1', task: {mode: 'MY_PRICE', price: 3000, basis: null, slots: 1}, covered: [1], defined: true, decision: null},
  {id: 'my_null_n3', task: {mode: 'MY_PRICE', price: 3000, basis: null, slots: 3}, covered: [1, 2, 3], defined: false, decision: 'D1'},
  {id: 'per_person_n1', task: {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 1}, covered: [1], defined: false, decision: 'D6'},
  {id: 'per_person_n3', task: {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 3}, covered: [1, 2, 3], defined: true, decision: null},
  {id: 'per_person_n6', task: {mode: 'MY_PRICE', price: 3000, basis: 'PER_PERSON', slots: 6}, covered: [1, 2, 6], defined: true, decision: null},
  {id: 'per_person_int4', task: {mode: 'MY_PRICE', price: 100000000, basis: 'PER_PERSON', slots: 50}, covered: [21, 22], defined: true, decision: null},
  {id: 'total_n3', task: {mode: 'MY_PRICE', price: 9000, basis: 'TOTAL', slots: 3}, covered: [1, 2, 3], defined: true, decision: null},
  {id: 'total_n1', task: {mode: 'MY_PRICE', price: 4000, basis: 'TOTAL', slots: 1}, covered: [1], defined: false, decision: 'D6'},
  {id: 'my_no_price', task: {mode: 'MY_PRICE', price: null, basis: null, slots: 1}, covered: [1], defined: true, decision: null},
  {id: 'offers_n1', task: {mode: 'OFFERS', price: null, basis: null, slots: 1}, covered: [1], defined: true, decision: null},
  {id: 'offers_n3', task: {mode: 'OFFERS', price: null, basis: null, slots: 3}, covered: [1, 3], defined: true, decision: null},
]);
/** The matrix size the generator is expected to produce, written down SEPARATELY from the generator (11 shapes, 21 covered cases, 142 refusals, 23 canonical or open-bound amounts accepted verbatim). */
export const MATRIX_EXPECTED = Object.freeze({shapes: 11, cases: 21, refusals: 142, accepted: 23});
/** The label of one matrix cell: an accepted OFFERS amount (any whole number 1..2147483647) is the open decision D4; every other cell takes the label of its shape. */
export function cellLabel(shape, item) {
  if (shape.task.mode === 'OFFERS' && item.expect.ok) return {defined: false, decision: 'D4'};
  return {defined: shape.defined, decision: shape.decision};
}
/** CANON = the canonical text defines the cell; PINNED_TO_TODAY = characterised as it behaves today under an open owner decision, never judged. */
export const statusOf = label => label.defined ? 'CANON' : 'PINNED_TO_TODAY (open ' + label.decision + ')';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Outcome helpers over the {status, data, error} a PostgREST call returns.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export function outcomeOf(response) {
  if (response.error) return {ok: false, status: response.status ?? null, code: response.error.code ?? null, message: response.error.message ?? null, details: response.error.details ?? null};
  return {ok: true, status: response.status ?? null, data: response.data};
}
export function isRefusal(response, message, sqlstate, status = 400) {
  const outcome = outcomeOf(response);
  return !outcome.ok && outcome.message === message && outcome.code === sqlstate && outcome.status === status;
}
/** The exact outcome of a refusal against an expectation {statuses: [..], codes: [..], message?}: every field that is given must match, a missing error never matches. Returns a list of problems (empty = match). */
export function outcomeProblems(response, expect) {
  const outcome = outcomeOf(response), problems = [];
  if (outcome.ok) return ['expected a refusal, got success'];
  if (expect.statuses && !expect.statuses.includes(outcome.status)) problems.push(`HTTP status ${outcome.status} is not one of ${expect.statuses.join('/')}`);
  if (expect.codes && !expect.codes.includes(outcome.code)) problems.push(`SQLSTATE ${outcome.code} is not one of ${expect.codes.join('/')}`);
  if (expect.message !== undefined && outcome.message !== expect.message) problems.push(`message ${outcome.message} is not ${expect.message}`);
  if (expect.notCode !== undefined && outcome.code === expect.notCode) problems.push(`SQLSTATE is ${expect.notCode}`);
  return problems;
}
/** What a call OBSERVABLY did, as a short label: `okLabel` for a success, the message of a refusal, `TRANSPORT:<code>` for an error without a message. */
export const observedLabel = (response, okLabel) => response.error ? (response.error.message ?? 'TRANSPORT:' + (response.error.code ?? response.status)) : okLabel;
export const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// The success receipt of rpc_submit_response (finding invariant I6): exactly these eleven keys.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export const RECEIPT_KEYS = Object.freeze(['applicationId', 'authoritative', 'contentHash', 'coveredSlots', 'idempotentReplay', 'needRevision', 'pricingMode', 'responseId', 'snapshotSchema', 'status', 'version']);
export function receiptProblems(receipt, {mode, covered, revision = 1, replay = false} = {}) {
  const problems = [];
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) return ['the receipt is not an object'];
  const keys = Object.keys(receipt).sort();
  if (!sameJson(keys, RECEIPT_KEYS)) problems.push(`keys ${JSON.stringify(keys)} are not the eleven documented keys`);
  if (typeof receipt.responseId !== 'string' || !/^[0-9a-f-]{36}$/.test(receipt.responseId)) problems.push('responseId is not a uuid');
  if (receipt.applicationId !== receipt.responseId) problems.push('applicationId is not responseId');
  if (typeof receipt.contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.contentHash)) problems.push('contentHash is not 64 hex');
  if (!['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(receipt.status)) problems.push('status ' + receipt.status);
  if (receipt.pricingMode !== mode) problems.push('pricingMode ' + receipt.pricingMode);
  if (receipt.coveredSlots !== covered) problems.push('coveredSlots ' + receipt.coveredSlots);
  if (!Number.isInteger(receipt.version) || receipt.version < 1) problems.push('version ' + receipt.version);
  if (receipt.needRevision !== revision) problems.push('needRevision ' + receipt.needRevision);
  if (receipt.snapshotSchema !== 'APPLICATION_V1_SELF_DECLARED') problems.push('snapshotSchema ' + receipt.snapshotSchema);
  if (receipt.authoritative !== true) problems.push('authoritative ' + receipt.authoritative);
  if (receipt.idempotentReplay !== replay) problems.push('idempotentReplay ' + receipt.idempotentReplay);
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// The weakening edits (disposable chain only). Each takes pg_get_functiondef text and returns {applied, text | reason}. They exist to PROVE the proof is not vacuous:
// the same predicate that holds on the real chain must stop holding when the rule is weakened, and hold again after the exact restore.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
const PRICE_CALL = /perform\s+private\.assert_application_price_v5\s*\([^)]*\)\s*;/g;
const TAG = '$function$';
/** Replaces the single `perform private.assert_application_price_v5(...)` statement of a caller with a no-op statement. Refuses unless it matches exactly once. */
export function stripPriceCall(definition) {
  const count = [...String(definition).matchAll(PRICE_CALL)].length;
  if (count !== 1) return {applied: false, reason: 'PRICE_CALL_ANCHOR_COUNT_' + count};
  return {applied: true, text: String(definition).replace(PRICE_CALL, 'null;')};
}
function withBody(definition, body) {
  const text = String(definition), open = text.indexOf(TAG), close = text.lastIndexOf(TAG);
  if (open < 0 || close <= open) return {applied: false, reason: 'DOLLAR_QUOTE_NOT_FOUND'};
  return {applied: true, text: text.slice(0, open + TAG.length) + body + text.slice(close)};
}
/** The helper that judges nothing (every price passes). */
export const neutralizeHelper = definition => withBody(definition, '\nbegin\n  return;\nend;\n');
/** A helper that raises a refusal NOBODY lists (22023 PKG049_UNLISTED_PROBE): the coupling to need_candidate_states_v5 (finding R3). */
export const unlistedMessageHelper = definition => withBody(definition, "\nbegin\n  raise exception using errcode='22023', message='PKG049_UNLISTED_PROBE';\nend;\n");
export const asStatement = definition => String(definition).replace(/\s+$/, '') + ';';

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// The weakening PLAN (phase P8). Five predicates, one per door; six probes. A probe is DETECTED only when every primary predicate is observed to give exactly the outcome the
// weakened rule would give (ACCEPTED, AGREEMENT_CREATED, SELECTABLE, corroborated by the database where there is a row to read), and, for a single-door probe, every other door still holds.
// A probe whose anchor edit does not apply is an ASSERTION FAILURE (PROBE_NOT_APPLICABLE), never a silent skip.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export const PREDICATES = Object.freeze(['submit', 'keep', 'select', 'candidates', 'page']);
export const WEAKENED_OUTCOME = Object.freeze({submit: 'ACCEPTED', keep: 'ACCEPTED', select: 'AGREEMENT_CREATED', candidates: 'SELECTABLE', page: 'SELECTABLE'});
export const PROBE_PLAN = Object.freeze([
  Object.freeze({id: 'helper_is_a_no_op', pin: 'helper', edit: 'neutralizeHelper', primary: Object.freeze([...PREDICATES]), othersMustHold: false}),
  Object.freeze({id: 'submit_stops_calling_the_helper', pin: 'submit', edit: 'stripPriceCall', primary: Object.freeze(['submit']), othersMustHold: true}),
  Object.freeze({id: 'stale_resolver_stops_calling_the_helper', pin: 'stale_resolver', edit: 'stripPriceCall', primary: Object.freeze(['keep']), othersMustHold: true}),
  Object.freeze({id: 'select_stops_calling_the_helper', pin: 'select', edit: 'stripPriceCall', primary: Object.freeze(['select']), othersMustHold: true}),
  Object.freeze({id: 'candidate_reader_stops_calling_the_helper', pin: 'ncs_1', edit: 'stripPriceCall', primary: Object.freeze(['candidates']), othersMustHold: true}),
  Object.freeze({id: 'page_reader_stops_calling_the_helper', pin: 'ncs_2', edit: 'stripPriceCall', primary: Object.freeze(['page']), othersMustHold: true}),
]);
/** Problems of a plan: unique ids, known pins and predicates, a known edit, and a dedicated single-door probe for every predicate. Empty = sound. */
export function probePlanProblems(plan = PROBE_PLAN, predicates = PREDICATES) {
  const problems = [], ids = new Set();
  for (const probe of plan) {
    if (ids.has(probe.id)) problems.push('duplicate probe id ' + probe.id);
    ids.add(probe.id);
    if (!PINS.some(pin => pin.id === probe.pin)) problems.push(probe.id + ': unknown pin ' + probe.pin);
    if (!['neutralizeHelper', 'stripPriceCall'].includes(probe.edit)) problems.push(probe.id + ': unknown edit ' + probe.edit);
    for (const name of probe.primary) if (!predicates.includes(name)) problems.push(probe.id + ': unknown predicate ' + name);
  }
  for (const name of predicates) if (!plan.some(probe => probe.othersMustHold && probe.primary.length === 1 && probe.primary[0] === name)) problems.push('no dedicated single-door probe for ' + name);
  return problems;
}
/**
 * Whether a probe was DETECTED. `weakened` maps a predicate name to {holds, observed, corroborated}. Every primary predicate must have stopped holding, its observed outcome must EQUAL
 * the outcome the weakened rule gives, and the database must corroborate it (`corroborated !== false`). For a single-door probe every other predicate must still hold.
 */
export function evaluateProbe({weakened, primary, requireOthersHold, expected = WEAKENED_OUTCOME}) {
  const problems = [];
  for (const name of primary) {
    const got = weakened[name];
    if (!got) { problems.push(name + ': NOT_EVALUATED'); continue; }
    if (got.holds !== false) problems.push(name + ': the predicate still holds under the weakening');
    if (got.observed !== expected[name]) problems.push(name + ': observed ' + JSON.stringify(got.observed) + ' but the weakened rule gives ' + expected[name]);
    if (got.corroborated === false) problems.push(name + ': the database state does not corroborate ' + expected[name]);
  }
  if (requireOthersHold) for (const [name, got] of Object.entries(weakened)) if (!primary.includes(name) && got.holds !== true) problems.push(name + ': a door that was not weakened stopped holding (' + JSON.stringify(got.observed) + ')');
  return {detected: problems.length === 0, problems};
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// The real client modules the proof loads under ts_loader (the unit test loads exactly these and requires the workflow path filter to cover every file they pull in), and the
// LITERAL Serbian sentences the owner's copy gives to the five price refusals: an independent copy, never read from the module under test. The unit test ties each sentence to the
// source line that holds it, so a copy change is a deliberate edit of this table.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export const CLIENT_MODULES = Object.freeze(['data/applicationSelectionClientService', 'data/needDetailPresentation', 'data/applicationClientService', 'data/legacyRpcFailure', 'data/candidateClientService',
  'data/agreementClientService', 'data/needClientService', 'data/ru4Production']);
export const SERBIAN_COPY = Object.freeze({
  /** src/data/applicationSelectionClientService.ts, applicationSelectionErrors: the new-offer and selection paths. */
  application: Object.freeze({
    INVALID_PRICE: 'Unesi ceo pozitivan iznos u RSD.',
    FIXED_PRICE_NOT_READY: 'Cena Zadatka trenutno nije spremna. Ponovo otvori Zadatak.',
    FIXED_PRICE_MISMATCH: 'Cena prijave mora da prati cenu i obračun iz zadatka. Izmeni prijavu prema aktuelnim uslovima.',
    TOTAL_PRICE_REQUIRES_ALL_SLOTS: 'Cena ovog Zadatka važi za ceo posao, pa prijava mora da pokrije sva mesta.',
    UNKNOWN_PRICE_BASIS: 'Način obračuna cene na ovom Zadatku nije podržan u ovoj verziji aplikacije.',
  }),
  /** src/data/legacyRpcFailure.ts, COPY: the reconfirmation path (ru4Production.resolveChangedApplication). */
  legacy: Object.freeze({
    INVALID_PRICE: 'Proveri unetu cenu.',
    FIXED_PRICE_NOT_READY: 'Cena zadatka trenutno nije spremna. Ponovo otvori zadatak.',
    FIXED_PRICE_MISMATCH: 'Cena prijave mora da prati cenu i obračun iz zadatka. Izmeni prijavu prema aktuelnim uslovima.',
    TOTAL_PRICE_REQUIRES_ALL_SLOTS: 'Cena važi za ceo zadatak, pa prijava mora da pokrije sva mesta.',
    UNKNOWN_PRICE_BASIS: 'Način obračuna cene nije podržan u ovoj verziji aplikacije.',
  }),
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// The markdown report. The label comes first (a verdict without it would read as a verdict about DEV); a failed run still renders what it has.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
const cellText = value => String(value ?? '').replaceAll('|', '/');
export function renderReportMarkdown(report) {
  const lines = [`# ${report.package}`, '', `**Label: ${report.label}**`, '', `Source ${report.sourceSha}. Disposable chain only: no DEV, no provider, no device. Nothing here is evidence about DEV unless the label says CHAIN == DEV. Result: **${report.result}**.`, ''];
  lines.push(`Stages: EX-04D candidate: ${report.stages?.ex04dCandidate ?? 'not reached'}. B24 conversion of the two price-chain functions (in-proof): ${report.stages?.b24PriceChain ?? 'not reached'}.`, '');
  if (report.pinGate) lines.push(renderPinGateMarkdown(report.pinGate, report.pinEvaluation ?? null));
  if (report.chainFidelity) {
    const fidelity = report.chainFidelity, part1 = fidelity.b24Part1 ?? {};
    lines.push('## Chain fidelity', '', fidelity.note, '',
      `B24 Part 1 on the pristine chain: absent targets ${(part1.absentOnChain ?? []).join(', ') || 'none'}; site-count drift ${JSON.stringify(part1.siteCountDrift ?? [])}; not unique ${(part1.notUnique ?? []).join(', ') || 'none'}; already PT409 ${(part1.alreadyPt409 ?? []).join(', ') || 'none'}; would apply here: ${part1.wouldApplyHere} (relaxed mode does not relax existence or the quoted-site count).`,
      '', 'The chain does NOT carry: ' + (fidelity.chainLacks ?? []).join('; ') + '.', '',
      `Certificate: chain ${fidelity.certificate?.chainDigestPrefix}, DEV ${fidelity.certificate?.devDigestPrefix}; ${fidelity.certificate?.note ?? ''}`, `PostgREST header: ${JSON.stringify(report.postgrestHeader ?? null)}.`, '');
  }
  if (report.matrix?.length) {
    const totals = report.matrixTotals;
    lines.push('## Matrix (modified client, real PostgREST, real JWTs)', '', totals
      ? `${totals.refusalsAsserted} refusals asserted with exact message, SQLSTATE, HTTP 400 and nothing written; ${totals.acceptedVerbatim} amounts stored verbatim with a content hash that binds them (${totals.canonRows} CANON rows, ${totals.pinnedRows} rows PINNED_TO_TODAY under an open owner decision: characterised, not judged).`
      : 'Partial run.', '', '| case | sent | outcome | message | status |', '| --- | --- | --- | --- | --- |',
      ...report.matrix.map(item => `| ${item.shape} ${item.mode}${item.basis ? '/' + item.basis : ''} A=${item.taskPrice ?? '-'} | ${item.sent} (${cellText(item.kind)}) | ${item.outcome} | ${item.message ?? ''} | ${item.status ?? ''} |`), '');
  }
  if (report.d3) {
    lines.push('## Agreement change (OPEN OWNER DECISION D3: characterised, not judged)', '', report.d3.pinnedToToday, '', '| task basis | task price | covered | v1 | accepted by consent | final readback | status |', '| --- | --- | --- | --- | --- | --- | --- |',
      ...report.d3.rows.map(item => `| ${item.basis ?? 'null'} | ${item.taskPrice} | ${item.covered} | ${item.agreementV1Price} | ${item.accepted.map(entry => entry.amount).join(', ')} | ${item.workspaceTermsPrice ?? ''} | ${item.status ?? ''} |`), '',
      `The accept call: ${report.d3.acceptCallArguments}.`, report.d3.offerCardDivergence ? `Offer card (my applications) versus Dogovor after an accepted amendment: ${JSON.stringify(report.d3.offerCardDivergence)}.` : '', '');
  }
  if (report.weakening) {
    lines.push('## Weakening probes (non-vacuity)', '', 'A probe is DETECTED only when each primary door is OBSERVED to give the outcome the weakened rule gives (not merely "the predicate failed"), and, for a single-door probe, every other door still holds.', '',
      '| weakening | detected | expected outcome | observed (weakened) | restored: all doors hold |', '| --- | --- | --- | --- | --- |',
      ...report.weakening.probes.map(item => `| ${item.id} | ${item.detected} | ${cellText((item.primary ?? []).map(name => name + ':' + (item.expected?.[name] ?? '')).join(', ') || item.coupling || '')} | ${cellText(item.weakened ? Object.entries(item.weakened).map(([name, result]) => name + '=' + result.observed).join(', ') : (item.raisedBy ? JSON.stringify(item.raisedBy) : ''))} | ${item.restoredAllHold ?? ''} |`), '');
  }
  lines.push('## Checks', '', ...(report.checks ?? []).map(item => `- PASS ${item.name}`), '');
  if (report.notVerified?.length) lines.push('## Not verified', '', ...report.notVerified.map(item => `- ${item}`), '');
  if (report.failure) lines.push('## Failure', '', '```', report.failure, '```', '');
  return lines.join('\n');
}
