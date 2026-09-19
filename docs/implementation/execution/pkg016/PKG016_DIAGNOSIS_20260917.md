# PKG-016 — source-bound Android artifact: read-only diagnosis

GAP-0007 and GAP-0041. Recorded 2026-09-17. Nothing was built, changed or deployed to produce this.

## GAP-0007: the last build failed for one missing build variable

The 2026-09-13 attempt at `944fee9` is recorded as `LOCAL_SIGNED_APK_FINAL_ATTESTATION_FAILED`. The
receipt is precise about where it stopped.

| Field | Value |
| --- | --- |
| Gradle exit code | 0, the APK built and signed |
| collector exit code | 1 |
| failure | `RECOVERY_REDIRECT_NOT_COMPILED` |
| location | `verify_final_build_config.py:72 assert_recovery_function` |
| boundaries already passed | exact clean Git SHA and tree, strict packager Git-source and byte-reproduced Hermes composition, existing certificate SHA-256, aapt package, version, minSdk and targetSdk |

So four of five attestation boundaries held. Only the fifth failed, and its cause is a single line.

### The cause, proven by reading three files

`src/data/passwordRecoveryLink.ts` returns `null` from `configuredRecoveryRedirect()` unless the
build variable `EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL` is present and, on native, exactly equals
`uskociapp://oporavak`.

The attestation verifier then dumps the Hermes bytecode, requires exactly one
`configuredRecoveryRedirect` block, and requires three things of it: the literal redirect must be
compiled in, the variable name must **not** survive into the body, and the body must not be the
degenerate `LoadConstNull; Ret`.

`.github/workflows/build-android-dev-apk.yml` sets exactly three public build variables:
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_USE_FAKE_SOURCE`. It
does **not** set `EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL`, and no workflow in the repository sets it.

With the variable absent, the bundler inlines `undefined`, the function compiles to exactly the
degenerate body the verifier rejects, and the collector reports `RECOVERY_REDIRECT_NOT_COMPILED`.
That is not a flaky build. It is the attestation correctly refusing an APK in which password
recovery could never work.

### What that implies for the fix

The change is one build variable, set to the exact native value the source already pins. It is small,
but it is not cosmetic: it changes what is compiled into a signed artifact, so it needs a real build
and the full attestation to pass, not just a green workflow.

Two further facts worth carrying into that work. The APK workflow has not run since 2026-09-01 at
`b2d360f`, so no artifact is bound to anything close to current source; the last three runs before
that succeeded, so the workflow itself is not broken. And the failed attempt was a local run, which
is why its receipt lists the variable under `publicBuildConfigNames` as expected while the compiled
body lacked it.

## GAP-0041: the launcher art does not exist, and I will not invent it

`app.json` still points every icon at the Expo template assets:

| Setting | Value |
| --- | --- |
| `icon` | `./assets/images/icon.png` |
| `android.adaptiveIcon.foregroundImage` | `./assets/images/android-icon-foreground.png` |
| `android.adaptiveIcon.backgroundImage` | `./assets/images/android-icon-background.png` |
| `android.adaptiveIcon.monochromeImage` | `./assets/images/android-icon-monochrome.png` |
| `web.favicon` | `./assets/images/favicon.png` |

No USKOČI launcher asset exists in the repository, so GAP-0041 is confirmed on head exactly as the
reconciliation says.

**This is a real blocker and it is the owner's to clear.** Generating a launcher icon would be
inventing brand art, and the repository rules are explicit that the entry composition, the original
photographs and SVG notes and the mascot are preserved rather than replaced. An agent-drawn icon
would also ship on a signed artifact under the owner's package name.

## Status and the honest split

The two gaps are not equally blocked.

- **GAP-0007 is unblocked and diagnosed.** The cause is known, the fix is one build variable, and
  the remaining cost is a real signed build plus the full attestation.
- **GAP-0041 is blocked on owner-approved launcher art.** Nothing in the repository can substitute
  for it.

PKG-016 therefore cannot reach DONE_VERIFIED until the art exists, because a source-bound Android
artifact that still ships the Expo template icon has not closed GAP-0041. The build work can proceed
in the meantime, but shipping an artifact with template art is the thing PKG-016 exists to end.

---

## Addendum, 2026-09-17: GAP-0007 is closed on a source-bound artifact

### The fix

`.github/workflows/build-android-dev-apk.yml` now sets
`EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL: uskociapp://oporavak`. That is the only source change; no
auth flow was added or altered.

Verified before changing anything, as the owner required:

| Check | Result |
| --- | --- |
| which route handles recovery | `src/app/oporavak.tsx`, reached through `src/app/+native-intent.tsx` |
| does the URL reach a real route | yes: `app.json` declares the `uskociapp` scheme and `/oporavak` exists, so `uskociapp://oporavak` resolves |
| is a new auth flow introduced | no; `redirectSystemPath` publishes the link to the existing recovery intent store, clears the initial URL so the token does not linger, and routes to the existing screen |
| does recovery survive a cold start | yes; cold start is the framework's `initial` case and `src/store/__tests__/password-recovery-intent.test.ts` already asserts `redirectSystemPath` with `initial: true` |

### The attestation, and why it reads the artifact

A green Gradle exit never proved the redirect was in the APK, which is how this shipped before. So
`scripts/ci/attest_recovery_redirect.py` extracts the Hermes bundle from the built APK, dumps its
bytecode, isolates `configuredRecoveryRedirect` and requires exactly one such function whose body
loads the redirect as a compiled constant, carries no surviving environment variable name, and is not
the load-null body an absent value produces. The exact whole literal is confirmed in the string
table. It runs before the upload and before the release.

### Two defects found in the attestation itself, the second one important

The first run failed on the script, not the artifact. The Hermes compiler in this repository lives
under `hermes-compiler`, not `react-native/sdks`, and all three platform directories ship together,
so a first-match search picks the wrong binary; the lookup is now by platform.

The second is worth recording. **Hermes truncates string operands in its dump at seventeen
characters**, so the twenty-character redirect never appears in full inside a function body, and a
plain substring test of the body fails on a correct build. That is exactly the test the archived
`verify_final_build_config.py` performed, which means the `RECOVERY_REDIRECT_NOT_COMPILED` recorded
on 2026-09-13 may have been that verifier's blind spot rather than a genuinely missing value. The
build variable was still absent from CI and still had to be added, so the fix stands either way, but
the earlier receipt should not be read as proof that the value was missing.

The new attestation was verified locally against two Hermes bundles compiled for the purpose, one
returning the literal and one returning null. The first is accepted; the second is rejected with the
specific `RECOVERY_COMPILED_DISABLED`, which runs first so the more useful diagnosis wins.

### Result

Run 35191028191 on candidate `4e0f8c4`, green.

| Field | Value |
| --- | --- |
| attestation | `PASS ... compiled_in_bundle no_runtime_env not_disabled exactly_one_function` |
| APK sha256 | `1570a416e3e13487e08bb9182e0f964d5d195f8a375fdc4f11249755fa1248aa`, 68 911 641 bytes |
| bundle sha256 | `1cdd7fd7479f4277a79f97aafd1511adab94a820889dc890a2fe9446cca66769` |
| recovery function sha256 | `b77e76267d3bf8eefb2c606a16185a4f928249221520dc33a396d893efd3d18c` |
| bound to | commit `4e0f8c43feb51d977df5d35870d02b1f2343ecd6`, tree `ff9a30676a66d72e6c5f4320d0c7fcf56d840757` |

**GAP-0007 is closed**: an exact source-bound Android artifact exists in which the recovery redirect
is provably compiled.

One protective change came with it. The step that refreshes the `dev-latest` pre-release is now bound
to the canonical branch, so a proof run from a working branch cannot delete and recreate a published
release. The APK and its attestation are still uploaded as workflow artifacts on every run.

**GAP-0041 remains open**, so PKG-016 is not DONE_VERIFIED. The launcher icon review is at
`PKG016_ICON_AUTHORITY_REVIEW_20260917.md` and waits on the owner choosing one option.
