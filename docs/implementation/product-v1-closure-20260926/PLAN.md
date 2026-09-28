# USKOČI V1 closure plan

Updated **2026-09-28**. Status: **ACTIVE FINALIZATION / WORKING CORE / RELEASE NOT ACCEPTED**.
Canonical repository: `Uskoci1/USKOCI-CLEAN`, branch `work/uskoci-ui-unification-20260924`.
Documentation baseline: `4276bca4`. Current runtime remains equivalent to `10739a440611fc32e3bd6d9ee6dd66a5479e091b` after the Round32 rollback.

Detailed implementation, UI/UX, cleanup, performance, all-62-row coverage and store-release gates are in the [Final product execution runbook](FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md). Read it before continuing work in another session. It elaborates this plan without changing current acceptance status or the owner-deferred privacy sequence.

This is the execution plan, not a second status tracker. [redovi.json](../../control/redovi.json) remains the sole living inventory; [FINALIZATION_MATRIX.md](../../control/FINALIZATION_MATRIX.md) is generated from it. The matrix keeps **FLOW | UX | UI | BACKEND | STATE SYNC | PERFORMANCE | TEST | DEVICE PROOF | STATUS** separate.

Latest P5 client checkpoint: [Round39](finalization-20260927/ROUND_39_P5_WORK_AREA_AND_WORKER_REVIEW.md), tested source `1b11e046643c0f50cfa8eede360d03c0752eaab7`. Older runtime/installation references below are dated baselines, not this package's device acceptance.

## Start here: current evidence and boundaries

- Read [AGENTS.md](../../../AGENTS.md), the [branch/first-entry audit](finalization-20260927/BRANCH_AND_FIRST_ENTRY_AUDIT_20260928.md), [application outcomes](finalization-20260927/APPLICATION_APPROVALS_20260927.md), and [Round32 native receipt](finalization-20260927/ROUND_32_NATIVE_RECEIPT.json).
- The named Claude worktree is clean and its `be03fcc4` HEAD is included in the canonical branch. This is not an assertion that every historical folder on disk was audited. Two independent Sep27 privacy branches are on GitHub but **not integrated or applied**. The default GitHub branch still points to older code; always use the canonical branch link.
- B3a/B3b/B3c, P0 public landing, P4 resolver/transport, P5 owned licenses and the two push-copy changes have application receipts. Latest recorded live check on Sep28: DEV ledger **210**, push Edge **v22**. There is one canonical DEV project; no separately verified production environment.
- Candidate `2b2cf4d7` caused repeated Android ANR and was reversed. Runtime `10739a44` is restored on emulator-5556; the original **FULL list disappears after navigation-return** defect remains open. Passing automated tests did not make that candidate acceptable.
- The latest phone APK is verified as an artifact but not installed; the physical phone was absent from ADB at the latest check. The hosted Claude table still rejects upload with `invalid_argument`; generated/committed files do not mean hosted publication succeeded.
- [Screenshot index](finalization-20260927/SCREENSHOTS.md) separates fresh inert scenes, historical native evidence and rejected candidates. Screenshots are appearance evidence, not proof of live AI, delivery, performance or end-to-end completion.

## Execution order and completion conditions

The owner's P0–P7 order remains. Owner update 2026-09-28: defer the two named privacy branches to the final whole-app privacy pass before public release; do not integrate or apply them during P0/P1. First-entry identity/location work remains a dependency for a coherent map experience. Each row below is a workstream within the existing tracker.

| Priority / surface | Current gap and concrete next work | Completion evidence required |
| --- | --- | --- |
| **P0: publish → visible result** | Public exact-task lookup is applied/wired. Finish explicit success → selected task on map/list, including remote/unlocated results. Repair original FULL navigation-return without the rejected global animation flag. | Publish result is the actual persisted task; correct pin/card or remote destination; back/re-entry retains state; same native reproduction no longer loses the sheet or produces ANR. |
| **P1: map + search + filters + list** | One result source for bounds/filter/pin/card. Full sheet reaches the search surface; preserve viewport/scroll/selection. Make unlocated and remote tasks discoverable without false pins. Investigate pin-opening delay and large result sets. | Pin→card and card→pin agree; pan/zoom/filter updates agree; zero/error/offline/retry states; bounded fetching and measured interaction on an exact build. Preserve approved TaskCard/Peek. |
| **First-entry dependency** | Verify email confirmation and app return, resend/recovery, first useful profile setup. Separate editable personal city, worker service area and ephemeral GPS. Personal-city editing needs an explicit server contract. | Actual mail→confirm→return proof; no credentials in evidence. Initial map precedence: explicit task/search → saved viewport → permitted city fallback. Never derive an exact home address or silently request GPS. |
| **P2: Home / tasks / applications / agreements** | Make the next action visible and links reversible without repeated Back presses. Agreement starts with task/context, accepted terms and person; overview/messages belong together. Check own tasks, multiple people, competing offers, changes, cancellation and rating boundaries. | Both roles reach correct authorized state; capacity shown succinctly (e.g. 1/3); accepted terms remain server truth; completion/cancellation/recovery variants have scoped evidence. |
| **P3: messages** | B3 reads/refresh are wired; reconnect and read synchronization need device acceptance. Finish voice as a real message type with recorder/player/media ownership, retry and recovery; not merely an audio validator. | Two-account text/photo/voice lifecycle: pending→confirmed or recoverable failure, no duplicate sends, older-page/read boundaries, reconnect and membership authorization. |
| **P4: push** | Android arrival exists as earlier scoped proof. Exact-message payload routing was last verified OFF. Check compatible active registrations before activation; keep fallback intact. | The **same real message**→event→push→warm/cold tap→correct authorized conversation/message→read acknowledgement. Permission-denied/sign-out/wrong-account cases; iOS proved separately. |
| **P5: both AI conversations + matching** | Improve task and worker interviews together: concise questions, visible corrections, compact per-point maps/routes, photos and explicit review. Full task card only when ready is the owner's **proposal, not implemented**; retain access to draft edits. Worker review/activation must be as discoverable as task review. | Structured category/time/people/tools/vehicle/price/location facts survive correction, resume and review; real matching consumes profile/need criteria. Provider-quality, voice input and activation proofs are separately scoped and authorized. |
| **P6: scale and performance** | PAGE/EXACT_PUBLIC SQL-role proof exists; MAP/PLACES, Auth/PostgREST, app integration and cost evidence are incomplete. Bound Home, applications, agreements/history, ratings and chat as well as Discovery. | Server filters/pagination/authorization, query plans/indexes, bounded payload and request count, cancellation/cache/subscription behavior and device responsiveness. A 1,000-card render alone is not backend capacity proof. |
| **P7: deep surfaces + release** | Profile/photo, notifications, account, safety/report/block, support, privacy, export/deletion recovery, legal content, review-comment contract and store surfaces. Payments stay with their assigned owner. | Every reachable secondary surface has intentional states and a valid next action; actual export/recovery is proved safely; operator/legal/retention requirements, Android/iOS builds, permissions, links and store evidence are complete. |
| **Final whole-app privacy pass (owner deferred)** | At the final whole-app privacy pass, narrowly port `d18e830a` AI context minimization and `1ab01e78` processor-inventory truth to current source. Do not replace complete older Edge files and lose newer dialogue/schedule/price guards. | Review exact diff; fresh disposable proof on current source; separately record applicable DEV/Edge application, hash and readback. Old branch CI alone is insufficient. |

## Apply the same product review to every surface

For every screen, tab, nested route, sheet, modal and notification, record the user's intention, previous action, server-backed facts and next action. Check default/loading/empty/error/offline/success, interrupted writes, focus/account changes and permission refusal. Decide **KEEP / CONNECT / REFACTOR / MIGRATE / REMOVE** from use and evidence, not simply from the existence of an RPC.

Use a white base, strong readable type (minimum 12), saturated USKOČI green, restrained orange and consistent icon/spacing/radius/state rules. Preserve the approved task card. Reduce unnecessary boxes and explanation; give task, offer and agreement their own hierarchy. Motion must explain state changes, remain responsive and respect reduced motion. Provider attribution stays readable; it is not optional visual clutter.

For each implemented group: **understand → reproduce → decide → implement → focused regression checks → consolidate native verification → commit/push → next**. Do not build/install after every tiny visual change. Broaden tests when the change or a failure warrants it. A new source change invalidates acceptance only for the affected behavior; preserve older evidence with its exact scope and build.

## Saving, screenshots and reporting

- Save finished source/docs to the canonical branch. Keep **local / GitHub / DEV applied / app wired / installed / proved** distinct; source push never implies database or Edge deployment.
- Capture unedited before/after screenshots for meaningful screen/flow changes and representative states. Record route/state, device, capture time, app source SHA, APK run and installed hash. Inspect for private content before committing. Use inert scenes for safe composition capture and label them as such.
- Record failures as failures, with the reproduction and recovery; never use a rejected build screenshot as the accepted result. For motion/performance use a trace/video/measurement when needed, not only a still.
- After each concrete group, update `redovi.json`, run `node scripts/control/osvezi.mjs`, commit the generated views and attempt the established publication path only when the blocking condition can be resolved. Keep the hosted failure explicit.
- Report problem, cause, product/UX decision, files, backend/RPC impact, checks, device scope, regression, commit, status and next priority. Documentation-only work does not turn a product row green.

## Decisions versus unfinished engineering

Most remaining work is engineering, not waiting for another broad approval. Already approved/applied packages need no repeat request. PKG045b has conditional approval; satisfy its compatible-app preconditions. Unfinished P6, voice and written rating comments are not ready-to-deploy packages. Operator/legal/retention inputs, necessary device/account participation, new dependencies, protected certificate changes and any additional paid/provider testing retain their specific boundaries.

**Immediate next implementation:** reproduce and repair the original FULL-return defect on the current source, then close publication/map/list continuity before expanding to the next priority. The two privacy branches are deliberately deferred to the final whole-app pass by the owner, not lost, completed or silently applied.

## Historical scope and baseline — 2026-09-26

The dated baseline and package sequence below retain the original product scope, not current deployment or acceptance status. Follow the current references above when deciding what is implemented, applied, installed or still unproved.

## Recorded product baseline

The marketplace core exists and has a real two-account journey: Need → Response → selection → Agreement → messages → completion → ratings. Android push has now been observed on the owner's physical phone after explicit permission and session-bound device registration. A one-shot proof created exactly one PUSH attempt, Expo returned a ticket, the notification arrived, tapping it opened Inbox, and a pre-existing real MESSAGE_RECEIVED Inbox event correctly opened an Agreement that contains real messages. The synthetic proof event itself deliberately did not contain a real message, so it is **not** evidence that one same real chat message travelled end-to-end through push.

Keep the live push transport canonical. Do not reintroduce blanket enable windows or old backlog cleanup.

## Package order

1. **Notifications 2.0 — matrix + safe formatter**
2. **Chat 2.0 — text, private photos and mandatory voice messages**
3. **AI Taxonomy V1 — canonical categories, subcategories, skills/tags, confidence and candidate expansion**
4. **Matching / Dispatch V1 — hard eligibility first, ranking second**
5. **Growth projections — Discovery, Home, Applications/Candidates, Chat, Agreements/Reviews**
6. **Known client/server closure — R20 return performance, refusal/device acceptance, safety target, avatar/media recovery**
7. **Account/legal/release — export, deletion recovery, retention/legal publication, production Android/iOS/store proof**

Packages remain independent. No visual package may silently redefine server truth.

---

# 1. Notifications 2.0

## Goal

Every durable event has one reviewed presentation contract:

- system push title/body;
- optional safe metadata;
- in-app art/accent;
- priority/sound policy;
- privacy policy;
- click destination;
- role context.

The system notification must remain useful even when metadata is unavailable. Missing distance/price is omission, never an invented value.

## A1 — existing facts only

Implement the matrix in `NOTIFICATION_MATRIX.md` first. The push worker may use **only server-curated copy**. It must not receive chat text, private address, contact data, report text or arbitrary user-authored payload.

Current transport's generic body is the safe fallback until the curated contract is proven.

## A2 — opportunity metadata

Only after a server facts projection exists:

- rounded/approved distance, never a private coordinate;
- public locality when distance is unavailable;
- `FIXED` price → “Ponuđeno: X RSD”;
- `OFFERS` → “Traže se ponude”;
- remote → “Može na daljinu”.

Distance is computed from an allowed worker location/radius fact and an allowed approximate/public Need location. It is not computed from a private Agreement address.

## A3 — tap behavior

Push carries a minimal event reference, not a trusted route label. The app re-checks current account and resolves the event server-side. Warm/cold tap must lead to the same authorized destination. Inbox remains the safe fallback.

---

# 2. Chat 2.0 — voice is V1 mandatory

Voice messages are not a later nice-to-have. They are part of V1 Agreement chat.

## Message kinds

The read projection must expose one stable union:

- `TEXT`
- `PHOTO`
- `VOICE`

Do not make clients infer kind from empty body or file extension.

## Voice write contract

Preferred additive model:

- existing `agreement_messages` remains the durable message identity/order/read boundary;
- a private voice attachment record binds exactly one message to one owned media asset;
- duration, byte size, MIME/container and optional bounded waveform summary are server-validated metadata;
- the voice asset is private and authorized by Agreement membership;
- the send RPC atomically settles media ownership + message + counterpart MESSAGE_RECEIVED event;
- retry uses one durable client message id and must not duplicate the message or asset.

No push payload contains audio, transcript or message text.

## Recording UX

Hold/press to record, elapsed time/waveform, cancel, review/play, send. The UI must distinguish:

- recording;
- local upload;
- message command pending;
- confirmed sent;
- unknown outcome/recovery.

A failed upload never renders as sent. Leaving/reopening chat must recover a pending command without creating a second voice message.

## Read/paging

Chat 2.0 also closes:

- latest page + older cursor pages;
- arrivals while open;
- exact displayed-message acknowledgement boundary;
- no “read” acknowledgement for content not actually displayed;
- offline/replay/duplicate protection;
- long-history performance.

---

# 3. AI Taxonomy V1

## Principle

AI classifies a Need; it does **not** freely mutate canonical taxonomy on every unfamiliar sentence.

A canonical hierarchy is stable:

`top category → subcategory → skills/tags → structured attributes`

Example:

`Kuća i majstori → Nameštaj → Montaža nameštaja`

with skills/attributes such as `bušilica`, `2 osobe`, `ormar`, `unutra`.

Another:

`Prevoz i dostava → Selidbe → Prenos većih predmeta`

with `kombi`, `nosivost`, `sprat`, `2 osobe`.

## Stored assignment

Every published Need should have versioned structured facts including:

- taxonomy node id;
- optional subcategory;
- skills/tags;
- remote/on-site;
- people/team requirement;
- tool requirements;
- vehicle/capacity requirements;
- time model and start/end/deadline/timezone;
- price model and price where applicable;
- urgency;
- classifier/model version;
- confidence;
- facts version.

The original user text stays separate from these structured facts.

## Unknown taxonomy

If confidence is high and an existing node fits, assign it.

If confidence is low or no node fits:

1. publish may continue under the nearest safe parent / unclassified bucket;
2. write a `taxonomy_candidate`;
3. group repeated candidates using normalized label + semantic similarity;
4. accumulate examples and frequency;
5. propose a canonical node only after evidence shows a real repeated market concept.

No single odd Need automatically creates a top-level category.

## Promotion rule

A candidate can become canonical only when:

- enough independent Needs support it;
- it is not an alias of an existing node;
- proposed parent is valid;
- representative examples are retained for review;
- migration/alias behavior for old assignments is defined.

Initial V1 promotion should be explicit/approved. Automatic promotion can come later with stronger evidence.

---

# 4. Matching / Dispatch V1

Matching has two stages.

## Stage 1 — hard eligibility

A worker is excluded before ranking when a required fact fails:

- service/category/skill compatibility;
- on-site radius / allowed geography;
- availability/calendar;
- required team capacity;
- required tool;
- vehicle/capacity requirement;
- safety/block/account state;
- any explicit task eligibility rule.

Do not use a low ranking score to hide a hard failure.

## Stage 2 — ranking

Among eligible workers, rank with versioned explainable inputs, for example:

- category/subcategory/skill similarity;
- distance bucket;
- availability fit;
- equipment/vehicle fit;
- team fit;
- reputation/history where allowed;
- recent response behavior;
- urgency fit.

Store the ranking policy/version used for each dispatch wave.

## Dispatch

Do not push every task to every worker. A wave is bounded:

`eligible pool → ranked candidates → bounded audience → preference/quiet-hours suppression → push`.

The server records why someone was excluded or suppressed without exposing another person's private facts.

---

# 5. Growth projections

These are required before scale; UI virtualization alone does not solve SQL/network growth.

## Discovery

A paged/count projection with one filter truth for map and list:

- visible area / locality;
- remote vs on-site;
- category/taxonomy;
- time/deadline;
- price model;
- stable cursor;
- count/approx-count contract;
- public approximate location only.

Prove 0 / 1 / 1,000+ row behavior and query cost.

## Home

One bounded projection should provide the next actionable work and attention counts. Completed-history/review reads must not delay active Agreement state.

## Applications / Candidates

Paged projections preserving:

- task revision;
- response version/hash;
- execution mode;
- end/deadline/timezone;
- price basis / offer;
- slots/team;
- selectable vs historical state;
- concurrent final-slot behavior.

## Chat

Paged message projection described above, including message kind and exact read boundary.

## Agreements / Reviews

Bounded active Agreement/next-action data and review aggregates. Do not scan arbitrarily long completed history on the client.

---

# 6. Known closure after the new engines

- finish R20 retained native list geometry without breaking interrupted-return/account/data/layout remount fallbacks;
- exact phone acceptance for refusal/profile-return/storage recovery;
- multiline composer and post-selection Back;
- safety target verified name/context;
- avatar/media interrupted recovery;
- on-site/private address, team/competing offers, changed terms, cancellation/problem;
- offline/replay and third-account isolation.

---

# 7. Account / legal / release

Before public launch:

- confirmation-email delivery proof;
- legal/operator documents and consent publication;
- retention policy;
- actual data export delivery;
- account deletion recovery across devices;
- support/moderation ownership;
- distinct production configuration;
- signed Android AAB / Play evidence;
- iOS bundle/signing/TestFlight;
- iOS push proof;
- payment/HITNO implementation if paid launch requires it.

## Definition of V1 core closed

V1 core is closed only when the real marketplace flow works across two accounts and:

- Android push is production-shaped and final copy/deeplink rules are proven;
- text/photo/voice chat works with recovery and paging;
- published Needs have structured taxonomy facts;
- dispatch selects relevant eligible workers from those facts;
- growth projections bound major lists/aggregates;
- account/privacy/legal paths are operational;
- required offline/retry/isolation scenarios pass;
- final release artifacts are accepted on target devices/store path.
