-- PKG-034a: preparation uses the executor's hard blockers (deep read 12.10).
-- Preserve the legacy preparation envelope; only execution review authorizes START.
-- No data rewrite, erasure implementation, trigger, policy, grant or certificate change.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create temporary table pkg034a_before(prosrc text,acl aclitem[],definer boolean,config text[],digest text) on commit drop;
do $pre$
begin
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='private.account_closure_preparation(uuid)'::regprocedure)
   is distinct from 'e4bb4c0d3a7d1ebc682c28a01b605cd4' then raise exception 'PKG034A_PREDECESSOR_DRIFT'; end if;
 if (select md5(prosrc) from pg_proc where oid='private.closure_erasure_hard_blockers_v5(uuid)'::regprocedure)
   is distinct from 'f88717dbf53fd88a5b9d13b5b19f47d2' then raise exception 'PKG034A_BLOCKER_AUTHORITY_DRIFT'; end if;
 if not private.retention_ai_source_ready() or private.closure_source_digest_v5() is distinct from
   (select sha256 from private.closure_source_v5 where singleton) then raise exception 'PKG034A_CLOSURE_NOT_READY'; end if;
 insert into pkg034a_before select prosrc,proacl,prosecdef,proconfig,private.closure_source_digest_v5()
   from pg_proc where oid='private.account_closure_preparation(uuid)'::regprocedure;
end
$pre$;
do $patch$
declare def text; anchor text:=$anchor$ -- Bounded existence checks use existing account/owner indexes; no public IDs,
 -- narratives, hold keys or counterpart data are exposed in the receipt.
 if exists(select 1 from public.agreements where requester_account_id=a and status not in('COMPLETED','CANCELLED'))
 or exists(select 1 from public.agreements where worker_account_id=a and status not in('COMPLETED','CANCELLED')) then
  blockers:=blockers||'"ACTIVE_AGREEMENT"'::jsonb;
 end if;
 if exists(select 1 from public.needs where requester_account_id=a and status in('PUBLISHED','SELECTION','ACTIVE')) then
  blockers:=blockers||'"OPEN_TASK"'::jsonb;
 end if;
 if exists(select 1 from public.marketplace_responses where worker_account_id=a and status in('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')) then
  blockers:=blockers||'"ACTIVE_APPLICATION"'::jsonb;
 end if;
 if exists(select 1 from private.ai_need_turn_commands where account_id=a and state='PROCESSING')
 or exists(select 1 from private.retention_jobs where account_id=a and status='CLAIMED')
 or exists(select 1 from public.data_export_requests where account_id=a and status='PROCESSING') then
  blockers:=blockers||'"PENDING_WORKFLOW"'::jsonb;
 end if;
 if exists(select 1 from private.retention_holds where account_id=a and active) then
  blockers:=blockers||'"RETENTION_HOLD"'::jsonb;
 end if;
$anchor$; replacement text:=$replacement$ -- PKG-034: the certified executor owns hard blockers; preparation only
 -- projects them into the five existing receipt codes for installed clients.
 -- Detailed storage blockers remain available in the execution review.
 select coalesce(jsonb_agg(code order by first_seen),'[]'::jsonb) into blockers
 from (
   select case when c in ('ACTIVE_AGREEMENT','OPEN_TASK','ACTIVE_APPLICATION','PENDING_WORKFLOW','RETENTION_HOLD')
     then c else 'PENDING_WORKFLOW' end as code, min(ord) as first_seen
   from unnest(private.closure_erasure_hard_blockers_v5(a)) with ordinality x(c,ord)
   group by 1
 ) projected;
$replacement$;
begin
 def:=pg_get_functiondef('private.account_closure_preparation(uuid)'::regprocedure);
 if length(def)-length(replace(def,anchor,''))<>length(anchor) then raise exception 'PKG034A_ANCHOR'; end if;
 execute replace(def,anchor,replacement);
end
$patch$;
do $post$
declare actual record; old record;
begin
 select prosrc,proacl,prosecdef,proconfig into actual from pg_proc where oid='private.account_closure_preparation(uuid)'::regprocedure;
 select * into old from pkg034a_before;
 if actual.prosrc is distinct from $expected$
declare blockers jsonb:='[]'; reasons jsonb:='[]'; legal jsonb; retention jsonb;
begin
 -- PKG-034: the certified executor owns hard blockers; preparation only
 -- projects them into the five existing receipt codes for installed clients.
 -- Detailed storage blockers remain available in the execution review.
 select coalesce(jsonb_agg(code order by first_seen),'[]'::jsonb) into blockers
 from (
   select case when c in ('ACTIVE_AGREEMENT','OPEN_TASK','ACTIVE_APPLICATION','PENDING_WORKFLOW','RETENTION_HOLD')
     then c else 'PENDING_WORKFLOW' end as code, min(ord) as first_seen
   from unnest(private.closure_erasure_hard_blockers_v5(a)) with ordinality x(c,ord)
   group by 1
 ) projected;
 legal:=public.rpc_get_legal_bundle();
 retention:=public.rpc_get_retention_policy_status();
 if (legal->>'ready')::boolean is distinct from true then reasons:=reasons||'"LEGAL_POLICY_NOT_READY"'::jsonb; end if;
 if (retention->>'ready')::boolean is distinct from true then reasons:=reasons||'"RETENTION_POLICY_NOT_READY"'::jsonb; end if;
 -- The existing P3 adapter covers AI_ABANDONED_UNBOUND only. Neither a legal
 -- document nor a schedule admits account erasure, auth closure or media cleanup.
 -- A future implementation must bind real approved coverage before removing this
 -- source gate. There is intentionally NO operator flag to bypass missing code.
 reasons:=reasons||'"CLOSURE_EXECUTION_NOT_READY"'::jsonb;
 return jsonb_build_object('observedAt',clock_timestamp(),'blockers',blockers,'notReadyReasons',reasons,
  'legalReady',coalesce((legal->>'ready')::boolean,false),'retentionReady',coalesce((retention->>'ready')::boolean,false),
  'executionReady',false,'authClosureReady',false,'mediaCleanupReady',false);
end;
$expected$
   or md5(actual.prosrc) is distinct from md5($expected$
declare blockers jsonb:='[]'; reasons jsonb:='[]'; legal jsonb; retention jsonb;
begin
 -- PKG-034: the certified executor owns hard blockers; preparation only
 -- projects them into the five existing receipt codes for installed clients.
 -- Detailed storage blockers remain available in the execution review.
 select coalesce(jsonb_agg(code order by first_seen),'[]'::jsonb) into blockers
 from (
   select case when c in ('ACTIVE_AGREEMENT','OPEN_TASK','ACTIVE_APPLICATION','PENDING_WORKFLOW','RETENTION_HOLD')
     then c else 'PENDING_WORKFLOW' end as code, min(ord) as first_seen
   from unnest(private.closure_erasure_hard_blockers_v5(a)) with ordinality x(c,ord)
   group by 1
 ) projected;
 legal:=public.rpc_get_legal_bundle();
 retention:=public.rpc_get_retention_policy_status();
 if (legal->>'ready')::boolean is distinct from true then reasons:=reasons||'"LEGAL_POLICY_NOT_READY"'::jsonb; end if;
 if (retention->>'ready')::boolean is distinct from true then reasons:=reasons||'"RETENTION_POLICY_NOT_READY"'::jsonb; end if;
 -- The existing P3 adapter covers AI_ABANDONED_UNBOUND only. Neither a legal
 -- document nor a schedule admits account erasure, auth closure or media cleanup.
 -- A future implementation must bind real approved coverage before removing this
 -- source gate. There is intentionally NO operator flag to bypass missing code.
 reasons:=reasons||'"CLOSURE_EXECUTION_NOT_READY"'::jsonb;
 return jsonb_build_object('observedAt',clock_timestamp(),'blockers',blockers,'notReadyReasons',reasons,
  'legalReady',coalesce((legal->>'ready')::boolean,false),'retentionReady',coalesce((retention->>'ready')::boolean,false),
  'executionReady',false,'authClosureReady',false,'mediaCleanupReady',false);
end;
$expected$) then raise exception 'PKG034A_BODY_MISMATCH'; end if;
 if (actual.proacl,actual.prosecdef,actual.proconfig) is distinct from (old.acl,old.definer,old.config)
   then raise exception 'PKG034A_AUTHORITY_CHANGED'; end if;
 if private.closure_source_digest_v5() is distinct from old.digest or not private.retention_ai_source_ready()
   then raise exception 'PKG034A_CHANGED_CLOSURE_SOURCE'; end if;
end
$post$;
notify pgrst,'reload schema';
commit;
