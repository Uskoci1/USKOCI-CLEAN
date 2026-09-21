# USKOČI — handoff, 2026-09-21 21:45 (Europe/Belgrade)

**This file supersedes `NEXT_AI_HANDOFF_20260919_2100.md`.** It is written for the next agent (Codex or another)
continuing from the same machine, the same worktree, the same GitHub repository and the same Supabase project.
Everything below was measured on 2026-09-21. Where it says "verify", verify before you rely on it.

---

## 0. Where you are

| what | value |
| --- | --- |
| Repo | `Uskoci1/USKOCI-CLEAN` (GitHub, remote `origin`) |
| Working branch | `work/pre-v3-engine-integration-20260911` |
| Last commit on it when this was written | `64a5b6e8` "PKG-030 final check: the workers accept the owner's secret key" (this handoff is committed after it) |
| Worktree that has this branch checked out | `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\uskoci-kompletan-audit-2e715e` |
| Main checkout (other branch; do not work there) | `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN` on `fix/r04-need-edit-route-20260908` |
| PR | #102 into `clean-alpha-backend` is **MERGED**. 79 commits have been added to the branch since, on 2026-09-21 alone. A new PR from this branch will be needed when the owner wants it merged; do not open one unasked. |
| Canonical DEV/ALPHA Supabase | project ref **`leqcwgzvjsxugfgzdmth`**, region eu-central-1, Postgres 17. There is no production project. |
| Migration ledger on DEV | **188 rows = 147 frozen source + 41 `dev_alpha`** |
| Certified closure source digest | **`65980fce17030f1d8b34177b8989549c2144bf806478238af39dec04b137a591`**. It is bound in `private.closure_source_v5`, `private.closure_erasure_source_v5`, the constant in `private.retention_ai_source_ready()`, and `closure_erasure_binding_v5().sourceSha256`. Live equals certified, and `retention_ai_source_ready()` is true. Every older `67730f62…` in the docs is historical. |
| Edge functions on DEV | `uskoci-ai-interview` v44, `uskoci-push-transport` v14 (`verify_jwt` false), `uskoci-data-export-worker` v14 (false), `uskoci-account-closure-worker` v3 (false), `uskoci-data-export-download` v14 (true), `uskoci-worker-interview` v15, `uskoci-speech-session` v15, `uskoci-location-search` v14, `uskoci-publication-evaluate` v13, `uskoci-qa-classify` v12, `uskoci-media` v12 |
| Vault on DEV | `uskoci_edge_base_url` = the DEV functions address. `uskoci_edge_worker_key` = the project's **`sb_secret_` secret key**, stored by the owner at 19:38 UTC; never print it. |
| Cron on DEV | `uskoci_marketplace_tick` (every minute); `uskoci_edge_workers` (every minute, `select private.edge_worker_tick_v5()`) |
| Edge secrets (owner-set) | `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED=true`. `EXPO_PUSH_TRANSPORT_ENABLED` is off by the owner's decision: push is turned on only after the phone test. |
| Tests | `npx jest`: 239 suites, 4566 tests, green. One suite, `w02-location-native`, can time out on this Windows machine and passes alone 22/22. `npx tsc --noEmit -p tsconfig.json` is clean. |
| Latest APK | GitHub Actions run **35643721833**, artifact **`USKOCI-DEV-APK`** (35.8 MB, expires 2026-10-05), built from `54eaf5ec`. It contains every app change of 2026-09-21. **Not installed on any phone yet.** |
| CI | Green on the branch: PKG-027, PKG-028, PKG-029, PKG-030, PKG-031, PKG-032 proofs, PKG-004, PKG-007, PKG-023f. **PKG-010 system contracts** is re-running as run **35646676736**; see §5.1. **CodeQL is red** with 6 alerts: owner-accepted debt, do not touch (see AGENTS.md). |

The untracked file `supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql` is **not
yours and must never be committed.** Leave it untracked.

---

## 1. The rules that do not bend

The owner's own words are still in force. Breaking one of them is worse than doing nothing.

1. **Talk to the owner in plain Serbian, with "ti".** He writes fast, with typos, from a phone. He is not a programmer.
   Repository documents and commit messages are in **English**.
2. **Evidence first.** Read the real code and the real database before you claim anything exists, works or is fixed.
   He has caught agents claiming things from a surface read. Every claim in a report must be something you measured.
3. **DEV changes, and what his approvals cover:**
   - **Blanket approval** (2026-09-21, "dozvoljavam sve" and "odobravam sve"). Every remaining deep-read fix may be
     proven on a disposable database, then applied to canonical DEV **without a separate question**.
   - **Stop and ask when:**
     - something deletes or changes real data beyond what the fix describes;
     - you need a secret, a legal text or the phone;
     - it is a product rule he has not decided.
   - **Moving the certified closure digest** needs his explicit word. He gave it once, for PKG-032 (12.8).
4. **`supabase/migrations/` is the frozen source-147 inventory.** A 148th file breaks assertions. A DEV change is a
   candidate in `supabase/candidates/`, applied as `dev_alpha_pkgNNN_<name>`.
5. **Forward-only.** Never rewrite an applied migration. The only exception ever made is F7
   (`docs/implementation/v5-ai-first/pkg023/F7_SOURCE_REPAIR_20260919.md`).
6. **Quarantine branch `repair/ru0-ru1-backend-20260902`:** never merge, cherry-pick or apply it. **`pkg023c`:** no
   activation.
7. **Nothing destructive:**
   - no `adb uninstall`, no `pm clear`, no factory reset;
   - no deleting accounts or data;
   - no destructive Supabase operation;
   - no change to production or shared resources.
8. **Secrets:**
   - no secrets in client, repository, logs or tests;
   - **never ask for a password, JWT, token or key, and never handle one**. He offered to let an agent type the key;
     the offer was refused;
   - **"Nemoj menjati ključeve":** do not create, rotate or change keys.
   - When you need a secret-bearing call, compose it inside the database from Vault, as §4 shows, and print only the
     answer.
9. **Data and cost:**
   - no paid AI or provider calls;
   - no test accounts created on DEV;
   - no fake data to simulate a completed flow;
   - no new or upgraded dependency without his word.

   Synthetic rows inside a rolled-back transaction on a disposable database are fine.
10. **Speech** is tested only when he says he is at the phone and ready to speak.
11. **Copy in the app:** "ti" everywhere, and only **OBJAVI ZADATAK** / **USKOČI I ZARADI** for the two sides. There is
    a guard test: `src/data/__tests__/v3-copy-no-internal-sides.test.ts`.
12. **Work solo.** He asked for no subagents.
13. **Turning off a gateway check (`verify_jwt=false`) needs his explicit sentence.** The Claude Code permission check
    refused it until he wrote one. Other agents should respect the same rule.
14. **Commit and push are allowed** on this branch (he said so). Never force-push. Never commit the untracked file above.

---

## 2. What the product is, in one screen

An Expo / React Native marketplace (Serbia) with a Supabase backend that owns every business rule. One account does
both sides: it publishes tasks (**OBJAVI ZADATAK**) and applies to other people's (**USKOČI I ZARADI**). An AI
conversation builds the task. A requester chooses among applications, which creates a **Dogovor** (Agreement).
Messages, completion, reviews, support, account closure and data export are all server-owned.

**No real person has yet gone through the whole path on a phone.** That is the biggest open item, and it waits for the
owner's "spreman sam".

---

## 3. What happened on 2026-09-21, in order

The day started from the **deep read**, `docs/implementation/v5-ai-first/DEEP_READ_LEDGER_20260921.md`. It has 137
entries: 32 defects, 14 risks, 15 rules, and 76 notes that were verified as fine.

- **Of the 61 real findings:**
  - **50 are fixed**;
  - **2 are partly fixed** (8.2, 8.4);
  - **9 are open** (§5.3).
- **The ledger's own markers lag behind the code.** Updating them is §5.2.

### 3.1 Server, each proven on a disposable CI stack, then applied to canonical DEV

| package | what it fixed | proof run | receipt |
| --- | --- | --- | --- |
| PKG-027 a–e | tasks keep being offered; stuck AI turns fail; "ti" in notifications; no invented profile text; price basis survives an edit. Push text in Edge v12. | 35594168645 | `20260921_pkg027_application.receipt.json` |
| PKG-028 a–b | a minute tick calls the three Edge workers (pg_net + Vault); past fixed-time tasks expire, and publishing a past start is refused | 35602743935 | `…pkg028…` |
| PKG-029 a–e | notification reach (4.1, 1.2, 12.9); lifecycle truth (1.1, 7.49, 12.7); relative schedules expire; Q&A while recruiting (7.47, 12.5); export refused honestly (6.2); **owner accounts in the TEST world (12.11, temporary)** | 35619942561 | `…pkg029…` |
| PKG-030 a (+ Edge) | the workers take the server key on `apikey`; the tick sends it there; three workers run `verify_jwt=false` | 35636346590 | `…pkg030…` |
| PKG-031 a–b | the requester cannot cancel after the worker says done (7.16); `private.work_kinds_v5`, a hidden list of 11 kinds of work, used only by matching (9.2/9.3) | 35640559729 | `…pkg031…` |
| PKG-032 a–b | the cancellation reason is kept as the canceller's Agreement message (7.15); the remaining-search guard is null-safe (12.8), **with re-certification of the closure source** | 35643688275 | `…pkg032…` |

All receipts are under `supabase/operations/dev-alpha/ledger/`. Each contract document is
`docs/implementation/v5-ai-first/pkgNNN/*.md`.

### 3.2 The workers and the key (PKG-028 → PKG-030)

- **The problem.** On DEV the Edge runtime's `SUPABASE_SERVICE_ROLE_KEY` is the **new `sb_secret_` key**, not the legacy
  JWT. The proof is in the gateway logs (`edge_logs` → `request.sb.apikey.apikey.prefix`). The owner first stored the
  legacy key, and it could never match.
- **The fix.** The workers accept the key on `apikey`, and the tick sends it there. The owner then stored the secret key.
- **Final check** (19:40 UTC):
  - push 200 `DISABLED`, because its switch is off;
  - export 200 `TICK_COMPLETED`;
  - closure 200 `MAINTENANCE_CHECKED`, so its switch is on;
  - the cron ran 120 times in 2 hours without a failure, and the tick answers `TICKED`.
- **Not yet seen on DEV.** No scheduled call has reached a worker, because there is no work: no push waiting, no
  closure, and the one export waits for a retention policy. The disposable e2e proves that path.

### 3.3 App, in git and in the APK above

- **Copy:**
  - "ti" everywhere and Serbian plurals (8.3, 8.8, 8.15, 8.21, 7.10, 7.34, 7.37);
  - truthful refusals (7.21–7.25, 8.4, 8.5, 8.6, 8.7, 8.19, 11.3).
- **Behaviour:**
  - 8.10: the application composer follows the price basis;
  - 7.28: the outbox is forgotten on logout;
  - 8.18: account closure asks once more before starting.
- **The owner's rules (PKG-031):**
  - Serbian time for every agreed time, with "(po vremenu u Srbiji)" on a phone set elsewhere (`src/lib/dogovorenoVreme.ts`);
  - no category is shown to people;
  - sign-up states "Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog
    pokretanja." instead of a tick for documents that do not exist (8.2);
  - no "Izmene i otkazivanje" row for the requester after done.

### 3.4 CI repairs

- `supabase/proofs/pre_v3/client_runtime.mjs` declares `lib/novac`, `ui/system/plural` and `lib/dogovorenoVreme`.
- `supabase/proofs/pre_v3/bounded_hygiene_proof.mjs` sets aside F7's repaired migration by its exact md5.
- `scripts/task_detail_read_preflight.mjs` declares `data/taskRelation` and `lib/novac`.
- The W02 calendar loader and its test declare `lib/novac` and `lib/dogovorenoVreme`.

**Lesson:** when a client service gains a new import, the bounded proof loaders refuse it until it is declared. Grep
for `UNDECLARED_CLIENT_SOURCE`, `W05_PROBE_UNKNOWN_SOURCE_MODULE` and `UNEXPECTED_PROOF_MODULE`.

### 3.5 For the lawyer

`docs/implementation/v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md` (Serbian) covers:
- the 15 data classes;
- the processors: Supabase eu-central-1, Google Gemini, Expo with FCM/APNs, LocationIQ, OpenFreeMap;
- a retention proposal for each class, each marked as a proposal;
- the questions for the lawyer.

It invents no operator data and no legal periods.

---

## 4. How a server change is done here (follow exactly)

1. **Read the live body on DEV.**
   ```sql
   select md5(replace(prosrc, E'\r\n', E'\n')), prosrc from pg_proc where oid = to_regprocedure('<schema.fn(args)>');
   ```
   Check whether it is a trigger function (`pg_trigger.tgfoid`) or on the certified erasure list (search
   `pg_get_functiondef('private.closure_erasure_program_digest_v5()')`). Either one means the digest moves, which
   means re-certification (PKG-032b pattern) and the owner's word.
2. **Write the candidate** `supabase/candidates/pkgNNNx_<name>.sql`. Copy the shape of `pkg031a_no_cancel_after_done.sql`:
   - an ALREADY_APPLIED check first;
   - md5 pins of every body it reads or patches, which raise `PREDECESSOR_DRIFT`;
   - `pkgNNNx_patch(ord, signature, anchor, replacement)` rows;
   - each anchor must occur **exactly once** in `pg_get_functiondef`, then `execute replace(def, anchor, replacement)`;
   - a post-check: the body equals `replace(old prosrc, anchors…)`, and grants/ACL, `prosecdef` and `proconfig` are
     unchanged;
   - the closure digest captured before and asserted unchanged after, plus `retention_ai_source_ready()`.
3. **Write the proof**, `supabase/proofs/pkgNNN/pkgNNN_proof.mjs`, and its workflow,
   `.github/workflows/pkgNNN-*.yml`. Copy PKG-031 or PKG-032.
   - **Chain:** live79 env → `replay_source147.py` → the `replay` mode of pkg027, 028, 029, 030, 031 and 032 in order.
     Each one applies the previous package's recorded texts, verified by sha256 of the file without its final
     newline.
   - **Your `replay`** applies PKG-032's two rows (sha prefixes `164006ec`, `724766ca`; full values in the receipt)
     and checks the DEV bodies you pin.
   - **Modes:** `before` (the defect reproduces), `apply` (tampered pin refused, apply, second application refused,
     exact surface diff with `supabase/proofs/pkg023/pkg023_surface.sql`, certificate unchanged), `after`.
   - **Scenarios:** fixtures under `session_replication_role = replica`, then `origin`; call the real RPCs as the person
     (`set local role authenticated` plus the jwt claims); roll back. Read the observation from the **last line** of
     psql output.
4. **Push.** CI runs the proof. Wait for green, then download the artifact report and read it.
5. **Apply to DEV.**
   - Re-check the pins on DEV first.
   - Then Supabase `apply_migration`, name `dev_alpha_pkgNNNx_<name>`, with **the committed file text without its final
     newline**. Get it with `git show HEAD:<path>`, not from the Windows working copy.
   - Verify:
     ```sql
     select encode(sha256(convert_to(array_to_string(statements, E'\n'), 'UTF8')), 'hex') from supabase_migrations.schema_migrations where name = '…';
     ```
     It must equal the sha256 of the file without its final newline.
6. **Record:**
   - a receipt JSON in `supabase/operations/dev-alpha/ledger/`;
   - an "Applied" section in the package doc;
   - a paragraph at the top of `AGENTS.md`.

   Then commit and push.

**Edge deploys** (Supabase connector `deploy_edge_function`):
- Name files by repo path (`supabase/functions/<slug>/index.ts`, `supabase/functions/_shared/…`), and send the committed
  bytes.
- Read back with `get_edge_function`. Copy the file contents into a scratch JSON and byte-compare with
  `git show HEAD:<path>`. The readback names files `functions/…`.
- A source containing literal `\uXXXX` text cannot be sent byte-exactly: the connector resolves it. That is true of
  `uskoci-ai-interview`'s `_shared/geminiTaskStream.ts`, so the byte-exact route there is the owner's CLI:
  `npx supabase functions deploy uskoci-ai-interview --project-ref leqcwgzvjsxugfgzdmth --use-api`.

**Calling a worker with the key, without seeing it:**
```sql
select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name='uskoci_edge_base_url') || '/functions/v1/<slug>',
  body := '{"action":"tick"}'::jsonb,
  headers := jsonb_build_object('Content-Type','application/json','apikey',(select decrypted_secret from vault.decrypted_secrets where name='uskoci_edge_worker_key')),
  timeout_milliseconds := 60000);
-- then: select id, status_code, content from net._http_response where id = <returned id>;
```

---

## 5. Exactly where the work stopped, and what is next

### 5.1 Check first: PKG-010 run 35646676736

- It runs on `64a5b6e8`, which includes both loader fixes. It was still in progress when this was written.
- It had been red since 2026-09-20. The last two causes found and fixed are in §3.4.
- If it is still red:
  1. read `gh run view <id> --log-failed`;
  2. find the next `not ok`;
  3. it is most likely another bounded loader that needs a pure module declared.

  Fix only what the evidence shows.

### 5.2 Bookkeeping: mark the ledger

`DEEP_READ_LEDGER_20260921.md` does not yet say **Fixed/Applied** for items that are fixed:

| items | where the fix is |
| --- | --- |
| 7.7 | push text, PKG-027c + Edge |
| 7.8, 8.27 | client, Serbian time |
| 7.10, 7.34, 7.37, 8.3, 8.8, 8.15, 8.21 | copy commit `2afe38f7` |
| 7.21, 7.22, 7.23, 7.24, 7.25, 8.5 | `cd93f961` |
| 7.28, 8.6, 8.19, 11.3 | `e3086650` |
| 8.7, 8.18 | `1a134cbf` |
| 7.16, 9.2, 9.3 | PKG-031 |
| 7.15, 12.8 | PKG-032 |
| 8.2 (partly), 8.4 (partly) | the parts below |

Add one line per item under its entry, in the style already used: `**Applied 2026-09-21: PKG-0xx** …` or
`**Fixed in the app 2026-09-21:** <commit>`.

### 5.3 The 9 open findings: each needs proof then DEV, under the blanket approval

| id | what | suggested approach |
| --- | --- | --- |
| 3.1 + 12.6 | The stale-application door (resolving an application after the task was edited) skips the price, world, readiness and evidence checks that `rpc_submit_response` applies. | Move the price rule into one private function both doors call. This is design work; read area 3 of the ledger first. It may touch several functions; check the certified list. |
| 12.10 + 7.41 | `account_closure_preparation` reports `PENDING_WORKFLOW` only for a running intake turn. `closure_blockers_v5`, which gates the start, also counts worker-profile and Q&A turns and a running export. So "prepare" says ready and "start" refuses. | Make preparation read the same blockers. **Check whether either function is on the certified erasure list before touching it.** |
| 7.17 | The table, not the allowlisted reader, is the privacy boundary for a public task: RLS and column grants on `needs` for `authenticated`. | Narrow the grants or policy so only the reader's allowlist is readable. Proof: a signed-in stranger reads nothing beyond the allowlist. This touches grants, not tables; verify that the digest is not affected. |
| 7.32 | "N prijava · čeka tvoj izbor" counts applications there is nothing to choose from. | Client/aggregate count fix. Read the entry. |
| 7.1 | Review of every client-callable RPC: the submit/select path maps every business code. | An audit. Produce a table and fix the gaps. |
| 11.1 | The AI 12-second ceiling. | Edge change to `uskoci-ai-interview`. Needs the owner's CLI deploy for byte-exactness, or the documented connector difference with his OK. |
| 11.2 | AI time limits, latent. | Same as 11.1. |

### 5.4 Partly fixed

- **8.2, legal consent.** The app now says honestly that the documents are not published. The real, recorded
  acceptance (`profil/pravna`, `legalClientService.acceptReviewedBundle`) is built. What it needs:
  - the owner's operator data;
  - a lawyer's texts, published into `private.legal_document_versions`;
  - then the sign-up consent comes back, bound to the published hashes.
- **8.4, "Podeli svoj broj".** The app now says why sharing fails (`PHONE_NOT_SET`). There is still **no screen that
  lets a person add a phone number**. The question was put to the owner: "add a phone field to the profile, no SMS
  verification, used only for sharing in an Agreement?" The recommendation was yes. **He has not answered yet. Ask
  again before building it.**

### 5.5 Waiting for the owner

1. **Phone test.** He says "spreman sam". Install the APK above with `adb install -r` (never uninstall), then walk one
   whole job: publish → apply → choose → Dogovor → done → review. About 10 minutes. Check that the phone shows this
   build.
2. **Push on**, after the phone test. He sets the Edge secret `EXPO_PUSH_TRANSPORT_ENABLED=true` (Supabase → Edge
   Functions → Secrets). Then watch the tick call the push worker for real.
3. **Operator data and the lawyer's answers** (§3.5). These unlock the legal documents, the consent and the data export
   (a retention policy row, then `data_export_policy_binding()` stops being null).
4. **The 8.4 phone field:** yes or no.
5. **Before real users:** remove `pkg029e` (owner accounts in the TEST world) with a new candidate that restores
   `private.account_visibility_world`.

### 5.6 After the findings: the app itself

The owner wants the app wired together and to look finished. A plan exists (it was made in plan mode and is not in
the repository). Summary:
- **A. Flows:** no path ends nowhere. Notification → screen, deep links, return after login, Q&A, group chat, review
  after the Agreement, support from where it broke, photo entry points, screens with no entry.
- **B. Composition of every screen,** in five groups:
  1. task from words to publication;
  2. lists;
  3. people;
  4. Agreement;
  5. profile and system screens.

  The rule, from `docs/implementation/v5-ai-first/pkg023/PKG023_UX_DEFINICIJA_20260918.md`: overline → title → one
  sentence → content (or an empty state) → one orange action. The Support screen already follows it.
- **C. Motion:** reanimated 4.5, the motion tokens in `src/theme/tokens.ts`, `useSystemReducedMotion`.
- **D. The auth screen:** the last island with raw sizes.
- **E. The tail of small items,** done as passes.

Show the owner the plan in short Serbian before starting: he decides how it looks. The visual authority is in
`AGENTS.md` (the 2026-09-20 HTML direction is a starting point, not a pixel lock).

---

## 6. How to verify anything here yourself

```bash
# from the worktree root
npx tsc --noEmit -p tsconfig.json
npx jest                                   # 239 suites; w02-location-native may time out on Windows, rerun alone
node --test supabase/proofs/legal/data_export_edge.test.mjs supabase/proofs/pre_v3/v5_closure_edge.test.mjs supabase/proofs/notifications/n09_push_transport_edge.test.mjs
gh run list --limit 10
gh run view <id> --log-failed
```

```sql
-- on DEV (read-only)
select count(*) from supabase_migrations.schema_migrations;                       -- 188
select private.closure_source_digest_v5(), (select sha256 from private.closure_source_v5 where singleton), private.retention_ai_source_ready();
select private.edge_worker_tick_v5();                                             -- TICKED; it calls workers only when they have work
select jobname, active, schedule from cron.job;
```

---

## 7. Traps that cost time on 2026-09-21

**Windows and git**
- **Line endings.** `core.autocrlf=true`. Blobs are LF, working copies CRLF. For exact bytes use `git show HEAD:<path>`,
  never the working file.
- **Counting CR.** `grep -c $'\r'` inside `printf "$(...)"` counted lines containing "r". Use `tr -cd '\r' | wc -c`.
- **Working directory.** Never `cd` inside a Bash call that the tool keeps: it moved the session's working directory
  once. Use absolute paths.

**Shell**
- The Bash tool un-escapes backslashes in heredocs and `node -e`. Edit code that contains backslashes with the Edit or
  Write tools.
- `tsc … | head; echo $?` reports head's exit code. Redirect to a file first.

**PostgreSQL**
- An IF condition ends at the first bare THEN. Parenthesise a CASE inside it.
- A regex repetition count cannot exceed 255 (`{16,4096}` is invalid). Check the length apart.
- Pick error codes that do not collide with existing client codes: grep `src` first.

**Proof fixtures**
- Agreements need an `agreement_versions` row, or the calendar trigger raises `AGREEMENT_CALENDAR_VERSION_MISSING`.
- Dispatch-prefilter scenarios need a worker with `available_now=true` and a FLEXIBLE need, or
  `worker_dispatch_time_admitted` is false. Add a control worker.
- **The disposable stack certifies its own closure digest** (it differs from DEV's). Assert that it is bound in all
  three places and that the readiness function's masked md5 is DEV's (`397094d2982821e4f2c48c02fb073c7c`). Do not
  assert DEV's value.

**Platform**
- `pg_net`'s schema grants to anon and authenticated come from the platform and cannot be revoked. Prove that the API
  refuses instead (`PGRST106`).
- The hosted gateway with `verify_jwt` on refuses `Authorization: Bearer sb_secret_…`. Send secret keys on `apikey`.
- **Classifier.** The Claude Code auto-mode permission check refused a readback after a `verify_jwt=false` deploy
  ("TLS/Auth Weaken") until the owner wrote the exact sentence approving it.
- **Bounded proof loaders** (§3.4) refuse any new client import until it is declared.

---

## 8. The one-paragraph version

Canonical DEV `leqcwgzvjsxugfgzdmth` is at ledger 188, with certificate `65980fce…`, ready.

- Six server packages were proven and applied on 2026-09-21 (PKG-027 to PKG-032).
- The three Edge workers run every minute with the owner's secret key.
- 50 of the 61 deep-read findings are fixed and 2 partly; §5.3 lists the 9 open, all covered by the owner's blanket
  approval to prove and apply.
- An APK with every app change is built (run 35643721833) and waits for the owner's phone test.

Next:
1. Check PKG-010.
2. Mark the ledger.
3. Fix the 9 open findings one proven package at a time.
4. Ask the owner the 8.4 phone-field question again.
5. Then show him the app plan (§5.6) before touching the look.

Report to him in plain Serbian, with "ti", and never claim anything you did not measure.
