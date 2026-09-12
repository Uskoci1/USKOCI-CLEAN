-- PRE-V3 P4: one semantic event owner per persisted action. Candidate117, NOT LIVE.
-- No historical event rewrite, no extra Agreement acceptance, no provider/scheduler.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
declare r record;
begin
 for r in select * from (values
 ('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)','ecd81d84f6607c6cae8e5488f4d72f86'),
 ('public.rpc_mark_response_viewed(uuid)','5cb1ae5354cff4688492d50dd3e912e1'),
 ('public.rpc_cancel_agreement(uuid,text)','1ead8a5773b01f777577eb1b4c1b2895'),
 ('private.after_need_revision()','4289de3429b4bfae503e2cd817ece37c')) x(signature,body_md5)
 loop
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure(r.signature)) is distinct from r.body_md5 then
   raise exception 'PRE_V3_EVENT_PREDECESSOR_CHANGED' using detail=r.signature;
  end if;
 end loop;
end;
$preflight$;
-- Add exactly one vocabulary member without weakening the existing check.
do $vocabulary$
declare expression text;
begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
  where conrelid='public.user_activity_events'::regclass and conname='user_activity_events_event_type_check';
 if expression is null or position('CLARIFICATION_ANSWERED' in expression)=0 or position('AGREEMENT_CANCELLED' in expression)>0 then
  raise exception 'PRE_V3_EVENT_VOCABULARY_DRIFT'; end if;
 alter table public.user_activity_events drop constraint user_activity_events_event_type_check;
 execute 'alter table public.user_activity_events add constraint user_activity_events_event_type_check check (('||expression||') or event_type=''AGREEMENT_CANCELLED'')';
end;
$vocabulary$;

-- Version insertion is the single event seam shared by ordinary submit/update
-- and explicit stale-response reconfirmation. Same-key replay inserts no version.
create function private.pre_v3_application_event()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $event$
declare r public.marketplace_responses; owner_id uuid; previous_hash text; kind text;
begin
 select * into r from public.marketplace_responses where id=new.response_id;
 if not found or r.current_version<>new.version then raise exception 'APPLICATION_EVENT_VERSION_MISMATCH'; end if;
 select requester_account_id into owner_id from public.needs where id=r.need_id;
 if owner_id is null then raise exception 'APPLICATION_EVENT_OWNER_MISSING'; end if;
 if new.version=1 then kind:='RESPONSE_RECEIVED';
 else
  select content_hash into previous_hash from public.marketplace_response_versions
   where response_id=new.response_id and version=new.version-1;
  if not found then raise exception 'APPLICATION_EVENT_PREDECESSOR_MISSING'; end if;
  -- A different request ID with identical persisted semantics is not an update notification.
  if previous_hash is not distinct from new.content_hash then return new; end if;
  kind:='RESPONSE_UPDATED';
 end if;
 perform private.emit_event(owner_id,'REQUESTER',kind,'RESPONSE',r.id,new.version,
  case when kind='RESPONSE_RECEIVED' then 'Nova prijava' else 'Prijava je izmenjena' end,
  case when kind='RESPONSE_RECEIVED' then 'Imate novu prijavu za Zadatak.' else 'Pregledajte aktuelne uslove prijave.' end,
  case when kind='RESPONSE_RECEIVED' then 'response-received:' else 'response-updated:' end||r.id::text||':'||new.version::text,
  'NORMAL',jsonb_build_object('needId',r.need_id,'responseId',r.id,'responseVersion',new.version),null);
 return new;
end;
$event$;
revoke all on function private.pre_v3_application_event() from public,anon,authenticated,service_role;
create trigger pre_v3_application_event after insert on public.marketplace_response_versions
 for each row execute function private.pre_v3_application_event();
-- Remove only the old duplicate/misclassified emission. All submit validations,
-- locks, snapshots, idempotency and result shape remain byte-for-byte intact.
do $submit$
declare definition text; needle text := $old$  perform private.emit_event(
    n.requester_account_id,
    'REQUESTER',
    'RESPONSE_RECEIVED',
    'RESPONSE',
    v_resp.id,
    v_version,
    'Nova prijava',
    'Imate novu prijavu za Potrebu.',
    'response-received:' || v_resp.id::text || ':' || v_version::text,
    'NORMAL',
    jsonb_build_object(
      'needId', n.id,
      'responseId', v_resp.id,
      'responseVersion', v_version
    ),
    null
  );$old$;
begin
 definition:=pg_get_functiondef('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'::regprocedure);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'APPLICATION_EVENT_ANCHOR_DRIFT'; end if;
 execute replace(definition,needle,'  -- PRE-V3: persisted version trigger owns Application semantic events.');
end;
$submit$;

-- First intentional view per Application, not per list read or refresh.
create or replace function public.rpc_mark_response_viewed(p_response_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog
as $view$
declare actor uuid:=auth.uid(); need_id uuid; n public.needs; r public.marketplace_responses;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select x.need_id into need_id from public.marketplace_responses x where x.id=p_response_id;
 if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;
 -- Need then Response: compatible with submit/selection/revision/cancellation.
 select * into n from public.needs where id=need_id for share;
 if not found or n.requester_account_id<>actor then raise exception 'NOT_REQUESTER' using errcode='42501'; end if;
 select * into r from public.marketplace_responses where id=p_response_id for update;
 if not found then raise exception 'RESPONSE_NOT_FOUND' using errcode='P0002'; end if;
 if r.status='DRAFT' then raise exception 'RESPONSE_NOT_SUBMITTED' using errcode='P0001'; end if;
 if r.viewed_at is not null or r.status not in('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then return; end if;
 update public.marketplace_responses set status=case when status in('SUBMITTED','DELIVERED') then 'VIEWED' else status end,
  viewed_at=statement_timestamp() where id=r.id;
 perform private.emit_event(r.worker_account_id,'WORKER','RESPONSE_VIEWED','RESPONSE',r.id,r.current_version,
  'Prijava je pregledana','Naručilac je pregledao Vašu prijavu.',
  'response-viewed:'||r.id::text,'NORMAL',jsonb_build_object('needId',r.need_id,'responseId',r.id),null);
end;
$view$;

-- Emit AFTER cancellation expires older pending deliveries. Emitting at the
-- Agreement UPDATE trigger would immediately expire the new cancellation push.
do $cancel$
declare definition text; needle text := $old$    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
end;$old$;
begin
 definition:=pg_get_functiondef('public.rpc_cancel_agreement(uuid,text)'::regprocedure);
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>1 then raise exception 'AGREEMENT_CANCEL_EVENT_ANCHOR_DRIFT'; end if;
 execute replace(definition,needle,$new$    perform private.enqueue_dispatch(v_need.id, statement_timestamp());
  end if;
  perform private.emit_event(
    case when uid=v_agr.requester_account_id then v_agr.worker_account_id else v_agr.requester_account_id end,
    case when uid=v_agr.requester_account_id then 'WORKER' else 'REQUESTER' end,
    'AGREEMENT_CANCELLED','AGREEMENT',v_agr.id,v_agr.current_version,
    'Dogovor je otkazan','Druga strana je otkazala Dogovor.',
    'agreement-cancelled:'||v_agr.id::text,'NORMAL',
    jsonb_build_object('agreementId',v_agr.id,'state','CANCELLED'),null);
end;$new$);
end;
$cancel$;

create or replace function private.after_need_revision()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $revision$
declare r record;
begin
 if new.revision>old.revision then
  for r in with affected as (
   update public.marketplace_responses set status='STALE_REVIEW_REQUIRED'
    where need_id=new.id and submitted_against_need_revision=old.revision
     and status in('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
    returning id,worker_account_id,current_version)
   select distinct on(worker_account_id) * from affected order by worker_account_id,id
  loop
   -- Own Application is the safe target even while the revised Need is DRAFT.
   perform private.emit_event(r.worker_account_id,'WORKER','NEED_REVISED','RESPONSE',r.id,new.revision,
    'Zadatak je izmenjen','Pregledajte svoju prijavu pre nastavka.',
    'need-revised:'||new.id::text||':'||new.revision::text||':worker:'||r.worker_account_id::text,
    'NORMAL',jsonb_build_object('needId',new.id,'responseId',r.id,'fromRevision',old.revision,'needRevision',new.revision),null);
  end loop;
  update public.opportunity_deliveries set status='EXPIRED'
   where need_id=new.id and need_revision=old.revision and status in('READY','SEEN');
  update public.dispatch_rounds set status='STOPPED',stop_reason='NEED_REVISED'
   where need_id=new.id and need_revision=old.revision and status in('PLANNED','SENT');
  -- Never dispatch or auto-publish a newly revised DRAFT.
 end if;
 return new;
end;
$revision$;

create or replace function public.rpc_resolve_activity_event(p_event_id uuid)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog
as $target$
declare
  v_uid uuid := auth.uid();
  e public.user_activity_events%rowtype;
  a public.agreements%rowtype;
  r public.marketplace_responses%rowtype;
  n public.needs%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into e from public.user_activity_events where id=p_event_id and recipient_user_id=v_uid
    and exists(select 1 from public.notification_deliveries d where d.event_id=public.user_activity_events.id
      and d.recipient_user_id=v_uid and d.channel='IN_APP' and d.state<>'SUPPRESSED');
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode='P0002'; end if;
  if e.entity_type='AGREEMENT' then
    select * into a from public.agreements where id=e.entity_id
      and v_uid in (requester_account_id,worker_account_id);
    if found then return jsonb_build_object('kind','AGREEMENT','id',a.id,'role',e.recipient_role); end if;
  elsif e.entity_type='RESPONSE' then
    select * into r from public.marketplace_responses where id=e.entity_id;
    if found then
      select * into a from public.agreements where selected_response_id=r.id
        and v_uid in (requester_account_id,worker_account_id) order by created_at desc,id desc limit 1;
      if found then return jsonb_build_object('kind','AGREEMENT','id',a.id,'role',e.recipient_role); end if;
      if r.worker_account_id=v_uid then return jsonb_build_object('kind','APPLICATIONS','id',r.id,'role','WORKER'); end if;
      select * into n from public.needs where id=r.need_id and requester_account_id=v_uid;
      if found then return jsonb_build_object('kind','CANDIDATES','id',n.id,'role','REQUESTER'); end if;
    end if;
  elsif e.entity_type='CLARIFICATION' then
    -- Only the existing safe context ID; current Need RLS is checked again.
    if coalesce(e.payload->>'needId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return jsonb_build_object('kind','UNAVAILABLE'); end if;
    select * into n from public.needs where id=(e.payload->>'needId')::uuid;
    if found then return jsonb_build_object('kind',case when n.requester_account_id=v_uid then 'OWN_NEED' else 'OPPORTUNITY' end,
      'id',n.id,'role',case when n.requester_account_id=v_uid then 'REQUESTER' else 'WORKER' end); end if;
  elsif e.entity_type='NEED' then
    select * into n from public.needs where id=e.entity_id;
    if found then return jsonb_build_object('kind',case when n.requester_account_id=v_uid then 'OWN_NEED' else 'OPPORTUNITY' end,
      'id',n.id,'role',case when n.requester_account_id=v_uid then 'REQUESTER' else 'WORKER' end); end if;
  end if;
  return jsonb_build_object('kind','UNAVAILABLE');
end
$target$;

revoke all on function public.rpc_mark_response_viewed(uuid) from public,anon,service_role;
grant execute on function public.rpc_mark_response_viewed(uuid) to authenticated;
revoke all on function private.after_need_revision() from public,anon,authenticated,service_role;
-- Preserve the invoker resolver, existing RLS and authenticated-only surface.
revoke all on function public.rpc_resolve_activity_event(uuid) from public,anon,service_role;
grant execute on function public.rpc_resolve_activity_event(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
