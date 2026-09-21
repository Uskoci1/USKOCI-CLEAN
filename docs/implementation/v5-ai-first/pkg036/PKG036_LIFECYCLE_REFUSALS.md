# PKG-036 — answered lifecycle refusals and uncertain receipts

Date: 2026-09-22. Baseline client `744b4dc2`. Deep-read finding **7.1, first bounded slice**.
This is a client-only change. No server migration, data mutation, certificate rebind or Edge deployment.

## Problem and resulting behavior

The server can definitively refuse an operation while the app describes its outcome as unknown.
There are three independent causes in this slice:

1. Missing allowlisted refusal messages, including an already completed Agreement during cancellation,
   a closing account, and the preconditions for closing remaining search.
2. Presentation discards an already mapped refusal. The saved-task screen replaces every remaining-search
   failure; the Agreement controller keeps a second, incomplete refusal list separate from its adapter.
3. `AGREEMENT_CHANGE_INVALID` means both rejected input and an invalid success receipt. The controller
   treats an unreadable cancellation/proposal ACK as a definite rejection and stops recovery.

The typed Agreement boundary now uses `AGREEMENT_CHANGE_INVALID_RECEIPT` for malformed responses.
Its controller reconciles the persisted command normally; it never declares success from an ACK.
Known refusal classification comes from the same map as the public copy. Need lifecycle does likewise.
Closing remaining search has its own contextual allowlist, preserved by the real saved-task screen.
Unknown/provider/SQL text remains hidden; lost or malformed replies remain uncertain. There is no
automatic retry, command-key replacement, relaxed receipt decoder or server authorization change.

## Live evidence and semantic comparison

Read-only DEV query confirmed **191 migrations / 44 dev_alpha**. Eleven full RPC bodies and ten selected
guard/calendar helper bodies were read from `pg_get_functiondef`. Function identity, normalized body MD5
and literal refusal inventory are retained in `LIVE_REFUSAL_SURFACE_20260922.json`. Raw readback is local
under ignored `artifacts/pkg036-live-bodies.json`. No user record, account impersonation or secret was needed.

| Entry point | Compared client path | Finding / treatment |
| --- | --- | --- |
| `rpc_cancel_need` | need lifecycle adapter → controller | Direct business refusals already mapped; API `ACCOUNT_CLOSING` now stays a refusal. |
| `rpc_delete_draft_need` | need lifecycle adapter → controller | Draft/media/history guards retained; closing-account refusal now reaches the controller. |
| `rpc_get_need_lifecycle_receipt` | lifecycle reconciliation | Add its exact invalid-input refusal. A failed read still cannot settle an earlier uncertain write. |
| `rpc_close_remaining_search` | RU4 adapter → saved-task screen | Map every direct literal refusal; preserve the explanation on screen. Request-key wording refers to this command, not an offer. |
| `rpc_cancel_agreement` | typed adapter → Agreement controller | Add completed/missing-context/reason and guard refusals. Void ACK still requires canonical CANCELLED readback. |
| `rpc_propose_agreement_change_v2` | typed adapter → Agreement controller | Direct refusals existed; controller dropped several. Share classification and add known closure/safety guards. |
| `rpc_respond_agreement_change` | typed adapter → Agreement controller | Same classification repair; retain exact proposal/version/decision validation. |
| `rpc_withdraw_agreement_change` | typed adapter → Agreement controller | Same classification repair; no relaxation of exact authoritative receipt. |
| `rpc_report_problem` | problem adapter → Agreement route | Add missing parent-task and closing-account refusals; route uses the adapter's existing known-refusal predicate. |
| `rpc_mark_work_done` | completion adapter → Agreement route | Existing direct completion guards retained; known closure/safety refusals get safe copy. |
| `rpc_confirm_completion` | receipt adapter → Agreement route | Same safe completion copy; malformed terminal receipt still cannot confirm completion. |

The API guard can reject an already restricted caller before entering any ordinary RPC. Closure triggers
can also reject a related closing account; copy deliberately does not assert whose account is closing.
Safety guards do not identify who blocked whom. Some terminal transitions bypass closure guards and some
message insertions are intentionally skipped for blocked pairs: these conditions were read, not inferred
from trigger names. The completion map is shared by worker mark and requester confirmation; the latter's
Agreement update can reach the safety guard.

Internal invariant faults such as `CLOSURE_CONTEXT_INVALID` or a missing calendar projection are not
invented as user-correctable refusals. They retain safe generic recovery. This slice is **not** an exhaustive
transitive exception analysis of every trigger/helper, nor a completed audit of all client-callable RPCs.
Legacy non-screen Agreement proposal/response adapters are not promoted to the typed screen contract.

## Verification

- New adapter/controller suite on baseline production code: **30 failed, 4 passed** (34 cases).
- Same suite after implementation: **34 passed**.
- Focused adapter/controller/native-renderer regression: **8 suites / 217 tests passed**.
- Real saved-task renderer checks three answered refusals and one unknown failure without raw text exposure.
- TypeScript passed. Full local Jest report: **241 suites / 4644 tests passed**, zero failed (143.311 s).
  Jest emitted its existing open-handle warning, then exited **0**. A later runner cleanup found no
  matching processes; no process was stopped. CI is checked separately.
- Existing receipt tests were updated only for the deliberate invalid-receipt code split. Their malformed,
  foreign, version-bound and authority assertions remain. Test mocks retain actual classification helpers.
- No new dependency and no device operation. A build must contain this change before it can be phone-tested.

CI source `0c01ac7b023c8910e9a947b491b18c66f3fbb01f`, tree `079114340b93dddba1726bd385995bec2fbd7cba`:
PKG-004 run `35661988323` and PKG-007 run `35661988415` both succeeded. Downloaded receipts bind the same
commit/tree; PKG-007's TypeScript and full regression steps passed. See `CLIENT_PROOF_RECEIPT_20260922.json`.

The local migration integrity command exits 1 solely for the pre-existing, excluded untracked
`20260913090000_clean_v5_fix_application_spam_and_resolution.sql`. It was not changed, removed or committed.
Do not describe the local inventory check as passing; this package contains no migration.

## Android artifact

Build `35662001128` succeeded from the same source commit/tree. Downloaded `USKOCI-DEV.apk` is
68,550,371 bytes, SHA256 `b883d7a7805370a7a1f2eb701f8f87d4c504982a24666362e36edd58a32a7d80`.
Its checksum file, recovery attestation and icon attestation match that hash and source. Both attestations
report PASS. `APK_RECEIPT_20260922.json` retains the binding. This supersedes the prior PKG-035 APK for
testing these changes. **Not installed or tested on a phone.** No public release is claimed.

## Remaining work

Finding 7.1 stays **partial/open**: publication/AI, profiles, communication/media, legal/closure/export,
notifications, location, safety/support and remaining query adapters still need their per-call comparison.
Do not infer complete coverage from the old 175-RPC / 348-code count; that is a historical observation.
Findings 7.17, 7.41, 11.1, 11.2 and full Home aggregate wiring are unchanged by this package.
