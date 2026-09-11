// Real disposable Auth/Postgres Inbox semantics, no live/provider access.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env;assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const out=env.PRE_V3_ARTIFACT_DIR??'artifacts/pre-v3';mkdirSync(out,{recursive:true});
const report={unit:'PRE_V3_INBOX_VISIBILITY',result:'RUNNING',sourceSha:env.GITHUB_SHA,actualDatabase:true,actualAuth:true,liveAccess:false,providerCalled:false,deviceProven:false,checks:[]};
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=s=>execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000}).trim();
const rows=s=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${s}) r`));
const ok=async p=>{const r=await p;if(r.error)throw new Error('LOCAL_RPC:'+r.error.code+':'+r.error.message);return r.data;};
const pass=name=>{report.checks.push({name,result:'PASS'});console.log('PASS '+name);};
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,opts);
async function actor(label){const email=`pre-v3-inbox-${label}-${randomUUID()}@proof.invalid`,password=randomUUID()+'Aa8!';
 const {user}=await ok(admin.auth.admin.createUser({email,password,email_confirm:true}));
 const client=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,opts);await ok(client.auth.signInWithPassword({email,password}));return{client,id:user.id};}
try {
 const original=rows('select * from supabase_migrations.schema_migrations order by version');assert.ok([108,110].includes(original.length));
 const file='20260911183000_clean_pre_v3_inbox_delivery_visibility.sql',path='supabase/migrations/'+file,bytes=readFileSync(path);
 assert.deepEqual(bytes,execFileSync('git',['show',`${env.GITHUB_SHA}:${path}`]));sql(bytes.toString('utf8'));
 sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(file.slice(0,14))},${q(file.slice(15,-4))},array[${q(bytes.toString('utf8'))}])`);
 assert.deepEqual(rows(`select * from supabase_migrations.schema_migrations where version<>${q(file.slice(0,14))} order by version`),original);
 report.migration={file,sha256:createHash('sha256').update(bytes).digest('hex')};
 sql("notify pgrst,'reload schema'");await new Promise(r=>setTimeout(r,1000));
 const A=await actor('a'),B=await actor('b');
 const emit=(role='REQUESTER',type='RESPONSE_RECEIVED',recipient=A.id)=>sql(`select private.emit_event(${q(recipient)}::uuid,${q(role)},${q(type)},'NEED',${q(randomUUID())}::uuid,1,'Test title','Test body',${q(randomUUID())})`);
 const list=(args={})=>ok(A.client.rpc('rpc_list_inbox',args));
 async function prefs(patch){const p=await ok(A.client.rpc('rpc_get_notification_preferences',{p_role:'REQUESTER',p_expected_user_id:A.id}));
  await ok(A.client.rpc('rpc_set_notification_preferences',{p_role:'REQUESTER',p_expected_user_id:A.id,p_expected_revision:p.revision,p_settings:{...p.settings,...patch}}));}
 const first=emit();await prefs({responses_enabled:false});const suppressedCategory=emit();
 await prefs({responses_enabled:true,in_app_enabled:false});const suppressedApp=emit();
 await prefs({in_app_enabled:true,push_enabled:true,quiet_hours_enabled:true,quiet_start:'00:00:00',quiet_end:'00:00:00',quiet_timezone:'UTC'});
 const quiet=emit(),worker=emit('WORKER'),other=emit('REQUESTER','RESPONSE_RECEIVED',B.id);
 // More hidden events than page size must not consume visible pagination slots.
 await prefs({responses_enabled:false});for(let i=0;i<4;i++)emit();
 let visible=await list({p_limit:2});assert.equal(visible.items.length,2);assert.equal(visible.hasMore,true);assert.equal(visible.unreadCount,3);
 const last=visible.items.at(-1),second=await list({p_limit:2,p_before_at:last.occurredAt,p_before_id:last.id});
 assert.equal(second.items.length,1);assert.equal(second.hasMore,false);
 assert.deepEqual(new Set([...visible.items,...second.items].map(e=>e.id)),new Set([first,quiet,worker]));
 assert.equal((await list({p_role:'REQUESTER'})).unreadCount,2);assert.equal((await list({p_role:'WORKER'})).unreadCount,1);
 assert.deepEqual((await ok(B.client.rpc('rpc_list_inbox',{}))).items.map(e=>e.id),[other]);
 pass('SUPPRESSED_ITEMS_AND_UNREAD_HIDDEN_BEFORE_PAGINATION_OWNER_ROLE_SCOPED');
 const delivery=rows(`select channel,state,suppression_reason from public.notification_deliveries where event_id=${q(quiet)}::uuid order by channel`);
 assert.ok(delivery.some(d=>d.channel==='PUSH'&&d.state==='SUPPRESSED'&&d.suppression_reason==='QUIET_HOURS'));
 assert.ok(delivery.some(d=>d.channel==='IN_APP'&&d.state!=='SUPPRESSED'));
 assert.ok((await list()).items.some(e=>e.id===quiet));pass('QUIET_HOURS_DO_NOT_REMOVE_VALID_IN_APP');
 for(const id of [suppressedCategory,suppressedApp,other])assert.ok((await A.client.rpc('rpc_mark_activity_event_read',{p_event_id:id})).error);
 const readAt=await ok(A.client.rpc('rpc_mark_activity_event_read',{p_event_id:first}));
 assert.equal(await ok(A.client.rpc('rpc_mark_activity_event_read',{p_event_id:first})),readAt);
 assert.equal((await list()).unreadCount,2);
 const asOf=(await list()).asOf;
 assert.equal(await ok(A.client.rpc('rpc_mark_inbox_read',{p_through:asOf,p_role:'REQUESTER'})),1);
 assert.equal((await list()).unreadCount,1);
 assert.equal(Number(sql(`select count(*) from public.user_activity_events where id in (${q(suppressedCategory)}::uuid,${q(suppressedApp)}::uuid) and read_at is null`)),2);
 pass('READ_ONE_AND_READ_ALL_RESPECT_VISIBILITY_WITH_DURABLE_AUDIT_PRESERVED');
 assert.equal(sql("select private.category_of_event('CLARIFICATION_CREATED')||'/'||private.category_of_event('CLARIFICATION_ANSWERED')"),'responses/responses');
 assert.equal(Number(sql("select count(*) from public.user_activity_events where event_type='REVIEW_RECEIVED'")),0);
 const anonymous=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,opts);assert.ok((await anonymous.rpc('rpc_list_inbox',{})).error);
 pass('CLARIFICATION_CATEGORY_FROZEN_NO_FABRICATED_REVIEW_OR_ANON_ACCESS');
 report.result='PASS';report.historyCount=original.length+1;
} catch(e){report.result='FAIL';report.failure=String(e.message).slice(0,500);process.exitCode=1;console.error(report.failure);}
finally{writeFileSync(out+'/inbox-visibility-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' PRE_V3_INBOX_VISIBILITY');}
