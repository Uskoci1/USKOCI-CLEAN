# USKOČI — product execution continuation

Updated 2026-09-22. Read this checkpoint before older handoffs. It records implementation and
bounded independent audits, not a claim that the entire codebase or all live server functions
were freshly re-read. The owner's latest messages authorize rapid concrete client work and
multiple agents; they supersede the historical solo restriction.

## Workspace and read order

Only work in:
`C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN/.claude/worktrees/uskoci-kompletan-audit-2e715e`

Branch `work/pre-v3-engine-integration-20260911`, remote `Uskoci1/USKOCI-CLEAN`.
Latest implementation commit at this checkpoint: `9286fdebbb4b7afea7a5e67889cdafb89e1d6928`.
Later documentation commits are expected: inspect `git status`/`git log`, never reset to this hash.

1. This file, current top of `AGENTS.md`, `USKOCI_CURRENT_STATUS.md`.
2. `APP_FINISHING_PLAN_20260922.md` (single R1–R9 release plan).
3. `OWNER_DESIGN_DIRECTION_20260922.md`, `v5-ai-first/UX_NACRT_20260922.md`.
4. `functional-audit-20260922/REPORT.md` and approved D1–D10; the 48-section screen matrix.
5. `docs/control/README.md`, current `redovi.json`, `stanje.json`, and snapshot timestamp.
6. The current slice receipt and four reconciliation reports linked below.
7. Before server work, the package-specific candidate/proof/receipt and mandatory older server handoff.

Paths in items 1–4 and 6–7 are relative to `docs/implementation/` unless written otherwise.

## What changed in this execution round

| Commit / evidence | Concrete behavior | Acceptance limit |
| --- | --- | --- |
| `50178e6b`, OFFER_REVIEW | Explicit review of total/people/time/message before offer send; original validation/journal/recovery retained. | Real phone review and Android Back preserved a local draft; no offer sent. |
| `d56a5726`, OFFER_LANDING | Confirmed receipt routes to its application ID; target is visible or explicitly unavailable; ordinary rows no longer expose stale-only review controls. | Three new regressions fail before, 242 suites / 4709 pass; real post-submit path not exercised. |
| `45a779c7`, OFFER_READABILITY | Colored fact cards, wrapping total/people, shorter visible commands with full accessibility labels, actual candidate note preview, better-aligned composer inputs. | 242 / 4710, final types +96 focused; exact phone APK installed, existing selected application inspected. |
| `9286fdeb`, PRODUCT_EXECUTION_RECEIPT | Explicit Agreement completion review for both sides; read/focus/account-bound review, single confirmation; candidate accessible message facts; missing rating says unavailable, not new account. | Combined 242 / 4719 assertions pass and types clean; runner teardown status, final APK/device and Claude acceptance are recorded separately in receipt. |

`complete()` business-command body is unchanged. Existing server actionState remains authority.
An open problem blocks automatic completion, but does not remove permitted explicit requester
confirmation. Do not add that prohibition in UI. Agreement title is current task context;
price/time and people reuse the existing terms projection, not a newly invented immutable snapshot.

No database, Edge, server policy, dependency, key or provider was changed/called in this round.

## Native/build evidence and phone use

- Exact final build: GitHub Actions `35775425984`, source `9286fdeb`. Read
  `functional-audit-20260922/PRODUCT_EXECUTION_RECEIPT.json` for final build/install outcome.
- Preceding installed phone build: `35773412874` / `45a779c7`, SHA256
  `1a5072a53d74416fec85b245db483428126474df32f2d375773344f4c89e08e9`.
  Installed with `adb install -r`, retained login; actual selected application, amount/people,
  colored icons, shorter Agreement action and active Home section visually checked.
- Earlier native offer-review check on `50178e6b`: opened an existing published task, entered
  4500 in an unsent local draft, opened review, saw the fixed send footer, pressed Android Back,
  and confirmed the amount was preserved. No submission or other business mutation.
- Existing inspected Agreement was already completed; review link and accepted conditions were
  visible. There was no suitable active Agreement observed for real completion testing. Do not
  fake one or claim the new confirmation was exercised on the phone based on browser fixtures.
- Phone: adb serial `A8QDVB6522001205`, package `rs.uskoci.dev`, activity `.MainActivity`, scheme
  `uskociapp`. ADB is at `C:/Users/user/AppData/Local/Android/Sdk/platform-tools/adb.exe`.
  Emulator `emulator-5554` also exists: always specify target. Physical font scale was 1.15,
  unchanged. Screenshots are 1264×2728; rendered tool images may be resized—use original coordinates.
- The owner authorized connected-phone checking and retained-data installs. Re-check foreground
  before every interaction; he sometimes opens another app. Never capture unrelated private UI.
  Local `outputs/native-product-review-20260922/phone-ui.py` guards app-only capture. Its XML can
  contain private data and must not be committed. Do not bypass login or copy sessions.
- Current DEV build disables preview Firebase configuration. It proves UI checks, not FCM delivery.
  See RELEASE_OPERATIONS_RECONCILIATION for the separate push-capable build gate.

Build verifier: `python outputs/native-product-review-20260922/verify-apk.py RUN FULL_SHA arm64-v8a`.
It verifies APK hash, source/tree/run attestations and ABI. Read-only browser preview at
`http://127.0.0.1:8882/` renders actual components against explicit local fixtures with no backend.
Completion views include both roles and an open-problem example; fixture buttons never mutate DEV.

## Whole-product reconciliation and next order

Four bounded reports describe inspected bodies and explicit exclusions. They supplement the
approved audit/control table; none is a competing completion tracker:

- `functional-audit-20260922/UX_EXECUTION_RECONCILIATION.md`: 24 journey groups, blueprint parity,
  implemented UI and missing native acceptance. Ordinary waiting-offer/time editing is not the
  same as existing stale-review UPDATE; verify the intended contract first.
- `functional-audit-20260922/CLIENT_ENGINE_RECONCILIATION.md`: client→service→contract evidence,
  including AI, media, safety, lists, messages, accounts and review authority.
- `functional-audit-20260922/RELEASE_OPERATIONS_RECONCILIATION.md`: actual build restrictions,
  push-capable configuration, policy/operator/payment/test-world and production gates.
- `functional-audit-20260922/VERIFICATION_COVERAGE_RECONCILIATION.md`: current proof/test reach,
  dated CI outcomes, exact known failures and what no test-count total establishes.

Continue in this order, parallelizing bounded independent work with one writer per file:
1. Complete current exact-build native/Claude acceptance and retain explicit incomplete scenarios.
2. F16 task-photo cancel: client calls `rpc_cancel_media_upload`, absent in saved catalog. Inspect
   current live predecessor and PKG-008 candidate, prove a forward-compatible proposal separately.
3. F05 public task/profile report/block: existing safety commands require an admitted account target;
   a profile UUID is not an account UUID. Propose the minimal safe context contract before UI wiring.
4. Discovery F06/F07, own-list F08 and chat F13: prove filter/count/paging/projection parity first.
   Inbox and Agreement list are already paged. Do not claim all lists are unpaged or page only one
   subset then search locally. Preserve named pending-command reconciliation.
5. Finish task creation, selection, truthful Agreement progress/source links, incoming chat and
   notification destinations. Preserve existing uncertain-result and account-isolation mechanics.
6. Carry closure cross-device recovery, compatible pkg045b rollout, real push and full two-party
   Android/iOS paths as distinct technical gates. Operator/legal/retention, paid connection model,
   test-world removal, production/distribution/support/pilot remain public-release gates.

The owner wants a paid connection service for the first release. No approved collection model,
job escrow, worker payout, purchased credits or bank/store billing exemption may be inferred.
Dictation first; full spoken AI conversation later. No estimated completion percentage from tests.

## Server boundary and permissions

Canonical DEV only `leqcwgzvjsxugfgzdmth`; no production project. Last saved control snapshot:
`2026-09-22T13:49:06Z`, ledger197 =147 source +50 dev_alpha, recorded certificate65980fce.
This execution round did not refresh/re-certify that live state. The connector previously denied
independent direct private digest checks; historical successful atomic assertions are not a new read.

PKG-045b and its certificate change are already explicitly approved conditional on compatible
new-app verification. Do not ask again for that same approval; do not apply from a mere launch check.
New server/guard/recovery work requires the applicable separately proven proposal/approval.
Other closure-certificate moves or disabling verify_jwt need explicit approval each time.

Never handle/print secrets, make paid provider probes, create test accounts/data on DEV, perform
destructive operations or uninstall/clear the app. Speech only with explicit ready-to-speak input.
No new package beyond separately approved ones. No CodeQL, pkg023c, repair branch, force push or PR.
Frozen source migrations remain unchanged. Commit/push this branch is allowed.

## Control publication and concurrent files

After each slice update row facts, run `node scripts/control/osvezi.mjs`, then upload
`docs/control/stanje.json` via “Učitaj novo stanje” on the SAME owner artifact:
https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t . Generation is not publication.
Read `functional-audit-20260922/CONTROL_PUBLICATION.json`: supported browser file chooser timed out;
authenticated artifact was visible, but latest local snapshot upload was not confirmed. Do not loop
on the same failed attempt, claim publication, create another site or bypass the normal uploader.

Do not stage others' files: `docs/control/README.md`, `docs/control/tabla.template.html`, `.impeccable/`,
and the forbidden untracked `supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql`.
Local output helpers/screenshots/APKs/logs are not wholesale commit material. Stage explicit owned paths.
Do not delete foreign files to make migration checks green. See prior receipts for that known failure.

Keep English repo records and concise Serbian owner updates. Independent helper review is recorded;
it is not a substitute for the owner's requested Claude screen review. Tests, builds, phone paths,
live DEV and public-release acceptance each need their own evidence.
