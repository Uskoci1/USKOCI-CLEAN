-- PKG-037a: recover expired publication-review claims (deep read 11.2).
-- Function-only change. No acceptance replay, provider call, publication, refund,
-- data deletion, table/trigger/ACL alteration or closure certificate rebind.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table pkg037a_before(prosrc text,acl aclitem[],owner_id oid,definer boolean,config text[],digest text) on commit drop;
do $pre$
declare current_md5 text;
begin
 select md5(replace(prosrc,E'\r\n',E'\n')) into current_md5 from pg_proc
  where oid='private.ai_turn_sweep_v5(timestamptz)'::regprocedure;
 if current_md5='9d89b9af2e893bc608e7598d175551b7' then raise exception 'PKG037A_ALREADY_APPLIED'; end if;
 if current_md5 is distinct from '3aa616ba34af5dadc798c1765128be96' then raise exception 'PKG037A_PREDECESSOR_DRIFT'; end if;
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc
     where oid='public.rpc_complete_ai_task_review_evaluation_service(uuid,uuid,uuid,text,text[],text[],text,text,text)'::regprocedure)
    is distinct from 'd8ace4d564121c88e62009b1f908df76' then raise exception 'PKG037A_COMPLETION_AUTHORITY_DRIFT'; end if;
 if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
    (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG037A_CLOSURE_NOT_READY'; end if;
 insert into pkg037a_before select prosrc,proacl,proowner,prosecdef,proconfig,private.closure_source_digest_v5()
   from pg_proc where oid='private.ai_turn_sweep_v5(timestamptz)'::regprocedure;
end $pre$;
do $patch$
declare def text; a text; b text;
begin
 def:=pg_get_functiondef('private.ai_turn_sweep_v5(timestamptz)'::regprocedure);
 a:=$anchor$  v_need integer := 0; v_worker integer := 0; v_qa integer := 0; v_errors jsonb := '[]'::jsonb;$anchor$;
 b:=$replacement$  v_need integer := 0; v_worker integer := 0; v_qa integer := 0; v_review integer := 0; v_errors jsonb := '[]'::jsonb;$replacement$;
 if length(def)-length(replace(def,a,''))<>length(a) then raise exception 'PKG037A_DECLARATION_ANCHOR'; end if;
 def:=replace(def,a,b);
 a:=$anchor$  return jsonb_build_object('needTurnsFailed', v_need, 'workerTurnsFailed', v_worker,
    'qaCommandsCancelled', v_qa, 'graceMinutes', 10, 'errors', v_errors);$anchor$;
 b:=$replacement$  -- PKG-037: a publication claim cannot complete after its 60-second lease.
  -- End expired attempts without a decision, another paid request or any refund.
  -- Lock only a bounded batch; an in-flight completion wins or is fenced by state.
  begin
    with expired as (
      select c.review_id from private.ai_task_review_commands c
       where c.state = 'EVALUATING'
         and c.lease_expires_at <= least(coalesce(p_at, statement_timestamp()), clock_timestamp())
       order by c.lease_expires_at, c.review_id limit 100 for update skip locked
    )
    update private.ai_task_review_commands c set state = 'EVALUATED',
      evaluation = jsonb_build_object('kind','NOT_READY','needId',c.need_id,
        'needRevision',c.need_revision,'authoritativeDecision',false,'code','EVALUATOR_UNAVAILABLE'),
      evaluation_result_hash = encode(extensions.digest(jsonb_build_object(
        'outcome',null,'rules','[]'::jsonb,'reasons','[]'::jsonb,'provider',null,'model',null,
        'notReady','EVALUATOR_UNAVAILABLE')::text,'sha256'),'hex')
     where c.review_id in (select review_id from expired) and c.state = 'EVALUATING';
    get diagnostics v_review = row_count;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object('turns','PUBLICATION_REVIEW','sqlstate',sqlstate));
  end;
  return jsonb_build_object('needTurnsFailed', v_need, 'workerTurnsFailed', v_worker,
    'qaCommandsCancelled', v_qa, 'reviewEvaluationsStopped', v_review, 'graceMinutes', 10, 'errors', v_errors);$replacement$;
 if length(def)-length(replace(def,a,''))<>length(a) then raise exception 'PKG037A_SWEEP_ANCHOR'; end if;
 execute replace(def,a,b);
end $patch$;
do $post$
declare actual record; old record;
begin
 select prosrc,proacl,proowner,prosecdef,proconfig into actual from pg_proc
   where oid='private.ai_turn_sweep_v5(timestamptz)'::regprocedure;
 select * into old from pkg037a_before;
 if md5(actual.prosrc) is distinct from '9d89b9af2e893bc608e7598d175551b7' then raise exception 'PKG037A_BODY_MISMATCH'; end if;
 if (actual.proacl,actual.proowner,actual.prosecdef,actual.proconfig) is distinct from
    (old.acl,old.owner_id,old.definer,old.config) then raise exception 'PKG037A_AUTHORITY_CHANGED'; end if;
 if private.closure_source_digest_v5() is distinct from old.digest or not private.retention_ai_source_ready()
   then raise exception 'PKG037A_CHANGED_CLOSURE_SOURCE'; end if;
end $post$;
commit;
