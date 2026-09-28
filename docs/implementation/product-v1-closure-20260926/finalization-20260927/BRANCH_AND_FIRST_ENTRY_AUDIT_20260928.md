# Branch consolidation and first-entry closure audit

Checked 2026-09-28, canonical source `d7b98abd`; three independent read-only reviews plus live DEV metadata. No application/Edge/schema changes, provider calls, mail sends, test accounts, builds or device mutations were performed. This report corrects the earlier overly broad assertion that all work across all branches was consolidated.

## Git: synchronized working branch is not complete branch consolidation

Repository: `Uskoci1/USKOCI-CLEAN`. Canonical working branch: `work/uskoci-ui-unification-20260924`. Fresh fetch showed local HEAD and this branch at `d7b98abd`, ahead/behind `0/0`.

GitHub default branch is still `clean-alpha-backend` at `a047bc0e` (2026-09-21). A reader opening the repository without selecting the working branch sees older code. No default-branch setting was changed.

| Branch/group | Actual disposition |
| --- | --- |
| `work/uskoci-r6-dodaci-20260924`, `work/uskoci-r6-objava-20260924`, `work/uskoci-r6-prijava-20260924` | `git cherry` reports patch-equivalent inclusion in the canonical branch. |
| `wip/r6fix-izmene` | Recovered/integrated at `b9aed185`, supported by current source and handoff. |
| `work/pre-v3-engine-integration-20260911`, `work/uskoci-ui-unification-20260924-poazkl`, `work/html-home-native-20260920` | Branch tips are canonical ancestors. |
| `work/ui-unification-20260923` | Older AI direction; not formally merged, but corresponding current files have newer shared voice/controller work. Do not overwrite those files merely to eliminate a branch difference. |
| `work/legal-privacy-ai-context-minimization-20260927` | **NOT INTEGRATED**, tip `d18e830a`. Separate successful CI `36304151190` is evidence for that older branch, not the current runtime. |
| `work/legal-privacy-processor-inventory-truth-20260927` | **NOT INTEGRATED**, tip `1ab01e78`. Separate successful CI `36304323342`. |
| `work/legal-privacy-retention-scopes-20260927` | Points to `a047bc0e`; no independent new file change. |

The two privacy branches are on GitHub, not lost on a local machine. Their changes still require integration with today's source and fresh applicable proof. The AI branch must be ported narrowly: replacing its entire older Edge file would remove current conversation/dialogue/schedule/price safeguards and restore old context truncation.

Missing AI privacy package: provider-context key allowlist excluding already persisted `need.exact_address` / `need.access_notes`, corresponding Edge validation, `privacy_p0_ai_provider_context_minimization.sql`, privacy proof and workflow. This does not filter new text explicitly typed by the person in the current turn.

Missing processor package: `p0_02_processor_inventory_truth_20260927.sql`, proof and workflow. It corrects the technical provider inventory; it does not publish legal documents or enable provider sending.

## Live DEV: named missing packages are not applied

Canonical project `leqcwgzvjsxugfgzdmth` only. At **05:15:55 UTC**, ledger count was **210**. Fresh Edge listing: all 11 deployed functions ACTIVE, including task AI v50, worker AI v17, location search v14, media v13 and push transport v22. ACTIVE describes deployment, not complete product/provider acceptance.

At **05:17:08 UTC**, latest ledger entries still end with the already recorded B3a/B3b, P0 exact public landing, P4 exact message resolver, P5 licenses, B3c invalidation and P4 transport packages. No new application was needed or performed for them.

At **05:19:44 UTC**, a read of catalog function definition showed the privacy candidate's expanded exclusion filter **absent** in `private.ai_need_turn_context(uuid)`; matching privacy-context / processor-inventory migration names were also absent. This is metadata only, not a read of private conversation contents.

Fresh technical provider-inventory read returned:

| Code | active | required_current |
| --- | --- | --- |
| EXPO_PUSH | false | false |
| GOOGLE_GEMINI_AI | true | true |
| OPENAI_AI | true | true |
| SUPABASE_PLATFORM | true | true |

There was no LOCATIONIQ entry. These are the older inventory values the processor candidate would reconcile. **They are not the push transport kill switch** and do not negate previously observed Android delivery. No secret values, JWTs, user records or private helper executions were used.

Exact-message push activation remains a separate gate; last recorded flag state is OFF, not freshly reread here. Voice/P6/rating work remains unfinished as described in `APPLICATION_APPROVALS_20260927.md`.

## First-entry / profile / map: actual behavior and gaps

| Surface | Present in current source | Missing closure / evidence |
| --- | --- | --- |
| Registration | Name, surname, city, email, password and repeat password; signup sends name/city metadata. `src/app/auth.tsx:180`, `src/data/authClientService.ts:42`. | No explicit `emailRedirectTo` in signup; live redirect configuration must be checked. Confirmation page asks for manual return to login, with edit-email/back but no signup resend action (`auth.tsx:508`). Actual Gmail delivery + confirmation + return is not accepted. Do not report mail as broken merely because it is unproved. |
| First authenticated entry | Home or previously selected `/zadaci` / `/nova` (`src/app/_layout.tsx:63`). | No automatic first-profile completion step. |
| Profile | Avatar entry, photo camera/library upload/apply/retry, name, skills/tools/team, work area, availability/calendar, notifications/privacy. | Personal-data writer accepts only `displayName` (`requesterProfileClientService.ts:6`). Signup city has no editing path; `profil.tsx:96` explicitly documents the gap. Photo flow source is not fresh phone acceptance. |
| Work area | Country, city, radius 1–200 km and optional coarse point; explicit save confirmation. `profil/lokacija.tsx:86`. | Work area and personal/home locality are distinct concepts. Do not silently reuse one as the other. Current real-save device proof remains pending. |
| Initial Discovery map | Restores remembered viewport; otherwise fits loaded public task pins; without pins uses neutral world view. `DiscoveryMap.tsx:162`. | Signup city and work-area point are **not connected to initial Discovery camera**. User-requested city-first experience is not implemented. GPS remains explicit “U blizini”, not automatic permission/capture. |

## Both AI conversations: shared foundation, not fully finished

- Both use `AiConversationShell`; conversation canvas and summaries are white (`tokens.ts:84`), with green own-message bubble and primary actions. No global recolor is needed to remove a supposedly all-green canvas.
- Task conversation uses a distinct collapsible `DraftCard` built from the same `TaskFace` primitives (`IntakePresentation.tsx:101`). It is not the actual `TaskCard`; collapsed facts explain the perceived mismatch. Preserve the approved real card and align draft hierarchy without pretending missing draft fields already exist.
- Task ready state has a sticky `Pregledaj zadatak`. Worker review action is inside the pinned profile card (`WorkerAiPresentation.tsx:46`), not the shell footer. This is a real consistency/discoverability gap, not an absent backend action.
- Task location has the compact map/pin proposal, explicit confirmation, “Nije ovde” and guarded “Ispravi u razgovoru” (`LocationPointEditor.tsx:209`). Earlier inert native evidence confirms the displayed controls, not new AI/geocoder accuracy or a real save.
- Worker review shows city/radius and saved-point text (`WorkerAiPresentation.tsx:92`), without the equivalent compact work-area map. Review/save/activation are wired, but the full real worker interview on the current build remains unaccepted.
- The newer phone APK is still not installed in the latest device receipt. Do not assume the physical phone shows the latest source.

## Bounded completion order

1. Safely integrate the two privacy packages into current source, repeat their relevant proof against current prerequisites, then separately record actual DEV/Edge application. Keep certificate and exact-byte requirements; do not blindly merge old Edge code.
2. Complete registration/email return/recovery and an editable personal locality with an explicit server contract. Add a short first-entry completion path, preserving one account for both roles.
3. Use chosen personal locality for the first map visit, subordinate to explicit search/publication and remembered viewport. Preserve separate work-area matching and GPS consent.
4. Close the known native FULL-return defect; keep these lifecycle changes separate from speculative SDK flags.
5. Finish AI summary/review/work-area continuity with existing shared components, then one consolidated native pass. Fresh provider/mail/business acceptance remains explicit, not inferred from screenshots or prior tests.

## Evidence scope

The earlier 342-suite / 7,213-test pass still belongs to runtime equivalent `10739a44` and rollback commit `36c57b84`. No new automated checks were needed for this read-only audit. This report is not release acceptance. Hosted control publication remains blocked by the previously observed `invalid_argument`; local generation and Git push are not publication to Claude.

## Follow-up: the owner's named Claude folder and AI-card direction

Read-only worktree check against canonical `662e4638` confirms:

- `C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN/.claude/worktrees/uskoci-kompletan-audit-2e715e` is at `be03fcc4` with empty status including all untracked files. It is a strict ancestor of canonical HEAD, with zero unique commits and ten newer canonical commits. `git cherry` is empty. Its committed application/server source is included in canonical Git history; that does not deploy every SQL candidate.
- Earlier Codex worktree `work/uskoci-html-native` is clean at `88af02e8`.
- Three older round-5 agent worktrees retain local snapshots. Current canonical versions contain their settings/picker/term-helper work and later changes; the settings, picker, worker-draft and time-helper blobs are traceable in canonical history. The old privacy presentation files also exist in newer canonical form. These worktrees were not reset, pulled, deleted or published as new work. This is not an exhaustive certification of every historical folder on disk.

Owner is considering showing the full task card only when the conversation reaches a reviewable draft. Product recommendation (not implemented here): keep ordinary conversation and point-map corrections in the body; retain only a small branded header/draft entry during collection; reveal the approved card language once the authoritative draft is ready, with one `Pregledaj zadatak` action. Publication remains an explicit action after review. A floating full-size card should not continuously consume the conversation viewport. Existing draft ownership/recovery and real TaskCard remain unchanged until implementation.

No new blanket owner approval is required for routine source integration and UI completion. Remaining owner inputs are legal/operator/retention content, separately owned payment decisions, login/device participation when needed and any future explicitly bounded paid-provider test or new dependency. PKG045b already has conditional approval; its device/preflight conditions still apply. Exact push activation still requires compatible active registrations and the stated device proof. Unfinished engineering must not be relabeled as awaiting a general owner decision.
