# R19 scoped integration review

Reviewed on 2026-09-25 against the uncommitted working-tree diff over `5ca735315684473a2e90e31325230c6d46636373` (R18 runtime ancestor `74f514d79fa323e135c9ddc23a6cb6b5b934c730`). This is a source review of the Agreement composition, task-photo placement, message composer and segmented-control accessibility change. It is not a new APK, device or backend acceptance.

## Finding resolved during review

**P2 — Chat Back changed destination when the keyboard compacted the screen. Fixed in the final reviewed working tree.**

- In the first reviewed diff, the compact Back called route `backToAgreements`, while the ordinary header called `onOverview`. Opening the keyboard, using a short window or increasing text therefore changed the same arrow from showing the overview to leaving this Agreement. No data-loss claim was made: the route still owned the outbox and photo model.
- The integrator fixed this after the review report. Final `src/ui/v2/AgreementThreadPresentation.tsx:55,65–68` uses `onOverview` in both compositions. The obsolete exit `back` prop is removed from the component and its callers. The route's overview Back remains the exit at `src/app/dogovor/[id].tsx:366–369`.
- `src/data/__tests__/agreement-thread-presentation.test.tsx:107–117` now exercises Back before compact measurement, at 410 px height, and after restoration to 790 px. All three assertions require the same overview callback. The large-text test at lines 70–73 also expects that destination.
- Status: resolved by source inspection; test execution belongs to the integrator's validation. No runtime file was edited by this reviewer.

## Preserved behavior checked in source

| Surface | Evidence and judgment |
| --- | --- |
| Opening the authoritative task | `src/app/dogovor/[id].tsx:371–377` uses the Agreement's `izvor.zadatakId`, only for a recognized participant. The callback retains `formCurrent()` and distinguishes the owner's task route from the public task route. No title matching or invented destination is added. |
| Accepted terms remain Agreement terms | `src/ui/v2/AgreementPresentation.tsx:111–140` renders price, schedule, location and coverage from the supplied Agreement, not a fresh advertisement. No source id means readable content without a fake link. The new route tests cover both roles, absent source and retained callback rejection after account revision change (`agreement-screen-recovery.test.tsx:104–124`). |
| No second task-navigation control | The former separate task row is removed from `src/app/dogovor/[id].tsx:397–402`; the worker's distinct application destination remains. The header chat icon and conditional footer “Otvori poruke” can both appear, but both are labeled and perform the same harmless local navigation; no inaccessible duplicate action was established. |
| Confirmations and permission gates | `src/app/dogovor/[id].tsx:187–221,275–290,312–315,379–438` retains writable/foreground/account/focus gates, exact completion review, problem reporting, unknown workspace outcome readback, accepted-change response, contact, private location and rating paths. Moving the card does not replace these authorities. |
| Composer, pending sends and photo recovery | The `AgreementChat` diff changes input geometry only. The route still owns outbox/photo models (`dogovor/[id].tsx:189–190`). The chat remains at a stable component position across compact/regular composition (`AgreementThreadPresentation.tsx:71`). Storage retry, unknown-outcome retry, photo recovery, terminal read-only state and workspace refresh remain in the scroll (`AgreementChat.tsx:286–324`). Existing presentation tests exercise retained input/photo tray instances and exact retry in a closed conversation. |
| Read failures and refresh | The bounded whole message/photo read remains at `dogovor/[id].tsx:167–178`; retained refresh feedback and retry remain at `AgreementChat.tsx:218–260`. No polling or server-read change is introduced by this composition patch. |
| Photos before the title | `NeedPresentation.tsx:149` and `PublicNeedPresentation.tsx:90` place actual photo content first. Public loading/error/stale guards remain. The title still measures its own direct content-relative block; `ProductDetails.tsx:48–55` includes that block's offset, so its header handoff can account for the gallery height. Authoritative empty galleries render nothing; failed reads remain retryable. |
| Stale spoken badge count | `src/ui/system/Segmented.tsx:61–62` sends explicit empty accessibility text when a badge disappears. The selected-tab state and callback are unchanged. The new focused test asserts retirement of an earlier count. |

## Verification limits

- Read current function bodies, the working-tree diff and the relevant tests. No tests were rerun in this review because the integrator owns the integrated type/Jest pass; no passing result is claimed here.
- No device, provider, backend or real-data action was performed. Native keyboard geometry, TalkBack traversal of the clickable accepted-terms card, photo paging and full-screen viewer still need the integrator's APK/device evidence.
- The reviewer implemented the gallery earlier in this batch; gallery placement was checked here, but this is not a claim of independent review of every gallery implementation detail. Its focused test result and media-contract limitations are recorded in `MEDIA_AUDIT.md`.
- No unresolved concrete regression was established in the final reviewed scope. This conclusion does not certify the rest of the app or server, and does not close the avatar-upload investigation, audio/documents work, or release gates.
