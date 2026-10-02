# USKOČI: store listing drafts (Google Play and App Store)

| | |
|---|---|
| Status | **DRAFT for owner review. Not for submission.** Documentation only: nothing here was entered in Play Console or App Store Connect, and no source, server, control-tracker or P6 file was touched. |
| Date | 2026-09-30 |
| Repository base read | branch `work/uskoci-ui-unification-20260924`, commit `e6490445` (read-only). Line numbers below are at that commit. |
| Live-state caveat | Statements about the DEV backend or the store build (legal registry rows, applied server packages, flags, Edge functions) come from `docs/control/dev_snapshot.json` (generated 2026-09-30T12:01Z, ledger 212, PKG045b applied at ledger 211, P6 rollout v3 applied at ledger 212), `docs/control/master-plan-live-state.json` and the master plan's 2026-09-29 DEV read. **Nothing was re-read live.** Re-check before submission. |
| Master plan links | chapter 3 (V1 scope), chapter 18 (Apple/Google controls: APL-10, GPL-13, BOTH-02), chapter 16.2 LEG-20 (store package) |
| Companion files | `DATA_DECLARATIONS_DRAFT.md`, `SCREENSHOT_PLAN.md`, `REVIEW_NOTES_DRAFT.md`, `TESTER_SCENARIOS.md` (same folder) and the legal technical drafts in `docs/implementation/legal-drafts-20260930/` |
| Languages | Framing text is English. The store texts are given in **Serbian (Latin script, "ti" form)** and **English**. |

## 1. Rules applied to every sentence in this file

1. **Only features that exist in the repository and belong to V1** appear in the base texts (section 3 lists the evidence path for each). Anything still open (voice messages, push, iOS, group chat, data export) sits in the clearly marked **ONLY IF SHIPPED** block (section 8) and is *not* part of the base texts.
2. **No prices, no payment claims.** The launch baseline is 0 RSD and the payment/monetisation model is undecided (`docs/control/redovi.json`, store row "Plaćanje": NEMA; master plan 3.2). The texts therefore do not say "free", "no fees", "secure payment" or similar. See section 9.
3. **No claims the product cannot prove:** no "verified", "secure", "insured", "safe workers", no ratings or user counts, no awards, no "instant" matching, no "AI never sees your address" (the deferred privacy branches are not integrated: `docs/implementation/legal-drafts-20260930/LEG-09_processing_register.md` finding G-01).
4. **No legal text.** The AI line in the descriptions is a factual disclosure placeholder, to be worded together with counsel (LEG-12 N-01 proposes the in-app notice; that proposal is unapproved).
5. Terminology follows the app: task = **zadatak**, agreement = **Dogovor**, offer/application = **prijava / ponuda**, tabs **Početna | Zadaci | Dogovori** (`src/app/(app)/_layout.tsx`, `src/ui/home/HomePresentation.tsx`).
6. Markers used: `OWNER INPUT` (only the owner can supply or decide), `INFERRED` (reasonable but not proven from the repository or a fetched page), `ONLY IF SHIPPED`.
7. Character counts are computed by script, not typed: **Unicode characters, a line break counts as 1**. Both stores may count slightly differently at the edges (for example emoji or combined characters), so keep a margin. The Apple keyword field is also reported in UTF-8 bytes because Apple's own pages disagree on "characters" versus "bytes" (section 2).

## 2. Store field limits, checked on 2026-09-30

| Field | Google Play | App Store | Source |
|---|---|---|---|
| App name / title | 30 characters | 30 characters | [Play: create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152) · [Apple: product page](https://developer.apple.com/app-store/product-page/) |
| Short description / subtitle | 80 characters | subtitle 30 characters | same two pages |
| Full description | 4000 characters | 4000 characters (plain text, no HTML) | same; Apple [platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) |
| Promotional text | n/a | 170 characters (does not affect search ranking) | Apple product page; platform version information |
| Keywords | n/a (Play has up to 5 tags, see section 7) | 100 characters per the product-page guide; 100 **bytes** per the platform-version reference. Comma-separated, no spaces after commas. | Apple product page; platform version information |
| What's new / release notes | 500 Unicode characters per language | 4000 characters, only for updates (not for the first version) | [Play: prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348) · platform version information |
| Review notes | n/a (Play uses the "App access" declaration) | 4000 bytes | platform version information |
| Contact / URLs | contact **email required**, website recommended, phone optional; privacy policy link needed to complete Data safety | **Support URL required** (must lead to real contact information), Privacy Policy URL required, Marketing URL optional, Copyright (year + entity) required | Play answer 9859152 and [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469) · platform version information · [required properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties) |
| Metadata rules | no emoji or emoticons, no repeated special characters, avoid ALL CAPS unless brand name, no rankings or performance claims, no calls to action such as "download now", no unattributed testimonials, no price or promotion claims, no competitor references | avoid prices in the description; do not use trademarked terms, competitor names, category names or the word "app" in keywords; do not repeat words already in name/subtitle | [Play metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842) and [asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151) · Apple product page |
| Store languages | "Serbian - sr" and "Croatian - hr" are supported; the table does not distinguish Latin from Cyrillic script | **Serbian is not in the App Store Connect localization list** (Croatian is; Bosnian is not) | [Play supported languages](https://support.google.com/googleplay/android-developer/table/4419860) · [Apple localizations](https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations) |

Every page above was fetched on 2026-09-30. Store consoles change; re-check the field limits inside the consoles at submission time (master plan 18.1: "Neposredno pred submit proveriti važeće zvanične uslove").

**Consequence for the App Store (surprising finding):** the app is Serbian-language, but App Store Connect does not offer Serbian for the product page. Section 5 therefore gives English as the recommended primary language and keeps the Serbian text as an alternative source. This needs an owner decision (section 11, item 2).

## 3. What the listing may claim: evidence per feature

"Phone evidence" is the state recorded in `docs/control/redovi.json` (field `telefon.stanje`) at the base commit; it is context, not an acceptance verdict. "None" means no phone evidence is recorded.

| # | Feature | Listing treatment | Repository evidence | Control row / phone evidence |
|---|---|---|---|---|
| 1 | One account, two intentions: **Objavi zadatak** and **Uskoči i zaradi** | Core | `src/ui/entry/EntryWelcome.tsx:88-110`; `src/ui/home/HomePresentation.tsx:196-199`; owner decision 1, 2026-09-19 (AGENTS.md) | A01 partial |
| 2 | AI conversation that turns a description into a task draft, with review before publishing ("Reci šta ti treba.", "Pregledaj zadatak", "Ovako će drugi videti zadatak") | Core, with the AI line | `src/ui/v2/IntakePresentation.tsx:65,71,214-216`; `src/ui/objava/ReviewPresentation.tsx:20,47,238` | A02, A06 partial; provider quality still open |
| 3 | Map and list of tasks, search groups Gde / Kada / Kako se radi / Koliko vas dolazi / Cena, remote tasks ("Na daljinu"), "U blizini" | Core | `src/ui/v2/discovery/DiscoverySearchPanel.tsx:358-419`; `src/ui/v2/DiscoveryPresentation.tsx` | B04, B05 partial; P6 (bounded reader) is **open**, native acceptance pending |
| 4 | Task detail with facts, photos, questions before an offer, public profile of the publisher | Core | `src/ui/v2/detail/TaskDecision.tsx`; `src/app/(app)/prilike/[id].tsx`; `src/app/(app)/pitanja-zadatka.tsx` | B06, B08 partial; B07 (questions): no phone evidence |
| 5 | Offer: price, number of people, time, short note, review, send; "Moje prijave" | Core | `src/ui/v2/ApplicationComposerPresentation.tsx:113,302,447`; `src/app/(app)/moje-prijave.tsx` | B09 partial, B10, B11 |
| 6 | Compare offers and choose a person; the choice creates a Dogovor with accepted terms | Core | `src/app/(app)/potrebe/[id]/kandidati.tsx`; `src/ui/v2/ApplicationSelectionPresentation.tsx` | A11, A12 partial |
| 7 | Dogovor: overview, next step, text and photo messages | Core | `src/app/dogovor/[id].tsx`; `src/ui/AgreementChat.tsx` | D02, D03 (text) partial; D04 (photos): no phone evidence |
| 8 | Change proposals and cancellation with a reason | Core (secondary line) | `src/app/dogovor/[id]/izmene.tsx` | D06, D07: source and CI exist, no phone evidence |
| 9 | Worker marks the job done, requester confirms, ratings ("Posao je gotov", "Potvrdi završetak", "Oceni saradnju") | Core | `src/app/dogovor/[id].tsx:374-389`; `src/app/(app)/oceni-dogovor.tsx` | D10 (no phone evidence), D11, D12 partial |
| 10 | Work profile: skills, tools, vehicle, team, self-declared licences, work area and radius, availability, calendar | Core | `src/ui/profile/ProfileHubPresentation.tsx:91-99`; `src/app/(app)/profil/radnik.tsx`, `src/app/(app)/profil/lokacija.tsx`, `src/app/(app)/profil/dostupnost.tsx`, `src/app/(app)/raspored.tsx` | B01 to B03, B12 partial |
| 11 | Exact address is shared by the publisher inside a Dogovor and can be withdrawn | Core (privacy line) | `src/ui/AgreementPrivateLocation.tsx:124-138`; `src/ui/objava/ReviewPresentation.tsx:117` | D08: no phone evidence |
| 12 | Report a person, block, support requests, "Prijavi problem" in a Dogovor | Core | `src/ui/safety/SafetyScreen.tsx:19,65-91,159-160`; `src/ui/support/SupportPresentation.tsx:18-25`; `src/app/dogovor/[id].tsx:414-416` | N06, N07, N08 partial; moderation operations are not established (LEG-14 not started) |
| 13 | In-app notification bell and notification settings | Not named in the text (minor) | `src/app/obavestenja.tsx`; `src/app/(app)/profil/obavestenja.tsx` | P01, P02 partial |
| 14 | Voice messages between users | **ONLY IF SHIPPED** | `docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md` ("VOICE UNSHIPPED", B1/B2 not implemented); no voice UI in `src/` outside AI dictation | D03 |
| 15 | Voice input (dictation) into the AI conversation, Android only | **ONLY IF SHIPPED** | `modules/uskoci-voice/**`; `src/features/voice/useHoldToTalk.ts`; needs the speech switches on in the release environment (`legal-drafts-20260930/LEG-11`, R-03) | A03 |
| 16 | Push notifications | **ONLY IF SHIPPED** | store package `rs.uskoci` has no Firebase config (`app.config.js`, `legal-drafts-20260930/LEG-11` R-05); same-message chain not proven | P03, P04 |
| 17 | Group conversation | **ONLY IF SHIPPED** | `src/app/dogovor/[id]/grupa.tsx`; a two-person Dogovor is not proof of the group case | D05 |
| 18 | Data export and account closure | **ONLY IF SHIPPED** | `src/app/(app)/profil/izvoz.tsx`; `src/ui/closure/ClosurePresentation.tsx:171-177` (the screen can say the closure is unavailable while rules are unpublished); export needs a published policy (`legal-drafts-20260930/LEG-09` G-05) | N09, N10 |
| 19 | iOS build | **ONLY IF SHIPPED** | `app.json` has no `ios.bundleIdentifier`; store row "iOS oznaka aplikacije": NIJE PODEŠENO | store gates |
| 20 | HITNO activation by users | Never mention | no user-facing switch (only a badge on tasks the server marks urgent): `src/ui/v2/NeedUrgencyBadge.tsx` | A16 |
| 21 | Written rating comments | Never mention | not implemented (`legal-drafts-20260930/LEG-09` G-10) | D12 |
| 22 | Payments, fees, escrow, wallet | Never mention | out of the first phase (master plan 3.2) | store row "Plaćanje" |

**In-app entry copy that the listing echoes (existing brand text, not invented):** "Objavi zadatak. Pronađi ljude za ono što ti treba." and "Uskoči i zaradi. Pronađi zadatak koji ti odgovara." (`src/ui/entry/EntryWelcome.tsx:91,110`), tagline "Tvoj partner za svaki zadatak." (`:248`). The word "zaradi" is a button label; the listing does not promise any income. The word "posao" (job) is used sparingly on purpose: the platform-versus-job-placement boundary is an open counsel question (`docs/implementation/legal-drafts-20260930/README.md`, question 13), so the title and short text use "zadatak" and "pomoć".

## 4. Google Play

Play Console language: add **Serbian (sr)**; the console does not distinguish scripts, so the Latin-script text below matches the app (`OWNER INPUT`: confirm Latin over Cyrillic for the store page). English (en-US) is the default language when a listing is first created, so keep an English version.

### 4.1 Serbian (sr, Latin script)

#### Title (sr) (22 / 30 characters)

```text
USKOČI: zadaci i pomoć
```

#### Short description (sr) (79 / 80 characters)

```text
Objavi zadatak ili nađi zadatak blizu sebe. Dogovor i razgovor na jednom mestu.
```

#### Full description (sr) (1743 / 4000 characters)

```text
USKOČI povezuje ljude kojima treba pomoć oko nekog zadatka sa ljudima koji mogu da uskoče. Objavi zadatak ili pronađi zadatak blizu sebe, dogovori se i sve vodi na jednom mestu.

Kako radi
1. Objavi zadatak. Opiši šta ti treba svojim rečima. Asistent postavlja pitanja i slaže detalje: mesto, termin, broj ljudi i cenu ili traženje ponuda. Pre objave sve pregledaš i ispraviš.
2. Pronađi zadatak. Na mapi i u listi vidiš zadatke oko sebe i one koji se rade na daljinu. Pretraži po mestu, terminu, načinu rada, broju ljudi i ceni.
3. Pošalji ponudu. Predloži cenu, broj ljudi i termin, pa prati svoje prijave.
4. Izaberi osobu. Osoba koja je objavila zadatak poredi ponude i bira. Izbor pravi Dogovor sa prihvaćenim uslovima.
5. Uskladi detalje. Poruke i fotografije u Dogovoru, uz predloge izmena uslova i otkazivanje uz razlog.
6. Završi i oceni. Kad je posao gotov, osoba koja radi to označi, osoba koja je objavila zadatak potvrdi, a obe strane mogu da ostave ocenu.

Za koga je
• Treba ti pomoć: na primer oko sklapanja nameštaja, selidbe, kupovine, čekanja u redu ili šetnje psa.
• Želiš da uskočiš: napravi radni profil sa veštinama, alatom, vozilom, veličinom tima, područjem rada i dostupnošću.
Isti nalog koristiš i za objavu sopstvenih zadataka i za prijave na tuđe.

Privatnost i prijava problema
• Drugi korisnici vide samo približno mesto zadatka. Tačnu adresu deliš ti, u Dogovoru, kad odlučiš, i možeš da opozoveš deljenje.
• Prijavi osobu ili sadržaj, blokiraj korisnika ili piši podršci, sve iz aplikacije.
• Veštine i dozvole na profilima navodi sam korisnik. USKOČI ih ne proverava.

Veštačka inteligencija
Razgovor sa asistentom koristi AI servis treće strane. AI samo predlaže: ti proveravaš i odlučuješ šta se objavljuje.
```

### 4.2 English (en-US)

#### Title (en) (26 / 30 characters)

```text
USKOČI: Tasks & Local Help
```

#### Short description (en) (66 / 80 characters)

```text
Post a task or find one nearby. Agree terms and chat in one place.
```

#### Full description (en) (1965 / 4000 characters)

```text
USKOČI connects people who need help with a task with people who can step in. Post a task or find one near you, agree on the details and keep everything in one place.

How it works
1. Post a task. Describe what you need in your own words. The assistant asks follow-up questions and organises the details: place, time, number of people, and a price or a request for offers. You review and correct everything before it goes live.
2. Find a task. See tasks around you on a map and in a list, including tasks that can be done remotely. Search by place, time, way of working, number of people and price.
3. Send an offer. Propose a price, a number of people and a time, then follow your applications.
4. Choose a person. Whoever posted the task compares the offers and chooses. The choice creates an Agreement with the accepted terms.
5. Sort out the details. Messages and photos inside the Agreement, plus change proposals and cancellation with a reason.
6. Finish and rate. When the work is done, the person doing it marks it complete, the person who posted it confirms, and both sides can leave a rating.

Who it is for
• You need a hand: for example assembling furniture, moving, shopping, waiting in a queue or walking a dog.
• You want to step in: build a work profile with skills, tools, vehicle, team size, work area and availability.
One account covers both: post your own tasks and apply to other people's.

Privacy and reporting
• Other users see only an approximate place. You share the exact address yourself, inside an Agreement, when you decide, and you can withdraw it.
• Report a person or content, block a user or write to support, all from the app.
• Skills and permits on profiles are stated by the users themselves. USKOČI does not verify them.

Artificial intelligence
The assistant conversation uses a third-party AI service. The AI only suggests: you check and decide what gets published.

Language
The app interface is currently in Serbian only.
```

### 4.3 Other Play fields (no text drafted, inputs needed)

| Field | Status |
|---|---|
| Contact email | `OWNER INPUT` (LEG-01 OP-10). No operator email exists in the repository. |
| Website | `OWNER INPUT` (LEG-01 OP-16). Recommended by Google, not mandatory. |
| Privacy policy URL | `OWNER INPUT`. Mandatory for the Data safety form; the policy is not published (the legal registry had 0 documents at the 2026-09-29 DEV read, `docs/implementation/legal-drafts-20260930/LEG-13_legal_ui_acceptance_matrix.md`; re-check). |
| Developer name | `OWNER INPUT` (LEG-01 OP-01, OP-02). The operator is not registered as a legal entity (AF-D10). |
| App category and tags | See section 7. |
| Feature graphic 1024 x 500, icon 512 x 512 | See `SCREENSHOT_PLAN.md`. |

## 5. App Store

**Language decision (owner):** Apple's localization list has no Serbian. Options: **(a)** English (U.K. or U.S.) as the primary language, recommended and used below; **(b)** additionally a Croatian localization carrying the Serbian-Latin text after a native review (Croatian and Serbian differ in vocabulary, so it must not be pasted unreviewed); **(c)** wait for Apple to add Serbian. The in-app language stays Serbian in every case. `INFERRED`: users whose device language has no localization see the primary-language page.

**English texts disclose the interface language.** The app has no English interface (no localization framework in `package.json` or `src/`), so every English description ends with "The app interface is currently in Serbian only." English-listing screenshots therefore show Serbian screens with English captions (`SCREENSHOT_PLAN.md`).

### 5.1 English (recommended primary language)

#### Name (en) (6 / 30 characters)

```text
USKOČI
```

#### Subtitle (en) (29 / 30 characters)

```text
Post a task. Find one nearby.
```

#### Promotional text (en) (142 / 170 characters)

```text
Describe what you need in your own words, review it and publish. Or find a task near you and send an offer. Agree terms and chat in one place.
```

#### Description (en) (1969 / 4000 characters)

```text
USKOČI connects people who need help with a task with people who can step in. Post a task or find one near you, agree on the details and keep everything in one place.

How it works

1. Post a task. Describe what you need in your own words. The assistant asks follow-up questions and organises the details: place, time, number of people, and a price or a request for offers. You review and correct everything before it goes live.

2. Find a task. See tasks around you on a map and in a list, including tasks that can be done remotely. Search by place, time, way of working, number of people and price.

3. Send an offer. Propose a price, a number of people and a time, then follow your applications.

4. Choose a person. Whoever posted the task compares the offers and chooses. The choice creates an Agreement with the accepted terms.

5. Sort out the details. Messages and photos inside the Agreement, plus change proposals and cancellation with a reason.

6. Finish and rate. When the work is done, the person doing it marks it complete, the person who posted it confirms, and both sides can leave a rating.

Who it is for

You need a hand: for example assembling furniture, moving, shopping, waiting in a queue or walking a dog.

You want to step in: build a work profile with skills, tools, vehicle, team size, work area and availability.

One account covers both: post your own tasks and apply to other people's.

Privacy and reporting

Other users see only an approximate place. You share the exact address yourself, inside an Agreement, when you decide, and you can withdraw it.

Report a person or content, block a user or write to support, all from the app.

Skills and permits on profiles are stated by the users themselves. USKOČI does not verify them.

Artificial intelligence

The assistant conversation uses a third-party AI service. The AI only suggests: you check and decide what gets published.

Language

The app interface is currently in Serbian only.
```

#### Keywords (en) (99 / 100 characters, 99 UTF-8 bytes)

```text
errands,help,local,moving,chores,offers,assembly,shopping,handyman,agreements,dog,walking,furniture
```

Keyword notes: words that already appear in the name or subtitle (task, nearby, post, find) are left out because Apple indexes them anyway; no competitor names, no category words, no plurals of words already present. `INFERRED`: ranking tuning is a later step, the list is a starting point.

### 5.2 Serbian (Latin) source text, alternative

Use only if Apple adds Serbian or if the owner chooses a reviewed Croatian localization (section 5, option b).

#### Name (sr) (6 / 30 characters)

```text
USKOČI
```

#### Subtitle (sr) (23 / 30 characters)

```text
Objavi ili nađi zadatak
```

#### Promotional text (sr) (135 / 170 characters)

```text
Opiši šta ti treba svojim rečima, pregledaj i objavi. Ili nađi zadatak blizu sebe i pošalji ponudu. Dogovor i razgovor na jednom mestu.
```

#### Description (sr) (1749 / 4000 characters)

```text
USKOČI povezuje ljude kojima treba pomoć oko nekog zadatka sa ljudima koji mogu da uskoče. Objavi zadatak ili pronađi zadatak blizu sebe, dogovori se i sve vodi na jednom mestu.

Kako radi

1. Objavi zadatak. Opiši šta ti treba svojim rečima. Asistent postavlja pitanja i slaže detalje: mesto, termin, broj ljudi i cenu ili traženje ponuda. Pre objave sve pregledaš i ispraviš.

2. Pronađi zadatak. Na mapi i u listi vidiš zadatke oko sebe i one koji se rade na daljinu. Pretraži po mestu, terminu, načinu rada, broju ljudi i ceni.

3. Pošalji ponudu. Predloži cenu, broj ljudi i termin, pa prati svoje prijave.

4. Izaberi osobu. Osoba koja je objavila zadatak poredi ponude i bira. Izbor pravi Dogovor sa prihvaćenim uslovima.

5. Uskladi detalje. Poruke i fotografije u Dogovoru, uz predloge izmena uslova i otkazivanje uz razlog.

6. Završi i oceni. Kad je posao gotov, osoba koja radi to označi, osoba koja je objavila zadatak potvrdi, a obe strane mogu da ostave ocenu.

Za koga je
• Treba ti pomoć: na primer oko sklapanja nameštaja, selidbe, kupovine, čekanja u redu ili šetnje psa.
• Želiš da uskočiš: napravi radni profil sa veštinama, alatom, vozilom, veličinom tima, područjem rada i dostupnošću.
Isti nalog koristiš i za objavu sopstvenih zadataka i za prijave na tuđe.

Privatnost i prijava problema
• Drugi korisnici vide samo približno mesto zadatka. Tačnu adresu deliš ti, u Dogovoru, kad odlučiš, i možeš da opozoveš deljenje.
• Prijavi osobu ili sadržaj, blokiraj korisnika ili piši podršci, sve iz aplikacije.
• Veštine i dozvole na profilima navodi sam korisnik. USKOČI ih ne proverava.

Veštačka inteligencija
Razgovor sa asistentom koristi AI servis treće strane. AI samo predlaže: ti proveravaš i odlučuješ šta se objavljuje.
```

#### Keywords (sr, ASCII without diacritics to save bytes) (91 / 100 characters, 91 UTF-8 bytes)

```text
zadaci,pomoc,selidba,prevoz,majstor,ponude,dogovor,sklapanje,namestaj,setnja,kupovina,blizu
```

### 5.3 Other App Store fields (no text drafted, inputs needed)

| Field | Status |
|---|---|
| Support URL | `OWNER INPUT`, required, must lead to real contact information (LEG-01 OP-10, OP-16). |
| Privacy Policy URL | `OWNER INPUT`, required (LEG-04 not published). |
| Copyright | `OWNER INPUT` (year + legal entity, LEG-01 OP-02). |
| Bundle ID and SKU | **Not set.** `app.json` has no `ios.bundleIdentifier` (`OWNER INPUT`, LEG-01 OP-40). |
| App name availability | `OWNER INPUT`: names must be unique in the store; availability of "USKOČI" is not verified. |
| Age rating | See LEG-19 (not started). Apple's current questionnaire asks about user-generated content, messaging and AI-related capabilities; answers must match the build ([Apple age ratings](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions), fetched 2026-09-30). |
| What's New | Not used for version 1.0 (Apple requires it only for updates). |

## 6. First-release notes (Google Play release notes)

#### Release notes (sr) (173 / 500 characters)

```text
Prva verzija aplikacije USKOČI: objavi zadatak uz pomoć asistenta, pronađi zadatke na mapi i u listi, pošalji ponudu, dogovori se i razgovaraj u Dogovoru, pa oceni saradnju.
```

#### Release notes (en) (192 / 500 characters)

```text
First release of USKOČI: post a task with the help of the assistant, find tasks on the map and in a list, send an offer, agree terms and chat inside the Agreement, then rate the collaboration.
```

## 7. Category suggestion

| Store | Suggestion | Reasoning | Status |
|---|---|---|---|
| Google Play | **Lifestyle** (primary). Alternatives: House and Home (too narrow: tasks are not only home tasks), Business (implies a business tool, and invites the job-placement question), Social (invites social-network expectations and UGC scrutiny beyond what the app is) | The app is a general-interest service marketplace for everyday tasks. Play tags: at most 5, must be obviously relevant ([Play categories and tags](https://support.google.com/googleplay/android-developer/answer/9859673)); choose from the console's list at submission. | `INFERRED`; category names were checked on the fetched page, placement of comparable apps was not verified |
| App Store | **Lifestyle** (primary), no secondary until the owner decides. Apple's definition: "Apps relating to a general-interest subject matter or service" ([Apple categories](https://developer.apple.com/app-store/categories/)). Business or Productivity are possible secondaries only if the worker side is positioned as a professional tool. | same reasoning | `INFERRED` |

## 8. ONLY IF SHIPPED: lines that may be added to the descriptions

Add a line **only** when its condition is met on the exact release binary and backend. Each line is written for the bullet list of the Google full description (section 4); the App Store version drops the bullet character.

| Line (sr) | Line (en) | Condition before it may appear |
|---|---|---|
| `• Glasovne poruke u Dogovoru.` | `• Voice messages inside the Agreement.` | Voice messages are implemented end to end (recorder, upload, message type, playback, retry) and accepted on a real device; `docs/implementation/product-v1-closure-20260926/CHAT_VOICE_CONTRACT.md` status is no longer "VOICE UNSHIPPED". Microphone text must be updated (LEG-12 N-03) and the Data safety and App Privacy answers must add voice recordings. |
| `• Govorni unos u razgovoru sa asistentom (Android).` | `• Voice input in the assistant conversation (Android).` | The speech switches are on in the release backend and the microphone permission string is corrected (LEG-18 section 2.3: the current string does not match the real behaviour). Android only: the native module does not exist for iOS (`modules/uskoci-voice/expo-module.config.json`). |
| `• Obaveštenja na telefonu o novim porukama i događajima u Dogovoru.` | `• Phone notifications about new messages and events in an Agreement.` | Firebase configuration exists for the store package `rs.uskoci`, the transport is enabled, and the same-message chain (event, push, tap, correct conversation) is proven on the release build (master plan J14, control rows P03, P04). |
| `• Grupni razgovor kada u poslu učestvuje više ljudi.` | `• Group conversation when several people take part in one job.` | A real multi-member group case is proven (control row D05); a two-person Dogovor does not prove it. |
| `• Izvoz svojih podataka i zatvaranje naloga u Profilu.` | `• Export your data and close your account from Profile.` | A retention policy is published so export can run (`EXPORT_POLICY_NOT_READY` otherwise) and the closure path is verified on a disposable subject, including the out-of-app deletion page (master plan N09, N10, LEG-08). |

Not a line, but a whole store: an **iOS listing** exists only if an iOS build is signed and reviewable (bundle id unset today; `docs/control/redovi.json` store rows). Do not prepare an App Store page as if it were imminent until that is decided.

## 9. Claims this listing deliberately does not make

| Not written | Why |
|---|---|
| "Free", "no fees", "0 RSD" | Price statements are restricted by both stores' metadata guidance and the monetisation decision is open (store row "Plaćanje": NEMA). If the owner wants a "no platform fee at launch" sentence, add it only after the commercial decision, and re-check the store payment rules (Apple 3.1.3(e) for services consumed outside the app; Google Billing policy) for the exact wording. |
| "Verified", "trusted", "safe", "insured", "background-checked" | Identity is self-declared; no KYC; `private.identity_admitted` is deliberately false (`legal-drafts-20260930/LEG-09` section 4). |
| "Your exact address never leaves your phone / is never seen by AI" | Not true today: confirmed private address facts can enter the AI context (LEG-09 G-01; branch `d18e830a` deferred by the owner). |
| "Data stays in the EU / Serbia" | Google's AI processing may be outside Europe (approved in-app text, `src/ui/objava/TaskPhotosPresentation.tsx:86`); LEG-11 forbids this claim. |
| "Best", "#1", ratings, download or user counts, awards, testimonials | Google metadata policy forbids unattributed testimonials and performance claims; no such data exists anyway. |
| "Earn money", income examples, hourly rates | "Uskoči i zaradi" is only the label of a button; the listing quotes it, never promises earnings. |
| "Instant" matching or "notified immediately" | Dispatch and push are not proven end to end (control rows B00, P04). |
| "18+" or age statements | The app has no age gate (`legal-drafts-20260930/LEG-09` G-03); the audience is an owner decision (LEG-19). |
| Names of other marketplaces | Google metadata policy: no references to other apps or brands without permission; Apple keyword guidance likewise. |
| Emoji, ALL CAPS beyond the brand, "Download now" | Google metadata policy (fetched 2026-09-30). |

## 10. Consistency checks against the rest of the release package

- **BOTH-02 (listing truth):** every base sentence maps to a row 1 to 12 in section 3; screenshots must show only those features (`SCREENSHOT_PLAN.md`).
- **Data declarations:** the AI line and the privacy bullets must stay consistent with `DATA_DECLARATIONS_DRAFT.md`; the two deferred privacy branches (AI context minimisation, processor inventory) can change the wording. Freeze the listing only after the final privacy pass.
- **Review notes:** the reviewer-facing description of the flows is `REVIEW_NOTES_DRAFT.md`; the two files must describe the same features.

## 11. Owner decisions and inputs needed for this file

1. **Final title, subtitle and first sentence** (sections 4 to 5): approve or replace the drafts. Check name availability in both consoles.
2. **App Store language strategy** (English primary, reviewed Croatian, or wait for Serbian) and **Play script** (Latin or Cyrillic).
3. **Positioning words:** keep "zadatak" and "pomoć" (recommended, avoids the job-placement question) or use "posao" and "poslovi" in the headline after counsel's opinion on the platform boundary.
4. **Free or paid statement:** none in the drafts (section 9). Decide together with the monetisation matrix (LEG-20 asks for one).
5. **The AI disclosure sentence:** keep it in the store text or move it to the privacy policy only; wording to be settled with counsel and with the in-app notice (LEG-12 N-01, N-02).
6. **Operator identity and contact data** for the store fields: developer name, support email, support and privacy URLs, copyright line (LEG-01 OP-01 to OP-16).
7. **Which ONLY IF SHIPPED lines make the first release** (voice messages, push, iOS, group chat, export). This decides the final text and the store answers.

## 12. Character counts (generated)

| Field | Characters | Limit | Bytes (UTF-8) |
|---|---|---|---|
| Play title (sr) | 22 | 30 | 24 |
| Play title (en) | 26 | 30 | 27 |
| Play short (sr) | 79 | 80 | 80 |
| Play short (en) | 66 | 80 | 66 |
| Play full (sr) | 1743 | 4000 | 1809 |
| Play full (en) | 1965 | 4000 | 1977 |
| Apple name (en) | 6 | 30 | 7 |
| Apple subtitle (en) | 29 | 30 | 29 |
| Apple promotional (en) | 142 | 170 | 142 |
| Apple description (en) | 1969 | 4000 | 1971 |
| Apple keywords (en) | 99 | 100 | 99 |
| Apple name (sr) | 6 | 30 | 7 |
| Apple subtitle (sr) | 23 | 30 | 24 |
| Apple promotional (sr) | 135 | 170 | 140 |
| Apple description (sr) | 1749 | 4000 | 1815 |
| Apple keywords (sr) | 91 | 100 | 91 |
| Play release notes (sr) | 173 | 500 | 177 |
| Play release notes (en) | 192 | 500 | 193 |

Every field is within its limit. Fields with a margin of two or less: Play short (sr) (79 of 80); Apple subtitle (en) (29 of 30); Apple keywords (en) (99 of 100). Re-count after any edit.

## D12 note (candidate, NOT applied)

> Added 2026-10-01. The package "D12 written comment with the star rating" is only a candidate in the repository (`supabase/candidates/d12_review_comment.sql`); it is not applied to DEV and needs the owner's explicit decision. Until then every statement above that a review has no free text stays true and this document is unchanged. If the package is applied, the effect on this document is limited to: row 21 ("Written rating comments": Never mention): it stays "Never mention" until the feature ships and is proven on a device. The optional written comment exists while the author's account exists; it is erased when the author account is closed; a comment hidden by moderation and a comment about a person who closed their account are retained (hidden from display); the retention period is an owner/legal input and no number is invented. Lawful basis, DPIA, moderator and response time stay open. Source: `supabase/proofs/d12/README_D12_CANDIDATE.md`.
