# Discovery: full list and truthful location groups

2026-09-27. Client source correction; native acceptance pending. At initial inspection, the affected Discovery presentation, sheet and filtering paths were unchanged from installed preview source `b589994ee9191a35cb57feb33a31e462d8532e6f`.

**Screen purpose:** find a useful task, either on the visible map or outside geographic search, then open its existing detail.

| Observed source problem | Decision and implementation |
| --- | --- |
| The first count tap opened half height, requiring another tap to see the full list. | One count tap now requests the full list. Dragging still supports all three detents; initial map-oriented half/peek placement remains. |
| Empty results over a retained map were forcibly limited to half height. | Empty results may use the same full-height surface and existing recovery action. The redundant floating map action remains absent there. |
| A filter leaving only unlocated work could remain at half height. A different filter with the same result count did not retrigger the decision. | A changed shared filter opens the full list when all remaining results lack a public point. Geographic pan/zoom is excluded from that trigger; the remembered camera remains intact. |
| Full height stopped below an extra gap and retained the floating rounded border/shadow. | The full detent meets the measured search/quick-filter edge directly. Only the actual native full index removes the sheet's top radius, border and lift. Lower detents retain their prior attribution clearance. Quick filters remain available. |
| Global lists mixed remote and unlocated tasks among mapped results. Geographic lists combined both under one ambiguous heading. | One stable partition presents mapped tasks, `REMOTE` tasks and other tasks without a valid public point. Labels and counts are distinct: `Na mapi` / geographic context, `Na daljinu`, `Bez označenog mesta`. Existing remote quick filtering remains the direct entry. No missing point is interpreted as remote work. |

`discoveryMapScope` retains the exact filtered membership and original map-source order, including remote rows whose stale coordinates must not become pins. Each list group preserves its source order; only ordering between groups changes. Geographic bounds still filter mapped tasks only. The confirmed published pinless row retains its existing first-row priority; following sections describe their actual remaining members.

The implementation preserves TaskCard and DiscoveryPeek, public-coordinate privacy, selection, account relation labels, native command ownership, actual physical coverage, retained scroll restoration, list virtualization and the existing tab-bar boundary. It makes no backend, RPC, dependency, provider, payment or device change.

## Verification

- Four new focused regressions failed on the old source, then passed after implementation: one-tap/full geometry, half-to-full unlocated result, fully opened empty recovery, stable global location groups.
- First complete targeted run: 193 passed / 1 failed, 194 total. The only remaining failure expected the obsolete shared `section-without-point` test ID; it now asserts the real remote section and absence of an unlocated section.
- Final targeted rerun: **3 suites / 194 tests passed**, exit 0, 86.751 seconds: `discovery-presentation.test.tsx`, `discovery-view.test.ts`, `marketplace-view.test.ts`; command `npx jest <these three paths> --runInBand --testTimeout=30000`.
- Added direct background-state assertions, a same-count changed-query case, and updated existing crowded-place, geographic-section, small-screen/large-text and full-list geometry assertions. Existing focus, camera, gesture ownership, deep-scroll return and publication regressions remain in the targeted suite.

No native gesture timing, physical full-height appearance or device performance is established by Jest. Root owns the later exact APK/device check and integration commit.

## Remaining independent observation

An outstanding explicit full command can reject an intermediate half observation by design. Root's phone/emulator review did not establish a permanently stuck full command, so this patch does not weaken that ownership guard or add automatic retries. A future reproduced stall should use an explicitly owned, bounded recovery rather than accepting stale native callbacks.
