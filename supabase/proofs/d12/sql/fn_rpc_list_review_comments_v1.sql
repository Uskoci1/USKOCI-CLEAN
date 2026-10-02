declare v_actor uuid:=auth.uid(); v_profile public.app_profiles; v_limit integer; v_after_at timestamptz; v_after_id uuid; v_items jsonb; v_more boolean;
begin
 -- D12: the gated reader of the written comments ABOUT the person whose public profile is open. One paged, account-level list (a review is account-level reputation, both roles pooled);
 -- only reviews that carry a visible comment appear (a star-only review has no text row, but the public count and average still include it, so for a small count the rating of a star-only review can be inferred by subtraction from the
 -- listed ratings: an owner-visible consequence, README_D12_CANDIDATE.md); stars, the count and the average are never changed by anything here.
 -- DESIGN DEFAULT D-DEC-7 (the owner accepted the defaults of the design): ONE account-level list usable from both profile kinds, so the same reviewIds and texts appear under the REQUESTER and the WORKER profile of one person and each item names the role
 -- of its author: an observer who has seen both faces can LINK them by comparing lists. A role-scoped list is a function-only change (add: and the target role of the Agreement equals v_profile.kind) that needs no certificate move; it is NOT implemented here.
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_profile_id is null then raise exception 'PROFILE_ID_REQUIRED' using errcode='22023'; end if;
 v_limit:=least(greatest(coalesce(p_limit,{{COMMENT_PAGE_DEFAULT}}),1),{{COMMENT_PAGE_MAX}});
 if p_after is not null and jsonb_typeof(p_after)<>'null' then
  if jsonb_typeof(p_after)<>'object' or jsonb_typeof(p_after->'createdAt') is distinct from 'string' or jsonb_typeof(p_after->'reviewId') is distinct from 'string' then
   raise exception 'INVALID_PAGE' using errcode='22023';
  end if;
  begin
   v_after_at:=(p_after->>'createdAt')::timestamptz; v_after_id:=(p_after->>'reviewId')::uuid;
  exception when data_exception then raise exception 'INVALID_PAGE' using errcode='22023';
  end;
 end if;
 -- The gate stack of rpc_get_public_profile, in the same order and with the same safe failure: an ACTIVE profile only, closure-restricted viewer or subject, a blocked pair and another world all read as "nothing here".
 select p.* into v_profile from public.app_profiles p where p.id=p_profile_id and p.profile_status='ACTIVE' and p.kind in('REQUESTER','WORKER');
 if not found then return null; end if;
 if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;
 if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;
 if not private.accounts_same_world(v_actor,v_profile.account_id) then return null; end if;
 -- Read-time gating of every row: a hidden comment, an author under a closure restriction, a pair VIEWER/author that is blocked either way (the viewer-versus-subject pair is gated above), another world, or an author profile that is not ACTIVE is not listed.
 -- DELIBERATELY NO viewer-independent block gate: a block between the author and the reviewed person must NOT remove the comment for third viewers, otherwise either party could censor or re-publish the text for everybody by toggling a block (the author edit/delete path
 -- the owner forbade, through a side door). It still hides the text from the one person who blocked its author, because that person is the VIEWER here. Hiding for everyone is the audited moderation HIDE only.
 -- KNOWN CONSEQUENCE (owner-visible, NOT decided here): the block is symmetric, so when the AUTHOR blocks the reviewed person (or blocked them before writing) that person is the viewer of a blocked pair and no longer sees the comment
 -- about them (nor its agreementId, so they cannot report it from here), is not notified, and every third viewer still sees it; the block costs the author nothing and the only remedy is the audited service-role HIDE. Options: README_D12_CANDIDATE.md.
 -- No write-time refusal exists for any of this (it would reveal a block); the author's profile is the face of the Agreement role in which the review was written. The only place an account id can appear is inside avatarPath, exactly as rpc_get_public_profile returns it.
 select coalesce(jsonb_agg(x.item order by x.created_at desc,x.review_id desc),'[]'::jsonb) into v_items from (
  select c.created_at,c.review_id,
   jsonb_build_object('reviewId',c.review_id,'rating',rv.rating,'comment',c.comment,'createdAt',c.created_at,
    'agreementId',case when v_actor=c.target_account_id then rv.agreement_id else null end,
    'author',jsonb_build_object('profileId',ap.id,'role',ap.kind,'displayName',nullif(btrim(ap.display_name),''),'avatarPath',ap.avatar_path)) as item
  from private.agreement_review_comments_v1 c
  join private.agreement_reviews rv on rv.id=c.review_id
  join public.agreements ag on ag.id=rv.agreement_id
  join public.app_profiles ap on ap.id=case when ag.requester_account_id=c.author_account_id then ag.requester_profile_id else ag.worker_profile_id end
   and ap.account_id=c.author_account_id
  where c.target_account_id=v_profile.account_id and c.hidden_at is null
   and ap.profile_status='ACTIVE' and ap.kind in('REQUESTER','WORKER')
   and not private.closure_account_restricted(c.author_account_id)
   and not private.safety_pair_blocked(v_actor,c.author_account_id)
   and private.accounts_same_world(v_actor,c.author_account_id)
   and (v_after_at is null or (c.created_at,c.review_id)<(v_after_at,v_after_id))
  order by c.created_at desc,c.review_id desc
  limit v_limit+1
 ) x;
 v_more:=jsonb_array_length(v_items)>v_limit;
 if v_more then v_items:=v_items-v_limit; end if;
 return jsonb_build_object('profileId',v_profile.id,'items',v_items,'hasMore',v_more,
  'nextAfter',case when v_more then jsonb_build_object('createdAt',v_items->(v_limit-1)->'createdAt','reviewId',v_items->(v_limit-1)->'reviewId') else null end,
  'authoritative',true);
end;
