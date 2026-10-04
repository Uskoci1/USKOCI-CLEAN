import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_inspectors_v1_preflight.readonly.sql',import.meta.url),'utf8');
const body=sql.replace(/--.*$/gm,''),fail=[];
for(const verb of ['insert','update','delete','truncate','alter','drop','create','grant','revoke','comment']){
 if(new RegExp('\\b'+verb+'\\b','i').test(body))fail.push('write/DDL verb present: '+verb);
}
for(const required of [
 'information_schema.columns','pg_indexes','relrowsecurity','relforcerowsecurity',
 "to_regprocedure('public.fn_need_covered_slots(uuid)')",
 'explain (format json)','limit 20','limit 25'
])if(!body.toLowerCase().includes(required.toLowerCase()))fail.push('missing '+required);
if(/select\s+[^;]*(exact_address|exact_lat|exact_lng|email|phone)\s+from/i.test(body))fail.push('sensitive value select present');
if(fail.length){console.error('CONTROL INSPECTORS PREFLIGHT GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL INSPECTORS PREFLIGHT GUARD PASS');
