import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.RU5_DEVICE_SUPABASE_URL;
const anonKey = process.env.RU5_DEVICE_ANON_KEY;
const serviceRoleKey = process.env.RU5_DEVICE_SERVICE_ROLE_KEY;
const dbUrl = process.env.RU5_DEVICE_DB_URL;
const githubEnv = process.env.GITHUB_ENV;

assert.ok(url, 'RU5_DEVICE_SUPABASE_URL required');
assert.ok(anonKey, 'RU5_DEVICE_ANON_KEY required');
assert.ok(serviceRoleKey, 'RU5_DEVICE_SERVICE_ROLE_KEY required');
assert.ok(dbUrl, 'RU5_DEVICE_DB_URL required');
assert.ok(githubEnv, 'GITHUB_ENV required');

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
const requester = createClient(url, anonKey, options);
const worker = createClient(url, anonKey, options);
const fixtureAdmin = createClient(url, serviceRoleKey, options);

const runId = randomUUID();
const requesterEmail = `ru5-device-requester-${runId}@proof.invalid`;
const workerEmail = `ru5-device-worker-${runId}@proof.invalid`;
const password = `Ru5Device${randomUUID().replaceAll('-', '')}Aa1`;
const needTitle = `RU5 device journey ${runId.slice(0, 8)}`;

function psql(sql) {
  return execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function createRealAccount(client, email, metadata) {
  const signed = await client.auth.signUp({ email, password, options: { data: metadata } });
  if (signed.error) throw new Error(`SIGNUP_FAILED:${signed.error.message}`);
  assert.ok(signed.data.user?.id, 'signup user id missing');
  if (!signed.data.session) {
    const confirmed = await fixtureAdmin.auth.admin.updateUserById(signed.data.user.id, { email_confirm: true });
    if (confirmed.error) throw new Error(`FIXTURE_CONFIRM_FAILED:${confirmed.error.message}`);
  }
  return signed.data.user;
}

const requesterUser = await createRealAccount(requester, requesterEmail, {
  first_name: 'RU5', last_name: 'Requester', city: 'Novi Sad',
});
const workerUser = await createRealAccount(worker, workerEmail, {
  first_name: 'RU5', last_name: 'Worker', city: 'Novi Sad', skills: ['Proof'],
});
assert.notEqual(requesterUser.id, workerUser.id, 'two distinct accounts required');

const requesterLogin = await requester.auth.signInWithPassword({ email: requesterEmail, password });
if (requesterLogin.error) throw requesterLogin.error;
const workerLogin = await worker.auth.signInWithPassword({ email: workerEmail, password });
if (workerLogin.error) throw workerLogin.error;

const requesterProfiles = await requester.from('app_profiles').select('id,kind,profile_status').eq('account_id', requesterUser.id);
if (requesterProfiles.error) throw requesterProfiles.error;
const requesterProfile = requesterProfiles.data.find((p) => p.kind === 'REQUESTER');
assert.equal(requesterProfile?.profile_status, 'ACTIVE', 'requester profile must be active');

const workerProfiles = await worker.from('app_profiles').select('id,kind,profile_status').eq('account_id', workerUser.id);
if (workerProfiles.error) throw workerProfiles.error;
const workerProfile = workerProfiles.data.find((p) => p.kind === 'WORKER');
assert.ok(workerProfile?.id, 'worker profile missing');

const update = await worker.from('app_profiles').update({
  display_name: 'RU5 Device Worker', city: 'Novi Sad', skills: ['Proof'], tools: ['ProofTool'],
  available_now: true, radius_km: 50,
}).eq('id', workerProfile.id);
if (update.error) throw update.error;
const activate = await worker.rpc('rpc_complete_worker_profile', { p_profile_id: workerProfile.id });
if (activate.error) throw activate.error;

const needId = randomUUID();
psql(`
begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
) values (
  '${needId}'::uuid,'${requesterUser.id}'::uuid,'${requesterProfile.id}'::uuid,
  'PUBLISHED','${needTitle}','Disposable physical Android emulator UI proof','PROOF',
  'Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()
);
select set_config('uskoci.need_lifecycle','',true);
commit;
`);

console.log(`::add-mask::${password}`);
appendFileSync(githubEnv, [
  `RU5_DEVICE_REQUESTER_EMAIL=${requesterEmail}`,
  `RU5_DEVICE_WORKER_EMAIL=${workerEmail}`,
  `RU5_DEVICE_PASSWORD=${password}`,
  `RU5_DEVICE_NEED_ID=${needId}`,
  `RU5_DEVICE_NEED_TITLE=${needTitle}`,
  `RU5_DEVICE_REQUESTER_USER_ID=${requesterUser.id}`,
  `RU5_DEVICE_WORKER_USER_ID=${workerUser.id}`,
  '',
].join('\n'));

console.log(`PASS RU5_DEVICE_UI_FIXTURE two_real_auth_accounts worker_active need=${needId} bounded_note_not_configured production_not_touched`);
