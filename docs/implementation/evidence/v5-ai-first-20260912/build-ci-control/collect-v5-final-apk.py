"""Apply path-only adaptations to the pinned collector, plus final config proof."""
import argparse
import hashlib
import json
from pathlib import Path
import re

BASE_SHA = 'ca90d09c46122e6355116a644e246337725fd70bf0815a49e8ed9cbffb8756e4'

def render_collector(base, tag):
    if not re.fullmatch(r'v5-final-[0-9a-f]{7}', tag):
        raise ValueError('FINAL_ARTIFACT_TAG_INVALID')
    if hashlib.sha256(base).hexdigest() != BASE_SHA:
        raise ValueError('REVIEWED_COLLECTOR_SOURCE_CHANGED')
    body = base.decode('utf8')
    replacements = {
        'build-v5-6d8f640-start.json': f'build-{tag}-start.json',
        'v5-6d8f640-gradle.log': f'{tag}-gradle.log',
        'USKOCI-V5-AI-FIRST-6d8f640.apk': f'USKOCI-V5-FINAL-{tag[-7:]}.apk',
        'build-v5-6d8f640-receipt.json': f'build-{tag}-receipt.json',
    }
    for before, after in replacements.items():
        if body.count(before) != 1:
            raise ValueError('COLLECTOR_PATH_ANCHOR_CHANGED')
        body = body.replace(before, after)
    anchor = 'with zipfile.ZipFile(apk) as archive:'
    if body.count(anchor) != 1:
        raise ValueError('COLLECTOR_APK_ANCHOR_CHANGED')
    body = body.replace(anchor,
        'from verify_final_build_config import attest_final_apk_configuration\n'
        'final_configuration = attest_final_apk_configuration(snapshot, apk, receipt)\n' + anchor)
    anchor = 'if not destination.exists(): shutil.copy2(apk, destination)'
    if body.count(anchor) != 1:
        raise ValueError('COLLECTOR_RECEIPT_ANCHOR_CHANGED')
    return body.replace(anchor,
        "receipt['finalPublicConfigurationAttestation'] = final_configuration\n"
        "receipt['finalBuildCollectorBaseSha256'] = '" + BASE_SHA + "'\n"
        "receipt['finalBuildHelperPins'] = {name: hashlib.sha256((here/name).read_bytes()).hexdigest() for name in "
        "['prepare-v5-final.py','collect-v5-final-apk.py','verify_final_build_config.py','run-v5-final.ps1']}\n" + anchor)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    args = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', args.source):
        raise ValueError('FULL_SOURCE_COMMIT_REQUIRED')
    here = Path(__file__).resolve().parent
    tag = 'v5-final-' + args.source[:7]
    start = json.loads((here / f'build-{tag}-start.json').read_text(encoding='utf8'))
    if start['sourceCommit'] != args.source:
        raise ValueError('START_SOURCE_MISMATCH')
    body = render_collector((here / 'collect-v5-6d8f640-apk.py').read_bytes(), tag)
    for name, digest in start['finalBuildHelperPins'].items():
        if hashlib.sha256((here/name).read_bytes()).hexdigest() != digest:
            raise ValueError('PREPARED_HELPER_CHANGED')
    # The original collector independently checks full Gradle success, clean
    # exact Git/source maps, byte-reproduced Hermes composition, signer/assets.
    exec(compile(body, str(here / f'collect-{tag}-rendered.py'), 'exec'), {'__file__': str(__file__)})

if __name__ == '__main__':
    main()
