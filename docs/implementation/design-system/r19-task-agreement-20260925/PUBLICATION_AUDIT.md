# Publication and local-only inventory — 2026-09-26

Read-only publication audit requested by the owner. This does not apply any server package or establish whole-app acceptance.

## Current integrated source

- Local HEAD and a fresh `git ls-remote` for `work/uskoci-ui-unification-20260924` both equal
  `b5a82f69c8d646fe683f4a2a0bda94b168587281`. The integration checkout is clean before this audit document.
- This includes the latest viewport/client safeguards, tests, control data and R19 evidence reports.
- APK workflow `36225404482` targets that exact source; it was still in progress at the publication check.
  A later result or installation must be recorded separately.
- Ignored generated entry assets and `src/ui/referenceEntry/entryReferenceData.ts` are produced by the tracked
  `scripts/sync-entry-reference-assets.cjs` from the tracked canonical reference HTML through `postinstall`.
  `node_modules` and generated control HTML are also intentionally ignored.

## Historical working copies

All 27 registered worktree directories exist; none are marked prunable. The original
`uskoci-kompletan-audit-2e715e` is clean at `aa71278c`, an ancestor of the integrated source.
`work/uskoci-html-native` is clean at `88af02e8`, and a fresh remote check confirms that source is on
`work/ai-reservation-unblock-20260920`. Its nine non-ancestor commits are not proof of missing behavior;
their semantic incorporation into the integration branch was not checked in this inventory.

Six uncommitted source paths exist in three old Claude worktrees:

| Worktree | Local source paths |
| --- | --- |
| `wf_3c00f8f3-78a-11` | modified `src/ui/settings/SettingsPresentation.tsx`; untracked `src/lib/trenutak.ts` |
| `wf_3c00f8f3-78a-12` | modified `src/ui/system/PickerTile.tsx`, `src/ui/workerProfile/workerProfileDraft.ts` |
| `wf_3c00f8f3-78a-9` | untracked `src/ui/privacy/InlineNote.tsx`, `src/ui/privacy/PrivacyPresentation.tsx` |

Do not blindly merge or publish these old files over current code. Different historical bytes do not prove a
missing feature. Twelve registered worktree HEADs are not ancestors of the integration source; ancestry alone
does not determine whether later refactoring already includes their work.

A follow-up comparison finds all six paths present in the integrated source. `trenutak.ts` is byte-identical;
`workerProfileDraft.ts` is source-identical after Git line-ending normalization. The other four paths differ.
Thus there are two duplicate source files, four different historical versions and zero missing paths; semantic
reconciliation of the four differences remains open.

Subsequent bounded semantic review against 817b15f2 closes that four-file question: all old Settings controls,
PickerTile selection/accessibility/responsive behavior, InlineNote tones/alerts and Privacy loading/error/policy
and export/closure actions remain in current source. The remaining differences are superseded presentation.
No concrete missing functionality was found; no old file was imported. This does not audit all historical branches.

The explicitly forbidden `20260913090000_clean_v5_fix_application_spam_and_resolution.sql` remains physically
present, untracked and ignored in the original audit worktree. It was not committed or applied by this audit.

## Local supporting material

The outer Codex workspace is not a Git repository. Its `outputs/` contains screenshots, full logs, downloaded
APKs, HTML explorations and helper scripts. These are not all published. R19 reports, capture manifests and
check receipts are tracked, but that does not imply every referenced PNG/full log is in GitHub. Built APKs are
also stored by their GitHub Actions runs subject to artifact retention. This is not a complete off-machine backup
of all design/research/debugging material. The private Claude dashboard import remains unconfirmed.

## Canonical DEV

Fresh read-only queries confirm 202 ledger rows: 147 source + 55 dev_alpha. Latest migration remains
`20260924202023_dev_alpha_pkg051a_platform_price_list`. The Edge catalog lists 11 ACTIVE functions.
This is catalog evidence, not fresh byte comparison of every deployed function or a private closure-certificate check.

Recent R19 changes are client code and do not require a Supabase deployment. Nothing was applied to DEV in this
audit. GitHub publication does not deploy a candidate SQL file or Edge function. Further backend candidates require
the owner's explicit `primeni` under the current instructions.

Conclusion: the current integrated implementation is on GitHub; "every historical local artifact/change is
published and everything is deployed to Supabase" would be false.
