"""EX-07 S03 - merge the per-job reports into ONE evidence document: the thing the root copies into the round note.

Inputs (environment, with defaults the workflow uses):
  EX07_PROVIDER_REPORT  provider-report.json of the HTTP-level job   (missing = that job died: HARNESS_BROKEN, never PASS)
  EX07_NATIVE_REPORT    native-report.json of the emulator job       (same rule)
  EX07_JOB_RESULTS      JSON {job: success|failure|cancelled|skipped} from the workflow `needs` context
  EX07_EVIDENCE_OUT     output directory

The document carries the exact head, the run id and the label "DISPOSABLE EMULATOR evidence", the per-assertion table with where each
runs (HTTP-level / emulator), and an explicit list of what it is NOT evidence for.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Optional

import s03_core as core


def load(path: Path) -> Optional[dict[str, Any]]:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def build(provider: Optional[dict[str, Any]], native: Optional[dict[str, Any]], jobs: dict[str, str], fallback_source: dict[str, Any]) -> dict[str, Any]:
    sources = [r['source'] for r in (provider, native) if r and isinstance(r.get('source'), dict)]
    heads = {s.get('head') for s in sources if s.get('head')}
    source = dict(sources[0]) if sources else dict(fallback_source)
    skipped: list[str] = []
    if jobs.get('provider-http-proof') == 'skipped':
        skipped.append('HTTP')                                           # no `needs`: it can only be the dispatch scope
    if jobs.get('native-apk') == 'skipped' and jobs.get('native-emulator-proof') == 'skipped':
        skipped.append('EMULATOR')                                       # a skipped emulator job after a FAILED apk job is not on purpose
    evidence = core.merge_evidence({'HTTP': provider, 'EMULATOR': native}, source, skipped)
    evidence['jobs'] = jobs
    notes: list[str] = []
    if len(heads) > 1:
        notes.append('the two jobs report different heads: ' + ', '.join(sorted(h[:12] for h in heads)))
        evidence['result'] = core.worst_result([evidence['result'], 'HARNESS_BROKEN'])
    for name in ('offline-logic', 'native-apk'):
        if jobs.get(name) in ('failure', 'cancelled'):          # a job skipped by the dispatch scope is not a problem
            notes.append(f'job {name} finished {jobs.get(name)}: the evidence below is not trustworthy until it is green')
            evidence['result'] = core.worst_result([evidence['result'], 'HARNESS_BROKEN'])
    if native is not None:
        env = native.get('environment') or {}
        evidence['native'] = {'apk': env.get('apk'), 'apkSource': env.get('apkSource'), 'device': env.get('device'), 'package': env.get('package')}
    if provider is not None:
        env = provider.get('environment') or {}
        evidence['provider'] = {'gotrueImage': env.get('gotrueImage'), 'supabaseCli': env.get('supabaseCli'),
                                'otpExpirySeconds': env.get('otpExpirySeconds'), 'maxFrequencySeconds': env.get('maxFrequencySeconds'),
                                'allowlist': env.get('allowlist')}
    evidence['notes'] = notes
    return evidence


def print_table(evidence: dict[str, Any]) -> None:
    for row in evidence['assertions']:
        print(f"{row['status']:<11} {row['id']:<5} {row['where'].split(' ')[0]:<10} {row['title'][:90]}")
        if row['status'] not in ('PASS', 'OBSERVATION') and row.get('detail'):
            print('            ' + row['detail'][:240])
    for note in evidence.get('notes', []):
        print('NOTE', note)
    c = evidence['counts']
    src = evidence.get('source') or {}
    print('RESULT EX07-S03 {r} pass={p} fail={f} error={e} not_run={n} unavailable={u} observations={o} head={h} run={run} label="{label}"'.format(
        r=evidence['result'], p=c.get('PASS', 0), f=c.get('FAIL', 0), e=c.get('ERROR', 0), n=c.get('NOT_RUN', 0), u=c.get('UNAVAILABLE', 0),
        o=c.get('OBSERVATION', 0), h=src.get('head', '?'), run=src.get('runId', '?'), label=core.LABEL))
    print('NOT EVIDENCE FOR: ' + '; '.join(evidence['notEvidenceFor']))


def main(argv: Optional[list[str]] = None) -> int:
    env = os.environ
    provider = load(Path(env.get('EX07_PROVIDER_REPORT', 'artifacts/ex07-s03-in/provider/provider-report.json')))
    native = load(Path(env.get('EX07_NATIVE_REPORT', 'artifacts/ex07-s03-in/native/native-report.json')))
    try:
        jobs = json.loads(env.get('EX07_JOB_RESULTS', '{}'))
    except ValueError:
        jobs = {}
    fallback = {'head': env.get('GITHUB_SHA', 'unknown'), 'runId': env.get('GITHUB_RUN_ID', 'local'), 'workflow': env.get('GITHUB_WORKFLOW')}
    evidence = build(provider, native, jobs, fallback)
    out_dir = Path(env.get('EX07_EVIDENCE_OUT', 'artifacts/ex07-s03-evidence'))
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / 'ex07-s03-evidence.json').write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print_table(evidence)
    return 0 if evidence['result'] == 'PASS' else 1


if __name__ == '__main__':
    sys.exit(main())
