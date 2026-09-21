# USKOČI — repository entry map

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

PKG-028 (2026-09-21, proven and **applied** on the owner's "kreni" to the written plan; ledger now **178 = 147 + 31**): `pkg028a` runs the three Edge workers from a minute tick
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

**Not approved** by that answer, and each needs its own decision:
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

**Start here (2026-09-19): `docs/implementation/NEXT_AI_HANDOFF_20260919_2100.md`.** It is the current
handoff: where the work stopped, every file touched and what each one is for, the owner's standing rules,
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
