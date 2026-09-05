# USKOČI implementation continuity

## Current authoritative checkpoint — 2026-09-05 — POST RU-5 / P0C-02 LIVE

This file is the current forward continuity pointer. Older checkpoint sections in `HANDOFF.md`, `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md`, and earlier status files are retained as historical evidence even where they record live-71/live-72 or P0C-01/P0C-02-next state; they are superseded by this checkpoint, `CURRENT_IMPLEMENTATION_STATUS.md`, `RU_STATUS.md`, `LIVE_MIGRATION_STATE.json`, canonical GitHub state and fresh live Supabase reads.

### Canonical repository

- repository: `Uskoci1/USKOCI-CLEAN`
- branch: `clean-alpha-backend`
- P0C-02 final proof SHA: `2d6b1a64d9760bddcca1e4751945fdccc8a5e6ba`
- P0C-02 canonical merge: `bc784f3ed65d3a053195789740fae17e4df235d3`
- proof run: `33982216558` — PASS
- PR PRE-P4: `33982373215` — PASS
- PR CodeQL: `33982372198` — JS/TS, Python and Actions PASS
- canonical push PRE-P4: `33985675818` — PASS
- canonical push CodeQL: `33985675330` — JS/TS, Python and Actions PASS

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- migration count: `73`
- head: `20260905190040_clean_ru5_atomic_application_submit`
- canonical source migration: `20260905190000_clean_ru5_atomic_application_submit.sql`
- canonical raw MD5: `1a397f893deb3109b8984035c19111bb`
- canonical UTF-8 bytes: `18107` including terminal LF
- live recorded statement MD5: `e573341dad8ed303d4c72f234e11b761`
- live recorded statement UTF-8 bytes: `18106`
- raw exact-byte identity: `FALSE` because the connected migration transport omitted only the terminal LF
- normalized identity proof: `md5(live_recorded_statement || E'\n') = 1a397f893deb3109b8984035c19111bb`, bytes `18107`

Fresh live postflight reconfirmed:

- `rpc_submit_response(...)` contains P0C-02 readiness, team-capacity, remaining-capacity, MY_PRICE equality, snapshot and `RESPONSE_RECEIVED` markers;
- `authenticated EXECUTE = YES`, `service_role EXECUTE = YES`, `anon EXECUTE = NO` on the canonical submit RPC;
- authenticated direct INSERT remains denied on `marketplace_responses` and `marketplace_response_versions`;
- `private.response_application_snapshots` exists with RLS enabled and no authenticated raw SELECT/INSERT grant;
- snapshot row count is `0`, proving no historical response/version backfill was performed by the migration;
- business counts remain `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`;
- D0140 inventory remains zero: `publication_policy_bundles=0`, `publication_policy_rule_refs=0`, `need_publication_decisions=0`;
- RU-4B governed inventory remains zero: questions/answer versions/policy decisions/materiality decisions/commands all `0`;
- D0140 production ALLOW remains fail-closed;
- RU-4B remains foundation-only / activation blocked;
- V1 monetization remains `FREE / 0 RSD`.

### RU-5 / P0C-02

Status: `CLOSED / CANONICAL / LIVE / DO NOT REDO`.

The closed unit proves the manual atomic Application submit contract admitted by the latest owner scope: current RU-1 Worker readiness, own-profile ownership, Need state/deadline/revision, own-Need denial, team capacity, remaining Need capacity, fixed `MY_PRICE` equality, semantic replay, direct-write denial, private immutable per-version self-declared snapshot, one deduplicated `RESPONSE_RECEIVED` event, and compatibility with existing Selection/Withdrawal lifecycle.

Existing historical Application versions were not rewritten or backfilled. Absence of a P0C-02 snapshot therefore remains `LEGACY_UNPROVEN`, not inferred trust.

P0C-02 does **not** claim to solve or activate bounded-note policy, hard calendar-conflict authority, D0140, RU-4B, monetization, Application AI, candidate projection or other later RU-5/RU-6 work.

### Exact next cursor

`RU-5 / P0C-03 — MY APPLICATIONS PROJECTION + WITHDRAW PORT`

Before any code or live write:

1. fresh-read current `marketplace_responses`/versions ownership and lifecycle states relevant to the Worker’s own Applications;
2. inspect `rpc_withdraw_response`, its semantic request-key/replay behavior and selected/closed/stale denial rules;
3. inspect current RLS/grants for own Application reads and direct write denial;
4. inspect W06 `moje-prijave` and the current data port/projection path;
5. reconcile exact canonical mapping for SUBMITTED/VIEWED/SHORTLISTED/STALE/WITHDRAWN/SELECTED/closed without inventing new lifecycle authority;
6. prove that a Worker sees own Applications only and that selected Applications cannot be withdrawn;
7. only after a concrete physical gap is identified, open the smallest P0C-03 proof branch.

The frozen forward blueprint identifies P0C-03 as `my_applications_projection_and_withdraw_port`. Bounded-note/calendar gaps remain separately tracked and are not to be silently mixed into this unit.

No RU-5B Application AI work is admissible until the manual RU-5 Application contract and dependent manual lifecycle units are proven.

### Safety locks that remain in force

- no D0140 production ALLOW activation;
- no RU-4B public Q&A activation;
- no monetization activation;
- no raw public `app_profiles` exposure;
- no direct client write bypass where RPC authority exists;
- no fake production fallback;
- no live Supabase write before proof/promotion discipline is satisfied.
