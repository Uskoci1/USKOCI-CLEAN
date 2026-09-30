#!/usr/bin/env python3
"""Builds supabase/candidates/chat_voice_b1_revert.sql (NOT APPLIED) from the reviewed template, the pin tables of the DEV application and the committed pre-image capture.

The revert restores EXACTLY the text the application replaced: the 14 pre-image definitions come from voice_b1_preimage.json (captured read-only from the state the application starts
from, on the disposable chain whose 14 predecessor bodies equal the DEV receipt), and the pin tables are the application's own (the applied bodies become its preconditions, the
predecessor pins its postconditions). The committed DEV file carries DEV's certified digest; the disposable proof generates the chain variant with `--digest` and shows that the two
files differ in that one literal only. `--check` fails if the committed file differs from what this script generates.
"""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
APPLICATION_BUILDER = ROOT / 'supabase/proofs/chat/build_voice_b1_dev_application.py'
HEAD = ROOT / 'supabase/proofs/chat/voice_b1_dev_application.head.sql'
TAIL = ROOT / 'supabase/proofs/chat/voice_b1_dev_application.tail.sql'
TEMPLATE = ROOT / 'supabase/proofs/chat/voice_b1_revert.template.sql'
PREIMAGE = ROOT / 'supabase/proofs/chat/voice_b1_preimage.json'
OUT = ROOT / 'supabase/candidates/chat_voice_b1_revert.sql'
# The certified closure digest of canonical DEV immediately before the application (read-only preflight 2026-09-30T22:25:10Z: certified source equals the live digest).
DEV_DIGEST = '707af7fcaa913736de910201dd6763b122285b94c5b774813be4dafaef4f33e1'
CRLF = chr(13) + chr(10)
LF = chr(10)
READINESS = 'private.retention_ai_source_ready()'
VOICE_FUNCTION_COLUMNS = 'body_md5,language_name,volatility,definer,strict_function,result_type,acl'


def read(path):
    return path.read_bytes().decode('utf-8').replace(CRLF, LF)


def load_application_builder():
    spec = importlib.util.spec_from_file_location('voice_b1_application_builder', APPLICATION_BUILDER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def pair_rows(table, expected):
    """(signature, md5) of every row of a pin table, re-emitted as two-column rows."""
    pairs = re.findall(r"^    \('([^']+)','([0-9a-f]{32})'", table, flags=re.M)
    if len(pairs) != expected:
        raise SystemExit('expected ' + str(expected) + ' pin rows, found ' + str(len(pairs)))
    return pairs


def values(pairs):
    return (',' + LF).join("    ('" + signature + "','" + digest + "')" for signature, digest in pairs)


def surface_query(head):
    start, end = 'surface_query text := $surface_query$', '$surface_query$;'
    if head.count(start) != 1:
        raise SystemExit('head: expected exactly one surface query')
    begin = head.index(start) + len(start)
    return head[begin:head.index(end, begin)]


def build(digest):
    if not re.fullmatch(r'[0-9a-f]{64}', digest):
        raise SystemExit('the target digest must be 64 lowercase hex digits')
    app = load_application_builder()
    head, tail, template = read(HEAD), read(TAIL), read(TEMPLATE)
    preimage = json.loads(PREIMAGE.read_bytes().decode('utf-8'))
    if preimage.get('unit') != 'CHAT_VOICE_B1_PREIMAGE' or len(preimage['functions']) != 14:
        raise SystemExit('the pre-image capture is not the expected document')
    chain_digest = preimage['certifiedDigest']
    if not re.fullmatch(r'[0-9a-f]{64}', chain_digest):
        raise SystemExit('the pre-image capture has no certified digest')

    metadata_pins = pair_rows(app.pin_table(head, 'metadata_md5', 25), 25)
    body_pins = pair_rows(app.pin_table(head, 'body_md5', 26), 26)
    applied_pins = pair_rows(app.pin_table(tail, 'body_md5', 13), 13)
    voice_pins = pair_rows(app.pin_table(tail, VOICE_FUNCTION_COLUMNS, 15), 15)

    # The drop list of the template must be exactly the 15 pinned voice functions (and nothing else).
    dropped = sorted(re.findall(r'^  drop function (.+);$', template, flags=re.M))
    if dropped != sorted(signature for signature, _ in voice_pins):
        raise SystemExit('the template drops a different set of functions than the 15 the application creates')
    # Every rewritten function of the pre-image is a pinned predecessor body, and its captured body md5 is that pin.
    predecessor = dict(body_pins)
    restore = []
    rewritten = []
    for number, item in enumerate(preimage['functions'], 1):
        signature, text = item['signature'], item['definition']
        if item['hasCarriageReturn'] or chr(13) in text:
            raise SystemExit(signature + ': the captured definition contains a carriage return')
        if signature == READINESS:
            if text.count(chain_digest) != 1:
                raise SystemExit('the captured readiness definition must carry the certified digest exactly once')
            text = text.replace(chain_digest, digest)
        else:
            if predecessor.get(signature) != item['bodyMd5']:
                raise SystemExit(signature + ': the captured body is not the pinned DEV predecessor body')
            rewritten.append(signature)
        tag = '$voice_b1_restore_' + format(number, '02d') + '$'
        if tag in text:
            raise SystemExit(signature + ': contains its own quote tag')
        restore.append('  -- ' + signature + LF + '  execute ' + tag + text + tag + ';')
    if len(rewritten) != 13 or sorted(signature for signature, _ in applied_pins) != sorted(rewritten):
        raise SystemExit('the 13 captured functions are not the 13 functions the application rewrites')
    for name, definition in (('photo_check', preimage['constraints']['agreement_messages_body_photo_check']),
                             ('action_shape', preimage['constraints']['closure_action_shape146'])):
        if not definition.startswith('CHECK') or ('$' + name + '$') in definition:
            raise SystemExit(name + ': unexpected constraint definition')
    relations = preimage['mediaObjectsRelations']
    if not relations or any("'" in relation for relation in relations):
        raise SystemExit('unexpected retention catalog relations')

    provenance = ('the pre-image is ' + PREIMAGE.relative_to(ROOT).as_posix() + ' (sha256 ' + hashlib.sha256(PREIMAGE.read_bytes()).hexdigest()
                  + '); the digest this file restores is ' + digest + '.')
    built = (template.replace('{{PROVENANCE}}', provenance)
             .replace('{{CERTIFIED_DIGEST}}', digest)
             .replace('{{MEDIA_OBJECTS_BEFORE}}', 'array[' + ','.join("'" + relation + "'" for relation in relations) + ']::text[]')
             .replace('{{SURFACE_QUERY}}', surface_query(head))
             .replace('{{APPLIED_BODY_PINS}}', values(applied_pins))
             .replace('{{VOICE_FUNCTION_PINS}}', values(voice_pins))
             .replace('{{METADATA_PINS}}', values(metadata_pins))
             .replace('{{BODY_PINS}}', values(body_pins))
             .replace('{{REWRITTEN_ROSTER}}', ','.join("to_regprocedure('" + signature + "')" for signature in rewritten))
             .replace('{{VOICE_FUNCTION_ROSTER}}', ','.join("to_regprocedure('" + signature + "')" for signature, _ in voice_pins))
             .replace('{{RESTORE_FUNCTIONS}}', LF.join(restore))
             .replace('{{PHOTO_CHECK_DEF}}', preimage['constraints']['agreement_messages_body_photo_check'])
             .replace('{{ACTION_SHAPE_DEF}}', preimage['constraints']['closure_action_shape146']))
    if '{{' in built:
        raise SystemExit('the revert template has an unreplaced placeholder')
    return built


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='fail unless the committed DEV file equals the generated one')
    parser.add_argument('--digest', default=DEV_DIGEST, help='the certified digest the file restores (default: the DEV digest)')
    parser.add_argument('--out', help='write the generated file here instead of the committed path (the disposable proof uses this for its chain variant)')
    arguments = parser.parse_args()
    built = build(arguments.digest)
    if arguments.check:
        current = read(OUT) if OUT.exists() else ''
        if current != built:
            offset = next((i for i, (a, b) in enumerate(zip(built, current)) if a != b), min(len(built), len(current)))
            raise SystemExit('the committed revert candidate differs from the generated one: generated ' + str(len(built)) + ' chars sha256 '
                             + hashlib.sha256(built.encode('utf-8')).hexdigest() + ', committed ' + str(len(current)) + ' chars sha256 '
                             + hashlib.sha256(current.encode('utf-8')).hexdigest() + '; first difference at ' + str(offset) + ': generated '
                             + repr(built[max(0, offset - 60):offset + 100]) + ' committed ' + repr(current[max(0, offset - 60):offset + 100]))
        print('OK: ' + str(OUT.relative_to(ROOT)) + ' equals the generated revert candidate (' + str(len(built)) + ' chars)')
        return
    target = pathlib.Path(arguments.out) if arguments.out else OUT
    target.write_bytes(built.encode('utf-8'))
    print('written ' + str(target) + ' (' + str(len(built)) + ' chars)')


if __name__ == '__main__':
    sys.exit(main())
