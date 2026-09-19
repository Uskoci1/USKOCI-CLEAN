-- Owner AF-D11: numeric Q&A limits. No moderation bundle, provider activation,
-- legal decision or blanket content ALLOW is introduced by this migration.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';
create function private.ru4b_normalized_question_v5(p_text text) returns text
language sql immutable strict set search_path=pg_catalog as $f$
 select lower(btrim(regexp_replace(p_text,'[[:space:]]+',' ','g')))
$f$;
create index preselection_qa_duplicate_v5_idx on private.preselection_qa_questions
 (need_id,need_revision,private.ru4b_normalized_question_v5(question_text));

create function private.ru4b_assert_numeric_policy_v5(p_actor_account_id uuid,p_subject_kind text,p_need_id uuid,p_need_revision integer,p_question_id uuid,p_text text)
returns void language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare moment timestamptz;body text:=btrim(coalesce(p_text,''));
begin
 if p_actor_account_id is null or p_need_id is null or p_need_revision is null or p_need_revision<1 or p_subject_kind not in('QUESTION','ANSWER') or p_subject_kind is null
 or (p_subject_kind='QUESTION' and p_question_id is not null) or (p_subject_kind='ANSWER' and p_question_id is null) then raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 if body='' then raise exception 'EMPTY_CONTENT' using errcode='P0001';end if;
 if p_subject_kind='ANSWER' then
  if char_length(body)>1000 then raise exception 'QA_ANSWER_TOO_LONG' using errcode='P0001';end if;
  return;
 end if;
 if char_length(body)>500 then raise exception 'QA_QUESTION_TOO_LONG' using errcode='P0001';end if;
 -- Final canonical ASK holds both locks until its accepted question and command
 -- commit. Pre-provider checks only admit this check; they reserve no quota.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:qa-rate-v5:'||p_actor_account_id::text,9134));
 perform pg_advisory_xact_lock(hashtextextended('uskoci:qa-duplicate-v5:'||p_need_id::text||':'||p_need_revision::text,9135));
 moment:=clock_timestamp();
 if exists(select 1 from private.preselection_qa_questions x where x.need_id=p_need_id and x.need_revision=p_need_revision
  and private.ru4b_normalized_question_v5(x.question_text)=private.ru4b_normalized_question_v5(body)) then raise exception 'QA_DUPLICATE_QUESTION' using errcode='P0001';end if;
 if (select count(*) from private.preselection_qa_questions x where x.asker_account_id=p_actor_account_id and x.created_at>moment-interval '24 hours')>=10 then raise exception 'QA_ACCOUNT_DAILY_LIMIT' using errcode='P0001';end if;
 if (select count(*) from private.preselection_qa_questions x where x.asker_account_id=p_actor_account_id and x.need_id=p_need_id and x.created_at>moment-interval '24 hours')>=3 then raise exception 'QA_TASK_DAILY_LIMIT' using errcode='P0001';end if;
 if exists(select 1 from private.preselection_qa_questions x where x.asker_account_id=p_actor_account_id and x.created_at>moment-interval '60 seconds') then raise exception 'QA_ASK_COOLDOWN' using errcode='P0001';end if;
end $f$;

create function public.rpc_check_preselection_qa_limits_service(p_actor_account_id uuid,p_subject_kind text,p_need_id uuid,p_need_revision integer,p_question_id uuid,p_text text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $f$
declare n public.needs;question private.preselection_qa_questions;reason text;
begin
 select * into n from public.needs where id=p_need_id for share;
 if not found then raise exception 'NEED_NOT_FOUND' using errcode='42501';end if;
 if n.revision is distinct from p_need_revision then raise exception 'STALE_NEED_REVISION' using errcode='P0001';end if;
 if n.status not in('PUBLISHED','ACTIVE') then raise exception 'NEED_NOT_PUBLIC' using errcode='P0001';end if;
 if p_subject_kind='QUESTION' then
  if n.requester_account_id=p_actor_account_id then raise exception 'REQUESTER_CANNOT_ASK_OWN_TASK' using errcode='42501';end if;
  if not exists(select 1 from public.app_profiles where account_id=p_actor_account_id and kind='WORKER' and profile_status='ACTIVE') then raise exception 'ACTIVE_WORKER_REQUIRED' using errcode='42501';end if;
  perform private.ru4b_assert_block_authority_ready(p_actor_account_id,n.requester_account_id);
 elsif p_subject_kind='ANSWER' then
  if n.requester_account_id is distinct from p_actor_account_id then raise exception 'NOT_NEED_OWNER' using errcode='42501';end if;
  select * into question from private.preselection_qa_questions where id=p_question_id and need_id=n.id and need_revision=n.revision;
  if not found then raise exception 'QUESTION_NOT_FOUND' using errcode='42501';end if;
  if question.status in('IGNORED','REPORTED') then raise exception 'QUESTION_NOT_ANSWERABLE' using errcode='P0001';end if;
  perform private.ru4b_assert_block_authority_ready(question.asker_account_id,p_actor_account_id);
 else raise exception 'QA_INPUT_INVALID' using errcode='22023';end if;
 perform private.ru4b_assert_numeric_policy_v5(p_actor_account_id,p_subject_kind,p_need_id,p_need_revision,p_question_id,p_text);
 reason:=private.ru4b_public_floor_reason(btrim(coalesce(p_text,'')));
 if reason is not null then raise exception '%',reason using errcode='P0001';end if;
 return jsonb_build_object('accountId',p_actor_account_id,'needId',p_need_id,'needRevision',p_need_revision,'subjectKind',p_subject_kind,'questionId',p_question_id,
  'textSha256',encode(extensions.digest(convert_to(btrim(p_text),'UTF8'),'sha256'),'hex'),'ready',true,'policyVersion','V5_QA_LIMITS_1','authoritative',true);
end $f$;
revoke all on function private.ru4b_normalized_question_v5(text),private.ru4b_assert_numeric_policy_v5(uuid,text,uuid,integer,uuid,text),public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text) to service_role;

-- Narrow predecessor-body guards preserve the actual canonical writer, its
-- exact semantic replay branch, safety/materiality/policy gates and events.
do $migration$
declare fn regprocedure;source text;definition text;patched text;anchor text;
begin
 fn:='public.rpc_ru4b_ask_preselection_question(uuid,integer,text,uuid)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n') into source from pg_proc where oid=fn;
 if md5(source)<>'fa83a782c76072f2f839118f94b04687' then raise exception 'QA_ASK_PREDECESSOR_DRIFT';end if;
 definition:=replace(pg_get_functiondef(fn),E'\r\n',E'\n');
 anchor:='perform private.ru4b_assert_rate_authority_ready(v_uid);';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'QA_ASK_RATE_ANCHOR_DRIFT';end if;
 patched:=replace(definition,anchor,'perform private.ru4b_assert_numeric_policy_v5(v_uid,''QUESTION'',p_need_id,p_expected_revision,null,v_text);');
 anchor:=E'insert into private.preselection_qa_questions(need_id,need_revision,asker_account_id,question_text,question_fingerprint)\n  values(p_need_id,p_expected_revision,v_uid,v_text,v_fp)';
 if position(anchor in patched)=0 then raise exception 'QA_ASK_TIME_ANCHOR_DRIFT';end if;
 patched:=replace(patched,anchor,E'insert into private.preselection_qa_questions(need_id,need_revision,asker_account_id,question_text,question_fingerprint,created_at,updated_at)\n  values(p_need_id,p_expected_revision,v_uid,v_text,v_fp,clock_timestamp(),clock_timestamp())');
 execute patched;
 fn:='public.rpc_ru4b_answer_preselection_question(uuid,text,uuid)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n') into source from pg_proc where oid=fn;
 if md5(source)<>'d86f71d2b94ae9dd70e6a4e7f1222493' then raise exception 'QA_ANSWER_PREDECESSOR_DRIFT';end if;
 definition:=replace(pg_get_functiondef(fn),E'\r\n',E'\n');anchor:='perform private.ru4b_assert_block_authority_ready(v_q.asker_account_id,v_uid);';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'QA_ANSWER_LIMIT_ANCHOR_DRIFT';end if;
 execute replace(definition,anchor,anchor||E'\n  perform private.ru4b_assert_numeric_policy_v5(v_uid,''ANSWER'',v_q.need_id,v_q.need_revision,v_q.id,v_text);');
 fn:='public.rpc_read_preselection_qa_context(uuid,uuid)'::regprocedure;
 definition:=pg_get_functiondef(fn);anchor:='''activeWorker'',active_worker,''canAsk'',false,';
 if position(anchor in definition)=0 then raise exception 'QA_CONTEXT_RATE_ANCHOR_DRIFT';end if;
 patched:=replace(definition,anchor,'''activeWorker'',active_worker,''canAsk'',not is_owner and active_worker and n.status in(''PUBLISHED'',''ACTIVE''),');
 anchor:='''ratePolicyState'',''NOT_READY'',''ratePolicyCode'',''RU4B_RATE_POLICY_NOT_READY'',''questionMaxChars'',null,''answerMaxChars'',null,';
 if position(anchor in patched)=0 then raise exception 'QA_CONTEXT_LIMIT_ANCHOR_DRIFT';end if;
 patched:=replace(patched,anchor,'''ratePolicyState'',''READY'',''ratePolicyCode'',null,''questionMaxChars'',500,''answerMaxChars'',1000,');
 patched:=replace(patched,E' -- Existing ru4b_assert_rate_authority_ready is still a deliberately closed\n -- placeholder. No boolean toggle may bypass it. A reviewed forward adapter\n -- must replace both that authority and this corresponding read projection.',E' -- Numeric policy V5_QA_LIMITS_1 is present. Every exact content decision\n -- remains required by the canonical command and provider adapter.');
 execute patched;
end $migration$;
comment on function public.rpc_check_preselection_qa_limits_service(uuid,text,uuid,integer,uuid,text) is 'AF-D11 numeric preflight only. It reserves no quota and grants no content ALLOW. Final canonical command repeats checks under transaction locks.';
notify pgrst,'reload schema';
commit;
