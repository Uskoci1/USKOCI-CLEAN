declare c private.agreement_review_comments_v1; v_agreement uuid; v_hide boolean;
begin
 -- D12 moderation (owner decision D-DEC-2): HIDE or RESTORE the TEXT of one comment, by the service role only, by an operator who acts on purpose (the owner, in a controlled test). There is no automatic
 -- trigger, no AI, no notification and no author action. Stars, the count, the average and ratingDue are never touched: only the two hide columns of the comment row change.
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_review_id is null or p_client_request_id is null or p_action is null or p_action not in('HIDE','RESTORE')
  or (p_action='HIDE' and (p_reason_code is null or p_reason_code !~ '^[A-Z][A-Z0-9_]{0,63}$'))
  or (p_action='RESTORE' and p_reason_code is not null) then
  raise exception 'REVIEW_COMMENT_MODERATION_INVALID' using errcode='22023';
 end if;
 v_hide:=p_action='HIDE';
 select * into c from private.agreement_review_comments_v1 where review_id=p_review_id for update;
 if not found then raise exception 'REVIEW_COMMENT_NOT_FOUND' using errcode='P0002'; end if;
 -- Idempotent by state: repeating the same action changes and writes nothing. HIDE under another reason needs a RESTORE first (a deterministic conflict: PT409, never the SQLSTATE that PostgREST retries without end).
 if v_hide and c.hidden_at is not null then
  if c.hidden_reason_code=p_reason_code then
   return jsonb_build_object('reviewId',c.review_id,'hidden',true,'reasonCode',c.hidden_reason_code,'changed',false,'authoritative',true);
  end if;
  raise exception 'REVIEW_COMMENT_MODERATION_CONFLICT' using errcode='PT409';
 end if;
 if not v_hide and c.hidden_at is null then
  return jsonb_build_object('reviewId',c.review_id,'hidden',false,'reasonCode',null,'changed',false,'authoritative',true);
 end if;
 perform set_config('uskoci.review_comment_moderation','on',true);
 update private.agreement_review_comments_v1
  set hidden_at=case when v_hide then clock_timestamp() else null end,
      hidden_reason_code=case when v_hide then p_reason_code else null end
  where review_id=c.review_id;
 perform set_config('uskoci.review_comment_moderation','off',true);
 select agreement_id into v_agreement from private.agreement_reviews where id=c.review_id;
 -- Audit: ids and the reason code only, never any text. The actor is the service role (no account), so the actor column stays empty.
 perform private.audit_marketplace(null,case when v_hide then 'AGREEMENT_REVIEW_COMMENT_HIDDEN' else 'AGREEMENT_REVIEW_COMMENT_RESTORED' end,'AGREEMENT',v_agreement,null,
  jsonb_build_object('reviewId',c.review_id,'reasonCode',coalesce(p_reason_code,c.hidden_reason_code),'requestId',p_client_request_id));
 return jsonb_build_object('reviewId',c.review_id,'hidden',v_hide,'reasonCode',case when v_hide then p_reason_code else null end,'changed',true,'authoritative',true);
end;
