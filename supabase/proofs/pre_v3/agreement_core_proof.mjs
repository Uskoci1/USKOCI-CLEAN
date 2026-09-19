// Actual local Auth/RPC/SQL Agreement proof. Published tasks and simulated elapsed
// deadlines are explicit SQL fixtures; this is not production publication/device proof.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {assertLocalDeviceProofTargets} from '../ru5_device_ui_local_guard.mjs';
const env=process.env;assertLocalDeviceProofTargets(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_DB_URL);
assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const out=env.PRE_V3_ARTIFACT_DIR??'artifacts/pre-v3';mkdirSync(out,{recursive:true});
const report={unit:'PRE_V3_AGREEMENT_CORE',result:'RUNNING',sourceSha:env.GITHUB_SHA,actualAuth:true,actualDatabase:true,
 liveAccess:false,providerCalled:false,deviceProven:false,sqlPublishedFixtures:true,sqlElapsedDeadlineFixtures:true,checks:[],migrations:[]};
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=s=>{try{return execFileSync('psql',[env.RU5_DEVICE_DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}).trim();}catch(e){throw new Error('LOCAL_SQL:'+String(e.stderr).slice(0,500));}};
const rows=s=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (${s}) r`));
const ok=async p=>{const r=await p;if(r.error)throw new Error('LOCAL_RPC:'+r.error.code+':'+r.error.message);return r.data;};
const denied=async(p,reason)=>{const r=await p;assert.ok(r.error,'EXPECTED_DENIAL:'+reason);if(reason)assert.equal(r.error.message,reason);};
const pass=name=>{report.checks.push({name,result:'PASS'});console.log('PASS '+name);};
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const requester=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const worker=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const outsider=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_ANON_KEY,options);
const service=createClient(env.RU5_DEVICE_SUPABASE_URL,env.RU5_DEVICE_SERVICE_ROLE_KEY,options);
let wp,rp,workerId=env.RU5_DEVICE_WORKER_USER_ID,requesterId=env.RU5_DEVICE_REQUESTER_USER_ID;
const read=id=>ok(requester.rpc('rpc_get_agreement_workspace',{p_agreement_id:id}));
const state=id=>rows(`select a.status,a.current_version,x.state,x.agreement_version,x.worker_marked_done_at,x.completed_at
 from public.agreements a join public.agreement_execution x on x.agreement_id=a.id where a.id=${q(id)}::uuid`)[0];
const countProposals=id=>Number(sql(`select count(*) from public.agreement_change_proposals where agreement_id=${q(id)}::uuid`));
const propose=(id,version,patch={price_rsd:4321,scope_note:'PRIVATE_SCOPE_TEST'},client=requester,key=randomUUID())=>client.rpc('rpc_propose_agreement_change_v2',{
 p_agreement_id:id,p_expected_version:version,p_patch:patch,p_reason:'PRIVATE_REASON_TEST',p_client_request_id:key});
const respond=(pid,accept=true,client=worker)=>client.rpc('rpc_respond_agreement_change',{p_proposal_id:pid,p_accept:accept});
const withdraw=(pid,client=requester)=>client.rpc('rpc_withdraw_agreement_change',{p_proposal_id:pid});
async function agreement(label,start=null,end=null){
 const id=randomUUID(),ts=x=>x===null?'null':q(x)+'::timestamptz';
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
 approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,response_deadline,published_at)
 values(${q(id)}::uuid,${q(requesterId)}::uuid,${q(rp)}::uuid,'PUBLISHED',${q('PRE-V3 '+label)},'Disposable SQL fixture',
 'PROOF','Novi Sad','Liman','OFFERS',1,${q(start?'FIXED_WINDOW':'FLEXIBLE')},${ts(start)},${ts(end)},statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
 const app=await ok(worker.rpc('rpc_submit_response',{p_need_id:id,p_need_revision:1,p_worker_profile_id:wp,p_covered_slots:1,
 p_price_rsd:3000,p_proposed_start_at:start,p_proposed_end_at:end,p_scope_note:null,p_client_request_id:randomUUID()}));
 const aid=await ok(requester.rpc('rpc_select_response',{p_need_id:id,p_need_revision:app.needRevision,p_response_id:app.responseId,
 p_response_version:app.version,p_content_hash:app.contentHash,p_client_request_id:randomUUID()}));
 assert.match(aid,/^[0-9a-f-]{36}$/);return aid;
}
try{
 const history=rows('select * from supabase_migrations.schema_migrations order by version');assert.equal(history.length,111);
 for(const file of ['20260911190000_clean_pre_v3_m05_admitted_source.sql','20260911190100_clean_pre_v3_agreement_execution_guards.sql']){
 const path='supabase/migrations/'+file,b=readFileSync(path);assert.deepEqual(b,execFileSync('git',['show',`${env.GITHUB_SHA}:${path}`]));sql(b.toString());
 sql(`insert into supabase_migrations.schema_migrations(version,name,statements) values(${q(file.slice(0,14))},${q(file.slice(15,-4))},array[${q(b.toString())}])`);
 report.migrations.push({file,sha256:createHash('sha256').update(b).digest('hex')});}
 assert.deepEqual(rows("select * from supabase_migrations.schema_migrations where version<'20260911190000' order by version"),history);
 sql("notify pgrst,'reload schema'");await new Promise(r=>setTimeout(r,1200));
 await ok(requester.auth.signInWithPassword({email:env.RU5_DEVICE_REQUESTER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 await ok(worker.auth.signInWithPassword({email:env.RU5_DEVICE_WORKER_EMAIL,password:env.RU5_DEVICE_PASSWORD}));
 rp=rows(`select id from public.app_profiles where account_id=${q(requesterId)}::uuid and kind='REQUESTER'`)[0].id;
 wp=(await ok(worker.rpc('rpc_get_worker_profile_for_edit',{}))).id;
 const geo=await ok(worker.rpc('rpc_get_worker_location',{}));await ok(worker.rpc('rpc_save_worker_location',{
 p_expected_revision:geo.revision,p_confirmed:true,p_value:{operatingCountryCode:'RS',city:'Novi Sad',radiusKm:50,approximatePosition:{latitude:45.25,longitude:19.84}}}));
 const email=`agreement-outsider-${randomUUID()}@proof.invalid`,password=randomUUID()+'Aa8!';
 await ok(service.auth.admin.createUser({email,password,email_confirm:true}));await ok(outsider.auth.signInWithPassword({email,password}));
 // Existing submit and selection must consume the new authoritative capacity.
 let capacity=await ok(worker.rpc('rpc_get_worker_capacity',{}));
 await ok(worker.rpc('rpc_save_worker_capacity',{p_expected_revision:capacity.revision,p_team_capacity:3}));
 const teamNeed=randomUUID();
 sql(`begin;select set_config('uskoci.need_lifecycle','PUBLISH',true);
 insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
 approximate_city,approximate_area,mode,required_slots,schedule_kind,response_deadline,published_at)
 values(${q(teamNeed)}::uuid,${q(requesterId)}::uuid,${q(rp)}::uuid,'PUBLISHED','PRE-V3 team','Disposable SQL fixture',
 'PROOF','Novi Sad','Liman','OFFERS',4,'FLEXIBLE',statement_timestamp()+interval '2 days',statement_timestamp());commit;`);
 const teamCommand={p_need_id:teamNeed,p_need_revision:1,p_worker_profile_id:wp,p_covered_slots:4,p_price_rsd:3000,
 p_proposed_start_at:null,p_proposed_end_at:null,p_scope_note:null,p_client_request_id:randomUUID()};
 await denied(worker.rpc('rpc_submit_response',teamCommand),'TEAM_CAPACITY_EXCEEDED');
 const teamApp=await ok(worker.rpc('rpc_submit_response',{...teamCommand,p_covered_slots:3,p_client_request_id:randomUUID()}));
 capacity=await ok(worker.rpc('rpc_get_worker_capacity',{}));await ok(worker.rpc('rpc_save_worker_capacity',{p_expected_revision:capacity.revision,p_team_capacity:1}));
 const teamSelect={p_need_id:teamNeed,p_need_revision:teamApp.needRevision,p_response_id:teamApp.responseId,
 p_response_version:teamApp.version,p_content_hash:teamApp.contentHash,p_client_request_id:randomUUID()};
 await denied(requester.rpc('rpc_select_response',teamSelect),'TEAM_CAPACITY_EXCEEDED');
 capacity=await ok(worker.rpc('rpc_get_worker_capacity',{}));await ok(worker.rpc('rpc_save_worker_capacity',{p_expected_revision:capacity.revision,p_team_capacity:3}));
 const teamAgreement=await ok(requester.rpc('rpc_select_response',teamSelect));
 assert.equal(Number(sql(`select (terms->>'covered_slots')::integer from public.agreement_versions where agreement_id=${q(teamAgreement)}::uuid and version=1`)),3);
 pass('CAPACITY_SUBMIT_AND_SELECTION_REVALIDATE_SAME_PROFILE_AFTER_REDUCTION');
 const a=await agreement('validation');let workspace=await read(a);
 assert.equal(workspace.actionState.authoritative,true);assert.equal(workspace.actionState.accountId,requesterId);
 assert.equal(workspace.actionState.canConfirmCompletion,true);assert.equal(workspace.actionState.canMarkWorkDone,false);
 const workerCaps=(await ok(worker.rpc('rpc_get_agreement_workspace',{p_agreement_id:a}))).actionState;assert.equal(workerCaps.canMarkWorkDone,true);
 await denied(outsider.rpc('rpc_get_agreement_workspace',{p_agreement_id:a}));
 pass('EXACT_M05_PROVENANCE_ACTUAL_SELECTION_AND_PARTICIPANT_CAPABILITIES');
 const bad=[{price_rsd:0},{price_rsd:-1},{price_rsd:2147483648},{price_rsd:1e100},{price_rsd:2.5},{price_rsd:'3'},
 {price_rsd:null},{price_rsd:[]},{price_rsd:{}},{price_rsd:true},{currency:'EUR'},{currency:null},{currency:17},
 {covered_slots:2},{worker_account_id:requesterId},{scope_note:[]},{scope_note:null},{scope_note:'x'.repeat(4001)},
 {proposed_start_at:'2030-01-01T10:00:00Z'},{proposed_start_at:'bad',proposed_end_at:'bad'},
 {proposed_start_at:1,proposed_end_at:2},{proposed_start_at:'2030-01-01T12:00:00Z',proposed_end_at:'2030-01-01T11:00:00Z'},
 {proposed_start_at:null,proposed_end_at:'2030-01-01T11:00:00Z'}];
 for(const patch of bad)await denied(propose(a,1,patch));
 await denied(requester.rpc('rpc_propose_agreement_change_v2',{p_agreement_id:a,p_expected_version:1,p_patch:{price_rsd:4000},p_reason:'x'.repeat(4001),p_client_request_id:randomUUID()}),'CHANGE_INPUT_TOO_LARGE');
 await denied(propose(a,1,undefined,requester,'x'.repeat(201)),'CHANGE_INPUT_TOO_LARGE');
 assert.equal(countProposals(a),0);assert.equal(state(a).current_version,1);
 pass('HOSTILE_TYPES_PRICE_CURRENCY_ALLOCATION_NOTES_AND_PAIRED_DATES_NO_MUTATION');
 const key=randomUUID();const pair=await Promise.all([ok(propose(a,1,undefined,requester,key)),ok(propose(a,1,undefined,requester,key))]);
 assert.equal(pair[0],pair[1]);assert.equal(countProposals(a),1);
 workspace=await read(a);assert.equal(workspace.actionState.pendingChanges.length,1);assert.equal(workspace.actionState.canConfirmCompletion,false);
 assert.equal(workspace.actionState.canWithdrawChange,true);assert.equal(workspace.actionState.canProposeChange,false);
 await denied(worker.rpc('rpc_mark_work_done',{p_agreement_id:a}),'AGREEMENT_CHANGE_PENDING');
 await denied(requester.rpc('rpc_confirm_completion',{p_agreement_id:a}),'AGREEMENT_CHANGE_PENDING');
 await denied(propose(a,1,{price_rsd:4500}),'AGREEMENT_CHANGE_PENDING');
 await denied(withdraw(pair[0],worker));await ok(withdraw(pair[0]));assert.equal((await ok(withdraw(pair[0]))).idempotentReplay,true);
 assert.equal((await read(a)).actionState.canConfirmCompletion,true);
 pass('ONE_PENDING_COMMAND_REPLAY_BLOCKS_COMPLETION_PROPOSER_CAN_WITHDRAW');
 const p=await ok(propose(a,1));const accepted=await ok(respond(p));assert.equal(accepted.agreementVersion,2);
 assert.equal((await ok(respond(p))).agreementVersion,2);assert.equal(state(a).agreement_version,2);
 const deadline=await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:a}));assert.equal(await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:a})),deadline);
 await denied(propose(a,2),'AGREEMENT_CHANGE_AFTER_WORK_DONE');await denied(respond(p),'AGREEMENT_CHANGE_AFTER_WORK_DONE');
 assert.equal((await read(a)).actionState.canProposeChange,false);
 const completed=await Promise.all([ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:a})),ok(requester.rpc('rpc_confirm_completion',{p_agreement_id:a}))]);
 assert.equal(completed[0].completedAt,completed[1].completedAt);assert.equal(state(a).status,'COMPLETED');
 pass('ACCEPTED_VERSION_DONE_FREEZE_DEADLINE_REPLAY_AND_COMPLETION_IDEMPOTENCY');
 const start='2030-03-04T10:00:00Z',end='2030-03-04T11:00:00Z';
 const cal1=await agreement('calendar1',start,end),cal2=await agreement('calendar2','2030-03-04T13:00:00Z','2030-03-04T14:00:00Z');
 const cp=await ok(propose(cal2,1,{proposed_start_at:start,proposed_end_at:end}));
 await denied(respond(cp),'WORKER_CALENDAR_CONFLICT');assert.equal(state(cal2).current_version,1);await ok(respond(cp,false));
 assert.equal(sql(`select starts_at='2030-03-04T13:00:00Z'::timestamptz from private.worker_calendar_events where agreement_id=${q(cal2)}::uuid`),'t');
 pass('ACCEPT_REVALIDATES_REAL_CALENDAR_WITH_FULL_ROLLBACK');
 const raceA=await agreement('propose-done');
 const r=await Promise.all([propose(raceA,1),worker.rpc('rpc_mark_work_done',{p_agreement_id:raceA})]);
 assert.equal(r.filter(x=>!x.error).length,1);if(r[0].data)await ok(withdraw(r[0].data));
 assert.ok(!(state(raceA).state==='AWAITING_REQUESTER'&&Number(sql(`select count(*) from public.agreement_change_proposals where agreement_id=${q(raceA)}::uuid and status='PENDING'`))>0));
 const raceB=await agreement('accept-done');const rbp=await ok(propose(raceB,1));
 const rb=await Promise.all([respond(rbp),worker.rpc('rpc_mark_work_done',{p_agreement_id:raceB})]);assert.ok(rb.some(x=>!x.error));
 const bs=state(raceB);assert.equal(bs.current_version,bs.agreement_version);
 const raceC=await agreement('cancel-accept');const rcp=await ok(propose(raceC,1));
 await Promise.all([respond(rcp),requester.rpc('rpc_cancel_agreement',{p_agreement_id:raceC,p_reason:'Controlled cancellation'})]);
 assert.equal(state(raceC).status,'CANCELLED');assert.equal(state(raceC).state,'CANCELLED');
 await denied(requester.rpc('rpc_confirm_completion',{p_agreement_id:raceC}),'AGREEMENT_CANCELLED');
 pass('PROPOSE_DONE_ACCEPT_DONE_AND_CANCEL_ACCEPT_SERIALIZE_WITHOUT_RESURRECTION');
 const auto=await agreement('auto');await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:auto}));
 assert.equal(await ok(service.rpc('rpc_tick_auto_completion',{})),0);assert.equal(state(auto).state,'AWAITING_REQUESTER');
 sql(`update public.agreement_execution set requester_deadline_at=statement_timestamp()-interval '1 second' where agreement_id=${q(auto)}::uuid`);
 const ar=await Promise.all([service.rpc('rpc_tick_auto_completion',{}),requester.rpc('rpc_confirm_completion',{p_agreement_id:auto})]);ar.forEach(x=>assert.equal(x.error,null));
 const stamp=state(auto).completed_at;assert.equal(state(auto).status,'COMPLETED');await ok(service.rpc('rpc_tick_auto_completion',{}));assert.equal(state(auto).completed_at,stamp);
 await denied(worker.rpc('rpc_tick_auto_completion',{}));
 const problem=await agreement('auto-problem');await ok(worker.rpc('rpc_mark_work_done',{p_agreement_id:problem}));
 await ok(requester.rpc('rpc_report_problem',{p_agreement_id:problem,p_narrative:'Controlled unresolved problem'}));
 sql(`update public.agreement_execution set requester_deadline_at=statement_timestamp()-interval '1 second' where agreement_id=${q(problem)}::uuid`);
 await ok(service.rpc('rpc_tick_auto_completion',{}));assert.equal(state(problem).state,'AWAITING_REQUESTER');
 pass('AUTO_COMPLETION_TIME_BOUNDARY_EXPLICIT_RACE_AND_PROBLEM_SUPPRESSION');
 assert.equal(Number(sql("select count(*) from public.notification_deliveries where title like '%PRIVATE_%' or body like '%PRIVATE_%'")),0);
 assert.equal(sql("select has_function_privilege('anon','public.rpc_withdraw_agreement_change(uuid)','execute')"),'f');
 report.result='PASS';report.historyCount=Number(sql('select count(*) from supabase_migrations.schema_migrations'));assert.equal(report.historyCount,113);
}catch(e){report.result='FAIL';report.failure=String(e.message).slice(0,700);process.exitCode=1;console.error(report.failure);}
finally{writeFileSync(out+'/agreement-core-report.json',JSON.stringify(report,null,2)+'\n');console.log(report.result+' PRE_V3_AGREEMENT_CORE');}
