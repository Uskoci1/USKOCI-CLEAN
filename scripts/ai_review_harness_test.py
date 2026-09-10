"""Proof assertion regressions; these are not substituted for Android pixels."""
import copy
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET
from unittest.mock import Mock, patch
from scripts import ai_review_android_journey as journey

journey.load_shared_helpers()


def tree(xml):
    root = ET.fromstring(xml)
    return root, {child: p for p in root.iter() for child in p}


class NativeAssertions(unittest.TestCase):
    def test_disabled_save_is_checked_on_actual_control_not_an_ancestor(self):
        root, parents = tree('<hierarchy><node clickable="true" enabled="true"><node content-desc="Sačuvajte nacrt" enabled="false" clickable="false" bounds="[10,20][80,70]"/></node></hierarchy>')
        journey.assert_button(root, parents, 'Sačuvajte nacrt', False)
        with self.assertRaises(AssertionError):
            journey.assert_button(root, parents, 'Sačuvajte nacrt', True)

    def test_duplicate_or_absent_save_is_not_a_disabled_success(self):
        for content in ('', '<node content-desc="Sačuvajte nacrt" enabled="false"/><node content-desc="Sačuvajte nacrt" enabled="false"/>'):
            root, parents = tree(f'<hierarchy>{content}</hierarchy>')
            with self.assertRaises(AssertionError):
                journey.assert_button(root, parents, 'Sačuvajte nacrt', False)

    def test_card_text_must_fit_screen_and_actual_scroll_clip(self):
        root, parents = tree('<hierarchy><node scrollable="true" bounds="[0,100][1080,2200]"><node text="full" bounds="[50,120][1000,180]"/><node text="clipped" bounds="[50,2180][1000,2250]"/><node text="overflow" bounds="[50,130][1120,180]"/></node></hierarchy>')
        nodes = [n for n in root.iter() if n.attrib.get('text')]
        self.assertTrue(journey.visible_node(nodes[0], parents, 1080, 2400))
        self.assertFalse(journey.visible_node(nodes[1], parents, 1080, 2400))
        self.assertFalse(journey.visible_node(nodes[2], parents, 1080, 2400))
        self.assertFalse(journey.visible_node(root, parents, 1080, 2400))

    def test_schedule_checks_both_dates_times_and_timezone(self):
        start, end = '2026-09-14T07:00:00Z', '2026-09-14T09:00:00Z'
        journey.assert_schedule_label('14. 9. 2026. 09:00:00 CEST – 14. 9. 2026. 11:00:00 GMT+2', start, end)
        for text in ('14. 9. 2026. 09:00 CEST', '14. 9. 2026. 09:00 – 14. 9. 2026. 11:00',
                     '14. 9. 2026. 07:00 GMT+2 – 14. 9. 2026. 09:00 GMT+2',
                     '14. 9. 2026. 09:00 GMT+2 – 15. 9. 2026. 11:00 GMT+2',
                     '14. 9. 2026. 09:00 GMT+20 – 14. 9. 2026. 11:00 GMT+20'):
            with self.subTest(text=text), self.assertRaises(AssertionError):
                journey.assert_schedule_label(text, start, end)

    def test_schedule_dst_uses_actual_endpoint_offsets(self):
        journey.assert_schedule_label('25. 10. 2026. 02:30 CEST – 25. 10. 2026. 03:30 CET',
                                      '2026-10-25T00:30:00Z', '2026-10-25T02:30:00Z')

    def test_seek_waits_on_disabled_control_without_scrolling_or_tapping(self):
        disabled, dp = tree('<hierarchy><node content-desc="Potvrdite: Vozilo" enabled="false" bounds="[10,20][200,80]"/></hierarchy>')
        active, ap = tree('<hierarchy><node content-desc="Potvrdite: Vozilo" enabled="true" bounds="[10,20][200,80]"/></hierarchy>')
        with patch.object(journey, 'clean_surface', side_effect=[(disabled, dp), (active, ap)]), patch.object(journey, 'screen_size', return_value=(1080, 2400)), patch.object(journey, 'scroll_once') as scroll, patch.object(journey.time, 'sleep'):
            root, _, node = journey.seek('Proverite Zadatak', desc='Potvrdite: Vozilo', enabled=True)
        self.assertIs(root, active)
        self.assertEqual(node.attrib['enabled'], 'true')
        scroll.assert_not_called()

    def test_scrolling_conversation_anchors_real_fixed_input(self):
        self.assertEqual(journey.anchor_criteria('Novi zadatak'), {'desc': 'Poruka za AI'})
        self.assertEqual(journey.anchor_criteria('Proverite Zadatak'), {'text': 'Proverite Zadatak'})

    def test_retained_review_position_scrolls_up_from_original_failure_geometry_before_tap(self):
        # Synthetic regression of the retained PR59 clipped geometry, not pixels.
        clipped, cp = tree('<hierarchy><node scrollable="true" bounds="[0,307][1080,2101]"><node content-desc="Izmenite: Ljudi" enabled="true" clickable="true" bounds="[353,307][655,269]"/></node></hierarchy>')
        original = next(n for n in clipped.iter() if n.attrib.get('content-desc') == 'Izmenite: Ljudi')
        self.assertEqual(original.attrib['bounds'], '[353,307][655,269]')
        self.assertFalse(journey.visible_node(original, cp, 1080, 2400))
        visible = copy.deepcopy(clipped)
        target = next(n for n in visible.iter() if n.attrib.get('content-desc') == 'Izmenite: Ljudi')
        target.attrib['bounds'] = '[353,500][655,616]'
        vp = {child: parent for parent in visible.iter() for child in parent}
        with patch.object(journey, 'clean_surface', side_effect=[(clipped, cp), (visible, vp)]), patch.object(journey, 'screen_size', return_value=(1080, 2400)), patch.object(journey, 'scroll_once') as scroll, patch.object(journey, 'tap_node') as tap:
            journey.press_in_review('Izmenite: Ljudi')
        scroll.assert_called_once_with(clipped, 'up')
        tap.assert_called_once_with(target, vp, hold_ms=120)

    def test_observed_below_clip_overrides_up_hint_without_accepting_inverted_bounds(self):
        clipped, cp = tree('<hierarchy><node scrollable="true" bounds="[0,307][1080,2101]"><node content-desc="Potvrdite: Vozilo" enabled="true" bounds="[676,2200][993,2101]"/></node></hierarchy>')
        visible, vp = tree('<hierarchy><node scrollable="true" bounds="[0,307][1080,2101]"><node content-desc="Potvrdite: Vozilo" enabled="true" bounds="[676,700][993,816]"/></node></hierarchy>')
        with patch.object(journey, 'clean_surface', side_effect=[(clipped, cp), (visible, vp)]), patch.object(journey, 'screen_size', return_value=(1080, 2400)), patch.object(journey, 'scroll_once') as scroll:
            result, _, _ = journey.seek('Proverite Zadatak', desc='Potvrdite: Vozilo', direction='up', enabled=True)
        self.assertIs(result, visible)
        scroll.assert_called_once_with(clipped, 'down')


class PersistedAssertions(unittest.TestCase):
    def setUp(self):
        self.fixture = {'accountId': 'owner', 'profileId': 'profile', 'conversationId': 'conversation', 'proposals': [
            {'key': 'need.title', 'value': 'generic'}, {'key': 'need.description', 'value': 'synthetic'},
            {'key': 'need.category', 'value': 'pomoc'}, {'key': 'need.task_geography', 'value': {'mode': 'POINT_TO_POINT', 'start': {'city':'Novi Sad','area':'Centar'}, 'end': {'city':'Novi Sad','area':'Liman'}}},
            {'key': 'need.starts_at', 'value': '2026-09-14T07:00:00Z'}, {'key': 'need.ends_at', 'value': '2026-09-14T09:00:00Z'}]}
        current = {'id': 'new', 'fact_key': 'need.people_needed', 'fact_value': 3, 'source': 'EXPLICIT_USER_ANSWER',
                   'status': 'CONFIRMED', 'confirmed_by_user_id': 'owner', 'confirmed_at': 'time', 'superseded_at': None}
        old = {**current, 'id': 'old', 'fact_value': 2, 'source': 'AI_INFERENCE', 'status': 'NEEDS_CONFIRMATION',
               'superseded_at': 'time', 'superseded_by': 'new'}
        facts = [old, current, *[{**current, 'id': f'f{i}', 'fact_key': f'need.key{i}'} for i in range(10)]]
        self.state = {'accountId': 'owner', 'conversationId': 'conversation', 'facts': facts,
            'review': {'boundNeedId': 'need'}, 'receipts': [{'need_id': 'need', 'conversation_id': 'conversation'}],
            'needs': [{'id': 'need', 'requester_account_id': 'owner', 'requester_profile_id': 'profile', 'status': 'DRAFT',
                       'task_country_code': 'RS', 'mode': 'OFFERS', 'requester_price_rsd': None, 'title': 'generic', 'description': 'synthetic', 'category': 'pomoc',
                       'required_slots': 3, 'schedule_kind': 'FIXED_WINDOW', 'required_vehicles': ['Kombi'],
                       'public_topology': {'mode': 'POINT_TO_POINT', 'start': {'city':'Novi Sad','area':'Centar'}, 'end': {'city':'Novi Sad','area':'Liman'}}, 'starts_at': '2026-09-14T09:00:00+02:00', 'ends_at': '2026-09-14T11:00:00+02:00'}]}

    def test_one_owned_draft_matches_typed_input_and_real_confirmation(self):
        self.assertEqual(journey.assert_saved(self.state, self.fixture)['id'], 'need')

    def test_rejects_duplicate_save_wrong_owner_lost_vehicle_unconfirmed_fact_or_price(self):
        mutations = [lambda x: x['needs'].append(copy.deepcopy(x['needs'][0])),
                     lambda x: x['receipts'].append(copy.deepcopy(x['receipts'][0])),
                     lambda x: x['needs'][0].update(requester_account_id='another-owner'),
                     lambda x: x['needs'][0].update(required_vehicles=[]),
                     lambda x: x['needs'][0].update(requester_price_rsd=3000),
                     lambda x: x['facts'][2].update(status='NEEDS_CONFIRMATION'),
                     lambda x: x['facts'][1].update(fact_value='3'),
                     lambda x: x['facts'][0].update(superseded_by='unrelated')]
        for change in mutations:
            with self.subTest(change=mutations.index(change)):
                state = copy.deepcopy(self.state); change(state)
                with self.assertRaises(AssertionError):
                    journey.assert_saved(state, self.fixture)



"""Local-target and restoration regressions, not substitutes for physical proof."""
import unittest
from unittest.mock import Mock
from scripts.ai_review_local_rest import LocalRestOutage, validate_container, validate_local_targets

ENV = {'RU5_DEVICE_SUPABASE_URL': 'http://127.0.0.1:54321',
       'RU5_DEVICE_DB_URL': 'postgresql://postgres:local-test@127.0.0.1:54322/postgres',
       'RU5_DEVICE_PACKAGE': 'rs.uskoci.n04proof', 'RU5_DEVICE_PROOF_DIR': '/tmp/uskoci-ru5-device-ui'}
IDENTITY = ['a' * 64, '/supabase_rest_uskoci-ru5-device-ui', 'public.ecr.aws/supabase/postgrest:v14.4', True]


class LocalRestSafety(unittest.TestCase):
    def test_accepts_exact_proof_targets(self):
        validate_local_targets(ENV)
        self.assertEqual(validate_container(IDENTITY, expected_running=True), 'a' * 64)

    def test_accepts_observed_cli_ghcr_postgrest_without_broadening_container_scope(self):
        # Original run34131247295 pulled this exact image; the old guard rejected it before stop.
        observed = [*IDENTITY[:2], 'ghcr.io/supabase/postgrest:v16.1', True]
        self.assertEqual(validate_container(observed, expected_running=True), 'a' * 64)
        self.assertEqual(validate_container([*observed[:3], False], expected_running=False,
                                           expected_id='a' * 64), 'a' * 64)

    def test_rejects_ghcr_registry_namespace_image_and_tag_spoofs(self):
        for image in ('ghcr.io.attacker.invalid/supabase/postgrest:v16.1',
                      'ghcr.io/other/postgrest:v16.1', 'ghcr.io/supabase/postgres:v16.1',
                      'ghcr.io/supabase/postgrest:v16.1/other', 'ghcr.io/supabase/postgrest'):
            with self.subTest(image=image), self.assertRaises(RuntimeError):
                validate_container([*IDENTITY[:2], image, True], expected_running=True)

    def test_rejects_remote_or_redirected_targets_without_exposing_credentials(self):
        cases = [
            {'RU5_DEVICE_SUPABASE_URL': 'https://leqcwgzvjsxugfgzdmth.supabase.co'},
            {'RU5_DEVICE_SUPABASE_URL': 'http://127.0.0.1.attacker.invalid:54321'},
            {'RU5_DEVICE_SUPABASE_URL': 'http://user:secret@127.0.0.1:54321'},
            {'RU5_DEVICE_DB_URL': 'postgresql://postgres:secret@127.0.0.1:5432/postgres'},
            {'RU5_DEVICE_DB_URL': 'postgresql://postgres:secret@127.0.0.1:54322/postgres?host=remote'},
            {'DOCKER_HOST': 'ssh://remote'}, {'DOCKER_CONTEXT': 'production'},
            {'RU5_DEVICE_PROOF_DIR': '/tmp/other-project'}, {'RU5_DEVICE_PACKAGE': 'rs.uskoci.production'},
        ]
        for change in cases:
            with self.subTest(change=list(change)):
                with self.assertRaises(RuntimeError) as caught:
                    validate_local_targets({**ENV, **change})
                self.assertNotIn('secret', str(caught.exception))

    def test_rejects_another_container_image_id_or_running_state(self):
        for index, value in ((0, 'short'), (1, '/supabase_rest_production'), (2, 'supabase/postgres:17'), (3, False)):
            fields = IDENTITY.copy(); fields[index] = value
            with self.subTest(index=index), self.assertRaises(RuntimeError):
                validate_container(fields, expected_running=True)
        with self.assertRaises(RuntimeError):
            validate_container(IDENTITY, expected_running=True, expected_id='b' * 64)

    def test_restores_the_same_immutable_container_after_a_failed_ui_assertion(self):
        outage = object.__new__(LocalRestOutage)
        outage.container_id = 'a' * 64
        outage.inspect = Mock(side_effect=[IDENTITY, [*IDENTITY[:3], False], IDENTITY])
        outage.docker = Mock()
        outage.wait_http = Mock()
        with self.assertRaisesRegex(AssertionError, 'real UI failed'):
            with outage.stopped():
                raise AssertionError('real UI failed')
        self.assertEqual(outage.docker.call_args_list[0].args, ('container', 'stop', '--timeout', '5', 'a' * 64))
        self.assertEqual(outage.docker.call_args_list[1].args, ('container', 'start', 'a' * 64))
        self.assertEqual(outage.wait_http.call_args_list[-1].kwargs, {'available': True})

    def test_refuses_mutation_if_identity_changed_before_stop(self):
        outage = object.__new__(LocalRestOutage); outage.container_id = 'a' * 64
        outage.inspect = Mock(return_value=['b' * 64, *IDENTITY[1:]])
        outage.docker = Mock()
        with self.assertRaises(RuntimeError):
            with outage.stopped():
                pass
        outage.docker.assert_not_called()


if __name__ == '__main__':
    unittest.main()
