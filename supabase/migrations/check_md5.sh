#!/bin/sh
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 "$script_dir/check_migration_integrity.py"
exec python3 -m unittest discover -s "$script_dir" -p test_migration_integrity.py
