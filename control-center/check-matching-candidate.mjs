import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_matching_v1_candidate.sql',import.meta.url),'utf8'),low=sql.toLowerCase(),fail=[];
for(const x of ['security definer','set search_path=pg_catalog','rpc_control_matching_v1','private.match_detail','public.dispatch_rounds','public.opportunity_deliveries','limit 20','historicalExclusionProof','RECORDED_DISPATCH_ONLY','to service_role','rollback;'])if(!low.includes(x.toLowerCase()))fail.push('missing '+x);
for(const x of ["'exactAddress'","'exactLat'","'exactLng'","'email'","'phone'","approximate_lat","approximate_lng","exact_address"])if(low.includes(x.toLowerCase()))fail.push('forbidden '+x);
if(/from\s+public\.app_profiles[\s\S]{0,500}private\.match_detail/i.test(sql))fail.push('bulk worker rematch risk');
if(/\b(insert|update|delete|truncate)\s+/i.test(sql.replace(/--.*$/gm,'')))fail.push('business write');
if(!low.includes("'evaluationScope','CURRENT_RECOMPUTE'".toLowerCase()))fail.push('current recompute label missing');
if(fail.length){console.error('CONTROL MATCHING CANDIDATE GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL MATCHING CANDIDATE GUARD PASS');
