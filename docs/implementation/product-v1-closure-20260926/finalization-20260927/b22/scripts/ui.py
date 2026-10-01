#!/usr/bin/env python3
"""Scratchpad helper for the owner-approved EX-04 native check on the HONOR (2026-10-01). Taps, swipes, Back and READS only: no text input, no clear, no uninstall, no setting.
Every input is preceded by a foreground check: another app in front ends the call with no input sent.
usage: ui.py inv | tap TEXT [--nth N] [--exact] | tapxy X Y | back | swipe up|down [--ms 350] | shot NAME | gfxreset | gfx | fg | quiet | launch | text TEXT"""
import re, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path

SERIAL = 'A8QDVB6522001205'
PACKAGE = 'rs.uskoci.dev'
OUT = Path(__file__).parent / 'shots'
OUT.mkdir(exist_ok=True)


def adb(*args, timeout=90, raw=False):
    p = subprocess.run(['adb', '-s', SERIAL, *args], capture_output=True, timeout=timeout)
    return p.stdout if raw else p.stdout.decode('utf-8', 'replace')


def fg():
    out = adb('shell', 'dumpsys activity activities | grep -m1 topResumedActivity')
    m = re.search(r'topResumedActivity=ActivityRecord\{\S+ u\d+ ([\w.$]+)/(\S+?)[\s}]', out)
    return m.group(1) if m else None


def awake():
    out = adb('shell', 'dumpsys power | grep -m1 mWakefulness=')
    return 'Awake' in out


def wake():
    if not awake():
        adb('shell', 'input', 'keyevent', '224')   # KEYCODE_WAKEUP: only wakes the screen (no lock on this phone)
        time.sleep(1.2)


def guard():
    wake()
    front = fg()
    if front != PACKAGE:
        print(f'FOREGROUND LOST: {front} has the screen, not {PACKAGE}; no input sent')
        sys.exit(3)


def dump():
    for _ in range(4):
        raw = adb('exec-out', 'uiautomator', 'dump', '/dev/tty')
        s = raw.find('<hierarchy')
        if s >= 0 and '</hierarchy>' in raw:
            try:
                return ET.fromstring(raw[s:raw.index('</hierarchy>') + 12])
            except ET.ParseError:
                pass
        time.sleep(0.7)
    raise SystemExit('no UI tree')


def nodes(root):
    out = []
    for n in root.iter('node'):
        a = n.attrib
        if a.get('package') != PACKAGE:
            continue
        b = [int(x) for x in re.findall(r'\d+', a.get('bounds', '0 0 0 0'))]
        if len(b) != 4:
            continue
        out.append({'text': a.get('text', ''), 'desc': a.get('content-desc', ''), 'id': a.get('resource-id', ''), 'click': a.get('clickable') == 'true', 'b': b, 'cls': a.get('class', ''),
                    'checked': a.get('checked'), 'sel': a.get('selected')})
    return out


def label(n):
    return n['text'] or n['desc']


def inv(root=None):
    root = root or dump()
    rows = []
    for n in nodes(root):
        l = label(n)
        if not l and not n['click']:
            continue
        rows.append(f"{n['b'][0]:4d},{n['b'][1]:4d}-{n['b'][2]:4d},{n['b'][3]:4d} {'C' if n['click'] else ' '} {('['+n['sel']+']') if n['sel']=='true' else ''}{l[:110]!r}")
    return rows


def find(root, text, exact=False, nth=0):
    hits = [n for n in nodes(root) if (label(n) == text if exact else text.lower() in label(n).lower())]
    hits.sort(key=lambda n: (n['b'][1], n['b'][0]))
    return hits[nth] if len(hits) > nth else None


def tap(x, y):
    guard()
    adb('shell', 'input', 'tap', str(x), str(y))


def swipe(direction, ms=350):
    guard()
    w, h = 1264, 2728
    x = int(w * 0.5)
    y1, y2 = (int(h * 0.72), int(h * 0.32)) if direction == 'up' else (int(h * 0.32), int(h * 0.72))
    adb('shell', 'input', 'swipe', str(x), str(y1), str(x), str(y2), str(ms))


def shot(name):
    p = OUT / f'{name}.png'
    p.write_bytes(adb('exec-out', 'screencap', '-p', raw=True))
    return p


def gfx():
    t = adb('shell', 'dumpsys', 'gfxinfo', PACKAGE)
    def num(pat):
        m = re.search(pat, t)
        return m.group(1) if m else None
    j = re.search(r'Janky frames:\s+(\d+) \(([\d.]+)%\)', t)
    return {'frames': num(r'Total frames rendered:\s+(\d+)'), 'janky': j.group(1) if j else None, 'janky%': j.group(2) if j else None, 'p50': num(r'50th percentile:\s+(\d+)ms'),
            'p90': num(r'90th percentile:\s+(\d+)ms'), 'p95': num(r'95th percentile:\s+(\d+)ms'), 'p99': num(r'99th percentile:\s+(\d+)ms'), 'missedVsync': num(r'Number Missed Vsync:\s+(\d+)'),
            'slowUi': num(r'Number Slow UI thread:\s+(\d+)')}


def quiet():
    out = adb('shell', 'dumpsys power')
    m = re.search(r'lastUserActivityTime=(\d+) \((\d+) ms ago\)', out)
    return int(m.group(2)) / 1000 if m else None


if __name__ == '__main__':
    a = sys.argv[1:]
    cmd = a[0] if a else 'inv'
    if cmd == 'inv':
        guard() if '--force' not in a else None
        print('\n'.join(inv()))
    elif cmd == 'text':
        root = dump()
        print([label(n) for n in nodes(root) if label(n)])
    elif cmd == 'tap':
        root = dump()
        n = find(root, a[1], exact='--exact' in a, nth=int(a[a.index('--nth') + 1]) if '--nth' in a else 0)
        if not n:
            print('NOT FOUND', a[1]); sys.exit(2)
        x, y = (n['b'][0] + n['b'][2]) // 2, (n['b'][1] + n['b'][3]) // 2
        tap(x, y); print('tapped', repr(label(n)[:80]), x, y)
    elif cmd == 'tapxy':
        tap(int(a[1]), int(a[2])); print('tapped', a[1], a[2])
    elif cmd == 'tapx':
        # tapx TEXT EXPECT [--exact]: tap, then wait (<= 9 s) for a node containing EXPECT; exit 4 when it never shows up
        root = dump()
        n = find(root, a[1], exact='--exact' in a)
        if not n:
            print('NOT FOUND', a[1]); sys.exit(2)
        tap((n['b'][0] + n['b'][2]) // 2, (n['b'][1] + n['b'][3]) // 2)
        for _ in range(18):
            time.sleep(0.5)
            if any(a[2].lower() in label(m).lower() for m in nodes(dump())):
                print('OK', repr(a[1][:40]), '->', repr(a[2])); break
        else:
            print('EXPECTED SCREEN MARKER NEVER SHOWED', repr(a[2])); sys.exit(4)
    elif cmd == 'home':
        for _ in range(8):
            root = dump()
            if any(label(n).startswith('USKOČI, Početna') for n in nodes(root)):
                print('home reached'); break
            guard(); adb('shell', 'input', 'keyevent', '4'); time.sleep(1.2)
        else:
            print('home NOT reached'); sys.exit(4)
    elif cmd == 'top':
        marker = a[1]
        for _ in range(20):
            root = dump()
            if any(label(n).startswith(marker) for n in nodes(root)):
                print('top reached'); break
            swipe('down'); time.sleep(0.7)
        else:
            print('top NOT reached')
    elif cmd == 'back':
        guard(); adb('shell', 'input', 'keyevent', '4'); print('back')
    elif cmd == 'swipe':
        swipe(a[1], int(a[a.index('--ms') + 1]) if '--ms' in a else 350); print('swiped', a[1])
    elif cmd == 'shot':
        print(shot(a[1]))
    elif cmd == 'gfxreset':
        adb('shell', 'dumpsys', 'gfxinfo', PACKAGE, 'reset'); print('reset')
    elif cmd == 'gfx':
        print(gfx())
    elif cmd == 'fg':
        print(fg())
    elif cmd == 'quiet':
        print('seconds since the last user activity:', quiet(), '| foreground:', fg())
    elif cmd == 'launch':
        adb('shell', 'am', 'start', '-n', f'{PACKAGE}/.MainActivity'); time.sleep(4); print('foreground:', fg())
