-- PKG-040a: settle an owned Q&A classifier failure without changing publication policy.
-- New service-only function; no rows, schema constraints, triggers or certificate rewritten.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table pkg040a_before(digest text) on commit drop;
do $pre$
begin
 if to_regprocedure('public.rpc_fail_qa_classification_service(uuid,uuid,uuid,uuid)') is not null then raise exception 'PKG040A_ALREADY_APPLIED';end if;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_claim_qa_classification_service(uuid,text,uuid,integer,uuid,text,uuid)'::regprocedure)
    is distinct from '1c35033cd2cd1f63b97d2d33f94abeb2'
 or (select md5(prosrc) from pg_proc where oid='public.rpc_complete_qa_classification_service(uuid,uuid,uuid,uuid,jsonb)'::regprocedure)
    is distinct from '7e6ea4ec0f644e3ecb9b881cc59ca70a'
 or (select md5(prosrc) from pg_proc where oid='public.rpc_dispatch_qa_classification_service(uuid,uuid,uuid,uuid)'::regprocedure)
    is distinct from 'eb137d1ed57857cdae31cb2566c0e6cd'
 or (select md5(prosrc) from pg_proc where oid='private.qa_ai_status(uuid,uuid,uuid)'::regprocedure)
    is distinct from 'cd73ac7fdd83167b3a7310c30c619e0f'
 then raise exception 'PKG040A_PREDECESSOR_DRIFT';end if;
 if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
    (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG040A_CLOSURE_NOT_READY';end if;
 insert into pkg040a_before values(private.closure_source_digest_v5());
end $pre$;

create function public.rpc_fail_qa_classification_service(p_account_id uuid,p_need_id uuid,p_client_request_id uuid,p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $body$
declare c private.qa_ai_commands;
begin
 if p_account_id is null or p_need_id is null or p_client_request_id is null or p_attempt_id is null then
  raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('v5-qa:'||p_account_id::text||':'||p_client_request_id::text,0));
 select * into c from private.qa_ai_commands where account_id=p_account_id and client_request_id=p_client_request_id for update;
 if not found or c.need_id<>p_need_id or c.attempt_id is distinct from p_attempt_id then
  raise exception 'QA_CLASSIFICATION_NOT_FOUND' using errcode='42501';end if;
 if c.state<>'PROCESSING' then return private.qa_ai_status(p_account_id,p_need_id,p_client_request_id);end if;
 -- Honor retained canonical writers as well; never claim cancellation over an
 -- existing receipt. The owned client reads that receipt before classification.
 perform pg_advisory_xact_lock(hashtextextended(p_account_id::text||E'\n'||p_client_request_id::text,
  case when c.command_type='ASK' then 4412 else 4413 end));
 if exists(select 1 from private.preselection_qa_commands where actor_account_id=p_account_id and request_id=p_client_request_id) then
  return private.qa_ai_status(p_account_id,p_need_id,p_client_request_id);end if;
 -- Reuse the existing technical cancellation state (also used by the sweep).
 -- No policy decision, refund, lease refresh or repeat provider dispatch.
 update private.qa_ai_commands set state='CANCELLED',safe_reason_codes=array['QA_PROCESSING_FAILED'],updated_at=clock_timestamp()
  where id=c.id;
 return private.qa_ai_status(p_account_id,p_need_id,p_client_request_id);
end;
$body$;
revoke all on function public.rpc_fail_qa_classification_service(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.rpc_fail_qa_classification_service(uuid,uuid,uuid,uuid) to service_role;

do $post$
declare f record;
begin
 select prosrc,proowner,prosecdef,proconfig into f from pg_proc
  where oid='public.rpc_fail_qa_classification_service(uuid,uuid,uuid,uuid)'::regprocedure;
 if md5(f.prosrc) is distinct from 'ac65279aa93fa7cd26e433aeddea67b6' then raise exception 'PKG040A_BODY_MISMATCH';end if;
 if f.proowner<>'postgres'::regrole or not f.prosecdef or f.proconfig is distinct from array['search_path=pg_catalog']
 or has_function_privilege('anon','public.rpc_fail_qa_classification_service(uuid,uuid,uuid,uuid)','execute')
 or has_function_privilege('authenticated','public.rpc_fail_qa_classification_service(uuid,uuid,uuid,uuid)','execute')
 or not has_function_privilege('service_role','public.rpc_fail_qa_classification_service(uuid,uuid,uuid,uuid)','execute')
 then raise exception 'PKG040A_AUTHORITY_MISMATCH';end if;
 if private.closure_source_digest_v5() is distinct from (select digest from pkg040a_before)
 or not private.retention_ai_source_ready() then raise exception 'PKG040A_CLOSURE_CHANGED';end if;
end $post$;
notify pgrst,'reload schema';
commit;
