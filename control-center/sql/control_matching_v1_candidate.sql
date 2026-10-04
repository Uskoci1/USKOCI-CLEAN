-- USKOČI CONTROL v0.7 — Matching/Dispatch Inspector SOURCE ONLY / DO NOT APPLY.
begin;
set local lock_timeout='3s'; set local statement_timeout='8s'; set local search_path=pg_catalog;

create or replace function public.rpc_control_matching_v1(p_need_id uuid,p_worker_profile_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare
 n public.needs; covered integer; rounds jsonb; delivery_summary jsonb; reason_counts jsonb;
 response_counts jsonb; worker_current jsonb; worker_history jsonb; d jsonb;
begin
 if p_need_id is null then raise exception 'CONTROL_MATCHING_NEED_ID_REQUIRED' using errcode='22023'; end if;
 select * into n from public.needs where id=p_need_id;
 if not found then raise exception 'CONTROL_MATCHING_NEED_NOT_FOUND' using errcode='P0002'; end if;
 covered:=public.fn_need_covered_slots(n.id);

 select coalesce(jsonb_agg(jsonb_build_object(
   'roundId',r.id,'needRevision',r.need_revision,'roundNo',r.round_no,'urgency',r.urgency,
   'batchSize',r.batch_size,'targetResponses',r.target_responses,'candidateLimitUsed',r.candidate_limit_used,
   'budgetSource',r.budget_source,'status',r.status,'stopReason',r.stop_reason,
   'deadlineAt',r.deadline_at,'createdAt',r.created_at
 ) order by r.created_at desc,r.id desc),'[]'::jsonb) into rounds
 from (select * from public.dispatch_rounds where need_id=n.id order by created_at desc,id desc limit 20) r;

 select jsonb_build_object(
   'total',count(*)::bigint,
   'uniqueWorkers',count(distinct worker_profile_id)::bigint,
   'byStatus',coalesce((select jsonb_object_agg(status,n order by status) from (
      select status,count(*)::bigint n from public.opportunity_deliveries
      where need_id=n.id and need_revision=n.revision group by status
   )s),'{}'::jsonb),
   'scoreMin',min(match_score),'scoreAvg',round(avg(match_score),2),'scoreMax',max(match_score)
 ) into delivery_summary
 from public.opportunity_deliveries where need_id=n.id and need_revision=n.revision;

 select coalesce(jsonb_object_agg(code,cnt order by code),'{}'::jsonb) into reason_counts
 from (
   select code,count(*)::bigint cnt
   from public.opportunity_deliveries od
   cross join lateral unnest(od.reason_codes) code
   where od.need_id=n.id and od.need_revision=n.revision
   group by code
 )s;

 select coalesce(jsonb_object_agg(status,cnt order by status),'{}'::jsonb) into response_counts
 from (
   select status,count(*)::bigint cnt from public.marketplace_responses
   where need_id=n.id and submitted_against_need_revision=n.revision group by status
 )s;

 if p_worker_profile_id is not null then
   d:=private.match_detail(n.id,p_worker_profile_id);
   worker_current:=jsonb_build_object(
     'workerProfileId',p_worker_profile_id,
     'responseAllowed',coalesce((d->>'responseAllowed')::boolean,false),
     'dispatchEligible',coalesce((d->>'dispatchEligible')::boolean,false),
     'hardBlockers',coalesce(d->'hardBlockers','[]'::jsonb),
     'dispatchBlockers',coalesce(d->'dispatchBlockers','[]'::jsonb),
     'reasonCodes',coalesce(d->'reasonCodes','[]'::jsonb),
     'distanceToStartKm',d->'distanceToStartKm',
     'effectiveRadiusKm',d->'effectiveRadiusKm',
     'taskLocationMode',d->'taskLocationMode',
     'score',d->'score',
     'scoreComponents',coalesce(d->'scoreComponents','{}'::jsonb),
     'evaluationScope','CURRENT_RECOMPUTE'
   );
   select jsonb_build_object(
      'deliveryId',od.id,'needRevision',od.need_revision,'dispatchRoundId',od.dispatch_round_id,
      'matchScore',od.match_score,'reasonCodes',to_jsonb(od.reason_codes),'status',od.status,
      'createdAt',od.created_at,'seenAt',od.seen_at,'respondedAt',od.responded_at
   ) into worker_history
   from public.opportunity_deliveries od
   where od.need_id=n.id and od.need_revision=n.revision and od.worker_profile_id=p_worker_profile_id
   order by od.created_at desc limit 1;
 end if;

 return jsonb_build_object(
  'schemaVersion','CONTROL_MATCHING_V1','capturedAt',statement_timestamp(),'freshness','LIVE',
  'need',jsonb_build_object('needId',n.id,'revision',n.revision,'status',n.status,'title',n.title,
    'requiredSlots',n.required_slots,'coveredSlots',covered,'remainingSlots',greatest(0,n.required_slots-covered),
    'urgent',n.urgent,'responseDeadline',n.response_deadline),
  'dispatchRounds',rounds,
  'currentRevisionDeliveries',delivery_summary,
  'deliveredReasonCounts',reason_counts,
  'currentRevisionResponsesByStatus',response_counts,
  'worker',case when p_worker_profile_id is null then null else jsonb_build_object(
    'currentEvaluation',worker_current,'historicalDelivery',worker_history,
    'historicalExclusionProof',case when worker_history is null then 'UNAVAILABLE_NOT_RECORDED' else 'NOT_APPLICABLE_DELIVERED' end
  ) end,
  'semantics',jsonb_build_object(
    'aggregateSource','RECORDED_DISPATCH_ONLY',
    'workerCurrentEvaluation','CANONICAL_MATCH_DETAIL_SINGLE_PROFILE',
    'nonDeliveredHistoricalReason','UNKNOWN_UNLESS_RECORDED_ELSEWHERE'
  ),
  'privacy',jsonb_build_object('containsExactCoordinates',false,'containsExactAddress',false,'containsEmail',false,'containsPhone',false)
 );
end;
$f$;

revoke all on function public.rpc_control_matching_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_control_matching_v1(uuid,uuid) to service_role;
rollback;
