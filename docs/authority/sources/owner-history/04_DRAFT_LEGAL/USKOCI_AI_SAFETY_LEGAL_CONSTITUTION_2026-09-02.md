# USKOČI — AI, SAFETY & LEGAL CONSTITUTION 2026-09-02

**Status:** `DRAFT — AUDIT IN PROGRESS`  
**Authority scope:** current target/product truth reconstructed from latest owner locks + current CLEAN physical evidence.  
**Repo:** `Uskoci1/USKOCI-CLEAN` · branch `clean-alpha-backend` · verified HEAD `b2d360fbb2c4a68dec5c182af47e81ed5fcc425d`  
**Clean Supabase:** `leqcwgzvjsxugfgzdmth` · verified migrations `56` · latest `20260901114029_clean_ai_fact_supersession_and_human_correction`  
**Mutation:** none. This package does not authorize source/Supabase writes.


Non-negotiable constitution: AI proposes; humans confirm; canonical commands own business truth; publication safety is versioned/server-final; evidence and deletion obey a versioned retention authority.

---

# 8. CANONICAL NEED FACT / MATERIALIZATION TARGET

One typed fact registry connects:

`conversation → live CARD → Human Review → canonical DRAFT → reread → MINI/CARD/DETAIL`

## Human-confirmed facts
- title / description / category / scope;
- required people/slots;
- fixed-vs-offers pricing and amount where applicable;
- schedule kind/window;
- execution location mode;
- public coarse geography / route / ordered stops when needed;
- skills/tools/vehicles/licenses/minimum experience and other objective requirements;
- public/private classification.

## Private geography owner
- exact address;
- access notes;
- exact coordinates.

## Server-derived only
- status;
- revision;
- publish timestamps;
- admission;
- response deadline policy result;
- urgency activation/expires/policy version;
- spatial derived fields;
- selected/remaining coverage.

## Human Review
Each critical fact is visibly:
`Predloženo / Potvrđeno / Nedostaje`

Unknown stays unknown. It must not silently become `false`, empty or null as if confirmed.

`Sačuvaj nacrt` → canonical DRAFT.  
`Objavi Potrebu` → separate D-0140 admission/publish boundary.

---

---

# 9. D-0140 PUBLICATION ADMISSION TARGET

Minimal bounded context:

## PolicyBundleVersion
- market/jurisdiction;
- version/status;
- review/approval metadata;
- deterministic rule references;
- provider config references if applicable.

## NeedPublicationDecision
- immutable id/sequence;
- Need ID/revision;
- exact content fingerprint;
- policy bundle version;
- media snapshot/reference;
- intent/risk;
- ALLOW/CLARIFY/REVIEW/BLOCK;
- reasons/rules;
- decision source/provider/model/reviewer metadata.

## Publish transaction
Revalidates:
1. caller/owner;
2. exact current revision;
3. exact current fingerprint;
4. current policy version;
5. latest exact decision;
6. deterministic server floors;
7. only admitted state can become public;
8. dispatch after successful admission commit.

Material edit invalidates prior admission but does not mutate already-formed Agreement snapshots.

---

---

# 20. AUTH / SESSION / ACCOUNT RECONCILIATION — CURRENT FINDINGS

## A. Session / protected-route core — KEEP

Current root session layer:
- restores Supabase session;
- subscribes to auth state changes;
- unauthenticated user is redirected out of protected marketplace shell;
- completed pre-auth return intent is consumed exactly once;
- return target only selects a route; downstream RLS/RPC remains authority.

This is a good boundary and should be preserved.

## B. Workspace role is currently UI preference, not permission authority

`src/store/uloga.ts` stores role only in process memory:
- `narucilac`
- `uskocer`

It is not an authorization primitive.

`app_accounts.active_mode` exists in DB but current client does not hydrate it as canonical role state.

Target decision:
- permissions remain backend/account/profile/RLS truth;
- active workspace may be a durable user preference if desired;
- do not use active mode as authorization;
- either formally adopt and sync it, or retire it as a business owner.

## C. Signup metadata mismatch — LIVE CONFIRMED

Current email signup sends:
- `first_name`
- `last_name`
- `city`

Auth trigger reads:
- `full_name`
- `city`

Therefore `full_name` falls back to email prefix.

Live aggregate check confirmed all current app_accounts use the email-prefix fallback.

### Repair
Either:
- signup sends canonical `full_name`; or
- trigger safely combines first_name + last_name.

Use one versioned metadata contract. Add regression proof.

## D. Phone OTP login can create an account — AUTH ONBOARDING BYPASS

Current phone login calls `signInWithOtp({ phone })` without disabling account creation.

Supabase OTP behavior defaults to creating a user when the user does not already exist.

Consequences:
- a new phone can create Auth user;
- auth trigger creates account + Requester/Worker profiles;
- name/city onboarding can be bypassed;
- terms/privacy checkbox can be bypassed;
- profile readiness defects compound.

### Target
Two explicit paths:

`Prijavi se telefonom`
- `shouldCreateUser=false`
- existing account only

`Registruj se telefonom`
- dedicated onboarding
- name
- city
- current policy acceptance receipt
- same DRAFT profile/readiness semantics
- then OTP verification

No accidental signup from a login CTA.

## E. Durable legal acceptance receipt is missing

Auth UI requires a checkbox for Terms/Privacy, but clean DB currently has no:
- legal acceptance table;
- terms acceptance;
- privacy acceptance;
- policy version receipt.

### Target
Append-only acceptance receipt binds:
- account;
- document IDs/versions;
- market/jurisdiction where relevant;
- accepted_at;
- locale;
- source/client/app version where useful;
- superseding/reacceptance logic.

The UI checkbox alone is not evidence.

## F. `app_accounts` field ownership is mixed

Current owner can update entire own row.

Target classification:

### Self-declared editable
- display/full name, subject to product policy;
- city/profile preference where applicable.

### Auth-owned mirror
- email;
- verified phone identity.

### Preference
- active workspace/mode, if retained.

### Server-derived
- onboarding/readiness completion, if retained as a meaningful field.

Do not let a generic owner UPDATE policy make all four classes equivalent.

## G. Recovery is incomplete

Current client:
- can request password reset email.

Missing:
- explicit app recovery callback handler;
- `PASSWORD_RECOVERY` event handling;
- new-password screen;
- `updateUser({password})`;
- proven reset redirect into `uskociapp`;
- recovery end-to-end proof.

App scheme exists, so this is not blocked by lack of a custom scheme.

Project-level Auth redirect/SITE_URL allowlist remains `UNVERIFIED` in this audit because the available connector does not expose those project settings.

## H. Auth proof requirements

Before Auth can be `E2E_PROVEN`:
- email signup metadata roundtrip;
- phone existing-user login does not create account;
- phone registration follows explicit signup flow;
- legal acceptance receipt exists;
- email verification returns safely;
- password reset returns safely and changes password;
- logout clears sensitive local intent/workspace state;
- cross-account return target cannot reveal protected Need/Dogovor;
- app restart restores session;
- deep link after cold start reauthorizes target.


---

---

# 21. WORKER AI PROFILE / W02–W08 RECONCILIATION

## Current clean truth

The clean AI persistence vocabulary contains conversation purposes:
- NEED_INTAKE
- APPLICATION
- PROFILE

However the current deployed clean AI turn writer is functionally **NEED_INTAKE-only**.

Therefore:
- W02 Worker AI Profile is not backend-complete;
- AI W05 Application is not backend-complete;
- the enum vocabulary is future-capability scaffolding, not runtime proof.

## Donor capability worth adapting

Donor AI interview architecture physically supported:
- `WORKER_PROFILE`
- `NEED`
- `APPLICATION`

Useful authority mechanics:
- Worker Profile interview validates profile ownership.
- Application interview requires exact profile + Need + conversation + expected Need revision.
- Application context is reloaded server-side; client-known context is not trusted.
- Provider output is restricted to allowlisted fact keys per interview kind.
- User facts and context facts are distinct.
- AI proposals remain proposals.

Do not copy donor RPC names or economics. Adapt the contract.

## Worker fact model

Current clean `app_profiles` already owns a compact summary:
- display name/city/bio;
- years experience;
- skills;
- tools;
- licenses;
- vehicles;
- exclusions;
- radius;
- available-now;
- team capacity;
- minimum fee;
- portfolio;
- rating projections.

More specific matching facts should not become dozens of ad-hoc profile columns.

Target additional typed capability facts may include:
- vehicle passenger/cargo/payload capacity;
- lifting constraints/max lift;
- assembly/disassembly capability;
- work-at-height capability;
- pet/cleaning-specific capability;
- regular availability;
- other category-specific confirmed facts.

## Target architecture

`AI Worker interview`
→ proposed typed facts
→ human review/confirm
→ `confirmed capability facts`
→ allowlisted canonical profile/capability command
→ public profile summary + private matching facts
→ readiness gate
→ ACTIVE Worker profile

### app_profiles
Use for stable/public summary and coarse matching preferences.

### worker capability fact owner
Use for structured confirmed facts with provenance:
- key/value;
- source AI fact ID where applicable;
- confirmed_by;
- confirmed_at;
- matching_eligible;
- supersession/history.

Matcher consumes only confirmed/matching-eligible facts for hard capability decisions.

## Profile mutation owner

Current clean mobile still directly updates `app_profiles`.

Target:
- one clean server profile mutation command;
- allowlisted patch keys;
- auth-derived owner;
- row lock;
- SUSPENDED/CLOSED fail closed;
- AI does not write profile directly;
- completion/readiness is a separate explicit transition.

## W02
Purpose:
build/refresh Worker capability profile conversationally.

Must support:
- resume;
- per-fact review;
- manual fallback;
- unknown/not-applicable;
- vehicle/resource detail;
- team capacity;
- exclusions;
- service scope;
- experience;
- geographic work preferences;
- availability handoff to W09.

## W08
Purpose:
view/edit current Worker profile and trust/public settings.

W08 is not a replacement for W02 or W09:
- W02 = guided capability acquisition;
- W08 = profile/account management;
- W09 = availability/calendar.


---

---

# 25. D05 PROBLEM / CANCELLATION / RECOVERY / EVIDENCE RECONCILIATION

## Core separation

USKOČI must keep four distinct authorities:

1. **Problem report** — user says something went wrong.
2. **Operational cancellation** — a party ends the Agreement.
3. **Recovery entitlement** — bounded same-Need recovery after qualifying basis.
4. **Safety/support case** — platform review/adjudication/evidence process.

No one command may silently perform all four.

A cancellation is not proof of fault.
A report is not proof of fault.
A recovery grant is not a cash refund.
A support outcome is not allowed to rewrite historical Agreement truth.

---

## Current clean `rpc_cancel_agreement` — KEEP CORE, EXTEND

The current function is structurally useful:
- authenticated party only;
- canonical lock order Need → Agreement;
- idempotent when already CANCELLED;
- refuses completed Agreement cancellation;
- cancels Agreement/execution/selection;
- releases selected Application state;
- revokes privacy grants;
- expires queued Agreement notifications;
- recalculates covered slots;
- reopens Need/dispatch if capacity becomes missing.

This is exactly the correct operational family to preserve.

### Missing
- structured cancellation reason code + optional human note;
- actor role/cause receipt;
- immutable cancellation event;
- qualification handoff into ReplacementEntitlement;
- calendar hard-block release;
- evidence/support linkage where relevant;
- server-side policy for late cancellation/no-show/reliability signals.

Cancellation itself must remain immediate/unilateral; no counterparty veto.

---

## Current clean `rpc_report_problem` — TOO THIN FOR CANONICAL RECOVERY

Current behavior:
- party-authenticated;
- requires narrative;
- sets one `problem_opened_at`, `problem_narrative`, `problem_opened_by` on execution;
- inserts a system-looking problem line into Agreement chat.

That is not a full case system.

### Problems
- one mutable field set cannot represent multiple issue/evidence events;
- no category/severity/state;
- no semantic request ID;
- no evidence linkage;
- no counterparty response state;
- no reviewer/support owner;
- no immutable case chronology;
- no adjudication receipt;
- no no-show confirmation state;
- no distinction among service issue, safety issue, harassment, no-show, platform error, or payment-adjacent complaint;
- chat text is not a substitute for case evidence.

### Target
`rpc_report_problem` should eventually become a narrow command that creates/attaches to an immutable `RecoveryCase` / `SupportCase`, then emits an Agreement event. Chat may show a derived system message, but the case row is authority.

---

## RecoveryCase target

Suggested canonical object:

```text
RecoveryCase {
  id
  agreementId
  needId
  agreementVersion
  openedByAccountId
  openedByRole
  category
  userNarrative
  status: OPEN | UNDER_REVIEW | RESOLVED | REJECTED | CLOSED
  severity
  openedAt
  updatedAt
  resolvedAt?
  resolutionCode?
  resolutionSummary?
  replacementQualification?
  noShowState?
  policyVersion
}
```

This object is not a money dispute ledger and not an automatic fault score.

---

## No-show

A report that someone did not arrive is only:
`REPORTED`.

Canonical confirmed no-show requires a separate, versioned authority path:
- mutually consistent evidence; or
- support/admin adjudication; or
- another explicit policy-backed confirmation mechanism.

Only **confirmed** no-show may trigger policy consequences such as bounded replacement entitlement or internal reliability signal.

No-show report alone:
- cannot create public penalty;
- cannot create automatic refund;
- cannot create generic Povezivanje credit;
- cannot mark counterparty guilty.

---

## Evidence — donor mechanics to SALVAGE

Donor `uskoci-agreement-evidence` contains valuable security mechanics and should be adapted, not copied blindly.

### Preserve
- authenticated user boundary;
- Agreement participant admission;
- exact Agreement version binding;
- allowlisted evidence kind;
- maximum size;
- declared MIME allowlist;
- actual magic-byte MIME verification;
- SHA-256 content hash;
- private storage bucket;
- random server object key;
- no upsert;
- authoritative metadata finalization;
- cleanup of uploaded object if DB finalization fails;
- participant-scoped read;
- short-lived signed URL;
- fail-closed retention admission.

### Rebind
Old donor evidence kinds include legacy execution semantics such as `ARRIVAL_EVIDENCE`.
Current V1 should use current product vocabulary, for example:
- `CHAT_ATTACHMENT`
- `COMPLETION_EVIDENCE`
- `PROBLEM_EVIDENCE`
- `NO_SHOW_EVIDENCE`
- `SAFETY_EVIDENCE`
- `SUPPORT_EVIDENCE`
- `OTHER_EVIDENCE`

Exact final taxonomy remains a policy/config decision.

---

## Evidence metadata target

```text
AgreementEvidence {
  id
  agreementId
  agreementVersion
  caseId?
  uploadedByAccountId
  evidenceKind
  originalFileName
  mimeType
  sizeBytes
  sha256
  storageKey
  storageStatus
  createdAt
  retentionClass
  legalHoldState
  deletionEligibleAt?
}
```

Evidence metadata is immutable except lifecycle/retention state controlled by trusted server authority.

---

## D-0141 retention rule

Media lifecycle must distinguish:

### Disposable user media
Examples:
- profile avatar;
- uncommitted Need draft photo;
- non-evidentiary attachment where policy permits deletion.

May be deleted normally.

### Business/legal evidence
Once media becomes part of:
- Agreement history;
- problem/recovery case;
- safety report;
- support/complaint;
- moderation/legal hold;

it cannot simply disappear because:
- user removes a UI attachment;
- user closes account;
- source message/profile is removed.

Retention period is not hard-coded from donor assumptions.
It must come from the current versioned retention policy for the exact data class/jurisdiction.

---

## D05 native screen target

### Entry points
From D02/D06:
- `Prijavi problem`
- `Otkaži dogovor`

### Problem flow
1. choose category;
2. human narrative;
3. optional evidence;
4. privacy/safety warning where relevant;
5. submit immutable case;
6. show case receipt/state;
7. counterparty sees safe case notification;
8. support flow only when needed.

### Cancellation flow
1. reason selection;
2. optional note;
3. clear consequence summary;
4. confirm;
5. immediate authoritative cancellation;
6. rerender current Need/Dogovor state;
7. if qualifying Worker cancellation → show bounded replacement state to Requester.

No cancellation screen should imply a guaranteed refund.

---

---

# 26. ACCOUNT CLOSURE / DATA EXPORT / RETENTION RECONCILIATION

## Current clean status

Clean currently has no complete account lifecycle subsystem:
- no account closure RPC family;
- no data export request owner;
- no retention policy registry;
- no closure orchestration Edge;
- no canonical storage cleanup manifest.

This is launch-critical.

---

## Donor account-close mechanics — SALVAGE

Donor `uskoci-account-close` has a good orchestration pattern:

1. authenticated user request;
2. explicit confirmation phrase;
3. stable request ID;
4. server `prepare` phase;
5. active-obligation blockers checked;
6. server-generated scoped storage cleanup manifest;
7. storage cleanup;
8. trusted Auth Admin identity deletion;
9. server finalization;
10. idempotent receipt/state;
11. business evidence retained.

This is a good lifecycle skeleton.

---

## Donor closure preflight — SALVAGE/REWRITE

Useful blockers:
- active Agreements;
- open recovery cases;
- active/orphan selections;
- sole-owner organization responsibilities.

Clean V1 may not have organizations at launch, so organization logic is optional until that domain exists.

### Required clean blockers
At minimum:
- active non-terminal Agreements;
- open problem/recovery/safety/support cases that require continued user action;
- unresolved replacement entitlements or selected allocations where closure would orphan authority;
- ongoing account export if policy requires completion/cancellation first;
- any explicit legal/admin hold.

Closure should not be blocked forever by passive historical records.

---

## Closure is not “delete every row”

The correct model is:

`user requests account closure`
→ active obligations settle/cancel
→ mutable marketplace participation closes
→ PII is minimized/anonymized
→ disposable storage deleted
→ retained evidence/tombstones remain under policy
→ Auth identity deleted
→ account state CLOSED

Historical Agreement/business integrity must not be destroyed.

---

## Tombstone architecture

Current clean Agreement foreign keys are RESTRICT and party IDs are NOT NULL. That is safer than donor's briefly attempted SET NULL approach because it prevents destroying historical party linkage accidentally.

Do **not** solve account deletion by nulling or deleting historical Agreement parties.

Preferred target:

### Stable internal subject/account row survives as tombstone
- internal UUID remains for historical referential integrity;
- public profile becomes closed/anonymized;
- email/phone/name/address/profile media are removed/anonymized as policy permits;
- Auth identity is deleted separately;
- historical Agreement/review/evidence references continue to point to a non-login tombstone identity.

This separates:
- login identity;
- PII;
- durable business actor reference.

Exact legal retention/anonymization policy must be versioned and reviewed.

---

## Closure phases

### Phase 1 — Status/preflight
`ACTIVE`
→ request closure status
→ return blockers and cleanup summary.

### Phase 2 — Prepare
- stable semantic request ID;
- lock account;
- recheck blockers;
- close/cancel own open Needs where permitted;
- withdraw open Applications;
- disable proactive dispatch;
- disable availability;
- revoke future-facing privacy/contact grants where appropriate;
- disable push devices/preferences;
- remove ephemeral AI drafts/proposals where retention policy permits;
- build disposable-storage cleanup manifest;
- anonymize public profile;
- set `CLOSURE_PENDING`.

### Phase 3 — Storage cleanup
Trusted server deletes only manifest-approved disposable objects.

Never bulk-delete evidence bucket content by user prefix if those objects are retained evidence.

### Phase 4 — Auth identity deletion
Trusted server uses Supabase Admin boundary.

### Phase 5 — Finalize
- verify disposable cleanup done;
- verify Auth identity gone;
- set account `CLOSED`;
- stamp closed_at;
- preserve closure receipt/audit.

---

## Idempotency

Same closure request ID:
→ same state/receipt.

Different request ID while closure already prepared:
→ deterministic conflict or status response.

A client retry must never:
- double-delete;
- reopen account;
- destroy retained evidence;
- corrupt storage manifest.

---

## Data export

Donor has a useful minimal request lifecycle:
- stable client request ID;
- one open export per account;
- REQUESTED / PROCESSING / COMPLETED / FAILED / CANCELLED style state;
- status RPC;
- cancellable only before processing;
- server fulfillment required.

But donor did not yet implement full downloadable artifact generation.

### Clean target
`DataExportRequest`
- receipt ID;
- account ID;
- client request ID;
- status;
- requested_at;
- started_at;
- completed_at;
- expires_at;
- failure code;
- artifact storage reference;
- artifact hash;
- format/schema version.

Export generation runs server-side and must include only data the user is entitled to receive, excluding third-party secrets/private evidence beyond lawful scope.

Download:
- private object;
- short-lived signed URL;
- explicit expiry;
- access audited.

---

## Retention policy

Donor `retention_policy_sets` / `retention_policy_rules` model is valuable.

Important donor property:
execution is fail-closed if no complete current retention policy covers all required data classes.

### Clean target

`RetentionPolicySet`
- policy version;
- jurisdiction/market;
- effective_at;
- reviewed/approved/counsel reference;
- retired_at.

`RetentionPolicyRule`
- data class;
- purpose;
- retention period;
- deletion trigger;
- exception/legal-hold rule;
- legal basis reference.

Data classes should cover at least:
- auth/account PII;
- public profile;
- private contact;
- Need drafts/published Need;
- AI conversation/facts;
- Agreement history;
- chat;
- evidence;
- reviews;
- support/safety/recovery cases;
- notifications/device tokens;
- payment/platform-fee records when enabled;
- audit/security logs.

No production deletion/retention scheduler should execute until the required policy set is complete and admitted.

---

## S07 account/privacy surface

Must eventually expose:
- privacy policy / Terms;
- legal acceptance history or current version info;
- notification settings;
- `Preuzmi moje podatke`;
- export request/status/download;
- `Zatvori nalog`;
- blockers/explanation if closure not yet possible;
- explicit final confirmation;
- closure receipt state.

Account deletion must be available in-app for a product that supports account creation.

---

---

# 42. DECISION / SUPERSESSION FREEZE

## Purpose

This is the mandatory decision layer to read before any implementation wave.

Rule:

> **Latest explicit owner lock wins over older documents, donor mechanics, old tests and current implementation gaps.**

A current source gap does not reopen a product decision.
A historical `PASS` does not restore a superseded contract.
A recommendation remains a recommendation unless a later owner lock closes it.

---

# 42.1 D-0140–D-0154 CURRENT LOCKS

| ID | Status | Current locked rule | Supersedes / constrains | Implementation consequence |
|---|---|---|---|---|
| D-0140 | `LOCKED` | Need publication safety/legal authority is server-final and versioned; final outcomes `ALLOW / CLARIFY / REVIEW / BLOCK`; model memory/output is not normative authority; contradictory/unproven rules fail closed to REVIEW. | Any direct AI/client publish; static model-memory-only safety; old publisher without exact policy decision. | Versioned policy bundle + exact Need revision/fingerprint + immutable decision + canonical publish transaction. Legal/provider production reliance remains separately unproven until validated. |
| D-0141 | `LOCKED` | Disposable media may be deleted; media that becomes Agreement/dispute/moderation/legal-hold evidence remains private until approved retention policy allows deletion. Exact retention periods must not be invented. | “Delete account/media = delete every object”; donor fixed retention assumptions. | Versioned retention policy must precede destructive cleanup; evidence bucket/object lifecycle separate from disposable media. |
| D-0142 | `LOCKED` | `Near me` GPS is transient query input. Saved work area is a separate explicit preference command. Remote has no fake geography/radius/route. | D-0050 or any silent GPS persistence/device→profile coupling. | Location adapter returns transient coordinates; persistence only through explicit saved-area owner. |
| D-0143 | `LOCKED` | One canonical business event = one Inbox item; read state is event-level; tap performs bounded authoritative reread. | D-0051 / channel-delivery unread semantics; transport as inbox truth. | `user_activity_events` owns read state; delivery/push rows are transport metadata. |
| D-0144 | `LOCKED` | Active physical Dogovor may optionally share a consented current-location snapshot. No background/live tracking. | General location tracking; profile/GPS persistence as Dogovor tracking. | Narrow snapshot command/grant; exact Agreement/party/RLS; no background location permission unless a future decision explicitly adds it. |
| D-0145 | `LOCKED` | V1 has no dedicated canonical execution-progress milestone state machine. No mandatory `Krećem/Stigao/Preuzeo/Započni rad` before `Završio sam`; ordinary progress stays in Dogovor chat. | EN_ROUTE/ARRIVED/ACTIVE universal lifecycle and old execution-wave dependencies. | Completion works directly from valid Agreement state; old milestone fields may remain historical evidence only until retired. |
| D-0146 | `LOCKED`, later extended | S01 background visual direction: forest/teal city atmosphere, ivory pins, no route lines; later D-0153/D-0154 refine the same scene. | Older visual variants. | Preserve composition/palette; do not treat old donor asset as automatically clean-target complete. |
| D-0147 | `LOCKED` | Background session check does not shorten the intro; uncertainty cannot block forever. | Session-result-dependent intro shortening. | Intro timing is deterministic; session result routes after/beside it according to entry contract. |
| D-0148 | `LOCKED` | Intro only on cold start; no replay on ordinary resume. | Splash/intro replay after background resume. | Process/cold-start state must distinguish resume. |
| D-0149 | `LOCKED` | Reduced-motion path has no flight/Lottie/scale choreography: still/final frame + hold/fade into parked state. | Same animation for everyone. | Respect OS reduced-motion; real device proof required. |
| D-0150 | `LOCKED` | Cold notification/deep-link entry skips intro and first revalidates account/target truth. | Always-play-intro deep link; payload-as-authority. | Deep-link/push routing → session authorization → canonical reread. |
| D-0151 | `LOCKED` | Session/network uncertainty must not falsely log the user out; Home may remain usable with truthful explanation + retry. | Treat transient network/session uncertainty as logout. | Explicit uncertain/error state; retry; no fabricated auth state. |
| D-0152 | `LOCKED` | Exact S01 timing/dimensions/path/color contract: wink `1.33–1.93 s`, hold `320 ms`, flight `900 ms`, usable by `3.15 s`, parked mark `38 px`, canonical colors. | Approximate motion guesses. | Native implementation/device tests measure these values; changes require owner reopen. |
| D-0153 | `LOCKED` | S01 pins use ivory `#f8ebd7`, not pure white. | Older white-pin variants. | Asset/native renderer uses canonical pin tone. |
| D-0154 | `LOCKED / D-0146 PARTIALLY REOPENED_AND_EXTENDED` | S02 owns the persistent city scene; S01 is transparent above it; measured lit-window treatment extends D-0146; no `FeGaussianBlur`; wake does not restart scene on handoff. | D-0146’s earlier “no new illustration without reopening” only in the explicitly reopened city-light portion; duplicate S01/S02 backgrounds. | One persistent scene owner, transparent intro overlay, no duplicated handoff restart. |

## Runtime warning

D-0140–D-0154 are **product/target locks**, not automatic implementation proof.

Examples:
- D-0140 is locked, but the current clean server still has a publish bypass.
- D-0143 is locked, but current clean still stores read state on delivery rows.
- D-0144 is locked, but complete native/device/RLS snapshot proof is not yet present.
- D-0147–D-0154 have source/reference evidence, but current clean latest APK still needs final device/visual proof.

---

# 42.2 KEY EARLIER OWNER LOCKS THAT CONTROL IMPLEMENTATION

## D-0042 / D-0043 — Compound / NeedPlan

`OWNER_LOCKED`

- Multi-stop remains **one Need** when one Worker/team commitment owns the ordered route.
- Split into multiple canonical Needs only when there are real independent commitment boundaries: Worker selection, price, Dogovor/privacy, cancellation/completion or equivalent.
- AI may propose structure; Requester confirms.
- NeedPlan may be an organizational/derived umbrella.
- NeedPlan is not a second matcher, Dogovor owner or execution engine.
- No independent writable NeedPlan lifecycle in V1.
- Dedicated NeedPlan UI is not launch-mandatory.

### Supersedes
Historical ambiguity that every multi-part request needs its own Plan engine/status.

---

## D-0069 — Public reputation

`OWNER_LOCKED`

Public reputation:
- eligible completed-Dogovor star average;
- matching eligible review count;
- separate server-proven completed-job count.

Internal:
- cancellation;
- late cancellation;
- no-show;
- reliability;
- T&S signals.

Internal signals may influence internal policy/matching under explicit rules, but:
- do not become raw public counts;
- do not silently alter star average.

### Supersedes
Mystery/public Trust Score and hidden star penalties.

---

## D-0071 — Povezivanje payer/beneficiary

`OWNER_LOCKED`

Requester is economic payer/beneficiary.
Worker Applications are free.

### Supersedes
Donor/current old Worker-paid connection model.

---

## D-0073 — Povezivanje activation point

`OWNER_LOCKED`

Exact unchanged Application selection:
→ active Dogovor
→ Povezivanje activation/consumption

No redundant Worker reconfirmation.

---

## D-0075 / C12.13 — V1 launch pricing

`OWNER_LOCKED`

V1:
- promotional-free for eligible Requesters;
- uses real Povezivanje entitlement/activation engine;
- `costQuantity=0`;
- paid checkout disabled.

Later paid packages/allowance:
- only after marketplace/liquidity evidence;
- store/legal/fiscal/payment/provider gates;
- no exact paid RSD price/date required for V1 launch.

### Supersession note
Older copies of the decision register still show D-0075 as `NEEDS_OWNER_DECISION`.
Those rows are superseded by the later C12.13 owner lock.

---

## D-0076 — Multi-slot economics

`OWNER_LOCKED`

Povezivanje quantity follows covered headcount/allocation.

Independent coverage can activate independently.

---

## D-0077 — Team economics

`OWNER_LOCKED`

Lead covering N people consumes N Povezivanja, not one.

A teammate account is not required for V1 simple-team coverage.

---

## D-0078 + C12.7 — Replacement and original activation

`OWNER_LOCKED`

- original activation remains consumed;
- replacement binds same Need + vacated allocation;
- replacement events have zero global-bucket delta;
- replacement is not a reusable/global credit.

---

## D-0080 + C12.7 — Replacement not filled

`OWNER_LOCKED`

If replacement is not filled:
- entitlement becomes `EXPIRED/NOT_FILLED`;
- original activation remains consumed;
- no automatic global Povezivanje credit;
- no automatic refund;
- exceptional support remedy requires separate approved authority.

Hard window:
- opens immediately after qualifying Worker cancellation or confirmed Worker no-show;
- no-show report alone is insufficient;
- ends at earliest of refill, Requester Need closure/cancellation, basis-invalidating material revision, or **24 h after original confirmed execution-window end**.

---

## D-0081 — Purchased Povezivanja

`OWNER_LOCKED` for later paid enablement.

Purchased units do not expire.

Promotional and replacement windows are separate concepts and may expire according to their own policy.

---

## D-0082 — Paid checkout

`RECOMMENDED / PROFESSIONAL GATE OPEN`

Keep checkout unconfigured/disabled until:
- Apple/Google channel/SKU decision;
- Serbia operator/payment/NBS analysis;
- fiscal/VAT;
- consumer obligations;
- currency/provider contract;
- other applicable professional gates

are documented and approved.

### Important
D-0082 being professionally open does **not** reopen D-0075 V1 FREE launch.
Paid checkout is outside V1 critical path.

---

# 42.3 D-0109 / C12.12 — APPLICATION FRESHNESS

`OWNER_LOCKED`

Submitted unselected Application:
- has no arbitrary time expiry;
- remains actionable only while Need is actionable/current, coverage exists and Worker stays eligible.

Material Need change:
→ affected Application becomes `STALE_REVIEW_REQUIRED`
→ non-selectable.

Worker receives privacy-safe notification/deep link + human-readable diff.

Exactly three primary actions:

1. **Zadrži prijavu**
   - explicit reconfirm/rebase to latest Need revision;
   - new current Application version.

2. **Izmeni prijavu**
   - reopen Application AI/review only for affected/open facts;
   - human-review;
   - explicit new version submit.

3. **Povuci prijavu**
   - `WITHDRAWN`;
   - history preserved.

Doing nothing:
- remains stale/non-selectable;
- old consent never silently carries forward.

Once selected:
- later changes use Dogovor material-change flow, not Application stale/rebase flow.

### Supersedes
- arbitrary 24h/48h/7-day Application expiry;
- silent consent carry-forward after material Need edits;
- direct selection of stale Application.

---

# 42.4 NAVIGATION / DOGOVOR STRUCTURE

## D-0084 Requester navigation
`OWNER_LOCKED`

`Početna | Potrebe | + | Dogovori | Profil`

## D-0085 Worker navigation
`OWNER_LOCKED`

`Početna | Prijave | [USKOČI→Prilike] | Dogovori | Profil`

Availability is reached from Home/Profile.

## Dogovor
Owner-locked two-tab structure:

`Pregled | Poruke`

Chronology is embedded in Pregled, not a third primary tab.

---

# 42.5 WORKER PROFILE GATE

Current owner truth:

- Worker may browse W03 Marketplace before completing Worker profile.
- W02 is profile enrichment/readiness, not a Marketplace viewing gate.
- Minimum confirmed Worker profile is required before first W05 Application submit.

### Supersedes
Any old flow that blocks Marketplace browsing until full Worker onboarding is complete.

---

# 42.6 UI AUTHORITY

## D-0138
`OWNER_LOCKED`

Screen-by-screen and flow-by-flow product/UI/UX closure remains intentional before final build/release. Micro decisions that affect visible behavior, navigation, comprehension, state or accessibility are product-level, not automatically delegated.

## D-0139
`OWNER_LOCKED`

Owner UI boards are official **visual-direction evidence**, not literal final-screen authority.

Preserve:
- premium deep green;
- warm ivory/cream;
- controlled orange;
- clean human mobile-first cards.

But every screen must be reconciled against newer:
- data;
- action;
- privacy;
- safety;
- accessibility;
- navigation
locks.

### Supersedes
Blindly rebuilding screenshots/old donor UI 1:1 where current functional/product truth differs.

---

# 42.7 EXPLICIT SUPERSESSION LEDGER

| Old assumption / authority | Current authority | Result |
|---|---|---|
| Quietly persist `near me` GPS | D-0142 | `SUPERSEDED` |
| Delivery/channel attempt owns unread truth | D-0143 | `SUPERSEDED` |
| EN_ROUTE/ARRIVED/ACTIVE mandatory V1 execution chain | D-0145 | `SUPERSEDED` |
| Intro replay on resume | D-0148 | `SUPERSEDED` |
| Intro always plays on push/deep link | D-0150 | `SUPERSEDED` |
| Pure white S01 pins | D-0153 | `SUPERSEDED` |
| Separate S01 and S02 scene/background ownership | D-0154 | `SUPERSEDED` |
| Worker-paid Povezivanje | D-0071 | `SUPERSEDED` |
| Worker re-confirms after Requester selection | D-0073 | `SUPERSEDED` |
| V1 paid pricing required before launch | D-0075/C12.13 | `SUPERSEDED` |
| One team lead = one Povezivanje regardless of headcount | D-0077 | `SUPERSEDED` |
| Cancellation restores generic global connection credit | D-0078/D-0080/C12.7 | `SUPERSEDED` |
| Application silently remains selectable after material Need change | D-0109/C12.12 | `SUPERSEDED` |
| Application automatically expires after arbitrary duration | D-0109/C12.12 | `SUPERSEDED` |
| NeedPlan is second execution engine/status owner | D-0042/D-0043 | `SUPERSEDED` |
| Mystery/raw public Trust Score | D-0069 + later profile locks | `SUPERSEDED` |
| Worker must finish full profile before browsing Marketplace | later Worker onboarding lock | `SUPERSEDED` |
| Old UI screenshot/source is literal final UI authority | D-0138/D-0139 + current HTML/current screen contract | `SUPERSEDED` |
| Single-root historical architecture requirement if it conflicts with current clean physical architecture | later target/handoff/current-clean architecture | `REVALIDATE / SUPERSEDED_AS_PHYSICAL_MANDATE` |

---
