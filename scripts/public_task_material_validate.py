#!/usr/bin/env python3
"""Recompute material observations from original PNG/XML and exact APK inputs."""
import hashlib
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

from public_task_material_android_journey import CHECKPOINTS, LEGACY_TEXT, normalize_text, validate_fixture, visible_text
from shared_discovery_android_journey import assert_environment
from shared_discovery_validate import INHERITED, relative_source

DETAIL = ('W04_cold_read_error W04_error_back_to_discovery W04_recovered_detail W04_cached_transport_error '
          'W04_offline_retry_no_cta W04_retry_restored W05_read_error W05_error_back_to_detail '
          'W04_after_composer_back W05_second_read_error W05_retry_recovered_without_submit '
          'W04_after_composer_recovery W04_actual_back_control W04_deadline_before '
          'W04_deadline_expired_without_rest W04_deadline_back').split()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def validate_report(fixture, report, postflight):
    assert report['sourceSha'] == postflight['sourceSha'] == fixture['sourceSha']
    assert report['localOnly'] is postflight['localOnly'] is True
    assert report['productionProof'] is report['closedEntryNativeProof'] is False
    assert report['noClearBetweenActors'] is report['noBusinessCommands'] is True
    for key in ('allPublicPrivateRowsUnchanged', 'schemaUnchanged', 'fullHistoryUnchanged', 'gatesUnchanged'):
        assert postflight[key] is True
    assert postflight['result'] == 'PASS' and postflight['tables'] == fixture['beforeJourney']
    names = [row['name'] for row in report['checkpoints']]
    assert len(names) == len(set(names)) and set(CHECKPOINTS).issubset(names)
    width, height = report['viewport']
    assert all(isinstance(value, int) and 100 <= value <= 10000 for value in (width, height))
    expected = {
        'MATERIAL_worker_rich': fixture['expectedSummaryText'] + fixture['expectedPublicText'],
        'MATERIAL_requester_rich': fixture['expectedSummaryText'] + fixture['expectedPublicText'],
        'MATERIAL_worker_legacy': [fixture['legacyNeedTitle'], *LEGACY_TEXT],
    }
    assert set(report['scans']) == set(expected)
    for name, values in expected.items():
        scan = report['scans'][name]
        assert 1 <= scan['originalPairs'] <= 22
        assert scan['observedExpected'] == sorted({normalize_text(value) for value in values})
        assert all(f'{name}_scan_{index:02d}' in names for index in range(scan['originalPairs']))


def validate_original_text(artifact, report):
    for name, scan in report['scans'].items():
        found = set()
        for index in range(scan['originalPairs']):
            root = ET.fromstring((artifact / f'{name}_scan_{index:02d}.xml').read_bytes())
            found.update(visible_text(root, *report['viewport']))
        assert set(scan['observedExpected']).issubset(found), 'Original visible native text differs from report'


def main(env=os.environ):
    assert_environment(env)
    artifact, repo = Path(env['RU5_DEVICE_ARTIFACT_DIR']), Path(__file__).resolve().parent.parent
    read = lambda name: json.loads((artifact / name).read_text(encoding='utf-8'))
    fixture, report, postflight = (read(f'public-task-material-{name}.json') for name in ('fixture', 'journey', 'postflight'))
    validate_fixture(fixture, env)
    validate_report(fixture, report, postflight)
    inherited = (artifact / 'proof.log').read_bytes()
    combined = (artifact / 'public-task-material-proof.log').read_bytes()
    assert combined.startswith(inherited), 'Original inherited43 proof log must be preserved'
    for token in ('PASS N04_PHYSICAL_INBOX', 'PASS PHYSICAL_INTENT_SHELL', 'PASS PHYSICAL_TASK_DETAIL_RECOVERY',
                  'PASS NAV_LOCAL_FIXTURE', 'CHECKPOINT GATES_UNCHANGED'):
        assert token.encode() in inherited
    for token in ('PASS PUBLIC_TASK_MATERIAL_READ_MATRIX', 'PASS PUBLIC_TASK_MATERIAL_PHYSICAL', 'PASS PUBLIC_TASK_MATERIAL_POSTFLIGHT'):
        assert token.encode() in combined
    operations = re.findall(r'^CHECKPOINT W04_LOCAL_REST_(STOPPED|RESTORED) id=([a-f0-9]{64})$',
                            (artifact / 'proof-detail.log').read_text(encoding='utf-8'), re.M)
    assert len(operations) == 10 and len({identifier for _, identifier in operations}) == 1
    assert [operation for operation, _ in operations] == ['STOPPED', 'RESTORED'] * 5
    recorded = {row['name']: row for row in report['checkpoints']}
    evidence = []
    for name in INHERITED + DETAIL + list(recorded):
        assert re.fullmatch(r'[A-Za-z0-9_]+', name)
        entry = {'name': name}
        for suffix in ('png', 'xml'):
            raw = (artifact / f'{name}.{suffix}').read_bytes()
            assert raw
            entry[suffix] = digest(raw)
            if name in recorded:
                assert entry[suffix] == recorded[name][suffix]
            if suffix == 'png':
                assert raw.startswith(b'\x89PNG\r\n\x1a\n')
            else:
                ET.fromstring(raw)
                assert b'LOCAL_PRIVATE_MATERIAL_' not in raw
        evidence.append(entry)
    validate_original_text(artifact, report)
    build = read('public-task-material-build.json')
    assert build['sourceSha'] == env['GITHUB_SHA'] and build['package'] == 'rs.uskoci.n04proof'
    git = lambda *args: subprocess.run(['git', *args], cwd=repo, check=True, capture_output=True).stdout
    head = git('rev-parse', 'HEAD').decode().strip()
    assert head == env['GITHUB_SHA']
    paths = set()
    for item in build['source']:
        path = relative_source(item['path'])
        assert path not in paths
        paths.add(path)
        raw = git('show', f'{head}:{path}')
        assert len(raw) == item['bytes'] and digest(raw) == item['sha256']
        if path not in ('app.json', 'package.json'):
            assert (repo / path).read_bytes() == raw
    for required in ('package.json', 'package-lock.json', 'app.json', 'app.config.js', 'metro.config.cjs',
                     'src/contracts/publicTaskDetail.ts', 'src/data/publicTaskDetailProjection.ts',
                     'src/data/discoveryClientService.ts', 'src/data/discoveryFormat.ts',
                     'src/ui/task/PublicTaskMaterial.tsx', 'src/app/(app)/prilike/[id].tsx',
                     'scripts/public_task_material_proof.mjs', 'scripts/public_task_material_android_journey.py',
                     'scripts/public_task_material_validate.py', 'scripts/public_task_material_run_journey.sh',
                     '.github/workflows/public-task-material-mobile-proof.yml'):
        assert required in paths, f'Missing frozen input: {required}'
    apk = build['apk']
    assert apk['path'] == 'android/app/build/outputs/apk/release/app-release.apk'
    raw = (repo / apk['path']).read_bytes()
    assert len(raw) == apk['bytes'] and digest(raw) == apk['sha256']
    for key, path in [('proofAppConfig', 'app.json'), ('proofPackage', 'package.json')]:
        item = build[key]
        assert item['path'] == path
        raw = (repo / path).read_bytes()
        assert len(raw) == item['bytes'] and digest(raw) == item['sha256']
    original_app, actual_app = json.loads(git('show', f'{head}:app.json')), json.loads((repo / 'app.json').read_bytes())
    original_app['expo'].setdefault('android', {})['package'] = 'rs.uskoci.n04proof'
    original_app['expo']['name'] = 'USKOČI MATERIAL PROOF'
    assert original_app == actual_app
    original_package = json.loads(git('show', f'{head}:package.json'))
    actual_package = json.loads((repo / 'package.json').read_bytes())
    original_scripts, actual_scripts = original_package.pop('scripts', {}), actual_package.pop('scripts', {})
    assert original_package == actual_package
    for key in original_scripts.keys() | actual_scripts.keys():
        if original_scripts.get(key) != actual_scripts.get(key):
            assert key in ('android', 'ios') and actual_scripts.get(key) == f'expo run:{key}'
    (artifact / 'public-task-material-validation.json').write_text(json.dumps({
        'sourceSha': head, 'machineChecks': 'PASS', 'inheritedOriginalPairs': 43, 'originalPairs': len(evidence),
        'evidence': evidence, 'apkSha256': apk['sha256'], 'inheritedProofLogSha256': digest(inherited),
        'closedEntryNativeProof': False, 'productionProof': False, 'manualOriginalReview': 'REQUIRED',
        'historicalBoundary': fixture['historicalBoundary'],
    }, indent=2) + '\n', encoding='utf-8')
    print('PASS PUBLIC_TASK_MATERIAL_EVIDENCE source_apk original43 five_restores visible_text_two_actors '
          'all_business_rows_unchanged closed_entry_sdk_only manual_original_review_required', flush=True)


if __name__ == '__main__':
    main()
