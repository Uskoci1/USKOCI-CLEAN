# USKOČI — final product execution runbook

Version 1 • 2026-09-28 • Requested by the owner for continuation in another session.

**Purpose:** finish the existing product, including deep UX/UI, business flows, reliability, performance, backend integration, operational readiness and store release. This is an executable specification, not a claim that the app is ready or a guarantee of zero defects or store approval.

**Single status authority:** [redovi.json](../../control/redovi.json). [PLAN.md](PLAN.md) is its priority index; this runbook supplies detailed execution and acceptance instructions. [FINALIZATION_MATRIX.md](../../control/FINALIZATION_MATRIX.md) is generated. Do not create a second tracker or reset proven work to “not built.”

## 0. Read first and establish the actual starting point

Read in this order:

1. [AGENTS.md](../../../AGENTS.md), newest dated entries first; retain applicable stable restrictions below them.
2. [Current priority plan](PLAN.md) and this entire runbook.
3. [Branch and first-entry audit](finalization-20260927/BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md).
4. [Applied packages and outstanding conditions](finalization-20260927/APPLICATION_APPROVALS_20260927.md).
5. [Round32 receipt](finalization-20260927/ROUND_32_NATIVE_RECEIPT.json), [ANR diagnosis](finalization-20260927/ROUND_32_ANR_DIAGNOSIS.md) and [Round31 corrections](finalization-20260927/ROUND_31_NATIVE_CORRECTIONS.md).
6. [External review reconciliation](finalization-20260927/EXTERNAL_REVIEW_ALIGNMENT_20260928.md) and [screenshot index](finalization-20260927/SCREENSHOTS.md).
7. [UX blueprint](../v5-ai-first/UX_NACRT_20260922.md), relevant [handoff rules](../design-system/cloud-handoff/rules/) and [control publication procedure](../../control/README.md). Earlier visual/technical prescriptions cannot override later explicit owner decisions.

### 0.1 Known baseline — recheck before a mutation

| Item | Recorded state, not an indefinitely current assertion |
| --- | --- |
| Repository | `Uskoci1/USKOCI-CLEAN` |
| Canonical branch | `work/uskoci-ui-unification-20260924`; GitHub default `clean-alpha-backend` is older and is not the continuation branch. |
| Baseline before this document | `b8c93cfe06be9af6c9106303eb34ff365f1180e8`; fetch and use the latest canonical HEAD, not this fixed old commit. |
| Local integration checkout | `C:/Users/user/Documents/Codex/2026-09-19/supabase-app-store-ios-apple-store/work/uskoci-r6-integration`; intentionally detached at the canonical history. Do not switch/reset it blindly. A remote/cloud session may use its own verified checkout of the same branch. |
| Current application source | Runtime/config/assets/tests equivalent to `10739a440611fc32e3bd6d9ee6dd66a5479e091b`. Later documentation commits are not new APK contents. |
| Verified rollback CI | Run `36357286414`, `36c57b84`: TypeScript and 342 Jest suites / 7,213 tests passed. This is historical evidence, not permission to skip checks after new changes. |
| Installed emulator | `emulator-5556`, `rs.uskoci.dev`, run `36353185115`, SHA256 `4c476cffb61ee40f25aee99b0d522723aafd60ae2314541ed1aaa1174b528a4e`. |
| Physical phone | Last recorded source `b589994e`, without newer B3c client. ARM64 run `36353187030` / source `10739a44` is verified but not confirmed installed. Check actual USB/device state. |
| Rejected experiment | `2b2cf4d7` caused repeated Android ANR; reversed by `36c57b84`. Do not reintroduce its global animation flag or install APKs `36355439009` / `36355441615`. |
| Canonical Supabase | DEV `leqcwgzvjsxugfgzdmth`; latest recorded ledger 210, 11 active Edge functions, push v22. No separate production environment has been verified. |
| Already applied | Chat B3a/B3b/B3c, P0 exact public landing, P4 resolver/compatible transport and two push-text changes, P5 owned licenses. Read receipts; do not apply them again. |
| Still gated | Exact-message push flag last confirmed OFF; P6 incomplete/unapplied; voice messages unfinished; written rating comments require contract/proof. |
| Existing good core | A real two-account task→offer→selection→Agreement→messages→completion→two-ratings scenario exists. Preserve its scope; do not claim every alternative or today's binary was covered. |
| Control publication | GitHub generated files exist. The owner-visible Claude artifact upload still rejects with `invalid_argument`; a local generation or commit is not a successful hosted update. |
| Two privacy branches | `d18e830a` AI context minimization and `1ab01e78` processor inventory are on GitHub but not integrated/applied. **Owner explicitly deferred them to the final whole-app privacy pass before public release.** |

### 0.2 First working block

1. Confirm checkout, remote, HEAD, branch relationship, dirty/untracked paths and active ownership. Read uncommitted diffs before touching their files. Never assume an untracked proof download is source to commit.
2. Fetch origin. If clean and merely behind, fast-forward the canonical history. If diverged, inspect and merge; never rebase or force-push. Preserve another session's changes. The local detached checkout pushes explicitly with `git push origin HEAD:work/uskoci-ui-unification-20260924`.
3. State actual capabilities: repository read/write, CI dispatch/read, Supabase read/apply, native build, emulator, physical phone and store account access. Missing capabilities are not permission to fabricate evidence or request passwords.
4. Establish the runtime baseline using installed package/build/hash where device access exists. Compare DEV metadata using the authorized connector when a backend package needs fresh preconditions. Do not read secrets or private conversation content merely to take inventory.
5. Start the known FULL-return reproduction and source investigation immediately. Do not spend another whole session rewriting the entire audit.
6. Own one concrete package: affected control IDs, files, failure, hypothesis, implementation, focused checks and next native checkpoint. Independent work may be coordinated with another session only with non-overlapping file/package ownership.

## 1. Authority, scope and communication

- Speak to the owner in short plain Serbian using “ti”; app copy is Serbian. Repository engineering documents and commits are English. Use **OBJAVI ZADATAK / USKOČI I ZARADI** for the two sides; one account supports both.
- Normal UI/flow refinement is authorized. Preserve the approved actual TaskCard/Peek and brand-pin direction; do not replace them with the rejected flat mockup. Full task-card appearance only at ready-for-review is still a proposal to resolve explicitly in the AI package, not already shipped behavior.
- Existing backend package approvals remain valid within their exact scope and prerequisites. Do not re-ask approval for packages already applied. New backend scope needs a concrete candidate, proof and applicable owner authorization; this runbook is not an unconditional deployment command.
- Every new closure-certificate rebinding still requires the owner's explicit authorization for that specific change. PKG045b already has conditional approval; satisfy its compatible-app rollout/preflight rather than asking the same broad question again.
- Do not create/rotate/print keys, passwords or JWTs. The owner completes required login/signing/console steps securely. Never put account credentials into docs, logs, screenshots or CI artifacts.
- No destructive account/data/device operations; no `adb uninstall`, `pm clear`, factory reset or speculative SQL cleanup. Account-deletion testing needs a specifically approved disposable target/environment. Existing one-task provider/test-data approvals do not authorize unlimited new AI calls or DEV fixtures.
- No paid AI/provider calls, new test accounts, live purchases or new dependencies without the applicable specific approval. Existing approved packages are not a reason to upgrade them. Voice implementation must identify an actual supported recorder/player contract before requesting any missing dependency.
- Keep `supabase/migrations/` frozen; never rewrite applied migration bytes. Do not commit `20260913090000_clean_v5_fix_application_spam_and_resolution.sql`. Do not merge `repair/ru0-ru1-backend-20260902`, activate pkg023c, alter CodeQL or modify separately owned PKG051 pricing/payments.
- Never invent prices, ratings, distances, eligibility, delivered/read states, job counts, provider success or live locations. Distinguish absent values from errors and zero from unknown.
- The two deferred privacy branches remain open release requirements. Deferral applies to those two integration packages, not to weakening existing privacy boundaries or postponing a newly observed serious exposure.
- Public store submission, rollout and paid production resources require the owner's explicit final release decision after the exact candidate is reviewable. Prepare everything possible before that decision.

## 2. Operating model: finish meaningful groups

### 2.1 One loop, one current truth

For every package: **understand → reproduce → decide → implement → targeted regression → consolidated native proof → commit/push → update tracker → next package**.

Do not stop at an audit or a proposed component. If a package is blocked by an external prerequisite, leave an actionable bounded record and continue an independent authorized package. Do not repeatedly investigate an unchanged blocker or create more report files instead of fixing known code.

Keep separate evidence dimensions: **SOURCE / ON_GITHUB / DEV_APPLIED / CLIENT_WIRED / APK_BUILT / INSTALLED / DEVICE_PROVEN / PROVIDER_PROVEN / RELEASE_ACCEPTED**. These are interpretation labels linked to existing fields, not a request for a new tracking system. An applicable missing dimension remains pending; an inapplicable one has a reason.

Use defect severity separately from the owner's P0–P7 work order:

| Severity | Meaning | Action |
| --- | --- | --- |
| Blocker | Crash/ANR, unauthorized disclosure/action, lost acknowledged write, broken essential journey or unusable release artifact | Fix or withdraw the offending candidate before continuing its acceptance. |
| Major | Incorrect state, trapped navigation, duplicate command, inaccessible primary action, inconsistent map/results or unreliable recovery | Close before accepting the affected release flow. |
| Minor | Local spacing/copy/secondary visual inconsistency without functional harm | Fix in the same surface group; do not derail the core sequence for isolated polish. |

No known blocker/major may be hidden by editing the expected test value, swallowing an error, removing a guard or marking a row green. A deliberately excluded feature requires explicit product scope and no reachable misleading UI; voice cannot silently be removed from the agreed V1 scope.

### 2.2 Before changing a surface

Write six facts in its existing package/row: intention; previous action; actual data source; state/role; primary next action; failure/recovery. Then inspect the rendered presentation, controller/service and actual server contract where relevant. A route name, test count or SQL-function name is not enough.

Choose screen versus bottom sheet versus inline section versus brief confirmation by task: a durable decision deserves an addressable screen; short selection uses a sheet; status belongs with its content; destructive outcomes require an explicit consequence-aware confirmation. Do not put a second unrelated navigation stack inside every panel.

## 3. Product-wide visual and interaction system

Use the existing `src/theme/tokens.ts`, shared headers, surfaces, FactArt, TaskFace/TaskCard, AI shell and controls as the starting point. Consolidate duplicates into these primitives; do not add a parallel “premium” component tree.

| System | Required treatment |
| --- | --- |
| Typography | Inter, semantic display/title/section/card/body/metadata/action/number roles. Strong readable text, never below 12. Do not enlarge everything or make every line bold. Preserve wrapping, locale numbers and system text scaling. |
| Spacing | 4/8-based rhythm, shared page gutters, tight related facts and clear section separation. Start from existing values and measure the actual phone. Do not apply oversized web-style 80–96px section gaps to mobile screens. |
| Shape | Existing semantic radii currently share 12 for controls, 24 for cards and 28 for sheets, plus circles/capsules. Use one intentional system; not every section needs a rounded box. |
| Color | White canvas, strong USKOČI green, restrained warm orange, readable neutrals. No dominant mint wash. Selection/error/unread states must also have shape, text or accessibility semantics. |
| Hierarchy | First viewport carries the immediate decision and at most 3–4 main information groups. Home may have its two primary intentions; other surfaces have one clear primary next action. |
| Icons and art | Coherent existing action-icon style; FactArt/brand art is purposeful and separately scoped. Meaningful labels for unfamiliar actions. No mixed random emoji/icon libraries, unsolicited packages or endless decorative loops. |
| Elevation | Border for contained information; shadow/blur when explaining an overlay or depth. Avoid heavy shadows on every list row; provide a non-blur fallback. |
| Touch and accessibility | Aim for 48dp Android / 44pt iOS targets, accessible names/roles/selected state, logical focus and announcements. Keep critical actions reachable with keyboard and larger text. Verify text/non-text contrast; do not rely on pale accent colors alone. |
| Navigation | Active section stays identifiable where the bottom bar is present; do not force the bar into every full-screen flow. Back closes the topmost intended layer; successful completion lands at its useful result, not four screens back. |
| Sheets | Shared title/close/handle/safe-area/footer rules; documented snap states; scroll/drag cooperation; Android Back, keyboard, interrupted gestures and return/re-entry behavior. No trapped or invisible sheet. |
| Motion | Quick pressed/selection response, meaningful panel/map/status transitions and finite success feedback. Respect reduced motion. Heavy art cannot delay gestures or expose a wrong state while it animates. |
| Copy | Concise Serbian “ti”; explain only consequential ambiguity. “Cena nije navedena” is not a numeric price. Capacity is normally `0/2`, `1/3`, etc. Metadata is not a wall of tutorials. |

Review every component in default, pressed, selected, disabled, loading, error, success, unread and active states where applicable. Missing-image, long-title, big-price, absent-rating and screen-reader cases are normal design inputs.

Catalog27 assets must have provenance/licensing, native-size readability, still fallback, loading/reduced-motion handling and measured playback. Four accepted stills do not authorize a global Lottie replacement. AI-generated proposal images must be labelled proposals and never stored as device proof.

## 4. Execution packages and exit criteria

### P0 — publication and the native return defect

**Intent:** after publishing or returning, the user immediately sees the task/result in a stable place.

1. Reproduce the original sequence: Discovery count → FULL list → scroll → navigate to the recorded other screen/gallery → Back. Record visible body, scroll position, native opacity/translation, focus, sheet index, list data and map readiness. The prior case reported FULL in JavaScript while its native body was invisible.
2. Distinguish retained native tree, focus lifecycle, animation ownership, layout measurement, sheet gesture state and React update hypotheses. Change the smallest proven cause. No speculative global SDK flag, package upgrade or unconditional remount masking lost state.
3. Preserve viewport/scroll/selection on ordinary return; clear only state whose owner/account/filter changed. A late response from the old visit must not reset a new visit.
4. Follow AI review → explicit publish command → confirmed server result → actual published ID. Unknown write outcome enters recovery; do not repeat the mutation blindly or display success prematurely.
5. Route the actual public result to Discovery with one owned selection intent. On-site: show its public pin and current card. Remote/no public coordinate: show its proper result group/card without inventing a map point.
6. When filters exclude the just-published task, use a transparent temporary focus/result affordance rather than silently mutating unrelated filter settings. Clearing the focus returns to the user's criteria.
7. Own tasks may remain visible with clear ownership and an appropriate owner action. Never offer self-application or show stale ownership during a failed read as trustworthy.
8. Verify back/re-entry, slow lookup, not-visible/deleted task, app background, account change, duplicate tap and restored session. Keep TaskCard/Peek content/layout unchanged except an independently agreed defect fix.

**Exit:** the exact reproduction no longer loses the sheet or freezes; publish maps to the persisted task; all success/error/recovery routes remain usable; focused regression and exact-binary native evidence are linked to A07/A08/B04/B05/S02/S03. A still showing a normal FULL list alone cannot close the return defect.

### P1 — Discovery composition, map, search and filters

**Intent:** find a suitable task in the chosen area without understanding separate map/list systems.

1. Define one applied query model: viewport/bounds or explicit area, remote/on-site mode, time, urgency, price mode, relevant category, sorting and stable cursor. Draft filter edits remain local until Apply; cancel restores previous applied criteria.
2. The map and on-site list derive from the same eligible result set/version. Pan/zoom has debounce/cancellation and an explicit refresh contract; out-of-order responses cannot replace the newest area. Never label a loaded-page count as the total.
3. Remote tasks and tasks without a public map coordinate remain clearly reachable as separate groups; neither receives a synthetic pin. Specify whether each filter applies to these groups. Do not report their sum as “on this map.”
4. Compose search, quick criteria, map and sheet together. FULL joins the top search surface with a compact count. Dragging back restores usable map space; tapping a pin can select immediately using loaded data before an optional detail read.
5. Map → card and card → pin are bidirectional; do not clear selected ID during a harmless list refresh. Selection that disappears after a server update gets an explicit recoverable explanation.
6. Apply the current brand pin: white base and recognizable USKOČI mark, controlled orange glow/scale on selection. Priority: selected/newly published focus first, ownership/application state second, urgency as a distinct badge; cluster represents a group, never an individual price. Do not create six competing colors.
7. Cluster dense results and bound marker rendering. A zoomed-out 3,000-task city cannot mean 3,000 native custom views plus 3,000 downloaded detail rows. Cluster counts must match their documented exact/approximate contract.
8. Refine the current MapLibre provider style: readable streets/buildings, distinct water/green areas, restrained POIs, clear pins, licensed visible attribution. A style-load error has retry/late-success recovery, not an eternal loader or blank false success.
9. “U blizini” requests permission only on tap and centers from an ephemeral point. Do not save/send that raw GPS point. A server viewport query may disclose the viewed public area; document it honestly rather than claiming no location-derived data ever leaves the device.
10. Search expands one useful section at a time over the existing blur surface, retains completed choices compactly and presents real counts only when available. Include usable loading/error/no-match and clear/reset controls. Never invent “popular” searches to fill space.
11. Handle long text, large font, denied location, no map network, saved position, foreground return and unavailable task. Keep the useful action visible above keyboard/safe area.

**Exit:** map/list/filter truth agrees; selected task reacts within the measured budget; FULL/partial transitions and back are stable; remote/no-place groups are obvious; list and marker costs are bounded. P6 backend work remains explicitly pending until its contract is actually applied and wired.

### First-entry and identity dependency

1. Trace signup metadata, confirmation email config, callback/deep link, session transition and first useful destination. Confirm resend and expired/wrong/already-used link behavior; do not infer a mail-provider outage from an untested path.
2. Provide concise optional-first-profile guidance without forcing a separate account for each role. Collect only data required for the chosen action. Completing setup returns to the original intent.
3. Distinguish identity/display name, personal locality, matching work area and temporary Discovery viewpoint. Editable personal city needs its own explicit write/read contract; do not repurpose worker radius or store an exact home coordinate.
4. Initial camera precedence: explicit task/search/deep-link focus → remembered user viewport → approved chosen-locality fallback → honest neutral fallback. Changing personal city must not override an active map search on every render.
5. Avatar source/pick/permission/crop if supported/upload/apply/error/retry must preserve the previous photo until success. Never mark a pending upload as the saved identity.

**Exit:** signup→confirmation→return and recovery have exact-device/provider evidence where authorized; identity changes persist correctly; no location-permission prompt on launch; no hidden forced worker-profile activation.

### P2 — Home, task detail, offers, candidates and Agreements

**Home:** show the two intentions, server-backed attention, next relevant Agreements and concise task/application entry points. Do not turn it into a finance dashboard or fetch full completed history to draw a badge. Empty state invites the next real action; failed attention fetch is not “nothing waiting.”

**Task detail:** show actual photographs only when they exist, in a swipeable top gallery inside detail; preserve the owner's rule excluding task photos from list/map cards. Show title, place/time/people, truthful price model and basis, important facts, description, public location/route preview, questions and publisher. Keep the contextual primary action reachable. No duplicated badges such as “partly filled” when `1/3` communicates enough.

**Location detail:** the compact map and expanded map use the same authorized points/pin language. Public street-level allowance does not grant private house number/access notes. Granted exact locations support explicit external navigation; multiple stops preserve order. Do not draw an invented navigable road route between points.

**Offers:** price/basis, people/team and message → concise review → send → explicit sent summary. Preserve draft and recover unknown outcome without duplicate submissions. No irrelevant skill-label checklist. Missing/changed task version requires an honest refresh/reconfirmation.

**Candidates:** identity/photo, reputation if present, offer terms and message are scannable and comparable. One candidate's full detail has its own clear surface. Final selection confirms the exact accepted version/price/time/capacity, including concurrent final-slot contention. Already unavailable candidates cannot look selectable.

**Agreement:** lead with the task/context card linking to its authorized detail, the other person, accepted terms, current state and next action. Overview and messages share the same Agreement identity/history; do not require re-entering four screens to switch. Progress labels reflect actual server states, not invented milestones.

**Variants to finish:** own-task editing, close remaining search, cancellation reason, change proposal/accept/reject/withdraw, multiple people/team capacity, counterparty refusal, problem reporting, worker completion, requester confirmation/automatic completion and both ratings. Review comments require their length/visibility/report/retention contract; do not render a non-saving input.

**Exit:** both roles understand current truth and next action; routes preserve context; accepted terms cannot be overwritten by later draft edits; concurrent and terminal cases fail/recover correctly. Cover A01/A08–A16/B06–B12/D01–D13 with explicit state scenarios, not one reused happy-path screenshot.

### P3 — a complete messaging lifecycle

1. Keep existing B3a bounded pages, B3b exact-message window, displayed-message ACK and B3c invalidation ownership. Inspect the actual contract before adding polling or a second subscription owner.
2. Text send has one durable client command ID, immediate truthful pending state, confirmed server ID/order, recoverable error and unknown-outcome lookup. Repeated tap/reconnect/reopen must not create a duplicate.
3. Incoming messages merge deterministically while open. On reconnect, fetch missed data from a durable cursor/watermark; a transient realtime event is a hint, not the only history source. Subscribe/unsubscribe exactly once per authorized owner/session.
4. Paging older messages preserves scroll anchor. New incoming messages do not pull the reader away from older history; provide a concise new-message affordance. Jump-to-message loads the right window and highlights it without acknowledging unseen content.
5. Read state uses the actual visible message IDs/contract. Do not claim recipient device delivery or reading without server evidence. Keep ACK boundaries correct on keyboard, overlay, blur, background and account change.
6. Photos use private owned media, preview, upload, send, open/download as permitted, separate retry and terminal-history rules. A failed upload is not a sent message; expired links recover through authorized reads.
7. Voice is a real `VOICE` message, with record/cancel/review/play/send, duration/size/type checks, interruption handling, audio focus and cleanup. Separate recorder, local asset, upload, message command and confirmed history. Same idempotency/paging/read/recovery behavior as other types.
8. Group chat must use actual server membership/permissions and participant lifecycle; do not treat a two-person Agreement test as group proof. If the server cannot support the visible group promise, prepare a separate contract rather than fake a room.
9. Draft/outbox/history caches are account/Agreement scoped. Logout or A→B must not expose A's draft, photo or audio. Recovery of A's own pending write must retain its exact identity without sending it as B.

**Exit:** two authorized devices prove arrival, background/resume, reconnect, paging, read boundary and all shipped message types. Network interruption and unknown-outcome cases preserve state and do not duplicate. Native record/play tests are mandatory for voice; a structural AAC validator alone is insufficient.

### P4 — push, Inbox and exact navigation

1. Preserve the live compatible transport and approved neutral text. Inventory event kinds against recipient role, body policy, TTL, preferences, quiet-hours rules and click destination; do not send every task to everyone.
2. Review all active device registrations for compatible client routing before enabling exact-message payloads. One upgraded phone is not sufficient. Confirm the actual current flag immediately before an authorized change.
3. Correlate **one real message ID** through durable backend event → push attempt/provider receipt → received notification → tap → authorized event resolver → Agreement/window → displayed ACK. Record cold-start, warm app and already-open chat separately.
4. Wrong account, removed membership, expired event, deleted/hidden content, duplicate tap and unreadable target route to a safe Inbox/contextual fallback. Push payload is not authority to open private content.
5. Permission-denied, token refresh, reinstall/update, logout and multiple devices have explicit lifecycle rules. No raw tokens in evidence. Revoke only registrations authorized by the current session/contract.
6. Opportunity matching push, chat push and appointment reminders each get their own event evidence. Android success does not close iOS; test APNs/distribution configuration on an actual supported iOS build/device.

**Exit:** the same-event chain is proven, suppression/duplicate behavior is correct, exact routing is safely enabled only when preconditions permit, and platform-specific evidence is recorded. No synthetic event pointing to unrelated old messages counts as this proof.

### P5 — both AI interviews, location and real matching

**Task conversation:** keep the conversation primary, with concise warm Serbian responses and occasional restrained tone cues. Ask the smallest missing question; do not repeatedly summarize every already-known fact. Separate assistant text, structured fact changes, uncertainty and actions. No generic robot required; use the existing brand identity.

1. Build a local/offline contract corpus from safe examples covering category/subcategory, free text, slang/typos, dates/timezone/duration, price versus offers, people, equipment/tools/vehicle, urgency, remote/on-site, access constraints and multiple stops. Document expected structured facts, not exact prose.
2. Classify findings: display/composition, controller/state, server fact contract, prompt/provider behavior or actual geocoding. A UI fix is not a model-quality fix. Use existing recordings/proofs before requesting additional paid provider calls.
3. A recognized place produces one compact unconfirmed map/pin per point. One clear accept action; easy move-pin or natural-language correction. Ambiguous/not-found means ask or allow marking, not a long forced form. Corrections preserve point role/order and invalidate only affected confirmation/revision.
4. Exact location remains private under the existing contract. Review shows each authorized point; public publication projection remains coarse/street-level as approved. Pending suggestion is never silently saved as confirmed.
5. Place photos from the conversation into the draft's owned media; the final task detail gallery shows confirmed attachments. Explain/recover upload failure without losing the conversation.
6. Resolve the owner's ready-card proposal within this package: compact branded draft access while collecting, full approved-card language at authoritative reviewable state, one `Pregledaj zadatak` action, explicit review then publication. No permanent floating card covering half the conversation; no fabricated placeholder price/location.
7. Distinguish collecting, ready-for-review, reviewing, publish-pending and published/recovering. Do not expose post-publication applications during intake.

**Worker interview:** collect skills/services, actual tools/equipment/vehicle/licenses, work area/radius, availability and team capacity. Use the same review/correction clarity, including a compact work-area map. Draft completion is not profile activation. Show honest self-declared license labels; a saved profile cannot claim verified qualifications.

**Matching:** map every collected field to its actual consumer or justify/remove collection. Hard eligibility precedes ranking. Check task category/skill, equipment, vehicle/capacity, availability, radius, team capacity, blocks/account state and task-specific requirements. Unknown facts cannot silently pass hard rules. Ranking and dispatch are versioned/bounded, explainable and privacy-safe; ensure requirements entered through either UI or AI feed the same facts. Never invent a new taxonomy on every unfamiliar phrase; follow existing canonical taxonomy and reviewed promotion rules.

**Speech:** AI speech input, AI spoken output and chat voice messages are three distinct capabilities. Preserve text draft, permission/interruption/review controls and real provider outcome. Spoken AI output remains a separate product/provider decision if not already implemented.

**Exit:** both interviews retain/correct/resume facts and expose the right review action; authorized real-provider samples confirm core extraction/location behavior; matching consumes the actual persisted fields and sends bounded relevant events. Report corpus size/failures and untested categories without claiming general perfection.

### P6 — bounded backend and measured mobile performance

1. Finish P6 PAGE/EXACT_PUBLIC on the current source, then MAP/PLACES, count semantics, actual authenticated API calls and parity. Do not wire a rollback-only fixture to a production collection caller.
2. Specify filter/version/cursor contracts, deterministic sort/tie-breakers and limits. Prove insert/delete/update between pages, duplicate/omitted rows, changed filters invalidating a cursor, auth isolation and expiry/retry. Count results must say exact versus approximate and remain consistent with map groups.
3. Review geospatial bounds/radius units, coordinate order, world/empty/cross-boundary cases and public precision. Filter/index on the server; do not download thousands of full tasks to filter in the phone.
4. Capture plans and payload sizes on a disposable representative dataset for Discovery, Home attention, my tasks/applications, candidates, Agreement list, ratings and chat. Remove one-request-per-completed-Agreement patterns; cap work independently of total user history.
5. Profile the release-like app on reference hardware: startup, first usable Home, pin tap, sheet drag, navigation return, long list, image gallery, keyboard/chat, foreground/reconnect and repeated account/route changes. Emulator timings alone do not certify physical-phone performance.
6. Investigate render/subscription churn, expensive item work, unstable props, image decode size/cache, unnecessary data copies, list windowing and offscreen animation. Use the existing list/image stack first; choose a new library only from a demonstrated gap and approval.
7. Cache by account/query/version and bound cache lifetimes/size. Retire requests on changed ownership; coalesce invalidations without dropping real updates. No unbounded polling, listeners or retained audio/images.
8. Test datasets 0 / 1 / 50 / 1,000 / 3,000 and a justified larger case in disposable environments, never bulk synthetic fixtures on canonical DEV. Separate dataset volume from concurrent users, request rate and provider cost. Declare load duration/limits before running it.

Measure in an appropriate release-like build, where development overhead does not distort the result. Distinguish JavaScript and native UI stalls. [React Native performance guidance](https://reactnative.dev/docs/performance)

**Initial USKOČI engineering targets, not measured results or store rules:**

| Metric | Target / measurement boundary |
| --- | --- |
| Local pressed/selected feedback | p95 ≤100ms from input to visible response on the agreed reference phone. |
| Loaded pin → selected card | p95 ≤200ms, excluding an explicitly separate missing-data/network read; no artificial wait for unrelated server work. |
| Warm retained screen return | p95 ≤350ms to usable content; no invisible body, wrong account/selection or scroll jump. |
| First usable Home | Cold ≤3s / warm ≤1.5s on the declared reference build/device/network with a valid session; report auth/network waits separately. |
| Ordinary paged API read | Initial p95 ≤1s in the stated staging network/load, with server execution and transfer time reported separately; no claim under unspecified networks. |
| Interaction smoothness | No ANR or multi-second freeze; trace sustained scroll/sheet work against the device refresh rate. At 60Hz, investigate repeated >16.7ms frames and target <5% slow frames in the declared scenario. |
| Request growth | Page size and response bytes bounded by contract; no request count proportional to all historical Agreements merely to paint a screen. |
| Retained resources | No accumulating listeners/timers or monotonic post-idle memory increase over 20 repeat cycles; record warm baseline, peak and final RSS, not only screenshots. |

For percentile claims retain sample count (at least 30 repetitions for a basic local estimate), device/OS, build/hash, cold/warm/cache state, network condition, p50/p95/max and trace. For resource/scroll scenarios state duration. If a target is unrealistic or a measurement tool is unavailable, record why and a proposed budget adjustment; never silently replace measurement with “feels fast.”

**Exit:** bounded contracts are applied/wired where authorized; 1,000/3,000 data cases preserve correctness; regression metrics stay within declared budgets; no new freeze/leak/unbounded fetch. Scalability claims state tested volume and concurrency only.

### P7 — profile, deep menus, account and release surfaces

1. Profile groups identity, reputation, worker profile, availability, equipment/vehicle and history naturally. No invented earnings/monthly figures or giant KPI dashboard. Show only totals the server actually defines; self-declared information is not a verification badge.
2. Revisit every nested settings route: account/personal data/photo, notification preferences, blocked people, privacy/export/closure, rules/consents, help/support and role-restricted operator screens. Preserve white composition, readable separators, real toggle state, pending/error and return behavior.
3. Sign-in, signup, email confirmation, password recovery, session restore/expiry/logout and A→B→A must work without stale private caches or lost original intent. Use the owner's login participation; never accept passwords in chat.
4. Report/block entry points must be discoverable from task/public profile and relevant Agreement/content context. Report target ID/type and displayed person/task must agree. Show submission acknowledgement/status only from actual report state; prevent unauthorized moderation access.
5. Prepare an actual moderation/support operating path: recipient/owner, triage queue, response expectations, evidence access, escalation and abuse controls. A report button pointing to an unattended table does not finish safety operations. Store UGC policies require appropriate moderation/reporting/blocking arrangements. [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
6. Export lifecycle: request→eligibility/retention decision→worker→ready notification→authorized download→expiry/error/retry. Verify contents and permissions on an approved disposable subject; a downloadable JSON shell is not completeness proof.
7. Account closure: show consequences/remaining obligations, stable command/recovery identity and progress; recover on another device when supported by the explicit contract. Verify erasure/retention, session/media/report consequences through approved disposable proofs. Never delete the owner's account to satisfy a green status.
8. Legal/operator/retention inputs must match actual data handling, processors, purposes, contact and consent version. Do not write fictional company data or choose legal retention periods yourself. UI publication waits for real approved content.
9. At the final whole-app pass, narrowly port the two deferred privacy branches, refresh their proofs against current contracts and separately record exact application/readback. Do not merge entire older AI Edge files. Reconcile real provider inventory with data flows; inventory `active` is not the push kill switch.
10. Complete review-comment length/visibility/edit/report/retention rules with candidate proof before connecting a writer. Check historic/terminal Agreement visibility and deletion interactions.

**Exit:** all reachable deep menus have useful states and next steps; auth/export/recovery/safety are verified at their real boundaries; final privacy reconciliation is complete; remaining legal/business decisions are explicit release blockers, not hidden placeholders.

## 5. Safe cleanup and technical consolidation

Perform small cleanup packages after the affected behavior is understood, not a simultaneous rewrite while debugging a lifecycle defect.

| Area | Required analysis and safe action |
| --- | --- |
| Screens/routes | Classify aliases, redirected legacy routes, DEV galleries and public deep links. Follow router manifests, dynamic paths and old push links. Remove only after consumers/migration/fallback are addressed. |
| Components | Consolidate actual duplicates in typography, headers, sheets, buttons, state surfaces, cards and photo controls. Preserve semantic differences between task, offer and Agreement. |
| State/effects | Identify ownership, lifetime, cleanup, dependency correctness and idempotency. Eliminate duplicate fetch/subscription owners and stale completion callbacks without weakening recovery. |
| Data services | Document request/response/validation, authority, error envelope, retry and cursor contracts. Replace silent `any`/unchecked fallbacks on critical boundaries with actual validation; unknown is not empty. |
| SQL/RPC/Edge | Inspect call graph from app, Edge, cron, jobs, older supported clients, dynamic function references and private callers. Classify KEEP/CONNECT/REFACTOR/MIGRATE/REMOVE. Zero static app imports is not proof an RPC is dead. |
| Backend removal | Prepare a separate deprecation/compatibility and rollback plan; prove no necessary consumers. Do not drop live tables, RPCs, cron, Storage or migration history as “cleanup.” |
| Assets/dependencies | Check usage/provenance/platform format/size, remove confirmed unused assets from the bundle, retain evidence archives. No unapproved dependency substitution or lockfile churn. |
| Logging | Keep actionable event/correlation IDs and redacted error categories. Remove debug overlays/provider bodies/secrets from release. Diagnostics must not include raw private text/location/media or device tokens. |
| Tests/proofs | Retain meaningful business/ownership/recovery tests. Remove obsolete assertions only with a justified new contract, never to hide a native failure. Keep historical failed-candidate receipts. |
| Build/docs | One active integration path, one current runbook, one tracker. Keep archive evidence labelled historical and add current pointers instead of rewriting its observations. |

For each removal record what was referenced, what replaces it, which compatibility period applies and what proves safety. Make refactor/removal commits reviewable separately from behavior changes when practical. Do not clean unrelated dirty worktrees or erase local evidence without instruction.

## 6. Backend application procedure

For an approved new package, follow this sequence exactly:

1. Read live canonical definitions/ACL/RLS/ledger/certificate metadata relevant to the change using authorized access. Record timestamp and hashes; do not dump user records or secrets.
2. Describe the contract delta, consumers, backwards compatibility, privacy/retention impact and rollback. Freeze a candidate in `supabase/candidates/` and matching proof outside frozen migrations.
3. Prove it on the existing disposable CI database using the exact pushed candidate. Include real Auth/PostgREST where that boundary matters; SQL-role-only proof has narrower scope. Prove negative authorization, revisions/idempotency, concurrency/terminal states and rollback/cleanup.
4. If the closure digest changes, obtain the required specific certificate authorization before live application. Missing permission is not a reason to bypass helpers, insert fake ledger rows or weaken a preflight.
5. Confirm approval scope and fresh live predecessor/certificate/no-in-flight prerequisites immediately before apply. If hashes/authority drifted, stop that application and rebuild proof; continue independent client work.
6. Apply through the canonical recorded `dev_alpha_pkgNNN_*` procedure already used by this repository. Do not invent a new migration numbering or deployment mechanism.
7. Read back exact definitions/settings/ACL and ledger SHA256; verify the expected certificate bindings and compatible reader/writer behavior. Edge deployment must preserve `verify_jwt` unless a separately explicit authorization changes it.
8. Write the application receipt with source commit, candidate hash, proof run, live preconditions, actual result, readback and rollback limits. Refresh DEV snapshot and control state, commit and push.
9. Wire clients only to verified compatible contracts. For a staged feature keep explicit status/flag state and old-client behavior; do not call a missing RPC and display its failure as “no results.”

Read current Supabase official docs/changelog before implementing changed platform APIs. Project exact-byte/certificate/frozen-migration rules take precedence over generic skill scaffolding recipes. Do not infer deployment from a branch merge or an ACTIVE Edge label.

## 7. Acceptance without wasting implementation time

### 7.1 Verification cadence

| Change | Required checkpoint |
| --- | --- |
| Documentation/status only | Links, JSON/schema where applicable, diff review, control generation. Do not rebuild/install or rerun all application tests. |
| Small reversible UI group | Code review and one consolidated type/focused check for the completed group; capture its meaningful visual states on the next shared native checkpoint. No bespoke tests mirroring each style property. |
| State/navigation/recovery fix | Reproduce the actual failure; meaningful regression around the cause plus relevant neighboring flow; exact-device reproduction for a native defect. |
| Backend/authority/command change | Exact disposable proof plus real boundary tests where applicable; authorized apply/readback. CI is not a substitute for the application receipt. |
| Integrated candidate | TypeScript and full Jest once for the completed integrated code, then release-like build and affected native scenario set. Repeat after material changes, not after each commentary update. |
| Store release candidate | Full required checks on exact commit, signed artifact/install identity, representative real end-to-end and platform/store evidence, open-blocker review. |

Current project commands are `npx tsc --noEmit -p tsconfig.json` and `npx jest -w 3 --testTimeout=30000`; use a relevant subset during a focused package. Initialize dependencies with the lockfile when setting up an actual code workspace, not repeatedly for documentation. Preserve Windows/LF diagnostic caveats and use exact-source Linux CI for canonical evidence. A local environment problem still needs classification; do not silently treat every local failure as harmless.

### 7.2 Mandatory scenario families

| ID | Scenario | Must observe |
| --- | --- | --- |
| J01 | Returning user, new session, expired session | Correct identity/destination; no private content flash or unusable spinner. |
| J02 | Signup/email confirm/resend/recovery | Real callback and recoverable expired link; no credential handling in chat. |
| J03 | AI on-site one point → review → publish | Facts, confirmed private/public projection and correct selected public task. |
| J04 | AI remote / unlocated → publish | No fabricated pin; clearly reachable result/card. |
| J05 | Multiple stops, correction, Back, resume | Correct point roles/order/revision and authorized navigation. |
| J06 | Task photos with interrupted upload | Draft remains; retry does not duplicate; final detail gallery correct. |
| J07 | Map pan/zoom/filter/list/pin + FULL return | One result truth; no stale area, count misstatement, vanished sheet or lost position. |
| J08 | Offer → compare → select between two accounts | Accepted exact terms; correct Agreement on both sides. |
| J09 | Two selections compete for last capacity | At most allowed capacity; loser gets clear current state without a phantom Agreement. |
| J10 | Change terms accept/reject/withdraw | Current accepted terms stay coherent across both clients. |
| J11 | Cancel, close remaining search, complete, rate | Only allowed transitions; reason and terminal state persist; no duplicate rating. |
| J12 | Text/photo/voice during offline/reconnect | Stable outbox identity, true pending/failure, no loss/duplicate, authorized media. |
| J13 | Read older messages while new messages arrive | Anchor retained, new-message affordance, exact visible-read boundary. |
| J14 | Same-message push cold/warm/open-chat | Event→message correlation, correct account/window and ACK. |
| J15 | Work profile/availability/area edit → matching | Actual stored facts change real eligibility/dispatch; no false verification badge. |
| J16 | Report/block and third-account access | Correct target/authority, moderation receipt; private content not exposed. |
| J17 | Export and closure recovery | Authorized disposable subject; actual contents/progress/retention/recovery, not merely opening a dialog. |
| J18 | A→B→A / background / killed app / unknown write | Ownership-safe cache/commands and durable recovery. |
| J19 | Permissions denied/revoked, no internet, slow server | Useful fallback and retry without forced permission or silent data loss. |
| J20 | 0/1/large data, long text, missing photos, large font | Correct layout, counts, paging and measured budgets. |
| J21 | Update previous supported binary to candidate | Session/data retained; old links/flags/contracts still compatible. |
| J22 | Store-installed Android and iOS candidate | Correct release config/signing/links/permissions/push, no DEV-only routes or debug controls. |

Reuse the existing 32-step two-phone plan in `redovi.json` and link these scenario families to it; do not replace it with a disconnected checklist. Existing approved two-account fixtures can be used only within their authorized scope. Use disposable CI fixtures for large volume, negative/third-account and destructive cases unless a separate live scope is approved.

### 7.3 Device, accessibility and visual matrix

- Android emulator for rapid reproduction; actual connected Android phone for latency, keyboard, touch, permissions, microphone, camera and push. Confirm serial/account privately before a write.
- iOS simulator for layout and an actual supported iOS device for provider/push/audio/signing acceptance. Android evidence is not an iOS pass.
- Review small, ordinary and large widths (including existing 320/360/390/430dp cases where supported), safe areas, font scale 1.0/1.3 and the system's larger accessibility text, open keyboard and screen-reader focus. Avoid fixed-height cards that clip essential content.
- Capture normal/loading/empty/error/offline/success and long-content variants where they affect a screen. Static composition scenes are useful and must remain clearly inert; actual mutations require separate evidence.
- Reduced motion keeps state feedback without unnecessary travel/loops. Color-blind/contrast review retains selected/unread/error meaning independently of color.
- Keep exact source/APK/hash/route/state/device/time with screenshots. Use before/after pairs for major composition changes and a trace/video for gesture/performance claims. Inspect/redact by choosing safe data before publication; never commit account secrets or private conversations.

## 8. Production and store release gates

These are project release gates, not a promise that Apple/Google will approve the app. Refresh account-specific requirements in the actual consoles at submission time. Platform policies cited here were consulted on 2026-09-28.

### 8.1 Environment and operations before a public binary

1. Inventory app package/bundle IDs, signing owner, build profiles/channels, backend URL/project, Auth redirects, Edge versions, Storage buckets/policies, cron jobs, map/provider configuration, email sender, push credentials, legal/support URLs and feature flags. Record presence and ownership, never secret values.
2. Decide explicitly with the owner whether a separate production environment is created or an existing environment is formally promoted. Do not silently relabel canonical DEV as production or point a public binary at test-world data. Prepare a reproducible schema/config promotion from frozen source plus proven candidates without destructive history rewriting.
3. Separate test-world/reviewer access from public users; resolve current test-account scope by approved migration/configuration, not deleting real accounts. Verify services continue in the intended region/quotas/billing envelope.
4. Prepare backup/restore and a compatible rollback: versioned build, previous supported client behavior, feature flags and database compatibility. A source revert does not undo persisted data or a destructive migration.
5. Establish monitoring for crashes/ANR, startup/latency, API/Edge errors, queue/cron lag, push failures, media uploads, AI failures/cost and export/closure jobs. Use redacted diagnostics and owned response paths. Monitoring must not collect raw private messages by default.
6. Declare support/moderation/on-call owner, incident severity, rollback decision maker and status communication. Test alarms/recovery in a safe environment. Server ACTIVE and cron present alone do not prove healthy operations.

### 8.2 Store-specific readiness

| Gate | Deliverable |
| --- | --- |
| Product truth | Complete app name/description/screenshots that match the actual release binary. No advertised unfinished voice, payments, verification, tracking or unavailable regions. |
| Access for review | Owner-managed working review access or an accepted demo arrangement and clear review notes; backend reachable during review. No credentials in GitHub/chat. [Apple review guidance](https://developer.apple.com/app-store/review/guidelines/) |
| Safety | Task/profile/chat/photo/voice/report/block/moderation/contact paths work together; address abusive content rather than only adding a report button. [Apple UGC rules](https://developer.apple.com/app-store/review/guidelines/#user-generated-content) |
| Deletion | In-app account-deletion initiation is required where the app creates accounts. Google Play also requires the appropriate external web request path and disclosures; record any legitimate retention transparently. [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Google Play deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) |
| Data declarations | Match real SDK/server/provider data flows to privacy policy and store forms, including purposes/retention/deletion. Reconcile deferred processor/context changes before submission. [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) |
| Android binary | Signed release AAB, intended application ID/versionCode, compatible supported ABIs and native libraries, no debug/test endpoints. Check current target API and 16KB page-size requirements on the actual artifact, not just Expo version. [Target API policy](https://support.google.com/googleplay/android-developer/answer/16561298?hl=en), [technical quality](https://support.google.com/googleplay/android-developer/answer/17492799?hl=en) |
| Android testing eligibility | Determine the actual developer account type/date and its production-access test requirements; do not assume every account has identical thresholds. Retain internal/closed-track and pre-launch report outcomes. [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) |
| iOS binary | Bundle/team/signing/entitlements, permission descriptions, required SDK/privacy declarations, supported device/OS review, TestFlight install, deep links and actual APNs receipt/tap. Verify current submission SDK requirements rather than guessing a version. |
| Permissions | Ask in context for location, notifications, camera/photos/microphone; denied access has a functional fallback. Remove unused permission declarations and prove release behavior. |
| Commercial behavior | PKG051 owner supplies final pricing/fee/payment contract. Review the applicable store payment policy for each physical-service/digital feature before enabling paid launch; do not substitute a generic payment SDK or silently change fees. [Apple business rules](https://developer.apple.com/app-store/review/guidelines/#business) |
| Accessibility/localization | Readable Serbian, valid formatting/plurals/timezone, screen-reader actions, scalable text, reduced motion, appropriate contrast and non-color state cues. |
| Legal ownership | Real operator/contact/terms/privacy/consent versions, approved retention and service availability; obtain professional legal inputs rather than inventing them in code. |

Build/submission tooling does not itself grant production rollout or store approval; follow the actual platform submission workflow and review outcome. [Expo store submission guide](https://docs.expo.dev/deploy/submit-to-app-stores/)

### 8.3 Exact candidate and staged launch

1. Freeze a release candidate commit/tag only after the applicable P0–P7 and final privacy gates close. Verify HEAD includes all intended changes and excludes unfinished/DEV-only work; do not merge the older default branch merely to “clean branches.”
2. Run required type/full regression/backend compatibility checks on that exact commit. Produce signed artifacts with recorded hashes/build IDs and install via the intended distribution channels.
3. Execute the affected end-to-end and release/device scenarios. Review current known defects. Blocker/major failures reopen the candidate; fix → new build/hash → rerun affected proof, preserving failure history.
4. Prepare the review packet: build/commit/config identity, supported devices, scenario results, privacy/safety links, store assets, known non-blocking limitations, operational owners and rollback.
5. Ask the owner for final release authorization on that concrete packet. Authorization to code or push a branch is not permission for an unreviewed public rollout, commercial charge or paid service purchase.
6. Submit to review/test tracks as authorized, address feedback and explicitly record store approval separately from developer testing.
7. Release gradually where supported and approved. Watch crash/ANR, core-success rate, login/email, map load, message latency, push failure, queue lag, support reports and provider spend at agreed launch checkpoints.
8. Define stop criteria before rollout: a reproducible core blocker, unauthorized data access, acknowledged-write loss/duplicates, sustained unacceptable error/latency/cost or broken account recovery. Stop expansion and use the compatible rollback/flag plan; never perform an improvised destructive database rollback.
9. Close the launch milestone only after the signed store-distributed product, live configuration and actual monitoring agree. Publish a short owner-facing summary of what was released, what is deliberately unavailable and what remains operationally monitored.

Android vitals provides platform crash/ANR and related quality signals; combine those with USKOČI's own flow measurements instead of using one green build as health evidence. [Android vitals](https://developer.android.com/google/play/vitals)

## 9. Definition of done and the final evidence packet

**A flow is closed only when** the user's intended action completes, truthful server state appears, success has a useful next step, errors recover, role/account/privacy guards hold, required checks pass and applicable exact-device/provider evidence exists. Screenshots/code reachability/test-file presence alone cannot close it.

**The product is release-ready only when** all agreed V1 surfaces and variants have dispositions in the existing tracker, no release blocker/major remains, voice/matching/bounded reads/account/safety/legal requirements are satisfied, final privacy integration is reconciled, operational/store prerequisites are met, and the owner can review the exact artifacts. Any proposed scope exclusion requires an explicit product decision before the UI/store copy is changed.

The release packet must link:

- canonical commit and intended release tag; resolved branch disposition; clean source diff and preserved unrelated local files;
- exact binary/build IDs/hashes/signing identity identifiers, supported versions and installed-channel evidence;
- DEV/production configuration identity, applied ledger/candidate hashes/Edge versions/flag states and timestamps;
- type/Jest/backend proof runs, native/provider scenario results, failed attempts and repaired regressions;
- screenshot/video/trace index with privacy-safe provenance and explicit inert/live distinction;
- performance dataset/load/device budgets and measured results;
- completed safety/legal/retention/deletion/export/consent and store forms/assets;
- support/moderation/monitoring/incident/rollback owners and procedures;
- remaining owner decisions or accepted low-severity limitations, without hiding them in a percentage.

## 10. Progress, storage and continuation rules

After each meaningful package, update the affected rows and their finalization dimensions in `docs/control/redovi.json`; include concise source/DEV/device/proof distinctions. Run `node scripts/control/osvezi.mjs`, review generated changes and commit source, receipts and control output together as appropriate. Push the canonical branch; do not open a PR unless requested.

Follow the existing hosted publication procedure. While `invalid_argument` remains unexplained, keep publication pending and preserve the generated artifact; do not repeatedly retry unchanged uploads, invent a successful save or publish to a different public URL.

Use this short report, with non-applicable fields explicitly marked:

```text
PROBLEM / USER IMPACT:
CAUSE / EVIDENCE:
PRODUCT DECISION:
UX/UI DECISION:
IMPLEMENTATION / FILES:
BACKEND/RPC / APPLIED OR NOT:
CHECKS / EXACT SOURCE:
DEVICE / PROVIDER PROOF AND LIMITS:
REGRESSION / REMAINING FAILURE:
GIT COMMIT / PUSH:
CONTROL / HOSTED PUBLICATION:
STATUS:
NEXT HIGHEST-IMPACT ACTION:
OWNER INPUT, ONLY IF ACTUALLY NEEDED:
```

Do not send the owner every tentative hypothesis or ask approval for already authorized reversible choices. Report real findings and finished groups. Never claim unattended/background continuation if the session has stopped.

For a second session: read the latest runbook and tracker, declare the exact package/files it owns and available tools, then work without conflicting writes. Repository access is not native-device access. When a tool/device/approval is missing, prepare the concrete work and evidence request, continue independent authorized work and report the gap plainly.

## 11. Immediate next package — no ambiguity

**First:** fix the original FULL-list navigation-return defect on the current source and retain viewport/scroll/selection, without the rejected flag experiment. **Then:** close publication→selected actual task and Discovery map/list/filter continuity. Defer the two privacy branches to the final whole-app pass as instructed. Do not start with a new app shell, blanket redesign of TaskCard, SDK upgrade or another all-project audit.

The appendices below are coverage and operating references. Their existence is not evidence that each item passed.


## Appendix A. Coverage contract for all 62 existing control rows

This is a coverage map, not a new status matrix. The Serbian titles/routes are the existing product labels. Current pass/fail and evidence remain in `redovi.json`. Each row also receives the shared role/loading/empty/error/offline/recovery/accessibility checks when applicable.

| ID | Existing surface | Route anchors | Required closing focus |
| --- | --- | --- | --- |
| A01 | Početna: dve glavne radnje i šta čeka mene | `/` | Bounded attention and next Agreement; no completed-history fan-out for badges. |
| A02 | Razgovor sa AI: kaži šta treba | `/nova` | Fact corrections, ready review, compact points/photos and honest provider recovery. |
| A03 | Glas u razgovoru | `/nova` | Permission, preserved typed draft, interrupted speech and authorized provider outcome. |
| A04 | Mesto zadatka (tačka na mapi, adresa privatna) | `/mesto-zadatka` | Proposal versus confirmed point, private precision and recoverable correction. |
| A05 | Fotografije zadatka | `/fotografije-zadatka` | Owned upload, retry without duplication, detail-only gallery and inaccessible media. |
| A06 | Pregled pre objave | `/pregled-zadatka` | All material facts/points/photos visible; stale revision prevents mistaken publication. |
| A07 | Objava zadatka | `/pregled-zadatka` | Idempotent publish, unknown outcome recovery and exact resulting task selection. |
| A08 | Moj zadatak (detalj) | `/potrebe/[id]/pregled` | Owner-specific actions, true capacity/price and authorized location/detail links. |
| A09 | Moji zadaci (lista) | `/potrebe` | Bounded paging, own-task states, retained criteria/scroll and reliable counts. |
| A10 | Pitanja o mom zadatku (odgovori) | `/pitanja-zadatka` | Correct task/question authority, response status and interrupted-send recovery. |
| A11 | Prijave i poređenje | `/potrebe/[id]/kandidati` | Comparable current terms, real reputation, candidate revisions and availability. |
| A12 | Izbor prijave → nastaje Dogovor | `/potrebe/[id]/kandidati` | Atomic selection, accepted version and concurrent capacity conflict handling. |
| A13 | Izmena objavljenog zadatka | `/potrebe/[id]/pregled`, `/pregled-zadatka` | Published revision changes propagate without overwriting accepted Agreement terms. |
| A14 | Otkaži zadatak · obriši nacrt | `/potrebe/[id]/pregled` | Explain cancellation/draft disposal, verify ownership and preserve guarded recovery. |
| A15 | Zatvori preostalu potragu | `/potrebe/[id]/pregled` | Close only remaining search; active accepted Agreements retain their contract. |
| A16 | Uključi HITNO za svoj zadatak | `/potrebe/[id]/pregled` | Preview actual urgent conditions/fee and activation result; coordinate PKG051 owner. |
| B00 | Radni profil kroz razgovor sa AI | `/profil/razgovor` | Worker interview corrections, map/radius review and explicit activation boundary. |
| B01 | Radni profil ručno i kapacitet tima | `/profil/radnik` | Tools/vehicle/team/licenses persist; self-declared qualifications remain honestly labelled. |
| B02 | Područje rada | `/profil/lokacija` | Separate matching area from personal city/GPS; durable confirmed save and retry. |
| B03 | Dostupnost | `/profil/dostupnost` | Versioned availability, immediate-save semantics and actual matching consumption. |
| B04 | Mapa i lista prilika | `/zadaci`, `/mapa`, `/prilike` | Shared query/map/list truth, FULL return, clusters and remote/unlocated reachability. |
| B05 | Pretraga i filteri | `/zadaci`, `/prilike` | Draft/apply/cancel semantics, current counts, stale requests and readable filter sections. |
| B06 | Detalj prilike | `/prilike/[id]` | Decision facts, detail photo gallery, public location and contextual primary action. |
| B07 | Postavi pitanje pre ponude | `/prilike/[id]` | Question lifecycle, ownership, limits and clear pending/sent/error behavior. |
| B08 | Javni profil i ugled | `/prilike/[id]` | Real public identity/reputation and accessible report/block context; no private fields. |
| B09 | Pošalji ponudu | `/prilike/[id]/prijava` | Offer review, exact terms, eligibility and duplicate/unknown-send recovery. |
| B10 | Moje prijave | `/moje-prijave` | Relevant attention first without losing paging semantics; deep links and stale states. |
| B11 | Izmeni ili povuci ponudu | `/moje-prijave`, `/prilike/[id]/prijava` | Version-aware change/withdraw; accepted/terminal boundaries and explicit consequence. |
| B12 | Raspored (kalendar posla) | `/raspored` | Actual accepted schedule, overlap/timezone rules and bounded history/ratings reads. |
| D01 | Lista Dogovora | `/dogovori` | Active/attention/history grouping, stable accepted-term sorting and pagination. |
| D02 | Dogovor: pregled, uslovi, sledeći korak | `/dogovor/[id]` | Task/person/accepted terms/next action; coherent overview/chat navigation. |
| D03 | Poruke | `/dogovor/[id]` | Text lifecycle, realtime hints, reconnect, older pages and exact displayed ACK. |
| D04 | Slike u porukama | `/dogovor/[id]` | Private photo lifecycle, expired-link recovery, upload/send separation and terminal access. |
| D05 | Grupni razgovor (više ljudi) | `/dogovor/[id]/grupa` | Actual group membership contract, member changes, paging and unauthorized access rejection. |
| D06 | Izmene Dogovora (predlog, prihvati, odbij, povuci) | `/dogovor/[id]/izmene` | Propose/accept/reject/withdraw exact versions; preserve current accepted terms. |
| D07 | Otkaži Dogovor uz razlog | `/dogovor/[id]/izmene` | Reason, allowed role/state, irreversible consequence and unknown-outcome recovery. |
| D08 | Kontakt i tačna adresa zadatka u Dogovoru | `/dogovor/[id]` | Granted exact places/contact, point order and external navigation without public leakage. |
| D09 | Prijavi problem u Dogovoru | `/dogovor/[id]` | Correct Agreement/problem identity, evidence scope, submission and moderation response. |
| D10 | Završio sam (strana koja radi) | `/dogovor/[id]` | One durable worker-complete command; pending versus confirmed state on both clients. |
| D11 | Potvrdi završetak (i automatsko završavanje) | `/dogovor/[id]` | Requester and automatic completion timing; duplicates/concurrency and accurate final state. |
| D12 | Ocena | `/oceni-dogovor` | Both eligible ratings, duplicate prevention and separate written-comment contract. |
| D13 | Koraci napretka Dogovora | `/dogovor/[id]` | Progress reflects actual server state, current responsibility and next permitted action. |
| P01 | Obaveštenja u aplikaciji (zvonce) | `/obavestenja` | Exact event navigation, unread semantics, pagination and expired/wrong-account fallback. |
| P02 | Podešavanja obaveštenja | `/profil/obavestenja` | Preference truth, optimistic rollback if used, OS denial/settings-return and retry. |
| P03 | Registracija telefona za obaveštenja | `/profil/obavestenja` | Session-owned registration/token lifecycle, compatible versions and no token logging. |
| P04 | Slanje obaveštenja na telefon | Cross-surface / server event | Same-event provider delivery/tap/window/read; suppression and platform-specific proof. |
| P05 | Podsetnik pred termin | Cross-surface / server event | Accepted-time/version reminder, timezone, deduplication and cancellation suppression. |
| N01 | Prijava | `/auth` | Valid/invalid/expired auth and original-intent return without stale private content. |
| N02 | Registracija i potvrda emaila | `/auth` | Signup confirmation, callback/resend/expired link and first-use completion. |
| N03 | Oporavak lozinke | `/auth`, `/oporavak` | Authorized password recovery, deep-link expiry and return without credentials in evidence. |
| N04 | Pravna dokumenta i saglasnost | `/profil/pravna` | Real approved operator documents, versioned consent and resilient legal links. |
| N05 | Moji podaci i slika profila | `/profil/podaci`, `/profil/fotografija` | Identity/photo persistence, old-photo preservation and editable personal locality contract. |
| N06 | Blokiranje osobe | `/bezbednost`, `/profil/blokirani` | Correct target, block/unblock consequences, disclosure boundaries and matching effects. |
| N07 | Prijava osobe ili sadržaja | `/bezbednost` | Task/person/content report entries, correct target and actual status/support handling. |
| N08 | Podrška | `/podrska`, `/podrska/novi`, `/podrska/[id]`, `/podrska/operator` | Submit/list/detail/reply support and role-restricted operator view with real ownership. |
| N09 | Izvoz mojih podataka | `/profil/izvoz` | Request/worker/ready/download/expiry, completeness and private authority on approved data. |
| N10 | Brisanje naloga | `/profil/privatnost` | Preview/start/progress/cross-device recovery and approved disposable erasure proof. |
| N11 | Privatnost i čuvanje podataka | `/profil/privatnost` | Final processor/context branches, actual retention map and truthful privacy presentation. |
| S01 | Vraćanje prijave pri pokretanju | `/` | Cold/warm session restore and expiry with useful loading/error/next destination. |
| S02 | Dva naloga na jednom telefonu (A→B→A) | `/auth` | A-to-B-to-A cache/subscription/draft/outbox isolation, including delayed responses. |
| S03 | Pozadina, bez mreže, dupli dodir | Cross-surface / server event | Offline, foreground, double tap, timeout, process death and unknown-write reconciliation. |
| S04 | Stare serverske verzije (čišćenje) | Cross-surface / server event | Usage graph and compatibility/deprecation evidence before any legacy removal. |

## Appendix B. Deep surface inventory — not just route files

The current scan found 64 `src/app/**/*.tsx` files; that includes layout, aliases and DEV surfaces and is **not** a certified count of user screens. Re-enumerate the current tree before the final coverage pass.

For every route/control row, enumerate its reachable presentations, tabs, menu items, sheets, modals, dropdowns, calendar/photo viewers, confirmation dialogs, permission prompts and push/deep-link entries. Record the exact route/component, entry action, user role, data source, next/back result and state set under that row's package evidence. Every reachable element gets a disposition; an omitted deep menu is not covered by its parent's screenshot.

Inspect at minimum:

- Home header/profile/bell, both role actions, attention item types and task/application/Agreement links.
- Discovery search collapsed/expanded sections, quick filters, full filters, date selection, sort, result groups, selected pin/card, cluster, partial/FULL sheet, error retry and location denial.
- Task title/photo gallery/fullscreen viewer, metadata, facts, descriptions, map/expanded map, question entry, publisher profile, report/block, offer sheet/review/success and owner action menu.
- Candidate list/detail/comparison, selection confirmation, changed/offline/unavailable candidate and resulting Agreement.
- Agreement overview/chat switching, task/person links, accepted terms, change/cancel/problem sheets, private location, composer/photo/audio controls, old-message jump/read and completion/rating states.
- Both AI introductions, every fact correction, point proposal/ambiguity/manual selection, keyboard/voice states, draft summary, review and save/publish/activate recovery.
- Profile and every personal/photo/worker/area/availability/notification/privacy/legal/support submenu; external browser/settings/app return.
- Auth/signup/recovery screens, confirmation deep links, sign-out and session-expiry overlays; denied permissions and interrupted operations.
- DEV galleries/debug routes: prove excluded or inaccessible in the intended public release while retaining source/evidence needed for development.

## Appendix C. Per-package evidence record

Use this structure inside existing package records; do not create a new reporting framework:

```text
Package and control IDs:
Owner/session and exclusive files:
Baseline source / target source:
User intention / role / preceding action / next action:
Observed failure (or missing capability) and reproduction:
Contract / RPC / event / media authority:
Implementation and design decision, including rejected alternatives:
Before/after captures (inert or live):
Focused regression and integrated CI run:
Backend candidate / proof / approval / live receipt, or N/A:
APK build / source / hash / installed identity, or pending:
Device/provider scenario and actual observed result:
Measured performance and boundaries, or not measured:
Compatibility / rollback / remaining risks:
Tracker update / generated state / hosted publication outcome:
Commit / remote branch verification:
Next action and only genuinely required owner input:
```

Evidence should be enough to reproduce the conclusion without storing private payloads. An artifact label or a test name is not its result. A broad old approval does not replace a new protected certificate approval; a source review does not replace the original native failure reproduction.

## Appendix D. Decision queue and closeout discipline

Engineering owns routine composition, source integration, performance diagnosis, error recovery and existing-contract wiring. Do not send those back as vague owner decisions.

Owner inputs only when needed: actual operator/legal/retention text, store/business account ownership and secure console participation, separately owned commercial rules, explicitly bounded paid-provider testing, new dependency justification, protected certificate movement and the final release packet. Present each as a concrete reviewed choice with impact. A missing phone pauses phone-dependent proof, not all independent source work.

When handing off, include current HEAD/remote state, dirty files and ownership, exact last installed builds, latest actual DEV read/application, completed package, known reproductions, one next implementation task, outstanding specific approvals and evidence paths. No “everything synced” claim unless each source/Git/DEV/binary dimension is individually verified. Stop neither at a beautiful prototype nor at green static tests; finish the actual user result.
