-- PKG-024a: the two Dogovor reads name the public profile of each side, as well as its account.
--
-- Status, decisions and evidence: docs/implementation/v5-ai-first/pkg024/PKG024A_AGREEMENT_PROFILE_IDS.md
--
-- What is missing. Both reads of a Dogovor already join public.app_profiles on the agreement's own
-- requester_profile_id / worker_profile_id to take a display name from it, and both return the two
-- ACCOUNT ids. Neither returns the two PROFILE ids. So the client has a name and an account id, and
-- an account id is not something a photograph can be read by:
--
--   src/data/agreementClientService.ts:39-41   myId/otherId := requesterAccountId / workerAccountId
--   src/ui/v2/AgreementPresentation.tsx        the other side is drawn as two letters in a circle
--   src/ui/v2/AgreementCollectionPresentation  the same, in the Dogovori list
--
-- The person you agreed to work with is the only human in the product still shown as initials, and
-- the app cannot fix it: asking the media service for a photograph with an account id is the wrong
-- question, so it must not be asked at all rather than asked and allowed to fail.
--
-- Why this is not new disclosure. `app_profiles.id` is already a public identifier in this product:
-- public.rpc_list_open_tasks_v3 returns 'requesterProfileId' for every open task to every signed-in
-- viewer, and the public Task detail reads that profile through the existing public-profile port.
-- What this adds is the same class of id, to the two people who are already parties to the same
-- Dogovor, who already see each other's display name and — on explicit directed consent — phone
-- number. It is strictly less than a stranger is given about whoever published a task.
--
-- What it deliberately does not do. It adds no name, no contact, no photograph and no new row: the
-- client still reads a photograph through the existing authorized public-profile path, under that
-- path's own rules. It removes nothing: both account ids stay exactly where they are, because
-- agreementClientService decides who "I" am by comparing requesterAccountId with the session user.
--
-- It replaces two function bodies and nothing else. No table, policy, grant, index or trigger
-- changes, and it asserts on itself that the closure source digest is untouched.
--
-- Live predecessors, read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-09-20:
--   public.rpc_get_agreement_workspace(uuid)                                  md5 287afdd70b8c027fba4d50f9e41245cd, 2572 chars
--   public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)         md5 f834365bd8dd43b1eac6c8213624e1dc, 3583 chars
-- Both: security definer, stable, search_path=pg_catalog, execute granted to authenticated and not to anon.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table pkg024a_predecessor(source_digest text not null) on commit drop;

do $pre$
declare
  v_workspace constant text := 'public.rpc_get_agreement_workspace(uuid)';
  v_page constant text := 'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)';
  v_body text;
  v_signature text;
begin
  foreach v_signature in array array[v_workspace, v_page] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'PKG024A_MISSING_FUNCTION: %', v_signature;
    end if;
    select prosrc into strict v_body from pg_proc where oid = v_signature::regprocedure;

    -- The bodies this edits are the reviewed ones and nothing else.
    -- chr(13)||chr(10) rather than an escaped literal: this text travels through a connector to be
    -- applied, and a backslash escape is the one thing that has been mangled in transit before.
    if md5(replace(v_body, chr(13) || chr(10), chr(10))) is distinct from
       (case when v_signature = v_workspace then '287afdd70b8c027fba4d50f9e41245cd'
             else 'f834365bd8dd43b1eac6c8213624e1dc' end) then
      raise exception 'PKG024A_BODY_IS_NOT_THE_REVIEWED_ONE: %', v_signature;
    end if;

    if position('ProfileId' in v_body) > 0 then
      raise exception 'PKG024A_ALREADY_APPLIED: %', v_signature;
    end if;

    -- Each body joins app_profiles on both columns already, so the values are in scope; and each
    -- returns both account ids exactly once, which is what the anchor relies on.
    if (length(v_body) - length(replace(v_body, 'a.requester_profile_id', ''))) <> length('a.requester_profile_id')
       or (length(v_body) - length(replace(v_body, 'a.worker_profile_id', ''))) <> length('a.worker_profile_id')
       or (length(v_body) - length(replace(v_body, 'requesterAccountId', ''))) <> length('requesterAccountId')
       or (length(v_body) - length(replace(v_body, 'workerAccountId', ''))) <> length('workerAccountId') then
      raise exception 'PKG024A_BODY_SHAPE_NOT_AS_REVIEWED: %', v_signature;
    end if;

    -- The security envelope of a definer read is not a detail.
    if (select count(*) from pg_proc p where p.oid = v_signature::regprocedure
         and p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog']::text[]) <> 1 then
      raise exception 'PKG024A_ENVELOPE_NOT_AS_REVIEWED: %', v_signature;
    end if;
    if has_function_privilege('anon', v_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'PKG024A_GRANTS_NOT_EXACT: %', v_signature;
    end if;
  end loop;

  insert into pkg024a_predecessor values (private.closure_source_digest_v5());
end
$pre$;

do $change$
declare
  v_signature text;
  def text;
  anchor constant text := $a$'workerAccountId', a.worker_account_id,$a$;
  -- On the anchor's own line, not a new one: the two bodies are indented differently (six spaces
  -- and eight), and a line inserted with either indent is misaligned in the other.
  addition constant text := $a$ 'requesterProfileId', a.requester_profile_id, 'workerProfileId', a.worker_profile_id,$a$;
begin
  foreach v_signature in array array['public.rpc_get_agreement_workspace(uuid)',
                                     'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'] loop
    def := pg_get_functiondef(v_signature::regprocedure);
    -- One occurrence, or the edit lands somewhere nobody reviewed.
    if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then
      raise exception 'PKG024A_ANCHOR_NOT_UNIQUE: %', v_signature;
    end if;
    execute replace(def, anchor, anchor || addition);
  end loop;
end
$change$;

do $post$
declare
  v_signature text;
  v_body text;
begin
  foreach v_signature in array array['public.rpc_get_agreement_workspace(uuid)',
                                     'public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'] loop
    select prosrc into strict v_body from pg_proc where oid = v_signature::regprocedure;

    -- Exactly the two keys, each once, and both account ids still there: the client decides which
    -- side is "I" by comparing requesterAccountId with the session user, so losing one is silent.
    if (length(v_body) - length(replace(v_body, 'requesterProfileId', ''))) <> length('requesterProfileId')
       or (length(v_body) - length(replace(v_body, 'workerProfileId', ''))) <> length('workerProfileId')
       or (length(v_body) - length(replace(v_body, 'requesterAccountId', ''))) <> length('requesterAccountId')
       or (length(v_body) - length(replace(v_body, 'workerAccountId', ''))) <> length('workerAccountId') then
      raise exception 'PKG024A_BODY_NOT_AS_REVIEWED: %', v_signature;
    end if;

    -- Nothing private rode along with the two ids.
    if position('exact_address' in v_body) > 0 or position('access_notes' in v_body) > 0
       or position('resolved_location' in v_body) > 0 or position('operator_note' in v_body) > 0 then
      raise exception 'PKG024A_PRIVATE_FIELD_LEAKED: %', v_signature;
    end if;

    if (select count(*) from pg_proc p where p.oid = v_signature::regprocedure
         and p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog']::text[]) <> 1 then
      raise exception 'PKG024A_ENVELOPE_CHANGED: %', v_signature;
    end if;
    if has_function_privilege('anon', v_signature, 'EXECUTE')
       or not has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'PKG024A_GRANTS_CHANGED: %', v_signature;
    end if;
  end loop;

  if (select source_digest from pkg024a_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG024A_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;
