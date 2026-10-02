declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews;
 rating_value numeric; tags_value text[]; h text; target_role text;
 comment_value text; comment_sha text; stored_comment text; stored_sha text;
begin
 -- D12: the legacy review command (same auth, validation order, locks, eligibility, star hash, audit row and REVIEW_RECEIVED event, byte for byte in behaviour) plus ONE optional comment
 -- that is stored in the SAME transaction as the stars and never later. The legacy function stays untouched and keeps serving every installed build.
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_agreement_id is null or p_target_account_id is null or p_target_account_id=u or p_client_request_id is null
 or jsonb_typeof(p_rating) is distinct from 'number' or length(p_rating::text)>30 then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 rating_value:=(p_rating#>>'{}')::numeric;
 if rating_value not between 1 and 5 or trunc(rating_value)<>rating_value then
  raise exception 'REVIEW_INPUT_INVALID' using errcode='22023';
 end if;
 if jsonb_typeof(p_tags) is distinct from 'array' then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 if jsonb_array_length(p_tags)>3 or exists(select 1 from jsonb_array_elements(p_tags) t
  where jsonb_typeof(t.value)<>'string' or not (t.value#>>'{}'=any(private.review_tag_catalog()))) then
  raise exception 'REVIEW_TAGS_INVALID' using errcode='22023';
 end if;
 tags_value:=array(select t.value#>>'{}' from jsonb_array_elements(p_tags) t order by (t.value#>>'{}') collate "C");
 if not private.review_tags_valid(tags_value) then raise exception 'REVIEW_TAGS_INVALID' using errcode='22023'; end if;
 -- The star hash keeps the legacy formula exactly (so every stored hash and every replay through either function stays compatible); the comment is bound by its own digest in its own row.
 h:=encode(extensions.digest(jsonb_build_object('agreementId',p_agreement_id,'target',p_target_account_id,
  'rating',rating_value::integer,'tags',to_jsonb(tags_value))::text,'sha256'),'hex');
 comment_value:=private.review_comment_input_v1(p_comment);
 comment_sha:=case when comment_value is null then null else encode(extensions.digest(convert_to(comment_value,'UTF8'),'sha256'),'hex') end;
 -- Same successful command remains an immutable read, even after a later block.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-command:'||u::text||':'||p_client_request_id::text,9120));
 select * into r from private.agreement_reviews where reviewer_account_id=u and client_request_id=p_client_request_id;
 if found then
  if r.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  -- A comment that differs from the stored one (or one added to a stored star-only review) is another command under the same id.
  select c.comment,c.comment_sha256 into stored_comment,stored_sha from private.agreement_review_comments_v1 c where c.review_id=r.id;
  if stored_sha is distinct from comment_sha then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return private.review_receipt(r,true)||jsonb_build_object('comment',stored_comment);
 end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id) for share;
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 if p_target_account_id<>(case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end) then
  raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501';
 end if;
 if a.status<>'COMPLETED' or not exists(select 1 from public.agreement_execution where agreement_id=a.id and state='COMPLETED') then
  raise exception 'REVIEW_NOT_COMPLETED' using errcode='55000';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-agreement:'||a.id::text||':'||u::text,9120));
 if exists(select 1 from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u) then
  raise exception 'REVIEW_ALREADY_SUBMITTED' using errcode='55000';
 end if;
 -- A block cannot remove the counterpart's completed-work review entitlement (stars and comment alike; a refusal would reveal the block).
 -- P8 suppresses ordinary deliveries, including this event, for blocked pairs. The comment is hidden from readers while the pair is blocked, at read time.
 insert into private.agreement_reviews(agreement_id,reviewer_account_id,target_account_id,rating,tags,client_request_id,input_hash)
 values(a.id,u,p_target_account_id,rating_value::integer,tags_value,p_client_request_id,h) returning * into r;
 if comment_value is not null then
  insert into private.agreement_review_comments_v1(review_id,author_account_id,target_account_id,comment,comment_sha256,created_at)
  values(r.id,r.reviewer_account_id,r.target_account_id,comment_value,comment_sha,r.created_at);
 end if;
 perform private.audit_marketplace(u,'AGREEMENT_REVIEW_SUBMITTED','AGREEMENT',a.id,a.current_version,jsonb_build_object('reviewId',r.id));
 target_role:=case when u=a.requester_account_id then 'WORKER' else 'REQUESTER' end;
 perform private.emit_event(p_target_account_id,target_role,'REVIEW_RECEIVED','AGREEMENT',a.id,a.current_version,
  'Nova ocena','Dobili ste ocenu za zavr'||chr(353)||'en Dogovor.','agreement-review:'||r.id::text,'NORMAL','{}'::jsonb,null);
 return private.review_receipt(r,false)||jsonb_build_object('comment',comment_value);
end;
