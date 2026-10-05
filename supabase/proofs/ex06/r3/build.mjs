// Deterministic EX06E R3 source composition; no network or database access.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
export const sha256=s=>createHash('sha256').update(s).digest('hex');
export const md5=s=>createHash('md5').update(s).digest('hex');
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const once=(s,a,b)=>{assert.equal(s.split(a).length-1,1,'R3_ANCHOR');return s.replace(a,()=>b);};
export const relativeSignature='private.relative_schedule_end_v5(text,timestamptz,text)';
export const readerSignatures=['public.rpc_get_need_search_state(uuid)','public.rpc_get_reopen_remaining_search_receipt(uuid,integer,timestamptz,text,text)'];
export function compose(base,readers,oldRelative,newRelative,scenarios){
 assert.equal(sha256(base.candidate),'8ab4a121e9fc91f6deb23f2355da1ce854f03c1be6562bf390c3318c2640d6e8');
 assert.equal(sha256(base.revert),'c9e38eef66667eae26fc3e106bf0e1fe56b585631c95baca067c39ec59eea253');
 assert.equal(md5(oldRelative),'7164c2ba0d23a0387376fec67f7154b9');
 const relativeHash=md5(newRelative);
 const bodies=[readers.match(/as \$r3_state\$([\s\S]*?)\$r3_state\$;/)[1],readers.match(/as \$r3_receipt\$([\s\S]*?)\$r3_receipt\$;/)[1]];
 const specs=readerSignatures.map((sig,i)=>({sig,bodyMd5:md5(bodies[i]),nargs:i?5:1,defaults:i?1:0}));
 function checkReaders(){return `do $r3_reader_pins$ declare p pg_proc%rowtype;r record;begin
 for r in select * from (values ${specs.map(s=>`(${quote(s.sig)},${quote(s.bodyMd5)},${s.nargs},${s.defaults})`).join(',')}) x(signature,body,nargs,defaults) loop
 select * into p from pg_proc where oid=to_regprocedure(r.signature);
 if not found then raise exception 'R3_READER_MISSING';end if;
 if md5(replace(p.prosrc,E'\\r','')) is distinct from r.body or p.proowner<>'postgres'::regrole
   or not p.prosecdef or p.provolatile<>'s' or p.proparallel<>'u' or p.proleakproof
   or p.pronargs<>r.nargs or p.pronargdefaults<>r.defaults or p.prorettype<>'jsonb'::regtype
   or p.proconfig is distinct from array['search_path=pg_catalog']
   or p.proacl::text is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then
   raise exception 'R3_READER_DRIFT: %',r.signature;
 end if;
 end loop;end $r3_reader_pins$;\n`;}
 function swap(from,to,label){return `do $r3_relative$ declare p pg_proc%rowtype;m jsonb;d text;begin
 select * into p from pg_proc where oid=to_regprocedure('${relativeSignature}');
 if not found or md5(replace(p.prosrc,E'\\r','')) is distinct from '${md5(from)}' then raise exception 'R3_RELATIVE_${label}_DRIFT';end if;
 m:=to_jsonb(p)-'prosrc';d:=pg_get_functiondef(p.oid);
 if (length(d)-length(replace(d,${quote(from)},'')))<>length(${quote(from)}) then raise exception 'R3_RELATIVE_ANCHOR';end if;
 execute replace(d,${quote(from)},${quote(to)});
 select * into p from pg_proc where oid=to_regprocedure('${relativeSignature}');
 if md5(replace(p.prosrc,E'\\r','')) is distinct from '${md5(to)}' or to_jsonb(p)-'prosrc' is distinct from m then raise exception 'R3_RELATIVE_POST';end if;
 end $r3_relative$;\n`;}
 const absent=`do $r3_absent$ begin if ${readerSignatures.map(s=>`to_regprocedure('${s}') is not null`).join(' or ')} then raise exception 'R3_READERS_ALREADY_PRESENT';end if;end $r3_absent$;\n`;
 const cert=`do $r3_cert$ begin if private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
 or private.retention_ai_source_ready() is distinct from true then raise exception 'R3_CERTIFICATE_MOVED';end if;end $r3_cert$;\n`;
 const c=once(base.candidate,"notify pgrst,'reload schema';",absent+swap(oldRelative,newRelative,'APPLY')+readers+'\n'+checkReaders()+cert+"notify pgrst,'reload schema';");
 const preRevert=checkReaders()+readerSignatures.map(s=>'drop function '+s+';').join('\n')+'\n'+swap(newRelative,oldRelative,'REVERT')+cert;
 const r=once(base.revert,'do $r2_new_function_pins$',preRevert+'\ndo $r2_new_function_pins$');
 let proof=base.proof==null?null:once(base.proof,'  const certAfter=fx.closureState(),catalogAfter=catalogHash();',scenarios+'\n  const certAfter=fx.closureState(),catalogAfter=catalogHash();');
 if(proof)proof=once(proof,"package:'EX-06E R2 command and Need-time hardening'","package:'EX-06E R3 calendar and owner readback'");
 return {candidate:c,revert:r,proof,manifest:{sourceInputs:{r2Candidate:sha256(base.candidate),r2Revert:sha256(base.revert),readers:sha256(readers),oldRelative:sha256(oldRelative),newRelative:sha256(newRelative),scenarios:sha256(scenarios)},candidateSha256:sha256(c),revertSha256:sha256(r),proofSha256:proof?sha256(proof):null,relativeHash,readers:specs,r2Functions:base.manifest?.functions??{},newReopenSignature:base.manifest?.newReopenSignature,devApproved:false}};
}
export async function build(root,out){
 const {build:baseBuild}=await import('../r2/build.mjs');
 const base=baseBuild(root,path.join(out,'r2-base')),read=n=>fs.readFileSync(path.join(root,'supabase/proofs/ex06/r3',n),'utf8');
 const result=compose(base,read('readers.sql'),read('relative.before.sql'),read('relative.after.sql'),read('scenarios.inc.mjs'));
 fs.mkdirSync(out,{recursive:true});for(const key of ['candidate','revert'])fs.writeFileSync(path.join(out,key+'.sql'),result[key]);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(result.manifest,null,2)+'\n');
 fs.writeFileSync(path.join(root,'supabase/proofs/ex06/ex06e_r3_generated_proof.mjs'),result.proof);
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){await build(process.cwd(),process.env.EX06E_R3_DIR??'/tmp/ex06e-r3');console.log('PASS deterministic R3 generation');}
