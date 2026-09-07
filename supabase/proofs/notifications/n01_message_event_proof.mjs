// Authenticated backend proof, NOT an Android/UI proof or production deployment.
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
// MUST precede every database or Auth/client operation, including candidate apply.
assertLocalDeviceProofTargets(url, dbUrl);
for (const key of ['RU5_DEVICE_ANON_KEY', 'RU5_DEVICE_SERVICE_ROLE_KEY', 'RU5_DEVICE_PASSWORD',
  'RU5_DEVICE_REQUESTER_EMAIL', 'RU5_DEVICE_WORKER_EMAIL']) assert.ok(env[key], `${key} required`);
const uuid = (value) => {
  assert.match(String(value), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'fixture UUID required');
  return value;
};
const requesterId = uuid(env.RU5_DEVICE_REQUESTER_USER_ID);
const workerId = uuid(env.RU5_DEVICE_WORKER_USER_ID);
const needId = uuid(env.RU5_DEVICE_NEED_ID);
assert.notEqual(requesterId, workerId, 'separate Auth accounts required');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const requester = createClient(url, env.RU5_DEVICE_ANON_KEY, options);
const worker = createClient(url, env.RU5_DEVICE_ANON_KEY, options);
const outsider = createClient(url, env.RU5_DEVICE_ANON_KEY, options);
const anonymous = createClient(url, env.RU5_DEVICE_ANON_KEY, options);
// Admin is used ONLY to create a third isolated outsider Auth fixture.
const fixtureAdmin = createClient(url, env.RU5_DEVICE_SERVICE_ROLE_KEY, options);
const out = env.N01_ARTIFACT_DIR || 'artifacts/notifications-n01';
mkdirSync(out, { recursive: true });
const candidatePath = fileURLToPath(new URL('./n01_message_event_candidate.sql', import.meta.url));
const report = { unit: 'N01_MESSAGE_RECEIVED', environment: 'DISPOSABLE_LOOPBACK_ONLY',
  source_sha: env.GITHUB_SHA || null, run_id: env.GITHUB_RUN_ID || null,
  candidate_sha256: createHash('sha256').update(readFileSync(candidatePath)).digest('hex'),
  live_access: false, live_promotion: false, mobile_proof: false,
  command_retry_idempotency_claimed: false, push_provider_called: false, checks: [], messages: [] };
let currentCheck = 'LOCAL_PREFLIGHT';
let agreementId;
let faultInstalled = false;
function check(name) { currentCheck = name; console.log(`START_CHECK ${name}`); }
function passed() { report.checks.push({ name: currentCheck, result: 'PASS' }); console.log(`PASS_CHECK ${currentCheck}`); }
function psql(sql) {
  try {
    return execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch { throw new Error('LOCAL_SQL_FAILED'); } // Never log DB URL, SQL arguments or credentials.
}
const rows = (sql) => JSON.parse(psql(`select coalesce(json_agg(x),'[]'::json) from (${sql}) x;`));
async function ok(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}:REQUEST_REJECTED`);
  return result.data;
}
async function login(client, email, expected) {
  await ok('AUTH_LOGIN', client.auth.signInWithPassword({ email, password: env.RU5_DEVICE_PASSWORD }));
  const user = await ok('AUTH_IDENTITY', client.auth.getUser());
  assert.equal(user.user.id, expected, 'actual JWT identity binding');
}
function counts() {
  return rows(`select
    (select count(*) from public.agreement_messages where agreement_id='${agreementId}')::int as messages,
    (select count(*) from public.user_activity_events where event_type='MESSAGE_RECEIVED' and entity_id='${agreementId}')::int as events,
    (select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id
      where e.event_type='MESSAGE_RECEIVED' and e.entity_id='${agreementId}')::int as deliveries`)[0];
}
async function rejected(label, client, body, expectedMessage, target = agreementId) {
  check(label);
  const before = counts();
  const result = await client.rpc('rpc_send_agreement_message', { p_agreement_id: target, p_body: body });
  assert.ok(result.error, 'invalid command must be rejected');
  if (expectedMessage) assert.ok(result.error.message.includes(expectedMessage), 'expected rejection authority');
  assert.deepEqual(counts(), before, 'rejected command must have zero effects');
  passed();
}
async function preferences(client, userId, role, extra = {}) {
  await ok('OWN_PREFERENCES', client.from('notification_preferences').upsert({
    user_id: userId, role_context: role, in_app_enabled: true, push_enabled: false,
    dogovor_enabled: true, quiet_hours_enabled: false, urgent_overrides_quiet_hours: false,
    quiet_start: null, quiet_end: null, quiet_timezone: 'Europe/Belgrade', ...extra,
  }, { onConflict: 'user_id,role_context' }));
}
async function send(label, sender, recipient, senderId, recipientId, role, inAppReason, pushReason) {
  check(label);
  const body = `  Synthetic private message ${randomUUID()} phone/location-not-for-notification  `;
  const before = counts();
  const id = uuid(await ok('SEND_REAL_MESSAGE', sender.rpc('rpc_send_agreement_message', {
    p_agreement_id: agreementId, p_body: body,
  })));
  const message = await ok('PARTY_MESSAGE_READ', recipient.from('agreement_messages')
    .select('id,agreement_id,agreement_version,sender_account_id,body,read_at').eq('id', id).single());
  assert.equal(message.agreement_id, agreementId);
  assert.equal(message.sender_account_id, senderId);
  assert.ok(message.body === body.trim(), 'existing body trim preserved');
  assert.equal(message.read_at, null, 'no fake read receipt');
  const events = rows(`select * from public.user_activity_events where dedupe_key='agreement_message:${id}'`);
  assert.equal(events.length, 1, 'exactly one durable event');
  const event = events[0];
  assert.equal(event.event_type, 'MESSAGE_RECEIVED');
  assert.equal(event.recipient_user_id, recipientId);
  assert.equal(event.recipient_role, role);
  assert.equal(event.entity_type, 'AGREEMENT');
  assert.equal(event.entity_id, agreementId);
  assert.equal(event.entity_version, message.agreement_version);
  assert.equal(event.urgency, 'NORMAL');
  assert.deepEqual(event.payload, { message_id: id }, 'only message pointer in payload');
  const delivery = rows(`select * from public.notification_deliveries where event_id='${uuid(event.id)}' order by channel`);
  assert.equal(delivery.length, 2, 'existing IN_APP + PUSH delivery model');
  for (const [channel, reason] of [['IN_APP', inAppReason], ['PUSH', pushReason]]) {
    const item = delivery.find((d) => d.channel === channel);
    assert.ok(item, 'expected transport delivery');
    assert.equal(item.recipient_user_id, recipientId);
    assert.equal(item.recipient_role, role);
    assert.equal(item.state, reason ? 'SUPPRESSED' : 'CREATED');
    assert.equal(item.suppression_reason, reason);
    assert.equal(item.priority, 'NORMAL');
    assert.equal(item.title, 'Nova poruka');
    assert.equal(item.body, 'Imate novu poruku u Dogovoru.');
    assert.ok(!JSON.stringify(item).includes(body.trim()), 'private content excluded');
  }
  const visible = await ok('RECIPIENT_EVENT_READ', recipient.from('user_activity_events').select('id').eq('id', event.id));
  assert.equal(visible.length, 1);
  for (const other of [sender, outsider]) {
    const hidden = await ok('NON_RECIPIENT_EVENT_RLS', other.from('user_activity_events').select('id').eq('id', event.id));
    assert.equal(hidden.length, 0, 'counterpart-only durable event');
  }
  const hiddenMessage = await ok('OUTSIDER_MESSAGE_RLS', outsider.from('agreement_messages').select('id').eq('id', id));
  assert.equal(hiddenMessage.length, 0);
  assert.deepEqual(counts(), { messages: before.messages + 1, events: before.events + 1, deliveries: before.deliveries + 2 });
  report.messages.push({ id, event_id: event.id, recipient_role: role,
    in_app: inAppReason || 'CREATED', push: pushReason || 'CREATED' });
  passed();
  return { id, event };
}
try {
  check('EXACT_79_PREDECESSOR_AND_CANDIDATE');
  assert.equal(psql('select count(*) from supabase_migrations.schema_migrations'), '79');
  report.predecessor_message_writer_md5 = psql("select md5(prosrc) from pg_proc where oid='public.rpc_send_agreement_message(uuid,text)'::regprocedure");
  const emitterBefore = psql("select md5(prosrc) from pg_proc where oid='private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'::regprocedure");
  try { execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-f', candidatePath],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch { throw new Error('CANDIDATE_APPLY_FAILED'); }
  assert.equal(psql("select md5(prosrc) from pg_proc where oid='private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)'::regprocedure"), emitterBefore);
  report.emitter_unchanged_md5 = emitterBefore;
  assert.equal(psql('select count(*) from supabase_migrations.schema_migrations'), '79', 'candidate is not promoted migration history');
  passed();

  check('THREE_REAL_AUTH_SESSIONS');
  await login(requester, env.RU5_DEVICE_REQUESTER_EMAIL, requesterId);
  await login(worker, env.RU5_DEVICE_WORKER_EMAIL, workerId);
  const outsiderEmail = `n01-outsider-${randomUUID()}@proof.invalid`;
  const created = await ok('OUTSIDER_AUTH_FIXTURE', fixtureAdmin.auth.admin.createUser({
    email: outsiderEmail, password: env.RU5_DEVICE_PASSWORD, email_confirm: true,
  }));
  const outsiderId = uuid(created.user.id);
  assert.ok(outsiderId !== requesterId && outsiderId !== workerId);
  await login(outsider, outsiderEmail, outsiderId);
  passed();

  check('REAL_APPLICATION_SELECTION_AND_ZERO_RSD');
  const need = await ok('READ_NEED', worker.from('needs').select('id,revision').eq('id', needId).single());
  const profile = await ok('OWN_WORKER_PROFILE', worker.from('app_profiles').select('id')
    .eq('account_id', workerId).eq('kind', 'WORKER').single());
  const submitted = await ok('AUTHENTICATED_APPLICATION', worker.rpc('rpc_submit_response', {
    p_need_id: needId, p_need_revision: need.revision, p_worker_profile_id: profile.id,
    p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: null, p_client_request_id: `n01-submit-${randomUUID()}`,
  }));
  agreementId = uuid(await ok('AUTHENTICATED_SELECTION', requester.rpc('rpc_select_response', {
    p_need_id: needId, p_need_revision: need.revision, p_response_id: submitted.responseId,
    p_response_version: submitted.version, p_content_hash: submitted.contentHash,
    p_client_request_id: `n01-select-${randomUUID()}`,
  })));
  assert.equal(psql(`select count(*) from private.connection_activations where agreement_id='${agreementId}'
    and beneficiary_account_id='${requesterId}' and requester_account_id='${requesterId}'
    and worker_account_id='${workerId}' and activation_reason='SELECTION' and units=1
    and platform_cost_rsd=0 and state='SATISFIED' and policy_key='REQUESTER_SELECTION_V1' and policy_version=1`), '1');
  report.agreement_id = agreementId;
  report.p0d03 = 'REQUESTER_SELECTION_V1/v1/REQUESTER/SELECTION/HEADCOUNT/PROMOTIONAL_FREE/0_RSD';
  passed();

  await ok('DEFAULT_WORKER_PREFS', worker.from('notification_preferences').delete().eq('user_id', workerId).eq('role_context', 'WORKER'));
  const first = await send('REQUESTER_TO_WORKER_DEFAULT_OPT_OUT', requester, worker, requesterId, workerId, 'WORKER', null, 'PUSH_OFF');
  await preferences(requester, requesterId, 'REQUESTER');
  await send('WORKER_TO_REQUESTER_ROLE_BINDING', worker, requester, workerId, requesterId, 'REQUESTER', null, 'PUSH_OFF');
  await preferences(worker, workerId, 'WORKER', { push_enabled: true, dogovor_enabled: false });
  await send('CATEGORY_OFF_DURABLE_EVENT_RETAINED', requester, worker, requesterId, workerId, 'WORKER', 'CATEGORY_OFF', 'CATEGORY_OFF');
  // Equal fixture times exercise the existing all-day quiet-hours branch, not a new user policy.
  await preferences(worker, workerId, 'WORKER', { push_enabled: true, quiet_hours_enabled: true,
    quiet_start: '00:00:00', quiet_end: '00:00:00', urgent_overrides_quiet_hours: true });
  await send('NORMAL_MESSAGE_RESPECTS_QUIET_HOURS', requester, worker, requesterId, workerId, 'WORKER', null, 'QUIET_HOURS');
  await preferences(worker, workerId, 'WORKER', { push_enabled: true });
  await send('EXPLICIT_OPT_IN_QUEUE_CREATED_NOT_DELIVERED', requester, worker, requesterId, workerId, 'WORKER', null, null);
  await preferences(worker, workerId, 'WORKER', { in_app_enabled: false });
  await send('ALL_TRANSPORTS_OFF_EVENT_STILL_DURABLE', requester, worker, requesterId, workerId, 'WORKER', 'IN_APP_OFF', 'PUSH_OFF');

  check('EMITTER_REPLAY_NO_DUPLICATE_DELIVERY');
  const beforeReplay = counts();
  assert.equal(psql(`select private.emit_event('${workerId}','WORKER','MESSAGE_RECEIVED','AGREEMENT',
    '${agreementId}',${Number(first.event.entity_version)},'Nova poruka','Imate novu poruku u Dogovoru.',
    'agreement_message:${first.id}','NORMAL',jsonb_build_object('message_id','${first.id}'::uuid)) is null`), 't');
  assert.deepEqual(counts(), beforeReplay);
  passed();

  await rejected('ANONYMOUS_REJECTED', anonymous, 'synthetic', null);
  await rejected('NON_PARTY_REJECTED', outsider, 'synthetic', 'NOT_PARTY');
  await rejected('MISSING_AGREEMENT_REJECTED', worker, 'synthetic', 'AGREEMENT_NOT_FOUND', randomUUID());
  await rejected('EMPTY_MESSAGE_REJECTED', worker, '   ', 'MESSAGE_REQUIRED');
  await rejected('EXISTING_2000_LIMIT_PRESERVED', worker, 'x'.repeat(2001), 'MESSAGE_TOO_LONG');

  check('AUTHENTICATED_DIRECT_MESSAGE_WRITE_DENIED');
  const beforeDirect = counts();
  const direct = await requester.from('agreement_messages').insert({ agreement_id: agreementId,
    agreement_version: first.event.entity_version, sender_account_id: requesterId, body: 'direct-write-not-allowed' });
  assert.ok(direct.error, 'only existing RPC may write a message');
  assert.deepEqual(counts(), beforeDirect);
  passed();

  check('EMITTER_FAILURE_ROLLS_BACK_MESSAGE');
  psql(`create function private.n01_proof_reject_event() returns trigger language plpgsql set search_path=pg_catalog as $n01$
    begin if NEW.event_type='MESSAGE_RECEIVED' then raise exception 'N01_PROOF_EVENT_REJECTED'; end if; return NEW; end $n01$;
    create trigger n01_proof_event_failure before insert on public.user_activity_events
    for each row execute function private.n01_proof_reject_event();`);
  faultInstalled = true;
  await rejected('EMITTER_FAILURE_ROLLS_BACK_MESSAGE', worker, 'atomic rollback synthetic', 'N01_PROOF_EVENT_REJECTED');
  psql('drop trigger n01_proof_event_failure on public.user_activity_events; drop function private.n01_proof_reject_event();');
  faultInstalled = false;
  await preferences(worker, workerId, 'WORKER');
  await send('WRITER_RECOVERS_AFTER_FAULT_REMOVAL', requester, worker, requesterId, workerId, 'WORKER', null, 'PUSH_OFF');

  check('REAL_CANCEL_RETIRES_PENDING_DELIVERIES');
  await ok('PARTY_CANCEL', requester.rpc('rpc_cancel_agreement', { p_agreement_id: agreementId, p_reason: 'Disposable N01 terminal-state test' }));
  assert.equal(psql(`select status from public.agreements where id='${agreementId}'`), 'CANCELLED');
  assert.equal(psql(`select count(*) from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id
    where e.entity_id='${agreementId}' and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE')`), '0');
  passed();
  await rejected('TERMINAL_CHAT_REJECTED', worker, 'synthetic closed agreement', 'CHAT_NOT_AVAILABLE');

  check('FINAL_SAFETY_AND_DURABLE_COUNTS');
  assert.deepEqual(counts(), { messages: 7, events: 7, deliveries: 14 });
  assert.equal(psql('select count(*) from public.notification_push_attempts'), '0', 'provider dispatch not part of this proof');
  const gates = {
    publication_policy_bundles: 'select count(*) from private.publication_policy_bundles',
    publication_decisions: 'select count(*) from private.need_publication_decisions',
    preselection_questions: 'select count(*) from private.preselection_qa_questions',
    preselection_answers: 'select count(*) from private.preselection_qa_answer_versions',
    preselection_policy: 'select count(*) from private.preselection_qa_policy_decisions',
    preselection_materiality: 'select count(*) from private.preselection_qa_materiality_decisions',
    preselection_commands: 'select count(*) from private.preselection_qa_commands',
    fastest_needs: "select count(*) from public.needs where mode='FASTEST'",
    autofill_selections: "select count(*) from public.need_selections where selection_mode='AUTO_FILL'",
  };
  report.gated_inventory = Object.fromEntries(Object.entries(gates).map(([name, sql]) => [name, Number(psql(sql))]));
  assert.ok(Object.values(report.gated_inventory).every((n) => n === 0), 'all gated inventories stay zero');
  assert.equal(psql('select count(*) from supabase_migrations.schema_migrations'), '79');
  assert.equal(psql("select count(*) from pg_trigger where tgname='n01_proof_event_failure'"), '0');
  report.final_counts = counts();
  report.migration_history_count = 79;
  passed();
  report.result = 'PASS';
  console.log('PASS N01_MESSAGE_EVENT_AUTHENTICATED_PROOF counterpart_rls atomic_durability preferences_privacy zero_rsd disposable_only');
} catch (error) {
  report.result = 'FAIL'; report.failed_check = currentCheck;
  // All explicit proof error messages are fixed labels; credential errors are sanitized by ok/psql.
  report.failure_type = error instanceof assert.AssertionError ? 'ASSERTION' : 'OPERATION';
  console.error(`FAIL N01_MESSAGE_EVENT_AUTHENTICATED_PROOF check=${currentCheck} type=${report.failure_type}`);
  process.exitCode = 1;
} finally {
  if (faultInstalled) {
    try { psql('drop trigger if exists n01_proof_event_failure on public.user_activity_events; drop function if exists private.n01_proof_reject_event();'); }
    catch { report.fault_cleanup = 'FAILED_DISPOSABLE_TEARDOWN_REQUIRED'; process.exitCode = 1; }
  }
  writeFileSync(`${out}/proof-report.json`, `${JSON.stringify(report, null, 2)}\n`);
}
