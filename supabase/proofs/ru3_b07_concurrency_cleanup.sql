-- USKOČI RU-3 / B07 true-concurrency disposable fixture cleanup.
\set ON_ERROR_STOP on

begin;

delete from private.need_publish_commands
 where need_id in (
  '00000000-0000-4000-8000-00000000b0a1'::uuid,
  '00000000-0000-4000-8000-00000000b0b1'::uuid,
  '00000000-0000-4000-8000-00000000b0c1'::uuid
 );

delete from private.dispatch_schedule
 where need_id in (
  '00000000-0000-4000-8000-00000000b0a1'::uuid,
  '00000000-0000-4000-8000-00000000b0b1'::uuid,
  '00000000-0000-4000-8000-00000000b0c1'::uuid
 );

delete from private.need_publication_decisions
 where need_id in (
  '00000000-0000-4000-8000-00000000b0a1'::uuid,
  '00000000-0000-4000-8000-00000000b0b1'::uuid,
  '00000000-0000-4000-8000-00000000b0c1'::uuid
 );

delete from private.publication_policy_rule_refs
 where bundle_id='00000000-0000-4000-8000-00000000b0f1'::uuid;

delete from private.publication_policy_bundles
 where id='00000000-0000-4000-8000-00000000b0f1'::uuid;

delete from public.need_sensitive
 where need_id in (
  '00000000-0000-4000-8000-00000000b0a1'::uuid,
  '00000000-0000-4000-8000-00000000b0b1'::uuid,
  '00000000-0000-4000-8000-00000000b0c1'::uuid
 );

delete from public.need_requirement_details
 where need_id in (
  '00000000-0000-4000-8000-00000000b0a1'::uuid,
  '00000000-0000-4000-8000-00000000b0b1'::uuid,
  '00000000-0000-4000-8000-00000000b0c1'::uuid
 );

delete from public.need_geography
 where need_id in (
  '00000000-0000-4000-8000-00000000b0a1'::uuid,
  '00000000-0000-4000-8000-00000000b0b1'::uuid,
  '00000000-0000-4000-8000-00000000b0c1'::uuid
 );

delete from public.needs
 where id in (
  '00000000-0000-4000-8000-00000000b0a1'::uuid,
  '00000000-0000-4000-8000-00000000b0b1'::uuid,
  '00000000-0000-4000-8000-00000000b0c1'::uuid
 );

delete from public.app_profiles
 where account_id='00000000-0000-4000-8000-00000000b071'::uuid;

delete from auth.users
 where id='00000000-0000-4000-8000-00000000b071'::uuid;

commit;

do $zero_residue$
begin
  if exists(select 1 from auth.users where id='00000000-0000-4000-8000-00000000b071'::uuid) then
    raise exception 'RU3_B07_CONCURRENCY_CLEANUP: auth residue';
  end if;
  if exists(select 1 from public.app_profiles where account_id='00000000-0000-4000-8000-00000000b071'::uuid) then
    raise exception 'RU3_B07_CONCURRENCY_CLEANUP: profile residue';
  end if;
  if exists(
    select 1 from public.needs
     where id in (
      '00000000-0000-4000-8000-00000000b0a1'::uuid,
      '00000000-0000-4000-8000-00000000b0b1'::uuid,
      '00000000-0000-4000-8000-00000000b0c1'::uuid
     )
  ) then
    raise exception 'RU3_B07_CONCURRENCY_CLEANUP: Need residue';
  end if;
  if exists(
    select 1 from private.need_publish_commands
     where need_id in (
      '00000000-0000-4000-8000-00000000b0a1'::uuid,
      '00000000-0000-4000-8000-00000000b0b1'::uuid,
      '00000000-0000-4000-8000-00000000b0c1'::uuid
     )
  ) then
    raise exception 'RU3_B07_CONCURRENCY_CLEANUP: receipt residue';
  end if;
  if exists(
    select 1 from private.need_publication_decisions
     where need_id in (
      '00000000-0000-4000-8000-00000000b0a1'::uuid,
      '00000000-0000-4000-8000-00000000b0b1'::uuid,
      '00000000-0000-4000-8000-00000000b0c1'::uuid
     )
  ) then
    raise exception 'RU3_B07_CONCURRENCY_CLEANUP: decision residue';
  end if;
  if exists(select 1 from private.publication_policy_bundles where id='00000000-0000-4000-8000-00000000b0f1'::uuid) then
    raise exception 'RU3_B07_CONCURRENCY_CLEANUP: policy bundle residue';
  end if;
end
$zero_residue$;

select 'PASS RU3_B07_CONCURRENCY_ZERO_RESIDUE' as result;
