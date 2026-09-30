#!/usr/bin/env python3
"""Keeps the compact, private-data-free evidence of a downloaded P6 native journey artifact in the repository (CI retention is short).

  python scripts/p6_collect_journey_evidence.py ARTIFACT_DIR DEST_DIR [--png NAME ...]

ARTIFACT_DIR is the folder that holds p6-native-report.json (the `artifacts/p6-native` folder of the downloaded artifact). Copied: the report, proof-build.txt (run, source, APK hash,
fatal lines), fixture.json (disposable accounts and server-truth counts only), device facts, the final meminfo, the fatal-line extract and a few screenshots. Computed from the
device log (streamed, it can be gigabytes): slow-frame counts, Reanimated dead-tag lines, ANR/crash lines and the app's own DEV trace by event name.
"""
import argparse
import collections
import json
import re
import shutil
import sys
from pathlib import Path

DEFAULT_PNGS = ['P6_02_route_initial', 'P6_03_full_list', 'P6_04_paged_to_end', 'P6_06_after_back', 'P6_10_cold_map', 'P6_12_place_peek', 'P6_15_task_peek',
                'P6_22_search_place_chosen', 'P6_31_after_pan', 'P6_99_final']
COPY = ['p6-native-report.json', 'proof-build.txt', 'fixture.json', 'device-sdk.txt', 'display-size.txt', 'display-density.txt', 'meminfo-final.txt', 'logcat-fatal.txt', 'install.log']

ap = argparse.ArgumentParser()
ap.add_argument('artifact')
ap.add_argument('dest')
ap.add_argument('--png', nargs='*', default=DEFAULT_PNGS)
ARGS = ap.parse_args()
SRC, DEST = Path(ARGS.artifact), Path(ARGS.dest)
DEST.mkdir(parents=True, exist_ok=True)
if not (SRC / 'p6-native-report.json').exists():
    sys.exit('no p6-native-report.json in ' + str(SRC))

for name in COPY:
    if (SRC / name).exists():
        shutil.copyfile(SRC / name, DEST / name)
copied = []
for stem in ARGS.png:
    for suffix in ('.png',):
        if (SRC / (stem + suffix)).exists():
            shutil.copyfile(SRC / (stem + suffix), DEST / (stem + suffix))
            copied.append(stem + suffix)

davey = []
counts = collections.Counter()
events = collections.Counter()
pins = []
DAVEY = re.compile(r'Davey! duration=(\d+)ms')
EVENT = re.compile(r'\[USKOCI_DISCOVERY_TRACE\] \[\d+,"([a-z0-9-]+)"')
P6 = re.compile(r'\[USKOCI_P6_TRACE\] \["([a-z-]+)",(?:"([^"]*)"|null)\]')
log = SRC / 'logcat.txt'
lines = 0
if log.exists():
    with open(log, encoding='utf-8', errors='replace') as fh:
        for line in fh:
            lines += 1
            if 'Davey!' in line:
                m = DAVEY.search(line)
                if m:
                    davey.append(int(m.group(1)))
            elif 'synchronouslyUpdateUIProps failed' in line:
                counts['reanimatedDeadTagLines'] += 1
            elif 'ANR in ' in line:
                counts['anr'] += 1
            elif 'FATAL EXCEPTION' in line:
                counts['fatal'] += 1
            elif 'USKOCI_DISCOVERY_TRACE' in line:
                m = EVENT.search(line)
                if m:
                    events['discovery:' + m.group(1)] += 1
            elif 'USKOCI_P6_TRACE' in line:
                m = P6.search(line)
                if m:
                    events['p6:' + m.group(1)] += 1
                    if m.group(1) == 'pin' and m.group(2):
                        a, b = m.group(2).split('/')
                        pins.append([int(a), int(b)])
davey.sort()
summary = {'logLines': lines, 'daveyEvents': len(davey), 'daveyOver700ms': sum(1 for d in davey if d >= 700), 'daveyMaxMs': davey[-1] if davey else 0,
           'daveyP50Ms': davey[len(davey) // 2] if davey else 0, **dict(counts), 'traceEvents': dict(sorted(events.items())), 'pinTimingsMs': pins,
           'screenshots': copied,
           'note': 'CI emulator: x86_64 with software rendering (longest frame on the phone in a comparable run 0.92 s, in this run 10.1 s); Reanimated failure lines are its retry of updates for views Fabric has not mounted yet: app-wide, present at login before any P6 code (P6_CLOSURE_RECEIPT.md section 4, row 1)'}
(DEST / 'log-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in summary.items() if k not in ('traceEvents', 'pinTimingsMs')}, ensure_ascii=False))
