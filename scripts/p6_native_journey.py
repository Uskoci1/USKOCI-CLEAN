#!/usr/bin/env python3
"""P6 native acceptance journey on the CI-hosted Android emulator against a DISPOSABLE restricted local server.

Real UI input only (uiautomator + adb input). The database is used read-only for postflight facts (RPC call counts,
expected totals). Nothing here signs in through a shortcut: the viewer account is a real local Auth user created by
supabase/proofs/discovery/p6_native_fixture.mjs and the app signs in through its real sheet.

P6N_JOURNEY=probe : record the real UI structure at every step, tolerate step failures (used to learn labels/geometry).
P6N_JOURNEY=full  : the acceptance journey; any failed assertion is a failure.
"""
import ast
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

PACKAGE = 'rs.uskoci.dev'
MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
MODE = os.environ.get('P6N_JOURNEY', 'probe')
assert MODE in ('probe', 'full')
DB_URL = os.environ['RU5_DEVICE_DB_URL']
if urlparse(DB_URL).hostname not in ('localhost', '127.0.0.1'):
    raise RuntimeError('P6 native journey requires the disposable local database')
PASSWORD = os.environ['P6N_PASSWORD']
VIEWER_EMAIL = os.environ['P6N_VIEWER_EMAIL']
TOTAL = int(os.environ['P6N_TOTAL'])
ARTIFACT_DIR = Path(os.environ.get('P6N_ARTIFACT_DIR', 'artifacts/p6-native'))
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
CORE106 = True  # the helpers' "current three-zone shell" wait after login

# Borrow only the FUNCTION definitions of the proven RU5 driver (input pacing, ANR handling, tap/wait, paced typing).
_source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
_defs = ast.Module(body=[n for n in ast.parse(_source.read_text(encoding='utf-8')).body if isinstance(n, ast.FunctionDef)],
                   type_ignores=[])
exec(compile(_defs, str(_source), 'exec'), globals())

REPORT = {'mode': MODE, 'sourceSha': os.environ.get('GITHUB_SHA'), 'steps': [], 'checks': [], 'result': 'FAIL'}
ITEM_DESC = re.compile(r'^Otvorite (?:priliku|Zadatak|zadatak)\s+(P6N (\d{3}) (DENSE|SPARSE|REMOTE|NOPOINT))')
UI_LOG = []


def note(kind, **fields):
    line = {'t': round(time.time(), 1), 'kind': kind, **fields}
    print(json.dumps(line, ensure_ascii=False), flush=True)
    return line


def screen_size():
    w, h = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1])
    return w, h


def rid(node):
    return node.attrib.get('resource-id', '')


def label_of(node):
    return (node.attrib.get('text', '') or node.attrib.get('content-desc', '')).strip()


def ui_inventory(root, limit=140):
    """Compact, bounded description of what is on screen: id / label / clickable / bounds."""
    rows = []
    for n in root.iter():
        if n.attrib.get('package') != PACKAGE:
            continue
        r, t, d = rid(n), n.attrib.get('text', ''), n.attrib.get('content-desc', '')
        if not (r or t or d):
            continue
        rows.append({'id': r, 'text': t[:90], 'desc': d[:120], 'click': n.attrib.get('clickable') == 'true',
                     'bounds': n.attrib.get('bounds', '')})
        if len(rows) >= limit:
            break
    return rows


def snapshot(name):
    """PNG + XML (via the proven shot()) and a compact JSON inventory kept in the report."""
    shot(name)
    root, _, _ = dump_tree()
    inv = ui_inventory(root)
    (ARTIFACT_DIR / f'{name}.inventory.json').write_text(json.dumps(inv, ensure_ascii=False, indent=1), encoding='utf-8')
    return root, inv


def items(root):
    """Visible task cards as (index, title, kind, bounds, node)."""
    out = []
    for n in root.iter():
        m = ITEM_DESC.match(n.attrib.get('content-desc', '') or '')
        if m and n.attrib.get('package') == PACKAGE:
            x1, y1, x2, y2 = parse_bounds(n.attrib.get('bounds'))
            out.append({'index': int(m.group(2)), 'title': m.group(1), 'kind': m.group(3), 'bounds': (x1, y1, x2, y2), 'node': n})
    return sorted(out, key=lambda i: i['bounds'][1])


def count_from(root):
    for n in root.iter():
        if rid(n) == 'list-count' or rid(n) == 'list-count-words':
            m = re.search(r'\d+', label_of(n) + ' ' + n.attrib.get('content-desc', ''))
            if m:
                return int(m.group(0)), label_of(n) or n.attrib.get('content-desc', '')
    return None, ''


def swipe(x1, y1, x2, y2, ms=450):
    adb('shell', 'input', 'touchscreen', 'swipe', str(x1), str(y1), str(x2), str(y2), str(ms))
    time.sleep(1.0)


def scroll_list(direction='down', fraction=0.5):
    w, h = screen_size()
    span = int(h * fraction)
    top, bottom = int(h * 0.30), int(h * 0.85)
    if direction == 'down':   # finger moves up: content moves up, later items appear
        swipe(w // 2, bottom, w // 2, bottom - span)
    else:
        swipe(w // 2, top, w // 2, top + span)


def rpc_calls():
    """Number of rpc_discovery_v1 executions since the last reset (track_functions=all is enabled by the workflow)."""
    try:
        return int(psql("select coalesce(sum(calls),0)::bigint from pg_stat_user_functions where funcname='rpc_discovery_v1'") or 0)
    except Exception:
        return -1


def reset_rpc_calls():
    try:
        psql("select pg_stat_reset_single_function_counters('public.rpc_discovery_v1(jsonb)'::regprocedure)")
    except Exception as exc:                                  # noqa: BLE001
        note('RPC_COUNTER_RESET_FAILED', error=str(exc)[:160])


def mem_kb():
    out = adb('shell', 'dumpsys', 'meminfo', PACKAGE, check=False).stdout
    m = re.search(r'TOTAL PSS:\s+(\d+)', out) or re.search(r'^\s*TOTAL\s+(\d+)', out, re.M)
    return int(m.group(1)) if m else -1


def open_deep_link(url):
    r = adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, '-p', PACKAGE, check=False)
    note('deep_link', url=url, rc=r.returncode, out=(r.stdout or '')[-160:])
    time.sleep(3)


def step(name, fn):
    started = time.time()
    try:
        fn()
        REPORT['steps'].append({'name': name, 'ok': True, 's': round(time.time() - started, 1)})
        note('STEP_OK', name=name)
    except Exception as exc:                                 # noqa: BLE001 - probe tolerates, full re-raises
        if getattr(exc, 'native_surface_fatal', False):
            REPORT['steps'].append({'name': name, 'ok': False, 'fatal': True, 'error': str(exc)[:600]})
            raise
        REPORT['steps'].append({'name': name, 'ok': False, 'error': f'{type(exc).__name__}: {str(exc)[:600]}'})
        note('STEP_FAIL', name=name, error=f'{type(exc).__name__}: {str(exc)[:300]}')
        try:
            snapshot(f'FAIL_{name}')
        except Exception:                                    # noqa: BLE001
            pass
        if MODE == 'full':
            raise


def check(name, ok, **facts):
    REPORT['checks'].append({'name': name, 'ok': bool(ok), **facts})
    note('CHECK_PASS' if ok else 'CHECK_FAIL', name=name, **facts)
    if not ok and MODE == 'full':
        raise AssertionError(f'{name}: {facts}')


# ------------------------------------------------------------------------------------------------ steps
def s_login():
    launch_clean()
    login(VIEWER_EMAIL)
    snapshot('P6_01_after_login')
    # A notification-permission or similar system prompt would be recorded here, never granted silently.


def s_route():
    reset_rpc_calls()
    time.sleep(1.5)
    REPORT['rpcBefore'] = rpc_calls()
    open_deep_link('uskociapp://zadaci?p6Proof=1')
    wait_nodes(timeout=60, minimum=1, contains='zadatak')
    time.sleep(5)
    root, inv = snapshot('P6_02_route_initial')
    REPORT['initialCount'] = count_from(root)
    REPORT['rpcAfterRoute'] = rpc_calls()
    check('P6_READER_CALLED_BY_ROUTE', REPORT['rpcAfterRoute'] > max(REPORT['rpcBefore'], 0), before=REPORT['rpcBefore'], after=REPORT['rpcAfterRoute'])
    check('COUNT_MATCHES_SERVER_TOTAL', REPORT['initialCount'][0] == TOTAL, ui=REPORT['initialCount'], expected=TOTAL)


def s_open_full():
    root, parent, _ = dump_tree()
    target = next((n for n in root.iter() if rid(n) in ('list-count', 'list-count-words')), None)
    if target is None:
        raise RuntimeError('list-count control not found')
    tap_node(target, parent)
    time.sleep(3)
    root, inv = snapshot('P6_03_full_list')
    cards = items(root)
    check('FULL_LIST_SHOWS_CARDS', len(cards) >= 3, visible=len(cards), first=[c['title'] for c in cards[:3]])


def s_scroll_and_anchor():
    for _ in range(6):
        scroll_list('down', 0.55)
    root, inv = snapshot('P6_04_scrolled')
    cards = items(root)
    check('SCROLL_REACHED_NON_TRIVIAL_POSITION', bool(cards) and cards[0]['index'] >= 8, first=[c['title'] for c in cards[:3]])
    REPORT['anchor'] = {'title': cards[0]['title'], 'index': cards[0]['index'], 'y1': cards[0]['bounds'][1]} if cards else None


def s_detail_and_back():
    anchor = REPORT.get('anchor')
    root, parent, _ = dump_tree()
    cards = items(root)
    pick = next((c for c in cards if anchor and c['title'] == anchor['title']), cards[0] if cards else None)
    if pick is None:
        raise RuntimeError('no card to open')
    REPORT['opened'] = {'title': pick['title'], 'y1': pick['bounds'][1]}
    tap_node(pick['node'], parent)
    time.sleep(3)
    root, inv = snapshot('P6_05_detail')
    check('DETAIL_SHOWS_TITLE', any(pick['title'] in label_of(n) for n in root.iter()), title=pick['title'])
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
    time.sleep(3)
    root, inv = snapshot('P6_06_after_back')
    cards = items(root)
    same = next((c for c in cards if c['title'] == pick['title']), None)
    check('BACK_RESTORES_SAME_TASK_VISIBLE', same is not None, wanted=pick['title'], visible=[c['title'] for c in cards[:6]])
    if same is not None:
        drift = abs(same['bounds'][1] - REPORT['opened']['y1'])
        check('BACK_RESTORES_SCROLL_POSITION', drift <= 60, before_y=REPORT['opened']['y1'], after_y=same['bounds'][1], drift=drift)
    check('BACK_KEEPS_FULL_LIST', len(cards) >= 3, visible=len(cards))


def s_repeat_cycles(n=10):
    REPORT['mem'] = [{'tag': 'before_cycles', 'kb': mem_kb()}]
    rpc_start = rpc_calls()
    for i in range(1, n + 1):
        root, parent, _ = dump_tree()
        cards = items(root)
        if not cards:
            raise RuntimeError('list empty before cycle')
        pick = cards[min(1, len(cards) - 1)]
        tap_node(pick['node'], parent)
        time.sleep(2.5)
        adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
        time.sleep(2.5)
        root, _, _ = dump_tree()
        back_cards = items(root)
        check(f'CYCLE_{i:02d}_LIST_RESTORED', any(c['title'] == pick['title'] for c in back_cards), title=pick['title'])
        if i in (1, n // 2, n):
            REPORT['mem'].append({'tag': f'cycle_{i}', 'kb': mem_kb()})
    snapshot('P6_07_after_cycles')
    rpc_end = rpc_calls()
    REPORT['cycleRpcCalls'] = rpc_end - rpc_start
    check('NO_RUNAWAY_READER_CALLS', 0 <= REPORT['cycleRpcCalls'] <= n * 2, calls=REPORT['cycleRpcCalls'], cycles=n)
    kb = [m['kb'] for m in REPORT['mem'] if m['kb'] > 0]
    if len(kb) >= 2:
        check('NO_OBVIOUS_MEMORY_GROWTH', kb[-1] <= kb[0] * 1.35 + 20000, first_kb=kb[0], last_kb=kb[-1])


def s_probe_extras():
    """Probe only: exercise the controls whose labels we still need to learn."""
    root, parent, _ = dump_tree()
    for name in ('Na daljinu', 'Na licu mesta', 'Brzi filteri', 'Mapa', 'Pretraži zadatke'):
        nodes = [n for n in root.iter() if label_of(n) == name or n.attrib.get('content-desc', '') == name]
        note('PROBE_CONTROL', name=name, found=len(nodes))
    try:
        tap(desc='Mapa', prefer='bottom', timeout=10)
        time.sleep(4)
        snapshot('P6_08_map_mode')
        w, h = screen_size()
        swipe(w // 2, h // 3, w // 2 + 200, h // 3 + 100, 500)
        snapshot('P6_09_map_panned')
    except Exception as exc:                                  # noqa: BLE001
        note('PROBE_MAP_FAIL', error=str(exc)[:200])


def main():
    note('START', mode=MODE, total=TOTAL)
    for name, fn in (('login', s_login), ('route', s_route), ('open_full', s_open_full),
                     ('scroll_anchor', s_scroll_and_anchor), ('detail_back', s_detail_and_back),
                     ('cycles', s_repeat_cycles), ('probe_extras', s_probe_extras if MODE == 'probe' else lambda: None)):
        step(name, fn)
    REPORT['result'] = 'PASS' if all(s['ok'] for s in REPORT['steps']) and all(c['ok'] for c in REPORT['checks']) else 'FAIL'
    REPORT['finalMemKb'] = mem_kb()
    (ARTIFACT_DIR / 'p6-native-report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"{REPORT['result']} P6_NATIVE_JOURNEY mode={MODE}", flush=True)
    return 0 if (REPORT['result'] == 'PASS' or MODE == 'probe') else 1


try:
    sys.exit(main())
except SystemExit:
    raise
except BaseException as exc:                                  # noqa: BLE001 - always leave a report behind
    REPORT['result'] = 'FAIL'
    REPORT['error'] = f'{type(exc).__name__}: {str(exc)[:800]}'
    (ARTIFACT_DIR / 'p6-native-report.json').write_text(json.dumps(REPORT, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'FAIL P6_NATIVE_JOURNEY {REPORT["error"]}', flush=True)
    sys.exit(1)
