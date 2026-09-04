from pathlib import Path

# Proof-branch helper only; removed after the migration bytes are patched.
p = Path('supabase/migrations/20260904061000_clean_ru3_fail_closed_admission_infrastructure.sql')
s = p.read_text(encoding='utf-8')

repls = [
    (
        "create unique index publication_policy_one_active_per_jurisdiction\n  on private.publication_policy_bundles(jurisdiction)\n  where status='ACTIVE';",
        "create unique index publication_policy_single_active_bundle\n  on private.publication_policy_bundles((status))\n  where status='ACTIVE';"
    ),
    (
        "create table private.need_publication_decisions (\n  id uuid primary key default extensions.gen_random_uuid(),",
        "create table private.need_publication_decisions (\n  id uuid primary key default extensions.gen_random_uuid(),\n  decision_seq bigint generated always as identity unique,"
    ),
    (
        "(need_id,need_revision,need_fingerprint,bundle_id,created_at desc,id desc);",
        "(need_id,need_revision,need_fingerprint,bundle_id,decision_seq desc);"
    ),
    (
        "  select * into n from public.needs where id=p_need_id for share;",
        "  select * into n from public.needs where id=p_need_id for update;"
    ),
    (
        "   order by x.created_at desc,x.id desc\n   limit 1;",
        "   order by x.decision_seq desc\n   limit 1;"
    ),
]

for old, new in repls:
    count = s.count(old)
    if old.startswith('   order by x.created_at'):
        if count != 2:
            raise SystemExit(f'expected 2 decision-order matches, found {count}')
    elif count != 1:
        raise SystemExit(f'expected 1 match, found {count}: {old[:80]!r}')
    s = s.replace(old, new)

p.write_text(s, encoding='utf-8')
print('patched RU-3 decision ordering: per-Need serialization + monotonic decision_seq + single ACTIVE bundle')
