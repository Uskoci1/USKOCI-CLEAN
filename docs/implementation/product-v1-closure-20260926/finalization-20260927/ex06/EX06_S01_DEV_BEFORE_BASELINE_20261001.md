# EX-06 slice S01 - read-only DEV BEFORE baseline of the EX-06 chain (2026-10-01)

**Status: DONE. Read-only: three SELECT statements through the Supabase connector on canonical DEV `leqcwgzvjsxugfgzdmth`, taken 2026-10-01 about 13:41Z. No write, no function with side effects, no migration, no Edge call, no provider call. Nothing applied.**
The statements are kept as `supabase/proofs/ex06/ex06_s01_baseline.readonly.sql`; the same three statements give the AFTER of any later EX-06 package (the EX-03 BEFORE/AFTER precedent). Counts are aggregate only (no row content, no personal data); the owner's accounts are in the TEST world (pkg029e), so the counts include them.

## 1. Ledger and certificate
| | value |
| --- | --- |
| migration ledger | **219**; last versions `20261001113949`, `20261001113815`, `20261001113629` (the four EX-04 packages) |
| closure certificate | live `private.closure_source_digest_v5()` = `58447d7730e909a0c0e60dd92ef77416af927471bd6f645988448e32c6e3cb46` = `private.closure_erasure_binding_v5()->>'sourceSha256'` (certified = live; `legalPolicyAttested: false`, as before) |

## 2. Function body pins (md5 of `prosrc`, carriage returns removed) and where each was recorded before
Every live body equals a pin that an earlier receipt or evidence file already holds, so **no drift since those records** (convention: LF-normalised `prosrc`). The pins are the identity S03/S04 must match before a disposable-chain proof counts as evidence about DEV.
| function | live md5 | earlier record of the same md5 |
| --- | --- | --- |
| `private.match_detail(uuid, uuid)` | `38c7894a8cf43a8f32bd5a30bc2cbd09` | `docs/implementation/evidence/w02-live101-20260910/postflight.json`; pkg023f surface evidence (2026-09-19) |
| `private.match_detail_for_calendar_interval(uuid, uuid, timestamptz, timestamptz)` | `781956cab666befab216b3ce2334ca1d` | `ROUND_76...` and `ex04d_proof.mjs`; `pkg035a_selectable_application_counts.sql` |
| `private.match_detail_without_calendar(uuid, uuid)` | `9180606a038f3606b0906ab4aefdd0c1` | `20260921_pkg031_application.receipt.json`; `pkg035a...sql` |
| `private.dispatch_next_wave(uuid)` | `1fd8c51ef026ece24471e2f68250ecc5` | `20260921_pkg027_application.receipt.json` |
| `private.dispatch_tick(integer, timestamptz)` | `e568b033b9457736869fc5829ffc5511` | `20260921_pkg027_application.receipt.json` |
| `private.dispatch_cheap_candidate_admitted(uuid, uuid)` | `0132fae38c75947179b4d389edc1e1f0` | `20260921_pkg031_application.receipt.json` |
| `private.candidate_profile_ids(uuid, integer)` | `dca4ddc8080a52c8af83c33689c5568e` | `docs/implementation/evidence/ai-live87-20260907/`; pkg023f surface evidence |
| `private.emit_event(...12 args)` | `67413effbbb3fa227397d355e0d4edfb` | `20260921_pkg029_application.receipt.json`; `chat_voice_b1_dev_application.sql` |
| `private.push_suppression(notification_deliveries)` | `0e0277608bf40f3cccc3575a77b1c23d` | `DEV_ALPHA_PREFIX123/144_READ_ONLY_POSTFLIGHT_20260913.json`; pkg023f surface evidence |
| `private.work_kinds_v5(text[])` | `2113eb46ab7ea968b873e76d1de12377` | `20260921_pkg031_application.receipt.json`; `pkg032_proof.mjs` |
| `private.requeue_open_needs_for_worker_v5(uuid)` | `371bb38ea1d7180ca6222409f1a9a591` | `20260921_pkg027_application.receipt.json` |
| `public.rpc_begin_push_send(uuid, uuid)` | `fc76b3444e312e589255cccb2b0749c0` | `20260930_b24_part1_application.receipt.json` (post-B24 body) |
| `private.closure_source_digest_v5()` / `closure_erasure_binding_v5()` | `9fb4a72f3feef8e4557a96f4c9d7224e` / `d6d7e7f6f108fff45a4df5126949fa04` | (new pins; the certificate values are in section 1) |

## 3. Aggregate state of the chain
| area | observed |
| --- | --- |
| profiles | 5 REQUESTER/ACTIVE and 5 WORKER/ACTIVE |
| active workers: skills / availability / location | skills non-empty 4 of 5; availability (active rule, window or available-now) 3 of 5; **a location preference 1 of 5** |
| tasks | ACTIVE/OFFERS 3, PUBLISHED/OFFERS 6, SELECTION/OFFERS 1, DRAFT/MY_PRICE 2, COMPLETED 3, CANCELLED 5, EXPIRED 15 |
| open (ACTIVE or PUBLISHED) task facts | 9 tasks: **7 have no required skills** (the service gate then matches every worker), 2 have skills; none asks minimum experience, none requires verified identity |
| dispatch rounds | **607 of 614 STOPPED / NO_ELIGIBLE_CANDIDATES**, 7 EXPIRED |
| opportunity deliveries | 7 (6 EXPIRED, 1 RESPONDED); **0 duplicate groups** per (worker, need, revision) |
| OPPORTUNITY_AVAILABLE events | 7; their deliveries: IN_APP 3 CREATED + 4 EXPIRED, PUSH 7 **SUPPRESSED / PUSH_OFF** |
| scheduler | cron `marketplace` tick: 1440 runs succeeded in the last 24 h, 0 failures |
| worker AI | 7 sessions, 1 save |

Reading (labelled as reading, not proof): the 607 empty rounds are consistent with the 2026-09-21 measurement (0 of 48 pairs eligible because workers declared no availability) and with only one of five active workers having a location preference; **the cause per round was NOT read here** (it would need `match_detail` per pair, which is what S03 does on the disposable chain). The 7 deliveries show that the chain delivered at least on earlier runs; they do not prove the current build end to end, and who created them was not read.

## 4. What this baseline is and is not
* It is the BEFORE for every later EX-06 candidate: the md5 table is the gate for S03/S04/S06 (a disposable-chain proof counts only if its function bodies equal these pins), and the aggregate table is what S09 compares against.
* It is not behaviour proof: it reads catalog state and counts. The HTTP/JWT level, the Edge flags and the real-provider behaviour are not touched. Edge function versions were not re-read (the control snapshot `docs/control/dev_snapshot.json` carries them).
* It resolves scope gap G12 (no current DEV baseline) and gives S03/S04 their pins.
