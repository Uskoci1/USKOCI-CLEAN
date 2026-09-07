"""The optional native observer never expands its account/Agreement allowlist."""
import json
import unittest
from unittest.mock import Mock, patch
from scripts.d03_chat_outbox_observer import scoped_query, read_scoped_outbox

A='11111111-1111-4111-8111-111111111111'
G='22222222-2222-4222-8222-222222222222'


class OutboxObservationScope(unittest.TestCase):
    def test_query_is_one_key_and_one_read_only_row(self):
        self.assertEqual(scoped_query(A,G),f"SELECT value FROM Storage WHERE key='uskoci:agreement-outbox:v1:{A}:{G}' LIMIT 1;")

    def test_rejects_injection_or_other_apk_before_adb(self):
        with patch('scripts.d03_chat_outbox_observer.subprocess.run') as run:
            for actor,agreement in [(A+"';SELECT * FROM Storage;--",G),(A,G+'\n'),('',G)]:
                with self.assertRaises(ValueError):read_scoped_outbox(actor,agreement)
            with self.assertRaises(ValueError):read_scoped_outbox(A,G,package='rs.uskoci.production')
            run.assert_not_called()

    def test_missing_observer_reports_unavailable_without_a_database_dump(self):
        with patch('scripts.d03_chat_outbox_observer.subprocess.run',side_effect=[Mock(returncode=0,stdout='1'),Mock(returncode=1,stdout='',stderr='permission denied')]) as run:
            self.assertIsNone(read_scoped_outbox(A,G))
            args=run.call_args.args[0]
            self.assertEqual(args[:2],['adb','exec-out'])
            self.assertIn('-readonly',args[2]);self.assertIn('WHERE key=',args[2])
            self.assertNotIn('cat ',args[2]);self.assertNotIn('.dump',args[2]);self.assertNotIn('SELECT *',args[2])

    def test_only_correct_owner_projection_is_accepted(self):
        result={'version':1,'accountId':A,'agreementId':G,'entries':[]}
        with patch('scripts.d03_chat_outbox_observer.subprocess.run',side_effect=[Mock(returncode=0,stdout='1'),Mock(returncode=0,stdout=json.dumps(result))]):
            self.assertEqual(read_scoped_outbox(A,G),result)
        result['accountId']=G
        with patch('scripts.d03_chat_outbox_observer.subprocess.run',side_effect=[Mock(returncode=0,stdout='1'),Mock(returncode=0,stdout=json.dumps(result))]):
            with self.assertRaises(ValueError):read_scoped_outbox(A,G)

    def test_a_non_emulator_device_is_never_queried_for_storage(self):
        with patch('scripts.d03_chat_outbox_observer.subprocess.run',return_value=Mock(returncode=0,stdout='0')) as run:
            self.assertIsNone(read_scoped_outbox(A,G))
            run.assert_called_once()
            self.assertEqual(run.call_args.args[0],['adb','exec-out','getprop ro.kernel.qemu'])


if __name__=='__main__':unittest.main()
