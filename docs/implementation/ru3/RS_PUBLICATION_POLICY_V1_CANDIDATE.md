# USKOČI — RS PUBLICATION POLICY V1 CANDIDATE

Status: `CANDIDATE_NOT_ACTIVE`
Jurisdiction: `RS`
Scope: **only whether a requester-created Zadatak may become public inventory on USKOČI**.

## 0. OWNER-LOCKED PRODUCT SURFACE BOUNDARY

USKOČI public marketplace inventory contains **only requested Zadaci**: a person says what they need another person to do.

There is **no provider/service-offer listing type** in V1. A person in `JA MOGU` mode does not publish "Nudim krečenje", "Radim selidbe" or a service catalogue into Marketplace, map pins or small task cards.

A person's capabilities belong to the **Radni profil**: skills/capabilities, tools, vehicles, experience, availability, work radius and descriptive profile text. That profile data may be used for matching and may be visible on the person's detailed profile where product canon permits it, but it does not create a marketplace listing.

Therefore:
- map pins represent **Zadaci**, never workers/service offers;
- compact Marketplace/Opportunity cards represent **Zadaci**, never worker advertisements;
- a worker's detailed capabilities belong to **Radni profil detail**, not the small Zadatak card;
- a text whose real objective is "I offer my services" is not a valid Zadatak and is blocked as unsupported inventory;
- moderation of Radni profil content is a separate profile-content concern and must not be confused with D-0140 Zadatak publication admission.

This document does **not** make USKOČI the professional/licensing/tax inspector for the person who later accepts the Zadatak. Performer eligibility, licences, tax/right-to-work and execution legality remain separate responsibilities unless a future USKOČI feature explicitly verifies them.

## 1. Runtime outcomes

- `ALLOW` — Zadatak may continue to canonical publish checks.
- `CLARIFY` — not publishable yet; user must correct/remove/clarify a material fact and create a new revision/fingerprint.
- `REVIEW` — not publishable in current V1. No promise of human review timing. Used for regulated/high-risk categories whose RS production rule is not yet professionally closed.
- `BLOCK` — the current objective/content is not publishable on USKOČI. This is a content decision, not automatically an account ban.

Only `ALLOW` is publishable. `CLARIFY`, `REVIEW` and `BLOCK` must produce no public listing, matching, dispatch or notification.

## 2. Authority classes

- `OWNER_PLATFORM_POLICY` — USKOČI may define this as a product/platform rule without claiming that every instance is illegal by law.
- `LEGAL_ARCHIVE_SUPPORTED_CANDIDATE` — supported by the V0.1–V0.5/RC1/RC2 legal corpus but still not a production legal claim until the relevant authority/review is satisfied.
- `OWNER_PLUS_ARCHIVE` — both product policy and archived safety/legal research point in the same direction.
- `PROFESSIONAL_CONFIRMATION_REQUIRED` — must remain fail-closed for production legal reliance.

Historical files are provenance, not runtime authority. Newer owner decisions and RC2 reconciliation supersede conflicting older wording.

## 3. Candidate rule matrix

| Rule ID | Trigger / objective | Outcome | Safe user message intent | Authority / production note |
|---|---|---|---|---|
| `RS-PUB-001` | Clear ordinary lawful requested task, no risk signal | `ALLOW` | Potvrdite šta će biti objavljeno. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-002` | Material time/location/scope/content fact missing | `CLARIFY` | Nedostaje jedna bitna informacija da bismo bezbedno objavili Zadatak. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-003` | Public phone, email, exact home address, QR, ID document, private coordinates/instructions | `CLARIFY` | Uklonite privatne podatke; oni se ne objavljuju javno. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-004` | Profanity/vulgar wording in an otherwise permissible Zadatak, without targeted abuse | `CLARIFY` | Preformulišite javni tekst bez psovki/vulgarnosti. | OWNER_PLATFORM_POLICY |
| `RS-PUB-005` | Targeted insult, harassment, humiliation or abusive attack on a person | `BLOCK` | Uvrede i uznemiravanje nisu dozvoljeni. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-006` | Hateful abuse / targeted humiliation based on protected trait | `BLOCK` | Govor mržnje i ciljano ponižavanje nisu dozvoljeni. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-007` | Threat, intimidation, violence or request to harm/frighten someone | `BLOCK` | Zahtevi koji uključuju pretnje ili nasilje nisu dozvoljeni. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-008` | Theft, fraud, evasion, forged documents, deceptive impersonation for unlawful objective | `BLOCK` | USKOČI ne podržava krađu, prevaru ili falsifikovanje. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-009` | Stalking, covert surveillance abuse, doxxing, obtaining/exposing private data without lawful authority | `BLOCK` | Praćenje i pribavljanje tuđih privatnih podataka nisu dozvoljeni. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-010` | Sexual services, trafficking, exploitation, sexual content involving minors | `BLOCK` | Eksploatативне/сексуалне usluge ovog tipa nisu podržane. | OWNER_PLUS_ARCHIVE; escalation details require professional review |
| `RS-PUB-011` | Illegal drugs or controlled-substance bypass | `BLOCK` | Nabavka/prenos nedozvoljenih ili kontrolisanih supstanci nije dozvoljen. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-012` | Weapons/ammunition procurement, transfer or harmful use in ordinary marketplace | `BLOCK` | Oružje i municija nisu podržani kao običan USKOČI Zadatak. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-013` | Pyrotechnics procurement/delivery | `BLOCK` | Pirotehnika nije podržana na USKOČI. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-014` | Tobacco/nicotine procurement/delivery | `BLOCK` | Duvan i nikotinski proizvodi nisu podržani na USKOČI. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-015` | Alcohol procurement/delivery | `REVIEW` | Ova vrsta Zadataka trenutno nije dostupna. | LEGAL_ARCHIVE_SUPPORTED_CANDIDATE; OFF until age/merchant/delivery model is closed |
| `RS-PUB-016` | Prescription-medicine pickup/procurement for another person | `REVIEW` | Ova vrsta Zadataka trenutno nije dostupna. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-017` | Controlled/narcotic medicine procurement, resale or regime circumvention | `BLOCK` | Zaobilaženje režima kontrolisanih lekova nije dozvoljeno. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-018` | Ordinary OTC medicine pickup | `REVIEW` | Ova vrsta Zadataka još nije omogućena u V1. | Archive says potentially conditional; no production rule yet |
| `RS-PUB-019` | Hazardous/special waste: e-waste, batteries, oils/chemicals, asbestos, medical waste | `REVIEW` | Za ovu vrstu odvoza potreban je poseban podržan model. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-020` | Discard/removal of rubble or waste to treatment/dump | `REVIEW` | Odvoz otpada trenutno nije ordinary USKOČI Zadatak. | Waste classifier; operator model not closed |
| `RS-PUB-021` | Move an item from A to B without discard intent, otherwise safe | `ALLOW` | Predmet se prenosi, ne odlaže kao otpad. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-022` | Unknown/opaque package or unknown transport contents | `CLARIFY` | Navedite šta se prenosi i da li postoje posebni rizici. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-023` | Known prohibited/dangerous transport contents | `BLOCK` | Opasan/zabranjen sadržaj ne može kroz ordinary marketplace. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-024` | Regulated but not clearly prohibited transport contents | `REVIEW` | Ovaj transport trenutno nije podržan bez zatvorenog pravila. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-025` | One-off personal errand / handoff of ordinary lawful item, key or document | `ALLOW` | Jednokratna lična pomoć može biti Zadatak ako nema drugog rizika. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-026` | Systematic courier/postal product pattern: standardized intake + shipment + tracking/SLA/COD + delivery | `REVIEW` | Ovaj model može predstavljati posebnu kurirsku/poštansku uslugu i trenutno nije ordinary Zadatak. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-027` | Passenger transport for compensation | `REVIEW` | Prevoz putnika za naknadu trenutno nije podržan u ordinary V1 marketplace-u. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-028` | Medical/health procedure (e.g. injection, invasive/professional treatment) | `REVIEW` | Medicinski postupci trenutno nisu podržani kao ordinary Zadatak. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-029` | Regulated professional task where publication/admission rule is not closed | `REVIEW` | Ova vrsta Zadataka zahteva poseban podržan model. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-030` | Childcare / vulnerable-person care beyond ordinary adult accompaniment | `REVIEW` | Ova vrsta brige trenutno nije podržana bez posebnog safety modela. | Archive child/vulnerable gate; model not closed |
| `RS-PUB-031` | Private-security/guarding objective | `REVIEW` | Usluge obezbeđenja trenutno nisu ordinary USKOČI Zadatak. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-032` | Employment/staffing pattern: business requester + repeated long continuity + many workers + fixed shift/control/discipline | `REVIEW` | Ovo više liči na radno angažovanje/staffing nego na pojedinačan Zadatak. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-033` | Sale/rental/classified listing with no material task requested from another person | `BLOCK` | USKOČI je za konkretne Zadатke, ne za klasične prodajne ili rental oglase. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-034` | Spam, promotion, referral, affiliate or unrelated advertising | `BLOCK` | Promotivni oglasi nisu USKOČI Zadaci. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-035` | Credit/loan/investment/crypto-investment/financial solicitation or advertising | `BLOCK` | Finansijski/investicioni oglasi nisu podržani na USKOČI. | OWNER_PLATFORM_POLICY; does not claim every such offer is illegal |
| `RS-PUB-036` | Gambling/betting promotion or recruitment | `BLOCK` | Gambling/betting promocija nije podržana na USKOČI. | OWNER_PLATFORM_POLICY |
| `RS-PUB-037` | Protected-characteristic preference used as performer-selection requirement | `BLOCK` | Lično svojstvo ne može biti običan filter za izbor. Preformulišite stvarnu potrebu zadatka. | OWNER_PLUS_ARCHIVE; exceptions require professional confirmation |
| `RS-PUB-038` | Objective task capability: lift weight, required tool/vehicle, genuinely necessary language/credential/location condition | `ALLOW` | Objektivan zahtev zadatka može biti naveden ako je stvarno potreban. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-039` | Ordinary purchase errand for non-regulated goods, no suspicious cash/authority issue | `ALLOW` | Kupovina obične stvari može biti Zadatak; naknada i trošak robe ostaju odvojeni. | Archive-supported product boundary |
| `RS-PUB-040` | Large cash withdrawal/advance, handling significant third-party money, official/legal act in another person’s name | `REVIEW` | Ovaj Zadatak zahteva poseban authority/risk model i trenutno nije ordinary V1. | PROFESSIONAL_CONFIRMATION_REQUIRED |
| `RS-PUB-041` | Clearly dangerous/high-risk request not covered by a more specific rule | `REVIEW` | Zadatak je previsokog ili nejasnog rizika za automatsku objavu. | OWNER_PLUS_ARCHIVE |
| `RS-PUB-042` | User marks Zadatak HITNO | `NO_OVERRIDE` | Hitno menja prioritet, nikad safety/policy odluku. | OWNER_PLUS_ARCHIVE meta-rule |
| `RS-PUB-043` | Policy/provider/evaluator failure, missing current bundle, missing attestation or missing required fact | `REVIEW` | Zadatak ne može biti objavljen dok provera nije uspešna. | D-0140 fail-closed meta-rule |
| `RS-PUB-044` | Rule conflict, stale policy, unreviewed legal rule or stale Need fingerprint/revision | `REVIEW` | Potrebna je nova važeća provera; stara odluka ne važi. | D-0140 fail-closed meta-rule |
| `RS-PUB-045` | Public photo/media itself contains prohibited content, private IDs/contact/address or materially changes objective | `CLARIFY` or stronger matching rule | Uklonite/zamenите problematičan medij i ponovo proverite Zadatak. | OWNER_PLUS_ARCHIVE; media participates in fingerprint |
| `RS-PUB-046` | A person tries to publish a provider/service-offer listing (e.g. "Nudim krečenje", "Radim selidbe", service catalogue or self-promotion) instead of requesting a task | `BLOCK` | Na USKOČI se objavljuju Zadaci koje treba uraditi. Ono što umete da radite upisujete u svoj Radni profil. | OWNER_PLATFORM_POLICY; task-only inventory lock |

## 4. Precedence

1. A more specific `BLOCK` beats `ALLOW`.
2. A specific `REVIEW` beats ordinary-task `ALLOW`.
3. Missing material facts produce `CLARIFY` before a final allow decision.
4. `HITNO` never overrides policy.
5. Any stale/unreviewed/conflicting/missing policy state fails closed.
6. Editing text/media/objective after a decision creates a new revision/fingerprint and requires a new decision.
7. A provider/service-offer objective is never transformed into a Zadatak; it is rejected and the user is directed to Radni profil.

## 5. What this policy intentionally does NOT decide

This publication policy does not certify that the later performer:
- has every licence/credential/permit required for execution;
- has a particular tax or employment status;
- has right-to-work in every possible situation;
- is insured;
- is professionally competent merely because identity is verified.

Those are separate responsibilities/features. USKOČI must never imply a verification that it did not actually perform.

This policy also does not define how worker capabilities are visually presented. Product canon controls that surface: capability detail belongs to Radni profil; Zadatak map pins/cards remain task projections.

## 6. Sources used as reconciliation input

Primary archive groups:
- V0.1 `05_ALLOWED_RESTRICTED_PROHIBITED_TASKS`, `07_SAFETY_COMMUNITY_RULES`;
- V0.2 `03_TASK_LEGAL_GATE_CATALOG`, `04_LABOR_CLASSIFICATION_RISK`;
- V0.3 child/vulnerable and technical/professional boundary research;
- V0.4 `30_POSTAL_COURIER_ERRAND_BOUNDARY`, `31_WASTE_REMOVAL_BOUNDARY`, `32_REGULATED_GOODS`;
- RC1/RC2 marketplace/safety/moderation reconciliation;
- later owner D-0140 rule: AI interprets; server policy is authority; stale/missing/unreviewed/conflicting state fails closed.

Owner-added product-policy candidates in this V1 draft:
- public profanity/vulgarity cleanup (`RS-PUB-004`);
- financial/investment solicitation not supported (`RS-PUB-035`);
- gambling/betting promotion not supported (`RS-PUB-036`);
- only requester-created Zadaci may be public Marketplace inventory; provider/service-offer listings are not supported (`RS-PUB-046`).

These owner-policy rules are not phrased as claims that every underlying activity is illegal.

## 7. Activation gate

This file is **not** an active legal/policy bundle. Before production activation:

1. owner reviews the platform-policy choices;
2. legal/research rules marked `PROFESSIONAL_CONFIRMATION_REQUIRED` are either professionally approved or remain non-publishable/unsupported;
3. rules are compiled into immutable versioned machine-readable rule versions with hashes/provenance;
4. deterministic evaluator proof covers positive, negative, ambiguity, stale-fingerprint and bypass cases, including attempted provider/service-offer posts;
5. B06 records the exact evaluator/bundle/rules used;
6. B07 accepts only a current exact `ALLOW` from that approved evaluator/bundle.
