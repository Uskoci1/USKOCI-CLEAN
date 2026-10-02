"""Offline tests of the HTTP-level proof (EX-07 S03) against an in-process model of GoTrue + Mailpit (fakes.py).

They prove the SCRIPT: that it is green on a provider that behaves as designed and red - for the right assertion - when one
rule is broken. They are not evidence about the real provider; only the CI run is.
"""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import fakes
import s03_core as core
import s03_http as net
import s03_provider_proof as proof


def run(**config):
    clock = fakes.FakeClock()
    provider = fakes.FakeProvider(clock, **config)
    http = net.Http(provider.transport)
    secrets = core.SecretSet()
    report = core.Report('HTTP', {'source': {'head': 'test', 'runId': '0'}}, secrets)
    ctx = proof.Ctx(net.GoTrue(http, 'http://127.0.0.1:54321', 'anon'), net.Mailbox(http, 'http://127.0.0.1:54324', clock), clock,
                    report, secrets, suffix='t1')
    ctx.mail.clear()
    proof.run_all(ctx)
    return report.finalize(), provider, secrets


def status_of(data, check_id):
    return next(a for a in data['assertions'] if a['id'] == check_id)['status']


def row(data, check_id):
    return next(a for a in data['assertions'] if a['id'] == check_id)


class BehavesAsDesigned(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.provider, cls.secrets = run()

    def test_every_check_is_green_and_the_result_is_pass(self):
        bad = [(a['id'], a['status'], a['detail']) for a in self.data['assertions'] if a['status'] not in ('PASS', 'OBSERVATION')]
        self.assertEqual(bad, [])
        self.assertEqual(self.data['result'], 'PASS')

    def test_every_http_check_of_the_catalog_is_reported(self):
        ids = [a['id'] for a in self.data['assertions']]
        self.assertEqual(ids, [c['id'] for c in core.CATALOG if c['level'] == 'HTTP'])

    def test_the_expiry_window_really_elapsed_on_the_clock(self):
        self.assertGreaterEqual(row(self.data, 'P08')['observed'].get('waitedSeconds', 0), core.OTP_EXPIRY_SECONDS)

    def test_observations_record_what_the_provider_does(self):
        p14 = row(self.data, 'P14')['observed']
        self.assertTrue(p14['otherSessionRevoked'])
        self.assertTrue(p14['recoverySessionSurvivesPasswordChange'])
        self.assertFalse(row(self.data, 'P09b')['observed']['olderLinkStillConfirms'])
        self.assertEqual(row(self.data, 'P10b')['observed']['accepted'], [])

    def test_the_report_holds_no_credential(self):
        text = json.dumps(self.data)
        for session in self.provider.sessions.values():
            self.assertNotIn(session['access'], text)
            self.assertNotIn(session['access'].split('.')[1], text)
            self.assertNotIn(session['refresh'], text)
        for user in self.provider.users.values():
            self.assertNotIn(user.password, text)
        self.assertEqual(self.secrets.find_in_text(text), [])

    def test_a_single_message_was_sent_for_the_first_signup(self):
        mails = [m for m in self.provider.messages if m['To'][0]['Address'] == 'ex07-s03-a-t1@example.test']
        self.assertEqual(len(mails), 1)
        self.assertEqual(self.provider.users['ex07-s03-a-t1@example.test'].confirmed, True)

    def test_unconfirmed_accounts_stay_unconfirmed(self):
        for tag in ('wrong', 'expired-signup', 'cross-signup'):
            self.assertFalse(self.provider.users[f'ex07-s03-{tag}-t1@example.test'].confirmed, tag)


class BreaksOneRule(unittest.TestCase):
    def assertFinds(self, config, *failing):
        data, _, _ = run(**config)
        for check_id in failing:
            self.assertEqual(status_of(data, check_id), 'FAIL', f'{config}: {check_id} should FAIL; {row(data, check_id)}')
        self.assertEqual(data['result'], 'FINDINGS')
        return data

    def test_email_autoconfirm_is_a_finding_on_the_settings_check(self):
        data, _, _ = run(confirmations=False)
        self.assertEqual(status_of(data, 'P01'), 'FAIL')
        self.assertEqual(data['result'], 'FINDINGS')

    def test_a_foreign_redirect_that_is_echoed_is_a_finding(self):
        self.assertFinds({'echo_foreign_redirect': True}, 'P10')

    def test_a_reusable_link_is_a_finding(self):
        self.assertFinds({'links_are_reusable': True}, 'P06', 'P12')

    def test_ignoring_expiry_is_a_finding(self):
        self.assertFinds({'ignore_expiry': True}, 'P08', 'P12')

    def test_no_resend_limit_is_a_finding(self):
        self.assertFinds({'no_frequency_limit': True}, 'P09')

    def test_tokens_in_the_query_are_a_finding(self):
        data = self.assertFinds({'tokens_in_query': True}, 'P05', 'P11')
        self.assertEqual(status_of(data, 'P06'), 'PASS')       # unrelated rules are still judged on their own

    def test_a_confirmation_without_tokens_is_a_finding(self):
        self.assertFinds({'confirm_without_tokens': True}, 'P05')

    def test_cross_type_acceptance_is_a_finding(self):
        self.assertFinds({'accept_cross_type': True}, 'P15')

    def test_an_hourly_email_limit_is_a_harness_problem_not_a_finding(self):
        data, _, _ = run(hourly_limit=3)
        self.assertEqual(data['result'], 'HARNESS_BROKEN')
        errors = [a for a in data['assertions'] if a['status'] == 'ERROR']
        self.assertTrue(errors)
        self.assertTrue(any('PROVIDER_EMAIL_HOURLY_LIMIT' in a['detail'] for a in errors))
        self.assertEqual([a for a in data['assertions'] if a['status'] == 'FAIL'], [])

    def test_provider_session_rule_variants_are_recorded_not_judged(self):
        data, _, _ = run(revoke_other_sessions=False, recovery_session_survives=False, supersede_on_resend=False)
        p14 = row(data, 'P14')['observed']
        self.assertFalse(p14['otherSessionRevoked'])
        self.assertFalse(p14['recoverySessionSurvivesPasswordChange'])
        self.assertTrue(row(data, 'P09b')['observed']['olderLinkStillConfirms'])
        self.assertEqual(data['result'], 'PASS')           # these are observations, never a verdict

    def test_a_scenario_that_cannot_complete_marks_all_its_checks_error(self):
        clock = fakes.FakeClock()
        provider = fakes.FakeProvider(clock)
        http = net.Http(provider.transport)
        secrets = core.SecretSet()
        report = core.Report('HTTP', {}, secrets)
        ctx = proof.Ctx(net.GoTrue(http, 'http://127.0.0.1:54321', 'anon'), net.Mailbox(http, 'http://127.0.0.1:54324', clock), clock, report, secrets)

        def boom(_ctx):
            raise RuntimeError('network gone')
        proof.run_all(ctx, [('boom', ('P02', 'P03'), boom)])
        self.assertEqual(report.results['P02']['status'], 'ERROR')
        self.assertIn('network gone', report.results['P03']['detail'])
        self.assertEqual(report.timeline[0]['outcome'], 'ERROR')


class EntryPoint(unittest.TestCase):
    ENV = {'EX07_API_URL': 'http://127.0.0.1:54321', 'EX07_MAIL_URL': 'http://127.0.0.1:54324', 'EX07_ANON_KEY': 'anon'}

    def test_refuses_a_non_loopback_target(self):
        with mock.patch.dict(os.environ, {**self.ENV, 'EX07_API_URL': 'https://leqcwgzvjsxugfgzdmth.supabase.co'}):
            self.assertEqual(proof.main(), 2)
        with mock.patch.dict(os.environ, {k: v for k, v in self.ENV.items() if k != 'EX07_ANON_KEY'}, clear=False):
            os.environ.pop('EX07_ANON_KEY', None)
            self.assertEqual(proof.main(), 2)

    def test_http_layer_refuses_foreign_hosts_and_ports(self):
        http = net.Http(lambda *a: (_ for _ in ()).throw(AssertionError('must not be reached')))
        for url in ('https://leqcwgzvjsxugfgzdmth.supabase.co/auth/v1/settings', 'http://127.0.0.1:5432/x',
                    'http://localhost:54321/auth/v1/settings', 'http://10.0.2.2:54321/auth/v1/settings'):
            with self.assertRaises(ValueError):
                http.request('GET', url)

    def test_main_writes_the_report_and_exits_zero_on_pass(self):
        clock = fakes.FakeClock()
        provider = fakes.FakeProvider(clock)
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {**self.ENV, 'EX07_OUT': tmp, 'GITHUB_RUN_ID': '777'}):
            code = proof.main(transport=provider.transport, clock=clock)
            report = json.loads((Path(tmp) / 'provider-report.json').read_text(encoding='utf-8'))
        self.assertEqual(code, 0)
        self.assertEqual(report['result'], 'PASS')
        self.assertEqual(report['source']['runId'], '777')
        self.assertEqual(report['label'], 'DISPOSABLE EMULATOR evidence')
        self.assertTrue(report['source']['head'])

    def test_main_exits_one_on_a_finding(self):
        clock = fakes.FakeClock()
        provider = fakes.FakeProvider(clock, links_are_reusable=True)
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {**self.ENV, 'EX07_OUT': tmp}):
            self.assertEqual(proof.main(transport=provider.transport, clock=clock), 1)


class Helpers(unittest.TestCase):
    def test_hourly_limit_is_told_apart_from_the_frequency_limit(self):
        self.assertTrue(proof.is_hourly_limit('email rate limit exceeded'))
        self.assertFalse(proof.is_hourly_limit('For security purposes, you can only request this after 10 seconds.'))

    def test_verify_outcome_classification(self):
        error = net.VerifyOutcome('REDIRECT', 303, 'uskociapp://auth?form=login#error=access_denied&error_code=otp_expired',
                                  core.classify_callback('uskociapp://auth?form=login#error=access_denied&error_code=otp_expired'))
        self.assertTrue(error.refused)
        self.assertFalse(error.has_session_tokens)
        ok = net.VerifyOutcome('REDIRECT', 303, 'x', core.classify_callback('uskociapp://oporavak#access_token=aaaaaaaaaaaa&refresh_token=bbbbbbbbbbbb&type=recovery'))
        self.assertTrue(ok.has_session_tokens)
        self.assertFalse(ok.refused)
        self.assertTrue(net.VerifyOutcome('JSON_ERROR', 403, None, None, 'otp_expired').refused)
        self.assertFalse(net.VerifyOutcome('UNEXPECTED', 200, None, None).refused)


if __name__ == '__main__':
    unittest.main()
