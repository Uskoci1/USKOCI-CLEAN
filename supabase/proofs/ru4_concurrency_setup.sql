-- RU-4 true-concurrency setup. Disposable DB only; destroyed after proof.
\set ON_ERROR_STOP on
begin;

do $setup$
declare
  requester constant uuid := '00000000-0000-4000-8000-00000000c401'::uuid;
  attacker constant uuid := '00000000-0000-4000-8000-00000000c402'::uuid;
  need_a constant uuid := '00000000-0000-4000-8000-00000000c4a1'::uuid;
  need_b constant uuid := '00000000-0000-4000-8000-00000000c4b1'::uuid;
  need_c constant uuid := '00000000-0000-4000-8000-00000000c4c1'::uuid;
  requester_profile uuid;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    (requester,'authenticated','authenticated','ru4-concurrency-requester@proof.invalid',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','RU4 Concurrency Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
    (attacker,'authenticated','authenticated','ru4-concurrency-attacker@proof.invalid',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name','RU4 Concurrency Attacker','city','Novi Sad'),statement_timestamp(),statement_timestamp());

  select id into requester_profile
    from public.app_profiles
   where account_id=requester and kind='REQUESTER';
  if requester_profile is null then
    raise exception 'RU4_CONCURRENCY_REQUESTER_PROFILE_MISSING';
  end if;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  insert into public.needs(
    id,requester_account_id,requester_profile_id,status,title,description,category,
    schedule_kind,required_slots,mode,requester_price_rsd,revision,published_at
  ) values
    (need_a,requester,requester_profile,'PUBLISHED','RU4 CONCURRENCY A','same key same payload','proof','FLEXIBLE',1,'MY_PRICE',4000,1,statement_timestamp()),
    (need_b,requester,requester_profile,'PUBLISHED','RU4 CONCURRENCY B','same key different payload','proof','FLEXIBLE',1,'MY_PRICE',5000,1,statement_timestamp()),
    (need_c,requester,requester_profile,'PUBLISHED','RU4 CONCURRENCY C','different key same need','proof','FLEXIBLE',1,'MY_PRICE',6000,1,statement_timestamp());
  perform set_config('uskoci.need_lifecycle','',true);

  insert into private.dispatch_schedule(need_id,next_run_at) values
    (need_a,statement_timestamp()),(need_b,statement_timestamp()),(need_c,statement_timestamp());
end
$setup$;

commit;
select 'PASS RU4_CONCURRENCY_SETUP bounded=3' as result;
