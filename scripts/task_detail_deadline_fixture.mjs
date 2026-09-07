// Separate disposable public-deadline Need, armed only when the native journey is ready.
// This is fixture setup, never UI publication or production admission proof.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertLocalDeviceProofTargets } from '../supabase/proofs/ru5_device_ui_local_guard.mjs';

const env = process.env;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL, env.RU5_DEVICE_DB_URL);
assert.equal(env.RU5_DEVICE_PACKAGE, 'rs.uskoci.n04proof');
assert.equal(env.RU5_DEVICE_PROOF_DIR, '/tmp/uskoci-ru5-device-ui');
const uuid = value => {
  assert.match(String(value), /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  return value;
};
const requesterId = uuid(env.RU5_DEVICE_REQUESTER_USER_ID);
const sql = query => execFileSync('psql', [env.RU5_DEVICE_DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', query],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const profileId = uuid(sql(`select id from public.app_profiles where account_id='${requesterId}' and kind='REQUESTER'`));
const needId = randomUUID(), needTitle = `W04 deadline ${needId.slice(0, 8)}`;
sql(`begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at)
values('${needId}','${requesterId}','${profileId}','PUBLISHED','${needTitle}',
  'Disposable task detail deadline fixture','PROOF','Novi Sad','Liman','OFFERS',1,
  statement_timestamp()+interval '60 seconds',statement_timestamp());
select set_config('uskoci.need_lifecycle','',true);
commit;`);
const deadlineEpoch = Number(sql(`select extract(epoch from response_deadline) from public.needs where id='${needId}' and status='PUBLISHED'`));
assert.ok(Number.isFinite(deadlineEpoch) && deadlineEpoch > Date.now() / 1000);
writeFileSync(join(env.RU5_DEVICE_ARTIFACT_DIR, 'task-detail-deadline-fixture.json'), JSON.stringify({
  needId, needTitle, requesterId, deadlineEpoch, sourceSha: env.GITHUB_SHA, localOnly: true, publicationProof: false,
}, null, 2) + '\n');
console.log('PASS W04_LOCAL_DEADLINE_FIXTURE original_N04_and_NAV_preserved production_not_touched');
