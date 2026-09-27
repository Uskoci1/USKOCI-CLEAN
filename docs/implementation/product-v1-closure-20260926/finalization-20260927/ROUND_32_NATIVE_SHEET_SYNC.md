# Final outcome: candidate rejected and rolled back

Exact2b2 APK compiled the flag=false but produced a repeated Android ANR. All four source/test changes were reversed; current runtime matches10739a44 exactly. The10739a44 APK was restored with-r and its installed SHA verified. See [native receipt](ROUND_32_NATIVE_RECEIPT.json) and [ANR diagnosis](ROUND_32_ANR_DIAGNOSIS.md). Original FULL navigation-return disappearance remains open. Candidate phone APK must not be installed. The material below preserves the investigated hypothesis; it is not an accepted fix.

# Round32: native sheet properties diverge from animation state

## Exact failure

Round31 source10739a44, emulator5556, APK36353185115: open FULL, scroll, open the inert Catalog gallery, Android Back. The sheet disappears. The existing trace remains FULL/index2/position71.2dp and acknowledges restored offset248. This is a reproduced failure, not a proposed cosmetic change.

Android's encoded visible-window hierarchy was read without altering the failed UI. Only the USKOČI activity and the four target nodes/ancestry were decoded into the committed numeric evidence. The original archive and unrestricted activity dump remain local.

| Native node | Bounds | Alpha | TranslationY |
| --- | --- | --- | --- |
| Sheet body0x1710 | 1080×1827px | **0** | **2424px** |
| Host0x1712 | 1080×2014px | 1 | 0 |
| Background0x164c | 1080×1827px | 1 | 0 |
| ExpoBlurTarget0x14e | 1080×2014px | 1 | 0 |

The twenty encoded body ancestors have normal visible properties. Body alpha/translation exactly match Gorhom's initial hidden state, despite its shared values reporting FULL. Native property divergence is proved; the precise cause in the animation registry is still an inference.

## Narrow mitigation

Installed Reanimated4.5.1 deletes old registry entries before returning settled values in `AnimatedPropsRegistry.cpp`. A delayed JavaScript poll can miss that transfer window. This matches an [upstream source-level report](https://github.com/software-mansion/react-native-reanimated/issues/9965), including stale initial opacity/position with healthy shared values.

Use the [documented static configuration](https://docs.swmansion.com/react-native-reanimated/docs/guides/feature-flags/#force_react_render_for_settled_animations): disable only `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS`. No dependency/version upgrade, sheet remount workaround, weakened readiness guard, business logic or server mutation is needed. Existing explicit DEV Discovery trace reads the compiled native flag once; no production trace is enabled.

This opts out of a registry-eviction optimization. It can retain more animated entries and increase native commit work; it is not a claimed performance improvement. Motion remains enabled. A rebuilt standalone APK is mandatory; Jest cannot validate the native registry or its compiled flag.

## Acceptance boundary

Before calling the mitigation accepted: verify the exact APK, installed hash and compiled flag=false; repeat FULL→gallery→Back and a second navigation return after settling; inspect the visible header/cards and actual native body alpha/translation; exercise map/list switching and a normal panel. Phone/iOS, precise timing and high-volume performance remain separate.

Status at preparation: **SOURCE MITIGATION / EXACT NATIVE CHECKPOINT PENDING**. Round31's failure stays in its immutable receipt. Checks, exact build and outcomes follow in the Round32 receipt. The existing TaskCard, Peek, branded pin, DEV210/Edge22 and certificate are unchanged.

## Source checks

Integrated TypeScript: PASS. Combined focused serial Jest:2 suites/171 tests PASS in119.261s with15000ms timeout. First run had3 existing presentation timeouts during parallel TypeScript load and2 diagnostic mock-getter failures; the latter were corrected with a live property descriptor in the test mock. No production assertion or behavior was weakened. No full suite rerun; prior342-suite result belongs to745f07d6, not this patch. These checks are not native acceptance.
