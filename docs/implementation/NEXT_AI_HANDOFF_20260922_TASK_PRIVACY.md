# USKOCI continuation — task privacy, 2026-09-22

Read the mandatory `NEXT_AI_HANDOFF_20260921_2145.md` first, then `AGENTS.md`,
`USKOCI_CURRENT_STATUS.md` and this supplement. This document records evidence; it grants no permission.

## Where work stopped

PKG-045 addresses deep-read finding 7.17. Stage A is proven and applied to canonical DEV.
Stage B is proven but **NOT applied**, and finding 7.17 remains open on DEV.

- Branch: `work/pre-v3-engine-integration-20260911` in the owner-designated canonical worktree.
- Proven implementation commit: `92f75b11eff966b16c1224a87ecfb60a198869b1`.
- DEV project: `leqcwgzvjsxugfgzdmth`; ledger **197 = 147 source + 50 dev_alpha**.
- A migration: `20260922093241_dev_alpha_pkg045a_task_read_contract`.
- Closure certificate remains `65980fce17030f1d8b34177b8989549c2144bf806478238af39dec04b137a591`.
  A asserted live equality and readiness atomically. Certified value was read back unchanged;
  direct private digest execution through the connector was not independently repeated.
- No marketplace row was changed. Broad authenticated SELECT intentionally remains until B.

## Implementation and evidence

A introduces explicit task documents and owner enumeration, and adapts the list/map, paged owner
reader and notification resolver. The client uses the new readers. Existing installed clients remain
compatible with A. B restricts the task table to 38 allowed columns, removes anonymous access and
updates five related-table owner predicates without changing their other conditions.

**Table ACLs participate in the closure erasure-program digest.** B therefore includes the isolated
inverse/rebind method proved in PKG-032b / PKG-023f. Do not mistake a column permission change for a
certificate-neutral operation. B needs fresh explicit owner approval and verified compatible APK rollout.

- [Disposable proof 35710468643](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35710468643)
  passes 17 SQL/Auth/REST/actual-client checks, 355 offline Edge tests, 108 focused client tests,
  types and tracked source-147 integrity. Real disposable account erasure reaches CLOSED after
  75 worker calls, erases the draft/private address and soft-deletes Auth under the new certificate.
- Local types and full Jest: **242 suites / 4,687 tests pass, process exit 0**.
- Candidate A SHA256, excluding the final newline:
  `a8aff72039f283683c630f99f211e0c40356951f3c353b872cc8b7af8c5032c3`.
- Candidate B SHA256, excluding the final newline:
  `3c5b1aae60358d588c3e01907d4adca27f89b806d61d7a3d4f7a9b3c65ce018b`.
- A ledger text and all six function bodies/ACLs/security modes/search paths match the proof.
- Records: `v5-ai-first/pkg045/PKG045_TASK_COLUMN_PRIVACY.md`, `PROOF_35710468643.json`,
  `APK_RECEIPT_20260922.json`, and
  `supabase/operations/dev-alpha/ledger/20260922_pkg045a_application.receipt.json`.

## Owner decisions pending — silence is not approval

Two asynchronous questions were sent and had no answer when this handoff was written:

1. Approve only pkg045b on DEV, including closure-certificate rebinding, after compatible phone rollout?
2. Ready at the USB phone for a non-destructive APK update, and is this the only test phone?

If approved and ready, first install the verified APK with data preserved, verify actual task reads
and account for every active test device. Only then perform fresh canonical preflight and apply the
exact proven B candidate. Record the actual new ledger and certificate; disposable digest values
are not predicted canonical values. If either gate is pending, leave B unapplied.

## APK state

- [Build 35707463751](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35707463751), source `05fa7232`.
  Client source is unchanged through the proven implementation commit.
- `artifacts/apk-35707463751/USKOCI-DEV.apk`, 68,553,855 bytes.
- SHA256: `ed69c7ae86862153119604ec490543e10e543e76d18cd81cc8e714902cfb85d2`.
- Downloaded checksum, source/tree and both recovery/icon attestations match. **Not installed.**
- Previous installed APK is build 35698097121; A supports it.

## Remaining boundaries and separate work

Work solo. Never touch secrets, use paid AI calls, create DEV fixtures or delete real data. Never
uninstall/clear the phone. Speech needs explicit readiness. No new dependencies, force-push, new PR,
CodeQL changes, repair branch, or pkg023c. The foreign untracked SQL file in the frozen migrations
directory remains untouched and uncommitted; local inventory fails on that 148th file, CI source-147 passes.

PKG-014B run 35704252850 separately fails a source manifest fingerprint left stale by earlier AI
changes; its 355 offline tests pass. This was observed, not fixed by PKG-045. Do not claim all CI green.

Next independent engineering areas are closure recovery on a second device, remaining business-refusal
wiring and bounded Home previews. Follow `APP_FINISHING_PLAN_20260922.md`; do not replace technical
completion with an app-wide visual redesign. Major visual changes require the owner's three distinct
composition exploration and preservation of functional truth and the unified Home.

AI intake 50 is unchanged in this package. The owner reports warmer/better conversation; this is
feedback, not a comprehensive model-quality evaluation. No provider call was made for PKG-045.
