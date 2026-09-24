# USKOČI control table

One living table of what the app does, what is missing and what is burning, from the product decision down to the
phone. It replaces hand-maintained matrices (Master Control V6–V19, the 16.09 product truth). Those stay in the
owner's archive, unchanged. Their useful parts are carried here:
- stable IDs;
- the SOURCE / DEV / DEVICE separation;
- the DONE_VERIFIED rule;
- the 21 release blockers;
- the 24 store gates;
- the 32-step two-phone test.

**Published page (private to the owner):** https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t

## Files

| file | who writes it | what it is |
| --- | --- | --- |
| `redovi.json` | people and agents, by hand | One row per user step, grouped by the golden paths of `v5-ai-first/UX_NACRT_20260922.md`. Also carries the blockers, store gates and two-phone plan. |
| `dev_snapshot.json` | an agent, through the Supabase connector | Read-only catalog of canonical DEV: every RPC, what `authenticated` may call, Edge functions, cron, ledger and certificate. Query: `dev_snapshot.sql`. |
| `stanje.json` | `scripts/control/osvezi.mjs` | The computed state. Commit it; its diff shows what changed. |
| `tabla.template.html` | people | The page layout. |
| `out/tabla.html` | `scripts/control/osvezi.mjs` | The page to publish (git-ignored). |
| `izvori/r4-20260922/` | copied once, never edited | The owner's read-only forensic snapshot R4, frozen at `9286fdeb`. Ten machine tables, each verified against the package's own `MANIFEST_SHA256.json` before copying, plus `prevod.json`: the Serbian text the table shows for the snapshot's English prose. |

## The six lights per row

| light | how it is set |
| --- | --- |
| **Nacrt** | The row points to a step of the UX blueprint. |
| **Ekran** | automatic: each route file exists |
| **Kod** | automatic: the row's services exist; every server function it needs is called in app code; a screen reaches that code (import graph from `src/app`) |
| **Server** | automatic: every listed RPC or Edge function exists on DEV, and every RPC the row's services call exists. `NOVO:` marks a server capability that has to be built. |
| **Test** | automatic: at least one test file touches the row's services or functions |
| **Telefon** | By hand, and **only with evidence from a phone for the current build**. Nothing else turns it green. |

A row is **GOTOVO** only when every applicable light is green, including Telefon. This is the V19 DONE_VERIFIED rule:
- the original problem is gone;
- the normal path works;
- the guards are not weakened;
- all evidence belongs to the exact build.

Two lists are computed automatically as well:
- **server can, app never calls:** candidates for new features, or old versions to clean up;
- **app calls, server lacks:** a broken call. On 2026-09-22 this found `rpc_cancel_media_upload`.

## What the R4 overlay adds (2026-09-22)

The snapshot under `izvori/r4-20260922/` carries analysis a code scan cannot produce. The generator reads it and
adds four sections, each of which is **checked against the live tree**, never trusted blindly:

| section | what it answers | how it is checked |
| --- | --- | --- |
| `tokovi` | Where does every one of the 24 notifications land? Who makes it, where the blueprint wants it, which screen the app really opens. | The kind → route table is authored in `osvezi.mjs` and every path is looked for in `src/app/obavestenja.tsx`; `putevi_nadjeni` goes false if one disappears. |
| `nivoi` | The screen map: which surface each row lives on and how deep. Every one of the 62 rows is placed; a route matching nothing falls into "ostalo" instead of vanishing. | Built from the rows' own routes, not from the snapshot. |
| `praznine` | The 12 read-model gaps: where the next step is a server contract, not a drawing. | Row references are kept only when the row exists. |
| `snimak` | Does the snapshot still hold? | Its claimed missing dependencies are re-tested against the live RPC catalog, and this run's own broken calls are listed as `novo_slomljeno`. |

Each row also gets `veza`: surface and level, the RPCs its own code reads and writes, its Edge functions, the
events it makes, and anything it needs that DEV does not have. Percentages and verdicts inside the snapshot are
not copied — the lights stay computed here.

As of the 2026-09-24 audit, `redovi.json.aktuelne_dopune` holds dated, evidence-linked corrections to the
snapshot-derived `praznine`, `nivoi` and `tokovi` prose. The generator overlays these current corrections without
editing the frozen package. They are manual audit judgments, not automatic behavioral verification; update them
when the referenced source/contract changes. `snimak` and its hashes remain historical. A fresh generation date
does not change the date or scope of `dev_snapshot.json`, device receipts or CI runs.

## Refreshing (after every piece of work)

1. **DEV changed?** Run `dev_snapshot.sql` through the connector, add `list_edge_functions`, and save
   `dev_snapshot.json`.
2. **Your work changed a row's facts?** Edit `redovi.json`:
   - problem, next step, phone evidence;
   - blocker state;
   - two-phone step done (`test_dva_telefona_izvrseno: {"I01": "evidence path"}`).
3. **Recompute:** run `node scripts/control/osvezi.mjs`.
4. **Commit and publish:**
   - commit `redovi.json`, `dev_snapshot.json` and `stanje.json`;
   - republish `out/tabla.html` to the URL above: Artifact publish with `url` set to that link.

**Without the Artifact tool (for example Codex):**
1. Run `node scripts/control/osvezi.mjs`.
2. Open the published page in a browser signed in as the owner.
3. Under "Učitaj novo stanje", choose `docs/control/stanje.json`.

The page stores the file in its shared storage, and every open view updates. The storage accepts writes only
from people with edit rights. The page shows the newer of the embedded state and the loaded state, compared by
`meta.osvezeno`. Republishing is needed only when `tabla.template.html` changes.

Code, test and route lights recompute from the checked-out tree on every run. The script needs no secrets and no
network. The one exception is an optional `gh run list` for the latest CI results.

## Functional audit cross-reference (2026-09-22)

Each row's `funkcionalni_audit` points to the dated functional audit and its analytical section IDs.
All 48 analytical sections are mapped to the existing 62 execution rows. The audit is an approval
snapshot; this control table remains the sole living execution tracker. A route/import/test-file or
RPC catalog match is structural evidence, not successful test execution, enabled policy or complete
behavior. Defect notes and exact-build device receipts take precedence over optimistic reading of lights.

The latest owner instruction also requires refreshing and republishing after each task. Publishing
requires an authenticated owner session and an Artifact publish capability for the existing URL;
generation alone must never be reported as publication. If that capability is unavailable, retain
the exact generated file and record publication as pending, without creating a different public site.
