// Proof-only local Auth/Postgres adapter. No production target or provider access.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
export {assert,randomUUID};
export const env=process.env,sha=env.GITHUB_SHA;
assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.match(sha??'',/^[a-f0-9]{40}$/);
export const out=env.PRE_V3_ARTIFACT_DIR??'artifacts/pre-v3';mkdirSync(out,{recursive:true});
export const q=x=>"'"+String(x).replaceAll("'","''")+"'";
export function sql(s){try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-At'],
 {input:s,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}).trim();}
 catch(e){throw new Error('LOCAL_SQL:'+String(e.stderr).slice(0,900));}}
export const rows=s=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${s}) r`));
export const ok=async p=>{const r=await p;if(r.error)throw new Error('LOCAL_RPC:'+r.error.code+':'+r.error.message);return r.data;};
export const denied=async(p,message)=>{const r=await p;assert.ok(r.error,'EXPECTED_DENIAL:'+message);if(message)assert.equal(r.error.message,message);return r.error;};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
export const make=()=>createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
export const service=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
export const requester=make(),worker=make(),anon=make();
export const requesterId=env.RU5_DEVICE_REQUESTER_USER_ID,workerId=env.RU5_DEVICE_WORKER_USER_ID;
export let rp,wp;
export async function login(){
 await ok(requester.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 await ok(worker.auth.signInWithPassword({email:env.RU5_DEVICE_WORKER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 rp=rows(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid and kind='REQUESTER'`)[0].id;
 wp=rows(`select id from public.app_profiles where account_id=${q(workerId)}::uuid and kind='WORKER'`)[0].id;
}
export async function actor(label){
 const email=`pre-v3-${label}-${randomUUID()}@proof.invalid`,password=randomUUID()+'Aa8!';
 const {user}=await ok(service.auth.admin.createUser({email,password,email_confirm:true}));
 const client=make();await ok(client.auth.signInWithPassword({email,password}));return{client,id:user.id};
}
export function report(unit){return {unit,result:'RUNNING',sourceSha:sha,sourceTree:execFileSync('git',['rev-parse',sha+'^{tree}'],{encoding:'utf8'}).trim(),
 actualAuth:true,actualDatabase:true,liveAccess:false,providerCalled:false,deviceProven:false,sqlPublishedFixtures:true,checks:[],migrations:[]};}
export function pass(r,name){r.checks.push({name,result:'PASS'});console.log('PASS '+name);}
export async function prove(unit,file,fn){const r=report(unit);try{await fn(r);r.result='PASS';}
 catch(e){r.result='FAIL';r.failure=String(e.message).slice(0,1100);process.exitCode=1;console.error(r.failure);}
 finally{writeFileSync(out+'/'+file,JSON.stringify(r,null,2)+'\n');console.log(r.result+' '+unit);}}
export async function apply(r,file,predecessor){
 const before=rows('select * from supabase_migrations.schema_migrations order by version');assert.equal(before.length,predecessor);
 const path='supabase/migrations/'+file,b=readFileSync(path);assert.deepEqual(b,execFileSync('git',['show',sha+':'+path]));
 sql(b.toString());sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(file.slice(0,14))},${q(file.slice(15,-4))},array[${q(b.toString())}]);notify pgrst,'reload schema'`);
 assert.deepEqual(rows(`select * from supabase_migrations.schema_migrations where version<>${q(file.slice(0,14))} order by version`),before);
 r.migrations.push({file,sha256:createHash('sha256').update(b).digest('hex')});r.historyCount=predecessor+1;
 await new Promise(resolve=>setTimeout(resolve,1000));
}
export function need(label,slots=2){const id=randomUUID();
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
 approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
 values(${q(id)}::uuid,${q(requesterId)}::uuid,${q(rp)}::uuid,'PUBLISHED',${q('PRE-V3 '+label)},'Disposable SQL fixture',
 'PROOF','Novi Sad','Liman','OFFERS',${slots},'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);return id;}
export const command=(id,price=3000,key=randomUUID())=>({p_need_id:id,p_need_revision:1,p_worker_profile_id:wp,p_covered_slots:1,
 p_price_rsd:price,p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:key});
export const submit=(id,price=3000,key=randomUUID())=>ok(worker.rpc('rpc_submit_response',command(id,price,key)));
export const select=(id,a,key=randomUUID())=>ok(requester.rpc('rpc_select_response',{p_need_id:id,p_need_revision:a.needRevision,
 p_response_id:a.responseId,p_response_version:a.version,p_content_hash:a.contentHash,p_client_request_id:key}));
export async function agreement(label){const id=need(label);const app=await submit(id);return {needId:id,app,id:await select(id,app)};}
export const events=id=>rows(`select * from public.user_activity_events where entity_id=${q(id)}::uuid order by created_at,id`);
export async function prefs(client,id,role,patch){const p=await ok(client.rpc('rpc_get_notification_preferences',{p_role:role,p_expected_user_id:id}));
 return ok(client.rpc('rpc_set_notification_preferences',{p_role:role,p_expected_user_id:id,p_expected_revision:p.revision,p_settings:{...p.settings,...patch}}));}
// Hold a real SQL transaction while a separate authenticated RPC attempts the
// same lock. The proof records an observed pg_blocking_pids edge, not a sleep race.
export async function lockedRace(statement,request){
 const child=spawn('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});
 let output='',err='';child.stderr.on('data',b=>{err+=b;});
 const ready=new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('LOCK_FIXTURE_TIMEOUT')),10000);
  child.stdout.on('data',b=>{output+=b;if(output.includes('LOCK_READY:')){clearTimeout(t);resolve(Number(/LOCK_READY:(\d+)/.exec(output)[1]));}});
  child.on('exit',code=>{if(!output.includes('LOCK_READY:')){clearTimeout(t);reject(new Error('LOCK_FIXTURE_FAILED:'+code+':'+err.slice(0,400)));}});});
 child.stdin.write(`begin;${statement};select 'LOCK_READY:'||pg_backend_pid();\n`);
 let pending;
 try{const pid=await ready;pending=Promise.resolve().then(request);
  let observed=false;
  for(let i=0;i<80;i++){if(sql(`select exists(select 1 from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid)))`)==='t'){observed=true;break;}await new Promise(r=>setTimeout(r,25));}
  child.stdin.end('commit;\n');assert.ok(observed,'EXPECTED_OBSERVED_LOCK_WAIT');return await pending;
 }finally{if(!child.stdin.destroyed)child.stdin.end('rollback;\n');child.kill();if(pending)await pending.catch(()=>{});}
}
