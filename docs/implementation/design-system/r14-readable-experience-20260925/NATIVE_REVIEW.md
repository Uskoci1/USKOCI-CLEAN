# R14 native review — 25 September 2026

Source `668ca648d5f09be92a17fee4dbc4723f22ba1f2b`, tree `4dd5fe45f72b538c47549687d9ef9ffd3e7b27ea`.
APK run [36144235695](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36144235695) passed. APK SHA256
`75d9c9547a7fe939f309c9bfd31deac8b1eaad64af840ed246f79162e1e9741f` matches both source-bound attestations.
Installed with `adb install -r` on `emulator-5554`, preserving app data. No physical phone was connected.

## Scope and observations

Fifteen image/XML captures were visually reviewed: thirteen inert uses of actual shared presentation components,
and two read-only Discovery/search views. The normal baseline is 1080 x 2424 pixels, density 420, font scale 1.0.
Two photo-recovery views use density 540 (320 dp wide) and font scale 2 solely as a bounded resilience check.
The image manifest records the exact source, image hash, settings and individual observation. Before images are
from installed R13 source `1b018b17eac0c6e77d4acef6a614be93989fad2d`, at ordinary text size.

| Surface | Observed result | Limit |
| --- | --- | --- |
| Agreement list | Clear person/task/logistics/total groups, larger portraits, intact attention/rating action. | Gallery facts; no real selection, rating or sorting journey. |
| Agreement awaiting confirmation | Existing next step and deadline first, accepted terms below, fixed action reachable. | No confirmation or other business mutation. |
| Chat and pending photograph | Name remains in compact normal keyboard header; focused input and controls fit above docked Gboard. Photo recovery uses full width, including the narrow enlarged-text case. | No upload, retry, reconciliation or send performed. |
| Profile and lower groups | Identity/editing, work setup, schedule shortcuts and account/privacy entries readable and reachable. | Inert fixtures; no save, logout, export or closure. |
| Privacy and push settings | Open white groups preserve explicit unavailable-policy state and existing control states. | Not legal, push delivery or service activation evidence. Push copy remains relatively dense. |
| AI conversation | Shared medium typography remains legible with conversation and draft together. | Static existing reply; no paid provider, microphone or voice acceptance. |
| Discovery/search | Real read-only screen shows 8 results, 4 without map points; branded cluster, preview, search and footer controls visible. | No GPS, filter apply, query-scaling or dense-map acceptance. |

## Closed within this bounded UI scope

R11-N02: the pending/reserved/retry-photo explanation no longer breaks into cramped thumbnail-width fragments.
At ordinary size both commands fit together; at 320 dp/font 2 they remain full-width and reachable with the keyboard.
Existing controller/permission/uncertain-outcome guards were not changed. Full Jest includes recovery regressions.

## Carry forward

- **R14-N01:** opening the human-chat keyboard changed visible history to earlier messages. Manual scroll reached
  the latest message/outbox with all commands visible. Preserve the latest-message anchor through keyboard/header
  layout changes when the reader is already at the tail, without dragging someone reading older messages.
- Safety identity/confirmation (R11-N01), long forms (R11-N05), group/support chat (R11-N06), dense maps/GPS and
  screen-reader/motion acceptance remain separate. These fifteen views do not close the whole screen inventory.
- Phone/iOS, current-build real business journeys, AI provider/microphone, payments, push and legal/store gates remain
  in the control table. No phone light was turned green.

## Device restoration and evidence handling

Docked-keyboard checks temporarily disabled Gboard stylus handwriting. Fresh UI XML confirms it was restored to
its original enabled value; `wm density` reports physical 420 with no override and font scale is 1.0. No app data
was cleared. The emulator was returned to an inert app gallery. Real Discovery images/XML stay local; only inert
screenshots are copied into the repository. Screenshots were not retouched or generated.

The control table was regenerated locally. Its original authenticated Claude artifact was opened, but the documented
file chooser timed out and the visible date stayed 2026-09-24 20:26:10 UTC. Remote publication remains unconfirmed.
