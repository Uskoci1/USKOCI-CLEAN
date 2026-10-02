// Offline unit tests of the D12 proof's pure library (node --test supabase/proofs/d12/*.test.mjs). No database, no network.
// They tie every JS mirror to the GENERATED candidate text, so a drift between the rules the proof asserts and the rules the SQL states fails here before any CI run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as lib from './d12_lib.mjs';
import * as pins from './d12_pins.mjs';

const sha256 = text => createHash('sha256').update(text).digest('hex');
const md5 = text => createHash('md5').update(text).digest('hex');
const RAW = path => readFileSync(path);   // the BYTES (a carriage return or a non-ASCII byte must be visible)
const GENERATED = ['supabase/candidates/d12_review_comment.sql', 'supabase/candidates/d12_review_comment_revert.sql', 'supabase/proofs/d12/d12_preflight.readonly.sql', 'supabase/proofs/d12/d12_postflight.readonly.sql'];
const APPLICATION = readFileSync('supabase/candidates/d12_review_comment.sql', 'utf8');
const functionBody = (schemaAndName) => { const start = APPLICATION.indexOf('create function ' + schemaAndName + '('); assert.ok(start >= 0, schemaAndName); const open = APPLICATION.indexOf('$f$', start), close = APPLICATION.indexOf('$f$', open + 3); return APPLICATION.slice(open + 3, close); };

test('the matrix is well formed: unique ids, every case has an expectation, every group the proof asserts on exists', () => {
  const cases = lib.buildMatrix(), ids = cases.map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of cases) { assert.ok(['ABSENT', 'ACCEPTED', 'REFUSED'].includes(item.expect.outcome), item.id); if (item.expect.outcome === 'REFUSED') { assert.match(item.expect.name, /^REVIEW_COMMENT_(INVALID|TOO_LONG|CONTACT_NOT_PUBLIC)$/); assert.equal(item.expect.sqlstate, '22023'); } }
  const groups = new Set(cases.map(item => item.group));
  for (const group of ['ABSENT', 'TYPE', 'LENGTH', 'TRIM', 'CONTROL', 'BIDI_ZERO_WIDTH', 'INVISIBLE_FORBIDDEN', 'INVISIBLE_ALLOWED', 'ALLOWED', 'CONTACT', 'KNOWN_RESIDUAL']) assert.ok(groups.has(group), 'group ' + group);
  assert.ok(!groups.has('LOCALE'), 'nothing depends on the database locale any more (round-1 finding F1)');
  assert.ok(cases.length >= 150, 'a matrix of at least 150 cases: ' + cases.length);
  assert.ok(cases.find(item => item.sqlNull === true), 'a SQL NULL case');
});

test('the JS mirror classifies every matrix case exactly as the intended rule says (the mirror and the intention agree)', () => {
  for (const item of lib.buildMatrix()) {
    const mirror = lib.classifyComment(item.value);
    assert.ok(lib.outcomeMatches(mirror, item.expect), `${item.id}: mirror ${JSON.stringify(mirror)} vs expected ${JSON.stringify(item.expect)}`);
  }
});

test('non-vacuity of the matrix: for every rule there is a case on each side of it', () => {
  const cases = lib.buildMatrix(), by = group => cases.filter(item => item.group === group);
  const outcomes = group => new Set(by(group).map(item => item.expect.outcome));
  assert.ok(outcomes('LENGTH').has('ACCEPTED') && outcomes('LENGTH').has('REFUSED'));
  assert.ok(outcomes('TRIM').has('ACCEPTED') && outcomes('TRIM').has('REFUSED'));
  assert.deepEqual([...outcomes('CONTROL')], ['REFUSED']); assert.deepEqual([...outcomes('BIDI_ZERO_WIDTH')], ['REFUSED']); assert.deepEqual([...outcomes('INVISIBLE_FORBIDDEN')], ['REFUSED']); assert.deepEqual([...outcomes('CONTACT')], ['REFUSED']);
  assert.deepEqual([...outcomes('ALLOWED')], ['ACCEPTED']); assert.deepEqual([...outcomes('INVISIBLE_ALLOWED')], ['ACCEPTED']);
  // the length boundary is exactly 500 on both sides, in code points (astral characters count once)
  const find = id => cases.find(item => item.id === id);
  assert.equal(lib.codePoints(find('ascii_500').value), 500); assert.equal(lib.codePoints(find('ascii_501').value), 501); assert.equal(lib.codePoints(find('astral_500').value), 500); assert.equal(lib.utf8Octets(find('astral_500').value), 2000);
  assert.equal(lib.codePoints(find('mixed_astral_last_500').value), 500); assert.equal(lib.codePoints(find('mixed_astral_last_501').value), 501);
  // every forbidden range is exercised by at least one case, on both of its ends where it is a range
  for (const [lo, hi] of lib.FORBIDDEN_RANGES) assert.ok(cases.some(item => typeof item.value === 'string' && item.expect.outcome === 'REFUSED' && [...item.value].some(c => c.codePointAt(0) >= lo && c.codePointAt(0) <= hi)), 'a refusal case inside ' + lo.toString(16) + '-' + hi.toString(16));
});

test('the forbidden, the "no comment" and the strip classes and the digit map in the lib equal the expressions written in the GENERATED candidate (table CHECK and function): built from chr() pieces only', () => {
  const count = (text, part) => text.split(part).length - 1;
  assert.equal(count(APPLICATION, 'comment !~ ' + lib.FORBIDDEN_EXPR_PG), 1, 'the table CHECK carries the forbidden class expression');
  const input = functionBody('private.review_comment_input_v1');
  assert.equal(count(input, "v ~ " + lib.FORBIDDEN_EXPR_PG + " then raise exception 'REVIEW_COMMENT_INVALID'"), 1, 'the function carries the same forbidden class expression');
  assert.equal(count(input, "v ~ " + lib.BLANK_EXPR_PG + " then return null"), 1, 'the function carries the blank class expression');
  assert.equal(count(input, 'regexp_replace(normalize(v,NFKC),' + lib.STRIP_EXPR_PG + ",'','g')"), 1, 'the contact floor reads an NFKC copy without invisible characters');
  assert.equal(count(input, 'translate(regexp_replace(normalize(v,NFKC),' + lib.STRIP_EXPR_PG + ",'','g')," + lib.DIGITS_FROM_EXPR_PG + ",'" + lib.DIGITS_TO_PG + "')"), 1, 'and with the Arabic-Indic and Persian digits mapped to ASCII');
  assert.equal(lib.DIGITS_TO_PG.length, 20); assert.equal(lib.DIGITS_FROM_EXPR_PG.split(' || ').length, 20);
  for (const expression of [lib.FORBIDDEN_EXPR_PG, lib.BLANK_EXPR_PG, lib.STRIP_EXPR_PG, lib.DIGITS_FROM_EXPR_PG]) assert.ok(/^[\x20-\x7E]*$/.test(expression) && lib.findEscapeTexts(expression).length === 0, 'an expression of printable ASCII pieces, no escape text');
  // the explicit classes are closed and the overlap is exactly the white-space controls and the three separators that blank tests first
  const inRanges = (ranges, codePoint) => ranges.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
  const overlap = []; for (const [lo, hi] of lib.FORBIDDEN_RANGES) for (let codePoint = lo; codePoint <= hi && codePoint <= 0x2FFF; codePoint++) if (inRanges(lib.BLANK_RANGES, codePoint)) overlap.push(codePoint);
  assert.deepEqual(overlap, [0x09, 0x0B, 0x0C, 0x0D, 0x85, 0x2028, 0x2029], 'blank and forbidden overlap in the white-space controls (tab, VT, FF, CR), U+0085, U+2028 and U+2029 only (blank is tested first)');
  for (const codePoint of [0x200C, 0x200D, ...Array.from({length: 16}, (_, index) => 0xFE00 + index)]) assert.ok(!inRanges(lib.FORBIDDEN_RANGES, codePoint), 'the joiners and ALL sixteen variation selectors stay allowed: emoji sequences must work');
  // round-2 finding (certificate #5): the blank class is EXPLICIT: no POSIX class anywhere in the generated function or CHECK, U+001C..U+001F are NOT blank
  assert.ok(!input.includes('[[:'), 'no POSIX bracket class in the validator'); assert.ok(!APPLICATION.includes('[[:space:]]') && !lib.BLANK_EXPR_PG.includes(':space:'), 'the blank class never uses the locale dependent POSIX [[:space:]]');
  assert.ok(lib.BLANK_EXPR_PG.startsWith("('^[' || chr(9) || '-' || chr(13) || chr(32) ||"), 'the blank class opens with the explicit ASCII white space U+0009..U+000D and U+0020');
  for (const codePoint of [0x1C, 0x1D, 0x1E, 0x1F]) { assert.ok(!inRanges(lib.BLANK_RANGES, codePoint), 'U+001C..U+001F are not blank'); assert.ok(inRanges(lib.FORBIDDEN_RANGES, codePoint), 'they are forbidden controls'); }
  for (const codePoint of [0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x20]) assert.ok(inRanges(lib.BLANK_RANGES, codePoint), 'ASCII white space is blank: ' + codePoint);
  for (const [lo, hi] of [...lib.FORBIDDEN_RANGES, ...lib.BLANK_RANGES, ...lib.STRIP_RANGES]) for (const meta of [0x5D, 0x5E, 0x2D, 0x5B, 0x5C]) assert.ok(!(meta >= lo && meta <= hi), 'no bracket-expression metacharacter inside a range');
  const body = functionBody('private.review_comment_input_v1'), numbers = [...body.matchAll(/char_length\(v\)>(\d+) or octet_length\(v\)>(\d+)/g)][0], json = /octet_length\(p_comment::text\)>(\d+)/.exec(body);
  assert.equal(Number(numbers[1]), lib.COMMENT_MAX_CHARS); assert.equal(Number(numbers[2]), lib.COMMENT_MAX_OCTETS); assert.equal(Number(json[1]), lib.COMMENT_JSON_MAX_OCTETS);
  assert.match(APPLICATION, /char_length\(comment\) between 1 and 500 and octet_length\(comment\)<=2000/);
  const reader = functionBody('public.rpc_list_review_comments_v1'); assert.match(reader, /least\(greatest\(coalesce\(p_limit,20\),1\),50\)/);
});

test('the contact floor mirror equals the LIVE rule: the three unchanged migration rules plus the PKG-029c phone rule (the migration-era text is the OLD floor)', () => {
  const migration = readFileSync('supabase/migrations/20260905060000_clean_ru4b_preselection_qa_foundation.sql', 'utf8'), rules = [...migration.slice(migration.indexOf('create or replace function private.ru4b_public_floor_reason'), migration.indexOf('private.ru4b_assert_block_authority_ready')).matchAll(/v ~\*? '([^']*)' then return '([A-Z_]+)'/g)];
  assert.deepEqual(rules.map(match => match[2]), ['EMAIL_NOT_PUBLIC', 'OFF_PLATFORM_LINK_NOT_PUBLIC', 'SOCIAL_HANDLE_NOT_PUBLIC', 'PHONE_NOT_PUBLIC']);
  // the live phone rule is the one PKG-029c installed on DEV (ledger 183, md5 3462ec03): its constants are tied to the candidate text
  const pkg = readFileSync('supabase/candidates/pkg029c_questions_while_recruiting.sql', 'utf8');
  assert.ok(pkg.includes("regexp_matches(v, '(\\+?[0-9][0-9 ()/.\\-]{6,}[0-9])', 'g')"), 'the phone run pattern'); assert.ok(pkg.includes("regexp_replace(m[1], '[^0-9+]', '', 'g') ~ '^(\\+|00|0|381)'"), 'the phone start');
  assert.ok(pkg.includes("between 8 and 13"), 'the digit count'); assert.ok(pkg.includes("m[1] !~ '^[0-9]{1,2}[./][0-9]{1,2}[./][0-9]{2,4}'"), 'the date shape');
  assert.deepEqual(lib.PHONE_DIGITS, [8, 13]); assert.equal(lib.PHONE_RUN.source, '(\\+?[0-9][0-9 ()/.\\-]{6,}[0-9])'); assert.equal(lib.PHONE_START.source, '^(\\+|00|0|381)'); assert.equal(lib.PHONE_DATE_SHAPE.source, '^[0-9]{1,2}[./][0-9]{1,2}[./][0-9]{2,4}');
  // the very sentences PKG-029c asserts after its own patch (the DEV function must read them like this)
  for (const accepted of ['Da li mo' + String.fromCharCode(0x17E) + 'e 12.10.2026 posle podne?', 'Da li mo' + String.fromCharCode(0x17E) + 'e 01.10.2026 posle podne?', 'Cena 15000 - 20000 je ok?', 'Treba 2 radnika od 8 do 16h']) assert.equal(lib.contactFloorReason(accepted), null, accepted);
  for (const phone of ['Zovi me na 064 123 4567', 'Broj: +381 64 123 45 67', '064/123-456', '0641234567']) assert.equal(lib.contactFloorReason(phone), 'PHONE_NOT_PUBLIC', phone);
  assert.equal(lib.contactFloorReason('ime@posta.rs'), 'EMAIL_NOT_PUBLIC'); assert.equal(lib.contactFloorReason('www.x.rs'), 'OFF_PLATFORM_LINK_NOT_PUBLIC'); assert.equal(lib.contactFloorReason('javi se @pera'), 'SOCIAL_HANDLE_NOT_PUBLIC');
  assert.equal(lib.contactFloorReason('Zavrseno 12.03.2026.'), null, 'a date is no longer read as a phone number'); assert.equal(lib.contactFloorReason('zovi 64 123 4567'), null, 'KNOWN RESIDUAL: a number without its leading 0 / +381 passes');
  assert.equal(lib.contactFloorReason('nula sest cetiri'), null, 'KNOWN RESIDUAL: spelled-out digits pass'); assert.equal(lib.contactFloorReason('zovi +381 64 123 456 789 012'), null, 'KNOWN RESIDUAL: more than 13 digits pass'); assert.equal(lib.contactFloorReason('   '), 'EMPTY_CONTENT');
});

test('the normalised contact floor catches what the plain floor misses (full-width and Arabic-Indic digits, invisible joiners, full-width @) and the residuals stay pinned', () => {
  const digitsAs = (base, digits) => [...digits].map(digit => String.fromCodePoint(base + Number(digit))).join('');
  const caught = [['fullwidth digits', 'zovi ' + digitsAs(0xFF10, '0641234567')], ['arabic-indic digits', 'zovi ' + digitsAs(0x0660, '0641234567')], ['persian digits', 'zovi ' + digitsAs(0x06F0, '0641234567')],
    ['soft hyphen split', 'zovi 064' + String.fromCodePoint(0xAD) + '1234567'], ['cgj split', 'zovi 064' + String.fromCodePoint(0x34F) + '1234567'], ['zwnj split', 'zovi 064' + String.fromCodePoint(0x200C) + '1234567'],
    ['full-width at', 'ime' + String.fromCodePoint(0xFF20) + 'posta.rs']];
  for (const [name, text] of caught) { assert.equal(lib.contactFloorReason(text), null, name + ': the PLAIN floor misses it (the round-1 measurement)'); assert.notEqual(lib.contactFloorReason(lib.normalizedForFloor(text)), null, name + ': the normalised copy is caught'); assert.equal(lib.classifyComment(text).name, 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', name); }
  for (const text of ['zovi 64 123 4567', 'vidi moj-sajt.rs', 'javi se t.me/pera', 'ime at posta tacka rs', '064x123x4567']) assert.equal(lib.classifyComment(text).outcome, 'ACCEPTED', 'KNOWN RESIDUAL stays pinned: ' + text);
  assert.equal(lib.normalizedForFloor('A' + String.fromCodePoint(0xFF11) + String.fromCodePoint(0x0662)), 'A12');
});

test('the generated candidate contains no 40001 anywhere (not even in a comment) and no CASCADE; the deterministic conflict is PT409', () => {
  for (const name of ['private.guard_review_comment_mutation', 'private.review_comment_input_v1', 'public.rpc_submit_agreement_review_v2', 'public.rpc_get_my_agreement_review_v2', 'public.rpc_list_review_comments_v1', 'public.rpc_moderate_review_comment_service_v1']) {
    const body = functionBody(name); assert.ok(!body.includes('40001'), name + ' does not mention SQLSTATE 40001 at all (round-1 finding F5: a plain-text scan finds none)'); assert.ok(!/cascade/i.test(body), name + ' has no CASCADE');
  }
  assert.match(functionBody('public.rpc_moderate_review_comment_service_v1'), /errcode='PT409'/);
});

test('TRANSPORT SAFETY (round-1 blocker): the four generated files and the manifest carry no unicode escape text, no non-ASCII byte, no carriage return, no tab and no NUL', () => {
  for (const path of [...GENERATED, 'supabase/proofs/d12/d12_manifest.json']) {
    const bytes = RAW(path), text = bytes.toString('latin1');
    assert.deepEqual(lib.findEscapeTexts(text), [], path + ': no backslash-u escape text (a connector resolves it before Postgres sees it)');
    assert.deepEqual(lib.nonAsciiCharacters(text), [], path + ': ASCII only (every non-ASCII character is built with chr())'); assert.equal(bytes.includes(13), false, path + ': LF only'); assert.equal(bytes.includes(9), false, path + ': no tab'); assert.equal(bytes.includes(0), false, path + ': no NUL');
  }
  assert.ok(RAW(GENERATED[0]).length > 60000 && RAW(GENERATED[1]).length > 90000, 'the files are the full candidate and revert');
  // non-vacuous: the detectors DO see the defects they guard against
  const bad = "select 1 where x ~ '[" + '\\u' + "200B]';"; assert.deepEqual(lib.findEscapeTexts(bad), ['\\u200B']); assert.deepEqual(lib.nonAsciiCharacters('a' + String.fromCodePoint(0x161)), [String.fromCodePoint(0x161)]);
});

test('a connector round trip (it RESOLVES unicode escape texts) leaves every generated file and every pinned body byte for byte unchanged; the OLD escape form would have changed it', () => {
  for (const path of GENERATED) { const text = readFileSync(path, 'utf8'); assert.equal(lib.simulateConnectorRoundTrip(text), text, path + ': identical after the simulated connector round trip'); assert.equal(sha256(lib.simulateConnectorRoundTrip(text)), sha256(text)); }
  for (const name of ['private.review_comment_input_v1', 'public.rpc_submit_agreement_review_v2', 'public.rpc_list_review_comments_v1']) { const body = functionBody(name); assert.equal(md5(lib.simulateConnectorRoundTrip(body)), md5(body), name + ': the stored body md5 (the pin) survives the round trip'); }
  // non-vacuous: the escape form of the same class changes a body (and therefore its md5) when a connector resolves it
  const escaped = functionBody('private.review_comment_input_v1').replace(lib.FORBIDDEN_EXPR_PG, "'[" + '\\u' + '200B' + '\\u' + "202E]'"), resolved = lib.simulateConnectorRoundTrip(escaped);
  assert.notEqual(resolved, escaped, 'the simulated connector resolves an escape'); assert.notEqual(md5(resolved), md5(escaped), 'and the md5 of the body would no longer equal its pin');
  assert.equal(lib.simulateConnectorRoundTrip('x' + '\\u' + '0001y'), 'x' + '\\u' + '0001y', 'as measured: the escapes of U+0001..U+007F stay literal'); assert.equal(lib.simulateConnectorRoundTrip('\\u' + '00e9'), String.fromCodePoint(0xE9));
});

test('the manifest equals the bytes of the four generated files (a carriage return changes the sha256) and the guard text is reproduced by the JS mirror byte for byte', () => {
  const manifest = JSON.parse(readFileSync('supabase/proofs/d12/d12_manifest.json', 'utf8')); assert.equal(manifest.unit, 'D12_MANIFEST');
  for (const path of GENERATED) { const bytes = RAW(path); assert.equal(manifest.files[path].sha256, sha256(bytes), path); assert.equal(manifest.files[path].bytes, bytes.length, path); }
  assert.equal(manifest.inputs['supabase/proofs/d12/d12_pins.json'], sha256(RAW('supabase/proofs/d12/d12_pins.json'))); assert.equal(manifest.inputs['supabase/proofs/d12/d12_preimage.json'], sha256(RAW('supabase/proofs/d12/d12_preimage.json')));
  for (const path of [GENERATED[0], GENERATED[1]]) {
    const text = readFileSync(path, 'utf8'), wrapped = lib.wrapWithGuard(text), entry = manifest.guarded[path];
    assert.equal(sha256(wrapped), entry.guardedSha256, path + ': the guarded text of the JS mirror equals the generator'); assert.equal(Buffer.byteLength(wrapped), entry.guardedBytes); assert.equal(lib.guardText(text).length, entry.guardBytes);
    assert.ok(entry.guardedBytes <= 125000, 'one psql -c argument');
    // the guard proves what it says: the substring of the sent text the database hashes is the candidate, byte for byte
    const guard = lib.guardText(text), {start, tailStart, length, digest, tailPattern} = lib.guardArguments(guard);
    assert.equal(sha256(wrapped.substr(start - 1, length)), digest); assert.equal(start, guard.length + 1); assert.equal(tailStart, start + length); assert.equal(digest, sha256(lib.guardedSpan(text)), 'the guard hashes the candidate WITHOUT its trailing line feeds');
    assert.equal(entry.spanSha256, digest); assert.equal(entry.spanLength, length); assert.equal(entry.tailPattern, tailPattern); assert.equal(tailPattern, lib.GUARD_TAIL_PATTERN); assert.ok(text.endsWith('\n') && !lib.guardedSpan(text).endsWith('\n'));
    assert.notEqual(sha256(wrapped.replace(text.slice(-20), text.slice(-20).toUpperCase())), entry.guardedSha256, 'a changed byte is a different guarded text');
    assert.ok(/raise exception 'D12_APPLY_TEXT_INTEGRITY' using errcode='55000'/.test(guard));
  }
});

test('every weakening anchor occurs EXACTLY once in the live-shaped body it edits, and applying it changes the text', () => {
  const sources = {[lib.SIG.input]: functionBody('private.review_comment_input_v1'), [lib.SIG.guard]: functionBody('private.guard_review_comment_mutation'), [lib.SIG.moderate]: functionBody('public.rpc_moderate_review_comment_service_v1'),
    [lib.SIG.reader]: functionBody('public.rpc_list_review_comments_v1'), [lib.SIG.submitV2]: functionBody('public.rpc_submit_agreement_review_v2')};
  assert.equal(lib.WEAKENINGS.length, new Set(lib.WEAKENINGS.map(item => item.id)).size);
  for (const probe of lib.WEAKENINGS) {
    assert.ok(sources[probe.signature] !== undefined, 'a body for ' + probe.signature);
    if (probe.edits.length === 0) { assert.ok(probe.sqlBefore && probe.sqlAfter, probe.id + ': an ACL-only probe has its grant and its revoke'); continue; }
    const result = lib.applyEdits(sources[probe.signature], probe.edits); assert.equal(result.applied, true, `${probe.id}: ${result.reason}`); assert.notEqual(result.text, sources[probe.signature]);
    for (const edit of probe.edits) assert.equal(sources[probe.signature].split(edit.anchor).length - 1, 1, probe.id + ' anchor once');
  }
  const probed = new Set(lib.WEAKENINGS.map(item => item.id)); for (const id of ['W1_CONTACT_FLOOR_REMOVED', 'W2_LENGTH_BOUND_REMOVED', 'W3_CONTROL_AND_BIDI_CHECK_WEAKENED', 'W4_IMMUTABILITY_REMOVED', 'W5A_MODERATION_ACL_OPENED', 'W5B_MODERATION_ACL_AND_FUNCTION_CHECK_REMOVED',
    'W6_READER_BLOCK_GATE_REMOVED', 'W7_READER_HIDDEN_FILTER_REMOVED', 'W8_COMPLETION_GATE_REMOVED', 'W9_REQUEST_REUSE_CHECK_REMOVED', 'W10_PARTICIPANT_CHECK_REMOVED',
    'W13_DEFAULT_IGNORABLE_PLANE14_NARROWED_TO_THE_TAG_BLOCK', 'W14_VARIATION_SELECTORS_NO_LONGER_BLANK']) assert.ok(probed.has(id), id);
});

test('applyEdits refuses an anchor that is absent or ambiguous and never edits a copy of the text it was not given', () => {
  assert.equal(lib.applyEdits('a b c', [{anchor: 'x', replacement: 'y'}]).applied, false);
  assert.match(lib.applyEdits('a a', [{anchor: 'a', replacement: 'b'}]).reason, /ANCHOR_OCCURS_2_TIMES/);
  assert.equal(lib.applyEdits('a b', [{anchor: 'a', replacement: '$&$&'}]).text, '$&$& b', 'a replacement is literal text, never a pattern');
  assert.equal(lib.applyEdits('a b', [{anchor: 'a', replacement: 'a'}]).applied, false, 'an edit that changes nothing is not applied');
});

test('PostgREST outcome helpers: exact name + SQLSTATE + HTTP status', () => {
  const refused = (status, code, message) => ({status, error: {code, message}});
  assert.ok(lib.isRefusal(refused(400, '22023', 'REVIEW_COMMENT_INVALID'), 'REVIEW_COMMENT_INVALID', '22023', [400]));
  assert.ok(!lib.isRefusal(refused(400, '22023', 'REVIEW_COMMENT_INVALID'), 'REVIEW_COMMENT_TOO_LONG', '22023', [400]));
  assert.ok(!lib.isRefusal(refused(400, '22023', 'REVIEW_COMMENT_INVALID'), 'REVIEW_COMMENT_INVALID', '42501', [400]));
  assert.ok(!lib.isRefusal(refused(500, '22023', 'REVIEW_COMMENT_INVALID'), 'REVIEW_COMMENT_INVALID', '22023', [400]));
  assert.ok(!lib.isRefusal({status: 200, data: {}, error: null}, 'X', '22023'));
  assert.deepEqual(lib.statusesFor('22023'), [400]); assert.deepEqual(lib.statusesFor('42501'), [403]); assert.deepEqual(lib.statusesFor('42501', {anon: true}), [401, 403]); assert.deepEqual(lib.statusesFor('PT409'), [409]);
  assert.deepEqual(lib.statusesFor('55000'), [500]); assert.deepEqual(lib.statusesFor('P0001'), [400]); assert.deepEqual(lib.statusesFor('P0002'), [500]); assert.equal(lib.statusesFor('99999'), null);
  assert.ok(lib.sameOutcome(refused(403, '42501', 'x'), refused(403, '42501', 'x'))); assert.ok(!lib.sameOutcome(refused(403, '42501', 'x'), refused(403, '42501', 'y')));
});

test('psql verbose errors parse to {sqlstate, message} and nothing else', () => {
  assert.deepEqual(lib.parsePsqlError('ERROR:  42501: REVIEW_COMMENT_IMMUTABLE\nCONTEXT:  PL/pgSQL function private.guard_review_comment_mutation() line 12 at RAISE\nLOCATION:  exec_stmt_raise, pl_exec.c:3884\n'), {sqlstate: '42501', message: 'REVIEW_COMMENT_IMMUTABLE'});
  assert.deepEqual(lib.parsePsqlError('psql:x:1: ERROR:  PT409: REVIEW_COMMENT_MODERATION_CONFLICT'.replace('psql:x:1: ', '')), {sqlstate: 'PT409', message: 'REVIEW_COMMENT_MODERATION_CONFLICT'});
  assert.equal(lib.parsePsqlError('NOTICE: nothing'), null); assert.equal(lib.parsePsqlError(undefined), null);
});

const surfaceLine = (name, args, md5, tail = ':definer=true:volatility=v:config=search_path=pg_catalog:acl={postgres=X/postgres}') => `function:${name}(${args}):${md5}${tail}`;
const FAKE = n => String(n).padStart(32, '0');
function fakeSurface() {
  const before = [], after = [];
  for (const signature of lib.CHANGED_FUNCTIONS) { const [name, args] = signature.split(/\((.*)\)/); const identity = args === '' ? '' : args.split(',').map((type, index) => `p${index} ${type}`).join(', '); before.push(surfaceLine(name, identity, FAKE(1))); after.push(surfaceLine(name, identity, FAKE(2))); }
  const created = [];
  for (const signature of lib.NEW_FUNCTIONS) { const [name, args] = signature.split(/\((.*)\)/); const identity = args === '' ? '' : args.split(',').map((type, index) => `p${index} ${type}`).join(', '); created.push(surfaceLine(name, identity, FAKE(3))); }
  const table = [`table:${lib.TABLE}:rls=true:force=true:acl={postgres=arwdDxtm/postgres}`, ...lib.COLUMNS.map(name => `column:${lib.TABLE}.${name}:text:notnull=true:generated=`), ...lib.CONSTRAINTS.map(name => `constraint:${lib.TABLE}.${name}:${FAKE(4)}`),
    ...lib.TRIGGERS.map(name => `trigger:${lib.TABLE}.${name}:${FAKE(5)}:enabled=O`), ...lib.INDEXES.map(name => `index:private.${name}:${FAKE(6)}`)];
  return {removed: before, added: [...after, ...created, ...table], table};
}
test('the surface-delta classifier accepts exactly the reviewed delta and rejects any other line, a missing change or a missing new function', () => {
  const {removed, added, table} = fakeSurface();
  const ok = lib.classifySurfaceDelta(removed, added); assert.equal(ok.ok, true, JSON.stringify(ok)); assert.equal(ok.changedFunctions.length, 7); assert.equal(ok.newFunctions.length, 6); assert.equal(ok.newTableLines.length, table.length); assert.equal(table.length, 1 + 8 + 10 + 2 + 3);
  assert.equal(lib.classifySurfaceDelta(removed, [...added, 'policy:private.agreement_review_comments_v1.p:abc']).ok, false, 'a policy on the new table');
  assert.equal(lib.classifySurfaceDelta(removed, [...added, 'function:public.rpc_unrelated():' + FAKE(9) + ':definer=true']).ok, false, 'an extra function');
  assert.equal(lib.classifySurfaceDelta(removed, [...added, 'index:private.other_idx:' + FAKE(9)]).ok, false, 'an extra index');
  assert.equal(lib.classifySurfaceDelta([...removed, 'function:public.rpc_get_public_profile(p0 uuid):' + FAKE(7) + ':x'], added).ok, false, 'a legacy function changed (removed line)');
  assert.equal(lib.classifySurfaceDelta(removed.slice(1), added).ok, false, 'a rewritten function without its old line');
  assert.equal(lib.classifySurfaceDelta(removed, added.filter(line => !line.includes('rpc_moderate_review_comment_service_v1'))).ok, false, 'a missing new function');
});

test('the label wording: every pass line carries the chain label and the proof never claims DEV equality for the chain', () => {
  assert.match(lib.passLine('D12 PINS == DEV (47/47)', 'P2_X'), /^PASS \[D12 PINS == DEV \(47\/47\)\] P2_X$/);
  assert.match(lib.CHAIN_LACKS_TOKEN, /the chain lacks pkg051a/); assert.match(lib.CHAIN_LACKS_TOKEN, /chain-internal/); assert.ok(lib.CHAIN_LACKS.length >= 4);
});

test('the proof source ties together: every lib/pins name it uses exists, every `needs` key is assigned, every weakening predicate is implemented, every phase is present', () => {
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8');
  for (const match of proof.matchAll(/\blib\.([A-Za-z_][A-Za-z0-9_]*)/g)) assert.ok(match[1] in lib, 'lib.' + match[1]);
  for (const match of proof.matchAll(/\bpins\.([A-Za-z_][A-Za-z0-9_]*)/g)) assert.ok(match[1] in pins, 'pins.' + match[1]);
  const needs = new Set([...proof.matchAll(/needs: \[([^\]]*)\]/g)].flatMap(match => [...match[1].matchAll(/'([A-Za-z0-9_]+)'/g)].map(item => item[1])));
  for (const key of needs) assert.ok(new RegExp('state\\.' + key + '\\s*=[^=]').test(proof), 'state.' + key + ' is assigned');
  for (const probe of lib.WEAKENINGS) assert.ok(proof.includes(probe.predicate + ': async'), 'predicate implemented: ' + probe.predicate);
  for (const phase of ['P0_', 'P1_', 'P2_', 'P3_', 'P4_', 'P5_', 'P6_', 'P7_', 'P8_', 'P9_', 'P10_', 'P11A_', 'P11B_', 'P11C_', 'P11D_', 'P12_', 'P13_']) assert.ok(proof.includes("'" + phase) || proof.includes('`' + phase), 'phase ' + phase);
  // round-1 findings tied to the proof source (each would fail if the corresponding check were deleted)
  for (const token of ['psqlCommand(state.variants.guarded)', 'psqlCommand(state.revert.guarded)', 'assertOnlyInTheCommentTable', 'seedExportArtifact', 'D12_REVERT_CLOSURE_HISTORY_PRESENT'.replace('D12_REVERT_', ''), 'GUARD_TEXT_INTEGRITY',
    'ISOLATION_PROBE_IS_NOT_ROLLED_BACK', 'second wall parity', 'SUBJECT_BLOCKS_AUTHOR', 'AUTHOR_BLOCKS_SUBJECT', 'avatar-d12.jpg', 'THE_FUNCTION_AND_THE_TABLE_CHECKS_DISAGREE']) assert.ok(proof.includes(token), 'the proof carries the round-1 check ' + token);
  assert.ok(proof.includes('found.at(-1)') && !proof.includes("found.find(value => value !== pre)"), 'postMd5Of takes the post-state row (the last), never the first value that differs from the body pin');
});

test('the workflow covers every file the proof and its tests read and uses pinned actions only', () => {
  const workflow = readFileSync('.github/workflows/d12-review-comment-proof.yml', 'utf8');
  for (const path of ['.github/workflows/d12-review-comment-proof.yml', 'supabase/proofs/d12/**', 'supabase/candidates/d12_review_comment.sql', 'supabase/candidates/d12_review_comment_revert.sql', 'supabase/candidates/chat_voice_b1_dev_application.sql',
    'supabase/candidates/b24_nonretried_conflicts_part2_certified.sql', 'supabase/candidates/ex04a_own_tasks_page.sql', 'supabase/candidates/ex04b_own_applications_page.sql', 'supabase/candidates/ex04c_rating_state.sql', 'supabase/candidates/ex04d_candidates_page.sql', 'supabase/proofs/ex04/**',
    'supabase/proofs/pre_v3/closure_runtime.mjs', 'supabase/proofs/pre_v3/client_runtime.mjs', 'supabase/proofs/pre_v3/v5_closure_edge_runtime.mjs', 'supabase/proofs/pkg023/pkg023_surface.sql', 'supabase/functions/uskoci-account-closure-worker/**', 'src/data/reviewsClientService.ts', 'supabase/migrations/**'])
    assert.ok(workflow.includes("'" + path + "'"), 'the path filter names ' + path);
  for (const match of workflow.matchAll(/uses: ([A-Za-z0-9_.\/-]+)@([^\s]+)/g)) assert.match(match[2], /^[0-9a-f]{40}$/, 'a pinned action: ' + match[1]);
  for (const stage of ['03-source147', '18-pkg042-to-pkg050', '25-b3c-application', '26-b24-part2', '27-voice-b1-application', '28-ex04a', '29-ex04b', '30-ex04c', '31-ex04d']) assert.ok(workflow.includes(stage), 'stage ' + stage);
  assert.ok(workflow.includes('supabase stop --no-backup') && workflow.includes('if: always()'), 'every outcome destroys the disposable stack');
  assert.ok(workflow.includes('node supabase/proofs/d12/d12_proof.mjs') && workflow.includes('node --test supabase/proofs/d12/*.test.mjs') && workflow.includes('build_d12.py --check'));
  assert.ok(!/secrets\./.test(workflow), 'no secret is read');
});

test('the retention class text and the successor closure record are tied to the generated candidate: columns, scope, action, triggers, roster position, texts; the frozen 144 inventory is not edited', () => {
  const record = JSON.parse(readFileSync('docs/implementation/product-v1-closure-20260926/finalization-20260927/d12/D12_CLOSURE_INVENTORY_SUCCESSOR_20261001.json', 'utf8')), relation = record.relation;
  assert.equal(relation.relation, lib.TABLE); assert.deepEqual(relation.declaredCurrentColumns, [...lib.COLUMNS]); assert.equal(relation.proposedAction, 'DELETE'); assert.equal(relation.ownerScope, 'author_account_id=CLOSING_ACCOUNT'); assert.deepEqual(relation.contentColumns, ['comment']);
  assert.deepEqual(relation.staticTriggerDeclarations.map(item => item.name), [...lib.TRIGGERS]);
  assert.ok(APPLICATION.includes("when r='" + lib.TABLE + "' then 't.author_account_id=$1'"), 'the scope the record states is the scope the candidate writes');
  assert.ok(APPLICATION.includes("'public.app_accounts','" + lib.TABLE + "'"), 'the table is appended at the END of the roster, after public.app_accounts'); assert.equal(record.roster.before, 75); assert.equal(record.roster.after, 76);
  assert.equal(record.retentionClass.descriptionBefore, lib.RETENTION_DESCRIPTION_OLD); assert.equal(record.retentionClass.descriptionAfter, lib.RETENTION_DESCRIPTION_NEW);
  for (const text of [lib.RETENTION_DESCRIPTION_OLD, lib.RETENTION_DESCRIPTION_NEW]) { assert.ok(!text.includes("'"), 'no apostrophe: the text is quoted into SQL'); assert.ok(text.length >= 5 && text.length <= 500, 'the catalog CHECK retention_data_class_description_chk'); }
  for (const name of ['application', 'revert', 'preflight', 'postflight']) {
    const text = readFileSync(GENERATED[['application', 'revert', 'preflight', 'postflight'].indexOf(name)], 'utf8');
    assert.ok(text.includes("'" + lib.RETENTION_DESCRIPTION_NEW + "'") || name === 'preflight', name + ' carries the new description'); assert.ok(text.includes("'" + lib.RETENTION_DESCRIPTION_OLD + "'") || name === 'postflight', name + ' carries the predecessor description');
  }
  assert.ok(!lib.RETENTION_DESCRIPTION_NEW.replace('sets no retention period', '').match(/[0-9]+ ?(day|days|month|months|year|years)\b/i), 'the new text invents no period');
  const frozen = JSON.parse(readFileSync('docs/implementation/v5-ai-first/AF22_CLOSURE_INVENTORY_144.json', 'utf8'));
  assert.equal(frozen.relations.some(item => item.relation === lib.TABLE), false, 'the FROZEN 144 inventory is intentionally unchanged (v5_account_erasure_proof deep-equals its actual columns at its own historical stage)');
  assert.equal(frozen.relations.length, 115);
});

test('the second-wall parity run of the proof has enough cases on both sides (the thresholds in d12_proof.mjs are tied to the matrix)', () => {
  let accepted = 0, refused = 0;
  for (const item of lib.buildMatrix()) { if (typeof item.value !== 'string') continue; const outcome = lib.classifyComment(item.value); if (outcome.outcome === 'ACCEPTED') accepted += 1; else if (outcome.outcome === 'REFUSED' && ['REVIEW_COMMENT_INVALID', 'REVIEW_COMMENT_TOO_LONG'].includes(outcome.name)) refused += 1; }
  assert.ok(accepted >= 150 && refused >= 220, 'accepted ' + accepted + ', refused ' + refused);
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8'); assert.ok(proof.includes('functionAcceptedWallAccepted >= 150 && summary.functionRefusedWallViolated >= 220'), 'the proof thresholds are the ones asserted here');
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// ROUND 2 (security #1): the closed invisible-character classes cover the Unicode Default_Ignorable_Code_Point set
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const expand = ranges => { const set = new Set(); for (const [lo, hi] of ranges) for (let codePoint = lo; codePoint <= hi; codePoint++) set.add(codePoint); return set; };
const DEFAULT_IGNORABLE_RE = /\p{Default_Ignorable_Code_Point}/u;
const nodeDefaultIgnorable = () => { const found = new Set(); for (let codePoint = 0; codePoint <= 0x10FFFF; codePoint++) { if (codePoint >= 0xD800 && codePoint <= 0xDFFF) continue; if (DEFAULT_IGNORABLE_RE.test(String.fromCodePoint(codePoint))) found.add(codePoint); } return found; };

test('INDEPENDENT ORACLE: every Default_Ignorable_Code_Point (as THIS Node reads the Unicode property) is forbidden or one of the four allowed-inside groups; the documented table is the property of Unicode 17.0; the old class would have failed', () => {
  const oracle = nodeDefaultIgnorable(), forbidden = expand(lib.FORBIDDEN_RANGES), allowed = expand(lib.ALLOWED_INSIDE_RANGES), documented = expand(lib.DEFAULT_IGNORABLE_RANGES);
  assert.ok(oracle.size > 4000, 'the property was read: ' + oracle.size + ' code points (Unicode ' + process.versions.unicode + ')');
  const unclosed = [...oracle].filter(codePoint => !forbidden.has(codePoint) && !allowed.has(codePoint)); assert.deepEqual(unclosed.map(codePoint => 'U+' + codePoint.toString(16).toUpperCase()), [], 'a default-ignorable code point that is neither forbidden nor allowed inside would be storable as an empty-looking comment');
  assert.ok([...oracle].every(codePoint => documented.has(codePoint)), 'the documented table is a superset of the property this Node reads (a later Unicode version that adds one turns this red)');
  if (process.versions.unicode === lib.UNICODE_VERSION_OF_RECORD) assert.deepEqual([...documented].sort((a, b) => a - b), [...oracle].sort((a, b) => a - b), 'on the Unicode version of record the table EQUALS the property');
  // the allowed-inside groups are default-ignorable, not forbidden, blank alone and stripped for the floor; the forbidden class is exactly (default-ignorable minus allowed) plus the documented extras
  for (const codePoint of allowed) { assert.ok(documented.has(codePoint) && !forbidden.has(codePoint) && expand(lib.BLANK_RANGES).has(codePoint) && expand(lib.STRIP_RANGES).has(codePoint), 'allowed-inside group member U+' + codePoint.toString(16)); }
  const extras = expand(lib.FORBIDDEN_BEYOND_DEFAULT_IGNORABLE), expected = new Set([...[...documented].filter(codePoint => !allowed.has(codePoint)), ...extras]);
  assert.deepEqual([...forbidden].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), 'FORBIDDEN = (default-ignorable minus allowed-inside) + the controls, U+2028..U+2029, U+FFF9..U+FFFB and U+13430..U+1343F');
  assert.ok([...extras].every(codePoint => !documented.has(codePoint)), 'the extras are not default-ignorable');
  // the reviewed code points, each alone and inside a phone number, are no longer storable
  for (const codePoint of [0xE0100, 0x2065, 0x1D173, 0x13430, 0xFFF0, 0x1BCA0]) {
    const alone = String.fromCodePoint(codePoint), phone = 'zovi 064' + alone + '1234567';
    assert.equal(lib.classifyComment(alone).name, 'REVIEW_COMMENT_INVALID', 'alone U+' + codePoint.toString(16)); assert.equal(lib.classifyComment(phone).name, 'REVIEW_COMMENT_INVALID', 'inside a phone number U+' + codePoint.toString(16));
  }
  // the OLD classes (round-1 tables) leave exactly the reviewed gap: mutation proof that the oracle test is not vacuous
  const oldForbidden = [[0x0001, 0x0009], [0x000B, 0x001F], [0x007F, 0x009F], [0x061C, 0x061C], [0x115F, 0x1160], [0x17B4, 0x17B5], [0x180B, 0x180F], [0x200B, 0x200B], [0x200E, 0x200F], [0x2028, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F],
    [0x3164, 0x3164], [0xFEFF, 0xFEFF], [0xFFA0, 0xFFA0], [0xFFF9, 0xFFFB], [0xE0000, 0xE007F]], oldSet = expand(oldForbidden);
  const oldUnclosed = [...oracle].filter(codePoint => !oldSet.has(codePoint) && !allowed.has(codePoint)); for (const codePoint of [0xE0100, 0x2065, 0x1D173, 0xFFF0, 0x1BCA0]) assert.ok(oldUnclosed.includes(codePoint), 'the old class missed U+' + codePoint.toString(16));
});

test('the class tables in the lib equal the generator tables (build_d12.py) range for range, and the generator states the Unicode version of record', () => {
  const generator = readFileSync('supabase/proofs/d12/build_d12.py', 'utf8');
  const tableOf = name => { const match = new RegExp('^' + name + ' = \\[([^\\]]*)\\]', 'm').exec(generator); assert.ok(match, name); return [...match[1].matchAll(/\(0x([0-9A-Fa-f]+), 0x([0-9A-Fa-f]+)\)/g)].map(item => [parseInt(item[1], 16), parseInt(item[2], 16)]); };
  for (const [name, table] of [['FORBIDDEN_RANGES', lib.FORBIDDEN_RANGES], ['BLANK_RANGES', lib.BLANK_RANGES], ['STRIP_RANGES', lib.STRIP_RANGES], ['DEFAULT_IGNORABLE_RANGES', lib.DEFAULT_IGNORABLE_RANGES], ['ALLOWED_INSIDE_RANGES', lib.ALLOWED_INSIDE_RANGES],
    ['FORBIDDEN_BEYOND_DEFAULT_IGNORABLE', lib.FORBIDDEN_BEYOND_DEFAULT_IGNORABLE], ['DIGIT_SETS', lib.DIGIT_SETS]]) assert.deepEqual(tableOf(name), table.map(range => [...range]), name);
  assert.ok(generator.includes("UNICODE_VERSION_OF_RECORD = '" + lib.UNICODE_VERSION_OF_RECORD + "'"));
});

test('MUTATION of the class tables: narrowing the plane-14 range, removing the variation selectors from the blank class and adding the POSIX controls to it each turn the matrix red', () => {
  const mismatches = tables => lib.buildMatrix().filter(item => !lib.outcomeMatches(lib.classifyCommentWith(item.value, tables), item.expect)).map(item => item.id);
  assert.deepEqual(mismatches(lib.DEFAULT_TABLES), [], 'the real tables satisfy the whole matrix');
  const narrowed = {...lib.DEFAULT_TABLES, forbidden: lib.FORBIDDEN_RANGES.map(([lo, hi]) => lo === 0xE0000 ? [lo, 0xE007F] : [lo, hi])};
  const a = mismatches(narrowed); assert.ok(a.includes('inner_ideographic_variation_selector_ue0100') && a.includes('range_inner_uE0FFF') && a.includes('phone_split_by_ideographic_variation_selector_ue0100') && a.includes('neighbour_inner_uE1000') === false, 'plane 14 narrowed: ' + a.slice(0, 6));
  const noVs = {...lib.DEFAULT_TABLES, blank: lib.BLANK_RANGES.map(([lo, hi]) => lo === 0xFE00 ? [0xFE0E, hi] : [lo, hi])};
  const b = mismatches(noVs); assert.ok(b.includes('only_vs1') && b.includes('only_vs14') && b.includes('only_all_sixteen_variation_selectors'), 'variation selectors no longer blank: ' + b.slice(0, 6));
  const posix = {...lib.DEFAULT_TABLES, blank: [...lib.BLANK_RANGES, [0x1C, 0x1F]]};   // what POSIX [[:space:]] does in en_US.UTF-8
  const c = mismatches(posix); assert.ok(c.includes('alone_fs_u001c') && c.includes('alone_us_u001f') && c.includes('range_alone_u001F'), 'POSIX controls in the blank class: ' + c.slice(0, 6));
  const noExtras = {...lib.DEFAULT_TABLES, forbidden: lib.FORBIDDEN_RANGES.filter(([lo]) => lo !== 0x13430 && lo !== 0x1BCA0 && lo !== 0x1D173)};
  const d = mismatches(noExtras); assert.ok(d.includes('inner_hieroglyph_format_u13430') && d.includes('inner_shorthand_format_overlap_u1bca0') && d.includes('inner_musical_begin_beam_u1d173'), 'ranges dropped: ' + d.slice(0, 6));
});

test('the matrix exercises EVERY forbidden range at both ends, inside text and alone, and both neighbours; the blank rule and the allowed-inside groups are exercised', () => {
  const cases = lib.buildMatrix(), ids = new Set(cases.map(item => item.id)), hex = codePoint => codePoint.toString(16).toUpperCase().padStart(4, '0');
  for (const [lo, hi] of lib.FORBIDDEN_RANGES) for (const codePoint of [lo, hi]) { assert.ok(ids.has('range_inner_u' + hex(codePoint)) && ids.has('range_alone_u' + hex(codePoint)), 'endpoint U+' + hex(codePoint)); }
  for (const [lo, hi] of lib.FORBIDDEN_RANGES) for (const codePoint of [lo - 1, hi + 1]) if (codePoint >= 1) assert.ok(ids.has('neighbour_inner_u' + hex(codePoint)), 'neighbour U+' + hex(codePoint));
  for (const id of ['only_vs1', 'only_vs15', 'only_all_sixteen_variation_selectors', 'only_cr', 'only_vt', 'only_ff', 'alone_fs_u001c', 'alone_us_u001f', 'inside_zero_width_joiner', 'inside_variation_selector_14', 'phone_split_by_ideographic_variation_selector_ue0100',
    'phone_split_by_reserved_u2065', 'residual_phone_digits_split_by_combining_marks', 'residual_phone_devanagari_digits']) assert.ok(ids.has(id), id);
  assert.ok(cases.length >= 340, 'the matrix has ' + cases.length + ' cases');
  // a combining mark between digits and Devanagari digits are DOCUMENTED residuals (pinned, not blessed)
  for (const id of ['residual_phone_digits_split_by_combining_marks', 'residual_phone_devanagari_digits']) assert.deepEqual(cases.find(item => item.id === id).expect, {outcome: 'ACCEPTED'});
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// ROUND 2 (privacy #1): the closure fixtures are described as data and the rows they leave behind are derived from the description
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('the expected rows of each closure fixture are DERIVED from what the fixture does: the moderated WORKER fixture writes one audit row more, and the proof no longer hard-codes both', () => {
  const requester = lib.closureFixtureDescription('REQUESTER'), worker = lib.closureFixtureDescription('WORKER');
  assert.deepEqual(requester.moderation, []); assert.equal(lib.subjectIsHidden(requester), false); assert.equal(lib.subjectIsHidden(worker), true);
  assert.deepEqual(lib.expectedWritesOfClosureFixture(requester), {stars: 2, comments: 2, events: 2, audits: 2}, 'REQUESTER: two reviews, two audit rows');
  assert.deepEqual(lib.expectedWritesOfClosureFixture(worker), {stars: 2, comments: 2, events: 2, audits: 3}, 'WORKER: two reviews and ONE moderation audit row: 3');
  assert.deepEqual(lib.expectedWritesOfClosureFixture({reviews: worker.reviews, moderation: [...worker.moderation, {review: 'SUBJECT', action: 'RESTORE', reasonCode: null}]}).audits, 4, 'every applied action adds one audit row');
  assert.throws(() => lib.closureFixtureDescription('OTHER'), /D12_CLOSURE_FIXTURE_ROLE/);
  // the model is tied to the SQL: one audit row per submit (AGREEMENT_REVIEW_SUBMITTED, entity AGREEMENT) and one per CHANGING moderation action (HIDDEN / RESTORED, entity AGREEMENT), all matched by the LIKE the proof counts with
  const submit = functionBody('public.rpc_submit_agreement_review_v2'), moderate = functionBody('public.rpc_moderate_review_comment_service_v1');
  assert.equal(submit.split('private.audit_marketplace(').length - 1, 1); assert.ok(submit.includes("private.audit_marketplace(u,'" + lib.AUDIT_EVENT_TYPES.submit + "','AGREEMENT',a.id"));
  assert.equal(moderate.split('private.audit_marketplace(').length - 1, 1); assert.ok(moderate.includes("'" + lib.AUDIT_EVENT_TYPES.hide + "'") && moderate.includes("'" + lib.AUDIT_EVENT_TYPES.restore + "'") && moderate.includes("'AGREEMENT',v_agreement"));
  const like = new RegExp('^' + lib.REVIEW_AUDIT_LIKE.replace('%', '.*') + '$'); for (const name of Object.values(lib.AUDIT_EVENT_TYPES)) assert.match(name, like);
  assert.equal(moderate.split('perform private.audit_marketplace').length - 1, 1); assert.ok(moderate.indexOf("changed',false") < moderate.indexOf('perform private.audit_marketplace'), 'an unchanged repeat returns BEFORE the audit call: it writes no row');
  // the proof derives the counts from the description (it fails on the old hard-coded pair) and checks the moderation audit rows
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8');
  const fixtureCheck = proof.slice(proof.indexOf("await check('P9_FIXTURE_"), proof.indexOf("await check('P10_")); assert.ok(!fixtureCheck.includes('{stars: 2, comments: 2, events: 2, audits: 2}'), 'the old hard-coded pair is gone from the P9 fixture check (it asserted audits: 2 for BOTH fixtures)'); assert.ok(proof.includes('lib.expectedWritesOfClosureFixture(description)') && proof.includes('f.expectedWrites') && proof.includes('lib.closureFixtureDescription(role)'));
  assert.ok(proof.includes("like '" + lib.REVIEW_AUDIT_LIKE + "'"), 'the proof counts audit rows with the same LIKE the model is tied to'); assert.ok(proof.includes('THE_MODERATION_AUDIT_ROWS_ARE_UNCHANGED_BY_THE_AUTHORS_CLOSURE') && proof.includes('THE_MODERATION_AUDIT_ROW_CARRIES_NO_COMMENT_TEXT'));
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// ROUND 2 (certificate #3): the guard under the real connector trailer and a retyped text
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('the guard accepts the candidate with or without its final line feed and with the connector trailer, and refuses every other text (JS twin of the DO block over the real candidate)', () => {
  for (const path of [GENERATED[0], GENERATED[1]]) {
    const text = readFileSync(path, 'utf8'), guard = lib.guardText(text), wrapped = guard + text, noFinalLf = wrapped.replace(/\n+$/, '');
    assert.ok(text.endsWith(';\n'), path + ' ends with a line feed'); assert.ok(lib.CONNECTOR_TRAILER.startsWith('\n\n-- source: POST /mcp'));
    for (const [name, sent] of [['as generated', wrapped], ['without the final line feed (retyped)', noFinalLf], ['with the connector trailer', wrapped + lib.CONNECTOR_TRAILER], ['retyped and with the trailer', noFinalLf + lib.CONNECTOR_TRAILER],
      ['two final line feeds', wrapped + '\n'], ['trailer with a final line feed', wrapped + lib.CONNECTOR_TRAILER + '\n']]) assert.ok(lib.guardAccepts(sent, guard), path + ' ' + name);
    // refused: a changed byte in the candidate, a truncated candidate, anything before the guard, a statement or a space after the candidate, a carriage return that would end a comment, a block comment
    const middle = Math.floor(wrapped.length * 0.7);
    for (const [name, sent] of [['one changed character', wrapped.slice(0, middle) + (wrapped[middle] === 'x' ? 'y' : 'x') + wrapped.slice(middle + 1)], ['a truncated candidate', noFinalLf.slice(0, -5)], ['a prefix line', '-- x\n' + wrapped], ['a leading space', ' ' + wrapped],
      ['a statement after', wrapped + 'select 1;'], ['a statement after a newline', wrapped + '\nselect 1;'], ['a trailing space', noFinalLf + ' '], ['a comment then a statement', wrapped + '-- c\nselect 1;'], ['a carriage return inside a trailer comment', wrapped + '-- c\rselect 1;'],
      ['a block comment', wrapped + '/* c */'], ['a tab', noFinalLf + '\t'], ['CRLF line ends', wrapped.replace(/\n/g, '\r\n')]]) assert.equal(lib.guardAccepts(sent, guard), false, path + ' refuses ' + name);
  }
  // the DO block carries the named error and the tail pattern, and the generator's guard equals the twin
  const guard = lib.guardText(readFileSync(GENERATED[0], 'utf8')); assert.ok(guard.includes("raise exception 'D12_APPLY_TEXT_INTEGRITY' using errcode='55000'") && guard.includes(" or rest !~ '" + lib.GUARD_TAIL_PATTERN + "' then "));
  // the proof runs the guard on the real database with the trailer, without the final line feed and with refused texts
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8');
  for (const token of ['P2_THE_GUARD_ACCEPTS_THE_TEXT_WITH_OR_WITHOUT_ITS_FINAL_LINE_FEED', 'WITH_A_CONNECTOR_TRAILER', 'TEXT_BEFORE_THE_GUARD', 'A_STATEMENT_AFTER_THE_CANDIDATE', 'lib.CONNECTOR_TRAILER']) assert.ok(proof.includes(token), token);
});

test('the guard tail check of the JS twin (no backtracking) accepts exactly the language of the regular expression the DO block carries, over every string of length <= 7 on a six-character alphabet', () => {
  const alphabet = ['-', '\n', '\r', 'a', ' ', ';']; let checked = 0, accepted = 0;
  const walk = (prefix, depth) => { const regex = lib.GUARD_TAIL_RE.test(prefix), twin = lib.guardTailOk(prefix); assert.equal(twin, regex, JSON.stringify(prefix)); checked += 1; if (regex) accepted += 1; if (depth < 7) for (const letter of alphabet) walk(prefix + letter, depth + 1); };
  walk('', 0); assert.ok(checked > 300000 && accepted > 50, 'a real language was compared: ' + checked + ' strings, ' + accepted + ' accepted');
  assert.equal(lib.GUARD_TAIL_PATTERN, lib.GUARD_TAIL_RE.source, 'the pattern text the DO block carries is the source of the regular expression'); assert.ok(lib.guardTailOk(lib.CONNECTOR_TRAILER) && lib.guardTailOk('') && lib.guardTailOk('\n\n') && !lib.guardTailOk(' ') && !lib.guardTailOk('-- c\rselect 1;'));
});

test('P11: the proof no longer expects a policy on the comment table to move the closure digest (it does not) and states the known limit instead', () => {
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8'), drift = proof.slice(proof.indexOf("await check('P11D_"), proof.indexOf("await check('P11E_"));
  assert.ok(!drift.includes('PERMISSIVE_POLICY_ADDED'), 'the wrong probe is gone from the drift matrix'); for (const name of ['CONSTRAINT_DROPPED', 'CERTIFIED_FUNCTION_AUTHORITY_CHANGED', 'CERTIFIED_FUNCTION_BODY_CHANGED', 'UNREVIEWED_TABLE', 'TABLE_MADE_CLIENT_READABLE', 'FORCE_RLS_REMOVED']) assert.ok(drift.includes(name), name + ' stays');
  const known = proof.slice(proof.indexOf("await check('P11E_")); assert.ok(known.includes("'true:false'") && known.includes('COMMENT_TABLE_DRIFT') && known.includes("'42501'") && known.includes('certificate_does_not_cover_policies_of_the_comment_table'));
  // the postflight does name a policy on the table: its table-shape predicate demands no policy
  const postflight = readFileSync('supabase/proofs/d12/d12_postflight.readonly.sql', 'utf8'); assert.ok(/select 'COMMENT_TABLE_DRIFT'[\s\S]{0,900}pg_policies where schemaname='private' and tablename='agreement_review_comments_v1'/.test(postflight));
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// ROUND 2: the repository attributes and the documented (not decided) consequences
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('.gitattributes keeps the generated candidate, the revert and the D12 proof files LF (a CRLF checkout would change every sha256 and make --check and --wrap refuse), next to the ex06 lines', () => {
  const attributes = readFileSync('.gitattributes', 'utf8').replace(/\r\n/g, '\n'), lines = attributes.split('\n');
  for (const line of ['supabase/candidates/d12_*.sql text eol=lf', 'supabase/proofs/d12/d12_*.sql text eol=lf', 'supabase/proofs/d12/d12_manifest.json text eol=lf', 'supabase/proofs/d12/d12_pins.json text eol=lf', 'supabase/proofs/d12/d12_preimage.json text eol=lf',
    'supabase/proofs/d12/sql/*.sql text eol=lf', 'supabase/proofs/d12/build_d12.py text eol=lf', 'supabase/proofs/d12/*.mjs text eol=lf', 'supabase/proofs/d12/*.md text eol=lf']) assert.ok(lines.includes(line), 'a line: ' + line);
  const at = lines.indexOf('supabase/candidates/d12_*.sql text eol=lf'), ex06 = lines.indexOf('supabase/candidates/ex06*.sql text eol=lf'); assert.ok(at > ex06 && at - ex06 < 8, 'the D12 lines sit next to the ex06 lines');
  assert.ok(lines[at - 1].startsWith('# D12 written-comment candidate and revert') && /body md5 pins|sha256/.test(lines[at - 1]), 'with a rationale comment');
});

test('the DOCUMENTED findings are written where the approval block can quote them: the shadow comment with its options, the aggregate inference, the log channel, the text-class consequences, the policy limit, the guard and the pins at risk', () => {
  const candidate = readFileSync('supabase/proofs/d12/README_D12_CANDIDATE.md', 'utf8'), proofReadme = readFileSync('supabase/proofs/d12/README_D12_PROOF.md', 'utf8'), defects = readFileSync('supabase/proofs/d12/CANDIDATE_DEFECTS_FOUND_BY_PROOF_AUTHOR.md', 'utf8');
  const accept = candidate.slice(candidate.indexOf("## What the owner's PRIMENI must knowingly accept"), candidate.indexOf('## Not proven'));
  for (const phrase of ['SHADOW COMMENT WITH A FREE BLOCK', 'costs the author nothing', 'the only remedy is the HIDE', '**(A)**', '**(B)**', '**(C)**', '**(D)**', 'NONE implemented', 'THE PUBLIC AGGREGATE NEXT TO INDIVIDUAL RATINGS', 'by subtraction', 'about 100 reviews', 'must not be used in the store text',
    'bind parameter', 'log_min_duration_statement', 'NOT checked', 'Devanagari', 'combining mark', 'U+0332', 'ideographic variation', 'Unicode version of record is 17.0', 'private use, noncharacters and unassigned', 'outside the closure certificate'])
    assert.ok(accept.includes(phrase), 'the PRIMENI list says: ' + phrase);
  for (const phrase of ['U+001C..U+001F are NOT blank', 'D12_APPLY_TEXT_INTEGRITY', '^(\\n|--[^\\n\\r]*)*$', 'COMMENT_TABLE_DRIFT', 'D12_PIN_GATE_ONLY=1', 'MASKED md5', 'measured read-only']) assert.ok(candidate.includes(phrase), 'the candidate README says: ' + phrase);
  for (const phrase of ['private.closure_erasure_assert_current_v5', 'private.accounts_same_world', 'b24_nonretried_conflicts_part1.sql', 'D12_PIN_GATE_ONLY=1', 'bc85a1a744869abb6441e647b18b2195']) assert.ok(proofReadme.includes(phrase), 'the proof README says: ' + phrase);
  for (const id of ['certificate#1', 'certificate#2', 'certificate#3', 'certificate#4', 'certificate#5', 'certificate#6', 'privacy#1', 'privacy#2', 'privacy#3', 'privacy#4', 'security#1', 'security#2', 'security#3', 'security#4']) assert.ok(defects.slice(defects.indexOf('## Round-2 findings')).includes('| ' + id + ' |'), 'the round-2 table of the defects file has ' + id);
  // the sentence that is NOT true is gone from the reader's own comment and appears in the README only as the withdrawn claim
  assert.ok(!functionBody('public.rpc_list_review_comments_v1').includes('stays aggregate-only'), 'the reader comment no longer promises aggregate-only'); assert.equal(candidate.split('star-only reviews stay aggregate-only').length - 1, 1); assert.ok(accept.includes('is therefore NOT true'));
  // the reader's in-body comment carries the shadow-comment consequence for the owner who reads the candidate
  assert.ok(functionBody('public.rpc_list_review_comments_v1').includes('KNOWN CONSEQUENCE (owner-visible, NOT decided here)') && functionBody('public.rpc_list_review_comments_v1').includes('the block costs the author nothing'));
  // the shadow comment is the IMPLEMENTED default: the proof pins it (gate c2) and the reader gates the viewer-versus-author pair symmetrically
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8'); assert.ok(proof.includes("'AUTHOR_BLOCKS_SUBJECT'") && proof.includes('[C.t, t, without(C.text.c1)]')); assert.ok(functionBody('public.rpc_list_review_comments_v1').includes('and not private.safety_pair_blocked(v_actor,c.author_account_id)'));
});

test('round 3 / certificate 1: no generated file compares pg_get_constraintdef or a regclass text without the search-path normalisation (the application runs under search_path = pg_catalog)', () => {
  for (const file of ['supabase/candidates/d12_review_comment.sql', 'supabase/candidates/d12_review_comment_revert.sql', 'supabase/proofs/d12/d12_preflight.readonly.sql', 'supabase/proofs/d12/d12_postflight.readonly.sql']) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/pg_get_constraintdef\(/g)) {
      const before = text.slice(Math.max(0, match.index - 8), match.index);
      assert.ok(before.endsWith('replace('), file + ': pg_get_constraintdef( without the replace( normalisation at offset ' + match.index);
    }
    if (text.includes('pg_get_constraintdef(')) assert.ok(text.includes("'REFERENCES public.','REFERENCES '"), file + ': the normalisation literal is missing');
  }
});

test('round 3 / certificate 1 mutation: the old un-normalised text is caught by the same scan', () => {
  const old = "md5(string_agg(conname||':'||pg_get_constraintdef(oid),';' order by conname))";
  assert.equal(old.slice(old.indexOf('pg_get_constraintdef(') - 8, old.indexOf('pg_get_constraintdef(')).endsWith('replace('), false);
});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// AFTER THE FIRST CI RUN (36949455489): the anonymous comparison, the noncharacters and the ASCII text transport
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
test('first CI run / ANON_IDENTICAL: the platform refusal quotes the CALLED function; the comparison masks the called name, requires each message to name its own function and everything else to be identical', () => {
  const legacy = {status: 401, error: {code: '42501', message: 'permission denied for function rpc_submit_agreement_review'}}, v2 = {status: 401, error: {code: '42501', message: 'permission denied for function rpc_submit_agreement_review_v2'}};
  // the observed pair of the first run: byte-different messages, identical once the called name is masked
  assert.equal(lib.sameOutcome(legacy, v2), false, 'the plain comparison fails on exactly this pair (the CI observation)');
  assert.equal(lib.sameOutcomeMaskingFunction(legacy, 'rpc_submit_agreement_review', v2, 'rpc_submit_agreement_review_v2'), true);
  assert.equal(lib.maskFunctionName(legacy.error.message, 'rpc_submit_agreement_review'), 'permission denied for function <FUNCTION>');
  assert.equal(lib.maskFunctionName(v2.error.message, 'rpc_submit_agreement_review_v2'), 'permission denied for function <FUNCTION>');
  // the legacy name is a whole identifier: it does not match inside the v2 name, so the v2 message is NOT the legacy function's refusal
  assert.equal(lib.namesFunction(v2.error.message, 'rpc_submit_agreement_review'), false); assert.equal(lib.namesFunction(legacy.error.message, 'rpc_submit_agreement_review_v2'), false);
  assert.equal(lib.sameOutcomeMaskingFunction(v2, 'rpc_submit_agreement_review', legacy, 'rpc_submit_agreement_review_v2'), false, 'a refusal that names the OTHER function fails');
  // MUTATIONS: every other difference still fails
  const mutate = patch => ({status: 401, error: {code: '42501', message: 'permission denied for function rpc_submit_agreement_review_v2', ...patch.error}, ...patch.top});
  assert.equal(lib.sameOutcomeMaskingFunction(legacy, 'rpc_submit_agreement_review', mutate({top: {status: 403}, error: {}}), 'rpc_submit_agreement_review_v2'), false, 'a different HTTP status');
  assert.equal(lib.sameOutcomeMaskingFunction(legacy, 'rpc_submit_agreement_review', mutate({error: {code: '42883'}}), 'rpc_submit_agreement_review_v2'), false, 'a different SQLSTATE');
  assert.equal(lib.sameOutcomeMaskingFunction(legacy, 'rpc_submit_agreement_review', mutate({error: {message: 'permission denied for table rpc_submit_agreement_review_v2'}}), 'rpc_submit_agreement_review_v2'), false, 'a different sentence');
  assert.equal(lib.sameOutcomeMaskingFunction(legacy, 'rpc_submit_agreement_review', {status: 200, error: null}, 'rpc_submit_agreement_review_v2'), false, 'a success is not a refusal');
  assert.equal(lib.sameOutcomeMaskingFunction({status: 200, error: null}, 'a', {status: 200, error: null}, 'b'), false, 'two successes are not two refusals');
  // a name with a regular-expression metacharacter is matched literally
  assert.equal(lib.namesFunction('permission denied for function a.b', 'a.b'), true); assert.equal(lib.namesFunction('permission denied for function axb', 'a.b'), false);
  // the proof uses it for the anonymous pair, and pins each refusal exactly
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8');
  assert.ok(proof.includes("lib.sameOutcomeMaskingFunction(anonL, 'rpc_submit_agreement_review', anonN, 'rpc_submit_agreement_review_v2')") && proof.includes('ANON_IDENTICAL_EXCEPT_THE_CALLED_FUNCTION_NAME'));
  assert.ok(proof.includes("'permission denied for function rpc_submit_agreement_review', '42501'") && proof.includes("'permission denied for function rpc_submit_agreement_review_v2', '42501'"));
  assert.ok(!proof.includes('lib.sameOutcome(anonL, anonN)'), 'the plain comparison of the two anonymous refusals is gone');
});

test('first CI run / noncharacters: the 66 Unicode noncharacters equal the Unicode property as THIS Node reads it, none is in a class table, and every one is an explicit matrix case whose expectation is derived from the tables', () => {
  const oracle = []; for (let codePoint = 0; codePoint <= 0x10FFFF; codePoint++) if (/\p{Noncharacter_Code_Point}/u.test(String.fromCodePoint(codePoint))) oracle.push(codePoint);
  assert.equal(oracle.length, 66); assert.deepEqual([...lib.NONCHARACTERS].sort((a, b) => a - b), oracle, 'U+FDD0..U+FDEF and U+xFFFE/U+xFFFF of the 17 planes');
  const cases = lib.buildMatrix(), by = id => cases.find(item => item.id === id), hex = codePoint => codePoint.toString(16).toUpperCase().padStart(4, '0');
  for (const codePoint of oracle) {
    assert.ok(!lib.inRanges(lib.FORBIDDEN_RANGES, codePoint) && !lib.inRanges(lib.BLANK_RANGES, codePoint) && !lib.inRanges(lib.STRIP_RANGES, codePoint), 'DECISION PINNED (the closed forbidden class is not widened): U+' + hex(codePoint) + ' is in no class table');
    const inner = by('noncharacter_inner_u' + hex(codePoint)); assert.ok(inner, 'an inner case for U+' + hex(codePoint)); assert.equal(inner.value, 'a' + String.fromCodePoint(codePoint) + 'b'); assert.deepEqual(inner.expect, {outcome: 'ACCEPTED'}, 'accepted verbatim');
  }
  // the code point of the first CI observation is exercised both as a neighbour of the plane-14 block and as a noncharacter
  assert.deepEqual(by('neighbour_inner_uDFFFF').expect, {outcome: 'ACCEPTED'}); assert.deepEqual(by('noncharacter_inner_uDFFFF').expect, {outcome: 'ACCEPTED'}); assert.deepEqual(by('noncharacter_alone_uDFFFF').expect, {outcome: 'ACCEPTED'});
  const adjacent = by('noncharacter_next_to_the_plane_14_block_and_its_first_member'); assert.deepEqual(adjacent.expect, lib.classifyComment(adjacent.value), 'next to a forbidden character the whole text is refused'); assert.equal(adjacent.expect.name, 'REVIEW_COMMENT_INVALID');
  assert.equal(lib.codePoints(by('noncharacter_all_fdd0_to_fdef_in_one_text').value), 32); assert.equal(lib.codePoints(by('noncharacter_all_plane_ends_in_one_text').value), 34);
  assert.deepEqual(by('residual_phone_split_by_a_noncharacter').expect, {outcome: 'ACCEPTED'}); assert.equal(by('residual_phone_split_by_a_noncharacter').group, 'KNOWN_RESIDUAL');
  // the expectation really is DERIVED: if a table named a noncharacter the same cases flip (nothing is written by hand)
  const widened = {...lib.DEFAULT_TABLES, forbidden: [...lib.FORBIDDEN_RANGES, [0xFFFF, 0xFFFF]]};
  assert.equal(lib.classifyCommentWith('a' + String.fromCodePoint(0xFFFF) + 'b', widened).name, 'REVIEW_COMMENT_INVALID'); assert.equal(lib.classifyComment('a' + String.fromCodePoint(0xFFFF) + 'b').outcome, 'ACCEPTED');
  // the mirror: a one-character comment of a noncharacter is a comment (not blank, not forbidden)
  for (const codePoint of [0xFDD0, 0xFFFE, 0xFFFF, 0xDFFFF, 0x10FFFF]) assert.deepEqual(lib.classifyComment(String.fromCodePoint(codePoint)), {outcome: 'ACCEPTED', value: String.fromCodePoint(codePoint)});
});

test('first CI run / transport: every script that carries a text TO or reads a text FROM the database for a verdict is pure ASCII, the raw probe is the only exception, and assertAscii refuses a non-ASCII script by code point', () => {
  const cases = lib.buildMatrix(), items = lib.transportCanaries();
  const scripts = {matrix: lib.matrixScript(lib.matrixPayload(cases)), wall: lib.wallScript(lib.matrixPayload(cases.filter(item => typeof item.value === 'string')), '00000000-0000-0000-0000-000000000001'), ascii: lib.transportAsciiScript(items), rawOut: lib.transportRawOutScript(items)};
  for (const [name, script] of Object.entries(scripts)) { assert.ok(lib.isAscii(script), name + ' script is pure ASCII'); assert.equal(lib.assertAscii(script, name), script); assert.ok(!/[\x00-\x08\x0B-\x1F\x7F]/.test(script), name + ': no control character'); assert.ok(!script.includes('\r'), name); }
  const rawIn = lib.transportRawInScript(items); assert.equal(lib.isAscii(rawIn), false, 'the raw input probe carries the characters themselves (that is what it measures)');
  assert.throws(() => lib.assertAscii(rawIn, 'rawIn'), /TRANSPORT_NOT_ASCII rawIn: U\+[0-9A-F]+/);
  assert.throws(() => lib.assertAscii('select ' + String.fromCodePoint(0xDFFFF), 'x'), /TRANSPORT_NOT_ASCII x: U\+DFFFF/);
  // the SQL of the verdict paths: base64 in, decoded in SQL; hex out; the digest of the decoded input; never the characters themselves
  assert.ok(scripts.matrix.includes("convert_from(decode(x.b64, 'base64'), 'UTF8')") && scripts.matrix.includes("'value_hex', case when v is null then null else encode(convert_to(v, 'UTF8'), 'hex') end") && scripts.matrix.includes("encode(sha256(convert_to(c.json, 'UTF8')), 'hex')"));
  assert.ok(!scripts.matrix.includes("'value', v") && !scripts.matrix.includes('json text'), 'the old raw text path is gone');
  assert.ok(scripts.wall.includes("convert_from(decode(x.b64, 'base64'), 'UTF8')") && !scripts.wall.includes('json text'));
  assert.ok(scripts.rawOut.includes("jsonb_build_object('id', x.id, 't', t.v)"), 'only the measuring probe reads characters back');
  // the payload of a case is the base64 of the UTF-8 octets of ITS JSON text (the id is an ASCII identifier, the order is the position)
  const payload = lib.matrixPayload(cases); assert.equal(payload.length, cases.length);
  payload.forEach((entry, index) => { assert.equal(entry.id, cases[index].id); assert.ok(/^[A-Za-z0-9_]+$/.test(entry.id), 'ASCII identifier ' + entry.id); assert.equal(entry.ord, index); assert.equal(Buffer.from(entry.b64, 'base64').toString('utf8'), lib.caseJson(cases[index].value)); assert.equal(entry.sql_null, cases[index].sqlNull === true); });
  assert.ok(payload.some(entry => entry.sql_null), 'the SQL NULL case keeps its own flag');
});

test('first CI run / transport: the ASCII path is byte exact for every noncharacter, every matrix text and a sweep of every Unicode scalar value (what the SQL decode and the hex answer do, done here with the same octets)', () => {
  const cases = lib.buildMatrix().filter(item => typeof item.value === 'string' || item.value === null);
  for (const item of cases) {
    const json = lib.caseJson(item.value), arrived = Buffer.from(lib.utf8Base64(json), 'base64');
    assert.equal(arrived.toString('hex'), Buffer.from(json, 'utf8').toString('hex')); assert.equal(lib.sha256Hex(arrived.toString('utf8')), lib.matrixInputDigest(item), 'the digest the database reports is the digest of what was sent: ' + item.id);
    if (typeof item.value === 'string') { assert.equal(lib.fromUtf8Hex(lib.utf8Hex(item.value)), item.value); assert.equal(JSON.parse(arrived.toString('utf8')), item.value); }
  }
  for (const codePoint of lib.NONCHARACTERS) { const text = 'a' + String.fromCodePoint(codePoint) + 'b'; assert.equal(lib.utf8Hex(text).length, 2 * Buffer.byteLength(text, 'utf8')); assert.equal(lib.fromUtf8Hex(lib.utf8Hex(text)), text); assert.equal(lib.codePoints(text), 3); }
  // every Unicode scalar value, in chunks of 4096, as base64 and as hex (no database: this proves the helpers, not the server)
  for (let start = 1; start <= 0x10FFFF; start += 4096) {
    const chunk = []; for (let codePoint = start; codePoint < Math.min(start + 4096, 0x110000); codePoint++) if (codePoint < 0xD800 || codePoint > 0xDFFF) chunk.push(String.fromCodePoint(codePoint)); const text = chunk.join('');
    assert.equal(Buffer.from(lib.utf8Base64(text), 'base64').toString('utf8'), text); assert.equal(lib.fromUtf8Hex(lib.utf8Hex(text)), text);
  }
  // through a real child process (a stand-in for a byte-exact psql): the matrix script survives as bytes
  const script = lib.matrixScript(lib.matrixPayload(lib.buildMatrix())), echoed = execFileSync(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], {input: script, maxBuffer: 1 << 26});
  assert.equal(echoed.toString('hex'), Buffer.from(script, 'utf8').toString('hex'));
});

test('first CI run / transport REGRESSION: a raw hop that drops noncharacters (the first CI observation: the text came back as ab) changes every raw script and leaves every ASCII script untouched; the verdict names the loss', () => {
  const lossyHop = text => text.replace(/\p{Noncharacter_Code_Point}/gu, '');
  const sent = 'a' + String.fromCodePoint(0xDFFFF) + 'b';
  assert.equal(lossyHop(sent), 'ab', 'the observed symptom');
  const cases = lib.buildMatrix(), items = lib.transportCanaries();
  // the OLD transport (the characters inside the script) is changed by the lossy hop: the observed value is not the sent value
  const oldPayload = JSON.stringify(cases.map((item, ord) => ({id: item.id, ord, sql_null: item.sqlNull === true, json: lib.caseJson(item.value)})));
  assert.notEqual(lossyHop(oldPayload), oldPayload, 'the old raw payload does not survive such a hop'); assert.notEqual(lossyHop(lib.transportRawInScript(items)), lib.transportRawInScript(items));
  // the NEW transport is immune to the same hop, script by script
  for (const script of [lib.matrixScript(lib.matrixPayload(cases)), lib.wallScript(lib.matrixPayload(cases), '00000000-0000-0000-0000-000000000001'), lib.transportAsciiScript(items), lib.transportRawOutScript(items)]) assert.equal(lossyHop(script), script);
  // the answer of the database as the proof reads it (hex): a lossy hop cannot touch it either, and the verdict function reports exactly this mutation
  const item = cases.find(entry => entry.id === 'neighbour_inner_uDFFFF'), exact = {valueHex: lib.utf8Hex(item.value), valueChars: 3};
  assert.equal(lib.acceptedTextDiffers(item, exact), false); assert.equal(lib.acceptedTextDiffers(item, {valueHex: lib.utf8Hex('ab'), valueChars: 2}), true, 'the first-run observation is a verdict failure');
  assert.equal(lib.acceptedTextDiffers(item, {valueHex: lib.utf8Hex(item.value), valueChars: 2}), true, 'the character count alone also fails'); assert.equal(lib.acceptedTextDiffers(item, {valueHex: lib.utf8Hex('a' + String.fromCodePoint(0xDFFFE) + 'b'), valueChars: 3}), true, 'another noncharacter is not the sent one');
  assert.equal(lossyHop(exact.valueHex), exact.valueHex);
  // lostCases names the hop result: the missing code point and nothing else
  assert.deepEqual(lib.lostCases([{id: 'x', value: sent}, {id: 'y', value: 'ab'}], new Map([['x', lib.utf8Hex('ab')], ['y', lib.utf8Hex('ab')]])), [{id: 'x', missing: ['U+DFFFF']}]);
  assert.deepEqual(lib.lostCases([{id: 'x', value: sent}], new Map()), [{id: 'x', missing: ['U+0061', 'U+DFFFF', 'U+0062']}], 'an absent answer loses everything');
});

test('first CI run / the proof wires the transport: the matrix, the second wall and the stored text of the real path use it, the transport is measured before the matrix, and no raw payload quote is left', () => {
  const proof = readFileSync('supabase/proofs/d12/d12_proof.mjs', 'utf8');
  for (const needle of ['lib.matrixScript(lib.matrixPayload(cases))', 'lib.wallScript(lib.matrixPayload(stringCases), review.id)', 'lib.acceptedTextDiffers(item, observed)', 'lib.matrixInputDigest(cases[index])', 'THE_DATABASE_DECODED_EXACTLY_THE_TEXT_THAT_WAS_SENT',
    'lib.transportCanaries()', 'lib.transportAsciiScript(items)', 'lib.transportRawInScript(items)', 'lib.transportRawOutScript(items)', 'lib.lostCases(', 'THE_ASCII_TRANSPORT_IS_BYTE_EXACT', "encode(convert_to(comment, 'UTF8'), 'hex')"]) assert.ok(proof.includes(needle), 'the proof uses ' + needle);
  for (const old of ['q(JSON.stringify(payload))', 'q(JSON.stringify(cases))', "'value', v)", 'json: lib.caseJson(item.value)}))', "assert.equal(row.comment, item.value, 'THE_STORED_TEXT_IS_VERBATIM"]) assert.ok(!proof.includes(old), 'the old raw path is gone: ' + old);
  assert.ok(proof.indexOf("await check('P4_THE_TEXT_TRANSPORT_OF_THE_MATRIX") < proof.indexOf("await check('P4_THE_VALIDATION_MATRIX_THROUGH_THE_SQL_FUNCTION"), 'the transport is measured before the matrix runs');
  // the three noncharacters of the real PostgREST path and the noncharacter group assertion
  for (const id of ['noncharacter_inner_uFDD0', 'noncharacter_inner_uDFFFF', 'noncharacter_inner_u10FFFF']) { assert.ok(proof.includes("'" + id + "'"), id); assert.ok(lib.buildMatrix().some(item => item.id === id), id); }
  assert.ok(proof.includes("'NONCHARACTERS']) assert.ok(groups[group]?.total > 0") && proof.includes('THE_NONCHARACTER_GROUP_HAS_CASES_ON_BOTH_SIDES'));
  // the proof text states the real matrix counts
  const counts = {accepted: 0, refused: 0}; for (const item of lib.buildMatrix()) if (typeof item.value === 'string') { const outcome = lib.classifyComment(item.value); if (outcome.outcome === 'ACCEPTED') counts.accepted += 1; else if (outcome.outcome === 'REFUSED' && ['REVIEW_COMMENT_INVALID', 'REVIEW_COMMENT_TOO_LONG'].includes(outcome.name)) counts.refused += 1; }
  assert.ok(proof.includes('the matrix has ' + counts.accepted + ' accepted and ' + counts.refused + ' refused string cases'), 'the proof text states the real counts ' + JSON.stringify(counts));
});
