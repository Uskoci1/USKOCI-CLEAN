-- V5 owned Q&A context and exact-key recovery. Read-only; no rate value,
-- moderation decision, publication, new table or activation is seeded.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create function public.rpc_read_preselection_qa_context(p_expected_user_id uuid,p_need_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();n public.needs;is_owner boolean;active_worker boolean;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_need_id is null then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 select * into n from public.needs where id=p_need_id;
 if not found then raise exception 'NEED_NOT_FOUND' using errcode='42501';end if;
 is_owner:=n.requester_account_id=u;
 if not is_owner and (n.status not in('PUBLISHED','ACTIVE') or private.safety_pair_blocked(u,n.requester_account_id)) then raise exception 'NEED_NOT_FOUND' using errcode='42501';end if;
 perform private.closure_assert_open(u,n.requester_account_id);
 active_worker:=exists(select 1 from public.app_profiles where account_id=u and kind='WORKER' and profile_status='ACTIVE');
 -- Existing ru4b_assert_rate_authority_ready is still a deliberately closed
 -- placeholder. No boolean toggle may bypass it. A reviewed forward adapter
 -- must replace both that authority and this corresponding read projection.
 return jsonb_build_object('accountId',u,'needId',n.id,'needRevision',n.revision,'title',n.title,
 'mode',case when is_owner then 'OWNER' else 'PUBLIC' end,'publicRevision',n.status in('PUBLISHED','ACTIVE'),
 'activeWorker',active_worker,'canAsk',false,'canComposeAnswer',is_owner and n.status in('PUBLISHED','ACTIVE'),
 'ratePolicyState','NOT_READY','ratePolicyCode','RU4B_RATE_POLICY_NOT_READY','questionMaxChars',null,'answerMaxChars',null,
 'contentDecision','EXACT_SERVER_DECISION_REQUIRED','authoritative',true);
end $f$;
create function public.rpc_read_preselection_qa_command(p_expected_user_id uuid,p_need_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();c private.preselection_qa_commands;q private.preselection_qa_questions;answer_text text;payload jsonb;fingerprint text;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_need_id is null or p_client_request_id is null then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 select * into c from private.preselection_qa_commands where actor_account_id=u and request_id=p_client_request_id;
 if found then select * into q from private.preselection_qa_questions where id=(c.result->>'questionId')::uuid and need_id=p_need_id;end if;
 if c.actor_account_id is null or q.id is null then return jsonb_build_object('accountId',u,'needId',p_need_id,'clientRequestId',p_client_request_id,'found',false,'command',null,'authoritative',true);end if;
 if c.command_type='ASK' then
  fingerprint:=encode(extensions.digest(convert_to(q.question_text,'UTF8'),'sha256'),'hex');
  payload:=jsonb_build_object('questionId',q.id,'status','PENDING_ANSWER','needRevision',q.need_revision,'idempotentReplay',true);
 elsif c.command_type='ANSWER' then
  select a.answer_text into answer_text from private.preselection_qa_answer_versions a where a.question_id=q.id and a.answer_version=(c.result->>'answerVersion')::integer and a.answered_by_account_id=u;
  if not found then raise exception 'QA_RECEIPT_UNAVAILABLE' using errcode='55000';end if;
  fingerprint:=encode(extensions.digest(convert_to(answer_text,'UTF8'),'sha256'),'hex');
  payload:=jsonb_build_object('questionId',q.id,'status','ANSWERED_PUBLIC','answerVersion',c.result->'answerVersion','edited',c.result->'edited','idempotentReplay',true);
 elsif c.command_type='DISPOSITION' and c.result->>'status' in('IGNORED','REPORTED') then
  payload:=jsonb_build_object('questionId',q.id,'status',c.result->>'status','idempotentReplay',true);
 else raise exception 'QA_RECEIPT_UNAVAILABLE' using errcode='55000';end if;
 return jsonb_build_object('accountId',u,'needId',p_need_id,'clientRequestId',p_client_request_id,'found',true,'authoritative',true,
 'command',jsonb_build_object('type',c.command_type,'needRevision',q.need_revision,'textSha256',fingerprint,'receipt',payload));
end $f$;
revoke all on function public.rpc_read_preselection_qa_context(uuid,uuid),public.rpc_read_preselection_qa_command(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_read_preselection_qa_context(uuid,uuid),public.rpc_read_preselection_qa_command(uuid,uuid,uuid) to authenticated;
-- Preserve the existing answered/current-revision projection, adding the same
-- account visibility boundary when this reader is invoked without the new UI.
create or replace function public.rpc_ru4b_public_preselection_qa(p_need_id uuid)
returns table(question_id uuid,need_revision integer,question_text text,answer_version integer,answer_text text,edited boolean,answered_at timestamptz)
language sql stable security definer set search_path=pg_catalog as $f$
 select q.id,q.need_revision,q.question_text,a.answer_version,a.answer_text,(a.answer_version>1),q.answered_at
 from private.preselection_qa_questions q
 join public.needs n on n.id=q.need_id and n.revision=q.need_revision and n.status in('PUBLISHED','ACTIVE')
 join lateral(select av.answer_version,av.answer_text from private.preselection_qa_answer_versions av
  where av.question_id=q.id order by av.answer_version desc limit 1) a on true
 where q.need_id=p_need_id and q.status='ANSWERED_PUBLIC' and auth.uid() is not null
 and not private.closure_account_restricted(auth.uid()) and not private.closure_account_restricted(n.requester_account_id)
 and not private.safety_pair_blocked(auth.uid(),n.requester_account_id)
 order by q.answered_at,q.id
 $f$;
notify pgrst,'reload schema';
commit;
