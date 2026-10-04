import fs from 'node:fs';
const sql=fs.readFileSync(new URL('./sql/control_extended_inspectors_preflight.readonly.sql',import.meta.url),'utf8');
const body=sql.replace(/--.*$/gm,''),fail=[];
for(const verb of ['insert','update','delete','truncate','alter','drop','create','grant','revoke','comment','call','notify']){
 if(new RegExp('\\b'+verb+'\\b','i').test(body))fail.push('write/DDL verb: '+verb);
}
for(const sensitive of ['exact_address','exact_lat','exact_lng','expo_push_token','email','phone',' body ','evidence_excerpt']){
 if(body.toLowerCase().includes(sensitive))fail.push('sensitive read: '+sensitive);
}
for(const required of ['information_schema.columns','relrowsecurity','has_function_privilege','pg_indexes','explain (format json)','private.match_detail(uuid,uuid)','public.rpc_get_push_readiness()']){
 if(!body.toLowerCase().includes(required.toLowerCase()))fail.push('missing '+required);
}
if(fail.length){console.error('CONTROL EXTENDED INSPECTOR PREFLIGHT GUARD FAIL');for(const x of fail)console.error('- '+x);process.exit(1)}
console.log('CONTROL EXTENDED INSPECTOR PREFLIGHT GUARD PASS');