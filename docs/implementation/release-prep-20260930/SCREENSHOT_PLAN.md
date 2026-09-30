# USKOČI: store screenshot plan (Google Play and App Store)

| | |
|---|---|
| Status | **PLAN / DRAFT for owner review.** No screenshot was captured, no app, emulator, device or backend was touched. Documentation only. |
| Date | 2026-09-30 |
| Repository base read | branch `work/uskoci-ui-unification-20260924`, commit `e6490445` (read-only); line numbers are at that commit |
| Master plan links | chapter 18: **APL-10** (screenshots and metadata: "stvarni finalni izgled", required formats checked in the console) and **BOTH-02** (listing truth); chapter 16.2 LEG-20 |
| Companion files | `STORE_LISTING_DRAFTS.md` (texts), `DATA_DECLARATIONS_DRAFT.md`, `REVIEW_NOTES_DRAFT.md`, `TESTER_SCENARIOS.md` |
| Language | English framing; captions in Serbian (Latin) and English |

## 1. What the stores require (fetched 2026-09-30)

| Asset | Google Play | App Store |
|---|---|---|
| Screenshot count | up to **8 per device type**; at least **2 across device types** to publish; **at least 4 at 1080 px or more** (16:9 or 9:16) to be eligible for recommendation surfaces that use screenshots | **1 to 10** per device size |
| Format | JPEG or 24-bit PNG, no alpha | `.jpeg`, `.jpg`, `.png`, no alpha or transparency |
| Size, phone | each side between 320 and 3840 px, and **the longer side at most twice the shorter side** (so a raw 20:9 capture such as 1080 x 2400 is **not** accepted; 1080 x 1920 is) | iPhone **6.9-inch**: 1260 x 2736, 1290 x 2796 or 1320 x 2868 (portrait). **6.5-inch** (1284 x 2778 or 1242 x 2688) is required only when 6.9-inch screenshots are not provided. Smaller iPhone sizes are scaled from the larger set if omitted. |
| Tablets | optional; a minimum of 4 is recommended for tablet layouts | **iPad 13-inch** (2064 x 2752 or 2048 x 2732) required only if the app runs on iPad. `app.json` has no `supportsTablet`, so the app is iPhone-only (`INFERRED`: Expo default); decide before the iOS build. |
| Content rules | "Use captured footage of the app itself"; do not show people interacting with the device; taglines "should not take up more than 20% of the image"; no ranking, price or promotion claims in imagery | Guideline **2.3.3** screenshots must show the app in use, "not merely the title art, login page, or splash screen"; **2.3.7** no prices, terms or descriptions that are not specific to the metadata type; **2.3.8** screenshots must suit a **4+** audience even if the app is rated higher; **2.3.10** no names, icons or imagery of **other mobile platforms** |
| Feature graphic / icon | feature graphic **1024 x 500**, JPEG or 24-bit PNG, no alpha, avoid pure white or dark-grey backgrounds; icon **512 x 512**, 32-bit PNG with alpha, at most 1024 KB | icon supplied in the build; no separate upload |
| Video | optional | up to 3 previews, 30 s each, optional |

Sources: [Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151), [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [Apple App Review Guidelines 2.3](https://developer.apple.com/app-store/review/guidelines/), [Apple product page guidance](https://developer.apple.com/app-store/product-page/). Re-check dimensions in the consoles at submission time (master plan 18.1).

**Consequences for this project**

1. **Apple guideline 2.3.10 forbids Android imagery in the App Store listing.** The Apple set must be captured on iOS (simulator or device); Android captures, Android status bars and Google Maps UI cannot be reused. No iOS build exists (bundle id unset), so the Apple set is blocked until then.
2. **Screens are Serbian-only.** The app has no English interface (no localization framework in `package.json` or `src/`). The English listing therefore uses the same Serbian screenshots with English captions; the English description says so (`STORE_LISTING_DRAFTS.md` section 5).
3. **Prices in screenshots:** offers and some task cards carry RSD amounts. Guideline 2.3.7 talks about the app's own pricing in metadata, not in-app content, so amounts inside a task card are `INFERRED` acceptable; keep them ordinary, never highlight them in captions, and prefer tasks that read "Tražim ponude" wherever the screen allows.

## 2. Real flows versus inert galleries

The repository contains **16 internal gallery routes** named `dizajn-*` (`src/app/dizajn-*.tsx`). They draw the real presentation components from **fixture data** so a designer can photograph every state without writing to a server. **They must never appear in store images or be shown to reviewers.**

| Route | What it shows | Gate in code |
|---|---|---|
| `dizajn-pocetna` | Home states | `__DEV__` or package name ending `.dev` (`src/app/dizajn-pocetna.tsx:68`) |
| `dizajn-ai`, `dizajn-ai-mesto` | AI conversation shell, voice mode, place proposal scenes | `__DEV__` / `.dev` (`src/app/dizajn-ai.tsx:74`); **exactly** `rs.uskoci.dev` (`src/app/dizajn-ai-mesto.tsx:34`) |
| `dizajn-objava` | publish review, place, photos | `__DEV__` / `.dev` (`:92`) |
| `dizajn-mapa` | Discovery map fixtures (0, 1, many rows) | exactly `rs.uskoci.dev` (`:72`) |
| `dizajn-kandidati`, `dizajn-prijava`, `dizajn-prijave` | candidates and selection, composing an application and rating, my applications | `__DEV__` / `.dev` |
| `dizajn-dogovori`, `dizajn-dodaci`, `dizajn-kalendar` | Dogovori list, overview and messages; questions, changes, group chat, photo tray; calendar and availability | `__DEV__` / `.dev` |
| `dizajn-obavestenja`, `dizajn-profil`, `dizajn-privatnost` | inbox and notification settings; profile family; privacy, closure, support (fixture words marked "Primer" are placeholders, **never** published legal text) | `__DEV__` / `.dev` |
| `dizajn-tabla`, `dizajn-katalog27` | icon and pictogram board; illustration and motion trial | `__DEV__` / `.dev`; exactly `rs.uskoci.dev` (`src/app/dizajn-katalog27.tsx:11`) |

- In the packages `rs.uskoci` (store) and `rs.uskoci.preview` all 16 routes render only "Nije dostupno." (route comments: "the store package shows nothing"). They still exist in the binary and answer to a `uskociapp://dizajn-...` deep link; final release audit must confirm they are inert (`legal-drafts-20260930/LEG-18` section 6 item 7; master plan 17.2 "isključene DEV galerije/proof ulazi"). `OWNER INPUT`: decide whether to remove them from the release bundle.
- **Fixture text that would embarrass a listing:** "Probni predlog", "Drugi probni predlog", "Primer", scene selector chips, "Nepoznat prikaz galerije".
- Other things that must not appear in any store image: the sign-up line "Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog pokretanja." (`src/app/auth.tsx:389`); the build-identity block in "O aplikaciji" (`src/ui/BuildIdentity.tsx`); any account e-mail, real name, real address, token, or the `DEV` package label.

## 3. Story order and shot list

One story, ten beats: someone posts a task with the AI conversation, another person finds it on the map, offers, they agree and talk, and the app keeps them informed. Every shot is a **real screen from a real flow on a signed-in test account**.

| # | Beat | Screen (route, source) | State to capture | Caption (sr) | Caption (en) |
|---|---|---|---|---|---|
| S01 | One account, two ways in | Home `/` (`src/ui/home/HomePresentation.tsx:196-199`) | tiles "Objavi zadatak" and "Uskoči i zaradi", section "Čeka te" with one real item, "Sledeći Dogovor" | Jedan nalog, dve namere | One account, two ways in |
| S02 | Describe the task | AI conversation `/nova` (`src/ui/v2/IntakePresentation.tsx:214-216`) | two or three exchanges, the assistant asks a follow-up, the compact draft is visible ("Zadatak u nastajanju") | Opiši šta ti treba svojim rečima | Describe what you need in your own words |
| S03 | Review before publishing | `/pregled-zadatka` (`src/ui/objava/ReviewPresentation.tsx:47,117`) | "Ovako će drugi videti zadatak", the "Približno mesto" note, the publish action; **no exact address or private note visible** | Pregledaš sve pre objave | Review everything before it goes live |
| S04 | Map and list | Zadaci `/zadaci` (`src/ui/v2/DiscoveryPresentation.tsx`, `src/ui/v2/discovery/DiscoverySearchBar.tsx`) | two images: (a) map with pins and one selected pin with its card, (b) the list sheet expanded ("FULL"); map attribution visible in both | Zadaci na mapi i u listi | Tasks on a map and in a list |
| S05 | Task detail | `/prilike/[id]` (`src/ui/v2/detail/TaskDecision.tsx`) | photo gallery on top, title, approximate place, time, people, price model, the footer action "Sastavi prijavu" | Sve što ti treba za odluku | Everything you need to decide |
| S06 | Send an offer | `/prilike/[id]/prijava` (`src/ui/v2/ApplicationComposerPresentation.tsx:113,302,447`) | review step "Ovo šalješ": total, people, time, note; action "Pošalji ovu Prijavu" | Predloži cenu, ljude i termin | Propose a price, people and a time |
| S07 | The Agreement | `/dogovor/[id]` overview (`src/app/dogovor/[id].tsx`) | accepted terms, the other person, the task link, the next step card | Prihvaćeni uslovi na jednom mestu | Accepted terms in one place |
| S08 | Talk inside the Agreement | `/dogovor/[id]` "Poruke" (`src/ui/AgreementChat.tsx`) | five to seven short messages including **one photo message**, composer visible, no keyboard covering the last message | Razgovor i fotografije u Dogovoru | Chat and photos inside the Agreement |
| S09 | Stay informed | Obaveštenja `/obavestenja` (`src/app/obavestenja.tsx`) | in-app inbox with three or four real events (new offer, new message), unread state visible; **this is the in-app inbox, not a lock-screen push** | Sve što čeka tebe | Everything waiting for you |
| S10 | Work profile | Profil `/profil` (`src/ui/profile/ProfileHubPresentation.tsx:91-99`) or `/profil/lokacija` | section "Kako mogu da uskočim" (skills, tools and team, work area, availability, calendar), or the work-area map with radius | Radni profil, područje i dostupnost | Work profile, area and availability |

**Optional swap-ins:** the rating screen `/oceni-dogovor` ("Oceni saradnju", `src/app/(app)/oceni-dogovor.tsx`), caption "Završi i oceni saradnju" / "Finish and rate the collaboration".

**Sets per store**

- **Google Play phone set (8, the console maximum):** S02, S03, S04a, S05, S06, S07, S08, S10. Alternative: swap S03 for S09 if the owner prefers the notification beat; S01 and the S04b list image are held back. At least 4 at 1080 px or more keeps recommendation eligibility.
- **App Store 6.9-inch set (10, the maximum):** S01, S02, S03, S04a, S04b (or S04 as one image), S05, S06, S07, S08, S10, with S09 replacing one of S01 or S04b if wanted. **Blocked until an iOS build exists.**
- **Captions:** Serbian on the Serbian listing, English on the English listing, same screens. Each caption is under 40 characters, contains no price, no claim of speed, safety or verification, and covers well under 20% of the image (Google's limit). No device frames are required; if frames are used they must not show people.

**Reviewer-only captures (not for the listing).** Keep these for the review packet in `REVIEW_NOTES_DRAFT.md`: `/bezbednost` (private report and block, `src/ui/safety/SafetyScreen.tsx:65-91`), the report entry on a public profile ("Prijavi ili blokiraj osobu", `src/ui/system/PublicProfileSheet.tsx:20`), the closure screen ("Zatvaranje naloga", `src/ui/closure/ClosurePresentation.tsx`), notification settings, the permission rationale for "U blizini", and the support list.

## 4. Test data and accounts

A store image is only as honest as its data. Everything is fictional, in Serbian, benign (**a 4+ audience**, Apple 2.3.8) and created through the real app, never typed into a fixture.

| Item | Specification |
|---|---|
| Accounts | **A** (person who posts) and **B** (person who offers), optionally **C** (a third candidate for the comparison shot). Create them like a user would, in the same "world" (`OWNER INPUT`: DEV owner accounts belong to the TEST world, PKG-029e; decide which world the capture accounts and tasks live in so B actually sees A's tasks). Names: common Serbian first name plus initial, obviously fictional. Profile photos: none (initial avatars) unless the owner has the rights to a portrait (`OWNER INPUT`). |
| Region | One city centre with recognisable public geography. All task places are **approximate public areas**; no real street numbers, no real apartments anywhere. |
| Tasks (8 to 12 on the map) | Use the examples the community-rules draft lists as ordinarily allowed (`legal-drafts-20260930/LEG-05` section 2): assemble a wardrobe, help with a small move (2 people), wait for a repairman in a flat, wait in a queue, collect a parcel, photograph a room for an advert, walk a dog, carry shopping. One **remote** task ("Na daljinu"). Mix price modes: at most two with a fixed price, the rest "Tražim ponude". No alcohol, tobacco, medication, weapons or adult themes. If the publication check rejects a wording, reword it; do not bypass the check. |
| Photos | Two or three task photos and one chat photo (furniture parts, boxes, a wall); owned by the owner or licensed; no faces, plates, screens with data or street signs. The app re-encodes and strips EXIF on upload (`supabase/functions/_shared/mediaImageSanitizer.mjs`), but never start from a private original. |
| Chat script | Four to six short lines, no phone numbers, no addresses: "Zdravo, da li možeš u subotu oko 10?" / "Može, dolazim sa bušilicom." / "Super, ormar je u hodniku." (photo) / "Vidim, sve jasno. Javim kad krenem." |
| Worker profile (B) | skills "sklapanje nameštaja", tools "bušilica, set alata", team of 1, radius 15 km, availability weekdays evening and Saturday morning. Licences left empty (they are self-declared and shown unverified). |
| Ratings | one completed collaboration with a five-star rating (only if the rating shot is used). |

**How to obtain the data (owner decision).** (a) The real DEV backend with real AI turns: honest but every task needs at least one paid provider call, and there is **no manual task creation path**, so ten tasks mean at least ten conversations (`OWNER INPUT`: the exact provider budget, master plan 21.1: "Tačno odobrenje za provider i obim; pre poziva"). Never bulk-seed the canonical DEV project (runbook P6 item 8). (b) A disposable, seeded staging backend that the release-like build points at: cleaner for map density, needs infrastructure. **Recommended: (b) for S04 (many pins) and (a) for S02 and S03** (they must show a real assistant reply). `INFERRED`: neither has been prepared.

## 5. Capture method

| Item | Google Play | App Store |
|---|---|---|
| Build | the final release candidate installed from the store distribution channel (`rs.uskoci`, signed AAB, e.g. internal test track); drafts may use the `preview` APK (`rs.uskoci.preview`), but **final images come from the final binary** (APL-10, BOTH-02) | signed iOS build via TestFlight; none exists yet |
| Device | a real phone or an emulator profile of **1080 x 1920** so the capture is already 9:16 and needs no crop; a 20:9 device (1080 x 2400) needs a deliberate crop or canvas because of the 2:1 limit. `INFERRED`: the layout was verified mainly on the project's own emulator and phone; check that a 16:9 profile does not change the layout | iPhone 6.9-inch simulator or device, capture at native 1290 x 2796 or 1320 x 2868 |
| System settings | Serbian (Latin) locale, light mode (the app forces `userInterfaceStyle: light`), font scale 1.0, portrait, full battery and signal, no notifications in the shade, clean status bar (Android "demo mode" style; iOS 9:41) | same |
| Network | real connection so map tiles and attribution render fully; no loading spinners or skeletons in the shot | same |
| Editing | crop or scale only; no retouching of UI text; captions in a band under 20% of the height; brand green `#076E4E` and orange `#FA8229` come from `src/ui/system/tokens.ts:43,46` | same |
| Naming | `STORE_ACTION_SNN_locale_device.png` for example `GP_S04a_sr_1080x1920.png` | `AS_S04a_en_1290x2796.png` |
| Storage | keep the originals outside the repository until the owner approves them; commit only approved finals if they are ever versioned (private-content review first) | same |

**Feature graphic (Google, 1024 x 500).** Green `#076E4E` background (not pure white, per Google's guidance), the white USKOČI mark (assets in `assets/brand/`, source noted in `assets/brand/app-icon/provenance.json`) and one line: sr "Objavi zadatak. Nađi zadatak. Dogovori se." / en "Post a task. Find one. Agree terms." No "free", no ranking, no device photo with hands. **Icon (512 x 512):** derive from `assets/brand/app-icon/icon.png` with proportional scale only (owner decision recorded 2026-09-17); it is a white-background canonical mark.

## 6. Redaction and honesty checklist (run on every final image)

1. No real person: names are the fictional personas; no faces; no real phone numbers, e-mail addresses, street numbers, licence plates.
2. No exact address or private access note anywhere (S03 is where it is most likely to slip in).
3. No gallery chrome, fixture words ("Probni", "Primer"), DEV badge, build hash, "Ovo je test verzija", error banner, skeleton, empty state, "Nije dostupno".
4. Map attribution ("OpenStreetMap", "OpenMapTiles", "OpenFreeMap") stays fully visible (`src/ui/location/LocationOverviewMap.types.ts:34-38`), and no Google Maps UI appears in the Apple set.
5. Every feature in an image is in `STORE_LISTING_DRAFTS.md` section 3 as **Core**. No voice-message control, no push lock screen, no group chat, no export or payment screen unless it shipped (**ONLY IF SHIPPED** items may not appear).
6. Content suits a 4+ audience (Apple 2.3.8) and contains no price highlight, no "free", no ranking claim.
7. The image matches the binary submitted for review; a new build that changes a shown screen requires a new capture.

## 7. Readiness (what can be captured today)

| Shot | Depends on | State |
|---|---|---|
| S01 Home | a signed-in account with real attention data (control row A01) | can be captured on any current build; final look after the release candidate |
| S02, S03 AI conversation and review | real provider replies (control rows A02, A06); owner-authorised number of AI turns | **blocked on `OWNER INPUT`** (provider budget); provider quality itself is still open |
| S04 map and list | ten or more published tasks in one region; the P6 bounded reader and the FULL-return behaviour (control rows B04, B05; P6 is open) | **blocked**: capture after the P6 cutover so the image shows the shipped reader, and after the seeding decision in section 4 |
| S05 detail, S06 offer | one published task with photos; B on a second account (rows B06, B09) | can be prepared once S04 data exists |
| S07, S08 Agreement and chat | a chosen offer and a text plus photo message on two accounts (rows A12, D02, D03, D04) | can be prepared; needs both accounts in one session window |
| S09 inbox | a few real events (rows P01, P02) | follows from S06 to S08 |
| S10 work profile | account B with a saved work profile (rows B01 to B03) | can be prepared |
| Rating (optional) | a completed Agreement (rows D10, D11, D12; D10 has no phone evidence) | needs the two-account completion flow |
| **All Apple shots** | an iOS build with a bundle id, signed and installable | **blocked** (no `ios.bundleIdentifier`, no iOS build) |
| Feature graphic, icon | design work only | can start now |

## 8. Owner decisions and inputs

1. **How the capture data is produced** (real DEV with AI turns, or a seeded staging backend) and the **paid AI budget** for S02 and S03.
2. **Which world** (TEST or real) the capture accounts belong to, and how reviewer accounts are classified (same question as in `REVIEW_NOTES_DRAFT.md`).
3. **Portrait and photo rights:** avatars and task photos (owned, licensed or none).
4. **Whether the `dizajn-*` routes stay in the release bundle** (recommended: remove or compile out; today they only answer "Nije dostupno.").
5. **iOS**: is an iOS listing part of the first release? It sets the bundle id, the iPad decision and the whole Apple set.
6. **Story choices:** the Google 8-shot selection (S01 and S09 held back by default) and the optional rating shot.
7. **Tablet screenshots:** none planned (portrait phone app); confirm.
