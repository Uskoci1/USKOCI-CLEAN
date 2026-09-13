"""Read Git objects and observed metadata; never connect to or mutate live services."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
args = parser.parse_args()
assert re.fullmatch(r'[0-9a-f]{40}', args.source), 'An exact source commit is required'
def git(*arguments):
    return subprocess.check_output(['git', *arguments], cwd=root)
def blob(path):
    return git('show', f'{args.source}:{path}')

baseline = json.loads((root / 'docs/implementation/v5-ai-first/LIVE_READONLY_BASELINE.json').read_text(encoding='utf-8'))
assert baseline['projectRef'] == 'leqcwgzvjsxugfgzdmth'
assert baseline['migrationCount'] == len(baseline['migrations']) == 108
assert baseline['head'] == baseline['migrations'][-1]
provenance = json.loads(blob('supabase/migrations/MIGRATION_PROVENANCE.json'))
pending = {row['file']: row for row in provenance['pending_forward_migrations']}
manifest = dict(reversed(line.split('  ', 1)) for line in blob('supabase/migrations/MD5_MANIFEST.txt').decode().splitlines())
files = git('ls-tree', '-r', '--name-only', args.source, 'supabase/migrations').decode().splitlines()
rows = []
for file in files:
    name = Path(file).name
    if not re.fullmatch(r'[0-9]{14}_[a-z0-9_]+[.]sql', name) or name[:14] <= baseline['head']['version']:
        continue
    source = blob(file)
    record = pending[name]
    sha = hashlib.sha256(source).hexdigest()
    md5 = hashlib.md5(source).hexdigest()
    assert record['live_applied'] is False and b'\r' not in source
    assert record['raw_sha256'] == sha and record['raw_md5'] == manifest[name] == md5
    assert record['raw_bytes'] == len(source)
    rows.append({'ordinal': 109 + len(rows), 'file': file, 'version': name[:14],
                 'name': name[15:-4], 'sha256': sha, 'md5': md5, 'bytes': len(source)})
assert rows and rows[0]['name'] == 'clean_pre_v3_worker_capacity'
edge_files = git('ls-tree', '-r', '--name-only', args.source, 'supabase/functions').decode().splitlines()
edges = [{'name': Path(path).parent.name, 'entrypoint': path, 'entrypointSha256': hashlib.sha256(blob(path)).hexdigest()}
         for path in edge_files if path.endswith('/index.ts') and Path(path).parent.name.startswith('uskoci-')]
subprocess.run(['node', str(root / 'scripts/prepare-v5-edge-payloads.cjs'), '--source', args.source],
               cwd=root, check=True, stdout=subprocess.PIPE)
payload_manifest_path = Path('artifacts/v5-edge-payloads') / args.source / 'manifest.json'
payload_manifest_bytes = (root / payload_manifest_path).read_bytes()
payload_manifest = json.loads(payload_manifest_bytes)
assert payload_manifest['sourceCommit'] == args.source
assert payload_manifest['sourceTree'] == git('rev-parse', f'{args.source}^{{tree}}').decode().strip()
prepared = {item['name']: item for item in payload_manifest['functions']}
assert set(prepared) == {edge['name'] for edge in edges}
for edge in edges:
    payload = prepared[edge['name']]
    assert payload['entrypoint'] == edge['entrypoint'] and payload['verifyJwt'] is True
    assert next(item['sha256'] for item in payload['files'] if item['name'] == edge['entrypoint']) == edge['entrypointSha256']
    edge.update(preparedVerifyJwt=True, preparedPayloadSha256=payload['payloadSha256'],
                preparedPayloadBytes=payload['payloadBytes'], sourceFiles=payload['files'],
                externalDependencies=payload['externalDependencies'])
result = {'status': 'PREPARATION_ONLY_NOT_APPROVED_OR_APPLIED', 'sourceCommit': args.source,
          'sourceTree': git('rev-parse', f'{args.source}^{{tree}}').decode().strip(),
          'projectRef': baseline['projectRef'], 'observedBaseline': {'count': 108, 'head': baseline['head']},
          'migrations': rows, 'edgeEntrypoints': edges,
          'edgeDependencyBinding': 'Complete exact source tree; entrypoint hashes alone are not deployed bundle proof',
          'edgePayloadPreparation': {'manifest': payload_manifest_path.as_posix(),
                                     'manifestSha256': hashlib.sha256(payload_manifest_bytes).hexdigest(),
                                     'status': 'LOCAL_EXACT_SOURCE_PAYLOADS_NOT_DEPLOYED'},
          'liveApproval': None, 'paidProbeApprovalForThisBatch': None,
          'requiredBeforeApproval': ['Complete exact-source disposable proof', 'Reviewed forward backfills and postflight/stop plan',
                                    'Exact provider-key to paid-project association plan', 'Specific executable policy documents and test accounts'],
          'operationsPerformed': ['Read local Git objects and previously observed baseline', 'Write this candidate manifest']}
destination = root / 'docs/implementation/v5-ai-first/LIVE_BATCH_CANDIDATE.json'
destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'source': args.source, 'migrations': len(rows), 'from': rows[0]['ordinal'],
                  'through': rows[-1]['ordinal'], 'edges': len(edges), 'liveChanged': False}))
