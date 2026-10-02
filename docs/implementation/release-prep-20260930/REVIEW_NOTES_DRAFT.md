# USKOČI: reviewer notes for Apple App Review and Google Play (draft)

| | |
|---|---|
| Status | **DRAFT for owner review. Not for pasting yet.** Part A lists what must be true first; Part B is the paste-ready text with `[[...]]` placeholders; Part C is the reference walkthrough and evidence. Documentation only: no console, account, device or backend was touched. |
| Date | 2026-09-30 |
| Repository base read | branch `work/uskoci-ui-unification-20260924`, commit `e6490445` (read-only); line numbers are at that commit |
| Live-state caveat | Statements about the DEV backend or the store build (legal registry rows, applied server packages, flags, Edge functions) come from `docs/control/dev_snapshot.json` (generated 2026-09-30T12:01Z, ledger 212, PKG045b applied at ledger 211, P6 rollout v3 applied at ledger 212), `docs/control/master-plan-live-state.json` and the master plan's 2026-09-29 DEV read. **Nothing was re-read live.** Re-check before submission. |
| Master plan links | chapter 18: **APL-08** and **GPL-10** (review access: "dve korisničke namere dostupne reviewer-u"), APL-05 and GPL-04 (deletion), APL-06 and GPL-06 (UGC), BOTH-01 (permission truth); chapter 16.2 LEG-20 |
| Companion files | `STORE_LISTING_DRAFTS.md`, `DATA_DECLARATIONS_DRAFT.md`, `SCREENSHOT_PLAN.md`, `TESTER_SCENARIOS.md` |
| Markers | `OWNER INPUT`, `INFERRED`, `ONLY IF SHIPPED` as in the other files. **No credentials appear in this file or anywhere in the repository**; they go only into the two console fields (master plan LEG-20: "credentials ostaju u konzoli, ne u javnom dokumentu"). |

## 1. Rules that shape these notes (fetched 2026-09-30)

| Store | Rule | Source |
|---|---|---|
| Apple | 2.1(a): include **demo account info** and "turn on your back-end service" if the app has a login. Apple also expects new features to be described with specificity in the Notes for Review (2.3.1(a)). Notes field: 4000 bytes. | [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) |
| Apple | 1.2 UGC needs filtering, a report mechanism with timely responses, blocking, published contact information. 5.1.1(v): in-app account deletion; 5.1.1(i): privacy policy link in the app and in App Store Connect; 5.1.2(i): explicit permission before personal data is shared with third parties **including third-party AI**. 4.8: another login service is not required if the app "exclusively uses your company's own account setup and sign-in systems" (USKOČI uses e-mail and password only). | same |
| Google | **App access**: sign-in details "must be accessible at all times, reusable, and valid regardless of user location", "maintained at all times without any error", and **provided in English**; for 2-step or one-time codes provide reusable credentials that bypass them; "If the provided password expires, we may not be able to review your app and, therefore, the app may be rejected." | [Play app access](https://support.google.com/googleplay/android-developer/answer/15748846) |
| Google | UGC policy: terms accepted before creating UGC, in-app report and block, action on violations. AI-generated content policy: chatbots where interaction is central need in-app report or flag. | [UGC](https://support.google.com/googleplay/android-developer/answer/9876937), [AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936) |
| Both | Consequence for USKOČI: **sign-up needs an e-mail confirmation**, so a reviewer cannot self-register reliably and must be given pre-confirmed accounts. | `src/app/auth.tsx:415` ("Pre prve prijave potrebno je da potvrdiš email.") |

## Part A. Before any of this is pasted: the truth checklist

The reviewer text says things about the app. Each statement must be true on the exact binary and backend that is submitted. Today several are not.

| # | Statement the reviewer text depends on | Today (evidence) | Owner or engineering action |
|---|---|---|---|
| A1 | Three demo accounts exist, are pre-confirmed, reusable, never expire, and hold seeded data | **None exist.** Store row "Pristup za recenzente": NIJE SPREMNO (`docs/control/redovi.json`). A demo account that reviewers may delete must be replaceable, hence account C. | `OWNER INPUT`: create A, B, C; keep credentials in the consoles only |
| A2 | The backend is up and is the environment meant for review | The store build (`eas.json` `production`) points at the canonical DEV/ALPHA Supabase project; no separate production environment exists (master plan 17.1; owner decision open) | `OWNER INPUT`: environment decision; confirm the backend stays live during review |
| A3 | The AI assistant works when a reviewer uses it | Paid provider must be live; there is an internal shared test budget and per-call quota (`legal-drafts-20260930/LEG-11` R-02); **there is no manual way to create a task** (`LEG-12` N-01), so a reviewer who cannot use the AI cannot publish. | `OWNER INPUT`: budget for review; keep the pre-published demo task and agreement (A1) as the fallback for every other flow |
| A4 | Sign-up works: the e-mail arrives and the link opens the app | Control row N02: source passes, real delivery not accepted; the e-mail sender is not defined (`LEG-11` R-08) | `OWNER INPUT`: sender and domain; test on the release build before submission |
| A5 | No placeholder text remains and the legal documents are reachable | The sign-up screen still says "Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog pokretanja." (`src/app/auth.tsx:389`); the legal registry had 0 published documents at the 2026-09-29 DEV read and the in-app screen says they are not published (`LEG-13`; re-check) | publish LEG-02 and LEG-04, change the line (Apple 2.1(a): "placeholder text ... should be scrubbed") |
| A6 | Support and privacy contact information is published | none exists (`LEG-01` OP-10, OP-13, OP-16) | `OWNER INPUT` |
| A7 | Someone handles reports in reasonable time | LEG-14 not started; the only operator in the private test is the project owner (`docs/implementation/v5-ai-first/SUPPORT_CASE_CONTRACT_PROPOSAL.md`) | `OWNER INPUT`: named person and response time |
| A8 | Account deletion is reachable in the app **and** on the web | The closure screen exists but can answer "not available" while rules are unpublished (`src/ui/closure/ClosurePresentation.tsx:175-177`); the web request page does not exist (`LEG-08` section 3) | design and publish the web path; verify closure on the release build |
| A9 | A disclosure and an explicit permission precede the first text AI message | **Neither exists** (`LEG-12` N-01, N-02) | see `DATA_DECLARATIONS_DRAFT.md` section 8; `INFERRED`: the highest-probability iOS review finding |
| A10 | Permission strings match behaviour | the microphone string says the message is sent only on "Pošalji", but the default is to send immediately; iOS also declares a microphone although the voice module is Android-only (`LEG-18` section 2.3, `app.config.js:43`) | correct or remove before the iOS build |
| A11 | Push and voice statements match the binary | store package has no Firebase config; voice messages unshipped | edit the "NOT IN THIS BUILD" and permission lines |
| A12 | No internal entry can be reached | the 16 `dizajn-*` routes answer "Nije dostupno." in store builds (`SCREENSHOT_PLAN.md` section 2) | confirm on the release artefact |
| A13 | Encryption export compliance answer | the app uses HTTPS and WSS only; `ITSAppUsesNonExemptEncryption` is not set in `app.json` (`INFERRED`: App Store Connect will ask at each upload) | `OWNER INPUT` |

## Part B. Paste-ready text

Keep the placeholders visible until each is replaced; delete a line rather than paste something untrue.

### B.1 Apple: Notes for Review (3574 / 4000 bytes, 3560 characters)

Paste into App Store Connect > App Review Information > Notes. Credentials also go into the dedicated sign-in fields there. Headroom before the placeholders are filled: 426 bytes; e-mail addresses, a URL, a contact and the consent description will use most of it, so **re-count after filling** (Serbian letters with diacritics and the middle dots count 2 bytes each).

```text
USKOČI is a Serbian-language marketplace: people post everyday tasks (for example assembling furniture or a small move) and other people offer to do them. One account has both roles: "Objavi zadatak" (post a task) and "Uskoči i zaradi" (find tasks and offer). The interface is Serbian only; English glosses are in brackets.

DEMO ACCOUNTS (backend is live; sign-in needs no e-mail code)
A posts tasks: [[OWNER INPUT: e-mail]] / [[OWNER INPUT: password]]
B offers: [[OWNER INPUT: e-mail]] / [[OWNER INPUT: password]]
C is spare, for testing account deletion: [[OWNER INPUT: e-mail]] / [[OWNER INPUT: password]]
A published task, an offer and an agreement between A and B already exist.

WHERE TO FIND THINGS (bottom tabs: Početna [Home], Zadaci [Tasks], Dogovori [Agreements])
1. Post a task (A): Početna > "Objavi zadatak". Describe the task to the AI assistant, answer its questions, tap "Pregledaj zadatak" [review], check "Ovako će drugi videti zadatak" [how others will see it], tap "Objavi zadatak".
2. Find and offer (B): Zadaci shows a map, a list and a search field. Tap a task > "Sastavi prijavu" [compose application] > "Pregledaj ponudu" > "Pošalji ovu Prijavu" [send].
3. Choose and agree (A): Početna > "Moji zadaci" [my tasks] > task > "Prijave" > "Uporedi prijave" > "Izaberi ovu ponudu" [choose offer]. An agreement ("Dogovor") is created. In Dogovori: "Poruke" [messages, text and photos], "Izmene i otkazivanje Dogovora" [changes, cancellation], "Posao je gotov" [job done], "Potvrdi završetak" [confirm], "Oceni saradnju" [rate].
4. Profile (person icon "Moj profil", top left of every tab): work profile, notification settings, support, privacy, blocked users, account closure.

PERMISSIONS (asked only after a tap; refusing never blocks the app)
- Location, when in use: only for "U blizini" [nearby] on the Zadaci map or "Koristi moju lokaciju" [use my location] when placing a task point. One reading, not stored, never in the background.
- Camera and photos: only when adding a photo to a task, message or profile.
- Notifications: [[ONLY IF SHIPPED: asked when the user turns them on in Profile > "Podešavanja obaveštenja"]].
- Microphone: [[ONLY IF SHIPPED: Android only, hold-to-talk dictation in the AI chat]].

USER-GENERATED CONTENT (1.2)
- Filtering: every task passes a server-side content check before it is published; public questions are reviewed before display.
- Reporting: task "···" > "Prijavi ili blokiraj osobu" [report or block person]; in an agreement "Bezbednost i privatna prijava" [safety and private report]; Profile > "Podrška" [support].
- Blocking: same entries; Profile > "Blokirani korisnici" [blocked users].
- Contact: [[OWNER INPUT: support e-mail or URL]]. Reports are handled by [[OWNER INPUT: who, response time]].

ACCOUNT DELETION (5.1.1(v))
Profile > "Privatnost i podaci" > "Zatvaranje naloga" [close account] > "Pripremi pregled" > "Pokreni zatvaranje naloga" [start]. Open obligations are listed first. Web request page: [[OWNER INPUT: URL]].

AI AND THIRD PARTIES
The assistant only suggests; the user reviews everything before publishing. Text typed to it is processed by a third-party AI service (Google Gemini). [[OWNER INPUT: describe the disclosure and consent shown before the first AI message]].

PAYMENTS
[[OWNER INPUT: confirm before use]] No in-app purchases; the app does not process payments. Price and payment for the work are agreed between the two users.

NOT IN THIS BUILD
[[EDIT AT SUBMISSION: voice messages between users, push notifications, group conversation, data export]].
```

### B.2 Google Play: App access instructions (1130 characters)

Paste into Play Console > App content > App access, declare that access is restricted (the exact option label was not checked in the console) and add the credentials in the fields provided. The text must be in English. `INFERRED`: the instruction box has a length limit (not fetched); this version is kept short, check the console counter.

```text
Sign-in details are entered in the Play Console fields. They are reusable and do not expire; no e-mail code or one-time password is needed.
Account A posts tasks, account B offers, account C is spare (use C to test account deletion).
The app is Serbian only. Tabs: Početna (Home), Zadaci (Tasks), Dogovori (Agreements).
1. Account A: Početna > "Objavi zadatak" (post a task). Describe the task to the AI assistant, tap "Pregledaj zadatak" (review), then "Objavi zadatak".
2. Account B: Zadaci tab (map and list) > tap a task > "Sastavi prijavu" (compose application) > "Pregledaj ponudu" > "Pošalji ovu Prijavu" (send).
3. Account A: Početna > "Moji zadaci" > task > "Prijave" > "Uporedi prijave" > "Izaberi ovu ponudu" (choose offer). An agreement ("Dogovor") is created; use "Poruke" for messages and photos.
4. Report or block: task menu "···" > "Prijavi ili blokiraj osobu"; inside an agreement "Bezbednost i privatna prijava".
5. Delete account: Profile > "Privatnost i podaci" > "Zatvaranje naloga".
A published task, an offer and an agreement between A and B already exist. Location is asked only after tapping "U blizini".
```

## Part C. Reference

### C.1 Reviewer walkthrough by role

| Step | Role and route | What the reviewer taps (Serbian label) | Expected result | Evidence |
|---|---|---|---|---|
| 1 | Sign in, any account (`/auth`) | "Prijavi se", e-mail and password | lands on Početna with two tiles; unauthenticated users never stay in the marketplace shell | `src/app/auth.tsx`; `src/app/_layout.tsx:44` |
| 2 | Requester, `/nova` | Početna > "Objavi zadatak", type a description | the assistant asks follow-ups and fills a compact draft ("Zadatak u nastajanju") | `src/ui/v2/IntakePresentation.tsx:93-100,214-216` |
| 3 | Requester, `/pregled-zadatka` | "Pregledaj zadatak", then "Objavi zadatak" | preview "Ovako će drugi videti zadatak"; note that only an approximate place is public and exact points stay private; publishing lands on the new task in Zadaci | `src/ui/objava/ReviewPresentation.tsx:20,47,117`; `src/app/(app)/_layout.tsx` (publication landing) |
| 4 | Worker, `/zadaci` | Zadaci tab; search field; a pin or a list card | map and list of tasks around; remote tasks under "Na daljinu"; a selected pin shows its card | `src/ui/v2/DiscoveryPresentation.tsx`; `src/ui/v2/discovery/DiscoverySearchPanel.tsx:358-419` |
| 5 | Worker, `/prilike/[id]` and `/prilike/[id]/prijava` | task > "Sastavi prijavu" > "Pregledaj ponudu" > "Pošalji ovu Prijavu" | "Prijava je poslata."; the offer appears in "Moje prijave" | `src/ui/v2/detail/TaskDecision.tsx`; `src/ui/v2/ApplicationComposerPresentation.tsx:113,302,359,447` |
| 6 | Requester, `/potrebe/[id]/kandidati` | "Prijave" > "Uporedi prijave" > "Izaberi ovu ponudu" | "Dogovor je sklopljen." and "Otvori Dogovor" | `src/ui/v2/ApplicationSelectionPresentation.tsx:224,242,311` |
| 7 | Both, `/dogovor/[id]` | overview, "Poruke", "Izmene i otkazivanje Dogovora", "Posao je gotov" (worker), "Potvrdi završetak" (requester), "Oceni saradnju" | accepted terms and next step; text and photo messages; change proposals; completion and ratings | `src/app/dogovor/[id].tsx:374-389,506` |
| 8 | Both, private location | in a Dogovor: "Lokacija i pristup" > "Podeli lokaciju" / "Opozovi deljenje lokacije" | the publisher shares the exact address on purpose; it can be withdrawn | `src/ui/AgreementPrivateLocation.tsx:124-138` |
| 9 | Report and block | task "···" > "Prijavi ili blokiraj osobu"; Dogovor > "Bezbednost i privatna prijava"; Profil > "Blokirani korisnici" | private report with category and reason; block and unblock | `src/ui/v2/PublicNeedPresentation.tsx:74`; `src/ui/safety/SafetyScreen.tsx`; `src/app/(app)/profil/blokirani.tsx` |
| 10 | Support | Profil > "Podrška" > new request | topics such as "Prijava sadržaja ili recenzije", "Privatnost i prava", "Reklamacija na USKOČI uslugu"; status and replies | `src/ui/support/SupportPresentation.tsx:18-25` |
| 11 | Account closure (account C) | Profil > "Privatnost i podaci" > "Zatvaranje naloga" > "Pripremi pregled" > "Pokreni zatvaranje naloga" | obligations first; irreversible start; status via "Proveri stanje zahteva" | `src/ui/closure/ClosurePresentation.tsx:171,202` |

Profile menu (person icon "Moj profil" at the top left of every tab; the bell is at the top right): "Kako mogu da uskočim" (skills, tools and team, work area, availability, calendar), "Nalog i pomoć" (notification settings, support, about), "Privatnost" ("Privatnost i podaci", "Blokirani korisnici", "Izvoz podataka", "Pravila i saglasnosti"), "Odjavi se" (`src/ui/profile/ProfileHubPresentation.tsx:91-124`).

### C.2 Permissions: when the user sees them and what happens on refusal

| Permission | Exact text shown (translated in brackets) | Trigger | If refused | Evidence |
|---|---|---|---|---|
| Location, while in use (Android fine and coarse; iOS `NSLocationWhenInUseUsageDescription`) | "USKOČI koristi jednu lokaciju kada pritisneš „U blizini”, da prikaže mapu zadataka oko tebe." [USKOČI uses one location when you press "Nearby", to show the map of tasks around you.] | tap "U blizini" on Zadaci; "Koristi moju lokaciju" in the point editor | the map is moved by hand or a place is searched; message "Pristup lokaciji nije dozvoljen. Možeš ga dozvoliti u podešavanjima ili upisati mesto iznad." | `app.config.js:9`; `src/ui/v2/discovery/nearbyCapture.ts:49`; `LEG-12` N-07, N-08; no background location, no foreground service |
| Camera | "USKOČI koristi kameru kada želiš da dodaš fotografiju zadatka ili profila." [USKOČI uses the camera when you want to add a task or profile photo.] | adding a photo | photos are optional; a task or profile can be published without one | `app.config.js:42` |
| Photos | "Izaberi fotografiju za svoj zadatak ili profil." [Choose a photo for your task or profile.] | choosing a photo (system picker) | same | `app.config.js:41`; `LEG-18` section 2.3 item 5 |
| Microphone | current string: "Drži mikrofon za razgovor sa USKOČI asistentom. Puštanje završava transkript koji možeš da izmeniš; poruku šalješ tek kada izabereš Pošalji." **It does not match the default behaviour** (release sends the text immediately unless "Pregledaj tekst pre slanja" is on). Proposed replacement in `LEG-12` N-03. | Android only: hold the microphone button in the AI conversation. `ONLY IF SHIPPED` for the release | typing continues to work: "Mikrofon nije dozvoljen. Dozvolu možeš promeniti u podešavanjima telefona ili nastaviti kucanjem." | `app.config.js:43`; `src/features/voice/holdToTalk.ts:24`; iOS has no voice module (`modules/uskoci-voice/expo-module.config.json`), so an iOS microphone declaration should go |
| Notifications | system prompt from `expo-notifications`; approved in-app line: "Na zaključanom ekranu prikazujemo samo da imaš novo obaveštenje. Poruke i privatne lokacije ostaju u aplikaciji." | only when the user turns notifications on in Profil > "Podešavanja obaveštenja"; opening the screen asks nothing | in-app inbox keeps working | `src/data/nativePushDevice.ts:22-30`; `src/ui/notifications/PushPreferences.tsx:188`; `ONLY IF SHIPPED`: no Firebase config for the store package |

Nothing is requested at launch. The app never asks for background location, contacts, calendar or the advertising ID (`LEG-18` section 2).

### C.3 Moderation, reporting, blocking: what exists and what a reviewer may notice

- **Before publication:** every task passes a server-side check with four outcomes (allow, clarify or correct, needs review, cannot be published); only "allow" publishes; HITNO never bypasses it (`legal-drafts-20260930/LEG-05` section 3; `supabase/functions/uskoci-publication-evaluate/index.ts`). The rules are the owner-locked minimum policy `RS-MIN-001..016`, marked "NOT_PRODUCTION_ACTIVATED" for regulated areas (`docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md`). The AI can flag risk but the rule decides.
- **Questions and answers on a task** are reviewed by a classifier (`USKOCI_QA_CLASSIFIER_ENABLED`); the task owner can report a question ("Prijaviti pitanje?", `src/ui/qa/TaskQaPresentation.tsx:44`).
- **Report:** private report with five categories (Uznemiravanje, Prevara, Nebezbedan rad, Diskriminacija, Drugo), a short reason and an optional description; the reported person sees nothing (`src/ui/safety/SafetyScreen.tsx:19,159-160`). "Prijavi problem" inside a Dogovor is a different, visible-to-both problem report (`src/app/dogovor/[id].tsx:414-419`).
- **Block:** block and unblock with an explanation ("Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije."), list in Profil (`src/ui/safety/SafetyScreen.tsx:65-78`).
- **Ratings:** stars and tags only; no free-text review comment exists (`LEG-09` G-10).
- **Gaps a reviewer can find:** no contact information published; no named person handling reports (A6, A7); no terms acceptance before creating content (`LEG-13`); no report or flag control inside the AI conversation (`src/ui/aiFirst/` has none). Fix or disclose before submission.

### C.4 Account deletion (Apple 5.1.1(v), Google account deletion policy)

In the app: Profil > "Privatnost i podaci" > "Zatvaranje naloga" > "Pripremi pregled" (lists obligations: active Dogovori, open tasks, active applications, unfinished processing, retention holds, unconfirmed uploads: `src/data/closureExecutionClientService.ts` `closureBlockerLabels`) > "Pokreni zatvaranje naloga" (irreversible from the app) > "Proveri stanje zahteva". After completion the app shows a confirmation; login data, sessions, unprotected files and ordinary personal data are removed, minimal pseudonymous records and content written by the other party remain (`legal-drafts-20260930/LEG-08` sections 4 to 6). Points to state honestly: (1) the screen can answer "Zatvaranje naloga trenutno nije dostupno. Potpuna pravila zatvaranja i čuvanja još nisu objavljena." until the rules are published; (2) Google needs a web link where deletion can be requested without the app and it does not exist; (3) Apple discourages flows that are "unnecessarily difficult", and the obligations list means a busy account must finish its work first, which is why account C is spare and empty. Sources: [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Google account deletion](https://support.google.com/googleplay/android-developer/answer/13327111), both fetched 2026-09-30.

### C.5 AI and third-party processing (for the notes and the privacy form)

Facts a reviewer may ask about, in the order they are safe to state: the assistant only suggests and a person reviews and publishes; text typed to the assistant, and the task facts collected so far, are processed by a third-party AI service (Google Gemini) through USKOČI's server; task photos may be sent for content review when that switch is on; dictated audio (Android) is streamed for transcription and not stored by USKOČI; address search goes to LocationIQ through USKOČI's server; the map background is loaded from OpenFreeMap; push goes through Expo and Google or Apple when it ships. **Do not state** that the exact address never reaches the AI service: it can (saved private address facts are part of the AI context; two privacy branches are deferred by the owner). Full table: `DATA_DECLARATIONS_DRAFT.md` sections 3 and 8.

### C.6 Payments

Master plan 3.2: launch baseline is a promotional 0 RSD platform price; no wallet, escrow, payout, subscription or paid boost; real money for work goes between the parties. No in-app purchase exists. The store row "Plaćanje" says the charging model for the connection service is undecided. The sentence in B.1 is therefore marked `OWNER INPUT` and must be confirmed against the commercial decision. If a physical service is paid outside the app, Apple 3.1.3(e) applies to any future in-app payment ("purchase methods other than in-app purchase ... such as Apple Pay or traditional credit card entry"); nothing of that kind exists today.

### C.7 What reviewers must not see

The 16 `dizajn-*` routes and their fixture text, the "Ovo je test verzija" line, the build-identity block, any DEV or preview package label, debug banners, and any account other than A, B and C (`SCREENSHOT_PLAN.md` sections 2 and 6).

### C.8 Owner inputs, in the order they unblock things

1. Reviewer accounts A, B, C with seeded data and the decision which environment and "world" they live in (TEST or real, PKG-029e) so A and B see each other's tasks and no real user sees them.
2. Environment decision: promote or create a production backend (master plan 17.1) and keep it live during review.
3. Contact and support URL, privacy URL, deletion URL, named handler for reports (`LEG-01` OP-10 to OP-16; LEG-14).
4. Decision on the AI notice and consent (`LEG-12` N-01, N-02) and on a report or flag control for the assistant.
5. E-mail sender and confirmation flow tested end to end (N02).
6. Whether push, dictation, voice messages, group chat and export are in the first release (edit the "NOT IN THIS BUILD" line and the permission table).
7. Encryption export answer and, if iOS ships, the microphone declaration cleanup.

## D12 note (candidate, NOT applied)

> Added 2026-10-01. The package "D12 written comment with the star rating" is only a candidate in the repository (`supabase/candidates/d12_review_comment.sql`); it is not applied to DEV and needs the owner's explicit decision. Until then every statement above that a review has no free text stays true and this document is unchanged. If the package is applied, the effect on this document is limited to: the line "Ratings: stars and tags only; no free-text review comment exists": it changes only when the package ships. The optional written comment exists while the author's account exists; it is erased when the author account is closed; a comment hidden by moderation and a comment about a person who closed their account are retained (hidden from display); the retention period is an owner/legal input and no number is invented. Lawful basis, DPIA, moderator and response time stay open. Source: `supabase/proofs/d12/README_D12_CANDIDATE.md`.
