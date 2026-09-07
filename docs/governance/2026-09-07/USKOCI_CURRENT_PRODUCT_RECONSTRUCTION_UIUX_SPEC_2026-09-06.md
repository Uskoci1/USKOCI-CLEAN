# USKOČI — CURRENT PRODUCT RECONSTRUCTION + UI/UX DESIGN SOURCE OF TRUTH

**Reconstruction date:** 2026-09-06  
**Mode:** READ-ONLY forensic reconciliation before new Figma high-fidelity work.

## 0. Authority / precedence

1. **Fresh canonical GitHub** — `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`, fresh HEAD `6b7d9df42b575d72b97ab2dd9cb0f45f02fda96e`.
2. **Fresh live Supabase** — project `leqcwgzvjsxugfgzdmth`, live through migration `20260906102021_clean_p0d03_requester_connection_activation_v1` (78 live migrations at current status checkpoint).
3. **2026-09-06 FINAL UI/UX handoff V6 ATOMIC** — 28 active surface contracts, atomic element registry, action matrix, states, motion, canonical entry/logo assets.
4. **Final owner 21/21 locks (2026-09-02)** — product mental model, navigation, light-first operational UI, Dogovor IA, map/privacy, multi-person target semantics.
5. **Older 31-surface reconstruction** is lineage only where later locks differ: `S05`, `R01`, `W01` were retired. Active target = **28 surfaces**.
6. Old HTML/brand boards are **visual donors only**, except current canonical GitHub S01/S02 entry HTML + extractor + RN `ReferenceEntryHero`, which owns exact entry/logo geometry and animation identity.

## 1. Locked product mental model

- User-facing model is **Zadatak → Prijava → Dogovor**.
- One account; two **current intents**, not two permanent identities: **MENI TREBA** and **JA MOGU**.
- Ordinary UI must not expose database vocabulary (`response`, `agreement`, hashes, revisions, RPCs).
- Final main navigation is compact 3-zone:
  - MENI TREBA: `Zadaci | U / Novi | Dogovori`
  - JA MOGU: `Prijave | U / Zadaci | Dogovori`
- No permanent `Početna`, no permanent `Profil`, no final `Kombinovano`. Profile opens from avatar; Inbox from bell.
- Exactly one contextually dominant primary CTA per state.
- Whole cards are tappable where there is one natural destination; do not duplicate generic `Detalji` actions.
- AI proposes; human confirms; server authorizes. AI asks the highest-value unresolved material question, not a giant form.
- Exact address/contact/private AI facts never become public merely because the client knows them.
- Dogovor top IA = exactly **Pregled | Poruke**; Hronologija is embedded in Pregled.
- Operational app is **light-first Warm Dawn**; cinematic dark/forest entry is brand space, not a reason to make every marketplace screen dark.

## 2. Locked brand / motion source

- Canonical mark is **not a generic U**. It resolves into ivory person + orange person + handshake + orange location pin + ivory bridge/smile.
- Exact mark animation uses current canonical keyframes; current RN reference samples at 60 fps.
- Entry sequence: mark forms centrally → readable hold → flies to upper-left → wordmark joins → operational entry content fades in.
- Final entry copy currently represented by: `Čovek tamo gde Vi niste.` + `Treba mi neko` + `Želim da uskočim`.
- Exact final X/Y/scale/gap may be optically tuned; identity and hierarchy may not be reinterpreted.
- Motion grammar: restrained 100–240 ms operational motion; server-authoritative states never animate to success before server confirmation.
- Reduced-motion path is mandatory.

## 3. Current live platform checkpoint

- RU-0: CLOSED / LIVE
- RU-1: CLOSED / LIVE
- RU-2: CLOSED / LIVE
- RU-3: LIVE FOUNDATION; **D0140 production ALLOW fail-closed**
- RU-4: CLOSED / LIVE
- RU-4B: LIVE FOUNDATION; **public Q&A activation blocked/deferred**
- Client Data Layer: CLOSED / CANONICAL
- RU-5: IN PROGRESS; public-safe profile, application submit, my applications, candidate projection, selection eligibility, selection semantic idempotency and requester connection activation V1 are live/proven
- P0D-03 requester connection activation V1: requester-beneficiary, selection-triggered, promotional free, 0 RSD, HEADCOUNT; this is **not monetization**.
- RU-5B: not started/gated; RU-6A foundation only; RU-6B not started; RU-7 foundation only; RU-8 not started.
- Only current Edge function: `uskoci-ai-interview` v5 active.
- Storage currently exposes only private `profile-media`; task/chat media must remain gated.
- Urgent config is disabled with empty allowed categories; **HITNO must not be shown as live**.
- Reviews, production map provider, push delivery, shared multi-person Dogovor channels, hard calendar authority, identity-provider runtime, voice transcription remain incomplete/gated.

### Security note

Fresh live inspection shows RLS disabled on five `private.preselection_qa_*` tables. No remediation is performed in this design phase. Public preselection Q&A remains visually gated until engineering/security authority is reconciled and proven.

## 4. 28 active surfaces — current-state reconciliation

| ID | Surface | Current physical state | Design consequence |
|---|---|---|---|
| **S01** | Intro / Brand Entry | **STRONG / PHYSICAL** — Canonical ReferenceEntryHero exists in current RN with exact vector-keyframe mark, city artwork, wordmark join and entry CTAs. Keep identity; refine final positioning/accessibility/reduced motion. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **S02** | Trenutna namera | **EMBEDDED / PARTIAL** — Current intent is effectively expressed by entry CTAs, but final canonical S02 contract remains a distinct intent concept/return-target rule. Do not create old permanent role chooser. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **S03** | Auth | **PARTIAL / REAL CORE** — Email/password and phone OTP/recovery are wired. Google/Apple buttons are visual placeholders awaiting provider configuration and must not be presented as live in final UX. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **S04** | Potvrda / oporavak | **PARTIAL / EMBEDDED** — Verification/recovery phases live inside auth route; return-target/deep-link proof still needs closure. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **S06** | Obaveštenja / Inbox | **MISSING TARGET** — No complete Inbox surface. Event/delivery schema exists but live delivery inventory is empty and no push dispatch Edge exists. | Design fully from canonical contract; do not imply backend availability. |
| **S07** | Podešavanja / privatnost / legal / podrška | **MISSING TARGET** — No complete settings/privacy/legal/support/account-lifecycle surface. Account close/anonymization backend remains missing. | Design fully from canonical contract; do not imply backend availability. |
| **R02** | Novi Zadatak — AI | **STRONG / LIVE-BOUND** — Current nova.tsx has real AI conversation + live draft. RU-2/Edge v5 and typed Need V2 foundation are live. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **R03** | Zadaci | **PARTIAL** — Current requester task list exists but shell/terminology and final attention/state treatment require canonical redesign. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **R04** | Radni prostor Zadatka | **PARTIAL / GATED** — Task workspace exists. Owner-edit authority is live; publish engine exists but production D0140 ALLOW remains fail-closed; current edit-route gap must not be hidden by design. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **R05** | Prijave / izbor | **STRONG CORE / PARTIAL UI** — Candidate projection + selection revalidation + semantic idempotency + zero-cost requester connection activation are live. Current UI still lacks full canonical candidate/profile/capacity/premium consequence treatment. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **R06** | Javni profil | **BACKEND LIVE / UI MISSING** — Public-safe profile projection rpc_get_public_profile is live; final public Profile Passport surface is not complete. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **R07** | Human Review Zadatka | **STRONG / LIVE-BOUND** — Human Review + explicit confirm/correct + DRAFT materialization is among the strongest current flows. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **R08** | Dogovori — MENI TREBA | **PARTIAL** — Agreement list read owner is canonical; final requester task-centered Dogovori grouping/attention presentation needs redesign. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **R09** | Profil — MENI TREBA | **VISIBLE PROTOTYPE / UNRELIABLE** — Current profile screen contains hardcoded demo identity/rating values and visual rows without complete destinations. Must be rebuilt on real projections. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **W02** | Radni profil — AI | **MISSING CANONICAL** — No complete worker AI-profile flow. Worker readiness authority exists, but AI worker-profile product surface is not end-to-end proven. | Design target may be complete, but feature must remain gated in prototype where backend is absent. |
| **W03** | Zadaci — Lista / Mapa | **PARTIAL / BROKEN NAV** — Real discovery list projection exists, but current UI still has obsolete Lista/Mapa/Kombinovano, placeholder map, and task card without canonical navigation. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **W04** | Detalj Zadatka | **PARTIAL** — Task detail route exists. Public requester trust/profile and several target details/states are incomplete; preselection Q&A remains blocked. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **W05** | Sastavi Prijavu | **STRONG / LIVE-BOUND** — Atomic application submit is live with semantic retry pattern. Final structured composition/summary/polish still required. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **W06** | Moje Prijave | **STRONG / LIVE-BOUND** — My Applications projection + withdraw and stale handling are live; final canonical grouping/attention/premium state treatment still required. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **W07** | Dogovori — JA MOGU | **PARTIAL** — Shared agreement list exists; final worker-specific task-centered grouping and attention presentation need redesign. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **W08** | Radni profil | **PARTIAL MANUAL** — Manual worker profile route exists and readiness authority is live; canonical structured profile + AI-assisted edit + availability summary are incomplete. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **W09** | Dostupnost / kalendar | **MISSING / BACKEND FOUNDATION ONLY** — Availability tables exist, but hard calendar conflict/commitment authority is not closed and no complete calendar surface is present. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **D01** | Dogovor shell | **STRONG SHELL / PARTIAL PRODUCT** — Current Dogovor route already has exactly Pregled | Poruke and embedded chronology. It is still a single-agreement workspace, not final shared multi-person aggregate. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **D02** | Dogovor — Pregled | **PARTIAL / LIVE CORE** — Agreement workspace, contact grants and exact-location authority have live owners; final shared/participant-specific aggregate semantics are not complete. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **D03** | Dogovor — Poruke | **PARTIAL / LIVE BASIC CHAT** — Single-agreement message send/read exists. Final group + requester↔participant private channel model and stable client_message_id retry contract are not yet implemented end-to-end. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **D04** | Hronologija — embedded | **PRESENT / EMBEDDED** — Chronology is already embedded in Pregled, which matches final information architecture; event completeness remains backend-dependent. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **D05** | Izmena / problem / otkaz | **PARTIAL / LIVE CORE** — Agreement change v2, respond, problem reporting and cancellation primitives exist. Final contextual diff/effect UX and multi-person replacement semantics are not fully live. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |
| **D06** | Završetak / recenzija | **PARTIAL / REVIEWS MISSING** — Completion primitives exist, but full completion/review product is not closed; review backend is absent, so ratings/review CTA must be gated. | Redesign to final contract while preserving proven server behavior; label/gate unproven capability. |

## 5. Screen-by-screen UI/UX design spec

The following is the drawing/interaction contract. Each screen includes its purpose, order, atomic controls, authority, states, and current implementation reconciliation.

# Shared

## S01 — Intro / Brand Entry

**Purpose:** Introduce USKOČI instantly, play the canonical brand transition, then expose the two true entry actions without forcing a long wait.

**Current physical status:** **STRONG / PHYSICAL** — Canonical ReferenceEntryHero exists in current RN with exact vector-keyframe mark, city artwork, wordmark join and entry CTAs. Keep identity; refine final positioning/accessibility/reduced motion.

**Layout order:**
- Full-bleed canonical city artwork.
- Canonical animated logo mark begins in the center.
- Brand mark flies to upper-left and joins the USKOČI wordmark.
- Centered headline: “Čovek tamo gde Vi niste.”
- Bottom action stack: primary requester action, secondary worker action, legal links.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| S01-E01 | Animated brand mark | USKOČI mark | Always / When visible | None → Same screen | Canonical GitHub HTML + extracted SVG/keyframes | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S01-E02 | Wordmark | USKOČI | Always / When visible | None → Same screen | Canonical entry reference | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S01-E03 | Text | Čovek tamo gde Vi niste. | Always / When visible | None → Same screen | Product copy | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S01-E04 | Text button | Prijavi se | Always / When visible | Open authentication → S03 | Navigation/session gate | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S01-E05 | Primary button | Treba mi neko | Always / When visible | Set current intent MENI TREBA; continue → S02 or S03/R02 depending session strategy | Intent/session state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S01-E06 | Secondary button | Želim da uskočim | Always / When visible | Set current intent JA MOGU; continue → S02 or S03/W03 | Intent/session state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S01-E07 | Legal links | Uslovi korišćenja · Politika privatnosti | Always / When visible | Open selected legal document → S07/legal detail | Versioned legal content | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **first_run:** Full brand sequence allowed, but app should not wait longer than necessary once ready.
- **returning:** Skip or shorten full cinematic intro; never force full replay every launch.
- **reduced_motion:** Crossfade brand to final entry composition; no flight/rotation.
- **load_slow:** Brand loader may hold subtly; no fake percentage.
- **load_fast:** Transition can complete/shorten without artificial delay.

**Business / privacy / authority rules:**
- Logo geometry/identity follows current canonical GitHub reference.
- Final X/Y/scale/gap may be optically tuned; identity and hierarchy must remain recognizable.
- No permission prompts on Intro.

**Premium enhancement allowed:**
- Use the v5 positioning playground as reference, not an immutable pixel lock.
- Returning-user fast path.
- Subtle city-light animation only if it remains performant.

**Do not add / do not fake:**
- Onboarding carousel
- Fake job feed
- Location permission
- Unconfigured social login buttons

---

## S02 — Trenutna namera

**Purpose:** Make the user's current intent explicit: MENI TREBA or JA MOGU, while keeping one account.

**Current physical status:** **EMBEDDED / PARTIAL** — Current intent is effectively expressed by entry CTAs, but final canonical S02 contract remains a distinct intent concept/return-target rule. Do not create old permanent role chooser.

**Layout order:**
- Header/title zone.
- Two large 1-column intent cards.
- Short shared-account explanation.
- Optional sign-in/account context.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| S02-E01 | Title | Šta želite da uradite? | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S02-E02 | Intent card | MENI TREBA | Always / When visible | Select requester intent → R03/R02 or S03 | Current intent store + session | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S02-E03 | Intent card | JA MOGU | Always / When visible | Select worker intent → W03/W06 or S03 | Current intent store + session | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S02-E04 | Supporting text | Isti nalog možete koristiti na oba načina. | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S02-E05 | Back/brand action | Nazad | Always / When visible | Go back → S01 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **signed_out:** Store intended destination and route through Auth.
- **signed_in:** Open selected workspace directly.
- **profile_not_ready_worker:** JA MOGU may route to W02/W08 setup guidance, not a dead W03.

**Business / privacy / authority rules:**
- Intent is not a second account or permanent role.
- Auth must return user to the exact selected intent target.

**Premium enhancement allowed:**
- Visually remember last used mode without silently skipping choice when choice is needed.
- Short crossfade between mode color accents.

**Do not add / do not fake:**
- Separate account creation per role
- Role lock-in
- Permanent Home dashboard

---

## S03 — Auth

**Purpose:** Authenticate with only physically supported methods and preserve the pre-auth target.

**Current physical status:** **PARTIAL / REAL CORE** — Email/password and phone OTP/recovery are wired. Google/Apple buttons are visual placeholders awaiting provider configuration and must not be presented as live in final UX.

**Layout order:**
- Detail header/back.
- Auth mode switch if registration and login are both real.
- Form fields.
- Primary submit.
- Recovery/legal links.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| S03-E01 | Back button | Nazad | Always / When visible | Back → Previous target/S02 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S03-E02 | Mode control | Prijava / Registracija | Always / When visible | Switch auth mode → Same screen | Auth UI state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S03-E03 | Input | Email | Always / When visible | None → Same screen | Auth provider | L: No special loading · E: Inline validation + provider-safe copy · O: Works locally · S: Re-read when screen focuses |
| S03-E04 | Input | Lozinka | Always / When visible | None → Same screen | Auth provider | L: No special loading · E: Inline/provider error; never expose raw provider internals · O: Works locally · S: Re-read when screen focuses |
| S03-E05 | Icon button | Prikaži/sakrij lozinku | Always / When visible | Toggle password visibility → Same screen | Local | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S03-E06 | Primary button | Nastavite | Always / When visible | Submit auth → Stored return target | Auth provider + session store | L: Button-local: “Prijavljujemo…” · E: Human Serbian auth error · O: Show network error; keep form values · S: Re-read when screen focuses |
| S03-E07 | Text button | Zaboravili ste lozinku? | Only if recovery is supported / When visible | Open recovery → S04 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S03-E08 | Legal links | Uslovi · Privatnost | Always / When visible | Open legal content → S07/legal detail | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Disable duplicate submit; preserve fields.
- **invalid:** Inline field errors.
- **provider_error:** Map to stable human copy.
- **offline:** No destructive reset.
- **success:** Restore return target.

**Business / privacy / authority rules:**
- Never add unsupported auth methods just for visual completeness.
- Auth success must not dump user on generic Home.

**Premium enhancement allowed:**
- Keyboard-aware layout.
- Autofill/content types.
- Password manager compatibility.
- Inline submit progress without layout jump.

**Do not add / do not fake:**
- Fake Apple/Google login
- Generic success modal
- Raw Supabase/provider error strings

---

## S04 — Potvrda / oporavak

**Purpose:** Handle confirmation codes, recovery links and password reset as one coherent family without losing context.

**Current physical status:** **PARTIAL / EMBEDDED** — Verification/recovery phases live inside auth route; return-target/deep-link proof still needs closure.

**Layout order:**
- Header/back.
- Context explanation.
- Code or password fields depending mode.
- Primary action.
- Resend/recovery support.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| S04-E01 | Back button | Nazad | Always / When visible | Back → S03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S04-E02 | Context text | Potvrdite nalog / Oporavite pristup | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S04-E03 | Input | Kod za potvrdu | Confirmation-code mode / When visible | None → Same screen | Auth provider | L: No special loading · E: Inline invalid/expired code · O: Works locally · S: Re-read when screen focuses |
| S04-E04 | Input | Nova lozinka | Reset-password mode / When visible | None → Same screen | Auth provider | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S04-E05 | Primary button | Potvrdite / Sačuvajte | Always / When visible | Submit current recovery action → Stored return target or S03 | Auth provider | L: Button-local progress · E: No special error · O: Keep input; retry · S: Re-read when screen focuses |
| S04-E06 | Text button | Pošaljite ponovo | Code resend supported / Cooldown expired | Resend code → Same screen | Auth provider | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S04-E07 | Meta | Ponovo za 00:32 | Cooldown active / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **waiting:** Show destination masked if available.
- **expired:** Clear next action to resend.
- **success:** Deep-link/return-target continuity.
- **offline:** No lost code/password text where safe.

**Business / privacy / authority rules:**
- Never expose full email/phone unnecessarily.
- Return to intended product route after successful recovery.

**Premium enhancement allowed:**
- Masked destination.
- Resend cooldown.
- Automatic code focus/advance if code UI uses split boxes.

**Do not add / do not fake:**
- Unbounded resend
- Confetti success screen
- Generic home redirect

---

## S06 — Obaveštenja / Inbox

**Purpose:** Surface actionable domain events and deep-link precisely to the affected Zadatak, Prijava or Dogovor.

**Current physical status:** **MISSING TARGET** — No complete Inbox surface. Event/delivery schema exists but live delivery inventory is empty and no push dispatch Edge exists.

**Layout order:**
- Main header with title + avatar or back depending entry.
- Optional mark-all-read action.
- Grouped list: Danas / Ranije.
- Rows 72+ px.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| S06-E01 | Header title | Obaveštenja | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S06-E02 | Text button | Označi sve kao pročitano | At least one unread / When visible | Mark all visible/current inbox events read → Same screen | Notification/inbox service | L: Small inline progress · E: No special error · O: Queue only if contract supports; otherwise show offline · S: Re-read when screen focuses |
| S06-E03 | Notification row | Nova Prijava | Event type exists / When visible | Mark read + deep-link → R05/R04 | user_activity_events/delivery projection | L: No special loading · E: No special error · O: Works locally · S: Destination re-reads authoritative entity |
| S06-E04 | Notification row | Izabrani ste | Selection event / When visible | Deep-link → D01/W06 | Event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S06-E05 | Notification row | Nova poruka | Message event / When visible | Deep-link to correct channel → D03 | Event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S06-E06 | Notification row | Zadatak je promenjen | Need revision event / When visible | Deep-link → W06/W04 | Event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S06-E07 | Notification row | Čeka se Vaša potvrda završetka | Completion event / When visible | Deep-link → D06 | Event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S06-E08 | Pull to refresh | Osvežite | Always / When visible | Re-read inbox → Same screen | Server read | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** 2–3 skeleton rows.
- **empty:** Mirna poruka: “Nemate novih obaveštenja.”
- **error:** Retry state, do not show fake empty.
- **offline:** Show last cached rows if safely cached + offline banner.
- **stale:** Deep-linked destination decides current truth.

**Business / privacy / authority rules:**
- Inbox is not source of truth for business state.
- Every row must have a real destination or not be emitted.

**Premium enhancement allowed:**
- Unread dot + subtle row tint.
- Danas/Ranije grouping.
- Optional Sve | Nepročitano only after volume justifies it.

**Do not add / do not fake:**
- Marketing spam feed
- Dead notifications
- Raw event type strings

---

## S07 — Podešavanja / privatnost / legal / podrška

**Purpose:** Provide account, privacy, notification, legal and support controls with explicit lifecycle consequences.

**Current physical status:** **MISSING TARGET** — No complete settings/privacy/legal/support/account-lifecycle surface. Account close/anonymization backend remains missing.

**Layout order:**
- Detail header.
- Sectioned disclosure rows.
- Danger zone at bottom.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| S07-E01 | Back button | Nazad | Always / When visible | Back → Previous | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E02 | Row | Podaci naloga | Always / When visible | Open account details → Account detail | Profile/auth projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E03 | Row | Bezbednost | Always / When visible | Open security → Security detail | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E04 | Row | Obaveštenja | Always / When visible | Open notification preferences → Notification prefs | Notification preferences | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E05 | Row | Privatnost i lokacija | Always / When visible | Open privacy controls → Privacy detail | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E06 | Row | Preuzmite svoje podatke | Always / When visible | Request/export data → Same screen | Account export backend | L: Show request progress/history if asynchronous · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E07 | Row | Uslovi korišćenja | Always / When visible | Open legal doc → Legal detail | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E08 | Row | Politika privatnosti | Always / When visible | Open legal doc → Legal detail | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E09 | Row | Centar za pomoć | Always / When visible | Open help → Help | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E10 | Row | Prijavite problem | Always / When visible | Open support report → Support form | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E11 | Row | Odjava | Always / When visible | Confirm sign out → S01/S03 | Session | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| S07-E12 | Danger row | Zatvorite nalog | Always / When visible | Open consequence confirmation → Account close flow | Account lifecycle backend | L: Blocking only after explicit final confirm · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Rows can render; server-backed preference values skeleton individually.
- **error:** Per-section retry where possible.
- **offline:** Local legal/help may remain available; mutations disabled or explicit offline.

**Business / privacy / authority rules:**
- Account closure must follow retention/anonymization contract.
- Do not imply export/close exists until backend is implemented.

**Premium enhancement allowed:**
- Show current preference summary at row trailing edge.
- Danger zone visually separated, not visually dominant.

**Do not add / do not fake:**
- Random theme settings unless product supports them
- One-tap irreversible account deletion

---

# MENI TREBA

## R02 — Novi Zadatak — AI

**Purpose:** Turn natural-language requester intent into a structured task draft while keeping humans in control.

**Current physical status:** **STRONG / LIVE-BOUND** — Current nova.tsx has real AI conversation + live draft. RU-2/Edge v5 and typed Need V2 foundation are live.

**Layout order:**
- Detail/main header.
- Live draft summary card.
- Scrollable conversation.
- Optional context suggestion chips.
- Sticky composer above keyboard.
- Review CTA.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R02-E01 | Header | Novi Zadatak | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E02 | Live draft card | Nacrt Zadatka | Always / When visible | Open human review → R07 | AI facts projection + human-confirmed state | L: Skeleton facts while first conversation loads · E: No special error · O: Works locally · S: Re-read conversation/facts on focus |
| R02-E03 | Status counters | Potvrđeno X · Čeka Y | Always / When visible | None → Same screen | Fact confirmation projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E04 | AI bubble | AI pitanje/sažetak | Always / When visible | None → Same screen | Persisted AI conversation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E05 | User bubble | Korisnička poruka | Always / When visible | None → Same screen | Persisted AI conversation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E06 | Suggestion chips | Predloženi kratki odgovor | Only when suggestion is genuinely useful and non-authoritative / When visible | Insert/send suggestion → Same screen | Local suggestion; server still processes user message | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E07 | Composer input | Napišite šta Vam treba… | Always / Not BLOCKED and not current send in-flight | None → Same screen | Local draft | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E08 | Send icon button | Pošalji | Always / When visible | Send conversation turn → Same screen | AI Edge + persistence | L: Disable duplicate send; show sending state · E: Keep unsent text or explicit retry; never fabricate AI reply · O: Keep text locally; explain internet needed · S: Re-read when screen focuses |
| R02-E09 | Voice button | Glas | Only when real transcription service exists / When visible | Start/stop transcription → Same screen | Transcription service | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E10 | Primary button | Pregledajte nacrt | At least one usable fact/draft exists / When visible | Open review → R07 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E11 | Policy notice | Potrebna dodatna provera | Policy state REVIEW / When visible | None → Same screen | Policy decision projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R02-E12 | Block notice | Ovaj Zadatak ne može da se nastavi | Policy BLOCK / No publish/save bypass | None → Same screen | Policy decision | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Conversation skeleton + draft skeleton.
- **empty:** First AI prompt + examples, examples disappear after first message.
- **sending:** Composer retained, send disabled.
- **review:** Warning; conversation may continue if policy permits.
- **blocked:** No save/publish path.
- **offline:** Conversation readable if cached; sending disabled.
- **error:** Retry conversation load/turn.

**Business / privacy / authority rules:**
- AI proposes; human confirms; server authorizes.
- PRIVATE facts never become public because AI inferred them.
- Voice hidden until real transcribe service exists.

**Premium enhancement allowed:**
- Live draft card animates only changed fact rows.
- One ambiguity per AI question where possible.
- Keyboard-safe sticky composer.

**Do not add / do not fake:**
- AI auto-publish
- Fake voice button
- Unbounded decorative chips

---

## R03 — Zadaci

**Purpose:** Requester task list organized by what needs attention, what is active and what is finished.

**Current physical status:** **PARTIAL** — Current requester task list exists but shell/terminology and final attention/state treatment require canonical redesign.

**Layout order:**
- Main header with bell/avatar.
- Sectioned vertical list.
- Bottom requester nav.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R03-E01 | Header title | Zadaci | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E02 | Icon button | Obaveštenja | Always / When visible | Open inbox → S06 | Unread projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E03 | Avatar button | Profil | Always / When visible | Open requester profile → R09 | Profile projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E04 | Section | Čeka Vas | At least one attention task / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E05 | Task card | Zadatak | Always / When visible | Open task workspace → R04 | Requester task projection | L: No special loading · E: No special error · O: Works locally · S: R04 re-reads exact task |
| R03-E06 | Section | Aktivni | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E07 | Section | Završeni | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E08 | Pull to refresh | Osvežite | Always / When visible | Re-read task list → Same screen | Server read | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E09 | Empty CTA | Napravite prvi Zadatak | No tasks / When visible | Create task → R02 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E10 | Bottom nav center | U / Novi | Always / When visible | Create task → R02 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R03-E11 | Bottom nav right | Dogovori | Always / When visible | Open requester dogovori → R08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** 2–3 TaskCard skeletons.
- **empty:** Illustrated/brand-light empty + create CTA.
- **error:** Retry; never fake empty.
- **offline:** Cached list if safe + offline banner.
- **stale:** Cards may show old snapshot but detail always re-reads.

**Business / privacy / authority rules:**
- User-facing term is Zadatak, not Potreba.
- No permanent Home tab.

**Premium enhancement allowed:**
- Attention badge such as “3 nove Prijave”.
- Upcoming time emphasis.
- Pull-to-refresh.

**Do not add / do not fake:**
- Search until task volume justifies it
- Fake status counts

---

## R04 — Radni prostor Zadatka

**Purpose:** Single authoritative control center for one task: facts, coverage, applications, selected participants and allowed lifecycle actions.

**Current physical status:** **PARTIAL / GATED** — Task workspace exists. Owner-edit authority is live; publish engine exists but production D0140 ALLOW remains fail-closed; current edit-route gap must not be hidden by design.

**Layout order:**
- Detail header.
- Hero task summary.
- Optional next-action card.
- Coverage card.
- Applications card.
- Participant/Dogovor summary.
- Secondary lifecycle actions.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R04-E01 | Back button | Nazad | Always / When visible | Back to tasks → R03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E02 | Overflow | Više opcija | At least one contextual secondary action exists / When visible | Open action sheet → R04 action sheet | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E03 | Hero card | Zadatak — naslov/status | Always / When visible | None → Same screen | Task authoritative projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E04 | Metadata row | Lokacija | Always / When visible | None → Same screen | Privacy-safe task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E05 | Metadata row | Termin | Always / When visible | None → Same screen | Task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E06 | Metadata row | Cena / način | Always / When visible | None → Same screen | Task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E07 | Next-action card | Sledeći korak | There is exactly one meaningful requester action / When visible | Open relevant action → R05/D06/etc | Derived from server state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E08 | Coverage card | Dogovoreno Y od X | Always / When visible | None → Same screen | Covered slots projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E09 | Applications card | Prijave · N | Task state allows applications/history / When visible | Open candidates → R05 | Candidate count/projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E10 | Participant stack | Uskočeri | At least one selected participant / When visible | Open task-centered Dogovor → D01 | Dogovor aggregate projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E11 | Secondary button | Izmenite Zadatak | Server lifecycle allows edit / When visible | Open real edit flow → R02/R07 edit mode | RU4 edit authority | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E12 | Secondary button | Ne tražite više nikoga | Partially filled + search still open / When visible | Open consequence confirmation then close remaining search → Same screen | rpc_close_remaining_search | L: Button/sheet-local · E: No special error · O: Disabled · S: Re-read when screen focuses |
| R04-E13 | Danger action | Otkažite Zadatak | Lifecycle allows requester cancel / When visible | Open cancellation consequence sheet → D05/R04 | Server cancellation authority | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R04-E14 | Primary button | Objavite Zadatak | DRAFT + canonical publication authority available / Policy and required facts allow publish | Publish canonical task → R04 published | Canonical publish RPC + policy gate | L: “Objavljujemo…” · E: Policy REVIEW/BLOCK or server validation mapped explicitly · O: Disabled · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Hero/coverage skeleton.
- **draft:** Show DRAFT-only actions.
- **published:** Applications/search controls.
- **partially_filled:** Coverage + close remaining search available.
- **full:** No more selection action.
- **closed:** Read-only history.
- **cancelled:** Read-only + reason/state.
- **error:** Retry current projection.
- **stale:** Full authoritative reread on focus.

**Business / privacy / authority rules:**
- Coverage derives from server authority, not local arithmetic only.
- Publication hidden/fail-closed when policy not active.
- Cancellation of one participant is not same as cancelling whole task.

**Premium enhancement allowed:**
- Sticky compact title/status on long scroll.
- Participant avatar stack.
- State-aware next-action card.

**Do not add / do not fake:**
- Dead edit route
- Manual covered_slots editing
- Public exact address

---

## R05 — Prijave / izbor

**Purpose:** Compare current selectable candidates and perform atomic Selection with explicit consequences and retry safety.

**Current physical status:** **STRONG CORE / PARTIAL UI** — Candidate projection + selection revalidation + semantic idempotency + zero-cost requester connection activation are live. Current UI still lacks full canonical candidate/profile/capacity/premium consequence treatment.

**Layout order:**
- Detail header.
- Capacity summary.
- Candidate card list.
- Selection confirmation bottom sheet.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R05-E01 | Back button | Nazad | Always / When visible | Back → R04 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E02 | Capacity summary | Potrebno X · Dogovoreno Y · Preostalo Z | Always / When visible | None → Same screen | Task/candidate projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E03 | Candidate card | Uskočer | Always / When visible | None/whole card may open preview → Same screen | Candidate projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E04 | Profile action | Pogledajte profil | Always / When visible | Open public profile → R06 | Public profile projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E05 | Rating line | Ocena / nema recenzija | Always with explicit null state / When visible | None → Same screen | Real review projection only | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E06 | Price row | Cena | Always / When visible | None → Same screen | Application version projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E07 | Capacity row | Pokriva N mesta | Always / When visible | None → Same screen | Application version | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E08 | Primary button | Izaberi | Candidate state SELECTABLE / No selection mutation in flight | Open selection confirmation sheet → Selection sheet | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E09 | State badge | Zadatak promenjen / Izabrano / Povučeno / Popunjeno | Non-selectable state / When visible | None → Same screen | Candidate eligibility projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E10 | Confirmation sheet | Izabrati Marka? | Always / When visible | Review exact effect → Same screen | Current candidate/task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E11 | Confirmation fact | Cena · mesta · Dogovor nastaje odmah | Always / When visible | None → Same screen | Current version-bound application + task | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R05-E12 | Confirm button | Potvrdite izbor | Always / When visible | Call atomic Selection → D01/R04 | rpc_select_response + semantic request receipt target | L: Disable entire selection action; “Biramo…” · E: Map stale/full/not-ready/capacity errors; re-read list · O: Disabled; do not generate endless fresh IDs · S: Re-read task revision + candidate version/hash before/after |
| R05-E13 | Pull to refresh | Osvežite | Always / When visible | Re-read candidates → Same screen | Server read | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Candidate skeletons.
- **empty:** No applications yet + calm guidance.
- **selecting:** Only one Selection command in flight.
- **unknown_outcome:** Show “Proveravamo da li je izbor već napravljen…” and re-read before retry.
- **stale:** Candidate card updates with reason.
- **full:** All Select CTAs disappear/disable.
- **error:** Actionable stable copy.

**Business / privacy / authority rules:**
- Selection immediately creates Dogovor; no second bilateral confirmation.
- Server revalidates task revision, application version/hash, worker readiness, team capacity, remaining capacity and future conflict rules.
- No fake ratings.

**Premium enhancement allowed:**
- Selection effect confirmation.
- Compact candidate passport.
- Optional profile preview sheet before full profile.

**Do not add / do not fake:**
- Fresh request ID on every retry
- Candidate compare table in V1
- Fake '98% match' score

---

## R06 — Javni profil

**Purpose:** Show a privacy-safe Profile Passport using only real public projection data.

**Current physical status:** **BACKEND LIVE / UI MISSING** — Public-safe profile projection rpc_get_public_profile is live; final public Profile Passport surface is not complete.

**Layout order:**
- Detail header.
- Profile passport hero.
- Review/trust summary.
- Bio.
- Capabilities sections.
- Optional show-all expansion.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R06-E01 | Back button | Nazad | Always / When visible | Back → Previous | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E02 | Avatar/photo | Fotografija | Always / When visible | None → Same screen | Public profile projection/storage | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E03 | Identity line | Ime + grad | Always / When visible | None → Same screen | Public projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E04 | Rating | Ocena · broj recenzija / Još nema recenzija | Always / When visible | None → Same screen | Real review aggregate only | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E05 | Bio | O meni | Always / When visible | None → Same screen | Public profile projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E06 | Skill chips | Veštine | Always / When visible | None → Same screen | Public profile projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E07 | Vehicle cards | Vozila | Public vehicle data exists / When visible | None → Same screen | Public projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E08 | Tool chips | Alat | Public tool data exists / When visible | None → Same screen | Public projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E09 | Experience | Iskustvo | Real data exists / When visible | None → Same screen | Public projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E10 | Licence/trust row | Dozvole / verifikacija | Only if actually verified/authorized public trust datum exists / When visible | None → Same screen | Server trust projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R06-E11 | Show all | Prikaži sve | Collapsed content exists / When visible | Expand section → Same screen | Local | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Passport + section skeleton.
- **not_found:** Profile unavailable; back action.
- **no_reviews:** Explicit text state, not 0.0 star.
- **partial:** Hide empty capability sections rather than show placeholders.
- **error:** Retry public projection.

**Business / privacy / authority rules:**
- Never expose phone, email, exact address, identity docs or private AI facts.
- Verified badge only if identity admission is real.
- Worker-to-worker private terms never appear here.

**Premium enhancement allowed:**
- Smart chip collapse +N.
- Compact trust hierarchy.
- Deterministic initials fallback if no photo.

**Do not add / do not fake:**
- Fake verified badge
- Hardcoded 4.9/18
- Public phone before grant

---

## R07 — Human Review Zadatka

**Purpose:** Make every meaningful AI-derived fact explicit and human-confirmed before saving a draft.

**Current physical status:** **STRONG / LIVE-BOUND** — Human Review + explicit confirm/correct + DRAFT materialization is among the strongest current flows.

**Layout order:**
- Header/back.
- Progress summary.
- Missing-required notice.
- Fact card list.
- DRAFT-only sticky save action.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R07-E01 | Back button | Nazad | Always / When visible | Return to AI conversation → R02 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E02 | Progress summary | Potvrđeno X od Y | Always / When visible | None → Same screen | Fact projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E03 | Missing notice | Još nedostaje… | Required facts missing / When visible | None → Same screen | Server/client fact registry | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E04 | Fact card | Naziv činjenice + vrednost | Always / When visible | None → Same screen | Current canonical fact | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E05 | Privacy badge | Privatno | Fact privacy PRIVATE / When visible | Open privacy explainer sheet → Same screen | Fact registry privacy | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E06 | Quiet button | Izmenite | Always / When visible | Edit simple fact inline or return to R02 for complex fact → Inline/R02 | Human correction RPC | L: Card-local · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E07 | Secondary/primary small button | Potvrdite | Fact not yet human-confirmed / When visible | Confirm fact → Same screen | Human confirmation RPC | L: Card-local; prevent double confirm · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E08 | Info text | Još nije objava. | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R07-E09 | Primary button | Sačuvajte kao nacrt | Always / Required save preconditions satisfied and no mutation in flight | Save/reuse DRAFT → R04 | Canonical DRAFT save RPC | L: “Čuvamo nacrt…” · E: Keep review state; map stable server error · O: Disabled with explanation · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Fact skeletons.
- **missing:** Save disabled/why text.
- **saving:** Sticky CTA loading.
- **error:** Inline/global retry without losing confirmations.
- **stale:** Re-read facts; show changed fact if server revision moved.
- **success:** Navigate to R04 canonical task draft.

**Business / privacy / authority rules:**
- DRAFT save is not publication.
- Complex edits must not silently mutate unrelated facts.
- PRIVATE badge meaning is explainable.

**Premium enhancement allowed:**
- Collapse already-confirmed cards after review while keeping expand.
- Change-highlight after correction.

**Do not add / do not fake:**
- Batch 'confirm all' unless policy explicitly allows
- Publication CTA on this screen

---

## R08 — Dogovori — MENI TREBA

**Purpose:** Requester list of task-centered Dogovor aggregates, not implementation-level Agreement rows.

**Current physical status:** **PARTIAL** — Agreement list read owner is canonical; final requester task-centered Dogovori grouping/attention presentation needs redesign.

**Layout order:**
- Main header bell/avatar.
- Sections Čeka Vas / Aktivni / Završeni.
- Task-centered Dogovor cards.
- Requester bottom nav.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R08-E01 | Header title | Dogovori | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E02 | Bell | Obaveštenja | Always / When visible | Open inbox → S06 | Unread projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E03 | Avatar | Profil | Always / When visible | Open profile → R09 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E04 | Section | Čeka Vas | At least one actionable Dogovor / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E05 | Dogovor card | Zadatak / status | Always / When visible | Open task-centered Dogovor → D01 | Dogovor aggregate projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E06 | Participant stack | Učesnici | Always / When visible | None → Same screen | Authorized aggregate participant projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E07 | Attention line | Potvrdite završetak / Nova poruka / Predlog izmene | Action pending / When visible | None → Same screen | Server-derived next action | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E08 | Pull to refresh | Osvežite | Always / When visible | Re-read aggregates → Same screen | Server read | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E09 | Bottom nav left | Zadaci | Always / When visible | Open tasks → R03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R08-E10 | Bottom nav center | U / Novi | Always / When visible | New task → R02 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Dogovor card skeletons.
- **empty:** No Dogovori yet + link back to Zadaci.
- **error:** Retry.
- **offline:** Cached read if safe.
- **terminal:** Završeni section remains readable.

**Business / privacy / authority rules:**
- One card per task aggregate where final canon requires it.
- Participant-specific Agreements remain underneath, not duplicated as top-level cards.

**Premium enhancement allowed:**
- Avatar stack.
- Next-action line.
- Unread message badge.

**Do not add / do not fake:**
- One card per hidden DB agreement
- Fake participant terms visible to everyone

---

## R09 — Profil — MENI TREBA

**Purpose:** Requester profile hub with real account data and an explicit switch to worker intent.

**Current physical status:** **VISIBLE PROTOTYPE / UNRELIABLE** — Current profile screen contains hardcoded demo identity/rating values and visual rows without complete destinations. Must be rebuilt on real projections.

**Layout order:**
- Profile passport header.
- Mode switch card.
- Profile/settings rows.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| R09-E01 | Back button | Nazad | Always / When visible | Back → Previous | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E02 | Avatar/photo | Profilna fotografija | Always / When visible | None → Same screen | Real profile data | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E03 | Identity | Ime + grad | Always / When visible | None → Same screen | Real profile data | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E04 | Rating | Ocena / nema recenzija | Always / When visible | None → Same screen | Real requester review projection when implemented | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E05 | Mode switch card | Pređite na JA MOGU | Always / When visible | Switch current intent → W03/W02/W08 based readiness | Intent store + worker readiness | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E06 | Row | Javni profil | Always / When visible | Open public profile → R06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E07 | Row | Recenzije | Review feature implemented / When visible | Open reviews → Reviews | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E08 | Row | Podešavanja | Always / When visible | Open settings → S07 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| R09-E09 | Worker setup card | Želite i da uskačete? | Worker profile absent/incomplete / When visible | Start worker profile → W02/W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Passport skeleton.
- **partial:** Hide unimplemented reviews row or label coming/not available only if approved.
- **error:** Retry profile.
- **worker_not_ready:** Mode switch routes to setup guidance.

**Business / privacy / authority rules:**
- No hardcoded initials/name/rating.
- Same account across intents.

**Premium enhancement allowed:**
- Real avatar fallback initials.
- Readiness hint if worker setup incomplete.

**Do not add / do not fake:**
- Permanent profile tab
- Fake review count

---

# JA MOGU

## W02 — Radni profil — AI

**Purpose:** Conversationally build structured worker capability facts, then require human review before server readiness activation.

**Current physical status:** **MISSING CANONICAL** — No complete worker AI-profile flow. Worker readiness authority exists, but AI worker-profile product surface is not end-to-end proven.

**Layout order:**
- Header.
- Live worker-profile facts card.
- Conversation.
- Suggestion chips.
- Sticky composer.
- Review CTA.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W02-E01 | Header | Radni profil | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W02-E02 | Live profile card | Šta smo razumeli | Always / When visible | None → Same screen | Worker AI facts projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W02-E03 | Fact chip | Veštine / alat / vozila / radijus / tim | Always / When visible | None → Same screen | AI-proposed/human-confirmed facts | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W02-E04 | AI bubble | Pitanje o sposobnosti | Always / When visible | None → Same screen | Persisted worker AI conversation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W02-E05 | Suggestion chip | Dodajte nosivost / sedišta / radijus | Suggestion derives from user-stated fact; never auto-write / When visible | Insert suggested topic → Same screen | Local UX suggestion | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W02-E06 | Composer | Opišite šta umete i možete… | Always / When visible | None → Same screen | Local input | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W02-E07 | Send button | Pošalji | Always / When visible | Persist/process worker AI turn → Same screen | Worker AI service (future/implemented when available) | L: Disable duplicate send · E: No special error · O: Keep draft, explain internet needed · S: Re-read when screen focuses |
| W02-E08 | Primary button | Pregledajte Radni profil | Usable facts exist / When visible | Open structured review/edit → W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Conversation/fact skeleton.
- **empty:** Focused starter examples.
- **sending:** Composer retained.
- **error:** Retry without losing text.
- **offline:** Read cached profile; sending disabled.
- **not_implemented_backend:** Do not expose as active production path.

**Business / privacy / authority rules:**
- AI must not invent licences, verified identity, team capacity or capabilities not stated.
- Server owns ACTIVE/readiness.

**Premium enhancement allowed:**
- Capability suggestion chips.
- One ambiguity at a time.
- Live structured preview.

**Do not add / do not fake:**
- AI auto-activate
- Fake licence verification

---

## W03 — Zadaci — Lista / Mapa

**Purpose:** Discover server-authorized task opportunities through one result set represented as either List or Map.

**Current physical status:** **PARTIAL / BROKEN NAV** — Real discovery list projection exists, but current UI still has obsolete Lista/Mapa/Kombinovano, placeholder map, and task card without canonical navigation.

**Layout order:**
- Main header bell/avatar.
- Search/filter row if supported.
- Two-segment Lista | Mapa.
- List OR map body.
- Worker bottom nav.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W03-E01 | Header title | Zadaci | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E02 | Bell | Obaveštenja | Always / When visible | Inbox → S06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E03 | Avatar | Radni profil | Always / When visible | Open worker profile → W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E04 | Segment | Lista | Always / When visible | Show list → Same screen | Local presentation of same result set | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E05 | Segment | Mapa | Real map provider is connected / When visible | Show map → Same screen | Same discovery projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E06 | Filter button | Filteri · N | Always / When visible | Open filter sheet → Filter sheet | Discovery filter state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E07 | Task card | Zadatak | Always / When visible | Open task detail → W04 | Server discovery projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E08 | Requester passport | Naručilac | Always / When visible | None → Same screen | Public requester projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E09 | Map pin | Zadatak pin | Map mode / When visible | Select task + show mini-card → Same screen | Privacy-safe coordinates/coarse location | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E10 | Map mini-card | Zadatak summary | Pin selected / When visible | Open W04 → W04 | Same discovery result | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E11 | Quick filter | Blizu mene | Location authority/fallback supported / When visible | Apply distance/location filter → Same screen | Profile/device coarse location policy | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E12 | Pull to refresh | Osvežite | List mode / When visible | Re-read discovery → Same screen | Server read | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E13 | Empty action | Promenite dostupnost | No matches / When visible | Open availability → W09 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E14 | Empty action | Uredite Radni profil | No matches / When visible | Open profile → W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E15 | Bottom nav left | Prijave | Always / When visible | Open my applications → W06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E16 | Bottom nav center | U / Zadaci | Always / When visible | Stay/open discovery → W03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W03-E17 | Bottom nav right | Dogovori | Always / When visible | Open worker Dogovori → W07 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** List skeletons; map loading overlay if map selected.
- **empty:** Explain no matching tasks + profile/availability actions.
- **error:** Retry discovery; do not fall back to fake opportunities.
- **offline:** Cached list only if clearly marked; no stale eligibility assumption.
- **map_unavailable:** Hide Mapa segment, do not show placeholder.
- **stale:** Opening W04 always re-reads task detail.

**Business / privacy / authority rules:**
- No Kombinovano final mode.
- List and Map use the same authoritative result set.
- Pins never reveal private exact address.
- No raw client-side match score presented as authority.

**Premium enhancement allowed:**
- List↔Map selection sync.
- Filter memory locally.
- Filter count badge.
- Selected map pin turns orange / card highlight.

**Do not add / do not fake:**
- Placeholder map
- Dead cards
- Permanent Kombinovano
- Saved tasks unless owner approves new state

---

## W04 — Detalj Zadatka

**Purpose:** Give the worker enough information to decide whether to apply, while preserving privacy and adapting CTA to actual state.

**Current physical status:** **PARTIAL** — Task detail route exists. Public requester trust/profile and several target details/states are incomplete; preselection Q&A remains blocked.

**Layout order:**
- Detail header.
- Task hero/detail.
- Requester passport.
- Requirements/media sections.
- Sticky state-aware CTA.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W04-E01 | Back button | Nazad | Always / When visible | Back → W03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E02 | Hero | Naslov + status | Always / When visible | None → Same screen | Opportunity/task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E03 | Location row | Oblast / ruta | Always / When visible | None → Same screen | Privacy-safe projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E04 | Time row | Termin | Always / When visible | None → Same screen | Task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E05 | Capacity row | Preostalo mesta | Always / When visible | None → Same screen | Current coverage projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E06 | Price row | Cena / način | Always / When visible | None → Same screen | Task pricing projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E07 | Requester passport | Naručilac | Always / When visible | Open public requester profile if supported → R06 | Public profile projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E08 | Requirements | Veštine / alat / vozilo / dozvole | Always / When visible | None → Same screen | Task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E09 | Media gallery | Fotografije | Need media backend exists and files present / When visible | None → Same screen | Need media storage | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E10 | Sticky CTA | Prijavite se | Eligible + no active application + task open / When visible | Open application composer → W05 | Current task/worker readiness | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E11 | Sticky CTA | Pogledajte svoju Prijavu | Active application exists / When visible | Open application status → W06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E12 | Sticky CTA | Proverite promene | Application stale due task revision / When visible | Open stale resolution → W06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E13 | Sticky CTA | Otvorite Dogovor | Selected / When visible | Open Dogovor → D01 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E14 | Blocking CTA | Završite Radni profil | Worker not ready and task otherwise available / When visible | Open worker profile setup → W02/W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W04-E15 | Closed notice | Prijave su zatvorene | Task closed/full/terminal / No submit action | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Hero/sections skeleton.
- **open:** Apply CTA.
- **applied:** View Application CTA.
- **stale:** Check changes CTA.
- **selected:** Open Dogovor.
- **closed:** Read-only.
- **not_ready:** Profile setup CTA.
- **error:** Retry detail.
- **offline:** Readable cached detail, but never assume current eligibility.

**Business / privacy / authority rules:**
- CTA is state-aware, never multiple conflicting primary actions.
- Exact location remains hidden until proper Dogovor authority.
- Requirements shown only if real.

**Premium enhancement allowed:**
- Sticky CTA.
- Expandable long description.
- Grouped requirement chips only when present.

**Do not add / do not fake:**
- Apply directly without W05 confirmation
- Fake photos
- Public exact pin

---

## W05 — Sastavi Prijavu

**Purpose:** Create a precise version-bound application with safe retry behavior and a clear summary before sending.

**Current physical status:** **STRONG / LIVE-BOUND** — Atomic application submit is live with semantic retry pattern. Final structured composition/summary/polish still required.

**Layout order:**
- Detail header.
- Task context card.
- Capacity stepper.
- Price block.
- Optional note.
- Inline summary.
- Sticky send CTA.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W05-E01 | Back button | Nazad | Always / When visible | Back → W04 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E02 | Context card | Zadatak + termin + oblast | Always / When visible | None → Same screen | Current opportunity projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E03 | Stepper | Koliko mesta pokrivate | Always / When visible | Plus/minus bounded value → Same screen | Current remaining capacity + worker team capacity | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E04 | Icon button | Smanji | Always / When visible | Decrease by 1 → Same screen | Local bounded state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E05 | Icon button | Povećaj | Always / When visible | Increase by 1 → Same screen | Local bounded state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E06 | Price field | Vaša cena | OFFERS/editable mode / When visible | None → Same screen | Application input + task mode | L: No special loading · E: Numeric/limits inline · O: Works locally · S: Re-read when screen focuses |
| W05-E07 | Price display | Cena Naručioca | MY_PRICE/read-only mode / Read-only | None → Same screen | Task price authority | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E08 | Text area | Napomena | Always / When visible | None → Same screen | Application input | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E09 | Summary card | Prijavljujete se za… | Always / When visible | None → Same screen | Local form + current task facts | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W05-E10 | Primary button | Pošaljite Prijavu | Always / When visible | Submit version-bound application → W06 | rpc_submit_response/current submit service | L: “Šaljemo Prijavu…”; keep semantic request ID · E: Known validation → show reason; unknown transport → do not create new ID · O: Disabled; keep form locally · S: On stale task revision, re-read and require user to review changes |

**Screen states:**
- **loading:** Context skeleton.
- **editing:** Form active.
- **submitting:** CTA local progress.
- **unknown_outcome:** “Proveravamo da li je Prijava već poslata…” + reread.
- **stale:** Block submit until current task reviewed.
- **success:** Navigate/show W06 authoritative application.
- **error:** Preserve user inputs.

**Business / privacy / authority rules:**
- One semantic request ID per unchanged application intent across unknown outcome retries.
- MY_PRICE remains read-only if server mode says so.
- Server still revalidates remaining capacity/readiness.

**Premium enhancement allowed:**
- Capacity stepper.
- Inline send summary.
- No modal unless consequence needs it.

**Do not add / do not fake:**
- Free-text slots field
- New request ID on network timeout
- Editable requester-fixed price

---

## W06 — Moje Prijave

**Purpose:** Track application lifecycle, resolve stale applications and move selected applications into Dogovor.

**Current physical status:** **STRONG / LIVE-BOUND** — My Applications projection + withdraw and stale handling are live; final canonical grouping/attention/premium state treatment still required.

**Layout order:**
- Main header bell/avatar.
- Sections Čeka Vas / Aktivne / Završene.
- Application cards.
- Worker bottom nav.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W06-E01 | Header | Prijave | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E02 | Bell | Obaveštenja | Always / When visible | Inbox → S06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E03 | Avatar | Radni profil | Always / When visible | Profile → W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E04 | Application card | Prijava + Zadatak | Always / When visible | None → Same screen | My applications projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E05 | Status badge | Poslata / pregledana / stale / selected… | Always / When visible | None → Same screen | Application projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E06 | Change diff | Šta se promenilo | Application STALE / When visible | None → Same screen | Old bound revision vs current task projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E07 | Action | Zadržite | STALE + KEEP available / When visible | Resolve stale KEEP → Same screen | Resolve stale RPC | L: Card-local · E: No special error · O: Disabled · S: Re-read when screen focuses |
| W06-E08 | Action | Izmenite | STALE + UPDATE available / When visible | Open/update application → W05/edit mode | Stale resolution contract | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E09 | Danger/secondary | Povucite | Withdrawal allowed / When visible | Confirm then withdraw → Same screen | rpc_withdraw_response | L: Card-local; stable request ID · E: No special error · O: Disabled · S: Re-read when screen focuses |
| W06-E10 | Primary | Otvorite Dogovor | SELECTED / When visible | Open Dogovor → D01 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E11 | Pull to refresh | Osvežite | Always / When visible | Re-read applications → Same screen | Server read | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E12 | Bottom nav center | U / Zadaci | Always / When visible | Open discovery → W03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W06-E13 | Bottom nav right | Dogovori | Always / When visible | Open Dogovori → W07 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Application skeletons.
- **empty:** No applications + open Zadaci CTA.
- **active:** Normal status.
- **stale:** Diff + choices.
- **selected:** Strong Dogovor CTA.
- **withdrawn/closed:** Read-only terminal card.
- **error:** Retry projection.
- **offline:** Cached read; mutations disabled.

**Business / privacy / authority rules:**
- Stale state is explicit, never silently auto-kept.
- Withdraw retries keep same semantic command ID where required.
- Selected application transitions to Dogovor, not a second confirmation.

**Premium enhancement allowed:**
- “Šta se promenilo” diff.
- Attention grouping.
- State-aware card CTA.

**Do not add / do not fake:**
- Hidden stale auto-resolution
- Fake shortlist state unless backend emits it

---

## W07 — Dogovori — JA MOGU

**Purpose:** Worker list of task-centered Dogovori with only viewer-authorized terms and next actions.

**Current physical status:** **PARTIAL** — Shared agreement list exists; final worker-specific task-centered grouping and attention presentation need redesign.

**Layout order:**
- Main header bell/avatar.
- Sections Čeka Vas / Aktivni / Završeni.
- Dogovor cards.
- Worker bottom nav.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W07-E01 | Header | Dogovori | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E02 | Bell | Obaveštenja | Always / When visible | Inbox → S06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E03 | Avatar | Radni profil | Always / When visible | Profile → W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E04 | Dogovor card | Zadatak + status | Always / When visible | Open Dogovor → D01 | Worker-authorized aggregate projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E05 | Own terms | Vaša cena · Vaša mesta | Always / When visible | None → Same screen | Viewer-specific Agreement | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E06 | Attention line | Nova poruka / izmena / završetak | Action pending / When visible | None → Same screen | Server-derived next action | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E07 | Unread badge | N | Unread messages > 0 / When visible | None → Same screen | Inbox/message unread projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E08 | Pull to refresh | Osvežite | Always / When visible | Re-read Dogovori → Same screen | Server read | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E09 | Bottom nav left | Prijave | Always / When visible | Open applications → W06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W07-E10 | Bottom nav center | U / Zadaci | Always / When visible | Open discovery → W03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Cards skeleton.
- **empty:** No Dogovori yet + discover CTA.
- **attention:** Move to Čeka Vas.
- **terminal:** Završeni readable.
- **error:** Retry.
- **offline:** Cached read if safe.

**Business / privacy / authority rules:**
- Worker never sees another worker's private commercial terms.
- Task context may show participant count only where authorized.

**Premium enhancement allowed:**
- Unread message badge.
- Next-action summary.

**Do not add / do not fake:**
- Other workers' prices
- Implementation-level Agreement IDs

---

## W08 — Radni profil

**Purpose:** Structured, editable worker capability profile with server-owned readiness and clear availability access.

**Current physical status:** **PARTIAL MANUAL** — Manual worker profile route exists and readiness authority is live; canonical structured profile + AI-assisted edit + availability summary are incomplete.

**Layout order:**
- Detail/main profile header.
- Readiness card.
- Structured capability sections.
- Availability summary.
- Save/edit actions.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W08-E01 | Back button | Nazad | Always / When visible | Back → Previous/W03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E02 | Passport | Ime + grad + foto | Always / When visible | None → Same screen | Worker profile projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E03 | Readiness card | Radni profil je spreman / Još nedostaje… | Always / When visible | None → Same screen | Server readiness projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E04 | Skill chips | Veštine | Always / When visible | None → Same screen | Worker profile | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E05 | Vehicle cards | Vozila | Always / When visible | None → Same screen | Worker profile | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E06 | Tool chips | Alat | Always / When visible | None → Same screen | Worker profile | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E07 | Team capacity | Koliko ljudi možete povesti | Always / When visible | None → Same screen | Worker profile/team_capacity | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E08 | Experience | Iskustvo | Always / When visible | None → Same screen | Worker profile | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E09 | Licences | Dozvole | Real data exists / When visible | None → Same screen | Worker profile/trust authority | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E10 | Radius | Područje rada / radijus | Always / When visible | None → Same screen | Worker profile | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E11 | Availability summary | Dostupnost | Always / When visible | Open calendar → W09 | Availability projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E12 | Switch | Dostupan sam sada | Feature semantics supported / When visible | Update available-now → Same screen | Worker profile/availability service | L: Row-local · E: No special error · O: Disabled or explicit queued behavior if supported · S: Re-read when screen focuses |
| W08-E13 | Secondary button | Uredite uz AI | W02 backend/path available / When visible | Open AI edit → W02 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E14 | Secondary button | Pogledajte javni profil | Always / When visible | Open public profile → R06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W08-E15 | Primary button | Sačuvajte | Manual edits pending / When visible | Save profile → Same screen | Worker profile service/server readiness | L: “Čuvamo…” · E: Inline field/server reason · O: Keep draft locally; no fake success · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Structured section skeleton.
- **ready:** Server ACTIVE/readiness state.
- **incomplete:** Explicit missing requirements.
- **editing:** Unsaved change indicator.
- **saving:** Button-local.
- **error:** Keep draft.
- **offline:** Read cache, save disabled/queued only if contract supports.

**Business / privacy / authority rules:**
- Server owns ACTIVE/readiness.
- No comma-separated mega fields in final UI.
- Do not expose HITNO promises while urgent activation is off.

**Premium enhancement allowed:**
- Capability suggestions from related facts.
- Smart chip collapse.
- Clear readiness reasons.

**Do not add / do not fake:**
- Fake completeness percent
- AI auto-verify licences
- HITNO toggle before E2E support

---

## W09 — Dostupnost / kalendar

**Purpose:** Let workers express availability while displaying immutable confirmed Dogovor commitments and supporting future hard conflict checks.

**Current physical status:** **MISSING / BACKEND FOUNDATION ONLY** — Availability tables exist, but hard calendar conflict/commitment authority is not closed and no complete calendar surface is present.

**Layout order:**
- Detail header.
- Quick actions.
- Week/day calendar.
- Legend.
- Availability edit sheet.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| W09-E01 | Back button | Nazad | Always / When visible | Back → W08 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E02 | Quick action | Danas sam dostupan | Always / When visible | Create availability for remaining day after confirm if needed → Same screen | Availability service | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E03 | Quick action | Nisam dostupan danas | Always / When visible | Create unavailable block after consequence check → Same screen | Availability service | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E04 | Preset | Radni dani 17–22 | Preset UX enabled / When visible | Preview/apply recurring availability → Same screen | Availability rules | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E05 | Calendar control | Prethodna / sledeća nedelja | Always / When visible | Navigate calendar period → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E06 | Availability block | Dostupan | Always / When visible | Edit/delete availability → Same screen | Availability projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E07 | Unavailable block | Nedostupan | Always / When visible | Edit/delete unavailable block → Same screen | Availability projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E08 | Dogovor block | Dogovor | Always / When visible | Open Dogovor → D01 | Agreement commitment projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E09 | Empty slot | Dodajte dostupnost | Always / When visible | Open add block sheet → Availability sheet | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| W09-E10 | Legend | Dostupan · Nedostupan · Dogovor | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Calendar skeleton.
- **empty:** Calendar still renders empty slots.
- **saving:** Block-local/sheet progress.
- **conflict:** Show server conflict reason.
- **offline:** Calendar cached read; mutation disabled or explicit queue.
- **error:** Retry period read.

**Business / privacy / authority rules:**
- Calendar is a projection; confirmed Dogovor is server authority.
- Future Selection must hard-reject true commitment conflicts server-side.
- User cannot erase a Dogovor by editing calendar.

**Premium enhancement allowed:**
- Today quick actions.
- Useful presets.
- Tap Dogovor block → Dogovor.

**Do not add / do not fake:**
- Massive enterprise scheduling suite
- Client-only conflict authority

---

# Dogovor

## D01 — Dogovor shell

**Purpose:** Task-centered shared shell with exactly two tabs: Pregled and Poruke.

**Current physical status:** **STRONG SHELL / PARTIAL PRODUCT** — Current Dogovor route already has exactly Pregled | Poruke and embedded chronology. It is still a single-agreement workspace, not final shared multi-person aggregate.

**Layout order:**
- Detail header.
- Task-centered masthead.
- Optional next-action card.
- Two-segment Pregled | Poruke.
- Tab content.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| D01-E01 | Back button | Nazad | Always / When visible | Back to Dogovori → R08/W07 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D01-E02 | Overflow | Više | Contextual D05 actions exist / When visible | Open change/problem/cancel menu → D05 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D01-E03 | Masthead | Zadatak + status + termin + coverage | Always / When visible | None → Same screen | Task-centered Dogovor aggregate | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D01-E04 | Participant stack | Učesnici | Always / When visible | None → Same screen | Viewer-authorized participant projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D01-E05 | Next action | Sledeći korak | One meaningful action pending / When visible | Jump to relevant D02/D05/D06 action → Same screen | Server-derived next action | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D01-E06 | Segment | Pregled | Always / When visible | Show D02 → D02 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D01-E07 | Segment | Poruke | Always / When visible | Show D03 → D03 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D01-E08 | Unread badge | N | Unread >0 / When visible | None → Same screen | Message unread projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Masthead skeleton + selected tab skeleton.
- **active:** Normal.
- **attention:** Next-action card.
- **terminal:** Tabs readable, actions constrained/read-only.
- **error:** Retry aggregate/tab read.
- **offline:** Cached read; message/mutation restrictions explicit.

**Business / privacy / authority rules:**
- Exactly Pregled | Poruke; Hronologija is embedded, not third tab.
- Shared task aggregate sits above participant-specific Agreements.

**Premium enhancement allowed:**
- Compact next-action card.
- Participant stack sheet.

**Do not add / do not fake:**
- Third Hronologija tab
- Hidden participant terms leakage

---

## D02 — Dogovor — Pregled

**Purpose:** Show task context, participants, viewer-specific Agreement, contact/location grants and embedded chronology.

**Current physical status:** **PARTIAL / LIVE CORE** — Agreement workspace, contact grants and exact-location authority have live owners; final shared/participant-specific aggregate semantics are not complete.

**Layout order:**
- D01 shell remains.
- Task summary.
- Participant section.
- Viewer terms.
- Contact/location section.
- Embedded D04 chronology.
- Contextual actions.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| D02-E01 | Task summary | Zadatak | Always / When visible | None → Same screen | Dogovor aggregate | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E02 | Participant row | Uskočer / Naručilac | Always / When visible | Open authorized participant detail/profile → R06/participant sheet | Viewer-authorized projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E03 | Own Agreement card | Vaši uslovi | Always / When visible | None → Same screen | Viewer-specific Agreement/version | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E04 | Contact row | Podelite svoj broj | Viewer may grant own phone and grant not active / When visible | Create directional grant → Same screen | Contact grant RPC | L: Row-local · E: No special error · O: Disabled · S: Re-read when screen focuses |
| D02-E05 | Contact row | Opozovite svoj broj | Viewer's outgoing grant active and revocation allowed / When visible | Revoke directional grant → Same screen | Contact grant RPC | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E06 | Phone value | Broj telefona | Counterparty granted viewer access / When visible | None → Same screen | Server reveal projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E07 | Copy icon | Kopiraj broj | Phone value visible / When visible | Copy to clipboard → Same screen | Local after server reveal | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E08 | Exact location | Tačna lokacija | Server grants exact location in this Dogovor / When visible | None → Same screen | Exact location reveal RPC/projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E09 | Copy icon | Kopiraj adresu | Exact address visible / When visible | Copy address → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E10 | Action | Otvori u mapama | Exact navigable location visible / When visible | Open native maps deep link → Same screen | Local handoff after server-authorized location | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E11 | Timeline | Hronologija | Always / When visible | Expand/collapse long timeline → D04 | Server event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E12 | Action | Izmena ili problem | Lifecycle action exists / When visible | Open D05 → D05 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D02-E13 | Completion action | Završetak | D06 action available / When visible | Open completion flow → D06 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Section skeletons.
- **active:** Normal.
- **grant_loading:** Row-local.
- **exact_location_hidden:** Explain only when useful, do not show blank address.
- **terminal:** Read-only terms/history; allowed support actions remain.
- **error:** Per-section retry where possible.
- **offline:** Readable cached data; no contact grant mutation.

**Business / privacy / authority rules:**
- Directional phone grants are person-specific.
- Exact location only after server authority.
- Requester can see participant summaries according to authority; worker cannot inspect others' private terms.

**Premium enhancement allowed:**
- Copy actions.
- Open in Maps.
- Collapsible long chronology.
- Participant stack sheet.

**Do not add / do not fake:**
- Auto-reveal phone
- Client-computed location permission override

---

## D03 — Dogovor — Poruke

**Purpose:** Provide group and private requester↔participant channels with duplicate-safe sending.

**Current physical status:** **PARTIAL / LIVE BASIC CHAT** — Single-agreement message send/read exists. Final group + requester↔participant private channel model and stable client_message_id retry contract are not yet implemented end-to-end.

**Layout order:**
- D01 shell.
- Channel switcher.
- Message list.
- Sticky composer.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| D03-E01 | Channel segment/chip | Zajednički | Always / When visible | Select group channel → Same screen | Viewer channel membership | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E02 | Channel chip | Naručilac / Marko / Nikola | Authorized private channel exists / When visible | Select private channel → Same screen | Viewer channel membership | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E03 | Unread badge | N | Channel unread >0 / When visible | None → Same screen | Message unread projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E04 | Message bubble | Poruka | Always / When visible | None → Same screen | Channel message projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E05 | Delivery state | Šalje se / Poslato / Nije poslato | Own outgoing message / When visible | None → Same screen | Local send state + server result | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E06 | Long-press action | Kopiraj | Always / When visible | Copy message text → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E07 | Long-press action | Odgovori | Reply-context feature enabled / When visible | Set reply context → Same screen | Local + optional message metadata | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E08 | Composer | Napišite poruku… | Always / Channel writable and not terminal/read-only | None → Same screen | Local draft | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E09 | Send button | Pošalji | Always / When visible | Send with stable client_message_id → Same screen | Message RPC | L: Per-message optimistic sending state, not whole-screen block · E: Mark failed; tap retry uses same client_message_id · O: Keep unsent draft; do not show as delivered · S: Re-read when screen focuses |
| D03-E10 | Retry failed | Pokušajte ponovo | Send failed/unknown / When visible | Retry same message ID → Same screen | Message RPC | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D03-E11 | Terminal notice | Dogovor je završen; poruke su samo za čitanje | Policy makes terminal chat read-only / Composer disabled | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Message skeleton/initial loader.
- **empty:** “Još nema poruka.”
- **sending:** Own message provisional state.
- **failed:** Retry same client_message_id.
- **offline:** Draft preserved, no fake sent state.
- **terminal:** Read-only composer hidden/disabled.
- **membership_changed:** Re-read channels before send.

**Business / privacy / authority rules:**
- Worker never automatically sees another worker's private requester chat.
- Stable client_message_id required for retry safety.
- Attachments hidden until storage + policy + scanning exist.

**Premium enhancement allowed:**
- Simple channel switcher.
- Unread badge per channel.
- Reply/copy optional.
- No modal spam for send.

**Do not add / do not fake:**
- Reactions/GIFs/stickers in V1
- Edit/delete history without explicit policy
- Attachments before backend

---

## D04 — Hronologija — embedded

**Purpose:** Read-only chronological projection of meaningful server events inside D02.

**Current physical status:** **PRESENT / EMBEDDED** — Chronology is already embedded in Pregled, which matches final information architecture; event completeness remains backend-dependent.

**Layout order:**
- Section header.
- Vertical timeline events.
- Optional expand/collapse when long.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| D04-E01 | Section title | Hronologija | Always / When visible | None → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D04-E02 | Timeline event | Zadatak objavljen | Always / When visible | None → Same screen | Server event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D04-E03 | Timeline event | Prijava poslata | Always / When visible | None → Same screen | Server event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D04-E04 | Timeline event | Učesnik izabran / Dogovor napravljen | Always / When visible | None → Same screen | Server event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D04-E05 | Timeline event | Kontakt podeljen/opozvan | Always / When visible | None → Same screen | Server event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D04-E06 | Timeline event | Izmena predložena/prihvaćena/odbijena | Always / When visible | None → Same screen | Server event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D04-E07 | Timeline event | Završetak / otkazivanje | Always / When visible | None → Same screen | Server event projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D04-E08 | Expand control | Prikaži celu hronologiju | Event count exceeds compact threshold / When visible | Expand/collapse → Same screen | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |

**Screen states:**
- **loading:** Timeline skeleton.
- **empty:** Should be rare; omit section or show neutral no-events.
- **long:** Collapsed meaningful recent events + expand.
- **terminal:** History remains readable.
- **error:** Section-level retry.

**Business / privacy / authority rules:**
- Timeline is not user-editable.
- Only server-observed events, no invented local 'success' history.

**Premium enhancement allowed:**
- Event icons.
- Relative time with absolute timestamp on tap/details.
- Group repetitive low-value events if noisy.

**Do not add / do not fake:**
- Third top-level tab
- Editable notes disguised as timeline

---

## D05 — Izmena / problem / otkaz

**Purpose:** Handle consequential agreement changes, problem reporting and cancellation with role/state-aware options and clear effects.

**Current physical status:** **PARTIAL / LIVE CORE** — Agreement change v2, respond, problem reporting and cancellation primitives exist. Final contextual diff/effect UX and multi-person replacement semantics are not fully live.

**Layout order:**
- Bottom sheet or full-screen route depending complexity.
- Choice menu.
- Specific flow: change diff / problem form / cancel consequence.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| D05-E01 | Menu option | Predložite izmenu | Agreement change allowed / When visible | Open change form → D05 change | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E02 | Menu option | Prijavite problem | Problem reporting allowed / When visible | Open problem form → D05 problem | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E03 | Menu option | Otkažite | Cancellation allowed / When visible | Open cancellation consequence → D05 cancel | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E04 | Diff card | Pre → Posle | Always / When visible | None → Same screen | Base Agreement version + proposed payload | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E05 | Primary | Pošaljite predlog | Always / When visible | Create version-bound change proposal → Same screen | Agreement change RPC | L: Stable semantic request; button-local · E: No special error · O: Disabled · S: Reject if base version changed |
| D05-E06 | Primary | Prihvatite | Viewer is responder and proposal pending / When visible | Accept proposal → Same screen | Respond change RPC | L: Button-local; reread Agreement version · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E07 | Secondary | Odbijte | Viewer is responder and proposal pending / When visible | Reject proposal → Same screen | Respond change RPC | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E08 | Problem reason | Razlog / opis | Always / When visible | None → Same screen | Problem report input | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E09 | Primary | Pošaljite prijavu problema | Always / When visible | Submit problem report → Same screen | Problem-report RPC | L: Button-local · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E10 | Consequence summary | Šta će se desiti | Always / When visible | None → Same screen | Current participant/task state | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D05-E11 | Danger primary | Potvrdite otkazivanje | Always / When visible | Cancel participant/whole task according to current context → Same screen | Cancellation RPC | L: Blocking confirm; retry-safe · E: Reread terminal/current state · O: Disabled · S: Re-read when screen focuses |

**Screen states:**
- **choice:** Only valid options shown.
- **change:** Version-bound diff.
- **incoming_change:** Accept/reject.
- **problem:** Report form.
- **cancel:** Explicit consequence.
- **stale:** Base version changed; re-read before resubmitting.
- **terminal:** Actions absent or constrained.
- **error:** Preserve form, show stable reason.

**Business / privacy / authority rules:**
- Accepted change creates new Agreement version.
- Participant cancellation releases only its capacity; other Agreements remain.
- Same task reopens only missing capacity.
- No generic 'Are you sure?' without effect summary.

**Premium enhancement allowed:**
- Old→new diff.
- Role-specific consequence text.
- Inline success/return to D02.

**Do not add / do not fake:**
- Silent auto-accept
- Separate replacement subsystem
- Unclear cancellation scope

---

## D06 — Završetak / recenzija

**Purpose:** Coordinate worker completion, requester confirmation and eventual real reviews without deadline drift or fake ratings.

**Current physical status:** **PARTIAL / REVIEWS MISSING** — Completion primitives exist, but full completion/review product is not closed; review backend is absent, so ratings/review CTA must be gated.

**Layout order:**
- State summary.
- Role-specific completion action.
- Deadline/info.
- Problem path if needed.
- Post-completion review card when backend exists.

**Atomic elements / actions:**

| ID | Element | Label | Visibility / enablement | Tap → destination | Authority | Loading / error / offline / stale |
|---|---|---|---|---|---|---|
| D06-E01 | State card | Status završetka | Always / When visible | None → Same screen | Agreement completion projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D06-E02 | Primary | Završio sam | Worker can mark work done / When visible | Mark work done → Same screen | rpc_mark_work_done | L: Button-local · E: Reread current completion state · O: Disabled · S: Re-read when screen focuses |
| D06-E03 | Deadline | Naručilac može da potvrdi do… | AWAITING_REQUESTER / When visible | None → Same screen | Original server-set deadline | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D06-E04 | Primary | Potvrdite završetak | Requester can confirm / When visible | Confirm completion → Same screen | rpc_confirm_completion | L: Button-local · E: No special error · O: Disabled · S: Re-read when screen focuses |
| D06-E05 | Secondary | Prijavite problem | Problem path allowed / When visible | Open D05 problem → D05 | Local presentation | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D06-E06 | Review card | Ocenite saradnju | Review backend exists + completed + viewer has not reviewed / When visible | None → Same screen | Review eligibility projection | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D06-E07 | Star input | 1–5 | Review card visible / When visible | None → Same screen | Local input | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D06-E08 | Text area | Kratak komentar | Review card visible / When visible | None → Same screen | Local bounded input | L: No special loading · E: No special error · O: Works locally · S: Re-read when screen focuses |
| D06-E09 | Primary | Pošaljite recenziju | Review backend exists and input valid / When visible | Submit one review → Same screen | Review RPC | L: Card-local · E: Preserve draft · O: Disabled · S: Re-read when screen focuses |

**Screen states:**
- **active:** Completion not started.
- **awaiting_requester:** Original deadline visible.
- **completed:** Read-only success + optional review.
- **problem:** Problem path through D05.
- **reviewed:** Show submitted/read state.
- **error:** Reread completion state before retry.

**Business / privacy / authority rules:**
- Mark-work-done retry must never reset 48h deadline.
- Reviews only after real backend exists.
- One review per allowed relationship/completed participant Agreement.

**Premium enhancement allowed:**
- Next-step copy, not raw enum.
- Quiet completion success state.
- No fake confetti/modal spam.

**Do not add / do not fake:**
- Fake review UI before backend
- Retry deadline extension
- Hardcoded rating result

---

## 6. Global production states

Every applicable surface must have: loading, empty, error, stale, offline, terminal/read-only where applicable. Mutating flows additionally require unknown outcome + same-intent retry + authoritative re-read after success. Success UI cannot be fabricated from client optimism when the server result is not definitive.

## 7. Feature gating table

| Capability | Current state | Final design rule |
|---|---|---|
| D0140 publication ALLOW | Fail-closed / policy inventory not activated | Show publish only in gated/disabled explanatory state until live ALLOW exists. |
| RU-4B public preselection Q&A | Foundation live, activation blocked/deferred | Do not show as active question/answer feature. |
| HITNO | Engine/config foundation; enabled=false, allowedCategories=[] | Do not expose as purchasable/active. |
| Reviews | Backend review model not complete | No fake ratings or review CTA; use 'Još nema recenzija' only where truthfully supported. |
| Map provider | No real provider in current W03 | Design full List↔Map target, but prototype must label provider-dependent until implementation. |
| Voice transcription | No transcribe Edge | Hide microphone or mark design-only/gated. |
| Push delivery | No push-dispatch Edge | Inbox can be designed; do not claim real push delivery. |
| Task/chat media | Only profile-media bucket exists | Media controls hidden until storage/policy/scanning exists. |
| Identity verification | Runtime admission not production-ready | No 'Verified' badge. |
| Hard calendar conflicts | RU-6A not closed | W09 may be fully designed, but conflict promises must remain gated. |
| Shared multi-person Dogovor | RU-6B not started | Design target is group + requester/private channels, but implementation state must be clearly marked future/gated. |
| Paid monetization | Absent; connection V1 = 0 RSD promotional free | No wallet/checkout/paid connection UX. |

## 8. Figma execution rules

1. Archive the first 6-screen experiment; do not delete it, do not treat it as canon.
2. Build pages: `00 SOURCE OF TRUTH`, `01 DESIGN SYSTEM`, `02 SHARED`, `03 MENI TREBA`, `04 JA MOGU`, `05 DOGOVOR`, `06 STATES + PROTOTYPE`, `99 ARCHIVE`.
3. Import/use exact canonical S01 mark and city source; no substitute logo.
4. Build components from semantic families (Task, Application, Dogovor, Profile Passport, Status/Attention, Header, Bottom Nav, Sheets, Composer, state panels).
5. Create all 28 canonical surfaces before calling visual coverage complete.
6. For each surface create required state variants, not just happy-path screenshots.
7. Use annotations for capability state: `LIVE`, `PARTIAL`, `GATED`, `DESIGN TARGET`, but never surface these engineering labels to end users.
8. Prototype canonical flows:
   - MENI TREBA: S01/S02/S03 → R02 → R07 → R04 → R05 → D01/D02/D03 → D06
   - JA MOGU: S01/S02/S03 → W02/W08 → W03 → W04 → W05 → W06 → D01/D02/D03 → D06
9. Verify reduced-motion, accessibility touch targets >=44 px, typography, contrast, Android/iOS safe areas.
10. Figma becomes visual source of truth only after 28/28 design coverage + state coverage + canonical flow review are complete.

## 9. Non-negotiable release/design closure

No screen is CLOSED merely because code or a Figma frame exists. Closure requires: design complete, implementation complete, backend bound, all states, privacy, retry/idempotency where relevant, accessibility, Android, iOS, and E2E proof.
