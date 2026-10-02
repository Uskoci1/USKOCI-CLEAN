// Byte-exact DEV bodies (read-only SELECT of prosrc on canonical DEV leqcwgzvjsxugfgzdmth, 2026-10-02) of the functions the S06 candidate pins, for the offline PGlite execution only.
// Every body is checked against its DEV md5 before it is used.
export const BODIES = {
  'public.rpc_get_public_profile(uuid)': {
    md5: '9ecc0b69096f1167d02e0bb7b9656bc0', args: 'p_profile_id uuid', returns: 'jsonb',
    body: `
declare
  v_actor uuid := auth.uid();
  v_profile public.app_profiles;
  v_completed bigint := 0;
  v_reputation jsonb;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_profile_id is null then
    raise exception 'PROFILE_ID_REQUIRED' using errcode = '22023';
  end if;

  select p.*
  into v_profile
  from public.app_profiles p
  where p.id = p_profile_id
    and p.profile_status = 'ACTIVE'
    and p.kind in ('REQUESTER', 'WORKER');

  if not found then
    return null;
  end if;

  if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;
  if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;
  if not private.accounts_same_world(v_actor, v_profile.account_id) then return null; end if;
  if v_profile.kind = 'REQUESTER' then
    select count(*)
    into v_completed
    from public.agreements a
    where a.requester_profile_id = v_profile.id
      and a.status = 'COMPLETED';
  else
    select count(*)
    into v_completed
    from public.agreements a
    where a.worker_profile_id = v_profile.id
      and a.status = 'COMPLETED';
  end if;

  v_reputation:=private.account_reputation(v_profile.account_id);
  return jsonb_build_object(
    'profileId', v_profile.id,
    'role', v_profile.kind,
    'displayName', nullif(btrim(v_profile.display_name), ''),
    'avatarPath', v_profile.avatar_path,
    'city', nullif(btrim(v_profile.city), ''),
    'publicSummary', jsonb_build_object(
      'headline', case when v_profile.kind = 'WORKER' then nullif(btrim(v_profile.headline), '') else null end,
      'bio', case when v_profile.kind = 'WORKER' then nullif(btrim(v_profile.bio), '') else null end
    ),
    'trust', jsonb_build_object(
      'ratingAverage', v_reputation->'averageRating',
      'reviewCount', v_reputation->'reviewCount',
      'completedCount', v_completed,
      'identityVerified', false,
      'ratingAvailable', (v_reputation->>'reviewCount')::bigint>0,
      'reviewsAvailable', true,
      'identityVerificationAvailable', false
    )
  );
end;
`,
  },
  'public.rpc_get_account_block(uuid)': {
    md5: 'b91745f39246ddd60245e32821364dd8', args: 'p_target_account_id uuid', returns: 'jsonb',
    body: `
declare u uuid:=auth.uid(); r private.account_blocks;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_target_account_id is null or u=p_target_account_id then raise exception 'BLOCK_INPUT_INVALID' using errcode='22023'; end if;
 select * into r from private.account_blocks where blocker_account_id=u and blocked_account_id=p_target_account_id;
 -- Only the caller's outgoing choice is visible. Never disclose an incoming block.
 return jsonb_build_object('accountId',u,'targetAccountId',p_target_account_id,'blocked',coalesce(r.active,false),'revision',coalesce(r.revision,0),'authoritative',true);
end;
`,
  },
  'public.rpc_submit_safety_report(uuid,uuid,uuid,text,text,text,uuid)': {
    md5: '9249705c01cc3d29d178f1ebd331daeb',
    args: 'p_target_account_id uuid, p_need_id uuid, p_agreement_id uuid, p_category text, p_reason text, p_narrative text, p_client_request_id uuid', returns: 'jsonb',
    body: `
declare u uuid:=auth.uid(); r private.safety_reports; h text;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_target_account_id is null or p_target_account_id=u or p_client_request_id is null or p_category is null
 or p_category not in('HARASSMENT','FRAUD','UNSAFE_WORK','DISCRIMINATION','OTHER')
 or p_reason is null or length(btrim(p_reason)) not between 1 and 200 or octet_length(p_reason)>800
 or p_narrative is null or length(p_narrative)>2000 or octet_length(p_narrative)>8000 then raise exception 'SAFETY_REPORT_INPUT_INVALID' using errcode='22023'; end if;
 h:=encode(extensions.digest(jsonb_build_object('target',p_target_account_id,'need',p_need_id,'agreement',p_agreement_id,
 'category',p_category,'reason',btrim(p_reason),'narrative',btrim(p_narrative))::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('uskoci:report:'||u::text||':'||p_client_request_id::text,8318));
 select * into r from private.safety_reports where reporter_account_id=u and client_request_id=p_client_request_id;
 if found then
  if r.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return jsonb_build_object('reportId',r.id,'clientRequestId',p_client_request_id,'received',true,'createdAt',r.created_at,'idempotentReplay',true,'authoritative',true);
 end if;
 if not private.safety_report_context_allowed(u,p_target_account_id,p_need_id,p_agreement_id) then raise exception 'SAFETY_CONTEXT_NOT_AVAILABLE' using errcode='42501'; end if;
 insert into private.safety_reports(reporter_account_id,target_account_id,need_id,agreement_id,category,reason,narrative,client_request_id,input_hash)
 values(u,p_target_account_id,p_need_id,p_agreement_id,p_category,btrim(p_reason),btrim(p_narrative),p_client_request_id,h) returning * into r;
 perform private.audit_marketplace(u,'SAFETY_REPORT_RECEIVED','SAFETY_REPORT',r.id,1,'{}');
 return jsonb_build_object('reportId',r.id,'clientRequestId',p_client_request_id,'received',true,'createdAt',r.created_at,'idempotentReplay',false,'authoritative',true);
end;
`,
  },
  'public.rpc_list_my_account_blocks(uuid)': {
    md5: '4af5e379617daa5666073a633ecd79ce', args: 'p_after uuid default null', returns: 'jsonb',
    body: `
declare u uuid:=auth.uid(); items jsonb; next_id uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 with page as (
  select b.* from private.account_blocks b
  where b.blocker_account_id=u and b.active and (p_after is null or b.blocked_account_id>p_after)
  order by b.blocked_account_id limit 50
 ) select coalesce(jsonb_agg(jsonb_build_object('accountId',u,'targetAccountId',b.blocked_account_id,
   'blocked',true,'revision',b.revision,'authoritative',true,
   'displayName',(select nullif(btrim(p.display_name),'') from public.app_profiles p
    where p.account_id=b.blocked_account_id and p.profile_status='ACTIVE' and nullif(btrim(p.display_name),'') is not null
    order by p.kind limit 1)) order by b.blocked_account_id),'[]'::jsonb) into items from page b;
 if jsonb_array_length(items)=50 then
  next_id:=(items->49->>'targetAccountId')::uuid;
  if not exists(select 1 from private.account_blocks b where b.blocker_account_id=u and b.active and b.blocked_account_id>next_id) then next_id:=null; end if;
 end if;
 return jsonb_build_object('accountId',u,'items',items,'nextCursor',next_id,'authoritative',true);
end;
`,
  },
  'private.safety_pair_blocked(uuid,uuid)': {
    md5: '698fb21abb0379743bc7ab09d9f946ad', args: 'a uuid, b uuid', returns: 'boolean', language: 'sql',
    body: ` select exists(select 1 from private.account_blocks x where x.active
 and ((x.blocker_account_id=a and x.blocked_account_id=b) or (x.blocker_account_id=b and x.blocked_account_id=a))); `,
  },
  'private.closure_account_restricted(uuid)': {
    md5: 'f4999250c315e0253374d4611291c7ad', args: 'a uuid', returns: 'boolean', language: 'sql',
    body: ` select exists(select 1 from private.account_closure_requests r where r.account_id=a
 and r.state in('READY','EXECUTING','FAILED','CLOSED')); `,
  },
  'private.accounts_same_world(uuid,uuid)': {
    md5: '16f541f952d4e1e2dbb4fc87e594d572', args: 'p_a uuid, p_b uuid', returns: 'boolean', language: 'sql',
    body: `
  select private.account_visibility_world(p_a) = private.account_visibility_world(p_b);
`,
  },
  'private.account_visibility_world(uuid)': {
    md5: '876cfc16f0ed1c4d32b128e8e18bdcda', args: 'p_account_id uuid', returns: 'text', language: 'sql',
    body: `
  select case when coalesce(private.account_lineage(p_account_id), 'UNCLASSIFIED')
                in ('DEV_ACCEPTANCE_QA','SYNTHETIC_ACCEPTANCE_FIXTURE','OPERATOR',
                    -- PKG-029e, owner decision 2026-09-21 ("dok testiramo"): the owner's own accounts share the
                    -- test world while testing. Take these two out again before real users arrive.
                    'OWNER_PERSONAL','OWNER_BUSINESS') then 'TEST' else 'REAL' end;
`,
  },
  'private.account_lineage(uuid)': {
    md5: 'c08602534ee5e0f0aa826db0913fde81', args: 'p_account_id uuid', returns: 'text', language: 'sql',
    body: `
  select coalesce((select l.lineage from private.account_lineage_v5 l where l.account_id = p_account_id), 'UNCLASSIFIED');
`,
  },
};
