// Exact SQL106 after exact SQL105. Real loopback Auth/PostgREST + PostgreSQL
// locks and actual Edge code; only provider output is synthetic, never live AI.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
import {loadOwnedIntakeHandler} from './owned_intake_edge_runtime.mjs';
const env=process.env,url=env.RU5_DEVICE_SUPABASE_URL,db=env.RU5_DEVICE_DB_URL;
assertLocalDeviceProofTargets(url,db);
const digest=(bytes,kind='sha256')=>createHash(kind).update(bytes).digest('hex');
const manifest=JSON.parse(readFileSync('supabase/proofs/ai/owned_intake_files.json','utf8'));
const forward='supabase/migrations/'+manifest.forward_file,source=readFileSync(forward);
assert.equal(source.length,manifest.bytes);assert.equal(digest(source),manifest.sha256);assert.equal(digest(source,'md5'),manifest.md5);
const out=env.W03_INTAKE_ARTIFACT_DIR??'artifacts/w03-owned-intake';mkdirSync(out,{recursive:true});
const report={unit:'W03_OWNED_NEED_INTAKE',source_sha:env.GITHUB_SHA??null,run_id:env.GITHUB_RUN_ID??null,result:'RUNNING',checks:[],lock_interleavings:[],
 candidate:manifest,input_sha256:{[forward]:digest(source)},live_access:false,live_promotion:false,provider_called:false,provider_response_stubbed:true,
 mocked_rpc_responses:false,mocked_database:false,actual_edge_handler:true,edge_gateway_proven:false,native_journey_proven:false,
 retention_policy_activated:false,provider_exactly_once_claimed:false,boundary:'REAL_LOOPBACK_AUTH_POSTGREST_SQL_LOCKS_ACTUAL_HANDLER_SYNTHETIC_PROVIDER'};
report.lease_expiry_and_rate_window_fixture_clock_simulated=true;
for(const p of ['supabase/proofs/ai/owned_intake_proof.mjs','supabase/proofs/ai/owned_intake_edge_runtime.mjs','supabase/functions/uskoci-ai-interview/index.ts','src/contracts/needFactsV2.ts'])report.input_sha256[p]=digest(readFileSync(p));
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
function sql(query){try{return execFileSync('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:25000,maxBuffer:32*1024*1024}).trim();}
 catch(e){report.failed_sql={sqlstate:String(e.stderr).match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]??'UNAVAILABLE',query_sha256:digest(query)};throw new Error('DISPOSABLE_SQL_FAILED_'+report.failed_sql.sqlstate);}}
const rows=query=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from (${query}) t`));
const hashTable=(table,where='true')=>sql(`select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) from ${table} t where ${where}`);
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const owner=createClient(url,env.RU5_DEVICE_ANON_KEY,options),other=createClient(url,env.RU5_DEVICE_ANON_KEY,options),
 anon=createClient(url,env.RU5_DEVICE_ANON_KEY,options),service=createClient(url,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
const account=env.RU5_DEVICE_REQUESTER_USER_ID,outsider=env.RU5_DEVICE_WORKER_USER_ID;
for(const id of [account,outsider])assert.match(id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const ok=async promise=>{const r=await promise;if(r.error)throw new Error('LOCAL_RPC_'+String(r.error.code)+':'+String(r.error.message).slice(0,80));return r.data;};
async function denied(promise,message){const r=await promise;assert.ok(r.error);if(message)assert.equal(r.error.message,message);return r.error;}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let current='PREFLIGHT';const check=name=>{current=name;console.log('START_CHECK '+name);};const pass=()=>{report.checks.push({name:current,result:'PASS'});console.log('PASS_CHECK '+current);};
const scoped={};const children=[];
const fresh=async()=>{const cid=await ok(owner.rpc('rpc_ai_open_need_conversation_v2'));scoped[cid]=true;return cid;};
const input=(cid,key,text='W03_SYNTHETIC_USER_TEXT')=>({p_account_id:account,p_conversation_id:cid,p_client_request_id:key,p_user_message:text});
const claim=(cid,key,text)=>ok(service.rpc('rpc_ai_claim_need_turn_v2_service',input(cid,key,text)));
const read=(cid,key,client=owner)=>ok(client.rpc('rpc_ai_read_need_turn_v2',{p_conversation_id:cid,p_client_request_id:key}));
const abandon=(cid,client=owner)=>client.rpc('rpc_ai_abandon_need_conversation_v2',{p_conversation_id:cid});
const finish=(cid,key,attempt,{text='W03_SYNTHETIC_USER_TEXT',safety='ALLOW',proposals=[]}={})=>ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{
 ...input(cid,key,text),p_attempt_id:attempt,p_assistant_message:'W03_SYNTHETIC_ASSISTANT',p_safety:safety,p_proposals:proposals}));
const messages=cid=>Number(sql(`select count(*) from public.ai_messages where conversation_id=${q(cid)}`));
// Explicit disposable clock simulation, limited to this proof's account metadata.
const clearRate=()=>sql(`update private.ai_need_turn_commands set attempt_times=array(select x-interval '2 minutes' from unnest(attempt_times) x) where account_id=${q(account)}`);
const expire=(cid,key)=>sql(`update private.ai_need_turn_commands set lease_expires_at=clock_timestamp()-interval '1 second' where account_id=${q(account)} and conversation_id=${q(cid)} and client_request_id=${q(key)}`);
function transaction(name,role,statement,{pause=0}={}){
 assert.match(name,/^w03_[a-z0-9_]+$/);assert.ok(['authenticated','service_role'].includes(role));
 const claims=JSON.stringify({role,sub:role==='authenticated'?account:null});
 const script=`set application_name=${q(name)};set statement_timeout='20s';set lock_timeout='15s';begin;set local role ${role};
 select set_config('request.jwt.claims',${q(claims)},true);select set_config('request.jwt.claim.sub',${q(role==='authenticated'?account:'')},true);
 ${statement};${pause?`select pg_sleep(${pause});`:''}commit;`;
 const child=spawn('psql',[db,'-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At'],{stdio:['pipe','pipe','pipe']});children.push(child);
 let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
 const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve({code,stdout,stderr}));});child.stdin.end(script);return {name,done};
}
async function observeLock(name){for(let i=0;i<80;i++){const r=rows(`select pid,wait_event_type,wait_event from pg_stat_activity where application_name=${q(name)}`);
 if(r.some(x=>x.wait_event_type==='Lock'))return r.map(({wait_event_type,wait_event})=>({wait_event_type,wait_event}));await wait(50);}assert.fail('EXPECTED_LOCK_NOT_OBSERVED');}
async function observeSleep(name){for(let i=0;i<80;i++){if(sql(`select exists(select 1 from pg_stat_activity where application_name=${q(name)} and wait_event='PgSleep')`)==='t')return;await wait(50);}assert.fail('HOLDER_NOT_OBSERVED');}
const claimSql=(cid,key)=>`select public.rpc_ai_claim_need_turn_v2_service(${q(account)},${q(cid)},${q(key)},'W03_SYNTHETIC_USER_TEXT')`;
const finishSql=(cid,key,attempt)=>`select public.rpc_ai_complete_need_turn_v2_service(${q(account)},${q(cid)},${q(key)},${q(attempt)},'W03_SYNTHETIC_USER_TEXT','W03_SYNTHETIC_ASSISTANT','ALLOW','[]')`;
try{
 check('EXACT105_PREDECESSOR_AND106_PRESERVATION');
 assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')),105);
 assert.equal(sql(`select md5(statements[1]) from supabase_migrations.schema_migrations order by version desc limit 1`),manifest.predecessor105_md5);
 for(const [client,email,id] of [[owner,env.RU5_DEVICE_REQUESTER_EMAIL,account],[other,env.RU5_DEVICE_WORKER_EMAIL,outsider]]){
  await ok(client.auth.signInWithPassword({email,password:env.RU5_DEVICE_PASSWORD}));assert.equal((await ok(client.auth.getUser())).user.id,id);
 }
 const originalHistory=rows('select * from supabase_migrations.schema_migrations order by version');
 const oldTables=rows("select schemaname||'.'||tablename as name from pg_tables where schemaname in('public','private') order by 1").map(x=>x.name);
 for(const name of oldTables)assert.match(name,/^(?:public|private)\.[a-z_0-9]+$/);
 const priorHashes=Object.fromEntries(oldTables.map(name=>[name,hashTable(name)]));
 const oldFunctions=rows("select oid,md5(prosrc) body_md5,proacl,prosecdef,proconfig,proowner from pg_proc where pronamespace in('public'::regnamespace,'private'::regnamespace) order by oid");
 const beforeReady=sql('select private.retention_ai_source_ready()');assert.equal(beforeReady,'t');
 const policyHash=hashTable('private.retention_policy_sets'),legalHash=hashTable('private.legal_document_versions');
 const directOids=rows("select 'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure::oid id union all select 'public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)'::regprocedure::oid").map(x=>x.id);
 const changedBodySignatures=['public.rpc_save_need_draft_from_review(uuid,uuid,text)',
  'public.rpc_ai_confirm_fact(uuid)','public.rpc_ai_correct_fact_v2(uuid,jsonb,text)','public.rpc_ai_correct_fact(uuid,text)'];
 const changedBodyOids=changedBodySignatures.map(signature=>Number(sql(`select ${q(signature)}::regprocedure::oid`)));
 sql(source.toString('utf8'));
 sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(manifest.forward_version)},${q(manifest.forward_name)},array[${q(source.toString('utf8'))}])`);
 assert.deepEqual(rows(`select * from supabase_migrations.schema_migrations where version<>${q(manifest.forward_version)} order by version`),originalHistory);
 assert.deepEqual(Object.fromEntries(oldTables.map(name=>[name,hashTable(name)])),priorHashes);
 const afterFunctions=new Map(rows(`select oid,md5(prosrc) body_md5,proacl,prosecdef,proconfig,proowner from pg_proc where oid in(${oldFunctions.map(f=>f.oid).join(',')})`).map(x=>[x.oid,x]));
 for(const old of oldFunctions){const after=afterFunctions.get(old.oid);
  if(directOids.includes(old.oid)){assert.deepEqual({...after,proacl:old.proacl},old);}
  else if(changedBodyOids.includes(old.oid))assert.deepEqual({...after,body_md5:old.body_md5},old);
  else assert.deepEqual(after,old);}
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');
 report.original_history_unchanged=true;report.original_table_count=oldTables.length;report.original_table_hashes=priorHashes;
 report.original_functions_unchanged_except_two_closed_acls_and_four_named_bodies=true;
 report.changed_body_signatures=changedBodySignatures;report.source105_compatible=true;
 for(let i=0;i<40;i++){const r=await owner.rpc('rpc_ai_open_need_conversation_owned_v2',{p_client_request_id:randomUUID()});if(!r.error){scoped[r.data.conversationId]=true;break;}if(i===39)throw new Error('SCHEMA_RELOAD_FAILED');await wait(250);}pass();

 check('OWNED_OPEN_STABLE_UUID_REPLAY_AND_CROSS_ACCOUNT_FENCES');
 const openKey=randomUUID();const [a,b]=await Promise.all([owner.rpc('rpc_ai_open_need_conversation_owned_v2',{p_client_request_id:openKey}),owner.rpc('rpc_ai_open_need_conversation_owned_v2',{p_client_request_id:openKey})].map(ok));
 assert.equal(a.conversationId,b.conversationId);assert.equal(a.clientRequestId,openKey);assert.equal(a.authoritative,true);scoped[a.conversationId]=true;
 assert.deepEqual([a.idempotentReplay,b.idempotentReplay].sort(),[false,true]);
 const otherOpen=await ok(other.rpc('rpc_ai_open_need_conversation_owned_v2',{p_client_request_id:openKey}));assert.notEqual(otherOpen.conversationId,a.conversationId);
 await denied(anon.rpc('rpc_ai_open_need_conversation_owned_v2',{p_client_request_id:randomUUID()}));
 await denied(other.rpc('rpc_ai_read_need_turn_v2',{p_conversation_id:a.conversationId,p_client_request_id:randomUUID()}),'CONVERSATION_NOT_FOUND');
 assert.equal(sql(`select count(*) from private.ai_need_open_commands where account_id=${q(account)} and client_request_id=${q(openKey)}`),'1');pass();

 check('DUPLICATE_CLAIM_AND_COMPLETION_PERSIST_EXACTLY_ONE_PAIR');clearRate();
 const cid=await fresh(),key=randomUUID();assert.equal((await read(cid,key)).state,'ABSENT');
 const claims=await Promise.all([claim(cid,key),claim(cid,key)]);assert.equal(claims.filter(x=>x.claim!==null).length,1);
 const winner=claims.find(x=>x.claim).claim;assert.equal(claims[0].turn.turnId,claims[1].turn.turnId);
 assert.deepEqual((await read(cid,key)).state,'PROCESSING');
 const done=await Promise.all([finish(cid,key,winner.attemptId),finish(cid,key,winner.attemptId)]);
 assert.deepEqual(done[0],done[1]);assert.equal(done[0].state,'SUCCEEDED');assert.equal(messages(cid),2);
 assert.deepEqual(await read(cid,key),done[0]);assert.equal((await claim(cid,key)).claim,null);
 await denied(service.rpc('rpc_ai_claim_need_turn_v2_service',input(cid,key,'DIFFERENT_TEXT')),'AI_REQUEST_ID_REUSED');
 await denied(service.rpc('rpc_ai_claim_need_turn_v2_service',input(await fresh(),key)),'AI_REQUEST_ID_REUSED');pass();

 check('EXPIRED_ATTEMPT_CANNOT_COMMIT_AFTER_NEW_GENERATION');clearRate();
 const retryCid=await fresh(),retryKey=randomUUID(),first=await claim(retryCid,retryKey);expire(retryCid,retryKey);
 const expired=await read(retryCid,retryKey);assert.equal(expired.state,'FAILED');assert.equal(expired.retryAllowed,true);
 const second=await claim(retryCid,retryKey);assert.equal(first.turn.turnId,second.turn.turnId);assert.notEqual(first.claim.attemptId,second.claim.attemptId);
 assert.equal((await finish(retryCid,retryKey,first.claim.attemptId)).state,'PROCESSING');assert.equal(messages(retryCid),0);
 assert.equal((await finish(retryCid,retryKey,second.claim.attemptId)).state,'SUCCEEDED');assert.equal(messages(retryCid),2);pass();

 check('CONTEXT_CHANGE_REQUIRES_RETRY_WITH_FRESH_SERVER_CONTEXT');clearRate();
 const staleCid=await fresh(),staleKey=randomUUID(),stale=await claim(staleCid,staleKey);
 sql(`insert into public.ai_messages(account_id,conversation_id,role,body) values(${q(account)},${q(staleCid)},'USER','DISPOSABLE_OTHER_DEVICE_CONTEXT_CHANGE')`);
 const staleResult=await finish(staleCid,staleKey,stale.claim.attemptId);assert.equal(staleResult.state,'FAILED');assert.equal(staleResult.retryAllowed,true);assert.equal(messages(staleCid),1);
 const renewed=await claim(staleCid,staleKey);assert.equal(renewed.claim.context.history.length,1);await finish(staleCid,staleKey,renewed.claim.attemptId);assert.equal(messages(staleCid),3);
 // Hold the parent BEFORE materializing a replacement. The historical human
 // functions would take the fact then wait on this parent, causing a deadlock
 // when the writer proceeds. Current owners wait without taking that fact and
 // recheck SUPERSEDED after the writer commits.
 const titleProposal=value=>[{key:'need.title',value,displayValue:value,confidence:0.9,evidence:'DISPOSABLE_PARENT_LOCK_FIXTURE'}];
 const seedTitle=async()=>{const c=await fresh(),k=randomUUID(),x=await claim(c,k);await finish(c,k,x.claim.attemptId,{proposals:titleProposal('Prvi naslov')});
  const review=await ok(owner.rpc('rpc_ai_need_review_v2',{p_conversation_id:c}));return {c,f:review.facts.find(f=>f.key==='need.title').id};};
 const replacementSql=(c,k,a)=>`select public.rpc_ai_complete_need_turn_v2_service(${q(account)},${q(c)},${q(k)},${q(a)},'W03_SYNTHETIC_USER_TEXT','W03_SYNTHETIC_ASSISTANT','ALLOW',${q(JSON.stringify(titleProposal('Novi naslov')))}::jsonb)`;
 for(const mode of ['confirm','correct']){
  clearRate();const {c,f}=await seedTitle(),k=randomUUID(),x=await claim(c,k);
  const holder=transaction('w03_parent_before_'+mode,'service_role',`${claimSql(c,k)};select pg_sleep(1.5);${replacementSql(c,k,x.claim.attemptId)}`);
  await observeSleep(holder.name);
  const humanSql=mode==='confirm'?`select public.rpc_ai_confirm_fact(${q(f)})`:
   `select public.rpc_ai_correct_fact_v2(${q(f)},'"Ljudska ispravka"'::jsonb,'Ljudska ispravka')`;
  const human=transaction('w03_'+mode+'_wait','authenticated',humanSql),locks=await observeLock(human.name);
  assert.equal((await holder.done).code,0);const result=await human.done;assert.notEqual(result.code,0);assert.ok(result.stderr.includes('SUPERSEDED'));
  assert.equal(sql(`select status='NEEDS_CONFIRMATION' and superseded_at is not null from public.ai_structured_facts where id=${q(f)}`),'t');
  assert.equal((await read(c,k)).state,'SUCCEEDED');assert.equal(messages(c),4);
  report.lock_interleavings.push({order:mode==='confirm'?'COMPLETE_THEN_CONFIRM':'COMPLETE_THEN_CORRECT_V2',observed:locks,result:'SUPERSEDED_RECHECK_NO_DEADLOCK'});
 }
 clearRate();const {c:humanCid,f:humanFact}=await seedTitle(),humanKey=randomUUID(),humanTurn=await claim(humanCid,humanKey);
 const humanFirst=transaction('w03_confirm_first','authenticated',`select public.rpc_ai_confirm_fact(${q(humanFact)})`,{pause:1.5});await observeSleep(humanFirst.name);
 const afterHuman=transaction('w03_complete_after_confirm','service_role',replacementSql(humanCid,humanKey,humanTurn.claim.attemptId));
 const humanLocks=await observeLock(afterHuman.name);assert.equal((await humanFirst.done).code,0);assert.equal((await afterHuman.done).code,0);
 assert.equal((await read(humanCid,humanKey)).state,'FAILED');assert.equal(messages(humanCid),2);
 assert.equal(sql(`select status='CONFIRMED' and confirmed_by_user_id=${q(account)} and confirmed_at is not null from public.ai_structured_facts where id=${q(humanFact)}`),'t');
 report.lock_interleavings.push({order:'CONFIRM_THEN_COMPLETE',observed:humanLocks,result:'CHANGED_CONTEXT_NO_OVERWRITE'});pass();

 check('OLD_SERVICE_BYPASSES_CLOSED_WITH_LEGACY_SCHEMA_PRESERVED');clearRate();
 const guardCid=await fresh(),args={p_account_id:account,p_conversation_id:guardCid,p_user_message:'x',p_assistant_message:'x',p_safety:'ALLOW',p_proposals:[]};
 for(const name of ['rpc_ai_apply_interview_turn_v2_service','rpc_ai_apply_interview_turn_service']){await denied(service.rpc(name,args));await denied(owner.rpc(name,args));}
 await denied(service.rpc('rpc_ai_apply_legacy_need_turn_service',args),'LEGACY_CONVERSATION_REQUIRED');assert.equal(messages(guardCid),0);
 const legacy=randomUUID();sql(`insert into public.ai_conversations(id,account_id,purpose,fact_schema_version) values(${q(legacy)},${q(account)},'NEED_INTAKE','LEGACY_TEXT_V1')`);
 const legacyProposal=value=>[{key:'naslov',value,confidence:0.9,evidence:'DISPOSABLE_LEGACY_LOCK_FIXTURE'}];
 await ok(service.rpc('rpc_ai_apply_legacy_need_turn_service',{...args,p_conversation_id:legacy,p_proposals:legacyProposal('Prvi naslov')}));assert.equal(messages(legacy),2);
 const legacyFact=sql(`select id from public.ai_structured_facts where conversation_id=${q(legacy)} and superseded_at is null`);
 const legacyWrite=proposals=>`select public.rpc_ai_apply_legacy_need_turn_service(${q(account)},${q(legacy)},'x','x','ALLOW',${q(JSON.stringify(proposals))}::jsonb)`;
 const legacyHolder=transaction('w03_legacy_parent_first','service_role',`${legacyWrite([])};select pg_sleep(1.5);${legacyWrite(legacyProposal('Novi naslov'))}`);await observeSleep(legacyHolder.name);
 const legacyHuman=transaction('w03_legacy_correct_wait','authenticated',`select public.rpc_ai_correct_fact(${q(legacyFact)},'Ljudska ispravka')`),legacyLocks=await observeLock(legacyHuman.name);
 assert.equal((await legacyHolder.done).code,0);const legacyResult=await legacyHuman.done;assert.notEqual(legacyResult.code,0);assert.ok(legacyResult.stderr.includes('SUPERSEDED'));
 assert.equal(sql(`select status='NEEDS_CONFIRMATION' and superseded_at is not null from public.ai_structured_facts where id=${q(legacyFact)}`),'t');
 report.lock_interleavings.push({order:'LEGACY_COMPLETE_THEN_CORRECT',observed:legacyLocks,result:'SUPERSEDED_RECHECK_NO_DEADLOCK'});pass();

 check('EXPLICIT_OWNED_ABANDONMENT_FENCES_ACTIVE_TURN_AND_P3_ORIGIN');clearRate();
 const abandonCid=await fresh(),abandonKey=randomUUID(),pending=await claim(abandonCid,abandonKey);
 assert.equal(sql(`select retention_unbound_origin from public.ai_conversations where id=${q(abandonCid)}`),'t');
 await denied(abandon(abandonCid,other),'CONVERSATION_NOT_FOUND');assert.equal((await read(abandonCid,abandonKey)).state,'PROCESSING');
 const abandoned=await ok(abandon(abandonCid));assert.equal(abandoned.status,'ABANDONED');assert.equal(abandoned.idempotentReplay,false);
 const timestamp=sql(`select retention_abandoned_at from public.ai_conversations where id=${q(abandonCid)}`);assert.ok(timestamp);
 assert.equal((await ok(abandon(abandonCid))).idempotentReplay,true);assert.equal(sql(`select retention_abandoned_at from public.ai_conversations where id=${q(abandonCid)}`),timestamp);
 assert.deepEqual({...await read(abandonCid,abandonKey),receipt:null},{conversationId:abandonCid,clientRequestId:abandonKey,state:'FAILED',turnId:pending.turn.turnId,retryAllowed:false,receipt:null});
 assert.equal((await finish(abandonCid,abandonKey,pending.claim.attemptId)).retryAllowed,false);assert.equal(messages(abandonCid),0);
 assert.equal(sql(`select private.retention_ai_candidate(${q(abandonCid)}) is not null`),'t');
 const stillOpen=await fresh();assert.equal(sql(`select private.retention_ai_candidate(${q(stillOpen)}) is null`),'t');
 assert.equal(sql(`select status from public.ai_conversations where id=${q(stillOpen)}`),'OPEN');
 assert.equal((await ok(owner.rpc('rpc_get_retention_execution_status'))).executionAdmitted,false);
 assert.equal(hashTable('private.retention_policy_sets'),policyHash);assert.equal(hashTable('private.legal_document_versions'),legalHash);
 report.explicit_owned_abandonment_proven=true;report.open_autoabandoned=false;report.retention_future_origin_not_backfilled=true;pass();

 check('CANONICAL_DRAFT_SAVE_AND_CLOSED_RECEIPT_REPLAY_PRESERVED');clearRate();
 const saveCid=await fresh(),saveKey=randomUUID(),saveClaim=await claim(saveCid,saveKey);
 const facts=[['need.title','Kratka lektura'],['need.description','Pregled pravopisa dve strane.'],['need.category','pisanje'],['need.price_mode','OFFERS'],
  ['need.schedule_kind','FLEXIBLE'],['need.people_needed',1],['need.task_geography',{mode:'REMOTE'}],['need.task_country_code','RS']];
 const proposals=facts.map(([key,value])=>({key,value,displayValue:typeof value==='object'?'Na daljinu':String(value),confidence:0.9,evidence:'DISPOSABLE_CONFIRMED_REVIEW_FIXTURE'}));
 const savedTurn=await finish(saveCid,saveKey,saveClaim.claim.attemptId,{proposals});
 const review=await ok(owner.rpc('rpc_ai_need_review_v2',{p_conversation_id:saveCid}));
 for(const fact of review.facts)await ok(owner.rpc('rpc_ai_confirm_fact',{p_fact_id:fact.id}));
 const profile=(await ok(owner.from('app_profiles').select('id').eq('account_id',account).eq('kind','REQUESTER').eq('profile_status','ACTIVE').single())).id;
 const saveArgs={p_conversation_id:saveCid,p_requester_profile_id:profile,p_client_request_id:randomUUID()};
 // A provider completion after the visible required-fact review cannot silently
 // drop its optional proposal while a concurrent save waits on the parent lock.
 const optionalKey=randomUUID(),optional=await claim(saveCid,optionalKey);
 const optionalProposal=[{key:'need.required_vehicles',value:['van'],displayValue:'Kombi',confidence:0.9,evidence:'DISPOSABLE_OPTIONAL_PROPOSAL'}];
 const optionalWriter=transaction('w03_optional_first','service_role',
  `select public.rpc_ai_complete_need_turn_v2_service(${q(account)},${q(saveCid)},${q(optionalKey)},${q(optional.claim.attemptId)},'W03_SYNTHETIC_USER_TEXT','W03_SYNTHETIC_ASSISTANT','ALLOW',${q(JSON.stringify(optionalProposal))}::jsonb)`,{pause:1.5});
 await observeSleep(optionalWriter.name);
 const saveWaiter=transaction('w03_save_wait','authenticated',`select public.rpc_save_need_draft_from_review(${q(saveCid)},${q(profile)},${q(saveArgs.p_client_request_id)})`);
 const optionalLocks=await observeLock(saveWaiter.name);assert.equal((await optionalWriter.done).code,0);
 const refused=await saveWaiter.done;assert.notEqual(refused.code,0);assert.ok(refused.stderr.includes('EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION'));
 assert.equal(sql(`select count(*) from private.need_draft_save_commands where conversation_id=${q(saveCid)}`),'0');
 assert.equal(sql(`select bound_need_id is null from public.ai_conversations where id=${q(saveCid)}`),'t');
 report.lock_interleavings.push({order:'OPTIONAL_TURN_THEN_SAVE',observed:optionalLocks,result:'HUMAN_CONFIRMATION_REQUIRED_NO_DRAFT'});
 const refreshedReview=await ok(owner.rpc('rpc_ai_need_review_v2',{p_conversation_id:saveCid}));
 const optionalFact=refreshedReview.facts.find(f=>f.key==='need.required_vehicles');assert.equal(optionalFact.status,'NEEDS_CONFIRMATION');
 await ok(owner.rpc('rpc_ai_confirm_fact',{p_fact_id:optionalFact.id}));
 const saved=await ok(owner.rpc('rpc_save_need_draft_from_review',saveArgs));assert.equal(saved.status,'DRAFT');
 assert.deepEqual(await ok(owner.rpc('rpc_save_need_draft_from_review',saveArgs)),saved);assert.deepEqual(await read(saveCid,saveKey),savedTurn);
 await denied(abandon(saveCid),'CONVERSATION_NOT_ABANDONABLE');
 const edit=await ok(owner.rpc('rpc_ai_open_need_edit_conversation_v2',{p_need_id:saved.needId}));
 await denied(abandon(edit.conversationId),'CONVERSATION_NOT_ABANDONABLE');report.saved_draft_id=saved.needId;pass();

 check('ACTUAL_HANDLER_AUTH_SQL_RECEIPT_WITH_SYNTHETIC_PROVIDER');clearRate();
 const edgeCid=await fresh(),edgeKey=randomUUID(),token=(await ok(owner.auth.getSession())).session.access_token;
 let providerCalls=0;const origin=new URL(url).origin;const fakeProviderKey='SYNTHETIC_NON_SECRET_PROVIDER_KEY';
 const edgeEnv={SUPABASE_URL:url,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,
  AI_PROVIDER:'openai',OPENAI_API_KEY:fakeProviderKey,OPENAI_MODEL:'SYNTHETIC_PROVIDER_MODEL'};
 const runtime=loadOwnedIntakeHandler({env:name=>edgeEnv[name],fetch:async(input,init={})=>{
  const target=new URL(String(input));
  if(target.href==='https://api.openai.com/v1/responses'){providerCalls++;assert.equal(new Headers(init.headers).get('Authorization'),'Bearer '+fakeProviderKey);
   return new Response(JSON.stringify({status:'completed',output_text:JSON.stringify({safety:'ALLOW',assistantMessage:'Pregledajte podatke.',facts:[]})}),{headers:{'Content-Type':'application/json'}});}
  assert.equal(target.origin,origin);assert.ok(target.pathname==='/auth/v1/user'||target.pathname.startsWith('/rest/v1/'));return fetch(input,init);
 }});
 const invoke=()=>runtime.handler(new Request('https://synthetic-handler.invalid',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({conversationId:edgeCid,clientRequestId:edgeKey,text:'DISPOSABLE_ACTUAL_HANDLER_INPUT'})}));
 const edgeResponse=await invoke();assert.equal(edgeResponse.status,200);const edgeReceipt=await edgeResponse.json();assert.equal(edgeReceipt.state,'SUCCEEDED');
 assert.deepEqual(await read(edgeCid,edgeKey),edgeReceipt);assert.equal(messages(edgeCid),2);assert.deepEqual(await(await invoke()).json(),edgeReceipt);assert.equal(providerCalls,1);
 report.actual_edge_source_hashes=runtime.sourceHashes;report.actual_edge_auth_verified=true;report.actual_edge_persisted_once=true;pass();

 check('ABANDON_FIRST_COMPLETION_WAIT_OBSERVED');clearRate();
 const raceCid=await fresh(),raceKey=randomUUID(),race=await claim(raceCid,raceKey);
 const holder=transaction('w03_abandon_first','authenticated',`select public.rpc_ai_abandon_need_conversation_v2(${q(raceCid)})`,{pause:1.5});await observeSleep(holder.name);
 const waiter=transaction('w03_complete_wait','service_role',finishSql(raceCid,raceKey,race.claim.attemptId));const locks=await observeLock(waiter.name);
 assert.equal((await holder.done).code,0);assert.equal((await waiter.done).code,0);assert.equal(messages(raceCid),0);assert.equal((await read(raceCid,raceKey)).retryAllowed,false);
 report.lock_interleavings.push({order:'ABANDON_THEN_COMPLETE',observed:locks,result:'NO_LATE_TURN'});pass();

 check('COMPLETE_FIRST_ABANDON_WAIT_OBSERVED');clearRate();
 const reverseCid=await fresh(),reverseKey=randomUUID(),reverse=await claim(reverseCid,reverseKey);
 const firstWriter=transaction('w03_complete_first','service_role',finishSql(reverseCid,reverseKey,reverse.claim.attemptId),{pause:1.5});await observeSleep(firstWriter.name);
 const abandonWaiter=transaction('w03_abandon_wait','authenticated',`select public.rpc_ai_abandon_need_conversation_v2(${q(reverseCid)})`);const reverseLocks=await observeLock(abandonWaiter.name);
 assert.equal((await firstWriter.done).code,0);assert.equal((await abandonWaiter.done).code,0);assert.equal(messages(reverseCid),2);assert.equal((await read(reverseCid,reverseKey)).state,'SUCCEEDED');
 report.lock_interleavings.push({order:'COMPLETE_THEN_ABANDON',observed:reverseLocks,result:'ONE_TURN_THEN_EXPLICIT_CLOSED'});pass();

 check('AUTHORITATIVE_RATE_AND_PRIVATE_LEDGER_GRANTS');clearRate();
 for(let i=0;i<6;i++){const c=await fresh(),k=randomUUID(),x=await claim(c,k);await finish(c,k,x.claim.attemptId);}
 await denied(service.rpc('rpc_ai_claim_need_turn_v2_service',input(await fresh(),randomUUID())),'AI_RATE_LIMITED');
 for(const signature of ['public.rpc_ai_claim_need_turn_v2_service(uuid,uuid,uuid,text)','public.rpc_ai_complete_need_turn_v2_service(uuid,uuid,uuid,uuid,text,text,text,jsonb)',
  'public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)','public.rpc_ai_apply_legacy_need_turn_service(uuid,uuid,text,text,text,jsonb)']){
  assert.equal(sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE') and not has_function_privilege('authenticated',${q(signature)},'EXECUTE') and not has_function_privilege('anon',${q(signature)},'EXECUTE')`),'t');}
 for(const table of ['private.ai_need_open_commands','private.ai_need_turn_commands']){
  assert.equal(sql(`select relrowsecurity and relforcerowsecurity from pg_class where oid=${q(table)}::regclass`),'t');
  assert.equal(sql(`select count(*) from pg_policy where polrelid=${q(table)}::regclass`),'0');
  assert.equal(sql(`select has_table_privilege('authenticated',${q(table)},'SELECT') or has_table_privilege('service_role',${q(table)},'SELECT')`),'f');}
 assert.equal(sql('select private.retention_ai_source_ready()'),'t');assert.equal(hashTable('private.retention_policy_sets'),policyHash);
 report.migration_history_count=Number(sql('select count(*) from supabase_migrations.schema_migrations'));
 assert.equal(report.migration_history_count,106);report.actual_database_proven=true;pass();report.result='PASS';
}catch(error){report.result='FAIL';report.failed_check=current;report.failure=error instanceof assert.AssertionError?'ASSERTION_FAILED':String(error.message).slice(0,180);
 report.failure_location=String(error.stack).split('\n').find(line=>line.includes('owned_intake_proof.mjs:'))?.trim();process.exitCode=1;
}finally{for(const child of children)if(child.exitCode===null)child.kill();writeFileSync(out+'/proof-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
