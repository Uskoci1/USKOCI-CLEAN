# R12 — white surfaces, color in content

Date: 25 September 2026. Target: `work/uskoci-ui-unification-20260924`.

The owner's latest correction rejects mint backgrounds and washed-out large panels. Reading surfaces must be
clean white; icons, lettering, photography and clear accents supply life. This supersedes R8's mint canvas and
earlier ivory/pale-green surface prescriptions. Spacing, hierarchy and normal fluid motion remain valuable.

## Implementation

- System: white canvas and reading surfaces; neutral grey wells, separators, placeholders and shadows. Green and
  orange remain accents; warning/error states keep their meaning. Selected controls retain a green border, glyph,
  label or check, along with their existing accessibility state. `greenSoft` is a compatibility name for a neutral
  selection well, not permission to paint a screen mint.
- AI task and worker conversations: white transcript, white summaries and composer. Assistant bubbles gain a
  neutral edge so white-on-white still has structure. Solid own-message bubbles and speaker labels stay distinct.
- Home: white appointment header with a rule; own-task/application navigation becomes open white rows.
- Task detail, offers and public profiles: major fact/terms/trust groups use white, space and rules rather than
  mint boxes. Actual prices, review availability, names and all commands are unchanged.
- Discovery: white list ground. Map residential/building/base tones become neutral, while parks, woodland and
  water retain geographic meaning; marker identity and camera behavior are unchanged.
- Sign-in and recovery: the separate forest/cream form palette now aliases the shared white system; readable dark
  text, green primary actions, neutral input edges and dark status-bar icons. Removed the decorative form/badge
  gradients. Entry artwork retains its own colored illustration; its form controls and doorway are white, shadows
  neutral. No authentication command, availability guard, recovery link or session behavior changed.

The selected approach uses white reading groups with small neutral control wells. A flat white treatment without
boundaries would hide input/selection affordances; tinting entire groups would recreate the owner's complaint.
No dimensions or motion are reduced to disguise crowding.

## Verification

`CONTRAST.json` measures 22 explicit normal-text pairs from the edited palette using relative sRGB luminance;
all exceed 4.5:1 (minimum 5.117). This is not certification of every composited pixel, disabled control, map label,
photograph or assistive-technology interaction.

Initial full Jest run: 311/313 suites and 6,081/6,083 tests passed. Two assertions pinned the previous green-grey
switch track and green-tinted entry shadow. Their expected colors were updated for the owner's decision, retaining
the complete accessibility, state and late-animation-clock assertions. Animated and settled entry shadows now use
the same neutral ink. Final types are clean and all **313 suites / 6,083 tests pass** (116.024 seconds), with the existing Jest worker
teardown warning. `CHECKS.json` records the commands. APK run **36128635882** passed, both package attestations match source **21f8a0cb** and the
APK digest, and the APK was installed with data preserved on the emulator. Nine bounded native views were read;
see `NATIVE_REVIEW.md`, `CAPTURES.json` and `RECEIPT.json`. No physical-phone acceptance is claimed.

## Scope limits and next work

No DEV, Edge, migration, price/payment, provider, dependency or real business-data mutation. No paid AI/voice call.
The R11 screen audit remains the full inventory; changing shared color values is not completion of every screen.
Safety target/confirmation, narrow media captions, map-camera/filter-label follow-ups, long forms, group/support
keyboard behavior and functional/release gaps remain open. Authentication/recovery need their own authorized
native context; source tests cannot substitute for that. No physical phone is attached in this pass.

Control state is generated locally after the batch. Remote publication to the existing Claude artifact remains
unconfirmed after the previously recorded file-chooser failure; do not report generation as publication.
