-- P2 data-export request ledger: the authenticated intake and status boundary
-- for an account's access/export request. Ported from donor rc2_023 onto CLEAN
-- authority (inline auth check, statement_timestamp, private.audit_marketplace,
-- per-account advisory lock). A recorded request is NOT a claim that an export
-- artifact exists: artifact generation, secure delivery, the external DSR
-- channel and the operational SLA remain separate owners and proofs.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
begin
  if to_regclass('public.data_export_requests') is not null then
    raise exception 'P2_EXPORT_TABLE_ALREADY_EXISTS';
  end if;
  if to_regprocedure('public.rpc_get_data_export_status()') is not null
     or to_regprocedure('public.rpc_request_data_export(text)') is not null
     or to_regprocedure('public.rpc_cancel_data_export(uuid)') is not null then
    raise exception 'P2_EXPORT_FUNCTIONS_ALREADY_EXIST';
  end if;
  if to_regclass('public.app_accounts') is null then
    raise exception 'P2_PREDECESSOR_ACCOUNTS_MISSING' using detail='public.app_accounts';
  end if;
  if to_regprocedure('private.audit_marketplace(uuid,text,text,uuid,integer,jsonb)') is null then
    raise exception 'P2_PREDECESSOR_AUDIT_MISSING' using detail='private.audit_marketplace';
  end if;
end
$precondition$;

-- Server-owned request ledger. One open request per account; one row per
-- (account, client request id). Direct client access is denied; RPC only.
create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.app_accounts(id) on delete restrict,
  client_request_id text not null,
  request_kind text not null default 'ACCESS_EXPORT',
  request_source text not null default 'IN_APP_AUTHENTICATED',
  status text not null default 'REQUESTED',
  requested_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  cancelled_at timestamptz null,
  completed_at timestamptz null,
  failure_code text null,
  constraint data_export_request_id_chk check (char_length(client_request_id) between 16 and 96 and client_request_id ~ '^[A-Za-z0-9_-]+$'),
  constraint data_export_request_kind_chk check (request_kind='ACCESS_EXPORT'),
  constraint data_export_request_source_chk check (request_source='IN_APP_AUTHENTICATED'),
  constraint data_export_request_status_chk check (status in ('REQUESTED','PROCESSING','READY','FAILED','CANCELLED','EXPIRED')),
  constraint data_export_cancelled_state_chk check ((status='CANCELLED')=(cancelled_at is not null)),
  constraint data_export_completed_state_chk check ((status in ('READY','FAILED','EXPIRED'))=(completed_at is not null)),
  constraint data_export_failure_code_chk check (failure_code is null or char_length(failure_code) between 3 and 64),
  constraint data_export_request_replay_uq unique(account_id,client_request_id)
);
create unique index data_export_one_open_request_uq
  on public.data_export_requests(account_id)
  where status in ('REQUESTED','PROCESSING');
create index data_export_account_requested_idx
  on public.data_export_requests(account_id,requested_at desc);
alter table public.data_export_requests enable row level security;
alter table public.data_export_requests force row level security;
revoke all on table public.data_export_requests from public, anon, authenticated;
comment on table public.data_export_requests is
  'P2 server-owned authenticated data-export intake. REQUESTED is not proof that an export artifact exists; secure generation and delivery are separate owners and proof gates. Direct client access is denied.';

-- Latest request of the signed-in account, projected honestly: no download
-- is available from this boundary and fulfilment is a server act.
create function public.rpc_get_data_export_status()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid:=auth.uid();
  r public.data_export_requests%rowtype;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into r
  from public.data_export_requests d
  where d.account_id=u
  order by d.requested_at desc, d.id desc
  limit 1;

  if r.id is null then
    return jsonb_build_object(
      'hasRequest',false,'request',null,
      'downloadAvailable',false,'serverFulfillmentRequired',true,'externalDsrChannelReady',false
    );
  end if;

  return jsonb_build_object(
    'hasRequest',true,
    'request',jsonb_build_object(
      'receiptId',r.id,'clientRequestId',r.client_request_id,
      'kind',r.request_kind,'source',r.request_source,'status',r.status,
      'requestedAt',r.requested_at,'updatedAt',r.updated_at,
      'cancelledAt',r.cancelled_at,'completedAt',r.completed_at,
      'failureCode',r.failure_code
    ),
    'downloadAvailable',false,'serverFulfillmentRequired',true,'externalDsrChannelReady',false
  );
end;
$function$;
revoke all on function public.rpc_get_data_export_status() from public, anon, service_role;
grant execute on function public.rpc_get_data_export_status() to authenticated;

-- Records one request per client request id; replays the original receipt;
-- refuses a second open request. The per-account advisory lock serializes
-- both the same-key and the different-key race into one open row.
create function public.rpc_request_data_export(p_client_request_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid:=auth.uid();
  v_request_id text:=btrim(coalesce(p_client_request_id,''));
  existing public.data_export_requests%rowtype;
  open_request public.data_export_requests%rowtype;
  created public.data_export_requests%rowtype;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if char_length(v_request_id)<16 or char_length(v_request_id)>96 or v_request_id !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('uskoci:data-export:'||u::text,0));

  select * into existing from public.data_export_requests d
  where d.account_id=u and d.client_request_id=v_request_id;
  if found then
    return jsonb_build_object(
      'receiptId',existing.id,'clientRequestId',existing.client_request_id,
      'status',existing.status,'requestedAt',existing.requested_at,
      'idempotentReplay',true,'downloadAvailable',false,'serverFulfillmentRequired',true
    );
  end if;

  select * into open_request from public.data_export_requests d
  where d.account_id=u and d.status in ('REQUESTED','PROCESSING')
  order by d.requested_at desc limit 1;
  if open_request.id is not null then
    raise exception 'DATA_EXPORT_REQUEST_ALREADY_OPEN' using errcode='55000';
  end if;

  insert into public.data_export_requests(account_id,client_request_id)
  values(u,v_request_id)
  returning * into created;

  perform private.audit_marketplace(u,'DATA_EXPORT_REQUESTED','SYSTEM',created.id,null,
    jsonb_build_object('kind',created.request_kind,'source',created.request_source));

  return jsonb_build_object(
    'receiptId',created.id,'clientRequestId',created.client_request_id,
    'status',created.status,'requestedAt',created.requested_at,
    'idempotentReplay',false,'downloadAvailable',false,'serverFulfillmentRequired',true
  );
end;
$function$;
revoke all on function public.rpc_request_data_export(text) from public, anon, service_role;
grant execute on function public.rpc_request_data_export(text) to authenticated;

-- Owner-only cancellation of a request that is still REQUESTED. A foreign or
-- unknown receipt is NOT_FOUND (no existence leak); CANCELLED replays.
create function public.rpc_cancel_data_export(p_receipt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  u uuid:=auth.uid();
  r public.data_export_requests%rowtype;
begin
  if u is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_receipt_id is null then raise exception 'INVALID_RECEIPT_ID' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('uskoci:data-export:'||u::text,0));

  select * into r from public.data_export_requests d
  where d.id=p_receipt_id and d.account_id=u
  for update;
  if not found then raise exception 'DATA_EXPORT_REQUEST_NOT_FOUND' using errcode='P0002'; end if;

  if r.status='CANCELLED' then
    return jsonb_build_object('receiptId',r.id,'status',r.status,'cancelledAt',r.cancelled_at,'idempotentReplay',true);
  end if;
  if r.status<>'REQUESTED' then
    raise exception 'DATA_EXPORT_REQUEST_NOT_CANCELLABLE' using errcode='55000';
  end if;

  update public.data_export_requests
  set status='CANCELLED',cancelled_at=statement_timestamp(),updated_at=statement_timestamp()
  where id=r.id
  returning * into r;

  perform private.audit_marketplace(u,'DATA_EXPORT_CANCELLED','SYSTEM',r.id,null,'{}'::jsonb);

  return jsonb_build_object('receiptId',r.id,'status',r.status,'cancelledAt',r.cancelled_at,'idempotentReplay',false);
end;
$function$;
revoke all on function public.rpc_cancel_data_export(uuid) from public, anon, service_role;
grant execute on function public.rpc_cancel_data_export(uuid) to authenticated;

comment on function public.rpc_get_data_export_status() is
  'P2: latest data-export request of the signed-in account; downloadAvailable is always false at this boundary and fulfilment is a server act.';
comment on function public.rpc_request_data_export(text) is
  'P2: records one export request per client request id, replays the receipt, refuses a second open request; audits DATA_EXPORT_REQUESTED.';
comment on function public.rpc_cancel_data_export(uuid) is
  'P2: owner-only cancellation of a REQUESTED export request; foreign receipts are NOT_FOUND; audits DATA_EXPORT_CANCELLED.';

commit;
