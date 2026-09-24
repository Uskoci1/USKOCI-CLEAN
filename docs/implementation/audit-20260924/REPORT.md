# Independent continuation audit — 2026-09-24

## Verdict and scope

USKOČI made substantial, verifiable progress after the previous handoff. It now has a substantially more coherent native presentation system, four additional applied backend repairs, an attested current Android emulator build, and an earlier recorded two-party marketplace journey. It is suitable for continued controlled DEV testing. It is **not yet demonstrated ready for public release**.

This is a deep **delta audit**, not a claim to have re-read all 480 live functions or re-exercised every user journey. We inspected changed function bodies and their unchanged contracts, package proofs/receipts, navigation and recovery boundaries, current CI, read-only DEV metadata and selected native presentations. Three bounded independent reviews cover client flows, design/navigation, and release/backend contracts. No application fixes, migrations, Edge deployments, dependency changes, business writes, paid provider calls or phone actions were performed. The emulator was used for read-only internal fixture galleries only. Control documentation and its current-state overlay were corrected.

| Anchor | Verified value |
| --- | --- |
| Previous handoff | `3b8f389e186796e134147d731ce28669102069f1` |
| Initial audit HEAD | `b1da968c396434faa8e5455e6c0f960499206530` |
| Branch | `work/uskoci-ui-unification-20260924` — deliberately not switched |
| Initially installed application source | `644cab09f4e9a305fd18682179700af596329f98` |
| Delta | 206 commits; 632 changed paths; 44,163 additions / 8,361 deletions, including documentation and visual evidence |
| Canonical environment | `leqcwgzvjsxugfgzdmth`, DEV/ALPHA; no production environment established |

File/change counts are inventory, not a quality score or completion percentage. The current master design plan and latest owner decisions supersede the earlier V28-only layout constraints. Existing foreign untracked files, including the prohibited extra migration, were preserved.

**Concurrent continuation:** ten further commits / 102 changed paths arrived while this audit ran. All three reviewers extended their source review to **`bc127755a85ced147b3979bdb6985ce8d0524291`**; their dated addenda preserve the initial findings rather than changing old evidence. Later **`38f199bcaca283a26ac14235aa43d600288afed1`** adds handoff/reviewer documents only, with no source diff from bc127755. Tests and APK evidence below identify which cutoff they cover; b1da968c CI is not relabeled as a bc127755 run.

## What materially improved

| Area | Evidence of actual progress | Boundary still open |
| --- | --- | --- |
| Shared design | Real ScreenChrome, shared sheet/action/state/card primitives; old wrappers forward to the shared system; green primary action, consistent Inter/FactArt, common reduced-motion subscription | Complete current-build accessibility, keyboard, small-screen and large-text acceptance |
| Navigation | Početna / Zadaci / Dogovori roots; own tasks and applications separated; retired map/list routes redirect; correct root context on inner navigation | Ownership failure in discovery, DN-01; a few recovery destinations/count labels |
| Discovery | One native map/list surface, price pins, selectable preview, structured local filters | Server filtering/paging/total contract still not connected; large-text preview risk |
| Task AI | New conversation/composer/draft presentation; explicit speech modes and text replies; existing command journal and reconciliation remain | CF01 typed-draft loss; no fresh microphone/provider quality test in this audit |
| Offers and selection | Price/places review, named submitted receipt, person-first candidates, explicit accepted terms; revision/hash/account fences preserved | Exact latest-build two-party acceptance; older MY_PRICE server policy discrepancy remains a separate decision |
| Agreement | Source task/application IDs really added to DEV and mapped to UI; person/terms/next-action/message organization improved; terminal and own-rating presentation refined | CF02 photo recovery, RC-01 unseen message ACK, RC-03 rating reads; incoming chat/paging remain open |
| Profile, calendar, privacy/support | Steps 9–11 are source-built and in APK 644cab09; current gallery captures confirm actual native rendering of privacy-unpublished and long-calendar scenes | Fixture presentation is not live save, export, legal acceptance, account closure or operator workflow proof |
| Task media | PKG-046 repaired the missing cancellation RPC and preserves late-claim fencing | RC-02 lock ordering; media Edge safe error mapping still recorded undeployed |
| Safety | PKG-047 provides the account target under public-profile visibility rules | Full report/block/moderation acceptance and retained rollout privacy restriction |
| Operational evidence | Applied SQL hashes, function body pins and cron execution match expectations; fresh exact-HEAD client proof green | Private certificate check unavailable to this connector; real push and public-release operations not established |

The saved `functional-audit-20260922/device-20260923/dve-strane/TWO_PARTY_RECEIPT.json` records a real phone/emulator journey on **332d285f**: publish → offer → select → messages both ways → requester completes. This is valuable evidence. It did **not** exercise worker mark-done, both saved ratings or push, and it predates the extensive latest UI changes. No current-head whole-journey acceptance is inferred from it.

## Findings that should drive the next fixes

Detailed code references, interleavings and reproduction evidence are in [CLIENT_FLOWS.md](CLIENT_FLOWS.md), [DESIGN_NAVIGATION.md](DESIGN_NAVIGATION.md), and [RELEASE_CONTRACTS.md](RELEASE_CONTRACTS.md). P2 means a concrete correctness/reliability defect to fix in the next implementation pass; it does not imply a proven production incident.

| ID / priority | Trigger and consequence | Evidence / next proof |
| --- | --- | --- |
| CF01 / P2 | Type a draft, send separate held speech, receive success: the unrelated typed draft is erased. Recovery from UNKNOWN to success also erases it. | **Reproduced:** two assertions against the actual route/editor, external IO mocked. Clear only the draft consumed by that command. |
| CF02 / P2 | Prepare an unsent photo, then Agreement becomes terminal: its cleanup/reconciliation panel disappears, although the server still admits cancellation. | **Reproduced:** real chat/photo components, active-to-terminal transition. Preserve cleanup/recovery while disabling new capture/send. |
| DN-01 / P2 | Ownership read is pending/failed: own tasks appear as opportunities. Ordinary refresh with unchanged public IDs does not retry the failed ownership read. | Deterministic callback/state tracing; current tests cover map/count waiting but not the list. Add pending/failure/same-ID refresh regressions. |
| DN-05 / P2, supplement | Copying Tuesday's availability onto other days can delete Tuesday's own 00:00–06:00 continuation; saving the resulting draft would persist an unrequested change. | **Reproduced** against the actual pure helper. Preserve the source weekday as well as targets when copying the after-midnight continuation. |
| RC-01 / P2 | Message M2 arrives between reading M1 and acknowledging the conversation: M2's notification is marked read before M2 was displayed. | Client and fresh live RPC body traced. Acknowledgment accepts only Agreement ID, no read boundary. Requires disposable interleaving proof and bounded server change. |
| RC-02 / P2 | READY upload cancellation locks asset then conversation; removal/completion use conversation then asset. Concurrent callers can form a deadlock cycle. | Source lock-order proof, **not observed runtime deadlock**. Prove the concurrent schedule on disposable DB before changing it. |
| RC-03 / P2 | Reading Agreements starts one review RPC for every completed Agreement, all inside one Promise.all. One stalled review can withhold the entire list/Home section. | Source request/await graph; no load test claimed. Batch/bound enrichment and keep active Agreements usable under an ancillary read failure. |
| RC-04 / P2 verification blocker | New `lib/inicijali` dependency is absent from two strict proof loaders; the bc127755 supplement also adds missing `tacanTermin` (and its calendar import alias). Full app Jest does not execute those proof setups. | **Reproduced at both cutoffs:** unchanged loader bodies with exact Git LF blobs; `UNDECLARED_CLIENT_SOURCE` and `UNEXPECTED_PROOF_MODULE`. Extend only evidenced pure-module mappings and rerun actual proof workflows. |

Additional bounded items: DN-02 is an **unreproduced native layout risk** (half-height non-scrolling map preview); DN-03 is the empty-state worker-profile CTA opening the general hub; DN-04 is retained accessible-count debt. They must not be represented as catastrophic/server defects.

No new P0 exploit, data corruption incident or architectural need to rewrite the app was established by this audit. That is a statement about these observations, not a guarantee that no other defects exist.

## Important inherited gaps, not closed by the redesign

1. **Task-column privacy / PKG-045b:** safer client projections exist, but the final authenticated column restriction remains on rollout hold. Direct access to the older table columns is still the documented exposure. Existing owner approval is conditional on compatible rollout verification; this audit did not apply B or move the closure certificate. Treat this as a pre-public-release priority.
2. **Discovery and own-task read models (F06–F08):** the client still walks up to 25 × 200 public tasks and locally filters. The page projection for own tasks still lacks facts needed by its card. A redesigned filter panel has not implemented the server contract.
3. **Messaging (F13):** incoming messages require refresh; history has no paging. Own-message recovery is implemented and should be preserved. PKG-050 notification clearing does not establish real-time delivery or read receipts for individual messages.
4. **Policy-dependent features:** HITNO policy, payment/connection-fee decisions, provider/geocoder decisions, reminder semantics and legal/retention/operator material are separate from UI readiness. Follow current owner decisions; do not silently activate older proposals.
5. **Release evidence:** real push registration/delivery/tap, worker completion → requester confirmation → both ratings, account switching/offline recovery, iOS, store signing/package/submission, operator/legal/privacy and production/pilot readiness remain separate gates. Android production-profile source configuration is not a submitted/accepted store build.

## Fresh measurements

### Local and GitHub verification

- `npx.cmd --no-install tsc --noEmit -p tsconfig.json`: **exit 0**.
- `npx.cmd --no-install jest --runInBand --json --outputFile=outputs/audit-20260924/jest-result.json`: **296 suites / 5605 tests passed, exit 0** (719.87 s). Known delayed-teardown warning is retained in the log; no forced exit was used by this local audit command.
- Independently dispatched **PKG-007 run [36013854412](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36013854412)** on the exact audit HEAD: **success**, including TypeScript, focused checks and full **296 / 5605** regression. This workflow is a client/exact-candidate proof; it does not replay every database package.
- Three added scratch assertions fail for the expected CF01/CF02 behaviors. These intentionally failing diagnostic tests are outside default Jest discovery and do not contradict the green existing suite. They demonstrate its coverage gaps, not completed fixes.
- Strict proof-loader diagnostics fail separately (RC-04). Latest saved PKG-010 run **35916382989** passed on **25dc016a**, before the new helper; it is not current-head proof.
- Manual proofs PKG-003/004/005/006/007/047 passed on **f88216cd**. Several workflows' automatic push filters still name the old branch, so the new UI branch needs explicit dispatch or a reviewed trigger update. An APK green check alone is insufficient.
- **RU-2 35957415097** is red at a removed pinned source symbol (`rpc_ai_apply_interview_turn_v2_service`); **PKG-014B 35704252850** is an older red frozen source-manifest check. They are not newly demonstrated application runtime failures. They remain evidence debt until their intended assertions are reconciled, not simply removed.
- `python supabase/migrations/check_migration_integrity.py`: fails on the already-known foreign, untracked 148th SQL file. `git diff 3b8f389e b1da968c -- supabase/migrations` is empty. We did not remove, edit or commit that file.

### Read-only DEV

At **2026-09-24 14:27 UTC**, ledger **201 = 147 source + 54 dev_alpha**. Fresh SHA-256 of the actual ledger SQL for PKG-046a/047a/048a/050a matches each saved receipt. Six inspected function **prosrc** MD5 values match their recorded pins (do not confuse these with pg_get_functiondef hashes). The new public RPC grants and fixed search paths were inspected; no anonymous execute exposure was found there.

Both `uskoci_marketplace_tick` and `uskoci_edge_workers` are active every minute; each has **1440 successful cron records / 0 failed records** in the observed preceding 24 hours. This proves scheduling/execution records, not successful push delivery or completion of all business work.

The direct current closure-digest/readiness query was **denied (42501)**. We did not bypass it. The last saved certification is **2026-09-23 06:51 UTC**, `cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7`, ready=true. It must remain labeled historical, not a fresh independent certification. `docs/control/dev_snapshot.json` keeps its original timestamp for this reason.

Fresh Edge inventory: intake50, publication14, worker-interview17, speech15, QA13, location14, media12, push14, export-worker14, export-download14, closure3. Version/JWT metadata is not byte verification. Worker verify_jwt=false settings predate this audit; no auth setting or key was changed. Media cancellation's one-line safe-error mapping remains recorded undeployed.

### Current native artifact

Installed **emulator** package `rs.uskoci.dev` SHA-256:
`a32f523809296bf3f3482a935be4c786aaf8a8d5c8f6c728f0fe256be01da933`.
It matches successful APK run **[35964962961](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35964962961)** and source **644cab09**. No reinstall, uninstall, data clear or phone operation was needed.

Fresh captures actually viewed: `outputs/audit-20260924/privacy-unpublished.png` and `calendar-long.png`. They show the real presentation components with explicit internal-gallery fixtures, not real account writes. Normal-size long calendar titles, price, role/person and location fit without overlapping; privacy unavailable states are visible and truthful. No generalized large-text, TalkBack, iOS, map-overflow or whole-app visual acceptance is inferred. Previously committed R3/R4 screenshots and receipts were also reviewed in the design appendix.

## Ordered continuation

1. Preserve the current design direction and revision/recovery contracts. Fix **CF01, CF02, DN-01 and DN-05**, with failing-before/passing-after cases. Repair the two proof module mappings without weakening guards.
2. Prepare separate, bounded proposals for **RC-01 and RC-02** with disposable database interleavings; handle **RC-03** as a read-model/availability change with request-count and stalled-read tests. Server changes still require the current approval boundaries.
3. Complete the compatible-rollout checks for **PKG-045b**; then follow the existing conditional approval and certificate rules. Do not fold it into a cosmetic patch.
4. Complete the latest handoff's **round 5c** reviewer leftovers first (see the source-checked addenda), then the existing master plan's **step 12 / round 6**: remaining offer/rating, publication/place/photo, Q&A and Agreement sub-screens. Keep one UI implementation per surface, current APK evidence and independent review.
5. Run the full current-build two-party path and its failures, including worker completion, both ratings, media cancellation, offline/retry/account switches and push. Verify Android and iOS separately.
6. Finish the policy/provider/legal/payment/operator and distribution gates. Internal testing can precede public readiness; do not label a DEV-bound store profile production-ready.

## Documentation/control reconciliation

The control table contained stale next actions despite newer receipts: B03 claimed cancellation RPC absent, B04 ledger197, D02 links not yet implemented, D03/P01 PKG-050 awaiting a first APK, and map/filter rows described retired toggles. This audit updates those facts in the **existing** control table and adds the new defects to their existing rows. No completion percentage or unsupported device-green status is added. Frozen R4 evidence remains untouched.

The status index now starts with this checkpoint and dates the former checkpoint as historical. Current code, fresh client proof, older native journey, partial live verification and public-release gates are kept distinct. Publication of the regenerated state to the existing Claude artifact is recorded separately in `EVIDENCE.json`; local generation alone does not establish publication.

## Supplement through bc127755

The additional work improves real behavior: unknown profile capability no longer looks like a known negative; availability/setup navigation and dirty-state protection are more explicit; calendar rows consume accepted exact time windows and distinguish partial reads; notification settings preserve the selected side; message accessibility includes attached photos; support replies survive another party's revision. These improvements do not replace the earlier command/identity/revision guards.

All primary audit findings remain open at this cutoff. The actual-component CF01/CF02 repros were rerun: **two diagnostic suites / three expected-behavior assertions fail**, saved separately in `client-bc127755-result.json`. Both proof loaders were reproduced again; their first missing module is now `tacanTermin`. TypeScript was rerun and exited 0. The additional full local regression reports **297 suites / 5707 tests passed** (561.696 s), again with the delayed-teardown warning. Its process completion is recorded in `EVIDENCE.json`; it is distinct from the initial green CI.

The latest handoff's reviewer notes were treated as claims to check, not completed acceptance. Its remaining small-screen waiting-summary truncation is a layout risk, not a fresh native reproduction; candidate profile affordance, empty-chat action ordering and copy are polish items. The profile/calendar/notification and support addenda separately state which round-5c issues have been traced or reproduced. Current APK run **36015751245** was observed in progress for bc127755; no installation or acceptance of that artifact is claimed in this audit.

Independent dispositions of the added reviewer claims:

- **DN-05:** source-day overnight availability loss reproduced; belongs with the immediate correctness fixes above.
- **DN-06:** hiding the keyboard footer also hides the only dirty-navigation refusal/guide text. The source path is confirmed; native timing is untested.
- **DN-07:** changing the inbox filter remounts the pressed accessible filter node. Remount confirmed; the device's eventual focus location remains unobserved.
- **DN-08/09:** photo reconciliation/retry labels and busy indicators contradict the operation actually running. Source confirmed; command safeguards are unchanged.
- **DN-10/11:** Android ScrollView custom-refresh wiring is not supported by the installed delegate path; essential availability explanation exists only as an optional spoken hint. Native TalkBack acceptance remains required.
- **RC-05/06:** support discard confirmation can retain a stale navigation guard after a reload; failed mark-read is styled as waiting while an unresolved reply exists. Both reproduced in isolated actual-source diagnostics; lower-priority UX failures, not access-control weakening.

The appendices attribute these later claims to the prior review documents and distinguish independent checking from imported results. Their earlier provisional positive conclusions are explicitly superseded where these checks found defects. No external reviewer's “ship” label is treated as release authorization.

## Reproduction and publication

The two actual-component regression files are deliberately outside normal Jest discovery because this audit records unresolved defects. To rerun them from the repository root with the existing Jest configuration:

```powershell
npx.cmd --no-install jest --runInBand --testMatch '**/outputs/audit-20260924/*.repro.test.tsx'
```

Both files were discovered by a separate `--listTests` check. The three failure results already executed against bc127755 are retained in `outputs/audit-20260924/client-bc127755-result.json`; these are expected-behavior failures, not passing regression tests.

The control generator ran at **2026-09-24T15:00:27Z**. The existing Claude artifact was updated through its normal file input and reloaded; the new timestamp, version **38f199bc** and counts **30 / 32 / 0 / 62** persisted. These are control-row statuses, not a new-bug count or completion percentage. The older DEV certificate snapshot remains dated separately because fresh private checks were denied.
