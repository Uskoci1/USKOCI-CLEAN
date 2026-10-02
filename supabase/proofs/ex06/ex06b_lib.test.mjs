// Offline tests of the EX-06 ex06b package (no database, no network): the generated files against their own rules and against each other, the independent JavaScript model against the SQL the generator wrote,
// the corpus v1.1 against both classifications and against the real S03 loader, the pass analysis, the mutation tests that show the checks fail when they should.
// node --test supabase/proofs/ex06/ex06b_lib.test.mjs
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {classifyFields, namesCause} from './lib/compare.mjs';
import {normaliseCorpus, referenceWorkerPlan} from './lib/corpus.mjs';
import {registryFromSource} from './lib/test_support.mjs';
import * as ex06a from './ex06a_lib.mjs';
import * as lib from './ex06b_lib.mjs';

const here = path => fileURLToPath(new URL(path, import.meta.url));
const read = path => readFileSync(here(path), 'utf8').replace(/\r\n/g, '\n');
const sha = text => createHash('sha256').update(text).digest('hex');
const md5 = text => createHash('md5').update(text).digest('hex');
const files = {
  candidate: read('../../candidates/ex06b_alias_registry.sql'), revert: read('../../candidates/ex06b_alias_registry_revert.sql'), preflight: read('ex06b_preflight.readonly.sql'),
  postflight: read('ex06b_postflight.readonly.sql'), plainApply: read('s06/guarded/ex06b_alias_registry.plain_guard.sql'), plainRevert: read('s06/guarded/ex06b_alias_registry_revert.plain_guard.sql'),
  migrationApply: read('s06/guarded/ex06b_alias_registry.apply_migration_guard.sql'), migrationRevert: read('s06/guarded/ex06b_alias_registry_revert.apply_migration_guard.sql'),
};
const manifest = JSON.parse(read('s06/ex06b_manifest.json'));
const devBody = read('s06/ex06b_work_kinds_v5_dev_body.txt');
const pkg031b = read('../../candidates/pkg031b_work_kinds_for_matching.sql');
const corpus11Text = read('s06/ex06_contract_corpus_v1_1.json');
const corpus11 = JSON.parse(corpus11Text);
const corpus1Text = read('../ai/corpus/ex06_contract_corpus_v1.json');
const rows = lib.registryRowsOf(files.candidate);
const oldStems = lib.parseOldBody(devBody);
const newStems = lib.stemsOf(rows);
const newBody = lib.dollarLiteral(files.candidate, 'new_body');
const clone = value => JSON.parse(JSON.stringify(value));

// ------------------------------------------------------------------ a tiny reader of the SQL text expressions the generator writes (chr(N), 'quoted', ||, array[...])
function splitTop(text, separator) {
  const out = [];
  let depth = 0, quoted = false, current = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) { current += ch; if (ch === "'") { if (text[i + 1] === "'") { current += "'"; i += 1; } else quoted = false; } continue; }
    if (ch === "'") { quoted = true; current += ch; continue; }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth -= 1;
    if (depth === 0 && text.startsWith(separator, i)) { out.push(current.trim()); current = ''; i += separator.length - 1; continue; }
    current += ch;
  }
  if (current.trim() !== '') out.push(current.trim());
  return out;
}
function evalText(expression) {
  let text = expression.trim();
  while (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim();
  return splitTop(text, '||').map(part => {
    const chr = /^chr\((\d+)\)$/.exec(part);
    if (chr) return String.fromCodePoint(Number(chr[1]));
    if (part.startsWith("'") && part.endsWith("'")) return part.slice(1, -1).replaceAll("''", "'");
    throw new Error('UNREADABLE_SQL_TEXT ' + part);
  }).join('');
}
function evalArray(token) {
  const text = token.trim();
  if (text === 'null::text[]') return null;
  if (text === "'{}'::text[]") return [];
  const match = /^array\[(.*)\]::text\[\]$/s.exec(text);
  if (!match) throw new Error('UNREADABLE_SQL_ARRAY ' + token);
  return splitTop(match[1], ',').map(element => (element === 'null' ? null : evalText(element)));
}
/** The smoke rows of a candidate or a postflight: [{input, expected}]. */
function smokeRows(text, open) {
  const start = text.indexOf(open), end = text.indexOf(') s(probe_input, probe_expected) loop', start);
  const block = start >= 0 && end > start ? text.slice(start + open.length, end) : text.slice(text.indexOf('smoke(ord, probe_input, probe_expected) as (values') + 'smoke(ord, probe_input, probe_expected) as (values'.length, text.indexOf('smoke_result as'));
  return block.split('\n').map(line => line.trim().replace(/,$/, '')).filter(line => line.startsWith('(')).map(line => {
    const parts = splitTop(line.slice(1, -1), ',');
    const offset = parts.length === 3 ? 1 : 0;
    return {input: evalArray(parts[offset]), expected: evalArray(parts[offset + 1])};
  });
}
const candidateSmoke = smokeRows(files.candidate, 'for probe in select * from (values\n');
const postflightSmoke = smokeRows(files.postflight, '');

// ------------------------------------------------------------------ the generated files
test('every generated SQL file obeys the transport rules; the guard lines carry no unicode escape either', () => {
  for (const name of ['candidate', 'revert', 'preflight', 'postflight']) assert.deepEqual(lib.transportProblems(files[name]), [], name);
  for (const name of ['plainApply', 'plainRevert', 'migrationApply', 'migrationRevert']) assert.deepEqual(lib.transportProblems(files[name], {allowBackslash: true}), [], name);
  assert.ok(files.candidate.endsWith('\n') && !files.candidate.endsWith('\n\n'));
});

test('no refusal uses SQLSTATE 40001 (PostgREST retries it forever); every raise exception of the candidate and the revert is errcode 55000', () => {
  for (const name of ['candidate', 'revert', 'preflight', 'postflight', 'plainApply', 'migrationApply']) assert.ok(!files[name].includes('40001'), name);
  for (const name of ['candidate', 'revert']) {
    const statements = files[name].split('raise exception').slice(1);
    assert.ok(statements.length >= (name === 'candidate' ? 25 : 12), name + ': many refusals ' + statements.length);
    for (const statement of statements) assert.match(statement.slice(0, 220), /using errcode = '55000'/, name);
  }
  assert.match(newBody, /raise exception 'WORK_KINDS_REGISTRY_INVALID' using errcode = '55000'/);
});

test('the application is ONE atomic DO statement: no ON CONFLICT, no DDL but the one function replacement and its comment, no DML but the twelve-row insert', () => {
  const text = files.candidate.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.equal((text.match(/\bdo \$ex06b\$/g) ?? []).length, 1);
  assert.equal((text.match(/\$ex06b\$;\s*$/g) ?? []).length, 1);
  for (const forbidden of [/on conflict/i, /\balter\s+(table|function|schema|role)/i, /\bcreate\s+(table|index|trigger|schema|view|type|extension)\b/i, /\bdrop\s/i, /\bgrant\s/i, /\brevoke\s/i, /\btruncate\b/i, /\bupdate\s+private\./i, /\bdelete\s+from\b/i]) {
    assert.ok(!forbidden.test(text.replace(/create temporary table \w+ on commit drop as/gi, 'x as')), 'forbidden: ' + forbidden);
  }
  assert.equal((text.match(/create or replace function/gi) ?? []).length, 1);
  assert.equal((text.match(/insert into private\.marketplace_config/gi) ?? []).length, 1);
  assert.equal((text.match(/comment on function/gi) ?? []).length, 1);
  // the revert is the inverse: one function replacement, one comment, one delete of the namespace
  const revertText = files.revert.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  assert.equal((revertText.match(/create or replace function/gi) ?? []).length, 1);
  assert.equal((revertText.match(/delete from private\.marketplace_config/gi) ?? []).length, 1);
  assert.ok(!/insert into/i.test(revertText));
});

test('the pins: the target first, eight neighbours (both callers among them), exactly the values read from canonical DEV on 2026-10-02, equal in the candidate, the revert, the preflight, the postflight and the manifest', () => {
  const pins = lib.parsePins(files.candidate);
  assert.deepEqual(pins, [
    {signature: 'private.work_kinds_v5(text[])', md5: '2113eb46ab7ea968b873e76d1de12377'},
    {signature: 'private.match_detail_without_calendar(uuid,uuid)', md5: 'c8aaf3da761242397243fc56262d1aeb'},
    {signature: 'private.dispatch_cheap_candidate_admitted(uuid,uuid)', md5: '0132fae38c75947179b4d389edc1e1f0'},
    {signature: 'private.candidate_profile_ids(uuid,integer)', md5: 'dca4ddc8080a52c8af83c33689c5568e'},
    {signature: 'private.dispatch_next_wave(uuid)', md5: '1fd8c51ef026ece24471e2f68250ecc5'},
    {signature: 'private.match_detail(uuid,uuid)', md5: '38c7894a8cf43a8f32bd5a30bc2cbd09'},
    {signature: 'private.match_detail_for_calendar_interval(uuid,uuid,timestamp with time zone,timestamp with time zone)', md5: '781956cab666befab216b3ce2334ca1d'},
    {signature: 'private.worker_dispatch_time_admitted(uuid,uuid)', md5: '4f0beb65922d2b3d947d69e68a56a956'},
    {signature: 'private.lower_arr(text[])', md5: '07f449cf589196cc8ca349b4f5ca460c'},
  ]);
  const neighbours = pins.slice(1);
  for (const pin of neighbours) {
    assert.ok(files.preflight.includes(`('${pin.signature}','${pin.md5}')`) && files.postflight.includes(`('${pin.signature}','${pin.md5}')`), pin.signature);
    assert.ok(files.revert.includes(`('${pin.signature}','${pin.md5}')`), 'the revert reports it: ' + pin.signature);
  }
  assert.deepEqual(manifest.neighbourPins, neighbours.map(pin => ({signature: pin.signature, md5: pin.md5})));
  // the two callers are the only functions that name the target; both are pinned
  assert.deepEqual(manifest.callers, ['private.dispatch_cheap_candidate_admitted(uuid,uuid)', 'private.match_detail_without_calendar(uuid,uuid)']);
  for (const caller of manifest.callers) assert.ok(pins.some(pin => pin.signature === caller));
  // ex06a left the two matcher pins where DEV has them now (a drift of the ex06a candidate would make this candidate unappliable)
  assert.equal(ex06a.DETAIL_OLD_MD5, '9180606a038f3606b0906ab4aefdd0c1');
  assert.ok(read('../../candidates/ex06a_flexible_window.sql').includes(`detail_new_md5 constant text := '${pins[1].md5}'`));
  assert.ok(read('ex06a_postflight.readonly.sql').includes(pins[7].md5), 'the ex06a postflight pins the dispatch time gate of this candidate');
});

test('md5 constants: new_md5 is the md5 of the new body literal, old_md5 the DEV predecessor, in the candidate, the revert, the postflight and the manifest', () => {
  assert.equal(md5(newBody), manifest.newMd5);
  assert.ok(files.candidate.includes(`new_md5 constant text := '${manifest.newMd5}'`) && files.revert.includes(`new_md5 constant text := '${manifest.newMd5}'`));
  assert.ok(files.postflight.includes(`('private.work_kinds_v5(text[])', '${manifest.newMd5}')`));
  assert.ok(files.candidate.includes(`old_md5 constant text := '${lib.OLD_MD5}'`) && files.revert.includes(`old_md5 constant text := '${lib.OLD_MD5}'`));
  assert.equal(manifest.predecessorMd5, lib.OLD_MD5);
  assert.notEqual(manifest.newMd5, lib.OLD_MD5);
  assert.equal(lib.dollarLiteral(files.revert, 'new_body'), newBody, 'the revert carries the same new body (it refuses unless the function is exactly this text)');
  assert.equal(lib.dollarLiteral(files.revert, 'registry'), lib.dollarLiteral(files.candidate, 'registry'));
});

test('the new body: ASCII, no dollar sign, no backslash, no tab or CR, the closed kind list in order, the registry key names, no other table', () => {
  assert.deepEqual(lib.transportProblems(newBody), []);
  assert.ok(!newBody.includes('$'));
  const closed = /closed constant text\[\] := array\[([^\]]+)\];/.exec(newBody)[1].split(',').map(item => item.trim().replace(/^'|'$/g, ''));
  assert.deepEqual(closed, lib.CLOSED_KINDS);
  assert.ok(newBody.includes(`'${lib.HEAD_KEY}'`) && newBody.includes(`'${lib.KIND_PREFIX}'`) && newBody.includes(`'${lib.HEAD_SCHEMA}'`) && newBody.includes(`'${lib.KIND_SCHEMA}'`) && newBody.includes(`'${lib.FOLD_VERSION}'`));
  const tables = [...newBody.matchAll(/\b(?:from|join)\s+([a-z_]+\.[a-z_]+)/g)].map(match => match[1]);
  assert.deepEqual([...new Set(tables)], ['private.marketplace_config'], 'the function reads exactly one table');
  assert.ok(!/\b(insert|update|delete|truncate|create|alter|drop)\b/.test(newBody.replace(/--[^\n]*/g, '')), 'the function writes nothing');
  assert.match(newBody, /min|>= 4/);
});

test('the registry rows: twelve, valid, folded, WK-1; the stems are the PKG-031b stems plus the written additions minus the written removal and nothing else', () => {
  assert.equal(rows.length, 12);
  assert.deepEqual(lib.registryProblems(rows), []);
  assert.deepEqual(lib.stemProblems(rows), []);
  assert.deepEqual(rows.map(row => row.key), [lib.HEAD_KEY, ...lib.CLOSED_KINDS.map(kind => lib.KIND_PREFIX + kind)]);
  assert.equal(rows[0].value.classificationVersion, lib.CLASSIFICATION_VERSION);
  assert.equal(Object.values(oldStems).flat().length, 63);
  assert.equal(Object.values(newStems).flat().length, 67);
  for (const kind of lib.CLOSED_KINDS) {
    const expected = [...oldStems[kind].filter(stem => !(lib.STEMS_REMOVED[kind] ?? []).includes(stem)), ...(lib.STEMS_ADDED[kind] ?? [])];
    assert.deepEqual(newStems[kind], expected, kind);
  }
  assert.deepEqual(Object.values(newStems).flat().filter(stem => !Object.values(oldStems).flat().includes(stem)).sort(), ['ikee', 'ikei', 'ikeom', 'ikeu', 'ofarb']);
  assert.deepEqual(Object.values(oldStems).flat().filter(stem => !Object.values(newStems).flat().includes(stem)), ['sklapanj']);
  // the contested kinds carry over exactly: no stem was added to or removed from them
  for (const kind of lib.CONTESTED_KINDS) assert.deepEqual(newStems[kind], oldStems[kind], kind);
  // no kind beyond the eleven, no twelfth row
  assert.ok(rows.every(row => row.key === lib.HEAD_KEY || lib.CLOSED_KINDS.includes(row.key.slice(lib.KIND_PREFIX.length))));
});

test('the DEV capture is the PKG-031b body byte for byte (1,281 characters, 1,291 octets, md5 2113eb46...) and the revert rebuilds it from its ASCII template', () => {
  const start = pkg031b.indexOf('create function private.work_kinds_v5'), tag = '$function$', from = pkg031b.indexOf(tag, start) + tag.length;
  const body = pkg031b.slice(from, pkg031b.indexOf(tag, from));
  assert.equal(body, devBody);
  assert.equal(md5(devBody), lib.OLD_MD5);
  assert.equal(devBody.length, 1281);
  assert.equal(Buffer.byteLength(devBody, 'utf8'), 1291);
  const template = lib.dollarLiteral(files.revert, 'old_body_template');
  assert.deepEqual(lib.transportProblems(template), []);
  const marker = '#OLD_FOLD_FROM#', letters = 'čćšđžČĆŠĐŽ';
  assert.equal(template.split(marker).length - 1, 1);
  assert.equal(template.replace(marker, letters), devBody);
  const expression = /replace\(old_body_template, '#OLD_FOLD_FROM#', (chr\(\d+\)(?:\|\|chr\(\d+\))*)\);/.exec(files.revert);
  assert.equal(evalText(expression[1]), letters, 'the chr() expression of the revert is the ten Serbian letters');
});

test('the manifest equals the committed files; every guarded file is its guard followed by the file; the guards hash the file without its trailing line feed', () => {
  const sha256 = text => sha(text);
  for (const [path, name] of [['supabase/candidates/ex06b_alias_registry.sql', 'candidate'], ['supabase/candidates/ex06b_alias_registry_revert.sql', 'revert'], ['supabase/proofs/ex06/ex06b_preflight.readonly.sql', 'preflight'], ['supabase/proofs/ex06/ex06b_postflight.readonly.sql', 'postflight']]) {
    assert.equal(manifest.files[path].sha256, sha256(files[name]), path);
    assert.equal(manifest.files[path].bytes, Buffer.byteLength(files[name], 'utf8'));
  }
  const guardedOf = {'supabase/proofs/ex06/s06/guarded/ex06b_alias_registry.plain_guard.sql': files.plainApply, 'supabase/proofs/ex06/s06/guarded/ex06b_alias_registry_revert.plain_guard.sql': files.plainRevert,
    'supabase/proofs/ex06/s06/guarded/ex06b_alias_registry.apply_migration_guard.sql': files.migrationApply, 'supabase/proofs/ex06/s06/guarded/ex06b_alias_registry_revert.apply_migration_guard.sql': files.migrationRevert};
  for (const [path, text] of Object.entries(guardedOf)) assert.equal(manifest.guarded[path].sha256, sha256(text), path);
  for (const text of [files.plainApply, files.migrationApply]) assert.ok(text.endsWith(files.candidate), 'the guard is followed by the unchanged candidate');
  for (const text of [files.plainRevert, files.migrationRevert]) assert.ok(text.endsWith(files.revert));
  assert.equal(manifest.spans['supabase/candidates/ex06b_alias_registry.sql'].spanSha256, sha(files.candidate.replace(/\n+$/, '')));
  assert.equal(manifest.registryRowsSha256, sha(lib.dollarLiteral(files.candidate, 'registry')));
  // the plain guard: absolute position of the span, a comment-only tail; the apply_migration guard: its marker starts the candidate and occurs once in it
  const plain = /^do \$ex06b_guard\$ declare rest text:=substr\(current_query\(\),(\d{6})\); begin if encode\(sha256\(convert_to\(substr\(current_query\(\),(\d{6}),(\d{6})\),'UTF8'\)\),'hex'\)<>'([0-9a-f]{64})'/.exec(files.plainApply);
  const guardLength = files.plainApply.length - files.candidate.length;
  assert.equal(Number(plain[2]), guardLength + 1);
  assert.equal(Number(plain[1]), guardLength + 1 + Number(plain[3]));
  assert.equal(plain[4], sha(files.candidate.replace(/\n+$/, '')));
  assert.ok(files.candidate.startsWith(manifest.applyMarker) && files.candidate.split(manifest.applyMarker).length === 2);
  assert.ok(files.revert.startsWith(manifest.revertMarker) && files.revert.split(manifest.revertMarker).length === 2);
  assert.notEqual(manifest.applyMarker, manifest.revertMarker);
  assert.ok(!files.migrationApply.slice(0, files.migrationApply.length - files.candidate.length).includes(manifest.applyMarker), 'the guard does not contain the marker it searches for (it is assembled from two literals)');
  assert.deepEqual(lib.transportProblems(files.migrationApply.slice(0, files.migrationApply.length - files.candidate.length), {allowBackslash: true}), []);
});

test('the preflight and the postflight describe the same registry, stems and neighbours as the candidate; the smoke probes agree between the three files', () => {
  assert.equal(lib.dollarLiteral(files.postflight, 'registry'), lib.dollarLiteral(files.candidate, 'registry'));
  assert.deepEqual(postflightSmoke, candidateSmoke);
  assert.equal(candidateSmoke.length, 14);
  assert.ok(files.postflight.includes('^[a-z][a-z ]*[a-z]$') && files.candidate.includes('^[a-z][a-z ]*[a-z]$') && lib.STEM_PATTERN.source === '^[a-z][a-z ]*[a-z]$');
  assert.ok(files.preflight.includes("starts_with(c.key, 'work_kind')") && files.candidate.includes("starts_with(c.key, 'work_kind')"));
  for (const certificateFunction of ['closure_source_digest_v5', 'closure_erasure_program_digest_v5', 'closure_schema_digest_v5_139', 'closure_erasure_binding_v5', 'agreement_invalidation_surface_v1', 'agreement_voice_surface_v1', 'retention_ai_source_ready']) {
    for (const name of ['candidate', 'preflight', 'postflight']) assert.ok(files[name].includes(`'${certificateFunction}'`), name + ' names ' + certificateFunction);
  }
});

// ------------------------------------------------------------------ the model against the SQL the generator wrote
test('the smoke probes the candidate carries (written by the Python oracle) are exactly what the independent JavaScript model answers; no probe names a contested kind', () => {
  for (const probe of candidateSmoke) {
    assert.deepEqual(lib.kindsOf(probe.input, rows), probe.expected, JSON.stringify(probe.input));
    for (const kind of probe.expected) assert.ok(!lib.CONTESTED_KINDS.includes(kind));
  }
  // and the delta probes of the smoke list are real deltas
  const oldKinds = probe => lib.oldKindsOf(probe.input, oldStems);
  assert.equal(candidateSmoke.filter(probe => JSON.stringify(oldKinds(probe)) !== JSON.stringify(probe.expected)).length, 6, 'the Cyrillic, the F2, the IKEA and the dialect probes are the six real deltas');
});

test('the fold tables of the SQL body (fold_from, fold_to, the three digraph replacements) equal the independently typed JavaScript table letter for letter', () => {
  const from = evalText(/fold_from constant text :=\s*([^;]+);/.exec(newBody)[1].replace(/\n\s*/g, ''));
  const to = /fold_to constant text := '([^']+)';/.exec(newBody)[1];
  assert.equal([...from].length, 64);
  assert.equal(to.length, 64);
  assert.equal(new Set([...from]).size, 64, 'no letter twice');
  for (let i = 0; i < 64; i += 1) assert.equal(lib.foldText([...from][i]), to[i], `letter ${i}: ${[...from][i]}`);
  const digraphs = [...newBody.matchAll(/chr\((\d+)\), '([a-z]+)'\)/g)].map(match => [String.fromCodePoint(Number(match[1])), match[2]]);
  assert.deepEqual(digraphs, [['Љ', 'lj'], ['љ', 'lj'], ['Њ', 'nj'], ['њ', 'nj'], ['Џ', 'dz'], ['џ', 'dz']]);
  for (const [letter, latin] of digraphs) assert.equal(lib.foldText(letter), latin);
  assert.equal(lib.FOLD_LETTER_COUNT, 70, 'ten Latin diacritics + the sixty letters of the Serbian Cyrillic alphabet in both cases');
  assert.equal(lib.foldText('  Čišćenje ЖАБА Љубав  '), 'ciscenje zaba ljubav');
});

test('kindsOf: per-value matching, no stem across two values, stems shorter than four characters never count, NULL and empty arrays, the registry is refused loudly and an extra row is ignored', () => {
  assert.deepEqual(lib.kindsOf(['Čišćenje stana'], rows), ['CISCENJE']);
  assert.deepEqual(lib.kindsOf(['cis', 'cenje'], rows), []);
  assert.deepEqual(lib.kindsOf(['ofarba sobu', 'ikee'], rows), ['MOLERSKI_RADOVI', 'MONTAZA_NAMESTAJA']);
  assert.deepEqual(lib.kindsOf([null, ''], rows), []);
  assert.deepEqual(lib.kindsOf([], rows), []);
  assert.deepEqual(lib.kindsOf(null, rows), []);
  const short = clone(rows); short.find(row => row.key === 'work_kind:CISCENJE').value.stems = ['cis'];
  assert.deepEqual(lib.kindsOf(['cistoca'], short), []);
  const extra = clone(rows); extra.push({key: 'work_kind:NEW_UNAPPROVED_KIND', value: {schema: 'WORK_KIND_V1', kind: 'NEW_UNAPPROVED_KIND', stems: ['qwxzaa']}});
  assert.deepEqual(lib.kindsOf(['qwxzaa'], extra), [], 'a twelfth kind row names nothing');
  for (const mutate of [r => r.splice(0, 1), r => r.splice(5, 1), r => { r[0].value.schema = 'X'; }, r => { r[0].value.kinds.push('Y'); }, r => { r[0].value.foldVersion = 'V0'; }, r => { r[3].value.stems = 'x'; }, r => { r[4].value.kind = 'ELEKTRO'; }]) {
    const broken = clone(rows); mutate(broken);
    assert.throws(() => lib.kindsOf(['ciscenje'], broken), error => error.code === 'WORK_KINDS_REGISTRY_INVALID');
    assert.deepEqual(lib.kindsOf([], broken), [], 'an empty call answers before the registry is read');
  }
});

test('the old model is the PKG-031b function: every parsed stem names its kind; Cyrillic names nothing; diacritics fold; the removed stem and the added stems are the only differences from the new model on the stems themselves', () => {
  for (const [kind, stems] of Object.entries(oldStems)) for (const stem of stems) assert.ok(lib.oldKindsOf([stem], oldStems).includes(kind), `${kind} ${stem}`);
  assert.deepEqual(lib.oldKindsOf(['Чишћење стана'], oldStems), []);
  assert.deepEqual(lib.oldKindsOf(['Čišćenje', 'ČIŠĆENJE'], oldStems), ['CISCENJE']);
  assert.deepEqual(lib.oldKindsOf(['sklapanje maketa'], oldStems), ['MONTAZA_NAMESTAJA']);
  assert.deepEqual(lib.kindsOf(['sklapanje maketa'], rows), []);
  assert.deepEqual(lib.oldKindsOf(['ofarbati'], oldStems), []);
  assert.deepEqual(lib.parseOldBody(devBody), oldStems);
  assert.throws(() => lib.parseOldBody(devBody.replace("'SELIDBE_PREVOZ'", "'OTHER'")), /OLD_BODY_KIND_LIST/);
  assert.deepEqual(oldStems.FIZICKI_POSLOVI.slice(-3), ['labor', 'labour', 'loading'], 'the regular expression labou?r is the two literals');
});

test('the probe set: deterministic, well over six hundred probes, every stem in plain, embedded, upper, padded and Cyrillic form, splits, diacritics, multi-value and edge arrays, seeded random words', () => {
  const probes = lib.buildProbes({oldStems, newStems}), again = lib.buildProbes({oldStems, newStems});
  assert.deepEqual(probes, again);
  assert.deepEqual(probes.map(probe => probe.id), probes.map((_, i) => i + 1));
  const tags = Object.fromEntries([...new Set(probes.map(probe => probe.tag))].map(tag => [tag, probes.filter(probe => probe.tag === tag).length]));
  assert.ok(probes.length > 600, String(probes.length));
  const all = [...new Set([...Object.values(oldStems).flat(), ...Object.values(newStems).flat()])];
  assert.equal(all.length, 68, 'the 63 old stems and the five added ones (the removed stem is still probed)');
  for (const tag of ['stem', 'embedded', 'upper', 'padded']) assert.equal(tags[tag], 68, tag);
  assert.ok(tags.cyrillic >= 60 && tags['cyrillic-upper'] === tags.cyrillic && tags['cyrillic-sentence'] === tags.cyrillic, JSON.stringify(tags));
  assert.ok(tags.split >= 45 && tags.diacritic >= 15 && tags.multi >= 10 && tags.edge === 7 && tags.random === 120, JSON.stringify(tags));
  assert.ok(probes.some(probe => probe.values === null) && probes.some(probe => Array.isArray(probe.values) && probe.values.length === 0));
  assert.equal(lib.toCyrillic('moler'), 'молер');
  assert.equal(lib.toCyrillic('krecenj'), 'крецењ');
  assert.equal(lib.toCyrillic('pranje vesa'), 'прање веса');
  assert.equal(lib.toCyrillic('handyman'), null);
  // the real differences between the two models are all explained by the written deltas
  const before = new Map(probes.map(probe => [probe.id, lib.oldKindsOf(probe.values, oldStems)])), after = new Map(probes.map(probe => [probe.id, lib.kindsOf(probe.values, rows)]));
  assert.deepEqual(lib.unexplainedDifferences({probes, before, after, oldStems, newStems}), []);
  assert.ok(probes.filter(probe => JSON.stringify(before.get(probe.id)) !== JSON.stringify(after.get(probe.id))).length >= 150);
  assert.deepEqual(lib.probeProblems({probes, results: before, oldStems, rows, state: 'before'}), []);
  assert.deepEqual(lib.probeProblems({probes, results: after, oldStems, rows, state: 'after'}), []);
  // a Latin text is never changed by the candidate unless it contains an added or the removed stem
  for (const probe of probes.filter(item => (item.values ?? []).every(value => value === null || !lib.hasCyrillic(value)))) {
    if (JSON.stringify(before.get(probe.id)) !== JSON.stringify(after.get(probe.id))) assert.ok(lib.explainedByDeltas(probe.values, {oldStems, newStems}), JSON.stringify(probe.values));
  }
});

test('MUTATION: the probe comparison fails for a function that differs from the model (a missing stem, an extra stem, no Cyrillic fold, a prefix match, a case-sensitive match, a cross-value stem)', () => {
  const probes = lib.buildProbes({oldStems, newStems}), killed = [];
  const evaluate = fn => probes.map(probe => [probe.id, fn(probe.values)]);
  const stemRows = mutate => { const copy = clone(rows); mutate(copy); return copy; };
  const mutants = {
    missingStem: values => lib.kindsOf(values, stemRows(copy => { copy.find(row => row.key === 'work_kind:MOLERSKI_RADOVI').value.stems = copy.find(row => row.key === 'work_kind:MOLERSKI_RADOVI').value.stems.filter(stem => stem !== 'ofarb'); })),
    extraStem: values => lib.kindsOf(values, stemRows(copy => { copy.find(row => row.key === 'work_kind:DOSTAVA').value.stems.push('pomoc'); })),
    noCyrillicFold: values => lib.oldKindsOf(values, newStems),
    stemRestored: values => lib.kindsOf(values, stemRows(copy => { copy.find(row => row.key === 'work_kind:MONTAZA_NAMESTAJA').value.stems.push('sklapanj'); })),
    prefixOnly: values => lib.CLOSED_KINDS.filter(kind => newStems[kind].some(stem => (values ?? []).filter(value => value !== null).map(lib.foldText).some(text => text.startsWith(stem)))).sort(),
    caseSensitive: values => lib.CLOSED_KINDS.filter(kind => newStems[kind].some(stem => (values ?? []).filter(value => value !== null).some(value => value.includes(stem)))).sort(),
    crossValue: values => lib.CLOSED_KINDS.filter(kind => newStems[kind].some(stem => (values ?? []).filter(value => value !== null).map(lib.foldText).join('').includes(stem))).sort(),
  };
  for (const [name, fn] of Object.entries(mutants)) {
    const results = new Map(evaluate(fn));
    if (lib.probeProblems({probes, results, oldStems, rows, state: 'after'}).length > 0) killed.push(name);
  }
  assert.deepEqual(killed.sort(), Object.keys(mutants).sort(), 'every mutant is killed by the probe set');
  // and the "no unexplained difference" check kills a mutant that changes a Latin text without a written delta
  const before = new Map(probes.map(probe => [probe.id, lib.oldKindsOf(probe.values, oldStems)]));
  const mutantAfter = new Map(probes.map(probe => [probe.id, mutants.extraStem(probe.values)]));
  assert.ok(lib.unexplainedDifferences({probes, before, after: mutantAfter, oldStems, newStems}).length > 0);
});

// ------------------------------------------------------------------ the corpus v1.1
test('the corpus v1.1: pinned, well-formed, additive (the frozen v1 is untouched), and its written intent agrees with BOTH classifications', () => {
  assert.deepEqual(lib.corpusV11PinProblems({path: lib.CORPUS_V11_PIN.path, text: corpus11Text}), []);
  assert.deepEqual(lib.corpusShapeProblems(corpus11), []);
  assert.deepEqual(lib.corpusSemanticProblems(corpus11, {rows, oldStems}), []);
  assert.equal(corpus11.cases.length, lib.CORPUS_V11_PIN.cases);
  assert.equal(lib.corpusTextSha256(corpus1Text), lib.CORPUS_V1_PIN.sha256, 'the frozen corpus v1 is byte-identical to the pin');
  assert.equal(lib.CORPUS_V1_PIN.sha256, ex06a.CORPUS_PIN.sha256);
  assert.equal(lib.CORPUS_V1_PIN.idsSha256, ex06a.CORPUS_PIN.idsSha256);
  assert.equal(lib.CORPUS_V1_PIN.buildableCases, ex06a.CORPUS_PIN.buildableCases);
  assert.equal(corpus11.extends.sha256Lf, lib.CORPUS_V1_PIN.sha256);
  // no id of v1.1 exists in v1
  const v1Ids = new Set(JSON.parse(corpus1Text).cases.map(item => item.id));
  for (const item of [...corpus11.kindProbes, ...corpus11.acceptedConsequences, ...corpus11.cases]) assert.ok(!v1Ids.has(item.id), item.id);
  // no probe, consequence or case names a contested kind or invents a policy for them
  const text = JSON.stringify([corpus11.kindProbes, corpus11.acceptedConsequences, corpus11.cases]);
  for (const kind of lib.CONTESTED_KINDS) assert.ok(!text.includes(kind), kind);
  for (const stem of [...oldStems.ELEKTRO, ...oldStems.VODOINSTALATER]) assert.ok(!corpus11.kindProbes.some(probe => (probe.values ?? []).some(value => value !== null && lib.foldText(value).includes(stem))), 'no probe is about ' + stem);
  assert.ok(corpus11.kindProbes.length >= 40 && corpus11.acceptedConsequences.length >= 2);
  assert.equal(corpus11.cases.filter(item => item.purpose === 'STAYS').length, 1);
});

test('MUTATION: the corpus validator fails when the written intent, a before, a stem probe or a consequence is wrong, or a contested kind appears', () => {
  const run = mutate => { const copy = clone(corpus11); mutate(copy); return [...lib.corpusShapeProblems(copy), ...lib.corpusSemanticProblems(copy, {rows, oldStems})]; };
  const mutations = {
    wrongExpect: c => { c.kindProbes.find(probe => probe.id === 'P-002').expect = []; },
    wrongBefore: c => { c.kindProbes.find(probe => probe.id === 'P-002').before = ['MONTAZA_NAMESTAJA']; },
    beforeEqualsExpect: c => { c.kindProbes.find(probe => probe.id === 'P-002').before = ['MONTAZA_NAMESTAJA']; c.kindProbes.find(probe => probe.id === 'P-002').expect = ['MONTAZA_NAMESTAJA']; },
    contestedKind: c => { c.kindProbes.push({id: 'P-099', values: ['elektricar'], expect: ['ELEKTRO']}); },
    droppedAddedStemProbes: c => { c.kindProbes = c.kindProbes.filter(probe => !(probe.values ?? []).some(value => value !== null && value.toLowerCase().includes('ikeom'))); },
    droppedF2Probes: c => { c.kindProbes = c.kindProbes.filter(probe => !(probe.values ?? []).some(value => value !== null && value.toLowerCase().includes('sklapanj'))); c.acceptedConsequences = []; },
    workerExpect: c => { c.cases[0].referenceWorkers['latin-skill'].expect = clone(c.cases[0].referenceWorkers['other-kind'].expect); },
    workerBefore: c => { c.cases[0].referenceWorkers['latin-skill'].before = clone(c.cases[0].referenceWorkers['latin-skill'].expect); },
    derivedFit: c => { c.cases[1].expectedEligibility.fit = clone(c.cases[1].expectedEligibility.unfit); },
    caseKinds: c => { c.cases[0].expectedKinds = []; },
    consequenceRemedy: c => { delete c.acceptedConsequences[0].remedy; },
    flipThatFlipsNothing: c => { c.cases[0].purpose = 'STAYS'; },
    personalData: c => { c.cases[2].expectedFacts['need.description'] += ' pozovi 063 123 4567'; },
    passRate: c => { c.passRate = 0.9; },
    notAdditive: c => { c.extends.sha256Lf = '0'.repeat(64); },
  };
  for (const [name, mutate] of Object.entries(mutations)) assert.ok(run(mutate).length > 0, 'the mutation is killed: ' + name);
  assert.deepEqual(run(() => {}), [], 'the unmutated corpus is clean');
});

test('the corpus v1.1 loads through the REAL S03 loader (harness-native shape): eight cases, the derived and written workers, every case has an anchor and a named negative, no contested resource', () => {
  const registry = registryFromSource();
  const loaded = normaliseCorpus(corpus11, {registry, label: 'CORPUS'});
  assert.equal(loaded.cases.length, 8);
  for (const item of loaded.cases) {
    const plan = referenceWorkerPlan(item, {controls: true});
    const labels = plan.map(worker => worker.label);
    assert.ok(labels.includes('fit') && labels.includes('unfit') && labels.includes('control-restricted'), item.id + ' ' + labels.join(','));
    const live = plan.filter(worker => !worker.skip);
    const anchored = live.some(worker => !worker.control && (worker.expect?.dispatchEligible === true || worker.expect?.delivery === true));
    const named = live.some(worker => !worker.control && worker.expect && classifyFields(worker.expect).negative.length > 0 && namesCause(worker.expect));
    assert.ok(anchored && named, `${item.id}: an anchor and a named negative of the corpus`);
    assert.ok(plan.length <= 8, item.id + ': the workers fit one wave of five eligible workers');
    assert.ok(live.filter(worker => !worker.control && worker.expect?.dispatchEligible === true).length <= 4, item.id + ': at most four eligible workers (the first wave sends five)');
    const source = corpus11.cases.find(candidate => candidate.id === item.id);
    for (const [label, spec] of Object.entries(source.referenceWorkers)) {
      const built = plan.find(worker => worker.label === label);
      assert.deepEqual(built.profile.skills, spec.profile.skills, item.id + '/' + label);
      assert.equal(built.profile.availability.shape, 'AVAILABLE_NOW_AND_SCHEDULED', 'the worker inherits the available-now shape of the derived fit worker');
    }
    assert.equal(item.expectedFacts['need.schedule_kind'], 'FLEXIBLE');
  }
  // the exclusion case writes its Cyrillic exclusion through the labelled bypass of the S03 harness
  const exclusion = loaded.cases.find(item => item.id === 'T-108');
  assert.deepEqual(referenceWorkerPlan(exclusion, {controls: false}).find(worker => worker.label === 'excluded-in-cyrillic').profile.bypass, {exclusions: ['селидба']});
});

test('failBeforeFindings is the written fail-before set: 39 findings, exactly the fields that differ between the written before and expect, and the hidden-kinds check of the two cases whose kinds differ', () => {
  const keys = lib.failBeforeFindings(corpus11);
  assert.equal(keys.length, 39);
  assert.deepEqual(keys, [...keys].sort());
  const perCase = Object.fromEntries(corpus11.cases.map(item => [item.id, keys.filter(key => key.startsWith(item.id + '|')).length]));
  assert.deepEqual(perCase, {'T-101': 5, 'T-102': 4, 'T-103': 4, 'T-104': 4, 'T-105': 12, 'T-106': 5, 'T-107': 0, 'T-108': 5});
  assert.deepEqual(keys.filter(key => key.includes('hidden kinds')), ['T-101|-|hidden kinds of the stored task (category + required skills)', 'T-106|-|hidden kinds of the stored task (category + required skills)']);
  assert.deepEqual(keys.filter(key => key.startsWith('T-108')), ['T-108|excluded-in-cyrillic|delivery', 'T-108|excluded-in-cyrillic|dispatchEligible', 'T-108|excluded-in-cyrillic|event', 'T-108|excluded-in-cyrillic|hardBlockers',
    'T-108|excluded-in-cyrillic|responseAllowed']);
});

test('v11IntendedFlips is written from the corpus (not from an after-state): the fields, the +30 / -30 capability points, no score for a hard exclusion, and the number of deliveries of each wave', () => {
  const flips = lib.v11IntendedFlips(corpus11);
  const of = id => flips.filter(flip => flip.caseId === id);
  assert.deepEqual(of('T-101').map(flip => `${flip.worker}|${flip.field}`).sort(), ['latin-skill|delivery', 'latin-skill|dispatchBlockers', 'latin-skill|dispatchEligible', 'latin-skill|event', 'latin-skill|score', 'null|wave.inserted']);
  assert.deepEqual(of('T-101').find(flip => flip.field === 'wave.inserted'), {caseId: 'T-101', worker: null, field: 'wave.inserted', before: 1, after: 2});
  assert.deepEqual(of('T-101').find(flip => flip.field === 'score'), {caseId: 'T-101', worker: 'latin-skill', field: 'score', scoreDelta: 30});
  assert.deepEqual(of('T-105').find(flip => flip.field === 'wave.inserted'), {caseId: 'T-105', worker: null, field: 'wave.inserted', before: 1, after: 4});
  assert.deepEqual(of('T-106').find(flip => flip.field === 'wave.inserted'), {caseId: 'T-106', worker: null, field: 'wave.inserted', before: 2, after: 1});
  assert.deepEqual(of('T-106').find(flip => flip.field === 'score'), {caseId: 'T-106', worker: 'furniture-assembler', field: 'score', scoreDelta: -30});
  assert.deepEqual(of('T-107'), []);
  assert.ok(of('T-108').every(flip => flip.field !== 'score'), 'a hard exclusion moves no score component');
  assert.deepEqual(of('T-108').find(flip => flip.field === 'hardBlockers'), {caseId: 'T-108', worker: 'excluded-in-cyrillic', field: 'hardBlockers', before: [], after: ['PROFILE_EXCLUSION']});
  assert.deepEqual(of('T-108').find(flip => flip.field === 'wave.inserted'), {caseId: 'T-108', worker: null, field: 'wave.inserted', before: 2, after: 1});
  assert.deepEqual(lib.v11DetailExpectations(corpus11), {
    'T-101|latin-skill': {service: 'GAINED'}, 'T-102|cyrillic-skill': {service: 'GAINED'}, 'T-103|dialect-skill': {service: 'GAINED'}, 'T-104|canonical-skill': {service: 'GAINED'},
    'T-105|locative-ikei': {service: 'GAINED'}, 'T-105|accusative-ikeu': {service: 'GAINED'}, 'T-105|instrumental-ikeom': {service: 'GAINED'},
    'T-106|furniture-assembler': {service: 'LOST'}, 'T-108|excluded-in-cyrillic': {exclusion: 'GAINED'}});
});

// ------------------------------------------------------------------ the pass analysis
const outcome = (id, workers, wave = {status: 'SENT', inserted: 2}) => ({id, refused: false, wave, rounds: [{round_no: 1, status: 'SENT', stop_reason: null}],
  workers: Object.fromEntries(Object.entries(workers).map(([label, w]) => [label, {hardBlockers: [], dispatchBlockers: [], dispatchEligible: true, delivery: true, event: true, score: 95, ...w}]))});
const t31Before = outcome('T-031', {fits: {}, 'does-not-fit': {}, 'unknown-capability': {dispatchEligible: false, dispatchBlockers: [lib.SERVICE_CODE], delivery: false, event: false, score: 65}});
const t31After = clone(t31Before);
Object.assign(t31After.workers['does-not-fit'], {dispatchEligible: false, dispatchBlockers: [lib.SERVICE_CODE], delivery: false, event: false, score: 65}); t31After.wave.inserted = 1;

test('diffOutcomes and checkFlips: the written T-031 flips are matched exactly once each; a different flip, a missing flip and a score off by one are all caught', () => {
  const before = {'T-031': t31Before, 'T-001': outcome('T-001', {fit: {}})}, after = {'T-031': t31After, 'T-001': outcome('T-001', {fit: {}})};
  const flips = lib.checkFlips(lib.diffOutcomes(before, after), lib.V1_INTENDED_FLIPS);
  assert.equal(flips.matched.length, lib.V1_INTENDED_FLIPS.length);
  assert.deepEqual([flips.unintended, flips.missing], [[], []]);
  const other = clone(after); other['T-001'].workers.fit.dispatchEligible = false;
  assert.equal(lib.checkFlips(lib.diffOutcomes(before, other), lib.V1_INTENDED_FLIPS).unintended.length, 1);
  const missing = clone(after); missing['T-031'].workers['does-not-fit'].event = true;
  assert.equal(lib.checkFlips(lib.diffOutcomes(before, missing), lib.V1_INTENDED_FLIPS).missing.length, 1);
  const score = clone(after); score['T-031'].workers['does-not-fit'].score = 66;
  const bad = lib.checkFlips(lib.diffOutcomes(before, score), lib.V1_INTENDED_FLIPS);
  assert.ok(bad.unintended.length === 1 && bad.missing.length === 1);
  const extraWave = clone(after); extraWave['T-031'].wave.inserted = 0;
  assert.ok(lib.checkFlips(lib.diffOutcomes(before, extraWave), lib.V1_INTENDED_FLIPS).missing.length >= 1);
  assert.deepEqual(lib.diffOutcomes(before, clone(before)), []);
  assert.equal(lib.diffOutcomes({a: t31Before}, {}).length, 1);
  assert.equal(lib.V1_FINDINGS_CLOSED.length, 3);
});

const detail = (overrides = {}) => ({workerAccountId: 'a', workerProfileId: 'p', responseAllowed: true, dispatchEligible: true, hardBlockers: [], dispatchBlockers: [], reasonCodes: ['SERVICE_MATCH', 'SCHEDULE_MATCH', 'START_PROXIMITY_MATCH', 'RESOURCES_MATCH', 'NEWCOMER_FAIRNESS'],
  distanceToStartKm: 0, effectiveRadiusKm: 15, taskLocationMode: 'STATIONARY', distanceSource: 'GEODESIC', routingProvider: null, liveStateDate: null, score: 100,
  scoreComponents: {capability: 30, schedule: 25, distanceToStart: 15, resources: 15, reliability: 10, fairness: 5}, ...overrides});
const lostService = d => ({...clone(d), workerProfileId: 'other', dispatchEligible: false, dispatchBlockers: [lib.SERVICE_CODE], reasonCodes: d.reasonCodes.filter(code => code !== 'SERVICE_MATCH'), score: 70, scoreComponents: {...d.scoreComponents, capability: 0}});

test('matchDetailDelta: a lost or gained service match changes exactly the blocker, the reason, the capability component, the score and the eligibility; an exclusion changes only the hard gate; anything else is a problem', () => {
  const full = detail(), lost = lostService(full);
  assert.deepEqual(lib.matchDetailDelta(full, lost, {service: 'LOST'}), []);
  assert.deepEqual(lib.matchDetailDelta(lost, full, {service: 'GAINED'}), []);
  assert.deepEqual(lib.matchDetailDelta(full, clone(full), {}), []);
  assert.ok(lib.matchDetailDelta(full, lost, {}).length > 0, 'an unexpected change is a problem');
  assert.ok(lib.matchDetailDelta(full, lost, {service: 'GAINED'}).length > 0);
  const wrongScore = {...clone(lost), score: 71};
  assert.ok(lib.matchDetailDelta(full, wrongScore, {service: 'LOST'}).some(problem => problem.startsWith('SCORE')));
  const wrongCap = {...clone(lost), scoreComponents: {...lost.scoreComponents, capability: 5}};
  assert.ok(lib.matchDetailDelta(full, wrongCap, {service: 'LOST'}).length > 0);
  const extraField = {...clone(lost), distanceToStartKm: 3};
  assert.ok(lib.matchDetailDelta(full, extraField, {service: 'LOST'}).some(problem => problem.startsWith('UNINTENDED_FIELD_CHANGED')));
  const eligibleStill = {...clone(lost), dispatchEligible: true};
  assert.ok(lib.matchDetailDelta(full, eligibleStill, {service: 'LOST'}).length > 0);
  const excluded = {...clone(full), responseAllowed: false, dispatchEligible: false, hardBlockers: [lib.EXCLUSION_CODE]};
  assert.deepEqual(lib.matchDetailDelta(full, excluded, {exclusion: 'GAINED'}), []);
  assert.ok(lib.matchDetailDelta(full, {...excluded, score: 90}, {exclusion: 'GAINED'}).length > 0, 'a hard exclusion moves no score');
  assert.ok(lib.matchDetailDelta(full, excluded, {}).length > 0);
  assert.ok(lib.matchDetailDelta(full, null, {}).length > 0);
  // the whole-pass form
  assert.deepEqual(lib.corpusDetailProblems({'T-031|does-not-fit': full, 'T-001|fit': full}, {'T-031|does-not-fit': lost, 'T-001|fit': clone(full)}), []);
  assert.ok(lib.corpusDetailProblems({'T-031|does-not-fit': full, 'T-001|fit': full}, {'T-031|does-not-fit': lost, 'T-001|fit': lost}).length > 0);
  assert.ok(lib.corpusDetailProblems({'T-001|fit': full}, {'T-001|fit': full}).some(problem => problem.includes('EXPECTED_DETAIL_NOT_READ')));
});

test('coverage guards: a pass that covered fewer cases, refused a case, has a bad status or lost a worker detail is not a pass', () => {
  const outcomes = {a: outcome('a', {fit: {}}), b: outcome('b', {fit: {}})};
  const summary = {statuses: {PASS: 1, FINDING: 1}};
  assert.deepEqual(lib.coverageProblems({outcomes, summary, expectedCases: 2}), []);
  assert.ok(lib.coverageProblems({outcomes, summary, expectedCases: 3}).length > 0);
  assert.ok(lib.coverageProblems({outcomes: {...outcomes, b: {...outcomes.b, refused: true}}, summary, expectedCases: 2}).some(problem => problem.startsWith('PRODUCT_PATH_REFUSED')));
  assert.ok(lib.coverageProblems({outcomes, summary: {statuses: {PASS: 1, HARNESS_ERROR: 1}}, expectedCases: 2}).length > 0);
  assert.deepEqual(lib.detailCoverageProblems({outcomes, details: {'a|fit': {}, 'b|fit': {}}}), []);
  assert.equal(lib.detailCoverageProblems({outcomes, details: {'a|fit': {}}}).length, 1);
  assert.deepEqual(lib.corpusTimeProblems({a: {starts_at: '2026-10-05T08:00:00Z', ends_at: null}}, {a: {starts_at: '2026-10-05T08:00:00.000Z', ends_at: null}}, {referenceRebase: {deltaMs: 1}, otherRebase: {deltaMs: 1}}), []);
  assert.equal(lib.corpusTimeProblems({a: {starts_at: '2026-10-05T08:00:00Z', ends_at: null}}, {a: {starts_at: '2026-10-05T09:00:00Z', ends_at: null}}).length, 1);
  assert.equal(lib.corpusTimeProblems({}, {}, {referenceRebase: {deltaMs: 1}, otherRebase: {deltaMs: 2}}).length, 1);
});

test('surfaceDelta: only the target line changes, in its md5 and its volatility; a changed ACL, definer flag, another function or a second line fails; diffNamed lists added, removed and changed', () => {
  const line = (md5Value, volatility = 'i', extra = 'acl={postgres=X/postgres}') => `function:private.work_kinds_v5(p_values text[]):${md5Value}:definer=false:volatility=${volatility}:config=search_path=pg_catalog:${extra}`;
  const other = 'function:private.match_detail(nid uuid, pid uuid):aaaa:definer=true:volatility=s:config=search_path=pg_catalog:acl={postgres=X/postgres}';
  const before = [other, line('1'.repeat(32))], after = [other, line('2'.repeat(32), 's')];
  assert.equal(lib.surfaceDelta(before, after).onlyTheTarget, true);
  assert.equal(lib.surfaceDelta(before, [other, line('2'.repeat(32), 'v')]).onlyTheTarget, false, 'volatility must go i -> s');
  assert.equal(lib.surfaceDelta(before, [other, line('2'.repeat(32), 's', 'acl={postgres=X/postgres,anon=X/postgres}')]).onlyTheTarget, false);
  assert.equal(lib.surfaceDelta(before, [other.replace(':aaaa:', ':bbbb:'), line('2'.repeat(32), 's')]).onlyTheTarget, false);
  assert.equal(lib.surfaceDelta(before, [other, line('1'.repeat(32))]).onlyTheTarget, false, 'no change is not the expected change');
  assert.equal(lib.surfaceDelta(before, [...after, 'function:private.new_one():cccc:definer=false:volatility=s:config=:acl=default']).onlyTheTarget, false);
  assert.deepEqual(lib.diffNamed([{name: 'a', md5: '1'}, {name: 'b', md5: '2'}], [{name: 'b', md5: '3'}, {name: 'c', md5: '4'}]), {added: ['c'], removed: ['a'], changed: [{name: 'b', before: '2', after: '3'}]});
  assert.equal(lib.rowsFingerprint([{key: 'a', value: {x: 1}}, {key: 'b', value: 2}]), lib.rowsFingerprint([{key: 'b', value: 2}, {key: 'a', value: {x: 1}}]));
  assert.notEqual(lib.rowsFingerprint([{key: 'a', value: {x: 1}}]), lib.rowsFingerprint([{key: 'a', value: {x: 2}}]));
});

// ------------------------------------------------------------------ the proof's own helpers
test('the tamper helpers change exactly one place and refuse a missing or repeated anchor; every anchor the proof uses occurs exactly once in the candidate', () => {
  const pins = lib.parsePins(files.candidate);
  for (const pin of pins) {
    const tampered = lib.tamperPin(files.candidate, pin.signature);
    assert.notEqual(tampered, files.candidate);
    assert.equal(lib.parsePins(tampered).find(item => item.signature === pin.signature).md5, '0'.repeat(32));
    assert.equal(lib.parsePins(tampered).filter(item => item.md5 !== lib.parsePins(files.candidate).find(other => other.signature === item.signature).md5).length, 1);
  }
  assert.throws(() => lib.tamperPin(files.candidate, 'private.nothing(uuid)'), /PIN_NOT_FOUND_EXACTLY_ONCE/);
  assert.throws(() => lib.replaceOnce(files.candidate, 'this text is not there', 'x'), /TAMPER_ANCHOR_OCCURS_0_TIMES/);
  assert.throws(() => lib.replaceOnce(files.candidate, 'raise exception', 'x'), /TAMPER_ANCHOR_OCCURS_\d+_TIMES/);
  for (const anchor of ['"ofarb"', "(array['ikee']::text[], array['MONTAZA_NAMESTAJA']::text[])", `new_md5 constant text := '${manifest.newMd5}'`]) assert.equal(files.candidate.split(anchor).length - 1, 1, anchor);
  assert.notEqual(lib.replaceOnce(files.candidate, '"ofarb"', '"Ofarb"'), files.candidate);
  assert.ok(lib.stemProblems(lib.registryRowsOf(lib.replaceOnce(files.candidate, '"ofarb"', '"Ofarb"'))).length === 1, 'the tampered registry text is refused by the stem rule');
  assert.equal(lib.dollarLiteral(files.candidate, 'new_body'), newBody);
  assert.throws(() => lib.dollarLiteral(files.candidate, 'nope'), /DOLLAR_LITERAL_NOT_FOUND/);
});

test('the data-edit plan: every edit is a transaction that is rolled back, the errors are named, the names are unique, the nonsense words and the unapproved kind name never touch a real kind', () => {
  const plan = lib.dataEditPlan();
  assert.ok(plan.length >= 14);
  assert.equal(new Set(plan.map(edit => edit.name)).size, plan.length);
  for (const edit of plan) {
    assert.ok(edit.sql.startsWith('begin; ') && edit.sql.endsWith('rollback;') && !/commit/i.test(edit.sql), edit.name);
    assert.deepEqual(lib.transportProblems(edit.sql), [], edit.name);
    assert.ok(('json' in edit.expect) !== ('error' in edit.expect), edit.name);
    assert.ok(!/(electr|elektr|plumb|vodoinst)/i.test(edit.sql), 'the edits never touch the contested kinds: ' + edit.name);
  }
  const names = plan.map(edit => edit.name);
  for (const required of ['AN_ALIAS_IS_A_DATA_EDIT', 'A_TWELFTH_KIND_ROW_IS_IGNORED', 'A_MISSING_HEAD_ROW_IS_REFUSED_LOUDLY', 'THE_VERSION_IS_DATA_AND_THE_FUNCTION_DOES_NOT_READ_IT', 'AN_EMPTY_CALL_ANSWERS_BEFORE_THE_REGISTRY_IS_READ']) assert.ok(names.includes(required), required);
  // the same edits applied to the JavaScript model give the expected answers (the SQL ones are proved on the chain)
  const edited = clone(rows); edited.find(row => row.key === 'work_kind:BASTA_DVORISTE').value.stems.push('qwxzaa');
  assert.deepEqual(lib.kindsOf(['about qwxzaa today'], edited), ['BASTA_DVORISTE']);
  assert.deepEqual(lib.kindsOf(['about qwxzaa today'], rows), []);
});

test('the probe SQL carries every probe as one JSON literal and quotes it; the generated probes need no apostrophe; the results map by id', () => {
  const probes = lib.buildProbes({oldStems, newStems, randomCount: 5}).slice(0, 12);
  const text = lib.probeSql(probes, value => "'" + String(value).replaceAll("'", "''") + "'");
  assert.match(text, /^select coalesce\(jsonb_agg\(jsonb_build_object\('i', p\.i, 'k', private\.work_kinds_v5\(p\.v\)\) order by p\.i\), '\[\]'::jsonb\) from jsonb_to_recordset\('/);
  const literal = /jsonb_to_recordset\('(.*)'::jsonb\) as p\(i integer, v text\[\]\)$/s.exec(text)[1];
  assert.deepEqual(JSON.parse(literal), probes.map(probe => ({i: probe.id, v: probe.values})));
  assert.ok(!literal.includes("'"));
  assert.deepEqual([...lib.probeResults([{i: 3, k: ['A']}, {i: 1, k: []}]).entries()], [[3, ['A']], [1, []]]);
  for (const probe of lib.buildProbes({oldStems, newStems})) assert.ok((probe.values ?? []).every(value => value === null || !value.includes("'")), JSON.stringify(probe.values));
});

test('the workflow and the proof are consistent with the files they read: the proof reads exactly the generated files and the pinned corpora, applies ex06a first, and never names DEV', () => {
  const proof = read('ex06b_proof.mjs');
  for (const path of ['supabase/candidates/ex06b_alias_registry.sql', 'supabase/candidates/ex06b_alias_registry_revert.sql', 'supabase/proofs/ex06/ex06b_preflight.readonly.sql', 'supabase/proofs/ex06/ex06b_postflight.readonly.sql',
    'supabase/candidates/ex06a_flexible_window.sql', 'supabase/proofs/ex06/s06/ex06b_work_kinds_v5_dev_body.txt']) assert.ok(proof.includes(`'${path}'`), path);
  assert.ok(proof.includes('lib.CORPUS_V1_PIN.path') && proof.includes('lib.CORPUS_V11_PIN.path'));
  assert.ok(proof.indexOf('sql(ex06aCandidate)') < proof.indexOf('const surfaceBefore'), 'ex06a is applied before the baseline of this candidate is taken');
  assert.ok(proof.indexOf("sql(candidate);\n  assert.throws(() => sql(candidate), /EX06B_ALREADY_APPLIED/)") > proof.indexOf("refused('BODY_MD5'"), 'every refusal is tested before the application');
  assert.ok(/devAccess: false/.test(proof) && /providerCalls: 0/.test(proof) && /NOT canonical DEV/.test(proof));
  assert.ok(!/execute_sql|apply_migration|leqcwgzvjsxugfgzdmth/.test(proof), 'no connector and no DEV project id');
  const workflow = read('../../../.github/workflows/ex06b-alias-proof.yml');
  for (const needle of ['supabase/proofs/ex06/ex06b_proof.mjs', 'build_ex06b.py --check', 'ex06b_lib.test.mjs', 'ex06b_passes.test.mjs', 'ex06b-report.json']) assert.ok(workflow.includes(needle), needle);
  for (const trigger of ['supabase/candidates/ex06b_alias_registry.sql', 'supabase/candidates/ex06a_flexible_window.sql', 'supabase/proofs/ex06/s06/**', 'supabase/proofs/ex06/lib/**', 'supabase/proofs/ai/corpus/**']) assert.ok(workflow.includes(`'${trigger}'`), trigger);
});
