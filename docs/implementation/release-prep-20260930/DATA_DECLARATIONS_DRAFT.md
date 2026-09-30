# USKOČI: first draft of the Google Play Data safety and Apple App Privacy answers

| | |
|---|---|
| Status | **DRAFT for owner and counsel review. Not for entry into any console.** This is the first working draft of the two not-started legal deliverables LEG-16 (Apple App Privacy) and LEG-17 (Google Data safety), see `docs/implementation/legal-drafts-20260930/README.md`. It is not legal advice and it does not decide any legal basis. |
| Date | 2026-09-30 |
| Repository base read | branch `work/uskoci-ui-unification-20260924`, commit `e6490445`, read-only. The data flows are taken from the existing technical drafts LEG-09 (processing register), LEG-11 (processor/transfer register), LEG-12 (notices), LEG-18 (SDK/permission inventory), which were grounded in code at `fc58f411`, and were spot-checked against this commit where a citation below carries a line number. |
| Live-state caveat | Statements about the DEV backend or the store build (legal registry rows, applied server packages, flags, Edge functions) come from `docs/control/dev_snapshot.json` (generated 2026-09-30T12:01Z, ledger 212, PKG045b applied at ledger 211, P6 rollout v3 applied at ledger 212), `docs/control/master-plan-live-state.json` and the master plan's 2026-09-29 DEV read. **Nothing was re-read live.** Re-check before submission. |
| **PROVISIONAL** | **Every answer that touches AI (text conversations, speech, photo review, question review) is provisional.** The owner deliberately deferred two privacy branches to the final whole-app privacy pass before public release: **AI context minimisation** (`d18e830a`) and **processor-inventory truth** (`1ab01e78`). Both are recorded as NOT INTEGRATED / NOT APPLIED (AGENTS.md "OWNER ORDER UPDATE 2026-09-28"; `docs/implementation/product-v1-closure-20260926/finalization-20260927/BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md`). They can change what reaches the model provider and what the registers say. Re-read section 8 after that pass. |
| Companion files | `STORE_LISTING_DRAFTS.md`, `SCREENSHOT_PLAN.md`, `REVIEW_NOTES_DRAFT.md`, `TESTER_SCENARIOS.md` |
| Language | English framing, Serbian UI labels quoted where they help the reader find the screen. |

## 1. How to read this file

- **Marker legend:** `OWNER INPUT` (only the owner can supply or decide), `UNKNOWN` (the repository cannot answer), `INFERRED` (reasonable, not proven from the repository or a fetched page), `ONLY IF SHIPPED` (applies only if the named feature is in the release binary), `PROVISIONAL` (depends on the deferred privacy pass).
- **Evidence** is a repository path (line numbers at `e6490445` where given) or a register ID: `P-xx` = LEG-09 processing activity, `R-xx` = LEG-11 recipient, `G-xx` = LEG-09 finding, `N-xx` = LEG-12 notice.
- **Nothing here claims a store control is satisfied.** Answers describe what the code does today; several describe gaps that a reviewer can find (section 7 and section 9).
- **Two different definitions are used**, one per store. They are quoted in section 2 because the same data flow can be "not shared" for Google and still be "collected" for Apple.

## 2. Definitions used (fetched 2026-09-30)

| Term | Google Play Data safety ([policy page](https://support.google.com/googleplay/android-developer/answer/10787469)) | Apple App Privacy ([details](https://developer.apple.com/app-store/app-privacy-details/), [manage](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)) |
|---|---|---|
| Collect | Transmitting data off the device, including through libraries and SDKs. | "Transmitting data off the device in a way that allows you and/or your third-party partners to access it for a period longer than what is necessary to service the transmitted request in real time." Data processed only on device is not collected. |
| Share | Transferring collected data to a third party. **Not "sharing":** (1) transfer to a service provider that processes it on behalf of the developer; (2) legal purposes; (3) a transfer based on a specific user-initiated action where the user reasonably expects the data to be shared, **or based on a prominent in-app disclosure and consent**; (4) fully anonymised data. | No separate "share" question: third-party partners' collection is included in the developer's answers ("you must include ... third-party partners whose code you integrate"). |
| Collection exemptions | On-device only; end-to-end encrypted; **ephemeral processing** (accessed in memory for a real-time request, not stored beyond it). | On-device only; a narrow "optional disclosure" exception that needs **all** listed criteria (infrequent, optional, not primary functionality, user affirmatively provides it each time, and more). |
| Per data type | Collected and/or shared; **required** ("users can't turn off this collection") or **optional** ("users can choose"); purposes: app functionality, analytics, developer communications, advertising or marketing, fraud prevention/security/compliance, personalization, account management. | Linked to the user's identity? Used for tracking? Purposes: third-party advertising, developer's advertising or marketing, analytics, product personalization, app functionality, other purposes. |
| Other requirements | Privacy policy link is mandatory to complete the form; encryption-in-transit and deletion questions; a web link for account deletion. | Privacy Policy URL required; you are responsible for keeping answers accurate for each app version. |
| Purpose wording | Google's names as listed. | Apple's names as listed. The definitions of each Apple purpose (for example that "App Functionality" covers authentication, fraud prevention, security and customer support) were **not** in the fetched excerpt: `INFERRED` from memory of Apple's definitions page, verify in App Store Connect. |

## 3. What actually leaves the device

| ID | Flow | What is sent | Trigger and switch | Evidence |
|---|---|---|---|---|
| F-01 | Device to **Supabase** (Auth, Postgres RPC, private Storage, Edge functions) over HTTPS | all account and app data (P-01 to P-26) | always; single backend; the store build points at the URL in `eas.json` `production` env (the canonical DEV/ALPHA project, no separate production environment exists: master plan 17.1) | `src/data/supabaseClient.ts:23-29` (session in `AsyncStorage`); LEG-11 R-01 |
| F-02 | Edge functions `uskoci-ai-interview`, `uskoci-worker-interview` to **Google Gemini API** (text) | up to 30 latest conversation messages (each up to 4000 characters), the current message, all current conversation facts **except** `need.resolved_location`, or the worker-profile candidate (name, description, skills, tools, vehicles, self-declared licences, team capacity, area, availability) | every AI message; requires `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`, `USKOCI_GEMINI_PAID_TEST_ENABLED=true` | LEG-11 R-02; `supabase/functions/uskoci-ai-interview/index.ts:519-529`; **G-01: saved private `need.exact_address` and `need.access_notes` are among the facts** |
| F-03 | `uskoci-qa-classify` to Gemini | public task fields plus question (up to 500) or answer (up to 1000) text; no account id, no private fields, no photos | `USKOCI_QA_CLASSIFIER_ENABLED` | LEG-11 R-02; P-09 |
| F-04 | `uskoci-publication-evaluate` to Gemini | public task fields, photo count, and **up to 6 processed task photos** | photos only with `USKOCI_GEMINI_IMAGE_REVIEW_ENABLED` | LEG-11 R-02; P-08 |
| F-05 | Device to `uskoci-speech-session` to **Gemini Live** (speech to text), **Android only** | transient PCM 16 kHz audio while the mic button is held; text comes back | `USKOCI_GEMINI_PAID_TEST_ENABLED` and `USKOCI_SPEECH_CONTROLLED_TEST_ENABLED`; audio is not stored by USKOČI | LEG-11 R-03; `modules/uskoci-voice/android/.../UskociVoiceModule.kt:16`; P-07 |
| F-06 | `uskoci-location-search` to **LocationIQ** (`eu1`) | typed address or place text (up to 1000) and country code, or exact coordinates for reverse lookup; no name, no token | only when the user searches or asks for the address of a pin | LEG-11 R-06; P-10 |
| F-07 | Device to **OpenFreeMap** (`tiles.openfreemap.org`) directly | map style and tile requests: device IP address and the tiles of the viewed area | every map view | LEG-11 R-07; `src/ui/location/ResolvedPinMap.types.ts:17` |
| F-08 | `uskoci-push-transport` to **Expo Push**, then FCM or APNs | Expo push token, platform, a fixed generic title and body, event kind | `EXPO_PUSH_TRANSPORT_ENABLED`; **the store package `rs.uskoci` has no Firebase configuration**, so push is not configured for the store build: `ONLY IF SHIPPED` | LEG-11 R-04, R-05; `src/data/nativePushDevice.ts:22-30` (permission and token only when the user turns notifications on) |
| F-09 | Supabase Auth to an **email sender** | email address and the message (confirmation, password recovery); the sender is not defined in the repository | registration and recovery | LEG-11 R-08 |
| F-10 | User taps navigation: opens a Google Maps URL | coordinates only, after an explicit tap; never task, account or address text | user-initiated | `src/ui/location/locationMapLinks.ts:8-23` |
| F-11 | On device only | one-shot GPS for "U blizini" (not stored, not sent); session, drafts and command outboxes in `AsyncStorage` | GPS only after a tap | `src/ui/v2/discovery/nearbyCapture.ts:49`; P-13, P-27 |

## 4. Google Play: Data safety draft

### 4.1 Quick view of the draft answers (before the detail)

| Question | Draft answer | Confidence |
|---|---|---|
| Data types to declare as **collected** | Approximate location, Precise location, Name, Email address, User IDs, Address, Other in-app messages, Photos, Other user-generated content (plus Voice or sound recordings, see GS-15, and Device or other IDs if push ships) | medium; several rows carry decisions below |
| Data types **shared** with third parties | **Undecided.** Recommended until counsel confirms processor status and the Gemini paid-service terms: declare the AI flows (F-02 to F-05) as shared with a third party for app functionality and fraud prevention. Supabase, LocationIQ, the email sender and Expo are service-provider transfers (not "sharing") **if** their contracts make them processors (LEG-11: contracts and roles are `[[PROVERITI]]`). | low, `PROVISIONAL` |
| Encryption in transit | Yes (HTTPS and WSS to all endpoints in code) | medium: confirm on the release build (cleartext traffic) |
| Users can request deletion | Yes, in-app closure exists. **The web deletion link that Play requires does not exist** (LEG-08 section 3). | blocked by `OWNER INPUT` |
| Data collected is optional or required | See per row: name and email are required to create an account; photos, exact points, work area and voice are optional | medium |
| Independent security review | No | high |
| Families policy | Not a child-directed app; audience is an owner decision (LEG-19) | `OWNER INPUT` |

### 4.2 Draft answers per data type

Columns: **Coll.** collected; **Shared** with a third party under Google's definition; **Opt.** optional (users can choose) or required; **Purposes** (Google's names); **Del.** can the user have it deleted.

| ID | Google type | Coll. | Shared | Opt. | Purposes | Del. | What the app does (evidence) | Status |
|---|---|---|---|---|---|---|---|---|
| GS-01 | Location: **Approximate location** | Yes | No, except the map-tile provider (decision D-04) | Optional (needed only to publish an on-site task or set a work area; browsing works without) | App functionality, Personalization | Yes (closure) | Public task area (city, municipality, rounded coordinates) chosen by the publisher; worker work-area centre point and radius; personal city on the profile; the viewed public area may be sent in bounded discovery reads (runbook P1 item 9 says to document this honestly). P-03, P-04, P-11, P-12; `docs/implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md` P1 | draft |
| GS-02 | Location: **Precise location** | Yes | No for the counterparty (user-initiated: the publisher shares the exact address inside a Dogovor and can withdraw it). LocationIQ: service provider (decision D-05). Google AI: see D-01 | Optional | App functionality | Yes (closure) | Confirmed exact points and private address and access notes (`need_sensitive`); the device GPS is read once, only after a tap, and only proposes a point that is stored if the user confirms; reverse lookup sends exact coordinates to LocationIQ on an explicit tap. P-10, P-11, P-13; `src/ui/AgreementPrivateLocation.tsx:124-138` ("Podeli lokaciju", "Opozovi deljenje lokacije") | draft |
| GS-03 | Personal info: **Name** | Yes | No (public profile shows the display name to **logged-in** users only, user-to-user display) | Required (sign-up asks first name, last name, city) | App functionality, Account management | Yes | `src/data/authClientService.ts:44-52`; `src/app/auth.tsx:191`; P-01 to P-03 | draft |
| GS-04 | Personal info: **Email address** | Yes | No; email sender is a service provider (D-06) | Required | App functionality, Account management, Fraud prevention, security and compliance (sign-in security) | Yes | `src/app/auth.tsx`; R-08; no marketing use exists (search for "marketing" in `src/` has no hits, LEG-09 P-20) | draft |
| GS-05 | Personal info: **User IDs** | Yes | No | Required | App functionality, Account management | Yes (pseudonymous id can remain: LEG-08 section 6) | account and profile ids; the public profile carries a profile id (P-03). LEG-09 finding G-09 recorded that `public.needs` granted broad SELECT including the requester account id to authenticated clients (an internal exposure, not a third-party transfer). PKG045b (task column privileges, the change meant to remove it) was **applied on canonical DEV on 2026-09-30, ledger 211** (`docs/control/dev_snapshot.json:494`; `docs/control/master-plan-live-state.json:132`); whether the live grants now close the exposure was not re-read here, so make no public statement about it before that read | draft |
| GS-06 | Personal info: **Address** | Yes | Counterparty only after the publisher's explicit share (user-initiated). Google AI: **G-01, saved private address facts can be in AI context** (D-01) | Optional | App functionality | Yes | private address up to 1000 characters and access notes up to 2000 (`need_sensitive`): P-04, P-11 | `PROVISIONAL` |
| GS-07 | Personal info: **Phone number** | **UNKNOWN** | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | No screen in the code collects a phone number (sign-up asks email, password, name, city). The Dogovor screen offers "Podeli svoj broj" (`src/app/dogovor/[id].tsx:481`, RPC `rpc_set_contact_grant` channel `PHONE`); phone sign-in is disabled (AF-D16). Whether any production account has a phone value must be checked in the database (decision D-07) | `UNKNOWN` |
| GS-08 | Personal info: race, religion, politics, sexual orientation, other | No (not requested) | n/a | n/a | n/a | n/a | Free text and photos can contain third-party or sensitive information; this cannot be excluded technically and is a DPIA question (LEG-09 section 4). Recommended: do not declare, document in the policy | draft |
| GS-09 | Financial info | No | n/a | n/a | n/a | n/a | No payment, card or account data; offer prices are task terms. Revisit if PKG051 charging is ever enabled (store row "Plaćanje": NEMA) | draft |
| GS-10 | Health and fitness | No | n/a | n/a | n/a | n/a | not requested; task text may mention it (for example escort to a doctor), LEG-05 section 6 | draft |
| GS-11 | Messages: **Other in-app messages** | Yes | No for user-to-user. **AI conversation text goes to Google (F-02)**: D-01. Question and answer text goes to Google when the classifier is on (F-03) | Chat and questions are optional; the AI conversation is the **only** way to create a task (no manual path, LEG-12 N-01), so for a publisher it is effectively required | App functionality, Fraud prevention, security and compliance (question review, safety and support) | Yes, with exceptions (the other party keeps its copy) | Dogovor chat up to 2000 characters, task questions and answers, support cases, safety report narratives, AI conversations. P-05, P-06, P-09, P-16, P-17, P-21, P-22 | `PROVISIONAL` |
| GS-12 | Messages: emails, SMS or MMS | No | n/a | n/a | n/a | n/a | the app reads no mailbox or SMS | high |
| GS-13 | Photos and videos: **Photos** | Yes | Task photos may go to Google for content review (F-04, switch). No other sharing | Optional | App functionality, Fraud prevention, security and compliance (image review) | Yes (unprotected files are deleted on closure, LEG-08 section 5) | task photos (up to 6), photos in Dogovor messages (up to 6 per message), profile photo; the server re-encodes to JPEG and removes EXIF, GPS, XMP and ICC data (`supabase/functions/_shared/mediaImageSanitizer.mjs`); private Storage. P-08, P-17, P-18; approved notice `src/ui/objava/TaskPhotosPresentation.tsx:86` | `PROVISIONAL` |
| GS-14 | Photos and videos: videos | No | n/a | n/a | n/a | n/a | not supported | high |
| GS-15 | Audio files: **Voice or sound recordings** | **Decision D-02** | **Decision D-02** | Optional | App functionality | n/a (not stored by USKOČI) | Android dictation streams transient audio to Google Live and USKOČI keeps only the resulting text (F-05). Option (a): treat as ephemeral processing, do not declare. Option (b), **recommended until provider retention is confirmed**: declare collected and shared for app functionality, because the approved in-app text itself says (translated from Serbian) that Google may temporarily process data globally for the security of the paid service (`src/features/voice/useHoldToTalk.ts:17`). `ONLY IF SHIPPED`: voice messages between users would be stored in private Storage and must be added | `PROVISIONAL` |
| GS-16 | Audio: music files, other audio | No | n/a | n/a | n/a | n/a | none | high |
| GS-17 | Files and docs | No | n/a | n/a | n/a | n/a | the data-export file is generated for the user; the user uploads no documents | high |
| GS-18 | Calendar | **Decision D-08** | No | n/a | n/a | n/a | The app never reads the device calendar. It stores its own schedule data (availability rules, accepted appointments: P-02). Recommended: do not declare under Google's Calendar type, say so in the policy | `INFERRED` |
| GS-19 | Contacts | No | n/a | n/a | n/a | n/a | no contacts permission (LEG-18 section 2) | high |
| GS-20 | App activity: **App interactions** | No analytics; **decision D-09** for the server audit log | n/a | n/a | n/a | n/a | No analytics, crash or advertising SDK exists in `package.json`, `src/` or `app.config.js` (LEG-18 section 3); the server keeps a business audit log (`marketplace_audit_log`: actor, action, detail) for security and integrity (P-26) | `UNKNOWN` (D-09) |
| GS-21 | App activity: **In-app search history** | **UNKNOWN** | n/a | n/a | n/a | n/a | Today's list filtering may be client-side; the bounded P6 discovery reader sends search text to a server RPC. P6 is open and not cut over. Decide after the reader ships (D-10) | `UNKNOWN` |
| GS-22 | App activity: installed apps | No | n/a | n/a | n/a | n/a | none | high |
| GS-23 | App activity: **Other user-generated content** | Yes | No | Optional | App functionality, Personalization (recommendations to workers use profile and task facts: P-12) | Yes | task titles and descriptions, offers, profile text, ratings and tags (no free-text review comments: G-10), reports | draft |
| GS-24 | App activity: other actions | see GS-20 | n/a | n/a | n/a | n/a | | `UNKNOWN` |
| GS-25 | Web browsing | No | n/a | n/a | n/a | n/a | legal documents open in the system browser; nothing is collected | high |
| GS-26 | App info and performance: crash logs, diagnostics, other | No | n/a | n/a | n/a | n/a | No crash or analytics SDK; Firebase Analytics is switched off in preview builds and the store package has no Firebase config. Server-side function logs exist but are written not to contain content (LEG-11 R-01 controls); platform logs on the Supabase side are `[[PROVERITI]]`. Play Console vitals are collected by Google, not declared by the developer | `INFERRED` |
| GS-27 | **Device or other IDs** | `ONLY IF SHIPPED` | Expo push service (service provider) | Optional (user turns notifications on) | App functionality | Yes (registration revoked on sign-out or closure, P-20) | Expo push token and platform, `src/data/nativePushDevice.ts:22-30`. Not collected while push is not configured for the store package | `ONLY IF SHIPPED` |

### 4.3 Data handling questions

| Question | Draft answer | Evidence and open point |
|---|---|---|
| Is all user data encrypted in transit? | Yes | HTTPS for Supabase (`eas.json`), OpenFreeMap (`src/ui/location/ResolvedPinMap.types.ts:17`), LocationIQ (via Edge), WSS for speech (`supabase/functions/uskoci-speech-session/index.ts:80`), Expo push. `[[PROVERITI]]` in the merged release manifest that cleartext traffic is not allowed. |
| Can users request that data is deleted? | Yes, **but** Play also requires a web link where deletion can be requested without the app, and none exists: LEG-08 section 3 is a design task (who handles it, how identity is checked). The in-app closure screen can also answer "not available" (`CLOSURE_POLICY_NOT_READY`, `src/ui/closure/ClosurePresentation.tsx:175-177`) while the closure and retention rules are unpublished. | `OWNER INPUT` (web resource, retention exceptions disclosed to users) |
| Independent security review | No | high |
| Families policy | The app is not designed for children; there is no age gate (LEG-09 G-03) | `OWNER INPUT` (audience, LEG-19) |

### 4.4 Other Play "App content" declarations touched by this data map

| Declaration | Expected answer | Note |
|---|---|---|
| Ads | No ads | no advertising SDK |
| Advertising ID | Not used | `[[PROVERITI]]` that the merged manifest does not contain `com.google.android.gms.permission.AD_ID` |
| Financial features | None | no payments, loans or wallets in V1 |
| Health apps, news apps, government apps | Not applicable | |
| Location permissions | Foreground fine and coarse location only; no background location, no foreground service | `app.config.js` (`isAndroidBackgroundLocationEnabled: false`, `isAndroidForegroundServiceEnabled: false`) |
| Photo and video permissions | Photo choice goes through the system picker; `[[PROVERITI]]` in the release manifest that no `READ_MEDIA_*` or `READ_EXTERNAL_STORAGE` permission is present | LEG-18 section 2.3 item 5; Google's photo and video minimum-scope rule (GPL-07) |
| App access for review | Login required, two roles: see `REVIEW_NOTES_DRAFT.md` | `OWNER INPUT` (accounts) |

## 5. Apple: App Privacy draft

Apple does not ask "shared". Everything the app or a third-party partner keeps for longer than the real-time request counts as collected. Almost every item is **linked to the user's identity** because it belongs to a signed-in account. **Tracking:** none; there is no advertising or analytics SDK, no App Tracking Transparency prompt, and no data is combined with third-party data for advertising (LEG-18 section 3). Answer "Data Used to Track You: none" and confirm against the privacy manifest of the signed IPA (`[[PROVERITI]]`, LEG-18 section 6).

| ID | Apple data type | Collected | Linked to identity | Tracking | Purposes | Notes and evidence |
|---|---|---|---|---|---|---|
| AP-01 | Contact Info: **Name** | Yes | Yes | No | App Functionality | GS-03 |
| AP-02 | Contact Info: **Email Address** | Yes | Yes | No | App Functionality | GS-04 |
| AP-03 | Contact Info: **Phone Number** | **UNKNOWN** | | No | | GS-07, decision D-07 |
| AP-04 | Contact Info: **Physical Address** | Yes | Yes | No | App Functionality | private address and access notes, GS-06 |
| AP-05 | Contact Info: other user contact info | No | | | | |
| AP-06 | Location: **Precise Location** | Yes | Yes | No | App Functionality, Product Personalization | confirmed exact points and reverse lookup (GS-02); the one-shot GPS for "U blizini" is on-device only and is not collected |
| AP-07 | Location: **Coarse Location** | Yes | Yes | No | App Functionality, Product Personalization | public task area, work area, personal city (GS-01); the map provider sees IP and viewed tiles (decision D-04) |
| AP-08 | Sensitive Info | No (not requested) | | | | free text may contain it, GS-08 |
| AP-09 | Contacts | No | | | | |
| AP-10 | User Content: **Emails or Text Messages** | Yes | Yes | No | App Functionality | in-app chat and AI conversations (GS-11); **PROVISIONAL**: AI text reaches Google |
| AP-11 | User Content: **Photos or Videos** | Yes | Yes | No | App Functionality | GS-13; task photos may reach Google for review |
| AP-12 | User Content: **Audio Data** | **Decision D-02** | Yes if declared | No | App Functionality | dictation audio streams to Google Live and is not stored by USKOČI; stored voice messages `ONLY IF SHIPPED` |
| AP-13 | User Content: **Customer Support** | Yes | Yes | No | App Functionality | support cases and safety reports (P-21, P-22). Apple's "optional disclosure" exception needs every criterion (including that the user affirmatively provides the data each time and the name is shown in the form); declare it instead of relying on the exception |
| AP-14 | User Content: **Other User Content** | Yes | Yes | No | App Functionality, Product Personalization | tasks, offers, profile text, ratings and tags (GS-23) |
| AP-15 | Browsing History | No | | | | |
| AP-16 | Search History | **UNKNOWN** | | | | GS-21, decision D-10 (server search text after the P6 cutover) |
| AP-17 | Identifiers: **User ID** | Yes | Yes | No | App Functionality | GS-05 |
| AP-18 | Identifiers: **Device ID** | `ONLY IF SHIPPED` | Yes | No | App Functionality | Expo push token; `INFERRED` that Apple's "Device ID" covers a push token, confirm when push ships |
| AP-19 | Purchases, Financial Info, Health and Fitness, Surroundings, Body | No | | | | none |
| AP-20 | Usage Data: Product Interaction, Advertising Data, Other Usage Data | No analytics; **decision D-09** for the server audit log | | | | GS-20 |
| AP-21 | Diagnostics: Crash Data, Performance Data, Other | No | | | | GS-26 |
| AP-22 | Other Data Types | No | | | | |

**Also required by Apple, not part of this table:** an accessible in-app link to the privacy policy (guideline 5.1.1(i)), in-app account deletion (5.1.1(v)) and explicit permission before personal data is shared with **third-party AI** (5.1.2(i)). See sections 7 and 8.

## 6. SDK and partner list behind the answers

| Component | What it does with data | Declared where |
|---|---|---|
| `@supabase/supabase-js` 2.112.4 | talks to the developer's own Supabase backend; session in `AsyncStorage` | F-01, GS-03 to GS-27 |
| `@maplibre/maplibre-react-native` 11.3.10 | renders the map; loads style and tiles from OpenFreeMap | F-07, decision D-04 |
| `expo-location` 57.0.20 | one foreground reading after a tap, nothing stored or sent | F-11 |
| `expo-notifications` 57.0.15 | permission, channel, Expo push token | F-08, `ONLY IF SHIPPED` |
| `expo-image-picker` 57.0.17, `expo-image-manipulator` 57.0.17 | pick or capture a photo, prepare it; upload goes to `uskoci-media` | GS-13 |
| `expo-web-browser`, `expo-linking` | open documents and links the user chooses | GS-25 |
| Native module `UskociVoice` (Kotlin, Android only) | captures PCM while the button is held; audio goes to `uskoci-speech-session` | F-05, GS-15 |
| Firebase Messaging / Analytics | Analytics and auto-init are disabled in preview builds; the store package has no Firebase config | GS-26, GS-27 |
| Server-side third parties (not SDKs): Google Gemini and Gemini Live, LocationIQ, Expo Push with FCM and APNs, an email sender | see F-02 to F-09 and LEG-11 | GS-02, GS-11, GS-13, GS-15, GS-27 |

Source: LEG-18 section 3 (inventory at `fc58f411`). No analytics, error-tracking, advertising or attribution SDK was found by keyword search of `src/`, `package.json` and `app.config.js` (Sentry, Crashlytics, analytics, Amplitude, Mixpanel, Segment, Bugsnag, Datadog): `[[PROVERITI]]` on the merged release artefact.

## 7. User-generated content: moderation, reporting, blocking

Both stores treat the app as one with user-generated content (task text, photos, questions, offers, messages, ratings). What exists, with gaps a reviewer can see:

| Requirement (source) | What the app has | Gap or open point |
|---|---|---|
| Filter objectionable material before it is posted (Apple 1.2 [guidelines](https://developer.apple.com/app-store/review/guidelines/)) | Every task passes a server-side publication check with four outcomes (allow, clarify, review, cannot publish); AI can flag risk but the rule decides (`supabase/functions/uskoci-publication-evaluate/index.ts`; LEG-05 section 3; policy `RS-MIN-001..016`); public questions and answers can be classified before display (`USKOCI_QA_CLASSIFIER_ENABLED`) | The owner-locked policy is a **minimum** and "NOT_PRODUCTION_ACTIVATED" for regulated categories (`docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md`); a keyword search of `supabase/functions` and `supabase/migrations` (moderat, objectionable, profan, vulgar, blocklist) found no filter on chat messages or profile text: only task publication and question/answer review are covered |
| In-app report of content and users with timely responses (Apple 1.2; Google UGC policy) | Private report from a person with five categories (`src/ui/safety/SafetyScreen.tsx:19`), "Prijavi problem" inside a Dogovor (visible to both sides), support topics including "Prijava sadržaja ili recenzije" (`src/ui/support/SupportPresentation.tsx:18-25`) | **Nobody is assigned to handle reports operationally** (LEG-14 not started; support operator is the project owner in the private test, `docs/implementation/v5-ai-first/SUPPORT_CASE_CONTRACT_PROPOSAL.md`). A report button without an owner is not finished operations (master plan 17.3). |
| Block abusive users (Apple 1.2; Google: "in-app functionality for blocking users") | Block and unblock, list of blocked users (`src/ui/safety/SafetyScreen.tsx:65-91`, `src/app/(app)/profil/blokirani.tsx`) | consequences for existing Dogovori are a server rule (control row N06, partial) |
| Published contact information (Apple 1.2) | none published | `OWNER INPUT`: LEG-01 OP-10, OP-13, OP-16 |
| Require acceptance of terms before creating UGC (Google UGC policy [page](https://support.google.com/googleplay/android-developer/answer/9876937)) | **No.** Acceptance is required by no command; sign-up shows only "Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog pokretanja." (`src/app/auth.tsx:389`); the legal registry had 0 published documents at the 2026-09-29 DEV read (LEG-13; re-check) | `OWNER INPUT` (when acceptance is asked, LEG-13 section 5) and legal publication |
| AI-generated content: in-app report or flag (Google [AI-generated content policy](https://support.google.com/googleplay/android-developer/answer/13985936), fetched 2026-09-30: applies to "text-to-text conversational generative AI chatbots, in which interacting with the chatbot is a central feature") | The AI assistant conversation has **no report or flag control** (no report action in `src/ui/aiFirst/`) | `INFERRED` that the policy covers the task and worker interviews; the owner should decide whether a flag control is needed before Play submission |

## 8. AI-related answers (PROVISIONAL) and the third-party-AI rule

**What reaches the model provider today** is listed in F-02 to F-05. Two facts matter for the declarations:

1. **Private address and access notes can be in the AI context.** The step "Mesto zadatka" writes them as confirmed conversation facts, and every later AI message in that conversation carries them (LEG-09 G-01; LEG-11 R-02). The branch that would remove this (`d18e830a`) is deferred and, even when integrated, does not filter text the user types in the current message. Consequently **no store text, privacy text or reviewer note may say the exact address never reaches the AI provider.**
2. **There is no notice and no consent before the first text AI message** (LEG-12 N-01, N-02: "ne postoji"), and there is no manual way to create a task without AI. The only related approved texts are the voice notice (`src/features/voice/useHoldToTalk.ts:17`) and the task-photo notice (`src/ui/objava/TaskPhotosPresentation.tsx:86`).

**Why it matters for the stores (fetched 2026-09-30):**

- Apple guideline **5.1.2(i)** now says an app must "clearly disclose where personal data will be shared with third parties, including with third-party AI, and obtain explicit permission before doing so" ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). With today's app, the iOS review is likely to challenge the text AI conversations unless the LEG-12 notice, with an explicit action, exists. `INFERRED`: this is the highest-probability review finding in this file.
- Google's Data safety page treats a transfer as **not sharing** when it happens "based on a prominent in-app disclosure and consent" or as a user-initiated transfer the user reasonably expects, and when a service provider processes on the developer's behalf. Adding the N-01 notice with a clear accept step would therefore also make the Google answer easier to defend.
- The approved in-app texts say (translated from Serbian) that Google may temporarily process data globally for the security of the paid service and that processing may be outside Europe (`src/features/voice/useHoldToTalk.ts:17`, `src/ui/objava/TaskPhotosPresentation.tsx:86`): the data map must not claim EU-only processing (LEG-11 section 5).

**Recommended provisional declarations** (revisit after the privacy pass): declare text, photos and, if you choose option (b), audio as sent to a third-party AI provider for app functionality and for fraud prevention/security/compliance; keep "Data used for tracking: none" for Apple; state in the privacy policy that the AI only suggests and that people decide (LEG-09 section 4: no fully automated decision with legal effect).

## 9. Unknowns and owner decisions that block final answers

| ID | Decision or unknown | Why it matters | Where it is used |
|---|---|---|---|
| D-01 | Is Google (Gemini, paid) a service provider acting for USKOČI, and do the paid terms exclude model training and limit retention? Which legal entity accepted the terms? | decides "shared" or "not shared" for GS-02, GS-06, GS-11, GS-13 | LEG-11 R-02 (`[[PROVERITI]]`) |
| D-02 | Voice dictation audio: treat as ephemeral (not declared) or declare as collected and shared | GS-15, AP-12 | section 4.2 GS-15 |
| D-03 | Ship the AI notice with an explicit accept action (LEG-12 N-01, N-02), or keep AI as the only path without consent | Apple 5.1.2(i), Google sharing exemption, legal basis of AI processing | section 8 |
| D-04 | Declare the map-tile provider (OpenFreeMap sees IP and viewed tiles) or treat it as out of scope; keep the public service or move to a contracted provider | GS-01, AP-07 | LEG-11 R-07 |
| D-05 | LocationIQ role and contract (service provider or not), retention and caching at the provider | GS-02 | LEG-11 R-06 |
| D-06 | Which email sender is used for Auth mail and what is its contract | GS-04 | LEG-11 R-08, LEG-01 OP-43 |
| D-07 | Does any production account hold a phone number, and what does `rpc_set_contact_grant(PHONE)` share | GS-07, AP-03 | `supabase/migrations/20260830072818_clean_scoped_contact_reveal.sql` |
| D-08 | Calendar type: not declared (recommended) or declared | GS-18 | policy wording |
| D-09 | Is the server audit log declared as "App interactions" or "Other actions" (Google) and "Product Interaction" (Apple) | GS-20, AP-20 | P-26 |
| D-10 | Will the P6 discovery reader send free-text search to the server, and is it stored or logged | GS-21, AP-16 | P6 cutover |
| D-11 | Is push in the first store release (needs Firebase config for `rs.uskoci`, APNs for iOS) | GS-27, AP-18 | LEG-11 R-05 |
| D-12 | Are voice messages between users in the first release | GS-15, AP-12 | `docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md` |
| D-13 | Retention periods and deletion exceptions to disclose (12 open decisions), the web deletion resource, and whether closure works without published rules | Play "data deletion" questions, Apple 5.1.1(v) | LEG-10, LEG-08 |
| D-14 | Public audience and age (18+ or not) and the age-rating answers | Play target audience, Apple age rating | LEG-19 |
| D-15 | Final privacy pass: integrate `d18e830a` and `1ab01e78`, then re-read section 8 and re-run the inventories | all `PROVISIONAL` rows | AGENTS.md owner order 2026-09-28 |
| D-16 | Audit the signed AAB and IPA: merged manifest (permissions, cleartext, AD_ID), privacy manifest, required-reason APIs, SDK licences | confirms GS-26, section 4.4, AP-21 | LEG-18 section 6 |

## 10. Cross-reference to the processing register (LEG-09)

| Register row | Declared in |
|---|---|
| P-01 registration and session | GS-03 to GS-05; AP-01, AP-02, AP-17 |
| P-02, P-03 profiles | GS-01, GS-03, GS-23; AP-07, AP-14 |
| P-04, P-11 task and private location | GS-01, GS-02, GS-06; AP-04, AP-06, AP-07 |
| P-05, P-06 AI conversations | GS-11; AP-10 (`PROVISIONAL`) |
| P-07 dictation | GS-15; AP-12 (D-02) |
| P-08 pre-publication check | GS-13 (`PROVISIONAL`) |
| P-09 questions and answers | GS-11 |
| P-10 address search | GS-02 (D-05) |
| P-12 recommendations | GS-01, GS-23 (Personalization) |
| P-13 "U blizini" GPS | not collected (on device) |
| P-14 map background | GS-01, AP-07 (D-04) |
| P-15, P-16 offers and Dogovor | GS-23, GS-11 |
| P-17, P-18 messages and photos | GS-11, GS-13; AP-10, AP-11 |
| P-19 ratings | GS-23; AP-14 |
| P-20 notifications and push | GS-27; AP-18 (`ONLY IF SHIPPED`) |
| P-21, P-22 reports and support | GS-11; AP-13 |
| P-23 legal acceptance | not applicable until documents are published |
| P-24, P-25 export and closure | section 4.3 (deletion), decision D-13 |
| P-26 audit and command keys | GS-20, AP-20 (D-09) |
| P-27 local storage | not collected (on device) |
| P-28 hosting, backups, platform logs | `UNKNOWN` (`[[PROVERITI]]`, LEG-09) |
