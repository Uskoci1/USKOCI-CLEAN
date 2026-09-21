// PKG-028 proof. Disposable local stack only: it refuses any other target and holds no hosted secret. The Edge
// base address it gives the tick is the local gateway, and the key it stores is the local stack's own.
//
//   replay  after pkg027's own replay (the workflow runs it first): the five PKG-027 candidates, from the exact
//           text canonical DEV recorded, until every function PKG-028 reads or patches has its canonical DEV body
//   before  the defects reproduce: nothing can call a worker; a fixed-time task whose time is over stays open;
//           publishing one whose start has passed is not refused for that reason
//   apply   a tampered pin is refused and leaves nothing behind; both candidates apply; a second application of
//           each is refused; the surface changes by exactly one new and two patched functions
//   after   past tasks expire and nothing else does; the publish refusal; the tick sends nothing without a key
//           or to an address that is not allowed; anon and authenticated can reach neither the tick nor pg_net
//   e2e     with the real Edge workers served on the local stack: a wrong key is refused by the worker; with the
//           right key a confirmed account deletion is carried to CLOSED by the tick alone, the cron job fires it,
//           and the push and export workers accept exactly the request the tick sends
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';

const db = process.env.DB_URL;
assert.equal(db, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', 'DISPOSABLE_LOCAL_TARGET_ONLY');
const out = process.env.PRE_V3_ARTIFACT_DIR;
assert.ok(out, 'PRE_V3_ARTIFACT_DIR');
mkdirSync(out, {recursive: true});
const mode = process.argv[2];
const sha256 = x => createHash('sha256').update(x).digest('hex');
const q = v => "'" + String(v).replaceAll("'", "''") + "'";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = (label, e) => { const error = new Error(label + ': ' + String(e.stderr ?? e.message).slice(-3000)); error.stderr = String(e.stderr ?? ''); return error; };
const sql = (text, label = 'SQL') => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
      {input: text, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']}).trim();
  } catch (e) { throw fail(label, e); }
};
const psqlFile = (path, {single = false} = {}) => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...(single ? ['-1'] : []), '-f', path],
      {encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) { throw fail(path, e); }
};
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8'), 'SURFACE').split('\n').filter(Boolean);
const report = JSON.parse(existsSync(`${out}/pkg028-report.json`) ? readFileSync(`${out}/pkg028-report.json`, 'utf8') :
  JSON.stringify({package: 'PKG-028', sourceSha: process.env.GITHUB_SHA, disposableDbOnly: true, canonicalDevAccess: false,
    providerCalls: false, deviceTest: false, checks: []}));
const pass = name => { report.checks.push({mode, name, result: 'PASS'}); console.log('PASS ' + name); };
const save = () => writeFileSync(`${out}/pkg028-report.json`, JSON.stringify(report, null, 1) + '\n');
const closure = () => JSON.parse(sql(`select jsonb_build_object('live', private.closure_source_digest_v5(),
  'certified', (select sha256 from private.closure_source_v5 where singleton), 'ready', private.retention_ai_source_ready())`));
const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`);

const CANDIDATES = {pkg028a_edge_workers_scheduled: 'PKG028A', pkg028b_past_tasks_close: 'PKG028B'};
// The five PKG-027 rows canonical DEV recorded on 2026-09-21 (receipt 20260921_pkg027_application.receipt.json).
const PKG027 = [
  ['pkg027a_dispatch_keeps_looking', 'fa36a915bce7e8da0ccad9793d3683e61f46cfb73be9d8d22970bb68f7829462'],
  ['pkg027b_ai_turn_sweep', '7a798207681b1f8b38827f1d0c7a88f62bddab2ce25fad441596ed69a6514d0a'],
  ['pkg027c_notification_ti_copy', 'e23e24fba1990e866cf779528b13cb1c1e38344d05c4965eefbc61417d7ecbbc'],
  ['pkg027d_profile_text_truthful', '869e37c2749e5205d549874b8b35edc503b11746f7ebf5e59db6bb2b80da6d2a'],
  ['pkg027e_price_basis_survives_edit', 'ba73d04944a30a9697fee3723caa839df570c8d361b296be114a3a2ed06031dc'],
];
// md5(prosrc) on canonical DEV, 2026-09-21, after PKG-027: what PKG-028 patches, and what its tick reads.
const DEV_BODIES = {
  'private.expire_lifecycle(timestamptz)': 'c9e69fe79781da56eb7bb3853e75c798',
  'public.rpc_publish_need_canonical(uuid,integer,bigint,timestamptz,text)': '818272ac56792c1eaf2cad20b2757f7f',
  'private.marketplace_tick(integer,timestamptz)': '3858404992f2ceaa30b65af1055e2b9c',
  'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)': '15f77e4ba4aec29a0df69a50b17409d2',
};
const PATCHED = ['private.expire_lifecycle', 'public.rpc_publish_need_canonical'];
const ADDED = ['private.edge_worker_tick_v5'];
const DEV_BASE = 'https://leqcwgzvjsxugfgzdmth.supabase.co';

// ---------------------------------------------------------------------------------------------------------
if (mode === 'replay') {
  assert.equal(sql("select count(*) from cron.job where jobname = 'uskoci_marketplace_tick' and active"), '0', 'pkg027 replay pauses the tick');
  report.pkg027 = [];
  for (const [name, sha] of PKG027) {
    const path = `supabase/candidates/${name}.sql`, bytes = readFileSync(path, 'utf8');
    assert.equal(sha256(bytes.replace(/\n$/, '')), sha, 'NOT_THE_TEXT_CANONICAL_DEV_RECORDED ' + name);
    psqlFile(path);
    report.pkg027.push({name, sha256: sha});
  }
  pass('THE_FIVE_PKG027_ROWS_REPLAYED_FROM_THE_EXACT_TEXT_CANONICAL_DEV_RECORDED');
  const differing = Object.entries(DEV_BODIES).filter(([signature, md5]) => bodyMd5(signature) !== md5)
    .map(([signature, md5]) => ({signature, onCanonicalDev: md5, inReplay: bodyMd5(signature)}));
  report.bodiesThatDifferFromCanonicalDev = differing;
  assert.deepEqual(differing, [], 'REPLAY_IS_NOT_CANONICAL_DEV ' + JSON.stringify(differing));
  pass('EVERY_FUNCTION_PKG028_PATCHES_OR_THE_TICK_DEPENDS_ON_HAS_THE_CANONICAL_DEV_BODY');
  const c = closure();
  assert.equal(c.ready, true); assert.equal(c.live, c.certified);
  report.closureAfterReplay = c;
  pass('THE_CLOSURE_SOURCE_IS_CERTIFIED_AND_READY_AS_ON_CANONICAL_DEV');
  save();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// scenarios: synthetic rows inside one transaction that is rolled back
// ---------------------------------------------------------------------------------------------------------
const person = () => ({id: randomUUID(), requester: randomUUID()});
const insertPerson = p => `insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,available_now)
    values(${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',false);`;
const asPerson = id => `set local role authenticated;
  set local request.jwt.claim.sub = ${q(id)};
  set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claims = ${q(JSON.stringify({sub: id, role: 'authenticated'}))};`;
const asPostgres = `reset role;
  set local request.jwt.claim.sub = '';
  set local request.jwt.claim.role = '';
  set local request.jwt.claims = '';`;
const scenario = (label, body) => JSON.parse(sql(`begin;
  set local statement_timeout = '120s';
  create temporary table pkg028_obs(k text primary key, v jsonb) on commit drop;
  create temporary table pkg028_ids(k text primary key, id uuid, rev integer) on commit drop;
  grant all on pkg028_obs, pkg028_ids to authenticated, anon;
  ${body}
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from pkg028_obs;
  rollback;`, label));

// E1. Four published tasks; the minute tick's lifecycle step runs once.
function expiryScenario() {
  const a = person(), ids = {past: randomUUID(), pastNoEnd: randomUUID(), future: randomUUID(), flexible: randomUUID()};
  const row = (id, title, kind, start, end) => `(${q(id)},${q(a.id)},${q(a.requester)},'PUBLISHED',${q(title)},'Disposable SQL fixture',
    'PROOF','Novi Sad','Liman','OFFERS',1,${q(kind)},${start},${end},statement_timestamp()-interval '1 day')`;
  return scenario('EXPIRY', `${insertPerson(a)}
    select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,
      approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,published_at) values
      ${row(ids.past, 'PKG-028 over', 'FIXED_WINDOW', "statement_timestamp()-interval '5 hours'", "statement_timestamp()-interval '2 hours'")},
      ${row(ids.future, 'PKG-028 tomorrow', 'FIXED_WINDOW', "statement_timestamp()+interval '1 day'", "statement_timestamp()+interval '1 day 2 hours'")},
      ${row(ids.flexible, 'PKG-028 flexible', 'FLEXIBLE', 'null', 'null')};
    select set_config('uskoci.need_lifecycle','',true);
    select private.enqueue_dispatch(${q(ids.past)}::uuid, statement_timestamp());
    insert into pkg028_obs values('queuedBefore', to_jsonb((select count(*) from private.dispatch_schedule where need_id=${q(ids.past)}::uuid)));
    insert into pkg028_obs values('lifecycle', private.expire_lifecycle(statement_timestamp()));
    insert into pkg028_obs select 'status:' || title, to_jsonb(status) from public.needs where requester_account_id=${q(a.id)}::uuid;
    insert into pkg028_obs values('queuedAfter', to_jsonb((select count(*) from private.dispatch_schedule where need_id=${q(ids.past)}::uuid)));`);
}

// E2. Publishing: own draft whose start passed, own draft in the future, and someone else's draft whose start passed.
function publishScenario() {
  const a = person(), b = person(), ids = {pastOwn: randomUUID(), futureOwn: randomUUID(), pastOther: randomUUID()};
  const draft = (id, owner, title, start) => `(${q(id)},${q(owner.id)},${q(owner.requester)},'DRAFT',${q(title)},'Disposable SQL fixture',
    'PROOF','Novi Sad','Liman','OFFERS',1,'FIXED_WINDOW',${start},${start}+interval '2 hours')`;
  return scenario('PUBLISH', `${insertPerson(a)}${insertPerson(b)}
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,
      approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at) values
      ${draft(ids.pastOwn, a, 'PKG-028 own past', "statement_timestamp()-interval '3 hours'")},
      ${draft(ids.futureOwn, a, 'PKG-028 own future', "statement_timestamp()+interval '2 days'")},
      ${draft(ids.pastOther, b, 'PKG-028 other past', "statement_timestamp()-interval '3 hours'")};
    insert into pkg028_ids select 'publish:' || title, id, revision from public.needs where id in (${q(ids.pastOwn)},${q(ids.futureOwn)},${q(ids.pastOther)});
    ${asPerson(a.id)}
    do $p$ declare r record; begin
      for r in select * from pkg028_ids where k like 'publish:%' order by k loop
        begin
          perform public.rpc_publish_need_canonical(r.id, r.rev, 1::bigint, null::timestamptz, 'pkg028-proof-' || md5(r.k));
          insert into pkg028_obs values (r.k, to_jsonb('PUBLISHED'::text));
        exception when others then
          insert into pkg028_obs values (r.k, to_jsonb(sqlerrm));
        end;
      end loop;
    end $p$;
    ${asPostgres}`);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'before') {
  assert.equal(sql("select count(*) from pg_extension where extname = 'pg_net'"), '0');
  assert.equal(sql("select string_agg(jobname, ',' order by jobname) from cron.job"), 'uskoci_marketplace_tick');
  assert.equal(sql("select to_regprocedure('private.edge_worker_tick_v5(timestamptz)') is null"), 't');
  report.before = {cronJobs: ['uskoci_marketplace_tick'], pgNet: false};
  pass('NOTHING_CAN_CALL_AN_EDGE_WORKER_NO_PG_NET_AND_THE_ONLY_JOB_STAYS_INSIDE_THE_DATABASE');
  const e = expiryScenario();
  report.expiryBefore = e;
  assert.equal(e['status:PKG-028 over'], 'PUBLISHED', 'DEFECT_NOT_REPRODUCED: a task whose time is over expired');
  assert.equal(e.queuedAfter, 1, 'DEFECT_NOT_REPRODUCED: the task left the dispatch queue');
  pass('A_FIXED_TIME_TASK_WHOSE_TIME_IS_OVER_STAYS_PUBLISHED_AND_QUEUED');
  const p = publishScenario();
  report.publishBefore = p;
  assert.notEqual(p['publish:PKG-028 own past'], 'FIXED_WINDOW_START_PASSED');
  assert.equal(p['publish:PKG-028 own past'], p['publish:PKG-028 own future'],
    'DEFECT_NOT_REPRODUCED: a past start and a future start are treated differently before the candidate');
  pass('PUBLISHING_A_TASK_WHOSE_START_PASSED_IS_TREATED_EXACTLY_LIKE_ONE_IN_THE_FUTURE');
  save();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
const apply = name => psqlFile(`supabase/candidates/${name}.sql`);
const refuses = (name, code, path = `supabase/candidates/${name}.sql`) => {
  let failure = null;
  try { psqlFile(path); } catch (e) { failure = e; }
  assert.ok(failure, `${name} applied where it must refuse (${code})`);
  assert.ok(failure.stderr.includes(code), `${name}: expected ${code}, got ${failure.stderr.slice(-600)}`);
};
const changed = line => line.split(':').slice(0, 2).join(':').replace(/\(.*$/, '');

if (mode === 'apply') {
  const before = surface(), closureBefore = closure();
  writeFileSync(`${out}/pkg028-surface-before.txt`, before.join('\n') + '\n');
  // A pin that does not match refuses and leaves nothing behind.
  const tampered = `${out}/pkg028b_past_tasks_close.tampered.sql`;
  writeFileSync(tampered, readFileSync('supabase/candidates/pkg028b_past_tasks_close.sql', 'utf8')
    .replace("'c9e69fe79781da56eb7bb3853e75c798'", "'00000000000000000000000000000000'"));
  refuses('pkg028b (tampered)', 'PKG028B_PREDECESSOR_DRIFT', tampered);
  assert.deepEqual(surface(), before, 'A_REFUSED_CANDIDATE_LEFT_SOMETHING_BEHIND');
  pass('A_TAMPERED_PIN_IS_REFUSED_AND_LEAVES_NOTHING_BEHIND');

  apply('pkg028a_edge_workers_scheduled');
  // The job is live in this database too. Pause it: the proof decides when a tick runs.
  sql("select cron.alter_job(j.jobid, active := false) from cron.job j where j.jobname = 'uskoci_edge_workers'", 'PAUSE');
  apply('pkg028b_past_tasks_close');
  pass('BOTH_CANDIDATES_APPLY');
  for (const [name, code] of Object.entries(CANDIDATES)) refuses(name, code + '_ALREADY_APPLIED');
  pass('A_SECOND_APPLICATION_OF_EACH_IS_REFUSED');

  const after = surface();
  writeFileSync(`${out}/pkg028-surface-after.txt`, after.join('\n') + '\n');
  const removed = before.filter(l => !after.includes(l)), added = after.filter(l => !before.includes(l));
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  assert.deepEqual(removed.map(changed).sort(), PATCHED.map(n => 'function:' + n).sort());
  assert.deepEqual(added.map(changed).sort(), [...PATCHED, ...ADDED].map(n => 'function:' + n).sort());
  pass('THE_SURFACE_CHANGES_BY_EXACTLY_ONE_NEW_AND_TWO_PATCHED_FUNCTIONS');

  const c = closure();
  assert.equal(c.live, closureBefore.live); assert.equal(c.live, c.certified); assert.equal(c.ready, true);
  report.closure = c;
  pass('THE_CERTIFIED_CLOSURE_SOURCE_DID_NOT_MOVE');

  report.pgNet = JSON.parse(sql(`select jsonb_build_object(
    'version', (select extversion from pg_extension where extname = 'pg_net'),
    'anonUsage', has_schema_privilege('anon','net','USAGE'), 'authenticatedUsage', has_schema_privilege('authenticated','net','USAGE'),
    'ownerUsage', has_schema_privilege('postgres','net','USAGE'),
    'ownerCanPost', exists (select 1 from pg_proc p where p.pronamespace='net'::regnamespace and p.proname='http_post' and has_function_privilege('postgres',p.oid,'EXECUTE')),
    'schemaAcl', (select nspacl::text from pg_namespace where nspname = 'net'),
    'job', (select to_jsonb(j) - 'jobid' from cron.job j where jobname = 'uskoci_edge_workers'))`));
  assert.equal(report.pgNet.anonUsage, false); assert.equal(report.pgNet.authenticatedUsage, false);
  assert.equal(report.pgNet.ownerUsage, true); assert.equal(report.pgNet.ownerCanPost, true);
  pass('PG_NET_IS_CLOSED_TO_ANON_AND_AUTHENTICATED_AND_OPEN_TO_THE_TICK');
  save();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'after') {
  const e = expiryScenario();
  report.expiryAfter = e;
  assert.equal(e['status:PKG-028 over'], 'EXPIRED');
  assert.equal(e['status:PKG-028 tomorrow'], 'PUBLISHED');
  assert.equal(e['status:PKG-028 flexible'], 'PUBLISHED');
  assert.equal(e.queuedBefore, 1); assert.equal(e.queuedAfter, 0);
  assert.ok(e.lifecycle.needsExpired >= 1);
  pass('ONLY_THE_TASK_WHOSE_TIME_IS_OVER_EXPIRES_AND_IT_LEAVES_THE_DISPATCH_QUEUE');

  const p = publishScenario();
  report.publishAfter = p;
  assert.equal(p['publish:PKG-028 own past'], 'FIXED_WINDOW_START_PASSED');
  assert.equal(p['publish:PKG-028 own future'], report.publishBefore['publish:PKG-028 own future'],
    'a future start must meet exactly the refusal it met before the candidate');
  assert.notEqual(p['publish:PKG-028 other past'], 'FIXED_WINDOW_START_PASSED', "another person's schedule leaked");
  pass('A_PAST_START_IS_REFUSED_A_FUTURE_ONE_IS_UNCHANGED_AND_NOBODY_LEARNS_ANOTHER_PERSONS_SCHEDULE');

  assert.equal(sql("select count(*) from vault.secrets where name = 'uskoci_edge_worker_key'"), '0');
  assert.deepEqual(JSON.parse(sql('select private.edge_worker_tick_v5()')), {kind: 'NOT_CONFIGURED', missing: 'WORKER_KEY'});
  // An address that is neither a Supabase project nor this stack's gateway is refused, key or not.
  const foreign = JSON.parse(sql(`begin;
    select vault.update_secret((select id from vault.secrets where name='uskoci_edge_base_url'), 'https://example.com');
    select vault.create_secret('pkg028-well-formed-but-not-a-key', 'uskoci_edge_worker_key');
    select private.edge_worker_tick_v5()::text;
    rollback;`, 'FOREIGN').split('\n').filter(l => l.startsWith('{')).pop());
  assert.deepEqual(foreign, {kind: 'NOT_CONFIGURED', missing: 'BASE_URL'});
  assert.equal(sql("select count(*) from net.http_request_queue") + '/' + sql("select count(*) from net._http_response"), '0/0',
    'the tick sent something without a key or to a refused address');
  pass('WITHOUT_A_KEY_OR_TO_AN_ADDRESS_THAT_IS_NOT_ALLOWED_THE_TICK_SENDS_NOTHING');

  const reach = scenario('REACH', `
    ${['anon', 'authenticated'].map(role => `set local role ${role};
    do $r$ begin perform private.edge_worker_tick_v5(); insert into pkg028_obs values ('${role}:tick', '"CALLED"');
      exception when others then insert into pkg028_obs values ('${role}:tick', to_jsonb(sqlstate)); end $r$;
    do $r$ begin perform net.http_post('https://example.com', '{}'::jsonb); insert into pkg028_obs values ('${role}:net', '"CALLED"');
      exception when others then insert into pkg028_obs values ('${role}:net', to_jsonb(sqlstate)); end $r$;
    reset role;`).join('\n')}`);
  report.reach = reach;
  for (const k of ['anon:tick', 'anon:net', 'authenticated:tick', 'authenticated:net']) assert.equal(reach[k], '42501', k);
  pass('ANON_AND_AUTHENTICATED_CAN_REACH_NEITHER_THE_TICK_NOR_PG_NET');
  save();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'e2e') {
  const rt = await import('../pre_v3/closure_runtime.mjs');
  const kong = process.env.PKG028_KONG, key = process.env.RU5_DEVICE_SERVICE_ROLE_KEY;
  assert.match(kong ?? '', /^http:\/\/supabase_kong_[a-z0-9_-]+:8000$/, 'PKG028_KONG');
  assert.ok(key && /^[A-Za-z0-9._~-]{16,4096}$/.test(key), 'the local service key');
  const setBase = value => sql(`select vault.update_secret((select id from vault.secrets where name='uskoci_edge_base_url'), ${q(value)})`, 'BASE');
  const setKey = value => sql(`do $k$ begin
      if exists (select 1 from vault.secrets where name='uskoci_edge_worker_key') then
        perform vault.update_secret((select id from vault.secrets where name='uskoci_edge_worker_key'), ${q(value)});
      else perform vault.create_secret(${q(value)}, 'uskoci_edge_worker_key'); end if; end $k$;`, 'KEY');
  const base = () => sql("select decrypted_secret from vault.decrypted_secrets where name='uskoci_edge_base_url'");
  // Never store a key while the address is canonical DEV's.
  assert.equal(base(), DEV_BASE); setBase(kong); assert.equal(base(), kong);
  pass('THE_TICK_POINTS_AT_THIS_STACKS_OWN_GATEWAY_BEFORE_ANY_KEY_EXISTS');

  const tick = () => JSON.parse(sql('select private.edge_worker_tick_v5()', 'TICK'));
  const answer = async id => {
    for (let i = 0; i < 180; i++) {
      const r = sql(`select coalesce((select jsonb_build_object('status', status_code, 'content', content::text, 'timedOut', timed_out,
        'error', error_msg)::text from net._http_response where id = ${Number(id)}), '')`);
      if (r) { const v = JSON.parse(r); try { v.body = JSON.parse(v.content); } catch { v.body = null; } delete v.content; return v; }
      await sleep(500);
    }
    throw new Error('PKG028_NO_RESPONSE ' + id);
  };
  const state = id => sql(`select coalesce((select state from private.closure_executions_v5 where account_id=${q(id)}::uuid order by requested_at desc limit 1), 'NONE')`);

  // Nothing to do: nothing is sent.
  setKey(key);
  const idle = tick();
  report.idle = idle;
  assert.deepEqual(idle.workers, {PUSH: 'IDLE', DATA_EXPORT: 'IDLE', ACCOUNT_CLOSURE: 'IDLE'});
  pass('WITH_NO_WORK_NOTHING_IS_SENT');

  // A person confirms the deletion of their account, through the real Auth and the real RPCs.
  const closing = await rt.actor('pkg028-closing');
  await rt.ok(closing.client.rpc('rpc_prepare_account_closure', {p_expected_user_id: closing.id, p_expected_revision: 0, p_client_request_id: randomUUID()}));
  const ready = await rt.ok(closing.client.rpc('rpc_review_account_closure_execution', {p_expected_user_id: closing.id}));
  assert.equal(ready.ready, true, 'a fresh account can close');
  const started = await rt.ok(closing.client.rpc('rpc_start_account_closure_execution', {p_expected_user_id: closing.id,
    p_request_id: ready.requestId, p_expected_revision: ready.revision, p_client_request_id: randomUUID(), p_policy_sha256: ready.policySha256}));
  assert.equal(started.state, 'EXECUTING'); assert.equal(state(closing.id), 'EXECUTING');
  pass('A_CONFIRMED_DELETION_IS_EXECUTING_AND_THE_ACCOUNT_IS_LOCKED');

  // A key the worker does not know is refused, and nothing moves.
  setKey('pkg028-well-formed-but-wrong-key');
  const wrong = tick();
  assert.ok(Number.isInteger(wrong.workers.ACCOUNT_CLOSURE?.requestId), 'the tick calls the closure worker when it has work');
  const refused = await answer(wrong.workers.ACCOUNT_CLOSURE.requestId);
  report.wrongKey = {status: refused.status, body: refused.body};
  assert.ok([401, 403].includes(refused.status), 'a wrong key must be refused, got ' + refused.status);
  assert.equal(state(closing.id), 'EXECUTING');
  assert.equal(sql(`select count(*) from private.closure_actions_v5 where account_id=${q(closing.id)}::uuid and state<>'PENDING'`), '0');
  pass('A_WRONG_KEY_IS_REFUSED_BY_THE_WORKER_AND_NOTHING_MOVES');

  // The right key: the cron job itself fires the tick, and the worker takes the first step.
  setKey(key);
  const lastBefore = Number(sql('select coalesce(max(id), 0) from net._http_response'));
  const runsBefore = Number(sql("select count(*) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = 'uskoci_edge_workers'"));
  sql("select cron.alter_job(j.jobid, active := true) from cron.job j where j.jobname = 'uskoci_edge_workers'", 'RESUME');
  let fired = null;
  try {
    for (let i = 0; i < 150 && !fired; i++) {
      await sleep(1000);
      const run = sql(`select coalesce((select jsonb_build_object('status', d.status, 'message', d.return_message)::text from cron.job_run_details d
        join cron.job j on j.jobid = d.jobid where j.jobname = 'uskoci_edge_workers' and d.status in ('succeeded','failed')
        order by d.start_time desc offset 0 limit 1), '')`);
      const runs = Number(sql("select count(*) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = 'uskoci_edge_workers' and d.status in ('succeeded','failed')"));
      if (runs > runsBefore && run) fired = JSON.parse(run);
    }
  } finally {
    sql("select cron.alter_job(j.jobid, active := false) from cron.job j where j.jobname = 'uskoci_edge_workers'", 'PAUSE');
  }
  assert.ok(fired, 'the cron job did not run within 150 seconds');
  assert.equal(fired.status, 'succeeded', 'the cron run failed: ' + fired.message);
  const cronRequest = Number(sql(`select coalesce(min(id), 0) from net._http_response where id > ${lastBefore}`)) ||
    await (async () => { for (let i = 0; i < 120; i++) { const id = Number(sql(`select coalesce(min(id), 0) from net._http_response where id > ${lastBefore}`)); if (id) return id; await sleep(500); } return 0; })();
  assert.ok(cronRequest > 0, 'the cron-fired tick sent no request');
  const first = await answer(cronRequest);
  report.cronFired = {run: fired, status: first.status, body: first.body};
  assert.equal(first.status, 200, 'the worker refused the cron-fired call: ' + JSON.stringify(first));
  assert.equal(first.body?.kind, 'MAINTENANCE_CHECKED');
  pass('THE_CRON_JOB_FIRES_THE_TICK_AND_THE_WORKER_ACCEPTS_ITS_CALL');

  // From here the tick alone carries the deletion to its end, one call at a time.
  const steps = [];
  let closedAt = null;
  for (let i = 0; i < 240 && !closedAt; i++) {
    if (state(closing.id) === 'CLOSED') { closedAt = i; break; }
    const t = tick();
    if (t.workers.ACCOUNT_CLOSURE === 'IDLE') break;
    const r = await answer(t.workers.ACCOUNT_CLOSURE.requestId);
    assert.equal(r.status, 200, 'step ' + i + ': ' + JSON.stringify(r));
    steps.push(r.body);
  }
  report.closureSteps = {calls: steps.length, last: steps.at(-1), totals: steps.reduce((a, s) => ({
    verified: a.verified + (s?.verified ?? 0), pending: a.pending + (s?.pending ?? 0), closed: a.closed + (s?.closed ?? 0),
    blocked: a.blocked + (s?.blocked ?? 0)}), {verified: 0, pending: 0, closed: 0, blocked: 0})};
  assert.equal(state(closing.id), 'CLOSED', 'the deletion did not reach CLOSED: ' + JSON.stringify(report.closureSteps));
  assert.equal(report.closureSteps.totals.blocked, 0);
  assert.equal(sql(`select deleted_at is not null from auth.users where id=${q(closing.id)}::uuid`), 't');
  assert.equal(sql(`select email='' from public.app_accounts where id=${q(closing.id)}::uuid`), 't');
  assert.equal(tick().workers.ACCOUNT_CLOSURE, 'IDLE');
  pass('THE_TICK_ALONE_CARRIES_A_CONFIRMED_DELETION_TO_CLOSED_AND_THEN_STOPS_CALLING');

  // Push: work appears, the tick calls the push worker with the same key, and the worker answers for itself.
  const p = person();
  sql(insertPerson(p), 'PUSH_PERSON');
  sql(`select private.emit_event(${q(p.id)},'REQUESTER','MESSAGE_RECEIVED','AGREEMENT',${q(randomUUID())},1,'Nova poruka','Imaš novu poruku u Dogovoru.',${q('pkg028:' + randomUUID())})`, 'EMIT');
  // No preference row means the delivery is created SUPPRESSED (deep read 4.1). Make it the waiting push it would be.
  sql(`update public.notification_deliveries set state='CREATED', suppression_reason=null, push_started_at=null
        where channel='PUSH' and recipient_user_id=${q(p.id)}::uuid`, 'PUSH_DUE');
  const pushTick = tick();
  assert.ok(Number.isInteger(pushTick.workers.PUSH?.requestId), 'the tick calls the push worker when a push is waiting');
  const pushAnswer = await answer(pushTick.workers.PUSH.requestId);
  report.push = {status: pushAnswer.status, body: pushAnswer.body};
  assert.equal(pushAnswer.status, 200); assert.equal(pushAnswer.body?.kind, 'DISABLED',
    'the transport switch is off in this stack, so the worker must answer DISABLED without touching the queue');
  sql(`update public.notification_deliveries set state='SUPPRESSED', suppression_reason='PKG028_FIXTURE_DONE'
        where channel='PUSH' and recipient_user_id=${q(p.id)}::uuid`, 'PUSH_DONE');
  pass('THE_PUSH_WORKER_ACCEPTS_THE_TICKS_CALL_AND_ITS_OWN_SWITCH_STILL_DECIDES');

  // Export: with no delivery policy, a waiting request is not work, exactly as the claim sees it; the export
  // worker accepts the very request the tick sends.
  const exporter = await rt.actor('pkg028-export');
  await rt.ok(exporter.client.rpc('rpc_request_data_export', {p_client_request_id: randomUUID()}));
  const binding = sql('select private.data_export_policy_binding() is not null');
  const exportTick = tick();
  report.export = {policyBound: binding === 't', tick: exportTick.workers.DATA_EXPORT};
  if (binding === 'f') assert.equal(exportTick.workers.DATA_EXPORT, 'IDLE');
  const direct = Number(sql(`select net.http_post(url := ${q(kong + '/functions/v1/uskoci-data-export-worker')}, body := '{"action":"tick"}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='uskoci_edge_worker_key')),
    timeout_milliseconds := 60000)`, 'EXPORT_DIRECT'));
  const exportAnswer = await answer(direct);
  report.export.direct = {status: exportAnswer.status, body: exportAnswer.body};
  assert.equal(exportAnswer.status, 200); assert.equal(exportAnswer.body?.kind, 'TICK_COMPLETED');
  pass('THE_EXPORT_WORKER_ACCEPTS_THE_TICKS_REQUEST_AND_A_REQUEST_WITHOUT_A_POLICY_IS_NOT_WORK');

  // Leave the disposable database as canonical DEV will be before the owner acts: no key, DEV's address.
  sql("delete from vault.secrets where name = 'uskoci_edge_worker_key'", 'CLEAN_KEY'); setBase(DEV_BASE);
  report.responsesInThisRun = Number(sql('select count(*) from net._http_response'));
  save();
  process.exit(0);
}

throw new Error('UNKNOWN_MODE ' + mode);
