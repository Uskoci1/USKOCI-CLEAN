// EX-06E R2: deterministic source builder, no network or database access.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const sha256=s=>createHash('sha256').update(s).digest('hex');
export const md5=s=>createHash('md5').update(s).digest('hex');
export function once(text,from,to){assert.equal(text.split(from).length-1,1,'SOURCE_ANCHOR_NOT_UNIQUE: '+from.slice(0,70));return text.replace(from,()=>to);}
export function replacements(text){return text.replace(/\$replacement\$([\s\S]*?)\$replacement\$/g,(_,body)=>'$replacement$'+body
 .replace(/need_search_time_admitted_v1\((n|v_need)\.id, statement_timestamp\(\)\)/g,'need_search_time_admitted_v1($1.id, clock_timestamp())')
 .replace('private.enqueue_dispatch(v_need.id, statement_timestamp())','private.enqueue_dispatch(v_need.id, clock_timestamp())')+'$replacement$');}
const OLD='public.rpc_reopen_remaining_search(uuid,integer,text,text)';
export const NEW='public.rpc_reopen_remaining_search(uuid,integer,timestamptz,text,text)';
const pins=[['c37d672ccaf44e86b5e83b117156cdb8','2b58d69640ac802a5dd3fa3cef6c56d0'],['478ce82cafaf93f8e2b7f2d8ad0f3bbb','e59b8f7d3e14ebbf6f9ddd8dd63b0af7']];
export function compile(candidate,revert,timeBody,extraScenarios,proof){
 assert.equal(sha256(candidate),'356c39f779f39740a3728f7fe3bf40b5e3fdb6bee3a0b8ad26308054ebfabe8d','R1_CANDIDATE_BYTES_CHANGED');
 assert.equal(sha256(revert),'97b945e192632b0a95c8b6b766855ae418f6786ae06088984584eb86d6565ca4','R1_REVERT_BYTES_CHANGED');
 const gitBlob=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+Buffer.byteLength(proof)+'\0'),Buffer.from(proof)])).digest('hex');
 assert.equal(gitBlob,'66743dc2e273fec6327f5c9eee31fc3824e00159','R1_PROOF_BYTES_CHANGED');
 let c=replacements(candidate),r=replacements(revert);
 for(const [a,b] of pins){c=c.replaceAll(a,b);r=r.replaceAll(a,b);}
 c=c.replaceAll(OLD,NEW);r=r.replaceAll(OLD,NEW);
 c=once(c,'  p_expected_revision integer,\n  p_client_request_id text,','  p_expected_revision integer,\n  p_expected_closed_at timestamptz,\n  p_client_request_id text,');
 const timeMatch=/create function private\.need_search_time_admitted_v1\([\s\S]*?as \$fn\$([\s\S]*?)\$fn\$;/;
 assert.ok(timeMatch.test(c),'TIME_FUNCTION_NOT_FOUND');
 const oldTime=c.match(timeMatch)[1];c=once(c,oldTime,'\n'+timeBody.trim()+'\n');
 c=once(c,"  v_at timestamptz := statement_timestamp();","  v_at timestamptz;");
 c=once(c,"  if char_length(v_request_id) not between 8 and 193 then",`  if p_expected_closed_at is null or not isfinite(p_expected_closed_at) then
    raise exception 'SEARCH_CLOSURE_WITNESS_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 193 then`);
 c=once(c,"'needId',p_need_id,'expectedRevision',p_expected_revision,'reason',v_reason",`'command','REOPEN_REMAINING_SEARCH_V1',
      'needId',p_need_id,'expectedRevision',p_expected_revision,'reason',v_reason,
      'expectedClosedAtEpoch',extract(epoch from p_expected_closed_at)`);
 c=once(c,String.raw`perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\\n' || v_request_id, 4411));`,String.raw`perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\\n' || ('reopen:'||v_request_id), 4410));`);
 c=once(c,"    if v_existing.request_hash <> v_request_hash then\n      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';",`    if v_existing.request_hash is distinct from v_request_hash
       or v_existing.result->>'command' is distinct from 'REOPEN_REMAINING_SEARCH_V1'
       or v_existing.result->>'needId' is distinct from p_need_id::text
       or v_existing.result->'remainingSearchClosed' is distinct from 'false'::jsonb
       or v_existing.result->'authoritative' is distinct from 'true'::jsonb then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='PT409';`);
 c=once(c,"  if v_need.remaining_search_closed_at is null then",`  if v_need.remaining_search_closed_at is distinct from p_expected_closed_at then
    raise exception 'STALE_SEARCH_STATE' using errcode='PT409';
  end if;
  if v_need.remaining_search_closed_at is null then`);
 c=once(c,"  if not private.need_search_time_admitted_v1(v_need.id,v_at) then",`  -- Sample after the Need lock: a request may have waited across the execution boundary.
  v_at := clock_timestamp();
  if not private.need_search_time_admitted_v1(v_need.id,v_at) then`);
 c=once(c,"  v_result := jsonb_build_object(\n    'needId',v_need.id,",`  v_result := jsonb_build_object(
    'command','REOPEN_REMAINING_SEARCH_V1',
    'observedClosedAt',p_expected_closed_at,
    'needId',v_need.id,`);
 // Pin dependencies whose behaviour is reused, without altering certified triggers or old close.
 c=once(c,'  insert into ex06e_closure values(private.closure_source_digest_v5());',`  if (select md5(replace(prosrc,E'\\r','')) from pg_proc where oid=to_regprocedure('public.rpc_close_remaining_search(uuid,integer,text,text)')) is distinct from '39fa830132d714a1cc61d3bba73d5cec'
     or (select md5(replace(prosrc,E'\\r','')) from pg_proc where oid=to_regprocedure('private.guard_remaining_search_close_fields()')) is distinct from 'ce59ad1cdee98518950e289aa5c329a4'
     or (select md5(replace(prosrc,E'\\r','')) from pg_proc where oid=to_regprocedure('private.relative_schedule_end_v5(text,timestamptz,text)')) is distinct from '7164c2ba0d23a0387376fec67f7154b9' then
    raise exception 'EX06E_R2_DEPENDENCY_DRIFT';
  end if;
  insert into ex06e_closure values(private.closure_source_digest_v5());`);
 const bodyOf=(text,name)=>{const start=text.indexOf('create function '+name+'(');assert.ok(start>=0);return text.slice(start).match(/as \$fn\$([\s\S]*?)\$fn\$;/)[1];};
 const timeMd5=md5(bodyOf(c,'private.need_search_time_admitted_v1')),reopenMd5=md5(bodyOf(c,'public.rpc_reopen_remaining_search'));
 const guard=`do $r2_new_function_pins$
declare p record; spec record;
begin
  for spec in select * from (values
    ('private.need_search_time_admitted_v1(uuid,timestamptz)','${timeMd5}','s','boolean'::regtype,2,'{postgres=X/postgres}',array['p_need_id','p_at']::text[]),
    ('${NEW}','${reopenMd5}','v','jsonb'::regtype,5,'{postgres=X/postgres,authenticated=X/postgres}',array['p_need_id','p_expected_revision','p_expected_closed_at','p_client_request_id','p_reason']::text[])
  ) s(signature,body_hash,vol,result_type,nargs,acl,argnames) loop
    select * into p from pg_proc where oid=to_regprocedure(spec.signature);
    if not found then raise exception 'EX06E_R2_NEW_FUNCTION_MISSING'; end if;
    if md5(replace(p.prosrc,E'\\r','')) is distinct from spec.body_hash
       or p.provolatile::text is distinct from spec.vol or p.prorettype<>spec.result_type
       or p.pronargs<>spec.nargs or p.pronargdefaults<>1 or p.proargnames is distinct from spec.argnames
       or p.proacl::text is distinct from spec.acl or p.proowner<>'postgres'::regrole
       or p.proconfig is distinct from array['search_path=pg_catalog'] or not p.prosecdef
       or p.proleakproof or p.proparallel<>'u' or p.prokind<>'f'
       or p.prolang<>(select oid from pg_language where lanname='plpgsql')
       or pg_get_expr(p.proargdefaults,0) is distinct from
          (case when spec.nargs=2 then 'statement_timestamp()' else $default_text$''::text$default_text$ end) then
      raise exception 'EX06E_R2_NEW_FUNCTION_DRIFT: %',spec.signature;
    end if;
  end loop;
  if to_regprocedure('${OLD}') is not null then raise exception 'EX06E_R2_UNSAFE_OLD_REOPEN_PRESENT'; end if;
end
$r2_new_function_pins$;
`;
 c=once(c,"notify pgrst,'reload schema';",guard+"\nnotify pgrst,'reload schema';");
 r=once(r,'do $pre$',guard+'\ndo $pre$');
 c='-- GENERATED EX06E R2 candidate. NOT APPLIED TO DEV. Inputs and outputs are hashed.\n'+c;
 r='-- GENERATED EX06E R2 code revert. Does not rewind user data/command history.\n'+r;
 let p=proof;
 p=once(p,"const reopenArgs=(t,key='ex06e-reopen-'+randomUUID())=>closeArgs(t,key);",`const rememberedReopen=new Map();
const reopenArgs=(t,key='ex06e-reopen-'+randomUUID())=>{
  const identity=t.needId+':'+key;
  if(!rememberedReopen.has(identity)) rememberedReopen.set(identity,{...closeArgs(t,key),p_expected_closed_at:state(t.needId).remaining_search_closed_at});
  return {...rememberedReopen.get(identity)};
};`);
 p=once(p,'  const certAfter=fx.closureState(),catalogAfter=catalogHash();',extraScenarios+'\n  const certAfter=fx.closureState(),catalogAfter=catalogHash();');
 p=once(p,"package:'EX-06E Lifecycle Recovery'","package:'EX-06E R2 command and Need-time hardening'");
 return {candidate:c,revert:r,proof:p,manifest:{sourceInputs:{candidate:sha256(candidate),revert:sha256(revert),proof:gitBlob,time:sha256(timeBody),scenarios:sha256(extraScenarios)},candidateSha256:sha256(c),revertSha256:sha256(r),proofSha256:sha256(p),functions:{wave:'2b58d69640ac802a5dd3fa3cef6c56d0',tick:'8798cb6b6f004ecd5d88dd472cd6de0b',cancel:'e59b8f7d3e14ebbf6f9ddd8dd63b0af7',timeHelper:timeMd5,reopen:reopenMd5},newReopenSignature:NEW,notDevApproved:true}};
}
export function build(root,out){
 const read=f=>fs.readFileSync(path.join(root,f),'utf8');
 const built=compile(read('supabase/candidates/ex06e_lifecycle_recovery.sql'),read('supabase/candidates/ex06e_lifecycle_recovery_revert.sql'),read('supabase/proofs/ex06/r2/time-body.sql'),read('supabase/proofs/ex06/r2/scenarios.inc.mjs'),read('supabase/proofs/ex06/ex06e_lifecycle_recovery_proof.mjs'));
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'candidate.sql'),built.candidate);fs.writeFileSync(path.join(out,'revert.sql'),built.revert);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(built.manifest,null,2)+'\n');
 fs.writeFileSync(path.join(root,'supabase/proofs/ex06/ex06e_r2_generated_proof.mjs'),built.proof);
 return built;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 build(process.cwd(),process.env.EX06E_R2_DIR??'/tmp/ex06e-r2');console.log('PASS deterministic EX06E R2 generation');
}
