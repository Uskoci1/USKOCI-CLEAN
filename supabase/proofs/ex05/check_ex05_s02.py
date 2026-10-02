#!/usr/bin/env python3
"""EX-05 S02 checker (the builder of this proof has nothing to generate: the SQL is built at run time from the chain, so this script checks instead).

  --check   every own file is ASCII, LF only, ends with a line feed, has no tab in code and no trailing carriage return; the pins file is valid JSON of the
            expected shape; the workflow names only its own files in its path filter and carries the label and the always-discard / always-upload steps.
            The round note docs/implementation/.../ex05/EX05_S02_* is byte-checked too (when present) but is deliberately NOT in the workflow path
            filter: an edit of a note must not start the 90-minute chain; the checker covers it whenever the chain runs for another reason.
  --syntax  every SQL statement the proof can send (emitted by ex05_s02_sql.mjs --emit-sql) and every function definition the proof rewrites (emitted by
            ex05_s02_emit.mjs from the repository sources) parses with pglast (PostgreSQL grammar, no database needed).

Exit status 0 only when everything asked for passes. Nothing here connects to a database.
"""
import argparse
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
PROOF_DIR = ROOT / "supabase" / "proofs" / "ex05"
WORKFLOW = ROOT / ".github" / "workflows" / "ex05-s02-rc02-proof.yml"
DOCS = ROOT / "docs" / "implementation" / "product-v1-closure-20260926" / "finalization-20260927" / "ex05"
OWN_PATH_FILTERS = {".github/workflows/ex05-s02-rc02-proof.yml", "supabase/proofs/ex05/**"}


def own_files():
    files = [p for p in sorted(PROOF_DIR.rglob("*")) if p.is_file() and "__pycache__" not in p.parts]
    files.append(WORKFLOW)
    files.extend(sorted(DOCS.glob("EX05_S02_*")))
    return files


def check_bytes(failures):
    for path in own_files():
        if not path.exists():
            failures.append("MISSING " + str(path.relative_to(ROOT)))
            continue
        data = path.read_bytes()
        rel = str(path.relative_to(ROOT))
        if any(b > 0x7F for b in data):
            failures.append("NOT_ASCII " + rel)
        if b"\r" in data:
            failures.append("CARRIAGE_RETURN " + rel)
        if b"\t" in data:
            failures.append("TAB " + rel)
        if not data.endswith(b"\n"):
            failures.append("NO_FINAL_LINE_FEED " + rel)
        if path.name == "nul":
            failures.append("FILE_NAMED_NUL " + rel)


def check_pins(failures):
    pins = json.loads((PROOF_DIR / "ex05_s02_pins.json").read_text(encoding="ascii"))
    if pins.get("unit") != "EX05_S02_PINS":
        failures.append("PINS_UNIT")
    if len(pins.get("functions", {})) != 42 or len(pins.get("triggers", {})) != 11:
        failures.append("PINS_COUNTS %d functions %d triggers" % (len(pins.get("functions", {})), len(pins.get("triggers", {}))))
    for name, pin in pins["functions"].items():
        if len(pin["md5"]) != 32:
            failures.append("PIN_MD5 " + name)
    if pins.get("devRead", {}).get("date") != "2026-10-02" or len(pins["devRead"].get("certifiedDigest", "")) != 64:
        failures.append("PINS_DEV_READ")


def check_workflow(failures):
    text = WORKFLOW.read_text(encoding="ascii")
    lines = text.split("\n")
    in_paths = False
    listed = set()
    for line in lines:
        stripped = line.strip()
        if stripped == "paths:":
            in_paths = True
            continue
        if in_paths:
            if stripped.startswith("- "):
                listed.add(stripped[2:].strip().strip("'\""))
            elif stripped and not stripped.startswith("#"):
                in_paths = False
    if listed != OWN_PATH_FILTERS:
        failures.append("WORKFLOW_PATH_FILTER " + json.dumps(sorted(listed)))
    for needle in ("NOT DEV", "DISPOSABLE", "permissions:\n  contents: read", "workflow_dispatch:", "Always discard the disposable database", "actions/upload-artifact@"):
        if needle not in text:
            failures.append("WORKFLOW_MISSING " + needle)
    if text.count("if: always()") < 2:
        failures.append("WORKFLOW_ALWAYS_STEPS")
    for forbidden in ("supabase db push", "supabase link", "SUPABASE_ACCESS_TOKEN", "secrets.", "leqcwgzvjsxugfgzdmth"):
        if forbidden in text:
            failures.append("WORKFLOW_FORBIDDEN " + forbidden)


def run_node(args):
    result = subprocess.run(["node"] + args, cwd=str(ROOT), capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError("node %s failed: %s" % (" ".join(args), result.stderr.strip()[:400]))
    return json.loads(result.stdout)


def check_syntax(failures):
    try:
        import pglast  # noqa: PLC0415
    except ImportError:
        failures.append("PGLAST_NOT_INSTALLED (pip install pglast==8.4)")
        return 0
    parsed = 0
    templates = run_node(["supabase/proofs/ex05/ex05_s02_sql.mjs", "--emit-sql"])
    definitions = run_node(["supabase/proofs/ex05/ex05_s02_emit.mjs"])
    if len(templates) < 60:
        failures.append("TEMPLATE_COUNT %d" % len(templates))
    if len(definitions) != 10:
        failures.append("DEFINITION_COUNT %d" % len(definitions))
    for name, text in {**templates, **definitions}.items():
        try:
            statements = pglast.parse_sql(text)
            if not statements:
                failures.append("EMPTY_PARSE " + name)
            parsed += 1
        except pglast.parser.ParseError as error:
            failures.append("SYNTAX %s: %s" % (name, str(error)[:200]))
    for name, text in definitions.items():
        node = pglast.parse_sql(text)[0].stmt
        if type(node).__name__ != "CreateFunctionStmt":
            failures.append("NOT_A_CREATE_FUNCTION " + name)
        if "'40001'" in text:
            failures.append("40001_LEFT_IN " + name)
    return parsed


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--syntax", action="store_true")
    args = parser.parse_args()
    if not (args.check or args.syntax):
        parser.error("nothing to do: pass --check and/or --syntax")
    failures = []
    if args.check:
        check_bytes(failures)
        check_pins(failures)
        check_workflow(failures)
        print("checked %d own files" % len(own_files()))
    if args.syntax:
        parsed = check_syntax(failures)
        print("parsed %d statements/definitions with pglast" % parsed)
    if failures:
        for failure in failures:
            print("FAIL " + failure)
        return 1
    print("PASS EX05_S02_CHECK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
