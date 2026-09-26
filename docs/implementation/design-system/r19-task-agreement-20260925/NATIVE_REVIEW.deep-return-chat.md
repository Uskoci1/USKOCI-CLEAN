# Exact a69a26c6 native acceptance — 2026-09-26

Source `a69a26c69920b0e7107865e706fb430c4b27adba`, tree `5e6bbdb8d21c650b65e40e6631f3671a768ca0f4`.
Types and 321 suites / 6,326 tests pass. `CHECKS.deep-return-chat.json` preserves the earlier Windows logging-harness failure separately; that incomplete attempt was not counted as a full-suite pass. The successful run retains the existing Jest worker-teardown warning.

| Target | Run | Installed UTC | APK SHA256 |
| --- | --- | --- | --- |
| HONOR VKP_NX9, font 1.15 | 36229901348 | 08:43:27 | 01ed2cb22c8cabdf830ca9cbc6b578417e8ab64171d6fc86b91aba8fd657ff97 |
| USKOCI_V5_TEST emulator, font 1.0 | 36229903151 | 08:44:00 | 080d9b298fcbae944ea2231c7c6705af12bab8c976b8aefecacff431e0c0fdeb |

Both source/tree/run/hash/ABI attestations passed. `adb install -r` retained account data; the installed base APK hash matches. No uninstall, data clear or font change.

## Phone: Android Back passes the observed sequence

An active Agreement was already present when this version first opened. It was not created by this check. Opened its existing empty chat and focused its empty composer without typing or sending:

1. First hardware Back hides the keyboard and stays in chat (`agreement-keyboard` → `agreement-back-one`).
2. Second Back returns to the same Agreement overview and accepted task/participants/date/price (`agreement-back-two`).
3. Third Back reaches the Agreements list (`agreement-back-three`). A system notification partly covers the screenshot header; the underlying list is also verified in XML.

An independent image/XML review confirmed this sequence. Composer and primary actions are visible. With the keyboard open, the empty-state illustration is slightly clipped at its top; text is readable. The normal person-bar subtitle ellipsizes. These are retained visual polish items, not a claim that every chat/keyboard state is accepted. Multiline typing, uncertain media and sending were not exercised here.

## Phone: actual Discovery return still passes

Opened the real ten-task list, scrolled, opened the settled own-task detail for Kikinda and returned. `map-offset` and `map-return` show the same preceding tail, complete Kikinda row and following task; row bounds differ by one pixel. Numeric events 68–71 retain 749 dp and acknowledge 749.1 dp immediately after readiness (about 7 ms between captured ready/ACK log arrivals). This is a bounded observation, not a general performance benchmark.

## Emulator: deep position correctness passes, speed remains open

In the inert local 1,000-row gallery, 21 swipes reached rows 0040–0043. Detail 0042 / 42 of 1000 was opened, then returned to the same region twice. `thousand-deep`, `thousand-return-settled` and `thousand-return-repeat` show rows 0041–0043 at offsets differing by +4 and +3 pixels. `thousand-detail-settled` proves the actual detail. The earlier `thousand-detail` capture caught the press transition while the list was still visible and is not detail evidence. The first return hierarchy capture failed; later settled captures are the verdict.

Trace events 38–52 preserve the logical **9,914 dp** through measured-window requests at 969.3, 2,192.1, 3,176.5, 4,403.2, 5,917.1, 6,444.3, 7,952.1 and 8,449.3, finally acknowledging **9,913.9 dp**. The saved offset is no longer permanently clamped to the first partial window.

**Performance is not accepted:** ready at 08:47:45.166 → ACK at 08:47:52.472 is approximately **7.3 seconds** by host log-arrival time. This emulator's progressive reconstruction is too slow to call fluid. Next optimize retained/measured list geometry or lifecycle with the same ownership/reset guarantees; do not replace actual measurements with invented fixed row heights. Repeat timing on the physical phone with a local large fixture before making production-speed claims. Server-side paging/filter/count/publisher aggregation remains a separate proposal.

An independent image/XML/trace review confirmed position correctness and this speed limit. The floating Map control overlaps a partly visible following row consistently before/after; final-row clearance was not proved in this replay. Local fixtures are not backend or concurrent-user load tests.

## Scope / evidence

The versioned APK/capture/trace files bind results to this exact source. Original PNG/XML remain in the outer workspace `outputs/r6-integration/r19g-phone` and `r19g-emulator`; their hashes are in the manifests. They are not all committed binary images. Prior failed APK reports remain intact.

No new task, offer, Agreement, message, rating, report, block, upload, provider call, microphone, location permission or server/Edge/schema change was performed. Opening existing chat can execute its normal read acknowledgement. No whole-app, owner visual, iOS or store acceptance is implied. The local control table is regenerated; remote Artifact import remains unconfirmed.
