# Cleanup inventory (C0) — summary of 2026-09-30

Read-only inventory by a helper lane (nothing moved, deleted, renamed, deployed or applied). The detail is in the eight files next to this one; the SHAs in the TSV files are authoritative
(the canonical branch moves every few minutes). Analysis pinned to canonical `fc58f411`; no file was added or removed under `src`, `.github`, `supabase` or `assets` while it ran.
It is a proposal for the C0 step of the master plan (after P6 is closed); it does not authorise any deletion.

## Counts per area
| Area | Result |
| --- | --- |
| Branches (187) | KEEP 11 / REVIEW 13 / ARCHIVE 44 / DELETE 119; none protected; 13 open PRs (10 draft), 5 stale stacked PRs to close first; 10 DEV-APK pre-releases (0.65 GB): keep `dev-latest` |
| Workflows (125 files) | KEEP 65 (34 are the P6 family) / REVIEW 1 / ARCHIVE 56 / DEPRECATE 1 / DELETE 2; the GitHub registry lists 242 (117 ghosts that a file change cannot remove); Actions storage 1,066 artifacts = 10.0 GB (118 orphans = 1.52 GB) |
| Docs (2,278 files, 206.8 MB) | stay in place 151 (entry 31, hard input 44, P6-open 76); coordinated move 192; 1,011 files / 93.2 MB with no active reference; about 177 MB movable with `evidence/`; `AGENTS.md` 125 KB → a 4.3 KB one-pager proposed (DOCS.md §3.2) |
| Client (440 modules) | 431 route-reachable, 9 test-only, 0 unreachable; 1 dependency candidate (`expo-web-browser`); 60 assets: DELETE 18 (461 KB), REVIEW 15 |
| Server (510 functions) | KEEP 485 + 10 staged, DEPRECATE 10, DEPRECATE→DROP 4 (76 are in the certified closure digest: never touched); 5 duplicate indexes; 11 Edge functions, 2 cron jobs, 210 migrations: all KEEP |
| Hygiene | GitHub secret scanning: 2 open (Google API keys); code scanning: 6 open (5 = the owner-accepted `idempotencija` debt); Dependabot 0 |

## Highest-value findings (owner-side first)
1. **DEV PostgREST retry loop (ops, not cleanup).** Re-checked by this session at 11:08 UTC: `MEDIA_VERSION_CONFLICT` (SQLSTATE 40001) 55,362 times in 10 minutes (~92 per second) from one PostgREST
   backend running the profile-avatar RPC (`p_asset_id`, `p_expected_avatar_path`); `pg_stat_database.xact_rollback` is 192 M against 1.8 M commits. The helper lane dates it to 2026-09-25 evening.
   Not the local emulator app (idle, no JS activity in its log) and not a process on this PC; the phone is the remaining candidate. It inflates DEV logs (8.6 M lines per day) and load and adds noise to every DEV measurement;
   the current photo screen (`src/app/(app)/profil/fotografija.tsx`) has no automatic retry of that call, so this points at an older installed build. Force-stopping the app on the phone is the first thing to try.
2. **Two active Google API keys are publicly leaked** (secret scanning alerts #5 `config/firebase/google-services.json:18` and #1 in `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html`). Restrict or rotate in Google Cloud;
   deleting files cannot remove them from public history. Owner action.
3. Repo settings (owner, reversible): public repo, default Actions token = write, retention 90 days, `delete_branch_on_merge` = false. All 125 workflows declare their own `permissions`, so the default can go to read.
4. Delete 2 workflows (`control-0-runner-probe`, `round40-control-refresh`); delete the 118 orphan artifacts only after the accepted P6 evidence is copied out of CI (irreversible: owner approval).
5. Replace the 125 KB `AGENTS.md` with the one-pager in the same change as the `pkg012` CI test update and the historical banners (about 16 record scripts and 19 workflows stage `AGENTS.md` and would re-inflate it).
6. Archive about 177 MB of docs with `git mv` only and a redirect table; branch pass in batches of at most 25 after the owner decides the 13 PRs (rollback SHA per ref in `BRANCHES_SHA.tsv`).
7. Server (approval + rollback): REVOKE PUBLIC/anon EXECUTE on `public.my_cloud_profile_bundle` (the one anon-executable function that is not by design); REVOKE-first deprecation of 10 functions, then DROP 4 dead ones and 5 duplicate indexes.
   Table-ACL narrowing lives inside the certified digest: do it only inside the ONE PKG045b recertification (PKG045b is now applied; see its receipt), never as a tidy-up.
8. Client: already clean. Small wins: 18 Expo-template images, `scripts/reset-project.js`, the retired Agreement current-location client, 16 DEV gallery routes → one `isInternalBuild()`.
9. Hidden couplings to handle in the same change: `postinstall` reads the reference HTML; `attest_launcher_icon.py` uses two template icons as negative controls; `outputs/*.tsx` are type-checked by `tsc`;
   22 workflows stage `docs/control/out/tabla.html`; `AUTHORITY_MANIFEST.json` pins 160 `sources/**` files.

## Proposed C0 order (every accepted proof stays reachable)
- **Gate 0 (now, P6 open):** owner-side only, no repository change: findings 1, 2, 3.
- **Gate 1 (P6 closed):** preserve first — immutable tag on the canonical tip, a bundle of the ARCHIVE + REVIEW branch tips stored outside the repository, accepted P6 receipts/APK hash copied out of CI retention, a schema-only DB dump and a Supabase backup check, a green baseline on the tag.
- **C0-A docs:** archive the P6 record chain; `AGENTS.md` one-pager with its test update; `git mv` by family with a redirect table; stop committing `tabla.html`.
- **C0-B GitHub:** the 2 workflows, HISTORICAL headers/filters on closed proof workflows, the 13 PRs, branches in batches, releases and orphan artifacts.
- **C1 client:** template leftovers, retired client code, gate/env consolidation, then the reference-entry pipeline decision with the owner; nothing under `Discovery*`, `discoveryV1*`, `zadaci.tsx` or the P6 workflows before P6 acceptance.
- **C2 server (approval + rollback):** dump/backup, REVOKE-first, observe one release cycle, then DROP.
- Smoke after each batch: `node --test scripts/ci/*.test.cjs`; `tsc`; full Jest; the live-plan `--check`; the CI integrity workflows named in `WORKFLOWS.md`.

## Owner decisions this needs
The 13 open PRs; where the bundle, archives and wanted APKs live; the `AGENTS.md` one-pager text and who owns its dated block; keep or retire the legacy reference-entry pipeline (`AGENTS.md` names the V4.9 HTML the visual authority);
the Google keys and repository settings; which DEV APK releases stay; the server DEPRECATE/DROP list; whether the `.maestro` walkthroughs contradict the emulator-only rule.

## Limits of the inventory
DEV only (5 accounts, 48 MB); no production or per-function call counters (`track_functions=none`); caller detection is name-based; ledger version strings versus migration file names are not asserted; runtime memory, timers and bundle size not assessed.
"Zero references" is never used as proof: those items are REVOKE-first or REVIEW. Confidence high for branches, workflows, doc classes and DB catalogs; medium for dead code and dependency verdicts.
