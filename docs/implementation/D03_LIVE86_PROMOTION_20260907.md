# D03 — exact canonical message-retry promotion to LIVE86

D03 stable Agreement message retry is **IMPLEMENTED / AUTHENTICATED DISPOSABLE PROVEN / CANONICAL / LIVE STRUCTURAL PROVEN**. The already completed promotion added the reviewed sender command key and authenticated wrapper to the existing message engine. Postflight at2026-09-07T13:02:34Z confirmed **86 source files / live86 / pending0**. This documentation change performs no SQL apply and does not rename or modify any applied source file.

This provenance branch is reconciled onto fresh canonical `4ff2dc0f4862cccb2a432851657b68929b8bdc35`, including PR56 merged at13:17:59Z. All PR56 application/config/test bytes and evidence remain unchanged. EAS/Firebase configured source is canonical; preview APK/signing/Auth/provider acceptance is still unproven. The earlier source/proof SHA below remains the exact D03 promotion boundary.

## Accepted source and proof

[PR55](https://github.com/Uskoci1/USKOCI-CLEAN/pull/55) merged at12:58:53Z as `a0dfc9f7bec6d1d6cc0c7f71b71ded23e38a114a`. The exact final source head was `eb28d612ef6ff836911eeaa17d4501fcea4d7268`, including canonical PR49's reviewed Auth/account baseline.

[Final disposable run34124166375](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34124166375) passed11 D03 checks,6 N07 predecessor checks and12 N08 predecessor checks. Artifact10019503348, ZIP SHA-256 `4e3a7f9fa289edeb9aae2482b92a2e222525069e384c0c690eba7da8e1b98d6b`, was verified against the GitHub digest. Its original reports/log retain actual advisory-lock contention for identical and conflicting commands, both lifecycle lock orders, same-command terminal acknowledgment, rollback on event failure, owner/counterpart/outsider/token-change boundaries and preservation of the full85 predecessor history. Earlier proof runs remain historical evidence at their own source boundaries.

Canonical [PRE-P4 run34124828179](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34124828179) passed47 suites/347 tests, TypeScript and migration integrity. [CodeQL run34124827576](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34124827576) and [CONTROL-0 run34124828163](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34124828163) passed. Exact canonical analyses are Actions1736003121=0 results/23 rules, Python1736004271=0/50 and JavaScript1736005479=0/103; all errors are empty.

Root accepted the exact source, original proof, canonical gates and fresh narrow read-only preflight before the authorized forward promotion. The unchanged SQL retains its5-second lock timeout,30-second statement timeout, seven-column predecessor check and exact N01 function-body guard. No second apply or transport adaptation is part of this reconciliation.

## Actual source-to-live alias

| Field | Observed value |
|---|---|
| Canonical source | `supabase/migrations/20260907110000_clean_d03_message_retry.sql` |
| Actual live alias | `20260907130151_clean_d03_message_retry` |
| Recorded statements |1|
| Canonical and recorded UTF-8 bytes |4277|
| Canonical and recorded MD5 | `ea4ebf5cc6f24f103bdb9c854f55463d` |
| Canonical and recorded SHA-256 | `f7768b8feaefa54090bfdc66a7183089dd72fda21995dcc2beeb0dd6d6494889` |

The Supabase integration reported success. Before/after comparison included all85 complete history metadata records and their statement counts, byte counts, MD5 and SHA-256. Every original record remained identical; only the new live alias was added. Committed history excludes migration creator identities. The server-observed full-record fingerprints and explicit comparison outcome preserve this evidence without exposing those identities.

`MIGRATION_PROVENANCE.json` maps the actual live timestamp to the unchanged canonical source filename and removes only the completed D03 pending entry. Historical alias mappings, reconstruction exceptions, all86 SQL files and `MD5_MANIFEST.txt` remain unchanged. The frozen disposable candidate manifest retains its original admission-time85 predecessor and pending-live label; it is historical proof input, not the current live status owner.

## Live structural postflight

The existing `agreement_messages` table now has eight columns. The sole addition is nullable text `client_message_id`; all six constraints are validated. The new partial unique index covers `(sender_account_id,client_message_id)` when the key is non-null, while both previous indexes remain unchanged.

`rpc_send_agreement_message_v2(uuid,uuid,text,text)` has the expected body MD5 `8020a93751f4915bffff0fac5524ad64`, SECURITY DEFINER and `search_path=pg_catalog`. Authenticated execution is granted; anon and service execution are denied. The unchanged N01 message writer remains the sole new-message creator, with body MD5 `d9a3733814e3101a3941284c07dc2bed`; the emitter remains `8da91a4736e09b10872bd1240d6e0c8c`. Their existing ACLs and search paths are unchanged.

Message RLS stays enabled with the existing authenticated participant SELECT policy. Authenticated table access remains SELECT only. Existing anon/service table grants are preserved; no new write policy is introduced. The original two message rows have the same digest `153781ef7c160778f1dd785bf1491d50`, and keyed message count is0. No private message body or other private business row was read for this provenance task.

The supplied immediate catalog captures also retain the three marketplace configuration rows and aggregate counts:6 Needs,2 Agreements,2 messages,0 preferences,15 AI conversations and0 AI messages. HITNO remains disabled with an empty category allowlist in the observed urgent policy. These are aggregate/catalog observations, not production fixtures or business RPC proof. The [final aggregate gates](evidence/d03-live86-20260907/02-additional-gates.json), observed at13:18:42Z, show0 notification events, deliveries, push attempts, publication bundles, publication decisions, Q&A questions and Q&A commands. The requester connection policy remains PROMOTIONAL_FREE / HEADCOUNT /0 RSD.

The [bounded advisor review](evidence/d03-live86-20260907/02-advisors-review.json) reports71→72 findings: all original71 cache keys remain, no findings were removed and exactly one WARN was added for authenticated execution of the new SECURITY DEFINER command. That exposure is intentional and retains expected-actor/membership checks, fixed search path and denied anon/service execution. The after snapshot has20 INFO,52 WARN and0 errors. Existing warnings are not claimed resolved.

## Evidence and remaining product boundary

[Evidence manifest](evidence/d03-live86-20260907/SHA256_MANIFEST.json) binds sanitized before/after history, the completed apply result, actual structure/ACL/RLS/index/config captures, canonical analyses and original final-head disposable reports/log. Original ZIP/API responses remain in the workspace evidence archive. The [D03 command contract](D03_MESSAGE_RETRY_20260907.md) defines the account-bound stable key, same-command replay, conflicting-command rejection and lifecycle behavior.

The canonical adapter remains inert until the separately reviewed Chat screen binding is admitted. Overall Chat is **PARTIAL**; per-message outbox recovery, final-source Android retry proof, broader channels, attachments/read receipts and provider delivery are not closed by this structural promotion. PR49's existing27-checkpoint Auth/navigation Android proof remains accepted at its own source292 boundary. Current UI is a testable scaffold; final Figma design and separate Fable assets remain future work. Do not reapply D03, N08 or N07, and do not rerun accepted engine proofs because an older checkpoint says pending.
