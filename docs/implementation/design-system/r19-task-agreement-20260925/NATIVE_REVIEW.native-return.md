# R19 third native build — observed 2026-09-26

Source `46c87a38af2fb54612088cb188501139039e8569`, tree `1cdc14a7f50896774d37281246472a9fec807ab2`.
Emulator run `36221798008`, APK SHA-256 `5f9e6d02bc6fcd3e763f9fa0056b73f6a75554ce70e0b04f79d20fde51f9c122`.
Installed with `adb install -r` at 06:03:27 UTC; installed base.apk hash matches. Both attestations bind the exact
source/tree/run/hash. Same USKOCI_V5_TEST emulator with host GPU, 1080x2424, density 420, font scale 1.
Phone run `36221800194`, ARM64 SHA-256 `a5c9af8a26fe0be8511ea7d1ed4791480a7d06da1fadb6ac729e6d3ebe5c0a1e`,
is verified but NOT installed: physical phone remains disconnected.

## Results

- **PASS, bounded:** the compact sheet returns after full-list -> Map -> rapid task tap -> Android Back.
  This preserves the previous corrective result; camera, selection and source preview also return.
- **PASS, bounded:** cluster navigation shows 3 mapped tasks plus 4 without a point; native fallback brand mark
  and base labels render. First entry also renders a rich unselected mark.
- **FAIL:** full list is scrolled to the second task, quick chips fold, and panel top becomes 361 px.
  Opening that task and returning resets the first task to the top and unfolds chips (panel top 529 px).
  The Map button and non-pressable count show the logical full stop remains. See `stable-full`, `stable-scrolled`,
  `scrolled-task-detail`, `stable-back` in CAPTURES.emulator.native-return.json. Mocked restoration passing is
  not native restoration acceptance. The native-ready/acknowledgement attempt did not resolve this case.
- **FAIL:** after selected task -> detail -> Back, the rich green annotation retains an empty white logo well
  even after base labels and the task preview render. See `selected-task-back-settled`; the preceding transition
  capture alone is not the assertion. The loaded-image/layout/frame handshake did not resolve this case.

Independent source tracing narrows scroll loss to a premature zero clamp, a later synthetic zero after
acknowledgement, or an actual search-key reset. Existing pixels cannot distinguish those causes. A bounded
numeric-only DEV trace is required before another speculative restoration patch. Rich annotations can instead
use the already installed native SVG renderer and original BrandMark paths; that next source must still pass
the same rebuilt native sequence.

No new task, message, AI call, microphone use, account or backend mutation occurred. The prior R18 business
journey and previous versions' observations remain historical, not a repeated whole-app test on this APK.
Neither defect is closed. Native 1,000-row restoration, physical phone and store acceptance remain open.
