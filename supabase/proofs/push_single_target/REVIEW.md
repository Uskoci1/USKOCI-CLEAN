# Single-target push: concrete disposable implementation candidate

Status: source prepared, not executed, not canonical, not DEV-ready, no provider calls. This is the next implementation slice, not another request for general feature approval. Latest owner authorization remains for root to apply after concrete package verification.

## What changed from the earlier scratch specification

The existing `public.notification_push_attempts` row is the durable admission; its UUID is the only runtime selector. Three nullable columns are proposed: `single_target_admission` (strict, token-free JSON) `single_target_claimed_at` (irreversible consumption), and `single_target_authorization_id` (UUID with a schema-digest-covered UNIQUE constraint). Existing fields already bind delivery, device and device revision. The metadata binds authorization UUID, recipient account/role, event/type, exact device/session, send deadline and receipt deadline. No message text, push token, URL, human approval narrative or new retention interval is stored.

This is narrower than the previously suggested separate private admission table. Fresh DEV metadata verifies the existing closure relation inventory includes attempts, its owner predicate uses delivery recipient/device owner, and its redaction command deletes the whole row. New columns therefore remain inside the existing record's ownership and erasure; no new dataset or retention policy is invented. **Schema digest still changes and the new/changed functions require the existing full closure/certificate review and isolated rebind.** This candidate deliberately does not perform or fake that step.

Initial admission is restricted to an existing authorized `MESSAGE_RECEIVED` event. It is a transport proof boundary, not a claim that opportunity pushes or group-message production are finished. Opportunity eligibility/lifecycle defects need their own corrections before admission is widened.

## Exact source contents

- `baseline.json`: fresh read-only DEV bodies/definitions/metadata for current claim/begin/complete/session/suppression and the current closure ownership/delete helpers. No user or message rows.
- `new-functions.sql`: private postgres-only admission and revocation; service-only exact send claim and exact receipt claim.
- `install.disposable.sql`: atomic source installer, requires explicit disposable GUC `uskoci.single_target_disposable=SINGLE_TARGET_V1`, checks eight current body pins, adds three columns and a unique authorization constraint, changes exactly three existing transport functions and adds the four functions above. It installs no admission or event, does not register a device and does not activate Edge.
- `revert.disposable.sql`: exact source restore guarded by all seven installed function hashes. It refuses if any admitted attempt exists. Never delete consumed evidence or recreate an authorization to obtain another send.
- `supabase/functions/uskoci-push-transport/index.ts`: complete scratch mirrored Edge candidate. Two strictly parsed actions, `single_target` / `single_target_receipt`, with only `admissionId`; separate default-off `EXPO_PUSH_SINGLE_TARGET_ENABLED`. Each calls one targeted lane and returns before global tick processing. Disabled calls make no DB/provider request. Existing auth, bounded reads, literal provider URLs, generic/exact-message payload gate and cancellation remain.
- `build.py` and `MANIFEST.json`: reproducible exact-anchor construction and hashes. Running the builder only wrote scratch source; it did not execute SQL or tests.

## Source invariants implemented

1. Admission is a privileged, explicit tuple binding. Edge/service runtime cannot call the private admit/revoke functions; only postgres has EXECUTE. Repeating the same tuple returns its existing state; a different tuple with the same ID conflicts. Existing delivery attempts refuse another admission; authorization UUID is unique across admissions.
2. Generic claim excludes the **entire admitted delivery before any mutation or device expansion**, including after expiry, suppression or terminal outcome. A wrapper around generic claim is not used.
3. Targeted claim uses the existing project-wide claim serializer and6-active/60-per-second bounds. It touches only its admitted delivery and attempt, rechecks current suppression/device/session and records consumption atomically with the send lease. It never returns an old lease or creates another attempt on a repeat.
4. Existing begin retains token-first → delivery → attempt locks. It additionally checks one-shot consumption, `send_count=0`, admission expiry, exact original session and recipient/event/device tuple before token exposure. This preserves the existing permission/category/closure/block checks rather than restoring an old baseline.
5. Existing completion keeps all normal work unchanged. For admitted attempts, both direct send throttle and provider receipt MessageRateExceeded become FINAL instead of SEND-retryable. Receipt lookup transient failure still permits receipt observation only.
6. Exact receipt claim cannot select another ticket or create a send. A crashed send becomes UNKNOWN (or a never-started expired lease becomes FINAL); no retry permission is restored. Receipt observation is bounded by the approved deadline and the existing24-hour ticket horizon.
7. Explicit revoke is allowed only before begin, including a still-unused send lease; it cannot claim to cancel a started/uncertain provider call. No application/message read ACK or device-delivered state is written.

## Fresh pinned baseline

- claim `8059dcbd47489ffba239c951e233dc02`
- begin `fc76b3444e312e589255cccb2b0749c0` (current B24 PT409 body, not the older P4 receipt's md5)
- complete `705df6b9fc3c7d9ef032ee33c3f5951c`
- suppression `0e0277608bf40f3cccc3575a77b1c23d`
- session `3454eb7040f3dab3cb0c35b512b46859`
- closure scope `aec26bb057ec0022245a5d8641a47585`, patch `3891fe77d38af04e06cfe4c9e4abb96f`, relations `ba362b6d0045d06e6207fc0a8f0592d4`.

## Required proof before a DEV application package is reviewable

No database/compiler execution has occurred for this new code. Reuse the existing EX05 disposable harness with the current pinned predecessor surface; do not introduce a real provider or real account fixture. Prove:

- exact tuple admission/replay/conflict, wrong role/session/device revision/expired event/consent/closure/block refusal;
- unrelated pending backlog and a second device remain byte-unchanged through targeted send and receipt;
- concurrent target claim gives one lease; lost claim/begin response, expired lease and process restart give no second send;
- running generic SEND/RECEIPT claims never leases or mutates the admitted delivery/attempt;
- no-resend on SEND HTTP429, receipt MessageRateExceeded, network/5xx ambiguity and stale completion;
- token rebind/revoke race and admission expiry before begin suppress without provider work;
- default-off Edge makes zero RPC/provider calls, targeted actions call no generic claim or global readiness writer, one selected provider lane only;
- authorization/ACL/schema inventory, account closure/export implications, full certificate delta and compatible recertification; exact revert before admission and refusal after admission;
- non-target generic transport behavior unchanged.

The install/revert GUC is only a guard against accidentally treating these files as a DEV package. It is not proof of database identity or a substitute for a loopback-only disposable harness. A later DEV candidate must include exact schema/ACL/index preflight, immutable source attestation, closure recertification/rebind, deployment/drain order and readback. Target manifest is still empty because no approved recipient/device/event tuple was fabricated.

The canonical app and backend were not changed by this preparation. The older standalone-table specification is superseded only as a source proposal by this narrower implementation; neither has been applied.
