// Unit tests of the pure LIB side of the B09 / PKG-049 characterization proof: the reference model, the case generator and its labels, the outcome helpers, the success-receipt check, the
// weakening edits and plan (non-vacuity), the literal Serbian copy and the markdown report. No database, no network: `node --test supabase/proofs/pkg049/*.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as pins from './pkg049_pins.mjs';
import * as lib from './pkg049_lib.mjs';

/** Relative to supabase/. Line endings are NORMALISED to LF: a checkout with core.autocrlf (Windows) must not break an anchor that spans a line break (round 3, review R2). */
const read = relative => readFileSync(fileURLToPath(new URL('../../' + relative, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
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
  // round 3: "a whole positive price" (INVALID_PRICE) is canon on EVERY shape, so the refusals of zero, a negative amount and null keep the NEUTRAL label in the D1 and D6 shapes too: a D1 or D6 decision cannot turn them red
  for (const id of ['my_null_n3', 'per_person_n1', 'total_n1']) {
    const shape = byId[id], covered = shape.covered[0], {refusals, oks} = lib.candidateSents(shape.task, covered);
    const invalid = refusals.filter(item => item.expect.message === 'INVALID_PRICE'); assert.ok(invalid.length >= 3, id);
    for (const item of invalid) assert.deepEqual(lib.cellLabel(shape, item), {defined: true, decision: null}, id + ' INVALID_PRICE sent ' + item.sent + ' is canon');
    for (const item of [...refusals.filter(entry => entry.expect.message !== 'INVALID_PRICE'), ...oks]) assert.deepEqual(lib.cellLabel(shape, item), {defined: false, decision: shape.decision}, id + ' sent ' + item.sent + ' carries the open decision');
  }
  // the totals the proof reports follow from the labels
  const totals = {canon: 0, pinned: 0};
  for (const shape of lib.TASK_SHAPES) for (const covered of shape.covered) { const {refusals, oks} = lib.candidateSents(shape.task, covered); for (const item of [...refusals, ...oks]) lib.cellLabel(shape, item).defined ? totals.canon++ : totals.pinned++; }
  assert.equal(totals.canon + totals.pinned, 142 + 23); assert.ok(totals.pinned > 0 && totals.canon > totals.pinned);
  // the open cells a proof may pin an assertion under, and the report object they produce
  assert.deepEqual(Object.keys(lib.OPEN_CELLS), ['D1', 'D3', 'D4', 'D6']); assert.deepEqual(lib.OPEN_CELLS.D4, {defined: false, decision: 'D4'});
  assert.deepEqual(lib.cellReport(lib.OPEN_CELLS.D1), {defined: false, decision: 'D1', status: 'PINNED_TO_TODAY (open D1)'}); assert.deepEqual(lib.cellReport({defined: true, decision: null}), {defined: true, decision: null, status: 'CANON'});
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
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Round 3 (review R2): direct PostgREST table writes (P1b), pass lines, the run result, the forged-pin and second-selection pins, the offer card
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
const supabaseDir = fileURLToPath(new URL('../../', import.meta.url));
const sqlFiles = directory => readdirSync(path.join(supabaseDir, directory)).filter(name => name.endsWith('.sql')).sort().map(name => ({file: directory + '/' + name, text: read(directory + '/' + name)}));
const migrations = sqlFiles('migrations'), candidates = sqlFiles('candidates');
/** The SQL statements of a source text, comments removed (a statement ends at a semicolon outside a quoted string; dollar-quoted bodies are not split specially, which is enough for the DDL statements read here). */
const statementsOf = text => text.replace(/--[^\n]*/g, '').split(/;\s*(?:\n|$)/).map(statement => statement.replace(/\s+/g, ' ').trim()).filter(Boolean);
/** Every grant / revoke statement over a table, in apply order (migrations by name, then the candidates by name; PKG-045b is NOT on the chain, it only touches SELECT on needs and is left out). */
function privilegeStatements(table) {
  const out = [], mention = new RegExp('\\bon\\s+(?:table\\s+)?public\\.' + table + '\\b', 'i');
  for (const {file, text} of [...migrations, ...candidates.filter(candidate => !/pkg045b/.test(candidate.file))]) for (const statement of statementsOf(text)) if (/^(grant|revoke)\b/i.test(statement) && mention.test(statement)) out.push({file, statement});
  return out;
}
/** The write privileges `authenticated` holds on a table: Supabase's default privileges grant everything on a new public table, then every revoke / grant statement is applied in order. */
function authenticatedWrites(table) {
  const held = {insert: true, update: true, delete: true}, steps = privilegeStatements(table);
  for (const {statement} of steps) {
    const match = /^(grant|revoke)\s+(.+?)\s+on\s+/i.exec(statement), who = /\b(?:from|to)\s+(.+)$/i.exec(statement);
    if (!match || !who || !/\bauthenticated\b/i.test(who[1])) continue;
    const kinds = match[2].toLowerCase().split(',').map(kind => kind.trim().split(' ')[0]), on = match[1].toLowerCase() === 'grant';
    for (const kind of kinds) { if (kind === 'all') for (const key of Object.keys(held)) held[key] = on; else if (kind in held) held[kind] = on; }
  }
  return {held, steps};
}
/** Every policy a table ever got: [{name, command, using, check}] in apply order, with drops applied. */
function policiesOf(table) {
  const live = new Map();
  for (const {text} of migrations) for (const statement of statementsOf(text)) {
    const drop = new RegExp('^drop policy (?:if exists )?(\\w+) on public\\.' + table + '$', 'i').exec(statement);
    if (drop) { live.delete(drop[1]); continue; }
    const create = new RegExp('^create policy (\\w+) on public\\.' + table + '\\s+(?:as \\w+\\s+)?for (\\w+)(.*)$', 'i').exec(statement);
    if (create) live.set(create[1], {name: create[1], command: create[2].toLowerCase(), rest: create[3]});
  }
  return [...live.values()];
}
const rlsEnabled = table => migrations.some(({text}) => new RegExp('alter table public\\.' + table + '\\s+enable row level security', 'i').test(text));

test('P1b plan: the expected outcome of every direct table write is DERIVED from the migration sources (grants, row-level security and policies), not asserted from memory', () => {
  assert.deepEqual(lib.directWritePlanProblems(), []);
  const tables = ['marketplace_responses', 'marketplace_response_versions', 'agreements', 'agreement_versions', 'need_selections', 'needs'];
  for (const table of tables) assert.equal(rlsEnabled(table), true, table + ' has row-level security enabled');
  // privileges
  const writes = Object.fromEntries(tables.map(table => [table, authenticatedWrites(table)]));
  assert.deepEqual(writes.marketplace_responses.held, {insert: false, update: false, delete: false}, 'the response head table grants no write to authenticated');
  assert.deepEqual(writes.marketplace_response_versions.held, {insert: false, update: false, delete: false}, 'the response version table grants no write to authenticated');
  for (const table of ['agreements', 'agreement_versions', 'need_selections']) { assert.deepEqual(writes[table].held, {insert: true, update: true, delete: true}, table + ' keeps the default table-level write grants: only RLS stands in the way'); assert.deepEqual(writes[table].steps, [], table + ' has no grant or revoke statement at all'); }
  assert.deepEqual(writes.needs.held, {insert: true, update: true, delete: false}, 'DELETE on needs is revoked from authenticated; insert and update are held (the policies restrict them)');
  assert.ok(writes.marketplace_responses.steps.every(step => step.file === 'migrations/20260830172000_clean_p1_cancel_withdraw_closure.sql'), 'the revoke lives in the p1 migration and nothing grants it back');
  // policies: the agreement and selection tables have SELECT policies only; the response tables have no write policy either
  for (const table of ['agreements', 'agreement_versions', 'need_selections']) { const policies = policiesOf(table); assert.ok(policies.length >= 1, table); assert.deepEqual([...new Set(policies.map(policy => policy.command))], ['select'], table + ': SELECT policies only'); }
  for (const table of ['marketplace_responses', 'marketplace_response_versions']) assert.deepEqual([...new Set(policiesOf(table).map(policy => policy.command))].filter(command => command !== 'select'), [], table + ': no write policy survives');
  // needs: the owner may INSERT only a DRAFT and UPDATE only a DRAFT (the latest definition of each policy); a published task cannot be edited directly
  const needsPolicies = Object.fromEntries(policiesOf('needs').map(policy => [policy.name, policy]));
  assert.equal(needsPolicies.needs_owner_update.command, 'update'); assert.match(needsPolicies.needs_owner_update.rest, /status = 'DRAFT'/); assert.doesNotMatch(needsPolicies.needs_owner_update.rest, /PUBLISHED|SELECTION/, 'the LATEST needs_owner_update is DRAFT-only');
  assert.equal(needsPolicies.needs_owner_insert.command, 'insert'); assert.match(needsPolicies.needs_owner_insert.rest, /status = 'DRAFT'/);
  assert.equal(Object.keys(needsPolicies).includes('needs_owner_all'), false, 'the broad owner ALL policy is gone');
  assert.deepEqual(policiesOf('needs').filter(policy => policy.command === 'update' || policy.command === 'all' || policy.command === 'delete').map(policy => policy.name), ['needs_owner_update'], 'the only write policy on needs is the DRAFT-only update');
  // the plan follows from the facts: no privilege = PRIVILEGE_DENIED; privilege and no insert policy = RLS_INSERT_REFUSED; privilege and no row the policy lets through = RLS_NO_ROWS; the control writes
  const expectedKind = item => {
    if (item.control) return 'ROWS_RETURNED';
    if (!writes[item.table].held[item.op]) return 'PRIVILEGE_DENIED';
    const policies = policiesOf(item.table).filter(policy => policy.command === item.op || policy.command === 'all');
    if (item.op === 'insert') return policies.length === 0 ? 'RLS_INSERT_REFUSED' : 'UNDECIDED';
    return 'RLS_NO_ROWS';   // no update / delete policy at all, or (needs) a DRAFT-only policy against a PUBLISHED target
  };
  for (const item of lib.DIRECT_WRITE_PLAN) assert.equal(item.kind, expectedKind(item), item.id);
  // a needs attack targets a PUBLISHED task with an application (never a DRAFT: that is the control)
  for (const item of lib.DIRECT_WRITE_PLAN.filter(entry => entry.table === 'needs')) assert.equal(item.target, item.control ? 'draft' : 'application', item.id);
  // the needs rows depend on the privileges of THIS chain: they are labelled chain-specific (DEV has the PKG-045b P0 column privileges, not observed)
  for (const item of lib.DIRECT_WRITE_PLAN) assert.equal(item.chainSpecific, item.table === 'needs', item.id);
  assert.equal(lib.DIRECT_WRITE_PLAN.filter(item => !item.control).length, 18);
});
test('P1b outcomes are matched EXACTLY: privilege denied, an RLS-filtered empty representation, a refused insert and the positive control', () => {
  const failed = (status, code, message) => ({status, data: null, error: {code, message}}), ok = (status, data) => ({status, data, error: null});
  const denied = failed(403, '42501', 'permission denied for table marketplace_responses');
  assert.deepEqual(lib.directWriteProblems(denied, 'PRIVILEGE_DENIED', 'marketplace_responses'), []);
  assert.ok(lib.directWriteProblems(denied, 'PRIVILEGE_DENIED', 'marketplace_response_versions').length >= 1, 'the table in the message must be the attacked table');
  assert.ok(lib.directWriteProblems(failed(500, '42501', 'permission denied for table marketplace_responses'), 'PRIVILEGE_DENIED', 'marketplace_responses').length >= 1, 'a 5xx is not a refusal');
  assert.ok(lib.directWriteProblems(failed(403, '42P01', 'permission denied for table marketplace_responses'), 'PRIVILEGE_DENIED', 'marketplace_responses').length >= 1, 'another SQLSTATE is not the privilege error');
  assert.ok(lib.directWriteProblems(ok(200, []), 'PRIVILEGE_DENIED', 'marketplace_responses').length >= 1, 'a silent success is the worst outcome');
  assert.ok(lib.directWriteProblems(ok(200, [{id: 'x'}]), 'PRIVILEGE_DENIED', 'marketplace_responses').length >= 1);
  const rls = failed(403, '42501', 'new row violates row-level security policy for table "agreements"');
  assert.deepEqual(lib.directWriteProblems(rls, 'RLS_INSERT_REFUSED', 'agreements'), []); assert.ok(lib.directWriteProblems(rls, 'RLS_INSERT_REFUSED', 'agreement_versions').length >= 1);
  assert.ok(lib.directWriteProblems(denied, 'RLS_INSERT_REFUSED', 'marketplace_responses').length >= 1, 'a privilege error is not an RLS refusal');
  // RLS filtering: HTTP 200 and ZERO rows; one row back means the write succeeded
  assert.deepEqual(lib.directWriteProblems(ok(200, []), 'RLS_NO_ROWS', 'agreements'), []);
  assert.ok(lib.directWriteProblems(ok(200, [{id: 'x'}]), 'RLS_NO_ROWS', 'agreements')[0].includes('1 row(s) returned, expected 0'));
  assert.ok(lib.directWriteProblems(ok(204, []), 'RLS_NO_ROWS', 'agreements').length >= 1, 'a 204 is not the pinned 200 representation');
  assert.ok(lib.directWriteProblems(ok(200, null), 'RLS_NO_ROWS', 'agreements').length >= 1, 'no representation at all is not an empty one');
  assert.ok(lib.directWriteProblems(denied, 'RLS_NO_ROWS', 'agreements').length >= 1);
  // the control writes exactly one row
  assert.deepEqual(lib.directWriteProblems(ok(200, [{id: 'x'}]), 'ROWS_RETURNED', 'needs'), []); assert.ok(lib.directWriteProblems(ok(200, []), 'ROWS_RETURNED', 'needs').length >= 1); assert.ok(lib.directWriteProblems(ok(200, [{}, {}]), 'ROWS_RETURNED', 'needs').length >= 1);
  assert.deepEqual(lib.directWriteProblems(ok(200, []), 'NONSENSE', 'needs'), ['unknown kind NONSENSE']);
  // a plan that forgets a table, an operation or the control is reported
  const without = id => lib.DIRECT_WRITE_PLAN.filter(item => item.id !== id);
  assert.ok(lib.directWritePlanProblems(without('requester_delete_agreements')).includes('no delete attack on agreements'));
  assert.ok(lib.directWritePlanProblems(without('worker_insert_responses')).includes('no insert attack on marketplace_responses'));
  assert.ok(lib.directWritePlanProblems(without('control_requester_update_draft_needs_price')).includes('the plan needs exactly one positive control'));
  assert.ok(lib.directWritePlanProblems([...lib.DIRECT_WRITE_PLAN, lib.DIRECT_WRITE_PLAN[0]]).some(problem => problem.startsWith('duplicate attack id')));
  assert.equal(new Set(lib.DIRECT_WRITE_PLAN.map(item => item.id)).size, lib.DIRECT_WRITE_PLAN.length);
});
test('the forged-pin plan names the guard that refuses each attempt, in the order the p0d03 selection source checks them; a second selection is pinned per scenario', () => {
  const select = read('migrations/20260906100000_clean_p0d03_requester_connection_activation_v1.sql');
  const body = select.slice(select.indexOf('create or replace function public.rpc_select_response('));
  const at = detail => body.indexOf("raise exception 'STALE_REVIEW_REQUIRED' using errcode = 'P0001', detail = '" + detail + "'");
  for (const item of lib.FORGED_PIN_PLAN) assert.ok(at(item.detail) > 0, item.id + ' names a guard the source raises: ' + item.detail);
  assert.ok(at('need_revision') < at('response_version') && at('response_version') < at('content_hash'), 'the guards are checked in this order, so each attempt changes ONE parameter and meets ONE guard');
  assert.deepEqual(lib.FORGED_PIN_PLAN.map(item => item.id), ['flipped_hash_digit', 'hash_binding_another_price', 'response_version_plus_one', 'need_revision_plus_one']);
  assert.deepEqual([...new Set(lib.FORGED_PIN_PLAN.map(item => item.detail))].sort(), ['content_hash', 'need_revision', 'response_version'], 'three distinct guards are reached');
  // a second selection: the task status is checked first, the response status after the revision pin
  const notOpen = body.indexOf("raise exception 'NEED_NOT_OPEN' using errcode = 'P0001', detail = v_need.status"), notSelectable = body.indexOf("raise exception 'RESPONSE_NOT_SELECTABLE' using errcode = 'P0001', detail = v_resp.status");
  assert.ok(notOpen > 0 && notSelectable > notOpen, 'NEED_NOT_OPEN (detail = the need status) precedes RESPONSE_NOT_SELECTABLE (detail = the response status)');
  assert.ok(body.includes("then 'ACTIVE' else 'SELECTION'"), 'a full task becomes ACTIVE, a task with room SELECTION'); assert.ok(body.includes("update public.marketplace_responses\n     set status='SELECTED'"), 'the selected application is SELECTED');
  assert.deepEqual(lib.secondSelectionOutcome(1, 1), {message: 'NEED_NOT_OPEN', detail: 'ACTIVE'}); assert.deepEqual(lib.secondSelectionOutcome(3, 3), {message: 'NEED_NOT_OPEN', detail: 'ACTIVE'});
  assert.deepEqual(lib.secondSelectionOutcome(2, 2), {message: 'NEED_NOT_OPEN', detail: 'ACTIVE'}); assert.deepEqual(lib.secondSelectionOutcome(6, 2), {message: 'RESPONSE_NOT_SELECTABLE', detail: 'SELECTED'});
});
test('the offer-card pin cannot "diverge" by accident: the key must exist and be a whole number, equal the application price and differ from the Dogovor amount', () => {
  const pin = {applicationPrice: 6000, dogovorPrice: 1};
  assert.deepEqual(lib.offerCardProblems({priceRsd: 6000}, pin), []);
  assert.deepEqual(lib.offerCardProblems(null, pin), ['the offer card is missing']); assert.deepEqual(lib.offerCardProblems(undefined, pin), ['the offer card is missing']);
  assert.deepEqual(lib.offerCardProblems({price: 6000}, pin), ['the offer card has no priceRsd key'], 'a misnamed key is a failure, not a divergence (NaN !== 1)');
  assert.deepEqual(lib.offerCardProblems({priceRsd: '6000'}, pin), ['priceRsd is not a whole number: "6000"']); assert.deepEqual(lib.offerCardProblems({priceRsd: null}, pin), ['priceRsd is not a whole number: null']);
  assert.equal(lib.offerCardProblems({priceRsd: 6000.5}, pin).length, 1);
  assert.deepEqual(lib.offerCardProblems({priceRsd: 5000}, pin), ["the offer card shows 5000, expected the application's own price 6000"]);
  assert.deepEqual(lib.offerCardProblems({priceRsd: 1}, {applicationPrice: 1, dogovorPrice: 1}), ['the offer card equals the amended Dogovor amount: there is no divergence to characterise']);
});
test('a pass line carries the short label first, and the run result is PASS_WITH_GAPS whenever something designed to be demonstrated was left out', () => {
  assert.equal(lib.passLine('PRICE-CHAIN BODIES == DEV (12/12 pinned bodies; the chain is NOT DEV)', 'P2_X'), 'PASS [PRICE-CHAIN BODIES == DEV (12/12 pinned bodies; the chain is NOT DEV)] P2_X');
  assert.equal(lib.passLine(null, 'P0_X'), 'PASS [label not yet known] P0_X'); assert.equal(lib.passLine(undefined, 'P0_X'), 'PASS [label not yet known] P0_X');
  assert.equal(lib.resultOf([]), 'PASS'); assert.equal(lib.resultOf(undefined), 'PASS'); assert.equal(lib.resultOf(['PT409 NOT demonstrated: x']), 'PASS_WITH_GAPS');
});
test('the markdown report renders a complete run and a run that failed early, label first, with the label on every check, the gaps, the direct writes and the client flows, without throwing', () => {
  const dev = Object.fromEntries(pins.PINS.map(item => [item.signature, item.devMd5]));
  const pin = id => pins.PINS.find(item => item.id === id);
  const gate = pins.runPinGate(signature => (signature === pin('stale_resolver').signature ? pin('stale_resolver').knownChainMd5 : dev[signature]), pins.PINS, 'stale_resolver NOT APPLIED (PKG049_B24_PREIMAGE_DRIFT: x)');
  const full = {package: 'PKG-049 test', sourceSha: 'abc', result: 'PASS_WITH_GAPS', label: gate.label, labelShort: gate.labelShort, gaps: ['PT409 (HTTP 409) NOT demonstrated: the stale resolver is not the DEV body'], stages: {ex04dCandidate: 'APPLIED', b24PriceChain: 'stale_resolver NOT APPLIED (PKG049_B24_PREIMAGE_DRIFT: x)'},
    stale: {pt409: {skipped: true, reason: 'the stale resolver on this chain (md5 d37c4f7c) is not the DEV body (96cb9aac)'}},
    pinGate: gate, pinEvaluation: pins.evaluatePinGate(gate, {vocabulary: {equal: true}, swallow: {ncs_1: [], ncs_2: []}}),
    chainFidelity: {note: 'n', b24Part1: {absentOnChain: ['private.platform_price_add_version'], siteCountDrift: [{fn: 'x', expected: 1, found: 2}], notUnique: [], alreadyPt409: [], wouldApplyHere: false},
      certificate: {chainDigestPrefix: 'aaaaaaaa', devDigestPrefix: '58447d77', note: 'chain-internal only'}}, postgrestHeader: {server: null, via: null},
    directWrites: {note: 'derived from the sources', rows: [{id: 'worker_update_responses', actor: 'worker', table: 'marketplace_responses', op: 'update', kind: 'PRIVILEGE_DENIED', observed: 'HTTP 403 42501 permission denied for table marketplace_responses', surfaceIdentical: true, chainSpecific: false},
      {id: 'requester_update_needs_price', actor: 'requester', table: 'needs', op: 'update', kind: 'RLS_NO_ROWS', observed: 'HTTP 200 0 row(s)', surfaceIdentical: true, chainSpecific: true},
      {id: 'control_requester_update_draft_needs_price', actor: 'requester', table: 'needs', op: 'update', kind: 'ROWS_RETURNED', control: true, observed: 'HTTP 200 1 row(s)', surfaceIdentical: null, chainSpecific: true}]},
    matrix: [{shape: 'per_person_n3 c2', mode: 'MY_PRICE', basis: 'PER_PERSON', taskPrice: 3000, sent: 3000, kind: 'taskAmount', outcome: 'REFUSED', message: 'FIXED_PRICE_MISMATCH', status: 'CANON'},
      {shape: 'my_null_n3 c2', mode: 'MY_PRICE', basis: null, taskPrice: 3000, sent: 3000, kind: 'canonical', outcome: 'ACCEPTED_VERBATIM', status: 'PINNED_TO_TODAY (open D1)'}],
    matrixTotals: {refusalsAsserted: 1, acceptedVerbatim: 1, canonRows: 1, pinnedRows: 1},
    clientFlows: [{id: 'null_basis', status: 'PINNED_TO_TODAY (open D1)', decodedTask: {mode: 'MY_PRICE', basis: null, price: 3000, slots: 3}, people: 2, composedPrice: 3000, storedPrice: 3000, workerReadback: '3.000 RSD', requesterReadback: '3.000 RSD', agreementReadback: '3.000 RSD'},
      {id: 'offers', status: 'PINNED_TO_TODAY (open D4)', decodedTask: {mode: 'OFFERS', basis: null, price: null, slots: 3}, people: 2, composedPrice: 12345, storedPrice: 12345, workerReadback: '12.345 RSD', requesterReadback: '12.345 RSD', agreementReadback: '12.345 RSD'}],
    d3: {pinnedToToday: 'pinned', rows: [{basis: null, taskPrice: 3000, covered: 1, agreementV1Price: 3000, accepted: [{amount: 1}, {amount: 2147483647}], workspaceTermsPrice: 3000, status: 'PINNED_TO_TODAY (open D3)'}], acceptCallArguments: 'p_proposal_id uuid, p_accept boolean',
      offerCardDivergence: {offerCardPrice: 3000, dogovorPrice: 1, diverges: true}},
    weakening: {fixturePredicates: ['select', 'candidates', 'page'], fixtureNote: 'triggers disabled, no revision bump', probes: [{id: 'helper_is_a_no_op', detected: true, primary: ['submit'], expected: {submit: 'ACCEPTED'}, weakened: {submit: {holds: false, observed: 'ACCEPTED'}}, restoredAllHold: true},
      {id: 'coupling', detected: true, coupling: 'both overloads', raisedBy: {rpc_read_task: 'PKG049_UNLISTED_PROBE'}, restoredAllHold: true}]},
    checks: [{name: 'P1', labelShort: gate.labelShort}, {name: 'P2', labelShort: gate.labelShort}], notVerified: ['DEV']};
  const text = lib.renderReportMarkdown(full);
  assert.ok(text.indexOf('**Label: CORE price chain 7/8 equal (stale_resolver PRE_B24)') > 0 && text.indexOf('**Label') < text.indexOf('## Pin gate'));
  for (const needle of ['## Matrix', 'FIXED_PRICE_MISMATCH', 'OPEN OWNER DECISION D3', 'helper_is_a_no_op', '## Not verified', 'platform_price_add_version', 'PRE_B24', 'PINNED_TO_TODAY (open D1)', '| status |', 'The chain does NOT carry: pkg051a (platform price list); A1/P0/P4/P5/B3a-c;',
    'site-count drift [{"fn":"x","expected":1,"found":2}]', 'Offer card (my applications) versus Dogovor', 'submit:ACCEPTED', 'Gate verdict: PASS', 'relaxed mode does not relax existence',
    'Result: **PASS_WITH_GAPS** (1 gap(s), listed below)', '**PT409 coverage: NOT RUN**', '## Gaps (designed to be demonstrated, NOT demonstrated by this run)', '- PT409 (HTTP 409) NOT demonstrated',
    '## Direct table writes', '| worker_update_responses | worker | marketplace_responses | update | PRIVILEGE_DENIED |', '| requester_update_needs_price | requester | needs | update | RLS_NO_ROWS | HTTP 200 0 row(s) | true | chain-specific |', '(CONTROL)', 'n/a (control writes)',
    '## Real client flows', '| null_basis | PINNED_TO_TODAY (open D1) |', '| offers | PINNED_TO_TODAY (open D4) |', 'Fixture note: the select, candidates, page predicate(s) set their state with triggers disabled, no revision bump',
    '- PASS [CORE price chain 7/8 equal (stale_resolver PRE_B24)']) assert.ok(text.includes(needle), needle);
  // the header says what "PRICE-CHAIN BODIES == DEV" means and that nothing here is evidence about DEV
  assert.ok(text.includes('Nothing here is evidence about DEV. "PRICE-CHAIN BODIES == DEV" in the label means ONLY that the pinned price-chain function bodies are byte-equal to the 2026-10-01 DEV readback'));
  assert.ok(text.includes(pins.CHAIN_LACKS_TOKEN), 'the header names the packages the chain lacks'); assert.doesNotMatch(text, /unless the label says CHAIN == DEV/);
  assert.ok(text.includes('B24 conversion of the two price-chain functions (in-proof, one transaction each): stale_resolver NOT APPLIED'));
  // PT409 observed: no NOT RUN line, an observation line instead; an all-equal gate renders the short label with the bodies-only qualifier
  const observed = lib.renderReportMarkdown({...full, result: 'PASS', gaps: [], stale: {pt409: {status: 409, code: 'PT409'}}, pinGate: pins.runPinGate(signature => dev[signature]), label: pins.runPinGate(signature => dev[signature]).label});
  assert.ok(observed.includes('PT409 coverage: observed (HTTP 409, PT409).') && !observed.includes('NOT RUN') && !observed.includes('## Gaps') && observed.includes('Result: **PASS**.'));
  assert.ok(observed.includes('**Label: PRICE-CHAIN BODIES == DEV (12/12 pinned bodies; the chain is NOT DEV) [every pinned price-chain function body is byte-equal to the 2026-10-01 DEV readback'));
  const early = lib.renderReportMarkdown({package: 'PKG-049 test', sourceSha: 'abc', result: 'FAIL', label: null, stages: {}, checks: [], failure: 'AssertionError: boom'});
  assert.ok(early.includes('Result: **FAIL**') && early.includes('AssertionError: boom') && early.includes('not reached'));
  const partial = lib.renderReportMarkdown({package: 'PKG-049 test', sourceSha: 'abc', result: 'FAIL', label: null, stages: {}, checks: [{name: 'P0'}], directWrites: {rows: [{id: 'a', actor: 'worker', table: 't', op: 'update', kind: 'PRIVILEGE_DENIED', observed: 'x', problems: ['p']}]}});
  assert.ok(partial.includes('- PASS [label not yet known] P0') && partial.includes('## Direct table writes'), 'a failed run still renders the direct-write rows it has');
});
