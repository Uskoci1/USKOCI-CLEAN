// Local Postgres only. Synthetic read-model fixtures live in rolled-back transactions.
// This proves the read contract and real SQL role boundary, NOT a completed user journey/Auth login.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const db = process.env.DB_URL;
assert.equal(db, 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', 'DISPOSABLE_LOCAL_TARGET_ONLY');
assert.match(process.env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
const out = process.env.PRE_V3_ARTIFACT_DIR;
assert.ok(out); mkdirSync(out, {recursive: true});
const sql = text => {
  try { return execFileSync('psql', [db, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At'],
    {input: text, encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024}).trim(); }
  catch (error) { throw new Error(String(error.stderr ?? error.message)); }
};
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const file = 'supabase/candidates/pkg023j_home_attention.sql';
const candidate = readFileSync(file, 'utf8');
assert.deepEqual(Buffer.from(candidate), execFileSync('git', ['show', process.env.GITHUB_SHA + ':' + file]));
const surface = () => sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8'));
const present = () => sql("select to_regprocedure('public.rpc_home_attention()') is not null") === 't';
const ready = () => sql('select private.retention_ai_source_ready() and private.closure_source_digest_v5() = (select sha256 from private.closure_source_v5 where singleton)');

if (process.argv.includes('--before')) {
  assert.ok(present(), 'PKG023J_MISSING_AGGREGATE_EXPECTED_BEFORE');
  throw new Error('PKG023J_BEFORE_UNEXPECTEDLY_PRESENT');
}
if (process.argv.includes('--apply')) {
  assert.ok(!present()); assert.equal(ready(), 't');
  const before = surface();
  writeFileSync(out + '/surface-before.txt', before + '\n');
  writeFileSync(out + '/closure-before.txt', sql('select private.closure_source_digest_v5()'));
  const badPin = candidate.replace('6ce809c2939714451e60876ab3885115', '00000000000000000000000000000000');
  assert.throws(() => sql(badPin), /PKG023J_PREDECESSOR_DRIFT/);
  assert.equal(surface(), before); assert.ok(!present());
  const badBody = candidate.replace("'schemaVersion', 1,", "'schemaVersion', 2,");
  assert.notEqual(badBody, candidate);
  assert.throws(() => sql(badBody), /PKG023J_BODY_MISMATCH/);
  assert.equal(surface(), before); assert.ok(!present());
  sql(candidate); assert.ok(present());
  console.log('PASS candidate predecessor pin and body pin fail closed; exact candidate applied locally');
  process.exit(0);
}

assert.ok(present(), 'PKG023J_MISSING_AGGREGATE_EXPECTED_BEFORE');
// Load the actual pure client composer with the already locked TypeScript dependency.
// Restrict this temporary loader to its three pure source modules, then restore Node's loader.
const require = createRequire(import.meta.url), ts = require('typescript');
const allowed = new Set(['src/data/homeSnapshot.ts', 'src/data/marketplaceView.ts', 'src/ui/system/plural.ts'].map(p => resolve(p)));
const oldLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, filename) => {
  assert.ok(allowed.has(filename), 'UNEXPECTED_ORACLE_DEPENDENCY ' + filename);
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
  }).outputText, filename);
};
const {composeHome} = require(resolve('src/data/homeSnapshot.ts'));
if (oldLoader) require.extensions['.ts'] = oldLoader; else delete require.extensions['.ts'];

const report = {package: 'PKG-023j', sourceSha: process.env.GITHUB_SHA,
  candidateSha256: createHash('sha256').update(candidate).digest('hex'), result: 'RUNNING',
  environment: 'disposable source-147 + exact pkg023a, NOT a full DEV-164 replay',
  canonicalDevAccess: false, providerCalls: false, deviceTest: false, actualAuthLogin: false,
  realPostgresRoles: true, fixtureTransactionsRolledBack: true, checks: []};
const check = (name, fn) => { fn(); report.checks.push({name, result: 'PASS'}); console.log('PASS ' + name); };
const subjects = [];
function fixture() {
  const owner = randomUUID(), other = randomUUID(), stranger = randomUUID();
  const profiles = Object.fromEntries([owner, other, stranger].map(id => [id, {REQUESTER: randomUUID(), WORKER: randomUUID()}]));
  subjects.push(owner, other, stranger);
  const statements = ['begin;', "set local statement_timeout='30s';", 'set local session_replication_role=replica;'];
  for (const id of [owner, other, stranger]) {
    statements.push(`insert into auth.users(id) values(${q(id)});
      insert into public.app_accounts(id,email) values(${q(id)},${q(id + '@proof.invalid')});`);
    for (const kind of ['REQUESTER','WORKER']) statements.push(`insert into public.app_profiles(id,account_id,kind,display_name,city)
      values(${q(profiles[id][kind])},${q(id)},${q(kind)},'Proof person','Novi Sad');`);
  }
  let tick = 0;
  const instant = n => q(new Date(Date.UTC(2026, 8, 1, 0, 0, n ?? tick++)).toISOString());
  const need = ({who = owner, status = 'PUBLISHED', slots = 2, revision = 1, at} = {}) => {
    const id = randomUUID();
    statements.push(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,
      required_slots,revision,created_at) values(${q(id)},${q(who)},${q(profiles[who].REQUESTER)},${q(status)},${q('Task ' + id)},
      'Read-contract fixture','PROOF','OFFERS',${slots},${revision},${instant(at)});`);
    return {id, who, status, slots, revision};
  };
  const application = (task, {who = other, status = 'SUBMITTED', revision = task.revision, at, submittedNull = false} = {}) => {
    const id = randomUUID();
    statements.push(`insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,
      submitted_against_need_revision,price_rsd,submitted_at,created_at) values(${q(id)},${q(task.id)},${q(who)},${q(profiles[who].WORKER)},
      'APPLICATION',${q(status)},${revision},1000,${submittedNull ? 'null' : instant(at)},${instant()});`);
    return {id, who};
  };
  const selection = (task, app, {slots = 1, status = 'SELECTED'} = {}) => {
    const id = randomUUID();
    statements.push(`insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,
      response_id,worker_account_id,worker_profile_id,selection_mode,status) values(${q(id)},${q(task.id)},${task.revision},${q(task.who)},
      ${q(id)},${slots},${q(app.id)},${q(app.who)},${q(profiles[app.who].WORKER)},'REQUESTER_SELECTS',${q(status)});`);
    return id;
  };
  const agreement = (task, app, {state = 'CONFIRMED', problem = false, execution = true, at, version = true} = {}) => {
    const id = randomUUID(), sid = selection(task, app);
    statements.push(`insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,
      worker_account_id,worker_profile_id,created_at) values(${q(id)},${q(task.id)},${q(sid)},${q(app.id)},${q(task.who)},${q(profiles[task.who].REQUESTER)},
      ${q(app.who)},${q(profiles[app.who].WORKER)},${instant(at)});`);
    if (version) statements.push(`insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
      values(${q(id)},1,'CONFIRMED','{"price_rsd":1000,"covered_slots":1}','0123456789abcdef',${q(task.who)});`);
    if (execution) statements.push(`insert into public.agreement_execution(agreement_id,agreement_version,state,requester_deadline_at,problem_opened_at)
      values(${q(id)},1,${q(state)},'2026-09-22T12:00:00Z',${problem ? "'2026-09-19T12:00:00Z'" : 'null'});`);
    return id;
  };
  const auth = who => `set local role authenticated; set local request.jwt.claim.sub=${q(who)};`;
  const read = (who = owner) => JSON.parse(sql(statements.join('\n') + `
    set local session_replication_role=origin; ${auth(who)}
    select jsonb_build_object('actual',public.rpc_home_attention(),
      'needs',public.rpc_list_my_needs_page('ALL',100),
      'applications',public.rpc_list_my_applications(),
      'agreements',public.rpc_list_my_agreements_page('ALL',100)); rollback;`));
  return {owner, other, stranger, need, application, selection, agreement, statements, auth, read};
}
function compare(raw, actor) {
  assert.equal(raw.needs.hasMore, false, 'fixture exceeds oracle page; do not silently truncate');
  assert.equal(raw.agreements.hasMore, false, 'fixture exceeds oracle page; do not silently truncate');
  // Adapter only: server legacy facts -> fields consumed by the real composeHome/hasNeedAttention.
  // This workflow replays the historical PKG-023j contract, before PKG-035 separated history from
  // eligibility. Adapt its attention count explicitly; current eligibility is proved by PKG-035.
  const needs = raw.needs.items.map(n => ({id: n.id, naslov: n.title, brojPrijava: n.applicationCount, brojPrijavaZaIzbor: n.applicationCount,
    stanje: n.status === 'DRAFT' ? 'NACRT' : ['COMPLETED','CANCELLED','EXPIRED','ARCHIVED'].includes(n.status) ? 'ZATVORENA' : 'OBJAVLJENA',
    pokrivenost: {preostalo: Math.max(0, n.requiredSlots - Math.max(0, Math.min(n.requiredSlots, n.coveredSlots)))}, vremeTekst: 'Fleksibilno'}));
  const applications = raw.applications.map(a => ({prijavaId: a.applicationId, naslov: a.title, stanje: a.state,
    promenjenaPotreba: a.requiresStaleReview, traziPaznju: a.attentionRequired, cena: {prikaz: '1.000 RSD'}}));
  const agreements = raw.agreements.items.map(a => ({id: a.id, naslov: a.title, stanje: a.status,
    problemOtvoren: a.problemOpened, pocinje: a.startsAt, vremeTekst: 'Fleksibilno',
    ucesnici: [{viSte: true, uloga: a.requesterAccountId === actor ? 'narucilac' : 'uskocer'}]}));
  const home = composeHome({needs: {kind: 'known', value: needs}, applications: {kind: 'known', value: applications},
    agreements: {kind: 'known', value: agreements}});
  const identity = row => ({AGREEMENT_CONFIRM_COMPLETION: `agreement:${row.agreementId}:confirm`,
    AGREEMENT_OPEN_PROBLEM: `agreement:${row.agreementId}:problem`, APPLICATION_STALE: `application:${row.applicationId}:stale`,
    APPLICATION_ATTENTION: `application:${row.applicationId}:attention`, TASK_APPLICATIONS: `need:${row.taskId}:applications`})[row.reason];
  assert.deepEqual(raw.actual.items.map(identity), home.attention.map(x => x.id));
  assert.equal(raw.actual.schemaVersion, 1); assert.ok(Number.isFinite(Date.parse(raw.actual.asOf)));
  assert.ok(raw.actual.items.length <= 3);
  const counts = raw.actual.counts;
  assert.equal(counts.attentionMore, home.attentionMore);
  assert.equal(counts.agreementsMore, home.agreements.value.more);
  assert.equal(counts.activitiesMore, home.activities.value.more);
  assert.equal(counts.attention, home.attention.length + home.attentionMore);
  assert.equal(counts.activeAgreements, home.agreements.value.rows.length + home.agreements.value.more);
  assert.equal(counts.activities, home.activities.value.rows.length + home.activities.value.more);
  assert.equal(counts.activities, counts.ownActiveTasks + counts.activeApplications);
  assert.equal(counts.ownActiveTasks, needs.filter(n => n.stanje !== 'ZATVORENA').length);
  assert.equal(counts.activeApplications, applications.filter(a => ['SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED'].includes(a.stanje)).length);
  for (const row of raw.actual.items) {
    assert.deepEqual(Object.keys(row).sort(), ['reason','subjectId','taskId','agreementId','applicationId','taskTitle','applicationCount','sortAt'].sort());
    assert.equal(row.taskTitle, 'Task ' + row.taskId);
    assert.ok(row.sortAt === null || Number.isFinite(Date.parse(row.sortAt)));
    if (row.reason === 'TASK_APPLICATIONS') {
      const n = raw.needs.items.find(n => n.id === row.taskId);
      assert.equal(row.applicationCount, n.applicationCount); assert.equal(row.sortAt, n.sortAt);
      assert.equal(row.subjectId, n.id); assert.equal(row.applicationId, null); assert.equal(row.agreementId, null);
    } else if (row.reason.startsWith('APPLICATION_')) {
      const a = raw.applications.find(a => a.applicationId === row.applicationId);
      assert.equal(row.applicationCount, null); assert.equal(row.sortAt, a.submittedAt);
      assert.equal(row.subjectId, a.applicationId); assert.equal(row.taskId, a.needId); assert.equal(row.agreementId, null);
    } else {
      const a = raw.agreements.items.find(a => a.id === row.agreementId);
      assert.equal(row.applicationCount, null); assert.equal(row.sortAt, a.sortAt);
      assert.equal(row.subjectId, a.id); assert.equal(row.applicationId, null);
    }
  }
  return raw.actual;
}

try {
  check('grants, fixed search_path, definer and closed private schema', () => {
    assert.equal(sql(`select has_function_privilege('authenticated','public.rpc_home_attention()','EXECUTE')
      and not has_function_privilege('anon','public.rpc_home_attention()','EXECUTE')
      and not has_function_privilege('service_role','public.rpc_home_attention()','EXECUTE')
      and not has_schema_privilege('authenticated','private','USAGE')
      and (select prosecdef and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='public.rpc_home_attention()'::regprocedure)`), 't');
    assert.throws(() => sql('begin; set local role anon; select public.rpc_home_attention(); rollback;'), /permission denied/);
    assert.throws(() => sql('begin; set local role service_role; select public.rpc_home_attention(); rollback;'), /permission denied/);
    assert.throws(() => sql("begin; set local role authenticated; set local request.jwt.claim.sub=''; select public.rpc_home_attention(); rollback;"), /AUTH_REQUIRED/);
  });
  check('empty account: explicit zero, no invented attention', () => { const f = fixture(); const a = compare(f.read(), f.owner); assert.equal(a.counts.attention, 0); });
  check('task statuses, visible response count, drafts and coverage (F02 preserved explicitly)', () => {
    const f = fixture();
    for (const status of ['DRAFT','PUBLISHED','SELECTION','ACTIVE','COMPLETED','CANCELLED','EXPIRED','ARCHIVED']) {
      const n = f.need({status}); f.application(n, {status: 'WITHDRAWN'});
    }
    const empty = f.need(); f.application(empty, {status: 'DRAFT'});
    const full = f.need({slots: 1}); const app = f.application(full); f.selection(full, app);
    const cancelled = f.need(); const c = f.application(cancelled); f.selection(cancelled, c, {status: 'CANCELLED'});
    const a = compare(f.read(), f.owner); assert.equal(a.counts.attention, 4); assert.equal(a.counts.ownActiveTasks, 7);
    const first = a.items.find(x => x.taskId === cancelled.id); assert.equal(first.applicationCount, 1);
    assert.equal(compare(f.read(f.stranger), f.stranger).counts.attention, 0);
  });
  check('application state precedence, submitted order, null/tied instants, selected and stale terminal rows', () => {
    const f = fixture();
    for (const status of ['DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED','WITHDRAWN','NOT_SELECTED','EXPIRED','STALE']) {
      for (const changed of [false, true]) {
        const n = f.need({who: f.other, revision: changed ? 2 : 1}); f.application(n, {who: f.owner, status, revision: 1, at: 12});
      }
    }
    const closed = f.need({who: f.other, status: 'ARCHIVED', revision: 2});
    f.application(closed, {who: f.owner, revision: 1, submittedNull: true});
    const a = compare(f.read(), f.owner); assert.ok(a.counts.attention > 3); assert.ok(a.items.every(x => x.reason === 'APPLICATION_STALE'));
  });
  check('agreement sides, duplicate reasons, execution fallback, ended rows and missing current version', () => {
    const f = fixture();
    for (const who of [f.owner, f.other]) for (const state of ['CONFIRMED','AWAITING_REQUESTER','COMPLETED','CANCELLED']) {
      const n = f.need({who, slots: 1}), a = f.application(n, {who: who === f.owner ? f.other : f.owner, status: 'SELECTED'});
      f.agreement(n, a, {state, problem: true, at: 10});
    }
    const n = f.need({slots: 1}), app = f.application(n, {status: 'SELECTED'});
    f.agreement(n, app, {execution: false});
    const bad = f.need({slots: 1}), b = f.application(bad, {status: 'SELECTED'});
    f.agreement(bad, b, {state: 'AWAITING_REQUESTER', version: false});
    const a = compare(f.read(), f.owner); assert.equal(a.counts.activeAgreements, 5); assert.equal(a.counts.attention, 5);
    assert.equal(a.items[0].reason, 'AGREEMENT_CONFIRM_COMPLETION');
    compare(f.read(f.other), f.other); assert.equal(compare(f.read(f.stranger), f.stranger).counts.attention, 0);
  });
  check('all four rules together: three-item payload, totals beyond a 30-row first page', () => {
    const f = fixture();
    for (let i = 0; i < 55; i++) {
      const n = f.need({slots: 1}), app = f.application(n, {status: 'SELECTED'});
      f.agreement(n, app, {state: i < 2 ? 'AWAITING_REQUESTER' : 'CONFIRMED', problem: i === 0});
    }
    for (let i = 0; i < 7; i++) { const n = f.need(); f.application(n, {status: i % 2 ? 'WITHDRAWN' : 'SUBMITTED'}); }
    for (let i = 0; i < 60; i++) { const n = f.need({who: f.other, revision: 2}); f.application(n, {who: f.owner, revision: 1}); }
    const a = compare(f.read(), f.owner);
    assert.equal(a.counts.attention, 70); assert.equal(a.counts.attentionMore, 67);
    assert.equal(a.counts.activeAgreements, 55); assert.equal(a.counts.agreementsMore, 53);
    assert.equal(a.counts.activities, 122); assert.equal(a.counts.activitiesMore, 117);
    assert.deepEqual(a.items.map(x => x.reason), ['AGREEMENT_CONFIRM_COMPLETION','AGREEMENT_CONFIRM_COMPLETION','AGREEMENT_OPEN_PROBLEM']);
    assert.ok(JSON.stringify(a).length < 2500, 'wire payload must stay bounded');
  });
  check('account closure fence rejects an otherwise readable aggregate', () => {
    const f = fixture(); const n = f.need(); f.application(n);
    f.statements.push(`insert into private.account_closure_requests(account_id,state,revision) values(${q(f.owner)},'READY',1);`);
    assert.throws(() => f.read(), /ACCOUNT_CLOSING/);
  });
  check('fixtures leave no accounts; candidate adds one function only; closure and ledger unchanged', () => {
    assert.equal(sql(`select count(*) from public.app_accounts where id in (${subjects.map(q).join(',')})`), '0');
    assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '147');
    assert.equal(ready(), 't');
    assert.equal(sql('select private.closure_source_digest_v5()'), readFileSync(out + '/closure-before.txt', 'utf8'));
    const before = readFileSync(out + '/surface-before.txt', 'utf8').trim().split('\n'), after = surface().split('\n');
    assert.deepEqual(before.filter(x => !after.includes(x)), []);
    const added = after.filter(x => !before.includes(x)); assert.equal(added.length, 1);
    assert.ok(added[0].startsWith('function:public.rpc_home_attention():'));
    writeFileSync(out + '/surface-after.txt', after.join('\n') + '\n');
    assert.throws(() => sql(candidate), /PKG023J_ALREADY_APPLIED/);
    assert.deepEqual(surface().split('\n'), after);
  });
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL'; report.failure = error.stack; process.exitCode = 1; console.error(error);
} finally {
  writeFileSync(out + '/pkg023j-proof.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report.result + ' PKG023J_HOME_ATTENTION');
}
