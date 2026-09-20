# 14 — AVAILABILITY

**Product problem:** See and edit real working intervals, exceptions and invitation readiness.

**Surface:** Availability calendar. **Priority:** P2. **Design state:** RESEARCH; no approved composition.

## Evidence status

5 inspected records; 5 eligible records from 4 independent sources (Apple, Banani, Google, Taskrabbit). Numeric 5/3 minimum: **MET — still needs surface review**. Coverage is explicitly partial; do not infer completed gesture, error or full-flow testing.

## Inspected references

- [R08 — Apple Sheets](EVIDENCE_CATALOG.md#r08) · guideline · HIGH. [Source](https://developer.apple.com/design/human-interface-guidelines/sheets).
- [R09 — Material 3 bottom sheets](EVIDENCE_CATALOG.md#r09) · guideline · HIGH. [Source](https://m3.material.io/components/bottom-sheets/overview).
- [R23 — Taskrabbit availability](EVIDENCE_CATALOG.md#r23) · real product documented flow · HIGH. [Source](https://support.taskrabbit.com/hc/en-gb/articles/46260534523163-How-Do-I-Set-My-Availability).
- [R24 — Airbnb date selection via Banani](EVIDENCE_CATALOG.md#r24) · real product screenshot · HIGH. [Source](https://www.banani.co/references/screens/airbnb-booking-calendar).
- [R25 — Things 3 upcoming via Banani](EVIDENCE_CATALOG.md#r25) · real product screenshot · HIGH. [Source](https://www.banani.co/references/screens/things-upcoming).

All required observation, benefit, weakness, no-copy and translation fields are recorded once in the linked catalogue.

## Synthesis constraints

Distinguish recurring intervals, exceptions and accepting invitations. Preserve civil-time/zone semantics and explicit saving. Empty schedule cannot silently mean available all day.

## Evidence still required before the relevant detailed design

Recurring week and exception editing in another service marketplace; saved/unsaved behavior.

## Comparison protocol

Write responsibility first; gather missing evidence; produce three genuinely different compositions; compare clarity, speed, reach, trust, accessibility, scalability, implementation realism and brand character. Only then evaluate any retained legacy visual pattern. Record approval with Figma node IDs and state scope. No production implementation in this phase.
