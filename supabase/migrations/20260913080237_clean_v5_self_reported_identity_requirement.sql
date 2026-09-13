--145 AF-D23: self-reported identity in the owner-approved private test.
-- No external KYC, invented verified status, provider, new dataset or policy seed.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create temporary table identity145_predecessor(sha text,ready_definition text) on commit drop;
do $pre$ declare s text;d text;begin
 select sha256 into strict s from private.closure_source_v5 where singleton;
 if s is distinct from private.closure_source_digest_v5() or private.retention_ai_source_ready() is distinct from true then raise exception 'IDENTITY_PREDECESSOR_NOT_READY';end if;
 select prosrc into strict d from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure;
 if md5(replace(replace(d,E'\r\n',E'\n'),s,'__SOURCE139_SHA256__'))<>'75b560d9a71baa045f8e7f80cd77aada'
 or jsonb_array_length(private.data_export_dataset_catalog())<>50 then raise exception 'IDENTITY_PREDECESSOR_DRIFT';end if;
 if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='private.guard_ai_fact_schema()'::regprocedure)<>'b2386ca23e82d730f876ea18e8855616'
 or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)'::regprocedure)<>'536907c5180776daadcad3451d54d63c'
 or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_accept_ai_task_review(uuid,text,uuid)'::regprocedure)<>'98483642cd4d0c56202c501d2e3f5ffc'
 or (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid='public.rpc_claim_ai_task_review_evaluation_service(uuid,uuid,uuid,integer,jsonb)'::regprocedure)<>'65d606ba10864f51f0e35fa1aaae3034'
 then raise exception 'IDENTITY_WRITER_PREDECESSOR_DRIFT';end if;
 insert into identity145_predecessor values(s,pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure));
end $pre$;

-- Preserve the shared value validator: old true facts must remain readable in
-- an exact review so their owner can explicitly supersede them with false.
-- The sole INSERT exception copies an already-existing true Need through the
-- canonical owned edit opener; it does not attest identity or permit publishing.
do $facts$ declare d text;needle text:='perform private.validate_need_v2_fact(new.fact_key,new.fact_value);';begin
 d:=pg_get_functiondef('private.guard_ai_fact_schema()'::regprocedure);
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'IDENTITY_FACT_ANCHOR_DRIFT';end if;
 execute replace(d,needle,needle||$guard$
    if new.fact_key='need.verified_identity_required' and new.fact_value='true'::jsonb
     and (tg_op='INSERT' or new.fact_key is distinct from old.fact_key or new.fact_value is distinct from old.fact_value
      or new.conversation_id is distinct from old.conversation_id or new.fact_schema_version is distinct from old.fact_schema_version)
     and (tg_op='INSERT' and new.source='SYSTEM_DERIVED' and new.status='CONFIRMED'
      and new.confirmed_by_user_id=new.account_id and new.confirmed_at is not null
      and exists(select 1 from public.ai_conversations c join public.needs n on n.id=c.bound_need_id
       where c.id=new.conversation_id and c.account_id=new.account_id and n.requester_account_id=c.account_id
        and n.id=new.subject_need_id and n.verified_identity_required and c.purpose='NEED_INTAKE'
        and c.fact_schema_version='NEED_FACT_V2' and c.status='OPEN')) is not true
    then raise exception 'IDENTITY_VERIFICATION_UNAVAILABLE' using errcode='22023';end if;$guard$);
end $facts$;

create function private.guard_unavailable_identity_requirement_v5() returns trigger
language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if new.verified_identity_required then
  if tg_op='INSERT' then raise exception 'IDENTITY_VERIFICATION_UNAVAILABLE' using errcode='22023';end if;
  if new.verified_identity_required is distinct from old.verified_identity_required
   or ((new.status in('DRAFT','PUBLISHED') or (new.status='SELECTION' and old.status<>'ACTIVE'))
    and (new.status is distinct from old.status or new.revision is distinct from old.revision))
  then raise exception 'IDENTITY_VERIFICATION_UNAVAILABLE' using errcode='22023';end if;
 end if;
 -- Existing ACTIVE→SELECTION cancellation is a safe exit, not new selection.
 return new;
end $f$;
revoke all on function private.guard_unavailable_identity_requirement_v5() from public,anon,authenticated,service_role;
create trigger guard_unavailable_identity_requirement_v5_trg before insert or update on public.needs
for each row execute function private.guard_unavailable_identity_requirement_v5();

do $review$ declare d text;needle text;predicate text:=$p$not exists(select 1 from jsonb_array_elements(facts) identity_fact
 where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb)$p$;begin
 d:=pg_get_functiondef('public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)'::regprocedure);
 needle:='and r.source_hash=source_fingerprint and r.policy_binding=policy and r.expires_at>clock_timestamp()';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'IDENTITY_REVIEW_REUSE_ANCHOR_DRIFT';end if;
 d:=replace(d,needle,needle||E'\n  and ('||predicate||' or r.envelope->''canAccept''=''false''::jsonb)');
 needle:='''canAccept'',jsonb_array_length(missing)=0 and location is not null and review->>''safety''<>''BLOCK''';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'IDENTITY_REVIEW_READY_ANCHOR_DRIFT';end if;
 execute replace(d,needle,needle||E'\n   and '||predicate);
 d:=pg_get_functiondef('public.rpc_accept_ai_task_review(uuid,text,uuid)'::regprocedure);
 needle:='if r.envelope->''canAccept'' is distinct from ''true''::jsonb then raise exception ''TASK_REVIEW_INCOMPLETE'' using errcode=''22023''; end if;';
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'IDENTITY_ACCEPT_ANCHOR_DRIFT';end if;
 execute replace(d,needle,$deny$if exists(select 1 from jsonb_array_elements(r.envelope->'publicProjection') identity_fact
  where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb)
 then raise exception 'IDENTITY_VERIFICATION_UNAVAILABLE' using errcode='22023';end if;
 $deny$||needle);
end $review$;

-- A canonical ACCEPTED receipt has not dispatched evaluation. Reject the
-- unsupported immutable review under its existing command lock before any
-- new evaluation claim. Existing EVALUATING/terminal receipts remain readback.
do $evaluation$ declare d text;needle text:='if r.policy_binding is distinct from private.ai_task_review_policy(r.envelope#>>''{location,taskCountryCode}'')';begin
 d:=pg_get_functiondef('public.rpc_claim_ai_task_review_evaluation_service(uuid,uuid,uuid,integer,jsonb)'::regprocedure);
 if length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'IDENTITY_EVALUATION_ANCHOR_DRIFT';end if;
 execute replace(d,needle,$deny$if exists(select 1 from jsonb_array_elements(r.envelope->'publicProjection') identity_fact
  where identity_fact->>'key'='need.verified_identity_required' and identity_fact->'value'='true'::jsonb)
 then raise exception 'IDENTITY_VERIFICATION_UNAVAILABLE' using errcode='22023';end if;
 $deny$||needle);
end $evaluation$;

-- Explicit source admission only. The guard remains the same existing INSERT/
-- column-UPDATE trigger with the same role/search_path/argument restrictions.
-- Closure's full trigger digest captures the new Need guard. No retention
-- candidate or deletion/hold rule is relaxed, and no old review/fact is rewritten.
do $rebind$ declare old_sha text;new_sha text;d text;new_guard_md5 text;
 needle text:='public.ai_structured_facts:guard_ai_fact_schema_trg:23:guard_ai_fact_schema:b2386ca23e82d730f876ea18e8855616';begin
 select sha,ready_definition into strict old_sha,d from identity145_predecessor;
 if(select sha256 from private.closure_source_v5 where singleton) is distinct from old_sha
 or length(d)-length(replace(d,old_sha,''))<>length(old_sha)
 or length(d)-length(replace(d,needle,''))<>length(needle) then raise exception 'IDENTITY_SOURCE_BINDING_INVALID';end if;
 select md5(prosrc) into strict new_guard_md5 from pg_proc where oid='private.guard_ai_fact_schema()'::regprocedure;
 new_sha:=private.closure_source_digest_v5();if new_sha is null then raise exception 'IDENTITY_SOURCE_BINDING_INVALID';end if;
 update private.closure_source_v5 set sha256=new_sha where singleton;
 execute replace(replace(d,old_sha,new_sha),needle,'public.ai_structured_facts:guard_ai_fact_schema_trg:23:guard_ai_fact_schema:'||new_guard_md5);
 if private.retention_ai_source_ready() is distinct from true then raise exception 'IDENTITY_SOURCE_NOT_READY';end if;
end $rebind$;
notify pgrst,'reload schema';
commit;
