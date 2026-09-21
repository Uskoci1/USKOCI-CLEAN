// PKG-034: prepare/review hard-blocker parity. Disposable only; all account fixtures roll back.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
const db=process.env.DB_URL;
assert.equal(db,'postgresql://postgres:postgres@127.0.0.1:54322/postgres','DISPOSABLE_LOCAL_TARGET_ONLY');
const out=process.env.PRE_V3_ARTIFACT_DIR;assert.ok(out);mkdirSync(out,{recursive:true});
const mode=process.argv[2],name='pkg034a_closure_preparation_blockers',pin='e4bb4c0d3a7d1ebc682c28a01b605cd4';
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sha=x=>createHash('sha256').update(x).digest('hex');
const sql=text=>execFileSync('psql',[db,'-X','-q','-v','ON_ERROR_STOP=1','-At'],
 {input:text,encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const file=p=>sql(readFileSync(p,'utf8'));
const report=existsSync(out+'/pkg034-report.json')?JSON.parse(readFileSync(out+'/pkg034-report.json','utf8')):
 {package:'PKG-034',sourceSha:process.env.GITHUB_SHA,disposableDbOnly:true,canonicalDevAccess:false,providerCalls:false,deviceTest:false,checks:[]};
const pass=name=>{report.checks.push({mode,name,result:'PASS'});console.log('PASS '+name);};
const save=()=>writeFileSync(out+'/pkg034-report.json',JSON.stringify(report,null,2)+'\n');
const closure=()=>JSON.parse(sql("select jsonb_build_object('live',private.closure_source_digest_v5(),'certified',(select sha256 from private.closure_source_v5 where singleton),'ready',private.retention_ai_source_ready())"));
const surface=()=>sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql','utf8')).split('\n').filter(Boolean);
const bodyMd5=s=>sql("select md5(replace(prosrc,E'\\r\\n',E'\\n')) from pg_proc where oid="+q(s)+"::regprocedure");
const LEGACY=['ACTIVE_AGREEMENT','OPEN_TASK','ACTIVE_APPLICATION','PENDING_WORKFLOW','RETENTION_HOLD'];
if(mode==='replay'){
 const p='supabase/candidates/pkg033a_application_admission_parity.sql';
 assert.equal(sha(readFileSync(p,'utf8').replace(/\n$/,'')),'ce97b71655fe18168119c8776d108251205d3b7cbcf0a06cd87c9351f0f1b181');
 file(p);pass('REPLAY_PKG033_EXACT_DEV_TEXT');
 assert.equal(bodyMd5('private.account_closure_preparation(uuid)'),pin);
 assert.equal(bodyMd5('private.closure_erasure_hard_blockers_v5(uuid)'),'f88717dbf53fd88a5b9d13b5b19f47d2');
 assert.equal(bodyMd5('private.closure_blockers_v5(uuid)'),'dc78d910fde458c18e25c732888fa93a');
 pass('PREPARATION_AND_BOTH_BLOCKER_AUTHORITIES_MATCH_DEV');
 const c=closure();assert.equal(c.ready,true);assert.equal(c.live,c.certified);report.closureBefore=c;
 pass('REPLAY_CERTIFIED_AND_READY');save();process.exit(0);
}
const fixtures={
 worker:a=>"insert into private.worker_ai_turns(account_id,conversation_id,client_request_id,body_hash,source_revision,state,lease_expires_at) values("+q(a)+",gen_random_uuid(),gen_random_uuid(),repeat('a',64),1,'PROCESSING',now()+interval '5 minutes');",
 qa:a=>"insert into private.qa_ai_commands(account_id,client_request_id,command_type,need_id,need_revision,text_sha256,request_hash,state) values("+q(a)+",gen_random_uuid(),'ASK',gen_random_uuid(),1,repeat('b',64),repeat('c',64),'PROCESSING');",
 intake:a=>"insert into private.ai_need_turn_commands(account_id,client_request_id,conversation_id,request_hash,state,context_hash,attempt_id,lease_expires_at) values("+q(a)+",gen_random_uuid(),gen_random_uuid(),repeat('a',64),'PROCESSING',repeat('b',64),gen_random_uuid(),now()+interval '5 minutes');",
 wholeHold:a=>"insert into private.retention_holds(account_id,hold_key,active,revision) values("+q(a)+",'pkg034-whole-hold',true,1);",
 scopedHold:a=>"insert into private.retention_holds(account_id,hold_key,conversation_id,active,revision) values("+q(a)+",'pkg034-scoped-hold',gen_random_uuid(),true,1);",
 media:a=>"insert into private.owned_media_assets(account_id,scope,profile_id,client_request_id,input_sha256,input_bytes,input_type,dispatch_state) values("+q(a)+",'AVATAR',gen_random_uuid(),gen_random_uuid(),repeat('a',64),123,'image/jpeg','DISPATCHING');",
 photo:a=>{const id=randomUUID();return "insert into private.agreement_photo_uploads_v5(id,account_id,agreement_id,agreement_version,client_request_id,state,input_sha256,input_bytes,input_type,admitted_at,sanitized_sha256,storage_path,width,height,byte_size,dispatch_state) values("+q(id)+","+q(a)+",gen_random_uuid(),1,gen_random_uuid(),'PROCESSING',repeat('a',64),123,'image/jpeg',now(),repeat('b',64),"+q(a+'/agreement-v5/'+id+'/')+"||repeat('b',64)||'.jpg',1,1,123,'DISPATCHING');";}
};
const catches=(key,expr)=>"do $c$ begin insert into pkg034_obs values("+q(key)+",to_jsonb("+expr+")); exception when others then insert into pkg034_obs values("+q(key)+",to_jsonb(sqlerrm));end $c$;";
function scenario(label,kinds,{foreign=false}={}){
 const a=randomUUID(),other=randomUUID(),session=randomUUID(),key=randomUUID();
 const claims=JSON.stringify({sub:a,role:'authenticated',session_id:session});
 const start=q(a)+",(select (v->>'requestId')::uuid from pkg034_obs where k='review'),"+
 "(select (v->>'revision')::integer from pkg034_obs where k='review'),"+q(randomUUID())+
 ",(select v->>'policySha256' from pkg034_obs where k='review')";
 const result=JSON.parse(sql([
  "begin;set local statement_timeout='60s';",
  "create temporary table pkg034_obs(k text primary key,v jsonb) on commit drop;grant all on pkg034_obs to authenticated;",
  "set local session_replication_role=replica;",
  "insert into auth.users(id,email) values("+q(a)+","+q(a+'@proof.invalid')+"),("+q(other)+","+q(other+'@proof.invalid')+");",
  "insert into auth.sessions(id,user_id) values("+q(session)+","+q(a)+");",
  "insert into public.app_accounts(id,email) values("+q(a)+","+q(a+'@proof.invalid')+"),("+q(other)+","+q(other+'@proof.invalid')+");",
  ...kinds.map(k=>fixtures[k](foreign?other:a)),
  "set local session_replication_role=origin;",
  "set local role authenticated;set local request.jwt.claim.sub="+q(a)+";set local request.jwt.claim.role='authenticated';set local request.jwt.claims="+q(claims)+";",
  catches('prepare',"public.rpc_prepare_account_closure("+q(a)+",0,"+q(key)+")"),
  catches('replay',"public.rpc_prepare_account_closure("+q(a)+",0,"+q(key)+")"),
  catches('reused',"public.rpc_prepare_account_closure("+q(a)+",1,"+q(key)+")"),
  catches('otherAccount',"public.rpc_prepare_account_closure("+q(other)+",0,gen_random_uuid())"),
  catches('review',"public.rpc_review_account_closure_execution("+q(a)+")"),
  "do $b$ begin if jsonb_array_length((select v->'blockers' from pkg034_obs where k='review'))>0 then begin perform public.rpc_start_account_closure_execution("+start+");raise exception 'UNEXPECTED_START';exception when others then insert into pkg034_obs values('blockedStart',to_jsonb(sqlerrm));end;end if;end $b$;",
  "reset role;",
  "insert into pkg034_obs values('hardBlockers',to_jsonb(private.closure_erasure_hard_blockers_v5("+q(a)+")));",
  "insert into pkg034_obs values('accountsStillPresent',to_jsonb((select count(*)=2 from public.app_accounts where id in("+q(a)+","+q(other)+"))));",
  "select jsonb_object_agg(k,v) from pkg034_obs;rollback;"
 ].join('\n')).split(/\r?\n/).pop());
 assert.equal(typeof result.prepare,'object',label+': '+JSON.stringify(result));
 assert.equal(typeof result.review,'object',label+': '+JSON.stringify(result));
 assert.equal(result.accountsStillPresent,true);return result;
}
const cases=[
 ['idle',[]],['worker',['worker']],['qa',['qa']],['intake',['intake']],['wholeHold',['wholeHold']],
 ['scopedHold',['scopedHold']],['media',['media']],['photo',['photo']],
 ['combined',['worker','qa','media','photo']],['scopedPlusWorker',['scopedHold','worker']],
 ['otherAccount',['worker','qa','wholeHold'],{foreign:true}],
];
if(mode==='before'){
 report.before={};
 for(const [label,kinds] of cases.filter(([label])=>['worker','qa','scopedHold','media','photo'].includes(label))){
  const s=scenario(label,kinds);report.before[label]=s;
  assert.notEqual(s.prepare.preparation.blockers.length>0,s.hardBlockers.length>0,label);
  pass('BEFORE_PREPARATION_DISAGREES_'+label.toUpperCase());
 }
 save();process.exit(0);
}
if(mode==='apply'){
 const before=surface(),c=closure(),path='supabase/candidates/'+name+'.sql',text=readFileSync(path,'utf8');
 report.candidateSha256=sha(text);report.migrationTextSha256=sha(text.replace(/\n$/,''));
 const refuse=input=>{let error;try{sql(input);}catch(e){error=e;}
 assert.ok(error);assert.match(String(error.stderr),/PKG034A_PREDECESSOR_DRIFT/);};
 refuse(text.replace(pin,'0'.repeat(32)));
 assert.deepEqual(surface(),before);assert.deepEqual(closure(),c);pass('TAMPERED_PIN_REFUSED_WITHOUT_CHANGE');
 file(path);pass('CANDIDATE_APPLIES');
 refuse(text);pass('SECOND_APPLICATION_REFUSED');
 const after=surface(),removed=before.filter(x=>!after.includes(x)),added=after.filter(x=>!before.includes(x));
 for(const list of [removed,added]){assert.equal(list.length,1);assert.match(list[0],/^function:private\.account_closure_preparation\(/);}
 report.surfaceRemoved=removed;report.surfaceAdded=added;pass('ONLY_PREPARATION_BODY_CHANGES');
 assert.deepEqual(closure(),c);report.closureAfter=closure();pass('CERTIFICATE_UNCHANGED_AND_READY');
 save();process.exit(0);
}
if(mode==='after'){
 report.after={};
 for(const [label,kinds,options] of cases){
  const s=scenario(label,kinds,options);report.after[label]=s;
  const projected=[...new Set(s.hardBlockers.map(x=>LEGACY.includes(x)?x:'PENDING_WORKFLOW'))];
  assert.deepEqual(s.prepare.preparation.blockers,projected,label);
  assert.deepEqual(s.review.blockers,s.hardBlockers,label);
  assert.equal(s.prepare.state,s.hardBlockers.length?'BLOCKED':'NOT_READY');
  assert.equal(s.review.ready,s.hardBlockers.length===0,label);
  if(s.hardBlockers.length)assert.equal(s.blockedStart,'CLOSURE_BLOCKED',label);
  assert.equal(s.prepare.restricted,false);assert.equal(s.prepare.canExecute,false);
  const p=s.prepare.preparation;
  assert.equal(p.executionReady,false);assert.equal(p.authClosureReady,false);assert.equal(p.mediaCleanupReady,false);
  assert.ok(p.notReadyReasons.includes('CLOSURE_EXECUTION_NOT_READY'));assert.equal(new Set(p.blockers).size,p.blockers.length);
  assert.equal(s.replay.idempotentReplay,true);
  assert.deepEqual(s.replay,{...s.prepare,idempotentReplay:true});
  assert.equal(s.reused,'REQUEST_ID_REUSED');assert.equal(s.otherAccount,'AUTH_CONTEXT_CHANGED');
  pass('PREPARE_REVIEW_PARITY_LEGACY_COMPATIBILITY_REPLAY_AND_OWNERSHIP_'+label.toUpperCase());
 }
 const c=closure();assert.deepEqual(c,report.closureAfter);pass('SCENARIOS_LEAVE_CERTIFICATE_UNCHANGED');
 save();process.exit(0);
}
throw Error('UNKNOWN_MODE '+mode);
