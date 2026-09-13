// Proof-only, after the canonical136 snapshot has already failed. No SQL body,
// bound policy, plan expressions or snapshot bytes are retained in evidence.
import {createHash} from 'node:crypto';
import {ObservedSqlError,safeSqlFailure} from './observed_export_sql.mjs';

export const SNAPSHOT136_SOURCE=Object.freeze({
 migrationSha256:'73e5f3b0fab4fd8ca096ca3ef75a49054e06b1cc3583950b2f9223759dea7dad',
 bodySha256:'bc8886d050f08c0c23cc995347b6aba4c9449e826e13f3c8babc59445f476bfc',
 signature:'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)',
});
const header='create or replace function private.data_export_snapshot(p_account_id uuid,p_receipt_id uuid,p_binding jsonb,p_cutoff timestamptz) returns text language sql stable security definer set search_path=pg_catalog as $fn$';
const marker=' owned_rows as (';
const digest=value=>createHash('sha256').update(value).digest('hex');
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:null;
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const invalid=()=>new Error('EXPORT_DIAGNOSTIC_SOURCE_OR_INPUT_INVALID');

/** The body is byte-bound and never rewritten by identifier substitution.
 * LATERAL resolves the four original parameter names against a typed outer row.
 * PREPARE is per connection, and every invocation uses a READ ONLY transaction.
 */
export function buildSnapshotDiagnostics(bytes,parameters){
 if(!Buffer.isBuffer(bytes)||digest(bytes)!==SNAPSHOT136_SOURCE.migrationSha256)throw invalid();
 const source=bytes.toString('utf8');if(source.split(header).length!==2)throw invalid();
 const start=source.indexOf(header)+header.length,end=source.indexOf('$fn$;',start),body=source.slice(start,end);
 if(end<start||digest(body)!==SNAPSHOT136_SOURCE.bodySha256||body.split(marker).length!==2)throw invalid();
 const statement=body.trimEnd();if(!statement.endsWith(';')||statement.split(';').length!==2)throw invalid();
 if(!object(parameters)||!uuid(parameters.accountId)||!uuid(parameters.receiptId)||!object(parameters.binding)
  ||typeof parameters.cutoff!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parameters.cutoff)
  ||!Number.isFinite(Date.parse(parameters.cutoff)))throw invalid();
 const encoded=Buffer.from(JSON.stringify(parameters.binding),'utf8');if(encoded.length>262144)throw invalid();
 const argumentsSql=`'${parameters.accountId}'::uuid,'${parameters.receiptId}'::uuid,convert_from(decode('${encoded.toString('hex')}','hex'),'UTF8')::jsonb,'${parameters.cutoff}'::timestamptz`;
 const bodies={ORIGINAL:statement.slice(0,-1),MATERIALIZED:statement.slice(0,-1).replace(marker,' owned_rows as materialized (')};
 const commands={};
 for(const [variant,query] of Object.entries(bodies)){
  const prefix=`begin read only;\nset local search_path=pg_catalog;\nprepare uskoci_snapshot136(uuid,uuid,jsonb,timestamptz) as\nselect diagnostic.snapshot_value from\n(select $1::uuid as p_account_id,$2::uuid as p_receipt_id,$3::jsonb as p_binding,$4::timestamptz as p_cutoff) parameters\ncross join lateral (\n${query}\n) diagnostic(snapshot_value);\n`;
  commands['PLAN_'+variant]=prefix+`explain (format json, settings true) execute uskoci_snapshot136(${argumentsSql});\nrollback;`;
  commands['EXECUTE_'+variant]=prefix+`execute uskoci_snapshot136(${argumentsSql});\nrollback;`;
 }
 // One separately labelled control invokes the actual SECURITY DEFINER
 // function with JIT disabled only in this read-only session/transaction.
 commands.EXECUTE_FUNCTION_LOCAL_JIT_OFF=`begin read only;\nset local search_path=pg_catalog;\nset local jit=off;\nprepare uskoci_snapshot136(uuid,uuid,jsonb,timestamptz) as\nselect private.data_export_snapshot($1::uuid,$2::uuid,$3::jsonb,$4::timestamptz);\nexecute uskoci_snapshot136(${argumentsSql});\nrollback;`;
 // Read catalog metadata only; never transport pg_proc.prosrc to the report.
 commands.SOURCE_BINDING=`select coalesce((select encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')='${SNAPSHOT136_SOURCE.bodySha256}'
 and p.prosecdef and p.provolatile='s' and p.proconfig=array['search_path=pg_catalog']::text[]
 and p.prolang=(select oid from pg_language where lanname='sql') and p.prorettype='text'::regtype
 from pg_proc p where p.oid='${SNAPSHOT136_SOURCE.signature}'::regprocedure),false);`;
 return commands;
}

/** Numeric/boolean plan DTO only. Filters, Output, relation/index/CTE names,
 * query text, arbitrary Settings and complete plan trees are intentionally absent.
 */
export function sanitizeSnapshotPlan(raw){
 if(!Array.isArray(raw)||raw.length!==1||!object(raw[0])||!object(raw[0].Plan))throw new Error('EXPORT_DIAGNOSTIC_PLAN_INVALID');
 const top=raw[0],root=top.Plan;if(!finite(root['Startup Cost'])||!finite(root['Total Cost']))throw new Error('EXPORT_DIAGNOSTIC_PLAN_INVALID');
 const result={startupCost:root['Startup Cost'],totalCost:root['Total Cost'],nodeCount:0,maxDepth:0,cteScans:0,functionScans:0,subplans:0};
 for(const [key,name] of [['Plan Rows','estimatedRows'],['Plan Width','estimatedWidth'],['Workers Planned','plannedWorkers']])if(integer(root[key]))result[name]=root[key];
 const queue=[{node:root,depth:0}],seen=new Set();
 while(queue.length){const {node,depth}=queue.pop();
  if(!object(node)||seen.has(node)||depth>128||seen.size>=4096)throw new Error('EXPORT_DIAGNOSTIC_PLAN_TOO_LARGE');
  seen.add(node);result.nodeCount++;result.maxDepth=Math.max(result.maxDepth,depth);
  if(node['Node Type']==='CTE Scan')result.cteScans++;if(node['Node Type']==='Function Scan')result.functionScans++;
  if(node['Parent Relationship']==='SubPlan'||node['Parent Relationship']==='InitPlan')result.subplans++;
  if(node.Plans!==undefined&&!Array.isArray(node.Plans))throw new Error('EXPORT_DIAGNOSTIC_PLAN_INVALID');
  if((node.Plans?.length??0)+queue.length+seen.size>4096)throw new Error('EXPORT_DIAGNOSTIC_PLAN_TOO_LARGE');
  for(const child of node.Plans??[])queue.push({node:child,depth:depth+1});
 }
 for(const [key,name] of [['Planning Time','planningMilliseconds'],['Execution Time','executionMilliseconds']])if(finite(top[key]))result[name]=top[key];
 if(object(top.JIT)){
  const jit={};if(integer(top.JIT.Functions))jit.functions=top.JIT.Functions;
  for(const [key,name] of [['Inlining','inlining'],['Optimization','optimization'],['Expressions','expressions'],['Deforming','deforming']])
   if(typeof top.JIT.Options?.[key]==='boolean')(jit.options??={})[name]=top.JIT.Options[key];
  for(const [key,name] of [['Generation','generation'],['Inlining','inlining'],['Optimization','optimization'],['Emission','emission'],['Total','total']])
   if(finite(top.JIT.Timing?.[key]))(jit.milliseconds??={})[name]=top.JIT.Timing[key];
  if(Object.keys(jit).length)result.jit=jit;
 }
 // EXPLAIN SETTINGS includes only deviations, not all effective settings. The
 // independent observer records complete admitted settings in sqlDiagnostics.
 if(object(top.Settings)){
  const settings={};for(const name of ['jit_above_cost','jit_inline_above_cost','jit_optimize_above_cost']){
   const value=top.Settings[name];if(typeof value==='string'&&/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value)&&Number.isFinite(Number(value)))settings[name]=Number(value);
  }
  if(['on','off'].includes(top.Settings.jit))settings.jit=top.Settings.jit==='on';
  if(['auto','force_generic_plan','force_custom_plan'].includes(top.Settings.plan_cache_mode))settings.plan_cache_mode=top.Settings.plan_cache_mode;
  if(Object.keys(settings).length)result.nonDefaultSettings=settings;
 }
 return result;
}

/** Diagnostic success never changes the original proof result. Each separate
 * session is bounded by observedSql's existing20s; no provider or DDL is used.
 */
export async function runSnapshotDiagnostics({bytes,parameters,observedSql,report,verifySnapshot}){
 const evidence={...SNAPSHOT136_SOURCE,scope:'TYPED_CLONES_AND_SESSION_JIT_FUNCTION_PROBE',cloneScope:'TOP_LEVEL_TYPED_PREPARED_LATERAL_BODY',
  cloneFunctionInvocation:false,functionSessionLocalJitOffProbe:true,securityDefinerFunctionPlanEquivalent:false,coldCacheGuaranteed:false,
  separateTransactionSnapshots:true,contentParityEstablished:false,singleVariantDifference:'OWNED_ROWS_MATERIALIZED',
  parameterValuesRetained:false,productionSqlChanged:false,originalFailurePreserved:true,steps:[]};
 report.exportPerformanceDiagnostics=evidence;
 let commands;try{commands=buildSnapshotDiagnostics(bytes,parameters);}catch{evidence.sourceBinding='REJECTED';return;}
 try{if(await observedSql('DIAG_SOURCE_BINDING',commands.SOURCE_BINDING)!=='t'){evidence.sourceBinding='REJECTED';return;}evidence.sourceBinding='MATCHED';}
 catch(error){evidence.sourceBinding='UNAVAILABLE';evidence.sourceFailure=safeSqlFailure(error);return;}
 for(const [operation,kind] of [['PLAN_ORIGINAL','PLAN'],['PLAN_MATERIALIZED','PLAN'],['EXECUTE_ORIGINAL','EXECUTE'],['EXECUTE_MATERIALIZED','EXECUTE'],['EXECUTE_FUNCTION_LOCAL_JIT_OFF','EXECUTE']]){
  const step={operation,status:'RUNNING',functionInvocation:operation==='EXECUTE_FUNCTION_LOCAL_JIT_OFF'};
  // Observer GUCs describe its separate session, not this main session's SET.
  // ON_ERROR_STOP allows EXECUTE success only after this requested SET succeeds.
  if(step.functionInvocation)step.requestedSessionLocalSettings={jit:false};
  evidence.steps.push(step);
  try{
   const raw=JSON.parse(await observedSql('DIAG_'+operation,commands[operation]));
   if(kind==='PLAN')step.plan=sanitizeSnapshotPlan(raw);
   else{await verifySnapshot(raw);step.ownedProjectionAssertionsPassed=true;}
   step.status='SUCCEEDED';
  }catch(error){step.status='FAILED';step.failure=safeSqlFailure(error);}
 }
}

/** Only a real canonical full-snapshot timeout admits these supplemental reads.
 * A successful clone or a diagnostic/source/assertion failure cannot replace
 * the original exception, and therefore cannot bypass the proof's cleanup.
 */
export async function rethrowSnapshotFailure(error,options){
 if(error instanceof ObservedSqlError&&error.operation==='SNAPSHOT_FULL'&&(error.code==='ETIMEDOUT'||error.sqlState==='57014')){
  try{await runSnapshotDiagnostics({...options,bytes:options.readSource()});
   options.report.exportPerformanceDiagnostics.trigger=safeSqlFailure(error);
  }
  catch(diagnosticError){
   // Even a malformed diagnostic report sink must not mask the primary error.
   try{options.report.exportPerformanceDiagnosticFailure=safeSqlFailure(diagnosticError);}catch{}
  }
 }
 throw error;
}
