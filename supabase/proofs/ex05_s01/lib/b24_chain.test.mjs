// EX05-S01 offline unit tests: the B24 Part 1 CHAIN VARIANT. The committed candidate (supabase/candidates/b24_nonretried_conflicts_part1.sql) pins 54 DEV functions;
// the disposable chain lacks some of them (pkg051a, PKG-045b P0, P6 rollout v3, D12 ...). The variant keeps the committed text byte for byte and changes ONLY the target rows and the
// two count literals of the first guard. These tests read the real candidate from the repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  parseB24Part1Targets, targetObservationSql, selectChainTargets, deriveChainVariant, planChainVariant, CANDIDATE_PATH, EXPECTED_TARGETS, EXPECTED_SITES, CRITICAL_TARGETS,
} from './b24_chain.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const candidate = readFileSync(root + CANDIDATE_PATH, 'utf8');

test('the committed candidate yields exactly the 54 targets and 89 sites the generator states', () => {
  const targets = parseB24Part1Targets(candidate);
  assert.equal(targets.length, EXPECTED_TARGETS);
  assert.equal(targets.reduce((sum, item) => sum + item.sites, 0), EXPECTED_SITES);
  assert.equal(new Set(targets.map(item => item.fn)).size, targets.length);
  for (const item of targets) {
    assert.match(item.fn, /^(public|private)\.[a-z0-9_]+$/);
    assert.match(item.preMd5, /^[a-f0-9]{32}$/);
    assert.ok(Number.isInteger(item.sites) && item.sites >= 1);
  }
  assert.ok(targets.some(item => item.fn === 'public.rpc_send_agreement_message_v2' && item.sites === 1 && item.preMd5 === '8020a93751f4915bffff0fac5524ad64'));
  assert.ok(targets.some(item => item.fn === 'public.rpc_begin_push_send' && item.preMd5 === 'ea801be7205a8b07c7c94e20af3bd90e'));
});

test('a candidate whose target table is malformed or whose counts disagree is refused', () => {
  assert.throws(() => parseB24Part1Targets('select 1;'), /B24_TARGET_BLOCK_NOT_FOUND/);
  assert.throws(() => parseB24Part1Targets(candidate.replace("('private.execute_retention_job', 1,", "('private.execute_retention_job', one,")), /B24_TARGET_ROW_MALFORMED/);
  assert.throws(() => parseB24Part1Targets(candidate.replace('<> 54 or', '<> 53 or')), /B24_GUARD_COUNTS_DISAGREE/);
});

test('the observation query names every target once and is injection-safe', () => {
  const targets = parseB24Part1Targets(candidate);
  const sql = targetObservationSql(targets);
  for (const item of targets) assert.equal(sql.split("('" + item.fn + "')").length - 1, 1, item.fn);
  assert.match(sql, /jsonb_agg/);
  assert.ok(!sql.includes(';'), 'a single read-only statement without a terminator');
  assert.throws(() => targetObservationSql([{fn: "public.x'; drop table y; --", sites: 1, preMd5: 'a'.repeat(32)}]), /B24_TARGET_NAME_INVALID/);
});

const observe = (targets, overrides = {}) => targets.map(item => ({fn: item.fn, count: 1, sites: item.sites, hasPt409: false, strayMention: false, ...(overrides[item.fn] ?? {})}));

test('selectChainTargets keeps what exists exactly once with the pinned site count and names every drop with its reason', () => {
  const targets = parseB24Part1Targets(candidate);
  const all = selectChainTargets(targets, observe(targets));
  assert.equal(all.kept.length, 54); assert.deepEqual(all.dropped, []);
  const some = selectChainTargets(targets, observe(targets, {
    'private.platform_price_add_version': {count: 0, sites: 0},
    'public.rpc_set_retention_hold': {count: 2},
    'public.rpc_activate_urgent': {hasPt409: true},
    'public.rpc_save_worker_capacity': {sites: 7},
    'public.rpc_save_worker_location': {strayMention: true},
  }));
  assert.equal(some.kept.length, 49);
  assert.deepEqual(some.dropped.map(item => [item.fn, item.reason]).sort(), [
    ['private.platform_price_add_version', 'ABSENT'], ['public.rpc_activate_urgent', 'ALREADY_PT409'], ['public.rpc_save_worker_capacity', 'SITE_COUNT_DIFFERS'],
    ['public.rpc_save_worker_location', 'SITE_COUNT_DIFFERS'], ['public.rpc_set_retention_hold', 'NOT_UNIQUE']]);
});

test('an observation that is missing for a target is a harness error, never a silent drop', () => {
  const targets = parseB24Part1Targets(candidate);
  assert.throws(() => selectChainTargets(targets, observe(targets).slice(1)), /B24_OBSERVATION_MISSING/);
});

test('with every target kept the variant is byte-identical to the committed candidate', () => {
  const targets = parseB24Part1Targets(candidate);
  const variant = deriveChainVariant(candidate, targets);
  assert.ok(variant.sql === candidate, 'the all-kept variant differs from the committed candidate text');
  assert.equal(variant.keptCount, 54); assert.equal(variant.keptSites, 89); assert.equal(variant.droppedCount, 0);
});

test('dropping targets changes only the target rows and the two count literals of the first guard', () => {
  const targets = parseB24Part1Targets(candidate);
  const dropped = new Set(['private.platform_price_add_version', 'public.rpc_set_retention_hold', 'public.rpc_activate_urgent']);
  const kept = targets.filter(item => !dropped.has(item.fn));
  const variant = deriveChainVariant(candidate, kept);
  assert.equal(variant.keptCount, kept.length); assert.equal(variant.droppedCount, 3);
  const before = candidate.split('\n'), after = variant.sql.split('\n');
  const removedLines = before.filter(line => !after.includes(line)), addedLines = after.filter(line => !before.includes(line));
  // the three dropped target rows and the old guard line leave; only the new guard line arrives (the last row of the table is kept, so its terminator is unchanged)
  assert.equal(removedLines.length, 4); assert.equal(addedLines.length, 1);
  for (const line of removedLines) assert.ok(line.includes('b24_targets') || [...dropped].some(fn => line.includes("'" + fn + "'")), 'unexpected removed line: ' + line);
  const guard = after.find(line => line.includes('(select count(*) from b24_targets) <>'));
  assert.deepEqual(addedLines, [guard]);
  assert.ok(guard.includes('<> ' + kept.length + ' or'));
  assert.ok(guard.includes('<> ' + kept.reduce((sum, item) => sum + item.sites, 0) + ' then'));
  // everything outside the target block and the guard is identical
  const stripBlock = text => text.replace(/insert into b24_targets\(fn, sites, pre_md5\) values[\s\S]*?;(\r?\n)/, '<<BLOCK>>$1').replace(/<> \d+ or \(select sum\(sites\) from b24_targets\) <> \d+ then/, '<<COUNTS>> then');
  assert.ok(stripBlock(variant.sql) === stripBlock(candidate), 'text outside the target block and the guard differs');
});

test('the variant ends its target table with a semicolon and the re-parsed variant lists exactly the kept targets', () => {
  const targets = parseB24Part1Targets(candidate);
  const kept = targets.filter(item => item.fn !== 'public.rpc_write_agreement_current_location');
  const variant = deriveChainVariant(candidate, kept);
  assert.deepEqual(parseB24Part1Targets(variant.sql).map(item => item.fn), kept.map(item => item.fn));
  assert.match(variant.sql, /\('public\.rpc_set_retention_hold', 2, '[a-f0-9]{32}'\)(,|;)\r?\n/);
});

test('an empty target list is refused', () => {
  assert.throws(() => deriveChainVariant(candidate, []), /B24_NOTHING_TO_CONVERT/);
});

function pglast() {
  for (const python of ['python3', 'python']) {
    try { execFileSync(python, ['-c', 'import pglast'], {stdio: 'ignore'}); return python; } catch { /* try the next interpreter */ }
  }
  return null;
}

test('the derived SQL is accepted by the PostgreSQL grammar (pglast) when it is installed', {skip: pglast() === null && 'pglast is not installed'}, () => {
  const targets = parseB24Part1Targets(candidate);
  const kept = targets.filter(item => item.fn !== 'public.rpc_set_retention_hold');
  const variant = deriveChainVariant(candidate, kept);
  const python = pglast();
  const script = 'import sys, pglast\nsql = sys.stdin.read()\nstatements = pglast.parse_sql(sql)\nprint(len(statements))\n';
  const out = execFileSync(python, ['-c', script], {input: variant.sql, encoding: 'utf8'}).trim();
  assert.ok(Number(out) >= 6, 'parsed ' + out + ' statements');
});

test('planChainVariant: every target present gives an ok plan identical to the committed candidate', () => {
  const targets = parseB24Part1Targets(candidate);
  const plan = planChainVariant(candidate, observe(targets));
  assert.equal(plan.report.ok, true); assert.equal(plan.report.identicalToCommitted, true);
  assert.equal(plan.report.kept, 54); assert.equal(plan.report.keptSites, 89); assert.deepEqual(plan.report.dropped, []); assert.deepEqual(plan.report.criticalDropped, []);
  assert.ok(plan.sql === candidate);
  assert.match(plan.report.candidateSha256, /^[a-f0-9]{64}$/); assert.equal(plan.report.variantSha256, plan.report.candidateSha256);
});

test('planChainVariant: dropping non-critical targets is ok and listed; the variant then differs from the committed text', () => {
  const targets = parseB24Part1Targets(candidate);
  const plan = planChainVariant(candidate, observe(targets, {'private.platform_price_add_version': {count: 0, sites: 0}, 'public.rpc_set_retention_hold': {count: 0, sites: 0}}));
  assert.equal(plan.report.ok, true); assert.equal(plan.report.identicalToCommitted, false);
  assert.equal(plan.report.kept, 52); assert.deepEqual(plan.report.dropped.map(item => item.fn).sort(), ['private.platform_price_add_version', 'public.rpc_set_retention_hold']);
  assert.notEqual(plan.report.variantSha256, plan.report.candidateSha256);
});

test('planChainVariant: a dropped CRITICAL target (a function the chat proofs assert on) makes the plan not ok and names it', () => {
  const targets = parseB24Part1Targets(candidate);
  for (const fn of CRITICAL_TARGETS) assert.ok(targets.some(item => item.fn === fn), fn + ' is a target of the committed candidate');
  const plan = planChainVariant(candidate, observe(targets, {'public.rpc_send_agreement_message_v2': {sites: 2}}));
  assert.equal(plan.report.ok, false);
  assert.deepEqual(plan.report.criticalDropped.map(item => [item.fn, item.reason]), [['public.rpc_send_agreement_message_v2', 'SITE_COUNT_DIFFERS']]);
});

test('planChainVariant: when nothing is convertible the plan is refused instead of producing an empty variant', () => {
  const targets = parseB24Part1Targets(candidate);
  const none = Object.fromEntries(targets.map(item => [item.fn, {count: 0, sites: 0}]));
  assert.throws(() => planChainVariant(candidate, observe(targets, none)), /B24_NOTHING_TO_CONVERT/);
});
