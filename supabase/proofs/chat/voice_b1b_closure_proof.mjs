// Chat voice B1-b proof. Disposable local Auth / PostgREST / Postgres / Storage only; no provider, no DEV, no device.
// Requires the replayed admitted chain through the B3c application (workflow stages 01-25) and the B1-a candidate already applied by the B1-a proof.
// This script applies ONLY the B1-b candidate (uncertified afterwards by design), proves the export, support and blocker behaviour, binds the certificate in its
// three places through the disposable recertification file, proves later drift fails closed, and runs two full canonical closures through the ACTUAL closure worker
// source against real Storage. Every check runs even after an earlier one failed, so one CI run reports every broken assertion.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as rt from '../pre_v3/closure_runtime.mjs';
import { invalidationCatalogSnapshot } from './private_invalidation_catalog_snapshot.mjs';
import { m4aFixture } from './voice_m4a_fixture.mjs';
const { assert, sql, rows, q, randomUUID, ok, denied, env, service } = rt;
const candidatePath = 'supabase/candidates/chat_voice_b1b_closure_integration.sql';
const rebindPath = 'supabase/proofs/chat/voice_b1b_recertification_proof.sql';
const harnessPath = 'supabase/proofs/chat/voice_b1b_closure_proof.mjs';
const sources = [candidatePath, rebindPath, harnessPath, 'supabase/candidates/chat_voice_b1a_feature_chain.sql', 'supabase/proofs/chat/voice_m4a_fixture.mjs',
  'supabase/proofs/chat/private_invalidation_catalog_snapshot.mjs', 'supabase/proofs/pkg023/pkg023_surface.sql', 'supabase/proofs/pre_v3/closure_runtime.mjs',
  'supabase/proofs/pre_v3/history_snapshot.mjs', 'supabase/proofs/pre_v3/v5_closure_edge_runtime.mjs', 'supabase/functions/_shared/data-export.ts',
  'supabase/functions/uskoci-account-closure-worker/closure.ts', 'supabase/functions/uskoci-account-closure-worker/index.ts', '.github/workflows/chat-voice-b1-proof.yml'];
const report = rt.report('CHAT_VOICE_B1B_CLOSURE_EXPORT_SUPPORT_AND_RECERTIFICATION');
Object.assign(report, { providerCalls: 0, devAccess: false, devCertificateMoved: false, disposableCertificateMoved: false, certifiedErasureProven: false,
  storageCalls: 0, sourceArtifactHashes: {}, refusals: [], laterDriftChecks: [], closures: [] });
const failures = [];
async function check(name, fn) {
  try { await fn(); rt.pass(report, name); }
  catch (e) { failures.push({ name, message: String(e && e.message || e).slice(0, 900) }); console.error('FAIL ' + name + ': ' + String(e && e.message || e).slice(0, 900)); }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const hashJson = value => sha256(JSON.stringify(value));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACEHOLDER = 'Sadržaj uklonjen pri zatvaranju naloga.';
const LABEL = 'Glasovna poruka (zvuk nije deo prijave).';
const snapshot = () => invalidationCatalogSnapshot(rt);
const closureState = () => rows(`select private.closure_source_digest_v5() live, (select sha256 from private.closure_source_v5 where singleton) certified,
  private.retention_ai_source_ready() ready, private.closure_erasure_binding_v5() binding`)[0];
const storageObjects = account => Number(sql(`select count(*) from storage.objects where bucket_id='agreement-voice' and split_part(name,'/',1)=${q(account)}`));
const blockers = account => JSON.parse(sql(`select coalesce(to_jsonb(private.closure_blockers_v5(${q(account)}::uuid)),'[]')`));
const hardBlockers = account => JSON.parse(sql(`select coalesce(to_jsonb(private.closure_erasure_hard_blockers_v5(${q(account)}::uuid)),'[]')`));

await check('SOURCE_BYTES_EQUAL_THE_TESTED_COMMIT', async () => {
  for (const path of sources) {
    const bytes = readFileSync(path);
    assert.deepEqual(bytes, execFileSync('git', ['show', env.GITHUB_SHA + ':' + path]), 'SOURCE_BYTES_DIFFER:' + path);
    report.sourceArtifactHashes[path] = sha256(bytes);
  }
});

// ----- fixtures (the B1-a upload protocol with real sessions and real Storage objects)
const audio = Buffer.from(m4aFixture({ durationMs: 4200 })), audioSha = sha256(audio), audioMs = 4200;
const claimInput = () => ({ sha256: audioSha, byteSize: audio.length, contentType: 'audio/mp4' });
const stageInput = transfer => ({ attemptId: transfer.attemptId, sha256: audioSha, byteSize: audio.length, durationMs: audioMs });
async function session(actor) {
  const s = (await actor.client.auth.getSession()).data.session; assert.ok(s);
  const claims = JSON.parse(Buffer.from(s.access_token.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, actor.id); assert.ok(claims.session_id); return claims.session_id;
}
const svc = async (actor, operation, key, agreement, input = {}) => ok(service.rpc('rpc_agreement_voice_upload_service_v1',
  { p_account_id: actor.id, p_session_id: await session(actor), p_operation: operation, p_agreement_id: agreement, p_version: 1, p_key: key, p_input: input }));
async function fullUpload(actor, agreement) {
  const key = randomUUID();
  const claimed = await svc(actor, 'CLAIM', key, agreement, claimInput()); assert.equal(claimed.acquired, true);
  const staged = await svc(actor, 'STAGE', key, agreement, stageInput(claimed)); assert.equal(staged.receipt.state, 'STAGED');
  assert.equal((await svc(actor, 'DISPATCH', key, agreement)).acquired, true);
  const uploaded = await service.storage.from('agreement-voice').upload(staged.path, audio, { contentType: 'audio/mp4', upsert: false });
  assert.ifError(uploaded.error); report.storageCalls++;
  const settled = await svc(actor, 'SETTLE', key, agreement, { sha256: audioSha, outcome: 'STORED' });
  assert.equal(settled.receipt.state, 'READY');
  return { key, path: staged.path, assetId: settled.receipt.assetId };
}
const sendVoice = (actor, assetId, agreement) => ok(actor.client.rpc('rpc_send_agreement_voice_message_v1', { p_expected_user_id: actor.id, p_agreement_id: agreement,
  p_expected_version: 1, p_client_message_id: 'voice_' + randomUUID().replaceAll('-', ''), p_asset_id: assetId }));
const sendText = (actor, agreement, body) => ok(actor.client.rpc('rpc_send_agreement_message_v2', { p_expected_user_id: actor.id, p_agreement_id: agreement,
  p_client_message_id: randomUUID(), p_body: body }));
async function agreement(requester, worker) {
  const profile = (person, kind) => { const found = rows(`select id from public.app_profiles where account_id=${q(person.id)} and kind=${q(kind)}`); assert.equal(found.length, 1); return found[0].id; };
  const requesterProfile = profile(requester, 'REQUESTER'), workerProfile = profile(worker, 'WORKER');
  sql(`update public.app_profiles set city='Novi Sad',skills='{"Fizicki poslovi"}' where id=${q(workerProfile)}`);
  await ok(worker.client.rpc('rpc_complete_worker_profile', { p_profile_id: workerProfile }));
  const needId = randomUUID();
  sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
    values(${q(needId)},${q(requester.id)},${q(requesterProfile)},'PUBLISHED','Voice B1b disposable task','Disposable fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FLEXIBLE',
      statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
  const offer = await ok(worker.client.rpc('rpc_submit_response', { p_need_id: needId, p_need_revision: 1, p_worker_profile_id: workerProfile, p_covered_slots: 1,
    p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null, p_client_request_id: randomUUID() }));
  const id = await ok(requester.client.rpc('rpc_select_response', { p_need_id: needId, p_need_revision: offer.needRevision, p_response_id: offer.responseId,
    p_response_version: offer.version, p_content_hash: offer.contentHash, p_client_request_id: randomUUID() }));
  assert.match(id, uuidPattern); return { id, needId, requester, worker };
}

// ----- the before state: B1-a is applied (by the B1-a proof), the B1-b candidate is not
let baseline, expectedFinal, B1A_PRESENT = false;
const legacyBlockerAccount = rows(`select distinct split_part(name,'/',1) account from storage.objects where bucket_id='agreement-voice' limit 1`)[0]?.account ?? null;
await check('PREDECESSOR_IS_B1A_UNCERTIFIED_WITH_THE_B3C_CERTIFICATE', async () => {
  B1A_PRESENT = sql("select (to_regclass('private.agreement_voice_uploads_v1') is not null and to_regprocedure('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)') is not null)::text") === 'true';
  assert.equal(B1A_PRESENT, true);
  assert.equal(sql("select (to_regprocedure('private.agreement_voice_surface_v1()') is null)::text"), 'true');
  assert.equal(sql("select (to_regclass('public.agreement_invalidations_v1') is not null)::text"), 'true');
  const state = closureState();
  assert.equal(state.ready, false); assert.equal(state.binding, null); assert.notEqual(state.live, state.certified);
  baseline = snapshot(); expectedFinal = baseline; report.catalogBeforeSha256 = hashJson(baseline);
  // The B1-a state cannot close an account that owns a voice object: the bucket is foreign to the closure program until B1-b.
  if (legacyBlockerAccount) assert.ok(blockers(legacyBlockerAccount).includes('STORAGE_INVENTORY_UNSUPPORTED'), 'B1A_STATE_MUST_FLAG_THE_VOICE_BUCKET');
});

const candidate = readFileSync(candidatePath, 'utf8');
await check('PREDECESSOR_DRIFT_ROLLS_BACK_THE_WHOLE_CANDIDATE', async () => {
  assert.ok(baseline);
  assert.throws(() => sql(candidate.replace('c6d687219096c03371560cabb961cb0e', '0'.repeat(32))), /VOICE_B1B_PREDECESSOR_DRIFT/);
  assert.equal(hashJson(snapshot()), hashJson(baseline));
  // A renamed roster function (the pin finds no body) must refuse too, and nothing earlier in the file may survive.
  assert.throws(() => sql('begin;\nalter function private.closure_blockers_v5(uuid) rename to closure_blockers_v5_renamed;\n' + candidate.replace(/^begin;/m, '')), /VOICE_B1B_/);
  assert.equal(hashJson(snapshot()), hashJson(baseline));
});
await check('CANDIDATE_APPLIES_ONCE_AND_REFUSES_A_SECOND_APPLICATION', async () => {
  assert.ok(baseline);
  sql(candidate);
  assert.throws(() => sql(candidate), /VOICE_B1B_ALREADY_APPLIED/);
  await pause(1500);
});
await check('INSTALL_LEAVES_THE_CERTIFICATE_UNCERTIFIED_AND_ONLY_THE_REVIEWED_AUTHORITY_CHANGED', async () => {
  const state = closureState();
  assert.notEqual(state.live, null); assert.equal(state.ready, false); assert.equal(state.binding, null);
  assert.equal(state.certified, baseline.state.source.sha256);
  assert.notEqual(state.live, baseline.state.digest);
  for (const role of ['anon', 'authenticated', 'service_role'])
    assert.equal(sql(`select has_function_privilege(${q(role)},'private.agreement_voice_surface_v1()','EXECUTE')::text`), 'false');
  assert.equal(sql("select count(*) from pg_proc where oid in(select to_regprocedure(x) from unnest(array['private.agreement_voice_key_v1(uuid)','private.agreement_voice_context_v1(uuid,uuid,integer,boolean)','private.agreement_voice_document_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_message_guard_v1()','private.agreement_voice_link_guard_v1()','private.agreement_voice_asset_guard_v1()','private.agreement_voice_storage_guard_v1()','public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)','public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)','private.agreement_voice_surface_v1()']) x)"), '12');
  // The action shape check admits exactly the three owned buckets.
  assert.ok(sql("select pg_get_constraintdef(oid) from pg_constraint where conrelid='private.closure_actions_v5'::regclass and conname='closure_action_shape146'").includes("'agreement-voice'"));
  assert.equal(sql("select ((select relations from private.closure_dataset_catalog_v5 where data_class='MEDIA_OBJECTS') @> array['private.agreement_voice_uploads_v1']::text[])::text"), 'true');
  if (legacyBlockerAccount) assert.ok(!blockers(legacyBlockerAccount).includes('STORAGE_INVENTORY_UNSUPPORTED'), 'B1B_MUST_ADMIT_THE_VOICE_BUCKET');
  baseline = snapshot(); expectedFinal = baseline; report.catalogInstalledSha256 = hashJson(baseline);
  assert.equal(baseline.state.ready, false); assert.equal(baseline.state.binding, null);
  assert.notEqual(baseline.state.digest, baseline.state.source.sha256);
});

// ----- fixtures that need the installed candidate: one untouched Agreement for the export and support proofs
let untouched;
await check('FIXTURE_UNTOUCHED_AGREEMENT_WITH_TEXT_AND_VOICE_FROM_BOTH_SIDES', async () => {
  const requester = await rt.actor('voice-b1b-untouched-requester'), worker = await rt.actor('voice-b1b-untouched-worker');
  const item = await agreement(requester, worker);
  const t1 = await sendText(requester, item.id, 'B1b requester text ' + randomUUID());
  const u1 = await fullUpload(requester, item.id), v1 = await sendVoice(requester, u1.assetId, item.id);
  const t2 = await sendText(worker, item.id, 'B1b worker text ' + randomUUID());
  const u2 = await fullUpload(worker, item.id), v2 = await sendVoice(worker, u2.assetId, item.id);
  untouched = { ...item, t1, u1, v1, t2, u2, v2 };
  assert.equal(rows(`select voice_asset_id is not null v from public.agreement_messages where id=${q(v1.messageId)}`)[0].v, true);
});
const untouchedSnapshot = () => rows(`select
  (select md5(coalesce(jsonb_agg(to_jsonb(m) order by id),'[]')::text) from public.agreement_messages m where agreement_id=${q(untouched.id)}) messages,
  (select md5(coalesce(jsonb_agg(to_jsonb(u) - 'attempt_id' order by id),'[]')::text) from private.agreement_voice_uploads_v1 u where agreement_id=${q(untouched.id)}) uploads,
  (select count(*) from storage.objects where bucket_id='agreement-voice' and split_part(name,'/',1) in(${q(untouched.requester.id)},${q(untouched.worker.id)})) objects`)[0];
let untouchedBefore;

await check('EXPORT_CARRIES_OWN_VOICE_METADATA_NEVER_BYTES_AND_THE_CATALOG_MATCHES_THE_SNAPSHOT', async () => {
  assert.ok(untouched); untouchedBefore = untouchedSnapshot();
  const catalog = JSON.parse(sql('select private.data_export_dataset_catalog()::text'));
  assert.equal(catalog.length, 52);
  assert.equal(new Set(catalog.map(entry => entry.key)).size, 52);
  const voiceEntry = catalog.find(entry => entry.key === 'ownAgreementVoice'), messageEntry = catalog.find(entry => entry.key === 'ownAgreementMessages');
  assert.ok(voiceEntry && messageEntry);
  assert.equal(voiceEntry.dataClass, 'MEDIA_OBJECTS'); assert.equal(voiceEntry.ownershipFilter, 't.account_id=REQUEST_ACCOUNT');
  assert.ok(voiceEntry.fields.includes('bytesIncluded')); assert.ok(messageEntry.fields.includes('voiceAssetId'));
  for (const forbidden of ['path', 'storagePath', 'sha256', 'validatedSha256', 'url']) assert.ok(!voiceEntry.fields.includes(forbidden), 'FORBIDDEN_FIELD:' + forbidden);
  const binding = { delivery: { datasets: [{ key: 'ownAgreementVoice', mode: 'INCLUDE', fields: voiceEntry.fields }, { key: 'ownAgreementMessages', mode: 'INCLUDE', fields: messageEntry.fields }] },
    policyId: null, policyVersion: null, privacyDocumentId: null, privacyContentSha256: null, sha256: null };
  const snapshotFor = account => JSON.parse(sql(`select private.data_export_snapshot(${q(account)}::uuid,${q(randomUUID())}::uuid,${q(JSON.stringify(binding))}::jsonb,clock_timestamp())`));
  const mine = snapshotFor(untouched.requester.id);
  assert.equal(mine.projectionVersion, 'OWN_ACCOUNT_V5_9');
  const voiceRows = mine.datasets.ownAgreementVoice;
  assert.equal(voiceRows.length, 1);
  assert.deepEqual(Object.keys(voiceRows[0]).sort(), [...voiceEntry.fields].sort());
  assert.equal(voiceRows[0].id, untouched.u1.assetId); assert.equal(voiceRows[0].messageId, untouched.v1.messageId); assert.equal(voiceRows[0].state, 'READY');
  assert.equal(voiceRows[0].durationMs, audioMs); assert.equal(voiceRows[0].byteSize, audio.length); assert.equal(voiceRows[0].bytesIncluded, false);
  assert.ok(!JSON.stringify(mine).includes(untouched.u1.path), 'THE_STORAGE_PATH_MUST_NOT_BE_EXPORTED');
  assert.ok(!JSON.stringify(mine).includes(untouched.u2.assetId), 'THE_PEER_UPLOAD_MUST_NOT_BE_EXPORTED');
  const messages = mine.datasets.ownAgreementMessages;
  assert.equal(messages.length, 2);
  assert.equal(messages.find(row => row.id === untouched.v1.messageId).voiceAssetId, untouched.u1.assetId);
  assert.equal(messages.find(row => row.id === untouched.t1).voiceAssetId, null);
  assert.ok(!messages.some(row => row.id === untouched.v2.messageId), 'THE_PEER_MESSAGE_MUST_NOT_BE_EXPORTED');
  const peer = snapshotFor(untouched.worker.id); assert.equal(peer.datasets.ownAgreementVoice.length, 1); assert.equal(peer.datasets.ownAgreementVoice[0].id, untouched.u2.assetId);
  // The binding requires the version and the 52 datasets.
  const bindingSource = sql("select prosrc from pg_proc where oid='private.data_export_policy_binding()'::regprocedure");
  assert.ok(bindingSource.includes("'OWN_ACCOUNT_V5_9'") && bindingSource.includes("<>52") && bindingSource.includes("'ownAgreementVoice'"));
  assert.ok(!bindingSource.includes("'OWN_ACCOUNT_V5_8'") && !bindingSource.includes("<>51"));
});

await check('SUPPORT_REFERENCE_OF_A_VOICE_MESSAGE_IS_A_FIXED_LABEL_WITH_NO_AUDIO_AND_TEXT_IS_UNCHANGED', async () => {
  assert.ok(untouched);
  const reference = (account, messageId) => JSON.parse(sql(`select private.support_reference_v5(${q(account)}::uuid,${q(JSON.stringify({ kind: 'AGREEMENT_MESSAGE', id: messageId, revision: 1 }))}::jsonb)::text`));
  const own = reference(untouched.requester.id, untouched.v1.messageId);
  assert.deepEqual(Object.keys(own).sort(), ['content', 'id', 'kind', 'revision']);
  assert.equal(own.content.body, LABEL); assert.equal(own.content.mine, true); assert.equal(own.content.agreementId, untouched.id);
  assert.deepEqual(Object.keys(own.content).sort(), ['agreementId', 'body', 'createdAt', 'mine']);
  assert.ok(!JSON.stringify(own).includes(untouched.u1.path) && !JSON.stringify(own).includes(untouched.u1.assetId), 'NO_AUDIO_IDENTITY_IN_THE_SNAPSHOT');
  const peerView = reference(untouched.worker.id, untouched.v1.messageId);
  assert.equal(peerView.content.body, LABEL); assert.equal(peerView.content.mine, false);
  const text = reference(untouched.requester.id, untouched.t1);
  assert.ok(text.content.body.startsWith('B1b requester text ')); assert.equal(text.content.mine, true);
});

// ----- the disposable three-place recertification
const psql = (input, values = {}) => {
  const params = { voice_b1b_local_target_attested: 'true', voice_b1b_expected_old: baseline.state.source.sha256, voice_b1b_expected_new: baseline.state.digest,
    voice_b1b_expected_readiness_md5: baseline.state.readiness_metadata_md5, ...values };
  const args = [env.RU5_DEVICE_DB_URL, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-v', 'ECHO=none', '-v', 'VERBOSITY=sqlstate'];
  for (const [name, value] of Object.entries(params)) {
    assert.ok(name === 'voice_b1b_local_target_attested' ? value === 'true' : /^[a-f0-9]{32,64}$/.test(value)); args.push('-v', name + '=' + value);
  }
  args.push('-f', '-');
  return execFileSync('psql', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 60000, maxBuffer: 524288, killSignal: 'SIGKILL',
    env: { ...env, PSQL_HISTORY: '/dev/null', PGAPPNAME: 'uskoci-voice-b1b-recert-' + process.pid, PGOPTIONS: '-c statement_timeout=30000 -c lock_timeout=5000' } });
};
function rebind({ mode = 'LOCAL_ONLY_CERTIFIED_ERASURE', tamper = '', values = {} } = {}) {
  const file = resolve(rebindPath).replaceAll('\\', '/'); assert.ok(!/[\r\n']/.test(file));
  const admission = mode === null ? '' : `set local uskoci.voice_b1b_disposable_recertification=${q(mode)};`;
  const out = psql(`begin;\n${admission}\n${tamper}\n\\ir '${file}'\ncommit;\nselect 'VOICE_B1B_DISPOSABLE_RECERTIFIED';\n`, values);
  assert.equal(out.split(/\r?\n/).filter(line => line === 'VOICE_B1B_DISPOSABLE_RECERTIFIED').length, 1);
}
function refuses(name, options) {
  const before = hashJson(snapshot()); let refused = false;
  try { rebind(options); } catch (error) { refused = error?.status !== 0 && /ERROR:\s+55000(?:\s|$)/.test(String(error?.stderr ?? '')); }
  assert.equal(refused, true, 'EXPECTED_REFUSAL:' + name);
  assert.equal(hashJson(snapshot()), before, 'CATALOG_CHANGED_BY_REFUSAL:' + name);
  report.refusals.push({ name, refused: true, completeCatalogUnchanged: true });
}
await check('RECERTIFICATION_ADMISSION_AND_DRIFT_REFUSALS_LEAVE_THE_COMPLETE_CATALOG_UNCHANGED', async () => {
  assert.ok(baseline.state.digest !== baseline.state.source.sha256);
  refuses('MISSING_ADMISSION', { mode: null });
  refuses('UNKNOWN_ADMISSION', { mode: 'UNREVIEWED_MODE' });
  refuses('WRONG_EXPECTED_SOURCE', { values: { voice_b1b_expected_new: '0'.repeat(64) } });
  refuses('CERTIFICATES_DISAGREE', { tamper: "update private.closure_erasure_source_v5 set sha256=repeat('0',64) where singleton;" });
  refuses('UNREVIEWED_TABLE', { tamper: 'create table private.voice_b1b_unreviewed_source(id integer);' });
  refuses('BUCKET_MADE_PUBLIC', { tamper: "update storage.buckets set public=true where id='agreement-voice';" });
  refuses('RESTRICTIVE_POLICY_DROPPED', { tamper: 'drop policy agreement_voice_no_client_v1 on storage.objects;' });
  refuses('VOICE_FUNCTION_AUTHORITY_CHANGED', { tamper: 'alter function private.agreement_voice_message_guard_v1() set search_path = pg_catalog, public;' });
  refuses('READINESS_METADATA_CHANGED', { tamper: 'alter function private.retention_ai_source_ready() cost 4321;' });
});
await check('ONLY_THREE_CERTIFICATE_BINDINGS_CHANGE_AND_READINESS_BECOMES_TRUE', async () => {
  rebind();
  const certified = snapshot(), before = baseline.state, after = certified.state;
  assert.equal(after.digest, before.digest); assert.equal(after.ready, true); assert.equal(after.binding.sourceSha256, before.digest);
  assert.deepEqual(after.source, { ...before.source, sha256: before.digest }); assert.deepEqual(after.erasure, { ...before.erasure, sha256: before.digest });
  assert.equal(after.readiness_definition, before.readiness_definition.replace(before.source.sha256, before.digest));
  for (const key of ['schema_digest', 'erasure_program_digest', 'datasets', 'other_function_metadata', 'table_authority', 'publications', 'publication_tables', 'candidate_present'])
    assert.deepEqual(after[key], before[key]);
  assert.deepEqual(certified.history, baseline.history);
  const otherSurface = value => value.surface.filter(line => !line.startsWith('function:private.retention_ai_source_ready('));
  assert.deepEqual(otherSurface(certified), otherSurface(baseline));
  expectedFinal = certified; report.disposableCertificateMoved = true; report.catalogRecertifiedSha256 = hashJson(certified);
  report.recertification = { sourceBefore: before.source.sha256, sourceAfter: after.digest, placesChanged: 3, ready: true, bindingMatches: true };
});
await check('SECOND_RECERTIFICATION_IS_REFUSED_WITHOUT_CATALOG_CHANGE', async () => { refuses('ALREADY_RECERTIFIED', {}); });
await check('LATER_DRIFT_OF_THE_VOICE_SURFACE_ROSTER_OR_SCHEMA_FAILS_CLOSED', async () => {
  const drifts = [
    ['UNREVIEWED_TABLE', 'create table private.voice_b1b_later_source(id integer)'],
    ['BUCKET_MADE_PUBLIC', "update storage.buckets set public=true where id='agreement-voice'"],
    ['BUCKET_SIZE_CHANGED', "update storage.buckets set file_size_limit=8388608 where id='agreement-voice'"],
    ['RESTRICTIVE_POLICY_DROPPED', 'drop policy agreement_voice_no_client_v1 on storage.objects'],
    ['PERMISSIVE_CLIENT_POLICY_ADDED', "create policy voice_b1b_open on storage.objects for select to authenticated using (bucket_id = 'agreement-voice')"],
    ['VOICE_FUNCTION_AUTHORITY_CHANGED', 'alter function private.agreement_voice_context_v1(uuid,uuid,integer,boolean) set search_path = pg_catalog, public'],
    ['VOICE_FUNCTION_BODY_CHANGED', "create or replace function private.agreement_voice_key_v1(a uuid) returns bigint language sql immutable strict set search_path = pg_catalog as $f$ select hashtextextended('uskoci:agreement-voice:' || a::text, 2);$f$"],
    ['VOICE_GUARD_DISABLED', 'alter table public.agreement_messages disable trigger agreement_voice_message_guard_v1'],
    ['CLOSURE_ROSTER_FUNCTION_CHANGED', 'alter function private.closure_blockers_v5(uuid) set search_path = pg_catalog, public'],
  ];
  for (const [name, change] of drifts) {
    assert.equal(sql(`begin;${change};select private.retention_ai_source_ready()::text||':'||(private.closure_erasure_binding_v5() is null)::text;rollback;`), 'false:true', 'DRIFT_NOT_DETECTED:' + name);
    assert.equal(hashJson(snapshot()), hashJson(expectedFinal), 'DRIFT_LEAKED:' + name);
    report.laterDriftChecks.push({ name, readinessFalse: true, bindingNull: true, rollbackUnchanged: true });
  }
});

// ----- blockers and the decoder
await check('A_DISPATCHING_VOICE_UPLOAD_BLOCKS_THE_CLOSURE_UNTIL_IT_SETTLES', async () => {
  const requester = await rt.actor('voice-b1b-pending-requester'), worker = await rt.actor('voice-b1b-pending-worker');
  const item = await agreement(requester, worker);
  assert.ok(!hardBlockers(requester.id).includes('MEDIA_UPLOAD_PENDING'));
  const key = randomUUID(); const claimed = await svc(requester, 'CLAIM', key, item.id, claimInput());
  await svc(requester, 'STAGE', key, item.id, stageInput(claimed)); await svc(requester, 'DISPATCH', key, item.id);
  assert.ok(blockers(requester.id).includes('MEDIA_UPLOAD_PENDING')); assert.ok(hardBlockers(requester.id).includes('MEDIA_UPLOAD_PENDING'));
  assert.ok(!blockers(worker.id).includes('MEDIA_UPLOAD_PENDING'), 'THE_PEER_IS_NOT_BLOCKED');
  assert.equal((await svc(requester, 'SETTLE', key, item.id, { sha256: audioSha, outcome: 'REJECTED' })).receipt.state, 'FAILED');
  assert.ok(!blockers(requester.id).includes('MEDIA_UPLOAD_PENDING'));
});

const { loadClosureWorker } = await import('../pre_v3/v5_closure_edge_runtime.mjs');
await check('THE_WORKER_DECODER_ADMITS_EXACTLY_THE_VOICE_OBJECT_SHAPE', async () => {
  const { worker } = loadClosureWorker({ env: () => undefined });
  const account = randomUUID(), generation = randomUUID(), id = randomUUID(), sha = 'a'.repeat(64);
  const action = (bucket, objectPath) => ({ accountId: account, requestId: randomUUID(), generation, actionId: randomUUID(), attemptId: randomUUID(), kind: 'STORAGE_DELETE',
    state: 'PENDING', bucket, objectPath, policySha256: 'b'.repeat(64) });
  const good = `${account}/agreement-voice-v1/${id}/${sha}.m4a`;
  assert.equal(worker.decodeAction(action('agreement-voice', good), account, generation).bucket, 'agreement-voice');
  for (const [bucket, objectPath] of [['agreement-voice', `${account}/agreement-v5/${id}/${sha}.jpg`], ['agreement-voice', `${account}/agreement-voice-v1/${id}/${'A'.repeat(64)}.m4a`],
    ['agreement-voice', `${account}/agreement-voice-v1/${id}/${sha}.mp3`], ['agreement-voice', `${account}/agreement-voice-v1/${id}/${sha}.m4a/extra`],
    ['agreement-voice', `${randomUUID()}/agreement-voice-v1/${id}/${sha}.m4a`], ['agreement-voice', `${account}/agreement-voice-v1/../${id}/${sha}.m4a`],
    ['agreement-voice', `${account}/${id}.m4a`], ['other-bucket', good]]) {
    assert.throws(() => worker.decodeAction(action(bucket, objectPath), account, generation), /CLOSURE_RESPONSE_INVALID/, 'MUST_REFUSE:' + bucket + ':' + objectPath);
  }
});

// ----- two full canonical closures through the actual worker source against real Storage
const foreignBefore = () => untouchedSnapshot();
async function closingFixture(role) {
  const requester = await rt.actor(`voice-b1b-close-${role.toLowerCase()}-requester`), worker = await rt.actor(`voice-b1b-close-${role.toLowerCase()}-worker`);
  const subject = role === 'REQUESTER' ? requester : worker, peer = role === 'REQUESTER' ? worker : requester;
  const item = await agreement(requester, worker);
  const canary = 'VOICE_B1B_ERASE_' + randomUUID(), peerBody = 'VOICE_B1B_PEER_' + randomUUID();
  await sendText(subject, item.id, canary);
  const s1 = await fullUpload(subject, item.id), s2 = await fullUpload(subject, item.id), m1 = await sendVoice(subject, s1.assetId, item.id), m2 = await sendVoice(subject, s2.assetId, item.id);
  const unsent = await fullUpload(subject, item.id); // READY with an object, never attached
  const cancelKey = randomUUID(); await svc(subject, 'CLAIM', cancelKey, item.id, claimInput()); await svc(subject, 'CANCEL', cancelKey, item.id); // a row with no object
  const p1 = await fullUpload(peer, item.id), pm = await sendVoice(peer, p1.assetId, item.id); const peerText = await sendText(peer, item.id, peerBody);
  assert.equal(storageObjects(subject.id), 3); assert.equal(storageObjects(peer.id), 1);
  assert.ok(!blockers(subject.id).includes('STORAGE_INVENTORY_UNSUPPORTED'));
  await ok(subject.client.rpc('rpc_cancel_agreement', { p_agreement_id: item.id, p_reason: canary }));
  const need = rows(`select status,revision from public.needs where id=${q(item.needId)}`)[0];
  if (need.status !== 'CANCELLED') await ok(requester.client.rpc('rpc_cancel_need', { p_need_id: item.needId, p_need_revision: need.revision, p_reason: 'Disposable closure fixture' }));
  return { ...item, role, subject, peer, canary, peerBody, m1, m2, pm, peerText, s1, s2, unsent, p1 };
}
async function closeThroughTheWorker(item, runtime) {
  const who = item.subject;
  await ok(who.client.rpc('rpc_prepare_account_closure', { p_expected_user_id: who.id, p_expected_revision: 0, p_client_request_id: randomUUID() }));
  const ready = await ok(who.client.rpc('rpc_review_account_closure_execution', { p_expected_user_id: who.id }));
  assert.equal(ready.ready, true); assert.deepEqual(ready.blockers, []); assert.deepEqual(ready.exceptions, []); assert.equal(ready.adapterVersion, 'OWNER_AF_D22_EVENT_ERASURE_V1');
  const args = { p_expected_user_id: who.id, p_request_id: ready.requestId, p_expected_revision: ready.revision, p_client_request_id: randomUUID(), p_policy_sha256: ready.policySha256 };
  const started = await ok(who.client.rpc('rpc_start_account_closure_execution', args)); assert.equal(started.state, 'EXECUTING');
  assert.equal((await ok(who.client.rpc('rpc_start_account_closure_execution', args))).generation, started.generation);
  const planned = rows(`select bucket,object_path from private.closure_actions_v5 where generation=${q(started.generation)} and kind='STORAGE_DELETE' and bucket='agreement-voice' order by object_path`);
  assert.deepEqual(planned.map(row => row.object_path).sort(), [item.s1.path, item.s2.path, item.unsent.path].sort());
  const total = Number(sql('select cardinality(private.closure_redaction_relations_v5())')); assert.ok(total > 0 && total < 200);
  assert.ok(sql('select private.closure_redaction_relations_v5()::text').includes('private.agreement_voice_uploads_v1'));
  let closed, calls = 0;
  for (; calls < total + 60 && !closed; calls++) {
    const response = await runtime.handler(new Request('http://127.0.0.1/closure', { method: 'POST',
      headers: { apikey: env.RU5_DEVICE_SERVICE_ROLE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ accountId: who.id, generation: started.generation }) }));
    const value = await response.json();
    if (response.status !== 200) throw new Error('CLOSURE_WORKER_STEP_FAILED:' + response.status + ':' + String(value?.code).slice(0, 80) + ':call' + (calls + 1));
    if (value.state === 'CLOSED') closed = value;
  }
  assert.ok(closed); assert.equal(closed.authoritative, true); assert.equal(closed.relationalOutcome, 'ORDINARY_PERSONAL_CONTENT_ERASED'); assert.deepEqual(closed.exceptions, []);
  assert.equal(closed.mediaOutcome, 'OWNED_OBJECTS_DELETED'); assert.equal(closed.authOutcome, 'AUTH_IDENTITY_ERASED_SUBJECT_RETAINED');
  // The subject: every voice object, upload row and voice message is gone or erased.
  assert.equal(storageObjects(who.id), 0);
  assert.equal(sql(`select count(*) from private.agreement_voice_uploads_v1 where account_id=${q(who.id)}`), '0');
  assert.equal(sql(`select count(*) from public.agreement_messages where sender_account_id=${q(who.id)} and voice_asset_id is not null`), '0');
  assert.equal(sql(`select count(*) from public.agreement_messages where body like ${q('%' + item.canary + '%')}`), '0');
  for (const message of [item.m1.messageId, item.m2.messageId])
    assert.deepEqual(rows(`select body,photo_asset_ids,voice_asset_id from public.agreement_messages where id=${q(message)}`), [{ body: PLACEHOLDER, photo_asset_ids: [], voice_asset_id: null }]);
  assert.deepEqual(rows(`select state,affected_rows from private.closure_redaction_steps_v5 where generation=${q(started.generation)} and relation_name='private.agreement_voice_uploads_v1'`), [{ state: 'VERIFIED', affected_rows: 4 }]);
  assert.equal(sql(`select count(*) from private.closure_actions_v5 where generation=${q(started.generation)} and kind='STORAGE_DELETE' and bucket='agreement-voice' and state='VERIFIED' and evidence='STORAGE_OBJECT_ABSENT'`), '3');
  // The peer: the object, the upload row, the voice message and the text survive untouched.
  assert.equal(storageObjects(item.peer.id), 1);
  assert.deepEqual(rows(`select u.state,u.attached_message_id,m.voice_asset_id,m.body from private.agreement_voice_uploads_v1 u join public.agreement_messages m on m.id=u.attached_message_id where u.id=${q(item.p1.assetId)}`),
    [{ state: 'READY', attached_message_id: item.pm.messageId, voice_asset_id: item.p1.assetId, body: '' }]);
  assert.equal(sql(`select body from public.agreement_messages where id=${q(item.peerText)}`), item.peerBody);
  assert.equal(sql(`select deleted_at is not null and raw_user_meta_data='{}'::jsonb and raw_app_meta_data='{}'::jsonb from auth.users where id=${q(who.id)}`), 't');
  assert.equal(sql(`select count(*) from auth.sessions where user_id=${q(who.id)}`), '0');
  assert.deepEqual(untouchedSnapshot(), untouchedBefore);
  assert.equal(hashJson(snapshot()), hashJson(expectedFinal));
  report.closures.push({ role: item.role, result: 'CLOSED', calls, redactionSteps: total, voiceObjectsDeleted: 3, voiceUploadRowsDeleted: 4, ownVoiceMessagesErased: 2,
    peerVoiceObjectRowAndMessagePreserved: true, peerTextPreserved: true, authIdentitySoftErased: true, sessionsRemaining: 0, unrelatedAgreementUnchanged: true });
}
let closing = [];
await check('FIXTURE_TWO_CLOSING_ACCOUNTS_WITH_VOICE_OBJECTS_ROWS_AND_MESSAGES', async () => {
  closing = [await closingFixture('REQUESTER'), await closingFixture('WORKER')];
  assert.equal(closing.length, 2); assert.equal(hashJson(snapshot()), hashJson(expectedFinal));
});
let runtime;
const storageAllowed = new Set();
await check('WORKER_RUNTIME_LOADS_THE_EXACT_CHANGED_SOURCE', async () => {
  for (const item of closing) storageAllowed.add(item.subject.id);
  const allowedRpc = new Set(['rpc_claim_account_closure_action_service', 'rpc_dispatch_account_closure_action_service', 'rpc_redact_account_closure_step_service',
    'rpc_complete_account_closure_action_service', 'rpc_finalize_account_closure_service']);
  runtime = loadClosureWorker({ env: name => ({ USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED: 'true', SUPABASE_URL: env.RU5_DEVICE_SUPABASE_URL, SUPABASE_ANON_KEY: env.RU5_DEVICE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.RU5_DEVICE_SERVICE_ROLE_KEY })[name], fetch: async (url, init) => {
      const parsed = new URL(url); assert.equal(parsed.origin, new URL(env.RU5_DEVICE_SUPABASE_URL).origin); assert.equal(parsed.search, '');
      const name = parsed.pathname.replace('/rest/v1/rpc/', ''), id = parsed.pathname.replace('/auth/v1/admin/users/', '');
      if (parsed.pathname.startsWith('/storage/v1/object/agreement-voice')) {
        assert.ok(['GET', 'DELETE'].includes(init.method));
        const paths = init.method === 'DELETE' ? JSON.parse(init.body).prefixes : [decodeURIComponent(parsed.pathname.slice('/storage/v1/object/agreement-voice/'.length))];
        assert.ok(paths.length === 1 && storageAllowed.has(paths[0].split('/')[0]) && paths[0].split('/')[1] === 'agreement-voice-v1', 'STORAGE_REQUEST_OUTSIDE_THE_CLOSING_ACCOUNTS');
        report.storageCalls++; return fetch(url, init);
      }
      assert.ok((parsed.pathname === '/rest/v1/rpc/' + name && allowedRpc.has(name) && init.method === 'POST')
        || (parsed.pathname === '/auth/v1/admin/users/' + id && storageAllowed.has(id) && ['GET', 'DELETE'].includes(init.method)), 'WORKER_REQUEST_NOT_ADMITTED:' + parsed.pathname);
      return fetch(url, init);
    } });
  for (const [path, value] of Object.entries(runtime.sourceHashes)) assert.equal(value, report.sourceArtifactHashes[path], 'WORKER_SOURCE_HASH_MISMATCH:' + path);
});
for (const role of ['REQUESTER', 'WORKER']) {
  await check(role + '_FULL_CANONICAL_CLOSURE_DELETES_THE_VOICE_OBJECTS_AND_ERASES_OWN_VOICE_MESSAGES_WHILE_THE_PEER_KEEPS_EVERYTHING', async () => {
    const item = closing.find(entry => entry.role === role); assert.ok(item && runtime);
    await closeThroughTheWorker(item, runtime);
  });
}
await check('THE_VOICE_STORAGE_GUARD_REFUSES_ONLY_AN_ACCOUNT_WIDE_HOLD_AND_STAYS_BOUND_TO_THE_CURRENT_CLOSURE', async () => {
  // The guard refuses only an ACCOUNT-WIDE hold (which is also a hard closure blocker); the source says exactly that.
  const source = sql("select prosrc from pg_proc where oid='private.agreement_voice_storage_guard_v1()'::regprocedure");
  assert.ok(source.includes('active and conversation_id is null'));
  assert.ok(source.includes('closure_assert_current_v5'));
});
await check('FINAL_CERTIFIED_CATALOG_AND_MIGRATION_HISTORY_ARE_UNCHANGED_SINCE_THE_RECERTIFICATION', async () => {
  const final = snapshot();
  assert.equal(hashJson(final), hashJson(expectedFinal)); assert.equal(final.state.ready, true);
  report.catalogFinalSha256 = hashJson(final); report.finalReadiness = final.state.ready; report.finalCatalogUnchangedSinceRecertification = true;
  assert.deepEqual(untouchedSnapshot(), untouchedBefore);
  report.certifiedErasureProven = closing.length === 2 && report.closures.length === 2;
  assert.equal(report.certifiedErasureProven, true);
});

report.failures = failures; report.result = failures.length ? 'FAIL' : 'PASS';
writeFileSync(rt.out + '/chat-voice-b1b-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(report.result + ' CHAT_VOICE_B1B_CLOSURE_EXPORT_SUPPORT_AND_RECERTIFICATION (' + report.checks.length + ' passed, ' + failures.length + ' failed)');
if (failures.length) { for (const f of failures) console.error(' - ' + f.name + ': ' + f.message); process.exitCode = 1; }
