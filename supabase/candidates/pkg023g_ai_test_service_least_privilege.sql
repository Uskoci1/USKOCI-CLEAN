-- PKG-023g (finding F4): two service-only functions stop being executable by anon and authenticated.
--
-- A CANDIDATE. NOT APPLIED ANYWHERE. The owner approved writing it on 2026-09-19 and asked for a stop before
-- any DEV application: "prvo read-only potvrdi sve call-siteove ... zadrži postojeće body guards kao
-- defense-in-depth; dokaži da anon/authenticated dobijaju permission denied; dokaži da canonical service
-- caller i dalje radi. STOP pre DEV primene."
--
-- What is wrong. dev_alpha_pkg019c and dev_alpha_pkg019d created
--   public.rpc_ai_test_release_unused_reservation_service(uuid)
--   public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)
-- with `revoke all on function ... from public` followed by `grant execute ... to service_role`. Revoking
-- from PUBLIC does not remove a grant held by a role by name, and this project's default privileges give
-- anon, authenticated and service_role EXECUTE on every new function in `public`. So both functions are
-- listed by the Supabase advisor as executable by anon through /rest/v1/rpc. Their siblings created by
-- pkg014b/pkg019b used `revoke all ... from public, anon, authenticated, service_role` and are unaffected.
--
-- It is not an exposure: both bodies begin with `if auth.role() is distinct from 'service_role' then raise
-- exception 'SERVICE_ROLE_REQUIRED'`, and on canonical DEV both roles were verified on 2026-09-19 to get
-- exactly that. This is least privilege restored, and the body guards stay as the second line.
--
-- Call sites, confirmed read-only on 2026-09-19 (docs/implementation/v5-ai-first/pkg023/F2_F4_CANDIDATES_20260919.md):
-- supabase/functions/_shared/aiTestBudget.ts only, both over /rest/v1/rpc with the Edge function's
-- SUPABASE_SERVICE_ROLE_KEY. No client module, no proof and no script calls either function as any other
-- role. Nothing in the repository expects an anon or authenticated caller.
--
-- It changes no body, no table and no policy, and it is not part of the closure source digest, which it
-- asserts on itself.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path to pg_catalog;

create temporary table pkg023g_predecessor(source_digest text not null) on commit drop;

do $pre$
begin
  if to_regprocedure('public.rpc_ai_test_release_unused_reservation_service(uuid)') is null
     or to_regprocedure('public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)') is null then
    raise exception 'PKG023G_FUNCTIONS_ABSENT';
  end if;
  -- The bodies this leaves alone are the bodies it was written against, guard included.
  if (select md5(prosrc) from pg_proc where oid = 'public.rpc_ai_test_release_unused_reservation_service(uuid)'::regprocedure) is distinct from '0508f4b02a0f0abd620ba9da944500c0'
     or (select md5(prosrc) from pg_proc where oid = 'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)'::regprocedure) is distinct from '794db1cf0e12774a92c77bcb0f45854e' then
    raise exception 'PKG023G_A_BODY_IS_NOT_THE_REVIEWED_ONE';
  end if;
  if not exists (select 1 from unnest(array['public.rpc_ai_test_release_unused_reservation_service(uuid)',
                                            'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)']) f
                  where has_function_privilege('anon', f, 'EXECUTE') or has_function_privilege('authenticated', f, 'EXECUTE')) then
    raise exception 'PKG023G_NOTHING_TO_REVOKE';
  end if;
  if not (has_function_privilege('service_role', 'public.rpc_ai_test_release_unused_reservation_service(uuid)', 'EXECUTE')
          and has_function_privilege('service_role', 'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)', 'EXECUTE')) then
    raise exception 'PKG023G_SERVICE_ROLE_CANNOT_ALREADY_CALL_THEM';
  end if;
  insert into pkg023g_predecessor values (private.closure_source_digest_v5());
end
$pre$;

revoke execute on function public.rpc_ai_test_release_unused_reservation_service(uuid) from anon, authenticated;
revoke execute on function public.rpc_ai_test_settle_audio_service(uuid,bigint,integer) from anon, authenticated;

do $post$
begin
  if has_function_privilege('anon', 'public.rpc_ai_test_release_unused_reservation_service(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rpc_ai_test_release_unused_reservation_service(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)', 'EXECUTE') then
    raise exception 'PKG023G_REVOKE_INCOMPLETE';
  end if;
  -- The caller that exists keeps working, and the guard inside each body is untouched.
  if not (has_function_privilege('service_role', 'public.rpc_ai_test_release_unused_reservation_service(uuid)', 'EXECUTE')
          and has_function_privilege('service_role', 'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)', 'EXECUTE')) then
    raise exception 'PKG023G_SERVICE_ROLE_LOST_EXECUTE';
  end if;
  if (select md5(prosrc) from pg_proc where oid = 'public.rpc_ai_test_release_unused_reservation_service(uuid)'::regprocedure) is distinct from '0508f4b02a0f0abd620ba9da944500c0'
     or (select md5(prosrc) from pg_proc where oid = 'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)'::regprocedure) is distinct from '794db1cf0e12774a92c77bcb0f45854e'
     or (select count(*) from pg_proc p where p.oid in ('public.rpc_ai_test_release_unused_reservation_service(uuid)'::regprocedure,
            'public.rpc_ai_test_settle_audio_service(uuid,bigint,integer)'::regprocedure)
          and p.prosecdef and p.proconfig = array['search_path=pg_catalog']::text[]) <> 2 then
    raise exception 'PKG023G_BODY_OR_ENVELOPE_CHANGED';
  end if;
  if (select source_digest from pkg023g_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG023G_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
