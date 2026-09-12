"""Exact approved source lock, with the historical dependency delta kept bounded."""
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

BASE = '06d51ecb1438a93a4ecce64692ff868474fca598'
APPROVED = 'a5bd754d3c672fcd97b6208eb7cc15d7608b298b'
ADDITIONS = {
    'dependencies': {'expo-image-manipulator': '~57.0.17', 'expo-image-picker': '~57.0.17'},
    'devDependencies': {'@imagemagick/magick-wasm': '0.0.43'},
}
LOCK_ADDITIONS = {
    'node_modules/@imagemagick/magick-wasm': '0.0.43',
    'node_modules/expo-image-loader': '57.0.1',
    'node_modules/expo-image-manipulator': '57.0.17',
    'node_modules/expo-image-picker': '57.0.17',
}
FILES = ('package.json', 'package-lock.json')


def with_additions(value):
    expected = copy.deepcopy(value)
    for group, additions in ADDITIONS.items():
        assert not set(expected[group]).intersection(additions), 'ADDITION_ALREADY_IN_BASELINE'
        expected[group].update(additions)
    return expected


def validate_delta(baseline, approved):
    assert approved['package.json'] == with_additions(baseline['package.json']), 'UNEXPECTED_PACKAGE_DELTA'
    before, after = baseline['package-lock.json'], approved['package-lock.json']
    assert {key: value for key, value in before.items() if key != 'packages'} == {
        key: value for key, value in after.items() if key != 'packages'}, 'LOCK_METADATA_CHANGED'
    old, new = before['packages'], after['packages']
    assert set(new) - set(old) == set(LOCK_ADDITIONS), 'UNEXPECTED_LOCK_ADDITION'
    assert not set(old) - set(new), 'HISTORICAL_LOCK_RECORD_REMOVED'
    assert new[''] == with_additions(old['']), 'UNEXPECTED_ROOT_LOCK_DELTA'
    for name in old:
        if name:
            assert old[name] == new[name], 'HISTORICAL_LOCK_RECORD_CHANGED:' + name
    for name, version in LOCK_ADDITIONS.items():
        record = new[name]
        assert record['version'] == version, 'UNAPPROVED_ADDITION_VERSION:' + name
        assert record['resolved'].startswith('https://registry.npmjs.org/'), 'NON_REGISTRY_ADDITION'
        assert re.fullmatch(r'sha512-[A-Za-z0-9+/]+={0,2}', record['integrity']), 'MISSING_ADDITION_INTEGRITY'


def validate_exact_files(working, source, approved):
    for path in FILES:
        assert working[path] == source[path], 'INSTALLED_WORKTREE_DIFFERS_FROM_SOURCE:' + path
        assert source[path] == approved[path], 'SOURCE_DEPENDENCIES_NOT_APPROVED:' + path


def main():
    source_sha = os.environ['PRE_V3_SOURCE_SHA']
    assert re.fullmatch('[a-f0-9]{40}', source_sha)
    assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip() == source_sha
    read = lambda revision, path: subprocess.check_output(['git', 'show', revision + ':' + path])
    baseline = {path: read(BASE, path) for path in FILES}
    approved = {path: read(APPROVED, path) for path in FILES}
    source = {path: read(source_sha, path) for path in FILES}
    working = {path: Path(path).read_bytes() for path in FILES}
    validate_delta({path: json.loads(data) for path, data in baseline.items()},
                   {path: json.loads(data) for path, data in approved.items()})
    validate_exact_files(working, source, approved)
    print(json.dumps({'result': 'PASS', 'historicalBaseline': BASE, 'approvedDependencySource': APPROVED,
                      'sourceCommit': source_sha, 'historicalEntriesUnchanged': True,
                      'approvedRootAdditions': ADDITIONS, 'approvedLockAdditions': LOCK_ADDITIONS,
                      'exactPostInstallFiles': {path: hashlib.sha256(data).hexdigest() for path, data in working.items()}}))


if __name__ == '__main__':
    main()
