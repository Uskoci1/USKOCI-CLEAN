# USKOČI — OWNER LOCKED DECISIONS

## L-001 — Primary UI object = `Zadatak`
**Status:** `OWNER_LOCKED`  
**Date:** 2026-09-02

### Decision
In ordinary product UI, the single user-facing name for the same underlying Need/Opportunity object is:

**`Zadatak`**

### Applies to
- Objavi zadatak
- Zadaci
- Moji zadaci
- Zadaci za Vas
- Detalji zadatka
- Prijave za zadatak
- Zadatak je izmenjen
- Zadatak je zatvoren

### Supersedes in ordinary UI
- `Potreba` as the primary object name
- `Prilika` as the primary object name

### Does NOT require backend rename
Existing backend/domain names such as:
- `Need`
- `need_id`
- existing RPC/table/migration identifiers

may remain unchanged unless a separate technical reason justifies migration.

### Brand/copy rule
The brand language `Meni treba. Ja mogu.` remains valid.

Natural conversational copy may still use `treba`, for example:
- `Šta Vam treba?`
- `Treba Vam još nešto?`

But once the object exists in product UI, it is a **Zadatak**.

### Product mental model impact
Working public vocabulary becomes:

`Zadatak → Prijava → Dogovor`

This decision is final unless the owner explicitly reopens it.


## L-002 — Remove `Naručilac` / `Uskočer` from ordinary UI
**Status:** `OWNER_LOCKED`  
**Date:** 2026-09-02

### Decision
Ordinary product UI must not label people or workspaces as:
- `Naručilac`
- `Uskočer`

These terms may remain in backend/code/internal documentation where technically useful.

### User-facing mode language
Use:
- `Treba mi pomoć`
- `Želim da radim`

### Profile language
Use:
- `Radni profil`

Do not use:
- `Profil Uskočera`

### Person references
Use natural contextual copy, for example:
- `Objavio Miloš S.`
- `Marko se prijavio`
- `Izabrali ste Marka`
- `Izabrani ste`

Do not prepend role nouns to names.

### Account model
One account can use both modes.

UI should explain this naturally:
- `Isti nalog. Dva načina korišćenja.`
or equivalent final copy.

### Backend impact
No backend role rename is required by this decision.
Existing internal role concepts such as REQUESTER / WORKER may remain.

This decision is final unless the owner explicitly reopens it.


## L-003 — Core mental model = `Zadatak → Prijava → Dogovor`
**Status:** `OWNER_LOCKED`  
**Date:** 2026-09-02

### Core model
Ordinary product UI uses the simple mental model:

**`Zadatak → Prijava → Dogovor`**

### Zadatak
- One Zadatak is one user-facing whole.
- AI must NOT split a Zadatak into visible subtasks in V1.
- AI must NOT independently decide how many people are required.
- If the user explicitly knows or states a number of people, vehicle, tool, or special condition, the system may capture and structure it.
- If the user is unsure, the field may remain unknown/optional unless the user explicitly wants to define it.

### Prijava
A person may submit a concrete proposal to perform the Zadatak.

The proposal may naturally state:
- I can do the whole job;
- I am coming alone;
- we are coming as a team;
- I have a van / vehicle / tool;
- I can organize the required help myself.

USKOČI must not force the requester to decompose staffing/resources unless the requester explicitly wants multiple independent people.

### Multiple people
Multiple independent selections are supported only when the Zadatak is explicitly intended to engage more than one independent person.

This is a special case, not the default model.

### Dogovor
Selection of an accepted Prijava moves the relationship into Dogovor.

The exact Dogovor workspace model for multiple selected participants remains a later owner decision and is not fully locked by L-003.

### Internal complexity
Backend may keep richer entities/state needed for:
- responses/applications;
- selection;
- connection ledger;
- agreement authority;
- privacy/security;
- idempotency.

The user does not need to learn those concepts.

### Product principle
USKOČI helps a person clearly say what is needed and find someone who says:

**`Ja to mogu.`**

It does not attempt to manage the execution structure of the job for them.

This decision is final unless the owner explicitly reopens it.


## L-006 — Three-zone primary navigation
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02

### MENI TREBA
Primary bottom navigation:
- `Zadaci`
- central `U` = `Novi`
- `Dogovori`

Global top actions:
- Notifications (bell)
- User avatar

### JA MOGU
Primary bottom navigation:
- `Prijave`
- central `U` = `Zadaci`
- `Dogovori`

Global top actions:
- Notifications (bell)
- User avatar

### Central U semantics
The U mark is the dominant action of the active mode.

MENI TREBA:
- U opens the new Zadatak flow (R02).

JA MOGU:
- U opens the marketplace (W03).
- Phone W03 uses `Lista | Mapa`.
- Map is a view, not the sole meaning of U.

### Notifications
Bell opens S06. Notifications describe what happened.
Attention badges/rows inside Zadaci, Prijave and Dogovori describe what still requires action.

### Avatar
Avatar owns Moj profil, Radni profil where applicable, availability/calendar, reputation/reviews, Settings/privacy/support, and mode switch `MENI TREBA` / `JA MOGU`.
Use the user image when available; otherwise use a branded static fallback.

### Retired active screens
The following are retired from the active product universe:
- S05 workspace chooser;
- R01 requester Home;
- W01 worker Home.

Their responsibilities must migrate first: post-auth intent routing, resume/deep-link routing, attention/next-action, empty-state guidance, and mode switching. During migration, legacy routes may remain as compatibility redirects.

### Active screen universe
Active product universe becomes 28 screens:
- Shared: 6
- MENI TREBA: 8
- JA MOGU: 8
- Dogovor: 6

This supersedes the previous five-tab navigation canon.
This decision is final unless explicitly reopened by the owner.


## L-007A — Multi-person Dogovor messaging privacy
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02

When one Zadatak has multiple independently selected USKOČI participants:

- the user-facing Dogovor experience includes a shared group conversation for the requester + all selected participants;
- the requester can also open an individual/private conversation with each selected participant;
- selected participants do **not** automatically receive private 1:1 channels with one another;
- all selected participants may exchange operational information together in the shared group conversation;
- this avoids forcing the requester to send the same operational message separately to every participant.

This locks messaging visibility only. It does **not** yet lock:
- whether individual prices are visible to the whole group;
- exact join/leave/history rules when one participant is cancelled or removed;
- the final backend representation for the shared group conversation;
- whether the visible Dogovor container is a new aggregate entity or a UI projection over per-participant Agreements.

The current live Supabase per-selected-response Agreement model remains authoritative until a later backend-sensitive owner decision explicitly changes it.


## L-007B — Multi-person Dogovor price and individual-term privacy
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02

For one Zadatak with multiple independently selected participants:

### Shared to the whole group
All selected participants may see:
- the common Zadatak identity and scope;
- shared place/time information that is operationally common;
- the participant list;
- common operational instructions;
- the shared group conversation.

### Private per participant
The following remain private between the Zadatak owner and the specific participant:
- that participant's agreed price;
- that participant's submitted Prijava details that are not common task facts;
- participant-specific conditions or obligations;
- participant-specific status/problem/cancellation details where disclosure to the whole group is not operationally required.

A participant must not automatically see another participant's price or private agreed terms.

### UX consequence
The visible multi-person Dogovor is one task-centered workspace, but individual terms are rendered only inside the relevant participant/private context.

### Backend consequence
This remains compatible with retaining per-person authoritative Agreement records beneath the shared task-centered workspace.

This decision supersedes any interpretation that joining the same group Dogovor makes all participant prices/terms mutually visible.


## L-007C — Multi-person participant lifecycle inside shared Dogovor
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02

For one Zadatak with multiple independently selected participants:

### Independent participant lifecycle
Each participant keeps an independent authoritative Agreement/status.
One participant cancelling, completing, or entering a problem state must not automatically cancel or complete the other participants.

### Shared Dogovor workspace
The user-facing Dogovor remains a shared task-centered workspace while at least one relevant participant/work item remains active.

The participant list shows each person's own state, for example:
- Active
- Completed
- Cancelled
- Problem / attention state as applicable

### Completed participant
A participant who completes their individual obligation remains in the shared group conversation until the whole shared Dogovor/Zadatak reaches its overall terminal state.

Reason:
- shared operational coordination may still be needed;
- a participant may finish slightly earlier than others;
- completion alone does not imply removal from the team context.

### Cancelled / removed participant
A participant whose individual Agreement is cancelled or who is explicitly removed from the active cooperation:
- loses the ability to send new group messages;
- remains represented in historical chronology;
- retains legitimate historical access to messages/data already visible to them, subject to future retention/privacy policy;
- does not affect the active status of other participants.

### Group chronology
Shared chronology may show neutral lifecycle events such as:
- participant joined;
- participant completed;
- participant no longer participates.

Do not expose another participant's private price or individual terms in shared chronology.

### Overall completion
When the whole shared Dogovor reaches its terminal state, the group conversation becomes read-only historical context unless a later owner decision explicitly defines another retention behavior.

This decision is final unless explicitly reopened by the owner.


## L-007C.1 — Multi-person participant visibility/privacy clarification
**Status:** `OWNER_LOCKED_CLARIFICATION`
**Date:** 2026-09-02

This clarification narrows L-007B/L-007C participant visibility.

### Zadatak owner
The person who published the Zadatak may see and manage:
- the complete selected-participant roster;
- each participant's individual status;
- cancellations/removals;
- replacement needs and replacement actions;
- participant-specific price/terms in the private participant context;
- participant-specific problem/completion state.

### Selected participants
A selected participant does NOT receive a separate management-style view of:
- all selected participants;
- other participants' individual statuses;
- cancellations/replacement workflow;
- other participants' prices/terms;
- other participants' private problems or obligations.

Participants may see other people only insofar as they are members of the shared group conversation (e.g. name/avatar/chat membership) and through common operational messages deliberately shared in that group.

### Replacement flow
If one selected participant cancels or is removed, the system directs the replacement need/action to the Zadatak owner.
Other participants are not asked to manage or approve the replacement and do not need a dedicated notification containing the cancelled participant's private lifecycle details.

The shared group chat is for common coordination, not a participant-management dashboard.


## L-008 — Smart contextual primary action
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02
**Owner-review item:** `6/21`

Each user-facing state presents one clearly dominant next action when one exists.

Rules:
- secondary / exceptional / destructive actions remain available but visually subordinate;
- no fake primary CTA is invented when no action is required;
- the primary action follows current authoritative business state;
- this hierarchy applies across Zadatak, Prijava, Dogovor and shared flows.


## L-009 — Whole-card / identity navigation
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02
**Owner-review item:** `7/21`

When a card/row/identity element has one natural destination, the whole relevant target is tappable.

Do not add redundant `Detalji`, `Otvori`, or `Profil` controls for the same destination.

Separate visible controls remain only for genuinely different actions.


## L-010 — Result-proves-success feedback
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02
**Owner-review item:** `8/21`

No generic success alert is shown when the resulting screen/state already clearly proves success.

Use lightweight toast feedback only when the result would otherwise be invisible or ambiguous.


## L-011 — Progressive disclosure
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02
**Owner-review item:** `9/21`

Secondary, rare, destructive and exceptional actions stay available but are shown contextually instead of as permanently competing CTAs.

The default UI prioritizes the current job and next step while preserving discoverability of governed actions.


## L-012 — AI one-question progressive clarification
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02
**Owner-review item:** `10/21`

R02 and W02 ask one highest-value unresolved material question at a time.

Known/confirmed facts are not redundantly re-asked unless contradiction/staleness requires clarification.
Optional facts do not create a questionnaire wall or block progress.


## L-013 — Rich canonical Radni profil / minimal public profile
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02
**Owner-review item:** `11/21`

Radni profil is a rich canonical/server-side profile used by AI, matching, recommendation and task-readiness logic.

AI:
- clarifies contradictions instead of silently overwriting;
- may show the owner what the system currently knows;
- accepts natural-language add/edit/remove/correction commands;
- stops mandatory interviewing at a useful/safe activation minimum.

Public profile is a separate, minimal trust projection and does not automatically expose all canonical worker facts.

Task-specific capability/resource claims belong primarily in the concrete Prijava when relevant.

An optional short public description may be AI-proposed only from confirmed facts and must be human-approved before public display.


## L-014 — Warm-dawn Entry city
**Status:** `OWNER_LOCKED`
**Date:** 2026-09-02
**Owner-review item:** `12/21`

Entry keeps the recognizable city composition and U motion but moves decisively away from the current dark/noir mood.

Canonical direction:
- brighter warm-dawn atmosphere;
- ivory/cream base;
- muted sage/teal city structures;
- forest/deep-teal trust;
- controlled orange emphasis;
- premium, human, youthful urban Serbia character.

Do not collapse this into sterile white minimalism.


## L-015 — Minimal signup / current-intent choice
**Status:** `OWNER_LOCKED`
**Owner-review item:** `13/21`

One account supports both modes. Signup stays minimal and does not force a permanent role choice. Profile-specific worker data is collected later through W02 when relevant.

## L-016 — W03 discovery without permanent search bar
**Status:** `OWNER_LOCKED`
**Owner-review item:** `14/21`

V1 uses Lista/Mapa + filters + matching as primary discovery. Permanent free-text search is deferred until real usage proves value.

## L-017 — Simple V1 reviews
**Status:** `OWNER_LOCKED`
**Owner-review item:** `16/21`

1–5 stars + optional short comment after completed Dogovor. No multi-axis review form in V1.

## L-018 — Light-first V1
**Status:** `OWNER_LOCKED`
**Owner-review item:** `17/21`

V1 is light-first and follows the warm-dawn visual system. Dedicated dark theme is not a V1 requirement.

## L-019 — Map behavior locked / provider deferred
**Status:** `OWNER_LOCKED_PRODUCT / IMPLEMENTATION_DEFERRED_PROVIDER`
**Owner-review item:** `18/21`

Product map behavior and privacy rules are canonical. Provider is selected later based on engineering/product constraints.

## L-020 — Dogovor = Pregled | Poruke
**Status:** `OWNER_LOCKED`
**Owner-review item:** `19/21`

Exactly two primary Dogovor sections: Pregled and Poruke.

## L-021 — Multi-person group conversation membership boundary
**Status:** `OWNER_LOCKED`
**Owner-review item:** `20/21`

True group chat is required. Removed/cancelled participants cannot see future group messages after membership ends, while prior legitimate history may remain available under retention/privacy rules.

## L-022 — Same-Zadatak capacity recovery and simple V1 change model
**Status:** `OWNER_LOCKED`
**Owner-review item:** `21/21`

Missing capacity reopens on the same Zadatak without disturbing remaining Agreements. V1 keeps term-change UI simple and governed. Terminal group conversation becomes read-only.
