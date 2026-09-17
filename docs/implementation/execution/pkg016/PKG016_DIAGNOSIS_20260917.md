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
