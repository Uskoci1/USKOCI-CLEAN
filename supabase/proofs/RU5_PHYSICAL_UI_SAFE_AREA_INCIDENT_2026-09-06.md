# RU-5 physical Android entry failure: safe-area correction

## Re-admission evidence

Canonical was read at `46ddea1a2688a3026c269c1235026142f0f3921c` and the existing proof branch at `4f5808a5aba95998326722582cacd48141fb1aa4`.
Run `34058248351`, job `101554011749`, completed with failure. The standalone APK build and bundled disposable endpoint check succeeded. The physical journey failed in `open_login_sheet()` before worker authentication. No PR exists for the proof branch at this re-admission.

Artifact `9996915488` (`RU5-PHYSICAL-ANDROID-UI-EVIDENCE`) was downloaded and extracted. It contains `proof.log` and three `AUTH_entry_attempt_*_after.xml` files, but no PNG. No screenshot or completed UI journey is claimed for that run.

The last hierarchy has 199 nodes. The real, enabled `Prijavi se` button has bounds `[763,42][1028,147]`, whose center is `(895,94)`. All three real entry presses leave the auth sheet closed. The legal text has bounds `[63,2292][1017,2338]` while the navigation-bar background starts at y=2274. `ReferenceEntryHero.tsx` positions its topbar at top=0 and bottom actions at bottom=24 without device insets. `auth.tsx` uses a full-screen entry; the root already provides `SafeAreaProvider`.

## Minimal correction and limits

Use the existing `useSafeAreaInsets` API to inset the real topbar and bottom actions. Shift only the final logo target by the corresponding top/left device inset, preserving its flight origin, timing, artwork and callbacks. Zero-inset layout remains unchanged. No auth, navigation, business-RPC or database semantics are modified.

The missing safe-area handling is a source-confirmed layout defect. Whether it accounts for the entire failed press remains a physical-proof hypothesis until the rerun is inspected; the prior timing explanation is not treated as proven.

Add a shell wrapper that executes the original UI driver unchanged and preserves its exact exit status. On failure only, collect a real PNG, UI hierarchy, window/inset dumps and display dimensions. Do not collect environment dumps, Auth tokens or unrestricted logcat. Record run/SHA and proof APK SHA-256 for evidence binding. No direct Auth/RPC, hidden button or synthetic success fallback is introduced.

Four Jest source-contract guards check safe-area wiring and unchanged real callbacks. These are structural guards, not rendered/device proof. The wrapper was separately exercised locally with stub processes: driver exit 0; driver exit 37; and driver exit 37 with diagnostic ADB exit 9. Each returned the original driver status. Bash syntax and workflow YAML parsing passed. Original source and workflow bytes were verified against GitHub blob SHAs before editing.

## Required next evidence

Run the unchanged real W03/W04/W05/W06/R05 journey against disposable Supabase, inspect all 13 required PNG/XML states, business postflight and P0D03 zero-RSD requester activation. Do not merge from source guards or a successful APK build alone.

RU-5 physical proof remains NOT PROVEN until that evidence is reviewed. RU-5 as a whole remains NOT CLOSED / DECISION-REQUIRED for bounded/preselection-note authority. No live Supabase write, migration edit, policy bundle, monetization, HITNO, D0140 production ALLOW, RU-4B public Q&A, Application AI, FASTEST or AUTO_FILL activation is part of this correction.
