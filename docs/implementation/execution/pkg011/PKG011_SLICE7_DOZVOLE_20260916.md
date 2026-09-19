# PKG-011 — Slice 7: permission recovery (owner decision 4)

Date: 2026-09-16. Presentation only; no permission is requested differently, no engine or journal changes. One agent, no subagents.

## What the user gets

- **One recovery block** (`src/ui/system/PermissionRecovery.tsx`): after a denied device permission the user sees the existing plain-language message, a **Podešavanja telefona** action (opens the OS settings) and, where one exists, the named alternative. Nothing re-requests the permission silently and nothing claims it was granted.
- **Mikrofon** (`VoiceComposer`, V5 conversation): when the hold-to-talk controller reports `MIC_PERMISSION_DENIED`, the recovery block replaces the plain error line; typing stays available.
- **Kamera — Fotografije zadatka** (`/fotografije-zadatka`): a denied camera permission shows the recovery block with *Izaberi iz galerije* as the alternative; the choice keeps the same picker path and the same journal.
- **Kamera — fotografije u Porukama** (`AgreementPhotoComposer`): the same block with *Dodaj fotografiju iz galerije*; the hook's message is matched against the exported `PHOTO_PERMISSION_MESSAGE` constant, so the hook itself is untouched.
- **Lokacija Uskočera** (`AgreementLocationScreen`): the controller's existing denial copy ("Dozvolu možete promeniti u podešavanjima telefona.") now comes with the settings action; sharing remains optional and the Agreement continues either way.
- **Obaveštenja**: unchanged — `PushPreferences` already offered the settings action for a denied push permission.

## Proof

- `voice-composer-controls`, `v5-task-photos-screen`, `v5-agreement-current-location-screen`, `agreement-chat-ui`, `agreement-photo-composer`, `ai-conversation-layout`, `worker-ai-conversation-recovery` green; new `pkg011-permission-recovery` (settings action, alternative, swallowed settings failure).
- `tsc` clean; full Jest recorded in the receipt.
