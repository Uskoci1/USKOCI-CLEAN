---
name: uskoci-control-table
description: "docs/control/ living control table (2026-09-22): 62 rows × six lights, osvezi.mjs recomputes from code + DEV snapshot, published artifact VxTvL3VpwhYv8cxJCWzD5t; refresh after every piece of work; phone green only with phone evidence"
metadata: 
  node_type: memory
  type: project
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-22T13:58:08.670Z
---

On 2026-09-22 the owner asked for one clear, self-updating view of everything, from product decision to code, database and phone. It replaces the old hand-kept matrices (Master Control V6–V19, the 16.09 product truth), which stay archived in the owner's Downloads zip.

**Why:** the old matrices were rigorous but huge, stale and unreadable for the owner.

**How to apply:**
- Files live in `docs/control/`.
- **`redovi.json`**, edited by hand, holds:
  - 62 rows grouped by the golden paths of `UX_NACRT_20260922.md`;
  - the 21 blockers, the 24 store gates and the 32-step two-phone plan.
- **`dev_snapshot.json`** is the read-only DEV catalog, made from `dev_snapshot.sql` plus `list_edge_functions`.
- **`scripts/control/osvezi.mjs`** computes the ekran, kod, server and test lights:
  - kod uses the import graph from `src/app`;
  - it also produces the lists "server can, app never calls" and "app calls, server lacks".
  - It writes `stanje.json`, which is committed, and `out/tabla.html`, which is git-ignored.
- **After every piece of work:**
  1. refresh the snapshot if DEV changed;
  2. edit the rows;
  3. run the script;
  4. commit;
  5. republish `out/tabla.html` to https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t (use `url` from another session).
- **Telefon** turns green only with phone evidence for the current build (V19 DONE_VERIFIED rule).
- **First run** found:
  - a real broken call: `rpc_cancel_media_upload` is called by `mediaClientService` but absent on DEV; candidate `pkg008` was never applied;
  - 21 problem rows, 41 working in code but unproven on a phone, 0 done.
- **Committing** while Codex has uncommitted edits in the same file: stage only your hunk by writing a blob from the HEAD version plus your change, then `git update-index --cacheinfo`.

**Two ways in, both live (2026-09-22):** the page carries the state embedded AND reads the artifact db doc `control/stanje` (ArtifactData collection `control`, doc `stanje`, field `stanje` = the raw stanje.json text); it renders whichever `meta.osvezeno` is newer. The panel "Ucitaj novo stanje" lets the owner or Codex upload a fresh stanje.json in the browser without republishing. Pin `if_version` on every db write. Republish only when the template changes.

**R4 overlay (2026-09-22):** `docs/control/izvori/r4-20260922/` holds ten machine tables from the owner's read-only forensic package, frozen at 9286fdeb, each verified against its MANIFEST_SHA256 before copying, plus `prevod.json` (the Serbian text shown for the snapshot's English prose). The generator turns them into `tokovi` (24 notification events: who makes it, where the blueprint wants it, which screen the app really opens - the kind-to-route table is authored in osvezi.mjs and every path is checked against src/app/obavestenja.tsx), `nivoi` (all 62 rows placed on 13 surfaces, from the rows' own routes), `praznine` (12 read-model gaps) and `snimak` (re-tests the snapshot's claims against the live catalog). Rule: the snapshot supplies analysis, never lights.

Related: [[uskoci-v28-identical-look]], [[uskoci-owner-evidence-first-rule]], [[uskoci-closure-source-digest-rule]].
