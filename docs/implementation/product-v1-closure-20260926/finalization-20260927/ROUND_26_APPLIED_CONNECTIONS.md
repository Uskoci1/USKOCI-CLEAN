# Round 26 — applied server packages and connected client journeys

2026-09-27. P0/P4/P5 are **APPLIED ON CANONICAL DEV**. Client integration and native acceptance remain explicitly separate.

## Problem and cause

Publication depended on a full collection walk for its public landing; Inbox only reached a generic Agreement; manual worker editing omitted licenses already used by the writer/AI/matching. The prepared read contracts existed but were not connected end to end.

## Product / UX decision and implementation

- P0 resolves the exact public ID/revision immediately, merges one public row into the common map/list snapshot, preserves the original TaskCard/Peek, and does not advertise an incomplete collection as a final count. Failed refresh retains the proved row; only a successful newer-started collection can replace it. Detail return revalidates membership without repeating the camera. Missing/revision mismatch retains owned-detail recovery; no invented pin or republish.
- P4 connects a selected MESSAGE_RECEIVED Inbox event through the owned body-free resolver into the B3 exact-message window. An unresolved event remains unread; existing measured visible-message ACK remains authoritative. The Agreement/outbox/photo owners do not remount.
- P5 exposes the existing self-declared licenses in the manual worker editor and save/activation readback. Missing/malformed server fields are unavailable, never an invented empty list. No verified-license claim.

## Backend / RPC and evidence

See `supabase/operations/dev-alpha/ledger/20260927_p0_p4_p5_application.receipt.json`. Fresh predecessors matched before application. Exact Git candidate bytes were applied sequentially:

| Package | DEV version | Ledger | Proof |
| --- | --- | --- | --- |
| P0 public exact lookup | 20260927185408 | 206 | 9 SQL-role checks, run36330122549 |
| P4 event/message resolver | 20260927185451 | 207 | 13 SQL/Auth checks, run36339724742 |
| P5 owned licenses | 20260927185545 | 208 | 7 SQL-role checks, run36341487304 |

Ledger SHA256 equals each exact candidate; reader bodies and authority envelopes match. All three application transactions checked closure digest/readiness before/after. Both full certificate-row fingerprints and readiness definition remain unchanged. No business data, Edge, provider send, certificate rebinding, dependency, payment or frozen migration change.

The fresh control snapshot reads public catalog and cron; its private live/readiness facts are attributed to the successful application transaction, not falsely represented as an independently permitted private helper call.

## Files and tests

P0: `src/app/(app)/zadaci.tsx`, `src/ui/v2/DiscoveryPresentation.tsx`, exact reader/route/presentation tests. P4 and P5 exact file lists/checks are in `P4_EXACT_MESSAGE_CLIENT_20260927.md` and `P5_LICENSES_CLIENT_INTEGRATION.md`.

P0:2focused suites/159PASS; P4:10/503PASS; P5:5/121PASS. Final combined TypeScript PASS (exit0). These are package scopes, not a claimed deduplicated whole-suite count. P0 lifecycle regressions/checks are recorded in the round check receipt; initial failures caused by stale mock/copy expectations are preserved and are not misreported as product red-before evidence.

## Device proof and regression

Previous consolidated APK run36341487306/source89bd392d downloaded and installed with `adb install -r` on emulator5556. APK/base.apk SHA256: `838155e820dff4e6d90dbc3f16cb8a3b4d201d8a077c5be812afe8717a90da0e`. Existing session survives and Profile reads live DEV. This APK contains earlier Home/MyTasks/Agreement-exit fixes, not the new P0/P4/P5 integration. No full two-account journey, provider delivery, physical-phone or exact new-client native acceptance is claimed.

## Status and next step

Push currently carries only `{kind:INBOX}`: direct push-tap→exact message remains open, despite the now connected Inbox→exact-message route. Voice is still source preparation; P6 bounded whole-Discovery remains contract-only. B3c disposable recertification is now authorized and being implemented; DEV certificate application is not claimed.

Next: consolidated exact-client APK/native acceptance, then finish B3c certified erasure proof and the remaining message transport/voice work. The hosted control Artifact still requires the recorded republish/upload step; local generation is not publication. Git commit is recorded by repository history after this report is staged.
