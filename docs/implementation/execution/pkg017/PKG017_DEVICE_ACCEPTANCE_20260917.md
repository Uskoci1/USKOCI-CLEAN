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

**A correction to the first version of this section.** It printed one count, 91 tests, next to a
table of test names, and four of those names are not in that run at all. They live in
`src/data/__tests__`, not in the six `src/store/__tests__` suites the count came from. Both the count
and the names were real; putting them side by side implied something that was not. Separated and
re-measured:

```
npx jest src/store/__tests__                     6 suites, 91 tests, all passing
npx jest <the four data fencing suites>          4 suites, 74 tests, all passing
```

**Session ownership and restart, `src/store/__tests__`, 91 tests.** Test names verbatim:

| Requested boundary | Test |
| --- | --- |
| account revision on identity change, not on token refresh | `session-epoch` "increments account revision for every identity transition, including batched A→B→A, but not token refresh" |
| a late old-session response cannot change a new session | `session-epoch` "ignores old restore success after newer SIGNED_OUT", "…after newer SIGNED_IN", and the two rejection cases |
| the same, for an intent completion | `session-epoch` "does not apply A intent after its completion resolves during B session" and "does not let A set intent or complete a target after B signs in during its snapshot" |
| logout, account boundary, re-login of the same account | `session-epoch` "logout resets role and invalidates A target; a new login restores only its saved local preference" |
| A → B → A with a matching rendered account id | `session-layout` "replaces private navigation state after batched A→B→A even when the rendered account id matches" |
| a token refresh must not look like a new account | `session-layout` "retains private navigation state across a same-account token refresh" |
| session restore decides the route at cold launch | `session-layout` "cold launch selects the admitted entry route instead of recovery", both signed in and signed out |
| private routes exist only behind a session | `session-layout` "exposes only Auth at cold signed-out startup and excludes every private root route" and its authenticated counterpart |
| MENI TREBA / JA MOGU intent across Auth | `auth-runtime` "WORKER intent -> Auth -> Worker workspace without losing Requester capability" and "preserves typed requester draft and same conversation through Auth" |
| the intent preference is per account and survives a new runtime | `account-intent-preference` "restores the actual account choice in a new runtime without a server role mutation", "keeps two account preferences isolated…", "rejects an old account incarnation restore even after A to B to A" |
| recovery deep link, cold **and** warm OS callback | `password-recovery-intent` "captures cold/warm native OS callbacks before router params exist: initial=true and false", asserting `redirectSystemPath` returns `/oporavak` |

**Account fencing in the data clients, `src/data/__tests__`, 74 tests in the four suites that carry
the fencing cases:** `account-closure` "fences an account switch and the A-B-A incarnation case",
`agreement-collection-screen` "bounded read rejects a late result; explicit retry recovers without
exposing raw errors", `agreement-outbox-hook` "hook-bound monotonic ownership rejects dispatch after
batched A→B→A while durable capture waits", `agreement-photo-client` "fences a late receipt after
same-account session incarnation changes".

`accountRevision` increments **only** when the user identity changes, so a token refresh cannot
cancel a restore, and a late continuation compares both the revision and the account id before
applying. That is the "late response cannot change a new session" contract, in source and under test.

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

### The session half of the harness, written against the real screens

The Auth screen carries no `testID`s, so the harness matches the text the screen actually renders,
read from `src/app/auth.tsx` and `src/app/(app)/profil.tsx` rather than guessed: the fields are
labelled **Email** and **Lozinka** with placeholders `ime@primer.rs` and `Unesite lozinku`, the
submit button is **Prijavite se**, and logout is **Odjavite se** on Profil. It drives the accessibility
tree from `uiautomator dump`, taps by node centre, and types the password through `input text` without
ever writing it to the receipt.

Checks added, in run order after restart:

| Check | How it is decided |
| --- | --- |
| legitimate QA login | the real Auth screen, typed; signed in means the submit button is gone, which the root-layout tests fix as mutually exclusive with the private routes |
| session restore across process death | force-stop, cold start, Auth must not reappear |
| MENI TREBA / JA MOGU persists across restart | read the intent before, force-stop, cold start, read it again |
| A → logout → re-login of the same QA account | tap Odjavite se, confirm Auth is reached, sign in again |

**One boundary is reported as not provable here, rather than faked.** A late reply from a dead
session cannot be induced through adb, which has no hook into the app's in-flight promises. The
harness says so in the receipt and points at the suites that do prove it. The device half of that
claim — that logout actually ends the server session — is read back from DEV instead.

### The DEV baseline is already taken, so the cleanup can be exact

`pkg017/PKG017_DEV_BASELINE_20260917.json`, read-only, nothing written. At `2026-09-17T08:46:00Z` the
QA account had **10 sessions and 10 refresh tokens**, no recovery token, last sign-in
`2026-09-16T20:53:04Z`. All ten session ids are listed, and all ten were created on 2026-09-16
between 20:26 and 20:53 UTC by the PKG-014 acceptance on this same account. They are not PKG-017's to
clean.

After the device run: re-read `auth.sessions` for that user, treat any id **not** in that list and
created after the snapshot as created by this acceptance, revoke exactly those, then read back. An id
of unknown origin is left alone. No recovery email is sent on this or any account — recovery routing
is proven by the deep link reaching the screen, which needs no token.

### What the owner does, and what I do

The owner's part is two actions on the phone: plug it in over USB, and allow USB debugging when the
phone asks. Nothing else — no installing, no typing, no testing.

Mine is one command:

```bash
DEV_ACCEPTANCE_PASSWORD=... python scripts/acceptance/device_acceptance.py <apk> artifacts/pkg017-device-receipt.json
```

It refuses before touching anything if the phone is not arm64, if more than one device is attached,
if the APK is not `efd5eb47…`, or if the credential is missing.
