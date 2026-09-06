-- USKOČI P0D-02 — committed disposable fixtures for true concurrent Selection proof.
-- This file is used only on the disposable CI database and is explicitly cleaned
-- after the parallel sessions complete.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f0d02000-0000-4000-8000-000000000001','authenticated','authenticated','p0d02-concurrent-requester@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D02 Concurrent Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
('f0d02000-0000-4000-8000-000000000002','authenticated','authenticated','p0d02-concurrent-worker@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','P0D02 Concurrent Worker','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());

update public.app_profiles
   set display_name='P0D02 Concurrent Worker',
       city='Novi Sad',
       skills=array['Proof'],
       team_capacity=1
 where account_id='f0d02000-0000-4000-8000-000000000002'::uuid
   and kind='WORKER';

alter table public.app_profiles disable trigger guard_profile_write_trg;
update public.app_profiles
   set profile_status='ACTIVE'
 where account_id='f0d02000-0000-4000-8000-000000000002'::uuid
   and kind='WORKER';
alter table public.app_profiles enable trigger guard_profile_write_trg;

select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
)
select
  'f0d02000-0000-4000-8000-000000000101'::uuid,
  'f0d02000-0000-4000-8000-000000000001'::uuid,
  p.id,
  'PUBLISHED','P0D02 same-key concurrency','proof','PROOF',
  'Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()
from public.app_profiles p
where p.account_id='f0d02000-0000-4000-8000-000000000001'::uuid and p.kind='REQUESTER';

insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,mode,required_slots,response_deadline,published_at
)
select
  'f0d02000-0000-4000-8000-000000000102'::uuid,
  'f0d02000-0000-4000-8000-000000000001'::uuid,
  p.id,
  'PUBLISHED','P0D02 different-key concurrency','proof','PROOF',
  'Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()
from public.app_profiles p
where p.account_id='f0d02000-0000-4000-8000-000000000001'::uuid and p.kind='REQUESTER';
select set_config('uskoci.need_lifecycle','',true);

insert into public.marketplace_responses(
  id,need_id,worker_account_id,worker_profile_id,response_kind,status,
  submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
)
select
  'f0d02000-0000-4000-8000-000000000201'::uuid,
  'f0d02000-0000-4000-8000-000000000101'::uuid,
  'f0d02000-0000-4000-8000-000000000002'::uuid,
  p.id,'OFFER','SUBMITTED',1,1,1,1500,'same-key concurrency',statement_timestamp()
from public.app_profiles p
where p.account_id='f0d02000-0000-4000-8000-000000000002'::uuid and p.kind='WORKER';

insert into public.marketplace_responses(
  id,need_id,worker_account_id,worker_profile_id,response_kind,status,
  submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at
)
select
  'f0d02000-0000-4000-8000-000000000202'::uuid,
  'f0d02000-0000-4000-8000-000000000102'::uuid,
  'f0d02000-0000-4000-8000-000000000002'::uuid,
  p.id,'OFFER','SUBMITTED',1,1,1,1600,'different-key concurrency',statement_timestamp()
from public.app_profiles p
where p.account_id='f0d02000-0000-4000-8000-000000000002'::uuid and p.kind='WORKER';

insert into public.marketplace_response_versions(
  response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash
) values
('f0d02000-0000-4000-8000-000000000201'::uuid,1,1,1,1500,'same-key concurrency',repeat('e',64)),
('f0d02000-0000-4000-8000-000000000202'::uuid,1,1,1,1600,'different-key concurrency',repeat('f',64));

commit;

select case
  when (select count(*) from public.needs where id in (
    'f0d02000-0000-4000-8000-000000000101'::uuid,
    'f0d02000-0000-4000-8000-000000000102'::uuid)) = 2
   and (select count(*) from public.marketplace_responses where id in (
    'f0d02000-0000-4000-8000-000000000201'::uuid,
    'f0d02000-0000-4000-8000-000000000202'::uuid)) = 2
  then 'PASS P0D02_CONCURRENCY_FIXTURES'
  else 'FAIL P0D02_CONCURRENCY_FIXTURES'
end;
