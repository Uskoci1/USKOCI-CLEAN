import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_notification_ai_v1_candidate.sql',import.meta.url),'utf8'),low=sql.toLowerCase(),fail=[];
for(const x of ['security definer','set search_path=pg_catalog','rpc_control_notification_v1','rpc_control_ai_v1','to service_role','rollback;','deviceDeliveryProof','providerMetrics'])if(!low.includes(x.toLowerCase()))fail.push('missing '+x);
for(const x of ["'body',d.body","'pushToken'","'providerTicketId'","'body',m.body","'factValue'","'evidenceExcerpt'"])if(low.includes(x.toLowerCase()))fail.push('forbidden '+x);
if(/grant execute[\s\S]{0,220}\b(?:anon|authenticated)\b/i.test(sql))fail.push('client execute grant');
if(/\b(insert|update|delete|truncate)\s+/i.test(sql.replace(/--.*$/gm,'')))fail.push('business write');
if(!sql.includes("'contentExposed',false")||!sql.includes("'tokenExposed',false")||!sql.includes("'bodyExposed',false")||!sql.includes("'valuesExposed',false"))fail.push('metadata-only markers incomplete');
if(fail.length){console.error('CONTROL NOTIFICATION/AI CANDIDATE GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL NOTIFICATION/AI CANDIDATE GUARD PASS');