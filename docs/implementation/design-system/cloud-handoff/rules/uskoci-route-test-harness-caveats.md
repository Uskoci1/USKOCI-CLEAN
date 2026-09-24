---
name: uskoci-route-test-harness-caveats
description: "Why USKOCI route (screen) Jest suites crash when a screen transitively imports supabaseClient, and how the PKG workflow/receipt cycle is run (learned 2026-09-16 during PKG-007)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-16T01:15:51.386Z
---

USKOCI-CLEAN screen suites (e.g. `src/data/__tests__/agreement-screen-recovery.test.tsx`) mock `react-native` with a Proxy whose `AppState.addEventListener` touches test-file `const`s. `src/data/supabaseClient.ts` registers an AppState listener at import time, so any new import chain from a screen into `serverReceipt.ts` → `supabaseClient.ts` runs during hoisted imports, hits the TDZ and fails the whole suite with "Cannot read properties of undefined (reading 'add')".

**Why:** In PKG-007 the first cut imported a copy/decoder module from the Agreement route; the module pulled `serverReceipt` and the route suite would not even start. Splitting the module (dependency-free copy for the screen, decoder next to the adapter in `agreementClientService.ts`) fixed it without touching `serverReceipt.ts`, which many verified packages depend on.

**How to apply:** Keep screen-side helper modules free of `serverReceipt`/`supabaseClient` imports; put receipt decoders in the data service that already imports them. Do not edit `serverReceipt.ts` for a package fix: it is in the proof path of PKG-003/004/005 and a change invalidates their DONE_VERIFIED proofs. Package cycle that worked for PKG-003/004/007: write failing tests → run them on the unchanged head and save the output as the pre-fix witness → minimal source change → `npx tsc --noEmit` + focused suites → full local Jest only as a diagnostic (see [[uskoci-local-windows-proof-caveats]]) → commit with the PKG prefix → push → poll `gh api .../actions/runs?head_sha=` → generate evidence + Ledger receipt with a script modelled on the scratchpad `write_receipt_pkg004.py` → run `node --test scripts/ci/execution-ledger.test.cjs` → commit docs. If a package touches a file in another package's workflow path filter, that workflow re-runs automatically; record it as a re-verification receipt (PKG-004 on ba098b8).

Receipt generators that scrape `gh run view --log` must select lines with `startswith('PASS …')`/`startswith('Tests:')`, never `in`: the runner echoes the shell command (with ANSI codes) into the same step log, so a substring match copies the noisy echo into the Ledger. Both PKG-007 and PKG-008 hit this; regenerate only while the receipt is uncommitted. SQL packages follow PKG-003/PKG-008: candidate in `supabase/candidates/` (never `supabase/migrations/` before PKG-014), a rollback-only proof in `supabase/proofs/`, and a workflow that reuses `ru5_device_ui_live79_env.sh` plus the provenance replay before applying the candidate in the disposable database only; impersonate with `set local role authenticated` + `request.jwt.claim.sub`, and `set local role service_role` + `request.jwt.claim.role`/`request.jwt.claims` for service RPCs; run raw `private.*` assertions after `reset role`.
