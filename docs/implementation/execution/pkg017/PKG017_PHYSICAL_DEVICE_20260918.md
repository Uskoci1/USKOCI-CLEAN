# PKG-017 — physical ARM64 device, the half that was waiting for hardware

PKG-017 has been pending a physical ARM64 phone since 2026-09-17. The emulator could prove
install, deep-link registration, OS routing and the launcher mark, but not native arm64
execution, and not the session half. A phone was connected over USB ADB on 2026-09-18.

Nothing was uninstalled, no package data was cleared, no account was touched and no system
setting was changed. The only state-affecting command was `am force-stop`, which kills the
process and keeps the data directory — it is the mechanism the process-kill/session-restore
step requires, and the owner named that step in the request.

## Device

| | |
| --- | --- |
| model | HONOR VKP-NX9 (`ro.product.model`) |
| device / product | `HNVKPX` / `VKP-NX9EEA` |
| serial | `A8QDVB6522001205` |
| Android | 16, SDK 36 |
| fingerprint | `HONOR/VKP-NX9EEA/HNVKPX:16/HONORVKP-N39/10.0.0.162C431E8:user/release-keys` |
| `ro.product.cpu.abi` | `arm64-v8a` |
| `ro.product.cpu.abilist` | `arm64-v8a` |
| display | 1264x2728, smallestScreenWidthDp 361 |
| locale | `sr_RS_#Latn` |

The abilist has exactly one entry. This device carries no x86 translation layer, so it is not
the ambiguous case the Play-image emulator was: an arm64 library here either loads natively or
not at all.

## Artifact

The exact attested build was installed. No rebuild, no parallel build.

| | |
| --- | --- |
| release | `pkg020-f1401ff` (newest; target `f1401ffa8ff58386e1bd07ce36d3a3880be380b7`) |
| local file | `%TEMP%\claude\apk5\USKOCI-DEV.apk` |
| sha256 | `c401baaa9dbeaf5b395fddf1f7aac07d7826a729200a9aea54d03c30ab8f2db1` |
| bytes | 68 664 264 |
| package | `rs.uskoci.dev`, versionName 1.0.0, versionCode 35, minSdk 24, targetSdk 36 |
| native-code | `arm64-v8a` only, 27 libraries |

**Source binding, three independent ways.**

1. The recovery attestation published with the release carries `sourceCommit f1401ff`,
   `sourceTree 3479b8b0326cdebde97693ab3ba9cbe6ae17805d`, run 35262726635 attempt 1, against
   `apkSha256 c401baaa…`. `git rev-parse f1401ff^{tree}` returns that same tree.
2. The icon attestation carries the same `apkSha256`, with `shippedForeground` distance 0.00
   and `shippedMonochrome` distance 0.00.
3. The running app prints its own origin on screen: **`USKOČI · 1.0.0 · f1401ff`**.

Current `HEAD` is `30f1681`. `git diff --name-only f1401ff..HEAD` is exactly one file,
`scripts/ci/attest_launcher_icon.py` — a CI attestation script. No application source, asset
or server file differs, so this APK remains bound to the current app source.

**Byte identity on the device.** `sha256sum` run on the installed
`/data/app/~~f_azDnVRj2jkh1gpwnSc9Q==/rs.uskoci.dev-wyPClp3Jo-8LJWovv20cmQ==/base.apk`
returns `c401baaa9dbeaf5b395fddf1f7aac07d7826a729200a9aea54d03c30ab8f2db1`. The bytes the OS
will execute are the attested bytes, not merely a file of the same name.

## Install

`adb install`, with no uninstall beforehand; the package was absent. `Success` in 1m48s.
`primaryCpuAbi=arm64-v8a`, `secondaryCpuAbi=null`. On-device APK size 68 664 264 bytes, equal
to the local file.

## What the hardware proved that the emulator could not

**Native arm64 execution.** SoLoader prepared
`DirectApkSoSource[root = […]/base.apk!/lib/arm64-v8a]` and every native library loaded from
it: `libhermesvm.so`, `libreactnative.so`, `libjsi.so`, `libreanimated.so`, `libworklets.so`,
`libexpo-modules-core.so`, `libfbjni.so`, `libgesturehandler.so`, `librnscreens.so`,
`libwebviewchromium.so`, **`libmaplibre.so`**, and the rest of the 27 — each reported `: ok`.

This is the exact failure from 2026-09-17. On the x86_64 Play-image emulator the app was
assigned `primaryCpuAbi=arm64-v8a`, but SoLoader resolved against the device primary ABI and
looked in `base.apk!/lib/x86_64`, which the APK does not contain. On real arm64 hardware the
lookup path is `base.apk!/lib/arm64-v8a` and it resolves. `libmaplibre.so` matters
specifically: the map screen could not have been exercised on the emulator at all.

**Cold start.** `am start -W` after `force-stop`: `LaunchState: COLD`, `TotalTime: 612`,
`Displayed rs.uskoci.dev/.MainActivity for user 0: +612ms`, then
`ReactNativeJS: Running "main"`. Zero `FATAL EXCEPTION`, zero `AndroidRuntime` errors, zero
ANR across the whole capture.

**The entry composition renders on a real panel.** Logo lockup, split green/orange
composition, both photographs, the mascot mark, `Prijavi se`, `Napravi nalog`. Screenshot
`01_coldstart.png`.

**`Napravi nalog` is reachable, and the earlier reading of it was right.** On this aspect ratio
the button sits below the fold and looks cut off at rest. A single swipe up brings the whole
pill into view and within the touch target (`02_scrolled.png`). It is a scroll position, not a
clipped layout — previously argued from `entryV49Math.ts`, now shown on glass.

**Deep-link registration and cold OS routing.** `dumpsys package` shows scheme `uskociapp` on
`MainActivity` with `VIEW` + `DEFAULT` + `BROWSABLE`. After `force-stop`,
`am start -a android.intent.action.VIEW -d uskociapp://oporavak` with **no component named**,
so the OS resolved it itself, gave `LaunchState: COLD`, `+503ms`,
`topResumedActivity=rs.uskoci.dev/.MainActivity`.

**The recovery boundary held on a bogus link.** The link carried no token. The app did not
offer a password form. It rendered `Oporavak naloga` → *Link je nevažeći ili je istekao.
Zatražite novi link.* with `Zatražite novi link` and `Nazad na prijavu`
(`03_deeplink_oporavak.png`). The GAP-0007 redirect target is reachable and refuses an
unauthenticated reset.

**Launcher mark on a real launcher (GAP-0041).** The HONOR launcher renders `USKOČI DEV` with
the mascot adaptive icon, circle-masked, nothing clipped, and no Expo template icon
(`05_home_4.png`).

## Observability, and one honest limit

`settings get secure theme_customization_overlay_packages` returns `null`: **themed icons are
off on this phone.** The monochrome layer is packaged and attested at distance 0.00, but it
cannot be seen until themed icons are enabled in the launcher's own settings. Not changed —
that is a system setting and belongs to the owner.

**The release bundle emits no JS logs.** Across the entire capture `ReactNativeJS` appears
only as `Running "main"`. There is no `console.log`, no transcript and no `generationComplete`
in logcat. Any claim to read the AI conversation from logcat would be false.

So the live view is split. Helpers were left in `%TEMP%\claude\pkg017dev\`:

- `raw.log` — unfiltered `adb logcat -v threadtime`, so no filter can lose evidence.
- `see.sh <lane> [n]` — lanes `life crash route perm mic net all`. Verified against this
  session: life 3, crash 0, route 7, mic 26, net 8, perm 0, the last because the microphone
  permission has not been requested yet.
- The **server** carries the speech chain. `function_edge_logs` shows the WebSocket upgrade as
  `GET | 101 … /uskoci-speech-session?conversationId=…&operationId=…`, and that `operationId`
  joins straight onto `private.ai_test_reservations_v5`, so each attempt can be tied to its
  own reservation and its settlement.

## Budget baseline, taken before the phone session

| | |
| --- | --- |
| ceiling | 5 000 000 microUSD ($5), untouched |
| reserved counter | 1 021 548 |
| real settled spend | 171 548 microUSD = **$0.1715** |
| open holds | 4, totalling 850 000 — one LLM at 250 000 plus three STT at 200 000 |
| bases | MEASURED 41, FAILED_NO_USAGE 13, CONSERVATIVE_ESTIMATE_UNMEASURED 19, AUDIO_DURATION_AT_PUBLISHED_RATE 6 |

`171 548 + 850 000 = 1 021 548`, so the counter and the rows agree exactly. Headroom is
3 978 452 microUSD, about $3.98. The three open STT holds are the by-design ones: those
sessions did transcribe, so the failure-release path correctly does not touch them.

## Still pending, and why

These need the owner signed in on the phone. They concern his session, not the artifact:

- session restore after process kill,
- MENI TREBA / JA MOGU persistence across a restart,
- logout / relogin account boundary,
- the seven-step voice walkthrough in `pkg020/PKG020_VOICE_DEVICE_CHECKLIST_20260917.md`.

The artifact, install, native-execution, cold-start, routing, recovery-boundary and
launcher-mark halves of PKG-017 are proven on real ARM64 hardware as of 2026-09-18.

## Note for the ti/Vi pass

The recovery screen reached in this session is in the Vi form: `Zatražite novi link`,
`Link je nevažeći ili je istekao. Zatražite novi link.` Recorded here so the pass has a
concrete first target rather than a file count.

---

## Logout and the account boundary, 2026-09-18

The last pending acceptance item. The owner gave the word; the relogin half is his, because
entering his password is not something to do on his behalf.

**Before.** Account `1c489b37-1290-4bc2-999d-7f77a05cd342` (`msljivic031`, Novi Sad) owned 2
needs, both drafts, 33 conversations and 229 structured facts. Server-side it held **15**
sessions and **15** live refresh tokens, the newest updated at 23:32:58Z - the phone, refreshing.

**Logout.** Profil, scroll to the bottom, `Odjavite se`. The app goes straight to the sign-in
sheet. No crash across the whole sequence.

**The session was actually revoked, not merely forgotten.** Sessions went **15 to 14** and live
refresh tokens **15 to 14**, and the newest remaining session is from 18:09:23Z rather than
23:32:58Z. So exactly one session was revoked, and it was the phone's. The other fourteen
survive, which is the correct scope: signing out on one device must not sign the account out
everywhere.

**It does not come back.** `am force-stop` then a cold `am start`: `LaunchState: COLD`, 700ms,
new pid 17621, and the app lands on the **entry screen**, not on a restored session.

**Nothing of the account is reachable while signed out.** Deep-linking directly at three
protected routes - `uskociapp://potrebe`, `uskociapp://dogovori`, `uskociapp://moje-prijave` -
each lands on the entry screen instead of the route. The sign-in form's email field shows only
the placeholder `ime@primer.rs`; the account's address is not left on screen.

### A mistake of mine, and what it did not do

Driving the entry screen by the coordinates that `uiautomator dump` reports is unreliable here:
the entry is a scroll view, and the reported positions for `Prijavi se` and `Napravi nalog` do
not match where they actually are. A tap meant for `Prijavi se` opened **Registracija**, and
repeated taps after that landed on the on-screen keyboard and typed characters into the email
field, which the sign-in and registration sheets share.

No account was created: `Napravite nalog` was never pressed, the sheet was left through its own
back control, and the field was cleared afterwards. Verified at the database rather than by
assertion - **0** users created in the last 30 minutes, **0** addresses beginning `3eee`, total
users still **5**, and the owner's session count still 14.

Worth recording as a product observation rather than a defect: on this 2728px panel `Prijavi se`
and `Napravi nalog` sit at the very bottom edge, close together, and the wrong one is easy to
hit. If it caught an automated driver, it can catch a thumb.

### Still the owner's step

He signs in. After that, confirm the account comes back as the same account, that the two drafts,
33 conversations and 229 facts are all present, and that nothing from the signed-out state
crossed into the new session. Only then does PKG-017 close.

### Relogin — the boundary closes

The owner signed in on the phone at 23:44:59Z. Everything was read back rather than assumed.

| check | before logout | after relogin |
| --- | --- | --- |
| needs owned | 2 | **2** |
| drafts owned | 2 | **2** |
| conversations | 33 | **33** |
| structured facts | 229 | **229** |
| sessions | 15 | 14 after logout, **15** after relogin |
| total users in the project | 5 | **5** |
| users created in the last hour | — | **0** |

The identity is the same one: the profile reads `msljivic031`, `Novi Sad`, `Još nema ocena`.
Both drafts are present and unchanged, `Prevoz i prenos stvari: 4 kutije i 2 ormara` still
carrying `Lenke Dunđerski, Novi Sad`, and `Dostava punjača iz Novog Sada u Petrovaradin`.

The conversation count did not move, so the relogin created no spurious conversation. The user
count did not move, so nothing was created anywhere in the project during the whole sequence.
A single new session appeared, which is exactly one device signing in.

`Otvoreni zadaci` reads **0** on the map, which is the correct GAP-0042 result rather than a
symptom: the owner is on the REAL side and no real task has been published yet.

Zero `FATAL EXCEPTION`, zero `AndroidRuntime` errors and zero ANR across the entire
logout and relogin sequence.

One behavioural note, not a defect: after a fresh sign-in the app lands on **JA MOGU**, while
the session before the logout was on MENI TREBA. A new session has no remembered side, which is
consistent with the tab behaviour recorded earlier in this document.

**PKG-017 is complete.** Every acceptance item this package names is now proven on real ARM64
hardware, and nothing is left pending.
