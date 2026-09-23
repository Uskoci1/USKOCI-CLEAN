// PKG-050: reading a Dogovor's conversation settles its "Nova poruka" notifications (D03 / P01).
// Disposable SQL plus the actual local Auth/PostgREST stack; no DEV, no provider, no phone.
// The Dogovor and its messages are made the way real ones are: a published task, a real offer, a real
// selection, and messages sent through the same RPC the app uses.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
const sha = s => createHash('sha256').update(s).digest('hex');
const report = {package: 'PKG-050', sourceSha: env.GITHUB_SHA, disposableOnly: true, providerCalls: 0, checks: []};
const save = () => writeFileSync(env.PRE_V3_ARTIFACT_DIR + '/pkg050-report.json', JSON.stringify(report, null, 2) + '\n');
const pass = name => {report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name);};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const closure = () => rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,(select sha256 from private.closure_erasure_source_v5 where singleton) erasure,private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5()->>'sourceSha256' binding")[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const FN = 'public.rpc_mark_agreement_messages_read(uuid)';
const md5 = sig => sql(`select md5(prosrc) from pg_proc where oid=${q(sig)}::regprocedure`);
const exists = sig => sql(`select (to_regprocedure(${q(sig)}) is not null)::text`) === 'true';
const acl = sig => sql(`select has_function_privilege('anon',${q(sig)},'EXECUTE')::text||has_function_privilege('authenticated',${q(sig)},'EXECUTE')::text||has_function_privilege('service_role',${q(sig)},'EXECUTE')::text`);
const events = (uid, agreementId) => rows(`select event_type,(read_at is not null)::text read from public.user_activity_events
  where recipient_user_id=${q(uid)} and entity_type='AGREEMENT' and entity_id=${q(agreementId)} order by created_at,id`);
const unreadResponseEvents = uid => sql(`select count(*) from public.user_activity_events where recipient_user_id=${q(uid)} and entity_type='RESPONSE' and read_at is null`);

// 1. The exact predecessor chain DEV carries today (ledger 200), then the certificate must be ready.
for (const [file, pin] of [['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql', 'f0b7356c9f66067e91b2acf63a7f30a6729debc22e1f0e2bc45af6524e145670'],
  ['supabase/candidates/pkg045a_task_read_contract.sql', 'a8aff72039f283683c630f99f211e0c40356951f3c353b872cc8b7af8c5032c3'],
  ['supabase/candidates/pkg046a_media_upload_cancellation.sql', 'd49bf0c85487fbf89312d52a05f2bc5f2c46b17f86fb1ccee89f4582e89750de'],
  ['supabase/candidates/pkg047a_safety_target.sql', '95c448063dbb7433330dad2e3442bfcaf7f93b4d22140a4cd335b8bd611234b5'],
  ['supabase/candidates/pkg048a_agreement_source_links.sql', '80c0512ed490b6145d21bd8a7ea291156d919fda00cce679617885ce66578832']]) {
  const text = readFileSync(file, 'utf8'); assert.equal(sha(text.replace(/\n$/, '')), pin, file); sql(text);
}
report.closureBefore = closure();
assert.equal(report.closureBefore.ready, true);
assert.equal(report.closureBefore.live, report.closureBefore.certified);
assert.equal(exists(FN), false);
assert.equal(md5('public.rpc_mark_activity_event_read(uuid)'), '89729d590c7e402a45a2ac60d516cae3');
assert.equal(md5('public.rpc_mark_inbox_read(timestamptz,text)'), '577d1582d5109f34fa0991e65af29f9d');
const baselineSurface = surface();
pass('EXACT_PREDECESSOR_REPLAY_READY_CERTIFICATE_AND_NO_SUCH_FUNCTION');

// A real Dogovor with a message in each direction.
const requester = await rt.actor('pkg050-requester'), worker = await rt.actor('pkg050-worker');
const faces = id => Object.fromEntries(rows(`select kind,id from public.app_profiles where account_id=${q(id)}`).map(r => [r.kind, r.id]));
const requesterProfile = faces(requester.id).REQUESTER, workerProfile = faces(worker.id).WORKER;
sql(`update public.app_profiles set city='Novi Sad', skills='{"Fizicki poslovi"}' where id=${q(workerProfile)};`);
await ok(worker.client.rpc('rpc_complete_worker_profile', {p_profile_id: workerProfile}));
const needId = randomUUID();
sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
  values(${q(needId)},${q(requester.id)},${q(requesterProfile)},'PUBLISHED','PKG-050 messages read','Disposable SQL fixture',
    'PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
const offer = await ok(worker.client.rpc('rpc_submit_response', {p_need_id: needId, p_need_revision: 1,
  p_worker_profile_id: workerProfile, p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null,
  p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID()}));
const agreementId = await ok(requester.client.rpc('rpc_select_response', {p_need_id: needId, p_need_revision: offer.needRevision,
  p_response_id: offer.responseId, p_response_version: offer.version, p_content_hash: offer.contentHash,
  p_client_request_id: randomUUID()}));
assert.ok(agreementId, 'NO_AGREEMENT');
const send = (actor, body) => ok(actor.client.rpc('rpc_send_agreement_message_v2', {p_expected_user_id: actor.id, p_agreement_id: agreementId, p_client_message_id: randomUUID(), p_body: body}));
await send(requester, 'Cao'); await send(worker, 'Ok, vidimo se sutra u 12.'); await send(worker, 'Javi ako se nesto promeni.');
// Each side holds unread MESSAGE_RECEIVED events about this Agreement, with in-app deliveries that were not suppressed.
const inApp = uid => sql(`select count(*) from public.user_activity_events e join public.notification_deliveries d on d.event_id=e.id and d.recipient_user_id=e.recipient_user_id and d.channel='IN_APP' and d.state<>'SUPPRESSED'
  where e.recipient_user_id=${q(uid)} and e.entity_type='AGREEMENT' and e.entity_id=${q(agreementId)} and e.event_type='MESSAGE_RECEIVED' and e.read_at is null`);
assert.equal(inApp(requester.id), '2'); assert.equal(inApp(worker.id), '1');
const responseUnreadBefore = unreadResponseEvents(requester.id);
assert.ok(Number(responseUnreadBefore) >= 1, 'THE_REQUESTER_SHOULD_HOLD_AN_UNREAD_RESPONSE_EVENT');
report.before = {requester: events(requester.id, agreementId), worker: events(worker.id, agreementId), requesterUnreadResponseEvents: responseUnreadBefore};

// 2. Before: reading the conversation has no server writer to call; the only per-event path needs the event id
//    the conversation never has, and the sweep would also silence the RESPONSE event about another matter.
await denied(requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: agreementId}));
assert.equal(inApp(requester.id), '2');
pass('BEFORE_NO_WRITER_EXISTS_AND_THE_EVENTS_STAY_UNREAD');

// 3. Tamper: a drifted predecessor and a changed body each abort and leave nothing behind.
const candidate = 'supabase/candidates/pkg050a_agreement_messages_read.sql', text = readFileSync(candidate, 'utf8');
report.candidateSha256 = sha(text.replace(/\n$/, ''));
const intact = () => {assert.deepEqual(surface(), baselineSurface); assert.deepEqual(closure(), report.closureBefore); assert.equal(exists(FN), false);};
assert.throws(() => sql(text.replace('89729d590c7e402a45a2ac60d516cae3', '0'.repeat(32))), /PKG050_PREDECESSOR_DRIFT/); intact();
assert.throws(() => sql(text.replace("and e.event_type = 'MESSAGE_RECEIVED' and e.read_at is null", "and e.event_type = 'MESSAGE_RECEIVED'  and e.read_at is null")), /PKG050_BODY_MISMATCH/); intact();
pass('DRIFT_AND_BODY_TAMPERS_ROLL_BACK_ATOMICALLY');

// 4. Apply once. One function appears, nothing else moves, and the certificate must NOT move.
sql(text); assert.throws(() => sql(text), /PKG050_ALREADY_APPLIED/); await sleep(1500);
report.closureAfter = closure();
assert.deepEqual(report.closureAfter, report.closureBefore);
assert.equal(acl(FN), 'falsetruefalse');
report.bodyMd5 = md5(FN);
assert.equal(md5('public.rpc_mark_activity_event_read(uuid)'), '89729d590c7e402a45a2ac60d516cae3');
assert.equal(md5('public.rpc_mark_inbox_read(timestamptz,text)'), '577d1582d5109f34fa0991e65af29f9d');
const after = surface(), removed = baselineSurface.filter(x => !after.includes(x)), added = after.filter(x => !baselineSurface.includes(x));
assert.equal(removed.length, 0, JSON.stringify(removed));
assert.equal(added.length, 1, JSON.stringify(added));
assert.ok(/^function:public\.rpc_mark_agreement_messages_read\(/.test(added[0]), added[0]);
report.surface = {removed, added};
pass('APPLIED_ONCE_ONLY_THE_NEW_FUNCTION_APPEARED_CERTIFICATE_UNCHANGED');

// 5. The requester reads the conversation: exactly its two message events settle; the worker's own event and
//    the requester's RESPONSE event about the offer are untouched. Reading again settles nothing.
assert.equal(await ok(requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: agreementId})), 2);
assert.equal(inApp(requester.id), '0'); assert.equal(inApp(worker.id), '1');
assert.equal(unreadResponseEvents(requester.id), responseUnreadBefore);
assert.equal(await ok(requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: agreementId})), 0);
report.afterRequester = {requester: events(requester.id, agreementId), worker: events(worker.id, agreementId)};
pass('THE_REQUESTER_SETTLES_ONLY_ITS_OWN_MESSAGE_EVENTS_ABOUT_THIS_DOGOVOR');

// 6. The worker does the same on its side; a new message afterwards is unread again until the conversation is read.
assert.equal(await ok(worker.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: agreementId})), 1);
assert.equal(inApp(worker.id), '0');
await send(requester, 'Vazi.');
assert.equal(inApp(worker.id), '1');
assert.equal(await ok(worker.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: agreementId})), 1);
assert.equal(inApp(worker.id), '0');
pass('THE_WORKER_SETTLES_ITS_SIDE_AND_A_NEW_MESSAGE_COUNTS_AGAIN');

// 7. Anyone who is not a party is refused the way the workspace refuses them; nothing changes for them or the parties.
const stranger = await rt.actor('pkg050-stranger');
await denied(stranger.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: agreementId}), 'AGREEMENT_NOT_FOUND');
await denied(requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: randomUUID()}), 'AGREEMENT_NOT_FOUND');
await denied(requester.client.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: null}), 'INVALID_AGREEMENT');
await denied(rt.anon.rpc('rpc_mark_agreement_messages_read', {p_agreement_id: agreementId}));
assert.deepEqual(closure(), report.closureBefore);
pass('STRANGERS_UNKNOWN_IDS_AND_ANON_ARE_REFUSED_AND_THE_CERTIFICATE_IS_UNMOVED');
report.result = 'PASS'; save();
