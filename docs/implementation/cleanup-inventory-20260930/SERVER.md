# SERVER - canonical DEV read-only inspection (Supabase `leqcwgzvjsxugfgzdmth`)

> Cleanup pass **C2 preparation** (plan 7.3 / 7.4 "Supabase" / 7.6). This file **proposes**; it changes nothing. Every DELETE/DEPRECATE below is marked **needs owner approval + rollback plan** and belongs to C2, which "touches the server only with compatibility and approval" and only after P6 is closed. Applied migration history, the closure certificate, retention/legal-hold material and the P6 candidates/proofs are **out of scope for removal** (they are KEEP throughout).

## 0. What was actually run

| Item | Value |
|---|---|
| When | 2026-09-30, about 10:12-10:27 UTC |
| Target | canonical DEV/ALPHA project `leqcwgzvjsxugfgzdmth` (eu-central-1, PostgreSQL 17.6, status ACTIVE_HEALTHY, created 2026-08-25) |
| Tools | Supabase MCP `get_project`, `list_edge_functions`, `get_advisors` (security + performance) and `execute_sql` with **SELECT statements only** on catalogs (`pg_proc`, `pg_policies`, `pg_class`, `pg_depend`, `pg_index`, `pg_stat_*`, `pg_stat_statements`, `cron.job(_run_details)`, `storage.*`, `vault.secrets` **names only**, `supabase_migrations.schema_migrations`), plus the read-only unified-log query for postgres/edge logs (aggregates only; no IPs, tokens or row data were copied). |
| Not run | no `apply_migration`, no deploy, no DDL/DML, no `pg_terminate_backend`, no `vault.decrypted_secrets`, no secret values read. |
| Repo side | function names were cross-checked with `rg`-style scans of the pinned tree `fc58f411` (`src/`, `supabase/functions/`, `supabase/proofs|candidates|operations`, `scripts/`, `.github/`) and with `git log -S` on `src/`. |
| Integrity of the transcribed lists | the 248 public + 261 private function names copied for the offline analysis were verified against database checksums (name lists md5 `af0c2b1c...` / `4f379e23...`, SECURITY DEFINER counts 238 / 202). The 210-version ledger list matches md5 `2c852258...`. |
| Machine-readable companion | `SERVER_FUNCTIONS.tsv` (509 rows: schema, name, SECURITY DEFINER, EXECUTE grantees, search_path pinned, trigger function, callers found in the database and in code, certified-closure flag, proposed decision + reason). |

Caveat that applies to everything below: DEV has **5 accounts, 35 tasks, 7 agreements and a 48 MB database (8.9 MB of application tables)**. Runtime statistics (`pg_stat_*`) therefore say very little about production behaviour, and `track_functions = none`, so **no per-function call counters exist**; "zero calls" is never used here as proof (plan 7.2).

## 1. Snapshot

| Schema | Functions | SECURITY DEFINER | Tables | RLS on (forced) | Policies | Indexes | Triggers |
|---|---:|---:|---:|---|---:|---:|---:|
| `public` | 248 | 238 | 32 | 32 (3) | 79 | 98 | 81 |
| `private` | 261 | 202 | 91 | 86 (55) | 0 | 187 | 30 |
| `rls_private` | 1 | 1 | 0 | - | 0 | 0 | 0 |
| `storage` / `auth` / `realtime` / `cron` / `net` / `vault` / `extensions` | system-owned | | | | 13 storage+cron policies | | |

- Every one of the 510 custom functions is owned by `postgres` and **pins `search_path`** (0 exceptions).
- Migration ledger on DEV: **210 applied** (first `20260825115040`, last `20260927201531` = `dev_alpha_chat_p4_push_event_transport`; 123 since 2026-09-09). P6 (`rpc_discovery_v1`) is **not** applied (no such function), consistent with AGENTS.md. Repo migration file names use logical versions that differ from the apply-time versions on DEV (`MIGRATION_PROVENANCE.json` maps them), so version-string parity was not asserted here.
- `pg_stat_statements` (reset 2026-08-25, `track=top`, 4,871 of 5,000 entries, 14 evictions), table/index stats reset 2026-08-20.

## 2. Urgent observation (not a cleanup item): a runaway retry loop of one PostgREST backend

Evidence (all from read-only catalogs and logs):

1. `pg_stat_statements` under role `authenticated`: **191,094,759** executions of the PostgREST request prologue (`select set_config('search_path', ...)`) and **191,093,756** executions of `select "public"."rpc_closure_api_guard"()` (the API pre-request hook): 44.9 million ms = **12.5 hours of database time**; the same two statements account for about 99.99 % of all `authenticated` calls (382 M). Two samples 6.8 s apart (10:24:15 and 10:24:21 UTC) show **~378 guard calls per second right now**.
2. Postgres log: `ERROR: MEDIA_VERSION_CONFLICT` from `rpc_apply_profile_avatar`, SQLSTATE **40001**, application `PostgREST 14.5`, **exactly ~100 per second, 360,000 per hour, every hour, without a gap** - 8.6 million log lines in the last 24 h. The whole stream comes from **one backend process (pid 3480518, session started 2026-09-25 20:26:33 UTC)** whose state is "idle in transaction (aborted)". The first error is at **2026-09-25 20:27:25 UTC**; that is about 4.6 days, roughly 40 million failed attempts.
3. The public API gateway log (`edge_logs`) shows only **1,362 requests in 24 h** (1,359 x HTTP 200, one each 204/400/401: normal app traffic) and none for `rpc_apply_profile_avatar`; Edge function invocations are ~1,430/day (the once-a-minute worker tick). So the loop is not new client traffic through the gateway.
4. `public.rpc_apply_profile_avatar` (like `rpc_clear_profile_avatar` and `private.agreement_photo_context_v5`) raises the **non-transient** conflict `MEDIA_VERSION_CONFLICT` with `errcode='40001'` (serialization_failure), a class that HTTP servers/clients commonly auto-retry.

Re-check at 10:52 UTC (one more SELECT): the guard-call counter for `authenticated` had grown from 191,093,756 to 191,919,443 (+825,687 in about 28 minutes, roughly 490 per second) and backend 3480518 (started 2026-09-25 20:26:33 UTC) was still alive and `active`, so the loop was **still running** when this inventory was finished.

Interpretation (not proven): a single API request whose SQLSTATE 40001 conflict is retried indefinitely inside/around PostgREST. It costs about 10 % of one DB connection, floods logs and `pg_stat_statements`, and will distort every P6 performance/memory measurement taken on DEV.

Owner/P6-owner actions (**not** performed here; a terminate/restart or an errcode change is a write): (a) find and stop the origin; the quickest reversible stop is terminating backend 3480518 or restarting PostgREST in the dashboard; (b) in a future approved candidate use a non-retryable error (`P0001`, or PostgREST's custom `PT409`) for the three `MEDIA_VERSION_CONFLICT` sites; (c) add client backoff on 409/40001. None of this is a C0/C1 task.

## 3. Functions

### 3.1 Who can EXECUTE (public schema, 248 functions)

| Effective EXECUTE holders | Functions | Note |
|---|---:|---|
| `authenticated` only | 129 | the app RPCs (each SECURITY DEFINER function does its own account/party checks) |
| `authenticated` + `service_role` | 39 | shared RPCs used by the app and by Edge/tick |
| `service_role` only | 70 | Edge/worker/operations RPCs (`*_service`, retention, support operator, QA budget) |
| **`anon`** (with or without PUBLIC) | **3** | `rpc_get_legal_bundle` (AU, by design: pre-auth legal text), `rpc_closure_api_guard` (AUS, the API pre-request guard, certified), **`my_cloud_profile_bundle` (PAUS: PUBLIC + anon + authenticated + service_role, a legacy 2026-08-25 function; SECURITY INVOKER so RLS still applies)** |
| nobody (owner only) | 7 | four are **live implementation targets called by their wrappers** (see 3.3) and three are dead |

`private` (261 functions): only 4 have any API-role EXECUTE (`viewer_same_world` -> authenticated, used by a restrictive policy; `closure_redaction_allowed_v5` and `rpc_ru4b_record_materiality_decision_service` / `rpc_ru4b_record_policy_decision_service` -> service_role). The Supabase security advisor counts 166 authenticated-executable and 2 anon-executable SECURITY DEFINER functions in `public` (by design for an RPC-only API; see section 9).

### 3.2 Method for "no caller" (why grep 0 is not used alone)

1. **Client callers** = names found in `src/` production modules that are **reachable from `src/app` routes** (test-only modules do not count; see CLIENT_CODE.md).
2. **Edge callers** = names found in `supabase/functions/`.
3. **Database callers** = other function bodies (regex `\m<name>\M`), RLS policy expressions, triggers, `pg_depend` dependents (defaults, constraints, views), `cron.job` commands.
4. **Call-graph reachability** in SQL: roots = any EXECUTE grant to PUBLIC/anon/authenticated/service_role, any non-function dependent object, any cron reference; edges = body references; result **501 of 510 functions are reachable, 9 are not** (section 3.4).
5. Extra evidence: `git log -S` (when the client last touched the name), certified-closure list, and (noisy) `pg_stat_statements`.

### 3.3 Result

| Class | Count | Decision |
|---|---:|---|
| Public client-callable functions (171 = anon/PUBLIC/authenticated) with a route-reachable client caller or an Edge caller | 151 | KEEP |
| Public **client-callable functions with no live client and no Edge caller** | **20** | see the table below |
| Public service-only functions with an Edge caller (67 non-trigger service-only functions; 3 more service-only ones are trigger functions) | 48 | KEEP |
| Public service-only functions without an Edge caller | 19 | KEEP: retention, legal hold, processor map, account lineage, QA budget, support operator, push retire, export lease (operations tools; retention/hold must not be removed for tidiness) |
| "No grantee" functions | 7 | 4 KEEP (wrapper targets), 3 DEPRECATE->DROP candidates |
| Private functions | 261 | KEEP; 1 DROP candidate (`ru4b_assert_rate_authority_ready`), 5 staged PKG-051a helpers |

The 20 client-callable public functions without a live caller:

| Function | EXECUTE | Evidence | Proposed |
|---|---|---|---|
| `rpc_ai_open_conversation` | US | V1 opener; client last referenced 2026-09-11; 6 proofs/tools reference it | **DEPRECATE** (revoke first) |
| `rpc_ai_open_need_conversation_v2` | U | superseded by `..._owned_v2`; last client ref 2026-09-11; 1 wrapper still names it | **DEPRECATE** |
| `rpc_send_agreement_message` | US | V1; `_v2` is used; last client ref 2026-09-11 | **DEPRECATE** |
| `rpc_confirm_need_edit` | U | `..._from_review_v2` is used; last client ref 2026-09-18 | **DEPRECATE** |
| `rpc_get_push_device` | U | `..._owned` / `..._session_device` are used; last client ref 2026-09-10 | **DEPRECATE** |
| `rpc_list_my_agreements` | US | `_page` is used (about 1,000 calls); client dropped it only on **2026-09-24**, so older installed APKs may still call it | **DEPRECATE after client roll-over** |
| `my_cloud_profile_bundle` | **PAUS** | legacy; never referenced by the client (git history); anon/PUBLIC grant is unnecessary | **DEPRECATE** (revoke PUBLIC/anon at least) |
| `rpc_read_agreement_current_location`, `rpc_write_agreement_current_location`, `rpc_read_agreement_location_command` | U | UI retired (AGENTS.md R7); only test-only `src/data/agreementCurrentLocationService.ts` names them; backing `private.agreement_location_points` has 0 rows | **DEPRECATE** (with client service + 3 tests, CLIENT_CODE.md) |
| `rpc_list_my_applications_page`, `rpc_list_my_needs_page` | U | server-first paging, not wired yet (P6 plan 6.7) | KEEP (staged) |
| `rpc_activate_urgent`, `rpc_urgent_activation_preview` | US | HITNO / URGENT_BOOST capability of PKG-051 (payments off), never wired | KEEP (staged) |
| `rpc_get_my_safety_report` | U | never referenced by the client (git history) | KEEP / REVIEW with the safety flow owner |
| `fn_safety_need_grant_valid`, `is_my_task`, `rpc_agreement_invalidation_visible_v1`, `rpc_closure_api_guard`, `rpc_storage_account_open` | U/US/AUS | used by RLS policies (`rpc_storage_account_open`: 32 policy expressions), by other functions, or certified | KEEP |

**Every DEPRECATE row above (and every `DEPRECATE` / `DEPRECATE->DROP` row of `SERVER_FUNCTIONS.tsv`) needs owner approval + a rollback plan before anything is executed.** Rollback for a REVOKE is the recorded `GRANT` (the current grantees are in the TSV column `execute`); rollback for a DROP is a forward migration that re-creates the function from its recorded migration text and ACL.

### 3.4 Call-graph result: the only unreachable functions

| Function | Why unreachable | Decision |
|---|---|---|
| `public.rpc_ai_propose_fact` | EXECUTE revoked from all API roles, 0 references anywhere, last client ref 2026-09-18 | **DEPRECATE->DROP: needs owner approval + rollback plan** |
| `public.rpc_propose_agreement_change` | revoked, 0 references; `_v2` exists | same |
| `public.rpc_publish_need` | revoked, 0 references; `rpc_publish_need_canonical` exists | same |
| `private.ru4b_assert_rate_authority_ready` | no caller, no dependent object, RU-4b era helper | same |
| `private.platform_payments_enabled`, `platform_price_add_version`, `platform_price_canonical`, `platform_price_list_at`, `platform_price_versions` | PKG-051a price list is intentionally reader-less (payments off, "nothing reads the list yet") | KEEP (staged) |

**False positives that were checked and rejected**: `rpc_ai_apply_interview_turn_service`, `rpc_ai_apply_interview_turn_v2_service`, `rpc_confirm_need_edit_from_review`, `rpc_set_push_device` have no grantee and no client caller **but are called by live wrappers** (`rpc_ai_apply_legacy_need_turn_service`, `rpc_ai_complete_need_turn_v2_service`, `rpc_confirm_need_edit_from_review_v2`, `rpc_set_push_device_owned`, `rpc_rotate_push_device_owned`). They are internal implementation functions, not dead code.

### 3.5 Constraint that protects most of the surface: the certified closure digest

`private.closure_source_digest_v5()` hashes an **explicit list of 76 functions** (support, agreement-photo, closure/erasure, invalidation, `rpc_closure_api_guard`, `handle_uskoci_auth_user_updated`, ...) together with `closure_schema_digest_v5_139()` and `closure_erasure_program_digest_v5()` (which covers table ACLs). None of the DROP/DEPRECATE candidates above is in that list (verified against the function body), so dropping/revoking them does not move the certified digest. **Any change to one of the 76 functions or to a table ACL requires a recertification** (AGENTS.md: PKG045b, PKG-032, B3c). `SERVER_FUNCTIONS.tsv` carries a `certified_closure` column (76 rows = Y).

## 4. Tables, RLS and grants

| Item | public | private |
|---|---|---|
| Tables / RLS on | 32 / 32 | 91 / 86 (5 without RLS: internal helper/log tables) |
| Empty (0 live rows) | 4 | 45 (40 never written since 2026-08-20) |
| `anon` holds table privileges | **16 tables** | 0 |
| `authenticated` holds INSERT/UPDATE/DELETE | **10 tables** (8 with full ALL, `app_profiles`, `needs`) | 0 |
| `authenticated` holds TRUNCATE | **18 tables** | 0 |
| RLS policies that target `anon` or PUBLIC | **0** | 0 (cron's own `job` tables have the standard pg_cron policy) |
| Total size | 3.9 MB | 5.0 MB |

Reading: because **no policy exists for `anon`**, the broad anon grants are deny-by-default in practice; they are default Supabase grants that were only partially narrowed. The 11 tables where `anon` has all eight privileges are `access_grants`, `agreement_execution`, `agreement_messages`, `agreement_versions`, `agreements`, `app_accounts`, `dispatch_rounds`, `need_selections`, `need_sensitive`, `opportunity_deliveries`, `worker_match_preferences`; `authenticated` additionally holds `TRUNCATE` (not restricted by RLS, but not exposed by PostgREST) on 18 tables. **Proposal (C2, needs owner approval + recertification because table ACLs are inside `closure_erasure_program_digest_v5()`):** `REVOKE ALL ... FROM anon` on `public` tables and `REVOKE TRUNCATE, TRIGGER, REFERENCES ... FROM authenticated`; ship it together with the on-hold PKG045b so there is **one** recertification. Rollback = re-`GRANT` the recorded ACL (columns in this section are reproducible from `pg_class.relacl`).

Empty private tables (45) all belong to implemented-but-unexercised compliance/support features (support cases/commands/decisions, retention jobs/holds/policy rules, legal document versions, processor map, group chat, preselection Q&A commands, safety reports, media evidence, account blocks). **Each is referenced by at least one function body**, so none is dead; retention and legal-hold tables are explicitly not "surplus" (plan 7.3). `public.agreement_change_proposals` and `profile_availability_windows` are empty but referenced by policies.

Storage policies (11 on `storage.objects`): all `TO authenticated`, restrictive fences for agreement photos and the closure fence `v5_closure_storage_fence`; nothing for `anon`.

## 5. Indexes

- 285 indexes in `public`+`private` (4.7 MB). **5 exact duplicates** (same table, columns, operator classes, predicate):

| Pair (keep the constraint-backed one) | Proposal |
|---|---|
| `public.app_profiles_account_id_kind_key` = `public.idx_app_profiles_account_kind` | drop the plain twin |
| `public.dispatch_rounds_need_idx` = `public.dispatch_rounds_need_round_uq` | drop the plain twin |
| `private.need_revision_events_need_id_to_revision_key` = `private.need_revision_events_need_idx` | drop the plain twin |
| `private.processor_entry_provider_uq` = `private.processor_map_entries_map_idx` | drop the plain twin |
| `private.retention_policy_rules_policy_idx` = `private.retention_rule_class_uq` | drop the plain twin |

  All five are **DEPRECATE->DROP, needs owner approval + rollback plan** (rollback = recreate the recorded index; check first that `closure_schema_digest_v5_139()` does not fingerprint index names).
- The performance advisor lists 19 unused indexes and 91 foreign keys without a covering index (62 in `private`, 29 in `public`). On a 48 MB DEV database with 5 accounts these are noise, **not a removal basis**; they are recorded for the scale phase (P6/P7) only.

## 6. Cron, Vault, pg_net, Realtime, extensions

| Item | State |
|---|---|
| `cron.job` | 2 active jobs, both every minute: `uskoci_marketplace_tick` -> `private.marketplace_tick(25)` and `uskoci_edge_workers` -> `private.edge_worker_tick_v5()`. Last 24 h: 1,440 succeeded runs each (average 0.16 s and 0.58 s, maximum 10.7 s and 6.5 s). No failed run. Both are KEEP; they are why `marketplace_tick` and `edge_worker_tick_v5` have no other caller. |
| Edge workers called by the tick | `uskoci-data-export-worker`, `uskoci-push-transport`, `uskoci-account-closure-worker` through `net.http_post`, reading the Vault secret **names** `uskoci_edge_base_url` and `uskoci_edge_worker_key` (both present, created 2026-09-21; values were not read). |
| `pg_net` | 360 responses retained, request queue empty. |
| Realtime publication | `supabase_realtime` publishes exactly one table: `public.agreement_invalidations_v1` (B3c). |
| Extensions | `pg_cron 1.6.4`, `pg_net 0.20.4` (installed in schema `public` - advisor WARN), `pg_stat_statements`, `pgcrypto` (used by 71 functions), `plpgsql`, `postgis 3.3.7` (2 columns, 35 functions), `supabase_vault`, **`uuid-ossp` (0 functions and 0 column defaults use it; all 65 UUID defaults use `gen_random_uuid()`)** -> candidate to drop, low value, needs owner approval. |

## 7. Edge functions (11 deployed, all ACTIVE; source directories match 1:1)

| Function | Version | Created / updated | verify_jwt | Consumers found |
|---|---:|---|---|---|
| `uskoci-ai-interview` | 50 | 2026-09-01 / 09-22 | true | client (`aiNeedV2Production`, `aiNeedTurnStream`, ...) |
| `uskoci-worker-interview` | 17 | 09-13 / 09-22 | true | client (`workerAiClientService`) |
| `uskoci-publication-evaluate` | 14 | 09-10 / 09-21 | true | client (`aiTaskReviewClientService`) |
| `uskoci-location-search` | 14 | 09-10 / 09-13 | true | client (`productionLocationResolver`) |
| `uskoci-qa-classify` | 13 | 09-13 / 09-22 | true | client (`qaSubmissionClientService`) |
| `uskoci-speech-session` | 15 | 09-13 / 09-17 | true | client (`nativeSpeechAdapter`) |
| `uskoci-media` | 13 | 09-13 / 09-26 | true | client (`agreementPhotoClientService`, `mediaBinaryRead`, `mediaClientService`) |
| `uskoci-data-export-download` | 14 | 09-10 / 09-21 | true | client (`dataExportDeliveryService`) |
| `uskoci-data-export-worker` | 14 | 09-10 / 09-21 | **false** | client + cron tick (self-authenticates the server key on `apikey`, PKG-030) |
| `uskoci-push-transport` | 22 | 09-13 / 09-27 | **false** | cron tick only |
| `uskoci-account-closure-worker` | 3 | 09-16 / 09-21 | **false** | cron tick only |

Verdict: **no Edge function is a removal candidate.** The three `verify_jwt=false` workers are the documented secret-key workers. In the repo every `_shared` module is imported by a function; `_shared/voiceM4a.mjs` is imported only by its proof (voice is a mandatory, still-open V1 feature: staged, KEEP).

## 8. Storage

| Bucket | Public | Limits | Objects | Note |
|---|---|---|---:|---|
| `profile-media` | no | 5 MB, jpeg/png/webp | 14 (1.6 MB, newest 2026-09-30) | in use |
| `data-export-artifacts` | no | 8 MB, application/json | 0 | export feature not exercised yet; KEEP |

## 9. Advisors (Supabase linter, read-only)

| Lint | Level | Count | Comment |
|---|---|---:|---|
| `rls_enabled_no_policy` | INFO | 86 | `private` tables: RLS on with no policy = deny-all, by design |
| `authenticated_security_definer_function_executable` | WARN | 166 | RPC-only API design |
| `anon_security_definer_function_executable` | WARN | 2 | `rpc_closure_api_guard`, `rpc_get_legal_bundle` (both by design) |
| `extension_in_public` | WARN | 1 | `pg_net` in schema `public` |
| `auth_leaked_password_protection` | WARN | 1 | HaveIBeenPwned check is **off**: an Auth setting to switch on before public release (P7); an owner settings change |
| `auth_rls_initplan` | WARN | 22 | policies on 18 public tables (`needs`, `marketplace_responses`, `worker_match_preferences`, ...) re-evaluate `auth.uid()`/`current_setting()` per row; wrap in `(select ...)`. Relevant to P6 scale; changing policies needs approval and may touch certified surfaces |
| `multiple_permissive_policies` | WARN | 5 | `marketplace_responses`, `need_geography`, `need_requirement_details`, `need_sensitive`, `needs` |
| `unindexed_foreign_keys` | INFO | 91 | see section 5 |
| `unused_index` | INFO | 19 | see section 5 |

## 10. Server files in the repository (pinned tree)

| Path | Files / size | Decision |
|---|---|---|
| `supabase/migrations/` | 147 SQL + provenance JSON | KEEP forever (forward-only; applied history) |
| `supabase/candidates/` | 73 files, 0.9 MB | KEEP (exact applied/proposed candidate text; plan: do not delete candidate files) |
| `supabase/proofs/` | 343 files, 4.4 MB | KEEP now; P6 proofs stay while P6 is open; older proof families follow the workflow decisions in WORKFLOWS.md |
| `supabase/operations/dev-alpha/` | 38 files | KEEP (ledger receipts and manifest; read by `pkg023f` proof) |
| `supabase/functions/` | 20 files | KEEP |
| `supabase/*.md`, `supabase/RU0_SECURITY_DEFINER_EXECUTION_MANIFEST.csv` | 12 files, 0.12 MB | The 11 Markdown audit/coverage documents of the RU-0 era (`ADAPTIVE_DISPATCH_DESIGN`, `CUTOVER_MANIFEST`, `DONOR_COVERAGE_AUDIT`, `G1_G18_COVERAGE_MATRIX`, `MARKETPLACE_ENGINE_RECONCILIATION`, ...) are cited only by each other -> **ARCHIVE** to `docs/archive/`; the CSV is read by `supabase/proofs/check_ru0_static.py` -> **KEEP** |
| `supabase/staging/ru3/rs_publication_policy_minimum_owner_lock_v1.json` | 1 file | no code consumer found (the related `.md` under docs is a hard proof input) -> REVIEW |

## 11. Proposed C2 order, approvals and rollback (nothing before P6 ZAVRSEN and explicit owner authorization)

1. **Stop the retry loop** (section 2) - operational, may be done any time by the owner; not a cleanup.
2. **Take a schema-only dump + confirm the Supabase backup** before any DDL (a Git tag is not a database backup, plan 7.1).
3. **REVOKE-first deprecations** (reversible by `GRANT`): `my_cloud_profile_bundle` from PUBLIC/anon; the V1 RPCs after the installed APK has rolled over (`rpc_ai_open_conversation`, `rpc_send_agreement_message`, `rpc_confirm_need_edit`, `rpc_get_push_device`, `rpc_ai_open_need_conversation_v2`, `rpc_list_my_agreements`); the three current-location RPCs together with removing the test-only client service. Observe one release cycle.
4. **DROP** only functions with no supported consumer left: `rpc_ai_propose_fact`, `rpc_propose_agreement_change`, `rpc_publish_need`, `private.ru4b_assert_rate_authority_ready`, then the deprecated set. Rollback = forward migration re-creating the function from the recorded migration text plus its recorded ACL (`SERVER_FUNCTIONS.tsv`).
5. **Drop the 5 duplicate indexes** (rollback = recreate).
6. **Table ACL narrowing** (anon/TRUNCATE) bundled with PKG045b and one closure recertification; **never** as a stand-alone tidy-up.
7. **Not to be touched:** the 76 certified functions, retention/legal-hold/support/export tables and RPCs, PKG-051a staged helpers, the two cron jobs, the three worker Edge functions, all applied migrations.

## 12. Limits

- DEV only; no production/scale evidence. `track_functions = none`, so **no call counters exist for any function**; `pg_stat_statements` was used only qualitatively (it mixes API calls with DDL and my own catalog queries).
- Caller detection is name-based; a function invoked by an unknown external client (older APK, owner script, operator SQL) cannot be excluded, which is why every proposal is REVOKE-first and needs approval.
- The regex call graph over-connects (comments count), so the "unreachable" set is conservative (fewer findings, never more).
- The advisor output was aggregated from the saved report; individual per-table lists are available by re-running `get_advisors`.
