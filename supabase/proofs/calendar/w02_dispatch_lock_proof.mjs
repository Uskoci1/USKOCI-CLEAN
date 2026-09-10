// Focused W02 regression. Real disposable Auth + PostgreSQL; no provider or live access.
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';

const forward = 'supabase/migrations/20260910214845_clean_dispatch_need_lock_order.sql';
const signature = 'private.dispatch_tick(integer,timestamptz)';
const oldBody = '6bbd8765aa833b3c27209c82da99e5e4';
const newBody = 'd3ef4a0b0b63bcfaffd84547a2ad863b';
const expirySignature = 'private.expire_lifecycle(timestamptz)';
const oldExpiryBody = 'fa0ae36b9d1c63ebe4b8f9a7c3b1e26d';
const newExpiryBody = 'c9e69fe79781da56eb7bb3853e75c798';
const hash = value => createHash('sha256').update(value).digest('hex');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const uuid = value => { assert.match(value ?? '', /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i); return value; };
const sleep = ms => new Promise(done => setTimeout(done, ms));
const proofFile = 'supabase/proofs/calendar/w02_dispatch_lock_proof.mjs';
const manifestFile = 'supabase/proofs/calendar/w02_dispatch_lock_files.json';
export const dispatchLockChecks = Object.freeze([
  'EXACT_SOURCE105_REAL_AUTH_AND_QUEUE_OWNER_PREFLIGHT',
  'ORIGINAL_QUEUE_THEN_NEED_DEADLOCK_WITH_REAL_OWNER_SELECTION',
  'ORIGINAL_DUE_DELIVERY_THEN_ROUND_DEADLOCK_WITH_REAL_OWNER_CANCEL',
  'EXACT_FORWARD_ONLY_TWO_NAMED_BODIES_ALL_HISTORY_METADATA_AND_ROWS_PRESERVED',
  'HELD_NEED_IS_SKIPPED_REAL_SELECTION_SUCCEEDS_WITH_SAME_REQUEST_KEY',
  'BATCH_ONE_SKIPS_HELD_QUEUE_REACHES_NEXT_AND_RELEASES_SKIPPED_NEED',
  'CURRENT_TICK_NEED_LOCK_SERIALIZES_REAL_SELECTION_WITHOUT_DEADLOCK',
  'HELD_NEED_SKIPS_DUE_CHILDREN_THEN_REAL_CANCELLATION_SUCCEEDS',
  'CURRENT_EXPIRY_PARENT_LOCK_SERIALIZES_CANCELLATION_WITHOUT_DEADLOCK',
  'EXACT_CANCELLED_FIXTURE_EVENT_CLEANUP_PRESERVES_CALENDAR_BASELINE',
]);
export const dispatchLockCases = Object.freeze(['OLD_QUEUE_NEED_CYCLE', 'OLD_DELIVERY_ROUND_CYCLE',
  'NEED_HELD_TICK_SKIPS', 'QUEUE_HELD_TICK_SKIPS', 'CURRENT_TICK_THEN_SELECTION',
  'NEED_HELD_EXPIRY_SKIPS', 'CURRENT_EXPIRY_THEN_CANCELLATION']);

export function admitDispatchLockReport(report, sourceSha, {root = process.cwd()} = {}) {
  assert.match(sourceSha ?? '', /^[0-9a-f]{40}$/);
  assert.equal(report?.source_sha, sourceSha); assert.equal(report.result, 'PASS');
  assert.equal(report.unit, 'W02_DISPATCH_NEED_LOCK_ORDER');
  assert.equal(report.source_migration_count, 108); assert.equal(report.registry_history_count, 105);
  assert.equal(report.applied_authority, 'REGISTRY105_PLUS_UNRECORDED_DISPATCH108');
  assert.equal(report.actual_postgres_major, 17);
  assert.deepEqual(report.observed_predecessor_body_md5, {[signature]:oldBody,[expirySignature]:oldExpiryBody});
  for (const name of ['candidate_applied','actual_auth','original_selection_rolled_back','original_cancellation_rolled_back',
    'original_history_preserved','all_function_metadata_preserved_except_two_named_bodies','all_existing_rows_preserved_at_apply',
    'same_request_key_selected_once','actual_owner_cancellation_preserved','no_fixture_blocking_calendar_events',
    'registry_history_unchanged','due_child_predicates_preserved']) assert.equal(report[name], true, name);
  for (const name of ['live_access','live_promotion','provider_called','mocked_database','mocked_rpc_responses','mobile_proof','scheduler_disabled']) assert.equal(report[name], false, name);
  assert.deepEqual(report.checks?.map(item => item.name), dispatchLockChecks);
  for (const item of report.checks) assert.equal(item.result, 'PASS');
  assert.deepEqual(report.lock_interleavings?.map(item => item.case), dispatchLockCases);
  const processId = value => assert.ok(Number.isInteger(value) && value > 0);
  const observed = lock => { processId(lock.waiter_pid); processId(lock.holder_pid); assert.notEqual(lock.waiter_pid, lock.holder_pid); assert.equal(lock.wait_event_type, 'Lock'); assert.equal(lock.blocked_by_holder, true); };
  for (const entry of report.lock_interleavings.slice(0, 2)) {
    assert.equal(entry.sqlstate, '40P01'); assert.equal(entry.edges?.length, 2);
    const [a,b] = entry.edges;
    for (const edge of entry.edges) { processId(edge.waiter_pid); processId(edge.holder_pid); processId(edge.transaction_id); assert.match(edge.mode, /^[A-Za-z]+Lock$/); }
    assert.equal(a.waiter_pid,b.holder_pid); assert.equal(b.waiter_pid,a.holder_pid); assert.notEqual(a.waiter_pid,a.holder_pid);
    const waits = entry.case === 'OLD_QUEUE_NEED_CYCLE' ? [entry.waiting_tick,entry.waiting_owner] : [entry.waiting_expiry,entry.waiting_cancel];
    for (const waiting of waits) { observed(waiting); assert.ok(entry.edges.some(edge => edge.waiter_pid === waiting.waiter_pid && edge.holder_pid === waiting.holder_pid)); }
  }
  const [,,need,queue,current,expiry,currentExpiry] = report.lock_interleavings;
  processId(need.owner_pid); assert.equal(need.target_queue_unchanged,true); assert.equal(need.actual_selection_succeeded,true);
  processId(queue.owner_pid); assert.equal(queue.batch,1);
  for (const key of ['target_queue_unchanged','next_free_target_processed','skipped_need_lock_released']) assert.equal(queue[key],true);
  observed(current); assert.equal(current.actual_selection_succeeded,true);
  processId(expiry.owner_pid); assert.equal(expiry.due_children_unchanged,true); assert.equal(expiry.actual_cancellation_succeeded,true);
  observed(currentExpiry); assert.equal(currentExpiry.actual_cancellation_succeeded,true); assert.equal(currentExpiry.due_children_expired_before_rollback,true);
  assert.equal(report.fixture_event_cleanup?.removed_count,2); assert.equal(report.fixture_event_cleanup.calendar_baseline_empty,true);
  const cleanup = report.fixture_event_cleanup.released_event_ids;
  assert.equal(cleanup?.length,2); assert.equal(new Set(cleanup).size,2); cleanup.forEach(uuid);
  const bytes = readFileSync(resolve(root,forward));
  const manifest = JSON.parse(readFileSync(resolve(root,manifestFile),'utf8'));
  assert.equal(manifest.unit,report.unit); assert.equal(manifest.expected_registered_history_count,105);
  assert.equal(manifest.admitted_source_count,108); assert.equal(manifest.applied_authority,report.applied_authority);
  assert.equal(manifest.forward_file,forward); assert.equal(manifest.bytes,bytes.length); assert.equal(manifest.sha256,hash(bytes));
  assert.equal(manifest.md5,createHash('md5').update(bytes).digest('hex'));
  assert.deepEqual(manifest.changed_bodies,[{signature,predecessor_md5:oldBody,current_md5:newBody},
    {signature:expirySignature,predecessor_md5:oldExpiryBody,current_md5:newExpiryBody}]);
  assert.deepEqual(report.candidate,manifest);
  assert.deepEqual(Object.keys(report.input_sha256).sort(),[forward,proofFile,manifestFile].sort());
  for (const file of Object.keys(report.input_sha256)) assert.equal(report.input_sha256[file],hash(readFileSync(resolve(root,file))),file);
  return {unit:report.unit,source_sha:sourceSha,registry_history_count:105,applied_authority:report.applied_authority,
    changed_bodies:manifest.changed_bodies,checks:10,lock_interleavings:7};
}

export function observedDeadlock(stderr, firstPid, secondPid) {
  assert.ok(Number.isInteger(firstPid) && firstPid > 0 && Number.isInteger(secondPid) && secondPid > 0 && firstPid !== secondPid);
  assert.match(stderr, /ERROR:\s+40P01:/);
  const edges = [...stderr.matchAll(/Process (\d+) waits for ([A-Za-z]+Lock) on transaction (\d+); blocked by process (\d+)/g)]
    .map(match => ({waiter_pid: Number(match[1]), mode: match[2], transaction_id: Number(match[3]), holder_pid: Number(match[4])}));
  assert.equal(edges.length, 2, 'Exact two-process deadlock DETAIL required');
  assert.ok(edges.some(edge => edge.waiter_pid === firstPid && edge.holder_pid === secondPid));
  assert.ok(edges.some(edge => edge.waiter_pid === secondPid && edge.holder_pid === firstPid));
  return {sqlstate: '40P01', edges};
}

export async function main(env = process.env) {
  assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
  const db = env.RU5_DEVICE_DB_URL;
  const directory = env.W02_DISPATCH_ARTIFACT_DIR ?? 'artifacts/w02-calendar/dispatch-lock';
  mkdirSync(directory, {recursive: true});
  const bytes = readFileSync(forward);
  const manifest = JSON.parse(readFileSync('supabase/proofs/calendar/w02_dispatch_lock_files.json', 'utf8'));
  assert.equal(manifest.forward_file, forward);
  assert.equal(manifest.sha256, hash(bytes));
  assert.equal(manifest.bytes, bytes.length);
  const report = {unit: 'W02_DISPATCH_NEED_LOCK_ORDER', source_sha: env.GITHUB_SHA ?? null,
    run_id: env.GITHUB_RUN_ID ?? null, candidate: manifest, checks: [], lock_interleavings: [],
    source_migration_count: readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).length,
    registry_history_count: 105, applied_authority: 'REGISTRY105_PLUS_UNRECORDED_DISPATCH108',
    candidate_applied: false, live_access: false, live_promotion: false, provider_called: false,
    mocked_database: false, mocked_rpc_responses: false, actual_auth: false, mobile_proof: false,
    fixture_sql_used: true, fixture_clock_simulated: true, scheduler_disabled: false,
    input_sha256: {[forward]: hash(bytes)}};
  const children = new Set();
  let stage = 'PREFLIGHT';
  const check = name => { stage = name; console.log('START_CHECK ' + name); };
  const pass = () => { report.checks.push({name: stage, result: 'PASS'}); console.log('PASS_CHECK ' + stage); };
  function sql(statement) {
    try {
      return execFileSync('psql', [db, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'],
        {input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, maxBuffer: 32 * 1024 * 1024}).trim();
    } catch (error) {
      report.failed_sql = {sqlstate: String(error.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? 'UNAVAILABLE', query_sha256: hash(statement)};
      throw new Error('DISPOSABLE_SQL_FAILED');
    }
  }
  async function ok(name, promise) {
    const result = await promise;
    if (result.error) report.rpc_failure = {rpc: name, code: /^[A-Z0-9]{5}$/.test(result.error.code ?? '') ? result.error.code : 'OTHER'};
    assert.equal(result.error, null, 'REAL_RPC_REFUSED:' + name);
    return result.data;
  }
  async function until(predicate, reason) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) { if (predicate()) return; await sleep(40); }
    throw new Error(reason);
  }
  function transaction(name, body, deadlockMs = 10000) {
    assert.match(name, /^w02-dispatch-[a-z-]+$/);
    const child = spawn('psql', [db, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'], {stdio: ['pipe', 'pipe', 'pipe']});
    children.add(child);
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('error', () => { stderr += 'OWNED_PSQL_PROCESS_ERROR'; });
    const done = new Promise(done => child.on('close', code => { children.delete(child); done({code, stdout, stderr}); }));
    child.ownedDone = done;
    child.stdin.write(`begin;set local application_name=${q(name)};set local statement_timeout='25s';set local deadlock_timeout=${q(deadlockMs + 'ms')};${body}\n`);
    return {child, done, output: () => stdout, send: value => child.stdin.write(value + '\n'), finish: value => child.stdin.end(value + '\n')};
  }
  function actorPassed(result, name) {
    if (result.code !== 0) report.failed_actor = {name,
      sqlstate: result.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] ?? 'UNAVAILABLE'};
    assert.equal(result.code, 0, 'OWNED_ACTOR_FAILED:' + name);
  }
  const pidOf = name => Number(sql(`select pid from pg_stat_activity where application_name=${q(name)}`));
  const activePid = async name => { await until(() => pidOf(name) > 0, 'OWNED_PROCESS_NOT_VISIBLE'); return pidOf(name); };
  const lock = (waiter, holder) => JSON.parse(sql(`select coalesce((select jsonb_build_object('waiter_pid',pid,'holder_pid',${holder},'wait_event_type',wait_event_type,'wait_event',wait_event,'blocked_by_holder',${holder}=any(pg_blocking_pids(pid))) from pg_stat_activity where pid=${waiter}),'{}'::jsonb)`));
  const queue = id => sql(`select coalesce((select md5(to_jsonb(s)::text) from private.dispatch_schedule s where need_id=${q(id)}::uuid),'ABSENT')`);
  const functionState = () => JSON.parse(sql("select jsonb_agg((to_jsonb(p)-'prosrc')||jsonb_build_object('oid',oid::text,'body_md5',md5(prosrc)) order by oid) from pg_proc p where pronamespace in ('public'::regnamespace,'private'::regnamespace)"));
  const history = () => sql("select md5(jsonb_agg(to_jsonb(h) order by version)::text) from supabase_migrations.schema_migrations h");
  const future = '2099-01-01T00:00:00Z';
  const tick = `private.dispatch_tick(200,${q(future)}::timestamptz)`;
  const options = {auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}};
  const requester = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY, options);
  const worker = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY, options);
  const requesterId = uuid(env.RU5_DEVICE_REQUESTER_USER_ID), workerId = uuid(env.RU5_DEVICE_WORKER_USER_ID);
  let requesterProfile, workerProfile, claims;
  async function fixture(number) {
    const id = randomUUID();
    const start = new Date(Date.now() + (40 + number) * 86400000).toISOString();
    const end = new Date(Date.parse(start) + 3600000).toISOString();
    // The task and its initial queue clock commit together; real cron cannot
    // take this target before the controlled future-clock transaction does.
    sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
        approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at)
      values(${q(id)},${q(requesterId)},${q(requesterProfile)},'PUBLISHED','W02 dispatch lock fixture',
        'Explicit disposable concurrency fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FIXED_WINDOW',
        ${q(start)},${q(end)},statement_timestamp()+interval '2 days',statement_timestamp());
      update private.dispatch_schedule set next_run_at=${q(future)},locked_until=null where need_id=${q(id)};commit;`);
    const response = await ok('rpc_submit_response', worker.rpc('rpc_submit_response', {p_need_id: id, p_need_revision: 1,
      p_worker_profile_id: workerProfile, p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: null,
      p_proposed_end_at: null, p_scope_note: null, p_client_request_id: 'w02-dispatch-apply-' + randomUUID()}));
    const key = 'w02-dispatch-select-' + randomUUID();
    const select = `select 'SELECTED|'||public.rpc_select_response(${q(id)}::uuid,${response.needRevision},${q(uuid(response.responseId))}::uuid,${response.version},${q(response.contentHash)},${q(key)});`;
    const auth = `set local role authenticated;select set_config('request.jwt.claims',${q(JSON.stringify(claims))},true);`;
    return {id, responseId: response.responseId, key, select, auth};
  }
  const parentLock = target => `select id from public.needs where id=${q(target.id)} for update;select 'READY';`;
  const expiryAt = '2098-01-01T00:00:00Z';
  async function expiryFixture() {
    const id = randomUUID(), round = randomUUID(), delivery = randomUUID();
    sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
      insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
        approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at)
      values(${q(id)},${q(requesterId)},${q(requesterProfile)},'PUBLISHED','W02 expiry lock fixture',
        'Explicit disposable due-child fixture','PROOF','Novi Sad','Liman','OFFERS',1,'FIXED_WINDOW',
        '2100-01-02T10:00:00Z','2100-01-02T11:00:00Z','2100-01-01T00:00:00Z',statement_timestamp());
      update private.dispatch_schedule set next_run_at='2100-01-01T00:00:00Z',locked_until=null where need_id=${q(id)};
      insert into public.dispatch_rounds(id,need_id,need_revision,round_no,urgency,batch_size,target_responses,candidate_limit_used,status,deadline_at)
      values(${q(round)},${q(id)},1,1,'NORMAL',1,1,1,'SENT',${q(expiryAt)});
      insert into public.opportunity_deliveries(id,need_id,need_revision,dispatch_round_id,worker_account_id,worker_profile_id,status,expires_at)
      values(${q(delivery)},${q(id)},1,${q(round)},${q(workerId)},${q(workerProfile)},'READY',${q(expiryAt)});commit;`);
    const auth = `set local role authenticated;select set_config('request.jwt.claims',${q(JSON.stringify(claims))},true);`;
    return {id, round, delivery, auth, cancel: `select 'CANCELLED|'||public.rpc_cancel_need(${q(id)}::uuid,1,'End disposable expiry fixture')::text;`};
  }
  const expiryState = target => sql(`select jsonb_build_object('need',n.status,'round',r.status,'delivery',o.status)::text
    from public.needs n join public.dispatch_rounds r on r.need_id=n.id join public.opportunity_deliveries o on o.dispatch_round_id=r.id
    where n.id=${q(target.id)} and r.id=${q(target.round)} and o.id=${q(target.delivery)}`);
  const targetUnchanged = target => `select 'TARGET_QUEUE|'||coalesce((select md5(to_jsonb(s)::text) from private.dispatch_schedule s where need_id=${q(target.id)}),'ABSENT');`;
  async function tickRollback(target, name) {
    const t = transaction(name, `select 'TICK|'||${tick}::text;${targetUnchanged(target)}`);
    t.finish('rollback;');
    const result = await t.done;
    actorPassed(result, name);
    const document = JSON.parse(result.stdout.match(/^TICK\|(.+)$/m)?.[1] ?? 'null');
    assert.deepEqual(Object.keys(document).sort(), ['batch', 'claimed', 'failed', 'processed', 'sent', 'stopped']);
    assert.equal(document.batch, 200);
    assert.equal(document.failed, 0);
    return result;
  }
  try {
    check('EXACT_SOURCE105_REAL_AUTH_AND_QUEUE_OWNER_PREFLIGHT');
    assert.equal(report.source_migration_count, 108);
    assert.match(env.GITHUB_SHA ?? '', /^[0-9a-f]{40}$/);
    assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '105');
    assert.equal(sql('select md5(statements[1]) from supabase_migrations.schema_migrations order by version desc limit 1'), 'bad9f1317e86b2f3efaeb92f7200f0b4');
    // Retain safe observed catalog values before asserting, including on failure.
    report.observed_predecessor_body_md5 = {
      [signature]: sql(`select md5(prosrc) from pg_proc where oid=${q(signature)}::regprocedure`),
      [expirySignature]: sql(`select md5(prosrc) from pg_proc where oid=${q(expirySignature)}::regprocedure`),
    };
    assert.equal(report.observed_predecessor_body_md5[signature], oldBody);
    assert.equal(report.observed_predecessor_body_md5[expirySignature], oldExpiryBody);
    assert.equal(sql("select current_setting('server_version_num')::integer / 10000"), '17');
    report.actual_postgres_major = 17;
    for (const [client, email, id] of [[requester, env.RU5_DEVICE_REQUESTER_EMAIL, requesterId], [worker, env.RU5_DEVICE_WORKER_EMAIL, workerId]]) {
      await ok('signInWithPassword', client.auth.signInWithPassword({email, password: env.RU5_DEVICE_PASSWORD}));
      assert.equal((await ok('getUser', client.auth.getUser())).user.id, id);
    }
    const session = (await requester.auth.getSession()).data.session;
    assert.ok(session?.access_token);
    const verified = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
    assert.equal(verified.sub, requesterId); assert.equal(verified.role, 'authenticated'); uuid(verified.session_id);
    claims = {sub: verified.sub, role: verified.role, session_id: verified.session_id};
    requesterProfile = uuid(sql(`select id from public.app_profiles where account_id=${q(requesterId)} and kind='REQUESTER' and profile_status='ACTIVE'`));
    workerProfile = uuid(sql(`select id from public.app_profiles where account_id=${q(workerId)} and kind='WORKER' and profile_status='ACTIVE'`));
    report.actual_auth = true;
    const originalHistory = history();
    pass();

    check('ORIGINAL_QUEUE_THEN_NEED_DEADLOCK_WITH_REAL_OWNER_SELECTION');
    const target = await fixture(0);
    // The full bounded batch must include this future-due fixture. Every tick
    // transaction rolls back its effects on all pre-existing disposable tasks.
    assert.ok(Number(sql('select count(*) from private.dispatch_schedule')) <= 200);
    const originalQueue = queue(target.id);
    const owner = transaction('w02-dispatch-old-owner', parentLock(target), 2000);
    await until(() => owner.output().includes('READY'), 'OWNER_NEED_LOCK_NOT_READY');
    const ownerPid = pidOf('w02-dispatch-old-owner');
    const oldTick = transaction('w02-dispatch-old-tick', `select 'TICK|'||${tick}::text;`);
    oldTick.finish('rollback;');
    const tickPid = await activePid('w02-dispatch-old-tick');
    await until(() => lock(tickPid, ownerPid).blocked_by_holder === true, 'OLD_TICK_NEED_WAIT_NOT_OBSERVED');
    const waitingTick = lock(tickPid, ownerPid);
    assert.equal(waitingTick.wait_event_type, 'Lock');
    owner.finish(`${target.auth}${target.select}commit;`);
    await until(() => lock(ownerPid, tickPid).blocked_by_holder === true, 'OLD_OWNER_QUEUE_WAIT_NOT_OBSERVED');
    const waitingOwner = lock(ownerPid, tickPid);
    const rejected = await owner.done, released = await oldTick.done;
    assert.notEqual(rejected.code, 0); actorPassed(released, 'old-tick-after-rejected-selection');
    const deadlock = observedDeadlock(rejected.stderr, ownerPid, tickPid);
    assert.equal(queue(target.id), originalQueue);
    assert.equal(sql(`select count(*) from private.selection_commands where requester_account_id=${q(requesterId)} and client_request_id=${q(target.key)}`), '0');
    report.lock_interleavings.push({case: 'OLD_QUEUE_NEED_CYCLE', waiting_tick: waitingTick, waiting_owner: waitingOwner, ...deadlock});
    report.original_selection_rolled_back = true;
    pass();

    check('ORIGINAL_DUE_DELIVERY_THEN_ROUND_DEADLOCK_WITH_REAL_OWNER_CANCEL');
    const expiring = await expiryFixture(), originalExpiry = expiryState(expiring);
    const cancelOwner = transaction('w02-dispatch-old-cancel', `${parentLock(expiring)}select id from public.dispatch_rounds where id=${q(expiring.round)} for update;select 'ROUND_READY';`, 2000);
    await until(() => cancelOwner.output().includes('ROUND_READY'), 'CANCEL_ROUND_LOCK_NOT_READY');
    const cancelPid = pidOf('w02-dispatch-old-cancel');
    const oldExpiry = transaction('w02-dispatch-old-expiry', `select 'EXPIRY|'||private.expire_lifecycle(${q(expiryAt)})::text;`);
    oldExpiry.finish('rollback;');
    const expiryPid = await activePid('w02-dispatch-old-expiry');
    await until(() => lock(expiryPid, cancelPid).blocked_by_holder === true, 'OLD_EXPIRY_ROUND_WAIT_NOT_OBSERVED');
    const waitingExpiry = lock(expiryPid, cancelPid); assert.equal(waitingExpiry.wait_event_type, 'Lock');
    cancelOwner.finish(`${expiring.auth}${expiring.cancel}commit;`);
    await until(() => lock(cancelPid, expiryPid).blocked_by_holder === true, 'OLD_CANCEL_DELIVERY_WAIT_NOT_OBSERVED');
    const waitingCancelLock = lock(cancelPid, expiryPid);
    const rejectedCancel = await cancelOwner.done, releasedExpiry = await oldExpiry.done;
    assert.notEqual(rejectedCancel.code, 0); actorPassed(releasedExpiry, 'old-expiry-after-rejected-cancel');
    const expiryDeadlock = observedDeadlock(rejectedCancel.stderr, cancelPid, expiryPid);
    assert.equal(expiryState(expiring), originalExpiry);
    report.lock_interleavings.push({case: 'OLD_DELIVERY_ROUND_CYCLE', waiting_expiry: waitingExpiry, waiting_cancel: waitingCancelLock, ...expiryDeadlock});
    report.original_cancellation_rolled_back = true;
    pass();

    check('EXACT_FORWARD_ONLY_TWO_NAMED_BODIES_ALL_HISTORY_METADATA_AND_ROWS_PRESERVED');
    const tables = JSON.parse(sql("select jsonb_agg(schemaname||'.'||tablename order by schemaname,tablename) from pg_tables where schemaname in ('public','private')"));
    const tableState = () => JSON.parse(sql(`select jsonb_object_agg(name,digest) from (${tables.map(table => {
      assert.match(table, /^(public|private)\.[a-z_0-9]+$/);
      return `select ${q(table)} as name,md5(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]'::jsonb)::text) as digest from ${table} x`;
    }).join(' union all ')}) snapshot`));
    const beforeRows = tableState(), beforeFunctions = functionState();
    const changedBodies = new Map([[sql(`select ${q(signature)}::regprocedure::oid::text`), newBody],
      [sql(`select ${q(expirySignature)}::regprocedure::oid::text`), newExpiryBody]]);
    assert.equal(changedBodies.size, 2);
    for (const oid of changedBodies.keys()) { assert.match(oid, /^[1-9][0-9]*$/); assert.equal(beforeFunctions.filter(fn => fn.oid === oid).length, 1); }
    const expected = beforeFunctions.map(fn => changedBodies.has(fn.oid) ? {...fn, body_md5: changedBodies.get(fn.oid)} : fn);
    sql(bytes.toString('utf8'));
    report.candidate_applied = true;
    assert.deepEqual(functionState(), expected);
    assert.deepEqual(tableState(), beforeRows);
    assert.equal(history(), originalHistory);
    report.original_history_preserved = true;
    report.all_function_metadata_preserved_except_two_named_bodies = true;
    report.all_existing_rows_preserved_at_apply = true;
    pass();

    check('HELD_NEED_IS_SKIPPED_REAL_SELECTION_SUCCEEDS_WITH_SAME_REQUEST_KEY');
    const held = transaction('w02-dispatch-new-owner', parentLock(target));
    await until(() => held.output().includes('READY'), 'NEW_OWNER_NEED_LOCK_NOT_READY');
    const heldPid = pidOf('w02-dispatch-new-owner');
    const skipped = await tickRollback(target, 'w02-dispatch-skip-need');
    assert.ok(skipped.stdout.includes('TARGET_QUEUE|' + originalQueue));
    held.finish(`${target.auth}${target.select}commit;`);
    const selected = await held.done;
    actorPassed(selected, 'selection-after-skipped-need');
    const agreementId = uuid(selected.stdout.match(/^SELECTED\|(.+)$/m)?.[1]);
    const workspace = await ok('rpc_get_agreement_workspace', requester.rpc('rpc_get_agreement_workspace', {p_agreement_id: agreementId}));
    assert.equal(workspace.id, agreementId);
    assert.equal(sql(`select count(*) from private.selection_commands where requester_account_id=${q(requesterId)} and client_request_id=${q(target.key)}`), '1');
    report.lock_interleavings.push({case: 'NEED_HELD_TICK_SKIPS', owner_pid: heldPid, target_queue_unchanged: true, actual_selection_succeeded: true});
    report.same_request_key_selected_once = true;
    pass();

    check('BATCH_ONE_SKIPS_HELD_QUEUE_REACHES_NEXT_AND_RELEASES_SKIPPED_NEED');
    const next = await fixture(1), free = await fixture(2);
    sql(`update private.dispatch_schedule set next_run_at=case need_id when ${q(next.id)}::uuid then '2097-01-01T00:00:00Z'::timestamptz else '2097-01-02T00:00:00Z'::timestamptz end where need_id in (${q(next.id)},${q(free.id)});`);
    const nextQueue = queue(next.id), freeQueue = queue(free.id);
    // Other disposable Needs are held only to isolate a deterministic batch=1
    // ordering. No queue row, scheduler job or production eligibility is changed.
    const queued = transaction('w02-dispatch-queue-owner', `select id from public.needs where id not in (${q(next.id)},${q(free.id)}) for update;select need_id from private.dispatch_schedule where need_id=${q(next.id)} for update;select 'READY';`);
    await until(() => queued.output().includes('READY'), 'QUEUE_LOCK_NOT_READY');
    const queuePid = pidOf('w02-dispatch-queue-owner');
    const skipQueue = transaction('w02-dispatch-skip-queue', `select 'TICK|'||private.dispatch_tick(1,${q(future)})::text;${targetUnchanged(next)}${targetUnchanged(free)}select 'READY';`);
    await until(() => skipQueue.output().includes('READY'), 'QUEUE_SKIP_BATCH_NOT_READY');
    const queueSkipDocument = JSON.parse(skipQueue.output().match(/^TICK\|(.+)$/m)?.[1] ?? 'null');
    assert.equal(queueSkipDocument.batch, 1); assert.equal(queueSkipDocument.claimed, 1); assert.equal(queueSkipDocument.processed, 1); assert.equal(queueSkipDocument.failed, 0);
    assert.ok(skipQueue.output().includes('TARGET_QUEUE|' + nextQueue));
    assert.ok(!skipQueue.output().includes('TARGET_QUEUE|' + freeQueue), 'The next free target must actually be processed');
    const releasedNeed = transaction('w02-dispatch-released-need', `select id from public.needs where id=${q(next.id)} for update nowait;select 'RELEASED_NEED';`);
    releasedNeed.finish('rollback;');
    const releasedNeedResult = await releasedNeed.done;
    actorPassed(releasedNeedResult, 'released-skipped-need'); assert.ok(releasedNeedResult.stdout.includes('RELEASED_NEED'));
    skipQueue.finish('rollback;'); assert.equal((await skipQueue.done).code, 0);
    queued.finish('rollback;'); assert.equal((await queued.done).code, 0);
    assert.equal(queue(next.id), nextQueue); assert.equal(queue(free.id), freeQueue);
    await ok('rpc_cancel_need', requester.rpc('rpc_cancel_need', {p_need_id: free.id, p_need_revision: 1, p_reason: 'End disposable queue skip fixture'}));
    report.lock_interleavings.push({case: 'QUEUE_HELD_TICK_SKIPS', owner_pid: queuePid, batch: 1, target_queue_unchanged: true, next_free_target_processed: true, skipped_need_lock_released: true});
    pass();

    check('CURRENT_TICK_NEED_LOCK_SERIALIZES_REAL_SELECTION_WITHOUT_DEADLOCK');
    const activeTick = transaction('w02-dispatch-current-tick', `select 'TICK|'||${tick}::text;select 'READY';`);
    await until(() => activeTick.output().includes('READY'), 'CURRENT_TICK_NOT_READY');
    const currentPid = pidOf('w02-dispatch-current-tick');
    const pendingOwner = transaction('w02-dispatch-waiting-owner', `${next.auth}${next.select}`);
    pendingOwner.finish('commit;');
    const pendingPid = await activePid('w02-dispatch-waiting-owner');
    await until(() => lock(pendingPid, currentPid).blocked_by_holder === true, 'CURRENT_OWNER_NEED_WAIT_NOT_OBSERVED');
    const observation = lock(pendingPid, currentPid); assert.equal(observation.wait_event_type, 'Lock');
    activeTick.finish('rollback;'); assert.equal((await activeTick.done).code, 0);
    const completed = await pendingOwner.done; actorPassed(completed, 'selection-after-current-tick');
    const secondAgreement = uuid(completed.stdout.match(/^SELECTED\|(.+)$/m)?.[1]);
    assert.notEqual(secondAgreement, agreementId);
    report.lock_interleavings.push({case: 'CURRENT_TICK_THEN_SELECTION', ...observation, actual_selection_succeeded: true});
    // Canonical cancellation, event/privacy work, and re-enqueue still use their
    // original owner API after the successful selections. No calendar residue.
    for (const id of [agreementId, secondAgreement]) await ok('rpc_cancel_agreement', requester.rpc('rpc_cancel_agreement', {p_agreement_id: id, p_reason: 'End disposable dispatch lock fixture'}));
    assert.equal(sql(`select count(*) from public.agreements where id in (${q(agreementId)},${q(secondAgreement)}) and status='CANCELLED'`), '2');
    assert.equal(sql(`select count(*) from private.worker_calendar_events where agreement_id in (${q(agreementId)},${q(secondAgreement)}) and state='BLOCKING'`), '0');
    assert.equal(history(), originalHistory);
    assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '105');
    assert.equal(sql(`select md5(prosrc) from pg_proc where oid=${q(signature)}::regprocedure`), newBody);
    assert.equal(sql(`select md5(prosrc) from pg_proc where oid=${q(expirySignature)}::regprocedure`), newExpiryBody);
    report.actual_owner_cancellation_preserved = true;
    report.no_fixture_blocking_calendar_events = true;
    report.registry_history_unchanged = true;
    pass();

    check('HELD_NEED_SKIPS_DUE_CHILDREN_THEN_REAL_CANCELLATION_SUCCEEDS');
    const heldExpiry = transaction('w02-dispatch-held-expiry', parentLock(expiring));
    await until(() => heldExpiry.output().includes('READY'), 'EXPIRY_PARENT_NOT_READY');
    const heldExpiryPid = pidOf('w02-dispatch-held-expiry');
    const expirySkip = transaction('w02-dispatch-skip-expiry', `select 'EXPIRY|'||private.expire_lifecycle(${q(expiryAt)})::text;select 'CHILDREN|'||jsonb_build_object('round',(select status from public.dispatch_rounds where id=${q(expiring.round)}),'delivery',(select status from public.opportunity_deliveries where id=${q(expiring.delivery)}))::text;`);
    expirySkip.finish('rollback;'); const expirySkipped = await expirySkip.done;
    actorPassed(expirySkipped, 'expiry-skips-held-need');
    const childState = JSON.parse(expirySkipped.stdout.match(/^CHILDREN\|(.+)$/m)?.[1] ?? 'null');
    assert.deepEqual(childState, {round: 'SENT', delivery: 'READY'});
    heldExpiry.finish(`${expiring.auth}${expiring.cancel}commit;`);
    const cancelledExpiry = await heldExpiry.done; actorPassed(cancelledExpiry, 'cancel-after-skipped-expiry');
    assert.equal(JSON.parse(cancelledExpiry.stdout.match(/^CANCELLED\|(.+)$/m)?.[1] ?? 'null').status, 'CANCELLED');
    assert.deepEqual(JSON.parse(expiryState(expiring)), {need: 'CANCELLED', round: 'STOPPED', delivery: 'EXPIRED'});
    report.lock_interleavings.push({case: 'NEED_HELD_EXPIRY_SKIPS', owner_pid: heldExpiryPid, due_children_unchanged: true, actual_cancellation_succeeded: true});
    pass();

    check('CURRENT_EXPIRY_PARENT_LOCK_SERIALIZES_CANCELLATION_WITHOUT_DEADLOCK');
    const expiringNext = await expiryFixture();
    const currentExpiry = transaction('w02-dispatch-current-expiry', `select 'EXPIRY|'||private.expire_lifecycle(${q(expiryAt)})::text;select 'CHILDREN|'||jsonb_build_object('round',(select status from public.dispatch_rounds where id=${q(expiringNext.round)}),'delivery',(select status from public.opportunity_deliveries where id=${q(expiringNext.delivery)}))::text;select 'READY';`);
    await until(() => currentExpiry.output().includes('READY'), 'CURRENT_EXPIRY_NOT_READY');
    assert.deepEqual(JSON.parse(currentExpiry.output().match(/^CHILDREN\|(.+)$/m)?.[1] ?? 'null'), {round: 'EXPIRED', delivery: 'EXPIRED'});
    const currentExpiryPid = pidOf('w02-dispatch-current-expiry');
    const waitingCancel = transaction('w02-dispatch-waiting-cancel', `${expiringNext.auth}${expiringNext.cancel}`);
    waitingCancel.finish('commit;'); const waitingCancelPid = await activePid('w02-dispatch-waiting-cancel');
    await until(() => lock(waitingCancelPid, currentExpiryPid).blocked_by_holder === true, 'CURRENT_CANCEL_PARENT_WAIT_NOT_OBSERVED');
    const expiryObservation = lock(waitingCancelPid, currentExpiryPid); assert.equal(expiryObservation.wait_event_type, 'Lock');
    currentExpiry.finish('rollback;'); assert.equal((await currentExpiry.done).code, 0);
    const finalCancel = await waitingCancel.done; actorPassed(finalCancel, 'cancel-after-current-expiry');
    assert.equal(JSON.parse(finalCancel.stdout.match(/^CANCELLED\|(.+)$/m)?.[1] ?? 'null').status, 'CANCELLED');
    report.lock_interleavings.push({case: 'CURRENT_EXPIRY_THEN_CANCELLATION', ...expiryObservation, actual_cancellation_succeeded: true, due_children_expired_before_rollback: true});
    report.due_child_predicates_preserved = true;
    pass();

    check('EXACT_CANCELLED_FIXTURE_EVENT_CLEANUP_PRESERVES_CALENDAR_BASELINE');
    // Existing W02 starts by proving an empty event table. Retire only these
    // two recorded, cancelled/released fixture events after proving cancellation.
    const cleanup = JSON.parse(sql(`with owned as (select e.id from private.worker_calendar_events e join public.agreements a on a.id=e.agreement_id
      where a.id in (${q(agreementId)},${q(secondAgreement)}) and a.need_id in (${q(target.id)},${q(next.id)})
        and a.requester_account_id=${q(requesterId)} and a.worker_account_id=${q(workerId)}
        and a.status='CANCELLED' and e.state='RELEASED') select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from owned`));
    assert.equal(cleanup.length, 2); cleanup.forEach(uuid);
    sql(`delete from private.worker_calendar_events where id in (${cleanup.map(q).join(',')}) and state='RELEASED';`);
    assert.equal(sql(`select count(*) from private.worker_calendar_events where id in (${cleanup.map(q).join(',')})`), '0');
    assert.equal(sql('select count(*) from private.worker_calendar_events'), '0');
    report.fixture_event_cleanup = {released_event_ids: cleanup, removed_count: 2, calendar_baseline_empty: true};
    assert.equal(history(), originalHistory);
    pass();
    report.result = 'PASS';
  } catch (error) {
    report.result = 'FAIL'; report.failed_check = stage;
    report.failure_category = error?.name === 'AssertionError' ? 'ASSERTION' : 'EXECUTION';
    report.failure_line = String(error?.stack ?? '').match(/w02_dispatch_lock_proof\.mjs:(\d+):\d+/)?.[1] ?? null;
    console.error('FAIL W02_DISPATCH_NEED_LOCK_ORDER ' + stage);
    process.exitCode = 1;
  } finally {
    const retired = [...children];
    for (const child of retired) child.kill('SIGTERM');
    await Promise.all(retired.map(child => child.ownedDone));
    for (const path of ['supabase/proofs/calendar/w02_dispatch_lock_proof.mjs', 'supabase/proofs/calendar/w02_dispatch_lock_files.json']) report.input_sha256[path] = hash(readFileSync(path));
    writeFileSync(resolve(directory, 'proof-report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (report.result === 'PASS') { admitDispatchLockReport(report, env.GITHUB_SHA); console.log('PASS W02_DISPATCH_NEED_LOCK_ORDER'); }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
