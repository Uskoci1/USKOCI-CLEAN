#!/usr/bin/env python3
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = os.environ.get('RU5_DEVICE_PACKAGE', 'rs.uskoci.ru5proof')
MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
WORKER_EMAIL = os.environ['RU5_DEVICE_WORKER_EMAIL']
REQUESTER_EMAIL = os.environ['RU5_DEVICE_REQUESTER_EMAIL']
PASSWORD = os.environ['RU5_DEVICE_PASSWORD']
NEED_TITLE = os.environ['RU5_DEVICE_NEED_TITLE']
DB_URL = os.environ['RU5_DEVICE_DB_URL']
NEED_ID = os.environ['RU5_DEVICE_NEED_ID']
WORKER_USER_ID = os.environ['RU5_DEVICE_WORKER_USER_ID']
REQUESTER_USER_ID = os.environ['RU5_DEVICE_REQUESTER_USER_ID']
ARTIFACT_DIR = Path(os.environ.get('RU5_DEVICE_ARTIFACT_DIR', 'artifacts/ru5-device-ui'))
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def run(*args, check=True, text=True, capture_output=True):
    return subprocess.run(args, check=check, text=text, capture_output=capture_output)


def adb(*args, check=True):
    return run('adb', *args, check=check)


def psql(sql):
    result = run('psql', DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql)
    return result.stdout.strip()


def dump_tree(save_name=None):
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    xml_text = adb('shell', 'cat', '/sdcard/window.xml').stdout
    if save_name:
        (ARTIFACT_DIR / f'{save_name}.xml').write_text(xml_text, encoding='utf-8')
    root = ET.fromstring(xml_text)
    parent = {child: p for p in root.iter() for child in p}
    return root, parent, xml_text


def parse_bounds(raw):
    m = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', raw or '')
    if not m:
        raise RuntimeError(f'Invalid bounds: {raw!r}')
    x1, y1, x2, y2 = map(int, m.groups())
    return x1, y1, x2, y2


def clickable_for(node, parent):
    cur = node
    while cur is not None:
        if cur.attrib.get('clickable') == 'true' and cur.attrib.get('enabled', 'true') == 'true':
            return cur
        cur = parent.get(cur)
    return node


def matches(node, *, text=None, desc=None, contains=None, clazz=None):
    if text is not None and node.attrib.get('text') != text:
        return False
    if desc is not None and node.attrib.get('content-desc') != desc:
        return False
    if contains is not None:
        hay = f"{node.attrib.get('text', '')} {node.attrib.get('content-desc', '')}"
        if contains not in hay:
            return False
    if clazz is not None and node.attrib.get('class') != clazz:
        return False
    return True


def tap_node(node, parent):
    target = clickable_for(node, parent)
    x1, y1, x2, y2 = parse_bounds(target.attrib.get('bounds'))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
    time.sleep(0.8)


def dismiss_known_system_anr(root, parent):
    """Dismiss only launcher/System UI starvation dialogs, never an USKOČI ANR."""
    labels = [
        f"{n.attrib.get('text', '')} {n.attrib.get('content-desc', '')}".strip()
        for n in root.iter()
        if n.attrib.get('text') or n.attrib.get('content-desc')
    ]
    system_anr = any(
        ("Quickstep isn't responding" in label)
        or ('Quickstep ne reaguje' in label)
        or ("System UI isn't responding" in label)
        or ('Sistemski korisnički interfejs ne reaguje' in label)
        for label in labels
    )
    if not system_anr:
        return False

    wait_nodes = [
        n for n in root.iter()
        if n.attrib.get('text') in ('Wait', 'Sačekaj', 'Čekaj')
        or n.attrib.get('content-desc') in ('Wait', 'Sačekaj', 'Čekaj')
    ]
    if not wait_nodes:
        raise RuntimeError(f'Known system ANR present without safe Wait action: {labels[-30:]}')
    tap_node(wait_nodes[-1], parent)
    print('RECOVERED known_system_anr via Wait', flush=True)
    time.sleep(1.5)
    return True


def find_nodes(**criteria):
    root, parent, _ = dump_tree()
    nodes = [n for n in root.iter() if matches(n, **criteria)]
    return nodes, parent


def wait_nodes(timeout=40, minimum=1, **criteria):
    end = time.time() + timeout
    last = []
    while time.time() < end:
        try:
            root, parent, _ = dump_tree()
            nodes = [n for n in root.iter() if matches(n, **criteria)]
            last = nodes
            if len(nodes) >= minimum:
                return nodes, parent
            if dismiss_known_system_anr(root, parent):
                # Directly re-assert the app activity after launcher starvation.
                adb('shell', 'am', 'start', '-W', '-n', MAIN_ACTIVITY, check=False)
        except Exception as exc:
            print(f'WAIT_RETRY criteria={criteria} error={type(exc).__name__}:{exc}', flush=True)
        time.sleep(1)

    root, _, xml = dump_tree('timeout')
    visible = [
        (n.attrib.get('text'), n.attrib.get('content-desc'), n.attrib.get('class'))
        for n in root.iter()
        if n.attrib.get('text') or n.attrib.get('content-desc')
    ]
    raise RuntimeError(
        f'Timeout criteria={criteria} minimum={minimum}; last={len(last)} '
        f'visible={visible[-80:]} xml_tail={xml[-1000:]}'
    )


def tap(prefer='bottom', timeout=40, **criteria):
    nodes, parent = wait_nodes(timeout=timeout, **criteria)
    clickable = [(clickable_for(n, parent), parent) for n in nodes]
    unique = {}
    for n, p in clickable:
        unique[n.attrib.get('bounds', str(id(n)))] = (n, p)
    options = list(unique.values())
    options.sort(
        key=lambda item: parse_bounds(item[0].attrib.get('bounds'))[1],
        reverse=(prefer == 'bottom'),
    )
    tap_node(options[0][0], options[0][1])


def wait_visible(timeout=40, **criteria):
    wait_nodes(timeout=timeout, **criteria)


def edit_text(index, value, timeout=40):
    nodes, parent = wait_nodes(timeout=timeout, minimum=index + 1, clazz='android.widget.EditText')
    nodes.sort(key=lambda n: parse_bounds(n.attrib.get('bounds'))[1])
    tap_node(nodes[index], parent)
    adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END')
    adb('shell', 'input', 'text', value)
    time.sleep(0.5)


def hide_keyboard():
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK', check=False)
    time.sleep(0.5)


def shot(name):
    png = subprocess.run(['adb', 'exec-out', 'screencap', '-p'], check=True, capture_output=True).stdout
    (ARTIFACT_DIR / f'{name}.png').write_bytes(png)
    dump_tree(name)
    print(f'EVIDENCE {name}', flush=True)


def launch_clean():
    # Clear only this proof APK. Start MainActivity directly so launcher/Quickstep
    # is not part of the marketplace proof path.
    adb('shell', 'am', 'force-stop', PACKAGE, check=False)
    adb('shell', 'pm', 'clear', PACKAGE, check=False)
    time.sleep(1)

    try:
        root, parent, _ = dump_tree()
        dismiss_known_system_anr(root, parent)
    except Exception:
        pass

    started = adb('shell', 'am', 'start', '-W', '-n', MAIN_ACTIVITY, check=False)
    print(
        f'APP_START returncode={started.returncode} stdout={started.stdout[-500:]} stderr={started.stderr[-500:]}',
        flush=True,
    )
    time.sleep(2)
    wait_visible(timeout=90, desc='Prijavi se')


def login(email):
    tap(desc='Prijavi se', prefer='top', timeout=45)
    wait_nodes(timeout=30, minimum=2, clazz='android.widget.EditText')
    edit_text(0, email)
    edit_text(1, PASSWORD)
    hide_keyboard()
    tap(text='Prijavi se', prefer='bottom', timeout=30)
    wait_visible(text='Početna', timeout=60)


def dismiss_ok(timeout=15):
    try:
        tap(text='OK', prefer='bottom', timeout=timeout)
    except Exception:
        try:
            tap(text='U redu', prefer='bottom', timeout=3)
        except Exception:
            pass


def assert_worker_submit():
    row = psql(f"""
select r.id::text || '|' || r.state || '|' || r.price_rsd::text || '|' || r.covered_slots::text
from public.marketplace_responses r
join public.app_profiles p on p.id=r.worker_profile_id
where r.need_id='{NEED_ID}'::uuid and p.account_id='{WORKER_USER_ID}'::uuid;
""")
    if not row:
        raise AssertionError('W05 UI did not create Application')
    parts = row.split('|')
    if parts[1] not in ('SUBMITTED', 'VIEWED', 'SHORTLISTED') or parts[2] != '3000' or parts[3] != '1':
        raise AssertionError(f'Unexpected W05 Application: {row}')
    return parts[0]


def assert_final_selection(response_id):
    row = psql(f"""
select a.id::text || '|' || a.requester_account_id::text || '|' || a.worker_account_id::text || '|' || a.selected_response_id::text
from public.agreements a
where a.need_id='{NEED_ID}'::uuid;
""")
    if not row:
        raise AssertionError('R05 UI did not create Agreement')
    agreement_id, requester_id, worker_id, selected_response = row.split('|')
    if requester_id != REQUESTER_USER_ID or worker_id != WORKER_USER_ID or selected_response != response_id:
        raise AssertionError(f'Agreement binding mismatch: {row}')
    activation = psql(f"""
select count(*)::text
from private.connection_activations a
where a.agreement_id='{agreement_id}'::uuid
  and a.requester_account_id='{REQUESTER_USER_ID}'::uuid
  and a.beneficiary_account_id='{REQUESTER_USER_ID}'::uuid
  and a.worker_account_id='{WORKER_USER_ID}'::uuid
  and a.activation_reason='SELECTION'
  and a.units=1
  and a.platform_cost_rsd=0
  and a.state='SATISFIED'
  and a.policy_key='REQUESTER_SELECTION_V1'
  and a.policy_version=1;
""")
    if activation != '1':
        raise AssertionError('P0D03 zero-RSD Requester activation mismatch')
    return agreement_id


def assert_gates_unchanged():
    checks = {
        'publication_policy_bundles': 'select count(*) from private.publication_policy_bundles;',
        'publication_decisions': 'select count(*) from private.need_publication_decisions;',
        'preselection_questions': 'select count(*) from private.preselection_qa_questions;',
        'preselection_answers': 'select count(*) from private.preselection_qa_answer_versions;',
        'preselection_policy': 'select count(*) from private.preselection_qa_policy_decisions;',
        'preselection_materiality': 'select count(*) from private.preselection_qa_materiality_decisions;',
        'preselection_commands': 'select count(*) from private.preselection_qa_commands;',
        'fastest_needs': "select count(*) from public.needs where mode='FASTEST';",
        'autofill_selections': "select count(*) from public.need_selections where selection_mode='AUTO_FILL';",
    }
    observed = {name: psql(sql) for name, sql in checks.items()}
    bad = {name: value for name, value in observed.items() if value != '0'}
    if bad:
        raise AssertionError(f'Gated/retired inventory changed: {bad}')


print('START RU5_PHYSICAL_ANDROID_DEVICE_UI_JOURNEY', flush=True)

# Worker physical UI: Auth -> workspace -> W03 -> W04 -> W05 -> W06.
launch_clean()
login(WORKER_EMAIL)
tap(text='Profil', prefer='bottom')
wait_visible(desc='Pređi u prostor Uskočera')
tap(desc='Pređi u prostor Uskočera')
wait_visible(text='Prilike', timeout=45)
tap(text='Prilike', prefer='bottom')
wait_visible(desc=f'Otvorite priliku {NEED_TITLE}', timeout=45)
shot('W03_worker_opportunity_list')
tap(desc=f'Otvorite priliku {NEED_TITLE}')
wait_visible(desc='Sastavi prijavu', timeout=45)
shot('W04_worker_need_detail')
tap(desc='Sastavi prijavu')
wait_visible(text='Sastavi prijavu', timeout=45)
wait_nodes(timeout=30, minimum=1, clazz='android.widget.EditText')
edit_text(0, '3000')
hide_keyboard()
shot('W05_worker_application_draft')
tap(desc='Pošalji prijavu', timeout=30)
wait_visible(contains='Prijava je uspešno podneta', timeout=45)
shot('W05_worker_application_success')
dismiss_ok()
wait_visible(text=NEED_TITLE, timeout=45)
wait_visible(text='Poslata', timeout=45)
shot('W06_worker_own_application')
response_id = assert_worker_submit()

# Same installed physical APK, clean application storage, second real Auth identity.
launch_clean()
login(REQUESTER_EMAIL)
tap(text='Potrebe', prefer='bottom')
wait_visible(desc=f'Otvori Potrebu {NEED_TITLE}', timeout=45)
tap(desc=f'Otvori Potrebu {NEED_TITLE}')
wait_visible(contains='Otvori prijave, ukupno 1', timeout=45)
tap(contains='Otvori prijave, ukupno 1')
wait_visible(text='Prijave (1)', timeout=45)
wait_visible(desc='Izaberi', timeout=45)
shot('R05_requester_candidate_selection')
tap(desc='Izaberi')
wait_visible(contains='Dogovor je uspešno sklopljen', timeout=45)
shot('R05_requester_selection_success')
dismiss_ok()
agreement_id = assert_final_selection(response_id)
assert_gates_unchanged()

print(
    f'PASS RU5_PHYSICAL_ANDROID_DEVICE_UI_JOURNEY W03 W04 W05 W06 R05 '
    f'two_real_auth_identities agreement={agreement_id} P0D03_0_RSD '
    'bounded_note_not_claimed disposable_local_only',
    flush=True,
)
