# Round71 — P6-02 drift confirmation: the 30000-Need SQL screening on the DEPLOYED rollout v3

Status: **PASS (drift confirmation, harness default `jit=on`); the hosted-like supplement (`jit=off`) is NOT under the screening ceiling in two cases, so no "scale PASS" is claimed.** With the harness's default `jit=on` the deployed
composition stays under the 1000 ms screening ceiling in all six RPC cases and does not drift from the tested composition. The supplementary run with `jit=off` (the setting canonical DEV reports) puts MAP_DENSE at 1011 ms and MAP_SPARSE at 1032 ms
worst-block p95 (+1.1 % and +3.2 % over the ceiling; the other four RPC cases pass). It is an SQL-only screening on a disposable target; it does not replace or re-open the earlier 30k screening and it is not a production or end-to-end performance claim.

## Why this exists
Master plan P6-02: "compare the exactly tested source hashes with the current candidate … drift or unexplained changes: do not combine different packages as the same proof". The earlier 30k screening (Round67, run
36632921473) measured the frozen rollout + the visibility layer whose TEST-world helper is a **fixed list of lineages** + the PLACES layer. Canonical DEV runs **rollout v3** (ledger 212): the same composition with ONE change, the helper
derives the TEST-world set from the account classifier (`private.account_visibility_world(account)='TEST'`), because the fixed list was refused by DEV (`P6_VISIBILITY_SEMANTIC_MISMATCH:16`, Round70 finding 19). The RPC body is byte-identical in
both (md5 `1c60224483697732c496df5b9207f08f`, the DEV readback value); only the RLS helper's plan differs. A reasoned equivalence is exactly what P6-02 forbids, so the deployed composition was measured.

## Method (workflow `.github/workflows/p6-round71-load-v3.yml`, script `supabase/proofs/discovery/p6_load_30k_v3.py`, run 36719140030 at 2a191374)
One job, one runner (GitHub Actions, AMD EPYC 7763 × 4, Postgres 17.6), the UNCHANGED harness `p6_load_30k.sql` (30 000 synthetic Needs: 12 000 dense, 12 000 sparse, 3 000 remote, 3 000 point-free; 3 000 with one selected slot; RLS on, `authenticated`
role, one backend connection, three warm-ups per case, 3 blocks × 30 samples × 8 cases = 720 timings per composition):
1. **A** = rollout v2 (the tested composition, empty lineage table) → measure;
2. exact revert (`p6_discovery_rollout_v2_revert.sql`, proven to restore the baseline object for object) → seed the lineage table like canonical DEV (5 rows: OWNER_BUSINESS 1, OWNER_PERSONAL 1, DEV_ACCEPTANCE_QA 1, SYNTHETIC_ACCEPTANCE_FIXTURE 2) → apply the **deployed** rollout v3 (`p6_discovery_rollout_v3.sql`, blob sha256 `ec92c2ee…cecc9`) → **B** measure;
3. compare per case. Admission pins the candidate hashes, the RPC body md5 (identical in A and B), the fixed-list helper for A, the DEPLOYED helper definition md5 `4ee16169f4ee6ba7f79f4bd11b172ad8` and the DEV lineage shape for B.
Gates: B's worst p95 under 1000 ms for the six RPC cases; median block p95 of B within 1.25 × A (the plan's own same-runner tolerance).

## Result
**Round 67 — the tested composition, run 36632921473 at 67ffd458 (frozen rollout + visibility layer with the fixed lineage list + PLACES layer; the 30k screening the plan gate rests on)** (run 67ffd458, runner GitHub Actions 1000003896, AMD EPYC 7763 64-Core Processor × 4, Postgres 17.6, jit=on, work_mem 4MB, shared_buffers 128MB, 30 000 Needs, RLS on, one backend, warm)

| Case | blocks 1/2/3: p50·p95·max ms | worst p95 ms | spread | max response bytes | max result size |
| --- | --- | --- | --- | --- | --- |
| PAGE_ALL | 474·514·516 / 474·493·500 / 476·511·530 | **514** | 1.042 | 50611 | 50 |
| PAGE_PEOPLE2 | 941·975·988 / 943·993·1009 / 936·969·991 | **993** | 1.025 | 50611 | 50 |
| MAP_DENSE | 940·988·991 / 946·984·994 / 942·982·993 | **988** | 1.006 | 703 | 1 |
| MAP_SPARSE | 943·994·999 / 944·994·994 / 942·982·983 | **994** | 1.012 | 42417 | 241 |
| PLACES_SPARSE | 174·196·202 / 175·202·202 / 174·189·190 | **202** | 1.069 | 5206 | 30 |
| EXACT_PUBLIC | 17·18·21 / 17·19·21 / 17·18·19 | **19** | 1.094 | 1184 | 1 |
| SCAN | 18·30·31 / 18·23·26 / 18·23·30 | **30** | 1.304 | 15 | 30000 |
| COVERAGE_SCAN | 297·344·349 / 296·318·321 / 298·337·338 | **344** | 1.081 | 32 | 30000 |

**Round 71 A — the same composition (rollout v2), run 36719140030 at 2a191374** (run 2a191374, runner GitHub Actions 1000004040, AMD EPYC 7763 64-Core Processor × 4, Postgres 17.6, jit=on, work_mem 4MB, shared_buffers 128MB, 30 000 Needs, RLS on, one backend, warm)

| Case | blocks 1/2/3: p50·p95·max ms | worst p95 ms | spread | max response bytes | max result size |
| --- | --- | --- | --- | --- | --- |
| PAGE_ALL | 472·516·516 / 475·521·524 / 470·496·502 | **521** | 1.051 | 50612 | 50 |
| PAGE_PEOPLE2 | 913·974·975 / 911·942·960 / 922·946·948 | **974** | 1.034 | 50612 | 50 |
| MAP_DENSE | 927·990·1000 / 925·952·968 / 929·966·972 | **990** | 1.039 | 703 | 1 |
| MAP_SPARSE | 923·984·989 / 924·970·1019 / 934·953·957 | **984** | 1.032 | 42417 | 241 |
| PLACES_SPARSE | 174·196·209 / 174·199·204 / 174·196·199 | **199** | 1.015 | 5206 | 30 |
| EXACT_PUBLIC | 17·18·18 / 17·21·23 / 16·17·21 | **21** | 1.203 | 1184 | 1 |
| SCAN | 18·19·21 / 18·24·27 / 18·21·29 | **24** | 1.248 | 15 | 30000 |
| COVERAGE_SCAN | 291·311·317 / 291·346·351 / 292·314·330 | **346** | 1.111 | 32 | 30000 |

**Round 71 B — the DEPLOYED rollout v3 (helper derived from the classifier) on a lineage table shaped like canonical DEV** (run 2a191374, runner GitHub Actions 1000004040, AMD EPYC 7763 64-Core Processor × 4, Postgres 17.6, jit=on, work_mem 4MB, shared_buffers 128MB, 30 000 Needs, RLS on, one backend, warm)

| Case | blocks 1/2/3: p50·p95·max ms | worst p95 ms | spread | max response bytes | max result size |
| --- | --- | --- | --- | --- | --- |
| PAGE_ALL | 479·512·531 / 474·502·521 / 481·503·506 | **512** | 1.020 | 50612 | 50 |
| PAGE_PEOPLE2 | 940·972·977 / 940·961·986 / 949·983·1001 | **983** | 1.023 | 50612 | 50 |
| MAP_DENSE | 942·974·987 / 945·984·999 / 948·965·966 | **984** | 1.019 | 703 | 1 |
| MAP_SPARSE | 943·966·973 / 947·971·972 / 945·976·999 | **976** | 1.010 | 42417 | 241 |
| PLACES_SPARSE | 179·196·201 / 180·192·226 / 179·187·195 | **196** | 1.052 | 5206 | 30 |
| EXACT_PUBLIC | 20·23·25 / 20·21·21 / 20·21·22 | **23** | 1.131 | 1184 | 1 |
| SCAN | 22·28·32 / 22·23·26 / 22·22·22 | **28** | 1.252 | 15 | 30000 |
| COVERAGE_SCAN | 303·335·339 / 302·336·338 / 301·336·366 | **336** | 1.004 | 32 | 30000 |

| Case | A worst p95 | B worst p95 | A median block p95 | B median block p95 | B / A |
| --- | --- | --- | --- | --- | --- |
| PAGE_ALL | 521 | 512 | 516 | 503 | 0.975 |
| PAGE_PEOPLE2 | 974 | 983 | 946 | 972 | 1.027 |
| MAP_DENSE | 990 | 984 | 966 | 974 | 1.008 |
| MAP_SPARSE | 984 | 976 | 970 | 971 | 1.0 |
| PLACES_SPARSE | 199 | 196 | 196 | 192 | 0.978 |
| EXACT_PUBLIC | 21 | 23 | 18 | 21 | 1.186 |

Gates: deployed composition under 1000 ms in all six RPC cases: **yes** (worst 983 ms); no material drift: **yes** (largest ratio 1.186, EXACT_PUBLIC at about 20 ms; the three heavy cases 1.027 / 1.008 / 1.000). Receipts and the 720 samples of each composition:
`round71-load/` (`comparison-receipt.json`, `receipt-A.json`, `receipt-B.json`, `samples-A.json`, `samples-B.json`, and Round67's `round67-finalcost-receipt.json`, `round67-samples.json`, which closes the plan's "commit the per-case table" for P6-01).

## What this does NOT say (read before quoting it)
- **The margin is thin, and it is the harness's setting more than the code.** Three cases (PAGE_PEOPLE2, MAP_DENSE, MAP_SPARSE) sit at a constant p50 of about 940 ms in Round67 and in both Round71 compositions, i.e. 95–99 % of the 1000 ms ceiling.
  The harness ran with `jit = on` (environment block of the receipts); a read-only `show jit` on canonical DEV (2026-09-30) answers `off` (Postgres 17.6, work_mem 2184 kB, shared_buffers 224 MB; the harness: 4 MB / 128 MB). A per-execution JIT
  compilation would produce exactly this kind of constant. That was a hypothesis; the supplementary run below measured it and **did not confirm it**: with `jit=off` the three heavy cases are 0–5 % SLOWER, not faster (the ~940 ms constant is the plan's own cost at this size on this runner, not a JIT artefact).
- One backend, warm cache, 30 000 rows owned by one account, SQL only: no network, no PostgREST, no rendering, no concurrent users (see the concurrency row of the P6 closure record), no cold-cache claim, not an SLA.
- The lineage table has 5 rows (canonical DEV's shape); cost that depends on a large number of TEST-world accounts is not revealed by this harness (the helper is evaluated once per statement over that table).

## Supplementary fidelity run (jit off)
Workflow `.github/workflows/p6-round72-load-v3-jit-off.yml` measures the DEPLOYED rollout v3 once more with the same harness and `PGOPTIONS='-c jit=off'` (hosted-like), run 36721652455 at 216b8387 (SUCCESS as a harness run; its own `performanceScreeningPass` is **false**).

**Round 72 B — the DEPLOYED rollout v3, `jit=off`, lineage table shaped like canonical DEV** (run 216b8387, runner GitHub Actions 1000004043, AMD EPYC 7763 64-Core Processor × 4, Postgres 17.6, jit=off, work_mem 4MB, shared_buffers 128MB, 30 000 Needs, RLS on, one backend, warm)

| Case | blocks 1/2/3: p50·p95·max ms | worst p95 ms | spread | max response bytes | max result size |
| --- | --- | --- | --- | --- | --- |
| PAGE_ALL | 495·528·529 / 492·528·541 / 492·527·534 | **528** | 1.003 | 50611 | 50 |
| PAGE_PEOPLE2 | 934·991·1003 / 942·993·1003 / 949·980·988 | **993** | 1.013 | 50611 | 50 |
| MAP_DENSE | 964·1011·1040 / 968·1011·1031 / 972·1009·1011 | **1011** | 1.002 | 703 | 1 |
| MAP_SPARSE | 969·1032·1052 / 981·1006·1008 / 969·1018·1030 | **1032** | 1.026 | 42417 | 241 |
| PLACES_SPARSE | 178·206·217 / 179·198·205 / 178·193·195 | **206** | 1.068 | 5206 | 30 |
| EXACT_PUBLIC | 17·18·26 / 17·18·27 / 17·20·29 | **20** | 1.138 | 1184 | 1 |
| SCAN | 21·25·28 / 21·30·31 / 21·22·22 | **30** | 1.375 | 15 | 30000 |
| COVERAGE_SCAN | 309·334·343 / 310·341·353 / 309·340·341 | **341** | 1.020 | 32 | 30000 |

Same harness, same composition, only `jit`: the worst p95 of the three heavy cases moves from 983 / 984 / 976 ms (`jit=on`, Round 71 B) to 993 / 1011 / 1032 ms (`jit=off`), i.e. +1.0 %, +2.7 %, +5.7 %; the light cases are within noise.
Block-to-block spread is 1.002–1.026 for the heavy cases, so the difference is a setting effect, not runner noise. **Reading, without softening it:**
- `allRpcUnder1000Ms` is **false** in this run (MAP_DENSE +1.1 %, MAP_SPARSE +3.2 %); the screening gate the plan's P6-01 rests on was green at `jit=on` (Round 67 / Round 71), and P6-01 says a gate that does not pass is to be solved at exactly that deficiency, not reported as scale PASS.
- What is and is not affected: the drift confirmation (v3 against the tested composition at one setting) stands; the claim "under the 1000 ms screening ceiling at 30 000 Needs" holds for the harness default and does not hold for the hosted-like setting. Canonical DEV holds 8 published tasks; the figure concerns scale, not today's data.
- The ceiling is the screening's own figure (the runbook states the ordinary paged API read as p95 up to 1 s in an agreed network/load with SQL and transfer separated), so this is neither a production SLA breach nor a proof of one.
- Options that are not mine to pick: (a) a further cost reduction of the two MAP bucket paths (a new server candidate: new proofs, an owner-gated DEV apply); (b) the owner records the hosted-like MAP screening figure (≈1.0–1.03 s SQL-only at 30 000 Needs, one backend) as an explicit limit of the P6 acceptance and lets the end-to-end HTTP/native p95 on DEV decide; (c) keep the item OPEN until a measurement on the real hosted project (real cache, network) exists. Until a decision, the P6 closure record carries it as OPEN, not as PASS.
Receipts: `round71-load/receipt-B-jitoff.json`, `round71-load/samples-B-jitoff.json` (720 timings).
