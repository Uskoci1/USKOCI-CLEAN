// PKG-029 proof. Disposable local Postgres only; it refuses any other target and holds no hosted secret.
//
//   replay  after pkg027's and pkg028's replays (the workflow runs them first): the two PKG-028 rows from the exact
//           text canonical DEV recorded, until every function PKG-029 patches has its canonical DEV body
//   before  every defect this round fixes is reproduced on the unchanged surface
//   apply   a tampered pin is refused and leaves nothing behind; the five candidates apply; a second application of
//           each is refused; the surface changes by exactly the reviewed functions
//   after   the same scenarios show the fixed behaviour, and what must not change did not
//
// Every scenario builds its synthetic rows with triggers off (session_replication_role = replica), turns them on
// again, calls the real functions, and is rolled back.
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
const fail = (label, e) => { const error = new Error(label + ': ' + String(e.stderr ?? e.message).slice(-3000)); error.stderr = String(e.stderr ?? ''); return error; };
const sql = (text, label = 'SQL') => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
      {input: text, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']}).trim();
  } catch (e) { throw fail(label, e); }
};
const psqlFile = path => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', path],
      {encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) { throw fail(path, e); }
};
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8'), 'SURFACE').split('\n').filter(Boolean);
const report = JSON.parse(existsSync(`${out}/pkg029-report.json`) ? readFileSync(`${out}/pkg029-report.json`, 'utf8') :
  JSON.stringify({package: 'PKG-029', sourceSha: process.env.GITHUB_SHA, disposableDbOnly: true, canonicalDevAccess: false,
    providerCalls: false, deviceTest: false, checks: []}));
const pass = name => { report.checks.push({mode, name, result: 'PASS'}); console.log('PASS ' + name); };
const save = () => writeFileSync(`${out}/pkg029-report.json`, JSON.stringify(report, null, 1) + '\n');
const closure = () => JSON.parse(sql(`select jsonb_build_object('live', private.closure_source_digest_v5(),
  'certified', (select sha256 from private.closure_source_v5 where singleton), 'ready', private.retention_ai_source_ready())`));
const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`);

const CANDIDATES = {pkg029a_notifications_reach: 'PKG029A', pkg029b_lifecycle_truth: 'PKG029B',
  pkg029c_questions_while_recruiting: 'PKG029C', pkg029d_export_honest: 'PKG029D', pkg029e_owner_in_test_world: 'PKG029E'};
// The two PKG-028 rows canonical DEV recorded on 2026-09-21 (receipt 20260921_pkg028_application.receipt.json).
const PKG028 = [['pkg028a_edge_workers_scheduled', '385dbd8ec32ad3219c138ee961e6a4f53e9582aee9f2c9de143c7592b3ed285a'],
  ['pkg028b_past_tasks_close', 'e695991bac01ca558629705061e1b3f18ce99789d8442d3befa270ef2d457371']];
// md5(prosrc) on canonical DEV, 2026-09-21, after PKG-028: every function PKG-029 patches.
const DEV_BODIES = {
  'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)': '15f77e4ba4aec29a0df69a50b17409d2',
  'public.rpc_tick_auto_completion()': '14562ad2e73df556242e6cb5f94566cb',
  'public.rpc_close_remaining_search(uuid,integer,text,text)': 'b3eed19d2bae33d81930116b604c6625',
  'private.sync_need_completion(uuid)': '22caab9e84bb10d7d2d8097c856579c6',
  'public.rpc_list_my_applications()': '6ce809c2939714451e60876ab3885115',
  'public.rpc_select_response(uuid,integer,uuid,integer,text,text)': '4178f4f158489beb3dec8b4a5cacdb0f',
  'private.expire_lifecycle(timestamptz)': '10da80e8677d3e806fbdb6c7444f3931',
  'public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text)': '83f4220f2b8f4ec8bea2e4a55cd6d676',
  'public.rpc_read_preselection_qa_context(uuid,uuid)': '2bebe4c512fe0587d3b31093131bdd74',
  'public.rpc_ru4b_answer_preselection_question(uuid,text,uuid)': 'fad7e68181d15eed98ab977bd5900dfb',
  'public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid)': 'b28bc16c63153ea8fa53a7f0c905a26a',
  'public.rpc_ru4b_public_preselection_qa(uuid)': '1936e78e5390c13697849a801b5fe4e7',
  'private.ru4b_public_floor_reason(text)': '51ae92967178a41216ccb74c1ec138d3',
  'public.rpc_request_data_export(text)': '551e16c2f8a4e364ff32bc21f337ad60',
  'private.account_visibility_world(uuid)': 'f36a06ce91215655644f277d3ffa357a',
};
const PATCHED = Object.keys(DEV_BODIES).map(s => s.replace(/\(.*$/, ''));
const ADDED = ['private.relative_schedule_end_v5'];

// ---------------------------------------------------------------------------------------------------------
if (mode === 'replay') {
  for (const [name, sha] of PKG028) {
    const path = `supabase/candidates/${name}.sql`, bytes = readFileSync(path, 'utf8');
    assert.equal(sha256(bytes.replace(/\n$/, '')), sha, 'NOT_THE_TEXT_CANONICAL_DEV_RECORDED ' + name);
    psqlFile(path);
    // The worker tick is live in this database too; it has no key here, but the proof decides when anything runs.
    if (name === 'pkg028a_edge_workers_scheduled') sql("select cron.alter_job(j.jobid, active := false) from cron.job j where j.jobname = 'uskoci_edge_workers'");
  }
  pass('THE_TWO_PKG028_ROWS_REPLAYED_FROM_THE_EXACT_TEXT_CANONICAL_DEV_RECORDED');
  const differing = Object.entries(DEV_BODIES).filter(([signature, md5]) => bodyMd5(signature) !== md5)
    .map(([signature, md5]) => ({signature, onCanonicalDev: md5, inReplay: bodyMd5(signature)}));
  report.bodiesThatDifferFromCanonicalDev = differing;
  assert.deepEqual(differing, [], 'REPLAY_IS_NOT_CANONICAL_DEV ' + JSON.stringify(differing));
  pass('EVERY_FUNCTION_PKG029_PATCHES_HAS_THE_CANONICAL_DEV_BODY');
  const c = closure(); assert.equal(c.ready, true); assert.equal(c.live, c.certified); report.closureAfterReplay = c;
  pass('THE_CLOSURE_SOURCE_IS_CERTIFIED_AND_READY_AS_ON_CANONICAL_DEV');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// synthetic rows
// ---------------------------------------------------------------------------------------------------------
const party = () => ({id: randomUUID(), requester: randomUUID(), worker: randomUUID()});
const insertParty = p => `insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,available_now)
    values(${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',false),
          (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad','ACTIVE','{ciscenje}',false);`;
const need = (id, owner, {status = 'PUBLISHED', slots = 1, kind = 'FLEXIBLE', published = "statement_timestamp()-interval '1 day'",
  closed = 'null', tz = "'Europe/Belgrade'"} = {}) => `insert into public.needs(id,requester_account_id,requester_profile_id,status,title,
    description,category,approximate_city,approximate_area,mode,required_slots,schedule_kind,published_at,remaining_search_closed_at,task_timezone)
  values(${q(id)},${q(owner.id)},${q(owner.requester)},${q(status)},'PKG-029 fixture','Disposable SQL fixture','PROOF','Novi Sad','Liman',
    'OFFERS',${slots},${q(kind)},${published},${closed},${tz});`;
const response = (id, needId, worker, status) => `insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,
    response_kind,status,submitted_against_need_revision,price_rsd,covered_slots)
  values(${q(id)},${q(needId)},${q(worker.id)},${q(worker.worker)},'APPLICATION',${q(status)},1,3000,1);`;
const selection = (id, needId, owner, worker, responseId) => `insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,
    client_request_id,covered_slots,status,response_id,worker_account_id,worker_profile_id)
  values(${q(id)},${q(needId)},1,${q(owner.id)},${q('pkg029-sel-' + id)},1,'SELECTED',${q(responseId)},${q(worker.id)},${q(worker.worker)});`;
const agreement = (id, needId, selectionId, responseId, owner, worker, status) => `insert into public.agreements(id,need_id,selection_id,
    selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,status,current_version)
  values(${q(id)},${q(needId)},${q(selectionId)},${q(responseId)},${q(owner.id)},${q(owner.requester)},${q(worker.id)},${q(worker.worker)},${q(status)},1);
  -- The worker calendar projection reads the Agreement's current version; every real Agreement has one.
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
  values(${q(id)},1,'CONFIRMED',jsonb_build_object('price_rsd',3000,'covered_slots',1,'need_revision',1,'response_version',1,
    'scope_note','','proposed_start_at',null,'proposed_end_at',null),md5(${q(id)}),${q(owner.id)});`;
const asPerson = id => `set local role authenticated;
  set local request.jwt.claim.sub = ${q(id)}; set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claims = ${q(JSON.stringify({sub: id, role: 'authenticated'}))};`;
const asPostgres = `reset role; set local request.jwt.claim.sub = ''; set local request.jwt.claim.role = ''; set local request.jwt.claims = '';`;
const scenario = (label, fixtures, body) => JSON.parse(sql(`begin;
  set local statement_timeout = '120s';
  create temporary table pkg029_obs(k text primary key, v jsonb) on commit drop;
  grant all on pkg029_obs to authenticated;
  set local session_replication_role = replica;
  ${fixtures}
  set local session_replication_role = origin;
  ${body}
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from pkg029_obs;
  rollback;`, label).split(/\r?\n/).pop());
const catching = (key, statement) => `do $c$ begin ${statement}; exception when others then insert into pkg029_obs values (${q(key)}, to_jsonb(sqlerrm)); end $c$;`;

function scenarios() {
  const o = {};
  // S1 (4.1) push on as a worker, an event as a requester; and a person with no preference row at all.
  {
    const p = party(), none = party();
    o.push = scenario('PUSH', `${insertParty(p)}${insertParty(none)}
      insert into public.notification_preferences(user_id,role_context,push_enabled) values(${q(p.id)},'WORKER',true);`, `
      select private.emit_event(${q(p.id)},'REQUESTER','MESSAGE_RECEIVED','AGREEMENT',${q(randomUUID())},1,'Nova poruka','Imaš novu poruku u Dogovoru.',${q('pkg029:' + randomUUID())});
      select private.emit_event(${q(none.id)},'REQUESTER','MESSAGE_RECEIVED','AGREEMENT',${q(randomUUID())},1,'Nova poruka','Imaš novu poruku u Dogovoru.',${q('pkg029:' + randomUUID())});
      insert into pkg029_obs select 'withWorkerPush', jsonb_build_object('state', state, 'reason', suppression_reason)
        from public.notification_deliveries where recipient_user_id=${q(p.id)} and channel='PUSH';
      insert into pkg029_obs select 'noRowAtAll', jsonb_build_object('state', state, 'reason', suppression_reason)
        from public.notification_deliveries where recipient_user_id=${q(none.id)} and channel='PUSH';`);
  }
  // S2 (1.2) an Agreement whose requester deadline has passed; the tick completes it.
  {
    const r = party(), w = party(), n = randomUUID(), resp = randomUUID(), sel = randomUUID(), a = randomUUID();
    o.autoComplete = scenario('AUTO_COMPLETE', `${insertParty(r)}${insertParty(w)}${need(n, r, {status: 'ACTIVE'})}
      ${response(resp, n, w, 'SELECTED')}${selection(sel, n, r, w, resp)}${agreement(a, n, sel, resp, r, w, 'CONFIRMED')}
      insert into public.agreement_execution(agreement_id,agreement_version,state,requester_deadline_at,mode)
        values(${q(a)},1,'AWAITING_REQUESTER',statement_timestamp()-interval '1 hour','PHYSICAL');`, `
      select public.rpc_tick_auto_completion();
      insert into pkg029_obs values ('agreement', to_jsonb((select status from public.agreements where id=${q(a)})));
      insert into pkg029_obs values ('need', to_jsonb((select status from public.needs where id=${q(n)})));
      insert into pkg029_obs values ('workerTold', to_jsonb((select count(*) from public.notification_deliveries
        where recipient_user_id=${q(w.id)} and channel='IN_APP' and title='Dogovor je završen')));`);
  }
  // S3 (12.9) close the remaining search of a two-person task with one chosen and one other applicant waiting.
  {
    const r = party(), w1 = party(), w2 = party(), n = randomUUID(), r1 = randomUUID(), r2 = randomUUID(), sel = randomUUID(), a = randomUUID();
    o.closeSearch = scenario('CLOSE_SEARCH', `${insertParty(r)}${insertParty(w1)}${insertParty(w2)}${need(n, r, {status: 'SELECTION', slots: 2})}
      ${response(r1, n, w1, 'SELECTED')}${response(r2, n, w2, 'SUBMITTED')}${selection(sel, n, r, w1, r1)}${agreement(a, n, sel, r1, r, w1, 'CONFIRMED')}`, `
      ${asPerson(r.id)}
      ${catching('closeError', `perform public.rpc_close_remaining_search(${q(n)}, 1, ${q('pkg029-close-' + n)}, '')`)}
      ${asPostgres}
      insert into pkg029_obs values ('otherApplication', to_jsonb((select status from public.marketplace_responses where id=${q(r2)})));
      insert into pkg029_obs values ('applicantTold', to_jsonb((select count(*) from public.notification_deliveries
        where recipient_user_id=${q(w2.id)} and channel='IN_APP' and title='Potraga je zatvorena')));`);
  }
  // S4 (1.1) a closed search whose one chosen person has completed.
  {
    const r = party(), w = party(), n = randomUUID(), resp = randomUUID(), sel = randomUUID(), a = randomUUID();
    o.completion = scenario('COMPLETION', `${insertParty(r)}${insertParty(w)}
      ${need(n, r, {status: 'SELECTION', slots: 2, closed: "statement_timestamp()-interval '1 hour'"})}
      ${response(resp, n, w, 'SELECTED')}${selection(sel, n, r, w, resp)}${agreement(a, n, sel, resp, r, w, 'COMPLETED')}`, `
      insert into pkg029_obs values ('completed', to_jsonb(private.sync_need_completion(${q(n)})));
      insert into pkg029_obs values ('need', to_jsonb((select status from public.needs where id=${q(n)})));`);
    // The same without a closed search must still wait for the second person.
    const n2 = randomUUID(), resp2 = randomUUID(), sel2 = randomUUID(), a2 = randomUUID();
    o.completionOpen = scenario('COMPLETION_OPEN', `${insertParty(r)}${insertParty(w)}${need(n2, r, {status: 'SELECTION', slots: 2})}
      ${response(resp2, n2, w, 'SELECTED')}${selection(sel2, n2, r, w, resp2)}${agreement(a2, n2, sel2, resp2, r, w, 'COMPLETED')}`, `
      insert into pkg029_obs values ('completed', to_jsonb(private.sync_need_completion(${q(n2)})));`);
  }
  // S5 (7.49) a worker's application whose Agreement was cancelled.
  {
    const r = party(), w = party(), n = randomUUID(), resp = randomUUID(), sel = randomUUID(), a = randomUUID();
    o.myApplications = scenario('MY_APPLICATIONS', `${insertParty(r)}${insertParty(w)}${need(n, r, {status: 'PUBLISHED'})}
      ${response(resp, n, w, 'NOT_SELECTED')}${selection(sel, n, r, w, resp)}${agreement(a, n, sel, resp, r, w, 'CANCELLED')}`, `
      ${asPerson(w.id)}
      insert into pkg029_obs values ('state', to_jsonb(jsonb_path_query_first(public.rpc_list_my_applications(),
        '$.** ? (@.applicationId == $id)', jsonb_build_object('id', ${q(resp)}))->>'state'));
      ${asPostgres}`);
  }
  // S6 (relative schedules) "danas" from two days ago, "danas" from now, "ove nedelje" from two days ago.
  {
    const r = party(), old = randomUUID(), fresh = randomUUID(), week = randomUUID();
    o.relative = scenario('RELATIVE', `${insertParty(r)}
      ${need(old, r, {kind: 'TODAY_FLEXIBLE', published: "statement_timestamp()-interval '2 days'"})}
      ${need(fresh, r, {kind: 'TODAY_FLEXIBLE', published: 'statement_timestamp()'})}
      ${need(week, r, {kind: 'WEEK_FLEXIBLE', published: "statement_timestamp()-interval '2 days'"})}`, `
      select private.expire_lifecycle(statement_timestamp());
      insert into pkg029_obs select case id when ${q(old)} then 'todayOld' when ${q(fresh)} then 'todayFresh' else 'weekOld' end, to_jsonb(status)
        from public.needs where id in (${q(old)},${q(fresh)},${q(week)});`);
  }
  // S7 (7.47) a worker opens the questions of a task still recruiting with one person chosen.
  {
    const r = party(), w = party(), n = randomUUID();
    o.questions = scenario('QUESTIONS', `${insertParty(r)}${insertParty(w)}${need(n, r, {status: 'SELECTION', slots: 2})}`, `
      ${asPerson(w.id)}
      do $c$ begin perform public.rpc_read_preselection_qa_context(${q(w.id)}, ${q(n)}); insert into pkg029_obs values ('read', '"OPEN"');
        exception when others then insert into pkg029_obs values ('read', to_jsonb(sqlerrm)); end $c$;
      ${asPostgres}`);
  }
  // S8 (12.5) the contact filter.
  o.phone = JSON.parse(sql(`select jsonb_build_object(
    'date', private.ru4b_public_floor_reason('Da li može 12.10.2026 posle podne?'),
    'range', private.ru4b_public_floor_reason('Cena 15000 - 20000 je ok?'),
    'phone', private.ru4b_public_floor_reason('Zovi me na 064 123 4567'),
    'intl', private.ru4b_public_floor_reason('Broj: +381 64 123 45 67'))`));
  // S9 (6.2) a person asks for an export while no delivery policy exists.
  {
    const x = party();
    o.exportRequest = scenario('EXPORT', `${insertParty(x)}`, `
      insert into pkg029_obs values ('policyBound', to_jsonb(private.data_export_policy_binding() is not null));
      ${asPerson(x.id)}
      do $c$ declare r jsonb; begin r := public.rpc_request_data_export(${q('pkg029-export-' + x.id.slice(0, 18))});
        insert into pkg029_obs values ('request', to_jsonb(r->>'status'));
        exception when others then insert into pkg029_obs values ('request', to_jsonb(sqlerrm)); end $c$;
      ${asPostgres}`);
  }
  // S10 (12.11) worlds.
  {
    const owner = party(), fixture = party(), real = party();
    const lineage = (p, l) => `insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values(${q(p.id)},${q(l)},'PKG-029 proof','pkg029-proof');`;
    o.worlds = scenario('WORLDS', `${insertParty(owner)}${insertParty(fixture)}${insertParty(real)}
      ${lineage(owner, 'OWNER_PERSONAL')}${lineage(fixture, 'SYNTHETIC_ACCEPTANCE_FIXTURE')}${lineage(real, 'REAL_USER')}`, `
      insert into pkg029_obs values ('ownerWithFixture', to_jsonb(private.accounts_same_world(${q(owner.id)}, ${q(fixture.id)})));
      insert into pkg029_obs values ('realWithFixture', to_jsonb(private.accounts_same_world(${q(real.id)}, ${q(fixture.id)})));
      insert into pkg029_obs values ('ownerWithReal', to_jsonb(private.accounts_same_world(${q(owner.id)}, ${q(real.id)})));`);
  }
  return o;
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'before') {
  const s = scenarios(); report.before = s;
  assert.deepEqual(s.push.withWorkerPush, {state: 'SUPPRESSED', reason: 'PUSH_OFF'}, 'DEFECT_NOT_REPRODUCED 4.1');
  pass('4_1_PUSH_ON_AS_A_WORKER_IS_OFF_FOR_EVERY_REQUESTER_EVENT');
  assert.equal(s.autoComplete.agreement, 'COMPLETED'); assert.equal(s.autoComplete.workerTold, 0, 'DEFECT_NOT_REPRODUCED 1.2');
  pass('1_2_AUTO_COMPLETION_TELLS_THE_WORKER_NOTHING');
  assert.equal(s.closeSearch.otherApplication, 'EXPIRED', JSON.stringify(s.closeSearch)); assert.equal(s.closeSearch.applicantTold, 0, 'DEFECT_NOT_REPRODUCED 12.9');
  pass('12_9_CLOSING_THE_SEARCH_TELLS_NO_APPLICANT');
  assert.equal(s.completion.completed, false); assert.equal(s.completion.need, 'SELECTION', 'DEFECT_NOT_REPRODUCED 1.1');
  pass('1_1_A_TASK_WHOSE_SEARCH_WAS_CLOSED_NEVER_COMPLETES');
  assert.equal(s.myApplications.state, 'SELECTED', 'DEFECT_NOT_REPRODUCED 7.49');
  pass('7_49_A_CANCELLED_AGREEMENT_LEAVES_THE_APPLICATION_SELECTED');
  assert.equal(s.relative.todayOld, 'PUBLISHED', 'DEFECT_NOT_REPRODUCED relative');
  pass('A_DANAS_TASK_FROM_TWO_DAYS_AGO_IS_STILL_OPEN');
  assert.equal(s.questions.read, 'NEED_NOT_FOUND', 'DEFECT_NOT_REPRODUCED 7.47');
  pass('7_47_QUESTIONS_ARE_CLOSED_WHILE_THE_TASK_IS_STILL_RECRUITING');
  assert.equal(s.phone.date, 'PHONE_NOT_PUBLIC'); assert.equal(s.phone.range, 'PHONE_NOT_PUBLIC');
  pass('12_5_A_DATE_AND_A_PRICE_RANGE_ARE_REFUSED_AS_PHONE_NUMBERS');
  assert.equal(s.exportRequest.policyBound, false); assert.equal(s.exportRequest.request, 'REQUESTED', 'DEFECT_NOT_REPRODUCED 6.2');
  pass('6_2_AN_EXPORT_NOTHING_CAN_DELIVER_IS_ACCEPTED');
  assert.equal(s.worlds.ownerWithFixture, false, 'DEFECT_NOT_REPRODUCED 12.11');
  pass('12_11_THE_OWNER_AND_THE_TEST_WORKERS_NEVER_SEE_EACH_OTHER');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
const refuses = (name, code, path = `supabase/candidates/${name}.sql`) => {
  let failure = null;
  try { psqlFile(path); } catch (e) { failure = e; }
  assert.ok(failure, `${name} applied where it must refuse (${code})`);
  assert.ok(failure.stderr.includes(code), `${name}: expected ${code}, got ${failure.stderr.slice(-600)}`);
};
const changed = line => line.split(':').slice(0, 2).join(':').replace(/\(.*$/, '');

if (mode === 'apply') {
  const before = surface(), closureBefore = closure();
  writeFileSync(`${out}/pkg029-surface-before.txt`, before.join('\n') + '\n');
  const tampered = `${out}/pkg029a_notifications_reach.tampered.sql`;
  writeFileSync(tampered, readFileSync('supabase/candidates/pkg029a_notifications_reach.sql', 'utf8')
    .replace("'14562ad2e73df556242e6cb5f94566cb'", "'00000000000000000000000000000000'"));
  refuses('pkg029a (tampered)', 'PKG029A_PREDECESSOR_DRIFT', tampered);
  assert.deepEqual(surface(), before, 'A_REFUSED_CANDIDATE_LEFT_SOMETHING_BEHIND');
  pass('A_TAMPERED_PIN_IS_REFUSED_AND_LEAVES_NOTHING_BEHIND');
  for (const name of Object.keys(CANDIDATES)) psqlFile(`supabase/candidates/${name}.sql`);
  pass('ALL_FIVE_CANDIDATES_APPLY');
  for (const [name, code] of Object.entries(CANDIDATES)) refuses(name, code + '_ALREADY_APPLIED');
  pass('A_SECOND_APPLICATION_OF_EACH_IS_REFUSED');
  const after = surface();
  writeFileSync(`${out}/pkg029-surface-after.txt`, after.join('\n') + '\n');
  const removed = before.filter(l => !after.includes(l)), added = after.filter(l => !before.includes(l));
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  assert.deepEqual(removed.map(changed).sort(), PATCHED.map(n => 'function:' + n).sort());
  assert.deepEqual(added.map(changed).sort(), [...PATCHED, ...ADDED].map(n => 'function:' + n).sort());
  pass('THE_SURFACE_CHANGES_BY_EXACTLY_THE_FIFTEEN_PATCHED_AND_ONE_NEW_FUNCTION');
  const c = closure();
  assert.equal(c.live, closureBefore.live); assert.equal(c.live, c.certified); assert.equal(c.ready, true);
  report.closure = c;
  pass('THE_CERTIFIED_CLOSURE_SOURCE_DID_NOT_MOVE');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'after') {
  const s = scenarios(); report.after = s;
  assert.notEqual(s.push.withWorkerPush.reason, 'PUSH_OFF', JSON.stringify(s.push));
  assert.deepEqual(s.push.noRowAtAll, {state: 'SUPPRESSED', reason: 'PUSH_OFF'}, 'a person who never chose keeps push off');
  pass('4_1_A_ROLE_WITHOUT_ITS_OWN_ROW_TAKES_THE_OTHER_ROLES_PUSH_CHOICE_AND_NOBODY_ELSE_CHANGES');
  assert.equal(s.autoComplete.agreement, 'COMPLETED'); assert.equal(s.autoComplete.workerTold, 1);
  pass('1_2_AUTO_COMPLETION_TELLS_THE_WORKER_ONCE');
  assert.equal(s.closeSearch.otherApplication, 'EXPIRED'); assert.equal(s.closeSearch.applicantTold, 1);
  assert.equal(s.closeSearch.closeError, undefined, JSON.stringify(s.closeSearch));
  pass('12_9_CLOSING_THE_SEARCH_TELLS_EACH_WAITING_APPLICANT');
  assert.equal(s.completion.completed, true); assert.equal(s.completion.need, 'COMPLETED');
  assert.equal(s.completionOpen.completed, false, 'an open search still waits for every place');
  pass('1_1_A_CLOSED_SEARCH_COMPLETES_WHEN_EVERY_CHOSEN_PERSON_HAS_AND_AN_OPEN_ONE_STILL_WAITS');
  assert.notEqual(s.myApplications.state, 'SELECTED'); assert.ok(s.myApplications.state, JSON.stringify(s.myApplications));
  pass('7_49_A_CANCELLED_AGREEMENT_NO_LONGER_LEAVES_THE_APPLICATION_SELECTED');
  assert.equal(s.relative.todayOld, 'EXPIRED'); assert.equal(s.relative.todayFresh, 'PUBLISHED'); assert.equal(s.relative.weekOld, 'PUBLISHED');
  pass('DANAS_ENDS_WITH_ITS_DAY_AND_OVE_NEDELJE_WITH_ITS_SEVEN');
  assert.equal(s.questions.read, 'OPEN', JSON.stringify(s.questions));
  pass('7_47_QUESTIONS_ARE_OPEN_WHILE_THE_TASK_IS_RECRUITING');
  assert.equal(s.phone.date, null); assert.equal(s.phone.range, null);
  assert.equal(s.phone.phone, 'PHONE_NOT_PUBLIC'); assert.equal(s.phone.intl, 'PHONE_NOT_PUBLIC');
  pass('12_5_DATES_AND_PRICE_RANGES_PASS_AND_PHONE_NUMBERS_ARE_STILL_REFUSED');
  assert.equal(s.exportRequest.request, 'DATA_EXPORT_POLICY_NOT_READY');
  pass('6_2_AN_EXPORT_NOTHING_CAN_DELIVER_IS_REFUSED_HONESTLY');
  assert.equal(s.worlds.ownerWithFixture, true); assert.equal(s.worlds.realWithFixture, false);
  pass('12_11_THE_OWNER_SHARES_THE_TEST_WORLD_AND_A_REAL_PERSON_STILL_DOES_NOT');
  // 12.7 is a one-expression change inside rpc_select_response; the candidate proves the exact body.
  assert.ok(sql("select prosrc from pg_proc where oid='public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure")
    .includes("coalesce(v_need.execution_location_mode = 'REMOTE', v_need.schedule_kind = 'REMOTE_ANYTIME')"));
  pass('12_7_REMOTE_OR_PHYSICAL_FOLLOWS_THE_PLACE');
  save(); process.exit(0);
}

throw new Error('UNKNOWN_MODE ' + mode);
