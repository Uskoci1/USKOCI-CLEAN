# Client flow delta audit — 2026-09-24

Reviewed base `3b8f389e186796e134147d731ce28669102069f1` through fixed HEAD `b1da968c396434faa8e5455e6c0f960499206530` on `work/uskoci-ui-unification-20260924`.

This is a source/contract and isolated-component audit. No source was modified. Two scratch regression harnesses and their output were written under `outputs/audit-20260924/` at the parent auditor's request. No device, provider, real message, real application, or business write was exercised. Existing unrelated untracked files were left alone.

Read the repository entry map, `USKOCI_MASTER_PLAN_DIZAJNA.md`, and `docs/implementation/design-system/cloud-handoff/README.md`. The handoff's emulator/gallery results describe earlier builds and are not substituted for fresh acceptance of this fixed HEAD.

## Findings

### CF01 — P2: a successful spoken task message deletes an unrelated typed draft

**Changed trigger:** `src/app/(app)/nova.tsx:199–209`, especially the new `submitTurn(spoken)` at line 208. **Clearing path:** the existing success reconciliation at lines 94–100, especially `setUnos('')` at line 99.

1. Open a new or existing task conversation.
2. Type an unsent message, for example `Već ukucano.`.
3. Hold the microphone and speak a different message, `Treba mi prevoz.`; release it. The microphone remains available alongside a nonempty input (`src/ui/aiFirst/AiConversationShell.tsx:166–171`).
4. Let that spoken turn succeed, either on the immediate readback or after an unknown response followed by **Proveri ishod**.
5. The sent body is correctly the spoken message, but the unrelated typed message becomes the empty string.

The new voice path deliberately sends speech independently of the draft and even states that the typed draft stays. Reconciliation still assumes every completed command is the typed draft and unconditionally clears the field. This is new behavior reachable through the new independent voice-send path; before the delta, speech was appended to the field for review. The worker-profile conversation already uses a more selective clearing rule (`src/app/(app)/profil/razgovor.tsx:75–77`).

**Impact:** silent loss of unsent input on a normal successful operation, and again on successful recovery. No duplicate dispatch or incorrect server command was observed in the reproducer.

**Local evidence:** `outputs/audit-20260924/client-voice-draft.repro.test.tsx` runs the actual task route and `useOwnedEditor`, with auth, transport, storage, and speech adapters mocked. Both expected-behavior assertions fail at HEAD: expected `Već ukucano.`, received `""`. One covers immediate success and one covers unknown-then-success recovery. Both verify that only the spoken message was sent once. Saved output: `client-voice-draft.log` and `client-voice-draft-result.json` in the same directory.

**Why existing green tests miss it:** `src/data/__tests__/ai-owned-intake-screen.test.tsx:258–264`, named “the typed draft stays where it was”, uses the harness default `mockSend` response of UNKNOWN. It never reaches successful reconciliation.

**Fix:** keep the origin/draft snapshot in the in-memory pending turn and clear only the typed draft that the completed command consumed. A voice-only command must not clear an unrelated typed draft. Preserve the same command ID/body and existing recovery journal. Add success and unknown-then-success cases alongside the current voice regression.

### CF02 — P2: finishing an Agreement removes the only controls for an unsent photo upload

**Changed lines:** `src/ui/AgreementChat.tsx:138–139` (`photoPanel` requires `!terminal`) and line 231 (the photo composer renders only through that predicate).

1. In an active Agreement, prepare a photograph but do not send its message. The photo is in `photos.items`, unreserved by the outbox, with a READY or unresolved upload receipt.
2. The other party completes/cancels the Agreement, or the local user leaves the chat and finishes it through the overview.
3. On the next Agreement read, `terminal` becomes true.
4. The photo panel disappears even though the unsent photo still exists. There is no longer a reachable **Ukloni pripremljenu fotografiju** or **Proveri fotografije poruke** control. The `+` is also removed at lines 232–238.

The original component rendered `AgreementPhotoComposer` whenever the photos controller existed, including terminal history. The new presentation conflates disallowing a new message with disallowing cleanup/reconciliation of an already prepared upload.

**Contract trace:** `src/hooks/useAgreementPhotos.ts:120–129` implements `remove` without requiring writable; it cancels the existing upload and clears the local journal only after authoritative cancellation. Its read at lines 32–40 retains an unattached READY/unknown item. `src/ui/media/AgreementPhotoComposer.tsx:22–31` exposes the removal action when an item is unreserved; lines 58–62 expose refresh. The unchanged SQL in `supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:175–190` explicitly routes CANCEL through `agreement_photo_context_v5(..., false)`, while only CLAIM/STAGE/DISPATCH use `writing=true`. The terminal-state check is under `if writing` at lines 54–61. Thus cancellation of one's unattached photo is still admitted after the Agreement closes.

**Impact:** the user loses the existing upload cleanup/recovery path. This does not claim that another party gains access or that the upload bypasses server authorization. The prepared artifact/journal is simply stranded in this UI.

**Local evidence:** `outputs/audit-20260924/client-terminal-photos.repro.test.tsx` renders the real `AgreementChat` and `AgreementPhotoComposer`, verifies that removal exists with an unreserved READY item, then changes the same component to terminal. The expected-behavior assertion requires removal to remain while the new-message input disappears. The single test fails at that assertion: there are zero remaining removal controls. Results are saved in `client-terminal-photos.log` and `client-terminal-photos-result.json`.

**Why existing green tests miss it:** `src/data/__tests__/agreement-chat-ui.test.tsx:266–267` explicitly expects the entire photo composer to disappear even with `hasSelection: true`; it treats closing all tools as the contract without tracing cancellation semantics.

**Fix:** retain a restricted photo recovery/cleanup panel whenever unattached selections or unresolved receipts exist, including terminal Agreements. Disable new capture/send as today; preserve exact-reference refresh/cancel and outbox reservation fences.

## Boundaries checked and genuinely improved behavior

- **Offer submission:** `src/app/(app)/prilike/[id]/prijava.tsx` still owns validation, account/read/focus checks, immutable pending commands, journaling, and named receipt readback. The staged review in `ApplicationSelectionPresentation` is presentation only; confirmation invalidates when its reviewed draft or task key changes. Inactive-profile and closed-task explanations are now explicit.
- **Candidate choice:** `src/app/(app)/potrebe/[id]/kandidati.tsx` still binds the selection to need revision, application version/hash, covered places, account incarnation, and one request key. The returned save promise now lets the confirmation reflect in-flight work. The existing list remains behind the offer sheet; loaded-row sorting does not issue an alternative selection read. Unknown outcomes retain the same pending candidate/command.
- **Agreement completion:** `src/app/dogovor/[id].tsx:256–274` still binds the completion review to the exact Agreement object, focus identity, and read epoch. Only authoritative terminal readback confirms completion. The new own-rating read avoids continuing to offer rating after the caller already rated, while failure keeps the rating path available.
- **Source identifiers:** Agreement source links use the new explicit `needId`/`applicationId` projection and route each party to its own valid destination; an account or profile ID is not substituted. Missing source IDs hide the links. Requesters are not sent to a nonexistent single-application screen.
- **Chat:** original outbox body/sender/key/photo identity matching remains intact. Pending exact-command retry remains visible after terminal state. Photo-only messages retain their exact Agreement/message IDs. Error/loading/empty are distinct. Visible refresh is better for users who cannot perform pull-to-refresh, and support selection is outside the bubble's press target.
- **Task lifecycle:** the menu reaches the existing controller; review/command restoration and exact revision checks remain. Lifecycle recovery mounts without a Need row, including the deletion-readback case. Cold-entry Back has an own-tasks fallback.
- **Group conversation and task Q&A:** inspected changes are predominantly copy/tokens/presentation. The group controller's dispatch/reconciliation algorithm and task Q&A authority did not change in this delta.
- Git confirms no delta in `applicationSelectionClientService.ts`, `applicationCommandJournal.ts`, `agreementOutbox.ts`, `agreementMessageClientService.ts`, `useOwnedEditor.ts`, or `useFocusedResource.ts`; the audit followed these unchanged contracts where the changed UI invokes them.

## Coordination and exclusions

The separate release/contracts audit owns the bulk Agreement-message acknowledgement watermark race and the per-completed-Agreement review-read fanout. They are not duplicated here. The design/navigation audit was sent the separate potential loss of full visual offer-note reading in the new two-line application card.

A possible `tab=poruke` state synchronization issue was investigated but **not promoted to a finding**: the inbox calls `router.push`, and a mock-only parameter update does not establish a real reachable retained-route case under the installed navigator. Existing asynchronous route guards were not reported as vulnerabilities merely because a callback closes over render state.

This report does not establish live server equivalence, live push delivery, two-party native completion, iOS native modal/keyboard behavior, large-text physical layout, or build/store readiness. The parent audit owns full-suite/type/CI and live read-only evidence. Scratch harnesses live outside `__tests__` so the repository's default Jest discovery does not add their intentionally failing expectations to the existing suite.

## Follow-up delta — 2026-09-24, frozen extension `bc127755`

The checkout moved externally after the original audit. At the parent auditor's request, a bounded follow-up inspected `b1da968c396434faa8e5455e6c0f960499206530..bc127755a85ced147b3979bdb6985ce8d0524291`. The earlier findings and evidence above remain frozen to their original HEAD. This appendix records the new verification separately; it is not a second complete audit of all 102 changed files.

The follow-up read the changed client bodies and callsites in `AgreementChat`, `VoiceComposer`, `AgreementWorkspace`, `AgreementPresentation`, the Agreement route, worker conversation route, own-applications route/presentation, `ApplicationFace`, `ApplicationSelectionPresentation`, `CandidateFace`, intake/worker-review presentation, and the added accepted-window projection in `agreementClientService`/`projections`. It also traced the changed VoiceMode completion decision to the unchanged hold-to-talk controller: successful accepted text retains its session at `src/features/voice/holdToTalk.ts:309–311`, whereas cancellation clears it at lines 314–318. CandidatePerson has one product callsite, under the sheet title, so removing its repeated visual name does not remove the sheet's identity.

**Both findings remain reproducible at the new frozen HEAD:**

- **CF01 remains P2.** `nova.tsx` did not change in this extension. Independent voice send is still at line 208 and unconditional successful-turn draft clearing remains at line 99. Both immediate success and unknown-then-success recovery still replace the unrelated typed draft with `""`.
- **CF02 remains P2.** The `!terminal` photo-panel exclusion is now `src/ui/AgreementChat.tsx:147`, and the gated photo composer is at line 241. The new explanatory hints at lines 143–146 do not restore terminal cleanup. The unchanged photo hook/composer and cancellation contract still admit removal. The active-to-terminal test still finds zero removal controls while correctly finding no new-message input.

The same two scratch harnesses were rerun without edits. Jest exited 1 with **2 failed suites / 3 failed assertions**, each at the expected regression assertion, in 72.579 seconds. All adapter mocking and the prior scope limitations continue to apply. New output is preserved separately in `outputs/audit-20260924/client-bc127755.log` and `outputs/audit-20260924/client-bc127755-result.json`; the earlier logs/JSON were not overwritten. The exact invocation was:

```text
node node_modules/jest/bin/jest.js --runInBand --testMatch '**/outputs/audit-20260924/client-*.repro.test.tsx' --runTestsByPath outputs/audit-20260924/client-voice-draft.repro.test.tsx outputs/audit-20260924/client-terminal-photos.repro.test.tsx --json --outputFile outputs/audit-20260924/client-bc127755-result.json
```

No major additional regression was confirmed within this bounded follow-up. The delta improves the spoken description of messages containing both text and photos, exposes refresh for an empty active chat, distinguishes why a prepared-photo panel remains open, presents the caller's next Agreement step in the chat header, avoids duplicating a worker message already present in authoritative history, and gives non-hold accessibility activation a path to voice advice. Application selection, submission ownership, journals, outbox, and the photo controller were not changed in this extension. No application source, business data, or provider was modified or exercised by the follow-up.
