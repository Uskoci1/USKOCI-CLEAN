## CURRENT CHECKPOINT — 2026-09-07 / N02 + N03 CANONICAL, NOT LIVE

This section supersedes retained historical cursors below. Current implementation baseline is canonical `0d72d72bc7c3874c25e71db38ff1643e5f170d8f`. Fetch again before the next unit. RU-5 physical journey remains CLOSED / PROVEN / CANONICAL; its aggregate bounded-note decision and Application AI gate remain unresolved.

| Unit | Source / canonical | Physically inspected proof | Post-merge gates |
| --- | --- | --- | --- |
| N01 MESSAGE_RECEIVED | PR #39 / `abd147d64eab616045d450f87e36ca5759a63e5d` | Existing N01 proof remains canonical; do not restart | PRE-P4 34090282763, CodeQL 34090282715, Control-0 34090282829 PASS |
| N02 RESPONSE_SELECTED | PR #40 / `175c0004670d928f63afe5925dee72849ca7d659`; proof head `3022ffb538205e3ea1e01110006ae09854c30c87` | run 34094384747 / job 101654583667 / artifact 10008095140; 12/12 PASS | PRE-P4 34095097976, CodeQL 34095097864, Control-0 34095097982 PASS |
| N03 event Inbox | PR #41 / `0d72d72bc7c3874c25e71db38ff1643e5f170d8f`; proof head `c7aae94988c78058903d06393d2e5a3f380a6c7b` | run 34095038531 / job 101656658378 / artifact 10008329926; 9/9 PASS | PRE-P4 34096030954, CodeQL 34096030976, Control-0 34096030910 PASS |

N02 candidate `supabase/proofs/notifications/n02_selection_event_candidate.sql` preserves the exact Selection predecessor except a successful fresh-selection event insertion. Authenticated wrong actor, stale revision, concurrent retry, event-failure rollback, replay/no-backfill, privacy and preference checks pass. Candidate SHA-256: `3677a1859e5df41c80ab7b307286560f8f7aea1de6aab92a9a6e4d6ad4505c8a`. Downloaded evidence ZIP SHA-256: `05314affd7984163b0b4c8768629ed39edf2fd505623a4c5f4603164c9d7364a`.

N03 candidate `supabase/proofs/notifications/n03_inbox_candidate.sql` adds event-owned `read_at`, keyset/unread indexes and four narrow RPCs. A durable event is one Inbox item independent of delivery preferences; `notification_deliveries.read_at` is not the S06 read authority. Owner-only idempotent read, read-all role/snapshot bounds, same-timestamp pagination and RLS-authorized Need/Response/Agreement target resolution pass. Candidate SHA-256: `b5dec48dd034b20762a19a52c809d29d20ebeaa55421c99f167e70b0b545960b`. Downloaded evidence ZIP SHA-256: `a1ee166dfbe90ded90f30dad87393d2b0cc5a20b5c3e47c41fcc6bd1c3296467`. Both ZIP digests matched GitHub API metadata; actual reports/logs were inspected, not inferred from a green badge.

### Fresh limited live observation / no promotion

The configured Supabase connector permitted read-only migration listing and targeted function fingerprints in this session, superseding the earlier session's read-blocked checkpoint. Observed: **79 migrations / 20260906141409_clean_ru5_fastest_autofill_retirement**. Selection `md5(prosrc)=867b280d4131188db3906c1ced7f4c11`; message `705f19630e27792639d737bfa41d77c6`; emitter `8da91a4736e09b10872bd1240d6e0c8c`. This was NOT a complete production safety audit, device proof, new Edge observation, or promotion preflight authorization. No production writes occurred.

**N01/N02/N03 are CANONICAL-NOT-LIVE source candidates outside applied migration history.** No forward migration has been promoted. Live promotion requires exact forward files, integrity/provenance registration, disposable proof, green PR/canonical gates, a new fresh live preflight, approved apply and immediate postflight. Applied 79 migration bytes remain unchanged.

### Active continuation

N04 real mobile Inbox is on `proof/notifications-n04-inbox-mobile-20260907`, initial source `576e56b6f4da1db509f4a269962654ff928a1e3f`, native proof run `34096462936` IN PROGRESS at this checkpoint. Do not call it proven/canonical/live until its actual later state is verified. Local TypeScript, 199 regression tests, 17 input-harness and 19 disposable-target guard tests PASS. It requires N03 backend promotion before production functionality; absence must remain an explicit error, never fake empty content.

Next: inspect N04 original Android evidence, fix any failure, PR/gates/merge/post-merge; continue canonical domain-event wiring and Push/Chat closure. Never activate payments, paid subscription, HITNO, D0140 production ALLOW, RU-4B public Q&A, Application AI, FASTEST or AUTO_FILL. P0D03 remains REQUESTER_SELECTION_V1/v1/REQUESTER/SELECTION/PROMOTIONAL_FREE/HEADCOUNT/0 RSD, with no Worker debit. Full shared Dogovor, realtime/chat-read, reviews, calendar overlap, push provider/device delivery and Store readiness are NOT established by these notification proofs.

---

# USKOČI current implementation status

Authoritative current status as of `2026-09-06`, after canonical/live/proven FASTEST/AUTO_FILL retirement and canonical/proven authenticated two-account Application journey proof. Historical closure evidence remains in dedicated closure and continuity documents.

## Current platform checkpoint

- governing master: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip` / SHA-256 `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- canonical repo/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`
- FASTEST/AUTO_FILL implementation proof head/run: `e7b5ce501c2b9708bd176075ab4b41575edf0832` / `34034993845` PASS
- canonical FASTEST/AUTO_FILL merge: `6ee5c611fadf6861b7cc029ffda77437a847ca8c`
- W03→W04 routing fix canonical merge: `bc49e8ae423b91b37321787e1dc3a1dada90583e` (PR #34)
- two-account authenticated journey proof run/job: `34045287333 / 101519151761` PASS
- two-account proof PR #35 PRE-P4 / CodeQL: `34045560199 / 34045558347` PASS
- two-account proof canonical merge: `55f218d1f2cd9a79fdaba9b8c058e92664be758f`
- two-account proof canonical PRE-P4 / CodeQL / Control-0: `34045636959 / 34045636726 / 34045636967` PASS
- proof TypeScript: PASS
- proof regression suite: `23/23` suites PASS, `146/146` tests PASS
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- fresh live Supabase post-proof: `79 / 20260906141409_clean_ru5_fastest_autofill_retirement`
- canonical source: `20260906130000_clean_ru5_fastest_autofill_retirement.sql`
- canonical raw MD5 / bytes: `25bf03d6bed27d0d9af27ec65d59a63c` / `7363`
- live recorded MD5 / bytes: `04466b38e780a59a7eab6f4b928544a0` / `6743`
- exact byte identity: `false`
- transport equivalence: removing SQL `--` line comments and whitespace from canonical/live yields identical MD5 `c99a1ded1106ae52f2dbf47289192ce0`; executable semantics are proven equivalent; applied history remains unchanged; no repair migration is required
- live Selection definition MD5: `4c2b68cdee2fe66facf7fe1c46cef43f`
- Candidate projection definition MD5: `1978ce1d5852cef46f94e81468d37bba`
- fresh post-proof business counts: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `need_selections=2`, `agreements=2`
- retired inventory: FASTEST Needs `0`; FASTEST V2 AI facts `0`; FASTEST Application snapshots `0`; AUTO_FILL Selections `0`
- live admissible Need/Application price modes: `MY_PRICE | OFFERS`
- live admissible Selection modes: `REQUESTER_SELECTS | BIDDING`
- Edge `uskoci-ai-interview`: `ACTIVE v6`, `verify_jwt=true`, EZBR SHA-256 `012507310cd74cf9e769021aea71f8cfdd4e483406edbff0ee35e0b527e98954`; AI price-mode contract is `MY_PRICE | OFFERS`

## Closed RU-5 constituent state

The following units remain physically closed and must not be redone without a proven regression:

- RU-5 P0C-01 Public-safe profile projection — `CLOSED / LIVE`
- RU-5 P0C-02 Atomic Application submit — `CLOSED / LIVE`
- RU-5 P0C-03 My Applications projection + withdraw — `CLOSED / LIVE`
- RU-5 P0D-01 Requester Candidate Projection — `CLOSED / LIVE`
- RU-5 Manual Selection Eligibility Revalidation — `CLOSED / CANONICAL / LIVE`
- P0D-02 Selection Semantic Idempotency — `CLOSED / CANONICAL / LIVE`
- P0D-03 Requester Connection Activation V1 — `CLOSED / CANONICAL / LIVE / PROVEN`
- RU-5 FASTEST/AUTO_FILL retirement — `CLOSED / CANONICAL / LIVE / PROVEN`
- RU-5 automated two-account authenticated Application journey — `CLOSED / CANONICAL / PROVEN`

P0D-03 policy remains exactly:

`REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`

Fresh post-proof `private.connection_activations=0`; no historical activation backfill and no Worker debit were introduced.

## Automated two-account journey closure

Dedicated evidence: `docs/implementation/RU5_TWO_ACCOUNT_AUTH_JOURNEY_PROOF_CLOSURE.md`.

The proof uses two distinct real GoTrue Auth sessions and proves the frozen automated journey:

`W03 → W04 → W05 → W06 → R05`

It proves authenticated submit and selection authority, Requester-owner-only candidates, exact Application version/hash selection, submit and Selection replay semantics, selected-state reload, P0D-03 zero-cost Requester activation semantics and zero external residue. Service/admin authority does not substitute either marketplace identity.

This closes the **automated integration** portion only. It is not a physical mobile UI/device proof.

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`; fresh publication policy bundle inventory `0`; publication decision inventory `0`
- RU-4B public Q&A: `ACTIVATION_BLOCKED / DEFERRED`; fresh questions/answers/policy decisions/materiality decisions/commands all `0`
- monetization: `FREE / 0 RSD`; no paid/wallet/checkout/packages activation
- urgent production activation: unchanged/disabled
- raw cross-account `app_profiles`: forbidden
- production fake source fallback: forbidden
- Application AI / RU-5B remains gated
- RU-6A calendar authority / Agreement Snapshot V2 and RU-6B shared multi-person Dogovor remain separate future units

## RU status summary

- RU-0 — `CLOSED / LIVE / DO NOT REDO`
- RU-1 — `CLOSED / LIVE / DO NOT REDO`
- RU-2 — `CLOSED / LIVE / DO NOT REDO`
- RU-3 — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- RU-4 — `CLOSED / LIVE / DO NOT REDO`
- RU-4B — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- Client Data Layer — `CLOSED / CANONICAL / DO NOT REDO`
- RU-5 — `IN PROGRESS`; automated two-account journey is closed, but bounded-note authority and physical device/UI proof remain open
- RU-5B — `NOT STARTED / GATED BY RU-5`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## Remaining RU-5 aggregate blockers

### 1. Bounded / preselection note governance

Frozen RU-5 requires a bounded Application note and denial of contact/payment/exact-private-location bypass content according to current policy.

The current governing sources do not owner-approve a numeric maximum length, regex/block list, moderation threshold or numeric rate for this Application note. Concrete values found only in `06_DRAFT_EVIDENCE` are draft evidence and cannot be promoted into product policy by implementation inference.

Therefore any implementation step that would require inventing those values remains `BLOCKED / DECISION-REQUIRED`.

### 2. Physical device/emulator UI journey proof

The automated two-account authenticated journey is now closed. What remains is a genuinely separate physical UI proof of the same `W03 → W04 → W05 → W06 → R05` path on an actually connected emulator/device or an equivalent mobile E2E harness.

No Maestro/Detox-equivalent click-through harness is currently established in canonical, and Android build success does not constitute this proof. Device/UI proof therefore remains `OPEN / NOT EXECUTED` and must not be inferred.

## Exact continuation cursor

1. merge this proof-status reconciliation through normal PR and canonical push gates;
2. preserve all already closed RU-5 units and do not redo them;
3. resolve bounded/preselection-note governing authority without inventing numeric/regex/block-list policy;
4. establish the smallest canonical physical mobile E2E/device harness that can prove `W03 → W04 → W05 → W06 → R05` without production contamination;
5. execute and retain physical device/emulator evidence only when a real device/emulator environment is actually available;
6. keep aggregate RU-5 `IN PROGRESS` and RU-5B gated until both remaining gates close.

Explicit non-claims: bounded-note policy values, physical device proof, Application AI, hard calendar authority, immutable Agreement Snapshot V2, shared Dogovor, D0140 production ALLOW, RU-4B public activation, HITNO activation, wallet/checkout/packages or paid monetization.
