// P6 rollout V3 candidate proof - DISPOSABLE LOCAL TARGET ONLY.
// v3 is v2 with ONE change (the visibility layer's TEST-world set is derived from the account classifier instead of a fixed list of lineages). The first attempt to apply v2
// to canonical DEV (2026-09-30) was refused by its own semantic check (P6_VISIBILITY_SEMANTIC_MISMATCH:16): DEV also holds OWNER_PERSONAL / OWNER_BUSINESS in the TEST world (PKG-029e).
// This proof therefore:
//   * reproduces the lineage shape of canonical DEV (counts taken from the recorded live observation) in the disposable database,
//   * shows that the v2 candidate refuses on it with the SAME diagnostic and leaves the database untouched (the failing case, before the change),
//   * shows that v3 applies on it in ONE transaction, yields exactly the function bodies / policy predicates / helper of the source-only proven stack (with the same one change),
//   * shows that the helper equals the classifier for every account, and follows the classifier when it changes (the owners leave the TEST world with PKG-029e),
//   * keeps the closure certificate, the erasure certificate and the Need ACL unchanged, every P6 function SECURITY INVOKER with a fixed search_path and authenticated-only EXECUTE,
//   * refuses a second application, and reverts exactly with p6_discovery_rollout_v2_revert.sql (object for object), refuses a second revert, and applies again to the same state.
// It is not native acceptance, not a live apply and not an end-to-end SLA.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { URL } from 'node:url';
import { deriveHelper } from '../../../scripts/proofs/build-p6-rollout-v3.mjs';

const out = '/tmp/p6-discovery-evidence';
const rollout = 'supabase/candidates/p6_discovery_rollout_v3.sql';
const rolloutV2 = 'supabase/candidates/p6_discovery_rollout_v2.sql';
const revert = 'supabase/candidates/p6_discovery_rollout_v2_revert.sql';
const frozen = 'supabase/candidates/p6_discovery_rollout.sql';
const base = 'supabase/candidates/p6_discovery_all.sql';
const cost2 = 'supabase/candidates/p6_discovery_cost_v2.sql';
const cost3 = 'supabase/candidates/p6_discovery_cost_v3.sql';
const vis = 'supabase/candidates/p6_discovery_visibility_cost_v1.sql';
const places = 'supabase/candidates/p6_discovery_places_cost_v1.sql';
const builder = 'scripts/proofs/build-p6-rollout-v3.mjs';
const liveObservation = 'supabase/proofs/discovery/p6_rollout_v3_live_observation.json';
const workflow = '.github/workflows/p6-rollout-v3-proof.yml';
const own = 'supabase/proofs/discovery/p6_rollout_v3_candidate_proof.mjs';
const sources = [rollout, rolloutV2, revert, frozen, base, cost2, cost3, vis, places, builder, liveObservation, own, workflow, 'package.json', 'package-lock.json'];
const functions = [
  'public.p6_discovery_trim(text)', 'public.p6_discovery_key(text)', 'public.p6_discovery_unquote(text)',
  'public.p6_discovery_area(text,text,boolean)', 'public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz)',
  'public.p6_discovery_civil(text)', 'public.rpc_discovery_v1(jsonb)',
];
const POLICIES = ['needs_public_discovery', 'v5_closed_account_visibility'];
const HELPER = 'rls_private.p6_discovery_test_world_accounts()';
const REAL_FIXED_ID = '00000000-0000-4000-8000-000000000001';
const PINS = {
  [frozen]: 'ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c',
  [base]: '1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e',
  [cost2]: '4eae3b7befc498318c504bc40c344d72962c0a7e97dcb426bb65df3637944ba3',
  [cost3]: '88cc4d2271ac4a5695a7b831737f80ffcaecc40b2cc9e887200d90825191d05b',
  [vis]: 'a988f403b419cc70b5c7f1f40101d566c58483781d1663b573910806880ecae3',
  [places]: '9297c4a1dda330969c79daf0af5a0752b02a496231978b240c35ca6dccb499f9',
  [rolloutV2]: 'da01a4f1bd6454a8229c2d7c3fdcc951e944d0af69d4e99fc637d42f8c72f346',
  [revert]: '96ec31a0b3e171c32874d9c5976cd55000786430fd0b8e82c62488867261ff30',
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const lf = (text) => text.replace(/\r\n/g, '\n');
const report = { unit: 'P6_DEPLOYABLE_ROLLOUT_V3_CANDIDATE', sourceSha: process.env.GITHUB_SHA, result: 'FAIL', sourceHashes: {},
  liveAccess: false, serverApplied: false, providerCalled: false, native: false, productionWired: false, p6Finished: false };
let stage = 'ADMISSION';

const psql = (input, timeout = 240000) => spawnSync('psql', [process.env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
  { input, encoding: 'utf8', timeout, maxBuffer: 20 * 1024 * 1024 });
function mustSql(input, timeout) {
  const run = psql(input, timeout);
  if (run.status !== 0) { const e = new Error('P6_ROLLOUT_V3_SQL_REFUSED'); e.stderr = run.stderr; throw e; }
  return run.stdout.trim();
}
const lastJson = (raw) => JSON.parse(raw.split('\n').filter((x) => x.startsWith('{')).at(-1));
function applyFile(path) {
  return spawnSync('psql', [process.env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', path],
    { encoding: 'utf8', timeout: 240000, maxBuffer: 20 * 1024 * 1024 });
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
// The object-for-object snapshot the revert is judged by (functions, the two rewritten policies, the certificates, the Need ACL).
const snapshot = () => JSON.parse(mustSql(`select jsonb_build_object(
  'functions',(select coalesce(jsonb_object_agg(n.nspname||'.'||p.oid::regprocedure::text,
      jsonb_build_object('body',md5(p.prosrc),'acl',coalesce(p.proacl::text,''),'definer',p.prosecdef,'config',coalesce(p.proconfig::text,''))),'{}'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and (p.proname like 'p6\\_discovery\\_%' or p.proname='rpc_discovery_v1')) or (n.nspname='rls_private' and p.proname='p6_discovery_test_world_accounts')),
  'policies',(select jsonb_object_agg(polname,md5(coalesce(pg_get_expr(polqual,polrelid),'')||'|'||coalesce(pg_get_expr(polwithcheck,polrelid),'')))
    from pg_policy where polrelid='public.needs'::regclass),
  'relacl',(select relacl::text from pg_class where oid='public.needs'::regclass),
  'certificate',(select sha256 from private.closure_source_v5 where singleton),
  'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
  'digest',private.closure_source_digest_v5(),
  'ready',private.retention_ai_source_ready())`));

function expectedStack() {
  const fn = functions.map((x) => "'" + x + "'").join(',');
  const pol = POLICIES.map((x) => `'${x}'`).join(',');
  const sql = `begin;
set local p6_discovery.disposable='SOURCE_ONLY_ROLLBACK';
${readFileSync(base, 'utf8')}
${readFileSync(cost2, 'utf8')}
${readFileSync(cost3, 'utf8')}
${deriveHelper(lf(readFileSync(vis, 'utf8')))}
${readFileSync(places, 'utf8')}
select jsonb_build_object(
 'bodies',(select jsonb_object_agg(sig,md5(replace(p.prosrc,E'\\r\\n',E'\\n')) order by sig)
    from unnest(array[${fn}]) sig join pg_proc p on p.oid=to_regprocedure(sig)),
 'policies',(select jsonb_object_agg(policyname,md5(qual)) from pg_policies where schemaname='public' and tablename='needs' and policyname in (${pol})),
 'helperDefMd5',(select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid=to_regprocedure('${HELPER}')),
 'policyCount',(select count(*) from pg_policies where schemaname='public' and tablename='needs')
);
rollback;`;
  const line = lastJson(mustSql(sql));
  assert(line, 'P6_EXPECTED_STACK_OUTPUT');
  return line;
}

// The lineage shape of canonical DEV (counts from the recorded observation): synthetic accounts, one row per lineage entry.
function seedDevShapedLineage(counts) {
  const rows = Object.entries(counts).flatMap(([lineage, n]) => Array.from({ length: n }, () => lineage));
  const values = rows.map((lineage, at) => `(ids[${at + 1}],'${lineage}','Disposable proof shaped like canonical DEV','p6-rollout-v3')`).join(',');
  mustSql(`do $seed$
declare ids uuid[]:=array(select gen_random_uuid() from generate_series(1,${rows.length}));
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select id,'authenticated','authenticated','p6-lineage-'||id||'@proof.invalid',statement_timestamp(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Disposable lineage proof"}'::jsonb,statement_timestamp(),statement_timestamp()
  from unnest(ids) id;
  insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values ${values};
end $seed$;`);
  return rows.length;
}
// How many ordered account pairs disagree between the classifier and the v2 helper's fixed list: the number v2's own truth table reports.
const fixedListMismatch = () => Number(mustSql(`with ids as (select account_id from private.account_lineage_v5 union select '${REAL_FIXED_ID}'::uuid),
 listed as (select coalesce(array_agg(account_id),array[]::uuid[]) a from private.account_lineage_v5
   where lineage in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR'))
select count(*) from ids l cross join ids r cross join listed
where private.accounts_same_world(l.account_id,r.account_id) is distinct from ((l.account_id=any(listed.a))=(r.account_id=any(listed.a)))`));
const helperSets = () => lastJson(mustSql(`select jsonb_build_object(
 'helper',(select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from unnest(rls_private.p6_discovery_test_world_accounts()) x),
 'classifier',(select coalesce(jsonb_agg(l.account_id order by l.account_id),'[]'::jsonb) from private.account_lineage_v5 l where private.account_visibility_world(l.account_id)='TEST'),
 'owners',(select coalesce(jsonb_agg(l.account_id order by l.account_id),'[]'::jsonb) from private.account_lineage_v5 l where l.lineage in ('OWNER_PERSONAL','OWNER_BUSINESS')),
 'lineageRows',(select count(*) from private.account_lineage_v5)
)`));

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
  for (const [path, pin] of Object.entries(PINS)) assert.equal(sha256(Buffer.from(lf(readFileSync(path, 'utf8')))), pin, `PIN:${path}`);

  stage = 'REPRODUCIBLE_COMPOSITION';
  execFileSync('node', [builder, '--check'], { encoding: 'utf8' });
  report.rolloutV3Sha256 = report.sourceHashes[rollout];

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
  const before = snapshot();
  assert.deepEqual(before.functions, {});

  stage = 'DEV_SHAPED_LINEAGE';
  const preExisting = Number(mustSql('select count(*) from private.account_lineage_v5'));
  const seeded = seedDevShapedLineage(live.accountLineageCounts);
  const mismatch = fixedListMismatch();
  assert.ok(mismatch > 0, 'the DEV lineage shape must disagree with a fixed list of lineages');
  if (preExisting === 0) assert.equal(mismatch, 16, 'exactly the canonical DEV figure: 2 owners x (3 listed + 1 fixed REAL) x 2 orders');
  const shape = helperSets();
  assert.equal(shape.lineageRows, preExisting + seeded);
  report.devShapedLineage = { preExistingRows: preExisting, seededRows: seeded, fixedListMismatch: mismatch, lineageCounts: live.accountLineageCounts };

  stage = 'V2_REFUSES_ON_THE_DEV_LINEAGE_SHAPE';
  const refused = applyFile(rolloutV2);
  assert.notEqual(refused.status, 0, 'P6_V2_MUST_REFUSE_ON_THE_DEV_SHAPE');
  assert.match(refused.stderr, new RegExp(`P6_VISIBILITY_SEMANTIC_MISMATCH:${mismatch}\\b`));
  const afterRefusal = catalog();
  assert.equal(afterRefusal.rpcPresent, false); assert.equal(afterRefusal.helper, null);
  assert.deepEqual(afterRefusal.functions, pre.functions); assert.deepEqual(afterRefusal.policies, pre.policies);
  assert.equal(afterRefusal.cert, pre.cert); assert.equal(afterRefusal.needsAcl, pre.needsAcl);
  assert.deepEqual(snapshot(), before, 'the refusal must leave the database exactly as it was');
  report.v2OnDevShape = { refused: true, diagnostic: `P6_VISIBILITY_SEMANTIC_MISMATCH:${mismatch}`, databaseUntouched: true };

  stage = 'EXACT_STACK_EQUIVALENCE';
  const expected = expectedStack();
  assert.equal(Object.keys(expected.bodies).length, 7);
  assert.equal(expected.policyCount, 6);
  assert.notDeepEqual(expected.policies, pre.policies, 'the visibility layer must actually change the two predicates');
  report.expectedStack = expected;

  stage = 'DEPLOYABLE_LOCAL_APPLY';
  const applied = applyFile(rollout);
  if (applied.status !== 0) { const error = new Error('P6_ROLLOUT_V3_APPLY_LOCAL'); error.stderr = applied.stderr; throw error; }
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

  stage = 'HELPER_EQUALS_THE_CLASSIFIER';
  const sets = helperSets();
  assert.deepEqual(sets.helper, sets.classifier, 'the TEST-world set must equal the classifier for every account');
  assert.ok(sets.owners.length >= 2);
  for (const owner of sets.owners) assert.ok(sets.helper.includes(owner), 'DEV shape: the owner accounts are in the TEST world');
  assert.ok(!sets.helper.includes(REAL_FIXED_ID));

  stage = 'HELPER_FOLLOWS_A_CHANGED_CLASSIFIER';
  // What taking PKG-029e back looks like: the classifier no longer lists the two OWNER lineages. Inside a transaction that is rolled back.
  const changed = lastJson(mustSql(`begin;
create or replace function private.account_visibility_world(p_account_id uuid) returns text language sql stable security definer set search_path to 'pg_catalog' as $w$
  select case when coalesce(private.account_lineage(p_account_id),'UNCLASSIFIED') in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR') then 'TEST' else 'REAL' end;
$w$;
select jsonb_build_object('helper',(select coalesce(jsonb_agg(x order by x),'[]'::jsonb) from unnest(rls_private.p6_discovery_test_world_accounts()) x));
rollback;`));
  assert.equal(changed.helper.length, sets.helper.length - sets.owners.length);
  for (const owner of sets.owners) assert.ok(!changed.helper.includes(owner), 'the helper must follow the classifier when the owners leave the TEST world');
  assert.deepEqual(helperSets(), sets, 'the rolled-back experiment must leave the classifier as it was');
  report.helperDerivation = { equalsClassifier: true, followsChangedClassifier: true, testWorldAccounts: sets.helper.length, ownerAccounts: sets.owners.length };

  stage = 'IDEMPOTENCY_REFUSAL';
  const again = applyFile(rollout);
  assert.notEqual(again.status, 0, 'P6_ROLLOUT_V3_REPEAT_MUST_REFUSE');
  assert.match(again.stderr, /P6_ROLLOUT_ALREADY_INSTALLED/);
  const afterRepeat = catalog();
  assert.deepEqual(afterRepeat.functions, post.functions); assert.equal(afterRepeat.cert, post.cert); assert.equal(afterRepeat.needsAcl, post.needsAcl);
  assert.deepEqual(afterRepeat.policies, post.policies);
  report.repeatApply = 'REFUSED_WITHOUT_DRIFT';

  stage = 'REVERT_ROUND_TRIP';
  const rolledOut = snapshot();
  assert.equal(Object.keys(rolledOut.functions).length, 8, 'six helpers, the RPC and the world-set helper');
  assert.notDeepEqual(rolledOut.policies, before.policies);
  const reverted = applyFile(revert);
  if (reverted.status !== 0) { const error = new Error('P6_ROLLOUT_V3_REVERT_LOCAL'); error.stderr = reverted.stderr; throw error; }
  assert.deepEqual(snapshot(), before, 'the reverted state must equal the baseline before the rollout, object for object');
  const secondRevert = applyFile(revert);
  assert.notEqual(secondRevert.status, 0); assert.match(secondRevert.stderr, /P6_REVERT_NOT_APPLIED/);
  assert.deepEqual(snapshot(), before);
  const reapplied = applyFile(rollout);
  if (reapplied.status !== 0) { const error = new Error('P6_ROLLOUT_V3_REAPPLY_LOCAL'); error.stderr = reapplied.stderr; throw error; }
  assert.deepEqual(snapshot(), rolledOut, 'the rollout applied again after a revert must reach the same state');
  report.revertRoundTrip = 'EXACT_BASELINE_SECOND_REVERT_REFUSED_REAPPLY_SAME_STATE';

  assert.equal(live.rpcDiscoveryV1Present, false); assert.equal(live.pkg045bApplied, true); assert.equal(live.ledgerCount, 211);
  assert.equal(live.authenticatedNeedsTableSelect, false); assert.equal(live.anonNeedsTableSelect, false); assert.equal(live.privateNeedColumnsReadable, false);
  report.currentDevObservation = live;
  report.currentDevAdmissible = true;
  report.currentDevNote = 'Admissible by the recorded observation (PKG045b applied, P6 absent, certificate ready); a fresh preflight and a byte-exact readback are still required at apply time.';
  report.result = 'PASS';
} catch (error) {
  report.failure = { stage, category: 'PROOF_REFUSED', message: /^P6_[A-Z0-9_]+$/.test(error.message) ? error.message : 'P6_ROLLOUT_V3_PROOF_FAILED', assertion: String(error.message).slice(0, 400) };
  if (typeof error.stderr === 'string') {
    const state = error.stderr.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/); if (state) report.failure.sqlState = state[1];
    const diagnostic = error.stderr.match(/(P6_[A-Z0-9_]+(?::[^\n]*)?)/); if (diagnostic) report.failure.diagnostic = diagnostic[1].slice(0, 240);
  }
  process.exitCode = 1;
} finally {
  report.limits = [
    'Canonical DEV was observed read-only only; no P6, PKG045b or visibility apply on it belongs to this proof.',
    'The deployable candidate intentionally requires PKG045b already restricted and the closure certificate ready.',
    'This proves composition bytes, body/policy/helper equivalence with the proven stack, the DEV lineage shape (v2 refuses, v3 applies), certificate/ACL invariance, idempotent refusal and an exact revert on a disposable historical target - not native acceptance and not an end-to-end SLA.',
    'The visibility truth table (all account pairs) runs inside the candidate transaction itself; real-client behavior is covered by the separate native journey.',
  ];
  writeFileSync(out + '/p6-rollout-v3-candidate-receipt.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report.result + ' P6_DEPLOYABLE_ROLLOUT_V3_CANDIDATE');
}
