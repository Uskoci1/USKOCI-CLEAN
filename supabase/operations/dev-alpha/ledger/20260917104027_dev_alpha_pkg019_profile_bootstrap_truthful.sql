-- PKG-019: the account bootstrap must not assert facts the user never stated.
-- Candidate reviewed at supabase/candidates/pkg019_profile_bootstrap_truthful.sql
-- Preconditions fail closed against the exact live definition read at preflight.

DO $pre$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_uskoci_auth_user_created';

  IF def IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: handle_uskoci_auth_user_created is absent';
  END IF;
  IF md5(def) <> 'f4a758af24314b204978eef26fa13929' THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: the live definition changed since preflight (md5 %)', md5(def);
  END IF;
END
$pre$;

CREATE OR REPLACE FUNCTION public.handle_uskoci_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- No email fallback. An email local part is frequently a real name or a handle the
  -- person never chose to publish, and this value is shown to other users.
  profile_name text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'USKOČI korisnik');
  -- No invented city. Empty is honest and the app can ask; a guessed city is a false
  -- fact that feeds discovery and matching.
  profile_city text := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'city'), ''), '');
  profile_phone text := COALESCE(NULLIF(trim(NEW.phone), ''), NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), '');
  initial_mode text := CASE WHEN NEW.raw_user_meta_data->>'mode' = 'worker' THEN 'worker' ELSE 'requester' END;
  initial_skills text[] := public.metadata_text_array(NEW.raw_user_meta_data->'skills');
BEGIN
  INSERT INTO public.app_accounts(id,email,full_name,city,phone,active_mode,onboarding_complete)
  VALUES(NEW.id,COALESCE(NEW.email,''),profile_name,profile_city,profile_phone,initial_mode,false)
  ON CONFLICT(id) DO UPDATE SET
    email=EXCLUDED.email,
    full_name=CASE WHEN public.app_accounts.full_name='' THEN EXCLUDED.full_name ELSE public.app_accounts.full_name END,
    city=CASE WHEN public.app_accounts.city='' THEN EXCLUDED.city ELSE public.app_accounts.city END,
    phone=CASE WHEN public.app_accounts.phone='' THEN EXCLUDED.phone ELSE public.app_accounts.phone END;

  -- The profile copy is written in the user's own voice, so it must not assume their
  -- gender. These read identically for everyone.
  INSERT INTO public.app_profiles(account_id,kind,display_name,city,headline,bio,radius_km,available_now)
  VALUES(NEW.id,'REQUESTER',profile_name,profile_city,'Tražim pouzdanu pomoć uz jasan dogovor.','Nov nalog u USKOČI zajednici.',10,false)
  ON CONFLICT(account_id,kind) DO NOTHING;

  INSERT INTO public.app_profiles(account_id,kind,display_name,city,headline,bio,skills,radius_km,available_now)
  VALUES(NEW.id,'WORKER',profile_name,profile_city,'Uskačem kada se dogovor jasno postavi.','Za poslove koji odgovaraju profilu i kalendaru.',initial_skills,15,false)
  ON CONFLICT(account_id,kind) DO NOTHING;
  RETURN NEW;
END;
$$;

DO $post$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'handle_uskoci_auth_user_created';

  IF position('split_part' IN def) > 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: the display name is still derived from the email';
  END IF;
  IF position('Novi Sad' IN def) > 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: the city is still invented';
  END IF;
  IF position('Spreman da' IN def) > 0 OR position('Dostupan za' IN def) > 0 OR position('Novi član' IN def) > 0 THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: masculine-only profile copy survived';
  END IF;
  IF def !~ 'SECURITY DEFINER' OR def !~ 'search_path' THEN
    RAISE EXCEPTION 'POSTCONDITION_FAILED: the security envelope of the trigger changed';
  END IF;
END
$post$;