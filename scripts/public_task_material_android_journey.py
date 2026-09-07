#!/usr/bin/env python3
"""Observe public material through real cards, scrolling and two real Auth sessions.

Runs after the inherited43 recovery journey. No route/session injection, clear,
business commands or private-data probes are performed by this UI driver.
"""
import ast
import hashlib
import json
import os
import re
import subprocess
import time
import traceback
import xml.etree.ElementTree as ET
from pathlib import Path

from shared_discovery_android_journey import assert_environment

CHECKPOINTS = ('MATERIAL_worker_list', 'MATERIAL_worker_rich', 'MATERIAL_worker_back',
               'MATERIAL_worker_legacy', 'MATERIAL_signed_out', 'MATERIAL_requester_list',
               'MATERIAL_requester_rich', 'MATERIAL_requester_profile', 'MATERIAL_profile_back')
LEGACY_TEXT = ('Stariji zadatak bez dodatnih javnih redova.',
               'Detalji mesta i kretanja nisu dostupni vašem nalogu.',
               'Dodatni uslovi nisu dostupni vašem nalogu.', 'Uslov za iskustvo nije naveden.')


def normalize_text(value):
    return ' '.join(value.removeprefix('• ').split())


def bounds(value):
    match = re.fullmatch(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', value or '')
    return tuple(map(int, match.groups())) if match else (0, 0, 0, 0)


def visible_text(root, width, height):
    """Only complete text inside screen AND every observed clipping ancestor.

Android can expose off-screen TextView descendants. Merely finding their text
in XML is not a physical display proof.
    """
    found = set()

    def visit(node, clip, hidden=False):
        hidden = hidden or node.attrib.get('visible-to-user') == 'false'
        own = bounds(node.attrib.get('bounds'))
        valid = own[0] < own[2] and own[1] < own[3]
        if hidden:
            return
        if valid:
            full = clip[0] <= own[0] < own[2] <= clip[2] and clip[1] <= own[1] < own[3] <= clip[3]
            value = node.attrib.get('text', '')
            if full and value:
                found.add(normalize_text(value))
            clip = (max(clip[0], own[0]), max(clip[1], own[1]), min(clip[2], own[2]), min(clip[3], own[3]))
        elif node.tag != 'hierarchy':
            return
        if clip[0] >= clip[2] or clip[1] >= clip[3]:
            return
        for child in node:
            visit(child, clip, hidden)

    visit(root, (0, 0, width, height))
    return found


def card_touch_point(root, title, width, height):
    """Choose a real exposed part of the labelled card, never its offscreen center."""
    result = None

    def visit(node, clip):
        nonlocal result
        if node.attrib.get('visible-to-user') == 'false' or node.attrib.get('enabled') == 'false':
            return
        rect = bounds(node.attrib.get('bounds'))
        if rect[0] < rect[2] and rect[1] < rect[3]:
            clip = (max(clip[0], rect[0]), max(clip[1], rect[1]), min(clip[2], rect[2]), min(clip[3], rect[3]))
        elif node.tag != 'hierarchy':
            return
        if clip[2] - clip[0] < 1 or clip[3] - clip[1] < 1:
            return
        if (node.attrib.get('content-desc') == f'Otvorite priliku {title}'
                and node.attrib.get('clickable') == 'true' and clip[2] - clip[0] >= 80 and clip[3] - clip[1] >= 120):
            assert result is None, 'Ambiguous duplicate actionable task card'
            result = ((clip[0] + clip[2]) // 2, (clip[1] + clip[3]) // 2)
        for child in node:
            visit(child, clip)

    # Leave fixed header/footer untouched. Ancestor clipping narrows this further.
    visit(root, (0, int(height * .17), width, int(height * .84)))
    return result


def validate_fixture(fixture, env):
    assert fixture['result'] == 'PASS' and fixture['sourceSha'] == env['GITHUB_SHA']
    assert fixture['localOnly'] is True and fixture['publicationProof'] is False
    assert fixture['requesterId'] == env['RU5_DEVICE_REQUESTER_USER_ID']
    assert fixture['workerId'] == env['RU5_DEVICE_WORKER_USER_ID']
    assert fixture['history']['count'] == 79 and fixture['history']['head'] == '20260906141409'
    assert fixture['allReadPhaseRowsUnchanged'] is True and fixture['originalPublicPrivateRowsPreserved'] is True
    for name in ('publicNeedId', 'legacyNeedId', 'terminalNeedId'):
        assert re.fullmatch(r'[0-9a-f-]{36}', fixture[name])
    for name in ('expectedPublicText', 'expectedSummaryText'):
        assert fixture[name] and all(isinstance(value, str) and value for value in fixture[name])


def main(env=os.environ):
    assert_environment(env)
    global PACKAGE, MAIN_ACTIVITY, PASSWORD, DB_URL, NEED_TITLE, NEED_ID
    global WORKER_USER_ID, REQUESTER_USER_ID, ARTIFACT_DIR
    PACKAGE, PASSWORD, DB_URL = env['RU5_DEVICE_PACKAGE'], env['RU5_DEVICE_PASSWORD'], env['RU5_DEVICE_DB_URL']
    MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
    NEED_TITLE, NEED_ID = env['RU5_DEVICE_NEED_TITLE'], env['RU5_DEVICE_NEED_ID']
    WORKER_USER_ID, REQUESTER_USER_ID = env['RU5_DEVICE_WORKER_USER_ID'], env['RU5_DEVICE_REQUESTER_USER_ID']
    ARTIFACT_DIR = Path(env['RU5_DEVICE_ARTIFACT_DIR'])
    fixture = json.loads((ARTIFACT_DIR / 'public-task-material-fixture.json').read_text(encoding='utf-8'))
    validate_fixture(fixture, env)
    helper = Path(__file__).with_name('ru5_android_device_ui_journey.py')
    functions = ast.Module(body=[node for node in ast.parse(helper.read_text(encoding='utf-8')).body
                                if isinstance(node, ast.FunctionDef)], type_ignores=[])
    exec(compile(functions, str(helper), 'exec'), globals())
    width, height = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1])
    report = {'sourceSha': env['GITHUB_SHA'], 'localOnly': True, 'productionProof': False,
              'noClearBetweenActors': True, 'noBusinessCommands': True,
              'closedEntryNativeProof': False, 'checkpoints': [], 'scans': {}, 'viewport': [width, height]}

    def checkpoint(name):
        shot(name)
        raw = (ARTIFACT_DIR / f'{name}.xml').read_bytes()
        assert b'LOCAL_PRIVATE_MATERIAL_' not in raw
        report['checkpoints'].append({'name': name, **{suffix: hashlib.sha256(
            (ARTIFACT_DIR / f'{name}.{suffix}').read_bytes()).hexdigest() for suffix in ('png', 'xml')}})
        return ET.fromstring(raw)

    def scroll(direction='down'):
        # Public detail scroll content only; never touch the fixed bottom action.
        low, high = int(height * .76), int(height * .43)
        start, end = (low, high) if direction == 'down' else (high, low)
        adb('shell', 'input', 'touchscreen', 'swipe', str(int(width * .5)), str(start),
            str(int(width * .5)), str(end), '430')
        time.sleep(.6)

    def scan(name, expected):
        wanted = {normalize_text(value) for value in expected}
        found = set()
        for index in range(22):
            root = checkpoint(f'{name}_scan_{index:02d}')
            found.update(visible_text(root, width, height))
            if wanted.issubset(found):
                report['scans'][name] = {'originalPairs': index + 1, 'observedExpected': sorted(wanted)}
                return
            scroll()
        raise AssertionError('Complete public material not visible after bounded actual scrolling')

    def seek_card(title):
        for index in range(24):
            root, parent, _ = dump_tree()
            if dismiss_known_system_anr(root, parent):
                root, parent, _ = dump_tree()
            point = card_touch_point(root, title, width, height)
            if point is not None:
                return point
            targets = [node for node in root.iter() if node.attrib.get('content-desc') == f'Otvorite priliku {title}']
            above = targets and bounds(targets[0].attrib.get('bounds'))[1] < height * .17
            scroll('up' if above or index >= 16 else 'down')
        raise AssertionError('Task card has no physically reachable touch region after bounded scrolling')

    def open_card(title):
        x, y = seek_card(title)
        adb('shell', 'input', 'tap', str(x), str(y))
        wait_visible(text=title, timeout=45)
        wait_visible(desc='Nazad na Zadatke')

    rich = fixture['expectedSummaryText'] + fixture['expectedPublicText']
    print('START PUBLIC_TASK_MATERIAL_PHYSICAL inherited43 real_cards visible_text_only', flush=True)
    # Existing worker session from the accepted full recovery journey.
    tap(desc='Prijave', prefer='bottom')
    tap(desc='Zadaci', prefer='bottom')
    wait_visible(desc=f"Otvorite priliku {fixture['publicNeedTitle']}", timeout=45)
    seek_card(fixture['publicNeedTitle'])
    checkpoint('MATERIAL_worker_list')
    open_card(fixture['publicNeedTitle'])
    wait_visible(desc='Sastavi prijavu')
    checkpoint('MATERIAL_worker_rich')
    scan('MATERIAL_worker_rich', rich)
    tap(desc='Nazad na Zadatke')
    wait_visible(desc=f"Otvorite priliku {fixture['publicNeedTitle']}")
    checkpoint('MATERIAL_worker_back')
    open_card(fixture['legacyNeedTitle'])
    checkpoint('MATERIAL_worker_legacy')
    scan('MATERIAL_worker_legacy', [fixture['legacyNeedTitle'], *LEGACY_TEXT])
    tap(desc='Nazad na Zadatke')
    tap(desc='Radni profil', prefer='top')
    tap(desc='Odjavite se')
    assert_signed_out_surface(form_open=True)
    checkpoint('MATERIAL_signed_out')
    login(env['RU5_DEVICE_REQUESTER_EMAIL'], form_open=True)
    tap(desc='Istražite sve otvorene zadatke', timeout=45)
    wait_visible(desc=f"Otvorite priliku {fixture['publicNeedTitle']}", timeout=45)
    seek_card(fixture['publicNeedTitle'])
    checkpoint('MATERIAL_requester_list')
    open_card(fixture['publicNeedTitle'])
    wait_visible(desc='Otvorite profil')
    checkpoint('MATERIAL_requester_rich')
    scan('MATERIAL_requester_rich', rich)
    tap(desc='Otvorite profil')
    wait_visible(desc='Pređite na JA MOGU')
    checkpoint('MATERIAL_requester_profile')
    tap(desc='Nazad')
    wait_visible(desc='Otvorite profil')
    checkpoint('MATERIAL_profile_back')
    assert set(CHECKPOINTS).issubset(row['name'] for row in report['checkpoints'])
    (ARTIFACT_DIR / 'public-task-material-journey.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('PASS PUBLIC_TASK_MATERIAL_PHYSICAL real_worker_requester full_description_route_requirements '
          'price_time_capacity actual_back_profile missing_children no_submit no_clear closed_entry_sdk_only', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'PUBLIC_TASK_MATERIAL_PHYSICAL_FAILED {type(error).__name__}', flush=True)
        for frame in traceback.extract_tb(error.__traceback__)[-4:]:
            print(f'FAILURE_FRAME {Path(frame.filename).name}:{frame.lineno} {frame.name}', flush=True)
        raise SystemExit(1) from None
