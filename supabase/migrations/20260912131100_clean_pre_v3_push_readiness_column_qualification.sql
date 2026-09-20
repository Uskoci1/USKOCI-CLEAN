-- PRE-V3 candidate123: forward correction for the observed P11 runtime error.
-- Run34696138232 / exact9774988 failed with SQL42702, variable state vs column.
-- Keep candidate122, readiness semantics, privileges and constraints unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $fix$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.rpc_get_push_readiness()'::regprocedure);
 anchor:=$old$overdue:=exists(select 1 from public.notification_deliveries where channel='PUSH' and state in('CREATED','QUEUED','FAILED_RETRYABLE')
  and created_at<t-interval '15 minutes' and (expires_at is null or expires_at>t));$old$;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then
  raise exception 'PUSH_READINESS_CORRECTION_ANCHOR_DRIFT';
 end if;
 execute replace(definition,anchor,$new$overdue:=exists(select 1 from public.notification_deliveries d where d.channel='PUSH' and d.state in('CREATED','QUEUED','FAILED_RETRYABLE')
  and d.created_at<t-interval '15 minutes' and (d.expires_at is null or d.expires_at>t));$new$);
end;
$fix$;
notify pgrst,'reload schema';
commit;
