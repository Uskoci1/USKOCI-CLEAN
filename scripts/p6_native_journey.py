#!/usr/bin/env python3
"""P6 native acceptance journey on the CI-hosted Android emulator against a DISPOSABLE restricted local server.

Real UI input only (uiautomator + adb input). The database is used read-only for postflight facts (the exact
rpc_discovery_v1 requests the app sent, expected counts). Nothing here signs in through a shortcut: the viewer account
is a real local Auth user created by supabase/proofs/discovery/p6_native_fixture.mjs and the app signs in through its
real sheet.

P6N_JOURNEY=probe : record the real UI structure at every step; failures are recorded, never fatal (learn labels/geometry).
P6N_JOURNEY=full  : the acceptance journey; every recorded failure fails the run (the steps still all execute so one
                    run yields the whole evidence).

Server-side evidence: the disposable database logs every statement (workflow step), so the driver reads back the exact
rpc_discovery_v1 request bodies the app sent (mode, filter, scope, cursor, bounds) and compares the UI with them and
with the counts the server itself returns for the same filters (fixture.json `expected`). Nothing is read from the
canonical DEV.
"""
import ast
import json
import math
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
FIXTURE_PATH = ARTIFACT_DIR / 'fixture.json'
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding='utf-8')) if FIXTURE_PATH.exists() else {}
EXPECTED = FIXTURE.get('expected', {})
START_ISO = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 5))

# Borrow only the FUNCTION definitions of the proven RU5 driver (input pacing, ANR handling, tap/wait, paced typing).
_source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
_defs = ast.Module(body=[n for n in ast.parse(_source.read_text(encoding='utf-8')).body if isinstance(n, ast.FunctionDef)],
                   type_ignores=[])
exec(compile(_defs, str(_source), 'exec'), globals())

REPORT = {'mode': MODE, 'sourceSha': os.environ.get('GITHUB_SHA'), 'steps': [], 'checks': [], 'result': 'FAIL'}
ITEM_DESC = re.compile(r'^Otvori (?:priliku|Zadatak) (P6N (\d{3}) (DENSE|SPARSE|REMOTE|NOPOINT))$')
MARKER_DESC = re.compile(r'^(?:(\d+) zadat\w+ (na ovom mestu|u ovoj oblasti)|Jedan zadatak na mapi)')
LIST_URL = 'uskociapp://zadaci?p6Proof=1'


def note(kind, **fields):
    line = {'t': round(time.time(), 1), 'kind': kind, **fields}
    print(json.dumps(line, ensure_ascii=False), flush=True)
    return line


# ------------------------------------------------------------------------------------------------ device helpers
_DEVICE = {}


def screen_size():
    if 'size' not in _DEVICE:
        w, h = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1])
        _DEVICE['size'] = (w, h)
    return _DEVICE['size']


def px_per_dp():
    if 'dp' not in _DEVICE:
        out = adb('shell', 'wm', 'density', check=False).stdout
        nums = re.findall(r'(\d+)', out)
        _DEVICE['dp'] = (int(nums[-1]) / 160.0) if nums else 2.625
    return _DEVICE['dp']


_NAV = {'top': None}


def note_nav(root):
    """The app window's own tree carries the system bar's scrim (android:id/navigationBarBackground): its top is exact."""
    for n in root.iter():
        if n.attrib.get('resource-id', '').startswith('android:id/navigationBarBa'):
            try:
                _NAV['top'] = parse_bounds(n.attrib.get('bounds'))[1]
            except RuntimeError:
                pass
            return


def safe_bottom():
    """Lowest y a finger may safely press: the system navigation bar (48 dp in 3-button mode) can cover the app window's
    bottom edge, and a press inside the bar goes to the bar, never to the app (observed on the entry screen)."""
    if _NAV['top']:
        return _NAV['top'] - 8
    w, h = screen_size()
    return h - int(round(48 * px_per_dp())) - 8


def rid(node):
    return node.attrib.get('resource-id', '')


def label_of(node):
    return (node.attrib.get('text', '') or node.attrib.get('content-desc', '')).strip()


def nodes(root, rid_=None, desc=None, text=None, contains=None, prefix=None, clazz=None):
    out = []
    for n in root.iter():
        a = n.attrib
        if a.get('package') != PACKAGE:
            continue
        if rid_ is not None and a.get('resource-id', '') != rid_:
            continue
        if desc is not None and a.get('content-desc', '') != desc:
            continue
        if text is not None and a.get('text', '') != text:
            continue
        if clazz is not None and a.get('class', '') != clazz:
            continue
        hay = f"{a.get('text', '')} {a.get('content-desc', '')}"
        if contains is not None and contains not in hay:
            continue
        if prefix is not None and not (a.get('content-desc', '').startswith(prefix) or a.get('text', '').startswith(prefix)):
            continue
        out.append(n)
    return out


def dump(retries=5):
    """A UI dump that survives transient uiautomator failures; a verified app/system ANR stays fatal (RU5 helper)."""
    last = None
    for _ in range(retries):
        try:
            root, parent, _ = dump_tree()
            if dismiss_known_system_anr(root, parent):
                continue
            note_nav(root)
            return root, parent
        except Exception as exc:                              # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            last = exc
            time.sleep(1.0)
    raise RuntimeError(f'UI dump failed: {type(last).__name__}: {str(last)[:160]}')


def poll(pred, timeout=30, interval=1.0, what='condition'):
    end = time.time() + timeout
    last_exc = None
    while time.time() < end:
        try:
            root, parent, _ = dump_tree()
            if dismiss_known_system_anr(root, parent):
                continue
            note_nav(root)
            value = pred(root, parent)
            if value:
                return value, root, parent
        except Exception as exc:                              # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            last_exc = exc
        time.sleep(interval)
    raise RuntimeError(f'timeout ({timeout}s) waiting for {what}' + (f' (last error: {type(last_exc).__name__})' if last_exc else ''))


def press_at(x, y, hold_ms=120):
    adb('shell', 'input', 'touchscreen', 'swipe', str(x), str(y), str(x), str(y), str(hold_ms))
    time.sleep(0.8)


def center_of(node, parent):
    """Middle of the part of a control that is really on screen and above the system navigation bar."""
    target = clickable_for(node, parent)
    target = node if target is None else target
    x1, y1, x2, y2 = parse_bounds(target.attrib.get('bounds'))
    y2 = min(y2, safe_bottom())
    if y2 - y1 < 10:
        raise RuntimeError(f'control not visible enough to press: {label_of(target)!r} bounds={target.attrib.get("bounds")}')
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap_visible(node, parent, hold_ms=120):
    x, y = center_of(node, parent)
    press_at(x, y, hold_ms)


def swipe(x1, y1, x2, y2, ms=600):
    adb('shell', 'input', 'touchscreen', 'swipe', str(x1), str(y1), str(x2), str(y2), str(ms))
    time.sleep(1.0)


def scroll_list(direction='down', fraction=0.5):
    w, h = screen_size()
    span = int(h * fraction)
    x = int(w * 0.9)              # away from the centred "Mapa" pill
    if direction == 'down':      # finger moves up: content moves up, later items appear
        start = int(h * 0.80)
        swipe(x, start, x, start - span)
    else:
        start = int(h * 0.30)
        swipe(x, start, x, start + span)


def open_deep_link(url):
    r = adb('shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW', '-d', url, '-p', PACKAGE, check=False)
    note('deep_link', url=url, rc=r.returncode, out=(r.stdout or '')[-160:])
    time.sleep(3)


def back():
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
    time.sleep(2.5)


def mem_kb():
    out = adb('shell', 'dumpsys', 'meminfo', PACKAGE, check=False).stdout
    m = re.search(r'TOTAL PSS:\s+(\d+)', out) or re.search(r'^\s*TOTAL\s+(\d+)', out, re.M)
    return int(m.group(1)) if m else -1


def app_pid():
    out = adb('shell', 'pidof', PACKAGE, check=False).stdout.strip()
    return out.split()[0] if out else ''


def dismiss_permission_dialogs():
    """System permission prompts are declined (privacy-preserving default); the journey never grants a permission."""
    for _ in range(3):
        root, parent = dump()
        deny = [n for n in root.iter() if n.attrib.get('resource-id') in (
            'com.android.permissioncontroller:id/permission_deny_button',
            'com.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button')]
        if not deny:
            return
        note('PERMISSION_DIALOG_DECLINED')
        tap_node(deny[0], parent)


# ------------------------------------------------------------------------------------------------ UI facts
def ui_inventory(root, limit=160):
    """Compact, bounded description of what is on screen: id / label / clickable / bounds."""
    rows = []
    for n in root.iter():
        if n.attrib.get('package') != PACKAGE:
            continue
        r, t, d = rid(n), n.attrib.get('text', ''), n.attrib.get('content-desc', '')
        if not (r or t or d):
            continue
        rows.append({'id': r, 'text': t[:90], 'desc': d[:120], 'click': n.attrib.get('clickable') == 'true',
                     'sel': n.attrib.get('selected') == 'true', 'bounds': n.attrib.get('bounds', '')})
        if len(rows) >= limit:
            break
    return rows


def snapshot(name):
    """PNG + XML (RU5 shot(), retried) and a compact JSON inventory next to them."""
    for attempt in range(3):
        try:
            shot(name)
            break
        except Exception as exc:                              # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            if attempt == 2:
                note('SNAPSHOT_FAIL', name=name, error=str(exc)[:160])
            time.sleep(1.0)
    root, _ = dump()
    (ARTIFACT_DIR / f'{name}.inventory.json').write_text(json.dumps(ui_inventory(root), ensure_ascii=False, indent=1), encoding='utf-8')
    return root


def cards(root):
    out = []
    for n in root.iter():
        if n.attrib.get('package') != PACKAGE:
            continue
        m = ITEM_DESC.match(n.attrib.get('content-desc', '') or '')
        if not m:
            continue
        out.append({'title': m.group(1), 'index': int(m.group(2)), 'kind': m.group(3),
                    'bounds': parse_bounds(n.attrib.get('bounds')), 'node': n})
    return sorted(out, key=lambda c: c['bounds'][1])


def markers(root):
    out = []
    for n in root.iter():
        if n.attrib.get('package') != PACKAGE:
            continue
        d = n.attrib.get('content-desc', '') or ''
        m = MARKER_DESC.match(d)
        if not m:
            continue
        kind = 'TASK' if d.startswith('Jedan') else ('PLACE' if m.group(2) == 'na ovom mestu' else 'CLUSTER')
        out.append({'kind': kind, 'count': 1 if kind == 'TASK' else int(m.group(1)), 'desc': d,
                    'bounds': parse_bounds(n.attrib.get('bounds')), 'node': n})
    return out


def marker_summary(ms):
    return [{'kind': m['kind'], 'count': m['count'], 'bounds': list(m['bounds'])} for m in ms]


def count_nodes(root):
    return nodes(root, rid_='list-count') + nodes(root, rid_='list-count-words')


def count_value(root):
    for n in count_nodes(root):
        label = n.attrib.get('content-desc') or n.attrib.get('text') or ''
        m = re.match(r'\s*(\d+)', label)
        if m:
            return int(m.group(1)), label
        for child in n.iter():
            t = child.attrib.get('text', '')
            m = re.match(r'\s*(\d+)', t)
            if m:
                return int(m.group(1)), t
    return None, ''


def sheet_state(root):
    words = bool(nodes(root, rid_='list-count-words'))
    button = bool(nodes(root, rid_='list-count'))
    return {'full': words and not button, 'button': button, 'mapPill': bool(nodes(root, desc='Mapa'))}


def peek_task_title(root):
    for n in nodes(root, prefix='Otvori zadatak: '):
        return (n.attrib.get('content-desc') or '')[len('Otvori zadatak: '):]
    return None


def selected(node):
    return node is not None and (node.attrib.get('selected') == 'true' or node.attrib.get('checked') == 'true')


# ------------------------------------------------------------------------------------------------ server-side evidence
def _db_container():
    names = subprocess.run(['docker', 'ps', '--format', '{{.Names}}'], capture_output=True, text=True, timeout=20).stdout.split()
    return next((n for n in names if n.startswith('supabase_db_')), None)


def harvest():
    """Every rpc_discovery_v1 request (the parsed p_request body) the disposable database logged since the journey began.

    The statement log (log_statement=all) carries the bound JSON of each PostgREST call in a `parameters: $1 = '...'`
    detail line; only bodies with a P6 mode are kept, in log order."""
    name = _db_container()
    if not name:
        return []
    r = subprocess.run(['docker', 'logs', '--since', START_ISO, name], stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                       text=True, errors='replace', timeout=120)
    decoder = json.JSONDecoder()
    out = []
    for line in (r.stdout or '').splitlines():
        at = line.find("parameters: $1 = '")
        if at < 0:
            continue
        start = line.find('{', at)
        if start < 0:
            continue
        try:
            body, _ = decoder.raw_decode(line[start:].replace("''", "'"))
        except ValueError:
            continue
        req = body.get('p_request') if isinstance(body, dict) else None
        if isinstance(req, dict) and req.get('mode') in ('PAGE', 'MAP', 'PLACES', 'EXACT_PUBLIC'):
            out.append(req)
    return out


def mark():
    return len(harvest())


def since(m, mode=None):
    return [r for r in harvest()[m:] if mode is None or r.get('mode') == mode]


def brief(req):
    f = req.get('filter') or {}
    scope = req.get('scope')
    return {'mode': req.get('mode'), 'scope': scope.get('kind') if isinstance(scope, dict) else scope,
            'after': bool(req.get('after')), 'limit': req.get('limit'), 'where': f.get('where'), 'text': f.get('text'),
            'place': f.get('place'), 'keys': sorted(req.keys())[:14]}


def wait_requests(fn, timeout=30, what='requests'):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v:
            return v
        time.sleep(1.0)
    raise RuntimeError(f'timeout ({timeout}s) waiting for {what}')


def _admin_psql(sql):
    """The local stack's `postgres` role is not a superuser; supabase_admin is (same password on the disposable stack)."""
    url = DB_URL.replace('//postgres:', '//supabase_admin:', 1)
    r = subprocess.run(['psql', url, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip()[:200])
    return r.stdout.strip()


def db_function_calls():
    try:
        return int(_admin_psql("select coalesce(sum(calls),0)::bigint from pg_stat_user_functions where funcname='rpc_discovery_v1'") or 0)
    except Exception:                                         # noqa: BLE001
        return -1


# ------------------------------------------------------------------------------------------------ step machinery
def step(name, fn):
    started = time.time()
    checks_before = len(REPORT['checks'])
    try:
        fn()
        ok = all(c['ok'] for c in REPORT['checks'][checks_before:])
        REPORT['steps'].append({'name': name, 'ok': True, 'checksOk': ok, 's': round(time.time() - started, 1)})
        note('STEP_OK', name=name, checksOk=ok)
    except Exception as exc:                                 # noqa: BLE001 - recorded in both modes
        if getattr(exc, 'native_surface_fatal', False):
            REPORT['steps'].append({'name': name, 'ok': False, 'fatal': True, 'error': str(exc)[:600]})
            raise
        REPORT['steps'].append({'name': name, 'ok': False, 'error': f'{type(exc).__name__}: {str(exc)[:600]}'})
        note('STEP_FAIL', name=name, error=f'{type(exc).__name__}: {str(exc)[:300]}')
        try:
            snapshot(f'FAIL_{name}')
        except Exception:                                    # noqa: BLE001
            pass


def check(name, ok, **facts):
    REPORT['checks'].append({'name': name, 'ok': bool(ok), **facts})
    note('CHECK_PASS' if ok else 'CHECK_FAIL', name=name, **facts)
    return bool(ok)


def ensure_list():
    """Bring the app back to the P6 Discovery screen whatever the previous step left behind (never signs in again)."""
    for _ in range(4):
        root, _p = dump()
        if count_nodes(root):
            return root
        back()
    open_deep_link(LIST_URL)
    _, root, _p = poll(lambda r, p: count_nodes(r), 45, what='Discovery list after recovery')
    return root


def ensure_full():
    root = ensure_list()
    if sheet_state(root)['full']:
        return root
    root, parent = dump()
    target = nodes(root, rid_='list-count')
    if not target:
        raise RuntimeError('list-count control not found')
    tap_visible(target[0], parent)
    _, root, _p = poll(lambda r, p: sheet_state(r)['full'], 20, what='list at full height')
    return root


def ensure_peek():
    root = ensure_list()
    st = sheet_state(root)
    if st['mapPill']:
        root, parent = dump()
        tap_visible(nodes(root, desc='Mapa')[0], parent)
        _, root, _p = poll(lambda r, p: not sheet_state(r)['mapPill'] and sheet_state(r)['button'], 20, what='list lowered to its top line')
    return root


# ------------------------------------------------------------------------------------------------ steps
def press_entry_pill():
    """Open the login sheet with a real press on the visible part of "Prijavi se"."""
    last = None
    for attempt in range(1, 5):
        found, root, parent = poll(lambda r, p: nodes(r, desc='Prijavi se'), 60 if attempt == 1 else 20, what='"Prijavi se" entry control')
        tap_visible(found[0], parent, hold_ms=160)
        try:
            wait_nodes(timeout=10, minimum=2, save_timeout=False, clazz='android.widget.EditText')
            note('CHECKPOINT', name='AUTH_SHEET_OPEN', attempt=attempt)
            return
        except RuntimeError as exc:
            if getattr(exc, 'native_surface_fatal', False):
                raise
            last = exc
            dump_tree(f'AUTH_entry_attempt_{attempt}_after')
            time.sleep(1.5)
    raise RuntimeError(f'Login sheet did not open after real UI presses: {str(last)[:200]}')


def s_login():
    launch_clean()                   # force-stop, clear the disposable app data, start, wait for "Prijavi se", signed-out asserts
    time.sleep(2)
    dump()
    press_entry_pill()
    root, parent = dump()
    fields = sorted(nodes(root, clazz='android.widget.EditText'), key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    if len(fields) != 2 or not nodes(root, text='Email') or not nodes(root, text='Lozinka'):
        raise RuntimeError(f'sign-in sheet is not the expected email/password form: fields={len(fields)}')
    snapshot('P6_00_login_sheet')
    edit_text(0, VIEWER_EMAIL)
    edit_text(1, PASSWORD)
    hide_keyboard()
    # The sheet's submit is the TOPMOST "Prijavi se" (the entry's own pill stays in the tree behind the sheet).
    found, root, parent = poll(lambda r, p: sorted([n for n in nodes(r, desc='Prijavi se') if n.attrib.get('clickable') == 'true'],
                                                   key=lambda n: parse_bounds(n.attrib.get('bounds'))[1]), 30, what='sign-in submit')
    tap_visible(found[0], parent)
    poll(lambda r, p: not nodes(r, rid_='entry-intents') and not nodes(r, rid_='auth-reference-sheet'), 90, what='signed-in surface (entry gone)')
    time.sleep(3)
    dismiss_permission_dialogs()
    snapshot('P6_01_after_login')


def s_ordinary_route():
    """The ordinary Zadaci tab must stay on the legacy reader: no rpc_discovery_v1 call may come from it."""
    m = mark()
    root, parent = dump()
    tabs = sorted(nodes(root, desc='Zadaci'), key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    if tabs:
        tap_visible(tabs[-1], parent)
    else:
        note('TAB_BAR_LABEL_NOT_FOUND', inventory=[i['desc'] or i['text'] for i in ui_inventory(root) if i['click']][:14])
        open_deep_link('uskociapp://zadaci')
    poll(lambda r, p: count_nodes(r) or nodes(r, contains='Nema zadataka') or nodes(r, contains='nisu učitani'), 60, what='ordinary Zadaci screen')
    time.sleep(4)
    root = snapshot('P6_01b_ordinary_route')
    calls = since(m)
    check('ORDINARY_ROUTE_DOES_NOT_CALL_P6_READER', not calls, calls=[brief(c) for c in calls[:4]], legacyCount=count_value(root)[0])


def s_route():
    m = mark()
    open_deep_link(LIST_URL)
    wait_requests(lambda: since(m, 'PAGE'), 45, 'the P6 PAGE request from the proof route')
    _, root, _p = poll(lambda r, p: count_value(r)[0] == TOTAL, 45, what=f'count {TOTAL} from the P6 reader')
    time.sleep(3)
    root = snapshot('P6_02_route_initial')
    value, label = count_value(root)
    calls = since(m)
    REPORT['initialCount'] = [value, label]
    REPORT['initialRequests'] = [brief(c) for c in calls[:8]]
    check('P6_PAGE_CALLED_BY_PROOF_ROUTE', any(c.get('mode') == 'PAGE' and not c.get('after') for c in calls), calls=len(calls))
    check('COUNT_MATCHES_SERVER_TOTAL', value == TOTAL, ui=value, expected=TOTAL, spoken=label)
    without = FIXTURE.get('pageProbeCounts', {}).get('withoutPoint')
    if without is not None:
        nums = [int(x) for x in re.findall(r'\d+', label)]
        check('WITHOUT_POINT_COUNT_MATCHES_SERVER', without in nums[1:], ui=nums, expected=without)
    st = sheet_state(root)
    REPORT['initialSheet'] = st
    ms = markers(root)
    REPORT['initialMarkers'] = marker_summary(ms)
    check('MAP_MARKERS_VISIBLE_AT_PEEK', bool(ms) or st['full'], markers=len(ms), sheet=st)
    if not st['full']:
        check('P6_MAP_READER_CALLED', any(c.get('mode') == 'MAP' for c in calls), modes=sorted({c.get('mode') for c in calls}))


def s_open_full():
    root = ensure_full()
    root = snapshot('P6_03_full_list')
    cs = cards(root)
    check('FULL_LIST_SHOWS_CARDS', len(cs) >= 3, visible=len(cs), first=[c['title'] for c in cs[:3]])
    check('FULL_STARTS_WITH_NEWEST_TASKS', bool(cs) and cs[0]['index'] <= 3, first=[c['title'] for c in cs[:3]])
    check('FULL_KEEPS_EXACT_COUNT', count_value(root)[0] == TOTAL, ui=count_value(root)[0], expected=TOTAL)
    check('MAP_PILL_OFFERED_AT_FULL', sheet_state(root)['mapPill'])


def s_paging():
    ensure_full()
    m = mark()
    seen, order, idle, dupes, swipes = set(), [], 0, [], 0
    for swipes in range(1, 61):
        root, _p = dump()
        titles = [c['title'] for c in cards(root)]
        if len(titles) != len(set(titles)):
            dupes.append(titles)
        fresh = [t for t in titles if t not in seen]
        for t in fresh:
            seen.add(t)
            order.append(t)
        idle = 0 if fresh else idle + 1
        if len(seen) >= TOTAL or idle >= 5:
            break
        if idle:
            time.sleep(2.0)
        scroll_list('down', 0.5)
    reqs = since(m, 'PAGE')
    cursor = [r for r in reqs if r.get('after')]
    first_page = next((r for r in harvest() if r.get('mode') == 'PAGE'), None)
    limit = (first_page or {}).get('limit')
    pages = math.ceil(TOTAL / limit) if limit else None
    root, _p = dump()
    REPORT['paging'] = {'seen': len(seen), 'swipes': swipes, 'limit': limit, 'cursorRequests': len(cursor),
                        'requests': [brief(r) for r in reqs[:10]], 'order': order[:6] + ['…'] + order[-4:]}
    check('PAGING_REACHED_EVERY_TASK', len(seen) == TOTAL, seen=len(seen), expected=TOTAL)
    check('NO_DUPLICATE_CARDS_IN_ANY_VIEW', not dupes, duplicates=dupes[:2])
    check('NEXT_PAGE_REQUESTED_WITH_CURSOR', (pages is None or pages <= 1) or bool(cursor), pages=pages, cursorRequests=len(cursor))
    if pages:
        check('NO_RUNAWAY_PAGE_REQUESTS', len(cursor) <= max(pages, 1) * 2, cursorRequests=len(cursor), pages=pages)
    check('COUNT_STABLE_AFTER_PAGING', count_value(root)[0] == TOTAL, ui=count_value(root)[0], expected=TOTAL)
    snapshot('P6_04_paged_to_end')


def s_detail_and_back():
    ensure_full()
    root, parent = dump()
    cs = cards(root)
    if not cs:
        raise RuntimeError('no card to open')
    pick = cs[min(1, len(cs) - 1)]
    m = mark()
    REPORT['opened'] = {'title': pick['title'], 'y1': pick['bounds'][1]}
    tap_visible(pick['node'], parent)
    _, root, _p = poll(lambda r, p: not count_nodes(r) and any(pick['title'] in label_of(n) for n in r.iter() if n.attrib.get('package') == PACKAGE), 30, what='task detail')
    snapshot('P6_05_detail')
    check('DETAIL_SHOWS_TITLE', True, title=pick['title'])
    back()
    root = snapshot('P6_06_after_back')
    cs = cards(root)
    same = next((c for c in cs if c['title'] == pick['title']), None)
    check('BACK_RESTORES_SAME_TASK_VISIBLE', same is not None, wanted=pick['title'], visible=[c['title'] for c in cs[:6]])
    if same is not None:
        drift = abs(same['bounds'][1] - REPORT['opened']['y1'])
        check('BACK_RESTORES_SCROLL_POSITION', drift <= 60, before_y=REPORT['opened']['y1'], after_y=same['bounds'][1], drift=drift)
    check('BACK_KEEPS_FULL_LIST', sheet_state(root)['full'], sheet=sheet_state(root))
    check('BACK_KEEPS_EXACT_COUNT', count_value(root)[0] == TOTAL, ui=count_value(root)[0])
    REPORT['backRequests'] = [brief(r) for r in since(m)[:6]]


def s_repeat_cycles(n=10):
    ensure_full()
    REPORT['mem'] = [{'tag': 'before_cycles', 'kb': mem_kb(), 'pid': app_pid()}]
    m = mark()
    calls_before = db_function_calls()
    for i in range(1, n + 1):
        root, parent = dump()
        cs = cards(root)
        if not cs:
            raise RuntimeError('list empty before cycle')
        pick = cs[min(1, len(cs) - 1)]
        tap_visible(pick['node'], parent)
        time.sleep(2.5)
        back()
        root, _p = dump()
        check(f'CYCLE_{i:02d}_LIST_RESTORED', any(c['title'] == pick['title'] for c in cards(root)) and sheet_state(root)['full'], title=pick['title'])
        if i in (1, n // 2, n):
            REPORT['mem'].append({'tag': f'cycle_{i}', 'kb': mem_kb(), 'pid': app_pid()})
    snapshot('P6_07_after_cycles')
    reqs = since(m)
    REPORT['cycleRequests'] = len(reqs)
    calls_after = db_function_calls()
    check('NO_RUNAWAY_READER_CALLS', len(reqs) <= n * 2, requests=len(reqs), cycles=n,
          dbCallsDelta=(calls_after - calls_before) if calls_before >= 0 and calls_after >= 0 else None)
    pids = {x['pid'] for x in REPORT['mem'] if x['pid']}
    check('APP_PROCESS_SURVIVED_CYCLES', len(pids) == 1, pids=sorted(pids))
    kb = [x['kb'] for x in REPORT['mem'] if x['kb'] > 0]
    if len(kb) >= 2:
        check('NO_OBVIOUS_MEMORY_GROWTH', kb[-1] <= kb[0] * 1.35 + 20000, first_kb=kb[0], last_kb=kb[-1])


def wait_count(expected, timeout=25):
    if expected is None:
        raise RuntimeError('expected count missing from fixture.json')
    return poll(lambda r, p: count_value(r)[0] == expected, timeout, what=f'count {expected}')


def chip(root, label):
    return next(iter(nodes(root, desc=label)), None)


def s_filters():
    ensure_peek()
    root, parent = dump()
    remote, onsite = chip(root, 'Na daljinu'), chip(root, 'Na licu mesta')
    if remote is None or onsite is None:
        raise RuntimeError(f'quick filter chips not visible: clickable={[n["desc"] for n in ui_inventory(root) if n["click"]][:12]}')
    exp_remote, exp_onsite = EXPECTED.get('remote'), EXPECTED.get('onsite')
    m = mark()
    tap_visible(remote, parent)
    _, root, parent = wait_count(exp_remote)
    reqs = since(m, 'PAGE')
    check('FILTER_REMOTE_COUNT_EQUALS_SERVER', count_value(root)[0] == exp_remote, ui=count_value(root)[0], expected=exp_remote)
    check('FILTER_REMOTE_SENT_TO_SERVER', any((r.get('filter') or {}).get('where') == 'remote' for r in reqs), requests=[brief(r) for r in reqs[:4]])
    snapshot('P6_10_filter_remote')
    root, parent = dump()
    tap_visible(chip(root, 'Na daljinu'), parent)
    _, root, parent = wait_count(TOTAL)
    check('FILTER_CLEARS_TO_ALL', count_value(root)[0] == TOTAL, ui=count_value(root)[0])
    # Stale fencing: two intents in quick succession. The screen must end on the LAST one, whatever order the answers
    # arrive in (the deterministic staleness injection is covered by the coordinator's own tests; this is the race probe).
    p1, p2 = center_of(chip(root, 'Na daljinu'), parent), center_of(chip(root, 'Na licu mesta'), parent)
    m2 = mark()
    adb('shell', f'input tap {p1[0]} {p1[1]} ; input tap {p2[0]} {p2[1]}')
    time.sleep(1.0)
    _, root, parent = wait_count(exp_onsite, 30)
    time.sleep(3)
    root, parent = dump()
    reqs = since(m2, 'PAGE')
    wheres = [(r.get('filter') or {}).get('where') for r in reqs]
    check('RACE_ENDS_ON_LAST_INTENT', count_value(root)[0] == exp_onsite, ui=count_value(root)[0], expected=exp_onsite, wheres=wheres)
    check('RACE_LAST_REQUEST_IS_LAST_INTENT', bool(wheres) and wheres[-1] == 'onsite', wheres=wheres)
    onsite_now, remote_now = chip(root, 'Na licu mesta'), chip(root, 'Na daljinu')
    check('RACE_SELECTED_CHIP_IS_LAST_INTENT', selected(onsite_now) and not selected(remote_now),
          onsite=selected(onsite_now), remote=selected(remote_now))
    snapshot('P6_11_filter_race')
    tap_visible(onsite_now, parent)
    _, root, _p = wait_count(TOTAL)
    check('FILTERS_CLEARED_AFTER_RACE', count_value(root)[0] == TOTAL, ui=count_value(root)[0])


def map_zoom(label, times=1):
    for _ in range(times):
        root, parent = dump()
        control = nodes(root, desc=label)
        if not control:
            raise RuntimeError(f'{label!r} control not visible')
        tap_visible(control[0], parent)
        time.sleep(3)


def zoom_to_marker(pred, what, prefer='largest', max_taps=6):
    """Tap clusters (largest or smallest first) until a marker satisfying `pred` is on screen."""
    _, root, parent = poll(lambda r, p: markers(r), 40, what='map markers')
    for _ in range(max_taps + 1):
        ms = markers(root)
        hit = next((mk for mk in ms if pred(mk)), None)
        if hit is not None:
            return hit, root, parent
        clusters = [mk for mk in ms if mk['kind'] == 'CLUSTER' and mk['count'] >= 2]
        if not clusters:
            break
        clusters.sort(key=lambda mk: mk['count'], reverse=(prefer == 'largest'))
        tap_visible(clusters[0]['node'], parent)
        time.sleep(5)
        root, parent = dump()
    raise RuntimeError(f'{what} not reachable; markers={marker_summary(markers(root))}')


def s_map_place():
    ensure_peek()
    map_zoom('Umanji mapu', 2)
    dense_expected = EXPECTED.get('dense', 30)
    dense, root, parent = zoom_to_marker(lambda mk: mk['kind'] == 'PLACE' and mk['count'] >= 10, 'dense place marker', 'largest')
    REPORT['denseMarker'] = {'count': dense['count'], 'bounds': list(dense['bounds'])}
    check('DENSE_PLACE_MARKER_COUNT_EQUALS_SERVER', dense['count'] == dense_expected, marker=dense['count'], expected=dense_expected)
    m = mark()
    tap_visible(dense['node'], parent)
    _, root, parent = poll(lambda r, p: nodes(r, contains='Pogledaj zadatak') and nodes(r, contains='Prikaži sve u listi'), 25, what='place Peek')
    snapshot('P6_12_place_peek')
    rows = nodes(root, prefix='Pogledaj zadatak ')
    check('PLACE_PEEK_SHOWS_THREE_ROWS', len(rows) == 3, rows=len(rows))
    reqs = since(m)
    REPORT['placePeekRequests'] = [brief(r) for r in reqs[:6]]
    tap_visible(nodes(root, contains='Prikaži sve u listi')[0], parent)
    _, root, parent = wait_count(dense['count'], 25)
    reqs = since(m, 'PAGE')
    check('POINT_MEMBERS_LIST_COUNT_MATCHES_MARKER', count_value(root)[0] == dense['count'], ui=count_value(root)[0], marker=dense['count'])
    check('POINT_SCOPE_SENT_TO_SERVER', any(brief(r)['scope'] not in (None, 'ALL') for r in reqs), requests=[brief(r) for r in reqs[:5]])
    snapshot('P6_13_point_members')
    clear = nodes(root, desc='Prikaži sve zadatke') or nodes(root, rid_='clear-where')
    if not clear:
        raise RuntimeError('clear-where control not visible')
    tap_visible(clear[0], parent)
    _, root, _p = wait_count(TOTAL, 25)
    check('POINT_SCOPE_CLEARS_TO_ALL', count_value(root)[0] == TOTAL, ui=count_value(root)[0])


def s_map_cluster_and_task():
    ensure_peek()
    map_zoom('Umanji mapu', 2)
    _, root, parent = poll(lambda r, p: markers(r), 40, what='map markers')
    before = marker_summary(markers(root))
    REPORT['clusterStart'] = before
    clusters = [mk for mk in markers(root) if mk['kind'] == 'CLUSTER' and mk['count'] >= 2]
    if clusters:
        cluster = min(clusters, key=lambda mk: mk['count'])
        m = mark()
        tap_visible(cluster['node'], parent)
        time.sleep(6)
        root, parent = dump()
        after = marker_summary(markers(root))
        check('CLUSTER_SELECTION_REFINES_MAP', bool(since(m, 'MAP')) and after != before, mapRequests=len(since(m, 'MAP')), before=before, after=after)
        snapshot('P6_14_cluster_zoomed')
    task, root, parent = zoom_to_marker(lambda mk: mk['kind'] == 'TASK', 'single-task marker', 'smallest')
    positions = sorted(mk['bounds'] for mk in markers(root))
    m = mark()
    tap_visible(task['node'], parent)
    _, root, parent = poll(lambda r, p: peek_task_title(r), 25, what='task Peek')
    title = peek_task_title(root)
    reqs = since(m)
    REPORT['taskMarkerRequests'] = [brief(r) for r in reqs[:6]]
    check('TASK_MARKER_OPENS_PEEK', bool(title), title=title, modes=sorted({r.get('mode') for r in reqs}))
    snapshot('P6_15_task_peek')
    tap_visible(nodes(root, prefix='Otvori zadatak: ')[0], parent)
    _, root, _p = poll(lambda r, p: not count_nodes(r) and any((title or '@@') in label_of(n) for n in r.iter() if n.attrib.get('package') == PACKAGE), 30, what='task detail from Peek')
    snapshot('P6_16_detail_from_peek')
    back()
    root = snapshot('P6_17_after_back_peek')
    check('BACK_RESTORES_PEEK_SAME_TASK', peek_task_title(root) == title, wanted=title, got=peek_task_title(root))
    now = sorted(mk['bounds'] for mk in markers(root))
    same_map = len(now) == len(positions) and all(abs(a[0] - b[0]) <= 8 and abs(a[1] - b[1]) <= 8 for a, b in zip(now, positions))
    check('BACK_RESTORES_MAP_VIEWPORT_AND_PINS', same_map, before=len(positions), after=len(now))
    close = nodes(root, desc='Zatvori pregled zadatka')
    if close:
        _r, parent2 = dump()
        tap_visible(close[0], parent2)
        time.sleep(1.5)


def s_search_places():
    ensure_peek()
    root, parent = dump()
    bar = nodes(root, desc='Pretraži zadatke')
    if not bar:
        raise RuntimeError('search bar not found')
    m = mark()
    tap_visible(bar[0], parent)
    poll(lambda r, p: nodes(r, clazz='android.widget.EditText'), 20, what='search field')
    time.sleep(2)
    opened = since(m, 'PLACES')
    snapshot('P6_20_search_open')
    check('SEARCH_OPEN_LOADS_PLACE_FACETS', bool(opened), places=len(opened))
    edit_text(0, 'Liman')
    time.sleep(4)
    typed = since(m, 'PLACES')
    check('SEARCH_TEXT_SENT_TO_SERVER', any('Liman' in json.dumps(r, ensure_ascii=False) for r in typed), requests=[brief(r) for r in typed[-3:]])
    root, parent = dump()
    snapshot('P6_21_search_typed')
    dense_expected = EXPECTED.get('dense', 30)

    def suggestions(r):
        return [n for n in r.iter() if n.attrib.get('package') == PACKAGE and re.match(r'^Liman\b.*zadat', n.attrib.get('content-desc', '') or '')]

    sug = suggestions(root)
    check('SEARCH_SUGGESTS_DENSE_PLACE_WITH_COUNT', bool(sug), suggestions=[n.attrib.get('content-desc') for n in nodes(root, prefix='Liman')][:3])
    if not sug:
        raise RuntimeError('no place suggestion for Liman')
    check('SUGGESTION_COUNT_EQUALS_SERVER', str(dense_expected) in (sug[0].attrib.get('content-desc') or ''), suggestion=sug[0].attrib.get('content-desc'), expected=dense_expected)
    hide_keyboard()
    root, parent = dump()
    sug = suggestions(root)
    tap_visible(sug[0], parent)
    time.sleep(2)
    root, parent = dump()
    show = sorted([n for n in root.iter() if n.attrib.get('package') == PACKAGE and (n.attrib.get('content-desc', '') or n.attrib.get('text', '')).startswith('Prikaži')
                   and n.attrib.get('clickable') == 'true'], key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    if not show:
        raise RuntimeError('search "Prikaži" action not found')
    snapshot('P6_22_search_place_chosen')
    tap_visible(show[-1], parent)
    _, root, parent = wait_count(dense_expected, 30)
    check('SEARCH_PLACE_RESULT_COUNT_EQUALS_SERVER', count_value(root)[0] == dense_expected, ui=count_value(root)[0], expected=dense_expected)
    snapshot('P6_23_search_applied')
    clear = nodes(root, desc='Prikaži sve zadatke') or nodes(root, rid_='clear-where')
    if clear:
        tap_visible(clear[0], parent)
        wait_count(TOTAL, 25)


def s_final():
    root, _p = dump()
    snapshot('P6_99_final')
    REPORT['finalMemKb'] = mem_kb()
    REPORT['finalPid'] = app_pid()
    check('APP_STILL_RUNNING_AT_END', bool(REPORT['finalPid']), pid=REPORT['finalPid'])
    reqs = harvest()
    modes = {}
    for r in reqs:
        modes[r.get('mode')] = modes.get(r.get('mode'), 0) + 1
    REPORT['requestModes'] = modes
    REPORT['requestLog'] = [brief(r) for r in reqs[:150]]
    check('SERVER_REQUEST_LOG_AVAILABLE', bool(reqs), total=len(reqs), modes=modes)


def main():
    note('START', mode=MODE, total=TOTAL, expected=EXPECTED)
    for name, fn in (('login', s_login), ('ordinary_route', s_ordinary_route), ('route', s_route), ('open_full', s_open_full),
                     ('paging', s_paging), ('detail_back', s_detail_and_back), ('cycles', s_repeat_cycles),
                     ('filters', s_filters), ('map_place', s_map_place), ('map_cluster_task', s_map_cluster_and_task),
                     ('search_places', s_search_places), ('final', s_final)):
        step(name, fn)
        if name == 'login' and not REPORT['steps'][-1]['ok']:
            break                                  # nothing else can run signed out
        try:
            ensure_list()
        except Exception as exc:                   # noqa: BLE001
            if getattr(exc, 'native_surface_fatal', False):
                raise
            note('RECOVERY_FAIL', after=name, error=str(exc)[:200])
    REPORT['result'] = 'PASS' if REPORT['steps'] and all(s['ok'] and s.get('checksOk', True) for s in REPORT['steps']) and all(c['ok'] for c in REPORT['checks']) else 'FAIL'
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
