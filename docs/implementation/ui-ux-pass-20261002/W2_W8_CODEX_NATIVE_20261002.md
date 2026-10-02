# W2 shell and W8 own-task tabs — Codex, 2026-10-02

This bounded continuation follows the existing W1–W12 plan, U10/U16/U18 and the emulator critique. The registry remains `docs/control/redovi.json`. No server, provider, dependency or business-data change belongs to this unit.

## Purpose and design decision

On Moji zadaci the person chooses active work, drafts or history, then finds a task in that set. The UX draft §3 destination and existing controls/count semantics remain. U16 explicitly replaces the underline treatment with capsules. Search and captioned Filteri retain their own toolbar. No new product interpretation or destination is introduced.

| Before | After | Why |
| --- | --- | --- |
| Installed W1: Istorija physically cut by search/filter buttons | W2/W8 source gives tabs the full row, controls their own toolbar | All three destinations remain readable. |
| Own-task tabs still underlined despite U16 | Quiet neutral track, white selected capsule, intrinsic-width labels | Implements the accepted capsule choice without forcing a long label/count into one third of the row. |
| Default equal-width pill can crowd Aktivni plus its count | Opt-in content-sized capsules, 8 dp each side, 48 dp minimum height | Content keeps its width and shares spare space. Other callers retain their existing defaults. |
| Width estimate describes underline geometry | Capsule estimate includes 16 dp label padding, 8 dp track padding and 3 dp gaps | Optional set counts give way before labels; attention count remains. Extreme sizes retain horizontal fallback. |

Selection accessibility updates immediately. Existing measured RN Animated transform, cancellation and reduced-motion behavior remain; no new animation engine or layout animation. Entry/HOME signature and original artwork untouched.

## Source checks and review

- Own-task geometry/state/callback suite and segmented suite: **41/41 PASS**.
- Existing Agreement collection/overview, shared Press and token guards: **155/155 PASS**.
- TypeScript: exit 0.
- Independent read-only review on the parent's GPT-6 model: approved, no blocker. Reviewer loaded all nine selected design skills; repository/owner rules take precedence over skill examples.

## Native evidence

Before: emulator `USKOCI_V5_TEST`, installed APK SHA-256 `1f9096605d2ce12b847521485314d83a586adee9df48638ae68b3df1ab5bfdc4`. Initial geometry 1080×2424 / 480 dpi / font 1.15; then restored the current requested 1264×2728 / 560 dpi (361.14 dp) / font 1.15. Existing signed-in session preserved. Baseline own-task capture confirms Istorija clipping. Private screenshots/XML stay outside Git.

Comparison build [36999466792](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36999466792) completed successfully, source `0fed2a1bb204b0ba77f0cc013140cfbee2f08763`, APK SHA-256 `4fbe60e6c3943b721ba0a3956bb4a31a1b855cebe6ddc7a85d1446c8efd81103`. Recovery/icon/Reanimated attestations pass and bind to the source tree. APK signature matches the installed app (`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`); install -r succeeded and readback hash matched, session preserved.

Comparison native observations: all three roots reached and correct selected semantics read back; full bottom labels at fonts 1.0/1.15/1.3; earlier own-task toolbar correction displays full Istorija. Fifteen root-tab taps end on the expected Home, and navigation still works after setting reduced motion while mounted (transition scale restored to 1). UID-scoped logs since installation contain 0 FATAL EXCEPTION and 0 old dead-tag warnings; this is not a complete device-health or frame-time proof. Separate independent UX and VISUAL still reviews approve this bounded layout scope with limits. U04 docked bar and W2.2 transitions remain open in their planned scopes. Comparison APK does not contain this U16 change; corrected source requires its own receipt.

## Final build and emulator verification

Final build [37000515232](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/37000515232) succeeded from source `7c920070ac5cc8e918c351d6ab0828e9b04ed5c1`, tree `f41d3e5645be2725fed2a51f958c2cb15c4685b1`. APK SHA-256: `1c571b1279cb9483c0f619ae9294a0756a8eb4dcc054b02250de01c293e5bf6c`. All three recovery/icon/Reanimated attestations pass and match that tree and APK. Certificate matches the comparison/baseline. `adb install -r` succeeded at device time 13:36:58; installed readback matches the APK hash, original September 22 installation and signed-in session remain.

On Android 16/API36, `USKOCI_V5_TEST`, 1264×2728 / 560 dpi (361.14 dp):

- Fonts 1.0, 1.15 and 1.3: all three capsule labels fit. At 1.0/1.15 ordinary counts remain; at 1.3 optional counts give way while orange attention remains. Selected controls have 48 dp height.
- Active, drafts and history each select correctly and show settled content. Final captures replace earlier loading frames; a partial price seen in one history frame was not reproduced in the next settled capture, which displays the full price.
- Search returns one matching task, persists when switching to drafts, and clearing restores the unfiltered set. Search captures include the software keyboard; a complete keyboard interaction/accessibility pass is not claimed.
- Filter draft cancellation retains two results; applying attention-only yields one and marks Filteri active; reset returns two. Published task detail → Back retains the active filter, selected segment and result count.
- Changing reduced-motion preference while mounted still gives the correct settled draft selection. All three root destinations and selected semantics also work on this final APK.
- UID-scoped logs from final installation through the check contain 0 `FATAL EXCEPTION` and 0 `Unable to find a viewState` occurrences. App remains foreground. This is a bounded log check, not complete device-health, ANR or frame-time proof.
- Restored font 1.15, 1264×2728 / 560 dpi and all three Android animation scales to 1. No data clear, sign-out or business action.

Independent final reviews: **UX APPROVE** and **VISUAL PASS WITH LIMITS**, including settled draft/history addenda, no in-scope blocker. Both reviews are read-only and separate from implementation. Sanitized build/device/capture-hash receipt: `W2_W8_NATIVE_RECEIPT_20261002.json`; private PNG/XML remain outside Git.

## Remaining boundaries and next work

This closes the bounded U16 capsule/toolbar implementation and W2 shell emulator checks, not the whole W2/W8 waves or product. U04 docked navigation, W2.2 transitions, Moje prijave and other W8 work remain open. W3–W12, natural AI chat and previously recorded business/media findings keep their existing status. At font 1.3, existing accessibility labels for omitted quiet badges have a trailing comma; carry into the accessibility pass. Actual TalkBack speech, frame timing/fluidity, haptics, 320 dp native/extreme text, physical HONOR, iOS and release acceptance remain unverified here. Existing unit tests cover the 320 dp geometry case. No paid-provider or DEV/PROD mutation was performed.
