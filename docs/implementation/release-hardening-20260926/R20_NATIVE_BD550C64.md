# R20 exact APK: two deep returns pass, initial peek remains open

2026-09-26, source `bd550c64c10e5f9204aec28ee6997917bd015e8b`,
tree `98ef49a996b4766be4612313389f315b9e4fe8b5`.

CI run `36269127157` passed 124 focused tests and the full 321 suites / 6,505 tests.
Android emulator build `36269145778` succeeded. The downloaded artifact, bundled
source/tree attestations and installed APK hash were checked. Its SHA256 is
`88c0edad559b2d232cc0d132e46938964129de6e999760c90a2e50e10867a8af`.
Installation used `adb install -r`, preserving both emulators' data. Emulator5554
remains at login and is not a second-account journey proof.

## Observed on emulator5556

In the inert 1,000-row native gallery, initial peek is missing, both after installation
and after a process restart without clearing data. The trace certifies index0 at
724.2dp; the header expected at [0,2043][1080,2232] is absent from native XML and
screenshot. The problem remains after map tiles load, so it is not explained by
the earlier map network timeout. No runtime exception was found in the bounded
ReactNativeJS/AndroidRuntime error read.

Selecting the visible remote filter opens the full list. Clearing that filter
keeps the full list and restores all 1,000 local fixtures. After scrolling to rows
0040–0042, opening detail41 and returning twice without any intervening scroll
preserves all three visible row bounds exactly:

| Row | Before and both returns |
| --- | --- |
| 0040 | [53,549][1028,1016] |
| 0041 | [53,1113][1028,1711] |
| 0042 | [53,1808][1028,2232] |

Both detail screens were verified to display `41/1000` before Back. Finally,
pressing the actual Mapa button lowers the full list and the peek header DOES
appear at [0,2043][1080,2232]. The remaining defect is initial rendering, not an
intentional hidden state. Its precise cause is not yet proven.

The numeric trace reaches its existing 120-event cap while scrolling. Therefore
it does not prove return acknowledgement or latency; the repeated-return result
comes from fresh settled screenshots and exact native XML bounds. Do not call it
a measured speed result or a server/concurrent-user load test.

## Evidence and remaining work

`r20-native-bd550c64/MANIFEST.json` hashes the selected inert screenshots, XML and
raw numeric trace. No real task/message/media mutation, microphone, provider call
or account creation was performed.

The separately built phone APK `36269145651` has independently verified Firebase
Messaging/package/ABI evidence in `R20_BD550C64_PHONE_APK.json`, but is not installed.
Windows now detects HONOR600Pro as a portable device; ADB still has no physical
device. The final CF02 photo recovery source was written later and is absent from
both bd550c64 APKs.

Next: isolate initial-peek rendering with a minimal client-only experiment, then
repeat cold peek and both deep returns on that exact new build. Keep this package
PARTIAL rather than marking the map/list row complete.
