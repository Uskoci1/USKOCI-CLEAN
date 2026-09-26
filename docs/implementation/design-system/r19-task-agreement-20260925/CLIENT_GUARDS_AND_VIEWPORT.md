# R19 measured viewport and client safeguards — 2026-09-26

This coherent source batch follows native source ba3f7dc3. Its later source/check/APK receipt must remain separate
from NATIVE_REVIEW.vector-diagnostic, which proves the vector pin and success footer but still fails scroll.

## Changes

- **Discovery viewport:** use the measured full sheet minus its pinned header as the maximum possible viewport.
  Do not clamp a retained offset using the transient content-sized layout observed natively. Wait for bounded
  geometry and native readiness; retain existing target acknowledgement, shorter-data clamping, user drag/filter
  resets and retired-owner protection. The numeric trace remains explicitly DEV/query opt-in until native acceptance.
- **Block confirmation:** reuse the existing confirmation sheet and unchanged consequence text. Cancel allocates
  no command. Retire questions on blur, account incarnation, target/context and new read. Existing editor/CAS and
  exact-command reconciliation remain. Direct unblock is unchanged. No trusted display name is fabricated; that
  separate SF-02 context gap stays open. Independent review found no new regression in this bounded diff.
- **Avatar receipt binding:** discard requires the caller's expected profile, asset and current account in the
  receipt. Both initial action and retained DISCARD replay supply the profile already held by the editor/journal.
  RPC still sends only p_asset_id. Mismatch remains an invalid/uncertain outcome; the journal survives readback and
  exact retry. READY-only eligibility is unchanged. This does not solve an upload with no known receipt.
- **Inert native Discovery gallery:** exact rs.uskoci.dev only, `uskociapp://dizajn-mapa?count=1` or `count=1000`.
  Uses the actual map/list/filter presentation and native stack detail/Back. Fixed local fixtures: 800 geographic,
  100 remote, 100 on-site without a point; variable titles/slots/prices and repeated points exercise layout/clusters.
  No fake scores, image assets or business commands. Fixtures never reach backend/profile/media services. The
  ordinary app-wide authenticated session and PushRuntime remain active; map styles/tiles/glyphs/sprites use the
  real public source. This is not total network silence. Explicit Nearby remains local and unpressed in this test.
  Dates are fixed September 26–30, 2026. No production alternate layout, dependency or backend change.

## Verification and limits

The viewport regression reproduces the native 313 -> 0 failure before the fix and restores/acknowledges 313 after
bounded 600 dp geometry. Existing shorter-list and intentional top-scroll cases pass. Focused checks: Discovery
75 tests; safety-related 82; avatar/media 68; gallery 16, all reported passing. Integrated execution is recorded
in CHECKS.client-guards-viewport.json rather than inferred from those overlapping counts.

The first integrated run caught duplicate currency formatting in the new gallery (320/321 suites, 6312/6313 tests).
The gallery now calls the existing novac helper; the guard test was not weakened. The final run and file hashes
belong to the check receipt. Native 1/1,000-row behavior and viewport correction await the next exact APK.

Do not equate 1,000 local rows with bounded database reads, smooth measured frame times or 1,000 concurrent users.
Discovery server paging/count/filter parity, unpaged chat/candidates, authoritative safety names, avatar upload
recovery and the other operational/store gates remain in NEXT.md and the single control table. No DEV application
is authorized by this client package. The private remote dashboard import remains unconfirmed, not published.
