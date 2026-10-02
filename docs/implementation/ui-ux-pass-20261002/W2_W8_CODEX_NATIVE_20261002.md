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

Comparison build [36999466792](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36999466792) targets emulator with the approved Reanimated patch, source `0fed2a1bb204b0ba77f0cc013140cfbee2f08763`. It contains W2 and the earlier toolbar correction, not this U16 change. Final corrected source requires its own build receipt and installed hash.

Native verification is pending at this source checkpoint: ordinary font 1.0, owner font 1.15, bounded 1.3; full labels/counts; switching all sets; search/filter open, apply and dismiss; return state; reduced motion; shell roots and selection; separate UX/VISUAL critiques. No physical-phone, live-provider, whole-flow or release acceptance is claimed.
