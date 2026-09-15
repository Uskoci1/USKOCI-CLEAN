"""Admit the saved self-reported identity145 proof to the existing disposable runner."""
import argparse
import base64
import difflib
import json
import pathlib
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--previous-control', required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
assert all(re.fullmatch('[a-f0-9]{40}', value) for value in (args.source, args.previous_control))
repo = 'repos/Uskoci1/USKOCI-CLEAN'
branch = 'work/pre-v3-proof-runner-20260911'
out = pathlib.Path(__file__).resolve().parent


def api(path, body=None, method=None):
    command = ['gh', 'api', path]
    if method:
        command += ['--method', method]
    if body is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def content(path, ref=args.previous_control):
    obj = api(f'{repo}/contents/{path}?ref={ref}')
    return base64.b64decode(obj['content']).decode()


assert api(f'{repo}/git/ref/heads/{branch}')['object']['sha'] == args.previous_control
assert api(f'{repo}/git/ref/heads/work/pre-v3-engine-integration-20260911')['object']['sha'] == args.source
source = api(f'{repo}/git/commits/{args.source}')
workflow = content('.github/workflows/pre-v3-isolated.yml')
assert '  contents: read' in workflow and '  contents: write' not in workflow
assert 'GH_TOKEN:' not in workflow and 'git push' not in workflow
assert 'apply_p12_source_correction.py' not in workflow and 'finalize_inventory.py' not in workflow
paths = ['.pre-v3/run.json', '.pre-v3/validate_inventory.py', '.pre-v3/package_checks.py']
before = {path: content(path) for path in paths}
config = json.loads(before[paths[0]])
assert config['regressionScope'] == 'FULL' and not config['focusedJest']
assert config['finalHistoryCount'] == 144 and len(config['proofs']) == 28
assert all(config[key] is False for key in ('applyP12OpenAIPrimary', 'alignP12ProviderTests', 'exportSource'))
assert all(config[key] is True for key in ('noLiveWrite', 'noProvider', 'noDevice'))
previous_source = config['sourceSha']
migration = '20260913080237_clean_v5_self_reported_identity_requirement.sql'
proof = 'v5_self_reported_identity_proof.mjs'
report = 'v5-self-reported-identity-report.json'
assert content('supabase/migrations/' + migration, args.source)
assert report in content('supabase/proofs/pre_v3/' + proof, args.source)
assert 'loadMediaRuntime' in content('supabase/proofs/ai/v5_media_deno_runtime.test.ts', args.source)
config.update(sourceSha=args.source, sourceTree=source['tree']['sha'], finalHistoryCount=145,
              purpose='Exact saved V5 source: full regression and disposable Auth/Postgres/Storage proofs through self-reported identity145; no source mutation, live access, provider calls, device, deployment or release.')
config['proofs'].append({'script': proof, 'report': report})
inventory = before[paths[1]]
anchor = "'20260913065130_clean_v5_agreement_private_photos.sql')"
assert inventory.count(anchor) == 1 and migration not in inventory
inventory = inventory.replace(anchor, anchor[:-1] + ',' + repr(migration) + ')')
checks = before[paths[2]]
anchor = "'v5_agreement_photos_proof.mjs')"
assert checks.count(anchor) == 1 and proof not in checks
checks = checks.replace(anchor, anchor[:-1] + ',' + repr(proof) + ')')
assert "('migration_integrity',['sh','supabase/migrations/check_md5.sh'])" in checks
assert "('deno_media_runtime'," in checks
assert 'validate-approved-dependencies.py' in checks and 'dependency_contract_tests' in checks
compile(inventory, paths[1], 'exec')
compile(checks, paths[2], 'exec')
after = {paths[0]: json.dumps(config, indent=2) + '\n', paths[1]: inventory, paths[2]: checks}
diff = ''.join(''.join(difflib.unified_diff(before[path].splitlines(True), after[path].splitlines(True),
                                         fromfile=path + '@' + args.previous_control, tofile=path)) for path in paths)
(out / 'extend145-control-update.diff').write_text(diff, encoding='utf-8', newline='\n')
receipt = {'previousControlCommit': args.previous_control, 'previousSourceCommit': previous_source,
           'sourceCommit': args.source, 'sourceTree': source['tree']['sha'], 'changedFiles': paths,
           'permissions': 'contents:read', 'sourceCorrectionFlags': False, 'inventoryValidationOnly': True,
           'fullRegression': True, 'expectedHistoryCount': 145, 'expectedSqlReports': 35,
           'dependencyContractUnchanged': True, 'denoMediaRuntime': '2.9.6 read-only production-loader smoke',
           'noLiveWrite': True, 'noProvider': True, 'noDevice': True, 'paidEasBuild': False, 'applied': False}
if args.apply:
    previous = api(f'{repo}/git/commits/{args.previous_control}')
    entries = []
    for path, value in after.items():
        blob = api(f'{repo}/git/blobs', {'content': value, 'encoding': 'utf-8'}, 'POST')
        entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    tree = api(f'{repo}/git/trees', {'base_tree': previous['tree']['sha'], 'tree': entries}, 'POST')
    commit = api(f'{repo}/git/commits', {'message': 'test(v5): admit exact self-reported identity proof145',
                                      'tree': tree['sha'], 'parents': [args.previous_control]}, 'POST')
    assert api(f'{repo}/git/ref/heads/{branch}')['object']['sha'] == args.previous_control
    api(f'{repo}/git/refs/heads/{branch}', {'sha': commit['sha'], 'force': False}, 'PATCH')
    receipt.update(controlCommit=commit['sha'], controlTree=tree['sha'], applied=True, automaticPushTrigger=True)
(out / 'extend145-control-update-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(receipt))
