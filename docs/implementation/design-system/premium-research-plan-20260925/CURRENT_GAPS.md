# USKOČI: map of the existing product and next improvements

25 September 2026. Read-only inspection of local code. Working directory: `work/uskoci-r6-integration`; observed HEAD `9e13245fa4f6050c5006d5638128035f6f5db0f8`, documented R17 application source `8500bf29`. This inspection did not change the repository, DEV, server, application or business data, did not run tests and did not perform a new phone check.

Paths and line numbers below refer to that working directory. R/E/D identifiers refer to the supplied research foundation, extracted into `outputs/ux-research-20260925/document.txt`. They connect a proposal to a research topic; they do not claim that a specific USKOČI layout has been scientifically proven. The main research review handles independent verification of primary sources.

## 1. Starting decision: improve the actual product without another general redesign cycle

The current code already contains most core flows. The most valuable next step is to close continuity gaps, make consequences easier to compare and verify real journeys. A new appearance alone does not solve message reading, an unknown command outcome or a misunderstood amount.

- **One account, two sides remains the rule.** Početna → Zadaci → Dogovori is the existing navigation; the person's relationship to a specific object determines the action. There is no basis for a new global requester/worker switch. Evidence: `src/app/(app)/_layout.tsx:12–20`, `src/app/(app)/zadaci.tsx:68–75`, `UX_NACRT_20260922.md:24–34` under `docs/implementation/v5-ai-first/`.
- **The identity is already defined:** white reading surfaces, green/orange, original illustrations, stronger text at ordinary sizes, neutral rules and shadows, and soft motion that respects system Reduce Motion. Do not restore large mint surfaces or enlarge every title/price. Evidence: `USKOCI_MASTER_PLAN_DIZAJNA.md:8–12,79–80,155–178`.
- **Distinguish each screen's object:** a task card represents work being considered; detail is an open work brief; an application is a concrete offer; an Agreement is accepted work with a next action. R16/R17 already implement this distinction. Evidence: master plan `:23–33,46–57,184–196`.
- **Do not change money rules.** Preserve MY_PRICE/OFFERS, the total/per-person basis, the number of people and the total offer amount. Platform fees, payments and PKG-051 are separate work. Evidence: master plan `:192,241–246`; `src/ui/v2/ApplicationComposerPresentation.tsx:373–384,463–481`.
- **Evidence boundary:** R17 records 316 passing suites / 6,151 tests and installations; the phone confirmed the selected pin, detail and return before the USB connection was lost. This is not acceptance of all screens, real flows, the keyboard, iOS or AI quality. Evidence: `docs/implementation/design-system/r17-conversation-appointments-20260925/REPORT.md:42–54`; master plan `:35–42`.

Read the historical UX draft from 22 September as a flow and intent document, not as a current list of missing features. Its missing offer review, candidate message, public safety entries and links from an Agreement back to the task/application now have implementations. Its “Mapa” is now called “Zadaci”; current-location sharing in an Agreement was subsequently retired.

## 2. Map of responsibilities and gaps

### A. Discovery: map, list, search and filters

**Already implemented**

`/zadaci` is one map with a list over it. The map/list share data and filters; there is a remembered viewport, selected pin, clustering, special handling for multiple tasks at one point, tasks without a public point and remote work. Draft filters before applying, dates, work mode, pricing mode, remaining places, active criteria and reset already exist. “U blizini” is an explicit tap and a temporary foreground observation, not tracking. Portraits are limited to settled visible rows.

Evidence: `src/ui/v2/DiscoveryPresentation.tsx:95–113,151–166,295–325,386–399,481–535`; `src/data/marketplaceView.ts:183–242,268–298`; `src/ui/v2/discovery/DiscoverySearchPanel.tsx:194–197,230–237,289`; master plan `:187–190`. R17 already refined the narrow people-filter layout and map return; these are not unstarted features.

**P1 — concrete client issue: ownership and recovery, DN-01.** Refresh only starts the task read. The relation reader depends on the source and the same sequence of IDs; if those IDs do not change, a relation failure may remain unrecovered. Presentation removes confirmed own tasks, but shows them without a label when relations are unavailable. The current NEXT explicitly records that the owner wants own tasks to be allowed to remain visible with a clear label. Proposal: a guarded joint refresh of both reads, “yours / someone else's / relationship unconfirmed” states, an own-task label and consistent counts of the rows actually displayed, without changing application eligibility.

Evidence: `src/app/(app)/zadaci.tsx:45–57,70–72`; `src/data/marketplaceView.ts:278–281`; `src/ui/v2/DiscoveryPresentation.tsx:159–165`; `docs/implementation/design-system/r17-conversation-appointments-20260925/NEXT_DISCOVERY.md:5–7`. Research: R01, R24, R29, R52–R54, E01.

**P1 — scaling is a separate contract.** The current reader walks up to 25 × 200 rows before local filtering. Existing SQL has some filter parameters, but does not fully match the semantics of local search, flexible schedules, time zones, remaining places and rows without a point. Do not simply forward a few parameters and then claim the complete results/count are correct. Define server-bounded results, cursor and counts over the same criteria; specify distance/sorting separately. “U blizini” currently moves the camera and does not guarantee distance ordering.

Evidence: `src/data/supabaseIzvor.ts:177–201`; `NEXT_DISCOVERY.md:9–11` in the same R17 directory. Research: R23–R26, R28–R29.

**P2 — premium refinement to verify, not assume:** one dominant search entry; active criteria readable without opening the panel; a clear distinction between “map area” and a place; return from detail to the same pin/list/scroll position; explain empty results through the specific criterion. Preserve the existing USKOČI pins and required attribution. Check a narrow physical phone, more than 40 rich pins, GPS allowed/denied/failed and opening after installation. Do not restart the map/list with a new concept.

### B. Task detail → application → comparison and selection

**Already implemented**

Detail shows the title, work, location/time/people, price with its basis, requirements, actual publisher, photos, approximate map and questions. Its footer distinguishes an own task, an existing application, an unknown relationship and eligibility to apply. An offer has a total amount, number of people, time, message, final review and retry of the same request when the outcome is unknown. Applications already have the candidate's message, public profile, two-column comparison when it fits, a single column on narrow/enlarged-text displays, arrival/lowest-price sorting and explicit selection confirmation.

Evidence: `src/ui/v2/PublicNeedPresentation.tsx:89–144`; `src/ui/v2/ApplicationComposerPresentation.tsx:288–314,343–365,373–430`; `src/ui/v2/ApplicationSelectionPresentation.tsx:101–110,143–205,275–335`; `src/ui/v2/CandidateFace.tsx:158–220`. The commitment is submitted through a guarded route and a persisted immutable request, not just a local confirmation: `src/app/(app)/prilike/[id]/prijava.tsx:103–140`.

**P1 — acceptance and readability of the real decision.** Complete the current journey with two people: the same work/amount/people/time in detail, offer review, selection confirmation and Agreement; a changed or closed task; partially filled places; a lost response after submission; return from a profile. This verifies an existing flow rather than proposing a new “review before send”.

**P2 — improve comparison without inventing relevance.** Current comparison aligns total/people/time, while the complete message is in the opened offer. The next prototype can better show differences between two offered scopes and between the task's time and the proposed time, with a quiet link to the complete message. On a small screen, preserve the same attributes and return path rather than forcing two columns. If keeping selected offers for comparison is considered, define it as a local selection, not a server “shortlisted” status. Do not add an AI “best candidate”, unverified skills/licences or badges.

Evidence: `src/ui/v2/CandidateFace.tsx:195–220`; `src/ui/v2/ApplicationSelectionPresentation.tsx:314–325` explicitly preserves the decision that self-declared capabilities must not become labels presented to the requester. Research: R18–R19, R31, R38–R41, E03. Validate visual hypotheses with a task in which the user must state the total price and how many people will come in their own words.

### C. Agreement, messages, changes and completion

**Already implemented**

An Agreement already has Overview/Messages, a state-dependent next step, accepted terms, a distinction between current and proposed terms, links back to the source task/application when the ID exists, separate contact consents, a protected address, chronology, problem reporting, completion confirmation and rating. Outbox, photos and unknown-send-outcome handling exist. R17 already changed latest-message following and position preservation when context height changes.

Evidence: `src/app/dogovor/[id].tsx:178–197,288–310,328–348,359–425`; `src/ui/v2/AgreementCollectionPresentation.tsx:42–68`; R17 REPORT `:8–15`. Do not propose adding the existing “Zadatak” link as a new feature: its source is `src/app/dogovor/[id].tsx:380–392`.

**P1 — refresh without the conversation disappearing.** Messages uses the default refresh that clears data; it needs coalesced refresh that retains the visible transcript and exposes a separate refreshing state, without changing outbox authority. Multiple refresh calls should not create overlapping readers and scroll jumps. Check the docked keyboard both at the latest message and while reading older history; R14-N01 cannot be closed because the code changed or a floating keyboard looked good.

Evidence: `src/app/dogovor/[id].tsx:165–169,351–355`; `src/data/focusedResource.ts:20–47`; `src/hooks/useFocusedResource.ts:16–26`; `docs/implementation/design-system/r17-conversation-appointments-20260925/NEXT_CHAT.md:7–14`.

**P1 — incoming messages, paging and the read boundary must be designed together.** The current table read is ascending with no explicit limit/cursor; the route has no continuous incoming mechanism in this path. The read API accepts only an Agreement ID, so a message arriving between the read and acknowledgement may be included even though it was not displayed. Bounded latest/older pages require raw timestamp+ID, an anchor when prepending older messages, deduplication and a separate read-through boundary contract. A message's absence from the current page is not evidence that sending failed. Do not display a counterparty “read” status: the current value is `procitano: null`, and notification settlement is not that receipt.

Evidence: `src/data/supabaseIzvor.ts:287–334`; `src/app/dogovor/[id].tsx:192–197`; `NEXT_CHAT.md:7–14`. The boundary/read RPC is a server package; transcript retention alone is a client package. A Realtime subscription needs additional authorization/configuration verification and is not “enabled” according to this review. Research: R43–R48, R50, R53–R54, E04–E05.

**P1 — Home/Agreements must not depend on every individual rating query.** Each completed Agreement gets a separate parallel review RPC; this enrichment has no collection-wide budget/concurrency bound. Failure becomes false, which influences movement into history and Home's rating count. A small client measure: a bounded account-owned pool, a budget and an explicit unknown/unavailable state; this limits peak load, not the total number of calls. A true aggregate requires an extension to the server projection.

Evidence: `src/data/agreementClientService.ts:566–603`; `src/ui/v2/AgreementCollectionPresentation.tsx:43–46`; `src/data/homeSnapshot.ts:116–130`; `docs/implementation/design-system/r17-conversation-appointments-20260925/NEXT_RATINGS.md`. Research: R03, R43, R49, R51–R54.

### D. AI for a task and worker profile

**Already implemented — hybrid editing exists.** Conversation + summary + guarded final review is already the selected structure. Task review permits correction of individual facts: date/time, lists and text, with separate editing of place, photos and the application deadline. The worker conversation has a manual editor for name, skills, tools, vehicles, declared licences, number of people, biography and area; separate availability; frozen review; save or save-and-activate. A proposal is not yet a public profile/publication. Category is deliberately hidden from the user.

Evidence: `src/ui/v2/IntakePresentation.tsx:66–118,148–150`; `src/app/(app)/pregled-zadatka.tsx:318–350,420–443`; `src/ui/workerProfile/WorkerAiPresentation.tsx:119–148`; `src/app/(app)/profil/razgovor.tsx:219–241,289–291`. This is not a reason to rebuild an existing manual fallback. At the same time, manually correcting an existing AI proposal is not proof of fully independent publication from scratch without a conversation/provider.

**P1 — quality and control before decoration.** Verify that users find manual correction without guessing the menu; that corrections survive speech, network failure and return; that review always shows the frozen version being confirmed; and that users distinguish summary, review and publication/activation. The worker manual editor is a long sequence of text fields; organizing it by purpose and correcting focus/scroll/inline errors makes sense, rather than replacing the whole conversation with a new wizard.

**Separate operational/product work:** real category and correction accuracy, provider admission/budget, real microphone use and interruptions remain separate acceptance work. Android voice is transcript input; spoken AI responses and iOS speech are not implemented. Do not promise a full voice conversation just because there is a waveform button. Choosing text, holding the microphone and accessible dictation have different sending consequences; verify that people understand them.

Evidence: master plan `:198–207`; `src/ui/aiFirst/AiConversationShell.tsx:61,255–298`; `WorkerAiPresentation.tsx:134–143`. Research: R34–R38, R53–R54, E02. The premium outcome is a sense of control over one's own accurate draft, with truthful processing status.

### E. Profile, safety, settings and support

**Already implemented**

Profile already has open groups organized by purpose: identity, “Kako mogu da uskočim”, schedule/availability, account/help and privacy. Loading/error/read states, export, account closure, blocked accounts, legal documents, support, notifications and quiet-hour settings exist. Push settings already separate phone permission from in-app choices and have dirty/save/recovery handling and a pinned save action; these should not be reinvented.

Evidence: `src/ui/profile/ProfileHubPresentation.tsx:33–36,54–123`; `src/ui/notifications/PushPreferences.tsx:164–178,266–339`. R14 already refined normal profile/settings states; master plan `:220–225` calls for the remaining states, not a new composition of the normal screen.

**P1 — safety: context and confirmation are missing from the screen body.** Entry from a public profile first resolves targetAccountId through the server; the route validates the ID and prevents targeting one's own account. SafetyScreen itself displays a generic “user”, and its button directly sends `setBlock`, without confirmation. Add a verified name/person and the object from which the action originated, plus a short block confirmation stating the exact consequence. Do not invent an identity from a UUID or treat an arbitrary navigation parameter as an authoritative person. Where existing authorized data cannot supply identity, retain a limited fallback or define a separate read contract. Preserve revision/idempotency and unknown-outcome recovery.

Evidence: `src/ui/safety/useSafetyEntry.ts:22–28`; `src/app/(app)/bezbednost.tsx:10–25`; `src/ui/safety/SafetyScreen.tsx:20–45`; earlier confirmed finding `docs/implementation/design-system/r11-screen-composition-20260925/NATIVE_REVIEW.md:34`. Research: R10, R55–R56.

**P2 — one package for long forms and support.** Refine access to essentials, optional blocks, field focus, keyboard layout, saved/uncertain presentation and return position. Preserve the clear distinction between a problem visible to both participants and a private report to support. Verify authentication and recovery in their actual native context. No new bug has been established for every one of these screens; this is a concrete acceptance plan, informed by already recorded long worker/place/support forms.

Evidence: master plan `:220–225`; R11 NATIVE_REVIEW `:38`; `src/app/dogovor/[id].tsx:328–340`; `src/ui/safety/SafetyScreen.tsx:47–55`. Research: R13–R16, R20–R21, R55–R58.

**Written rating comment: an approved direction, not an existing feature.** Current ratings support 1–5 and up to three allowed tags; the UI and ReviewCommand have no comment. The record explicitly captures the owner's YES to a comment, but requires a server package covering length, visibility, reporting and retention. Plan its final place in the rating flow and its moderation consequences, but do not create a field that is not saved.

Evidence: `src/data/reviewsClientService.ts:10–16,73–81`; `src/ui/reviews/AgreementReviewPresentation.tsx:104–135`; `docs/control/redovi.json:1436`. Research: R19, R49, E08.

## 3. Recommended coherent packages

| Package | Concrete result | Type of work | Completion condition |
| --- | --- | --- | --- |
| 1. Continuity of core work | DN-01: visible ownership and joint retry; messages remain during refresh; rating unknown/pool; safety target and action confirmation | Client, with no change to business rules; identity uses existing verified projections | Tests of relevant states/concurrency, then one build and connected native scenarios; docked keyboard and account switching required |
| 2. A clear decision from task to Agreement | Refine comparison of different scopes/times, entry points for correcting an AI proposal, long forms and confirmations | Design + client over existing contracts | Same amount/people/time throughout the journey; two parties perform application/selection/completion; long text and a new person without reputation remain understandable |
| 3. Bounded data that can scale | Discovery query/count/cursor contract; chat latest/older + read-through boundary; bulk rating eligibility | Separate additive server proposals and client adapters | Semantic parity, concurrent arrival, authorization and disposable proof; DEV application only with the already required owner approval “primeni” |
| 4. Completion, trust and actual delivery | Written comment with rules; push/deep links; legal/operator items; AI/provider/microphone; complete privacy and recovery journeys | Mixed work, with several separate contracts/gates | Evidence by exact version, platform and real scenario; iOS and the complete phone journey remain separate |

Packages 1–2 use the existing white/green/orange USKOČI system and change only what helps decisions or continuity. Do not create an APK after every minor style adjustment. Package 3 is separate server work, not a reason to postpone a useful client correction in package 1. Align ordering within each package with the single tracker `docs/control/redovi.json`, without creating a parallel “done” list.

## 4. What this plan deliberately does not claim

It does not classify every feature as missing based on the old UX draft; close old findings with a new screenshot from another version; promise fewer seconds or more applications without user research; call a gallery a real business journey; or introduce a new payment model, global roles, mandatory categories, AI scoring of people or unsupported verified badges.

For premium acceptance, seek concrete observations: the person finds their own task and application without changing modes; correctly repeats the total price and scope; resumes after interruption without duplicate submission; recognizes the same object and position after returning; distinguishes a proposal from the current agreement; and knows who receives a problem report and what blocking changes. Assess visual impression separately from those outcomes.
