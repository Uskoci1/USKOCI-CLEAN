// Unit tests of the pure LIB side of the B09 / PKG-049 characterization proof: the reference model, the case generator and its labels, the outcome helpers, the success-receipt check, the
// weakening edits and plan (non-vacuity), the literal Serbian copy and the markdown report. No database, no network: `node --test supabase/proofs/pkg049/*.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as pins from './pkg049_pins.mjs';
import * as lib from './pkg049_lib.mjs';

const read = relative => readFileSync(fileURLToPath(new URL('../../' + relative, import.meta.url)), 'utf8');   // relative to supabase/
const between = (text, startMarker, tag) => {
  const start = text.indexOf(startMarker); assert.ok(start >= 0, 'MARKER ' + startMarker);
  const open = text.indexOf(tag, start) + tag.length, close = text.indexOf(tag, open); assert.ok(open > tag.length && close > open, 'TAG ' + tag);
  return text.slice(open, close);
};
const pkg033a = read('candidates/pkg033a_application_admission_parity.sql');
const helperBody = between(pkg033a, 'create function private.assert_application_price_v5', '$function$');
const ncs1Body = between(read('candidates/pkg035a_selectable_application_counts.sql'), 'create function private.need_candidate_states_v5', '$function$');
const ncs2Body = between(read('candidates/ex04d_candidates_page.sql'), 'states_body constant text :=', '$states_body$');
const my = (price, basis, slots) => ({mode: 'MY_PRICE', price, basis, slots});

test('the reference model reproduces the literal cases of the finding and of the owner decisions', () => {
  const offers = {mode: 'OFFERS', price: null, basis: null, slots: 3};
  const golden = [
    [my(3000, 'PER_PERSON', 6), 1, 3000, 'OK'], [my(3000, 'PER_PERSON', 6), 2, 6000, 'OK'], [my(3000, 'PER_PERSON', 6), 6, 18000, 'OK'],
    [my(3000, 'PER_PERSON', 6), 2, 3000, 'FIXED_PRICE_MISMATCH'], [my(3000, 'PER_PERSON', 6), 6, 3000, 'FIXED_PRICE_MISMATCH'], [my(3000, 'PER_PERSON', 6), 2, 6001, 'FIXED_PRICE_MISMATCH'],
    [my(9000, 'TOTAL', 3), 3, 9000, 'OK'], [my(9000, 'TOTAL', 3), 3, 3000, 'FIXED_PRICE_MISMATCH'], [my(9000, 'TOTAL', 3), 1, 9000, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS'],
    [my(9000, 'TOTAL', 3), 2, 6000, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS'], [my(9000, 'TOTAL', 3), 3, 9001, 'FIXED_PRICE_MISMATCH'],
    [my(3000, null, 3), 1, 3000, 'OK'], [my(3000, null, 3), 2, 3000, 'OK'], [my(3000, null, 3), 2, 6000, 'FIXED_PRICE_MISMATCH'], [my(3000, null, 1), 1, 3001, 'FIXED_PRICE_MISMATCH'],
    [my(null, null, 1), 1, 3000, 'FIXED_PRICE_NOT_READY'], [my(null, null, 1), 1, 0, 'INVALID_PRICE'], [my(3000, null, 1), 1, 0, 'INVALID_PRICE'], [my(3000, null, 1), 1, -5, 'INVALID_PRICE'], [my(3000, null, 1), 1, null, 'INVALID_PRICE'],
    [offers, 1, 1, 'OK'], [offers, 3, lib.INT4_MAX, 'OK'], [offers, 1, 0, 'INVALID_PRICE'], [offers, 1, -1, 'INVALID_PRICE'], [offers, 1, null, 'INVALID_PRICE'],
    [my(100000000, 'PER_PERSON', 50), 21, 2100000000, 'OK'], [my(100000000, 'PER_PERSON', 50), 22, lib.INT4_MAX, 'FIXED_PRICE_MISMATCH'],
    [{mode: 'MY_PRICE', price: 3000, basis: 'WEEKLY', slots: 1}, 1, 3000, 'UNKNOWN_PRICE_BASIS'],
  ];
  for (const [task, covered, sent, expected] of golden) {
    const outcome = lib.priceOutcome(task, covered, sent);
    assert.equal(outcome.ok ? 'OK' : outcome.message, expected, JSON.stringify({task, covered, sent}));
    if (!outcome.ok) assert.ok(pins.sqlstateOf(outcome.message), 'every refusal has a pinned SQLSTATE');
  }
  assert.equal(lib.canonicalPrice(my(3000, 'PER_PERSON', 6), 6), 18000); assert.equal(lib.canonicalPrice(my(100000000, 'PER_PERSON', 50), 22), null);
  assert.equal(lib.canonicalPrice(my(9000, 'TOTAL', 3), 2), null); assert.equal(lib.canonicalPrice(offers, 1), null); assert.equal(lib.canonicalPrice(my(null, null, 1), 1), null);
});
test('the DETAIL formats the model expects are the format strings the helper source contains', () => {
  assert.ok(pkg033a.includes("format('basis=PER_PERSON,perPerson=%s,covered=%s,expected=%s,sent=%s'"));
  assert.ok(pkg033a.includes("format('required=%s,covered=%s'")); assert.ok(pkg033a.includes("format('basis=TOTAL,total=%s,sent=%s'"));
  assert.equal(lib.expectedDetail(my(3000, 'PER_PERSON', 6), 2, 3000, 'FIXED_PRICE_MISMATCH'), 'basis=PER_PERSON,perPerson=3000,covered=2,expected=6000,sent=3000');
  assert.equal(lib.expectedDetail(my(9000, 'TOTAL', 3), 1, 9000, 'TOTAL_PRICE_REQUIRES_ALL_SLOTS'), 'required=3,covered=1');
  assert.equal(lib.expectedDetail(my(9000, 'TOTAL', 3), 3, 3000, 'FIXED_PRICE_MISMATCH'), 'basis=TOTAL,total=9000,sent=3000');
  assert.equal(lib.expectedDetail(my(3000, null, 1), 1, 3001, 'FIXED_PRICE_MISMATCH'), null);
});
test('the case generator produces refusals and at most the oks the model allows, with the cases the brief names', () => {
  for (const shape of lib.TASK_SHAPES) for (const covered of shape.covered) {
    const {refusals, oks} = lib.candidateSents(shape.task, covered);
    assert.ok(refusals.length >= 3, shape.id); assert.ok(refusals.every(item => !item.expect.ok) && oks.every(item => item.expect.ok));
    assert.ok(refusals.some(item => item.label.includes('zero')) && refusals.some(item => item.label.includes('negative')) && refusals.some(item => item.label.includes('null')));
    assert.ok([...refusals, ...oks].every(item => item.sent === null || (Number.isInteger(item.sent) && item.sent <= lib.INT4_MAX)), 'only sendable int4 values: ' + shape.id);
    const canon = lib.canonicalPrice(shape.task, covered);
    if (shape.task.mode === 'MY_PRICE' && canon !== null) { assert.equal(oks.length, 1, shape.id); assert.equal(oks[0].sent, canon); assert.ok(refusals.some(item => item.label.includes('canonicalPlusOne')) || canon + 1 > lib.INT4_MAX); }
  }
  const total = lib.candidateSents(my(9000, 'TOTAL', 3), 3);
  assert.ok(total.refusals.some(item => item.sent === 3000 && item.label.includes('barePerPersonShare')), 'the bare per-person amount where the basis is TOTAL');
  const per = lib.candidateSents(my(3000, 'PER_PERSON', 6), 2);
  assert.ok(per.refusals.some(item => item.sent === 3000 && item.label.includes('taskAmount')), 'the bare per-person amount for two people'); assert.deepEqual(per.oks.map(item => item.sent), [6000]);
  const offers = lib.candidateSents({mode: 'OFFERS', price: null, basis: null, slots: 1}, 1);
  assert.deepEqual(offers.oks.map(item => item.sent).sort((a, b) => a - b), [1, 7777, lib.INT4_MAX]); assert.deepEqual(offers.refusals.map(item => item.expect.message), ['INVALID_PRICE', 'INVALID_PRICE', 'INVALID_PRICE']);
  const none = lib.candidateSents(my(null, null, 1), 1);
  assert.deepEqual(none.oks, []); assert.ok(none.refusals.some(item => item.expect.message === 'FIXED_PRICE_NOT_READY'));
  const overflow = lib.candidateSents(my(100000000, 'PER_PERSON', 50), 22);
  assert.deepEqual(overflow.oks, [], 'a per-person product above int4 can never be sent');
});
test('the matrix size the proof asserts is written down separately from the generator and equals what the generator produces (11 shapes, 21 covered cases, 142 refusals, 23 accepted)', () => {
  let refusals = 0, accepted = 0, cases = 0;
  for (const shape of lib.TASK_SHAPES) for (const covered of shape.covered) { const {refusals: refused, oks} = lib.candidateSents(shape.task, covered); refusals += refused.length; accepted += oks.length; cases += 1; }
  assert.deepEqual(lib.MATRIX_EXPECTED, {shapes: 11, cases: 21, refusals: 142, accepted: 23});
  assert.deepEqual({shapes: lib.TASK_SHAPES.length, cases, refusals, accepted}, lib.MATRIX_EXPECTED); assert.equal(lib.TASK_SHAPES.flatMap(shape => shape.covered).length, 21);
});
test('the cells the finding marks defined:NO carry {defined, decision} labels (D1, D6, D4) and nothing else does', () => {
  const byId = Object.fromEntries(lib.TASK_SHAPES.map(shape => [shape.id, shape]));
  assert.deepEqual({defined: byId.my_null_n3.defined, decision: byId.my_null_n3.decision}, {defined: false, decision: 'D1'}, 'NULL basis with more than one person');
  assert.deepEqual({defined: byId.per_person_n1.defined, decision: byId.per_person_n1.decision}, {defined: false, decision: 'D6'}, 'one-person PER_PERSON');
  assert.deepEqual({defined: byId.total_n1.defined, decision: byId.total_n1.decision}, {defined: false, decision: 'D6'}, 'one-person TOTAL');
  assert.deepEqual(lib.TASK_SHAPES.filter(shape => !shape.defined).map(shape => shape.id), ['my_null_n3', 'per_person_n1', 'total_n1']);
  for (const shape of lib.TASK_SHAPES) assert.equal(shape.defined, shape.decision === null, shape.id + ': a shape is defined exactly when it has no open decision');
  const offers = lib.candidateSents(byId.offers_n3.task, 3);
  for (const item of offers.oks) assert.deepEqual(lib.cellLabel(byId.offers_n3, item), {defined: false, decision: 'D4'}, 'an accepted OFFERS amount is the open bound D4');
  for (const item of offers.refusals) assert.deepEqual(lib.cellLabel(byId.offers_n3, item), {defined: true, decision: null}, 'a refused OFFERS amount (zero, negative, null) is canon');
  assert.equal(lib.statusOf({defined: true, decision: null}), 'CANON'); assert.equal(lib.statusOf({defined: false, decision: 'D1'}), 'PINNED_TO_TODAY (open D1)');
});
test('outcome helpers read the PostgREST response shape and match EXACT outcomes', () => {
  const refused = {status: 400, data: null, error: {code: '22023', message: 'FIXED_PRICE_MISMATCH', details: null, hint: null}};
  assert.equal(lib.isRefusal(refused, 'FIXED_PRICE_MISMATCH', '22023'), true); assert.equal(lib.isRefusal(refused, 'FIXED_PRICE_MISMATCH', 'P0001'), false);
  assert.equal(lib.isRefusal({...refused, status: 409}, 'FIXED_PRICE_MISMATCH', '22023'), false); assert.equal(lib.isRefusal({status: 200, data: {}, error: null}, 'X', '22023'), false);
  assert.deepEqual(lib.outcomeOf({status: 200, data: {a: 1}, error: null}), {ok: true, status: 200, data: {a: 1}});
  assert.equal(lib.sameJson({a: 1, b: [1]}, {a: 1, b: [1]}), true); assert.equal(lib.sameJson({a: 1}, {a: 2}), false);
  const anonymous = {status: 401, data: null, error: {code: '42501', message: 'permission denied for function rpc_submit_response', details: null, hint: null}};
  assert.deepEqual(lib.outcomeProblems(anonymous, {statuses: [401, 403], codes: ['42501']}), []);
  assert.deepEqual(lib.outcomeProblems({...anonymous, status: 500}, {statuses: [401, 403], codes: ['42501']}), ['HTTP status 500 is not one of 401/403'], 'a 5xx is not an authority refusal');
  assert.equal(lib.outcomeProblems({status: 404, data: null, error: {code: 'PGRST202', message: 'x'}}, {statuses: [400], codes: ['22003', '22P02'], notCode: 'PGRST202'}).length, 3, 'a missing function is not a data exception');
  assert.deepEqual(lib.outcomeProblems({status: 200, data: {}, error: null}, {statuses: [400]}), ['expected a refusal, got success']);
  assert.deepEqual(lib.outcomeProblems(refused, {message: 'FIXED_PRICE_MISMATCH', codes: ['22023'], statuses: [400]}), []);
  assert.equal(lib.observedLabel(refused, 'ACCEPTED'), 'FIXED_PRICE_MISMATCH'); assert.equal(lib.observedLabel({status: 200, data: {}, error: null}, 'ACCEPTED'), 'ACCEPTED');
  assert.equal(lib.observedLabel({status: 503, data: null, error: {code: 'PGRST002', message: null}}, 'ACCEPTED'), 'TRANSPORT:PGRST002', 'a transport error is never read as an outcome of the rule');
});
test('the success receipt keeps exactly its eleven keys and values (invariant I6)', () => {
  const receipt = {responseId: '11111111-1111-4111-8111-111111111111', applicationId: '11111111-1111-4111-8111-111111111111', version: 1, needRevision: 1, contentHash: 'a'.repeat(64), status: 'SUBMITTED', pricingMode: 'MY_PRICE',
    coveredSlots: 2, snapshotSchema: 'APPLICATION_V1_SELF_DECLARED', authoritative: true, idempotentReplay: false};
  assert.equal(lib.RECEIPT_KEYS.length, 11); assert.deepEqual([...lib.RECEIPT_KEYS], [...lib.RECEIPT_KEYS].sort());
  assert.deepEqual(lib.receiptProblems(receipt, {mode: 'MY_PRICE', covered: 2}), []);
  assert.deepEqual(lib.receiptProblems({...receipt, idempotentReplay: true}, {mode: 'MY_PRICE', covered: 2, replay: true}), []);
  assert.equal(lib.receiptProblems({...receipt, extra: 1}, {mode: 'MY_PRICE', covered: 2}).length, 1, 'an additive key is a change of the contract');
  const {authoritative, ...missing} = receipt; assert.ok(lib.receiptProblems(missing, {mode: 'MY_PRICE', covered: 2}).length >= 1);
  assert.ok(lib.receiptProblems({...receipt, applicationId: '22222222-2222-4222-8222-222222222222'}, {mode: 'MY_PRICE', covered: 2}).some(problem => problem.startsWith('applicationId')));
  for (const [patch, name] of [[{contentHash: 'xyz'}, 'contentHash'], [{status: 'STALE_REVIEW_REQUIRED'}, 'status'], [{pricingMode: 'OFFERS'}, 'pricingMode'], [{coveredSlots: 3}, 'coveredSlots'], [{version: 0}, 'version'],
    [{needRevision: 2}, 'needRevision'], [{snapshotSchema: 'LEGACY_UNPROVEN'}, 'snapshotSchema'], [{authoritative: false}, 'authoritative'], [{idempotentReplay: true}, 'idempotentReplay']]) {
    assert.ok(lib.receiptProblems({...receipt, ...patch}, {mode: 'MY_PRICE', covered: 2}).some(problem => problem.startsWith(name)), name);
  }
  assert.deepEqual(lib.receiptProblems(null), ['the receipt is not an object']);
});
test('the weakening edits change exactly what they claim on the real texts and refuse anything else', () => {
  // the real helper text, wrapped the way pg_get_functiondef prints it
  const definition = 'CREATE OR REPLACE FUNCTION private.assert_application_price_v5(n needs, p_covered_slots integer, p_price_rsd integer)\n RETURNS void\n LANGUAGE plpgsql\n IMMUTABLE\n SET search_path TO \'pg_catalog\'\nAS $function$' + helperBody + '$function$\n';
  const noop = lib.neutralizeHelper(definition);
  assert.equal(noop.applied, true); assert.ok(noop.text.startsWith(definition.slice(0, definition.indexOf('$function$') + 10))); assert.ok(noop.text.endsWith('$function$\n'));
  assert.equal(noop.text.includes('FIXED_PRICE_MISMATCH'), false); assert.ok(noop.text.includes('return;'));
  assert.deepEqual(pins.extractVocabulary(lib.unlistedMessageHelper(definition).text), [{message: 'PKG049_UNLISTED_PROBE', sqlstate: '22023'}]);
  assert.equal(lib.neutralizeHelper('no dollar quotes here').applied, false);
  // a caller: the single price statement becomes a no-op, every other byte is kept
  for (const body of [ncs1Body, ncs2Body, '  perform private.assert_application_price_v5(n, p_covered_slots, p_price_rsd);\n', '  perform private.assert_application_price_v5(v_need, v_ver.covered_slots, v_ver.price_rsd);\n', '    perform private.assert_application_price_v5(v_need, v_covered, v_price);\n']) {
    const caller = 'CREATE OR REPLACE FUNCTION public.x()\n RETURNS void\nAS $function$' + body + '$function$\n';
    const edited = lib.stripPriceCall(caller);
    assert.equal(edited.applied, true); assert.equal(edited.text.includes('assert_application_price_v5'), false); assert.equal(edited.text.length < caller.length, true);
    assert.equal(edited.text.replace('null;', ''), caller.replace(/perform\s+private\.assert_application_price_v5\s*\([^)]*\)\s*;/, ''));
  }
  assert.deepEqual(lib.stripPriceCall('nothing to strip'), {applied: false, reason: 'PRICE_CALL_ANCHOR_COUNT_0'});
  assert.deepEqual(lib.stripPriceCall('perform private.assert_application_price_v5(a,b,c); perform private.assert_application_price_v5(a,b,c);'), {applied: false, reason: 'PRICE_CALL_ANCHOR_COUNT_2'}, 'two statements is not the anchor');
  assert.equal(lib.asStatement('x\n\n'), 'x;');
});
test('the weakening PLAN is sound: six probes, five predicates, a dedicated single-door probe for each door, only known pins and edits', () => {
  assert.deepEqual(lib.probePlanProblems(), []);
  assert.deepEqual([...lib.PREDICATES], ['submit', 'keep', 'select', 'candidates', 'page']);
  assert.deepEqual(lib.PROBE_PLAN.map(probe => probe.id), ['helper_is_a_no_op', 'submit_stops_calling_the_helper', 'stale_resolver_stops_calling_the_helper', 'select_stops_calling_the_helper', 'candidate_reader_stops_calling_the_helper', 'page_reader_stops_calling_the_helper']);
  assert.deepEqual(lib.PROBE_PLAN.map(probe => probe.pin), ['helper', 'submit', 'stale_resolver', 'select', 'ncs_1', 'ncs_2'], 'the second need_candidate_states_v5 overload has its own probe');
  assert.deepEqual([...lib.PROBE_PLAN[0].primary], [...lib.PREDICATES]); assert.equal(lib.PROBE_PLAN[0].othersMustHold, false);
  assert.ok(lib.PROBE_PLAN.slice(1).every(probe => probe.primary.length === 1 && probe.othersMustHold === true));
  assert.deepEqual(Object.keys(lib.WEAKENED_OUTCOME).sort(), [...lib.PREDICATES].sort());
  assert.deepEqual(lib.probePlanProblems([...lib.PROBE_PLAN, {...lib.PROBE_PLAN[1]}]), ['duplicate probe id submit_stops_calling_the_helper']);
  assert.ok(lib.probePlanProblems(lib.PROBE_PLAN.filter(probe => probe.id !== 'page_reader_stops_calling_the_helper')).includes('no dedicated single-door probe for page'));
  assert.ok(lib.probePlanProblems([{id: 'x', pin: 'nope', edit: 'delete', primary: ['submit'], othersMustHold: true}]).length >= 3);
});
test('a probe is DETECTED only when the observed outcome equals the weakened outcome, the database corroborates it, and (single door) the other doors still hold', () => {
  const holds = observed => ({holds: true, observed, corroborated: true});
  const control = {submit: holds('FIXED_PRICE_MISMATCH'), keep: holds('FIXED_PRICE_MISMATCH'), select: holds('TOTAL_PRICE_REQUIRES_ALL_SLOTS'), candidates: holds('STALE'), page: holds('STALE')};
  const weakenedSubmit = {...control, submit: {holds: false, observed: 'ACCEPTED', corroborated: true}};
  assert.deepEqual(lib.evaluateProbe({weakened: weakenedSubmit, primary: ['submit'], requireOthersHold: true}), {detected: true, problems: []});
  // the predicate failed for ANOTHER reason (a transport error, a wrong refusal): not a detection
  for (const observed of ['TRANSPORT:PGRST002', 'WORKER_NOT_ELIGIBLE', 'LIST_RAISED x', 'IDEMPOTENCY_KEY_REUSED']) {
    const verdict = lib.evaluateProbe({weakened: {...control, submit: {holds: false, observed, corroborated: true}}, primary: ['submit'], requireOthersHold: true});
    assert.equal(verdict.detected, false, observed); assert.match(verdict.problems[0], /^submit: observed .* but the weakened rule gives ACCEPTED/);
  }
  assert.equal(lib.evaluateProbe({weakened: weakenedSubmit, primary: ['keep'], requireOthersHold: true}).detected, false, 'the primary door still holds');
  assert.equal(lib.evaluateProbe({weakened: {...control, submit: {holds: false, observed: 'ACCEPTED', corroborated: false}}, primary: ['submit'], requireOthersHold: true}).problems.length, 1, 'the database must corroborate an accepted submit');
  assert.equal(lib.evaluateProbe({weakened: {...weakenedSubmit, select: {holds: false, observed: 'AGREEMENT_CREATED', corroborated: true}}, primary: ['submit'], requireOthersHold: true}).detected, false, 'a probe that breaks another door too is not a single-door weakening');
  assert.equal(lib.evaluateProbe({weakened: {...weakenedSubmit, select: {holds: false, observed: 'AGREEMENT_CREATED', corroborated: true}}, primary: ['submit'], requireOthersHold: false}).detected, true);
  const everything = {submit: {holds: false, observed: 'ACCEPTED', corroborated: true}, keep: {holds: false, observed: 'ACCEPTED', corroborated: true}, select: {holds: false, observed: 'AGREEMENT_CREATED', corroborated: true},
    candidates: {holds: false, observed: 'SELECTABLE', corroborated: true}, page: {holds: false, observed: 'SELECTABLE', corroborated: true}};
  assert.equal(lib.evaluateProbe({weakened: everything, primary: [...lib.PREDICATES], requireOthersHold: false}).detected, true);
  assert.equal(lib.evaluateProbe({weakened: {...everything, page: {holds: false, observed: 'STALE', corroborated: true}}, primary: [...lib.PREDICATES], requireOthersHold: false}).detected, false, 'the page reader still says STALE');
  assert.deepEqual(lib.evaluateProbe({weakened: {}, primary: ['submit'], requireOthersHold: false}), {detected: false, problems: ['submit: NOT_EVALUATED']});
});
test('the literal Serbian copy of the five price refusals is the copy the client sources hold, line for line', () => {
  const application = read('../src/data/applicationSelectionClientService.ts'), legacy = read('../src/data/legacyRpcFailure.ts');
  assert.deepEqual(Object.keys(lib.SERBIAN_COPY.application), pins.HELPER_VOCABULARY.map(item => item.message)); assert.deepEqual(Object.keys(lib.SERBIAN_COPY.legacy), pins.HELPER_VOCABULARY.map(item => item.message));
  for (const [code, sentence] of Object.entries(lib.SERBIAN_COPY.application)) assert.ok(application.includes(`  ${code}: '${sentence}',`), 'applicationSelectionErrors ' + code);
  for (const [code, sentence] of Object.entries(lib.SERBIAN_COPY.legacy)) assert.ok(legacy.includes(`  ${code}: '${sentence}',`), 'legacyRpcFailure COPY ' + code);
  assert.notEqual(lib.SERBIAN_COPY.application.INVALID_PRICE, lib.SERBIAN_COPY.legacy.INVALID_PRICE, 'the two maps are two different owner copies: each path is checked against its own sentence');
});
test('the markdown report renders a complete run and a run that failed early, label first, without throwing', () => {
  const dev = Object.fromEntries(pins.PINS.map(item => [item.signature, item.devMd5]));
  const pin = id => pins.PINS.find(item => item.id === id);
  const gate = pins.runPinGate(signature => (signature === pin('stale_resolver').signature ? pin('stale_resolver').knownChainMd5 : dev[signature]));
  const full = {package: 'PKG-049 test', sourceSha: 'abc', result: 'PASS', label: gate.label, stages: {ex04dCandidate: 'APPLIED', b24PriceChain: 'NOT APPLIED (label stays PRE_B24)'}, pinGate: gate, pinEvaluation: pins.evaluatePinGate(gate, {vocabulary: {equal: true}, swallow: {ncs_1: [], ncs_2: []}}),
    chainFidelity: {note: 'n', chainLacks: ['pkg051a', 'Voice B1'], b24Part1: {absentOnChain: ['private.platform_price_add_version'], siteCountDrift: [{fn: 'x', expected: 1, found: 2}], notUnique: [], alreadyPt409: [], wouldApplyHere: false},
      certificate: {chainDigestPrefix: 'aaaaaaaa', devDigestPrefix: '58447d77', note: 'chain-internal only'}}, postgrestHeader: {server: null, via: null},
    matrix: [{shape: 'per_person_n3 c2', mode: 'MY_PRICE', basis: 'PER_PERSON', taskPrice: 3000, sent: 3000, kind: 'taskAmount', outcome: 'REFUSED', message: 'FIXED_PRICE_MISMATCH', status: 'CANON'},
      {shape: 'my_null_n3 c2', mode: 'MY_PRICE', basis: null, taskPrice: 3000, sent: 3000, kind: 'canonical', outcome: 'ACCEPTED_VERBATIM', status: 'PINNED_TO_TODAY (open D1)'}],
    matrixTotals: {refusalsAsserted: 1, acceptedVerbatim: 1, canonRows: 1, pinnedRows: 1},
    d3: {pinnedToToday: 'pinned', rows: [{basis: null, taskPrice: 3000, covered: 1, agreementV1Price: 3000, accepted: [{amount: 1}, {amount: 2147483647}], workspaceTermsPrice: 3000, status: 'PINNED_TO_TODAY (open D3)'}], acceptCallArguments: 'p_proposal_id uuid, p_accept boolean',
      offerCardDivergence: {offerCardPrice: 3000, dogovorPrice: 1, diverges: true}},
    weakening: {probes: [{id: 'helper_is_a_no_op', detected: true, primary: ['submit'], expected: {submit: 'ACCEPTED'}, weakened: {submit: {holds: false, observed: 'ACCEPTED'}}, restoredAllHold: true},
      {id: 'coupling', detected: true, coupling: 'both overloads', raisedBy: {rpc_read_task: 'PKG049_UNLISTED_PROBE'}, restoredAllHold: true}]}, checks: [{name: 'P1'}], notVerified: ['DEV']};
  const text = lib.renderReportMarkdown(full);
  assert.ok(text.indexOf('**Label: CORE price chain 7/8 equal (stale_resolver PRE_B24)') > 0 && text.indexOf('**Label') < text.indexOf('## Pin gate'));
  for (const needle of ['## Matrix', 'FIXED_PRICE_MISMATCH', 'OPEN OWNER DECISION D3', 'helper_is_a_no_op', '- PASS P1', '## Not verified', 'platform_price_add_version', 'PRE_B24', 'PINNED_TO_TODAY (open D1)', '| status |', 'The chain does NOT carry: pkg051a; Voice B1',
    'site-count drift [{"fn":"x","expected":1,"found":2}]', 'Offer card (my applications) versus Dogovor', 'submit:ACCEPTED', 'Gate verdict: PASS', 'relaxed mode does not relax existence']) assert.ok(text.includes(needle), needle);
  const early = lib.renderReportMarkdown({package: 'PKG-049 test', sourceSha: 'abc', result: 'FAIL', label: null, stages: {}, checks: [], failure: 'AssertionError: boom'});
  assert.ok(early.includes('Result: **FAIL**') && early.includes('AssertionError: boom') && early.includes('not reached'));
});
