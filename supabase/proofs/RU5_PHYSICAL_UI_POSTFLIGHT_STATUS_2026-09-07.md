# RU-5 physical proof: Worker UI passed, SQL assertion column correction

## Exact evidence

Run `34081434929`, job `101617321599`, source `87a716294c27eba5c5b518ac423554883fcad242`.
Artifact `10004170567` was downloaded and verified: ZIP SHA-256 `d9e3acd57bb865c72aefbae2c259e387d8cd5669cfc6374b3a6b23346cbe392b` (841903 bytes).
`proof-build.txt` binds the run/source to APK SHA-256 `7a382656b34903442c3c6ce50e0b5d3ade7f0b02459ce7d3a6d129263d4113d0`.

All six available required PNG/XML pairs were inspected: AUTH_worker_authenticated, W03_worker_opportunity_list, W04_worker_need_detail, W05_worker_application_draft, W05_worker_application_success, W06_worker_own_application. The real app now shows the canonical five tabs above system navigation. Real worker login/workspace switch, opportunity/detail navigation, price 3000 / one-slot submission, success alert and own submitted Application are observed. No Requester selection or final Agreement/device closure is claimed.

The workflow passed migration integrity, TypeScript, 25 Jest suites / 162 tests, 14 Python input harness cases, 19 Node fixture-target cases, disposable live-79 reconstruction, APK build and local-only bundle validation. The journey failed in the read-only `assert_worker_submit()` SQL after W06. Its SELECT referenced `r.state`; the physical `marketplace_responses` column is `status`, as defined by `20260829183609_clean_response_foundation.sql` and used by the current submit RPC. The wrapper retained exit 1. Final UI/business validation was skipped; always-run disposable invariants passed.

## Minimal harness-only correction

Change exactly `r.state` to `r.status` in the assertion SELECT. Do not change any migration, production UI, client, Auth, RPC, allowed status, amount, coverage or fixture. The correction reads the existing schema rather than changing schema to satisfy a test. Whole journey must be executed again from the real login; no continuation from seeded business effects or manufactured success.

Eight local isolated function/model cases passed for the actual assertion: three allowed statuses, no row, wrong status, wrong price, wrong coverage and duplicate rows. Four Jest source-contract guards check physical column names against the canonical DDL, reject the historical `r.state` mutation, preserve the read-only Need/Worker binding and preserve strict outcome assertions. These are not real SQL or device execution. New full CI/device proof remains required.

## Scope and open gates

Canonical remains last observed `46ddea1a2688a3026c269c1235026142f0f3921c`; no PR or merge occurred. A fresh live Supabase read-only call in this continuation was safety-blocked, so production state is not freshly verified and no live promotion is allowed. No live writes were made.

Full physical UI unit remains NOT PROVEN; aggregate RU-5 remains NOT CLOSED / bounded-note DECISION-REQUIRED. Application AI, D0140 production ALLOW, RU-4B public Q&A, HITNO, monetization and retired FASTEST/AUTO_FILL remain outside this change. P0D03 zero-RSD Requester semantics are unchanged.
