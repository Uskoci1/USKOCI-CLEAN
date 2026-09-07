#!/usr/bin/env python3
"""Verify original evidence linkage. Human original-map review remains required."""
import hashlib
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path, PurePosixPath

from shared_discovery_android_journey import CHECKPOINTS, assert_environment, card_ids, validate_fixture
from shared_discovery_map_pixels import compare_map_regions, summarize_map

INHERITED = (
    'INBOX_requester_one_event INBOX_role_empty INBOX_requester_read_all INBOX_bell_zero '
    'INBOX_worker_selection_unread INBOX_selection_opens_real_agreement INBOX_selection_read_confirmed '
    'INBOX_next_page_available INBOX_second_page_loaded INBOX_worker_read_all '
    'NAV_requester_tasks NAV_requester_new_task NAV_requester_agreements NAV_requester_profile '
    'NAV_profile_back NAV_inbox NAV_inbox_back NAV_same_account_worker_discovery '
    'NAV_same_account_worker_profile NAV_signed_out NAV_second_account_requester_empty '
    'NAV_second_account_profile NAV_second_account_worker_discovery NAV_task_detail NAV_task_detail_back '
    'NAV_worker_applications NAV_worker_agreements'
).split()


def digest(value):
    return hashlib.sha256(value).hexdigest()


def relative_source(path):
    value = PurePosixPath(path)
    if not isinstance(path, str) or not path or '\\' in path or value.is_absolute() or '..' in value.parts or ':' in path:
        raise ValueError('Artifact source path must be repository relative')
    return str(value)


def validate_report(fixture, report, postflight):
    source = fixture['sourceSha']
    assert report['sourceSha'] == postflight['sourceSha'] == source
    assert report['localOnly'] is postflight['localOnly'] is True
    assert report['productionProof'] is False and report['providerOfflineProven'] is False
    assert report['manualOriginalMapReviewRequired'] is True and report['noClearBetweenActors'] is True
    assert report['historicalBoundary'] == fixture['historicalBoundary']
    assert postflight['businessRowsUnchanged'] is True and postflight['historyUnchanged'] is True
    assert postflight['tables'] == fixture['beforeJourney']
    expected = sorted(row['id'] for row in fixture['allPublic'])
    for role in ('requester', 'worker'):
        assert report['scans'][role]['ids'] == expected
        assert 1 <= report['scans'][role]['originalPairs'] <= 65
    names = [row['name'] for row in report['checkpoints']]
    assert len(names) == len(set(names)) and set(CHECKPOINTS).issubset(names)
    for role in ('requester', 'worker'):
        assert all(f'DISCOVERY_{role}_scan_{index:02d}' in names
                   for index in range(report['scans'][role]['originalPairs']))
    for name, observed in report['maps'].items():
        assert name in names and observed['sampled_colors'] >= 30
        assert re.fullmatch(r'[0-9a-f]{64}', observed['region_sha256'])
    remote = report['maps']['DISCOVERY_remote_map_no_pin']
    assert remote['clusters'] == [] and remote['points'] == []
    for name in ('DISCOVERY_map_cluster', 'DISCOVERY_worker_map'):
        assert len(report['maps'][name]['clusters']) == 1 and len(report['maps'][name]['points']) == 1
    expanded = report['maps']['DISCOVERY_cluster_expanded']
    assert expanded['clusters'] == [] and len(expanded['points']) == 2
    assert report['selectedTaskId'] in {row['id'] for row in fixture['plan'][:2]}
    assert report['cameraBack']['mean_channel_delta'] <= 8
    assert report['cameraBack']['fraction_within16'] >= .94


def validate_original_observations(artifact, fixture, report):
    """Recompute native card IDs and map observations from original files, not report assertions alone."""
    title_ids = {row['title']: row['id'] for row in fixture['allPublic']}
    for role in ('requester', 'worker'):
        observed = set()
        for index in range(report['scans'][role]['originalPairs']):
            root = ET.fromstring((artifact / f'DISCOVERY_{role}_scan_{index:02d}.xml').read_bytes())
            observed.update(card_ids(root, title_ids))
        assert sorted(observed) == report['scans'][role]['ids'] == sorted(title_ids.values())
    for name, observed in report['maps'].items():
        assert summarize_map(artifact / f'{name}.png', observed['bounds']) == observed
    before, after = report['maps']['DISCOVERY_pin_selected'], report['maps']['DISCOVERY_map_back']
    assert compare_map_regions(artifact / 'DISCOVERY_pin_selected.png', before['bounds'],
                               artifact / 'DISCOVERY_map_back.png', after['bounds']) == report['cameraBack']


def main(env=os.environ):
    assert_environment(env)
    artifact, repo = Path(env['RU5_DEVICE_ARTIFACT_DIR']), Path(__file__).resolve().parent.parent
    read = lambda name: json.loads((artifact / name).read_text(encoding='utf-8'))
    fixture, report, postflight = (read(f'shared-discovery-{name}.json') for name in ('fixture', 'journey', 'postflight'))
    validate_fixture(fixture, env)
    validate_report(fixture, report, postflight)
    inherited = (artifact / 'proof.log').read_text(encoding='utf-8')
    combined = (artifact / 'shared-discovery-proof.log').read_text(encoding='utf-8')
    assert combined.startswith(inherited), 'Inherited27 original proof.log must be preserved'
    for token in ('PASS N04_PHYSICAL_INBOX', 'PASS PHYSICAL_INTENT_SHELL', 'PASS NAV_LOCAL_FIXTURE', 'CHECKPOINT GATES_UNCHANGED'):
        assert token in inherited
    for token in ('PASS SHARED_DISCOVERY_FIXTURE', 'PASS SHARED_DISCOVERY_PHYSICAL_ANDROID', 'PASS SHARED_DISCOVERY_POSTFLIGHT'):
        assert token in combined
    evidence = []
    recorded = {row['name']: row for row in report['checkpoints']}
    for name in INHERITED + list(recorded):
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
                if name in recorded:
                    assert b'LOCAL_ONLY_PRIVATE_DISCOVERY' not in raw and b'LOCAL_PRIVATE_ACCESS_NOTE' not in raw
        evidence.append(entry)
    validate_original_observations(artifact, fixture, report)
    build = read('shared-discovery-build.json')
    assert build['sourceSha'] == env['GITHUB_SHA'] and build['package'] == 'rs.uskoci.n04proof'
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=repo, check=True, capture_output=True, text=True).stdout.strip()
    assert head == env['GITHUB_SHA']
    paths = set()
    for item in build['source']:
        path = relative_source(item['path'])
        assert path not in paths
        paths.add(path)
        raw = subprocess.run(['git', 'show', f'{head}:{path}'], cwd=repo, check=True, capture_output=True).stdout
        assert len(raw) == item['bytes'] and digest(raw) == item['sha256']
        if path not in ('app.json', 'package.json'):
            assert (repo / path).read_bytes() == raw
    for required in ('package.json', 'package-lock.json', 'app.json', 'app.config.js', 'metro.config.cjs',
                     'src/data/discoveryClientService.ts', 'src/data/discoveryView.ts',
                     'src/data/discoveryBrowse.ts', 'src/data/discoveryFormat.ts', 'src/ui/discovery/DiscoveryMap.tsx',
                     'src/ui/discovery/DiscoveryBody.tsx', 'src/ui/discovery/DiscoveryFilters.tsx',
                     'src/app/(app)/prilike.tsx', 'src/app/(app)/potrebe.tsx',
                     'scripts/shared_discovery_fixture.mjs', 'scripts/shared_discovery_android_journey.py',
                     'scripts/shared_discovery_map_pixels.py', 'scripts/shared_discovery_validate.py'):
        assert required in paths, f'Missing actual build source fingerprint: {required}'
    apk = build['apk']
    assert apk['path'] == 'android/app/build/outputs/apk/release/app-release.apk'
    raw = (repo / apk['path']).read_bytes()
    assert len(raw) == apk['bytes'] and digest(raw) == apk['sha256']
    override = build['proofAppConfig']
    assert override['path'] == 'app.json' and override['package'] == 'rs.uskoci.n04proof'
    raw = (repo / 'app.json').read_bytes()
    assert len(raw) == override['bytes'] and digest(raw) == override['sha256']
    actual = json.loads(raw)['expo']
    assert actual['android']['package'] == override['package'] and actual['name'] == override['name']
    generated = build['proofPackage']
    assert generated['path'] == 'package.json'
    raw = (repo / 'package.json').read_bytes()
    assert len(raw) == generated['bytes'] and digest(raw) == generated['sha256']
    original_package = json.loads(subprocess.run(['git', 'show', f'{head}:package.json'], cwd=repo,
                                               check=True, capture_output=True).stdout)
    generated_package = json.loads(raw)
    for field in ('dependencies', 'devDependencies', 'overrides'):
        assert generated_package.get(field) == original_package.get(field), 'Prebuild changed dependency inputs'
    (artifact / 'shared-discovery-validation.json').write_text(json.dumps({
        'sourceSha': head, 'machineChecks': 'PASS', 'originalPairs': len(evidence), 'evidence': evidence,
        'apkSha256': apk['sha256'], 'inheritedProofLogSha256': digest(inherited.encode()),
        'manualOriginalMapReview': 'REQUIRED', 'providerOfflineProven': False, 'productionProof': False,
        'historicalBoundary': fixture['historicalBoundary'],
    }, indent=2) + '\n', encoding='utf-8')
    print('PASS SHARED_DISCOVERY_EVIDENCE machine_checks source_apk_original_pairs original27_preserved '
          'manual_original_map_review_required offline_provider_not_proven', flush=True)


if __name__ == '__main__':
    main()
