import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const env = process.env;
const url = env.RU5_DEVICE_SUPABASE_URL;
const dbUrl = env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url, dbUrl);
for (const key of ['RU5_DEVICE_ANON_KEY', 'RU5_DEVICE_SERVICE_ROLE_KEY', 'RU5_DEVICE_PASSWORD',
  'RU5_DEVICE_REQUESTER_EMAIL', 'RU5_DEVICE_WORKER_EMAIL']) assert.ok(env[key], `${key} required`);
const uuid = (value) => {
  assert.match(String(value), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return value;
};
const requesterId = uuid(env.RU5_DEVICE_REQUESTER_USER_ID);
const workerId = uuid(env.RU5_DEVICE_WORKER_USER_ID);
assert.notEqual(requesterId, workerId);
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const requester = createClient(url, env.RU5_DEVICE_ANON_KEY, opts);
const requesterParallel = createClient(url, env.RU5_DEVICE_ANON_KEY, opts);
const worker = createClient(url, env.RU5_DEVICE_ANON_KEY, opts);
const outsider = createClient(url, env.RU5_DEVICE_ANON_KEY, opts);
const anonymous = createClient(url, env.RU5_DEVICE_ANON_KEY, opts);
const fixtureAdmin = createClient(url, env.RU5_DEVICE_SERVICE_ROLE_KEY, opts);
const out = env.N02_ARTIFACT_DIR || 'artifacts/notifications-n02';
mkdirSync(out, { recursive: true });
const candidatePath = fileURLToPath(new URL('./n02_selection_event_candidate.sql', import.meta.url));
const candidate = readFileSync(candidatePath, 'utf8');
const report = { unit: 'N02_RESPONSE_SELECTED', source_sha: env.GITHUB_SHA || null,
  run_id: env.GITHUB_RUN_ID || null, environment: 'DISPOSABLE_LOOPBACK_ONLY',
  candidate_sha256: createHash('sha256').update(candidate).digest('hex'),
  live_access: false, live_promotion: false, push_provider_called: false, mobile_proof: false, checks: [] };
let currentCheck = 'PREFLIGHT';
let faultInstalled = false;
const selectProc = 'public.rpc_select_response(uuid,integer,uuid,integer,text,text)';
const emitterProc = 'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)';
const check = (name) => { currentCheck = name; console.log(`START_CHECK ${name}`); };
const passed = () => { report.checks.push({ name: currentCheck, result: 'PASS' }); console.log(`PASS_CHECK ${currentCheck}`); };
function psql(sql) {
  try { return execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { throw new Error('LOCAL_SQL_FAILED'); }
}
const rows = (sql) => JSON.parse(psql(`select coalesce(json_agg(x),'[]'::json) from (${sql}) x;`));
async function ok(promise) {
  const r = await promise;
  if (r.error) throw new Error('AUTHENTICATED_REQUEST_FAILED');
  return r.data;
}
async function login(client, email, id) {
  await ok(client.auth.signInWithPassword({ email, password: env.RU5_DEVICE_PASSWORD }));
  assert.equal((await ok(client.auth.getUser())).user.id, id);
}
function counts() {
  return rows(`select (select count(*) from public.need_selections)::int selections,
    (select count(*) from public.agreements)::int agreements,
    (select count(*) from public.agreement_versions)::int versions,
    (select count(*) from public.agreement_execution)::int executions,
    (select count(*) from private.connection_activations)::int activations,
    (select count(*) from private.selection_commands)::int commands,
    (select count(*) from public.user_activity_events)::int events,
    (select count(*) from public.notification_deliveries)::int deliveries`)[0];
}
function states(p) {
  return rows(`select (select status from public.needs where id='${uuid(p.p_need_id)}') need_status,
    (select status from public.marketplace_responses where id='${uuid(p.p_response_id)}') response_status`)[0];
}
async function rejected(client, params, message) {
  const before = counts();
  const beforeStates = states(params);
  const result = await client.rpc('rpc_select_response', params);
  assert.ok(result.error, 'must reject');
  if (message) assert.ok(result.error.message.includes(message), 'expected authority error');
  assert.deepEqual(counts(), before);
  assert.deepEqual(states(params), beforeStates);
}
let requesterProfileId;
let workerProfileId;
async function fixture() {
  const id = randomUUID();
  // Only an admitted Need is seeded. Applications and Selections always use Auth RPCs.
  psql(`begin; select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,mode,required_slots,response_deadline,published_at)
    values ('${id}','${requesterId}','${requesterProfileId}','PUBLISHED','N02 synthetic task',
      'Private synthetic task must not enter notification','PROOF','Novi Sad','OFFERS',1,
      statement_timestamp()+interval '2 days',statement_timestamp()); commit;`);
  const need = await ok(worker.from('needs').select('revision').eq('id', id).single());
  const response = await ok(worker.rpc('rpc_submit_response', { p_need_id: id, p_need_revision: need.revision,
    p_worker_profile_id: workerProfileId, p_covered_slots: 1, p_price_rsd: 3000,
    p_proposed_start_at: null, p_proposed_end_at: null, p_scope_note: null,
    p_client_request_id: `n02-submit-${randomUUID()}` }));
  return { p_need_id: id, p_need_revision: need.revision, p_response_id: uuid(response.responseId),
    p_response_version: response.version, p_content_hash: response.contentHash,
    p_client_request_id: `n02-select-${randomUUID()}` };
}
async function preferences(extra = {}) {
  await ok(worker.from('notification_preferences').upsert({ user_id: workerId, role_context: 'WORKER',
    in_app_enabled: true, push_enabled: false, responses_enabled: true, dogovor_enabled: true,
    quiet_hours_enabled: false, quiet_start: null, quiet_end: null, quiet_timezone: 'Europe/Belgrade',
    urgent_overrides_quiet_hours: false, ...extra }, { onConflict: 'user_id,role_context' }));
}
function assertEvent(params, agreementId, inAppReason, pushReason) {
  const events = rows(`select * from public.user_activity_events where event_type='RESPONSE_SELECTED'
    and entity_id='${params.p_response_id}'`);
  assert.equal(events.length, 1);
  const e = events[0];
  assert.equal(e.recipient_user_id, workerId);
  assert.equal(e.recipient_role, 'WORKER');
  assert.equal(e.entity_type, 'RESPONSE');
  assert.equal(e.entity_version, params.p_response_version);
  assert.equal(e.urgency, 'NORMAL');
  assert.deepEqual(e.payload, { agreement_id: agreementId, need_id: params.p_need_id });
  const a = rows(`select * from public.agreements where id='${uuid(agreementId)}'`)[0];
  assert.equal(a.need_id, params.p_need_id);
  assert.equal(a.selected_response_id, params.p_response_id);
  assert.equal(a.worker_account_id, workerId);
  assert.equal(a.requester_account_id, requesterId);
  assert.equal(e.dedupe_key, `response_selected:${a.selection_id}`);
  assert.equal(psql(`select count(*) from private.connection_activations where agreement_id='${agreementId}'
    and beneficiary_account_id='${requesterId}' and worker_account_id='${workerId}'
    and platform_cost_rsd=0 and policy_key='REQUESTER_SELECTION_V1' and policy_version=1
    and activation_reason='SELECTION' and units=1 and state='SATISFIED'`), '1');
  const deliveries = rows(`select * from public.notification_deliveries where event_id='${uuid(e.id)}'`);
  assert.equal(deliveries.length, 2);
  for (const [channel, reason] of [['IN_APP', inAppReason], ['PUSH', pushReason]]) {
    const d = deliveries.find((item) => item.channel === channel);
    assert.ok(d);
    assert.equal(d.recipient_user_id, workerId);
    assert.equal(d.recipient_role, 'WORKER');
    assert.equal(d.state, reason ? 'SUPPRESSED' : 'CREATED');
    assert.equal(d.suppression_reason, reason);
    assert.equal(d.priority, 'NORMAL');
    assert.equal(d.title, 'Vaša prijava je izabrana');
    assert.equal(d.body, 'Otvorite Dogovor za detalje zadatka.');
    assert.equal(d.read_at, null);
  }
  return e;
}
try {
  check('REAL_AUTH_SESSIONS');
  await login(requester, env.RU5_DEVICE_REQUESTER_EMAIL, requesterId);
  await login(requesterParallel, env.RU5_DEVICE_REQUESTER_EMAIL, requesterId);
  await login(worker, env.RU5_DEVICE_WORKER_EMAIL, workerId);
  const outsiderEmail = `n02-${randomUUID()}@proof.invalid`;
  const user = await ok(fixtureAdmin.auth.admin.createUser({ email: outsiderEmail,
    password: env.RU5_DEVICE_PASSWORD, email_confirm: true }));
  await login(outsider, outsiderEmail, uuid(user.user.id));
  requesterProfileId = uuid((await ok(requester.from('app_profiles').select('id').eq('kind','REQUESTER')
    .eq('account_id',requesterId).single())).id);
  workerProfileId = uuid((await ok(worker.from('app_profiles').select('id').eq('kind','WORKER')
    .eq('account_id',workerId).single())).id);
  passed();

  check('EXACT_PREDECESSOR_AND_NO_HISTORICAL_BACKFILL');
  const historical = await fixture();
  const historicalId = uuid(await ok(requester.rpc('rpc_select_response', historical)));
  const beforeApply = counts();
  const beforeBody = psql(`select prosrc from pg_proc where oid='${selectProc}'::regprocedure`);
  assert.equal(psql(`select md5(prosrc) from pg_proc where oid='${selectProc}'::regprocedure`), '867b280d4131188db3906c1ced7f4c11');
  const security = psql(`select row(prosecdef,proconfig,proacl)::text from pg_proc where oid='${selectProc}'::regprocedure`);
  const emitterMd5 = psql(`select md5(prosrc) from pg_proc where oid='${emitterProc}'::regprocedure`);
  execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-f', candidatePath], { stdio: 'pipe' });
  const afterBody = psql(`select prosrc from pg_proc where oid='${selectProc}'::regprocedure`);
  assert.equal(afterBody.replace(candidate.split('$n02_event$')[1], ''), beforeBody);
  assert.equal(psql(`select row(prosecdef,proconfig,proacl)::text from pg_proc where oid='${selectProc}'::regprocedure`), security);
  assert.equal(psql(`select md5(prosrc) from pg_proc where oid='${emitterProc}'::regprocedure`), emitterMd5);
  report.emitter_unchanged_md5 = emitterMd5;
  assert.deepEqual(counts(), beforeApply);
  assert.equal(await ok(requester.rpc('rpc_select_response', historical)), historicalId);
  assert.deepEqual(counts(), beforeApply);
  assert.equal(psql('select count(*) from supabase_migrations.schema_migrations'), '79');
  passed();

  const p = await fixture();
  check('WRONG_ACTOR_AND_STALE_NO_EFFECT');
  await rejected(anonymous, p);
  await rejected(worker, p, 'NOT_REQUESTER');
  await rejected(outsider, p, 'NOT_REQUESTER');
  await rejected(requester, { ...p, p_need_revision: p.p_need_revision + 1 }, 'STALE_REVIEW_REQUIRED');
  await rejected(requester, { ...p, p_content_hash: '0'.repeat(64) }, 'STALE_REVIEW_REQUIRED');
  passed();

  check('EMITTER_FAILURE_ATOMIC_ROLLBACK');
  psql(`create function private.n02_reject_event() returns trigger language plpgsql set search_path=pg_catalog
    as $fault$ begin if NEW.event_type='RESPONSE_SELECTED' then raise exception 'N02_EVENT_FAILURE'; end if;
    return NEW; end $fault$;
    create trigger n02_event_failure before insert on public.user_activity_events
    for each row execute function private.n02_reject_event();`);
  faultInstalled = true;
  await rejected(requester, p, 'N02_EVENT_FAILURE');
  psql('drop trigger n02_event_failure on public.user_activity_events; drop function private.n02_reject_event();');
  faultInstalled = false;
  passed();

  check('CONCURRENT_SAME_COMMAND_ONE_EVENT');
  await ok(worker.from('notification_preferences').delete().eq('user_id',workerId).eq('role_context','WORKER'));
  const beforeSelection = counts();
  const results = await Promise.all([requester.rpc('rpc_select_response',p), requesterParallel.rpc('rpc_select_response',p)]);
  assert.ok(results.every((r) => !r.error));
  const agreementId = uuid(results[0].data);
  assert.equal(results[1].data, agreementId);
  const first = assertEvent(p, agreementId, null, 'PUSH_OFF');
  assert.deepEqual(counts(), Object.fromEntries(Object.entries(beforeSelection).map(([key,value]) =>
    [key, value + (key === 'deliveries' ? 2 : 1)])));
  const afterSelection = counts();
  assert.equal(await ok(requester.rpc('rpc_select_response',p)), agreementId);
  assert.deepEqual(counts(), afterSelection);
  await rejected(requester, { ...p, p_content_hash: 'f'.repeat(64) }, 'IDEMPOTENCY_KEY_REUSED');
  await rejected(requester, { ...p, p_client_request_id: `n02-other-${randomUUID()}` }, 'NEED_NOT_OPEN');
  passed();

  check('RECIPIENT_RLS_AND_DIRECT_WRITE_DENIED');
  assert.equal((await ok(worker.from('user_activity_events').select('id').eq('id',first.id))).length,1);
  for (const client of [requester, outsider]) {
    assert.equal((await ok(client.from('user_activity_events').select('id').eq('id',first.id))).length,0);
    assert.equal((await ok(client.from('notification_deliveries').select('id').eq('event_id',first.id))).length,0);
  }
  const beforeDirect = counts();
  const directEvent = await worker.from('user_activity_events').insert({ recipient_user_id:workerId,
    recipient_role:'WORKER',event_type:'RESPONSE_SELECTED',entity_type:'RESPONSE',entity_id:p.p_response_id,
    dedupe_key:`forbidden:${randomUUID()}` });
  assert.ok(directEvent.error);
  assert.ok((await worker.from('notification_deliveries').update({state:'READ'}).eq('event_id',first.id)).error);
  assert.deepEqual(counts(),beforeDirect);
  passed();

  check('EMITTER_REPLAY_NO_DUPLICATE_DELIVERY');
  const replayBefore = counts();
  assert.equal(psql(`select private.emit_event('${workerId}','WORKER','RESPONSE_SELECTED','RESPONSE',
    '${p.p_response_id}',${p.p_response_version},'Replay','Replay','${first.dedupe_key}',
    'NORMAL',jsonb_build_object('agreement_id','${agreementId}'::uuid,'need_id','${p.p_need_id}'::uuid)) is null`),'t');
  assert.deepEqual(counts(),replayBefore);
  passed();

  for (const [name, prefs, inApp, push] of [
    ['CATEGORY_OFF_EVENT_RETAINED', { push_enabled:true, responses_enabled:false }, 'CATEGORY_OFF','CATEGORY_OFF'],
    ['QUIET_HOURS_RESPECTED', { push_enabled:true, quiet_hours_enabled:true, quiet_start:'00:00:00',
      quiet_end:'00:00:00', urgent_overrides_quiet_hours:true }, null,'QUIET_HOURS'],
    ['OPT_IN_CREATES_QUEUE_NOT_PROVIDER_DELIVERY', { push_enabled:true }, null,null],
    ['ALL_CHANNELS_OFF_EVENT_RETAINED', { in_app_enabled:false }, 'IN_APP_OFF','PUSH_OFF'],
  ]) {
    check(name);
    await preferences(prefs);
    const params = await fixture();
    const id = uuid(await ok(requester.rpc('rpc_select_response',params)));
    assertEvent(params,id,inApp,push);
    passed();
  }

  check('FINAL_INVARIANTS');
  assert.equal(psql("select count(*) from public.user_activity_events where event_type='RESPONSE_SELECTED'"),'5');
  assert.equal(psql('select count(*) from public.notification_push_attempts'),'0');
  for (const table of ['publication_policy_bundles','need_publication_decisions','preselection_qa_questions',
    'preselection_qa_answer_versions','preselection_qa_policy_decisions','preselection_qa_materiality_decisions',
    'preselection_qa_commands']) assert.equal(psql(`select count(*) from private.${table}`),'0');
  assert.equal(psql("select count(*) from public.needs where mode='FASTEST'"),'0');
  assert.equal(psql("select count(*) from public.need_selections where selection_mode='AUTO_FILL'"),'0');
  assert.equal(psql('select count(*) from supabase_migrations.schema_migrations'),'79');
  assert.equal(psql("select count(*) from pg_trigger where tgname='n02_event_failure'"),'0');
  report.migration_history_count = 79;
  report.final_counts = counts();
  report.p0d03 = 'REQUESTER_SELECTION_V1/v1/REQUESTER/SELECTION/HEADCOUNT/PROMOTIONAL_FREE/0_RSD';
  passed();
  report.result = 'PASS';
  console.log('PASS N02_SELECTION_EVENT_AUTHENTICATED_PROOF');
} catch (error) {
  report.result = 'FAIL'; report.failed_check = currentCheck;
  report.failure_type = error instanceof assert.AssertionError ? 'ASSERTION' : 'OPERATION';
  console.error(`FAIL N02_SELECTION_EVENT_AUTHENTICATED_PROOF check=${currentCheck} type=${report.failure_type}`);
  process.exitCode = 1;
} finally {
  if (faultInstalled) {
    try { psql('drop trigger if exists n02_event_failure on public.user_activity_events; drop function if exists private.n02_reject_event();'); }
    catch { report.fault_cleanup = 'DISPOSABLE_TEARDOWN_REQUIRED'; process.exitCode = 1; }
  }
  writeFileSync(`${out}/proof-report.json`, `${JSON.stringify(report,null,2)}\n`);
}
