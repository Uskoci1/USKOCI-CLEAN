-- RU-2 disposable replay substitute for historical authenticated runtime proof.
-- Fresh inspection of 20260901105922 shows that all test mutations rollback;
-- only these comments survive on production. This proof-only file preserves
-- those durable effects without requiring production business fixtures.

comment on function private.sync_need_completion(uuid) is
  'AUTHENTICATED_RUNTIME_PROVEN: requester completion of a fully-covered Agreement reached parent Need COMPLETED inside rollback-only proof; no proof business rows retained.';

comment on table public.access_grants is
  'AUTHENTICATED_RUNTIME_PROVEN: direct INSERT denied; rpc_set_contact_grant remained executable and fail-closed with PHONE_NOT_SET on an account without a phone. Authenticated reads remain RLS-governed.';

comment on table public.agreement_messages is
  'AUTHENTICATED_RUNTIME_PROVEN: direct INSERT denied; rpc_send_agreement_message succeeded inside rollback-only proof. Participant reads remain RLS-governed.';
