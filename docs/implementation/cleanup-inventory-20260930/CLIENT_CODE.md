# CLIENT_CODE - client tree inventory (read-only)

> C1 preparation, plan 7.3 "C1 - kod, dependencies i asseti" and 7.4 (Rute, React/state, Data sloj, Assets, Dependencies, Logovi). Static analysis of the pinned tree only; **nothing was changed and nothing was installed** (`git`, `rg`-style scans, `node`; `tsc` was not run because `node_modules` is not part of the worktree). Unconfirmed candidates stay KEEP/REVIEW (plan 7.2/7.5). While P6 is open, nothing under `src/ui/v2/Discovery*`, `src/data/discoveryV1*`, `src/app/(app)/zadaci.tsx`, `src/app/dizajn-mapa.tsx` or the P6 workflows may be touched.

## 0. Pin and method

| Item | Value |
|---|---|
| Pinned tree | `fc58f411598338c8589f5f177626a2790c92fb13` |
| Drift | 5 commit(s) were added to the canonical branch after the pin (tip now `c9071a2f`): `8fb6a9a7` test(p6): evidence collector for native journey artifacts; compact evi; `c184bdd6` docs(plan): live master plan at the current P6 state (journey #8 root ; `c88f897f` fix(p6): independent-review findings (restore watchdog, read deadline,; `650d340d` ci(p6): rebuild the native proof APK (14) and run the full client chec; `c9071a2f` ci(p6): run the FULL acceptance journey on the APK with the review fix. 53 files touched (docs/implementation x37, src/data x7, supabase/proofs x3, scripts/ x2, __tests__/ x1, docs/control x1, docs/current x1, src/ui x1); INCLUDES app/workflow/server/asset files: re-check the findings that cite them. |
| Client size | `src/`: 788 TS/TSX files (440 production modules, 54,719 lines; 350 test files under `src/**/__tests__` plus 14 root tests), 64 route files, 2 JSON |

| Check | Method | Confidence |
|---|---|---|
| Reachability | own import-graph scanner over `import/export ... from`, `require`, `import()`, `jest.mock/requireActual`; Metro platform suffixes (`.native/.web/.ios/.android`) and `@/` alias resolved; roots = every file under `src/app` (Expo Router makes every file a route), `index.js`, `app.config.js`, `metro.config.cjs`; second pass rooted at tests, third at scripts/supabase/outputs/plugins/modules | high (0 dynamic `require(`/`import(` with computed paths exist in `src/`); does not see runtime string-built module names or native autolinking |
| Duplicates | exported-name collisions, same basename in different folders, line-set Jaccard >= 0.4 over production modules | medium (textual) |
| Dead exports | identifier occurs exactly once in the whole tree (declaration only) | medium-high for non-Expo-Router files |
| `EXPO_PUBLIC_*` | literal scan of src, `app.config.js`, workflows, `eas.json`, scripts | high; `.env` is git-ignored so local definitions are invisible |
| Dependencies | import/`require`/`jest.mock` specifiers + app.json/app.config.js/jest/metro references + `package-lock.json` (who requires whom) | medium: no install, no `npm ls`, no `expo-doctor` |
| Assets | file path or unique basename mentioned in code/config/tests/workflows; 0 dynamic `require` templates | medium-high |
| Scripts | path/basename mentions in workflows, package.json, other scripts, tests, docs | medium (glob-run tests look "unreferenced") |

## 1. What matters most

1. **The client is unusually clean.** 431 of 440 production modules are reachable from routes; **0 are unreachable from everything**; 9 are reachable only from tests. Only 23 exported symbols occur exactly once in the tree (12 files). 0 `TODO/FIXME`, 0 `@ts-ignore`, 0 `debugger`, 6 `console.*` (all gated trace instrumentation). There is **no large dead-code cleanup** to do; the real work is small, precise, and blocked by coupling (below).
2. **The 9 test-only modules include a retired feature**: the Agreement "current location" service + controller (`src/data/agreementCurrentLocationService.ts`, `src/ui/agreements/AgreementLocationController.ts`, 3 tests) - the UI was retired (AGENTS.md R7) but the three RPCs it calls are still executable by `authenticated` (SERVER.md section 3.3).
3. **A legacy "reference entry" pipeline runs on every `npm install`**: `package.json` `postinstall` -> `scripts/sync-entry-reference-assets.cjs` decodes a WebP and a font out of the **1.4 MB `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html`** into git-ignored `assets/generated/*` and `src/ui/referenceEntry/entryReferenceData.ts`. Their only consumer, `src/ui/referenceEntry/ReferenceEntryHero.tsx`, is imported **only by tests** (the runtime entry is `src/ui/entry/*`), yet `build-android-dev-apk.yml` still asserts the generated WebP exists. This is a classic "grep for `docs/` misses it" coupling (the script builds the path from segments) and it makes that HTML a **hard build input that must not be archived** (DOCS.md). Consolidation is a C1 decision that needs the owner because AGENTS.md names the V4.9 HTML the visual authority.
4. **16 DEV gallery routes ship in every build** (2,790 lines + fixtures in `src/app/dizajn-*.tsx`); each renders "Nije dostupno." unless the package is an internal `.dev` build, using **two different, duplicated gates** (3 files test `package === "rs.uskoci.dev"`, 13 test `__DEV__ || package.endsWith(".dev")`). Safe today; wasteful in the store bundle; 6 of them (`dizajn-ai`, `dizajn-dogovori`, `dizajn-kandidati`, `dizajn-objava`, `dizajn-prijave`, `dizajn-tabla`) are imported by no test.
5. **Dependencies: one real candidate** - `expo-web-browser` (no import, no config reference, required by no locked package). Three look unused but are **not**: `expo-glass-effect` and `expo-symbols` are hard `dependencies` of `expo-router` in `package-lock.json` (removing them from `package.json` changes nothing), `expo-system-ui` is implied by `"userInterfaceStyle": "light"`.
6. **Assets: 18 unreferenced Expo-template leftovers (~461.2 KB)** in `assets/images/`; `assets/images/icon.png` and `android-icon-foreground.png` look like leftovers but are the **template negative controls of `scripts/ci/attest_launcher_icon.py`** and must stay; `app.json` `ios.icon` points at `assets/expo.icon`, which is the **Expo template Icon Composer file** (blue gradient, `expo-symbol`, grid) - a P7/iOS release finding, not a cleanup.
7. **Tracked scratch and tooling**: `outputs/` (38 files, 2.65 MB, four `.tsx` files that are **type-checked by `tsc`** through the `**/*.tsx` include), 32 script files (0.35 MB) that exist only for workflows proposed for ARCHIVE, `.maestro/` (10 phone walkthroughs; the owner order is emulator-only; its README cites a missing `flows/open-tab.yaml`), root clutter (`OVERNIGHT_PROGRESS.md`, `project_inventory.txt` (UTF-16 machine inventory with local paths), `remote_*.json`), the untouched `create-expo-app` `README.md` and the destructive template script `scripts/reset-project.js` behind `npm run reset-project`.

8. **Credential-shaped strings and scanner alerts** (value-free scan of the pinned tracked tree; git history was not scanned; no value is quoted anywhere in these reports): `config/firebase/google-services.json` (Android Firebase client config, package `rs.uskoci.preview`, referenced by `app.config.js` line 53, `build-android-push-proof.yml` and 3 tests, so it is a live build input) contains a Google API key that GitHub secret scanning reports as an **active, publicly leaked Google API key** (open alert #5, first seen in commit `170686aa`). Firebase client keys are designed to ship inside the APK, but an *active + public* verdict means the owner should confirm the key restrictions (Android package + SHA-1, API restriction) in Google Cloud; removing the file would break the push-proof build and would not remove the key from history. A second open alert of the same type (#1) points at the reference HTML (DOCS.md). The `sb_secret_...` strings in `scripts/__tests__/eas-preview-guard.test.ts` are synthetic negative-test fixtures (upper-case word shape), and the two `eyJ...` strings in `p6-native-*.yml` are the public local-stack demo anon key (`iss=supabase-demo`). Open code-scanning alerts: 6 (5 x `js/insecure-randomness` in `src/data/supportCaseJournal.ts` / `supportCaseWire.ts`, the owner-accepted `idempotencija.ts` debt recorded in AGENTS.md; 1 x medium `js/http-to-file-access` in `scripts/acceptance/dev_ai_acceptance.mjs:332`). Dependabot: 0 open alerts, security updates disabled.

## 2. Modules reachable only from tests (9)

| Module | Size | Only referenced by | Proposed |
|---|---:|---|---|
| `src/data/agreementCurrentLocationService.ts` | 5.5 KB | src/data/__tests__/dizajn-dodaci.test.tsx, src/data/__tests__/v5-agreement-current-location-controller.test.ts, ... | **DELETE with its 3 tests + controller, after SERVER.md deprecates the 3 RPCs** - retired Agreement current-location UI (R7) |
| `src/data/locationResolver.ts` | 3.7 KB | src/data/__tests__/w02-location-client.test.ts | **REVIEW** - W02 location client; only its own test imports it (production uses `productionLocationResolver.ts`) |
| `src/lib/selectionIdempotency.ts` | 1.4 KB | src/lib/__tests__/selectionIdempotency.test.ts | **REVIEW** - own unit test only |
| `src/ui/agreements/AgreementLocationController.ts` | 6.3 KB | src/data/__tests__/v5-agreement-current-location-controller.test.ts | **DELETE together with the service** - same retired feature |
| `src/ui/aiFirst/tokens.ts` | 1.4 KB | src/data/__tests__/pkg004-lifecycle-recovery.test.tsx | **DELETE (with the one test import)** - third token set; `src/ui/system/tokens.ts` is the single token source |
| `src/ui/referenceEntry/ReferenceEntryHero.tsx` | 15.4 KB | src/data/__tests__/v5-tab-navigation.test.tsx, __tests__/tabLayoutSafeAreaContract.test.ts | **CONSOLIDATE at C1 with the owner (see finding 3)** - legacy entry donor; 3 tests mock/read it |
| `src/ui/system/Detail.tsx` | 4.9 KB | src/ui/system/__tests__/disclosure.test.tsx | **REVIEW** - only `disclosure.test.tsx`; 5 of its exports occur once in the tree |
| `src/ui/system/LottieArt.tsx` | 1.9 KB | src/ui/__tests__/lottie-art.test.tsx | **KEEP** - approved Lottie wrapper (2026-09-23) awaiting the owner's Lottie files |
| `src/ui/v2/icons.tsx` | 1.6 KB | outputs/audit-20260924/client-terminal-photos.repro.test.tsx, src/data/__tests__/agreement-chat-ui.test.tsx, ... | **REVIEW** - imported only by tests and one `outputs/` repro; no route |

Every other production module is reachable from `src/app`. Nothing is imported by no one.

## 3. Routes (64 files)

| Class | Count | Decision |
|---|---:|---|
| Screens under `(app)` tabs and root | 40 | KEEP |
| Redirect aliases (`/mapa`, `/moje-aktivnosti`, `/prilike`, `/prijave`, `/pregled-nacrta`) | 5 | KEEP: old installed clients, notifications and deep links resolve them; `scripts/ci/pkg012-source-authority.test.cjs` asserts `pregled-nacrta` and `prijave` "until PKG-023 retires them with parity and approval" |
| DEV design galleries (`dizajn-*`) | 16 | KEEP through P6 (`dizajn-mapa` feeds emulator checks); C1: one gate helper + exclude from the store bundle |
| Layouts / `+native-intent` | 3 | KEEP (`+native-intent` rewrites push deep links) |

Routes with **no inbound navigation literal** in production code (excluding galleries and structural files): `/mesto-zadatka` (per-fact location editor; the review screen comment calls the per-fact draft review "retired"; registered as a hidden tab, exercised by `pkg003-location-return.test.tsx` and `v5-tab-navigation.test.tsx`) -> **REVIEW (candidate DELETE)**; deep links or dynamically built hrefs could still reach it, so it stays until the owner confirms.

DEV gallery gating (evidence for finding 4):

| Gallery | Lines | Own test | Gate |
|---|---:|---|---|
| `dizajn-ai-mesto` | 71 | locationPointEditor.test | package === `rs.uskoci.dev` |
| `dizajn-ai` | 178 | **none** | `__DEV__` or package ends with `.dev` |
| `dizajn-dodaci` | 203 | dizajn-dodaci.test | `__DEV__` or package ends with `.dev` |
| `dizajn-dogovori` | 289 | **none** | `__DEV__` or package ends with `.dev` |
| `dizajn-kalendar` | 191 | dizajn-kalendar.test | `__DEV__` or package ends with `.dev` |
| `dizajn-kandidati` | 122 | **none** | `__DEV__` or package ends with `.dev` |
| `dizajn-katalog27` | 34 | dizajn-katalog27.test | package === `rs.uskoci.dev` |
| `dizajn-mapa` | 149 | dizajn-mapa-gallery.test | package === `rs.uskoci.dev` |
| `dizajn-obavestenja` | 248 | dizajn-obavestenja-gallery.test | `__DEV__` or package ends with `.dev` |
| `dizajn-objava` | 272 | **none** | `__DEV__` or package ends with `.dev` |
| `dizajn-pocetna` | 78 | dizajn-pocetna.test | `__DEV__` or package ends with `.dev` |
| `dizajn-prijava` | 146 | dizajn-prijava-gallery.test | `__DEV__` or package ends with `.dev` |
| `dizajn-prijave` | 111 | **none** | `__DEV__` or package ends with `.dev` |
| `dizajn-privatnost` | 307 | dizajnPrivatnostGallery.test | `__DEV__` or package ends with `.dev` |
| `dizajn-profil` | 296 | profile-gallery.test | `__DEV__` or package ends with `.dev` |
| `dizajn-tabla` | 111 | **none** | `__DEV__` or package ends with `.dev` |

## 4. Duplicates and parallel implementations

| Finding | Evidence | Decision |
|---|---|---|
| Three token sets | `src/theme/tokens.ts` (5 production importers: `auth.tsx`, `oporavak.tsx`, ...), `src/ui/system/tokens.ts` (the single source per `one-token-source.test.ts`), `src/ui/aiFirst/tokens.ts` (test-only) | CONSOLIDATE: move the auth/recovery routes to `sys` tokens, delete the other two (C1, after P6) |
| Shim re-export | `src/ui/qa/qaTextHash.ts` is a 50-byte re-export of `src/lib/qaTextHash.ts` | CONSOLIDATE (inline the import) |
| Parallel journals | `src/data/aiTurnIntentJournal.ts` vs `src/data/workerAiTurnIntentJournal.ts` (line-set Jaccard 0.51) - the only production pair >= 0.4 | REVIEW: same mechanism for task AI and worker AI; consolidate only with both flows' tests green |
| Same basename in `contracts/` and `lib/` | `location.ts`, `market.ts`, `workerAvailability.ts` (each side has 5-28 importers: types vs logic) | KEEP; naming only |
| Env readers | `EXPO_PUBLIC_SUPABASE_URL` is read in **9 modules** (`supabaseClient`, `index`, `aiNeedV2Production`, `authAvailabilityClientService`, `dataExportDeliveryService`, `mediaBinaryRead`, `productionLocationResolver`, `workerAiClientService`, `useHoldToTalk`) and the anon key in 8; only `supabaseClient.ts` creates clients (2 `createClient` sites) | CONSOLIDATE into one config module (data-layer "jedan važeći reader", plan 7.4) at C1 |
| Platform twins | `dataExportFile`, `loadInterWeb`, `LocationOverviewMap`, `ResolvedPinMap`, `DiscoveryMap` each exist as `.native/.web` or base+`.web` pairs | KEEP (Metro resolves by platform, not duplicates) |
| UI kit generations | `src/ui/v2` (38 files, 552 KB), `src/ui/system` (31), `src/ui/aiFirst` (6), `src/ui/entry` (7), `src/ui/referenceEntry` (1) | no action now; only `aiFirst/tokens.ts` and `referenceEntry` are test-only |
| Repeated internal-build gate | 16 gallery files each re-implement the `.dev` package test in two variants | CONSOLIDATE into one `isInternalBuild()` |

## 5. Exported symbols that occur only at their declaration (23 in 12 files)

| File | Symbols |
|---|---|
| `src/ui/system/Detail.tsx` | `NextStrip`, `FactGrid`, `SectionTitle`, `DetailPairs`, `QuietNote` |
| `src/ui/product/ProductDetails.tsx` | `DetailFact`, `DetailFacts`, `ProductRequirements`, `ProductPerson` |
| `src/contracts/needFactsV2.ts` | `NeedFactV2Value`, `isPrivateNeedFact` |
| `src/ui/agreements/AgreementWorkspace.tsx` | `stateTone`, `WorkspaceNote` |
| `src/ui/entry/spojBrandData.ts` | `intentRequesterSvg`, `intentWorkerSvg` |
| `src/ui/v2/TaskFace.tsx` | `CardDecision`, `CardFoot` |
| `src/app/_layout.tsx` | `unstable_settings` (Expo Router special export: KEEP) |
| `src/theme/tokens.ts` | `Palette` |
| `src/ui/legal/LegalDocuments.tsx` | `PublicLegalSheet` |
| `src/ui/system/PillComposer.tsx` | `pillCommand` |
| `src/ui/system/tokens.ts` | `iconButton` |
| `src/ui/v2/ApplicationFace.tsx` | `applicationFootWords` |

Proposal: remove at C1 together with the module they live in (`Detail.tsx`, `ProductDetails.tsx`, `TaskFace.tsx`, `AgreementWorkspace.tsx`, `LegalDocuments.tsx`, `PillComposer.tsx`, `spojBrandData.ts`, `needFactsV2.ts`, `theme/tokens.ts`, `system/tokens.ts`, `ApplicationFace.tsx`); `TaskFace.tsx` belongs to the untouchable TaskCard family, so it stays until the owner releases TaskCard/Peek.

## 6. `EXPO_PUBLIC_*` flags

| Flag | Read by | Defined in | Note |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | data/aiNeedV2Production.ts, data/authAvailabilityClientService.ts, data/dataExportDeliveryService.ts (+6) | 11 workflow/script files + `eas.json` production | public client config by design; 9 readers (section 4) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | data/aiNeedV2Production.ts, data/authAvailabilityClientService.ts, data/dataExportDeliveryService.ts (+5) | 11 workflow/script files + `eas.json` production | publishable key by design; 8 readers |
| `EXPO_PUBLIC_USE_FAKE_SOURCE` | data/index.ts | 10 workflow/script files | DEV switch for the fake source, forced to `'0'` in every build workflow; `pkg012` test asserts the boundary |
| `EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL` | data/passwordRecoveryLink.ts | 5 workflow/script files | password-recovery redirect, asserted into the APK by `attest_recovery_redirect.py` |
| `EXPO_PUBLIC_P6_DISCOVERY_READER` | data/discoveryV1ReaderGate.ts | 1 workflow/script files | P6 compile flag (set only by `p6-native-apk.yml` and the `tmp/cutover-apk*` build branches); P6 open |
| `EXPO_PUBLIC_P6_DISCOVERY_PROOF` | data/discoveryV1NativeProofGate.ts | 2 workflow/script files | P6 proof-build gate (`p6-native-apk`, `p6-round58-native-proof-build`); P6 open |
| `EXPO_PUBLIC_LOCATION_PROVIDER_HINT` | **no production reader** | none | referenced only by `productionLocationResolver.test.ts` (sets it, then deletes it): a retired flag -> **DELETE the test lines** (C1) |

No flag is read in code and defined nowhere; the only definition-less flag is the retired one above. `.env` (git-ignored) may define more locally.

## 7. Dependencies (38 dependencies + 6 devDependencies)

| Package | src / tests / scripts imports | Verdict | Evidence |
|---|---|---|---|
| `@expo/ui` ~57.0.14 | 1 / 15 / 0 | **KEEP** | imported |
| `@gorhom/bottom-sheet` 5.2.14 | 4 / 7 / 0 | **KEEP** | approved 2026-09-22 (5.2.14) |
| `@imagemagick/magick-wasm` 0.0.43 | 0 / 0 / 9 | **KEEP** | dev: used by 9 scripts |
| `@maplibre/maplibre-react-native` 11.3.10 | 6 / 4 / 0 | **KEEP** | imported |
| `@react-native-async-storage/async-storage` ^3.1.1 | 18 / 28 / 0 | **KEEP** | imported |
| `@supabase/supabase-js` ^2.112.4 | 2 / 4 / 43 | **KEEP** | imported |
| `@types/jest` 29.5.14 | 0 / 0 / 0 | **KEEP** | config/peer |
| `@types/react` ~19.2.2 | 0 / 0 / 0 | **KEEP** | config/peer |
| `decode-uri-component` file:vendor/decode-uri-component-compat | 0 / 1 / 0 | **KEEP** | `file:vendor/decode-uri-component-compat` supply-chain override for `query-string`; `routerDecoderDependencyContract.test.ts` |
| `expo` ~57.0.18 | 3 / 2 / 2 | **KEEP** | imported |
| `expo-blur` 57.0.3 | 2 / 0 / 0 | **KEEP** | explicitly approved 2026-09-27 (search backdrop) |
| `expo-constants` ~57.0.16 | 23 / 18 / 0 | **KEEP** | imported |
| `expo-device` ~57.0.1 | 1 / 1 / 0 | **KEEP** | 1 production import |
| `expo-file-system` ~57.0.6 | 2 / 2 / 0 | **KEEP** | imported |
| `expo-font` ~57.0.2 | 2 / 0 / 0 | **KEEP** | imported |
| `expo-glass-effect` ~57.0.1 | 0 / 0 / 0 | **KEEP** | hard `dependencies` of `expo-router` in `package-lock.json`; the direct entry is only a hoisting pin |
| `expo-haptics` ~57.0.2 | 2 / 7 / 0 | **KEEP** | imported |
| `expo-image` ~57.0.3 | 2 / 2 / 0 | **KEEP** | imported |
| `expo-image-manipulator` ~57.0.17 | 1 / 1 / 0 | **KEEP** | imported |
| `expo-image-picker` ~57.0.17 | 1 / 1 / 0 | **KEEP** | imported |
| `expo-linking` ~57.0.8 | 1 / 4 / 0 | **KEEP** | 1 production import and expo-router peer |
| `expo-location` ~57.0.20 | 1 / 0 / 0 | **KEEP** | imported |
| `expo-notifications` 57.0.15 | 4 / 4 / 0 | **KEEP** | imported |
| `expo-router` ~57.0.17 | 101 / 104 / 1 | **KEEP** | imported |
| `expo-splash-screen` ~57.0.8 | 2 / 3 / 0 | **KEEP** | imported |
| `expo-status-bar` ~57.0.1 | 3 / 5 / 0 | **KEEP** | 3 production imports |
| `expo-symbols` ~57.0.2 | 0 / 0 / 0 | **KEEP** | hard `dependencies` of `expo-router` in `package-lock.json` |
| `expo-system-ui` ~57.0.3 | 0 / 0 / 0 | **KEEP** | implied by `"userInterfaceStyle": "light"` in app.json (Expo requires it on Android) |
| `expo-web-browser` ~57.0.2 | 0 / 0 / 0 | **REVIEW / candidate DEPRECATE (remove)** | no import anywhere, no config plugin, required by no locked package; has an Android module -> removal needs a native build check and owner approval (dependency change) |
| `jest` ~29.7.0 | 0 / 0 / 0 | **KEEP** | config/peer |
| `jest-expo` ~57.0.5 | 0 / 0 / 0 | **KEEP** | config/peer |
| `lottie-react-native` ~7.3.8 | 2 / 1 / 0 | **KEEP** | approved 2026-09-23; wrapper `LottieArt` (test-only until the owner's files arrive) |
| `phosphor-react-native` ^3.0.6 | 65 / 16 / 0 | **KEEP** | imported |
| `react` 19.2.3 | 187 / 159 / 1 | **KEEP** | imported |
| `react-dom` 19.2.3 | 0 / 0 / 0 | **KEEP** | web target (`expo start --web`, static export) and peer of `@expo/metro-runtime`/`@expo/ui` |
| `react-native` 0.86.3 | 191 / 139 / 2 | **KEEP** | imported |
| `react-native-gesture-handler` ~2.32.0 | 3 / 3 / 0 | **KEEP** | imported |
| `react-native-reanimated` 4.5.1 | 15 / 15 / 0 | **KEEP** | imported |
| `react-native-safe-area-context` ~5.7.0 | 54 / 84 / 0 | **KEEP** | imported |
| `react-native-screens` ~4.26.0 | 0 / 0 / 0 | **KEEP** | dependency and peer of `expo-router` |
| `react-native-svg` 15.15.4 | 9 / 5 / 1 | **KEEP** | imported |
| `react-native-web` ~0.21.0 | 0 / 0 / 0 | **KEEP** | web target; optional peer of expo, expo-image, expo-router |
| `react-native-worklets` 0.10.1 | 1 / 2 / 0 | **KEEP** | imported |
| `typescript` ~6.0.3 | 0 / 2 / 35 | **KEEP** | imported |

Rules applied: import scan + config plugins + `package-lock.json` requirers; "no import" is never sufficient (plan 7.2). Version upgrades are **not** cleanup (plan 7.3). Nothing was installed, so `expo-doctor`/`npm ls --all` should confirm `expo-web-browser` before any change.

## 8. Assets (60 files, 3.6 MB)

| Group | Files | Size | Decision |
|---|---:|---:|---|
| Expo template leftovers in `assets/images/` (react-logo x3, tutorial-web, expo-badge x2, expo-logo, splash-icon, favicon, android-icon-background/-monochrome, logo-glow) + `assets/images/tabIcons/*` (6) | 18 | 461.2 KB | **DELETE** (git history keeps them; low risk) |
| `assets/brand/entry-mark-0..6.svg`, `entry-word-0..3.svg` (generated by `scripts/generate-entry-brand.cjs`; production embeds the paths in `spojBrandData.ts`) | 11 | 17.7 KB | **REVIEW -> ARCHIVE** (regenerable; not read at runtime) |
| `assets/entry-splash-empty.xml` | 1 | 0.2 KB | REVIEW |
| `assets/expo.icon/*` (iOS icon folder referenced as a directory by `app.json`) | 3 | 53.8 KB | **REVIEW (release)**: the iOS icon is still the Expo template |
| Keep-by-purpose files without a code reference | 2 | 6.1 KB | KEEP (`OFL.txt` = font license; `provenance.json` = brand provenance) |

Do **not** delete `assets/images/icon.png` (780 KB) and `assets/images/android-icon-foreground.png`: `scripts/ci/attest_launcher_icon.py` uses them as `TEMPLATE_ICON`/`TEMPLATE_FOREGROUND` negative controls to prove the APK does not ship the template icon. All fonts (Inter x5), `assets/brand/app-icon/*`, `assets/brand/entry-v49/*`, `assets/catalog27/*`, `entry-splash-mark.*` and `resolved-location-pin.*` are referenced.

## 9. Scripts, tools and tracked scratch

| Area | Files / size | Finding | Decision |
|---|---|---|---|
| `scripts/` (100 files) | 0.98 MB | 32 files (354 KB) are consumed **only** by workflows proposed for ARCHIVE (`ai_review_*`, `d03_chat_*`, `intent_shell_*`, `n04_*`, `ru5_*`, `task_detail_*`, `test_intent_shell_android.py`, `test_ru5_android_input.py`, `entry_spoj_android.py`, `proofs/r18-storage-integrity-20260926.mjs`, fixtures); `test_intent_shell_android.py` reads `docs/implementation/evidence/.../ENTRY_login.xml`, the only code that reads the evidence folder | ARCHIVE together with their workflows (WORKFLOWS.md groups F/G); keep `scripts/control/*`, `scripts/ci/*` (run by glob in `pre-p4-integrity`), `scripts/p6_*`, `scripts/proofs/p6-*`, `scripts/acceptance/*` (DEV acceptance harness) |
| Zero-consumer files | 19 files: 5 tests run by globs/jest, 3 files of the DEV acceptance harness, 11 tools | tools: `audit_client_architecture.cjs`, `pre_html_source_inventory.cjs`, `capture-entry-v49-reference.cjs`, `generate-entry-brand.cjs`, `prepare-v5-live-candidate.py`, `register-v5-migrations.py`, `validate-product-design-truth.mjs`, `dev-alpha-*.ps1` (3 QA account scripts) | one-shot/owner tooling; `dev-alpha-qa-*` create/sign in QA accounts: KEEP as owner tools; the V5-era and audit scripts -> REVIEW / ARCHIVE |
| `outputs/` | 38 files, 2.65 MB | design/audit scratch (`TOK.html` 1.9 MB, `PREDLOG.html`, screenshots, python helpers) with **no external consumer**; 4 `.tsx` files compile under `tsc` | ARCHIVE (move out; remove from the `tsc` include at the same time) |
| `.maestro/` | 10 flows | owner's phone walkthroughs; owner order is emulator-only; README cites missing `flows/open-tab.yaml` | REVIEW -> ARCHIVE |
| `artifacts/v5-native-smoke/limit-native-parallelism-exact-source.gradle` | 1 file | tracked although `/artifacts/` is git-ignored; named only by V5-era evidence receipts | ARCHIVE |
| Root files | `OVERNIGHT_PROGRESS.md`, `project_inventory.txt` (UTF-16, local machine paths), `remote_migrations.json`, `remote_statements.json`, `missing_remote_statements.json` | 0 consumers in code/workflows; `project_inventory.txt` lists a local `.env` path | ARCHIVE (DOCS.md) |
| Template leftovers | `README.md` ("Welcome to your Expo app"), `scripts/reset-project.js` + `npm run reset-project` | the script **moves/deletes `src/` and `scripts/`** if run | replace README with a real entry page; **DELETE** the script and npm entry (needs owner approval as it edits package.json) |

## 10. Hygiene indicators (production `src`, 440 modules)

- `console.*`: 6 (5 `info`, 1 `error`), all trace instrumentation (`USKOCI_DISCOVERY_TRACE`, `USKOCI_P6_TRACE`, `USKOCI_MAP_LOAD`, `AppErrorBoundary` under `__DEV__`); none prints a business value. KEEP (P6 diagnostics).
- `eslint-disable`: 32, of which 25 `-line` + 7 `-next-line` for **`react-hooks/exhaustive-deps`**, concentrated in `DiscoveryMap.tsx` (7), `DiscoverySearchPanel.tsx` (6), `DiscoveryPresentation.tsx` (3): potential stale-closure/duplicate-effect sites (plan 7.4 React/state) - **review after P6**, never during.
- `any`-typed lines 17 (3 `as any`). No `TODO`, `@ts-ignore` or `debugger`.
- Not assessed (needs runtime evidence, not static scans): timers/subscriptions lifetime, render loops, cache lifetimes, bundle size delta of the galleries.

## 11. Proposed C1 order (each step: preserve semantics, run the affected regression, keep P6 files out)

1. Docs/root clutter and `README.md` (DOCS.md) - no runtime effect.
2. Delete template leftovers: 18 unreferenced template images, the `reset-project` script and npm entry.
3. Retire the Agreement current-location client (service, controller, 3 tests) **after** SERVER.md step 3 revokes the RPCs; delete `aiFirst/tokens.ts`; drop the dead `EXPO_PUBLIC_LOCATION_PROVIDER_HINT` test lines.
4. Consolidate: one `isInternalBuild()` gate, one Supabase env module, `theme/tokens.ts` -> `sys`, `qaTextHash` shim.
5. Decide the legacy reference-entry pipeline with the owner (postinstall + `docs/reference` HTML + `ReferenceEntryHero` + build assertion) as **one** change.
6. `expo-web-browser` removal with a native build; move `outputs/`, `.maestro/`, V5-era scripts to the archive with their workflows.
7. After P6: the `exhaustive-deps` suppressions and the gallery bundle exclusion.

## 12. Limits

- Static only: runtime string-built imports, native autolinking and Expo config plugins are invisible to the scanner (0 dynamic requires exist in `src/`, which limits the risk).
- "Reachable" is graph reachability, not execution: a reachable module can still be behind a flag (P6 reader flags) or a dead branch.
- `tsc`, Jest and `expo-doctor` were not run (no `node_modules`); the counts of tests come from file names.
