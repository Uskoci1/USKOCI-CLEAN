-- USKOČI CONTROL v0.5 — SOURCE-ONLY Search/User/Task/Agreement inspectors.
-- DO NOT APPLY. Must pass canonical DEV readback + ACL/RLS + EXPLAIN proof first.
begin;
set local lock_timeout='3s';
set local statement_timeout='8s';
set local search_path=pg_catalog;

create or replace function public.rpc_control_search_v1(p_query text,p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $f$
declare
  q text:=lower(btrim(coalesce(p_query,'')));
  lim integer:=least(greatest(coalesce(p_limit,20),1),20);
  qid uuid;
  digits text;
begin
  if char_length(q) not between 2 and 160 then
    raise exception 'CONTROL_SEARCH_QUERY_INVALID' using errcode='22023';
  end if;
  if q ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then qid:=q::uuid; end if;
  digits:=regexp_replace(q,'[^0-9]+','','g');
  return (
    with candidates as (
      select 0 as rank,a.created_at as sort_at,a.id,
        jsonb_build_object('kind','USER','id',a.id,'label',coalesce(nullif(a.full_name,''),'Korisnik'),
          'secondary',coalesce(nullif(a.city,''),'—'),'state',case when a.onboarding_complete then 'ONBOARDED' else 'ONBOARDING' end,
          'matchKind',case when qid=a.id then 'ID' when lower(a.email)=q then 'EMAIL_EXACT'
            when char_length(digits)>=6 and regexp_replace(a.phone,'[^0-9]+','','g')=digits then 'PHONE_EXACT' else 'NAME_PREFIX' end) payload
      from public.app_accounts a
      where a.id=qid or lower(a.full_name) like q||'%' or lower(a.email)=q
        or (char_length(digits)>=6 and regexp_replace(a.phone,'[^0-9]+','','g')=digits)
      union all
      select case when qid=n.id then 1 else 20 end,n.created_at,n.id,
        jsonb_build_object('kind','TASK','id',n.id,'label',n.title,'secondary',coalesce(nullif(n.approximate_city,''),'—'),
          'state',n.status,'matchKind',case when qid=n.id then 'ID' else 'TITLE_PREFIX' end) payload
      from public.needs n
      where n.id=qid or lower(n.title) like q||'%'
      union all
      select case when qid=r.id then 2 else 30 end,r.created_at,r.id,
        jsonb_build_object('kind','APPLICATION','id',r.id,'label',n.title,'secondary',r.response_kind,
          'state',r.status,'needId',r.need_id,'matchKind',case when qid=r.id then 'ID' else 'TASK_TITLE_PREFIX' end) payload
      from public.marketplace_responses r join public.needs n on n.id=r.need_id
      where r.id=qid or lower(n.title) like q||'%'
      union all
      select case when qid=a.id then 3 else 40 end,a.created_at,a.id,
        jsonb_build_object('kind','AGREEMENT','id',a.id,'label',n.title,'secondary','Dogovor',
          'state',a.status,'needId',a.need_id,'matchKind',case when qid=a.id then 'ID' else 'TASK_TITLE_PREFIX' end) payload
      from public.agreements a join public.needs n on n.id=a.need_id
      where a.id=qid or lower(n.title) like q||'%'
    ), ranked as (
      select * from candidates order by rank,sort_at desc,id limit lim+1
    )
    select jsonb_build_object(
      'schemaVersion','CONTROL_SEARCH_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
      'items',coalesce((select jsonb_agg(payload order by rank,sort_at desc,id) from (select * from ranked order by rank,sort_at desc,id limit lim) x),'[]'::jsonb),
      'hasMore',(select count(*)>lim from ranked),
      'privacy',jsonb_build_object('returnsEmail',false,'returnsPhone',false,'returnsExactAddress',false,'returnsMessageBody',false)
    )
  );
end;
$f$;

create or replace function public.rpc_control_user_v1(p_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $f$
declare account_doc jsonb; profiles_doc jsonb; needs_doc jsonb; responses_doc jsonb;
agreements_doc jsonb; reputation_doc jsonb; events_doc jsonb;
begin
  if p_account_id is null then raise exception 'CONTROL_USER_ID_REQUIRED' using errcode='22023'; end if;
  select jsonb_build_object('id',a.id,'fullName',a.full_name,'city',a.city,'activeMode',a.active_mode,
    'onboardingComplete',a.onboarding_complete,'createdAt',a.created_at)
    into account_doc from public.app_accounts a where a.id=p_account_id;
  if account_doc is null then raise exception 'CONTROL_USER_NOT_FOUND' using errcode='P0002'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'kind',p.kind,'displayName',p.display_name,'city',p.city,'headline',p.headline,
    'profileStatus',p.profile_status,'skills',to_jsonb(p.skills),'tools',to_jsonb(p.tools),
    'vehicles',to_jsonb(p.vehicles),'licenses',to_jsonb(p.licenses),'radiusKm',p.radius_km,
    'availableNow',p.available_now,'teamCapacity',p.team_capacity,'createdAt',p.created_at
  ) order by p.kind),'[]'::jsonb) into profiles_doc
  from public.app_profiles p where p.account_id=p_account_id;

  select coalesce(jsonb_object_agg(status,n order by status),'{}'::jsonb) into needs_doc
  from (select status,count(*)::bigint n from public.needs where requester_account_id=p_account_id group by status) s;

  select coalesce(jsonb_object_agg(status,n order by status),'{}'::jsonb) into responses_doc
  from (select status,count(*)::bigint n from public.marketplace_responses where worker_account_id=p_account_id group by status) s;

  select coalesce(jsonb_object_agg(role_status,n order by role_status),'{}'::jsonb) into agreements_doc
  from (
    select 'REQUESTER:'||status role_status,count(*)::bigint n from public.agreements where requester_account_id=p_account_id group by status
    union all
    select 'WORKER:'||status role_status,count(*)::bigint n from public.agreements where worker_account_id=p_account_id group by status
  ) s;

  select jsonb_build_object('receivedCount',count(*)::bigint,
    'averageRating',case when count(*)=0 then null else round(avg(rating),2) end,
    'givenCount',(select count(*)::bigint from private.agreement_reviews where reviewer_account_id=p_account_id))
    into reputation_doc from private.agreement_reviews where target_account_id=p_account_id;

  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'eventType',e.event_type,'entityType',e.entity_type,
    'entityId',e.entity_id,'urgency',e.urgency,'recipientRole',e.recipient_role,'createdAt',e.created_at)
    order by e.created_at desc,e.id desc),'[]'::jsonb) into events_doc
  from (select * from public.user_activity_events where recipient_user_id=p_account_id order by created_at desc,id desc limit 25) e;

  return jsonb_build_object(
    'schemaVersion','CONTROL_USER_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
    'account',account_doc,'profiles',profiles_doc,
    'counts',jsonb_build_object('needsByStatus',needs_doc,'applicationsByStatus',responses_doc,'agreementsByRoleStatus',agreements_doc),
    'reputation',reputation_doc,
    'recentReceivedEvents',events_doc,
    'lastActivity',null,'lastActivityState','UNKNOWN','lastActivityReason','NO_CANONICAL_CROSS_APP_ACTIVITY_SIGNAL',
    'privacy',jsonb_build_object('containsEmail',false,'containsPhone',false,'containsExactAddress',false,'containsPushToken',false,'containsChatBody',false)
  );
end;
$f$;

create or replace function public.rpc_control_task_v1(p_need_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $f$
declare n public.needs; task_doc jsonb; responses_doc jsonb; selections_doc jsonb; agreements_doc jsonb; events_doc jsonb; covered integer;
begin
  if p_need_id is null then raise exception 'CONTROL_TASK_ID_REQUIRED' using errcode='22023'; end if;
  select * into n from public.needs where id=p_need_id;
  if not found then raise exception 'CONTROL_TASK_NOT_FOUND' using errcode='P0002'; end if;
  covered:=public.fn_need_covered_slots(n.id);

  task_doc:=jsonb_build_object(
    'id',n.id,'status',n.status,'title',n.title,'category',n.category,'revision',n.revision,
    'city',n.approximate_city,'area',n.approximate_area,'scheduleKind',n.schedule_kind,
    'startsAt',n.starts_at,'endsAt',n.ends_at,'responseDeadline',n.response_deadline,
    'requiredSlots',n.required_slots,'coveredSlots',covered,'mode',n.mode,'requesterPriceRsd',n.requester_price_rsd,
    'requiredSkills',to_jsonb(n.required_skills),'requiredTools',to_jsonb(n.required_tools),'requiredVehicles',to_jsonb(n.required_vehicles),
    'urgent',n.urgent,'urgentExpiresAt',n.urgent_expires_at,'executionLocationMode',n.execution_location_mode,
    'hasExactLocation',exists(select 1 from public.need_sensitive s where s.need_id=n.id and (s.exact_address<>'' or s.exact_lat is not null or s.exact_lng is not null)),
    'createdAt',n.created_at,'publishedAt',n.published_at
  );

  select coalesce(jsonb_object_agg(status,n order by status),'{}'::jsonb) into responses_doc
    from (select status,count(*)::bigint n from public.marketplace_responses where need_id=p_need_id group by status) s;

  select jsonb_build_object(
    'byStatus',coalesce((select jsonb_object_agg(status,n order by status) from
      (select status,count(*)::bigint n from public.need_selections where need_id=p_need_id group by status) x),'{}'::jsonb),
    'selectedSlots',coalesce((select sum(covered_slots)::bigint from public.need_selections where need_id=p_need_id and status='SELECTED'),0)
  ) into selections_doc;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'status',a.status,'currentVersion',a.current_version,'workerAccountId',a.worker_account_id,
    'workerDisplayName',wp.display_name,'createdAt',a.created_at
  ) order by a.created_at desc,a.id desc),'[]'::jsonb) into agreements_doc
  from public.agreements a join public.app_profiles wp on wp.id=a.worker_profile_id
  where a.need_id=p_need_id;

  select coalesce(jsonb_agg(jsonb_build_object('eventType',e.event_type,'entityType',e.entity_type,'urgency',e.urgency,
    'recipientRole',e.recipient_role,'createdAt',e.created_at) order by e.created_at desc,e.id desc),'[]'::jsonb) into events_doc
  from (select * from public.user_activity_events where entity_type='NEED' and entity_id=p_need_id order by created_at desc,id desc limit 50) e;

  return jsonb_build_object(
    'schemaVersion','CONTROL_TASK_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
    'task',task_doc,'applicationsByStatus',responses_doc,'selections',selections_doc,'agreements',agreements_doc,
    'coverage',jsonb_build_object('requiredSlots',n.required_slots,'coveredSlots',covered,
      'state',case when covered>=n.required_slots then 'FULL' when covered>0 then 'PARTIAL' else 'EMPTY' end),
    'searchAuthority',jsonb_build_object('state','UNKNOWN','reason','REQUIRES_CANONICAL_SEARCH_AUTHORITY_READBACK'),
    'recentNeedEvents',events_doc,
    'privacy',jsonb_build_object('containsExactAddress',false,'containsExactCoordinates',false,'containsChatBody',false)
  );
end;
$f$;

create or replace function public.rpc_control_agreement_v1(p_agreement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog
as $f$
declare a public.agreements; av public.agreement_versions; ex public.agreement_execution; n public.needs;
requester_doc jsonb; worker_doc jsonb; msg_doc jsonb; review_doc jsonb;
begin
  if p_agreement_id is null then raise exception 'CONTROL_AGREEMENT_ID_REQUIRED' using errcode='22023'; end if;
  select * into a from public.agreements where id=p_agreement_id;
  if not found then raise exception 'CONTROL_AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  select * into av from public.agreement_versions where agreement_id=a.id and version=a.current_version;
  if not found then raise exception 'CONTROL_AGREEMENT_VERSION_MISSING' using errcode='P0001'; end if;
  select * into n from public.needs where id=a.need_id;
  select * into ex from public.agreement_execution where agreement_id=a.id;

  select jsonb_build_object('accountId',p.account_id,'profileId',p.id,'displayName',p.display_name,'city',p.city)
    into requester_doc from public.app_profiles p where p.id=a.requester_profile_id;
  select jsonb_build_object('accountId',p.account_id,'profileId',p.id,'displayName',p.display_name,'city',p.city)
    into worker_doc from public.app_profiles p where p.id=a.worker_profile_id;

  select jsonb_build_object('count',count(*)::bigint,'lastMessageAt',max(created_at))
    into msg_doc from public.agreement_messages where agreement_id=a.id;

  select jsonb_build_object('count',count(*)::bigint,'requesterSubmitted',bool_or(reviewer_account_id=a.requester_account_id),
    'workerSubmitted',bool_or(reviewer_account_id=a.worker_account_id))
    into review_doc from private.agreement_reviews where agreement_id=a.id;

  return jsonb_build_object(
    'schemaVersion','CONTROL_AGREEMENT_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
    'agreement',jsonb_build_object('id',a.id,'needId',a.need_id,'status',a.status,'currentVersion',a.current_version,'createdAt',a.created_at),
    'task',jsonb_build_object('title',n.title,'city',n.approximate_city,'area',n.approximate_area,
      'hasExactLocation',exists(select 1 from public.need_sensitive s where s.need_id=n.id and (s.exact_address<>'' or s.exact_lat is not null or s.exact_lng is not null))),
    'requester',requester_doc,'worker',worker_doc,
    'acceptedTerms',jsonb_build_object(
      'priceRsd',av.terms->'price_rsd','coveredSlots',av.terms->'covered_slots',
      'proposedStartAt',av.terms->'proposed_start_at','proposedEndAt',av.terms->'proposed_end_at',
      'needRevision',av.terms->'need_revision','responseVersion',av.terms->'response_version'
    ),
    'execution',case when ex.agreement_id is null then null else jsonb_build_object(
      'state',ex.state,'mode',ex.mode,'workerMarkedDoneAt',ex.worker_marked_done_at,
      'requesterDeadlineAt',ex.requester_deadline_at,'problemOpenedAt',ex.problem_opened_at,'completedAt',ex.completed_at) end,
    'messages',msg_doc,'reviews',review_doc,
    'privacy',jsonb_build_object('containsMessageBody',false,'containsExactAddress',false,'containsExactCoordinates',false)
  );
end;
$f$;

revoke all on function public.rpc_control_search_v1(text,integer),public.rpc_control_user_v1(uuid),
 public.rpc_control_task_v1(uuid),public.rpc_control_agreement_v1(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.rpc_control_search_v1(text,integer),public.rpc_control_user_v1(uuid),
 public.rpc_control_task_v1(uuid),public.rpc_control_agreement_v1(uuid) to service_role;

comment on function public.rpc_control_search_v1(text,integer) is 'USKOCI CONTROL source-only candidate: bounded owner search. Sensitive identity may be matched server-side but is never returned.';
comment on function public.rpc_control_user_v1(uuid) is 'USKOCI CONTROL source-only candidate: safe user inspector; no email/phone/exact location/chat body.';
comment on function public.rpc_control_task_v1(uuid) is 'USKOCI CONTROL source-only candidate: task lifecycle/coverage inspector; exact location masked.';
comment on function public.rpc_control_agreement_v1(uuid) is 'USKOCI CONTROL source-only candidate: Agreement inspector; message metadata only, exact location masked.';

rollback;
