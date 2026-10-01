// Unit tests of the PINS side of the B09 / PKG-049 characterization proof (pins, the gate and its failure rule, the helper vocabulary, the B24 derivation, the workflow coverage).
// No database, no network: `node --test supabase/proofs/pkg049/*.test.mjs` (the workflow runs it after `npm ci`, because the workflow-coverage test loads the real client modules with ts_loader).
// They tie the pins to the SOURCE TEXT the repository stores (helper, both need_candidate_states_v5 overloads, the ru4 / w02 migrations and the pkg033a patches that build the two PRE-B24 bodies),
// the B24 conversion to the ledger 214 receipt, the helper vocabulary to the real helper body, and the weakening edits to the real caller texts.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as pins from './pkg049_pins.mjs';
import * as lib from './pkg049_lib.mjs';
import {loadModules} from '../ex04/ts_loader.mjs';

const read = relative => readFileSync(fileURLToPath(new URL('../../' + relative, import.meta.url)), 'utf8');   // relative to supabase/
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

test('the pinned md5 of the helper and of both need_candidate_states_v5 overloads equal the md5 of the body text the repository stores', () => {
  assert.equal(pins.md5Lf(helperBody), pin('helper').devMd5);
  assert.equal(pins.md5Lf(ncs1Body), pin('ncs_1').devMd5);
  assert.equal(pins.md5Lf(ncs2Body), pin('ncs_2').devMd5);
});
test('md5Lf removes carriage returns before hashing and every pin is a 32-hex md5 with a unique id and signature', () => {
  assert.equal(pins.md5Lf('a\r\nb'), pins.md5Lf('a\nb'));
  assert.equal(new Set(pins.PINS.map(item => item.id)).size, pins.PINS.length);
  assert.equal(new Set(pins.PINS.map(item => item.signature)).size, pins.PINS.length);
  for (const item of pins.PINS) { assert.ok(pins.isMd5(item.devMd5), item.id); if (item.knownChainMd5) assert.ok(pins.isMd5(item.knownChainMd5), item.id); }
  assert.deepEqual(pins.PINS.filter(item => item.group === 'core').map(item => item.id), ['submit', 'select', 'helper', 'stale_resolver', 'ncs_1', 'ncs_2', 'propose', 'respond']);
  assert.deepEqual(pins.PINS.filter(item => item.group === 'adjacent').map(item => item.id), ['selectable_count', 'guard_need_write', 'confirm_need_edit']);
  assert.deepEqual(pins.PINS.filter(item => item.knownChainMd5 !== undefined).map(item => item.id), ['stale_resolver', 'confirm_need_edit'], 'only the two PRE_B24 bodies may differ for a documented reason');
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
test('the in-proof B24 stage SQL is exactly the two price-chain functions, measures the derived md5 BEFORE executing, and keeps the certificate and attributes', () => {
  const text = pins.b24PriceChainSql();
  for (const target of pins.b24PriceChainTargets()) for (const needle of ["'" + target.signature + "'", "'" + target.preMd5 + "'", "'" + target.devMd5 + "'"]) assert.ok(text.includes(needle), needle);
  assert.equal(text.split('$pkg049_b24$').length - 1, 2); assert.equal(text.split('$f$').length - 1, 2);
  assert.ok(text.startsWith('begin;') && text.trimEnd().endsWith('commit;'));
  for (const guard of ['PKG049_B24_CERTIFICATE_NOT_READY', 'PKG049_B24_PREIMAGE_DRIFT', 'PKG049_B24_ALREADY_PT409', 'PKG049_B24_SITE_COUNT_DRIFT', 'PKG049_B24_DERIVATION_MISMATCH', 'PKG049_B24_POSTIMAGE_MISMATCH', 'PKG049_B24_ATTRIBUTES_CHANGED', 'PKG049_B24_CERTIFICATE_MOVED']) assert.ok(text.includes(guard), guard);
  assert.ok(text.indexOf('PKG049_B24_DERIVATION_MISMATCH') < text.indexOf('execute v_new'), 'the derived md5 is checked before anything is executed');
  assert.equal(text.includes('public.rpc_save_'), false, 'no other function of B24 Part 1'); assert.equal(text.split('rpc_resolve_stale_response_after_need_edit(').length - 1, 1); assert.equal(text.split('public.rpc_confirm_need_edit(').length - 1, 1);
  assert.equal(pins.b24PriceChainSql(value => '"' + value + '"').includes('"' + pin('stale_resolver').signature + '"'), true, 'the quoting function is used for every literal');
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
  assert.equal(clean.core.total, 8); assert.equal(clean.adjacent.total, 3);
  assert.match(pins.chainLabel(clean), /^CHAIN == DEV/); assert.equal(pins.gateExitCode(clean), 0);
  // the chain as it is without the in-proof stage: only the two documented PRE_B24 differences
  const known = {...equalAll, stale_resolver: pin('stale_resolver').knownChainMd5, confirm_need_edit: pin('confirm_need_edit').knownChainMd5};
  const knownGate = pins.classifyPins(known);
  assert.equal(pins.chainLabel(knownGate), 'CORE price chain 7/8 equal (stale_resolver PRE_B24); adjacent 2/3 equal (confirm_need_edit PRE_B24): the verdicts below hold for the CHAIN, not for DEV');
  assert.equal(knownGate.unexplained, 0); assert.equal(knownGate.core.unexplained, 0);
  // an unexplained core difference, a missing core pin and an unexplained adjacent difference
  const observed = {...equalAll, stale_resolver: pin('stale_resolver').knownChainMd5, submit: '0'.repeat(32), ncs_2: null, select: undefined, guard_need_write: '1'.repeat(32)};
  const gate = pins.classifyPins(observed);
  assert.deepEqual(gate.missing.map(item => item.id).sort(), ['ncs_2', 'select']);
  assert.deepEqual(gate.different.map(item => item.id).sort(), ['guard_need_write', 'stale_resolver', 'submit']);
  assert.equal(gate.different.find(item => item.id === 'stale_resolver').explanation.startsWith('PRE_B24'), true);
  assert.equal(gate.different.find(item => item.id === 'submit').explanation, 'UNEXPLAINED'); assert.equal(gate.unexplained, 2); assert.equal(gate.core.unexplained, 1); assert.equal(gate.adjacent.unexplained, 1);
  assert.equal(pins.chainLabel(gate), 'CORE price chain 4/8 equal (submit UNEXPLAINED, stale_resolver PRE_B24, select MISSING, ncs_2 MISSING); adjacent 2/3 equal (guard_need_write UNEXPLAINED): A CORE PIN IS MISSING OR DIFFERS WITHOUT AN EXPLANATION, THE PIN GATE FAILS THE RUN');
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
  assert.match(gate.label, /^CHAIN == DEV/); assert.equal(gate.equal.length, pins.PINS.length);
  const partial = pins.runPinGate(signature => { if (signature === pin('helper').signature) throw new Error('boom'); return dev[signature]; });
  assert.equal(pins.gateExitCode(partial), 2); assert.equal(partial.harness[0].id, 'helper'); assert.equal(partial.equal.length, pins.PINS.length - 1);
  const missingGate = pins.runPinGate(signature => (signature === pin('ncs_2').signature ? null : dev[signature]));
  const markdown = pins.renderPinGateMarkdown(missingGate, pins.evaluatePinGate(missingGate, {vocabulary: null, swallow: null}));
  assert.match(markdown, /\| ncs_2 \| core \| MISSING \|/); assert.match(markdown, /CORE price chain 7\/8 equal \(ncs_2 MISSING\)/); assert.match(markdown, /Gate verdict: FAIL \(CORE_PIN_MISSING ncs_2/);
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
test('both need_candidate_states_v5 overloads name all five helper messages in their swallow list, and a body that forgets one is reported', () => {
  assert.deepEqual(pins.swallowListMissing(ncs1Body), []); assert.deepEqual(pins.swallowListMissing(ncs2Body), []);
  assert.deepEqual(pins.swallowListMissing(ncs1Body.replace("'UNKNOWN_PRICE_BASIS'", "'X'")), ['UNKNOWN_PRICE_BASIS']);
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
test('the workflow path filter covers every file the proof reads or pins and every source the real client modules pull in', () => {
  const workflow = read('../.github/workflows/pkg049-price-authority-characterization.yml');
  const lines = workflow.split('\n'), start = lines.findIndex(line => /^ {4}paths:\s*$/.test(line)); assert.ok(start >= 0, 'on.push.paths');
  const paths = []; for (let index = start + 1; index < lines.length; index++) { const match = /^ {6}- '(.+)'\s*$/.exec(lines[index]); if (!match) break; paths.push(match[1]); }
  const covered = file => paths.some(path => path === file || (path.endsWith('/**') && file.startsWith(path.slice(0, -2))));
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
  for (const name of ['pkg049_pins.test.mjs', 'pkg049_lib.test.mjs', 'pkg049_proof.mjs', 'pkg049-report.json', 'pkg049-report.md']) assert.ok(workflow.includes(name), name);
  assert.ok(workflow.includes('node --test supabase/proofs/pkg049/*.test.mjs'));
  assert.ok(proof.includes('ff11ea470d2afa09b6651a5f1b55bc68d19578862841e12a4c83287924564a09'), 'the EX-04D candidate is pinned by sha256');
});
