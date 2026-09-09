// W02 calendar authority: authenticated disposable proof only. The workflow
// reconstructs current source on loopback Supabase and applies W02 before this
// file runs. No production project, provider or hidden fixture mutation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const env = process.env;
const url = env.RU5_DEVICE_SUPABASE_URL;
const db = env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url, db);
const out = env.W02_CALENDAR_ARTIFACT_DIR || 'artifacts/w02-calendar-authority';
mkdirSync(out, { recursive: true });
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const requester = createClient(url, env.RU5_DEVICE_ANON_KEY, options);
const worker = createClient(url, env.RU5_DEVICE_ANON_KEY, options);
const anon = createClient(url, env.RU5_DEVICE_ANON_KEY, options);
const requesterId = env.RU5_DEVICE_REQUESTER_USER_ID;
const workerId = env.RU5_DEVICE_WORKER_USER_ID;
const report = {
  unit: 'W02_CALENDAR_AUTHORITY', source_sha: env.GITHUB_SHA || null, run_id: env.GITHUB_RUN_ID || null,
  live_access: false, live_promotion: false, provider_called: false, visual_design_changed: false,
  checks: [], race: null,
};
let current = 'PREFLIGHT';
const check = name => { current = name; console.log(`START_CHECK ${name}`); };
const pass = () => { report.checks.push({ name: current, result: 'PASS' }); console.log(`PASS_CHECK ${current}`); };
const uuid = value => { assert.match(String(value), /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i); return String(value); };
const q = value => `'${String(value).replaceAll("'", "''")}'`;
function sql(query) {
  try {
    return execFileSync('psql', [db, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
      input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    throw new Error('DISPOSABLE_SQL_FAILED');
  }
}
const rows = query => JSON.parse(sql(`select coalesce(json_agg(x),'[]'::json) from (${query}) x`));
const ok = async promise => { const result = await promise; if (result.error) throw new Error(`AUTH_RPC_FAILED:${result.error.message}`); return result.data; };
const rpcError = async promise => { const result = await promise; assert.ok(result.error, 'expected RPC rejection'); return result.error; };
const iso = milliseconds => new Date(Date.now() + milliseconds).toISOString();

async function createNeed(start, end, label) {
  const id = randomUUID();
  const requesterProfile = uuid(sql(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid and kind='REQUESTER'`));
  sql(`begin;
    select set_config('uskoci.need_lifecycle','PUBLISH',true);
    insert into public.needs(
      id,requester_account_id,requester_profile_id,status,title,description,category,
      approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,
      response_deadline,published_at
    ) values (
      ${q(id)}::uuid,${q(requesterId)}::uuid,${q(requesterProfile)}::uuid,
      'PUBLISHED',${q(`W02 ${label}`)},'Disposable calendar authority proof','PROOF',
      'Novi Sad','Liman','OFFERS',1,'FIXED_WINDOW',${q(start)}::timestamptz,${q(end)}::timestamptz,
      statement_timestamp()+interval '2 days',statement_timestamp()
    );
    select set_config('uskoci.need_lifecycle','',true);
    commit;`);
  return id;
}

async function apply(needId, start, end, label) {
  const workerProfile = uuid(sql(`select id from public.app_profiles where account_id=${q(workerId)}::uuid and kind='WORKER'`));
  const revision = Number(sql(`select revision from public.needs where id=${q(needId)}::uuid`));
  return ok(worker.rpc('rpc_submit_response', {
    p_need_id: needId,
    p_need_revision: revision,
    p_worker_profile_id: workerProfile,
    p_covered_slots: 1,
    p_price_rsd: 3000,
    p_proposed_start_at: start,
    p_proposed_end_at: end,
    p_scope_note: `W02 ${label}`,
    p_client_request_id: `w02-submit-${label}-${randomUUID()}`,
  }));
}

function selection(needId, response, label) {
  return {
    p_need_id: needId,
    p_need_revision: response.needRevision,
    p_response_id: response.responseId,
    p_response_version: response.version,
    p_content_hash: response.contentHash,
    p_client_request_id: `w02-select-${label}-${randomUUID()}`,
  };
}

async function calendar(from, to) {
  return ok(worker.rpc('rpc_get_worker_calendar', { p_from: from, p_to: to }));
}

try {
  check('EXACT_SOURCE_OBJECTS_PRIVILEGES_AND_EMPTY_BACKFILL');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '94');
  for (const object of [
    "to_regclass('private.worker_calendar_events') is not null",
    "to_regprocedure('private.worker_calendar_conflict(uuid,timestamptz,timestamptz,uuid)') is not null",
    "to_regprocedure('private.refresh_worker_calendar_event(uuid)') is not null",
    "to_regprocedure('private.match_detail_without_calendar(uuid,uuid)') is not null",
    "to_regprocedure('public.rpc_get_worker_calendar(timestamptz,timestamptz)') is not null",
  ]) assert.equal(sql(`select ${object}`), 't');
  for (const privilege of ['SELECT','INSERT','UPDATE','DELETE']) {
    assert.equal(sql(`select has_table_privilege('authenticated','private.worker_calendar_events','${privilege}')`), 'f');
  }
  assert.equal(sql("select has_function_privilege('authenticated','public.rpc_get_worker_calendar(timestamptz,timestamptz)','EXECUTE')"), 't');
  assert.equal(sql("select has_function_privilege('anon','public.rpc_get_worker_calendar(timestamptz,timestamptz)','EXECUTE')"), 'f');
  assert.equal(sql("select count(*) from private.worker_calendar_events"), '0', 'pre-existing unscheduled proof Agreement must not invent a busy interval');
  pass();

  check('TWO_REAL_AUTH_ACCOUNTS_AND_OWNER_ONLY_CALENDAR_READ');
  for (const [client, email, id] of [[requester, env.RU5_DEVICE_REQUESTER_EMAIL, requesterId], [worker, env.RU5_DEVICE_WORKER_EMAIL, workerId]]) {
    await ok(client.auth.signInWithPassword({ email, password: env.RU5_DEVICE_PASSWORD }));
    assert.equal((await ok(client.auth.getUser())).user.id, id);
  }
  const broadFrom = iso(24 * 60 * 60 * 1000);
  const broadTo = iso(14 * 24 * 60 * 60 * 1000);
  assert.deepEqual((await calendar(broadFrom, broadTo)).events, []);
  assert.ok((await anon.rpc('rpc_get_worker_calendar', { p_from: broadFrom, p_to: broadTo })).error);
  assert.deepEqual((await ok(requester.rpc('rpc_get_worker_calendar', { p_from: broadFrom, p_to: broadTo }))).events, []);
  pass();

  const aStart = iso(3 * 24 * 60 * 60 * 1000);
  const aEnd = iso((3 * 24 + 2) * 60 * 60 * 1000);
  const needA = await createNeed(aStart, aEnd, 'race-a');
  const needB = await createNeed(aStart, aEnd, 'race-b');
  const responseA = await apply(needA, aStart, aEnd, 'race-a');
  const responseB = await apply(needB, aStart, aEnd, 'race-b');

  check('CONCURRENT_OVERLAPPING_SELECTIONS_EXACTLY_ONE_WINS');
  const race = await Promise.all([
    requester.rpc('rpc_select_response', selection(needA, responseA, 'race-a')),
    requester.rpc('rpc_select_response', selection(needB, responseB, 'race-b')),
  ]);
  const winners = race.map((item, index) => ({ item, index })).filter(entry => !entry.item.error);
  const losers = race.map((item, index) => ({ item, index })).filter(entry => entry.item.error);
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  const failure = String(losers[0].item.error.message);
  const detail = String(losers[0].item.error.details ?? '');
  assert.ok(failure === 'WORKER_CALENDAR_CONFLICT' || (failure === 'WORKER_NO_LONGER_ELIGIBLE' && detail.includes('CALENDAR_CONFLICT')),
    `unexpected loser error ${failure} ${detail}`);
  const agreementA = uuid(winners[0].item.data);
  const winningNeed = winners[0].index === 0 ? needA : needB;
  assert.equal(sql(`select count(*) from public.agreements where need_id in (${q(needA)}::uuid,${q(needB)}::uuid)`), '1');
  assert.equal(sql("select count(*) from private.worker_calendar_events where state='BLOCKING'"), '1');
  report.race = { winnerNeed: winningNeed, loserError: failure };
  pass();

  check('MATCHING_AND_APPLICATION_PATH_EXPOSE_CALENDAR_HARD_BLOCKER');
  const overlapNeed = await createNeed(aStart, aEnd, 'blocked-application');
  const workerProfile = uuid(sql(`select id from public.app_profiles where account_id=${q(workerId)}::uuid and kind='WORKER'`));
  const hard = JSON.parse(sql(`select private.match_detail(${q(overlapNeed)}::uuid,${q(workerProfile)}::uuid)::text`));
  assert.ok(hard.hardBlockers.includes('CALENDAR_CONFLICT'));
  assert.equal(hard.responseAllowed, false);
  assert.equal(hard.dispatchEligible, false);
  const blockedApply = await worker.rpc('rpc_submit_response', {
    p_need_id: overlapNeed, p_need_revision: 1, p_worker_profile_id: workerProfile,
    p_covered_slots: 1, p_price_rsd: 3000, p_proposed_start_at: aStart, p_proposed_end_at: aEnd,
    p_scope_note: 'blocked', p_client_request_id: `w02-blocked-${randomUUID()}`,
  });
  assert.ok(blockedApply.error);
  assert.equal(blockedApply.error.message, 'WORKER_NOT_ELIGIBLE');
  assert.ok(String(blockedApply.error.details).includes('CALENDAR_CONFLICT'));
  pass();

  check('BACK_TO_BACK_INTERVAL_IS_ALLOWED_AND_CALENDAR_RPC_IS_AUTHORITATIVE');
  const bStart = aEnd;
  const bEnd = new Date(Date.parse(aEnd) + 60 * 60 * 1000).toISOString();
  const needC = await createNeed(bStart, bEnd, 'back-to-back');
  const responseC = await apply(needC, bStart, bEnd, 'back-to-back');
  const agreementC = uuid(await ok(requester.rpc('rpc_select_response', selection(needC, responseC, 'back-to-back'))));
  const active = await calendar(broadFrom, broadTo);
  assert.equal(active.authoritative, true);
  assert.equal(active.events.length, 2);
  assert.deepEqual(active.events.map(event => event.agreementId).sort(), [agreementA, agreementC].sort());
  assert.equal(sql("select count(*) from private.worker_calendar_events where state='BLOCKING'"), '2');
  pass();

  check('CONFLICTING_ACCEPTED_CHANGE_ROLLS_BACK_CURRENT_VERSION_AND_EVENT');
  const proposalConflict = uuid(await ok(requester.rpc('rpc_propose_agreement_change_v2', {
    p_agreement_id: agreementA,
    p_expected_version: 1,
    p_patch: { proposed_start_at: bStart, proposed_end_at: bEnd },
    p_reason: 'W02 conflicting move proof',
    p_client_request_id: `w02-change-conflict-${randomUUID()}`,
  })));
  const conflictAccept = await worker.rpc('rpc_respond_agreement_change', { p_proposal_id: proposalConflict, p_accept: true });
  assert.ok(conflictAccept.error);
  assert.equal(conflictAccept.error.message, 'WORKER_CALENDAR_CONFLICT');
  assert.equal(sql(`select current_version from public.agreements where id=${q(agreementA)}::uuid`), '1');
  assert.equal(sql(`select agreement_version from private.worker_calendar_events where agreement_id=${q(agreementA)}::uuid`), '1');
  assert.equal(sql(`select starts_at=${q(aStart)}::timestamptz and ends_at=${q(aEnd)}::timestamptz from private.worker_calendar_events where agreement_id=${q(agreementA)}::uuid`), 't');
  pass();

  check('FREE_ACCEPTED_CHANGE_ATOMICALLY_MOVES_BUSY_INTERVAL');
  const cStart = new Date(Date.parse(bEnd) + 60 * 60 * 1000).toISOString();
  const cEnd = new Date(Date.parse(cStart) + 60 * 60 * 1000).toISOString();
  const proposalFree = uuid(await ok(requester.rpc('rpc_propose_agreement_change_v2', {
    p_agreement_id: agreementA,
    p_expected_version: 1,
    p_patch: { proposed_start_at: cStart, proposed_end_at: cEnd },
    p_reason: 'W02 free move proof',
    p_client_request_id: `w02-change-free-${randomUUID()}`,
  })));
  const moved = await ok(worker.rpc('rpc_respond_agreement_change', { p_proposal_id: proposalFree, p_accept: true }));
  assert.equal(moved.agreementVersion, 2);
  assert.equal(sql(`select agreement_version from private.worker_calendar_events where agreement_id=${q(agreementA)}::uuid`), '2');
  assert.equal(sql(`select starts_at=${q(cStart)}::timestamptz and ends_at=${q(cEnd)}::timestamptz and state='BLOCKING' from private.worker_calendar_events where agreement_id=${q(agreementA)}::uuid`), 't');
  pass();

  check('CANCELLATION_RELEASES_INTERVAL_AND_A_NEW_SELECTION_CAN_REUSE_IT');
  await ok(requester.rpc('rpc_cancel_agreement', { p_agreement_id: agreementC, p_reason: 'W02 cancellation proof' }));
  assert.equal(sql(`select state from private.worker_calendar_events where agreement_id=${q(agreementC)}::uuid`), 'RELEASED');
  assert.equal((await calendar(broadFrom, broadTo)).events.some(event => event.agreementId === agreementC), false);
  const reuseNeed = await createNeed(bStart, bEnd, 'reuse-cancelled-slot');
  const reuseResponse = await apply(reuseNeed, bStart, bEnd, 'reuse-cancelled-slot');
  const reuseAgreement = uuid(await ok(requester.rpc('rpc_select_response', selection(reuseNeed, reuseResponse, 'reuse-cancelled-slot'))));
  assert.equal(sql(`select state from private.worker_calendar_events where agreement_id=${q(reuseAgreement)}::uuid`), 'BLOCKING');
  pass();

  check('FINAL_SECURITY_HISTORY_AND_SOURCE_OF_TRUTH_POSTFLIGHT');
  assert.equal(sql("select count(*) from private.worker_calendar_events where state='BLOCKING'"), '2');
  assert.equal(sql("select count(*) from private.worker_calendar_events where state='RELEASED'"), '1');
  assert.equal(sql("select count(*) from private.worker_calendar_events e left join public.agreements a on a.id=e.agreement_id where a.id is null"), '0');
  assert.equal(sql("select count(*) from private.worker_calendar_events e join public.agreements a on a.id=e.agreement_id where e.state='BLOCKING' and a.status<>'CONFIRMED'"), '0');
  assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'), '94');
  report.function_fingerprints = rows(`select oid::regprocedure::text signature,md5(prosrc) prosrc_md5,prosecdef,proconfig
    from pg_proc where oid in (
      'private.match_detail(uuid,uuid)'::regprocedure,
      'private.match_detail_without_calendar(uuid,uuid)'::regprocedure,
      'private.refresh_worker_calendar_event(uuid)'::regprocedure,
      'public.rpc_get_worker_calendar(timestamptz,timestamptz)'::regprocedure
    ) order by 1`);
  pass();

  report.result = 'PASS';
  console.log('PASS W02_CALENDAR_AUTHORITY');
} catch (error) {
  report.result = 'FAIL';
  report.failed_check = current;
  report.error = error instanceof Error ? error.message : 'UNKNOWN';
  console.error('FAIL W02_CALENDAR_AUTHORITY', current, report.error);
  process.exitCode = 1;
} finally {
  writeFileSync(`${out}/proof-report.json`, `${JSON.stringify(report, null, 2)}\n`);
}
