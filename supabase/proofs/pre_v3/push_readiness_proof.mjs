// P11 exact Edge and production client + real disposable Auth/Postgres.
// Only the declared HTTPS RPC origin is adapted to local PostgREST. All provider
// IO is forbidden. This is not a production deployment or real Expo proof.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import {assert,randomUUID,env,sha,q,sql,rows,ok,denied,requester,worker,anon,service,requesterId,workerId,
 login,apply,prove,pass,agreement,prefs} from './closure_runtime.mjs';
import {loadPreV3Clients} from './client_runtime.mjs';
const version='PRE_V3_PUSH_READINESS_V1';
const observe=x=>service.rpc('rpc_record_push_readiness',{p_sender_version:version,p_observation:x});
const read=()=>ok(requester.rpc('rpc_get_push_readiness',{}));
await prove('PRE_V3_PUSH_READINESS','push-readiness-report.json',async report=>{
 await apply(report,'20260912131000_clean_pre_v3_push_readiness.sql',121);
 await apply(report,'20260912131100_clean_pre_v3_push_readiness_column_qualification.sql',122);await login();
 const initial=await read();assert.equal(initial.state,'UNKNOWN');assert.equal(initial.observedAt,null);assert.equal(initial.lastSuccessAt,null);
 await denied(anon.rpc('rpc_get_push_readiness',{}));
 await denied(requester.rpc('rpc_record_push_readiness',{p_sender_version:version,p_observation:'TICK_OK'}));
 for(const v of ['OPERATIONAL','anything',null]) await denied(observe(v),'PUSH_READINESS_INPUT_INVALID');
 await denied(service.rpc('rpc_record_push_readiness',{p_sender_version:'FAKE',p_observation:'TICK_OK'}),'PUSH_READINESS_INPUT_INVALID');
 assert.equal(sql('select count(*) from private.push_runtime_readiness'),'0');
 pass(report,'UNOBSERVED_IS_UNKNOWN_SERVICE_ONLY_BOUNDED_WRITER_NO_SEEDED_RUNTIME_SUCCESS');
 const sourcePath='supabase/functions/uskoci-push-transport/index.ts',bytes=readFileSync(sourcePath);
 assert.deepEqual(bytes,execFileSync('git',['show',sha+':'+sourcePath]));
 report.edgeSourceSha256=createHash('sha256').update(bytes).digest('hex');
 let enabled=false,handler,beforeBegin=null;const calls=[],keys=[];
 const fetchRpc=async(url,init)=>{
  assert.match(url,/^https:\/\/pre-v3-proof\.supabase\.co\/rest\/v1\/rpc\/(rpc_claim_push_transport|rpc_begin_push_send|rpc_complete_push_transport|rpc_record_push_readiness)$/,'FORBIDDEN_PROVIDER_OR_OTHER_NETWORK_IO');
  calls.push(url.split('/').pop());if(url.endsWith('rpc_begin_push_send')&&beforeBegin){const hook=beforeBegin;beforeBegin=null;await hook();}
  return fetch(env.RU5_DEVICE_SUPABASE_URL+'/rest/v1/rpc/'+url.split('/').pop(),init);
 };
 const globals={exports:{},Request,Response,URL,Headers,TextEncoder,TextDecoder,ReadableStream,AbortController,Date,setTimeout,clearTimeout,fetch:fetchRpc,
  console:{log:()=>assert.fail('NO_LOGGING'),warn:()=>assert.fail('NO_LOGGING'),error:()=>assert.fail('NO_LOGGING')},
  Deno:{env:{get:k=>{keys.push(k);return k==='SUPABASE_SERVICE_ROLE_KEY'?env.RU5_DEVICE_SERVICE_ROLE_KEY:k==='SUPABASE_URL'?'https://pre-v3-proof.supabase.co':k==='EXPO_PUSH_TRANSPORT_ENABLED'?String(enabled):undefined;}},serve:h=>{handler=h;}}};
 const compiled=ts.transpileModule(bytes.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 new vm.Script(compiled.outputText).runInContext(vm.createContext(globals));
 const invoke=async(action,authorization='Bearer '+env.RU5_DEVICE_SERVICE_ROLE_KEY)=>{
  const response=await handler(new Request('https://local-proof.invalid',{method:'POST',headers:{authorization},body:JSON.stringify({action})}));
  const data=await response.json();return{status:response.status,data};
 };
 assert.equal((await invoke('probe','Bearer not-service')).status,403);assert.equal(calls.length,0);
 assert.equal((await invoke('tick')).data.kind,'DISABLED');assert.equal(calls.length,0);
 assert.equal((await invoke('probe')).data.kind,'READINESS_RECORDED');assert.equal((await read()).state,'NOT_READY');
 enabled=true;await invoke('probe');assert.equal((await read()).state,'UNKNOWN');assert.equal((await read()).reason,'SUCCESSFUL_TICK_NOT_OBSERVED');
 assert.ok(!keys.includes('EXPO_ACCESS_TOKEN'));
 // Expire prior package fixture work only, so the actual idle tick has no
 // provider work. No production rows or gates are changed.
 sql("update public.notification_deliveries set state='EXPIRED' where channel='PUSH';update public.notification_push_attempts set lease_until=null,lease_id=null,transport_state='FINAL',outcome='FATAL'");
 const tick=await invoke('tick');assert.equal(tick.status,200);assert.equal(tick.data.send,'NONE');assert.equal(tick.data.receipt,'NONE');
 const healthy=await read();assert.equal(healthy.state,'OPERATIONAL');assert.ok(healthy.lastSuccessAt);assert.equal(healthy.evidenceScope,'TRANSPORT_ONLY');
 assert.ok(!keys.includes('EXPO_ACCESS_TOKEN'));
 pass(report,'ACTUAL_EDGE_DISABLED_TICK_AND_NON_SENDING_PROBE_AND_IDLE_TICK_WRITE_REAL_SQL_HEALTH');

 const loader=loadPreV3Clients({sourceSha:sha,client:()=>requester,session:()=>({user:{id:requesterId},accountRevision:1})});
 const client=loader.load('src/data/pushReadinessClientService.ts').pushReadinessClientService;
 const mapped=await client.read();assert.equal(mapped.ok,true);assert.equal(mapped.podatak.state,'OPERATIONAL');
 const last=healthy.lastSuccessAt;await ok(observe('TICK_DEGRADED'));assert.equal((await read()).state,'DEGRADED');assert.equal((await read()).lastSuccessAt,last);
 await ok(observe('TICK_FAILED'));assert.equal((await read()).reason,'LAST_TICK_UNHEALTHY');
 const stale="update private.push_runtime_readiness set observed_at=clock_timestamp()-interval '301 seconds',last_success_at=null";
 sql(stale);assert.equal((await read()).state,'UNKNOWN');assert.equal((await read()).fresh,false);assert.equal((await read()).senderConfiguration,'UNKNOWN');
 await Promise.all([ok(observe('TICK_OK')),ok(observe('TICK_FAILED')),ok(observe('PROBE_DISABLED'))]);
 assert.equal(sql('select count(*) from private.push_runtime_readiness'),'1');assert.equal(sql('select last_success_at<=observed_at from private.push_runtime_readiness'),'t');
 await ok(observe('TICK_OK'));
 pass(report,'CURRENT_SERVER_FRESHNESS_STALE_UNKNOWN_DEGRADED_LAST_SUCCESS_CONCURRENT_OBSERVATIONS_ACTUAL_CLIENT');

 await prefs(worker,workerId,'WORKER',{push_enabled:true,in_app_enabled:true,dogovor_enabled:true,quiet_hours_enabled:false});
 await ok(worker.rpc('rpc_set_push_device_owned',{p_expected_user_id:workerId,p_expo_push_token:'ExpoPushToken[pre_v3_readiness_token]',p_platform:'ANDROID',p_active:true,p_expected_revision:0}));
 const a=await agreement('push readiness block');
 sql("update public.notification_deliveries set state='EXPIRED' where channel='PUSH'");
 await ok(requester.rpc('rpc_send_agreement_message_v2',{p_expected_user_id:requesterId,p_agreement_id:a.id,p_client_message_id:randomUUID(),p_body:'Safe push readiness fixture'}));
 const setBlock=async active=>{const b=await ok(requester.rpc('rpc_get_account_block',{p_target_account_id:workerId}));return ok(requester.rpc('rpc_set_account_block',{p_target_account_id:workerId,p_blocked:active,p_expected_revision:b.revision,p_client_request_id:randomUUID()}));};
 beforeBegin=()=>setBlock(true);const suppressed=await invoke('tick');assert.equal(suppressed.status,200);assert.equal(suppressed.data.send,'SUPPRESSED');
 await setBlock(false);assert.ok(!keys.includes('EXPO_ACCESS_TOKEN'));
 pass(report,'ACTUAL_EDGE_RECHECKS_NEW_ACCOUNT_BLOCK_AFTER_CLAIM_AND_SUPPRESSES_BEFORE_PROVIDER_IO');
 // Exercise operational degradation from actual existing queue/lease columns.
 sql("update public.notification_deliveries set state='EXPIRED' where channel='PUSH'");
 await ok(requester.rpc('rpc_send_agreement_message_v2',{p_expected_user_id:requesterId,p_agreement_id:a.id,p_client_message_id:randomUUID(),p_body:'Lease readiness fixture'}));
 const lease=await ok(service.rpc('rpc_claim_push_transport',{p_kind:'SEND'}));assert.equal(lease.kind,'SEND');
 sql(`update public.notification_push_attempts set lease_until=clock_timestamp()-interval '1 second' where id=${q(lease.attemptId)}::uuid`);
 await ok(observe('TICK_OK'));assert.equal((await read()).state,'DEGRADED');assert.equal((await read()).reason,'EXPIRED_LEASE');
 sql('update public.notification_push_attempts set lease_until=null,lease_id=null,transport_state=\'FINAL\',outcome=\'FATAL\'');
 sql("update public.notification_deliveries set created_at=clock_timestamp()-interval '16 minutes' where channel='PUSH' and state in('CREATED','QUEUED','FAILED_RETRYABLE')");
 assert.equal((await read()).reason,'OVERDUE_BACKLOG');
 sql("update public.notification_deliveries set state='EXPIRED' where channel='PUSH'");await ok(observe('TICK_OK'));assert.equal((await read()).state,'OPERATIONAL');
 report.leaseQueryPlan=JSON.parse(sql("explain(format json) select exists(select 1 from public.notification_push_attempts where lease_until<=statement_timestamp())"));
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`select has_table_privilege(${q(role)},'private.push_runtime_readiness','SELECT,INSERT,UPDATE,DELETE')`),'f');
 for(const signature of ['rpc_get_push_readiness()','rpc_record_push_readiness(text,text)'])assert.equal(sql(`select prosecdef and proconfig @> array['search_path=pg_catalog'] from pg_proc where oid=${q('public.'+signature)}::regprocedure`),'t');
 report.productionClientHashes=loader.sourceHashes;report.actualEdge=true;report.networkOriginAdapter='DECLARED_RPC_HTTPS_TO_DISPOSABLE_LOCAL_POSTGREST_ONLY';
 report.providerCalled=false;report.productionDeploymentProven=false;report.schedulerActivated=false;
 pass(report,'EXPIRED_LEASE_AND_OVERDUE_BACKLOG_DEGRADE_EXISTING_INDEX_PLAN_PRIVATE_RLS_NO_PROVIDER_OR_SCHEDULER');
});
