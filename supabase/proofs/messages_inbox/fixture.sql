-- Disposable typed surface only. Not the canonical schema/migration chain.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema private;
create schema proof;
revoke all on schema private, auth, proof from public;
grant usage on schema public, auth, proof to anon, authenticated, service_role;

-- Explicit fixture adapters for Supabase request claims; no GoTrue/JWT verification claim.
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
create table auth.users(id uuid primary key, deleted_at timestamptz, banned_until timestamptz);
create table auth.sessions(id uuid primary key, user_id uuid not null references auth.users, not_after timestamptz);
create table private.account_closure_requests(account_id uuid not null, state text not null);
create table public.app_profiles(id uuid primary key, account_id uuid not null, display_name text);
create table public.needs(id uuid primary key, title text);
create table public.agreements(id uuid primary key, need_id uuid not null references public.needs,
  requester_account_id uuid not null, worker_account_id uuid not null,
  requester_profile_id uuid, worker_profile_id uuid, status text not null);
create table public.agreement_messages(id uuid primary key, agreement_id uuid not null references public.agreements,
  sender_account_id uuid not null, created_at timestamptz not null, body text not null,
  photo_asset_ids uuid[] not null default '{}', voice_asset_id uuid, read_at timestamptz);
create table private.group_conversations_v5(id uuid primary key, need_id uuid not null references public.needs, requester_account_id uuid not null);
create table private.group_memberships_v5(group_id uuid not null, account_id uuid not null, primary key(group_id,account_id));
create table private.group_messages_v5(id uuid primary key, group_id uuid not null, sender_account_id uuid not null,
  created_at timestamptz not null, body text not null);
create table private.group_message_visibility_v5(message_id uuid not null, account_id uuid not null, read_at timestamptz,
  primary key(message_id,account_id));
-- No authenticated direct table access: candidate admission must occur inside its definer.
do $$ declare r record; begin
  for r in select schemaname,tablename from pg_tables where schemaname in ('public','private','auth') loop
    execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
    execute format('revoke all on table %I.%I from public,anon,authenticated,service_role',r.schemaname,r.tablename);
  end loop;
end $$;

create function proof.id(n integer) returns uuid language sql immutable as $$
 select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create table proof.results(name text primary key);
create table proof.state(key text primary key,value jsonb not null);
grant select,insert on proof.results to anon,authenticated,service_role;
grant select,insert,update on proof.state to authenticated;
create function proof.ok(condition boolean,label text) returns void language plpgsql as $$ begin
 if condition is distinct from true then raise exception 'FAIL %',label;end if;
 insert into proof.results values(label);
end $$;
create function proof.expect_error(query text,expected_state text,expected_message text,label text) returns void language plpgsql as $$
declare failed boolean:=false;state text;message text;begin
 begin execute query;exception when others then
  get stacked diagnostics state=returned_sqlstate,message=message_text;
  if state<>expected_state or (expected_message is not null and message<>expected_message) then
   raise exception 'WRONG_ERROR % state=% message=%',label,state,message;
  end if;failed:=true;
 end;
 perform proof.ok(failed,label);
end $$;
-- Every user, task and message below is synthetic and confined to the new container.
insert into auth.users select proof.id(n),null,null from generate_series(1,5)n;
insert into auth.sessions select proof.id(n+10),proof.id(n),null from generate_series(1,5)n;
insert into public.app_profiles select proof.id(n+100),proof.id(n),'Synthetic person '||n from generate_series(1,5)n;
insert into public.needs select proof.id(n+200),'Synthetic task '||n from generate_series(1,5)n;
insert into public.agreements values
 (proof.id(301),proof.id(201),proof.id(1),proof.id(2),proof.id(101),proof.id(102),'COMPLETED'),
 (proof.id(302),proof.id(202),proof.id(2),proof.id(1),proof.id(102),proof.id(101),'CANCELLED'),
 (proof.id(303),proof.id(203),proof.id(2),proof.id(3),proof.id(102),proof.id(103),'CONFIRMED'),
 (proof.id(304),proof.id(204),proof.id(1),proof.id(2),proof.id(101),proof.id(102),'CONFIRMED'),
 (proof.id(305),proof.id(205),proof.id(1),proof.id(2),proof.id(101),proof.id(102),'CONFIRMED'),
 (proof.id(306),proof.id(205),proof.id(1),proof.id(3),proof.id(101),proof.id(103),'CONFIRMED'),
 (proof.id(307),proof.id(201),proof.id(1),proof.id(2),proof.id(101),proof.id(102),'COMPLETED');
insert into public.agreement_messages(id,agreement_id,sender_account_id,created_at,body,photo_asset_ids,voice_asset_id) values
 (proof.id(401),proof.id(301),proof.id(2),'2000-01-01T12:00:00.000001Z','Earlier',array[]::uuid[],null),
 (proof.id(402),proof.id(301),proof.id(1),'2000-01-01T12:00:00.000002Z','Caller sent latest',array[]::uuid[],null),
 (proof.id(403),proof.id(302),proof.id(2),'2000-01-01T12:00:00.000001Z',repeat('🟢',241),array[proof.id(601)],null),
 (proof.id(404),proof.id(303),proof.id(2),'2000-01-01T13:00:00Z','Foreign conversation',array[]::uuid[],null),
 (proof.id(407),proof.id(307),proof.id(2),'2000-01-01T12:00:00.000002Z','Never expose voice fallback transcript',array[]::uuid[],proof.id(607));
insert into private.group_conversations_v5 values
 (proof.id(501),proof.id(205),proof.id(1)),(proof.id(502),proof.id(203),proof.id(2)),(proof.id(503),proof.id(204),proof.id(2));
insert into private.group_memberships_v5 values
 (proof.id(501),proof.id(2)),(proof.id(501),proof.id(3)),(proof.id(502),proof.id(1)),(proof.id(503),proof.id(1));
insert into private.group_messages_v5 values
 (proof.id(701),proof.id(501),proof.id(1),'2000-01-01T12:00:00.000002Z','Own visible message'),
 (proof.id(702),proof.id(501),proof.id(2),'2000-01-01T12:00:00.000002Z','Visible tied latest'),
 (proof.id(703),proof.id(501),proof.id(3),'2000-01-01T12:00:00Z','Visible earlier'),
 (proof.id(704),proof.id(501),proof.id(3),'2000-01-01T13:00:00Z','Invisible later message'),
 (proof.id(705),proof.id(502),proof.id(2),'2000-01-01T13:00:00Z','Membership without owned route'),
 (proof.id(706),proof.id(503),proof.id(2),'2000-01-01T13:00:00Z','Membership without visibility');
insert into private.group_message_visibility_v5 values
 (proof.id(701),proof.id(1),'2000-01-01T14:00:00Z'),(proof.id(702),proof.id(1),null),
 (proof.id(703),proof.id(1),null),(proof.id(704),proof.id(2),null),(proof.id(705),proof.id(1),null),
 (proof.id(702),proof.id(2),null),(proof.id(703),proof.id(3),null);
