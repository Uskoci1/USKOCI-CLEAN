# USKOČI — OWNER REVIEW 21 CHECKPOINT — RECOVERED v16

**Purpose:** restore the one-by-one owner review sequence and prevent numbering drift.  
**Date reconstructed:** 2026-09-02  
**Rule:** from now on, ask exactly one unresolved item at a time and keep this file current.

## Provenance note

The original chat message that presented the decisions as one exact `1–21` list was not preserved as a standalone artifact.

This durable sequence is therefore **reconstructed from the original Pass 01–05 owner matrices, the final decision board, and explicit owner locks**. It preserves the actual decision topics and current answers, but it does not claim to reproduce the lost chat message word-for-word.

Do not invent a second numbering system (`7A`, `7B`, etc.) as a competing main sequence.  
Subdecisions may exist under one numbered item, but the main owner-review cursor remains `1/21 … 21/21`.

## Status legend
- `LOCKED` — explicit owner lock exists.
- `WORKING_DIRECTION` — owner approved direction, but final detail remains open.
- `OPEN` — still requires owner answer.
- `PARTIALLY_LOCKED` — important parts are locked, remaining subparts still require closure.
- `SUPERSEDED_NO_DECISION_REQUIRED` — later lock made the original question irrelevant.

| # | Decision | Current status | Current authority / note |
|---:|---|---|---|
| 1 | Primary user-facing object word | LOCKED | L-001: `Zadatak` |
| 2 | Ordinary role language / one account two modes | LOCKED | L-002: remove `Naručilac/Uskočer`; use natural mode language; `Radni profil` |
| 3 | Core user mental model / no visible subtask decomposition | LOCKED | L-003: `Zadatak → Prijava → Dogovor`; AI does not invent staffing |
| 4 | S02 Entry mode/brand composition and final action wording | WORKING_DIRECTION | WDIR-004 approved direction; exact final CTA wording and visual composition remain open |
| 5 | Primary navigation and active surface universe | LOCKED | L-006: three-zone navigation; S05/R01/W01 retired; 28 active functional surfaces |
| 6 | Smart contextual primary action system | LOCKED | Owner lock: one clearly dominant next action per state; other governed actions remain secondary/scoped |
| 7 | Whole-card / identity tap when one natural destination exists | LOCKED | Owner lock: whole card/row or identity target is tappable when it has one natural destination; redundant `Detalji/Profil` button omitted |
| 8 | Remove generic success alert when next state/screen proves success | OPEN | Original A03 recommendation |
| 9 | Progressive disclosure for secondary / exceptional actions | LOCKED | Owner lock: secondary/rare/destructive actions remain available but appear only when relevant; they do not compete with the main flow |
| 10 | AI asks one highest-value missing/unclear fact at a time | LOCKED | Owner lock: ask exactly one highest-value unresolved material question at a time; never re-ask already-known facts without reason |
| 11 | W02 contradiction detection + useful activation minimum + conversational profile maintenance | LOCKED | Owner lock: rich canonical Radni profil for AI/matching; contradictions clarified; user may ask what system knows and correct/add/remove facts conversationally; public profile remains a separate minimal trust projection |
| 12 | Final Entry/city mood | OPEN | Compare current dark vs warm dawn vs very light ivory/sage |
| 13 | Signup data amount | OPEN | Minimal auth first vs immediate name/surname/city; recommendation = minimal auth |
| 14 | Permanent W03 marketplace search field at launch | OPEN | Recommendation = omit unless search quality/need proves it useful |
| 15 | Home density when nothing needs attention | SUPERSEDED_NO_DECISION_REQUIRED | L-006 retires R01/W01 Home; attention moves to active roots |
| 16 | V1 review depth | OPEN | Recommendation = 1–5 stars + optional short comment |
| 17 | V1 theme scope | OPEN | Recommendation = light-first; dark mode later unless launch priority |
| 18 | Map provider / final map skin | OPEN | Behavior can remain provider-neutral until implementation adapter lock |
| 19 | Dogovor visible shell / navigation | OPEN | Strong recommendation: exactly `Pregled | Poruke`; chronology embedded; no third persistent tab |
| 20 | Multi-person Dogovor structure, messaging and privacy | PARTIALLY_LOCKED | L-007A/B/C/C.1 lock group chat, owner-private channels, private prices, independent participant lifecycle, owner-only participant management; backend group-conversation implementation and post-removal future-read boundary remain to close |
| 21 | Dogovor recovery/change/completion behavior | OPEN | Includes cancellation/removal capacity reopening on the same Zadatak, formal accepted-term change policy, and final overall terminal/read-only behavior |

## Current cursor

The earliest unresolved item in the recovered sequence is:

**OWNER REVIEW COMPLETE — 21/21**

The owner review should resume there, one question at a time.

## Already-created Dogovor subdecisions

The recent labels `7A`, `7B`, `7C`, `7C.1` are retained as historical lock IDs, but for this 21-item owner-review sequence they are consolidated under **OWNER REVIEW COMPLETE — 21/21**.

This prevents the owner-review counter from drifting again.


## 6/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

For every user-facing state:
- one action is visually dominant when there is one clear next step;
- secondary, exceptional, destructive, or administrative actions remain available but do not compete as equal CTAs;
- if no action is genuinely required, the UI must not invent a large primary CTA;
- the primary action is derived from current server-authoritative/business state, not from stale local UI assumptions.

Examples:
- new applications exist → `Pregledaj prijave`;
- accepted participant / active Agreement → `Otvori Dogovor`;
- requester confirmation required → `Potvrdi završetak`;
- no action required → calm state, no fake urgency.

This does not remove governed actions such as cancel/problem/edit; it controls hierarchy and cognitive load.


## 7/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

When a card, row, or identity area has exactly one natural destination:
- the whole relevant target is tappable;
- do not add a redundant `Detalji`, `Otvori`, or `Profil` button for the same destination;
- keep separate visible controls only when they perform genuinely different actions;
- candidate/avatar/name identity may open the public/profile destination directly where authorized;
- touch behavior must remain accessible and unambiguous.

This reduces button clutter without hiding distinct actions.


## 8/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

Do not show a generic success popup/alert when the resulting screen or state already proves that the action succeeded.

Examples:
- application submitted → show the submitted state;
- participant selected → open/reflect Dogovor;
- task published → show active Zadatak;
- completion confirmed → show completed state.

A lightweight toast remains appropriate only when the outcome would otherwise be non-obvious, e.g.:
- copied;
- saved;
- notification preference changed.

The rule reduces friction and duplicate confirmation without removing necessary feedback.


## 9/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

Secondary, rare, destructive, administrative, and exceptional actions remain available but are progressively disclosed.

Rules:
- the default screen shows the current task and its primary action;
- `Otkaži`, `Prijavi problem`, optional edit/change actions and similar controls do not compete as equal permanent CTAs;
- use contextual rows, `Više`, bottom sheets, scoped menus, or state-triggered visibility where appropriate;
- if an exceptional action becomes the current required next step, it may temporarily become prominent;
- hiding clutter must never make a governed action impossible to find.

Goal:
show what the user needs now, not every capability the system has.


## 10/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

R02 and W02 AI interactions use one-question-at-a-time progressive clarification.

Rules:
- at each turn, ask only the single highest-value unresolved material question;
- do not re-ask facts already known/confirmed unless a contradiction or stale value requires clarification;
- do not expose a long questionnaire when conversational inference can reduce effort;
- optional facts must not block progress;
- the AI must choose the next question based on current confirmed/inferred/unclear/missing state.

Goal:
make AI feel like a capable assistant that understands context, not a disguised form.


## 11/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

### A. Radni profil is rich internal/canonical data
The AI conversation may collect and structure materially useful facts for:
- matching;
- recommendations;
- notification relevance;
- application readiness;
- work-area logic;
- vehicles/resources/tools/team context;
- service/skill categories;
- availability-related context;
- other governed worker facts.

The existence of a fact in the canonical Radni profil does **not** mean that fact is public.

### B. AI is the conversational profile editor
At any time the user may naturally ask:
- `Šta sve znaš o meni za posao?`
- `Šta mi fali?`
- `Šta nisi siguran?`
- `Dodaj ovo.`
- `Izmeni ovo.`
- `Obriši ovo.`
- `Šta će drugi videti na mom profilu?`

The server supplies current canonical profile truth to the AI.  
The AI must not rely on vague conversational memory as authority.

### C. Contradictions are clarified
If new input conflicts with current canonical facts:
- do not silently overwrite;
- ask one concise clarification question;
- confirmed replacement supersedes the old fact;
- technical history remains hidden from ordinary UI.

### D. Useful minimum, not 100% completion
The AI stops mandatory questioning when enough trustworthy data exists for useful/safe participation and matching.

Do not require exhaustive completion merely because database fields exist.

Additional facts can be added later through the same conversation.

### E. Public profile is a separate projection
Public profile is intentionally minimal and trust-oriented.

It does **not** automatically expose:
- all skills;
- all tools;
- all vehicles;
- internal matching facts;
- radius/preferences;
- private availability;
- AI confidence;
- internal reliability data.

Task-specific capability belongs primarily in the concrete Prijava when relevant to that Zadatak.

### F. Optional short public description
A short human-readable public description may be:
- optional;
- AI-proposed from confirmed facts/conversation;
- explicitly human-approved/edited before publication.

It must not invent praise or claims not supported by confirmed facts/reputation.

This lock separates:
`rich canonical Radni profil`
from
`minimal public trust profile`
from
`task-specific Prijava evidence`.


## 12/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02  
**Chosen direction:** `B — WARM DAWN / BRIGHTER URBAN USKOČI`

Final Entry/city visual direction:
- retain the recognizable city composition and USKOČI/U motion;
- materially brighten the scene versus the current dark/noir reference;
- warm ivory/cream atmospheric base;
- muted sage / teal urban structures;
- forest/deep-teal trust anchors;
- controlled orange for brand/action emphasis;
- premium, human, youthful and urban;
- avoid night-fintech / noir mood;
- avoid sterile all-white minimalism.

This lock changes the mood/lighting/color direction, not the already-established Entry functional timing/motion rules.


## 13/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

Signup is minimal and does not force a permanent role choice.

One account supports both modes.  
The user chooses only the current intent:
- `MENI TREBA` / task-oriented action such as `Dodaj zadatak` / `Treba mi pomoć`;
- `JA MOGU` / `Želim da radim` / browse tasks.

Do not ask for worker-profile inventory during signup. Worker facts belong to W02 when the user chooses to work.

---

## 14/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

W03 does not require a permanent search bar in V1.

Primary discovery:
- `Lista | Mapa`;
- meaningful filters;
- server-side matching/relevance;
- saved preferences/notification relevance where supported.

Search can be added later when real usage proves that free-text search materially improves discovery.

---

## 15/21 — OWNER RESOLUTION

**Decision:** `SUPERSEDED_NO_DECISION_REQUIRED`

R01/W01 Home surfaces are retired from the active destination model by L-006.

Therefore no separate "empty Home density" product decision remains.

---

## 16/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

V1 reviews are intentionally simple:
- 1–5 stars;
- optional short text comment;
- submitted after a completed Dogovor;
- public profile may show average rating, review count, completed Dogovor count and review content.

Do not introduce multi-axis rating forms in V1.

---

## 17/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

USKOČI V1 is `LIGHT-FIRST`.

Canonical UI direction follows the warm-dawn / brighter urban Entry lock:
- ivory/cream;
- sage/teal;
- forest trust;
- controlled orange.

A dedicated dark-theme implementation is not a V1 requirement.

---

## 18/21 — OWNER LOCK

**Decision:** `LOCKED_PRODUCT / PROVIDER_DEFERRED`

Product/map behavior is locked independently of provider choice:
- `Lista | Mapa`;
- task pins;
- clustering where needed;
- radius/distance behavior where relevant;
- REMOTE exclusions;
- location/privacy rules;
- USKOČI visual styling rather than default provider appearance.

Map provider selection remains an implementation-time engineering decision based on:
- Expo/RN support;
- Serbia coverage/quality;
- licensing/cost;
- performance;
- styling capability.

---

## 19/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

Dogovor has exactly two primary sections:

`Pregled | Poruke`

`Pregled` contains:
- what was agreed;
- parties;
- where/when;
- price/terms relevant to the viewer;
- status;
- current contextual next action.

`Poruke` contains communication.

Cancel/problem/change/completion/recovery do not become permanent extra tabs.

---

## 20/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

Existing L-007A/B/C/C.1 remain authoritative.

For multi-person Zadatak:
- requester + selected participants share one true group conversation;
- requester may privately communicate 1:1 with each participant;
- participants do not automatically gain private 1:1 messaging with each other;
- private prices/terms remain participant-specific;
- each participant retains an independent Agreement/status.

Membership boundary:
- when a participant is removed/cancels and their group membership ends, they lose access to **future** group messages;
- they retain previously legitimate conversation history where privacy/retention rules permit;
- do not fake group chat by duplicating messages into separate Agreement chats.

---

## 21/21 — OWNER LOCK

**Decision:** LOCKED — 2026-09-02

### Replacement / capacity recovery
If one selected participant cancels/is removed before completion:
- the same Zadatak reopens automatically;
- only the uncovered capacity/slot count is reopened;
- remaining Agreements are untouched;
- a replacement applies through the normal Prijava flow;
- no separate user-facing replacement subsystem is created;
- requester may choose `Ne traži više nikoga`.

For a one-person task, losing the only worker reopens the same Zadatak.

### V1 change model
Do not expose a heavy formal proposal/version workflow for routine changes in V1.

- accepted core terms remain the authoritative snapshot;
- minor operational clarifications may happen in Poruke;
- materially changed scope/price/terms must require an explicit governed confirmation path or a new Agreement rather than silent mutation;
- backend version/provenance mechanisms may remain internal even when the UI is simple.

### Completion / terminal state
- participant completion remains independent per Agreement;
- overall shared Dogovor becomes terminal when no relevant active work remains;
- terminal group conversation becomes read-only;
- review flow follows completion.

---

# OWNER REVIEW — COMPLETE

**21/21 resolved.**

There are no remaining open decisions in this reconstructed owner-review sequence.

This does not mean every implementation/provider/legal/release detail in the entire USKOČI program is closed.  
It means the specific reconstructed `1/21 → 21/21` owner decision pass is complete and ready to serve as current product canon.
