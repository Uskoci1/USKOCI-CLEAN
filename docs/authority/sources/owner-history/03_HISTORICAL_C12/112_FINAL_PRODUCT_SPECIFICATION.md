# USKOČI — FINAL PRODUCT SPECIFICATION

**Revision:** C12.1 CONTINUATION CHECKPOINT — 2026-08-25  
**Authority:** owner-locked decisions in this document + 105 register, unless explicitly reopened later  
**Implementation:** **NOT AUTHORIZED** until exact phrase `APPROVED FOR CLEAN BUILD`

## 1. Product

USKOČI is a two-sided real-world assistance marketplace: `Treba mi neko` (Requester/Naručilac) and `Želim da uskočim` (Worker/Uskočer). One account may use both role workspaces. The product is simple outside and sophisticated underneath; raw enums, RPC names, UUIDs, revision machinery and matcher percentages do not belong in normal user UI.

## 2. Requester navigation — OWNER LOCKED

`Početna | Potrebe | + | Dogovori | Profil`

Center `+` starts Nova Potreba. `Dogovori` replaces the vague old `Aktivno` product label.

## 3. Worker navigation — OWNER LOCKED

`Početna | Prijave | [USKOČI znak] | Dogovori | Profil`

Center USKOČI mark opens `Prilike` (marketplace/map/cards). `Dostupan sam` is prominent from Home/Profile, not a bottom-nav destination. **OWNER_LOCKED C12.15:** native map pan/zoom automatically refreshes the settled visible bounded area after a short debounce; pins and cards update together from one query snapshot, never via independent datasets. **OWNER_LOCKED C12.16:** render individual Potreba pins whenever zoom/density keeps them legible; cluster only to prevent material overlap/unreadability, and cluster tap zooms/expands members rather than selecting an arbitrary Need. **OWNER_LOCKED C12.17:** every individual physical Potreba pin visually contains only the canonical USKOČI pin/mark symbol — no price, currency, `PONUDE`, `HITNO`, title, Requester identity/avatar, exact address or recommendation/matcher data. Tapping the symbol focuses its synchronized bottom card; selection may add only a non-content focus treatment. **OWNER_LOCKED C12.18:** on native phone, Prilike uses a stacked layout with the live map in the upper region and a one-column vertically scrolling Opportunity-card list directly below; cards are one under another, pin↔card focus is synchronized, and neither a horizontal card carousel nor draggable overlay sheet is the primary V1 browsing model. Exact provider, cluster thresholds/algorithm, marker sizing/animation, map:list height ratio and responsive tuning remain implementation details.

## 4. Need lifecycle

One canonical Need remains open/market-visible only while uncovered headcount exists. Example `0/3 → 1/3 → 2/3 → 3/3`. Applications do not create Dogovor; Requester selection does. Fully covered Need leaves open Prilike, remains in history/parent state, and automatically reopens only missing capacity if a selected Dogovor later frees coverage. Increasing required people reopens the same Need for the difference.

`Ponovi Potrebu` creates a new draft from reusable fields, requires a short review of stale values, and requires explicit publish; it never auto-republishes the old Need.

## 5. Candidate/Application

Candidate view before selection is contextual: photo, name, server-owned rating/review count/completed-jobs only if provable, relevant verified facts/capabilities/resources, covered headcount, time and price. No phone/email/exact private address/raw matcher score/unrelated capability dump.

Application asks only what the Need leaves open. No free-text note by default. Competitor Applications/prices are not exposed while open. Worker can withdraw preselection.

Application AI is used for both physical and `Na daljinu` Needs: AI proposes → human reviews/confirms → explicit `Pošalji prijavu`. Remote does not silently bypass to a parallel direct submit path.

**OWNER_LOCKED C12.12:** Application has no arbitrary time expiry. It remains actionable only while the bound Potreba material terms remain current and the Application/Worker/coverage remain eligible. A material Potreba edit marks every affected submitted Application `STALE_REVIEW_REQUIRED`, makes it non-selectable, and notifies the Worker to review a human-readable diff. Worker then explicitly chooses `Zadrži prijavu` (reconfirm/rebase same terms to latest Need revision), `Izmeni prijavu` (AI/review + explicit new version), or `Povuci prijavu`. Doing nothing never carries old consent forward. Non-material copy-only corrections do not force re-consent; ambiguous materiality fails safe to review. Selected Applications already in active Dogovor follow the separate Dogovor material-change consent rule.

## 6. Worker profile gate

Worker may browse Prilike with an incomplete Worker profile. Before first Application, a minimum usable profile must be completed and human-confirmed. AI profile conversation is resumable.

## 7. Anonymous preselection Q&A — OWNER LOCKED

A Worker may `Postavi pitanje` on a Need. The question is anonymous even to the Requester; only the system internally knows the author for abuse/spam/audit. The question is private pending Requester review. Only if Requester answers do the anonymous question + answer become public. Rejected/ignored questions are not published. Requester can edit a published answer; public UI shows `Izmenjeno` and audit history is retained.

Full private chat starts only after Dogovor.

## 8. Team / multiple people — OWNER LOCKED

Lead may cover multiple people, e.g. `Milan — pokrivam 3 mesta`. V0 records the accountable lead + covered headcount; additional helpers do not need USKOČI accounts and are not required to be named or managed as a formal roster. There is no separate member-replacement UX when the helper identity changes but the same quantity/terms remain covered. A change in covered headcount **is** material. Lead is accountable and receives the rating; helpers do not inherit it.

Future Povezivanje consumption is per covered headcount: one lead covering three consumes three units. Launch may make units free/unlimited without changing this entitlement quantity model.

## 9. Dogovor consent — OWNER LOCKED

Worker Application = consent to exact Application/Need version. Requester selection of that exact Application = consent. With no material change, Dogovor becomes active immediately; no redundant `Potvrdi Dogovor` round.

Dogovor local tabs: **Pregled | Poruke**.

## 10. Material changes — OWNER LOCKED

Party A proposes an exact new version; Party B accepts; the new version is active immediately. No additional third confirmation. Old versions remain immutable history. If material Requester change is close to execution, previously locked late-change rules/warnings apply and affected Worker can reject without cancellation/no-show penalty.

## 11. Privacy — OWNER LOCKED

Before selection use coarse/public-safe information. In active physical Dogovor reveal exact address/access notes only as operationally needed. `Na daljinu` has no physical-address reveal. Phone is not auto-shared; `Podeli broj telefona` is opt-in. Email is not a standard shared contact field. Chat is primary.

## 12. Cancellation/replacement — OWNER LOCKED CORE

Operational cancellation does not require counterparty acceptance. If one Worker/lead cancels from a multi-person Need, only their coverage is released; unaffected Dogovori stay intact; the same Need reopens only missing capacity. Qualifying Worker cancellation/confirmed no-show gives same-Need replacement entitlement for that vacated quantity without a new Povezivanje. No global transferable credit is created. **OWNER_LOCKED C12.7:** entitlement opens immediately and expires at the earliest of coverage refill, Requester closure/cancellation, basis-invalidating material revision, or **24 hours after the end of the original confirmed execution window** (for flexible time, 24 hours after the confirmed window ends). Deadline is server-owned and does not silently extend.

**Enforcement is OWNER_LOCKED progressive/contextual.** Consequences may strengthen with timing, severity, reason/context, repetition/history, corroborated evidence and confirmed abuse; one ordinary cancellation is not an automatic punishment or ban. Reported no-show is not a verdict. AI may triage and surface signals, but severe suspension/final abuse or fraud decisions require authorized evidence-based review. Exact numeric thresholds/durations remain later policy configuration.

## 13. Completion — OWNER LOCKED

No universal mandatory `Započni rad`. Worker can mark `Završio sam`; Requester gets 48h to confirm or report a problem. No problem/action for 48h → auto-complete. Requester may independently confirm completion without waiting for Worker initiation. Multi-person Dogovori complete independently; convenience `Potvrdi sve` may invoke safe per-Dogovor confirmation.

**OWNER_LOCKED C12.37.5 / D-0144:** in an active physical Dogovor, current location is an optional consented tool, not an execution gate. The Worker may voluntarily `Podeli lokaciju`, or explicitly approve a Requester `Zatraži lokaciju` request. A Requester request cannot activate GPS itself. V1 shares a timestamped current-location snapshot only; there is no continuous/background tracking or route history, and `Na daljinu` does not expose the physical-location action. V1 has no dedicated execution-progress milestone state machine under D-0145; progress remains chat-based and no intermediate milestone blocks `Završio sam`.

## 14. Reviews / block / safety

Reviews occur after canonical completion and are nonblocking. Bilateral 1–5 with optional comment/tags; no preselected value. **Reputation is OWNER_LOCKED:** public reputation contains only eligible completed-Dogovor star average, matching review count, and server-proven completed-job count. Cancellation/late-cancel/no-show/reliability remain internal matching/T&S signals; raw counts are not public and these signals never silently alter the star average. **Blocking is OWNER_LOCKED:** it cannot be finalized while a Dogovor between the two users is active. The UI first routes the user to finish or unilaterally cancel that Dogovor, with reason and immediate `Prijavi problem` where needed. After the Dogovor is terminal, either party can block from profile/history. The block prevents future matching, Applications, preselection contact and new direct contact, but never erases historical Dogovori, messages/evidence, reports, reviews or audit history.

## 15. Marketplace/matching/availability

Default candidate ordering is `Najrelevantnije`, with factual reasons rather than raw AI score. Sort can include `Najrelevantnije | Najbliži | Najbolje ocenjeni | Cena` where price mode supports it. PRO cannot buy ranking.

**OWNER_LOCKED C12.8:** `Dostupan sam` is a live readiness signal that remains ON until the Worker explicitly turns it OFF (or account/safety authority disables it); there is no arbitrary few-hour auto-expiry. It may override the weekly recurring baseline but not an active Dogovor/personal hard unavailable block or missing skill/resource/location eligibility. Weekly availability is separate. OFF does not hide marketplace access. `Na daljinu` ignores physical radius. **OWNER_LOCKED C12.9:** OFF means “not ready now”: proactive immediate/ready-now opportunity alerts are suppressed, but future scheduled Potrebe may still notify when their execution time matches confirmed weekly/date-specific availability and notification preferences. ON allows both immediate and future eligible alerts; quiet hours/channel/topic preferences remain separate delivery gates. **OWNER_LOCKED C12.10:** quiet hours also apply to `HITNO` by default. Urgent opportunity push may interrupt quiet hours only after the Worker explicitly opts into a separate `Dozvoli HITNO tokom tihih sati` preference; default OFF. In-app event recording does not itself grant interrupt permission, and urgency never bypasses other eligibility/safety gates. **OWNER_LOCKED C12.11:** any opportunity push delayed by quiet hours must be server-revalidated before later delivery against current Potreba revision/state, remaining coverage, Worker eligibility/availability/preferences and actionability; stale/filled/cancelled/expired/materially changed/ineligible opportunities are suppressed rather than blindly delivered. **OWNER_LOCKED C12.6:** Worker radius means willingness to travel from the Worker's confirmed matching origin to the first physical stop of the Potreba. The Potreba's own route length/burden is a separate fact for display/ranking and never hard-rejects a Need merely because route length exceeds radius. Any future hard maximum-total-travel filter must be a separate explicit Worker preference. Map auto-refresh/pin-card synchronization is owner-locked through C12.15, individual-pin-first density clustering through C12.16, and individual marker content through C12.17: the visible individual marker is only the canonical USKOČI pin/mark symbol while task facts stay in the card/detail. Exact provider, cluster thresholds/algorithm, marker sizing/selection animation and remaining filter presentation are implementation tuning. Application freshness/material-edit semantics are owner-locked through C12.12.

## 16. Povezivanje

Requester is the economic payer/beneficiary. Applications are free. Selection consumes by covered headcount under the entitlement engine. Same-Need replacement for qualifying Worker failure does not consume again. Purchased Povezivanja do not expire. Promotional launch may be unlimited/free while using the same engine. Paid checkout remains OFF until store/legal/fiscal/payment readiness is proven.

## 17. Build gate

These owner locks update target product authority, but they do **not** authorize source/Supabase/GitHub mutation. Build authorization remains the exact phrase: `APPROVED FOR CLEAN BUILD`.


## C12.5 OWNER_LOCKED — single / multi-stop / compound boundary

- One Worker/team commitment owning an ordered route = one canonical Potreba with multiple stops.
- Independent Worker selection, price, Dogovor, permissions or lifecycle boundaries = separate canonical Potrebe.
- AI may propose the split; the Requester must confirm it before child Potrebe are materialized/published.
- Dedicated NeedPlan UI is not mandatory for V0 launch.
- If an umbrella NeedPlan is preserved, it is organization/projection only: overall progress is derived from child Potrebe/Dogovori and there is no independently writable V0 Plan lifecycle status.


## V1 launch monetization — OWNER LOCKED C12.13

V1 uses the real Povezivanje entitlement/reservation/activation engine with promotional cost `0` for all eligible Requesters. Worker Applications remain free. Paid checkout, paid SKU/catalog and cash charging are disabled. Paid enablement may occur only after real liquidity/usage evidence and all store/legal/fiscal/payment/provider gates. Exact later prices, package sizes, allowance and paid-start date are deliberately not hard-coded into V1.

## Release updateability — OWNER LOCKED C12.13

The first public V1 must be structurally upgradeable in place. Stable store identity/signing and monotonic release versions are release invariants. Backend/API/database and client-persisted-state evolution must use versioned, backward-compatible migration/cutover rules so a later app update does not require deleting the app or losing account/Potreba/Prijava/Dogovor/history data. Release verification includes clean install and upgrade-from-supported-previous-build scenarios. Native-runtime changes require a new compatible store binary; any OTA update mechanism is allowed only when runtime compatibility is proven and may use staged rollout/rollback channels rather than sending incompatible code to an installed binary.

## Update UX policy — OWNER LOCKED C12.14

Ordinary new features and noncritical fixes use an optional/soft update prompt; V1 must not block users merely because a newer version exists. Backend/release configuration may enforce `minimumSupportedVersion` only when the installed client is unsafe, critically broken, or no longer compatible with a supported API/schema/security contract. A forced-update state explains why continuing is unavailable and routes to the official store; it never instructs the user to clear application data as a normal migration step.

## Payment-ready but disabled — OWNER LOCKED C12.14

The free public V1 already contains the **contractual surfaces** needed for later paid Povezivanje: canonical ledger/entitlement semantics, server-owned catalog/quote/config reading, fail-closed paid capability flag, provider-neutral checkout boundary, return context/idempotency and post-return revalidation. Actual charging and paid checkout remain disabled. A future commercial switch may occur without a mobile update only when the already-installed runtime includes every required approved capability and the chosen provider/store/legal/fiscal rules permit it. A native/payment SDK or materially new purchase-contract requirement triggers a normal compatible app update before paid activation.

## C12.19 Prilike ordering and scope — OWNER LOCKED

On Worker `Prilike`, the vertical Opportunity list defaults to **`Najbolje za mene`**. The server orders current browse results using only task-relevant current facts (eligibility, confirmed capability/resource fit, time/availability, explicit work preferences, real physical proximity when applicable and freshness); it does not expose raw matcher percent and is not simply nearest-first. The Worker may switch to `Najbliže`, `Najnovije`, `Najskoriji termin`, `Cena: niža prvo` or `Cena: viša prvo` where the data is comparable. Browse scope remains `Sve / Fizičke (in-person) / Na daljinu`; remote opportunities have no fabricated physical distance/pin. Map and cards always refresh from the same query snapshot after sort/scope/filter changes.
## C12.20 MINI / CARD / DETAIL mobile hierarchy — OWNER LOCKED

The same canonical Need revision has three deterministic projections with distinct V1 jobs. `MINI` is used only in secondary compact contexts. The primary Worker `Prilike` list below the live map uses `CARD`: a readable AI-composed short summary backed only by human-confirmed canonical facts, plus price or `Tražim ponude`, people/remaining coverage when relevant, execution time/window, public-safe area and one-place/route/`Na daljinu` meaning; only truly material resource/vehicle facts are added.

Tapping `CARD` opens full-screen `DETAIL`, which owns long description, all public-safe confirmed conditions, signed media, public-safe route/stops/map, headcount/coverage, Requester public projection, anonymous Q&A and current Application CTA. On native phone, swipe-down or normal Back returns to the exact prior `Prilike` map camera, filters/sort/scope, vertical-list scroll and selected pin/card, with freshness revalidation rather than context loss. AI may improve wording but cannot invent, remove or alter material canonical terms.
## C12.21 primary CARD media rule — OWNER LOCKED

The native-phone `Prilike` CARD intentionally shows **no task-photo thumbnail/media preview**. It stays text/fact-first for fast scanning. Media availability may be indicated with a small non-image count/icon if useful, while actual authorized/signed photos and media remain in full-screen DETAIL.

## C12.22 primary CARD match-reason rule — OWNER LOCKED

The primary native-phone `Prilike` CARD shows only job facts and **no permanent or contextual match-reason line/chip**. `Najbolje za mene` is a server-owned ordering policy; it is not accompanied on each CARD by `Zašto Vam odgovara`, `Imate kombi`, `Odgovara Vaš termin`, a raw score or a percentage. Evidence-backed explainability may still appear in deliberate DETAIL/Worker Home recommendation contexts when tied to current canonical truth.

## C12.23 — Requester trust on primary Prilike CARD — OWNER LOCKED

- `D-0126 OWNER_LOCKED`: primary `Prilike` CARD shows a small but visible Requester trust strip: authorized public avatar, public display name and server-owned public rating state. Authoritative review count may accompany the rating compactly.
- The job remains the visual hierarchy owner: what/payment/people/time/public area/route stay more prominent than Requester identity.
- Never invent a rating. Zero eligible reviews uses the truthful new-user state; unknown rating is omitted.
- CARD never exposes phone, email, exact address, private verification evidence or other private/contact data.
- D-0120 remains unchanged: individual map pins are still USKOČI-brand-symbol-only and contain no Requester identity.

## C12.24 CARD tap routing — OWNER LOCKED

The compact Requester trust strip on the primary `Prilike` CARD is interactive: tapping the public avatar/name/rating region opens the Requester's public profile. Tapping any other part of the CARD opens Need DETAIL. The two hit regions are distinct, accessible and do not overlap. Both preserve the same Marketplace browse context for Back/resume, neither exposes contact/private fields, and a public-profile load failure is handled as an error/retry rather than silently executing the CARD's Need-detail action.

## C12.25 — Requester public profile review evidence

`D-0128 OWNER_LOCKED`: opening the Requester public profile from the CARD trust strip shows the authoritative avatar/name/rating summary and, directly beneath it, the eligible individual reviews. Each visible review shows the actual 1–5 star rating and the real reviewer-authored comment when one was submitted. USKOČI/AI must never invent, auto-fill or synthesize review text; no-comment reviews remain star-only. The list and aggregate use the same completed-Dogovor eligibility/moderation truth so hidden/removed reviews cannot keep affecting one surface while disappearing from the other.

## C12.26 — Reviewer identity on real public reviews

`D-0129 OWNER_LOCKED`: each eligible individual review on a public profile displays the real reviewer's **authorized public avatar/photo and public display name**, alongside the actual submitted stars and human-authored comment when present. The displayed identity must resolve to the canonical review author and may use only the reviewer's public-profile projection. No contact/private fields are exposed and no synthetic reviewer/photo/name may be generated. If public identity is unavailable under policy/account state, show a truthful reduced/fallback state. Reviewer-profile tap navigation and exact date treatment remain separate details.


## C12.27 — reviewer public-profile navigation

`D-0130 OWNER_LOCKED`: on each eligible public review, tapping the canonical review author's authorized public avatar/name opens that exact reviewer's public profile. Stars/comment remain non-navigation review evidence. Back restores the exact prior public profile and review-scroll position. Reviewer-profile failure is explicit and never falls through to another person/action. Exact review-date presentation remains a separate later decision.

### C12.28 review-date presentation — OWNER_LOCKED

Each public review shows a truthful relative-age label from its canonical review timestamp (for example `pre 1 dan`, `pre 1 nedelju`, `pre 1 mesec`, `pre 1 godinu`, with localized plural counts). Public review cards do not expose hour/minute precision; the immutable timestamp remains the source of truth.

## C12.29 — Requester public-profile completed Dogovor trust fact

OWNER_LOCKED D-0132: the Requester public profile includes a compact server-proven count such as `12 završenih dogovora`. The count is the number of distinct canonical completed Dogovori where that account is the Requester. Posted Potrebe, Applications, cancellations, no-shows and review count are not substitutes. It is independent of rating math and exposes no private Agreement details. Worker completion count remains a separate role-specific metric.

## C12.30 — Requester public identity-verification badge

OWNER_LOCKED D-0133: the Requester public profile may show a small `Verifikovan identitet` badge only from a real server-authoritative current/valid identity-verification state. Missing, expired, revoked, unsupported or uncertain verification produces no badge. Never infer it from email/phone/profile completeness, never expose verification documents/evidence, and never present the badge as a skill/safety/quality endorsement.

## C12.31 — `Verifikovan identitet` explanatory sheet

OWNER_LOCKED D-0134: tapping the Requester public-profile `Verifikovan identitet` badge opens a small explanatory sheet such as `Identitet je potvrđen`, with concise language describing what identity verification means and explicitly what it does not mean. The sheet never exposes verification documents/evidence/provider payloads, never routes to private verification data and never mutates verification/profile state. Freshness revalidation must suppress misleading content if verification is no longer valid.

## C12.32 — compact verified check on Requester CARD trust strip

OWNER_LOCKED D-0135: the primary `Prilike` CARD may show a tiny verified check/icon beside the Requester's public display name when D-0133 server-authoritative identity-verification truth is currently valid. No full verification label is shown on CARD. The mark has no separate action; the whole trust strip follows D-0127 and opens the Requester public profile, where D-0134 owns the explanatory sheet. Missing/stale/revoked/uncertain verification shows no mark.

## C12.33 — Uskočer public completed-work count

OWNER_LOCKED D-0136: the Uskočer public profile includes a compact server-proven completed-work count such as `27 završenih poslova`. Count distinct canonical completed Dogovori where the profiled account is the accountable Worker/lead. Do not infer from Applications, selection, helper headcount, reviews, cancellations/no-shows or nonterminal work. Team V0 credits the accountable lead only. Keep the metric independent of public star math and expose no private Agreement details. D-0132 Requester completed-Dogovor count remains a separate role-scoped metric.

## C12.34 — one identity truth across roles

`Verifikovan identitet` is owned once per human account. Requester and Uskočer public-profile surfaces project that same authoritative state; they never maintain parallel verification truths. Public copy/interaction keeps D-0133/D-0134 limits, and verification evidence remains private.

### Owner-review operating mode after C12.34
The owner explicitly asked to stop drilling into low-value micro-decisions. From this checkpoint onward, owner questions are reserved for **material** choices that change business model/money, privacy/legal exposure, lifecycle/consent, trust & safety, or a core visible user journey. Low-level UI geometry, component polish, provider adapter details, implementation mechanics, internal naming and other reversible technical choices are delegated to the clean-build architecture/UX/QA process, must be documented, and must be proven by tests/runtime evidence rather than repeatedly escalated to the owner.


## C12.35 visual-direction governance

Owner-supplied concept boards are now persisted as visual-direction evidence. They define the desired premium USKOČI feel but do not supersede canonical product behavior. Final screen closure must reconcile every board against latest OWNER_LOCKED navigation, state, action, privacy, reputation, monetization and data-owner contracts. The owner also requires micro UI/UX product decisions to be closed before clean build when they affect the user-visible experience.


## C12.37.1 — PRE-SCREEN FUNCTIONAL CLOSURE / safety-policy authority

### D-0140 — AI safety/legal decisions must not come from model memory
**Status:** OWNER_LOCKED (2026-08-25)

1. USKOČI AI must **not** treat generic model memory, web-like background knowledge, or free-form legal inference as the normative authority for whether a Potreba may be published.
2. The normative input is a **versioned, server-owned USKOČI safety/legal policy bundle** derived from the currently approved project safety/legal documents and explicit owner/product/legal decisions.
3. Every operative rule should have a stable policy/rule identifier and version/provenance so the server can explain internally which rule caused ALLOW / CLARIFY / REVIEW / BLOCK.
4. AI may use natural language only to understand the user's request and ask the minimum relevant clarifying question(s) needed by those rules. It may not invent a new prohibited category, legal exception, licence requirement, or safety permission.
5. Final publish authority is the **server-side safety gate**, not the language model. AI output is advisory/proposal input to that gate.
6. If the applicable rule is missing, contradictory, unsupported, stale, or explicitly marked `NEEDS SERBIAN LEGAL REVIEW`, the system must not silently improvise. It routes to `REVIEW` / fail-closed handling or another explicitly defined safe state.
7. `REVIEW` content is not publicly published, not sent to Prilike, and does not trigger Worker opportunity notifications until the authoritative gate resolves it.
8. Where a safe clarifying question can resolve ambiguity, use **CLARIFY → re-evaluate** before REVIEW. If uncertainty remains, REVIEW wins.
9. Policy changes are delivered by updating the versioned policy bundle/server rules; model retraining is not required to change normative product behavior.
10. This lock does **not** convert research/legal drafts into formal legal advice. Any document marked as requiring Serbian legal review remains gated for production legal reliance.

**Owner intent:** `AI treba da zna na osnovu onog fajla sa zakonima/policy dokumentacije i da ne radi ništa napamet.`


### C12.37.2 — Need media retention/deletion (D-0141)
Need-media removal is projection-aware and evidence-aware. Disposable Need media may be detached and deleted under approved cleanup. Media that has entered accepted Dogovor evidence, report/problem/dispute, moderation/audit evidence or a valid hold is removed from public/user-facing presentation but privately retained only for the authorized purpose. Account closure does not automatically destroy evidence. Exact retention durations are externalized into an approved versioned privacy/legal retention policy; no duration is invented in product code/spec.


**OWNER_LOCKED C12.37.6 / D-0145:** V1 intentionally omits a dedicated execution-progress milestone state machine. AI does not generate or select `Krećem`, `Stigao sam`, `Preuzeo sam` or similar canonical steps. Progress is communicated through Dogovor chat; D-0144 optional one-time location sharing remains separate. No `Započni rad`, arrival confirmation or other intermediate progress action may block `Završio sam`. Existing source milestone states are forensic/current-system evidence rather than target product truth.
