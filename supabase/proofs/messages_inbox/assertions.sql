-- Actual PostgreSQL execution. Request claims are fixture inputs, not signed JWTs.
set timezone='UTC';
select proof.ok((select prosecdef and proconfig=array['search_path=pg_catalog'] and pg_get_userbyid(proowner)='postgres'
 from pg_proc where oid='public.rpc_list_my_conversations_v1(uuid,integer,jsonb)'::regprocedure),'reader_definer_owner_fixed_path');
select proof.ok((select md5(prosrc)='c972c1004450436d665cf2f4b9d1fcca' from pg_proc
 where oid='public.rpc_list_my_conversations_v1(uuid,integer,jsonb)'::regprocedure),'exact_frozen_reader_body');
select proof.ok(has_function_privilege('authenticated','public.rpc_list_my_conversations_v1(uuid,integer,jsonb)','EXECUTE')
 and not has_function_privilege('anon','public.rpc_list_my_conversations_v1(uuid,integer,jsonb)','EXECUTE')
 and not has_function_privilege('service_role','public.rpc_list_my_conversations_v1(uuid,integer,jsonb)','EXECUTE'),'restricted_reader_execute_acl');
select proof.ok(not has_table_privilege('authenticated','public.agreement_messages','SELECT')
 and not has_table_privilege('authenticated','private.group_message_visibility_v5','SELECT'),'no_new_direct_table_admission');
set role anon;
select proof.expect_error('select public.rpc_list_my_conversations_v1(null)','42501',null,'anon_execute_denied');
reset role;
set role service_role;
select proof.expect_error('select public.rpc_list_my_conversations_v1(null)','42501',null,'service_role_execute_denied');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',proof.id(1),'role','authenticated','session_id',proof.id(11))::text,false);
set role authenticated;
select proof.expect_error('select * from public.agreement_messages','42501',null,'authenticated_direct_message_read_denied');
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L)',proof.id(2)),'28000','AUTH_CONTEXT_CHANGED','expected_account_mismatch_denied');
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L,0)',proof.id(1)),'22023','INBOX_LIMIT_INVALID','zero_limit_denied');
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L,51)',proof.id(1)),'22023','INBOX_LIMIT_INVALID','oversized_limit_denied');
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L,null)',proof.id(1)),'22023','INBOX_LIMIT_INVALID','null_limit_denied');
do $$ declare p jsonb;r jsonb;expected text[];seen text[];c jsonb;page_size integer;walks integer;bad jsonb;n integer:=0;begin
 p:=public.rpc_list_my_conversations_v1(proof.id(1));
 perform proof.ok(p->>'schema'='MY_CONVERSATIONS_PAGE_V1' and p->>'accountId'=proof.id(1)::text
  and p->'authoritative'='true'::jsonb and (p->>'snapshotAt')::timestamptz<=(p->>'asOf')::timestamptz,'authoritative_owned_envelope');
 perform proof.ok(jsonb_array_length(p->'items')=4 and p->'nextCursor'='null'::jsonb,'one_row_per_nonempty_admitted_conversation');
 expected:=array['GROUP:'||proof.id(501),'AGREEMENT:'||proof.id(307),'AGREEMENT:'||proof.id(301),'AGREEMENT:'||proof.id(302)];
 select array_agg((value->>'kind')||':'||(value->>'id') order by ord) into seen
  from jsonb_array_elements(p->'items') with ordinality v(value,ord);
 perform proof.ok(seen=expected,'timestamp_microseconds_kind_C_UUID_order');
 select value into r from jsonb_array_elements(p->'items')v(value) where value->>'id'=proof.id(501)::text;
 perform proof.ok(r->>'routeAgreementId'=proof.id(305)::text and r->'counterpart'='null'::jsonb
  and r->'lastMessage'->>'id'=proof.id(702)::text and r->'lastMessage'->>'kind'='TEXT'
  and (r->>'unreadMessageCount')::integer=2,'group_visible_latest_unread_and_owned_route');
 select value into r from jsonb_array_elements(p->'items')v(value) where value->>'id'=proof.id(301)::text;
 perform proof.ok(r->'lastMessage'->'mine'='true'::jsonb and r->'lastMessage'->>'id'=proof.id(402)::text
  and r->'unreadMessageCount'='null'::jsonb,'caller_sent_latest_terminal_private_unknown_unread');
 select value into r from jsonb_array_elements(p->'items')v(value) where value->>'id'=proof.id(307)::text;
 perform proof.ok(r->'lastMessage'->>'kind'='VOICE' and r->'lastMessage'->'preview'='null'::jsonb
  and not (r->'lastMessage' ?| array['assetId','url','objectPath','voice_asset_id']),'voice_projection_has_no_transcript_or_storage_fields');
 select value into r from jsonb_array_elements(p->'items')v(value) where value->>'id'=proof.id(302)::text;
 perform proof.ok(r->'lastMessage'->>'kind'='PHOTO' and length(r->'lastMessage'->>'preview')=240
  and r->'unreadMessageCount'='null'::jsonb,'photo_caption_unicode_bound_without_private_read_guess');
 foreach page_size in array array[1,2,3,4,50] loop
  c:=null;seen:='{}';walks:=0;
  loop
   p:=public.rpc_list_my_conversations_v1(proof.id(1),page_size,c);walks:=walks+1;
   if walks>10 then raise exception 'PAGING_DID_NOT_TERMINATE';end if;
   if jsonb_array_length(p->'items')>page_size then raise exception 'PAGE_OVERSIZED';end if;
   for r in select value from jsonb_array_elements(p->'items') loop seen:=array_append(seen,(r->>'kind')||':'||(r->>'id'));end loop;
   if p->'nextCursor'='null'::jsonb then exit;end if;
   c:=p->'nextCursor';r:=p->'items'->(page_size-1);
   if c->'snapshotAt' is distinct from p->'snapshotAt' or c->>'lastAt' is distinct from r->'lastMessage'->>'createdAt'
    or c->>'kind' is distinct from r->>'kind' or c->>'id' is distinct from r->>'id' then raise exception 'TAIL_CURSOR_MISMATCH';end if;
  end loop;
  perform proof.ok(seen=expected,'complete_paging_no_duplicates_limit_'||page_size);
 end loop;
 for bad in select v from (values
  ('null'::jsonb),('[]'::jsonb),('{}'::jsonb),
  (jsonb_build_object('snapshotAt','2000-01-02T00:00:00Z','lastAt','2000-01-01T00:00:00Z','kind',null,'id',proof.id(301))),
  (jsonb_build_object('snapshotAt','infinity','lastAt','2000-01-01T00:00:00Z','kind','AGREEMENT','id',proof.id(301))),
  (jsonb_build_object('snapshotAt','2999-01-01T00:00:00Z','lastAt','2000-01-01T00:00:00Z','kind','AGREEMENT','id',proof.id(301))),
  (jsonb_build_object('snapshotAt','2000-01-01T00:00:00Z','lastAt','2000-01-02T00:00:00Z','kind','AGREEMENT','id',proof.id(301))),
  (jsonb_build_object('snapshotAt','2000-02-30T00:00:00Z','lastAt','2000-01-01T00:00:00Z','kind','AGREEMENT','id',proof.id(301))),
  (jsonb_build_object('snapshotAt','2000-01-02T00:00:00Z','lastAt','2000-01-01T00:00:00Z','kind','AGREEMENT','id',proof.id(301),'unexpected',true))
 )b(v) loop
  n:=n+1;perform proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L,1,%L::jsonb)',proof.id(1),bad::text),
   '22023','INBOX_CURSOR_INVALID','malformed_cursor_'||n);
 end loop;
 p:=public.rpc_list_my_conversations_v1(proof.id(1),1);
 insert into proof.state values('cutoff',p);
end $$;
reset role;
-- Read calls must not ACK either legacy private messages or group visibility.
select proof.ok(not exists(select 1 from public.agreement_messages where read_at is not null)
 and (select count(*) from private.group_message_visibility_v5 where read_at is not null)=1,'listing_does_not_ack');
-- A new message after the snapshot does not reorder the continuation of that snapshot.
insert into public.agreement_messages(id,agreement_id,sender_account_id,created_at,body)
 select proof.id(408),proof.id(301),proof.id(2),(value->>'snapshotAt')::timestamptz+interval '1 microsecond','After cutoff' from proof.state where key='cutoff';
set role authenticated;
do $$ declare first_page jsonb;p jsonb;r jsonb;begin
 select value into first_page from proof.state where key='cutoff';
 p:=public.rpc_list_my_conversations_v1(proof.id(1),50,first_page->'nextCursor');
 select value into r from jsonb_array_elements(p->'items')v(value) where value->>'id'=proof.id(301)::text;
 perform proof.ok(jsonb_array_length(p->'items')=3 and r->'lastMessage'->>'id'=proof.id(402)::text
  and p->'snapshotAt'=first_page->'snapshotAt','continuation_excludes_post_cutoff_arrival');
 -- Same instant with a different timezone spelling is a valid continuation.
 p:=public.rpc_list_my_conversations_v1(proof.id(1),50,(first_page->'nextCursor')||jsonb_build_object('lastAt','2000-01-01T14:00:00.000002+02:00'));
 perform proof.ok(jsonb_array_length(p->'items')=3,'cursor_offset_equivalence_preserves_microseconds');
 p:=public.rpc_list_my_conversations_v1(proof.id(1));
 perform proof.ok(p->'items'->0->'lastMessage'->>'id'=proof.id(408)::text,'fresh_page_sees_new_arrival');
end $$;
reset role;
insert into private.account_closure_requests values(proof.id(2),'READY');
set role authenticated;
do $$ declare p jsonb;begin
 p:=public.rpc_list_my_conversations_v1(proof.id(1));
 perform proof.ok(not exists(select 1 from jsonb_array_elements(p->'items')v where v->>'kind'='AGREEMENT' and v->'counterpart'<>'null'::jsonb),
  'restricted_counterpart_identity_omitted_without_erasing_history');
end $$;
reset role;
delete from private.account_closure_requests;
insert into private.account_closure_requests values(proof.id(1),'EXECUTING');
set role authenticated;
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L)',proof.id(1)),'42501','ACCOUNT_CLOSING','restricted_caller_denied');
reset role;
delete from private.account_closure_requests;
update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=proof.id(11);
set role authenticated;
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L)',proof.id(1)),'28000','AUTH_REQUIRED','expired_session_denied');
reset role;
update auth.sessions set not_after=null where id=proof.id(11);
update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=proof.id(1);
set role authenticated;
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L)',proof.id(1)),'28000','AUTH_REQUIRED','banned_caller_denied');
reset role;
update auth.users set banned_until=null where id=proof.id(1);
select set_config('request.jwt.claims',jsonb_build_object('sub',proof.id(1),'role','authenticated')::text,false);
set role authenticated;
select proof.expect_error(format('select public.rpc_list_my_conversations_v1(%L)',proof.id(1)),'28000','AUTH_REQUIRED','missing_session_denied');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',proof.id(4),'role','authenticated','session_id',proof.id(14))::text,false);
set role authenticated;
select proof.ok(public.rpc_list_my_conversations_v1(proof.id(4))->'items'='[]'::jsonb,'stranger_receives_authoritative_empty_not_foreign_messages');
reset role;
-- C owns an Agreement and has explicit visibility, but group membership remains necessary.
select set_config('request.jwt.claims',jsonb_build_object('sub',proof.id(3),'role','authenticated','session_id',proof.id(13))::text,false);
set role authenticated;
select proof.ok(exists(select 1 from jsonb_array_elements(public.rpc_list_my_conversations_v1(proof.id(3))->'items')v
 where v->>'kind'='GROUP' and v->>'id'=proof.id(501)::text),'admitted_worker_group_before_removal');
reset role;
delete from private.group_memberships_v5 where group_id=proof.id(501) and account_id=proof.id(3);
set role authenticated;
select proof.ok(not exists(select 1 from jsonb_array_elements(public.rpc_list_my_conversations_v1(proof.id(3))->'items')v
 where v->>'kind'='GROUP'),'membership_removed_does_not_reuse_old_visibility');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',proof.id(1),'role','authenticated','session_id',proof.id(11))::text,false);
delete from private.group_message_visibility_v5 where account_id=proof.id(1) and message_id in(proof.id(702),proof.id(703));
set role authenticated;
do $$ declare p jsonb;r jsonb;begin
 p:=public.rpc_list_my_conversations_v1(proof.id(1));
 select value into r from jsonb_array_elements(p->'items')v(value) where value->>'kind'='GROUP';
 perform proof.ok(r->'lastMessage'->>'id'=proof.id(701)::text and r->>'unreadMessageCount'='0','visibility_revoked_rechecks_latest_and_unread');
end $$;
reset role;
delete from private.group_message_visibility_v5 where account_id=proof.id(1) and message_id=proof.id(701);
set role authenticated;
select proof.ok(not exists(select 1 from jsonb_array_elements(public.rpc_list_my_conversations_v1(proof.id(1))->'items')v
 where v->>'kind'='GROUP'),'membership_without_any_visible_message_is_not_a_conversation');
reset role;
select proof.ok(true,'proof_completed');
