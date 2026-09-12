-- PRE-V3 P9: immutable bilateral completed-Agreement reviews, one ACCOUNT
-- reputation. Candidate120, NOT LIVE. No public free text or reciprocal status.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create function private.review_tag_catalog() returns text[]
language sql immutable set search_path=pg_catalog
as $f$ select array['AS_AGREED','CAREFUL','CLEAR_COMMUNICATION','ON_TIME','RELIABLE','RESPECTFUL']::text[]; $f$;
create function private.review_tags_valid(tags text[]) returns boolean
language sql immutable set search_path=pg_catalog
as $f$ select tags is not null and coalesce(array_ndims(tags),1)=1
 and cardinality(tags) between 0 and 3 and array_position(tags,null) is null
 and tags <@ private.review_tag_catalog()
 and cardinality(tags)=(select count(distinct t) from unnest(tags) t); $f$;

create table private.agreement_reviews (
 id uuid primary key default gen_random_uuid(),
 agreement_id uuid not null references public.agreements(id) on delete restrict,
 reviewer_account_id uuid not null references public.app_accounts(id) on delete restrict,
 target_account_id uuid not null references public.app_accounts(id) on delete restrict,
 rating integer not null check(rating between 1 and 5),
 tags text[] not null check(private.review_tags_valid(tags)),
 client_request_id uuid not null,
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 unique(agreement_id,reviewer_account_id),
 unique(reviewer_account_id,client_request_id),
 check(reviewer_account_id<>target_account_id)
);
-- Covers the actual account aggregate; the two unique indexes above also
-- cover Agreement/reviewer FK lookups. No role-specific rating cache exists.
create index agreement_reviews_target_rating_idx on private.agreement_reviews(target_account_id) include(rating);
alter table private.agreement_reviews enable row level security;
alter table private.agreement_reviews force row level security;
revoke all on private.agreement_reviews from public,anon,authenticated,service_role;
comment on table private.agreement_reviews is 'Canonical immutable completed-Agreement review. Rating/tags visible only in the reviewer own receipt; public projection is account-level count/average. No text column. Retention execution requires separately approved binding.';

create function private.guard_review_immutable() returns trigger
language plpgsql set search_path=pg_catalog as $f$
begin raise exception 'REVIEW_IMMUTABLE' using errcode='42501'; end;
$f$;
create trigger pre_v3_review_immutable before update or delete on private.agreement_reviews
for each row execute function private.guard_review_immutable();

create function private.review_receipt(r private.agreement_reviews,replayed boolean) returns jsonb
language plpgsql stable set search_path=pg_catalog as $f$
begin
 return jsonb_build_object('reviewId',r.id,'agreementId',r.agreement_id,
 'reviewerAccountId',r.reviewer_account_id,'targetAccountId',r.target_account_id,
 'rating',r.rating,'tags',to_jsonb(r.tags),'createdAt',r.created_at,
 'clientRequestId',r.client_request_id,'idempotentReplay',replayed,'authoritative',true);
end;
$f$;
create function private.account_reputation(account_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 select jsonb_build_object('accountId',account_id,'reviewCount',count(*),
 'averageRating',case when count(*)=0 then null else round(avg(rating),2) end,
 'state',case when count(*)=0 then 'NO_REVIEWS' else 'RATED' end,'authoritative',true)
 from private.agreement_reviews where target_account_id=account_id;
$f$;

create function public.rpc_submit_agreement_review(p_agreement_id uuid,p_target_account_id uuid,
 p_rating jsonb,p_tags jsonb,p_client_request_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews;
 rating_value numeric; tags_value text[]; h text; target_role text;
begin
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
 h:=encode(extensions.digest(jsonb_build_object('agreementId',p_agreement_id,'target',p_target_account_id,
  'rating',rating_value::integer,'tags',to_jsonb(tags_value))::text,'sha256'),'hex');
 -- Same successful command remains an immutable read, even after a later block.
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-command:'||u::text||':'||p_client_request_id::text,9120));
 select * into r from private.agreement_reviews where reviewer_account_id=u and client_request_id=p_client_request_id;
 if found then
  if r.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return private.review_receipt(r,true);
 end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id) for share;
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 if p_target_account_id<>case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end then
  raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501';
 end if;
 if a.status<>'COMPLETED' or not exists(select 1 from public.agreement_execution where agreement_id=a.id and state='COMPLETED') then
  raise exception 'REVIEW_NOT_COMPLETED' using errcode='55000';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:review-agreement:'||a.id::text||':'||u::text,9120));
 if exists(select 1 from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u) then
  raise exception 'REVIEW_ALREADY_SUBMITTED' using errcode='55000';
 end if;
 -- A block cannot remove the counterpart's completed-work review entitlement.
 -- P8 suppresses ordinary deliveries, including this event, for blocked pairs.
 insert into private.agreement_reviews(agreement_id,reviewer_account_id,target_account_id,rating,tags,client_request_id,input_hash)
 values(a.id,u,p_target_account_id,rating_value::integer,tags_value,p_client_request_id,h) returning * into r;
 perform private.audit_marketplace(u,'AGREEMENT_REVIEW_SUBMITTED','AGREEMENT',a.id,a.current_version,jsonb_build_object('reviewId',r.id));
 target_role:=case when u=a.requester_account_id then 'WORKER' else 'REQUESTER' end;
 perform private.emit_event(p_target_account_id,target_role,'REVIEW_RECEIVED','AGREEMENT',a.id,a.current_version,
  'Nova ocena','Dobili ste ocenu za završen Dogovor.','agreement-review:'||r.id::text,'NORMAL','{}'::jsonb,null);
 return private.review_receipt(r,false);
end;
$f$;

create function public.rpc_get_my_agreement_review(p_agreement_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews; own_review jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found then raise exception 'REVIEW_NOT_ALLOWED' using errcode='42501'; end if;
 select * into r from private.agreement_reviews where agreement_id=a.id and reviewer_account_id=u;
 own_review:=case when found then private.review_receipt(r,false) else null end;
 return jsonb_build_object('accountId',u,'agreementId',a.id,
 'targetAccountId',case when u=a.requester_account_id then a.worker_account_id else a.requester_account_id end,
 'eligible',own_review is null and a.status='COMPLETED' and exists(select 1 from public.agreement_execution where agreement_id=a.id and state='COMPLETED'),
 'review',own_review,'tagCatalog',jsonb_build_object('version','PRE_V3_REVIEW_TAGS_V1','maxTags',3,'tags',to_jsonb(private.review_tag_catalog())),
 'authoritative',true);
end;
$f$;
create function public.rpc_get_account_reputation(p_account_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_account_id is null or not exists(select 1 from public.app_accounts where id=p_account_id)
 or (auth.uid()<>p_account_id and private.safety_pair_blocked(auth.uid(),p_account_id)) then
  raise exception 'REPUTATION_NOT_AVAILABLE' using errcode='42501';
 end if;
 return private.account_reputation(p_account_id);
end;
$f$;

-- Wire BOTH existing public role profiles to the same account authority while
-- preserving P8 visibility and all existing public/private field cuts.
do $profile$
declare d text; anchor text:=$a$  v_completed bigint := 0;$a$;
 trust_anchor text:=$a$      'ratingAverage', null,
      'reviewCount', null,$a$;
 availability_anchor text:=$a$      'ratingAvailable', false,
      'reviewsAvailable', false,$a$;
begin
 d:=pg_get_functiondef('public.rpc_get_public_profile(uuid)'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1
 or (length(d)-length(replace(d,trust_anchor,'')))/length(trust_anchor)<>1
 or (length(d)-length(replace(d,availability_anchor,'')))/length(availability_anchor)<>1
 or position('private.safety_pair_blocked' in d)=0 then raise exception 'REVIEW_PUBLIC_PROFILE_ANCHOR_DRIFT'; end if;
 d:=replace(d,anchor,anchor||E'\n  v_reputation jsonb;');
 d:=replace(d,'  return jsonb_build_object(',E'  v_reputation:=private.account_reputation(v_profile.account_id);\n  return jsonb_build_object(');
 d:=replace(d,trust_anchor,$a$      'ratingAverage', v_reputation->'averageRating',
      'reviewCount', v_reputation->'reviewCount',$a$);
 d:=replace(d,availability_anchor,$a$      'ratingAvailable', (v_reputation->>'reviewCount')::bigint>0,
      'reviewsAvailable', true,$a$);
 execute d;
end;
$profile$;

-- Technical inventory only. No period, legal basis or execution policy is seeded.
insert into private.retention_data_classes(code,description,required,active)
values('AGREEMENT_REVIEWS','Immutable bilateral completed-Agreement reviews and their account-level reputation projection (private.agreement_reviews).',true,true);

revoke all on function private.review_tag_catalog(),private.review_tags_valid(text[]),private.guard_review_immutable(),
 private.review_receipt(private.agreement_reviews,boolean),private.account_reputation(uuid) from public,anon,authenticated,service_role;
revoke all on function public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid),public.rpc_get_my_agreement_review(uuid),
 public.rpc_get_account_reputation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid),public.rpc_get_my_agreement_review(uuid),
 public.rpc_get_account_reputation(uuid) to authenticated;
commit;
