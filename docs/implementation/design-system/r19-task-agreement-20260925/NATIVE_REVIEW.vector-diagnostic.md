# R19 vector/diagnostic APK — 2026-09-26

Source `ba3f7dc3e3c2bd1dc6c026f6dce9e2d9b56c9b4f`, tree `f9dc88b35ae99f9a3f8d98ff5a0a24165c3208b8`.
Run `36223769011`; APK SHA-256 `ecc0219e21680f25436f82b54e490f20736a1044c72edd789a9a7062d4a8dc7c`.
Installed with `adb install -r` on USKOCI_V5_TEST / emulator-5556 at 06:42:18 UTC; installed base hash matches both
source-bound artifact attestations. Host GPU, 1080x2424, density 420. Physical phone was absent; no phone build/install
belongs to this iteration. This is the fourth native R19 source; earlier failed observations are preserved.

## Observed fixes

- The original vector brand renders in the rich annotation. Selected task -> real detail -> Back retains the green
  pill, visible brand, source preview and map geometry. Both immediate and settled screenshots were inspected.
- One selection success mark/text remains above Open Agreement in the pinned footer. Actual native presentation
  checked at font scales 1 and 1.3 using the existing inert candidate gallery; no real server selection was performed.
  The ordinary typography baseline is unchanged. System font scale was restored to 1.
- Changing system font recreates this activity on Discovery. Two captures initially named for selection show that
  destination instead; their manifest explicitly corrects route/kind and does not count them as success evidence.
  The gallery was then reopened and the separate `selection-success-font13` capture supplies actual evidence.

## Still failed, now diagnosed

The real 10-row list still loses scroll after a task detail. The opt-in bounded numeric trace shows:

1. Events 49–52 persist 313 dp and open with that value; no pending debounce loses it.
2. Events 57–61 restore owner/focus and seed the same 313 dp; native sheet reaches EXTENDED.
3. Event 62 reports both content and viewport as 2611.4 dp, impossible inside the measured 767 dp body.
4. The current clamp treats that transient content-sized layout as a real viewport, writes zero (63–64), and
   unfolds the quick chips. This is not a search reset or loss of the route's saved position.

`DISCOVERY_TRACE.vector-diagnostic.jsonl` contains only fixed event names and numeric/boolean values. The next
source rejects a viewport larger than the calculated full-sheet space before clamping. Its regression fails on
this APK's source and passes with that correction; a later rebuilt native replay is still required.

No business command, AI call, microphone, new account, database/schema/Edge/payment/dependency change occurred.
The gallery checks are presentation evidence, not another R18 transaction, backend load test or store acceptance.
