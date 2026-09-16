#!/usr/bin/env node
/**
 * USKOČI disposable mass marketplace journey.
 *
 * Fixture authority only: service role confirms disposable Auth accounts and
 * direct local Postgres prepares READY Workers + PUBLISHED Needs. From the first
 * marketplace read onward, every product action uses a real user JWT and the
 * same canonical RPCs used by the app. No provider/AI call is made.
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
const records = [];
const stages = { authPairs: 0, applications: 0, selections: 0, messages: 0, completions: 0, reviews: 0 };

function sql(text) {
  return execFileSync('psql', [dbUrl, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', text], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function msBucket(name, ms) { (timings[name] ??= []).push(ms); }
function percentile(values, p) {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.ceil(a.length * p / 100) - 1))];
}
function timingSummary(values) {
  return { count: values.length, min: Math.min(...values), p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99), max: Math.max(...values) };
}
async function timed(name, fn) {
  const start = performance.now();
  try { return await fn(); }
  finally { msBucket(name, Math.round((performance.now() - start) * 100) / 100); }
}
async function requireOk(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}:${result.error.code ?? ''}:${result.error.message ?? 'unknown'}`);
  return result.data;
}
async function pool(items, limit, fn) {
  let cursor = 0; const errors = [];
  async function runner() {
    while (true) {
      const i = cursor++; if (i >= items.length) return;
      try { await fn(items[i], i); } catch (error) { errors.push({ i, error }); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  if (errors.length) {
    const first = errors[0];
    throw new Error(`MASS_PHASE_FAILED count=${errors.length} firstIndex=${first.i} first=${first.error instanceof Error ? first.error.message : String(first.error)}`);
  }
}
async function createSession(kind, index) {
  const client = createClient(url, anonKey, clientOptions);
  const email = `mass-${runId}-${kind}-${index}@proof.invalid`;
  const signup = await timed('auth.signup', () => client.auth.signUp({
    email, password, options: { data: { full_name: `Mass ${kind} ${index}`, city: 'Novi Sad' } },
  }));
  if (signup.error || !signup.data.user?.id) throw new Error(`SIGNUP_FAILED:${signup.error?.message ?? kind}`);
  if (!signup.data.session) {
    const confirmed = await admin.auth.admin.updateUserById(signup.data.user.id, { email_confirm: true });
    if (confirmed.error) throw new Error(`CONFIRM_FAILED:${confirmed.error.message}`);
    const login = await timed('auth.login', () => client.auth.signInWithPassword({ email, password }));
    if (login.error || !login.data.session) throw new Error(`LOGIN_FAILED:${login.error?.message ?? kind}`);
  }
  const me = await timed('auth.getUser', () => client.auth.getUser());
  if (me.error || me.data.user?.id !== signup.data.user.id) throw new Error('AUTH_IDENTITY_MISMATCH');
  const profiles = await requireOk('PROFILE_READ', client.from('app_profiles').select('id,kind').eq('account_id', signup.data.user.id));
  const profile = profiles.find(row => row.kind === (kind === 'requester' ? 'REQUESTER' : 'WORKER'));
  if (!profile?.id) throw new Error(`PROFILE_MISSING:${kind}`);
  return { client, accountId: signup.data.user.id, profileId: profile.id };
}

const state = Array.from({ length: pairs }, (_, index) => ({ index }));
await pool(state, concurrency, async (item, index) => {
  item.requester = await createSession('requester', index);
  item.worker = await createSession('worker', index);
  stages.authPairs += 1;
});
console.log(`MASS_STAGE auth pairs=${stages.authPairs}`);

// Fixture-only Worker readiness; marketplace commands below stay normal user JWTs.
sql(`begin;
alter table public.app_profiles disable trigger guard_profile_write_trg;
${state.map(({ worker }, i) => `update public.app_profiles set display_name='Mass Worker ${i}',city='Novi Sad',skills=array['Proof'],tools=array['ProofTool'],profile_status='ACTIVE',team_capacity=greatest(team_capacity,1) where id='${worker.profileId}'::uuid and account_id='${worker.accountId}'::uuid and kind='WORKER';`).join('\n')}
alter table public.app_profiles enable trigger guard_profile_write_trg;
commit;`);

for (const item of state) {
  item.needId = randomUUID();
  sql(`begin; select set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,response_deadline,published_at)
  values('${item.needId}'::uuid,'${item.requester.accountId}'::uuid,'${item.requester.profileId}'::uuid,'PUBLISHED','Mass journey ${item.index}','Disposable mass marketplace fixture','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp());
  select set_config('uskoci.need_lifecycle','',true); commit;`);
}

await pool(state, concurrency, async item => {
  const { requester, worker, needId, index } = item;
  const need = await timed('market.public_need_read', () => requireOk('NEED_READ', worker.client.from('needs')
    .select('id,status,revision,required_slots,covered_slots,mode').eq('id', needId).single()));
  assert.equal(need.status, 'PUBLISHED');

  const submit = {
    p_need_id: needId, p_need_revision: Number(need.revision), p_worker_profile_id: worker.profileId,
    p_covered_slots: 1, p_price_rsd: 3000 + index, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: null, p_client_request_id: `mass-submit-${randomUUID()}`,
  };
  const application = await timed('market.application_submit', () => requireOk('SUBMIT', worker.client.rpc('rpc_submit_response', submit)));
  assert.match(String(application.responseId ?? ''), /^[0-9a-f-]{36}$/i);
  assert.match(String(application.contentHash ?? ''), /^[0-9a-f]{64}$/);
  const replay = await timed('market.application_replay', () => requireOk('SUBMIT_REPLAY', worker.client.rpc('rpc_submit_response', submit)));
  assert.equal(replay.responseId, application.responseId);
  assert.equal(replay.contentHash, application.contentHash);
  stages.applications += 1;

  const candidates = await timed('market.candidate_read', () => requireOk('CANDIDATES', requester.client.rpc('rpc_list_need_candidates', { p_need_id: needId })));
  const candidate = candidates.find(row => row.responseId === application.responseId);
  assert.ok(candidate?.canSelect, 'CANDIDATE_NOT_SELECTABLE');

  const selection = {
    p_need_id: needId, p_need_revision: Number(need.revision), p_response_id: application.responseId,
    p_response_version: application.version, p_content_hash: application.contentHash,
    p_client_request_id: `mass-select-${randomUUID()}`,
  };
  const agreementId = await timed('market.selection', () => requireOk('SELECT', requester.client.rpc('rpc_select_response', selection)));
  assert.match(String(agreementId ?? ''), /^[0-9a-f-]{36}$/i);
  assert.equal(await timed('market.selection_replay', () => requireOk('SELECT_REPLAY', requester.client.rpc('rpc_select_response', selection))), agreementId);
  stages.selections += 1;

  if (pairs > 1) {
    const foreign = state[(index + 1) % state.length].requester;
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
  stages.messages += 2;

  assert.ok(await timed('market.mark_done', () => requireOk('MARK_DONE', worker.client.rpc('rpc_mark_work_done', { p_agreement_id: agreementId }))));
  const completed = await timed('market.confirm_completion', () => requireOk('CONFIRM_COMPLETION', requester.client.rpc('rpc_confirm_completion', { p_agreement_id: agreementId })));
  assert.equal(completed?.state, 'COMPLETED');
  assert.equal(completed?.agreementId, agreementId);
  stages.completions += 1;

  const r1 = await timed('market.review_requester', () => requireOk('REQUESTER_REVIEW', requester.client.rpc('rpc_submit_agreement_review', {
    p_agreement_id: agreementId, p_target_account_id: worker.accountId, p_rating: 5,
    p_tags: ['AS_AGREED', 'RELIABLE'], p_client_request_id: randomUUID(),
  })));
  assert.equal(r1?.targetAccountId, worker.accountId);
  const r2 = await timed('market.review_worker', () => requireOk('WORKER_REVIEW', worker.client.rpc('rpc_submit_agreement_review', {
    p_agreement_id: agreementId, p_target_account_id: requester.accountId, p_rating: 5,
    p_tags: ['CLEAR_COMMUNICATION'], p_client_request_id: randomUUID(),
  })));
  assert.equal(r2?.targetAccountId, requester.accountId);
  const reputation = await timed('market.reputation_read', () => requireOk('REPUTATION', requester.client.rpc('rpc_get_account_reputation', { p_account_id: worker.accountId })));
  assert.ok(Number(reputation?.reviewCount) >= 1, 'REVIEW_AGGREGATE_MISSING');
  stages.reviews += 2;

  item.applicationId = application.responseId;
  item.agreementId = agreementId;
  records.push({ index, needId, applicationId: application.responseId, agreementId });
});
console.log(`MASS_STAGE journeys=${records.length} applications=${stages.applications} selections=${stages.selections} completions=${stages.completions} reviews=${stages.reviews}`);

// Reviews are intentionally private (`private.agreement_reviews`); public trust is
// exposed only through the account reputation RPC/projection.
const invariant = JSON.parse(sql(`select json_build_object(
  'needs',(select count(*) from public.needs where title like 'Mass journey %'),
  'applications',(select count(*) from public.marketplace_responses r join public.needs n on n.id=r.need_id where n.title like 'Mass journey %'),
  'selections',(select count(*) from public.need_selections s join public.needs n on n.id=s.need_id where n.title like 'Mass journey %'),
  'agreements',(select count(*) from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %'),
  'completed',(select count(*) from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %' and a.status='COMPLETED'),
  'reviews',(select count(*) from private.agreement_reviews r join public.agreements a on a.id=r.agreement_id join public.needs n on n.id=a.need_id where n.title like 'Mass journey %'),
  'duplicate_need_agreements',(select count(*) from (select a.need_id from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %' group by a.need_id having count(*)<>1) x),
  'duplicate_response_agreements',(select count(*) from (select a.selected_response_id from public.agreements a join public.needs n on n.id=a.need_id where n.title like 'Mass journey %' group by a.selected_response_id having count(*)<>1) x)
)::text;`));

assert.equal(Number(invariant.needs), pairs);
assert.equal(Number(invariant.applications), pairs);
assert.equal(Number(invariant.selections), pairs);
assert.equal(Number(invariant.agreements), pairs);
assert.equal(Number(invariant.completed), pairs);
assert.equal(Number(invariant.reviews), pairs * 2);
assert.equal(Number(invariant.duplicate_need_agreements), 0);
assert.equal(Number(invariant.duplicate_response_agreements), 0);

const report = {
  unit: 'MASS_MARKETPLACE_JOURNEY', result: 'PASS', runId, target: url,
  disposableLocalOnly: true, providerCalled: false, serviceRoleMarketplaceCommand: false,
  pairs, users: pairs * 2, concurrency, completedJourneys: records.length, stages, invariants: invariant,
  latencyMs: Object.fromEntries(Object.entries(timings).map(([name, values]) => [name, timingSummary(values)])),
  createdAt: new Date().toISOString(),
};
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'mass-marketplace-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS MASS_MARKETPLACE_JOURNEY pairs=${pairs} users=${pairs * 2} agreements=${invariant.agreements} reviews=${invariant.reviews} provider_calls=0`);
