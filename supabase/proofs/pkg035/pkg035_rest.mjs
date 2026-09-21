// Existing local Auth harness only. Fixtures are discarded with this disposable stack.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as rt from '../pre_v3/closure_runtime.mjs';
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const owner=await rt.actor('pkg035-owner'), other=await rt.actor('pkg035-other');
const n=rt.randomUUID(),a=rt.randomUUID(),q=rt.q;
// Auth already created both profiles. Use those identities rather than duplicating them.
const rp=rt.rows("select id from public.app_profiles where account_id="+q(owner.id)+" and kind='REQUESTER'")[0].id;
const wp=rt.rows("select id from public.app_profiles where account_id="+q(other.id)+" and kind='WORKER'")[0].id;
rt.sql("begin;set local session_replication_role=replica;"+
 "update public.app_profiles set display_name='Proof person',city='Novi Sad',profile_status='ACTIVE',skills='{ciscenje}',team_capacity=3,available_now=true where id in ("+q(rp)+","+q(wp)+");"+
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
// Four actionable tasks and five historical-only tasks: show three and +1, not nine and +6.
let extra="begin;set local session_replication_role=replica;";
for(let i=0;i<8;i++){
 const next=rt.randomUUID(),response=rt.randomUUID();
 extra+="insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,mode,required_slots,schedule_kind,published_at,revision,response_deadline) select "+q(next)+",requester_account_id,requester_profile_id,status,'REST overflow',description,category,required_skills,approximate_city,mode,required_slots,schedule_kind,published_at,revision,response_deadline from public.needs where id="+q(n)+";"+
 "insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots) select "+q(response)+","+q(next)+",worker_account_id,worker_profile_id,response_kind,"+q(i<3?'SUBMITTED':'WITHDRAWN')+",submitted_against_need_revision,current_version,price_rsd,covered_slots from public.marketplace_responses where id="+q(a)+";"+
 "insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,content_hash) select "+q(response)+",version,need_revision,price_rsd,covered_slots,content_hash from public.marketplace_response_versions where response_id="+q(a)+";";
}
rt.sql(extra+"commit;");
const home=await rt.ok(owner.client.rpc('rpc_home_attention'));
assert.equal(home.counts.attention,4);assert.equal(home.items.length,3);assert.equal(home.counts.attentionMore,1);
assert.equal(home.counts.ownActiveTasks,9);assert.equal(home.counts.activitiesMore,4);
assert.ok(home.items.every(x=>x.applicationCount===1));
const reportPath=process.env.PRE_V3_ARTIFACT_DIR+'/pkg035-report.json';
const report=JSON.parse(readFileSync(reportPath,'utf8'));
report.rest={computedField:true,ownerCount:1,foreignCount:null,spoofedOwnerCount:null,anonymousDenied:true,syntheticLocalAuthOnly:true};
report.rest.homeCounts=home.counts;
report.checks.push({mode:'rest',name:'REAL_POSTGREST_COMPUTED_FIELD_CANDIDATES_AND_AUTHORITY',result:'PASS'});
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
console.log('PASS REAL_POSTGREST_COMPUTED_FIELD_CANDIDATES_AND_AUTHORITY');
