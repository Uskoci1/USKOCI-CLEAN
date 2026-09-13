"""Keep participant mutation guards strict for the reviewed 143/146 reads."""
import contextlib
import io
import unittest
from pathlib import Path

from check_migration_integrity import check_later_participant_contract


class ParticipantContractTests(unittest.TestCase):
    support = "20260913045824_clean_v5_support_case_authority.sql"
    erasure = "20260913081147_clean_v5_event_bound_account_erasure.sql"
    read = "select rls_private.need_participant_can_read(n.id) from public.needs n;"

    def rejected(self, filename, sql):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            check_later_participant_contract(filename, sql)

    def test_one_explicit_support_read_does_not_replace_authority(self):
        check_later_participant_contract(self.support, self.read)

    def test_exact_146_source_copy_fence_retains_participant_authority(self):
        sql = Path(__file__).with_name(self.erasure).read_text(encoding="utf-8")
        self.assertIn("create function private.closure_support_source_fence_v5", sql)
        self.assertEqual(sql.count("rls_private.need_participant_can_read(n.id)"), 1)
        check_later_participant_contract(self.erasure, sql)

    def test_146_exception_rejects_mutations_extra_and_changed_reads(self):
        for change in (
            "drop policy needs_participant_read on public.needs;",
            "drop function rls_private.need_participant_can_read(uuid);",
            "create or replace function rls_private.need_participant_can_read(uuid) returns boolean;",
            "alter function rls_private.need_participant_can_read(uuid) security invoker;",
            self.read,
        ):
            with self.subTest(change=change):
                self.rejected(self.erasure, self.read + change)
        self.rejected(self.erasure, "select true;")
        self.rejected(self.erasure, self.read.replace("n.id", "other.id"))

    def test_additional_reference_is_not_a_blanket_exception_for_143(self):
        for change in (
            "drop policy needs_participant_read on public.needs;",
            "drop function rls_private.need_participant_can_read(uuid);",
            "create or replace function rls_private.need_participant_can_read(uuid) returns boolean;",
            "alter function rls_private.need_participant_can_read(uuid) security invoker;",
            self.read,
        ):
            with self.subTest(change=change):
                self.rejected(self.support, self.read + change)

    def test_other_migration_still_requires_explicit_contract_review(self):
        self.rejected("20260914000000_future.sql", self.read)

    def test_removed_or_changed_support_dependency_fails_closed(self):
        self.rejected(self.support, "select true;")
        self.rejected(self.support, self.read.replace("n.id", "other.id"))

    def test_unrelated_later_migration_is_allowed(self):
        check_later_participant_contract("20260914000000_future.sql", "select 1;")


if __name__ == "__main__":
    unittest.main()
