import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_overview_v1_candidate.sql',import.meta.url),'utf8');
const fail=[];
for(const x of [
  'security definer',
  'set search_path = pg_catalog',
  'revoke all on function public.rpc_control_overview_v1() from public, anon, authenticated, service_role',
  'grant execute on function public.rpc_control_overview_v1() to service_role',
  "'active24hState','UNKNOWN'",
  "'containsEmail',false",
  "'containsPhone',false",
  "'containsExactAddress',false",
  "'containsPushToken',false",
  "'containsChatBody',false",
  "'openForApplicationsCount'",
  "'submitted24h'",
  "'activeCount'",
  "'completionMismatchCount'",
  'public.agreement_execution',
  'rollback;'
]) if(!sql.toLowerCase().includes(x.toLowerCase())) fail.push('missing '+x);
for(const forbidden of ['select email','select phone','exact_address','expo_push_token','agreement_messages',' ai_messages ']){
  if(sql.toLowerCase().includes(forbidden.toLowerCase())) fail.push('forbidden '+forbidden);
}
if(/\b(insert|update|delete|truncate)\s+(?!into\s+pg_)/i.test(sql.replace(/--.*$/gm,''))) fail.push('business write verb present');
if(!/statement_timeout\s*=\s*'5s'/i.test(sql)) fail.push('missing bounded statement timeout');
if(fail.length){console.error('CONTROL OVERVIEW CANDIDATE GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL OVERVIEW CANDIDATE GUARD PASS');
