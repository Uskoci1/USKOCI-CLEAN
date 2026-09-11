# USKOČI — CURRENT PRODUCT CANON

## 1. Mental model

The user-facing system is:

`Zadatak → Prijava → Dogovor`

Do not return ordinary UI copy to `Potreba`, `Prilika`, `Naručilac` or `Uskočer` as primary product language.
`Radni profil` is the canonical work-profile term.

## 2. Account and modes

One account supports both ways of using USKOČI.
The user chooses current intent, not a permanent account role:
- `MENI TREBA`
- `JA MOGU`

## 3. Primary navigation

MENI TREBA:
`Zadaci | [U = Novi] | Dogovori`

JA MOGU:
`Prijave | [U = Zadaci] | Dogovori`

Global secondary entries:
- bell → S06 Inbox
- avatar → current profile hub

S05 / R01 / W01 are retired from the active destination model.

## 4. Interaction grammar

- exactly one visually dominant next action when server-authoritative state has one clear next step;
- no fake primary CTA when nothing is required;
- whole card/row/identity area is tappable when it has one natural destination;
- no redundant Details/Open/Profile button for the same destination;
- generic success modal is removed when resulting state already proves success;
- secondary/destructive/rare actions use progressive disclosure.

## 5. AI authority

Canonical authority flow:
`AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED`

AI asks exactly one highest-value unresolved material question at a time.
Known facts are not re-asked without a contradiction/staleness reason.
Contradictions are clarified, not silently overwritten.

R02 final flow:
`AI conversation → R07 Human Review → canonical DRAFT → R04 workspace/publish`

No direct public publish from R02.

## 6. Radni profil

Internal canonical Radni profil can be rich for matching/recommendations/readiness.
Public profile is a separate minimal trust projection.
Concrete Prijava carries task-specific evidence and terms.

Worker activation is useful-minimum, not “fill every database field”.
Final server minimum remains governed by the readiness contract (name/city/skill minimum in current P0 plan), while UX can collect additional facts conversationally.

## 7. Marketplace

W03 final behavior:
- `Lista | Mapa` only;
- same underlying dataset/projection;
- meaningful filters;
- server relevance/matching;
- no permanent search field in V1;
- REMOTE tasks do not produce physical map/radius behavior;
- exact location stays private.

## 8. Reviews

V1 review:
- 1–5 stars;
- optional short text;
- after a completed Dogovor.

Public trust may show average, count, completed Dogovor count and review content.
No multi-axis V1 rating form.

## 9. Dogovor

Visible shell is exactly:
`Pregled | Poruke`

Hronologija is embedded in Pregled.
Change/problem/cancel/completion/recovery are contextual actions, not permanent tabs.

Accepted core terms remain an authoritative snapshot.
Minor operational clarification may happen in Poruke.
Material scope/price/terms changes require explicit governed confirmation or a new Agreement; never silent mutation.

## 10. Multi-person Dogovor

For a task needing multiple independent people:
- requester + selected active participants share one real task-centered group conversation;
- requester may privately message each participant 1:1;
- participants do not automatically get private participant↔participant channels;
- participant-specific prices/terms remain private;
- each participant has an independent Agreement/status.

Membership is time-bounded.
When participant membership ends, future group-message access is denied.
Previously legitimate history may remain available where privacy/retention permits.
Never fake a group chat by duplicating messages into separate Agreement chats.

## 11. Cancellation / capacity recovery

If a selected participant cancels/is removed before completion:
- same Zadatak reopens automatically;
- only uncovered capacity is reopened;
- remaining Agreements are untouched;
- replacement applies through normal Prijava;
- requester may choose `Ne traži više nikoga`;
- no separate user-facing replacement subsystem.

## 12. Completion

Participant completion is independent per Agreement.
The shared Dogovor becomes terminal when no relevant active work remains.
Terminal group conversation becomes read-only.
Review follows completion.

## 13. Location/privacy

- public location = coarse;
- exact location = private;
- REMOTE = no map/radius/routing;
- near-me current GPS should be transient;
- no background tracking without a new explicit owner decision.

## 14. Visual direction

V1 is LIGHT-FIRST.
Warm Dawn / brighter urban:
- ivory/cream;
- muted sage/teal;
- forest/deep-teal trust;
- controlled orange;
- premium, human, youthful, urban and readable;
- avoid dark/noir fintech mood;
- avoid sterile all-white UI.


---

## IMPLEMENTATION-READY ADDENDUM — 2026-09-03

Read `OWNER_IMPLEMENTATION_CLOSURE_2026-09-03.md` as the latest compatible owner implementation closure.

Additional V1 locks:
- public structured anonymous preselection Q&A is embedded in R04/W04; no unrestricted preselection chat;
- public Q&A blocks contact/exact private geography/off-platform coordination and uses server-final policy admission;
- material clarification answer enters normal Zadatak revision/readmission;
- V1 platform monetization is operationally FREE/0 RSD; no payment provider required for V1;
- V1 map stack is `react-native-maps` + Google Maps SDK behind MapPort, with `expo-location` behind LocationPort;
- V1 push stack is `expo-notifications` + Expo Push Service behind server event/delivery ownership;
- D-0140 architecture is implementation-ready but production policy activation remains fail-closed until reviewed policy bundle exists;
- three previously open command/event bindings are closed in the current machine matrices.
