// P6 rollout V2 candidate proof — DISPOSABLE LOCAL TARGET ONLY.
// Proves that the composed deployable candidate (frozen rollout + proven visibility layer + proven PLACES layer):
//   * is reproducible from its three byte-pinned inputs (builder --check),
//   * applies on a PKG045b-restricted, certified predecessor in ONE transaction,
//   * yields exactly the function bodies / policy predicates / helper that the source-only proven stack yields,
//   * keeps the closure certificate, the erasure certificate and the Need ACL unchanged,
//   * keeps every P6 function SECURITY INVOKER with a fixed search_path and authenticated-only EXECUTE,
//   * refuses a second application without drift.
// It is not native acceptance, not a live apply and not an end-to-end SLA.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { URL } from 'node:url';

const out = '/tmp/p6-discovery-evidence';
const rollout = 'supabase/candidates/p6_discovery_rollout_v2.sql';
const frozen = 'supabase/candidates/p6_discovery_rollout.sql';
const base = 'supabase/candidates/p6_discovery_all.sql';
const v2 = 'supabase/candidates/p6_discovery_cost_v2.sql';
const v3 = 'supabase/candidates/p6_discovery_cost_v3.sql';
const vis = 'supabase/candidates/p6_discovery_visibility_cost_v1.sql';
const places = 'supabase/candidates/p6_discovery_places_cost_v1.sql';
const builder = 'scripts/proofs/build-p6-rollout-v2.mjs';
const liveObservation = 'supabase/proofs/discovery/p6_rollout_v2_live_observation.json';
const workflow = '.github/workflows/p6-rollout-v2-proof.yml';
const own = 'supabase/proofs/discovery/p6_rollout_v2_candidate_proof.mjs';
const sources = [rollout, frozen, base, v2, v3, vis, places, builder, liveObservation, own, workflow, 'package.json', 'package-lock.json'];
const functions = [
  'public.p6_discovery_trim(text)', 'public.p6_discovery_key(text)', 'public.p6_discovery_unquote(text)',
  'public.p6_discovery_area(text,text,boolean)', 'public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)',
  'public.p6_discovery_civil(text)', 'public.rpc_discovery_v1(jsonb)',
];
const POLICIES = ['needs_public_discovery', 'v5_closed_account_visibility'];
const HELPER = 'rls_private.p6_discovery_test_world_accounts()';
const PINS = {
  [frozen]: 'ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c',
  [base]: '1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e',
  [v2]: '4eae3b7befc498318c504bc40c344d72962c0a7e97dcb426bb65df3637944ba3',
  [v3]: '88cc4d2271ac4a5695a7b831737f80ffcaecc40b2cc9e887200d90825191d05b',
  [vis]: 'a988f403b419cc70b5c7f1f40101d566c58483781d1663b573910806880ecae3',
  [places]: '9297c4a1dda330969c79daf0af5a0752b02a496231978b240c35ca6dccb499f9',
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const report = { unit: 'P6_DEPLOYABLE_ROLLOUT_V2_CANDIDATE', sourceSha: process.env.GITHUB_SHA, result: 'FAIL', sourceHashes: {},
  liveAccess: false, serverApplied: false, providerCalled: false, native: false, productionWired: false, p6Finished: false };
let stage = 'ADMISSION';

const psql = (input, timeout = 240000) => spawnSync('psql', [process.env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
  { input, encoding: 'utf8', timeout, maxBuffer: 20 * 1024 * 1024 });
function mustSql(input, timeout) {
  const run = psql(input, timeout);
  if (run.status !== 0) { const e = new Error('P6_ROLLOUT_V2_SQL_REFUSED'); e.stderr = run.stderr; throw e; }
  return run.stdout.trim();
}
const catalogSql = () => {
  const fn = functions.map((x) => "'" + x.replaceAll("'", "''") + "'").join(',');
  const pol = POLICIES.map((x) => `'${x}'`).join(',');
  return `select jsonb_build_object(
  'rpcPresent',to_regprocedure('public.rpc_discovery_v1(jsonb)') is not null,
  'cert',(select sha256 from private.closure_source_v5 where singleton),
  'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
  'digest',private.closure_source_digest_v5(),
  'ready',private.retention_ai_source_ready(),
  'needsAcl',(select relacl::text from pg_class where oid='public.needs'::regclass),
  'authTableSelect',has_table_privilege('authenticated','public.needs','SELECT'),
  'anonTableSelect',has_table_privilege('anon','public.needs','SELECT'),
  'privateReadable',exists(select 1 from unnest(array['requester_account_id','remaining_search_closed_by_account_id','remaining_search_close_reason']) c
    where has_column_privilege('authenticated','public.needs',c,'SELECT') or has_column_privilege('anon','public.needs',c,'SELECT')),
  'policyCount',(select count(*) from pg_policies where schemaname='public' and tablename='needs'),
  'policies',(select coalesce(jsonb_object_agg(policyname,md5(qual)),'{}'::jsonb) from pg_policies
     where schemaname='public' and tablename='needs' and policyname in (${pol})),
  'helper',(select jsonb_build_object('defMd5',md5(pg_get_functiondef(p.oid)),'definer',p.prosecdef,'volatility',p.provolatile,'settings',p.proconfig,
     'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
     'serviceRole',has_function_privilege('service_role',p.oid,'EXECUTE'))
     from pg_proc p where p.oid=to_regprocedure('${HELPER}')),
  'functions',(select coalesce(jsonb_object_agg(sig,jsonb_build_object(
     'present',p.oid is not null,
     'bodyMd5',case when p.oid is null then null else md5(replace(p.prosrc,E'\\r\\n',E'\\n')) end,
     'definer',p.prosecdef,'volatility',p.provolatile,'settings',p.proconfig,
     'authenticated',case when p.oid is null then false else has_function_privilege('authenticated',p.oid,'EXECUTE') end,
     'anon',case when p.oid is null then false else has_function_privilege('anon',p.oid,'EXECUTE') end,
     'serviceRole',case when p.oid is null then false else has_function_privilege('service_role',p.oid,'EXECUTE') end
   ) order by sig),'{}'::jsonb)
   from unnest(array[${fn}]) sig left join pg_proc p on p.oid=to_regprocedure(sig))
 )`;
};
const catalog = () => JSON.parse(mustSql(catalogSql()));

function expectedStack() {
  const fn = functions.map((x) => "'" + x + "'").join(',');
  const pol = POLICIES.map((x) => `'${x}'`).join(',');
  const sql = `begin;
set local p6_discovery.disposable='SOURCE_ONLY_ROLLBACK';
${readFileSync(base, 'utf8')}
${readFileSync(v2, 'utf8')}
${readFileSync(v3, 'utf8')}
${readFileSync(vis, 'utf8')}
${readFileSync(places, 'utf8')}
select jsonb_build_object(
 'bodies',(select jsonb_object_agg(sig,md5(replace(p.prosrc,E'\\r\\n',E'\\n')) order by sig)
    from unnest(array[${fn}]) sig join pg_proc p on p.oid=to_regprocedure(sig)),
 'policies',(select jsonb_object_agg(policyname,md5(qual)) from pg_policies where schemaname='public' and tablename='needs' and policyname in (${pol})),
 'helperDefMd5',(select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid=to_regprocedure('${HELPER}')),
 'policyCount',(select count(*) from pg_policies where schemaname='public' and tablename='needs')
);
rollback;`;
  const raw = mustSql(sql);
  const line = raw.split('\n').filter((x) => x.startsWith('{')).at(-1);
  assert(line, 'P6_EXPECTED_STACK_OUTPUT');
  return JSON.parse(line);
}

function applyRollout(expectSuccess) {
  const run = spawnSync('psql', [process.env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', rollout],
    { encoding: 'utf8', timeout: 240000, maxBuffer: 20 * 1024 * 1024 });
  if (expectSuccess && run.status !== 0) { const error = new Error('P6_ROLLOUT_V2_APPLY_LOCAL'); error.stderr = run.stderr; throw error; }
  if (!expectSuccess) {
    assert.notEqual(run.status, 0, 'P6_ROLLOUT_V2_REPEAT_MUST_REFUSE');
    assert.match(run.stderr, /P6_ROLLOUT_ALREADY_INSTALLED/);
  }
  return run;
}

try {
  assert.equal(process.env.CI, '1'); assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.P6_PUBLIC_ARTIFACT_DIR, out);
  const u = new URL(process.env.DB_URL);
  assert.equal(u.hostname, '127.0.0.1'); assert.equal(u.port, '54322'); assert.equal(u.pathname, '/postgres'); assert.equal(u.username, 'postgres');
  assert.equal(process.env.DB_URL, process.env.RU5_DEVICE_DB_URL);
  mkdirSync(out, { recursive: true });
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(head, report.sourceSha);
  for (const path of sources) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', head + ':' + path]));
    report.sourceHashes[path] = sha256(bytes);
  }
  for (const [path, pin] of Object.entries(PINS)) assert.equal(sha256(Buffer.from(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'))), pin, `PIN:${path}`);

  stage = 'REPRODUCIBLE_COMPOSITION';
  execFileSync('node', [builder, '--check'], { encoding: 'utf8' });
  report.rolloutV2Sha256 = report.sourceHashes[rollout];

  stage = 'PKG045B_PRECONDITION';
  const pre = catalog();
  assert.equal(pre.rpcPresent, false);
  assert.equal(pre.authTableSelect, false); assert.equal(pre.anonTableSelect, false); assert.equal(pre.privateReadable, false);
  assert.equal(pre.ready, true); assert.equal(pre.cert, pre.erasure); assert.equal(pre.cert, pre.digest);
  assert.equal(pre.policyCount, 6); assert.equal(pre.helper, null);
  const live = JSON.parse(readFileSync(liveObservation, 'utf8'));
  // The disposable predecessor must carry the SAME public-discovery and closed-account predicates as canonical DEV.
  for (const name of POLICIES) assert.equal(pre.policies[name], live.needsPolicyQualMd5[name], `PREDECESSOR_POLICY_DRIFT:${name}`);
  report.localPredecessor = { pkg045bRestricted: true, cert: pre.cert, needsAclSha256: sha256(Buffer.from(pre.needsAcl ?? '')),
    policyQualMd5: pre.policies, matchesCanonicalDevPolicies: true };

  stage = 'EXACT_STACK_EQUIVALENCE';
  const expected = expectedStack();
  assert.equal(Object.keys(expected.bodies).length, 7);
  assert.equal(expected.policyCount, 6);
  assert.notDeepEqual(expected.policies, pre.policies, 'the visibility layer must actually change the two predicates');
  report.expectedStack = expected;

  stage = 'DEPLOYABLE_LOCAL_APPLY';
  applyRollout(true);
  stage = 'POST_APPLY_READBACK';
  const post = catalog();
  assert.equal(post.rpcPresent, true); assert.equal(post.ready, true);
  assert.equal(post.cert, pre.cert); assert.equal(post.erasure, pre.erasure); assert.equal(post.digest, pre.digest);
  assert.equal(post.needsAcl, pre.needsAcl); assert.equal(post.authTableSelect, false); assert.equal(post.anonTableSelect, false); assert.equal(post.privateReadable, false);
  assert.equal(post.policyCount, 6);

  stage = 'BODY_POLICY_HELPER_EQUIVALENCE';
  const actual = Object.fromEntries(Object.entries(post.functions).map(([key, value]) => [key, value.bodyMd5]));
  assert.deepEqual(actual, expected.bodies);
  assert.deepEqual(post.policies, expected.policies);
  assert.equal(post.helper.defMd5, expected.helperDefMd5);

  stage = 'SECURITY_MODES';
  for (const [signature, value] of Object.entries(post.functions)) {
    assert.equal(value.definer, false, signature); assert.deepEqual(value.settings, ['search_path=pg_catalog'], signature);
    assert.equal(value.authenticated, true, signature); assert.equal(value.anon, false, signature); assert.equal(value.serviceRole, false, signature);
  }
  // The RLS helper is the ONE deliberate SECURITY DEFINER: fixed search_path, stable, authenticated-only, in a non-API schema.
  assert.equal(post.helper.definer, true); assert.equal(post.helper.volatility, 's'); assert.deepEqual(post.helper.settings, ['search_path=pg_catalog']);
  assert.equal(post.helper.authenticated, true); assert.equal(post.helper.anon, false); assert.equal(post.helper.serviceRole, false);
  report.postApply = { certificateUnchanged: true, needsAclUnchanged: true, exactBodyMatch: true, exactPolicyMatch: true, helperMatch: true,
    functions: Object.keys(post.functions).length, policyCount: post.policyCount };

  stage = 'IDEMPOTENCY_REFUSAL';
  applyRollout(false);
  const afterRepeat = catalog();
  assert.deepEqual(afterRepeat.functions, post.functions); assert.equal(afterRepeat.cert, post.cert); assert.equal(afterRepeat.needsAcl, post.needsAcl);
  assert.deepEqual(afterRepeat.policies, post.policies);
  report.repeatApply = 'REFUSED_WITHOUT_DRIFT';

  assert.equal(live.rpcDiscoveryV1Present, false); assert.equal(live.pkg045bApplied, false); assert.equal(live.ledgerCount, 210);
  report.currentDevObservation = live;
  report.currentDevAdmissible = false;
  report.currentDevBlocker = 'PKG045b restricted Need ACL is not applied on canonical DEV; this candidate deliberately refuses that predecessor.';
  report.result = 'PASS';
} catch (error) {
  report.failure = { stage, category: 'PROOF_REFUSED', message: /^P6_[A-Z0-9_]+$/.test(error.message) ? error.message : 'P6_ROLLOUT_V2_PROOF_FAILED', assertion: String(error.message).slice(0, 400) };
  if (typeof error.stderr === 'string') {
    const state = error.stderr.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/); if (state) report.failure.sqlState = state[1];
    const diagnostic = error.stderr.match(/(P6_[A-Z0-9_]+(?::[^\n]*)?)/); if (diagnostic) report.failure.diagnostic = diagnostic[1].slice(0, 240);
  }
  process.exitCode = 1;
} finally {
  report.limits = [
    'Canonical DEV was observed read-only only; no P6, PKG045b or visibility apply on it.',
    'The deployable candidate intentionally requires PKG045b already restricted and the closure certificate ready.',
    'This proves composition bytes, body/policy/helper equivalence with the proven stack, certificate/ACL invariance and idempotent refusal on a disposable historical target — not native acceptance and not an end-to-end SLA.',
    'The visibility truth table (all account pairs) runs inside the candidate transaction itself; real-client behavior is covered by the separate native journey.',
  ];
  writeFileSync(out + '/p6-rollout-v2-candidate-receipt.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report.result + ' P6_DEPLOYABLE_ROLLOUT_V2_CANDIDATE');
}
