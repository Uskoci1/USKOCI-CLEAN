#!/usr/bin/env python3
"""Generator for the EX-06 candidate "ex06b" (S06: canonical groups step 1 = the certificate-neutral alias registry, the classification version and the F2 stem fix),
its exact revert, its read-only DEV preflight and postflight, and the integrity-guarded forms of the application and of the revert for BOTH connector transports.

WHAT CHANGES (and nothing else):
  * ONE function body: private.work_kinds_v5(text[]) (PKG-031b, md5 2113eb46...) is replaced IN PLACE (same signature, owner, ACL, SECURITY INVOKER, search_path; SQL IMMUTABLE becomes plpgsql STABLE
    because it now reads data). The eleven owner-approved kind NAMES stay in the body (a twelfth kind is an owner decision and needs a new body, never a data row).
  * TWELVE data rows under NEW keys of private.marketplace_config (precedent: PKG-051a): `work_kinds_head` (the classification version) and `work_kind:<KIND>` for each of the eleven kinds (its word stems).
    The stems are the PKG-031b regular-expression alternatives written as literal substrings, so the behaviour for every Latin text is byte for byte the old one, except the WRITTEN DELTAS:
      - Serbian Cyrillic is transliterated to the same plain Latin letters before matching (the Cyrillic spellings of every stem now work);
      - alias stems for the synonym cases of the S02 corpus: MONTAZA_NAMESTAJA += ikee ikei ikeu ikeom (IKEA declined: "iz ikee"), MOLERSKI_RADOVI += ofarb (dialect "ofarbati");
      - the F2 stem false positive: MONTAZA_NAMESTAJA -= sklapanj (S03 finding F2, corpus case T-031: "Sklapanje maketa" is not furniture work; "sklapanje" also means concluding a contract or a marriage).
No table, column, constraint, trigger, policy or ACL changes and no new function; the certified closure digest does not move (asserted by the application, the proof and the postflight).

THE ONE SOURCE. The predecessor body is read from the PKG-031b candidate, which equals the DEV body (md5 2113eb46..., 1,281 characters, read-only SELECT on canonical DEV 2026-10-02); the byte-exact
capture lives in s06/ex06b_work_kinds_v5_dev_body.txt and both are asserted equal. Its stems are PARSED from it, so the stem table cannot be mistyped. Everything the application, the revert, the
preflight and the postflight must agree on lives in this file.

    python supabase/proofs/ex06/build_ex06b.py                  # write the generated files
    python supabase/proofs/ex06/build_ex06b.py --check          # fail if a committed file differs BYTE FOR BYTE from the generated one
    python supabase/proofs/ex06/build_ex06b.py --diff           # print the old -> new stem table
    python supabase/proofs/ex06/build_ex06b.py --syntax         # parse every generated statement and the plpgsql bodies with the PostgreSQL parser (needs `pip install pglast`)
    python supabase/proofs/ex06/build_ex06b.py --selftest       # the two integrity guards against a model of what each connector sends
    python supabase/proofs/ex06/build_ex06b.py --wrap IN --wrap-out OUT            # the plain one-statement guard (psql -c / execute_sql): guard + text as ONE text
    python supabase/proofs/ex06/build_ex06b.py --wrap-migration IN --wrap-out OUT  # the apply_migration guard (marker based; the connector holds the text twice)

TRANSPORT SAFETY (the D12 findings): the generated SQL is ASCII-only (every non-ASCII character is built from chr()), carries no unicode escape text, no backslash at all, no tab and no carriage return.
Only the two guard lines carry backslashes (regular-expression escapes for a line feed and a carriage return, no unicode escape).
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
PROOFS = ROOT / 'supabase' / 'proofs' / 'ex06'
S06 = PROOFS / 's06'
CANDIDATE = ROOT / 'supabase' / 'candidates' / 'ex06b_alias_registry.sql'
REVERT = ROOT / 'supabase' / 'candidates' / 'ex06b_alias_registry_revert.sql'
PREFLIGHT = PROOFS / 'ex06b_preflight.readonly.sql'
POSTFLIGHT = PROOFS / 'ex06b_postflight.readonly.sql'
GUARDED_DIR = S06 / 'guarded'
GUARDED_PLAIN_APPLY = GUARDED_DIR / 'ex06b_alias_registry.plain_guard.sql'
GUARDED_PLAIN_REVERT = GUARDED_DIR / 'ex06b_alias_registry_revert.plain_guard.sql'
GUARDED_MIGRATION_APPLY = GUARDED_DIR / 'ex06b_alias_registry.apply_migration_guard.sql'
GUARDED_MIGRATION_REVERT = GUARDED_DIR / 'ex06b_alias_registry_revert.apply_migration_guard.sql'
MANIFEST = S06 / 'ex06b_manifest.json'
OLD_BODY_SOURCE = ROOT / 'supabase' / 'candidates' / 'pkg031b_work_kinds_for_matching.sql'
DEV_BODY_FILE = S06 / 'ex06b_work_kinds_v5_dev_body.txt'
GUARD_MAX_BYTES = 125000   # one `psql -c` argument: Linux refuses a single argument above 131072 bytes
LF = chr(10)

TARGET = 'private.work_kinds_v5(text[])'
OLD_MD5 = '2113eb46ab7ea968b873e76d1de12377'
OLD_COMMENT = 'PKG-031b: the hidden kinds of work named by free text (category, skills, exclusions). Used only by matching.'
NEW_COMMENT = ('PKG-031b + EX-06 ex06b: the hidden kinds of work named by free text (category, skills, exclusions); the word stems are data rows work_kind:* of private.marketplace_config '
               '(classification version in work_kinds_head). Used only by matching.')
CLASSIFICATION_VERSION = 'WK-1'
HEAD_KEY = 'work_kinds_head'
KIND_KEY_PREFIX = 'work_kind:'
CONFIG_KEY_PREFIX = 'work_kind'          # the namespace the application refuses to share (work_kinds_head and work_kind:*)
HEAD_SCHEMA = 'WORK_KINDS_HEAD_V1'
KIND_SCHEMA = 'WORK_KIND_V1'
FOLD_VERSION = 'SR_LATIN_CYRILLIC_V1'
MIN_STEM_LENGTH = 4
STEM_PATTERN = '^[a-z][a-z ]*[a-z]$'     # a stem is lower-case ASCII letters and single inner spaces: what the fold produces, so a stem that cannot match is refused by the postflight

# The closed set of the eleven kinds (PKG-031 owner decision, 2026-09-21: "odobravam sve"), in the order of the PKG-031b body. A twelfth kind is an owner decision: it needs a new body, never a data row.
CLOSED_KINDS = ['SELIDBE_PREVOZ', 'FIZICKI_POSLOVI', 'MONTAZA_NAMESTAJA', 'SITNE_POPRAVKE', 'MOLERSKI_RADOVI', 'ELEKTRO', 'VODOINSTALATER', 'CISCENJE', 'PRANJE_PEGLANJE', 'BASTA_DVORISTE', 'DOSTAVA']
# THE WRITTEN DELTAS (everything else is the PKG-031b behaviour). Each added stem has a case in s06/ex06_contract_corpus_v1_1.json (fail before, pass after); the removed one has its F2 case.
STEMS_ADDED = {'MONTAZA_NAMESTAJA': ['ikee', 'ikei', 'ikeu', 'ikeom'], 'MOLERSKI_RADOVI': ['ofarb']}
STEMS_REMOVED = {'MONTAZA_NAMESTAJA': ['sklapanj']}

# The pins (md5 of prosrc, carriage returns removed) read from canonical DEV leqcwgzvjsxugfgzdmth on 2026-10-02 (ledger 221, certificate 0579191d...): the target, the callers and the neighbours the change leans on.
# The two callers are the ONLY functions that name the target (a scan of prosrc over every function of the database, read-only, 2026-10-02: four mentions in each).
CALLERS = ['private.dispatch_cheap_candidate_admitted(uuid,uuid)', 'private.match_detail_without_calendar(uuid,uuid)']
NEIGHBOUR_PINS = [
    ('private.match_detail_without_calendar(uuid,uuid)', 'c8aaf3da761242397243fc56262d1aeb'),      # a caller; ex06a applied 2026-10-02 (was 9180606a...)
    ('private.dispatch_cheap_candidate_admitted(uuid,uuid)', '0132fae38c75947179b4d389edc1e1f0'),  # a caller
    ('private.candidate_profile_ids(uuid,integer)', 'dca4ddc8080a52c8af83c33689c5568e'),
    ('private.dispatch_next_wave(uuid)', '1fd8c51ef026ece24471e2f68250ecc5'),
    ('private.match_detail(uuid,uuid)', '38c7894a8cf43a8f32bd5a30bc2cbd09'),
    ('private.match_detail_for_calendar_interval(uuid,uuid,timestamp with time zone,timestamp with time zone)', '781956cab666befab216b3ce2334ca1d'),
    ('private.worker_dispatch_time_admitted(uuid,uuid)', '4f0beb65922d2b3d947d69e68a56a956'),     # ex06a applied 2026-10-02 (was 5b5f0dee...)
    ('private.lower_arr(text[])', '07f449cf589196cc8ca349b4f5ca460c'),
]
# The functions whose bodies feed the closure certificate (closure_source_digest_v5 and everything it concatenates): none of them may name the target. Read on DEV 2026-10-02: none does.
CERTIFICATE_FUNCTIONS = ['closure_source_digest_v5', 'closure_erasure_program_digest_v5', 'closure_schema_digest_v5_139', 'closure_erasure_binding_v5', 'agreement_invalidation_surface_v1',
                         'agreement_voice_surface_v1', 'retention_ai_source_ready']
CONFIG_COLUMNS = 'key:text:true,value:jsonb:true,updated_at:timestamp with time zone:true'
CONFIG_PK_MD5 = '729d3ed6c85722f863da384d2313331e'   # md5(pg_get_constraintdef) of PRIMARY KEY (key) on private.marketplace_config (the PKG-051a pin, read again on DEV 2026-10-02)
APPLY_MARKER_HEAD = '-- EX-06 ex06b alias registry: '
APPLY_MARKER_TAIL = 'DEV application text.'
REVERT_MARKER_HEAD = '-- EX-06 ex06b alias registry revert: '
REVERT_MARKER_TAIL = 'DEV revert text.'

# ------------------------------------------------------------------------------------------------------------------------------ the fold (the same letters on every side: SQL, the JS oracle, this file)
# Latin diacritics (both cases) as in PKG-031b, then the Serbian Cyrillic alphabet (both cases). One letter becomes one letter; the three Cyrillic digraph letters are replaced first (DIGRAPHS).
LATIN_FOLD = [(0x10D, 'c'), (0x107, 'c'), (0x161, 's'), (0x111, 'd'), (0x17E, 'z'), (0x10C, 'c'), (0x106, 'c'), (0x160, 's'), (0x110, 'd'), (0x17D, 'z')]
CYRILLIC_PAIRS = [(0x410, 0x430, 'a'), (0x411, 0x431, 'b'), (0x412, 0x432, 'v'), (0x413, 0x433, 'g'), (0x414, 0x434, 'd'), (0x402, 0x452, 'd'), (0x415, 0x435, 'e'), (0x416, 0x436, 'z'),
                  (0x417, 0x437, 'z'), (0x418, 0x438, 'i'), (0x408, 0x458, 'j'), (0x41A, 0x43A, 'k'), (0x41B, 0x43B, 'l'), (0x41C, 0x43C, 'm'), (0x41D, 0x43D, 'n'), (0x41E, 0x43E, 'o'),
                  (0x41F, 0x43F, 'p'), (0x420, 0x440, 'r'), (0x421, 0x441, 's'), (0x422, 0x442, 't'), (0x40B, 0x45B, 'c'), (0x423, 0x443, 'u'), (0x424, 0x444, 'f'), (0x425, 0x445, 'h'),
                  (0x426, 0x446, 'c'), (0x427, 0x447, 'c'), (0x428, 0x448, 's')]
DIGRAPHS = [(0x409, 'lj'), (0x459, 'lj'), (0x40A, 'nj'), (0x45A, 'nj'), (0x40F, 'dz'), (0x45F, 'dz')]
FOLD_SOURCE = [code for code, _ in LATIN_FOLD] + [code for upper, lower, _ in CYRILLIC_PAIRS for code in (upper, lower)]
FOLD_TARGET = ''.join(letter for _, letter in LATIN_FOLD) + ''.join(letter * 2 for _, _, letter in CYRILLIC_PAIRS)
OLD_FOLD_FROM_CODES = [0x10D, 0x107, 0x161, 0x111, 0x17E, 0x10C, 0x106, 0x160, 0x110, 0x17D]   # the PKG-031b literal: c-acute-caron s d z lower case, then upper case
OLD_FOLD_FROM = ''.join(chr(code) for code in OLD_FOLD_FROM_CODES)
assert len(FOLD_SOURCE) == len(FOLD_TARGET) == len(set(FOLD_SOURCE)) == 10 + 54
assert len(CYRILLIC_PAIRS) + len(DIGRAPHS) // 2 == 30   # 27 letters in pairs + 3 digraph letters = the 30 letters of the Serbian Cyrillic alphabet
assert all("'" not in c and chr(92) not in c and all(ord(ch) < 128 for ch in c) for c in (OLD_COMMENT, NEW_COMMENT))


def md5(text):
    return hashlib.md5(text.replace('\r\n', '\n').encode('utf-8')).hexdigest()


def sha256(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def read_lf(path):
    return io.open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')


def relative(path):
    return str(Path(path).relative_to(ROOT)).replace(chr(92), '/')


def chr_expr(code_points):
    """chr(269)||chr(263)||...: the SQL text for a string of non-ASCII characters (the generated SQL is ASCII-only)."""
    return '||'.join('chr(%d)' % code for code in code_points)


def lit(value):
    """The SQL expression for a Python string: a quoted literal when it is ASCII, otherwise ASCII runs and chr() calls joined with ||."""
    if all(ord(c) < 128 for c in value):
        assert "'" not in value and chr(92) not in value
        return "'" + value + "'"
    parts, run = [], ''
    for c in value:
        if ord(c) < 128:
            run += c
        else:
            if run:
                parts.append("'" + run + "'")
                run = ''
            parts.append('chr(%d)' % ord(c))
    if run:
        parts.append("'" + run + "'")
    return '(' + '||'.join(parts) + ')'


def text_array(values):
    """array[...]::text[] (NULL elements allowed), the SQL for a probe input; None is a NULL array."""
    if values is None:
        return 'null::text[]'
    if not values:
        return "'{}'::text[]"
    return 'array[' + ', '.join('null' if v is None else lit(v) for v in values) + ']::text[]'


# ------------------------------------------------------------------------------------------------------------------------------ the predecessor and the stem table
def old_body():
    text = read_lf(OLD_BODY_SOURCE)
    start_marker = 'create function private.work_kinds_v5'
    at = text.index(start_marker)
    tag = '$function$'
    start = text.index(tag, at) + len(tag)
    body = text[start:text.index(tag, start)]
    assert md5(body) == OLD_MD5, 'the PKG-031b text is not the DEV predecessor body: ' + md5(body)
    dev = read_lf(DEV_BODY_FILE)
    assert dev == body, 'the byte-exact DEV capture differs from the PKG-031b text'
    assert len(body) == 1281 and len(body.encode('utf-8')) == 1291, 'the DEV body is 1281 characters (1291 octets)'
    return body


OLD_BODY = old_body()
CASE_RE = re.compile(r"case when t ~ '\(([^']+)\)' then '([A-Z_]+)' end")


def parse_old_stems(body):
    """The kinds and their literal stems, parsed from the PKG-031b body (a regex alternative `labou?r` is the two literals labor and labour)."""
    found = {}
    for alternatives, kind in CASE_RE.findall(body):
        stems = []
        for alt in alternatives.split('|'):
            stems.extend(['labor', 'labour'] if alt == 'labou?r' else [alt])
        assert all(re.fullmatch(r'[a-z ]+', stem) for stem in stems), alternatives
        found[kind] = stems
    assert list(found) == CLOSED_KINDS, 'the PKG-031b body names another kind list: ' + str(list(found))
    return found


OLD_STEMS = parse_old_stems(OLD_BODY)
OLD_REGEXES = {kind: alternatives for alternatives, kind in CASE_RE.findall(OLD_BODY)}


def new_stems():
    out = {}
    for kind in CLOSED_KINDS:
        stems = [s for s in OLD_STEMS[kind] if s not in STEMS_REMOVED.get(kind, [])]
        assert len(stems) == len(OLD_STEMS[kind]) - len(STEMS_REMOVED.get(kind, [])), 'a removed stem is not an old stem: ' + kind
        for stem in STEMS_ADDED.get(kind, []):
            assert stem not in stems and re.fullmatch(STEM_PATTERN, stem) and len(stem) >= MIN_STEM_LENGTH, stem
            stems.append(stem)
        assert len(set(stems)) == len(stems) and all(len(s) >= MIN_STEM_LENGTH and re.fullmatch(STEM_PATTERN, s) for s in stems), kind
        out[kind] = stems
    assert set(STEMS_ADDED) <= set(CLOSED_KINDS) and set(STEMS_REMOVED) <= set(CLOSED_KINDS)
    return out


NEW_STEMS = new_stems()


def registry_rows():
    """The twelve data rows: [(key, value dict)]. The head carries the classification version; each kind row carries its literal stems."""
    head = {'schema': HEAD_SCHEMA, 'classificationVersion': CLASSIFICATION_VERSION, 'kinds': CLOSED_KINDS, 'foldVersion': FOLD_VERSION,
            'previous': 'PKG-031b hard-coded regular expressions, body md5 ' + OLD_MD5, 'package': 'EX-06 ex06b'}
    rows = [(HEAD_KEY, head)]
    for kind in CLOSED_KINDS:
        rows.append((KIND_KEY_PREFIX + kind, {'schema': KIND_SCHEMA, 'kind': kind, 'stems': NEW_STEMS[kind]}))
    return rows


def registry_text():
    lines = ['[']
    rows = registry_rows()
    for i, (key, value) in enumerate(rows):
        lines.append('  ' + json.dumps({'key': key, 'value': value}, ensure_ascii=True, separators=(', ', ': ')) + (',' if i < len(rows) - 1 else ''))
    lines.append(']')
    text = LF.join(lines)
    assert all(ord(c) < 128 for c in text) and '$' not in text and chr(92) not in text and "'" not in text
    return text


# ------------------------------------------------------------------------------------------------------------------------------ the model of the classification (the independent Python oracle; the JS oracle in ex06b_lib.mjs is the second one)
def fold(text):
    t = text.strip(' ')
    for code, letters in DIGRAPHS:
        t = t.replace(chr(code), letters)
    table = {code: ord(target) for code, target in zip(FOLD_SOURCE, FOLD_TARGET)}
    return t.translate(table).lower()


def kinds_of(values, stems=None):
    stems = stems or NEW_STEMS
    folded = [fold(v) for v in (values or []) if v is not None]
    return sorted({kind for kind in CLOSED_KINDS for stem in stems[kind] if len(stem) >= MIN_STEM_LENGTH and any(stem in t for t in folded)})


def old_kinds_of(values):
    """The PKG-031b function: lower, then translate the ten Latin letters, then the regular expressions (checked against the stem table by the tests)."""
    out = set()
    for value in values or []:
        if value is None:
            continue
        t = value.strip(' ').lower()
        t = t.translate({code: ord(letter) for code, letter in LATIN_FOLD})
        for kind in CLOSED_KINDS:
            if re.search('(' + OLD_REGEXES[kind] + ')', t):
                out.add(kind)
    return sorted(out)


# The smoke probes the application asserts on the live function right after the replacement (and the postflight asserts in every state): (values, expected kinds). All expectations come from kinds_of() here
# and from the independent oracle of ex06b_lib.mjs in the offline tests. The two contested kinds ELEKTRO and VODOINSTALATER carry over unchanged and have no probe of their own.
SMOKE_PROBES = [
    (['Čišćenje stana'], ['CISCENJE']),
    (['Чишћење стана'], ['CISCENJE']),
    (['Кречење', 'Фарбање'], ['MOLERSKI_RADOVI']),
    (['Sklapanje maketa'], []),
    (['sklapanje IKEA nameštaja'], ['MONTAZA_NAMESTAJA']),
    (['ormari iz ikee'], ['MONTAZA_NAMESTAJA']),
    (['ikee'], ['MONTAZA_NAMESTAJA']),
    (['ofarba sobu'], ['MOLERSKI_RADOVI']),
    (['Ciscenje stana', 'Peglanje'], ['CISCENJE', 'PRANJE_PEGLANJE']),
    (['transport_selidbe'], ['SELIDBE_PREVOZ']),
    (['dresura pasa'], []),
    (['nešto sasvim drugo', None, ''], []),
    ([], []),
    (None, []),
]
for _values, _expected in SMOKE_PROBES:
    assert kinds_of(_values) == _expected, (_values, kinds_of(_values), _expected)


# ------------------------------------------------------------------------------------------------------------------------------ the new body
CLOSED_ARRAY = 'array[' + ', '.join("'%s'" % kind for kind in CLOSED_KINDS) + ']'
DIGRAPH_OPEN = 'replace(' * len(DIGRAPHS)
DIGRAPH_CLOSE = ''.join(", chr(%d), '%s')" % (code, letters) for code, letters in DIGRAPHS)
REG_PREFIX_FROM = str(len(KIND_KEY_PREFIX) + 1)


def chr_lines(code_points, per_line=8, indent='    '):
    chunks = [code_points[i:i + per_line] for i in range(0, len(code_points), per_line)]
    return ('||' + LF + indent).join(chr_expr(chunk) for chunk in chunks)


def new_body():
    body = (
        "declare\n"
        "  closed constant text[] := " + CLOSED_ARRAY + ";\n"
        "  fold_from constant text :=\n    " + chr_lines(FOLD_SOURCE) + ";\n"
        "  fold_to constant text := '" + FOLD_TARGET + "';\n"
        "  folded text[];\n"
        "begin\n"
        "  -- EX-06 ex06b (S06). The hidden kinds of work (PKG-031b): a closed set of ELEVEN kinds recognised by word stems. The NAMES of the kinds are fixed HERE (a twelfth kind is an owner decision and\n"
        "  -- needs a new body, never a data row); the STEMS are data: private.marketplace_config rows work_kind:<KIND> (a JSON array of literal lower-case substrings, at least 4 letters) and the\n"
        "  -- classification version in the row work_kinds_head. Each value is folded first: lower case, Serbian Latin diacritics and the Serbian Cyrillic alphabet to plain Latin letters (the three\n"
        "  -- Cyrillic digraph letters first), so one Latin stem serves every spelling. A kind is named when a stem occurs inside ONE value (never across two values). Text that names no kind returns\n"
        "  -- nothing, so an unknown word never matches another unknown word. A registry that is not exactly the head row and the eleven kind rows is refused loudly, never half used; an extra\n"
        "  -- row work_kind:<anything else> is ignored, so no data row can ever add a kind.\n"
        "  if p_values is null or cardinality(p_values) = 0 then return '{}'::text[]; end if;\n"
        "  if not exists(select 1 from private.marketplace_config c\n"
        "                 where c.key = '" + HEAD_KEY + "' and c.value ->> 'schema' = '" + HEAD_SCHEMA + "'\n"
        "                   and c.value -> 'kinds' = to_jsonb(closed) and c.value ->> 'foldVersion' = '" + FOLD_VERSION + "')\n"
        "     or (select count(*) from private.marketplace_config c\n"
        "          where starts_with(c.key, '" + KIND_KEY_PREFIX + "') and substr(c.key, " + REG_PREFIX_FROM + ") = any(closed)\n"
        "            and c.value ->> 'schema' = '" + KIND_SCHEMA + "' and c.value ->> 'kind' = substr(c.key, " + REG_PREFIX_FROM + ")\n"
        "            and jsonb_typeof(c.value -> 'stems') = 'array') <> cardinality(closed) then\n"
        "    raise exception 'WORK_KINDS_REGISTRY_INVALID' using errcode = '55000';\n"
        "  end if;\n"
        "  select coalesce(array_agg(lower(translate(" + DIGRAPH_OPEN + "btrim(v)" + DIGRAPH_CLOSE + ", fold_from, fold_to))), '{}'::text[]) into folded\n"
        "    from unnest(p_values) v where v is not null;\n"
        "  return coalesce((\n"
        "    select array_agg(distinct r.kind order by r.kind)\n"
        "      from (select substr(c.key, " + REG_PREFIX_FROM + ") as kind, c.value -> 'stems' as stems\n"
        "              from private.marketplace_config c\n"
        "             where starts_with(c.key, '" + KIND_KEY_PREFIX + "') and substr(c.key, " + REG_PREFIX_FROM + ") = any(closed)) r\n"
        "     cross join lateral jsonb_array_elements_text(r.stems) s(stem)\n"
        "     where length(s.stem) >= " + str(MIN_STEM_LENGTH) + " and exists(select 1 from unnest(folded) t where strpos(t, s.stem) > 0)\n"
        "  ), '{}'::text[]);\n"
        "end;\n")
    assert all(ord(c) < 128 for c in body) and '$' not in body and chr(92) not in body and '\r' not in body and '\t' not in body
    return '\n' + body


NEW_BODY = new_body()
NEW_MD5 = md5(NEW_BODY)
NEW_HEAD = "create or replace function private.work_kinds_v5(p_values text[]) returns text[] language plpgsql stable parallel safe set search_path to 'pg_catalog' as "
OLD_HEAD = "create or replace function private.work_kinds_v5(p_values text[]) returns text[] language sql immutable parallel safe set search_path to 'pg_catalog' as "
OLD_FOLD_MARKER = '#OLD_FOLD_FROM#'
OLD_BODY_TEMPLATE = OLD_BODY.replace(OLD_FOLD_FROM, OLD_FOLD_MARKER)
assert OLD_BODY_TEMPLATE.count(OLD_FOLD_MARKER) == 1 and all(ord(c) < 128 for c in OLD_BODY_TEMPLATE) and '$' not in OLD_BODY_TEMPLATE and chr(92) not in OLD_BODY_TEMPLATE
assert md5(OLD_BODY_TEMPLATE.replace(OLD_FOLD_MARKER, OLD_FOLD_FROM)) == OLD_MD5
OLD_FOLD_EXPR = chr_expr(OLD_FOLD_FROM_CODES)


# ------------------------------------------------------------------------------------------------------------------------------ the shared text pieces
def pin_rows(pins, indent='    '):
    return ',\n'.join(indent + "('%s','%s')" % pin for pin in pins)


def smoke_rows(indent='    '):
    return ',\n'.join(indent + '(' + text_array(values) + ', ' + text_array(expected) + ')' for values, expected in SMOKE_PROBES)


ATTRIBUTES_OLD = ("not p.prosecdef and p.provolatile = 'i' and p.proparallel = 's' and not p.proisstrict and not p.proleakproof and p.proconfig = array['search_path=pg_catalog']\n"
                  "      and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}' and p.prokind = 'f' and p.prorettype = 'text[]'::regtype and not p.proretset\n"
                  "      and p.pronargs = 1 and p.proargnames = array['p_values'] and p.prolang = (select oid from pg_language where lanname = 'sql')\n"
                  "      and obj_description(p.oid, 'pg_proc') = %s")
ATTRIBUTES_NEW = ("not p.prosecdef and p.provolatile = 's' and p.proparallel = 's' and not p.proisstrict and not p.proleakproof and p.proconfig = array['search_path=pg_catalog']\n"
                  "      and p.proowner = 'postgres'::regrole and p.proacl::text = '{postgres=X/postgres}' and p.prokind = 'f' and p.prorettype = 'text[]'::regtype and not p.proretset\n"
                  "      and p.pronargs = 1 and p.proargnames = array['p_values'] and p.prolang = (select oid from pg_language where lanname = 'plpgsql')\n"
                  "      and obj_description(p.oid, 'pg_proc') = %s")
CERT_FUNCTIONS_SQL = ', '.join("'%s'" % name for name in CERTIFICATE_FUNCTIONS)
CONFIG_SHAPE_TEST = ("(select string_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)\n"
                     "        from pg_attribute a where a.attrelid = 'private.marketplace_config'::regclass and a.attnum > 0 and not a.attisdropped) is distinct from '" + CONFIG_COLUMNS + "'\n"
                     "     or (select count(*) from pg_constraint x where x.conrelid = 'private.marketplace_config'::regclass and x.contype <> 'n') <> 1\n"
                     "     or (select md5(pg_get_constraintdef(x.oid)) from pg_constraint x where x.conrelid = 'private.marketplace_config'::regclass and x.contype = 'p') is distinct from '" + CONFIG_PK_MD5 + "'\n"
                     "     or exists(select 1 from pg_trigger t where t.tgrelid = 'private.marketplace_config'::regclass and not t.tgisinternal)\n"
                     "     or exists(select 1 from pg_rewrite r where r.ev_class = 'private.marketplace_config'::regclass)")
CONFIG_FINGERPRINT = ("md5(coalesce(string_agg(c.key || chr(31) || c.value::text || chr(31) || c.updated_at::text, chr(30) order by c.key), ''))")
REGISTRY_STEM_TEST = ("exists(select 1 from jsonb_array_elements(%s) r(item),\n"
                      "           jsonb_array_elements(case when jsonb_typeof(r.item -> 'value' -> 'stems') = 'array' then r.item -> 'value' -> 'stems' else '[]'::jsonb end) e(stem)\n"
                      "         where jsonb_typeof(e.stem) <> 'string' or (e.stem #>> '{}') !~ '" + STEM_PATTERN + "' or length(e.stem #>> '{}') < " + str(MIN_STEM_LENGTH) + ")")


def substitute(text, extra=None):
    values = {'@TARGET@': TARGET, '@OLD_MD5@': OLD_MD5, '@NEW_MD5@': NEW_MD5, '@OLD_COMMENT@': OLD_COMMENT, '@NEW_COMMENT@': NEW_COMMENT, '@CONFIG_PK_MD5@': CONFIG_PK_MD5,
              '@NEIGHBOUR_PINS@': pin_rows(NEIGHBOUR_PINS), '@CERTIFICATE_FUNCTIONS@': CERT_FUNCTIONS_SQL, '@NEW_HEAD@': NEW_HEAD, '@OLD_HEAD@': OLD_HEAD,
              '@SMOKE_ROWS@': smoke_rows(), '@CONFIG_SHAPE_TEST@': CONFIG_SHAPE_TEST, '@CONFIG_FINGERPRINT@': CONFIG_FINGERPRINT, '@CONFIG_KEY_PREFIX@': CONFIG_KEY_PREFIX,
              '@APPLY_MARKER@': APPLY_MARKER_HEAD + APPLY_MARKER_TAIL, '@REVERT_MARKER@': REVERT_MARKER_HEAD + REVERT_MARKER_TAIL,
              '@CLASSIFICATION_VERSION@': CLASSIFICATION_VERSION, '@OLD_FOLD_MARKER@': OLD_FOLD_MARKER, '@OLD_FOLD_EXPR@': OLD_FOLD_EXPR, '@STEM_PATTERN@': STEM_PATTERN,
              '@ATTRIBUTES_OLD@': ATTRIBUTES_OLD % 'old_comment', '@ATTRIBUTES_NEW@': ATTRIBUTES_NEW % 'new_comment', '@HEAD_KEY@': HEAD_KEY, '@HEAD_SCHEMA@': HEAD_SCHEMA,
              '@KIND_SCHEMA@': KIND_SCHEMA, '@FOLD_VERSION@': FOLD_VERSION, '@KIND_KEY_PREFIX@': KIND_KEY_PREFIX, '@CLOSED_ARRAY@': CLOSED_ARRAY, '@MIN_STEM_LENGTH@': str(MIN_STEM_LENGTH),
              '@REG_PREFIX_FROM@': REG_PREFIX_FROM, '@REGISTRY_STEM_TEST_REGISTRY@': REGISTRY_STEM_TEST % 'registry'}
    values.update(extra or {})
    for key, value in values.items():
        text = text.replace(key, value)
    return text


# ------------------------------------------------------------------------------------------------------------------------------ the application
def candidate_text():
    return substitute("""@APPLY_MARKER@ NOT APPLIED to DEV: it needs the owner's explicit "PRIMENI EX-06 ex06b".
-- GENERATED by supabase/proofs/ex06/build_ex06b.py: do not edit by hand (`--check` fails on any difference). The file is LF text (.gitattributes): a carriage return in it is refused (EX06B_CRLF_TEXT).
-- S06 of EX-06 (canonical groups, step 1). ONE function body completed IN PLACE and TWELVE data rows; nothing else.
--   1. private.work_kinds_v5(text[]) (PKG-031b, md5 @OLD_MD5@): same signature, owner, ACL, SECURITY INVOKER, search_path; SQL IMMUTABLE becomes plpgsql STABLE because it now reads data.
--      The names of the eleven owner-approved kinds stay in the body (a twelfth kind is an owner decision and needs a new body, never a data row).
--   2. private.marketplace_config: NEW keys work_kinds_head (the classification version @CLASSIFICATION_VERSION@) and work_kind:<KIND> for each of the eleven kinds (a JSON array of word stems). Precedent: PKG-051a.
--      The stems are the PKG-031b regular-expression alternatives as literal substrings, so every Latin text classifies exactly as before except the written deltas:
--        Serbian Cyrillic is transliterated to plain Latin letters before matching; MONTAZA_NAMESTAJA += ikee ikei ikeu ikeom; MOLERSKI_RADOVI += ofarb; MONTAZA_NAMESTAJA -= sklapanj (S03 finding F2).
-- Function plus data only: no table, column, constraint, trigger, policy or ACL change, no new function. Certificate-neutral: the function is not in the closure digest list (88 signatures), in the program digest or
-- in any function the digest concatenates, it is not a trigger function, and a data row is not part of any digest; the digest is asserted unchanged and ready before and after.
-- One atomic DO statement: exact DEV predecessor pins (the target and eight neighbours, both callers included), exact target attributes, the exact shape of private.marketplace_config, the twelve keys absent
-- (the insert has no ON CONFLICT: a present key refuses), certificate ready, then the changes, the smoke probes on the live function, and delta accounting (exactly one function changed, nothing new or gone,
-- every pre-existing config row untouched, exactly twelve rows added, no EXECUTE for anon/authenticated/service_role). A conflict, were one raised, would use PT409 (none is).
do $ex06b$
declare
  target_signature constant text := '@TARGET@';
  old_md5 constant text := '@OLD_MD5@';
  new_md5 constant text := '@NEW_MD5@';
  old_comment constant text := '@OLD_COMMENT@';
  new_comment constant text := '@NEW_COMMENT@';
  new_body constant text := $new_body$@NEW_BODY@$new_body$;
  registry_text constant text := $registry$@REGISTRY@$registry$;
  registry jsonb; pin record; prior record; probe record; actual jsonb;
  digest_before text; config_before text; config_after text; config_acl_before text;
  target_oid oid; fresh oid[]; inserted integer; got text[];
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX06B_OWNER_REQUIRED' using errcode = '55000'; end if;
  -- The bytes this statement carries are the bytes the proof ran: a carriage return (a CRLF checkout, a clipboard) is refused, never silently applied.
  if position(chr(13) in new_body) > 0 or position(chr(13) in registry_text) > 0 then
    raise exception 'EX06B_CRLF_TEXT' using errcode = '55000';
  end if;
  registry := registry_text::jsonb;
  if jsonb_typeof(registry) <> 'array' or jsonb_array_length(registry) <> 12 or @REGISTRY_STEM_TEST_REGISTRY@ then
    raise exception 'EX06B_REGISTRY_TEXT_INVALID' using errcode = '55000';
  end if;
  target_oid := to_regprocedure(target_signature)::oid;
  if target_oid is null then raise exception 'EX06B_TARGET_MISSING' using errcode = '55000'; end if;
  if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = target_oid) = new_md5
     and exists(select 1 from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@')) then
    raise exception 'EX06B_ALREADY_APPLIED' using errcode = '55000';
  end if;
  -- The predecessor, exactly: the target and the neighbours the change depends on (both callers of the target among them).
  for pin in select * from (values
    ('@TARGET@','@OLD_MD5@'),
@NEIGHBOUR_PINS@
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise exception 'EX06B_PREDECESSOR_DRIFT: %', pin.signature using errcode = '55000';
    end if;
  end loop;
  if not exists(select 1 from pg_proc p where p.oid = target_oid
      and @ATTRIBUTES_OLD@) then
    raise exception 'EX06B_TARGET_ATTRIBUTE_DRIFT: %', target_signature using errcode = '55000';
  end if;
  -- The config table is exactly the three-column, triggerless, ruleless table the insert assumes, and nobody holds the keys this package writes.
  if @CONFIG_SHAPE_TEST@ then
    raise exception 'EX06B_CONFIG_TABLE_DRIFT' using errcode = '55000';
  end if;
  if exists(select 1 from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@')) then
    raise exception 'EX06B_CONFIG_KEY_CONFLICT' using errcode = '55000';
  end if;
  -- Certificate-neutral, by the catalog and not by promise: the target is not a trigger function and no function of the closure digest names it.
  if exists(select 1 from pg_trigger where tgfoid = target_oid)
     or exists(select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname in (@CERTIFICATE_FUNCTIONS@)
       and position('work_kinds_v5' in p.prosrc) > 0) then
    raise exception 'EX06B_TARGET_IS_CERTIFIED' using errcode = '55000';
  end if;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06B_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex06b_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');
  select @CONFIG_FINGERPRINT@ into config_before from private.marketplace_config c;
  select c.relacl::text into config_acl_before from pg_class c where c.oid = 'private.marketplace_config'::regclass;

  -- Change 1: the twelve data rows (a plain insert: no ON CONFLICT, a present key refused above and by the primary key).
  insert into private.marketplace_config(key, value)
    select r.item ->> 'key', r.item -> 'value' from jsonb_array_elements(registry) r(item);
  get diagnostics inserted = row_count;
  if inserted <> 12 then raise exception 'EX06B_REGISTRY_INSERT_COUNT: %', inserted using errcode = '55000'; end if;
  -- Change 2: the body of the target, in place (same signature, owner, ACL), and its comment.
  execute format($c$@NEW_HEAD@%L$c$, new_body);
  execute format('comment on function %s is %L', target_signature, new_comment);

  -- The live function answers as written (the smoke probes: the proof and the postflight repeat them).
  for probe in select * from (values
@SMOKE_ROWS@
  ) s(probe_input, probe_expected) loop
    got := private.work_kinds_v5(probe.probe_input);
    if got is distinct from probe.probe_expected then
      raise exception 'EX06B_SMOKE_PROBE_FAILED: % gave %', probe.probe_input, got using errcode = '55000';
    end if;
  end loop;

  -- Delta accounting: the certificate did not move, exactly the target changed (body, language, volatility; nothing else), nothing is new, nothing is gone, the data is exactly the twelve rows.
  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06B_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex06b_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX06B_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid = target_oid then
      if (actual - 'prosrc' - 'prolang' - 'provolatile') is distinct from (prior.metadata - 'prosrc' - 'prolang' - 'provolatile') then
        raise exception 'EX06B_TARGET_ATTRIBUTE_DELTA: %', prior.signature using errcode = '55000';
      end if;
      if actual ->> 'prosrc' is distinct from new_body or md5(replace(prior.metadata ->> 'prosrc', chr(13), '')) is distinct from old_md5
         or md5(replace(actual ->> 'prosrc', chr(13), '')) is distinct from new_md5 or actual ->> 'provolatile' <> 's'
         or actual ->> 'prolang' is distinct from (select oid::text from pg_language where lanname = 'plpgsql') then
        raise exception 'EX06B_TARGET_BODY_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX06B_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex06b_functions f where f.oid = p.oid);
  if fresh is distinct from '{}'::oid[] then
    raise exception 'EX06B_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = target_oid
      and @ATTRIBUTES_NEW@) then
    raise exception 'EX06B_TARGET_ATTRIBUTE_DELTA: %', target_signature using errcode = '55000';
  end if;
  if (select count(*) from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@')) <> 12
     or exists(select 1 from jsonb_array_elements(registry) r(item)
                where not exists(select 1 from private.marketplace_config c where c.key = r.item ->> 'key' and c.value = r.item -> 'value')) then
    raise exception 'EX06B_REGISTRY_MISMATCH' using errcode = '55000';
  end if;
  select @CONFIG_FINGERPRINT@ into config_after from private.marketplace_config c where not starts_with(c.key, '@CONFIG_KEY_PREFIX@');
  if config_after is distinct from config_before then
    raise exception 'EX06B_CONFIG_ROWS_CHANGED' using errcode = '55000';
  end if;
  if (select c.relacl::text from pg_class c where c.oid = 'private.marketplace_config'::regclass) is distinct from config_acl_before then
    raise exception 'EX06B_CONFIG_ACL_CHANGED' using errcode = '55000';
  end if;
  if has_function_privilege('anon', target_signature, 'EXECUTE') or has_function_privilege('authenticated', target_signature, 'EXECUTE')
     or has_function_privilege('service_role', target_signature, 'EXECUTE') then
    raise exception 'EX06B_AUTHORITY_CHANGED' using errcode = '55000';
  end if;
end
$ex06b$;
""", {'@NEW_BODY@': NEW_BODY, '@REGISTRY@': registry_text()})


# ------------------------------------------------------------------------------------------------------------------------------ the revert
def revert_text():
    return substitute("""@REVERT_MARKER@ NOT APPLIED. It needs its own explicit "primeni".
-- GENERATED by supabase/proofs/ex06/build_ex06b.py: do not edit by hand (`--check` fails on any difference). The file is LF text (.gitattributes): a carriage return in it is refused (EX06B_REVERT_CRLF_TEXT).
-- The exact inverse of ex06b_alias_registry.sql. It restores the PKG-031b body of private.work_kinds_v5 byte for byte (md5 @OLD_MD5@, language sql, immutable) and its comment, and removes the twelve data rows.
-- It refuses unless the function is exactly what the application produced AND the twelve rows are exactly the shipped ones (an alias added or a version bumped since the application is a state this text
-- cannot restore: it refuses, so no edit is destroyed unseen; save the rows and generate a revert for them first). The certificate is asserted ready and unchanged; exactly this function changes; the
-- neighbour functions are NOT conditions of the revert (a later package may legitimately change one): a changed neighbour is only reported with a NOTICE.
do $ex06b_revert$
declare
  target_signature constant text := '@TARGET@';
  old_md5 constant text := '@OLD_MD5@';
  new_md5 constant text := '@NEW_MD5@';
  old_comment constant text := '@OLD_COMMENT@';
  new_comment constant text := '@NEW_COMMENT@';
  new_body constant text := $new_body$@NEW_BODY@$new_body$;
  old_body_template constant text := $old_body_template$@OLD_BODY_TEMPLATE@$old_body_template$;
  registry_text constant text := $registry$@REGISTRY@$registry$;
  old_body text; registry jsonb; pin record; prior record; actual jsonb;
  digest_before text; config_rest_before text; config_rest_after text; config_acl_before text; target_oid oid; fresh oid[]; deleted integer;
begin
  perform set_config('lock_timeout', '5s', true);
  perform set_config('statement_timeout', '60s', true);
  perform set_config('search_path', 'pg_catalog', true);
  if current_user <> 'postgres' then raise exception 'EX06B_REVERT_OWNER_REQUIRED' using errcode = '55000'; end if;
  if position(chr(13) in new_body) > 0 or position(chr(13) in old_body_template) > 0 or position(chr(13) in registry_text) > 0 then
    raise exception 'EX06B_REVERT_CRLF_TEXT' using errcode = '55000';
  end if;
  old_body := replace(old_body_template, '@OLD_FOLD_MARKER@', @OLD_FOLD_EXPR@);
  if md5(old_body) is distinct from old_md5 then raise exception 'EX06B_REVERT_OLD_BODY_NOT_THE_PREDECESSOR' using errcode = '55000'; end if;
  registry := registry_text::jsonb;
  target_oid := to_regprocedure(target_signature)::oid;
  if target_oid is null
     or (select prosrc from pg_proc where oid = target_oid) is distinct from new_body
     or (select count(*) from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@')) <> 12
     or exists(select 1 from jsonb_array_elements(registry) r(item)
                where not exists(select 1 from private.marketplace_config c where c.key = r.item ->> 'key' and c.value = r.item -> 'value')) then
    raise exception 'EX06B_REVERT_STATE_NOT_THE_APPLIED_ONE' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = target_oid
      and @ATTRIBUTES_NEW@) then
    raise exception 'EX06B_REVERT_TARGET_ATTRIBUTE_DRIFT: %', target_signature using errcode = '55000';
  end if;
  -- Informational only: a neighbour that is not the pinned DEV predecessor does not stop the revert (the target, the registry and the certificate decide).
  for pin in select * from (values
@NEIGHBOUR_PINS@
  ) p(signature, body_md5) loop
    if (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(pin.signature)) is distinct from pin.body_md5 then
      raise notice 'EX06B_REVERT_NEIGHBOUR_CHANGED: %', pin.signature;
    end if;
  end loop;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'EX06B_REVERT_CLOSURE_NOT_READY' using errcode = '55000';
  end if;
  digest_before := private.closure_source_digest_v5();
  create temporary table ex06b_revert_functions on commit drop as
    select p.oid, p.oid::regprocedure::text signature, to_jsonb(p) metadata
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private');
  select @CONFIG_FINGERPRINT@ into config_rest_before from private.marketplace_config c where not starts_with(c.key, '@CONFIG_KEY_PREFIX@');
  select c.relacl::text into config_acl_before from pg_class c where c.oid = 'private.marketplace_config'::regclass;

  execute format($c$@OLD_HEAD@%L$c$, old_body);
  execute format('comment on function %s is %L', target_signature, old_comment);
  delete from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@');
  get diagnostics deleted = row_count;
  if deleted <> 12 then raise exception 'EX06B_REVERT_DELETE_COUNT: %', deleted using errcode = '55000'; end if;

  if private.closure_source_digest_v5() is distinct from digest_before or private.retention_ai_source_ready() is distinct from true then
    raise exception 'EX06B_REVERT_CLOSURE_MOVED' using errcode = '55000';
  end if;
  for prior in select * from ex06b_revert_functions loop
    select to_jsonb(p) into actual from pg_proc p where p.oid = prior.oid;
    if actual is null then raise exception 'EX06B_REVERT_FUNCTION_REMOVED: %', prior.signature using errcode = '55000'; end if;
    if prior.oid = target_oid then
      if (actual - 'prosrc' - 'prolang' - 'provolatile') is distinct from (prior.metadata - 'prosrc' - 'prolang' - 'provolatile')
         or actual ->> 'prosrc' is distinct from old_body or md5(replace(actual ->> 'prosrc', chr(13), '')) is distinct from old_md5 or actual ->> 'provolatile' <> 'i'
         or actual ->> 'prolang' is distinct from (select oid::text from pg_language where lanname = 'sql') then
        raise exception 'EX06B_REVERT_TARGET_MISMATCH: %', prior.signature using errcode = '55000';
      end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'EX06B_REVERT_UNRELATED_FUNCTION_DELTA: %', prior.signature using errcode = '55000';
    end if;
  end loop;
  select coalesce(array_agg(p.oid order by p.oid), '{}'::oid[]) into fresh
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private', 'rls_private') and not exists(select 1 from ex06b_revert_functions f where f.oid = p.oid);
  if fresh is distinct from '{}'::oid[] then
    raise exception 'EX06B_REVERT_FUNCTION_ROSTER_DELTA' using errcode = '55000';
  end if;
  select @CONFIG_FINGERPRINT@ into config_rest_after from private.marketplace_config c;
  if config_rest_after is distinct from config_rest_before
     or exists(select 1 from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@'))
     or (select c.relacl::text from pg_class c where c.oid = 'private.marketplace_config'::regclass) is distinct from config_acl_before then
    raise exception 'EX06B_REVERT_CONFIG_NOT_RESTORED' using errcode = '55000';
  end if;
  if not exists(select 1 from pg_proc p where p.oid = target_oid
      and @ATTRIBUTES_OLD@) then
    raise exception 'EX06B_REVERT_POSTCONDITION' using errcode = '55000';
  end if;
end
$ex06b_revert$;
""", {'@NEW_BODY@': NEW_BODY, '@OLD_BODY_TEMPLATE@': OLD_BODY_TEMPLATE, '@REGISTRY@': registry_text()})


# ------------------------------------------------------------------------------------------------------------------------------ the read-only preflight and postflight
def preflight_text():
    return substitute("""-- EX-06 ex06b DEV PREFLIGHT. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right before the application.
-- GENERATED by supabase/proofs/ex06/build_ex06b.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON. "problems": every part of the predecessor state that does not hold (an empty array means the application may run); "facts": what a human reads before saying "primeni".
with
  pins(signature, body_md5) as (values
    ('@TARGET@','@OLD_MD5@'),
@NEIGHBOUR_PINS@
  ),
  target as (select p.oid from pg_proc p where p.oid = to_regprocedure('@TARGET@')),
  problems as (
    select 'PIN_DRIFT' as kind, p.signature as detail
    from pins p
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(p.signature)) is distinct from p.body_md5
    union all
    select 'TARGET_ATTRIBUTES', '@TARGET@'
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure('@TARGET@')
      and @ATTRIBUTES_OLD_FLIGHT@)
    union all
    select 'CONFIG_TABLE', 'private.marketplace_config is not the three-column, triggerless, ruleless table with the pinned primary key'
    where @CONFIG_SHAPE_TEST@
    union all
    select 'CONFIG_KEY_PRESENT', c.key from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@')
    union all
    select 'CERTIFICATE', 'the closure certificate is not ready and bound'
    where private.retention_ai_source_ready() is distinct from true
      or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
    union all
    select 'CERTIFIED_TARGET', 'the target is a trigger function or named in a function of the closure digest'
    where exists(select 1 from pg_trigger where tgfoid = to_regprocedure('@TARGET@'))
      or exists(select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname in (@CERTIFICATE_FUNCTIONS@) and position('work_kinds_v5' in p.prosrc) > 0)
    union all
    select 'AUTHORITY', '@TARGET@'
    where has_function_privilege('anon', '@TARGET@', 'EXECUTE') or has_function_privilege('authenticated', '@TARGET@', 'EXECUTE')
      or has_function_privilege('service_role', '@TARGET@', 'EXECUTE')
    union all
    select 'CALLERS', 'the functions that name the target are not exactly the two callers: ' || coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname), '')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prosrc like '%work_kinds_v5%' and p.oid <> to_regprocedure('@TARGET@')
    having coalesce(array_agg(n.nspname || '.' || p.proname order by n.nspname, p.proname), '{}'::text[])
      is distinct from array['private.dispatch_cheap_candidate_admitted', 'private.match_detail_without_calendar']
  )
select jsonb_build_object(
  'unit', 'EX06B_ALIAS_REGISTRY_DEV_PREFLIGHT',
  'pinsChecked', (select count(*) from pins),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'facts', jsonb_build_object(
    'targetBodyMd5', (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure('@TARGET@')),
    'configRows', (select count(*) from private.marketplace_config),
    'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
    'liveSource', private.closure_source_digest_v5(),
    'ledgerRows', (select count(*) from supabase_migrations.schema_migrations)),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as preflight;
""", {'@ATTRIBUTES_OLD_FLIGHT@': ATTRIBUTES_OLD % ("'" + OLD_COMMENT + "'")})


def postflight_text():
    smoke_union = ',\n'.join("    (%d, %s, %s)" % (i + 1, text_array(values), text_array(expected)) for i, (values, expected) in enumerate(SMOKE_PROBES))
    return substitute("""-- EX-06 ex06b DEV POSTFLIGHT. READ-ONLY: one SELECT, no write, no lock. Run it against canonical DEV right after the application (and at any time later).
-- GENERATED by supabase/proofs/ex06/build_ex06b.py: do not edit by hand (`--check` fails on any difference).
-- Returns ONE row of JSON. "problems": every part of the applied state that does not hold (an empty array means the application is exactly in place); "informational": a neighbour function whose body is no
-- longer the pinned DEV predecessor (never a problem of this application: a later package may change one). A LATER legitimate edit of the registry rows (an alias added) shows as REGISTRY_ROW_DIFFERS here:
-- this file describes the state right after the application only.
with
  targets(signature, body_md5) as (values ('@TARGET@', '@NEW_MD5@')),
  neighbours(signature, body_md5) as (values
@NEIGHBOUR_PINS@
  ),
  expected_rows(key, value) as (
    select r.item ->> 'key', r.item -> 'value' from jsonb_array_elements($registry$@REGISTRY@$registry$::jsonb) r(item)
  ),
  registry_valid as (
    select (exists(select 1 from private.marketplace_config c
                    where c.key = '@HEAD_KEY@' and c.value ->> 'schema' = '@HEAD_SCHEMA@'
                      and c.value -> 'kinds' = to_jsonb(@CLOSED_ARRAY@) and c.value ->> 'foldVersion' = '@FOLD_VERSION@')
            and (select count(*) from private.marketplace_config c
                  where starts_with(c.key, '@KIND_KEY_PREFIX@') and substr(c.key, @REG_PREFIX_FROM@) = any(@CLOSED_ARRAY@)
                    and c.value ->> 'schema' = '@KIND_SCHEMA@' and c.value ->> 'kind' = substr(c.key, @REG_PREFIX_FROM@)
                    and jsonb_typeof(c.value -> 'stems') = 'array') = cardinality(@CLOSED_ARRAY@)) as valid
  ),
  smoke(ord, probe_input, probe_expected) as (values
@SMOKE_UNION@
  ),
  smoke_result as (
    select s.ord, s.probe_expected, case when (select valid from registry_valid) then private.work_kinds_v5(s.probe_input) end as got from smoke s
  ),
  problems as (
    select 'BODY_DRIFT' as kind, t.signature as detail
    from targets t
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(t.signature)) is distinct from t.body_md5
    union all
    select 'TARGET_ATTRIBUTES', t.signature
    from targets t
    where not exists(select 1 from pg_proc p where p.oid = to_regprocedure(t.signature)
      and @ATTRIBUTES_NEW_FLIGHT@)
    union all
    select 'REGISTRY_INVALID', 'the head row and the eleven kind rows are not exactly the valid registry the function reads'
    where not (select valid from registry_valid)
    union all
    select 'REGISTRY_ROW_DIFFERS', e.key
    from expected_rows e
    where not exists(select 1 from private.marketplace_config c where c.key = e.key and c.value = e.value)
    union all
    select 'REGISTRY_EXTRA_ROW', c.key
    from private.marketplace_config c
    where starts_with(c.key, '@CONFIG_KEY_PREFIX@') and not exists(select 1 from expected_rows e where e.key = c.key)
    union all
    select 'STEM_NOT_FOLDED', c.key || ': ' || coalesce(e.stem #>> '{}', 'null')
    from private.marketplace_config c
    cross join lateral jsonb_array_elements(case when jsonb_typeof(c.value -> 'stems') = 'array' then c.value -> 'stems' else '[]'::jsonb end) e(stem)
    where starts_with(c.key, '@KIND_KEY_PREFIX@')
      and (jsonb_typeof(e.stem) <> 'string' or (e.stem #>> '{}') !~ '@STEM_PATTERN@' or length(e.stem #>> '{}') < @MIN_STEM_LENGTH@)
    union all
    select 'SMOKE_PROBE', r.ord::text
    from smoke_result r
    where r.got is distinct from r.probe_expected
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
    select 'CERTIFIED_TARGET', 'the target is a trigger function or named in a function of the closure digest'
    where exists(select 1 from pg_trigger where tgfoid = to_regprocedure('@TARGET@'))
      or exists(select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proname in (@CERTIFICATE_FUNCTIONS@) and position('work_kinds_v5' in p.prosrc) > 0)
  ),
  informational as (
    select 'NEIGHBOUR_CHANGED' as kind, n.signature as detail
    from neighbours n
    where (select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(n.signature)) is distinct from n.body_md5
  )
select jsonb_build_object(
  'unit', 'EX06B_ALIAS_REGISTRY_DEV_POSTFLIGHT',
  'pinsChecked', (select count(*) from targets) + (select count(*) from neighbours),
  'smokeProbes', (select count(*) from smoke),
  'problems', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from problems), '[]'::jsonb),
  'informational', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'detail', detail) order by kind, detail) from informational), '[]'::jsonb),
  'classificationVersion', (select c.value ->> 'classificationVersion' from private.marketplace_config c where c.key = '@HEAD_KEY@'),
  'registryRows', (select count(*) from private.marketplace_config c where starts_with(c.key, '@CONFIG_KEY_PREFIX@')),
  'certifiedSource', (select sha256 from private.closure_source_v5 where singleton),
  'ledgerRows', (select count(*) from supabase_migrations.schema_migrations),
  'checkedAt', to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
) as postflight;
""", {'@REGISTRY@': registry_text(), '@SMOKE_UNION@': smoke_union, '@ATTRIBUTES_NEW_FLIGHT@': ATTRIBUTES_NEW % ("'" + NEW_COMMENT + "'")})


# ------------------------------------------------------------------------------------------------------------------------------ the integrity guards, one per transport
# PLAIN transport (psql -c, a connector's execute_sql): the Voice B1 / D12 method. A DO block that runs first and hashes the characters of the CURRENT QUERY from the position where the candidate starts
# for the length of its span (the candidate without its trailing line feeds), and requires that everything after the span is only line feeds and `--` comment lines (a connector trailer).
GUARD_TAIL_PATTERN = '^(' + chr(92) + 'n|--[^' + chr(92) + 'n' + chr(92) + 'r]*)*$'   # a comment ends at a line feed OR a carriage return in the PostgreSQL lexer
PLAIN_GUARD_TEMPLATE = ("do $ex06b_guard$ declare rest text:=substr(current_query(),{tail_start}); begin if encode(sha256(convert_to(substr(current_query(),{start},{length}),'UTF8')),'hex')<>'{sha}' or rest !~ '"
                        + GUARD_TAIL_PATTERN + "' then raise exception 'EX06B_APPLY_TEXT_INTEGRITY' using errcode='55000'; end if; end $ex06b_guard$;" + LF)


def guarded_span(text):
    """The characters the plain guard hashes: the candidate WITHOUT its trailing line feeds (a connector appends a trailer comment and a re-typed text loses its final line feed: neither may change what is hashed)."""
    return text.rstrip(LF)


def plain_guard_text(text):
    if any(ord(c) > 127 for c in text):
        raise SystemExit('a guarded text must be ASCII-only')
    span = guarded_span(text)
    if not span:
        raise SystemExit('a guarded text must not be empty')
    sha = hashlib.sha256(span.encode('utf-8')).hexdigest()
    length = format(len(span), '06d')
    guard = PLAIN_GUARD_TEMPLATE.format(start='000000', tail_start='000000', length=length, sha=sha)
    start = len(guard) + 1
    tail_start = start + len(span)
    guard = PLAIN_GUARD_TEMPLATE.format(start=format(start, '06d'), tail_start=format(tail_start, '06d'), length=length, sha=sha)
    if len(guard) != start - 1 or len(span) > 999999 or tail_start > 999999:
        raise SystemExit('the guard position is not stable')
    return guard


def plain_wrap(text):
    wrapped = plain_guard_text(text) + text
    if len(wrapped.encode('utf-8')) > GUARD_MAX_BYTES:
        raise SystemExit('a guarded text of ' + str(len(wrapped)) + ' bytes does not fit one psql -c argument (limit ' + str(GUARD_MAX_BYTES) + ')')
    return wrapped


def plain_guard_accepts(query, guard_length, span_length, span_sha):
    """The plain guard's predicate in Python, for the self-test (the database runs the SQL form)."""
    start = guard_length + 1
    span = query[start - 1:start - 1 + span_length]
    rest = query[start - 1 + span_length:]
    return hashlib.sha256(span.encode('utf-8')).hexdigest() == span_sha and re.fullmatch(r'(\n|--[^\n\r]*)*', rest) is not None


# APPLY_MIGRATION transport (the Supabase connector): measured read-only on canonical DEV on 2026-10-02 (the D12 diagnostic, nothing applied): the connector sends
#   begin;LF LF -- apply sql from post body LF <TEXT> ; LF LF -- track statements in history table LF insert into supabase_migrations.schema_migrations as old (...) values ( ...,
#   array[$TAG$<TEXT>$TAG$], ... ) on conflict (idempotency_key) do update set ... ; LF LF commit;
# so current_query() holds the text TWICE and the first copy starts at position 37: an absolute-position guard refuses it (the first D12 and ex06a attempts). This guard finds its own MARKER instead (the first
# line of the candidate, assembled from two literals so that the guard does not contain it), requires EXACTLY two occurrences, hashes the span of BOTH and requires the executed copy to be followed by nothing
# but the connector's own history statement.
MIGRATION_TAIL_PATTERN = '\\n?;\\n\\n-- track statements in history table\\ninsert into supabase_migrations\\.schema_migrations as old\\n'
CHUNK = 4000


def migration_guard(candidate, marker_head, marker_tail):
    assert candidate.endswith('\n') and not candidate.endswith('\n\n') and '\r' not in candidate, 'the candidate must be LF text with exactly one final line feed'
    assert all(ord(c) < 128 for c in candidate), 'the candidate must be ASCII'
    span = candidate[:-1]
    marker = marker_head + marker_tail
    assert span.startswith(marker) and span.count(marker) == 1, 'the marker must start the text and occur once in it'
    n, h = len(span), hashlib.sha256(span.encode('ascii')).hexdigest()
    guard = (
        "do $ex06b_guard$ declare q text:=current_query(); mk text:='" + marker_head + "' || '" + marker_tail + "'; n integer:=" + str(n) + "; h text:='" + h + "'; "
        "p1 integer:=strpos(q,mk); p2 integer:=0; p3 integer:=0; h1 text; h2 text; ck text:=''; i integer; begin "
        "if p1>0 then p2:=strpos(substr(q,p1+n),mk); if p2>0 then p2:=p1+n+p2-1; p3:=strpos(substr(q,p2+n),mk); end if; end if; "
        "if p1>0 then h1:=encode(sha256(convert_to(substr(q,p1,n),'UTF8')),'hex'); end if; "
        "if p2>0 then h2:=encode(sha256(convert_to(substr(q,p2,n),'UTF8')),'hex'); end if; "
        "if p1>0 and p2>0 and p3=0 and h1=h and h2=h and substr(q,p1+n) ~ '^" + MIGRATION_TAIL_PATTERN + "' then return; end if; "
        "if p1>0 then for i in 0..(n-1)/" + str(CHUNK) + " loop ck:=ck||left(md5(substr(q,p1+i*" + str(CHUNK) + "," + str(CHUNK) + ")),6)||','; end loop; end if; "
        "raise exception 'EX06B_APPLY_TEXT_INTEGRITY p1=% p2=% p3=% h1=% h2=% ck=%',p1,p2,p3,h1,h2,ck using errcode='55000'; end $ex06b_guard$;"
    )
    assert marker not in guard and LF not in guard and all(ord(c) < 128 for c in guard)
    return guard + LF + candidate, n, h


def migration_wrap(candidate, marker_head, marker_tail):
    wrapped, n, h = migration_guard(candidate, marker_head, marker_tail)
    if len(wrapped.encode('ascii')) > GUARD_MAX_BYTES:
        raise SystemExit('a guarded text of ' + str(len(wrapped)) + ' bytes is too large')
    return wrapped


def connector_wrapper(text, name='dev_alpha_example', tag='lCZXaDtNyWkdAfwHPldC'):
    """A faithful model of what the apply_migration connector sends (measured 2026-10-02), for the offline self-test only."""
    return ('begin;\n\n-- apply sql from post body\n' + text + ';\n\n-- track statements in history table\ninsert into supabase_migrations.schema_migrations as old\n  (version, name, statements, created_by, idempotency_key, rollback)\n'
            "values (\n  to_char(current_timestamp, 'YYYYMMDDHH24MISS'),\n  $" + tag + '$' + name + '$' + tag + '$,\n  array[$' + tag + '$' + text + '$' + tag + '$],\n  $' + tag + '$user$' + tag + '$,\n  null,\n  null\n)\non conflict (idempotency_key) do update set\n  version = EXCLUDED.version;\n\ncommit;')


def migration_guard_accepts(query, marker, span_len, span_hash):
    """The apply_migration guard's predicate in Python (the database runs the SQL form)."""
    p1 = query.find(marker) + 1
    p2 = p3 = 0
    if p1 > 0:
        r = query[p1 + span_len - 1:].find(marker) + 1
        if r > 0:
            p2 = p1 + span_len + r - 1
            p3 = query[p2 + span_len - 1:].find(marker) + 1
    h1 = hashlib.sha256(query[p1 - 1:p1 - 1 + span_len].encode()).hexdigest() if p1 > 0 else None
    h2 = hashlib.sha256(query[p2 - 1:p2 - 1 + span_len].encode()).hexdigest() if p2 > 0 else None
    return bool(p1 > 0 and p2 > 0 and p3 == 0 and h1 == span_hash and h2 == span_hash
                and re.match(MIGRATION_TAIL_PATTERN.replace('\\n', '\n').replace('\\.', '.'), query[p1 - 1 + span_len:]))


def selftest(outputs):
    """Both guards against a model of what their connector sends: the exact text passes, one changed byte and any statement after the candidate are refused."""
    results = []
    for path, head, tail in ((CANDIDATE, APPLY_MARKER_HEAD, APPLY_MARKER_TAIL), (REVERT, REVERT_MARKER_HEAD, REVERT_MARKER_TAIL)):
        text = outputs[path]
        marker = head + tail
        # the migration guard
        wrapped, n, h = migration_guard(text, head, tail)
        assert migration_guard_accepts(connector_wrapper(wrapped), marker, n, h), 'the connector wrapper with a trailing LF must pass'
        assert migration_guard_accepts(connector_wrapper(wrapped[:-1]), marker, n, h), 'the connector wrapper without a trailing LF must pass'
        assert not migration_guard_accepts(connector_wrapper(wrapped.replace('lock_timeout', 'lock_timeoyt', 1)), marker, n, h), 'one changed byte must be refused'
        assert not migration_guard_accepts(connector_wrapper(wrapped + 'select 1;\n'), marker, n, h), 'a statement after the candidate must be refused'
        full = connector_wrapper(wrapped)
        second = full.rfind(marker)
        assert second > full.find(marker), 'the model must hold the text twice'
        assert not migration_guard_accepts(full[:second + 500] + 'X' + full[second + 501:], marker, n, h), 'a changed byte inside the history copy (the ledger text) must be refused'
        # the plain guard
        guard = plain_guard_text(text)
        span = guarded_span(text)
        span_sha = hashlib.sha256(span.encode('utf-8')).hexdigest()
        plain = guard + text
        trailer = '\n\n-- source: POST /mcp\n-- user: example\n-- date: 2026-10-02'
        assert plain_guard_accepts(plain, len(guard), len(span), span_sha) and plain_guard_accepts(plain + trailer, len(guard), len(span), span_sha), 'the plain text and its connector trailer must pass'
        assert plain_guard_accepts(plain.rstrip(LF), len(guard), len(span), span_sha), 'a re-typed text without its final line feed must pass'
        assert not plain_guard_accepts(plain.replace('lock_timeout', 'lock_timeoyt', 1), len(guard), len(span), span_sha), 'one changed byte must be refused'
        assert not plain_guard_accepts(plain + 'select 1;', len(guard), len(span), span_sha), 'a statement after the candidate must be refused'
        assert not plain_guard_accepts(' ' + plain, len(guard), len(span), span_sha), 'anything before the guard shifts the span and must be refused'
        results.append('selftest OK: ' + relative(path) + ': migration guard ' + str(len(wrapped) - len(text)) + ' chars, plain guard ' + str(len(guard)) + ' chars, span ' + str(len(span)) + ' chars, sha256 ' + span_sha)
    return results


# ------------------------------------------------------------------------------------------------------------------------------ the outputs, the manifest, the checks
def build_outputs():
    return {CANDIDATE: candidate_text(), REVERT: revert_text(), PREFLIGHT: preflight_text(), POSTFLIGHT: postflight_text()}


def guarded_outputs(outputs):
    return {GUARDED_PLAIN_APPLY: plain_wrap(outputs[CANDIDATE]), GUARDED_PLAIN_REVERT: plain_wrap(outputs[REVERT]),
            GUARDED_MIGRATION_APPLY: migration_wrap(outputs[CANDIDATE], APPLY_MARKER_HEAD, APPLY_MARKER_TAIL),
            GUARDED_MIGRATION_REVERT: migration_wrap(outputs[REVERT], REVERT_MARKER_HEAD, REVERT_MARKER_TAIL)}


def manifest_text(outputs, guarded):
    files, guards = {}, {}
    for path, text in outputs.items():
        data = text.encode('utf-8')
        files[relative(path)] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'lines': text.count(LF)}
    for path, text in guarded.items():
        data = text.encode('utf-8')
        guards[relative(path)] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
    spans = {}
    for path in (CANDIDATE, REVERT):
        span = guarded_span(outputs[path]).encode('utf-8')
        spans[relative(path)] = {'spanSha256': hashlib.sha256(span).hexdigest(), 'spanLength': len(span)}
    document = {
        'unit': 'EX06B_MANIFEST', 'generator': relative(Path(__file__)),
        'note': 'sha256 of the exact bytes of each generated file (LF-only, ASCII-only); the guarded forms are guard + file as ONE text; both guards hash the file WITHOUT its trailing line feed (spanSha256, spanLength)',
        'target': TARGET, 'predecessorMd5': OLD_MD5, 'newMd5': NEW_MD5, 'classificationVersion': CLASSIFICATION_VERSION, 'kinds': CLOSED_KINDS,
        'stemsAdded': STEMS_ADDED, 'stemsRemoved': STEMS_REMOVED, 'registryRowsSha256': hashlib.sha256(registry_text().encode('utf-8')).hexdigest(),
        'neighbourPins': [{'signature': s, 'md5': m} for s, m in NEIGHBOUR_PINS], 'callers': CALLERS, 'configPrimaryKeyMd5': CONFIG_PK_MD5,
        'applyMarker': APPLY_MARKER_HEAD + APPLY_MARKER_TAIL, 'revertMarker': REVERT_MARKER_HEAD + REVERT_MARKER_TAIL,
        'files': files, 'spans': spans, 'guarded': guards, 'tailPatterns': {'plain': GUARD_TAIL_PATTERN, 'applyMigration': MIGRATION_TAIL_PATTERN},
        'inputs': {relative(OLD_BODY_SOURCE): sha256(read_lf(OLD_BODY_SOURCE)), relative(DEV_BODY_FILE): sha256(read_lf(DEV_BODY_FILE))}}
    return json.dumps(document, indent=2, sort_keys=True) + LF


def static_rules(path, text):
    """The transport rules every generated file obeys."""
    problems = []
    if '\r' in text:
        problems.append('a carriage return')
    if '\t' in text:
        problems.append('a tab')
    if any(ord(c) > 127 for c in text):
        problems.append('a non-ASCII character')
    if re.search(r'@[A-Z][A-Z0-9_]*@', text):
        problems.append('a placeholder left')
    if re.search(r'\\u[0-9a-fA-F]{4}', text):
        problems.append('a unicode escape')
    if path in (CANDIDATE, REVERT, PREFLIGHT, POSTFLIGHT) and chr(92) in text:
        problems.append('a backslash')
    if problems:
        raise SystemExit(relative(path) + ' breaks the transport rules: ' + ', '.join(problems))


def stem_diff():
    lines = []
    for kind in CLOSED_KINDS:
        old, new = OLD_STEMS[kind], NEW_STEMS[kind]
        removed = [s for s in old if s not in new]
        added = [s for s in new if s not in old]
        lines.append('%-18s %2d -> %2d stems%s%s' % (kind, len(old), len(new), ('  removed: ' + ' '.join(removed)) if removed else '', ('  added: ' + ' '.join(added)) if added else ''))
    return lines


def syntax_check(outputs, guarded):
    """Every generated statement through the PostgreSQL grammar, every function body and every DO body (and both guards) through the PL/pgSQL grammar (which also parses every embedded SQL statement)."""
    try:
        import pglast
        from pglast.parser import parse_plpgsql_json
    except ImportError:
        raise SystemExit('--syntax needs pglast (pip install pglast)')

    def flat(text):
        return re.sub(r'\b(private|extensions|supabase_migrations|rls_private)\.', 'public.', text)

    for path, text in {**outputs, **guarded}.items():
        statements = pglast.parse_sql(text)
        print('parsed ' + relative(path) + ': ' + str(len(statements)) + ' statement(s)')
    parse_plpgsql_json('create function f(p_values text[]) returns text[] language plpgsql as $x$' + flat(NEW_BODY) + '$x$')
    print('plpgsql grammar OK: the new body of ' + TARGET)
    for path in (CANDIDATE, REVERT):
        text = outputs[path]
        match = re.search(r'do \$(ex06b[a-z_]*)\$(.*)\$\1\$;', text, re.S)
        body = match.group(2)
        parse_plpgsql_json('create function f() returns void language plpgsql as $x$' + flat(body) + '$x$')
        print('plpgsql grammar OK: the DO body of ' + relative(path))
    # the statements the DO blocks build at run time (execute format(... %L ...)): the function DDL with the quoted body, the old body rebuilt from its template, and the two comments
    quoted = lambda s: "'" + s.replace("'", "''") + "'"
    for label, statement in (('create or replace function (new body)', NEW_HEAD + quoted(NEW_BODY)),
                             ('create or replace function (old body, rebuilt from the template)', OLD_HEAD + quoted(OLD_BODY_TEMPLATE.replace(OLD_FOLD_MARKER, OLD_FOLD_FROM))),
                             ('comment on function (new)', 'comment on function ' + TARGET + ' is ' + quoted(NEW_COMMENT)),
                             ('comment on function (old)', 'comment on function ' + TARGET + ' is ' + quoted(OLD_COMMENT))):
        parsed = pglast.parse_sql(statement)
        assert len(parsed) == 1, label
        print('parsed the run-time statement: ' + label)
    for path, text in guarded.items():
        guard = re.search(r'do \$ex06b_guard\$(.*?)\$ex06b_guard\$;', text, re.S)
        parse_plpgsql_json('create function f() returns void language plpgsql as $x$' + guard.group(1) + '$x$')
        print('guard parsed: ' + relative(path))
    for path in (CANDIDATE, REVERT):
        if len(pglast.parse_sql(guarded[GUARDED_PLAIN_APPLY if path == CANDIDATE else GUARDED_PLAIN_REVERT])) != len(pglast.parse_sql(outputs[path])) + 1:
            raise SystemExit('the plain guarded text of ' + relative(path) + ' must be exactly one statement longer than the file')


def main(argv):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')   # the old body carries Serbian letters; a Windows console is cp1252
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='fail unless every committed file equals the generated one BYTE FOR BYTE (and the manifest)')
    parser.add_argument('--diff', action='store_true', help='print the old -> new stem table')
    parser.add_argument('--syntax', action='store_true', help='also parse everything with the PostgreSQL parser (pglast)')
    parser.add_argument('--selftest', action='store_true', help='the two integrity guards against a model of what each connector sends')
    parser.add_argument('--wrap', help='a text file: write the PLAIN integrity guard + its text as ONE text to --wrap-out')
    parser.add_argument('--wrap-migration', help='a text file: write the APPLY_MIGRATION integrity guard + its text as ONE text to --wrap-out (the marker of the application or of the revert is detected)')
    parser.add_argument('--wrap-out', help='where --wrap / --wrap-migration write the guarded text')
    arguments = parser.parse_args(argv)
    if arguments.wrap or arguments.wrap_migration:
        if not arguments.wrap_out:
            raise SystemExit('--wrap needs --wrap-out')
        raw = Path(arguments.wrap or arguments.wrap_migration).read_bytes()
        if b'\r' in raw:
            raise SystemExit('a guarded text must be LF-only')
        text = raw.decode('ascii')
        if arguments.wrap:
            wrapped = plain_wrap(text)
        elif text.startswith(APPLY_MARKER_HEAD + APPLY_MARKER_TAIL):
            wrapped = migration_wrap(text, APPLY_MARKER_HEAD, APPLY_MARKER_TAIL)
        elif text.startswith(REVERT_MARKER_HEAD + REVERT_MARKER_TAIL):
            wrapped = migration_wrap(text, REVERT_MARKER_HEAD, REVERT_MARKER_TAIL)
        else:
            raise SystemExit('the text starts with neither the application marker nor the revert marker')
        Path(arguments.wrap_out).write_bytes(wrapped.encode('ascii'))
        print('written ' + arguments.wrap_out + ' (' + str(len(wrapped)) + ' chars; candidate sha256 ' + hashlib.sha256(raw).hexdigest() + ')')
        return 0
    outputs = build_outputs()
    for path, text in outputs.items():
        static_rules(path, text)
    guarded = guarded_outputs(outputs)
    for path, text in guarded.items():
        static_rules(path, text)
    if arguments.diff:
        print('\n'.join(stem_diff()))
        for line in difflib.unified_diff(OLD_BODY.splitlines(), NEW_BODY.splitlines(), 'private.work_kinds_v5 old (md5 %s)' % OLD_MD5, 'private.work_kinds_v5 new (md5 %s)' % NEW_MD5, lineterm=''):
            print(line)
        return 0
    if arguments.selftest:
        print('\n'.join(selftest(outputs)))
        return 0
    if arguments.syntax:
        syntax_check(outputs, guarded)
    manifest = manifest_text(outputs, guarded)
    everything = {**outputs, **guarded, MANIFEST: manifest}
    failed = False
    for path, text in everything.items():
        if arguments.check:
            current = read_lf(path) if path.exists() else None
            if current != text:
                print('DIFFERS', relative(path))
                failed = True
            else:
                print('EQUAL  ', relative(path), hashlib.sha256(text.encode('utf-8')).hexdigest())
        elif not arguments.syntax:
            path.parent.mkdir(parents=True, exist_ok=True)
            io.open(path, 'w', encoding='utf-8', newline='').write(text)
            print('wrote', relative(path), len(text.encode('utf-8')), 'bytes', hashlib.sha256(text.encode('utf-8')).hexdigest())
    print('private.work_kinds_v5 new body md5', NEW_MD5, 'old', OLD_MD5)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
