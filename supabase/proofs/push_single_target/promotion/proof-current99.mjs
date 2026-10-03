// Loopback only. Exact AI-location predecessor, then the same promotion generator with an explicit fixture binding.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {diagnosticSql,withProjectedDigests,compareSurface} from './cert-surface-diagnostic.mjs';
for(const key of ['PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGOPTIONS'])assert.ok(!process.env[key],'PG_OVERRIDE');
assert.equal(process.env.PUSH_SINGLE_TARGET_DISPOSABLE,'SINGLE_TARGET_V1');
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env.GITHUB_SHA);
const rt=await import(pathToFileURL(resolve('supabase/proofs/pre_v3/closure_runtime.mjs')));
assert.equal(process.env.DB_URL,process.env.RU5_DEVICE_DB_URL);
const {SQL}=await import(pathToFileURL(resolve('supabase/proofs/ex05_s01/lib/sql_snippets.mjs')));
const {sanitizeMessage}=await import(pathToFileURL(resolve('supabase/proofs/ex05_s01/lib/runner.mjs')));
const dir=dirname(fileURLToPath(import.meta.url)),out=join(rt.out,'current99-fixture');mkdirSync(out,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex'),q=rt.q;
const report={unit:'SINGLE_TARGET_CURRENT99_PROMOTION',result:'RUNNING',sourceSha:process.env.GITHUB_SHA,liveAccess:false,providerCalled:false,admissionCreated:false,sources:{},checks:[]};
const read=p=>{const b=readFileSync(p),rel=relative(process.cwd(),p).replaceAll('\\','/');assert.deepEqual(b,execFileSync('git',['show',process.env.GITHUB_SHA+':'+rel]),'COMMITTED_SOURCE:'+rel);report.sources[rel]=sha(b);return b.toString('utf8');};
const json=n=>JSON.parse(read(join(dir,n))),write=(n,v)=>writeFileSync(join(out,n),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const observe=(s,publicNames=false)=>JSON.parse(rt.sql('set search_path='+(publicNames?'public,pg_catalog':'pg_catalog')+';'+s));
const metadata="to_jsonb(p)-'oid'-'pronamespace'-'proowner'-'prolang'-'prosrc'||jsonb_build_object('namespace',n.nspname,'owner',pg_get_userbyid(p.proowner),'language',l.lanname)";
const portable=m=>{const v={...m};for(const k of ['proargtypes','proallargtypes','prorettype','prosupport','protrftypes'])delete v[k];return v;};
try{
 read(fileURLToPath(import.meta.url));read(join(dir,'build-promotion.mjs'));
 const live=json('live-preflight-capture.json'),liveCert=json('live-certificate-checked.json');
 const receipt=JSON.parse(read('supabase/operations/dev-alpha/ledger/20261002_ai_location_01_application.receipt.json'));
 const ledger=read('supabase/operations/dev-alpha/ledger/20261002185306_dev_alpha_ai_location_01_contextual_map_dialogue.sql');
 // Only receipt-proven byte reconstruction is allowed. Never substitute SQL definitions or certificate pins.
 const variants=[ledger,ledger.replaceAll('\r\n','\n').replaceAll('\n','\r\n')];
 const application=variants.find(v=>sha(v)===receipt.migration.sha256&&v.length===receipt.migration.chars);
 assert.ok(application,'EXACT_APPLIED_LOCATION_BYTES_UNAVAILABLE');report.locationApplicationSha=sha(application);
 rt.sql(SQL.pauseSchedulers());
 read(join(dir,'cert-surface-diagnostic.mjs'));
 const expectedSurface=json('expected-prelocation-surface.json');
 assert.equal(expectedSurface.projectedProgramDigest,'2fe2edc126edc9a9b08b4e3cfce758ff928c99d377a0df3b04bd49961cc4a078');
 assert.equal(expectedSurface.projectedSourceDigest,'0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431');
 const oldSource=read('supabase/candidates/ai-location-01-20261002/before-sql/private.closure_source_digest_v5.sql'),oldProgram=read('supabase/candidates/ai-location-01-20261002/before-sql/private.closure_erasure_program_digest_v5.sql');
 const observedSurface=observe(withProjectedDigests(diagnosticSql(oldSource,oldProgram)));
 report.certSurface=compareSurface(expectedSurface,observedSurface);
 report.certSurface.projectedSourceDigest=observedSurface.projectedSourceDigest;report.certSurface.projectedProgramDigest=observedSurface.projectedProgramDigest;
 assert.equal(observedSurface.projectedSourceDigest,observedSurface.components.sourceDigest,'DIAGNOSTIC_RECONSTRUCTION_MUST_MATCH_ACTUAL');
 assert.equal(observedSurface.projectedProgramDigest,observedSurface.components.programDigest,'DIAGNOSTIC_PROGRAM_MUST_MATCH_ACTUAL');
 const readyBefore=read('supabase/candidates/ai-location-01-20261002/before-sql/private.retention_ai_source_ready.sql');
 const md5=x=>createHash('md5').update(x).digest('hex'),lf=x=>x.replaceAll('\r\n','\n');
 assert.equal(md5(readyBefore),'f8fb9f2e24f2432b302d7ee87c83a814','IMMUTABLE_READY_PREIMAGE');
 const predecessorDigest='0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431';
 const readyObservation=()=>observe(`select jsonb_build_object('definition',pg_get_functiondef(p.oid),'metadata',${metadata},'digest',private.closure_source_digest_v5(),'source',(select sha256 from private.closure_source_v5 where singleton),'erasure',(select sha256 from private.closure_erasure_source_v5 where singleton),'bindingSource',private.closure_erasure_binding_v5()->>'sourceSha256','ready',private.retention_ai_source_ready()) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where p.oid='private.retention_ai_source_ready()'::regprocedure`,true);
 const prior=readyObservation(),expectedLines=lf(readyBefore).split('\n'),actualLines=lf(prior.definition).split('\n');
 const firstDifferent=expectedLines.findIndex((line,i)=>line!==actualLines[i]);
 report.locationPredecessor={expectedDefinitionMd5:md5(readyBefore),observedDefinitionMd5:md5(prior.definition),expectedLfMd5:md5(lf(readyBefore)),observedLfMd5:md5(lf(prior.definition)),observedCR:prior.definition.split('\r').length-1,expectedCR:readyBefore.split('\r').length-1,firstDifferentLfLine:firstDifferent<0?(expectedLines.length===actualLines.length?null:expectedLines.length+1):firstDifferent+1,digest:prior.digest,source:prior.source,erasure:prior.erasure,bindingSource:prior.bindingSource,ready:prior.ready,newlineRestore:false};
 // A fixture-only byte-fidelity repair, never a digest or pin substitution. Every other mismatch aborts with bounded diagnostics above.
 assert.equal(prior.digest,predecessorDigest,'LOCATION_PREDECESSOR_DIGEST_DIAGNOSTIC');
 assert.equal(prior.source,predecessorDigest);assert.equal(prior.erasure,predecessorDigest);assert.equal(prior.bindingSource,predecessorDigest);assert.equal(prior.ready,true);
 assert.deepEqual(portable(prior.metadata),portable(live.functions.find(f=>f.signature==='private.retention_ai_source_ready()').metadata),'READY_PREDECESSOR_METADATA');
 if(prior.definition!==readyBefore){
  assert.equal(lf(prior.definition),lf(readyBefore),'READY_PREDECESSOR_NOT_NEWLINE_ONLY');
  rt.sql(readyBefore.trimEnd().replace(/;$/,'')+';');
  const restored=readyObservation();assert.equal(restored.definition,readyBefore,'READY_EXACT_BYTE_RESTORE');
  assert.deepEqual({...restored,definition:prior.definition},prior,'READY_RESTORE_CHANGED_OTHER_STATE');
  report.locationPredecessor.newlineRestore=true;
 }
 rt.sql(application);report.checks.push({name:'EXACT_APPLIED_AI_LOCATION_PREDECESSOR',result:'PASS'});
 const signatures=live.functions.map(f=>f.signature.startsWith('private.')?f.signature.replace('(notification_deliveries)','(public.notification_deliveries)'):'public.'+f.signature);
 const captured=observe(`select jsonb_build_object('checked_at',clock_timestamp(),'current_user',current_user,'version',version(),'ledger_count',(select count(*) from supabase_migrations.schema_migrations),'functions',(select jsonb_agg(jsonb_build_object('signature',e.signature,'definition',pg_get_functiondef(p.oid),'bodyMd5',md5(replace(p.prosrc,chr(13),'')),'metadata',${metadata}) order by e.ord) from unnest(array[${signatures.map(q)}]) with ordinality e(signature,ord) join pg_proc p on p.oid=to_regprocedure(e.signature) join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang),'source_row',(select to_jsonb(c) from private.closure_source_v5 c where singleton),'erasure_row',(select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton),'datasets',(select jsonb_agg(to_jsonb(c) order by data_class) from private.closure_dataset_catalog_v5 c),'export_catalog',private.data_export_dataset_catalog())`,true);
 assert.equal(captured.functions.length,live.functions.length);
 for(let i=0;i<live.functions.length;i++){
  const a=live.functions[i],b=captured.functions[i];assert.equal(b.bodyMd5,a.bodyMd5,'CURRENT_DEV_BODY:'+signatures[i]);
  assert.equal(b.definition,a.definition,'CURRENT_DEV_FULL_DEFINITION:'+signatures[i]);
  assert.deepEqual(portable(b.metadata),portable(a.metadata),'CURRENT_DEV_PORTABLE_METADATA:'+signatures[i]);
 }
 const cert=observe("select jsonb_build_object('checked_at',clock_timestamp(),'computed_digest',private.closure_source_digest_v5(),'ready',private.retention_ai_source_ready(),'binding',private.closure_erasure_binding_v5())");
 assert.equal(cert.computed_digest,liveCert.computed_digest,'CURRENT99_CERTIFICATE_EXACT');assert.equal(cert.ready,true);assert.deepEqual(cert.binding,liveCert.binding);
 assert.equal(captured.source_row.sha256,cert.computed_digest);assert.equal(captured.erasure_row.sha256,cert.computed_digest);
 const surfaceSql=read(join(dir,'surface.readonly.sql'));const surface=observe(`select jsonb_build_object('surface',surface,'surface_md5',md5(surface::text)) from (${surfaceSql})s`);
 // Local catalog OIDs, ledger length, certificate timestamps and fixture rows are bound locally only AFTER exact current body/schema certificate equivalence.
 report.fixtureBinding={definitionCount:captured.functions.length,currentDigest:cert.computed_digest,ledgerRows:captured.ledger_count,surfaceMd5:surface.surface_md5,allowedLocalIdentityFields:['catalog OIDs','ledger row count','certificate row timestamps','synthetic fixture row counts']};
 write('live-preflight-capture.json',captured);write('live-certificate-checked.json',cert);write('live-surface-capture.json',surface);
 write('live-edge-capture.json',json('live-edge-capture.json'));write('surface.readonly.sql',surfaceSql);write('build-promotion.mjs',read(join(dir,'build-promotion.mjs')));
 write('fixture-admission.json',{kind:'EXACT_99_LOOPBACK_CAPTURE'});
 execFileSync(process.execPath,[join(dir,'build-promotion.mjs'),'--fixture-directory',out],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const generated=n=>readFileSync(join(out,n),'utf8');const pre=JSON.parse(rt.sql(generated('preflight.readonly.sql')));assert.deepEqual(pre.problems,[]);
 const before=observe("select jsonb_build_object('digest',private.closure_source_digest_v5(),'source',(select to_jsonb(c) from private.closure_source_v5 c where singleton),'erasure',(select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton),'ready',private.retention_ai_source_ready())");
 rt.sql(generated('candidate.sql'));const installed=JSON.parse(rt.sql(generated('postflight.readonly.sql')));assert.deepEqual(installed.problems,[]);assert.equal(installed.sourceRoster,108);
 rt.sql(generated('revert-before-admission.sql'));assert.deepEqual(JSON.parse(rt.sql(generated('preflight.readonly.sql'))).problems,[]);
 const restored=observe("select jsonb_build_object('digest',private.closure_source_digest_v5(),'source',(select to_jsonb(c) from private.closure_source_v5 c where singleton),'erasure',(select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton),'ready',private.retention_ai_source_ready())");assert.deepEqual(restored,before);
 rt.sql(generated('candidate.sql'));const reapplied=JSON.parse(rt.sql(generated('postflight.readonly.sql')));assert.deepEqual(reapplied.problems,[]);assert.equal(reapplied.computedDigest,installed.computedDigest);assert.deepEqual(reapplied.sourceRow,installed.sourceRow);assert.deepEqual(reapplied.erasureRow,installed.erasureRow);
 // Return exactly to99 so the existing13-group behavior proof exercises its unchanged installer on the actual99 predecessor.
 rt.sql(generated('revert-before-admission.sql'));assert.deepEqual(JSON.parse(rt.sql(generated('preflight.readonly.sql'))).problems,[]);
 report.checks.push({name:'CURRENT99_WRAPPER_INSTALL_REVERT_REAPPLY_EXACT',result:'PASS'});report.promotedDigest=installed.computedDigest;report.roster={before:99,after:108};report.generated=JSON.parse(generated('PROMOTION_MANIFEST.json')).files;report.result='PASS';
}catch(error){report.result='FAIL';report.failure=sanitizeMessage(error);process.exitCode=1;console.error(report.failure);}
finally{writeFileSync(join(rt.out,'single-target-current99-promotion.json'),JSON.stringify(report,null,2)+'\n');console.log(report.result+' current99 promotion');}
