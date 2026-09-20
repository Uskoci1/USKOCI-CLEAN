# USKOČI — handoff, 2026-09-19 21:00 (Europe/Belgrade)

**This file supersedes `NEXT_AI_HANDOFF_20260911_0504.md` and its manifest, which record the owner's
SAFE STOP of 2026-09-11. That stop was lifted on 2026-09-12 (V5 AI-FIRST resume) and again on 2026-09-19,
when the owner authorised the V3 work described below. Read this file, then
`docs/implementation/v5-ai-first/pkg023/OWNER_DECISIONS_V3_20260919.md`, before touching anything.**

---

## 0. Where you are

| | |
| --- | --- |
| Repo | `Uskoci1/USKOCI-CLEAN` |
| Working branch | `work/pre-v3-engine-integration-20260911` (PR **#102**, base `clean-alpha-backend`, OPEN, MERGEABLE, 100+ commits) |
| Worktree on this machine | `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\uskoci-kompletan-audit-2e715e` |
| Canonical DEV/ALPHA Supabase | project ref `leqcwgzvjsxugfgzdmth` |
| Migration ledger on that project | **164 rows = 147 source + 17 `dev_alpha`** |
| Edge | `uskoci-ai-interview` **v41**, `uskoci-worker-interview` v13, `uskoci-account-closure-worker` v1 |
| Tests | 232 suites / 4445 tests, green (`npx jest`, ~65 s) |
| Types | `npx tsc --noEmit -p tsconfig.json`, clean |
| CI on the branch | `PRE-P4 integrity` green, `PKG-023f closure source re-certification proof` green (12/12), `PKG-023 V3 bounded reads and public pin proof` green, **CodeQL red** (6 alerts from 2026-09-13 code, owner-recorded debt, do not touch) |

There is no production project. Everything below is DEV/ALPHA.

---

## 1. The rules that do not bend

These are the owner's own words, still in force. Breaking one of them is worse than doing nothing.

1. **No migration on canonical DEV without the owner's separate, explicit approval.** Write the candidate,
   prove it on a disposable database, report, and stop. He approves per item, not in general.
2. **`supabase/migrations/` is the frozen source-147 inventory.** A 148th file breaks seven assertions. A
   DEV change is a candidate in `supabase/candidates/`, applied as `dev_alpha_pkgNNN_*`.
3. **Forward-only.** Never rewrite an applied migration. The one exception ever made is documented in
   `docs/implementation/v5-ai-first/pkg023/F7_SOURCE_REPAIR_20260919.md`, where the repository bytes were
   proven never to have been the applied bytes.
4. **Quarantine branch `repair/ru0-ru1-backend-20260902` is never merged, cherry-picked or applied.**
5. **No destructive operations**: no `adb uninstall`, no `pm clear`, no factory reset, no account or data
   deletion, no destructive Supabase operation, no change to production or shared resources.
6. **No secrets** in client, repository, logs or tests. Never ask the owner for a password, a JWT or a token.
7. **No paid AI/provider calls**, no test accounts created on DEV, **no fake data to simulate a completed
   flow**, no new or upgraded dependency without his word.
8. **Never impersonate a real account.** Synthetic subjects inside a rolled-back transaction are fine and
   were used today; they leave nothing behind.
9. **Speech is only tested when the owner says he is at the phone and ready to speak.**
10. **User-facing copy** uses only **OBJAVI ZADATAK** and **USKOČI I ZARADI**. Never "MENI TREBA", "JA MOGU",
    "Naručilac" or "Uskočer". There is a guard test: `src/data/__tests__/v3-copy-no-internal-sides.test.ts`.
11. **Reports to the owner are in plain Serbian** (he is not a programmer). Repository documents and commit
    messages are in English.
12. Work **solo**. The owner asked for no subagents.

---

## 2. What the product is, in one screen

An Expo 57 / React Native 0.86 marketplace with a Supabase backend that owns every business rule. One
account does both sides: it publishes tasks (**OBJAVI ZADATAK**) and applies to other people's
(**USKOČI I ZARADI**). There is no global mode any more — one shell, **Početna │ Mapa │ Dogovori**.

The engine is largely finished and proven. The app around it is not, and **no real person has yet gone
through the whole path** from publishing a task to a confirmed Dogovor. The package reconciliation
(`docs/implementation/execution/PACKAGE_RECONCILIATION_20260916.md`, dated 2026-09-16, partly stale) has
PKG-001..016 DONE_VERIFIED, PKG-017 IN_PROGRESS pending a physical device, PKG-018 BLOCKED on 017, and
019–024 NOT_STARTED. **PKG-017 is the cork**: 018, 019, 020 and 021 all wait behind one real pass on the
owner's phone.

---

## 3. What happened on 2026-09-19, in order

Sixteen commits from `3e883a50` to `4fb65947`. Every one is pushed.

### 3.1 Backend — six migrations applied to canonical DEV, each after the owner's explicit word

| Ledger version | Name | What it does |
| --- | --- | --- |
| `20260919141813` | `dev_alpha_pkg023a_own_reads_paged` | three paged own-list readers + one private helper + one index |
| `20260919142333` | `dev_alpha_pkg023b_task_relations` | `rpc_get_my_task_relations(uuid[])`, ≤100 ids, an overlay, not an oracle |
| `20260919142713` | `dev_alpha_pkg023d_marketplace_bounded` | `rpc_list_open_tasks_v3`, bbox + keyset + allowlist, two indexes |
| `20260919164420` | `dev_alpha_pkg023f_closure_recertification` | re-certified the closure source digest **and** put the two PKG-015 lineage relations into the erasure program |
| `20260919170238` | `dev_alpha_pkg023g_ai_test_service_least_privilege` | revoked EXECUTE from `anon`/`authenticated` on two AI-test service functions |
| `20260919170413` | `dev_alpha_pkg023h_export_settlement_truthful` | the data export stops claiming `measuredProviderCharge: false` |
| `20260919184627` | `dev_alpha_pkg023i_open_tasks_timezone` | the public list reader carries `task_timezone`, `task_country_code`, `verified_identity_required` |

Every recorded ledger text is **byte-identical** to its candidate file; each was verified by reading
`encode(sha256(convert_to(statements[1],'UTF8')),'hex')` back from the database.

**The closure story matters most.** From 2026-09-17 to 2026-09-19 **no account could be closed on DEV**:
five `dev_alpha` migrations had added tables, columns, constraints and a trigger without re-binding
`private.closure_source_digest_v5()`, so `private.retention_ai_source_ready()` was false and
`private.closure_erasure_binding_v5()` was null. That was the guard working, fail-closed. The forensic
review proved the reviewed additions were the **only** change the digest could see, and `pkg023f` re-bound
it — plus, on the owner's condition, made an operator's free text (`account_lineage_v5.reason` /
`source_ref`) **not survive an account closure**: it becomes `CLOSURE_ERASED_OPERATOR_NOTE` /
`CLOSURE_ERASED_SOURCE_REF`, while the class, the revision and the timestamps stay.

### 3.2 Client — three of the four V3 readers are wired

- **Relation overlay.** Discovery and the task detail used to read *both* whole own-lists for one label on
  one card. They now ask `rpc_get_my_task_relations` for the ids on the page.
- **Marketplace.** The list and the map walked the whole `needs` table with every description. They now walk
  `rpc_list_open_tasks_v3` in keyset pages of 200; twenty-five pages is a refusal, never a silent
  truncation; the list carries no description at all.
- **Dogovori.** `mojiDogovori` walks `rpc_list_my_agreements_page`. The projection gained `pocinje` (the
  start of the work) and `izmenaCeka` (a change proposal waiting for an answer) — two facts the list could
  never show. Active Dogovori are ordered by the soonest start; the home shows the two that come soonest.
- **Motion.** The home's rows arrive the way every other list's rows do.

### 3.3 Two findings that change what you should believe

1. **The publish dead-end is gone.** `docs/implementation/execution/pkg021/PKG021_PUBLISH_BLOCKER_ROOT_CAUSE_20260918.md`
   describes a saved draft that could never be published: two facts were serialised as
   `2026-09-18 08:00:00+00` instead of ISO 8601. `dev_alpha_pkg021_…` fixed it; verified on DEV that **no
   live function casts `starts_at::text` any more**, and the draft that was stuck is **PUBLISHED**. Two
   badly formatted facts survive on that old `NEED_INTAKE` conversation and are inert.
2. **The UI plan's numbers are stale.** Measured on 2026-09-19: only 4 routes have no static entrance and
   three of those are deliberate (`/+native-intent` is the deep-link handler; `/prijave` and
   `/pregled-nacrta` are retired URLs kept resolving on purpose). 32 screens use a shared header, 9 draw
   their own and all 9 deliberately. `src/app/auth.tsx` and `src/ui/auth/*` have **no raw font sizes or
   radii left**. The main lists all have empty states with an action. There are no `TODO`s and no no-op
   `onPress` handlers in production code. **Do not work from the old "0 of 231 small findings" list.**

---

## 4. Where everything is

### 4.1 Authority and orders — read these first

| Path | What it is |
| --- | --- |
| `AGENTS.md` / `CLAUDE.md` | the entry map; the reading order |
| `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md` | the current authority chain, updated today |
| `docs/implementation/v5-ai-first/pkg023/OWNER_DECISIONS_V3_20260919.md` | **every owner decision of 2026-09-19, verbatim in intent**, including the TOTAL price decision and the six-point order of the evening |
| `docs/implementation/execution/PACKAGE_RECONCILIATION_20260916.md` | PKG-001..024 status (dated 16.09; PKG-015B's mechanism is live since 17.09, the package is not closed) |
| `docs/implementation/execution/EXECUTION_LEDGER.jsonl` | append-only receipts; the only place a package becomes DONE_VERIFIED |

### 4.2 Today's work — the documents

| Path | What it is |
| --- | --- |
| `docs/implementation/v5-ai-first/pkg023/V3_SLICE3_MIGRATION_PLAN_20260919.md` | **the main plan**, third version. §14 the DEV receipts of a/b/d, §15 the closure re-certification, §16 the client wiring and what the paged own-lists still wait for, §8 the price model |
| `docs/implementation/v5-ai-first/pkg023/CLOSURE_FORENSIC_REVIEW_20260919.md` | the forensic review of the closure digest: what moved it, the reconstruction method, findings F1–F7, and §10 the DEV receipt of `pkg023f` |
| `docs/implementation/v5-ai-first/pkg023/F2_F4_CANDIDATES_20260919.md` | what the data export contains, the minimal diff, and the least-privilege candidate; both applied, with receipts |
| `docs/implementation/v5-ai-first/pkg023/F7_SOURCE_REPAIR_20260919.md` | the mojibake repair of the 2026-08-25 migration and the ten derived constants that were re-frozen with it |
| `docs/implementation/v5-ai-first/pkg023/PKG023_UX_DEFINICIJA_20260918.md` | the screen composition rule the app follows. **Read its section 2A, not section 2.** The document was written on 18.09 while two modes still existed; the owner removed the global mode on 19.09, and section 2 is struck through and superseded. A screen that asks "who are you" is a defect, not a style: the account is one, the shell is one, and the RELATION lives on the row, not on the screen. |

### 4.3 Today's work — the SQL

| Path | What it is |
| --- | --- |
| `supabase/candidates/pkg023a_own_reads_paged.sql` | applied |
| `supabase/candidates/pkg023b_task_relations.sql` | applied |
| `supabase/candidates/pkg023d_marketplace_bounded.sql` | applied |
| `supabase/candidates/pkg023c_public_pin_100m.sql` | **HOLD, and must be REGENERATED before it can ever be applied**: it pins the md5 of `private.closure_redaction_patch_v5` (changed by `pkg023f`) and of `public.rpc_list_open_tasks_v3` (changed by `pkg023i`). Do not apply it. Do not backfill old tasks. |
| `supabase/candidates/pkg023f_closure_recertification.sql` | applied |
| `supabase/candidates/pkg023g_ai_test_service_least_privilege.sql` | applied |
| `supabase/candidates/pkg023h_export_settlement_truthful.sql` | applied |
| `supabase/candidates/pkg023i_open_tasks_timezone.sql` | applied |
| `supabase/operations/dev-alpha/ledger/` | **the exact text of every `dev_alpha` ledger row**, byte for byte as the database recorded it, with `LEDGER_MANIFEST.json` (sha256 + chars + which repo file it matches). Four of those texts existed in no file before today. |
| `supabase/migrations/MD5_MANIFEST.txt`, `supabase/proofs/source147_admission.json`, `supabase/proofs/historical_source108_fixture.mjs`, six `*_predecessor_files.json` | the ten constants re-frozen by the F7 repair |

### 4.4 Today's work — the proofs

| Path | What it is |
| --- | --- |
| `.github/workflows/pkg023f-closure-recertification-proof.yml` | the run that replays the DEV ledger on a disposable database and proves `pkg023f`, `pkg023g`, `pkg023h`, `pkg023i` — 12 checks |
| `supabase/proofs/pkg023f_closure_recert/pkg023f_closure_recert_proof.mjs` | that proof, section by section (R, S1…S9) |
| `supabase/proofs/pkg023f_closure_recert/closure_drift_reconstruction.sql` | **read-only**. Evaluates the live text of the digest functions twice, once with the reviewed additions filtered out. This is the method; reuse it, do not invent another |
| `supabase/proofs/pkg023f_closure_recert/surface_diff.py` | attributes every surface difference to the ledger text that made it |
| `supabase/proofs/pkg023f_closure_recert/evidence/` | the whole DEV surface after a/b/d, the source-147 replay surface, and their attributed difference |
| `.github/workflows/pkg023-v3-reads-and-pin-proof.yml` + `supabase/proofs/pkg023/` | the earlier PKG-023 proof: publishes a task through the real authority, then proves a/b/d and c |

### 4.5 The client files that changed

| Path | What changed |
| --- | --- |
| `src/data/taskRelation.ts` | now a validating mapper for the server's relation answer (`taskRelationIndex(items, asked)`); throws on anything it cannot stand behind |
| `src/data/ports.ts` | the port gained `odnosiPremaZadacima(idovi)` |
| `src/data/supabaseIzvor.ts` | the relation reader, and `otvorenePrilike()` now walks `rpc_list_open_tasks_v3`; `openTaskRow()` shapes an item like the row the shared public projection reads |
| `src/data/agreementClientService.ts` | `mojiDogovori()` walks `rpc_list_my_agreements_page`; `mapAgreement` fills `pocinje` and `izmenaCeka` |
| `src/data/lazniIzvor.ts` | the demo source answers the same new port method |
| `src/contracts/projections.ts` | `DogovorProjekcija` gained `pocinje` and `izmenaCeka` |
| `src/data/homeSnapshot.ts` | the home's Dogovori are ordered by the soonest start; the module note no longer claims the list has no start instant |
| `src/ui/v2/AgreementCollectionPresentation.tsx` | ordering by term + the pending-change badge |
| `src/ui/home/HomePresentation.tsx` | arrival motion for the three lists |
| `src/app/(app)/prilike.tsx`, `src/app/(app)/prilike/[id].tsx` | use the relation overlay |

---

## 5. Exactly where the work stopped, and what is next

### 5.1 The one structural gap left in the V3 read contract

`Početna` and `Moje aktivnosti` cannot be paged, and that is not laziness. `composeHome` in
`src/data/homeSnapshot.ts` scans **every** application and **every** Dogovor to decide what needs the
person, by four rules:

1. a Dogovor `AWAITING_REQUESTER` where I am the requester → "Potvrdi završetak";
2. an active Dogovor with an open problem → "Prijavljen je problem";
3. my active application that is stale or carries the server's own attention flag;
4. my own task with applications to choose from (`hasNeedAttention` in `src/data/marketplaceView.ts`).

A first page would silently miss the fourth thing that needs a person, which is the one thing that must not
be missed. **The next piece of work is a small server aggregate** — provisional name `pkg023j`,
`public.rpc_home_attention()` — returning the attention items (subject ids, a `reason` code, the task title,
an application count where it applies, a sort instant) plus the counts the home shows as "+N". The client
keeps the wording; the server owns the facts. Once it exists, `mojePotrebe` and `mojePrijave` can move to
`rpc_list_my_needs_page` / `rpc_list_my_applications_page`.

**`moje-prijave` has a second, separate obstacle**: it reconciles a pending idempotent command against *the
list that comes back* (`observed(pending, rows)`). Paging it without first moving that reconciliation onto
the row it names would make a pending command on page two read as unreconciled. That is a correctness
change in an idempotency path, not a rendering change. Do not page that screen casually.

### 5.2 Decisions waiting for the owner

1. **`pkg023j`** (the aggregate above) — design, prove, **then ask**.
2. **`pkg023c`** (~100 m public pin) stays on HOLD, must be regenerated first, and backfills no old task.
3. **Price basis** (`TOTAL` / `PER_PERSON` / `OFFERS`) is decided in part and **blocked**: TOTAL means one
   application covers every place and one Dogovor carries the whole amount; PER_PERSON cannot be activated
   until the installed APK cannot mislead or mis-write. The compatibility design is §8 of the plan. The old
   APK would show a per-person amount as the task's price **and send a wrong total** — the owner called that
   a blocker.
4. **F2 follow-up**: whether the person's own metering (token counts, measured audio bytes) enters the data
   export. Recommendation on file: leave it until the production retention policy and privacy document are
   written.
5. **CodeQL**: six alerts, owner said do not touch and do not add `expo-crypto` now.
6. **PKG-015B / GAP-0042**: the isolation mechanism is live on DEV since 17.09, the package is not closed,
   and the owner declared it a release blocker.

### 5.3 The two things that unlock the most

- **PKG-017 on a physical device** — the cork in front of 018, 019, 020 and 021. Only the owner can do it.
- **The first real publication**: a task with a future start, an active worker profile and recorded
  availability. Until then the second half of the product has only ever run with fixtures.

---

## 6. How to verify anything here yourself

```bash
# from the worktree root
npx tsc --noEmit -p tsconfig.json          # types
npx jest                                    # 232 suites / 4445 tests, ~65 s
python supabase/migrations/check_migration_integrity.py   # the frozen 147 inventory
gh pr checks 102                            # CI on the branch
gh run list --branch work/pre-v3-engine-integration-20260911 --limit 5
```

Read-only against canonical DEV (never write without the owner's word):

```sql
-- the ledger and the certificate
select count(*) from supabase_migrations.schema_migrations;                -- 164
select private.retention_ai_source_ready();                                -- true
select private.closure_source_digest_v5()
     = (select sha256 from private.closure_source_v5 where singleton);     -- true
-- the exact text of any dev_alpha row, to compare with supabase/operations/dev-alpha/ledger/
select version, name, length(statements[1]),
       encode(sha256(convert_to(statements[1],'UTF8')),'hex')
from supabase_migrations.schema_migrations where name like 'dev_alpha%' order by version;
```

---

## 7. Traps that cost time today

1. **Bash heredocs mangle backslashes.** Write Python scripts with an editor tool instead of piping
   heredocs that contain `\n`, `\r`, `\u` or regex escapes.
2. **`psql` without `-v ON_ERROR_STOP=1` returns 0 on failure.** Every proof step must pass it.
3. **A candidate reaches the database as text through a tool.** Every candidate therefore verifies its own
   function bodies by md5 before it commits. Keep that.
4. **Patch a huge certified body by anchor**, not by retyping it: `execute replace(pg_get_functiondef(...),
   anchor, new)` with the anchor asserted to occur exactly once, plus an md5 pin before and after.
5. **Re-bind the digest *after* the change**, and assert the new value differs from both the old certified
   one and the drifted one — otherwise the change is not in the digest's view and certifying it is a lie.
6. **The live export catalog is not the one its first migration wrote**: eight source migrations extended it
   through `jsonb`, so it has 51 keys with normalised spacing. Anchor on the live text.
7. **One local Jest suite (`w02-location-native`) times out under full-suite load on this Windows machine
   and passes alone in 1.5 s.** It is not a regression.
8. **`git rm`-staged deletions ride along in the next partial commit.** Check `git diff --cached
   --name-status` before committing.
9. **Two MCP servers need interactive auth** (`plugin:expo:expo`, `plugin:supabase:supabase`); the claude.ai
   Supabase connector works and is what was used.

---

## 8. The one-paragraph version

The backend of the V3 read contract is finished and on canonical DEV; the closure certificate is healthy
again and an operator's free text no longer outlives an account closure; the client uses three of the four
new readers; the publish dead-end is gone. What remains in this slice is one small server aggregate for
"what needs me", after which the last two own-lists can be paged. What remains in the product is the
owner's phone: PKG-017, and the first real publication. Everything else in this file is a decision waiting
for him, and none of it may be applied to canonical DEV without his separate word.
