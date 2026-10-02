// Run from repository root, only after the existing post-B24/post-Voice disposable replay.
// No real Expo fetch exists: handler requests are either mapped to loopback RPCs or intercepted.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {snapshot,installWithCertificate,revertWithCertificate,EXTRA} from './certificate-proof.mjs';
import {loadCandidate} from './candidate-runtime.mjs';
for(const name of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS'])assert.ok(!process.env[name],'FORBIDDEN_PG_OVERRIDE:'+name);
assert.equal(process.env.PUSH_SINGLE_TARGET_DISPOSABLE,'SINGLE_TARGET_V1','EXPLICIT_DISPOSABLE_ADMISSION_REQUIRED');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env.GITHUB_SHA,'EXACT_COMMITTED_HEAD_REQUIRED');
const localImport=p=>import(pathToFileURL(resolve(p)));
const rt=await localImport('supabase/proofs/pre_v3/closure_runtime.mjs'); // existing loopback guard before any DB access
const {createFixtures,commandKey}=await localImport('supabase/proofs/ex05_s01/lib/fixtures.mjs');
const {createRunner}=await localImport('supabase/proofs/ex05_s01/lib/runner.mjs');
const {SQL}=await localImport('supabase/proofs/ex05_s01/lib/sql_snippets.mjs');
const {q,sql,rows,ok,service,anon,env}=rt;
const h=createRunner({unit:'PUSH_SINGLE_TARGET_V1'}),fx=createFixtures(rt);
const manifest=JSON.parse(readFileSync(new URL('./MANIFEST.json',import.meta.url)));
const sourceHashes={};
for(const [name,expected] of Object.entries(manifest.sourceFiles)) {
 const path=fileURLToPath(new URL(name,import.meta.url)),bytes=readFileSync(path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,'SOURCE_MANIFEST:'+name);
 assert.deepEqual(bytes,execFileSync('git',['show',env.GITHUB_SHA+':'+relative(process.cwd(),path).replaceAll('\\','/')]));sourceHashes[name]=expected;
}
const rpc=(name,args)=>ok(service.rpc(name,args).abortSignal(AbortSignal.timeout(10000)));
const target=id=>rpc('rpc_claim_push_single_target',{p_admission_id:id});
const receipt=id=>rpc('rpc_claim_push_single_target_receipt',{p_admission_id:id});
const begin=c=>rpc('rpc_begin_push_send',{p_attempt_id:c.attemptId,p_lease_id:c.leaseId});
const complete=(c,result,ticket=null)=>rpc('rpc_complete_push_transport',{p_attempt_id:c.attemptId,p_lease_id:c.leaseId,p_result:result,p_ticket_id:ticket});
const state=id=>rows(`select transport_state,send_count,single_target_claimed_at is not null consumed from public.notification_push_attempts where id=${q(id)}::uuid`)[0];
const body=name=>readFileSync(new URL(name,import.meta.url),'utf8');
let before,installed,party,agreement,device,session,otherDevice,syntheticProviderCalls=0,roster;
const CERT='CERTIFICATE_INSTALL_EXACT_REVERT_REAPPLY';
await h.check(CERT,async()=>{
 // Pause only local background jobs, matching the established disposable harness.
 sql(SQL.pauseSchedulers());
 before=snapshot(rt);const patch=installWithCertificate(body('install.disposable.sql'),before,manifest);roster=patch.roster;
 sql(patch.text);installed=snapshot(rt);assert.equal(installed.ready,true);assert.notEqual(installed.digest,before.digest);
 assert.deepEqual(installed.datasets,before.datasets);assert.deepEqual(installed.export_catalog,before.export_catalog);
 sql(revertWithCertificate(body('revert.disposable.sql'),before,installed));assert.deepEqual(snapshot(rt),before,'FULL_CERTIFICATE_REVERT');
 sql(patch.text);assert.deepEqual(snapshot(rt),installed,'DETERMINISTIC_CERTIFICATE_REAPPLY');
 sql("notify pgrst,'reload schema'");
 // Read-only route readiness; bounded retry is only PostgREST schema cache observation, never SEND.
 let ready=false;for(let i=0;i<20;i++){const r=await service.rpc('rpc_claim_push_single_target',{p_admission_id:randomUUID()});if(!r.error){assert.equal(r.data.kind,'NONE');ready=true;break;}assert.equal(r.error.code,'PGRST202');await new Promise(r=>setTimeout(r,100));}assert.ok(ready,'POSTGREST_RELOAD');
});
const certReq={requires:[CERT]};
await h.check('AUTHORITY_AND_CERTIFICATE_BODY_ACL_DRIFT_CLOSE',async()=>{
 for(const signature of EXTRA){const p=rows(`select pg_get_userbyid(proowner) owner,proconfig,prosecdef from pg_proc where oid=${q(signature)}::regprocedure`)[0];assert.equal(p.owner,'postgres');assert.deepEqual(p.proconfig,['search_path=pg_catalog']);}
 for(const signature of EXTRA.filter(x=>x.includes('single_target'))){const privateFn=signature.startsWith('private.');
  for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_function_privilege(${q(role)},${q(signature)},'EXECUTE')`),role==='service_role'&&!privateFn?'t':'f');}
 const close=`do $p$ begin if private.retention_ai_source_ready() is distinct from false or private.closure_erasure_binding_v5() is not null then raise exception 'DRIFT_NOT_CLOSED';end if;end $p$;`;
 sql(`begin;grant execute on function public.rpc_claim_push_single_target(uuid) to authenticated;${close}rollback;`);
 const definition=rows("select pg_get_functiondef('public.rpc_claim_push_single_target(uuid)'::regprocedure) d")[0].d;
 assert.ok(definition.includes('DECLARE')||definition.includes('declare'));
 const altered=definition.replace(/(DECLARE|declare)/,'-- proof-only source drift\n$1');assert.notEqual(altered,definition);
 sql(`begin;${altered};${close}rollback;`);assert.equal(snapshot(rt).digest,installed.digest);
},certReq);
const FIXTURE='REAL_LOCAL_AUTH_AGREEMENT_TWO_BOUND_DEVICES';
await h.check(FIXTURE,async()=>{
 party=await fx.prepareParty('single-target');agreement=await fx.agreementOf(party,'single target');
 for(let i=0;i<2;i++){const d=await ok(party.requester.client.rpc('rpc_set_push_device_owned',{p_expected_user_id:party.requester.id,p_expo_push_token:'ExpoPushToken[synthetic_'+randomUUID().replaceAll('-','')+']',p_platform:'ANDROID',p_active:true,p_expected_revision:0}));assert.equal(d.sessionBound,true);if(i===0)device=d;else otherDevice=d;}
 session=await fx.sessionOf(party.requester);
 await rt.prefs(party.requester.client,party.requester.id,'REQUESTER',{push_enabled:true,dogovor_enabled:true,quiet_hours_enabled:false});
},certReq);
const fixtureReq={requires:[FIXTURE]};
async function item(){const message=await ok(fx.sendText(party.worker,agreement,commandKey('single-target'),'Disposable synthetic message'));const event=fx.eventOf(message);return {event:event.id,delivery:fx.deliveryOf(event.id,'PUSH').id};}
function admit(item){const id=randomUUID(),authorization=randomUUID();const dev=rows(`select id,revision from public.notification_push_devices where user_id=${q(party.requester.id)}::uuid order by created_at,id`)[0];
 const dates=rows("select clock_timestamp()+interval '5 minutes' expiry,clock_timestamp()+interval '1 hour' deadline")[0];
 const call=`select private.admit_push_single_target_v1(${q(id)}::uuid,${q(authorization)}::uuid,${q(party.requester.id)}::uuid,'REQUESTER',${q(item.event)}::uuid,${q(item.delivery)}::uuid,${q(dev.id)}::uuid,${dev.revision},${q(session)}::uuid,${q(dates.expiry)}::timestamptz,${q(dates.deadline)}::timestamptz)`;
 assert.equal(JSON.parse(sql(call)).kind,'ADMITTED');return {...item,id,call,deviceId:dev.id};}
const backlog=()=>sql(`select md5(jsonb_build_object('deliveries',(select jsonb_agg(to_jsonb(d) order by id) from public.notification_deliveries d where not exists(select 1 from public.notification_push_attempts a where a.delivery_id=d.id and a.single_target_admission is not null)),'attempts',(select jsonb_agg(to_jsonb(a) order by id) from public.notification_push_attempts a where single_target_admission is null),'devices',(select jsonb_agg(to_jsonb(d) order by id) from public.notification_push_devices d))::text)`);
await h.check('CONCURRENT_CLAIMS_ONE_LEASE_LOST_RESPONSE_NO_REGRANT_UNRELATED_BACKLOG_UNCHANGED',async()=>{
 await item();const a=admit(await item()),b=backlog(),read=sql(SQL.readStateInApp());
 const claims=await Promise.all([target(a.id),target(a.id)]);assert.equal(claims.filter(x=>x.kind==='SEND').length,1);assert.equal(claims.filter(x=>x.kind==='NONE').length,1);
 assert.equal((await target(a.id)).kind,'NONE');assert.equal(JSON.parse(sql(a.call)).kind,'EXISTING');
 const c=claims.find(x=>x.kind==='SEND');await begin(c);const again=await service.rpc('rpc_begin_push_send',{p_attempt_id:c.attemptId,p_lease_id:c.leaseId});assert.equal(again.error?.code,'PT409','lost begin cannot reveal token twice');
 await complete(c,'UNKNOWN');assert.deepEqual(state(a.id),{transport_state:'UNKNOWN',send_count:1,consumed:true});assert.equal((await target(a.id)).kind,'NONE');
 assert.equal(backlog(),b);assert.equal(sql(SQL.readStateInApp()),read);
},fixtureReq);
await h.check('RETRYABLE_AND_RECEIPT_RATE_EXCEEDED_NEVER_RESTORE_SEND',async()=>{
 for(const result of ['RETRYABLE','FATAL','UNKNOWN','RECEIPT_RATE_EXCEEDED']){
  const a=admit(await item()),c=await target(a.id);assert.equal(c.kind,'SEND');await begin(c);let done;
  if(result==='RECEIPT_RATE_EXCEEDED'){await complete(c,'TICKET','synthetic_'+randomUUID().replaceAll('-',''));sql(`update public.notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 second' where id=${q(a.id)}::uuid`);const r=await receipt(a.id);assert.equal(r.kind,'RECEIPT');done=await complete(r,result);}
  else done=await complete(c,result);
  assert.equal(done.state,result==='UNKNOWN'?'UNKNOWN':'FINAL');assert.equal((await target(a.id)).kind,'NONE');assert.equal(state(a.id).send_count,1);
 }
},fixtureReq);
await h.check('REVOKED_AND_EXPIRED_ADMISSIONS_NEVER_REGRANT',async()=>{
 const a=admit(await item());assert.equal(sql(`select private.revoke_push_single_target_v1(${q(a.id)}::uuid)`),'t');assert.equal((await target(a.id)).kind,'NONE');
 const b=admit(await item()),c=await target(b.id);assert.equal(c.kind,'SEND');sql(`update public.notification_push_attempts set lease_until=clock_timestamp()-interval '1 second' where id=${q(b.id)}::uuid`);
 assert.equal((await receipt(b.id)).kind,'NONE');assert.deepEqual(state(b.id),{transport_state:'FINAL',send_count:0,consumed:true});assert.equal((await target(b.id)).kind,'NONE');
},fixtureReq);
await h.check('GENERIC_SEND_AND_RECEIPT_CANNOT_MUTATE_ADMITTED_DELIVERIES_AFTER_REVOKE_EXPIRY',async()=>{
 const a=admit(await item());sql(`select private.revoke_push_single_target_v1(${q(a.id)}::uuid)`);
 const b=admit(await item()),c=await target(b.id);await begin(c);await complete(c,'TICKET','synthetic_generic_exclusion');
 sql(`update public.notification_push_attempts set next_attempt_at=clock_timestamp()-interval '1 day' where id=${q(b.id)}::uuid`);
 // All generic writes, including unrelated legitimate backlog, are rolled back. Exact admitted rows must be byte-identical even within this transaction.
 sql(`begin;
 create temporary table target_before on commit drop as select to_jsonb(a) a,to_jsonb(d) d from public.notification_push_attempts a join public.notification_deliveries d on d.id=a.delivery_id where a.single_target_admission is not null;
 select set_config('request.jwt.claims','{"role":"service_role"}',true);
 select public.rpc_claim_push_transport('RECEIPT');select public.rpc_claim_push_transport('SEND');
 do $p$ begin if exists((select a,d from target_before except select to_jsonb(a),to_jsonb(d) from public.notification_push_attempts a join public.notification_deliveries d on d.id=a.delivery_id where a.single_target_admission is not null) union all (select to_jsonb(a),to_jsonb(d) from public.notification_push_attempts a join public.notification_deliveries d on d.id=a.delivery_id where a.single_target_admission is not null except select a,d from target_before)) then raise exception 'GENERIC_MUTATED_ADMISSION';end if;end $p$;
 rollback;`);
},fixtureReq);
await h.check('OBSERVED_BEGIN_REVOKE_LOCK_RACE_AND_DEVICE_CHANGE_REFUSE_TOKEN',async()=>{
 const a=admit(await item()),c=await target(a.id);assert.equal(c.kind,'SEND');
 const denied=await rt.lockedRace(`select private.revoke_push_single_target_v1(${q(a.id)}::uuid)`,()=>service.rpc('rpc_begin_push_send',{p_attempt_id:c.attemptId,p_lease_id:c.leaseId}));
 assert.equal(denied.error?.code,'PT409');assert.equal(state(a.id).send_count,0);
 const b=admit(await item()),lease=await target(b.id);
 // A local fixture changes the same bound-device revision while begin waits for its delivery; the token is never returned.
 const revision=rows(`select revision,bound_revision from public.notification_push_devices where id=${q(b.deviceId)}::uuid`)[0];
 try {
  const r=await rt.lockedRace(`select 1 from public.notification_deliveries where id=${q(b.delivery)}::uuid for update; update public.notification_push_devices set revision=revision+1 where id=${q(b.deviceId)}::uuid`,()=>service.rpc('rpc_begin_push_send',{p_attempt_id:lease.attemptId,p_lease_id:lease.leaseId}));
  assert.equal(r.error,null);assert.deepEqual(r.data,{kind:'SUPPRESSED'});assert.equal(state(b.id).send_count,0);
 } finally {sql(`update public.notification_push_devices set revision=${revision.revision},bound_revision=${revision.bound_revision} where id=${q(b.deviceId)}::uuid`);}
},fixtureReq);
await h.check('NON_SERVICE_DENIED_AND_REVERT_REFUSES_DURABLE_ADMISSIONS',async()=>{
 for(const client of [anon,party.requester.client,party.stranger.client])for(const name of ['rpc_claim_push_single_target','rpc_claim_push_single_target_receipt']){const r=await client.rpc(name,{p_admission_id:randomUUID()});assert.equal(r.error?.code,'42501');assert.equal(r.data,null);}
 assert.throws(()=>sql(revertWithCertificate(body('revert.disposable.sql'),before,installed)),/ADMITTED_ATTEMPTS_PREVENT_SCHEMA_REVERT/);assert.equal(snapshot(rt).digest,installed.digest);
},fixtureReq);
await h.check('WRONG_ROLE_SESSION_REVISION_AND_EXPIRED_ADMISSION_LEAVE_NO_ATTEMPT',async()=>{
 const d=await item(),dev=rows(`select id,revision from public.notification_push_devices where user_id=${q(party.requester.id)}::uuid order by created_at,id`)[0],prior=backlog();
 const dates=rows("select clock_timestamp()+interval '5 minutes' expiry,clock_timestamp()-interval '1 second' past,clock_timestamp()+interval '1 hour' deadline")[0];
 for(const [role,sid,revision,expiry,error] of [
  ['WORKER',session,dev.revision,dates.expiry,'PUSH_TARGET_UNAVAILABLE'],
  ['REQUESTER',randomUUID(),dev.revision,dates.expiry,'PUSH_DEVICE_CHANGED'],
  ['REQUESTER',session,dev.revision+1,dates.expiry,'PUSH_DEVICE_CHANGED'],
  ['REQUESTER',session,dev.revision,dates.past,'PUSH_TARGET_UNAVAILABLE']]) {
  const id=randomUUID();
  const call=`select private.admit_push_single_target_v1(${q(id)}::uuid,${q(randomUUID())}::uuid,${q(party.requester.id)}::uuid,${q(role)},${q(d.event)}::uuid,${q(d.delivery)}::uuid,${q(dev.id)}::uuid,${revision},${q(sid)}::uuid,${q(expiry)}::timestamptz,${q(dates.deadline)}::timestamptz)`;
  assert.throws(()=>sql(call),new RegExp(error));assert.equal(sql(`select count(*) from public.notification_push_attempts where id=${q(id)}::uuid`),'0');
 }
 assert.equal(backlog(),prior);
},fixtureReq);
await h.check('PREFERENCE_CLOSURE_AND_SESSION_RECHECK_BEFORE_TOKEN_EXPOSURE',async()=>{
 for(const reason of ['PREFERENCE','CLOSURE','SESSION']) {
  const a=admit(await item()),c=await target(a.id);assert.equal(c.kind,'SEND');
  const originalSession=rows(SQL.sessionNotAfter(session))[0].not_after;
  try {
   if(reason==='PREFERENCE')await rt.prefs(party.requester.client,party.requester.id,'REQUESTER',{dogovor_enabled:false});
   if(reason==='CLOSURE')sql(SQL.insertClosureRequest(party.requester.id));
   if(reason==='SESSION')sql(SQL.expireSession(session));
   assert.deepEqual(await begin(c),{kind:'SUPPRESSED'});assert.equal(state(a.id).send_count,0);assert.equal((await target(a.id)).kind,'NONE');
  } finally {
   if(reason==='PREFERENCE')await rt.prefs(party.requester.client,party.requester.id,'REQUESTER',{dogovor_enabled:true});
   if(reason==='CLOSURE')sql(SQL.deleteClosureRequest(party.requester.id));
   if(reason==='SESSION')sql(SQL.restoreSession(session,originalSession));
  }
 }
},fixtureReq);
await h.check('NEW_METADATA_REMAINS_IN_EXISTING_OWNER_SCOPE_AND_WHOLE_ROW_ERASURE_PATCH',async()=>{
 const a=admit(await item()),generation=randomUUID();
 sql(`begin;
 do $p$ declare predicate text;owned boolean;foreign_owned boolean;patch jsonb;n integer;begin
 predicate:=private.closure_redaction_scope_v5('public.notification_push_attempts');
 execute format('select exists(select 1 from public.notification_push_attempts t where t.id=$2 and (%s))',predicate) into owned using ${q(party.requester.id)}::uuid,${q(a.id)}::uuid;
 execute format('select exists(select 1 from public.notification_push_attempts t where t.id=$2 and (%s))',predicate) into foreign_owned using ${q(party.stranger.id)}::uuid,${q(a.id)}::uuid;
 if owned is distinct from true or foreign_owned is distinct from false then raise exception 'ADMISSION_OWNER_SCOPE';end if;
 select private.closure_redaction_patch_v5('public.notification_push_attempts',to_jsonb(t),${q(party.requester.id)}::uuid,${q(generation)}::uuid) into patch from public.notification_push_attempts t where id=${q(a.id)}::uuid;
 if patch is distinct from '{"operation":"DELETE","patch":{}}'::jsonb then raise exception 'ADMISSION_ERASURE_NOT_WHOLE_ROW';end if;
 -- Execute the existing predicate plus DELETE patch in a rollback-only local transaction; this is not the whole closure state machine.
 execute format('delete from public.notification_push_attempts t where t.id=$2 and (%s)',predicate) using ${q(party.requester.id)}::uuid,${q(a.id)}::uuid;
 get diagnostics n=row_count;if n<>1 then raise exception 'ADMISSION_ERASURE_ROW_COUNT';end if;
 if exists(select 1 from public.notification_push_attempts where id=${q(a.id)}::uuid) then raise exception 'ADMISSION_METADATA_REMAINS';end if;
 end $p$;rollback;`);
 assert.equal(state(a.id).consumed,false,'rollback preserves durable admission for later no-revert proof');
},fixtureReq);
await h.check('ACTUAL_EDGE_EXACT_TARGET_DEFAULT_OFF_THEN_SEND_ONCE_WITH_SYNTHETIC_PROVIDER',async()=>{
 const a=admit(await item()),b=backlog(),read=sql(SQL.readStateInApp());let enabled=false,io=0;
 const runtime=()=>loadCandidate({env:k=>({SUPABASE_SERVICE_ROLE_KEY:env.RU5_DEVICE_SERVICE_ROLE_KEY,SUPABASE_URL:'https://single-proof.supabase.co',EXPO_PUSH_SINGLE_TARGET_ENABLED:enabled?'true':'false',EXPO_PUSH_TRANSPORT_ENABLED:'false'})[k],fetch:async(url,init)=>{
  io++;if(url==='https://exp.host/--/api/v2/push/send'){syntheticProviderCalls++;assert.equal(JSON.parse(init.body).length,1);return new Response(JSON.stringify({data:[{status:'ok',id:'synthetic_edge_ticket'}]}));}
  const u=new URL(url);assert.equal(u.origin,'https://single-proof.supabase.co');assert.ok(['/rest/v1/rpc/rpc_claim_push_single_target','/rest/v1/rpc/rpc_begin_push_send','/rest/v1/rpc/rpc_complete_push_transport'].includes(u.pathname),'NO_GLOBAL_RPC');return fetch(new URL(u.pathname,env.RU5_DEVICE_SUPABASE_URL),{...init,redirect:'error'});
 }});
 const run=r=>r.handler(new Request('https://worker.invalid',{method:'POST',headers:{apikey:env.RU5_DEVICE_SERVICE_ROLE_KEY},body:JSON.stringify({action:'single_target',admissionId:a.id})}));
 assert.equal((await(await run(runtime())).json()).kind,'DISABLED');assert.equal(io,0);enabled=true;
 const results=await Promise.all([run(runtime()),run(runtime())]);const states=await Promise.all(results.map(r=>r.json()));assert.equal(states.filter(x=>x.state==='TICKET_PENDING').length,1);assert.equal(states.filter(x=>x.state==='NONE').length,1);assert.equal(syntheticProviderCalls,1);
 assert.equal((await(await run(runtime())).json()).state,'NONE');assert.equal(syntheticProviderCalls,1);assert.equal(backlog(),b);assert.equal(sql(SQL.readStateInApp()),read);
},fixtureReq);
const summary={...h.summary(),sourceSha:env.GITHUB_SHA,sourceHashes,roster,actualAuth:true,actualDatabase:true,liveAccess:false,providerCalled:false,syntheticProviderCalls,deviceProven:false,devReady:false,
 limits:['Disposable proof only; no runtime admission or DEV application.','Full account-closure execution is not simulated; ownership/delete source remains predecessor-pinned.','Phone delivery, tap routing and provider credentials are not exercised.']};
writeFileSync(resolve(rt.out,'single-target-proof-report.json'),JSON.stringify(summary,null,2)+'\n');
if(summary.result!=='PASS')process.exitCode=1;
