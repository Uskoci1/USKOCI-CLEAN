-- USKOČI CONTROL v0.9 — Application/Offer Inspector SOURCE ONLY / DO NOT APPLY.
begin;
set local lock_timeout='3s'; set local statement_timeout='8s'; set local search_path=pg_catalog;

create or replace function public.rpc_control_application_v1(p_response_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare r public.marketplace_responses; rv public.marketplace_response_versions; n public.needs;
 worker_doc jsonb; selection_doc jsonb; agreement_doc jsonb; events_doc jsonb;
begin
 if p_response_id is null then raise exception 'CONTROL_APPLICATION_ID_REQUIRED' using errcode='22023'; end if;
 select * into r from public.marketplace_responses where id=p_response_id;
 if not found then raise exception 'CONTROL_APPLICATION_NOT_FOUND' using errcode='P0002'; end if;
 select * into n from public.needs where id=r.need_id;
 select * into rv from public.marketplace_response_versions where response_id=r.id and version=r.current_version;

 select jsonb_build_object('accountId',p.account_id,'profileId',p.id,'displayName',p.display_name,
   'city',p.city,'profileStatus',p.profile_status,'availableNow',p.available_now)
 into worker_doc from public.app_profiles p where p.id=r.worker_profile_id;

 select jsonb_build_object('selectionId',s.id,'status',s.status,'needRevision',s.need_revision,
   'coveredSlots',s.covered_slots,'selectionMode',s.selection_mode,'createdAt',s.created_at)
 into selection_doc from public.need_selections s where s.response_id=r.id order by s.created_at desc limit 1;

 select jsonb_build_object('agreementId',a.id,'status',a.status,'currentVersion',a.current_version,'createdAt',a.created_at)
 into agreement_doc from public.agreements a where a.selected_response_id=r.id order by a.created_at desc limit 1;

 select coalesce(jsonb_agg(jsonb_build_object('eventType',e.event_type,'recipientRole',e.recipient_role,
   'entityVersion',e.entity_version,'urgency',e.urgency,'createdAt',e.created_at,'payloadExposed',false)
   order by e.created_at desc,e.id desc),'[]'::jsonb) into events_doc
 from (select * from public.user_activity_events where entity_type='RESPONSE' and entity_id=r.id
       order by created_at desc,id desc limit 25) e;

 return jsonb_build_object(
  'schemaVersion','CONTROL_APPLICATION_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
  'application',jsonb_build_object(
    'responseId',r.id,'needId',r.need_id,'kind',r.response_kind,'status',r.status,
    'submittedAgainstNeedRevision',r.submitted_against_need_revision,'currentVersion',r.current_version,
    'createdAt',r.created_at,'submittedAt',r.submitted_at,'viewedAt',r.viewed_at,
    'selectedAt',r.selected_at,'withdrawnAt',r.withdrawn_at,
    'staleAgainstCurrentNeed',r.submitted_against_need_revision<>n.revision or r.status='STALE'
  ),
  'task',jsonb_build_object('title',n.title,'status',n.status,'currentRevision',n.revision,
    'city',n.approximate_city,'area',n.approximate_area,'requiredSlots',n.required_slots),
  'worker',worker_doc,
  'currentTerms',case when rv.response_id is null then null else jsonb_build_object(
    'priceRsd',rv.price_rsd,'coveredSlots',rv.covered_slots,
    'proposedStartAt',rv.proposed_start_at,'proposedEndAt',rv.proposed_end_at,
    'scopeNotePresent',nullif(btrim(rv.scope_note),'') is not null,'scopeNoteExposed',false,
    'needRevision',rv.need_revision
  ) end,
  'selection',selection_doc,'agreement',agreement_doc,'recentEvents',events_doc,
  'privacy',jsonb_build_object('containsEmail',false,'containsPhone',false,'containsExactAddress',false,
    'containsChatBody',false,'containsScopeNoteBody',false)
 );
end;
$f$;

revoke all on function public.rpc_control_application_v1(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_control_application_v1(uuid) to service_role;
rollback;
