// PKG-037: actual local Auth/REST/SQL and exact Edge handler; synthetic provider only.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import * as rt from '../pre_v3/closure_runtime.mjs';
import {locationCases,syntheticNonlocationFacts} from '../policy/publication_fixtures.mjs';
const {assert,sql,rows,q,ok,denied,randomUUID,service,env}=rt;
assert.equal(env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
assert.equal(env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
const mode=process.argv[2],out=env.PRE_V3_ARTIFACT_DIR;
const reportPath=out+'/pkg037-report.json';
const report=existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):
 {package:'PKG-037',sourceSha:env.GITHUB_SHA,disposableDbOnly:true,canonicalDevAccess:false,providerCalled:false,checks:[]};
const sha=x=>createHash('sha256').update(x).digest('hex');
const save=()=>writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
const pass=name=>{report.checks.push({mode,name,result:'PASS'});save();console.log('PASS '+name);};
const closure=()=>rows("select private.closure_source_digest_v5() live,(select sha256 from private.closure_source_v5 where singleton) certified,private.retention_ai_source_ready() ready")[0];
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const bodyMd5=s=>sql("select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid="+q(s)+'::regprocedure');
const candidate='supabase/candidates/pkg037a_publication_review_expiry.sql';
const sweep=at=>JSON.parse(sql('select private.ai_turn_sweep_v5('+(at??'statement_timestamp()')+')'));
if(mode==='replay'){
 const p='supabase/candidates/pkg035a_selectable_application_counts.sql',body=readFileSync(p,'utf8');
 assert.equal(sha(body.replace(/\n$/,'')),'c0931ffa78e8f5ac7d185343bbadd672675b2c2c08b37181b6af3710f7f781b4');
 sql(body);pass('REPLAY_PKG035_EXACT_DEV_TEXT');
 assert.equal(bodyMd5('private.ai_turn_sweep_v5(timestamptz)'),'3aa616ba34af5dadc798c1765128be96');
 assert.equal(bodyMd5('public.rpc_complete_ai_task_review_evaluation_service(uuid,uuid,uuid,text,text[],text[],text,text,text)'),'d8ace4d564121c88e62009b1f908df76');
 const c=closure();assert.equal(c.live,c.certified);assert.equal(c.ready,true);report.closureBefore=c;
 pass('LIVE_PREDECESSORS_AND_CERTIFICATE_MATCH');save();process.exit(0);
}
if(mode==='apply'){
 const before=surface(),c=closure(),body=readFileSync(candidate,'utf8');
 report.migrationTextSha256=sha(body.replace(/\n$/,''));
 assert.throws(()=>sql(body.replace('3aa616ba34af5dadc798c1765128be96','0'.repeat(32))),/PKG037A_PREDECESSOR_DRIFT/);
 assert.deepEqual(surface(),before);pass('WRONG_PREDECESSOR_REFUSED_ATOMICALLY');
 assert.throws(()=>sql(body.replace('limit 100 for update','limit 101 for update')),/PKG037A_BODY_MISMATCH/);
 assert.deepEqual(surface(),before);pass('TAMPERED_BODY_REFUSED_ATOMICALLY');
 sql(body);assert.throws(()=>sql(body),/PKG037A_ALREADY_APPLIED/);pass('APPLY_ONCE_ONLY');
 const after=surface(),removed=before.filter(x=>!after.includes(x)),added=after.filter(x=>!before.includes(x));
 assert.equal(removed.length,1);assert.equal(added.length,1);
 assert.ok(removed[0].includes('private.ai_turn_sweep_v5('));assert.ok(added[0].includes('private.ai_turn_sweep_v5('));
 report.surfaceRemoved=removed;report.surfaceAdded=added;pass('ONLY_SWEEP_FUNCTION_CHANGED');
 assert.deepEqual(closure(),c);report.closureAfter=closure();pass('CERTIFICATE_UNCHANGED_READY');
 assert.equal(sql("select not has_function_privilege('authenticated','private.ai_turn_sweep_v5(timestamptz)','execute') and not has_function_privilege('anon','private.ai_turn_sweep_v5(timestamptz)','execute')"),'t');
 pass('NO_CLIENT_SWEEP_AUTHORITY');save();process.exit(0);
}
assert.ok(['before','after'].includes(mode));
const person=await rt.actor('pkg037-'+mode),other=await rt.actor('pkg037-other-'+mode);
sql("begin;set local session_replication_role=replica;update public.app_profiles set profile_status='ACTIVE',display_name='Proof person',city='Novi Sad',skills='{ciscenje}',team_capacity=1 where account_id="+q(person.id)+';commit;');
const read=rid=>ok(person.client.rpc('rpc_read_ai_task_review',{p_review_id:rid}));
async function acceptedReview(){
 const cid=await ok(person.client.rpc('rpc_ai_open_need_conversation_v2'));
 const key=randomUUID(),message='Disposable PKG-037 review fixture';
 const t=await ok(service.rpc('rpc_ai_claim_need_turn_v2_service',{p_account_id:person.id,p_conversation_id:cid,p_client_request_id:key,p_user_message:message}));
 await ok(service.rpc('rpc_ai_complete_need_turn_v2_service',{p_account_id:person.id,p_conversation_id:cid,p_client_request_id:key,
  p_attempt_id:t.claim.attemptId,p_user_message:message,p_assistant_message:'Disposable review is ready.',p_safety:'ALLOW',
  p_proposals:syntheticNonlocationFacts.map(([key,value])=>({key,value,displayValue:String(value),evidence:'Disposable synthetic input',confidence:1}))}));
 const location=await ok(person.client.rpc('rpc_get_need_location_review',{p_conversation_id:cid}));
 const review=await ok(person.client.rpc('rpc_prepare_ai_task_review',{p_conversation_id:cid,p_response_deadline:null,
  p_location:{expectedRevision:location.revision,value:locationCases.find(x=>x.id==='remote-exempt').value}}));
 assert.equal(review.canAccept,true);
 const command=await ok(person.client.rpc('rpc_accept_ai_task_review',{p_review_id:review.reviewId,p_displayed_content_digest:review.displayedContentDigest,p_client_request_id:randomUUID()}));
 const ctx=await ok(person.client.rpc('rpc_get_need_publication_context',{p_need_id:command.needId,p_expected_revision:command.needRevision}));
 assert.equal(ctx.kind,'READY');return{review,command,ctx};
}
const claim=x=>ok(service.rpc('rpc_claim_ai_task_review_evaluation_service',{p_account_id:person.id,p_review_id:x.review.reviewId,p_need_id:x.command.needId,p_need_revision:x.command.needRevision,p_binding:x.ctx.binding}));
const expire=x=>sql('update private.ai_task_review_commands set lease_expires_at=clock_timestamp()-interval \'1 second\' where review_id='+q(x.review.reviewId));
const x=await acceptedReview(),ownedClaim=await claim(x);assert.equal(ownedClaim.acquired,true);expire(x);
assert.equal((await read(x.review.reviewId)).command.state,'UNKNOWN_OUTCOME');
const expiredBefore=Number(sql("select count(*) from private.ai_task_review_commands where state='EVALUATING' and lease_expires_at<=clock_timestamp()"));
const recovered=sweep(),after=(await read(x.review.reviewId)).command;
if(mode==='before'){
 assert.equal(after.state,'UNKNOWN_OUTCOME');assert.equal(after.evaluation,null);
 assert.equal((await claim(x)).acquired,false);pass('EXPIRED_REVIEW_STAYS_UNRESOLVED_BEFORE_FIX');save();process.exit(0);
}
assert.equal(after.state,'EVALUATED');assert.equal(after.evaluation.kind,'NOT_READY');assert.equal(after.evaluation.code,'EVALUATOR_UNAVAILABLE');
assert.ok(expiredBefore>=1);assert.equal(recovered.reviewEvaluationsStopped,expiredBefore);assert.equal(after.clientRequestId,x.command.clientRequestId);
assert.equal(sql('select attempt_id from private.ai_task_review_commands where review_id='+q(x.review.reviewId)),ownedClaim.attemptId);
assert.equal(sql('select status from public.needs where id='+q(x.command.needId)),'DRAFT');
assert.equal((await claim(x)).acquired,false);assert.equal(sweep().reviewEvaluationsStopped,0);
await denied(person.client.rpc('rpc_publish_accepted_ai_task_review',{p_review_id:x.review.reviewId,p_client_request_id:x.command.clientRequestId}),'PUBLICATION_DECISION_NOT_ALLOW');
await denied(other.client.rpc('rpc_read_ai_task_review',{p_review_id:x.review.reviewId}),'TASK_REVIEW_NOT_FOUND');
pass('EXPIRED_CLAIM_TERMINAL_SAME_ID_NO_RECLAIM_NO_PUBLISH_FOREIGN_DENIED');
const active=await acceptedReview();await claim(active);
sql("update private.ai_task_review_commands set lease_expires_at=clock_timestamp()+interval '1 hour' where review_id="+q(active.review.reviewId));
const untouched=await acceptedReview();
assert.equal(sweep("statement_timestamp()+interval '1 day'").reviewEvaluationsStopped,0);
assert.equal((await read(active.review.reviewId)).command.state,'EVALUATING');
assert.equal((await read(untouched.review.reviewId)).command.state,'ACCEPTED');
pass('UNEXPIRED_AND_UNDISPATCHED_REVIEWS_UNCHANGED_EVEN_WITH_FUTURE_CLOCK');

// Real Edge handler + real local Auth/context/claim/complete. Only budget admission
// and provider output are synthetic transport fixtures. No external IO is allowed.
const token=(await ok(person.client.auth.getSession())).session.access_token;
function edgeFixture(kind){
 let handler,providerCalls=0,completions=0,finishProvider;const timers=new Map(),inputHashes={};
 const origin='https://pkg037-disposable.invalid';let policy;
 const result=()=>{const rule=policy.rules.find(r=>r.outcomes.includes('ALLOW'));assert.ok(rule);return{outcome:'ALLOW',ruleIds:[rule.ruleId],safeReasonCodes:[]};};
 const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
 const c=vm.createContext({exports:{},Request,Response,Headers,URL,TextDecoder,TextEncoder,AbortController,ReadableStream,Intl,Date,crypto:webcrypto,btoa,
  setTimeout:(fn,ms)=>{const id={};timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  console:{log:()=>assert.fail('NO_EDGE_LOG'),error:()=>assert.fail('NO_EDGE_LOG'),warn:()=>assert.fail('NO_EDGE_LOG')},
  Deno:{serve:fn=>{handler=fn;},env:{get:k=>({SUPABASE_URL:origin,SUPABASE_ANON_KEY:env.RU5_DEVICE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,GEMINI_API_KEY:'SYNTHETIC_NEVER_SENT',GEMINI_MODEL:'gemini-3.8-flash',
   AI_PROVIDER:'gemini',USKOCI_GEMINI_PAID_TEST_ENABLED:'true',USKOCI_GEMINI_IMAGE_REVIEW_ENABLED:'true'})[k]}},
  fetch:async(url,init={})=>{
   const u=new URL(url);assert.equal(init.redirect,'error');
   if(u.origin===origin){
    const paths=['/auth/v1/user','/rest/v1/rpc/rpc_get_need_publication_context','/rest/v1/rpc/rpc_claim_ai_task_review_evaluation_service','/rest/v1/rpc/rpc_complete_ai_task_review_evaluation_service'];
    if(u.pathname==='/rest/v1/rpc/rpc_ai_test_budget_reserve_service')return json({admitted:true,reservationId:randomUUID(),replay:false,code:'AI_TEST_RESERVED'});
    assert.ok(paths.includes(u.pathname),'NO_UNREGISTERED_BACKEND_CALL');
    if(u.pathname.endsWith('rpc_complete_ai_task_review_evaluation_service'))completions++;
    const response=await fetch(env.RU5_DEVICE_SUPABASE_URL+u.pathname,init);
    if(u.pathname.endsWith('rpc_get_need_publication_context'))policy=(await response.clone().json()).policy;
    if(kind==='lostClaim'&&u.pathname.endsWith('rpc_claim_ai_task_review_evaluation_service'))throw Error('SYNTHETIC_LOST_CLAIM_ACK');
    if(kind==='lostComplete'&&u.pathname.endsWith('rpc_complete_ai_task_review_evaluation_service'))throw Error('SYNTHETIC_LOST_COMPLETION_ACK');
    return response;
   }
   assert.equal(u.origin,'https://generativelanguage.googleapis.com');providerCalls++;
   if(kind==='throw')throw Error('SYNTHETIC_PROVIDER_FAILURE');
   const response=()=>json({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(result())}]}}]});
   if(kind==='timeout')return new Promise(resolve=>{finishProvider=()=>resolve(response());});
   return response();
  }});
 const load=path=>{const bytes=readFileSync(path);assert.deepEqual(bytes,execFileSync('git',['show',env.GITHUB_SHA+':'+path]));inputHashes[path]=sha(bytes);
  const code=ts.transpileModule(bytes.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  assert.deepEqual(code.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error),[]);return code.outputText;};
 const shared=new vm.Script('(function(exports){'+load('supabase/functions/_shared/aiTestBudget.ts')+';return exports;})').runInContext(c)({});
 c.require=name=>{assert.equal(name,'../_shared/aiTestBudget.ts');return shared;};
 new vm.Script(load('supabase/functions/uskoci-publication-evaluate/index.ts')).runInContext(c);
 return{invoke:x=>handler(new Request(origin+'/functions/v1/uskoci-publication-evaluate',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({needId:x.command.needId,expectedRevision:x.command.needRevision,acceptedReviewId:x.review.reviewId})})),
  calls:()=>({provider:providerCalls,completions}),expired:()=>{for(const t of timers.values())if(t.ms===30000)t.fn();},
  ready:()=>!!finishProvider,late:()=>finishProvider?.(),inputHashes};
}
for(const kind of ['throw','timeout','lostClaim','lostComplete']){
 const current=await acceptedReview(),f=edgeFixture(kind),pending=f.invoke(current);
 if(kind==='timeout'){for(let i=0;i<200&&!f.ready();i++)await new Promise(resolve=>setTimeout(resolve,25));assert.equal(f.ready(),true);f.expired();}
 const response=await pending;assert.equal((await response.json()).code,'EVALUATOR_UNAVAILABLE');
 if(kind==='timeout'){f.late();await new Promise(resolve=>setTimeout(resolve,20));}
 let command=(await read(current.review.reviewId)).command;
 if(kind==='lostClaim'){assert.equal(command.state,'EVALUATING');expire(current);sweep();command=(await read(current.review.reviewId)).command;assert.equal(f.calls().provider,0);}
 else assert.equal(f.calls().provider,1);
 assert.equal(command.state,'EVALUATED');
 assert.equal(command.evaluation.kind,kind==='lostComplete'?'DECISION':'NOT_READY');
 assert.equal(f.calls().completions,kind==='lostClaim'?0:1);assert.equal((await claim(current)).acquired,false);
 if(kind==='lostComplete'){
  const original=JSON.stringify(command);expire(current);sweep();assert.equal(JSON.stringify((await read(current.review.reviewId)).command),original);
  await ok(person.client.rpc('rpc_publish_accepted_ai_task_review',{p_review_id:current.review.reviewId,p_client_request_id:current.command.clientRequestId}));
  sweep();assert.equal((await read(current.review.reviewId)).command.state,'PUBLISHED');
 }
 report.edgeInputHashes=f.inputHashes;pass('ACTUAL_EDGE_AUTH_SQL_'+kind.toUpperCase());
}
// Bounded fixture-only batch, discarded with the local stack. No new real task or provider run.
sql("begin;with cloned as (insert into private.ai_task_reviews(id,account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,expires_at) "+
 "select gen_random_uuid(),account_id,conversation_id,requester_profile_id,source_hash,policy_binding,envelope,clock_timestamp()+interval '1 hour' from private.ai_task_reviews cross join generate_series(1,105) where id="+q(x.review.reviewId)+" returning id,account_id) "+
 "insert into private.ai_task_review_commands(review_id,account_id,client_request_id,need_id,need_revision,state,attempt_id,lease_expires_at,evaluation_binding) "+
 "select r.id,r.account_id,gen_random_uuid(),"+q(x.command.needId)+",1,'EVALUATING',gen_random_uuid(),clock_timestamp()-interval '1 second','{}'::jsonb from cloned r;commit;");
assert.equal(sweep().reviewEvaluationsStopped,100);assert.equal(sweep().reviewEvaluationsStopped,5);pass('BOUNDED_BATCH_100_THEN_5');
assert.deepEqual(closure(),report.closureAfter);pass('REAL_SCENARIOS_LEAVE_CLOSURE_READY');
report.limitations=['Budget admission and provider output are synthetic inside the exact Edge VM. Actual local Auth/PostgREST and all review RPCs are used.',
 'Expired lease and batch fixtures exist only on this disposable database. No DEV account, paid provider, deployed gateway or phone verification.'];
save();
