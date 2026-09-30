// Disposable proof that the deployable P6 rollout v2 can be reverted exactly, on the P0-aware restricted baseline (042a -> 045a -> P0 -> PKG045b).
// The reverted state must equal the baseline (function inventory, the two rewritten policies, certificate, Need ACL); a second revert and a revert
// before the rollout are refused; the rollout applies again to the same state afterwards. LOCAL DISPOSABLE STACK ONLY. Not a live apply.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const env = process.env;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
const out = env.PRE_V3_ARTIFACT_DIR; assert.ok(out); mkdirSync(out, { recursive: true });
const publicDir = env.P6_PUBLIC_ARTIFACT_DIR; assert.ok(publicDir); mkdirSync(publicDir, { recursive: true });

const rollout = 'supabase/candidates/p6_discovery_rollout_v2.sql';
const revert = 'supabase/candidates/p6_discovery_rollout_v2_revert.sql';
const report = { unit: 'P6_ROLLOUT_V2_REVERT_DISPOSABLE_PROOF', result: 'FAIL', sourceSha: env.GITHUB_SHA, disposableOnly: true, liveAccess: false,
  sourceArtifactHashes: {}, checks: [] };
let stage = 'SOURCE_BINDING';

function sql(source, expectFailure = false) {
  try {
    return { ok: true, out: execFileSync('psql', [env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
      { input: source, encoding: 'utf8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim() };
  } catch (error) {
    if (!expectFailure) throw error;
    return { ok: false, message: String(error.stderr ?? '') };
  }
}

const snapshot = () => JSON.parse(sql(`select jsonb_build_object(
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
  'ready',private.retention_ai_source_ready())`).out);

try {
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), env.GITHUB_SHA);
  for (const path of [rollout, revert, 'supabase/proofs/discovery/p6_rollout_v2_revert_proof.mjs']) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', `${env.GITHUB_SHA}:${path}`]));
    report.sourceArtifactHashes[path] = createHash('sha256').update(bytes).digest('hex');
  }
  stage = 'BASELINE_SNAPSHOT'; const before = snapshot();
  assert.equal(before.ready, true); assert.deepEqual(before.functions, {});
  assert.equal(before.digest, before.certificate); assert.equal(before.digest, before.erasure);
  assert.doesNotMatch(before.policies.needs_public_discovery ?? '', /^$/);

  stage = 'REVERT_REFUSED_BEFORE_ROLLOUT';
  const early = sql(readFileSync(revert, 'utf8'), true);
  assert.equal(early.ok, false); assert.match(early.message, /P6_REVERT_NOT_APPLIED/);
  assert.deepEqual(snapshot(), before);

  stage = 'APPLY_ROLLOUT_V2'; sql(readFileSync(rollout, 'utf8'));
  stage = 'ROLLED_OUT_SNAPSHOT'; const rolledOut = snapshot();
  assert.equal(Object.keys(rolledOut.functions).length, 8, 'six helpers, the RPC and the world-set helper');
  assert.notDeepEqual(rolledOut.policies, before.policies);
  assert.equal(rolledOut.digest, before.digest); assert.equal(rolledOut.certificate, before.certificate); assert.equal(rolledOut.relacl, before.relacl);

  stage = 'APPLY_REVERT'; sql(readFileSync(revert, 'utf8'));
  stage = 'REVERTED_SNAPSHOT'; const reverted = snapshot();
  assert.deepEqual(reverted, before, 'the reverted state must equal the baseline before the rollout, object for object');

  stage = 'SECOND_REVERT_REFUSED';
  const again = sql(readFileSync(revert, 'utf8'), true);
  assert.equal(again.ok, false); assert.match(again.message, /P6_REVERT_NOT_APPLIED/);
  assert.deepEqual(snapshot(), before);

  stage = 'ROLLOUT_AGAIN'; sql(readFileSync(rollout, 'utf8'));
  stage = 'ROUND_TRIP_SNAPSHOT'; const second = snapshot();
  assert.deepEqual(second, rolledOut, 'the rollout applied again after a revert must reach the same state');

  report.checks = ['EXACT_GIT_BYTES', 'REVERT_REFUSED_BEFORE_ROLLOUT', 'ROLLOUT_ADDS_EIGHT_FUNCTIONS_AND_REWRITES_POLICIES_CERTIFICATE_NEUTRAL',
    'REVERTED_STATE_EQUALS_BASELINE', 'SECOND_REVERT_REFUSED', 'ROLLOUT_APPLIES_AGAIN_SAME_STATE'];
  report.result = 'PASS';
} catch (error) {
  report.failure = { stage, message: String(error.message ?? error).slice(0, 500) };
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'p6-rollout-v2-revert-proof.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(publicDir, 'p6-rollout-v2-revert-receipt.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.result} P6_ROLLOUT_V2_REVERT_PROOF`);
}
