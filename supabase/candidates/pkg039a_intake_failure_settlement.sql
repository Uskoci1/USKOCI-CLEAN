-- PKG-039a / bounded failure settlement for an owned dispatched intake attempt.
-- Function-only, forward-only; no rows, grants, triggers or certificate changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table pkg039a_before(prosrc text,acl aclitem[],owner_id oid,definer boolean,config text[],digest text) on commit drop;
do $pre$
declare current_md5 text;
begin
 select md5(replace(prosrc,E'\r\n',E'\n')) into current_md5 from pg_proc
  where oid='public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)'::regprocedure;
 if current_md5='cae618c7bfcb03df163fc9bec3170fe2' then raise exception 'PKG039A_ALREADY_APPLIED'; end if;
 if current_md5 is distinct from '17baf5705063e2c65059a9cf43310be8' then raise exception 'PKG039A_PREDECESSOR_DRIFT'; end if;
 if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
    (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG039A_CLOSURE_NOT_READY'; end if;
 insert into pkg039a_before select prosrc,proacl,proowner,prosecdef,proconfig,private.closure_source_digest_v5()
  from pg_proc where oid='public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)'::regprocedure;
end $pre$;
do $patch$
declare def text; a text:=$a$and state='PROCESSING' and attempt_id=p_attempt_id and not provider_dispatched and cancelled_at is null;$a$;
 b text:=$b$and state='PROCESSING' and attempt_id=p_attempt_id and cancelled_at is null;$b$;
begin
 def:=pg_get_functiondef('public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)'::regprocedure);
 if length(def)-length(replace(def,a,''))<>length(a) then raise exception 'PKG039A_ANCHOR'; end if;
 execute replace(def,a,b);
end $patch$;
do $post$
declare actual record; old record;
begin
 select prosrc,proacl,proowner,prosecdef,proconfig into actual from pg_proc
  where oid='public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)'::regprocedure;
 select * into old from pkg039a_before;
 if md5(actual.prosrc) is distinct from 'cae618c7bfcb03df163fc9bec3170fe2' then raise exception 'PKG039A_BODY_MISMATCH'; end if;
 if (actual.proacl,actual.proowner,actual.prosecdef,actual.proconfig) is distinct from
    (old.acl,old.owner_id,old.definer,old.config) then raise exception 'PKG039A_AUTHORITY_CHANGED'; end if;
 if private.closure_source_digest_v5() is distinct from old.digest or not private.retention_ai_source_ready()
  then raise exception 'PKG039A_CHANGED_CLOSURE_SOURCE'; end if;
end $post$;
commit;
