# P5 task location — keep an explicit GPS request alive across its own render

2026-09-27. **SOURCE ONLY, UNVERIFIED.** No tests, types, build, device, native permission/location, paid AI, provider, database or proof execution. No visuals, public copy, dependencies or server changes.

## Substantiated defect

`LocationPointEditor.tsx` used the rendered handler's `owns()` callback for the entire asynchronous `captureCurrentLocation` call. That callback requires its captured `rendered` value to equal `renderEpoch.current`. Pressing the existing “Koristi gde sam” control immediately calls `setHere('BUSY')`, causing a new render and advancing that epoch. The request therefore retires itself while the native adapter awaits module loading, permission or a position (`src/data/nativeCurrentLocation.ts:14–81`). Its result is discarded by the same obsolete callback, and the BUSY state can remain. Even replacing only the adapter callback would be insufficient: the old post-await `choose()` also used the obsolete render fence.

## Bounded correction

Only `src/ui/location/LocationPointEditor.tsx` changes. Admission still requires the current rendered handler, but an admitted observation is owned by its specific AbortController, request epoch, account ID/revision, mounted/focused editor and current disabled state. Its own BUSY render no longer changes that ownership. The controller ref also rejects a second press before a render commits.

Another point edit, search, candidate selection, confirmation, blur or disabling the editor retires the observation and clears BUSY. Beginning GPS cancels the previous search intent. A valid current result uses the existing manual-pin setters directly under its request fence; it neither invokes a stale `choose` callback nor confirms/saves a point. Permission denial and unavailable results retain the existing messages. Finalization only releases its own controller, so a late completion cannot clear a newer observation.

The original keyed point/country/scope remount remains. The native adapter and all AI turn journals, location-save commands, review acceptance and photo-upload recovery remain unchanged.

## Connection inspected

- The task conversation exposes photos only for a real writable conversation and blocks navigation during pending AI work (`src/app/(app)/nova.tsx:285–313`). The AI turn journal still owns retry/unknown-outcome recovery.
- `IntakePresentation.tsx:146–166` reads selected photo references from canonical `need.public_photo_paths` and derives the ready-review affordance from required facts, missing map points, safety and pending/error state. It does not infer publication eligibility from GPS.
- `ConversationPointAsk.tsx:80–113` gathers explicitly confirmed points and submits the final set with the canonical location revision. Successful save refreshes the conversation. `needLocationClientService.save` verifies the returned confirmed location against the submitted value.
- The review's manual location proposal remains bound to geography revision and passes through the immutable review before acceptance (`src/app/(app)/pregled-zadatka.tsx:112–138,216–224`).
- The photo route persists command identity before upload, keeps uncertain work recoverable, reads selected assets back and returns to the same conversation. Intake and final review derive photo previews from their canonical fact projections. No additional concrete photo-attachment defect was established in this bounded trace.

## Limits

Source inspection establishes the render-ownership contradiction and checks the corrected intent boundaries. Native permission behavior, obtaining a real position, map placement and the complete conversation → explicit point confirmation → review → selected-photo journey remain unverified. Later authorized verification should include success/denial after the BUSY render, cancellation by another point action, blur/refocus, account A→B→A, disable and stale completion after a newer request. This is one repaired client connection, not P5/provider or full-flow acceptance.
