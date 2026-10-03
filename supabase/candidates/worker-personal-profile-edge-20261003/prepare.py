"""Freeze only commit 4081d682's personal-profile delta over supplied live readbacks.

Local files only. Never calls Supabase or a model provider.
"""
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
COMMIT = '4081d682'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical_name(name):
    return 'supabase/' + name if name.startswith('functions/') else name


def show(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT).decode('utf-8')


def patch_entry(live, before, after):
    old, new = before.splitlines(), after.splitlines()
    lines = live.splitlines(keepends=True)
    groups = list(difflib.SequenceMatcher(a=old, b=new, autojunk=False).get_grouped_opcodes(3))
    for group in reversed(groups):
        start, end = group[0][1], group[-1][2]
        needle = old[start:end]
        values = [line.rstrip('\r\n') for line in lines]
        hits = [index for index in range(len(values) - len(needle) + 1) if values[index:index+len(needle)] == needle]
        assert len(hits) == 1, f'Live patch context is not unique: {start}:{end}, hits={hits}'
        position = hits[0]
        replacement = []
        for tag, i1, i2, j1, j2 in group:
            if tag == 'equal':
                replacement.extend(lines[position+i1-start:position+i2-start])
            elif tag in ('replace', 'insert'):
                nearby = lines[min(position+i1-start, len(lines)-1)]
                ending = '\r\n' if nearby.endswith('\r\n') else '\n'
                replacement.extend(value + ending for value in new[j1:j2])
        lines[position:position+len(needle)] = replacement
    patched = ''.join(lines)
    # Exact normalized hunks, not just the intended keywords, must match this commit.
    def changes(a, b):
        return [(tag, a[i:j], b[k:l]) for tag, i, j, k, l in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes() if tag != 'equal']
    assert changes(live.splitlines(), patched.splitlines()) == changes(old, new)
    return patched


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--live-dir', type=Path, required=True)
    args = parser.parse_args()
    manifest = {'status': 'PREPARED_NOT_APPLIED', 'projectId': 'leqcwgzvjsxugfgzdmth', 'sourceDeltaCommit': COMMIT,
                'scope': 'Personal worker interview and retired task licence proposals only',
                'excluded': ['Unapplied AI availability diagnostics', 'Provider/model/budget changes', 'SQL changes', 'Secrets/config changes'], 'functions': []}
    for label, filename, version, slug in [('worker', 'workerEdgeBeforeParsed.json', 17, 'uskoci-worker-interview'),
                                          ('task', 'taskEdgeBeforeParsed.json', 51, 'uskoci-ai-interview')]:
        live = json.loads((args.live_dir / filename).read_text(encoding='utf-8'))
        assert live['version'] == version and live['slug'] == slug and live['verify_jwt'] is True and live['import_map'] is False
        entry = f'supabase/functions/{slug}/index.ts'
        files = {canonical_name(file['name']): file['content'] for file in live['files']}
        assert len(files) == len(live['files']) and entry in files
        patched = patch_entry(files[entry], show(COMMIT+'^', entry), show(COMMIT, entry))
        assert 'aiAvailability' not in patched and 'GeminiCreditsUnavailableError' not in patched
        function = {'slug': slug, 'baselineVersion': version, 'verifyJwt': True, 'importMap': False,
                    'entrypoint': entry, 'beforeEzbrSha256': live['ezbr_sha256'], 'files': []}
        for path, content in files.items():
            before = content.encode('utf-8')
            after = (patched if path == entry else content).encode('utf-8')
            for state, data in [('before', before), ('after', after)]:
                target = OUT / label / state / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            assert path == entry or before == after
            function['files'].append({'path': path, 'beforeSha256': digest(before), 'afterSha256': digest(after),
                                      'changed': before != after, 'beforeBytes': len(before), 'afterBytes': len(after)})
        for state in ('before', 'after'):
            bundle = {'slug': slug, 'verify_jwt': True, 'entrypoint_path': entry,
                      'files': [{'name': path, 'content': (OUT/label/state/path).read_bytes().decode('utf-8')} for path in files]}
            (OUT/label/f'{state}-bundle.json').write_text(json.dumps(bundle, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
        diff = ''.join(difflib.unified_diff(files[entry].splitlines(keepends=True), patched.splitlines(keepends=True),
                                         fromfile=f'{slug}@{version}/{entry}', tofile=f'candidate/{entry}'))
        (OUT/label/'ENTRY.diff').write_text(diff, encoding='utf-8', newline='')
        manifest['functions'].append(function)
    (OUT/'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    proof = OUT / 'proof'
    proof.mkdir(exist_ok=True)
    worker_test = show(COMMIT, 'supabase/proofs/ai/v5_worker_edge.test.mjs')
    worker_test = worker_test.replace("const source=readFileSync(resolve(file),'utf8')", "const source=readFileSync(resolve('supabase/candidates/worker-personal-profile-edge-20261003/worker/after',file),'utf8')")
    worker_test = worker_test.replace(" const availability=evaluate('src/contracts/aiAvailability.ts');\n", '')
    worker_test = worker_test.replace("evaluate('supabase/functions/_shared/geminiTaskStream.ts',\n  {'../../../src/contracts/aiAvailability.ts':availability})", "evaluate('supabase/functions/_shared/geminiTaskStream.ts')")
    worker_test = worker_test.replace(",'../../../src/contracts/aiAvailability.ts':availability", '')
    worker_test = worker_test.replace(",\n  '../../../src/contracts/aiAvailability.ts':availability", '')
    assert 'availability}' not in worker_test
    (proof/'worker.candidate.test.mjs').write_text(worker_test, encoding='utf-8', newline='\n')
    task_test = show(COMMIT, 'supabase/proofs/ai/ai_edge_context.test.mjs')
    task_test = task_test.replace("const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');", "const root=resolve(dirname(fileURLToPath(import.meta.url)),'../task/after');")
    # Live v51 has no typed 402 diagnostic; its unchanged closed failure list is
    # still tested. Only the new, unapplied diagnostic-specific assertions go.
    begin = task_test.index('  // This existing typed provider-status error uses a shared literal')
    end = task_test.index('  for(const argument of thrown)', begin)
    task_test = task_test[:begin] + task_test[end:]
    (proof/'task.candidate.test.mjs').write_text(task_test, encoding='utf-8', newline='\n')
    (proof/'dialogue_fixture.mjs').write_text(show(COMMIT, 'supabase/proofs/ai/dialogue_fixture.mjs'), encoding='utf-8', newline='\n')
    print(json.dumps({'functions': [(row['slug'], row['baselineVersion'], len(row['files'])) for row in manifest['functions']], 'status': manifest['status']}))


if __name__ == '__main__':
    main()
