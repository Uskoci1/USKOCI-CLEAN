// PKG-031 proof: the owner's rules of 2026-09-21. Disposable local Postgres only; it refuses any other target and
// holds no hosted secret.
//
//   replay  after pkg030's replay (the workflow runs it first): the PKG-030 row from the exact text canonical DEV
//           recorded, until every function PKG-031 patches has its canonical DEV body
//   before  each defect reproduces on the unchanged surface
//   apply   a tampered pin is refused and leaves nothing behind; both candidates apply; a second application of each
//           is refused; the surface changes by exactly the reviewed functions and the one new function
//   after   the same scenarios show the fixed behaviour, and what must not change did not
//
// Every scenario builds its synthetic rows with triggers off (session_replication_role = replica), turns them on
// again, calls the real functions (as the person where it matters), and is rolled back.
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
const report = JSON.parse(existsSync(`${out}/pkg031-report.json`) ? readFileSync(`${out}/pkg031-report.json`, 'utf8') :
  JSON.stringify({package: 'PKG-031', sourceSha: process.env.GITHUB_SHA, disposableDbOnly: true, canonicalDevAccess: false,
    providerCalls: false, deviceTest: false, checks: []}));
const pass = name => { report.checks.push({mode, name, result: 'PASS'}); console.log('PASS ' + name); };
const save = () => writeFileSync(`${out}/pkg031-report.json`, JSON.stringify(report, null, 1) + '\n');
const closure = () => JSON.parse(sql(`select jsonb_build_object('live', private.closure_source_digest_v5(),
  'certified', (select sha256 from private.closure_source_v5 where singleton), 'ready', private.retention_ai_source_ready())`));
const bodyMd5 = signature => sql(`select md5(replace(prosrc, E'\\r\\n', E'\\n')) from pg_proc where oid = to_regprocedure(${q(signature)})`);

const CANDIDATES = {pkg031a_no_cancel_after_done: 'PKG031A', pkg031b_work_kinds_for_matching: 'PKG031B'};
// The PKG-030 row canonical DEV recorded on 2026-09-21 (receipt 20260921_pkg030_application.receipt.json).
const PKG030 = [['pkg030a_edge_workers_apikey', '04daaad8c33fa531e8513acdc6e94c12594327724a4c87bf24cb6b5fcfb56333']];
// md5(prosrc) on canonical DEV, 2026-09-21, after PKG-030: every function PKG-031 patches, and the tick PKG-030 left.
const DEV_BODIES = {
  'private.agreement_action_state(uuid,uuid)': 'f57cf9b340eab74ab3704605fcc706dd',
  'public.rpc_cancel_agreement(uuid,text)': '17dad1631c4cfe9fba6c2f05a3030062',
  'private.match_detail_without_calendar(uuid,uuid)': '02d7063424dbbe3df6cd97c0a64bd8b1',
  'private.dispatch_cheap_candidate_admitted(uuid,uuid)': '72a078453c9b28b6a23690bf9fff2473',
  'private.edge_worker_tick_v5(timestamptz)': 'f9485392ceb2db1e06a982da7ee9b049',
};
const PATCHED = ['private.agreement_action_state', 'public.rpc_cancel_agreement', 'private.match_detail_without_calendar',
  'private.dispatch_cheap_candidate_admitted'];
const ADDED = ['private.work_kinds_v5'];

// ---------------------------------------------------------------------------------------------------------
if (mode === 'replay') {
  for (const [name, sha] of PKG030) {
    const path = `supabase/candidates/${name}.sql`, bytes = readFileSync(path, 'utf8');
    assert.equal(sha256(bytes.replace(/\n$/, '')), sha, 'NOT_THE_TEXT_CANONICAL_DEV_RECORDED ' + name);
    psqlFile(path);
  }
  pass('THE_PKG030_ROW_REPLAYED_FROM_THE_EXACT_TEXT_CANONICAL_DEV_RECORDED');
  const differing = Object.entries(DEV_BODIES).filter(([signature, md5]) => bodyMd5(signature) !== md5)
    .map(([signature, md5]) => ({signature, onCanonicalDev: md5, inReplay: bodyMd5(signature)}));
  report.bodiesThatDifferFromCanonicalDev = differing;
  assert.deepEqual(differing, [], 'REPLAY_IS_NOT_CANONICAL_DEV ' + JSON.stringify(differing));
  pass('EVERY_FUNCTION_PKG031_PATCHES_HAS_THE_CANONICAL_DEV_BODY');
  const c = closure(); assert.equal(c.ready, true); assert.equal(c.live, c.certified); report.closureAfterReplay = c;
  pass('THE_CLOSURE_SOURCE_IS_CERTIFIED_AND_READY_AS_ON_CANONICAL_DEV');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
// synthetic rows
// ---------------------------------------------------------------------------------------------------------
const party = ({skills = '{ciscenje}', exclusions = '{}', availableNow = false} = {}) =>
  ({id: randomUUID(), requester: randomUUID(), worker: randomUUID(), skills, exclusions, availableNow});
const insertParty = p => `insert into auth.users(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_accounts(id,email) values(${q(p.id)},${q(p.id + '@proof.invalid')});
  insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,exclusions,available_now)
    values(${q(p.requester)},${q(p.id)},'REQUESTER','Proof person','Novi Sad','ACTIVE','{}','{}',false),
          (${q(p.worker)},${q(p.id)},'WORKER','Proof person','Novi Sad','ACTIVE',${q(p.skills)},${q(p.exclusions)},${p.availableNow});`;
const need = (id, owner, {status = 'PUBLISHED', category = 'PROOF', skills = '{}'} = {}) => `insert into public.needs(id,
    requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,
    mode,required_slots,schedule_kind,published_at,task_timezone)
  values(${q(id)},${q(owner.id)},${q(owner.requester)},${q(status)},'PKG-031 fixture','Disposable SQL fixture',${q(category)},${q(skills)},
    'Novi Sad','Liman','OFFERS',1,'FLEXIBLE',statement_timestamp()-interval '1 day','Europe/Belgrade');`;
const response = (id, needId, worker, status) => `insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,
    response_kind,status,submitted_against_need_revision,price_rsd,covered_slots)
  values(${q(id)},${q(needId)},${q(worker.id)},${q(worker.worker)},'APPLICATION',${q(status)},1,3000,1);`;
const selection = (id, needId, owner, worker, responseId) => `insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,
    client_request_id,covered_slots,status,response_id,worker_account_id,worker_profile_id)
  values(${q(id)},${q(needId)},1,${q(owner.id)},${q('pkg031-sel-' + id)},1,'SELECTED',${q(responseId)},${q(worker.id)},${q(worker.worker)});`;
const agreement = (id, needId, selectionId, responseId, owner, worker, executionState) => `insert into public.agreements(id,need_id,
    selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,status,current_version)
  values(${q(id)},${q(needId)},${q(selectionId)},${q(responseId)},${q(owner.id)},${q(owner.requester)},${q(worker.id)},${q(worker.worker)},'CONFIRMED',1);
  insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
  values(${q(id)},1,'CONFIRMED',jsonb_build_object('price_rsd',3000,'covered_slots',1,'need_revision',1,'response_version',1,
    'scope_note','','proposed_start_at',null,'proposed_end_at',null),md5(${q(id)}),${q(owner.id)});
  insert into public.agreement_execution(agreement_id,agreement_version,state,worker_marked_done_at,requester_deadline_at,mode)
  values(${q(id)},1,${q(executionState)},
    ${executionState === 'AWAITING_REQUESTER' ? "statement_timestamp()-interval '1 hour'" : 'null'},
    ${executionState === 'AWAITING_REQUESTER' ? "statement_timestamp()+interval '47 hours'" : 'null'},'PHYSICAL');`;
const asPerson = id => `set local role authenticated;
  set local request.jwt.claim.sub = ${q(id)}; set local request.jwt.claim.role = 'authenticated';
  set local request.jwt.claims = ${q(JSON.stringify({sub: id, role: 'authenticated'}))};`;
const asPostgres = `reset role; set local request.jwt.claim.sub = ''; set local request.jwt.claim.role = ''; set local request.jwt.claims = '';`;
const scenario = (label, fixtures, body) => JSON.parse(sql(`begin;
  set local statement_timeout = '120s';
  create temporary table pkg031_obs(k text primary key, v jsonb) on commit drop;
  grant all on pkg031_obs to authenticated;
  set local session_replication_role = replica;
  ${fixtures}
  set local session_replication_role = origin;
  ${body}
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from pkg031_obs;
  rollback;`, label).split(/\r?\n/).pop());
const catching = (key, statement) => `do $c$ begin ${statement}; insert into pkg031_obs values (${q(key)}, '"OK"'); exception when others then insert into pkg031_obs values (${q(key)}, to_jsonb(sqlerrm)); end $c$;`;

function scenarios() {
  const o = {};
  // 7.16: an Agreement where the worker has said the work is done; who may cancel, and what a cancel does.
  const doneAgreement = (label, actor, executionState) => {
    const r = party(), w = party(), n = randomUUID(), resp = randomUUID(), sel = randomUUID(), a = randomUUID();
    const who = actor === 'REQUESTER' ? r : w;
    return scenario(label, `${insertParty(r)}${insertParty(w)}${need(n, r, {status: 'ACTIVE'})}
      ${response(resp, n, w, 'SELECTED')}${selection(sel, n, r, w, resp)}${agreement(a, n, sel, resp, r, w, executionState)}`, `
      insert into pkg031_obs values ('requesterActions', private.agreement_action_state(${q(a)}, ${q(r.id)}));
      insert into pkg031_obs values ('workerActions', private.agreement_action_state(${q(a)}, ${q(w.id)}));
      ${asPerson(who.id)}
      ${catching('cancel', `perform public.rpc_cancel_agreement(${q(a)}, 'Proof reason')`)}
      ${asPostgres}
      insert into pkg031_obs values ('agreement', to_jsonb((select status from public.agreements where id=${q(a)})));
      insert into pkg031_obs values ('execution', to_jsonb((select state from public.agreement_execution where agreement_id=${q(a)})));`);
  };
  o.requesterAfterDone = doneAgreement('REQUESTER_AFTER_DONE', 'REQUESTER', 'AWAITING_REQUESTER');
  o.workerAfterDone = doneAgreement('WORKER_AFTER_DONE', 'WORKER', 'AWAITING_REQUESTER');
  o.requesterBeforeDone = doneAgreement('REQUESTER_BEFORE_DONE', 'REQUESTER', 'CONFIRMED');

  // 9.2/9.3: one task, several workers. Every worker is available now, so the dispatch prefilter decides on skills
  // and exclusions alone; the control worker proves that.
  {
    const r = party();
    const control = party({skills: '{}', availableNow: true});
    const excludesMoving = party({skills: '{}', exclusions: '{selidbe}', availableNow: true});
    const excludesPainting = party({skills: '{}', exclusions: '{moleraj}', availableNow: true});
    const n = randomUUID();
    o.exclusion = scenario('EXCLUSION', `${[r, control, excludesMoving, excludesPainting].map(insertParty).join('')}
      ${need(n, r, {category: 'transport_selidbe'})}`, `
      ${[['control', control], ['excludesMoving', excludesMoving], ['excludesPainting', excludesPainting]].map(([k, w]) => `
        insert into pkg031_obs values (${q(k)}, jsonb_build_object(
          'hard', private.match_detail_without_calendar(${q(n)}, ${q(w.worker)})->'hardBlockers',
          'dispatch', private.dispatch_cheap_candidate_admitted(${q(n)}, ${q(w.worker)})));`).join('')}`);
  }
  {
    const r = party();
    const sameWords = party({skills: '{Ciscenje stana}', availableNow: true});
    const otherTrade = party({skills: '{electrician}', availableNow: true});
    const n = randomUUID();
    o.skills = scenario('SKILLS', `${[r, sameWords, otherTrade].map(insertParty).join('')}
      ${need(n, r, {category: 'Čišćenje i održavanje', skills: '{čišćenje stana}'})}`, `
      ${[['sameWords', sameWords], ['otherTrade', otherTrade]].map(([k, w]) => `
        insert into pkg031_obs values (${q(k)}, jsonb_build_object(
          'serviceBlocked', (private.match_detail_without_calendar(${q(n)}, ${q(w.worker)})->'dispatchBlockers') ? 'SERVICE_NOT_IN_WORK_PROFILE',
          'dispatch', private.dispatch_cheap_candidate_admitted(${q(n)}, ${q(w.worker)})));`).join('')}`);
  }
  return o;
}
const blocked = x => (x.hard ?? []).includes('PROFILE_EXCLUSION');

// ---------------------------------------------------------------------------------------------------------
if (mode === 'before') {
  const s = scenarios(); report.before = s;
  assert.equal(s.requesterAfterDone.requesterActions.canCancel, true, JSON.stringify(s.requesterAfterDone));
  assert.equal(s.requesterAfterDone.cancel, 'OK'); assert.equal(s.requesterAfterDone.agreement, 'CANCELLED');
  pass('7_16_BEFORE_THE_REQUESTER_IS_OFFERED_CANCEL_AFTER_DONE_AND_IT_SUCCEEDS');
  assert.equal(s.exclusion.control.dispatch, true, 'the control worker must pass the prefilter: ' + JSON.stringify(s.exclusion));
  assert.equal(blocked(s.exclusion.excludesMoving), false); assert.equal(s.exclusion.excludesMoving.dispatch, true);
  pass('9_3_BEFORE_A_WORKER_WHO_EXCLUDED_SELIDBE_IS_STILL_OFFERED_TRANSPORT_SELIDBE');
  assert.equal(s.skills.sameWords.serviceBlocked, true); assert.equal(s.skills.sameWords.dispatch, false);
  pass('9_3_BEFORE_CISCENJE_STANA_NEVER_MEETS_CISCENJE_STANA_WITH_DIACRITICS');
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
  writeFileSync(`${out}/pkg031-surface-before.txt`, before.join('\n') + '\n');
  const tampered = `${out}/pkg031a_no_cancel_after_done.tampered.sql`;
  writeFileSync(tampered, readFileSync('supabase/candidates/pkg031a_no_cancel_after_done.sql', 'utf8')
    .replace("'17dad1631c4cfe9fba6c2f05a3030062'", "'00000000000000000000000000000000'"));
  refuses('pkg031a (tampered)', 'PKG031A_PREDECESSOR_DRIFT', tampered);
  assert.deepEqual(surface(), before, 'A_REFUSED_CANDIDATE_LEFT_SOMETHING_BEHIND');
  pass('A_TAMPERED_PIN_IS_REFUSED_AND_LEAVES_NOTHING_BEHIND');
  for (const name of Object.keys(CANDIDATES)) psqlFile(`supabase/candidates/${name}.sql`);
  pass('BOTH_CANDIDATES_APPLY');
  for (const [name, code] of Object.entries(CANDIDATES)) refuses(name, code + '_ALREADY_APPLIED');
  pass('A_SECOND_APPLICATION_OF_EACH_IS_REFUSED');
  const after = surface();
  writeFileSync(`${out}/pkg031-surface-after.txt`, after.join('\n') + '\n');
  const removed = before.filter(l => !after.includes(l)), added = after.filter(l => !before.includes(l));
  report.surfaceRemoved = removed; report.surfaceAdded = added;
  assert.deepEqual(removed.map(changed).sort(), PATCHED.map(n => 'function:' + n).sort());
  assert.deepEqual(added.map(changed).sort(), [...PATCHED, ...ADDED].map(n => 'function:' + n).sort());
  pass('THE_SURFACE_CHANGES_BY_EXACTLY_THE_FOUR_PATCHED_AND_ONE_NEW_FUNCTION');
  const c = closure();
  assert.equal(c.live, closureBefore.live); assert.equal(c.live, c.certified); assert.equal(c.ready, true);
  report.closure = c;
  pass('THE_CERTIFIED_CLOSURE_SOURCE_DID_NOT_MOVE');
  save(); process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------
if (mode === 'after') {
  const s = scenarios(); report.after = s;
  const done = s.requesterAfterDone;
  assert.equal(done.requesterActions.canCancel, false, JSON.stringify(done));
  assert.equal(done.requesterActions.canConfirmCompletion, true);
  assert.equal(done.cancel, 'AGREEMENT_WORK_REPORTED_DONE');
  assert.equal(done.agreement, 'CONFIRMED'); assert.equal(done.execution, 'AWAITING_REQUESTER');
  pass('7_16_AFTER_DONE_THE_REQUESTER_IS_NOT_OFFERED_CANCEL_AND_A_CANCEL_IS_REFUSED_AND_CHANGES_NOTHING');
  assert.equal(s.workerAfterDone.workerActions.canCancel, true); assert.equal(s.workerAfterDone.cancel, 'OK');
  assert.equal(s.workerAfterDone.agreement, 'CANCELLED');
  assert.equal(s.requesterBeforeDone.requesterActions.canCancel, true); assert.equal(s.requesterBeforeDone.cancel, 'OK');
  assert.equal(s.requesterBeforeDone.agreement, 'CANCELLED');
  pass('7_16_THE_WORKER_AFTER_DONE_AND_THE_REQUESTER_BEFORE_DONE_CANCEL_AS_BEFORE');
  assert.equal(s.exclusion.control.dispatch, true, JSON.stringify(s.exclusion)); assert.equal(blocked(s.exclusion.control), false);
  assert.equal(blocked(s.exclusion.excludesMoving), true); assert.equal(s.exclusion.excludesMoving.dispatch, false);
  assert.equal(blocked(s.exclusion.excludesPainting), false); assert.equal(s.exclusion.excludesPainting.dispatch, true);
  pass('9_3_AFTER_AN_EXCLUSION_HOLDS_FOR_THE_SAME_KIND_OF_WORK_AND_ONLY_FOR_IT');
  assert.equal(s.skills.sameWords.serviceBlocked, false); assert.equal(s.skills.sameWords.dispatch, true);
  assert.equal(s.skills.otherTrade.serviceBlocked, true); assert.equal(s.skills.otherTrade.dispatch, false);
  pass('9_3_AFTER_THE_SAME_SKILL_IN_OTHER_LETTERS_MATCHES_AND_ANOTHER_TRADE_STILL_DOES_NOT');
  save(); process.exit(0);
}

throw new Error('UNKNOWN_MODE ' + mode);
