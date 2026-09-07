#!/usr/bin/env python3
"""Physical three-zone navigation, profile identity and account-switch proof.

Real UI input only. DB access is local-only SELECT postflight/expected identity;
fixture creation is a separate explicitly labelled local setup script.
"""
import ast
import json
import os
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse

PACKAGE = os.environ['RU5_DEVICE_PACKAGE']
if PACKAGE != 'rs.uskoci.n04proof':
    raise RuntimeError('Disposable navigation APK required')
DB_URL = os.environ['RU5_DEVICE_DB_URL']
if urlparse(DB_URL).hostname not in ('localhost', '127.0.0.1'):
    raise RuntimeError('Navigation postflight requires local-only DB')
if urlparse(os.environ['RU5_DEVICE_SUPABASE_URL']).hostname not in ('localhost', '127.0.0.1'):
    raise RuntimeError('Navigation proof requires local-only Supabase')
MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
PASSWORD = os.environ['RU5_DEVICE_PASSWORD']
WORKER_USER_ID = os.environ['RU5_DEVICE_WORKER_USER_ID']
REQUESTER_USER_ID = os.environ['RU5_DEVICE_REQUESTER_USER_ID']
NEED_ID = os.environ['RU5_DEVICE_NEED_ID']
NEED_TITLE = os.environ['RU5_DEVICE_NEED_TITLE']
ARTIFACT_DIR = Path(os.environ['RU5_DEVICE_ARTIFACT_DIR'])
fixture = json.loads((ARTIFACT_DIR / 'navigation-fixture.json').read_text(encoding='utf-8'))
NAV_NEED_ID, NAV_NEED_TITLE = fixture['needId'], fixture['needTitle']
assert fixture['localOnly'] is True and fixture['requesterId'] == REQUESTER_USER_ID
for identifier in (WORKER_USER_ID, REQUESTER_USER_ID, NEED_ID, NAV_NEED_ID):
    assert re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', identifier)
source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
definitions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                              if isinstance(node, ast.FunctionDef)], type_ignores=[])
exec(compile(definitions, str(source), 'exec'), globals())


def screen_size():
    return tuple(map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1]))


def labels(root):
    return [value for node in root.iter()
            for value in (node.attrib.get('text', ''), node.attrib.get('content-desc', '')) if value]


def assert_shell_tree(root, parent, width, height, expected):
    """Prove three physical bottom controls, not matching header text alone."""
    aliases = {'Novi': 'Novi Zadatak'}
    anchors = {}
    for node in root.iter():
        names = [aliases.get(value.split(',')[0].strip(), value.split(',')[0].strip())
                 for value in (node.attrib.get('text', ''), node.attrib.get('content-desc', ''))]
        matches_expected = set(names).intersection(expected)
        target = clickable_for(node, parent)
        if not matches_expected or target is None:
            continue
        bounds = parse_bounds(target.attrib.get('bounds'))
        if bounds[1] < height * 0.75 or bounds[3] > height:
            continue
        name = next(iter(matches_expected))
        anchors[name] = (bounds, target)
    if set(anchors) != set(expected):
        raise AssertionError(f'Bottom navigation missing: expected={expected}, actual={list(anchors)}')
    ordered = sorted(anchors, key=lambda name: anchors[name][0][0])
    if tuple(ordered) != tuple(expected):
        raise AssertionError(f'Bottom navigation order differs: {ordered}')
    top = min(value[0][1] for value in anchors.values())
    bottom = max(value[0][3] for value in anchors.values())
    controls = set()
    for node in root.iter():
        if node.attrib.get('clickable') != 'true' or node.attrib.get('enabled', 'true') != 'true':
            continue
        bounds = parse_bounds(node.attrib.get('bounds'))
        if bounds[1] >= top and bounds[3] <= bottom and bounds[2] - bounds[0] < width * 0.6:
            controls.add(bounds)
    if controls != {value[0] for value in anchors.values()}:
        raise AssertionError(f'Extra bottom controls: {controls}')
    # Catch the historical fourth/fifth destinations even if disabled.
    for node in root.iter():
        if node.attrib.get('text') in ('Početna', 'Profil', 'Prilike'):
            if parse_bounds(node.attrib.get('bounds'))[1] >= top:
                raise AssertionError('Historical bottom destination remains visible')


def assert_shell(intent):
    root, parent = wait_surface(text='MENI TREBA' if intent == 'requester' else 'JA MOGU', timeout=45)
    expected = ('Zadaci', 'Novi Zadatak', 'Dogovori') if intent == 'requester' else ('Prijave', 'Zadaci', 'Dogovori')
    assert_shell_tree(root, parent, *screen_size(), expected)
    print(f'CHECKPOINT THREE_ZONES intent={intent} labels={expected}', flush=True)


def assert_agreement_metadata_tree(root, width, height, title, schedule, amount):
    # Original native XML exposes the labelled Press as android.widget.Button
    # with TextView descendants. Match its actual accessibility label and
    # actionable state, without assuming a particular Android element class.
    cards = [node for node in root.iter()
             if node.attrib.get('content-desc') == f'Otvorite Dogovor {title}'
             and node.attrib.get('clickable') == 'true'
             and node.attrib.get('enabled', 'true') == 'true']
    if len(cards) != 1:
        raise AssertionError('Expected one actionable Agreement card')
    card = cards[0]
    card_bounds = parse_bounds(card.attrib.get('bounds'))

    def inside(bounds, container):
        return (container[0] <= bounds[0] < bounds[2] <= container[2]
                and container[1] <= bounds[1] < bounds[3] <= container[3])

    screen = (0, 0, width, height)
    if not inside(card_bounds, screen):
        raise AssertionError('Agreement card is outside the visible screen')
    observed = {}
    for field, expected in (('title', title), ('schedule', schedule), ('amount', amount)):
        nodes = [node for node in card.iter() if node.attrib.get('text') == expected]
        if len(nodes) != 1:
            raise AssertionError(f'Agreement {field} is missing or ambiguous: {expected}')
        bounds = parse_bounds(nodes[0].attrib.get('bounds'))
        if not inside(bounds, card_bounds) or not inside(bounds, screen):
            raise AssertionError(f'Agreement {field} is outside card/screen bounds: {bounds}')
        observed[field] = bounds
    return observed


def assert_agreement_metadata(intent):
    root, _ = wait_surface(desc=f'Otvorite Dogovor {NEED_TITLE}', timeout=45)
    # The original authenticated fixture selects one 3,000 RSD response on a
    # FLEX need. These exact fields must remain readable for both participants.
    observed = assert_agreement_metadata_tree(root, *screen_size(), NEED_TITLE, 'Fleksibilno', '3.000 RSD')
    print(f'CHECKPOINT AGREEMENT_METADATA_VISIBLE intent={intent} full_schedule full_amount '
          f'within_card_and_screen bounds={observed}', flush=True)


def assert_profile(account_id, kind):
    name = psql("select coalesce(nullif(btrim(display_name),''),'Ime još nije uneto') "
                f"from public.app_profiles where account_id='{account_id}' and kind='{kind}'")
    city = psql("select coalesce(nullif(btrim(city),''),'Grad još nije unet') "
                f"from public.app_profiles where account_id='{account_id}' and kind='{kind}'")
    if not name or not city:
        raise AssertionError('Expected fixture own profile not found')
    wait_visible(text=name)
    root, _ = wait_surface(text=city)
    visible = labels(root)
    if name not in visible:
        raise AssertionError('Expected own profile name and city are not visible together')
    if any(value in ('Miloš', 'MŠ', '4,9 · 18 recenzija', '18 recenzija') for value in visible):
        raise AssertionError('Historical fabricated profile identity/trust remains')
    if any('★' in value for value in visible):
        raise AssertionError('Unbacked profile rating is visible')
    print(f'CHECKPOINT OWN_PROFILE account={account_id} kind={kind} actual_name_city no_dummy_trust', flush=True)


def assert_discovery():
    assert_shell('worker')
    root, _ = wait_surface(desc=f'Otvorite priliku {NAV_NEED_TITLE}', timeout=45)
    visible = labels(root)
    forbidden = ('Kombinovano', 'Mapa još nije povezana', 'Po OD-05', 'Detalji')
    if any(word in value for value in visible for word in forbidden):
        raise AssertionError('Obsolete mode, map placeholder or duplicate detail action remains')


def back_to_tasks(intent):
    tap(desc='Nazad')
    assert_shell(intent)
    wait_visible(desc=f'Otvorite Zadatak {NAV_NEED_TITLE}' if intent == 'requester'
                 else f'Otvorite priliku {NAV_NEED_TITLE}')


print('START PHYSICAL_INTENT_SHELL_JOURNEY', flush=True)
launch_clean()
login(os.environ['RU5_DEVICE_REQUESTER_EMAIL'])
assert_shell('requester')
wait_visible(desc=f'Otvorite Zadatak {NAV_NEED_TITLE}')
shot('NAV_requester_tasks')

conversation_count_sql = (
    "select count(*) from public.ai_conversations "
    f"where account_id='{REQUESTER_USER_ID}' and purpose='NEED_INTAKE' and fact_schema_version='NEED_FACT_V2'"
)
conversations_before = int(psql(conversation_count_sql))
tap(desc='Novi Zadatak', prefer='bottom')
wait_visible(text='Recite šta Vam treba')
conversations_after = int(psql(conversation_count_sql))
assert conversations_after == conversations_before + 1, 'Novi must open one owned local AI conversation'
print(f'CHECKPOINT LOCAL_AI_CONVERSATION_OPEN account={REQUESTER_USER_ID} '
      f'before={conversations_before} after={conversations_after} no_message_no_publication', flush=True)
shot('NAV_requester_new_task')
tap(desc='Zadaci', prefer='bottom')
assert_shell('requester')
tap(desc='Dogovori', prefer='bottom')
wait_visible(text=NEED_TITLE)
assert_shell('requester')
assert_agreement_metadata('requester')
shot('NAV_requester_agreements')
tap(desc='Zadaci', prefer='bottom')
wait_visible(desc=f'Otvorite Zadatak {NAV_NEED_TITLE}')

tap(desc='Profil', prefer='top')
wait_visible(desc='Pređite na JA MOGU')
assert_profile(REQUESTER_USER_ID, 'REQUESTER')
shot('NAV_requester_profile')
back_to_tasks('requester')
shot('NAV_profile_back')

tap(contains='Obaveštenja,', prefer='top')
wait_visible(text='Sve važno, na jednom mestu.')
shot('NAV_inbox')
back_to_tasks('requester')
shot('NAV_inbox_back')

switch_to_worker_workspace()
assert_discovery()
shot('NAV_same_account_worker_discovery')
tap(desc='Radni profil', prefer='top')
wait_visible(desc='Pređite na MENI TREBA')
assert_profile(REQUESTER_USER_ID, 'WORKER')
shot('NAV_same_account_worker_profile')
tap(desc='Odjavite se')
wait_visible(desc='Prijavi se', timeout=60)
root = assert_signed_out_surface()
assert NAV_NEED_TITLE not in labels(root)
shot('NAV_signed_out')

# No app clear, force-stop or session injection between logout and second login.
login(os.environ['RU5_DEVICE_WORKER_EMAIL'])
assert_shell('requester')
root, _ = wait_surface(text='Još nemate Zadatak', timeout=45)
assert NAV_NEED_TITLE not in labels(root) and NEED_TITLE not in labels(root)
shot('NAV_second_account_requester_empty')
tap(desc='Profil', prefer='top')
wait_visible(desc='Pređite na JA MOGU')
assert_profile(WORKER_USER_ID, 'REQUESTER')
shot('NAV_second_account_profile')
tap(desc='Pređite na JA MOGU')
assert_discovery()
shot('NAV_second_account_worker_discovery')
tap(desc=f'Otvorite priliku {NAV_NEED_TITLE}')
wait_visible(text=NAV_NEED_TITLE)
wait_visible(desc='Nazad na Zadatke')
shot('NAV_task_detail')
tap(desc='Nazad na Zadatke')
assert_discovery()
shot('NAV_task_detail_back')

tap(desc='Prijave', prefer='bottom')
assert_shell('worker')
wait_visible(text='Izabrani ste')
wait_visible(text=NEED_TITLE)
shot('NAV_worker_applications')
tap(desc='Dogovori', prefer='bottom')
assert_shell('worker')
wait_visible(text=NEED_TITLE)
assert_agreement_metadata('worker')
shot('NAV_worker_agreements')

assert psql(f"select count(*) from public.marketplace_responses where need_id='{NAV_NEED_ID}'") == '0'
assert psql(f"select count(*) from public.need_selections where need_id='{NAV_NEED_ID}'") == '0'
assert psql(f"select count(*) from public.needs where id='{NAV_NEED_ID}' and status='PUBLISHED'") == '1'
assert psql(f"select count(*) from public.agreements where need_id='{NEED_ID}'") == '1'
assert psql('select count(*) from public.notification_push_attempts') == '0'
assert psql('select count(*) from public.notification_deliveries where read_at is not null') == '0'
assert_gates_unchanged()
print('PASS PHYSICAL_INTENT_SHELL two_intents three_zones real_profiles inbox_back detail_back '
      'ui_logout different_account_no_clear no_fake_map no_application_selection_mutation no_push', flush=True)
