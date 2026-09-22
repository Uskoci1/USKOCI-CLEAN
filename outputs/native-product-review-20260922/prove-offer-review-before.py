"""Run only the four new isolated review regressions against the committed predecessor."""
from pathlib import Path
import json
import shutil
import subprocess

path = Path('src/ui/v2/ApplicationSelectionPresentation.tsx')
current = path.read_bytes()
old = subprocess.check_output(['git', 'show', '6d3c7ead:src/ui/v2/ApplicationSelectionPresentation.tsx'])
output = Path('outputs/native-product-review-20260922')
try:
    path.write_bytes(old)
    with (output / 'offer-review-before.log').open('w', encoding='utf-8') as log:
        result = subprocess.run([
            shutil.which('npx.cmd'), 'jest', 'src/data/__tests__/application-selection-native.test.tsx',
            '--runInBand', '--silent', '--testNamePattern',
            'reviews an offer without|a retained review cannot|invalidates a review when|reviews flexible time',
            '--json', '--outputFile', str(output / 'jest-offer-review-before.json')
        ], stdout=log, stderr=subprocess.STDOUT)
finally:
    if path.read_bytes() != old:
        raise RuntimeError('Concurrent edit detected; saved current bytes retained in memory, do not overwrite')
    path.write_bytes(current)
report = json.loads((output / 'jest-offer-review-before.json').read_text(encoding='utf-8'))
assert result.returncode != 0 and report['numFailedTests'] == 4, report['numFailedTests']
print('Predecessor: all four new review regressions fail; current source restored.')
