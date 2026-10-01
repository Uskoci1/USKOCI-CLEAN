#!/usr/bin/env python3
"""EX-04 page-boundary native proof, window 3. Same rules as ex04_boundary.py / ex04_boundary2.py: taps, swipes, Back and READS ONLY (no install, no clear, no sign-out, no setting), foreground guard before every input, hard time budget.
Fixes from window 2: S4 scrolls to the target card; the S1 walk reproduces the refresh + walk, records the paging error row (phone time, card count, screenshot), taps "Pokušaj ponovo" and records the outcome; the app log (read-only) is stored.
usage: ex04_boundary3.py run [--budget 270] [--only s1,s4,cycles]"""
import argparse, json, re, subprocess, sys, time
import ui
import ex04_boundary as b

OUT = {'steps': {}, 'errors': {}}
TARGET = 'Otvori Zadatak Pomoć pri nošenju ormara'


def phone_time():
    return ui.adb('shell', 'date', '+%H:%M:%S').strip()


def snapshot_failure(name, err):
    try:
        ui.shot('w3_fail_' + name)
    except Exception:
        pass
    try:
        OUT['errors'][name] = {'error': repr(err), 'labels': [ui.label(n)[:90] for n in ui.nodes(ui.dump()) if ui.label(n)][:40]}
    except Exception as e:  # noqa
        OUT['errors'][name] = {'error': repr(err), 'inventory': repr(e)}


def step(name, fn):
    if b.left() <= 0:
        OUT['steps'][name] = {'skipped': 'budget'}
        return None
    b.log('STEP', name, f'(left {b.left():.0f}s)')
    try:
        r = fn()
        OUT['steps'][name] = r
        return r
    except SystemExit as e:
        OUT['errors'][name] = {'error': f'SystemExit {e.code}'}
        raise
    except Exception as e:  # noqa
        snapshot_failure(name, e)
        b.log('ERROR', name, repr(e))
        return None


def need(cond, msg):
    if not cond:
        raise AssertionError(msg)


def top_of_list(first_prefix, max_rounds=14):
    for r in range(max_rounds):
        vis, _ = b.visible(['Otvori Zadatak ', 'Otvori zadatak: '])
        if any(x.startswith(first_prefix) for x in vis):
            return True, r
        for _ in range(3):
            ui.swipe('down', 220)
            time.sleep(0.25)
        time.sleep(0.5)
    return False, max_rounds


def scroll_find(prefix, max_rounds=10):
    """Scroll down a list until a card whose label starts with prefix is on screen."""
    for r in range(max_rounds):
        vis, _ = b.visible(['Otvori Zadatak '])
        if any(x.startswith(prefix) for x in vis):
            return True, r
        ui.swipe('up')
        time.sleep(0.8)
    return False, max_rounds


def walk_s1():
    """Refresh from the real top, then walk Istorija to its end; when the paging error row appears record it and retry through the control."""
    order, anomalies, events, taps, swipes, still, retries = [], [], [], 0, 0, 0, 0
    while b.left() > 0 and swipes <= 50:
        vis, ns = b.visible(['Otvori Zadatak '])
        a = b.merge(order, vis)
        if a:
            anomalies.append(a)
        labels = [ui.label(n) for n in ns]
        if any(l.startswith('Nije uspelo') for l in labels):
            if not any(e.get('kind') == 'error_row' for e in events):
                ui.shot('w3_error_row')
                events.append({'kind': 'error_row', 'cardCount': len(order), 'phoneTime': phone_time()})
            if retries >= 2:
                break
            node = next((n for n in ns if ui.label(n) == 'Pokušaj ponovo'), None)
            if not node:
                events.append({'kind': 'retry_control_missing'})
                break
            ui.tap((node['b'][0] + node['b'][2]) // 2, (node['b'][1] + node['b'][3]) // 2)
            retries += 1
            time.sleep(5.0)
            v2, ns2 = b.visible(['Otvori Zadatak '])
            probe = list(order)
            b.merge(probe, v2)
            still_error = any(ui.label(n).startswith('Nije uspelo') for n in ns2)
            events.append({'kind': 'retry', 'n': retries, 'phoneTime': phone_time(), 'cardsBefore': len(order), 'cardsAfterProbe': len(probe), 'errorRowStillShown': still_error})
            ui.shot('w3_after_retry_%d' % retries)
            continue
        foot = next((n for n in ns if ui.label(n) == 'Prikaži još'), None)
        before = len(order)
        if foot:
            ui.tap((foot['b'][0] + foot['b'][2]) // 2, (foot['b'][1] + foot['b'][3]) // 2)
            taps += 1
            end = time.time() + 8
            while time.time() < end:
                time.sleep(0.6)
                v3, n3 = b.visible(['Otvori Zadatak '])
                if any(x not in order for x in v3) or any(ui.label(n).startswith('Nije uspelo') for n in n3):
                    break
            still = 0
            continue
        ui.swipe('up')
        time.sleep(0.8)
        v4, _ = b.visible(['Otvori Zadatak '])
        probe = list(order)
        b.merge(probe, v4)
        still = still + 1 if len(probe) == before else 0
        swipes += 1
        if still >= 2:
            break
    return {'count': len(order), 'items': order, 'footTaps': taps, 'events': events, 'anomalies': anomalies, 'swipes': swipes}


def s1():
    ui.guard()
    need(b.back_to_home(), 'home not reached')
    need(b.tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci')
    need(b.tapx('Istorija, ', 'zadataka'), 'open Istorija tab')
    base = json.load(open(b.HERE / 'base_tasks_istorija.json', encoding='utf-8'))['items']
    ok, rounds = top_of_list(base[0][:45])
    need(ok, 'could not reach the first card of the list')
    ui.guard()
    ui.adb('shell', 'input', 'swipe', '632', '900', '632', '1900', '500')
    time.sleep(3.0)
    after, ns = b.visible(['Otvori Zadatak '])
    r = walk_s1()
    r.update({'visibleAfterRefresh': len(after), 'footAfterRefresh': any(ui.label(n) == 'Prikaži još' for n in ns),
              'sameOrderAsBaseline': r['items'] == base, 'prefixOfBaseline': r['items'] == base[:len(r['items'])], 'noDuplicates': len(r['items']) == len(set(r['items'])), 'baselineCount': len(base)})
    return r


def s4():
    ui.guard()
    log = []
    need(b.back_to_home(), 'home not reached'); log.append('home')
    need(b.tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci'); log.append('moji zadaci')
    need(b.tapx('Aktivni, ', ' zadatka'), 'open Aktivni tab'); log.append('aktivni')
    found, rounds = scroll_find(TARGET)
    need(found, 'target card not found after scrolling')
    log.append('scrolled %d' % rounds)
    need(b.tapx(TARGET, 'Pregledaj prijave'), 'open the task detail'); log.append('task detail')
    need(b.tapx('Pregledaj prijave', '2 prijave'), 'open the candidates screen'); log.append('candidates screen')
    r = b.page_walk(['Pogledaj ponudu: '], tag='S4 candidates (pages of 1)')
    cmp_ok = b.tapx('Uporedi', 'Uporedi prijave')
    cmp_items, _ = b.visible(['Otvori prijavu: '])
    r.update({'navigation': log, 'compareOpened': cmp_ok, 'compareItems': [x[:90] for x in cmp_items]})
    for _ in range(3):
        if any('Pregledaj prijave' in ui.label(n) for n in ui.nodes(ui.dump())):
            break
        ui.guard()
        ui.adb('shell', 'input', 'keyevent', '4')
        time.sleep(1.4)
    return r


def cand_cycles():
    ui.guard()
    if not any('Pregledaj prijave' in ui.label(n) for n in ui.nodes(ui.dump())):
        need(b.back_to_home(), 'home not reached')
        need(b.tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci')
        need(b.tapx('Aktivni, ', ' zadatka'), 'open Aktivni tab')
        found, _ = scroll_find(TARGET)
        need(found, 'target card not found')
        need(b.tapx(TARGET, 'Pregledaj prijave'), 'open the task detail')
    return b.cycles('Pregledaj prijave', '2 prijave', 'Pregledaj prijave', 10, 'Kandidati task -> Prijave -> Back x10')


def app_log():
    pid = ui.adb('shell', 'pidof', ui.PACKAGE).strip()
    out = ui.adb('shell', f'logcat -d -v threadtime --pid={pid} *:W | tail -n 80') if pid else ''
    js = ui.adb('shell', f'logcat -d -v threadtime --pid={pid} ReactNativeJS:V *:S | tail -n 40') if pid else ''
    return {'pid': pid, 'warnAndAbove': out.strip().splitlines()[-80:], 'reactNativeJs': js.strip().splitlines()[-40:]}


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run'])
    ap.add_argument('--budget', type=float, default=270.0)
    ap.add_argument('--only', default='s1,s4,cycles')
    a = ap.parse_args()
    b.BUDGET = a.budget
    only = set(a.only.split(','))
    if b.callstate() not in (0, None):
        print('CALL IN PROGRESS: no input sent'); sys.exit(5)
    ui.adb('shell', 'dumpsys', 'gfxinfo', ui.PACKAGE, 'reset')
    ui.adb('shell', 'am', 'start', '-n', ui.PACKAGE + '/.MainActivity')
    time.sleep(3)
    try:
        if 's1' in only: step('s1_refresh_walk_retry', s1)
        if 's4' in only: step('s4_candidates', s4)
        if 'cycles' in only: step('cycles_candidates', cand_cycles)
    except SystemExit:
        pass
    b.OUT = OUT
    b.finalize()
    OUT['final'] = b.OUT.get('final')
    try:
        OUT['appLog'] = app_log()
    except Exception as e:  # noqa
        OUT['appLog'] = {'error': repr(e)}
    OUT['elapsedSeconds'] = round(time.time() - b.START, 1)
    (b.HERE / 'boundary3_result.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=1), encoding='utf-8')
    b.log('RESULT written: boundary3_result.json')
