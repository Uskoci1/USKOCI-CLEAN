#!/usr/bin/env python3
"""Static/contract proof for the pending RU-0 authority closure."""

from __future__ import annotations

import csv
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260903130355_clean_ru0_authority_closure.sql"
MANIFEST = ROOT / "supabase/RU0_SECURITY_DEFINER_EXECUTION_MANIFEST.csv"
RUNTIME_PROOF = ROOT / "supabase/proofs/ru0_authority_closure_runtime_proof.sql"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"FAIL ru0_static: {message}")


def main() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    lower = sql.lower()

    require("\r" not in sql, "migration must be LF-only")
    require(lower.startswith("-- ru-0 authority closure."), "unexpected migration header")
    require(lower.rstrip().endswith("commit;"), "migration must end with COMMIT")
    require("56/20260901114029" in sql, "verified predecessor gate missing")
    require("lock table public.ai_conversations" in lower, "write serialization missing")
    require("in share row exclusive mode;" in lower, "write lock mode changed")

    required_fragments = (
        "create policy ai_conversations_owner_read",
        "create policy ai_action_proposals_owner_read",
        "create policy notification_deliveries_owner_read",
        "and status = 'draft'",
        "security invoker",
        "legacy_rpc_retired",
        "rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)",
        "rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)",
        "rpc_respond_agreement_change(uuid,boolean)",
        "ru0_preserved_row_counts",
        "ru0_preserved_function_hashes",
    )
    for fragment in required_fragments:
        require(fragment in lower, f"missing contract fragment: {fragment}")

    require("insert into public." not in lower, "business INSERT found in migration")
    require("update public." not in lower, "business UPDATE found in migration")
    require("delete from public." not in lower, "business DELETE found in migration")
    require("truncate " not in lower, "TRUNCATE found in migration")

    retired = {
        "rpc_ai_propose_fact",
        "rpc_publish_need",
        "rpc_propose_agreement_change",
    }
    for name in retired:
        pattern = rf"create or replace function public\.{name}\b[\s\S]*?security invoker"
        require(re.search(pattern, lower) is not None, f"{name} is not an invoker tombstone")

    with MANIFEST.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    require(len(rows) == 58, f"expected 58 manifest rows, got {len(rows)}")
    identities = {(row["schema"], row["function_name"], row["identity_arguments"]) for row in rows}
    require(len(identities) == 58, "duplicate manifest identity")
    require(sum(row["schema"] == "private" for row in rows) == 23, "private inventory drift")
    require(sum(row["schema"] == "public" for row in rows) == 35, "public predecessor inventory drift")

    retired_rows = {row["function_name"]: row for row in rows if row["class"] == "RETIRED"}
    require(set(retired_rows) == retired, "retired manifest set mismatch")
    for row in retired_rows.values():
        require(row["target_security_definer"] == "false", "retired function remains definer")
        require(
            row["anon_execute"] == row["authenticated_execute"] == row["service_role_execute"] == "false",
            "retired function remains executable",
        )

    ai_writer = next(row for row in rows if row["function_name"] == "rpc_ai_apply_interview_turn_service")
    require(ai_writer["class"] == "SERVICE_COMMAND", "AI writer class drift")
    require(ai_writer["authenticated_execute"] == "false", "AI writer exposed to authenticated")
    require(ai_writer["service_role_execute"] == "true", "AI service writer lost")

    authenticated_names = {
        row["function_name"] for row in rows
        if row["target_security_definer"] == "true" and row["authenticated_execute"] == "true"
    }
    require(len(authenticated_names) == 25, "authenticated definer allowlist must contain 25 names")
    require("rpc_propose_agreement_change_v2" in authenticated_names, "Agreement v2 propose lost")
    require("rpc_respond_agreement_change" in authenticated_names, "Agreement respond lost")

    proof = RUNTIME_PROOF.read_text(encoding="utf-8")
    require("\r" not in proof, "runtime proof must be LF-only")
    require(proof.lower().rstrip().endswith("rollback;"), "runtime proof must end in ROLLBACK")
    require(not re.search(r"(?mi)^\s*commit\s*;", proof), "runtime proof contains COMMIT")
    for fragment in (
        "set local role authenticated",
        "set local role service_role",
        "direct conversation insert allowed",
        "raw owner update changed a published need",
        "legacy ai proposal rpc executable",
        "legacy publish rpc executable",
        "legacy agreement rpc executable",
        "attacker read conversation",
        "service ai writer did not remain authoritative",
    ):
        require(fragment in proof.lower(), f"runtime proof case missing: {fragment}")

    print(
        "PASS ru0_static "
        "migration=forward_only business_dml=zero "
        "manifest=58 retired=3 authenticated_sd=25 "
        "runtime_proof=rollback_only"
    )


if __name__ == "__main__":
    main()
