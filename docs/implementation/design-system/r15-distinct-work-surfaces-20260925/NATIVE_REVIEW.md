# R15 — bounded native review

Source: `13bb55c0fb957bae723f4811a615926b92090ca6`.
APK run: [36150477204](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36150477204).
Both build attestations, source/tree/run/hash and emulator ABI were checked before successful `adb install -r`.
See `APK.json` for the exact APK hash. No uninstall, data clear or reset was used.

## Observed scope

Eight captured views were visually inspected on the authorized Android emulator: six inert presentation views and
two actual routes opened read-only. Each screenshot has a fresh accessibility tree and source-bound digest in
the local capture record. Four ordinary-size inert screenshots and three R14 comparison images are retained in
this package. Real user screenshots/trees remain local; their hashes and scope are recorded, not their contents.

| View | Observed result |
| --- | --- |
| Task cards | Green work headings, 24-dp place/time artwork, separate offers or per-person terms and publisher. Capacity wraps rather than crowding the amount. Soft lift distinguishes a tappable work brief. |
| Agreement list | Person first, full accepted schedule, work/place and a separate total. Existing rating/completion attention targets remain distinct. No enclosing advertisement frame. |
| Agreement awaiting confirmation | Existing next step precedes the accepted terms, followed by total and secondary entries. Fixed completion control is visible; never activated. |
| Long Agreement list | At ordinary size the long name, overnight term/timezone, work, place, four people and total fit or wrap in the inspected records. |
| Agreement history | Missing term and missing amount remain words, with actual fixture status visible. |
| Narrow long Agreement | 320dp/font 1.3 keeps the full schedule, timezone, place, people and total. The list title retains its existing three-line ellipsis; the accessibility label contains the full work title. This is a bounded reflow check, not the normal visual baseline. |
| Real Discovery | Bare card is visible in the open sheet without a second shadow/frame; Tasks navigation is selected. Map tiles loaded. No map selection, accuracy or GPS-success conclusion is drawn. |
| Real public detail | Work and logistics precede the offers band; publisher, description and fixed application entry remain readable. Only reading/navigation occurred. |

The temporary emulator density/font changes were restored and read back: physical density 420, no override,
font scale 1.0. The ordinary screenshots use those values; the single narrow view is labeled separately.

## Limits and continuation

These images verify bounded presentation, not a successful real Agreement, review or application journey.
No business command, DEV mutation, paid AI/provider call or microphone action was performed. No physical phone
was connected. Phone, iOS, screen-reader interaction, owned-detail native coverage and whole-journey acceptance
remain separate. Existing R14-N01 (latest-message anchoring when opening the keyboard) is not changed or closed.
The shared tab-edge fade remains visible; this batch does not claim to refine that component.

`R15_PREGLED.html` in the local output folder compares original before/after captures, including the read-only
detail. It is a local review page, not a public deployment or a substitute for the native build.
