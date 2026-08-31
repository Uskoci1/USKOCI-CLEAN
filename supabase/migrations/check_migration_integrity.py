#!/usr/bin/env python3
"""Verify canonical migration bytes, provenance metadata, and history/file parity."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / "MD5_MANIFEST.txt"
PROVENANCE = ROOT / "MIGRATION_PROVENANCE.json"
NAME_RE = re.compile(r"^(\d{14})_([a-z0-9_]+)\.sql$")
LINE_RE = re.compile(r"^([0-9a-f]{32})  (\d{14}_[a-z0-9_]+\.sql)$")


def fail(message: str) -> None:
    print(f"FAIL migration_integrity: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    manifest_entries: list[tuple[str, str]] = []
    seen_names: set[str] = set()
    seen_versions: set[str] = set()

    for line_number, line in enumerate(MANIFEST.read_text(encoding="utf-8").splitlines(), 1):
        match = LINE_RE.fullmatch(line)
        if not match:
            fail(f"invalid manifest line {line_number}: {line!r}")
        checksum, filename = match.groups()
        version_match = NAME_RE.fullmatch(filename)
        assert version_match is not None
        version = version_match.group(1)
        if filename in seen_names:
            fail(f"duplicate manifest filename: {filename}")
        if version in seen_versions:
            fail(f"duplicate migration version: {version}")
        seen_names.add(filename)
        seen_versions.add(version)
        manifest_entries.append((checksum, filename))

    manifest_names = [filename for _, filename in manifest_entries]
    if manifest_names != sorted(manifest_names):
        fail("manifest filenames are not sorted")

    disk_names = sorted(
        path.name for path in ROOT.iterdir()
        if path.is_file() and NAME_RE.fullmatch(path.name)
    )
    if manifest_names != disk_names:
        missing = sorted(set(manifest_names) - set(disk_names))
        extra = sorted(set(disk_names) - set(manifest_names))
        fail(f"manifest/file mismatch missing={missing} extra={extra}")

    manifest_map = {filename: checksum for checksum, filename in manifest_entries}
    for filename in disk_names:
        raw = (ROOT / filename).read_bytes()
        if b"\r" in raw:
            fail(f"CR byte found; LF-only contract violated: {filename}")
        actual = hashlib.md5(raw).hexdigest()
        if actual != manifest_map[filename]:
            fail(
                f"raw MD5 mismatch {filename}: "
                f"expected={manifest_map[filename]} actual={actual}"
            )

    metadata = json.loads(PROVENANCE.read_text(encoding="utf-8"))
    contract = metadata.get("checksum_contract", {})
    if contract.get("scope") != "raw physical migration file bytes":
        fail("provenance checksum scope is not raw physical bytes")

    history = metadata.get("live_history_snapshot", {})
    history_entries = history.get("entries", [])
    history_names = [
        f"{item['version']}_{item['name']}.sql" for item in history_entries
    ]
    if history.get("migration_count") != len(history_entries):
        fail("live history count does not match entry count")
    if history_names != disk_names:
        fail("live history snapshot does not exactly match canonical migration files")
    if history.get("last") != history_entries[-1]:
        fail("live history last entry is inconsistent")

    reconstructions = metadata.get("reconstructions", [])
    if len(reconstructions) != 1:
        fail("expected exactly one recorded-statement reconstruction")
    reconstruction = reconstructions[0]
    if reconstruction.get("classification") != "RECORDED_STATEMENT_RECONSTRUCTION":
        fail("191500 classification is not recorded-statement reconstruction")
    if reconstruction.get("exact_byte_mirror") is not False:
        fail("191500 must not claim exact-byte mirror")
    reconstruction_file = reconstruction["file"]
    if reconstruction.get("canonical_reconstruction_raw_md5") != manifest_map.get(reconstruction_file):
        fail("191500 reconstruction checksum does not match raw manifest")
    if reconstruction.get("legacy_manifest_md5") == manifest_map.get(reconstruction_file):
        fail("191500 legacy checksum was incorrectly promoted to canonical raw checksum")
    if len(reconstruction.get("recorded_statement_md5", [])) != 7:
        fail("191500 recorded statement evidence is incomplete")

    closure = metadata.get("forward_closure", {})
    closure_file = closure.get("file")
    if closure.get("raw_md5") != manifest_map.get(closure_file):
        fail("forward closure checksum does not match raw manifest")
    if history_names[-1] != closure_file:
        fail("forward closure is not the final live history snapshot entry")

    print(
        "PASS migration_integrity "
        f"files={len(disk_names)} "
        f"live_snapshot={len(history_entries)} "
        "191500=RECORDED_STATEMENT_RECONSTRUCTION "
        "exact_byte_mirror=false"
    )


if __name__ == "__main__":
    main()
