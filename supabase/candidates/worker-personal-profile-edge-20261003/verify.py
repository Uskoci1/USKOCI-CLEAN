"""Read-only verification of the frozen files and deployable import closure."""
import hashlib
import json
from pathlib import Path
import re

root = Path(__file__).resolve().parent
manifest = json.loads((root/'MANIFEST.json').read_text(encoding='utf-8'))
results = []
for function in manifest['functions']:
    label = 'worker' if function['slug'] == 'uskoci-worker-interview' else 'task'
    assert function['verifyJwt'] is True and function['importMap'] is False
    expected = {row['path']: row for row in function['files']}
    for state in ('before', 'after'):
        bundle = json.loads((root/label/f'{state}-bundle.json').read_text(encoding='utf-8'))
        assert bundle['verify_jwt'] is True and bundle['entrypoint_path'] == function['entrypoint']
        assert set(file['name'] for file in bundle['files']) == set(expected)
        for file in bundle['files']:
            path = file['name']
            content = (root/label/state/path).read_bytes()
            assert content == file['content'].encode('utf-8')
            assert hashlib.sha256(content).hexdigest() == expected[path][state+'Sha256']
            assert len(content) == expected[path][state+'Bytes']
            for imported in re.findall(r"\bfrom\s+['\"]([^'\"]+)['\"]", content.decode('utf-8')):
                assert imported.startswith('.'), f'Unreviewed external dependency {imported}'
                resolved = ((root/label/state/path).parent/imported).resolve()
                assert resolved.is_relative_to((root/label/state).resolve()) and resolved.is_file(), f'Missing import {path}: {imported}'
            assert ('aiAvailability' not in content.decode('utf-8'))
    assert [row['path'] for row in function['files'] if row['changed']] == [function['entrypoint']]
    results.append({'slug': function['slug'], 'baselineVersion': function['baselineVersion'],
                    'entrySha256': expected[function['entrypoint']]['afterSha256'], 'files': len(expected)})
print(json.dumps({'status': 'VERIFIED_FROZEN_FILES_ONLY', 'functions': results}, indent=2))
