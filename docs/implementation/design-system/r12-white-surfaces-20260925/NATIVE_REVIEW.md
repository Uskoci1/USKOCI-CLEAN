# R12 — bounded native surface review

Source: `21f8a0cb3beee0981d082674d0694c0a7285d6d8`. Android APK run: `36128635882`.
Emulator: `emulator-5554`, 1080 × 2424 physical pixels, density 420, font scale 1.0.
Display, font, keyboard and motion settings were not changed in this pass. No physical phone was attached.

These are nine observed views, not certification of the complete screen inventory or real journeys. Seven use
existing inert galleries that mount the same presentation components; two use the existing account read-only.
No send, save, selection, block, report, microphone, permission or paid provider call was made. No data was cleared.

| View | Evidence kind | Observation and limits |
| --- | --- | --- |
| home | inert_same_presentation | White agenda header with a rule and open own-task/application rows; primary tiles and icons retain color. No command executed. |
| ai-task | inert_same_presentation | White transcript, draft and composer remain distinguishable by neutral rules and edges; user bubbles retain solid forest. Existing scroll position includes a partially visible earlier message. No provider or microphone call. |
| ai-worker | inert_same_presentation | White review summary and conversation, colored icons and headings, bounded composer. No profile save, activation or provider call. |
| offers | inert_same_presentation | White list with larger initials, price and message rows; no acceptance or comparison command submitted. |
| offer | inert_same_presentation | White accepted-terms-style group with rules, full message and visible selection CTA. Fixture proposal only; selection was not pressed. Screenshot-only modal evidence. |
| profile | inert_same_presentation | Large initials, white trust facts with rules and visible safety entry. No report or block command. Screenshot-only modal evidence. |
| map | real_route_read_only | White search, pills, pins, list and selected neutral navigation well; green glyph/label remain distinct. Existing broad camera extent is not resolved by this palette pass. |
| filters | real_route_read_only | White sections, neutral segmented control and selected green outline/check remain clear; footer count/CTA visible. Closed draft without applying changes. |
| chat | inert_same_presentation | White received bubbles with neutral edges, solid own bubbles and white outlined composer. Pending/error fixtures remain distinct. The last recovery caption is partly below the observed scroll viewport; this is not full recovery acceptance. |

The seven inert PNGs and five available fresh hierarchies are retained under `screens/`; full-offer/profile modal
observations are screenshot-only, with no reused hierarchy. Real-account map/filter captures stay local, outside
Git; `CAPTURES.json` retains their digests. Original PNGs were not recolored or retouched. Any owner-facing
before/after layout is a presentation of those originals, not a substitute for native evidence.

Authentication and recovery now share the white source palette, but their proper native contexts were unavailable.
The signed-in guard was preserved. No logout or guard bypass was used to manufacture visual acceptance. Their source
tests and the APK recovery attestation do not certify an actual password reset or authentication screen.

The R11 audit remains the full inventory. Safety identity/confirmation, narrow media recovery captions, map camera
framing, large-text filter labels, long forms and group/support keyboard checks remain separate work. Real AI,
incoming/paged/read messages, phone/iOS and assistive-technology journeys and release gates are not closed here.

Control data is refreshed locally. Remote Claude artifact publication is still unconfirmed after the prior chooser
timeouts; local generation must not be described as publication. The DEV snapshot remains dated 24 September.
