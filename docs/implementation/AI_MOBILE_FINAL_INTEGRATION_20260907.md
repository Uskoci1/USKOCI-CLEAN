# AI mobile final integration and native traversal recovery — 2026-09-07

Status: **INTEGRATED SOURCE / LOCAL CHECKS PASS / ROOT REVIEW AND FRESH NATIVE PENDING**.

An independent worktree starts at reviewed PR59 source `8fe1fc4a9b74f3a5b6b721b71229ba5c8389e145` and integrates canonical `c4c6b624446f3273a40e8393bfadc8c49dff5494` (Auth, D03/live86, EAS/Firebase configuration and AI DRAFT authority source). The owner's active web worktree was not modified by this integration.

## Actual failure and bounded fix

Native run[34125911445](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34125911445) failed after its original27 checks passed. Original artifact10021212191 is5,679,901 bytes, SHA256 `215873c04849491aec4e12dbdef6a1158fb5b0307f133acaa3c42c902a404e4f`. Its34 original PNG/XML pairs and full ZIP remain in workspace evidence. The original failure, review-top and disabled-save PNG/XML were inspected directly; this report does not claim visual inspection of every retained historical pair.

After checking disabled Save, Back and reentry retained the Review's bottom scroll position. The actual enabled `Izmenite: Ljudi` control exists in original XML at `[353,307][655,269]`, above the scroll viewport `[0,307][1080,2101]`; Android reports inverted bounds for that offscreen node. The old harness searched only down and stayed at the bottom. Save remained disabled. Human correction, outage, materialization and saved-card proof were not reached; the failed run is not AI flow acceptance or provider proof.

The only harness behavior change derives the scroll direction from an observed matching node's clipping geometry, then requires the real control to be visible and enabled before tapping. It retains the existing hint if geometry is unavailable; it does not tap offscreen coordinates, inject navigation/Auth or weaken assertions. Two regressions cover the exact original above-clip XML and the opposite below-clip case. The original five N04/NAV executed scripts and the AI workflow, fixtures, local outage guard, SQL bytes, original27 validators and business invariants remain unchanged.

See [failed-run findings](evidence/ai-final-integration-20260907/failed-native-review.json) and the [unaltered failure XML](evidence/ai-final-integration-20260907/run34125911445-failure-original.xml), SHA256 `fc9e2569536983e43266a328ed1b7362692fead9317663d572d8ab279c458984`.

## Exact source and architecture boundary

All111 mobile source paths retain8fe bytes except `src/app/auth.tsx`, which exactly matches Root-reviewed commit `386d539648ddcf10c34b90aa5cbb28701f90753f`. Its sole change raises the sheet host above the dismiss backdrop. Root separately verified real browser email/password field focus after a fresh reload without submitting Auth. The fix changes presentation stacking only; it introduces no Auth command, SDK access, provider secret or server authority in UI.

Canonical app.json/app.config, EAS/plugin/public Firebase bytes, package and lockfile, all Supabase source/proofs and the exact21141-byte AI candidate remain unchanged fromc4c6b624. Existing package-aware config tests verify that proof packages exclude the preview Firebase file. New canonical slug/owner/projectId/versionCode inputs still alter the generated APK; old8fe native evidence cannot certify this integrated APK. A fresh run is required. UI remains a functional scaffold; final Figma design is separate.

See [source preservation](evidence/ai-final-integration-20260907/source-preservation.json) and [AST boundary](evidence/ai-final-integration-20260907/client-boundary.json). The AST is supporting static evidence; manual review confirms the new Auth style stays in presentation and the traversal change stays in proof code.

## Validation and pending acceptance

- **53 Jest suites /461 tests PASS**, TypeScript PASS, **50 Python /23 Node proof tests PASS**.
- Integrity **87 source / recorded live86 / pending1 PASS**; client AST **67 files /25 presentation /0 findings**.
- The first cold Windows run hit the unchanged Expo-config subprocess15s deadline; the exact unmodified suite then passed8 tests, followed by the full53/461 pass. No timeout or assertion was relaxed. [Validation details](evidence/ai-final-integration-20260907/validation.json) record both observations.
- Final-head CI/CodeQL, fresh integrated Android and Root acceptance remain pending. The native database boundary remains historical79+N02/N03+the exact reviewed AI two-RPC extension, with providerProof=false and canonicalFullReplay=false.

No production, provider, EAS build/key/environment mutation or real user input is introduced by this integration. Actual provider/user-owned input, separate live promotion and future preview APK/signing/Auth/token delivery each retain their own proof boundary. Unknown non-idempotent turn recovery and cross-device review-to-save CAS limitations remain as documented in the mobile unit.
