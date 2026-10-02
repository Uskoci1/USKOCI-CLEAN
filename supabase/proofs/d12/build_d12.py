#!/usr/bin/env python3
"""Generator for the D12 (written comment with the star rating) server candidate, its exact revert and its read-only DEV preflight and postflight.

ONE source of truth: the six new function bodies and the four templates live under supabase/proofs/d12/sql/, the read-only DEV captures live beside them
(d12_pins.json = md5 and metadata of every function the change touches or leans on; d12_preimage.json = the seven current DEV definitions that are rewritten or re-bound), and THIS file
holds everything that must agree between them: the text rules, the exact-once anchor edits, the new object shapes, the pin tables and the expected md5 of every rewritten body.
The candidate, the revert, the preflight and the postflight are generated from them, so the exact bytes that a disposable proof runs are the bytes that a DEV application would send.

    python supabase/proofs/d12/build_d12.py             # write the four files and the manifest
    python supabase/proofs/d12/build_d12.py --check     # fail if a committed file differs BYTE FOR BYTE (a carriage return is a difference) from the generated one or from the manifest
    python supabase/proofs/d12/build_d12.py --syntax    # also parse every generated statement and function body with the PostgreSQL parser (needs `pip install pglast`)
    python supabase/proofs/d12/build_d12.py --revert-digest HEX --revert-out PATH   # the chain variant of the revert (a disposable chain never reproduces the DEV digest)
    python supabase/proofs/d12/build_d12.py --wrap IN --wrap-out OUT                # the integrity guard + the text of IN as ONE text (the Voice B1 method: a DO block that hashes substr(current_query(), ...) of the text without its trailing line feeds)

Nothing here reads or writes a database. The captures were read once, read-only, from canonical DEV; every claim that a body equals a pin is re-asserted below at generation time.

TRANSPORT SAFETY (blocker found by the round-1 review). A connector deploy (execute_sql / apply_migration) RESOLVES the text of a unicode escape (a backslash, u and four hex digits) before the statement reaches Postgres, which would silently change every
stored text and every md5 pin. So the generated SQL never carries such an escape and never carries a non-ASCII byte: every character class is BUILT from chr(<decimal code point>) pieces, and render() refuses any output that holds an escape,
a non-ASCII character, a carriage return or a tab. The same guard is a static unit test over the committed files (d12_lib.test.mjs).
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
D12 = ROOT / 'supabase' / 'proofs' / 'd12'
SQL = D12 / 'sql'
PINS_JSON = D12 / 'd12_pins.json'
PREIMAGE_JSON = D12 / 'd12_preimage.json'
OUT_APPLICATION = ROOT / 'supabase' / 'candidates' / 'd12_review_comment.sql'
OUT_REVERT = ROOT / 'supabase' / 'candidates' / 'd12_review_comment_revert.sql'
OUT_PREFLIGHT = D12 / 'd12_preflight.readonly.sql'
OUT_POSTFLIGHT = D12 / 'd12_postflight.readonly.sql'
OUT_MANIFEST = D12 / 'd12_manifest.json'
GUARD_MAX_BYTES = 125000   # a guarded text is sent as ONE `psql -c` argument: Linux refuses a single argument above 131072 bytes
REVIEWS_MIGRATION = ROOT / 'supabase' / 'migrations' / '20260912100000_clean_pre_v3_reviews_authority.sql'
CRLF, LF = chr(13) + chr(10), chr(10)

# The certified closure digest of canonical DEV immediately before D12 (read-only 2026-10-01: certified source = live digest = erasure source = erasure binding = readiness literal).
DEV_PRE_DIGEST = '58447d7730e909a0c0e60dd92ef77416af927471bd6f645988448e32c6e3cb46'
# The export projection sha of that DEV state (data_export_projection_sha_v5(), read-only 2026-10-01) and the readiness-body fingerprint with its one certified literal masked (the Voice B1 value).
DEV_PRE_PROJECTION_SHA = '70009062e365b92295eba138a63868e84fd712ee270d9e6ea24237507e5eecfa'
READINESS_PLACEHOLDER_MD5 = 'bc85a1a744869abb6441e647b18b2195'
STAR_COLUMNS = ('id:uuid:true::,agreement_id:uuid:true::,reviewer_account_id:uuid:true::,target_account_id:uuid:true::,rating:integer:true::,tags:text[]:true::,'
                'client_request_id:uuid:true::,input_hash:text:true::,created_at:timestamp with time zone:true::')
STAR_CONSTRAINTS_MD5 = 'fe44059a7fa96aeb732ff3459f6865d1'
ROSTER_BEFORE, ROSTER_AFTER = 75, 76
# The retention class AGREEMENT_REVIEWS (private.retention_data_classes, read-only DEV 2026-10-01; required and active, no trigger on the table, not hashed by any certified function). Its description names the star table only: once free text
# lives in the class a reader of the catalog must learn it. The new text states ONLY what this package implements and invents NO period. No apostrophe and no non-ASCII character (the text is quoted into SQL).
RETENTION_CLASS_CODE = 'AGREEMENT_REVIEWS'
RETENTION_DESCRIPTION_OLD = 'Immutable bilateral completed-Agreement reviews and their account-level reputation projection (private.agreement_reviews).'
RETENTION_DESCRIPTION_NEW = ('Immutable bilateral completed-Agreement reviews and their account-level reputation projection (private.agreement_reviews), plus the optional written comment of a review '
                             '(private.agreement_review_comments_v1): free text of the author, erased when the author account is closed; this description sets no retention period.')
STAR_TABLE = 'private.agreement_reviews'

TABLE = 'agreement_review_comments_v1'
TARGET_INDEX = TABLE + '_target_idx'
AUTHOR_INDEX = TABLE + '_author_idx'
CLOSURE_TRIGGER = 'agreement_review_comment_closure_guard_v1'
MUTATION_TRIGGER = 'agreement_review_comment_mutation_guard_v1'

# The text rules, once. Owner decisions 2026-10-01 + the design defaults (D12_WRITTEN_REVIEW_DESIGN_20261001.md section 4): 500 code points, 2000 octets, no control character except LF,
# no bidi, zero-width or invisible filler character (the zero-width JOINER U+200D, the non-joiner U+200C and the variation selectors U+FE00..U+FE0F stay allowed: emoji sequences must work).
# THE CLOSED, EXPLICIT CLASSES (a product-neutral safety rule, not an owner decision; round-1 finding "invisible and compatibility characters", round-2 finding "default-ignorable code points"):
#   FORBIDDEN  = C0 controls except LF, DEL and C1 controls, U+2028..U+2029, EVERY Default_Ignorable_Code_Point of Unicode 17.0 (DEFAULT_IGNORABLE_RANGES below) EXCEPT the four groups that stay allowed inside a sentence
#                (ALLOWED_INSIDE_RANGES: soft hyphen, combining grapheme joiner, ZWNJ/ZWJ, the variation selectors U+FE00..U+FE0F), plus the two format-control blocks that render as nothing but are not default-ignorable by definition
#                (the interlinear annotation characters U+FFF9..U+FFFB and the Egyptian hieroglyph format controls U+13430..U+1343F). That is: ZWSP, the directional marks/embeddings/isolates, the word joiner and the invisible operators
#                (the whole block U+2060..U+206F, including the reserved U+2065), the Hangul/Khmer/Mongolian fillers and free variation selectors, U+3164, U+FFA0, the BOM, the reserved U+FFF0..U+FFF8, the shorthand format letters
#                U+1BCA0..U+1BCA3, the musical format characters U+1D173..U+1D17A and the whole plane-14 block U+E0000..U+E0FFF (the TAG characters, the ideographic variation selectors U+E0100..U+E01EF and the reserved rest; this also
#                refuses the three subdivision-flag emoji sequences and every ideographic variation sequence, a stated and accepted consequence). A comment that contains one of them anywhere is REVIEW_COMMENT_INVALID.
#                A generation-time check proves the closure (every default-ignorable code point is forbidden or allowed inside) and a unit test re-reads the property in Node (\p{Default_Ignorable_Code_Point}) so that a later Unicode
#                version that adds one turns the offline test red. Code points that merely MAY render as nothing in some fonts (private use, noncharacters, unassigned) are NOT covered: a documented residual.
#   BLANK      = an EXPLICIT class (never the locale dependent POSIX [[:space:]], which also matches U+001C..U+001F in en_US.UTF-8 and not in a C locale): ASCII white space U+0009..U+000D and U+0020, U+0085, the Unicode separators
#                U+00A0, U+1680, U+2000..U+200A, U+2028..U+2029, U+202F, U+205F, U+3000, AND the characters that render as nothing but are tolerated inside a sentence (U+00AD soft hyphen, U+034F combining grapheme joiner, U+2800 braille
#                blank), the joiners and ALL sixteen variation selectors: a comment made of these ONLY means "no comment" (nothing is stored). U+001C..U+001F are NOT blank: such a lone control is INVALID in every locale.
#   The contact floor runs on the text as sent AND on an NFKC-normalised copy from which the invisible characters (STRIP) are removed and in which the Arabic-Indic and Extended Arabic-Indic digits are mapped to ASCII; the STORED text is always
#   the original. Anything beyond this closed list (other digit systems such as Devanagari, combining marks between digits, homoglyphs, spelled-out numbers, bare domains, handles without @) is a documented residual of a deterministic floor.
# EVERY class is BUILT from chr(<decimal code point>) pieces: the generated SQL never carries the invisible character itself and never carries a backslash-u escape text (a connector would resolve it: see the module docstring).
UNICODE_VERSION_OF_RECORD = '17.0'   # read with the ES2018 property escape in Node 24.18 (ICU 78.3); the list below equals it exactly (unit test), and a Node with an older Unicode must find only a subset of it
DEFAULT_IGNORABLE_RANGES = [(0x00AD, 0x00AD), (0x034F, 0x034F), (0x061C, 0x061C), (0x115F, 0x1160), (0x17B4, 0x17B5), (0x180B, 0x180F), (0x200B, 0x200F), (0x202A, 0x202E), (0x2060, 0x206F), (0x3164, 0x3164),
                            (0xFE00, 0xFE0F), (0xFEFF, 0xFEFF), (0xFFA0, 0xFFA0), (0xFFF0, 0xFFF8), (0x1BCA0, 0x1BCA3), (0x1D173, 0x1D17A), (0xE0000, 0xE0FFF)]
ALLOWED_INSIDE_RANGES = [(0x00AD, 0x00AD), (0x034F, 0x034F), (0x200C, 0x200D), (0xFE00, 0xFE0F)]
# what FORBIDDEN holds beyond the default-ignorable set: the controls, the line and paragraph separators, the annotation characters and the hieroglyph format controls (all documented above)
FORBIDDEN_BEYOND_DEFAULT_IGNORABLE = [(0x0001, 0x0009), (0x000B, 0x001F), (0x007F, 0x009F), (0x2028, 0x2029), (0xFFF9, 0xFFFB), (0x13430, 0x1343F)]
FORBIDDEN_RANGES = [(0x0001, 0x0009), (0x000B, 0x001F), (0x007F, 0x009F), (0x061C, 0x061C), (0x115F, 0x1160), (0x17B4, 0x17B5), (0x180B, 0x180F), (0x200B, 0x200B), (0x200E, 0x200F), (0x2028, 0x202E),
                    (0x2060, 0x206F), (0x3164, 0x3164), (0xFEFF, 0xFEFF), (0xFFA0, 0xFFA0), (0xFFF0, 0xFFFB), (0x13430, 0x1343F), (0x1BCA0, 0x1BCA3), (0x1D173, 0x1D17A), (0xE0000, 0xE0FFF)]
BLANK_RANGES = [(0x0009, 0x000D), (0x0020, 0x0020), (0x0085, 0x0085), (0x00A0, 0x00A0), (0x00AD, 0x00AD), (0x034F, 0x034F), (0x1680, 0x1680), (0x2000, 0x200A), (0x200C, 0x200D), (0x2028, 0x2029), (0x202F, 0x202F),
                (0x205F, 0x205F), (0x2800, 0x2800), (0x3000, 0x3000), (0xFE00, 0xFE0F)]
STRIP_RANGES = [(0x00AD, 0x00AD), (0x034F, 0x034F), (0x200C, 0x200D), (0x2800, 0x2800), (0xFE00, 0xFE0F)]
DIGIT_SETS = [(0x0660, 0x0669), (0x06F0, 0x06F9)]
# no member of a class may be a bracket-expression metacharacter ( ] [ ^ - and the backslash ), and no code point may be a surrogate or NUL
_BRACKET_META = {ord(c) for c in ']^-[' + chr(92)}


def _check_ranges(name, ranges):
    previous = -1
    for lo, hi in ranges:
        if not (1 <= lo <= hi <= 0x10FFFF) or 0xD800 <= lo <= 0xDFFF or 0xD800 <= hi <= 0xDFFF:
            raise SystemExit(name + ': an invalid range ' + hex(lo) + '-' + hex(hi))
        if any(lo <= meta <= hi for meta in _BRACKET_META):
            raise SystemExit(name + ': a range holds a bracket-expression metacharacter')
    for lo, hi in sorted(ranges):
        if lo <= previous:
            raise SystemExit(name + ': overlapping ranges at ' + hex(lo))
        previous = hi


for _name, _ranges in (('FORBIDDEN_RANGES', FORBIDDEN_RANGES), ('BLANK_RANGES', BLANK_RANGES), ('STRIP_RANGES', STRIP_RANGES), ('DEFAULT_IGNORABLE_RANGES', DEFAULT_IGNORABLE_RANGES),
                       ('ALLOWED_INSIDE_RANGES', ALLOWED_INSIDE_RANGES), ('FORBIDDEN_BEYOND_DEFAULT_IGNORABLE', FORBIDDEN_BEYOND_DEFAULT_IGNORABLE)):
    _check_ranges(_name, _ranges)


def _expand(ranges):
    return {cp for lo, hi in ranges for cp in range(lo, hi + 1)}


# the explicit blank and forbidden classes overlap on purpose in the white-space controls (tab, VT, FF, CR), U+0085 and U+2028..U+2029 only (blank is tested first: such a comment is "absent", the same text with a letter is invalid); nothing else may overlap
_overlap = sorted(_expand(FORBIDDEN_RANGES) & _expand(BLANK_RANGES))
if _overlap != [0x0009, 0x000B, 0x000C, 0x000D, 0x0085, 0x2028, 0x2029]:
    raise SystemExit('the forbidden and blank classes must overlap in U+0009, U+000B..U+000D, U+0085, U+2028 and U+2029 only: ' + str([hex(c) for c in _overlap]))
# THE CLOSURE (round-2 finding): every Default_Ignorable_Code_Point is either FORBIDDEN or one of the four ALLOWED-inside groups, never both; FORBIDDEN is exactly (default-ignorable minus allowed-inside) plus the documented extras; the allowed-inside
# groups are all blank-alone and stripped for the contact floor; the stripped characters are exactly the allowed-inside ones plus the braille blank.
_di, _allowed, _forbidden = _expand(DEFAULT_IGNORABLE_RANGES), _expand(ALLOWED_INSIDE_RANGES), _expand(FORBIDDEN_RANGES)
if not _allowed <= _di or _allowed & _forbidden:
    raise SystemExit('the allowed-inside groups must be default-ignorable and not forbidden')
if _forbidden != (_di - _allowed) | _expand(FORBIDDEN_BEYOND_DEFAULT_IGNORABLE):
    raise SystemExit('the forbidden class is not (default-ignorable minus allowed-inside) plus the documented extras: ' + str(sorted(hex(c) for c in _forbidden ^ ((_di - _allowed) | _expand(FORBIDDEN_BEYOND_DEFAULT_IGNORABLE)))[:12]))
if _expand(FORBIDDEN_BEYOND_DEFAULT_IGNORABLE) & _di:
    raise SystemExit('an "extra" forbidden code point is default-ignorable: move it out of FORBIDDEN_BEYOND_DEFAULT_IGNORABLE')
if not _allowed <= _expand(BLANK_RANGES) or _expand(STRIP_RANGES) != _allowed | {0x2800}:
    raise SystemExit('the allowed-inside groups must be blank-alone, and the stripped characters are exactly those plus the braille blank')


def chr_piece(code_point):
    return 'chr(' + str(code_point) + ')'


def code_point_expr(opening, ranges, closing):
    """A PostgreSQL TEXT EXPRESSION that builds a regular-expression bracket expression from chr() pieces: ('[' || chr(1) || '-' || chr(9) || ... || ']'). It carries no escape text and no non-ASCII character."""
    pieces = ["'" + opening + "'"]
    for lo, hi in ranges:
        pieces.append(chr_piece(lo))
        if hi != lo:
            pieces.append("'-'")
            pieces.append(chr_piece(hi))
    pieces.append("'" + closing + "'")
    return '(' + ' || '.join(pieces) + ')'


def digits_from_expr(sets):
    return ' || '.join(chr_piece(code_point) for lo, hi in sets for code_point in range(lo, hi + 1))


FORBIDDEN_EXPR = code_point_expr('[', FORBIDDEN_RANGES, ']')
BLANK_EXPR = code_point_expr('^[', BLANK_RANGES, ']*$')   # an EXPLICIT class: no POSIX [[:space:]] (locale dependent: it also matches U+001C..U+001F in en_US.UTF-8)
STRIP_EXPR = code_point_expr('[', STRIP_RANGES, ']')
DIGITS_FROM_EXPR = digits_from_expr(DIGIT_SETS)
DIGITS_TO = '0123456789' * len(DIGIT_SETS)
CONSTANTS = {
    'COMMENT_MAX_CHARS': '500', 'COMMENT_MAX_OCTETS': '2000', 'COMMENT_JSON_MAX_OCTETS': '8192',
    'COMMENT_PAGE_DEFAULT': '20', 'COMMENT_PAGE_MAX': '50', 'COMMENT_FORBIDDEN_EXPR': FORBIDDEN_EXPR, 'COMMENT_BLANK_EXPR': BLANK_EXPR, 'COMMENT_STRIP_EXPR': STRIP_EXPR,
    'COMMENT_DIGITS_FROM_EXPR': DIGITS_FROM_EXPR, 'COMMENT_DIGITS_TO': DIGITS_TO,
}
# NO non-ASCII character is allowed in any generated file (the Serbian letters of the legacy event text and of the captured pre-image are written as chr() pieces / restore markers).
ALLOWED_NON_ASCII = set()

NEW_FUNCTIONS = [
    dict(signature='private.guard_review_comment_mutation()', file='fn_guard_review_comment_mutation.sql', language='plpgsql', volatility='v', definer=True, result='trigger',
         head='create function private.guard_review_comment_mutation() returns trigger language plpgsql security definer set search_path = pg_catalog as ',
         acl='{postgres=X/postgres}', grant=None),
    dict(signature='private.review_comment_input_v1(jsonb)', file='fn_review_comment_input_v1.sql', language='plpgsql', volatility='s', definer=False, result='text',
         head='create function private.review_comment_input_v1(p_comment jsonb) returns text language plpgsql stable set search_path = pg_catalog as ',
         acl='{postgres=X/postgres}', grant=None),
    dict(signature='public.rpc_submit_agreement_review_v2(uuid,uuid,jsonb,jsonb,uuid,jsonb)', file='fn_rpc_submit_agreement_review_v2.sql', language='plpgsql', volatility='v', definer=True, result='jsonb',
         head=('create function public.rpc_submit_agreement_review_v2(p_agreement_id uuid, p_target_account_id uuid, p_rating jsonb, p_tags jsonb, p_client_request_id uuid, p_comment jsonb default null) '
               'returns jsonb language plpgsql security definer set search_path = pg_catalog as '),
         acl='{postgres=X/postgres,authenticated=X/postgres}', grant='authenticated'),
    dict(signature='public.rpc_get_my_agreement_review_v2(uuid)', file='fn_rpc_get_my_agreement_review_v2.sql', language='plpgsql', volatility='s', definer=True, result='jsonb',
         head='create function public.rpc_get_my_agreement_review_v2(p_agreement_id uuid) returns jsonb language plpgsql stable security definer set search_path = pg_catalog as ',
         acl='{postgres=X/postgres,authenticated=X/postgres}', grant='authenticated'),
    dict(signature='public.rpc_list_review_comments_v1(uuid,integer,jsonb)', file='fn_rpc_list_review_comments_v1.sql', language='plpgsql', volatility='s', definer=True, result='jsonb',
         head=('create function public.rpc_list_review_comments_v1(p_profile_id uuid, p_limit integer default 20, p_after jsonb default null) '
               'returns jsonb language plpgsql stable security definer set search_path = pg_catalog as '),
         acl='{postgres=X/postgres,authenticated=X/postgres}', grant='authenticated'),
    dict(signature='public.rpc_moderate_review_comment_service_v1(uuid,text,text,uuid)', file='fn_rpc_moderate_review_comment_service_v1.sql', language='plpgsql', volatility='v', definer=True, result='jsonb',
         head=('create function public.rpc_moderate_review_comment_service_v1(p_review_id uuid, p_action text, p_reason_code text, p_client_request_id uuid) '
               'returns jsonb language plpgsql security definer set search_path = pg_catalog as '),
         acl='{postgres=X/postgres,service_role=X/postgres}', grant='service_role'),
]
SUBMIT_V2 = 'public.rpc_submit_agreement_review_v2(uuid,uuid,jsonb,jsonb,uuid,jsonb)'
SERVICE_FUNCTION = 'public.rpc_moderate_review_comment_service_v1(uuid,text,text,uuid)'

# The exact-once anchor edits of the current DEV definitions (pg_get_functiondef text; every anchor must occur exactly once). Order = execution order = restore order in the revert.
EDITS = [
    dict(signature='private.closure_redaction_relations_v5()', tag='RELATIONS',
         replacements=[("'public.app_profiles','public.app_accounts'", "'public.app_profiles','public.app_accounts','private." + TABLE + "'")]),
    dict(signature='private.closure_redaction_scope_v5(text)', tag='SCOPE',
         replacements=[("when r in('private.need_edit_commands','private.need_publish_commands','private.remaining_search_close_commands') then 't.requester_account_id=$1'",
                        "when r='private." + TABLE + "' then 't.author_account_id=$1' when r in('private.need_edit_commands','private.need_publish_commands','private.remaining_search_close_commands') then 't.requester_account_id=$1'")]),
    dict(signature='private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)', tag='PATCH',
         replacements=[("'private.support_read_markers_v5','private.group_message_visibility_v5') then",
                        "'private.support_read_markers_v5','private.group_message_visibility_v5','private." + TABLE + "') then")]),
    dict(signature='private.data_export_dataset_catalog()', tag='EXPORT_CATALOG',
         replacements=[('"key": "ownAgreementReviews", "fields": ["agreementId", "createdAt", "id", "rating", "tags"]',
                        '"key": "ownAgreementReviews", "fields": ["agreementId", "createdAt", "id", "rating", "tags", "comment"]')]),
    dict(signature='private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', tag='EXPORT_SNAPSHOT',
         replacements=[("'tags',t.tags,'createdAt',t.created_at) as value from private.agreement_reviews t",
                        "'tags',t.tags,'createdAt',t.created_at,'comment',(select c.comment from private." + TABLE + " c where c.review_id=t.id)) as value from private.agreement_reviews t"),
                       ("'OWN_ACCOUNT_V5_9'", "'OWN_ACCOUNT_V5_10'")]),
    dict(signature='private.data_export_policy_binding()', tag='EXPORT_BINDING', replacements=[("'OWN_ACCOUNT_V5_9'", "'OWN_ACCOUNT_V5_10'")]),
]
READINESS = 'private.retention_ai_source_ready()'
PROJECTION_FUNCTIONS = ['private.data_export_dataset_catalog()', 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', 'private.data_export_scalar_v5(jsonb,text)',
                        'private.data_export_array_v5(jsonb,text)', 'private.data_export_worker_candidate_v5(jsonb)', 'private.data_export_task_facts_v5(jsonb)']

# Facts about the new table, asserted in the application, the revert's applied-state check and the postflight (one text, three uses).
TABLE_COLUMNS = [('review_id', 'uuid', True), ('author_account_id', 'uuid', True), ('target_account_id', 'uuid', True), ('comment', 'text', True), ('comment_sha256', 'text', True),
                 ('created_at', 'timestamp with time zone', True), ('hidden_at', 'timestamp with time zone', False), ('hidden_reason_code', 'text', False)]
TABLE_CONSTRAINTS = [(TABLE + '_author_fkey', 'f'), (TABLE + '_hidden_check', 'c'), (TABLE + '_parties_check', 'c'), (TABLE + '_pkey', 'p'), (TABLE + '_review_fkey', 'f'),
                     (TABLE + '_sha_check', 'c'), (TABLE + '_target_fkey', 'f'), (TABLE + '_text_chars_check', 'c'), (TABLE + '_text_length_check', 'c'), (TABLE + '_text_trim_check', 'c')]
TABLE_INDEXES = sorted([AUTHOR_INDEX, TARGET_INDEX, TABLE + '_pkey'])


def read(path):
    return Path(path).read_bytes().decode('utf-8').replace(CRLF, LF)


def md5_lf(text):
    return hashlib.md5(text.replace(CRLF, LF).encode('utf-8')).hexdigest()


def sha256_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def body_of(definition):
    """The body of a pg_get_functiondef text: between the first and the last $function$ tag (the body itself never contains one)."""
    if definition.count('$function$') != 2:
        raise SystemExit('a definition must carry exactly one $function$ pair')
    return definition[definition.index('$function$') + len('$function$'):definition.rindex('$function$')]


def sql_quote(text):
    return "'" + text.replace("'", "''") + "'"


# ---------------------------------------------------------------------------------------------------- inputs
def load_inputs():
    pins_doc = json.loads(PINS_JSON.read_bytes().decode('utf-8'))
    pre_doc = json.loads(PREIMAGE_JSON.read_bytes().decode('utf-8'))
    pins = {row['signature']: row for row in pins_doc['rows']}
    for signature, row in pins.items():
        if row['resolved'] is None or row['hasCarriageReturn']:
            raise SystemExit('pin ' + signature + ': missing on DEV or carries a carriage return')
    if pre_doc.get('certifiedDigest') != DEV_PRE_DIGEST:
        raise SystemExit('the pre-image was captured against another certified digest than the recorded DEV one')
    preimage = {}
    for item in pre_doc['functions']:
        definition = item['definition']
        if CRLF in definition or chr(13) in definition or item['hasCarriageReturn']:
            raise SystemExit(item['signature'] + ': the captured definition contains a carriage return')
        if md5_lf(body_of(definition)) != item['bodyMd5'] or item['bodyMd5'] != pins[item['signature']]['bodyMd5']:
            raise SystemExit(item['signature'] + ': the captured body is not the pinned DEV predecessor body')
        preimage[item['signature']] = definition
    expected = [edit['signature'] for edit in EDITS] + [READINESS]
    if sorted(preimage) != sorted(expected):
        raise SystemExit('the pre-image capture does not hold exactly the seven rewritten or re-bound definitions')
    return pins_doc, pins, pre_doc, preimage


def apply_edits(preimage):
    """The rewritten definitions and the md5 each rewritten body must have: the same exact-once replacements the SQL performs."""
    result = {}
    for edit in EDITS:
        definition = preimage[edit['signature']]
        for anchor, _ in edit['replacements']:
            if definition.count(anchor) != 1:
                raise SystemExit(edit['signature'] + ': anchor occurs ' + str(definition.count(anchor)) + ' times: ' + anchor)
            if '$a$' in anchor or '$a$' in _:
                raise SystemExit(edit['tag'] + ': an anchor must not contain the quote tag $a$')
        rewritten = definition
        for anchor, replacement in edit['replacements']:
            rewritten = rewritten.replace(anchor, replacement)
        if rewritten == definition:
            raise SystemExit(edit['signature'] + ': the edit changes nothing')
        result[edit['signature']] = dict(definition=rewritten, body_md5=md5_lf(body_of(rewritten)))
    return result


def projection_sha(md5_by_signature):
    lines = [signature + ':' + md5_by_signature[signature] for signature in sorted(PROJECTION_FUNCTIONS)]
    return hashlib.sha256((LF.join(lines)).encode('utf-8')).hexdigest()


def expected_projection(pins, rewritten):
    before = {s: pins[s]['bodyMd5'] for s in PROJECTION_FUNCTIONS}
    after = dict(before)
    for signature in PROJECTION_FUNCTIONS:
        if signature in rewritten:
            after[signature] = rewritten[signature]['body_md5']
    sha_before, sha_after = projection_sha(before), projection_sha(after)
    if sha_before != DEV_PRE_PROJECTION_SHA:
        raise SystemExit('the pinned export bodies do not reproduce the recorded DEV projection sha: ' + sha_before)
    if sha_after == sha_before:
        raise SystemExit('the export edits did not move the projection sha')
    return sha_before, sha_after


def readiness_placeholder_check(preimage):
    definition = preimage[READINESS]
    body = body_of(definition)
    if body.count(DEV_PRE_DIGEST) != 1 or len(re.findall(r'[0-9a-f]{64}', definition)) != 1:
        raise SystemExit('the readiness definition must carry the certified digest exactly once and no other 64-hex literal')
    if md5_lf(body.replace(DEV_PRE_DIGEST, '__CERTIFIED_SOURCE__')) != READINESS_PLACEHOLDER_MD5:
        raise SystemExit('the readiness body with its literal masked is not the recorded predecessor')


# ---------------------------------------------------------------------------------------------------- the new function bodies
def render_body(text):
    for key, value in CONSTANTS.items():
        text = text.replace('{{' + key + '}}', value)
    if '{{' in text:
        raise SystemExit('a function body has an unreplaced placeholder')
    if chr(13) in text or '$f$' in text or '\t' in text:
        raise SystemExit('a function body must be LF-only, tab-free and must not contain the quote tag $f$')
    return LF + text.rstrip(LF) + LF


def load_new_functions():
    functions = []
    for spec in NEW_FUNCTIONS:
        body = render_body(read(SQL / spec['file']))
        if '40001' in body:
            raise SystemExit(spec['signature'] + ': a new body must not mention SQLSTATE 40001 anywhere, not even in a comment (deterministic conflicts are PT409)')
        if 'cascade' in body.lower():
            raise SystemExit(spec['signature'] + ': no CASCADE anywhere')
        functions.append(dict(spec, body=body, body_md5=md5_lf(body)))
    return functions


def legacy_review_bodies():
    """The legacy review functions from the repository (their live md5 is pinned): used to prove that v2 repeats the legacy command exactly where it must."""
    text = read(REVIEWS_MIGRATION)

    def grab(name):
        match = re.search(r'create function [a-z_.]*' + name + r'\(.*?\$f\$(.*?)\$f\$;', text, re.S)
        if not match:
            raise SystemExit('legacy source not found: ' + name)
        return match.group(1)
    return grab


def crosscheck_repository(pins):
    """Repository text == live DEV pin for the review surface (the original migration plus the exact closure-seam anchors of the closure preparation migration)."""
    grab = legacy_review_bodies()
    sources = {
        'public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)': grab('rpc_submit_agreement_review'),
        'private.review_receipt(private.agreement_reviews,boolean)': grab('review_receipt'),
        'private.guard_review_immutable()': grab('guard_review_immutable'),
        'private.account_reputation(uuid)': grab('account_reputation'),
        'private.review_tag_catalog()': grab('review_tag_catalog'),
        'private.review_tags_valid(text[])': grab('review_tags_valid'),
    }
    mine = grab('rpc_get_my_agreement_review')
    anchor = "'eligible',own_review is null and a.status='COMPLETED'"
    if mine.count(anchor) != 1:
        raise SystemExit('legacy my-review anchor drift')
    sources['public.rpc_get_my_agreement_review(uuid)'] = mine.replace(anchor, "'eligible',own_review is null and not private.closure_account_restricted(u) and a.status='COMPLETED'")
    reputation = grab('rpc_get_account_reputation')
    anchor = ' if p_account_id is null or not exists(select 1 from public.app_accounts where id=p_account_id)'
    if reputation.count(anchor) != 1:
        raise SystemExit('legacy reputation anchor drift')
    sources['public.rpc_get_account_reputation(uuid)'] = reputation.replace(
        anchor, anchor + LF + ' or private.closure_account_restricted(auth.uid()) or private.closure_account_restricted(p_account_id)')
    for signature, body in sources.items():
        if md5_lf(body) != pins[signature]['bodyMd5']:
            raise SystemExit('repository text of ' + signature + ' is not the live DEV pin')
    return sources


S_CARON_PIECE = "'||chr(353)||'"   # v2 spells the legacy event text 'zavrsen' with its s-caron as chr(353): the generated SQL is ASCII-only


def meaningful(text, spelled=False):
    lines = [line for line in text.split(LF) if line.strip() and not line.strip().startswith('--')]
    return [line.replace(S_CARON_PIECE, chr(0x161)) for line in lines] if spelled else lines


def parity_check(sources, functions):
    """v2 repeats the legacy submit and context line by line (in order); only the declared lines differ."""
    by_signature = {f['signature']: f for f in functions}
    checks = [
        ('public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)', SUBMIT_V2, {
            'declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews;', ' rating_value numeric; tags_value text[]; h text; target_role text;',
            '  return private.review_receipt(r,true);', ' return private.review_receipt(r,false);',
            " -- A block cannot remove the counterpart's completed-work review entitlement."}),
        ('public.rpc_get_my_agreement_review(uuid)', 'public.rpc_get_my_agreement_review_v2(uuid)', {
            'declare u uuid:=auth.uid(); a public.agreements; r private.agreement_reviews; own_review jsonb;',
            ' own_review:=case when found then private.review_receipt(r,false) else null end;'}),
    ]
    for legacy_signature, v2_signature, allowed_missing in checks:
        legacy = meaningful(sources[legacy_signature])
        new = meaningful(by_signature[v2_signature]['body'], spelled=True)
        position = 0
        for line in legacy:
            if line in allowed_missing:
                continue
            try:
                position = new.index(line, position) + 1
            except ValueError:
                raise SystemExit('v2 does not repeat the legacy line of ' + legacy_signature + ': ' + line)


# ---------------------------------------------------------------------------------------------------- sql fragments
def values_rows(rows, indent='    '):
    return (',' + LF).join(indent + '(' + ','.join(row) + ')' for row in rows)


def pin_rows(pins, signatures, kind):
    rows = []
    for signature in signatures:
        pin = pins[signature]
        if kind == 'metadata':
            if pin['composite']:
                continue
            rows.append([sql_quote(signature), sql_quote(pin['metadataMd5'])])
        else:
            rows.append([sql_quote(signature), sql_quote(pin['bodyMd5'])])
    return values_rows(rows)


def new_function_rows(functions):
    return values_rows([[sql_quote(f['signature']), sql_quote(f['body_md5']), sql_quote(f['language']), sql_quote(f['volatility']), 'true' if f['definer'] else 'false', 'false',
                         sql_quote(f['result']), sql_quote(f['acl'])] for f in functions])


NEW_FUNCTION_PREDICATE = (r"md5(replace(p.prosrc,E'\r\n',E'\n'))=pin.body_md5 and p.prosecdef=pin.definer and p.proisstrict=pin.strict_function" + LF +
                          "      and p.proconfig=array['search_path=pg_catalog'] and p.proowner='postgres'::regrole" + LF +
                          "      and p.prolang=(select oid from pg_language where lanname=pin.language_name)" + LF +
                          "      and p.provolatile::text=pin.volatility and p.prokind='f' and p.prorettype=to_regtype(pin.result_type)" + LF +
                          "      and p.proacl::text=pin.acl and not p.proretset and not p.proleakproof and p.proparallel='u'" + LF +
                          "      and p.probin is null and p.prosqlbody is null and p.protrftypes is null and p.proallargtypes is null and p.proargmodes is null")


def table_ddl():
    chars = FORBIDDEN_EXPR
    return LF.join([
        '  create table private.' + TABLE + '(',
        '    review_id uuid not null,',
        '    author_account_id uuid not null,',
        '    target_account_id uuid not null,',
        '    comment text not null,',
        '    comment_sha256 text not null,',
        '    created_at timestamptz not null default clock_timestamp(),',
        '    hidden_at timestamptz,',
        '    hidden_reason_code text,',
        '    constraint ' + TABLE + '_pkey primary key(review_id),',
        '    constraint ' + TABLE + '_review_fkey foreign key(review_id) references private.agreement_reviews(id) on delete restrict,',
        '    constraint ' + TABLE + '_author_fkey foreign key(author_account_id) references public.app_accounts(id) on delete restrict,',
        '    constraint ' + TABLE + '_target_fkey foreign key(target_account_id) references public.app_accounts(id) on delete restrict,',
        '    constraint ' + TABLE + '_parties_check check(author_account_id<>target_account_id),',
        '    constraint ' + TABLE + '_text_length_check check(char_length(comment) between 1 and ' + CONSTANTS['COMMENT_MAX_CHARS'] + ' and octet_length(comment)<=' + CONSTANTS['COMMENT_MAX_OCTETS'] + '),',
        "    constraint " + TABLE + "_text_trim_check check(comment=btrim(comment,E' \\n')),",
        "    constraint " + TABLE + "_text_chars_check check(comment !~ " + chars + "),",
        "    constraint " + TABLE + "_sha_check check(comment_sha256 ~ '^[0-9a-f]{64}$'),",
        '    constraint ' + TABLE + "_hidden_check check((hidden_at is null)=(hidden_reason_code is null) and (hidden_reason_code is null or hidden_reason_code ~ '^[A-Z][A-Z0-9_]{0,63}$'))",
        '  );',
        '  create index ' + TARGET_INDEX + ' on private.' + TABLE + '(target_account_id,created_at desc,review_id desc) where hidden_at is null;',
        '  create index ' + AUTHOR_INDEX + ' on private.' + TABLE + '(author_account_id);',
        '  alter table private.' + TABLE + ' enable row level security;',
        '  alter table private.' + TABLE + ' force row level security;',
        '  revoke all on private.' + TABLE + ' from public,anon,authenticated,service_role;',
        "  comment on table private." + TABLE + " is 'Written comment of an immutable completed-Agreement review, one row per review that carries a comment (D12). Never reachable by a client role: read only through "
        "rpc_list_review_comments_v1 and the author own receipt. Immutable for every role; erased at the author account closure by the certified erasure program; the moderation function may only hide the text (hidden_at, "
        "hidden_reason_code). Stars, count and average live in private.agreement_reviews and never depend on this table.';",
    ])


def function_ddl(functions):
    by_signature = {f['signature']: f for f in functions}
    lines = []

    def create(signature):
        spec = by_signature[signature]
        lines.append('  ' + spec['head'] + '$f$' + spec['body'] + '$f$;')
    create('private.guard_review_comment_mutation()')
    lines.append('  create trigger ' + CLOSURE_TRIGGER + ' before insert on private.' + TABLE + LF + "    for each row execute function private.closure_guard_owned_write('ACCOUNT','author_account_id');")
    lines.append('  create trigger ' + MUTATION_TRIGGER + ' before update or delete on private.' + TABLE + LF + '    for each row execute function private.guard_review_comment_mutation();')
    for spec in functions:
        if spec['signature'] != 'private.guard_review_comment_mutation()':
            create(spec['signature'])
    signatures = [f['signature'] for f in functions]
    lines.append('  revoke all on function ' + ','.join(signatures) + ' from public,anon,authenticated,service_role;')
    authenticated = [f['signature'] for f in functions if f['grant'] == 'authenticated']
    service = [f['signature'] for f in functions if f['grant'] == 'service_role']
    lines.append('  grant execute on function ' + ','.join(authenticated) + ' to authenticated;')
    lines.append('  grant execute on function ' + ','.join(service) + ' to service_role;')
    return LF.join(lines)


def edit_ddl():
    lines = []
    for edit in EDITS:
        lines.append("  edit_definition:=pg_get_functiondef('" + edit['signature'] + "'::regprocedure);")
        for number, (anchor, _) in enumerate(edit['replacements'], 1):
            lines.append("  if (length(edit_definition)-length(replace(edit_definition,$a$" + anchor + "$a$,'')))<>length($a$" + anchor + "$a$) then")
            lines.append("    raise exception 'D12_" + edit['tag'] + "_ANCHOR_" + str(number) + "_DRIFT' using errcode='55000';end if;")
        expression = 'edit_definition'
        for anchor, replacement in edit['replacements']:
            expression = 'replace(' + expression + ',$a$' + anchor + '$a$,$a$' + replacement + '$a$)'
        lines.append('  execute ' + expression + ';')
    return LF.join(lines)


def restore_ddl(preimage):
    """The pre-image definitions, byte for byte. A non-ASCII character of a captured definition (the z-caron of one Serbian text) is carried as an ASCII marker and put back by replace(..., chr(n)) at run time, so the generated text is ASCII-only;
    the md5 of every restored body is asserted against the application's predecessor pin afterwards."""
    lines = []
    for number, edit in enumerate(EDITS, 1):
        tag = '$d12_restore_' + format(number, '02d') + '$'
        text = preimage[edit['signature']]
        if tag in text:
            raise SystemExit(edit['signature'] + ': contains its own quote tag')
        markers = []
        for character in sorted({c for c in text if ord(c) > 127}):
            marker = '@@U' + format(ord(character), '04X') + '@@'
            if marker in text:
                raise SystemExit(edit['signature'] + ': contains its own restore marker')
            text = text.replace(character, marker)
            markers.append((marker, ord(character)))
        expression = tag + text + tag
        for marker, code_point in markers:
            expression = 'replace(' + expression + ",'" + marker + "'," + chr_piece(code_point) + ')'
        lines.append('  -- ' + edit['signature'] + LF + '  execute ' + expression + ';')
    return LF.join(lines)


def drop_statements(functions):
    lines = []
    for spec in functions:
        if spec['signature'] != 'private.guard_review_comment_mutation()':
            lines.append('  drop function ' + spec['signature'] + ';')
    lines.append('  drop table private.' + TABLE + ';')
    lines.append('  drop function private.guard_review_comment_mutation();')
    return LF.join(lines)


def surface_query():
    schemas = "('public','private','rls_private')"
    exclusion = "c.oid is distinct from to_regclass('private." + TABLE + "')"
    return LF.join([
        '',
        '    select jsonb_build_object(',
        "      'relations',(select jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relnamespace,c.relowner,c.relkind,c.relacl,",
        '        c.relrowsecurity,c.relforcerowsecurity,c.relreplident,c.relispartition,c.reloptions) order by c.oid)',
        '        from pg_class c join pg_namespace n on n.oid=c.relnamespace',
        "        where n.nspname in" + schemas + " and c.relkind in('r','p') and " + exclusion + "),",
        "      'columns',(select jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum)",
        '        from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace',
        "        where n.nspname in" + schemas + " and c.relkind in('r','p') and a.attnum>0 and not a.attisdropped and " + exclusion + "),",
        "      'constraints',(select jsonb_agg(to_jsonb(x) order by x.oid)",
        '        from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace',
        "        where n.nspname in" + schemas + " and " + exclusion + "),",
        "      'triggers',(select jsonb_agg(to_jsonb(t) order by t.oid)",
        '        from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace',
        "        where (n.nspname in" + schemas + " or c.oid='storage.objects'::regclass) and not t.tgisinternal",
        "          and t.tgname not in('" + CLOSURE_TRIGGER + "','" + MUTATION_TRIGGER + "')),",
        "      'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p",
        "        where schemaname in" + schemas + " or (schemaname='storage' and tablename='objects')),",
        "      'indexes',(select jsonb_agg(to_jsonb(i) order by schemaname,indexname) from pg_indexes i",
        "        where schemaname in" + schemas + " and tablename is distinct from '" + TABLE + "'),",
        "      'buckets',(select jsonb_agg(to_jsonb(b) order by b.id) from storage.buckets b)",
        '    )',
        '  ',
    ])


def table_shape_bad():
    column_text = ','.join(name + ':' + type_ + ':' + ('true' if not_null else 'false') + '::' for name, type_, not_null in TABLE_COLUMNS)
    constraint_text = ','.join(name + ':' + kind for name, kind in TABLE_CONSTRAINTS)
    relation = "to_regclass('private." + TABLE + "')"
    return LF.join([
        '(not exists(select 1 from pg_class where oid=' + relation + " and relowner='postgres'::regrole and relkind='r' and relpersistence='p'",
        "      and not relispartition and relrowsecurity and relforcerowsecurity and relreplident='d' and reloptions is null and relacl=acldefault('r','postgres'::regrole))",
        "    or exists(select 1 from pg_policies where schemaname='private' and tablename='" + TABLE + "')",
        "    or (select string_agg(attname::text||':'||format_type(atttypid,atttypmod)||':'||attnotnull::text||':'||attidentity::text||':'||attgenerated::text,',' order by attnum)",
        '        from pg_attribute where attrelid=' + relation + ' and attnum>0 and not attisdropped) is distinct from ' + sql_quote(column_text),
        "    or (select pg_get_expr(d.adbin,d.adrelid) from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum",
        "        where d.adrelid=" + relation + " and a.attname='created_at') is distinct from 'clock_timestamp()'",
        "    or (select string_agg(conname::text||':'||contype::text,',' order by conname) from pg_constraint",
        "        where conrelid=" + relation + " and contype<>'n' and convalidated and conislocal and conparentid=0) is distinct from " + sql_quote(constraint_text),
        "    or (select count(*) from pg_constraint where conrelid=" + relation + " and contype='f' and confdeltype='r' and confupdtype='a' and confmatchtype='s'",
        "        and confrelid in('private.agreement_reviews'::regclass,'public.app_accounts'::regclass))<>3",
        "    or (select string_agg(indexname::text,',' order by indexname) from pg_indexes where schemaname='private' and tablename='" + TABLE + "') is distinct from " + sql_quote(','.join(TABLE_INDEXES)),
        "    or not exists(select 1 from pg_indexes where schemaname='private' and tablename='" + TABLE + "' and indexname='" + TARGET_INDEX + "'",
        "        and indexdef like '%(target_account_id, created_at DESC, review_id DESC)%' and indexdef like '%hidden_at IS NULL%')",
        "    or not exists(select 1 from pg_indexes where schemaname='private' and tablename='" + TABLE + "' and indexname='" + AUTHOR_INDEX + "' and indexdef like '%(author_account_id)%'))",
    ])


def triggers_bad():
    closure_arguments = ('ACCOUNT'.encode() + b'\x00' + 'author_account_id'.encode() + b'\x00').hex()
    relation = "to_regclass('private." + TABLE + "')"
    return LF.join([
        '(exists(select 1 from (values',
        "      ('" + CLOSURE_TRIGGER + "','private.closure_guard_owned_write()',7,'" + closure_arguments + "'),",
        "      ('" + MUTATION_TRIGGER + "','private.guard_review_comment_mutation()',27,'')",
        '    ) q(trigger_name,signature,event_type,argument_hex)',
        '    where not exists(select 1 from pg_trigger t where t.tgrelid=' + relation + ' and t.tgname=q.trigger_name',
        "      and t.tgfoid=to_regprocedure(q.signature) and t.tgtype=q.event_type and t.tgenabled='O' and not t.tgisinternal",
        '      and encode(t.tgargs,\'hex\')=q.argument_hex and t.tgqual is null and t.tgconstraint=0',
        "      and not t.tgdeferrable and not t.tginitdeferred and t.tgoldtable is null and t.tgnewtable is null and t.tgparentid=0 and t.tgattr::text=''))",
        '    or (select count(*) from pg_trigger where tgrelid=' + relation + ' and not tgisinternal)<>2)',
    ])


def star_table_bad():
    """The predecessor shape of the immutable star table (columns, constraints, triggers, ACL, forced RLS, no policy): ONE text for the preflight, the application, the postflight."""
    star = "'" + STAR_TABLE + "'::regclass"
    return LF.join([
        "(select string_agg(attname::text||':'||format_type(atttypid,atttypmod)||':'||attnotnull::text||':'||attidentity::text||':'||attgenerated::text,',' order by attnum)",
        "           from pg_attribute where attrelid=" + star + " and attnum>0 and not attisdropped) is distinct from " + sql_quote(STAR_COLUMNS),
        "      or (select md5(string_agg(conname||':'||replace(pg_get_constraintdef(oid),'REFERENCES public.','REFERENCES '),';' order by conname)) from pg_constraint where conrelid=" + star + ") is distinct from '" + STAR_CONSTRAINTS_MD5 + "'",
        "      or (select string_agg(tgname,',' order by tgname) from pg_trigger where tgrelid=" + star + " and not tgisinternal) is distinct from 'pre_v3_closure_review,pre_v3_review_immutable'",
        "      or (select relacl::text from pg_class where oid=" + star + ") is distinct from '{postgres=arwdDxtm/postgres}'",
        "      or not (select relrowsecurity and relforcerowsecurity from pg_class where oid=" + star + ")",
        "      or (select count(*) from pg_policy where polrelid=" + star + ")<>0",
    ])


def composite_pin_rows(pins):
    """The three composite-typed pins carry a per-database type OID in their full metadata hash: here their OWNER, ACL, security, configuration, volatility, strictness, language and result are pinned from the DEV capture (round-1 finding)."""
    rows = []
    for signature, pin in pins.items():
        if pin['composite']:
            rows.append([sql_quote(signature), sql_quote(pin['acl']), sql_quote(pin['config']), 'true' if pin['definer'] else 'false', sql_quote(pin['volatility']), sql_quote(pin['language']),
                         sql_quote(pin['result']), 'true' if pin['strict'] else 'false'])
    if len(rows) != 3:
        raise SystemExit('exactly three composite-typed pins are expected')
    return values_rows(rows)


COMPOSITE_PREDICATE = ("p.proowner='postgres'::regrole and p.proacl::text=pin.acl and coalesce(p.proconfig::text,'')=pin.config and p.prosecdef=pin.definer and p.provolatile::text=pin.volatility" + LF +
                       "      and p.proisstrict=pin.strict_function and p.prolang=(select oid from pg_language where lanname=pin.language_name) and p.prorettype=to_regtype(pin.result_type) and p.prokind='f'")
# The new table must not be streamed by any publication (a FOR ALL TABLES publication would include it): the application, the postflight and the proof all assert it.
PUBLICATION_BAD = ("exists(select 1 from pg_publication_tables where schemaname='private' and tablename='" + TABLE + "') or exists(select 1 from pg_publication where puballtables)")


def array_literal(items):
    return ','.join(sql_quote(item) for item in items)


def name_pairs(functions):
    return ','.join("('" + ('private' if f['signature'].startswith('private.') else 'public') + "','" + f['signature'].split('.', 1)[1].split('(')[0] + "')" for f in functions)


def shared(pins, functions, rewritten, preimage, provenance):
    changed = [edit['signature'] for edit in EDITS]
    all_signatures = list(pins)
    body_signatures = [s for s in all_signatures if s != READINESS]
    sha_before, sha_after = expected_projection(pins, rewritten)
    client = [f['signature'] for f in functions if f['grant'] == 'authenticated']
    private = [f['signature'] for f in functions if f['signature'].startswith('private.')]
    mapping = {
        'PROVENANCE': provenance, 'TABLE': TABLE, 'TARGET_INDEX': TARGET_INDEX, 'AUTHOR_INDEX': AUTHOR_INDEX,
        'CERTIFIED_DIGEST': DEV_PRE_DIGEST, 'READINESS_PLACEHOLDER_MD5': READINESS_PLACEHOLDER_MD5,
        'ROSTER_BEFORE': str(ROSTER_BEFORE), 'ROSTER_AFTER': str(ROSTER_AFTER),
        'PROJECTION_SHA_BEFORE': sha_before, 'PROJECTION_SHA_AFTER': sha_after,
        'STAR_COLUMNS': STAR_COLUMNS, 'STAR_CONSTRAINTS_MD5': STAR_CONSTRAINTS_MD5,
        'SURFACE_QUERY': surface_query(),
        'METADATA_PINS': pin_rows(pins, all_signatures, 'metadata'),
        'BODY_PINS': pin_rows(pins, body_signatures, 'body'),
        'UNCHANGED_BODY_PINS': pin_rows(pins, [s for s in body_signatures if s not in changed], 'body'),
        'APPLIED_BODY_PINS': values_rows([[sql_quote(s), sql_quote(rewritten[s]['body_md5'])] for s in changed]),
        'REWRITTEN_BODY_PINS': values_rows([[sql_quote(s), sql_quote(rewritten[s]['body_md5'])] for s in changed]),
        'REWRITTEN_ROSTER': ','.join("to_regprocedure('" + s + "')" for s in changed), 'REWRITTEN_COUNT': str(len(changed)),
        'NEW_FUNCTION_PINS': new_function_rows(functions), 'NEW_FUNCTION_PREDICATE': NEW_FUNCTION_PREDICATE,
        'NEW_FUNCTION_ROSTER': ','.join("to_regprocedure('" + f['signature'] + "')" for f in functions), 'NEW_FUNCTION_COUNT': str(len(functions)),
        'NEW_FUNCTION_SIGNATURES': array_literal([f['signature'] for f in functions]),
        'CLIENT_FUNCTION_SIGNATURES': array_literal(client), 'PRIVATE_FUNCTION_SIGNATURES': array_literal(private), 'SERVICE_FUNCTION_SIGNATURE': SERVICE_FUNCTION,
        'SUBMIT_V2_SIGNATURE': SUBMIT_V2,
        'NEW_FUNCTION_NAME_PAIRS': name_pairs(functions),
        'TRIGGER_NAME_LIST': array_literal([CLOSURE_TRIGGER, MUTATION_TRIGGER]), 'INDEX_NAME_LIST': array_literal(TABLE_INDEXES),
        'TABLE_SHAPE_BAD': table_shape_bad(), 'TRIGGERS_BAD': triggers_bad(), 'STAR_TABLE_BAD': star_table_bad(), 'PUBLICATION_BAD': PUBLICATION_BAD,
        'COMPOSITE_PINS': composite_pin_rows(pins), 'COMPOSITE_PREDICATE': COMPOSITE_PREDICATE,
        'RETENTION_CLASS_CODE': RETENTION_CLASS_CODE, 'RETENTION_DESCRIPTION_OLD': sql_quote(RETENTION_DESCRIPTION_OLD), 'RETENTION_DESCRIPTION_NEW': sql_quote(RETENTION_DESCRIPTION_NEW),
        'TABLE_DDL': table_ddl(), 'FUNCTION_DDL': function_ddl(functions), 'EDIT_DDL': edit_ddl(),
        'RESTORE_FUNCTIONS': restore_ddl(preimage), 'DROP_STATEMENTS': drop_statements(functions),
    }
    return mapping


def render(template, mapping):
    text = template
    # Longest keys first so that a placeholder that is a prefix of another is never cut.
    for key in sorted(mapping, key=len, reverse=True):
        text = text.replace('{{' + key + '}}', mapping[key])
    leftover = re.findall(r'\{\{[A-Z0-9_]+\}\}', text)
    if leftover:
        raise SystemExit('unreplaced placeholders: ' + ', '.join(sorted(set(leftover))))
    for fragment in ('\r', '\t'):
        if fragment in text:
            raise SystemExit('a generated file must be LF-only and tab-free')
    stray = sorted(hex(ord(c)) for c in set(text) if ord(c) > 127 and c not in ALLOWED_NON_ASCII)
    if stray:
        raise SystemExit('a generated file carries a non-ASCII character (build it with chr(), never write the character): ' + ', '.join(stray))
    escape = re.search(re.escape(chr(92)) + r'[uU][0-9A-Fa-f]{4}', text)
    if escape:
        raise SystemExit('a generated file carries a backslash-u escape text (' + escape.group(0) + '): a connector resolves it before Postgres sees it and every md5 pin would change; build the character with chr()')
    if chr(0) in text:
        raise SystemExit('a generated file must not contain NUL')
    return text


def build_all(revert_digest):
    pins_doc, pins, pre_doc, preimage = load_inputs()
    readiness_placeholder_check(preimage)
    rewritten = apply_edits(preimage)
    functions = load_new_functions()
    sources = crosscheck_repository(pins)
    parity_check(sources, functions)
    application_provenance = ('predecessor pins: supabase/proofs/d12/d12_pins.json (sha256 ' + sha256_file(PINS_JSON) + ', read-only DEV capture); pre-image: supabase/proofs/d12/d12_preimage.json (sha256 '
                              + sha256_file(PREIMAGE_JSON) + ', read-only DEV capture of the seven definitions this file rewrites or re-binds); the certified digest it starts from on DEV is ' + DEV_PRE_DIGEST + '.')
    mapping = shared(pins, functions, rewritten, preimage, application_provenance)
    outputs = {
        OUT_APPLICATION: render(read(SQL / 'application.template.sql'), mapping),
        OUT_PREFLIGHT: render(read(SQL / 'preflight.template.sql'), mapping),
        OUT_POSTFLIGHT: render(read(SQL / 'postflight.template.sql'), mapping),
    }
    revert_mapping = dict(mapping, CERTIFIED_DIGEST=revert_digest,
                          PROVENANCE=application_provenance.replace('the certified digest it starts from on DEV is ' + DEV_PRE_DIGEST + '.',
                                                                   'the digest this file restores is ' + revert_digest + '.'))
    outputs[OUT_REVERT] = render(read(SQL / 'revert.template.sql'), revert_mapping)
    return outputs, functions, rewritten, pins


# ---------------------------------------------------------------------------------------------------- the apply-time integrity guard (the Voice B1 method) and the manifest
# The guard checks THREE things inside the database, in one DO block that runs before the candidate: the characters of the current query from the start of the candidate for the length of its span hash to the sha256 of the span; the start
# is absolute (anything before the guard shifts it and fails the hash); and whatever FOLLOWS the span is nothing but line feeds and `--` comment lines (a connector trailer), so no statement can ride behind the candidate. The tail pattern
# is the regular expression ^(<LF>|--[^<LF><CR>]*)*$ (written with the regular-expression escapes for a line feed and a carriage return, which carry no unicode escape text; the PostgreSQL lexer ends a -- comment at either).
GUARD_TAIL_PATTERN = '^(' + chr(92) + 'n|--[^' + chr(92) + 'n' + chr(92) + 'r]*)*$'   # a comment ends at a line feed OR a carriage return in the PostgreSQL lexer, so neither may occur inside one
GUARD_TEMPLATE = ("do $d12_guard$ declare rest text:=substr(current_query(),{tail_start}); begin if encode(sha256(convert_to(substr(current_query(),{start},{length}),'UTF8')),'hex')<>'{sha}' or rest !~ '" + GUARD_TAIL_PATTERN + "' then "
                  "raise exception 'D12_APPLY_TEXT_INTEGRITY' using errcode='55000'; end if; end $d12_guard$;" + LF)


def guarded_span(text):
    """The characters the guard hashes: the candidate WITHOUT its trailing line feeds (round-2 finding). A connector appends a trailer comment to every statement (execute_sql: a blank line, then `-- source: POST /mcp`, `-- user: ...`,
    `-- date: ...`, measured read-only on 2026-10-01) and a typed or re-typed text usually loses its final line feed: neither may change what the database hashes, so the span ends at the last character of the candidate that is not a line feed."""
    return text.rstrip(LF)


def guard_text(text):
    """A DO block that refuses unless (1) the characters of the CURRENT QUERY from the position where `text` starts, for the length of guarded_span(text), hash to the sha256 of that span and (2) everything after the span is only line feeds and
    `--` comment lines: when the guard and the candidate are sent as ONE text (psql -c, a connector execute_sql / apply_migration), the database itself proves that the statement it received is the proved one, byte for byte, whatever harmless text
    follows it (a missing or a second final line feed, a connector trailer comment) and refuses with the named error D12_APPLY_TEXT_INTEGRITY when anything inside the candidate differs, when anything at all precedes the guard (the start position
    is absolute: fail closed) or when any statement, space or other text follows it. The positions are fixed-width, so the guard length does not depend on its own digits. The text must be ASCII (one character = one byte)."""
    if any(ord(c) > 127 for c in text):
        raise SystemExit('a guarded text must be ASCII-only')
    span = guarded_span(text)
    if not span:
        raise SystemExit('a guarded text must not be empty')
    sha = hashlib.sha256(span.encode('utf-8')).hexdigest()
    length = format(len(span), '06d')
    guard = GUARD_TEMPLATE.format(start='000000', tail_start='000000', length=length, sha=sha)
    start = len(guard) + 1
    tail_start = start + len(span)
    guard = GUARD_TEMPLATE.format(start=format(start, '06d'), tail_start=format(tail_start, '06d'), length=length, sha=sha)
    if len(guard) != start - 1 or len(span) > 999999 or tail_start > 999999:
        raise SystemExit('the guard position is not stable')
    return guard


def wrap(text):
    wrapped = guard_text(text) + text
    if len(wrapped.encode('utf-8')) > GUARD_MAX_BYTES:
        raise SystemExit('a guarded text of ' + str(len(wrapped)) + ' bytes does not fit one psql -c argument (limit ' + str(GUARD_MAX_BYTES) + ')')
    return wrapped


def relative(path):
    return str(Path(path).relative_to(ROOT)).replace(chr(92), '/')


def manifest_text(outputs):
    """The committed manifest: the sha256 of the four generated files (what the owner's block quotes and what the proof compares), their guarded forms, and the two read-only DEV captures they come from."""
    files, guarded = {}, {}
    for path in (OUT_APPLICATION, OUT_REVERT, OUT_PREFLIGHT, OUT_POSTFLIGHT):
        data = outputs[path].encode('utf-8')
        files[relative(path)] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'lines': outputs[path].count(LF)}
    for path in (OUT_APPLICATION, OUT_REVERT):
        wrapped = wrap(outputs[path]).encode('utf-8')
        span = guarded_span(outputs[path]).encode('utf-8')
        guarded[relative(path)] = {'guardBytes': len(guard_text(outputs[path])), 'guardedSha256': hashlib.sha256(wrapped).hexdigest(), 'guardedBytes': len(wrapped),
                                   'spanSha256': hashlib.sha256(span).hexdigest(), 'spanLength': len(span), 'tailPattern': GUARD_TAIL_PATTERN}
    document = {'unit': 'D12_MANIFEST', 'generator': relative(Path(__file__)), 'note': 'sha256 of the exact bytes of each generated file (LF-only, ASCII-only); the guarded form is guard + file as ONE text; the guard hashes the file WITHOUT its trailing line feeds (spanSha256, spanLength), so a missing final line feed or a connector trailer comment does not change what it checks, and it refuses any tail that is not line feeds and -- comment lines (tailPattern)',
                'files': files, 'guarded': guarded, 'inputs': {relative(PINS_JSON): sha256_file(PINS_JSON), relative(PREIMAGE_JSON): sha256_file(PREIMAGE_JSON)}}
    return json.dumps(document, indent=2, sort_keys=True) + LF


def flatten_schemas(text):
    """The PL/pgSQL grammar check of libpg_query resolves explicit schemas only for pg_catalog and public: for the syntax check alone every other schema prefix is read as public."""
    return re.sub(r'\b(private|extensions|auth|storage|supabase_migrations|rls_private)\.', 'public.', text)


def syntax_check(outputs, functions):
    """Every generated statement through the PostgreSQL grammar, every function body and both DO bodies (and both guards) through the PL/pgSQL grammar (which also parses every embedded SQL statement)."""
    try:
        import pglast
        from pglast.parser import parse_plpgsql_json
    except ImportError:
        raise SystemExit('--syntax needs pglast (pip install pglast)')
    for path, text in outputs.items():
        statements = pglast.parse_sql(text)
        print('parsed ' + relative(path) + ': ' + str(len(statements)) + ' statement(s)')
    install = table_ddl() + LF + function_ddl(functions)
    print('parsed the install DDL (table, indexes, triggers, six functions, grants): ' + str(len(pglast.parse_sql(install))) + ' statements')
    for spec in functions:
        parse_plpgsql_json(flatten_schemas(spec['head']) + '$x$' + flatten_schemas(spec['body']) + '$x$')
        print('plpgsql grammar OK: ' + spec['signature'])
    for path in (OUT_APPLICATION, OUT_REVERT):
        match = re.search(r'do \$([a-z0-9_]+)\$(.*)\$\1\$;', outputs[path], re.S)
        parse_plpgsql_json('create function f() returns void language plpgsql as $x$' + flatten_schemas(match.group(2)) + '$x$')
        print('plpgsql grammar OK: the DO body of ' + relative(path))
        wrapped = wrap(outputs[path])
        if len(pglast.parse_sql(wrapped)) != len(pglast.parse_sql(outputs[path])) + 1:
            raise SystemExit('the guarded text of ' + relative(path) + ' must be exactly one statement longer than the file')
        guard_match = re.search(r'do \$d12_guard\$(.*)\$d12_guard\$;', wrapped, re.S)
        parse_plpgsql_json('create function f() returns void language plpgsql as $x$' + guard_match.group(1) + '$x$')
        print('guard parsed: ' + relative(path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='fail unless the committed files equal the generated ones BYTE FOR BYTE and the manifest')
    parser.add_argument('--syntax', action='store_true', help='also parse everything with the PostgreSQL parser (pglast)')
    parser.add_argument('--revert-digest', default=DEV_PRE_DIGEST, help='the certified digest the revert restores (default: the DEV digest)')
    parser.add_argument('--revert-out', help='write the generated revert here instead of the committed path (the disposable proof uses this for its chain variant)')
    parser.add_argument('--wrap', help='a text file (an application, a revert or a chain variant of one): write the integrity guard + its text as ONE text to --wrap-out')
    parser.add_argument('--wrap-out', help='where --wrap writes the guarded text')
    arguments = parser.parse_args()
    if not re.fullmatch(r'[0-9a-f]{64}', arguments.revert_digest):
        raise SystemExit('the target digest must be 64 lowercase hex digits')
    if arguments.wrap:
        if not arguments.wrap_out:
            raise SystemExit('--wrap needs --wrap-out')
        raw = Path(arguments.wrap).read_bytes()
        if b'\r' in raw:
            raise SystemExit('a guarded text must be LF-only')
        wrapped = wrap(raw.decode('ascii'))
        Path(arguments.wrap_out).write_bytes(wrapped.encode('ascii'))
        print('written ' + arguments.wrap_out + ' (' + str(len(wrapped)) + ' chars; guard ' + str(len(guard_text(raw.decode('ascii')))) + ' chars; candidate sha256 ' + hashlib.sha256(raw).hexdigest() + ')')
        return
    outputs, functions, rewritten, pins = build_all(arguments.revert_digest)
    if arguments.syntax:
        syntax_check(outputs, functions)
    if arguments.revert_out:
        Path(arguments.revert_out).write_bytes(outputs[OUT_REVERT].encode('utf-8'))
        print('written ' + arguments.revert_out + ' (' + str(len(outputs[OUT_REVERT])) + ' chars)')
        return
    if arguments.revert_digest != DEV_PRE_DIGEST:
        raise SystemExit('--revert-digest other than the DEV digest is only for --revert-out')
    manifest = manifest_text(outputs)
    if arguments.check:
        for path, built in outputs.items():
            current = Path(path).read_bytes().decode('utf-8') if path.exists() else ''
            if current != built:
                offset = next((i for i, (a, b) in enumerate(zip(built, current)) if a != b), min(len(built), len(current)))
                raise SystemExit('the committed ' + relative(path) + ' differs from the generated one (carriage returns count): generated ' + str(len(built)) + ' chars sha256 '
                                 + hashlib.sha256(built.encode('utf-8')).hexdigest() + ', committed ' + str(len(current)) + ' chars sha256 '
                                 + hashlib.sha256(current.encode('utf-8')).hexdigest() + '; first difference at ' + str(offset))
            print('OK: ' + relative(path) + ' equals the generated file byte for byte (' + str(len(built)) + ' chars, sha256 ' + hashlib.sha256(built.encode('utf-8')).hexdigest() + ')')
        committed = Path(OUT_MANIFEST).read_bytes().decode('utf-8') if OUT_MANIFEST.exists() else ''
        if committed != manifest:
            raise SystemExit('the committed ' + relative(OUT_MANIFEST) + ' differs from the generated manifest: regenerate with `python supabase/proofs/d12/build_d12.py`')
        print('OK: ' + relative(OUT_MANIFEST) + ' equals the generated manifest')
        return
    for path, built in outputs.items():
        path.write_bytes(built.encode('utf-8'))
        print('written ' + relative(path) + ' (' + str(len(built)) + ' chars)')
    OUT_MANIFEST.write_bytes(manifest.encode('utf-8'))
    print('written ' + relative(OUT_MANIFEST))
    for path in (OUT_APPLICATION, OUT_REVERT, OUT_PREFLIGHT, OUT_POSTFLIGHT):
        print('sha256 ' + relative(path) + ' ' + hashlib.sha256(outputs[path].encode('utf-8')).hexdigest())
    print('new function body md5: ' + ', '.join(f['signature'].split('(')[0] + '=' + f['body_md5'] for f in functions))
    print('rewritten body md5: ' + ', '.join(s.split('(')[0] + '=' + r['body_md5'] for s, r in rewritten.items()))
    print('projection sha: ' + ' -> '.join(expected_projection(pins, rewritten)))


if __name__ == '__main__':
    main()
