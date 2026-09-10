// Actual disposable Supabase Auth/PostgREST/Postgres, real current Edge handler.
// Expo is a synthetic transport only; no live account, push or device is used.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {loadPushHandler} from './n09_push_transport_runtime.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;assertLocalDeviceProofTargets(url,db);
const file='supabase/migrations/20260910193029_clean_n09_expo_push_transport.sql',source=readFileSync(file);
const digest=x=>createHash('sha256').update(x).digest('hex');const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const out=env.N09_ARTIFACT_DIR??'artifacts/n09-push-transport';mkdirSync(out,{recursive:true});
const report={unit:'N09_EXPO_PUSH_TRANSPORT',source_sha:env.GITHUB_SHA??null,run_id:env.GITHUB_RUN_ID??null,source_sql_sha256:digest(source),checks:[],live_access:false,provider_called:false,provider_response_stubbed:true,actual_auth:true,actual_database:true,actual_edge_handler:true,edge_gateway_proven:false,physical_push_proven:false,fixture_clock_simulated:true};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const owner=createClient(url,env.RU5_DEVICE_ANON_KEY,options),other=createClient(url,env.RU5_DEVICE_ANON_KEY,options),anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options),service=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const uid=env.RU5_DEVICE_REQUESTER_USER_ID,otherId=env.RU5_DEVICE_WORKER_USER_ID;for(const id of [uid,otherId])assert.match(id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
function sql(s){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000,maxBuffer:32*1024*1024}).trim();}catch(e){report.failed_sql={sqlstate:String(e.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE',query_sha256:digest(s)};throw Error('LOCAL_SQL_FAILED');}}
const ok=async p=>{const r=await p;if(r.error)throw Error('LOCAL_RPC_'+String(r.error.code));return r.data;};
const deny=async p=>assert.ok((await p).error);
const rpc=(name,args)=>ok(service.rpc(name,args));
const token=()=>`ExpoPushToken[synthetic_${randomUUID().replaceAll('-','')}]`;
const get=(c,user,t)=>ok(c.rpc('rpc_get_push_device_owned',{p_expected_user_id:user,p_expo_push_token:t}));
const set=(c,user,t,r,active=true)=>ok(c.rpc('rpc_set_push_device_owned',{p_expected_user_id:user,p_expo_push_token:t,p_platform:'ANDROID',p_active:active,p_expected_revision:r}));
const claim=kind=>rpc('rpc_claim_push_transport',{p_kind:kind});
const begin=c=>rpc('rpc_begin_push_send',{p_attempt_id:c.attemptId,p_lease_id:c.leaseId});
const complete=(c,result,ticket=null)=>rpc('rpc_complete_push_transport',{p_attempt_id:c.attemptId,p_lease_id:c.leaseId,p_result:result,p_ticket_id:ticket});
const due=id=>sql(`update public.notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second' where id=${q(id)}`);
const prefs=async push=>{const p=await ok(owner.rpc('rpc_get_notification_preferences',{p_expected_user_id:uid,p_role:'REQUESTER'}));return ok(owner.rpc('rpc_set_notification_preferences',{p_expected_user_id:uid,p_role:'REQUESTER',p_expected_revision:p.revision,p_settings:{...p.settings,push_enabled:push,quiet_hours_enabled:false}}));};
const event=()=>{const key='n09:'+randomUUID();const id=sql(`select private.emit_event(${q(uid)},'REQUESTER','MESSAGE_RECEIVED','AGREEMENT',${q(randomUUID())},1,'SYNTHETIC PRIVATE TITLE','SYNTHETIC PRIVATE BODY',${q(key)})`);return id;};
const isolate=()=>sql(`update public.notification_deliveries set state='SUPPRESSED',suppression_reason='SYNTHETIC_FIXTURE_ISOLATION' where channel='PUSH';update public.notification_push_attempts set transport_state='FINAL',outcome='FATAL',lease_id=null,lease_until=null where transport_state is not null;`);
let stage='PREFLIGHT';const check=name=>{stage=name;console.log('START_CHECK '+name);};const pass=()=>{report.checks.push({name:stage,result:'PASS'});console.log('PASS_CHECK '+stage);};
const children=[];
try {
 check('EXACT106_PREDECESSOR_OLD_ROWS_FUNCTIONS_AND_HISTORY');
 assert.equal(sql('select count(*) from supabase_migrations.schema_migrations'),'106');
 assert.equal(sql('select md5(statements[1]) from supabase_migrations.schema_migrations order by version desc limit 1'),'7ec5faf05b863d64a4014fa86bca9e8d');
 for(const [c,email,id] of [[owner,env.RU5_DEVICE_REQUESTER_EMAIL,uid],[other,env.RU5_DEVICE_WORKER_EMAIL,otherId]]){await ok(c.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(c.auth.getUser())).user.id,id);}
 // Create the legitimate unbound N06 registration through its real authenticated
 // predecessor API before N09 closes that raw setter. Include it in preservation.
 const legacy=token();const legacyDevice=await ok(owner.rpc('rpc_set_push_device',{p_expo_push_token:legacy,p_platform:'ANDROID',p_active:true,p_expected_revision:0}));assert.equal(legacyDevice.active,true);
 const tables=JSON.parse(sql("select jsonb_agg(schemaname||'.'||tablename order by schemaname,tablename) from pg_tables where schemaname in ('public','private')"));
 const subtract={ 'public.notification_push_devices':['bound_session_id','bound_revision'],'public.notification_deliveries':['push_started_at'],
  'public.notification_push_attempts':['transport_state','device_revision','send_count','lease_id','lease_until','next_attempt_at','ticket_received_at','receipt_checked_at','last_claimed_at','rejected_ticket_ids']};
 const tableHash=t=>{assert.match(t,/^(public|private)\.[a-z_0-9]+$/);return sql(`select md5(coalesce(jsonb_agg(to_jsonb(x)-array[${(subtract[t]??[]).map(q).join(',')}]::text[] order by to_jsonb(x)::text),'[]'::jsonb)::text) from ${t} x`);};
 const before=Object.fromEntries(tables.map(t=>[t,tableHash(t)]));
 const history=sql("select md5(jsonb_agg(to_jsonb(x) order by version)::text) from supabase_migrations.schema_migrations x");
 const funcs=sql("select jsonb_agg(jsonb_build_array(oid::text,md5(prosrc),proacl,proconfig,prosecdef,proowner) order by oid) from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace)");
 const rawSetter='public.rpc_set_push_device(text,text,boolean,bigint)';
 const rawSetterOid=sql(`select ${q(rawSetter)}::regprocedure::oid::text`);
 const expectedFunctions=JSON.parse(funcs);const rawSetterBefore=expectedFunctions.find(x=>x[0]===rawSetterOid);assert.ok(rawSetterBefore);
 assert.ok(Array.isArray(rawSetterBefore[2]));const removedGrant=rawSetterBefore[2].filter(x=>x.startsWith('authenticated='));assert.equal(removedGrant.length,1);assert.match(removedGrant[0],/^authenticated=X\/[^/]+$/);
 rawSetterBefore[2]=rawSetterBefore[2].filter(x=>x!==removedGrant[0]);
 const ids=expectedFunctions.map(x=>x[0]);sql(source.toString('utf8'));
 assert.deepEqual(Object.fromEntries(tables.map(t=>[t,tableHash(t)])),before);
 assert.equal(sql("select md5(jsonb_agg(to_jsonb(x) order by version)::text) from supabase_migrations.schema_migrations x"),history);
 assert.deepEqual(JSON.parse(sql(`select jsonb_agg(jsonb_build_array(oid::text,md5(prosrc),proacl,proconfig,prosecdef,proowner) order by oid) from pg_proc where oid in (${ids.join(',')})`)),expectedFunctions);
 assert.equal(sql(`select has_function_privilege('authenticated',${q(rawSetter)},'EXECUTE')`),'f');report.existing_acl_delta=[rawSetter];
 sql("notify pgrst,'reload schema'");
 const t=token();for(let i=0;i<40;i++){const r=await owner.rpc('rpc_get_push_device_owned',{p_expected_user_id:uid,p_expo_push_token:t});if(!r.error)break;if(i===39)throw Error('SCHEMA_RELOAD');await new Promise(r=>setTimeout(r,250));}
 report.original_table_count=tables.length;report.history_unchanged=true;pass();

 check('AUTH_SESSION_REGISTRATION_OPT_IN_AND_LEGACY_FAIL_CLOSED');isolate();
 await deny(anon.rpc('rpc_claim_push_transport',{p_kind:'SEND'}));await deny(owner.rpc('rpc_claim_push_transport',{p_kind:'SEND'}));
 await deny(owner.rpc('rpc_get_push_device_owned',{p_expected_user_id:otherId,p_expo_push_token:t}));
 const d=await set(owner,uid,t,0);assert.equal(d.sessionBound,true);assert.deepEqual(await set(owner,uid,t,0),d);
 assert.equal((await owner.rpc('rpc_set_push_device',{p_expo_push_token:legacy,p_platform:'ANDROID',p_active:false,p_expected_revision:legacyDevice.revision})).error?.code,'42501');
 assert.equal((await get(owner,uid,legacy)).sessionBound,false);assert.equal((await get(owner,uid,legacy)).active,true);report.old_setter_authenticated_execute_revoked=true;
 await prefs(false);event();assert.equal((await claim('SEND')).kind,'NONE');
 await prefs(true);event();const first=await claim('SEND');assert.equal(first.kind,'SEND');
 assert.equal(sql(`select count(*) from public.notification_push_attempts a join public.notification_push_devices d on d.id=a.device_id where d.expo_push_token=${q(legacy)}`),'0');pass();

 check('CLAIM_DUPLICATES_BEGIN_FENCE_AND_UNKNOWN_NEVER_RESENT');
 assert.equal((await claim('SEND')).kind,'NONE');await begin(first);await deny(service.rpc('rpc_begin_push_send',{p_attempt_id:first.attemptId,p_lease_id:first.leaseId}));
 await complete(first,'UNKNOWN');due(first.attemptId);assert.equal((await claim('SEND')).kind,'NONE');
 event();const c=await claim('SEND');await begin(c);sql(`update public.notification_push_attempts set lease_until=clock_timestamp()-interval '1 second' where id=${q(c.attemptId)}`);assert.equal((await claim('SEND')).kind,'NONE');
 assert.equal(sql(`select transport_state from public.notification_push_attempts where id=${q(c.attemptId)}`),'UNKNOWN');
 for(let i=0;i<6;i++){event();assert.equal((await claim('SEND')).kind,'SEND');}event();assert.equal((await claim('SEND')).kind,'NONE');isolate();pass();

 check('CURRENT_PREFERENCES_QUIET_HOURS_AND_DEVICE_REBIND');
 event();const revoked=await claim('SEND');await prefs(false);assert.equal((await begin(revoked)).kind,'SUPPRESSED');await prefs(true);
 event();const rebound=await claim('SEND');await set(other,otherId,t,0);assert.equal((await begin(rebound)).kind,'SUPPRESSED');assert.equal((await get(owner,uid,t)).active,false);
 const back=await get(owner,uid,t);await set(owner,uid,t,back.revision);
 const p=await ok(owner.rpc('rpc_get_notification_preferences',{p_expected_user_id:uid,p_role:'REQUESTER'}));await ok(owner.rpc('rpc_set_notification_preferences',{p_expected_user_id:uid,p_role:'REQUESTER',p_expected_revision:p.revision,p_settings:{...p.settings,quiet_hours_enabled:true,quiet_start:'00:00',quiet_end:'00:00',urgent_overrides_quiet_hours:false}}));event();assert.equal((await claim('SEND')).kind,'NONE');await prefs(true);pass();

 check('EXPLICIT_THROTTLE_RETRIES_BOUNDED_AND_RECEIPTS_SEPARATE');
 event();let retry=await claim('SEND');for(let i=0;i<3;i++){await begin(retry);const result=await complete(retry,'RETRYABLE');assert.equal(result.state,i===2?'FINAL':'RETRYABLE');due(retry.attemptId);if(i<2)retry=await claim('SEND');}assert.equal((await claim('SEND')).kind,'NONE');
 event();const accepted=await claim('SEND');await begin(accepted);await complete(accepted,'TICKET','original_ticket');assert.equal((await claim('RECEIPT')).kind,'NONE');due(accepted.attemptId);
 let receipt=await claim('RECEIPT');assert.equal(receipt.ticketId,'original_ticket');await complete(receipt,'RECEIPT_PENDING');due(receipt.attemptId);receipt=await claim('RECEIPT');assert.equal(receipt.ticketId,'original_ticket');
 await complete(receipt,'PROVIDER_ACCEPTED');assert.equal(sql(`select d.state||':'||(d.delivered_at is null)::text from public.notification_deliveries d join public.notification_push_attempts a on a.delivery_id=d.id where a.id=${q(receipt.attemptId)}`),'SENT:true');
 event();let rateLimited=await claim('SEND');const sameAttempt=rateLimited.attemptId;
 for(let i=1;i<=3;i++) {
  assert.equal(rateLimited.attemptId,sameAttempt);assert.equal(rateLimited.ticketId,null);await begin(rateLimited);
  if(i>1)await deny(service.rpc('rpc_complete_push_transport',{p_attempt_id:rateLimited.attemptId,p_lease_id:rateLimited.leaseId,p_result:'TICKET',p_ticket_id:'rate_ticket_1'}));
  await complete(rateLimited,'TICKET',`rate_ticket_${i}`);due(sameAttempt);const rejected=await claim('RECEIPT');assert.equal(rejected.ticketId,`rate_ticket_${i}`);
  const result=await complete(rejected,'RECEIPT_RATE_EXCEEDED');assert.equal(result.state,i<3?'RETRYABLE':'FINAL');
  await deny(service.rpc('rpc_complete_push_transport',{p_attempt_id:rejected.attemptId,p_lease_id:rejected.leaseId,p_result:'RECEIPT_RATE_EXCEEDED',p_ticket_id:null}));
  assert.equal((await claim('SEND')).kind,'NONE');due(sameAttempt);if(i<3)rateLimited=await claim('SEND');
 }
 assert.equal((await claim('SEND')).kind,'NONE');
 assert.deepEqual(JSON.parse(sql(`select jsonb_build_object('count',send_count,'previous',rejected_ticket_ids,'current',provider_ticket_id)::text from public.notification_push_attempts where id=${q(sameAttempt)}`)),{count:3,current:'rate_ticket_3',previous:['rate_ticket_1','rate_ticket_2']});pass();

 check('LATE_DEVICE_NOT_REGISTERED_CANNOT_RETIRE_NEW_OWNER_OR_REVISION');
 event();const old=await claim('SEND');await begin(old);await complete(old,'TICKET','old_ticket');due(old.attemptId);const late=await claim('RECEIPT');const otherState=await get(other,otherId,t);const newer=await set(other,otherId,t,otherState.revision);
 await complete(late,'DEVICE_NOT_REGISTERED');assert.equal((await get(other,otherId,t)).revision,newer.revision);assert.equal((await get(other,otherId,t)).active,true);pass();

 check('ACTUAL_HANDLER_REAL_DATABASE_SYNTHETIC_EXPO_MINIMAL_PAYLOAD');isolate();const ownState=await get(owner,uid,t);await set(owner,uid,t,ownState.revision);event();let providerCalls=0;
 const serviceKey=env.RU5_DEVICE_SERVICE_ROLE_KEY;
 const runtime=loadPushHandler({env:name=>({SUPABASE_SERVICE_ROLE_KEY:serviceKey,SUPABASE_URL:'https://synthetic.supabase.co',EXPO_PUSH_TRANSPORT_ENABLED:'true'}[name]),fetch:async(target,init)=>{
  if(target==='https://exp.host/--/api/v2/push/send'){providerCalls++;const data=JSON.parse(init.body);assert.equal(data.length,1);assert.equal(data[0].to,t);assert.equal(data[0].body,'Imate novo obaveštenje. Otvorite aplikaciju.');assert.deepEqual(data[0].data,{kind:'INBOX'});assert.equal(init.headers.apikey,undefined);return new Response(JSON.stringify({data:[{status:'ok',id:'actual_handler_synthetic_ticket'}]}),{status:200});}
  const parsed=new URL(target);assert.equal(parsed.origin,'https://synthetic.supabase.co');assert.ok(['/rest/v1/rpc/rpc_claim_push_transport','/rest/v1/rpc/rpc_begin_push_send','/rest/v1/rpc/rpc_complete_push_transport'].includes(parsed.pathname));
  return fetch(new URL(parsed.pathname,url),{...init,redirect:'error'});
 }});
 const response=await runtime.handler(new Request('https://synthetic-worker.test',{method:'POST',headers:{authorization:`Bearer ${serviceKey}`},body:'{"action":"tick"}'}));assert.equal(response.status,200);assert.equal((await response.json()).send,'TICKET_PENDING');assert.equal(providerCalls,1);report.edge_sha256=runtime.sha256;pass();

 check('LOGOUT_SESSION_AND_ACCOUNT_RETIREMENT_NO_OTHER_DEVICE_REVOCATION');isolate();
 await ok(owner.rpc('rpc_revoke_push_session',{p_expected_user_id:uid}));assert.equal((await get(owner,uid,t)).active,false);assert.equal((await ok(owner.rpc('rpc_revoke_push_session',{p_expected_user_id:uid}))).revoked,true);
 let original=await get(owner,uid,t);await set(owner,uid,t,original.revision);event();const logoutClaim=await claim('SEND');await ok(owner.auth.signOut({scope:'local'}));assert.equal((await begin(logoutClaim)).kind,'SUPPRESSED');
 await rpc('rpc_retire_push_account',{p_account_id:uid});assert.equal(sql(`select count(*) from public.notification_push_devices where user_id=${q(uid)} and active`),'0');
 await deny(other.rpc('rpc_retire_push_account',{p_account_id:uid}));pass();

 check('ATOMIC_ROTATION_RETIRES_OLD_TOKEN_AND_PRESERVES_CONSENT');
 await ok(owner.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 original=await get(owner,uid,t);const registered=await set(owner,uid,t,original.revision);const nextToken=token();
 const beforePrefs=sql(`select md5(to_jsonb(p)::text) from public.notification_preferences p where user_id=${q(uid)} and role_context='REQUESTER'`);
 const input={p_expected_user_id:uid,p_previous_device_id:registered.id,p_previous_revision:registered.revision,p_expo_push_token:nextToken,p_platform:'ANDROID'};
 const rotated=await ok(owner.rpc('rpc_rotate_push_device_owned',input));assert.equal(rotated.previousDeviceId,registered.id);assert.equal(rotated.previousRevision,registered.revision+1);assert.equal(rotated.sessionBound,true);
 assert.equal((await get(owner,uid,t)).active,false);assert.equal((await get(owner,uid,nextToken)).active,true);assert.equal((await ok(owner.rpc('rpc_get_push_session_device',{p_expected_user_id:uid}))).id,rotated.id);
 await deny(owner.rpc('rpc_rotate_push_device_owned',input));await deny(other.rpc('rpc_rotate_push_device_owned',{...input,p_expected_user_id:otherId}));
 await deny(owner.rpc('rpc_set_push_device',{p_expo_push_token:t,p_platform:'ANDROID',p_active:true,p_expected_revision:registered.revision}));
 assert.equal(sql(`select md5(to_jsonb(p)::text) from public.notification_preferences p where user_id=${q(uid)} and role_context='REQUESTER'`),beforePrefs);pass();

 check('CONCURRENT_CLAIM_AND_OBSERVED_ROTATION_BEGIN_LOCK');isolate();event();
 const raced=await Promise.all([claim('SEND'),claim('SEND')]);assert.equal(raced.filter(x=>x.kind==='SEND').length,1);assert.equal(raced.filter(x=>x.kind==='NONE').length,1);const winning=raced.find(x=>x.kind==='SEND');report.concurrent_single_lease=true;
 const existing=await ok(owner.rpc('rpc_get_push_session_device',{p_expected_user_id:uid}));assert.equal(existing.kind,'DEVICE');const finalToken=token();
 const actualSession=(await ok(owner.auth.getSession())).session;
 const verifiedClaims=JSON.parse(Buffer.from(actualSession.access_token.split('.')[1],'base64url').toString('utf8'));
 assert.equal(verifiedClaims.sub,uid);assert.match(verifiedClaims.session_id,/^[0-9a-f-]{36}$/i);
 function transaction(name,role,body,pause=0,sessionClaims=verifiedClaims) {
  assert.ok(['n09_rotation_holder','n09_begin_waiter','n09_registration_holder','n09_registration_waiter'].includes(name));assert.ok(['authenticated','service_role'].includes(role));
  const claims=role==='authenticated'?{role,sub:uid,session_id:sessionClaims.session_id}:{role};
  const child=spawn('psql',[db,'-X','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});children.push(child);let stdout='',stderr='';
  child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve({code,stdout,stderr}));});
  child.stdin.end(`set application_name=${q(name)};set statement_timeout='20s';set lock_timeout='15s';begin;set local role ${role};select set_config('request.jwt.claims',${q(JSON.stringify(claims))},true);${body};${pause?`select pg_sleep(${pause});`:''}commit;`);
  return done;
 }
 async function observe(name,event) {for(let i=0;i<100;i++){const state=sql(`select coalesce(jsonb_agg(jsonb_build_object('type',wait_event_type,'event',wait_event)),'[]'::jsonb) from pg_stat_activity where application_name=${q(name)}`);const rows=JSON.parse(state);if(rows.some(x=>x.event===event||x.type===event))return rows;await new Promise(r=>setTimeout(r,30));}throw Error('EXPECTED_LOCK_NOT_OBSERVED');}
 const holder=transaction('n09_rotation_holder','authenticated',`select public.rpc_rotate_push_device_owned(${q(uid)},${q(existing.id)},${existing.revision},${q(finalToken)},'ANDROID')`,2);
 await observe('n09_rotation_holder','PgSleep');
 const waiter=transaction('n09_begin_waiter','service_role',`select public.rpc_begin_push_send(${q(winning.attemptId)},${q(winning.leaseId)})`);
 report.observed_locks=await observe('n09_begin_waiter','Lock');
 const [held,waited]=await Promise.all([holder,waiter]);assert.equal(held.code,0);assert.equal(waited.code,0);assert.match(waited.stdout,/"kind": "SUPPRESSED"/);report.rotation_begin_suppressed_after_observed_lock=true;
 assert.equal((await get(owner,uid,finalToken)).active,true);assert.equal((await get(owner,uid,nextToken)).active,false);pass();

 check('AUTH_SESSION_REVOKED_DURING_REGISTRATION_LOCK');
 for(const operation of ['set','rotate']) {
  const stale=createClient(url,env.RU5_DEVICE_ANON_KEY,options);await ok(stale.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(stale.auth.getUser())).user.id,uid);
  const staleSession=(await ok(stale.auth.getSession())).session,claims=JSON.parse(Buffer.from(staleSession.access_token.split('.')[1],'base64url').toString('utf8'));assert.equal(claims.sub,uid);
  const targetToken=token(),otherDevice=await set(other,otherId,targetToken,0);let command;
  if(operation==='set') command=`select public.rpc_set_push_device_owned(${q(uid)},${q(targetToken)},'ANDROID',true,0)`;
  else {const oldToken=token(),old=await set(stale,uid,oldToken,0);command=`select public.rpc_rotate_push_device_owned(${q(uid)},${q(old.id)},${old.revision},${q(targetToken)},'ANDROID')`;}
  const blocking=transaction('n09_registration_holder','service_role',`select pg_advisory_xact_lock(hashtextextended(${q('uskoci:push-token:'+targetToken)},0))`,2);
  await observe('n09_registration_holder','PgSleep');const pending=transaction('n09_registration_waiter','authenticated',command,0,claims);
  report.observed_locks.push(...await observe('n09_registration_waiter','Lock'));
  await ok(stale.auth.signOut({scope:'local'}));const [blockResult,writeResult]=await Promise.all([blocking,pending]);assert.equal(blockResult.code,0);assert.notEqual(writeResult.code,0);assert.match(writeResult.stderr,/AUTH_REQUIRED/);
  // Reuse the actual formerly authenticated JWT after real Auth sign-out. Even
  // while its signature remains valid, the old raw setter is no longer callable.
  const revokedClient=createClient(url,env.RU5_DEVICE_ANON_KEY,{...options,global:{headers:{Authorization:`Bearer ${staleSession.access_token}`}}});
  assert.equal((await revokedClient.rpc('rpc_set_push_device',{p_expo_push_token:targetToken,p_platform:'ANDROID',p_active:true,p_expected_revision:0})).error?.code,'42501');
  const preserved=await get(other,otherId,targetToken);assert.equal(preserved.active,true);assert.equal(preserved.revision,otherDevice.revision);
 }
 report.postlock_session_revocation_fenced=true;pass();
 report.result='PASS';console.log('PASS N09_PUSH_TRANSPORT_AUTHENTICATED_PROOF');
}catch(error){report.result='FAIL';report.failed_check=stage;report.failure=error.code??error.name;report.failure_line=String(error.stack??'').split('\n').find(x=>x.includes('n09_push_transport_proof.mjs'))?.trim();console.error('FAIL N09 '+stage);process.exitCode=1;}
finally{for(const child of children)if(child.exitCode===null)child.kill();writeFileSync(`${out}/proof-report.json`,JSON.stringify(report,null,2)+'\n');}
