// PKG-027 proof. Disposable local Postgres only; it refuses any other target and has no hosted secret.
//
//   replay  source-147 (done by the workflow) + every dev_alpha migration of canonical DEV in ledger order,
//           from the exact text DEV recorded, until the fifteen functions the candidates touch have the very
//           bodies canonical DEV has (md5 pinned below, read from DEV on 2026-09-21)
//   seed    committed rows the candidates must rewrite (stored notification texts, invented profile text)
//           and rows they must leave alone
//   before  every defect the owner approved fixing is reproduced on the unchanged surface
//   apply   a tampered pin is refused and leaves nothing behind; the five candidates apply; a second
//           application of each is refused; the surface changes by exactly the reviewed functions
//   after   the same five scenarios now show the fixed behaviour; the seeds were rewritten exactly
//
// Every scenario builds its synthetic rows and runs inside one transaction that is rolled back.
import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
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
const psqlFile = (path, {single = false} = {}) => {
  try {
    return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...(single ? ['-1'] : []), '-f', path],
      {encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) { throw fail(path, e); }
};
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8'), 'SURFACE').split('\n').filter(Boolean);
const report = JSON.parse(existsSync(`${out}/pkg027-report.json`) ? readFileSync(`${out}/pkg027-report.json`, 'utf8') :
  JSON.stringify({package: 'PKG-027', sourceSha: process.env.GITHUB_SHA, disposableDbOnly: true, canonicalDevAccess: false,
    providerCalls: false, deviceTest: false, checks: []}));
const pass = name => { report.checks.push({mode, name, result: 'PASS'}); console.log('PASS ' + name); };
const save = () => writeFileSync(`${out}/pkg027-report.json`, JSON.stringify(report, null, 1) + '\n');

const CANDIDATES = ['pkg027a_dispatch_keeps_looking', 'pkg027b_ai_turn_sweep', 'pkg027c_notification_ti_copy',
  'pkg027d_profile_text_truthful', 'pkg027e_price_basis_survives_edit'];
const CANDIDATE_CODE = {pkg027a_dispatch_keeps_looking: 'PKG027A', pkg027b_ai_turn_sweep: 'PKG027B',
  pkg027c_notification_ti_copy: 'PKG027C', pkg027d_profile_text_truthful: 'PKG027D', pkg027e_price_basis_survives_edit: 'PKG027E'};

// md5(prosrc) of every function the candidates read or patch, on canonical DEV, 2026-09-21.
const DEV_BODIES = {
  'private.dispatch_next_wave(uuid)': '5f434a47486f73d3c107aa92c3ab321c',
  'private.dispatch_tick(integer,timestamptz)': 'd3ef4a0b0b63bcfaffd84547a2ad863b',
  'private.marketplace_tick(integer,timestamptz)': '0e6a850ef048911773266e2ab0b17d0e',
  'public.rpc_save_worker_availability(text,jsonb)': 'be5f8794ed459ead235c81360e3830b1',
  'public.rpc_save_worker_location(text,jsonb,boolean)': '68a448bc7344e64064b9a0babd939b40',
  'public.rpc_save_worker_capacity(text,jsonb)': 'b4e32f1fb9ae7e684ccb28a0cf6d00c7',
  'public.rpc_complete_worker_profile(uuid)': 'b4113385a78dc0ff763516a9dceb7820',
  'public.rpc_abandon_worker_ai(uuid)': '4d0c5201889155bfb3986f4ebc1b92c1',
  'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)': '8da91a4736e09b10872bd1240d6e0c8c',
  'public.rpc_list_inbox(text,integer,timestamptz,uuid)': 'a54e90c2af3e0739d461fb02fb12d7c8',
  'public.handle_uskoci_auth_user_created()': '187aa3a262ce940f39ae7faba720963e',
  'public.rpc_ai_open_need_edit_conversation_v2(uuid)': '767002f0fc70c6277e8d4db64306bab7',
  'private.need_material_snapshot(uuid)': '7838967d0edc8a1ca1a497752efc189d',
  'private.accounts_same_world(uuid,uuid)': '16f541f952d4e1e2dbb4fc87e594d572',
  'private.enqueue_dispatch(uuid,timestamptz)': '470ed6ab6501c69bf9ebbfe057ccd0fb',
};
// The surface lines a correct application may change: exactly these functions, nothing else.
const PATCHED = ['private.dispatch_next_wave', 'private.dispatch_tick', 'public.rpc_save_worker_availability',
  'public.rpc_save_worker_location', 'public.rpc_save_worker_capacity', 'public.rpc_complete_worker_profile',
  'private.marketplace_tick', 'public.rpc_abandon_worker_ai', 'private.emit_event', 'public.rpc_list_inbox',
  'public.handle_uskoci_auth_user_created', 'public.rpc_ai_open_need_edit_conversation_v2', 'private.need_material_snapshot'];
const ADDED = ['private.requeue_open_needs_for_worker_v5', 'private.ai_turn_sweep_v5', 'private.notification_copy_v5'];

// ---------------------------------------------------------------------------------------------------------
// replay
// ---------------------------------------------------------------------------------------------------------
// The exact text canonical DEV recorded for each dev_alpha row (sha256 read from DEV on 2026-09-21). Candidate
// files carry one final newline the ledger text does not; that newline is the only difference allowed.
const LEDGER = [
  // Not replayed, like PKG-023f: data operations on named canonical accounts; they create no object.
  {version: '20260913100016', skip: 'DATA_ON_NAMED_CANONICAL_ACCOUNTS'},
  {version: '20260913130812', skip: 'DATA_ON_NAMED_CANONICAL_ACCOUNTS'},
  {version: '20260917053239', file: 'supabase/operations/dev-alpha/ledger/20260917053239_dev_alpha_pkg015_account_lineage.sql', sha: '44d0d359e9bc620ca89b39521431294698950cb82227fa4a920cbae8c11ba605', single: true},
  {version: '20260917055559', file: 'supabase/operations/dev-alpha/ledger/20260917055559_dev_alpha_pkg014b_ai_provider_usage.sql', sha: 'a0c616a29efbceec3848452ccff7216ed1ba58c8c448ac7918b225e6984f4d99', single: true},
  {version: '20260917104027', file: 'supabase/operations/dev-alpha/ledger/20260917104027_dev_alpha_pkg019_profile_bootstrap_truthful.sql', sha: '2eaf951d497b24489040afac3029341667cfeec77604fc4f3cbfb8504abc74c0', single: true},
  {version: '20260917112919', file: 'supabase/operations/dev-alpha/ledger/20260917112919_dev_alpha_pkg019b_ai_test_reservation_settlement.sql', sha: 'ddb1ae98efee201da3676518c0eb0260c586ccb6e2ba0ed991fe4f27d1b2537b', single: true, fixture: 'pkg019b'},
  {version: '20260917142520', file: 'supabase/operations/dev-alpha/ledger/20260917142520_dev_alpha_pkg019c_failed_reservation_release.sql', sha: 'f2131f46b75f823ee7a4a6a0bc6375de88ed7e0ed56d989618fce8f147f9adcd', single: true, fixture: 'pkg019c'},
  {version: '20260917173759', file: 'supabase/operations/dev-alpha/ledger/20260917173759_dev_alpha_pkg019d_stt_audio_duration_settlement.sql', sha: 'c6f01554dd0251e977f768fb13926fb6fafea10805ba029a9f328ea73d15309b', single: true},
  {version: '20260917181212', file: 'supabase/operations/dev-alpha/ledger/20260917181212_dev_alpha_pkg015b_gap0042_world_boundary.sql', sha: '719d122e389bea302d5e23a1f1053f37f5d45d0de3118152bdf87a47a14a42c0', single: true},
  {version: '20260917230145', file: 'supabase/operations/dev-alpha/ledger/20260917230145_dev_alpha_pkg021_need_timestamp_fact_iso8601.sql', sha: 'b54658a3ccec5c7e9be3034fa658236d61cd3a72814d98683b8ff66e6518abdb', single: true},
  {version: '20260919141813', file: 'supabase/candidates/pkg023a_own_reads_paged.sql', sha: '7e0e518c6839a53dbc41e129b3423fc05b7a23e8a14c0efe5f1ec8064020f0f2'},
  {version: '20260919142333', file: 'supabase/candidates/pkg023b_task_relations.sql', sha: 'a0f7f99fc3c8b16958c244775fe00fc7a5b11eb72ab2013b0f1c42e5e6277560'},
  {version: '20260919142713', file: 'supabase/candidates/pkg023d_marketplace_bounded.sql', sha: 'f7bc5fe3ddfbba0e3a7f8ac6c16485ffafe78fd40c1f418bb1bda3847f346ed4'},
  {version: '20260919164420', file: 'supabase/candidates/pkg023f_closure_recertification.sql', sha: '8f56a1d5ff01f77814287a2f5a2db65bb492eb825e35dcb4247b46cebfac8f6f'},
  {version: '20260919170238', file: 'supabase/candidates/pkg023g_ai_test_service_least_privilege.sql', sha: 'e763611138a47b91db8e8cd02935c080641ba4a35341eef40a0d6361c241e916'},
  {version: '20260919170413', file: 'supabase/candidates/pkg023h_export_settlement_truthful.sql', sha: 'eae4f340d63320c1f9187530a9674599f1f6553188b45e292d31b41925a7f169'},
  {version: '20260919184627', file: 'supabase/candidates/pkg023i_open_tasks_timezone.sql', sha: '3555f03ecbcfa79cb3eee498ad977e320b8cad34a0c78a12b0a2e7f25880ee6e'},
  {version: '20260919221214', file: 'supabase/candidates/pkg023j_home_attention.sql', sha: '7d0cf923c94552f790f72ff16f8be05597e0101245ada4efccee6285a285a9b5'},
  {version: '20260920102238', file: 'supabase/candidates/pkg024a_agreement_profile_ids.sql', sha: '73338bd165d62df273274311080b5c63c8547cc9a6a5fe31f672a6db17f4236c'},
  {version: '20260920174556', file: 'supabase/candidates/pkg025a_price_basis_column.sql', sha: '66509ce4cb73310b59c177710c73ce4dd9fa95336ef87ba6308026c0ce20bb39'},
  {version: '20260920181559', file: 'supabase/candidates/pkg025b_submit_response_by_basis.sql', sha: 'f6d19466ca7fe8ce5083df5f4eb9dd7912b30c8fa66c4a9618c7a42d1124fcaa'},
  {version: '20260920182952', file: 'supabase/operations/dev-alpha/ledger/20260920182952_dev_alpha_pkg026_ai_test_cap_optional.sql', sha: '5c3129e356827887fa1b2a649669bee48372b9386a67649b78d3fa81940acb43'},
  {version: '20260920185624', file: 'supabase/candidates/pkg025c_open_tasks_price_basis.sql', sha: 'a7860a7b8b59d29021eb02e81a7563abe2da98ece50c4f0f04e2b15a5c80ed5d'},
  {version: '20260920214430', file: 'supabase/candidates/pkg025d_price_basis_fact.sql', sha: '6b1d64f82d5bcc868c7b774f71a82ec6a60a5da9d3f67cbcd9bd2b6093c87e47'},
];

function fixture(name) {
  if (name === 'pkg019b') {
    // pkg019b refuses a database that is not in the state canonical DEV was in (same fixture as PKG-023f):
    // the full budget held by twenty worst-case LLM reservations, one of them with measured usage.
    const holder = randomUUID(), operations = Array.from({length: 20}, () => randomUUID());
    sql(`insert into auth.users(id,email) values(${q(holder)},${q(holder + '@proof.invalid')});`, 'HOLDER');
    report.replayHolder = holder;
    sql(`begin;update private.ai_test_budget_v5 set reserved_microusd=5000000 where singleton;
      insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd)
       select o::uuid,${q(holder)}::uuid,'LLM',250000 from unnest(array[${operations.map(q).join(',')}]) o;
      insert into private.ai_test_usage_v5(operation_id,account_id,model,prompt_tokens,output_tokens,total_tokens)
       values(${q(operations[0])}::uuid,${q(holder)}::uuid,'pkg027-disposable-model',1200,300,1500);commit;`, 'PKG019B_FIXTURE');
  } else if (name === 'pkg019c') {
    // pkg019c refuses a database with nothing to release: two failed speech holds, older than five minutes.
    sql(`begin;insert into private.ai_test_reservations_v5(operation_id,account_id,kind,max_cost_microusd,created_at)
      select gen_random_uuid(),${q(report.replayHolder)}::uuid,'STT',200000,statement_timestamp()-interval '10 minutes' from generate_series(1,2);
      update private.ai_test_budget_v5 set reserved_microusd=(select sum(coalesce(settled_microusd,max_cost_microusd)) from private.ai_test_reservations_v5) where singleton;commit;`, 'PKG019C_FIXTURE');
  }
}

const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`);
const closure = () => JSON.parse(sql(`select jsonb_build_object('live', private.closure_source_digest_v5(),
  'certified', (select sha256 from private.closure_source_v5 where singleton), 'ready', private.retention_ai_source_ready())`));

if (mode === 'replay') {
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '147', 'the workflow replays source 147 first');
  // The production minute tick exists in the disposable database too. Pause it (the documented idempotent form)
  // so it cannot touch fixtures or hold locks while the proof runs.
  sql("select cron.alter_job(j.jobid, active := false) from cron.job j where j.jobname = 'uskoci_marketplace_tick'", 'PAUSE_TICK');
  report.replay = [];
  for (const m of LEDGER) {
    if (m.skip) { report.replay.push({version: m.version, skipped: m.skip}); continue; }
    const bytes = readFileSync(m.file, 'utf8');
    const text = sha256(bytes) === m.sha ? bytes : bytes.replace(/\n$/, '');
    assert.equal(sha256(text), m.sha, 'NOT_THE_TEXT_CANONICAL_DEV_RECORDED ' + m.file);
    if (m.fixture) fixture(m.fixture);
    psqlFile(m.file, {single: !!m.single});
    report.replay.push({version: m.version, file: m.file, sha256: m.sha, finalNewlineOnlyDifference: text !== bytes});
  }
  pass('TWENTY_TWO_DEV_ALPHA_MIGRATIONS_REPLAYED_FROM_THE_EXACT_TEXT_CANONICAL_DEV_RECORDED');
  const differing = Object.entries(DEV_BODIES).filter(([signature, md5]) => bodyMd5(signature) !== md5)
    .map(([signature, md5]) => ({signature, onCanonicalDev: md5, inReplay: bodyMd5(signature)}));
  report.bodiesThatDifferFromCanonicalDev = differing;
  assert.deepEqual(differing, [], 'REPLAY_IS_NOT_CANONICAL_DEV ' + JSON.stringify(differing));
  pass('ALL_FIFTEEN_FUNCTIONS_THE_CANDIDATES_READ_OR_PATCH_HAVE_THE_CANONICAL_DEV_BODY');
  const c = closure();
  assert.equal(c.ready, true); assert.equal(c.live, c.certified);
  report.closureAfterReplay = c;
  pass('THE_CLOSURE_SOURCE_IS_CERTIFIED_AND_READY_AS_ON_CANONICAL_DEV');
  save();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// synthetic rows
// ---------------------------------------------------------------------------------------------------------
const OLD_TEXTS = ['Imate novu poruku u Dogovoru.', 'Vaša prijava je izabrana', 'Otvorite Dogovor za detalje zadatka.',
  'Naručilac je pregledao Vašu prijavu.', 'Uskočer je označio Dogovor kao završen.'];
const INVENTED = {REQUESTER: ['Tražim pouzdanu pomoć uz jasan dogovor.', 'Novi član USKOČI zajednice.'],
  WORKER: ['Spreman da uskočim kada se dogovor jasno postavi.', 'Dostupan za poslove koji odgovaraju profilu i kalendaru.']};

function people(count) {
  return Array.from({length: count}, () => ({id: randomUUID(), requester: randomUUID(), worker: randomUUID()}));
}
function insertPeople(list, {workerActive = [], available = []} = {}) {
  return list.map(p => `insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
    insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
    insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,available_now)
      values(${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',false),
            (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad',
             ${workerActive.includes(p) ? "'ACTIVE'" : "'DRAFT'"},'{ciscenje}',${available.includes(p) ? 'true' : 'false'});`).join('\n');
}
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
  create temporary table pkg027_obs(k text primary key, v jsonb) on commit drop;
  grant all on pkg027_obs to authenticated;
  ${body}
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from pkg027_obs;
  rollback;`, label));

// T1. A task nobody can take yet, checked again and again; then a worker becomes available.
function dispatchScenario() {
  const [requester, worker] = people(2), need = randomUUID();
  return scenario('DISPATCH', `set local session_replication_role = replica;
    ${insertPeople([requester, worker], {workerActive: [worker]})}
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,
      revision,schedule_kind,execution_location_mode,approximate_city,published_at,task_country_code,task_timezone)
      values(${q(need)},${q(requester.id)},${q(requester.requester)},'PUBLISHED','Proof task','Dispatch proof task','PROOF','OFFERS',1,
      1,'FLEXIBLE','STATIONARY','Novi Sad',statement_timestamp()-interval '1 minute','RS','Europe/Belgrade');
    set local session_replication_role = origin;
    do $s$ declare t timestamptz := statement_timestamp(); i integer;
    begin
      perform private.enqueue_dispatch(${q(need)}, t);
      for i in 1..6 loop
        t := greatest(t, coalesce((select next_run_at from private.dispatch_schedule where need_id = ${q(need)}), t)) + interval '1 second';
        perform private.dispatch_tick(25, t);
      end loop;
      insert into pkg027_obs values ('afterSixChecks', jsonb_build_object(
        'queued', exists(select 1 from private.dispatch_schedule where need_id = ${q(need)}),
        'emptyRounds', (select count(*) from public.dispatch_rounds where need_id = ${q(need)}
                         and status = 'STOPPED' and stop_reason = 'NO_ELIGIBLE_CANDIDATES'),
        'minutesToNextCheck', (select round(extract(epoch from next_run_at - t) / 60) from private.dispatch_schedule where need_id = ${q(need)}),
        'lastCheckAt', t));
      insert into pkg027_obs values ('availabilityRevision',
        to_jsonb(private.worker_availability_document(${q(worker.worker)}) ->> 'revision'));
    end $s$;
    ${asPerson(worker.id)}
    insert into pkg027_obs select 'availabilitySaved', public.rpc_save_worker_availability(
      (select v #>> '{}' from pkg027_obs where k = 'availabilityRevision'),
      '{"timezone":"Europe/Belgrade","availableNow":true,"rules":[],"windows":[]}'::jsonb);
    ${asPostgres}
    do $s$ declare t timestamptz;
    begin
      t := (select (v ->> 'lastCheckAt')::timestamptz from pkg027_obs where k = 'afterSixChecks') + interval '1 second';
      insert into pkg027_obs values ('requeuedByTheWorkerChange',
        to_jsonb(exists(select 1 from private.dispatch_schedule where need_id = ${q(need)} and next_run_at <= t)));
      perform private.dispatch_tick(25, t);
      insert into pkg027_obs values ('afterTheWorkerBecameAvailable', jsonb_build_object(
        'offers', (select count(*) from public.opportunity_deliveries where need_id = ${q(need)} and worker_account_id = ${q(worker.id)}),
        'roundsThatReachedSomebody', (select count(*) from public.dispatch_rounds where need_id = ${q(need)}
                                       and not (status = 'STOPPED' and stop_reason = 'NO_ELIGIBLE_CANDIDATES')),
        'inAppTitle', (select d.title from public.notification_deliveries d join public.user_activity_events e on e.id = d.event_id
                        where e.recipient_user_id = ${q(worker.id)} and e.event_type = 'OPPORTUNITY_AVAILABLE' and d.channel = 'IN_APP')));
    end $s$;`);
}

// T2. Turns left PROCESSING after their lease: intake, worker profile, Q&A; one live control; and an abandon.
function turnScenario() {
  const [requester, worker] = people(2), need = randomUUID();
  const intake = randomUUID(), profileConversation = randomUUID(), leftConversation = randomUUID();
  const ids = {expiredIntake: randomUUID(), liveIntake: randomUUID(), expiredWorker: randomUUID(), leftWorker: randomUUID(), expiredQa: randomUUID()};
  return scenario('TURNS', `set local session_replication_role = replica;
    ${insertPeople([requester, worker], {workerActive: [worker]})}
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,
      revision,schedule_kind,execution_location_mode,approximate_city,published_at,task_country_code,task_timezone)
      values(${q(need)},${q(requester.id)},${q(requester.requester)},'PUBLISHED','Proof task','Turn proof task','PROOF','OFFERS',1,
      1,'FLEXIBLE','STATIONARY','Novi Sad',statement_timestamp()-interval '1 day','RS','Europe/Belgrade');
    insert into public.ai_conversations(id,account_id,purpose,status,fact_schema_version) values
      (${q(intake)},${q(requester.id)},'NEED_INTAKE','OPEN','NEED_FACT_V2');
    insert into public.ai_conversations(id,account_id,purpose,status) values
      (${q(profileConversation)},${q(worker.id)},'PROFILE','OPEN'),
      (${q(leftConversation)},${q(worker.id)},'PROFILE','OPEN');
    insert into private.ai_need_turn_commands(account_id,client_request_id,conversation_id,request_hash,state,context_hash,attempt_id,
      lease_expires_at,provider_dispatched) values
      (${q(requester.id)},${q(ids.expiredIntake)},${q(intake)},repeat('a',64),'PROCESSING',repeat('b',64),gen_random_uuid(),
       statement_timestamp()-interval '1 hour',true),
      (${q(requester.id)},${q(ids.liveIntake)},${q(intake)},repeat('c',64),'PROCESSING',repeat('d',64),gen_random_uuid(),
       statement_timestamp()+interval '5 minutes',true);
    insert into private.worker_ai_sessions(conversation_id,account_id,open_request_id,profile_id,base_hash,candidate) values
      (${q(profileConversation)},${q(worker.id)},gen_random_uuid(),${q(worker.worker)},repeat('0',64),'{}'::jsonb),
      (${q(leftConversation)},${q(worker.id)},gen_random_uuid(),${q(worker.worker)},repeat('0',64),'{}'::jsonb);
    insert into private.worker_ai_turns(account_id,conversation_id,client_request_id,body_hash,source_revision,state,
      lease_expires_at,provider_dispatched) values
      (${q(worker.id)},${q(profileConversation)},${q(ids.expiredWorker)},repeat('e',64),0,'PROCESSING',statement_timestamp()-interval '1 hour',true),
      (${q(worker.id)},${q(leftConversation)},${q(ids.leftWorker)},repeat('f',64),0,'PROCESSING',statement_timestamp()+interval '1 minute',true);
    insert into private.qa_ai_commands(account_id,client_request_id,command_type,need_id,need_revision,text_sha256,request_hash,state,
      lease_expires_at,provider_dispatched) values
      (${q(worker.id)},${q(ids.expiredQa)},'ASK',${q(need)},1,repeat('1',64),repeat('2',64),'PROCESSING',statement_timestamp()-interval '1 hour',true);
    set local session_replication_role = origin;
    insert into pkg027_obs select 'tick', private.marketplace_tick(25, statement_timestamp());
    ${asPerson(worker.id)}
    insert into pkg027_obs select 'abandon', to_jsonb(public.rpc_abandon_worker_ai(${q(leftConversation)}) is not null);
    ${asPostgres}
    insert into pkg027_obs select 'states', jsonb_build_object(
      'expiredIntake', (select state from private.ai_need_turn_commands where client_request_id = ${q(ids.expiredIntake)}),
      'liveIntake', (select state from private.ai_need_turn_commands where client_request_id = ${q(ids.liveIntake)}),
      'expiredWorker', (select state from private.worker_ai_turns where client_request_id = ${q(ids.expiredWorker)}),
      'abandonedWorker', (select state from private.worker_ai_turns where client_request_id = ${q(ids.leftWorker)}),
      'expiredQa', (select state from private.qa_ai_commands where client_request_id = ${q(ids.expiredQa)}));`);
}

// T3. What an emitting function stores, and what the Inbox then shows.
function copyScenario() {
  const [person] = people(1);
  return scenario('COPY', `set local session_replication_role = replica;
    ${insertPeople([person])}
    set local session_replication_role = origin;
    do $s$ begin
      perform private.emit_event(${q(person.id)},'WORKER','MESSAGE_RECEIVED','AGREEMENT',gen_random_uuid(),1,
        'Nova poruka','Imate novu poruku u Dogovoru.','pkg027-copy:'||gen_random_uuid()::text,'NORMAL','{}'::jsonb,null);
      perform private.emit_event(${q(person.id)},'WORKER','RESPONSE_SELECTED','RESPONSE',gen_random_uuid(),1,
        'Vaša prijava je izabrana','Otvorite Dogovor za detalje zadatka.','pkg027-copy:'||gen_random_uuid()::text,'NORMAL','{}'::jsonb,null);
      perform private.emit_event(${q(person.id)},'WORKER','AGREEMENT_CANCELLED','AGREEMENT',gen_random_uuid(),1,
        'Dogovor je otkazan','Druga strana je otkazala Dogovor.','pkg027-copy:'||gen_random_uuid()::text,'NORMAL','{}'::jsonb,null);
    end $s$;
    insert into pkg027_obs select 'stored', (select jsonb_agg(jsonb_build_object('channel', d.channel, 'title', d.title, 'body', d.body)
      order by d.title, d.channel) from public.notification_deliveries d where d.recipient_user_id = ${q(person.id)});
    insert into pkg027_obs select 'inboxFallbackIsTi', to_jsonb(position('Otvori za trenutne informacije.' in prosrc) > 0)
      from pg_proc where oid = 'public.rpc_list_inbox(text,integer,timestamptz,uuid)'::regprocedure;
    ${asPerson(person.id)}
    insert into pkg027_obs select 'inbox', (select jsonb_agg(jsonb_build_object('title', i ->> 'title', 'body', i ->> 'body') order by i ->> 'title')
      from jsonb_array_elements(public.rpc_list_inbox(null, 30, null, null) -> 'items') i);
    ${asPostgres}`);
}

// T4. What sign-up writes into a new person's profiles.
function signupScenario() {
  const id = randomUUID();
  return scenario('SIGNUP', `insert into auth.users(id,email,raw_user_meta_data)
      values(${q(id)},${q(id + '@proof.invalid')},'{"full_name":"Proof Person"}'::jsonb);
    insert into pkg027_obs select 'profiles', (select jsonb_object_agg(kind, jsonb_build_object('headline', headline, 'bio', bio))
      from public.app_profiles where account_id = ${q(id)});`);
}

// T5. Opening an edit of a "po osobi" task, and whether changing only the basis is a material change.
function basisScenario() {
  const [owner] = people(1), need = randomUUID();
  return scenario('BASIS', `set local session_replication_role = replica;
    ${insertPeople([owner])}
    insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,requester_price_rsd,
      price_basis,required_slots,revision,schedule_kind,execution_location_mode,approximate_city,published_at,task_country_code,task_timezone)
      values(${q(need)},${q(owner.id)},${q(owner.requester)},'PUBLISHED','Proof moving help','Two people for two hours','Selidbe','MY_PRICE',5000,
      'PER_PERSON',2,1,'FLEXIBLE','STATIONARY','Novi Sad',statement_timestamp()-interval '1 hour','RS','Europe/Belgrade');
    insert into public.need_geography(need_id,public_topology) values(${q(need)},'{"mode":"STATIONARY","start":{"city":"Novi Sad"}}'::jsonb);
    set local session_replication_role = origin;
    ${asPerson(owner.id)}
    insert into pkg027_obs select 'edit', public.rpc_ai_open_need_edit_conversation_v2(${q(need)});
    ${asPostgres}
    do $s$ declare cid uuid; before_snapshot jsonb; after_snapshot jsonb;
    begin
      cid := (select (v ->> 'conversationId')::uuid from pkg027_obs where k = 'edit');
      insert into pkg027_obs select 'seededBasis', coalesce((select jsonb_build_object('value', fact_value, 'display', display_value,
        'status', status, 'source', source) from public.ai_structured_facts
        where conversation_id = cid and fact_key = 'need.price_basis' and superseded_at is null), 'null'::jsonb);
      before_snapshot := private.need_full_edit_snapshot(${q(need)});
      perform set_config('session_replication_role', 'replica', true);
      update public.needs set price_basis = 'TOTAL' where id = ${q(need)};
      perform set_config('session_replication_role', 'origin', true);
      after_snapshot := private.need_full_edit_snapshot(${q(need)});
      insert into pkg027_obs values ('basisOnlyChangeIsMaterial', to_jsonb(before_snapshot is distinct from after_snapshot));
    end $s$;`);
}

function scenarios() {
  const result = {dispatch: dispatchScenario(), turns: turnScenario(), copy: copyScenario(), signup: signupScenario(), basis: basisScenario()};
  writeFileSync(`${out}/pkg027-${mode}-observations.json`, JSON.stringify(result, null, 1) + '\n');
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------------------------------------
if (mode === 'seed') {
  const [invented, own] = people(2), event = randomUUID(), cancelled = randomUUID();
  sql(`begin;
    set local session_replication_role = replica;
    ${insertPeople([invented, own])}
    update public.app_profiles set headline = ${q(INVENTED.REQUESTER[0])}, bio = ${q(INVENTED.REQUESTER[1])} where id = ${q(invented.requester)};
    update public.app_profiles set headline = ${q(INVENTED.WORKER[0])}, bio = 'Moj opis rada, moje reči.' where id = ${q(invented.worker)};
    update public.app_profiles set headline = 'Moj naslov', bio = 'Moja biografija.' where account_id = ${q(own.id)};
    insert into public.user_activity_events(id,recipient_user_id,recipient_role,event_type,entity_type,entity_id,dedupe_key) values
      (${q(event)},${q(invented.id)},'WORKER','RESPONSE_SELECTED','RESPONSE',gen_random_uuid(),'pkg027-seed:'||${q(event)}),
      (${q(cancelled)},${q(invented.id)},'WORKER','AGREEMENT_CANCELLED','AGREEMENT',gen_random_uuid(),'pkg027-seed:'||${q(cancelled)});
    insert into public.notification_deliveries(event_id,recipient_user_id,recipient_role,channel,state,title,body,dedupe_key) values
      (${q(event)},${q(invented.id)},'WORKER','IN_APP','CREATED','Vaša prijava je izabrana','Otvorite Dogovor za detalje zadatka.','pkg027-seed-in:'||${q(event)}),
      (${q(event)},${q(invented.id)},'WORKER','PUSH','CREATED','Vaša prijava je izabrana','Otvorite Dogovor za detalje zadatka.','pkg027-seed-push:'||${q(event)}),
      (${q(cancelled)},${q(invented.id)},'WORKER','IN_APP','CREATED','Dogovor je otkazan','Druga strana je otkazala Dogovor.','pkg027-seed-in:'||${q(cancelled)});
    commit;`, 'SEED');
  report.seed = {invented, own};
  pass('COMMITTED_SEEDS_WRITTEN_BEFORE_ANY_CANDIDATE');
  save();
  process.exit(0);
}

const seedState = () => JSON.parse(sql(`select jsonb_build_object(
  'deliveries', (select jsonb_agg(jsonb_build_object('channel', channel, 'title', title, 'body', body) order by title, channel)
    from public.notification_deliveries where recipient_user_id = ${q(report.seed.invented.id)}),
  'invented', (select jsonb_object_agg(kind, jsonb_build_object('headline', headline, 'bio', bio)) from public.app_profiles where account_id = ${q(report.seed.invented.id)}),
  'own', (select jsonb_object_agg(kind, jsonb_build_object('headline', headline, 'bio', bio)) from public.app_profiles where account_id = ${q(report.seed.own.id)}))`));

// ---------------------------------------------------------------------------------------------------------
// before
// ---------------------------------------------------------------------------------------------------------
if (mode === 'before') {
  const o = scenarios();
  assert.equal(o.dispatch.afterSixChecks.queued, false);
  assert.equal(o.dispatch.afterSixChecks.emptyRounds, 4);
  assert.equal(o.dispatch.requeuedByTheWorkerChange, false);
  assert.equal(o.dispatch.afterTheWorkerBecameAvailable.offers, 0);
  pass('DEFECT_REPRODUCED_FOUR_EMPTY_CHECKS_USE_UP_THE_WAVES_AND_THE_TASK_LEAVES_THE_QUEUE_FOR_GOOD');
  assert.deepEqual(o.turns.states, {expiredIntake: 'PROCESSING', liveIntake: 'PROCESSING', expiredWorker: 'PROCESSING',
    abandonedWorker: 'PROCESSING', expiredQa: 'PROCESSING'});
  assert.equal(o.turns.tick.aiTurnSweep, undefined);
  pass('DEFECT_REPRODUCED_EXPIRED_TURNS_STAY_PROCESSING_AND_ABANDONING_LEAVES_THE_TURN_RUNNING');
  assert.ok(o.copy.stored.some(d => d.body === 'Imate novu poruku u Dogovoru.'));
  assert.ok(o.copy.inbox.some(d => d.title === 'Vaša prijava je izabrana'));
  assert.equal(o.copy.inboxFallbackIsTi, false);
  pass('DEFECT_REPRODUCED_STORED_AND_SHOWN_NOTIFICATIONS_ARE_FORMAL');
  assert.equal(o.signup.profiles.REQUESTER.headline, 'Tražim pouzdanu pomoć uz jasan dogovor.');
  assert.equal(o.signup.profiles.WORKER.headline, 'Uskačem kada se dogovor jasno postavi.');
  pass('DEFECT_REPRODUCED_SIGN_UP_INVENTS_A_HEADLINE_AND_A_BIO');
  assert.equal(o.basis.seededBasis, null);
  assert.equal(o.basis.basisOnlyChangeIsMaterial, false);
  pass('DEFECT_REPRODUCED_AN_EDIT_DROPS_THE_PRICE_BASIS_AND_A_BASIS_ONLY_CHANGE_IS_NOT_MATERIAL');
  const s = seedState();
  report.seedBefore = s;
  assert.ok(s.deliveries.some(d => d.title === 'Vaša prijava je izabrana'));
  assert.equal(s.invented.REQUESTER.headline, INVENTED.REQUESTER[0]);
  save();
  console.log('PASS PKG027_DEFECTS_REPRODUCED_BEFORE');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------------------------------------
if (mode === 'apply') {
  const before = surface(), closureBefore = closure();
  writeFileSync(`${out}/pkg027-surface-before.txt`, before.join('\n') + '\n');
  assert.equal(closureBefore.ready, true);
  for (const name of CANDIDATES) {
    const code = CANDIDATE_CODE[name], text = readFileSync(`supabase/candidates/${name}.sql`, 'utf8');
    assert.ok(!text.includes('\r'), 'LF_ONLY ' + name);
    const pin = text.match(/'([0-9a-f]{32})'\)/)[1];
    const tampered = text.replace(`'${pin}'`, `'${'0'.repeat(32)}'`);
    writeFileSync(`${out}/${name}.tampered.sql`, tampered);
    let refused = null;
    try { psqlFile(`${out}/${name}.tampered.sql`); } catch (e) { refused = e; }
    assert.ok(refused && refused.stderr.includes(`${code}_PREDECESSOR_DRIFT`), 'TAMPERED_PIN_NOT_REFUSED ' + name + ' ' + (refused?.stderr ?? ''));
    assert.deepEqual(surface(), before, 'A_REFUSED_CANDIDATE_LEFT_SOMETHING_BEHIND ' + name);
  }
  pass('EVERY_CANDIDATE_REFUSES_A_PREDECESSOR_IT_WAS_NOT_WRITTEN_FOR_AND_LEAVES_NOTHING_BEHIND');
  report.applyNotices = {};
  for (const name of CANDIDATES) {
    const run = spawnSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', `supabase/candidates/${name}.sql`], {encoding: 'utf8'});
    report.applyNotices[name] = run.stderr;
    assert.equal(run.status, 0, 'CANDIDATE_FAILED ' + name + ' ' + String(run.stderr).slice(-3000));
  }
  pass('ALL_FIVE_CANDIDATES_APPLIED_IN_ORDER');
  for (const name of CANDIDATES) {
    let refused = null;
    try { psqlFile(`supabase/candidates/${name}.sql`); } catch (e) { refused = e; }
    assert.ok(refused && refused.stderr.includes(`${CANDIDATE_CODE[name]}_ALREADY_APPLIED`), 'SECOND_APPLICATION_NOT_REFUSED ' + name);
  }
  pass('A_SECOND_APPLICATION_OF_EACH_CANDIDATE_IS_REFUSED');
  const after = surface();
  writeFileSync(`${out}/pkg027-surface-after.txt`, after.join('\n') + '\n');
  const removed = before.filter(l => !after.includes(l)), added = after.filter(l => !before.includes(l));
  const name = line => line.slice('function:'.length, line.indexOf('('));
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  assert.ok(removed.every(l => l.startsWith('function:')) && added.every(l => l.startsWith('function:')), 'ONLY_FUNCTIONS_MAY_CHANGE');
  assert.deepEqual(removed.map(name).sort(), [...PATCHED].sort());
  assert.deepEqual(added.map(name).sort(), [...PATCHED, ...ADDED].sort());
  for (const line of added.filter(l => ADDED.includes(name(l)))) {
    assert.ok(line.endsWith(':acl={postgres=X/postgres}'), 'NEW_FUNCTION_IS_SERVER_ONLY ' + line);
    assert.ok(name(line) === 'private.notification_copy_v5' ? line.includes(':definer=false:') : line.includes(':definer=true:'), 'NEW_FUNCTION_ENVELOPE ' + line);
  }
  pass('THE_SURFACE_CHANGED_BY_EXACTLY_THIRTEEN_PATCHED_AND_THREE_NEW_SERVER_ONLY_FUNCTIONS');
  const closureAfter = closure();
  assert.deepEqual(closureAfter, closureBefore);
  report.closure = {before: closureBefore, after: closureAfter};
  pass('THE_CERTIFIED_CLOSURE_SOURCE_DID_NOT_MOVE_AND_IS_STILL_READY');
  report.bodiesAfter = Object.fromEntries([...Object.keys(DEV_BODIES)].map(s => [s, bodyMd5(s)]));
  save();
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// after
// ---------------------------------------------------------------------------------------------------------
if (mode === 'after') {
  const o = scenarios();
  assert.equal(o.dispatch.afterSixChecks.queued, true);
  assert.equal(o.dispatch.afterSixChecks.emptyRounds, 6);
  assert.ok(o.dispatch.afterSixChecks.minutesToNextCheck >= 5 && o.dispatch.afterSixChecks.minutesToNextCheck <= 360);
  assert.equal(o.dispatch.requeuedByTheWorkerChange, true);
  assert.equal(o.dispatch.afterTheWorkerBecameAvailable.offers, 1);
  assert.equal(o.dispatch.afterTheWorkerBecameAvailable.roundsThatReachedSomebody, 1);
  assert.equal(o.dispatch.afterTheWorkerBecameAvailable.inAppTitle, 'Nova prilika koja ti može odgovarati');
  pass('FIXED_EMPTY_CHECKS_DO_NOT_USE_UP_WAVES_THE_TASK_STAYS_QUEUED_AND_A_WORKER_CHANGE_BRINGS_THE_OFFER_AT_ONCE');
  assert.deepEqual(o.turns.states, {expiredIntake: 'FAILED', liveIntake: 'PROCESSING', expiredWorker: 'FAILED',
    abandonedWorker: 'FAILED', expiredQa: 'CANCELLED'});
  assert.deepEqual(o.turns.tick.aiTurnSweep, {needTurnsFailed: 1, workerTurnsFailed: 1, qaCommandsCancelled: 1, graceMinutes: 10, errors: []});
  pass('FIXED_THE_MINUTE_TICK_ENDS_EXPIRED_TURNS_LEAVES_LIVE_ONES_AND_ABANDON_ENDS_THE_OPEN_TURN');
  const texts = o.copy.stored.flatMap(d => [d.title, d.body]).concat(o.copy.inbox.flatMap(d => [d.title, d.body]));
  for (const old of OLD_TEXTS) assert.ok(!texts.includes(old), 'OLD_TEXT_STILL_STORED ' + old);
  assert.ok(o.copy.stored.some(d => d.channel === 'IN_APP' && d.body === 'Imaš novu poruku u Dogovoru.'));
  assert.ok(o.copy.inbox.some(d => d.title === 'Tvoja prijava je izabrana' && d.body === 'Otvori Dogovor za detalje zadatka.'));
  assert.ok(o.copy.inbox.some(d => d.title === 'Dogovor je otkazan' && d.body === 'Druga strana je otkazala Dogovor.'));
  assert.equal(o.copy.inboxFallbackIsTi, true);
  pass('FIXED_EVERY_STORED_AND_SHOWN_NOTIFICATION_SAYS_TI_AND_TEXTS_ALREADY_RIGHT_PASS_THROUGH');
  assert.deepEqual(o.signup.profiles, {REQUESTER: {headline: '', bio: ''}, WORKER: {headline: '', bio: ''}});
  pass('FIXED_SIGN_UP_WRITES_NO_HEADLINE_AND_NO_BIO');
  assert.deepEqual(o.basis.seededBasis, {value: 'PER_PERSON', display: 'Po osobi', status: 'CONFIRMED', source: 'SYSTEM_DERIVED'});
  assert.equal(o.basis.basisOnlyChangeIsMaterial, true);
  pass('FIXED_AN_EDIT_KEEPS_THE_PRICE_BASIS_AND_A_BASIS_ONLY_CHANGE_IS_MATERIAL');
  const s = seedState();
  report.seedAfter = s;
  assert.deepEqual(s.deliveries, [
    {channel: 'IN_APP', title: 'Dogovor je otkazan', body: 'Druga strana je otkazala Dogovor.'},
    {channel: 'IN_APP', title: 'Tvoja prijava je izabrana', body: 'Otvori Dogovor za detalje zadatka.'},
    {channel: 'PUSH', title: 'Tvoja prijava je izabrana', body: 'Otvori Dogovor za detalje zadatka.'}]);
  assert.deepEqual(s.invented, {REQUESTER: {headline: '', bio: ''}, WORKER: {headline: '', bio: 'Moj opis rada, moje reči.'}});
  assert.deepEqual(s.own, {REQUESTER: {headline: 'Moj naslov', bio: 'Moja biografija.'}, WORKER: {headline: 'Moj naslov', bio: 'Moja biografija.'}});
  pass('FIXED_STORED_TEXTS_REWRITTEN_INVENTED_TEXT_EMPTIED_AND_EVERY_WORD_A_PERSON_WROTE_KEPT');
  const c = closure();
  assert.deepEqual(c, report.closure.after);
  pass('THE_CLOSURE_SOURCE_IS_STILL_CERTIFIED_AND_READY_AFTER_THE_SCENARIOS');
  report.result = 'PASS';
  save();
  console.log('PASS PKG027_OWNER_APPROVED_FIXES');
  process.exit(0);
}

throw new Error('UNKNOWN_MODE ' + mode);
