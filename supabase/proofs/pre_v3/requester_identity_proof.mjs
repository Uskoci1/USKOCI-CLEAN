// Exact-source disposable Auth/Postgres proof for PRE-V3 Requester public display-name authority.
// Applies candidate116 only after an already-proven staged history through115. No live/provider/UI claim.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env;assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const out=env.PRE_V3_ARTIFACT_DIR??'artifacts/pre-v3';mkdirSync(out,{recursive:true});
const report={unit:'PRE_V3_REQUESTER_IDENTITY',result:'RUNNING',sourceSha:env.GITHUB_SHA,actualAuth:true,actualDatabase:true,
 liveAccess:false,providerCalled:false,deviceProven:false,checks:[],migrations:[]};
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=s=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}).trim();}catch(e){throw new Error('LOCAL_SQL:'+String(e.stderr).slice(0,500));}};
const rows=s=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${s}) r`));
const ok=async p=>{const r=await p;if(r.error)throw new Error('LOCAL_RPC:'+r.error.code+':'+r.error.message);return r.data;};
const denied=async(p,message)=>{const r=await p;assert.ok(r.error,'EXPECTED_DENIAL:'+(message??''));if(message)assert.equal(r.error.message,message);return r.error;};
const pass=name=>{report.checks.push({name,result:'PASS'});console.log('PASS '+name);};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const requester=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const worker=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const anon=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const requesterId=env.RU5_DEVICE_REQUESTER_USER_ID,workerId=env.RU5_DEVICE_WORKER_USER_ID;
try{
 const history=rows('select * from supabase_migrations.schema_migrations order by version');assert.equal(history.length,115);
 const file='20260911220000_clean_pre_v3_requester_identity.sql',path='supabase/migrations/'+file,b=readFileSync(path);
 assert.deepEqual(b,execFileSync('git',['show',env.GITHUB_SHA+':'+path]));sql(b.toString());
 sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(file.slice(0,14))},${q(file.slice(15,-4))},array[${q(b.toString())}]);notify pgrst,'reload schema'`);
 report.migrations.push({file,sha256:createHash('sha256').update(b).digest('hex')});
 assert.deepEqual(rows("select * from supabase_migrations.schema_migrations where version<'20260911220000' order by version"),history);
 await new Promise(r=>setTimeout(r,1000));
 await ok(requester.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 await ok(worker.auth.signInWithPassword({email:env.RU5_DEVICE_WORKER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 const initial=await ok(requester.rpc('rpc_get_requester_profile_for_edit',{}));
 assert.equal(initial.schema,'REQUESTER_IDENTITY_V1');assert.equal(initial.accountId,requesterId);assert.match(initial.profileId,/^[0-9a-f-]{36}$/);
 assert.match(initial.revision,/^[a-f0-9]{64}$/);assert.deepEqual(initial.writableFields,['displayName']);
 // One account may legitimately have both REQUESTER and WORKER intent/profile material.
 // A second actor may therefore have its own Requester identity; it must never receive A's.
 const other=await worker.rpc('rpc_get_requester_profile_for_edit',{});
 if(other.error)assert.equal(other.error.message,'REQUESTER_PROFILE_REQUIRED');
 else {assert.equal(other.data.accountId,workerId);assert.notEqual(other.data.accountId,requesterId);assert.notEqual(other.data.profileId,initial.profileId);}
 const anonymous=await anon.rpc('rpc_get_requester_profile_for_edit',{});
 assert.ok(anonymous.error,'ANON_MUST_BE_DENIED');
 assert.match(anonymous.error.message,/AUTH_REQUIRED|permission denied/i);
 pass('OWNER_ONLY_READBACK_AND_NO_CROSS_ACCOUNT_REQUESTER_PROJECTION');
 const key=randomUUID(),wanted='  PRE-V3 Ime '+randomUUID().slice(0,8)+'  ';
 const saved=await ok(requester.rpc('rpc_save_requester_profile',{p_expected_revision:initial.revision,p_display_name:wanted,p_client_request_id:key}));
 assert.equal(saved.saved,true);assert.equal(saved.idempotentReplay,false);assert.equal(saved.clientRequestId,key);assert.equal(saved.identity.accountId,requesterId);
 assert.equal(saved.identity.displayName,wanted.trim());assert.notEqual(saved.identity.revision,initial.revision);
 const replay=await ok(requester.rpc('rpc_save_requester_profile',{p_expected_revision:initial.revision,p_display_name:wanted,p_client_request_id:key}));
 assert.equal(replay.idempotentReplay,true);assert.deepEqual({...replay,idempotentReplay:false},saved);
 await denied(requester.rpc('rpc_save_requester_profile',{p_expected_revision:initial.revision,p_display_name:'Drugo ime',p_client_request_id:key}),'REQUEST_ID_REUSED');
 await denied(requester.rpc('rpc_save_requester_profile',{p_expected_revision:initial.revision,p_display_name:'Stale ime',p_client_request_id:randomUUID()}),'REQUESTER_PROFILE_STALE');
 assert.equal((await ok(requester.rpc('rpc_get_requester_profile_for_edit',{}))).displayName,wanted.trim());
 pass('CAS_IMMUTABLE_KEYED_REPLAY_STALE_AND_READBACK');
 for(const value of [null,42,true,[],{},'', '   ', 'x'.repeat(201), 'bad\nname'])
  await denied(requester.rpc('rpc_save_requester_profile',{p_expected_revision:saved.identity.revision,p_display_name:value,p_client_request_id:randomUUID()}),'REQUESTER_PROFILE_INPUT_INVALID');
 const profileBefore=rows(`select display_name from public.app_profiles where id=${q(initial.profileId)}::uuid`)[0].display_name;
 const raw=await requester.from('app_profiles').update({display_name:'RAW_BYPASS'}).eq('id',initial.profileId).select('id');
 assert.ok(raw.error || raw.data.length===0);assert.equal(rows(`select display_name from public.app_profiles where id=${q(initial.profileId)}::uuid`)[0].display_name,profileBefore);
 pass('BOUNDED_INPUT_AND_DIRECT_AUTHENTICATED_WRITE_DENIAL');
 const functions=rows(`select p.proname,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') anon,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
 from pg_proc p where p.oid in('public.rpc_get_requester_profile_for_edit()'::regprocedure,
 'public.rpc_save_requester_profile(text,jsonb,uuid)'::regprocedure) order by p.proname`);
 assert.equal(functions.length,2);assert.ok(functions.every(x=>x.prosecdef&&x.proconfig.includes('search_path=pg_catalog')&&!x.anon&&x.authenticated));
 assert.equal(sql("select has_table_privilege('authenticated','private.requester_identity_commands','SELECT')"),'f');
 assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')),116);
 report.historyCount=116;report.result='PASS';pass('SECURITY_DEFINER_FIXED_PATH_MINIMAL_EXECUTE_AND_PRIVATE_RECEIPT_LEDGER');
}catch(error){report.result='FAIL';report.failure=String(error.message).slice(0,700);process.exitCode=1;console.error('FAIL '+report.failure);}
finally{writeFileSync(out+'/requester-identity-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' PRE_V3_REQUESTER_IDENTITY');}
