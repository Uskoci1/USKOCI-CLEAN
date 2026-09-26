# R19e native replay and explicit viewport correction — 2026-09-26

Exact emulator source b5a82f69, tree c0dc9d45b7feb9f87cf37e47f5112cfce72d2dcf, run36225404482.
Installed APK SHA2567f5f09c57b3c3d9cdb3646b8293d37ed1022e21a110e2d2170be369999d83da1 at07:25:15UTC.

## Actual result on that APK

The real10-row Discovery -> scrolled task detail -> Back still fails scroll restoration. Quick chips remain folded
and the saved315dp is retained (trace52–66), but the first row is visible and no restore request/ack follows native
readiness. The earlier zero clamp is gone; this is not full acceptance. The sampled layout trace was exhausted
before return, so final raw child height cannot be claimed from that trace.

The local DEV gallery renders1 and1000 rows. Native clustering shows400 Novi Sad/200 Belgrade/200 Nis points.
Zooming the Novi Sad cluster shows400 in the area plus200 without a point. Remote filter shows100 rows and hides
the map; onsite shows900 including100 without a point. The1-row remote filter produces a0-result state with a
clear-filters action. This proves bounded rendering/membership cases, not deep1000-row Back, measured frame rate,
server pagination or1000 concurrent users. Nearby GPS was not invoked. Synthetic fixture data never enters DEV.

The safety menu's UI hierarchy could not be captured twice. The menu was dismissed with Back; no report or block
was submitted. This does not add native confirmation acceptance.

Phone USB reappeared. Phone run36226688621 targeted817b15f2 (documentation-only afterb5a82f69) but was explicitly
cancelled after the emulator failure, before installation. Do not count it as an installed phone build.

## Subsequent source correction

Installed Gorhom5.2.14 derives content height from the highest detent, not the current half/full detent:
BottomSheet.tsx205–213 and BottomSheetContent.tsx77–93. Our native handle is null; our own header is separate.
The FlatList now receives the measured full-sheet height minus its pinned header (or all height when the header
scrolls), with grow/shrink disabled. Restore uses that assigned frame instead of waiting indefinitely for another
onLayout callback. Native readiness, positive row content, exact scroll acknowledgment, retired-visit guards,
shortened-data clamping and intentional drag/reset remain. A changed assigned frame permits recalculation.

The no-second-layout regression fails old source and passes the correction. Ready diagnostics append raw height,
content height and assigned frame within the existing numeric-only gate/budget. No new timers or route changes.
CHECKS.explicit-viewport.json records the integrated checks; the later APK must independently prove this source.
No backend/Edge/payment/dependency/paid-AI or microphone changes belong to this package.
