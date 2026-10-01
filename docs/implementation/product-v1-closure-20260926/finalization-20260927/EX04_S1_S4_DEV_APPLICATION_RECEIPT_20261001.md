# EX-04 S1-S4 - DEV application receipt (2026-10-01)

**Status: the four candidates are APPLIED to canonical DEV `leqcwgzvjsxugfgzdmth`, one atomic migration each, in the order S1, S2, S4, S3, on the owner's explicit PRIMENI. The closure/privacy certificate is unchanged (`58447d77…`) and ready. Ledger 215 -> 219. Every postflight returned `problems: []`. Nothing else was changed: no client flag, no APK, no HONOR run, no revert, nothing on PROD.**
Machine-readable twin: `supabase/operations/dev-alpha/ledger/20261001_ex04_s1_s4_application.receipt.json`. Source and proofs: `ROUND_75_EX04_S1_S2_PERSONAL_LISTS.md`, `ROUND_76_EX04_S3_S4_RATING_STATE_AND_CANDIDATES.md`.

## Authorization (owner, in chat, 2026-10-01)
> PRIMENI — ODOBRAVAM ex04a, ex04b, ex04d i ex04c NA DEV (leqcwgzvjsxugfgzdmth), tim redom S1 → S2 → S4 → S3. Odobrenje važi TAČNO za sledeće dokazane kandidate: ex04a `3e502e62…ab59`, ex04b `d0bc1e1b…4948`, ex04d `ff11ea47…4a09`, ex04c `e67eabec…17e6` (full hashes in the table below). Svaki primeni kao jednu atomsku migraciju. Pre SVAKOG paketa svež read-only preflight, predecessor pinovi, očekivani SHA256, nema drifta; posle SVAKOG read-only postflight mora vratiti `problems: []`, proveri zapisanu migraciju/readback, potvrdi da sertifikat ostaje nepromenjen i ready; na PRVOM mismatch-u, driftu ili neuspehu STANI.
> Ovim NE odobravam: uključivanje S1/S2/S4 feature flagova; APK; HONOR test; revert; promenu closure/privacy sertifikata; B09/PKG-049; pisani komentar D12; PROD; bilo koju drugu DEV promenu van ova četiri kandidata. Svaki eventualni revert traži novo posebno moje PRIMENI.

Earlier the same day a bare "Odobravam" (about 11:00Z) was not enough for the harness: the auto-mode classifier denied the preparation of the apply as *Modify Shared Resources*. I stopped with nothing applied (ledger 215, no ex04 object), said so first, and the message above is the answer to my request for the explicit B1-style approval.

## What was applied
| # | Package | What it changes | Migration version | sha256 of the approved candidate (LF, final newline trimmed) | Ledger |
| --- | --- | --- | --- | --- | --- |
| 1 | **S1 ex04a** Moji zadaci (A09) | rpc_list_my_needs_page completed IN PLACE (same signature, owner and ACL) + new private helper private.own_task_counts(uuid) | `20261001113449` | `3e502e62598fac40fdbfa47623904b736b0fb1e46c5d886f4e423ff0fa50ab59` | 215 -> 216 |
| 2 | **S2 ex04b** Moje prijave (B10) | the 4-argument rpc_list_my_applications_page DROPPED (no CASCADE) and the 5-argument one created in the same statement + new private builder private.own_application_rows(uuid) | `20261001113629` | `d0bc1e1bc4e919eba06559be807fc1c8e54a30b4a282ddc6f4e857e9f93d4948` | 216 -> 217 |
| 3 | **S4 ex04d** Prijave na zadatak (A11) | TWO NEW functions, nothing replaced: public.rpc_list_need_candidates_page(uuid,integer,timestamptz,uuid) and private.need_candidate_states_v5(uuid,uuid[]) | `20261001113815` | `ff11ea470d2afa09b6651a5f1b55bc68d19578862841e12a4c83287924564a09` | 217 -> 218 |
| 4 | **S3 ex04c** Ocene RC-03 (A01 + D01) | rpc_list_my_agreements_page and rpc_home_attention completed IN PLACE, additive keys only (ratingDue, ratings {due, dueAgreementId}); no function added | `20261001113949` | `e67eabecd7d820f9b2ea41b4ac4508459c7beadda5caf3ce72c848c8fc3317e6` | 218 -> 219 |

Each candidate is ONE `DO` statement with exact predecessor pins, the certificate checked unchanged and exact delta accounting inside its own transaction; none touches a table, column, constraint, trigger, policy, index, privilege of an existing object or any data.

## Method, per package
1. Fresh read-only preflight: the predecessor pins (and, from S2 on, the intact new bodies of the earlier packages), the absence of the new objects, the certificate (`live = certified`, ready), the ledger.
2. The statement sent is a 568/570-character guard `DO` block followed by the approved candidate (LF text from `git show HEAD:<file>`, final newline trimmed). The guard raises unless the span from its marker has the approved length and sha256, so a transcription error could not have run. It was sent as ONE `apply_migration`.
3. Readback of the stored ledger row: one element; its sha256 equals the locally built statement; the span after the marker has the approved length and sha256; nothing follows the span.
4. The candidate's own read-only postflight file: `problems: []`. The certificate unchanged and ready.

| Package | Preflight (UTC) | Applied (UTC, from the version) | Postflight (UTC) | sha256 of the stored statement | Result |
| --- | --- | --- | --- | --- | --- |
| S1 | 2026-10-01T11:33:09Z | 11:34:49Z | 11:35:24Z | `4d55af3eed0aa92b…` | problems [] |
| S2 | 2026-10-01T11:35:37Z | 11:36:29Z | 11:37:17Z | `2ad69506885029ec…` | problems [] |
| S4 | 2026-10-01T11:37:30Z | 11:38:15Z | 11:38:43Z | `db03fc0f1cf4b434…` | problems [] |
| S3 | 2026-10-01T11:39:02Z | 11:39:49Z | 11:40:19Z | `9aaadf7aeb806ba9…` | problems [] |

Stored statement lengths: S1 10,480, S2 16,834, S4 17,095, S3 18,023 characters (guard 568/570 + candidate 9,912 / 16,264 / 16,525 / 17,453).

## Common final postflight (2026-10-01T11:42:14Z) - `problems: []`
20 pins (the new bodies and every dependency pin); the attributes and the ACL of the 5 client-callable readers (SECURITY DEFINER, STABLE, `search_path = pg_catalog`, owner postgres, ACL postgres + authenticated) and of the 3 private functions (postgres only); `anon` and `service_role` cannot execute any of the 8; `authenticated` can execute exactly the 5 readers; the old 4-argument applications reader is gone and there is exactly one `rpc_list_my_applications_page` and exactly two `need_candidate_states_v5`; the comment of `rpc_home_attention` is kept; no non-draft application without `submitted_at`; ledger 219 with the four migrations in the order S1, S2, S4, S3.

## Certificate (DIGEST): unchanged and ready
`private.closure_source_v5.sha256` = `private.closure_erasure_source_v5.sha256` = `private.closure_erasure_binding_v5()->>sourceSha256` = the one 64-hex literal in `private.retention_ai_source_ready()` = live `private.closure_source_digest_v5()` = `58447d7730e909a0c0e60dd92ef77416af927471bd6f645988448e32c6e3cb46` (the value bound by Voice B1 at 07:00Z); `retention_ai_source_ready()` true. No recertification was needed or done.

## Real DEV data, read-only (the pages against the whole-list reads)
- **S1**: rpc_list_my_needs_page(ALL, 100) minus sortAt EQUALS rpc_list_my_tasks() for all 5 accounts that have data (tasks 1, 6, 9, 19, 0); the five tab counts add up (total = active + drafts + history) for every account
- **S2**: rpc_list_my_applications_page(ALL, 100) has the same order by applicationId as rpc_list_my_applications() and ZERO differences in every key of the whole-list item for the 3 accounts that have applications (6, 4, 4 applications); counts total/attention/active/finished returned
- **S3**: every Dogovor of the page carries a boolean ratingDue (16 items over the four accounts that have Dogovori); for the two accounts with finished Dogovori (4 finished each) ratingDue equals rpc_get_my_agreement_review(...).eligible for every finished one (0 due and 1 due), is false for every unfinished one, and rpc_home_attention ratings.due equals the authority count (0 and 1) with dueAgreementId = the one due Dogovor
- **S4**: for the 3 requesters with applications (11 tasks, 14 applications; states SELECTABLE 3, SELECTED 8, STALE 2, WITHDRAWN 1) the first page of rpc_list_need_candidates_page minus sortAt EQUALS rpc_list_need_candidates for every task, counts.total equals the whole count, hasMore false
- **limit**: DEV holds very little data (5 accounts, 35 tasks, 14 applications, 8 Dogovori), so no list crossed a page boundary here; that is proved on the disposable chain (limits 1-100, ties, a change between pages).
- Method: read-only SELECT statements run through the connector with the claims of each account set transaction-locally (set_config), anonymised 8-hex labels, counts and booleans only; no row content left DEV.

## Existing data untouched
Accounts 5, profiles 10, tasks 35, applications 14, Dogovori 8, messages 10, reviews 7, voice uploads 0 (agreements 8, messages 10 and voice uploads 0 are the numbers recorded at the Voice B1 application); 124 tables, 114 triggers, 93 policies unchanged in kind; the Edge functions are the same 11 at the same versions. Security advisors: the same five lints as at the Voice B1 application (the authenticated-SECURITY-DEFINER lint now also lists the new readers like every other `rpc_*`; anon has no EXECUTE on any new function).

## Not proven (stated, not hidden)
- An HTTP/JWT-level call of the new or changed readers on DEV through PostgREST (a signed-in session is a separate step; the SQL-level parity above ran with the claims of each account). PostgREST picking the new function into its schema cache was not observed.
- Any native behaviour: the S1, S2 and S4 client flags are OFF in every build profile and nothing was built or installed; S3 is read by the next build that talks to this backend (its client has no flag, the data decides).
- Paging across a page boundary on real DEV data (the data is too small); that is proved on the disposable chain.
- Cost on production-sized data (the CI call counts are single samples).
- The revert of any of the four on DEV (the exact reverts exist, are proven on the disposable chain and are NOT applied).

## Revert (NOT applied)
The exact reverts exist and are proven on the disposable chain: S1 `supabase/candidates/ex04a_own_tasks_page_revert.sql` (`c790dfb9133793f10e57eca21b7e391fb4ecb49705675ec1902f9e12a7582f3e`), S2 `ex04b_own_applications_page_revert.sql` (`66e0bcdb0535f4242526ff22b3f748fcf0c20ef42164199f83bbca59abd8380a`; it re-creates the old 4-argument reader byte for byte), S4 `ex04d_candidates_page_revert.sql` (`086a5662d8a78d46d6688f6ab7e1983e8de16cc582bdb2124ca571173579b792`), S3 `ex04c_rating_state_revert.sql` (`3fe26a1d54e95772ad0b3fc20904a54b446ed5c6a446e61b8ad354ff43d3f84e`; it restores both old bodies byte for byte). Each needs its own, new PRIMENI from the owner.

## What this changes for the product, and what it does not
The paged own-task, own-application and candidate readers and the rating fact now exist on DEV. Nothing calls them yet: the client flags `EXPO_PUBLIC_EX04_OWN_TASKS_PAGED`, `EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED` and `EXPO_PUBLIC_EX04_CANDIDATES_PAGED` are OFF in every build profile, and S3's new keys are ignored by every client built so far (the P6 closure tag decoders read named fields only). Turning the three flags on in a DEV build profile, building an APK and the HONOR checks are separate steps that need the owner's approval and a window he grants.
