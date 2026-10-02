// EX05-S01 offline unit tests of the pin gate (pure) and of the committed DEV pins (supabase/proofs/ex05_s01/dev_pins.json).
// The pins file is the 2026-10-02 read-only DEV capture of the chat surface (60 functions). Its transcription is guarded three ways:
//   1. the file carries the combined md5 that the DEV database computed over its own rows; loadPins recomputes it (a mistyped md5 changes it);
//   2. every pin that also appears in an applied-receipt (B24 part 1 and part 2, the Voice B1 postflight) must equal the md5 the receipt recorded;
//   3. the B24 conversion state (pt409) of every row must agree with the receipts' lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  loadPins, combinedPinsMd5, chainReadSql, classifyPins, evaluatePinGate, listAllPinDifferences, gateLabel, renderPinGateMarkdown, CHAIN_LACKS, isMd5,
} from './pins.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = path => readFileSync(root + path, 'utf8');
const pinsText = read('supabase/proofs/ex05_s01/dev_pins.json');
const {meta, rows} = loadPins(pinsText);
const byName = new Map(rows.map(row => [row.signature, row]));

test('the committed pins load: 60 unique functions, md5-shaped values, a core and an adjacent group, and the DEV-computed combined md5', () => {
  assert.equal(rows.length, 60);
  assert.equal(new Set(rows.map(row => row.signature)).size, 60);
  for (const row of rows) {
    assert.ok(isMd5(row.bodyMd5) && isMd5(row.metadataMd5), row.signature);
    assert.ok(row.group === 'core' || row.group === 'adjacent');
    assert.equal(typeof row.composite, 'boolean'); assert.equal(typeof row.pt409, 'boolean');
  }
  assert.ok(rows.filter(row => row.group === 'core').length >= 25);
  assert.equal(meta.readOn, '2026-10-02'); assert.equal(meta.ledgerCount, 221);
  assert.equal(combinedPinsMd5(rows), meta.combinedMd5);
  assert.equal(meta.combinedMd5, '0d917757efecc1bce8a4d3b167525375');
});

test('a changed md5, a duplicate row, a wrong unit or a missing field is refused at load time', () => {
  const doc = JSON.parse(pinsText);
  const tampered = JSON.parse(pinsText); tampered.rows[3].bodyMd5 = '0'.repeat(32);
  assert.throws(() => loadPins(JSON.stringify(tampered)), /PINS_COMBINED_MD5_MISMATCH/);
  const duplicate = JSON.parse(pinsText); duplicate.rows.push({...duplicate.rows[0]});
  assert.throws(() => loadPins(JSON.stringify(duplicate)), /PINS_DUPLICATE_SIGNATURE/);
  assert.throws(() => loadPins(JSON.stringify({...doc, unit: 'OTHER'})), /PINS_FILE_SHAPE/);
  const malformed = JSON.parse(pinsText); malformed.rows[0].bodyMd5 = 'xyz';
  assert.throws(() => loadPins(JSON.stringify(malformed)), /PINS_ROW_INVALID/);
  const noGroup = JSON.parse(pinsText); delete noGroup.rows[0].group;
  assert.throws(() => loadPins(JSON.stringify(noGroup)), /PINS_ROW_INVALID/);
});

test('every pin that a B24 receipt records (part 1: 54 functions, part 2: 14) equals the receipt md5 and is marked pt409', () => {
  let compared = 0;
  for (const file of ['20260930_b24_part1_application.receipt.json', '20260930_b24_part2_application.receipt.json']) {
    const receipt = JSON.parse(read('supabase/operations/dev-alpha/ledger/' + file));
    for (const [name, entry] of Object.entries(receipt.postflight.functions)) {
      const row = [...byName.values()].find(item => item.signature.startsWith(name + '('));
      if (!row) continue;
      assert.equal(row.bodyMd5, entry.md5, name + ' in ' + file);
      assert.equal(row.pt409, true, name + ' converted by B24');
      compared += 1;
    }
  }
  assert.equal(compared, 9, 'six part-1 functions (begin, complete, rotate, send v2, preferences, device) and three part-2 functions (photo context, photo upload, photo send)');
});

test('the voice pins equal the md5 literals of the committed Voice B1 DEV postflight, and the pre-voice window pin of the P4 resolver candidate is stale by design', () => {
  const postflight = read('supabase/proofs/chat/voice_b1_dev_postflight.readonly.sql');
  for (const name of ['public.rpc_send_agreement_voice_message_v1', 'public.rpc_read_agreement_messages_page_v2', 'public.rpc_read_agreement_message_window_v2',
    'public.rpc_agreement_voice_upload_service_v1', 'public.rpc_agreement_voice_read_service_v1']) {
    const row = [...byName.values()].find(item => item.signature.startsWith(name + '('));
    assert.ok(row, name);
    assert.ok(postflight.includes(row.bodyMd5), name + ' body md5 not found in the Voice B1 postflight');
  }
  const resolver = read('supabase/candidates/chat_p4_exact_message_event_resolver.sql');
  const windowV1 = byName.get('public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)');
  assert.ok(resolver.includes('9ae403a4c1ba9130e18cdd5b3dd831f6'));
  assert.notEqual(windowV1.bodyMd5, '9ae403a4c1ba9130e18cdd5b3dd831f6', 'Voice B1 rewrote the V1 reader; the resolver candidate pins the pre-voice body');
  assert.equal(byName.get('public.rpc_resolve_activity_message_v1(uuid,uuid)').bodyMd5, '1769346f2fbf4a70ccf53b47614d2c0f');
  assert.ok(resolver.includes('1769346f2fbf4a70ccf53b47614d2c0f'));
});

test('the DEV chat surface raises no 40001 anywhere: pt409 is true exactly for the functions the receipts convert', () => {
  const expected = ['public.rpc_send_agreement_message_v2', 'public.rpc_send_agreement_photo_message_v5', 'public.rpc_send_agreement_voice_message_v1',
    'public.rpc_agreement_photo_upload_service_v5', 'public.rpc_agreement_voice_upload_service_v1', 'public.rpc_begin_push_send', 'public.rpc_complete_push_transport',
    'public.rpc_set_notification_preferences', 'public.rpc_set_push_device_owned', 'public.rpc_rotate_push_device_owned', 'private.agreement_photo_context_v5',
    'private.agreement_voice_context_v1'];
  const actual = rows.filter(row => row.pt409).map(row => row.signature.split('(')[0]).sort();
  assert.deepEqual(actual, [...expected].sort());
  for (const row of rows.filter(item => item.signature.startsWith('public.rpc_send_group') || item.signature.includes('group_message_read')))
    assert.equal(row.pt409, false, 'group conflicts use 22023, not a conflict code');
});

const equalObservation = row => ({signature: row.signature, exists: true, bodyMd5: row.bodyMd5, metadataMd5: row.metadataMd5, hasPt409: row.pt409, has40001: false});
const allEqual = () => rows.map(equalObservation);
const replace = (observations, signature, patch) => observations.map(item => item.signature === signature ? {...item, ...patch} : item);
const core = rows.find(row => row.group === 'core' && !row.composite), adjacent = rows.find(row => row.group === 'adjacent' && !row.composite), composite = rows.find(row => row.composite);

test('chainReadSql reads every pin once, with the body formula (CR removed) and the shared metadata formula', () => {
  const sql = chainReadSql(rows);
  for (const row of rows) assert.equal(sql.split("('" + row.signature + "')").length - 1, 1, row.signature);
  assert.match(sql, /md5\(replace\(p\.prosrc, E'\\r\\n', E'\\n'\)\)/);
  assert.match(sql, /'metadataMd5', md5\(\(\(to_jsonb\(p\) - 'oid' - 'pronamespace' - 'proowner' - 'prolang' - 'proacl' - 'prosrc'\)/);
  assert.match(sql, /'hasPt409'/); assert.match(sql, /'has40001'/);
  assert.ok(!sql.includes(';'));
  assert.throws(() => chainReadSql([{...rows[0], signature: "x'; drop table y; --"}]), /PINS_SIGNATURE_INVALID/);
});

test('a chain that equals DEV in every pin passes with the label that claims the pinned bodies only', () => {
  const gate = classifyPins(rows, allEqual());
  assert.equal(gate.equal.length, 60); assert.deepEqual([gate.different, gate.missing, gate.harness], [[], [], []]);
  const evaluation = evaluatePinGate(gate);
  assert.equal(evaluation.ok, true); assert.deepEqual(evaluation.failures, []);
  assert.match(gateLabel(gate), /PINS == DEV \(60\/60/);
  assert.match(gateLabel(gate), /the chain is NOT DEV/);
});

test('a CORE body difference fails, an ADJACENT difference only warns, and a composite signature is pinned by body only', () => {
  const coreDiff = classifyPins(rows, replace(allEqual(), core.signature, {bodyMd5: 'f'.repeat(32)}));
  assert.equal(evaluatePinGate(coreDiff).ok, false);
  assert.match(evaluatePinGate(coreDiff).failures[0], /CORE_PIN_UNEXPLAINED_DIFFERENCE/);
  const adjacentDiff = classifyPins(rows, replace(allEqual(), adjacent.signature, {metadataMd5: 'e'.repeat(32)}));
  const evaluation = evaluatePinGate(adjacentDiff);
  assert.equal(evaluation.ok, true); assert.equal(evaluation.warnings.length, 1);
  assert.match(evaluation.warnings[0], /ADJACENT_PIN_DIFFERENCE/);
  const compositeMeta = classifyPins(rows, replace(allEqual(), composite.signature, {metadataMd5: 'a'.repeat(32)}));
  assert.equal(compositeMeta.different.length, 0, 'the per-database type oid makes a composite metadata md5 incomparable');
  const compositeBody = classifyPins(rows, replace(allEqual(), composite.signature, {bodyMd5: 'a'.repeat(32)}));
  assert.equal(compositeBody.different.length, 1);
});

test('a missing core function fails, a missing adjacent function warns, and a malformed or absent observation is a harness failure', () => {
  const missingCore = classifyPins(rows, replace(allEqual(), core.signature, {exists: false, bodyMd5: null, metadataMd5: null}));
  assert.match(evaluatePinGate(missingCore).failures[0], /CORE_PIN_MISSING/);
  const missingAdjacent = classifyPins(rows, replace(allEqual(), adjacent.signature, {exists: false, bodyMd5: null, metadataMd5: null}));
  assert.equal(evaluatePinGate(missingAdjacent).ok, true);
  assert.match(evaluatePinGate(missingAdjacent).warnings[0], /ADJACENT_PIN_MISSING/);
  const absent = classifyPins(rows, allEqual().slice(1));
  assert.match(evaluatePinGate(absent).failures[0], /PIN_GATE_HARNESS_BROKEN/);
  const malformed = classifyPins(rows, replace(allEqual(), core.signature, {bodyMd5: 'nope'}));
  assert.match(evaluatePinGate(malformed).failures[0], /PIN_GATE_HARNESS_BROKEN/);
});

test('B24 conversion is checked on its own: a chat function that still mentions 40001, or lost PT409, fails even when the md5 equals', () => {
  const converted = rows.find(row => row.group === 'core' && row.pt409);
  const still40001 = classifyPins(rows, replace(allEqual(), converted.signature, {has40001: true}));
  assert.equal(evaluatePinGate(still40001).ok, false);
  assert.match(evaluatePinGate(still40001).failures[0], /CONVERSION/);
  const lostPt409 = classifyPins(rows, replace(allEqual(), converted.signature, {hasPt409: false}));
  assert.match(evaluatePinGate(lostPt409).failures[0], /CONVERSION/);
  const unexpectedPt409 = classifyPins(rows, replace(allEqual(), core.signature, {hasPt409: !core.pt409}));
  assert.equal(evaluatePinGate(unexpectedPt409).ok, false);
});

test('an explained chain difference is reported as a warning with its reason instead of failing the gate', () => {
  const gate = classifyPins(rows, replace(allEqual(), core.signature, {bodyMd5: 'd'.repeat(32)}), {[core.signature]: 'the chain lacks the later package that rewrote it'});
  const evaluation = evaluatePinGate(gate);
  assert.equal(evaluation.ok, true);
  assert.match(evaluation.warnings.join('\n'), /the chain lacks the later package/);
});

test('listAllPinDifferences prints every difference in one list, FAIL lines first, both md5 values on every DIFF line', () => {
  const observations = replace(replace(allEqual(), core.signature, {bodyMd5: 'f'.repeat(32)}), adjacent.signature, {bodyMd5: 'c'.repeat(32)});
  const gate = classifyPins(rows, observations);
  const lines = listAllPinDifferences(gate);
  assert.ok(lines[0].startsWith('FAIL '));
  const diffs = lines.filter(line => line.startsWith('DIFF '));
  assert.equal(diffs.length, 2);
  assert.ok(diffs.every(line => /dev body [a-f0-9]{32} chain body [a-f0-9]{32}/.test(line)));
});

test('the markdown report names the label first and lists the named chain differences', () => {
  const gate = classifyPins(rows, replace(allEqual(), adjacent.signature, {bodyMd5: 'b'.repeat(32)}));
  const text = renderPinGateMarkdown(gate, evaluatePinGate(gate));
  assert.ok(text.startsWith('## EX05-S01 pin gate'));
  assert.match(text, /\| signature \| group \| verdict \| detail \|/);
  assert.match(text, /DIFFERENT \(body\)/);
  for (const item of CHAIN_LACKS) assert.ok(typeof item === 'string' && item.length > 5);
  assert.ok(CHAIN_LACKS.some(item => /D12/.test(item)) && CHAIN_LACKS.some(item => /pkg051a/.test(item)));
});
