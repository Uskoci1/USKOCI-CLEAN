"""Contract tests of EX-07 S03: the proof, the stack it starts, the APK it builds and the workflow that runs them agree with each
other AND with the app source. They run offline in the first job of the workflow, so a drift (a changed word in the app, a changed
redirect, a stray device command) fails in a minute, not after a 50-minute emulator run."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

import s03_core as core

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WORKFLOW = ROOT / '.github' / 'workflows' / 'ex07-s03-auth-callbacks-proof.yml'
ENV_SH = HERE / 'ex07_s03_env.sh'
BUILD_SH = HERE / 'ex07_s03_build_apk.sh'
RUN_SH = HERE / 'ex07_s03_run_native.sh'
DEMO_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


class AppSourceContract(unittest.TestCase):
    def test_every_ui_word_the_driver_waits_for_still_exists_in_the_app_source(self):
        labels = json.loads(read(HERE / 'ui_labels.json'))['labels']
        missing = []
        for row in labels:
            texts = [read(ROOT / source) for source in row['sources']]
            if not any(row['text'] in text for text in texts):
                missing.append((row['id'], row['text'], row['sources']))
        self.assertEqual(missing, [], 'copy changed in the app: update ui_labels.json (the driver waits for these exact words)')

    def test_label_ids_are_unique_and_kinds_known(self):
        rows = json.loads(read(HERE / 'ui_labels.json'))['labels']
        self.assertEqual(len({r['id'] for r in rows}), len(rows))
        self.assertTrue(all(r['kind'] in ('field', 'button', 'text') and r['match'] in ('exact', 'contains') for r in rows))

    def test_every_label_the_state_classifier_uses_exists(self):
        labels = core.Labels.load(HERE / 'ui_labels.json')
        pattern = r"'((?:login|signup|confirm|recovery|oporavak)\.[a-z_.]+)'"
        used = set(re.findall(pattern, read(HERE / 's03_core.py'))) | set(re.findall(pattern, read(HERE / 's03_android_proof.py')))
        self.assertTrue(used)
        self.assertEqual(sorted(i for i in used if i not in labels.ids()), [])

    def test_the_redirects_are_the_ones_the_app_sends(self):
        self.assertIn("'" + core.SIGNUP_REDIRECT + "'", read(ROOT / 'src/data/authSignupRedirect.ts'))
        self.assertIn("'" + core.RECOVERY_REDIRECT + "'", read(ROOT / 'src/data/passwordRecoveryLink.ts'))
        shapes = json.loads(read(HERE / 'callback_shapes.json'))['redirects']
        self.assertEqual(shapes, {'signup': core.SIGNUP_REDIRECT, 'recovery': core.RECOVERY_REDIRECT})

    def test_the_app_scheme_is_the_one_the_proof_opens(self):
        self.assertEqual(json.loads(read(ROOT / 'app.json'))['expo']['scheme'], 'uskociapp')
        self.assertTrue(core.SIGNUP_REDIRECT.startswith('uskociapp://') and core.RECOVERY_REDIRECT.startswith('uskociapp://'))


class StackContract(unittest.TestCase):
    def setUp(self):
        self.env = read(ENV_SH)

    def test_confirmations_are_on_and_both_redirects_are_allowlisted(self):
        self.assertRegex(self.env, r'enable_confirmations = true')
        match = re.search(r'additional_redirect_urls = \[(.*?)\]', self.env)
        self.assertIsNotNone(match)
        urls = re.findall(r'"([^"]+)"', match.group(1))
        self.assertEqual(sorted(urls), sorted([core.SIGNUP_REDIRECT, core.RECOVERY_REDIRECT]))

    def test_the_numbers_the_proof_assumes_are_the_numbers_the_stack_has(self):
        self.assertIn(f'otp_expiry = {core.OTP_EXPIRY_SECONDS}', self.env)
        self.assertIn(f'max_frequency = "{core.MAX_FREQUENCY_SECONDS}s"', self.env)
        self.assertIn(f'site_url = "{core.SITE_URL}"', self.env)
        self.assertIn('minimum_password_length = 6', self.env)      # the proof's passwords and the app's own check
        self.assertIn('secure_password_change = true', self.env)

    def test_no_provider_email_limit_can_starve_the_proof(self):
        for key in ('email_sent', 'sign_in_sign_ups', 'token_verifications', 'token_refresh'):
            match = re.search(rf'{key} = (\d+)', self.env)
            self.assertIsNotNone(match, key)
            self.assertGreaterEqual(int(match.group(1)), 1000, key)

    def test_the_stack_is_loopback_only_and_has_no_marketplace_replay_or_project_link(self):
        self.assertIn('http://127.0.0.1:54321', self.env)
        self.assertIn('Non-local Auth target refused', self.env)
        self.assertIn('test ! -e supabase/.temp/project-ref', self.env)
        for forbidden in ('supabase link', 'db push', 'db reset', 'migration up', 'leqcwgzvjsxugfgzdmth'):
            self.assertNotIn(forbidden, self.env)

    def test_mailpit_ports_are_the_ones_the_http_layer_allows(self):
        self.assertIn('port = 54324', self.env)
        self.assertIn('port = 54321', self.env)

    def test_the_scripts_are_lf_and_start_with_a_strict_shell(self):
        for path in (ENV_SH, BUILD_SH, RUN_SH):
            raw = path.read_bytes()
            self.assertNotIn(b'\r', raw, path.name)
            self.assertTrue(raw.startswith(b'#!/usr/bin/env bash'), path.name)
        self.assertIn('set -euo pipefail', self.env)
        self.assertIn('set -euo pipefail', read(BUILD_SH))


class ApkContract(unittest.TestCase):
    def test_the_proof_package_is_the_one_the_driver_clears_and_drives(self):
        build = read(BUILD_SH)
        self.assertIn(f"app['android']['package'] = '{core.PACKAGE}'", build)
        self.assertIn(f"package: name='{core.PACKAGE}'", build)
        self.assertIn(f"package: name='{core.PACKAGE}'", read(WORKFLOW))

    def test_the_build_refuses_a_non_disposable_endpoint(self):
        build = read(BUILD_SH)
        self.assertIn("'http://10.0.2.2:54321'", build)
        self.assertIn('leqcwgzvjsxugfgzdmth', build)                  # named only to be refused
        self.assertIn("'uskociapp://oporavak'", build)
        self.assertIn('android:debuggable', build)
        self.assertIn('android:usesCleartextTraffic', build)

    def test_the_demo_key_is_the_public_supabase_cli_constant_everywhere_it_appears(self):
        workflow = read(WORKFLOW)
        self.assertEqual(workflow.count(DEMO_KEY), 2)                  # compiled into the APK; compared with the live stack
        p6 = read(ROOT / '.github/workflows/p6-native-apk.yml')
        self.assertIn(DEMO_KEY, p6)                                    # the same constant the existing native proofs use

    def test_the_apk_variants_follow_the_two_known_recipes(self):
        build = read(BUILD_SH)
        self.assertIn('assembleRelease', build)
        self.assertIn('-x lintVitalAnalyzeRelease', build)
        self.assertIn('debuggableVariants = []', build)
        self.assertIn(':app:assembleDebug', build)


class WorkflowContract(unittest.TestCase):
    def setUp(self):
        self.text = read(WORKFLOW)

    def test_file_hygiene(self):
        raw = WORKFLOW.read_bytes()
        self.assertNotIn(b'\r', raw)
        self.assertNotIn(b'\t', raw)
        self.assertFalse(re.search(r'ignore[-_]scripts', self.text, re.I))      # the Reanimated patch contract: install scripts always run

    def test_triggers_are_this_workflow_and_this_folder_only_and_free_of_bracket_patterns(self):
        block = self.text.split('\npermissions:')[0]
        self.assertIn("- 'supabase/proofs/ex07/s03/**'", block)
        self.assertIn("- '!supabase/proofs/ex07/s03/*.md'", block)
        self.assertIn('workflow_dispatch:', block)
        for line in block.splitlines():
            if line.strip().startswith("- '") and 'paths' not in line:
                self.assertNotIn('[', line)                                       # a bracket pattern makes GitHub reject the whole file
        self.assertNotIn("'src/", block)                                          # a src push must not start a 50-minute proof

    def test_every_action_is_pinned_to_a_commit_or_an_established_tag(self):
        pinned = re.findall(r'uses: ([\w./-]+)@([\w.]+)', self.text)
        self.assertTrue(pinned)
        for name, ref in pinned:
            if name in ('actions/setup-python', 'actions/setup-java'):
                self.assertRegex(ref, r'^v\d+$', name)                            # the same tags the existing proofs use
            else:
                self.assertRegex(ref, r'^[0-9a-f]{40}$', f'{name}@{ref}')

    def test_every_script_it_runs_exists(self):
        for path in set(re.findall(r'(supabase/proofs/ex07/s03/[\w./-]+?\.(?:py|sh|json))', self.text)):
            self.assertTrue((ROOT / path).exists(), path)
        self.assertTrue((ROOT / 'src/data/__tests__/ex07-auth-callback-routing.test.ts').exists())

    def test_only_the_emulator_job_may_clear_app_data_and_the_logcat_is_never_uploaded(self):
        emulator = self.text.split('  native-emulator-proof:')[1].split('\n  evidence:')[0]
        before = self.text.split('  native-emulator-proof:')[0]
        self.assertIn("EX07_S03_ALLOW_CLEAR: '1'", emulator)
        self.assertNotIn('EX07_S03_ALLOW_CLEAR', before)
        self.assertIn('!artifacts/ex07-s03-native/*.private.txt', emulator)

    def test_the_jobs_are_wired_as_documented(self):
        self.assertIn('needs: native-apk', self.text)
        self.assertIn('needs: [offline-logic, provider-http-proof, native-apk, native-emulator-proof]', self.text)
        self.assertIn('gh run download "$GITHUB_RUN_ID"', self.text)               # the APK and the reports of THIS run, never another
        self.assertIn('node scripts/verify-native-patches.cjs', self.text)
        self.assertLess(self.text.index('run: npm ci'), self.text.index('ex07_s03_build_apk.sh'))
        self.assertIn("if: ${{ always() }}", self.text)

    def test_nothing_in_it_reaches_dev_production_or_a_secret(self):
        self.assertNotIn('secrets.', self.text)
        self.assertNotIn('leqcwgzvjsxugfgzdmth', self.text)
        self.assertNotIn('sb_publishable', self.text)
        self.assertNotIn('service_role', self.text)

    def test_the_label_and_the_honesty_words_are_in_the_header(self):
        self.assertIn('DISPOSABLE EMULATOR evidence', self.text)
        self.assertIn('NEVER real-provider evidence', self.text)


class DeviceSafetyContract(unittest.TestCase):
    def test_no_journey_driver_is_ever_imported(self):
        for path in HERE.glob('*.py'):
            if path.name.startswith('test_'):
                continue
            body = read(path)
            for forbidden in ('p6_native_journey', 'ru5_android_device_ui_journey', 'd03_chat_android_journey', 'qa_device'):
                self.assertNotRegex(body, rf'^\s*(?:import|from)\s+{forbidden}\b', f'{path.name} imports {forbidden}')

    def test_pm_clear_exists_exactly_once_and_behind_the_guard(self):
        body = read(HERE / 's03_device.py')
        self.assertEqual(body.count("'pm', 'clear'"), 1)
        guard = body.index('def clear_app_data')
        self.assertLess(guard, body.index("'pm', 'clear'"))
        self.assertLess(body.index('may_clear_app_data', guard), body.index("'pm', 'clear'"))

    def test_the_driver_refuses_anything_that_is_not_an_emulator(self):
        body = read(HERE / 's03_device.py')
        self.assertIn('is_emulator', body)
        self.assertIn('RefusedDevice', body)

    def test_adb_output_is_never_printed(self):
        for name in ('s03_device.py', 's03_android_proof.py'):
            body = read(HERE / name)
            self.assertNotRegex(body, r'print\(\s*(?:self\.)?adb')

    def test_every_catalog_row_is_in_the_readme_table_with_the_same_words(self):
        readme = HERE / 'README.md'
        self.assertTrue(readme.exists())
        text = read(readme)
        for check in core.CATALOG:
            where = 'HTTP-level' if check['level'] == 'HTTP' else 'emulator'
            row = f"| `{check['id']}` | {where} | {check['kind']} | {check['title']} |"
            self.assertIn(row, text, check['id'])

    def test_the_folder_is_lf_text(self):
        for path in HERE.iterdir():
            if path.suffix in ('.py', '.sh', '.json', '.md', '.txt'):
                self.assertNotIn(b'\r', path.read_bytes(), path.name)


if __name__ == '__main__':
    unittest.main()
