// An extra OPEN test Need after N04 has consumed its original Inbox fixture.
// The selected N04 Need is ACTIVE and correctly absent from W03 discovery.
// This local seed is not UI publication or production business proof.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDeviceProofTargets } from '../supabase/proofs/ru5_device_ui_local_guard.mjs';

const env = process.env;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.RU5_DEVICE_PACKAGE, 'rs.uskoci.n04proof');
const uuid = value => {
  assert.match(String(value), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return value;
};
const requesterId = uuid(env.RU5_DEVICE_REQUESTER_USER_ID);
const requester = createClient(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const login = await requester.auth.signInWithPassword({ email: env.RU5_DEVICE_REQUESTER_EMAIL, password: env.RU5_DEVICE_PASSWORD });
assert.equal(login.error, null, 'local requester authentication failed');
assert.equal(login.data.user.id, requesterId);
const profile = await requester.from('app_profiles').select('id').eq('account_id', requesterId).eq('kind', 'REQUESTER').single();
assert.equal(profile.error, null, 'local owner profile read failed');
const profileId = uuid(profile.data.id), needId = randomUUID();
const needTitle = `NAV discovery ${needId.slice(0, 8)}`;
const sql = query => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
sql(`begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at)
values('${needId}','${requesterId}','${profileId}','PUBLISHED','${needTitle}',
  'Disposable navigation-only open task fixture','PROOF','Novi Sad','Liman','OFFERS',1,
  statement_timestamp()+interval '2 days',statement_timestamp());
select set_config('uskoci.need_lifecycle','',true);
commit;`);
assert.equal(sql(`select count(*) from public.needs where id='${needId}' and status='PUBLISHED'`), '1');
writeFileSync(join(env.RU5_DEVICE_ARTIFACT_DIR, 'navigation-fixture.json'), JSON.stringify({
  needId, needTitle, requesterId, sourceSha: env.GITHUB_SHA, localOnly: true, publicationProof: false,
}, null, 2) + '\n');
console.log('PASS NAV_LOCAL_FIXTURE extra_open_need original_N04_fixture_preserved production_not_touched');
