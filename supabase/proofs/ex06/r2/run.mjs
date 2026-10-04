// Only disposable loopback. No connector/DEV credentials are read.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {build} from './build.mjs';
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL,process.env.DB_URL);
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
const root=process.cwd(),out=process.env.EX06E_R2_DIR??'/tmp/ex06e-r2',privateDir=process.env.PRE_V3_ARTIFACT_DIR;
assert.ok(privateDir);fs.mkdirSync(out,{recursive:true});fs.mkdirSync(privateDir,{recursive:true});
function command(exe,args,log,timeout=600000){const fd=fs.openSync(log,'w',0o600);try{execFileSync(exe,args,{stdio:['ignore',fd,fd],timeout,env:process.env});}finally{fs.closeSync(fd);}}
const phase=process.argv[2];
if(phase==='replay'){
 const stages=[['python3','supabase/proofs/pkg023j/replay_source147.py'],
 ...['027','028','029','030','031','032','033','034','035','037','038','039','040','042'].map(n=>['node',`supabase/proofs/pkg${n}/pkg${n}_proof.mjs`,'replay']),
 ['node','supabase/proofs/pkg050/pkg050_proof.mjs'],['psql',process.env.DB_URL,'-X','-q','-v','ON_ERROR_STOP=1','-f','supabase/candidates/ex06a_flexible_window.sql']];
 for(let i=0;i<stages.length;i++){const [exe,...args]=stages[i],name=String(i).padStart(2,'0');command(exe,args,path.join(privateDir,'r2-replay-'+name+'.log'));fs.appendFileSync(path.join(out,'replay.txt'),name+' PASS\n');console.log('PASS replay '+name);}
}else if(phase==='prove'){
 const built=build(root,out),manifest=built.manifest;
 const psqlArgs=[process.env.DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1'];
 const query=s=>execFileSync('psql',psqlArgs,{input:s,encoding:'utf8',timeout:30000}).trim();
 const catalog=()=>query("select md5(string_agg((to_jsonb(p)-'oid')::text,E'\\n' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public');");
 const state=()=>JSON.parse(query(`select jsonb_build_object('wave',md5((select replace(prosrc,E'\\r','') from pg_proc where oid=to_regprocedure('private.dispatch_next_wave(uuid)'))),'tick',md5((select replace(prosrc,E'\\r','') from pg_proc where oid=to_regprocedure('private.dispatch_tick(integer,timestamptz)'))),'cancel',md5((select replace(prosrc,E'\\r','') from pg_proc where oid=to_regprocedure('public.rpc_cancel_agreement(uuid,text)'))),'timeHelper',md5((select replace(prosrc,E'\\r','') from pg_proc where oid=to_regprocedure('private.need_search_time_admitted_v1(uuid,timestamptz)'))),'reopen',md5((select replace(prosrc,E'\\r','') from pg_proc where oid=to_regprocedure('${manifest.newReopenSignature}'))),'oldReopenAbsent',to_regprocedure('public.rpc_reopen_remaining_search(uuid,integer,text,text)') is null,'certificate',private.closure_source_digest_v5(),'certified',(select sha256 from private.closure_source_v5 where singleton),'ready',private.retention_ai_source_ready());`));
 const write=(n,x)=>fs.writeFileSync(path.join(out,n),JSON.stringify(x,null,2)+'\n');
 const dependencies=()=>JSON.parse(query(`select jsonb_agg(jsonb_build_object('signature',signature,'body',p.prosrc,'bodyMd5',md5(replace(p.prosrc,E'\\r','')),'definition',pg_get_functiondef(p.oid),'metadata',to_jsonb(p)-'prosrc') order by signature) from unnest(array['public.rpc_close_remaining_search(uuid,integer,text,text)','private.guard_remaining_search_close_fields()','private.relative_schedule_end_v5(text,timestamptz,text)']) signature left join pg_proc p on p.oid=to_regprocedure(signature);`));
 const before=state(),catBefore=catalog();write('before.json',before);write('dependencies-before-baseline.json',dependencies());
 command('node',['supabase/proofs/ex06/r2/baseline.mjs','before'],path.join(out,'baseline-before.log'));
 write('dependencies-after-baseline.json',dependencies());
 command('psql',[...psqlArgs,'-f',path.join(out,'candidate.sql')],path.join(out,'apply.log'),60000);
 const applied=state();write('applied.json',applied);
 for(const [key,value] of Object.entries(manifest.functions))assert.equal(applied[key],value);
 assert.equal(applied.oldReopenAbsent,true);assert.equal(applied.certificate,before.certificate);assert.equal(applied.certificate,applied.certified);assert.equal(applied.ready,true);
 command('node',['supabase/proofs/ex06/ex06e_r2_generated_proof.mjs'],path.join(out,'behavior.log'));
 const report=JSON.parse(fs.readFileSync(path.join(process.env.EX06E_ARTIFACT_DIR,'ex06e-lifecycle-recovery-report.json'),'utf8'));
 assert.equal(report.result,'PASS');assert.equal(report.scenarios.length,16);assert.ok(report.scenarios.every(x=>x.status==='PASS'));assert.equal(report.sourceSha,process.env.GITHUB_SHA);
 write('behavior-report.json',report);
 const catApplied=catalog(),refusals=[];
 function refused(name,input,expected){
   let error;try{execFileSync('psql',psqlArgs,{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']});}catch(e){error=e;}
   assert.ok(error,name+' WAS NOT REFUSED');assert.ok(String(error.stderr).includes(expected),name+' WRONG FAILURE: '+String(error.stderr).slice(-1500));assert.equal(catalog(),catApplied);refusals.push({name,expected,catalogUnchanged:true});
 }
 refused('duplicate candidate',built.candidate,'EX06E_ALREADY_OR_PARTIALLY_APPLIED');
 const drift=signature=>`do $drift$ declare d text;b text;begin select prosrc into b from pg_proc where oid=to_regprocedure('${signature}');d:=pg_get_functiondef(to_regprocedure('${signature}'));execute replace(d,b,b||E'\\n-- R2 intentional disposable drift\\n');end $drift$;`;
 for(const signature of ['private.need_search_time_admitted_v1(uuid,timestamptz)',manifest.newReopenSignature])refused('new body '+signature,'begin;'+drift(signature)+built.revert,'EX06E_R2_NEW_FUNCTION_DRIFT');
 refused('new grants','begin;grant execute on function '+manifest.newReopenSignature+' to anon;'+built.revert,'EX06E_R2_NEW_FUNCTION_DRIFT');
 refused('new volatility','begin;alter function private.need_search_time_admitted_v1(uuid,timestamptz) volatile;'+built.revert,'EX06E_R2_NEW_FUNCTION_DRIFT');
 write('refusals.json',refusals);
 command('psql',[...psqlArgs,'-f',path.join(out,'revert.sql')],path.join(out,'revert.log'),60000);
 const reverted=state();write('reverted.json',reverted);assert.deepEqual(reverted,before);assert.equal(catalog(),catBefore);
 command('node',['supabase/proofs/ex06/r2/baseline.mjs','after-revert'],path.join(out,'baseline-after-revert.log'));
 // Reapplying the exact package is repeatable; no user history is deleted by code rollback.
 command('psql',[...psqlArgs,'-f',path.join(out,'candidate.sql')],path.join(out,'reapply.log'),60000);assert.deepEqual(state(),applied);
 command('psql',[...psqlArgs,'-f',path.join(out,'revert.sql')],path.join(out,'final-revert.log'),60000);assert.deepEqual(state(),before);assert.equal(catalog(),catBefore);
 write('verdict.json',{result:'PASS',source:process.env.GITHUB_SHA,groups:16,refusals:refusals.length,failBeforePassAfterFailAfterRevert:true,reapply:true,exactCodeAndMetadataRevert:true,devApplied:false,acceptedAgreementTimeSemantics:'NOT_EXPANDED_OR_CLOSED_BY_THIS_PACKAGE'});
 console.log('PASS EX06E R2: 16 groups, refusal guards, original failure before/after revert, reapply and exact code rollback');
}else throw new Error('R2_UNKNOWN_PHASE');
