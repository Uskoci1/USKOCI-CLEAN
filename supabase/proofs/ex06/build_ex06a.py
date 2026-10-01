"""Generator for the EX-06 candidate "ex06a" (flexible-window dispatch fix), its exact revert and its read-only DEV postflight.

TWO function bodies change, nothing else (round 2, owner/root decision D2):
  1. private.worker_dispatch_time_admitted(uuid,uuid): the window of a TOMORROW_FLEXIBLE / WEEK_FLEXIBLE task stored WITHOUT a window is derived (WINDOW_BLOCK below);
  2. private.match_detail_without_calendar(uuid,uuid): ONE anchored in-place edit (DETAIL_ANCHOR -> DETAIL_REPLACEMENT) so that the same window-less task counts as FUTURE availability for the
     CURRENT_AVAILABILITY_PAUSED test, exactly as the W02 migration (20260909150000, lines 127-132) does for a stored window. Without it a worker whose live intent is off but who has a real weekly rule
     (the "scheduled-only" worker) would be admitted by the gate and still paused by the matcher, and dispatch_next_wave (which needs match_detail dispatchEligible) would drop him.

THE ONE SOURCE. The predecessor body of private.worker_dispatch_time_admitted is read from the repository (migration 20260909150000_clean_w02_persistent_availability_matching.sql, the only
definition) and pinned by md5 against the value read from canonical DEV on 2026-10-01 (5b5f0dee...). The predecessor body of private.match_detail_without_calendar is the DEV body read on 2026-10-01
(md5 9180606a..., a product of the source147 body, the W02 patch and the PKG-031b patch: no migration holds it whole), kept byte-exact in ex06a_match_detail_without_calendar_dev_body.txt
and pinned by md5. The NEW bodies are those texts with anchored replacements (each anchor must occur exactly once), so the whole change is reviewable as a diff (`--diff`). The candidate, the revert and the
postflight are generated from it, so the bytes the disposable proof runs are the bytes a DEV application would send. `--check` regenerates and fails on any difference with the files in the repository.

    python supabase/proofs/ex06/build_ex06a.py            # write the three files
    python supabase/proofs/ex06/build_ex06a.py --check    # fail if a file differs
    python supabase/proofs/ex06/build_ex06a.py --diff     # print the old -> new body diffs

THE OWNER SEMANTIC (owner words, 2026-10-01; nothing is applied without his exact "PRIMENI"). It lives in WINDOW_BLOCK below and, mirrored, in the proof's oracle (ex06a_lib.mjs derivedWindow):
  * "sutra"       = the corresponding NEXT LOCAL CALENDAR DAY; "ove nedelje" = the REMAINING PART of the corresponding LOCAL WEEK; no invented hour and no narrower time window;
  * anchor        = needs.published_at, as private.relative_schedule_end_v5 (PKG-029b) anchors a relative task, so a later wave never moves "tomorrow". A task WITHOUT published_at is not given a rolling anchor: it keeps the refusal;
  * zone          = needs.task_timezone when it is a valid zone, else Europe/Belgrade (the fallback of relative_schedule_end_v5), NEVER the worker's zone. The worker's weekly rules are read on the worker's own zone;
  * TOMORROW      = [local midnight after the anchor day, the next local midnight): one local calendar day, 23 or 25 hours on a DST change day;
  * WEEK          = [local midnight of the anchor day, local midnight after the Sunday of that local Monday-Sunday week); the existing body then clips the start to now (the remaining part of the week);
  * one stored bound (a task that has exactly one of starts_at / ends_at) is NOT derived: it stays refused (open finding F4, README_EX06A.md).
To change the definition edit WINDOW_BLOCK and re-run; edit derivedWindow in supabase/proofs/ex06/ex06a_lib.mjs the same way (its offline tests then show the old and new definitions apart).
"""
import difflib
import hashlib
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CANDIDATE = ROOT / 'supabase' / 'candidates' / 'ex06a_flexible_window.sql'
REVERT = ROOT / 'supabase' / 'candidates' / 'ex06a_flexible_window_revert.sql'
POSTFLIGHT = ROOT / 'supabase' / 'proofs' / 'ex06' / 'ex06a_postflight.readonly.sql'
OLD_BODY_SOURCE = ROOT / 'supabase' / 'migrations' / '20260909150000_clean_w02_persistent_availability_matching.sql'
DETAIL_BODY_SOURCE = ROOT / 'supabase' / 'proofs' / 'ex06' / 'ex06a_match_detail_without_calendar_dev_body.txt'

TARGET_SIGNATURE = 'private.worker_dispatch_time_admitted(uuid,uuid)'
DETAIL_SIGNATURE = 'private.match_detail_without_calendar(uuid,uuid)'
TARGET_HEAD = ("create or replace function private.worker_dispatch_time_admitted(nid uuid, pid uuid) "
               "returns boolean language plpgsql stable security definer set search_path to 'pg_catalog' as ")
# The DEV predecessor bodies (LF-normalised md5 of prosrc), read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-10-01. The first equals the W02 migration text and stands in the source147 CI surface
# (run 35446129464) and the DEV surface of 2026-09-19; the second is the PKG-031b body (receipt 20260921_pkg031_application.receipt.json bodiesAfterOnDev).
OLD_MD5 = '5b5f0deef20d76ae4e752fe2a7dcc41f'
DETAIL_OLD_MD5 = '9180606a038f3606b0906ab4aefdd0c1'

# Everything the new bodies call or that consumes their answer, pinned by the same convention (read from DEV 2026-10-01; the first five are defined only by the W02 migrations, the next two by the S03
# chain-fidelity pins, then the consumers: dispatch_cheap_candidate_admitted feeds candidate_profile_ids, match_detail_for_calendar_interval and match_detail call the edited matcher, and
# dispatch_next_wave is the one function that turns dispatchEligible into deliveries: the corpus evidence (deliveries, events, rounds) was produced against exactly its body).
# They guard the APPLICATION (the proven bytes were produced on exactly these neighbours); the revert and the postflight only REPORT a change of a neighbour (a later package may legitimately change one).
NEIGHBOUR_PINS = [
    ('private.availability_is_future(text,timestamp with time zone,timestamp with time zone,timestamp with time zone)', '3a1aee763e9fe3d0f06d6ba04ef21aac'),
    ('private.availability_timezone_valid(text)', '013f884ca649cb5246f39eaf9f2e0ec9'),
    ('private.worker_available_periods(uuid,timestamp with time zone,timestamp with time zone,text)', '5107af3020a3beb7bb45e6e90e7a203b'),
    ('private.schedule_fit(uuid,timestamp with time zone,timestamp with time zone,text)', 'e29a7bade1437e3f2067924b5179ddfd'),
    ('private.worker_calendar_conflict(uuid,timestamp with time zone,timestamp with time zone,uuid)', '417c9db16bbe70ed9ad652380790900c'),
    ('private.match_detail(uuid,uuid)', '38c7894a8cf43a8f32bd5a30bc2cbd09'),
    ('private.match_detail_for_calendar_interval(uuid,uuid,timestamp with time zone,timestamp with time zone)', '781956cab666befab216b3ce2334ca1d'),
    ('private.dispatch_cheap_candidate_admitted(uuid,uuid)', '0132fae38c75947179b4d389edc1e1f0'),
    ('private.candidate_profile_ids(uuid,integer)', 'dca4ddc8080a52c8af83c33689c5568e'),
    ('private.dispatch_next_wave(uuid)', '1fd8c51ef026ece24471e2f68250ecc5'),
]
# The functions whose bodies feed the closure certificate (closure_source_digest_v5 and everything it concatenates): none of them may name either target. Read on DEV 2026-10-01: none does.
CERTIFICATE_FUNCTIONS = ['closure_source_digest_v5', 'closure_erasure_program_digest_v5', 'closure_schema_digest_v5_139', 'closure_erasure_binding_v5',
                         'agreement_invalidation_surface_v1', 'agreement_voice_surface_v1', 'retention_ai_source_ready']

ANCHOR_DECLARE_OLD = "declare n public.needs; p public.app_profiles; tz text; at_now timestamptz:=statement_timestamp(); periods tstzmultirange;\n"
ANCHOR_DECLARE_NEW = ("declare n public.needs; p public.app_profiles; tz text; wtz text; at_now timestamptz:=statement_timestamp(); periods tstzmultirange;\n"
                      "  ws timestamptz; we timestamptz; anchor_day date;\n")
ANCHOR_BLOCK_AFTER = "  if not private.availability_timezone_valid(tz) then return false; end if;\n"
ANCHOR_FUTURE_OLD = ("  if private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,at_now) then\n"
                     "    periods:=private.worker_available_periods(pid,greatest(n.starts_at,at_now),n.ends_at,tz);\n"
                     "    if n.schedule_kind='FIXED_WINDOW' then return periods @> tstzrange(n.starts_at,n.ends_at,'[)'); end if;\n")
ANCHOR_FUTURE_NEW = ("  if private.availability_is_future(n.schedule_kind,ws,we,at_now) then\n"
                     "    periods:=private.worker_available_periods(pid,greatest(ws,at_now),we,tz);\n"
                     "    if n.schedule_kind='FIXED_WINDOW' then return periods @> tstzrange(ws,we,'[)'); end if;\n")

# The owner's semantic (see the module docstring). ws / we are what the existing flexible rule below it is applied to; with a stored window (or one endpoint) they are n.starts_at / n.ends_at, i.e. unchanged.
WINDOW_BLOCK = """  -- EX-06 ex06a (S03 finding F1). A TOMORROW_FLEXIBLE or WEEK_FLEXIBLE task stored WITHOUT a window used to be refused for every worker (availability_is_future is false without one).
  -- It is now matched against the window its own words mean, derived in the task's timezone (Europe/Belgrade when the task has none or an invalid one, never the worker's):
  -- sutra = the local calendar day after the publication day; ove nedelje = the publication day to the end of that local Monday-Sunday week (the existing rule below clips the start to now,
  -- so it is the remaining part of the week). The anchor is published_at (as private.relative_schedule_end_v5 does), so a later wave does not move "tomorrow"; a task without published_at
  -- keeps the refusal. The rule that follows is the existing one: some real available time inside the window, never the whole day or week. A stored window (or one endpoint) and every other
  -- schedule kind are exactly as before.
  ws:=n.starts_at; we:=n.ends_at;
  if n.starts_at is null and n.ends_at is null and n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE') then
    if n.published_at is null then return false; end if;
    wtz:=case when n.task_timezone is not null and private.availability_timezone_valid(n.task_timezone) then n.task_timezone else 'Europe/Belgrade' end;
    anchor_day:=(n.published_at at time zone wtz)::date;
    if n.schedule_kind='TOMORROW_FLEXIBLE' then
      ws:=(anchor_day+1)::timestamp at time zone wtz; we:=(anchor_day+2)::timestamp at time zone wtz;
    else
      ws:=anchor_day::timestamp at time zone wtz; we:=(anchor_day+(8-extract(isodow from anchor_day)::integer))::timestamp at time zone wtz;
    end if;
  end if;
"""

# The second function: ONE anchored in-place edit of the DEV body (mirrors the W02 patch of the same line). A window-less TOMORROW/WEEK task that the gate can derive a window for (it has published_at)
# counts as future availability for the paused-intent test; live intent ALONE still invents no availability (the gate decides OUTSIDE_AVAILABILITY by real rules and windows).
DETAIL_ANCHOR = "    and not private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,statement_timestamp())\n"
DETAIL_REPLACEMENT = (
    "    -- EX-06 ex06a: a TOMORROW_FLEXIBLE / WEEK_FLEXIBLE task stored without a window and published is matched against the window private.worker_dispatch_time_admitted derives for it,\n"
    "    -- so it is future availability here too (W02: live intent off but a real weekly schedule is not paused for a future task). Live intent alone is still no availability.\n"
    "    and not (private.availability_is_future(n.schedule_kind,n.starts_at,n.ends_at,statement_timestamp())\n"
    "             or (n.starts_at is null and n.ends_at is null and n.published_at is not null\n"
    "                 and n.schedule_kind in ('TOMORROW_FLEXIBLE','WEEK_FLEXIBLE')))\n")


def md5(text):
    return hashlib.md5(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def read_lf(path):
    return io.open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def old_body():
    text = read_lf(OLD_BODY_SOURCE)
    match = re.search(r'create function private\.worker_dispatch_time_admitted\(nid uuid,pid uuid\)', text)
    assert match, 'the W02 migration no longer defines the target'
    tag = '$function$'
    start = text.index(tag, match.end()) + len(tag)
    body = text[start:text.index(tag, start)]
    assert md5(body) == OLD_MD5, 'the W02 migration text is not the DEV predecessor body: ' + md5(body)
    return body


def detail_old_body():
    body = read_lf(DETAIL_BODY_SOURCE)
    assert md5(body) == DETAIL_OLD_MD5, 'the stored DEV body of match_detail_without_calendar is not the pinned predecessor: ' + md5(body)
    return body


def once(text, anchor, label):
    assert text.count(anchor) == 1, 'anchor %s occurs %d times' % (label, text.count(anchor))
    return anchor


def new_body():
    body = old_body()
    body = body.replace(once(body, ANCHOR_DECLARE_OLD, 'declare'), ANCHOR_DECLARE_NEW)
    body = body.replace(once(body, ANCHOR_BLOCK_AFTER, 'tz-valid'), ANCHOR_BLOCK_AFTER + WINDOW_BLOCK)
    body = body.replace(once(body, ANCHOR_FUTURE_OLD, 'future'), ANCHOR_FUTURE_NEW)
    assert '$' not in WINDOW_BLOCK and '\\' not in body, 'the body must be free of dollar signs and backslashes (it is embedded as a dollar-quoted literal)'
    assert md5(body) != OLD_MD5
    return body


def detail_new_body():
    body = detail_old_body()
    once(body, DETAIL_ANCHOR, 'detail')
    assert DETAIL_REPLACEMENT.count(DETAIL_ANCHOR) == 0, 'the replacement must not contain the anchor (the revert is the exact inverse)'
    assert '$' not in DETAIL_ANCHOR + DETAIL_REPLACEMENT and '\\' not in DETAIL_ANCHOR + DETAIL_REPLACEMENT and '\r' not in DETAIL_ANCHOR + DETAIL_REPLACEMENT
    new = body.replace(DETAIL_ANCHOR, DETAIL_REPLACEMENT)
    assert new.count(DETAIL_REPLACEMENT) == 1 and new.replace(DETAIL_REPLACEMENT, DETAIL_ANCHOR) == body, 'the edit is not exactly invertible'
    assert md5(new) != DETAIL_OLD_MD5
    return new


NEW_BODY = new_body()
NEW_MD5 = md5(NEW_BODY)
DETAIL_NEW_BODY = detail_new_body()
DETAIL_NEW_MD5 = md5(DETAIL_NEW_BODY)


def pin_rows(pins):
    return ',\n'.join("    ('%s','%s')" % pin for pin in pins)


def substitute(text, extra=None):
    values = {'@TARGET_SIGNATURE@': TARGET_SIGNATURE, '@DETAIL_SIGNATURE@': DETAIL_SIGNATURE, '@OLD_MD5@': OLD_MD5, '@DETAIL_OLD_MD5@': DETAIL_OLD_MD5,
              '@DETAIL_NEW_MD5@': DETAIL_NEW_MD5, '@NEW_MD5@': NEW_MD5, '@TARGET_HEAD@': TARGET_HEAD, '@DETAIL_ANCHOR@': DETAIL_ANCHOR,
              '@DETAIL_REPLACEMENT@': DETAIL_REPLACEMENT, '@NEIGHBOUR_PINS@': pin_rows(NEIGHBOUR_PINS),
              '@CERTIFICATE_FUNCTIONS@': ', '.join("'%s'" % name for name in CERTIFICATE_FUNCTIONS)}
    values.update(extra or {})
    # the (big) bodies last, so that a placeholder-looking text inside a body is never substituted
    for key, value in values.items():
        text = text.replace(key, value)
    return text


# One attribute test for a target of a given return type, used by the application, the revert and the postflight (kept as text so the three agree).
ATTRIBUTES = ("p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole\n"
              "      and p.proacl::text = '{postgres=X/postgres}' and p.prokind = 'f' and p.prorettype = %s::regtype and not p.proretset and p.prolang = (select oid from pg_language where lanname = 'plpgsql')\n"
              "      and obj_description(p.oid, 'pg_proc') is null")


def candidate_text():
    return substitute("""-- EX-06 ex06a (flexible-window dispatch fix, S03 finding F1): TWO function bodies completed IN PLACE. NOT APPLIED to DEV: it needs the owner's explicit "primeni".
-- GENERATED by supabase/proofs/ex06/build_ex06a.py: do not edit by hand (`--check` fails on any difference). The file is LF text (.gitattributes): a carriage return in it is refused (EX06A_CRLF_TEXT).
-- Why: a task of schedule_kind TOMORROW_FLEXIBLE or WEEK_FLEXIBLE that is stored WITHOUT a window (the product stores it that way: live DEV 3 of 3, 41 of 41 dispatch rounds empty) is refused for every
-- worker before the worker's availability is read (availability_is_future is false without a window). It now gets a matching window derived from the kind in the task's timezone (the owner's words:
-- "sutra" = the next local calendar day, "ove nedelje" = the remaining part of the local Monday-Sunday week, no invented hour; Europe/Belgrade when the task has no valid zone); the existing flexible rule applies unchanged.
--   1. private.worker_dispatch_time_admitted(uuid,uuid): the derived window (the body is replaced, same signature, owner, ACL, SECURITY DEFINER, STABLE, search_path).
--   2. private.match_detail_without_calendar(uuid,uuid): ONE anchored in-place edit, so that the same task also counts as future availability for the CURRENT_AVAILABILITY_PAUSED test (as W02 does for a
--      stored window); a worker whose live intent is off but who has a real weekly schedule is then admitted by the gate AND the matcher, while live intent alone still invents no availability.
-- Function-only: no table, column, trigger, constraint, policy, ACL or data change; no new function.
-- Certificate-neutral: neither function is in the closure digest list (closure_source_digest_v5, 88 signatures), in the program digest or in any function the digest concatenates, neither is a trigger
-- function; the digest is asserted unchanged and ready before and after.
-- One atomic DO statement: exact DEV predecessor pins (both targets and ten neighbours the change depends on, private.dispatch_next_wave included; the unchanged helpers of the second body, lower_arr, identity_admitted, effective_radius_km and haversine_km, are not pinned), certificate ready and unchanged, exact roster (exactly these two functions change). A conflict, were one
-- raised, would use PT409 (none is).
do $ex06a$
declare
  target_signature constant text := '@TARGET_SIGNATURE@';
  detail_signature constant text := '@DETAIL_SIGNATURE@';
  old_md5 constant text := '@OLD_MD5@';
  detail_old_md5 constant text := '@DETAIL_OLD_MD5@';
  detail_new_md5 constant text := '@DETAIL_NEW_MD5@';
  new_body constant text := $new_body$@NEW_BODY@$new_body$;
  detail_anchor constant text := $detail_anchor$@DETAIL_ANCHOR@$detail_anchor$;
  detail_replacement constant text := $detail_replacement$@DETAIL_REPLACEMENT@$detail_replacement$;
  pin record; tgt record; prior record; actual jsonb; digest_before text; target_oid oid; detail_oid oid; fresh oid[]; def text; expected_detail text;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX06A_OWNER_REQUIRED' using errcode = '55000'; end if;
  -- The bytes this statement carries are the bytes the proof ran: a carriage return (a CRLF checkout, a clipboard) is refused, never silently applied.
  if position(E'\\r' in new_body) > 0 or position(E'\\r' in detail_anchor) > 0 or position(E'\\r' in detail_replacement) > 0 then
    raise exception 'EX06A_CRLF_TEXT' using errcode = '55000';
  end if;
  target_oid := to_regprocedure(target_signature)::oid;
  detail_oid := to_regprocedure(detail_signature)::oid;
  if target_oid is null or detail_oid is null then raise exception 'EX06A_TARGET_MISSING' using errcode = '55000'; end if;
  if (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = target_oid) = md5(replace(new_body, E'\\r', ''))
     and (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = detail_oid) = detail_new_md5 then
    raise exception 'EX06A_ALREADY_APPLIED' using errcode = '55000';
  end if;
  -- The predecessor, exactly: both targets and the neighbours the change depends on (not the unchanged helpers of the second body).
  for pin in select * from (values
    ('@TARGET_SIGNATURE@', '@OLD_MD5@'),
    ('@DETAIL_SIGNATURE@', '@DETAIL_OLD_MD5@'),
@NEIGHBOUR_PINS@
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'EX06A_PREDECESSOR_DRIFT: %', pin.signature using errcode = '55000';
    end if;
  end loop;
  for tgt in select * from (values (target_oid, 'boolean'), (detail_oid, 'jsonb')) v(proc_oid, rettype) loop
    if not exists(select 1 from pg_proc p where p.oid = tgt.proc_oid
      and @ATTRIBUTES_PLACEHOLDER@) then
      raise exception 'EX06A_TARGET_ATTRIBUTE_DRIFT: %', tgt.proc_oid::regprocedure using errcode = '55000';
    end if;
  end loop;
  if (select count(*) from pg_attribute where attrelid = 'public.needs'::regclass and not attisdropped
        and attname in ('schedule_kind', 'starts_at', 'ends_at', 'published_at', 'task_timezone')) <> 5 then
    raise exception 'EX06A_NEEDS_COLUMNS_DRIFT' using errcode = '55000';
  end if;
  -- Certificate-neutral, by the catalog and not by promise: neither target is a trigger function and no function of the closure digest names either.
  if exists(select 1 from pg_trigger where tgfoid in (target_oid, detail_oid))
     or exists(select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname in (@CERTIFICATE_FUNCTIONS@)
       and (position('worker_dispatch_time_admitted' in p.prosrc) > 0 or position('match_detail_without_calendar' in p.prosrc) > 0)) then
    raise exception 'EX06A_TARGET_IS_CERTIFIED' using errcode = '55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06A_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex06a_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');

  -- Change 1: the body of the first target, in place (same signature, owner, ACL).
  execute format($c$@TARGET_HEAD@%L$c$, new_body);
  -- Change 2: ONE anchored edit of the second target, taken from its own definition (so every attribute stays as it is).
  def := pg_get_functiondef(detail_oid);
  if (length(def) - length(replace(def, detail_anchor, ''))) <> length(detail_anchor) then
    raise exception 'EX06A_DETAIL_ANCHOR_NOT_UNIQUE' using errcode = '55000';
  end if;
  execute replace(def, detail_anchor, detail_replacement);

  -- Delta accounting: the certificate did not move, exactly the two targets changed, nothing is new, nothing is gone.
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06A_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex06a_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX06A_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid = target_oid then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' then
        raise exception 'EX06A_TARGET_ATTRIBUTE_DELTA: %', prior.signature using errcode = '55000';
      end if;
      if actual ->> 'prosrc' is distinct from new_body or md5(replace(prior.metadata ->> 'prosrc', E'\\r', '')) is distinct from old_md5 then
        raise exception 'EX06A_TARGET_BODY_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif prior.oid = detail_oid then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' then
        raise exception 'EX06A_TARGET_ATTRIBUTE_DELTA: %', prior.signature using errcode = '55000';
      end if;
      expected_detail := replace(prior.metadata ->> 'prosrc', detail_anchor, detail_replacement);
      if actual ->> 'prosrc' is distinct from expected_detail or md5(replace(prior.metadata ->> 'prosrc', E'\\r', '')) is distinct from detail_old_md5
         or md5(replace(actual ->> 'prosrc', E'\\r', '')) is distinct from detail_new_md5 then
        raise exception 'EX06A_TARGET_BODY_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX06A_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex06a_functions f where f.oid = p.oid);
  if fresh is distinct from '{}'::oid[] then
    raise exception 'EX06A_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  if has_function_privilege('anon', target_signature, 'EXECUTE') or has_function_privilege('authenticated', target_signature, 'EXECUTE')
     or has_function_privilege('service_role', target_signature, 'EXECUTE')
     or has_function_privilege('anon', detail_signature, 'EXECUTE') or has_function_privilege('authenticated', detail_signature, 'EXECUTE')
     or has_function_privilege('service_role', detail_signature, 'EXECUTE') then
    raise exception 'EX06A_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
end
$ex06a$;
""", {'@ATTRIBUTES_PLACEHOLDER@': ATTRIBUTES % 'tgt.rettype', '@NEW_BODY@': NEW_BODY})


def revert_text():
    return substitute("""-- EX-06 ex06a revert: the exact inverse of ex06a_flexible_window.sql. NOT APPLIED. It needs its own explicit "primeni".
-- GENERATED by supabase/proofs/ex06/build_ex06a.py: do not edit by hand (`--check` fails on any difference). The file is LF text (.gitattributes): a carriage return in it is refused (EX06A_REVERT_CRLF_TEXT).
-- It restores the DEV predecessor body of private.worker_dispatch_time_admitted byte for byte (md5 @OLD_MD5@, the W02 migration text) and the DEV predecessor body of
-- private.match_detail_without_calendar by the exact inverse of the anchored edit (md5 @DETAIL_OLD_MD5@). It refuses unless both functions are exactly what the application produced. No data is touched;
-- the certificate is asserted ready and unchanged; exactly these two functions change. The neighbour functions are NOT conditions of the revert (a later package may legitimately change one): a changed
-- neighbour is only reported with a NOTICE.
do $ex06a_revert$
declare
  target_signature constant text := '@TARGET_SIGNATURE@';
  detail_signature constant text := '@DETAIL_SIGNATURE@';
  old_md5 constant text := '@OLD_MD5@';
  detail_old_md5 constant text := '@DETAIL_OLD_MD5@';
  detail_new_md5 constant text := '@DETAIL_NEW_MD5@';
  new_body constant text := $new_body$@NEW_BODY@$new_body$;
  old_body constant text := $old_body$@OLD_BODY@$old_body$;
  detail_anchor constant text := $detail_anchor$@DETAIL_ANCHOR@$detail_anchor$;
  detail_replacement constant text := $detail_replacement$@DETAIL_REPLACEMENT@$detail_replacement$;
  pin record; tgt record; prior record; actual jsonb; digest_before text; target_oid oid; detail_oid oid; fresh oid[]; def text; expected_detail text;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX06A_REVERT_OWNER_REQUIRED' using errcode = '55000'; end if;
  if position(E'\\r' in new_body) > 0 or position(E'\\r' in old_body) > 0 or position(E'\\r' in detail_anchor) > 0 or position(E'\\r' in detail_replacement) > 0 then
    raise exception 'EX06A_REVERT_CRLF_TEXT' using errcode = '55000';
  end if;
  target_oid := to_regprocedure(target_signature)::oid;
  detail_oid := to_regprocedure(detail_signature)::oid;
  if target_oid is null or detail_oid is null
     or (select prosrc from pg_proc where oid = target_oid) is distinct from new_body
     or (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = detail_oid) is distinct from detail_new_md5 then
    raise exception 'EX06A_REVERT_STATE_NOT_THE_APPLIED_ONE' using errcode = '55000';
  end if;
  for tgt in select * from (values (target_oid, 'boolean'), (detail_oid, 'jsonb')) v(proc_oid, rettype) loop
    if not exists(select 1 from pg_proc p where p.oid = tgt.proc_oid
      and @ATTRIBUTES_PLACEHOLDER@) then
      raise exception 'EX06A_REVERT_TARGET_ATTRIBUTE_DRIFT: %', tgt.proc_oid::regprocedure using errcode = '55000';
    end if;
  end loop;
  -- Informational only: a neighbour that is not the pinned DEV predecessor does not stop the revert (the two targets and the certificate decide).
  for pin in select * from (values
@NEIGHBOUR_PINS@
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise notice 'EX06A_REVERT_NEIGHBOUR_CHANGED: %', pin.signature;
    end if;
  end loop;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06A_REVERT_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex06a_revert_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');
  execute format($c$@TARGET_HEAD@%L$c$, old_body);
  def := pg_get_functiondef(detail_oid);
  if (length(def) - length(replace(def, detail_replacement, ''))) <> length(detail_replacement) then
    raise exception 'EX06A_REVERT_DETAIL_ANCHOR_NOT_UNIQUE' using errcode = '55000';
  end if;
  execute replace(def, detail_replacement, detail_anchor);
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06A_REVERT_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex06a_revert_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX06A_REVERT_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid = target_oid then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' or actual ->> 'prosrc' is distinct from old_body then
        raise exception 'EX06A_REVERT_TARGET_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif prior.oid = detail_oid then
      expected_detail := replace(prior.metadata ->> 'prosrc', detail_replacement, detail_anchor);
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' or actual ->> 'prosrc' is distinct from expected_detail
         or md5(replace(actual ->> 'prosrc', E'\\r', '')) is distinct from detail_old_md5 then
        raise exception 'EX06A_REVERT_TARGET_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX06A_REVERT_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex06a_revert_functions f where f.oid = p.oid);
  if fresh is distinct from '{}'::oid[] then
    raise exception 'EX06A_REVERT_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  if (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = target_oid) is distinct from old_md5
     or (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = detail_oid) is distinct from detail_old_md5 then
    raise exception 'EX06A_REVERT_POSTCONDITION' using errcode = '55000';
  end if;
end
$ex06a_revert$;
""", {'@ATTRIBUTES_PLACEHOLDER@': ATTRIBUTES % 'tgt.rettype', '@NEW_BODY@': NEW_BODY, '@OLD_BODY@': old_body()})


def postflight_text():
    return substitute("""-- EX-06 ex06a DEV postflight. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right after the application (and at any time later).
-- GENERATED by supabase/proofs/ex06/build_ex06a.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON. "problems": every part of the applied state that does not hold for the TWO targets and the certificate (an empty array means the application is exactly in place).
-- "informational": a neighbour function whose body is no longer the pinned DEV predecessor (kind NEIGHBOUR_CHANGED): never a problem of this application, a later package may change one legitimately.
with
  targets(signature, body_md5, rettype) as (values
    ('@TARGET_SIGNATURE@','@NEW_MD5@','boolean'),
    ('@DETAIL_SIGNATURE@','@DETAIL_NEW_MD5@','jsonb')
  ),
  neighbours(signature, body_md5) as (values
@NEIGHBOUR_PINS@
  ),
  problems as (
    select 'BODY_DRIFT' as kind, t.signature as detail
    from targets t
    where (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = to_regprocedure(t.signature)) is distinct from t.body_md5
    union all
    select 'TARGET_ATTRIBUTES', t.signature
    from targets t
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure(t.signature)
      and @ATTRIBUTES_POSTFLIGHT@)
    union all
    select 'AUTHORITY', t.signature
    from targets t
    where has_function_privilege('anon', t.signature, 'EXECUTE') or has_function_privilege('authenticated', t.signature, 'EXECUTE')
      or has_function_privilege('service_role', t.signature, 'EXECUTE')
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready and bound'
    where private.retention_ai_source_ready() is distinct from true
      or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
    union all
    select 'CERTIFIED_TARGET', 'a target is a trigger function or named in a function of the closure digest'
    where exists(select 1 from pg_trigger where tgfoid in (to_regprocedure('@TARGET_SIGNATURE@'), to_regprocedure('@DETAIL_SIGNATURE@')))
      or exists(select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname in (@CERTIFICATE_FUNCTIONS@)
        and (position('worker_dispatch_time_admitted' in p.prosrc) > 0 or position('match_detail_without_calendar' in p.prosrc) > 0))
  ),
  informational as (
    select 'NEIGHBOUR_CHANGED' as kind, n.signature as detail
    from neighbours n
    where (select md5(replace(prosrc, E'\\r', '')) from pg_proc where oid = to_regprocedure(n.signature)) is distinct from n.body_md5
  )
select jsonb_build_object(
  'unit', 'EX06A_FLEXIBLE_WINDOW_DEV_POSTFLIGHT',
  'pinsChecked', (select count(*) from targets) + (select count(*) from neighbours),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'informational', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from informational), '[]'::jsonb),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as postflight;
""", {'@ATTRIBUTES_POSTFLIGHT@': (ATTRIBUTES % 't.rettype')})


FILES = [(CANDIDATE, candidate_text), (REVERT, revert_text), (POSTFLIGHT, postflight_text)]


def main(argv):
    if '--diff' in argv:
        for old, new, label, o_md5, n_md5 in ((old_body(), NEW_BODY, 'private.worker_dispatch_time_admitted', OLD_MD5, NEW_MD5),
                                              (detail_old_body(), DETAIL_NEW_BODY, 'private.match_detail_without_calendar', DETAIL_OLD_MD5, DETAIL_NEW_MD5)):
            for line in difflib.unified_diff(old.splitlines(), new.splitlines(), '%s old (md5 %s)' % (label, o_md5), '%s new (md5 %s)' % (label, n_md5), lineterm=''):
                print(line)
        return 0
    check = '--check' in argv
    failed = False
    for path, make in FILES:
        text = make()
        assert '\r' not in text and not re.search(r'@[A-Z][A-Z_]*@', text), 'a placeholder was left in ' + path.name
        if check:
            current = read_lf(path) if path.exists() else None
            if current != text:
                print('DIFFERS', path.relative_to(ROOT).as_posix())
                failed = True
            else:
                print('EQUAL  ', path.relative_to(ROOT).as_posix(), hashlib.sha256(text.encode('utf-8')).hexdigest())
        else:
            io.open(path, 'w', encoding='utf-8', newline='').write(text)
            print('wrote', path.relative_to(ROOT).as_posix(), len(text.encode('utf-8')), 'bytes', hashlib.sha256(text.encode('utf-8')).hexdigest())
    print('worker_dispatch_time_admitted new body md5', NEW_MD5, 'old', OLD_MD5)
    print('match_detail_without_calendar new body md5', DETAIL_NEW_MD5, 'old', DETAIL_OLD_MD5)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
