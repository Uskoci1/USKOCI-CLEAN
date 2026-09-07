# Auth client boundary and account ownership — 2026-09-07

The presentation layer previously called the Supabase Auth SDK directly. Separately, a batched A→B→A account transition could make an old request look current again when guards compared only the final account id and intent. This PR49 correction moves UI-issued Auth commands behind an SDK-free contract and makes identity transitions observable independently of React rendering.

The owner's latest direction keeps this UI a **testable functional scaffold**. Future Figma work owns final visual design; Fable is separate asset work. This correction adds no visual redesign, provider, Auth policy or business authority. The preserved governing documents and migration bytes are unchanged.

## Review and implementation

At source `86fffc1b58789a2a7331e3646ba8aa0647e02a73`, `src/app/auth.tsx` imported/created the SDK and issued password login, email signup, phone OTP send/verify and password recovery; `src/app/(app)/profil.tsx` issued local logout. These are now calls to `src/data/authClientService.ts` through the types in `src/contracts/auth.ts`.

The service preserves all five existing Auth payloads, metadata keys, SMS type, recovery options and error objects. Signup exposes only `hasSession`, never SDK sessions or tokens. Form validation and error presentation stay in the screen. Local logout retains exactly `{ scope: 'local' }`; it checks the captured account id and revision before and after a local SDK session read, and verifies the SDK session belongs to that account before beginning logout. The existing Auth subscription/restore owner continues to own session state, cleanup and routing. A command already issued to the SDK retains the SDK's existing semantics; cancellation is not claimed.

`src/store/sesija.ts` now increments monotonic `accountRevision` only when userId changes. Every A→B→A transition advances it even if React never renders B. Same-account token refresh does not advance it. Root private navigation is keyed by account id and revision; focused reads and Profile action scopes capture both. This rejects stale successes, errors and presses while retaining current drafts/navigation on token refresh. The existing every-event session epoch remains responsible for its separate initialization/intent races.

Root reviewed the full correction and tests with no blocker. No direct database/RPC business writes or provider secrets were found in the reviewed PR49 presentation changes. Selection, price, capacity, permission gates and AI writes retain their existing owners. This bounded review is **not a complete AI/domain-authority audit**; that review and the functional AI vertical proceed separately.

## Verification and reproducibility

- Full Jest: **46 suites / 313 tests PASS**. TypeScript and diff whitespace checks PASS.
- Regression coverage includes exact Auth payload/error behavior, signup response minimization, stale logout before mutation and during deferred session read, actual store identity transitions, Root remount for batched A→B→A, token-refresh retention, actual focused-hook late success/error suppression and Profile stale press/error suppression with fresh retry.
- TypeScript AST audit: **62 client source files / 25 presentation files / 0 findings**. It checks direct presentation SDK/network/RPC/Auth use and selected privileged-secret references, with per-file SHA-256 fingerprints. It excludes tests/server code and does not prove runtime authorization or every possible dynamic indirection.

Reproduce the bounded scan from the repository root:

```sh
node scripts/audit_client_architecture.cjs . /absolute/path/to/client-architecture.json
```

The scanner is a read-only evidence tool, not a complete security gate. `evidence/intent-shell-auth-20260907/client-ast-boundary-dirty-source.json` preserves Root's reviewed pre-commit observation: its HEAD field is the parent `86fffc1`, `workingTreeDirty` is true, and per-file fingerprints identify the corrected source bytes. `SHA256SUMS.txt` fingerprints the archived evidence files.

## Source and device proof boundary

Freshly fetched canonical is `9d245f3053c8e79370a73e82b12d4250e3ed94b7`, already an ancestor of this branch. N08 live85 is separately canonical; this correction changes no migration or production state.

Android run [34114525948](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34114525948) passed at exact source `86fffc1b58789a2a7331e3646ba8aa0647e02a73`. All 27 original PNG/XML pairs were inspected, including both corrected Agreement rows with full schedule and amount. Original artifact digest, per-pair hashes, exact-source CI/CodeQL, build record and inspection are preserved under `evidence/intent-shell-auth-20260907/run34114525948/`. The original ZIP/PNG/XML and full job log remain in the workspace evidence archive. This is actual native Android emulator proof against a disposable local Supabase fixture, not physical hardware or production proof.

That accepted proof belongs only to source86. The later Auth/account-revision changes are **IMPLEMENTED / SOURCE PROVEN / NEW NATIVE REPLAY PENDING / NOT MERGED**. New exact-head CI, CodeQL and the complete Android journey are required; later evidence must name its own source and artifact. Required architecture reviews and gates must finish before any merge. No full-product, final-design, live-provider or Store-readiness claim is made.

## Accepted Auth/identity native replay — source29271e6

Run [34119448882](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34119448882) passed at exact source `29271e6be7fc519e40941531d37c6d48b0db7ef3`. All27 original PNG/XML pairs were individually inspected, including actual local logout, second UI account login without storage clearing, both intent zones, real profiles/Back/Inbox and both full Agreement schedule/amount rows. Artifact `10018537383`,4,160,062 bytes, ZIP/API SHA-256 `e87d3f887870505942806faa3824f80c699234835f18e31ca5ebd582f62a1acc`; APK SHA-256 `fd6f513be2f8e0fe71fcff4688de5a1db30d3dfdab0d1c55661133758650708d`. Exact-source Linux TypeScript,46 suites /313 tests,34 Python tests, integrity85 and all6 source checks passed;3 actual CodeQL analyses have zero errors/results.

This closes the preceding pending-native statement for the Auth/accountRevision source. Source/component regressions prove batched A→B→A and same-account refresh behavior; native evidence proves the actual recorded Auth/account/navigation/Inbox flow. It does not invent additional native concurrency scenarios. The original source86 proof remains preserved at its own boundary. The required PR49 source architecture review is accepted; the separate AI/domain work is not claimed complete.

Detailed inspection, original pair fingerprints, source138-blob boundary, API metadata and checks are in `evidence/intent-shell-auth-20260907/run34119448882/`. Original binary artifacts remain in the workspace evidence archive. This is a standalone APK on Android API35/Pixel6 emulator against disposable historical79+N02/N03, not physical hardware, live85 behavior or production proof. Novi's one local conversation-open and original N04 fixture/read-state writes are explicitly recorded.

This acceptance follow-up changes documentation/evidence only; all138 frozen native/source/assets/config/vendor/proof blobs stay identical to source29271e6. Fresh final-documentation-head CI/CodeQL and Root acceptance are still required before merge. An automatically queued documentation-only native rerun may be cancelled after proving that equality; cancellation is never reported as new native proof. Current UI stays a testable scaffold, with final Figma design and Fable assets separate.
