# B22 / RNR-01 Kotlin behaviour harness (committed so that anyone can re-run it)

What it is: the behaviour test of the Reanimated patch (`patches/react-native-reanimated+4.5.1.patch`). `run.cjs` copies the three `USKOCI patch RNR-01` regions (constants, guard members, `synchronouslyUpdateUIProps`) VERBATIM out of the installed, patched `NativeProxy.kt` into a small class, compiles them with the Kotlin K2 compiler against the stubs `stub_*.kt` (`Log`, `SystemClock`, `UiThreadUtil`, `FabricUIManager`, `IllegalViewOperationException`, `SynchronousPropsBufferParser`, `BuildConfig`; the mounting manager is a fake called through a real `java.lang.reflect.Method`, so real `InvocationTargetException` wrapping), and runs the scenarios in `Main.kt` with a virtual clock.

What it is NOT: the Gradle build of the app. The real compile gate is the CI APK build (`build-android-dev-apk.yml`). The compiler is the one that ships in the local Gradle distribution (2.2.21, run at language and API level 2.1 = the Kotlin of React Native 0.86's Gradle build, `node_modules/react-native/gradle/libs.versions.toml`, 2.1.20), not the app's own toolchain.

## Command

From the repository root, with Node and a JDK 17+ on `PATH` and a Gradle distribution under `~/.gradle/wrapper/dists` (or `KOTLIN_LIB_DIR` pointing at a folder with `kotlin-compiler-embeddable-*.jar`, `kotlin-stdlib-*.jar`, `kotlin-script-runtime`, `kotlin-reflect`, `kotlin-daemon-embeddable`, `kotlinx-coroutines-core-jvm`, `annotations`):

```
node docs/implementation/product-v1-closure-20260926/finalization-20260927/b22/kotlin-harness/run.cjs
```

It refuses to run when the installed `NativeProxy.kt` is not the file pinned in `scripts/verify-native-patches.cjs` (`PIN.patchedTarget`), so the scenarios always describe the reviewed patch. `ALLOW_UNPINNED=1 node .../run.cjs <file>` tests a candidate file while the patch is being edited. A run takes about 2 minutes on Windows (almost all of it the compiler start). Exit code 0 and the last line `ALL OK` mean every scenario held.

## Scenarios (Main.kt)

1. A mounted tag is applied on every pass, silently, and nothing is remembered.
2. An unmounted tag never reaches the reflective call and builds no exception; one named line and one summary per 5 s window; one cheap lookup per pass.
3. A tag that mounts later is applied on the very first pass after it appears.
4. A ViewState without an Android view (`resolveView` throws `IllegalViewOperationException`) is skipped and counted as `viewless`, never as a failure; 4b. any other error of the check itself falls through to the upstream call.
5. A mounted tag whose update throws: one stack with the real cause (not the reflection wrapper), then retried at exactly 250, 500, 1000, 2000, 2000 ms, success clears the back-off, a new failure after recovery is logged once more.
6. Leaving the mounted state clears the back-off. 7. At most 64 skipped tags are named per window. 8. A mixed batch is handled tag by tag.
9. Off the UI thread (`UiThreadUtil.isOnUiThread()` false) the guard is bypassed and its state is not touched (upstream behaviour, old-style failure lines, no summary).
10. 100, 500 and 1,000 simultaneously failing mounted tags (more than the old cap of 64): nothing is wiped, every tag follows the back-off schedule (7 to 9 attempts in 10 s of 60 Hz passes, never one per pass), one stack per tag. The old rule (`clear()` the whole map at 64 entries) would retry every tag on every pass: 100 x 625 = 62,500 attempts and as many stacks in the same 10 s.
11. 1,100 failing tags (more than the cap of 1,024): the 1,024 tracked tags keep their back-off, the 76 overflow tags are retried on every pass without a stack, counted as `untracked` in the summary.
12. Stale entries (their tags are gone) are evicted when the table is full; 13. live back-offs are never evicted to make room; 14. a sweep runs at most once per 4 s.

Why the cap evicts only stale entries and not the oldest or the least recently failed live one: a simulation of the alternatives (FIFO, evict-the-soonest-due, evict-the-newest, random, no admission, and the old clear-all) with 60 passes per second, persistent failures and a fixed tag order showed that FIFO and soonest-due eviction thrash completely once the failing tags outnumber the cap (every tag retried on every pass, as with clear-all), while never evicting a live back-off keeps every tracked tag at its schedule and limits the damage to the overflow. At 1,024 live failures the table is a memory bound, not a working limit.
