-- 17c: O-1 ograniceni dinamicki budzet + talas isporuke.

create or replace function private.candidate_budget(
  p_urgent boolean, p_remaining integer, p_cfg jsonb)
returns jsonb language plpgsql immutable set search_path to 'pg_catalog' as $$
declare
  b jsonb := p_cfg->'candidateBudget';
  fixed integer := (p_cfg->>'candidateLimit')::integer;
  base integer; hard_max integer; max_routing integer;
  avg_cov numeric; resp_rate numeric; safety numeric;
  needed integer; expected numeric; raw integer;
begin
  if b is null or jsonb_typeof(b) <> 'object' then
    return jsonb_build_object('limit', fixed, 'source', 'FIXED', 'maxRoutingCallsPerWave', 0);
  end if;

  base := (b->>'baseLimit')::integer;
  hard_max := (b->>'hardMaxLimit')::integer;
  max_routing := coalesce((b->>'maxRoutingCallsPerWave')::integer, 0);
  avg_cov := (b->>'avgCoveragePerResponse')::numeric;
  resp_rate := (b->>'responseRate')::numeric;
  safety := (b->>'safetyFactor')::numeric;

  -- Nevazeca konfiguracija nikad ne sme da otvori budzet. Pad na fiksni donorov limit.
  if base is null or base < 1
     or hard_max is null or hard_max < base or hard_max > 10000
     or avg_cov is null or avg_cov <= 0
     or resp_rate is null or resp_rate <= 0 or resp_rate > 1
     or safety is null or safety <= 0 then
    if coalesce((p_cfg->>'fallbackToFixedWaves')::boolean, false) then
      return jsonb_build_object('limit', fixed, 'source', 'FIXED', 'maxRoutingCallsPerWave', 0);
    end if;
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;

  if p_remaining is null or p_remaining <= 0 then
    return jsonb_build_object('limit', base, 'source', 'ADAPTIVE_FLOOR', 'maxRoutingCallsPerWave', max_routing);
  end if;

  needed := ceil(p_remaining::numeric / avg_cov)::integer;
  expected := needed::numeric / resp_rate;
  raw := ceil(expected * safety)::integer;

  if raw <= base then
    return jsonb_build_object('limit', base, 'source', 'ADAPTIVE_FLOOR', 'maxRoutingCallsPerWave', max_routing);
  elsif raw >= hard_max then
    return jsonb_build_object('limit', hard_max, 'source', 'ADAPTIVE_CAPPED', 'maxRoutingCallsPerWave', max_routing);
  end if;
  return jsonb_build_object('limit', raw, 'source', 'ADAPTIVE_COMPUTED', 'maxRoutingCallsPerWave', max_routing);
end;
$$;

create or replace function private.dispatch_next_wave(nid uuid)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  n public.needs;
  cfg jsonb; sizes jsonb; budget jsonb;
  roundno integer; policy_wave_no integer;
  batch integer; target integer; windowm integer;
  candidate_limit integer; budget_source text;
  active integer; active_coverage integer; selected integer; remaining integer;
  roundid uuid := gen_random_uuid();
  inserted integer := 0;
  c record; d jsonb; deadline timestamptz; urg text;
begin
  -- Serijalizuje talase iste Potrebe. Dva paralelna tick-a ne mogu da udvostruce rundu.
  select * into n from public.needs where id = nid for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;

  if n.status not in ('PUBLISHED','SELECTION') then
    return jsonb_build_object('status','STOPPED','reason','NEED_NOT_OPEN','inserted',0);
  end if;

  select coalesce(sum(covered_slots),0) into selected
    from public.need_selections where need_id = nid and status = 'SELECTED';
  remaining := greatest(0, n.required_slots - selected);
  if remaining = 0 then
    return jsonb_build_object('status','STOPPED','reason','SLOTS_FILLED','inserted',0,
      'selectedSlots',selected,'remainingSlots',0);
  end if;

  select count(*), coalesce(sum(covered_slots),0) into active, active_coverage
    from public.marketplace_responses
   where need_id = nid and submitted_against_need_revision = n.revision
     and status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED');

  urg := case when n.urgent then 'URGENT' else 'NORMAL' end;
  select value into cfg from private.marketplace_config
   where key = case when n.urgent then 'dispatch_urgent' else 'dispatch_normal' end;
  if cfg is null then raise exception using errcode='55000', message='DISPATCH_CONFIG_MISSING'; end if;

  sizes := cfg->'waveSizes';
  target := (cfg->>'targetResponses')::integer;
  windowm := (cfg->>'windowMinutes')::integer;
  if jsonb_typeof(sizes) <> 'array' or jsonb_array_length(sizes) = 0
     or target is null or target < 1 or windowm is null or windowm < 1 then
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;

  if active >= target and active_coverage >= remaining then
    return jsonb_build_object('status','STOPPED','reason','RESPONSE_TARGET_AND_COVERAGE_REACHED',
      'inserted',0,'activeResponses',active,'activeCoverage',active_coverage,
      'selectedSlots',selected,'remainingSlots',remaining);
  end if;

  -- O-1: budzet prati PREOSTALU pokrivenost, pa se sam smanjuje kako se mesta popunjavaju.
  budget := private.candidate_budget(n.urgent, greatest(0, remaining - active_coverage), cfg);
  candidate_limit := (budget->>'limit')::integer;
  budget_source := budget->>'source';
  if candidate_limit is null or candidate_limit < 1 or candidate_limit > 10000 then
    raise exception using errcode='55000', message='DISPATCH_CONFIG_INVALID';
  end if;

  select coalesce(max(round_no),0)+1 into roundno
    from public.dispatch_rounds where need_id = nid and need_revision = n.revision;
  -- Talasi se broje PO HITNOSTI: prelazak NORMAL -> HITNO otvara novu lestvicu.
  select count(*)+1 into policy_wave_no
    from public.dispatch_rounds
   where need_id = nid and need_revision = n.revision and urgency = urg;

  if policy_wave_no > jsonb_array_length(sizes) then
    return jsonb_build_object('status','STOPPED','reason','WAVES_EXHAUSTED','inserted',0,
      'activeResponses',active,'activeCoverage',active_coverage,
      'selectedSlots',selected,'remainingSlots',remaining,'candidateLimit',candidate_limit);
  end if;

  batch := (sizes->>(policy_wave_no-1))::integer;
  deadline := statement_timestamp() + make_interval(mins => windowm);

  insert into public.dispatch_rounds(id,need_id,need_revision,round_no,urgency,batch_size,
      target_responses,candidate_limit_used,budget_source,status,deadline_at)
    values (roundid,n.id,n.revision,roundno,urg,batch,target,candidate_limit,budget_source,'SENT',deadline);

  for c in
    with candidate_base as materialized (
      select p.id as pid, p.account_id as uid, pc.candidate_rank
      from private.candidate_profile_ids(n.id, candidate_limit)
           with ordinality as pc(worker_profile_id, candidate_rank)
      join public.app_profiles p on p.id = pc.worker_profile_id
      order by pc.candidate_rank
    ), scored as materialized (
      select b.pid, b.uid, private.match_detail(n.id, b.pid) as detail from candidate_base b
    )
    select s.pid, s.uid, s.detail from scored s
    where coalesce((s.detail->>'dispatchEligible')::boolean, false)
    order by (s.detail->>'score')::numeric desc, s.pid
  loop
    exit when inserted >= batch;
    d := c.detail;
    insert into public.opportunity_deliveries(worker_account_id,worker_profile_id,need_id,
        need_revision,dispatch_round_id,match_score,score_components,reason_codes,status,expires_at)
      values (c.uid,c.pid,n.id,n.revision,roundid,(d->>'score')::numeric,
        coalesce(d->'scoreComponents','{}'::jsonb) || jsonb_build_object(
          'distanceToStartKm', d->'distanceToStartKm',
          'effectiveRadiusKm', d->'effectiveRadiusKm',
          'distanceSource', d->'distanceSource',
          'taskLocationMode', d->'taskLocationMode'),
        array(select jsonb_array_elements_text(d->'reasonCodes')), 'READY', deadline)
      on conflict do nothing;

    if found then
      inserted := inserted + 1;
      -- dedupe_key je isti kljuc kao unique na isporuci: push ne moze da izadje dvaput.
      perform private.emit_event(
        p_recipient => c.uid, p_role => 'WORKER',
        p_event_type => 'OPPORTUNITY_AVAILABLE',
        p_entity_type => 'NEED', p_entity_id => n.id, p_entity_version => n.revision,
        p_title => 'Nova prilika koja može da Vam odgovara',
        p_body => left(n.title,140),
        p_dedupe_key => 'opp:'||n.id::text||':'||n.revision::text||':'||c.uid::text,
        p_urgency => case when n.urgent then 'HITNO' else 'NORMAL' end,
        p_payload => jsonb_build_object('needRevision',n.revision,
                       'reasonCodes',d->'reasonCodes','remainingSlots',remaining),
        p_expires_at => deadline);
    end if;
  end loop;

  if inserted = 0 then
    update public.dispatch_rounds
       set status = 'STOPPED', stop_reason = 'NO_ELIGIBLE_CANDIDATES'
     where id = roundid;
  end if;

  return jsonb_build_object(
    'status', case when inserted > 0 then 'SENT' else 'STOPPED' end,
    'round', roundno, 'policyWaveNo', policy_wave_no, 'urgency', urg,
    'inserted', inserted, 'batchSize', batch, 'deadlineAt', deadline,
    'activeResponses', active, 'activeCoverage', active_coverage,
    'selectedSlots', selected, 'remainingSlots', remaining,
    'candidateLimit', candidate_limit, 'budgetSource', budget_source,
    'routingCallsUsed', 0, 'routingProvider', null,
    'candidateRetrieval', 'CLEAN_STREAMING_BOUNDED_GEO_KNN',
    'authoritative', true);
end;
$$;

revoke all on function private.candidate_budget(boolean,integer,jsonb) from public, anon, authenticated;
revoke all on function private.dispatch_next_wave(uuid) from public, anon, authenticated;

comment on function private.dispatch_next_wave(uuid) is
  'Autoritativni talas. FOR UPDATE na Potrebi serijalizuje rundu. routingCallsUsed je uvek 0: routing provajder nije povezan, maxRoutingCallsPerWave je rezervisan a ne dokazan.';
