## Current integration — PR49 canonical / D03 pending forward

Fresh canonical is `65d280270ead4d13dcb41f7342a74b164c41e4d9`: PR49 merged at12:44:07 UTC after Root accepted the actual292 Android artifact and final1133 documentation-head CI/CodeQL with all138 tested blobs unchanged. Its Auth/navigation boundary is CANONICAL / SOURCE AND SCOPED ANDROID PROVEN. UI remains a testable scaffold; final visual design awaits Figma and Fable is separate.

D03 exact4277-byte SQL and typed client remain unchanged from accepted proof run34115037170 (artifact10015994215, ZIP SHA256 `f20fb61a7e31402c135b8473e3403f612acbe08eac23a5835b8b49ea7f744e9e`). That proof passed11 D03,6 N07,12 N08 checks and physically observed advisory/lifecycle lock contention. This integration carries the fresh Auth baseline; its final-head regression/replay/CI/CodeQL are pending. Source86 / recorded live85 / pending1; no D03 production write. Canonical review/merge, fresh structural live preflight and exact forward promotion precede the separately developed D03 mobile binding.

The older checkpoints below retain their original source/proof boundaries and are historical where superseded here. Do not restart accepted N07/N08, Auth or core engine work. See D03_MESSAGE_RETRY_20260907.md for the bounded command contract; no full Chat, provider, final visual or Store closure is claimed.

---

# D03 — stable, account-bound Agreement message retry

The existing message writer creates a new message on every successful call. If a client loses the acknowledgment and retries the same user intent, it can create a second message and counterpart event. This unit adds a stable sender-owned command key to the existing `agreement_messages` row and an authenticated wrapper around the unchanged N01 writer.

Status: **IMPLEMENTED / AUTHENTICATED DISPOSABLE PROVEN / PENDING CANONICAL AND LIVE ADMISSION**. Source inventory is86 files / recorded live85 / pending1. Overall Chat remains **PARTIAL**: this unit contains an inert typed send adapter and no visible screen binding, group/private channel redesign, attachments, pagination, read receipts or provider delivery. No D03 production write occurred.

The06.09 UI specification's D03-E09/E10 requires retry with the same `client_message_id`, preserved offline intent and no fake sent state. Execution Master V3 §15 requires participant authority, duplicate-submit behavior, lifecycle and account-switch safety while extending the current model. This bounded unit establishes that server contract for the existing single-Agreement conversation.

## Exact implementation and original proof

Baseline canonical: `9d245f3053c8e79370a73e82b12d4250e3ed94b7`, with N08 live85 provenance. The complete SQL, proof and34-test client source is `04132b98ff189abeae5481a73a95245289b4e0f6`.

[Original run34113306660](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34113306660) passed11 grouped D03 checks, all6 N07 predecessor checks, all12 N08 predecessor checks,38 suites/266 tests and TypeScript. Original artifact10015325641 ZIP SHA-256 `20abeb33a2df40b8147da0bf9ead320309e091daa1ae8ed64a7eb6ef3b752aeb` matched GitHub's digest before its reports and logs were physically inspected. [Saved evidence](evidence/d03-message-retry-20260907/SHA256_MANIFEST.json) contains the actual reports/log and safe current live catalog observation.

The candidate and forward file `supabase/migrations/20260907110000_clean_d03_message_retry.sql` are byte-identical:4277 UTF-8 bytes, MD5 `ea4ebf5cc6f24f103bdb9c854f55463d`, SHA-256 `f7768b8feaefa54090bfdc66a7183089dd72fda21995dcc2beeb0dd6d6494889`. The proof applies that actual forward file to disposable85→86 and preserves the full previous85 history plus old message rows. The frozen inventory is `supabase/proofs/notifications/d03_message_retry_files.json`.

Fresh READ-ONLY live catalog observation at10:38:17Z confirmed85 migrations, the existing seven message columns, authenticated SELECT-only participant RLS, the N01 body hash and absence of the new RPC. This observation is not a production apply and must be refreshed after canonical merge before promotion.

## Command contract

```text
rpc_send_agreement_message_v2(
  p_expected_user_id uuid, p_agreement_id uuid,
  p_client_message_id text, p_body text
) → original persisted message UUID
```

`auth.uid()` is authority; the required initiating user must match before any lookup or write. The command key is8–200 ASCII characters matching `[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}`. The body keeps N01's space-trimming and1–2000 PostgreSQL character limit. The typed client freezes the intent before awaiting a shared Supabase client, counts Unicode code points, rejects malformed surrogates/NUL/trailing key whitespace and validates the UUID acknowledgment.

The sender/key pair is globally unique across Agreements. Identical sender/key/body/Agreement retries return the existing UUID without another event, even after the Agreement becomes read-only. Reusing the key with a different body or Agreement conflicts. Another sender owns an independent key namespace. Replay still checks current participant membership; it never grants access through possession of a key.

| Condition | Server code / stable message | Client outcome |
|---|---|---|
| No authenticated actor or initiating actor mismatch |28000 / AUTH_REQUIRED or AUTH_CONTEXT_CHANGED|AUTH_CONTEXT_CHANGED|
| Invalid command key |22023 / INVALID_CLIENT_MESSAGE_ID|INVALID_MESSAGE|
| Empty body / over2000 characters |P0001 / MESSAGE_REQUIRED;22001 / MESSAGE_TOO_LONG|INVALID_MESSAGE|
| Missing Agreement or nonparticipant |P0002 / AGREEMENT_NOT_FOUND;42501 / NOT_PARTY|NOT_AVAILABLE|
| Different command with existing sender/key |40001 / MESSAGE_COMMAND_CONFLICT|CONFLICT|
| New send on read-only Agreement |P0001 / CHAT_NOT_AVAILABLE|READ_ONLY|
| Unknown transport outcome |No fabricated acknowledgment|UNAVAILABLE; retain and retry the same frozen command|

The existing message table gains one nullable `client_message_id` column and one partial unique index on `(sender_account_id,client_message_id)`. Historical rows retainNULL. No message/event engine or parallel receipt table is introduced. New message creation remains owned by `rpc_send_agreement_message`; the wrapper attaches the stable key in the same transaction. Failure anywhere rolls back message, key, event and deliveries together.

## Security, concurrency and lifecycle proof

The wrapper takes a sender/key advisory transaction lock, then a SHARE lock on the Agreement. The latter conflicts with lifecycle UPDATE locks while allowing separate message commands to coexist. It checks current membership, recognizes an exact prior command, then invokes the unchanged writer for a new command. The unique index enforces sender-global command ownership independently of advisory lock collisions.

The proof used actual requester/worker/outsider JWTs and real authenticated submit/selection RPCs on disposable Need seeds. It established:

- The predecessor creates two distinct messages/events on repeated intent; the new command creates one and returns the same UUID on retry, with an independent counterpart key namespace.
- An old requester intent dispatched under the worker JWT fails before writes. Anon, service and outsider calls are denied; participant reads and direct-DML boundaries remain intact.
- Trailing-LF/invalid keys, malformed Unicode and oversized bodies leave no command. A2000-code-point emoji body succeeds and2001 fails.
- Identical concurrent sends converge on one UUID; different concurrent bodies have one winner and one conflict. Moving an existing key to another authorized Agreement conflicts.
- An injected disposable event failure leaves the full message/event/delivery snapshot unchanged. Removing the fault permits one successful same-key retry.
- In an observed message-first transaction, the Agreement SHARE lock makes completion wait; after commit, completion succeeds and exact terminal retry returns the original UUID. In an observed completion-first transaction, a new message waits for the UPDATE lock, then fails `CHAT_NOT_AVAILABLE`; the committed prior command still acknowledges without another event. These interleavings exercised COMPLETED. Other N01 status rules remain unchanged.

New RPC body MD5 is `8020a93751f4915bffff0fac5524ad64`, SECURITY DEFINER with `search_path=pg_catalog`, authenticated execution only; anon/service execution is revoked. N01 body MD5 remains `d9a3733814e3101a3941284c07dc2bed`. No authenticated message DML grant changes. Existing anon table grants are constrained by absent write policies; the proof verifies they cannot change rows. No notification provider is invoked and no SENT/DELIVERED status is fabricated. HITNO,0 RSD and forbidden activation invariants retain the preceding proof's values.

The forward transaction has a5-second lock timeout and30-second statement timeout; it checks the exact N01 predecessor, seven-column shape and absence of the new column/RPC before additive DDL. Applied migration bytes remain immutable. Subsequent live promotion requires accepted review, actual canonical merge/CI and a fresh narrow preflight; no production fixture or business RPC belongs in structural postflight.

## Remaining screen work

Bind the live contract to a per-message outbox that preserves immutable intent and maps sending/failed/unknown/acknowledged states truthfully. Reconcile refreshed own rows by sender plus `client_message_id`; keep empty history separate from failed reads and avoid fabricated read receipts. The current `supabaseIzvor.poruke()` does not yet carry that key. Physical Android proof must cover double tap, network failure/unknown acknowledgment, retry, refresh, account change and terminal recovery at the final screen source. That UI work and the broader Chat capability remain outside this source admission.
