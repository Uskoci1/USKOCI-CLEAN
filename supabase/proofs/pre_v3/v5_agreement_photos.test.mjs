// Structural regressions supplement (never replace) the real144 SQL/Storage proof.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync('supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql','utf8');
const proof=readFileSync('supabase/proofs/pre_v3/v5_agreement_photos_proof.mjs','utf8');
const body=name=>{const start=sql.indexOf('create function '+name+'(');assert.ok(start>=0,name);const end=sql.indexOf('end $f$;',start);assert.ok(end>start,name);return sql.slice(start,end);};
test('forward144 leaves the two canonical text RPCs unchanged and never seeds a lifetime or policy',()=>{
 assert.ok(!/create(?: or replace)? function public\.rpc_send_agreement_message(?:_v2)?\(/i.test(sql));
 assert.match(sql,/add column photo_asset_ids uuid\[\] not null default '\{\}'/);assert.match(sql,/deferrable initially deferred/);
 assert.ok(!/(?:delete from|truncate) public\.agreement_messages|insert into private\.retention_policy|cron\.schedule|create.*bucket|GEMINI/i.test(sql));
 assert.match(proof,/assert\.deepEqual\(rows\([\s\S]+\),oldWriters\)/);
});
test('new attachment writes check exact current accepted version while historical reads require participant membership only',()=>{
 const context=body('private.agreement_photo_context_v5');assert.match(context,/if writing then[\s\S]*closure_assert_open[\s\S]*safety_assert_pair[\s\S]*v<>ag\.current_version[\s\S]*status in\('CONFIRMED','SUPERSEDED'\)/);
 for(const name of ['public.rpc_read_agreement_photo_messages_v5','public.rpc_agreement_photo_read_service_v5']){
  const read=body(name);assert.match(read,/agreement_photo_context_v5\([^;]+null,false\)/);assert.doesNotMatch(read,/safety_pair_blocked|safety_assert_pair|ag\.status/);
 }
 const send=body('public.rpc_send_agreement_photo_message_v5');assert.ok(send.indexOf('if found then')<send.indexOf('agreement_photo_context_v5(u,p_agreement_id,p_expected_version,true)'));
 assert.match(send,/m\.photo_asset_ids<>p_asset_ids/);assert.match(send,/m\.agreement_version<>p_expected_version/);
});
test('absent cancellation is a permanent opaque tombstone and exact dispatched settlement cannot resurrect or refund',()=>{
 const upload=body('public.rpc_agreement_photo_upload_service_v5');assert.match(upload,/p_operation<>'SETTLE' and not private\.push_session_valid/);
 assert.match(upload,/p_operation='CANCEL'[\s\S]*'CANCELLED',clock_timestamp\(\)/);
 assert.match(upload,/when state='CANCELLED' then state/);assert.match(upload,/a\.dispatch_state='NOT_DISPATCHED' then raise/);
 assert.match(upload,/a\.state='STAGED' and a\.dispatch_state='NOT_DISPATCHED'/);assert.doesNotMatch(upload,/delete|refund|storage\.objects/);
 assert.match(sql,/dispatch_state=''DISPATCHING''[\s\S]*MEDIA_UPLOAD_PENDING/);
});
test('private derivative deletion needs actual closure generation, policy and exact dispatched path, selected evidence remains held',()=>{
 const guard=body('private.agreement_photo_storage_guard_v5');assert.match(guard,/c\.state='DISPATCHED'.*c\.bucket=old\.bucket_id and c\.object_path=old\.name/);
 assert.match(guard,/closure_assert_current_v5\(e\)/);assert.match(guard,/media_evidence_refs_v5 where asset_id=a\.id/);assert.match(guard,/retention_holds where account_id=a\.account_id and active/);
 assert.match(sql,/union select ''profile-media'',storage_path from private\.agreement_photo_uploads_v5/);
 assert.match(proof,/assert\.equal\(rows\(`select version from storage\.objects[\s\S]*\.version,before\)/);assert.match(proof,/download\(first\.path\)[\s\S]*digest\('hex'\),sha\)/);
});
test('server quota is high temporary120/24h and12/min, duplicate key returns before quota, actual proof observes boundary race',()=>{
 const upload=body('public.rpc_agreement_photo_upload_service_v5');assert.match(upload,/interval '24 hours'\)>=120/);assert.match(upload,/interval '1 minute'\)>=12/);
 assert.ok(upload.indexOf('if a.id is not null then')<upload.indexOf("interval '24 hours'"));assert.match(proof,/rateRace\.filter\(x=>!x\.error\)\.length,1/);
 assert.ok(!/interval '30 days'|>=12[^\n]*24 hours/.test(sql));
});
test('selected support evidence and owner export add exact photos only without paths, bytes or transfer secrets',()=>{
 assert.match(sql,/snapshot->>'kind'='AGREEMENT_MESSAGE'/);assert.match(sql,/attached_message_id=\(snapshot->>'id'\)::uuid/);
 assert.match(sql,/OWN_ACCOUNT_V5_7/);assert.match(sql,/jsonb_array_length\(m->''datasets''\)<>50/);
 const projection=sql.slice(sql.indexOf("select 'ownAgreementPhotos',"),sql.indexOf('$rows$;',sql.indexOf("select 'ownAgreementPhotos',")));
 assert.doesNotMatch(projection,/storage_path|sha256|input_bytes|client_request_id|attempt_id|to_jsonb\(t\)/);
 assert.match(projection,/t\.account_id=p_account_id/);assert.match(projection,/'bytesIncluded',false/);
});
test('each of12 new helpers has explicit ACL admission and joins the final14333-source seal without a wildcard',()=>{
 const names=[...sql.matchAll(/create function ((?:private|public)\.[a-z0-9_]+)\(/g)].map(x=>x[1]);assert.equal(names.length,12);assert.equal(new Set(names).size,12);
 const acl=sql.slice(sql.indexOf('do $acl$'),sql.indexOf('end $acl$;')),seal=sql.slice(sql.indexOf('do $source$'),sql.indexOf('end $source$;'));
 for(const name of names){assert.ok(acl.includes("'"+name.split('.')[1]+"'"),name);assert.ok(seal.includes("'"+name+'('),name);}
 assert.match(seal,/having count\(\*\)=33/);assert.match(seal,/having count\(\*\)=45/);assert.match(seal,/public\.rpc_closure_api_guard\(\)/);
 assert.match(acl,/revoke all on function %s from public,anon,authenticated,service_role/);assert.doesNotMatch(seal,/proname like/);
});
