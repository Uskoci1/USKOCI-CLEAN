#!/usr/bin/env python3
"""Real UI only; reuse exact proven input functions without running the RU5 journey."""
import ast
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE = os.environ['RU5_DEVICE_PACKAGE']
if PACKAGE != 'rs.uskoci.n04proof':
    raise RuntimeError('Disposable N04 APK required')
MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
PASSWORD = os.environ['RU5_DEVICE_PASSWORD']
DB_URL = os.environ['RU5_DEVICE_DB_URL']
WORKER_USER_ID = os.environ['RU5_DEVICE_WORKER_USER_ID']
REQUESTER_USER_ID = os.environ['RU5_DEVICE_REQUESTER_USER_ID']
NEED_ID = os.environ['RU5_DEVICE_NEED_ID']
NEED_TITLE = os.environ['RU5_DEVICE_NEED_TITLE']
ARTIFACT_DIR = Path(os.environ['RU5_DEVICE_ARTIFACT_DIR'])
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
# Same physical input functions used by the canonical Android proof. No mocked
# selectors, session injection, JS navigation, RPC fallback or DB writes here.
source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
functions = ast.Module(body=[n for n in ast.parse(source.read_text()).body
                             if isinstance(n, ast.FunctionDef)], type_ignores=[])
exec(compile(functions, str(source), 'exec'), globals())

def scroll_until(text, maximum=25):
    for _ in range(maximum):
        root, _, _ = dump_tree()
        if any(n.attrib.get('text') == text for n in root.iter()):
            return
        size = adb('shell', 'wm', 'size').stdout
        width, height = map(int, re.findall(r'(\d+)x(\d+)', size)[-1])
        adb('shell', 'input', 'swipe', str(width//2), str(height*4//5),
            str(width//2), str(height//4), '350')
        time.sleep(0.7)
    raise AssertionError(f'Visible scroll target missing: {text}')

launch_clean()
login(os.environ['RU5_DEVICE_REQUESTER_EMAIL'])
tap(contains='Obaveštenja, 1 nepročitanih')
wait_visible(text='Sve važno, na jednom mestu.')
shot('INBOX_requester_one_event')
tap(text='Ja mogu')
wait_visible(text='Još nema obaveštenja')
shot('INBOX_role_empty')
tap(text='Meni treba')
wait_visible(text='Pročitaj sve')
tap(text='Pročitaj sve')
wait_visible(text='Sve je pročitano')
assert psql(f"select count(*) from public.user_activity_events where recipient_user_id='{REQUESTER_USER_ID}' and read_at is null") == '0'
shot('INBOX_requester_read_all')
tap(desc='Nazad')
wait_visible(contains='Obaveštenja, 0 nepročitanih')
shot('INBOX_bell_zero')

launch_clean()
login(os.environ['RU5_DEVICE_WORKER_EMAIL'])
tap(contains='Obaveštenja, 32 nepročitanih')
wait_visible(text='Vaša prijava je izabrana')
shot('INBOX_worker_selection_unread')
tap(contains='Nepročitano. Vaša prijava je izabrana.')
wait_visible(text='Dogovor', timeout=45)
wait_visible(text=NEED_TITLE, timeout=45)
shot('INBOX_selection_opens_real_agreement')
assert psql(f"select count(*) from public.user_activity_events where recipient_user_id='{WORKER_USER_ID}' and event_type='RESPONSE_SELECTED' and read_at is not null") == '1'
adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
wait_visible(text='Sve važno, na jednom mestu.')
wait_visible(text='31 nepročitanih')
shot('INBOX_selection_read_confirmed')
scroll_until('Učitaj starija obaveštenja')
shot('INBOX_next_page_available')
tap(text='Učitaj starija obaveštenja')
scroll_until('Zadatak je izmenjen 1', maximum=5)
root, _, _ = dump_tree()
assert not any(n.attrib.get('text') == 'Učitaj starija obaveštenja' for n in root.iter())
shot('INBOX_second_page_loaded')
size = adb('shell', 'wm', 'size').stdout
width, height = map(int, re.findall(r'(\d+)x(\d+)', size)[-1])
for _ in range(25):
    root, _, _ = dump_tree()
    if any(n.attrib.get('text') == 'Pročitaj sve' for n in root.iter()):
        break
    adb('shell','input','swipe',str(width//2),str(height//4),str(width//2),str(height*4//5),'350')
tap(text='Pročitaj sve')
wait_visible(text='Sve je pročitano')
assert psql(f"select count(*) from public.user_activity_events where recipient_user_id='{WORKER_USER_ID}' and read_at is null") == '0'
assert psql('select count(*) from public.notification_push_attempts') == '0'
assert psql('select count(*) from public.notification_deliveries where read_at is not null') == '0'
shot('INBOX_worker_read_all')
assert_gates_unchanged()
print('PASS N04_PHYSICAL_INBOX two_real_auth event_read role_empty pagination bell agreement_target no_push', flush=True)
