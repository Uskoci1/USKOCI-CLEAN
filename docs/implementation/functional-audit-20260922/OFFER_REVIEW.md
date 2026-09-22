# Offer review before submission

## User decision and scope

The person checks exactly what this offer contains, then sends it or returns to editing.
This is the client-only review part of approved finding F10 / control B09. The discovery
contract work F06/F07 remains separate; no server filter or pagination change is claimed.

Three compositions considered: an inline expanded form summary (little navigation but easy
to confuse with editing), a short confirmation alert (too little room for a real message/time),
and a dedicated review surface (clear next step, scrollable long content, persistent send).
Choose the dedicated surface using the existing native Modal/pageSheet and SelectionFrame.
The task title and area are compact context; only the offered total is visually prominent.
Reuse Inter, FactArt and the established product components. No new library or illustration.

Matches UX_NACRT sections 5 step 3, 7 and 8, and approved D1/D2: edit -> review -> explicit send;
missing/invalid data never bypasses validation, and uncertain writes retain their original identity.
This adds no new product-policy deviation. The modal has a visible return action and native Back.

## Implementation boundaries

- The initial action is `Pregledaj ponudu`; opening review neither writes the journal nor submits.
- Review shows total for the offered people, people count, actual interval or flexible-time wording,
  and the trimmed message (the same trimming performed by the route). Empty price is ordinary text.
- The existing exact schedule formatter preserves fractional instants and timezone distinctions;
  display formatting does not alter the submitted timestamps.
- Back or Edit returns to the existing draft. A review token binds the task revision and displayed
  draft. Cancellation, draft changes and revision changes invalidate retained confirmation callbacks.
- Confirm closes review, then calls the existing route callback. The route still owns validation,
  immutable payload, account/focus/read fences, durable journaling, readback and same-command retry.
- Pending, uncertain, rejected and confirmed behavior is preserved. Recovery never starts a new
  review or silently creates a different command. No changes in routes, services, auth or server.
- The existing summary footer wraps on narrow screens; the new review uses the system reduced-motion
  preference. The local harness now has an internally consistent dated fixture and permits opening
  review with a no-op submission boundary. It remains disconnected from all accounts and backends.

## Evidence and limits

Four new route-integrated tests fail against predecessor 6d3c7ead: no send/journal on review and Back;
old confirmation after editing; task revision invalidation; flexible time/missing price presentation.
Existing two suites continue to exercise duplicate taps, exact prices, overfill, elapsed deadline,
lost acknowledgements, cold restore, storage failure, account transitions and closed visibility.
The read-suite's closed-search test also invokes the unchanged route guard directly because the
presentation now disables the first review action when the task cannot accept offers.

Final executed results and hashes: OFFER_REVIEW_RECEIPT.json. Browser checks use real components with
local fixtures and cannot prove native keyboard, authenticated API behavior, Android Back or a real
submission. Native acceptance and independent Claude review remain pending while the owner is away.
Post-submit navigation still opens My Applications; named application focus and candidate message
previews are remaining parts of F10. Do not mark the entire finding or screen fully accepted.

Next navigation seam verified in source: the submit route's `openApplications` currently replaces
with `/moje-prijave` after checking current owner, receipt and one-shot navigation. That destination
already accepts `prijavaId` and focuses a matching row only after its owned read arrives. The next
small patch can carry the verified receipt ID through that existing parameter; keep those fences
and prove absent-row, account change and repeated-tap behavior. No such routing change is included
in this package or its APKs.

## Exact-build native acceptance, when the owner is available

1. Install the attested build with replacement, preserving app data. Sign in normally; do not
   transfer another session or change an authentication guard to reach this screen.
2. Open an available task. Compare the review with the entered total, offered people, exact
   time (including the task timezone) and note. Check that Back/Edit preserves every field.
3. Check the native footer and content at the device's normal and large text sizes, including
   a long note and flexible-time task. Verify keyboard dismissal and Android Back separately.
4. On an owner-authorized real offer, send once; verify the stored terms and the same-command
   recovery if the acknowledgement is interrupted. A preview callback is never this evidence.
5. Record APK hash/source, device, task/offer references without personal content, screenshots,
   observed outcome and independent Claude review before changing the Telefon light.
