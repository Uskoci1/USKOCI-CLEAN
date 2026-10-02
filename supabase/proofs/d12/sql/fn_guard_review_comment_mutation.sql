begin
 -- The comment is part of an immutable review: no author edit, no author delete, for every role. Exactly two paths exist, both service-owned and both narrower than the table.
 if auth.role()='service_role' then
  -- 1. The account-closure erasure certificate (one locked row, one fixed DELETE patch, inside the service-owned SQL transaction): the author's own text goes, the review row stays.
  if tg_op='DELETE' and private.closure_redaction_allowed_v5(tg_relid,tg_op,to_jsonb(old),null) then return old; end if;
  -- 2. The audited moderation function: ONLY the two hide columns, ONLY while its transaction-local marker is on, and nothing else of the row may change.
  if tg_op='UPDATE' and current_setting('uskoci.review_comment_moderation',true) is not distinct from 'on'
   and (to_jsonb(new)-array['hidden_at','hidden_reason_code']) is not distinct from (to_jsonb(old)-array['hidden_at','hidden_reason_code']) then
   return new;
  end if;
 end if;
 raise exception 'REVIEW_COMMENT_IMMUTABLE' using errcode='42501';
end;
