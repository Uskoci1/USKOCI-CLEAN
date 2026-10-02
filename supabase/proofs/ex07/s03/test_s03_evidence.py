"""Offline tests of the evidence merge (EX-07 S03): one document, honest about what ran, what was skipped on purpose and what died."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import s03_core as core
import s03_evidence as evidence


def green(level, head='abc123', run='9'):
    rep = core.Report(level, {'source': {'head': head, 'runId': run}, 'environment': {'kind': level}})
    for c in core.CATALOG:
        if c['level'] == level:
            rep.record(c['id'], 'PASS' if c['kind'] == 'assertion' else 'OBSERVATION')
    return rep.finalize()


JOBS_OK = {'offline-logic': 'success', 'provider-http-proof': 'success', 'native-apk': 'success', 'native-emulator-proof': 'success'}
FALLBACK = {'head': 'fallback', 'runId': '0'}


class MergeTests(unittest.TestCase):
    def test_both_green_is_pass_with_the_exact_head_run_and_label(self):
        out = evidence.build(green('HTTP'), green('EMULATOR'), JOBS_OK, FALLBACK)
        self.assertEqual(out['result'], 'PASS')
        self.assertEqual((out['source']['head'], out['source']['runId']), ('abc123', '9'))
        self.assertEqual(out['label'], 'DISPOSABLE EMULATOR evidence')
        self.assertTrue(out['claims']['androidEmulator'] and out['claims']['disposableGoTrueAndMailpit'])
        self.assertFalse(out['claims']['realProvider'] or out['claims']['physicalHandset'] or out['claims']['iOS'])
        self.assertEqual(len(out['assertions']), len(core.CATALOG))
        self.assertIn('the hosted Supabase Auth project', ' '.join(out['notEvidenceFor']))

    def test_a_dead_job_without_a_report_is_harness_broken_never_pass(self):
        out = evidence.build(green('HTTP'), None, {**JOBS_OK, 'native-emulator-proof': 'failure'}, FALLBACK)
        self.assertEqual(out['result'], 'HARNESS_BROKEN')
        self.assertFalse(out['claims']['androidEmulator'])
        self.assertTrue(all(a['status'] == 'NOT_RUN' for a in out['assertions'] if a['id'].startswith('E')))

    def test_a_scope_that_skips_a_part_is_partial_not_broken(self):
        jobs = {'offline-logic': 'success', 'provider-http-proof': 'success', 'native-apk': 'skipped', 'native-emulator-proof': 'skipped'}
        out = evidence.build(green('HTTP'), None, jobs, FALLBACK)
        self.assertEqual(out['result'], 'PARTIAL')
        self.assertFalse(out['claims']['androidEmulator'])
        native_only = {'offline-logic': 'success', 'provider-http-proof': 'skipped', 'native-apk': 'success', 'native-emulator-proof': 'success'}
        self.assertEqual(evidence.build(None, green('EMULATOR'), native_only, FALLBACK)['result'], 'PARTIAL')

    def test_an_emulator_job_skipped_after_a_failed_apk_is_not_on_purpose(self):
        jobs = {'offline-logic': 'success', 'provider-http-proof': 'success', 'native-apk': 'failure', 'native-emulator-proof': 'skipped'}
        out = evidence.build(green('HTTP'), None, jobs, FALLBACK)
        self.assertEqual(out['result'], 'HARNESS_BROKEN')
        self.assertTrue(any('native-apk' in n for n in out['notes']))

    def test_a_red_offline_job_taints_the_whole_document(self):
        out = evidence.build(green('HTTP'), green('EMULATOR'), {**JOBS_OK, 'offline-logic': 'failure'}, FALLBACK)
        self.assertEqual(out['result'], 'HARNESS_BROKEN')
        self.assertTrue(any('offline-logic' in n for n in out['notes']))

    def test_two_different_heads_are_flagged(self):
        out = evidence.build(green('HTTP', head='aaaaaaaaaaaa1'), green('EMULATOR', head='bbbbbbbbbbbb2'), JOBS_OK, FALLBACK)
        self.assertEqual(out['result'], 'HARNESS_BROKEN')
        self.assertTrue(any('different heads' in n for n in out['notes']))

    def test_a_finding_wins_over_everything(self):
        rep = core.Report('EMULATOR', {'source': {'head': 'abc123', 'runId': '9'}})
        for c in core.CATALOG:
            if c['level'] == 'EMULATOR':
                rep.record(c['id'], 'PASS' if c['kind'] == 'assertion' else 'OBSERVATION')
        rep.record('E10', 'FAIL', 'x')
        out = evidence.build(green('HTTP'), rep.finalize(), JOBS_OK, FALLBACK)
        self.assertEqual(out['result'], 'FINDINGS')

    def test_native_and_provider_facts_are_carried(self):
        native = green('EMULATOR')
        native['environment'] = {'apk': {'sha256': 'x'}, 'apkSource': 'abc123', 'device': {'sdk': '35'}, 'package': core.PACKAGE}
        provider = green('HTTP')
        provider['environment'] = {'gotrueImage': 'img', 'supabaseCli': '2.116.0', 'otpExpirySeconds': 60, 'maxFrequencySeconds': 10, 'allowlist': ['a']}
        out = evidence.build(provider, native, JOBS_OK, FALLBACK)
        self.assertEqual(out['native']['device'], {'sdk': '35'})
        self.assertEqual(out['provider']['gotrueImage'], 'img')


class MainTests(unittest.TestCase):
    def test_main_writes_the_document_and_the_exit_code_follows_the_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'provider').mkdir()
            (root / 'native').mkdir()
            (root / 'provider' / 'provider-report.json').write_text(json.dumps(green('HTTP')), encoding='utf-8')
            (root / 'native' / 'native-report.json').write_text(json.dumps(green('EMULATOR')), encoding='utf-8')
            env = {'EX07_PROVIDER_REPORT': str(root / 'provider' / 'provider-report.json'),
                   'EX07_NATIVE_REPORT': str(root / 'native' / 'native-report.json'),
                   'EX07_EVIDENCE_OUT': str(root / 'out'), 'EX07_JOB_RESULTS': json.dumps(JOBS_OK)}
            with mock.patch.dict(os.environ, env):
                self.assertEqual(evidence.main(), 0)
            document = json.loads((root / 'out' / 'ex07-s03-evidence.json').read_text(encoding='utf-8'))
            self.assertEqual(document['result'], 'PASS')
            self.assertEqual(document['jobs'], JOBS_OK)
            (root / 'native' / 'native-report.json').unlink()
            with mock.patch.dict(os.environ, env):
                self.assertEqual(evidence.main(), 1)

    def test_garbage_in_the_job_results_is_tolerated(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {
                'EX07_PROVIDER_REPORT': tmp + '/none.json', 'EX07_NATIVE_REPORT': tmp + '/none2.json',
                'EX07_EVIDENCE_OUT': tmp + '/o', 'EX07_JOB_RESULTS': '{not json'}):
            self.assertEqual(evidence.main(), 1)


if __name__ == '__main__':
    unittest.main()
