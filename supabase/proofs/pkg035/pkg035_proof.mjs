// PKG-035: real SQL reads and final selection, on the disposable database only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const db=process.env.DB_URL;
assert.equal(db,'postgresql://postgres:postgres@127.0.0.1:54322/postgres','DISPOSABLE_LOCAL_TARGET_ONLY');
const out=process.env.PRE_V3_ARTIFACT_DIR;assert.ok(out);mkdirSync(out,{recursive:true});
const mode=process.argv[2],name='pkg035a_selectable_application_counts';
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sha=x=>createHash('sha256').update(x).digest('hex');
const sql=text=>{try{return execFileSync('psql',[db,'-X','-q','-v','ON_ERROR_STOP=1','-At'],
 {input:text,encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']}).trim();}
 catch(e){throw Error(String(e.stderr??e.message).slice(-5000));}};
const file=p=>sql(readFileSync(p,'utf8'));
const report=existsSync(out+'/pkg035-report.json')?JSON.parse(readFileSync(out+'/pkg035-report.json','utf8')):
 {package:'PKG-035',sourceSha:process.env.GITHUB_SHA,disposableDbOnly:true,canonicalDevAccess:false,providerCalls:false,deviceTest:false,checks:[]};
const pass=name=>{report.checks.push({mode,name,result:'PASS'});console.log('PASS '+name);};
const save=()=>writeFileSync(out+'/pkg035-report.json',JSON.stringify(report,null,2)+'\n');
const closure=()=>JSON.parse(sql("select jsonb_build_object('live',private.closure_source_digest_v5(),'certified',(select sha256 from private.closure_source_v5 where singleton),'ready',private.retention_ai_source_ready())"));
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const bodyMd5=s=>sql("select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid="+q(s)+"::regprocedure");
if(mode==='replay'){
 const p='supabase/candidates/pkg034a_closure_preparation_blockers.sql';
 assert.equal(sha(readFileSync(p,'utf8').replace(/\n$/,'')),'5272abd67a3d051037cf9bd3662b4d30adeb5b0e823303e432e5672328d95fd1');
 file(p);pass('REPLAY_PKG034_EXACT_DEV_TEXT');
 assert.equal(bodyMd5('public.rpc_list_need_candidates(uuid)'),'0b0d789cd5c4b8adcf0d025d4a5810e7');
 assert.equal(bodyMd5('public.rpc_home_attention()'),'7371d4cddcebead2cb86d8f795d2ee01');
 assert.equal(bodyMd5('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'),'7cbb83905c1c983be4a7d92ff505411e');
 const c=closure();assert.equal(c.ready,true);assert.equal(c.live,c.certified);report.closureBefore=c;
 pass('PREDECESSORS_EQUAL_DEV_AND_CLOSURE_READY');save();process.exit(0);
}
const party=()=>({id:randomUUID(),requester:randomUUID(),worker:randomUUID()});
const insertParty=(p,capacity=3)=>"insert into auth.users(id,email) values("+q(p.id)+","+q(p.id+'@proof.invalid')+");"+
 "insert into public.app_accounts(id,email) values("+q(p.id)+","+q(p.id+'@proof.invalid')+");"+
 "insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status,skills,team_capacity,available_now) values("+
 q(p.requester)+","+q(p.id)+",'REQUESTER','Proof person','Novi Sad','ACTIVE','{}',1,false),("+
 q(p.worker)+","+q(p.id)+",'WORKER','Proof person','Novi Sad','ACTIVE','{ciscenje}',"+capacity+",true);";
const asPerson=id=>"set local role authenticated;set local request.jwt.claim.sub="+q(id)+";set local request.jwt.claim.role='authenticated';set local request.jwt.claims="+q(JSON.stringify({sub:id,role:'authenticated'}))+";";
const catchCall=(key,expr)=>"do $c$ begin insert into pkg035_obs values("+q(key)+",to_jsonb("+expr+"));exception when others then insert into pkg035_obs values("+q(key)+",to_jsonb(sqlerrm));end $c$;";
function scenario(label,c={}){
 const owner=party(),worker=party(),other=party(),n=randomUUID(),a=randomUUID();
 const hash=createHash('sha256').update(a).digest('hex'),status=c.status??'SUBMITTED',slots=c.slots??2,price=c.price??10000;
 const s="statement_timestamp()+interval '2 days'",e="statement_timestamp()+interval '2 days 1 hour'";
 const ps=c.proposed?"statement_timestamp()+interval '3 days'":'null';
 const pe=c.proposed?"statement_timestamp()+interval '3 days 1 hour'":'null';
 const insertResponse=(id,w,st,revision=2)=>"insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,price_rsd,covered_slots,scope_note) values("+
 q(id)+","+q(n)+","+q(w.id)+","+q(w.worker)+",'OFFER',"+q(st)+","+revision+",1,"+price+","+slots+",'Proof scope');"+
 "insert into public.marketplace_response_versions(response_id,version,need_revision,price_rsd,covered_slots,scope_note,content_hash,proposed_start_at,proposed_end_at) values("+
 q(id)+",1,"+revision+","+price+","+slots+",'Proof scope',"+q(id===a?hash:'b'.repeat(64))+","+ps+","+pe+");";
 let fixture=insertParty(owner)+insertParty(worker,c.capacity??3)+insertParty(other)+
 "insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_skills,approximate_city,approximate_area,mode,required_slots,schedule_kind,starts_at,ends_at,published_at,task_timezone,revision,requester_price_rsd,price_basis,response_deadline) values("+
 q(n)+","+q(owner.id)+","+q(owner.requester)+","+q(c.needStatus??'PUBLISHED')+",'PKG-035 fixture','Disposable fixture','PROOF','{}','Novi Sad','Liman',"+q(c.mode??'MY_PRICE')+",3,"+q(c.fixed?'FIXED_WINDOW':'FLEXIBLE')+","+(c.fixed?s:'null')+","+(c.fixed?e:'null')+",now()-interval '1 hour','Europe/Belgrade',2,5000,"+
 (c.basis===null||c.mode==='OFFERS'?'null':q(c.basis??'PER_PERSON'))+",now()+interval '"+(c.expired?'-1':'2')+" hours');"+
 insertResponse(a,worker,status,c.stale?1:2);
 if(c.history)fixture+=insertResponse(randomUUID(),other,'WITHDRAWN');
 if(c.inactive)fixture+="update public.app_profiles set profile_status='PAUSED' where id="+q(worker.worker)+";";
 if(c.tools)fixture+="update public.needs set required_tools='{crane}' where id="+q(n)+";";
 if(c.emptySkills)fixture+="update public.app_profiles set skills='{}' where id="+q(worker.worker)+";";
 if(c.overfill||c.full){
  const previous=randomUUID();fixture+=insertResponse(previous,other,'SELECTED')+
   "insert into public.need_selections(need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,status,response_id,worker_account_id,worker_profile_id) values("+
   q(n)+",2,"+q(owner.id)+",'pkg035-existing',"+(c.full?3:2)+",'SELECTED',"+q(previous)+","+q(other.id)+","+q(other.worker)+");";
 }
 if(c.calendar)fixture+="insert into private.worker_calendar_events(agreement_id,worker_account_id,worker_profile_id,agreement_version,starts_at,ends_at,state,agreement_status) values(gen_random_uuid(),"+
 q(worker.id)+","+q(worker.worker)+",1,"+(c.calendar==='proposal'?ps:s)+","+(c.calendar==='proposal'?pe:e)+",'BLOCKING','CONFIRMED');";
 const computed=mode==='after'?
  catchCall('actionable',"(select public.selectable_application_count(t) from public.needs t where t.id="+q(n)+")"):'';
 const selectCall="public.rpc_select_response("+q(n)+",2,"+q(a)+",1,"+q(hash)+","+q('pkg035-'+randomUUID())+")";
 const result=JSON.parse(sql("begin;set local statement_timeout='60s';create temporary table pkg035_obs(k text primary key,v jsonb) on commit drop;grant all on pkg035_obs to authenticated;set local session_replication_role=replica;"+
 fixture+"set local session_replication_role=origin;"+asPerson(owner.id)+
 catchCall('candidates',"public.rpc_list_need_candidates("+q(n)+")")+
 catchCall('home',"public.rpc_home_attention()")+computed+
 (c.trySelect?catchCall('selection',selectCall):'')+
 "reset role;insert into pkg035_obs values('total',to_jsonb((select count(*) from public.marketplace_responses where need_id="+q(n)+" and status<>'DRAFT')));"+
 (mode==='after'?
 asPerson(other.id)+catchCall('otherComputed',"public.selectable_application_count(jsonb_populate_record(null::public.needs,jsonb_build_object('id',"+q(n)+",'requester_account_id',"+q(other.id)+")))")+
 catchCall('otherCandidates',"public.rpc_list_need_candidates("+q(n)+")")+
 "reset role;set local request.jwt.claim.sub='';set local request.jwt.claims='{}';"+
 catchCall('anonymousComputed',"public.selectable_application_count(jsonb_populate_record(null::public.needs,jsonb_build_object('id',"+q(n)+")))"):'')+
 "reset role;select jsonb_object_agg(k,v) from pkg035_obs;rollback;").split(/\r?\n/).pop());
 assert.ok(Array.isArray(result.candidates),label+': '+JSON.stringify(result));
 result.target=result.candidates.find(x=>x.responseId===a);assert.ok(result.target,label);
 return result;
}
const cases=[
 ['withdrawn',{status:'WITHDRAWN'},0,'WITHDRAWN'],['notSelected',{status:'NOT_SELECTED'},0,'CLOSED'],
 ['expiredApplication',{status:'EXPIRED'},0,'CLOSED'],['selected',{status:'SELECTED'},0,'SELECTED'],
 ['stale',{stale:true},0,'STALE'],['explicitStale',{status:'STALE_REVIEW_REQUIRED'},0,'STALE'],
 ['deadline',{expired:true},0,'CLOSED'],['inactiveTask',{needStatus:'ACTIVE'},0,'CLOSED'],
 ['full',{full:true},0,'FULL'],['overfill',{overfill:true},0,'OVERFILL'],
 ['capacity',{capacity:1},0,'STALE'],['emptySkills',{emptySkills:true},0,'STALE'],['tools',{tools:true},0,'STALE'],
 ['badPrice',{price:5000,trySelect:true},0,'STALE'],['totalPartial',{basis:'TOTAL',price:5000,trySelect:true},0,'STALE'],
 ['proposalBlocked',{fixed:true,proposed:true,calendar:'proposal',trySelect:true},0,'STALE'],
 ['taskBlockedProposalFree',{fixed:true,proposed:true,calendar:'task',trySelect:true},1,'SELECTABLE'],
 ['perPerson',{trySelect:true},1,'SELECTABLE'],['total',{basis:'TOTAL',slots:3,price:5000,trySelect:true},1,'SELECTABLE'],
 ['legacy',{basis:null,price:5000,trySelect:true},1,'SELECTABLE'],['offers',{mode:'OFFERS',price:1234,trySelect:true},1,'SELECTABLE'],
 ['mixedHistory',{history:true},1,'SELECTABLE'],['draftTask',{needStatus:'DRAFT'},0,'CLOSED']
];
if(mode==='before'){
 report.before={};
 for(const [label,c] of cases.filter(([n])=>['withdrawn','badPrice','proposalBlocked','taskBlockedProposalFree'].includes(n))){
  const s=scenario(label,c);report.before[label]=s;
  assert.equal(s.home.counts.attention,1);
  if(label==='withdrawn'){assert.equal(s.target.canSelect,false);assert.equal(s.home.items[0].applicationCount,1);}
  if(label==='badPrice'){assert.equal(s.target.canSelect,true);assert.equal(s.selection,'FIXED_PRICE_MISMATCH');}
  if(label==='proposalBlocked'){assert.equal(s.target.canSelect,true);assert.equal(s.selection,'WORKER_NO_LONGER_ELIGIBLE');}
  if(label==='taskBlockedProposalFree'){assert.equal(s.target.canSelect,false);assert.match(s.selection,/^[a-f0-9-]{36}$/);}
  pass('REPRODUCED_'+label.toUpperCase());
 }
 save();process.exit(0);
}
if(mode==='apply'){
 const before=surface(),c=closure(),p='supabase/candidates/'+name+'.sql',text=readFileSync(p,'utf8');
 report.candidateSha256=sha(text);report.migrationTextSha256=sha(text.replace(/\n$/,''));
 assert.throws(()=>sql(text.replace('0b0d789cd5c4b8adcf0d025d4a5810e7','0'.repeat(32))),/PKG035A_PREDECESSOR_DRIFT/);
 assert.deepEqual(surface(),before);pass('DRIFT_REFUSED_ATOMICALLY');
 assert.throws(()=>sql(text.replace("candidate_state:='STALE';","candidate_state:='CLOSED';")),/PKG035A_BODY_MISMATCH/);
 assert.deepEqual(surface(),before);pass('BODY_TAMPER_REFUSED_ATOMICALLY');
 file(p);pass('CANDIDATE_APPLIES');
 assert.throws(()=>sql(text),/PKG035A_ALREADY_APPLIED/);pass('REPLAY_REFUSED');
 const after=surface(),removed=before.filter(x=>!after.includes(x)),added=after.filter(x=>!before.includes(x));
 const fn=x=>x.split(':')[1].split('(')[0];
 assert.deepEqual(removed.map(fn).sort(),['public.rpc_home_attention','public.rpc_list_need_candidates'].sort());
 assert.deepEqual(added.map(fn).sort(),['public.rpc_home_attention','public.rpc_list_need_candidates','public.selectable_application_count','private.need_candidate_states_v5'].sort());
 report.surfaceRemoved=removed;report.surfaceAdded=added;pass('ONLY_FOUR_READ_FUNCTIONS_CHANGE');
 assert.deepEqual(closure(),c);report.closureAfter=closure();pass('CERTIFICATE_UNCHANGED_READY');
 assert.equal(sql("select has_function_privilege('authenticated','public.selectable_application_count(public.needs)','execute') and not has_function_privilege('anon','public.selectable_application_count(public.needs)','execute') and not has_function_privilege('authenticated','private.need_candidate_states_v5(uuid)','execute')"),'t');
 pass('ACL_OWNER_BOUND_PUBLIC_READER_PRIVATE_CLASSIFIER');save();process.exit(0);
}
if(mode==='after'){
 report.after={};
 for(const [label,c,count,state] of cases){
  const s=scenario(label,c);report.after[label]=s;
  save(); // Keep the failing scenario's observations as evidence, too.
  assert.equal(s.actionable,count,label);assert.equal(s.target.state,state,label);assert.equal(s.target.canSelect,count===1,label);
  assert.equal(s.actionable,s.candidates.filter(x=>x.canSelect).length,label);
  assert.equal(s.home.counts.attention,count?1:0,label);assert.equal(s.home.counts.attentionMore,0,label);
  if(count)assert.equal(s.home.items[0].applicationCount,count,label);
  if(c.trySelect && count)assert.match(s.selection,/^[a-f0-9-]{36}$/);
  if(c.trySelect && !count)assert.ok(['FIXED_PRICE_MISMATCH','TOTAL_PRICE_REQUIRES_ALL_SLOTS','WORKER_NO_LONGER_ELIGIBLE'].includes(s.selection),label+': '+s.selection);
  assert.equal(s.otherComputed,null);assert.equal(s.otherCandidates,'NOT_REQUESTER');assert.equal(s.anonymousComputed,'AUTH_REQUIRED');
  if(c.history)assert.equal(s.total,2);else assert.equal(s.total,c.full||c.overfill?2:1);
  pass('COUNTS_CANDIDATES_SELECTION_AND_OWNERSHIP_'+label.toUpperCase());
 }
 assert.deepEqual(closure(),report.closureAfter);pass('SCENARIOS_ROLL_BACK_CLOSURE_UNCHANGED');
 save();process.exit(0);
}
throw Error('UNKNOWN_MODE '+mode);
