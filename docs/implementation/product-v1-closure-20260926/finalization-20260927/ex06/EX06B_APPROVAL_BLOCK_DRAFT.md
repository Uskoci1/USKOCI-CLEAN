# EX-06 ex06b (S06) - alias registry, classification version and the F2 stem fix: approval block, DRAFT (2026-10-02)

**Status: DRAFT. It stays a draft until a CI proof of `.github/workflows/ex06b-alias-proof.yml` passes; do not put it to the owner before then.** Nothing is applied to DEV. Levels (LIVE plan 4.2): SOURCE yes (generated, offline-tested) | CI-PROVEN no (the workflow has never run) | DEV-APPLIED no | DEVICE no | RELEASE no.
Package README (what, why, files, commands, how to continue): `supabase/proofs/ex06/README_EX06B.md`.

## What the owner would say yes to
The classifier of the hidden kinds of work (`private.work_kinds_v5`, used only by matching) stops being eleven hard-coded patterns and reads its word stems from twelve data rows, so that a synonym, a Cyrillic spelling or an alias is a data edit and not a new migration, and so that the F2 false positive ("sklapanje maketa" read as furniture assembly) is fixed. Function-body-plus-data only; certificate-neutral; exactly the eleven kinds that already exist.

## What changes (exactly)
* ONE function body on DEV, completed in place: `private.work_kinds_v5(text[])`, md5 `2113eb46ab7ea968b873e76d1de12377` -> `78fca96231ddc713cf18990f5a2a34ef`; `sql` IMMUTABLE becomes `plpgsql` STABLE (it now reads data), the signature, parameter name, owner, ACL and `search_path` stay, the comment is extended. Its two callers (`private.match_detail_without_calendar`, `private.dispatch_cheap_candidate_admitted`) are NOT edited; they are pinned by md5 together with six more neighbours.
* TWELVE NEW rows in `private.marketplace_config` (no existing row is touched; the insert refuses if a key of the namespace exists): `work_kinds_head` (classification version `WK-1`, the eleven kind names, fold version `SR_LATIN_CYRILLIC_V1`) and `work_kind:<KIND>` for each of the eleven kinds. Precedent: PKG-051a.
* The stems are the PKG-031b alternatives as literal substrings (63) plus five additions minus one removal (67): Serbian Cyrillic is transliterated to Latin before matching; `ikee`, `ikei`, `ikeu`, `ikeom` (declensions of IKEA) -> furniture assembly; `ofarb` (the dialect verb "ofarbati") -> painting; `sklapanj` removed from furniture assembly (F2). Every other Latin text classifies exactly as before (proved by ~670 deterministic probes against an independent model once CI has run; so far by the offline tests and a constants-only read-only use of DEV as a calculator).
* The eleven kind names stay in the function body: an extra `work_kind:*` row is ignored, so no data row can add a twelfth kind. A damaged registry raises `WORK_KINDS_REGISTRY_INVALID` (SQLSTATE 55000) instead of silently matching nothing.
* **Certificate-neutral:** the function is not one of the 88 certified signatures, is in no digest and no function they concatenate, and is not a trigger function; no table, column, constraint, trigger, policy or ACL changes; a data row is in no digest. The digest `0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431` stays and is asserted ready before and after, inside the same atomic statement.
* How it would be applied: ONE guarded atomic statement (exact pins of the target and eight neighbours, exact attributes and config-table shape, certificate ready, the changes, smoke probes on the live function, delta accounting; any failure rolls everything back), sent with an integrity guard for the transport that is used (plain `execute_sql`, or the `apply_migration` form that holds the text twice), then the read-only postflight. The exact revert exists (it refuses an edited registry on purpose).

## What you accept (plain consequences, not new decisions)
1. **Recall loss on one phrasing (F2, chosen):** furniture described ONLY as "sklapanje ormara" or "sklapanje kreveta" no longer reads as furniture assembly ("namestaj", "montaza", "ikea" still do). Remedy if you want it back: one data edit adding a longer stem (for example `sklapanje ormar`) under your word, no migration.
2. **Cyrillic now counts:** a skill, category or exclusion written in Cyrillic names the same kind as its Latin spelling. In particular an exclusion written in Cyrillic now hard-excludes that kind for that worker (before, it excluded nothing). How many real profiles or tasks contain Cyrillic letters has NOT been counted (no personal data was read).
3. **New matches by design:** the IKEA declensions and the dialect verb "ofarbati" now name their kinds.
4. **The hot path reads twelve small rows per classification call** (not measured under load), and a damaged registry refuses matching (and the applications that run the matcher) loudly.
5. Nothing stored is rewritten: kinds are computed when a task or profile is matched; opportunities already delivered are not recomputed. The effect starts with the next matching on DEV.

## Open items this approval does NOT decide (defaults proposed; say so if you want otherwise)
* **ELEKTRO and VODOINSTALATER (your open question A15):** they are two of the eleven kinds already live on DEV, so their rows carry over unchanged. This candidate adds no alias, stem, case or policy for them and decides nothing about whether electrical or plumbing work is an ordinary or a regulated task. If you meant "remove them from the classifier", that is a different candidate with a visible behaviour change; say it before you answer.
* **A twelfth kind** (remote text work, floor laying, pets, packing): your decision; not in this candidate.
* **Carrying `kinds` and `classificationVersion` into the delivery payload** (named in the canonical scope): not done; it edits `private.match_detail_without_calendar` and the delivery event contract, so it is a separate slice. The version is stored in `work_kinds_head` and is readable by the postflight.

## What is NOT proven (today)
The new body and the one atomic statement have NEVER executed on a real database outside a constants-only read-only use of DEV and the read-only pre/postflight reads (plpgsql is parsed by pglast; the logic is checked by two independent models in 38 offline tests); the CI proof has not run; a disposable chain is not DEV; nothing ran on DEV data; the product path uses synthetic facts, no provider output and a labelled bypass for the exclusion list (no writer exists, gap G04); no device, no push; performance under load and concurrent registry edits are unmeasured; whether the real connector accepts the guard text is shown only by the application itself (a refusal applies nothing).

## Evidence so far
* Generator: `build_ex06b.py --check --syntax` (every generated file byte-equal, pglast parses all statements, bodies, guards and run-time DDL) and `--selftest` (both guards against models of both connectors) pass; 38 offline node tests pass (29 + 9).
* Read-only DEV preflight (`ex06b_preflight.readonly.sql`), canonical DEV `leqcwgzvjsxugfgzdmth`, 2026-10-02T09:46:00Z: `problems: []`, nine pins equal, target md5 `2113eb46...`, certified = live = `0579191d...`, seven config rows, ledger 221. The postflight, run read-only on the unapplied DEV as a negative control, reported the unapplied state and executed without error.
* CI: NOT RUN. (To fill in when it passes: run id, source sha, number of named checks, report `ex06b-report.json`.)

## Gate before this block is put to the owner (the root)
1. Add the two candidate files to the exact lists of `src/data/__tests__/p5-matching-field-contract.test.ts` (see the README, "Known interplay").
2. Push and run `ex06b-alias-proof.yml`; it must PASS (about 90-120 minutes). On a failure keep the failed run's evidence and fix the generator or the proof, never the generated files by hand.
3. Re-run the read-only preflight right before asking (`problems: []`), fill in the CI section above, change the status line to FINAL.

## How to say yes
The exact words **"PRIMENI EX-06 ex06b"**. Then, in this order and nothing else: preflight must be empty; guarded application on DEV through the transport that works (apply_migration: ledger 221 -> 222); read-only postflight must return `problems: []`, `registryRows: 12`, `classificationVersion: WK-1`, certificate unchanged; receipt in `supabase/operations/dev-alpha/ledger/`; `docs/control/redovi.json` and the LIVE plan updated. Without those exact words nothing is applied.
