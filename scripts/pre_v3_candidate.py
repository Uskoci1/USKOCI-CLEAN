"""Reuse the isolated candidate protocol: exact hashes, Git objects only, no ref/live writes."""
import base64, hashlib, json, os, pathlib, re, subprocess, sys, urllib.request, zlib
REPO = 'Uskoci1/USKOCI-CLEAN'
BRANCH = 'work/pre-v3-proof-repair-20260911'
CONTROL = pathlib.Path(__file__).resolve().parents[1]
MAX_BYTES = 2 * 1024 * 1024
ALLOWED = {
    'scripts/task_detail_read_preflight.mjs',
    'scripts/task_detail_read_preflight.test.mjs',
    'supabase/proofs/ai/ai_draft_authority_predecessor.test.mjs',
    'supabase/proofs/calendar/w02_calendar_integrity_loader.test.mjs',
    'supabase/proofs/calendar/w02_calendar_integrity_proof.mjs',
    'supabase/proofs/completion/p0e_completion_guards_predecessor.test.mjs',
    'supabase/proofs/historical_predecessor_fixture.mjs',
}
def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()
def request():
    raw = (CONTROL / '.pre-v3/request.json').read_bytes()
    if len(raw) > MAX_BYTES: raise ValueError('REQUEST_TOO_LARGE')
    doc = json.loads(raw)
    if doc['repository'] != REPO or doc['targetBranch'] != BRANCH: raise ValueError('WRONG_TARGET')
    for key in ('base', 'baseTree', 'expectedTree'):
        if not re.fullmatch('[0-9a-f]{40}', doc[key]): raise ValueError('INVALID_GIT_HASH')
    if {f['path'] for f in doc['files']} != ALLOWED or len(doc['files']) != len(ALLOWED): raise ValueError('WRONG_FILE_SET')
    for row in doc['files']:
        for key in ('beforeSha256', 'afterSha256'):
            if row[key] is not None and not re.fullmatch('[0-9a-f]{64}', row[key]): raise ValueError('INVALID_FILE_HASH')
        if row['afterSha256'] is None: raise ValueError('DELETION_NOT_ALLOWED')
    if not re.fullmatch('[0-9a-f]{64}', doc['patchSha256']): raise ValueError('INVALID_PATCH_HASH')
    if not isinstance(doc['message'], str) or len(doc['message']) > 500: raise ValueError('INVALID_MESSAGE')
    return doc

def check_files(doc, key):
    for row in doc['files']:
        path = pathlib.Path(row['path'])
        if path.is_symlink(): raise ValueError('SYMLINK_NOT_ALLOWED')
        expected = row[key]
        if expected is None:
            if path.exists(): raise ValueError('EXPECTED_NEW_FILE')
        elif not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('FILE_HASH_MISMATCH:' + row['path'])

def api(method, suffix, data=None):
    if (method, suffix) not in [('POST', 'git/trees'), ('POST', 'git/commits'), ('GET', 'git/ref/heads/' + BRANCH)]:
        raise ValueError('ENDPOINT_NOT_ALLOWED')
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode()
    req = urllib.request.Request('https://api.github.com/repos/' + REPO + '/' + suffix, data=body, method=method,
        headers={'Authorization': 'Bearer ' + os.environ['CANDIDATE_GITHUB_TOKEN'], 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'})
    with urllib.request.urlopen(req, timeout=30) as response: return json.load(response)

def main():
    if os.environ.get('GITHUB_REPOSITORY') != REPO: raise ValueError('WRONG_REPOSITORY')
    doc = request()
    mode = sys.argv[1]
    if mode == 'request':
        with open(os.environ['GITHUB_OUTPUT'], 'a') as out: out.write('base=' + doc['base'] + '\n')
        return
    if mode != 'candidate': raise ValueError('UNKNOWN_MODE')
    if git('rev-parse', 'HEAD') != doc['base'] or git('rev-parse', 'HEAD^{tree}') != doc['baseTree']: raise ValueError('BASE_MISMATCH')
    check_files(doc, 'beforeSha256')
    stream = zlib.decompressobj()
    patch = stream.decompress(base64.b64decode(doc['compressedPatch'], validate=True), MAX_BYTES + 1)
    if len(patch) > MAX_BYTES or not stream.eof or stream.unused_data or stream.unconsumed_tail: raise ValueError('INVALID_PATCH_STREAM')
    if hashlib.sha256(patch).hexdigest() != doc['patchSha256']: raise ValueError('PATCH_HASH_MISMATCH')
    patch_path = pathlib.Path(os.environ['RUNNER_TEMP']) / 'pre-v3.patch'
    patch_path.write_bytes(patch)
    subprocess.run(['git', 'apply', '--check', '--index', str(patch_path)], check=True)
    subprocess.run(['git', 'apply', '--index', str(patch_path)], check=True)
    if set(git('diff', '--cached', '--name-only').splitlines()) != ALLOWED: raise ValueError('PATCH_SCOPE_MISMATCH')
    check_files(doc, 'afterSha256')
    subprocess.run(['git', 'diff', '--cached', '--check'], check=True)
    if git('write-tree') != doc['expectedTree']: raise ValueError('TREE_MISMATCH')
    if api('GET', 'git/ref/heads/' + BRANCH)['object']['sha'] != doc['base']: raise ValueError('TARGET_MOVED')
    entries = [{'path': row['path'], 'mode': '100644', 'type': 'blob', 'content': pathlib.Path(row['path']).read_text()} for row in doc['files']]
    tree = api('POST', 'git/trees', {'base_tree': doc['baseTree'], 'tree': entries})
    if tree['sha'] != doc['expectedTree']: raise ValueError('REMOTE_TREE_MISMATCH')
    commit = api('POST', 'git/commits', {'message': doc['message'] + '\n\nExact source candidate; testing follows on this commit. No ref, merge, live or provider mutation.\nPatch SHA256: ' + doc['patchSha256'], 'tree': tree['sha'], 'parents': [doc['base']]})
    out = pathlib.Path(os.environ['RUNNER_TEMP']) / 'pre-v3-evidence'
    out.mkdir(exist_ok=True)
    receipt = {'base': doc['base'], 'candidateCommit': commit['sha'], 'candidateTree': tree['sha'], 'patchSha256': doc['patchSha256'], 'files': doc['files'], 'branchUpdated': False, 'tested': False}
    (out / 'candidate-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output: output.write('candidate=' + commit['sha'] + '\n')
    print(json.dumps(receipt, indent=2))
if __name__ == '__main__': main()
