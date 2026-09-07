"""Focused evidence/geometry regressions; synthetic pixels are never device evidence."""
import copy
import importlib
import json
import struct
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
journey = importlib.import_module('shared_discovery_android_journey')
pixels = importlib.import_module('shared_discovery_map_pixels')
validator = importlib.import_module('shared_discovery_validate')


def chunk(kind, raw):
    return struct.pack('>I', len(raw)) + kind + raw + struct.pack('>I', zlib.crc32(kind + raw))


def png(width, height, color_at, method=0, channels=4):
    previous, encoded = bytes(width * channels), bytearray()
    for y in range(height):
        row = bytes(component for x in range(width) for component in color_at(x, y)[:channels])
        encoded.append(method)
        for index, value in enumerate(row):
            left = row[index - channels] if index >= channels else 0
            up = previous[index]
            upper = previous[index - channels] if index >= channels else 0
            if method == 4:
                p = left + up - upper
                distances = (abs(p - left), abs(p - up), abs(p - upper))
                prediction = (left, up, upper)[distances.index(min(distances))]
            else:
                prediction = (0, left, up, (left + up) // 2)[method]
            encoded.append((value - prediction) & 255)
        previous = row
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6 if channels == 4 else 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(encoded)) + chunk(b'IEND', b''))


def background(x, y):
    return ((x * 7 + y) % 256, (y * 13 + x * 3) % 256, (x * 5 + y * 9) % 256, 255)


def environment():
    return {'RU5_DEVICE_SUPABASE_URL': 'http://127.0.0.1:54321',
            'RU5_DEVICE_DB_URL': 'postgresql://postgres:fixture@127.0.0.1:54322/postgres',
            'RU5_DEVICE_PACKAGE': 'rs.uskoci.n04proof', 'GITHUB_SHA': 'a' * 40,
            'RU5_DEVICE_REQUESTER_USER_ID': '11111111-1111-4111-8111-111111111111',
            'RU5_DEVICE_WORKER_USER_ID': '22222222-2222-4222-8222-222222222222',
            'RU5_DEVICE_NEED_ID': '33333333-3333-4333-8333-333333333333',
            'RU5_DEVICE_ARTIFACT_DIR': 'artifacts/shared-discovery-unit-test'}


def reports():
    env = environment()
    rows = [{'id': f'00000000-0000-4000-8000-{index:012d}', 'title': f'LOCAL_{index}'} for index in range(35)]
    fixture = {'sourceSha': env['GITHUB_SHA'], 'localOnly': True, 'publicationProof': False, 'providerProof': False,
               'requesterId': env['RU5_DEVICE_REQUESTER_USER_ID'], 'workerId': env['RU5_DEVICE_WORKER_USER_ID'],
               'history': {'count': 79, 'head': '20260906141409'}, 'plan': rows[:34], 'allPublic': rows,
               'historicalBoundary': 'historical79 plus exact N02/N03', 'beforeJourney': {'full': 'row hash'},
               'observations': [{'role': role, 'allIds': [row['id'] for row in rows],
                                 'firstPageIds': [row['id'] for row in rows[:30]]} for role in ('requester', 'worker')]}
    checkpoints = list(journey.CHECKPOINTS) + ['DISCOVERY_requester_scan_00', 'DISCOVERY_worker_scan_00']
    map_names = ('DISCOVERY_remote_map_no_pin', 'DISCOVERY_map_cluster', 'DISCOVERY_worker_map',
                 'DISCOVERY_cluster_expanded', 'DISCOVERY_pin_selected', 'DISCOVERY_map_back')
    maps = {name: {'sampled_colors': 80, 'region_sha256': 'b' * 64, 'clusters': [], 'points': []} for name in map_names}
    for name in ('DISCOVERY_map_cluster', 'DISCOVERY_worker_map'):
        maps[name].update(clusters=[{'center': [1, 2]}], points=[{'center': [3, 4]}])
    maps['DISCOVERY_cluster_expanded']['points'] = [{'center': [1, 2]}, {'center': [3, 4]}]
    report = {'sourceSha': env['GITHUB_SHA'], 'localOnly': True, 'productionProof': False,
              'providerOfflineProven': False, 'manualOriginalMapReviewRequired': True, 'noClearBetweenActors': True,
              'historicalBoundary': fixture['historicalBoundary'], 'checkpoints': [{'name': name} for name in checkpoints],
              'scans': {role: {'ids': sorted(row['id'] for row in rows), 'originalPairs': 1} for role in ('requester', 'worker')},
              'maps': maps, 'selectedTaskId': rows[0]['id'], 'cameraBack': {'mean_channel_delta': 0, 'fraction_within16': 1}}
    postflight = {'sourceSha': env['GITHUB_SHA'], 'localOnly': True, 'businessRowsUnchanged': True,
                  'historyUnchanged': True, 'tables': fixture['beforeJourney']}
    return fixture, report, postflight


class LocalAdmissionTests(unittest.TestCase):
    def test_exact_loopback_and_both_spelling_roots(self):
        env = environment()
        journey.assert_environment(env)
        env['RU5_DEVICE_SUPABASE_URL'] += '/'
        journey.assert_environment(env)

    def test_rejects_production_lookalikes_and_redirect_query_before_adb(self):
        for url in ('https://example.supabase.co', 'http://127.0.0.1:54321.evil.invalid',
                    'http://127.0.0.1:54321?host=production', 'http://user@127.0.0.1:54321',
                    'http://localhost:54321', 'http://127.0.0.1:54321/rest/v1'):
            with self.subTest(url=url), patch.object(journey, 'adb', create=True) as adb:
                env = environment(); env['RU5_DEVICE_SUPABASE_URL'] = url
                with self.assertRaises(ValueError):
                    journey.main(env)
                adb.assert_not_called()

    def test_db_package_and_actor_scope_cannot_drift(self):
        cases = [('RU5_DEVICE_DB_URL', 'postgresql://postgres:x@remote.invalid:54322/postgres'),
                 ('RU5_DEVICE_DB_URL', 'postgresql://postgres:x@127.0.0.1:54322/postgres?host=remote.invalid'),
                 ('RU5_DEVICE_PACKAGE', 'rs.uskoci.preview'), ('GITHUB_SHA', 'a' * 40 + '\n'),
                 ('RU5_DEVICE_REQUESTER_USER_ID', environment()['RU5_DEVICE_REQUESTER_USER_ID'] + '\n'),
                 ('RU5_DEVICE_WORKER_USER_ID', environment()['RU5_DEVICE_REQUESTER_USER_ID'])]
        for key, value in cases:
            with self.subTest(key=key):
                env = environment(); env[key] = value
                with self.assertRaises(ValueError):
                    journey.assert_environment(env)

    def test_fixture_admission_requires_actual_both_actor_page_ids_and_history(self):
        fixture, _, _ = reports()
        journey.validate_fixture(fixture, environment())
        for mutate in (lambda value: value['observations'][1]['allIds'].pop(),
                       lambda value: value['observations'][0]['firstPageIds'].reverse(),
                       lambda value: value['history'].update(count=87),
                       lambda value: value.update(sourceSha='b' * 40),
                       lambda value: value['allPublic'].__setitem__(1, value['allPublic'][0])):
            changed = copy.deepcopy(fixture); mutate(changed)
            with self.assertRaises(AssertionError):
                journey.validate_fixture(changed, environment())


class OriginalPixelTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def save(self, name, raw):
        path = self.directory / name; path.write_bytes(raw); return path

    def test_every_png_filter_and_rgb_rgba_reconstruct_original_pixels(self):
        for channels in (3, 4):
            expected = bytes(c for y in range(19) for x in range(23) for c in background(x, y)[:channels])
            for method in range(5):
                with self.subTest(channels=channels, method=method):
                    original = png(23, 19, background, method, channels)
                    path = self.save('original.png', original)
                    image = pixels.read_png(path)
                    self.assertEqual(image[:3], (23, 19, channels))
                    self.assertEqual(image[3], expected)
                    self.assertEqual(path.read_bytes(), original, 'Analysis may not rewrite original evidence')

    def test_rejects_truncated_bad_crc_and_unsupported_depth(self):
        raw = png(12, 10, background)
        unsupported = (raw[:8] + chunk(b'IHDR', struct.pack('>IIBBBBB', 12, 10, 16, 6, 0, 0, 0)) + raw[33:])
        for value in (b'not png', raw[:20], raw[:-18], raw[:-12], raw + b'junk', raw[:45] + bytes([raw[45] ^ 1]) + raw[46:], unsupported):
            with self.subTest(length=len(value)), self.assertRaises((ValueError, struct.error)):
                pixels.read_png(self.save('invalid.png', value))

    def test_clusters_points_are_inside_observed_region_not_neighboring_buttons(self):
        def color(x, y):
            if (x - 45) ** 2 + (y - 60) ** 2 <= 15 ** 2:
                return (20, 47, 48, 255)
            if (x - 102) ** 2 + (y - 68) ** 2 <= 10 ** 2 or (x - 145) ** 2 + (y - 15) ** 2 <= 10 ** 2:
                return (250, 107, 50, 255)
            return background(x, y)
        path = self.save('map.png', png(170, 140, color))
        observed = pixels.summarize_map(path, (15, 30, 135, 125))
        self.assertGreater(observed['sampled_colors'], 30)
        self.assertEqual([row['center'] for row in observed['clusters']], [[45, 60]])
        self.assertEqual([row['center'] for row in observed['points']], [[102, 68]])

    def test_blank_map_cannot_satisfy_render_color_check(self):
        path = self.save('blank.png', png(150, 150, lambda x, y: (237, 240, 234, 255)))
        observed = pixels.summarize_map(path, (10, 10, 140, 140))
        self.assertEqual(observed['sampled_colors'], 1)
        self.assertEqual(observed['clusters'], [])
        self.assertEqual(observed['points'], [])

    def test_same_camera_region_can_move_vertically_in_original_screen(self):
        first = self.save('before.png', png(160, 160, background))
        second = self.save('after.png', png(160, 190, lambda x, y: background(x, y - 20)))
        result = pixels.compare_map_regions(first, (10, 30, 150, 140), second, (10, 50, 150, 160))
        self.assertEqual(result['mean_channel_delta'], 0)

    def test_changed_camera_pixels_or_dimensions_cannot_be_relabelled_retained(self):
        first = self.save('before.png', png(160, 160, background))
        second = self.save('after.png', png(160, 160, lambda x, y: background(x + 19, y + 5)))
        with self.assertRaises(AssertionError):
            pixels.compare_map_regions(first, (10, 10, 150, 150), second, (10, 10, 150, 150))
        with self.assertRaises(AssertionError):
            pixels.compare_map_regions(first, (10, 10, 150, 150), first, (10, 10, 140, 150))

    def test_outside_image_region_fails_without_clamping(self):
        image = pixels.read_png(self.save('original.png', png(20, 20, background)))
        for bounds in ((-1, 0, 20, 20), (0, 0, 21, 20), (0, 3, 0, 15)):
            with self.assertRaises(ValueError):
                pixels.region(image, bounds)


class UIAndEvidenceTests(unittest.TestCase):
    def original_failure_tree(self):
        # Geometry/classes are exact from original run34165455214 failure XML.
        # All text, account/task IDs, resource IDs and unrelated labels removed.
        root = ET.parse(Path(__file__).parent / 'fixtures' / 'shared-discovery-map-visible-34165455214.xml').getroot()
        parent = {child: node for node in root.iter() for child in node}
        return root, parent

    def test_original_visible_map_above_old_percentage_is_found_without_scrolling(self):
        root, parent = self.original_failure_tree()
        target = next(node for node in root.iter() if node.attrib.get('content-desc') == 'Mapa')
        self.assertEqual(journey.observed_bounds(target), (548, 320, 1007, 446))
        self.assertEqual(journey.scroll_direction(journey.observed_bounds(target), (0, 384, 1080, 2064)), 'up')
        with patch.object(journey, 'scroll', create=True) as move:
            found, _ = journey.seek_control(lambda: (root, parent), move, 1080, 2400,
                                           lambda node: node.attrib.get('content-desc') == 'Mapa')
        self.assertIs(found, target)
        move.assert_not_called()
        actual_scroll = journey.active_scroll(root, parent, 1080, 2400)
        self.assertIs(actual_scroll, journey.scroll_ancestor(target, parent))
        self.assertEqual(journey.ancestor_clip(actual_scroll, parent, 1080, 2400), (0, 307, 1080, 2101))
        allowed = {'class', 'bounds', 'clickable', 'enabled', 'selected', 'scrollable', 'visible-to-user', 'content-desc'}
        for node in root.iter():
            self.assertTrue(set(node.attrib).issubset(allowed))
            self.assertIn(node.attrib.get('content-desc'), (None, 'Mapa', 'Lista'))

    def test_actually_clipped_control_scrolls_inside_its_observed_container(self):
        for bounds, direction in (('[548,230][1007,356]', 'up'), ('[548,2070][1007,2196]', 'down')):
            with self.subTest(bounds=bounds):
                clipped, parents = self.original_failure_tree()
                target = next(node for node in clipped.iter() if node.attrib.get('content-desc') == 'Mapa')
                target.set('bounds', bounds)
                final = self.original_failure_tree()
                with patch.object(journey, 'scroll', create=True) as move:
                    found, _ = journey.seek_control(iter(((clipped, parents), final)).__next__, move, 1080, 2400,
                                                   lambda node: node.attrib.get('content-desc') == 'Mapa')
                self.assertEqual(found.attrib['bounds'], '[548,320][1007,446]')
                self.assertEqual(move.call_count, 1)
                self.assertEqual(move.call_args.args[0], direction)
                self.assertEqual(move.call_args.args[2], (0, 307, 1080, 2101))

    def test_return_from_long_list_has_scan_sized_budget_and_final_observation(self):
        for required_moves in (40, journey.SCAN_LIMIT):
            with self.subTest(required_moves=required_moves):
                moves = []
                def read_tree():
                    root, parent = self.original_failure_tree()
                    if len(moves) < required_moves:
                        for node in root.iter():
                            if node.attrib.get('content-desc') == 'Mapa':
                                del node.attrib['content-desc']
                        container = journey.active_scroll(root, parent, 1080, 2400)
                        ET.SubElement(container, 'node', {'bounds': '[63,700][1017,900]',
                                                        'text': f'Local page {len(moves)}'})
                    return root, {child: node for node in root.iter() for child in node}
                found, _ = journey.seek_control(read_tree, lambda *args: moves.append(args), 1080, 2400,
                                               lambda node: node.attrib.get('content-desc') == 'Mapa')
                self.assertEqual(found.attrib['content-desc'], 'Mapa')
                self.assertEqual(len(moves), required_moves)
                self.assertTrue(all(move[0] == 'up' and move[2] == (0, 307, 1080, 2101) for move in moves))

    def test_stalled_native_scroll_fails_early_without_blind_tap(self):
        root, parent = self.original_failure_tree()
        with patch.object(journey, 'scroll', create=True) as move:
            with self.assertRaisesRegex(AssertionError, 'no observable progress'):
                journey.seek_control(lambda: (root, parent), move, 1080, 2400,
                                     lambda node: node.attrib.get('content-desc') == 'Missing control')
        self.assertEqual(move.call_count, 3)

    def test_unlaid_out_xml_does_not_invent_upward_geometry_for_downward_search(self):
        root, parent = self.original_failure_tree()
        target = next(node for node in root.iter() if node.attrib.get('content-desc') == 'Mapa')
        target.set('bounds', '[0,0][0,0]')
        final = self.original_failure_tree()
        with patch.object(journey, 'scroll', create=True) as move:
            journey.seek_control(iter(((root, parent), final)).__next__, move, 1080, 2400,
                                 lambda node: node.attrib.get('content-desc') == 'Mapa', default='down')
        self.assertEqual(move.call_args.args, ('down', None, (0, 307, 1080, 2101)))

    def test_hidden_or_ambiguous_scroll_surface_cannot_authorize_motion(self):
        root, parent = self.original_failure_tree()
        container = journey.active_scroll(root, parent, 1080, 2400)
        container.set('visible-to-user', 'false')
        with self.assertRaises(AssertionError):
            journey.active_scroll(root, parent, 1080, 2400)
        other = ET.SubElement(root, 'node', {'class': 'android.widget.ScrollView', 'scrollable': 'true',
                                           'bounds': '[0,307][1080,2101]'})
        container.attrib.pop('visible-to-user')
        parent[other] = root
        with self.assertRaises(AssertionError):
            journey.active_scroll(root, parent, 1080, 2400)

    def test_raw_xml_and_png_must_independently_reproduce_report_not_just_declared_ids(self):
        fixture, report, _ = reports()
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory)
            root = ET.Element('hierarchy')
            for row in fixture['allPublic']:
                ET.SubElement(root, 'node', {'content-desc': f"Otvorite priliku {row['title']}"})
            original_xml = ET.tostring(root)
            for role in ('requester', 'worker'):
                (artifact / f'DISCOVERY_{role}_scan_00.xml').write_bytes(original_xml)
            for name in report['maps']:
                path = artifact / f'{name}.png'
                path.write_bytes(png(100, 100, background))
                report['maps'][name] = pixels.summarize_map(path, (10, 10, 90, 90))
            report['cameraBack'] = pixels.compare_map_regions(artifact / 'DISCOVERY_pin_selected.png',
                (10, 10, 90, 90), artifact / 'DISCOVERY_map_back.png', (10, 10, 90, 90))
            validator.validate_original_observations(artifact, fixture, report)
            (artifact / 'DISCOVERY_worker_scan_00.xml').write_bytes(b'<hierarchy/>')
            with self.assertRaises(AssertionError):
                validator.validate_original_observations(artifact, fixture, report)
            (artifact / 'DISCOVERY_worker_scan_00.xml').write_bytes(original_xml)
            (artifact / 'DISCOVERY_map_cluster.png').write_bytes(png(100, 100, lambda x, y: background(x + 1, y)))
            with self.assertRaises(AssertionError):
                validator.validate_original_observations(artifact, fixture, report)

    def test_clipped_above_geometry_scrolls_up_and_below_scrolls_down(self):
        viewport = (0, 350, 1080, 2050)
        self.assertEqual(journey.scroll_direction((60, 100, 1020, 1100), viewport), 'up')
        self.assertEqual(journey.scroll_direction((60, 1550, 1020, 2550), viewport), 'down')
        self.assertIsNone(journey.scroll_direction((60, 550, 1020, 1550), viewport))

    def test_card_ids_require_real_card_accessibility_label_and_exact_fixture_title(self):
        root = ET.fromstring('<hierarchy><node text="LOCAL_1"/><node content-desc="Otvorite priliku LOCAL_2"/></hierarchy>')
        self.assertEqual(journey.card_ids(root, {'LOCAL_1': 'a', 'LOCAL_2': 'b'}), {'b'})
        with self.assertRaises(AssertionError):
            journey.card_ids(root, {'LOCAL_1': 'a'})

    def test_validation_requires_original27_and_separate_manual_map_review(self):
        self.assertEqual(len(validator.INHERITED), 27)
        fixture, report, postflight = reports()
        validator.validate_report(fixture, report, postflight)
        for mutate in (lambda value: value.update(manualOriginalMapReviewRequired=False),
                       lambda value: value.update(providerOfflineProven=True),
                       lambda value: value['scans']['worker']['ids'].pop(),
                       lambda value: value['checkpoints'].pop(),
                       lambda value: value['cameraBack'].update(mean_channel_delta=25),
                       lambda value: value['maps']['DISCOVERY_remote_map_no_pin']['points'].append({'center': [1, 2]}),
                       lambda value: value['maps']['DISCOVERY_map_cluster'].update(sampled_colors=1)):
            changed = copy.deepcopy(report); mutate(changed)
            with self.assertRaises(AssertionError):
                validator.validate_report(fixture, changed, postflight)

    def test_postflight_full_row_or_source_mismatch_fails(self):
        fixture, report, postflight = reports()
        for update in ({'sourceSha': 'c' * 40}, {'tables': {'full': 'changed row'}}, {'businessRowsUnchanged': False}):
            with self.subTest(update=update), self.assertRaises(AssertionError):
                validator.validate_report(fixture, report, {**postflight, **update})

    def test_artifact_relative_paths_cannot_escape_repo(self):
        self.assertEqual(validator.relative_source('src/app/(app)/prilike.tsx'), 'src/app/(app)/prilike.tsx')
        for value in ('../secret', '/tmp/secret', 'C:/secret', 'src\\secret'):
            with self.assertRaises(ValueError):
                validator.relative_source(value)


if __name__ == '__main__':
    unittest.main()
