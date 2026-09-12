"""Pin a saved V5 candidate to the existing disposable test runner; never deploy."""
import argparse
import base64
import difflib
import json
import pathlib
import re
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True)
parser.add_argument('--apply', action='store_true', help='Save test control; existing push trigger starts one run.')
args = parser.parse_args()
assert re.fullmatch('[a-f0-9]{40}', args.source)
OUT = pathlib.Path(__file__).resolve().parent
REPO = 'repos/Uskoci1/USKOCI-CLEAN'
BRANCH = 'work/pre-v3-proof-runner-20260911'
PREVIOUS = 'af0910cd82a85586c4172475c85bab129835bc8e'


def api(path, body=None, method=None):
    command = ['gh', 'api', path]
    if method:
        command += ['--method', method]
    if body is not None:
        command += ['--input', '-']
    result = subprocess.run(command, input=json.dumps(body) if body is not None else None,
                            text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def source_file(path):
    obj = api(f'{REPO}/contents/{path}?ref={PREVIOUS}')
    return base64.b64decode(obj['content']).decode()


assert api(f'{REPO}/git/ref/heads/{BRANCH}')['object']['sha'] == PREVIOUS
assert api(f'{REPO}/git/ref/heads/work/pre-v3-engine-integration-20260911')['object']['sha'] == args.source
source = api(f'{REPO}/git/commits/{args.source}')
workflow = source_file('.github/workflows/pre-v3-isolated.yml')
assert '  contents: read' in workflow and '  contents: write' not in workflow
assert 'GH_TOKEN:' not in workflow and 'git push' not in workflow
assert 'apply_p12_source_correction.py' not in workflow and 'finalize_inventory.py' not in workflow
paths = ['.pre-v3/run.json', '.pre-v3/validate_inventory.py', '.pre-v3/package_checks.py']
before = {path: source_file(path) for path in paths}
run = json.loads(before[paths[0]])
assert run['sourceSha'] == '59101f38e8ae549ade434cae758938582fba2233'
assert run['regressionScope'] == 'FULL' and not run['focusedJest']
assert len(run['proofs']) == 9 and run['finalHistoryCount'] == 125
assert all(run[k] is False for k in ('applyP12OpenAIPrimary', 'alignP12ProviderTests', 'exportSource'))
assert all(run[k] is True for k in ('noLiveWrite', 'noProvider', 'noDevice'))
run.update(sourceSha=args.source, sourceTree=source['tree']['sha'], finalHistoryCount=127,
           purpose='Exact saved V5 source: full regression and disposable Auth/Postgres proofs through candidate127; no source mutation, live access, provider calls, device, deployment or release.')
run['proofs'] += [
    {'script': 'v5_review_acceptance_proof.mjs', 'report': 'v5-review-acceptance-report.json'},
    {'script': 'v5_ai_test_budget_proof.mjs', 'report': 'v5-ai-test-budget-report.json'},
]
inventory = before[paths[1]]
old = "assert re.fullmatch('20260912[0-9]{6}_clean_pre_v3_[a-z0-9_]+[.]sql',p.name),p.name"
new = "assert re.fullmatch('20260912[0-9]{6}_clean_pre_v3_[a-z0-9_]+[.]sql',p.name) or p.name in ('20260912213702_clean_v5_review_acceptance.sql','20260912214126_clean_v5_bounded_ai_test_budget.sql'),p.name"
assert inventory.count(old) == 1
inventory = inventory.replace(old, new)
checks = before[paths[2]]
old = "assert re.fullmatch('[a-z_]+_proof[.]mjs',name)"
new = "assert re.fullmatch('[a-z_]+_proof[.]mjs',name) or name in ('v5_review_acceptance_proof.mjs','v5_ai_test_budget_proof.mjs')"
assert checks.count(old) == 1
checks = checks.replace(old, new)
compile(inventory, paths[1], 'exec')
compile(checks, paths[2], 'exec')
after = {paths[0]: json.dumps(run, indent=2) + '\n', paths[1]: inventory, paths[2]: checks}
diff = ''.join(''.join(difflib.unified_diff(before[path].splitlines(True), after[path].splitlines(True),
                                         fromfile=path + '@' + PREVIOUS, tofile=path)) for path in paths)
(OUT / 'v5-control-update.diff').write_text(diff, encoding='utf-8', newline='\n')
receipt = {'previousControlCommit': PREVIOUS, 'sourceCommit': args.source, 'sourceTree': source['tree']['sha'],
           'changedFiles': paths, 'permissions': 'contents:read', 'sourceCorrectionFlags': False,
           'inventoryValidationOnly': True, 'fullRegression': True, 'expectedHistoryCount': 127,
           'expectedSqlReports': 17, 'noLiveWrite': True, 'noProvider': True, 'noDevice': True,
           'paidEasBuild': False, 'applied': False}
if args.apply:
    previous = api(f'{REPO}/git/commits/{PREVIOUS}')
    entries = []
    for path, content in after.items():
        blob = api(f'{REPO}/git/blobs', {'content': content, 'encoding': 'utf-8'}, 'POST')
        entries.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    tree = api(f'{REPO}/git/trees', {'base_tree': previous['tree']['sha'], 'tree': entries}, 'POST')
    commit = api(f'{REPO}/git/commits', {'message': 'test(v5): pin exact source through review and budget proofs',
                                      'tree': tree['sha'], 'parents': [PREVIOUS]}, 'POST')
    assert api(f'{REPO}/git/ref/heads/{BRANCH}')['object']['sha'] == PREVIOUS
    api(f'{REPO}/git/refs/heads/{BRANCH}', {'sha': commit['sha'], 'force': False}, 'PATCH')
    receipt.update(controlCommit=commit['sha'], controlTree=tree['sha'], applied=True, automaticPushTrigger=True)
(OUT / 'v5-control-update-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps(receipt))
