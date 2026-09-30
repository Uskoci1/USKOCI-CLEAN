#!/usr/bin/env python3
"""Builds supabase/candidates/chat_voice_b1_dev_application.sql from the two PROVED install candidates and the reviewed wrapper (head + tail).

The two candidates are embedded BYTE FOR BYTE (only their own BEGIN and COMMIT lines are dropped), so the DEV application is exactly what the
disposable proofs ran. `--check` fails if the committed file differs from what this script generates.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
A = ROOT / 'supabase/candidates/chat_voice_b1a_feature_chain.sql'
B = ROOT / 'supabase/candidates/chat_voice_b1b_closure_integration.sql'
HEAD = ROOT / 'supabase/proofs/chat/voice_b1_dev_application.head.sql'
TAIL = ROOT / 'supabase/proofs/chat/voice_b1_dev_application.tail.sql'
OUT = ROOT / 'supabase/candidates/chat_voice_b1_dev_application.sql'
PREFLIGHT_TEMPLATE = ROOT / 'supabase/proofs/chat/voice_b1_dev_preflight.template.sql'
PREFLIGHT_OUT = ROOT / 'supabase/proofs/chat/voice_b1_dev_preflight.readonly.sql'
POSTFLIGHT_TEMPLATE = ROOT / 'supabase/proofs/chat/voice_b1_dev_postflight.template.sql'
POSTFLIGHT_OUT = ROOT / 'supabase/proofs/chat/voice_b1_dev_postflight.readonly.sql'
VOICE_FUNCTION_COLUMNS = 'body_md5,language_name,volatility,definer,strict_function,result_type,acl'
CRLF = chr(13) + chr(10)
LF = chr(10)


def read(path):
    return path.read_bytes().decode('utf-8').replace(CRLF, LF)


def fragment(text, name):
    start, end = LF + 'begin;' + LF, 'commit;' + LF
    if text.count(start) != 1 or not text.endswith(end) or text.count(end) != 1:
        raise SystemExit(name + ': expected exactly one "begin;" line and a final "commit;" line')
    body = text[text.index(start) + len(start):len(text) - len(end)]
    for tag in ('$voice_b1a_install$', '$voice_b1b_install$'):
        if tag in body:
            raise SystemExit(name + ': contains the wrapper quote tag ' + tag)
    if not body.endswith(LF):
        raise SystemExit(name + ': the fragment must end with a newline')
    return body


def build():
    head, tail = read(HEAD), read(TAIL)
    if not head.endswith('  execute $voice_b1a_install$' + LF):
        raise SystemExit('head must end with the first execute line')
    return (head + fragment(read(A), 'B1-a') + '$voice_b1a_install$;' + LF
            + '  execute $voice_b1b_install$' + LF + fragment(read(B), 'B1-b') + '$voice_b1b_install$;' + LF + tail)


def pin_table(head, column, expected_rows):
    """The exact rows of one predecessor pin table of the head, so the read-only preflight compares the SAME pins the application does."""
    start_marker = '  for pin in select * from (values' + LF
    end_marker = '  ) p(signature,' + column + ') loop' + LF
    if head.count(end_marker) != 1:
        raise SystemExit('head: expected exactly one pin table ending with ' + column)
    end = head.index(end_marker)
    start = head.rindex(start_marker, 0, end) + len(start_marker)
    table = head[start:end].rstrip(LF)
    rows = [line for line in table.split(LF) if line.startswith("    ('")]
    if len(rows) != expected_rows:
        raise SystemExit('head: the ' + column + ' table has ' + str(len(rows)) + ' rows, expected ' + str(expected_rows))
    return table


def build_preflight():
    head, template = read(HEAD), read(PREFLIGHT_TEMPLATE)
    built = (template.replace('{{METADATA_PINS}}', pin_table(head, 'metadata_md5', 25))
             .replace('{{BODY_PINS}}', pin_table(head, 'body_md5', 26)))
    if '{{' in built:
        raise SystemExit('the preflight template has an unreplaced placeholder')
    return built


def build_postflight():
    """The read-only check of the applied state, from the application's own post-state pins (13 rewritten bodies) and the 15 new function pins."""
    tail, template = read(TAIL), read(POSTFLIGHT_TEMPLATE)
    built = (template.replace('{{APPLIED_BODY_PINS}}', pin_table(tail, 'body_md5', 13))
             .replace('{{VOICE_FUNCTION_PINS}}', pin_table(tail, VOICE_FUNCTION_COLUMNS, 15)))
    if '{{' in built:
        raise SystemExit('the postflight template has an unreplaced placeholder')
    return built


def main():
    outputs = [(OUT, build(), 'DEV application candidate'), (PREFLIGHT_OUT, build_preflight(), 'read-only DEV preflight'),
               (POSTFLIGHT_OUT, build_postflight(), 'read-only DEV postflight')]
    if '--check' in sys.argv:
        for path, built, label in outputs:
            current = read(path) if path.exists() else ''
            if current != built:
                raise SystemExit('the committed ' + label + ' differs from the generated one')
            print('OK: ' + str(path.relative_to(ROOT)) + ' equals the generated ' + label + ' (' + str(len(built)) + ' chars)')
        return
    for path, built, label in outputs:
        path.write_bytes(built.encode('utf-8'))
        print('written ' + str(path.relative_to(ROOT)) + ' (' + str(len(built)) + ' chars)')


if __name__ == '__main__':
    main()
