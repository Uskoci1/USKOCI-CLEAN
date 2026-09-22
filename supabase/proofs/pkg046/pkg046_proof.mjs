// PKG-046: task-photo upload cancellation on the certified owned-media domain (F16 / A05 / GAP-0036).
// Disposable SQL plus the actual local Auth/PostgREST stack; no DEV, no provider, no Storage object.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const sha = s => createHash('sha256').update(s).digest('hex');
const report = {package: 'PKG-046', sourceSha: env.GITHUB_SHA, disposableOnly: true, providerCalls: 0, storageObjects: 0, checks: []};
const save = () => writeFileSync(env.PRE_V3_ARTIFACT_DIR + '/pkg046-report.json', JSON.stringify(report, null, 2) + '\n');
const pass = name => {report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name);};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIVE_CERTIFICATE = '65980fce17030f1d8b34177b8989549c2144bf806478238af39dec04b137a591';
const closure = () => rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,(select sha256 from private.closure_erasure_source_v5 where singleton) erasure,private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5()->>'sourceSha256' binding")[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const md5 = sig => sql(`select md5(prosrc) from pg_proc where oid=${q(sig)}::regprocedure`);
const CLAIM = 'public.rpc_claim_media_upload_service(uuid,text,uuid,uuid,text,integer,text)', READ = 'public.rpc_read_media_upload(uuid)';
const count = where => Number(sql(`select count(*) from private.owned_media_assets where ${where}`));

// 1. Exact predecessor chain: the workflow replayed source147 and every dev_alpha up to PKG-040; PKG-042a and
//    PKG-045a are applied here from the exact bytes, which reproduces the live DEV certificate.
for (const [file, pin] of [['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql', 'f0b7356c9f66067e91b2acf63a7f30a6729debc22e1f0e2bc45af6524e145670'],
  ['supabase/candidates/pkg045a_task_read_contract.sql', 'a8aff72039f283683c630f99f211e0c40356951f3c353b872cc8b7af8c5032c3']]) {
  const text = readFileSync(file, 'utf8'); assert.equal(sha(text.replace(/\n$/, '')), pin, file); sql(text);
}
report.closureBefore = closure();
assert.equal(report.closureBefore.ready, true); assert.equal(report.closureBefore.live, report.closureBefore.certified);
assert.equal(report.closureBefore.live, report.closureBefore.erasure); assert.equal(report.closureBefore.live, LIVE_CERTIFICATE);
assert.equal(md5(CLAIM), '81962817e4f67b1e2663da0828f0da90'); assert.equal(md5(READ), '63ed40f2d8c4b7cc8805730f29046dcc');
assert.equal(sql("select to_regprocedure('public.rpc_cancel_media_upload(uuid,uuid)') is null"), 't');
const baselineSurface = surface();
pass('EXACT_PREDECESSOR_REPLAY_REPRODUCES_LIVE_CERTIFICATE');

// 2. Before: the exact call the app makes has no server function.
const owner = await rt.actor('pkg046-owner'), attacker = await rt.actor('pkg046-attacker');
const open = async a => {const r = await ok(a.client.rpc('rpc_ai_open_need_conversation_owned_v2', {p_client_request_id: randomUUID()})); assert.ok(/^[0-9a-f-]{36}$/.test(r.conversationId)); return r.conversationId;};
const conv = await open(owner), conv2 = await open(owner);
const keyAbsent = randomUUID();
const cancel = (a, c, k) => a.client.rpc('rpc_cancel_media_upload', {p_conversation_id: c, p_client_request_id: k});
const before = await cancel(owner, conv, keyAbsent);
assert.ok(before.error, 'EXPECTED_MISSING_FUNCTION'); report.beforeError = {code: before.error.code, message: before.error.message.slice(0, 200)};
assert.ok(before.error.code === 'PGRST202' || /rpc_cancel_media_upload/.test(before.error.message));
pass('BEFORE_APP_CANCEL_CALL_HAS_NO_SERVER_FUNCTION');

// 3. Tamper: predecessor drift and an incomplete re-bind roll everything back, schema and certificate included.
const candidate = 'supabase/candidates/pkg046a_media_upload_cancellation.sql', text = readFileSync(candidate, 'utf8');
report.candidateSha256 = sha(text.replace(/\n$/, ''));
assert.throws(() => sql(text.replace('81962817e4f67b1e2663da0828f0da90', '0'.repeat(32))), /PKG046_PREDECESSOR_DRIFT/);
assert.deepEqual(surface(), baselineSurface); assert.deepEqual(closure(), report.closureBefore);
assert.throws(() => sql(text.replace('execute replace(v_def, v_old, v_new);', 'perform 1;')), /PKG046_REBIND_INCOMPLETE/);
assert.deepEqual(surface(), baselineSurface); assert.deepEqual(closure(), report.closureBefore);
assert.throws(() => sql(text.replace("or md5(v_claim) is distinct from '4f522b3df65e00f6985e50e66d388bbc'", "or md5(v_claim) is distinct from '0'")), /PKG046_BODY_MISMATCH/);
assert.deepEqual(surface(), baselineSurface); assert.deepEqual(closure(), report.closureBefore);
pass('PREDECESSOR_DRIFT_BODY_MISMATCH_AND_INCOMPLETE_REBIND_ROLL_BACK_ATOMICALLY');

// 4. Apply once; a second run refuses.
sql(text); assert.throws(() => sql(text), /PKG046_ALREADY_APPLIED/); await sleep(1500);
report.closureAfter = closure();
assert.notEqual(report.closureAfter.live, report.closureBefore.live);
assert.equal(report.closureAfter.live, report.closureAfter.certified); assert.equal(report.closureAfter.live, report.closureAfter.erasure);
assert.equal(report.closureAfter.ready, true); assert.equal(report.closureAfter.binding, report.closureAfter.live);
assert.equal(md5(CLAIM), '4f522b3df65e00f6985e50e66d388bbc'); assert.equal(md5(READ), '36d5647d8e4423c3f75bd13459ff524c');
const after = surface(), removed = baselineSurface.filter(x => !after.includes(x)), added = after.filter(x => !baselineSurface.includes(x));
const allowed = /^(function:public\.(rpc_claim_media_upload_service|rpc_read_media_upload|rpc_cancel_media_upload)\(|function:private\.retention_ai_source_ready\(|column:private\.owned_media_assets\.input_(sha256|bytes|type):|constraint:private\.owned_media_assets\.owned_media_assets_(state_check|cancelled_tombstone_check):)/;
assert.ok([...removed, ...added].every(x => allowed.test(x)), JSON.stringify({removed, added}));
assert.equal(removed.length, 7); assert.equal(added.length, 9);
report.surface = {removed, added};
pass('ONLY_REVIEWED_MEDIA_OBJECTS_CHANGED_CERTIFICATE_MOVED_AND_REBOUND_IN_THREE_PLACES');

// 5. An absent command: durable tombstone, idempotent, never an asset, owner and conversation bound.
const absent = {accountId: owner.id, conversationId: conv, clientRequestId: keyAbsent, previousState: null, assetId: null, selected: false, cancelled: true, authoritative: true};
assert.deepEqual(await ok(cancel(owner, conv, keyAbsent)), absent);
assert.deepEqual(await ok(cancel(owner, conv, keyAbsent)), absent);
await denied(owner.client.rpc('rpc_read_media_upload', {p_client_request_id: keyAbsent}), 'MEDIA_NOT_FOUND');
await denied(cancel(owner, randomUUID(), keyAbsent), 'MEDIA_NOT_FOUND');
await denied(cancel(owner, conv2, keyAbsent), 'MEDIA_COMMAND_CONFLICT');
const photos = c => ok(owner.client.rpc('rpc_read_task_photos', {p_conversation_id: c}));
let p = await photos(conv); assert.deepEqual(p.photos, []); assert.equal(p.ready, true);
assert.equal(count(`account_id=${q(owner.id)} and client_request_id=${q(keyAbsent)} and state='CANCELLED' and not selected and input_sha256 is null and storage_path is null`), 1);
pass('ABSENT_COMMAND_TOMBSTONE_IDEMPOTENT_HIDDEN_FROM_EVERY_READ');

// 6. A delayed first send of the cancelled key is refused by the service claim; a fresh key is still admitted.
const claim = (key, h, bytes = 1024) => rt.service.rpc('rpc_claim_media_upload_service', {p_account_id: owner.id, p_scope: 'TASK', p_target_id: conv, p_client_request_id: key, p_input_sha256: h, p_input_bytes: bytes, p_input_type: 'image/jpeg'});
await denied(claim(keyAbsent, 'a'.repeat(64)), 'MEDIA_COMMAND_CANCELLED');
assert.equal(count(`account_id=${q(owner.id)} and client_request_id=${q(keyAbsent)}`), 1);
const keyProc = randomUUID(), admitted = await ok(claim(keyProc, 'b'.repeat(64), 2048));
assert.equal(admitted.acquired, true); assert.equal(admitted.asset.state, 'PROCESSING'); assert.equal(admitted.asset.selected, true);
pass('LATE_CLAIM_OF_CANCELLED_KEY_REFUSED_FRESH_KEY_ADMITTED');

// 7. Cancelling an admitted PROCESSING command deselects it; the dispatch may still settle READY, never into the draft.
const svc = (name, args) => ok(rt.service.rpc(name, {p_account_id: owner.id, ...args}));
const r2 = await ok(cancel(owner, conv, keyProc));
assert.deepEqual(r2, {...absent, clientRequestId: keyProc, previousState: 'PROCESSING', assetId: admitted.asset.assetId});
await svc('rpc_stage_media_upload_service', {p_asset_id: admitted.asset.assetId, p_attempt_id: admitted.attemptId, p_sha256: 'c'.repeat(64), p_width: 800, p_height: 600, p_byte_size: 4096});
assert.equal(await svc('rpc_dispatch_media_upload_service', {p_asset_id: admitted.asset.assetId, p_attempt_id: admitted.attemptId}), true);
assert.equal(await svc('rpc_settle_media_upload_service', {p_asset_id: admitted.asset.assetId, p_storage_sha256: 'c'.repeat(64), p_outcome: 'STORED'}), true);
const done = await svc('rpc_complete_media_upload_service', {p_asset_id: admitted.asset.assetId, p_storage_sha256: 'c'.repeat(64)});
assert.equal(done.state, 'READY'); assert.equal(done.selected, false);
p = await photos(conv); assert.deepEqual(p.photos, []);
assert.deepEqual(await ok(cancel(owner, conv, keyProc)), {...r2, previousState: 'READY'});
pass('ADMITTED_PROCESSING_COMMAND_DESELECTED_SETTLES_UNSELECTED');

// 8. A fully admitted photograph (READY, selected, in the draft refs) leaves the draft through the removal writer.
const keyReady = randomUUID(), c3 = await ok(claim(keyReady, 'd'.repeat(64), 4096));
await svc('rpc_stage_media_upload_service', {p_asset_id: c3.asset.assetId, p_attempt_id: c3.attemptId, p_sha256: 'e'.repeat(64), p_width: 1024, p_height: 768, p_byte_size: 8192});
await svc('rpc_dispatch_media_upload_service', {p_asset_id: c3.asset.assetId, p_attempt_id: c3.attemptId});
await svc('rpc_settle_media_upload_service', {p_asset_id: c3.asset.assetId, p_storage_sha256: 'e'.repeat(64), p_outcome: 'STORED'});
const ready = await svc('rpc_complete_media_upload_service', {p_asset_id: c3.asset.assetId, p_storage_sha256: 'e'.repeat(64)});
assert.equal(ready.state, 'READY'); assert.equal(ready.selected, true);
assert.equal(sql(`select ${q(ready.ref)} = any(private.media_task_refs(${q(conv)}))`), 't');
p = await photos(conv); assert.equal(p.photos.length, 1); assert.equal(p.photos[0].assetId, c3.asset.assetId);
assert.deepEqual(await ok(cancel(owner, conv, keyReady)), {...absent, clientRequestId: keyReady, previousState: 'READY', assetId: c3.asset.assetId});
p = await photos(conv); assert.deepEqual(p.photos, []); assert.equal(p.ready, true);
assert.equal(sql(`select ${q(ready.ref)} = any(private.media_task_refs(${q(conv)}))`), 'f');
pass('READY_PHOTO_LEAVES_DRAFT_THROUGH_EXISTING_REMOVAL_WRITER');

// 9. Another account, anonymous and the service role can neither cancel nor read the owner's commands.
await denied(cancel(attacker, conv, keyProc), 'MEDIA_NOT_FOUND');
await denied(attacker.client.rpc('rpc_read_media_upload', {p_client_request_id: keyProc}), 'MEDIA_NOT_FOUND');
await denied(rt.anon.rpc('rpc_cancel_media_upload', {p_conversation_id: conv, p_client_request_id: keyProc}));
await denied(rt.service.rpc('rpc_cancel_media_upload', {p_conversation_id: conv, p_client_request_id: keyProc}));
assert.equal(sql("select has_function_privilege('authenticated','public.rpc_cancel_media_upload(uuid,uuid)','EXECUTE')"), 't');
assert.equal(sql("select has_function_privilege('anon','public.rpc_cancel_media_upload(uuid,uuid)','EXECUTE') or has_function_privilege('service_role','public.rpc_cancel_media_upload(uuid,uuid)','EXECUTE')"), 'f');
assert.equal(count(`account_id=${q(owner.id)} and state='CANCELLED'`), 1);
assert.equal(count(`account_id=${q(owner.id)} and selected`), 0);
assert.equal(count(`account_id=${q(attacker.id)}`), 0);
assert.equal(sql(`select count(*) from private.media_evidence_refs_v5 r join private.owned_media_assets a on a.id=r.asset_id where a.state='CANCELLED'`), '0');
pass('OWNER_ONLY_ACL_AND_ZERO_UNEXPECTED_RESIDUE');

// 10. The actual erasure worker closes a new disposable account that holds a tombstone, on the new certificate.
const closing = await rt.actor('pkg046-closure'), convC = await open(closing), keyC = randomUUID();
assert.deepEqual(await ok(cancel(closing, convC, keyC)), {...absent, accountId: closing.id, conversationId: convC, clientRequestId: keyC});
assert.equal(count(`account_id=${q(closing.id)} and state='CANCELLED'`), 1);
await ok(closing.client.rpc('rpc_prepare_account_closure', {p_expected_user_id: closing.id, p_expected_revision: 0, p_client_request_id: randomUUID()}));
const review = await ok(closing.client.rpc('rpc_review_account_closure_execution', {p_expected_user_id: closing.id}));
assert.equal(review.ready, true);
const started = await ok(closing.client.rpc('rpc_start_account_closure_execution', {p_expected_user_id: closing.id, p_request_id: review.requestId,
  p_expected_revision: review.revision, p_client_request_id: randomUUID(), p_policy_sha256: review.policySha256}));
assert.equal(started.state, 'EXECUTING');
const {loadClosureWorker} = await import('../pre_v3/v5_closure_edge_runtime.mjs');
const runtime = loadClosureWorker({env: name => ({USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED: 'true', SUPABASE_URL: env.RU5_DEVICE_SUPABASE_URL,
  SUPABASE_ANON_KEY: env.RU5_DEVICE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.RU5_DEVICE_SERVICE_ROLE_KEY})[name],
  fetch: async (url, init) => {assert.equal(new URL(url).origin, 'http://127.0.0.1:54321'); return fetch(url, init);}});
let closed = null, calls = 0;
for (; calls < 400 && !closed; calls++) {
  const result = await runtime.handler(new Request('http://127.0.0.1/closure', {method: 'POST', headers: {apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY, 'content-type': 'application/json'},
    body: JSON.stringify({accountId: closing.id, generation: started.generation})}));
  assert.equal(result.status, 200); const value = await result.json(); if (value.state === 'CLOSED') closed = value;
}
assert.ok(closed, 'CLOSURE_NOT_COMPLETE'); assert.equal(closed.relationalOutcome, 'ORDINARY_PERSONAL_CONTENT_ERASED'); assert.deepEqual(closed.exceptions, []);
assert.equal(sql(`select deleted_at is not null from auth.users where id=${q(closing.id)}`), 't');
assert.equal(count(`account_id=${q(closing.id)}`), 0);
report.closureWorker = {calls, state: closed.state, relationalOutcome: closed.relationalOutcome, tombstoneErased: true, syntheticLocalAccountOnly: true};
assert.deepEqual(closure(), report.closureAfter);
pass('REAL_CLOSURE_WORKER_ERASES_TOMBSTONE_ACCOUNT_ON_NEW_CERTIFICATE');
report.result = 'PASS'; save();
