// PKG-047: the safety target of a public profile (F05 / B08 / N06 / N07 / GAP-PG01).
// Disposable SQL plus the actual local Auth/PostgREST stack; no DEV, no provider, no phone.
// The two people here are real authenticated accounts created for this run, each with its own profile,
// so every call below carries a genuine JWT and passes through the same guards a phone would.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as rt from '../pre_v3/closure_runtime.mjs';
const {assert, sql, rows, q, randomUUID, ok, denied, env} = rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL, 'http://127.0.0.1:54321');
assert.equal(env.DB_URL, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const sha = s => createHash('sha256').update(s).digest('hex');
const report = {package: 'PKG-047', sourceSha: env.GITHUB_SHA, disposableOnly: true, providerCalls: 0, writesByTheNewReader: 0, checks: []};
const save = () => writeFileSync(env.PRE_V3_ARTIFACT_DIR + '/pkg047-report.json', JSON.stringify(report, null, 2) + '\n');
const pass = name => {report.checks.push({name, result: 'PASS'}); save(); console.log('PASS ' + name);};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const closure = () => rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,(select sha256 from private.closure_erasure_source_v5 where singleton) erasure,private.retention_ai_source_ready() ready,private.closure_erasure_binding_v5()->>'sourceSha256' binding")[0];
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split('\n').filter(Boolean);
const md5 = sig => sql(`select md5(prosrc) from pg_proc where oid=${q(sig)}::regprocedure`);
const TARGET = 'public.rpc_read_safety_target(uuid)';
const counts = () => rows('select (select count(*) from private.account_blocks) blocks,(select count(*) from private.safety_reports) reports')[0];

// 1. The exact predecessor chain. The workflow replayed source147 and every dev_alpha up to PKG-040; the three
//    applied since are laid down here from their exact bytes, so this stack is the one DEV carries today.
for (const [file, pin] of [['supabase/candidates/pkg042a_cancelled_agreement_read_parity.sql', 'f0b7356c9f66067e91b2acf63a7f30a6729debc22e1f0e2bc45af6524e145670'],
  ['supabase/candidates/pkg045a_task_read_contract.sql', 'a8aff72039f283683c630f99f211e0c40356951f3c353b872cc8b7af8c5032c3'],
  ['supabase/candidates/pkg046a_media_upload_cancellation.sql', 'd49bf0c85487fbf89312d52a05f2bc5f2c46b17f86fb1ccee89f4582e89750de']]) {
  const text = readFileSync(file, 'utf8'); assert.equal(sha(text.replace(/\n$/, '')), pin, file); sql(text);
}
report.closureBefore = closure();
assert.equal(report.closureBefore.ready, true);
assert.equal(report.closureBefore.live, report.closureBefore.certified); assert.equal(report.closureBefore.live, report.closureBefore.erasure);
assert.equal(report.closureBefore.binding, report.closureBefore.live);
// The reviewed authority this reader repeats, and the writers it feeds, exactly as pinned in the candidate.
assert.equal(md5('public.rpc_get_public_profile(uuid)'), '9ecc0b69096f1167d02e0bb7b9656bc0');
assert.equal(md5('public.rpc_get_account_block(uuid)'), 'b91745f39246ddd60245e32821364dd8');
assert.equal(md5('public.rpc_set_account_block(uuid,boolean,integer,uuid)'), '43b3b050c3ddc21657790f13c424390e');
assert.equal(md5('public.rpc_submit_safety_report(uuid,uuid,uuid,text,text,text,uuid)'), '9249705c01cc3d29d178f1ebd331daeb');
assert.equal(sql(`select to_regprocedure(${q(TARGET)}) is null`), 't');
const baselineSurface = surface();
pass('EXACT_PREDECESSOR_REPLAY_AND_READY_CERTIFICATE');

// Two real people for this run: the one reading a profile, and the one behind it. Every account is born
// with both faces — the auth trigger creates a REQUESTER and a WORKER profile — which is exactly why a
// block has to follow the person. They start as drafts, so the proof publishes them first.
const viewer = await rt.actor('pkg047-viewer'), person = await rt.actor('pkg047-person');
const faces = id => Object.fromEntries(rows(`select kind,id from public.app_profiles where account_id=${q(id)}`).map(r => [r.kind, r.id]));
const viewerFaces = faces(viewer.id), personFaces = faces(person.id);
assert.deepEqual(Object.keys(personFaces).sort(), ['REQUESTER', 'WORKER']);
const viewerProfile = viewerFaces.WORKER, targetProfile = personFaces.REQUESTER, targetOtherFace = personFaces.WORKER;
sql(`update public.app_profiles set profile_status='ACTIVE' where account_id in (${q(viewer.id)},${q(person.id)})`);
// Neither account is classified, so both live in the same visibility world; the reader checks that itself.
assert.equal(sql(`select private.accounts_same_world(${q(viewer.id)},${q(person.id)})`), 't');
const readTarget = (actor, profileId) => actor.client.rpc('rpc_read_safety_target', {p_profile_id: profileId});
const publicProfile = (actor, profileId) => ok(actor.client.rpc('rpc_get_public_profile', {p_profile_id: profileId}));

// 2. Before: the exact call the app will make does not exist, which is why the screens carry no entry.
const before = await readTarget(viewer, targetProfile);
assert.ok(before.error, 'EXPECTED_MISSING_FUNCTION');
report.beforeError = {code: before.error.code, message: before.error.message.slice(0, 200)};
assert.ok(before.error.code === 'PGRST202' || /rpc_read_safety_target/.test(before.error.message));
// The profile itself is visible: only the target is missing.
assert.equal((await publicProfile(viewer, targetProfile)).profileId, targetProfile);
pass('BEFORE_APP_SAFETY_TARGET_CALL_HAS_NO_SERVER_FUNCTION');

// 3. Tamper: drifted authority, a changed body and a missing grant each abort and leave nothing behind.
const candidate = 'supabase/candidates/pkg047a_safety_target.sql', text = readFileSync(candidate, 'utf8');
report.candidateSha256 = sha(text.replace(/\n$/, ''));
const intact = () => {assert.deepEqual(surface(), baselineSurface); assert.deepEqual(closure(), report.closureBefore);};
assert.throws(() => sql(text.replace('9ecc0b69096f1167d02e0bb7b9656bc0', '0'.repeat(32))), /PKG047_PREDECESSOR_DRIFT/); intact();
assert.throws(() => sql(text.replace("'profileId',v_profile.id", "'profileId', v_profile.id")), /PKG047_BODY_MISMATCH/); intact();
assert.throws(() => sql(text.replace('grant execute on function public.rpc_read_safety_target(uuid) to authenticated;', '')), /PKG047_ACL_MISMATCH/); intact();
pass('DRIFT_BODY_AND_GRANT_TAMPERS_ROLL_BACK_ATOMICALLY');

// 4. Apply once. One function is added, nothing else moves, and the certificate must NOT move: this package
//    touches no table, constraint, trigger or reviewed erasure function.
sql(text); assert.throws(() => sql(text), /PKG047_ALREADY_APPLIED/); await sleep(1500);
report.closureAfter = closure();
assert.deepEqual(report.closureAfter, report.closureBefore);
const after = surface(), removed = baselineSurface.filter(x => !after.includes(x)), added = after.filter(x => !baselineSurface.includes(x));
assert.deepEqual(removed, []);
assert.equal(added.length, 1); assert.ok(/^function:public\.rpc_read_safety_target\(/.test(added[0]), added[0]);
report.surface = {removed, added};
report.functionAuthority = rows(`select prosecdef,provolatile,proconfig::text config,proacl::text acl from pg_proc where oid=${q(TARGET)}::regprocedure`)[0];
assert.equal(report.functionAuthority.prosecdef, true); assert.equal(report.functionAuthority.provolatile, 's');
assert.equal(report.functionAuthority.config, '{search_path=pg_catalog}');
pass('APPLIED_ONCE_ONE_FUNCTION_ADDED_CERTIFICATE_UNCHANGED');

// 5. The target is the person, not the face: the account behind the profile, and the caller's own choice
//    about it, agreeing with the independent block reader.
const t = await ok(readTarget(viewer, targetProfile));
assert.deepEqual(t, {profileId: targetProfile, accountId: viewer.id, targetAccountId: person.id,
  blocked: false, revision: 0, authoritative: true});
assert.deepEqual(await ok(viewer.client.rpc('rpc_get_account_block', {p_target_account_id: person.id})),
  {accountId: viewer.id, targetAccountId: person.id, blocked: false, revision: 0, authoritative: true});
const back = await ok(readTarget(person, viewerProfile));
assert.equal(back.targetAccountId, viewer.id); assert.equal(back.accountId, person.id);
// Both faces of one person resolve to that person: blocking from either reaches the same account.
const otherFace = await ok(readTarget(viewer, targetOtherFace));
assert.equal(otherFace.targetAccountId, t.targetAccountId);
assert.notEqual(otherFace.profileId, t.profileId);
pass('TARGET_IS_THE_ACCOUNT_BEHIND_THE_PROFILE_AND_AGREES_WITH_THE_BLOCK_READER');

// 6. It resolves exactly what the public profile shows, and never the caller's own account.
const parity = async (actor, profileId, label) => {
  const visible = await publicProfile(actor, profileId), target = await ok(readTarget(actor, profileId));
  assert.equal(target === null, visible === null, 'PARITY:' + label);
  return {visible: visible !== null, target: target !== null};
};
report.parity = {};
report.parity.strangerSeesOther = await parity(viewer, targetProfile, 'viewer-sees-person');
report.parity.unknownProfile = await parity(viewer, randomUUID(), 'unknown');
// Self is the one deliberate difference: a person can see their own public profile and is never their own
// safety target.
const ownProfile = await publicProfile(person, targetProfile);
assert.ok(ownProfile && ownProfile.profileId === targetProfile);
assert.equal(await ok(readTarget(person, targetProfile)), null);
report.parity.self = {visible: true, target: false};
// A profile that was never published, and one that was retired, are no targets either.
for (const status of ['DRAFT', 'INACTIVE']) {
  sql(`update public.app_profiles set profile_status=${q(status)} where id=${q(targetProfile)}`);
  report.parity[status.toLowerCase()] = await parity(viewer, targetProfile, status.toLowerCase());
  assert.equal(report.parity[status.toLowerCase()].target, false);
}
sql(`update public.app_profiles set profile_status='ACTIVE' where id=${q(targetProfile)}`);
pass('RESOLVES_ONLY_WHAT_THE_PUBLIC_PROFILE_SHOWS_NEVER_SELF');

// 7. Blocking through the resolved target hides both the profile and the target; unblocking brings the target
//    back with the revision the next block needs.
const setBlock = (blocked, revision) => ok(viewer.client.rpc('rpc_set_account_block',
  {p_target_account_id: person.id, p_blocked: blocked, p_expected_revision: revision, p_client_request_id: randomUUID()}));
const blocked = await setBlock(true, t.revision);
assert.equal(blocked.blocked, true); assert.equal(blocked.revision, 1);
assert.equal(await publicProfile(viewer, targetProfile), null);
assert.equal(await ok(readTarget(viewer, targetProfile)), null);
// The other side learns nothing: an incoming block is never disclosed.
assert.equal((await ok(person.client.rpc('rpc_get_account_block', {p_target_account_id: viewer.id}))).blocked, false);
const mine = await ok(viewer.client.rpc('rpc_list_my_account_blocks', {p_after: null}));
assert.equal(mine.items.filter(x => x.targetAccountId === person.id && x.blocked).length, 1);
const unblocked = await setBlock(false, blocked.revision);
assert.equal(unblocked.blocked, false); assert.equal(unblocked.revision, 2);
const again = await ok(readTarget(viewer, targetProfile));
assert.deepEqual(again, {profileId: targetProfile, accountId: viewer.id, targetAccountId: person.id,
  blocked: false, revision: 2, authoritative: true});
pass('BLOCK_HIDES_PROFILE_AND_TARGET_UNBLOCK_RETURNS_THE_REVISION');

// 8. The report the entry exists for is accepted with the resolved target and stays private to its author.
//    The context is the published Zadatak the two met through, which the report validates on its own.
const needId = randomUUID();
sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
    approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
  values(${q(needId)},${q(person.id)},${q(targetProfile)},'PUBLISHED','PKG-047 safety','Disposable SQL fixture',
    'PROOF','Novi Sad','Liman','OFFERS',2,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
const key = randomUUID();
const submit = () => viewer.client.rpc('rpc_submit_safety_report', {p_target_account_id: again.targetAccountId,
  p_need_id: needId, p_agreement_id: null, p_category: 'HARASSMENT', p_reason: 'Neprimereno obraćanje',
  p_narrative: '', p_client_request_id: key});
const receipt = await ok(submit());
assert.equal(receipt.received, true); assert.equal(receipt.idempotentReplay, false);
assert.deepEqual(await ok(submit()), {...receipt, idempotentReplay: true});
assert.equal((await ok(person.client.rpc('rpc_read_my_safety_report_command', {p_client_request_id: key}))).found, false);
assert.equal(sql(`select count(*) from private.safety_reports where reporter_account_id=${q(viewer.id)} and target_account_id=${q(person.id)}`), '1');
pass('REPORT_THROUGH_THE_RESOLVED_TARGET_ACCEPTED_AND_PRIVATE_TO_ITS_AUTHOR');

// 9. Owner-only: no anonymous caller and no service key may resolve a person from a profile.
await denied(rt.anon.rpc('rpc_read_safety_target', {p_profile_id: targetProfile}));
await denied(rt.service.rpc('rpc_read_safety_target', {p_profile_id: targetProfile}));
assert.equal(sql(`select has_function_privilege('anon',${q(TARGET)},'EXECUTE')::text||has_function_privilege('authenticated',${q(TARGET)},'EXECUTE')::text||has_function_privilege('service_role',${q(TARGET)},'EXECUTE')::text`), 'falsetruefalse');
pass('ANONYMOUS_AND_SERVICE_CALLERS_ARE_REFUSED');

// 10. The reader writes nothing, and the certificate is exactly where it was before the package.
const beforeCounts = counts();
for (let i = 0; i < 5; i++) {await ok(readTarget(viewer, targetProfile)); await ok(readTarget(person, viewerProfile));}
assert.deepEqual(counts(), beforeCounts);
assert.deepEqual(closure(), report.closureBefore);
pass('THE_READER_WRITES_NOTHING_AND_THE_CERTIFICATE_IS_UNMOVED');
report.result = 'PASS'; save();
