-- PKG-047a candidate. F05 / control rows B08, N06, N07 / gap PG01: report and block have no reachable
-- target outside an Agreement. Contract: docs/implementation/v5-ai-first/pkg047/PKG047_SAFETY_TARGET.md
--
-- What is broken today. public.rpc_submit_safety_report and public.rpc_set_account_block are keyed by the
-- target ACCOUNT, which is right: a block must follow the person, not one of the two faces (REQUESTER and
-- WORKER profiles) the same person can show. But the only places that hand the client an account id are
-- rpc_get_agreement_workspace (requesterAccountId/workerAccountId) and the caller's own block list. A public
-- profile returns profileId only, and rpc_list_need_candidates returns workerProfileId only, so from an
-- opportunity or a candidate card there is no target at all — which is why those screens carry no entry.
--
-- What this adds. One authenticated reader that resolves a visible public profile to its safety target and
-- the caller's own current choice about it. The owner decided on 2026-09-22 that the account id may be
-- disclosed for this purpose (option A), which is the disclosure an Agreement already makes today.
-- The reader repeats the visibility of rpc_get_public_profile exactly, and returns null — never an error —
-- when the profile is not a target: unknown, not ACTIVE, not REQUESTER/WORKER, the caller's own account,
-- either side closing or closed, blocked in either direction, or another visibility world. Because a block
-- in either direction already hides the profile, a target that IS returned is never an active block of the
-- caller; the revision is still carried, so a person unblocked earlier can be blocked again without a second
-- read. An incoming block is never disclosed, exactly as in rpc_get_account_block.
--
-- Function-only: no table, column, constraint, trigger, ACL of a table or reviewed erasure function changes,
-- so the certified closure digest must NOT move. The candidate asserts that before and after, and refuses
-- to run twice.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg047_state(certified text not null) on commit drop;

do $pre$
declare v_certified text;
begin
  -- Not already applied, in any form.
  if to_regprocedure('public.rpc_read_safety_target(uuid)') is not null then
    raise exception 'PKG047_ALREADY_APPLIED' using errcode = '55000';
  end if;
  -- The authority this reader repeats and the writers it feeds, exactly as reviewed on 2026-09-22.
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_get_public_profile(uuid)'))
       is distinct from '9ecc0b69096f1167d02e0bb7b9656bc0' then
    raise exception 'PKG047_PREDECESSOR_DRIFT: rpc_get_public_profile' using errcode = '55000';
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_get_account_block(uuid)'))
       is distinct from 'b91745f39246ddd60245e32821364dd8' then
    raise exception 'PKG047_PREDECESSOR_DRIFT: rpc_get_account_block' using errcode = '55000';
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_set_account_block(uuid,boolean,integer,uuid)'))
       is distinct from '43b3b050c3ddc21657790f13c424390e' then
    raise exception 'PKG047_PREDECESSOR_DRIFT: rpc_set_account_block' using errcode = '55000';
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_submit_safety_report(uuid,uuid,uuid,text,text,text,uuid)'))
       is distinct from '9249705c01cc3d29d178f1ebd331daeb' then
    raise exception 'PKG047_PREDECESSOR_DRIFT: rpc_submit_safety_report' using errcode = '55000';
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('private.safety_pair_blocked(uuid,uuid)'))
       is distinct from '698fb21abb0379743bc7ab09d9f946ad'
     or (select md5(prosrc) from pg_proc where oid = to_regprocedure('private.closure_account_restricted(uuid)'))
       is distinct from 'f4999250c315e0253374d4611291c7ad'
     or (select md5(prosrc) from pg_proc where oid = to_regprocedure('private.accounts_same_world(uuid,uuid)'))
       is distinct from '16f541f952d4e1e2dbb4fc87e594d572' then
    raise exception 'PKG047_PREDECESSOR_DRIFT: visibility guards' using errcode = '55000';
  end if;
  -- The two relations the body reads.
  if (select string_agg(attname || ':' || format_type(atttypid, atttypmod), ', ' order by attnum)
        from pg_attribute where attrelid = 'private.account_blocks'::regclass and attnum > 0 and not attisdropped
          and attname in ('blocker_account_id','blocked_account_id','active','revision'))
     is distinct from 'blocker_account_id:uuid, blocked_account_id:uuid, active:boolean, revision:integer' then
    raise exception 'PKG047_PREDECESSOR_DRIFT: private.account_blocks' using errcode = '55000';
  end if;
  if (select count(*) from pg_attribute where attrelid = 'public.app_profiles'::regclass and attnum > 0
        and not attisdropped and attname in ('id','account_id','kind','display_name','profile_status')) <> 5 then
    raise exception 'PKG047_PREDECESSOR_DRIFT: public.app_profiles' using errcode = '55000';
  end if;
  -- One certified value, live, ready.
  select sha256 into strict v_certified from private.closure_source_v5 where singleton;
  if v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
     or private.closure_source_digest_v5() is distinct from v_certified
     or not private.retention_ai_source_ready() then
    raise exception 'PKG047_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg047_state(certified) values (v_certified);
end
$pre$;

-- The safety target of a public profile the caller can actually see.
create function public.rpc_read_safety_target(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare v_actor uuid := auth.uid(); v_profile public.app_profiles; v_block private.account_blocks;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_profile_id is null then raise exception 'SAFETY_TARGET_INPUT_INVALID' using errcode='22023'; end if;
 -- Exactly the visibility of rpc_get_public_profile: anything it hides has no safety target either.
 select p.* into v_profile from public.app_profiles p
  where p.id=p_profile_id and p.profile_status='ACTIVE' and p.kind in ('REQUESTER','WORKER');
 if not found or v_profile.account_id=v_actor then return null; end if;
 if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;
 if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;
 if not private.accounts_same_world(v_actor,v_profile.account_id) then return null; end if;
 -- The caller's own outgoing choice only. An incoming block is never disclosed; a block in either
 -- direction has already returned null above, so a returned target is never an active block.
 select * into v_block from private.account_blocks
  where blocker_account_id=v_actor and blocked_account_id=v_profile.account_id;
 return jsonb_build_object('profileId',v_profile.id,'accountId',v_actor,'targetAccountId',v_profile.account_id,
  'blocked',coalesce(v_block.active,false),'revision',coalesce(v_block.revision,0),'authoritative',true);
end;
$function$;

revoke all on function public.rpc_read_safety_target(uuid) from public, anon, authenticated, service_role;
grant execute on function public.rpc_read_safety_target(uuid) to authenticated;
comment on function public.rpc_read_safety_target(uuid) is
  'PKG-047 resolves a public profile the caller can see into the safety target of the person behind it, plus the caller''s own block revision. Null whenever the public profile itself would be hidden. Never discloses an incoming block and never writes.';

do $post$
declare v_certified text; v_acl text;
begin
  select certified into strict v_certified from pkg047_state;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.rpc_read_safety_target(uuid)'))
       is distinct from '4f4e88c2f8bb5840bffe5bd1d97efde5' then
    raise exception 'PKG047_BODY_MISMATCH';
  end if;
  if not (select prosecdef from pg_proc where oid = to_regprocedure('public.rpc_read_safety_target(uuid)'))
     or (select proconfig::text from pg_proc where oid = to_regprocedure('public.rpc_read_safety_target(uuid)'))
        is distinct from '{search_path=pg_catalog}'
     or (select provolatile from pg_proc where oid = to_regprocedure('public.rpc_read_safety_target(uuid)')) <> 's' then
    raise exception 'PKG047_FUNCTION_AUTHORITY_MISMATCH';
  end if;
  v_acl := has_function_privilege('anon', 'public.rpc_read_safety_target(uuid)', 'EXECUTE')::text
        || has_function_privilege('authenticated', 'public.rpc_read_safety_target(uuid)', 'EXECUTE')::text
        || has_function_privilege('service_role', 'public.rpc_read_safety_target(uuid)', 'EXECUTE')::text;
  if v_acl is distinct from 'falsetruefalse' then
    raise exception 'PKG047_ACL_MISMATCH: %', v_acl;
  end if;
  -- Nothing the certificate watches was touched.
  if private.closure_source_digest_v5() is distinct from v_certified
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from v_certified
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_certified
     or not private.retention_ai_source_ready() then
    raise exception 'PKG047_CERTIFICATE_CHANGED';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;
