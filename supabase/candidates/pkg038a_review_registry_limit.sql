-- PKG-038a / conversation audit C11. Current registry size owns the review cap.
-- Function-only, forward-only; no rows, grants, triggers or certificate changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table pkg038a_before(prosrc text,acl aclitem[],owner_id oid,definer boolean,config text[],digest text) on commit drop;
do $pre$
declare current_md5 text;
begin
 select md5(replace(prosrc,E'\r\n',E'\n')) into current_md5 from pg_proc
  where oid='public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)'::regprocedure;
 if current_md5='61cf7f94032dbdfec2d5294c480a90e8' then raise exception 'PKG038A_ALREADY_APPLIED'; end if;
 if current_md5 is distinct from 'e734f889221f69a6e9a25d8f1fb90bbc' then raise exception 'PKG038A_PREDECESSOR_DRIFT'; end if;
 if (select count(*) from private.need_fact_registry)<>23 then raise exception 'PKG038A_REGISTRY_DRIFT'; end if;
 if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
    (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG038A_CLOSURE_NOT_READY'; end if;
 insert into pkg038a_before select prosrc,proacl,proowner,prosecdef,proconfig,private.closure_source_digest_v5()
  from pg_proc where oid='public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)'::regprocedure;
end $pre$;
do $patch$
declare def text; a text:=$a$jsonb_array_length(review->'facts')>22$a$;
 b text:=$b$jsonb_array_length(review->'facts')>(select count(*) from private.need_fact_registry)$b$;
begin
 def:=pg_get_functiondef('public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)'::regprocedure);
 if length(def)-length(replace(def,a,''))<>length(a) then raise exception 'PKG038A_ANCHOR'; end if;
 execute replace(def,a,b);
end $patch$;
do $post$
declare actual record; old record;
begin
 select prosrc,proacl,proowner,prosecdef,proconfig into actual from pg_proc
  where oid='public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)'::regprocedure;
 select * into old from pkg038a_before;
 if md5(actual.prosrc) is distinct from '61cf7f94032dbdfec2d5294c480a90e8' then raise exception 'PKG038A_BODY_MISMATCH'; end if;
 if (actual.proacl,actual.proowner,actual.prosecdef,actual.proconfig) is distinct from
    (old.acl,old.owner_id,old.definer,old.config) then raise exception 'PKG038A_AUTHORITY_CHANGED'; end if;
 if private.closure_source_digest_v5() is distinct from old.digest or not private.retention_ai_source_ready()
  then raise exception 'PKG038A_CHANGED_CLOSURE_SOURCE'; end if;
end $post$;
commit;
