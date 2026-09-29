// P6 native acceptance fixture. LOCAL DISPOSABLE STACK ONLY (127.0.0.1:54321 / 54322, enforced below).
// Two real Auth accounts (an owner who publishes tasks and a viewer who signs in on the emulator) and a small
// published-task dataset with the same shape classes as the 30k load proof: a dense point, sparse localities,
// remote tasks and on-site tasks without a point. RLS stays ON for the viewer; rows are seeded as the database
// owner with triggers off (exactly like the sustained load proof), never through a production path.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../ru5_device_ui_local_guard.mjs';

const env = process.env;
const url = env.RU5_DEVICE_SUPABASE_URL, anonKey = env.RU5_DEVICE_ANON_KEY, serviceKey = env.RU5_DEVICE_SERVICE_ROLE_KEY;
const dbUrl = env.RU5_DEVICE_DB_URL, githubEnv = env.GITHUB_ENV;
for (const [k, v] of Object.entries({ RU5_DEVICE_SUPABASE_URL: url, RU5_DEVICE_ANON_KEY: anonKey,
  RU5_DEVICE_SERVICE_ROLE_KEY: serviceKey, RU5_DEVICE_DB_URL: dbUrl, GITHUB_ENV: githubEnv })) assert.ok(v, `${k} required`);
assertLocalDeviceProofTargets(url, dbUrl);
assert.equal(env.GITHUB_ACTIONS, 'true', 'P6_NATIVE_FIXTURE_CI_ONLY');

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, serviceKey, options);
const psql = (sql) => execFileSync('psql', [dbUrl, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'], {
  input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

const runId = randomUUID();
const password = `P6n${randomUUID().replaceAll('-', '')}Aa1`;
const ownerEmail = `p6n-owner-${runId}@proof.invalid`, viewerEmail = `p6n-viewer-${runId}@proof.invalid`;

async function account(email, first) {
  const client = createClient(url, anonKey, options);
  const signed = await client.auth.signUp({ email, password, options: { data: { first_name: first, last_name: 'P6N', city: 'Novi Sad' } } });
  if (signed.error) throw new Error(`SIGNUP_FAILED:${signed.error.message}`);
  const id = signed.data.user?.id; assert.ok(id, 'signup user id missing');
  if (!signed.data.session) {
    const confirmed = await admin.auth.admin.updateUserById(id, { email_confirm: true });
    if (confirmed.error) throw new Error(`FIXTURE_CONFIRM_FAILED:${confirmed.error.message}`);
  }
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  return { id, client };
}

const owner = await account(ownerEmail, 'Vlasnik');
const viewer = await account(viewerEmail, 'Gledalac');
assert.notEqual(owner.id, viewer.id);
const profiles = await owner.client.from('app_profiles').select('id,kind,profile_status').eq('account_id', owner.id);
if (profiles.error) throw profiles.error;
const ownerProfile = profiles.data.find((p) => p.kind === 'REQUESTER');
assert.ok(ownerProfile?.id, 'owner requester profile missing');

// Ordering by published_at desc is the list order, so title number 001 is the newest task.
// Kinds: i%10 in (1,2,3) DENSE (30) · (4,5,6,7) SPARSE (40) · 8 and i%20=10 REMOTE (15) · 9 and i%20=0 NOPOINT (15).
psql(`
begin;
set local statement_timeout='60s';
set local session_replication_role=replica;
insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,mode,required_slots,revision,
  schedule_kind,published_at,execution_location_mode,approximate_lat,approximate_lng,approximate_area,approximate_city,task_country_code,task_timezone)
select gen_random_uuid(),'${owner.id}'::uuid,'${ownerProfile.id}'::uuid,'PUBLISHED',
  'P6N '||lpad(i::text,3,'0')||' '||kind,'P6_NATIVE_PROOF','P6NATIVE','OFFERS',2,1,
  case when kind='REMOTE' then 'REMOTE_ANYTIME' else 'FLEXIBLE' end,
  statement_timestamp()-i*interval '1 minute',
  case when kind='REMOTE' then 'REMOTE' else 'STATIONARY' end,
  case kind when 'DENSE' then 45.25::numeric when 'SPARSE' then (array[44.7960,44.8430,43.3209,44.0128,46.1000,45.2510,43.8914,43.7258])[1+mod(i,8)]::numeric end,
  case kind when 'DENSE' then 19.83::numeric when 'SPARSE' then (array[20.4780,20.4010,21.8954,20.9114,19.6650,19.8650,20.3497,20.6894])[1+mod(i,8)]::numeric end,
  case kind when 'DENSE' then 'Liman' when 'SPARSE' then (array['Vračar','Zemun','Centar','Centar','Centar','Petrovaradin','Centar','Centar'])[1+mod(i,8)]
            when 'REMOTE' then 'Na daljinu' else 'Bez tačke' end,
  case kind when 'DENSE' then 'Novi Sad' when 'SPARSE' then (array['Beograd','Beograd','Niš','Kragujevac','Subotica','Novi Sad','Čačak','Kraljevo'])[1+mod(i,8)]
            when 'REMOTE' then '' else 'Novi Sad' end,
  'RS','Europe/Belgrade'
from (select i,case when mod(i,10) in (1,2,3) then 'DENSE' when mod(i,10) in (4,5,6,7) then 'SPARSE'
                    when mod(i,10)=8 or mod(i,20)=10 then 'REMOTE' else 'NOPOINT' end as kind
      from generate_series(1,100) i) k;
commit;
analyze public.needs;
`);

const counts = Object.fromEntries(psql(`select kind||'='||count(*) from (
  select case when title like '% DENSE' then 'DENSE' when title like '% SPARSE' then 'SPARSE'
              when title like '% REMOTE' then 'REMOTE' else 'NOPOINT' end kind
  from public.needs where category='P6NATIVE' and status='PUBLISHED') s group by kind order by kind`)
  .split('\n').map((l) => l.split('=')).map(([k, v]) => [k, Number(v)]));
assert.deepEqual(counts, { DENSE: 30, NOPOINT: 15, REMOTE: 15, SPARSE: 40 }, 'fixture distribution');
const total = Object.values(counts).reduce((a, b) => a + b, 0);
assert.equal(total, 100);

// The viewer must read the dataset through the ordinary authenticated path with the restricted Need ACL.
const acl = psql(`select has_table_privilege('authenticated','public.needs','SELECT')::text`);
assert.equal(acl, 'false', 'PKG045b restricted Need ACL must be in force (no whole-table SELECT)');
const probe = await viewer.client.rpc('rpc_discovery_v1', { p_request: { mode: 'PAGE', filter: { text: '', price: 'all', where: 'any', places: 1, when: 'any', dates: null, place: null },
  anchor: null, scope: { kind: 'ALL' }, limit: 5, after: null } });
if (probe.error) throw new Error(`VIEWER_RPC_FAILED:${probe.error.message}`);
assert.equal(probe.data.mode, 'PAGE');
assert.equal(probe.data.counts.everywhere, total, 'server total must equal the seeded published tasks');

mkdirSync(env.P6N_ARTIFACT_DIR || 'artifacts/p6-native', { recursive: true });
writeFileSync(`${env.P6N_ARTIFACT_DIR || 'artifacts/p6-native'}/fixture.json`, JSON.stringify({
  result: 'PASS', sourceSha: env.GITHUB_SHA, localOnly: true, ownerId: owner.id, viewerId: viewer.id, total, counts,
  restrictedNeedAcl: true, pageProbeCounts: probe.data.counts, titleFormat: 'P6N nnn KIND, 001 newest',
}, null, 2) + '\n');
console.log(`::add-mask::${password}`);
appendFileSync(githubEnv, [`P6N_VIEWER_EMAIL=${viewerEmail}`, `P6N_PASSWORD=${password}`, `P6N_OWNER_ID=${owner.id}`,
  `P6N_VIEWER_ID=${viewer.id}`, `P6N_TOTAL=${total}`, `P6N_ARTIFACT_DIR=${env.P6N_ARTIFACT_DIR || 'artifacts/p6-native'}`].map((l) => `${l}\n`).join(''));
console.log(`PASS P6_NATIVE_FIXTURE local real-auth accounts=2 needs=${total} restricted_need_acl page_probe_total=${probe.data.counts.everywhere}`);
