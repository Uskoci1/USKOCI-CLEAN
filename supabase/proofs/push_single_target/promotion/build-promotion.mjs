// Pure source generation from read-only DEV captures and the exact passing source.
// Never opens a database, reads credentials, deploys, admits, or sends.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const packageRoot=dirname(fileURLToPath(import.meta.url)),repo=process.cwd();
assert.ok(process.argv.length===2||(process.argv.length===4&&process.argv[2]==='--fixture-directory'),'GENERATOR_ARGUMENTS');
const fixture=process.argv.length===4,root=fixture?resolve(process.argv[3]):packageRoot;
if(fixture){assert.equal(process.env.PUSH_SINGLE_TARGET_DISPOSABLE,'SINGLE_TARGET_V1');assert.equal(JSON.parse(readFileSync(join(root,'fixture-admission.json'),'utf8')).kind,'EXACT_99_LOOPBACK_CAPTURE');}
const source='74cdca32bc48b9dfb95622bdd26920878797b805',packagePath='supabase/proofs/push_single_target/';
const read=n=>readFileSync(join(root,n),'utf8'),json=n=>JSON.parse(read(n));
const q=s=>"'"+String(s).replaceAll("'","''")+"'",sha=s=>createHash('sha256').update(s).digest('hex'),md5=s=>createHash('md5').update(s).digest('hex');
const write=(name,content)=>{assert.ok(!content.includes('\r'),'OUTER_SQL_MUST_BE_LF:'+name);mkdirSync(dirname(join(root,name)),{recursive:true});writeFileSync(join(root,name),content);};
const frozen=name=>execFileSync('git',['show',source+':'+packagePath+name],{cwd:repo,encoding:'utf8'});
const helperPath=resolve(repo,packagePath,'certificate-proof.mjs');assert.equal(sha(readFileSync(helperPath,'utf8').replaceAll('\r\n','\n')),sha(frozen('certificate-proof.mjs')));
const {extendRosters,installWithCertificate,revertWithCertificate}=await import(pathToFileURL(helperPath));
const capture=json('live-preflight-capture.json'),cert=json('live-certificate-checked.json'),surface=json('live-surface-capture.json'),edge=json('live-edge-capture.json'),manifest=JSON.parse(frozen('MANIFEST.json'));
const qualify=s=>/^(private|public)\./.test(s)?s.replace('(notification_deliveries)','(public.notification_deliveries)'):'public.'+s;
const functions=new Map(capture.functions.map(f=>[qualify(f.signature),f]));
const definition=s=>functions.get(s).definition;
const before={digest:cert.computed_digest,ready:cert.ready,binding:cert.binding,source_row:capture.source_row,erasure_row:capture.erasure_row,datasets:capture.datasets,export_catalog:capture.export_catalog,
 source_definition:definition('private.closure_source_digest_v5()'),program_definition:definition('private.closure_erasure_program_digest_v5()'),ready_definition:definition('private.retention_ai_source_ready()')};
assert.equal(before.digest,before.source_row.sha256);assert.equal(before.digest,before.erasure_row.sha256);assert.equal(before.binding.sourceSha256,before.digest);assert.equal(before.ready,true);
const roster=extendRosters(before.source_definition,before.program_definition);assert.equal(roster.priorCount,99,'CAPTURED_CURRENT_DEV_ROSTER');assert.equal(roster.nextCount,108);
const expr=d=>`convert_from(decode(${q(Buffer.from(d,'utf8').toString('base64'))},'base64'),'UTF8')`;
const execDefinition=d=>`do $exact_definition$ begin execute ${expr(d)};end $exact_definition$;`;
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'EXACT_ANCHOR:'+a.slice(0,70));return s.replace(a,b);};
function encodeDefinitions(text,defs){for(const d of defs){const variants=[d,d.trimEnd(),d.replaceAll('\r\n','\n'),d.replaceAll('\r\n','\n').trimEnd()];const found=variants.find(v=>text.includes(v));assert.ok(found,'EXACT_DEFINITION_MISSING:'+d.slice(0,100));text=once(text,found,execDefinition(d));}return text;}
const oldTransport=['public.rpc_claim_push_transport(text)','public.rpc_begin_push_send(uuid,uuid)','public.rpc_complete_push_transport(uuid,uuid,text,text)'].map(definition);
const sourceQuery=read('surface.readonly.sql').trim();
const surfaceCheck=`(select md5(surface::text) from (${sourceQuery}) surface_check)`;
const newColumns=['single_target_admission','single_target_claimed_at','single_target_authorization_id'];
const newConstraints=['push_single_target_shape_v1','push_single_target_claim_shape_v1','push_single_target_authorization_v1','push_single_target_authorization_shape_v1'];
let projected=sourceQuery.replace('and not a.attisdropped)',`and not a.attisdropped and not (c.oid='public.notification_push_attempts'::regclass and a.attname=any(array[${newColumns.map(q)}])))`)
 .replace('where conrelid=c.oid)',`where conrelid=c.oid and not (c.oid='public.notification_push_attempts'::regclass and conname=any(array[${newConstraints.map(q)}])))`)
 .replace('where indrelid=c.oid)',"where indrelid=c.oid and indexrelid is distinct from to_regclass('public.push_single_target_authorization_v1'))");
assert.notEqual(projected,sourceQuery);
const metadataExpression="(to_jsonb(p)-'oid'-'pronamespace'-'proowner'-'prolang'-'prosrc'||jsonb_build_object('namespace',n.nspname,'owner',pg_get_userbyid(p.proowner),'language',l.lanname))";
const metadataValues=[...functions].map(([s,f])=>`(${q(s)},${q(JSON.stringify(f.metadata))}::jsonb)`).join(',\n');
const metadataProblem=`select 'FUNCTION_METADATA_DRIFT:'||e.signature problem from (values ${metadataValues}) e(signature,expected) left join pg_proc p on p.oid=to_regprocedure(e.signature) left join pg_namespace n on n.oid=p.pronamespace left join pg_language l on l.oid=p.prolang where ${metadataExpression} is distinct from e.expected`;
const priorBodies=[...functions].map(([s,f])=>`(${q(s)},${q(f.bodyMd5)})`).join(',\n');
const currentBodies=`select 'FUNCTION_BODY_DRIFT:'||e.signature problem from (values ${priorBodies})e(signature,expected) left join pg_proc p on p.oid=to_regprocedure(e.signature) where md5(replace(p.prosrc,chr(13),'')) is distinct from e.expected`;
const newSignatures=Object.keys(manifest.newFunctionBodyMd5).filter(s=>s.includes('single_target'));
const drain=`select 'ACTIVE_SEND_OR_LEASE' problem where exists(select 1 from public.notification_push_attempts where lease_until>clock_timestamp() or transport_state='SEND_STARTED') union all select 'CLOSURE_EXECUTING' where exists(select 1 from private.closure_executions_v5 where state='EXECUTING')`;
const catalogUnchanged=`select 'DATASET_CATALOG_DRIFT' problem where (select jsonb_agg(to_jsonb(c) order by data_class) from private.closure_dataset_catalog_v5 c) is distinct from ${q(JSON.stringify(before.datasets))}::jsonb union all select 'EXPORT_CATALOG_DRIFT' where private.data_export_dataset_catalog() is distinct from ${q(JSON.stringify(before.export_catalog))}::jsonb`;
const beforeCert=`select 'CERTIFICATE_PREDECESSOR_DRIFT' problem where private.closure_source_digest_v5() is distinct from ${q(before.digest)} or private.retention_ai_source_ready() is distinct from true or private.closure_erasure_binding_v5() is distinct from ${q(JSON.stringify(before.binding))}::jsonb or (select to_jsonb(c) from private.closure_source_v5 c where singleton) is distinct from ${q(JSON.stringify(before.source_row))}::jsonb or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) is distinct from ${q(JSON.stringify(before.erasure_row))}::jsonb`;
const preProblems=[metadataProblem,currentBodies,drain,catalogUnchanged,beforeCert,
 `select 'TABLE_SURFACE_DRIFT' where ${surfaceCheck} is distinct from ${q(surface.surface_md5)}`,
 `select 'CANDIDATE_ALREADY_PRESENT:'||s from unnest(array[${newSignatures.map(q)}])s where to_regprocedure(s) is not null`,
 `select 'CANDIDATE_COLUMN_PRESENT:'||attname from pg_attribute where attrelid='public.notification_push_attempts'::regclass and not attisdropped and attname=any(array[${newColumns.map(q)}])`,
 `select 'LEDGER_DRIFT_RECAPTURE_REQUIRED' where (select count(*) from supabase_migrations.schema_migrations)<>${capture.ledger_count}`].join('\nunion all\n');
const preflight=`with problems as (${preProblems}) select jsonb_build_object('package','PUSH_SINGLE_TARGET_V1','projectRef','leqcwgzvjsxugfgzdmth','sourceSha',${q(source)},'checkedAt',clock_timestamp(),'problems',coalesce((select jsonb_agg(problem order by problem) from problems),'[]'::jsonb),'sourceRoster',${roster.priorCount},'candidateAbsent',true,'storedDigest',${q(before.digest)},'ledgerRows',(select count(*) from supabase_migrations.schema_migrations),'admissionCreated',false) result`;
write('preflight.readonly.sql',`begin read only;set local search_path=pg_catalog;set local statement_timeout='30s';\n${preflight};\nrollback;\n`);
const bodyOf=d=>{const mark=d.match(/\bAS (\$\w*\$)/i)[1];return d.slice(d.indexOf(mark)+mark.length,d.lastIndexOf(mark));};
const sourcePins=[['private.closure_source_digest_v5()',md5(bodyOf(roster.sourceNext))],['private.closure_erasure_program_digest_v5()',md5(bodyOf(roster.programNext))]];
const postBodyValues=Object.entries(manifest.newFunctionBodyMd5).map(([s,m])=>`(${q(s)},${q(m)})`).join(',');
const postProblems=[metadataProblem,drain,catalogUnchanged,
 `select 'POST_BODY_DRIFT:'||e.signature from(values ${postBodyValues})e(signature,expected) left join pg_proc p on p.oid=to_regprocedure(e.signature) where md5(replace(p.prosrc,chr(13),'')) is distinct from e.expected`,
 `select 'ROSTER_BODY_DRIFT:'||e.signature from(values ${sourcePins.map(([s,m])=>`(${q(s)},${q(m)})`).join(',')})e(signature,expected) left join pg_proc p on p.oid=to_regprocedure(e.signature) where md5(p.prosrc) is distinct from e.expected`,
 `select 'EXISTING_TABLE_SURFACE_DRIFT' where (select md5(surface::text) from (${projected})s) is distinct from ${q(surface.surface_md5)}`,
 `select 'NEW_COLUMNS_DRIFT' where (select count(*) from pg_attribute where attrelid='public.notification_push_attempts'::regclass and not attisdropped and attname=any(array[${newColumns.map(q)}]) and not attnotnull and ((attname='single_target_admission' and atttypid='jsonb'::regtype) or (attname='single_target_claimed_at' and atttypid='timestamptz'::regtype) or (attname='single_target_authorization_id' and atttypid='uuid'::regtype)))<>3`,
 `select 'NEW_CONSTRAINTS_DRIFT' where (select count(*) from pg_constraint where conrelid='public.notification_push_attempts'::regclass and conname=any(array[${newConstraints.map(q)}]) and convalidated)<>4`,
 `select 'NEW_FUNCTION_AUTHORITY_DRIFT:'||s from unnest(array[${newSignatures.map(q)}])s left join pg_proc p on p.oid=to_regprocedure(s) where pg_get_userbyid(p.proowner) is distinct from 'postgres' or p.proconfig is distinct from array['search_path=pg_catalog']::text[] or p.prosecdef is distinct from (s like 'public.%') or has_function_privilege('anon',s,'EXECUTE') or has_function_privilege('authenticated',s,'EXECUTE') or has_function_privilege('service_role',s,'EXECUTE') is distinct from (s like 'public.%')`,
 `select 'POST_CERTIFICATE_INCONSISTENT' where private.retention_ai_source_ready() is distinct from true or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton) or private.closure_source_digest_v5() is distinct from private.closure_erasure_binding_v5()->>'sourceSha256' or private.closure_source_digest_v5()=${q(before.digest)}`,
 `select 'READINESS_BODY_DRIFT' where (select md5(replace(replace(prosrc,chr(13),''),(select sha256 from private.closure_source_v5 where singleton),${q(before.digest)})) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure) is distinct from ${q(functions.get('private.retention_ai_source_ready()').bodyMd5)}`].join('\nunion all\n');
const postflight=`with problems as (${postProblems}) select jsonb_build_object('package','PUSH_SINGLE_TARGET_V1','sourceSha',${q(source)},'checkedAt',clock_timestamp(),'problems',coalesce((select jsonb_agg(problem order by problem) from problems),'[]'::jsonb),'sourceRoster',${roster.nextCount},'computedDigest',private.closure_source_digest_v5(),'sourceRow',(select to_jsonb(c) from private.closure_source_v5 c where singleton),'erasureRow',(select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton),'binding',private.closure_erasure_binding_v5(),'admittedAttempts',(select count(*) from public.notification_push_attempts where single_target_admission is not null),'ledgerRows',(select count(*) from supabase_migrations.schema_migrations)) result`;
write('postflight.readonly.sql',`begin read only;set local search_path=pg_catalog;set local statement_timeout='30s';\n${postflight};\nrollback;\n`);
const check=(tag,query)=>`do $${tag}$ declare observation jsonb;begin select result into observation from (${query}) q;if jsonb_array_length(observation->'problems')<>0 then raise exception '${tag}: %',observation->'problems' using errcode='55000';end if;end $${tag}$;\n`;
const lock=`set local search_path=pg_catalog;set local lock_timeout='5s';set local statement_timeout='60s';
do $promotion_fence$ begin if current_user<>'postgres' or not pg_try_advisory_xact_lock(hashtextextended('uskoci:push-claim',0)) then raise exception 'PROMOTION_LOCK_OR_ROLE' using errcode='55000';end if;end $promotion_fence$;
`;
let install=installWithCertificate(frozen('install.disposable.sql'),before,manifest).text;
install=once(install,'\nbegin;\n','\nbegin;\n'+lock);
install=once(install,'end $pre$;','end $pre$;\n'+check('promotion_preflight',preflight));
install=encodeDefinitions(install,[roster.sourceNext,roster.programNext]);
install=once(install,q(before.ready_definition),expr(before.ready_definition));
// Verify that reversing only this delta yields the exact certified predecessor, then roll that probe back.
let probe=frozen('revert.disposable.sql');assert.match(probe,/\ncommit;\s*$/);probe=probe.slice(probe.indexOf('\nbegin;\n')+'\nbegin;\n'.length).replace(/\ncommit;\s*$/,'\n');
probe=encodeDefinitions(probe,oldTransport);
probe=probe.replaceAll('uskoci.single_target_disposable','uskoci.single_target_install');
const isolation=`do $promotion_isolation$ declare observed text;begin begin
execute ${expr(probe)};
execute ${expr(before.source_definition)};
execute ${expr(before.program_definition)};
observed:=private.closure_source_digest_v5();if observed is distinct from ${q(before.digest)} then raise exception 'PROMOTION_NONISOLATED_DELTA' using errcode='55000';end if;
raise exception 'PROMOTION_PROBE_ROLLBACK' using errcode='ZP001';
exception when sqlstate 'ZP001' then null;end;end $promotion_isolation$;
`;
install=once(install,'do $rebind$',isolation+'do $rebind$');
install=once(install,'commit;\n',check('promotion_postflight',postflight)+"notify pgrst,'reload schema';\ncommit;\n");
install=install.replaceAll('uskoci.single_target_disposable','uskoci.single_target_install');
install=install.replace(/-- DISPOSABLE IMPLEMENTATION CANDIDATE ONLY[^\n]*\n/,'-- CURRENT DEV PROMOTION CANDIDATE, NOT APPLIED. Source74cdca32; current captured certificate99 ->108.\n');
write('candidate.sql',install);
let revert=revertWithCertificate(frozen('revert.disposable.sql'),before,{digest:'__PROMOTED_DIGEST__'});
revert=once(revert,'\nbegin;\n','\nbegin;\n'+lock+check('revert_preflight',postflight)+`select set_config('uskoci.single_target_promoted_digest',(select sha256 from private.closure_source_v5 where singleton),true);\n`);
revert=revert.replaceAll(q('__PROMOTED_DIGEST__'),"current_setting('uskoci.single_target_promoted_digest')");
revert=encodeDefinitions(revert,[...oldTransport,before.source_definition,before.program_definition,before.ready_definition]);
revert=revert.replaceAll('uskoci.single_target_disposable','uskoci.single_target_install');
revert=once(revert,'commit;\n',`do $revert_surface$ begin if ${surfaceCheck} is distinct from ${q(surface.surface_md5)} then raise exception 'REVERT_TABLE_SURFACE_DRIFT';end if;end $revert_surface$;\nnotify pgrst,'reload schema';\ncommit;\n`);
write('revert-before-admission.sql',revert);
// Exact captured old Edge restore assets; passing new Edge assets. Neither flag is enabled here.
for(const f of edge.files)write('edge-before/'+f.name,f.content.replaceAll('\r\n','\n'));
for(const n of ['supabase/functions/uskoci-push-transport/index.ts','supabase/functions/_shared/pushNotificationCopy.mjs'])write('edge-candidate/'+n.slice('supabase/'.length),frozen(n));
const result={status:'CURRENT_DEV_SOURCE_PACKAGE_NOT_APPLIED_PROMOTION_WRAPPER_NOT_EXECUTED',projectRef:'leqcwgzvjsxugfgzdmth',proofRun:37077621475,sourceSha:source,capturedAt:capture.checked_at,certificateCheckedAt:cert.checked_at,priorDigest:before.digest,roster:{prior:roster.priorCount,next:roster.nextCount},priorEdge:{version:edge.version,verifyJwt:edge.verify_jwt},retentionCatalogChanged:false,tableAclChanged:false,admissionCreated:false,flagsEnabled:false,files:{}};
for(const n of ['candidate.sql','revert-before-admission.sql','preflight.readonly.sql','postflight.readonly.sql','surface.readonly.sql','build-promotion.mjs',...edge.files.map(f=>'edge-before/'+f.name),...edge.files.map(f=>'edge-candidate/'+f.name)])result.files[n]=sha(readFileSync(join(root,n)));
write('PROMOTION_MANIFEST.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({roster:result.roster,files:result.files},null,2));
