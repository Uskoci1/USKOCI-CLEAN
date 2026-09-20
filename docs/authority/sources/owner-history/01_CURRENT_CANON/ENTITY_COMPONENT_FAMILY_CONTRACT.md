# USKOČI — FINAL ENTITY / COMPONENT FAMILY CONTRACT

## Purpose

The RN implementation must look and behave like one product. Shared business facts use shared visual/interaction primitives, while different projections keep task-appropriate hierarchy.

## Zadatak family

Canonical fact order when available:
1. Šta
2. Cena / offer model
3. Kada
4. Gde / ruta / online
5. Ljudi / critical conditions

Shared primitives:
- `ZadatakFactRow / FactGrid`
- `StatusBand`
- `Identity/TrustStrip`
- `SmartNextAction`

Projection families:
- R02 live AI Zadatak: editable/in-progress conversational projection; not canonical public truth.
- R07 Human Review: same fact language + explicit edit affordance; saves canonical DRAFT.
- R03 Own Zadatak Card: lifecycle/attention → title → key context → next action.
- W03 Opportunity Card: status → title → price → geography/time/people → requirements; same anatomy in List and Map focus.
- W05 Zadatak Mini: compact context for creating/viewing a Prijava.
- R04/W04 full detail: same fact language with authorization-specific visibility.
- D02 Accepted Terms: locked viewer-appropriate projection of the accepted Agreement snapshot.

Do not make one universal generic card. Share primitives and semantic identity, not every layout.

## Prijava family

Requester variant R05:
1. candidate identity
2. exact submitted offer/price
3. covered slots / availability
4. task-relevant evidence/trust
5. selection state/action

Worker variant W06:
1. Zadatak identity
2. submitted terms
3. current Prijava status/staleness
4. next action

Multi-select coverage UI may show aggregate coverage, but selection still creates independent participant-specific Agreement snapshots under one shared task-centered Dogovor.

## Profile family

Shared `ProfilePassport` identity grammar:
- avatar/fallback
- name
- coarse location
- only actually verified claims
- reputation derived from completed Dogovori/reviews

R06 public profile is minimal trust, not a public dump of canonical Radni profil.
W08 is the user's work-profile hub; W02 is conversational editing/activation.

## Dogovor family

All D01/D02/D03/D05/D06 share one `DogovorContext` identity component.
For a multi-person task, the masthead is task-centered and must not pretend that one participant is the entire Dogovor.
Viewer-specific private price/terms are shown in an explicitly private participant Agreement section.

Local navigation remains exactly:
`Pregled | Poruke`

### Pregled
Contains:
- shared Zadatak context;
- roster visible to authorized viewer;
- viewer-relevant participant Agreement/status;
- accepted terms snapshot;
- exact location/contact only when authorized;
- embedded chronology;
- one contextual next action when required.

### Poruke
Must support channel context without creating extra primary tabs:
- `Grupa` — requester + active selected participants;
- requester-only private channel selector for each participant;
- a worker sees Group plus their own private requester channel where authorized;
- participant↔participant private channel is not created by default.

Membership-ended participant:
- future group messages denied;
- old legitimate history governed by membership interval + retention/privacy;
- composer disabled when no longer a current member or when shared Dogovor is terminal.

Do not bind final D03 directly to legacy `rpc_send_agreement_message` as the product authority. Legacy Agreement chat is migration/donor evidence only once task-centered messaging lands.

## Status grammar

Semantic variants:
- neutral/draft
- active
- attention
- pending
- success/completed
- warning/problem
- danger/cancelled
- stale

Color is never the only signal. Do not expose raw backend enum names.

## Buttons

- Primary / orange: one current next action.
- Secondary / forest: important but not dominant.
- Outline/Ghost: optional/navigation/supporting action.
- Danger: destructive confirmation only.

Whole-card tap replaces redundant detail buttons when destination is singular.

## Navigation

MENI TREBA: `Zadaci | U/Novi | Dogovori`.
JA MOGU: `Prijave | U/Zadaci | Dogovori`.
Shared top: bell + avatar.

## Accessibility

- interactive hit targets >= 44×44; target 48 where practical;
- primary controls around 52–54 height are preferred;
- no color-only state;
- dynamic text must remain legible;
- reduced-motion path required;
- focus/accessibility labels required for icon-only controls.
