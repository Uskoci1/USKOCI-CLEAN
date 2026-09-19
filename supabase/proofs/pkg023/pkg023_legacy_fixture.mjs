// PKG-023 predecessor fixture. Runs on the disposable database BEFORE any pkg023 candidate is
// applied, through the real authority: a task with a confirmed place is published as it is published
// today. What it records is what the proof later compares against, after the candidates:
//   - the publication fingerprint of a task published before the ~100 m projection existed
//   - the coarse point an installed APK reads
//   - the closure source digest and its readiness
import {writeFileSync} from 'node:fs';
import {assert,sql,actor,publishedTask,fingerprint,needRow,q} from './pkg023_flow.mjs';

const target=process.env.PKG023_LEGACY_FILE;assert.ok(target,'PKG023_LEGACY_FILE required');
assert.equal(sql(`select count(*) from information_schema.columns where table_schema='public' and table_name='needs' and column_name in('public_lat','public_lng')`),'0',
 'the predecessor fixture must be taken before pkg023c');
assert.equal(sql(`select to_regprocedure('public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)') is null`),'t');

const owner=await actor('pkg023-legacy-owner');
const task=await publishedTask(owner,{facts:{title:'PKG023 task published before the candidates'}});
const row=needRow(task.needId);
assert.equal(row.status,'PUBLISHED');assert.equal(row.approximate_lat,'45.25');assert.equal(row.approximate_lng,'19.83');
const legacy={needId:task.needId,ownerId:owner.id,fingerprint:fingerprint(task.needId),approximateLat:row.approximate_lat,approximateLng:row.approximate_lng,
 exactLat:row.exact_lat,exactLng:row.exact_lng,
 closureSourceDigest:sql('select private.closure_source_digest_v5()'),
 closureSourceBound:sql('select (select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5()'),
 retentionReady:sql('select private.retention_ai_source_ready()'),
 draftFingerprintInputs:sql(`select md5(private.need_material_snapshot(${q(task.needId)}::uuid)::text)`)};
writeFileSync(target,JSON.stringify(legacy,null,2)+'\n');
console.log('PKG023_LEGACY_FIXTURE '+JSON.stringify({needId:legacy.needId,fingerprint:legacy.fingerprint.canonicalFingerprint,
 closureSourceBound:legacy.closureSourceBound,retentionReady:legacy.retentionReady}));
