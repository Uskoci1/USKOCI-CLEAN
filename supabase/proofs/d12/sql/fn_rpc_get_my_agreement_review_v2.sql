declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews; own_review jsonb; own_comment text;
begin
 -- D12: the legacy context (same participant gate, same eligibility incl. the closure restriction, same tag catalog) plus the author's OWN comment inside the review and the comment policy.
 -- The presence of THIS function is the capability a new client tests; an older server answers PGRST202 and the client falls back to the legacy pair.
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 select * into r from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u;
 if found then
  select c.comment into own_comment from private.agreement_review_comments_v1 c where c.review_id=r.id;
  own_review:=private.review_receipt(r,false)||jsonb_build_object('comment',own_comment);
 end if;
 return jsonb_build_object('accountId',u,'agreementId',a.id,
 'targetAccountId',case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end,
 'eligible',own_review is null and not private.closure_account_restricted(u) and a.status='COMPLETED' and exists(select 1 from public.agreement_execution where agreement_id=a.id and state='COMPLETED'),
 'review',own_review,'tagCatalog',jsonb_build_object('version','PRE_V3_REVIEW_TAGS_V1','maxTags',3,'tags',to_jsonb(private.review_tag_catalog())),
 'commentPolicy',jsonb_build_object('supported',true,'maxLength',{{COMMENT_MAX_CHARS}},'version','REVIEW_COMMENT_V1'),
 'authoritative',true);
end;
