-- RU-1 rollback-only authenticated proof.
\set ON_ERROR_STOP on
begin;

do $seed$
declare ready_user uuid:=extensions.gen_random_uuid(); no_skill_user uuid:=extensions.gen_random_uuid(); insert_user uuid:=extensions.gen_random_uuid(); attacker_user uuid:=extensions.gen_random_uuid(); requester_status text; worker_status text;
begin
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  (ready_user,'authenticated','authenticated','ru1-ready-'||ready_user::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU1 Ready Worker','city','Novi Sad','skills',jsonb_build_array('proof-skill')),statement_timestamp(),statement_timestamp()),
  (no_skill_user,'authenticated','authenticated','ru1-noskill-'||no_skill_user::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU1 No Skill','city','Novi Sad','skills','[]'::jsonb),statement_timestamp(),statement_timestamp()),
  (insert_user,'authenticated','authenticated','ru1-insert-'||insert_user::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU1 Insert Worker','city','Novi Sad','skills',jsonb_build_array('proof-skill')),statement_timestamp(),statement_timestamp()),
  (attacker_user,'authenticated','authenticated','ru1-attacker-'||attacker_user::text||'@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU1 Attacker','city','Novi Sad','skills',jsonb_build_array('proof-skill')),statement_timestamp(),statement_timestamp());
  select profile_status into requester_status from public.app_profiles where account_id=ready_user and kind='REQUESTER';
  select profile_status into worker_status from public.app_profiles where account_id=ready_user and kind='WORKER';
  if requester_status<>'ACTIVE' then raise exception 'RU1_PROOF_REQUESTER_NOT_ACTIVE_ON_CREATE'; end if;
  if worker_status<>'DRAFT' then raise exception 'RU1_PROOF_WORKER_NOT_DRAFT_ON_CREATE'; end if;
  delete from public.app_profiles where account_id=insert_user and kind='WORKER';
  perform set_config('uskoci.ru1_ready_user',ready_user::text,true);
  perform set_config('uskoci.ru1_no_skill_user',no_skill_user::text,true);
  perform set_config('uskoci.ru1_insert_user',insert_user::text,true);
  perform set_config('uskoci.ru1_attacker_user',attacker_user::text,true);
end $seed$;

set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('uskoci.ru1_ready_user'),true);
select set_config('request.jwt.claims','',true);
do $ready_worker$
declare uid uuid:=current_setting('uskoci.ru1_ready_user')::uuid; pid uuid; denied boolean; s text; token text;
begin
  if auth.uid() is distinct from uid then
    raise exception 'RU1_PROOF_AUTH_CONTEXT_MISMATCH' using detail=format('auth.uid=%s expected=%s',coalesce(auth.uid()::text,'NULL'),uid::text);
  end if;
  token:=nullif(current_setting('uskoci.profile_mutation',true),'');
  if token is not null then
    raise exception 'RU1_PROOF_MUTATION_TOKEN_LEAK' using detail=token;
  end if;
  select id into pid from public.app_profiles where account_id=uid and kind='WORKER';
  if pid is null then raise exception 'RU1_PROOF_READY_WORKER_NOT_VISIBLE_TO_OWNER'; end if;
  denied:=false; begin update public.app_profiles set profile_status='ACTIVE' where id=pid; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'RU1_PROOF_DIRECT_STATUS_ACTIVATION_ALLOWED'; end if;
  denied:=false; begin update public.app_profiles set kind='REQUESTER' where id=pid; exception when insufficient_privilege then denied:=true; when unique_violation then denied:=true; end;
  if not denied then raise exception 'RU1_PROOF_PROFILE_KIND_MUTATION_ALLOWED'; end if;
  perform public.rpc_complete_worker_profile(pid);
  select profile_status into s from public.app_profiles where id=pid; if s<>'ACTIVE' then raise exception 'RU1_PROOF_RPC_DID_NOT_ACTIVATE'; end if;
  perform public.rpc_complete_worker_profile(pid);
  select profile_status into s from public.app_profiles where id=pid; if s<>'ACTIVE' then raise exception 'RU1_PROOF_REPLAY_CHANGED_ACTIVE'; end if;
  denied:=false; begin delete from public.app_profiles where id=pid; exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'RU1_PROOF_PROFILE_DELETE_ALLOWED'; end if;
end $ready_worker$;

select set_config('request.jwt.claim.sub',current_setting('uskoci.ru1_no_skill_user'),true);
do $no_skill$
declare uid uuid:=current_setting('uskoci.ru1_no_skill_user')::uuid; pid uuid; denied boolean:=false; s text;
begin
  if auth.uid() is distinct from uid then raise exception 'RU1_PROOF_NO_SKILL_AUTH_CONTEXT_MISMATCH'; end if;
  select id into pid from public.app_profiles where account_id=uid and kind='WORKER';
  if pid is null then raise exception 'RU1_PROOF_NO_SKILL_WORKER_NOT_VISIBLE'; end if;
  begin perform public.rpc_complete_worker_profile(pid); exception when sqlstate 'P0001' then if sqlerrm='SKILL_REQUIRED' then denied:=true; else raise; end if; end;
  if not denied then raise exception 'RU1_PROOF_MISSING_SKILL_ACTIVATION_ALLOWED'; end if;
  select profile_status into s from public.app_profiles where id=pid; if s<>'DRAFT' then raise exception 'RU1_PROOF_MISSING_SKILL_LEFT_DRAFT'; end if;
end $no_skill$;

select set_config('request.jwt.claim.sub',current_setting('uskoci.ru1_insert_user'),true);
do $insert_force$
declare uid uuid:=current_setting('uskoci.ru1_insert_user')::uuid; pid uuid; s text;
begin
  if auth.uid() is distinct from uid then raise exception 'RU1_PROOF_INSERT_AUTH_CONTEXT_MISMATCH'; end if;
  insert into public.app_profiles(account_id,kind,display_name,city,skills,profile_status) values(uid,'WORKER','RU1 Insert Worker','Novi Sad',array['proof-skill'],'ACTIVE') returning id into pid;
  select profile_status into s from public.app_profiles where id=pid; if s<>'DRAFT' then raise exception 'RU1_PROOF_CLIENT_INSERT_FORCED_ACTIVE'; end if;
end $insert_force$;

select set_config('request.jwt.claim.sub',current_setting('uskoci.ru1_attacker_user'),true);
do $attacker$
declare victim uuid:=current_setting('uskoci.ru1_ready_user')::uuid; attacker uuid:=current_setting('uskoci.ru1_attacker_user')::uuid; touched integer;
begin
  if auth.uid() is distinct from attacker then raise exception 'RU1_PROOF_ATTACKER_AUTH_CONTEXT_MISMATCH'; end if;
  update public.app_profiles set city='Attacker City' where account_id=victim and kind='WORKER'; get diagnostics touched=row_count;
  if touched<>0 then raise exception 'RU1_PROOF_ATTACKER_UPDATED_VICTIM'; end if;
end $attacker$;

reset role;
rollback;
