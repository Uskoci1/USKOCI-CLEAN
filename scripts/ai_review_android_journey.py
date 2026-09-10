#!/usr/bin/env python3
"""Current W03 native composer/readback/human review on exact local SQL106.
Actual Auth, client, handler and SQL; synthetic model, hosted gateway unproven.
Reuses PR59 physical input/visibility helpers, without unrelated old journeys.
"""
import ast
from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo


def load_shared_helpers():
    source = Path(__file__).with_name('ru5_android_device_ui_journey.py')
    definitions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                  if isinstance(node, ast.FunctionDef)], type_ignores=[])
    exec(compile(definitions, str(source), 'exec'), globals())
    source = Path(__file__).with_name('intent_shell_android_journey.py')
    allowed = {'screen_size', 'labels', 'assert_shell_tree', 'assert_shell'}
    definitions = ast.Module(body=[node for node in ast.parse(source.read_text(encoding='utf-8')).body
                                  if isinstance(node, ast.FunctionDef) and node.name in allowed], type_ignores=[])
    exec(compile(definitions, str(source), 'exec'), globals())


def inside(bounds, container):
    return (container[0] <= bounds[0] < bounds[2] <= container[2]
            and container[1] <= bounds[1] < bounds[3] <= container[3])


def visible_node(node, parent, width, height):
    if not node.attrib.get('bounds'):
        return False
    bounds = parse_bounds(node.attrib.get('bounds'))
    if not inside(bounds, (0, 0, width, height)):
        return False
    ancestor = parent.get(node)
    while ancestor is not None:
        if ancestor.attrib.get('scrollable') == 'true' and not inside(bounds, parse_bounds(ancestor.attrib.get('bounds'))):
            return False
        ancestor = parent.get(ancestor)
    return True


def assert_button(root, parent, label, enabled):
    nodes = [node for node in root.iter() if node.attrib.get('content-desc') == label]
    if len(nodes) != 1:
        raise AssertionError(f'Expected one actual labelled control: {label}')
    node = nodes[0]
    if node.attrib.get('enabled') != str(enabled).lower():
        raise AssertionError(f'Actual control enabled state differs: {label}')
    if enabled and clickable_for(node, parent) is None:
        raise AssertionError(f'Enabled control is not actionable: {label}')
    return node


def anchor_criteria(anchor):
    # Conversation heading belongs to its scroll content. The real input stays
    # visible below it, so scrolling never depends on an offscreen heading.
    if anchor == 'Novi zadatak':
        return {'desc': 'Poruka za AI'}
    return {'desc': 'Prijavi se'} if anchor == 'Auth entry' else {'text': anchor}


def clean_surface(anchor):
    root, parent = wait_surface(timeout=60, **anchor_criteria(anchor))
    # A real app ANR is a failure. Only the existing helper may recover the
    # explicitly known launcher/System UI starvation dialog.
    if any("isn't responding" in value or 'ne reaguje' in value for value in labels(root)):
        raise AssertionError('ANR visible on required app surface')
    return root, parent


def scroll_once(root, direction):
    choices = [parse_bounds(n.attrib.get('bounds')) for n in root.iter()
               if n.attrib.get('scrollable') == 'true']
    if not choices:
        raise AssertionError('Required content not visible and no actual scroll surface exists')
    x1, y1, x2, y2 = max(choices, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
    if x2 <= x1 or y2 - y1 < 100:
        raise AssertionError('Invalid physical scroll bounds')
    x, high, low = (x1 + x2) // 2, y1 + (y2 - y1) // 5, y2 - (y2 - y1) // 5
    start, end = (low, high) if direction == 'down' else (high, low)
    adb('shell', 'input', 'touchscreen', 'swipe', str(x), str(start), str(x), str(end), '450')
    time.sleep(0.5)


def seek(anchor, *, text=None, desc=None, direction='down', attempts=28, enabled=None):
    """Scroll only the observed real surface; return the same asserted XML tree."""
    for _ in range(attempts):
        root, parent = clean_surface(anchor)
        candidates = [n for n in root.iter() if matches(n, text=text, desc=desc)]
        found = [n for n in candidates if visible_node(n, parent, *screen_size())]
        if found:
            if len(found) != 1:
                raise AssertionError(f'Ambiguous visible content text={text} desc={desc}')
            if enabled is not None and found[0].attrib.get('enabled') != str(enabled).lower():
                # DB acknowledgment may precede the subsequent real UI read.
                # Wait on this same control, without scrolling or tapping it.
                time.sleep(0.5)
                continue
            return root, parent, found[0]
        observed_direction = direction
        if len(candidates) == 1 and candidates[0].attrib.get('bounds'):
            node = candidates[0]
            bounds = parse_bounds(node.attrib.get('bounds'))
            ancestor = parent.get(node)
            while ancestor is not None:
                if ancestor.attrib.get('scrollable') == 'true':
                    clip = parse_bounds(ancestor.attrib.get('bounds'))
                    # Android may report inverted bounds for a clipped node.
                    # Run34125911445 retained Review's bottom position after
                    # Back: People was [353,307][655,269], above clip y=307.
                    if bounds[3] <= clip[1] or bounds[1] < clip[1]:
                        observed_direction = 'up'
                    elif bounds[1] >= clip[3] or bounds[3] > clip[3]:
                        observed_direction = 'down'
                    break
                ancestor = parent.get(ancestor)
        scroll_once(root, observed_direction)
    raise AssertionError(f'Required content did not become visible text={text} desc={desc}')


def press_in_review(label, *, direction='down'):
    root, parent, node = seek('Proverite Zadatak', desc=label, direction=direction, enabled=True)
    assert_button(root, parent, label, True)
    tap_node(node, parent, hold_ms=120)


def capture(name, anchor):
    clean_surface(anchor)
    shot(name)
    # Validate the exact saved XML as well, not a later unrecorded dump.
    root = ET.parse(ARTIFACT_DIR / f'{name}.xml').getroot()
    if not any(matches(node, **anchor_criteria(anchor)) for node in root.iter()):
        raise AssertionError('Captured original XML is not the required app surface')
    if any("isn't responding" in value or 'ne reaguje' in value for value in labels(root)):
        raise AssertionError('Captured original contains ANR')
    return root, {child: p for p in root.iter() for child in p}


def local_query(query):
    try:
        result = subprocess.run(['psql', DB_URL, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], input=query,
                                text=True, capture_output=True, check=True, timeout=30)
        return result.stdout.strip()
    except (subprocess.SubprocessError, OSError):
        raise RuntimeError('AI_REVIEW_LOCAL_READ_FAILED') from None


def fixture_command(mode, label=None):
    env = dict(os.environ)
    if label:
        assert re.fullmatch(r'[A-Z][A-Z0-9_]{0,70}', label)
        env['AI_REVIEW_OBSERVATION'] = label
    result = subprocess.run(['node', 'scripts/ai_review_fixture.mjs', mode], env=env,
                            text=True, capture_output=True, timeout=90)
    print(result.stdout, end='', flush=True)
    if result.returncode:
        raise RuntimeError(f'Guarded local fixture {mode} failed; no credential-bearing subprocess output logged')
    if label:
        return json.loads((ARTIFACT_DIR / f'AI_STATE_{label}.json').read_text(encoding='utf-8'))


def owned_state_digest():
    # Available even while REST is stopped. No service mutations or HTTP mocks.
    return local_query(f"""select md5(jsonb_build_object(
      'facts',(select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]'::jsonb) from public.ai_structured_facts f where conversation_id='{CONVERSATION_ID}'),
      'needs',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]'::jsonb) from public.needs n where requester_account_id='{ACCOUNT_ID}'),
      'receipts',(select coalesce(jsonb_agg(to_jsonb(c) order by client_request_id),'[]'::jsonb) from private.need_draft_save_commands c where account_id='{ACCOUNT_ID}')
    )::text)""")


def wait_confirmed(key, count, timeout=60):
    deadline = time.monotonic() + timeout
    assert re.fullmatch(r'need\.[a-z_]+', key)
    while time.monotonic() < deadline:
        actual = local_query(f"select count(*) from public.ai_structured_facts where conversation_id='{CONVERSATION_ID}' and superseded_at is null and status='CONFIRMED'")
        target = local_query(f"select count(*) from public.ai_structured_facts where conversation_id='{CONVERSATION_ID}' and fact_key='{key}' and superseded_at is null and status='CONFIRMED'")
        if actual == str(count) and target == '1':
            return
        time.sleep(0.5)
    raise AssertionError(f'Actual owner confirmation missing key={key}, expected total={count}')


def assert_correction(state):
    people = [f for f in state['facts'] if f['fact_key'] == 'need.people_needed']
    assert len(people) == 2, 'Exactly one supersession is required'
    old = [f for f in people if f['superseded_at'] is not None]
    live = [f for f in people if f['superseded_at'] is None]
    assert len(old) == len(live) == 1
    assert old[0]['fact_value'] == 2 and old[0]['source'] == 'AI_INFERENCE'
    assert old[0]['superseded_by'] == live[0]['id']
    assert type(live[0]['fact_value']) is int and live[0]['fact_value'] == 3
    assert live[0]['source'] == 'EXPLICIT_USER_ANSWER' and live[0]['status'] == 'CONFIRMED'
    assert live[0]['confirmed_by_user_id'] == state['accountId'] and live[0]['confirmed_at']


def assert_saved(state, fixture):
    assert state['accountId'] == fixture['accountId'] and state['conversationId'] == fixture['conversationId']
    assert len(state['needs']) == len(state['receipts']) == 1, 'UI save must create one DRAFT and one receipt'
    need, receipt = state['needs'][0], state['receipts'][0]
    values = {p['key']: p['value'] for p in fixture['proposals']}
    assert need['id'] == state['review']['boundNeedId'] == receipt['need_id']
    assert receipt['conversation_id'] == fixture['conversationId']
    assert need['requester_account_id'] == fixture['accountId'] and need['requester_profile_id'] == fixture['profileId']
    assert need['status'] == 'DRAFT' and need['mode'] == 'OFFERS' and need['requester_price_rsd'] is None
    assert need['title'] == values['need.title'] and need['description'] == values['need.description']
    assert need['category'] == values['need.category'] and need['required_slots'] == 3
    assert need['schedule_kind'] == 'FIXED_WINDOW' and need['required_vehicles'] == ['Kombi']
    assert need['public_topology']['mode'] == values['need.task_geography']['mode']
    assert need['public_topology']['start'] == values['need.task_geography']['start']
    assert need['public_topology']['end'] == values['need.task_geography']['end']
    assert need['task_country_code'] == 'RS'
    for column in ('starts_at', 'ends_at'):
        assert datetime.fromisoformat(need[column].replace('Z', '+00:00')) == datetime.fromisoformat(values[f'need.{column}'].replace('Z', '+00:00'))
    current = [f for f in state['facts'] if f['superseded_at'] is None]
    assert len(current) == 11 and all(f['status'] == 'CONFIRMED' and f['confirmed_by_user_id'] == fixture['accountId'] and f['confirmed_at'] for f in current)
    assert_correction(state)
    return need


def assert_schedule_label(value, start, end):
    # Independent semantic oracle, accepting Intl's legitimate CET/CEST/GMT
    # abbreviation while requiring BOTH actual full dates and local times.
    compact = re.sub(r'\s+', '', value)
    assert '–' in compact, 'Both schedule endpoints must be shown'
    endpoints = compact.split('–')
    assert len(endpoints) == 2
    for rendered, source in zip(endpoints, (start, end)):
        instant = datetime.fromisoformat(source.replace('Z', '+00:00')).astimezone(ZoneInfo('Europe/Belgrade'))
        date = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{4})\.', rendered)
        clock = re.search(r'(\d{1,2}):(\d{2})(?::\d{2})?', rendered)
        assert date and tuple(map(int, date.groups())) == (instant.day, instant.month, instant.year)
        assert clock and tuple(map(int, clock.groups())) == (instant.hour, instant.minute)
        offset = int(instant.utcoffset().total_seconds() // 3600)
        assert any(re.search(re.escape(zone) + r'(?![0-9A-Za-z])', rendered)
                   for zone in (instant.tzname(), f'GMT+{offset}', f'UTC+{offset}')), 'Visible timezone required'


def open_fact(label, *, direction='down'):
    press_in_review(f'Pregledajte: {label}', direction=direction)


def wait_pending_review():
    wait_visible(desc='Poruka za AI', timeout=60)
    seek('Novi zadatak', text='0 potvrđeno · 11 za pregled', direction='up')


def open_review():
    root, parent, node = seek('Novi zadatak', desc='Pregledajte nacrt', enabled=True)
    assert_button(root, parent, 'Pregledajte nacrt', True)
    tap_node(node, parent, hold_ms=120)


def main():
    if __package__:
        from .ai_review_local_rest import LocalRestOutage, validate_local_targets
    else:
        from ai_review_local_rest import LocalRestOutage, validate_local_targets
    validate_local_targets(os.environ)
    assert os.environ['RU5_DEVICE_ARTIFACT_DIR'] == 'artifacts/ai-review-device'
    assert re.fullmatch(r'[a-f0-9]{40}', os.environ['GITHUB_SHA'])
    global PACKAGE, MAIN_ACTIVITY, PASSWORD, DB_URL, ARTIFACT_DIR, ACCOUNT_ID, CONVERSATION_ID
    PACKAGE, DB_URL = os.environ['RU5_DEVICE_PACKAGE'], os.environ['RU5_DEVICE_DB_URL']
    MAIN_ACTIVITY, PASSWORD = f'{PACKAGE}/.MainActivity', os.environ['RU5_DEVICE_PASSWORD']
    ARTIFACT_DIR = Path(os.environ['RU5_DEVICE_ARTIFACT_DIR'])
    load_shared_helpers()
    globals()['psql'] = local_query
    fixture = json.loads((ARTIFACT_DIR / 'ai-review-fixture.json').read_text(encoding='utf-8'))
    ACCOUNT_ID = fixture['accountId']
    assert fixture['sourceSha'] == os.environ['GITHUB_SHA'] and fixture['localOnly'] is True and fixture['providerProof'] is False
    assert re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', ACCOUNT_ID)
    assert ACCOUNT_ID not in (os.environ['RU5_DEVICE_REQUESTER_USER_ID'], os.environ['RU5_DEVICE_WORKER_USER_ID'])
    print('START AI_REVIEW_PHYSICAL exact106 actual_client_handler_auth_sql synthetic_model', flush=True)
    launch_clean()
    capture('AI_entry_real_native', 'Auth entry')
    login(fixture['email'])
    assert_shell('requester')
    capture('AI_owner_empty', 'Još nemate Zadatak')
    tap(desc='Novi Zadatak', prefer='bottom')
    wait_visible(desc='Poruka za AI')
    capture('AI_owned_conversation_open', 'Novi zadatak')
    assert local_query(f"select count(*) from public.ai_conversations where account_id='{ACCOUNT_ID}'") == '1'
    CONVERSATION_ID = local_query(f"select id from public.ai_conversations where account_id='{ACCOUNT_ID}'")
    assert re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', CONVERSATION_ID)
    edit_text(0, fixture['input'])
    capture('AI_composer_keyboard', 'Novi zadatak')
    hide_keyboard()
    root, parent = clean_surface('Novi zadatak')
    control = assert_button(root, parent, 'Pošalji poruku', True)
    x1, y1, x2, y2 = parse_bounds(control.attrib['bounds'])
    for _ in range(2):
        adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    # The local adapter drops only the first SUCCEEDED HTTP response AFTER SQL
    # commit. An actual owned readback recovers it without another send.
    wait_visible(desc='Proverite ishod', timeout=60)
    root, parent = capture('AI_send_unknown_after_commit', 'Novi zadatak')
    assert_button(root, parent, 'Ponovi istu poruku', False)
    state = fixture_command('observe', 'TURN_COMMITTED_UI_UNKNOWN')
    assert len(state['turns']) == 1 and state['turns'][0]['state'] == 'SUCCEEDED'
    assert len(state['facts']) == 11 and not state['needs'] and not state['receipts']
    tap(desc='Proverite ishod')
    wait_pending_review()
    capture('AI_pending_proposals', 'Novi zadatak')
    open_review()
    root, parent = capture('AI_review_pending_top', 'Proverite Zadatak')
    assert_button(root, parent, 'Sačuvajte nacrt', False)
    tap(desc='Nazad u razgovor', prefer='top')
    wait_pending_review()
    capture('AI_review_back_same_conversation', 'Novi zadatak')
    assert local_query(f"select status from public.ai_conversations where id='{CONVERSATION_ID}'") == 'OPEN'
    assert local_query(f"select count(*) from public.ai_conversations where account_id='{ACCOUNT_ID}'") == '1'
    open_review()
    open_fact('Ljudi')
    press_in_review('Izmenite')
    seek('Proverite Zadatak', desc='Nova vrednost: Ljudi')
    fields, _ = wait_nodes(desc='Nova vrednost: Ljudi')
    assert len(fields) == 1 and entered_value_matches(fields[0], '2'), 'Correction must start from typed value, not misleading model displayValue=99'
    edit_text(0, '3')
    hide_keyboard()
    capture('AI_people_correction_input', 'Proverite Zadatak')
    press_in_review('Sačuvaj ispravku')
    wait_confirmed('need.people_needed', 1)
    assert_correction(fixture_command('observe', 'PEOPLE_CORRECTED'))
    capture('AI_people_corrected', 'Proverite Zadatak')
    sequence = [('Naslov', 'title'), ('Opis', 'description'), ('Kategorija', 'category'),
                ('Cena', 'price_mode'), ('Termin', 'schedule_kind'), ('Početak', 'starts_at'),
                ('Kraj', 'ends_at'), ('Država zadatka', 'task_country_code'), ('Lokacija', 'task_geography')]
    for index, (label, key) in enumerate(sequence, start=2):
        open_fact(label, direction='up' if index == 2 else 'down')
        if key == 'task_geography':
            root, _ = clean_surface('Proverite Zadatak')
            assert any('Novi Sad · Centar' in value and 'Novi Sad · Liman' in value for value in labels(root)), 'Expanded location must show both typed public endpoints'
        press_in_review('Potvrdite')
        wait_confirmed(f'need.{key}', index)
    state = fixture_command('observe', 'OPTIONAL_VEHICLE_PENDING')
    assert state['review']['canSaveDraft'] is True and state['review']['safety'] == 'ALLOW'
    assert [f['key'] for f in state['review']['facts'] if f['status'] != 'CONFIRMED'] == ['need.required_vehicles']
    assert not state['needs'] and not state['receipts']
    root, parent = capture('AI_optional_vehicle_blocks_save', 'Proverite Zadatak')
    assert_button(root, parent, 'Sačuvajte nacrt', False)
    open_fact('Vozilo', direction='up')
    seek('Proverite Zadatak', desc='Potvrdite')
    unchanged = owned_state_digest()
    with LocalRestOutage().stopped():
        press_in_review('Potvrdite')
        wait_visible(desc='Učitajte pregled ponovo', timeout=60)
        root, parent = capture('AI_offline_confirmation_readback', 'Proverite Zadatak')
        assert_button(root, parent, 'Sačuvajte nacrt', False)
        assert owned_state_digest() == unchanged
    tap(desc='Učitajte pregled ponovo')
    # Fresh read collapses the one expanded row. Explicit confirmation remains
    # a separate physical user action; recovery never repeats the write.
    open_fact('Vozilo', direction='up')
    capture('AI_restored_explicit_confirmation', 'Proverite Zadatak')
    press_in_review('Potvrdite')
    wait_confirmed('need.required_vehicles', 11)
    ready = fixture_command('observe', 'READY')
    assert all(f['status'] == 'CONFIRMED' for f in ready['review']['facts'])
    root, parent = capture('AI_ready_human_confirmed', 'Proverite Zadatak')
    control = assert_button(root, parent, 'Sačuvajte nacrt', True)
    x1, y1, x2, y2 = parse_bounds(control.attrib['bounds'])
    for _ in range(2):
        adb('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    wait_visible(text='Pregled Zadatka', timeout=60)
    saved = fixture_command('observe', 'SAVED')
    fixture = json.loads((ARTIFACT_DIR / 'ai-review-fixture.json').read_text(encoding='utf-8'))
    need = assert_saved(saved, fixture)
    root, parent = capture('AI_saved_draft_detail', 'Pregled Zadatka')
    assert need['title'] in labels(root) and 'Nacrt' in labels(root)
    tap(desc='Nazad', prefer='top')
    wait_visible(desc='Poruka za AI')
    capture('AI_saved_conversation_readonly', 'Novi zadatak')
    root, parent = clean_surface('Novi zadatak')
    assert_button(root, parent, 'Pošalji poruku', False)
    tap(desc='Nazad', prefer='top')
    assert_shell('requester')
    wait_visible(desc=f"Otvorite Zadatak {need['title']}")
    capture('AI_saved_in_tasks', 'MENI TREBA')
    tap(desc='Profil', prefer='top')
    tap(desc='Odjavite se')
    assert_signed_out_surface()
    login(fixture['other']['email'])
    assert_shell('requester')
    root, parent = capture('AI_other_account_empty', 'Još nemate Zadatak')
    assert need['title'] not in labels(root)
    tap(desc='Novi Zadatak', prefer='bottom')
    wait_visible(desc='Poruka za AI')
    root, parent = capture('AI_other_account_new_conversation', 'Novi zadatak')
    assert need['title'] not in labels(root)
    assert local_query(f"select count(*) from public.ai_conversations where account_id='{fixture['other']['accountId']}'") == '1'
    final = fixture_command('observe', 'FINAL')
    assert assert_saved(final, fixture)['id'] == need['id'] and final['receipts'] == saved['receipts']
    fixture_command('verify')
    print('PASS AI_REVIEW_PHYSICAL exact106 real_native_auth_client_handler_sql synthetic_provider '
          'unknown_readback_no_turn_replay correction optional_confirmation double_save_one_draft other_account_isolated '
          'gatewayProof=false providerProof=false publicationProof=false downstreamTaskDetailV2Parity=false', flush=True)


if __name__ == '__main__':
    main()
