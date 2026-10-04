// DISPOSABLE REPLAY ALIGNMENT ONLY. This is NOT a DEV migration or part of the candidate.
// Actual artifact 11314618142 proved the old replay close body differs from the live close
// body by exactly the B24 deterministic conflict code (40001 -> PT409). Keep candidate pins strict.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
assert.equal(process.env.DB_URL,'postgresql://postgres:postgres@127.0.0.1:54322/postgres');
assert.equal(process.env.RU5_DEVICE_DB_URL,process.env.DB_URL);
assert.equal(process.env.RU5_DEVICE_SUPABASE_URL,'http://127.0.0.1:54321');
const args=[process.env.DB_URL,'-X','-qAt','-v','ON_ERROR_STOP=1'];
const query=s=>execFileSync('psql',args,{input:s,encoding:'utf8',timeout:30000}).trim();
const before=query("select md5(replace(prosrc,E'\\r','')) from pg_proc where oid='public.rpc_close_remaining_search(uuid,integer,text,text)'::regprocedure;");
assert.ok(['1e3e98db30a8260c5896909df94b1506','39fa830132d714a1cc61d3bba73d5cec'].includes(before),'UNREVIEWED_REPLAY_CLOSE_BODY');
if(before==='1e3e98db30a8260c5896909df94b1506')query(String.raw`
begin;
set local lock_timeout='5s';
set local statement_timeout='20s';
do $align$
declare p pg_proc%rowtype; old_meta jsonb; old_cert text; d text;
begin
 select * into p from pg_proc where oid='public.rpc_close_remaining_search(uuid,integer,text,text)'::regprocedure;
 if current_user<>'postgres' or md5(replace(p.prosrc,E'\r',''))<>'1e3e98db30a8260c5896909df94b1506' then raise exception 'R2_REPLAY_ALIGNMENT_DRIFT';end if;
 if (length(p.prosrc)-length(replace(p.prosrc,$old$errcode='40001'$old$,'')))<>length($old$errcode='40001'$old$) then raise exception 'R2_REPLAY_ALIGNMENT_ANCHOR';end if;
 old_meta:=to_jsonb(p)-'prosrc';old_cert:=private.closure_source_digest_v5();
 d:=pg_get_functiondef(p.oid);execute replace(d,$old$errcode='40001'$old$,$new$errcode='PT409'$new$);
 select * into p from pg_proc where oid=p.oid;
 if md5(replace(p.prosrc,E'\r',''))<>'39fa830132d714a1cc61d3bba73d5cec' or to_jsonb(p)-'prosrc' is distinct from old_meta then raise exception 'R2_REPLAY_ALIGNMENT_POST';end if;
 if private.closure_source_digest_v5() is distinct from old_cert or not private.retention_ai_source_ready() then raise exception 'R2_REPLAY_ALIGNMENT_CERTIFICATE';end if;
end
$align$;
commit;
`);
const after=query("select md5(replace(prosrc,E'\\r','')) from pg_proc where oid='public.rpc_close_remaining_search(uuid,integer,text,text)'::regprocedure;");
assert.equal(after,'39fa830132d714a1cc61d3bba73d5cec');
fs.writeFileSync(process.env.EX06E_R2_DIR+'/replay-alignment.json',JSON.stringify({scope:'DISPOSABLE_ONLY',before,after,change:before===after?'NONE':'SINGLE_EXISTING_B24_CONFLICT_CODE',liveChanged:false,completeDevEquivalence:false},null,2)+'\n');
console.log('PASS narrow replay dependency matches observed live close body');
