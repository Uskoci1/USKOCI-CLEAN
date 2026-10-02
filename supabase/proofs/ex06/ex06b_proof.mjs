// EX-06 ex06b (S06: the certificate-neutral alias registry, the classification version and the F2 stem fix): FAIL-BEFORE / PASS-AFTER proof on a disposable DEV-equivalent chain, with actual Auth and
// PostgREST. NOTHING here ran yet (authored offline); a CI run is the first evidence. A disposable chain is NOT canonical DEV: the label of the report says so.
// One process, six phases (0-5) on ONE chain (source147 -> PKG-050, the unchanged ex04d-proven stages 03-18, then the ex06a candidate exactly as DEV has it):
//   0 CHAIN FIDELITY  the ex06a candidate (the generated file DEV was given) is applied, then every pin the ex06b candidate enforces (the target and eight neighbours, both callers among them) must equal the
//                     DEV md5 and so must the S03 pin gate of the functions the corpus depends on; the chain's body of private.work_kinds_v5 must be byte-equal to the DEV capture; the read-only DEV
//                     preflight returns no problem; the postflight REPORTS the unapplied state (a negative control); never faked, a difference stops here;
//   1 BEFORE          the REAL predecessor against the independent model on ~670 deterministic probes (every stem in six forms, Cyrillic, diacritics, splits, edges, seeded random words) and against the
//                     written intent of the corpus v1.1 (the cases that must FAIL before); the S03 corpus v1 (37 cases) and the additive v1.1 (8 cases) through the product path;
//   2 APPLY           refusals first (a drifted neighbour or target, a CRLF text, an uncertified closure, a key conflict, a drifted config table, a drifted attribute, an invalid registry text, a failing smoke
//                     probe, a wrong body md5), each leaving no trace; then the one atomic DO; a second run refused;
//   3 AFTER           the same probes (the new function against the new model, no old/new difference without a written delta), the written intent (every probe passes), the data edits (alias = data, invalid
//                     registries refused loudly, a twelfth kind row ignored), the exact delta (one function line, twelve rows, certificate unchanged), the S03 corpus (the difference is EXACTLY the written
//                     intended flips of T-031 = finding F2 closed) and the v1.1 (no finding left);
//   4 REVERT          refuses on the predecessor, with a CRLF text, with an edited registry and with an uncertified closure; restores the pins, the surface, the catalog and the data; probes, v1 and v1.1 return
//                     to the BEFORE state;
//   5 REAPPLY         the same bytes again: the same surface, catalog and rows, the same answers.
// No DEV, provider or device access: closure_runtime.mjs refuses any target that is not the loopback proof stack.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {loadModules} from '../ex04/ts_loader.mjs';
import {createFixtures} from './lib/fixtures.mjs';
import {loadCorpus} from './lib/s02_adapter.mjs';
import {normaliseCorpus} from './lib/corpus.mjs';
import {PROOF_POINT_PINS, evaluatePins, evidenceLabel, pinQuery, pinRowsOf} from './lib/pins.mjs';
import * as lib from './ex06b_lib.mjs';
import {createPassRunner} from './ex06b_passes.mjs';

const {assert, sql, rows, q, randomUUID, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');

const TARGET = lib.TARGET;
const candidate = readFileSync('supabase/candidates/ex06b_alias_registry.sql', 'utf8');
const revert = readFileSync('supabase/candidates/ex06b_alias_registry_revert.sql', 'utf8');
const preflight = readFileSync('supabase/proofs/ex06/ex06b_preflight.readonly.sql', 'utf8');
const postflight = readFileSync('supabase/proofs/ex06/ex06b_postflight.readonly.sql', 'utf8');
const ex06aCandidate = readFileSync('supabase/candidates/ex06a_flexible_window.sql', 'utf8');
const ex06aPostflight = readFileSync('supabase/proofs/ex06/ex06a_postflight.readonly.sql', 'utf8');
const devBody = readFileSync('supabase/proofs/ex06/s06/ex06b_work_kinds_v5_dev_body.txt', 'utf8').replace(/\r\n/g, '\n');
const corpusV1Text = readFileSync(lib.CORPUS_V1_PIN.path, 'utf8');
const corpusV11Text = readFileSync(lib.CORPUS_V11_PIN.path, 'utf8');
const corpusV11 = JSON.parse(corpusV11Text);
const outDir = env.PRE_V3_ARTIFACT_DIR ?? 'artifacts/ex06b';
mkdirSync(outDir, {recursive: true});
const reportPath = outDir + '/ex06b-report.json';
const md5 = text => createHash('md5').update(text).digest('hex');
const sha = text => createHash('sha256').update(text).digest('hex');
const trimmed = text => text.replace(/\n$/, '');
const newBody = lib.dollarLiteral(candidate, 'new_body'), NEW_MD5 = md5(newBody);
const rowsOfCandidate = lib.registryRowsOf(candidate);
const newStems = lib.stemsOf(rowsOfCandidate);
const pins = lib.parsePins(candidate);
const report = {package: 'EX-06 ex06b: certificate-neutral alias registry + classification version + F2 stem fix (private.work_kinds_v5 body + twelve private.marketplace_config rows, function and data only)',
  sourceSha: env.GITHUB_SHA, disposableDbOnly: true, devAccess: false, providerCalls: 0, evidenceLabel: 'DISPOSABLE CHAIN (source147 -> PKG-050 + ex06a), NOT canonical DEV', oldMd5: lib.OLD_MD5, newMd5: NEW_MD5,
  result: 'RUNNING', checks: [], notProven: [
    'behaviour on DEV data (none touched) and on DEV load: the hot path now reads twelve small config rows per classification call (not measured under load)',
    'a chain that differs from DEV in any function the pins do not cover',
    'real provider output (the facts and the evaluator decision of the product path are synthetic)',
    'push delivery and devices',
    'any case, alias or policy outcome for the kinds ELEKTRO and VODOINSTALATER (an open owner question): only the generic stem loops exercise their carried-over rows',
    'a real worker with an exclusion list (no writer exists, gap G04): the exclusion case uses the labelled bypass of the S03 harness',
    'concurrent edits of the registry while a dispatch wave runs',
    'carrying the classification version into the delivery payload (not part of this candidate)']};
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const pass = name => { report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name); };
const say = text => console.log(text);

// ------------------------------------------------------------------ database reads
const bodyMd5 = signature => sql(`select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = ${q(signature)}::regprocedure`);
const bodyText = signature => rows(`select replace(prosrc, chr(13), '') as body from pg_proc where oid = ${q(signature)}::regprocedure`)[0].body;
const closure = () => rows('select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified, private.retention_ai_source_ready() ready')[0];
const digests = () => rows(`select case when to_regprocedure('private.closure_schema_digest_v5_139()') is not null then private.closure_schema_digest_v5_139() end as schema_digest,
  case when to_regprocedure('private.closure_erasure_program_digest_v5()') is not null then private.closure_erasure_program_digest_v5() end as program_digest`)[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const catalog = () => rows(`select 'function:' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name, md5(replace(p.prosrc, chr(13), '')) as md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')
  union all select 'trigger:' || n.nspname || '.' || c.relname || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and not t.tgisinternal order by 1`);
const configRows = () => rows('select key, value, updated_at::text as updated_at from private.marketplace_config order by key');
const configFingerprint = () => sql(`select md5(coalesce(string_agg(c.key || chr(31) || c.value::text || chr(31) || c.updated_at::text, chr(30) order by c.key), '')) from private.marketplace_config c`);
const targetAttributes = () => rows(`select p.prosecdef, p.provolatile, p.proparallel, p.proisstrict, p.proconfig, p.proacl::text as acl, l.lanname, pg_get_userbyid(p.proowner) as owner, obj_description(p.oid, 'pg_proc') as comment
  from pg_proc p join pg_language l on l.oid = p.prolang where p.oid = ${q(TARGET)}::regprocedure`)[0];
const callerCount = () => Number(sql(`select count(*) from pg_proc p where p.prosrc like '%work_kinds_v5%' and p.oid <> ${q(TARGET)}::regprocedure`));
const lastJson = output => JSON.parse(output.split('\n').filter(line => line.startsWith('[') || line.startsWith('{')).pop());
const evalProbes = list => {
  const out = new Map();
  for (let i = 0; i < list.length; i += 250) for (const [id, kinds] of lib.probeResults(JSON.parse(sql(lib.probeSql(list.slice(i, i + 250), q))))) out.set(id, kinds);
  assert.equal(out.size, list.length, 'ALL_PROBES_ANSWERED');
  return out;
};

// ------------------------------------------------------------------ the corpora (the S03 runner on the real S02 corpus v1 and on the additive v1.1; lib/ is imported, never edited)
const mods = loadModules({client: null, accountId: null});
const registry = mods.load('contracts/needFactsV2').NEED_FACT_V2_DEFINITIONS;
const corpusV1 = loadCorpus(JSON.parse(corpusV1Text), {registry, label: 'CORPUS', normaliseNative: normaliseCorpus});
const corpusV11Normalised = normaliseCorpus(corpusV11, {registry, label: 'CORPUS'});
const fx = createFixtures(rt, {needPath: 'product'});
const records = {};
const record = (label, summary, findingKeys) => { records[label] = {...summary, findingKeys}; report.passes = records; save(); };
const passV1 = createPassRunner({fx, corpus: corpusV1, registry, sourceSha: env.GITHUB_SHA ?? null, bodyMd5, say, record, expectedCases: lib.CORPUS_V1_PIN.buildableCases});
const passV11 = createPassRunner({fx, corpus: corpusV11Normalised, registry, sourceSha: env.GITHUB_SHA ?? null, bodyMd5, say, record, expectedCases: corpusV11.cases.length});
const sameTimes = (reference, other, label) => assert.deepEqual(lib.corpusTimeProblems(reference.times, other.times, {referenceRebase: reference.summary.rebase, otherRebase: other.summary.rebase}), [],
  'THE_CORPUS_TIMES_AND_THE_REBASE_ARE_THE_SAME_IN_EVERY_PASS: ' + label);

async function main() {
  const closureStart = closure();
  assert.equal(closureStart.ready, true); assert.equal(closureStart.live, closureStart.certified);
  assert.deepEqual(lib.corpusV1PinProblems({path: lib.CORPUS_V1_PIN.path, text: corpusV1Text, ids: corpusV1.cases.map(item => item.id)}), [], 'THE_CORPUS_V1_IS_NOT_THE_PINNED_ONE');
  assert.deepEqual(lib.corpusV11PinProblems({path: lib.CORPUS_V11_PIN.path, text: corpusV11Text}), [], 'THE_CORPUS_V11_IS_NOT_THE_PINNED_ONE');
  assert.deepEqual(lib.corpusShapeProblems(corpusV11), [], 'CORPUS_V11_SHAPE');

  // ================================================================ 0 CHAIN FIDELITY
  assert.equal(bodyMd5(TARGET), lib.OLD_MD5, 'THE_CHAIN_CARRIES_THE_PKG031B_BODY');
  assert.equal(bodyText(TARGET), devBody, 'THE_CHAIN_BODY_IS_BYTE_EQUAL_TO_THE_DEV_CAPTURE');
  const oldStems = lib.parseOldBody(devBody);
  assert.deepEqual(lib.corpusSemanticProblems(corpusV11, {rows: rowsOfCandidate, oldStems}), [], 'CORPUS_V11_AGREES_WITH_THE_TWO_MODELS');
  assert.deepEqual(lib.registryProblems(rowsOfCandidate), []); assert.deepEqual(lib.stemProblems(rowsOfCandidate), []);
  sql(ex06aCandidate);
  const ex06aFlight = JSON.parse(sql(ex06aPostflight));
  assert.deepEqual(ex06aFlight.problems, [], 'EX06A_IS_APPLIED_ON_THE_CHAIN_EXACTLY_AS_ON_DEV'); report.ex06aOnTheChain = {postflightProblems: ex06aFlight.problems, pinsChecked: ex06aFlight.pinsChecked};
  report.chainFidelity = pins.map(pin => ({signature: pin.signature, pinDevMd5: pin.md5, chainMd5: bodyMd5(pin.signature)}));
  const differing = report.chainFidelity.filter(item => item.pinDevMd5 !== item.chainMd5);
  report.chainFidelityVerdict = differing.length ? 'CHAIN_DIFFERS_FROM_DEV: ' + differing.map(item => item.signature).join('; ') : `EQUAL: every pin the candidate enforces (the target + ${pins.length - 1} neighbours) equals the DEV md5 on the chain`;
  save();
  assert.deepEqual(differing, [], 'CHAIN_FIDELITY_FINDING: the chain does not carry the DEV predecessor; the candidate (exact pins) cannot be proven on it, and nothing is faked');
  const gatePins = PROOF_POINT_PINS.filter(pin => pin.name !== 'private.match_detail_without_calendar');   // that one moved with ex06a: it is a pin of this candidate (c8aaf3da)
  const gate = evaluatePins(rows(pinQuery(gatePins)), gatePins);
  report.s03PinGate = {label: evidenceLabel(gate, gatePins.length), equal: gate.equal.length, different: gate.different, missing: gate.missing, rows: pinRowsOf(gate, gatePins)};
  assert.deepEqual([gate.different, gate.missing], [[], []], 'S03_PIN_GATE_FINDING: ' + JSON.stringify(report.s03PinGate.rows.filter(row => row.verdict !== 'EQUAL')));
  assert.equal(callerCount(), 2, 'EXACTLY_TWO_FUNCTIONS_NAME_THE_TARGET');
  const flightBefore = JSON.parse(sql(preflight));
  assert.deepEqual(flightBefore.problems, [], 'THE_DEV_PREFLIGHT_FILE_IS_EMPTY_ON_THE_CHAIN'); report.preflight = flightBefore;
  const negative = JSON.parse(sql(postflight));
  assert.ok(negative.problems.some(item => item.kind === 'BODY_DRIFT') && negative.problems.some(item => item.kind === 'REGISTRY_INVALID') && negative.problems.filter(item => item.kind === 'SMOKE_PROBE').length === negative.smokeProbes,
    'THE_POSTFLIGHT_FILE_REPORTS_THE_UNAPPLIED_STATE (a negative control)');
  assert.equal(negative.problems.find(item => item.kind === 'CERTIFICATE'), undefined);
  await fx.reloadSchema();
  report.schedulers = fx.pauseSchedulers();
  pass('CHAIN_PREDECESSORS_EQUAL_THE_DEV_PINS_EX06A_APPLIED_PREFLIGHT_EMPTY_POSTFLIGHT_REPORTS_UNAPPLIED');

  const surfaceBefore = surface(), catalogBefore = catalog(), closureBefore = closure(), digestsBefore = digests(), configBefore = configRows(), configFingerprintBefore = configFingerprint(), attributesBefore = targetAttributes();
  assert.equal(closureBefore.ready, true); assert.equal(closureBefore.live, closureBefore.certified);
  report.certificateBefore = {...closureBefore, ...digestsBefore};
  const unchanged = (label, {config = true} = {}) => {
    assert.deepEqual(surface(), surfaceBefore, label + ': SURFACE_UNCHANGED');
    assert.equal(bodyMd5(TARGET), lib.OLD_MD5, label + ': TARGET_UNCHANGED');
    if (config) assert.equal(configFingerprint(), configFingerprintBefore, label + ': CONFIG_UNCHANGED');
    assert.deepEqual(closure(), closureBefore, label + ': CLOSURE_UNCHANGED');
  };

  // the written intent, as probes of their own (ids from 100000 up so that they never collide with the generated ones)
  const intent = [...corpusV11.kindProbes, ...corpusV11.acceptedConsequences].map((item, index) => ({id: 100000 + index, tag: 'intent', values: item.values, item}));
  const probes = lib.buildProbes({oldStems, newStems});
  const allProbes = [...probes, ...intent];
  report.probes = {generated: probes.length, intent: intent.length, byTag: Object.fromEntries([...new Set(probes.map(probe => probe.tag))].map(tag => [tag, probes.filter(probe => probe.tag === tag).length]))};

  // ================================================================ 1 BEFORE
  let started = Date.now();
  const before = evalProbes(allProbes);
  report.probeTimingMs = {before: Date.now() - started};
  assert.deepEqual(lib.probeProblems({probes: allProbes, results: before, oldStems, rows: rowsOfCandidate, state: 'before'}), [], 'BEFORE_THE_REAL_PREDECESSOR_EQUALS_THE_OLD_MODEL_ON_EVERY_PROBE');
  for (const probe of intent) assert.deepEqual(before.get(probe.id), probe.item.before ?? probe.item.expect, `BEFORE_THE_WRITTEN_BEFORE_HOLDS ${probe.item.id}`);
  const failBeforeIntent = intent.filter(probe => JSON.stringify(before.get(probe.id)) !== JSON.stringify(probe.item.expect)).map(probe => probe.item.id).sort();
  const writtenFailBefore = intent.filter(probe => probe.item.before !== undefined).map(probe => probe.item.id).sort();
  assert.deepEqual(failBeforeIntent, writtenFailBefore, 'BEFORE_EXACTLY_THE_WRITTEN_DELTA_PROBES_FAIL_THE_INTENT');
  assert.ok(failBeforeIntent.length >= 20, 'the fail-before set is not vacuous: ' + failBeforeIntent.length);
  report.failBeforeProbes = failBeforeIntent;
  pass('BEFORE_FUNCTION_LEVEL_THE_PREDECESSOR_IS_THE_OLD_MODEL_AND_THE_WRITTEN_DELTA_PROBES_FAIL');
  assert.throws(() => sql(revert), /EX06B_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  unchanged('REVERT_ON_THE_PREDECESSOR');
  pass('REVERT_REFUSES_ON_THE_PREDECESSOR_ATOMICALLY');
  const v1Before = await passV1('before-v1');
  const v11Before = await passV11('before-v11', {canary: false});
  const expectedFailBefore = lib.failBeforeFindings(corpusV11);
  assert.deepEqual(v11Before.findings, expectedFailBefore, 'BEFORE_V11_THE_FINDINGS_ARE_EXACTLY_THE_WRITTEN_FAIL_BEFORE_SET');
  assert.ok(expectedFailBefore.length >= 30);
  for (const key of lib.V1_FINDINGS_CLOSED) assert.ok(v1Before.findings.includes(key), 'F2_REPRODUCED_BEFORE ' + key);
  report.v11FailBefore = expectedFailBefore;
  pass('BEFORE_PRODUCT_PATH_F2_REPRODUCED_ON_T031_AND_THE_V11_CASES_FAIL_EXACTLY_AS_WRITTEN');

  // ================================================================ 2 APPLY: refusals first, each atomic
  const refused = (label, text, pattern) => { assert.throws(() => sql(text), pattern, label); unchanged(label); };
  const callers = ['private.dispatch_cheap_candidate_admitted(uuid,uuid)', 'private.match_detail_without_calendar(uuid,uuid)'];
  for (const signature of [...callers, 'private.dispatch_next_wave(uuid)', 'private.lower_arr(text[])']) {
    refused('PIN_DRIFT ' + signature, lib.tamperPin(candidate, signature), new RegExp('EX06B_PREDECESSOR_DRIFT: ' + signature.split('(')[0].replace('.', '\\.')));
  }
  refused('TARGET_PIN_DRIFT', lib.tamperPin(candidate, TARGET), /EX06B_PREDECESSOR_DRIFT: private\.work_kinds_v5/);
  pass('PREDECESSOR_DRIFT_REFUSED_ATOMICALLY_FOR_BOTH_CALLERS_A_NEIGHBOUR_AND_THE_TARGET');
  refused('CRLF', candidate.replace(/\n/g, '\r\n'), /EX06B_CRLF_TEXT/);
  pass('A_CRLF_TEXT_IS_REFUSED_ATOMICALLY');
  refused('UNCERTIFIED_CLOSURE', `begin; set local session_replication_role=replica; update private.closure_source_v5 set sha256=repeat('0',64) where singleton; ${candidate}\nrollback;`, /EX06B_CLOSURE_NOT_READY/);
  pass('UNCERTIFIED_CLOSURE_REFUSED_ATOMICALLY');
  refused('KEY_CONFLICT', `begin; insert into private.marketplace_config(key, value) values ('work_kinds_head', '{}'::jsonb); ${candidate}\nrollback;`, /EX06B_CONFIG_KEY_CONFLICT/);
  refused('KEY_CONFLICT_PREFIX', `begin; insert into private.marketplace_config(key, value) values ('work_kind_other', '{}'::jsonb); ${candidate}\nrollback;`, /EX06B_CONFIG_KEY_CONFLICT/);
  pass('A_PRESENT_KEY_OF_THE_NAMESPACE_REFUSES_THE_APPLICATION_ATOMICALLY');
  refused('CONFIG_TABLE_DRIFT', `begin; alter table private.marketplace_config add column ex06b_probe_extra text; ${candidate}\nrollback;`, /EX06B_CONFIG_TABLE_DRIFT/);
  pass('A_DRIFTED_CONFIG_TABLE_IS_REFUSED_ATOMICALLY');
  refused('ATTRIBUTE_DRIFT', `begin; alter function ${TARGET} stable; ${candidate}\nrollback;`, /EX06B_TARGET_ATTRIBUTE_DRIFT/);
  refused('COMMENT_DRIFT', `begin; comment on function ${TARGET} is 'changed'; ${candidate}\nrollback;`, /EX06B_TARGET_ATTRIBUTE_DRIFT/);
  pass('A_DRIFTED_TARGET_ATTRIBUTE_OR_COMMENT_IS_REFUSED_ATOMICALLY');
  refused('REGISTRY_TEXT', lib.replaceOnce(candidate, '"ofarb"', '"Ofarb"'), /EX06B_REGISTRY_TEXT_INVALID/);
  pass('A_REGISTRY_ROW_WITH_A_STEM_THE_FOLD_CANNOT_PRODUCE_IS_REFUSED_ATOMICALLY');
  refused('SMOKE_PROBE', lib.replaceOnce(candidate, "(array['ikee']::text[], array['MONTAZA_NAMESTAJA']::text[])", "(array['ikee']::text[], array['SITNE_POPRAVKE']::text[])"), /EX06B_SMOKE_PROBE_FAILED/);
  pass('A_FAILING_SMOKE_PROBE_ON_THE_LIVE_FUNCTION_ROLLS_THE_WHOLE_APPLICATION_BACK');
  refused('BODY_MD5', lib.replaceOnce(candidate, `new_md5 constant text := '${NEW_MD5}'`, `new_md5 constant text := '${'0'.repeat(32)}'`), /EX06B_TARGET_BODY_MISMATCH/);
  pass('A_WRONG_NEW_BODY_MD5_IS_CAUGHT_BY_THE_DELTA_ACCOUNTING_AND_ROLLS_BACK');

  // ================================================================ the application
  sql(candidate);
  assert.throws(() => sql(candidate), /EX06B_ALREADY_APPLIED/);
  pass('APPLIED_ONCE_SECOND_RUN_REFUSED');
  assert.equal(bodyMd5(TARGET), NEW_MD5);
  const surfaceAfter = surface(), catalogAfter = catalog(), digestsAfter = digests();
  const surfaceDelta = lib.surfaceDelta(surfaceBefore, surfaceAfter);
  assert.equal(surfaceDelta.onlyTheTarget, true, 'EXACTLY_ONE_SURFACE_LINE_CHANGED_THE_TARGET_IN_BODY_AND_VOLATILITY_ONLY: ' + JSON.stringify(surfaceDelta.names));
  report.surfaceRemoved = surfaceDelta.removed; report.surfaceAdded = surfaceDelta.added;
  const catalogDelta = lib.diffNamed(catalogBefore, catalogAfter);
  assert.deepEqual([catalogDelta.added, catalogDelta.removed], [[], []]);
  assert.equal(catalogDelta.changed.length, 1);
  assert.deepEqual([catalogDelta.changed[0].name.split('(')[0], catalogDelta.changed[0].before, catalogDelta.changed[0].after], ['function:private.work_kinds_v5', lib.OLD_MD5, NEW_MD5]);
  report.catalogChanged = catalogDelta.changed;
  const attributesAfter = targetAttributes();
  assert.deepEqual({...attributesAfter, lanname: attributesBefore.lanname, provolatile: attributesBefore.provolatile, comment: attributesBefore.comment}, attributesBefore, 'THE_ONLY_ATTRIBUTES_THAT_CHANGED_ARE_LANGUAGE_VOLATILITY_AND_COMMENT');
  assert.deepEqual([attributesBefore.lanname, attributesBefore.provolatile, attributesAfter.lanname, attributesAfter.provolatile], ['sql', 'i', 'plpgsql', 's']);
  assert.match(attributesAfter.comment, /EX-06 ex06b/);
  pass('EXACTLY_ONE_FUNCTION_CHANGED_NOTHING_ADDED_NOTHING_REMOVED_ATTRIBUTES_AND_ACL_EQUAL_EXCEPT_LANGUAGE_AND_VOLATILITY');
  const rowsAfter = configRows();
  assert.equal(rowsAfter.length, configBefore.length + 12, 'EXACTLY_TWELVE_ROWS_ADDED');
  assert.deepEqual(rowsAfter.filter(row => !row.key.startsWith('work_kind')), configBefore, 'EVERY_PRE_EXISTING_ROW_IS_UNTOUCHED_VALUE_AND_TIMESTAMP');
  assert.deepEqual(rowsAfter.filter(row => row.key.startsWith('work_kind')).map(row => ({key: row.key, value: row.value})).sort((a, b) => (a.key < b.key ? -1 : 1)), [...rowsOfCandidate].sort((a, b) => (a.key < b.key ? -1 : 1)));
  report.rowsAdded = rowsAfter.filter(row => row.key.startsWith('work_kind')).map(row => row.key);
  const rowsFingerprintAfter = lib.rowsFingerprint(rowsAfter.filter(row => row.key.startsWith('work_kind'))), configFingerprintAfter = configFingerprint();
  pass('THE_DATA_IS_EXACTLY_THE_TWELVE_SHIPPED_ROWS_AND_EVERY_OTHER_ROW_IS_UNTOUCHED');
  assert.deepEqual(closure(), closureBefore); assert.deepEqual(digestsAfter, digestsBefore);
  pass('CERTIFICATE_UNCHANGED_READY_AFTER_THE_APPLICATION_AND_THE_SCHEMA_AND_PROGRAM_DIGESTS_ARE_EQUAL');
  const flight = JSON.parse(sql(postflight));
  assert.deepEqual(flight.problems, []); assert.deepEqual(flight.informational, []); report.postflight = flight;
  assert.equal(flight.registryRows, 12); assert.equal(flight.classificationVersion, lib.CLASSIFICATION_VERSION); assert.equal(flight.pinsChecked, pins.length);
  assert.equal(flight.certifiedSource, closureBefore.certified);
  report.candidateSha256 = sha(trimmed(candidate)); report.revertSha256 = sha(trimmed(revert)); report.postflightSha256 = sha(trimmed(postflight)); report.preflightSha256 = sha(trimmed(preflight));
  pass('DEV_POSTFLIGHT_FILE_EMPTY_ON_THE_CHAIN');
  assert.throws(() => sql(revert.replace(/\n/g, '\r\n')), /EX06B_REVERT_CRLF_TEXT/);
  assert.equal(bodyMd5(TARGET), NEW_MD5);
  pass('A_CRLF_REVERT_IS_REFUSED_ATOMICALLY');

  // ================================================================ 3 AFTER
  started = Date.now();
  const after = evalProbes(allProbes);
  report.probeTimingMs.after = Date.now() - started;
  assert.deepEqual(lib.probeProblems({probes: allProbes, results: after, oldStems, rows: rowsOfCandidate, state: 'after'}), [], 'AFTER_THE_REAL_NEW_FUNCTION_EQUALS_THE_NEW_MODEL_ON_EVERY_PROBE');
  for (const probe of intent) assert.deepEqual(after.get(probe.id), probe.item.expect, `AFTER_THE_WRITTEN_INTENT_HOLDS ${probe.item.id}`);
  const unexplained = lib.unexplainedDifferences({probes: allProbes, before, after, oldStems, newStems});
  assert.deepEqual(unexplained, [], 'EVERY_DIFFERENCE_BETWEEN_THE_OLD_AND_THE_NEW_FUNCTION_IS_A_WRITTEN_DELTA');
  const changedProbes = allProbes.filter(probe => JSON.stringify(before.get(probe.id)) !== JSON.stringify(after.get(probe.id)));
  const differingStems = {added: Object.values(lib.STEMS_ADDED).flat().filter(stem => probes.some(probe => probe.tag === 'stem' && probe.values[0] === stem && JSON.stringify(before.get(probe.id)) !== JSON.stringify(after.get(probe.id)))),
    removed: Object.values(lib.STEMS_REMOVED).flat().filter(stem => probes.some(probe => probe.tag === 'stem' && probe.values[0] === stem && JSON.stringify(before.get(probe.id)) !== JSON.stringify(after.get(probe.id))))};
  assert.deepEqual(differingStems.added.sort(), Object.values(lib.STEMS_ADDED).flat().sort(), 'EVERY_ADDED_STEM_CHANGES_AN_ANSWER');
  assert.deepEqual(differingStems.removed, ['sklapanj'], 'THE_REMOVED_STEM_CHANGES_AN_ANSWER');
  assert.ok(changedProbes.length >= 150, 'the comparison is not vacuous: ' + changedProbes.length + ' probes differ');
  report.probeDifferences = {total: changedProbes.length, ...differingStems, cyrillic: changedProbes.filter(probe => (probe.values ?? []).some(value => value !== null && lib.hasCyrillic(value))).length};
  pass('AFTER_FUNCTION_LEVEL_THE_NEW_FUNCTION_IS_THE_NEW_MODEL_THE_WRITTEN_INTENT_HOLDS_AND_NO_LATIN_TEXT_CHANGED_WITHOUT_A_WRITTEN_DELTA');
  // data edits: every one inside a transaction that is rolled back
  const edits = {};
  for (const edit of lib.dataEditPlan()) {
    if (edit.expect.error) assert.throws(() => sql(edit.sql), new RegExp(edit.expect.error), edit.name);
    else assert.deepEqual(lastJson(sql(edit.sql)), edit.expect.json, edit.name);
    assert.equal(configFingerprint(), configFingerprintAfter, edit.name + ': ROLLED_BACK_TIMESTAMPS_INCLUDED');
    edits[edit.name] = 'PASS';
  }
  assert.equal(bodyMd5(TARGET), NEW_MD5); assert.deepEqual(closure(), closureBefore);
  report.dataEdits = edits;
  pass('AFTER_THE_REGISTRY_IS_DATA_AN_ALIAS_IS_A_ROW_EDIT_AN_INVALID_REGISTRY_IS_REFUSED_LOUDLY_AND_A_TWELFTH_KIND_ROW_IS_IGNORED');
  // the product path
  const v1After = await passV1('after-v1');
  sameTimes(v1Before, v1After, 'after-v1');
  const flips = lib.checkFlips(lib.diffOutcomes(v1Before.outcomes, v1After.outcomes), lib.V1_INTENDED_FLIPS);
  report.corpusFlips = {matched: flips.matched.length, unintended: flips.unintended, missing: flips.missing};
  assert.deepEqual(flips.unintended, [], 'UNINTENDED_FLIPS_ON_THE_CORPUS_V1');
  assert.deepEqual(flips.missing, [], 'INTENDED_FLIPS_MISSING_ON_THE_CORPUS_V1');
  assert.equal(flips.matched.length, lib.V1_INTENDED_FLIPS.length);
  const detailProblems = lib.corpusDetailProblems(v1Before.details, v1After.details);
  report.corpusDetailProblems = detailProblems;
  assert.deepEqual(detailProblems, [], 'THE_FULL_MATCH_DETAIL_OF_EVERY_V1_WORKER_CHANGED_ONLY_AS_INTENDED');
  const closed = v1Before.findings.filter(key => !v1After.findings.includes(key)), added = v1After.findings.filter(key => !v1Before.findings.includes(key));
  assert.deepEqual(added, [], 'NO_NEW_FINDING_AFTER_THE_CANDIDATE');
  assert.deepEqual([...closed].sort(), [...lib.V1_FINDINGS_CLOSED].sort(), 'THE_FINDINGS_THE_CANDIDATE_CLOSES_ARE_EXACTLY_THE_THREE_OF_F2');
  report.findingsClosed = closed;
  pass('AFTER_CORPUS_V1_THE_ONLY_DIFFERENCES_ARE_THE_WRITTEN_INTENDED_FLIPS_OF_T031_F2_CLOSED_EVERYTHING_ELSE_IDENTICAL_FULL_DETAIL_INCLUDED');
  const v11After = await passV11('after-v11', {canary: false});
  sameTimes(v11Before, v11After, 'after-v11');
  assert.deepEqual(v11After.findings, [], 'AFTER_V11_NO_FINDING_REMAINS');
  const v11Flips = lib.checkFlips(lib.diffOutcomes(v11Before.outcomes, v11After.outcomes), lib.v11IntendedFlips(corpusV11));
  assert.deepEqual([v11Flips.unintended, v11Flips.missing], [[], []], 'V11_DIFFERENCES_ARE_EXACTLY_THE_WRITTEN_ONES');
  assert.deepEqual(lib.corpusDetailProblems(v11Before.details, v11After.details, lib.v11DetailExpectations(corpusV11)), [], 'THE_FULL_MATCH_DETAIL_OF_EVERY_V11_WORKER_CHANGED_ONLY_AS_WRITTEN');
  report.v11Flips = v11Flips.matched.length;
  pass('AFTER_CORPUS_V11_EVERY_CASE_PASSES_AND_THE_DIFFERENCE_TO_BEFORE_IS_EXACTLY_THE_WRITTEN_FLIPS_HARD_EXCLUSION_INCLUDED');
  assert.deepEqual(closure(), closureBefore); assert.deepEqual(surface(), surfaceAfter); assert.equal(lib.rowsFingerprint(configRows().filter(row => row.key.startsWith('work_kind'))), rowsFingerprintAfter);
  pass('CERTIFICATE_SURFACE_AND_REGISTRY_STAY_AFTER_THE_READS_AND_THE_DATA_WRITES_OF_THE_FIXTURES');

  // ================================================================ 4 REVERT
  assert.throws(() => sql(`begin; update private.marketplace_config set value = jsonb_set(value, '{stems}', value -> 'stems' || '"qwxzaa"'::jsonb) where key = 'work_kind:CISCENJE'; ${revert}\nrollback;`), /EX06B_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  assert.equal(bodyMd5(TARGET), NEW_MD5); assert.equal(lib.rowsFingerprint(configRows().filter(row => row.key.startsWith('work_kind'))), rowsFingerprintAfter);
  assert.throws(() => sql(`begin; set local session_replication_role=replica; update private.closure_source_v5 set sha256=repeat('0',64) where singleton; ${revert}\nrollback;`), /EX06B_REVERT_CLOSURE_NOT_READY/);
  assert.equal(bodyMd5(TARGET), NEW_MD5); assert.deepEqual(closure(), closureBefore);
  pass('REVERT_REFUSES_AN_EDITED_REGISTRY_AND_AN_UNCERTIFIED_CLOSURE_ATOMICALLY');
  sql(revert);
  assert.equal(bodyMd5(TARGET), lib.OLD_MD5);
  assert.deepEqual(surface(), surfaceBefore, 'THE_WHOLE_SURFACE_IS_RESTORED_EXACTLY');
  assert.deepEqual(catalog(), catalogBefore, 'THE_WHOLE_CATALOG_IS_RESTORED_EXACTLY');
  assert.deepEqual(configRows(), configBefore, 'THE_CONFIG_DATA_IS_RESTORED_EXACTLY_TIMESTAMPS_INCLUDED');
  assert.deepEqual(targetAttributes(), attributesBefore, 'THE_TARGET_ATTRIBUTES_AND_COMMENT_ARE_RESTORED');
  assert.deepEqual(closure(), closureBefore); assert.deepEqual(digests(), digestsBefore);
  assert.throws(() => sql(revert), /EX06B_REVERT_STATE_NOT_THE_APPLIED_ONE/);
  pass('REVERT_RESTORES_THE_MD5_PIN_THE_SURFACE_THE_CATALOG_THE_DATA_AND_THE_ATTRIBUTES_AND_REFUSES_TO_RUN_TWICE');
  const reverted = evalProbes(allProbes);
  for (const probe of allProbes) assert.deepEqual(reverted.get(probe.id), before.get(probe.id), `REVERTED_PROBE ${probe.id}`);
  const v1Reverted = await passV1('reverted-v1');
  sameTimes(v1Before, v1Reverted, 'reverted-v1');
  assert.deepEqual(lib.diffOutcomes(v1Before.outcomes, v1Reverted.outcomes), [], 'REVERTED_CORPUS_EQUALS_BEFORE');
  assert.deepEqual(lib.corpusDetailProblems(v1Before.details, v1Reverted.details, {}), [], 'REVERTED_DETAILS_EQUAL_BEFORE');
  assert.deepEqual(v1Reverted.findings, v1Before.findings);
  const v11Reverted = await passV11('reverted-v11', {canary: false});
  assert.deepEqual(v11Reverted.findings, v11Before.findings);
  assert.deepEqual(lib.diffOutcomes(v11Before.outcomes, v11Reverted.outcomes), []);
  pass('REVERTED_PROBES_CORPUS_V1_AND_V11_EQUAL_THE_BEFORE_STATE_EVERY_CASE_WORKER_REFUSAL_DELIVERY_AND_FULL_DETAIL');

  // ================================================================ 5 REAPPLY
  sql(candidate);
  assert.equal(bodyMd5(TARGET), NEW_MD5);
  assert.deepEqual(surface(), surfaceAfter, 'REAPPLY_PRODUCES_THE_SAME_SURFACE');
  assert.deepEqual(catalog(), catalogAfter, 'REAPPLY_PRODUCES_THE_SAME_CATALOG');
  assert.equal(lib.rowsFingerprint(configRows().filter(row => row.key.startsWith('work_kind'))), rowsFingerprintAfter, 'REAPPLY_PRODUCES_THE_SAME_ROWS');
  assert.deepEqual(configRows().filter(row => !row.key.startsWith('work_kind')), configBefore);
  assert.deepEqual(closure(), closureBefore);
  const flightAgain = JSON.parse(sql(postflight));
  assert.deepEqual([flightAgain.problems, flightAgain.informational], [[], []]);
  const again = evalProbes(allProbes);
  for (const probe of allProbes) assert.deepEqual(again.get(probe.id), after.get(probe.id), `REAPPLIED_PROBE ${probe.id}`);
  const v11Again = await passV11('reapplied-v11', {canary: true});
  assert.deepEqual(v11Again.findings, []);
  assert.deepEqual(lib.diffOutcomes(v11After.outcomes, v11Again.outcomes), []);
  const v1Again = await passV1('reapplied-v1-t031', {caseIds: ['T-031'], canary: false});
  assert.deepEqual(lib.diffOutcomes({'T-031': v1After.outcomes['T-031']}, v1Again.outcomes), []);
  assert.deepEqual(lib.corpusDetailProblems(Object.fromEntries(Object.entries(v1After.details).filter(([key]) => key.startsWith('T-031|'))), v1Again.details, {}), []);
  pass('REAPPLY_AGAIN_EQUAL_SURFACE_CATALOG_ROWS_PROBES_V11_AND_THE_T031_FLIP');
  report.certificateAfter = {...closure(), ...digests()};
  report.result = 'PASS'; save();
}
main().catch(error => { report.result = 'FAIL'; report.failure = String(error?.stack ?? error).slice(0, 4000); save(); console.error(report.failure); process.exit(1); });
