// Disposable SQL proof. Fixtures are rolled back; no canonical DEV/provider access.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {locationCases} from '../policy/publication_fixtures.mjs';
const db=process.env.DB_URL,out=process.env.PRE_V3_ARTIFACT_DIR,mode=process.argv[2];
assert.equal(db,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');assert.ok(out);mkdirSync(out,{recursive:true});
const q=x=>"'"+String(x).replaceAll("'","''")+"'",sha=x=>createHash('sha256').update(x).digest('hex');
const sql=text=>{try{return execFileSync('psql',[db,'-X','-q','-v','ON_ERROR_STOP=1','-At'],
 {input:text,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim();}
 catch(e){throw Error(String(e.stderr??e.message).slice(-3000));}};
const path=out+'/pkg038-report.json',report=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):
 {package:'PKG-038',sourceSha:process.env.GITHUB_SHA,disposableDbOnly:true,canonicalDevAccess:false,providerCalls:0,checks:[]};
const save=()=>writeFileSync(path,JSON.stringify(report,null,2)+'\n');
const pass=name=>{report.checks.push({mode,name,result:'PASS'});save();console.log('PASS '+name);};
const closure=()=>JSON.parse(sql("select jsonb_build_object('live',private.closure_source_digest_v5(),'certified',(select sha256 from private.closure_source_v5 where singleton),'ready',private.retention_ai_source_ready())"));
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const candidate='supabase/candidates/pkg038a_review_registry_limit.sql';
if(mode==='replay'){
 const text=readFileSync('supabase/candidates/pkg037a_publication_review_expiry.sql','utf8');
 assert.equal(sha(text.replace(/\n$/,'')),'cb4f0c605739dbd87a48775648db18bbaf4b6bab7a5d0b593f921cc6afada472');
 sql(text);pass('REPLAY_PKG037_EXACT_DEV_TEXT');const c=closure();assert.equal(c.live,c.certified);assert.equal(c.ready,true);
 report.closureBefore=c;save();process.exit(0);
}
if(mode==='apply'){
 const before=surface(),c=closure(),body=readFileSync(candidate,'utf8');report.migrationTextSha256=sha(body.replace(/\n$/,''));
 assert.throws(()=>sql(body.replace('e734f889221f69a6e9a25d8f1fb90bbc','0'.repeat(32))),/PKG038A_PREDECESSOR_DRIFT/);
 assert.deepEqual(surface(),before);pass('WRONG_PREDECESSOR_REFUSED');
 assert.throws(()=>sql(body.replace('>(select count(*) from private.need_fact_registry)$b$', '>(select count(*)+1 from private.need_fact_registry)$b$')),/PKG038A_BODY_MISMATCH/);
 assert.deepEqual(surface(),before);pass('TAMPERED_BODY_REFUSED');sql(body);
 assert.throws(()=>sql(body),/PKG038A_ALREADY_APPLIED/);pass('APPLY_ONCE');
 const after=surface(),removed=before.filter(x=>!after.includes(x)),added=after.filter(x=>!before.includes(x));
 assert.equal(removed.length,1);assert.equal(added.length,1);assert.match(added[0],/public.rpc_prepare_ai_task_review/);
 report.surfaceRemoved=removed;report.surfaceAdded=added;pass('ONLY_REVIEW_FUNCTION_CHANGED');
 assert.deepEqual(closure(),c);report.closureAfter=closure();pass('CERTIFICATE_UNCHANGED_READY');save();process.exit(0);
}
assert.ok(['before','after'].includes(mode));
function fullReview({foreign=false,unknown=false}={}){
 const account=randomUUID(),profile=randomUUID(),conversation=randomUUID();
 const location=structuredClone(locationCases.find(c=>c.id==='stationary-zero-valid').value);
 location.exactAddress='Synthetic proof address';location.accessNotes='Synthetic proof access';
 location.resolvedLocation.binding.exactAddress=location.exactAddress;
 const values={
  'need.title':'Full registry disposable task','need.description':'Synthetic proof task','need.category':'PROOF',
  'need.price_mode':'MY_PRICE','need.price_rsd':5000,'need.price_basis':'TOTAL','need.schedule_kind':'FIXED_WINDOW',
  'need.starts_at':'2099-01-01T10:00:00+01:00','need.ends_at':'2099-01-01T12:00:00+01:00','need.people_needed':1,
  'need.required_skills':['proof'],'need.required_tools':[],'need.required_vehicles':[],'need.required_licenses':[],
  'need.minimum_experience_years':0,'need.verified_identity_required':false,'need.task_country_code':'RS',
  'need.task_geography':location.geography,'need.critical_conditions':[],'need.public_photo_paths':[],
  'need.exact_address':location.exactAddress,'need.access_notes':location.accessNotes,'need.resolved_location':location.resolvedLocation,
 };
 assert.equal(Object.keys(values).length,23);
 let setup="begin;set local session_replication_role=replica;"+
  "insert into auth.users(id,email) values("+q(account)+","+q(account+'@proof.invalid')+");"+
  "insert into public.app_accounts(id,email) values("+q(account)+","+q(account+'@proof.invalid')+");"+
  "insert into public.app_profiles(id,account_id,kind,display_name,city,profile_status) values("+q(profile)+","+q(account)+",'REQUESTER','Proof person','Novi Sad','ACTIVE');"+
  "insert into public.ai_conversations(id,account_id,purpose,status,fact_schema_version) values("+q(conversation)+","+q(account)+",'NEED_INTAKE','OPEN','NEED_FACT_V2');"+
  "insert into public.ai_messages(account_id,conversation_id,role,body,safety) values("+q(account)+","+q(conversation)+",'ASSISTANT','Synthetic proof','ALLOW');";
 for(const [key,value] of Object.entries(values))setup+=
  "insert into public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value,status,source,scope,evidence_excerpt,fact_schema_version,value_type,display_value) "+
  "select "+q(account)+","+q(conversation)+",fact_key,"+q(JSON.stringify(value))+"::jsonb,'NEEDS_CONFIRMATION','EXPLICIT_USER_ANSWER','NEED_DRAFT','Synthetic proof','NEED_FACT_V2',value_type,'Synthetic value' from private.need_fact_registry where fact_key="+q(key)+";";
 if(unknown)setup+="insert into public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value,status,source,scope,fact_schema_version,value_type,display_value) values("+
  q(account)+","+q(conversation)+",'unknown.proof','1','NEEDS_CONFIRMATION','EXPLICIT_USER_ANSWER','NEED_DRAFT','NEED_FACT_V2','INTEGER','1');";
 setup+="set local session_replication_role=origin;set local role authenticated;set local request.jwt.claim.sub="+q(foreign?randomUUID():account)+";";
 return sql(setup+"with r as(select public.rpc_prepare_ai_task_review("+q(conversation)+",null,null) doc) select jsonb_build_object('count',jsonb_array_length(doc->'publicProjection')+jsonb_array_length(doc->'ownerPrivateProjection'),'canAccept',doc->'canAccept','missing',doc->'missingRequired') from r;rollback;");
}
if(mode==='before'){assert.throws(()=>fullReview(),/TASK_REVIEW_INPUT_INVALID/);pass('FULL23_REGISTRY_REFUSED_BEFORE');}
else{
 const full=JSON.parse(fullReview());assert.equal(full.count,23);assert.deepEqual(full.missing,[]);assert.equal(full.canAccept,true);
 pass('FULL23_REAL_REVIEW_ACCEPTABLE_AFTER');
 assert.throws(()=>fullReview({foreign:true}),/TASK_REVIEW_NOT_FOUND/);pass('FOREIGN_OWNER_REFUSED');
 assert.throws(()=>fullReview({unknown:true}),/TASK_REVIEW_INPUT_INVALID/);pass('REGISTRY_OVERFLOW_STILL_REFUSED');
 assert.deepEqual(closure(),report.closureAfter);pass('SCENARIOS_LEAVE_CERTIFICATE_READY');
}
save();
