# PKG-011 — UI replacement plan (derived from the read-only master, 2026-09-16)

Scope rule (owner, 2026-09-16): keep the verified engine and every state owner; rebuild presentation and navigation only; anything that would change product semantics, writers, RPC/Edge/Storage contracts, permissions/actionState, lifecycle, session rules, idempotency, security or data ownership is not done here but raised as a UX/product gap with a minimal proposed correction. No V9 input. Nothing below is started before the owner reviews `PKG011_FLOW_FIRST_RECONCILIATION_20260916.md` §5.

## Principles for every flow

1. Extract or reuse the existing state owner first (`useOwnedEditor`, controllers, journals, session objects), then replace the presentation component that consumes it. New presentation receives the same props/state and calls the same command functions; no new writer per screen, no parallel route.
2. Parity proof before and after (V19 PKG-011 test): the existing route/UI suites keep passing unchanged where they assert behaviour; new presentation-only suites assert the same actions/copies/states; a pending command must survive remount (journal restore) exactly as today.
3. Accessibility plan per rebuilt surface (UX-004): 200% text without clipping of primary actions, screen-reader labels/roles/states, reduced motion honoured; disabled/loading/empty/error/unknown states visible and distinct (UX-002/003).
4. One dominant action per screen (UX-005), grouped secondary controls, no backend jargon in copy (existing Serbian copies stay as the contract; only layout/grouping changes unless a copy is a defect).
5. Old surface becomes a removal candidate only after parity and explicit owner approval; hidden routes keep their URLs.

## H. Presentation can be rebuilt now (no engine change, no live-binding dependency)

Ordered by dependency safety (state owner already separated from presentation; no PKG-014 dependency on the primary command; direct or module tests exist):

1. **Discovery list/map + owned tasks** — `/potrebe`, `/prilike`, `/mapa` via `ui/v2/MarketplacePresentation`, `TaskCard`, `DiscoveryMap` (state: `useFocusedResource`, `marketplaceView`). Owner decision 1 (center zone) must be settled first because it changes tab labels/targets, not the engine.
2. **Agreements collection** — `/dogovori` via `ui/v2/AgreementCollectionPresentation` (V19 REPL-085).
3. **Agreement workspace** — `/dogovor/[id]` presentation modules `ui/v2/AgreementPresentation` (hero/people/section/tabs) and `ui/AgreementChat` (V19 REPL-032/041); state owners `DogovorContent`, `useAgreementOutbox`, `useAgreementPhotos` untouched.
4. **Agreement changes, location, group** — `/dogovor/[id]/izmene`, `/dogovor/[id]/lokacija`, `/dogovor/[id]/grupa` screens consume their controllers (REPL-037); presentation only.
5. **Review** — `/oceni-dogovor` (already close to premium; polish only).
6. **My applications** — `/moje-prijave` via `ui/v2/MyApplicationsPresentation`.
7. **Public task detail + application composer** — `/prilike/[id]` (`PublicNeedPresentation`, REPL-021) and `/prilike/[id]/prijava` (`ApplicationSelectionPresentation`); journal and session logic untouched.
8. **Own task detail + candidates** — `/potrebe/[id]/pregled` (`NeedPresentation`, `NeedLifecycleActions` kept) and `/potrebe/[id]/kandidati` (`CandidateList/SelectionPresentation`, REPL-025); TARG-034 comparison view only if the owner approves (decision 3).
9. **AI intake and review** — `/nova` (`IntakePresentation`, `VoiceComposer`, REPL-078/098), `/novi-zadatak`, `/pregled-zadatka` (sections/footer), `/mesto-zadatka` (`LocationScreen`/`NeedLocationForm`); OwnedIntake/ReviewedTask logic untouched.
10. **Worker profile suite** — `/profil/radnik` (`WorkerProfilePresentation`, REPL-012), `/profil/razgovor` (`AiConversationShell`, `WorkerAiPresentation`, REPL-004), `/profil/lokacija`, `/profil/dostupnost` (`AvailabilityForm`), `/raspored` (REPL-014 scope copy).
11. **Profile hub and shared settings** — `/profil`, `/profil/podaci`, `/profil/fotografija`, `/profil/obavestenja` (`PushPreferences`, REPL-044), `/obavestenja` (REPL-043), `/bezbednost`, `/profil/blokirani`, `/podrska/*` (REPL-051), `/profil/izvoz`, `/profil/pravna` (REPL-057), `/profil/o-aplikaciji` — all on `ui/settings/SettingsPresentation`; a new premium settings/list system replaces it in one pass.
12. **Owner-locked, not rebuilt**: `/auth`, entry composition, HOME/mascot (V5 lock); only a11y defects.

## I. Binding / recovery must come first (or wait for another package)

- `/rucni-zadatak` — primary command `rpc_set_manual_need_fact_v2` is a candidate (PKG-003 proven in the disposable DB), not live → PKG-014 promotion before any manual-entry presentation work is meaningful on DEV. Presentation can still be designed, not shipped as "working".
- `/fotografije-zadatka` — upload/read/remove are live; cancellation of an unconfirmed upload depends on the PKG-008 candidate → PKG-014.
- `/pitanja-zadatka` — QA owner activation (147) not live → live denials; PKG-014.
- `/profil/privatnost` (closure execution) — 146 + `uskoci-account-closure-worker` not live → PKG-014; client already fails closed.
- `/pregled-zadatka` — identity-requirement handling (145) not live; presentation may proceed, but the identity-unavailable branch cannot be device-proven before PKG-014.
- Recovery items already fixed in verified packages (PKG-003/004/006/007/008) need no rework; GAP-0025 (draft deletion recovery when the Need disappears) is a verified PKG-004 receipt — re-check only during parity tests.

## J. Legacy / retirement candidates (conditions, no deletion in PKG-011)

| Item | Kind | Retirement condition |
|---|---|---|
| `/pregled-nacrta` (SCR-018, REPL-092) | unreachable legacy route | parity proof that `confirmFact`/`correctFact`/`saveDraft`/`confirmEdit` paths are covered by `/nova` + `/pregled-zadatka`; tests moved; owner approval |
| `/prijave` (root redirect, REPL-029) | retired URL compatibility | no push/deep-link target uses it (inbox targets never do) |
| `aiCommandOverrides` / `aiProductionOverrides` / `productionAuthorityOverrides` (REPL-093/015) | composed legacy adapters | consumer/ACL proof that no surface reaches `rpc_ai_publish_need` / legacy projections |
| `supabaseIzvor` baseline reads (REPL-018/039) | adapter | single public eligibility DTO + strict decoders per V19; keep until then |
| Google/Apple `MethodButton` placeholders on `/auth` | presentation of unavailable methods | owner decision (hide vs keep "trenutno nije dostupno") |
| `pregled-nacrta` non-uuid request ids (`Date.now()+Math.random()`) and `src/lib/idempotencija.ts` `Math.random` fallback | CodeQL js/insecure-randomness (pre-existing, PR #102) | small dedicated fix with owner approval (crypto random), outside PKG-011 UI scope |

## Dependency-safe order (proposed, not locked)

The master does not support pre-locking "Prijava → Izbor → Dogovor". The safest order by (a) separated state owners, (b) live backend, (c) shared components that unlock several screens, (d) tests present:

1. Owner decisions §5.1–5.5 of the flow document.
2. Shared premium primitives (typography/spacing/surface tokens, list/settings system, bottom action bar) proven on `/dogovori` and `/potrebe`/`/prilike` (MarketplacePresentation) — both read-only surfaces with tests.
3. Dogovor workspace + chat (highest daily use, all live, PKG-007 verified actionState).
4. Moje prijave, public task detail, application composer (PKG-006 verified journal).
5. Own task detail, candidates (+ optional comparison view).
6. AI intake/review/location (owner-approved V5 conversational experience; presentation only).
7. Worker profile suite.
8. Shared settings surfaces in one pass.
9. Deferred until PKG-014 promotion: manual entry, photo cancellation, Q&A, closure.

## Required proof per rebuilt surface (V19 PKG-011)

- Before/after behaviour parity: existing suites green; snapshot of actions, copies and states; pending command remount test (journal restore) where a journal exists.
- 200% text / screen reader / reduced motion plan executed on the exact candidate (local + CI where possible; device acceptance stays in PKG-017/021).
- Supported disabled/loading/empty/error/unknown states asserted.
- Each surface's receipt names the untouched state owner and the replaced presentation module; DONE_VERIFIED only on the exact candidate with the pre-fix (before) witness.

## Progress

- 2026-09-16 — Owner decisions 1–5 recorded (`PKG011_OWNER_DECISIONS_20260916.md`); production UI authorized.
- 2026-09-16 — Slice 1 delivered (`PKG011_SLICE1_ZADACI_DOGOVORI_20260916.md`): coherent token system, Zadaci/Mapa list+map presentation, TaskCard, Dogovori collection and Agreement hero tokens, tab bar, explicit intent transition (decision 2) on `/prilike` and the inbox. Order steps 1–2 done, step 3 (Dogovor workspace + chat) next.
- 2026-09-16 — Slice 2 delivered (`PKG011_SLICE2_DOGOVOR_WORKSPACE_20260916.md`): Dogovor workspace (next-step card, rows, one brand action per state), chat, changes/location/group screens, review. Order step 3 done; step 4 (Moje prijave, public Task detail, application composer) next.
- 2026-09-16 — Slice 3 delivered (`PKG011_SLICE3_PRIJAVE_ZADATAK_KANDIDATI_20260916.md`): Prijave, public Task detail with requester public profile sheet, application composer, candidates with comparison, shared PublicProfileSheet (owner decision 3). Order steps 4–5 done except the own Task detail; step 6 (AI intake/review/location) next.
- 2026-09-16 — Slice 4 delivered (`PKG011_SLICE4_ZADATAK_KREIRANJE_20260916.md`): own Task detail, New Task chooser, location controls/form, lifecycle panel, manual entry grouped into cards. V5 conversation and review left as approved. Order step 5 complete, step 6 done except the approved V5 screens; step 7 (worker profile suite) next.
- 2026-09-16 — Slice 5 delivered (`PKG011_SLICE5_RADNI_PROFIL_20260916.md`): worker profile, AI proposal panels, availability/calendar controls, schedule, work area. Order step 7 done.
- 2026-09-16 — Slice 6 delivered (`PKG011_SLICE6_DELJENA_PODESAVANJA_20260916.md`): shared settings system and every account surface built on it (hub, data, avatar, notifications, safety, support, export, privacy/closure, legal, about, Task photos, Q&A). Order step 8 done. Remaining: PKG-014-dependent live proofs (step 9), device/a11y acceptance, package receipt.
