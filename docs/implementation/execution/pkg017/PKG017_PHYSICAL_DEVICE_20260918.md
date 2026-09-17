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
