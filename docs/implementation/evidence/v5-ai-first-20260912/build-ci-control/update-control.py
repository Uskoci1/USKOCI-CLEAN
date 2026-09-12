"""One bounded, reversible CI-control update; no app-source, live, or release write."""
import base64
import difflib
import json
import pathlib
import subprocess

OUT = pathlib.Path(__file__).resolve().parent
REPO = 'repos/Uskoci1/USKOCI-CLEAN'
BRANCH = 'work/pre-v3-proof-runner-20260911'
PREVIOUS = '6f0fc604347ee29c81ee1ac8f8d8b084f0229a82'
SOURCE = '59101f38e8ae549ade434cae758938582fba2233'

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
source = api(f'{REPO}/git/commits/{SOURCE}')
assert api(f'{REPO}/git/ref/heads/work/pre-v3-engine-integration-20260911')['object']['sha'] == SOURCE
workflow_path = '.github/workflows/pre-v3-isolated.yml'
run_path = '.pre-v3/run.json'
inventory_path = '.pre-v3/finalize_inventory.py'
workflow = source_file(workflow_path)
run_old = source_file(run_path)
inventory = source_file(inventory_path)
for name, contents in ((workflow_path, workflow), (run_path, run_old), (inventory_path, inventory)):
    saved = OUT / ('before-' + pathlib.PurePosixPath(name).name)
    saved.write_text(contents, encoding='utf-8', newline='\n')
run = json.loads(run_old)
run.update(sourceSha=SOURCE, sourceTree=source['tree']['sha'],
           purpose='Exact59101f38 candidate125 correction replay: full source and real disposable Auth/Postgres proof; no source mutation, live access, provider, device, deployment or release.',
           applyP12OpenAIPrimary=False, alignP12ProviderTests=False, exportSource=False)
assert run['regressionScope'] == 'FULL' and run['finalHistoryCount'] == 125
assert len(run['proofs']) == 9
assert all(run[k] is True for k in ('noLiveWrite', 'noProvider', 'noDevice'))
run_new = json.dumps(run, indent=2) + '\n'
assert workflow.count('  contents: write') == 1
workflow_new = workflow.replace('  contents: write', '  contents: read')
workflow_new = workflow_new.replace('Pin source, apply explicitly requested correction, admit candidate-only inventory',
                                    'Pin unchanged exact source and validate candidate-only inventory')
old_steps = '''          GH_TOKEN: ${{ github.token }}
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
          test "$(git rev-parse HEAD^{tree})" = "$SOURCE_TREE"
          export GIT_CONFIG_COUNT=1
          export GIT_CONFIG_KEY_0=http.https://github.com/.extraheader
          export GIT_CONFIG_VALUE_0="AUTHORIZATION: basic $(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)"
          python3 ../control/.pre-v3/apply_p12_source_correction.py
          export SOURCE_SHA="$(git rev-parse HEAD)"
          export SOURCE_TREE="$(git rev-parse HEAD^{tree})"
          python3 ../control/.pre-v3/finalize_inventory.py'''
new_steps = '''        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
          test "$(git rev-parse HEAD^{tree})" = "$SOURCE_TREE"
          python3 ../control/.pre-v3/validate_inventory.py'''
assert workflow_new.count(old_steps) == 1
workflow_new = workflow_new.replace(old_steps, new_steps)
assert 'GH_TOKEN:' not in workflow_new and 'git push' not in workflow_new
assert 'apply_p12_source_correction.py' not in workflow_new
assert 'finalize_inventory.py' not in workflow_new
inventory_new = inventory.replace('"""Inventory-only commit. Never writes SQL/source, live DB, canonical or another branch."""',
                                  '"""Read-only exact-source inventory validation. No repository mutation or push."""')
inventory_new = inventory_new.replace("mp.write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\\n')",
                                      "assert mp.read_bytes()==(json.dumps(m,indent=2,ensure_ascii=False)+'\\n').encode(), 'CANDIDATE_PROVENANCE_BYTES_MISMATCH'")
inventory_new = inventory_new.replace("manifest.write_text(''.join(hashlib.md5(p.read_bytes()).hexdigest()+'  '+p.name+'\\n' for p in sorted(mdir.glob('*.sql'))))",
                                      "assert manifest.read_bytes()==''.join(hashlib.md5(p.read_bytes()).hexdigest()+'  '+p.name+'\\n' for p in sorted(mdir.glob('*.sql'))).encode(), 'CANDIDATE_MD5_MANIFEST_MISMATCH'")
begin = inventory_new.index("changed=git('diff','--name-only')")
end = inventory_new.index("head=git('rev-parse','HEAD')", begin)
inventory_new = inventory_new[:begin] + "assert not git('status','--porcelain'), 'EXACT_SOURCE_CHANGED'\n" + inventory_new[end:]
assert "['git','push'" not in inventory_new and "['git','commit'" not in inventory_new
assert 'mp.write_text(' not in inventory_new and 'manifest.write_text(' not in inventory_new
compile(inventory_new, 'validate_inventory.py', 'exec')
changes = {workflow_path: workflow_new, run_path: run_new, '.pre-v3/validate_inventory.py': inventory_new}
diff = ''.join(''.join(difflib.unified_diff(old.splitlines(True), new.splitlines(True), fromfile=path+'@'+PREVIOUS, tofile=path))
               for path, old, new in ((workflow_path,workflow,workflow_new),(run_path,run_old,run_new),('.pre-v3/validate_inventory.py','',inventory_new)))
(OUT/'control-update.diff').write_text(diff,encoding='utf-8',newline='\n')
# All files form one commit: its existing run.json push trigger starts exactly one test job.
previous = api(f'{REPO}/git/commits/{PREVIOUS}')
entries = []
for path, content in changes.items():
    blob = api(f'{REPO}/git/blobs', {'content':content,'encoding':'utf-8'}, 'POST')
    entries.append({'path':path,'mode':'100644','type':'blob','sha':blob['sha']})
tree = api(f'{REPO}/git/trees', {'base_tree':previous['tree']['sha'],'tree':entries}, 'POST')
commit = api(f'{REPO}/git/commits', {'message':'test(pre-v3): replay exact candidate125 without source mutation',
                                  'tree':tree['sha'],'parents':[PREVIOUS]}, 'POST')
assert api(f'{REPO}/git/ref/heads/{BRANCH}')['object']['sha'] == PREVIOUS
api(f'{REPO}/git/refs/heads/{BRANCH}', {'sha':commit['sha'],'force':False}, 'PATCH')
receipt={'previousControlCommit':PREVIOUS,'controlCommit':commit['sha'],'controlTree':tree['sha'],
         'sourceCommit':SOURCE,'sourceTree':source['tree']['sha'],'branch':BRANCH,'changedFiles':list(changes),
         'permissions':'contents:read','sourceCorrectionFlags':False,'inventoryValidationOnly':True,
         'fullRegression':True,'expectedHistoryCount':125,'noLiveWrite':True,'noProvider':True,'noDevice':True,
         'automaticPushTrigger':True,'paidEasBuild':False}
(OUT/'control-update-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps(receipt))
