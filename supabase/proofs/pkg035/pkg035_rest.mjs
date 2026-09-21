// Existing local Auth harness only. Fixtures are discarded with this disposable stack.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as rt from '../pre_v3/closure_runtime.mjs';
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const owner=await rt.actor('pkg035-owner'), other=await rt.actor('pkg035-other');
const n=rt.randomUUID(),rp=rt.randomUUID(),wp=rt.randomUUID(),a=rt.randomUUID(),q=rt.q;
rt.sql("begin;set local session_replication_role=replica;"+
 "insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values("+
 q(rp)+","+q(owner.id)+",'REQUESTER','Proof owner','Novi Sad','ACTIVE','{}',1,false),("+
 q(wp)+","+q(other.id)+",'WORKER','Proof worker','Novi Sad','ACTIVE','{ciscenje}',3,true);"+
 "insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,mode,required_slots,schedule_kind,published_at,revision,response_deadline) values("+
 q(n)+","+q(owner.id)+","+q(rp)+",'PUBLISHED','REST proof','Disposable fixture','PROOF','{}','Novi Sad','OFFERS',3,'FLEXIBLE',now(),1,now()+interval '1 day');"+
 "insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots) values("+
 q(a)+","+q(n)+","+q(other.id)+","+q(wp)+",'OFFER','SUBMITTED',1,1,5000,1);"+
 "insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,content_hash) values("+
 q(a)+",1,1,5000,1,repeat('a',64));commit;notify pgrst,'reload schema';");
const read=client=>rt.ok(client.from('needs').select('id,selectable_application_count,marketplace_responses(id)').eq('id',n).single());
const owned=await read(owner.client),foreign=await read(other.client);
assert.equal(owned.selectable_application_count,1);
assert.equal(owned.marketplace_responses.length,1);
assert.equal(foreign.selectable_application_count,null);
const candidates=await rt.ok(owner.client.rpc('rpc_list_need_candidates',{p_need_id:n}));
assert.equal(candidates.filter(x=>x.canSelect).length,owned.selectable_application_count);
const spoof=await rt.ok(other.client.rpc('selectable_application_count',{n:{id:n,requester_account_id:other.id}}));
assert.equal(spoof,null);
const denied=await rt.make().rpc('selectable_application_count',{n:{id:n}});
assert.ok(denied.error);
const reportPath=process.env.PRE_V3_ARTIFACT_DIR+'/pkg035-report.json';
const report=JSON.parse(readFileSync(reportPath,'utf8'));
report.rest={computedField:true,ownerCount:1,foreignCount:null,spoofedOwnerCount:null,anonymousDenied:true,syntheticLocalAuthOnly:true};
report.checks.push({mode:'rest',name:'REAL_POSTGREST_COMPUTED_FIELD_CANDIDATES_AND_AUTHORITY',result:'PASS'});
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log('PASS REAL_POSTGREST_COMPUTED_FIELD_CANDIDATES_AND_AUTHORITY');
