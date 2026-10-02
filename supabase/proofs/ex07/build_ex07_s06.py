#!/usr/bin/env python3
"""Generator for the EX-07 candidate "S06" (N06/N07 target identity: the displayed name of a safety target), its exact revert, its read-only DEV preflight and postflight,
and the integrity-guarded forms of the application and of the revert for BOTH connector transports.

WHAT CHANGES (and nothing else):
  * ONE function body: public.rpc_read_safety_target(uuid) (PKG-047a, body md5 4f4e88c2...) is completed IN PLACE by ONE anchored edit (ANCHOR -> REPLACEMENT): the result carries one more key,
    displayName = nullif(btrim(display_name), '') of the profile that was ASKED FOR, the very expression rpc_get_public_profile uses for the same profile. Every case that returned null still
    returns null (unknown or inactive profile, the caller's own account, either side closing or closed, a block in either direction, another visibility world); nothing else in the result changes.
  * ONE comment: the comment on that function says what it now returns.
No table, column, constraint, trigger, policy or ACL changes and no new function; the certified closure digest does not move (asserted by the application, the revert, the proof and the postflight).

THE ONE SOURCE. The predecessor body is kept byte-exact in s06/ex07_s06_dev_body.txt (read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-10-02; its md5 equals the DEV body, 1483 bytes, and the text of the PKG-047a
candidate it was applied from, which this file cross-checks). The NEW body is that text with ONE anchored replacement (the anchor must occur exactly once), so the whole change is reviewable as a diff (`--diff`).
The candidate, the revert, the preflight, the postflight and the guarded forms are generated from it, so the bytes the disposable proof runs are the bytes a DEV application would send.

    python supabase/proofs/ex07/build_ex07_s06.py                     # write the generated files
    python supabase/proofs/ex07/build_ex07_s06.py --check             # fail if a committed file differs BYTE FOR BYTE from the generated one (and the manifest)
    python supabase/proofs/ex07/build_ex07_s06.py --diff              # print the old -> new body diff
    python supabase/proofs/ex07/build_ex07_s06.py --syntax            # parse every generated statement, every DO body and every guard with the PostgreSQL parser (needs `pip install pglast`)
    python supabase/proofs/ex07/build_ex07_s06.py --selftest          # the two guards against a model of what each connector sends (offline, no database)
    python supabase/proofs/ex07/build_ex07_s06.py --wrap IN --wrap-out OUT            # the plain one-statement guard (psql -c / execute_sql): guard + text as ONE text
    python supabase/proofs/ex07/build_ex07_s06.py --wrap-migration IN --wrap-out OUT  # the apply_migration guard (marker based; the connector holds the text twice)

TRANSPORT SAFETY (the D12 findings): the generated SQL is ASCII-only, LF-only, tab-free, carries no unicode escape text and no digit string that could be mistaken for a retried serialization failure; a carriage
return in the text is refused by the statement itself (EX07S06_CRLF_TEXT). The two guards are in front of the text, never inside it, so the candidate keeps its own hash.
"""
import argparse
import difflib
import hashlib
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROOFS = ROOT / 'supabase' / 'proofs' / 'ex07'
S06 = PROOFS / 's06'
CANDIDATE = ROOT / 'supabase' / 'candidates' / 'ex07_safety_target_name.sql'
REVERT = ROOT / 'supabase' / 'candidates' / 'ex07_safety_target_name_revert.sql'
PREFLIGHT = S06 / 'ex07_s06_preflight.readonly.sql'
POSTFLIGHT = S06 / 'ex07_s06_postflight.readonly.sql'
GUARDED_DIR = S06 / 'guarded'
GUARDED_PLAIN_APPLY = GUARDED_DIR / 'ex07_safety_target_name.plain_guard.sql'
GUARDED_PLAIN_REVERT = GUARDED_DIR / 'ex07_safety_target_name_revert.plain_guard.sql'
GUARDED_MIGRATION_APPLY = GUARDED_DIR / 'ex07_safety_target_name.apply_migration_guard.sql'
GUARDED_MIGRATION_REVERT = GUARDED_DIR / 'ex07_safety_target_name_revert.apply_migration_guard.sql'
MANIFEST = S06 / 'ex07_s06_manifest.json'
DEV_BODY_FILE = S06 / 'ex07_s06_dev_body.txt'
PKG047A_SOURCE = ROOT / 'supabase' / 'candidates' / 'pkg047a_safety_target.sql'
GUARD_MAX_BYTES = 125000   # one `psql -c` argument: Linux refuses a single argument above 131072 bytes
LF = chr(10)

TARGET = 'public.rpc_read_safety_target(uuid)'
OLD_MD5 = '4f4e88c2f8bb5840bffe5bd1d97efde5'
OLD_COMMENT_MD5 = 'bc0f16e34e537c4ed98c8ffa52a76570'
OLD_COMMENT = ("PKG-047 resolves a public profile the caller can see into the safety target of the person behind it, plus the caller's own block revision. "
               "Null whenever the public profile itself would be hidden. Never discloses an incoming block and never writes.")
NEW_COMMENT = ("PKG-047 + EX-07 S06 resolves a public profile the caller can see into the safety target of the person behind it, the caller's own block revision "
               "and the displayed name of that same profile (the name rpc_get_public_profile shows for it). "
               "Null whenever the public profile itself would be hidden. Never discloses an incoming block and never writes.")
TARGET_ACL = '{postgres=X/postgres,authenticated=X/postgres}'

# The pins (md5 of prosrc, carriage returns removed) read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-10-02 (first read 08:38 UTC, every pin read again at 09:36 UTC: ledger 221, certificate 0579191d...):
# the target and the neighbours the change leans on.
# The neighbours are the authority whose visibility and name expression the target repeats (rpc_get_public_profile), the three visibility helpers it calls, and the siblings of the safety family that consume
# the target account it returns (the block reader, the report writer) or name the same person (the blocked list, whose REQUESTER-first name rule stays as it is). rpc_set_account_block is NOT pinned:
# it is not called, read or changed here, and B24 part 1 gave it a body on DEV (8700f2ab...) that a chain replayed without B24 does not carry. The application enforces every pin; the revert and the
# postflight only REPORT a changed neighbour (a later package may legitimately change one).
NEIGHBOUR_PINS = [
    ('public.rpc_get_public_profile(uuid)', '9ecc0b69096f1167d02e0bb7b9656bc0'),
    ('public.rpc_get_account_block(uuid)', 'b91745f39246ddd60245e32821364dd8'),
    ('public.rpc_list_my_account_blocks(uuid)', '4af5e379617daa5666073a633ecd79ce'),
    ('public.rpc_submit_safety_report(uuid,uuid,uuid,text,text,text,uuid)', '9249705c01cc3d29d178f1ebd331daeb'),
    ('private.safety_pair_blocked(uuid,uuid)', '698fb21abb0379743bc7ab09d9f946ad'),
    ('private.closure_account_restricted(uuid)', 'f4999250c315e0253374d4611291c7ad'),
    ('private.accounts_same_world(uuid,uuid)', '16f541f952d4e1e2dbb4fc87e594d572'),
]
# The functions whose bodies feed the closure certificate (closure_source_digest_v5 and everything it concatenates): none of them may name the target. Read on DEV 2026-10-02: none does.
CERTIFICATE_FUNCTIONS = ['closure_source_digest_v5', 'closure_erasure_program_digest_v5', 'closure_schema_digest_v5_139', 'closure_erasure_binding_v5',
                         'agreement_invalidation_surface_v1', 'agreement_voice_surface_v1', 'retention_ai_source_ready']
# The read-only DEV capture this file stands on (recorded in the manifest).
DEV_READ = {'database': 'leqcwgzvjsxugfgzdmth', 'at': '2026-10-02T09:36:27Z', 'firstReadAt': '2026-10-02T08:38:17Z', 'ledgerRows': 221, 'lastLedgerVersion': '20261002044950',
            'certifiedDigest': '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431', 'postgres': 'PostgreSQL 17.6', 'functionsInPublicPrivateRlsPrivate': 543,
            'siblingNotPinned': {'public.rpc_set_account_block(uuid,boolean,integer,uuid)': '8700f2abf73d2d9add5e02b32b28c6bc'},
            'note': 'two read-only SELECTs of function bodies, attributes, comments, catalog shapes and the certificate (no table row, no personal data): the bodies at 08:38:17Z, the full re-read of every pin at 09:36:27Z (nothing had moved)'}

# The one anchored edit. The anchor is the whole return statement of the predecessor (two lines); the replacement states why and adds ONE key. The replacement must not contain the anchor (the revert is the exact inverse).
ANCHOR = (" return jsonb_build_object('profileId',v_profile.id,'accountId',v_actor,'targetAccountId',v_profile.account_id,\n"
          "  'blocked',coalesce(v_block.active,false),'revision',coalesce(v_block.revision,0),'authoritative',true);\n")
REPLACEMENT = (" -- EX-07 S06: the displayed name of THE profile that was asked for (the face the caller is looking at, never another face of the same person), written exactly as\n"
               " -- rpc_get_public_profile writes it, so it is given where that profile is visible and nowhere else: every case that returned null above still returns null.\n"
               " return jsonb_build_object('profileId',v_profile.id,'accountId',v_actor,'targetAccountId',v_profile.account_id,\n"
               "  'displayName',nullif(btrim(v_profile.display_name),''),\n"
               "  'blocked',coalesce(v_block.active,false),'revision',coalesce(v_block.revision,0),'authoritative',true);\n")
# pg_get_functiondef of the predecessor on DEV (read 2026-10-02): the statement the application executes is this text with the anchor replaced.
DEF_HEAD = ("CREATE OR REPLACE FUNCTION public.rpc_read_safety_target(p_profile_id uuid)\n RETURNS jsonb\n LANGUAGE plpgsql\n STABLE SECURITY DEFINER\n SET search_path TO 'pg_catalog'\nAS $function$")
DEF_TAIL = "$function$\n"

APPLY_MARKER_HEAD = '-- EX-07 S06 safety target '
APPLY_MARKER_TAIL = 'displayed name: DEV application candidate.'
REVERT_MARKER_TAIL = 'displayed name: DEV revert candidate.'


def md5(text):
    return hashlib.md5(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def read_lf(path):
    return io.open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')


# ------------------------------------------------------------------------------------------------------------------------------ the predecessor and the new body
def old_body():
    body = read_lf(DEV_BODY_FILE)
    assert md5(body) == OLD_MD5 and len(body.encode('utf-8')) == 1483, 'the stored DEV body is not the pinned predecessor: ' + md5(body)
    # provenance: the same bytes as the PKG-047a candidate this function was applied from (a frozen file; a difference is a finding, never a silent change)
    source = read_lf(PKG047A_SOURCE)
    start = source.index('$function$', source.index('create function public.rpc_read_safety_target')) + len('$function$')
    assert source[start:source.index('$function$', start)] == body, 'the stored DEV body differs from the PKG-047a candidate text'
    return body


OLD_BODY = old_body()


def once(text, anchor, label):
    assert text.count(anchor) == 1, 'anchor %s occurs %d times' % (label, text.count(anchor))
    return anchor


def new_body():
    once(OLD_BODY, ANCHOR, 'return statement')
    assert ANCHOR not in REPLACEMENT, 'the replacement must not contain the anchor (the revert is the exact inverse)'
    for text in (ANCHOR, REPLACEMENT, NEW_COMMENT, OLD_COMMENT):
        assert '$' not in text and chr(92) not in text and '\r' not in text and '\t' not in text and all(ord(c) < 128 for c in text), 'a dollar-quoted text must be plain ASCII without dollar signs or backslashes'
    body = OLD_BODY.replace(ANCHOR, REPLACEMENT)
    assert body.replace(REPLACEMENT, ANCHOR) == OLD_BODY, 'the edit is not exactly invertible'
    assert md5(body) != OLD_MD5
    return body


NEW_BODY = new_body()
NEW_MD5 = md5(NEW_BODY)
OLD_DEF = DEF_HEAD + OLD_BODY + DEF_TAIL
NEW_DEF = DEF_HEAD + NEW_BODY + DEF_TAIL
assert OLD_DEF.count(ANCHOR) == 1 and OLD_DEF.replace(ANCHOR, REPLACEMENT) == NEW_DEF, 'the statement the application executes is not the new body in the DEV definition'
NEW_COMMENT_MD5 = md5(NEW_COMMENT)
assert md5(OLD_COMMENT) == OLD_COMMENT_MD5, 'the pinned old comment is not the DEV comment'


# ------------------------------------------------------------------------------------------------------------------------------ shared SQL fragments (kept as text so every file agrees)
def pin_rows(pins, indent='    '):
    return ',\n'.join("%s('%s', '%s')" % ((indent,) + pin) for pin in pins)


def attributes(comment_md5_expr):
    """The test of the target's attributes and comment (SQL text; p is the pg_proc row)."""
    return ("p.prosecdef and p.provolatile = 's' and p.proconfig = array['search_path=pg_catalog'] and p.proowner = 'postgres'::regrole\n"
            "      and p.proacl::text = '" + TARGET_ACL + "' and p.prokind = 'f' and p.prorettype = 'jsonb'::regtype and not p.proretset\n"
            "      and p.prolang = (select oid from pg_language where lanname = 'plpgsql') and md5(obj_description(p.oid, 'pg_proc')) = " + comment_md5_expr)


RELATION_DRIFT = ("(select count(*) from pg_attribute where attrelid = to_regclass('private.account_blocks') and attnum > 0 and not attisdropped\n"
                  "       and ((attname || ':' || format_type(atttypid, atttypmod)) in ('blocker_account_id:uuid', 'blocked_account_id:uuid', 'active:boolean', 'revision:integer'))) <> 4\n"
                  "     or (select count(*) from pg_attribute where attrelid = to_regclass('public.app_profiles') and attnum > 0 and not attisdropped\n"
                  "       and ((attname || ':' || format_type(atttypid, atttypmod)) in ('id:uuid', 'account_id:uuid', 'kind:text', 'display_name:text', 'profile_status:text'))) <> 5")


def certified_target(signature_expr):
    """True when the target is a trigger function or is named by a function the closure digest concatenates (SQL text)."""
    return ("exists(select 1 from pg_trigger where tgfoid = " + signature_expr + ")\n"
            "     or exists(select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname in (" + ', '.join("'%s'" % name for name in CERTIFICATE_FUNCTIONS) + ")\n"
            "       and position('rpc_read_safety_target' in p.prosrc) > 0)")


CERTIFICATE_NOT_READY = ("private.retention_ai_source_ready() is distinct from true\n"
                         "     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)\n"
                         "     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)")
CERTIFICATE_MOVED = ("private.closure_source_digest_v5() is distinct from digest_before\n"
                     "     or (select sha256 from private.closure_source_v5 where singleton) is distinct from digest_before\n"
                     "     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from digest_before\n"
                     "     or private.retention_ai_source_ready() is distinct from true")


def substitute(text, extra=None):
    values = {'@TARGET_SIGNATURE@': TARGET, '@OLD_MD5@': OLD_MD5, '@NEW_MD5@': NEW_MD5, '@OLD_COMMENT_MD5@': OLD_COMMENT_MD5, '@NEW_COMMENT_MD5@': NEW_COMMENT_MD5,
              '@NEIGHBOUR_PINS@': pin_rows(NEIGHBOUR_PINS), '@RELATION_DRIFT@': RELATION_DRIFT, '@CERTIFICATE_NOT_READY@': CERTIFICATE_NOT_READY, '@CERTIFICATE_MOVED@': CERTIFICATE_MOVED,
              '@TARGET_ACL@': TARGET_ACL, '@NEIGHBOUR_COUNT@': str(len(NEIGHBOUR_PINS))}
    values.update(extra or {})
    # the (big) texts last, so that a placeholder-looking text inside one of them is never substituted
    for key, value in values.items():
        text = text.replace(key, value)
    return text


# ------------------------------------------------------------------------------------------------------------------------------ the application
def candidate_text():
    return substitute("""-- EX-07 S06 safety target displayed name: DEV application candidate.
-- NOT APPLIED to DEV: it needs the owner's explicit "PRIMENI EX-07 S06" and nothing else is authorised by it.
-- GENERATED by supabase/proofs/ex07/build_ex07_s06.py: do not edit by hand (`--check` fails on any difference). The file is LF text: a carriage return in it is refused (EX07S06_CRLF_TEXT).
-- Why (gap G11 of EX07_CANONICAL_SCOPE_20261001.md, plan cards N06/N07): the safety screen of a person is opened with an account id only, so it can say that a user is or is not blocked but not WHO the user is.
-- The name must belong to the real target and must never come from a route parameter.
-- What: ONE function body is completed IN PLACE by ONE anchored edit: public.rpc_read_safety_target(uuid) (PKG-047a, body md5 @OLD_MD5@) returns one more key, displayName =
-- nullif(btrim(display_name), '') of the profile that was ASKED FOR, the expression rpc_get_public_profile uses for the same profile. Every case that returned null still returns null (unknown or inactive
-- profile, the caller's own account, either side closing or closed, a block in either direction, another visibility world); nothing else in the result changes. The comment on the function says so.
-- Not changed: the blocked list (rpc_list_my_account_blocks) keeps its own name rule (the REQUESTER profile first), so its name can differ from the face the blocker saw; changing it needs a column and so a
-- certificate re-bind. That is a documented limitation, not part of this change.
-- Function-only: no table, column, trigger, constraint, policy or ACL change, no new function. Certificate-neutral: the function is not one of the 88 signatures of closure_source_digest_v5, is not named by the
-- program, schema, binding, surface or readiness functions that digest concatenates and is not a trigger function; the digest is asserted unchanged (live = certified = erasure source) and ready before and after.
-- One atomic DO statement: exact DEV predecessor pins (the target and @NEIGHBOUR_COUNT@ neighbours), the target's attributes and comment, the shape of the two relations it reads, the anchor occurring exactly once and
-- exact delta accounting (only the target's body changes, nothing is added or removed, the ACL is unchanged). A refusal raises errcode 55000; a deterministic conflict would raise PT409 (none exists here: the function only reads).
do $ex07s06$
declare
  target_signature constant text := '@TARGET_SIGNATURE@';
  old_md5 constant text := '@OLD_MD5@';
  new_md5 constant text := '@NEW_MD5@';
  old_comment_md5 constant text := '@OLD_COMMENT_MD5@';
  new_comment_md5 constant text := '@NEW_COMMENT_MD5@';
  anchor constant text := $anchor$@ANCHOR@$anchor$;
  replacement constant text := $replacement$@REPLACEMENT@$replacement$;
  new_comment constant text := $new_comment$@NEW_COMMENT@$new_comment$;
  pin record; prior record; actual jsonb; digest_before text; target_oid oid; fresh oid[]; def text; expected_body text;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX07S06_OWNER_REQUIRED' using errcode = '55000'; end if;
  -- The bytes this statement carries are the bytes the proof ran: a carriage return (a CRLF checkout, a clipboard) is refused, never silently applied.
  if position(chr(13) in anchor) > 0 or position(chr(13) in replacement) > 0 or position(chr(13) in new_comment) > 0 then
    raise exception 'EX07S06_CRLF_TEXT' using errcode = '55000';
  end if;
  target_oid := to_regprocedure(target_signature)::oid;
  if target_oid is null then raise exception 'EX07S06_TARGET_MISSING' using errcode = '55000'; end if;
  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = target_oid) = new_md5 then
    raise exception 'EX07S06_ALREADY_APPLIED' using errcode = '55000';
  end if;
  -- The predecessor, exactly: the target and the neighbours the change depends on.
  for pin in select * from (values
    ('@TARGET_SIGNATURE@', '@OLD_MD5@'),
@NEIGHBOUR_PINS@
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'EX07S06_PREDECESSOR_DRIFT: %', pin.signature using errcode = '55000';
    end if;
  end loop;
  if not exists(select 1 from pg_proc p where p.oid = target_oid
    and @ATTRIBUTES_OLD@) then
    raise exception 'EX07S06_TARGET_ATTRIBUTE_DRIFT' using errcode = '55000';
  end if;
  -- The two relations the body reads, in the shape the proof ran on (independent of the order of their columns).
  if @RELATION_DRIFT@ then
    raise exception 'EX07S06_RELATION_DRIFT' using errcode = '55000';
  end if;
  -- Certificate-neutral, by the catalog and not by promise: the target is not a trigger function and no function of the closure digest names it.
  if @CERTIFIED_TARGET@ then
    raise exception 'EX07S06_TARGET_IS_CERTIFIED' using errcode = '55000';
  end if;
  if @CERTIFICATE_NOT_READY@ then
    raise exception 'EX07S06_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex07s06_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');

  -- The change: ONE anchored edit of the function's own definition (so every attribute, the owner and the ACL stay as they are), then its comment.
  def := pg_get_functiondef(target_oid);
  if (length(def) - length(replace(def, anchor, ''))) <> length(anchor) then
    raise exception 'EX07S06_ANCHOR_NOT_UNIQUE' using errcode = '55000';
  end if;
  execute replace(def, anchor, replacement);
  execute format('comment on function %s is %L', target_signature, new_comment);

  -- Delta accounting: the certificate did not move, exactly the target's body changed, nothing is new, nothing is gone, nobody gained or lost the right to call it.
  if @CERTIFICATE_MOVED@ then
    raise exception 'EX07S06_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex07s06_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX07S06_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid = target_oid then
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' then
        raise exception 'EX07S06_TARGET_ATTRIBUTE_DELTA: %', prior.signature using errcode = '55000';
      end if;
      expected_body := replace(prior.metadata ->> 'prosrc', anchor, replacement);
      if actual ->> 'prosrc' is distinct from expected_body or md5(replace(prior.metadata ->> 'prosrc', chr(13), '')) is distinct from old_md5
         or md5(replace(actual ->> 'prosrc', chr(13), '')) is distinct from new_md5 then
        raise exception 'EX07S06_TARGET_BODY_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX07S06_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex07s06_functions f where f.oid = p.oid);
  if fresh is distinct from '{}'::oid[] then
    raise exception 'EX07S06_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  if md5(obj_description(target_oid, 'pg_proc')) is distinct from new_comment_md5 then
    raise exception 'EX07S06_COMMENT_MISMATCH' using errcode = '55000';
  end if;
  if has_function_privilege('anon', target_signature, 'EXECUTE') or not has_function_privilege('authenticated', target_signature, 'EXECUTE')
     or has_function_privilege('service_role', target_signature, 'EXECUTE')
     or (select proacl::text from pg_proc where oid = target_oid) is distinct from '@TARGET_ACL@' then
    raise exception 'EX07S06_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
end
$ex07s06$;
""", {'@ATTRIBUTES_OLD@': attributes('old_comment_md5'), '@CERTIFIED_TARGET@': certified_target('target_oid'),
      '@ANCHOR@': ANCHOR, '@REPLACEMENT@': REPLACEMENT, '@NEW_COMMENT@': NEW_COMMENT})


# ------------------------------------------------------------------------------------------------------------------------------ the revert
def revert_text():
    return substitute("""-- EX-07 S06 safety target displayed name: DEV revert candidate.
-- NOT APPLIED. It needs its own explicit "primeni" (the application and its revert are two separate words).
-- GENERATED by supabase/proofs/ex07/build_ex07_s06.py: do not edit by hand (`--check` fails on any difference). The file is LF text: a carriage return in it is refused (EX07S06_REVERT_CRLF_TEXT).
-- The exact inverse of ex07_safety_target_name.sql: it restores the predecessor body of public.rpc_read_safety_target by the inverse of the anchored edit (md5 @OLD_MD5@, the PKG-047a text) and
-- the predecessor comment. It refuses unless the function is exactly what the application produced. No data is touched; the certificate is asserted ready and unchanged; exactly this one function changes.
-- The neighbour functions are NOT conditions of the revert (a later package may legitimately change one): a changed neighbour is only reported with a NOTICE.
do $ex07s06_revert$
declare
  target_signature constant text := '@TARGET_SIGNATURE@';
  old_md5 constant text := '@OLD_MD5@';
  new_md5 constant text := '@NEW_MD5@';
  old_comment_md5 constant text := '@OLD_COMMENT_MD5@';
  new_comment_md5 constant text := '@NEW_COMMENT_MD5@';
  anchor constant text := $anchor$@ANCHOR@$anchor$;
  replacement constant text := $replacement$@REPLACEMENT@$replacement$;
  old_comment constant text := $old_comment$@OLD_COMMENT@$old_comment$;
  pin record; prior record; actual jsonb; digest_before text; target_oid oid; fresh oid[]; def text; expected_body text;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX07S06_REVERT_OWNER_REQUIRED' using errcode = '55000'; end if;
  if position(chr(13) in anchor) > 0 or position(chr(13) in replacement) > 0 or position(chr(13) in old_comment) > 0 then
    raise exception 'EX07S06_REVERT_CRLF_TEXT' using errcode = '55000';
  end if;
  target_oid := to_regprocedure(target_signature)::oid;
  if target_oid is null
     or (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = target_oid) is distinct from new_md5 then
    raise exception 'EX07S06_REVERT_STATE_NOT_THE_APPLIED_ONE' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = target_oid
    and @ATTRIBUTES_NEW@) then
    raise exception 'EX07S06_REVERT_TARGET_ATTRIBUTE_DRIFT' using errcode = '55000';
  end if;
  -- Informational only: a neighbour that is not the pinned DEV predecessor does not stop the revert (the target and the certificate decide).
  for pin in select * from (values
@NEIGHBOUR_PINS@
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise notice 'EX07S06_REVERT_NEIGHBOUR_CHANGED: %', pin.signature;
    end if;
  end loop;
  if @CERTIFICATE_NOT_READY@ then
    raise exception 'EX07S06_REVERT_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex07s06_revert_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');
  def := pg_get_functiondef(target_oid);
  if (length(def) - length(replace(def, replacement, ''))) <> length(replacement) then
    raise exception 'EX07S06_REVERT_ANCHOR_NOT_UNIQUE' using errcode = '55000';
  end if;
  execute replace(def, replacement, anchor);
  execute format('comment on function %s is %L', target_signature, old_comment);
  if @CERTIFICATE_MOVED@ then
    raise exception 'EX07S06_REVERT_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex07s06_revert_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX07S06_REVERT_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid = target_oid then
      expected_body := replace(prior.metadata ->> 'prosrc', replacement, anchor);
      if actual - 'prosrc' is distinct from prior.metadata - 'prosrc' or actual ->> 'prosrc' is distinct from expected_body
         or md5(replace(actual ->> 'prosrc', chr(13), '')) is distinct from old_md5 then
        raise exception 'EX07S06_REVERT_TARGET_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX07S06_REVERT_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex07s06_revert_functions f where f.oid = p.oid);
  if fresh is distinct from '{}'::oid[] then
    raise exception 'EX07S06_REVERT_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = target_oid) is distinct from old_md5
     or md5(obj_description(target_oid, 'pg_proc')) is distinct from old_comment_md5
     or (select proacl::text from pg_proc where oid = target_oid) is distinct from '@TARGET_ACL@' then
    raise exception 'EX07S06_REVERT_POSTCONDITION' using errcode = '55000';
  end if;
end
$ex07s06_revert$;
""", {'@ATTRIBUTES_NEW@': attributes('new_comment_md5'), '@ANCHOR@': ANCHOR, '@REPLACEMENT@': REPLACEMENT, '@OLD_COMMENT@': OLD_COMMENT})


# ------------------------------------------------------------------------------------------------------------------------------ the read-only preflight and postflight
def preflight_text():
    return substitute("""-- EX-07 S06 DEV preflight. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right BEFORE the application (and at any time).
-- GENERATED by supabase/proofs/ex07/build_ex07_s06.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON. "problems": every part of the state the application would REFUSE on (an empty array means the application may run); "informational": reserved (empty).
-- Every read is of a function body, an attribute, a comment or a catalog shape: no row of any table is read and no personal data is returned.
with
  targets(signature, body_md5) as (values
    ('@TARGET_SIGNATURE@', '@OLD_MD5@')
  ),
  neighbours(signature, body_md5) as (values
@NEIGHBOUR_PINS@
  ),
  problems as (
    select 'TARGET_MISSING' as kind, '@TARGET_SIGNATURE@' as detail
    where to_regprocedure('@TARGET_SIGNATURE@') is null
    union all
    select 'ALREADY_APPLIED', t.signature
    from targets t
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(t.signature)) = '@NEW_MD5@'
    union all
    select 'BODY_DRIFT', t.signature
    from targets t
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(t.signature)) is distinct from t.body_md5
      and (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(t.signature)) is distinct from '@NEW_MD5@'
    union all
    select 'NEIGHBOUR_DRIFT', n.signature
    from neighbours n
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(n.signature)) is distinct from n.body_md5
    union all
    select 'TARGET_ATTRIBUTES', t.signature
    from targets t
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure(t.signature)
      and @ATTRIBUTES_OLD@)
    union all
    select 'RELATION_SHAPE', 'private.account_blocks or public.app_profiles is not the shape the change was proved on'
    where @RELATION_DRIFT@
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready, or live, certified and erasure source are not one value'
    where @CERTIFICATE_NOT_READY@
    union all
    select 'CERTIFIED_TARGET', 'the target is a trigger function or is named in a function of the closure digest'
    where @CERTIFIED_TARGET@
  ),
  informational as (
    select 'NONE' as kind, '' as detail where false
  )
select jsonb_build_object(
  'unit', 'EX07_S06_DEV_PREFLIGHT',
  'pinsChecked', (select count(*) from targets) + (select count(*) from neighbours),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'informational', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from informational), '[]'::jsonb),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as preflight;
""", {'@ATTRIBUTES_OLD@': attributes("'" + OLD_COMMENT_MD5 + "'"), '@CERTIFIED_TARGET@': certified_target("to_regprocedure('" + TARGET + "')")})


def postflight_text():
    return substitute("""-- EX-07 S06 DEV postflight. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right after the application (and at any time later).
-- GENERATED by supabase/proofs/ex07/build_ex07_s06.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON. "problems": every part of the applied state that does not hold for the target and the certificate (an empty array means the application is exactly in place).
-- "informational": a neighbour function whose body is no longer the pinned DEV predecessor (kind NEIGHBOUR_CHANGED): never a problem of this application, a later package may change one legitimately.
-- Every read is of a function body, an attribute, a comment or a catalog shape: no row of any table is read and no personal data is returned.
with
  targets(signature, body_md5) as (values
    ('@TARGET_SIGNATURE@', '@NEW_MD5@')
  ),
  neighbours(signature, body_md5) as (values
@NEIGHBOUR_PINS@
  ),
  problems as (
    select 'BODY_DRIFT' as kind, t.signature as detail
    from targets t
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(t.signature)) is distinct from t.body_md5
    union all
    select 'TARGET_ATTRIBUTES', t.signature
    from targets t
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure(t.signature)
      and @ATTRIBUTES_NEW@)
    union all
    select 'AUTHORITY', t.signature
    from targets t
    where has_function_privilege('anon', t.signature, 'EXECUTE') or not has_function_privilege('authenticated', t.signature, 'EXECUTE')
      or has_function_privilege('service_role', t.signature, 'EXECUTE')
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready, or live, certified and erasure source are not one value'
    where @CERTIFICATE_NOT_READY@
    union all
    select 'CERTIFIED_TARGET', 'the target is a trigger function or is named in a function of the closure digest'
    where @CERTIFIED_TARGET@
  ),
  informational as (
    select 'NEIGHBOUR_CHANGED' as kind, n.signature as detail
    from neighbours n
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(n.signature)) is distinct from n.body_md5
  )
select jsonb_build_object(
  'unit', 'EX07_S06_DEV_POSTFLIGHT',
  'pinsChecked', (select count(*) from targets) + (select count(*) from neighbours),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'informational', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from informational), '[]'::jsonb),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as postflight;
""", {'@ATTRIBUTES_NEW@': attributes("'" + NEW_COMMENT_MD5 + "'"), '@CERTIFIED_TARGET@': certified_target("to_regprocedure('" + TARGET + "')")})


# ------------------------------------------------------------------------------------------------------------------------------ the two apply-time integrity guards (the D12 findings)
# PLAIN transport (psql -c, a connector's execute_sql): the guard checks THREE things inside the database, in one DO block that runs before the candidate: the characters of the current query from the start of
# the candidate for the length of its span hash to the sha256 of the span (the start is absolute: anything before the guard shifts it and fails the hash), and whatever FOLLOWS the span is nothing but line feeds
# and `--` comment lines (a connector trailer), so no statement can ride behind the candidate. The tail pattern is the regular expression ^(<LF>|--[^<LF><CR>]*)*$ written with the regular-expression escapes.
GUARD_TAIL_PATTERN = '^(' + chr(92) + 'n|--[^' + chr(92) + 'n' + chr(92) + 'r]*)*$'
PLAIN_TEMPLATE = ("do $ex07s06_guard$ declare rest text:=substr(current_query(),{tail_start}); begin if encode(sha256(convert_to(substr(current_query(),{start},{length}),'UTF8')),'hex')<>'{sha}' or rest !~ '"
                  + GUARD_TAIL_PATTERN + "' then raise exception 'EX07S06_APPLY_TEXT_INTEGRITY' using errcode='55000'; end if; end $ex07s06_guard$;" + LF)


def guarded_span(text):
    """The characters the plain guard hashes: the candidate WITHOUT its trailing line feeds (a connector appends a trailer comment to every statement and a re-typed text usually loses its final line feed)."""
    return text.rstrip(LF)


def plain_guard_text(text):
    if any(ord(c) > 127 for c in text):
        raise SystemExit('a guarded text must be ASCII-only')
    span = guarded_span(text)
    if not span:
        raise SystemExit('a guarded text must not be empty')
    sha = hashlib.sha256(span.encode('utf-8')).hexdigest()
    length = format(len(span), '06d')
    guard = PLAIN_TEMPLATE.format(start='000000', tail_start='000000', length=length, sha=sha)
    start = len(guard) + 1
    tail_start = start + len(span)
    guard = PLAIN_TEMPLATE.format(start=format(start, '06d'), tail_start=format(tail_start, '06d'), length=length, sha=sha)
    if len(guard) != start - 1 or len(span) > 999999 or tail_start > 999999:
        raise SystemExit('the guard position is not stable')
    return guard


def plain_wrap(text):
    wrapped = plain_guard_text(text) + text
    if len(wrapped.encode('utf-8')) > GUARD_MAX_BYTES:
        raise SystemExit('a guarded text of ' + str(len(wrapped)) + ' bytes does not fit one psql -c argument (limit ' + str(GUARD_MAX_BYTES) + ')')
    return wrapped


# APPLY_MIGRATION transport: the connector does not send the text alone. Measured read-only on canonical DEV on 2026-10-02 (a diagnostic migration that raised on purpose, nothing applied; D12):
#   begin;LF LF -- apply sql from post body LF <TEXT> ; LF LF -- track statements in history table LF insert into supabase_migrations.schema_migrations as old (...) values ( ...,
#   array[$TAG$<TEXT>$TAG$], ... ) on conflict (idempotency_key) do update set ... ; LF LF commit;
# so current_query() holds the text TWICE (the executed copy and the history copy that becomes the ledger row) and the first copy starts at position 37. This guard finds its own marker instead of a fixed
# position: it requires EXACTLY two occurrences, hashes the span of BOTH, and requires that the executed copy is followed by nothing but the connector's own history statement.
MIGRATION_TAIL_PATTERN = '\\n?;\\n\\n-- track statements in history table\\ninsert into supabase_migrations\\.schema_migrations as old\\n'
CHUNK = 4000


def migration_guard_text(candidate, marker_head, marker_tail):
    assert candidate.endswith('\n') and not candidate.endswith('\n\n') and '\r' not in candidate, 'the candidate must be LF text with exactly one final line feed'
    assert all(ord(c) < 128 for c in candidate), 'the candidate must be ASCII'
    span = candidate[:-1]
    marker = marker_head + marker_tail
    assert span.startswith(marker) and span.count(marker) == 1, 'the marker must start the text and occur once in it'
    n, h = len(span), hashlib.sha256(span.encode('ascii')).hexdigest()
    guard = (
        "do $ex07s06_guard$ declare q text:=current_query(); mk text:='" + marker_head + "' || '" + marker_tail + "'; n integer:=" + str(n) + "; h text:='" + h + "'; "
        "p1 integer:=strpos(q,mk); p2 integer:=0; p3 integer:=0; h1 text; h2 text; ck text:=''; i integer; begin "
        "if p1>0 then p2:=strpos(substr(q,p1+n),mk); if p2>0 then p2:=p1+n+p2-1; p3:=strpos(substr(q,p2+n),mk); end if; end if; "
        "if p1>0 then h1:=encode(sha256(convert_to(substr(q,p1,n),'UTF8')),'hex'); end if; "
        "if p2>0 then h2:=encode(sha256(convert_to(substr(q,p2,n),'UTF8')),'hex'); end if; "
        "if p1>0 and p2>0 and p3=0 and h1=h and h2=h and substr(q,p1+n) ~ '^" + MIGRATION_TAIL_PATTERN + "' then return; end if; "
        "if p1>0 then for i in 0..(n-1)/" + str(CHUNK) + " loop ck:=ck||left(md5(substr(q,p1+i*" + str(CHUNK) + "," + str(CHUNK) + ")),6)||','; end loop; end if; "
        "raise exception 'EX07S06_APPLY_TEXT_INTEGRITY p1=% p2=% p3=% h1=% h2=% ck=%',p1,p2,p3,h1,h2,ck using errcode='55000'; end $ex07s06_guard$;"
    )
    assert marker not in guard and '\n' not in guard and all(ord(c) < 128 for c in guard)
    return guard + '\n' + candidate, n, h


def connector_wrapper(text, name='dev_alpha_example', tag='lCZXaDtNyWkdAfwHPldC'):
    """A faithful model of what the connector's apply_migration sends (measured 2026-10-02), for the offline self-test and the offline execution tests only."""
    return ('begin;\n\n-- apply sql from post body\n' + text + ';\n\n-- track statements in history table\ninsert into supabase_migrations.schema_migrations as old\n  (version, name, statements, created_by, idempotency_key, rollback)\n'
            "values (\n  to_char(current_timestamp, 'YYYYMMDDHH24MISS'),\n  $" + tag + '$' + name + '$' + tag + '$,\n  array[$' + tag + '$' + text + '$' + tag + '$],\n  $' + tag + '$user$' + tag + '$,\n  null,\n  null\n)\non conflict (idempotency_key) do update set\n  version = EXCLUDED.version;\n\ncommit;')


def migration_guard_accepts(q, marker, span_len, span_hash):
    """The migration guard's predicate in Python (the database runs the SQL form)."""
    p1 = q.find(marker) + 1
    p2 = p3 = 0
    if p1 > 0:
        r = q[p1 + span_len - 1:].find(marker) + 1
        if r > 0:
            p2 = p1 + span_len + r - 1
            p3 = q[p2 + span_len - 1:].find(marker) + 1
    h1 = hashlib.sha256(q[p1 - 1:p1 - 1 + span_len].encode()).hexdigest() if p1 > 0 else None
    h2 = hashlib.sha256(q[p2 - 1:p2 - 1 + span_len].encode()).hexdigest() if p2 > 0 else None
    return bool(p1 > 0 and p2 > 0 and p3 == 0 and h1 == span_hash and h2 == span_hash
                and re.match(MIGRATION_TAIL_PATTERN.replace('\\n', '\n').replace('\\.', '.'), q[p1 - 1 + span_len:]))


def plain_guard_accepts(query, start, length, sha, tail_start):
    """The plain guard's predicate in Python."""
    span = query[start - 1:start - 1 + length]
    rest = query[tail_start - 1:]
    return hashlib.sha256(span.encode()).hexdigest() == sha and re.fullmatch(r'(?:\n|--[^\n\r]*)*', rest) is not None


def selftest():
    for label, text, marker_tail in (('application', candidate_text(), APPLY_MARKER_TAIL), ('revert', revert_text(), REVERT_MARKER_TAIL)):
        marker = APPLY_MARKER_HEAD + marker_tail
        other = APPLY_MARKER_HEAD + (REVERT_MARKER_TAIL if marker_tail == APPLY_MARKER_TAIL else APPLY_MARKER_TAIL)
        assert marker not in (revert_text() if label == 'application' else candidate_text()), 'the two texts must not carry each other\'s marker'
        guarded, n, h = migration_guard_text(text, APPLY_MARKER_HEAD, marker_tail)
        assert migration_guard_accepts(connector_wrapper(guarded), marker, n, h), label + ': the connector wrapper with a trailing LF must pass'
        assert migration_guard_accepts(connector_wrapper(guarded[:-1]), marker, n, h), label + ': the connector wrapper without a trailing LF must pass'
        assert not migration_guard_accepts(connector_wrapper(guarded.replace('lock_timeout', 'lock_timeoyt', 1)), marker, n, h), label + ': one changed byte must be refused'
        assert not migration_guard_accepts(connector_wrapper(guarded + 'select 1;\n'), marker, n, h), label + ': a statement after the candidate must be refused'
        wrapped = connector_wrapper(guarded)
        second = wrapped.rfind(marker)
        assert second > wrapped.find(marker), label + ': the model must hold the text twice'
        assert not migration_guard_accepts(wrapped[:second + 500] + 'X' + wrapped[second + 501:], marker, n, h), label + ': a changed byte inside the history copy (the ledger text) must be refused'
        assert other not in guarded, label + ': the other text\'s marker must not occur'
        plain = plain_wrap(text)
        guard = plain_guard_text(text)
        start, tail_start, length = len(guard) + 1, len(guard) + 1 + len(text.rstrip(LF)), len(text.rstrip(LF))
        sha = hashlib.sha256(text.rstrip(LF).encode()).hexdigest()
        assert plain_guard_accepts(plain, start, length, sha, tail_start), label + ': the plain guard must accept its own text'
        assert plain_guard_accepts(plain.rstrip(LF), start, length, sha, tail_start), label + ': a missing final line feed must pass'
        assert plain_guard_accepts(plain + '\n-- source: POST /mcp\n-- user: x\n', start, length, sha, tail_start), label + ': a connector trailer comment must pass'
        assert not plain_guard_accepts(plain.replace('lock_timeout', 'lock_timeoyt', 1), start, length, sha, tail_start), label + ': one changed byte must be refused'
        assert not plain_guard_accepts(plain + 'select 1;', start, length, sha, tail_start), label + ': a statement after the candidate must be refused'
        assert not plain_guard_accepts(' ' + plain, start, length, sha, tail_start), label + ': a shifted start must be refused'
    print('selftest OK: both guards, both texts, against the models of both connector transports')


# ------------------------------------------------------------------------------------------------------------------------------ outputs
def generated_files():
    """{path: text} of every generated file, in write order."""
    application, revert = candidate_text(), revert_text()
    out = {CANDIDATE: application, REVERT: revert, PREFLIGHT: preflight_text(), POSTFLIGHT: postflight_text()}
    out[GUARDED_PLAIN_APPLY] = plain_wrap(application)
    out[GUARDED_PLAIN_REVERT] = plain_wrap(revert)
    out[GUARDED_MIGRATION_APPLY] = migration_guard_text(application, APPLY_MARKER_HEAD, APPLY_MARKER_TAIL)[0]
    out[GUARDED_MIGRATION_REVERT] = migration_guard_text(revert, APPLY_MARKER_HEAD, REVERT_MARKER_TAIL)[0]
    for path, text in out.items():
        validate(path, text)
    return out


def validate(path, text):
    name = path.name
    assert '\r' not in text, name + ': a generated file must be LF-only'
    assert '\t' not in text, name + ': a generated file must be tab-free'
    assert not re.search(r'@[A-Z][A-Z_]*@', text), name + ': a placeholder was left'
    stray = sorted(hex(ord(c)) for c in set(text) if ord(c) > 127)
    assert not stray, name + ': a non-ASCII character: ' + ', '.join(stray)
    assert not re.search(re.escape(chr(92)) + r'[uU][0-9A-Fa-f]{4}', text), name + ': a backslash-u escape text (a connector resolves it before the database sees it)'
    assert chr(0) not in text, name + ': NUL'
    # a deterministic conflict raises PT409; the digit string of a retried serialization failure must not occur in the text itself (a run of hex digits, an md5 or a sha256, is not text)
    assert '40001' not in re.sub(r'\b[0-9a-f]{32,64}\b', '', text), name + ': the digit string of a retried serialization failure must not occur (a deterministic conflict raises PT409)'
    assert text.endswith('\n') and not text.endswith('\n\n'), name + ': exactly one final line feed'


def manifest_text(outputs):
    files, guarded = {}, {}
    def rel(path):
        return path.relative_to(ROOT).as_posix()
    for path in (CANDIDATE, REVERT, PREFLIGHT, POSTFLIGHT):
        data = outputs[path].encode('utf-8')
        files[rel(path)] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'lines': outputs[path].count(LF)}
    for path, source, marker_tail in ((GUARDED_PLAIN_APPLY, CANDIDATE, None), (GUARDED_PLAIN_REVERT, REVERT, None),
                                      (GUARDED_MIGRATION_APPLY, CANDIDATE, APPLY_MARKER_TAIL), (GUARDED_MIGRATION_REVERT, REVERT, REVERT_MARKER_TAIL)):
        data = outputs[path].encode('utf-8')
        item = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'guards': rel(source)}
        text = outputs[source]
        span = text[:-1] if marker_tail else guarded_span(text)
        item['spanSha256'], item['spanLength'] = hashlib.sha256(span.encode('utf-8')).hexdigest(), len(span)
        item['transport'] = 'apply_migration (marker based, the text is held twice)' if marker_tail else 'plain one statement (psql -c / execute_sql)'
        if marker_tail:
            item['marker'] = APPLY_MARKER_HEAD + marker_tail
        guarded[rel(path)] = item
    document = {
        'unit': 'EX07_S06_MANIFEST', 'generator': rel(Path(__file__).resolve()),
        'note': 'sha256 of the exact bytes of each generated file (LF-only, ASCII-only); a guarded form is guard + file as ONE text; spanSha256/spanLength are what the guard hashes inside the database.',
        'target': TARGET, 'pins': {'oldBodyMd5': OLD_MD5, 'newBodyMd5': NEW_MD5, 'oldCommentMd5': OLD_COMMENT_MD5, 'newCommentMd5': NEW_COMMENT_MD5, 'neighbours': [list(pin) for pin in NEIGHBOUR_PINS]},
        'devRead': DEV_READ, 'files': files, 'guarded': guarded,
        'inputs': {rel(DEV_BODY_FILE): sha256(read_lf(DEV_BODY_FILE)), rel(PKG047A_SOURCE): sha256(read_lf(PKG047A_SOURCE))}}
    return json.dumps(document, indent=2, sort_keys=True) + LF


def flatten_schemas(text):
    """The PL/pgSQL grammar check of libpg_query resolves explicit schemas only for pg_catalog and public: for the syntax check alone every other schema prefix is read as public."""
    return re.sub(r'\b(private|extensions|auth|storage|supabase_migrations|rls_private)\.', 'public.', text)


def syntax_check(outputs):
    try:
        import pglast
        from pglast.parser import parse_plpgsql_json
    except ImportError:
        raise SystemExit('--syntax needs pglast (pip install pglast)')
    def plpgsql(label, body, head='f() returns void'):
        parse_plpgsql_json('create function ' + head + ' language plpgsql as $x$' + flatten_schemas(body) + '$x$')
        print('plpgsql grammar OK: ' + label)
    for path, text in outputs.items():
        statements = pglast.parse_sql(text)
        print('parsed %s: %d statement(s)' % (path.name, len(statements)))
        for match in re.finditer(r'do \$([a-z0-9_]+)\$(.*?)\$\1\$;', text, re.S):
            plpgsql('the DO body "%s" of %s' % (match.group(1), path.name), match.group(2))
    plpgsql('the new function body', NEW_BODY, 'f(p_profile_id uuid) returns jsonb')
    plpgsql('the old function body', OLD_BODY, 'f(p_profile_id uuid) returns jsonb')
    # the guarded forms are exactly one statement longer than the file they guard
    for guarded, source in ((GUARDED_PLAIN_APPLY, CANDIDATE), (GUARDED_PLAIN_REVERT, REVERT), (GUARDED_MIGRATION_APPLY, CANDIDATE), (GUARDED_MIGRATION_REVERT, REVERT)):
        if len(pglast.parse_sql(outputs[guarded])) != len(pglast.parse_sql(outputs[source])) + 1:
            raise SystemExit('the guarded text %s must be exactly one statement longer than %s' % (guarded.name, source.name))
    # the connector's own wrapper around a guarded text parses (begin; ...; insert ...; commit;) and the guard is its first statement after the begin
    for guarded in (GUARDED_MIGRATION_APPLY, GUARDED_MIGRATION_REVERT):
        wrapped = connector_wrapper(outputs[guarded])
        statements = pglast.parse_sql(wrapped)
        print('parsed the connector wrapper of %s: %d statement(s)' % (guarded.name, len(statements)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='fail unless the committed files equal the generated ones BYTE FOR BYTE and the manifest')
    parser.add_argument('--diff', action='store_true', help='print the old -> new body diff')
    parser.add_argument('--syntax', action='store_true', help='also parse everything with the PostgreSQL parser (pglast)')
    parser.add_argument('--selftest', action='store_true', help='the two guards against a model of what each connector sends')
    parser.add_argument('--wrap', help='a text file: write the plain one-statement integrity guard + its text as ONE text to --wrap-out')
    parser.add_argument('--wrap-migration', help='a text file (the application or the revert): write the apply_migration guard + its text as ONE text to --wrap-out')
    parser.add_argument('--wrap-out', help='where --wrap / --wrap-migration write the guarded text')
    arguments = parser.parse_args()
    if arguments.diff:
        for line in difflib.unified_diff(OLD_BODY.splitlines(), NEW_BODY.splitlines(), 'rpc_read_safety_target old (md5 %s)' % OLD_MD5, 'rpc_read_safety_target new (md5 %s)' % NEW_MD5, lineterm=''):
            print(line)
        return 0
    if arguments.selftest:
        selftest()
        return 0
    if arguments.wrap or arguments.wrap_migration:
        if not arguments.wrap_out:
            raise SystemExit('--wrap and --wrap-migration need --wrap-out')
        source = arguments.wrap or arguments.wrap_migration
        raw = Path(source).read_bytes()
        if b'\r' in raw:
            raise SystemExit('a guarded text must be LF-only')
        text = raw.decode('ascii')
        if arguments.wrap:
            wrapped = plain_wrap(text)
        else:
            tail = APPLY_MARKER_TAIL if text.startswith(APPLY_MARKER_HEAD + APPLY_MARKER_TAIL) else REVERT_MARKER_TAIL
            wrapped = migration_guard_text(text, APPLY_MARKER_HEAD, tail)[0]
        Path(arguments.wrap_out).write_bytes(wrapped.encode('ascii'))
        print('written %s (%d chars; candidate sha256 %s)' % (arguments.wrap_out, len(wrapped), hashlib.sha256(raw).hexdigest()))
        return 0
    outputs = generated_files()
    manifest = manifest_text(outputs)
    if arguments.syntax:
        syntax_check(outputs)
    failed = False
    if arguments.check:
        for path, built in outputs.items():
            current = read_lf(path) if path.exists() else None
            if current != built:
                print('DIFFERS', path.relative_to(ROOT).as_posix())
                failed = True
            else:
                print('EQUAL  ', path.relative_to(ROOT).as_posix(), hashlib.sha256(built.encode('utf-8')).hexdigest())
        committed = read_lf(MANIFEST) if MANIFEST.exists() else None
        if committed != manifest:
            print('DIFFERS', MANIFEST.relative_to(ROOT).as_posix())
            failed = True
        else:
            print('EQUAL  ', MANIFEST.relative_to(ROOT).as_posix(), hashlib.sha256(manifest.encode('utf-8')).hexdigest())
    else:
        GUARDED_DIR.mkdir(parents=True, exist_ok=True)
        for path, built in list(outputs.items()) + [(MANIFEST, manifest)]:
            io.open(path, 'w', encoding='utf-8', newline='').write(built)
            print('wrote', path.relative_to(ROOT).as_posix(), len(built.encode('utf-8')), 'bytes', hashlib.sha256(built.encode('utf-8')).hexdigest())
    print('rpc_read_safety_target new body md5', NEW_MD5, 'old', OLD_MD5, '| new comment md5', NEW_COMMENT_MD5, 'old', OLD_COMMENT_MD5)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
