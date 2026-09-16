#!/usr/bin/env node
/**
 * USKOCI Phase 2 disposable marketplace mass journey.
 *
 * Safety model:
 * - LOCAL disposable Supabase only (127.0.0.1/localhost is mandatory);
 * - direct SQL is fixture-only: it seeds one already-public Need per Requester;
 * - every marketplace action after that seed uses a real authenticated user JWT
 *   and the same canonical RPCs used by the app;
 * - zero real AI provider calls;
 * - the workflow destroys the whole disposable database after the run.
 *
 * Journey per pair:
 * AUTH(Requester + Worker)
 * -> Worker profile activate
 * -> fixture-only PUBLISHED Need seed
 * -> Worker public Need read
 * -> rpc_submit_response (+ same-key replay)
 * -> Requester candidate read
 * -> concurrent same-command rpc_select_response replay
 * -> Agreement readback
 * -> Worker + Requester messages
 * -> Worker rpc_mark_work_done
 * -> Requester rpc_confirm_completion (+ terminal replay)
 * -> bilateral reviews
 * -> cross-pair hostile Agreement read
 * -> database invariant scan.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.RU5_DEVICE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const anonKey = process.env.RU5_DEVICE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.RU5_DEVICE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const dbUrl = process.env.RU5_DEVICE_DB_URL ?? process.env.DB_URL ?? '';
const pairs = intEnv('MASS_JOURNEY_PAIRS', 8, 1, 500);
const concurrency = intEnv('MASS_JOURNEY_CONCURRENCY', Math.min(8, pairs), 1, 50);
const out = resolve(process.env.MASS_JOURNEY_OUT ?? 'artifacts/mass-marketplace');
const runId = process.env.MASS_RUN_ID ?? `journey-${Date.now()}-${randomUUID().slice(0, 8)}`;

if (!url || !anonKey || !serviceRoleKey || !dbUrl) fail('MASS_JOURNEY_ENV_MISSING');
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url)) fail('MASS_JOURNEY_NON_LOCAL_TARGET_REFUSED');
if (!/(127\.0\.0\.1|localhost)/i.test(dbUrl)) fail('MASS_JOURNEY_NON_LOCAL_DB_REFUSED');
mkdirSync(out, { recursive: true });

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceRoleKey, options);
const report = {
  schemaVersion: 1,
  unit: 'USKOCI_MASS_MARKETPLACE_PHASE2',
  runId,
  startedAt: new Date().toISOString(),
  target: url,
  disposableLocalOnly: true,
  serviceRoleUsedForProductActions: false,
  realAiProviderCalls: 0,
  config: { pairs, concurrency },
  counts: { users: 0, needs: 0, applications: 0, agreements: 0, messages: 0, completions: 0, reviews: 0 },
  replay: { submitSamePayload: 0, selectConcurrentSameCommand: 0, completionTerminal: 0 },
  hostile: { agreementReads: 0, leaks: 0 },
  latencyMs: {},
  invariants: {},
  failures: [],
  result: 'RUNNING',
};
const timings = [];

function fail(code) { console.error(code); process.exit(2); }
function intEnv(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) fail(`${name}_INVALID`);
  return value;
}
function safeError(error) {
  return (error instanceof Error ? error.message : String(error)).replace(/eyJ[A-Za-z0-9._-]{20,}/g, '<jwt>').slice(0, 600);
}
function recordFailure(stage, index, error) {
  if (report.failures.length < 100) report.failures.push({ stage, index, error: safeError(error) });
}
function psql(sql) {
  return execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
async function timed(label, fn) {
  const start = performance.now();
  try { return await fn(); }
  finally { timings.push({ label, ms: performance.now() - start }); }
}
async function requireOk(label, promise) {
  const data = await timed(label, async () => {
    const result = await promise;
    if (result.error) throw new Error(`${label}:${result.error.message || result.error.code || 'UNKNOWN'}`);
    return result.data;
  });
  return data;
}
async function pool(items, limit, worker) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] * 100) / 100;
}
function finalizeLatency() {
  const all = timings.map(x => x.ms);
  const byStage = {};
  for (const item of timings) (byStage[item.label] ??= []).push(item.ms);
  report.latencyMs = {
    samples: all.length,
    p50: percentile(all, 50), p95: percentile(all, 95), p99: percentile(all, 99),
    stages: Object.fromEntries(Object.entries(byStage).map(([k, v]) => [k, { samples: v.length, p50: percentile(v, 50), p95: percentile(v, 95), p99: percentile(v, 99) }])),
  };
}

async function createSession(kind, index) {
  const client = createClient(url, anonKey, options);
  const email = `mass2.${runId}.${kind.toLowerCase()}.${String(index).padStart(4, '0')}@proof.invalid`;
  const password = `M2!${randomUUID()}Aa9`;
  let signed = await client.auth.signUp({ email, password, options: { data: { full_name: `Mass ${kind} ${index}`, city: 'Novi Sad', uskoci_mass_test: true, mass_test_run_id: runId } } });
  if (signed.error) throw new Error(`SIGNUP_${kind}_${signed.error.message}`);
  assert.ok(signed.data.user?.id, `${kind} user id missing`);
  if (!signed.data.session) {
    const confirmed = await admin.auth.admin.updateUserById(signed.data.user.id, { email_confirm: true });
    if (confirmed.error) throw new Error(`CONFIRM_${kind}_${confirmed.error.message}`);
    signed = await client.auth.signInWithPassword({ email, password });
  }
  if (signed.error || !signed.data.session) throw new Error(`LOGIN_${kind}_${signed.error?.message ?? 'session missing'}`);
  const current = await client.auth.getUser();
  if (current.error || current.data.user?.id !== signed.data.user?.id) throw new Error(`AUTH_SCOPE_${kind}`);
  report.counts.users += 1;
  return { client, accountId: current.data.user.id, email, password: null };
}

async function preparePair(index) {
  const requester = await createSession('REQUESTER', index);
  const worker = await createSession('WORKER', index);
  assert.notEqual(requester.accountId, worker.accountId);

  const requesterProfiles = await requireOk('profile.requester.read', requester.client.from('app_profiles').select('id,kind,profile_status').eq('account_id', requester.accountId));
  const requesterProfile = requesterProfiles.find(p => p.kind === 'REQUESTER');
  assert.ok(requesterProfile?.id, 'requester profile missing');

  const workerProfiles = await requireOk('profile.worker.read', worker.client.from('app_profiles').select('id,kind,profile_status').eq('account_id', worker.accountId));
  const workerProfile = workerProfiles.find(p => p.kind === 'WORKER');
  assert.ok(workerProfile?.id, 'worker profile missing');

  await requireOk('profile.worker.update', worker.client.from('app_profiles').update({
    display_name: `Mass Worker ${index}`, city: 'Novi Sad', skills: ['Selidbe'], tools: ['Kolica'], available_now: true, radius_km: 50,
  }).eq('id', workerProfile.id));
  await requireOk('profile.worker.activate', worker.client.rpc('rpc_complete_worker_profile', { p_profile_id: workerProfile.id }));

  return { index, requester, worker, requesterProfileId: requesterProfile.id, workerProfileId: workerProfile.id, needId: randomUUID() };
}

function seedNeeds(rows) {
  const values = rows.map(row => `('${row.needId}'::uuid,'${row.requester.accountId}'::uuid,'${row.requesterProfileId}'::uuid,'PUBLISHED','Mass journey ${row.index}','Disposable mass marketplace proof','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp())`).join(',\n');
  psql(`begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,response_deadline,published_at)
values ${values};
select set_config('uskoci.need_lifecycle','',true);
commit;`);
  report.counts.needs += rows.length;
}

async function journey(pair) {
  const { requester, worker, needId, workerProfileId } = pair;
  const need = await requireOk('need.public.read', worker.client.from('needs')
    .select('id,status,revision,required_slots,covered_slots,mode').eq('id', needId).single());
  assert.equal(need.status, 'PUBLISHED');

  const submitKey = `mass-submit-${randomUUID()}`;
  const submitArgs = {
    p_need_id: needId, p_need_revision: Number(need.revision), p_worker_profile_id: workerProfileId,
    p_covered_slots: 1, p_price_rsd: 3000 + pair.index, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: null, p_client_request_id: submitKey,
  };
  const submitted = await requireOk('application.submit', worker.client.rpc('rpc_submit_response', submitArgs));
  assert.ok(submitted?.responseId && submitted?.contentHash && submitted?.version);
  report.counts.applications += 1;

  const submitReplay = await requireOk('application.submit.replay', worker.client.rpc('rpc_submit_response', submitArgs));
  assert.equal(submitReplay.responseId, submitted.responseId);
  assert.equal(submitReplay.contentHash, submitted.contentHash);
  report.replay.submitSamePayload += 1;

  const candidates = await requireOk('candidate.owner.read', requester.client.rpc('rpc_list_need_candidates', { p_need_id: needId }));
  const candidate = candidates.find(c => c.responseId === submitted.responseId);
  assert.ok(candidate && candidate.canSelect === true);

  const selectArgs = {
    p_need_id: needId, p_need_revision: Number(need.revision), p_response_id: submitted.responseId,
    p_response_version: submitted.version, p_content_hash: submitted.contentHash, p_client_request_id: `mass-select-${randomUUID()}`,
  };
  const [agreementA, agreementB] = await Promise.all([
    requireOk('selection.concurrent', requester.client.rpc('rpc_select_response', selectArgs)),
    requireOk('selection.concurrent', requester.client.rpc('rpc_select_response', selectArgs)),
  ]);
  assert.equal(agreementA, agreementB);
  const agreementId = agreementA;
  assert.match(String(agreementId), /^[0-9a-f-]{36}$/i);
  pair.agreementId = agreementId;
  pair.applicationId = submitted.responseId;
  report.counts.agreements += 1;
  report.replay.selectConcurrentSameCommand += 1;

  await requireOk('message.worker', worker.client.rpc('rpc_send_agreement_message_v2', {
    p_expected_user_id: worker.accountId, p_agreement_id: agreementId, p_client_message_id: `mw-${randomUUID()}`, p_body: 'Mass test worker poruka',
  }));
  await requireOk('message.requester', requester.client.rpc('rpc_send_agreement_message_v2', {
    p_expected_user_id: requester.accountId, p_agreement_id: agreementId, p_client_message_id: `mr-${randomUUID()}`, p_body: 'Mass test requester poruka',
  }));
  report.counts.messages += 2;

  await requireOk('completion.mark', worker.client.rpc('rpc_mark_work_done', { p_agreement_id: agreementId }));
  const completed = await requireOk('completion.confirm', requester.client.rpc('rpc_confirm_completion', { p_agreement_id: agreementId }));
  assert.equal(completed?.agreementId, agreementId);
  assert.equal(completed?.state, 'COMPLETED');
  const completedReplay = await requireOk('completion.confirm.replay', requester.client.rpc('rpc_confirm_completion', { p_agreement_id: agreementId }));
  assert.equal(completedReplay?.agreementId, agreementId);
  assert.equal(completedReplay?.state, 'COMPLETED');
  report.counts.completions += 1;
  report.replay.completionTerminal += 1;

  const rr = await requireOk('review.requester', requester.client.rpc('rpc_submit_agreement_review', {
    p_agreement_id: agreementId, p_target_account_id: worker.accountId, p_rating: 5,
    p_tags: ['AS_AGREED','CLEAR_COMMUNICATION'], p_client_request_id: randomUUID(),
  }));
  assert.equal(rr?.agreementId, agreementId);
  const wr = await requireOk('review.worker', worker.client.rpc('rpc_submit_agreement_review', {
    p_agreement_id: agreementId, p_target_account_id: requester.accountId, p_rating: 5,
    p_tags: ['AS_AGREED','RESPECTFUL'], p_client_request_id: randomUUID(),
  }));
  assert.equal(wr?.agreementId, agreementId);
  report.counts.reviews += 2;
}

async function hostileAgreementRead(pair, victim) {
  report.hostile.agreementReads += 1;
  const result = await pair.worker.client.from('agreements').select('id').eq('id', victim.agreementId);
  if (result.error) throw new Error(`HOSTILE_AGREEMENT_READ_${result.error.message}`);
  if ((result.data ?? []).length !== 0) {
    report.hostile.leaks += result.data.length;
    throw new Error('CROSS_PAIR_AGREEMENT_LEAK');
  }
}

function invariantScan(rows) {
  const ids = rows.map(x => `'${x.needId}'::uuid`).join(',');
  const agreementIds = rows.map(x => `'${x.agreementId}'::uuid`).join(',');
  const raw = psql(`select json_build_object(
    'needs', (select count(*) from public.needs where id in (${ids})),
    'applications', (select count(*) from public.marketplace_responses where need_id in (${ids})),
    'agreements', (select count(*) from public.agreements where need_id in (${ids})),
    'duplicateNeedAgreements', (select count(*) from (select need_id from public.agreements where need_id in (${ids}) group by need_id having count(*) > 1) s),
    'overfilledNeeds', (select count(*) from public.needs where id in (${ids}) and covered_slots > required_slots),
    'messages', (select count(*) from public.agreement_messages where agreement_id in (${agreementIds})),
    'completed', (select count(*) from public.agreements where id in (${agreementIds}) and status='COMPLETED'),
    'reviews', (select count(*) from public.agreement_reviews where agreement_id in (${agreementIds}))
  )::text;`);
  const inv = JSON.parse(raw);
  report.invariants = inv;
  assert.equal(Number(inv.needs), rows.length, 'Need count mismatch');
  assert.equal(Number(inv.applications), rows.length, 'Application count mismatch');
  assert.equal(Number(inv.agreements), rows.length, 'Agreement count mismatch');
  assert.equal(Number(inv.duplicateNeedAgreements), 0, 'duplicate Agreement per one-slot Need');
  assert.equal(Number(inv.overfilledNeeds), 0, 'overfilled Need');
  assert.equal(Number(inv.messages), rows.length * 2, 'message count mismatch');
  assert.equal(Number(inv.completed), rows.length, 'completion count mismatch');
  assert.equal(Number(inv.reviews), rows.length * 2, 'review count mismatch');
}

const rows = [];
try {
  const indexes = Array.from({ length: pairs }, (_, i) => i);
  await pool(indexes, concurrency, async index => {
    try { rows[index] = await preparePair(index); }
    catch (error) { recordFailure('prepare', index, error); }
  });
  if (rows.filter(Boolean).length !== pairs) throw new Error('PAIR_PREPARATION_INCOMPLETE');

  seedNeeds(rows);

  await pool(rows, concurrency, async (pair, index) => {
    try { await journey(pair); }
    catch (error) { recordFailure('journey', index, error); }
  });
  if (rows.some(row => !row.agreementId)) throw new Error('JOURNEY_INCOMPLETE');

  if (rows.length > 1) {
    await pool(rows, concurrency, async (pair, index) => {
      try { await hostileAgreementRead(pair, rows[(index + 1) % rows.length]); }
      catch (error) { recordFailure('hostile-agreement', index, error); }
    });
  }
  if (report.hostile.leaks) throw new Error('HOSTILE_SCOPE_LEAK');

  invariantScan(rows);
  report.result = report.failures.length === 0 ? 'PASS' : 'FAIL';
} catch (error) {
  recordFailure('fatal', -1, error);
  report.result = 'FAIL';
} finally {
  finalizeLatency();
  report.finishedAt = new Date().toISOString();
  writeFileSync(resolve(out, 'mass-marketplace-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    result: report.result, runId, pairs, agreements: report.counts.agreements,
    messages: report.counts.messages, completions: report.counts.completions,
    reviews: report.counts.reviews, hostileLeaks: report.hostile.leaks,
    p95Ms: report.latencyMs.p95 ?? null, realAiProviderCalls: 0,
  }));
  process.exitCode = report.result === 'PASS' ? 0 : 1;
}
