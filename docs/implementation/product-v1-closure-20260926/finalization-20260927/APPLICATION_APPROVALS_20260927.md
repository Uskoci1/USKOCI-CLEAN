# Pending application approvals — 2026-09-27

Read-only inventory at `c63199cf`. This document is not an approval, application receipt, complete DEV attestation or new device proof.

## Concrete new application decisions

| Package | Intended change | Evidence and boundary |
| --- | --- | --- |
| Chat B3a | Add bounded private message history and exact displayed-message event acknowledgement. | 11 disposable SQL/Auth checks passed. No existing message rewrite during application. Client wiring still required. |
| Chat B3b | Add an authorized bounded window containing a particular older message. | 7 disposable SQL/Auth checks passed. Building block for exact-message push; not its complete resolver/transport or device proof. |
| Two A1 push formatter literals | RESPONSE_VIEWED: “Tvoja prijava je pregledana.”; RESPONSE_NOT_SELECTED: “Za ovaj zadatak je izabrana druga osoba.” | Historical source/formatter/foreground checks are in A1_DISCOVERY_CHECKS.json. Fresh live v20 read differs from the local formatter by exactly these two replacements after LF normalization; entrypoint matches. Deployment must preserve existing settings and includes no trial provider send. |

B3 run [36312570701](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36312570701) was freshly read as completed/success at `be72a1bd5311e7974bba5572529852156039eac7`. Raw current candidate SHA256 values match the receipt:
- B3a: `7298317c474e0a1c670c82f8855811b783528427c5a9d9bab796534e67bd0bbc`.
- B3b: `d57619fbf972120763861d2bf61fd02122e2b4d5b84fc3be3165404569243f0d`.

Fresh DEV catalog read at **12:57:22 UTC**: all three B3 functions are absent; the four predecessor helper bodies match their candidate pins. The original proof replay excludes PKG051 and is not full current DEV parity. Immediately before any authorized application, recheck ledger/scope, predecessor pins, indexes/ACL, certificate/readiness/binding and expected absence. B3 must leave the certificate unchanged. Application and client integration are separate from proving actual chat, voice or push behavior.

## Already approved, still conditional

**PKG045b task-column privacy plus its internal certificate update** was explicitly approved by the owner after compatible-app verification. Do not ask for that same approval again.

Fresh DEV catalog read at **12:59:38 UTC** still reports table SELECT and the three protected-column SELECT privileges for both authenticated and anon. Thus the candidate's postcondition is not currently satisfied. This is a privilege check, not an assertion that RLS exposes every task to every person.

The remaining gate is the documented compatible APK rollout: preserve app data, verify actual task reads, account for all active test devices, then run fresh canonical preflight and apply the exact candidate under the existing conditional approval. The user deferred new full-suite/build/install/device execution, so a consolidated verification run must be authorized before this condition can be fulfilled. The 17-check historical disposable proof is not current device acceptance. See `docs/implementation/v5-ai-first/pkg045/PKG045_TASK_COLUMN_PRIVACY.md` and `docs/implementation/NEXT_AI_HANDOFF_20260922_TASK_PRIVACY.md`.

## Not ready for an application-only approval

- **P0 exact public-row lookup:** candidate and proof source exist; proof not executed, not applied or wired.
- **Bounded Discovery filters/counts/paging/map projection:** contract/implementation/proof work remains.
- **Voice messages and complete event-to-exact-message push:** remaining schema/media/resolver/transport/client work; B3 alone does not complete them.
- **Written rating comments:** product direction approved; storage/length/visibility/reporting/retention candidate and proof still needed.
- **Cross-device closure recovery, rating/Home aggregates and other identified server gaps:** development/proof work, not proven packages waiting only for a word.
- **Legal/operator/retention and monetization decisions:** owner inputs, not migration approvals. Payments remain separately owned; no charging is authorized here.
- **Old nullable-photo-helper finding:** canonical NOT NULL evidence supersedes the earlier schema assumption. No reachable canonical-row exploit or ready repair package is established.

Media v13, Notification A1 runtime v20/its SQL, PKG045a and PKG051a have prior applied receipts and are not awaiting the same approval again. The later two formatter literals are distinct from the already-applied A1 runtime.

## Tracking and limits

No business data, server definitions/settings, keys, certificate, notification preference, dependency or device was changed. No new application tests or provider sends ran. Initial sandboxed GitHub read could not reach the configured proxy; the authorized read-only command outside that boundary succeeded. Supabase queries read function catalog and privilege flags only.

The control inventory is refreshed locally and committed. Remote Claude publication remains pending under the recorded chooser failure; generation is not publication.
