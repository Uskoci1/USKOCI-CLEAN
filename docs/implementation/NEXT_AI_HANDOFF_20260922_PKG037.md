# Continuation after PKG-037 — 2026-09-22

Supplement to mandatory `NEXT_AI_HANDOFF_20260921_2145.md`, AGENTS and the deep-read ledger.
It does not expand permissions. Work solo in the same canonical worktree and branch.

## Completed slice

- PKG-037 addresses publication review finding 11.2, not interview/worker/Q&A finding 11.1.
- Source `2d6f0bc5e3751ceb12748db8d8fffdad11794f61`; proof35669180188 passed18 checks and downloaded
  report is committed under `v5-ai-first/pkg037/`. Production source was introduced in `290b5320`.
- DEV ledger192 = source147 + dev_alpha45. Migration name `dev_alpha_pkg037a_publication_review_expiry`,
  version20260921235240, SQL SHA256 without final newline `cb4f0c605739dbd87a48775648db18bbaf4b6bab7a5d0b593f921cc6afada472`.
  Sweep source MD5 `9d89b9af2e893bc608e7598d175551b7`; exact text/ACL/body verified after application.
- Closure certified65980fce… unchanged and readiness asserted atomically. Direct private-function
  execution remains unavailable through the connector; do not claim a separate live digest call.
- Publication Edge v14 ACTIVE, verify_jwt=true. Both files match the committed/proven bytes exactly.
  Unauthenticated POST returns401. No real provider call. Receipt records the full hashes.
- APK35669226055 succeeded, downloaded and verified: SHA256 e47955fdb6ed8f7fea6029f4deb3e7c391a03d2c6c988ee2650aef51b90b9749,
  68,550,407 bytes, source2d6f0bc5/tree8c75e349… matches both attestations. No phone installation/test.
- Local types, Edge47, focused native/client80, full Jest241 suites/4646 tests all pass; full Jest exited0.
  PKG007 regression35668792540 also passed; follow-up PKG02735670003036 and PKG023f35670003088 passed.
- Status index: `USKOCI_CURRENT_STATUS.md`. Ordered finishing/pilot/growth gates:
  `APP_FINISHING_PLAN_20260922.md`. Do not report release or capacity percentages.

## Useful method / limitations

The cached CLI at
`C:/Users/user/AppData/Local/npm-cache/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-windows-x64/bin/supabase.exe`
is already installed (2.117.0). It successfully deployed the exact committed files staged below ignored
`artifacts/pkg037-edge-deploy`, with explicit verify_jwt=true and `--use-api --project-ref leqcwgzvjsxugfgzdmth`.
No installation, token read or secret handling was needed. First deploy got upstream520 and readback
remained v13; retry succeeded. Read back and hash every deployment; never disable JWT to fix transport.

Local GitHub HTTPS temporarily timed out. Connector created the identical source tree and a fast-forward
commit290b5320; its exact Git commit object was reconstructed/verified locally. The unpublished same-tree
local commit is preserved at `refs/uskoci/pkg037-local-before-api`. Normal git push works again; branch is
synchronized. Do not repeat this workaround unless needed.

The foreign untracked migration `20260913090000_clean_v5_fix_application_spam_and_resolution.sql` remains
untouched and uncommitted. Local inventory still refuses it; tracked CI inventory passes. Owner has not
explicitly approved the earlier suggested archival move. Do not delete/move/include it by inference.

## Next work

1. Continue 11.1 in a separate bounded package. The investigation document now has deployed bundle
   comparisons and exact live failure/status/dispatch body observations. Intake/worker streaming has
   12s provider /15s client bounds; Q&A is45s, contrary to the old ledger's all-AI12s generalization.
   Worker fail can already terminate a dispatched turn within its lease; intake fail currently cannot.
   Read remaining claim/completion/recovery/QA bodies and ACLs before choosing changes. Preserve dispatch,
   one acceptance/attempt, no paid replay/refund, lost-ACK success and independent metadata settlement.
2. Keep 7.17,7.41/remaining8.18, remaining7.1 and full Home aggregate integration open. Their investigations
   and compatibility traps are linked by the status index. Any certificate move needs fresh owner approval.
3. Phone field8.4 still has no owner answer. No device/speech action until explicit readiness. No production
   environment, legal texts/operator decisions, complete redesign, real-device journey or scale proof exists.

PKG-037 proof details: actual local Auth/PostgREST/SQL and exact Edge VM; provider output and budget admission
are synthetic. Its first fixture failed because it omitted current intake dispatch; corrected by calling the
real dispatch and asserting SUCCEEDED, not by weakening a rule. All expired/batch fixtures are disposable-only.
The new sweep writes at most100 commands but has no state/lease index; measure scan cost under larger isolated
history before growth. Do not equate a bounded write batch with bounded query work.
