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


if __name__ == '__main__':
    unittest.main()
