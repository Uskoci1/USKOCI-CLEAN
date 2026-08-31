-- Migration 45: P5 Security & Authority Reconciliation

-- 1. Needs RLS Subquery Fix (BLOCKER)
DROP POLICY IF EXISTS ""Participants can view needs"" ON public.needs;
CREATE POLICY ""Participants can view needs""
  ON public.needs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_responses r 
      WHERE r.need_id = needs.id AND r.worker_profile_id = auth.uid()
    )
    OR
    requester_profile_id = auth.uid()
  );

-- 2. Public-Safe Profiles (HIGH)
CREATE OR REPLACE FUNCTION rpc_get_public_profile(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  avatar_url text,
  kind text
)
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS 
BEGIN
  RETURN QUERY
  SELECT a.id, a.display_name, a.avatar_url, a.kind::text
  FROM public.app_profiles a
  WHERE a.id = p_profile_id;
END;
;
GRANT EXECUTE ON FUNCTION rpc_get_public_profile(uuid) TO authenticated;

-- 3. Worker Profile Authority & UI Fix (HIGH)
CREATE OR REPLACE FUNCTION rpc_complete_worker_profile()
RETURNS void
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS 
DECLARE
  v_profile_id uuid := auth.uid();
  v_name text;
  v_city text;
BEGIN
  SELECT display_name, city INTO v_name, v_city
  FROM public.app_profiles
  WHERE id = v_profile_id AND kind = 'WORKER';

  IF v_name IS NULL OR v_city IS NULL OR trim(v_name) = '' OR trim(v_city) = '' THEN
    RAISE EXCEPTION 'Cannot complete profile: display_name and city must be set first.';
  END IF;

  PERFORM set_config('uskoci.profile_mutation', 'server_authorized', true);
  UPDATE public.app_profiles 
  SET profile_status = 'ACTIVE' 
  WHERE id = v_profile_id AND kind = 'WORKER';
END;
;
GRANT EXECUTE ON FUNCTION rpc_complete_worker_profile() TO authenticated;

-- Fix guard_profile_write so it allows DRAFT on insert
CREATE OR REPLACE FUNCTION private.guard_profile_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS 
DECLARE
  token text := current_setting('uskoci.profile_mutation', true);
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.profile_status IS NULL THEN
      new.profile_status := 'ACTIVE';
    END IF;
    new.account_type   := 'INDIVIDUAL';
    new.rating_requester := null;
    new.rating_worker    := null;
    RETURN new;
  END IF;

  IF token IS NULL THEN
    IF new.profile_status IS DISTINCT FROM old.profile_status THEN
      RAISE EXCEPTION USING errcode='42501', message='PROFILE_STATUS_IS_SERVER_DERIVED';
    END IF;
    IF new.account_type IS DISTINCT FROM old.account_type THEN
      RAISE EXCEPTION USING errcode='42501', message='ACCOUNT_TYPE_IS_SERVER_DERIVED';
    END IF;
    IF new.rating_requester IS DISTINCT FROM old.rating_requester THEN
      RAISE EXCEPTION USING errcode='42501', message='RATING_REQUESTER_IS_SERVER_DERIVED';
    END IF;
    IF new.rating_worker IS DISTINCT FROM old.rating_worker THEN
      RAISE EXCEPTION USING errcode='42501', message='RATING_WORKER_IS_SERVER_DERIVED';
    END IF;
  END IF;
  RETURN new;
END;
;

-- 4. Notification Ledger (MEDIUM)
CREATE OR REPLACE FUNCTION private.guard_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS 
BEGIN
  IF new.id IS DISTINCT FROM old.id OR
     new.account_id IS DISTINCT FROM old.account_id OR
     new.event_type IS DISTINCT FROM old.event_type OR
     new.reference_id IS DISTINCT FROM old.reference_id OR
     new.content::text IS DISTINCT FROM old.content::text OR
     new.created_at IS DISTINCT FROM old.created_at THEN
    RAISE EXCEPTION 'Only read_at can be updated';
  END IF;
  RETURN new;
END;
;

DROP TRIGGER IF EXISTS guard_notification_update_trg ON public.notification_deliveries;
CREATE TRIGGER guard_notification_update_trg
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_notification_update();

-- 5. Access Grants Guard (MEDIUM)
CREATE OR REPLACE FUNCTION private.guard_access_grant_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS 
BEGIN
  IF new.agreement_id IS DISTINCT FROM old.agreement_id OR
     new.grantee_account_id IS DISTINCT FROM old.grantee_account_id OR
     new.channel IS DISTINCT FROM old.channel THEN
    RAISE EXCEPTION 'Access grant identity is immutable';
  END IF;
  RETURN new;
END;
;

DROP TRIGGER IF EXISTS guard_access_grant_update_trg ON public.access_grants;
CREATE TRIGGER guard_access_grant_update_trg
  BEFORE UPDATE ON public.access_grants
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_access_grant_update();

-- 6. AI Provenance (AI Facts)
DROP POLICY IF EXISTS ""Fact owners can delete"" ON public.ai_structured_facts;