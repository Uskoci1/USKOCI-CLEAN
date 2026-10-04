-- USKOČI CONTROL v0.6 — SOURCE ONLY / DO NOT APPLY.
begin;
set local lock_timeout='3s'; set local statement_timeout='8s'; set local search_path=pg_catalog;

create or replace function public.rpc_control_notification_v1(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare e public.user_activity_events; prefs jsonb; deliveries jsonb; attempts jsonb; readiness jsonb;
begin
 if p_event_id is null then raise exception 'CONTROL_EVENT_ID_REQUIRED' using errcode='22023'; end if;
 select * into e from public.user_activity_events where id=p_event_id;
 if not found then raise exception 'CONTROL_EVENT_NOT_FOUND' using errcode='P0002'; end if;

 select jsonb_build_object(
   'inAppEnabled',p.in_app_enabled,'pushEnabled',p.push_enabled,
   'quietHoursEnabled',p.quiet_hours_enabled,'quietTimezone',p.quiet_timezone,
   'urgentOverridesQuietHours',p.urgent_overrides_quiet_hours
 ) into prefs
 from public.notification_preferences p
 where p.user_id=e.recipient_user_id and p.role_context=e.recipient_role;

 select coalesce(jsonb_agg(jsonb_build_object(
   'deliveryId',d.id,'channel',d.channel,'priority',d.priority,'state',d.state,
   'suppressionReason',d.suppression_reason,'createdAt',d.created_at,'queuedAt',d.queued_at,
   'sentAt',d.sent_at,'deliveredAt',d.delivered_at,'readAt',d.read_at,'expiresAt',d.expires_at,
   'contentExposed',false
 ) order by d.created_at,d.id),'[]'::jsonb) into deliveries
 from public.notification_deliveries d where d.event_id=e.id;

 select coalesce(jsonb_agg(jsonb_build_object(
   'attemptId',a.id,'deliveryId',a.delivery_id,'attemptNo',a.attempt_no,'provider',a.provider,
   'platform',dev.platform,'outcome',a.outcome,'transportState',a.transport_state,
   'sendCount',a.send_count,'nextAttemptAt',a.next_attempt_at,'ticketReceivedAt',a.ticket_received_at,
   'receiptCheckedAt',a.receipt_checked_at,'errorCode',a.error_code,'createdAt',a.created_at,
   'tokenExposed',false,'providerTicketExposed',false
 ) order by a.created_at,a.id),'[]'::jsonb) into attempts
 from public.notification_push_attempts a
 join public.notification_deliveries d on d.id=a.delivery_id
 left join public.notification_push_devices dev on dev.id=a.device_id
 where d.event_id=e.id;

 begin readiness:=public.rpc_get_push_readiness(); exception when others then
   readiness:=jsonb_build_object('state','UNKNOWN','reason','READINESS_UNAVAILABLE','evidenceScope','TRANSPORT_ONLY');
 end;

 return jsonb_build_object(
  'schemaVersion','CONTROL_NOTIFICATION_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
  'event',jsonb_build_object('eventId',e.id,'recipientUserId',e.recipient_user_id,'recipientRole',e.recipient_role,
    'eventType',e.event_type,'entityType',e.entity_type,'entityId',e.entity_id,'entityVersion',e.entity_version,
    'urgency',e.urgency,'createdAt',e.created_at,'payloadExposed',false),
  'preferences',prefs,'deliveries',deliveries,'pushAttempts',attempts,'transportReadiness',readiness,
  'deviceDeliveryProof','UNKNOWN',
  'privacy',jsonb_build_object('containsNotificationBody',false,'containsPushToken',false,'containsProviderTicketId',false,'containsChatBody',false)
 );
end;
$f$;

create or replace function public.rpc_control_ai_v1(p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare c public.ai_conversations; message_meta jsonb; facts jsonb; proposals jsonb;
begin
 if p_conversation_id is null then raise exception 'CONTROL_AI_ID_REQUIRED' using errcode='22023'; end if;
 select * into c from public.ai_conversations where id=p_conversation_id;
 if not found then raise exception 'CONTROL_AI_NOT_FOUND' using errcode='P0002'; end if;

 select jsonb_build_object(
   'count',count(*)::bigint,
   'userCount',count(*) filter(where role='USER')::bigint,
   'assistantCount',count(*) filter(where role='ASSISTANT')::bigint,
   'lastMessageAt',max(created_at),
   'safetyByState',coalesce((select jsonb_object_agg(safety,n order by safety) from (
      select coalesce(safety,'NONE') safety,count(*)::bigint n
      from public.ai_messages where conversation_id=c.id group by coalesce(safety,'NONE')
   )x),'{}'::jsonb),
   'recent',coalesce((select jsonb_agg(jsonb_build_object('messageId',m.id,'sequence',m.sequence_no,'role',m.role,
      'safety',m.safety,'createdAt',m.created_at,'bodyExposed',false) order by m.sequence_no desc)
      from (select * from public.ai_messages where conversation_id=c.id order by sequence_no desc limit 20)m),'[]'::jsonb)
 ) into message_meta from public.ai_messages where conversation_id=c.id;

 select jsonb_build_object(
   'activeCount',count(*) filter(where superseded_at is null)::bigint,
   'byStatus',coalesce((select jsonb_object_agg(status,n order by status) from (
      select status,count(*)::bigint n from public.ai_structured_facts where conversation_id=c.id and superseded_at is null group by status
   )x),'{}'::jsonb),
   'bySource',coalesce((select jsonb_object_agg(source,n order by source) from (
      select source,count(*)::bigint n from public.ai_structured_facts where conversation_id=c.id and superseded_at is null group by source
   )x),'{}'::jsonb),
   'activeKeys',coalesce((select jsonb_agg(fact_key order by fact_key) from public.ai_structured_facts
      where conversation_id=c.id and superseded_at is null),'[]'::jsonb),
   'valuesExposed',false,'evidenceExposed',false
 ) into facts from public.ai_structured_facts where conversation_id=c.id;

 select coalesce(jsonb_object_agg(status,n order by status),'{}'::jsonb) into proposals
 from (select status,count(*)::bigint n from public.ai_action_proposals where conversation_id=c.id group by status)x;

 return jsonb_build_object(
  'schemaVersion','CONTROL_AI_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
  'conversation',jsonb_build_object('conversationId',c.id,'accountId',c.account_id,'purpose',c.purpose,'status',c.status,
    'boundNeedId',c.bound_need_id,'createdAt',c.created_at,'completedAt',c.completed_at),
  'messages',message_meta,'facts',facts,'actionProposalsByStatus',proposals,
  'providerMetrics',jsonb_build_object('state','UNKNOWN','reason','NO_CANONICAL_PROVIDER_COST_LATENCY_PROJECTION'),
  'privacy',jsonb_build_object('containsMessageBody',false,'containsFactValue',false,'containsEvidenceExcerpt',false)
 );
end;
$f$;

revoke all on function public.rpc_control_notification_v1(uuid),public.rpc_control_ai_v1(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.rpc_control_notification_v1(uuid),public.rpc_control_ai_v1(uuid) to service_role;
rollback;
