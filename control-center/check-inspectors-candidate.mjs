import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_inspectors_v1_candidate.sql',import.meta.url),'utf8');
const low=sql.toLowerCase(),fail=[];
for(const required of [
 'security definer','set search_path=pg_catalog','rollback;',
 'rpc_control_search_v1','rpc_control_user_v1','rpc_control_task_v1','rpc_control_agreement_v1',
 "limit lim+1","'returnsEmail',false","'containsPhone',false","'containsExactAddress',false",
 "'containsChatBody',false","'containsMessageBody',false",
 'grant execute on function public.rpc_control_search_v1(text,integer)',
 'to service_role'
]) if(!low.includes(required.toLowerCase()))fail.push('missing '+required);
for(const forbidden of [
 "'email',a.email","'phone',a.phone","'exactAddress'","'exactLat'","'exactLng'",
 "'pushToken'","'body',","av.terms","select to_jsonb(s) from public.need_sensitive"
]) if(low.includes(forbidden.toLowerCase()))fail.push('forbidden return/exposure '+forbidden);
if(!low.includes("lower(a.email)=q")||!low.includes("regexp_replace(a.phone"))fail.push('exact private identity search predicates missing');
if(!low.includes("public.fn_need_covered_slots"))fail.push('canonical coverage helper missing');
if(!low.includes("limit 25")||!low.includes("limit 50"))fail.push('bounded inspector timelines missing');
if(/\b(insert|update|delete|truncate)\s+(?!from\s+public\.agreement_messages)/i.test(sql.replace(/--.*$/gm,'')))fail.push('business write verb present');
if(!/statement_timeout='8s'/i.test(sql))fail.push('bounded statement timeout missing');
if(fail.length){console.error('CONTROL INSPECTORS CANDIDATE GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL INSPECTORS CANDIDATE GUARD PASS');
