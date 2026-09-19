-- PRE-V3 P7: existing REQUESTER public display name only. Not a legal-name,
-- Worker geography, avatar, KYC, account-city or reputation authority.
-- Candidate only: client compatibility and isolated proof precede any deployment.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table private.requester_identity_commands (
 account_id uuid not null references public.app_accounts(id),
 client_request_id uuid not null,
 profile_id uuid not null references public.app_profiles(id),
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 created_at timestamptz not null default statement_timestamp(),
 primary key(account_id,client_request_id)
);
alter table private.requester_identity_commands enable row level security;
revoke all on private.requester_identity_commands from public,anon,authenticated,service_role;
comment on table private.requester_identity_commands is 'Private PROFILE_DATA/COMMAND_LEDGERS receipt. No deletion/retention execution authorized here. Account closure must include approved retention for this source.';
create function private.requester_identity_document(pid uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $f$
 with material as (select jsonb_build_object('schema','REQUESTER_IDENTITY_V1',
   'accountId',p.account_id,'profileId',p.id,'displayName',p.display_name,
   'updatedAt',to_char(p.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')) doc
   from public.app_profiles p where p.id=pid and p.kind='REQUESTER')
 select (doc-'updatedAt')||jsonb_build_object('revision',encode(extensions.digest(doc::text,'sha256'),'hex'),
   'writableFields',jsonb_build_array('displayName')) from material;
$f$;
revoke all on function private.requester_identity_document(uuid) from public,anon,authenticated,service_role;
create function public.rpc_get_requester_profile_for_edit()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare p public.app_profiles;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into p from public.app_profiles where account_id=auth.uid() and kind='REQUESTER';
 if not found then raise exception 'REQUESTER_PROFILE_REQUIRED' using errcode='55000'; end if;
 if p.profile_status not in('ACTIVE','DRAFT') then raise exception 'REQUESTER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 return private.requester_identity_document(p.id);
end;
$f$;
revoke all on function public.rpc_get_requester_profile_for_edit() from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_requester_profile_for_edit() to authenticated;
create function public.rpc_save_requester_profile(p_expected_revision text,p_display_name jsonb,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare p public.app_profiles; previous_token text; wanted text; supplied text; h text; old_receipt private.requester_identity_commands; doc jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_client_request_id is null or p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{64}$'
   or jsonb_typeof(p_display_name) is distinct from 'string' then
   raise exception 'REQUESTER_PROFILE_INPUT_INVALID' using errcode='22023'; end if;
 supplied:=p_display_name#>>'{}';
 if octet_length(supplied)>800 or length(btrim(supplied)) not between 1 and 200 or supplied ~ '[[:cntrl:]]' then
   raise exception 'REQUESTER_PROFILE_INPUT_INVALID' using errcode='22023'; end if;
 wanted:=btrim(supplied);
 h:=encode(extensions.digest(jsonb_build_object('revision',p_expected_revision,'displayName',wanted)::text,'sha256'),'hex');
 -- The single existing profile row serializes different request IDs and CAS;
 -- all successful retries are read-only and return the original immutable receipt.
 select * into p from public.app_profiles where account_id=auth.uid() and kind='REQUESTER' for update;
 if not found then raise exception 'REQUESTER_PROFILE_REQUIRED' using errcode='55000'; end if;
 if p.profile_status not in('ACTIVE','DRAFT') then raise exception 'REQUESTER_PROFILE_RESTRICTED' using errcode='42501'; end if;
 select * into old_receipt from private.requester_identity_commands where account_id=auth.uid() and client_request_id=p_client_request_id;
 if found then
   if old_receipt.input_hash<>h or old_receipt.profile_id<>p.id then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
   return old_receipt.receipt||jsonb_build_object('idempotentReplay',true);
 end if;
 doc:=private.requester_identity_document(p.id);
 if doc->>'revision'<>p_expected_revision then raise exception 'REQUESTER_PROFILE_STALE' using errcode='40001'; end if;
 if p.display_name is distinct from wanted then
   previous_token:=current_setting('uskoci.profile_mutation',true);
   perform set_config('uskoci.profile_mutation','REQUESTER_IDENTITY',true);
   update public.app_profiles set display_name=wanted where id=p.id;
   perform set_config('uskoci.profile_mutation',coalesce(previous_token,''),true);
 end if;
 doc:=jsonb_build_object('saved',true,'idempotentReplay',false,'clientRequestId',p_client_request_id,
   'identity',private.requester_identity_document(p.id));
 insert into private.requester_identity_commands(account_id,client_request_id,profile_id,input_hash,receipt)
   values(auth.uid(),p_client_request_id,p.id,h,doc);
 return doc;
end;
$f$;
revoke all on function public.rpc_save_requester_profile(text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_save_requester_profile(text,jsonb,uuid) to authenticated;
-- Additive, narrowly scoped trigger; existing identity/status/rating/Worker guards
-- are preserved. Trusted signup insertion remains unchanged. Ordinary external
-- UPDATE cannot bypass revision/idempotency through raw REST.
create function private.guard_requester_identity_writer()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$
begin
 if new.kind='REQUESTER' and auth.role()='authenticated'
   and new.display_name is distinct from old.display_name
   and nullif(current_setting('uskoci.profile_mutation',true),'') is distinct from 'REQUESTER_IDENTITY' then
   raise exception 'REQUESTER_PROFILE_REQUIRES_AUTHORITY' using errcode='42501'; end if;
 return new;
end;
$f$;
revoke all on function private.guard_requester_identity_writer() from public,anon,authenticated,service_role;
create trigger pre_v3_requester_identity before update on public.app_profiles
 for each row execute function private.guard_requester_identity_writer();
notify pgrst,'reload schema';
commit;
