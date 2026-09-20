# Closure source digest on canonical DEV — forensic review (2026-09-19)

**Status: the review is done and the owner has ruled on it (2026-09-19, evening). His condition changed the
candidate: the three tables may be classified as `AUDIT_SECURITY_LOGS` and their structured audit metadata,
token counters and measured usage may stay under that contract, but the free-text operator note must not
automatically outlive a closure — it is nulled, deleted or replaced by a structured code with no user
content. `pkg023f` now does that as well, and §6, §7-F1 and §8 below are written against that version.**

**Status of the review itself: REVIEW ONLY. Nothing was re-certified while it was written.** The owner's order (2026-09-19): "nemoj samo promeniti
očekivani digest da bi `retention_ai_source_ready()` postao true … STOP pre stvarne re-overe i vrati mi
rezultat na pregled." Everything done on canonical DEV `leqcwgzvjsxugfgzdmth` for this review was a read-only
catalog or ledger query. The re-certification candidate exists as a file, is proven on a disposable database,
and is applied nowhere.

## 1. The answer, first

| Question | Answer | Proof |
| --- | --- | --- |
| Why is `retention_ai_source_ready()` false? | Only because the closure source digest no longer equals the certified value. Every other condition of that function is true. | §5 |
| What moved the digest? | Exactly: 3 new tables, 1 trigger, 5 new columns and 2 constraints, made by 5 `dev_alpha` migrations on 2026-09-17. Nothing else. | §5: with exactly those filtered out, the live digest function yields the certified value `68ae9916…` |
| Is there anything on DEV that no ledger row explains? | No. Source 147 + the exact ledger texts reproduces the whole DEV surface (3188 objects: bodies, grants, columns, constraints, triggers, policies, indexes). | §3, §4, CI |
| Do closure, erasure and retention still cover every table and column? | As found: no. The erasure program was untouched and the three additions were outside it and outside the closure dataset catalog. Two of them hold an operator's free text about a person. The owner ruled that this text must not survive a closure, so `pkg023f` puts the two lineage relations into the erasure program. | §6, §7-F1 |
| Is any new private data outside closure/retention behaviour? | Three account-keyed tables of operator and metering data are outside the catalog (F1) and outside the data export (F2). | §6, §7 |
| What did the drift break? | Since 2026-09-17 05:32 UTC no account closure could start on DEV (`CLOSURE_POLICY_NOT_READY`) and AI retention reports `SOURCE_NOT_READY`. Zero closure requests and zero executions exist, so nobody was affected. It also makes `pkg023c` refuse DEV, by design. | §2 |

## 2. How the certificate works, and what the digest can and cannot see

`private.closure_source_digest_v5()` is a sha256 over three parts:

1. `private.closure_schema_digest_v5_139()` — for **every** table of `public` and `private` (and
   `storage.objects`): each column (name, type, not-null, in order), each constraint definition, each trigger
   (name, definition, md5 of its function body).
2. `private.closure_erasure_program_digest_v5()` — 74 named functions plus every trigger function on a
   redaction relation (signature, body md5, owner, ACL, definer, strictness, volatility, language,
   configuration, argument and result types); **every** `public`/`private` table's owner, ACL and RLS flags;
   every trigger's enabled state.
3. the body md5 of 72 named functions.

The certified value is held in three places that must agree: `private.closure_source_v5.sha256`,
`private.closure_erasure_source_v5.sha256`, and a constant inside `private.retention_ai_source_ready()`. That
function also checks the shape of the five AI tables, their exact trigger list and three closure functions.
Its runtime consumers are `private.closure_erasure_binding_v5()` (null ⇒ `rpc_review_account_closure_execution`
answers `ready: false, code: CLOSURE_POLICY_NOT_READY` and a start is refused) and the AI retention executor
of source migration `20260910162955` (`NOT_READY / SOURCE_NOT_READY`).

The digest contains role and type OIDs, so its value is different in every database by construction; only
equality **within** one database means anything. It does **not** see: RLS policies, functions outside those
lists, plain indexes, or any data (F5).

Canonical DEV today: live `ac50680bd203fd67970cc41d5e49c4fd03e618ca888fd7239bb002c5572373f1`; certified, in
all three places, `68ae99163c0667ac9c80ef3de1976eefd087c8f58560269b86e4619bfe848d6e`; ready `false`; erasure
binding `null`; closure requests 0, executions 0. Last confirmed ready: 2026-09-16 (PKG-014 record; ledger 149
rows = 147 source + the two data operations of 2026-09-13).

## 3. The exact live content, reconstructed from the ledger

`supabase_migrations.schema_migrations` of canonical DEV holds 160 rows: 147 source and 13 `dev_alpha`. Each
`dev_alpha` row has exactly one statement element. The database computed `sha256` and length over that
element; the text was extracted and re-verified against both, and is now in the repository byte for byte:
`supabase/operations/dev-alpha/ledger/` and `LEDGER_MANIFEST.json` (which also gives the one query that
re-verifies it).

| Ledger version | Name | sha256 | Compared with the candidate that had been proven |
| --- | --- | --- | --- |
| 20260913100016 | `dev_alpha_confirmed_qa_ai_budget_activation` | `ac5f3915…` | identical to `supabase/operations/dev-alpha/20260913_enable_confirmed_qa_ai_budget.sql` |
| 20260913130812 | `dev_alpha_owner_ai_test_admission` | `2b85d3c6…` | **was in no file** |
| 20260917053239 | `dev_alpha_pkg015_account_lineage` | `44d0d359…` | differs: header comments; no `begin/commit` |
| 20260917055559 | `dev_alpha_pkg014b_ai_provider_usage` | `a0c616a2…` | differs: header comments; no `begin/commit` |
| 20260917104027 | `dev_alpha_pkg019_profile_bootstrap_truthful` | `2eaf951d…` | differs: header; no `begin/commit` |
| 20260917112919 | `dev_alpha_pkg019b_ai_test_reservation_settlement` | `ddb1ae98…` | differs **substantively**: DEV-state preconditions and a one-time settlement of the 20 existing holds |
| 20260917142520 | `dev_alpha_pkg019c_failed_reservation_release` | `f2131f46…` | **was in no file** |
| 20260917173759 | `dev_alpha_pkg019d_stt_audio_duration_settlement` | `c6f01554…` | **was in no file** |
| 20260917181212 | `dev_alpha_pkg015b_gap0042_world_boundary` | `719d122e…` | **was in no file** |
| 20260917230145 | `dev_alpha_pkg021_need_timestamp_fact_iso8601` | `b54658a3…` | identical but for the final newline |
| 20260919141813 | `dev_alpha_pkg023a_own_reads_paged` | `7e0e518c…` | identical but for the final newline |
| 20260919142333 | `dev_alpha_pkg023b_task_relations` | `a0f7f99f…` | identical but for the final newline |
| 20260919142713 | `dev_alpha_pkg023d_marketplace_bounded` | `f7bc5fe3…` | identical but for the final newline |

## 4. The ledger against the live state

`supabase/proofs/pkg023f_closure_recert/evidence/` holds the whole DEV surface of 2026-09-19 (3188 objects;
its md5 `f04811bd…` was computed by the database and matches the assembled file), the source-147 replay
surface (3113 objects, CI run 35446129464), and their difference, attributed statement by statement to the
ledger text that made it (`SURFACE_DIFF_DEV_VS_SOURCE147.md`, generated by `surface_diff.py`):
**9 changed, 75 added, 0 removed.**

- Attributed to a ledger text: 7 of the 9 changed, all 75 added.
- The other two are environmental and explained:
  - `private.retention_ai_source_ready()` — its body carries the certified digest, which is OID-dependent and
    so different in every database. With the constant masked, the DEV body and the source-147 body have the
    same md5 (`397094d2…`); the CI proof asserts this.
  - `public.rls_auto_enable()` — a platform event-trigger function. DEV's body md5 (`99be2067…`) is the one in
    the live evidence of 2026-09-07 (`docs/implementation/evidence/ai-live87-20260907/`); the disposable
    harness installs its own copy (`supabase/proofs/ru2_predecessor_bootstrap.sql`). Not in the digest.

**The stronger statement, proven on a disposable database (CI, §8):** a source-147 database on which the eight
schema-bearing `dev_alpha` texts and `pkg023` a, b, d are replayed has, object for object, the surface of
canonical DEV. Nothing on DEV is unexplained by the ledger. (The two `dev_alpha` rows of 2026-09-13 are data
operations on named DEV accounts; they create no object and are not replayed.)

## 5. Every change since the last certification, and whether the digest sees it

| Migration (2026-09-17 UTC) | What it made or changed | Seen by the digest |
| --- | --- | --- |
| `pkg015_account_lineage` 05:32 | tables `private.account_lineage_v5`, `private.account_lineage_events_v5` (RLS on and forced, all API roles revoked), trigger `account_lineage_events_v5_append_only`, index, 5 functions | **yes** — tables, columns, constraints, trigger. First drift. |
| `pkg014b_ai_provider_usage` 05:55 | table `private.ai_test_usage_v5` (same protection), index, 2 service functions | **yes** |
| `pkg019_profile_bootstrap_truthful` 10:40 | body of `public.handle_uskoci_auth_user_created()` (a trigger on `auth.users`) | no |
| `pkg019b_…reservation_settlement` 11:29 | `ai_test_reservations_v5`: `settled_microusd`, `settlement_basis`, `settled_at`, `…_settlement_check`; pricing function; 2 service function bodies; one-time data settlement | **yes** — 3 columns, 1 constraint |
| `pkg019c_failed_reservation_release` 14:25 | re-made `…_settlement_check` (adds `FAILED_NO_USAGE`); `rpc_ai_test_release_unused_reservation_service`; one-time data release | **yes** — the constraint's definition |
| `pkg019d_stt_audio_duration_settlement` 17:37 | `measured_audio_bytes`, `measured_transcript_chars`, `…_audio_measure_check`, re-made `…_settlement_check`; 2 functions; report body | **yes** — 2 columns, 2 constraints |
| `pkg015b_gap0042_world_boundary` 18:12 | 3 world functions; policy `needs_public_discovery`; bodies of `dispatch_cheap_candidate_admitted`, `rpc_get_public_profile`, `rpc_submit_response` | no (F5) |
| `pkg021_need_timestamp_fact_iso8601` 23:01 | bodies of `validate_need_v2_fact`, `rpc_ai_open_need_edit_conversation_v2` | no |
| `pkg023a`, `b`, `d` (2026-09-19) | 6 functions, 3 plain indexes | no — each asserts it on itself; digest `ac50680b…` before and after |

**The proof that this list is complete** is `supabase/proofs/pkg023f_closure_recert/closure_drift_reconstruction.sql`,
read-only, run on canonical DEV on 2026-09-19. It takes the live text of the three digest functions from
`pg_proc` and evaluates it twice:

| | value |
| --- | --- |
| control — unchanged text (must equal the live digest, or the method is unsound) | `ac50680b…` = live |
| reconstructed — the same text with exactly the additions above filtered out of its input | **`68ae9916…` = the certified value** |
| each of the five filters found its place exactly once | 1, 1, 1, 1, 1 |
| every other condition of `retention_ai_source_ready()` | `true` |

Had one more column, constraint, trigger, table, grant, owner, RLS flag, trigger state or listed function body
changed anywhere since the last certification, the reconstructed value would not be the certified one.

## 6. Do closure, erasure, retention and export still cover everything?

| Addition | What it holds | Who writes it | Key to a person | Protection | After an account closure, with `pkg023f` |
| --- | --- | --- | --- | --- | --- |
| `private.account_lineage_v5` | lineage class (`OWNER_PERSONAL` … `REAL_USER`), operator `reason` and `source_ref` text, revision, timestamps | service role only (`rpc_admit_account_lineage_service`) | `account_id` → `auth.users` ON DELETE CASCADE | RLS on + forced; no privilege for `anon`, `authenticated`, `service_role` | the row stays, keyed by the retained pseudonymous subject; the class, revision and timestamps stay; **`reason` and `source_ref` become `CLOSURE_ERASED_OPERATOR_NOTE` and `CLOSURE_ERASED_SOURCE_REF`** |
| `private.account_lineage_events_v5` | the same, as an append-only history | same | same | same, plus a trigger that refuses UPDATE and DELETE | the same erasure, through the one exception the trigger learns: the closure's own certified redaction. Every other UPDATE and every DELETE, for anyone, is still refused |
| `private.ai_test_usage_v5` | operation id, model name, three token counts, timestamp | service role only | same | same | stays: metering, not narrative, and the owner allows it to remain under the audit retention contract |
| `ai_test_reservations_v5` + 5 columns | settled amount, basis, time; audio **byte count** and transcript **character count** (numbers, never content) | service role only | `account_id` (no FK), as before | as before | stays, as the table did at the last certification |

On canonical DEV today: 5 lineage rows (2 owner, 1 QA, 2 synthetic fixtures), 5 history rows, none with
e-mail- or phone-like text; 99 usage rows for 2 accounts; 173 reservations for 3 accounts.

- **Erasure program** (`closure_redaction_relations_v5`, `closure_redaction_patch_v5`, 72+ functions): at the
  time of the review, byte for byte what was certified — that is what the reconstruction proves — and the
  additions were not in the redaction list. The reviewed precedent is `ai_test_reservations_v5`, equally
  keyed by `account_id`, certified outside the list ("unrelated global configuration/budget is absent"),
  while `ai_test_accounts_v5` is in it and is retired on closure. Nothing in the additions is content a
  person *wrote*; but two of them hold what an operator wrote *about* a person, and the owner ruled that
  this must not survive. `pkg023f` therefore adds the two lineage relations to
  `closure_redaction_relations_v5`, `closure_redaction_scope_v5` and `closure_redaction_patch_v5`, and
  teaches the append-only trigger the one exception the closure needs.
- **Closure dataset catalog** (`private.closure_dataset_catalog_v5`, the class of every account-linked table):
  every source migration that added such a table catalogued it; the `dev_alpha` migrations did not. A catalogue
  check over the live schema finds exactly three account-linked tables outside it — the three additions (F1).
- **Data export** (`20260913001000_clean_v5_owned_export_projection`): exports `testAdmission` and
  `testAllocations`, the latter with the literal `measuredProviderCharge: false`. Since `pkg019b` a reservation
  can be settled as `MEASURED`, so that literal is no longer true for those rows, and neither measured usage
  nor the lineage class is exported (F2).
- **Retention**: no retention period is defined for these tables, as none is for their siblings; AF-D22 stands
  and this review invents none.

## 7. Findings

| # | Finding | Severity | Proposed |
| --- | --- | --- | --- |
| F1 | Three account-linked tables are outside the closure dataset catalog, and two of them hold an operator's free text about a person that nothing would ever erase. | the gap the certificate exists to catch | **Ruled by the owner, 2026-09-19:** the class `AUDIT_SECURITY_LOGS` is confirmed; structured audit metadata, token counters and measured usage/charge may stay under the audit retention contract; the free text may not. `pkg023f` catalogues all three and erases `reason` and `source_ref` on closure into fixed codes. Nothing arbitrary a human typed survives a closure without a separate future decision. |
| F2 | The data export says `measuredProviderCharge: false` for every reservation and omits measured usage and lineage. | truthfulness of an export; DEV only today | a separate candidate after the owner decides what an export must contain. **Not part of the re-certification.** |
| F3 | `account_lineage_events_v5` has ON DELETE CASCADE from `auth.users` **and** a trigger that refuses DELETE: a HARD delete of a classified auth user (e.g. from the dashboard) would be refused with `ACCOUNT_LINEAGE_HISTORY_IMMUTABLE`. | latent; closure is unaffected — it erases the auth identity by UPDATE, proven end to end in CI | record; no change now. |
| F4 | `rpc_ai_test_release_unused_reservation_service` and `rpc_ai_test_settle_audio_service` are executable by `anon` and `authenticated` at ACL level: `pkg019c/d` revoked from `PUBLIC` only, and the platform's default privileges grant the API roles by name. **Both bodies refuse** anything but `service_role`; verified on DEV for both roles (`SERVICE_ROLE_REQUIRED`). | hygiene, not an exposure | a two-line forward candidate (`revoke … from anon, authenticated`); needs its own approval; does not move the digest. |
| F5 | RLS policies are outside the digest: `pkg015b` changed `needs_public_discovery` and the certificate did not notice. | informational: the certificate guards the closure inventory, not visibility | none; visibility is proven by its own proofs. |
| F6 | From 2026-09-17 05:32 UTC to now, no account closure could start on DEV and AI retention reports not-ready. 0 requests, 0 executions: nobody was affected. | operational, fail-closed as designed | ends with the re-certification. |
| F7 | The repository file of the 2026-08-25 auth bootstrap function is a reconstruction with mis-encoded Serbian letters, so a source replay never had byte for byte the function DEV ran (DEV body md5 on 2026-09-07 `73eacd1d…`, repository `a256174f…`). `pkg019` replaced that function whole on 2026-09-17, and DEV's body is now exactly the ledger's. | historical; explains why `pkg019`'s pinned predecessor md5 cannot match a replay | none; the CI proof substitutes that one pin and reports it. |

## 8. The re-certification candidate

`supabase/candidates/pkg023f_closure_recertification.sql`. It hard-codes no digest. Inside its own transaction
it proves, or commits nothing: (1) one certified value in all three places; (2) the digest has drifted and no
closure is executing; (3) the digest is the ONLY readiness condition that fails; (4) the additions have exactly
the reviewed shape (sha256 `00715283…` over every column, constraint, trigger, trigger body, trigger state and
RLS flag of the three tables, and the five columns and two constraints of the reservations table) and no API
role holds any privilege on them; (5) **the reconstruction**: the digest without the additions is the certified
value. Then it catalogues the three tables beside their siblings and writes the live digest into the three
places. It asserts afterwards that the readiness function changed in nothing but the constant, that the source
is ready, that the erasure binding exists and that the digest did not move.

It changes no table, column, constraint, trigger, policy, grant or other function, and the erasure program is
untouched.

**Proof on a disposable database** — `.github/workflows/pkg023f-closure-recertification-proof.yml`,
`supabase/proofs/pkg023f_closure_recert/pkg023f_closure_recert_proof.mjs`: **run 35455415211 on `3dbbff3b`,
11 of 11 checks green**, with PRE-P4 integrity green on the same commit (run 35455419735).

| Check | What it showed |
| --- | --- |
| source 147 | certified and ready; its readiness function is DEV's, constant aside |
| replay | all 13 ledger texts match the manifest's sha256; the eight schema-bearing `dev_alpha` texts ran from the exact ledger text and, since the F7 repair, **no predecessor pin had to be substituted at all**; then `pkg023` a, b, d |
| the whole surface | replay 3188 objects, canonical DEV 3188 objects, none only in the replay, none only on DEV |
| the drift | not ready, no erasure binding, the three certified places still hold the old value; the read-only reconstruction gives control = live and reconstructed = certified; an account cannot start a closure |
| refusals — each change made, refused, undone, certificate never moved | an unreviewed table, an unreviewed column on `needs`, RLS switched off elsewhere, a disabled trigger → `PKG023F_UNREVIEWED_CHANGE`; a column added to a reviewed table, the append-only trigger disabled → `PKG023F_REVIEWED_ADDITIONS_CHANGED_SHAPE`; a reviewed table granted to an API role → `PKG023F_REVIEWED_ADDITIONS_ARE_REACHABLE_BY_AN_API_ROLE`; the two certified tables disagreeing → `PKG023F_CERTIFIED_VALUES_DISAGREE` |
| certification | ready, erasure binding present, the digest in all three places; the surface differs in exactly the five function bodies and the catalog in exactly one row; no account-linked table is outside the catalog |
| a closure afterwards, end to end, through the real closure worker | an account with a lineage row, its history row, a measured usage row and a settled reservation: review ready, start, relational erasure verified, auth identity erased with the subject retained, `CLOSED`, no exception. **The operator's free text is gone** — not one character of it survives in either table — while the class, the revision, the history's from/to, the timestamps and the metering rows are exactly as they were |
| the history afterwards | an ordinary UPDATE, a DELETE and a class rewrite are all refused with `ACCOUNT_LINEAGE_HISTORY_IMMUTABLE` |
| once only, guard still live | a second application → `PKG023F_NOTHING_TO_RECERTIFY`; afterwards a new table, or a new column even on a reviewed table, makes the source not ready again |
| F4 (`pkg023g`) | anon and authenticated reach the body before and are denied at the door after; the service caller still works |
| F2 (`pkg023h`) | 22 exported allocation rows; before, every one claims nothing was measured; after, exactly the one `MEASURED` row says so, and the bases carried are `MEASURED`, `CONSERVATIVE_ESTIMATE_UNMEASURED`, `FAILED_NO_USAGE` |

The digest values differ from DEV's because the digest is OID-dependent; the candidate and the
reconstruction hard-code none.

## 9. Decided

1. **`pkg023f` is approved for canonical DEV, conditionally on the F1 change**, with the same procedure as
   a, b and d: the proof green, PRE-P4 green, a read-only preflight, apply, readback, `retention_ai_source_ready()`
   true, an end-to-end closure proof in a rolled-back transaction, and a demonstration that a later schema
   change drops readiness again.
2. **F1**: decided as above. `AUDIT_SECURITY_LOGS` confirmed; free text does not survive a closure.
3. **F2 and F4**: each its own small candidate, written and proven, **stopped before any DEV application** —
   `docs/implementation/v5-ai-first/pkg023/F2_F4_CANDIDATES_20260919.md`.
4. **F7**: the repository copy is repaired, the live function untouched —
   `docs/implementation/v5-ai-first/pkg023/F7_SOURCE_REPAIR_20260919.md`.
5. **F3, F5**: recorded, unchanged. F3 (a HARD auth delete of a classified account would be refused by the
   append-only trigger) stays true after `pkg023f`: the exception it learns is the closure's certified
   redaction, an UPDATE, and DELETE is still refused for everyone.
6. **F6** ends with the re-certification.

After the re-certification: `pkg023c` stops refusing DEV — it still needs its own approval, it backfills no
old task, and it must first be regenerated, because it pins the md5 of `closure_redaction_patch_v5`, which
`pkg023f` changes. The price basis comes after that, and only as section 8 of the plan describes, with the
old-APK compatibility design first.

## 10. Receipt — `pkg023f` on canonical DEV, 2026-09-19

Gates first: the proof 11/11 and PRE-P4 integrity green on `3dbbff3b`, then a read-only preflight in which
every value was what the candidate was written against — ledger 160, live digest `ac50680b…`, the certified
`68ae9916…` in all three places, ready false, binding null, zero closure executions, the four bodies at
their pinned md5, the reviewed additions at shape `00715283…`, 71 redaction relations with neither lineage
table among them.

| | |
| --- | --- |
| ledger row | `20260919164420 dev_alpha_pkg023f_closure_recertification`, ledger 161 |
| recorded text | 25 971 characters, sha256 `8f56a1d5ff01f77814287a2f5a2db65bb492eb825e35dcb4247b46cebfac8f6f` — **byte-identical to the candidate file** |
| the digest now | `9205c7dfa7c537a64bb848d62251c62b58e6c021d2e28f93691c5d54582012d5`, and the same value in `closure_source_v5`, `closure_erasure_source_v5` and the constant inside `retention_ai_source_ready()` |
| readiness | `private.retention_ai_source_ready()` = **true**; `closure_erasure_binding_v5()` present, adapter `OWNER_AF_D22_EVENT_ERASURE_V1`, its `sourceSha256` equal to the digest |
| the erasure program | 71 → **73** redaction relations, the two new ones being `private.account_lineage_v5` and `private.account_lineage_events_v5`, each scoped `t.account_id=$1`; `private.ai_test_usage_v5` deliberately not among them |
| the catalog | `AUDIT_SECURITY_LOGS` now carries the three tables beside `ai_test_accounts_v5` and `ai_test_reservations_v5`; no account-linked table is outside the catalog |
| everything else | the surface is still 3188 objects and **the md5 of every object except those five function bodies is unchanged** (`1a8ccb55561d4f75d493d2ecb7bc1b60`, computed before and after). No table, column, constraint, policy, grant or index moved, and the five kept their definer flag, volatility, `search_path` and ACL |
| data | untouched: 5 lineage rows, 5 history rows, none carrying an erased code, because no closure has run |

**The closure, end to end, in a transaction that was rolled back.** A synthetic subject was created inside
the transaction (a fresh `auth.users` row and a session; the bootstrap trigger made its account and two
profiles), an operator's note was written about it through the real service RPC, and then the real closure
RPCs ran as that person and as the service role:

| Step | Result |
| --- | --- |
| review | `ready=true`, no blockers, adapter `OWNER_AF_D22_EVENT_ERASURE_V1` — which was impossible on this database an hour earlier |
| start | `EXECUTING`, actions `RELATIONAL_REDACT` and `AUTH_IDENTITY_ERASE` |
| relational erasure | `VERIFIED`, **73 of 73 steps** |
| the operator's note | `reason=CLOSURE_ERASED_OPERATOR_NOTE`, `source_ref=CLOSURE_ERASED_SOURCE_REF`, in the row and in the history; **zero** occurrences of the note's text survive in either table |
| what stays | class `SYNTHETIC_ACCEPTANCE_FIXTURE`, revision 1, `admitted_at`, and the history's `(none)->SYNTHETIC_ACCEPTANCE_FIXTURE rev 1` |
| the person's own content | `app_accounts` email, full name and city empty; both profiles `CLOSED` |
| everyone else | 0 of the 5 real lineage rows touched |
| the auth identity | `AUTH_IDENTITY_ERASE` stayed `PENDING`: only the Edge worker can run it, which is why the true end-to-end closure, up to `CLOSED`, is proven in CI with real Auth, Storage and the worker |

Then the transaction was rolled back. Verified afterwards on DEV: no synthetic user, zero closure
executions, zero closure requests, 5 accounts, 5 lineage rows, none erased — and the certificate still
reads ready with the digest matching.

**The guard is as live as it was.** Each of these was made in its own subtransaction and undone:

| Change | `retention_ai_source_ready()` | closure binding |
| --- | --- | --- |
| nothing (control) | true | present |
| a new private table | **false** | null |
| a new column on a reviewed table | **false** | null |
| the erasure program tampered with | **false** | null |
| an ordinary UPDATE of the history outside a closure | refused, `ACCOUNT_LINEAGE_HISTORY_IMMUTABLE`; the history stayed as it was | — |

`pkg023c` must now be regenerated before it can be applied: it pins the md5 of
`private.closure_redaction_patch_v5`, which this changed. That is its preflight working.
