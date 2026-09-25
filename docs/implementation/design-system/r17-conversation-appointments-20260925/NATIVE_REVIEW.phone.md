# R17 physical-phone inspection

Source `8500bf29db718230c8706a39609e3f73a6373b59`, ARM64 APK run `36172923719`.
Both artifact attestations and source/tree/run/ABI/APK SHA-256 were verified before `adb install -r` returned Success.
APK identity and install time are in APK.phone.json; no uninstall or data clear was used.

Device: owner's VKP-NX9, Android 16, 1264 x 2728, density 560 (about 361 dp), existing font scale 1.15.
The owner's settings were not changed. Only existing public records and read-only navigation were used.

| Evidence | Executed observation |
| --- | --- |
| discovery-installed / discovery-ready | First post-install opening reached the map with nine tasks, four without map points, without Retry. These two PNGs are identical, not two independent states. The earlier intermittent R16 failure is not proven fixed. |
| map-pin | A real offers pin opens its matching preview. The selected green capsule keeps the logo without the previously visible extra outer ring. The pin remains above the preview. |
| task-from-pin | The preview opens the matching detail. Facts, offers wording, description, publisher and bottom action render. No application, report, message or other business command was executed. |
| map-return | Back returns to the same selected capsule and geographic framing above the same preview. Direct before/after PNG inspection confirms this bounded R16-N03 case. |

Five captures represent four distinct visual states. Raw PNG/XML files remain local under
`outputs/r6-integration/r17-phone/`; only manifests and the report belong in Git, because real public record details
are present. The manifest binds each capture to this APK. The initial XML and PNG can straddle loading because
accessibility extraction and screenshot are sequential; the reviewed PNG is already loaded.

After map-return, ADB reported the physical phone disconnected. Filter, Home, Agreement and both AI native checks
therefore did not run on the phone in this pass. Installation is complete; whole journeys and owner visual
acceptance remain open. The emulator is a separate bounded UI check, not a substitute for those phone outcomes.

## Remaining limits

- R16-N03's inspected ring and detail/back case are corrected here; continuous recentering across arbitrary sheet
  heights, fallback bitmap failure and more than 40 rich markers were not exercised.
- Map attribution is still visually prominent at the owner's text setting. Preserve required source credits when
  considering a calmer composition; this pass does not alter their behavior.
- R16-N01's cause remains unknown. One successful opening cannot establish repeated-load reliability.
- No live AI provider, microphone, chat send, application/selection, account, payment or backend mutation occurred.
- This is bounded device evidence, not a claim that the app is release-ready or visually approved by the owner.
