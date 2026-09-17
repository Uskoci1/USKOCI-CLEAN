# PKG-017 — full inventory of every Android target on this machine

Owner instruction, 2026-09-17: check **every** emulator, AVD and adb device before leaving PKG-017
waiting on a physical phone, and do not assume the one already used is the only one.

Done. The inventory changed the answer, and it also **corrects something I stated earlier as fact**.

## What I got wrong before

The earlier entry in `PKG017_DEVICE_ACCEPTANCE_20260917.md` said, in effect, *an arm64-only APK
cannot run on x86_64 hardware, therefore no emulator here can ever run it*. The first half is
ordinary CPU reality; the conclusion was wrong, and I had not checked the thing that decides it.

**The installed x86_64 system image carries ARM translation.** From its own `build.prop`:

```
ro.system.product.cpu.abilist = x86_64,arm64-v8a
ro.dalvik.vm.native.bridge    = libndk_translation.so
ro.dalvik.vm.isa.arm64        = x86_64
ro.enable.native.bridge.exec  = 1
```

and `/system/lib64/libndk_translation.so` is present, 5 991 312 bytes, with a populated
`/system/lib64/arm64`. So these emulators **do** execute arm64 code. The artifact even installs and
is assigned `primaryCpuAbi=arm64-v8a`. My earlier reason was not the real reason.

## The inventory

`adb devices -l` at the start: **empty**. No physical device, nothing attached.

`emulator -list-avds`: **two**, and there are no others — no Genymotion, no BlueStacks, no Nox, no
Windows Subsystem for Android, and the only listener on 5037 is the adb server itself.

| AVD | API / Android | `ro.product.cpu.abi` | `ro.product.cpu.abilist` | native bridge | system image |
| --- | --- | --- | --- | --- | --- |
| `USKOCI_V5_TEST` | 36 / Android 16 | `x86_64` | `x86_64,arm64-v8a` | `libndk_translation.so` | `android-36.1/google_apis_playstore/x86_64` |
| `Pixel_10` | 36 / Android 16 | `x86_64` | `x86_64,arm64-v8a` | `libndk_translation.so` | `android-36.1/google_apis_playstore/x86_64` |

Both were booted and read at runtime, not inferred from config files. Exactly **one** system image is
installed on this machine, and both AVDs share it, so there is no third configuration hiding
anywhere.

## Both were tested with the exact attested artifact. Neither can run it.

No rebuild, no new APK, no change to the release. The same file, sha256
`efd5eb476226fced90c73c68bbd47f959a27200c8418f0ef68bc5870a75bf298`, verified on disk before each
install and hashed again on the device after it.

**How far it gets — further than I previously reported:**

1. it installs, and the on-device file hashes to `efd5eb47…`, byte-identical;
2. the system assigns `primaryCpuAbi=arm64-v8a`, so Android accepts it as an ARM app;
3. `nativeloader` configures the right paths:
   `library_path=…/lib/arm64:…/base.apk!/lib/arm64-v8a`;
4. the process starts, Zygote forks it, ART runs the app's Java code.

**Where it stops, on both AVDs identically:**

```
FATAL EXCEPTION: main
com.facebook.soloader.SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so
  SoSource 0: ApplicationSoSource[DirectorySoSource[root = …/lib/arm64 flags = 0]]
  SoSource 1: DirectApkSoSource[root = […/base.apk!/lib/x86_64]]
```

Read those two sources carefully, because they are the whole answer:

- **SoSource 0** points at the extracted library directory, and that directory is **empty**. The APK
  ships `extractNativeLibs=false` — the packaged flags carry no `EXTRACT_NATIVE_LIBS` — so its 27
  arm64 libraries stay stored uncompressed inside the APK and nothing is ever extracted. That part is
  correct and normal.
- **SoSource 1** is the bug. SoLoader looks inside the APK at **`lib/x86_64`**, derived from the
  *device's* primary ABI, not from the ABI Android assigned to the app. The artifact contains
  `lib/arm64-v8a/` and nothing else, so the lookup cannot succeed. Android put the right path on the
  loader path; SoLoader did not use it.

So the blocker is not the CPU and not translation. **It is that SoLoader resolves the in-APK library
folder from the host ABI while the app runs as arm64 through the bridge.** It fails in exactly the
same place on both AVDs, in the same millisecond of startup, deterministically.

### The one workaround is closed, and closed cleanly

The libraries exist inside the attested APK; dropping them into the app's empty `lib/arm64` would
have used only bytes from that artifact. It needs write access to `/data/app`, which needs root, and
root is refused:

```
adb root -> adbd cannot run as root in production builds
```

Both AVDs run a Google Play system image, where `adb root` is permanently unavailable. There is no
choice to make here and nothing to argue about.

## What the emulators did prove, and it is not nothing

Running against the exact artifact on `USKOCI_V5_TEST`:

| Boundary | Result |
| --- | --- |
| install of the exact attested APK | **PASS** — installed file hashes to `efd5eb47…` on the device |
| Android accepts it as an arm64 app | **PASS** — `primaryCpuAbi=arm64-v8a` |
| `uskociapp` deep-link registration | **PASS** — resolver returns `rs.uskoci.dev.MainActivity`, `isDefault=true` |
| the OS routes a cold `uskociapp://oporavak` to it | **PASS** — `am start` dispatches the intent to this package |
| launcher shows the canonical USKOČI mark | **PASS** — the app drawer entry reads `USKOČI DEV` and renders the two-figure handshake mark with the location pin, on white, under Android's own circular mask. Not the Expo template. This is GAP-0041 proven by rendering, not only by content matching inside the archive. |
| everything that needs the app's JS to start | **blocked** by the SoLoader resolution above |

A note on the icon, observed rather than assumed: the Android 16 launcher draws its own peach
backdrop ring around our icon and insets the mark further, because our adaptive background is plain
white. That is launcher behaviour, not our asset — and it confirms the sizing decision was right, as
the mark stays well clear of the mask on every side.

## Something on the second AVD that is not mine

`Pixel_10` already carried `rs.uskoci.preview`, versionName `26.6.0-dev.1`, first installed
**2026-08-09 20:25:33**, with `primaryCpuAbi=x86_64`. I did not install it and **I have not removed
it** — unknown origin is left alone.

It is worth reading, though: that older build carried x86_64 libraries, which is precisely why it
could run here. The narrowing to `arm64-v8a` alone happened later, in the CI workflow's Gradle
tuning. This is the same finding as before, now with a dated artifact on disk confirming it.

## Cleanup

- `rs.uskoci.dev` uninstalled from both AVDs after testing; `Pixel_10` is back exactly as found.
- `Pixel_10` was booted with `-no-snapshot` throughout, so no snapshot of it was written.
- The two screenshots and the UI dump were removed from the test emulator's `/sdcard`.
- Nothing was written to canonical DEV: no session, no recovery token, no row on any account. The QA
  credential was never used, because nothing reached a login screen.

## Conclusion

Every Android target on this machine has been enumerated and tested. Both are x86_64 Android 16 Play
images with ARM translation; both accept the artifact as arm64 and both fail at the same SoLoader
call. There is no third emulator and no attached device.

Per the owner's instruction: **no new APK was built and the release was not changed.** The physical
arm64 phone over USB remains the single pending step for the session half of PKG-017.
