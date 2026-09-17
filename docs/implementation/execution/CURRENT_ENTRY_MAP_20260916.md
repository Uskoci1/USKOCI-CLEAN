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

DONE_VERIFIED: PKG-001 (audit only), 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 014B, 015.
BLOCKED: PKG-018 (AF-D04 model availability; the wire half of its provider diagnosis is answered by PKG-014).
PKG-012 created this map. The next package is PKG-016. NOT_STARTED: 016–017, 019–024. A new gap, GAP-0042, is
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
