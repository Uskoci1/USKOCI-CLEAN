// Combined R3 proof uses only the existing isolated loopback stack.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import {build,readerSignatures,relativeSignature} from './build.mjs';
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL,process.env.DB_URL);assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
const out=process.env.EX06E_R3_DIR,root=process.cwd();assert.ok(out);fs.mkdirSync(out,{recursive:true});
const args=[process.env.DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1'];
const query=s=>execFileSync('psql',args,{input:s,encoding:'utf8',timeout:30000}).trim();
const write=(n,x)=>fs.writeFileSync(path.join(out,n),JSON.stringify(x,null,2)+'\n');
function run(exe,argv,name,timeout=600000){const fd=fs.openSync(path.join(out,name),'w',0o600);try{execFileSync(exe,argv,{stdio:['ignore',fd,fd],env:process.env,timeout});}finally{fs.closeSync(fd);}}
const cat=()=>query("select md5(string_agg((to_jsonb(p)-'oid')::text,E'\\n' order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public');");
const signatures=[relativeSignature,...readerSignatures,'private.dispatch_next_wave(uuid)','private.dispatch_tick(integer,timestamptz)','public.rpc_cancel_agreement(uuid,text)','private.need_search_time_admitted_v1(uuid,timestamptz)','public.rpc_reopen_remaining_search(uuid,integer,timestamptz,text,text)'];
const state=()=>JSON.parse(query(`select jsonb_build_object('functions',(select jsonb_object_agg(s,md5(replace(p.prosrc,E'\\r',''))) from unnest(array[${signatures.map(s=>"'"+s+"'").join(',')}]) s left join pg_proc p on p.oid=to_regprocedure(s)),'certificate',private.closure_source_digest_v5(),'certified',(select sha256 from private.closure_source_v5 where singleton),'ready',private.retention_ai_source_ready(),'oldWeekPastCalendarEnd',private.relative_schedule_end_v5('WEEK_FLEXIBLE','2030-01-06T12:00:00Z','Europe/Belgrade')>'2030-01-06T23:00:00Z');`));
const built=await build(root,out),before=state(),beforeCat=cat();write('before.json',before);assert.equal(before.oldWeekPastCalendarEnd,true);
run('node',['supabase/proofs/ex06/r2/baseline.mjs','before'],'baseline-before.log');
run('psql',[...args,'-f',path.join(out,'candidate.sql')],'apply.log',60000);
const applied=state();write('applied.json',applied);assert.equal(applied.oldWeekPastCalendarEnd,false);assert.equal(applied.certificate,before.certificate);assert.equal(applied.ready,true);
assert.equal(applied.functions[relativeSignature],built.manifest.relativeHash);
for(const spec of built.manifest.readers)assert.equal(applied.functions[spec.sig],spec.bodyMd5);
run('node',['supabase/proofs/ex06/ex06e_r3_generated_proof.mjs'],'behavior.log');
const report=JSON.parse(fs.readFileSync(path.join(process.env.EX06E_ARTIFACT_DIR,'ex06e-lifecycle-recovery-report.json'),'utf8'));
assert.equal(report.result,'PASS');assert.equal(report.sourceSha,process.env.GITHUB_SHA);assert.equal(report.scenarios.length,22);assert.ok(report.scenarios.every(s=>s.status==='PASS'));write('behavior-report.json',report);
const appliedCat=cat(),refusals=[];
function refused(label,text,expected){let e;try{execFileSync('psql',args,{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000});}catch(error){e=error;}assert.ok(e,label+' NOT REFUSED');assert.ok(String(e.stderr).includes(expected),label+' WRONG REFUSAL: '+String(e.stderr).slice(-700));assert.equal(cat(),appliedCat);refusals.push({label,expected,catalogUnchanged:true});}
const drift=s=>`do $drift$ declare d text;b text;begin select prosrc into b from pg_proc where oid=to_regprocedure('${s}');d:=pg_get_functiondef(to_regprocedure('${s}'));execute replace(d,b,b||E'\\n-- R3 disposable drift\\n');end $drift$;`;
refused('duplicate combined candidate',built.candidate,'EX06E_ALREADY_OR_PARTIALLY_APPLIED');
for(const s of ['private.need_search_time_admitted_v1(uuid,timestamptz)',built.manifest.newReopenSignature])refused('R2 function drift '+s,'begin;'+drift(s)+built.revert,'EX06E_R2_NEW_FUNCTION_DRIFT');
refused('R2 grants','begin;grant execute on function '+built.manifest.newReopenSignature+' to anon;'+built.revert,'EX06E_R2_NEW_FUNCTION_DRIFT');
refused('R2 volatility','begin;alter function private.need_search_time_admitted_v1(uuid,timestamptz) volatile;'+built.revert,'EX06E_R2_NEW_FUNCTION_DRIFT');
for(const s of readerSignatures)refused('reader body drift '+s,'begin;'+drift(s)+built.revert,'R3_READER_DRIFT');
refused('reader grant drift','begin;grant execute on function '+readerSignatures[0]+' to anon;'+built.revert,'R3_READER_DRIFT');
refused('relative helper drift','begin;'+drift(relativeSignature)+built.revert,'R3_RELATIVE_REVERT_DRIFT');write('refusals.json',refusals);
run('psql',[...args,'-f',path.join(out,'revert.sql')],'revert.log',60000);const reverted=state();write('reverted.json',reverted);assert.deepEqual(reverted,before);assert.equal(cat(),beforeCat);
run('node',['supabase/proofs/ex06/r2/baseline.mjs','after-revert'],'baseline-after-revert.log');
run('psql',[...args,'-f',path.join(out,'candidate.sql')],'reapply.log',60000);assert.deepEqual(state(),applied);
run('psql',[...args,'-f',path.join(out,'revert.sql')],'final-revert.log',60000);assert.deepEqual(state(),before);assert.equal(cat(),beforeCat);
write('verdict.json',{result:'PASS',source:process.env.GITHUB_SHA,groups:22,refusals:refusals.length,originalFailureBeforeAndAfterRevert:true,calendarMismatchBeforeAndAfterRevert:true,exactCodeMetadataRevert:true,reapply:true,currentStateReadOnly:true,receiptReadNeverExecutesCommand:true,devApplied:false,limits:['No APK/UI integration or phone/provider proof','No new separate replacement entitlement or 24h window','Replayed dependency chain is bounded, not full latest DEV equivalence']});
console.log('PASS EX06E R3 22 groups, calendar parity, owner readback, nine drift refusals, exact revert');
