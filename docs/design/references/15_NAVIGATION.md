# 15 — NAVIGATION

**Product problem:** Use both intentions in one account and return predictably.

**Surface:** Global navigation. **Priority:** P1. **Design state:** RESEARCH; no approved composition.

## Evidence status

6 inspected records; 6 eligible records from 4 independent sources (Airbnb, Apple, Banani, Google). Numeric 5/3 minimum: **MET — still needs surface review**. Coverage is explicitly partial; do not infer completed gesture, error or full-flow testing.

## Inspected references

- [R01 — Airbnb home via Banani](EVIDENCE_CATALOG.md#r01) · real product screenshot · HIGH. [Source](https://www.banani.co/references/screens/airbnb-home-screen).
- [R03 — Airbnb 2025 product release](EVIDENCE_CATALOG.md#r03) · real product documented flow · MEDIUM. [Source](https://news.airbnb.com/airbnb-2025-summer-release).
- [R04 — Apple Tab Bars](EVIDENCE_CATALOG.md#r04) · guideline · HIGH. [Source](https://developer.apple.com/design/human-interface-guidelines/tab-bars).
- [R05 — Apple Onboarding](EVIDENCE_CATALOG.md#r05) · guideline · HIGH. [Source](https://developer.apple.com/design/human-interface-guidelines/onboarding).
- [R28 — Apple navigation presentation](EVIDENCE_CATALOG.md#r28) · guideline · MEDIUM. [Source](https://developer.apple.com/videos/play/wwdc2022/10001/).
- [R29 — Material 3 navigation bar](EVIDENCE_CATALOG.md#r29) · guideline · HIGH. [Source](https://m3.material.io/components/navigation-bar/overview).

All required observation, benefit, weakness, no-copy and translation fields are recorded once in the linked catalogue.

## Synthesis constraints

Destinations remain stable across intentions. Create is an action. Preserve deep links and return paths even if the visible presentation changes radically. Android Back and keyboard behavior are first-class.

## Evidence still required before the relevant detailed design

A live multi-intent marketplace transition sequence with Back and retained browsing context.

## Comparison protocol

Write responsibility first; gather missing evidence; produce three genuinely different compositions; compare clarity, speed, reach, trust, accessibility, scalability, implementation realism and brand character. Only then evaluate any retained legacy visual pattern. Record approval with Figma node IDs and state scope. No production implementation in this phase.
