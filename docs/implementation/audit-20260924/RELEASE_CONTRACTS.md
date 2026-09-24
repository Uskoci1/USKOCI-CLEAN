# Release and backend contracts audit — 2026-09-24

Scope: read-only source delta `3b8f389e..b1da968c`, branch `work/uskoci-ui-unification-20260924`. This report covers the new SQL candidates, saved application/proof receipts, affected client contracts, Android build configuration, and release/control claims. No application source was edited. No Supabase/API/provider calls, database writes, builds, or full test runs were made by this audit worker. The parent audit owns fresh DEV and CI observations; the saved receipt observations below are not presented as a new live query.

## Findings introduced in this delta

### RC-01 — P2: acknowledge only messages included in the completed read

**Location:** `supabase/candidates/pkg050a_agreement_messages_read.sql:70–75`; callers at `src/data/supabaseIzvor.ts:326–331` and `src/app/dogovor/[id].tsx:187–192`.

The new RPC accepts only an Agreement ID and marks every currently unread `MESSAGE_RECEIVED` event for that Agreement as read. The UI calls it after a separate message read; the call carries neither the IDs returned by that read nor a server-issued upper bound. Consequently a new message committed after the read snapshot but before the acknowledgment UPDATE is marked read without having appeared on screen. The notification can disappear while the displayed conversation still lacks that message. The effect also accepts an empty successful message array.

Deterministic interleaving from the code:

1. Party A reads messages through M1 (`supabaseIzvor.ts:295–299`).
2. Party B commits M2 and its notification before A's acknowledgment runs.
3. A calls `rpc_mark_agreement_messages_read(agreementId)` for the M1 render.
4. Its UPDATE matches M2's unread notification too. A still has the old array until another refresh.

The ownership and visibility restrictions are correct for *whose* events may be acknowledged; they do not establish *which messages were seen*. This is not cross-account disclosure. Add a validated server read watermark or precise message/event boundary, preserving the current party and delivery checks. A proof should force M2 between the read and acknowledgment and assert that M2 remains unread.

**Proof limit:** code establishes the interleaving; this worker did not run a database concurrency reproduction. The saved seven-check proof (`supabase/proofs/pkg050/pkg050_proof.mjs:100–114`, `docs/implementation/v5-ai-first/pkg050/PROOF_35826370830.json`) tests messages sent before acknowledgment and a message sent after the earlier acknowledgment. It does not test a message arriving between the client read and acknowledgment. The saved application receipt records this SQL as applied at ledger 201.

### RC-02 — P2: cancellation locks a READY asset before the conversation, opposite to existing media writers

**Location:** `supabase/candidates/pkg046a_media_upload_cancellation.sql:198–214`.

The new cancellation function takes the asset row lock at line 198 and, for a READY asset, invokes `rpc_remove_task_photo` at line 214. The existing removal function first calls `private.media_assert_task_edit`, which locks the conversation, and only then locks the asset. Completion uses the same conversation-then-asset order and explicitly documents that rule.

Supporting source: `supabase/migrations/20260912224647_clean_v5_owned_media.sql:57–63`, `:147–149`, and `:227–233`. No later replacement of the removal/helper/completion functions was found in the inspected candidates or DEV ledger files.

If a cancellation owns asset A while a removal (or a completion retry for READY A) owns its conversation C, cancellation waits for C and the other operation waits for A. PostgreSQL must abort one operation; the owner receives an unconfirmed cancellation/removal during the very recovery path intended to retire an uncertain upload. Two signed-in devices or an in-flight service retry provide concrete concurrent callers. The claim's per-command advisory lock does not serialize these existing writers because they do not take it.

Preserve the established conversation-then-asset ordering when entering the READY removal path and recheck the asset under the locks. Keep absent-command tombstone and late-claim fencing semantics intact. Prove the two physical lock orders against removal and completion retry.

**Proof limit:** this is a source-proven wait cycle, not a newly observed production deadlock. PKG-046's proof tests cancellation, late claim, settlement, READY removal, and closure sequentially (`supabase/proofs/pkg046/pkg046_proof.mjs:75–117`); it does not orchestrate these lock interleavings. Existing UI recovery retains an unconfirmed command, which mitigates permanent loss but does not prevent the operation failure.

### RC-03 — P2: every agreement collection now waits for one unbounded rating RPC per completed agreement

**Location:** `src/data/agreementClientService.ts:554–564`, connected at `:591`.

`mojiDogovori()` loads ALL agreement pages, up to 20 × 100 rows, then the new `withRatingsDue` starts a separate `rpc_get_my_agreement_review` for every COMPLETED row in one `Promise.all`. No concurrency bound, cancellation, batching, or per-request deadline exists in this enrichment. An account with 500 completed agreements now issues 500 extra requests on every Home/list/calendar refresh, even if the screen needs one upcoming agreement. One stalled ancillary review request withholds the entire otherwise-successful collection.

The Dogovori route and Home each impose an outer 15-second deadline (`src/app/(app)/dogovori.tsx:44–51`, `src/data/homeSnapshot.ts:44–51`). Thus a delayed rating request can make the whole agreement list fail or make Home's agreement section unavailable; these deadlines do not cancel the requests. `src/app/(app)/raspored.tsx:19` also consumes the same collection through an unbounded focused resource. The earlier eligibility fix is valid, but putting all historical review reads on the critical collection path introduces a scaling and availability regression.

Supply the caller's review eligibility in the authorized paged projection, or batch/bound and independently settle the enrichment while preserving an explicit unknown state. Verify request count at representative history sizes and keep active agreements available when a review read stalls.

**Proof limit:** fanout and all-or-nothing waiting are established directly by the source. No load test or real-network latency claim is made. Existing page fetching and public-profile fanout are older issues; the per-completed-agreement review fanout is new in this delta.

## What the backend receipts actually establish

The SQL files remain under `supabase/candidates`, but four are more than unexecuted candidates: each has a saved DEV application receipt. I independently hashed the **Git blobs at `b1da968c`** and their text without the trailing newline, avoiding working-tree CRLF differences. All four full-file hashes and trimmed ledger hashes exactly equal their saved receipt values.

| Package | Recorded application | Ledger after | Matching trimmed SQL SHA-256 | Recorded proof |
| --- | --- | --- | --- | --- |
| PKG-046a | `20260922220350` | 198 = 147 + 51 | `d49bf0c85487fbf89312d52a05f2bc5f2c46b17f86fb1ccee89f4582e89750de` | 35787119578, 10 checks |
| PKG-047a | `20260923012714` | 199 = 147 + 52 | `95c448063dbb7433330dad2e3442bfcaf7f93b4d22140a4cd335b8bd611234b5` | 35805442368, 10 checks |
| PKG-048a | `20260923012811` | 200 = 147 + 53 | `80c0512ed490b6145d21bd8a7ea291156d919fda00cce679617885ce66578832` | 35805788358, 7 checks |
| PKG-050a | `20260923064815` | 201 = 147 + 54 | `502cfcfbaa1cbdf239fdcb69c5a81aec9c524f92b6f39fc51d8537ff009c26c8` | 35826370830, 7 checks; reproof 35827171627 |

Receipts: `supabase/operations/dev-alpha/ledger/20260922_pkg046a_application.receipt.json`, `20260923_pkg047a_application.receipt.json`, `20260923_pkg048a_application.receipt.json`, and `20260923_pkg050a_application.receipt.json` in the same directory.

PKG-046 changes the owned-media schema and records rebinding the closure certificate from `65980fce…` to `cc248ff1…`. PKG-047/048/050 assert a consistent ready certificate before and after and record no certificate movement. The saved disposable proofs correctly disclose that their certificate hashes differ from DEV because their extension/schema inventory differs; they establish preservation/rebinding behavior, not equality with DEV's literal hash. Do not relabel those disposable digests as the production/DEV value.

The cancellation, safety-target, and message-read RPCs explicitly revoke PUBLIC, anon, authenticated, and service_role before granting authenticated only. Their bodies bind the actor to `auth.uid()` and use fixed `pg_catalog` search paths. PKG-047 repeats the public-profile visibility guards, including self, closing account, blocked pair, and cross-world suppression. Its disclosure of the target account ID is an explicitly recorded owner decision; it is not an accidental profileId/accountId substitution. PKG-048 adds only the two source IDs to the existing party-authorized workspace definition and preserves its remaining body and grants.

`supabase/functions/uskoci-media/index.ts:15` adds the safe `MEDIA_COMMAND_CANCELLED` error code. The saved PKG-046 receipt/handoff expressly says that Edge change was **not deployed**; the frozen control snapshot still lists media version 12. SQL application alone does not establish deployment of the Edge response mapping. Parent live source observations, if obtained, supersede this saved-state limit.

## Prior finding reconciliation

| Prior item | Current evidence and remaining boundary |
| --- | --- |
| F16, missing cancellation RPC | The missing-function defect is repaired in source and recorded applied via PKG-046a. The existing client already calls the exact two-argument RPC. Ten saved checks cover absence, tombstone, delayed claim, settlement, READY removal, owner ACL, and actual disposable account closure. Phone cancellation and deployed Edge safe-error mapping remain separate evidence; RC-02 adds a concurrency gap. Do not call task uploads or avatars generally broken solely from historical F16. |
| F05, safety target | PKG-047a is recorded applied; the typed service validates profile/account identity; public-profile safety entry resolves the target before navigation. Visible wiring exists from opportunity and candidate contexts. Saved proof covers visibility/authorization. This closes the missing account-target contract at that boundary, not every safety journey or moderation operation. |
| F06 | Still open: `src/data/supabaseIzvor.ts:182–200` walks up to 25 × 200 discovery rows before local filtering, throws beyond that, and performs subsequent enrichment. No new server pagination/filter contract in this delta closes it. |
| F07 | Still open: the discovery RPC call passes only limit/cursors, not the visible search/filter request. A redesigned filter screen is not proof of server search, distance, total, or flexible-time semantics. |
| F08 | Still open: current control A09 says the paged own-task projection lacks price basis and selectable-application count; own tasks continue to use `rpc_list_my_tasks`. None of the four new candidates extends that projection. |
| F09 | No new urgent-policy activation in this delta. Existing disabled-policy decision remains separate; UI styling does not close it. Fresh policy state belongs to the parent live audit. |
| F10 | Review, named landing, and readability are implemented. `device-20260923/ponuda-emulator/OFFER_RECEIPT.json` and `dve-strane/TWO_PARTY_RECEIPT.json` record actual submissions/selection at older source `332d285f`, not `b1da968c` acceptance. Do not repeat the original implementation; carry current-build and complete-journey gates. |
| F11 | Truthful missing reputation handling remains implemented; new list mapping preserves returned review counts only when disclosed (`src/data/supabaseIzvor.ts:107–117`). No new proof that every current device surface is accepted. |
| F12 | The missing workspace task/application IDs are recorded applied through PKG-048a and now mapped (`agreementClientService.ts:127–131`) and shown (`src/app/dogovor/[id].tsx:375–382`). The saved two-party receipt observed the links. This does not invent arrival/ETA/history evidence; D13 remains separate. |
| F13 | Still open: message read at `src/data/supabaseIzvor.ts:295–299` has no paging; the route has focused/manual refresh but no incoming-message subscription. PKG-050 settles notifications and does not implement live incoming messages or paged history. |
| PKG-045b / privacy 7.17 | **Still open; B is not among the new applied receipts.** `docs/implementation/v5-ai-first/pkg045/PKG045_TASK_COLUMN_PRIVACY.md:3–14` explicitly records A applied/B rollout hold and the authenticated table-level exposure of requester account ID, closing actor ID, and free-text close reason. Candidate B's ACL revocation is at `supabase/candidates/pkg045b_task_column_privileges.sql:112–114`. A's safer projection cannot prevent a caller selecting the old table columns directly. This is a previously known material privacy boundary, not a new delta regression. Owner approval already exists; compatible rollout verification remains the gate. B reads/rebinds the certificate dynamically; there is no literal stale-65980fce pin in that candidate. |

## Release and control evidence

- `eas.json:15–28` defines an Android store AAB profile, remote signing, remote version increment, and the same DEV/ALPHA public Supabase URL/key as the test app. `app.config.js:8–12` assigns `rs.uskoci` only to EAS profile `production`. This proves source configuration for the owner's internal-store-test direction, not an AAB artifact, signing identity, store upload, or production backend.
- Production deliberately has no preview Firebase file (`app.config.js:35–41`, `scripts/check-eas-preview.cjs:81–85`). The store preflight accepts that absence. Push delivery therefore remains a separate unresolved build/provider gate; a passing preflight is not push readiness. The new catch in `nativePushDevice.ts:30–32` makes provider failures `UNCONFIGURED`, preserving other settings but not enabling push.
- All nine `src/app/dizajn-*.tsx` gallery routes gate content on `__DEV__` or an Android package ending in `.dev` (for example `dizajn-ai.tsx:74–80`, `dizajn-dogovori.tsx:193–195`). The configured release package `rs.uskoci` does not meet that condition and shows the unavailable state. No source-level store-gallery exposure was found. A real release artifact was not inspected.
- `docs/implementation/RELEASE_CHECKLIST_GOOGLE_PLAY_20260923.md` separates public-release blockers from the proposed internal track: DEV backend/test-world accounts, unpublished legal material, push, crash monitoring, store assets/declarations, signing, and two-person device proof. Its final owner-decision section supersedes its earlier package/environment-pending wording. This audit does not independently validate external store policy assertions in that document.
- `docs/control/dev_snapshot.json` is dated **2026-09-23 06:51Z**. `docs/control/stanje.json:3–9` was generated on 2026-09-24 but still derives server state from that older snapshot and identifies source `74008989`, not the audited final head. A later generated timestamp does not make its DEV data or device proof current.
- There is a concrete control-prose inconsistency at `docs/control/redovi.json:1017`: D02 still says the next step is to add the two source links, while source already includes them and the same row's phone evidence says they were seen. AGENTS also retains the older PKG-048 “app does not show links yet” paragraph. Refresh the active next-action prose; do not mutate the frozen R4 historical evidence package to pretend it was originally current.
- The saved two-party journey reached COMPLETED through direct requester completion. Its `stillOpen` explicitly states that the worker's mark-done button was not pressed, both ratings were unproven, and push was off. “Two-party flow completed” must not stand for those unexecuted paths or for current-head release acceptance.
- Four new proof workflows were inspected. Their actual database checks are meaningful but bounded to their candidates. The parent audit owns current-branch triggers, latest CI and artifact provenance; historical green run IDs do not establish current-head whole-app acceptance.

## Audit limits and next verification

Read-only source and receipt reconciliation is complete at the stated delta. The three new findings require dedicated regressions: read/ack message interleaving; cancellation versus removal/completion lock interleavings; and bounded rating enrichment under history/load/failure. No fresh runtime reproductions or fixes are claimed. Fresh DEV catalog/hash/certificate outcomes, current CI status, native artifact identity, iOS acceptance, real push, and store submission must be reported from their own observed evidence.

## Bounded follow-up: proof-loader reproduction

### RC-04 — P1 release verification blocker: new initials import is absent from both proof-loader allowlists

**Locations:** `src/data/agreementClientService.ts:13`; `supabase/proofs/pre_v3/client_runtime.mjs:12–22`; `supabase/proofs/calendar/w02_calendar_integrity_proof.mjs:87–106`. The calendar loader's source-file inventory in `supabase/proofs/calendar/w02_calendar_integrity_loader.test.mjs:20–25` also omits the module.

The Agreement service now imports `../lib/inicijali`. Neither strict proof loader permits that module. Loading the current real Agreement service therefore fails during setup, before exercising its database contract. This is a deterministic verification regression, not an app-runtime failure or a claim that a workflow was freshly dispatched.

Reproduced at exact commit `b1da968c396434faa8e5455e6c0f960499206530` using isolated **in-memory source fixtures**. The actual loader function bodies and allowlists were extracted with the TypeScript AST from Git blobs. Their `readFileSync` input was supplied by `git show` for that same commit; the pre-V3 loader's own byte-for-byte `EXACT_CLIENT_SOURCE` checks remained active and passed on all 13 visited inputs. Thus the observed failure is not the working tree's Windows CRLF mismatch. No database, Auth, SDK, or provider operation ran, and no production file was edited.

Run from the audited repository root (PowerShell):

```powershell
@'
const assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=process.cwd(),sourceSha=cp.execFileSync('git',['rev-parse','b1da968c'],{encoding:'utf8'}).trim();
const blob=file=>cp.execFileSync('git',['show',sourceSha+':'+file],{cwd:root});
const reads=new Set();
const readGit=(file,encoding)=>{const rel=(path.isAbsolute(file)?path.relative(root,file):file).split(path.sep).join('/');reads.add(rel);const bytes=blob(rel);return encoding?bytes.toString(encoding):bytes;};
const ast=file=>ts.createSourceFile(file,blob(file).toString('utf8'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
const runtimeAst=ast('supabase/proofs/pre_v3/client_runtime.mjs');
const allowed=runtimeAst.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.text==='allowed')).getText(runtimeAst);
const loader=runtimeAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='loadPreV3Clients').getText(runtimeAst).replace(/^export\s+/,'');
const loadPreV3Clients=new Function('assert','createHash','execFileSync','readFileSync','root','resolve','relative','sep','dirname','vm','ts',allowed+'\n'+loader+'\nreturn loadPreV3Clients;')(assert,crypto.createHash,cp.execFileSync,readGit,root,path.resolve,path.relative,path.sep,path.dirname,vm,ts);
let error;
try{loadPreV3Clients({client:()=>undefined,session:()=>({user:{id:'10000000-0000-4000-8000-000000000001'},accountRevision:1}),sourceSha}).load('src/data/agreementClientService.ts');}catch(e){error=e;}
assert.match(error?.message??'',/^UNDECLARED_CLIENT_SOURCE:src\/lib\/inicijali\.ts$/);
console.log(JSON.stringify({sourceSha,loader:'loadPreV3Clients',result:'EXPECTED_FAILURE',message:error.message,exactGitBlobReadsBeforeFailure:reads.size,workingTreeBytesRead:0,dbProviderCalls:0}));
reads.clear();
const calendarAst=ast('supabase/proofs/calendar/w02_calendar_integrity_proof.mjs');
const connected=calendarAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='connectedCalendar').getText(calendarAst);
const report={input_sha256:{}};
const connectedCalendar=new Function('assert','readFileSync','createHash','ts','report',connected+'\nreturn connectedCalendar;')(assert,readGit,crypto.createHash,ts,report);
error=undefined;
try{connectedCalendar(undefined,'10000000-0000-4000-8000-000000000001');}catch(e){error=e;}
assert.equal(error?.message,'UNEXPECTED_PROOF_MODULE');
console.log(JSON.stringify({sourceSha,loader:'connectedCalendar',result:'EXPECTED_FAILURE',message:error.message,exactGitBlobReadsBeforeFailure:reads.size,hashedInputs:Object.keys(report.input_sha256),workingTreeBytesRead:0,dbProviderCalls:0}));
console.log('PASS: both actual loader bodies fail on the current import graph without a CRLF comparison failure; no database/provider operation ran.');
'@ | node
```

Observed output (the calendar's 14-path `hashedInputs` array is omitted here for readability):

```text
{"sourceSha":"b1da968c396434faa8e5455e6c0f960499206530","loader":"loadPreV3Clients","result":"EXPECTED_FAILURE","message":"UNDECLARED_CLIENT_SOURCE:src/lib/inicijali.ts","exactGitBlobReadsBeforeFailure":13,"workingTreeBytesRead":0,"dbProviderCalls":0}
{"sourceSha":"b1da968c396434faa8e5455e6c0f960499206530","loader":"connectedCalendar","result":"EXPECTED_FAILURE","message":"UNEXPECTED_PROOF_MODULE","exactGitBlobReadsBeforeFailure":14,"workingTreeBytesRead":0,"dbProviderCalls":0}
PASS: both actual loader bodies fail on the current import graph without a CRLF comparison failure; no database/provider operation ran.
```

To disambiguate the calendar's deliberately generic error, a second diagnostic changed only its in-memory function text by inserting `'../lib/inicijali':'src/lib/inicijali.ts'` next to the existing `vreme` entry. The same exact Git-blob graph then loaded successfully, with 15 hashed inputs and both expected service functions present. The added module hash was `c0ec6868ebcac1bdfac3686e7d416c2f24133090f826023e65338e7063595e2c`. This is a fixture-only diagnostic, **not an implemented fix**. Source/proof allowlists and their expected-file inventories still require an actual repair and fresh proof execution.

This follow-up adds the one bounded local runtime reproduction to the earlier source-only audit. RC-01 through RC-03 retain their original proof limits; no database concurrency or load test was performed.

## 2026-09-24 cutoff extension — `bc127755`

The parent froze the additional external changes at **`bc127755a85ced147b3979bdb6985ce8d0524291`**. This bounded follow-up reviewed `b1da968c396434faa8e5455e6c0f960499206530..bc127755a85ced147b3979bdb6985ce8d0524291`, concentrating on privacy/export/closure/support presentation and controller changes plus Agreement mapping. The parent owns types, focused/full tests, CI, devices, and live observations. This worker performed no database/device/provider action or production edit.

### Earlier findings at the extended cutoff

| Finding | Status at `bc127755` |
| --- | --- |
| RC-01, message acknowledgment boundary | **Unchanged/open.** The PKG-050 SQL and `supabaseIzvor.ts` are byte-identical to `b1da968c`; the route still calls the Agreement-ID-only acknowledgment at line 191. |
| RC-02, cancellation lock inversion | **Unchanged/open.** The PKG-046 SQL is byte-identical. No SQL/Edge changes exist in the added delta. |
| RC-03, rating enrichment fanout | **Unchanged/open.** AST extraction confirms `withRatingsDue` is byte-identical; it is now at `agreementClientService.ts:560–570`, connected at line 597. |
| RC-04, proof-loader admission | **Still reproducible, with an additional missing dependency.** The service now imports `../lib/tacanTermin` at line 8, while both loaders remain byte-identical and omit that module as well as `inicijali`. The calendar loader also needs the helper's `./calendarTime` import alias. |

Repeated the exact-Git-blob, in-memory setup method above at the new full SHA. The observed first failures are now:

```text
{"sourceSha":"bc127755a85ced147b3979bdb6985ce8d0524291","loader":"loadPreV3Clients","message":"UNDECLARED_CLIENT_SOURCE:src/lib/tacanTermin.ts","exactGitBlobReadsBeforeFailure":6}
{"sourceSha":"bc127755a85ced147b3979bdb6985ce8d0524291","loader":"connectedCalendar","message":"UNEXPECTED_PROOF_MODULE","exactGitBlobReadsBeforeFailure":7}
```

The earlier reproduction command applies with the Git ref changed to `bc127755` and the pre-V3 expected message changed to `UNDECLARED_CLIENT_SOURCE:src/lib/tacanTermin.ts`. A diagnostic copy of the calendar function still failed after adding only `../lib/tacanTermin -> src/lib/tacanTermin.ts` and `./calendarTime -> src/lib/calendarTime.ts`; also adding `../lib/inicijali -> src/lib/inicijali.ts` made setup pass. These changes existed only in an in-memory function string. The original allowlists and expected source-file inventory remain unfixed.

### Review of the added privacy and support behavior

- **Privacy:** `PrivacyPresentation.tsx` moves export/closure entries above the retention list and puts retry beside the failed read. It retains the existing published-policy and execution-admission distinctions, including the text that availability is not proof that a particular conversation was erased. No policy, retention writer, visibility rule, or client service changed.
- **Export:** `ExportPresentation.tsx:70` renders `READY_UNAVAILABLE` as a stopped download step, and its current-step accessibility wording now says “next” rather than claiming execution. Export status, request, delivery/download, cancellation, and file-saving commands are unchanged in this added delta.
- **Closure:** `ClosureDialog.tsx:60–64` moves the two existing unconfirmed messages into shared constants; line 95 labels foreground restoration as a refresh. `ClosurePresentation.tsx` distinguishes waiting from errors and labels its close control as leaving the review. The journal, explicit preparation/start, revision/policy checks, and account/focus guards remain unchanged. No new account-closure operation is authorized or executed by these presentation changes.
- **Support controller:** the controller delta only centralizes the same four strings in `supportCopy.ts`. Preparation, pending-command persistence/recovery, state identity, allowed actions, replay, cancellation, and mark-read sequence handling remain unchanged. The type-only import back into the copy helper does not create a runtime controller cycle.
- **Support forms:** `SupportNewScreen.tsx:123–155` adds a focused hardware-Back discard guard for an unsent typed draft and applies the same confirmation to navigation to privacy. It avoids falsely describing an in-flight or pending send as unsaved. Navigation still crosses the existing current-scope guard. The selected-message explanation is restored even when context and evidence refer to the same intentionally selected message (`:165–166`, `:205–210`); submitted evidence selection is not broadened.
- **Support details:** `SupportDetailScreen.tsx:47–54` now retains typed reply text across another party's case revision and clears it when an author/operator reply receipt for this case arrives. Command admission still uses the rendered current state and allowed actions. The changed source gives no basis to claim a real staff response, case decision, or privacy-request execution was tested.
- **Agreement mapping:** `agreementClientService.ts:132–136` adds `tacanTermin` from the already-accepted `terms.proposed_start_at/proposed_end_at`; malformed or absent terms leave the field out, while a present terms object without a valid exact window yields null. The existing helper validates ordered precise instants; this does not infer a new date from the current parent task. Apart from RC-04's loader regression, no additional actionable contract defect was established in this mapping change.

No additional privacy/export/closure/support contract finding was established by this bounded follow-up. That conclusion is source-limited; it does not promote these screens to current-build/native or server acceptance. All earlier release gates and saved-receipt limits remain in force at the extended cutoff.

## 2026-09-24 independent disposition of the `38f199bc` review notes

`38f199bc` adds documentation only, including `docs/implementation/design-system/cloud-handoff/round5b/privatnost-verify-iskustvo.md` and `privatnost-verify-zastite.md`. Those reviews originated on another worktree at `e9a82226` against `644cab09`; their verdicts and test totals were not imported as current-head evidence. The following two claims were independently checked against the frozen **`bc127755a85ced147b3979bdb6985ce8d0524291`** source and reproduced in bounded, in-memory diagnostics. They refine the preceding initial source-review conclusion; neither is an authorization failure or an unintended data mutation.

### RC-05 — P3: a discard confirmation becomes a no-op when the pending support reload settles

**Origin:** `privatnost-verify-zastite.md`, remaining issue 1. **Disposition: confirmed.**

`src/ui/support/SupportNewScreen.tsx:123` allows a typed unsent draft to ask for discard while LOADING. At `:136–142` the question stores the current render's `back` callback, and the privacy-link exit at `:224–225` likewise captures that render's navigation function. `useSupportController.ts:40–46` requires the controller snapshot to be the exact captured state object. If the reload settles while the question is open, that state object changes; confirming “Odbaci” closes the sheet but silently refuses navigation. The account, focus, and intent may all still be correct. `ConfirmSheet.tsx:95–104` explicitly retains the callbacks supplied when the question was asked.

An isolated diagnostic extracted the **actual** `current` and `navigate` declarations from the `bc127755` hook, kept owner/account/foreground constant, captured the confirmation in LOADING, then replaced the controller snapshot with READY. The saved exit performed zero navigations; a fresh callback with the new snapshot performed one. No React/native behavior was simulated beyond invoking the retained callback, so a full sheet/device reproduction remains separate. Resolve navigation through the latest same-owner callback while retaining account/focus guards; do not remove the guards globally.

### RC-06 — P3: failed support mark-read is misclassified as waiting when a reply is pending

**Origin:** `privatnost-verify-zastite.md`, remaining issue 2. **Disposition: confirmed.**

`src/ui/support/SupportDetailScreen.tsx:170–171` allows mark-read whenever the screen is not busy, including when a reply has an unresolved outcome. `SupportController.ts:129–135` retains that pending reply when a mark-read call fails. `supportCopy.ts:24–29` then treats any message with `pending` as `warn`, although this message concerns a failed read acknowledgment, not the uncertain send. The detail view reduces that warning to plain ink without an alert (`SupportDetailScreen.tsx:84`, `:131–132`), obscuring the failure.

An isolated diagnostic transpiled the **actual** `SupportController` and `supportCopy` from the Git blobs. With a stub service returning an unresolved AUTHOR_REPLY and a failed `markRead`, the resulting state was READY with the pending reply intact and the failure text present; `supportMessageTone` returned `warn`. Removing only `pending` made the same failure return `danger`. No real service, database, provider, or account was used. Track the operation associated with the message so pending-send uncertainty does not recolor unrelated failures; retain the pending reply and its recovery protections.

Observed diagnostic output:

```text
PASS stale-discard guard: old confirmation callback navigations=0 after LOADING→READY; fresh callback navigations=1; owner/account/foreground unchanged.
PASS actual SupportController+tone: failed mark-read retains pending reply and yields warn; same failure without pending yields danger. Stub service only, no DB/provider calls.
```

The experience review's cancellation-spinner and duplicate-absent-warning observations also match the source: cancel uses SENDING with the old pending kind, while the send controls derive their spinner from those fields; the recovery panel and ordinary message area can both render the absent warning. These remain minor presentation follow-ups, not additional release/security findings or proof that the support command executed incorrectly. The conflicting external “ship” and “fix first” verdicts do not alter this audit's release gates. No application/test files were changed, and no additional exploration followed these bounded dispositions.
