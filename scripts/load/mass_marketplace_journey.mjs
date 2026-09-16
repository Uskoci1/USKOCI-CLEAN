#!/usr/bin/env node
/**
 * USKOČI disposable mass marketplace journey.
 *
 * Fixture-only authority:
 * - service-role is used only to confirm disposable Auth users;
 * - direct Postgres is used only to make Worker fixtures READY and seed one
 *   PUBLISHED Need per Requester because publication/AI are not the subject of
 *   this load phase.
 *
 * Product authority under test:
 * - every Application, candidate read, Selection, Agreement message,
 *   completion and Review uses a real per-user JWT and the canonical RPCs the
 *   app calls;
 * - no service-role call performs a marketplace command;
 * - no AI/provider call is made.
 *
 * Required environment:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DB_URL
 * Optional:
 *   MASS_PAIRS        default 4, range 1..200
 *   MASS_CONCURRENCY  default 4, range 1..50
 *   MASS_RUN_ID       optional deterministic label
 *   MASS_OUT          default artifacts/mass-user-chaos
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = String(process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const dbUrl = process.env.DB_URL ?? '';
const pairs = Number(process.env.MASS_PAIRS ?? 4);
const concurrency = Number(process.env.MASS_CONCURRENCY ?? 4);
const runId = String(process.env.MASS_RUN_ID ?? randomUUID());
const outDir = resolve(process.env.MASS_OUT ?? 'artifacts/mass-user-chaos');

if (!url || !anonKey || !serviceRoleKey || !dbUrl) throw new Error('MASS_MARKETPLACE_ENV_MISSING');
if (!Number.isInteger(pairs) || pairs < 1 || pairs > 200) throw new Error('MASS_PAIRS_INVALID');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) throw new Error('MASS_CONCURRENCY_INVALID');
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(url)) throw new Error('MASS_MARKETPLACE_DISPOSABLE_LOCAL_ONLY');

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceRoleKey, clientOptions);
const password = `Mass-${randomUUID()}-Aa1!`;
const timings = {};
const createdUserIds = [];
const records = [];

function msBucket(name, ms) { (timings[name] ??= []).push(ms); }
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}
function summary(values) {
  return { count: values.length, min: Math.min(...values), p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99), max: Math.max(...values) };
}
function sql(text) {
  return execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', text], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function q(value) { return String(value).replaceAll("'", "''"); }
async function timed(name, fn) {
  const started = performance.now();
  try { return await fn(); } finally { msBucket(name, Math.round((performance.now() - started) * 100) / 100); }
}
async function requireOk(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}:${result.error.code ?? ''}:${result.error.message ?? 'unknown'}`);
  return result.data;
}
async function withPool(items, limit, fn) {
  let cursor = 0;
  const errors = [];
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { await fn(items[index], index); } catch (error) { errors.push({ index, error }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (errors.length) {
    const first = errors[0];
    throw new Error(`MASS_PHASE_FAILED count=${errors.length} firstIndex=${first.index} first=${first.error instanceof Error ? first.error.message : String(first.error)}`);
  }
}

async function createSession(kind, index) {
  const client = createClient(url, anonKey, clientOptions);
  const email = `mass-${runId}-${kind}-${index}@proof.invalid`;
  const signed = await timed('auth.signup', () => client.auth.signUp({ email, password, options: { data: { full_name: `Mass ${kind} ${index}`, city: 'Novi Sad' } } }));
  if (signed.error || !signed.data.user?.id) throw new Error(`SIGNUP_FAILED:${signed.error?.message ?? kind}`);
  createdUserIds.push(signed.data.user.id);
  if (!signed.data.session) {
    const confirmed = await admin.auth.admin.updateUserById(signed.data.user.id, { email_confirm: true });
    if (confirmed.error) throw new Error(`CONFIRM_FAILED:${confirmed.error.message}`);
    const login = await timed('auth.login', () => client.auth.signInWithPassword({ email, password }));
    if (login.error || !login.data.session) throw new Error(`LOGIN_FAILED:${login.error?.message ?? kind}`);
  }
  const me = await timed('auth.getUser', () => client.auth.getUser());
  if (me.error || me.data.user?.id !== signed.data.user.id) throw new Error('AUTH_IDENTITY_MISMATCH');
  const profiles = await requireOk('PROFILE_READ', client.from('app_profiles').select('id,kind,profile_status').eq('account_id', signed.data.user.id));
  const profile = profiles.find(row => row.kind === (kind === 'requester' ? 'REQUESTER' : 'WORKER'));
  if (!profile?.id) throw new Error(`PROFILE_MISSING:${kind}`);
  return { client, accountId: signed.data.user.id, profileId: profile.id, email };
}

const pairState = Array.from({ length: pairs }, (_, index) => ({ index }));
await withPool(pairState, concurrency, async (state, index) => {
  state.requester = await createSession('requester', index);
  state.worker = await createSession('worker', index);
});

// Disposable fixture only. The production marketplace commands below do NOT use
// this privileged channel. Current Selection authority requires ACTIVE, name,
// city, >=1 skill and sufficient team_capacity.
sql(`
begin;
alter table public.app_profiles disable trigger guard_profile_write_trg;
${pairState.map(({ worker }, i) => `
update public.app_profiles set
  display_name='Mass Worker ${i}', city='Novi Sad', skills=array['Proof'], tools=array['ProofTool'],
  profile_status='ACTIVE', team_capacity=greatest(team_capacity,1)
where id='${worker.profileId}'::uuid and account_id='${worker.accountId}'::uuid and kind='WORKER';`).join('\n')}
alter table public.app_profiles enable trigger guard_profile_write_trg;
commit;
`);

for (const state of pairState) {
  const needId = randomUUID();
  state.needId = needId;
  sql(`
begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
) values (
  '${needId}'::uuid,'${state.requester.accountId}'::uuid,'${state.requester.profileId}'::uuid,
  'PUBLISHED','Mass journey ${state.index}','Disposable mass marketplace fixture','PROOF',
  'Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()
);
select set_config('uskoci.need_lifecycle','',true);
commit;`);
}

await withPool(pairState, concurrency, async (state) => {
  const { requester, worker, needId, index } = state;

  const need = await timed('market.public_need_read', () => requireOk('NEED_READ', worker.client.from('needs')
    .select('id,status,revision,required_slots,covered_slots,mode').eq('id', needId).single()));
  assert.equal(need.status, 'PUBLISHED');

  const submitKey = `mass-submit-${randomUUID()}`;
  const submitPayload = {
    p_need_id: needId,
    p_need_revision: Number(need.revision),
    p_worker_profile_id: worker.profileId,
    p_covered_slots: 1,
    p_price_rsd: 3000 + index,
    p_proposed_start_at: null,
    p_proposed_end_at: null,
    p_scope_note: null,
    p_client_request_id: submitKey,
  };
  const application = await timed('market.application_submit', () => requireOk('SUBMIT', worker.client.rpc('rpc_submit_response', submitPayload)));
  assert.match(String(application.responseId ?? ''), /^[0-9a-f-]{36}$/i);
  assert.match(String(application.contentHash ?? ''), /^[0-9a-f]{64}$/);

  const replay = await timed('market.application_replay', () => requireOk('SUBMIT_REPLAY', worker.client.rpc('rpc_submit_response', submitPayload)));
  assert.equal(replay.responseId, application.responseId);
  assert.equal(replay.contentHash, application.contentHash);

  const candidates = await timed('market.candidate_read', () => requireOk('CANDIDATES', requester.client.rpc('rpc_list_need_candidates', { p_need_id: needId })));
  const candidate = candidates.find(row => row.responseId === application.responseId);
  assert.ok(candidate?.canSelect, 'candidate not selectable');

  const selectKey = `mass-select-${randomUUID()}`;
  const selectPayload = {
    p_need_id: needId,
    p_need_revision: Number(need.revision),
    p_response_id: application.responseId,
    p_response_version: application.version,
    p_content_hash: application.contentHash,
    p_client_request_id: selectKey,
  };
  const agreementId = await timed('market.selection', () => requireOk('SELECT', requester.client.rpc('rpc_select_response', selectPayload)));
  assert.match(String(agreementId ?? ''), /^[0-9a-f-]{36}$/i);
  const agreementReplay = await timed('market.selection_replay', () => requireOk('SELECT_REPLAY', requester.client.rpc('rpc_select_response', selectPayload)));
  assert.equal(agreementReplay, agreementId);

  // Cross-pair privacy: another requester must not see this Agreement's messages.
  const foreign = pairState[(index + 1) % pairState.length].requester;
  if (pairs > 1) {
    const leaked = await timed('security.foreign_message_read', () => requireOk('FOREIGN_MESSAGE_READ', foreign.client.from('agreement_messages').select('id').eq('agreement_id', agreementId)));
    assert.equal(leaked.length, 0, 'CROSS_ACCOUNT_MESSAGE_LEAK');
  }

  await timed('market.message_requester', () => requireOk('REQUESTER_MESSAGE', requester.client.rpc('rpc_send_agreement_message_v2', {
    p_expected_user_id: requester.accountId, p_agreement_id: agreementId,
    p_client_message_id: `mass-r-${randomUUID()}`, p_body: `Requester ${index}`,
  })));
  await timed('market.message_worker', () => requireOk('WORKER_MESSAGE', worker.client.rpc('rpc_send_agreement_message_v2', {
    p_expected_user_id: worker.accountId, p_agreement_id: agreementId,
    p_client_message_id: `mass-w-${randomUUID()}`, p_body: `Worker ${index}`,
  })));

  const marked = await timed('market.mark_done', () => requireOk('MARK_DONE', worker.client.rpc('rpc_mark_work_done', { p_agreement_id: agreementId })));
  assert.ok(marked, 'mark done receipt missing');
  const completed = await timed('market.confirm_completion', () => requireOk('CONFIRM_COMPLETION', requester.client.rpc('rpc_confirm_completion', { p_agreement_id: agreementId })));
  assert.equal(completed?.state, 'COMPLETED');
  assert.equal(completed?.agreementId, agreementId);

  const requesterReview = await timed('market.review_requester', () => requireOk('REQUESTER_REVIEW', requester.client.rpc('rpc_submit_agreement_review', {
    p_agreement_id: agreementId, p_target_account_id: worker.accountId, p_rating: 5,
    p_tags: ['AS_AGREED', 'RELIABLE'], p_client_request_id: randomUUID(),
  })));
  assert.equal(requesterReview?.targetAccountId, worker.accountId);
  const workerReview = await timed('market.review_worker', () => requireOk('WORKER_REVIEW', worker.client.rpc('rpc_submit_agreement_review', {
    p_agreement_id: agreementId, p_target_account_id: requester.accountId, p_rating: 5,
    p_tags: ['CLEAR_COMMUNICATION'], p_client_request_id: randomUUID(),
  })));
  assert.equal(workerReview?.targetAccountId, requester.accountId);

  const reputation = await timed('market.reputation_read', () => requireOk('REPUTATION', requester.client.rpc('rpc_get_account_reputation', { p_account_id: worker.accountId })));
  assert.ok(Number(reputation?.reviewCount) >= 1, 'review aggregate missing');

  state.applicationId = application.responseId;
  state.agreementId = agreementId;
  records.push({ index, needId, applicationId: application.responseId, agreementId });
});

const invariant = JSON.parse(sql(`
select json_build_object(
  'needs', (select count(*) from public.needs where title like 'Mass journey %'),
  'applications', (select count(*) from public.marketplace_responses r join public.needs n on n.id=r.need_id where n.title like 'Mass journey %'),
  'selections', (select count(*) from public.need_selections s join public.needs n on n.id=s.need_id where n.title like 'Mass journey %'),
  'agreements', (select count(*) from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %'),
  'completed', (select count(*) from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %' and a.status='COMPLETED'),
  'reviews', (select count(*) from public.agreement_reviews r join public.agreements a on a.id=r.agreement_id join public.needs n on n.id=a.need_id where n.title like 'Mass journey %'),
  'duplicate_need_agreements', (select count(*) from (select a.need_id from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %' group by a.need_id having count(*)<>1) x),
  'duplicate_response_agreements', (select count(*) from (select a.selected_response_id from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %' group by a.selected_response_id having count(*)<>1) x)
)::text;
`));

assert.equal(Number(invariant.needs), pairs);
assert.equal(Number(invariant.applications), pairs);
assert.equal(Number(invariant.selections), pairs);
assert.equal(Number(invariant.agreements), pairs);
assert.equal(Number(invariant.completed), pairs);
assert.equal(Number(invariant.reviews), pairs * 2);
assert.equal(Number(invariant.duplicate_need_agreements), 0);
assert.equal(Number(invariant.duplicate_response_agreements), 0);

const report = {
  unit: 'MASS_MARKETPLACE_JOURNEY',
  result: 'PASS',
  runId,
  target: url,
  disposableLocalOnly: true,
  providerCalled: false,
  serviceRoleMarketplaceCommand: false,
  pairs,
  users: pairs * 2,
  concurrency,
  completedJourneys: records.length,
  invariants: invariant,
  latencyMs: Object.fromEntries(Object.entries(timings).map(([name, values]) => [name, summary(values)])),
  createdAt: new Date().toISOString(),
};
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'mass-marketplace-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS MASS_MARKETPLACE_JOURNEY pairs=${pairs} users=${pairs * 2} agreements=${invariant.agreements} reviews=${invariant.reviews} provider_calls=0`);
