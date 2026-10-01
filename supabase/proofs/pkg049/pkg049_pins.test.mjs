// Unit tests of the PINS side of the B09 / PKG-049 characterization proof (pins, the gate and its failure rule, the helper vocabulary, the B24 derivation, the workflow coverage).
// No database, no network: `node --test supabase/proofs/pkg049/*.test.mjs` (the workflow runs it after `npm ci`, because the workflow-coverage test loads the real client modules with ts_loader).
// They tie the pins to the SOURCE TEXT the repository stores (helper, both need_candidate_states_v5 overloads, the ru4 / w02 migrations and the pkg033a patches that build the two PRE-B24 bodies),
// the B24 conversion to the ledger 214 receipt, the helper vocabulary to the real helper body, and the weakening edits to the real caller texts.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as pins from './pkg049_pins.mjs';
import * as lib from './pkg049_lib.mjs';
import {loadModules} from '../ex04/ts_loader.mjs';

/** Relative to supabase/. Line endings are NORMALISED to LF: a checkout with core.autocrlf (Windows) must not break an anchor that spans a line break (round 3, review R2: ANCHOR_ONCE failed on CRLF copies). */
const toLf = text => text.replace(/\r\n/g, '\n');
const read = relative => toLf(readFileSync(fileURLToPath(new URL('../../' + relative, import.meta.url)), 'utf8'));
const between = (text, startMarker, tag) => {
  const start = text.indexOf(startMarker); assert.ok(start >= 0, 'MARKER ' + startMarker);
  const open = text.indexOf(tag, start) + tag.length, close = text.indexOf(tag, open); assert.ok(open > tag.length && close > open, 'TAG ' + tag);
  return text.slice(open, close);
};
const pin = id => pins.PINS.find(item => item.id === id);
const pkg033a = read('candidates/pkg033a_application_admission_parity.sql');
const helperBody = between(pkg033a, 'create function private.assert_application_price_v5', '$function$');
const ncs1Body = between(read('candidates/pkg035a_selectable_application_counts.sql'), 'create function private.need_candidate_states_v5', '$function$');
const ncs2Body = between(read('candidates/ex04d_candidates_page.sql'), 'states_body constant text :=', '$states_body$');
const pkg045a = read('candidates/pkg045a_task_read_contract.sql');
const readTaskBody = between(pkg045a, 'CREATE OR REPLACE FUNCTION public.rpc_read_task(p_need_id uuid)', '$function$');

/** The numbered anchor patches pkg033a applies: (ord, signature, anchor, replacement). */
const pkg033aPatches = text => [...text.matchAll(/\((\d+),'([^']+)',\$a\$([\s\S]*?)\$a\$,\$b\$([\s\S]*?)\$b\$\)/g)].map(match => ({ord: Number(match[1]), signature: match[2], anchor: match[3], replacement: match[4]}));
/** The text between `as $$` and `$$;` of the first function created at `marker`. */
const dollarBody = (text, marker) => { const start = text.indexOf(marker); assert.ok(start >= 0, 'MARKER ' + marker); const open = text.indexOf('as $$', start) + 5, close = text.indexOf('$$;', open); assert.ok(open > 5 && close > open); return text.slice(open, close); };
/** The body the DISPOSABLE chain carries for the stale resolver: the ru4 body (pkg033a pre-image pin 77390882) with the pkg033a patches 2..8 applied, each anchor exactly once. */
function reconstructChainStaleResolver() {
  let body = dollarBody(read('migrations/20260904214500_clean_ru4_owner_edit_lock.sql'), 'create or replace function public.rpc_resolve_stale_response_after_need_edit(');
  assert.equal(pins.md5Lf(body), '77390882ec8d5bd391859447184ed41e', 'THE_RU4_BODY_IS_THE_PKG033A_PREDECESSOR_PIN');
  const patches = pkg033aPatches(pkg033a).filter(patch => patch.signature.startsWith('public.rpc_resolve_stale_response_after_need_edit(')).sort((a, b) => a.ord - b.ord);
  assert.deepEqual(patches.map(patch => patch.ord), [2, 3, 4, 5, 6, 7, 8]);
  for (const patch of patches) { assert.equal(body.split(patch.anchor).length - 1, 1, 'ANCHOR_ONCE #' + patch.ord); body = body.replace(patch.anchor, () => patch.replacement); }
  return body;
}
/** The body of the legacy rpc_confirm_need_edit the chain carries (source147: the w02 migration redefinition, md5 dfa1a809). */
const chainConfirmNeedEdit = () => dollarBody(read('migrations/20260910130851_clean_w02_resolved_location_authority.sql'), 'create or replace function public.rpc_confirm_need_edit(');
const fnName = signature => signature.split('(')[0];

test('the pinned md5 of the helper, of both need_candidate_states_v5 overloads and of rpc_read_task equal the md5 of the body text the repository stores', () => {
  assert.equal(pins.md5Lf(helperBody), pin('helper').devMd5);
  assert.equal(pins.md5Lf(ncs1Body), pin('ncs_1').devMd5);
  assert.equal(pins.md5Lf(ncs2Body), pin('ncs_2').devMd5);
  // rpc_read_task: created by pkg045a (which asserts md5(prosrc) = 1e01db51 itself) and only re-pinned by PKG-045b P0; P5, P6 and the P8 coupling probe read the task and the computed count through it
  assert.equal(pins.md5Lf(readTaskBody), pin('read_task').devMd5);
  assert.ok(pkg045a.includes("'" + pin('read_task').devMd5 + "'"), 'pkg045a pins the same md5');
  assert.equal(pin('read_task').group, 'adjacent', 'a difference is reported and warned, never decisive: the price door is the helper');
});
test('md5Lf removes carriage returns before hashing and every pin is a 32-hex md5 with a unique id and signature', () => {
  assert.equal(pins.md5Lf('a\r\nb'), pins.md5Lf('a\nb'));
  assert.equal(new Set(pins.PINS.map(item => item.id)).size, pins.PINS.length);
  assert.equal(new Set(pins.PINS.map(item => item.signature)).size, pins.PINS.length);
  for (const item of pins.PINS) { assert.ok(pins.isMd5(item.devMd5), item.id); if (item.knownChainMd5) assert.ok(pins.isMd5(item.knownChainMd5), item.id); }
  assert.deepEqual(pins.PINS.filter(item => item.group === 'core').map(item => item.id), ['submit', 'select', 'helper', 'stale_resolver', 'ncs_1', 'ncs_2', 'propose', 'respond']);
  assert.deepEqual(pins.PINS.filter(item => item.group === 'adjacent').map(item => item.id), ['selectable_count', 'read_task', 'guard_need_write', 'confirm_need_edit']);
  assert.deepEqual(pins.PINS.filter(item => item.knownChainMd5 !== undefined).map(item => item.id), ['stale_resolver', 'confirm_need_edit'], 'only the two PRE_B24 bodies may differ for a documented reason');
});
test('the anchor tests survive a CRLF checkout: a CRLF copy breaks a multi-line anchor, the normalised text restores it (round 3, review R2: ANCHOR_ONCE failed under core.autocrlf)', () => {
  const patch = pkg033aPatches(pkg033a).find(item => item.signature.startsWith('public.rpc_resolve_stale_response_after_need_edit(') && item.anchor.includes('\n'));
  assert.ok(patch, 'a multi-line anchor of the stale resolver exists');
  const body = dollarBody(read('migrations/20260904214500_clean_ru4_owner_edit_lock.sql'), 'create or replace function public.rpc_resolve_stale_response_after_need_edit(');
  const crlf = body.replace(/\n/g, '\r\n');
  assert.equal(body.split(patch.anchor).length - 1, 1, 'the anchor matches once in the LF text');
  assert.equal(crlf.split(patch.anchor).length - 1, 0, 'a CRLF checkout does NOT match a multi-line anchor');
  assert.equal(toLf(crlf).split(patch.anchor).length - 1, 1, 'the normalised text matches once again');
  assert.equal(pins.md5Lf(crlf), pins.md5Lf(body), 'the pins hash with carriage returns removed, so a CRLF checkout does not move a pin');
  assert.equal(read('candidates/pkg033a_application_admission_parity.sql').includes('\r'), false, 'read() returns LF only');
});
test('the known pre-B24 chain bodies are exactly the pre-images the B24 Part 1 target table records', () => {
  const targets = pins.parseB24Part1Targets(read('candidates/b24_nonretried_conflicts_part1.sql'));
  assert.equal(targets.length, 54); assert.equal(targets.reduce((sum, item) => sum + item.sites, 0), 89);
  const byName = Object.fromEntries(targets.map(item => [item.fn, item]));
  for (const target of pins.b24PriceChainTargets()) { const row = byName[fnName(target.signature)]; assert.ok(row, target.id); assert.equal(row.preMd5, target.preMd5, target.id); assert.equal(row.sites, target.sites, target.id); }
  // The reason B24 Part 1 cannot be replayed on the chain as it is (finding: chain fidelity): a target that exists only after PKG-051a, which no chain stage creates.
  assert.ok(byName['private.platform_price_add_version']);
  assert.ok(read('candidates/pkg051a_platform_price_list.sql').includes('platform_price_add_version'));
});
test('the B24 conversion of the two price-chain functions is DERIVED from the repository sources: chain body md5, quoted sites, converted md5 = the DEV md5, and the ledger 214 receipt agrees', () => {
  const bodies = {stale_resolver: reconstructChainStaleResolver(), confirm_need_edit: chainConfirmNeedEdit()};
  const receipt = JSON.parse(read('operations/dev-alpha/ledger/20260930_b24_part1_application.receipt.json'));
  const inventory = read('proofs/b24/b24_inventory.tsv');
  for (const target of pins.b24PriceChainTargets()) {
    const body = bodies[target.id];
    assert.equal(pins.md5Lf(body), target.preMd5, target.id + ': the reconstructed chain body is the pre-image');
    assert.equal(pins.countQuotedSites(body), target.sites, target.id + ': quoted 40001 sites'); assert.equal(pins.hasOtherCodeSites(body), false, target.id + ': no 40001 outside the quoted form'); assert.equal(body.includes('PT409'), false);
    assert.equal(pins.derivedPostB24Md5(body), target.devMd5, target.id + ': the conversion of the chain body equals the DEV body (ledger 214)');
    const row = receipt.postflight.functions[fnName(target.signature)];
    assert.equal(row.md5, target.devMd5, target.id + ': the ledger 214 postflight md5'); assert.equal(row.pt409Sites, target.sites);
    assert.ok(inventory.split('\n').some(line => line.startsWith(fnName(target.signature) + '\t') && line.includes(target.preMd5)), target.id + ': the B24 inventory records this pre-image');
    assert.equal(pins.toPt409(body).split("'PT409'").length - 1, target.sites);
  }
});
test('the in-proof B24 stage SQL measures the derived md5 BEFORE executing, keeps the certificate and attributes, and is ONE TRANSACTION PER FUNCTION (no coupling between the two price-chain functions)', () => {
  const targets = pins.b24PriceChainTargets();
  assert.deepEqual(targets.map(target => target.id), ['stale_resolver', 'confirm_need_edit']);
  const both = pins.b24PriceChainSql();
  for (const target of targets) for (const needle of ["'" + target.signature + "'", "'" + target.preMd5 + "'", "'" + target.devMd5 + "'"]) assert.ok(both.includes(needle), needle);
  assert.equal(both.split('$pkg049_b24$').length - 1, 2); assert.equal(both.split('$f$').length - 1, 2);
  assert.ok(both.startsWith('begin;') && both.trimEnd().endsWith('commit;'));
  for (const guard of ['PKG049_B24_CERTIFICATE_NOT_READY', 'PKG049_B24_PREIMAGE_DRIFT', 'PKG049_B24_ALREADY_PT409', 'PKG049_B24_SITE_COUNT_DRIFT', 'PKG049_B24_DERIVATION_MISMATCH', 'PKG049_B24_POSTIMAGE_MISMATCH', 'PKG049_B24_ATTRIBUTES_CHANGED', 'PKG049_B24_CERTIFICATE_MOVED', 'PKG049_B24_FUNCTION_ABSENT']) assert.ok(both.includes(guard), guard);
  assert.ok(both.indexOf('PKG049_B24_DERIVATION_MISMATCH') < both.indexOf('execute v_new'), 'the derived md5 is checked before anything is executed');
  assert.equal(both.includes('public.rpc_save_'), false, 'no other function of B24 Part 1'); assert.equal(both.split('rpc_resolve_stale_response_after_need_edit(').length - 1, 1); assert.equal(both.split('public.rpc_confirm_need_edit(').length - 1, 1);
  assert.equal(pins.b24PriceChainSql(value => '"' + value + '"').includes('"' + pin('stale_resolver').signature + '"'), true, 'the quoting function is used for every literal');
  // the proof sends ONE function per call: an uncalled rpc_confirm_need_edit can never veto the stale resolver conversion that P4(h) needs, and vice versa
  const [stale, confirm] = targets, onlyStale = pins.b24PriceChainSql(undefined, [stale]), onlyConfirm = pins.b24PriceChainSql(undefined, [confirm]);
  for (const text of [onlyStale, onlyConfirm]) { assert.ok(text.startsWith('begin;') && text.trimEnd().endsWith('commit;')); assert.equal(text.split('$pkg049_b24$').length - 1, 2); assert.equal(text.split('execute v_new').length - 1, 1); }
  assert.ok(onlyStale.includes(stale.signature) && onlyStale.includes(stale.preMd5) && onlyStale.includes(stale.devMd5));
  for (const needle of [confirm.signature, confirm.preMd5, confirm.devMd5, 'rpc_confirm_need_edit']) assert.equal(onlyStale.includes(needle), false, 'no coupling: ' + needle);
  assert.ok(onlyConfirm.includes(confirm.signature) && onlyConfirm.includes(confirm.preMd5) && onlyConfirm.includes(confirm.devMd5));
  for (const needle of [stale.signature, stale.preMd5, stale.devMd5, 'rpc_resolve_stale_response_after_need_edit']) assert.equal(onlyConfirm.includes(needle), false, 'no coupling: ' + needle);
});
test('the stage decision and the error classification tolerate ONLY the four documented chain-drift guards, and only when the body was not the known pre-image', () => {
  const [stale] = pins.b24PriceChainTargets();
  assert.deepEqual(pins.b24StageDecision(stale.devMd5, stale), {action: 'NOT_NEEDED', preImageMatched: false});
  assert.deepEqual(pins.b24StageDecision(stale.preMd5, stale), {action: 'APPLY', preImageMatched: true});
  assert.deepEqual(pins.b24StageDecision('0'.repeat(32), stale), {action: 'APPLY', preImageMatched: false});
  assert.deepEqual(pins.b24StageDecision(null, stale), {action: 'APPLY', preImageMatched: false}, 'an absent function is attempted and meets FUNCTION_ABSENT');
  const psql = guard => `LOCAL_SQL:PROCESS_EXIT:status=3:psql:<stdin>:12: ERROR:  ${guard}: public.rpc_x(uuid)\nCONTEXT:  PL/pgSQL function inline_code_block line 12 at RAISE`;
  assert.deepEqual([...pins.B24_TOLERATED_GUARDS], ['PKG049_B24_PREIMAGE_DRIFT', 'PKG049_B24_SITE_COUNT_DRIFT', 'PKG049_B24_ALREADY_PT409', 'PKG049_B24_FUNCTION_ABSENT']);
  for (const guard of pins.B24_TOLERATED_GUARDS) {
    assert.deepEqual(pins.classifyB24StageError(psql(guard)), {tolerated: true, guard, reason: 'CHAIN_DRIFT'}, guard);
    assert.deepEqual(pins.classifyB24StageError(psql(guard), {preImageMatched: false}), {tolerated: true, guard, reason: 'CHAIN_DRIFT'}, guard);
    assert.deepEqual(pins.classifyB24StageError(psql(guard), {preImageMatched: true}), {tolerated: false, guard, reason: 'DRIFT_GUARD_ON_THE_KNOWN_PRE_IMAGE'}, 'a drift guard on a body that WAS the pre-image is a defect: ' + guard);
  }
  // everything else is a hard failure: the other guards, a SQL defect, a timeout, an empty message
  for (const guard of ['PKG049_B24_CERTIFICATE_NOT_READY', 'PKG049_B24_DERIVATION_MISMATCH', 'PKG049_B24_POSTIMAGE_MISMATCH', 'PKG049_B24_ATTRIBUTES_CHANGED', 'PKG049_B24_CERTIFICATE_MOVED', 'PKG049_B24_NOTHING_TO_CONVERT']) {
    const verdict = pins.classifyB24StageError(psql(guard)); assert.equal(verdict.tolerated, false, guard); assert.equal(verdict.guard, null); assert.match(verdict.reason, /^GUARD_IS_NOT_A_DOCUMENTED_CHAIN_DRIFT: /);
  }
  for (const message of ['LOCAL_SQL:ETIMEDOUT:status=NONE:', 'LOCAL_SQL:PROCESS_EXIT:status=1:ERROR:  syntax error at or near "xx"\nLINE 3: PKG049_B24_PREIMAGE_DRIFT: quoted in a source line', 'LOCAL_SQL:PROCESS_EXIT:status=1:ERROR:  relation "x" does not exist', '', null, undefined]) {
    const verdict = pins.classifyB24StageError(message); assert.equal(verdict.tolerated, false, String(message)); assert.equal(verdict.reason, 'NOT_A_STAGE_GUARD');
  }
  assert.equal(pins.summarizeB24Stages([{id: 'stale_resolver', status: 'APPLIED (a -> b)'}, {id: 'confirm_need_edit', status: 'NOT NEEDED (x)'}]), 'stale_resolver APPLIED (a -> b); confirm_need_edit NOT NEEDED (x)');
});
test('B24 Part 1 applicability counts existence, uniqueness, quoted-site drift and PT409 (relaxed mode relaxes none of them)', () => {
  const targets = [{fn: 'a.x', sites: 2, preMd5: '0'.repeat(32)}, {fn: 'a.y', sites: 1, preMd5: '0'.repeat(32)}, {fn: 'a.z', sites: 1, preMd5: '0'.repeat(32)}, {fn: 'a.w', sites: 3, preMd5: '0'.repeat(32)}, {fn: 'a.v', sites: 1, preMd5: '0'.repeat(32)}];
  const clean = pins.b24Applicability(targets.slice(0, 1), [{fn: 'a.x', overloads: 1, sites: 2, hasPt409: false}]);
  assert.deepEqual(clean, {absentOnChain: [], notUnique: [], siteCountDrift: [], alreadyPt409: [], wouldApplyHere: true});
  const mixed = pins.b24Applicability(targets, [{fn: 'a.x', overloads: 1, sites: 2, hasPt409: false}, {fn: 'a.y', overloads: 1, sites: 2, hasPt409: false}, {fn: 'a.w', overloads: 2, sites: 3, hasPt409: false}, {fn: 'a.v', overloads: 1, sites: 1, hasPt409: true}]);
  assert.deepEqual(mixed.absentOnChain, ['a.z']); assert.deepEqual(mixed.notUnique, ['a.w']); assert.deepEqual(mixed.siteCountDrift, [{fn: 'a.y', expected: 1, found: 2}]); assert.deepEqual(mixed.alreadyPt409, ['a.v']); assert.equal(mixed.wouldApplyHere, false);
  const drift = pins.b24Applicability(targets.slice(0, 1), [{fn: 'a.x', overloads: 1, sites: 1, hasPt409: false}]);
  assert.equal(drift.wouldApplyHere, false, 'an existing target with the wrong number of quoted sites is NOT applicable (existence alone is not enough)');
});
test('the gate: equal, different (explained and unexplained) and missing are told apart per group, and the label separates the CORE price chain from the adjacent pins', () => {
  const equalAll = Object.fromEntries(pins.PINS.map(item => [item.id, item.devMd5]));
  const clean = pins.classifyPins(equalAll);
  assert.deepEqual(clean.equal.length, pins.PINS.length); assert.equal(clean.different.length + clean.missing.length + clean.harness.length, 0);
  assert.equal(clean.core.total, 8); assert.equal(clean.adjacent.total, 4);
  // the label claims the pinned BODIES only and says the chain is NOT DEV (round 3: "CHAIN == DEV" overclaimed); the long form names what the chain lacks
  assert.equal(pins.chainLabelShort(clean), 'PRICE-CHAIN BODIES == DEV (12/12 pinned bodies; the chain is NOT DEV)');
  assert.doesNotMatch(pins.chainLabel(clean), /^CHAIN == DEV/); assert.match(pins.chainLabel(clean), /^PRICE-CHAIN BODIES == DEV \(12\/12 pinned bodies; the chain is NOT DEV\)/); assert.equal(pins.gateExitCode(clean), 0);
  const longLabel = pins.chainLabel(clean, 'stale_resolver APPLIED (d37c4f7c -> 96cb9aac); confirm_need_edit APPLIED (dfa1a809 -> 450b6f8d)');
  for (const needle of ['every pinned price-chain function body is byte-equal', 'in-proof B24 conversion of the two PRE_B24 bodies: stale_resolver APPLIED', 'nothing else is claimed', 'pkg051a', 'A1/P0/P4/P5/B3a-c', 'PKG-045b P0', 'P6 rollout v3', 'B24 Part 2', 'Voice B1', 'EX-04A-C', 'certificate is chain-internal']) assert.ok(longLabel.includes(needle), needle);
  for (const item of pins.CHAIN_LACKS) assert.ok(item.length > 3);
  for (const word of ['pkg051a', 'A1/P0/P4/P5/B3a-c', 'PKG-045b P0', 'P6 rollout v3', 'B24 Part 1', 'B24 Part 2', 'Voice B1', 'EX-04A-C']) assert.ok(pins.CHAIN_LACKS_TOKEN.includes(word) && pins.CHAIN_LACKS.some(item => item.includes(word.split(' (')[0])), word);
  // the chain as it is without the in-proof stage: only the two documented PRE_B24 differences
  const known = {...equalAll, stale_resolver: pin('stale_resolver').knownChainMd5, confirm_need_edit: pin('confirm_need_edit').knownChainMd5};
  const knownGate = pins.classifyPins(known);
  assert.equal(pins.chainLabel(knownGate), 'CORE price chain 7/8 equal (stale_resolver PRE_B24); adjacent 3/4 equal (confirm_need_edit PRE_B24): the verdicts below hold for the CHAIN, not for DEV');
  assert.equal(knownGate.unexplained, 0); assert.equal(knownGate.core.unexplained, 0);
  // an unexplained core difference, a missing core pin and an unexplained adjacent difference
  const observed = {...equalAll, stale_resolver: pin('stale_resolver').knownChainMd5, submit: '0'.repeat(32), ncs_2: null, select: undefined, guard_need_write: '1'.repeat(32)};
  const gate = pins.classifyPins(observed);
  assert.deepEqual(gate.missing.map(item => item.id).sort(), ['ncs_2', 'select']);
  assert.deepEqual(gate.different.map(item => item.id).sort(), ['guard_need_write', 'stale_resolver', 'submit']);
  assert.equal(gate.different.find(item => item.id === 'stale_resolver').explanation.startsWith('PRE_B24'), true);
  assert.equal(gate.different.find(item => item.id === 'submit').explanation, 'UNEXPLAINED'); assert.equal(gate.unexplained, 2); assert.equal(gate.core.unexplained, 1); assert.equal(gate.adjacent.unexplained, 1);
  assert.equal(pins.chainLabel(gate), 'CORE price chain 4/8 equal (submit UNEXPLAINED, stale_resolver PRE_B24, select MISSING, ncs_2 MISSING); adjacent 3/4 equal (guard_need_write UNEXPLAINED): A CORE PIN IS MISSING OR DIFFERS WITHOUT AN EXPLANATION, THE PIN GATE FAILS THE RUN');
  const broken = pins.classifyPins({...equalAll, helper: 'not-an-md5'});
  assert.equal(broken.harness.length, 1); assert.equal(pins.gateExitCode(broken), 2); assert.match(pins.chainLabel(broken), /HARNESS BROKEN/);
});
test('evaluatePinGate FAILS on a core difference without an explanation, a missing core pin, a changed vocabulary and a swallow-list gap, and passes the two PRE_B24 differences', () => {
  const equalAll = Object.fromEntries(pins.PINS.map(item => [item.id, item.devMd5]));
  const goodVocabulary = pins.compareVocabulary(pins.extractVocabulary(helperBody)), goodSwallow = {ncs_1: [], ncs_2: []};
  const evaluate = (observed, extra = {}) => pins.evaluatePinGate(pins.classifyPins(observed), {vocabulary: goodVocabulary, swallow: goodSwallow, ...extra});
  assert.deepEqual(evaluate(equalAll), {ok: true, failures: [], warnings: []});
  const preB24 = evaluate({...equalAll, stale_resolver: pin('stale_resolver').knownChainMd5, confirm_need_edit: pin('confirm_need_edit').knownChainMd5});
  assert.equal(preB24.ok, true, 'the two documented PRE_B24 differences pass'); assert.deepEqual(preB24.warnings, []);
  assert.deepEqual(evaluate({...equalAll, submit: '0'.repeat(32)}).failures, ['CORE_PIN_UNEXPLAINED_DIFFERENCE submit chain=' + '0'.repeat(32) + ' dev=' + pin('submit').devMd5]);
  assert.deepEqual(evaluate({...equalAll, helper: null}).failures, ['CORE_PIN_MISSING helper']);
  assert.deepEqual(evaluate({...equalAll, ncs_2: undefined}).failures, ['CORE_PIN_MISSING ncs_2']);
  assert.equal(evaluate({...equalAll, stale_resolver: '2'.repeat(32)}).ok, false, 'a stale resolver that is neither the DEV body nor the known pre-image fails');
  assert.equal(evaluate({...equalAll, stale_resolver: pin('confirm_need_edit').knownChainMd5}).ok, false, 'the explanation is per function');
  const adjacent = evaluate({...equalAll, guard_need_write: '3'.repeat(32), selectable_count: null});
  assert.equal(adjacent.ok, true, 'an adjacent difference is a warning'); assert.equal(adjacent.warnings.length, 2);
  const widened = pins.compareVocabulary(pins.extractVocabulary(helperBody.replace("message='UNKNOWN_PRICE_BASIS'", "message='SOMETHING_NEW'")));
  assert.equal(evaluate(equalAll, {vocabulary: widened}).ok, false); assert.match(evaluate(equalAll, {vocabulary: widened}).failures[0], /^HELPER_VOCABULARY_DIFFERS added=\[.*SOMETHING_NEW.*\] removed=\[.*UNKNOWN_PRICE_BASIS.*\]/);
  assert.deepEqual(evaluate(equalAll, {swallow: {ncs_1: [], ncs_2: ['UNKNOWN_PRICE_BASIS']}}).failures, ['SWALLOW_LIST_GAP ncs_2: UNKNOWN_PRICE_BASIS']);
  assert.deepEqual(evaluate(equalAll, {vocabulary: null}).failures, ['HELPER_VOCABULARY_NOT_READ']); assert.deepEqual(evaluate(equalAll, {swallow: null}).failures, ['SWALLOW_LISTS_NOT_READ']);
  assert.deepEqual(pins.evaluatePinGate(pins.classifyPins({...equalAll, helper: 'not-an-md5'}), {vocabulary: goodVocabulary, swallow: goodSwallow}).failures.length, 1);
  assert.equal(pins.gateExitCode(pins.classifyPins(equalAll), evaluate({...equalAll, submit: '0'.repeat(32)})), 2, 'a failing evaluation exits non-zero');
});
test('runPinGate reads through the callback, treats an absent function as missing and a throwing reader as a harness failure', () => {
  const dev = Object.fromEntries(pins.PINS.map(item => [item.signature, item.devMd5]));
  const gate = pins.runPinGate(signature => (signature in dev ? dev[signature] : null));
  assert.match(gate.label, /^PRICE-CHAIN BODIES == DEV \(12\/12 pinned bodies; the chain is NOT DEV\)/); assert.equal(gate.labelShort, 'PRICE-CHAIN BODIES == DEV (12/12 pinned bodies; the chain is NOT DEV)'); assert.equal(gate.equal.length, pins.PINS.length);
  assert.match(pins.runPinGate(signature => dev[signature], pins.PINS, 'stale_resolver APPLIED (x)').label, /in-proof B24 conversion of the two PRE_B24 bodies: stale_resolver APPLIED \(x\)/);
  const partial = pins.runPinGate(signature => { if (signature === pin('helper').signature) throw new Error('boom'); return dev[signature]; });
  assert.equal(pins.gateExitCode(partial), 2); assert.equal(partial.harness[0].id, 'helper'); assert.equal(partial.equal.length, pins.PINS.length - 1);
  const missingGate = pins.runPinGate(signature => (signature === pin('ncs_2').signature ? null : dev[signature]));
  const markdown = pins.renderPinGateMarkdown(missingGate, pins.evaluatePinGate(missingGate, {vocabulary: null, swallow: null}));
  assert.match(markdown, /\| ncs_2 \| core \| MISSING \|/); assert.match(markdown, /CORE price chain 7\/8 equal \(ncs_2 MISSING\)/); assert.match(markdown, /Gate verdict: FAIL \(CORE_PIN_MISSING ncs_2/);
  assert.match(markdown, /\| read_task \| adjacent \| equal \|/);
});
test('the helper vocabulary pinned here is exactly the (SQLSTATE, message) pairs the real helper body raises', () => {
  const extracted = pins.extractVocabulary(helperBody);
  assert.deepEqual(extracted.map(item => item.message), [...pins.HELPER_VOCABULARY.map(item => item.message)].sort());
  assert.equal(pins.compareVocabulary(extracted).equal, true);
  for (const item of pins.HELPER_VOCABULARY) assert.equal(pins.sqlstateOf(item.message), item.sqlstate);
  assert.equal(pins.sqlstateOf('FIXED_PRICE_NOT_READY'), 'P0001');
  const widened = pins.compareVocabulary(pins.extractVocabulary(helperBody.replace("message='UNKNOWN_PRICE_BASIS'", "message='SOMETHING_NEW'")));
  assert.equal(widened.equal, false); assert.deepEqual(widened.added.map(item => item.message), ['SOMETHING_NEW']); assert.deepEqual(widened.removed.map(item => item.message), ['UNKNOWN_PRICE_BASIS']);
  const restated = pins.compareVocabulary(pins.extractVocabulary(helperBody.replace("errcode='P0001', message='FIXED_PRICE_NOT_READY'", "errcode='22023', message='FIXED_PRICE_NOT_READY'")));
  assert.equal(restated.equal, false, 'a changed SQLSTATE is a changed pair');
});
test('the vocabulary extractor reads EVERY raise layout the repository uses, counts the raise statements, ignores comments and reports a raise it cannot read', () => {
  const pair = (message, sqlstate) => ({message, sqlstate});
  // the three layouts: errcode first, message first, and message with a detail in between; plus `raise exception 'MSG' using errcode = 'X'`
  assert.deepEqual(pins.parseRaise("raise exception using errcode='22023', message='A_ONE';"), pair('A_ONE', '22023'));
  assert.deepEqual(pins.parseRaise("raise exception using message='A_TWO', errcode='P0001';"), pair('A_TWO', 'P0001'));
  assert.deepEqual(pins.parseRaise("raise exception using errcode='22023', detail=format('x=%s', n.v), message='A_THREE';"), pair('A_THREE', '22023'));
  assert.deepEqual(pins.parseRaise("raise exception 'A_FOUR' using errcode = 'P0001';"), pair('A_FOUR', 'P0001'));
  assert.deepEqual(pins.parseRaise("raise exception using errcode='22023';"), {message: null, sqlstate: '22023'}, 'a missing half is null, never guessed');
  const layouts = [
    "raise exception using errcode='22023', message='A_ONE';",
    "raise exception using message='A_TWO', errcode='P0001';",
    "raise exception using errcode='22023', detail=format('a=%s;b=%s', 1, 2), message='A_THREE';",
    "raise exception 'A_FOUR' using errcode = 'P0001';",
  ].join('\n  ');
  assert.deepEqual(pins.extractVocabulary(layouts).map(item => item.message + '|' + item.sqlstate), ['A_FOUR|P0001', 'A_ONE|22023', 'A_THREE|22023', 'A_TWO|P0001'], 'a semicolon inside a format string does not end the statement');
  assert.equal(pins.raiseStatements(layouts).length, 4);
  // a comment that names a raise or a message is not one
  assert.equal(pins.raiseStatements("-- raise exception using errcode='22023', message='GHOST';\n  raise exception using errcode='22023', message='A_ONE';").length, 1);
  assert.deepEqual(pins.extractVocabulary("-- raise exception using errcode='22023', message='GHOST';"), []);
  // an unreadable raise is REPORTED (a silent blind spot otherwise) and breaks the count check
  const unreadable = pins.extractRaises("raise exception using errcode='22023', message=v_message;\n  raise exception using errcode='22023', message='A_ONE';");
  assert.equal(unreadable.count, 2); assert.equal(unreadable.pairs.length, 1); assert.equal(unreadable.unparsed.length, 1);
  assert.equal(pins.HELPER_RAISE_COUNT, 7);
  assert.deepEqual(pins.helperRaiseCheck(helperBody), {count: 7, expected: 7, problems: []}, 'the real helper raises exactly seven statements and every one is read');
  const added = helperBody.replace('  if n.mode', "  if p_price_rsd = 1 then raise exception 'SOMETHING_NEW' using errcode='22023'; end if;\n  if n.mode");
  assert.notEqual(added, helperBody); assert.deepEqual(pins.helperRaiseCheck(added).problems, ['RAISE_COUNT_8_PINNED_7']);
  const hidden = pins.compareVocabulary(pins.extractVocabulary(added), pins.HELPER_VOCABULARY, pins.helperRaiseCheck(added));
  assert.equal(hidden.equal, false, 'a new raise in ANY layout fails the comparison'); assert.deepEqual(hidden.raiseProblems, ['RAISE_COUNT_8_PINNED_7']);
  const unreadableAdded = helperBody.replace('  if n.mode', "  if p_price_rsd = 1 then raise exception using errcode='22023', message=v_name; end if;\n  if n.mode");
  assert.notEqual(unreadableAdded, helperBody); assert.deepEqual(pins.compareVocabulary(pins.extractVocabulary(unreadableAdded), pins.HELPER_VOCABULARY, pins.helperRaiseCheck(unreadableAdded)).raiseProblems.length, 2, 'a raise whose message cannot be read is counted AND reported as not parsed');
  assert.equal(pins.compareVocabulary(pins.extractVocabulary(unreadableAdded), pins.HELPER_VOCABULARY, pins.helperRaiseCheck(unreadableAdded)).equal, false);
  const messageFirst = helperBody.replace("errcode='22023', message='UNKNOWN_PRICE_BASIS'", "message='UNKNOWN_PRICE_BASIS', errcode='22023'");
  assert.notEqual(messageFirst, helperBody); assert.equal(pins.compareVocabulary(pins.extractVocabulary(messageFirst), pins.HELPER_VOCABULARY, pins.helperRaiseCheck(messageFirst)).equal, true, 'the same pair in the other argument order is still the same pair');
  const changedMessageFirst = helperBody.replace("errcode='22023', message='UNKNOWN_PRICE_BASIS'", "message='SOMETHING_NEW', errcode='22023'");
  assert.equal(pins.compareVocabulary(pins.extractVocabulary(changedMessageFirst), pins.HELPER_VOCABULARY, pins.helperRaiseCheck(changedMessageFirst)).equal, false, 'a changed message in the message-first layout is seen');
});
test('both need_candidate_states_v5 overloads name exactly the five helper messages in their swallow handler, parsed from the handler (not searched as text)', () => {
  assert.deepEqual(pins.swallowListMissing(ncs1Body), []); assert.deepEqual(pins.swallowListMissing(ncs2Body), []);
  for (const body of [ncs1Body, ncs2Body]) assert.deepEqual(pins.parseSwallowList(body), {handlers: 1, lists: 1, names: pins.HELPER_VOCABULARY.map(item => item.message)});
  // a forgotten name is reported (and the replacement is an EXTRA name, which is reported too)
  assert.deepEqual(pins.swallowListMissing(ncs1Body.replace("'UNKNOWN_PRICE_BASIS'", "'X'")), ['UNKNOWN_PRICE_BASIS', 'EXTRA:X']);
  // the name still appears in a comment or in another string literal: that is NOT in the list
  const forgotten = ncs1Body.replace(",\n            'TOTAL_PRICE_REQUIRES_ALL_SLOTS','UNKNOWN_PRICE_BASIS')", ")");
  assert.notEqual(forgotten, ncs1Body); assert.deepEqual(pins.swallowListMissing(forgotten), ['TOTAL_PRICE_REQUIRES_ALL_SLOTS', 'UNKNOWN_PRICE_BASIS']);
  const stillQuotedElsewhere = forgotten.replace('candidate_state:=\'STALE\';', "candidate_state:='STALE'; -- 'TOTAL_PRICE_REQUIRES_ALL_SLOTS' 'UNKNOWN_PRICE_BASIS'\n          perform 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', 'UNKNOWN_PRICE_BASIS';");
  assert.notEqual(stillQuotedElsewhere, forgotten); assert.deepEqual(pins.swallowListMissing(stillQuotedElsewhere), ['TOTAL_PRICE_REQUIRES_ALL_SLOTS', 'UNKNOWN_PRICE_BASIS'], 'a message quoted in a comment or another literal does not satisfy the gate');
  // the handler clause itself is pinned: only the two SQLSTATEs, exactly once
  const otherHandler = ncs1Body.replace("exception when sqlstate '22023' or sqlstate 'P0001' then", "exception when others then");
  assert.notEqual(otherHandler, ncs1Body); assert.match(pins.swallowListMissing(otherHandler)[0], /^HANDLER_CLAUSE_COUNT_0/);
  assert.match(pins.swallowListMissing('exception when sqlstate \'22023\' or sqlstate \'P0001\' then null;')[0] ?? '', /^SWALLOW_LIST_COUNT_0/);
  const twice = ncs1Body + '\n' + ncs1Body; assert.match(pins.swallowListMissing(twice).join(' '), /HANDLER_CLAUSE_COUNT_2/);
  assert.deepEqual(pins.swallowListMissing(ncs1Body.replace("-- Use the final", "-- sqlerrm not in ('A') Use the final")), [], 'a commented-out list is ignored');
});
test('the weakening anchor matches EXACTLY ONCE in the real replacement texts of pkg033a (submit #1, stale resolver #4, select #9) and in the whole reconstructed chain stale resolver', () => {
  const patches = pkg033aPatches(pkg033a);
  assert.equal(patches.length, 9);
  const wrap = body => 'CREATE OR REPLACE FUNCTION public.x()\n RETURNS jsonb\nAS $function$' + body + '$function$\n';
  const withPriceCall = patches.filter(patch => /perform\s+private\.assert_application_price_v5\s*\(/.test(patch.replacement));
  assert.deepEqual(withPriceCall.map(patch => patch.ord), [1, 4, 9], 'the three callers are exactly the blocks named by the review');
  for (const patch of withPriceCall) {
    const edited = lib.stripPriceCall(wrap(patch.replacement));
    assert.equal(edited.applied, true, 'block #' + patch.ord); assert.equal(edited.text.includes('assert_application_price_v5'), false);
    assert.equal(edited.text.replace('null;', ''), wrap(patch.replacement).replace(/perform\s+private\.assert_application_price_v5\s*\([^)]*\)\s*;/, ''), 'every other byte is kept: block #' + patch.ord);
  }
  const resolver = reconstructChainStaleResolver();
  assert.equal([...resolver.matchAll(/perform\s+private\.assert_application_price_v5\s*\([^)]*\)\s*;/g)].length, 1, 'the whole chain stale resolver calls the helper exactly once');
  assert.equal(lib.stripPriceCall(wrap(resolver)).applied, true);
  for (const body of [ncs1Body, ncs2Body]) assert.equal(lib.stripPriceCall(wrap(body)).applied, true, 'both need_candidate_states_v5 overloads call the helper exactly once');
});
/** The glob subset the workflow's path filter uses (GitHub: `**` any path, `*` within a segment, `?` one character). */
const globRegExp = pattern => new RegExp('^' + pattern.split('**').map(part => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')).join('.*') + '$');
const WORKFLOW = '../.github/workflows/pkg049-price-authority-characterization.yml';
function workflowPaths() {
  const lines = read(WORKFLOW).split('\n'), start = lines.findIndex(line => /^ {4}paths:\s*$/.test(line)); assert.ok(start >= 0, 'on.push.paths');
  const paths = []; for (let index = start + 1; index < lines.length; index++) { if (/^ {6}#/.test(lines[index])) continue; const match = /^ {6}- '(.+)'\s*$/.exec(lines[index]); if (!match) break; paths.push(match[1]); }
  assert.equal(new Set(paths).size, paths.length, 'no duplicate path entries');
  return paths;
}
test('the glob subset of the path filter matches what GitHub matches (and nothing else)', () => {
  const covered = (paths, file) => paths.some(path => globRegExp(path).test(file));
  assert.equal(covered(['a/b.sql'], 'a/b.sql'), true); assert.equal(covered(['a/b.sql'], 'a/b.sqlx'), false); assert.equal(covered(['a/b.sql'], 'x/a/b.sql'), false);
  assert.equal(covered(['a/**'], 'a/b/c.sql'), true); assert.equal(covered(['a/**'], 'ab/c.sql'), false); assert.equal(covered(['a/*.sql'], 'a/b.sql'), true); assert.equal(covered(['a/*.sql'], 'a/b/c.sql'), false);
  assert.equal(covered(['a/pkg*.sql'], 'a/pkg045a_x.sql'), true); assert.equal(covered(['a/pkg*.sql'], 'a/ex04d.sql'), false); assert.equal(covered(['a/?.sql'], 'a/b.sql'), true); assert.equal(covered(['a/?.sql'], 'a/bc.sql'), false);
});
test('the workflow path filter covers every file the proof reads or pins and every source the real client modules pull in', () => {
  const workflow = read(WORKFLOW), paths = workflowPaths();
  const covered = file => paths.some(path => globRegExp(path).test(file));
  const proof = read('proofs/pkg049/pkg049_proof.mjs');
  const named = [...proof.matchAll(/'((?:supabase|src)\/[A-Za-z0-9_./-]+)'/g)].map(match => match[1]);
  assert.ok(named.length >= 3, 'the proof names its candidate files'); for (const file of named) assert.ok(covered(file), 'not in the path filter: ' + file);
  const imported = [...proof.matchAll(/from '\.\.\/([A-Za-z0-9_]+\/[A-Za-z0-9_.]+)'/g)].map(match => 'supabase/proofs/' + match[1]);
  assert.equal(imported.length, 2); for (const file of imported) assert.ok(covered(file), 'not in the path filter: ' + file);
  for (const file of ['.github/workflows/pkg049-price-authority-characterization.yml', 'supabase/proofs/pkg049/pkg049_proof.mjs', 'supabase/candidates/pkg033a_application_admission_parity.sql', 'supabase/candidates/pkg035a_selectable_application_counts.sql',
    'supabase/candidates/ex04d_candidates_page.sql', 'supabase/candidates/b24_nonretried_conflicts_part1.sql', 'supabase/candidates/pkg051a_platform_price_list.sql', 'supabase/migrations/20260904214500_clean_ru4_owner_edit_lock.sql',
    'supabase/migrations/20260910130851_clean_w02_resolved_location_authority.sql', 'supabase/operations/dev-alpha/ledger/20260930_b24_part1_application.receipt.json', 'supabase/proofs/b24/b24_inventory.tsv']) assert.ok(covered(file), 'not in the path filter: ' + file);
  // the exact client sources the proof's loader reads (transitively): a change to any of them must re-run the proof
  const loader = loadModules({client: {rpc: async () => ({data: null, error: null})}, accountId: '00000000-0000-4000-8000-000000000001'});
  for (const name of lib.CLIENT_MODULES) loader.load(name);
  assert.ok(loader.sources.length >= 29, 'the loader pulled in the client module graph: ' + loader.sources.length);
  for (const source of loader.sources) assert.ok(covered(source.path), 'not in the path filter: ' + source.path);
  for (const name of ['pkg049_pins.test.mjs', 'pkg049_lib.test.mjs', 'pkg049_blocks.test.mjs', 'pkg049_proof.mjs', 'pkg049-report.json', 'pkg049-report.md']) assert.ok(workflow.includes(name), name);
  assert.ok(workflow.includes('node --test supabase/proofs/pkg049/*.test.mjs'));
  assert.ok(proof.includes('ff11ea470d2afa09b6651a5f1b55bc68d19578862841e12a4c83287924564a09'), 'the EX-04D candidate is pinned by sha256');
});
test('the workflow path filter covers every file that DEFINES the chain: the stage scripts and, transitively, every code or data file they name (migrations, candidates, ledger, replay and proof scripts)', () => {
  const workflow = read(WORKFLOW), paths = workflowPaths(), repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const covered = file => paths.some(pattern => globRegExp(pattern).test(file));
  const stages = [...workflow.matchAll(/run_stage\s+\S+\s+(?:node|python3|bash)\s+(\S+)/g)].map(match => match[1]);
  assert.equal(stages.length, 16, 'the sixteen replay stages of the workflow');
  const entries = [...stages, ...[...workflow.matchAll(/\bbash\s+(supabase\/\S+\.sh)/g)].map(match => match[1])];
  assert.ok(entries.includes('supabase/proofs/ru5_device_ui_live79_env.sh') && entries.includes('supabase/proofs/pkg023j/replay_source147.py') && entries.includes('supabase/proofs/pkg050/pkg050_proof.mjs'));
  // a code or data file only; a document that merely MENTIONS a path is not an input (markdown is never followed, nor is another workflow). References are followed out of CODE only: a path inside a data file
  // (a provenance record, an evidence list) or a SQL comment is metadata, while a data or SQL file that code names is itself an input and must be covered.
  const included = file => /\.(mjs|js|py|sh|sql|json|ts|tsv)$/.test(file) && !file.startsWith('.github/');
  const code = file => /\.(mjs|js|py|sh|ts)$/.test(file);
  const seen = new Set(), queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !included(file) || !existsSync(path.join(repoRoot, file))) continue;
    seen.add(file);
    if (!code(file)) continue;
    const text = readFileSync(path.join(repoRoot, file), 'utf8');
    for (const match of text.matchAll(/['"`]((?:supabase|src|scripts|docs)\/[A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+)['"`]/g)) queue.push(match[1]);
    for (const match of text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
  }
  assert.ok(seen.size >= 50, 'the stage scripts reach a real closure: ' + seen.size);
  for (const needle of ['supabase/proofs/pkg023j/replay_source147.py', 'supabase/candidates/pkg045a_task_read_contract.sql', 'supabase/candidates/pkg033a_application_admission_parity.sql', 'supabase/proofs/pkg050/pkg050_proof.mjs', 'supabase/proofs/pkg027/pkg027_proof.mjs']) assert.ok(seen.has(needle), 'the closure reaches ' + needle);
  const uncovered = [...seen].filter(file => !covered(file)).sort();
  assert.deepEqual(uncovered, [], 'files the chain depends on that are outside the workflow path filter (a change there alters the chain without re-running this evidence)');
  // the migrations are the base of the chain: every one of them is in the filter
  for (const file of readdirSync(path.join(repoRoot, 'supabase/migrations'))) assert.ok(covered('supabase/migrations/' + file), file);
});
