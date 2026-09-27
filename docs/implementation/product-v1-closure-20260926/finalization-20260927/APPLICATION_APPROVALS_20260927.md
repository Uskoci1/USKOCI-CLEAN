# Application approvals and recorded outcomes — 2026-09-27

Updated after explicit owner approval and the Round 14 application. Earlier read-only inventory was at `c63199cf`; its pending status for Chat B3a/B3b and the two push literals is superseded. This document records authorization/outcomes and links the [application receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3_application.receipt.json); it is not complete DEV or device acceptance.

## Approved and applied in Round 14

| Package | Intended change | Evidence and boundary |
| --- | --- | --- |
| Chat B3a | Add bounded private message history and exact displayed-message event acknowledgement. | APPLIED: `20260927140148`, `dev_alpha_chat_b3a_private_history_read`. Exact candidate bytes; both new function bodies/ACLs verified. Historical disposable SQL/Auth proof: 11 checks. No existing message rewrite during application. |
| Chat B3b | Add an authorized bounded window containing a particular older message. | APPLIED: `20260927140231`, `dev_alpha_chat_b3b_message_window`. Exact candidate bytes; function body/ACL verified. Historical disposable SQL/Auth proof: 7 checks. Building block for exact-message push, without its resolver/transport or device proof. |
| Two A1 push formatter literals | RESPONSE_VIEWED: “Tvoja prijava je pregledana.”; RESPONSE_NOT_SELECTED: “Za ovaj zadatak je izabrana druga osoba.” | DEPLOYED: `uskoci-push-transport` v20→21. Readback proves exactly these two body substitutions; entrypoint is byte-identical before/after. Existing `verify_jwt=false` and import-map settings are preserved. No trial provider send. |

B3 run [36312570701](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36312570701) was freshly read as completed/success at `be72a1bd5311e7974bba5572529852156039eac7`. Raw current candidate SHA256 values match the receipt:
- B3a: `7298317c474e0a1c670c82f8855811b783528427c5a9d9bab796534e67bd0bbc`.
- B3b: `d57619fbf972120763861d2bf61fd02122e2b4d5b84fc3be3165404569243f0d`.

Immediate DEV preflight at **14:01:30 UTC** verified ledger 203, all three B3 functions absent, four matching predecessor bodies, canonical participant NOT NULL constraints and the required valid/ready indexes. Postflight at **14:02:58 UTC** records ledger 205 and all three authenticated-only RPCs with pinned bodies. Both certificate rows retain SHA256 `cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7` and row MD5 `2d506928a7f7216c9278bd37b18de76b`; readiness-definition MD5 remains `092bab686aa5e8c32ce528cbb9767447`. The read-only SQL role refused direct private closure-helper execution. Each exact migration transaction nevertheless performed its mandatory digest, certificate/binding and readiness pre/post checks successfully; no helper ACL changed.

Advisor comparison adds exactly three expected authenticated SECURITY DEFINER RPC notices; all other stable findings are unchanged. This does not clear historical advisories. The original disposable replay excludes PKG051 and remains historical proof, independently from the current DEV application receipt. Client integration is wired and 11 distinct focused suites / 515 tests pass, including 82 service tests. Integration TypeScript passes; final exact-source/check and commit receipts are tracked in Round 14. Native acceptance, voice, gap-free realtime and complete exact-message push behavior remain separate.

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

Media v13, Notification A1 SQL/runtime, PKG045a and PKG051a have prior applied receipts and are not awaiting the same approval again. The two later formatter literals are now also deployed in push v21 under their explicit approval.

## Tracking and limits

Round 14 changes are bounded to three new B3 RPCs and the two approved push bodies. No DEV fixture/business-data test, provider send, certificate rebind, helper ACL expansion, notification preference, dependency or device change is claimed. Application success does not prove native display, scrolling, ACK viewability, provider delivery or query cost. Frozen candidates remain byte-identical to the successful disposable proof.

The living control inventory is maintained separately. Remote Claude publication remains pending under the recorded chooser failure; local generation is not publication.
