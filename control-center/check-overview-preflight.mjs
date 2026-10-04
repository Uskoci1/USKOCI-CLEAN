import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_overview_v1_preflight.readonly.sql',import.meta.url),'utf8');
const body=sql.replace(/--.*$/gm,'');
const fail=[];
for(const verb of ['insert','update','delete','truncate','alter','drop','create','grant','revoke','comment']){
  if(new RegExp('\\b'+verb+'\\b','i').test(body)) fail.push('write/DDL verb present: '+verb);
}
for(const sensitive of ['email','phone','exact_address','exact_lat','exact_lng','expo_push_token','body from public.agreement_messages','ai_messages']){
  if(body.toLowerCase().includes(sensitive)) fail.push('sensitive field/table present: '+sensitive);
}
for(const required of ['information_schema.columns','pg_indexes','relrowsecurity','explain (format json)','count(*)']){
  if(!body.toLowerCase().includes(required.toLowerCase())) fail.push('missing '+required);
}
if(fail.length){console.error('CONTROL OVERVIEW PREFLIGHT GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL OVERVIEW PREFLIGHT GUARD PASS');
