# USKOČI — current entry map (PKG-012, 2026-09-16)

This is the one current source/documentation authority for continuing work. Anything
that names itself "CURRENT", "FINAL STOP" or "EMERGENCY" with an earlier date is
historical and must not be read as a product instruction. CI checks the invariants
listed at the end (`scripts/ci/pkg012-source-authority.test.cjs`).

## Read in this order

1. `AGENTS.md` — repository rules, authority order, what never changes.
2. `docs/authority/AUTHORITY_INDEX.md` — owner commands and explicit supersessions.
3. `docs/implementation/execution/PACKAGE_RECONCILIATION_20260916.md` — the state of
   every V19 package against current source, Ledger and CI; the next package in order.
4. `docs/implementation/execution/EXECUTION_LEDGER.jsonl` — append-only receipts; the only
   place a package becomes DONE_VERIFIED (`EXECUTION_LEDGER_CONTRACT.md`).
5. `docs/implementation/v5-ai-first/OWNER_PRIVATE_TEST_DECISIONS_20260913.md` (AF-D19–26)
   and `docs/implementation/execution/pkg011/PKG011_OWNER_DECISIONS_20260916.md` — the
   owner's product decisions that bind the UI.
6. `docs/implementation/execution/pkg011/PKG011B_PREMIUM_UNUTRASNJOST_20260916.md` and
   `PKG011B_UX_PASS_20260916.md` — the design system now in force and the per-screen rationale.
7. The V19 plan itself is the owner's `USKOCI_MASTER_IMPLEMENTATION_PLAN_V19.md` (outside
   the repo; package definitions, gaps and topology only). Its snapshot is `45e0f31`.

## Historical, kept for evidence, never current instructions

| Document | Why it is historical |
| --- | --- |
| `HANDOFF.md`, `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `CURRENT_IMPLEMENTATION_STATUS.md`, `IMPLEMENTATION_CONTINUITY.md`, `NEXT_AI_HANDOFF_20260911_0504.md` | "CURRENT SAFE HANDOFF 2026-09-11": owner stop of 2026-09-11, superseded by the V5 resume and AF-D26. |
| `docs/implementation/v5-ai-first/EXECUTION.md` | Opens with the 2026-09-13 "FINAL STOP CHECKPOINT" and "EMERGENCY CHECKPOINT"; the package state now lives in the reconciliation and the Ledger. Its AF decision references stay valid through `OWNER_PRIVATE_TEST_DECISIONS_20260913.md`. |
| `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md` | Pre-handoff AGENTS, already marked historical. |
| `docs/implementation/evidence/**` | Exact-run evidence; preserved byte for byte, never edited. |

## Package state, one sentence

DONE_VERIFIED: PKG-001 (audit only), 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 014B, 015, 016.
BLOCKED: PKG-018 (AF-D04 model availability; the wire half of its provider diagnosis is answered by PKG-014).
PKG-012 created this map. The next package is PKG-017. NOT_STARTED: 015B, 017, 019–024. A new gap, GAP-0042, is
open and documented: synthetic acceptance data is not isolated from real users. The Ledger, not this file, is authoritative.

PKG-014 is verified on `7d897f7` with release-level PRE-P4 run 35151771679 bound to that exact candidate.
It changed live canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth` on 2026-09-16, so read it before
touching that project: migration ledger 149 rows (147 source + 2 dev_alpha operational), Edge
`uskoci-ai-interview` v36, `uskoci-worker-interview` v13 and `uskoci-account-closure-worker` v1,
all byte-identical to the committed tree. The closure worker is deployed but inert by design: no
enable flag, no cron, no executions. Two items carry over and neither blocks the next package. The
AI test budget holds 4 750 000 of 5 000 000 microUSD reserved, so one provider call remains and the ceiling is
deliberately not raised. PKG-014B captured provider usage on 2026-09-17, so the next real call will be the first with
recorded tokens; the 19 earlier calls have none and never will. One historical turn of `uskocibusiness@gmail.com` stays
`PROCESSING`, labelled `AWAITING_LEGITIMATE_ACCOUNT_SESSION` by owner decision of 2026-09-17: cancelling it
needs that account's own session, impersonation is forbidden, and it blocks no package. The exact
procedure for when the owner does sign in is in `docs/implementation/execution/AWAITING_LEGITIMATE_ACCOUNT_SESSION_20260917.md`.

## Legacy inventory after reachability review (no deletion in PKG-012)

| Item | Reachable from | Verdict |
| --- | --- | --- |
| `src/data/lazniIzvor.ts`, `src/data/lazniAi.ts` (fake source) | Only `src/data/index.ts`, and only under `EXPO_PUBLIC_USE_FAKE_SOURCE=1` or Jest. Production throws without Supabase config instead of falling back. Every mobile proof and the APK workflow set the switch to `0`. | Keep as an explicit DEV/test double. Never acceptance data. |
| `src/ui/v2/tokens.ts` (SPOJ V2 palette) | `src/app/(app)/pregled-nacrta.tsx`, `src/ui/aiFirst/ResponseDeadlineEditor.tsx`, `src/ui/media/AgreementPhotoComposer.tsx`, `src/ui/v2/icons.tsx` default colour. | Legacy dependency; migrate to `src/ui/system/tokens.ts` when those surfaces are touched. |
| `src/ui/v2/icons.tsx` (V2Icon), `src/ui/Button.tsx` | Five and one production importers; many route tests mock them. | Compatibility helpers; keep until their importers move to phosphor and V2Action. |
| `src/ui/referenceEntry/ReferenceEntryHero.tsx` | Only `CanonicalMark` is imported, by the tab layout. Its hero (with the `textShadow*` web warning) never mounts. | Brand asset; keep the mark, hero is dormant. |
| `src/app/(app)/pregled-nacrta.tsx` | Hidden tab route; reachable by URL and by the AI review recovery. | Retirement candidate for PKG-023, after parity with `/pregled-zadatka` and owner approval. Resolves explicitly today. |
| `src/app/prijave.tsx` | Redirect to `/` or `/auth?form=login`. | Kept deliberately (owner decision 5). Resolves explicitly. |
| `spojInboxArt` (SPOJ V2 illustration in `src/app/obavestenja.tsx`) | Inbox empty state. | Illustration asset; keep. |
| Google/Apple sign-in tiles | `src/app/auth.tsx`, hard-coded unavailable. | Owner decision 5: visible, disabled, no false success. |

Cleanup candidates counted by V18 (19 items, 0 retirement-eligible) belong to PKG-023 and stay
documented there; nothing here authorises deletion.

## Test simulations and exports

- Jest suites use isolated fixtures and Proxy-mocked React Native; no suite reads DEV.
- The disposable proof chain (`supabase/proofs/**`) runs only in CI against a throwaway database.
- The scratchpad web smoke (`.claude/launch.json`, untracked) is a developer tool: real DEV
  reads only with the `--real` flag, never with `CI=1`.
- Evidence exports under `docs/implementation/execution/evidence/` are written once per run and
  never rewritten.

## Invariants CI checks

1. The fake source is imported by `src/data/index.ts` only, behind the explicit switch.
2. The APK build workflow sets `EXPO_PUBLIC_USE_FAKE_SOURCE: '0'`.
3. Every historical entry document above carries the HISTORICAL banner pointing here.
4. `/pregled-nacrta` and `/prijave` still resolve explicitly (route file present, tab registration present).

PKG-015 and PKG-014B each added one DEV operational migration on 2026-09-17, `20260917053239_dev_alpha_pkg015_account_lineage`
and `20260917055559_dev_alpha_pkg014b_ai_provider_usage`, so the DEV ledger is 151 rows: 147 source migrations plus four
operational rows. Canonical source stays at 147 files. Every account on DEV now carries a recorded lineage, and every
new provider call records its token counts.

---

# State as of 2026-09-18

This section, not the sentences above it, is the current picture. The reading order, the
historical list and the CI invariants above are unchanged and still apply. Where this section and
an earlier paragraph disagree about package state, the Execution Ledger decides and this section
summarises it.

## Package state

DONE_VERIFIED adds, since 2026-09-16: **PKG-015B** (GAP-0042 closed), **PKG-017** (the shipped
build proven on real ARM64 hardware, closed by its second receipt after logout and relogin),
**PKG-019**, **PKG-019B**, **PKG-019C**, **PKG-019D** (the AI test budget settles, releases and
charges honestly), **PKG-021** (a saved draft can be reviewed for publishing again).

Not verified, deliberately:

- **PKG-020** — the voice path. Both provider defects are fixed and proven at the wire, and the
  owner has used speech on his phone, but the seven hand checks in
  `pkg020/PKG020_VOICE_DEVICE_CHECKLIST_20260917.md` have not been walked end to end.
- **PKG-022** — the conversation asks for the map point, shows what each turn took, carries the
  map inline, and the draft screen says why it cannot be published. Six items are open on its
  receipt; two of them only the owner can do.

**GAP-0042 is closed** on canonical DEV and remains a gate for any future production project.

## The two things only the owner can do

1. **Deploy `uskoci-ai-interview`.** Three prompt changes are committed and undeployed: address the
   person as ti, never promise a readiness the conversation cannot deliver, and offer photos once
   when the work calls for it. Deploying through the MCP tool means retyping a 42 KB entrypoint
   plus three dependencies onto the one feature that currently works, and the repository has no
   Actions secret, so CI cannot deploy either. Two CLI commands do it safely.
2. **Decide `dev-latest`.** It is still the only copy of the 2026-09-01 build, deleting it is
   irreversible, and the workflow still publishes it publicly from the canonical branch.

## Canonical DEV

The migration ledger is **157 rows: 147 source files plus 10 dev_alpha operational rows**, newest
`20260917230145_dev_alpha_pkg021_need_timestamp_fact_iso8601`. Canonical source stays at 147 files:
a `dev_alpha` change is recorded in `supabase/candidates/`, never added to `supabase/migrations/`,
because that directory is the frozen source-147 inventory the legal source-admission harness pins.
Adding a 148th file fails seven of its assertions, which is how this was learned.

Live shape: 31 public tables all with RLS, 78 policies, 151 RPCs callable by a user, 244 private
functions, 119 triggers, 12 Edge functions, one cron (`private.marketplace_tick`, every minute,
active).

## What the product has and has not done

The front half is proven: accounts, sessions and their boundaries on real hardware, the
conversation (62 conversations, 383 facts), speech, drafts, review.

The back half has never run with a person at either end, and the reason is one number: **no task
has ever had a confirmed map point**, so **no real account has ever published**. Every published
need, every response and both agreements belong to synthetic fixtures. Dispatch is not broken - it
runs every minute and has no input.

A probe on 2026-09-18 established what a first publication still needs, beyond the point itself:
the owner's business worker profile is `DRAFT` and `dispatch_cheap_candidate_admitted` requires
`ACTIVE`, and a future task also requires declared availability covering its window. Dispatch does
**not** filter on the worker's own coordinates, so the missing area point on every profile blocks
nothing.

## Design

The inner screens now speak one system. `ui/system/tokens.ts` is the direction the owner recorded;
`ui/v2/tokens.ts` and `ui/aiFirst/tokens.ts` are views onto it rather than copies beside it, which
resolves the legacy-inventory line above about migrating the V2 palette. `ui/Text.tsx`, which
colours every word in 64 files, drew text in the older forest ink while every surface around it was
built for the current one; it now takes its light tones from the system and keeps the dark ones for
the recovery screen and forest headers.

Entry, auth and the brand artwork keep their own palette by instruction, and this system never
restyles them.

**Only the measure has been unified. No screen has been recomposed.** The owner's standing
complaint - that the inside is cluttered and unarranged - is answered only in part; composition is
the next design step and needs his eye before any screen changes shape.

## Documents written on 2026-09-18

| Document | What it settles |
| --- | --- |
| `pkg017/PKG017_PHYSICAL_DEVICE_20260918.md` | The whole device acceptance, including logout and relogin |
| `pkg021/PKG021_PUBLISH_BLOCKER_ROOT_CAUSE_20260918.md` | Why every saved draft was unreviewable, proven at wire and source |
| `pkg022/PKG022_LOCATION_FUNCTION_AUDIT_20260918.md` | The location path audited as functions |
| `pkg022/PKG022_MAP_LAYER_AUDIT_20260918.md` | The map layer end to end, and which of its faults were mine |
