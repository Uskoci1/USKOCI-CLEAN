// Disposable-only, exact relevant-body B24 conversion. Never connects to DEV.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assert,sql,rows,q,env} from '../../proofs/pre_v3/closure_runtime.mjs';
const dir='supabase/candidates/worker-personal-profile-20261003/';
const manifest=JSON.parse(readFileSync(dir+'manifest.json','utf8'));
const bodies=JSON.parse(readFileSync(dir+'live-functions.json','utf8'));
const md5=s=>createHash('md5').update(s).digest('hex');
const signature=s=>(s.startsWith('private.')?s:'public.'+s).replace('(needs,','(public.needs,');
const source=new Map(bodies.map(r=>[signature(r.signature),r.body]));
const closure=()=>rows("select private.closure_source_digest_v5() as digest,private.closure_erasure_program_digest_v5() as program,private.retention_ai_source_ready() as ready")[0];
const before=closure();assert.equal(before.ready,true);
const converted=[];
for(const pin of [...manifest.functions.map(f=>({signature:f.signature,body_md5:f.before_md5})),...manifest.unchangedDependencies]){
 const expected=source.get(pin.signature);
 assert.equal(md5(expected),pin.body_md5);
 const row=rows("select prosrc,pg_get_functiondef(oid) as definition,to_jsonb(p)-'prosrc' as metadata from pg_proc p where oid=to_regprocedure("+q(pin.signature)+")")[0];
 assert.ok(row,'MISSING_CHAIN_FUNCTION:'+pin.signature);
 if(md5(row.prosrc)===pin.body_md5)continue;
 const preimage=expected.replaceAll("'PT409'","'40001'");
 assert.notEqual(preimage,expected,'NOT_A_B24_DIFFERENCE:'+pin.signature);
 assert.equal(row.prosrc,preimage,'EXACT_PREIMAGE_DRIFT:'+pin.signature);
 const next=row.definition.replaceAll("'40001'","'PT409'");
 sql(next);
 const actual=rows("select prosrc,to_jsonb(p)-'prosrc' as metadata from pg_proc p where oid=to_regprocedure("+q(pin.signature)+")")[0];
 assert.equal(actual.prosrc,expected);assert.deepEqual(actual.metadata,row.metadata);
 converted.push(pin.signature);
}
assert.deepEqual(closure(),before);
writeFileSync(env.WPP01_ARTIFACT_DIR+'/chain-fidelity.json',JSON.stringify({
 result:'PASS',relevantLiveBodyPins:12,converted,certificateUnchanged:true,
 scope:'Exact twelve relevant function bodies on the established disposable source147-to-PKG050 chain plus EX04d/EX06a/EX06b. Not global DEV equivalence.'
},null,2)+'\n');
console.log('PASS WPP01_EXACT_TWELVE_RELEVANT_LIVE_BODY_PINS');

