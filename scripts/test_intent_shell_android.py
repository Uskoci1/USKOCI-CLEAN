"""Selector regression only; never substitutes for the emulator evidence."""
import ast
import re
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from pathlib import Path
from xml.etree import ElementTree as ET


def load_functions(path):
    return ast.Module(body=[node for node in ast.parse(path.read_text(encoding='utf-8')).body
                            if isinstance(node, ast.FunctionDef)], type_ignores=[])


namespace = {'re': re}
for filename in ('ru5_android_device_ui_journey.py', 'intent_shell_android_journey.py'):
    source = Path(__file__).with_name(filename)
    exec(compile(load_functions(source), str(source), 'exec'), namespace)
assert_shell_tree = namespace['assert_shell_tree']
assert_no_private_tabs = namespace['assert_no_private_tabs']
assert_agreement_metadata_tree = namespace['assert_agreement_metadata_tree']


def tree(names, disabled=()):
    root = ET.Element('hierarchy')
    ET.SubElement(root, 'node', {'text': 'Zadaci', 'bounds': '[0,40][350,130]',
                               'clickable': 'true', 'enabled': 'true'})
    width = 1080 // len(names)
    for index, name in enumerate(names):
        tab = ET.SubElement(root, 'node', {'content-desc': name, 'bounds': f'[{index * width},2200][{(index + 1) * width},2360]',
                                         'clickable': 'true', 'enabled': str(name not in disabled).lower()})
        ET.SubElement(tab, 'node', {'text': 'Novi' if name == 'Novi Zadatak' else name,
                                  'bounds': f'[{index * width},2260][{(index + 1) * width},2310]',
                                  'clickable': 'false'})
    return root, {child: parent for parent in root.iter() for child in parent}


def agreement_tree(schedule='Fleksibilno', amount='3.000 RSD'):
    # Relevant native hierarchy/bounds from run34110549395 requester card;
    # the recorded worker card had only title/name and no schedule/amount.
    root = ET.Element('hierarchy')
    card = ET.SubElement(root, 'node', {
        'class': 'android.widget.Button', 'content-desc': 'Otvorite Dogovor Proof Need',
        'clickable': 'true', 'enabled': 'true', 'bounds': '[42,391][1038,628]',
    })
    content = ET.SubElement(card, 'node', {'class': 'android.view.ViewGroup', 'bounds': '[42,391][1038,628]'})
    ET.SubElement(content, 'node', {'class': 'android.widget.TextView', 'text': 'Proof Need', 'bounds': '[87,441][790,499]'})
    if schedule is not None:
        ET.SubElement(content, 'node', {'class': 'android.widget.TextView', 'text': schedule, 'bounds': '[538,537][707,585]'})
    if amount is not None:
        ET.SubElement(content, 'node', {'class': 'android.widget.TextView', 'text': amount, 'bounds': '[749,537][916,585]'})
    return root, card


def signed_out_form_tree(labels=('Email', 'Lozinka')):
    root = ET.Element('hierarchy')
    for index, label in enumerate(labels):
        ET.SubElement(root, 'node', {
            'class': 'android.widget.EditText', 'content-desc': label,
            'bounds': f'[72,{600 + index * 200}][1008,{760 + index * 200}]',
            'enabled': 'true',
        })
    submit = ET.SubElement(root, 'node', {
        'class': 'android.widget.Button', 'content-desc': 'Prijavite se',
        'bounds': '[72,1080][1008,1248]', 'enabled': 'true', 'clickable': 'true',
    })
    return root, submit, {child: parent for parent in root.iter() for child in parent}


def worker_workspace_tree(shared=False, names=('Prijave', 'Zadaci', 'Dogovori')):
    root, _ = tree(names)
    profile = ET.SubElement(root, 'node', {
        'content-desc': 'Radni profil', 'class': 'android.widget.Button',
        'bounds': '[870,120][1030,280]', 'clickable': 'true', 'enabled': 'true',
    })
    marker = ET.SubElement(root, 'node', {
        'bounds': '[60,360][900,510]', 'enabled': 'true',
        **({'content-desc': 'Pretražite učitane zadatke', 'class': 'android.widget.EditText'}
           if shared else {'text': 'JA MOGU', 'class': 'android.widget.TextView'}),
    })
    return root, profile, marker, {child: parent for parent in root.iter() for child in parent}


class WorkerWorkspaceDetection(unittest.TestCase):
    def assert_worker(self, root, parent):
        namespace['assert_worker_workspace_tree'](root, parent, 1080, 2400)

    def test_legacy_worker_header_and_real_three_tabs_remain_supported(self):
        root, _, _, parent = worker_workspace_tree()
        self.assert_worker(root, parent)

    def test_shared_search_replaces_removed_eyebrow_with_same_worker_controls(self):
        root, _, _, parent = worker_workspace_tree(shared=True)
        self.assert_worker(root, parent)

    def test_requester_tabs_cannot_pass_with_shared_search_and_worker_profile_label(self):
        root, _, _, parent = worker_workspace_tree(shared=True, names=('Zadaci', 'Novi Zadatak', 'Dogovori'))
        with self.assertRaisesRegex(AssertionError, 'Bottom navigation missing'):
            self.assert_worker(root, parent)

    def test_missing_disabled_or_offscreen_worker_profile_fails(self):
        for change in ({'content-desc': 'Profil'}, {'clickable': 'false'},
                       {'enabled': 'false'}, {'bounds': '[870,650][1030,810]'}):
            with self.subTest(change=change):
                root, profile, _, parent = worker_workspace_tree(shared=True)
                profile.attrib.update(change)
                with self.assertRaisesRegex(AssertionError, 'actionable worker profile'):
                    self.assert_worker(root, parent)

    def test_noneditable_disabled_mislabelled_or_offscreen_shared_search_fails(self):
        for change in ({'class': 'android.widget.TextView'}, {'enabled': 'false'},
                       {'content-desc': 'Pretražite zadatke'}, {'bounds': '[60,1900][900,2050]'}):
            with self.subTest(change=change):
                root, _, marker, parent = worker_workspace_tree(shared=True)
                marker.attrib.update(change)
                with self.assertRaisesRegex(AssertionError, 'real shared-discovery search'):
                    self.assert_worker(root, parent)

    def test_extra_bottom_control_is_rejected_in_new_discovery(self):
        root, _, _, parent = worker_workspace_tree(shared=True, names=('Prijave', 'Zadaci', 'Dogovori', 'Settings'))
        with self.assertRaisesRegex(AssertionError, 'Extra bottom controls'):
            self.assert_worker(root, parent)

    def test_worker_wait_asserts_the_confirmed_snapshot_without_second_raw_dump(self):
        root, _, _, parent = worker_workspace_tree(shared=True)
        wait = Mock(return_value=(root, parent))
        raw_dump = Mock(side_effect=AssertionError('Do not replace the confirmed app tree'))
        with patch.dict(namespace, {'wait_surface': wait, 'dump_tree': raw_dump,
                                   'adb': Mock(return_value=SimpleNamespace(stdout='Physical size: 1080x2400'))}):
            self.assertEqual(namespace['wait_worker_workspace'](timeout=45), (root, parent))
        wait.assert_called_once_with(desc='Radni profil', timeout=45)
        raw_dump.assert_not_called()

    def test_intent_shell_worker_call_uses_same_shared_detector(self):
        root, _, _, parent = worker_workspace_tree(shared=True)
        wait = Mock(return_value=(root, parent))
        with patch.dict(namespace, {'wait_worker_workspace': wait, 'screen_size': Mock(return_value=(1080, 2400)),
                                   'wait_surface': Mock(side_effect=AssertionError('Removed eyebrow cannot be required'))}):
            namespace['assert_shell']('worker')
        wait.assert_called_once_with(timeout=45)

    def test_mode_switch_keeps_real_profile_ui_actions_before_shared_detector(self):
        tap = Mock()
        wait_marker = Mock()
        worker = Mock()
        with patch.dict(namespace, {'tap': tap, 'wait_visible': wait_marker, 'wait_worker_workspace': worker}):
            namespace['switch_to_worker_workspace']()
        self.assertEqual(tap.call_args_list, [unittest.mock.call(desc='Profil', prefer='top'),
                                              unittest.mock.call(desc='Pređite na JA MOGU')])
        wait_marker.assert_called_once_with(desc='Pređite na JA MOGU')
        worker.assert_called_once_with(timeout=45)


class IntentShellSelectors(unittest.TestCase):
    def assert_shell(self, names, expected, disabled=()):
        root, parent = tree(names, disabled)
        assert_shell_tree(root, parent, 1080, 2400, expected)

    def test_requester_three_zones_accept_alias_without_counting_header_or_child_twice(self):
        self.assert_shell(('Zadaci', 'Novi Zadatak', 'Dogovori'), ('Zadaci', 'Novi Zadatak', 'Dogovori'))

    def test_worker_three_zones_accept(self):
        self.assert_shell(('Prijave', 'Zadaci', 'Dogovori'), ('Prijave', 'Zadaci', 'Dogovori'))

    def test_wrong_order_fails(self):
        with self.assertRaisesRegex(AssertionError, 'order differs'):
            self.assert_shell(('Zadaci', 'Prijave', 'Dogovori'), ('Prijave', 'Zadaci', 'Dogovori'))

    def test_fourth_unknown_tab_fails(self):
        with self.assertRaisesRegex(AssertionError, 'Extra bottom controls'):
            self.assert_shell(('Zadaci', 'Novi Zadatak', 'Dogovori', 'Settings'), ('Zadaci', 'Novi Zadatak', 'Dogovori'))

    def test_five_tab_predecessor_fails(self):
        with self.assertRaises(AssertionError):
            self.assert_shell(('Početna', 'Zadaci', 'Prilike', 'Dogovori', 'Profil'), ('Zadaci', 'Novi Zadatak', 'Dogovori'))

    def test_header_cannot_substitute_for_missing_bottom_task_zone(self):
        with self.assertRaisesRegex(AssertionError, 'Bottom navigation missing'):
            self.assert_shell(('Prijave', 'Other', 'Dogovori'), ('Prijave', 'Zadaci', 'Dogovori'))

    def test_disabled_expected_zone_fails(self):
        with self.assertRaisesRegex(AssertionError, 'Bottom navigation missing'):
            self.assert_shell(('Prijave', 'Zadaci', 'Dogovori'), ('Prijave', 'Zadaci', 'Dogovori'), ('Zadaci',))

    def test_disabled_historical_profile_is_still_not_allowed(self):
        with self.assertRaisesRegex(AssertionError, 'Historical bottom destination'):
            self.assert_shell(('Zadaci', 'Novi Zadatak', 'Dogovori', 'Profil'), ('Zadaci', 'Novi Zadatak', 'Dogovori'), ('Profil',))

    def test_signed_out_auth_accepts_real_auth_controls_without_private_tabs(self):
        root, _ = tree(('Prijavi se', 'Treba mi neko', 'Hoću da uskočim'))
        assert_no_private_tabs(root, 2400)

    def test_signed_out_auth_rejects_private_tabs_even_with_auth_control_present(self):
        root, _ = tree(('Zadaci', 'Novi Zadatak', 'Dogovori'))
        ET.SubElement(root, 'node', {'content-desc': 'Prijavi se', 'bounds': '[0,400][200,500]'})
        with self.assertRaisesRegex(AssertionError, 'Private bottom destination'):
            assert_no_private_tabs(root, 2400)

    def test_signed_out_assertion_uses_auth_confirmed_tree_without_second_raw_snapshot(self):
        root, parent = tree(('Prijavi se', 'Treba mi neko', 'Hoću da uskočim'))
        auth = next(node for node in root.iter() if node.attrib.get('text') == 'Prijavi se')
        auth.set('content-desc', 'Prijavi se')
        observed = Mock(return_value=([auth], parent))
        raw_dump = Mock(side_effect=AssertionError('A later raw dump can contain a new Quickstep overlay'))
        with patch.dict(namespace, {
            'wait_nodes': observed,
            'dump_tree': raw_dump,
            'adb': Mock(return_value=SimpleNamespace(stdout='Physical size: 1080x2400')),
        }):
            self.assertIs(namespace['assert_signed_out_surface'](), root)
        observed.assert_called_once_with(timeout=40, desc='Prijavi se')
        raw_dump.assert_not_called()

    def assert_password_form(self, root, submit, parent):
        observed = Mock(return_value=([submit], parent))
        raw_dump = Mock(side_effect=AssertionError('A later raw dump can contain a new Quickstep overlay'))
        with patch.dict(namespace, {
            'wait_nodes': observed,
            'dump_tree': raw_dump,
            'adb': Mock(return_value=SimpleNamespace(stdout='Physical size: 1080x2400')),
        }):
            self.assertIs(namespace['assert_signed_out_surface'](form_open=True), root)
        observed.assert_called_once_with(timeout=40, desc='Prijavite se')
        raw_dump.assert_not_called()

    def test_signed_out_direct_form_accepts_exact_email_password_fields_in_confirmed_snapshot(self):
        # Logout may land directly on this real form rather than the welcome CTA.
        self.assert_password_form(*signed_out_form_tree())

    def test_signed_out_direct_form_rejects_missing_extra_duplicate_or_mislabelled_fields(self):
        for labels in ((), ('Email',), ('Lozinka',), ('Email', 'Lozinka', 'Ime'),
                       ('Email', 'Email'), ('Email', 'Password'), ('email', 'Lozinka')):
            with self.subTest(labels=labels):
                with self.assertRaisesRegex(AssertionError, 'password form is incomplete'):
                    self.assert_password_form(*signed_out_form_tree(labels))

    def test_signed_out_direct_form_rejects_labelled_text_that_is_not_an_editable_field(self):
        root, submit, parent = signed_out_form_tree()
        next(node for node in root.iter() if node.attrib.get('content-desc') == 'Lozinka').set(
            'class', 'android.widget.TextView')
        with self.assertRaisesRegex(AssertionError, 'password form is incomplete'):
            self.assert_password_form(root, submit, parent)

    def test_signed_out_direct_form_rejects_private_tabs_despite_both_real_fields(self):
        for label in ('Zadaci', 'Novi', 'Novi Zadatak', 'Prijave', 'Dogovori', 'Profil', 'Početna'):
            with self.subTest(label=label):
                root, submit, parent = signed_out_form_tree()
                ET.SubElement(root, 'node', {
                    'content-desc': label, 'bounds': '[0,2200][360,2360]',
                    'clickable': 'true', 'enabled': 'true',
                })
                with self.assertRaisesRegex(AssertionError, 'Private bottom destination'):
                    self.assert_password_form(root, submit, parent)


class AgreementMetadataVisibility(unittest.TestCase):
    def assert_metadata(self, root):
        return assert_agreement_metadata_tree(root, 1080, 2400, 'Proof Need', 'Fleksibilno', '3.000 RSD')

    def test_real_native_button_hierarchy_preserves_full_schedule_and_amount(self):
        root, _ = agreement_tree()
        self.assertEqual(self.assert_metadata(root)['amount'], (749, 537, 916, 585))

    def test_observed_worker_overflow_without_schedule_or_amount_fails(self):
        root, card = agreement_tree(schedule=None, amount=None)
        ET.SubElement(card, 'node', {'text': 'Very long actual participant name', 'bounds': '[142,537][1038,633]'})
        with self.assertRaisesRegex(AssertionError, 'Agreement schedule is missing'):
            self.assert_metadata(root)

    def test_truncated_amount_text_cannot_substitute_for_full_currency_amount(self):
        root, _ = agreement_tree(amount='3.000 R…')
        with self.assertRaisesRegex(AssertionError, 'Agreement amount is missing'):
            self.assert_metadata(root)

    def test_text_from_another_card_cannot_substitute_for_missing_amount(self):
        root, _ = agreement_tree(amount=None)
        ET.SubElement(root, 'node', {'text': '3.000 RSD', 'bounds': '[749,700][916,748]'})
        with self.assertRaisesRegex(AssertionError, 'Agreement amount is missing'):
            self.assert_metadata(root)

    def test_metadata_overflowing_card_or_screen_bounds_fails(self):
        for bounds in ('[980,537][1060,585]', '[1040,537][1200,585]', '[749,620][916,680]', '[749,537][749,585]'):
            with self.subTest(bounds=bounds):
                root, card = agreement_tree()
                next(node for node in card.iter() if node.attrib.get('text') == '3.000 RSD').set('bounds', bounds)
                with self.assertRaisesRegex(AssertionError, 'Agreement amount is outside'):
                    self.assert_metadata(root)

    def test_disabled_card_and_offscreen_card_are_not_accepted(self):
        root, card = agreement_tree()
        card.set('enabled', 'false')
        with self.assertRaisesRegex(AssertionError, 'actionable Agreement card'):
            self.assert_metadata(root)
        card.set('enabled', 'true')
        card.set('bounds', '[42,391][1200,628]')
        with self.assertRaisesRegex(AssertionError, 'card is outside'):
            self.assert_metadata(root)


if __name__ == '__main__':
    unittest.main()
