#!/usr/bin/env python3
"""P6 read-only check of an installed DEV build on the LOCAL Android emulator (host GPU), against the canonical DEV backend.

It only looks and taps: open the Zadaci tab, read the list (count and card titles), time repeated touches on one map bucket from the app's own DEV trace
(`[USKOCI_P6_TRACE] ["pin","<ms to halo>/<ms to card data>"]`), open a task and come back N times (return time and memory after each), and count what the device log
says about ANR, crashes, slow frames and Reanimated's dead-tag retries. It never types, never sends, never changes an account and never uninstalls or clears data.
Evidence goes to a directory of JSON and PNG files. The CI native journey (scripts/p6_native_journey.py) is the disposable-server counterpart.

  python scripts/p6_dev_emulator_check.py --out DIR [--serial emulator-5554] [--expect-count 7] [--baseline titles.json] [--taps 30] [--cycles 20] [--video]
"""
import argparse
import json
import math
import re
import struct
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = 'rs.uskoci.dev'
sys.stdout.reconfigure(encoding='utf-8', errors='replace')          # task titles carry Serbian letters; a Windows console defaults to cp1252
ap = argparse.ArgumentParser()
ap.add_argument('--out', required=True)
ap.add_argument('--serial', default='emulator-5554')
ap.add_argument('--expect-count', type=int, default=None)
ap.add_argument('--baseline', default=None, help='JSON written by --write-baseline on the previous build (or a list of card labels): every task title must be listed again')
ap.add_argument('--write-baseline', default=None, help='write the count and every task title of the list (all of it, scrolled) to this JSON file')
ap.add_argument('--taps', type=int, default=30)
ap.add_argument('--cycles', type=int, default=20)
ap.add_argument('--video', action='store_true')
ap.add_argument('--only-list', action='store_true', help='launch, read (and with --write-baseline record) the list, and stop')
ARGS = ap.parse_args()
OUT = Path(ARGS.out)
OUT.mkdir(parents=True, exist_ok=True)
ADB = ['adb', '-s', ARGS.serial]
REPORT = {'serial': ARGS.serial, 'package': PACKAGE, 'checks': [], 'result': 'FAIL'}
ITEM = re.compile(r'^Otvori (?:priliku|Zadatak|zadatak)[: ]+(.*)$')
PIN = re.compile(r'\[USKOCI_P6_TRACE\] \["pin","(\d+)/(\d+)"\]')
LOG_PARTS = []          # the device log is cleared between steps; what each step saw is kept for the health counts
RESTORED = re.compile(r'^(\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}).*\[USKOCI_P6_TRACE\] \["restored","\d+/\d+"\]', re.M)


def log(*parts):
    print(time.strftime('%H:%M:%S'), *parts, flush=True)


def adb(*args, timeout=120):
    return subprocess.run(ADB + list(args), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout).stdout


def check(name, ok, **detail):
    REPORT['checks'].append({'name': name, 'ok': bool(ok), **detail})
    log('PASS' if ok else 'FAIL', name, json.dumps(detail, ensure_ascii=False)[:300])


def dump():
    adb('shell', 'uiautomator', 'dump', '/sdcard/p6chk.xml')
    xml = adb('exec-out', 'cat', '/sdcard/p6chk.xml')
    return ET.fromstring(xml[xml.index('<hierarchy'):])


def attrs(root):
    return [n.attrib for n in root.iter('node') if n.attrib.get('package') == PACKAGE]


def bounds(raw):
    return tuple(int(v) for v in re.findall(r'-?\d+', raw or ''))


def by_desc(root, prefix=None, exact=None, contains=None):
    out = []
    for a in attrs(root):
        d = a.get('content-desc', '') or ''
        if (prefix and d.startswith(prefix)) or (exact and d == exact) or (contains and contains in d):
            out.append(a)
    return out


def by_id(root, rid):
    return [a for a in attrs(root) if (a.get('resource-id') or '').endswith(rid)]


def cards(root):
    found = []
    for a in attrs(root):
        m = ITEM.match(a.get('content-desc', '') or '')
        if m:
            found.append({'label': a['content-desc'], 'title': m.group(1).split(',')[0].strip(), 'b': bounds(a.get('bounds'))})
    return sorted(found, key=lambda c: c['b'][1])


def count_shown(root):
    """The number the list's top line shows (its visible text, e.g. "7 zadataka")."""
    for a in attrs(root):
        m = re.match(r'\s*(\d+)\s+zadat', a.get('text', '') or '')
        if m:
            return int(m.group(1))
    return None


def tap(x, y, hold_ms=120):
    adb('shell', 'input', 'touchscreen', 'swipe', str(x), str(y), str(x), str(y), str(hold_ms))


def tap_node(a):
    x1, y1, x2, y2 = bounds(a.get('bounds'))
    tap((x1 + x2) // 2, (y1 + y2) // 2)


def back():
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')


def poll(pred, timeout=30, interval=0.4):
    end = time.time() + timeout
    while time.time() < end:
        root = dump()
        value = pred(root)
        if value:
            return value, root
        time.sleep(interval)
    return None, None


def screen():
    raw = subprocess.run(ADB + ['exec-out', 'screencap'], capture_output=True, timeout=90).stdout
    w, h, _fmt = struct.unpack('<III', raw[:12])
    extra = len(raw) - w * h * 4
    offset = extra if extra in (12, 16) else 12
    return w, h, memoryview(raw)[offset:offset + w * h * 4]


def png(name):
    data = subprocess.run(ADB + ['exec-out', 'screencap', '-p'], capture_output=True, timeout=90).stdout
    (OUT / f'{name}.png').write_bytes(data)


def pins(root, step=3, cell=24, gap=2):
    """Map markers found by the brand green (#076E4E) on the screenshot, in the rows no chrome covers: [{x, y, w, h}]."""
    w, h, px = screen()
    top, bottom = int(h * 0.18), int(h * 0.76)
    chips = by_desc(root, exact='Brzi filteri')
    if chips:
        top = bounds(chips[0]['bounds'])[3] + 6
    sheet = by_id(root, 'discovery-sheet-background')
    if sheet:
        bottom = bounds(sheet[0]['bounds'])[1] - 6
    card = by_desc(root, prefix='Otvori zadatak: ') + by_desc(root, prefix='Pogledaj zadatak ') + by_desc(root, prefix='Zatvori pregled')
    if card:
        bottom = min(bottom, min(bounds(a['bounds'])[1] for a in card) - 170)
    cells = {}
    for y in range(max(0, top), min(h, max(top + 1, bottom)), step):
        row = y * w * 4
        for x in range(0, w, step):
            i = row + x * 4
            if abs(px[i] - 7) <= 30 and abs(px[i + 1] - 110) <= 30 and abs(px[i + 2] - 78) <= 30:
                cells[(x // cell, y // cell)] = cells.get((x // cell, y // cell), 0) + 1
    seen, found = set(), []
    for start in cells:
        if start in seen:
            continue
        stack, members = [start], []
        seen.add(start)
        while stack:
            cx, cy = stack.pop()
            members.append((cx, cy))
            for dx in range(-gap, gap + 1):
                for dy in range(-gap, gap + 1):
                    nb = (cx + dx, cy + dy)
                    if nb in cells and nb not in seen:
                        seen.add(nb)
                        stack.append(nb)
        if sum(cells[m] for m in members) < 12:
            continue
        xs, ys = [m[0] for m in members], [m[1] for m in members]
        left, right, upper, lower = min(xs) * cell, max(xs) * cell + cell, min(ys) * cell, max(ys) * cell + cell
        found.append({'x': (left + right) // 2, 'y': (upper + lower) // 2, 'w': right - left, 'h': lower - upper})
    return sorted(found, key=lambda p: (p['y'], p['x']))


def percentile(values, q):
    ordered = sorted(values)
    return ordered[max(0, math.ceil(q * len(ordered)) - 1)] if ordered else None


def pss_kb():
    out = adb('shell', 'dumpsys', 'meminfo', PACKAGE)
    m = re.search(r'TOTAL PSS:\s+(\d+)', out) or re.search(r'^\s*TOTAL\s+(\d+)', out, re.M)
    return int(m.group(1)) if m else -1


def pid():
    out = adb('shell', 'pidof', PACKAGE).strip()
    return out.split()[0] if out else ''


def stamp(text):
    """'MM-DD HH:MM:SS.mmm' (device local time, as the device log prints it) -> seconds within the year-less calendar, good for differences of a few seconds."""
    m = re.match(r'(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\.(\d{3})', text)
    month, day, hh, mm, ss, ms = (int(x) for x in m.groups())
    return (((month * 31 + day) * 24 + hh) * 60 + mm) * 60 + ss + ms / 1000


def timed_back():
    """Android Back, stamped with the device's own clock just before the key is injected (the same clock the device log uses)."""
    out = adb('shell', 'date "+%m-%d %H:%M:%S.%N"; input keyevent KEYCODE_BACK').strip().splitlines()
    return stamp(out[0][:18]) if out else None


def restored_after(at, wait_s=15):
    """Seconds from `at` to the P6 screen's own `restored` line (its reads are in and the screen was committed), None on the legacy build."""
    end = time.time() + wait_s
    while at is not None and time.time() < end:
        text = adb('logcat', '-d', '-v', 'threadtime', '-s', 'ReactNativeJS:I', timeout=120)
        later = [stamp(t) for t in RESTORED.findall(text) if stamp(t) >= at]
        if later:
            return round(min(later) - at, 3)
        time.sleep(0.7)
    return None


def peek_title(root):
    for a in by_desc(root, prefix='Otvori zadatak: '):
        return a['content-desc'][len('Otvori zadatak: '):].split(',')[0].strip()
    return None


def close_peek():
    root = dump()
    close = by_desc(root, exact='Zatvori pregled zadatka') or by_desc(root, prefix='Zatvori pregled')
    if not close:
        return False
    tap_node(close[0])
    time.sleep(1.2)
    return True


# ---------------------------------------------------------------------------------------------------------------- steps
def launch():
    adb('shell', 'am', 'force-stop', PACKAGE)
    adb('logcat', '-c')
    adb('shell', 'am', 'start', '-n', f'{PACKAGE}/.MainActivity')
    time.sleep(6)
    end = time.time() + 90
    while time.time() < end:
        root = dump()
        # The Zadaci screen is up when its list line, a card or its map is on screen (the app reopens on the view it was left in).
        if by_id(root, 'list-count-words') or by_id(root, 'list-count') or cards(root) or by_desc(root, prefix='Mapa'):
            return root
        for a in attrs(root):
            if (a.get('content-desc') == 'Zadaci' or a.get('text') == 'Zadaci') and a.get('clickable') == 'true':
                tap_node(a)
                break
        time.sleep(2)
    raise RuntimeError('the Zadaci screen did not appear')


def ensure_full_list():
    """The list at full height: the top line's own button opens it (the count line is a button while the sheet is low)."""
    root = dump()
    for _ in range(3):
        button = by_id(root, 'list-count')
        if not button and by_id(root, 'list-count-words'):
            return root                                             # the count is plain words (not a button) only while the sheet stands full
        if button:
            tap_node(button[0])
            got, root = poll(lambda r: by_id(r, 'list-count-words') and cards(r), 25, 0.5)
            if got:
                return root
        root = dump()
    return root


def collect_titles(root, max_swipes=14):
    """Every task title in the list: the list is scrolled from its top a screen at a time until nothing new appears (a title can repeat: tasks are told apart by their whole label)."""
    labels = {}
    for _ in range(max_swipes):
        fresh = 0
        for c in cards(root):
            if c['label'] not in labels:
                labels[c['label']] = c['title']
                fresh += 1
        if fresh == 0 and labels:
            break
        adb('shell', 'input', 'touchscreen', 'swipe', '540', '1750', '540', '850', '450')
        time.sleep(1.4)
        root = dump()
    for _ in range(max_swipes):                                    # back to the top, so the steps after this one start where a person would
        adb('shell', 'input', 'touchscreen', 'swipe', '540', '700', '540', '1900', '350')
        time.sleep(0.8)
    return sorted(labels.values()), root


def read_list():
    root = ensure_full_list()
    for _ in range(8):
        if count_shown(root) is not None and cards(root):
            break
        time.sleep(1.5)
        root = dump()
    shown_count = count_shown(root)
    png('01_list')
    titles, root = collect_titles(root)
    REPORT['list'] = {'count': shown_count, 'titles': titles}
    if ARGS.expect_count is not None:
        check('LIST_COUNT_MATCHES_EXPECTED', shown_count == ARGS.expect_count, shown=shown_count, expected=ARGS.expect_count)
    check('LIST_SHOWS_AS_MANY_CARDS_AS_ITS_COUNT', shown_count is not None and len(titles) == shown_count, cards=len(titles), count=shown_count)
    if ARGS.write_baseline:
        Path(ARGS.write_baseline).write_text(json.dumps({'count': shown_count, 'titles': titles}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if ARGS.baseline:
        base = json.loads(Path(ARGS.baseline).read_text(encoding='utf-8'))
        base_titles = sorted(base['titles']) if isinstance(base, dict) else sorted(ITEM.match(x).group(1).split(',')[0].strip() for x in base if ITEM.match(x))
        listed = list(titles)
        missing = []
        for t in base_titles:                                       # a multiset test: every earlier title is listed again (the list may hold more)
            if t in listed:
                listed.remove(t)
            else:
                missing.append(t)
        check('LIST_KEEPS_EVERY_TITLE_OF_THE_BASELINE', not missing, missing=missing, baseline=len(base_titles), now=len(titles))
    return root


def to_map(root):
    pill = by_desc(root, exact='Mapa')
    if pill:
        tap_node(pill[0])
        time.sleep(3)
    return dump()


def time_pins():
    root = to_map(dump())
    png('02_map')
    tried = []
    target = None
    for _ in range(12):
        root = dump()
        found = [p for p in pins(root) if not any(abs(p['x'] - t['x']) < 40 and abs(p['y'] - t['y']) < 40 for t in tried)]
        if not found:
            break
        p = found[0]
        tried.append(p)
        tap(p['x'], p['y'], 140)
        time.sleep(3)
        root = dump()
        if peek_title(root):
            target = p
            break
        if by_desc(root, contains='Prikaži sve u listi'):
            close_peek()
        else:
            tried.clear()
    if target is None:
        check('MAP_HAS_A_TASK_BUCKET_TO_TIME', False, tried=len(tried))
        return
    png('03_peek')
    close_peek()
    adb('logcat', '-c')
    shown, moved = 0, []
    for i in range(ARGS.taps):
        tap(target['x'], target['y'], 140)
        root, _ = None, None
        got, root = poll(lambda r: peek_title(r), 20, 0.3)
        if not got:
            close_peek()
            continue
        shown += 1
        if i < 3:
            first = [bounds(a['bounds']) for a in by_desc(root, prefix='Otvori zadatak: ')][:1]
            time.sleep(1.2)
            later = dump()
            second = [bounds(a['bounds']) for a in by_desc(later, prefix='Otvori zadatak: ')][:1]
            moved.append(max(abs(a - b) for a, b in zip(first[0], second[0])) if first and second else None)
        close_peek()
    time.sleep(2)
    text = adb('logcat', '-d', '-v', 'threadtime', timeout=180)
    LOG_PARTS.append(text)
    pairs = [(int(a), int(b)) for a, b in PIN.findall(text)]
    fb, content = [a for a, _ in pairs], [b for _, b in pairs]
    summary = {'touches': ARGS.taps, 'peekShown': shown, 'traced': len(pairs),
               'firstFeedbackMs': {'p50': percentile(fb, .5), 'p95': percentile(fb, .95), 'max': max(fb, default=None)},
               'usableContentMs': {'p50': percentile(content, .5), 'p95': percentile(content, .95), 'max': max(content, default=None)},
               'peekMovedPxAfterAppearing': moved,
               'conditions': f'{ARGS.serial} (host GPU emulator) against the canonical DEV backend; JS-side clock: touch handled -> halo committed -> card data committed'}
    REPORT['pinTiming'] = summary
    check('PIN_TIMING_MEASURED', len(pairs) >= max(3, int(ARGS.taps * .9)), **summary)
    measured = [m for m in moved if m is not None]
    check('PEEK_DOES_NOT_MOVE_AFTER_IT_APPEARS', len(measured) >= 2 and max(measured) <= 4, movedPx=moved)


SETTLED = re.compile(r'\[USKOCI_P6_TRACE\] \["settled","(OWN_CLUSTER|OWN_MOVE|QUIET_MOVE)"\]')


def map_rows(root):
    """The rows of the map no chrome covers (under the quick chips, above the list sheet): the band a drag can start in."""
    _w, h, _px = screen()
    top, bottom = int(h * 0.18), int(h * 0.76)
    chips = by_desc(root, exact='Brzi filteri')
    if chips:
        top = bounds(chips[0]['bounds'])[3] + 6
    sheet = by_id(root, 'discovery-sheet-background')
    if sheet:
        bottom = bounds(sheet[0]['bounds'])[1] - 6
    return top, max(top + 1, bottom)


def gestures():
    """P6-11 pan and zoom on the real map (a pinch cannot be sent through adb): a drag and each zoom button settle to the reader's own trace line, and the screen keeps its
    list line and shows no error."""
    root = to_map(dump())
    png('04_before_gestures')
    top, bottom = map_rows(root)
    y = (top + bottom) // 2
    steps = [('PAN', lambda: adb('shell', 'input', 'touchscreen', 'swipe', '820', str(y), '300', str(y - 60), '700')),
             ('ZOOM_OUT', lambda: (lambda b: tap_node(b[0]))(by_desc(dump(), exact='Umanji mapu'))),
             ('ZOOM_IN', lambda: (lambda b: tap_node(b[0]))(by_desc(dump(), exact='Uvećaj mapu')))]
    for name, act in steps:
        adb('logcat', '-c')
        act()
        time.sleep(6)
        text = adb('logcat', '-d', '-v', 'threadtime', '-s', 'ReactNativeJS:I', timeout=120)
        LOG_PARTS.append(text)
        settled = SETTLED.findall(text)
        root = dump()
        png('05_after_' + name.lower())
        check(f'{name}_SETTLES_TO_A_READ', bool(settled), settled=settled)
        check(f'{name}_KEEPS_THE_TOP_LINE_AND_SHOWS_NO_ERROR', bool(by_id(root, 'list-count') or by_id(root, 'list-count-words'))
              and not by_desc(root, contains='nisu dostupni') and not [a for a in attrs(root) if 'nisu dostupni' in (a.get('text') or '')])
    # The map's area is the person's own move and is remembered with the view: take it away, so the next phase starts from the whole list.
    clear = by_id(dump(), 'clear-where')
    if clear:
        tap_node(clear[0])
        time.sleep(4)


def cycles():
    root = dump()
    if not cards(root):
        root = dump()
    mem = [{'tag': 'before', 'kb': pss_kb(), 'pid': pid()}]
    returns, restored, ok_all = [], [], True
    for i in range(1, ARGS.cycles + 1):
        root = dump()
        cs = cards(root)
        if not cs:
            check(f'CYCLE_{i:02d}_HAS_CARDS', False)
            ok_all = False
            break
        pick = cs[min(1, len(cs) - 1)]
        tap((pick['b'][0] + pick['b'][2]) // 2, (pick['b'][1] + pick['b'][3]) // 2)
        detail, _ = poll(lambda r: not by_id(r, 'list-count-words') and not by_id(r, 'list-count') and any(pick['title'] in (a.get('content-desc', '') + a.get('text', '')) for a in attrs(r)), 20, 0.3)
        time.sleep(0.8)
        started = time.time()
        pressed = timed_back()
        got, root = poll(lambda r: any(c['title'] == pick['title'] for c in cards(r)), 30, 0.25)
        returns.append(round(time.time() - started, 2) if got else None)
        restored.append(restored_after(pressed) if got else None)
        ok_all = ok_all and bool(detail) and bool(got)
        if i in (1, 5, ARGS.cycles // 2, 15, ARGS.cycles):
            mem.append({'tag': f'cycle_{i}', 'kb': pss_kb(), 'pid': pid()})
    time.sleep(10)
    mem.append({'tag': 'final_after_idle', 'kb': pss_kb(), 'pid': pid()})
    done = [r for r in returns if r is not None]
    js = [r for r in restored if r is not None]
    REPORT['cycles'] = {'n': ARGS.cycles, 'returnsS': returns, 'restoredAfterBackS': restored, 'mem': mem,
                        'returnP50S': percentile(done, .5), 'returnP95S': percentile(done, .95), 'returnMaxS': max(done, default=None),
                        'restoredP50S': percentile(js, .5), 'restoredP95S': percentile(js, .95), 'restoredMaxS': max(js, default=None),
                        'note': 'returnsS: Back -> cards seen by a UI dump (includes the dump itself); restoredAfterBackS: Back -> the screen\'s own restored trace line (device clock)'}
    check('EVERY_CYCLE_OPENED_AND_RETURNED', ok_all and len(done) == ARGS.cycles, returns=len(done))
    pids = {m['pid'] for m in mem if m['pid']}
    check('APP_PROCESS_SURVIVED_CYCLES', len(pids) == 1, pids=sorted(pids))
    kb = {m['tag']: m['kb'] for m in mem if m['kb'] > 0}
    warm = kb.get('cycle_5') or kb.get('cycle_1')
    if warm and kb.get('final_after_idle'):
        # Baseline (cold), the warmed-up level after five cycles, the peak and the level after ten idle seconds: growth is judged from the warmed-up level.
        check('NO_MEMORY_ACCUMULATION_OVER_THE_CYCLES', kb['final_after_idle'] <= warm * 1.15 + 10000, baseline_kb=kb.get('before'), warm_kb=warm,
              peak_kb=max(kb.values()), final_kb=kb['final_after_idle'])


def health():
    text = '\n'.join(LOG_PARTS + [adb('logcat', '-d', '-v', 'threadtime', timeout=240)])
    davey = [int(m) for m in re.findall(r'Davey! duration=(\d+)ms', text)]
    counts = {'anr': len(re.findall(r'ANR in ' + re.escape(PACKAGE), text)),
              'fatal': len(re.findall(r'FATAL EXCEPTION', text)),
              'died': len(re.findall(r'Process ' + re.escape(PACKAGE) + ' \\(pid \\d+\\) has died', text)),
              'daveyOver700ms': sum(1 for d in davey if d >= 700), 'daveyMaxMs': max(davey, default=0),
              'reanimatedDeadTagLines': len(re.findall(r'synchronouslyUpdateUIProps failed', text)),
              'p6ReadFailed': len(re.findall(r'\[USKOCI_P6_TRACE\] \["(?:read-failed|restore-failed)"', text)),
              'viewToBitmapErrors': len(re.findall(r'viewToBitmap', text))}
    REPORT['health'] = counts
    check('NO_ANR_OR_CRASH', counts['anr'] == 0 and counts['fatal'] == 0 and counts['died'] == 0, **counts)
    check('NO_P6_READ_FAILURE_IN_THE_LOG', counts['p6ReadFailed'] == 0, count=counts['p6ReadFailed'])
    (OUT / 'logcat-tail.txt').write_text('\n'.join(text.splitlines()[-4000:]), encoding='utf-8')
    (OUT / 'logcat-p6.txt').write_text('\n'.join(l for l in text.splitlines() if 'USKOCI_P6_TRACE' in l or 'USKOCI_DISCOVERY_TRACE' in l), encoding='utf-8')
    gfx = adb('shell', 'dumpsys', 'gfxinfo', PACKAGE)
    (OUT / 'gfxinfo.txt').write_text(gfx, encoding='utf-8')
    m = re.search(r'Total frames rendered:\s+(\d+)', gfx), re.search(r'Janky frames:\s+(\d+) \(([\d.]+)%\)', gfx)
    REPORT['gfx'] = {'frames': int(m[0].group(1)) if m[0] else None, 'janky': int(m[1].group(1)) if m[1] else None, 'jankyPercent': float(m[1].group(2)) if m[1] else None}


class Recording:
    """A screen recording of one phase (the device's recorder stops after 170 s, so a long phase shows its first minutes): pulled to OUT/video_<name>.mp4."""
    def __init__(self, name):
        self.name, self.proc = name, None

    def __enter__(self):
        if ARGS.video:
            self.proc = subprocess.Popen(ADB + ['shell', 'screenrecord', '--time-limit', '170', '--bit-rate', '3000000', '--size', '540x1212', f'/sdcard/p6chk_{self.name}.mp4'],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1.5)
        return self

    def __exit__(self, *_exc):
        if self.proc is not None:
            adb('shell', 'pkill', '-2', 'screenrecord')
            time.sleep(2.5)
            subprocess.run(ADB + ['pull', f'/sdcard/p6chk_{self.name}.mp4', str(OUT / f'video_{self.name}.mp4')], capture_output=True)
            adb('shell', 'rm', '-f', f'/sdcard/p6chk_{self.name}.mp4')
        return False


def main():
    try:
        REPORT['device'] = {'sdk': adb('shell', 'getprop', 'ro.build.version.sdk').strip(), 'size': adb('shell', 'wm', 'size').strip(),
                            'build': adb('shell', 'dumpsys', 'package', PACKAGE).split('versionName=')[1].split()[0] if 'versionName=' in adb('shell', 'dumpsys', 'package', PACKAGE) else '?'}
        adb('logcat', '-G', '64M')            # the whole run stays in the device log (the default ring is 2 MiB)
        launch()
        root = read_list()
        if ARGS.only_list:
            REPORT['result'] = 'PASS' if all(c['ok'] for c in REPORT['checks']) else 'FAIL'
            return
        with Recording('pins'):
            time_pins()
        gestures()
        adb('shell', 'am', 'force-stop', PACKAGE)
        launch()
        read_list()
        with Recording('cycles'):
            cycles()
        health()
        REPORT['result'] = 'PASS' if all(c['ok'] for c in REPORT['checks']) else 'FAIL'
    except BaseException as exc:                                          # noqa: BLE001 - always leave a report behind
        REPORT['error'] = f'{type(exc).__name__}: {str(exc)[:400]}'
        REPORT['result'] = 'FAIL'
        raise
    finally:
        (OUT / 'report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        log('RESULT', REPORT['result'])


if __name__ == '__main__':
    main()
    sys.exit(0 if REPORT['result'] == 'PASS' else 1)
