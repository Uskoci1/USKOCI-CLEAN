#!/usr/bin/env python3
"""EX-04 page-boundary native proof on the physical HONOR - the owner's exclusive window (about 4 minutes, his word "SAD"), option A (test page limit 2, candidates 1).
Allowed input: ONE `adb install -r` (no uninstall, no clear, no setting), taps, swipes, Back, reads. Every input is preceded by ui.guard() (wake + foreground must be rs.uskoci.dev) and a hard time budget.
usage: ex04_boundary.py precheck                      read-only phone state (run only inside the window)
       ex04_boundary.py run --apk PATH --sha256 HEX [--budget 270]
Steps (each in its own try/except; a failed step never aborts the others): install, home, S1 open Istorija, S1 three boundary crossings + open card + Back, S1 pull-to-refresh + page walk to the end, S1 Aktivni, S2 Sve page walk, S4 candidates (pages of 1) + compare,
then, only while time is left, S2 and Kandidati open/Back cycles; finally the read-only crash/ANR/gfx scan."""
import argparse, hashlib, json, re, subprocess, sys, time
from pathlib import Path
import ui

HERE = Path(__file__).parent
START = time.time()
BUDGET = 270.0
OUT = {'steps': {}, 'errors': {}}


def left():
    return BUDGET - (time.time() - START)


def log(*a):
    print(f'[{time.time() - START:6.1f}s]', *a, flush=True)


def load(name):
    return json.loads((HERE / name).read_text(encoding='utf-8'))


def callstate():
    out = ui.adb('shell', 'dumpsys telephony.registry | grep -m1 mCallState')
    m = re.search(r'mCallState=(\d+)', out)
    return int(m.group(1)) if m else None


def visible(prefixes):
    """Labels on screen, top to bottom, that start with one of the prefixes."""
    root = ui.dump()
    ns = sorted(ui.nodes(root), key=lambda n: (n['b'][1], n['b'][0]))
    return [ui.label(n) for n in ns if any(ui.label(n).startswith(p) for p in prefixes)], ns


def merge(order, vis):
    """Append the visible labels to the running order by overlap with its tail; return an anomaly string when a repeat is not contiguous (a duplicate or a re-ordering)."""
    if not vis:
        return None
    k = 0
    for size in range(min(len(order), len(vis)), 0, -1):
        if order[-size:] == vis[:size]:
            k = size
            break
    anomaly = None
    new = vis[k:]
    if k == 0 and new and all(x in order for x in new):
        return None  # a sub-window of what was already seen (a partially rendered dump): nothing new, nothing wrong
    if k == 0 and any(x in order for x in new):
        anomaly = 'NON_CONTIGUOUS_REPEAT: ' + '; '.join(x[:50] for x in new if x in order)
    elif k > 0 and any(x in order for x in new):
        anomaly = 'REPEAT_AFTER_OVERLAP: ' + '; '.join(x[:50] for x in new if x in order)
    order.extend(new)
    return anomaly


def tapx(text, expect, exact=False, timeout=9.0):
    root = ui.dump()
    n = ui.find(root, text, exact=exact)
    if not n:
        return False
    ui.tap((n['b'][0] + n['b'][2]) // 2, (n['b'][1] + n['b'][3]) // 2)
    end = time.time() + timeout
    while time.time() < end:
        time.sleep(0.5)
        if any(expect.lower() in ui.label(m).lower() for m in ui.nodes(ui.dump())):
            return True
    return False


def back_to_home(max_back=8):
    for _ in range(max_back):
        if any(ui.label(n).startswith('USKOČI, Početna') for n in ui.nodes(ui.dump())):
            return True
        ui.guard()
        ui.adb('shell', 'input', 'keyevent', '4')
        time.sleep(1.2)
    return False


def page_walk(prefixes, foot='Prikaži još', max_swipes=60, tag=''):
    """Scroll one list to its end, tapping the foot control whenever it is on screen. Returns the ordered items, the foot taps, anomalies and the foot/error labels seen."""
    order, anomalies, taps, errors, still, swipes, foots_seen = [], [], 0, [], 0, 0, set()
    while left() > 0 and swipes <= max_swipes:
        vis, ns = visible(prefixes)
        a = merge(order, vis)
        if a:
            anomalies.append(a)
        labels = [ui.label(n) for n in ns]
        for l in labels:
            if l.startswith('Nije uspelo') or l.startswith('Pokušaj ponovo'):
                errors.append(l)
            if l.startswith('Učitavamo još') or l == foot:
                foots_seen.add(l)
        footnode = next((n for n in ns if ui.label(n) == foot), None)
        before = len(order)
        if footnode:
            ui.tap((footnode['b'][0] + footnode['b'][2]) // 2, (footnode['b'][1] + footnode['b'][3]) // 2)
            taps += 1
            end = time.time() + 8
            while time.time() < end:
                time.sleep(0.6)
                v2, _ = visible(prefixes)
                if any(x not in order for x in v2):
                    break
            still = 0
            continue
        # no foot on screen: scroll; the end is reached when two scrolls bring nothing new
        ui.swipe('up')
        time.sleep(0.8)
        v3, _ = visible(prefixes)
        probe = list(order)
        merge(probe, v3)
        still = still + 1 if len(probe) == before and not any(l == foot for l in labels) else 0
        swipes += 1
        if still >= 2:
            break
    return {'tag': tag, 'count': len(order), 'items': order, 'footTaps': taps, 'anomalies': anomalies, 'errors': sorted(set(errors)), 'footLabelsSeen': sorted(foots_seen), 'swipes': swipes}


def top(marker_prefixes, tries=10):
    """Back to the top of the list: three quick swipes down per check (a list of 17 cards is about 16 screens)."""
    for _ in range(tries):
        ns = ui.nodes(ui.dump())
        if any(ui.label(n).startswith(p) for n in ns for p in marker_prefixes):
            return True
        for _ in range(3):
            ui.swipe('down', 220)
            time.sleep(0.25)
        time.sleep(0.5)
    return False


def step(name, fn):
    if left() <= 0:
        OUT['steps'][name] = {'skipped': 'budget'}
        log('SKIP', name, '(budget)')
        return None
    log('STEP', name, f'(left {left():.0f}s)')
    try:
        r = fn()
        OUT['steps'][name] = r
        return r
    except SystemExit as e:
        OUT['errors'][name] = f'SystemExit {e.code}'
        log('ABORT', name, 'foreground lost or tool exit', e.code)
        raise
    except Exception as e:  # noqa
        OUT['errors'][name] = repr(e)
        log('ERROR', name, repr(e))
        return None


# --------------------------------------------------------------------------- steps
def do_install(apk, sha):
    got = hashlib.sha256(Path(apk).read_bytes()).hexdigest()
    assert got == sha, ('APK sha256 mismatch', got)
    before = ui.adb('shell', 'dumpsys package rs.uskoci.dev | grep -E "firstInstallTime|lastUpdateTime|versionCode"')
    r = subprocess.run(['adb', '-s', ui.SERIAL, 'install', '-r', apk], capture_output=True, timeout=240)
    out = (r.stdout + r.stderr).decode('utf-8', 'replace').strip()
    after = ui.adb('shell', 'dumpsys package rs.uskoci.dev | grep -E "firstInstallTime|lastUpdateTime|versionCode"')
    assert 'Success' in out, out
    ui.adb('shell', 'am', 'start', '-n', 'rs.uskoci.dev/.MainActivity')
    end = time.time() + 25
    while time.time() < end:
        time.sleep(1.5)
        if ui.fg() == ui.PACKAGE and any(ui.label(n).startswith('USKOČI, Početna') for n in ui.nodes(ui.dump())):
            break
    return {'installOutput': out, 'before': before.strip(), 'after': after.strip(), 'sha256': got, 'fg': ui.fg()}


def do_home():
    ui.guard()
    return {'home': back_to_home()}


def do_s1_open():
    ui.guard()
    assert tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci'
    assert tapx('Istorija, ', 'zadataka'), 'open Istorija tab'
    return {'opened': True}


def do_s1_back_state():
    """Cross the boundary three times (6 of 17 cards), open a card, Back: the same cards must be on screen."""
    ui.guard()
    taps = 0
    for _ in range(8):
        if taps >= 3:
            break
        vis, ns = visible(['Otvori Zadatak '])
        footnode = next((n for n in ns if ui.label(n) == 'Prikaži još'), None)
        if footnode:
            ui.tap((footnode['b'][0] + footnode['b'][2]) // 2, (footnode['b'][1] + footnode['b'][3]) // 2)
            taps += 1
            time.sleep(1.8)
        else:
            ui.swipe('up')
            time.sleep(0.8)
    before, ns = visible(['Otvori Zadatak '])
    target = next((n for n in ns if ui.label(n).startswith('Otvori Zadatak ')), None)
    assert target, 'no card to open'
    ui.tap((target['b'][0] + target['b'][2]) // 2, (target['b'][1] + target['b'][3]) // 2)
    time.sleep(2.2)
    opened = [ui.label(n) for n in ui.nodes(ui.dump()) if ui.label(n)][:6]
    ui.guard()
    ui.adb('shell', 'input', 'keyevent', '4')
    time.sleep(2.0)
    after, _ = visible(['Otvori Zadatak '])
    return {'footTapsBeforeOpen': taps, 'visibleBefore': before, 'visibleAfterBack': after, 'sameVisibleAfterBack': before == after, 'openedScreenLabels': opened}


def do_s1_refresh_and_walk():
    """Back to the top, pull to refresh (the list must restart at its first page), then page to the end: same set and order as the legacy build, no duplicate."""
    ui.guard()
    assert top(['Istorija, ']), 'top'
    before, _ = visible(['Otvori Zadatak '])
    ui.guard()
    ui.adb('shell', 'input', 'swipe', '632', '900', '632', '1900', '500')
    time.sleep(3.0)
    after, ns = visible(['Otvori Zadatak '])
    foot = any(ui.label(n) == 'Prikaži još' for n in ns)
    r = page_walk(['Otvori Zadatak '], tag='S1 Istorija after refresh')
    base = load('base_tasks_istorija.json')
    r['visibleBeforeRefresh'] = before
    r['visibleAfterRefresh'] = after
    r['footAfterRefresh'] = foot
    r['baselineCount'] = base['count']
    r['sameSetAsBaseline'] = set(r['items']) == set(base['items'])
    r['sameOrderAsBaseline'] = r['items'] == base['items']
    r['noDuplicates'] = len(r['items']) == len(set(r['items']))
    return r


def do_s1_aktivni():
    ui.guard()
    top(['Aktivni, '])
    assert tapx('Aktivni, ', 'zadatka'), 'open Aktivni tab'
    base = load('base_tasks_aktivni.json')
    r = page_walk(['Otvori Zadatak '], tag='S1 Aktivni')
    r['sameOrderAsBaseline'] = r['items'] == base['items']
    return r


def do_s2():
    ui.guard()
    assert back_to_home(), 'home'
    assert tapx('Moje prijave. ', 'Sve, '), 'open Moje prijave'
    base = load('new_apps_sve.json')
    r = page_walk(['Otvori zadatak: '], tag='S2 Sve')
    r['baselineCount'] = base['count']
    r['sameOrderAsNewBuildBaseline'] = r['items'] == base['items']
    r['noDuplicates'] = len(r['items']) == len(set(r['items']))
    return r


def do_s4():
    ui.guard()
    assert back_to_home(), 'home'
    assert tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci'
    assert tapx('Aktivni, ', 'zadatka')
    assert tapx('Otvori Zadatak Pomoć pri nošenju ormara', 'Pregledaj prijave'), 'open the task'
    assert tapx('Pregledaj prijave', '2 prijave'), 'open candidates'
    r = page_walk(['Pogledaj ponudu: '], tag='S4 candidates (pages of 1)')
    # the comparison needs every application: it must read the rest by itself
    cmp_ok = tapx('Uporedi', 'Uporedi prijave')
    cmp_items, _ = visible(['Otvori prijavu: '])
    r['compareOpened'] = cmp_ok
    r['compareItems'] = cmp_items
    ui.guard()
    ui.adb('shell', 'input', 'keyevent', '4')
    time.sleep(1.5)
    return r


def cycles(tap_text, marker, back_marker, n, tag):
    """From the screen that shows `tap_text`: tap it, wait for `marker`, Back, wait for `back_marker` (the same loop shape as the earlier stability loops; times include UI-dump polling, an upper bound)."""
    times_open, times_back = [], []
    for i in range(n):
        if left() < 10:
            break
        ui.guard()
        t0 = time.time()
        if not tapx(tap_text, marker):
            return {'tag': tag, 'done': i, 'stopped': 'tap target or marker not found', 'open_ms': times_open, 'back_ms': times_back}
        times_open.append(int((time.time() - t0) * 1000))
        t1 = time.time()
        ui.guard()
        ui.adb('shell', 'input', 'keyevent', '4')
        for _ in range(14):
            time.sleep(0.4)
            if any(back_marker.lower() in ui.label(m).lower() for m in ui.nodes(ui.dump())):
                break
        times_back.append(int((time.time() - t1) * 1000))
    return {'tag': tag, 'done': len(times_open), 'open_ms': times_open, 'back_ms': times_back}


def do_cycles_s2():
    ui.guard()
    assert back_to_home(), 'home'
    return cycles('Moje prijave. ', 'Sve, ', 'USKOČI, Početna', 6, 'S2 Home -> Moje prijave -> Back x6')


def do_cycles_cand():
    ui.guard()
    assert back_to_home(), 'home'
    assert tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci'
    assert tapx('Aktivni, ', 'zadatka')
    assert tapx('Otvori Zadatak Pomoć pri nošenju ormara', 'Pregledaj prijave'), 'open the task'
    return cycles('Pregledaj prijave', '2 prijave', 'Pregledaj prijave', 10, 'Kandidati task -> Prijave -> Back x10')


def finalize():
    ex = ui.adb('shell', 'dumpsys activity exit-info rs.uskoci.dev')
    first = [l.strip() for l in ex.splitlines() if 'timestamp=' in l][:3]
    bad = ui.adb('shell', 'logcat -d -v time --uid 10213 | grep -E "FATAL EXCEPTION|ANR in|am_crash|am_anr" | head -5')
    mem = ui.adb('shell', 'dumpsys meminfo rs.uskoci.dev | grep -E "TOTAL PSS"')
    OUT['final'] = {'exitInfoLatest': first, 'fatalOrAnrLogLines': bad.strip(), 'pss': mem.strip(), 'gfx': ui.gfx(), 'pid': ui.adb('shell', 'pidof rs.uskoci.dev').strip(), 'fg': ui.fg(), 'quietSeconds': ui.quiet()}
    log('FINAL', json.dumps(OUT['final'], ensure_ascii=False))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['precheck', 'run'])
    ap.add_argument('--apk')
    ap.add_argument('--sha256')
    ap.add_argument('--budget', type=float, default=270.0)
    a = ap.parse_args()
    BUDGET = a.budget
    if a.cmd == 'precheck':
        print(json.dumps({'quietSeconds': ui.quiet(), 'foreground': ui.fg(), 'callState': callstate(), 'awake': ui.awake(), 'pid': ui.adb('shell', 'pidof rs.uskoci.dev').strip()}, ensure_ascii=False))
        sys.exit(0)
    if callstate() not in (0, None):
        print('CALL IN PROGRESS: no input sent'); sys.exit(5)
    ui.adb('shell', 'dumpsys', 'gfxinfo', ui.PACKAGE, 'reset')
    try:
        step('install', lambda: do_install(a.apk, a.sha256))
        step('home', do_home)
        step('s1_open', do_s1_open)
        step('s1_back_state', do_s1_back_state)
        step('s1_refresh_and_walk', do_s1_refresh_and_walk)
        step('s1_aktivni', do_s1_aktivni)
        step('s2_sve', do_s2)
        step('s4_candidates', do_s4)
        step('cycles_s2', do_cycles_s2)
        step('cycles_candidates', do_cycles_cand)
    except SystemExit:
        pass
    finalize()
    OUT['elapsedSeconds'] = round(time.time() - START, 1)
    (HERE / 'boundary_result.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=1), encoding='utf-8')
    log('RESULT written: boundary_result.json')
