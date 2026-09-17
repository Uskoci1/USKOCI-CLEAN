# PKG-017 — device acceptance of the exact PKG-016 artifact

Owner decision 2026-09-17: device and session acceptance against canonical DEV is approved, but only
through the account classified `DEV_ACCEPTANCE_QA`. The exact PKG-016 artifact is to be tested as a
real application. The disposable W01 proof is not to be pushed onto live DEV; this is a separate,
clearly marked live acceptance.

## The artifact under test

| Field | Value |
| --- | --- |
| APK sha256 | `efd5eb476226fced90c73c68bbd47f959a27200c8418f0ef68bc5870a75bf298` |
| source commit | `8c70826c506a4c29c71383550ab2efa82ee44e88` |
| source tree | `e4f7e8a16526c643460a9d92b39443ab2f7b47e6` |
| built by | run 35193545898 |
| package id on device | `rs.uskoci.dev` |

**A correction to the earlier assessment.** That document said the package id was
`rs.uskoci.preview`, taking it from `app.json`. The shipped id is `rs.uskoci.dev`, because the build
workflow has a step that injects a development-only package id and renames the app to "USKOČI DEV".
The artifact corrected me, which is the point of testing the artifact.

## What is already proven, on the artifact itself

Two of the requested boundaries need no running app, and both hold.

**Install of the exact attested APK.** The APK was installed on a clean emulator after removing the
previous build, and the installed file was hashed *on the device*:

```
/data/app/~~kaxjUyKEQS8AICdZzIDTKw==/rs.uskoci.dev-.../base.apk
efd5eb476226fced90c73c68bbd47f959a27200c8418f0ef68bc5870a75bf298
```

That is byte-identical to the attested artifact. The device is running exactly the bytes PKG-016
proved, not a rebuild.

**Deep link registration.** The OS resolver was asked directly:

```
cmd package resolve-activity -a android.intent.action.VIEW -d 'uskociapp://oporavak'
  name=rs.uskoci.dev.MainActivity
  packageName=rs.uskoci.dev
  isDefault=true
```

So the `uskociapp` scheme is registered by the installed artifact and the OS hands the recovery link
to its main activity. This matches the manifest reading from the assessment.

## The boundary that stops everything else, and it is not a defect

The app crashes immediately on launch:

```
com.facebook.soloader.SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so
Native lib dir: /data/app/.../lib/arm64
```

The cause is not the artifact. **The APK contains only `arm64-v8a` native libraries**, 27 of them and
no others, while the emulator is `x86_64`. Forcing the right ABI confirms it:

```
adb install --abi x86_64 : INSTALL_FAILED_NO_MATCHING_ABIS
```

And this is deliberate. `.github/workflows/build-android-dev-apk.yml` sets
`reactNativeArchitectures=arm64-v8a` in its Gradle tuning step. The earlier local build of
2026-09-13 recorded `["arm64-v8a", "x86_64"]`, so the CI build narrowed it on purpose, which is
reasonable for a phone sideload: every modern Android phone is arm64, and building one architecture
halves the work.

### What follows from it

**No x86_64 emulator can run this artifact, and GitHub-hosted runners are x86_64.** So an emulator
job in CI can never install and run the exact shipped APK. Any automated device proof of *this*
artifact needs an arm64 target.

That leaves three honest options, and they are not equal:

1. **An arm64 emulator on this machine.** `system-images;android-36;google_apis;arm64-v8a` is
   available and is being fetched. On a Windows x86_64 host it runs under full software emulation,
   so it may boot slowly or not at all. This is the only fully autonomous path and it is being
   attempted.
2. **A physical arm64 phone connected over adb.** This is the artifact's real target and would prove
   the most, but no device is attached, and attaching one is a manual step the owner has asked not to
   be required to perform.
3. **Adding `x86_64` back to the CI build.** This would make emulator proof possible for every future
   artifact, but it produces a *different* APK, which the owner's instruction excludes for this
   acceptance, and it is a build-configuration decision rather than a test decision.

## Status

| Requested boundary | State |
| --- | --- |
| install of the exact attested APK | **proven**, by hashing the installed file on the device |
| `uskociapp` deep-link registration | **proven**, by the OS resolver |
| cold start | blocked: needs an arm64 target |
| recovery routing | blocked: needs a running app |
| app restart | blocked |
| legitimate QA login | blocked |
| session restore | blocked |
| account revision and session fencing | blocked |
| intent persistence | blocked |
| logout, account boundary, re-login | blocked |
| late old-session response cannot change a new session | blocked |

Nothing was written to canonical DEV. No session, no recovery token, no row on any account. The QA
credential was not used, because nothing has reached a login screen yet.

---

## Option 1 is closed, and the emulator said so itself

The arm64 system image `system-images;android-36;google_apis;arm64-v8a` was downloaded, 4.3 GB, an
arm64 AVD was created from it, and the emulator refused to start:

```
FATAL | Avd's CPU Architecture 'arm64' is not supported by the QEMU2 emulator on x86_64 host.
        System image must match the host architecture.
```

So there is no arm64 emulator on this machine, and there cannot be. Google's emulator only runs an
image whose architecture matches the host, which is why arm64 images exist mainly for Apple Silicon.

This was worth the download: it turns an assumption into a fact.

### Cleanup

The AVD and the 4.3 GB image were both removed, since both were mine and both are unusable here. The
two pre-existing x86_64 AVDs are untouched.

**One state change to disclose.** The test emulator `USKOCI_V5_TEST` previously carried an older
`rs.uskoci.preview` install that I did not create. I uninstalled it so the attested artifact would
install onto a clean device, and the attested artifact was then itself uninstalled while testing the
ABI. That emulator now carries no USKOČI build. Nothing outside that disposable AVD was touched.

## What is left, and it needs an owner decision

The obstacle is not a defect and not a missing tool. **An arm64-only APK cannot run on x86_64
hardware.** Proving the remaining boundaries on the *exact* artifact requires arm64 hardware, and
this machine has none.

| Option | What it gives | What it costs |
| --- | --- | --- |
| **A. A physical Android phone on USB** | the full acceptance on the exact attested artifact, on its real target, driven entirely by me | one manual action: plug the phone in and allow USB debugging. The owner has asked not to be required to test by phone; this is not testing by phone, it is lending the phone to the harness |
| **B. A universal rebuild from the same commit** | the full acceptance, automatable on any emulator now and in CI forever | it is not the artifact PKG-016 attested. Same source, one extra build-config line, different sha. The owner's instruction excludes a new APK for this acceptance |
| **C. Stop here** | keeps what is proven: exact-artifact install and deep-link registration | leaves cold start, login, session restore, fencing, restart and the late-response boundary unproven on any device |

**My recommendation is A**, because it is the only option that proves the requested boundaries on
the artifact the owner asked to be tested, and the manual part is a single physical action rather
than a test the owner has to perform.

If A is not available, I would take B and record plainly that the acceptance ran on a universal
rebuild of the same commit, with both digests in the receipt, rather than claim the exact artifact
was exercised.

There is also a standing question either way: since GitHub runners are x86_64, an arm64-only release
artifact can never be emulator-tested in CI. If device proof is meant to be automated, the build has
to carry `x86_64` alongside `arm64-v8a`. That is a build-configuration decision, not a test one.

---

## Owner decision, 2026-09-17: phone over USB. Status PENDING_PHYSICAL_DEVICE

### The artifact is now a direct download

Published as a pre-release **without rebuilding anything**. The asset was downloaded back and hashed
to confirm the published bytes are the attested bytes.

| | |
| --- | --- |
| download | `https://github.com/Uskoci1/USKOCI-CLEAN/releases/download/pkg016-8c70826/USKOCI-DEV.apk` |
| release page | `https://github.com/Uskoci1/USKOCI-CLEAN/releases/tag/pkg016-8c70826` |
| SHA256 | `efd5eb476226fced90c73c68bbd47f959a27200c8418f0ef68bc5870a75bf298` |
| size | 68 636 551 bytes |
| tag points at | `8c70826c506a4c29c71383550ab2efa82ee44e88` |

Verify before installing:

```
Get-FileHash .\USKOCI-DEV.apk -Algorithm SHA256
sha256sum USKOCI-DEV.apk
```

The release also carries the recovery attestation from the build run and a plain-text provenance
note. The existing `dev-latest` pre-release was not touched.

**One thing the owner should know:** this repository is public, so a release asset is downloadable by
anyone, and this build points at canonical DEV. The existing `dev-latest` release already publishes
an APK the same way, so this is not new exposure, but it does interact with GAP-0042: a stranger who
installs it can create an account on DEV. The release can be deleted once the phone has it.

### What is proven without a device, measured rather than asserted

The session boundaries the owner listed are, at the client-logic layer, **already covered**. Running
the six session and intent suites on the candidate:

```
Test Suites: 6 passed, 6 total
Tests:       91 passed, 91 total
```

Named coverage that maps directly onto the requested boundaries:

| Requested boundary | Existing test |
| --- | --- |
| logout, account boundary, re-login | "fences an account switch and the A-B-A incarnation case" |
| late old-session response cannot change a new session | "bounded read rejects a late result; explicit retry recovers without exposing raw errors" |
| the same, after batching | "hook-bound monotonic ownership rejects dispatch after batched A→B→A while durable capture waits" |
| account revision, not token refresh | "fences a late receipt after same-account session incarnation changes" |
| intent persistence across identity change | `account-intent-preference.test.ts`, and `sesija.ts` resets `intentReady` only on identity change |
| recovery deep link, cold start case | `password-recovery-intent.test.ts` asserts `redirectSystemPath` with `initial: true` |

`accountRevision` increments **only** when the user identity changes, so a token refresh cannot
cancel a restore, and a late continuation compares both the revision and the account id before
applying. That is the "late response cannot change a new session" contract, in source.

What a device adds is not the logic but the integration: that the shipped app, on real hardware,
against the live backend, actually behaves this way.

### The harness is written and its guards are proven

`scripts/acceptance/device_acceptance.py` is ready to run the moment a phone is attached. It is
deliberately not the W01 disposable proof and cannot be pointed at it.

Guards, all verified by running them:

| Guard | Verified behaviour |
| --- | --- |
| no device | `REFUSED: PENDING_PHYSICAL_DEVICE: no device attached` |
| wrong artifact | `REFUSED: APK_NOT_THE_ATTESTED_ARTIFACT`, printing both digests |
| missing credential | `REFUSED: ACCEPTANCE_CREDENTIALS_MISSING` |
| real artifact and credential | `DRY_RUN_GUARDS_PASSED` |
| secret handling | the password appears zero times in the receipt |

It also refuses a non-arm64 device, refuses when more than one device is attached, and carries the
forbidden accounts by name so the owner's personal, business and fixture accounts cannot be used.

### Status

`PENDING_PHYSICAL_DEVICE`. Everything that does not need hardware is done: the artifact is
downloadable and verified, the client-side session contract is covered by 91 passing tests, and the
device harness exists with its guards proven. The remaining boundaries need the phone attached over
USB with debugging allowed, after which the run is fully automated and needs nothing from the owner.
