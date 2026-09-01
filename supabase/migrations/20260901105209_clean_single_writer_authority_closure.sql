-- USKOCI clean build: remove duplicate authenticated table-writer paths.
-- Canonical command authority for grants and Agreement chat is RPC-only.
-- SELECT stays available under existing RLS projections; mutations fail closed.

revoke all privileges on table public.access_grants from authenticated;
grant select on table public.access_grants to authenticated;

drop policy if exists access_grants_grant on public.access_grants;
drop policy if exists access_grants_revoke on public.access_grants;

revoke all privileges on table public.agreement_messages from authenticated;
grant select on table public.agreement_messages to authenticated;

drop policy if exists agreement_messages_send on public.agreement_messages;

comment on table public.access_grants is
  'Directional contact grants. Authenticated clients may read their RLS-visible rows but mutations are server-authoritative through rpc_set_contact_grant and Agreement lifecycle RPCs.';

comment on table public.agreement_messages is
  'Agreement chat history. Authenticated clients may read participant-visible rows; user message creation is server-authoritative through rpc_send_agreement_message and system lifecycle RPCs.';