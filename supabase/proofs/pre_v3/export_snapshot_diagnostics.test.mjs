// Synthetic SQL responses only; no database, provider or CI invocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SNAPSHOT136_SOURCE,buildSnapshotDiagnostics,sanitizeSnapshotPlan,runSnapshotDiagnostics,rethrowSnapshotFailure} from './export_snapshot_diagnostics.mjs';
import {ObservedSqlError,OBSERVED_SQL_LIMITS,restoreObservedSql} from './observed_export_sql.mjs';
const source=readFileSync(new URL('../../migrations/20260913001000_clean_v5_owned_export_projection.sql',import.meta.url));
const secret="PRIVATE_SNAPSHOT_'_);drop table auth.users;--_FILTER_PROVIDER_KEY";
const params=()=>({accountId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',receiptId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
 binding:{delivery:{datasets:[{key:'account',mode:'INCLUDE',fields:['id']}],secret},private:secret},cutoff:'2026-09-13T03:00:00.000Z'});
const rawPlan=()=>[{Plan:{'Node Type':'Result','Startup Cost':1.25,'Total Cost':987654.5,'Plan Rows':1,'Plan Width':32,'Workers Planned':2,
 Filter:secret,Output:[secret],'Relation Name':secret,'Index Name':secret,'CTE Name':secret,
 Plans:[{'Node Type':'CTE Scan','Parent Relationship':'InitPlan','Index Cond':secret,Plans:[{'Node Type':'Function Scan','Hash Cond':secret,'Recheck Cond':secret,'Sort Key':[secret],'Group Key':[secret]}]}]},
 'Planning Time':12.5,'Execution Time':7.5,Settings:{jit:'on',jit_above_cost:'100000',jit_inline_above_cost:'-1',jit_optimize_above_cost:'5e5',plan_cache_mode:'auto',search_path:secret},
 JIT:{Functions:30,Options:{Inlining:true,Optimization:false,Expressions:true,Deforming:true,unknown:secret},Timing:{Generation:1,Inlining:2,Optimization:3,Emission:4,Total:10,secret},secret},secret}];
const noPrivate=value=>assert.ok(!JSON.stringify(value).includes(secret));

test('exact file/body hash pins a single trusted extraction and rejects every source mutation',()=>{
 assert.equal(createHash('sha256').update(source).digest('hex'),SNAPSHOT136_SOURCE.migrationSha256);
 const text=source.toString(),header=' as $fn$',functionStart=text.indexOf('create or replace function private.data_export_snapshot('),start=text.indexOf(header,functionStart)+header.length;
 const body=text.slice(start,text.indexOf('$fn$;',start));
 assert.equal(createHash('sha256').update(body).digest('hex'),SNAPSHOT136_SOURCE.bodySha256);
 for(const bytes of [source.toString(),Buffer.from(text+'\n'),Buffer.from(text.replace(' owned_rows as (',' owned_rows as materialized (')),
  Buffer.from(text.replace('p_account_id uuid,p_receipt_id uuid,p_binding jsonb,p_cutoff timestamptz','p_other uuid,p_receipt_id uuid,p_binding jsonb,p_cutoff timestamptz'))])
  assert.throws(()=>buildSnapshotDiagnostics(bytes,params()),/SOURCE_OR_INPUT_INVALID/);
});

test('typed fixed parameters are identical across each same-session READ ONLY prepare/execute; only the one CTE marker differs',()=>{
 const commands=buildSnapshotDiagnostics(source,params());assert.equal(Object.keys(commands).length,6);
 for(const [key,sql] of Object.entries(commands)){
  if(key==='SOURCE_BINDING'||key==='EXECUTE_FUNCTION_LOCAL_JIT_OFF')continue;
  assert.ok(sql.startsWith('begin read only;\nset local search_path=pg_catalog;\nprepare uskoci_snapshot136(uuid,uuid,jsonb,timestamptz) as\n'));
  assert.match(sql,/select \$1::uuid as p_account_id,\$2::uuid as p_receipt_id,\$3::jsonb as p_binding,\$4::timestamptz as p_cutoff/);
  assert.match(sql,/cross join lateral \(/);assert.ok(sql.endsWith('\nrollback;'));
  assert.equal(sql.split('prepare uskoci_snapshot136').length,2);assert.equal(sql.split('execute uskoci_snapshot136(').length,2);
  assert.ok(!/\b(?:create|alter|drop|analyze)\b/i.test(sql));assert.ok(!/set (?:local )?(?:jit|plan_cache_mode|statement_timeout)/i.test(sql));
 }
 assert.equal(commands.EXECUTE_MATERIALIZED.replace(' owned_rows as materialized (',' owned_rows as ('),commands.EXECUTE_ORIGINAL);
 assert.equal(commands.PLAN_MATERIALIZED.replace(' owned_rows as materialized (',' owned_rows as ('),commands.PLAN_ORIGINAL);
 assert.equal(commands.PLAN_ORIGINAL.replace('explain (format json, settings true) ',''),commands.EXECUTE_ORIGINAL);
 assert.equal(commands.PLAN_MATERIALIZED.replace('explain (format json, settings true) ',''),commands.EXECUTE_MATERIALIZED);
 const header='set search_path=pg_catalog as $fn$',start=source.toString().indexOf(header,source.toString().indexOf('function private.data_export_snapshot('))+header.length;
 const body=source.toString().slice(start,source.toString().indexOf('$fn$;',start)).trimEnd().slice(0,-1);
 assert.ok(commands.EXECUTE_ORIGINAL.includes('\n'+body+'\n) diagnostic(snapshot_value);'));
 assert.ok(body.includes('p_binding'));assert.ok(body.includes('p_account_id'));assert.equal(OBSERVED_SQL_LIMITS.queryMs,20000);
});

test('binding JSON is hex-encoded and invalid identities/cutoff/oversize inputs never become executable SQL',()=>{
 const parameters=params(),commands=buildSnapshotDiagnostics(source,parameters);
 for(const sql of Object.values(commands)){assert.ok(!sql.includes(secret));assert.ok(!sql.includes('drop table'));}
 assert.ok(commands.EXECUTE_ORIGINAL.includes(Buffer.from(JSON.stringify(parameters.binding)).toString('hex')));
 for(const patch of [{accountId:secret},{receiptId:secret},{cutoff:secret},{cutoff:'2026-13-13T03:00:00.000Z'},{binding:[]},{binding:{value:'x'.repeat(262145)}}])
  assert.throws(()=>buildSnapshotDiagnostics(source,{...parameters,...patch}),/SOURCE_OR_INPUT_INVALID/);
});

test('actual server body and function metadata are read-only prerequisites, with no source body result',()=>{
 const sql=buildSnapshotDiagnostics(source,params()).SOURCE_BINDING;
 for(const value of [SNAPSHOT136_SOURCE.bodySha256,SNAPSHOT136_SOURCE.signature,'p.prosecdef',"p.provolatile='s'","p.proconfig=array['search_path=pg_catalog']",'p.prolang','p.prorettype'])assert.ok(sql.includes(value));
 assert.match(sql,/^select coalesce\(\(select encode\(extensions.digest\(convert_to\(p.prosrc/);
 assert.ok(!/pg_get_functiondef|\b(?:insert|update|delete|create|alter|drop)\b/i.test(sql));
});

test('plan evidence is only bounded numeric/boolean fields and admitted setting enums; expression and identity payloads disappear',()=>{
 const result=sanitizeSnapshotPlan(rawPlan());noPrivate(result);
 assert.deepEqual(result,{startupCost:1.25,totalCost:987654.5,nodeCount:3,maxDepth:2,cteScans:1,functionScans:1,subplans:1,estimatedRows:1,estimatedWidth:32,plannedWorkers:2,
  planningMilliseconds:12.5,executionMilliseconds:7.5,jit:{functions:30,options:{inlining:true,optimization:false,expressions:true,deforming:true},milliseconds:{generation:1,inlining:2,optimization:3,emission:4,total:10}},
  nonDefaultSettings:{jit_above_cost:100000,jit_inline_above_cost:-1,jit_optimize_above_cost:500000,jit:true,plan_cache_mode:'auto'}});
 for(const name of ['Filter','Output','Relation Name','Index Name','CTE Name','Index Cond','Hash Cond','Recheck Cond','Sort Key','Group Key','Plans'])assert.ok(!JSON.stringify(result).includes('"'+name+'"'));
});

test('malformed/cyclic/deep/wide plans fail closed and untrusted numeric or settings fields are omitted',()=>{
 for(const input of [null,[],{},[{}],[{Plan:{'Startup Cost':Infinity,'Total Cost':2}}],[{Plan:{'Startup Cost':1,'Total Cost':NaN}}],
  [{Plan:{'Startup Cost':1,'Total Cost':2,Plans:'bad'}}]])assert.throws(()=>sanitizeSnapshotPlan(input),/PLAN_INVALID/);
 const cyclic=rawPlan();cyclic[0].Plan.Plans=[cyclic[0].Plan];assert.throws(()=>sanitizeSnapshotPlan(cyclic),/TOO_LARGE/);
 const wide=rawPlan();wide[0].Plan.Plans=Array(4096).fill({});assert.throws(()=>sanitizeSnapshotPlan(wide),/TOO_LARGE/);
 const deep=rawPlan();let node=deep[0].Plan;for(let i=0;i<129;i++){node.Plans=[{}];node=node.Plans[0];}assert.throws(()=>sanitizeSnapshotPlan(deep),/TOO_LARGE/);
 const raw=rawPlan();raw[0].Plan['Plan Rows']=Infinity;raw[0].Plan['Plan Width']='32';raw[0].JIT.Functions=-1;raw[0].JIT.Timing.Total=NaN;
 raw[0].Settings={jit:secret,jit_above_cost:'Infinity',jit_inline_above_cost:'NaN',jit_optimize_above_cost:500,plan_cache_mode:secret};
 const safe=sanitizeSnapshotPlan(raw);for(const key of ['estimatedRows','estimatedWidth','nonDefaultSettings'])assert.equal(safe[key],undefined);
 assert.equal(safe.jit.functions,undefined);assert.equal(safe.jit.milliseconds.total,undefined);noPrivate(safe);
});

function transport({sourceResult='t',failOperation,failAssertion=false}={}){
 const report={},calls=[],verified=[],parameters=params();
 const options={bytes:source,parameters,report,readSource:()=>source,observedSql:async(operation,sql)=>{
  calls.push({operation,sql});if(operation===failOperation)throw new ObservedSqlError(operation,'ETIMEDOUT',null);
  if(operation==='DIAG_SOURCE_BINDING')return sourceResult;
  if(operation.startsWith('DIAG_PLAN_'))return JSON.stringify(rawPlan());
  return JSON.stringify({accountId:parameters.accountId,receiptId:parameters.receiptId,snapshotAt:parameters.cutoff,value:secret});
 },verifySnapshot:async doc=>{verified.push(doc);assert.equal(doc.accountId,parameters.accountId);assert.equal(doc.receiptId,parameters.receiptId);assert.equal(doc.snapshotAt,parameters.cutoff);if(failAssertion)assert.fail(secret);}};
 return{options,report,calls,verified};
}

test('each clone validates owned output in memory, never stores bytes or falsely asserts actual function/content parity',async()=>{
 const f=transport();await runSnapshotDiagnostics(f.options);
 assert.deepEqual(f.calls.map(x=>x.operation),['DIAG_SOURCE_BINDING','DIAG_PLAN_ORIGINAL','DIAG_PLAN_MATERIALIZED','DIAG_EXECUTE_ORIGINAL','DIAG_EXECUTE_MATERIALIZED','DIAG_EXECUTE_FUNCTION_LOCAL_JIT_OFF']);
 assert.equal(f.verified.length,3);assert.deepEqual(f.verified[0],f.verified[1]);
 const d=f.report.exportPerformanceDiagnostics;assert.equal(d.sourceBinding,'MATCHED');assert.equal(d.steps.length,5);assert.ok(d.steps.every(x=>x.status==='SUCCEEDED'));
 for(const key of ['cloneFunctionInvocation','securityDefinerFunctionPlanEquivalent','coldCacheGuaranteed','contentParityEstablished','parameterValuesRetained','productionSqlChanged'])assert.equal(d[key],false);
 assert.equal(d.separateTransactionSnapshots,true);assert.equal(d.singleVariantDifference,'OWNED_ROWS_MATERIALIZED');noPrivate(f.report);
 assert.ok(!JSON.stringify(f.report).includes(f.options.parameters.accountId));assert.ok(!JSON.stringify(f.report).includes(f.options.parameters.receiptId));
});

test('source mismatch/unavailable admits no clone, individual plan or output assertion failures remain safely separate',async()=>{
 for(const value of ['f','true','t\n'+secret]){const f=transport({sourceResult:value});await runSnapshotDiagnostics(f.options);assert.equal(f.calls.length,1);assert.equal(f.report.exportPerformanceDiagnostics.sourceBinding,'REJECTED');}
 const unavailable=transport({failOperation:'DIAG_SOURCE_BINDING'});await runSnapshotDiagnostics(unavailable.options);assert.equal(unavailable.calls.length,1);assert.equal(unavailable.report.exportPerformanceDiagnostics.sourceBinding,'UNAVAILABLE');
 const f=transport({failOperation:'DIAG_PLAN_ORIGINAL',failAssertion:true});await runSnapshotDiagnostics(f.options);
 assert.equal(f.calls.length,6);assert.equal(f.report.exportPerformanceDiagnostics.steps[0].failure.operation,'DIAG_PLAN_ORIGINAL');
 assert.equal(f.report.exportPerformanceDiagnostics.steps[1].status,'SUCCEEDED');
 for(const step of f.report.exportPerformanceDiagnostics.steps.slice(2)){assert.equal(step.status,'FAILED');assert.equal(step.failure.code,'ASSERTION_FAILED');assert.equal(step.ownedProjectionAssertionsPassed,undefined);}
 noPrivate(f.report);
});

test('only canonical full-snapshot process timeout or SQL query cancellation admit diagnostics, always rethrowing the identical original error',async()=>{
 for(const original of [new ObservedSqlError('SNAPSHOT_FULL','ETIMEDOUT',null),new ObservedSqlError('SNAPSHOT_FULL','PROCESS_EXIT',3,'57014')]){
  const f=transport();await assert.rejects(rethrowSnapshotFailure(original,f.options),e=>e===original);assert.equal(f.calls.length,6);
  assert.equal(f.report.exportPerformanceDiagnostics.trigger.operation,'SNAPSHOT_FULL');noPrivate(f.report);
 }
 for(const original of [new Error(secret),new ObservedSqlError('BIND_FULL','ETIMEDOUT',null),new ObservedSqlError('SNAPSHOT_FULL','PROCESS_EXIT',3,'42P01'),
  new ObservedSqlError('SNAPSHOT_LIMITED','PROCESS_EXIT',3,'57014'),{operation:'SNAPSHOT_FULL',code:'ETIMEDOUT'}]){
  const f=transport();await assert.rejects(rethrowSnapshotFailure(original,f.options),e=>e===original);assert.equal(f.calls.length,0);assert.equal(f.report.exportPerformanceDiagnostics,undefined);
 }
});

test('unexpected source read/report/assertion exceptions cannot replace primary error or suppress outer cleanup',async()=>{
 const original=new ObservedSqlError('SNAPSHOT_FULL','ETIMEDOUT',null);
 for(const change of [options=>{options.readSource=()=>{throw new Error(secret);};},options=>{options.verifySnapshot=()=>{throw new Error(secret);};}]){
  const f=transport();change(f.options);let primary=null;const restored=[];
  await assert.rejects((async()=>{try{await rethrowSnapshotFailure(original,f.options);}catch(e){primary=e;throw e;}
   finally{await restoreObservedSql([{operation:'RETIRE_FIXTURE_POLICY',run:async()=>{restored.push('policy');throw new Error(secret);}},
    {operation:'RETIRE_FIXTURE_PRIVACY',run:async()=>{restored.push('privacy');}}],f.report,primary);}})(),e=>e===original);
  assert.deepEqual(restored,['policy','privacy']);assert.equal(primary,original);noPrivate(f.report);
 }
});

test('actual proof uses real timeout catch plus same complete assertions, preserving the original outer cleanup and source migration bytes',()=>{
 const proof=readFileSync(new URL('./v5_owned_export_proof.mjs',import.meta.url),'utf8');
 assert.match(proof,/try\{doc=JSON\.parse\(await observedSql\('SNAPSHOT_FULL',snapshotSql\(requesterId,fullBinding\)\)\);\}\s*catch\(error\)\{await rethrowSnapshotFailure\(error,/);
 assert.match(proof,/parameters:diagnosticParameters,observedSql,report,verifySnapshot:async snapshot=>/);
 assert.match(proof,/await assertOwnedProjection\(snapshot\)/);assert.match(proof,/await assertOwnedProjection\(doc\)/);
 assert.match(proof,/catch\(error\)\{primaryFailure=error;throw error;\}finally/);assert.match(proof,/await restoreObservedSql\(cleanups,report,primaryFailure\)/);
 for(const assertion of ['ownReview','peerReview','PEER_EXPORT_SECRET','CROSS_PARENT_SECRET','OWN_POINT_ADDRESS','bytesIncluded,false','measuredProviderCharge,false',"observedSql('ALLOCATION_COUNT'"])assert.ok(proof.includes(assertion));
 assert.equal(createHash('sha256').update(source).digest('hex'),SNAPSHOT136_SOURCE.migrationSha256);
});

// This control is explicitly authorized separately from the unchanged clones.
test('one actual function control disables JIT only locally before planning, with the exact same bound values and original20s',()=>{
 const commands=buildSnapshotDiagnostics(source,params()),sql=commands.EXECUTE_FUNCTION_LOCAL_JIT_OFF;
 assert.ok(sql.startsWith('begin read only;\nset local search_path=pg_catalog;\nset local jit=off;\nprepare '));
 assert.match(sql,/select private\.data_export_snapshot\(\$1::uuid,\$2::uuid,\$3::jsonb,\$4::timestamptz\);/);
 assert.ok(sql.endsWith('\nrollback;'));assert.ok(!/\b(?:create|alter|drop|analyze)\b/i.test(sql));
 assert.equal(sql.slice(sql.indexOf('execute uskoci_snapshot136(')),commands.EXECUTE_ORIGINAL.slice(commands.EXECUTE_ORIGINAL.indexOf('execute uskoci_snapshot136(')));
 assert.equal(Object.values(commands).filter(value=>value.includes('set local jit=off;')).length,1);assert.equal(OBSERVED_SQL_LIMITS.queryMs,20000);
});

test('even a frozen diagnostic report cannot replace the original canonical error',async()=>{
 const f=transport(),original=new ObservedSqlError('SNAPSHOT_FULL','ETIMEDOUT',null);f.options.report=Object.freeze({});
 await assert.rejects(rethrowSnapshotFailure(original,f.options),error=>error===original);assert.equal(f.calls.length,0);
});
