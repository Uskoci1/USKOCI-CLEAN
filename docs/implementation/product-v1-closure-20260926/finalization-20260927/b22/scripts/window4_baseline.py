#!/usr/bin/env python3
"""Owner window 4 (his "sad", 2026-10-02): ONE `adb install -r` of the normal DEV APK (replaces the test APK 9ef10b67), then the B22 BEFORE baseline: the same list routine as window 3
(S1 Istorija refresh + walk, S4 candidates, candidate cycles) while a read-only `adb logcat` streams to a file; afterwards the count of Reanimated "synchronouslyUpdateUIProps failed" lines
per frame. Taps, swipes, Back and reads only (plus the one install); foreground guard before every input; stop when a call is in progress.
usage: window4_baseline.py run --apk PATH --sha256 HEX [--budget 250]"""
import argparse, json, re, subprocess, sys, time
import ui
import ex04_boundary as b
import ex04_boundary3 as w3

OUT = {'steps': {}, 'errors': {}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run'])
    ap.add_argument('--apk', required=True)
    ap.add_argument('--sha256', required=True)
    ap.add_argument('--budget', type=float, default=250.0)
    a = ap.parse_args()
    if b.callstate() not in (0, None):
        print('CALL IN PROGRESS: no input sent'); sys.exit(5)
    t_start = time.time()
    # 1. the one install (steps of ex04_boundary.do_install: sha check, install -r, launch, wait for Home)
    res = None
    try:
        b.START = time.time(); b.BUDGET = 400.0
        res = b.do_install(a.apk, a.sha256)
        OUT['steps']['install'] = res
        b.log('INSTALL', res.get('installOutput'))
    except Exception as e:  # noqa
        OUT['errors']['install'] = repr(e)
        b.log('INSTALL FAILED', repr(e))
        (b.HERE / 'window4_result.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=1), encoding='utf-8')
        sys.exit(6)
    # 2. read-only logcat stream to a file for the whole routine
    logf = open(b.HERE / 'window4_logcat.txt', 'wb')
    lc = subprocess.Popen(['adb', '-s', ui.SERIAL, 'logcat', '-v', 'threadtime'], stdout=logf, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    pid = ui.adb('shell', 'pidof', ui.PACKAGE).strip()
    ui.adb('shell', 'dumpsys', 'gfxinfo', ui.PACKAGE, 'reset')
    t0 = time.time()
    b.START = time.time(); b.BUDGET = a.budget
    w3.OUT = OUT
    try:
        w3.step('s1_refresh_walk', w3.s1)
        w3.step('s4_candidates', w3.s4)
        w3.step('cycles_candidates', w3.cand_cycles)
    except SystemExit:
        pass
    elapsed = time.time() - t0
    gfx = ui.gfx()
    time.sleep(0.5)
    lc.terminate()
    try:
        lc.wait(timeout=5)
    except Exception:  # noqa
        lc.kill()
    logf.close()
    text = (b.HERE / 'window4_logcat.txt').read_text(encoding='utf-8', errors='replace')
    lines = text.splitlines()
    mine = [l for l in lines if (f' {pid} ' in l)]
    failed = [l for l in mine if 'synchronouslyUpdateUIProps failed' in l]
    frames = int(gfx['frames']) if gfx.get('frames') else None
    b.OUT = OUT
    b.finalize()
    OUT['final'] = b.OUT.get('final')
    OUT['baseline'] = {'build': 'normal DEV APK, no Reanimated patch', 'apk': a.apk.split('\\')[-1], 'sha256': a.sha256, 'pid': pid, 'routineSeconds': round(elapsed, 1), 'logLinesTotal': len(lines), 'logLinesOfAppPid': len(mine),
                        'failedLines': len(failed), 'frames': frames, 'failedPerFrame': round(len(failed) / frames, 3) if frames else None, 'failedPerSecond': round(len(failed) / elapsed, 2) if elapsed else None,
                        'sampleFailedLines': [l[:200] for l in failed[:3]], 'gfx': gfx}
    OUT['elapsedSeconds'] = round(time.time() - t_start, 1)
    (b.HERE / 'window4_result.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=1), encoding='utf-8')
    b.log('RESULT written: window4_result.json', json.dumps(OUT['baseline'], ensure_ascii=False)[:600])


if __name__ == '__main__':
    main()
