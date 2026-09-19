"""Reuse the recorded live80-87 aliases and pending order after the shared live79 setup.

Disposable localhost only. This is source147, not a claim of a full DEV164 replay.
"""
import json
import os
import subprocess
from pathlib import Path

root = Path(os.environ["GITHUB_WORKSPACE"])
db = os.environ["DB_URL"]
assert db == "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
provenance = json.loads((root / "supabase/migrations/MIGRATION_PROVENANCE.json").read_text(encoding="utf-8"))


def sql(body):
    return subprocess.run(["psql", db, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At"],
                          input=body, text=True, capture_output=True, check=True).stdout.strip()


def apply(entry):
    version, name = entry["version"], entry["name"]
    file = entry.get("file") or f"{version}_{name}.sql"
    body = (root / "supabase/migrations" / file).read_text(encoding="utf-8")
    tag = "$pkg023jstmt$"
    assert tag not in body
    print(f"apply_source={file} recorded_as={version}_{name}", flush=True)
    subprocess.run(["psql", db, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f",
                    str(root / "supabase/migrations" / file)], check=True)
    sql(f"insert into supabase_migrations.schema_migrations(version,name,statements) "
        f"values ('{version}','{name}',array[{tag}{body}{tag}]);")


assert sql("select count(*)::text || '/' || max(version) from supabase_migrations.schema_migrations") == "79/20260906141409"
aliases = [e for e in provenance["live_history_snapshot"]["entries"] if e["version"] > "20260906141409"]
assert len(aliases) == 8
for entry in aliases:
    apply(entry)
assert sql("select count(*) from supabase_migrations.schema_migrations") == "87"
for entry in provenance["pending_forward_migrations"]:
    apply(entry)
assert sql("select count(*) from supabase_migrations.schema_migrations") == "147"
print("PASS SOURCE147_REPLAY")
