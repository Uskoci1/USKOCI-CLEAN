// P13: exact-source, read-only catalog and bounded EXPLAIN verification after123.
// No production connection, DDL, index tuning, legal seed, provider call or retirement.
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assert,sha,q,sql,rows,login,prove,pass,requester,worker,anon,ok,denied,requesterId,workerId} from './closure_runtime.mjs';
import {migrationSnapshotQuery} from './history_snapshot.mjs';
const base='06d51ecb1438a93a4ecce64692ff868474fca598';
const source=path=>{const b=readFileSync(path);assert.deepEqual(b,execFileSync('git',['show',sha+':'+path]));return b.toString();};
const key=(schema,name)=>schema+'.'+name;
await prove('PRE_V3_BOUNDED_HYGIENE','bounded-hygiene-report.json',async report=>{
 await login();const before=rows(migrationSnapshotQuery());assert.equal(before.length,123);report.historyCount=123;
 const files=execFileSync('git',['diff','--name-only',base,sha,'--','supabase/migrations'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.sql'));
 assert.ok(files.length>=7&&files.length<=30);const functions=new Set(),tables=new Set();
 report.inspectedMigrations=[];
 for(const file of files){
  assert.match(file,/^supabase\/migrations\/20260912\d{6}_clean_pre_v3_[a-z0-9_]+\.sql$/);
  const text=source(file);report.inspectedMigrations.push({file,sha256:createHash('sha256').update(text).digest('hex')});
  for(const m of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(public|private)\.([a-z0-9_]+)/gi))functions.add(key(m[1].toLowerCase(),m[2].toLowerCase()));
  for(const m of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(public|private)\.([a-z0-9_]+)/gi))tables.add(key(m[1].toLowerCase(),m[2].toLowerCase()));
 }
 assert.ok(functions.size>15);assert.ok(tables.size>=5);
 const fns=rows(`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosecdef security_definer,p.proconfig config,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') service_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname in (${[...functions].map(q).join(',')}) order by n.nspname,p.proname,args`);
 for(const name of functions)assert.ok(fns.some(f=>key(f.schema,f.name)===name),'MISSING_TOUCHED_FUNCTION:'+name);
 for(const f of fns){
  assert.equal(f.anon_execute,false,'ANON_EXECUTE:'+f.name);
  if(f.security_definer)assert.deepEqual(f.config,['search_path=pg_catalog'],'DEFINER_PATH:'+f.name);
  if(f.schema==='private')assert.equal(f.authenticated_execute,false,'PRIVATE_HELPER_EXECUTE:'+f.name);
 }
 report.functionCatalog=fns;
 pass(report,'TOUCHED_FUNCTIONS_EXIST_NO_ANON_EXECUTE_PRIVATE_HELPERS_NOT_CLIENT_EXECUTABLE_FIXED_DEFINER_PATH');
 const serviceOnly=['rpc_claim_push_transport','rpc_begin_push_send','rpc_complete_push_transport','rpc_record_push_readiness'];
 const transport=rows(`select p.proname name,p.prosecdef security_definer,p.proconfig config,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,has_function_privilege('service_role',p.oid,'EXECUTE') service_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${serviceOnly.map(q).join(',')}) order by p.proname`);
 assert.equal(transport.length,4);
 for(const f of transport){assert.equal(f.anon_execute,false);assert.equal(f.authenticated_execute,false);assert.equal(f.service_execute,true);assert.equal(f.security_definer,true);assert.deepEqual(f.config,['search_path=pg_catalog']);}
 report.transportCatalog=transport;
 for(const name of ['rpc_claim_push_transport','rpc_begin_push_send','rpc_complete_push_transport'])await denied(anon.rpc(name,{}));
 await denied(requester.rpc('rpc_record_push_readiness',{p_sender_version:'PRE_V3_PUSH_READINESS_V1',p_observation:'TICK_OK'}));
 const readiness=await ok(requester.rpc('rpc_get_push_readiness',{}));assert.ok(['OPERATIONAL','DEGRADED','NOT_READY','UNKNOWN'].includes(readiness.state));
 pass(report,'ACTUAL_AUTH_CAN_READ_READINESS_BUT_CANNOT_WRITE_HEALTH_OR_EXECUTE_SERVICE_TRANSPORT');
 const relationList=[...tables].map(q).join(',');
 const rels=rows(`select n.nspname schema,c.relname name,c.relrowsecurity rls,c.relforcerowsecurity force_rls,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') anon_data,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') authenticated_data,
 (select count(*) from pg_policy p where p.polrelid=c.oid) policy_count
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname||'.'||c.relname in (${relationList}) and c.relkind='r' order by n.nspname,c.relname`);
 assert.equal(rels.length,tables.size);
 for(const t of rels){assert.equal(t.schema,'private');assert.equal(t.rls,true,'RLS:'+t.name);assert.equal(t.anon_data,false,'ANON_DATA:'+t.name);assert.equal(t.authenticated_data,false,'RAW_CLIENT_DATA:'+t.name);}
 report.privateTableCatalog=rels;
 const audit=rows("select pg_get_expr(conbin,conrelid) expression from pg_constraint where conrelid='private.marketplace_audit_log'::regclass and conname='marketplace_audit_log_entity_type_check'");
 assert.equal(audit.length,1);const expression=audit[0].expression;
 assert.match(expression,/'SYSTEM'/);assert.match(expression,/'ACCOUNT'/);assert.match(expression,/'SAFETY_REPORT'/);
 // Only evaluate the known CHECK expression as a scalar over constant fixture
 // values. Reject unexpected grammar before evaluation; no arbitrary SQL input.
 assert.match(expression,/^[a-zA-Z0-9_ '\[\]():=,]+$/);assert.ok(!/\b(select|from|execute|insert|update|delete)\b/i.test(expression));
 for(const [entity,expected] of [['ACCOUNT','t'],['SAFETY_REPORT','t'],['SYSTEM','t'],['ARBITRARY_UNREVIEWED_ENTITY','f']]){
  assert.equal(sql(`select ${expression.replace(/\bentity_type\b/g,q(entity))}`),expected);
 }
 pass(report,'NEW_PRIVATE_TABLE_RLS_AND_NO_RAW_CLIENT_GRANTS_AUDIT_VOCABULARY_STAYS_BOUNDED');
 const indexes=rows(`select n.nspname schema,c.relname table_name,ci.relname index_name,i.indisvalid valid,i.indisready ready,i.indisunique unique_index,
 pg_get_indexdef(i.indexrelid) definition from pg_index i join pg_class c on c.oid=i.indrelid join pg_class ci on ci.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname||'.'||c.relname in (${relationList}) order by n.nspname,c.relname,ci.relname`);
 for(const i of indexes){assert.equal(i.valid,true,'INVALID_INDEX:'+i.index_name);assert.equal(i.ready,true,'UNREADY_INDEX:'+i.index_name);}
 const definitions=new Set();for(const i of indexes){const normalized=i.definition.replace(/^CREATE (UNIQUE )?INDEX \S+ ON /,'CREATE $1INDEX ON ');assert.ok(!definitions.has(normalized),'EXACT_DUPLICATE_INDEX:'+i.index_name);definitions.add(normalized);}
 report.indexInventory=indexes;
 report.queryPlans={
  accountReputation:JSON.parse(sql(`explain (format json) select count(*),avg(rating) from private.agreement_reviews where target_account_id=${q(workerId)}::uuid`)),
  reviewReplay:JSON.parse(sql(`explain (format json) select id from private.agreement_reviews where reviewer_account_id=${q(requesterId)}::uuid and client_request_id='00000000-0000-4000-8000-000000000000'::uuid`)),
  boundedPushBacklog:JSON.parse(sql("explain (format json) select id from public.notification_deliveries where channel='PUSH' and state='PENDING' order by created_at,id limit 101"))
 };
 report.performanceLimitations=['Disposable fixture cardinality only; not a production latency/load benchmark.','No indexes added or dropped. Review aggregate/replay paths reuse existing target/unique indexes; queue EXPLAIN is a bounded diagnostic, not a new claim of transport capacity.'];
 pass(report,'NEW_INDEXES_VALID_NO_EXACT_DUPLICATES_AND_ACTUAL_TOUCHED_QUERY_EXPLAIN_RECORDED_WITHOUT_SPECULATIVE_TUNING');
 const productionFiles=execFileSync('git',['ls-tree','-r','--name-only',sha,'src'],{encoding:'utf8'}).trim().split('\n').filter(p=>/\.[cm]?[jt]sx?$/.test(p)&&!p.includes('/__tests__/')&&!/\.test\./.test(p));
 const legacy=['rpc_send_agreement_message','rpc_ai_open_conversation','rpc_ai_open_need_conversation_v2'];
 report.retirement=[];
 for(const name of legacy){
  const pattern=new RegExp("\\.rpc\\s*\\(\\s*['\"]"+name+"['\"]");const callers=productionFiles.filter(p=>pattern.test(readFileSync(p,'utf8')));
  assert.equal(callers.length,0,'LEGACY_LITERAL_CALLER_CHANGED:'+name);
  report.retirement.push({rpc:name,literalProductionCallers:callers,classification:'SUPERSEDED_BUT_REQUIRED_FOR_COMPAT',liveRevokeAuthorized:false});
 }
 report.retirementLimitations=['Literal-call scan does not establish installed APK/rollback compatibility.','Existing bounded dynamic wrappers and server-to-server dependency graph remain compatibility-frozen; no DROP/REVOKE is implied.'];
 assert.deepEqual(rows(migrationSnapshotQuery()),before);
 assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'');
 pass(report,'LEGACY_SOURCE_CALLER_FREEZE_PRESERVED_WITHOUT_REVOKE_AND_EXACT_MIGRATION_HISTORY_UNCHANGED');
 report.scope='Explicit function/table declarations in post-P0 PRE-V3 migrations; service transport RPCs; bounded review/queue paths. Earlier domain proofs separately exercise dynamic guards, ownership, CAS, privacy and races.';
});
