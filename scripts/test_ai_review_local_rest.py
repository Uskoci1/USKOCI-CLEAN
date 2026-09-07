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
