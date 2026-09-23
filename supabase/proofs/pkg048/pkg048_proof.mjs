// PKG-048: the Zadatak and the Prijava a Dogovor grew out of (F12 / D02 / GAP-PG04).
// Disposable SQL plus the actual local Auth/PostgREST stack; no DEV, no provider, no phone.
// The Dogovor here is made the way a real one is: a published task, a real offer, a real selection.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
const sha = s => createHash('sha256').update(s).digest('hex');
const report = {package: 'PKG-048', sourceSha: env.GITHUB_SHA, disposableOnly: true, providerCalls: 0, checks: []};
const save = () => writeFileSync(env.PRE_V3_ARTIFACT_DIR + '/pkg048-report.json', JSON.stringify(report, null, 2) + '\n');
const pass = name => {report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name);};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const closure = () => rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,(select sha256 from private.closure_erasure_source_v5 where singleton) erasure,private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5()->>'sourceSha256' binding")[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const WORKSPACE = 'public.rpc_get_agreement_workspace(uuid)';
const md5 = sig => sql(`select md5(prosrc) from pg_proc where oid=${q(sig)}::regprocedure`);
const acl = sig => sql(`select has_function_privilege('anon',${q(sig)},'EXECUTE')::text||has_function_privilege('authenticated',${q(sig)},'EXECUTE')::text||has_function_privilege('service_role',${q(sig)},'EXECUTE')::text`);

// 1. The exact predecessor chain DEV carries today.
for (const [file, pin] of [['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql', 'f0b7356c9f66067e91b2acf63a7f30a6729debc22e1f0e2bc45af6524e145670'],
  ['supabase/candidates/pkg045a_task_read_contract.sql', 'a8aff72039f283683c630f99f211e0c40356951f3c353b872cc8b7af8c5032c3'],
  ['supabase/candidates/pkg046a_media_upload_cancellation.sql', 'd49bf0c85487fbf89312d52a05f2bc5f2c46b17f86fb1ccee89f4582e89750de']]) {
  const text = readFileSync(file, 'utf8'); assert.equal(sha(text.replace(/\n$/, '')), pin, file); sql(text);
}
report.closureBefore = closure();
assert.equal(report.closureBefore.ready, true);
assert.equal(report.closureBefore.live, report.closureBefore.certified);
assert.equal(md5(WORKSPACE), '06a6485e5bf6c12b6d4c22d1668ecf76');
const aclBefore = acl(WORKSPACE);
const baselineSurface = surface();
pass('EXACT_PREDECESSOR_REPLAY_AND_READY_CERTIFICATE');

// A real Dogovor: a published Zadatak, an offer sent by another person, and the selection that binds them.
const requester = await rt.actor('pkg048-requester'), worker = await rt.actor('pkg048-worker');
const faces = id => Object.fromEntries(rows(`select kind,id from public.app_profiles where account_id=${q(id)}`).map(r => [r.kind, r.id]));
const requesterProfile = faces(requester.id).REQUESTER, workerProfile = faces(worker.id).WORKER;
sql(`update public.app_profiles set profile_status='ACTIVE' where account_id in (${q(requester.id)},${q(worker.id)})`);
const needId = randomUUID();
sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
  values(${q(needId)},${q(requester.id)},${q(requesterProfile)},'PUBLISHED','PKG-048 source links','Disposable SQL fixture',
    'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
const offer = await ok(worker.client.rpc('rpc_submit_response', {p_need_id: needId, p_need_revision: 1,
  p_worker_profile_id: workerProfile, p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null,
  p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID()}));
assert.ok(offer.responseId, 'NO_OFFER');
const agreementId = await ok(requester.client.rpc('rpc_select_response', {p_need_id: needId, p_need_revision: offer.needRevision,
  p_response_id: offer.responseId, p_response_version: offer.version, p_content_hash: offer.contentHash,
  p_client_request_id: randomUUID()}));
assert.ok(agreementId, 'NO_AGREEMENT');
const workspace = actor => ok(actor.client.rpc('rpc_get_agreement_workspace', {p_agreement_id: agreementId}));

// 2. Before: both parties see the task's words and neither can reach the task or the offer.
const beforeDoc = await workspace(requester);
assert.equal(beforeDoc.title, 'PKG-048 source links');
assert.equal(beforeDoc.needId, undefined); assert.equal(beforeDoc.applicationId, undefined);
report.before = {title: beforeDoc.title, needId: beforeDoc.needId ?? null, applicationId: beforeDoc.applicationId ?? null};
pass('BEFORE_THE_DOGOVOR_CANNOT_REACH_ITS_OWN_ZADATAK_OR_PRIJAVA');

// 3. Tamper: a drifted predecessor and a broken anchor each abort and leave nothing behind.
const candidate = 'supabase/candidates/pkg048a_agreement_source_links.sql', text = readFileSync(candidate, 'utf8');
report.candidateSha256 = sha(text.replace(/\n$/, ''));
const intact = () => {assert.deepEqual(surface(), baselineSurface); assert.deepEqual(closure(), report.closureBefore);
  assert.equal(md5(WORKSPACE), '06a6485e5bf6c12b6d4c22d1668ecf76');};
assert.throws(() => sql(text.replace('06a6485e5bf6c12b6d4c22d1668ecf76', '0'.repeat(32))), /PKG048_PREDECESSOR_DRIFT/); intact();
assert.throws(() => sql(text.replace("$anchor$'createdAt', a.created_at$anchor$", "$anchor$'notAKeyInThisBody'$anchor$")), /PKG048_ANCHOR_NOT_UNIQUE/); intact();
assert.throws(() => sql(text.replace("'applicationId', a.selected_response_id,", "'applicationId', a.selected_response_id ,")), /PKG048_BODY_MISMATCH/); intact();
pass('DRIFT_ANCHOR_AND_BODY_TAMPERS_ROLL_BACK_ATOMICALLY');

// 4. Apply once. One function is rewritten, nothing else moves, and the certificate must NOT move.
sql(text); assert.throws(() => sql(text), /PKG048_ALREADY_APPLIED/); await sleep(1500);
report.closureAfter = closure();
assert.deepEqual(report.closureAfter, report.closureBefore);
assert.equal(md5(WORKSPACE), 'afa60817d35f0efd1317e4b9915aa872');
assert.equal(acl(WORKSPACE), aclBefore);
const after = surface(), removed = baselineSurface.filter(x => !after.includes(x)), added = after.filter(x => !baselineSurface.includes(x));
const only = /^function:public\.rpc_get_agreement_workspace\(/;
assert.ok([...removed, ...added].every(x => only.test(x)), JSON.stringify({removed, added}));
assert.equal(removed.length, 1); assert.equal(added.length, 1);
report.surface = {removed, added};
pass('APPLIED_ONCE_ONLY_THE_WORKSPACE_CHANGED_CERTIFICATE_UNCHANGED');

// 5. Both sides can now reach the Zadatak and the Prijava this Dogovor grew out of, and everything else
//    about the document is exactly what it was.
for (const [label, actor] of [['requester', requester], ['worker', worker]]) {
  const doc = await workspace(actor);
  assert.equal(doc.needId, needId, label); assert.equal(doc.applicationId, offer.responseId, label);
  const {needId: _n, applicationId: _a, ...rest} = doc;
  const beforeSide = label === 'requester' ? beforeDoc : null;
  if (beforeSide) assert.deepEqual(rest, beforeSide, 'ONLY_THE_LINKS_ARE_NEW');
}
report.links = {needId, applicationId: offer.responseId};
pass('BOTH_SIDES_REACH_THE_SOURCE_ZADATAK_AND_PRIJAVA');

// 6. The links are the real rows, and they are not a new disclosure: each side already owns its end.
assert.equal(sql(`select count(*) from public.needs where id=${q(needId)} and requester_account_id=${q(requester.id)}`), '1');
assert.equal(sql(`select count(*) from public.marketplace_responses where id=${q(offer.responseId)} and worker_account_id=${q(worker.id)}`), '1');
assert.equal(sql(`select count(*) from public.agreements where id=${q(agreementId)} and need_id=${q(needId)} and selected_response_id=${q(offer.responseId)}`), '1');
pass('THE_LINKS_NAME_THE_ROWS_EACH_SIDE_ALREADY_OWNS');

// 7. A stranger is still refused the whole document, links included.
const stranger = await rt.actor('pkg048-stranger');
await denied(stranger.client.rpc('rpc_get_agreement_workspace', {p_agreement_id: agreementId}), 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN');
await denied(rt.anon.rpc('rpc_get_agreement_workspace', {p_agreement_id: agreementId}));
assert.deepEqual(closure(), report.closureBefore);
pass('A_STRANGER_IS_STILL_REFUSED_AND_THE_CERTIFICATE_IS_UNMOVED');
report.result = 'PASS'; save();
