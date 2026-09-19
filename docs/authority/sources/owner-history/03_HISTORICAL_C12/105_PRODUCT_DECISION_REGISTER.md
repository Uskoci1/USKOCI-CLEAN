# USKOČI — PRODUCT DECISION REGISTER

**C12 status:** cumulative owner-review register. `OWNER_LOCKED` is product authority but does **not** authorize implementation. Global build gate remains NO until exact `APPROVED FOR CLEAN BUILD`.

| ID | Question | Status | Recommendation / target | Owner decision | Build gate |
|---|---|---|---|---|---|
| D-0009 | Which implementation strategy? | RECOMMENDED | HYBRID is prior recommendation; revalidate | Not yet explicitly locked by this directive | RELEVANT WAVE CUTOVER |
| D-0010 | Launch pricing strategy and prices? | RECOMMENDED | V1 launch portion is superseded by OWNER_LOCKED D-0075: promotional-free through the real Povezivanje engine with paid checkout disabled. Exact later paid package amounts/allowance/date remain intentionally deferred to PAID ENABLEMENT evidence and external gates. | V1 launch resolved; later paid commercial values deferred, not a V1 blocker | PAID ENABLEMENT |
| D-0011 | Primary navigation? | OPEN | Validate through user jobs and contracts | Candidate only | RELEVANT WAVE CUTOVER |
| D-0012 | Map/payment/AI providers? | OPEN | Keep domain provider-neutral; select adapters later | No provider locked | PAID ENABLEMENT |
| D-0013 | Team connection economics? | OPEN | Do not decide until physical model is proven | Open | RELEVANT WAVE CUTOVER |
| D-0016 | May same-SHA prior findings be accepted wholesale as current truth? | RECOMMENDED | Retain as `EVIDENCE_BASELINE`; never promote live/runtime/legal claims without proper proof | Not explicitly locked; follows owner evidence rule | RELEVANT WAVE CUTOVER |
| D-0017 | What happens to `LiveCloudProvider`? | RECOMMENDED | `REFACTOR`: preserve proven gateway/command/retry/reread behavior; split query/command facades by vertical | Open for final architecture review | PAID ENABLEMENT |
| D-0018 | May client-calculated Trust Score remain public? | RECOMMENDED | Remove/hide. Do not expose until one server owner, formula, included states, and update path exist | Owner North Star requires an owner for every number | RELEVANT WAVE CUTOVER |
| D-0019 | How should Marketplace pagination be transferred? | RECOMMENDED | `KEEP_BACKEND_NEW_CLIENT`: preserve browse RPC/gateway; add cursor/viewport context | Open for final contract review | RELEVANT WAVE CUTOVER |
| D-0020 | Is Compound Need/NeedPlan discarded because no UI consumes it? | RECOMMENDED | Preserve domain/backend; add target orchestration/projection consumer without exposing graph | Open for C04/C09 product lock | RELEVANT WAVE CUTOVER |
| D-0021 | Which Agreement detail owns Dogovor? | RECOMMENDED | Shared `/active/[agreementId]` concept is sole target owner; redirect/merge worker duplicate | Open for navigation lock; one-owner rule applies | RELEVANT WAVE CUTOVER |
| D-0022 | Is `MarketplaceDiscoveryProvider` active canonical architecture? | RECOMMENDED | No active-owner claim; it is unimported and its unwired test references absent paths. Recover useful logic only | Not owner-locked | PAID ENABLEMENT |
| D-0024 | What is the current Supabase verdict? | RECOMMENDED | `SUPABASE_REUSE_WITH_TARGETED_CLEANUP`; preserve canonical engines, fix bounded target contracts, retire duplicates only after proof | Not yet owner-locked | RELEVANT WAVE CUTOVER |
| D-0025 | May LAB be treated as full alpha parity? | RECOMMENDED | No. Keep `LAB_EVIDENCE_PARTIAL`; require object/config/Edge parity per scenario | Evidence rule is owner-approved | RELEVANT WAVE CUTOVER |
| D-0027 | Can the current Worker-side connection-access engine be called the target Povezivanje model? | NEEDS_OWNER_DECISION | Do not relabel it. Preserve for characterization; define Requester/consumption/replacement contract in C07 and reimplement only after approval | Requester-side is a strong Master hypothesis; exact economics still open | RELEVANT WAVE CUTOVER |
| D-0028 | Deploy source-only location resolver now? | RECOMMENDED | Do not deploy. Provider-neutral domain first; admit provider/processor/legal boundary before activation | No provider locked | RELEVANT WAVE CUTOVER |
| D-0030 | Continue 184 historical migrations or establish a verified baseline? | RECOMMENDED | Recommend baseline+archive only after an authorized isolated zero-unexplained-diff proof against alpha | Open; no baseline creation authorized | RELEVANT WAVE CUTOVER |
| D-0031 | How should post-auth return continuity transfer? | RECOMMENDED | `AuthReturnTargetStore` V2 with wrapper; reimplement typed resolver for Requester default, Marketplace Need, Worker targets and expiry | Guest continuity is owner-approved; exact TTL/copy remains open | RELEVANT WAVE CUTOVER |
| D-0032 | What are the canonical profile boundaries? | RECOMMENDED | One account; separate Account, Requester Profile, Worker Profile, and typed Public Profile contracts | One-account dual-role principle is OWNER_APPROVED | RELEVANT WAVE CUTOVER |
| D-0033 | How should broken Worker AI persistence be handled? | RECOMMENDED | One stable resumable conversation/session per subject flow; preserve fact/RPC/question logic behind new application owner | Open for architecture approval; no implementation now | RELEVANT WAVE CUTOVER |
| D-0035 | How should Requester AI intake transfer? | RECOMMENDED | Keep Guest V2/materializer with wrapper; reimplement typed summary/review/voice/media UX behind same DRAFT contract | Open for final architecture/UX approval | RELEVANT WAVE CUTOVER |
| D-0036 | When is a complex request one Need versus NeedPlan? | RECOMMENDED | Multi-stop stays one Need when one commitment owns it; split only for independent selection/Agreement/permissions/lifecycle/pricing | Owner North Star requires simple Compound behavior; exact Plan status is open | RELEVANT WAVE CUTOVER |
| D-0037 | What owns Need media and how does it transfer? | RECOMMENDED | Keep private backend, add AI-first preview/upload/remove/replace/retry and signed Detail gallery; no MINI/CARD task-photo thumbnail by default | Retention/deletion requires owner/legal decision | RELEVANT WAVE CUTOVER |
| D-0038 | What does moderation `REVIEW` mean before an operational queue exists? | RECOMMENDED | Fail closed; do not publish or promise SLA until authorized queue/reviewer/audit/return flow exists | Server-final authority is OWNER_APPROVED | RELEVANT WAVE CUTOVER |
| D-0039 | May verification badges be inferred from profile/auth data? | RECOMMENDED | Hide email/phone/identity/vehicle/credential badges unless the precise verification owner/status exists | Owner forbids invented data/numbers | RELEVANT WAVE CUTOVER |
| D-0040 | What are the target Requester price choices? | NEEDS_OWNER_DECISION | User-facing V0 should expose “Imam cenu” and “Tražim ponude”; adjudicate/retire legacy `FASTEST` semantics before transfer | Open | RELEVANT WAVE CUTOVER |
| D-0041 | Can protected characteristics become matching filters? | RECOMMENDED | Never translate a protected-trait preference automatically; ask for objective lawful requirement and block the discriminatory request as written | Principle is owner-directed; exact legal exceptions need counsel | RELEVANT WAVE CUTOVER |
| D-0042 | Should NeedPlan have an independently writable status? | OWNER_LOCKED | No independently writable Plan lifecycle status in V0; overall Plan progress is derived from child canonical Potrebe/Dogovori so the umbrella cannot contradict executable truth | LOCKED 2026-08-25 C12.5; a future explicit atomic plan-level intent would require a new owner decision, not a hidden mutable status | RELEVANT WAVE CUTOVER |
| D-0043 | Is Compound NeedPlan mandatory V0 core? | OWNER_LOCKED | Multi-stop is V0 core as one Potreba when one Uskočer/team commitment owns the whole route; true compound work with independent Workers/selection/prices/Dogovori/lifecycles is split into multiple canonical Potrebe. Dedicated NeedPlan UI is not launch-mandatory; backend/domain umbrella may be preserved for organization/projection | LOCKED 2026-08-25 C12.5; AI may propose the split, human confirms, and every child Potreba follows the normal canonical flow | RELEVANT WAVE CUTOVER |
| D-0044 | How should target geography distinguish ONLINE, topology and public precision? | RECOMMENDED | Use separate domain/application concepts while adapting current backend modes; do not migrate enums for aesthetics | Open for architecture approval | RELEVANT WAVE CUTOVER |
| D-0045 | Who creates public approximate coordinates? | RECOMMENDED | Server privacy service derives the public projection atomically; rounding alone is not universal anonymity | Master requires server/RLS privacy authority; exact projection policy open | RELEVANT WAVE CUTOVER |
| D-0047 | What key binds a recommendation to displayed Need truth? | RECOMMENDED | Require Need ID + exact Need revision + matcher version; stale annotation is ignored | Open for architecture approval | RELEVANT WAVE CUTOVER |
| D-0048 | Should the UI show raw matcher score/percent? | RECOMMENDED | Hide raw score. Show at most one or two server-proven user-safe reasons | Owner requires proof for every number | RELEVANT WAVE CUTOVER |
| D-0049 | How should map panning trigger data retrieval? | SUPERSEDED_BY_D-0118 | Older recommendation was explicit search-this-area after meaningful pan | Superseded by C12.15 owner lock: settled viewport auto-refreshes after debounce | RELEVANT WAVE CUTOVER |
| D-0050 | Is near-me device location saved Worker matching truth? | SUPERSEDED_BY_D-0142 | Use transiently only after explicit permission; saving matching origin/radius is a separate human-confirmed preference command | Superseded by C12.37.3 owner lock D-0142 | RELEVANT WAVE CUTOVER |
| D-0051 | What is one inbox item and unread number? | SUPERSEDED_BY_D-0143 | One event-level item/read state; channel delivery attempts remain transport metadata | Resolved by C12.37.4 D-0143 | RELEVANT WAVE CUTOVER |
| D-0052 | How should orphan Marketplace discovery code transfer? | RECOMMENDED | `TRANSFER_LOGIC_ONLY`; characterize pagination/filter/viewport/on-demand concepts and bind them to one target discovery service | Open for transfer review | RELEVANT WAVE CUTOVER |
| D-0053 | Should task route distance constrain radius/eligibility or only rank/context? | OWNER_LOCKED | Worker radius is a hard preference for Worker matching-origin → first physical Need stop only. The Need's own route length/burden is a separate displayed/ranking fact and does not make the Need ineligible merely because route length exceeds radius. Any future hard maximum-total-travel rule must be a separate explicit Worker preference, never an overloaded radius. | LOCKED 2026-08-25 C12.6; Na daljinu has no physical radius | RELEVANT WAVE CUTOVER |
| D-0054 | Are Application and Offer separate aggregates? | RECOMMENDED | One `Application` aggregate; `pricing.kind` represents fixed-price or offer semantics; adapt current response kind without exposing two lifecycles | Open for domain lock | RELEVANT WAVE CUTOVER |
| D-0055 | Do physical and online Applications use different intake/write authorities? | OWNER_LOCKED | One Application AI + human-confirmation flow for physical and Na daljinu; no silent remote direct-submit bypass | LOCKED: physical and Na daljinu both use AI proposal → human review → explicit send | RELEVANT WAVE CUTOVER |
| D-0056 | What communication is allowed before selection? | OWNER_LOCKED | Anonymous Need Q&A before selection; full private chat only after Dogovor | LOCKED: question anonymous to Requester and public; public only after Requester answers; system retains author internally; edited answers show Izmenjeno | RELEVANT WAVE CUTOVER |
| D-0057 | What must Requester selection bind? | RECOMMENDED | Bind exact Need revision and observed Application version/hash; use a semantic request ID and replay receipt | Open for architecture approval | RELEVANT WAVE CUTOVER |
| D-0058 | Can coverage above one be submitted without named team members? | OWNER_LOCKED | Yes. V0 uses accountable lead + covered headcount; no named-helper roster required | LOCKED: lead may cover multiple people; helpers need no account/name/roster; no inherited rating | RELEVANT WAVE CUTOVER |
| D-0059 | What is the V0 team Agreement model? | OWNER_LOCKED | Lead owns the Application/Dogovor for covered quantity; helper identity is not a formal V0 aggregate | LOCKED: simple lead + covered-headcount model; richer organization model optional, not V0 prerequisite | RELEVANT WAVE CUTOVER |
| D-0060 | Which screen owns Dogovor detail? | RECOMMENDED | Shared `/active/[agreementId]` is the sole product owner; merge/redirect the Worker duplicate after parity | Open for C08 navigation lock | RELEVANT WAVE CUTOVER |
| D-0061 | How should execution actions map to server states across modes? | RECOMMENDED | UI emits semantic actions with expected version/state and stable request IDs; application layer maps valid actions per PHYSICAL/REMOTE/PICKUP_DELIVERY mode | Open for architecture/UX approval | RELEVANT WAVE CUTOVER |
| D-0062 | May operational cancellation require counterparty acceptance? | OWNER_LOCKED | Operational cancellation is unilateral; consequences separate | LOCKED: counterparty cannot veto cancellation; history/attribution preserved | RELEVANT WAVE CUTOVER |
| D-0063 | What recovery follows qualifying Worker failure? | OWNER_LOCKED | Same-Need same-vacated-coverage replacement entitlement. C12.7 window opens immediately after qualifying Worker cancellation or confirmed no-show and expires at the earliest of refill, Requester closure/cancellation, basis-invalidating material revision, or 24h after original confirmed execution-window end | LOCKED CORE + WINDOW 2026-08-25 C12.7; no-show report alone is not confirmation; server owns deadline | RELEVANT WAVE CUTOVER |
| D-0064 | What if a bounded replacement is not found? | OWNER_LOCKED | No automatic universal/global refund if replacement is not found; support remedy separate | LOCKED CORE: no global credit/refund automatically; support correction is separate | RELEVANT WAVE CUTOVER |
| D-0065 | How should cancellation severity and enforcement be decided? | OWNER_LOCKED | Progressive/contextual enforcement using actor, timing, severity, reason/context, repetition/history, corroborated evidence and confirmed abuse; one ordinary cancellation is not an automatic penalty/ban; AI may triage but cannot alone impose severe suspension/final abuse or fraud verdict | LOCKED 2026-08-25; exact numeric windows/counts/durations and appeal/SLA remain later policy parameters | RELEVANT WAVE CUTOVER |
| D-0066 | What happens when a user blocks another during an active Agreement? | OWNER_LOCKED | Do not finalize block while Dogovor is active; route user to complete/cancel first, keep immediate report path, then allow block from profile/history after terminal state; preserve all history/evidence | LOCKED 2026-08-25: active Dogovor must first end; future matching/contact blocked only after terminal; history/evidence retained | RELEVANT WAVE CUTOVER |
| D-0068 | How should `rpc_r37_set_response_team` transfer? | RECOMMENDED | `REIMPLEMENT_SAME_CONTRACT`; preserve roster/version semantics but write canonical amount and currency atomically | Open for build approval only | RELEVANT WAVE CUTOVER |
| D-0069 | What is the target review entry and reputation projection? | OWNER_LOCKED | Public reputation = eligible completed-Dogovor rating average + review count + server-proven completed jobs. Cancellation/late-cancel/no-show/reliability remain internal policy signals and never silently alter the star average or appear as raw public counts. No preselected rating/recommendation; role-valid tags. | LOCKED 2026-08-25 C12.4; internal signals may affect matching/T&S only under explicit policy such as D-0065, not public star math | RELEVANT WAVE CUTOVER |
| D-0071 | Who is the target Povezivanje beneficiary/payer? | OWNER_LOCKED | Requester is Povezivanje payer/beneficiary | LOCKED: Requester economic payer/beneficiary; Applications free | RELEVANT WAVE CUTOVER |
| D-0073 | When should a unit reserve and consume? | OWNER_LOCKED | Consume Povezivanje when exact selected Application activates Dogovor; no redundant Worker re-confirm | LOCKED: selection of unchanged Application activates Dogovor and consumes per covered headcount | RELEVANT WAVE CUTOVER |
| D-0074 | How should just-in-time purchase return to selection? | RECOMMENDED | Return to same Requester/Need/revision/candidate/Application/allocation only after issuance, then revalidate all facts before reserving | Open for UX/architecture lock | RELEVANT WAVE CUTOVER |
| D-0075 | What launch/pricing sequence best protects liquidity? | OWNER_LOCKED | V1 launches promotional-free for all eligible Requesters through the real Povezivanje entitlement/activation engine with `costQuantity=0` and paid checkout disabled. Paid packages/allowance may be introduced only after marketplace/liquidity evidence and all store/legal/fiscal/payment/provider gates. No exact paid RSD price/date is a V1 launch requirement. | LOCKED 2026-08-25 C12.13; free V1 launch is product truth, later paid commercial values are deferred enablement configuration | PAID ENABLEMENT |
| D-0076 | How should a multi-slot Need consume Povezivanja? | OWNER_LOCKED | Povezivanje consumption is allocation/headcount scoped | LOCKED: consume per covered headcount; independent coverage can activate independently | RELEVANT WAVE CUTOVER |
| D-0077 | When can one Worker team covering five equal one Povezivanje? | OWNER_LOCKED | A lead covering N people consumes N Povezivanja, not one | LOCKED: one lead covering two consumes two; teammate account not required | RELEVANT WAVE CUTOVER |
| D-0078 | How does replacement interact with the global ledger? | OWNER_LOCKED | Original activation remains consumed; replacement OPEN/RESERVED/CONSUMED/EXPIRED events carry zero global bucket delta and bind original Need/allocation; C12.7 expiry is server-owned and bounded | LOCKED CORE + WINDOW 2026-08-25 C12.7 | RELEVANT WAVE CUTOVER |
| D-0079 | May cancellation, payment refund and entitlement correction share one command? | RECOMMENDED | Keep operational cancellation, provider-verified money refund/chargeback, and reason-coded support grant correction separate; no inferred cross-transition | Open for architecture/legal lock | RELEVANT WAVE CUTOVER |
| D-0080 | What happens when bounded replacement is not filled? | OWNER_LOCKED | Entitlement ends `EXPIRED/NOT_FILLED`; original remains consumed; support may grant only an approved exceptional remedy; C12.7 hard deadline is 24h after original confirmed execution-window end unless an earlier terminal condition occurs | LOCKED CORE + WINDOW 2026-08-25 C12.7; no automatic global credit/refund | RELEVANT WAVE CUTOVER |
| D-0081 | May purchased Povezivanja expire? | OWNER_LOCKED | Purchased Povezivanja do not expire | LOCKED: purchased units never expire; promotional/replacement windows are distinct | PAID ENABLEMENT |
| D-0082 | May paid checkout be enabled for V0 now? | RECOMMENDED | Keep `UNCONFIGURED`/checkout disabled; exact Apple/Google SKU channel and Serbian operator/NBS/fiscal/VAT/consumer/currency duties must be documented before any paid flag/SKU/provider | Open; professional confirmations required | PAID ENABLEMENT |
| D-0084 | What is Requester primary V0 navigation? | OWNER_LOCKED | Requester nav = Početna \| Potrebe \| + \| Dogovori \| Profil | LOCKED | RELEVANT WAVE CUTOVER |
| D-0085 | What is Worker primary V0 navigation? | OWNER_LOCKED | Worker nav = Početna \| Prijave \| [USKOČI znak→Prilike] \| Dogovori \| Profil; availability from Home/Profile | LOCKED | RELEVANT WAVE CUTOVER |
| D-0086 | How should Dogovor local information be organized? | OWNER_LOCKED | Dogovor local nav = Pregled \| Poruke | LOCKED: chronology can be a section/contextual surface; no required Tok tab | RELEVANT WAVE CUTOVER |
| D-0087 | What visual system should operational screens use? | RECOMMENDED | Warm ivory/light operational canvas, midnight trust/status, orange action, semantic status colors; current dark counterpart; no parallel role systems | Open for final visual lock | RELEVANT WAVE CUTOVER |
| D-0088 | Should V0 have global Map or Messages primary tabs? | OWNER_LOCKED | No global Map or Messages primary tab; Prilike owns map/cards and Dogovor owns full chat | LOCKED by final navigation + communication model; exact map interaction remains D-0108 OPEN | RELEVANT WAVE CUTOVER |
| D-0089 | May C08 introduce a new font/typeface dependency to make Figma look more premium? | RECOMMENDED | Do not invent a font dependency in read-only product definition. Preserve current scale; lock a cross-platform family only with owner approval and implementation/performance review | Open | RELEVANT WAVE CUTOVER |
| D-0100 | Does selected unchanged Application require another bilateral Dogovor confirmation? | OWNER_LOCKED | No. Worker Application is Worker consent; Requester selection is Requester consent; unchanged Dogovor activates immediately | LOCKED | RELEVANT WAVE CUTOVER |
| D-0101 | What private contact data unlocks after Dogovor? | OWNER_LOCKED | Exact physical operational details only when needed; phone opt-in; email not standard; Na daljinu has no address reveal | LOCKED | RELEVANT WAVE CUTOVER |
| D-0102 | How does completion finalize? | OWNER_LOCKED | Worker done opens 48h Requester window; no problem → auto-complete; Requester can complete independently; no mandatory start-work gate | LOCKED | RELEVANT WAVE CUTOVER |
| D-0103 | Does accepted material Dogovor change require another confirmation round? | OWNER_LOCKED | No. Proposer consent + other-party acceptance activates the new version immediately; old version remains immutable history | LOCKED | RELEVANT WAVE CUTOVER |
| D-0104 | Must Worker finish profile before browsing Prilike? | OWNER_LOCKED | No. Browsing is allowed; minimum human-confirmed Worker profile is required before first Application | LOCKED | RELEVANT WAVE CUTOVER |
| D-0105 | Who can see the author of a preselection Need question? | OWNER_LOCKED | Neither Requester nor public users; only the system retains author identity for abuse/spam/audit | LOCKED | RELEVANT WAVE CUTOVER |
| D-0106 | When does a preselection question become public? | OWNER_LOCKED | Only after Requester answers; ignored/rejected/reported questions stay non-public | LOCKED | RELEVANT WAVE CUTOVER |
| D-0107 | May Requester edit a published Q&A answer? | OWNER_LOCKED | Yes; show a discreet Izmenjeno marker and retain audit/version history | LOCKED | RELEVANT WAVE CUTOVER |
| D-0108 | What is the remaining final marketplace map provider/gesture/layout contract? | OPEN | Provider and remaining layout/low-level map interaction details remain open; map refresh is locked by D-0118, clustering by D-0119 and individual pin visible content by D-0120 | OPEN REMAINDER after C12.15–C12.17; do not reopen locked map semantics | RELEVANT WAVE CUTOVER |
| D-0109 | How long does an Application remain fresh/active and what happens when the Potreba changes materially? | OWNER_LOCKED | No arbitrary time expiry. Material Need change makes affected unselected Application STALE_REVIEW_REQUIRED/non-selectable and notifies Worker with a readable diff. Worker explicitly chooses Zadrži prijavu (reconfirm/rebase same terms to latest Need revision), Izmeni prijavu (AI/review + explicit new version), or Povuci prijavu. No response = stays stale; no silent consent carry-forward. | LOCKED 2026-08-25 C12.12; active Dogovor changes use separate Dogovor material-change consent rule | RELEVANT WAVE CUTOVER |
| D-0110 | Does changing an unregistered helper require a separate team-member change flow? | OWNER_LOCKED | No. If lead still covers the same quantity/terms, helper identity change is non-material; only covered-headcount/terms change is material | LOCKED | RELEVANT WAVE CUTOVER |
| D-0111 | How does live `Dostupan sam` interact with weekly availability? | OWNER_LOCKED | `Dostupan sam = ON` persists until Worker turns it OFF (or account/safety authority disables it), has no arbitrary auto-expiry, and may override the weekly recurring baseline. It cannot override active Dogovor/personal hard unavailable block or missing skill/resource/location eligibility. OFF does not hide manual Prilike. | LOCKED 2026-08-25 C12.8; exact proactive-notification behavior while OFF for future scheduled Needs remains separate | RELEVANT WAVE CUTOVER |
| D-0112 | What proactive opportunity notifications remain when `Dostupan sam = OFF`? | OWNER_LOCKED | OFF suppresses immediate/ready-now proactive opportunity dispatch but does not suppress future-scheduled Need notifications when execution time matches confirmed weekly/date-specific availability and notification preferences. ON allows immediate + future eligible alerts; manual Prilike remains available in both states; quiet hours/channel/topic preferences still gate delivery. | LOCKED 2026-08-25 C12.9 | RELEVANT WAVE CUTOVER |
| D-0113 | May `HITNO` opportunity push bypass Worker quiet hours automatically? | OWNER_LOCKED | No. Quiet hours apply to HITNO by default. Worker may explicitly opt in via a separate preference such as `Dozvoli HITNO tokom tihih sati`; default OFF. In-app event/inbox may still record the event. Urgent bypass affects only interrupting delivery and never bypasses eligibility/safety/topic/channel gates. | LOCKED 2026-08-25 C12.10; exact end-of-quiet-hours delayed-push revalidation remains separate | RELEVANT WAVE CUTOVER |
| D-0114 | Must a quiet-hours-delayed opportunity push be revalidated before later delivery? | OWNER_LOCKED | Yes. Never blindly deliver an old queued opportunity push. At release time the server revalidates current Potreba revision/state, remaining coverage, Worker eligibility/availability/preferences and actionability; stale/filled/cancelled/expired/materially changed/ineligible opportunities are suppressed, otherwise only a fresh privacy-safe delivery attempt may proceed. | LOCKED 2026-08-25 C12.11; in-app event/history remains separate from transport delivery | RELEVANT WAVE CUTOVER |

| D-0115 | Must the first public V1 be structurally update-ready for later app/data releases? | OWNER_LOCKED | Yes. V1 release identity, signing, versioning, API/schema compatibility, local-state migration, release channels and rollback/recovery rules must be established before public release so later versions can update in place without account/domain-data loss. Store binary updates remain authoritative for native-runtime changes; any OTA/update layer must enforce runtime compatibility and never bypass store/platform policy. | LOCKED 2026-08-25 C12.13; this is a release requirement, not permission to mutate/build before the gate | RELEVANT WAVE CUTOVER |

| D-0116 | What is the V1 soft-vs-mandatory app-update policy? | OWNER_LOCKED | Ordinary feature/fix releases are optional/soft prompts. Server may require a mandatory update only when the installed client is unsafe, critically broken, or below a server-owned minimum supported compatibility version. Mandatory-update screen routes to the official store and never requires destructive local reset. | LOCKED 2026-08-25 C12.14; owner agreed after benchmark discussion | RELEASE |
| D-0117 | Must V1 be payment-ready even though paid checkout launches disabled? | OWNER_LOCKED | Yes. Ship the canonical Povezivanje/ledger/quote/catalog/config/return/revalidation boundaries and a server-controlled paid-enabled capability in V1, but keep charging/checkout/provider activation OFF. Later paid enablement may be server/config-only only if the already-shipped client, chosen provider, store policy and legal/fiscal gates fully support it; otherwise ship a normal compatible app update. Never hard-code a promise that payment can always be enabled without an update. | LOCKED 2026-08-25 C12.14; payment-ready but disabled | PAID ENABLEMENT |
| D-0118 | How should native Prilike map refresh after Worker pans/zooms? | OWNER_LOCKED | Auto-refresh the settled visible bounded area after a short debounce/coalescing window; do not query every camera frame. Keep prior snapshot during loading, then update pins + bottom cards atomically from the same result set. Manual `Pretraži ovo područje` is fallback/retry, not the primary V1 flow. | LOCKED 2026-08-25 C12.15; provider/clustering/debounce tuning remains later, while individual marker content is now D-0120 | RELEVANT WAVE CUTOVER |

| D-0119 | How should Prilike pins cluster when many Potrebe share a small visible area? | OWNER_LOCKED | Show individual Potreba pins whenever current zoom/density keeps them legible. Cluster only when pins would materially overlap/become unreadable. Tapping a cluster zooms/expands/separates members and never selects an arbitrary hidden Need; clusters dissolve back into individual pins when zoom permits. Individual pin and bottom-card focus remain synchronized from one result snapshot. | LOCKED 2026-08-25 C12.16; clustering thresholds/algorithm/cluster visuals remain implementation tuning; individual marker content is D-0120 | RELEVANT WAVE CUTOVER |

| D-0120 | What visible content should an individual physical Potreba pin show in Prilike? | OWNER_LOCKED | Use only the canonical USKOČI pin/mark symbol on each individual Potreba marker. Do not print price/currency, `PONUDE`, `HITNO`, title, Requester name/avatar, exact address or recommendation/matcher data on the marker. Tapping the pin focuses the synchronized bottom card; selection may add only a non-content ring/scale/halo. Accessibility labels may remain descriptive. | LOCKED 2026-08-25 C12.17; cluster count remains allowed because a cluster is an aggregate navigation affordance, not an individual Potreba pin | RELEVANT WAVE CUTOVER |

| D-0121 | What is the primary native-phone Prilike map/card layout? | OWNER_LOCKED | Use one stacked screen: live map in the upper region and a one-column vertical list of Opportunity cards directly below, one card under another. The lower list scrolls vertically. Pin tap scrolls/focuses its matching card; card focus/tap highlights its matching pin. No horizontal opportunity-card carousel or draggable overlay sheet is the primary V1 browsing model. | LOCKED 2026-08-25 C12.18; exact map:list height ratio/responsive tuning remain implementation/device details | RELEVANT WAVE CUTOVER |

| D-0122 | What is the default Worker Prilike ordering and which manual sort/scope choices remain available? | OWNER_LOCKED | Default card order is `Najbolje za mene`, server-ranked from current task-relevant facts without exposing raw matcher %. Worker may manually sort by `Najbliže`, `Najnovije`, `Najskoriji termin`, `Cena: niža prvo`, or `Cena: viša prvo` where distance/currency semantics are valid. Preserve semantic scope `Sve / Fizičke (in-person) / Na daljinu`; remote has no fabricated distance/pin. Sort/scope updates one shared map+card result snapshot and does not silently become notification or hard-visibility policy. | LOCKED 2026-08-25 C12.19; exact chip/dropdown styling and remaining filter-detail presentation are implementation UX | RELEVANT WAVE CUTOVER |

| D-0123 | How do MINI / CARD / DETAIL map to the native-phone Prilike browsing flow? | OWNER_LOCKED | Keep three deterministic projections of the same Need revision. MINI is for secondary compact contexts only; the primary Prilike vertical list uses CARD with scan-safe task summary, price/offer mode, people, time, public area and single-place/route meaning. Tapping CARD opens full-screen DETAIL with full public-safe scope, media/route and anonymous Q&A. Swipe-down or normal Back returns to the exact prior map viewport, filters/sort, list scroll and selected pin/card. AI may compose the readable summary from human-confirmed canonical facts but cannot invent or hide material terms. | LOCKED 2026-08-25 C12.20; exact card typography/height and platform transition animation remain implementation UX | RELEVANT WAVE CUTOVER |
| D-0124 | Should task photos/media appear directly on the primary Prilike CARD? | OWNER_LOCKED | No. Primary vertical CARD stays text/fact-first and shows no task-photo thumbnail or media preview. CARD may indicate media availability only through a subtle non-image count/icon if useful; actual signed photos/media open in full-screen DETAIL. | LOCKED 2026-08-25 C12.21; protects scan speed/privacy/performance and preserves DETAIL as media owner | RELEVANT WAVE CUTOVER |

| D-0125 | Should the primary `Prilike` CARD show `Zašto Vam odgovara` / match-reason chips or lines? | OWNER_LOCKED | No. Keep the primary browse CARD clean and task-fact-only. `Najbolje za mene` remains server-owned ordering, but CARD shows no recommendation-reason sentence/chip, capability-fit label, raw matcher score or percentage. Evidence-backed explanation may remain in deliberate secondary contexts such as DETAIL/Worker Home when current and useful. | LOCKED 2026-08-25 C12.22; D-0048 explainability remains applicable outside the primary CARD, while the CARD consumer is explicitly zero-reason | RELEVANT WAVE CUTOVER |

| D-0126 | Should the primary `Prilike` CARD show Requester identity/reputation? | OWNER_LOCKED | Yes. Show a small but visible trust strip with authorized public avatar, public display name and server-owned rating state; authoritative review count may accompany rating compactly. Job facts remain primary. Never expose phone/email/exact address/private verification evidence or fabricate a rating. | LOCKED 2026-08-25 C12.23; D-0120 still keeps identity off individual map pins | RELEVANT WAVE CUTOVER |

| D-0127 | How should taps on the Requester trust strip vs the rest of the primary Prilike CARD behave? | OWNER_LOCKED | Treat the compact public Requester avatar/name/rating strip as one distinct accessible profile affordance: tapping it opens that Requester's public profile. Tapping anywhere else on the CARD opens the Need DETAIL. The trust-strip hit target must be large enough for touch/accessibility but must not steal ordinary CARD taps; Back from either destination restores the exact prior Prilike map/list/query context. No contact/private data is exposed and neither action mutates Need/profile truth. | LOCKED 2026-08-25 C12.24; profile-unavailable/error state fails safely without redirecting to a different action | RELEVANT WAVE CUTOVER |

| D-0128 | Should the Requester public profile show the actual individual reviews beneath the rating summary? | OWNER_LOCKED | Yes. Beneath authoritative average/count, show eligible individual reviews with the actual submitted 1–5 stars and the real reviewer-authored written comment when present. Never invent/AI-generate/seed review prose; no-comment reviews remain star-only. Feed and aggregate use the same completed-Dogovor eligibility/moderation truth. | LOCKED 2026-08-25 C12.25; exact reviewer-identity/date visual treatment remains separate | RELEVANT WAVE CUTOVER |

| D-0129 | Should each individual public review show the identity of the person who actually left it? | OWNER_LOCKED | Yes. Each eligible review entry shows the canonical reviewer's authorized public avatar/photo and public display name, together with the actual submitted stars and human-authored comment when present. Reviewer identity comes only from the authorized public-profile projection; no phone/email/exact address/private verification data or synthetic reviewer identity is exposed. Exact reviewer-profile tap navigation and date treatment remain separate. | LOCKED 2026-08-25 C12.26; extends D-0128 review-evidence surface without changing review eligibility/aggregate truth | RELEVANT WAVE CUTOVER |


| D-0130 | Should tapping the reviewer avatar/name inside a public review open that reviewer's public profile? | OWNER_LOCKED | Yes. Treat only the reviewer's authorized public avatar/name as a distinct accessible profile affordance that opens that exact reviewer's public profile. Tapping stars or review text does not navigate. Back restores the exact prior profile and review-scroll position. If the reviewer profile is unavailable/unauthorized, fail explicitly without opening another profile or action. | LOCKED 2026-08-25 C12.27; exact review date presentation remains separate | RELEVANT WAVE CUTOVER |

| D-0131 | How should each public review show when it was left? | OWNER_LOCKED | Show a truthful relative-age label derived from the canonical review timestamp, using natural coarse units such as `pre 1 dan`, `pre 1 nedelju`, `pre 1 mesec`, `pre 1 godinu` and corresponding plural counts (for example `pre 3 meseca`, `pre 2 godine`). Do not show hour/minute precision on the public review card. The label is presentation only and never rewrites the immutable review timestamp. | LOCKED 2026-08-25 C12.28; exact localization/pluralization thresholds are implementation/i18n details as long as the displayed age remains truthful | RELEVANT WAVE CUTOVER |

| D-0132 | Should the Requester public profile show a completed-Dogovor count? | OWNER_LOCKED | Yes. Show a compact server-proven count such as `12 završenih dogovora`, counting distinct canonical completed Dogovori where the profiled account acted as Requester. Do not infer from posted Potrebe, Applications, selection-only state, cancellations/no-shows or review count. Keep it independent of star math, role-scoped, aggregate-only and privacy-safe. | LOCKED 2026-08-25 C12.29; Worker completion count remains a separate role-specific metric | RELEVANT WAVE CUTOVER |

| D-0133 | Should the Requester public profile show a `Verifikovan identitet` badge? | OWNER_LOCKED | Yes, but only when a precise server-authoritative identity-verification owner/state says the profiled account is currently and validly verified. Missing, expired, revoked, unsupported, failed or uncertain verification shows no badge. Never infer verification from auth/profile/rating/history; never expose underlying documents/evidence; badge means identity verification only, not endorsement, skill, reliability or safety guarantee. | LOCKED 2026-08-25 C12.30; product-resolves D-0039 anti-inference rule for this consumer while implementation/runtime proof remains gated | RELEVANT WAVE CUTOVER |

| D-0134 | What happens when a user taps the Requester public-profile `Verifikovan identitet` badge? | OWNER_LOCKED | Open a small privacy-safe explanatory sheet such as `Identitet je potvrđen`. Briefly explain that the account passed the current identity-verification process and explicitly that this is not a USKOČI endorsement, skill credential, reliability score, safety guarantee or quality promise. Never reveal verification documents/evidence/provider payloads or route to private verification data; the sheet is informational/non-mutating and stale verification fails closed. | LOCKED 2026-08-25 C12.31; exact sheet visuals/microcopy remain implementation/accessibility/i18n tuning | RELEVANT WAVE CUTOVER |

| D-0135 | Should the compact Requester trust strip on the primary `Prilike` CARD show verified-identity state? | OWNER_LOCKED | Yes, but only as one tiny verified check/icon next to the Requester's public display name when the same server-authoritative identity-verification truth used by D-0133 is currently valid. Do not show the full `Verifikovan identitet` text on CARD. The check is not a separate tap target; the whole trust strip keeps D-0127 behavior and opens the public profile. Missing/stale/revoked/uncertain verification shows no icon, and the mark never implies endorsement, skill, reliability, safety or quality. | LOCKED 2026-08-25 C12.32; exact icon visuals/accessibility copy remain implementation tuning | RELEVANT WAVE CUTOVER |

| D-0136 | Should the Uskočer public profile show a completed-work count? | OWNER_LOCKED | Yes. Show a compact server-proven count such as `27 završenih poslova`, counting distinct canonical completed Dogovori where the profiled account was the accountable Worker/lead. Do not infer from Applications, candidate selection, helper/team headcount, cancellations/no-shows, nonterminal work or review count. Team V0 credits the accountable lead only. Keep it independent of star math, role-scoped, aggregate-only and privacy-safe; Requester completed-Dogovor count remains separate under D-0132. | LOCKED 2026-08-25 C12.33; exact copy/pluralization and final metric-owner implementation remain gated | RELEVANT WAVE CUTOVER |

| D-0137 | Is identity verification one account-level truth across Requester and Uskočer public profiles? | OWNER_LOCKED | Yes. Identity verification belongs to the human account, not to a role. Requester and Uskočer public-profile projections consume the same current/valid server-authoritative verification state; do not create a second Worker-only or Requester-only verification truth. If authoritative verification expires/revokes, all role projections lose the badge/check after freshness revalidation. The same privacy-safe meaning/limits from D-0133/D-0134 apply and verification evidence remains private. | LOCKED 2026-08-25 C12.34; owner explicitly stated `identitet je identitet`; role-specific profile content remains separate while identity truth is shared | RELEVANT WAVE CUTOVER |


## C12.35 — UI/UX closure + owner visual-reference boards

| ID | Question | Status | Owner decision | Evidence/status | Build impact |
|---|---|---|---|---|---|
| D-0138 | Should owner review continue through micro product/UI/UX decisions before clean build? | OWNER_LOCKED | Yes. Continue systematic screen-by-screen and flow-by-flow closure, including micro decisions that affect visible behavior, interaction, states, navigation, comprehension or accessibility. Pure engineering internals remain delegated. | LOCKED 2026-08-25 C12.35; supersedes only the C12.34 micro-question reduction note, not D-0137. | BEFORE CLEAN BUILD |
| D-0139 | How should the owner-generated UI boards supplied on 2026-08-25 be used? | OWNER_LOCKED | Official visual-direction evidence only, not literal final-screen authority. Preserve the premium deep-green/warm-ivory/orange, clean-card, human, mobile-first direction; reconcile every screen against newer product/data/privacy/action locks. | Ten unique boards persisted; duplicate image deduplicated by SHA. | BEFORE CLEAN BUILD |



## C12.36 — REAL OPEN DECISION RECONCILIATION

**Purpose:** prevent stale historical OPEN/RECOMMENDED rows from being re-asked after newer C12 owner locks. No new owner decision is invented here.

### Historical rows that are no longer real owner questions

- `D-0011` primary navigation → superseded by `D-0084`, `D-0085`, `D-0088`.
- `D-0013` team connection economics → superseded by `D-0058`, `D-0059`, `D-0076`, `D-0077`.
- `D-0018` unsupported public Trust Score → resolved by the owner rule that only server-owned public reputation/verification facts may render (`D-0069`, `D-0128`–`D-0137`); no mystery score.
- `D-0020` / `D-0036` Compound/NeedPlan scope → superseded by `D-0042`, `D-0043`.
- `D-0027` current Worker-side connection engine as target Povezivanje → target product semantics superseded by `D-0071`, `D-0073`, `D-0076`, `D-0077`, `D-0078`; current source remains a mismatch to be rebuilt/characterized.
- `D-0032` profile boundaries → product-resolved by one-account dual-role model and `D-0137`; exact code boundaries are engineering.
- `D-0039` inferred verification badges → resolved by `D-0133`–`D-0137`: fail closed unless precise server-authoritative identity verification exists.
- `D-0040` Requester price choices → cumulative product truth uses `Imam cenu` and `Tražim ponude`; legacy `FASTEST` is a transfer/retirement issue, not a fresh owner question.
- `D-0048` raw matcher percent → superseded by `D-0125` for primary CARD and the wider no-raw-score rule.
- `D-0054` Application vs Offer aggregate → cumulative target is one Application aggregate; fixed-price vs offer mode are terms inside the same flow.
- `D-0060` Dogovor screen ownership → target has one shared Dogovor workspace with local `Pregled | Poruke` (`D-0086`); duplicate-route retirement is engineering.
- `D-0087` broad visual direction → refined by owner visual evidence `D-0139`; exact typography/components are still screen-by-screen closure work.

### Not owner questions — engineering/evidence decisions

`D-0016`, `D-0017`, `D-0019`, `D-0021`, `D-0022`, `D-0024`, `D-0025`, `D-0028`, `D-0030`, `D-0031` technical return-target mechanics, `D-0033`, `D-0035` transfer mechanics, `D-0044`, `D-0045`, `D-0047`, `D-0052`, `D-0057`, `D-0068`, `D-0079` are handled by architecture/QA/privacy/legal evidence under already locked product rules; do not ask the owner to choose RPC names, hashes, file shapes or retry implementation.

### Deferred paid-enablement / external-proof items

`D-0010` later paid amounts/date, `D-0012` payment provider portion, `D-0074`, `D-0082`, plus B-0034–B-0038 stay outside free V1 owner closure until paid enablement evidence exists. Map/AI provider selection remains provider-neutral unless a later screen/runtime/cost decision genuinely requires an owner tradeoff.

### REAL OWNER-OPEN areas before clean build

1. **Moderation REVIEW operating policy (`D-0038` / B-0016):** fail closed for review-requiring Needs in V1, or operate an auditable human-review queue.
2. **Need media retention/deletion (`D-0037` / B-0017):** lifecycle after draft deletion, Need closure, moderation removal and account closure; exact UI follows that policy.
3. **Near-me/location permission persistence (`D-0050`):** transient device location for browsing versus an explicitly saved Worker matching origin.
4. **Notification inbox/read semantics (`D-0051` / B-0023):** what the user sees as one inbox item, unread badge behavior, and entity-specific deep link.
5. **Execution micro-flow (`D-0061` / B-0027):** exact optional operational actions such as `Krećem` / `Stigao sam` by task mode, without reintroducing a mandatory start-work gate.
6. **Map provider/remaining provider-level contract (`D-0108` remainder):** only if provider/cost/privacy/runtime evidence produces a real owner tradeoff; D-0118–D-0127 map/card semantics stay locked.
7. **Typography/global visual micro-system (`D-0089` / B-0040):** settle during screen-by-screen closure, using D-0139 visual direction.
8. **Final implementation strategy (`D-0009`):** final owner approval of the evidence-led HYBRID clean build is deferred until UI/UX closure and pre-build summary.

All remaining screen-level UI/UX questions are intentionally handled one screen at a time under `D-0138`; they are not evidence that the core business model is undefined.


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


## C12.37.2 — PRE-SCREEN FUNCTIONAL CLOSURE / Need media retention and deletion

### D-0141 — Need media removal is not always physical evidence destruction
**Status:** OWNER_LOCKED (2026-08-25)

1. Need photos/media remain in private Storage. Any marketplace-visible rendering is an authorized projection/signed access path; there is no public raw-media bucket.
2. Ordinary user-owned disposable media may be removed from the active Need/public projection by the Requester. When it is still only disposable Need media and is not subject to an Agreement/evidence/legal hold, the canonical reference is detached and the server may safely delete the underlying object under the approved cleanup/retention rule.
3. Once media is part of an accepted Dogovor/Agreement snapshot, a report/problem/dispute, moderation/audit evidence, or another explicitly authorized evidence/legal hold, `Ukloni` from a user-facing surface does **not** mean immediate physical destruction. The item becomes non-public/private and is retained only for the authorized evidence purpose.
4. Account deletion follows the same distinction: disposable user media should be deleted under account-closure policy, but evidence/business/legal-hold media is not automatically destroyed merely because an account is closed. Access remains least-privilege and purpose-bound.
5. USKOČI must not invent a retention duration. Exact days/months and per-purpose schedules must come from the versioned privacy/legal retention policy and required Serbian legal/privacy review before production reliance.
6. If an evidence-retention rule is not yet approved, production destructive cleanup for that evidence class remains gated rather than silently deleting proof or silently inventing indefinite retention.
7. When the applicable retention period ends and no valid legal/evidence hold remains, the server must securely delete the retained media/object and derived access grants according to the approved policy.
8. Media that changes after moderation/Need revision must be re-fingerprinted/re-moderated; historical Agreement/evidence snapshots must not be rewritten by later Need edits.
9. The final screen-by-screen UI/UX pass will distinguish user language such as `Ukloni iz Potrebe` from any stronger claim such as `Trajno obriši`, so copy never promises physical deletion when retention law/policy requires preservation.

**Owner intent:** ordinary removable Need media can be deleted, but once it is part of a real Dogovor/problem/dispute/moderation evidence chain it may be hidden from the user/public while the private proof is retained for the approved retention period.


## C12.37.3 — PRE-SCREEN FUNCTIONAL CLOSURE / near-me location persistence

### D-0142 — Device `near me` location is transient; saved work area is explicit
**Status:** OWNER_LOCKED (2026-08-25)

1. A precise device/GPS location obtained for `Poslovi blizu mene` / `Prilike blizu mene` is a **transient query input**, not a silently persisted Worker profile fact.
2. USKOČI does not continuously/background-track a Worker merely because location permission was granted or `near me` was used.
3. The transient device location may be used for the current browse/query/ranking context only after platform permission and a clear user action/context that needs it.
4. Persistent matching/notification geography is a separate **human-confirmed work preference**, for example `Novi Sad + 15 km`, selected cities/areas or equivalent target geography.
5. The app may offer `Sačuvaj oblast za rad`, but it must be an explicit action; it cannot silently convert the current GPS fix into saved matching truth.
6. A saved work area/radius is editable/removable and is owned by the Worker preference contract, not by the device-location permission state.
7. Revoking location permission stops future device-location reads but does not silently delete an explicitly saved work-area preference; the user manages that preference separately.
8. Remote/`Na daljinu` opportunities never require a fabricated GPS radius or pin.
9. Exact device coordinates are not exposed to Requesters/other Workers and are not a public-profile fact.
10. Final UI/UX closure will define the permission prompt, no-permission fallback, `Sačuvaj oblast za rad` affordance, temporary-location indicator and error/offline behavior.

**Owner intent:** current GPS is temporary for nearby discovery; lasting matcher/notification geography exists only when the Worker consciously saves a work area/radius.


## C12.37.4 — PRE-SCREEN FUNCTIONAL CLOSURE / notification inbox semantics

### D-0143 — One canonical event = one inbox item; read state is event-level
**Status:** OWNER_LOCKED (2026-08-25)

1. One canonical notification/event produces at most one USKOČI inbox item for the recipient, regardless of how many push/provider delivery attempts, retries, devices or channels are involved.
2. Push delivery attempts are transport metadata only. They never create duplicate business/inbox events and never inflate the unread badge.
3. The unread badge is the count of currently visible canonical event-level inbox items whose read state is unread. If the exact count is not authoritatively known, the UI must not fabricate it.
4. Merely opening the `Obaveštenja` list does not mark all visible items as read. A specific item becomes read when the user explicitly opens/taps it, or when a push tap successfully resolves and opens that same event's authorized current destination.
5. Provide an explicit `Označi sve kao pročitano` action; it is a separate semantic command and must be idempotent.
6. Every item has truthful type/icon, short privacy-safe title/body, canonical event time, read/unread state and an account-bound deep-link/resume target.
7. Tap/open never trusts stale payload as current business truth. It authenticates the current account, resolves recipient/role/entity, performs a bounded reread, then opens the current valid screen/state or a clear safe fallback.
8. If the original opportunity/action is no longer available (filled, cancelled, expired, revised, blocked, permission revoked, wrong role/account), the historical event may remain according to retention policy, but the UI must not present a stale actionable CTA. It shows current truth/explanation instead.
9. The same canonical event observed on multiple devices remains one event/read state. Read status synchronizes across authorized sessions/devices through server truth; duplicate/out-of-order Realtime hints do not duplicate the item.
10. Final screen-by-screen UI/UX closure will decide exact list grouping, visual unread treatment, empty/loading/error/offline states, swipe/actions and placement of `Označi sve kao pročitano`, without changing this semantic contract.

**Owner intent:** one real event is one notification; unread means unread event, not push retry count; opening the list alone does not silently clear everything; taps always revalidate current truth.


## C12.37.5 — PRE-SCREEN FUNCTIONAL CLOSURE / optional location sharing inside active Dogovor

### D-0144 — Current-location sharing is optional, consented and non-continuous in V1
**Status:** OWNER_LOCKED (2026-08-25)

1. In an **active physical Dogovor**, the Uskočer may voluntarily choose `Podeli lokaciju`; the Naručilac may also choose `Zatraži lokaciju`.
2. A Requester request is only a request. It never activates GPS or grants access by itself. The Uskočer must explicitly approve/share.
3. V1 shares a **current-location snapshot** (plus truthful age such as `podeljeno pre 2 min`), not a continuously updating route.
4. USKOČI V1 does **not** enable continuous/background GPS tracking, automatic route history, silent ETA tracking or Glovo/Wolt-style live movement merely because a Dogovor is active or HITNO.
5. Location sharing is a separate optional Dogovor tool, not a mandatory execution-state transition and not a prerequisite for `Završio sam`, completion, cancellation or problem reporting.
6. `Na daljinu` Dogovori do not show this physical-location affordance.
7. The shared snapshot is visible only to authorized participants of the active physical Dogovor, with least-privilege server/RLS checks and no public/profile exposure.
8. The UI must clearly distinguish a previously shared snapshot from live tracking; it must never imply that an old point is the Uskočer's current position.
9. Future live sharing (for example `Deli uživo 15/30/60 min`) is a separate post-V1 feature requiring explicit opt-in, visible stop control, privacy/legal/platform-permission review and runtime proof. It is **not** implicitly approved by this decision.
10. Exact optional execution progress actions (`Krećem`, `Stigao sam`, mode-specific milestones) remain the next separate owner decision; this lock resolves only location sharing.

**Owner intent:** location may be shared when useful in any active physical Dogovor, either voluntarily by the Uskočer or after a Requester request that the Uskočer explicitly accepts, without turning USKOČI into a continuous tracking system.


## C12.37.6 — PRE-SCREEN FUNCTIONAL CLOSURE / V1 execution progress simplification

### D-0145 — V1 has no dedicated execution-progress milestone state machine
**Status:** OWNER_LOCKED (2026-08-25)

1. USKOČI V1 does **not** require or generate dedicated progress-state milestones such as `Krećem`, `Stigao sam`, `Počinjem`, `Preuzeo sam` or similar mode-specific steps as canonical execution gates.
2. AI does **not** invent, choose or sequence execution milestone buttons per Potreba in V1.
3. Ordinary progress communication remains human and flexible through the active Dogovor chat. A participant may simply write `Krećem`, `Stigao sam`, `Preuzeo sam` or any other relevant update without changing a mandatory execution state machine.
4. D-0144 remains unchanged: active physical Dogovor may optionally use consented current-location snapshot sharing (`Podeli lokaciju` / `Zatraži lokaciju`), and that tool is not an execution-state transition.
5. There is no mandatory `Započni rad`, arrival confirmation or other intermediate prerequisite before the Worker can use the canonical completion action `Završio sam`.
6. Completion remains governed by the already locked completion contract: Worker `Završio sam` → Requester has 48h for `Sve je u redu` or `Postoji problem` → absent a valid problem/action, server auto-completes after the approved window.
7. Appropriate `Otkaži Dogovor` and `Prijavi problem` actions remain available according to their separate lifecycle/policy rules.
8. Existing source/server execution states such as `EN_ROUTE`, `ARRIVED`, `ACTIVE`, pickup/delivery milestone chains and current UI CTAs remain **current-system evidence**, not target V1 product requirements. They must not be transferred merely because they already exist.
9. A future release may add evidence-backed quick actions or progress events if real usage shows value, but any new canonical state/gate requires a separate product/owner contract and must not silently reintroduce rigid flows.
10. This closes the C12.37 pre-screen execution-progress owner question. Screen-by-screen UI/UX closure may decide placement/copy of chat/location/completion/problem/cancellation controls without reopening the absence of mandatory progress milestones.

**Owner intent:** keep the active Dogovor simple and universal across very different Potrebe; do not build a complex AI-generated `Krećem → Stigao → Preuzeo...` workflow unless later evidence proves it is needed.


## C12.38 — SCREEN-BY-SCREEN UI/UX CLOSURE / S01

### D-0146 — S01 background visual system is canonical
**Status:** OWNER_LOCKED (2026-08-26)

1. Use the approved forest/teal atmosphere with lighter central focus and darker perimeter.
2. Keep the subdued city silhouette in the lower zone.
3. Use restrained location pins.
4. No connecting route lines between pins.
5. No metallic/gold/3D/neon/cyberpunk reinterpretation.
6. Background is an independent layer; logo, wordmark, motto and Home content must be changeable without redrawing it.
7. This locks the background only, not the whole S01 screen or its motion/session behavior.
