# PKG-011 — Slice 3: Prijave, public Task detail, application composer, candidates and public profile

Date: 2026-09-16. Base `ac1ec12` (slice 2). Presentation and navigation only; the application journal (PKG-006), selection session, viewed-state writes, RU4 resolve commands and every copy contract are unchanged. One agent, no subagents.

## What the user gets

- **Prijave** (JA MOGU personal workspace, `MyApplicationsPresentation`): header names the intent; tabs *Sve · Čeka te · Aktivne · Završene* as a real tab list with counts as badges (spoken label stays the tab name); each application is a scan block — status with tone (warm when the Task changed, green when selected, muted when withdrawn/closed) → Task → where/when → *Tvoja ponuda* with tabular price and a people pill → only the actions the state allows (*Pregledaj izmene* is the brand action of a changed Task, *Otvori Dogovor* strong ink, *Povuci prijavu* destructive text). Review of changed terms and the edit form keep every field and label; *Sačuvaj izmenjenu prijavu* is the brand action inside the form. Loading = skeleton with spoken status; empty = one brand action *Istraži zadatke*.
- **Public Task detail** (`PublicNeedPresentation`, `/prilike/[id]`): eyebrow = server status, hero card (HITNO, title, where/when, price in money green with a people pill, coverage), *Šta treba uraditi*, photos and Q&A as cards, *Mesto izvršenja* / *Uslovi* as rows with progressive disclosure, requester card with **Javni profil naručioca** (owner decision 3) opening the shared profile sheet over the existing `javniProfil` read, and one sticky brand action *Sastavi prijavu* only while the server accepts applications.
- **Public profile sheet** (`src/ui/system/PublicProfileSheet.tsx`, TARG-050 as presentation): avatar or initial, name, city, title, trust cells (rating with review count, completed Agreements, verified identity) shown strictly when the read marks them available, biography. Used from the public Task (requester) and from candidate selection (worker). Not yet reachable from Agreement participants or from Prijave: those projections carry account ids, not public profile ids — a **binding gap**, no new reader invented.
- **Application composer** (`ApplicationSelectionPresentation`): Task context card, *Tvoja ponuda* card (price locked and explained when the Task states a price), *Termin i poruka* card, footer with the offer summary in tabular figures and the one brand action (*Pošalji ovu Prijavu* / *Ponovi istu Prijavu* / *Proverite ishod* / *Otvori moje prijave*); interval editor as a sheet with the same fields.
- **Candidates** (owner decision 3, TARG-034): offer cards with state chip and price; *Uporedi* switches to a two-column comparison where price, people, term and self-declared capabilities sit in aligned cells; *Otvori prijavu: X* per column. Selection screen: identity with *Javni profil* (sheet), price, term, message, self-declared conditions card, warm review card before the one choice.
- `TaskQaEntry`, `NeedPhotos` moved to the shared system; `Segmented` gained optional count badges.

## Mobile behaviours decided here

| Area | Decision |
|---|---|
| Own task vs others' opportunity | Deferred: the requester who meets their own Task in *Istraži* still opens the public view; recognising ownership needs the own public profile id on the client (binding gap noted in slice 1). |
| CTA hierarchy | One brand action per screen state; in lists the per-card strong action is ink, the brand orange is reserved for the state that needs the owner's decision (changed Task) or the flow's send. |
| Public profile | Sheet over the current context rather than a route: keeps the decision (apply / choose) on screen; closes with one action; loading and unavailable states named. |
| Recovery | Unknown outcomes keep the frozen offer and offer *Proverite ishod*; the sheet drops a late profile from another account (existing guard). |

## Proof

- `my-applications-native`, `application-composer-read`, `application-selection-native`, `task-detail-screen`, `publication-screen`, `v5-tab-navigation`, `profile-hub`, `marketplace-owned-screens`, `pkg011-discovery-intent-transition` green; new `pkg011-slice3-presentation` (tabs/counts/actions per state, loading/empty, public Task hierarchy, requester profile sheet loading → facts → close, closed applications remove the brand action).
- System components no longer import reanimated (`src/ui/system/motion.ts` reads the OS reduce-motion preference through AccessibilityInfo), so route tests that isolate the animation runtime keep passing.
- `tsc` clean; full Jest recorded in the receipt.

## Next

Own Task detail (`/potrebe/[id]/pregled`) and the AI intake / review / location flow (owner-approved V5 conversation; presentation only), then the worker profile suite and shared settings.
