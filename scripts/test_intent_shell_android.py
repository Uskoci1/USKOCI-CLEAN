"""Selector regression only; never substitutes for the emulator evidence."""
import ast
import json
import re
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
from pathlib import Path
from xml.etree import ElementTree as ET


def load_functions(path):
    return ast.Module(body=[node for node in ast.parse(path.read_text(encoding='utf-8')).body
                            if isinstance(node, ast.FunctionDef)], type_ignores=[])


namespace = {'re': re}
for filename in ('ru5_android_device_ui_journey.py', 'intent_shell_android_journey.py', 'entry_spoj_android.py'):
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


class EntrySignaturePrelude(unittest.TestCase):
    """Synthetic control-flow/selector checks; original videos remain mandatory."""
    def test_original_android_empty_form_hints_are_not_mistaken_for_credentials(self):
        artifact = Path(__file__).parents[1] / 'docs/implementation/evidence/spoj-entry-20260907/run34163510260/artifact/ENTRY_login.xml'
        root = ET.parse(artifact).getroot()
        with patch.dict(namespace, {'assert_signed_out_surface': Mock(return_value=root)}):
            self.assertIs(namespace['assert_entry_password_form'](), root)

    def test_actual_entered_value_closes_the_credential_free_recorder_boundary(self):
        root, _, _ = signed_out_form_tree()
        next(node for node in root.iter() if node.attrib.get('content-desc') == 'Email').set('text', 'fixture@example.test')
        with patch.dict(namespace, {'assert_signed_out_surface': Mock(return_value=root)}):
            with self.assertRaisesRegex(AssertionError, 'before credentials'):
                namespace['assert_entry_password_form']()

    def test_welcome_requires_all_exact_actionable_controls(self):
        root, parent = tree(('Meni treba', 'Ja mogu', 'Prijavi se'))
        with patch.dict(namespace, {'assert_signed_out_surface': Mock(return_value=root)}):
            self.assertIs(namespace['assert_entry_welcome'](), root)
            control = next(node for node in root.iter() if node.attrib.get('content-desc') == 'Ja mogu')
            control.set('enabled', 'false')
            with self.assertRaisesRegex(AssertionError, 'enabled exact'):
                namespace['assert_entry_welcome']()

    def test_current_recovery_gated_and_configured_forms_are_distinguished(self):
        root = ET.Element('hierarchy')
        ET.SubElement(root, 'node', {'text': 'Oporavak lozinke još nije dostupan u aplikaciji. Možete se vratiti na prijavu.'})
        self.assertEqual(namespace['assert_entry_recovery_surface'](root), 'GATED')
        ET.SubElement(root, 'node', {'class': 'android.widget.EditText', 'content-desc': 'Email'})
        with self.assertRaisesRegex(AssertionError, 'Gated recovery'):
            namespace['assert_entry_recovery_surface'](root)
        root = ET.Element('hierarchy')
        ET.SubElement(root, 'node', {'class': 'android.widget.EditText', 'content-desc': 'Email'})
        ET.SubElement(root, 'node', {'content-desc': 'Pošaljite link'})
        self.assertEqual(namespace['assert_entry_recovery_surface'](root), 'AVAILABLE_NO_REQUEST')
        root[-1].set('content-desc', 'Unknown action')
        with self.assertRaisesRegex(AssertionError, 'neither'):
            namespace['assert_entry_recovery_surface'](root)

    def test_both_intents_record_real_auth_then_return_without_clear_or_credentials(self):
        for label, prefix in (('Meni treba', 'ENTRY_requester'), ('Ja mogu', 'ENTRY_worker')):
            with self.subTest(label=label):
                events = []
                patches = {
                    'assert_entry_welcome': lambda: events.append('welcome'),
                    'shot': lambda name: events.append(('shot', name)),
                    'tap': lambda **kwargs: events.append(('tap', kwargs)),
                    'wait_visible': lambda **kwargs: events.append(('wait', kwargs)),
                    'assert_entry_password_form': lambda: events.append('actual_auth_form'),
                    'record_entry_motion': lambda name, action: (events.append(('record', name)), action()),
                    'launch_clean': Mock(side_effect=AssertionError('No clear between intent choices')),
                    'edit_text': Mock(side_effect=AssertionError('No credential entry')),
                }
                with patch.dict(namespace, patches):
                    namespace['entry_intent_to_auth'](label, prefix)
                self.assertEqual(events[0], 'welcome')
                self.assertIn(('record', prefix + '_sweep'), events)
                self.assertIn(('tap', {'desc': label, 'hold_ms': 160}), events)
                self.assertLess(events.index('actual_auth_form'), events.index(('shot', prefix + '_auth')))
                self.assertEqual(events[-2:], [('wait', {'desc': 'Prijavi se'}), 'welcome'])

    def test_recorder_waits_for_observed_pid_before_action_and_stops_only_that_pid(self):
        events = []
        process = SimpleNamespace(poll=Mock(return_value=None), wait=Mock(return_value=130))
        pids = iter(['', '', '42', '42'])
        def adb(*args, **kwargs):
            events.append(args)
            return SimpleNamespace(stdout=next(pids) if args == ('shell', 'pidof', 'screenrecord') else '')
        with patch.dict(namespace, {
            'adb': adb, 'subprocess': SimpleNamespace(Popen=Mock(return_value=process), DEVNULL=-1),
            'time': SimpleNamespace(monotonic=lambda: 0, sleep=lambda _: None), 'ARTIFACT_DIR': Path('/synthetic'),
        }):
            namespace['record_entry_motion']('ENTRY_worker_sweep', lambda: events.append('action'))
        self.assertEqual(events.index('action'), 3)
        self.assertIn(('shell', 'kill', '-2', '42'), events)
        self.assertIn(('pull', '/sdcard/uskoci-ENTRY_worker_sweep.mp4', str(Path('/synthetic') / 'ENTRY_worker_sweep.mp4')), events)
        process.wait.assert_called_once_with(timeout=15)

    def test_recorder_refuses_an_existing_or_changed_identity(self):
        action = Mock()
        with patch.dict(namespace, {'adb': Mock(return_value=SimpleNamespace(stdout='41'))}):
            with self.assertRaisesRegex(RuntimeError, 'Unexpected recorder'):
                namespace['record_entry_motion']('ENTRY_intro', action)
        action.assert_not_called()
        calls = []
        pids = iter(['', '42', '99'])
        def adb(*args, **kwargs):
            calls.append(args)
            return SimpleNamespace(stdout=next(pids) if args == ('shell', 'pidof', 'screenrecord') else '')
        with patch.dict(namespace, {'adb': adb, 'time': SimpleNamespace(monotonic=lambda: 0),
                                  'subprocess': SimpleNamespace(Popen=Mock(return_value=SimpleNamespace(poll=lambda: None)), DEVNULL=-1)}):
            with self.assertRaisesRegex(RuntimeError, 'identity changed'):
                namespace['record_entry_motion']('ENTRY_intro', lambda: None)
        self.assertFalse(any(call[:2] == ('shell', 'kill') for call in calls))

    def test_signature_report_has_only_the_thirteen_actual_surface_checkpoints(self):
        names = namespace['entry_signature_checkpoints']()
        self.assertEqual(len(names), 13)
        self.assertEqual(len(set(names)), 13)
        self.assertIn('ENTRY_recovery_surface', names)
        self.assertNotIn('ENTRY_recovery_gated', names)
        self.assertEqual([name for name in names if name.endswith('_auth')], [
            'ENTRY_requester_auth', 'ENTRY_worker_auth', 'ENTRY_reduced_requester_auth', 'ENTRY_reduced_worker_auth'])

    def test_reduced_motion_restores_the_actual_prior_setting_and_reports_only_observed_scope(self):
        import json
        import tempfile
        for original in ('0.5', 'null'):
            with self.subTest(original=original), tempfile.TemporaryDirectory() as folder:
                setting = [original]
                def adb(*args, **kwargs):
                    self.assertEqual(args[4], 'transition_animation_scale')
                    if args[:4] == ('shell', 'settings', 'put', 'global'):
                        setting[0] = args[5]
                    elif args[:4] == ('shell', 'settings', 'delete', 'global'):
                        setting[0] = 'null'
                    return SimpleNamespace(stdout=setting[0])
                shots = Mock()
                patches = {
                    'record_entry_motion': lambda _, action: action(), 'launch_clean': Mock(),
                    'prepare_entry_first_launch': Mock(return_value={'launcherClear': True}),
                    'launch_entry_prepared': Mock(),
                    'assert_entry_welcome': Mock(), 'entry_intent_to_auth': Mock(),
                    'open_login_sheet': Mock(), 'assert_entry_password_form': Mock(),
                    'shot': shots, 'tap': Mock(), 'wait_visible': Mock(),
                    'wait_surface': Mock(return_value=(ET.Element('hierarchy'), {})),
                    'assert_entry_recovery_surface': Mock(return_value='GATED'), 'adb': adb,
                    'ARTIFACT_DIR': Path(folder), 'os': SimpleNamespace(environ={'GITHUB_SHA': 'a' * 40}),
                }
                with patch.dict(namespace, patches), patch('builtins.print'):
                    namespace['prove_spoj_entry'](signature=True)
                self.assertEqual(setting[0], original)
                patches['tap'].assert_any_call(text='Napravi nalog')
                self.assertNotIn(unittest.mock.call(text='Registracija'), patches['tap'].call_args_list)
                report = json.loads((Path(folder) / 'entry-signature-report.json').read_text())
                self.assertEqual(report['originalTransitionSettingRestored'], original)
                self.assertEqual(report['sourceSha'], 'a' * 40)
                self.assertEqual(report['videos'], ['ENTRY_intro.mp4', 'ENTRY_requester_sweep.mp4', 'ENTRY_worker_sweep.mp4', 'ENTRY_reduced_requester.mp4', 'ENTRY_reduced_worker.mp4'])
                self.assertFalse(report['authLoginProven'])
                self.assertFalse(report['nativeVisualParityAccepted'])
                self.assertFalse(report['framePerfectDurationMeasured'])
                self.assertEqual(report['preCapture'], {'launcherClear': True})
                self.assertFalse(report['recordedAnrRecoveryAllowed'])
                self.assertEqual(patches['entry_intent_to_auth'].call_args_list, [
                    unittest.mock.call('Meni treba', 'ENTRY_requester'), unittest.mock.call('Ja mogu', 'ENTRY_worker'),
                    unittest.mock.call('Meni treba', 'ENTRY_reduced_requester'), unittest.mock.call('Ja mogu', 'ENTRY_reduced_worker')])
                self.assertEqual(shots.call_args_list, [unittest.mock.call(name) for name in (
                    'ENTRY_welcome', 'ENTRY_login', 'ENTRY_empty_error', 'ENTRY_recovery_surface',
                    'ENTRY_registration', 'ENTRY_back_to_welcome', 'ENTRY_reduced_motion_welcome')])

    def test_failed_reduced_motion_run_restores_setting_and_cannot_write_pass_report(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            setting = ['1.5']
            def adb(*args, **kwargs):
                self.assertEqual(args[4], 'transition_animation_scale')
                if args[:4] == ('shell', 'settings', 'put', 'global'):
                    setting[0] = args[5]
                return SimpleNamespace(stdout=setting[0])
            def intent(label, prefix):
                if prefix == 'ENTRY_reduced_worker':
                    raise RuntimeError('Actual Auth surface did not appear')
            patches = {
                'record_entry_motion': lambda _, action: action(), 'launch_clean': Mock(),
                'prepare_entry_first_launch': Mock(return_value={'launcherClear': True}),
                'launch_entry_prepared': Mock(),
                'assert_entry_welcome': Mock(), 'entry_intent_to_auth': intent,
                'open_login_sheet': Mock(), 'assert_entry_password_form': Mock(),
                'shot': Mock(), 'tap': Mock(), 'wait_visible': Mock(),
                'wait_surface': Mock(return_value=(ET.Element('hierarchy'), {})),
                'assert_entry_recovery_surface': Mock(return_value='GATED'), 'adb': adb,
                'ARTIFACT_DIR': Path(folder), 'os': SimpleNamespace(environ={'GITHUB_SHA': 'a' * 40}),
            }
            with patch.dict(namespace, patches), patch('builtins.print'):
                with self.assertRaisesRegex(RuntimeError, 'Actual Auth surface'):
                    namespace['prove_spoj_entry'](signature=True)
            self.assertEqual(setting[0], '1.5')
            self.assertFalse((Path(folder) / 'entry-signature-report.json').exists())

    def test_new_script_keeps_actual_current_selectors_and_does_not_submit_or_replay_marketplace(self):
        root = Path(__file__).parents[1]
        source = (root / 'scripts/entry_spoj_android.py').read_text(encoding='utf-8')
        ui = (root / 'src/ui/entry/EntryWelcome.tsx').read_text(encoding='utf-8')
        auth = (root / 'src/app/auth.tsx').read_text(encoding='utf-8')
        for label in ('Meni treba', 'Ja mogu', 'Prijavi se'):
            self.assertIn('accessibilityLabel="' + label + '"', ui)
        self.assertIn('Zaboravili ste lozinku?', auth)
        self.assertIn("desc='Napravite nalog'", source)
        self.assertNotIn("wait_visible(text='Oporavak lozinke')", source)
        tree_source = ast.parse(source)
        calls = [node for node in ast.walk(tree_source) if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)]
        self.assertFalse({'login', 'edit_text', 'psql', 'assert_worker_submit', 'assert_final_selection'} & {node.func.id for node in calls})
        self.assertIn("if isinstance(node, ast.FunctionDef)", source)
        self.assertIn("package != 'rs.uskoci.n04proof'", source)
        self.assertIn("('localhost', '127.0.0.1')", source)


class EntryPreCaptureTests(unittest.TestCase):
    """Real helper definitions with synthetic adb replies; no native parity claim."""
    package = 'rs.uskoci.n04proof'

    @staticmethod
    def dialog(title="Quickstep isn't responding", package='android'):
        root = ET.Element('hierarchy')
        for label, resource, clickable in ((title, 'alertTitle', 'false'),
                                            ('Close app', 'aerr_close', 'true'),
                                            ('Wait', 'aerr_wait', 'true')):
            ET.SubElement(root, 'node', {'text': label, 'resource-id': 'android:id/' + resource,
                                       'package': package, 'enabled': 'true', 'clickable': clickable,
                                       'bounds': '[70,1143][1010,1269]'})
        return root

    @staticmethod
    def windows(focus):
        return '  mCurrentFocus=Window{cb3bd44 u0 ' + focus + '}\n'

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.artifacts = Path(self.folder.name)
        self.clean = ET.fromstring('<hierarchy><node package="com.android.launcher3" /></hierarchy>')
        self.launcher = self.windows('com.android.launcher3/.uioverrides.QuickstepLauncher')
        self.anr = self.windows('Application Not Responding: com.android.launcher3')
        self.calls = []
        self.diagnostics = Mock(return_value='SYSTEM_ANR_001')
        def command(*args, **kwargs):
            self.calls.append(args)
            return SimpleNamespace(stdout='Success' if args[:3] == ('shell', 'pm', 'clear') else '')
        self.observation = Mock(return_value=(self.clean, self.launcher))
        self.patches = patch.dict(namespace, {
            'PACKAGE': self.package, 'MAIN_ACTIVITY': self.package + '/.MainActivity',
            'ARTIFACT_DIR': self.artifacts, 'json': json,
            'system_dialog_adb': command, 'entry_launcher_observation': self.observation,
            'retain_anr_diagnostic': self.diagnostics,
            'time': SimpleNamespace(monotonic=lambda: 0, sleep=Mock()),
        })
        self.patches.start()
        self.addCleanup(self.patches.stop)

    def test_clear_launcher_is_admitted_without_any_app_launch_or_recovery(self):
        result = namespace['prepare_entry_first_launch']()
        self.assertEqual(result, {'launcherClear': True, 'appProcessAbsent': True,
                                  'quickstepRecoveredBeforeCapture': False})
        self.assertEqual(self.calls, [('shell', 'am', 'force-stop', self.package),
                                     ('shell', 'pm', 'clear', self.package)])
        self.assertFalse((self.artifacts / 'SYSTEM_QUICKSTEP_RECOVERY_USED.json').exists())

    def test_exact_quickstep_closes_once_before_first_launch_and_persists_same_run_marker(self):
        self.observation.side_effect = [(self.dialog(), self.anr), (self.clean, self.launcher)]
        result = namespace['prepare_entry_first_launch']()
        self.assertTrue(result['quickstepRecoveredBeforeCapture'])
        self.assertEqual(self.calls[-1], ('shell', 'input', 'tap', '540', '1206'))
        self.assertFalse(any(call[:3] == ('shell', 'am', 'start') for call in self.calls))
        receipt = json.loads((self.artifacts / 'SYSTEM_QUICKSTEP_RECOVERY_USED.json').read_text())
        self.assertEqual(receipt, {'diagnostic': 'SYSTEM_ANR_001', 'phase': 'ENTRY_PRE_CAPTURE',
                                   'appProcessAbsent': True, 'verified': True})
        self.diagnostics.assert_called_once()

    def test_app_unknown_system_ui_and_mismatched_quickstep_dialogs_are_never_tapped(self):
        cases = [
            (self.dialog('USKOČI NAV PROOF isn\'t responding'), self.anr),
            (self.dialog('System UI isn\'t responding'), self.windows('Application Not Responding: com.android.systemui')),
            (self.dialog('Unknown isn\'t responding'), self.anr),
            (self.dialog(), self.windows('Application Not Responding: ' + self.package)),
            (self.dialog(package=self.package), self.anr),
        ]
        disabled = self.dialog()
        disabled[1].set('enabled', 'false')
        cases.append((disabled, self.anr))
        missing = self.dialog()
        missing.remove(missing[2])
        cases.append((missing, self.anr))
        for root, windows in cases:
            with self.subTest(windows=windows, title=root[0].attrib['text']):
                self.calls.clear()
                self.observation.return_value = root, windows
                with self.assertRaisesRegex(RuntimeError, 'unrecognized ANR'):
                    namespace['prepare_entry_first_launch']()
                self.assertFalse(any(call[:2] == ('shell', 'input') for call in self.calls))

    def test_prior_recovery_and_persistent_dialog_fail_without_another_tap(self):
        marker = self.artifacts / 'SYSTEM_QUICKSTEP_RECOVERY_USED.json'
        marker.write_text('{}')
        self.observation.return_value = self.dialog(), self.anr
        with self.assertRaisesRegex(RuntimeError, 'no second recovery'):
            namespace['prepare_entry_first_launch']()
        self.assertFalse(any(call[:2] == ('shell', 'input') for call in self.calls))
        marker.unlink()
        with self.assertRaisesRegex(RuntimeError, 'unobscured known launcher'):
            namespace['prepare_entry_first_launch']()
        self.assertEqual(sum(call[:2] == ('shell', 'input') for call in self.calls), 1)
        self.assertFalse(json.loads(marker.read_text())['verified'])

    def test_unknown_focused_surface_never_counts_as_clear_launcher(self):
        for focus in ('com.android.systemui/.Dialog', self.package + '/.MainActivity',
                      'com.android.launcher3/.UnverifiedActivity'):
            self.observation.return_value = self.clean, self.windows(focus)
            with self.subTest(focus=focus), self.assertRaisesRegex(RuntimeError, 'unobscured known launcher'):
                namespace['prepare_entry_first_launch']()
        self.assertFalse(any(call[:2] == ('shell', 'input') for call in self.calls))

    def test_absent_process_requires_real_pidof_negative_with_finite_deadline(self):
        command = Mock(return_value=SimpleNamespace(returncode=1, stdout=''))
        with patch.dict(namespace, {'subprocess': SimpleNamespace(run=command)}):
            namespace['entry_assert_process_absent'](2)
            command.assert_called_once_with(['adb', 'shell', 'pidof', self.package], check=False,
                                            capture_output=True, text=True, timeout=2)
            for code, output in ((0, '123'), (0, ''), (2, ''), (1, '123')):
                command.return_value = SimpleNamespace(returncode=code, stdout=output)
                with self.assertRaisesRegex(RuntimeError, 'must not run'):
                    namespace['entry_assert_process_absent'](2)
            with self.assertRaisesRegex(RuntimeError, 'deadline exceeded'):
                namespace['entry_assert_process_absent'](0)

    def test_prepared_launch_rechecks_launcher_then_starts_without_clear_or_force_stop(self):
        events = []
        self.observation.side_effect = lambda _: (events.append('inspect') or self.clean, self.launcher)
        def adb(*args, **kwargs):
            events.append(args)
            return SimpleNamespace(returncode=0, stdout='LaunchState: COLD', stderr='')
        with patch.dict(namespace, {'adb': adb, 'wait_visible': lambda **_: events.append('wait'),
                                   'assert_signed_out_surface': lambda: events.append('signedout')}):
            namespace['launch_entry_prepared']()
        self.assertEqual(events, ['inspect', ('shell', 'am', 'start', '-W', '-n', self.package + '/.MainActivity'),
                                  'wait', 'signedout'])

    def test_late_dialog_is_fatal_before_start_and_never_recovered(self):
        self.observation.return_value = self.dialog(), self.anr
        start = Mock()
        with patch.dict(namespace, {'adb': start}):
            with self.assertRaisesRegex(RuntimeError, 'unobscured known launcher'):
                namespace['launch_entry_prepared']()
        start.assert_not_called()
        self.assertFalse(any(call[:2] == ('shell', 'input') for call in self.calls))

    def test_recording_anr_cannot_be_recovered_and_original_movie_is_pulled_before_failure(self):
        events = []
        original_recovery = Mock()
        process = SimpleNamespace(poll=lambda: None, wait=lambda **_: events.append('stopped') or 130)
        pids = iter(['', '42', '42'])
        def adb(*args, **kwargs):
            events.append(args)
            return SimpleNamespace(stdout=next(pids) if args == ('shell', 'pidof', 'screenrecord') else '')
        def action():
            namespace['dismiss_known_system_anr'](self.dialog(), {})
        with patch.dict(namespace, {'adb': adb, 'dismiss_known_system_anr': original_recovery,
                                   'subprocess': SimpleNamespace(Popen=Mock(return_value=process), DEVNULL=-1)}):
            with self.assertRaisesRegex(RuntimeError, 'obscured Entry recording'):
                namespace['record_entry_motion']('ENTRY_intro', action)
            self.assertIs(namespace['dismiss_known_system_anr'], original_recovery)
        original_recovery.assert_not_called()
        self.assertLess(events.index(('shell', 'kill', '-2', '42')), events.index('stopped'))
        self.assertEqual(events[-1], ('pull', '/sdcard/uskoci-ENTRY_intro.mp4', str(self.artifacts / 'ENTRY_intro.mp4')))
        self.assertFalse((self.artifacts / 'entry-signature-report.json').exists())

    def test_signature_preflight_runs_before_recorder_and_failure_prevents_recording(self):
        events = []
        def record(name, action):
            events.append((name, action.__name__))
            raise RuntimeError('Stop after verifying dispatch order')
        with patch.dict(namespace, {'prepare_entry_first_launch': lambda: events.append('preflight'),
                                   'record_entry_motion': record}):
            with self.assertRaisesRegex(RuntimeError, 'dispatch order'):
                namespace['prove_spoj_entry'](signature=True)
        self.assertEqual(events, ['preflight', ('ENTRY_intro', 'launch_entry_prepared')])
        record = Mock()
        with patch.dict(namespace, {'prepare_entry_first_launch': Mock(side_effect=RuntimeError('launcher not ready')),
                                   'record_entry_motion': record}):
            with self.assertRaisesRegex(RuntimeError, 'launcher not ready'):
                namespace['prove_spoj_entry'](signature=True)
        record.assert_not_called()

    def test_historical_full_dispatch_keeps_existing_launch_clean(self):
        actions = []
        def record(_, action):
            actions.append(action.__name__)
            raise RuntimeError('Historical dispatch verified')
        with patch.dict(namespace, {'prepare_entry_first_launch': Mock(side_effect=AssertionError('Signature only')),
                                   'record_entry_motion': record}):
            with self.assertRaisesRegex(RuntimeError, 'Historical dispatch verified'):
                namespace['prove_spoj_entry'](signature=False)
        self.assertEqual(actions, ['launch_clean'])


if __name__ == '__main__':
    unittest.main()
