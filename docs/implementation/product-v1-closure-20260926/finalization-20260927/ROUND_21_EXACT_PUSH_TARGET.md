# Round 21 — exact message target preparation

2026-09-27. **FIRST DISPOSABLE RUN FAILED; CORRECTED HISTORY CONTRACT AWAITS RERUN / NOT APPLIED / NOT CLIENT-WIRED.**

Problem: a message notification identifies an event and Agreement, but opening the correct old message requires a current, authorized event-to-message resolution. A latest-page lookup cannot establish that target when later messages have arrived.

Decision: add one body-free authenticated read, `rpc_resolve_activity_message_v1(expected_user_id, event_id)`, with an unavailable outcome. Keep the existing notification transport and B3b exact-message window. The resolver does not mark any event/message read and does not return message text or media.

The candidate binds exact predecessor function metadata and requires the current closure certificate, erasure binding and readiness to remain unchanged. It validates recipient, role, both Agreement participants, actual sender, Agreement/message version, canonical dedupe and message payload linkage. Matching IN_APP delivery states CREATED/SENT/DELIVERED/READ/EXPIRED admit a historical target; delivery expiration ends new delivery, not access to authorized Inbox history. Explicit suppression still denies the target. This follows the actual B3a ACK behavior (event read_at changes; IN_APP delivery may remain CREATED), cancellation (pending delivery becomes EXPIRED), and existing Inbox history projection. Both accounts and the caller's current session must remain admitted. Foreign, missing and malformed targets cannot fall back to a different message.

Files:

- `supabase/candidates/chat_p4_exact_message_event_resolver.sql`
- `supabase/proofs/chat/exact_message_event_resolver_proof.mjs`
- `.github/workflows/chat-p4-exact-message-proof.yml`

Static checks passed: JavaScript syntax, six pre-IO local/environment refusals, exact candidate body MD5 and mutation anchors. Root reviewed the additive function, authority checks, source-bound reports, private raw logs and unconditional disposable-stack teardown. These are not SQL runtime acceptance.

The dedicated CI reconstructs the same existing source147-to-B3b predecessor on a fresh local Supabase stack, then exercises thirteen bounded SQL/Auth checks with four local actors and two disjoint Agreements. It includes old targets beyond the newest page, equal timestamps, later arrivals, both text directions, a canonical photo event without Storage IO, read-state immutability, delivery state/expiry, real ACK followed by cancellation and expired Inbox history, both-account closure, and real session expiry/revocation. Only source hashes and sanitized verdicts are uploaded; raw credentials/rows/logs stay outside artifacts. The additive RPC is removed and the entire disposable stack discarded. No DEV application, certificate rebind, provider push, device acceptance or client wiring is authorized by a passing run.

Run36338065764 at4d82b0d5 failed in TERMINAL_HISTORY_AND_CLOSURE_FENCES after nine successful primary checks. Every predecessor passed; independent catalog restoration and stack teardown passed. The sanitized report does not identify a narrower SQL/RPC cause, so that cause is not asserted. Independent source review found the ACK/EXPIRED contract mismatch described above; the corrected proof exercises the canonical path and adds fixed body-free substage labels to localize any remaining failure. It is not yet runtime accepted. Candidate body MD5:1769346f2fbf4a70ccf53b47614d2c0f.

Next: inspect the exact CI artifact, fix only reproduced proof/candidate failures, then prepare the bounded client target adapter. DEV application requires a separate explicit `primeni`.

P6 remains a separate proposed contract in `P6_BOUNDED_DISCOVERY_CONTRACT.md`: keyset pages, bounded map coverage and source predicate parity. It is not implemented or a scaling result.
