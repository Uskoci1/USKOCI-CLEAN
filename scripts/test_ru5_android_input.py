"""Harness unit tests only: never a substitute for a physical Android journey."""
import ast
import contextlib
import io
from pathlib import Path
import subprocess
import tempfile
import types
import unittest
from xml.etree import ElementTree as ET

SOURCE = Path(__file__).with_name('ru5_android_device_ui_journey.py')
# Load function definitions only; never execute top-level Auth/device/DB journey.
DEFINITIONS = ast.Module(body=[node for node in ast.parse(SOURCE.read_text(encoding='utf-8')).body
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


class Core106HarnessTests(unittest.TestCase):
    def namespace(self):
        import json, re
        from unittest.mock import Mock
        ns={'CORE106':True,'re':re,'json':json,'run':Mock()}
        exec(compile(DEFINITIONS,str(SOURCE),'exec'),ns)
        return ns

    def application_tree(self, notice=None, title='Tvoja prijava'):
        package = 'rs.uskoci.n04proof'
        root = ET.Element('hierarchy')
        app = ET.SubElement(root, 'node', {'package': package, 'bounds': '[0,0][1080,2400]'})
        ET.SubElement(app, 'node', {'package': package, 'text': title, 'bounds': '[173,183][1033,252]'})
        scroll = ET.SubElement(app, 'node', {'package': package, 'class': 'android.widget.ScrollView',
                              'scrollable': 'true', 'bounds': '[0,307][1080,1633]'})
        ET.SubElement(app, 'node', {'package': package, 'content-desc': 'Otvori moje prijave',
                      'clickable': 'true', 'bounds': '[47,1813][1033,1944]'})
        if notice is not None:
            ET.SubElement(scroll, 'node', {'package': package, 'text': 'Prijava je poslata.', 'bounds': notice})
        return root

    def success_probe(self, frames, captured=None):
        from unittest.mock import Mock
        ns = self.namespace()
        state = {'clock': 0, 'index': 0}
        ns['PACKAGE'] = 'rs.uskoci.n04proof'
        ns['time'] = types.SimpleNamespace(monotonic=lambda: state['clock'],
                                          sleep=lambda seconds: state.update(clock=state['clock'] + seconds))

        def dump():
            root = frames[state['index']]
            dump.last_observation = (root, ET.tostring(root, encoding='unicode'))
            return root, {child: p for p in root.iter() for child in p}, dump.last_observation[1]

        def swipe(*args):
            self.assertEqual(args[:3], ('shell', 'input', 'swipe'))
            state['index'] = min(state['index'] + 1, len(frames) - 1)

        def capture(name):
            self.assertEqual(name, 'W05_worker_application_success')
            dump.last_observation = (captured if captured is not None else frames[state['index']], '')

        ns.update(dump_tree=dump, adb=Mock(side_effect=swipe), shot=Mock(side_effect=capture),
                  dismiss_known_system_anr=Mock(return_value=False), tap=Mock())
        return ns

    def test_visible_application_notice_is_captured_without_scrolling_or_submit(self):
        ns = self.success_probe([self.application_tree('[47,1200][950,1270]')])
        ns['core_capture_application_success']()
        ns['adb'].assert_not_called()
        ns['tap'].assert_not_called()
        ns['shot'].assert_called_once_with('W05_worker_application_success')

    def test_application_notice_is_physically_scrolled_into_observed_viewport(self):
        ns = self.success_probe([self.application_tree(), self.application_tree('[47,1200][950,1270]')])
        ns['core_capture_application_success']()
        ns['adb'].assert_called_once_with('shell', 'input', 'swipe', '540', '1367', '540', '638', '400')
        ns['shot'].assert_called_once_with('W05_worker_application_success')
        ns['tap'].assert_not_called()

    def test_sticky_confirmed_cta_alone_never_substitutes_for_notice(self):
        ns = self.success_probe([self.application_tree()])
        with self.assertRaisesRegex(RuntimeError, 'bounded physical scrolling'):
            ns['core_capture_application_success'](timeout=12)
        self.assertEqual(ns['adb'].call_count, 8)
        ns['shot'].assert_not_called()
        ns['tap'].assert_not_called()

    def test_clipped_or_zero_height_notice_is_not_visible_success(self):
        for bounds in ('[47,1590][950,1680]', '[47,1633][950,1633]', '[47,1633][950,1200]'):
            with self.subTest(bounds=bounds):
                ns = self.success_probe([self.application_tree(bounds), self.application_tree('[47,1200][950,1270]')])
                ns['core_capture_application_success']()
                self.assertEqual(ns['adb'].call_count, 1)

    def test_notice_outside_form_scroll_is_not_accepted(self):
        tree = self.application_tree()
        ET.SubElement(tree[0], 'node', {'package': 'rs.uskoci.n04proof', 'text': 'Prijava je poslata.',
                                      'bounds': '[47,1200][950,1270]'})
        ns = self.success_probe([tree])
        root, parent, _ = ns['dump_tree']()
        self.assertFalse(ns['core_application_success_surface'](root, parent)[1])

    def test_capture_must_itself_retain_the_visible_notice(self):
        ns = self.success_probe([self.application_tree('[47,1200][950,1270]')], captured=self.application_tree())
        with self.assertRaisesRegex(AssertionError, 'captured checkpoint'):
            ns['core_capture_application_success']()
        ns['shot'].assert_called_once()
        ns['tap'].assert_not_called()

    def test_changed_route_is_not_scrolled_or_captured(self):
        ns = self.success_probe([self.application_tree('[47,1200][950,1270]', title='Prijavi se')])
        with self.assertRaisesRegex(AssertionError, 'Application form changed'):
            ns['core_capture_application_success']()
        ns['adb'].assert_not_called()
        ns['shot'].assert_not_called()

    def test_fatal_app_anr_escapes_seek_without_capture_or_retry(self):
        from unittest.mock import Mock
        ns = self.success_probe([self.application_tree('[47,1200][950,1270]')])
        error = RuntimeError('Actual app ANR must fail')
        error.native_surface_fatal = True
        ns['dismiss_known_system_anr'] = Mock(side_effect=error)
        with self.assertRaisesRegex(RuntimeError, 'Actual app ANR'):
            ns['core_capture_application_success']()
        ns['dismiss_known_system_anr'].assert_called_once()
        ns['adb'].assert_not_called()
        ns['shot'].assert_not_called()

    def test_historical_path_remains_default_and_core_is_explicit(self):
        ns=self.namespace();self.assertTrue(ns['core_mode']());ns['CORE106']=False;self.assertFalse(ns['core_mode']())

    def test_core_profile_uses_observed_actionable_control_only(self):
        from unittest.mock import Mock
        ns=self.namespace();root=ET.fromstring('<hierarchy><node content-desc="Moj profil" clickable="true" enabled="true" bounds="[0,0][50,50]" /></hierarchy>')
        ns['dump_tree']=Mock(return_value=(root,{root[0]:root},''));ns['tap']=Mock()
        ns['core_profile']();ns['tap'].assert_called_once_with(desc='Moj profil',prefer='top')
        ns['dump_tree']=Mock(return_value=(ET.fromstring('<hierarchy/>'),{},''))
        with self.assertRaises(AssertionError):ns['core_profile']()

    def test_core_account_switch_reaches_real_list_before_profile(self):
        from unittest.mock import Mock
        ns=self.namespace(); events=[]
        for name in ('tap','core_profile','wait_visible','assert_signed_out_surface','login','switch_to_worker_workspace'):
            ns[name]=Mock(side_effect=lambda *args,_name=name,**kwargs:events.append((_name,args,kwargs)))
        ns['core_switch_account']('synthetic@example.invalid',worker=True)
        self.assertEqual(events[0],('tap',(),{'desc':'Zadaci','prefer':'bottom'}))
        self.assertEqual(events[1],('core_profile',(),{}))
        self.assertEqual(events[3],('wait_visible',(),{'desc':'Prijavite se','timeout':60}))
        self.assertEqual(events[4],('assert_signed_out_surface',(),{'form_open':True}))
        self.assertEqual(events[-2],('login',('synthetic@example.invalid',),{'form_open':True}))
        self.assertEqual(events[-1],('switch_to_worker_workspace',(),{}))

    def test_core_flow_has_no_business_rpc_or_session_injection(self):
        source=SOURCE.read_text(encoding='utf-8')
        core=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='core_journey')
        rendered=ast.unparse(core)
        self.assertNotIn('rpc_',rendered);self.assertNotIn('set_config',rendered);self.assertNotIn('am start',rendered)
        for label in ['Pošalji ovu Prijavu','Pregledaj povezivanje','Izaberi ovu Prijavu','Otvori Dogovor']:
            self.assertIn(label,rendered)
        self.assertEqual(rendered.count('launch_clean()'),1)
        self.assertLess(rendered.index('core_capture_application_success()'), rendered.index("tap(desc='Otvori moje prijave')"))
        self.assertLess(rendered.index("tap(desc='Otvori moje prijave')"), rendered.index('assert_worker_submit()'))


class SystemDialogModel:
    """Actual helper functions, fake adb transport; no device or Auth operations."""
    package = 'rs.uskoci.n04proof'

    def __init__(self, directory):
        import json, re
        self.clock = 0.0
        self.closed = False
        self.persistent = False
        self.changed_pid = False
        self.restore_focus = True
        self.calls = []
        self.root = self.dialog()
        self.initial_focus = 'Application Not Responding: com.android.launcher3'
        self.ns = {'re': re, 'json': json, 'ET': ET, 'PACKAGE': self.package,
                   'MAIN_ACTIVITY': self.package + '/.MainActivity', 'ARTIFACT_DIR': Path(directory),
                   'time': types.SimpleNamespace(monotonic=lambda: self.clock, time=lambda: self.clock, sleep=self.sleep),
                   'subprocess': types.SimpleNamespace(run=self.run, CalledProcessError=subprocess.CalledProcessError)}
        exec(compile(DEFINITIONS, str(SOURCE), 'exec'), self.ns)

        def dump(name=None):
            root = self.root
            raw = ET.tostring(root, encoding='unicode')
            dump.last_observation = (root, raw)
            if name:
                (Path(directory) / (name + '.xml')).write_text(raw, encoding='utf-8')
            return root, {child: p for p in root.iter() for child in p}, raw
        self.ns['dump_tree'] = dump

    def sleep(self, seconds):
        self.clock += seconds

    @staticmethod
    def dialog(title="Quickstep isn't responding", package='android'):
        root = ET.Element('hierarchy')
        for text, resource, clickable, bounds in (
                (title, 'alertTitle', 'false', '[133,1033][947,1104]'),
                ('Close app', 'aerr_close', 'true', '[70,1143][1010,1269]'),
                ('Wait', 'aerr_wait', 'true', '[70,1269][1010,1395]')):
            ET.SubElement(root, 'node', {'text': text, 'resource-id': 'android:id/' + resource,
                                        'package': package, 'clickable': clickable, 'enabled': 'true', 'bounds': bounds})
        return root

    def app(self):
        return ET.fromstring('<hierarchy><node package="rs.uskoci.n04proof" text="Target" '
                             'clickable="true" enabled="true" bounds="[0,0][100,100]" /></hierarchy>')

    def run(self, args, **kwargs):
        self.calls.append((args, kwargs))
        if kwargs.get('timeout') is not None:
            assert 0 < kwargs['timeout'] <= 5
        command = args[1:]
        if command == ['shell', 'dumpsys', 'window', 'displays']:
            focus = self.initial_focus
            if self.closed and not self.persistent:
                focus = self.package + '/' + self.package + '.MainActivity' if self.restore_focus else 'com.android.launcher3/.Home'
            return types.SimpleNamespace(stdout=f'  mCurrentFocus=Window{{f852081 u0 {focus}}}\n')
        if command == ['exec-out', 'screencap', '-p']:
            return types.SimpleNamespace(stdout=b'ORIGINAL_SCREEN_BYTES')
        if command == ['shell', 'pidof', self.package]:
            return types.SimpleNamespace(stdout='456\n' if self.closed and self.changed_pid else '123\n')
        if command[:3] == ['shell', 'input', 'tap']:
            assert command == ['shell', 'input', 'tap', '540', '1206'], 'Only observed Close app coordinates allowed'
            self.closed = True
            return types.SimpleNamespace(stdout='')
        if command == ['shell', 'uiautomator', 'dump', '/sdcard/window.xml']:
            return types.SimpleNamespace(stdout='')
        if command == ['shell', 'cat', '/sdcard/window.xml']:
            return types.SimpleNamespace(stdout=ET.tostring(self.root if self.persistent else self.app(), encoding='unicode'))
        raise AssertionError('Unexpected adb operation')

    def recover(self):
        root, parent, _ = self.ns['dump_tree']()
        return self.ns['dismiss_known_system_anr'](root, parent)


class QuickstepRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.model = SystemDialogModel(self.directory.name)

    def assert_fatal(self, action):
        with self.assertRaises(RuntimeError) as caught:
            action()
        self.assertTrue(getattr(caught.exception, 'native_surface_fatal', False))

    def test_exact_original_quickstep_geometry_closes_once_and_verifies_live_app(self):
        import json
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertTrue(self.model.recover())
        self.assertIn('unchanged_app_pid focused_app no_anr', output.getvalue())
        p = Path(self.directory.name)
        self.assertEqual((p / 'SYSTEM_ANR_001.png').read_bytes(), b'ORIGINAL_SCREEN_BYTES')
        self.assertIn('Quickstep', (p / 'SYSTEM_ANR_001.xml').read_text())
        self.assertIn('com.android.launcher3', (p / 'SYSTEM_ANR_001.windows.txt').read_text())
        marker = json.loads((p / 'SYSTEM_QUICKSTEP_RECOVERY_USED.json').read_text())
        self.assertTrue(marker['verified'])
        self.assertEqual(marker['appPid'], '123')
        commands = [c[0] for c in self.model.calls]
        self.assertEqual(sum(c[1:4] == ['shell', 'input', 'tap'] for c in commands), 1)
        self.assertFalse(any(x in c for c in commands for x in ['am', 'pm', 'force-stop', 'clear']))

    def test_no_dialog_path_has_no_extra_adb_or_artifact_operations(self):
        self.model.root = self.model.app()
        # Ordinary application content is not a system error dialog.
        self.model.root[0].set('text', "A tool isn't responding")
        self.assertFalse(self.model.recover())
        self.assertEqual(self.model.calls, [])
        self.assertEqual(list(Path(self.directory.name).iterdir()), [])

    def test_persistent_anr_fails_without_claiming_recovery_or_second_close(self):
        self.model.persistent = True
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assert_fatal(self.model.recover)
        self.assertNotIn('RECOVERED', output.getvalue())
        self.assertEqual(len(list(Path(self.directory.name).glob('SYSTEM_ANR_*.xml'))), 2)
        self.assertEqual(sum(c[0][1:4] == ['shell', 'input', 'tap'] for c in self.model.calls), 1)

    def test_repeated_dialog_in_later_python_phase_cannot_restart_budget(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.model.recover()
        later = SystemDialogModel(self.directory.name)
        self.assert_fatal(later.recover)
        self.assertFalse(later.closed)

    def test_changed_app_pid_is_fatal_even_when_app_surface_is_visible(self):
        self.model.changed_pid = True
        self.assert_fatal(self.model.recover)

    def test_missing_app_focus_has_bounded_readback_and_never_relaunches(self):
        self.model.restore_focus = False
        self.assert_fatal(self.model.recover)
        self.assertLessEqual(self.model.clock, 15.5)
        self.assertFalse(any('am' in c[0] for c in self.model.calls))

    def test_app_unknown_systemui_and_spoofed_anr_never_receive_close(self):
        for title, package, focus in (
                ("USKOČI isn't responding", 'android', 'Application Not Responding: rs.uskoci.n04proof'),
                ("Other app isn't responding", 'android', 'Application Not Responding: unknown'),
                ("System UI isn't responding", 'android', 'Application Not Responding: com.android.systemui'),
                ("Quickstep isn't responding", self.model.package, 'Application Not Responding: com.android.launcher3'),
                ("Quickstep isn't responding", 'android', 'Application Not Responding: rs.uskoci.n04proof')):
            with self.subTest(title=title, package=package, focus=focus):
                self.model.root = self.model.dialog(title, package)
                self.model.initial_focus = focus
                self.assert_fatal(self.model.recover)
                self.assertFalse(self.model.closed)

    def test_missing_wrong_or_disabled_system_control_cannot_be_closed(self):
        for attr, value in [('resource-id', 'fake:id/aerr_close'), ('enabled', 'false'), ('text', 'Wait'), ('bounds', '[0,0][0,0]')]:
            with self.subTest(attr=attr):
                self.model.root = self.model.dialog()
                self.model.root[1].set(attr, value)
                self.assert_fatal(self.model.recover)
                self.assertFalse(self.model.closed)

    def test_app_control_below_anr_is_not_accepted_or_tapped_and_fatal_escapes(self):
        self.model.root = self.model.dialog("USKOČI isn't responding")
        ET.SubElement(self.model.root, 'node', {'text': 'Target', 'class': 'android.widget.EditText',
                      'package': self.model.package, 'clickable': 'true', 'enabled': 'true', 'bounds': '[0,0][100,100]'})
        for name, args, kwargs in [('wait_nodes', (), {'text': 'Target'}), ('tap', (), {'text': 'Target'}),
                                  ('edit_text', (0, 'synthetic'), {}), ('dismiss_ok', (), {})]:
            with self.subTest(helper=name):
                self.assert_fatal(lambda: self.model.ns[name](*args, **kwargs))
        self.assertFalse(self.model.closed)

    def test_capture_of_anr_is_retained_but_never_an_evidence_pass(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assert_fatal(lambda: self.model.ns['shot']('rejected'))
        self.assertNotIn('EVIDENCE', output.getvalue())
        self.assertTrue((Path(self.directory.name) / 'rejected.png').exists())
        self.assertTrue((Path(self.directory.name) / 'rejected.xml').exists())

    def test_timeout_is_fatal_and_not_swallowed_by_retry_helpers(self):
        def timeout(*args, **kwargs):
            raise subprocess.TimeoutExpired('adb', 5)
        self.model.ns['system_dialog_adb'] = timeout
        self.assert_fatal(lambda: self.model.ns['wait_nodes'](text='Target'))


if __name__ == '__main__':
    unittest.main()
