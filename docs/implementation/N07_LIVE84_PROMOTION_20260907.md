# N07 notification forward promotion — LIVE84 / 2026-09-07

The five canonical N07 files were promoted to confirmed Supabase project `leqcwgzvjsxugfgzdmth` after fresh source, original disposable evidence, security review and immediate read-only preflight. Final observation at **09:07:48 UTC: 84 migrations / `20260907090645_clean_n06_push_device_registry`**.

Status: **IMPLEMENTED / CANONICAL / DISPOSABLE AUTHENTICATED PROVEN / LIVE STRUCTURAL PROVEN**. N04's real mobile Inbox now has its required N03 backend in production. The existing Android acceptance remains tied to its recorded source and run; this promotion adds no new production business journey or native push-delivery proof.

## Source, review and proof

- Canonical source admission: PR #46 / `4858370610192b88112673b08bde151793409e99`; canonical HEAD at promotion `7a94c19f8f79a97a91cec45f21c6e349345b122e`.
- Exact source original combined proof: `8a6075bbdc6594161ffe1b8a91327db80d092aa5`, [run34099067010](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34099067010), artifact10009829534. Original report and log were inspected: all6 checks PASS, disposable migration count84, live_access=false and push_provider_called=false.
- At the promotion source, canonical [PRE-P4](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34100497595), [CodeQL](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34100497693) and [Control-0](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34100497466) were SUCCESS.
- Review read all five complete SQL files, exact predecessor guards, caller boundaries, transaction and failure behavior, live emitter, RLS/ACLs, new-column/index/RPC absence and active-token uniqueness.
- Current owner execution instructions authorized the completed source → proof → review → forward-promotion sequence. The earlier pending-production/permission checkpoint is historical.

## Actual live aliases and exact bytes

The connector assigned live timestamps. Source filenames and applied SQL were not rewritten.

| Unit | Source version | Actual live version | UTF-8 bytes | MD5 |
| --- | --- | --- | ---: | --- |
| N01 | 20260907080000 | 20260907090358 | 3612 | `4ed2e7bac92d8c54c9b1338fb831e630` |
| N02 | 20260907080100 | 20260907090454 | 2287 | `3e3f39ebb4c331fbf189358f5b4e27af` |
| N03 | 20260907080200 | 20260907090527 | 7431 | `d7d05cec995093fc97c53bf4c171d8c3` |
| N05 | 20260907080300 | 20260907090615 | 3894 | `059378cd24fb4d05d040b96ade02e80a` |
| N06 | 20260907080400 | 20260907090645 | 5031 | `c078ffda2fa68264dd9f0d934c69b05a` |

All five live statement SHA-256 values also exactly match frozen `supabase/proofs/notifications/n07_forward_files.json`. Full hashes are in [promotion summary](evidence/n07-live84-20260907/PROMOTION_SUMMARY.json) and [actual SQL fingerprint output](evidence/n07-live84-20260907/final-migration-fingerprints.json). All original79 version/name pairs, recorded statement MD5s and byte counts are unchanged.

Each apply returned success. Each stage was followed by actual migration listing and separate read-only postflight SELECTs before the next apply; counts progressed80→81→82→83→84.

## What is now live

N01 message events, N02 successful Selection events, N03 owner Inbox/read-state/current target resolution, N05 proposed/rejected/accepted change events and N06 revisioned device registry are live at their already proven scope.

The cumulative [function postflight](evidence/n07-live84-20260907/05-n06-postflight-1.json) matches all10 original proof body hashes, security modes, search_path and caller boundaries. The emitter is unchanged. Three Inbox indexes and the unique active-token index are valid/ready; event read_at and nonnegative device revision exist. Device policy is owner SELECT only; client event/delivery/device writes are denied through the checked grant boundaries.

No migration backfills historical events, changes human/AI authority, opts users into push or invokes a provider. New messages remain separate send operations; this does not close Chat command retry/idempotency. N05 does not close typed bilateral-change UX or same-key/different-patch semantics. N06 does not implement native permission/token lifecycle, dispatch, provider tickets/receipts or physical delivery.

## Preserved live state and advisor result

Final [gate observation](evidence/n07-live84-20260907/final-gates.json) matches the preflight: profiles6, Needs6, Responses4, Selections2, Agreements2, messages2. Events, deliveries, devices, preferences, push attempts and connection activations remain0. Publication bundles/decisions and RU-4B questions/answers/commands remain0; FASTEST/AUTO_FILL rows remain0.

Connection policy remains REQUESTER_SELECTION_V1/v1/REQUESTER/SELECTION/PROMOTIONAL_FREE/HEADCOUNT/**0 RSD**. HITNO remains disabled with an empty allowed-category list and no fee. D0140 publication, RU-4B public Q&A and Application AI remain gated. Edge `uskoci-ai-interview` remains ACTIVE v6 / verify_jwt=true / EZBR `012507310cd74cf9e769021aea71f8cfdd4e483406edbff0ee35e0b527e98954`.

Fresh advisors: 69 notices, comprising20 INFO RLS/no-policy,48 WARN authenticated SECURITY DEFINER executables and1 WARN leaked-password protection disabled; no ERROR. The +5 executable-function warnings correspond to the newly admitted3 Inbox and2 registry SECURITY DEFINER RPCs; their exact owner checks/caller boundaries were reviewed and proven. Warnings are review signals rather than a demonstrated exploit. [Definer advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No production business RPC, test fixture, device registration, provider call, pricing change or unrelated activation occurred.

## Related canonical security closure — PR #48

[PR #48](https://github.com/Uskoci1/USKOCI-CLEAN/pull/48) is canonical at `79e6f3380029b0a9e9494fe54f4ed2e6ca274c98`: four supabase/setup-cli and two denoland/setup-deno references are pinned to verified immutable upstream commits across five workflows. Permissions, triggers, commands and runtime versions are preserved.

Canonical [PRE-P4 run34104632010](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34104632010), [CodeQL run34104631839](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34104631839) and [Control-0 run34104631920](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34104631920) succeeded. Actual PRE-P4 log: TypeScript,34 suites/208 tests PASS. Exact-head Actions/Python/JS analyses1734838280/1734839536/1734841699 report0 results with no errors.

All six alerts #1/#2/#3/#4/#6/#8 and their canonical instances are FIXED at09:12:05 UTC. Their last detection commit remains the predecessor by API design; the new exact-head analysis is clean. Canonical open-alert response is empty. Raw [alert/analysis/check evidence and SHA-256 manifest](evidence/action-pins-20260907/SHA256_MANIFEST.json) preserve these observations. This source-only pinning unit makes no production change.

## Evidence and repeatability

Safe raw responses, original disposable report, exact source/live aliases and a SHA-256 manifest are under [evidence/n07-live84-20260907](evidence/n07-live84-20260907/SHA256_MANIFEST.json). They contain schema/configuration and aggregate state; no user messages, names, account IDs, credentials or tokens.

`MIGRATION_PROVENANCE.json` now records the actual84-entry live snapshot and zero pending N07 files. Historical `ru5_device_ui_live79_env.sh` remains unchanged: it explicitly reconstructs bootstrap56 plus23 ordered aliases and asserts live79 independently of current provenance. N07's immutable source inventory and existing pending-or-live registration check continue to support replay from that frozen disposable79 baseline. No proof harness logic, migration SQL or raw SQL manifest bytes change in this continuity PR.

Next: continue native Push lifecycle/dispatcher, remaining Chat/product gaps, final UI and release work. N07 must not be reapplied.

