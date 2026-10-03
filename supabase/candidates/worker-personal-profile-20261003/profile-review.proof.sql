-- WPP01 local disposable SQL-role proof; authored, NOT EXECUTED.
-- No provider / Auth HTTP / push / real profile access. Candidate + fixtures rollback.
-- Requires a disposable replay matching all pinned predecessor bodies and certificates.
\set ON_ERROR_STOP on
\if :{?wpp01_local_attested}
\else
 \quit 3
\endif
\if :wpp01_local_attested
\else
 \quit 3
\endif
select :'HOST'='127.0.0.1' and :'PORT'='54322' and :'DBNAME'='postgres'
 and current_user='postgres' as wpp01_local
\gset
\if :wpp01_local
\else
 \quit 3
\endif

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=pg_catalog;
-- This variant intentionally contains no BEGIN/COMMIT, preserving this rollback.
\ir candidate.in-transaction.sql
create temporary table wpp01_fixture(label text primary key,account_id uuid not null,profile_id uuid);
create temporary table wpp01_docs(label text primary key,value jsonb not null);
create function pg_temp.wpp01_actor(aid uuid) returns void language plpgsql as $f$
begin
 perform set_config('request.jwt.claim.sub',coalesce(aid::text,''),true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',aid,'role','authenticated')::text,true);
end
$f$;
create function pg_temp.wpp01_expect(value boolean,label text) returns void language plpgsql as $f$
begin if value is distinct from true then raise exception 'WPP01_PROOF: %',label; end if; end
$f$;
create function pg_temp.wpp01_save_denied(review jsonb) returns void language plpgsql as $f$
begin
 begin
  perform public.rpc_save_worker_ai_review((review->>'reviewId')::uuid,review->>'displayedContentDigest',gen_random_uuid());
 exception when sqlstate 'PT409' then
  if sqlerrm='WORKER_AI_STALE' then return; end if;
  raise;
 end;
 raise exception 'WPP01_EXPECTED_STALE_REVIEW_REFUSAL';
end
$f$;
do $grants$
begin execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end
$grants$;
revoke all on function pg_temp.wpp01_actor(uuid),pg_temp.wpp01_expect(boolean,text),pg_temp.wpp01_save_denied(jsonb)
 from public,anon,authenticated,service_role;
grant execute on function pg_temp.wpp01_expect(boolean,text),pg_temp.wpp01_save_denied(jsonb) to authenticated;
grant select on wpp01_fixture to authenticated;
grant select,insert,update on wpp01_docs to authenticated;
do $fixture$
declare who record;
begin
 insert into wpp01_fixture(label,account_id) values ('owner',gen_random_uuid());
 for who in select * from wpp01_fixture loop
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(who.account_id,'authenticated','authenticated','wpp01-'||who.account_id||'@proof.invalid',statement_timestamp(),
   '{"provider":"email","providers":["email"]}','{"full_name":"Disposable WPP01 worker"}',statement_timestamp(),statement_timestamp());
 end loop;
 update wpp01_fixture f set profile_id=p.id from public.app_profiles p where p.account_id=f.account_id and p.kind='WORKER';
 perform pg_temp.wpp01_expect((select profile_id is not null from wpp01_fixture where label='owner'),'worker bootstrap');
 update public.app_profiles set city='Novi Sad',skills=array['Fizicki poslovi'],licenses=array['Historical self-declaration']
 where id=(select profile_id from wpp01_fixture where label='owner');
end
$fixture$;
select pg_temp.wpp01_actor((select account_id from wpp01_fixture where label='owner'));
set local role authenticated;
do $unchanged$
declare s jsonb;r jsonb;receipt jsonb;again jsonb;
begin
 s:=public.rpc_open_worker_ai(gen_random_uuid());
 perform pg_temp.wpp01_expect(s->'candidate'->'licenses'='["Historical self-declaration"]'::jsonb
  and s->'candidate'->'teamCapacity'='1'::jsonb,'legacy wire values preserved');
 s:=public.rpc_patch_worker_ai((s->>'conversationId')::uuid,(s->>'revision')::integer,'{"bio":"Reviewed personal profile"}');
 r:=public.rpc_prepare_worker_ai_review((s->>'conversationId')::uuid,(s->>'revision')::integer,false);
 receipt:=public.rpc_save_worker_ai_review((r->>'reviewId')::uuid,r->>'displayedContentDigest',gen_random_uuid());
 again:=public.rpc_save_worker_ai_review((r->>'reviewId')::uuid,r->>'displayedContentDigest',gen_random_uuid());
 perform pg_temp.wpp01_expect(receipt=again and receipt->'saved'='true','save/replay preserved');
 insert into wpp01_docs values('savedReview',r),('savedReceipt',receipt);
end
$unchanged$;
reset role;
select pg_temp.wpp01_expect((select licenses=array['Historical self-declaration'] and team_capacity=1 and bio='Reviewed personal profile'
 from public.app_profiles where id=(select profile_id from wpp01_fixture where label='owner')),'no retired-field writes');
\echo PASS WPP01_LEGACY_UNCHANGED_KEYS_SAVE_AND_REPLAY_PRESERVE_STORED_FIELDS

set local role authenticated;
do $changed_retired$
declare s jsonb;r jsonb;patch jsonb;
begin
 foreach patch in array array['{"licenses":[],"bio":"Must not save license edit"}'::jsonb,
  '{"teamCapacity":3,"bio":"Must not save team edit"}'::jsonb] loop
  s:=public.rpc_open_worker_ai(gen_random_uuid());
  s:=public.rpc_patch_worker_ai((s->>'conversationId')::uuid,(s->>'revision')::integer,patch);
  r:=public.rpc_prepare_worker_ai_review((s->>'conversationId')::uuid,(s->>'revision')::integer,false);
  perform pg_temp.wpp01_save_denied(r);
  perform public.rpc_abandon_worker_ai((s->>'conversationId')::uuid);
 end loop;
end
$changed_retired$;
reset role;
select pg_temp.wpp01_expect((select licenses=array['Historical self-declaration'] and team_capacity=1 and bio='Reviewed personal profile'
 from public.app_profiles where id=(select profile_id from wpp01_fixture where label='owner')),'retired edits cannot partially save');
select pg_temp.wpp01_expect((select count(*)=1 from private.worker_ai_saves
 where account_id=(select account_id from wpp01_fixture where label='owner')),'no retired-edit receipts');
\echo PASS WPP01_LEGACY_RETIRED_FIELD_CHANGE_REFUSED_BEFORE_ANY_CANONICAL_WRITE

set local role authenticated;
do $review$
declare s jsonb;r jsonb;
begin
 s:=public.rpc_open_worker_ai(gen_random_uuid());
 s:=public.rpc_patch_worker_ai((s->>'conversationId')::uuid,(s->>'revision')::integer,'{"bio":"Review before concurrent edit"}');
 r:=public.rpc_prepare_worker_ai_review((s->>'conversationId')::uuid,(s->>'revision')::integer,false);
 insert into wpp01_docs values('staleReview',r);
end
$review$;
reset role;
insert into wpp01_docs values('sourceBefore',to_jsonb(private.worker_ai_source_hash((select account_id from wpp01_fixture where label='owner'))));
-- Synthetic concurrent canonical change; same stored profile row protected by the save's FOR UPDATE.
update public.app_profiles set tools=array['New owner tool'] where id=(select profile_id from wpp01_fixture where label='owner');
select pg_temp.wpp01_expect(to_jsonb(private.worker_ai_source_hash((select account_id from wpp01_fixture where label='owner')))
 is distinct from (select value from wpp01_docs where label='sourceBefore'),'canonical edit changes source hash');
set local role authenticated;
select pg_temp.wpp01_save_denied((select value from wpp01_docs where label='staleReview'));
-- An already successful reviewed command still recovers its historical receipt.
select pg_temp.wpp01_expect(public.rpc_save_worker_ai_review(
 ((select value from wpp01_docs where label='savedReview')->>'reviewId')::uuid,
 (select value from wpp01_docs where label='savedReview')->>'displayedContentDigest',gen_random_uuid())
 =(select value from wpp01_docs where label='savedReceipt'),'historical replay remains exact after later edit');
reset role;
select pg_temp.wpp01_expect((select bio='Reviewed personal profile' and tools=array['New owner tool'] and team_capacity=1
 and licenses=array['Historical self-declaration'] from public.app_profiles
 where id=(select profile_id from wpp01_fixture where label='owner')),'stale save cannot replace canonical edits');
select pg_temp.wpp01_expect((select count(*)=1 from private.worker_ai_saves
 where account_id=(select account_id from wpp01_fixture where label='owner')),'stale save creates no receipt');
\echo PASS WPP01_SOURCE_HASH_INVALIDATES_UNSAVED_REVIEW_HISTORICAL_RECEIPT_STAYS_EXACT
rollback;

