#!/usr/bin/env python3
"""PKG-016 / GAP-0007 recovery-link attestation for a built Android APK.

The 2026-09-13 build signed cleanly and still shipped an app in which password
recovery could never work, because EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL was
absent at bundle time and configuredRecoveryRedirect compiled to a constant null.
A green Gradle exit does not prove the redirect is in the artifact, so this reads
the artifact itself.

It extracts the Hermes bundle from the APK, dumps its bytecode, isolates the
configuredRecoveryRedirect function and requires four things of it:

  1. exactly one such function exists,
  2. the literal redirect is compiled into its body,
  3. the environment variable name does NOT survive into the body, because that
     would mean the value is read at runtime on a device that has no such
     variable,
  4. the body is not the degenerate LoadConstNull/Ret that an absent value
     produces.

Usage: attest_recovery_redirect.py <apk> <receipt.json>
Exit code 0 writes the receipt and prints PASS. Any failure exits non-zero.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

RECOVERY = 'uskociapp://oporavak'
ENV_NAME = 'EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL'
BUNDLE = 'assets/index.android.bundle'
FUNCTION = 'Function<configuredRecoveryRedirect>'
# The exact shape an absent value produces: load null, return it. Register numbers and
# trailing whitespace vary between builds, so neither is pinned.
DISABLED = re.compile(r'Function<configuredRecoveryRedirect>[^\n]*\n\s*LoadConstNull\s+r\d+\s*\n\s*Ret\s+r\d+\s*(?:\n|$)')

# Hermes truncates string operands in its dump at 17 characters and appends an
# ellipsis, so the full 20-character redirect never appears inside a function body.
# Searching the body for the whole literal would fail on a correct build. The body is
# therefore checked for the load of a matching constant, and the full literal is
# confirmed separately in the string table, where Hermes prints it in full.
TRUNCATION = 17
LOAD_CONST_STRING = re.compile(r'LoadConstString\s+\w+,\s+"([^"]*)"(\.\.\.)?')
STRING_TABLE_ENTRY = re.compile(r'^[is]\d+\[(?:ASCII|UTF-16), -?\d+\.\.-?\d+\](?: #[0-9A-Fa-f]+)?: (.*)$')


def loads_recovery_constant(body: str) -> bool:
    """True when the body loads a constant string that is the redirect, allowing for
    Hermes' 17-character truncation in the dump."""
    for literal, truncated in LOAD_CONST_STRING.findall(body):
        if truncated:
            if literal == RECOVERY[:TRUNCATION]:
                return True
        elif literal == RECOVERY:
            return True
    return False


def fail(code, detail=''):
    print('FAIL RECOVERY_REDIRECT_ATTESTATION ' + code + ((' ' + detail) if detail else ''), file=sys.stderr)
    raise SystemExit(1)


def require(condition, code, detail=''):
    if not condition:
        fail(code, detail)


def hermesc() -> Path:
    """Find the Hermes compiler. This repository ships it under hermes-compiler;
    other React Native layouts put it under react-native/sdks. Both are searched, and
    a failure names every path tried so the next reader does not have to guess."""
    roots = (Path('node_modules/hermes-compiler/hermesc'),
             Path('node_modules/react-native/sdks/hermesc'))
    # Select by platform, not by whichever file happens to exist: all three
    # directories ship in the package, so a first-match search picks the Linux
    # binary on Windows and then cannot execute it.
    if sys.platform.startswith('win'):
        name = 'win64-bin/hermesc.exe'
    elif sys.platform == 'darwin':
        name = 'osx-bin/hermesc'
    else:
        name = 'linux64-bin/hermesc'
    tried = []
    for root in roots:
        candidate = root / name
        tried.append(str(candidate))
        if candidate.exists():
            return candidate
    fail('HERMESC_NOT_FOUND', ' '.join(tried))


def recovery_blocks(dump: str):
    """Collect every configuredRecoveryRedirect body, delimited by the next Function<.>."""
    blocks, current = [], None
    for line in dump.splitlines(keepends=True):
        if line.startswith('Function<'):
            if current is not None:
                blocks.append(''.join(current))
            current = [] if line.startswith(FUNCTION) else None
        if current is not None:
            current.append(line)
    if current is not None:
        blocks.append(''.join(current))
    return blocks


def main() -> int:
    if len(sys.argv) != 3:
        fail('USAGE', 'attest_recovery_redirect.py <apk> <receipt.json>')
    apk_path, receipt_path = Path(sys.argv[1]), Path(sys.argv[2])
    require(apk_path.is_file(), 'APK_NOT_FOUND', str(apk_path))

    apk_bytes = apk_path.read_bytes()
    apk_sha = hashlib.sha256(apk_bytes).hexdigest()

    with zipfile.ZipFile(apk_path) as archive:
        names = set(archive.namelist())
        require(BUNDLE in names, 'BUNDLE_NOT_PACKAGED', BUNDLE)
        bundle_bytes = archive.read(BUNDLE)
    bundle_sha = hashlib.sha256(bundle_bytes).hexdigest()

    compiler = hermesc()
    with tempfile.TemporaryDirectory() as workspace:
        bundle_file = Path(workspace) / 'index.android.bundle'
        bundle_file.write_bytes(bundle_bytes)
        process = subprocess.run(
            [str(compiler), '-dump-bytecode', '-b', str(bundle_file)],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding='utf8', errors='replace', timeout=300)
    require(process.returncode == 0, 'HERMES_DUMP_FAILED', 'exit ' + str(process.returncode))

    dump = process.stdout
    blocks = recovery_blocks(dump)
    require(len(blocks) == 1, 'EXACT_RECOVERY_FUNCTION_REQUIRED', 'found ' + str(len(blocks)))
    body = blocks[0]

    # The value must be baked in, not read from an environment the device lacks.
    # Most specific diagnosis first: a load-null body is what an absent value actually
    # produces, and saying so is more useful than "the constant is missing".
    require(not DISABLED.search(body), 'RECOVERY_COMPILED_DISABLED')
    require(loads_recovery_constant(body), 'RECOVERY_REDIRECT_NOT_COMPILED')
    require(ENV_NAME not in body, 'RECOVERY_ENV_LEFT_FOR_RUNTIME')

    # The body only ever shows a truncated operand, so confirm the exact, whole value
    # in the string table where Hermes prints it in full.
    strings = [match.group(1) for line in dump.splitlines()
               for match in [STRING_TABLE_ENTRY.match(line)] if match]
    require(RECOVERY in strings, 'RECOVERY_LITERAL_NOT_IN_STRING_TABLE')
    require(ENV_NAME not in strings, 'RECOVERY_ENV_NAME_PACKAGED')

    receipt = {
        'unit': 'PKG016_RECOVERY_REDIRECT_ATTESTATION',
        'gap': 'GAP-0007',
        'result': 'PASS',
        'recoveryRedirect': RECOVERY,
        'recoveryCompiledIntoBundle': True,
        'recoveryEnvLeftForRuntime': False,
        'recoveryCompiledDisabled': False,
        'recoveryFunctionSha256': hashlib.sha256(body.encode('utf8')).hexdigest(),
        'apkPath': str(apk_path),
        'apkSha256': apk_sha,
        'apkBytes': len(apk_bytes),
        'bundlePath': BUNDLE,
        'bundleSha256': bundle_sha,
        'hermesc': str(compiler),
        # Source binding: the artifact is only meaningful against an exact commit.
        'sourceCommit': os.environ.get('GITHUB_SHA'),
        'sourceTree': os.environ.get('USKOCI_SOURCE_TREE'),
        'workflowRunId': os.environ.get('GITHUB_RUN_ID'),
        'workflowRunAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
        'providerCalled': False,
        'liveWrites': False,
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

    print('PASS PKG016_RECOVERY_REDIRECT_ATTESTATION compiled_in_bundle no_runtime_env not_disabled exactly_one_function')
    print('apk_sha256=' + apk_sha)
    print('bundle_sha256=' + bundle_sha)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
