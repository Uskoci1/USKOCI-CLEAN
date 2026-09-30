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


def main():
    built = build()
    if '--check' in sys.argv:
        current = read(OUT) if OUT.exists() else ''
        if current != built:
            raise SystemExit('the committed DEV application candidate differs from the generated one')
        print('OK: ' + str(OUT.relative_to(ROOT)) + ' equals the generated candidate (' + str(len(built)) + ' chars)')
        return
    OUT.write_bytes(built.encode('utf-8'))
    print('written ' + str(OUT.relative_to(ROOT)) + ' (' + str(len(built)) + ' chars)')


if __name__ == '__main__':
    main()
