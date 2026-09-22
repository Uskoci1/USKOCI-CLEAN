# USKOČI — repository entry map

Current status index: `docs/implementation/USKOCI_CURRENT_STATUS.md`. Read the mandatory handoff first;
the index separates implemented/proved/applied/built/device-verified states and points out older snapshots.

PKG-039 (2026-09-22, proven and DEV applied): independent bounded failure settlement for intake/worker,
no paid replay and no overwrite of committed success. Interview provider30s / native send55s;
ordinary RPC15s and SQL leases unchanged. Proof35675491926:330 Edge tests /16 SQL checks including
both observed completion/failure lock orders. DEV ledger194; unchanged ready closure65980fce asserted
atomically; exact candidate/authority readback. Intake46 / worker17 byte-verified, JWTtrue. Types and
241 suites /4650 tests pass. APK35675580983 pending; no device/provider-quality claim. See
`docs/implementation/v5-ai-first/pkg039/PKG039_INTERVIEW_RECOVERY.md` and receipts.
Q&A and the delayed process-crash sweep remain separate limits;11.1 is not wholly closed.

PKG-038 (2026-09-22, proven and DEV applied): AI dialogue action validation, finish handoff,
complete fact context, no-op filtering and delayed prose until owned completion. Full23-field review
cap is fixed. Ledger193; unchanged ready closure65980fce asserted atomically. Proof35674102419 passes
321 Edge tests /11 SQL checks. Intake v45 / worker v16 are byte-verified, JWTtrue. Native removes duplicate
historical fact decorations and treats UNKNOWN honestly:241 suites /4648 tests, types clean; build/device
pending. See `docs/implementation/v5-ai-first/pkg038/PKG038_CONVERSATION_SEMANTICS.md` and receipts.
No provider-quality claim: daily/repeated work decision, complex date semantics, long history and
interview timeout recovery remain open. Do not mark the whole semantic audit closed.

AI conversation semantic audit (2026-09-22, historical baseline):
`docs/implementation/v5-ai-first/ai-conversation-audit-20260922/REPORT.md` compares intended behavior,
current intake v44 / worker v15, 13 live SQL bodies and stored DEV dialogues. Repeated summaries and
questions after finish are observed; wrong relative dates, daily-price units and retained terms after
task changes are separate material findings. Eight offline diagnostics reproduce limitations; 123 existing
boundary tests pass. Neither establishes model quality or a fix. No DEV write/provider/device action;
ledger192. See the report before changing prompts or claiming the conversation is complete. Timeout
recovery11.1 and publication PKG-037 remain separate. Do not copy raw conversations into the repository.

PKG-037 (2026-09-22, proven and DEV applied): publication-only deep-read 11.2 recovery.
Separate preparation/provider/settlement deadlines, single settlement after a lost ACK, client 55-second
accepted-review wait and a bounded expired-review branch in the existing sweep. See
`docs/implementation/v5-ai-first/pkg037/PKG037_PUBLICATION_RECOVERY.md`. Local Edge 47/47, focused
client/native 80/80 and full Jest 241 suites / 4646 tests pass; types clean. Disposable proof35669180188
passes 18 checks on source2d6f0bc5. DEV ledger192; candidate text/body/ACL readback verified, certificate
65980fce… unchanged. Publication Edge v14 byte-equals proven source, verify_jwt=true; deployed with the
already cached CLI after a transient HTTP520. No credential read or paid call. APK35669226055 succeeded;
downloaded hash e47955fd… matches checksum and both source-bound attestations. No phone installed/tested.
Interview/worker/QA finding 11.1 remains separate and open. Finishing/growth
gates: `docs/implementation/APP_FINISHING_PLAN_20260922.md`.

PKG-036 (2026-09-22, client-only): first bounded slice of deep-read 7.1. Eleven live lifecycle RPCs and
ten selected guard/calendar bodies were read; exact MD5s and per-call comparison are under
`docs/implementation/v5-ai-first/pkg036/`. Task/Agreement refusal copy now survives screen/controller
handling. `AGREEMENT_CHANGE_INVALID_RECEIPT` is separate from rejected input and still requires recovery.
New regressions: 30 failed on former source, 34 pass after. Types clean; full local Jest
241 suites / 4644 passed and exited 0. CI PKG-004 `35661988323` and PKG-007 `35661988415` passed.
No DEV writes; ledger remains
191 at read-only preflight. No certificate/JWT/dependency/device change. 7.1 remains partial/open.
APK `35662001128`, source `0c01ac7b`, succeeded; downloaded SHA256 `b883d7a7…` matches checksum and
both recovery/icon attestations. See the package's `APK_RECEIPT_20260922.json`. Not installed/tested.
The baseline AI investigation is `docs/implementation/v5-ai-first/AI_DEADLINE_RECOVERY_INVESTIGATION_20260922.md`.
PKG-037 supersedes its publication reproducer; interview deadlines remain unresolved.

PKG-035 (2026-09-21, **proven and applied**): deep-read 7.32 now separates historical applications from
those currently selectable. Candidate list, owner computed field and Home aggregate share the classifier;
actual proposed interval and fixed-price rules match final selection. DEV ledger **191 = 147 + 44 dev_alpha**.
Proof `35658331088` passed 38 checks, including actual local Auth/PostgREST and Home overflow. Exact ledger
text/body/ACL readback matches. No user-data rewrite, certificate move or JWT change. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg035_application.receipt.json`; contract and proof:
`docs/implementation/v5-ai-first/pkg035/PKG035_SELECTABLE_APPLICATIONS.md`.
Client `62e90e92` passes types and 240 suites / 4606 tests; three new regressions fail before/pass after.
Home/cards/detail use the new count; historical totals remain accessible. New APK run `35657828926`
from `fe60a385` succeeded; downloaded APK hash `2afcefc1…` matches checksum/recovery/icon attestations.
See `docs/implementation/v5-ai-first/pkg035/APK_RECEIPT_20260921.json`. No phone installed/tested.
Older APK `35654417281` succeeded and its downloaded hash was verified, but does not contain PKG-035.
The full Home aggregate is still not wired; this fixes counts without claiming pagination/read reduction.
Remaining: 7.41, 7.17, 7.1, 11.1, 11.2, plus legal/phone decisions and device verification.
The foreign untracked frozen-folder SQL remains untouched; local inventory refuses it, tracked CI inventory passes.

PKG-034 (2026-09-21, **proven and applied**): closure preparation now projects the certified executor's hard
blockers into the existing five-code receipt contract (12.10). Ledger **190 = 147 + 43 dev_alpha**.
Run `35654209245` passed 25 checks; exact applied text/body verified. No certificate move, grant change,
existing-row rewrite or account deletion. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg034_application.receipt.json`.
Contract: `docs/implementation/v5-ai-first/pkg034/PKG034_CLOSURE_PREPARATION.md`.
7.41 legacy readiness flags and 8.18 recovery on another device remain open. Android build run
`35654417281` was dispatched on `d5e42242`; check its actual result before claiming an APK exists.

PKG-033 (2026-09-21, **proven and applied**): application admission parity for deep read 3.1 / 7.3 / 12.6.
Canonical DEV ledger is **189 = 147 + 42 dev_alpha**. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg033_application.receipt.json`.
Proof run `35651463755` passed 41 checks; the recorded migration text SHA-256 and all four resulting body
pins match the proof. The owner supplied the missing nonsecret closure preflight; the candidate asserted
the unchanged, ready certificate before committing. Direct private readback still returns 42501; do not
claim it was separately measured afterward. Client `b4d5a5a9` passes 240 suites / 4596 tests and types;
it has not been built into a new APK or tested on a phone. Scope:
`docs/implementation/v5-ai-first/pkg033/PKG033_APPLICATION_ADMISSION.md`.
Resume: `docs/implementation/NEXT_AI_HANDOFF_20260921_CODEX.md`. The foreign migration remains excluded.

**Start here (2026-09-21 21:45): `docs/implementation/NEXT_AI_HANDOFF_20260921_2145.md`.** It records the current
worktree, branch, canonical DEV state (ledger 188, certificate `65980fce…`), the owner's standing rules, everything
applied on 2026-09-21 (PKG-027 to PKG-032), the exact method for a DEV change, and where the work stopped. It
supersedes `NEXT_AI_HANDOFF_20260919_2100.md`. The paragraphs below remain the detailed record per package.

Latest visual clarification (2026-09-20): the supplied HTML is a starting direction, NOT a final
design or pixel lock. Refine hierarchy, layout, components, states and motion using product judgment;
preserve original brand/entry assets and actual business semantics. Read
`docs/implementation/v5-ai-first/DESIGN_PACK_EXECUTION_20260920.md` for the tools and next design round.
The owner explicitly requests the new direction. Read
`docs/implementation/v5-ai-first/HTML_DIRECTION_HOME_20260920.md` for the exact source
hashes, native adaptation and evidence. This supersedes preserving the previous authenticated Home
composition below; original brand/entry assets remain. This first Home/tab surface does not complete
the other screens, aggregate wiring or end-to-end device verification. Skills are implementation
guidance; they do not override the owner's latest visual direction.

CodeQL "Insecure randomness" (2026-09-21, owner-accepted as debt): the five `high` alerts have ONE
source, `src/lib/idempotencija.ts`, and the flagged files contain no `Math.random()` at all. The
fallback is the path that runs (RN 0.86.3 defines no `randomUUID`, no polyfill is installed), but the
value is a `clientRequestId` — an idempotency key behind RLS, not a secret — and the one failure mode
that would matter, a repeated PRNG sequence colliding two keys, is measured absent: 258 of 258
distinct, 0 shared prefixes, 0 malformed. The owner chose to merge and record rather than take a new
dependency. Full evidence and what would close it:
`docs/implementation/evidence/codeql-insecure-randomness-20260921/`. This accepts those six alerts
for that cause; a new alert is a new decision.

PKG-032 (2026-09-21, proven and **applied**, item 8 of the owner's "odobravam sve"): ledger now **188 = 147 + 41
dev_alpha**.
- `pkg032a` keeps the cancellation reason as the canceller's Agreement message (7.15).
- `pkg032b` makes the remaining-search guard null-safe (12.8). Because that guard is a trigger function, it also
  re-binds the certified closure source.
- **The certified digest is now `65980fce…`** in all three places, and the source is ready. Older paragraphs'
  `67730f62` is historical.
- A real account closed end to end on the new certificate in the proof.
- Contract: `docs/implementation/v5-ai-first/pkg032/PKG032_CANCEL_REASON_AND_GUARD.md`.

PKG-031 (2026-09-21, proven and **applied** on the owner's "odobravam sve" to ten numbered proposals): ledger then
**186 = 147 + 39 dev_alpha**.
- **Server:**
  - `pkg031a`: the requester cannot cancel after the worker says done (7.16).
  - `pkg031b`: `private.work_kinds_v5`, the hidden list of eleven kinds of work used only by matching, for
    exclusions and skills (9.2/9.3). No stored row changed.
- **App, in git and not yet in an installed build:**
  - agreed times in Serbian time with "po vremenu u Srbiji" (8.27);
  - no category shown to people;
  - sign-up says the legal documents are not published yet, instead of a tick that recorded nothing (8.2);
  - no "Izmene i otkazivanje" for the requester after done.
- Contract: `docs/implementation/v5-ai-first/pkg031/PKG031_OWNER_RULES.md`.

PKG-030 (2026-09-21, proven and **applied**; owner "kreni" to option A, then "odobravam sve"): ledger then
**184 = 147 + 37 dev_alpha**.

On DEV the Edge `SUPABASE_SERVICE_ROLE_KEY` is a secret key (`sb_secret_`), so the legacy key the owner stored could
never reach the workers. What changed:
- The workers now take the server key on `apikey`.
- The tick (`pkg030a`) sends it there.
- `uskoci-push-transport` v14, `uskoci-data-export-worker` v14 and `uskoci-account-closure-worker` v3 run with
  `verify_jwt = false` and check the key themselves.
- `uskoci-data-export-download` v14 keeps `verify_jwt = true`.
- All four are byte-identical on readback. Without a key, each worker refuses by itself.
- **Done 2026-09-21:** the owner stored the secret key. Push answers `DISABLED` (its switch is off), export answers
  `TICK_COMPLETED`, closure answers `MAINTENANCE_CHECKED` (its switch is on), and the minute tick answers `TICKED`.

Contract, status and receipt: `docs/implementation/v5-ai-first/pkg030/PKG030_WORKERS_SECRET_KEY.md`. The PKG-028
paragraph's key instruction is corrected there.

PKG-029 (2026-09-21, proven and **applied** on the owner's "dozvoljavam sve" to the written command): ledger then
**183 = 147 + 36 dev_alpha**. It covers 4.1, 1.2, 12.9, 1.1, 7.49, 12.7, 7.47, 12.5, 6.2, 12.11 and the relative
schedules ("danas"/"sutra"/"ove nedelje" now expire).
- **Temporary:** `pkg029e` puts the owner's accounts in the TEST world while testing. Take it out before real users.
- Contract: `docs/implementation/v5-ai-first/pkg029/PKG029_SERVER_ROUND.md`, including what is deliberately not in
  this round (7.15, 3.1/12.6, 7.16, 8.27, 9.2/9.3, 11.1/11.2, 12.8, 12.10, 8.2).
- The ledger count in the PKG-028 paragraph below is historical.

PKG-028 (2026-09-21, proven and **applied** on the owner's "kreni" to the written plan; ledger was then **178 = 147 + 31**): `pkg028a` runs the three Edge workers from a minute tick
(pg_net + a Vault key the owner stores), which makes account deletion (6.1), export (4.2) and push actually run.
`pkg028b` expires fixed-time tasks whose window is over and refuses publishing a past start (5.1). The disposable
proof passed (run 35602743935). The tick sends nothing until the owner stores the key and sets
`USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED` (receipt `20260921_pkg028_application.receipt.json`). Read
`docs/implementation/v5-ai-first/pkg028/PKG028_WORKERS_AND_PAST_TASKS.md`. The client side of 8.10 and 5.1 is in
git, but not in any installed build.

PKG-027 (2026-09-21, owner-approved and applied): the deep read
(`docs/implementation/v5-ai-first/DEEP_READ_LEDGER_20260921.md`) found real server defects. The owner
approved this round with "odobravam sve to". Contract, proof and application:
`docs/implementation/v5-ai-first/pkg027/PKG027_OWNER_APPROVED_FIXES.md`. The disposable proof passed
(run 35594168645). Five candidates are applied to canonical DEV, each byte-identical to its file:
- `pkg027a`: a task keeps being offered to workers;
- `pkg027b`: stuck AI turns are failed by the tick;
- `pkg027c`: notifications use "ti", including the stored ones;
- `pkg027d`: no invented profile headline or bio;
- `pkg027e`: the price basis survives an edit.

The push text is deployed as Edge `uskoci-push-transport` v12, byte-identical on readback. Canonical DEV
ledger was then **176 = 147 frozen source + 29 dev_alpha** (current count: PKG-028 paragraph above). Digest `67730f62` live = certified, and
`retention_ai_source_ready()` is true. Receipt:
`supabase/operations/dev-alpha/ledger/20260921_pkg027_application.receipt.json`.

**Not approved** by that answer, and each needs its own decision. *(Historical: 7.47, 12.5, 12.7, 12.9 and 12.11 were
later approved and applied in PKG-029; 3.1, 11.1, 12.8 and 12.10 remain open.)*
- the stale-application price door (3.1);
- Q&A statuses (7.47);
- the phone filter (12.5);
- remote/physical execution mode (12.7);
- 12.8, 12.9, 12.10;
- the AI 12-second ceiling (11.1);
- the owner's real tasks being invisible to test workers (12.11).

No device pass has been done.

Price basis (2026-09-20, owner-approved and applied): a task can say what its price is FOR, and an
application is priced by it. Read `docs/implementation/v5-ai-first/pkg025/PKG025A_PRICE_BASIS.md`.
The owner authorized this chain explicitly on 2026-09-20 ("sve dozvoljavam", "Cena", "ajde kreni",
"primeni pkg025d"), which **supersedes** the earlier sentence below withholding `price_basis`.
Applied to canonical DEV: `pkg025a` (the column and its CHECK), `pkg025b` (`rpc_submit_response`
prices an application by the basis), `pkg025c` (the bounded marketplace reader returns it), and
`pkg025d` (the `need.price_basis` fact key, its TOTAL/PER_PERSON rule, and the write in both review
writers). Canonical DEV ledger was then **171 = 147 frozen source + 24 dev_alpha** (current count:
PKG-027 paragraph above), digest `67730f62`
live = certified, `retention_ai_source_ready()` true, confirmed by readback. All 18 tasks keep a null
basis, so nothing existing changed. The Edge function was deployed by the owner the same day
(version 42, all four assets byte-identical on readback, `OPTIONS` 200, `verify_jwt` unchanged), so
the AI can now ask "ukupno ili po osobi". **Still open:** no device pass, and the house
disposable-database proof was not run. The material
list / fingerprint / edit-history step remains its own package; it is not a precondition, for the
reason recorded in that document.

Latest follow-up (2026-09-20 local): after the three mandatory handoff/owner-decision/AGENTS reads,
read `docs/implementation/v5-ai-first/pkg023/PKG023J_HOME_ATTENTION.md`. The owner separately approved
ONLY pkg023j, conditional on ready private preconditions. Its exact CI-proven transaction passed both
private checks before/after creation and was applied as `20260919221214_dev_alpha_pkg023j_home_attention`.
Canonical DEV ledger was **165 = 147 frozen source + 18 dev_alpha** at that moment; see the PKG-027
paragraph above for the current count. The aggregate is installed but not wired into the client. F02,
paging, final UI and device verification remain open. Other DEV migrations still need a separate
explicit owner decision; the older general AF-D26 authorization below does not override that newer
boundary. **No pkg023c activation is authorized.** The sentence that also withheld `price_basis` is
**superseded** by the owner's explicit approvals of 2026-09-20 recorded above — do not read it as a
current block. The historical handoff's counts are not current live counts.

Latest client follow-up: read `docs/implementation/v5-ai-first/APPLICATION_COMMAND_RECONCILIATION_20260920.md`.
My applications now reconciles a pending command against its exact owned response row, independently
of the displayed list. It remains unpaged; this does not complete Home wiring, notification paging
or a device proof. No additional DEV migration was needed or applied for this client correction.

Later local follow-up (2026-09-19): after the mandatory handoff/owner-decision reading below, read
`docs/implementation/v5-ai-first/CLIENT_RELIABILITY_20260919.md` for the F01/F07/F08 client corrections
and their exact verification scope. They do not authorize canonical DEV writes or close pkg023j.

**Historical (2026-09-19; superseded by the 2026-09-21 handoff at the top): `docs/implementation/NEXT_AI_HANDOFF_20260919_2100.md`.** It was the
handoff of that day: where the work stopped, every file touched and what each one is for, the owner's standing rules,
the six migrations applied to canonical DEV that day, and the next piece of work stated exactly. It
supersedes `NEXT_AI_HANDOFF_20260911_0504.md` and its manifest, which record a SAFE STOP that was lifted.

Current entry (PKG-012, 2026-09-16): read `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md`
first. It names the one current authority chain (reconciliation, Execution Ledger, owner
decisions, PKG-011B design system) and marks every older checkpoint historical.

Current resume: owner explicitly requested V5 AI-FIRST implementation on 2026-09-12.
Read `docs/implementation/v5-ai-first/OWNER_PRIVATE_TEST_DECISIONS_20260913.md`
first: latest AF-D26 authorizes verified backend promotion on canonical
DEV/ALPHA `leqcwgzvjsxugfgzdmth` for the connected private APK. Do not create
extra staging or reset donor labs. A distinct future production project remains
outside this authorization. Then read `docs/implementation/v5-ai-first/EXECUTION.md` for the active package,
known AF-01–AF-06 decisions and current work. This supersedes the historical SAFE
STOP and older auth/per-fact UX locks below. The existing CLEAN authority,
integration branch and private boundaries remain. AF-D26 authorizes verified
canonical DEV/ALPHA changes; the separate production gate remains.

Owner persistent skill selection (2026-09-13): read
`docs/implementation/v5-ai-first/DESIGN_SKILLS.md` and apply its nine locally
installed design/native skills to relevant USKOČI work. User/V5 decisions win
over skill examples; preserve the original entry/mascot/motion/HOME.

This is an existing Expo/React Native marketplace with Supabase authority. Do not restart it or create another product master.

Read in this order:

1. `docs/authority/AUTHORITY_INDEX.md`: newest owner commands, final21/21 review, complete50-row reconciliation and explicit supersessions. Latest explicit owner decision wins. Never turn a historical proposal into approval.
2. `HANDOFF.md`, the top checkpoints of `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `CURRENT_IMPLEMENTATION_STATUS.md`, `IMPLEMENTATION_CONTINUITY.md`, then the linked latest `NEXT_AI_HANDOFF_*.md` and `NEXT_AI_HANDOFF_MANIFEST.json`. Physically read Git/CI/live metadata; actual newer state wins implementation facts.
3. Product/architecture sources named in the authority index. CLEAN/Supabase owns business rules; keep existing RPC/RLS/revision/idempotency boundaries.
4. Active V5 visual authority is the supplied sibling `USKOCI_V5_AI_FIRST_PAKET/07_REFERENCA/USKOCI_SPOJ_V4_9_COMPOSITION.html`, preserved in `01_HTML/USKOCI_V5_AI_FIRST.html`, together with the full V5 command. Preserve its entry composition, original photographs/SVG notes, mascot, timing and HOME signature. The older repository SPOJ V2/referenceEntry donors do not override V4.9. Use true RN/SVG and original assets, without a WebView or the HTML demo runtime. See `docs/implementation/v5-ai-first/NATIVE_CHECKPOINT138_REVIEW.md` for the discovered older native composition and the pending V4.9 correction.
5. Legal/policy sources, the supplied RC2 package and current V5 owner decisions. RC2 content has been received; AF-D22 supersedes the old retention proposal. Follow the documented adaptation and exact executable readiness, without inventing operator details, legal certification or retention periods. Old missing-package requests are historical.
6. `docs/authority/sources/closure-plan/USKOCI_RADNI_PAKETI.json` and current owner execution command: W03–W13 scope, current cursor and parent flows. Old package physical status is historical.
7. Existing proof/evidence only for the affected risk; exact run/source scope matters.

Root is the sole integrator/live writer. Isolate subagent file ownership. Reuse existing code. Targeted checks during development; full regression/migration/security/CodeQL/device gates at major integration, complete vertical journey or release candidate. No secrets in client/repository/logs/tests. Do not request passwords/JWT.

Migrations are forward-only; never rewrite an applied migration. Keep quarantine branch `repair/ru0-ru1-backend-20260902` isolated: never merge, cherry-pick or apply it. Preserve existing Auth/RLS/concurrency and controlled live preflight/postflight gates.

The earlier owner SAFE STOP is superseded by the active V5 resume and AF-D26 promotion decision above. The previous long AGENTS is preserved, **HISTORICAL**, at `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md`. It is not the active reading order or cursor.
