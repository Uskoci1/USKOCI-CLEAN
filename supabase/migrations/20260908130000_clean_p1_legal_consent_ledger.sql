-- P1 legal consent ledger: versioned Terms/Privacy publication registry and
-- immutable per-account acceptance evidence. Forward-only, two new tables,
-- two new owner RPCs. Ported from donor rc2_021 onto CLEAN authority
-- (inline auth check, statement_timestamp, private.audit_marketplace,
-- advisory lock against same-key races). Seeds NO legal document: readiness
-- stays fail-closed until authorized operations publish TERMS and PRIVACY.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
begin
  if to_regclass('private.legal_document_versions') is not null
     or to_regclass('public.account_legal_acceptance_events') is not null then
    raise exception 'P1_LEGAL_TABLES_ALREADY_EXIST';
  end if;
  if to_regprocedure('public.rpc_get_legal_bundle()') is not null
     or to_regprocedure('public.rpc_accept_legal_bundle(text)') is not null then
    raise exception 'P1_LEGAL_FUNCTIONS_ALREADY_EXIST';
  end if;
  if to_regclass('public.app_accounts') is null then
    raise exception 'P1_PREDECESSOR_ACCOUNTS_MISSING' using detail='public.app_accounts';
  end if;
  if to_regprocedure('private.audit_marketplace(uuid,text,text,uuid,integer,jsonb)') is null then
    raise exception 'P1_PREDECESSOR_AUDIT_MISSING' using detail='private.audit_marketplace';
  end if;
end
$precondition$;

-- Trusted publication registry. No client role can read, publish or mutate.
-- Rows represent legally published documents, not drafts.
create table private.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_kind text not null,
  version_label text not null,
  content_sha256 text not null,
  public_url text not null,
  published_at timestamptz not null,
  effective_at timestamptz not null,
  retired_at timestamptz null,
  is_active boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  constraint legal_document_kind_chk check (document_kind in ('TERMS','PRIVACY')),
  constraint legal_document_version_label_chk check (char_length(btrim(version_label)) between 1 and 64),
  constraint legal_document_sha256_chk check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint legal_document_public_url_chk check (public_url ~ '^https://[^[:space:]]+$'),
  constraint legal_document_time_order_chk check (effective_at >= published_at),
  constraint legal_document_active_retired_chk check (not is_active or retired_at is null)
);
create unique index legal_document_kind_version_uq
  on private.legal_document_versions(document_kind, version_label);
create unique index legal_document_one_active_kind_uq
  on private.legal_document_versions(document_kind)
  where is_active;
alter table private.legal_document_versions enable row level security;
alter table private.legal_document_versions force row level security;
revoke all on table private.legal_document_versions from public, anon, authenticated;
comment on table private.legal_document_versions is
  'P1 trusted legal publication registry. No client role can read, publish or mutate document versions. Rows represent legally published documents, not drafts.';

-- Immutable acceptance evidence: exact version and content hash of both
-- documents at the moment of acceptance, server timestamp, one row per
-- (account, request id). Direct client access is denied; RPC only.
create table public.account_legal_acceptance_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete restrict,
  request_id text not null,
  terms_document_id uuid not null references private.legal_document_versions(id) on delete restrict,
  terms_version_label text not null,
  terms_content_sha256 text not null,
  privacy_document_id uuid not null references private.legal_document_versions(id) on delete restrict,
  privacy_version_label text not null,
  privacy_content_sha256 text not null,
  acceptance_context text not null default 'ACCOUNT_TERMS_PRIVACY_ACK',
  accepted_at timestamptz not null default statement_timestamp(),
  constraint account_legal_acceptance_request_chk check (char_length(request_id) between 16 and 96 and request_id ~ '^[A-Za-z0-9_-]+$'),
  constraint account_legal_acceptance_terms_sha_chk check (terms_content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint account_legal_acceptance_privacy_sha_chk check (privacy_content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint account_legal_acceptance_context_chk check (acceptance_context='ACCOUNT_TERMS_PRIVACY_ACK'),
  constraint account_legal_acceptance_request_uq unique(account_id, request_id)
);
create index account_legal_acceptance_account_time_idx
  on public.account_legal_acceptance_events(account_id, accepted_at desc);
alter table public.account_legal_acceptance_events enable row level security;
alter table public.account_legal_acceptance_events force row level security;
revoke all on table public.account_legal_acceptance_events from public, anon, authenticated;
comment on table public.account_legal_acceptance_events is
  'P1 immutable acceptance evidence. Stores exact Terms and Privacy version/hash snapshots and the server timestamp; direct client table access is denied.';

-- Public-safe readiness projection. Readable before sign-in so S03 legal links
-- and the acceptance step can render; never exposes drafts or retired rows.
create function public.rpc_get_legal_bundle()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  terms_row private.legal_document_versions%rowtype;
  privacy_row private.legal_document_versions%rowtype;
  u uuid:=auth.uid();
  accepted_current boolean:=false;
begin
  select * into terms_row
  from private.legal_document_versions d
  where d.document_kind='TERMS' and d.is_active
    and d.published_at<=statement_timestamp() and d.effective_at<=statement_timestamp()
    and d.retired_at is null;

  select * into privacy_row
  from private.legal_document_versions d
  where d.document_kind='PRIVACY' and d.is_active
    and d.published_at<=statement_timestamp() and d.effective_at<=statement_timestamp()
    and d.retired_at is null;

  if terms_row.id is null or privacy_row.id is null then
    return jsonb_build_object(
      'ready',false,
      'acceptedCurrentBundle',false,
      'documents','[]'::jsonb,
      'reason','LEGAL_DOCUMENTS_NOT_PUBLISHED'
    );
  end if;

  if u is not null then
    select exists(
      select 1 from public.account_legal_acceptance_events a
      where a.account_id=u
        and a.terms_document_id=terms_row.id
        and a.terms_content_sha256=terms_row.content_sha256
        and a.privacy_document_id=privacy_row.id
        and a.privacy_content_sha256=privacy_row.content_sha256
    ) into accepted_current;
  end if;

  return jsonb_build_object(
    'ready',true,
    'acceptedCurrentBundle',accepted_current,
    'reason',null,
    'documents',jsonb_build_array(
      jsonb_build_object('kind','TERMS','version',terms_row.version_label,'sha256',terms_row.content_sha256,'url',terms_row.public_url,'publishedAt',terms_row.published_at,'effectiveAt',terms_row.effective_at),
      jsonb_build_object('kind','PRIVACY','version',privacy_row.version_label,'sha256',privacy_row.content_sha256,'url',privacy_row.public_url,'publishedAt',privacy_row.published_at,'effectiveAt',privacy_row.effective_at)
    )
  );
end;
$function$;
revoke all on function public.rpc_get_legal_bundle() from public, service_role;
grant execute on function public.rpc_get_legal_bundle() to anon, authenticated;

-- Authenticated acceptance of the exact active bundle. Same request id replays
-- the original receipt; the same id on a different bundle is refused. The
-- advisory lock serializes a same-key race into one row plus one replay.
create function public.rpc_accept_legal_bundle(p_client_request_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid:=auth.uid();
  v_request_id text:=btrim(coalesce(p_client_request_id,''));
  terms_row private.legal_document_versions%rowtype;
  privacy_row private.legal_document_versions%rowtype;
  existing public.account_legal_acceptance_events%rowtype;
  created public.account_legal_acceptance_events%rowtype;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if char_length(v_request_id)<16 or char_length(v_request_id)>96 or v_request_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode='22023';
  end if;

  select * into terms_row
  from private.legal_document_versions d
  where d.document_kind='TERMS' and d.is_active
    and d.published_at<=statement_timestamp() and d.effective_at<=statement_timestamp()
    and d.retired_at is null
  for share;

  select * into privacy_row
  from private.legal_document_versions d
  where d.document_kind='PRIVACY' and d.is_active
    and d.published_at<=statement_timestamp() and d.effective_at<=statement_timestamp()
    and d.retired_at is null
  for share;

  if terms_row.id is null or privacy_row.id is null then
    raise exception 'LEGAL_DOCUMENTS_NOT_PUBLISHED' using errcode='55000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(u::text||E'\n'||v_request_id,4412));

  select * into existing
  from public.account_legal_acceptance_events a
  where a.account_id=u and a.request_id=v_request_id;

  if found then
    if existing.terms_document_id<>terms_row.id
       or existing.terms_content_sha256<>terms_row.content_sha256
       or existing.privacy_document_id<>privacy_row.id
       or existing.privacy_content_sha256<>privacy_row.content_sha256 then
      raise exception 'LEGAL_ACCEPTANCE_REQUEST_REUSED_FOR_DIFFERENT_BUNDLE' using errcode='22023';
    end if;
    return jsonb_build_object(
      'accepted',true,'idempotentReplay',true,'acceptedAt',existing.accepted_at,
      'termsVersion',existing.terms_version_label,'termsSha256',existing.terms_content_sha256,
      'privacyVersion',existing.privacy_version_label,'privacySha256',existing.privacy_content_sha256
    );
  end if;

  insert into public.account_legal_acceptance_events(
    account_id,request_id,
    terms_document_id,terms_version_label,terms_content_sha256,
    privacy_document_id,privacy_version_label,privacy_content_sha256,
    acceptance_context
  ) values (
    u,v_request_id,
    terms_row.id,terms_row.version_label,terms_row.content_sha256,
    privacy_row.id,privacy_row.version_label,privacy_row.content_sha256,
    'ACCOUNT_TERMS_PRIVACY_ACK'
  ) returning * into created;

  perform private.audit_marketplace(
    u,'LEGAL_BUNDLE_ACCEPTED','SYSTEM',created.id,null,
    jsonb_build_object(
      'termsVersion',created.terms_version_label,'termsSha256',created.terms_content_sha256,
      'privacyVersion',created.privacy_version_label,'privacySha256',created.privacy_content_sha256
    )
  );

  return jsonb_build_object(
    'accepted',true,'idempotentReplay',false,'acceptedAt',created.accepted_at,
    'termsVersion',created.terms_version_label,'termsSha256',created.terms_content_sha256,
    'privacyVersion',created.privacy_version_label,'privacySha256',created.privacy_content_sha256
  );
end;
$function$;
revoke all on function public.rpc_accept_legal_bundle(text) from public, anon, service_role;
grant execute on function public.rpc_accept_legal_bundle(text) to authenticated;

comment on function public.rpc_get_legal_bundle() is
  'P1: public-safe readiness of the active TERMS/PRIVACY bundle; fail-closed (ready=false) until both are published; acceptedCurrentBundle only for the signed-in account.';
comment on function public.rpc_accept_legal_bundle(text) is
  'P1: authenticated acceptance of the exact active bundle with immutable version/hash evidence; same request id replays, same id on a different bundle is refused.';

commit;
