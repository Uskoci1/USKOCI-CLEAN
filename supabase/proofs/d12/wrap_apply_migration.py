#!/usr/bin/env python3
"""D12 / any candidate: the integrity guard for the Supabase connector's apply_migration transport.

WHY THIS EXISTS. `build_d12.py --wrap` writes a guard for a plain one-statement transport (psql -c): it hashes the text at an ABSOLUTE position and requires that nothing but line feeds and `--` comments
follows it. The connector's apply_migration does not send the text alone. Measured read-only on canonical DEV on 2026-10-02 (a diagnostic migration that raised on purpose, nothing applied):

    begin;LF LF -- apply sql from post body LF <TEXT> ; LF LF -- track statements in history table LF insert into supabase_migrations.schema_migrations as old (...) values ( ...,
    array[$TAG$<TEXT>$TAG$], ... ) on conflict (idempotency_key) do update set ... ; LF LF commit;

so current_query() holds the text TWICE (the executed copy and the history copy that becomes the ledger row) and the first copy starts at position 37. The absolute-position guard therefore refused the first
D12 attempt (D12_APPLY_TEXT_INTEGRITY, nothing applied). This guard finds its own marker instead: it requires EXACTLY two occurrences, hashes the span of BOTH, and requires that the executed copy is followed by
nothing but the connector's own history statement. The candidate text is unchanged and keeps its own hash; only the guard line in front of it differs.

usage:  python supabase/proofs/d12/wrap_apply_migration.py [--candidate PATH] [--out PATH] [--selftest]
"""
import argparse, hashlib, re, sys
from pathlib import Path

MARKER_HEAD = '-- D12 written comment with '
MARKER_TAIL = 'the star rating: DEV application candidate.'
CHUNK = 4000
TAIL_PATTERN = '\\n?;\\n\\n-- track statements in history table\\ninsert into supabase_migrations\\.schema_migrations as old\\n'


def build(candidate: str):
    assert candidate.endswith('\n') and not candidate.endswith('\n\n') and '\r' not in candidate, 'the candidate must be LF text with exactly one final line feed'
    assert all(ord(c) < 128 for c in candidate), 'the candidate must be ASCII'
    span = candidate[:-1]
    assert span.startswith(MARKER_HEAD + MARKER_TAIL) and span.count(MARKER_HEAD + MARKER_TAIL) == 1, 'the marker must start the text and occur once in it'
    n, h = len(span), hashlib.sha256(span.encode('ascii')).hexdigest()
    guard = (
        "do $d12_guard$ declare q text:=current_query(); mk text:='" + MARKER_HEAD + "' || '" + MARKER_TAIL + "'; n integer:=" + str(n) + "; h text:='" + h + "'; "
        "p1 integer:=strpos(q,mk); p2 integer:=0; p3 integer:=0; h1 text; h2 text; ck text:=''; i integer; begin "
        "if p1>0 then p2:=strpos(substr(q,p1+n),mk); if p2>0 then p2:=p1+n+p2-1; p3:=strpos(substr(q,p2+n),mk); end if; end if; "
        "if p1>0 then h1:=encode(sha256(convert_to(substr(q,p1,n),'UTF8')),'hex'); end if; "
        "if p2>0 then h2:=encode(sha256(convert_to(substr(q,p2,n),'UTF8')),'hex'); end if; "
        "if p1>0 and p2>0 and p3=0 and h1=h and h2=h and substr(q,p1+n) ~ '^" + TAIL_PATTERN + "' then return; end if; "
        "if p1>0 then for i in 0..(n-1)/" + str(CHUNK) + " loop ck:=ck||left(md5(substr(q,p1+i*" + str(CHUNK) + "," + str(CHUNK) + ")),6)||','; end loop; end if; "
        "raise exception 'D12_APPLY_TEXT_INTEGRITY p1=% p2=% p3=% h1=% h2=% ck=%',p1,p2,p3,h1,h2,ck using errcode='55000'; end $d12_guard$;"
    )
    assert MARKER_HEAD + MARKER_TAIL not in guard and '\n' not in guard and all(ord(c) < 128 for c in guard)
    return guard + '\n' + candidate, n, h


def connector_wrapper(text: str, name='dev_alpha_example', tag='lCZXaDtNyWkdAfwHPldC'):
    """A faithful model of what the connector sends (measured 2026-10-02), for the offline self-test only."""
    return ('begin;\n\n-- apply sql from post body\n' + text + ';\n\n-- track statements in history table\ninsert into supabase_migrations.schema_migrations as old\n  (version, name, statements, created_by, idempotency_key, rollback)\n'
            "values (\n  to_char(current_timestamp, 'YYYYMMDDHH24MISS'),\n  $" + tag + '$' + name + '$' + tag + '$,\n  array[$' + tag + '$' + text + '$' + tag + '$],\n  $' + tag + '$user$' + tag + '$,\n  null,\n  null\n)\non conflict (idempotency_key) do update set\n  version = EXCLUDED.version;\n\ncommit;')


def guard_accepts(q: str, span_len: int, span_hash: str):
    """The guard's predicate in Python (the database runs the SQL form)."""
    mk = MARKER_HEAD + MARKER_TAIL
    p1 = q.find(mk) + 1
    p2 = p3 = 0
    if p1 > 0:
        r = q[p1 + span_len - 1:].find(mk) + 1
        if r > 0:
            p2 = p1 + span_len + r - 1
            p3 = q[p2 + span_len - 1:].find(mk) + 1
    h1 = hashlib.sha256(q[p1 - 1:p1 - 1 + span_len].encode()).hexdigest() if p1 > 0 else None
    h2 = hashlib.sha256(q[p2 - 1:p2 - 1 + span_len].encode()).hexdigest() if p2 > 0 else None
    return bool(p1 > 0 and p2 > 0 and p3 == 0 and h1 == span_hash and h2 == span_hash and re.match(TAIL_PATTERN.replace('\\n', '\n').replace('\\.', '.'), q[p1 - 1 + span_len:]))


def selftest(candidate: str):
    text, n, h = build(candidate)
    assert guard_accepts(connector_wrapper(text), n, h), 'the connector wrapper with a trailing LF must pass'
    assert guard_accepts(connector_wrapper(text[:-1]), n, h), 'the connector wrapper without a trailing LF must pass'
    assert not guard_accepts(connector_wrapper(text.replace('lock_timeout', 'lock_timeoyt', 1)), n, h), 'one changed byte must be refused'
    assert not guard_accepts(connector_wrapper(text + 'select 1;\n'), n, h), 'a statement after the candidate must be refused'
    wrapped = connector_wrapper(text)
    second = wrapped.rfind(MARKER_HEAD + MARKER_TAIL)
    assert second > wrapped.find(MARKER_HEAD + MARKER_TAIL), 'the model must hold the text twice'
    assert not guard_accepts(wrapped[:second + 500] + 'X' + wrapped[second + 501:], n, h), 'a changed byte inside the history copy (the ledger text) must be refused'
    print('selftest OK: guard line', len(text) - len(candidate) - 1, 'characters; span', n, 'characters, sha256', h)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--candidate', default='supabase/candidates/d12_review_comment.sql')
    ap.add_argument('--out')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    candidate = Path(a.candidate).read_bytes().decode('ascii')
    if a.selftest:
        selftest(candidate)
    if a.out:
        text, n, h = build(candidate)
        Path(a.out).write_bytes(text.encode('ascii'))
        print('written', a.out, len(text), 'characters; text sha256', hashlib.sha256(text.encode('ascii')).hexdigest(), '; span', n, h)
    if not a.selftest and not a.out:
        ap.print_help(sys.stderr)
        sys.exit(2)


if __name__ == '__main__':
    main()
