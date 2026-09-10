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
        elif args[:3] == ('shell', 'input', 'text') or args[-1] == 'KEYCODE_SPACE':
            if self.dropped_inputs:
                self.dropped_inputs -= 1
            else:
                self.value += ' ' if args[-1] == 'KEYCODE_SPACE' else args[-1]

    def namespace(self):
        import re
        ns = {'re': re, 'subprocess': subprocess, 'ET': ET,
              'time': types.SimpleNamespace(monotonic=lambda: self.clock, sleep=self.sleep)}
        exec(compile(DEFINITIONS, str(SOURCE), 'exec'), ns)
        ns.update(dump_tree=self.dump, tap_node=self.tap, adb=self.adb,
                  dismiss_known_system_anr=lambda root, parent: False)
        return ns


class AndroidInputHarnessTests(unittest.TestCase):
    def test_long_fixture_email_is_sent_as_separate_paced_key_events(self):
        model = NativeInputModel()
        value = 'ru5-device-worker-5182cbd1-9e18-4772-b78a-ebd34b2c0000@proof.invalid'
        self.assertEqual(len(value), 68)
        log = self.exercise(model, value)
        text_commands = [args for _, args in model.commands if args[:3] == ('shell', 'input', 'text')]
        self.assertEqual([args[-1] for args in text_commands], list(value))
        self.assertTrue(all(len(args[-1]) == 1 for args in text_commands))
        self.assertGreaterEqual(model.clock, len(value) * 0.15)
        self.assertEqual(model.value, value)
        self.assertIn('CHECKPOINT UI_TEXT_ENTERED field=0 attempt=1', log)
        self.assertNotIn('characters=', log)
        self.assertNotIn(value, log)

    def test_ai_sentence_uses_real_space_key_events_and_exact_readback(self):
        model = NativeInputModel()
        value = 'Dve osobe i kombi za prenos stvari u Novom Sadu.'
        log = self.exercise(model, value)
        commands = [args for _, args in model.commands]
        expected = [('shell', 'input', 'keyevent', 'KEYCODE_SPACE') if char == ' '
                    else ('shell', 'input', 'text', char) for char in value]
        self.assertEqual(commands[-len(value):], expected)
        self.assertEqual(model.value, value)
        self.assertGreaterEqual(model.clock, len(value) * 0.15)
        self.assertIn('CHECKPOINT UI_TEXT_ENTERED field=0 attempt=1', log)
        self.assertNotIn(value, log)

    def test_long_email_with_dropped_character_retries_the_whole_value(self):
        model = NativeInputModel(dropped_inputs=1)
        value = 'ru5-device-requester-00000000-0000-4000-8000-000000000000@proof.invalid'
        log = self.exercise(model, value)
        self.assertEqual(model.taps, 2)
        self.assertEqual(model.value, value)
        self.assertIn('RETRY UI_TEXT_READBACK field=0 attempt=1', log)
        self.assertNotIn('characters=', log)
        self.assertNotIn(value, log)

    def test_keyboard_pacing_has_a_deadline_and_cannot_claim_partial_success(self):
        model = NativeInputModel()
        log = io.StringIO()
        with contextlib.redirect_stdout(log), self.assertRaises(RuntimeError):
            model.namespace()['edit_text'](0, 'worker@proof.invalid', timeout=0.5)
        self.assertNotEqual(model.value, 'worker@proof.invalid')
        self.assertNotIn('CHECKPOINT UI_TEXT_ENTERED', log.getvalue())
        self.assertEqual(model.saved, ['input_0_timeout'])

    def test_unsupported_shell_transport_input_is_rejected_without_commands(self):
        model = NativeInputModel()
        with self.assertRaisesRegex(ValueError, 'synthetic fixture'):
            model.namespace()['type_paced_fixture_text']('synthetic;command', 100)
        self.assertEqual(model.commands, [])

    def test_partial_masked_password_is_not_accepted(self):
        ns = NativeInputModel().namespace()
        field = ET.Element('node', {'text': '\u2022' * 10, 'password': 'true'})
        self.assertFalse(ns['entered_value_matches'](field, 'SyntheticUnitCredential'))

    def exercise(self, model, value, timeout=40):
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
        self.assertIn('CHECKPOINT UI_TEXT_ENTERED field=0 attempt=1', log)
        self.assertNotIn('secret=', log)
        self.assertNotIn('characters=', log)
        self.assertNotIn(secret, model.dump()[2])

    def test_success_and_retry_diagnostics_are_independent_of_input_contents(self):
        for password in (False, True):
            for dropped_inputs in (0, 1):
                with self.subTest(password=password, dropped_inputs=dropped_inputs):
                    logs = []
                    for value in ('SyntheticAa1', 'SyntheticLongerCredentialBb22'):
                        model = NativeInputModel(password=password, dropped_inputs=dropped_inputs)
                        log = self.exercise(model, value)
                        self.assertEqual(model.value, value)
                        self.assertNotIn(value, log)
                        self.assertNotIn('secret=', log)
                        self.assertNotIn('characters=', log)
                        for line in log.splitlines():
                            self.assertRegex(line, r'^(?:CHECKPOINT UI_TEXT_ENTERED|RETRY UI_TEXT_READBACK) field=0 attempt=[1-9][0-9]*$')
                        logs.append(log)
                    self.assertEqual(logs[0], logs[1])

    def test_failed_password_readback_logs_no_value_or_length(self):
        model = NativeInputModel(password=True, dropped_inputs=100)
        value = 'SyntheticCredentialNeverLog'
        output = io.StringIO()
        with contextlib.redirect_stdout(output), self.assertRaises(RuntimeError):
            model.namespace()['edit_text'](0, value, timeout=7)
        log = output.getvalue()
        self.assertIn('RETRY UI_TEXT_READBACK', log)
        self.assertNotIn('CHECKPOINT UI_TEXT_ENTERED', log)
        self.assertNotIn(value, log)
        self.assertNotIn('secret=', log)
        self.assertNotIn('characters=', log)
        self.assertEqual(model.saved, ['input_0_timeout'])

    def test_proof_supabase_action_uses_the_proven_immutable_revision(self):
        workflow = SOURCE.parent.parent / '.github/workflows/ru5-physical-android-device-ui-proof.yml'
        text = workflow.read_text()
        self.assertIn('uses: supabase/setup-cli@ab058987d8d6c725971f6cf9d0b5c98467e30bd1', text)
        self.assertNotIn('uses: supabase/setup-cli@v1', text)
        self.assertIn('version: 2.116.0', text)

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
            model.namespace()['edit_text'](0, '3000', timeout=2)
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
