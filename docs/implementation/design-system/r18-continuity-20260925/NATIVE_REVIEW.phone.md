# R18 native phone review

Independent static-image review, 2026-09-25. Reviewer: `p0_chat_refresh` subagent.

## Build and evidence binding

- Source: `74f514d79fa323e135c9ddc23a6cb6b5b934c730`
- Tree: `643d23914ab13dc603f422dd19b97194f863a687`
- APK SHA-256: `be5273f47225511d604bdebe7088b62654816bb40cbd5df1de35c215b0257370`
- APK run: [36183495466](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36183495466)
- Capture device: physical Android phone; capture metadata reports 1264 × 2728 pixels, density 560, font scale 1.15.
- Evidence folder in the outer workspace: `outputs/r6-integration/r18-phone/`.
- Detailed independent sidecar: `outputs/r6-integration/r18-phone/REVIEWS.agent.json`.

Each of the 12 PNGs below was directly viewed. Its SHA-256 was independently calculated and matched against its entry in `CAPTURES.json`; source and APK hash also matched for all 12. Per-image hashes, source, route, capture time, and judgment are recorded in the sidecar. The capture manifest was not changed.

## Result

**Bounded visual pass with two P2 follow-ups.** Ten captures have no blocking layout issue in the inspected position; two expose a local visibility issue. The selected screenshots visibly trace publication, offer selection, messages in both directions, completion confirmation, the owner's saved five-star rating, and the parent task labelled closed.

This is screenshot evidence of displayed states, not an independent replay of device actions or a claim that the whole application is accepted.

| PNG | Visible evidence | Judgment |
| --- | --- | --- |
| `test-publish-result.png` | Published header, one person, offer-based price mode, Smartphone tool, flexible schedule, deadline explanation, and Open task action. | Pass. Readable facts and unobstructed pinned action in the captured scrolled position. |
| `owner-offer-detail-settled.png` | Applicant identity/reputation, 100 RSD total for one person, flexible date range, offer message, and Choose this offer action. | Pass. Identity, terms, and decision action are distinct and readable. |
| `owner-selection-confirm.png` | Explicit consequence of forming an Agreement, total/people, confirm, and cancel. | Pass. Long confirmation copy remains readable and both choices are visible. |
| `owner-selection-result.png` | Existing offer terms, Agreement formed feedback, and Open Agreement action. | Follow-up F02. Success feedback is partly outside the scroll viewport; the next action remains visible. |
| `owner-chat-keyboard.png` | Compact chat header, Terms action, empty state, refresh, multiline draft, Photos, and send above the keyboard. | Follow-up F01. Top draft line is partly clipped within the input. |
| `owner-message-sent.png` | Complete outgoing Test R18 message at 22:42, cleared composer, task context, and 100 RSD. | Pass. Message wraps readably; composer and attachment action remain accessible. No read-receipt claim is displayed. |
| `owner-reply-received.png` | Previous outgoing message retained and complete incoming reply at 22:43, with refresh and composer. | Pass. Both directions, timestamps, and message bodies are visible. |
| `owner-awaiting-confirmation.png` | Completion awaits owner confirmation; deadline/automatic-close explanation, accepted terms, and Confirm completion action. | Pass. Current responsibility and next action are clear. |
| `owner-finish-confirm.png` | Completion consequence, task, participant, one person, 100 RSD total, and explicit confirmation. | Pass. Essential terms and final confirmation fit without overlap. |
| `owner-completed.png` | Agreement completed state, accepted terms, and Rate collaboration action. | Pass. Completed status and next action are clearly differentiated. |
| `owner-rating-saved.png` | Rating saved, recipient, five stars, 5 of 5 text, immutable-rating explanation, and return action. | Pass. The owner's saved rating is visible and unambiguous. |
| `parent-task-completed.png` | Parent task Closed; no selectable applications; one historical application; one of one place filled; View applications action. | Pass. Closed state and historical versus selectable application counts are explicit. |

## Follow-ups

### F01 — multiline draft clipping with keyboard open (P2)

In `owner-chat-keyboard.png`, the first visible draft line is vertically clipped at the top of the composer. The last draft line, Photos action, and send button remain above the keyboard. The subsequent outgoing-message capture demonstrates the displayed sent result, so this is not evidence that the send action failed.

Check multiline input height, padding, and internal scroll behavior at font scale 1.15. Keep the caret and its complete line visible while retaining the composer actions above the keyboard. A still image does not establish whether scrolling inside the input restores the hidden line; this finding is limited to the captured position.

### F02 — selection success visibility/focus (P2)

In `owner-selection-result.png`, Agreement formed feedback appears after the long offer contents and is partly clipped at the bottom of the scroll viewport. Open Agreement remains fully visible.

On successful selection, reveal a compact success confirmation or move scroll/focus to it without losing the accepted terms. The screenshot supports a visibility issue; it does not prove a keyboard-focus or screen-reader defect. Selection and navigation should not be classified as failed on this evidence.

## Scope and limits

- No device control, backend reads, data mutation, authentication capture, secret access, or XML UI-dump inspection was performed by this reviewer.
- The worker's rating and emulator actions are outside this phone-only batch. Refer to the root execution receipt for interaction claims.
- Static images do not establish animation quality, latency, offline/error recovery, accessibility focus order, screen-reader behavior, or behavior on other sizes/font scales.
- Content partly beyond a normal scroll viewport is not by itself a broken screen. Findings above concern newly relevant success feedback and clipped text within the composer.
- On the closed parent task, Seeking offers describes its original pricing mode alongside an explicit Closed status. This image does not show a task reopening or accepting a new application.
- No full-app acceptance, App Store/Google Play readiness, or server-state verification is implied.

No runtime code was changed and no tests were run for this documentation-only review.
