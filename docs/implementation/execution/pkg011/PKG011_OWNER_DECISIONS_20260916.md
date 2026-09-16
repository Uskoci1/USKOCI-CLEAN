# PKG-011 — Owner decisions (2026-09-16, binding)

Recorded verbatim in substance from the owner's message of 2026-09-16 after review of `PKG011_FLOW_FIRST_RECONCILIATION_20260916.md` §5. These decisions authorize production UI work in PKG-011 and supersede the open items listed there. Verification of the facts each decision assumes was done against the current source on head `687b7d0` and is noted under each item.

## 1. Bottom navigation / center zone

- MENI TREBA: **Zadaci | Mapa | Dogovori**. JA MOGU: **Prijave | Mapa | Dogovori**.
- Map is the main discovery space. No separate "Prilike" tab for JA MOGU if it would duplicate the map. "Prijave" is the worker's personal workspace (what they applied to, status).
- Lifecycle: an open Task is in Zadaci and visible on the Map while it searches for a worker; the requester sees incoming applications in the Task detail; when a worker is selected and an Agreement exists, the subject moves to Dogovori and is no longer an active opportunity on the Map; if the Agreement is cancelled and the Task reopens, it returns to Zadaci and the Map; a completed Agreement stays in Dogovori history and never returns to the Map.
- Do not introduce "Prilike | Mapa | Dogovori" as the main JA MOGU navigation.

Verified against source: `src/app/(app)/_layout.tsx` already renders exactly these three zones per intent (`potrebe`→Zadaci / `moje-prijave`→Prijave, shared `mapa`, shared `dogovori`; `prilike` hidden). `supabaseIzvor.otvorenePrilike` reads only `status in (PUBLISHED, SELECTION)` with `remaining_search_closed_at is null`; `rpc_select_response` moves a fully covered Task to `ACTIVE` (off the Map) and a partially covered one to `SELECTION` (still searching); `CANCEL_AGREEMENT` returns `ACTIVE→SELECTION`; `COMPLETE` sets `COMPLETED`. Existing engine rule to keep in mind (not changed): a Task whose remaining search was explicitly closed by the requester stays off the Map after a cancellation until the requester acts; this is server-owned and outside PKG-011.

## 2. Intent switching

- No silent MENI TREBA ↔ JA MOGU switch via "+", "Moji", inbox/deep-link opening, or entering a specific screen.
- Intent must be clear and stable. If an action needs the other intent, either lead the user through a clear switch/transition, or open the matching context without permanently and silently changing the intent. One account has both; the user must always know which context they are in.

Verified sites of silent switching in source: `src/app/(app)/prilike.tsx` (`onSwitch`/`onNew` call `postaviUlogu('narucilac')` for a worker), `src/app/obavestenja.tsx` (`open` calls `postaviUlogu` from the inbox target role). The pre-auth return-target consumption in `src/app/_layout.tsx` applies the intent the user chose on the entry screen (explicit choice, allowed). `src/app/(app)/profil.tsx` switch is explicit (allowed).

## 3. Candidate comparison and public profile

- In PKG-011 scope **if** existing backend/read models already carry the data. No new engine, no new writer.
- Candidate comparison: presentation over existing candidates/projections, reached naturally from Task detail/Candidates, focused on a fast requester decision.
- Public profile: presentation over existing public profile/reputation data, opened from candidates, application, Agreement or review/reputation contexts.
- Any missing datum → mark as binding gap, do not invent a writer.

Verified read models: `KandidatProjekcija` (price, seats covered/remaining, arrival, transport, rating/review text, note, self-declared proof, proposed start/end, state, `mozeIzabrati`, recommendation reason) via `candidateClientService.prijaveZaPotrebu`; `JavniProfilProjekcija` (name, avatar path, city, title, bio, trust block with availability flags) via `publicProfileClientService.javniProfil` (`rpc_get_public_profile`, RU5). Both surfaces are buildable as presentation only.

## 4. Permissions

- No dedicated permissions screen merely because the old canon lists one. Ask contextually: microphone for voice, location for map/location, photos/camera when picking or taking a photo, notifications when the relevant feature is activated.
- Good denied / retry / settings-recovery UX is required.

Verified: contextual requests exist for microphone (`nativeSpeechAdapter.requestPermission`), location (`nativeCurrentLocation`), camera/library (`nativePhotoPicker`), push (`nativePushDevice`, with "Podešavanja telefona" → `Linking.openSettings` in `PushPreferences`). Denied/retry/settings recovery for microphone, camera and location is a UI-state item to cover in the respective flow rebuilds (no engine change).

## 5. Legacy and Google/Apple auth

- `/pregled-nacrta`: legacy / retirement candidate; do not delete before parity proof.
- `/prijave`: keep as compatibility redirect for old links until confirmed unnecessary.
- Google / Apple auth buttons: **do not hide** them from the final design because they are not connected yet. Status **PENDING_INTEGRATION**: keep them in the auth presentation, connect as soon as technically and legally ready, never let them look functional while the provider is not connected, controlled disabled / "uskoro" behaviour without false success, connect later without redesigning the auth screen.

Verified: `MethodButton` in `src/app/auth.tsx` renders Google/Apple with `unavailable` (disabled, `accessibilityState.disabled`, hint "Ovaj način prijave trenutno nije dostupan.", status text "Trenutno nije dostupno", no `onPress`). This already matches PENDING_INTEGRATION; wording may become "Uskoro" within the owner-locked entry composition.

## General rule

Do not change the verified engine to make the UI look cleaner. If the existing logic works, fit it into a natural flow through presentation/navigation. If a flow is truly illogical, mark a UX/product gap and propose a minimal correction.

**Production UI may start now**, on the basis of these decisions and the completed `CURRENT_SCREEN_BINDING_MASTER_20260916`.
