# USKOČI — Codex continuation checkpoint, 2026-09-21

This supplements `NEXT_AI_HANDOFF_20260921_2145.md`; retain all owner boundaries and its reading order.
Work only in `C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN/.claude/worktrees/uskoci-kompletan-audit-2e715e`.
Branch remains `work/pre-v3-engine-integration-20260911`. No subagents, new dependencies, paid providers or device operations.

## Latest checkpoint: PKG-035 completed (supersedes the count investigation below)

**2026-09-22 continuation: PKG-036 client slice supersedes the client test/build status below.**
Read `v5-ai-first/pkg036/PKG036_LIFECYCLE_REFUSALS.md`. Definite lifecycle refusals now survive
adapter/controller/screen handling; malformed Agreement receipts retain recovery. Types passed and
the full local Jest report has 241 suites / 4644 passed, exit 0 (existing open-handle warning).
CI PKG-004 `35661988323` and PKG-007 `35661988415` succeeded with matching downloaded source receipts.
APK `35662001128`, source `0c01ac7b`, succeeded; downloaded SHA256 `b883d7a7…` matches checksum and
recovery/icon attestations. See `v5-ai-first/pkg036/APK_RECEIPT_20260922.json`. No phone operation.
No DEV write was made (read-only ledger191); all five remaining finding IDs stay open, with 7.1 partially
addressed. Current status index: `USKOCI_CURRENT_STATUS.md`. Read the new AI deadline investigation before
working on 11.1/11.2; it distinguishes the active accepted-review client path, the shared aborted completion
signal and the live 60-second claim fence. No AI fix or deployment was made. Phone-field decision is pending.

- DEV ledger **191 = 147 + 44**. PKG-035 applied as `20260921214247_dev_alpha_pkg035a_selectable_application_counts`.
- Proof `35658331088` at `3eaa5e55` passed 38 checks; exact text/body/ACL readback matches. Receipt
  `supabase/operations/dev-alpha/ledger/20260921_pkg035_application.receipt.json` and package document retain all evidence.
- 7.32 fixed: private shared classifier -> candidate states, owner computed field and Home aggregate.
  Actual proposal calendar and PKG-033 price assertion are used. Historical total remains separate.
  Owner computed field trusts only the ID of a supplied composite; foreign count null, anonymous refused.
- Client `62e90e92` uses the computed field in the existing task query, no per-task extra client calls.
  Home/cards/detail use selectable counts; unknown is never replaced with total. Types and full Jest
  **240 suites / 4606 tests passed**. Three regressions demonstrably fail on the former source/pass after.
- PKG-004 `35657744872`, PKG-007 `35657745051`, historical PKG-023j `35657744862` all succeeded.
- New APK **35657828926**, source `fe60a385`, includes PKG-035 client and **succeeded**. Downloaded
  `artifacts/apk-35657828926/USKOCI-DEV.apk`: SHA-256
  `2afcefc1044bc9b0c6f74c89ebe90d9c8411cf9616883cd4bb8462122ada4855`, 68,547,827 bytes.
  Matches checksum and both PASS recovery/icon attestations. Receipt: `v5-ai-first/pkg035/APK_RECEIPT_20260921.json`.
  No device operation or installation performed. Wait for the owner to be ready before using the phone.
- Previous APK35654417281 succeeded; downloaded under ignored `artifacts/apk-35654417281`, hash
  `af669ad295a70d8443aead32d3abfc1877e20e2a78bb681de3813e94c39d9675` matches attestations. It lacks PKG-035.
- Foreign untracked migration remains untouched. Local integrity refuses that extra file; CI tracked source147 passes.
- Remaining original findings: **7.41, 7.17, 7.1, 11.1, 11.2**. Phone/legal/second-device recovery decisions
  remain separate. Full Home aggregate wiring is still pending; do not claim all Home list scans were removed.
- Read `serverReceipt.ts` and 7.1 again while waiting: unknown business refusals still share the uncertain
  outcome fallback. No complete per-call audit or fix has been made; do not mark that finding fixed.

Proof traps learned: alias version interval fields explicitly (the response also has old interval columns);
the new classifier now explicitly lists columns. Local Auth automatically creates profiles. REST overflow
fixtures must name writable columns; `needs.approx_geog` is generated. These test failures were corrected
before application; every final scenario and the actual PostgREST read passed. No migration was rewritten
after application. The current candidate is frozen as applied.

## Completed in this continuation

- Read the entire original handoff, AGENTS and deep-read ledger before changes.
- Verified PKG-010 run 35646676736 succeeded. No repair was needed.
- Independently measured DEV ledger 188 (147+41), both active minute cron jobs, 120 successes each in the preceding two hours.
- Baseline types clean and 239 suites/4566 tests passed. APK 35643721833 exists and was not installed.
- Reconciled 29 historical findings against commits; did not blindly assert the old 50-fixed count. Commit `181369a9`.
- PKG-033 candidate and disposable harness committed (`fe2269d1`, fixture correction `0ea4d914`). Proof run
  35651463755 at `0ea4d9140964d649edfad05ae2235e7060b661ca` succeeded: 41/41 checks. Downloaded and inspected.
- Client `b4d5a5a9`: revision-bound price rules on stale application edits; fixed price/headcount controls, real
  refusal mapping. TypeScript and full Jest 240 suites/4596 tests passed; two monetary regression tests fail on
  the former production screen and pass after. No new APK has been built for these changes.

## PKG-033 applied to DEV, 2026-09-21

Read `v5-ai-first/pkg033/PKG033_APPLICATION_ADMISSION.md` and `PROOF_SUMMARY_20260921.json`.
Candidate file `supabase/candidates/pkg033a_application_admission_parity.sql` has:

- LF file SHA-256: `94eddcf1a866772a0dbe33d046299e10105ca3c1e74fcd1e5b5df4eb33cd7e22`;
- no-final-LF migration text SHA-256: `ce97b71655fe18168119c8776d108251205d3b7cbcf0a06cd87c9351f0f1b181`.

It patches submit, stale resolve and select, and adds one private price-rule helper. No data backfill, table,
trigger, existing ACL or certificate change. It checks pre/post bodies and certificate atomically. Proof
reconstructed the exact 41 recorded DEV changes and matched every patched predecessor body to current DEV.
The disposable certificate (`8248a4e5…`) remained unchanged and ready; never substitute it for DEV's `65980fce…`.

**Resolved prerequisite:** the current Supabase connector returned SQLSTATE 42501 for execution of
`private.closure_source_digest_v5()`. Do not escalate role, grant yourself rights, or route around this denial.
A text question asked the owner to run the following in canonical DEV SQL Editor and return only the nonsecret result:

```sql
select private.closure_source_digest_v5() as live,
       (select sha256 from private.closure_source_v5 where singleton) as certified,
       private.retention_ai_source_ready() as ready;
```

The owner supplied a canonical-project SQL Editor screenshot: both hashes equal
`65980fce17030f1d8b34177b8989549c2144bf806478238af39dec04b137a591`, ready = true.
Fresh live predecessor pins, missing helper/package and ledger188 were confirmed, then the tested candidate
was applied from the committed blob as `20260921204631_dev_alpha_pkg033a_application_admission_parity`.
Ledger is now **189 = 147 + 42**. Exact migration text hash above and all four `prosrc` body MD5 pins match
the disposable proof. The successful candidate asserted unchanged live certificate and readiness before commit.
A separate direct private post-read remains denied (42501); no privilege escalation or grant change was made.
Receipt: `supabase/operations/dev-alpha/ledger/20260921_pkg033_application.receipt.json`.
The owner already authorized this proven ordinary fix; no certificate move or JWT change occurred.

Pre-apply impact query: 0 stale-review-required applications; 0 current fixed-price mismatches among
SUBMITTED/DELIVERED/VIEWED/SHORTLISTED rows; ledger then188. No existing user data was rewritten.

## PKG-034 completed in the screenshot follow-up

- Read preparation, certified blocker authorities and actual ClosureDialog flow in full.
- Prepared/proved/applied `pkg034a_closure_preparation_blockers.sql`: only preparation body changes;
  it projects current hard blockers into the existing five-code receipt catalog.
- Run `35654209245` at `d5e42242` passed 25 checks. Downloaded report/source binding inspected.
- DEV ledger is now **190 = 147 + 43 dev_alpha**. Migration version `20260921210144`,
  text SHA-256 `5272abd67a3d051037cf9bd3662b4d30adeb5b0e823303e432e5672328d95fd1`,
  resulting body MD5 `2024fb850f50193253f5fbb7c016087c`, ACL/config match the proof.
- Successful candidate asserts unchanged live certificate and readiness. Direct private digest
  execution remains denied by the connector; never imply independent post-execution of it succeeded.
- Receipt and package document: `supabase/operations/dev-alpha/ledger/20260921_pkg034_application.receipt.json`,
  `v5-ai-first/pkg034/PKG034_CLOSURE_PREPARATION.md`.
- 12.10 blocker disagreement is fixed. Clarified its old claim: preparation itself never said executable
  READY and the dialog already uses execution review. Do not overstate a reproduced user-facing failure.
- Android APK run `35654417281` was dispatched from `d5e42242`; it includes client `b4d5a5a9`.
  Build was in progress at this checkpoint; verify outcome/artifact before claiming ready. No phone touched.

## Next findings investigated, not implemented

7.41 / remaining 8.18 need more than removing a client label:

- Preparation now uses the current hard blockers (PKG-034), but deliberately retains the legacy false
  execution/auth/media flags. Existing clients insist on those flags; changing that contract requires
  compatibility design. It is not in the explicit certified list; PKG-034 proved unchanged digest.
- Actual start/review use `private.closure_erasure_hard_blockers_v5`, which wraps the certified
  `private.closure_blockers_v5` and deliberately excludes some scoped holds/media/support cases from hard blocking.
  Do not accidentally replace that distinction with the older blocker list.
- `rpc_get_account_closure(uuid)` is owner-bound but the preparation client rejects restricted states.
- **Additional live-body evidence:** `rpc_closure_api_guard()` admits a restricted account only to
  `rpc_read_account_closure_execution`, `rpc_start_account_closure_execution`, and enumerated support RPCs.
  It blocks both the ordinary closure getter and execution review over REST. A fix using a new/ordinary getter
  on a second phone would therefore fail before reaching that getter.
- `rpc_read_account_closure_execution(uuid,uuid)` currently requires the locally saved START request key and
  returns found=false when that key is absent; it cannot discover execution on another device. That reader AND
  the API guard are certified functions. A proper account-owned recovery read through the permitted path
  therefore needs a proven certificate rebind and the owner's **fresh explicit approval** before DEV application.
  Do not weaken the guard or invent a successful start receipt from discovered execution metadata.
- Full bodies read: preparation, getter, review, start, read execution, hard blockers, document, progress,
  restricted predicate, support authentication and API guard. Only preparation changed in PKG-034.

Other open findings still need work: 7.17 public task column exposure; 7.32 candidate attention counts;
7.1 RPC refusal audit; AI deadlines 11.1/11.2. Do not mark these fixed from PKG-033.
7.17 investigation is retained in `v5-ai-first/PUBLIC_TASK_PRIVACY_INVESTIGATION_20260921.md`: 41 current
columns, whole-row invoker list/computed coverage and owner filters mean a blind grant restriction can
break current reads. No privacy grants or policies were changed.

### 7.32 next: preserve history, count selectable applications separately

Live full bodies read in the follow-up:
`rpc_home_attention()` body MD5 `7371d4cddcebead2cb86d8f795d2ee01`;
`rpc_list_need_candidates(uuid)` body MD5 `0b0d789cd5c4b8adcf0d025d4a5810e7`.
The home aggregate explicitly retains the historical compatibility count (every visible non-draft response).
Merely wiring it into Home therefore preserves 7.32. The client currently uses embedded response array length
for both total count and attention. Preserve history and add a separately named actionable count.

The candidate reader classifies SELECTABLE using profile readiness/capacity, revision, matching, task state
and remaining capacity. It does not yet mirror PKG-033's new final price assertion at selection; it also calls
`match_detail`, whereas reconfirmation validates the actual proposed calendar interval. Before treating its
canSelect flag as the sole counting authority, compare it against the complete selection function.
No new defect was reproduced from these differences, and no count change was implemented. Do not replace
the wrong count with a simplistic status filter or an unbounded extra RPC for every task.

Remaining original nine findings: 7.41, 7.17, 7.32, 7.1, 11.1, 11.2. Three were addressed by PKG-033/034.
This does not include the separately tracked legal/phone decisions or device verification.

## Pending owner decision and app plan

A separate text question asks approval for an optional profile phone number, without SMS verification, shared
only by explicit action in a Dogovor and never marked verified. Do not implement 8.4 until the answer arrives.
Show the short Serbian app plan from the original handoff before visual redesign. This turn made functional
price-control changes to the existing editor; no visual direction or design exploration was selected.

## Evidence and local files

- Downloaded CI artifact: `artifacts/pkg033-run-35651463755/` (ignored).
- Local Jest baseline/red/green logs and JSON: `artifacts/pkg033-local-tests/` (ignored).
- Retained compact proof evidence: `docs/implementation/v5-ai-first/pkg033/PROOF_SUMMARY_20260921.json`.
- Local migration integrity refuses the foreign untracked migration, as expected from the frozen inventory.
  Do not delete, edit, commit, or hide it. The CI tracked-source integrity step passed.
- Foreign file remains `supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql`.
- PKG-004 run35651612057 and PKG-006 run35651612168 both succeeded on client commit `b4d5a5a9`, including
  PKG-006's full regression. Their final conclusions were read after completion.
