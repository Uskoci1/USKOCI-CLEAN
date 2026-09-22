"""Check the downloaded CI APK against its two attestations and expected ABI."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('run')
parser.add_argument('commit')
parser.add_argument('abi', choices=['arm64-v8a', 'x86_64'])
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent
directory = root / 'apk' / args.run
apk = directory / 'USKOCI-DEV.apk'
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
assert digest == (directory / 'USKOCI-DEV.apk.sha256').read_text().split()[0]
tree = subprocess.check_output(['git', 'rev-parse', args.commit + '^{tree}'], text=True).strip()
for name in ['recovery', 'icon']:
    report = json.loads((directory / f'USKOCI-DEV-{name}-attestation.json').read_text())
    assert report['result'] == 'PASS'
    assert report['apkSha256'] == digest
    assert report['sourceCommit'] == args.commit
    assert report['sourceTree'] == tree
    assert report['workflowRunId'] == args.run
with zipfile.ZipFile(apk) as archive:
    names = archive.namelist()
    abis = sorted({name.split('/')[1] for name in names if name.startswith('lib/') and name.endswith('.so')})
    assert abis == [args.abi], abis
    assert f'lib/{args.abi}/libreactnative.so' in names
result = {
    'run': args.run, 'sourceCommit': args.commit, 'sourceTree': tree,
    'sha256': digest, 'bytes': apk.stat().st_size, 'abis': abis,
    'reactNativeLibraryPresent': True, 'attestations': 'PASS', 'result': 'PASS'
}
(directory / 'local-artifact-verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
