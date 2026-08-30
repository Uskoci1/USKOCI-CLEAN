-- ==============================================================================
-- CLOSURE: AI DIRECT INSERT AUTHORITY
-- Prevents clients from directly inserting AI facts and proposals.
-- The Edge Function (via RPC / service_role) retains full authority.
-- ==============================================================================

-- Revoke INSERT permission from authenticated users.
-- The RLS policy "ai_facts_own" and "ai_proposals_own" are "FOR ALL",
-- but without the GRANT, the table-level permission blocks direct inserts.
-- Updates and Deletes are still governed by RLS, but the previous package
-- secured the UPDATE boundary (preventing spoofing of values/status).
-- (Note: DELETE is safe because Cascade handles legitimate deletions, and a user
--  deleting their own fact doesn't escalate privileges, just loses data.)

revoke insert on public.ai_structured_facts from authenticated;
revoke insert on public.ai_action_proposals from authenticated;
