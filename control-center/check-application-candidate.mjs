import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_application_v1_candidate.sql',import.meta.url),'utf8'),low=sql.toLowerCase(),fail=[];
for(const x of ['security definer','set search_path=pg_catalog','rpc_control_application_v1','marketplace_response_versions','staleAgainstCurrentNeed','limit 25','to service_role','rollback;'])if(!low.includes(x.toLowerCase()))fail.push('missing '+x);
for(const x of ["'email'","'phone'","'exactAddress'","'scopeNote',rv.scope_note","'body',","exact_address","exact_lat","exact_lng"])if(low.includes(x.toLowerCase()))fail.push('forbidden '+x);
if(/grant execute[\s\S]{0,160}\b(?:anon|authenticated)\b/i.test(sql))fail.push('client execute grant');
if(/\b(insert|update|delete|truncate)\s+/i.test(sql.replace(/--.*$/gm,'')))fail.push('business write');
if(!low.includes("'scopenoteexposed',false")||!low.includes("'payloadexposed',false"))fail.push('metadata-only markers missing');
if(fail.length){console.error('CONTROL APPLICATION CANDIDATE GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL APPLICATION CANDIDATE GUARD PASS');