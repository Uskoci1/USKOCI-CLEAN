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

Runtime commit: `74f514d79fa323e135c9ddc23a6cb6b5b934c730`; tree:
`643d23914ab13dc603f422dd19b97194f863a687`. Types are clean; the final integrated run passed
317 suites / 6,185 tests. The initial integration caught two obsolete test fixture props, repaired before
the final run. The existing Jest worker-teardown warning is still emitted; the runner exits zero.

The package also fixes integration-review findings: old unknown rating rows sort after active appointments
and confirmed rating actions; the entire history/photo read shares the route's 15-second bound; refresh action
and error notice share one measured pre-message region so replacing one with the other preserves the anchor.

| Concern | Evidence exercised | Remaining limit |
| --- | --- | --- |
| DN-01 | Same IDs after failure, changed-ID retirement, account ABA, background/blur, timeout/late response; map/list/count stability and owned destination | Native observations and source tests are separate; server paging/filter parity remains |
| Refresh continuity | Kept history during read/failure, coalesced trailing read after send, initial failure, stopped generations, stalled history/photo retry, header compensation | Existing unpaged read, manual incoming refresh and exact read boundary remain |
| RC-03 | 500 mock completed rows, measured peak four, 4-second enrichment deadline, transport abort, late result/account retirement, strict receipt parsing, unknown count/routing/sort | Up to P + C calls remain; the pool is per invocation and starts after Agreement pagination |
| AI latest control | Separate layout region, expanded draft/review, preserved history anchor as viewport changes | Native docked-keyboard acceptance is recorded separately; no provider-quality claim |

Read CHECKS.json and RECEIPT.json for the final source-bound results. Test code and render fixtures are not
proof of real server commands. Historical R17 phone and emulator acceptance is not reused as R18 acceptance.

This package mitigates RC-03; a bounded pool still needs up to P + C RPCs for P Agreement pages and C completed
Agreements. A true aggregate remains an additive server proposal. Message paging/read boundaries and incoming
delivery also remain separate; there is no new full-history polling or counterparty-read claim here.

Implementation changed no backend code, Edge, migration, provider prompt, payment or dependency.
After installation, the owner separately authorized one actual DEV test task, the necessary text AI calls,
and adding their smartphone to the worker profile. That native journey passed from AI creation to both saved
ratings. Read REAL_JOURNEY.md for the mutations, observed refusals, evidence and limits. No account creation,
microphone, purchase, destructive device action or synthetic database completion was used. APK installation
preserved existing app data after source/tree/run/hash/ABI checks.
