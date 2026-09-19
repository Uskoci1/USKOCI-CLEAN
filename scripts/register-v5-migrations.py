"""Register explicit, unapplied V5 candidates without rewriting history or SQL."""
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'supabase' / 'migrations'
metadata_path = root / 'MIGRATION_PROVENANCE.json'
manifest_path = root / 'MD5_MANIFEST.txt'
metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
manifest = {line.split('  ', 1)[1]: line.split('  ', 1)[0] for line in manifest_path.read_text().splitlines()}
pending = metadata['pending_forward_migrations']
baseline = metadata['live_history_snapshot']
for name in sys.argv[1:]:
    match = re.fullmatch(r'(\d{14})_(clean_v5_[a-z0-9_]+)\.sql', name)
    if not match:
        raise SystemExit('Only explicitly named V5 migration candidates may be registered.')
    data = (root / name).read_bytes()
    if not data.strip() or b'\r' in data:
        raise SystemExit('Candidate must be nonempty LF-only SQL: ' + name)
    md5 = hashlib.md5(data).hexdigest()
    existing = next((row for row in pending if row['file'] == name), None)
    if existing and existing.get('live_applied') is not False:
        raise SystemExit('Refusing to rewrite applied history: ' + name)
    row = dict(existing or {}, version=match[1], name=match[2], file=name,
               classification='PENDING_FORWARD_MIGRATION', live_applied=False,
               predecessor_live_migration_count=baseline['migration_count'],
               predecessor_live_head=baseline['last']['version'],
               note='Unapplied V5 candidate. Frozen historical87 replay preserved; physical canonical108 at V5 start. Requires exact-source proof. Owner AF-D26 authorizes canonical DEV/ALPHA promotion; separate production remains outside scope.',
               raw_md5=md5, raw_sha256=hashlib.sha256(data).hexdigest(), raw_bytes=len(data))
    if existing:
        existing.update(row)
    else:
        pending.append(row)
    manifest[name] = md5
pending.sort(key=lambda row: row['file'])
metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
manifest_path.write_text(''.join(f'{digest}  {name}\n' for name, digest in sorted(manifest.items())), encoding='utf-8', newline='\n')
print('Registered explicit unapplied candidates:', len(sys.argv) - 1)
