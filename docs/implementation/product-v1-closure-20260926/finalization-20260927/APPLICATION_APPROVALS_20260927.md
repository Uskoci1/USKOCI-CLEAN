# Current application status — Round31, 2026-09-27

The latest completed client corrections are committed and pushed as `10739a440611fc32e3bd6d9ee6dd66a5479e091b`. The canonical DEV metadata read at **21:52 UTC** reports ledger **210** and push Edge **22 ACTIVE**. The six latest ledger SHA256 values match the recorded application receipts. Both certificate rows retain SHA256 `f66818aa870492e397cb991e5e82f1f3d03262352b7830ce62c0d1aa9691755b`; the readiness-function definition MD5 is `8bfe3af6ea5e67cfe40c9fb518f36ef1`. These are metadata/readback facts: this check did not execute private readiness helpers or freshly inspect the exact-push flag.

## Applied and connected

| Package | Current outcome | Evidence and remaining boundary |
| --- | --- | --- |
| Chat B3a/B3b | Applied in Round14; bounded history, exact-message window and displayed-message ACK connected. | [Round14 receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3_application.receipt.json). Native/provider acceptance is scoped separately. |
| P0 exact public-row lookup | Applied as `20260927185408` / ledger206 and connected to the publication landing. | [P0/P4/P5 receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_p0_p4_p5_application.receipt.json), [Round26](ROUND_26_APPLIED_CONNECTIONS.md). Full Discovery paging remains separate. |
| P4 exact event/message resolver | Applied as `20260927185451` / ledger207; Inbox and compatible push ingress use the exact-message client path. | Same Round26 receipt; the real provider event→push→tap→window→ACK path remains unaccepted. |
| P5 owned licenses | Applied as `20260927185545` / ledger208 and connected to the manual worker editor. | Same Round26 receipt. These are self-declared licenses, not a verification claim. |
| B3c conversation invalidation | Applied as `20260927201030` / ledger209 with the explicitly approved certificate bindings; client CDC/push refresh owners connected. | [B3c receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3c_application.receipt.json), [Round28](ROUND_28_LIVE_CHAT_AND_PHONE.md). Native arrival/reconnect between two devices remains unproved. |
| Compatible P4 push transport and the two approved copy changes | SQL `20260927201531` / ledger210 and Edge22 applied; the earlier Round14 copy substitutions are retained. | [Transport receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_p4_push_transport_application.receipt.json). Exact payload was OFF at the recorded **20:12:44 UTC** flag-name check; this is the last confirmed flag state, not a new flag read at 21:52. Legacy INBOX remains supported. |

No repeat application approval is pending for the named applied packages. Exact-message payload activation still awaits compatible active registrations; one upgraded device is insufficient. Controlled end-to-end provider acceptance remains a separate open proof.

## Remaining gates and unfinished work

- **PKG045b:** the existing owner approval remains conditional on compatible-app rollout and verification. The last accepted physical-phone build is `b589994e`; the phone was unavailable during the Round31 checkpoint. The newer `10739a44` phone artifact is verified but not installed. All relevant active test devices and actual task reads must meet the documented rollout gate, followed by fresh canonical candidate preflight. This is not ready to apply, and the same conditional approval need not be requested again. The old 12:59 privilege read below is historical.
- **P6 bounded Discovery:** PAGE/EXACT_PUBLIC has disposable proof (8 SQL groups, 208 client-parity vectors, 1,004 rows), but remains rollback-only/unapplied/unwired. Whole-map/place contracts, Auth/PostgREST and query-cost evidence remain engineering work.
- **Voice messages:** source-only AAC/media preparation does not supply native recording/playback or the complete message lifecycle. Engineering, exact media authority and device evidence remain.
- **Written rating comments:** the product direction is approved; a complete length/visibility/reporting/retention contract, candidate and proof remain to be prepared.
- **Native and release evidence:** exact10739a44 is installed/hash-matched on emulator; native late-map recovery passed, while FULL-list return reproduced a whole-panel disappearance. Pin responsiveness, two-device realtime/reconnect, exact provider push, iOS and complete release acceptance remain open. Legal/operator/retention inputs and separately owned payment work retain their own boundaries.

The P6/voice/rating-comment gaps above are development and evidence gaps, not deployable packages awaiting the same broad approval. [Round31](ROUND_31_NATIVE_CORRECTIONS.md), [its check record](ROUND_31_CHECKS.json) and [exact native receipt](ROUND_31_NATIVE_RECEIPT.json) distinguish pushed source, installed10739a44 emulator, older phone, observed PASS and native FAIL. The342-suite/7,199-test full CI passed before the latest native corrections; those corrections have their own focused checks and integrated TypeScript pass. Local control generation still does not establish hosted dashboard publication.

---

# Historical application record — Rounds14–26

The sections below retain their original observations and pending statements for traceability. Their timestamps, certificate values and then-unapplied P0/B3c/P4 statements are historical; the Round31 section above controls current status.

Updated after explicit owner approval and the Round 14 application. Earlier read-only inventory was at `c63199cf`; its pending status for Chat B3a/B3b and the two push literals is superseded. This document records authorization/outcomes and links the [application receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3_application.receipt.json); it is not complete DEV or device acceptance.

## Historical: approved and applied in Round14

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

## Historical: conditional approval and its then-current rollout gate

**PKG045b task-column privacy plus its internal certificate update** was explicitly approved by the owner after compatible-app verification. Do not ask for that same approval again.

Fresh DEV catalog read at **12:59:38 UTC** still reports table SELECT and the three protected-column SELECT privileges for both authenticated and anon. Thus the candidate's postcondition is not currently satisfied. This is a privilege check, not an assertion that RLS exposes every task to every person.

The remaining gate is the documented compatible APK rollout: preserve app data, verify actual task reads, account for all active test devices, then run fresh canonical preflight and apply the exact candidate under the existing conditional approval. The user deferred new full-suite/build/install/device execution, so a consolidated verification run must be authorized before this condition can be fulfilled. The 17-check historical disposable proof is not current device acceptance. See `docs/implementation/v5-ai-first/pkg045/PKG045_TASK_COLUMN_PRIVACY.md` and `docs/implementation/NEXT_AI_HANDOFF_20260922_TASK_PRIVACY.md`.

## Historical: packages not ready at that earlier inventory

- **P0 exact public-row lookup:** candidate and proof source exist; proof not executed, not applied or wired.
- **Bounded Discovery filters/counts/paging/map projection:** contract/implementation/proof work remains.
- **Voice messages and complete event-to-exact-message push:** remaining schema/media/resolver/transport/client work; B3 alone does not complete them.
- **Written rating comments:** product direction approved; storage/length/visibility/reporting/retention candidate and proof still needed.
- **Cross-device closure recovery, rating/Home aggregates and other identified server gaps:** development/proof work, not proven packages waiting only for a word.
- **Legal/operator/retention and monetization decisions:** owner inputs, not migration approvals. Payments remain separately owned; no charging is authorized here.
- **Old nullable-photo-helper finding:** canonical NOT NULL evidence supersedes the earlier schema assumption. No reachable canonical-row exploit or ready repair package is established.

Media v13, Notification A1 SQL/runtime, PKG045a and PKG051a have prior applied receipts and are not awaiting the same approval again. The two later formatter literals are now also deployed in push v21 under their explicit approval.

## Historical: Round14 tracking and limits

Round 14 changes are bounded to three new B3 RPCs and the two approved push bodies. No DEV fixture/business-data test, provider send, certificate rebind, helper ACL expansion, notification preference, dependency or device change is claimed. Application success does not prove native display, scrolling, ACK viewability, provider delivery or query cost. Frozen candidates remain byte-identical to the successful disposable proof.

The living control inventory is maintained separately. Remote Claude publication remains pending under the recorded chooser failure; local generation is not publication.
