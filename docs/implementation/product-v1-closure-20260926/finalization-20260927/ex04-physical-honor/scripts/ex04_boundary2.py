#!/usr/bin/env python3
"""EX-04 page-boundary native proof, window 2 (corrected). Same rules as ex04_boundary.py: taps, swipes, Back and reads ONLY (no install here: the test APK 9ef10b67 is already on the phone), foreground guard before every input, hard time budget.
Fixes from window 1: (1) "top of the list" is decided by the FIRST CARD of the list, not by the sticky tab header; (2) every assertion carries a message and a failing step stores a screenshot and the UI inventory; (3) S4 gets a step-by-step navigation log;
(4) pull-to-refresh starts from the real top and the list must restart at its first page; (5) the S1 walk starts at the real top and compares all 17 cards with the legacy order.
usage: ex04_boundary2.py run [--budget 200] [--only s1,s4,cycles]"""
import argparse, json, sys, time
import ui
import ex04_boundary as b

OUT = {'steps': {}, 'errors': {}}


def label_list(ns):
    return [ui.label(n) for n in ns if ui.label(n)]


def snapshot_failure(name, err):
    try:
        ui.shot('fail_' + name)
    except Exception:
        pass
    try:
        root = ui.dump()
        OUT['errors'][name] = {'error': repr(err), 'labels': [x[:90] for x in label_list(ui.nodes(root))][:40]}
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
    """Scroll down-to-up until the first card of the list is on screen (the sticky header is NOT a signal)."""
    for r in range(max_rounds):
        vis, _ = b.visible(['Otvori Zadatak ', 'Otvori zadatak: '])
        if any(x.startswith(first_prefix) for x in vis):
            return True, r
        for _ in range(3):
            ui.swipe('down', 220)
            time.sleep(0.25)
        time.sleep(0.5)
    return False, max_rounds


def s1_full():
    ui.guard()
    need(b.back_to_home(), 'home not reached')
    need(b.tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci')
    need(b.tapx('Istorija, ', 'zadataka'), 'open Istorija tab')
    base = json.load(open(b.HERE / 'base_tasks_istorija.json', encoding='utf-8'))['items']
    first = base[0][:45]
    ok, rounds = top_of_list(first)
    need(ok, 'could not reach the first card of the list (' + first + ')')
    before, _ = b.visible(['Otvori Zadatak '])
    # pull to refresh from the real top: the list must restart at its first page (2 cards at this page size) or at most the bounded re-read
    ui.guard()
    ui.adb('shell', 'input', 'swipe', '632', '900', '632', '1900', '500')
    time.sleep(3.0)
    after, ns = b.visible(['Otvori Zadatak '])
    walk = b.page_walk(['Otvori Zadatak '], tag='S1 Istorija from the real top after a refresh')
    return {'topRounds': rounds, 'visibleBeforeRefresh': len(before), 'visibleAfterRefresh': len(after), 'afterRefreshFirst': after[:1], 'footAfterRefresh': any(ui.label(n) == 'Prikaži još' for n in ns),
            'count': walk['count'], 'sameOrderAsBaseline': walk['items'] == base, 'sameSetAsBaseline': set(walk['items']) == set(base), 'noDuplicates': len(walk['items']) == len(set(walk['items'])),
            'anomalies': walk['anomalies'], 'errors': walk['errors'], 'footTaps': walk['footTaps'], 'items': walk['items']}


def s4():
    ui.guard()
    log = []
    need(b.back_to_home(), 'home not reached'); log.append('home')
    need(b.tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci'); log.append('moji zadaci')
    need(b.tapx('Aktivni, ', ' zadatka'), 'open Aktivni tab (marker " zadatka")'); log.append('aktivni')
    vis, ns = b.visible(['Otvori Zadatak '])
    log.append('aktivni cards: ' + ' | '.join(x[15:60] for x in vis))
    need(any('ormara' in x for x in vis), 'the "Pomoć pri nošenju ormara" card is not in Aktivni: ' + ' | '.join(x[15:60] for x in vis))
    card = next(x for x in vis if 'Pomoć pri nošenju ormara' in x)
    need(b.tapx(card[:60], 'Pregledaj prijave'), 'open the task detail (marker "Pregledaj prijave")'); log.append('task detail')
    need(b.tapx('Pregledaj prijave', '2 prijave'), 'open the candidates screen (marker "2 prijave")'); log.append('candidates screen')
    r = b.page_walk(['Pogledaj ponudu: '], tag='S4 candidates (pages of 1)')
    cmp_ok = b.tapx('Uporedi', 'Uporedi prijave')
    cmp_items, _ = b.visible(['Otvori prijavu: '])
    r.update({'navigation': log, 'compareOpened': cmp_ok, 'compareItems': [x[:90] for x in cmp_items]})
    ui.guard()
    ui.adb('shell', 'input', 'keyevent', '4')
    time.sleep(1.2)
    return r


def cand_cycles():
    ui.guard()
    need(b.back_to_home(), 'home not reached')
    need(b.tapx('Moji zadaci. ', 'Istorija, '), 'open Moji zadaci')
    need(b.tapx('Aktivni, ', ' zadatka'), 'open Aktivni tab')
    vis, _ = b.visible(['Otvori Zadatak '])
    card = next((x for x in vis if 'Pomoć pri nošenju ormara' in x), None)
    need(card, 'the card is not in Aktivni')
    need(b.tapx(card[:60], 'Pregledaj prijave'), 'open the task detail')
    return b.cycles('Pregledaj prijave', '2 prijave', 'Pregledaj prijave', 10, 'Kandidati task -> Prijave -> Back x10')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['run'])
    ap.add_argument('--budget', type=float, default=200.0)
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
        if 's1' in only: step('s1_full', s1_full)
        if 's4' in only: step('s4_candidates', s4)
        if 'cycles' in only: step('cycles_candidates', cand_cycles)
    except SystemExit:
        pass
    b.OUT = OUT
    b.finalize()
    OUT['final'] = b.OUT.get('final')
    OUT['elapsedSeconds'] = round(time.time() - b.START, 1)
    (b.HERE / 'boundary2_result.json').write_text(json.dumps(OUT, ensure_ascii=False, indent=1), encoding='utf-8')
    b.log('RESULT written: boundary2_result.json')
