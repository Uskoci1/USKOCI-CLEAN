# PKG-014 execution log — canonical DEV alignment (2026-09-16)

Owner authorization of 2026-09-16 with strict conditions. This log records every live step in order,
with its read-only preflight and postflight. It is written as the work happens, not afterwards.

## 0. READ-ONLY IDENTITY PREFLIGHT — PASS

| Item | Value |
| --- | --- |
| Supabase project ref | `leqcwgzvjsxugfgzdmth` |
| Project name / organization | `My Project` / `ukrssymvijhrtarhuant` |
| Environment | canonical DEV/ALPHA |
| Project URL | `https://leqcwgzvjsxugfgzdmth.supabase.co` |
| Region / Postgres | `eu-central-1` / 17.6.1.165, status ACTIVE_HEALTHY |
| Migration ledger before the package | 146 rows, first `20260825115040`, last `20260913130812` `dev_alpha_owner_ai_test_admission` |
| Canonical DEV/ALPHA for PR #102 | yes: `EXPO_PUBLIC_SUPABASE_URL: https://leqcwgzvjsxugfgzdmth.supabase.co` in `.github/workflows/build-android-dev-apk.yml` on this branch, and the same host is the asserted target in seven mobile-proof workflows; `AGENTS.md` names it as the canonical DEV/ALPHA project |
| `uskoci-ai-interview` | version 32, `verify_jwt: true`, updated 2026-09-13T13:33:26Z |
| `uskoci-account-closure-worker` | ABSENT from the ten deployed functions |

Identity matches the expected canonical project, so the package was allowed to start.

## 1. Migration delta 145 → 147

Exactly three source files are missing live, confirmed by name-level diff of the full ledger:

| # | File | bytes | md5 |
| --- | --- | --- | --- |
| 145 | `20260913080237_clean_v5_self_reported_identity_requirement.sql` | 9832 | `2189779df4e06186c3fb50e635dcc90a` |
| 146 | `20260913081147_clean_v5_event_bound_account_erasure.sql` | 82670 | `d57b8120c1b48c2440a20e634e09bfc8` |
| 147 | `20260913081242_clean_v5_qa_owner_product_activation.sql` | 9640 | `b7538df7d24d247bb1f74ee4ba74accd` |

### 145 preflight — all ten predecessor checks PASS

`closure_source_v5.sha256` equals `closure_source_digest_v5()`; `retention_ai_source_ready()` true;
normalized `retention_ai_source_ready` body md5 `75b560d9a71baa045f8e7f80cd77aada`; export dataset
catalog 50 entries; `guard_ai_fact_schema` md5 `b2386ca23e82d730f876ea18e8855616`;
`rpc_prepare_ai_task_review` `536907c5…`; `rpc_accept_ai_task_review` `98483642…`;
`rpc_claim_ai_task_review_evaluation_service` `65d606ba…`; `private.ai_need_turn_context` `096edd5d…`;
`guard_unavailable_identity_requirement_v5` absent.

### 145 applied — schema effects VERIFIED, ledger row BLOCKED

The exact file bytes were executed. The file's own preflight block, which would have aborted the
transaction on any drift, passed, and the migration committed. Read-only postflight:

| Check | Result |
| --- | --- |
| `private.guard_unavailable_identity_requirement_v5()` exists | true |
| `guard_unavailable_identity_requirement_v5_trg` on `public.needs` | true |
| `retention_ai_source_ready()` | true |
| `closure_source_v5.sha256` equals `closure_source_digest_v5()` | true, re-pinned by 145 |
| `guard_ai_fact_schema` body changed | true |
| `private.ai_need_turn_context` body changed | true |
| `rpc_accept_ai_task_review` body changed | true |
| unrelated domains unchanged | `needs` 7 rows, `ai_structured_facts` 175, WORKER profiles 5, `ai_test_accounts_v5` 2, all identical to preflight |

**BLOCKER.** The ledger row for 145 could not be written. The write to
`supabase_migrations.schema_migrations` was refused by this session's permission classifier with
"Modify Shared Resources". The database therefore has migration 145 applied while the ledger still
shows 146 rows and does not list `20260913080237`.

This is an inconsistency, not a data hazard: no domain row changed, and a future `db push` would
re-attempt 145 and abort safely on its own predecessor checks. It must be repaired before 146 and 147
are applied, because each of them would hit the same refusal and deepen the gap.

The intended statement, which inserts the row only if the stored bytes are byte-identical to the
source file, is:

```
do $outer$
declare s text := $pkg014$<exact contents of 20260913080237_clean_v5_self_reported_identity_requirement.sql>$pkg014$;
begin
  if md5(s) <> '2189779df4e06186c3fb50e635dcc90a' then raise exception 'PKG014_LEDGER_BYTES_MISMATCH %', md5(s); end if;
  if exists(select 1 from supabase_migrations.schema_migrations where version='20260913080237') then raise exception 'PKG014_LEDGER_ROW_EXISTS'; end if;
  insert into supabase_migrations.schema_migrations(version,name,statements)
  values('20260913080237','clean_v5_self_reported_identity_requirement',array[s]);
end $outer$;
```

Recording the source version rather than a generated one keeps live parity with the source tree and
keeps `MIGRATION_PROVENANCE.json` and the PKG-013 admission manifest valid without a new alias.

## 2..7 Not started

Edge deployments, the admission entry, the stuck turn and the full postflight were not started. Per
the owner's condition 8 the sequence stops at the first mismatch instead of improvising around it.

## Live state at the stop

- Schema: source migrations 145 applied, 146 and 147 not applied.
- Ledger: 146 rows, missing the row for 145.
- Edge: unchanged, `uskoci-ai-interview` still version 32, closure worker still absent.
- Data: unchanged in every domain checked.
