"""Harness unit tests only: never a substitute for a physical Android journey."""
import ast
import contextlib
import io
from pathlib import Path
import subprocess
import types
import unittest
from xml.etree import ElementTree as ET

SOURCE = Path(__file__).with_name('ru5_android_device_ui_journey.py')
# Load function definitions only; never execute top-level Auth/device/DB journey.
DEFINITIONS = ast.Module(body=[node for node in ast.parse(SOURCE.read_text()).body
                               if isinstance(node, ast.FunctionDef)], type_ignores=[])


class NativeInputModel:
    def __init__(self, focus_failures=0, dropped_inputs=0, password=False, initial=''):
        self.clock = 0.0
        self.focused = False
        self.focus_failures = focus_failures
        self.dropped_inputs = dropped_inputs
        self.password = password
        self.value = initial
        self.selected = False
        self.taps = 0
        self.commands = []
        self.saved = []

    def sleep(self, seconds):
        self.clock += seconds

    def dump(self, name=None):
        if name:
            self.saved.append(name)
        value = ('\u2022' * len(self.value)) if self.password else (self.value or 'placeholder')
        root = ET.Element('hierarchy')
        field = ET.SubElement(root, 'node', {
            'class': 'android.widget.EditText', 'text': value,
            'bounds': '[0,100][400,200]', 'clickable': 'true', 'enabled': 'true',
            'focused': str(self.focused).lower(), 'password': str(self.password).lower(),
        })
        return root, {field: root}, ET.tostring(root, encoding='unicode')

    def tap(self, field, parent, hold_ms=0):
        self.taps += 1
        self.focused = self.taps > self.focus_failures

    def adb(self, *args, **kwargs):
        self.commands.append((self.taps, args))
        if not self.focused:
            raise AssertionError('Typing without verified native focus')
        if 'keycombination' in args:
            self.selected = True
        elif args[-1] == 'KEYCODE_DEL' and self.selected:
            self.value = ''
            self.selected = False
        elif args[:3] == ('shell', 'input', 'text'):
            if self.dropped_inputs:
                self.dropped_inputs -= 1
            else:
                self.value += args[-1]

    def namespace(self):
        import re
        ns = {'re': re, 'subprocess': subprocess, 'ET': ET,
              'time': types.SimpleNamespace(monotonic=lambda: self.clock, sleep=self.sleep)}
        exec(compile(DEFINITIONS, str(SOURCE), 'exec'), ns)
        ns.update(dump_tree=self.dump, tap_node=self.tap, adb=self.adb,
                  dismiss_known_system_anr=lambda root, parent: False)
        return ns


class AndroidInputHarnessTests(unittest.TestCase):
    def exercise(self, model, value, timeout=10):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            model.namespace()['edit_text'](0, value, timeout=timeout)
        return output.getvalue()

    def test_lost_taps_do_not_type_until_focus_is_confirmed(self):
        model = NativeInputModel(focus_failures=2)
        log = self.exercise(model, 'worker@proof.invalid')
        self.assertEqual(model.value, 'worker@proof.invalid')
        self.assertEqual(model.taps, 3)
        self.assertTrue(all(tap == 3 for tap, _ in model.commands))
        self.assertIn('UI_TEXT_FOCUS', log)

    def test_dropped_text_is_detected_and_retried(self):
        model = NativeInputModel(dropped_inputs=1)
        log = self.exercise(model, '3000')
        self.assertEqual(model.value, '3000')
        self.assertEqual(model.taps, 2)
        self.assertIn('UI_TEXT_READBACK', log)

    def test_retry_replaces_existing_text_instead_of_appending(self):
        model = NativeInputModel(initial='partial-previous-input')
        self.exercise(model, 'worker@proof.invalid')
        self.assertEqual(model.value, 'worker@proof.invalid')
        commands = [args for _, args in model.commands]
        self.assertIn(('shell', 'input', 'keyboard', 'keycombination', '-t', '100',
                       'KEYCODE_CTRL_LEFT', 'KEYCODE_A'), commands)
        self.assertIn(('shell', 'input', 'keyevent', 'KEYCODE_DEL'), commands)

    def test_password_stays_masked_and_is_not_printed(self):
        model = NativeInputModel(password=True)
        secret = 'SyntheticUnitTestCredentialAa1'
        log = self.exercise(model, secret)
        self.assertNotIn(secret, log)
        self.assertIn('secret=True', log)
        self.assertNotIn(secret, model.dump()[2])

    def test_persistent_focus_failure_stops_without_typing(self):
        model = NativeInputModel(focus_failures=100)
        with contextlib.redirect_stdout(io.StringIO()), self.assertRaisesRegex(RuntimeError, 'native focus'):
            model.namespace()['edit_text'](0, '3000', timeout=2)
        self.assertEqual(model.commands, [])
        self.assertEqual(model.saved, ['input_0_timeout'])

    def test_persistent_readback_failure_cannot_claim_success(self):
        model = NativeInputModel(dropped_inputs=100)
        log = io.StringIO()
        with contextlib.redirect_stdout(log), self.assertRaisesRegex(RuntimeError, 'readback mismatch'):
            model.namespace()['edit_text'](0, '3000', timeout=3)
        self.assertNotIn('CHECKPOINT UI_TEXT_ENTERED', log.getvalue())

    def test_command_failure_does_not_log_secret_arguments(self):
        model = NativeInputModel()
        ns = model.namespace()
        secret = 'SyntheticCredentialNeverLog'
        def fail(*args, **kwargs):
            raise subprocess.CalledProcessError(1, ['adb', 'shell', 'input', 'text', secret])
        ns['adb'] = fail
        log = io.StringIO()
        with contextlib.redirect_stdout(log), self.assertRaises(RuntimeError):
            ns['edit_text'](0, secret, timeout=2)
        self.assertNotIn(secret, log.getvalue())

    def test_plaintext_requires_exact_readback(self):
        ns = NativeInputModel().namespace()
        field = ET.Element('node', {'text': '300', 'password': 'false'})
        self.assertFalse(ns['entered_value_matches'](field, '3000'))
        field.set('text', '3000')
        self.assertTrue(ns['entered_value_matches'](field, '3000'))

    def test_native_fields_use_screen_order_not_xml_order(self):
        ns = NativeInputModel().namespace()
        root = ET.Element('hierarchy')
        bottom = ET.SubElement(root, 'node', {'class': 'android.widget.EditText', 'bounds': '[0,200][400,300]'})
        top = ET.SubElement(root, 'node', {'class': 'android.widget.EditText', 'bounds': '[0,100][400,150]'})
        self.assertEqual(ns['ordered_edit_fields'](root), [top, bottom])


if __name__ == '__main__':
    unittest.main()
