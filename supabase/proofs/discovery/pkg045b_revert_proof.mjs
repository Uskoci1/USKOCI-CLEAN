// Disposable proof that PKG-045b (P0-compatible form) can be reverted exactly: restricted Need ACL, the five owner predicates and the closure/erasure
// certificate return to the state that existed BEFORE it, the revert refuses a second run, and the forward package applies again afterwards.
// LOCAL DISPOSABLE STACK ONLY (loopback targets enforced). Not a live apply.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const env = process.env;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.DB_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.P6_HISTORICAL_PKG045_REPLAY, '1', 'Explicit historical baseline replay admission is required');
assert.match(env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
const out = env.PRE_V3_ARTIFACT_DIR; assert.ok(out); mkdirSync(out, { recursive: true });
const publicDir = env.P6_PUBLIC_ARTIFACT_DIR; assert.ok(publicDir); mkdirSync(publicDir, { recursive: true });

const forward = ['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql', 'supabase/candidates/pkg045a_task_read_contract.sql',
  'supabase/candidates/discovery_p0_exact_public_landing.sql'];
const pkg045b = 'supabase/candidates/pkg045b_task_column_privileges_p0.sql';
const revert = 'supabase/candidates/pkg045b_revert_p0.sql';
const report = { unit: 'PKG045B_REVERT_DISPOSABLE_PROOF', result: 'FAIL', sourceSha: env.GITHUB_SHA, disposableOnly: true, liveAccess: false,
  sourceArtifactHashes: {}, checks: [] };
let stage = 'SOURCE_BINDING';

function sql(source, expectFailure = false) {
  try {
    return { ok: true, out: execFileSync('psql', [env.DB_URL, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
      { input: source, encoding: 'utf8', timeout: 90_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim() };
  } catch (error) {
    if (!expectFailure) throw error;
    return { ok: false, message: String(error.stderr ?? '') };
  }
}

const POLICIES = `(('need_sensitive','need_sensitive_owner'),('marketplace_responses','responses_requester_read'),
  ('marketplace_response_versions','response_versions_read'),('need_geography','need_geography_owner_read'),('need_requirement_details','need_requirement_details_owner_read'))`;
const snapshot = () => JSON.parse(sql(`select jsonb_build_object(
  'relacl',(select relacl::text from pg_class where oid='public.needs'::regclass),
  'attacl',(select coalesce(string_agg(a.attname||'='||a.attacl::text,';' order by a.attname),'') from pg_attribute a
            where a.attrelid='public.needs'::regclass and a.attnum>0 and not a.attisdropped and a.attacl is not null),
  'authenticatedWholeTable',has_table_privilege('authenticated','public.needs','SELECT'),
  'anonWholeTable',has_table_privilege('anon','public.needs','SELECT'),
  'policies',(select jsonb_object_agg(c.relname||'.'||p.polname,md5(coalesce(pg_get_expr(p.polqual,p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')))
              from pg_policy p join pg_class c on c.oid=p.polrelid where (c.relname,p.polname) in ${POLICIES}),
  'digest',private.closure_source_digest_v5(),
  'certificate',(select sha256 from private.closure_source_v5 where singleton),
  'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),
  'binding',private.closure_erasure_binding_v5()->>'sourceSha256',
  'ready',private.retention_ai_source_ready(),
  'readyMasked',(select md5(regexp_replace(prosrc,'[0-9a-f]{64}','<CERTIFIED>','g')) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure))`).out);

try {
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), env.GITHUB_SHA);
  for (const path of [...forward, pkg045b, revert, 'supabase/proofs/discovery/pkg045b_revert_proof.mjs']) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', `${env.GITHUB_SHA}:${path}`]));
    report.sourceArtifactHashes[path] = createHash('sha256').update(bytes).digest('hex');
  }
  stage = 'BASELINE';
  for (const [index, path] of forward.entries()) { stage = ['REPLAY_PKG042A', 'REPLAY_PKG045A', 'REPLAY_P0_EXACT_PUBLIC'][index]; sql(readFileSync(path, 'utf8')); }
  stage = 'BEFORE_SNAPSHOT'; const before = snapshot();
  assert.equal(before.ready, true); assert.equal(before.authenticatedWholeTable, true); assert.equal(before.anonWholeTable, true);
  assert.equal(before.digest, before.certificate); assert.equal(before.digest, before.erasure); assert.equal(before.digest, before.binding);
  assert.equal(before.attacl, '');
  report.before = { relacl: before.relacl, policies: before.policies, digest: before.digest };

  stage = 'REVERT_REFUSED_BEFORE_PKG045B';
  const early = sql(readFileSync(revert, 'utf8'), true);
  assert.equal(early.ok, false); assert.match(early.message, /PKG045B_REVERT_NOT_APPLIED/);
  assert.deepEqual(snapshot(), before);

  stage = 'APPLY_PKG045B_P0'; sql(readFileSync(pkg045b, 'utf8'));
  stage = 'RESTRICTED_SNAPSHOT'; const restricted = snapshot();
  assert.equal(restricted.ready, true); assert.equal(restricted.authenticatedWholeTable, false); assert.equal(restricted.anonWholeTable, false);
  assert.notEqual(restricted.digest, before.digest); assert.notEqual(restricted.attacl, ''); assert.notDeepEqual(restricted.policies, before.policies);
  assert.equal(restricted.digest, restricted.certificate); assert.equal(restricted.digest, restricted.erasure); assert.equal(restricted.digest, restricted.binding);

  stage = 'REVERT_WITH_WRONG_PIN_REFUSED';
  const wrong = sql(`select set_config('pkg045.revert_expected_digest','${'0'.repeat(64)}',true);\n${readFileSync(revert, 'utf8')}`, true);
  assert.equal(wrong.ok, false); assert.match(wrong.message, /PKG045B_REVERT_DIGEST_PIN_MISMATCH/);
  assert.deepEqual(snapshot(), restricted);

  stage = 'APPLY_REVERT';
  sql(`select set_config('pkg045.revert_expected_digest','${before.digest}',true);\n${readFileSync(revert, 'utf8')}`);
  stage = 'REVERTED_SNAPSHOT'; const reverted = snapshot();
  assert.deepEqual(reverted, before, 'the reverted state must equal the state before PKG-045b, byte for byte');

  stage = 'SECOND_REVERT_REFUSED';
  const again = sql(readFileSync(revert, 'utf8'), true);
  assert.equal(again.ok, false); assert.match(again.message, /PKG045B_REVERT_NOT_APPLIED/);
  assert.deepEqual(snapshot(), before);

  stage = 'FORWARD_AGAIN'; sql(readFileSync(pkg045b, 'utf8'));
  stage = 'ROUND_TRIP_SNAPSHOT'; const second = snapshot();
  assert.deepEqual(second, restricted, 'PKG-045b applied again after a revert must reach the same restricted state');

  report.checks = ['EXACT_GIT_BYTES', 'REVERT_REFUSED_WHEN_NOT_APPLIED', 'RESTRICTED_STATE_DIFFERS', 'WRONG_DIGEST_PIN_REFUSED',
    'REVERTED_STATE_EQUALS_BEFORE_ACL_POLICIES_CERTIFICATE', 'SECOND_REVERT_REFUSED', 'FORWARD_PACKAGE_APPLIES_AGAIN_SAME_STATE'];
  report.after = { restrictedDigest: restricted.digest, revertedDigest: reverted.digest };
  report.result = 'PASS';
} catch (error) {
  report.failure = { stage, message: String(error.message ?? error).slice(0, 400) };
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'pkg045b-revert-proof.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(publicDir, 'pkg045b-revert-receipt.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.result} PKG045B_REVERT_PROOF`);
}
