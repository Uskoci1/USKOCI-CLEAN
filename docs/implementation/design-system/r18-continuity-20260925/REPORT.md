# R18 — continuity before the next premium composition batch

Owner resumed the premium research plan on 25 September 2026. This is its first coherent client package,
against repository baseline 1473198a / runtime R17 8500bf29. Source and verification receipts follow below.

## Scope

- Discovery ownership is a presentation overlay, not a filter that removes the owner's open task. Confirmed
  own work is labeled and opens its management screen. Missing relation data stays explicitly unknown.
  Explicit refresh retries both the task list and account-owned relation read, even when IDs are unchanged.
- Agreement message refresh retains already loaded transcript and local writing/outbox state. Requests
  coalesce serially with a trailing read so a completed send cannot be missed behind an older active read.
  A failed refresh says the latest messages could not be checked; initial failure remains distinct.
- Agreement rating enrichment has bounded concurrency and one total time budget, uses the authoritative
  receipt decoder, retires on account changes and cancels its own outstanding transports. Missing receipts
  are unavailable, not rated or ineligible; Home does not invent an exact due count.
- AI latest-message navigation takes its own layout row while reading history. It does not cover the expanded
  draft or review control. Its appearance/disappearance preserves the existing reading/follow intent.

The shared resource defaults remain unchanged except where a caller opts into the new policies. Existing
account fences, command identity, uncertain-outcome recovery, eligibility, prices and private data rules remain.

## Verification and limits

Read CHECKS.json and RECEIPT.json for the final source-bound results. Test code and render fixtures are not
proof of real server commands. Historical R17 phone and emulator acceptance is not reused as R18 acceptance.

This package mitigates RC-03; a bounded pool still needs up to P + C RPCs for P Agreement pages and C completed
Agreements. A true aggregate remains an additive server proposal. Message paging/read boundaries and incoming
delivery also remain separate; there is no new full-history polling or counterparty-read claim here.

No backend, DEV, Edge, migration, provider prompt, paid AI call, microphone, payment or dependency change.
No account creation, destructive device action or fabricated completed DEV flow. The artifact is installed with
replacement only after source/tree/run/hash/ABI checks, with existing app data preserved.
