# B24 — the candidate patch and its exact impact (2026-09-30)

Status: **PART 1 APPLIED TO CANONICAL DEV ON 2026-09-30 19:44Z (owner: "PRIMENI"; migration 20260930194403, ledger 212 -> 213, receipt `supabase/operations/dev-alpha/ledger/20260930_b24_part1_application.receipt.json`): 54 functions / 89 sites now raise PT409, the closure certificate is unchanged. PART 2 (14 certified functions, 21 sites, certificate re-bind) IS NOT APPLIED and needs his explicit "primeni deo 2".** Earlier wording kept below as the plan that was followed: candidate proven on a disposable stand-in (run 36752869572, source 160e74a8, RESULT PASS, 28 checks, 0 failed).

## The defect, in one paragraph
PostgREST 14 re-executes a request whose function raises SQLSTATE 40001, without limit and after the client has gone (disposable proof run 36745783626: +213,970 executions in 15 s, still going two minutes later; Supabase documents the same defect: PostgREST 14 affected, 16 fixed, use P0001 or `PT409`). The deployed functions raise 40001 on purpose for stale-version conflicts, so **one stale request to any of 32 authenticated RPCs pins a pooled connection and a database core, and a handful exhaust the pool.** On canonical DEV one such session (`rpc_apply_profile_avatar`) ran for five days (6,010,651 log lines on 2026-09-30 alone) and was ended on 2026-09-30.

## What the patch changes
| | Count |
| --- | ---: |
| Deployed functions whose body raises 40001 (read-only `pg_proc` query, canonical DEV, ledger 212) | **68** |
| Raise sites in them (the repository text shows 134 lines in 33 migrations because it also carries superseded definitions) | **110** |
| Executable by `authenticated` / by `service_role` only / no direct grant | 32 / 25 / 11 |
| Part 1: outside the certified closure digest (certificate-neutral) | 54 functions, 89 sites |
| Part 2: inside the 76-function digest (moves it, re-binds the certificate) | 14 functions, 21 sites |
| Sites kept on 40001 | **0** |

Every site is classified in `B24_SITE_CLASSIFICATION.md` (classes D1–D7: stale revision the caller supplied 47, stale server token/lease/generation 24, idempotency conflict 13, digest/policy/context changed 14, concurrent write found after the fact 7, storage outcome unconfirmed 4, business-state conflict 1). All are deterministic comparisons of something the caller or a worker supplied with stored state: repeating the same call can only raise the same code again. None is an engine-raised serialization failure (Postgres raises those itself; they are in no function body, there is no handler for them in any body, none names 40P01 or `serialization_failure`), so the owner's "keep 40001 for a real serialization/retry case" excludes nothing here. The closest to "try again later" are the four `MEDIA_STORAGE_UNCONFIRMED` sites of the media worker's settlement calls; the worker must retry with its own delay, not PostgREST immediately and endlessly.
The change in each function: the code of those raises becomes **`PT409`** (PostgREST answers HTTP 409 with the same message). Nothing else: same message text, same arguments and result, same SECURITY DEFINER/INVOKER, same `search_path`/config, same owner, same ACL, same comment.

## Contract before and after (one conflict, any of the 110 sites)
| | Before | After |
| --- | --- | --- |
| SQLSTATE in the function | 40001 | PT409 |
| HTTP answer through PostgREST 14 | **none** (the request never returns and keeps running) | **409** within milliseconds |
| JSON `code` / `message` | never seen | `PT409` / the same domain message (`MEDIA_VERSION_CONFLICT`, `NEED_REVISION_STALE`, …) |
| Arguments, result, grants | | unchanged |

## Who notices
- **Client (this repository).** Four client files mention the code. Two map an RPC of the converted set and were changed to accept `PT409` next to `40001`: `agreementMessageClientService` (send message / photo message) and `notificationPreferencesClientService` (tests first: 2 fail on the old code, 64 pass on the new). Two keep their mapping unchanged: `agreementClientService` (agreement-change calls) and `calendarErrors` (selection, agreement, generic), because they translate **engine-raised** 40001/40P01 and no RPC they call is in the converted set. Every other service decodes the conflict **by message** (`MEDIA_VERSION_CONFLICT`, `STALE_REVIEW_REQUIRED`, `LOCATION_VERSION_CONFLICT`, …), which does not change. The media flows go through the `uskoci-media` Edge function, which has no 40001 handling at all.
- **Already-installed builds** (the ROUND58 and the P6 candidate APKs): the two code-sensitive flows would show their generic "unavailable" text instead of "conflict" after the server change. Before the change those conflicts never answered at all, so this is not a regression; a build with this commit shows the right text. Recommended order: client build first, server second.
- **Edge functions:** no reference to 40001 or 40P01 anywhere in `supabase/functions`; they treat a failed RPC generically or by message. The service RPCs (closure, export, media, push, AI turns) stop hanging and start failing fast.
- **Existing SQL/JS proofs that assert the code** (14 files: `n08_preferences_proof.mjs`, `d03_message_retry_proof.mjs`, `publication_authority_proof.mjs`, `p2_export_delivery_candidate.sql`, `p3_retention_execution_candidate.sql`, `pkg051_proof.mjs`, `private_invalidation_realtime_proof.mjs`, `push_event_transport_proof.mjs`, `v5_worker_turn_recovery.test.mjs`, …): they replay history, so they stay valid until the candidate joins a replay chain; then they must accept `PT409`.
- **Pins of function bodies in other candidates/proofs:** 26 files mention an md5 of a converted function; every applied one is history. The only unapplied one, `pkg023c_public_pin_100m.sql` (on hold), must be regenerated anyway.

## The certificate
- **Part 1** (54 functions) is function-only and none of them is in the digest: the candidate asserts `closure_source_digest_v5()` before and after and refuses if it moved.
- **Part 2** (14 functions: the support v5 set, the agreement-photo v5 set, the account-closure workers and assertions) **moves the digest** (md5 of each body is in it) and therefore **re-binds the certificate in its three places** (`private.closure_source_v5`, `private.closure_erasure_source_v5`, the constant inside `private.retention_ai_source_ready()`), the pattern of PKG-023f / PKG-032b: it proves that restoring the 14 old bodies inside the same transaction gives the old certified value back (so the 14 bodies are the only thing the new value reflects), refuses while any account closure is executing, pins the current certified value `86ba3751…` in strict mode, and asserts readiness, the erasure binding and that the readiness function changed only by its constant. **A re-bind is a privacy certification of the erasure program; Part 2 is its own approval.** Until Part 2 is applied, these 21 sites keep the hazard (among them `rpc_support_submit_v5`, `rpc_send_agreement_photo_message_v5`, `rpc_start_account_closure_execution`, which any signed-in person can reach).

## What was proven, and what was not
- **Reproducible inventory:** the four candidates and the classification are generated from `supabase/proofs/b24/b24_inventory.tsv`; `build_b24_candidates.py --check` runs in CI and fails on any difference.
- **Mechanics proof** (`.github/workflows/b24-conflict-codes-proof.yml`, run **36752869572** at source `160e74a8`, **RESULT PASS, 28 checks, 0 failed**; the two runs before it failed only on the proof's own noise handling, see the commit history, and are not counted as evidence): a disposable Postgres 17 and a disposable PostgREST **14.5** in docker against a stand-in of the 68 functions (same names, same site counts, same exposure, three spellings of the raise) and of the certificate machinery. Before: a request to one function outside and one inside the certified set never answers within 3 s (client timeout) and, after the client has gone, a pooled connection is still running in 9 of 10 and 10 of 10 one-tenth-second samples. Part 1: applies, converts exactly the 54 functions and only the classified sites, leaves the certified 14 and the digest alone, **refuses to run twice**; the same request now answers **409 in 3 ms** with the same message (`code` `PT409`, `message` `MEDIA_VERSION_CONFLICT`) and no sample finds a pooled connection running. Part 2: applies, moves the digest (stand-in `029f2e58…` -> `74726ab9…`), re-binds all three places, stays ready, leaves no 40001 anywhere, refuses to run twice; **409 in 3 ms** (`MEDIA_COMMAND_CONFLICT`), nothing stays busy; every spelling of the raise answers 409 in 1-4 ms. Both reverts restore **every body byte for byte** and the original digest.
- **Inside the candidates (run on DEV too):** unique function, pinned site count and, in strict mode, the DEV pre-image md5 of every body; after: the body with `PT409` turned back into `40001` equals the old body exactly, no 40001 left, owner/ACL/security/config/comment tuple unchanged, the certificate unchanged (Part 1) or re-bound and ready (Part 2), and a closed list of functions still allowed to raise 40001. Any surprise aborts the whole transaction; nothing is half applied.
- **Not proven:** the candidates were not run against the real function bodies (the historical replay chain stops before several of the 68 functions exist); the structural guards above are what stand between a surprise and a change. When this was written nothing had been run on DEV; Part 1 ran there afterwards and every guard held (see the status line and the receipt). The HTTP 409 itself has not been observed on DEV yet. PostgREST 16 would fix the platform side; it is not relied on.

## What was done on "PRIMENI" (Part 1) and what is left
1. Preflight (read-only): 54 of 54 bodies equal to the pinned pre-image, ledger 212, digest 86ba3751 ready, 68 functions with 40001 / 0 with PT409. Done.
2. Client build first: NOT followed, the owner approved the server step before a new build; the installed APKs show a generic text for two flows until rebuilt (not a regression, those conflicts never answered before).
3. Part 1 through the connector with the integrity guard (stored text byte-exact, candidate span sha256 equals the pin), readback of 54 bodies/ACLs, digest in all three places unchanged, same five advisor lints, receipt. Done.
4. Part 2 after its own "primeni deo 2": NOT done (readiness plus one real closure check on a test account stay in that step). Read-only preflight for it, 2026-09-30 about 20:15Z: the 14 targets exist once and equal the pinned pre-image (drift 0), no account closure exists at all (0 executing of 0), digest 86ba3751 equal in the three places and ready true. The guarded text (marker = the first line of the candidate, 13,110 chars, sha256 2287177a...1821) is prepared locally and was NOT sent.
5. Afterwards: update the 14 proofs, regenerate `pkg023c`, watch DEV for conflicts answering as HTTP 409. Open.

## The original plan (kept as written before the apply)
1. Fresh read-only preflight of the 68 pre-image md5s and site counts (the candidates refuse on drift anyway); confirm no account closure is executing.
2. Client build with this commit first (it accepts both codes).
3. Part 1 through the connector with the integrity guard used for the big P6 applies (the connector appends comment lines after the text), readback of md5/ACL/digest, receipt.
4. Part 2 after its own "primeni", same discipline, plus readiness and one real closure check on a test account.
5. Afterwards: update the 14 proofs, regenerate `pkg023c`, and watch the DEV logs: no 40001 lines, conflicts as HTTP 409.
Rollback: the two revert candidates (exact inverses; Part 2's re-binds back to the pre-B24 certified value).
