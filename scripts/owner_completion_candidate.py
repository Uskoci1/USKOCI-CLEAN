"""Bounded, one-request candidate verification. Never updates a branch or live data."""
import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import urllib.request
import zlib

REPO = 'Uskoci1/USKOCI-CLEAN'
TARGET_BRANCH = 'feat/owner-completion-20260911'
MAX_BYTES = 2 * 1024 * 1024
CONTROL = Path(__file__).resolve().parents[1]
REQUEST = CONTROL / '.owner-completion/request.json'


def git(*args):
    return subprocess.check_output(['git', *args]).decode().strip()


def request():
    raw = REQUEST.read_bytes()
    if len(raw) > MAX_BYTES:
        raise ValueError('REQUEST_TOO_LARGE')
    doc = json.loads(raw)
    if doc['repository'] != REPO or doc['targetBranch'] != TARGET_BRANCH:
        raise ValueError('WRONG_TARGET')
    if not re.fullmatch(r'[0-9a-f]{40}', doc['base']):
        raise ValueError('INVALID_BASE')
    if not (1 <= len(doc['files']) <= 60):
        raise ValueError('INVALID_FILE_COUNT')
    names = []
    for row in doc['files']:
        name = row['path']
        path = PurePosixPath(name)
        if (not name.startswith('src/') or path.is_absolute() or '..' in path.parts or
                '\\' in name or name != str(path) or not name.endswith(('.ts', '.tsx'))):
            raise ValueError('SOURCE_PATH_NOT_ALLOWED')
        for key in ('beforeSha256', 'afterSha256'):
            if row[key] is not None and not re.fullmatch(r'[0-9a-f]{64}', row[key]):
                raise ValueError('INVALID_FILE_HASH')
        if row['afterSha256'] is None:
            raise ValueError('DELETION_NOT_ADMITTED_IN_THIS_BATCH')
        names.append(name)
    if len(names) != len(set(names)):
        raise ValueError('DUPLICATE_PATH')
    if not re.fullmatch(r'[0-9a-f]{64}', doc['patchSha256']):
        raise ValueError('INVALID_PATCH_HASH')
    return doc


def api(method, suffix, data=None):
    # Only repository Git objects can be created. No ref/merge/deploy endpoint.
    if method == 'POST' and suffix not in ('git/trees', 'git/commits'):
        raise ValueError('WRITE_ENDPOINT_NOT_ALLOWED')
    url = f'https://api.github.com/repos/{REPO}/{suffix}'
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode()
    req = urllib.request.Request(url, data=body, method=method, headers={
        'Authorization': 'Bearer ' + os.environ['CANDIDATE_GITHUB_TOKEN'],
        'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
    })
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def check_files(doc, key):
    for row in doc['files']:
        path = Path(row['path'])
        if path.is_symlink():
            raise ValueError('SYMLINK_NOT_ALLOWED')
        expected = row[key]
        if expected is None:
            if path.exists():
                raise ValueError('EXPECTED_NEW_PATH')
        elif not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('FILE_HASH_MISMATCH:' + row['path'])


def main():
    if os.environ.get('GITHUB_REPOSITORY') != REPO:
        raise ValueError('WRONG_REPOSITORY')
    mode = sys.argv[1]
    doc = request()
    if mode == 'request':
        with open(os.environ['GITHUB_OUTPUT'], 'a') as out:
            out.write('base=' + doc['base'] + '\n')
        return
    if git('rev-parse', 'HEAD') != doc['base']:
        raise ValueError('CHECKOUT_BASE_MISMATCH')
    if mode == 'apply':
        check_files(doc, 'beforeSha256')
        encoded = ''.join(doc['compressedPatch'])
        stream = zlib.decompressobj()
        patch = stream.decompress(base64.b64decode(encoded, validate=True), MAX_BYTES + 1)
        if len(patch) > MAX_BYTES or not stream.eof or stream.unused_data or stream.unconsumed_tail:
            raise ValueError('INVALID_COMPRESSED_PATCH')
        if hashlib.sha256(patch).hexdigest() != doc['patchSha256']:
            raise ValueError('PATCH_HASH_MISMATCH')
        path = Path(os.environ['RUNNER_TEMP']) / 'owner-completion.patch'
        path.write_bytes(patch)
        subprocess.run(['git', 'apply', '--check', '--index', str(path)], check=True)
        subprocess.run(['git', 'apply', '--index', str(path)], check=True)
        changed = git('diff', '--cached', '--name-only').splitlines()
        if sorted(changed) != sorted(row['path'] for row in doc['files']):
            raise ValueError('PATCH_PATHS_MISMATCH')
        check_files(doc, 'afterSha256')
        git('diff', '--cached', '--check')
        print(json.dumps({'base': doc['base'], 'patchSha256': doc['patchSha256'], 'files': changed}))
        return
    if mode != 'publish':
        raise ValueError('UNKNOWN_OPERATION')
    # Publish is reached only after locked dependency installation, tsc and the
    # entire Jest suite passed. Preserve the exact tested staged source tree.
    check_files(doc, 'afterSha256')
    subprocess.run(['git', 'diff', '--quiet'], check=True)
    current = api('GET', 'git/ref/heads/' + TARGET_BRANCH)
    if current['object']['sha'] != doc['base']:
        raise ValueError('TARGET_MOVED_REBASE_REQUIRED')
    parent_tree = git('rev-parse', 'HEAD^{tree}')
    expected_tree = git('write-tree')
    entries = []
    for row in doc['files']:
        name = row['path']
        indexed = git('ls-files', '-s', '--', name).split()[0]
        if indexed != '100644':
            raise ValueError('FILE_MODE_NOT_ALLOWED')
        entries.append({'path': name, 'mode': '100644', 'type': 'blob', 'content': Path(name).read_text(encoding='utf-8')})
    tree = api('POST', 'git/trees', {'base_tree': parent_tree, 'tree': entries})
    if tree['sha'] != expected_tree:
        raise ValueError('REMOTE_TREE_DIFFERS_FROM_TESTED_INDEX')
    message = 'Verify owner-requested source continuation\n\nOwner-requested continuation; exact staged source passed TypeScript and full Jest on GitHub Actions. No SQL, production, provider or device acceptance is implied.\nPatch SHA256: ' + doc['patchSha256']
    commit = api('POST', 'git/commits', {'message': message, 'tree': tree['sha'], 'parents': [doc['base']]})
    receipt = {'base': doc['base'], 'candidateCommit': commit['sha'], 'candidateTree': tree['sha'],
               'patchSha256': doc['patchSha256'], 'files': doc['files'], 'runId': os.environ['GITHUB_RUN_ID'],
               'typescript': 'PASS', 'fullJest': 'PASS', 'branchUpdated': False, 'productionChanged': False,
               'deviceProven': False, 'providerProven': False, 'completeOwnerCommand': False}
    out = Path(os.environ['RUNNER_TEMP']) / 'owner-completion-evidence'
    out.mkdir(exist_ok=True)
    (out / 'candidate-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
