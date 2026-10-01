#!/usr/bin/env python3
"""Owner window 5 (his "sad", 2026-10-02): the B22 BEFORE baseline for a SCREEN TOUR on the normal unpatched DEV APK (no install here). Read-only navigation only: bottom navigation tabs,
'Moj profil', 'Obavestenja', the Mapa control, opening a card and Back, swipes. Nothing that changes data (no publish, no accept, no toggle, no text input). A read-only `adb logcat` streams to a file;
afterwards the count of Reanimated "synchronouslyUpdateUIProps failed" lines per frame. Foreground guard before every input; stop when a call is in progress.
usage: window5_tour.py run [--budget 200] [--tag before_unpatched]"""
import argparse, json, subprocess, sys, time
import ui
import ex04_boundary as b

OUT = {'steps': {}, 'errors': {}}


def clickable_with(prefix, below=None):
    ns = sorted([n for n in ui.nodes(ui.dump()) if n['click'] and ui.label(n).startswith(prefix)], key=lambda n: (n['b'][1], n['b'][0]))
    return ns[0] if ns else None


def tap_prefix(prefix, wait=2.5):
    n = clickable_with(prefix)
    if not n:
        return False
    ui.tap((n['b'][0] + n['b'][2]) // 2, (n['b'][1] + n['b'][3]) // 2)
    time.sleep(wait)
    return True


def back(wait=1.8):
    ui.guard()
    ui.adb('shell', 'input', 'keyevent', '4')
    time.sleep(wait)


def home():
    return b.back_to_home()


def tour_once(i, notes):
    ui.guard()
    notes.append(f'cycle {i}: home {home()}')
    # Zadaci tab: list sheet, Mapa control, swipe the sheet, open the first card, Back
    notes.append('zadaci tab ' + str(tap_prefix('Zadaci', 3.0)))
    notes.append('mapa control ' + str(tap_prefix('Mapa', 3.0)))
    ui.swipe('up'); time.sleep(1.2); ui.swipe('down'); time.sleep(1.2)
    c = clickable_with('Otvori Zadatak ')
    if c:
        ui.tap((c['b'][0] + c['b'][2]) // 2, (c['b'][1] + c['b'][3]) // 2); time.sleep(3.0); back(2.0)
        notes.append('zadaci card opened and Back')
    # Dogovori tab: dwell, open the first card (any "Otvori ...") and Back
    notes.append('dogovori tab ' + str(tap_prefix('Dogovori', 3.0)))
    ui.swipe('up'); time.sleep(1.0); ui.swipe('down'); time.sleep(1.0)
    c = clickable_with('Otvori ')
    if c:
        ui.tap((c['b'][0] + c['b'][2]) // 2, (c['b'][1] + c['b'][3]) // 2); time.sleep(3.0); back(2.0)
        notes.append('dogovori card opened and Back')
    # Home -> Moj profil (scroll, Back), Obavestenja (Back)
    notes.append('home ' + str(home()))
    if tap_prefix('Moj profil', 3.0):
        ui.swipe('up'); time.sleep(1.0); ui.swipe('up'); time.sleep(1.0); ui.swipe('down'); time.sleep(1.0)
        back(2.0); notes.append('profil opened, scrolled, Back')
    if tap_prefix('Obave', 3.0):
        time.sleep(1.0); back(2.0); notes.append('obavestenja opened and Back')
    notes.append('moji zadaci ' + str(tap_prefix('Moji zadaci', 3.0))); back(2.0)
    notes.append('moje prijave ' + str(tap_prefix('Moje prijave', 3.0))); back(2.0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run'])
    ap.add_argument('--budget', type=float, default=200.0)
    ap.add_argument('--tag', default='before_unpatched')
    a = ap.parse_args()
    if b.callstate() not in (0, None):
        print('CALL IN PROGRESS: no input sent'); sys.exit(5)
    ui.guard()
    logf = open(b.HERE / f'window5_{a.tag}_logcat.txt', 'wb')
    lc = subprocess.Popen(['adb', '-s', ui.SERIAL, 'logcat', '-v', 'threadtime'], stdout=logf, stderr=subprocess.DEVNULL)
    time.sleep(1.0)
    pid = ui.adb('shell', 'pidof', ui.PACKAGE).strip()
    ui.adb('shell', 'dumpsys', 'gfxinfo', ui.PACKAGE, 'reset')
    t0 = time.time(); b.START = t0; b.BUDGET = a.budget
    notes, cycles = [], 0
    try:
        while b.left() > 25:
            tour_once(cycles + 1, notes)
            cycles += 1
    except SystemExit:
        pass
    except Exception as e:  # noqa
        OUT['errors']['tour'] = repr(e)
    elapsed = time.time() - t0
    gfx = ui.gfx()
    time.sleep(0.5)
    lc.terminate()
    try:
        lc.wait(timeout=5)
    except Exception:  # noqa
        lc.kill()
    logf.close()
    lines = (b.HERE / f'window5_{a.tag}_logcat.txt').read_text(encoding='utf-8', errors='replace').splitlines()
    mine = [l for l in lines if f' {pid} ' in l]
    failed = [l for l in mine if 'synchronouslyUpdateUIProps failed' in l]
    frames = int(gfx['frames']) if gfx.get('frames') else None
    b.OUT = OUT
    b.finalize()
    tags = {}
    for l in failed:
        t = l.rsplit('tag ', 1)[-1].split()[0] if 'tag ' in l else '?'
        tags[t] = tags.get(t, 0) + 1
    OUT['final'] = b.OUT.get('final')
    OUT['tour'] = {'tag': a.tag, 'build': 'normal DEV APK 81b8a833, NO Reanimated patch' if a.tag.startswith('before') else a.tag, 'pid': pid, 'cycles': cycles, 'notes': notes, 'routineSeconds': round(elapsed, 1), 'logLinesOfAppPid': len(mine),
                   'failedLines': len(failed), 'frames': frames, 'failedPerFrame': round(len(failed) / frames, 3) if frames else None, 'failedPerSecond': round(len(failed) / elapsed, 2) if elapsed else None,
                   'distinctDeadTags': len(tags), 'topTags': sorted(tags.items(), key=lambda kv: -kv[1])[:6], 'gfx': gfx}
    (b.HERE / f'window5_{a.tag}_result.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=1), encoding='utf-8')
    b.log('RESULT', json.dumps(OUT['tour'], ensure_ascii=False)[:900])


if __name__ == '__main__':
    main()
