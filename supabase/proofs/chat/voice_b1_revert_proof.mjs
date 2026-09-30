// Chat voice B1 REVERT proof. Disposable local Auth / PostgREST / Postgres / Storage only; no provider, no DEV, no device.
// Requires the replayed chain through the exact B3c application file and B24 part 2 (workflow stages 01-26, the DEV-equivalent closure surface).
// Sequence: baseline of the complete catalog -> the revert is refused while nothing is applied -> the ONE-statement DEV application -> every refusal of the revert leaves the applied catalog
// unchanged -> the revert -> the complete catalog, the certificate and the digest equal the baseline -> the revert is refused a second time -> the application can be applied again (no residue).
// Every check runs even after an earlier one failed, so one CI run reports every broken assertion.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as rt from '../pre_v3/closure_runtime.mjs';
import { invalidationCatalogSnapshot } from './private_invalidation_catalog_snapshot.mjs';
const { assert, sql, rows, q, randomUUID, env } = rt;
const applicationPath = 'supabase/candidates/chat_voice_b1_dev_application.sql';
const revertPath = 'supabase/candidates/chat_voice_b1_revert.sql';
const preimagePath = 'supabase/proofs/chat/voice_b1_preimage.json';
const capturePath = 'supabase/proofs/chat/voice_b1_preimage_capture.readonly.sql';
const builderPath = 'supabase/proofs/chat/build_voice_b1_revert.py';
const harnessPath = 'supabase/proofs/chat/voice_b1_revert_proof.mjs';
const sources = [applicationPath, revertPath, preimagePath, capturePath, builderPath, harnessPath, 'supabase/proofs/chat/voice_b1_revert.template.sql',
  'supabase/proofs/chat/voice_b1_dev_application.head.sql', 'supabase/proofs/chat/voice_b1_dev_application.tail.sql', 'supabase/proofs/chat/build_voice_b1_dev_application.py',
  'supabase/proofs/chat/private_invalidation_catalog_snapshot.mjs', 'supabase/proofs/pkg023/pkg023_surface.sql', 'supabase/proofs/pre_v3/closure_runtime.mjs',
  'supabase/proofs/pre_v3/history_snapshot.mjs', '.github/workflows/chat-voice-b1-revert-proof.yml'];
const report = rt.report('CHAT_VOICE_B1_REVERT');
Object.assign(report, { providerCalls: 0, devAccess: false, devCertificateMoved: false, sourceArtifactHashes: {}, refusals: [], digests: {} });
const failures = [];
async function check(name, fn) {
  try { await fn(); rt.pass(report, name); }
  catch (e) { failures.push({ name, message: String(e && e.message || e).slice(0, 900) }); console.error('FAIL ' + name + ': ' + String(e && e.message || e).slice(0, 900)); }
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hashJson = value => sha256(JSON.stringify(value));
const snapshot = () => invalidationCatalogSnapshot(rt);
const closureState = () => rows(`select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified,
  private.retention_ai_source_ready() ready, private.closure_erasure_binding_v5() binding`)[0];
// The storage side (bucket rows, storage policies, triggers on storage.objects) is not in the domain surface: it is compared separately.
const storageSurface = () => rows(`select jsonb_build_object(
  'buckets',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]'::jsonb) from storage.buckets b),
  'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.policyname),'[]'::jsonb) from pg_policies p where p.schemaname='storage'),
  'triggers',(select coalesce(jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid)) order by t.tgname),'[]'::jsonb) from pg_trigger t where t.tgrelid='storage.objects'::regclass and not t.tgisinternal)) as s`)[0].s;
const DEV_DIGEST = /DEV_DIGEST = '([0-9a-f]{64})'/.exec(readFileSync(builderPath, 'utf8'))[1];
const python = (...args) => execFileSync('python3', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/** Names the top-level parts of two complete snapshots that differ, so a failed equality says where. */
function differences(left, right, ignore = []) {
  const out = [];
  for (const part of ['state', 'surface', 'history']) {
    if (part === 'state') { for (const key of new Set([...Object.keys(left.state), ...Object.keys(right.state)])) if (!ignore.includes('state.' + key) && JSON.stringify(left.state[key]) !== JSON.stringify(right.state[key])) out.push('state.' + key); }
    else if (JSON.stringify(left[part]) !== JSON.stringify(right[part])) out.push(part);
  }
  return out;
}
const equalSnapshots = (left, right, label, ignore = []) => assert.deepEqual(differences(left, right, ignore), [], label);
// An object created a second time has a new oid: the two oid-keyed lists are the only parts that may differ between two applications of the same file.
const OID_KEYED = ['state.other_function_metadata', 'state.table_authority'];

await check('SOURCE_BYTES_EQUAL_THE_TESTED_COMMIT', async () => {
  for (const path of sources) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', env.GITHUB_SHA + ':' + path]), 'SOURCE_BYTES_DIFFER:' + path);
    report.sourceArtifactHashes[path] = sha256(bytes);
  }
});

let baseline, baselineState, baselineStorage, revertText, afterApply, appliedState, chainRevert;
const application = readFileSync(applicationPath, 'utf8');
await check('PRE_IMAGE_IS_THE_STATE_THE_APPLICATION_STARTS_FROM_AND_THE_DEV_FILE_DIFFERS_FROM_THE_CHAIN_FILE_IN_THE_DIGEST_ONLY', async () => {
  baselineState = closureState(); assert.equal(baselineState.ready, true); assert.ok(baselineState.binding); assert.equal(baselineState.live, baselineState.certified);
  assert.equal(sql("select (to_regclass('private.agreement_voice_uploads_v1') is null and to_regprocedure('private.agreement_voice_surface_v1()') is null and not exists(select 1 from storage.buckets where id='agreement-voice'))::text"), 'true');
  // The committed pre-image is what this chain (whose 14 predecessor bodies equal the DEV receipt) holds now, except the chain's own certified digest.
  const committed = JSON.parse(readFileSync(preimagePath, 'utf8')), fresh = JSON.parse(sql(readFileSync(capturePath, 'utf8')));
  assert.equal(fresh.functions.length, 14); assert.equal(committed.functions.length, 14);
  fresh.functions.forEach((item, index) => {
    const was = committed.functions[index];
    assert.equal(item.signature, was.signature); assert.equal(item.hasCarriageReturn, false);
    const normalise = (text, digest) => text.replaceAll(digest, '<CERTIFIED>');
    assert.equal(normalise(item.definition, fresh.certifiedDigest), normalise(was.definition, committed.certifiedDigest), 'PRE_IMAGE_DIFFERS:' + item.signature);
  });
  assert.deepEqual(fresh.constraints, committed.constraints); assert.deepEqual(fresh.mediaObjectsRelations, committed.mediaObjectsRelations);
  assert.equal(fresh.certifiedDigest, baselineState.live);
  // The DEV file carries DEV's digest; the chain variant differs from it in that one literal only.
  revertText = readFileSync(revertPath, 'utf8');
  const tmp = env.PRE_V3_ARTIFACT_DIR + '/chat_voice_b1_revert.chain.sql';
  python(builderPath, '--digest', baselineState.live, '--out', tmp);
  chainRevert = readFileSync(tmp, 'utf8');
  assert.ok(revertText.split(DEV_DIGEST).length - 1 >= 3, 'the DEV file carries the DEV digest');
  assert.equal(revertText.replaceAll(DEV_DIGEST, baselineState.live), chainRevert);
  assert.ok(!chainRevert.includes(DEV_DIGEST));
  report.digests.chainBefore = baselineState.live; report.digests.devBefore = DEV_DIGEST;
});
await check('THE_COMMITTED_REVERT_FILE_IS_EXACTLY_THE_GENERATED_FILE', async () => {
  const result = execFileSync('python3', [builderPath, '--check'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.match(result, /^OK: /);
});
await check('THE_REVERT_IS_REFUSED_WHILE_NOTHING_IS_APPLIED_AND_CHANGES_NOTHING', async () => {
  baseline = snapshot(); baselineStorage = storageSurface(); assert.ok(chainRevert);
  assert.throws(() => sql(chainRevert), /VOICE_B1_REVERT_NOT_APPLIED/);
  equalSnapshots(snapshot(), baseline, 'CATALOG_CHANGED_BY_THE_REFUSED_REVERT');
  report.refusals.push({ name: 'NOT_APPLIED', refused: true, completeCatalogUnchanged: true });
});
await check('THE_APPLICATION_IS_APPLIED', async () => {
  assert.ok(baseline);
  sql(application);
  await new Promise(resolve => setTimeout(resolve, 1500));
  appliedState = closureState(); afterApply = snapshot();
  assert.equal(appliedState.ready, true); assert.notEqual(appliedState.live, baselineState.live); assert.equal(appliedState.live, appliedState.certified);
  report.digests.chainApplied = appliedState.live;
});
const applied = () => { assert.ok(afterApply); return afterApply; };
async function refusedAndRestored(name, pattern, tamper, repair) {
  const before = applied();
  tamper();
  const tampered = snapshot();
  assert.throws(() => sql(chainRevert), pattern, 'EXPECTED_REFUSAL:' + name);
  equalSnapshots(snapshot(), tampered, 'CATALOG_CHANGED_BY_REFUSAL:' + name);
  repair();
  equalSnapshots(snapshot(), before, 'REPAIR_DID_NOT_RESTORE:' + name);
  report.refusals.push({ name, refused: true, completeCatalogUnchanged: true });
}
await check('THE_REVERT_REFUSES_EVERY_DRIFT_OF_THE_APPLIED_STATE_AND_EVERY_KIND_OF_VOICE_DATA', async () => {
  const account = randomUUID();
  await refusedAndRestored('VOICE_UPLOAD_ROW_PRESENT', /VOICE_B1_REVERT_VOICE_DATA_PRESENT/,
    () => sql(`insert into private.agreement_voice_uploads_v1(account_id,agreement_id,agreement_version,client_request_id,state,cancelled_at) values (${q(account)},${q(randomUUID())},1,${q(randomUUID())},'CANCELLED',clock_timestamp())`),
    () => sql('truncate private.agreement_voice_uploads_v1'));
  const objectName = account + '/agreement-voice-v1/' + randomUUID() + '/' + 'a'.repeat(64) + '.m4a';
  await refusedAndRestored('BUCKET_OBJECT_PRESENT', /VOICE_B1_REVERT_VOICE_DATA_PRESENT/,
    () => sql(`insert into storage.objects(bucket_id,name,metadata) values ('agreement-voice',${q(objectName)},'{}'::jsonb)`),
    () => sql(`select set_config('storage.allow_delete_query','true',false); delete from storage.objects where bucket_id='agreement-voice' and name=${q(objectName)}`));
  // A space after the opening quote changes a body without changing anything else. The history readers are NOT on the digest roster, so they reach the body pins; a roster function
  // breaks the certificate first, which is refused with its own code.
  const spaced = text => { assert.ok(text.includes('AS $function$')); return text.replace('AS $function$', 'AS $function$ '); };
  const readerV2 = sql("select pg_get_functiondef('public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)'::regprocedure)");
  await refusedAndRestored('VOICE_FUNCTION_BODY_DRIFT', /VOICE_B1_REVERT_VOICE_FUNCTION_DRIFT/, () => sql(spaced(readerV2)), () => sql(readerV2));
  const readerV1 = sql("select pg_get_functiondef('public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)'::regprocedure)");
  await refusedAndRestored('APPLIED_BODY_DRIFT', /VOICE_B1_REVERT_APPLIED_BODY_DRIFT/, () => sql(spaced(readerV1)), () => sql(readerV1));
  const blockers = sql("select pg_get_functiondef('private.closure_blockers_v5(uuid)'::regprocedure)");
  await refusedAndRestored('ROSTER_BODY_DRIFT_BREAKS_THE_CERTIFICATE', /VOICE_B1_REVERT_APPLIED_STATE_NOT_CERTIFIED/, () => sql(spaced(blockers)), () => sql(blockers));
  await refusedAndRestored('CERTIFICATES_DISAGREE', /VOICE_B1_REVERT_APPLIED_STATE_NOT_CERTIFIED/,
    () => sql("update private.closure_erasure_source_v5 set sha256=repeat('0',64) where singleton"),
    () => sql(`update private.closure_erasure_source_v5 set sha256=${q(appliedState.live)} where singleton`));
  await refusedAndRestored('STRUCTURE_DRIFT', /VOICE_B1_REVERT_APPLIED_STRUCTURE_DRIFT/,
    () => sql('drop policy agreement_voice_no_client_v1 on storage.objects'),
    () => sql("create policy agreement_voice_no_client_v1 on storage.objects as restrictive for all to authenticated using(bucket_id <> 'agreement-voice') with check(bucket_id <> 'agreement-voice')"));
  assert.equal(closureState().live, appliedState.live);
});
await check('THE_REVERT_RESTORES_THE_COMPLETE_CATALOG_THE_CERTIFICATE_AND_THE_DIGEST_EXACTLY', async () => {
  assert.ok(baseline && afterApply);
  sql(chainRevert);
  await new Promise(resolve => setTimeout(resolve, 1500));
  const state = closureState();
  assert.equal(state.ready, true); assert.equal(state.live, baselineState.live); assert.equal(state.certified, baselineState.live); assert.equal(state.binding.sourceSha256, baselineState.live);
  equalSnapshots(snapshot(), baseline, 'REVERTED_CATALOG_DIFFERS_FROM_THE_BASELINE');
  assert.deepEqual(storageSurface(), baselineStorage, 'REVERTED_STORAGE_DIFFERS_FROM_THE_BASELINE');
  assert.equal(hashJson(snapshot()), hashJson(baseline));
  assert.equal(sql("select (to_regclass('private.agreement_voice_uploads_v1') is null and to_regprocedure('private.agreement_voice_surface_v1()') is null and to_regprocedure('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)') is null and not exists(select 1 from storage.buckets where id='agreement-voice') and not exists(select 1 from pg_attribute where attrelid='public.agreement_messages'::regclass and attname='voice_asset_id' and not attisdropped))::text"), 'true');
  report.digests.chainReverted = state.live; report.revertedCatalogSha256 = hashJson(snapshot()); report.baselineCatalogSha256 = hashJson(baseline);
});
await check('A_SECOND_REVERT_IS_REFUSED_AND_CHANGES_NOTHING', async () => {
  const before = snapshot();
  assert.throws(() => sql(chainRevert), /VOICE_B1_REVERT_NOT_APPLIED/);
  equalSnapshots(snapshot(), before, 'CATALOG_CHANGED_BY_THE_SECOND_REVERT');
  report.refusals.push({ name: 'SECOND_REVERT', refused: true, completeCatalogUnchanged: true });
});
await check('THE_APPLICATION_CAN_BE_APPLIED_AGAIN_AFTER_A_REVERT_AND_REACHES_THE_SAME_STATE', async () => {
  sql(application);
  await new Promise(resolve => setTimeout(resolve, 1500));
  const state = closureState();
  assert.equal(state.ready, true); assert.equal(state.live, appliedState.live, 'THE_DIGEST_AFTER_APPLY_REVERT_APPLY_DIFFERS_FROM_THE_FIRST_APPLICATION');
  equalSnapshots(snapshot(), afterApply, 'RE_APPLIED_CATALOG_DIFFERS_FROM_THE_FIRST_APPLICATION', OID_KEYED);
  report.digests.chainReapplied = state.live;
});

report.result = failures.length ? 'FAIL' : 'PASS'; report.failures = failures;
writeFileSync(rt.out + '/chat-voice-b1-revert-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(report.result + ' CHAT_VOICE_B1_REVERT (' + report.checks.length + ' passed, ' + failures.length + ' failed)');
if (failures.length) process.exit(1);
