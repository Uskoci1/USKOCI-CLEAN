# USKOČI — current execution status

Updated: 2026-09-22. This is a status index, not a new product constitution or permission grant.
The owner's latest instructions and the mandatory handoff boundaries continue to govern.

## Evidence levels

Keep these separate: source implemented → automated proof passed → DEV applied → APK built → device
verified → public-release ready. A completed level never implies the next. Do not report a percentage
of app completion from counts of migrations, files or closed findings.

## Current anchors

- Workspace/branch: `NEXT_AI_HANDOFF_20260921_2145.md`; current continuation:
  `NEXT_AI_HANDOFF_20260921_CODEX.md`.
- Canonical DEV `leqcwgzvjsxugfgzdmth`; no production project. Read-only check on 2026-09-22: ledger191
  = source147 + dev_alpha44. Latest applied package PKG-035; this continuation performs no DEV mutation.
- Last applied closure proof: PKG-035 preserved readiness and the certified digest `65980fce…` atomically.
  Direct private digest execution through this connector is denied; do not claim a new independent check.
- Latest client change: PKG-036, source `0c01ac7b`, types pass, full local Jest 241 suites / 4644 tests
  pass, exit 0. CI PKG-004 run35661988323 and PKG-007 run35661988415 succeeded on that source.
- Latest verified APK: run35662001128, source `0c01ac7b`, SHA256 `b883d7a7…`, 68,550,371 bytes. Downloaded
  hash/source match both recovery and icon attestations. Contains PKG-036 and preceding client changes.
  See `v5-ai-first/pkg036/APK_RECEIPT_20260922.json`. **Not installed/tested on a phone.**

## Engineering work queue

| Item | State | Evidence / completion condition |
| --- | --- | --- |
| Application admission / price parity (3.1, 12.6) | Proven and DEV applied; client built, device pending | PKG-033, run35651463755, 41 checks; package receipt. |
| Closure preparation blocker parity (12.10) | Proven and DEV applied | PKG-034, run35654209245, 25 checks. Does not close legacy readiness or second-device recovery. |
| Selectable versus historical application counts (7.32) | Proven and DEV applied; client built, device pending | PKG-035, run35658331088, 38 checks. |
| Business refusals (7.1) | Partial | PKG-036 compares 11 lifecycle RPCs plus selected guards, fixes adapter/controller/screen gaps. Audit other call families individually. |
| Public task columns (7.17) | Investigated, unresolved | `v5-ai-first/PUBLIC_TASK_PRIVACY_INVESTIGATION_20260921.md`. Need explicit detail/owner boundaries and actual REST compatibility proof. |
| Closure legacy readiness / recovery (7.41, remaining 8.18) | Investigated, unresolved | Continuation handoff explains restricted-account guard and locally saved request-key dependency. Certified changes require fresh owner approval. |
| AI deadlines / post-dispatch recovery (11.1, 11.2) | Investigated, unresolved; sweep portion already applied | `v5-ai-first/AI_DEADLINE_RECOVERY_INVESTIGATION_20260922.md` binds actual review client, shared abort and four live claim/completion/read bodies. PKG-027b is not a complete fix; no paid probes. |
| Full Home aggregate integration | Unresolved | PKG-023j installed; PKG-035 corrects counts. Do not claim all application/Agreement scans removed. |

## Product and public-release work queue

| Area | Current boundary / next evidence |
| --- | --- |
| Complete marketplace journey | Latest whole journey on two real devices not verified. Owner readiness required. Include interruptions, changes, cancellation, problem and rating, not just success. |
| Design | Current UI and supplied HTML are starting material. No accepted final app-wide redesign. Explore three materially different compositions before each major surface, preserve functional truth and the unified Home. |
| Motion / external assets | Installed libraries do not establish a finished design. Verify actual need, compatibility and license; no new dependency without approval. |
| Voice | First release: dictation → editable text → explicit Send. Full spoken dialogue later. Speech testing only with explicit phone readiness. |
| Profile phone (8.4) | Owner question pending: optional unverified number, explicitly shared in a Dogovor. Do not implement from silence. |
| Push | Intentionally disabled. Worker credentials/schedule were verified separately; real delivery and navigation need device proof before activation. |
| Support | Technical case flow exists; assign and verify a real operator before promising operational support. |
| Operator / legal / export | Await operator details, reviewed texts and retention decisions. Existing legal-acceptance/export code does not make these complete. Lawyer worksheet: `v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md`. |
| Monetization | Owner intends paid connection service in Serbia. Credits, collection of job payments and worker payouts are not implicitly approved. Commercial terms, provider and store-policy route are unresolved. |
| Public release | Requires production plan, monitored operation/recovery, pilot evidence, iOS/Android device checks and store preparation. DEV APK success is not public-release readiness. |

## Historical sources are not current status

`docs/product-design-truth/USKOCI_PRODUCT_CANON.md` and `USKOCI_DESIGN_IMPLEMENTATION_GAP.md` explicitly
observe the September8/source38e9a38/live87 baseline. Their old absence claims, navigation and role copy
must not override later implementation evidence and owner decisions. They remain historical evidence;
this index does not rewrite their recorded baseline or the authority manifest's source hashes.

The September21 audit also contains historical measurements. Read each item's later status and package
receipt. The old summary of 50 fixed findings and old build IDs are not a fresh count of current readiness.
