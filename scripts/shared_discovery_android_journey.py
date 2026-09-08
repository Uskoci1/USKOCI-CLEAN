#!/usr/bin/env python3
"""Real disposable Android input; no app adapter, Auth injection or business RPC.

The preceding inherited27 journey is a separate required admission. This file
only browses the new fictional fixture. Original screenshots/XML are retained;
pixel observations support, and never replace, final human map review.
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
from urllib.parse import urlsplit

from shared_discovery_map_pixels import compare_map_regions, summarize_map

MAP_LABEL = 'Mapa približnih područja zadataka'
SEARCH_LABEL = 'Pretražite učitane zadatke'
SCAN_LIMIT = 65
CHECKPOINTS = (
    'DISCOVERY_requester_own', 'DISCOVERY_requester_list30', 'DISCOVERY_filter_cancel',
    'DISCOVERY_remote_filter', 'DISCOVERY_remote_map_no_pin', 'DISCOVERY_requester_page35',
    'DISCOVERY_map_cluster', 'DISCOVERY_cluster_expanded', 'DISCOVERY_pin_selected',
    'DISCOVERY_task_detail', 'DISCOVERY_map_back', 'DISCOVERY_signed_out',
    'DISCOVERY_worker_list30', 'DISCOVERY_worker_page35', 'DISCOVERY_worker_map',
)


def assert_environment(env):
    api, db = urlsplit(env.get('RU5_DEVICE_SUPABASE_URL', '')), urlsplit(env.get('RU5_DEVICE_DB_URL', ''))
    if (api.scheme, api.netloc, api.path, api.query, api.fragment) != ('http', '127.0.0.1:54321', '', '', ''):
        # Both URL spellings denote the same strict loopback root.
        if (api.scheme, api.netloc, api.path, api.query, api.fragment) != ('http', '127.0.0.1:54321', '/', '', ''):
            raise ValueError('Exact disposable API required')
    if not (db.scheme == 'postgresql' and db.hostname == '127.0.0.1' and db.port == 54322
            and db.username == 'postgres' and db.path == '/postgres' and not db.query and not db.fragment):
        raise ValueError('Exact disposable DB required')
    if env.get('RU5_DEVICE_PACKAGE') != 'rs.uskoci.n04proof':
        raise ValueError('Disposable proof package required')
    if not re.fullmatch(r'[0-9a-f]{40}', env.get('GITHUB_SHA', '')):
        raise ValueError('Exact source SHA required')
    for name in ('RU5_DEVICE_REQUESTER_USER_ID', 'RU5_DEVICE_WORKER_USER_ID', 'RU5_DEVICE_NEED_ID'):
        if not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', env.get(name, '')):
            raise ValueError('Validated local fixture identity required')
    if env['RU5_DEVICE_REQUESTER_USER_ID'] == env['RU5_DEVICE_WORKER_USER_ID']:
        raise ValueError('Two distinct real fixture accounts required')
    if not env.get('RU5_DEVICE_ARTIFACT_DIR'):
        raise ValueError('Explicit artifact path required')


def validate_fixture(fixture, env):
    assert fixture['sourceSha'] == env['GITHUB_SHA'] and fixture['localOnly'] is True
    assert fixture['publicationProof'] is False and fixture['providerProof'] is False
    assert fixture['requesterId'] == env['RU5_DEVICE_REQUESTER_USER_ID']
    assert fixture['workerId'] == env['RU5_DEVICE_WORKER_USER_ID']
    assert fixture['history']['count'] == 79 and fixture['history']['head'] == '20260906141409'
    assert len(fixture['plan']) == 34 and len(fixture['allPublic']) == 35
    assert len({row['id'] for row in fixture['allPublic']}) == 35
    assert len({row['title'] for row in fixture['allPublic']}) == 35
    ids = [row['id'] for row in fixture['allPublic']]
    assert len(fixture['observations']) == 2
    assert {row['role'] for row in fixture['observations']} == {'requester', 'worker'}
    for row in fixture['observations']:
        assert row['allIds'] == ids and row['firstPageIds'] == ids[:30]


def visible_labels(root):
    return [value for node in root.iter() for value in
            (node.attrib.get('text', ''), node.attrib.get('content-desc', '')) if value]


def scroll_direction(bounds, viewport):
    """Ground direction in observed clipping; never scroll an above-screen target farther away."""
    _, top, _, bottom = bounds
    _, visible_top, _, visible_bottom = viewport
    if top < visible_top:
        return 'up'
    if bottom > visible_bottom:
        return 'down'
    return None


def observed_bounds(node):
    match = re.fullmatch(r'\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]', node.attrib.get('bounds', ''))
    return tuple(map(int, match.groups())) if match else (0, 0, 0, 0)


def ancestor_clip(node, parent, width, height):
    """Native clipping geometry, with no guessed header/footer percentages."""
    clip = (0, 0, width, height)
    current = node
    while current is not None:
        if current.attrib.get('visible-to-user') == 'false':
            return (0, 0, 0, 0)
        if current.tag != 'hierarchy':
            left, top, right, bottom = observed_bounds(current)
            if left >= right or top >= bottom:
                return (0, 0, 0, 0)
            clip = (max(clip[0], left), max(clip[1], top), min(clip[2], right), min(clip[3], bottom))
        current = parent.get(current)
    return clip


def scroll_ancestor(node, parent):
    current = parent.get(node)
    while current is not None:
        if current.attrib.get('class') == 'android.widget.ScrollView':
            return current
        current = parent.get(current)
    return None


def active_scroll(root, parent, width, height):
    candidates = [node for node in root.iter()
                  if node.attrib.get('class') == 'android.widget.ScrollView'
                  and node.attrib.get('scrollable') == 'true'
                  and (clip := ancestor_clip(node, parent, width, height))[0] < clip[2] and clip[1] < clip[3]]
    # Expo has a root ScrollView as well. Operate only on the deepest actual
    # scroll surface, and fail closed if two unrelated scroll surfaces remain.
    leaves = [node for node in candidates if not any(other is not node and other in set(node.iter()) for other in candidates)]
    if len(leaves) != 1:
        raise AssertionError('One actual native scroll surface required')
    return leaves[0]


def seek_control(read_tree, move, width, height, predicate, default='up', attempts=SCAN_LIMIT):
    """At most65 real moves plus a final observation; never blindly tap XML."""
    previous, unchanged = None, 0
    for attempt in range(attempts + 1):
        root, parent = read_tree()
        nodes = [node for node in root.iter() if predicate(node)]
        container = None
        direction, distance = default, None
        if nodes:
            node = nodes[-1]
            container = scroll_ancestor(node, parent)
            bounds = observed_bounds(node)
            clip = ancestor_clip(parent.get(node, node), parent, width, height)
            if (node.attrib.get('visible-to-user') != 'false'
                    and clip[0] <= bounds[0] < bounds[2] <= clip[2]
                    and clip[1] <= bounds[1] < bounds[3] <= clip[3]):
                return node, parent
            if container is not None and bounds[0] < bounds[2] and bounds[1] < bounds[3]:
                viewport = ancestor_clip(container, parent, width, height)
                direction = scroll_direction(bounds, viewport) or default
                distance = (viewport[1] - bounds[1] + 32 if direction == 'up'
                            else bounds[3] - viewport[3] + 32)
        if attempt == attempts:
            break
        container = container if container is not None else active_scroll(root, parent, width, height)
        viewport = ancestor_clip(container, parent, width, height)
        if viewport[0] >= viewport[2] or viewport[1] >= viewport[3]:
            raise AssertionError('Native scroll surface is clipped or hidden')
        current = hashlib.sha256(ET.tostring(container)).hexdigest()
        unchanged = unchanged + 1 if current == previous else 0
        if unchanged >= 3:
            raise AssertionError('Actual native scroll made no observable progress')
        previous = current
        move(direction, distance, viewport)
    raise AssertionError('Visible control unreachable after bounded actual scrolling')


def card_ids(root, title_ids):
    found = set()
    for node in root.iter():
        label = node.attrib.get('content-desc', '')
        if label.startswith('Otvorite priliku '):
            title = label[len('Otvorite priliku '):]
            if title not in title_ids:
                raise AssertionError('Unexpected public card outside the exact local fixture')
            found.add(title_ids[title])
    return found


def main(env=os.environ):
    assert_environment(env)  # Before filesystem writes, helper execution or any adb command.
    global PACKAGE, MAIN_ACTIVITY, PASSWORD, DB_URL, NEED_TITLE, NEED_ID
    global WORKER_USER_ID, REQUESTER_USER_ID, ARTIFACT_DIR
    PACKAGE, PASSWORD, DB_URL = env['RU5_DEVICE_PACKAGE'], env['RU5_DEVICE_PASSWORD'], env['RU5_DEVICE_DB_URL']
    MAIN_ACTIVITY = f'{PACKAGE}/.MainActivity'
    NEED_TITLE, NEED_ID = env['RU5_DEVICE_NEED_TITLE'], env['RU5_DEVICE_NEED_ID']
    WORKER_USER_ID, REQUESTER_USER_ID = env['RU5_DEVICE_WORKER_USER_ID'], env['RU5_DEVICE_REQUESTER_USER_ID']
    ARTIFACT_DIR = Path(env['RU5_DEVICE_ARTIFACT_DIR'])
    fixture = json.loads((ARTIFACT_DIR / 'shared-discovery-fixture.json').read_text(encoding='utf-8'))
    validate_fixture(fixture, env)
    helper = Path(__file__).with_name('ru5_android_device_ui_journey.py')
    definitions = ast.Module(body=[node for node in ast.parse(helper.read_text(encoding='utf-8')).body
                                  if isinstance(node, ast.FunctionDef)], type_ignores=[])
    exec(compile(definitions, str(helper), 'exec'), globals())
    title_ids = {row['title']: row['id'] for row in fixture['allPublic']}
    width, height = map(int, re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size').stdout)[-1])
    report = {'sourceSha': env['GITHUB_SHA'], 'localOnly': True,
              'historicalBoundary': fixture['historicalBoundary'], 'checkpoints': [], 'scans': {}, 'maps': {},
              'providerOfflineProven': False, 'productionProof': False,
              'manualOriginalMapReviewRequired': True, 'noClearBetweenActors': True}

    def checkpoint(name):
        shot(name)
        xml = (ARTIFACT_DIR / f'{name}.xml').read_text(encoding='utf-8')
        assert 'LOCAL_ONLY_PRIVATE_DISCOVERY' not in xml and 'LOCAL_PRIVATE_ACCESS_NOTE' not in xml
        report['checkpoints'].append({'name': name, **{suffix: hashlib.sha256(
            (ARTIFACT_DIR / f'{name}.{suffix}').read_bytes()).hexdigest() for suffix in ('png', 'xml')}})

    def tree():
        root, parent, _ = dump_tree()
        if dismiss_known_system_anr(root, parent):
            root, parent, _ = dump_tree()
        return root, parent

    def scroll(direction, distance=None, viewport=None):
        # FlatList padding outside the Map prevents a list scroll from panning its camera.
        if viewport is None:
            root, parent = tree()
            viewport = ancestor_clip(active_scroll(root, parent, width, height), parent, width, height)
        left, top, right, bottom = viewport
        visible_height = bottom - top
        x = left + int((right - left) * .035)
        low = top + int(visible_height * .86)
        high = low - (int(visible_height * .46) if distance is None
                      else min(int(visible_height * .46), max(int(visible_height * .1), distance)))
        start, end = (low, high) if direction == 'down' else (high, low)
        adb('shell', 'input', 'touchscreen', 'swipe', str(x), str(start), str(x), str(end), '420')
        time.sleep(.6)

    def seek(default='up', attempts=SCAN_LIMIT, **criteria):
        return seek_control(tree, scroll, width, height, lambda node: matches(node, **criteria), default, attempts)

    def press(default='up', **criteria):
        node, parent = seek(default=default, **criteria)
        tap_node(node, parent, hold_ms=160)

    def count(filtered, loaded):
        seek(text=f'{filtered} od {loaded} učitanih zadataka')

    def search(value):
        node, parent = seek(desc=SEARCH_LABEL)
        tap_node(node, parent, hold_ms=160)
        root, _ = tree()
        fields = ordered_edit_fields(root)
        index = next(i for i, field in enumerate(fields) if field.attrib.get('content-desc') == SEARCH_LABEL)
        if value:
            edit_text(index, value)
        else:
            adb('shell', 'input', 'keyboard', 'keycombination', '-t', '100', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A')
            adb('shell', 'input', 'keyevent', 'KEYCODE_DEL')
            time.sleep(.5)
            root, _ = tree()
            field = next(node for node in root.iter() if node.attrib.get('content-desc') == SEARCH_LABEL)
            assert field.attrib.get('text', '') in ('', 'Pretražite zadatke')
        hide_keyboard()

    def load_all(role):
        search('DISCOVERY_3')
        count(1, 30)
        press(default='down', desc='Učitajte još zadataka')
        count(5, 35)
        checkpoint(f'DISCOVERY_{role}_page35')
        search('')
        count(35, 35)

    def enumerate_cards(role):
        seek(desc=SEARCH_LABEL)
        found = set()
        for index in range(SCAN_LIMIT):
            checkpoint(f'DISCOVERY_{role}_scan_{index:02d}')
            root = ET.fromstring((ARTIFACT_DIR / f'DISCOVERY_{role}_scan_{index:02d}.xml').read_text(encoding='utf-8'))
            found.update(card_ids(root, title_ids))
            if found == set(title_ids.values()):
                report['scans'][role] = {'ids': sorted(found), 'originalPairs': index + 1}
                return
            scroll('down')
        raise AssertionError(f'Physical list did not expose the complete local set: {len(found)}/35')

    def map_ready(default='down'):
        node, parent = seek(default=default, desc=MAP_LABEL)
        bounds = parse_bounds(node.attrib.get('bounds'))
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            root, parent = tree()
            labels = visible_labels(root)
            if 'Mapa trenutno nije dostupna.' in labels:
                raise AssertionError('Actual provider/map renderer failed; no synthetic fallback acceptance')
            if 'Učitavamo mapu…' not in labels:
                current = [n for n in root.iter() if n.attrib.get('content-desc') == MAP_LABEL]
                assert len(current) == 1
                bounds = parse_bounds(current[0].attrib.get('bounds'))
                clip = ancestor_clip(parent.get(current[0], current[0]), parent, width, height)
                assert clip[0] <= bounds[0] < bounds[2] <= clip[2] and clip[1] <= bounds[1] < bounds[3] <= clip[3]
                time.sleep(1)
                return bounds
            time.sleep(.5)
        raise AssertionError('Actual map did not finish loading')

    def observe_map(name, bounds):
        checkpoint(name)
        observed = summarize_map(ARTIFACT_DIR / f'{name}.png', bounds)
        assert observed['sampled_colors'] >= 30, 'Flat background is not a rendered vector map'
        report['maps'][name] = observed
        return observed

    print('START SHARED_DISCOVERY_PHYSICAL_ANDROID real_ui real_local_auth no_business_commands', flush=True)
    launch_clean()
    login(env['RU5_DEVICE_REQUESTER_EMAIL'])
    wait_visible(desc='Istražite sve otvorene zadatke')
    checkpoint('DISCOVERY_requester_own')
    tap(desc='Istražite sve otvorene zadatke')
    count(30, 30)
    checkpoint('DISCOVERY_requester_list30')
    press(desc='Filteri')
    tap(text='Daljinski')
    tap(desc='Zatvorite filtere', prefer='bottom')
    count(30, 30)
    checkpoint('DISCOVERY_filter_cancel')
    press(desc='Filteri')
    tap(text='Daljinski')
    tap(text='Prikažite zadatke')
    count(1, 30)
    seek(default='down', desc=f"Otvorite priliku {fixture['plan'][2]['title']}")
    checkpoint('DISCOVERY_remote_filter')
    press(desc='Mapa')
    remote_bounds = map_ready()
    remote = observe_map('DISCOVERY_remote_map_no_pin', remote_bounds)
    assert remote['clusters'] == [] and remote['points'] == []
    press(desc='Lista')
    press(text='Poništite')
    count(30, 30)
    load_all('requester')
    enumerate_cards('requester')
    press(desc='Mapa')
    bounds = map_ready()
    initial = observe_map('DISCOVERY_map_cluster', bounds)
    assert len(initial['clusters']) == 1 and len(initial['points']) == 1
    x, y = initial['clusters'][0]['center']
    adb('shell', 'input', 'tap', str(x), str(y))
    deadline = time.monotonic() + 25
    expanded = None
    while time.monotonic() < deadline:
        time.sleep(1)
        shot('DISCOVERY_cluster_probe')
        observed = summarize_map(ARTIFACT_DIR / 'DISCOVERY_cluster_probe.png', bounds)
        if not observed['clusters'] and len(observed['points']) == 2:
            expanded = observe_map('DISCOVERY_cluster_expanded', bounds)
            break
    assert expanded is not None, 'Observed cluster tap did not produce two actual separate map points'
    x, y = expanded['points'][0]['center']
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(1)
    seek(default='down', text='Izabrani zadatak')
    root, _ = tree()
    choices = card_ids(root, title_ids)
    if not choices:
        seek(default='down', contains='Otvorite priliku ')
        root, _ = tree()
        choices = card_ids(root, title_ids)
    assert len(choices) == 1 and choices.issubset({row['id'] for row in fixture['plan'][:2]})
    selected_id = next(iter(choices))
    selected_title = next(title for title, identifier in title_ids.items() if identifier == selected_id)
    bounds = map_ready(default='up')
    observe_map('DISCOVERY_pin_selected', bounds)
    press(default='down', desc=f'Otvorite priliku {selected_title}')
    wait_visible(desc='Nazad na Zadatke')
    wait_visible(text=selected_title)
    checkpoint('DISCOVERY_task_detail')
    tap(desc='Nazad na Zadatke')
    node, _ = seek(desc='Mapa')
    assert node.attrib.get('selected') == 'true', 'Back lost map presentation mode'
    count(35, 35)
    back_bounds = map_ready()
    observe_map('DISCOVERY_map_back', back_bounds)
    report['cameraBack'] = compare_map_regions(ARTIFACT_DIR / 'DISCOVERY_pin_selected.png', bounds,
        ARTIFACT_DIR / 'DISCOVERY_map_back.png', back_bounds)
    seek(default='down', desc=f'Otvorite priliku {selected_title}')
    report['selectedTaskId'] = selected_id
    press(text='Moji zadaci')
    tap(desc='Profil', prefer='top')
    tap(desc='Odjavite se')
    assert_signed_out_surface(form_open=True)
    checkpoint('DISCOVERY_signed_out')
    # Actual logout/login, no pm clear, force stop or session injection between these actors.
    login(env['RU5_DEVICE_WORKER_EMAIL'], form_open=True)
    wait_visible(text='Još nemate Zadatak')
    tap(desc='Profil', prefer='top')
    tap(desc='Pređite na JA MOGU')
    count(30, 30)
    checkpoint('DISCOVERY_worker_list30')
    load_all('worker')
    enumerate_cards('worker')
    assert report['scans']['requester']['ids'] == report['scans']['worker']['ids']
    press(desc='Mapa')
    worker_map = observe_map('DISCOVERY_worker_map', map_ready())
    assert len(worker_map['clusters']) == 1 and len(worker_map['points']) == 1
    assert set(CHECKPOINTS).issubset({row['name'] for row in report['checkpoints']})
    (ARTIFACT_DIR / 'shared-discovery-journey.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('PASS SHARED_DISCOVERY_PHYSICAL_ANDROID two_real_actors same35_ids list_map cluster_expands '
          'pin_detail_back raster_camera_retained filter_cancel_apply remote_no_pin pagination '
          'original_map_review_required provider_offline_not_proven', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never stringify subprocess errors: argv may contain the masked fixture password.
        print(f'SHARED_DISCOVERY_PHYSICAL_FAILED {type(error).__name__}', flush=True)
        for frame in traceback.extract_tb(error.__traceback__)[-4:]:
            print(f'FAILURE_FRAME {Path(frame.filename).name}:{frame.lineno} {frame.name}', flush=True)
        raise SystemExit(1) from None
