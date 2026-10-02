# Final source cleanup review — 2026-10-02

Read-only continuation of the existing C0/C1 inventory, not a new plan or release approval. Scope: tracked/untracked files, entry/build configuration, internal galleries, active diagnostics, selected old client modules and build-input coupling. No deletes, moves, dependencies, tests, build, provider/DEV calls, device actions or new SQL. Root owns integration.

Source moved during integration: first inspected `ce859c2f`; final observed HEAD `a49132a892eea33abe467b3f8efcf89a60e9d978`. Final `git status --short` was empty. The earlier untracked urgent-activation files were concurrent root work, not disposable leftovers. No untracked SQL appeared in either canonical status snapshot. Scratch files outside the repo are not implicitly approved for release.

## Conclusion

There is no evidence for a broad rewrite or mass deletion. C0's 2026-09-30 client inventory remains a useful starting point, but its historical counts/live-service assertions are not current attestations. The most useful next work is a small C1 cleanup after preservation, followed by an explicit release configuration decision. The DEV APK is not a store-build configuration proof.

## Material release differences, not cosmetic cleanup

| Finding | Current source evidence | Minimal next action |
| --- | --- | --- |
| Production profile still targets canonical DEV/ALPHA | `eas.json:16–27` declares store AAB but hard-codes the canonical DEV URL. `scripts/check-eas-preview.cjs:78` requires that same project for admitted builds. | Record intended release environment and change profile/admission guard together only under the existing release authorization. Do not claim separate production readiness or just rename DEV. No remote EAS environment was read here. |
| DEV build and committed store profile do not declare the same reader flags | `.github/workflows/build-android-dev-apk.yml:48–53` sets P6 plus all three EX04 paging flags. They are absent from `eas.json`. `src/data/discoveryV1ReaderGate.ts:14`, `ownTasksPagedGate.ts:10`, `ownApplicationsPagedGate.ts:10`, `candidatesPagedGate.ts:11` select new behavior only for exact `1`. | Create the final build's explicit flag list with the corresponding backend receipts. Remote EAS variables may supply them; absence from the file alone is not proof the future bundle uses legacy mode. Preserve legacy fallbacks/kill switches until the existing rollout retirement gate is satisfied. |
| Store package has no configured Android Firebase client in this source | `app.config.js:51–59` attaches the Firebase file only to `rs.uskoci.preview`, otherwise removes it. `scripts/check-eas-preview.cjs:81–84` explicitly rejects preview Firebase in store builds. | Keep this honest separation. The latest owner explicitly includes push and confirms his historical successful Android delivery. The store identity still needs its own correct package/provider configuration; do not rebuild the transport or repeat the historical proof for confidence. Copying preview Firebase is not a cleanup fix. |
| iOS still references the Expo template and is not admitted by this Android build hook | `app.json:16–18` points to `assets/expo.icon`. `assets/expo.icon/icon.json` contains the Expo-symbol/grid composition. `scripts/check-eas-preview.cjs:67` admits Android only; app.json has no iOS bundle identifier. | Replace template with approved brand icon and finish iOS identity/build admission in the existing deferred iOS/release scope. This is a concrete source gap, not evidence of an observed iOS crash. |
| Test page-limit instrument depends on build environment staying clean | `src/data/ex04TestPageLimit.ts:16–23` honors `EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT=1…10`; committed DEV workflow and EAS profiles currently omit it. The EAS admission guard bans fake source but does not explicitly ban this page-limit variable. | Before the final store artifact, attest its absence; a small store-admission rejection is reasonable hardening. No current bad page size is demonstrated and no flag was changed. |

These are release configuration/readiness findings. No new product runtime bug was established by this bounded cleanup pass. Current unresolved product issues remain in the existing registry; this document does not overwrite or expand their scope.

## Concrete C1 cleanup candidates

1. **Remove the unused destructive template reset entry and script together.** `package.json:66` exposes `scripts/reset-project.js`; the script moves/deletes `src` and `scripts` and writes starter routes. `README.md:28–33` still recommends it. Search of source/scripts/package found no app caller. Minimal change: remove the npm script and its file, replace the template README's reset instructions with links to AGENTS and the existing live plan. This is repository safety/clarity, not APK performance. Proposed only; nothing was deleted.

2. **Remove the 18 template image candidates already named by C0.** Current tracked set still contains `assets/images/android-icon-background.png`, `android-icon-monochrome.png`, `expo-badge-white.png`, `expo-badge.png`, `expo-logo.png`, `favicon.png`, `logo-glow.png`, `react-logo.png`, `react-logo@2x.png`, `react-logo@3x.png`, `splash-icon.png`, `tutorial-web.png`, plus all six `assets/images/tabIcons/{explore,home}{,@2x,@3x}.png`. Current source/config/scripts/workflow reference scan found only the two excluded negative controls below. These removals reduce repository clutter; unreferenced images are not proved packaged in the APK, so do not promise APK savings. No size measurement rerun.

3. **Treat gallery exclusion as a build change, not a gate-helper refactor.** All 16 `src/app/dizajn-*.tsx` files remain among the 64 tracked route files. Thirteen use `__DEV__ || package.endsWith('.dev')`; `dizajn-ai-mesto.tsx:34`, `dizajn-mapa.tsx:72`, `dizajn-katalog27.tsx:11` require exact DEV package. A normal `rs.uskoci` release renders unavailable; no exposed live fixture flow was established. However the route files and static imports remain in the Expo Router source graph: `index.js:6` enters Router and `metro.config.cjs` only customizes caching, with no gallery exclusion. Consolidating the boolean alone will not remove imports/assets. Minimal release work: choose a deterministic store-only route exclusion while keeping the current DEV gallery paths for native review, then inspect the actual release bundle when builds are authorized. No bespoke new routing architecture is justified here.

4. **Keep the old test-only client candidates queued, not silently removed.** Current non-test search finds `agreementCurrentLocationService` used only by `src/ui/agreements/AgreementLocationController.ts`; C0 identifies their tests and the retired current-location UI. `src/ui/aiFirst/tokens.ts` remains another C0 test-only candidate. These are small follow-up deletions with their importing tests when C1 is executed; no evidence here that they weigh on the runtime bundle. Retiring associated RPCs remains a separate server/rollback decision, not part of deleting a TypeScript helper.

5. **Dependency removal stays a candidate.** `expo-web-browser` remains declared in `package.json:31`; bounded non-test source search found no import. Reuse C0's lockfile/native-autolinking review before changing it. Do not remove router-required `expo-symbols`, `expo-glass-effect`, `react-native-screens`, or web dependencies based on a zero direct-import count. No dependency changes are proposed as part of this visual batch.

## Explicitly retain

- `assets/images/icon.png` and `assets/images/android-icon-foreground.png`: `scripts/ci/attest_launcher_icon.py:41–42,116–130` uses these as template negative controls. Removing them weakens the attestation.
- `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html`: `package.json:64` runs `scripts/sync-entry-reference-assets.cjs`; that script reads the HTML at line8 and writes generated assets/reference data. `.github/workflows/build-android-dev-apk.yml:100` requires the generated city WebP. It is a hard build input despite living under docs. Entry/reference pipeline remains owner-locked.
- `src/bootstrap/passwordRecoveryBootstrap.ts`, `src/app/oporavak.tsx`, `src/app/+native-intent.tsx`, `src/ui/system/AppErrorBoundary.tsx`: recovery/error handling is active functionality, not debug clutter. `index.js:3` explicitly imports recovery before Router. Preserve deep-link aliases (`mapa`, `prilike`, `prijave`, `moje-aktivnosti`, `pregled-nacrta`) under the existing compatibility contract.
- `patches/`, `scripts/verify-native-patches.cjs`, approved native voice/module/build controls: postinstall/build dependencies, not abandoned prototypes.
- Accepted and failed evidence, current authority files, proof workflows and unpublished SQL candidates. History is not runtime baggage and a delete is not a product fix.

## Diagnostics and repository-only artifacts

Active `src` scan excluding `__tests__` found no TODO/FIXME/HACK/XXX/debugger markers. This is search evidence, not correctness proof. Actual console calls were inspected: `AppErrorBoundary.tsx:18` is `__DEV__`; Discovery route/map/data traces require the exact DEV package or are returned only through the DEV gate, with bounded whitelisted data. Keep these through the current native checkpoint; no unsolicited log-strip refactor is justified.

`src/data/index.ts:9,27–30` statically imports the fake adapter and chooses it only for explicit fake/test environment; it never falls back silently. `scripts/check-eas-preview.cjs:75–76` rejects fake/test production composition. Static import presence is bundle hygiene, not proof of fake data in release. Preserve that guard and inspect the final artifact/env instead of deleting the shared test adapter impulsively.

Four tracked scratch TSX files remain in `outputs/`: two under `audit-20260924`, and `native-product-review-20260922/{preview-boundaries,review}.tsx`. `tsconfig.json:19–26` excludes artifacts but includes all TS/TSX, so these participate in typechecking. C0 already recommends archiving them; they are not automatically app routes or shipped screens. Root/evidence/SQL/docs archives likewise affect maintenance, not the bundle unless a specific import/build script reads them.

## Preservation and release boundary

Existing authority: `docs/implementation/cleanup-inventory-20260930/SUMMARY.md` Gate1 and CLIENT_CODE.md; current P6 closure supersedes that inventory's old “P6 open” status. Local tag `p6-closed-20260930` exists, and `finalization-20260927/P6_CLOSURE_RECEIPT.md:21–23` binds its source/evidence. That does not prove the rest of Gate1: off-repo branch bundle, accepted artifacts beyond CI retention, schema dump/backup verification and named baseline remain requirements to verify before bulk cleanup. This review did not perform those operations.

For release, stage an explicit file list from the integrated canonical tree. Do not bulk-copy `finish-work`, and do not include partially prepared new SQL from any scratch lane. New/previous SQL candidates do not become migrations or release-applied state by being committed. This report only proposes cleanup; it grants no store, server or external account action.
## Parent integration after this read-only review

The root removed the npm `reset-project` entry and replaced the starter README with the actual project entry map. The historical script and all assets remain; no bulk deletion, route exclusion, dependency change or server cleanup was executed.
