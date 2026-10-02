# B22 / RNR-01 — the Reanimated patch (patch-package), 2026-10-02, after review round 1

**Status: SOURCE and CI-gate wiring WRITTEN and reviewed once (18 findings, all handled below), tests green locally; NOT built, NOT measured on a phone, NO animation-regression run. Nothing in this change closes B22.** The owner decided on 2026-10-02 ("uvedi zakrpu") to introduce `patch-package` for this ONE patch (AGENTS.md 3.1.5: admitted for this purpose only). B22 stays open until the BEFORE/AFTER measurement in section 9 shows the effect without an animation regression and the owner says so. This document is the handoff; the registry (`docs/control/redovi.json`, row B22) is recorded by the root integrator, not by this change.

Levels, never mixed: **SOURCE** (this change) / **CI** (not run for this change) / **APK BUILT** (not yet) / **PHYSICAL DEVICE** (not yet). The Kotlin was type-checked and behaviour-tested locally against stubs with the committed harness (section 7); the real compile gate is the Gradle build in CI.

## 0. Review round 1: the 18 findings and what became of them

Three reviewers (native behaviour, tests/protocol/document, build/CI/dependency) returned FIX_REQUIRED. Each fix to the patch or the verifier has a test that failed before it (the proof is named in the last column).

| Finding | What was wrong | What changed | Test that failed before |
| --- | --- | --- | --- |
| native#1 (major) | At 64 failing mounted tags `clear()` wiped the whole back-off map, so every tag was retried on every pass with a stack log each: the original flood again | Cap raised to 1,024 as a memory bound; `clear()` removed; at the cap only STALE entries are evicted, a live back-off never is (section 2) | Harness scenario 10 against the round-0 patch: `min 625 max 625 of 625 passes` (every tag retried on every pass); now 7 to 9 attempts in 10 s |
| native#2 | The comment "callers run on the UI thread only" is true only in debug builds | `UiThreadUtil.isOnUiThread()` is tested once per `synchronouslyUpdateUIProps` call; off the UI thread the guard is bypassed and its state untouched; comment rewritten (section 2) | Harness scenario 9 |
| native#3 | `remove(viewTag)` boxed an Integer per skipped tag per pass | Removal only when the failure map is non-empty (`forgetSyncUpdateFailure`); named-tag set touched only below 64 names | Not testable as boxing; the behaviour (nothing remembered, nothing removed) is scenarios 2 and 6 |
| native#4 | A ViewState without an Android view makes `resolveView` throw; the patch built an exception per pass and fell through | Decision: SKIP and count it as `viewless` (section 1, reading of RN 0.86.3); any other error of the check still falls through to the upstream call | Harness scenarios 4 and 4b |
| native#5, tests#3, build#1 | `.gitattributes` had no `patches/*.patch text eol=lf`, so an autocrlf checkout wrote CRs into the patch and `npm ci` failed | The root added the line; the verifier (`--repo` mode) and the Jest suite now require it | Mutation cases "loses the patch line" and "only as a comment" (red on the round-0 rules) |
| tests#1, tests#2, tests#4 | Section 9 ignored the committed window-5 evidence, did not fit the 6-minute grant, used `bc`, left M2b undefined | Section 9 rewritten around window 5 and the unchanged `scripts/window5_tour.py`; `b22/count_log.cjs` (plain Node) with a synthetic log replaces the shell one-liners | `count_log.cjs` run on `synthetic_logcat_sample.txt`, on a log without any match and on a CRLF log |
| tests#5 | The dex-marker attestation failed the job BEFORE the artifact upload | The step records a verdict and never fails; upload; then a separate enforce step fails the job (section 6) | Execution tests of the real step on 9 fake APKs; mutation cases for the order |
| tests#6 | The behaviour scenarios lived only in a scratchpad | Harness committed in `b22/kotlin-harness/` with a Node runner and README | The harness itself (`ALL OK`) |
| tests#7 | `native.length >= 10` and a raw `ignore-scripts` grep disagreed with the verifier | The test uses `guard.workflowCode` (comments stripped) and `native` must contain the dev APK workflow | The old raw-text test went red on a comment that mentions `ignore-scripts`; the new case keeps such a comment green |
| build#2 | The contract test ran only in full mode; workflow-only edits did not select it | `scope.cjs` forces `reanimatedPatchContract` in targeted mode when a workflow, `.gitattributes`, `.npmrc`, `eas.json`, `patches/` or the verifier changes | 3 new `scope.test.cjs` cases (red against HEAD's `scope.cjs`) |
| build#3 | Survivors: root `.npmrc` with `ignore-scripts`, `if: ${{ false }}` and `continue-on-error: true` on the verify step | New rules `NPMRC_IGNORE_SCRIPTS`, `EAS_IGNORE_SCRIPTS`, `WORKFLOW_VERIFY_STEP_GATE`, `WORKFLOW_CONTINUE_ON_ERROR` | 16 new mutation cases, all red against the round-0 rules |
| build#4 | In the BEFORE (skip) arm `|| true` swallowed a failed `unzip`, so a missing dex set passed | At least one `classes*.dex` is required in BOTH arms; an unreadable or missing APK is a failed verdict; `dexFiles` is in the receipt | Execution tests: "no dex", "cannot be read", "missing" (the old step passes all three: shown) |
| build#5 | A push to `clean-alpha-backend` that touches the workflow builds a patched APK and would replace `dev-latest` | Publishing a patched APK needs the repository variable `RNR01_PUBLISH_PATCHED = yes` (section 6) | Mutation cases "without the owner gate" and "from any branch" |
| build#6 | Document: `.gitattributes` row, `expo prebuild` point, broad `git add` | Fixed here: sections 3, 10 and 11 | n/a (document) |

## 1. What the patch changes, in plain words

File: `node_modules/react-native-reanimated/android/src/main/java/com/swmansion/reanimated/NativeProxy.kt` (4.5.1), method `synchronouslyUpdateUIProps`. Nothing else in the library is touched (no C++, no JS, no iOS).

Before: on every draw-pass event Reanimated replays every retained animated-props entry. For an entry whose view no longer exists, the call into React Native throws an exception, the reflection layer wraps it in a second one, and `Log.w` prints both deep stacks, on every pass, forever (until the JS garbage collector drops the entry about 2-3 s after its last update). It never removes anything. react-native-svg raises the draw-pass event in the middle of drawing, so every SVG draw triggers it.

After:

1. **A tag with no mounted view is skipped before any exception exists.** The check is `FabricUIManager.resolveView(tag) != null`, the call Reanimated already uses in `preserveMountedTags`. `null` is exactly the case where the old call would have thrown "Unable to find SurfaceMountingManager for tag" (or done nothing on a stopped surface), so nothing that worked is dropped. The skip is **stateless**: nothing is remembered about the tag, the registry (in C++, untouched) keeps its last value and replays it, so the first pass after a view appears applies it exactly as before. No lateness for a view that mounts late.
2. **A ViewState that exists without an Android view is skipped too and counted as `viewless`** (decision of round 1, finding native#4). `resolveView` throws `IllegalViewOperationException` in that case (RN 0.86.3 `SurfaceMountingManager.getView`): a view still being created (`registryPut` runs before `viewManager.createView`), a `ViewState` made by `updateEventEmitter` for a node that has no view, a non-layoutable node. Read from the RN 0.86.3 sources: the upstream call would then only replace `ViewState.currentProps` by the animated props and touch no view (`updateProps`: `val view = viewState.view ?: return`), and `currentProps` is read back only in `updateState`, for a ViewState that has a view. Reanimated's own `preserveMountedTags` treats the same exception "the same as a missing view". So skipping loses nothing visible and, if anything, keeps the full initial props in the ViewState. Any OTHER exception thrown by the check itself (it could not run) still goes through the upstream call, like before.
3. **A tag whose view exists but whose update still throws** (a real fault, not expected) is logged once, with the real cause (not the reflection wrapper), then retried after a back-off that doubles per failure (250, 500, 1000, 2000 ms, then 2000). Success or leaving the mounted state removes the back-off.
4. **Off the UI thread nothing is guarded** (section 2): the call is made like upstream and a failure is logged with the old text plus `[USKOCI_RNR01: not on the UI thread, unguarded]`.
5. **Logging contract.** One line per skipped tag per 5-second window (`[USKOCI_RNR01] synchronouslyUpdateUIProps skipped unmounted tag N ...`, at most 64 names per window), and one summary line per window with at least one event: `[USKOCI_RNR01] synchronouslyUpdateUIProps summary: skipped=K viewless=V backedOff=B failed=F untracked=U evicted=E tracked=T windowMs=W`. A real failure keeps the old text prefix `synchronouslyUpdateUIProps failed for tag N`, so a line with that prefix on a patched build is a real fault, not noise. The summary is written only when a later call arrives after the window, so the last partial window of a run is never written: sums of `skipped=` are a lower bound by up to one window.

What it does NOT do: it does not remove the C++ work (copy, serialise, parse of dead entries) and does not stop live entries being re-applied on every SVG draw event (probably the larger remaining cost); it does not change the lifetime of a dead entry. It is a cost and noise reduction inside that window. It does not make the app feel faster by itself.

Rejected alternatives (mapper analysis, source level): a C++ removal (needs a JNI signature change, no local NDK/Gradle, and deleting is semantically unsafe because a not-yet-mounted tag fails the same way as a deleted one); a pure per-tag back-off (still builds one exception per window per tag and delays the fail-then-succeed case); gating `NodesManager.onEventDispatch` (changes flush timing, needs its own measurement); upgrading to 4.7.0 (identical files, leaves the Expo SDK 57 set).

## 2. Parameters, the eviction rule, thread safety

Named constants in the companion object of `NativeProxy`:

| Constant | Value | Why |
| --- | --- | --- |
| `SYNC_UPDATE_RETRY_BASE_MS` | 250 | First wait after a real failure. Short: an unmounted tag is already skipped without trying, so a failure here is abnormal and a long wait would only delay a view that recovers. |
| `SYNC_UPDATE_RETRY_MAX_MS` | 2,000 | Cap of the doubling (250, 500, 1000, 2000, 2000, ...). |
| `SYNC_UPDATE_FAILED_TAGS_MAX` | 1,024 | Failing mounted tags remembered at once (about 100 bytes each, so about 100 KB at most). Far above the animated views of any screen: it is a memory bound, not a working limit. Round 0 had 64 and cleared the whole map when it was full. |
| `SYNC_UPDATE_FAILURE_STALE_MS` | 4,000 | An entry whose retry fell due this long ago and was never attempted belongs to a tag that is gone. Used only when the table is full, and a sweep runs at most once per this interval. |
| `SYNC_UPDATE_NAMED_TAGS_MAX` | 64 | Skipped (unmounted) tags named in the log per summary window. |
| `SYNC_UPDATE_SUMMARY_WINDOW_MS` | 5,000 | One summary line per window; the per-tag skip names are cleared at each summary. |

**The eviction rule, and why it is not "evict the oldest".** When a new failing tag finds the table full, entries that are stale (retry due 4 s ago or more, never attempted) are evicted, at most once per 4 s; if there is still no room the tag is not tracked: it is retried on every pass like upstream, counted as `untracked`, without a stack trace. A live back-off is never evicted to make room. The requested alternatives (evict the oldest or the least recently failed live entry) were simulated first (`b22/kotlin-harness/eviction_simulation.py`; 60 draw-pass events per second for 8 s, the failing tags scanned in the same order every pass, as Reanimated does):

| N failing tags, cap C | policy | attempts (reflective calls that threw) | tags attempted on (almost) every pass |
| --- | --- | --- | --- |
| 100, C = 64 | clear everything (round 0) | 48,000 | 100 of 100 |
| 100, C = 64 | evict the oldest (FIFO) | 48,000 | 100 of 100 |
| 100, C = 64 | evict the entry due soonest | 48,000 | 100 of 100 |
| 100, C = 64 | evict the newest | 18,201 | 37 |
| 100, C = 64 | evict nothing, retry the overflow quietly | 17,728 | 36 |
| 300, C = 256 | clear / FIFO / soonest-due | 144,000 each | 300 of 300 |
| 300, C = 256 | evict nothing, retry the overflow quietly | 22,912 | 44 |
| 50, C = 64 (everything fits) | any | 350 | 0 |

With a table smaller than the number of failing tags, FIFO and soonest-due eviction thrash completely (every tag retried on every pass, exactly like clear-all), because the scan is cyclic. Never evicting a live back-off keeps every tracked tag on its schedule and confines the damage to the overflow. So the real protection is a cap that is never reached (1,024), and the eviction only exists so that entries of vanished tags cannot fill it in a long session. The harness proves: 100, 500 and 1,000 failing tags (scenario 10, more than the old cap) each follow the schedule with 7 to 9 attempts in 10 s instead of 625, one stack per tag; 1,100 failing tags (scenario 11) keep the 1,024 tracked tags on schedule while the 76 overflow tags are retried quietly every pass; stale entries are evicted (12), live ones never (13), sweeps are rate limited (14). Beyond 1,024 simultaneously failing mounted tags the overflow tags are NOT protected: that is a stated limit, visible as `untracked=` in the summary.

**Thread safety.** The state is a plain `HashMap`/`HashSet`. `UiThreadUtil.assertOnUiThread()` in React Native is gated by `ReactBuildConfig.DEBUG` and only logs (`SoftAssertions`), so in the release APK it is not what keeps the state safe. Two things do: (a) `synchronouslyUpdateUIProps` now tests `UiThreadUtil.isOnUiThread()` once per call and bypasses the guard off the UI thread (the same test `preserveMountedTags` uses in the same file); (b) by construction no caller is off it, which was read in the installed sources: the only path to `synchronouslyUpdateUIProps` is `ReanimatedModuleProxy::applySynchronousUpdates`, reached from `performNonLayoutOperations` (called by `NodesManager.performOperationsRespectingDrawPass`, from `onEventDispatch` on the UI-thread branch and from `NativeProxy.maybeFlushUIUpdatesQueue` on the UI runtime) and from `performOperations` only when the `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` feature flag is set (`shouldUseSynchronousUpdatesInPerformOperations`), which this app does not set (no `staticFeatureFlags` override in `package.json`).

All state is instance state (never static: a JS reload restarts the tags and creates a new `NativeProxy`).

## 3. How it is wired (files)

| File | Role |
| --- | --- |
| `patches/react-native-reanimated+4.5.1.patch` | The patch (232 lines, one file, LF, ASCII). Its bytes are exactly what `npx patch-package react-native-reanimated` produces from the edited file: that command was run in an isolated scratch project (the repo's patch-package 8.0.1, pristine 4.5.1 downloaded by it) and the output compared byte for byte. SHA-256 `c8ed7574f1a76c5bda70226bc62d834bec9055d22bd287f2f4717d4f5364a1a9`. |
| `package.json` | `"patch-package": "8.0.1"` in `dependencies` (exact; NOT `devDependencies`: the dev APK workflow installs with `NODE_ENV=production`, which omits dev dependencies). `postinstall` is `patch-package --error-on-fail --error-on-warn && node ./scripts/verify-native-patches.cjs && node ./scripts/sync-entry-reference-assets.cjs`. |
| `package-lock.json` | patch-package 8.0.1 and 19 transitive packages added (20 in `node_modules`), nothing removed or changed (section 8). |
| `scripts/verify-native-patches.cjs` | Built-ins only. Proves what patch-package cannot: it exits 0 when `patches/` is missing and when an upgraded library still applies cleanly. Pins the SHA-256 of the patch, of the pristine 4.5.1 file (`bc198ba58e5ce15b2a5873dac4446fc057a457fd93443664710b4481671d0c0d`) and of the patched file (`713f771c28ca74b3b1438b77d72c9876e34bbf0c647fe2fc8cf287169e593fb5`). Modes: default (must be patched), `--expect-unpatched` (BEFORE arm), `--repo` (also scans workflows, `.gitattributes`, `.npmrc`, `eas.json`). |
| `__tests__/reanimatedPatchContract.test.ts` | The guard (section 5). |
| `.github/workflows/build-android-dev-apk.yml` | Verify step after `npm ci`, BEFORE-arm input, APK attestation, enforcement after the upload, publish gate (section 6). |
| `scripts/ci/scope.cjs`, `scripts/ci/scope.test.cjs` | `patches/` and the verifier are build changes (full regression); a change to any workflow, `.gitattributes`, `.npmrc` or `eas.json` selects the contract suite even in targeted mode. |
| `.gitattributes` (added by the root integrator; already committed in `f8e36e52`) | `patches/*.patch text eol=lf`. Without it, `core.autocrlf=true` writes a CRLF patch on a Windows checkout and `postinstall` (and so `npm ci`) fails by design. The guard now requires the line. After the commit, check on a Windows checkout that `git ls-files --eol patches/` reports `w/lf`. |
| `docs/.../b22/kotlin-harness/` | The committed behaviour harness (section 7). |
| `docs/.../b22/count_log.cjs`, `synthetic_logcat_sample.txt` | The log-derived numbers of the measurement and a synthetic log they were tested on (section 9). |

`postinstall` runs on every `npm ci`/`npm install`, so all 133 workflows that install and EAS (which runs `npm install`, then `expo prebuild`, then Gradle) get the patch with no per-workflow edit; no workflow uses `--ignore-scripts` (guarded). Reanimated is compiled from `node_modules` in the app build (CMake/Kotlin from source), so the patch takes effect only in a fresh native build.

`expo prebuild --clean` does not undo the patch: verified by the build reviewer in `@expo/cli`'s `prebuildAsync`, which reinstalls dependencies only when the template's dependencies change, and then through npm, so `postinstall` re-applies the patch (and the dev APK workflow's attestation would catch an unpatched APK anyway).

**Other native workflows** (the nine others that contain `expo prebuild` or `gradlew`: `ai-review-mobile-proof`, `build-android-push-proof`, `d03-chat-mobile-proof`, `intent-shell-mobile-proof`, `notifications-n04-inbox-mobile-proof`, `p6-native-apk`, `p6-round58-native-proof-build`, `ru5-physical-android-device-ui-proof`, `task-detail-mobile-proof`; `w01-auth-recovery-proof` builds through a shell script after its own `npm ci`; `p6-native-journey` uses the APK of `p6-native-apk`): they do not need the explicit verify step for correctness, because the loud `postinstall` already runs in their `npm ci` and an install failure stops them. The guard test enforces that each of them installs before it prebuilds/builds and that none skips scripts, and `scope.cjs` now runs the guard when any workflow changes. An explicit step is optional belt-and-braces; `p6-native-apk.yml` (the CI-emulator APK, where the ANR was observed) is the best candidate if wanted.

## 4. When Reanimated changes (update path) and rollback

**A Reanimated bump makes `npm ci` fail loudly** (version mismatch under `--error-on-warn`, or a hunk that no longer fits under `--error-on-fail`; also the verifier and the guard). Then either:
1. Check upstream first: if `NodesManager.kt`/`NativeProxy.kt` no longer replay-and-log dead tags, drop the patch (rollback below).
2. Otherwise re-create it: `npm ci` with the patch temporarily moved away, edit the new file with the same three marked blocks, `npx patch-package react-native-reanimated` (this downloads the pristine tarball; on Windows the temporary install of Reanimated plus its peers took more than 20 minutes: run it in a scratch copy of `package.json` plus `package-lock.json` plus the edited library folder, as was done for this round), rename to the new version, update `LIBRARY_VERSION`, the three pins in `scripts/verify-native-patches.cjs`, the version in this document and in the workflow attestation, and run the guard and the harness.

**Rollback** (this is a compile-time native change; there is no runtime switch, rollback means a rebuild):
1. `npx patch-package --reverse` (fails if the files changed since patching).
2. `git rm patches/react-native-reanimated+4.5.1.patch`; delete the verifier, the guard test, the workflow additions (verify, reverse, attest, enforce, gate and notice steps, the `reanimated_patch` input), the `scope.cjs` additions and the harness folder together; remove the `.gitattributes` line.
3. Restore `postinstall` to `node ./scripts/sync-entry-reference-assets.cjs`; `npm uninstall patch-package` (restores the lockfile; check `git diff --stat package-lock.json`).
4. `rm -rf node_modules && npm ci`, rebuild the APK.
Never delete only the patch file while leaving patch-package in place: patch-package is silent about a missing patch (the guard exists to catch exactly that).

## 5. The guard (`__tests__/reanimatedPatchContract.test.ts`, 82 tests)

It asserts:

- Reanimated pinned exactly (`4.5.1`) and the patch file name carries that version; patch-package exact, in `dependencies`, not `devDependencies`; the lockfile (root entry and package entry) agrees with `package.json`; the installed Reanimated and patch-package versions agree.
- `postinstall` order: patch-package with `--error-on-fail --error-on-warn`, then the verifier, then the existing asset sync (kept).
- `patches/` holds exactly one file; LF only; one `diff --git` header and it is `NativeProxy.kt`; no binary, rename, copy or mode change; the patch adds every marker; the patch SHA-256 is the reviewed one. `.gitattributes` carries `patches/*.patch text eol=lf` (as a code line, not a comment).
- Installed file: each marker exactly once (catches "not applied" and "applied twice"), the replaced upstream statement gone, SHA-256 equals the reviewed patched file.
- Workflows (comments never count): none uses `ignore-scripts` / `npm_config_ignore_scripts`; no root `.npmrc` or `eas.json` disables scripts; every workflow that runs `expo prebuild` or `gradlew` has an earlier `npm ci`/`npm install`; the dev APK workflow verifies after `npm ci` and before prebuild and Gradle with exactly the condition `inputs.reanimated_patch != 'skip'`, keeps the patch ON by default, has no `continue-on-error` anywhere, can build and verify the BEFORE arm, attests the APK in an unconditional step with an id and a dex file count, uploads the artifact unconditionally, enforces the verdict from its own step AFTER the upload and BEFORE publishing, never publishes an unpatched build or one from another branch, and publishes a patched build only behind `vars.RNR01_PUBLISH_PATCHED == 'yes'`.
- The attestation shell is EXECUTED: the real step text is extracted from the real workflow and run with bash on nine fake APKs (patched with the marker in `classes.dex` and in `classes3.dex`, patched without it, patched with no dex, unpatched without the marker, unpatched with it, unpatched with no dex, an unreadable APK, a missing APK); verdict, `dexFiles`, `dexMarkerLines` and the pins in the receipt are asserted. Skipped where bash with unzip, awk, grep, mktemp and git is missing (a WSL bash on Windows does not count).
- Against the real patch-package in a throwaway project: `--reverse` gives the pristine 4.5.1 file (SHA pinned), applying gives the reviewed bytes, a second apply changes nothing (idempotent), a hunk that no longer fits and a library version change both exit non-zero with the flags `postinstall` uses.

**Mutation proof** (inside the suite, so it runs in CI on every change): 59 table cases each delete or change one element in a throwaway copy of the real files and require the specific violation code; the unmutated copy is first required to be clean, so each case is red only because of its mutation. Beyond the 43 cases of round 0 (pins, lockfile, six `postinstall` variants, patch directory and file, installed file, workflow install order, verify step, defaults, publish, BEFORE arm, attestation) the 16 cases added in round 1 cover `.gitattributes` (deleted line, commented line), `.npmrc` (two key spellings), `eas.json`, the verify step (`if: false`, `continue-on-error`), the attestation (no dex count, conditional, `continue-on-error`, never enforced, enforced on the wrong verdict, enforced before the upload), the upload (conditional) and the publish (no owner gate, any branch). All 16 are red against the round-0 rules (shown by swapping the round-0 workflow logic into the verifier for one run). Plus two comment cases: a comment cannot stand in for `npm ci`, and a comment that merely mentions `ignore-scripts` is not a violation.

## 6. Workflow changes (`build-android-dev-apk.yml`)

- New `workflow_dispatch` input `reanimated_patch` (`apply` default, `skip`). `push` runs always apply.
- After `npm ci`: `Verify the Reanimated patch (RNR-01)` runs `node scripts/verify-native-patches.cjs` (when not `skip`). With `skip` (BEFORE arm only): `npx patch-package --reverse --error-on-fail` and `node scripts/verify-native-patches.cjs --expect-unpatched`. The default build is the patched one; the unpatched one is never the default.
- `Attest the Reanimated patch state of the artifact (RNR-01)` (id `rnr01_attest`, unconditional): unzips `classes*.dex`, counts the dex files (at least one is required in BOTH arms, so a missing, unreadable or empty set is a failed verdict, never a vacuous pass) and counts `USKOCI_RNR01` in them (at least 1 for `apply`, 0 for `skip`). It writes `USKOCI-DEV-reanimated-patch-attestation.json` (patch state, verdict and reason, dex file count, dex marker lines, Reanimated version, patch SHA-256, installed file SHA-256, APK SHA-256, source tree, run id) and the step outputs `verdict` and `reason`. It never fails the job itself.
- `Upload workflow artifact` runs next, unconditionally, so that a surprise (for example the marker not surviving into the dex) leaves the APK and the receipt to inspect. The artifact of a `skip` build is named `USKOCI-DEV-APK-unpatched`.
- `Enforce the Reanimated patch attestation (RNR-01)`: when the verdict is not `pass` it prints the reason and exits 1, which also stops the publishing step after it.
- **Publish gate.** `Refresh dev-latest pre-release` now needs `github.ref == 'refs/heads/clean-alpha-backend'` AND `inputs.reanimated_patch != 'skip'` AND the repository variable `RNR01_PUBLISH_PATCHED == 'yes'`; a notice step says plainly when it was skipped for lack of the variable. **What this means for the owner, recorded plainly:** this workflow file is itself a `push` trigger path on `clean-alpha-backend`, and every build now carries the patch, so merging this change builds a patched APK automatically with no phone evidence and no BEFORE/AFTER measurement. Without the gate that APK would replace the public `dev-latest` pre-release, the one the owner installs from. With the gate it only becomes a 14-day workflow artifact (`USKOCI-DEV-APK`) and `dev-latest` is NOT refreshed by ANY push until the variable is set; the owner (or the root integrator on his word) sets it with `gh variable set RNR01_PUBLISH_PATCHED --body yes` once he decides that a patched build may be the DEV APK of record, either before the measurement or after it. The gate changes nothing else in the workflow; the root can drop it by deleting the condition and its mutation cases if the owner prefers the automatic refresh.

## 7. What was verified locally (SOURCE level)

Run on 2026-10-02, Windows 11, Node 24.18.0, in the checkout of the session (other agents were editing unrelated files at the same time):

- Pins: pristine `NativeProxy.kt` 342 lines, SHA-256 `bc198ba5...0d`; patched 536 lines, `713f771c...3fb5`, LF only, ASCII only; patch `c8ed7574...a9`, 232 lines.
- **The patch is exactly what patch-package makes.** A temporary git repository diff with patch-package's own flags reproduced the round-0 patch byte for byte, so it was used to iterate; the final patch was then regenerated with the real `node node_modules/patch-package/dist/index.js react-native-reanimated` in an isolated scratch project (copy of `package.json`, `package-lock.json` and the edited library folder; the pristine 4.5.1 was downloaded by patch-package) and `cmp` reported the file byte-identical to `patches/react-native-reanimated+4.5.1.patch`.
- Round trip on that scratch copy with `--error-on-fail --error-on-warn`: patched `713f771c` -> `--reverse` -> pristine `bc198ba5` -> apply -> `713f771c` -> apply again -> `713f771c` (unchanged). In the repository, `npx patch-package --error-on-fail --error-on-warn` on the patched tree exits 0 and leaves the file byte-identical.
- `node scripts/verify-native-patches.cjs` and `... --repo` print OK; `... --expect-unpatched` on the patched tree exits 1 (`INSTALLED_NOT_PRISTINE`, `INSTALLED_MARKERS`) as it must.
- `npx jest __tests__/reanimatedPatchContract.test.ts`: 82 of 82 pass (about 45 s). `node --test scripts/ci/scope.test.cjs`: 24 of 24 pass (21 before; of the 3 new cases two are red against HEAD's `scope.cjs`, as is the round-0 patch case; the third is a negative guard). The workflow YAML parses (19 steps).
- `npx tsc --noEmit -p tsconfig.json`: no error in any B22 file. It exits 2 because of 4 errors in `src/ui/__tests__/press-reduced-motion.test.tsx`, a file edited concurrently by the UI work of another agent (it imports `usePressLift`, which exists only as an untracked file, and `PRESS_DELAY`, `hapticOn`); not touched here.
- **Kotlin behaviour harness** (`b22/kotlin-harness/run.cjs`, section 7a): compiled with Kotlin 2.2.21 (K2, the compiler in the local Gradle 9.3.1 distribution) at language and API level 2.1 against stubs with **0 errors and 0 warnings**; all 14 scenarios `ALL OK` on the pinned installed file. Against the round-0 patch the overflow scenario fails (`min 625 max 625 of 625 passes`).
- The attestation shell step was run on 9 fake APKs inside the Jest suite (above); the OLD step passes an APK without any dex and an unreadable APK vacuously in the unpatched arm (shown on two fake APKs).
- The RN 0.86.3 types and behaviour the patch relies on were read in source: `FabricUIManager.resolveView(int): View?` (null when no surface holds the tag or the surface is stopped; throws `IllegalViewOperationException` when a `ViewState` has no view), `MountingManager.updatePropsSynchronously` (throws `RetryableMountingLayerException` through `getSurfaceManagerForViewEnforced`), `SurfaceMountingManager.updateProps` (stores props and returns when the view is null), `createView` / `createViewUnsafe` / `updateEventEmitter` for the ViewState lifecycle, and `UiThreadUtil.assertOnUiThread` (debug only).

### 7a. The harness

`b22/kotlin-harness/` (README there): `run.cjs` extracts the three RNR-01 regions verbatim from the installed file and refuses to run unless that file is the pinned reviewed one; `stub_*.kt` are the stand-ins (the fake mounting manager is called through a real `java.lang.reflect.Method`); `Main.kt` holds the 14 scenarios with a virtual clock; `eviction_simulation.py` is the policy comparison of section 2. Command from the repository root: `node docs/implementation/product-v1-closure-20260926/finalization-20260927/b22/kotlin-harness/run.cjs`. It tests the guard logic; it is not the app's Gradle build, and its compiler is not the 2.1.20 that React Native 0.86's Gradle build uses.

## 8. Dependency delta (supply chain)

`npm install patch-package@8.0.1 --save-exact --ignore-scripts`: 20 packages added in `node_modules`, none removed, no version changed. patch-package 8.0.1 (MIT, Node >= 14, published 2025-09-29). Transitive: `@yarnpkg/lockfile@1.1.0`, `call-bind@1.0.9`, `call-bound@1.0.4`, `define-data-property@1.1.4`, `find-yarn-workspace-root@2.0.0`, `fs-extra@10.1.0` (nested `universalify@2.0.1`, `jsonfile@6.2.1` with nested `universalify@2.0.1`), `has-property-descriptors@1.0.2`, `isarray@2.0.5`, `json-stable-stringify@1.3.0`, `jsonify@0.0.1`, `klaw-sync@6.0.0`, `object-keys@1.1.1`, `set-function-length@1.2.2`, `tmp@0.2.7`, `patch-package/node_modules/ci-info@3.9.0`, `patch-package/node_modules/slash@2.0.0`. Nine packages already present lose `"dev": true` because they are now production dependencies (`call-bind-apply-helpers`, `dunder-proto`, `es-define-property`, `es-object-atoms`, `get-intrinsic`, `get-proto`, `gopd`, `has-symbols`, `math-intrinsics`). None of the new packages has an install script. patch-package is a build/install tool: never imported by the app and not part of the APK. The build reviewer independently re-ran `npm ci --ignore-scripts` from the lockfile (902 packages, exit 0), the real `postinstall` under `NODE_ENV=production` and `CI=1`, the licences (MIT, BSD-2, Apache-2.0, ISC; `jsonify` "Public Domain") and `npm audit` (identical before and after).

## 9. Measurement protocol (BEFORE / AFTER on the HONOR) — WINDOW 1 (AFTER TOUR) RUN 2026-10-02; WINDOW 2 (ANIMATION PROBES) NOT RUN

### 9.0 Result of window 1 (the owner's "sad", 2026-10-02 06:19-06:23 CEDT; evidence `b22/window5_after_patched_20261002.json`)

The frozen `window5_tour.py` (and `ui.py`, `ex04_boundary.py`, byte-identical to `b22/scripts/` apart from line endings) ran UNCHANGED on the patched APK `1001e966...` (run 36953943157, attestation `verdict: pass`, `patchState: patched`, 2 dex marker lines), installed with `adb install -r` over the unpatched `81b8a833` (data kept). Two cycles, 207.1 s, 20 of 20 tour notes identical to the BEFORE list, no step False, nothing changed on the phone.

| # | Quantity | BEFORE (unpatched) | AFTER (patched) | Verdict |
| --- | --- | --- | --- | --- |
| 1 | Arm validity | `81b8a833`, no patch | installed SHA-256 = the artifact's; attestation pass; the same 20 notes | PASS |
| 2 | `reanimatedWarnLines` | most of 465,742 (about 170 lines per failure) | **33** (31 distinct dead tags named once each, 2 summaries); limit 500 | PASS |
| 3 | App-process log lines | 465,742 (1,925 / s) | **1,100** (5.3 / s); 1,067 are non-Reanimated ordinary app and Android lines (ViewTreeObserver W 290, ReactNativeJS I 274, ...) that the patch does not touch | reported with breakdown (above "a few hundred" only because of non-Reanimated lines) |
| 4 | Frames over 700 ms | not kept | **0**; the whole gfx histogram has nothing above 97 ms; 0 Davey lines | PASS |
| 5 | Janky share | 1.93 % | **1.46 %** (59 of 4,041) | PASS |
| 6 | p99 frame time | 22 ms | **19 ms** (p50 5, p90 8, p95 11) | PASS |
| 7 | ANR / fatal | none | **none** (`anrLines` 0, `fatalOrAnrLogLines` empty; the newest exit-info entry is the install itself, reason PACKAGE UPDATED) | PASS |
| 8 | Every screen still renders and animates | 20 notes, all ran | the same 20 notes; **motion itself was NOT captured** (no video, no probe) | PARTIAL: window 2 (probes P1-P5, section 9.5) is still required |

Reported, not criteria: `failedLines` 0 (so no old-style failure remains, by construction), `skippedSum` at least 3,925 (the updates for unmounted tags are still retried and skipped silently: 3,028 in one 8.9 s window and 897 in a 19.3 s window; the patch removes the logging cost, not the retry), `viewlessSum` 0, `backedOffSum` 0, `untrackedSum` 0, `evictedSum` 0. PSS 423 MB (BEFORE 525 MB: a different process age, not claimed as an effect).

**Honest limits.** (a) The comparison is the primary one of 9.1 (two builds of two commits that differ only by the patch and documentation, EX-06 server files, proofs and one test; no `src/` file), not a same-commit A/B. (b) One phone, one routine of two cycles. (c) PSS, janky and p99 also depend on process age and on what else ran on the phone. (d) Row 8 is not closed.

**B22 is therefore NOT closed.** Rows 1-7 pass; row 8 needs window 2 (the five animation probes) and the owner's word ("effect without animation regression"). The patched APK stays installed on the HONOR until the UI wave-1 build replaces it.


### 9.1 What is compared, and which comparison is honest

**Primary BEFORE: window 5, already committed.** The owner's fifth "sad" (2026-10-02 00:27-00:35): a read-only tour of Zadaci with the Mapa control, Dogovori with one card opened and Back, Moj profil, Obavestenja, Moji zadaci and Moje prijave, two cycles, 242 s, on the normal unpatched DEV APK `81b8a833` (source `fb865dd7`, CI run 36931086522). Evidence: `b22/window5_before_tour_20261002.json` and `b22/README.md` (window 5 section). Result: **2,699 `synchronouslyUpdateUIProps failed` lines on 3,932 frames = 0.686 per frame** (11.16 per second), **39 dead view tags**, **465,742 log lines of the app process** (118 per frame, 1,925 per second) in **4 bursts of about 10 s**, janky 1.93 %, p99 22 ms, missed vsync 12, slow UI 29, no crash, no ANR. The earlier window-4 baseline (0.014 per frame) covered the lists only, where the flood is already negligible; it is NOT the comparison. The raw log of window 5 (about 465,000 lines) was not kept, so only the numbers in that JSON exist.

**AFTER: the same tour, UNCHANGED.** `b22/scripts/window5_tour.py` is a frozen evidence artefact (`b22/scripts/README.md`: "The AFTER measurement must run `window5_tour.py` UNCHANGED on the patched build"). It must not be edited, wrapped or re-implemented. It is run on the patched APK built from the commit that contains this change.

**What differs between BEFORE and AFTER, stated up front.** (1) The patch itself (and `patch-package` in the build). (2) The commit: `git diff --name-only fb865dd7 HEAD` (2026-10-02) lists only documentation, the EX-06 server candidates and proofs under `supabase/`, proof workflows, `.gitattributes`, `AGENTS.md` and one test file (`src/data/__tests__/p5-matching-field-contract.test.ts`); **no file under `src/` that ships in the app changed**, so the app JavaScript is the same. (3) Whatever is not controlled: the backend data (7 DEV tasks at the time), the phone's state and the age of the app process (a young process, like window 5), the second tour cycle's timing. Everything that is compared is therefore "the patch plus drift", and the drift is small and listed. **This holds only for a patched build made from the commit that introduces the patch (`patch-package` and its files), BEFORE any UI/UX change is committed: the working tree already carries uncommitted UI/UX edits to animation code (Press, Appear, TaskCard); a build from a later commit would compare "the patch plus those UI changes" and must be measured against an unpatched build of the SAME commit (the workflow input `reanimated_patch=skip`).**

**Optional same-commit A/B** (only if the owner wants an exact comparison, or if the primary comparison is inconclusive): one commit built twice, `gh workflow run build-android-dev-apk.yml --ref <branch> -f target=phone -f reanimated_patch=skip` (artifact `USKOCI-DEV-APK-unpatched`) and `... -f reanimated_patch=apply` (artifact `USKOCI-DEV-APK`). Both attestations must show the same `sourceTree`. A dispatch from a working branch never publishes (publishing needs `clean-alpha-backend`) and a `skip` build never publishes at all. A dispatch can be refused by the auto-mode classifier ("Production Deploy"); the owner may have to allow it or dispatch it himself. It costs one more CI build (about 30 minutes) and one more owner window for the BEFORE arm.

### 9.2 The windows (the owner's "sad" = 6 minutes of exclusive phone use; agents never touch the phone without his word)

**Before the grant, no phone input at all:** download the artifact and run `sha256sum -c USKOCI-DEV.apk.sha256`; read the attestation receipt (`verdict: pass`, `patchState: patched`, `dexMarkerLines >= 1`, `dexFiles >= 1`); `adb devices -l` shows exactly one physical device (serial `A8QDVB6522001205`, which `b22/scripts/ui.py` hardcodes); read-only `dumpsys` shows the owner idle (`lastUserActivityTime`) and the screen awake.

**Window 1 = the AFTER tour (one "sad"):**

| Step | Command (from `b22/scripts`) | Time |
| --- | --- | --- |
| Install, launch, wait for Home | `python -c "import ex04_boundary as b, json; print(json.dumps(b.do_install(r'<path>/USKOCI-DEV.apk', '<sha256>'), indent=1))"` (checks the SHA-256, `adb install -r`, launches, waits for Home; replaces the app without clearing data or signing out) | about 13 s (window 4 did install plus launch inside 249 s together with a 236 s routine) |
| The tour | `python window5_tour.py run --tag after_patched` (default `--budget 200`, which gave 2 cycles in 241.9 s in window 5; writes `window5_after_patched_logcat.txt` and `window5_after_patched_result.json` next to the script) | about 242 s |
| Result collection inside the script | gfx dump, PSS, ANR/fatal grep | about 5 s |

That is about 260 s, 4 minutes 20 seconds, so about 100 s remain inside the 6 minutes. Nothing else touches the phone in this window. The analysis below is offline.

**Window 2 = the animation-regression probes (a second "sad", or a later one)**: section 9.5. They need the phone for about 4 minutes and are NOT folded into window 1, because window 1 is already at 4 minutes 20 seconds. A single combined window is possible only if the owner explicitly grants a longer one.

### 9.3 Acceptance (thresholds from `b22/README.md`, fixed before measuring)

Same quantities on both sides. BEFORE values are from `window5_before_tour_20261002.json`; AFTER values come from `window5_after_patched_result.json` (`tour` and `final` fields) and from `count_log.cjs` on the raw log.

| # | Quantity (field) | BEFORE (window 5) | AFTER passes when |
| --- | --- | --- | --- |
| 1 | Arm validity | build `81b8a833`, no patch | installed SHA-256 equals the artifact's; receipt `verdict: pass`, marker present in the dex; the tour `notes` list equals the BEFORE list entry for entry (20 entries for two cycles; no entry ends in `False`, none of the "opened and Back" entries is missing) |
| 2 | Log volume, Reanimated: `count_log.cjs` `reanimatedWarnLines` | not recorded separately; the 2,699 failures wrote about 170 lines each, which is most of the 465,742 | at most 500 ("a few hundred at most": the numeric reading of the registry wording, fixed here before the measurement) |
| 3 | Log volume, whole app process: `tour.logLinesOfAppPid` (and per second: divided by `routineSeconds`) | 465,742 (1,925 per second) | reported next to 465,742 with the breakdown of what remains; the recorded target is "from about 465,000 to a few hundred", but window 5 did not record the non-Reanimated part of the total, so the total is judged together with row 2 and the breakdown, not alone |
| 4 | Frames over 700 ms: `count_log.cjs` `framesOver700ms` | not kept in window 5; the registry sets the AFTER target | 0 |
| 5 | Janky share: `final.gfx["janky%"]` | 1.93 % | at most 1.93 % |
| 6 | p99 frame time: `final.gfx.p99` | 22 ms | at most 22 ms |
| 7 | ANR and fatal: `final.fatalOrAnrLogLines`, `count_log.cjs` `anrLines`, `exitInfoLatest` | none, none | none, no new exit-info entry |
| 8 | Every screen still renders and animates | the 20 BEFORE notes (all steps ran) | the same 20 notes in window 1, and probes P1-P5 pass in window 2 |

Reported, not pass criteria: `failedLines`, `failedPerFrame`, `distinctDeadTags`. On a patched build dead tags are skipped before any failure exists, so these fall to about 0 by construction; they say the patch is active, not that the app is better. What discriminates are rows 2-8. Also reported: the other `gfx` fields (p50, p90, p95, missed vsync, slow UI), `skippedSum(lowerBound)` (what the old code would have thrown for, up to one 5 s window short), `distinctSkippedTags`, `viewlessSum` (how often the new `viewless` branch is taken: if it is large, the exception it still costs per pass deserves a look), `untrackedSum`, `evictedSum`, the pid, and the time stamps of the bursts if a per-10-second breakdown is wanted.

**B22 closes only if** rows 1-8 pass AND the owner says so (registry wording: "effect without animation regression"). A failing probe blocks the patch even if the counts improve. A result that is met "by construction" (row 2 and the reported failed lines) never closes anything alone.

### 9.4 Counting commands: what they are and what they were tested on

```
cd docs/implementation/product-v1-closure-20260926/finalization-20260927/b22
python -c "import json; d = json.load(open('scripts/window5_after_patched_result.json', encoding='utf8')); print(json.dumps(d['tour'], indent=1)); print(json.dumps(d['final']['gfx'])); print(d['final']['fatalOrAnrLogLines'])"
PID=$(python -c "import json; print(json.load(open('scripts/window5_after_patched_result.json', encoding='utf8'))['tour']['pid'])")
node count_log.cjs scripts/window5_after_patched_logcat.txt "$PID"
```

`count_log.cjs` is plain Node (no grep, awk, `bc` or python, and indifferent to CRLF checkouts); it was first written as a shell script, which gave the same output on the synthetic log, and replaced because a `.sh` file breaks on a CRLF checkout and `.gitattributes` has no rule for it. Output fields: `appLogLines`, `reanimatedWarnLines` (lines tagged `W Reanimated`, stack lines included), `failedLines`, `distinctFailedTags`, `patchLines`, `skippedTagLines`, `distinctSkippedTags`, `summaryLines`, the sums of the summary counters (`skippedSum` is a lower bound by up to one window), `daveyFrames`, `framesOver700ms`, `chattyCollapsedLines` (if above 0, the line counts are lower bounds: logd collapsed or expired lines), `anrLines`. Everything is counted on the lines whose third field is the app pid, except the chatty and ANR counts, which the system writes. For a like-for-like headline the tour JSON's own `logLinesOfAppPid` (same script, same definition as BEFORE) is the number to compare; `appLogLines` is the stricter cross-check.

**Tested, honestly:** the raw log of window 5 was not kept, so nothing could be run on it. The JSON one-liner was run on `window5_before_tour_20261002.json` (`tour.pid` 25093, 465,742, 2,699, 3,932, 39 tags, `final.gfx` p99 22, `fatalOrAnrLogLines` empty; the file name differs, the expressions are the ones in the block). `count_log.cjs` was run on `b22/synthetic_logcat_sample.txt` (an 18-line threadtime log with 15 lines of pid 25093, 3 failures on 2 tags, 5 patch lines, 2 summaries, 3 Davey lines of which 2 at or above 700 ms, one chatty line, one ANR line; one line of another process that mentions the same words, which must not count) and on a one-line log with no match; the expected values were worked out by hand first: `appLogLines 15`, `reanimatedWarnLines 11`, `failedLines 3`, `distinctFailedTags 2`, `patchLines 5`, `skippedTagLines 3`, `distinctSkippedTags 2`, `summaryLines 2`, `skippedSum 12`, `viewlessSum 1`, `backedOffSum 2`, `failedSum 3`, `untrackedSum 4`, `evictedSum 2`, `daveyFrames 3`, `framesOver700ms 2`, `chattyCollapsedLines 1`, `anrLines 1`, and all matched; on the empty-match log every field is 0 and the script exits 0.

### 9.5 Animation-regression probes (window 2; never run, no probe is validated)

They use only `b22/scripts/ui.py` (`inv`, `tap TEXT`, `tapxy`, `swipe`, `back`, `gfxreset`, `gfx`, `fg`, `shot`; it has the foreground guard before every input), no new script. Confirm first that the three animation scales are 1.0 and reduced motion is off (the app's `useReducedMotion` would cancel Press and Appear). A screenshot burst cannot catch a 240-480 ms animation, so each probe judges frame counts (`gfxreset`, then `gfx` after the motion) and END STATES (`inv` after the motion). Each probe is budgeted at 40 s, five probes about 200 s plus the foreground and animation-scale checks. The pass criteria are absolute (an end state and a minimum frame count), so no run on the old build is needed to judge them; a probe that cannot see its signal is a broken probe, not a regression, and only then is a reference run on the old APK `81b8a833` worth another grant.

| Probe (Reanimated path) | Trigger | Observe | Passes when |
| --- | --- | --- | --- |
| P1 sheet spring, ListBackground, zoomRide, map opacity | `gfxreset`; tap `list-count` on Zadaci | `gfx` frames after 1.3 s; `discovery-sheet-background` top; `Umanji mapu` | the sheet top moves from about 2125 to at most 0.35 of the screen height within 1.5 s; the zoom control is absent at full; at least 15 frames |
| P2 Mapa pill exit (FadeOut layout animation) | at full, tap the `Mapa` control | `inv` at +0.5 s and +1.2 s | sheet low, the pill node gone by +1.2 s (a stuck pill means the exit was lost), zoom back |
| P3 press scale (Press 0.97, TaskCard 0.986) | long press (`input swipe X Y X Y 2500`) on a card | `inv` at +0.8 s, then after release | the card is narrower than at rest by 6 px or more while held and within 2 px after release; then Back |
| P4 pin peek and cover ride (springSheet) | tap a pin three times | `inv` | the peek is present within 3 s on 3 of 3; it does not move by more than 4 px; Back returns |
| P5 remount under churn | open a card and Back three times from the list | `inv` after each Back | each press lands on freshly remounted rows and the list is back each time |

Not exercisable read-only: `Appear` FadeInDown, the voice-composer glow and the signed-out entry scene; they stay with Jest and the CI journey. P3 and P5 are the sentinels for a view that mounts late and loses its first style.

### 9.6 Reading a result

PASS means rows 1-8 hold; it is evidence for B22 at the PHYSICAL DEVICE level, with one phone, one account, 7 DEV tasks and a young process, and it still needs the owner's word. A row 2-3 failure with rows 4-8 passing means the patch is active but the log volume is dominated by something else (read `reanimatedWarnLines` and the breakdown). A janky, p99 or ANR regression, or a failing probe, blocks the patch; it is not averaged away. If `viewlessSum` is large, the `viewless` branch is the first suspect for any new cost (it still builds one `IllegalViewOperationException` per pass per such tag).

## 10. What is NOT proven (state with any result)

- **Not compiled by Gradle.** The Kotlin was compiled and behaviour-tested only against stubs with the Gradle-bundled Kotlin 2.2.21 compiler at language level 2.1 (React Native 0.86's Gradle build uses Kotlin 2.1.20). The first CI build of the dev APK workflow is the real gate; this change has not been built.
- **Not measured on a phone, no animation-regression run**, no AFTER of any kind.
- **The dex-marker attestation is unproven:** it assumes the string `USKOCI_RNR01` survives into `classes*.dex` of the release build (string constants normally do, also under R8; the repo sets no minify or `assumenosideeffects` rule). If it does not, the job now fails AFTER the upload, so the APK and the receipt are there to inspect (`unzip -l`, `strings`) before anything is loosened.
- **EAS cloud builds** were not exercised: they archive from git, so the patch file must be committed, and `postinstall` must not be disabled in the EAS environment (the guard checks `eas.json` and `.npmrc`, not EAS project settings). `expo prebuild` does not undo the patch (section 3, verified by reading `@expo/cli`).
- The CI emulator ANR (111,623 failed updates, stalls up to 10.1 s, one ANR) is a separate level: the same pair should later go through `p6-native-journey` as its own labelled run. That journey does not build an APK: it downloads the one built by `p6-native-apk.yml` (run id in `supabase/proofs/discovery/p6_native_apk_run.txt`) and refuses drift in `package.json` / `package-lock.json` since that APK's source commit, so after this change it needs a fresh `p6-native-apk` build and a re-pinned run id. `p6-native-apk.yml` has no `skip` input; an unpatched emulator arm would need one (not added, out of scope). The phone has never ANR'd, so the patch's ANR benefit is expected on the emulator, not on the phone.
- Small sample on measurement: one phone, one account, 7 DEV tasks, about 4,000 frames per arm, one run per arm (a second run per arm estimates noise), young processes only (the flood grows with process age).
- `scripts/p6_dev_emulator_check.py` and `scripts/p6_collect_journey_evidence.py` (not touched) count only the `failed` text (`reanimatedDeadTagLines`), so on a patched build they read near 0 by construction; use `count_log.cjs` and the tour result instead.
- The whole Jest suite and `p6-native-journey` were not run; only the suites named in section 7 were.
- Beyond 1,024 simultaneously failing mounted tags the overflow tags are retried on every pass (quietly): a stated limit of the guard.

## 11. Hand-off to the root integrator

- **Commit by explicit path only.** The working tree holds unrelated edits of other agents (legal drafts, `EXPORT_PROJECTION.md`, `p5-matching-field-contract.test.ts`, D12 candidates and proofs, UI files). The B22 paths are: `package.json`, `package-lock.json`, `patches/react-native-reanimated+4.5.1.patch`, `scripts/verify-native-patches.cjs`, `__tests__/reanimatedPatchContract.test.ts`, `.github/workflows/build-android-dev-apk.yml`, `scripts/ci/scope.cjs`, `scripts/ci/scope.test.cjs`, this document, (`.gitattributes` is already committed in `f8e36e52`), `docs/implementation/product-v1-closure-20260926/finalization-20260927/b22/kotlin-harness/`, `.../b22/count_log.cjs` and `.../b22/synthetic_logcat_sample.txt`.
- Record the decision and the receipt in `docs/control/redovi.json` (row B22) and run `node scripts/control/osvezi.mjs`; this change does not touch `docs/control/**` or `AGENTS.md`.
- Merging the workflow change builds a patched APK; `dev-latest` is not refreshed until the owner decides and the variable `RNR01_PUBLISH_PATCHED` is set to `yes` (section 6).
- After the commit, on a Windows checkout: `git ls-files --eol patches/` must report `w/lf`.
