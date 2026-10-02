// Offline unit tests of the D12 pin gate (node --test supabase/proofs/d12/*.test.mjs). No database, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as pins from './d12_pins.mjs';

const pinsText = readFileSync('supabase/proofs/d12/d12_pins.json', 'utf8');
const files = {application: readFileSync('supabase/candidates/d12_review_comment.sql', 'utf8'), revert: readFileSync('supabase/candidates/d12_review_comment_revert.sql', 'utf8'),
  preflight: readFileSync('supabase/proofs/d12/d12_preflight.readonly.sql', 'utf8'), postflight: readFileSync('supabase/proofs/d12/d12_postflight.readonly.sql', 'utf8')};
const rowsOf = () => pins.loadPins(pinsText);
const observationsEqualToDev = () => rowsOf().map(row => ({signature: row.signature, exists: true, bodyMd5: row.bodyMd5, metadataMd5: row.composite ? 'f'.repeat(32) : row.metadataMd5, maskedLiteralCount: row.masked ? 1 : null}));
const flip = md5 => (md5[0] === '0' ? '1' : '0') + md5.slice(1);
const withChange = (signature, kinds) => observationsEqualToDev().map(item => item.signature !== signature ? item : {...item, bodyMd5: kinds.includes('body') ? flip(item.bodyMd5) : item.bodyMd5, metadataMd5: kinds.includes('metadata') ? flip(item.metadataMd5) : item.metadataMd5});

test('the pins file loads: 47 pins, valid md5, composite signatures pinned by body only, no duplicate', () => {
  const rows = rowsOf(); assert.equal(rows.length, 47);
  assert.equal(rows.filter(row => row.composite).length, 3); for (const row of rows) { assert.match(row.bodyMd5, /^[a-f0-9]{32}$/); if (!row.composite) assert.match(row.metadataMd5, /^[a-f0-9]{32}$/); }
  assert.throws(() => pins.loadPins(JSON.stringify({unit: 'D12_PINS', rows: [...JSON.parse(pinsText).rows, JSON.parse(pinsText).rows[0]]})), /D12_PIN_DUPLICATE/);
  assert.throws(() => pins.loadPins(JSON.stringify({unit: 'OTHER', rows: []})), /D12_PINS_FILE_SHAPE/);
});

test('every CORE signature is a pin, the seven rewritten functions and the nine legacy review functions are core, and the world helpers are adjacent', () => {
  const rows = rowsOf(), signatures = new Set(rows.map(row => row.signature));
  for (const signature of pins.CORE_SIGNATURES) assert.ok(signatures.has(signature), 'a pin exists for the core signature ' + signature);
  const group = signature => rows.find(row => row.signature === signature).group;
  for (const signature of ['private.closure_redaction_relations_v5()', 'private.closure_redaction_scope_v5(text)', 'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)', 'private.retention_ai_source_ready()', 'private.data_export_dataset_catalog()',
    'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', 'private.data_export_policy_binding()', 'public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)', 'public.rpc_get_my_agreement_review(uuid)', 'public.rpc_get_public_profile(uuid)']) assert.equal(group(signature), 'core', signature);
  for (const signature of ['private.accounts_same_world(uuid,uuid)', 'private.account_visibility_world(uuid)', 'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)', 'public.rpc_home_attention()']) assert.equal(group(signature), 'adjacent', signature);
});

test('chainReadSql names every pin once and uses the same formulas as the generated preflight', () => {
  const rows = rowsOf(), sql = pins.chainReadSql(rows, value => "'" + value + "'");
  for (const row of rows) assert.equal(sql.split("('" + row.signature + "')").length - 1, 1, row.signature);
  assert.match(sql, /md5\(replace\(p\.prosrc, E'\\r\\n', E'\\n'\)\)/);
  for (const fragment of ["to_jsonb(p) - 'oid' - 'pronamespace' - 'proowner' - 'prolang' - 'proacl' - 'prosrc'", "'namespace', n.nspname", "'owner', pg_get_userbyid(p.proowner)", "'language', l.lanname", "'acl', p.proacl::text"]) assert.ok(sql.includes(fragment), fragment);
  assert.ok(files.preflight.includes("(to_jsonb(p)-'oid'-'pronamespace'-'proowner'-'prolang'-'proacl'-'prosrc')") && files.preflight.includes("'acl',p.proacl::text"), 'the preflight uses the same metadata formula');
});

test('the gate: all equal reads "== DEV" for the pinned functions and still says the chain is NOT DEV', () => {
  const gate = pins.classifyPins(rowsOf(), observationsEqualToDev()), evaluation = pins.evaluatePinGate(gate);
  assert.equal(gate.equal.length, 47); assert.deepEqual(gate.different, []); assert.deepEqual(gate.missing, []); assert.equal(evaluation.ok, true);
  assert.match(pins.gateLabelShort(gate), /^D12 PINS == DEV \(47\/47 pinned functions equal in body and metadata; the chain is NOT DEV\)$/);
  assert.match(pins.gateLabel(gate), /nothing else is claimed: the chain lacks pkg051a/); assert.ok(!/CORE PIN/.test(pins.gateLabel(gate)));
});

test('the gate FAILS on a core difference, a missing pin and on every UNEXPLAINED adjacent difference; an EXPLAINED adjacent difference warns and uses the chain variant', () => {
  const core = pins.classifyPins(rowsOf(), withChange('public.rpc_get_public_profile(uuid)', ['body'])), coreEval = pins.evaluatePinGate(core);
  assert.equal(coreEval.ok, false); assert.match(coreEval.failures.join(';'), /CORE_PIN_UNEXPLAINED_DIFFERENCE public\.rpc_get_public_profile\(uuid\) \(body\)/); assert.match(pins.gateLabelShort(core), /THE PIN GATE FAILS THE RUN/);
  const metadataOnly = pins.classifyPins(rowsOf(), withChange('private.closure_account_key(uuid)', ['metadata'])); assert.equal(pins.evaluatePinGate(metadataOnly).ok, false, 'a metadata difference of a core function fails too');
  const adjacent = pins.classifyPins(rowsOf(), withChange('private.accounts_same_world(uuid,uuid)', ['body', 'metadata'])), adjacentEval = pins.evaluatePinGate(adjacent);
  assert.equal(adjacentEval.ok, false, 'round-1 finding: an adjacent chain difference without an explanation is red'); assert.match(adjacentEval.failures.join(';'), /ADJACENT_PIN_UNEXPLAINED_DIFFERENCE private\.accounts_same_world\(uuid,uuid\) \(body\+metadata\)/); assert.equal(adjacentEval.warnings.length, 0);
  assert.deepEqual(adjacent.adjacent.different[0].kinds, ['body', 'metadata']);
  const explained = pins.classifyPins(rowsOf(), withChange('private.accounts_same_world(uuid,uuid)', ['body', 'metadata']), {'private.accounts_same_world(uuid,uuid)': 'observed: the chain helper is another body'}), explainedEval = pins.evaluatePinGate(explained);
  assert.equal(explainedEval.ok, true); assert.equal(explainedEval.warnings.length, 1); assert.match(explainedEval.warnings[0], /^ADJACENT_PIN_EXPLAINED_DIFFERENCE private\.accounts_same_world\(uuid,uuid\) \(body\+metadata\): observed: the chain helper is another body$/);
  assert.equal(pins.appliesTheCommittedBytes(explained), false, 'a variant is never the committed bytes'); assert.equal(pins.appliesTheCommittedBytes(pins.classifyPins(rowsOf(), observationsEqualToDev())), true, 'all pins equal: the committed bytes are applied');
  assert.deepEqual(Object.keys(pins.EXPLAINED_CHAIN_DIFFERENCES), [], 'no difference is explained until it has been OBSERVED, written down and reviewed');
  assert.ok(!/== DEV/.test(pins.gateLabelShort(adjacent)), 'a difference never reads as "== DEV"'); assert.match(pins.gateLabelShort(adjacent), /adjacent \d+\/\d+ equal \(differs: private\.accounts_same_world\)/);
  const missing = observationsEqualToDev().map(item => item.signature === 'private.accounts_same_world(uuid,uuid)' ? {signature: item.signature, exists: false} : item), gate = pins.classifyPins(rowsOf(), missing);
  assert.equal(pins.evaluatePinGate(gate).ok, false, 'an adjacent helper the candidate leans on must exist'); assert.match(pins.evaluatePinGate(gate).failures[0], /ADJACENT_PIN_MISSING/);
  const unread = pins.classifyPins(rowsOf(), observationsEqualToDev().slice(1)); assert.equal(pins.evaluatePinGate(unread).ok, false, 'an unread pin is a harness failure, never a pass'); assert.match(pins.gateLabelShort(unread), /HARNESS BROKEN/);
  const malformed = pins.classifyPins(rowsOf(), observationsEqualToDev().map((item, index) => index === 0 ? {...item, bodyMd5: 'nope'} : item)); assert.equal(pins.evaluatePinGate(malformed).ok, false);
});

test('the pin literals sit exactly where the chain variant looks for them (once per file); the readiness body is pinned by its MASKED fingerprint only (its raw DEV md5 appears nowhere)', () => {
  const rows = rowsOf(), count = (text, literal) => pins.occurrences(text, literal);
  for (const row of rows) {
    const readiness = row.signature === 'private.retention_ai_source_ready()';
    // the masked fingerprint is compared once in the application, the preflight and the postflight and twice in the revert (applied-state check and re-bind check); the raw DEV md5 of the readiness body is never a literal anywhere
    assert.equal(count(files.application, row.bodyMd5), 1, 'application body ' + row.signature); assert.equal(count(files.preflight, row.bodyMd5), 1, 'preflight body ' + row.signature); assert.equal(count(files.revert, row.bodyMd5), readiness ? 2 : 1, 'revert body ' + row.signature);
    if (readiness) for (const name of ['application', 'preflight', 'revert', 'postflight']) assert.equal(count(files[name], row.devRawBodyMd5), 0, name + ': the raw DEV md5 of the readiness body (it carries the DEV digest) is not a pin');
    if (!row.composite) { for (const name of ['application', 'preflight', 'revert', 'postflight']) assert.equal(count(files[name], row.metadataMd5), 1, name + ' metadata ' + row.signature); }
    const rewritten = ['private.closure_redaction_relations_v5()', 'private.closure_redaction_scope_v5(text)', 'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)', 'private.data_export_dataset_catalog()', 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', 'private.data_export_policy_binding()'].includes(row.signature);
    assert.equal(count(files.postflight, row.bodyMd5), readiness ? 1 : rewritten ? 0 : 1, 'postflight body ' + row.signature);
  }
});

test('the chain variant replaces ONLY the md5 literals of a differing adjacent pin, counts every replacement, and is reversible', () => {
  const rows = rowsOf(), signature = 'private.accounts_same_world(uuid,uuid)', gate = pins.classifyPins(rows, withChange(signature, ['body', 'metadata']));
  for (const name of ['application', 'preflight', 'revert']) {
    const variant = pins.buildChainVariant(files[name], gate, {requireFound: true});
    assert.deepEqual(variant.applied.map(item => [item.signature, item.kind, item.replaced]), [[signature, 'body', 1], [signature, 'metadata', 1]], name);
    assert.ok(pins.variantDiffersOnlyAtPins(files[name], variant.text, variant.applied)); assert.notEqual(variant.text, files[name]);
    assert.equal(variant.text.length, files[name].length, 'a md5 replaces a md5: the length is unchanged'); assert.equal(variant.text.split('\n').length, files[name].split('\n').length);
  }
  assert.equal(pins.buildChainVariant(files.application, pins.classifyPins(rows, observationsEqualToDev())).text, files.application, 'no difference, no change: the DEV file is applied as it is');
  assert.ok(!pins.variantDiffersOnlyAtPins(files.application, files.application + ' ', []), 'any other edit is detected');
  // a CORE difference is never rewritten into the file (the gate fails the run instead)
  const core = pins.classifyPins(rows, withChange('public.rpc_get_public_profile(uuid)', ['body'])); assert.equal(pins.buildChainVariant(files.application, core).text, files.application);
  // a pin that the file does not carry cannot be silently ignored when the caller requires it
  const ghost = {adjacent: {different: [{signature: 'x', kinds: ['body'], devBodyMd5: '9'.repeat(32), chainBodyMd5: '8'.repeat(32)}]}}; assert.throws(() => pins.buildChainVariant(files.application, ghost, {requireFound: true}), /CHAIN_VARIANT_PIN_NOT_FOUND/);
});

test('the candidate files the proof applies carry the DEV pins and the post-state pins the application asserts', () => {
  for (const sha of [/data_export_projection_sha_v5\(\) is distinct from '([0-9a-f]{64})'/g]) assert.equal([...files.application.matchAll(sha)].length, 2, 'the application checks the projection sha before and after');
  assert.match(files.revert, /target_source constant text := '[0-9a-f]{64}'/); assert.ok(files.application.includes('D12_APPLICATION_DIGEST_NOT_ISOLATED') && files.application.includes('D12_ISOLATION_PROBE'));
  for (const name of ['D12_REVERT_COMMENTS_PRESENT', 'D12_REVERT_CLOSURE_HISTORY_PRESENT', 'D12_REVERT_CLOSURE_IN_FLIGHT', 'D12_REVERT_APPLIED_STATE_NOT_CERTIFIED', 'D12_REVERT_NEW_FUNCTION_DRIFT', 'D12_REVERT_APPLIED_BODY_DRIFT', 'D12_REVERT_NOT_APPLIED',
    'D12_REVERT_RETENTION_CLASS_DRIFT', 'D12_REVERT_RETENTION_CLASSES_DELTA']) assert.ok(files.revert.includes("'" + name), name);
  for (const name of ['D12_APPLICATION_BODY_DRIFT', 'D12_APPLICATION_METADATA_DRIFT', 'D12_APPLICATION_CLOSURE_PREDECESSOR_NOT_READY', 'D12_APPLICATION_ALREADY_PRESENT', 'D12_APPLICATION_REWRITTEN_BODY_DELTA', 'D12_APPLICATION_CLOSURE_IN_FLIGHT',
    'D12_APPLICATION_STAR_TABLE_DRIFT', 'D12_APPLICATION_COMPOSITE_METADATA_DRIFT', 'D12_APPLICATION_RETENTION_CLASS_PREDECESSOR_DRIFT', 'D12_APPLICATION_RETENTION_CLASSES_DELTA', 'D12_APPLICATION_COMMENT_TABLE_PUBLISHED']) assert.ok(files.application.includes("'" + name), name);
});

test('the pin gate markdown names every difference and never calls the chain DEV', () => {
  const gate = pins.classifyPins(rowsOf(), withChange('private.accounts_same_world(uuid,uuid)', ['body']), {'private.accounts_same_world(uuid,uuid)': 'observed reason'}), text = pins.renderPinGateMarkdown(gate, pins.evaluatePinGate(gate));
  assert.match(text, /private\.accounts_same_world\(uuid,uuid\) \| adjacent \| DIFFERENT \(body\)/); assert.match(text, /Gate verdict: PASS/); assert.ok(!/chain == DEV/.test(text));
  const unexplained = pins.classifyPins(rowsOf(), withChange('private.accounts_same_world(uuid,uuid)', ['body'])); assert.match(pins.renderPinGateMarkdown(unexplained, pins.evaluatePinGate(unexplained)), /Gate verdict: FAIL \(ADJACENT_PIN_UNEXPLAINED_DIFFERENCE/);
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// ROUND 2 BLOCKER: the readiness body carries the certified closure digest, which on a chain is chain-internal, so it is pinned by its MASKED md5 (the certified literal replaced by a placeholder), exactly as the generated files compare it
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const md5Of = text => createHash('md5').update(text).digest('hex');
const preimage = JSON.parse(readFileSync('supabase/proofs/d12/d12_preimage.json', 'utf8'));
const readinessDefinition = preimage.functions.find(item => item.signature === pins.READINESS_SIGNATURE).definition;
const readinessBody = readinessDefinition.slice(readinessDefinition.indexOf('$function$') + 10, readinessDefinition.lastIndexOf('$function$'));
const DEV_LITERAL = preimage.certifiedDigest, CHAIN_LITERAL = 'ab'.repeat(32);
const readinessRow = () => rowsOf().find(row => row.signature === pins.READINESS_SIGNATURE);
/** The observation a chain read would produce for a readiness body whose certified literal is `literal` (the JS twin of the SQL of chainReadSql). */
const chainObservations = (body, literal) => observationsEqualToDev().map(item => item.signature !== pins.READINESS_SIGNATURE ? item
  : {...item, bodyMd5: pins.maskedBodyMd5(body, literal), maskedLiteralCount: pins.literalCount(body, literal)});

test('BLOCKER regression: the raw readiness body md5 can never equal the DEV pin on a chain (the chain digest differs), the masked md5 does; the OLD raw gate was red on every chain', () => {
  const row = readinessRow();
  assert.equal(DEV_LITERAL, '58447d7730e909a0c0e60dd92ef77416af927471bd6f645988448e32c6e3cb46'); assert.equal(pins.literalCount(readinessBody, DEV_LITERAL), 1, 'the DEV body carries its certified literal exactly once');
  assert.equal((readinessBody.match(/[0-9a-f]{64}/g) ?? []).length, 1, 'and no other 64-hex literal');
  assert.equal(md5Of(readinessBody), row.devRawBodyMd5, 'the captured raw md5 is the md5 of the captured DEV body');
  assert.equal(pins.maskedBodyMd5(readinessBody, DEV_LITERAL), pins.READINESS_MASKED_BODY_MD5, 'the masked md5 of the DEV body is the recorded fingerprint'); assert.equal(row.bodyMd5, pins.READINESS_MASKED_BODY_MD5, 'the pin is the masked fingerprint');
  assert.equal(row.metadataMd5, JSON.parse(pinsText).rows.find(item => item.signature === pins.READINESS_SIGNATURE).metadataMd5, 'the metadata pin of the readiness function stays RAW');
  const chainBody = readinessBody.replace(DEV_LITERAL, CHAIN_LITERAL);
  assert.notEqual(md5Of(chainBody), row.devRawBodyMd5, 'the chain body differs from the DEV body (its literal is the chain digest)');
  // the OLD gate (raw md5 against the raw DEV md5) on an otherwise identical chain: a CORE pin failure, deterministically
  const oldRows = rowsOf().map(item => item.masked ? {...item, bodyMd5: item.devRawBodyMd5} : item), oldObservations = observationsEqualToDev().map(item => item.signature === pins.READINESS_SIGNATURE ? {...item, bodyMd5: md5Of(chainBody)} : item);
  const old = pins.evaluatePinGate(pins.classifyPins(oldRows, oldObservations)); assert.equal(old.ok, false); assert.match(old.failures.join(';'), /CORE_PIN_UNEXPLAINED_DIFFERENCE private\.retention_ai_source_ready\(\) \(body\)/);
  // the NEW gate on the same chain: equal
  const gate = pins.classifyPins(rowsOf(), chainObservations(chainBody, CHAIN_LITERAL)), evaluation = pins.evaluatePinGate(gate);
  assert.equal(evaluation.ok, true, JSON.stringify(evaluation.failures)); assert.equal(gate.equal.length, 47); assert.deepEqual(gate.different, []);
  assert.equal(pins.appliesTheCommittedBytes(gate), true, 'a chain that differs only in its certified literal still applies the COMMITTED bytes');
});

test('MUTATION: a different certified literal still passes; a changed body, a missing literal, a second literal and a body that was not re-bound all fail', () => {
  const row = readinessRow(), verdict = observations => pins.evaluatePinGate(pins.classifyPins(rowsOf(), observations));
  for (const literal of ['00'.repeat(32), 'f'.repeat(64), '0123456789abcdef'.repeat(4)]) assert.equal(verdict(chainObservations(readinessBody.replace(DEV_LITERAL, literal), literal)).ok, true, 'a chain with certified literal ' + literal.slice(0, 8) + ' passes');
  // a changed body (one character of the logic): the masked md5 differs
  const changed = readinessBody.replace('select', 'selecT');
  assert.notEqual(changed, readinessBody); const changedVerdict = verdict(chainObservations(changed.replace(DEV_LITERAL, CHAIN_LITERAL), CHAIN_LITERAL));
  assert.equal(changedVerdict.ok, false); assert.match(changedVerdict.failures.join(';'), /CORE_PIN_UNEXPLAINED_DIFFERENCE private\.retention_ai_source_ready\(\) \(body\)/);
  // the literal is missing (the body was never bound to the chain digest): both the md5 and the occurrence count differ
  const unbound = verdict(chainObservations(readinessBody, CHAIN_LITERAL)); assert.equal(unbound.ok, false); assert.match(unbound.failures.join(';'), /private\.retention_ai_source_ready\(\) \(body\+literal\)/);
  // the literal occurs twice
  const twice = readinessBody.replace(DEV_LITERAL, CHAIN_LITERAL + ' ' + CHAIN_LITERAL); const doubled = verdict(chainObservations(twice, CHAIN_LITERAL)); assert.equal(doubled.ok, false); assert.match(doubled.failures.join(';'), /\(body\+literal\)/);
  // a counted literal that is exactly one but a masked md5 that differs is still a body difference (the mask hides ONLY the certified literal)
  const otherLiteral = readinessBody.replace(DEV_LITERAL, CHAIN_LITERAL).replace('select', 'select /* ' + 'cd'.repeat(32) + ' */'); assert.equal(verdict(chainObservations(otherLiteral, CHAIN_LITERAL)).ok, false, 'any other edit, a second hex literal included, is red');
  assert.equal(row.group, 'core', 'the readiness function is a CORE pin');
});

test('chainReadSql masks ONLY the readiness body with the same expression as the generated files, reports the literal count, and leaves every other body raw', () => {
  const sql = pins.chainReadSql(rowsOf(), value => "'" + value + "'");
  assert.ok(sql.includes("case when s.signature = 'private.retention_ai_source_ready()' then md5(replace(replace(p.prosrc, E'\\r\\n', E'\\n'), (select c.sha256 from private.closure_source_v5 c where c.singleton), '__CERTIFIED_SOURCE__'))"), 'the masked formula');
  assert.ok(sql.includes("else md5(replace(p.prosrc, E'\\r\\n', E'\\n')) end"), 'every other body is raw');
  assert.equal(sql.split('closure_source_v5').length - 1, 3, 'the certified literal is read from the chain certificate (body md5 and the two parts of the literal count)'); assert.ok(sql.includes("'maskedLiteralCount'"));
  // the formula is the application\'s own: replace(replace(prosrc, CRLF, LF), certified, placeholder) -> md5 -> the recorded fingerprint
  for (const name of ['application', 'preflight', 'revert', 'postflight']) assert.ok(files[name].includes("'__CERTIFIED_SOURCE__'))='" + pins.READINESS_MASKED_BODY_MD5 + "'"), name + ' compares the readiness body masked, with the same fingerprint');
  assert.equal(pins.READINESS_PLACEHOLDER, '__CERTIFIED_SOURCE__');
  const generator = readFileSync('supabase/proofs/d12/build_d12.py', 'utf8'); assert.ok(generator.includes("READINESS_PLACEHOLDER_MD5 = '" + pins.READINESS_MASKED_BODY_MD5 + "'"), 'the generator carries the same fingerprint'); assert.ok(generator.includes("'__CERTIFIED_SOURCE__'"));
});

test('ONE run reports EVERY pin difference (round-2 finding): the list has one line per failure, difference and missing pin, and the markdown names them all', () => {
  const observations = observationsEqualToDev().map(item => item.signature === 'public.rpc_get_public_profile(uuid)' ? {...item, bodyMd5: flip(item.bodyMd5)}
    : item.signature === 'private.accounts_same_world(uuid,uuid)' ? {...item, metadataMd5: flip(item.metadataMd5)} : item.signature === 'private.account_visibility_world(uuid)' ? {signature: item.signature, exists: false}
    : item.signature === 'private.closure_account_key(uuid)' ? {...item, bodyMd5: flip(item.bodyMd5), metadataMd5: flip(item.metadataMd5)} : item);
  const gate = pins.classifyPins(rowsOf(), observations), evaluation = pins.evaluatePinGate(gate), lines = pins.listAllPinDifferences(gate, evaluation);
  assert.equal(evaluation.failures.length, 4, 'a core body, a core body+metadata, an adjacent metadata difference and a missing adjacent pin: four failures in one evaluation, not the first only');
  for (const signature of ['public.rpc_get_public_profile(uuid)', 'private.accounts_same_world(uuid,uuid)', 'private.account_visibility_world(uuid)', 'private.closure_account_key(uuid)']) assert.ok(lines.some(line => line.includes(signature)), signature + ' is listed');
  assert.ok(lines.filter(line => line.startsWith('DIFF ')).length === 3 && lines.filter(line => line.startsWith('MISSING ')).length === 1 && lines.filter(line => line.startsWith('FAIL ')).length === 4);
  const markdown = pins.renderPinGateMarkdown(gate, evaluation); for (const signature of ['public.rpc_get_public_profile', 'private.accounts_same_world', 'private.account_visibility_world', 'private.closure_account_key']) assert.ok(markdown.includes(signature), signature + ' in the markdown');
  assert.deepEqual(pins.listAllPinDifferences(pins.classifyPins(rowsOf(), observationsEqualToDev())), [], 'no difference, no line');
  // the proof prints every line BEFORE it asserts, and has the pin-gate-only mode
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8'); assert.ok(proof.includes('pins.listAllPinDifferences(gate, evaluation)') && proof.includes("console.error('PIN_GATE ' + line)") && proof.includes("env.D12_PIN_GATE_ONLY === '1'"));
});
