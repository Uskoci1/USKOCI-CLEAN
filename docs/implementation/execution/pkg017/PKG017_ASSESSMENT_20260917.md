# PKG-017 — auth, intents, deep links and restart on device: assessment

GAP-0008 and GAP-0022. Recorded 2026-09-17. Read-only: nothing was built, installed or run on a
device to produce this.

Owner instruction: start from the exact proven PKG-016 artifact and do not build a new unrelated APK.

## 1. The artifact this package starts from

| Field | Value |
| --- | --- |
| APK sha256 | `efd5eb476226fced90c73c68bbd47f959a27200c8418f0ef68bc5870a75bf298` |
| size | 68 636 551 bytes |
| source commit | `8c70826c506a4c29c71383550ab2efa82ee44e88` |
| source tree | `e4f7e8a16526c643460a9d92b39443ab2f7b47e6` |
| built by | run 35193545898 |
| package id | `rs.uskoci.preview` |
| backend | live canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth` |

Two facts already proven about it, by reading the artifact rather than trusting the build:

- the recovery redirect `uskociapp://oporavak` is compiled into the Hermes bundle, not left for a
  runtime variable the device does not have;
- the canonical launcher mark is packaged at every density and the Expo template icon is not.

A third, read now from the shipped `AndroidManifest.xml`: it contains `uskociapp`,
`android.intent.action.VIEW` and `BROWSABLE`, so **the deep link scheme is registered in the
artifact**. The string `oporavak` is absent from the manifest, which is correct: the scheme is
declared at the OS level and the host and path are resolved by the app's own router.

## 2. What already exists, and it is more than the reconciliation implies

`.github/workflows/w01-auth-recovery-proof.yml` already runs a **native emulator proof** of exactly
the behaviour GAP-0022 describes: "Native UI, actual email link, cold and warm OS callbacks", on
`reactivecircus/android-emulator-runner` at API 34, driving the real recovery screen through
`uskociapp://` links, with a real Auth instance and a real mailbox.

That proof passed as `domain-auth / android-auth-recovery` in the PKG-013 release run and again in
the PKG-014 release run.

## 3. The constraint that decides how PKG-017 can proceed

The W01 native proof does **not** use a live-backend build, and that is deliberate and enforced:

- `w01_recovery_android_build.sh` refuses to run unless `EXPO_PUBLIC_SUPABASE_URL` is exactly
  `http://127.0.0.1:54321`, and it rewrites the package id to `rs.uskoci.w01proof`;
- `w01_recovery_android.py` asserts `API == 'http://127.0.0.1:54321'` with the message
  *only disposable loopback Auth is permitted*, and refuses any foreign proof target.

So a device proof that performs **real authentication** is, by existing design, run against a
disposable loopback instance on a separately identified build. Feeding it the PKG-016 artifact is
not merely inadvisable, it would be refused by its own guard, and correctly so: that artifact points
at live canonical DEV, where driving sign-in and password recovery from an emulator would create
real sessions and real recovery tokens on the canonical project.

Incidentally, this is where the PKG-016 defect came from. The W01 build script sets
`EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL` explicitly, so the proof build always had the value the
release build lacked. The variable was known, and only the shipping workflow was missing it.

## 4. The honest split

PKG-017 covers two different kinds of claim, and only one of them can use the live-backend artifact.

**Provable on the exact PKG-016 artifact, with no authentication and no live write:**

1. it installs on a clean device and launches cold;
2. the `uskociapp` scheme is registered and the OS hands `uskociapp://oporavak` to it;
3. that link routes to the recovery screen, because `redirectSystemPath` publishes the intent and
   clears the initial URL before the router runs;
4. the app survives process death and a cold restart with the intent still honoured;
5. the launcher shows the canonical mark.

None of these need a session. A recovery link with no valid token lands on the screen and is refused
there, which is itself the correct observable behaviour.

**Not provable on that artifact without live side effects:** anything that completes a real sign-in
or a real password change. That is already covered by W01 against disposable Auth, and it should
stay there.

## 5. What this means for the package

The reconciliation says "no device proof after V19", which is true for the live-backend artifact and
not true for the behaviour itself. The remaining work is therefore narrower than it looked:

- install the **exact** PKG-016 APK on an emulator, by digest, without rebuilding it;
- assert install, cold launch, scheme registration, deep-link routing and restart;
- record the APK digest in the proof receipt so the evidence is bound to that artifact and not to a
  convenient rebuild;
- leave real-Auth device behaviour with W01, and reference it rather than duplicate it.

**One decision belongs to the owner.** Proving account revision fencing on a device, the GAP-0008
half, requires a signed-in session. Against live canonical DEV that means a real session on the
canonical project from an emulator. The alternatives are to accept that on the dedicated QA account,
or to keep that half on a disposable build as W01 does. I have not chosen, because it is the same
live-versus-disposable boundary the owner has ruled on carefully before.
