# USKOČI V1 closure plan — 26.09.2026

Status: **ACTIVE FINALIZATION — ROUND31**. Canonical branch: `work/uskoci-ui-unification-20260924`; latest pushed client source: `10739a440611fc32e3bd6d9ee6dd66a5479e091b`.

Start with [AGENTS.md](../../../AGENTS.md), [Round31](finalization-20260927/ROUND_31_NATIVE_CORRECTIONS.md) and [its exact check record](finalization-20260927/ROUND_31_CHECKS.json). P0 is applied and connected; current application outcomes are in [APPLICATION_APPROVALS_20260927.md](finalization-20260927/APPLICATION_APPROVALS_20260927.md). The active order remains P0 through P7, with `docs/control/redovi.json` as the living inventory.

Ordinary UI/flow refinement with critical review is authorized; preserve TaskCard/Peek. Focused checks and consolidated emulator/device build, install and verification are authorized. Existing server, certificate, dependency, payment and secret boundaries remain. Installation and native acceptance for the `10739a44` corrections must be read from their exact APK checkpoint receipts; neither follows from the source being pushed.

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
