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

DONE_VERIFIED: PKG-001 (audit only), 002, 003, 004, 005, 006, 007, 008, 009, 010, 011.
MISSING_PROOF: PKG-013. BLOCKED: PKG-014 (needs 013 + owner batch approval), PKG-018 (provider).
PKG-012 is this package. NOT_STARTED: 015–017, 019–024. The Ledger, not this file, is authoritative.

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
