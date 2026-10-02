// Offline tests of the EX-07 S06 proof library and of the consistency of the generated files (no database, no network, no dependency):
//   node --test supabase/proofs/ex07/s06/ex07_s06_lib.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as lib from './ex07_s06_lib.mjs';

const ROOT = new URL('../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT), 'utf8').replace(/\r\n/g, '\n');
const md5 = text => createHash('md5').update(text).digest('hex');
const sha = text => createHash('sha256').update(text).digest('hex');
const FILES = {
  candidate: 'supabase/candidates/ex07_safety_target_name.sql',
  revert: 'supabase/candidates/ex07_safety_target_name_revert.sql',
  preflight: 'supabase/proofs/ex07/s06/ex07_s06_preflight.readonly.sql',
  postflight: 'supabase/proofs/ex07/s06/ex07_s06_postflight.readonly.sql',
  plainApply: 'supabase/proofs/ex07/s06/guarded/ex07_safety_target_name.plain_guard.sql',
  plainRevert: 'supabase/proofs/ex07/s06/guarded/ex07_safety_target_name_revert.plain_guard.sql',
  migrationApply: 'supabase/proofs/ex07/s06/guarded/ex07_safety_target_name.apply_migration_guard.sql',
  migrationRevert: 'supabase/proofs/ex07/s06/guarded/ex07_safety_target_name_revert.apply_migration_guard.sql',
};
const text = Object.fromEntries(Object.entries(FILES).map(([key, path]) => [key, read(path)]));
const manifest = JSON.parse(read('supabase/proofs/ex07/s06/ex07_s06_manifest.json'));
const devBody = read('supabase/proofs/ex07/s06/ex07_s06_dev_body.txt');

test('shownName is nullif(btrim(name), ""): spaces only, blank and null are null', () => {
  assert.equal(lib.shownName('  Ana Naručiteljka  '), 'Ana Naručiteljka');
  assert.equal(lib.shownName('   '), null);
  assert.equal(lib.shownName(''), null);
  assert.equal(lib.shownName(null), null);
  assert.equal(lib.shownName(undefined), null);
  assert.equal(lib.shownName('\tAna\n'), '\tAna\n', 'btrim removes spaces, not tabs or line feeds');
  assert.equal(lib.shownName('Ana  Majstor'), 'Ana  Majstor', 'inner spaces are kept');
});

test('withName: null stays null and a target gains exactly one key', () => {
  assert.equal(lib.withName(null, 'Ana'), null);
  const before = {profileId: 'p', accountId: 'a', targetAccountId: 't', blocked: false, revision: 0, authoritative: true};
  assert.deepEqual(lib.withName(before, 'Ana'), {...before, displayName: 'Ana'});
  assert.deepEqual(lib.withName(before, '  '), {...before, displayName: null});
  assert.deepEqual(Object.keys(lib.withName(before, 'Ana')).sort(), lib.NEW_KEYS);
  assert.deepEqual(Object.keys(before).sort(), lib.OLD_KEYS);
});

test('answerDiff finds every difference and ignores the order of keys', () => {
  assert.deepEqual(lib.answerDiff({a: 1, b: {c: 2}}, {b: {c: 2}, a: 1}), []);
  assert.deepEqual(lib.answerDiff(null, null), []);
  assert.deepEqual(lib.answerDiff({a: 1}, {a: 1, displayName: 'x'}), [{path: '/displayName', before: undefined, after: 'x'}]);
  assert.deepEqual(lib.answerDiff({a: 1, b: 2}, {a: 1}), [{path: '/b', before: 2, after: undefined}]);
  assert.deepEqual(lib.answerDiff({a: {b: 1}}, {a: {b: 2}}), [{path: '/a/b', before: 1, after: 2}]);
  assert.deepEqual(lib.answerDiff(null, {a: 1}).length, 1);
  assert.deepEqual(lib.answerDiff([1], [1]), []);
  assert.deepEqual(lib.answerDiff([1], [2]).length, 1);
});

test('the application carries the target first and seven neighbours, the revert and both flights the same ones', () => {
  const pins = lib.parsePins(text.candidate);
  assert.equal(pins.length, 8);
  assert.deepEqual(pins[0], {signature: lib.TARGET, md5: manifest.pins.oldBodyMd5});
  assert.deepEqual(pins.slice(1).map(pin => [pin.signature, pin.md5]), manifest.pins.neighbours);
  assert.deepEqual(lib.parsePins(text.revert).map(pin => [pin.signature, pin.md5]), manifest.pins.neighbours);
  const pre = lib.parseFlightPins(text.preflight), post = lib.parseFlightPins(text.postflight);
  assert.deepEqual(pre.targets, [{signature: lib.TARGET, md5: manifest.pins.oldBodyMd5}]);
  assert.deepEqual(post.targets, [{signature: lib.TARGET, md5: manifest.pins.newBodyMd5}]);
  assert.deepEqual(pre.neighbours.map(pin => [pin.signature, pin.md5]), manifest.pins.neighbours);
  assert.deepEqual(post.neighbours.map(pin => [pin.signature, pin.md5]), manifest.pins.neighbours);
  assert.ok(pins.every(pin => /^[0-9a-f]{32}$/.test(pin.md5)));
  // rpc_set_account_block is deliberately not pinned (B24 gave it a DEV body a chain replayed without B24 does not carry)
  assert.ok(!pins.some(pin => pin.signature.includes('rpc_set_account_block')));
});

test('the pinned predecessor is the stored DEV body, and the anchored edit gives exactly the pinned new body', () => {
  assert.equal(md5(devBody), manifest.pins.oldBodyMd5);
  const anchor = lib.dollarLiteral(text.candidate, 'anchor'), replacement = lib.dollarLiteral(text.candidate, 'replacement');
  assert.equal(devBody.split(anchor).length - 1, 1, 'the anchor occurs exactly once');
  assert.ok(!replacement.includes(anchor), 'the replacement does not contain the anchor');
  const next = devBody.replace(anchor, replacement);
  assert.equal(md5(next), manifest.pins.newBodyMd5);
  assert.equal(next.replace(replacement, anchor), devBody, 'the edit is exactly invertible');
  assert.equal(lib.dollarLiteral(text.revert, 'anchor'), anchor);
  assert.equal(lib.dollarLiteral(text.revert, 'replacement'), replacement);
  // the one added key is the name of the asked-for profile, written as rpc_get_public_profile writes it; nothing else is added
  assert.ok(replacement.includes("'displayName',nullif(btrim(v_profile.display_name),'')"));
  assert.equal((next.match(/'displayName'/g) ?? []).length, 1);
  assert.ok(!replacement.includes('account_blocks') && !replacement.includes('select '), 'the replacement reads nothing new');
  assert.equal(md5(lib.dollarLiteral(text.revert, 'old_comment')), manifest.pins.oldCommentMd5);
  assert.equal(md5(lib.dollarLiteral(text.candidate, 'new_comment')), manifest.pins.newCommentMd5);
  assert.ok(/'(true|false)'|\btrue\b/.test(devBody) && !devBody.includes('display_name'), 'the predecessor never mentioned the display name');
});

test('every generated text is clean: LF, ASCII, no tab, no unicode escape text, only errcode 55000, no serialization code, one final line feed, the markers', () => {
  for (const [key, body] of Object.entries(text)) {
    const marker = key === 'candidate' ? lib.APPLY_MARKER : key === 'revert' ? lib.REVERT_MARKER : undefined;
    assert.deepEqual(lib.textProblems(body, marker ? {marker} : {}), [], key);
  }
  assert.deepEqual([...new Set(lib.errcodes(text.candidate))], ['55000']);
  assert.deepEqual([...new Set(lib.errcodes(text.revert))], ['55000']);
  // the new body raises with the codes the predecessor did and no other
  const newBody = devBody.replace(lib.dollarLiteral(text.candidate, 'anchor'), lib.dollarLiteral(text.candidate, 'replacement'));
  assert.deepEqual([...new Set(lib.errcodes(newBody))].sort(), ['22023', '42501']);
  assert.deepEqual(lib.errcodes(newBody), lib.errcodes(devBody));
  // a text with a retried serialization code, a tab, a carriage return or a non-ASCII letter is refused
  assert.ok(lib.textProblems("raise exception 'x' using errcode = '40001';\n").includes('SERIALIZATION_FAILURE_CODE'));
  assert.ok(lib.textProblems('a\tb\n').includes('TAB'));
  assert.ok(lib.textProblems('a\r\n').includes('CARRIAGE_RETURN'));
  assert.ok(lib.textProblems('č\n').includes('NON_ASCII'));
  assert.ok(lib.textProblems('x\n\n').includes('FINAL_LINE_FEED'));
  assert.ok(lib.textProblems("raise exception 'x' using errcode = '42501';\n").includes('ERRCODE_OTHER_THAN_55000:42501'));
  assert.deepEqual(lib.textProblems('select 1; -- ' + 'a'.repeat(32) + '40001\n'), []);
});

test('the application text states its refusals, its atomicity and its function-only scope', () => {
  for (const name of ['EX07S06_PREDECESSOR_DRIFT', 'EX07S06_TARGET_ATTRIBUTE_DRIFT', 'EX07S06_RELATION_DRIFT', 'EX07S06_TARGET_IS_CERTIFIED', 'EX07S06_CLOSURE_NOT_READY',
    'EX07S06_ANCHOR_NOT_UNIQUE', 'EX07S06_CLOSURE_MOVED', 'EX07S06_TARGET_BODY_MISMATCH', 'EX07S06_UNRELATED_FUNCTION_DELTA', 'EX07S06_FUNCTION_ROSTER_DELTA', 'EX07S06_AUTHORITY_CHANGED',
    'EX07S06_ALREADY_APPLIED', 'EX07S06_CRLF_TEXT', 'EX07S06_OWNER_REQUIRED', 'EX07S06_COMMENT_MISMATCH']) assert.ok(text.candidate.includes(name), name);
  assert.equal((text.candidate.match(/^do \$ex07s06\$$/gm) ?? []).length, 1, 'ONE atomic DO statement');
  const outside = text.candidate.replace(/^do \$ex07s06\$[\s\S]*?^\$ex07s06\$;$/m, '').split('\n').filter(line => line.trim() !== '' && !line.trim().startsWith('--'));
  assert.deepEqual(outside, [], 'no statement but the DO (only comments around it)');
  // no DDL keyword outside the one anchored create-or-replace of the function itself and the comment on it
  const executed = [...text.candidate.matchAll(/^\s*execute (.*)$/gm)].map(match => match[1]);
  assert.deepEqual(executed, ['replace(def, anchor, replacement);', "format('comment on function %s is %L', target_signature, new_comment);"]);
  assert.ok(text.candidate.includes('private.closure_source_v5') && text.candidate.includes('private.closure_erasure_source_v5') && text.candidate.includes('private.retention_ai_source_ready()'));
  assert.ok(text.revert.includes('EX07S06_REVERT_STATE_NOT_THE_APPLIED_ONE') && text.revert.includes('EX07S06_REVERT_POSTCONDITION'));
  assert.ok(!text.candidate.includes('rpc_set_account_block') || text.candidate.includes('is NOT'), 'a sibling that is not pinned is not named as a pin');
});

test('the manifest equals the generated files and their guards', () => {
  for (const [key, path] of Object.entries(FILES)) {
    const entry = manifest.files[path] ?? manifest.guarded[path];
    assert.ok(entry, key + ' is in the manifest');
    assert.equal(entry.sha256, sha(text[key]), key + ' sha256');
    assert.equal(entry.bytes, Buffer.byteLength(text[key]), key + ' bytes');
  }
  for (const [path, entry] of Object.entries(manifest.guarded)) {
    const guarded = read(path), source = read(entry.guards);
    assert.ok(guarded.endsWith(source), path + ' ends with the text it guards');
    const span = entry.marker ? source.slice(0, -1) : source.replace(/\n+$/, '');
    assert.equal(entry.spanSha256, sha(span), path + ' span sha256');
    assert.equal(entry.spanLength, span.length, path + ' span length');
    if (entry.marker) {
      assert.ok(source.startsWith(entry.marker) && source.split(entry.marker).length === 2, path + ' marker starts the text once');
      assert.ok(!guarded.slice(0, guarded.indexOf('\n')).includes(entry.marker), path + ': the guard line does not contain the marker contiguously');
    }
  }
  assert.equal(manifest.inputs['supabase/proofs/ex07/s06/ex07_s06_dev_body.txt'], sha(devBody));
  assert.equal(manifest.pins.newBodyMd5, md5(devBody.replace(lib.dollarLiteral(text.candidate, 'anchor'), lib.dollarLiteral(text.candidate, 'replacement'))));
  assert.match(manifest.devRead.certifiedDigest, /^[0-9a-f]{64}$/);
  assert.equal(manifest.target, lib.TARGET);
});

test('the drift tamper changes exactly one pin and nothing else', () => {
  for (const signature of lib.parsePins(text.candidate).map(pin => pin.signature)) {
    const drifted = lib.tamperPin(text.candidate, signature);
    assert.notEqual(drifted, text.candidate);
    const before = lib.parsePins(text.candidate), after = lib.parsePins(drifted);
    assert.equal(after.filter((pin, index) => pin.md5 !== before[index].md5).length, 1);
    assert.equal(after.find(pin => pin.signature === signature).md5, '0'.repeat(32));
  }
  assert.throws(() => lib.tamperPin(text.candidate, 'public.nothing(uuid)'), /PIN_NOT_FOUND/);
});

test('catalog and surface deltas', () => {
  assert.deepEqual(lib.diffNamed([{name: 'a', md5: '1'}, {name: 'b', md5: '2'}], [{name: 'a', md5: '1'}, {name: 'b', md5: '3'}, {name: 'c', md5: '4'}]),
    {added: ['c'], removed: [], changed: [{name: 'b', before: '2', after: '3'}]});
  const line = (name, hash, acl = '{postgres=X/postgres}') => `function:public.${name}(uuid):${hash}:definer=true:volatility=s:config=search_path=pg_catalog:acl=${acl}`;
  const same = [line('a', '1'), line('b', '2')];
  assert.equal(lib.surfaceDelta(same, same).onlyBodiesChanged, true);
  const body = lib.surfaceDelta(same, [line('a', '1'), line('b', '9')]);
  assert.equal(body.onlyBodiesChanged, true);
  assert.deepEqual(body.names, ['public.b(uuid)']);
  assert.equal(lib.surfaceDelta(same, [line('a', '1'), line('b', '9', '{postgres=X/postgres,anon=X/postgres}')]).onlyBodiesChanged, false);
  assert.equal(lib.surfaceDelta(same, [line('a', '1')]).onlyBodiesChanged, false);
  assert.equal(lib.surfaceDelta(same, [...same, line('c', '3')]).onlyBodiesChanged, false);
});

test('asAccountSql and lastLine', () => {
  const q = value => "'" + String(value).replaceAll("'", "''") + "'";
  const sql = lib.asAccountSql('00000000-0000-4000-8000-000000000001', "select 1", q);
  assert.ok(sql.startsWith('begin; set local role authenticated;') && sql.endsWith('select 1; commit;'));
  assert.ok(sql.includes("'request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001'"));
  assert.equal(lib.lastLine('a|b|c\n{"x":1}\n'), '{"x":1}');
  assert.equal(lib.lastLine(''), '');
  assert.equal(lib.lastLine('null'), 'null');
});
