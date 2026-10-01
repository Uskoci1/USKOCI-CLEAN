# EX-06 S03 - matching contract proof on a disposable chain

**Result: PARTIAL** | **Evidence label: MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (11 of 12 pins read at the proof point, all equal; the others are read after the extension; helper functions, config rows and triggers not pinned)**
**Scope: PARTIAL on 37 of 66 cases, 0 refused, 29 skipped, 436 of 897 leaves compared**
Level: CI disposable chain only (SOURCE + CI). No DEV, provider, device or paid call. Source text is not live behaviour: this run says what the chain's bodies do, and the label says whether those bodies are DEV's. Nothing here is a pass rate.
Corpus: CORPUS EX06_CONTRACT_CORPUS 1 (66 cases: ran 37, skipped 29, sha256 00f43182f3b9923f...) | findings: 11 | harness errors: 0
Clock rebase: CI now 2026-10-01T17:46:29Z - corpus clock 2026-10-05T08:00:00Z = -86.23 h; every absolute need.starts_at / need.ends_at was shifted by it (offset text and durations kept).
Auth accounts created through the proof adapter: 219; rate-limit (HTTP 429) retries: 0, waited 0 s; auth calls that failed for good: 0.
- WARNING: 6 case(s) are SHAPE_DEGRADED (the schedule shape the corpus asked for could not be built, the task stores no window; the result is PARTIAL): T-003, T-006, T-007, T-008, T-026, T-027
- WARNING: 3 case(s) are POSITIVE_ONLY (the corpus gives no matcher-level negative; compared, but an everyone-eligible matcher would pass them): T-004, T-005, T-036

## Canary (a fixture defect is a harness error, never a finding)
PASS: canary-fit-unfit PASS, canary-scheduled PASS, canary-radius PASS, canary-remote PASS, canary-point-to-point PASS, canary-multi-stop PASS, canary-world PASS

## Pin gate (S01 table; md5 of prosrc, carriage returns removed; function bodies at the proof point only)
| function | role | S01 pin | chain | verdict | explanation |
| --- | --- | --- | --- | --- | --- |
| private.match_detail | MATCH | 38c7894a8cf43a8f32bd5a30bc2cbd09 | 38c7894a8cf43a8f32bd5a30bc2cbd09 | EQUAL |  |
| private.match_detail_for_calendar_interval | MATCH | 781956cab666befab216b3ce2334ca1d | 781956cab666befab216b3ce2334ca1d | EQUAL |  |
| private.match_detail_without_calendar | MATCH | 9180606a038f3606b0906ab4aefdd0c1 | 9180606a038f3606b0906ab4aefdd0c1 | EQUAL |  |
| private.dispatch_next_wave | DISPATCH | 1fd8c51ef026ece24471e2f68250ecc5 | 1fd8c51ef026ece24471e2f68250ecc5 | EQUAL |  |
| private.dispatch_tick | DISPATCH | e568b033b9457736869fc5829ffc5511 | e568b033b9457736869fc5829ffc5511 | EQUAL |  |
| private.dispatch_cheap_candidate_admitted | DISPATCH | 0132fae38c75947179b4d389edc1e1f0 | 0132fae38c75947179b4d389edc1e1f0 | EQUAL |  |
| private.candidate_profile_ids | DISPATCH | dca4ddc8080a52c8af83c33689c5568e | dca4ddc8080a52c8af83c33689c5568e | EQUAL |  |
| private.emit_event | EVENT | 67413effbbb3fa227397d355e0d4edfb | 67413effbbb3fa227397d355e0d4edfb | EQUAL |  |
| private.push_suppression | PUSH | 0e0277608bf40f3cccc3575a77b1c23d | 0e0277608bf40f3cccc3575a77b1c23d | EQUAL |  |
| private.work_kinds_v5 | MATCH | 2113eb46ab7ea968b873e76d1de12377 | 2113eb46ab7ea968b873e76d1de12377 | EQUAL |  |
| private.requeue_open_needs_for_worker_v5 | DISPATCH | 371bb38ea1d7180ca6222409f1a9a591 | 371bb38ea1d7180ca6222409f1a9a591 | EQUAL |  |
| public.rpc_begin_push_send | PUSH | fc76b3444e312e589255cccb2b0749c0 | NOT READ HERE | READ_AFTER_EXTENSION | the post-B24 body is reached only by the extension stages (second section of the run) |
| private.closure_source_digest_v5 | CERTIFICATE (informational) | 9fb4a72f3feef8e4557a96f4c9d7224e | 7840a7e70cd12bd599fa6d3bb3300cc7 | DIFFERENT | pin evidence: S01 section 2 (new pin; changed by voice B1, ledger 215): differs by design, the chain stops before voice B1 |
| private.closure_erasure_binding_v5 | CERTIFICATE (informational) | d6d7e7f6f108fff45a4df5126949fa04 | d6d7e7f6f108fff45a4df5126949fa04 | EQUAL |  |

Not pinned (reported for information in the JSON report): helper functions, marketplace_config rows, triggers, cron, data, the publish and worker-writer RPCs the fixtures call.
Closure certificate at the start: live 76b399c00140c084f198db0964c21fcc0c7175a312b379b21fa1ca38b8420516 | certified 76b399c00140c084f198db0964c21fcc0c7175a312b379b21fa1ca38b8420516 | erasure 76b399c00140c084f198db0964c21fcc0c7175a312b379b21fa1ca38b8420516 | binding 76b399c00140c084f198db0964c21fcc0c7175a312b379b21fa1ca38b8420516 | ready true (consistent: true); at the end: live 76b399c00140c084f198db0964c21fcc0c7175a312b379b21fa1ca38b8420516 (unchanged). The chain's digest 76b399c0 differs from DEV's 58447d77 at S01 (informational: the chain stops before B24 part 2, voice B1 and pkg045b-p0).

## Expected versus actual
| case | worker | field | expected | actual | verdict |
| --- | --- | --- | --- | --- | --- |
| T-001 | fits | responseAllowed | true | true | PASS |
| T-001 | fits | dispatchEligible | true | true | PASS |
| T-001 | fits | hardBlockers | [] | [] | PASS |
| T-001 | fits | dispatchBlockers | [] | [] | PASS |
| T-001 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-001 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-001 | does-not-fit | responseAllowed | true | true | PASS |
| T-001 | does-not-fit | dispatchEligible | false | false | PASS |
| T-001 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-001 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-001 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-001 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-001 | unknown-capability | responseAllowed | true | true | PASS |
| T-001 | unknown-capability | dispatchEligible | false | false | PASS |
| T-001 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-001 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-001 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-001 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-001 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-001 | control-restricted | responseAllowed | false | false | PASS |
| T-001 | control-restricted | dispatchEligible | false | false | PASS |
| T-001 | control-restricted | delivery | false | false | PASS |
| T-001 | control-restricted | event | false | false | PASS |
| T-001 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-001 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-001 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-001 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["CISCENJE"] | ["CISCENJE"] | PASS |
| T-002 | fits | responseAllowed | true | true | PASS |
| T-002 | fits | dispatchEligible | true | true | PASS |
| T-002 | fits | hardBlockers | [] | [] | PASS |
| T-002 | fits | dispatchBlockers | [] | [] | PASS |
| T-002 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-002 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-002 | unknown-capability | responseAllowed | false | false | PASS |
| T-002 | unknown-capability | dispatchEligible | false | false | PASS |
| T-002 | unknown-capability | hardBlockers | ["MISSING_REQUIRED_VEHICLE"] | ["MISSING_REQUIRED_VEHICLE"] | PASS |
| T-002 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-002 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-002 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-002 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-002 | control-restricted | responseAllowed | false | false | PASS |
| T-002 | control-restricted | dispatchEligible | false | false | PASS |
| T-002 | control-restricted | delivery | false | false | PASS |
| T-002 | control-restricted | event | false | false | PASS |
| T-002 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-002 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-002 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-002 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["SELIDBE_PREVOZ"] | ["SELIDBE_PREVOZ"] | PASS |
| T-003 | fits | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-003 | fits | dispatchEligible | true | false | FINDING (SHAPE_DEGRADED) |
| T-003 | fits | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-003 | fits | dispatchBlockers | [] | ["OUTSIDE_AVAILABILITY"] | FINDING (SHAPE_DEGRADED) |
| T-003 | fits | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-003 | fits | event iff delivery (derived invariant) | false | false | PASS |
| T-003 | does-not-fit | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-003 | does-not-fit | dispatchEligible | false | false | PASS (SHAPE_DEGRADED) |
| T-003 | does-not-fit | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-003 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_AVAILABILITY","OUTSIDE_PREFERRED_RADIUS"] | FINDING (SHAPE_DEGRADED) |
| T-003 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-003 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-003 | unknown-capability | responseAllowed | true | true | PASS |
| T-003 | unknown-capability | dispatchEligible | false | false | PASS |
| T-003 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-003 | unknown-capability | dispatchBlockers | ["OUTSIDE_AVAILABILITY"] | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | FINDING |
| T-003 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-003 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-003 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-003 | control-restricted | responseAllowed | false | false | PASS |
| T-003 | control-restricted | dispatchEligible | false | false | PASS |
| T-003 | control-restricted | delivery | false | false | PASS |
| T-003 | control-restricted | event | false | false | PASS |
| T-003 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-003 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-003 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-003 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["DOSTAVA"] | ["DOSTAVA"] | PASS |
| T-004 | fits | responseAllowed | true | true | PASS |
| T-004 | fits | dispatchEligible | true | true | PASS |
| T-004 | fits | hardBlockers | [] | [] | PASS |
| T-004 | fits | dispatchBlockers | [] | [] | PASS |
| T-004 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-004 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-004 | does-not-fit | responseAllowed | true | true | PASS |
| T-004 | does-not-fit | dispatchEligible | true | true | PASS |
| T-004 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-004 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-004 | does-not-fit | eligible => delivered (derived invariant) | true | true | PASS |
| T-004 | does-not-fit | event iff delivery (derived invariant) | true | true | PASS |
| T-004 | unknown-capability | responseAllowed | true | true | PASS |
| T-004 | unknown-capability | dispatchEligible | true | true | PASS |
| T-004 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-004 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-004 | unknown-capability | eligible => delivered (derived invariant) | true | true | PASS |
| T-004 | unknown-capability | event iff delivery (derived invariant) | true | true | PASS |
| T-004 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-004 | control-restricted | responseAllowed | false | false | PASS |
| T-004 | control-restricted | dispatchEligible | false | false | PASS |
| T-004 | control-restricted | delivery | false | false | PASS |
| T-004 | control-restricted | event | false | false | PASS |
| T-004 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-004 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-004 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-004 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["FIZICKI_POSLOVI"] | ["FIZICKI_POSLOVI"] | PASS |
| T-005 | fits | responseAllowed | true | true | PASS |
| T-005 | fits | dispatchEligible | true | true | PASS |
| T-005 | fits | hardBlockers | [] | [] | PASS |
| T-005 | fits | dispatchBlockers | [] | [] | PASS |
| T-005 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-005 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-005 | does-not-fit | responseAllowed | true | true | PASS |
| T-005 | does-not-fit | dispatchEligible | true | true | PASS |
| T-005 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-005 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-005 | does-not-fit | eligible => delivered (derived invariant) | true | true | PASS |
| T-005 | does-not-fit | event iff delivery (derived invariant) | true | true | PASS |
| T-005 | unknown-capability | responseAllowed | true | true | PASS |
| T-005 | unknown-capability | dispatchEligible | true | true | PASS |
| T-005 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-005 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-005 | unknown-capability | eligible => delivered (derived invariant) | true | true | PASS |
| T-005 | unknown-capability | event iff delivery (derived invariant) | true | true | PASS |
| T-005 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-005 | control-restricted | responseAllowed | false | false | PASS |
| T-005 | control-restricted | dispatchEligible | false | false | PASS |
| T-005 | control-restricted | delivery | false | false | PASS |
| T-005 | control-restricted | event | false | false | PASS |
| T-005 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-005 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-005 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-005 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["CISCENJE"] | ["CISCENJE"] | PASS |
| T-006 | fits | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-006 | fits | dispatchEligible | true | false | FINDING (SHAPE_DEGRADED) |
| T-006 | fits | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-006 | fits | dispatchBlockers | [] | ["OUTSIDE_AVAILABILITY"] | FINDING (SHAPE_DEGRADED) |
| T-006 | fits | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-006 | fits | event iff delivery (derived invariant) | false | false | PASS |
| T-006 | does-not-fit | responseAllowed | true | true | PASS |
| T-006 | does-not-fit | dispatchEligible | false | false | PASS |
| T-006 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-006 | does-not-fit | dispatchBlockers | ["OUTSIDE_AVAILABILITY"] | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | FINDING |
| T-006 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-006 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-006 | unknown-capability | responseAllowed | true | true | PASS |
| T-006 | unknown-capability | dispatchEligible | false | false | PASS |
| T-006 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-006 | unknown-capability | dispatchBlockers | ["OUTSIDE_AVAILABILITY"] | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | FINDING |
| T-006 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-006 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-006 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-006 | control-restricted | responseAllowed | false | false | PASS |
| T-006 | control-restricted | dispatchEligible | false | false | PASS |
| T-006 | control-restricted | delivery | false | false | PASS |
| T-006 | control-restricted | event | false | false | PASS |
| T-006 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-006 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-006 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-006 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["BASTA_DVORISTE"] | ["BASTA_DVORISTE"] | PASS |
| T-007 | fits | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-007 | fits | dispatchEligible | true | true | PASS (SHAPE_DEGRADED) |
| T-007 | fits | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-007 | fits | dispatchBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-007 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-007 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-007 | does-not-fit | responseAllowed | true | true | PASS |
| T-007 | does-not-fit | dispatchEligible | false | false | PASS |
| T-007 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-007 | does-not-fit | dispatchBlockers | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | PASS |
| T-007 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-007 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-007 | unknown-capability | responseAllowed | true | true | PASS |
| T-007 | unknown-capability | dispatchEligible | false | false | PASS |
| T-007 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-007 | unknown-capability | dispatchBlockers | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | PASS |
| T-007 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-007 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-007 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-007 | control-restricted | responseAllowed | false | false | PASS |
| T-007 | control-restricted | dispatchEligible | false | false | PASS |
| T-007 | control-restricted | delivery | false | false | PASS |
| T-007 | control-restricted | event | false | false | PASS |
| T-007 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-007 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-007 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-007 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MONTAZA_NAMESTAJA"] | ["MONTAZA_NAMESTAJA"] | PASS |
| T-008 | fits | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-008 | fits | dispatchEligible | true | true | PASS (SHAPE_DEGRADED) |
| T-008 | fits | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-008 | fits | dispatchBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-008 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-008 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-008 | does-not-fit | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-008 | does-not-fit | dispatchEligible | false | false | PASS (SHAPE_DEGRADED) |
| T-008 | does-not-fit | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-008 | does-not-fit | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS (SHAPE_DEGRADED) |
| T-008 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-008 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-008 | unknown-capability | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-008 | unknown-capability | dispatchEligible | false | false | PASS (SHAPE_DEGRADED) |
| T-008 | unknown-capability | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-008 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS (SHAPE_DEGRADED) |
| T-008 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-008 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-008 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-008 | control-restricted | responseAllowed | false | false | PASS |
| T-008 | control-restricted | dispatchEligible | false | false | PASS |
| T-008 | control-restricted | delivery | false | false | PASS |
| T-008 | control-restricted | event | false | false | PASS |
| T-008 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-008 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-008 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-008 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | [] | [] | PASS |
| T-009 | fits | responseAllowed | true | true | PASS |
| T-009 | fits | dispatchEligible | true | true | PASS |
| T-009 | fits | hardBlockers | [] | [] | PASS |
| T-009 | fits | dispatchBlockers | [] | [] | PASS |
| T-009 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-009 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-009 | does-not-fit | responseAllowed | false | false | PASS |
| T-009 | does-not-fit | dispatchEligible | false | false | PASS |
| T-009 | does-not-fit | hardBlockers | ["MISSING_REQUIRED_TOOL"] | ["MISSING_REQUIRED_TOOL"] | PASS |
| T-009 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-009 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-009 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-009 | unknown-capability | responseAllowed | false | false | PASS |
| T-009 | unknown-capability | dispatchEligible | false | false | PASS |
| T-009 | unknown-capability | hardBlockers | ["MISSING_REQUIRED_TOOL"] | ["MISSING_REQUIRED_TOOL"] | PASS |
| T-009 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-009 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-009 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-009 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-009 | control-restricted | responseAllowed | false | false | PASS |
| T-009 | control-restricted | dispatchEligible | false | false | PASS |
| T-009 | control-restricted | delivery | false | false | PASS |
| T-009 | control-restricted | event | false | false | PASS |
| T-009 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-009 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-009 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-009 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["SITNE_POPRAVKE"] | ["SITNE_POPRAVKE"] | PASS |
| T-010 | fits | responseAllowed | true | true | PASS |
| T-010 | fits | dispatchEligible | true | true | PASS |
| T-010 | fits | hardBlockers | [] | [] | PASS |
| T-010 | fits | dispatchBlockers | [] | [] | PASS |
| T-010 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-010 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-010 | does-not-fit | responseAllowed | false | false | PASS |
| T-010 | does-not-fit | dispatchEligible | false | false | PASS |
| T-010 | does-not-fit | hardBlockers | ["PROFILE_EXCLUSION"] | ["PROFILE_EXCLUSION"] | PASS |
| T-010 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-010 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-010 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-010 | unknown-capability | responseAllowed | true | true | PASS |
| T-010 | unknown-capability | dispatchEligible | false | false | PASS |
| T-010 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-010 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-010 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-010 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-010 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-010 | control-restricted | responseAllowed | false | false | PASS |
| T-010 | control-restricted | dispatchEligible | false | false | PASS |
| T-010 | control-restricted | delivery | false | false | PASS |
| T-010 | control-restricted | event | false | false | PASS |
| T-010 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-010 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-010 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-010 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MONTAZA_NAMESTAJA"] | ["MONTAZA_NAMESTAJA"] | PASS |
| T-011 | fits | responseAllowed | true | true | PASS |
| T-011 | fits | dispatchEligible | true | true | PASS |
| T-011 | fits | hardBlockers | [] | [] | PASS |
| T-011 | fits | dispatchBlockers | [] | [] | PASS |
| T-011 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-011 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-011 | does-not-fit | responseAllowed | true | true | PASS |
| T-011 | does-not-fit | dispatchEligible | false | false | PASS |
| T-011 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-011 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-011 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-011 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-011 | unknown-capability | responseAllowed | true | true | PASS |
| T-011 | unknown-capability | dispatchEligible | false | false | PASS |
| T-011 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-011 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-011 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-011 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-011 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-011 | control-restricted | responseAllowed | false | false | PASS |
| T-011 | control-restricted | dispatchEligible | false | false | PASS |
| T-011 | control-restricted | delivery | false | false | PASS |
| T-011 | control-restricted | event | false | false | PASS |
| T-011 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-011 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-011 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-011 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MONTAZA_NAMESTAJA"] | ["MONTAZA_NAMESTAJA"] | PASS |
| T-012 | fits | responseAllowed | true | true | PASS |
| T-012 | fits | dispatchEligible | true | true | PASS |
| T-012 | fits | hardBlockers | [] | [] | PASS |
| T-012 | fits | dispatchBlockers | [] | [] | PASS |
| T-012 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-012 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-012 | does-not-fit | responseAllowed | true | true | PASS |
| T-012 | does-not-fit | dispatchEligible | false | false | PASS |
| T-012 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-012 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-012 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-012 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-012 | unknown-capability | responseAllowed | true | true | PASS |
| T-012 | unknown-capability | dispatchEligible | false | false | PASS |
| T-012 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-012 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-012 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-012 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-012 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-012 | control-restricted | responseAllowed | false | false | PASS |
| T-012 | control-restricted | dispatchEligible | false | false | PASS |
| T-012 | control-restricted | delivery | false | false | PASS |
| T-012 | control-restricted | event | false | false | PASS |
| T-012 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-012 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-012 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-012 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MONTAZA_NAMESTAJA"] | ["MONTAZA_NAMESTAJA"] | PASS |
| T-013 | fits | responseAllowed | true | true | PASS |
| T-013 | fits | dispatchEligible | true | true | PASS |
| T-013 | fits | hardBlockers | [] | [] | PASS |
| T-013 | fits | dispatchBlockers | [] | [] | PASS |
| T-013 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-013 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-013 | does-not-fit | responseAllowed | true | true | PASS |
| T-013 | does-not-fit | dispatchEligible | false | false | PASS |
| T-013 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-013 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-013 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-013 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-013 | unknown-capability | responseAllowed | true | true | PASS |
| T-013 | unknown-capability | dispatchEligible | false | false | PASS |
| T-013 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-013 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-013 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-013 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-013 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-013 | control-restricted | responseAllowed | false | false | PASS |
| T-013 | control-restricted | dispatchEligible | false | false | PASS |
| T-013 | control-restricted | delivery | false | false | PASS |
| T-013 | control-restricted | event | false | false | PASS |
| T-013 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-013 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-013 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-013 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | [] | [] | PASS |
| T-014 | fits | responseAllowed | true | true | PASS |
| T-014 | fits | dispatchEligible | true | true | PASS |
| T-014 | fits | hardBlockers | [] | [] | PASS |
| T-014 | fits | dispatchBlockers | [] | [] | PASS |
| T-014 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-014 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-014 | does-not-fit | responseAllowed | true | true | PASS |
| T-014 | does-not-fit | dispatchEligible | false | false | PASS |
| T-014 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-014 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-014 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-014 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-014 | unknown-capability | responseAllowed | true | true | PASS |
| T-014 | unknown-capability | dispatchEligible | false | false | PASS |
| T-014 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-014 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-014 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-014 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-014 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-014 | control-restricted | responseAllowed | false | false | PASS |
| T-014 | control-restricted | dispatchEligible | false | false | PASS |
| T-014 | control-restricted | delivery | false | false | PASS |
| T-014 | control-restricted | event | false | false | PASS |
| T-014 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-014 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-014 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-014 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | [] | [] | PASS |
| T-015 | fits | responseAllowed | true | true | PASS |
| T-015 | fits | dispatchEligible | true | true | PASS |
| T-015 | fits | hardBlockers | [] | [] | PASS |
| T-015 | fits | dispatchBlockers | [] | [] | PASS |
| T-015 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-015 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-015 | does-not-fit | responseAllowed | true | true | PASS |
| T-015 | does-not-fit | dispatchEligible | false | false | PASS |
| T-015 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-015 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-015 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-015 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-015 | unknown-capability | responseAllowed | true | true | PASS |
| T-015 | unknown-capability | dispatchEligible | false | false | PASS |
| T-015 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-015 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-015 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-015 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-015 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-015 | control-restricted | responseAllowed | false | false | PASS |
| T-015 | control-restricted | dispatchEligible | false | false | PASS |
| T-015 | control-restricted | delivery | false | false | PASS |
| T-015 | control-restricted | event | false | false | PASS |
| T-015 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-015 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-015 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-015 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | [] | [] | PASS |
| T-022 | fits | responseAllowed | true | true | PASS |
| T-022 | fits | dispatchEligible | true | true | PASS |
| T-022 | fits | hardBlockers | [] | [] | PASS |
| T-022 | fits | dispatchBlockers | [] | [] | PASS |
| T-022 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-022 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-022 | does-not-fit | responseAllowed | true | true | PASS |
| T-022 | does-not-fit | dispatchEligible | true | true | PASS |
| T-022 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-022 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-022 | does-not-fit | eligible => delivered (derived invariant) | true | true | PASS |
| T-022 | does-not-fit | event iff delivery (derived invariant) | true | true | PASS |
| T-022 | unknown-capability | responseAllowed | false | false | PASS |
| T-022 | unknown-capability | dispatchEligible | false | false | PASS |
| T-022 | unknown-capability | hardBlockers | ["MISSING_REQUIRED_VEHICLE"] | ["MISSING_REQUIRED_VEHICLE"] | PASS |
| T-022 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-022 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-022 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-022 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-022 | control-restricted | responseAllowed | false | false | PASS |
| T-022 | control-restricted | dispatchEligible | false | false | PASS |
| T-022 | control-restricted | delivery | false | false | PASS |
| T-022 | control-restricted | event | false | false | PASS |
| T-022 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-022 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-022 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-022 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["SELIDBE_PREVOZ"] | ["SELIDBE_PREVOZ"] | PASS |
| T-023 | fits | responseAllowed | true | true | PASS |
| T-023 | fits | dispatchEligible | true | true | PASS |
| T-023 | fits | hardBlockers | [] | [] | PASS |
| T-023 | fits | dispatchBlockers | [] | [] | PASS |
| T-023 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-023 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-023 | does-not-fit | responseAllowed | false | false | PASS |
| T-023 | does-not-fit | dispatchEligible | false | false | PASS |
| T-023 | does-not-fit | hardBlockers | ["MISSING_REQUIRED_VEHICLE"] | ["MISSING_REQUIRED_VEHICLE"] | PASS |
| T-023 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-023 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-023 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-023 | unknown-capability | responseAllowed | false | false | PASS |
| T-023 | unknown-capability | dispatchEligible | false | false | PASS |
| T-023 | unknown-capability | hardBlockers | ["MISSING_REQUIRED_VEHICLE"] | ["MISSING_REQUIRED_VEHICLE"] | PASS |
| T-023 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-023 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-023 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-023 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-023 | control-restricted | responseAllowed | false | false | PASS |
| T-023 | control-restricted | dispatchEligible | false | false | PASS |
| T-023 | control-restricted | delivery | false | false | PASS |
| T-023 | control-restricted | event | false | false | PASS |
| T-023 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-023 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-023 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-023 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["SELIDBE_PREVOZ"] | ["SELIDBE_PREVOZ"] | PASS |
| T-024 | fits | responseAllowed | true | true | PASS |
| T-024 | fits | dispatchEligible | true | true | PASS |
| T-024 | fits | hardBlockers | [] | [] | PASS |
| T-024 | fits | dispatchBlockers | [] | [] | PASS |
| T-024 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-024 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-024 | does-not-fit | responseAllowed | false | false | PASS |
| T-024 | does-not-fit | dispatchEligible | false | false | PASS |
| T-024 | does-not-fit | hardBlockers | ["MISSING_REQUIRED_TOOL"] | ["MISSING_REQUIRED_TOOL"] | PASS |
| T-024 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-024 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-024 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-024 | unknown-capability | responseAllowed | false | false | PASS |
| T-024 | unknown-capability | dispatchEligible | false | false | PASS |
| T-024 | unknown-capability | hardBlockers | ["MISSING_REQUIRED_TOOL"] | ["MISSING_REQUIRED_TOOL"] | PASS |
| T-024 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-024 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-024 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-024 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-024 | control-restricted | responseAllowed | false | false | PASS |
| T-024 | control-restricted | dispatchEligible | false | false | PASS |
| T-024 | control-restricted | delivery | false | false | PASS |
| T-024 | control-restricted | event | false | false | PASS |
| T-024 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-024 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-024 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-024 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MOLERSKI_RADOVI"] | ["MOLERSKI_RADOVI"] | PASS |
| T-025 | fits | responseAllowed | true | true | PASS |
| T-025 | fits | dispatchEligible | true | true | PASS |
| T-025 | fits | hardBlockers | [] | [] | PASS |
| T-025 | fits | dispatchBlockers | [] | [] | PASS |
| T-025 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-025 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-025 | does-not-fit | responseAllowed | true | true | PASS |
| T-025 | does-not-fit | dispatchEligible | false | false | PASS |
| T-025 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-025 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-025 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-025 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-025 | unknown-capability | responseAllowed | true | true | PASS |
| T-025 | unknown-capability | dispatchEligible | false | false | PASS |
| T-025 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-025 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-025 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-025 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-025 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-025 | control-restricted | responseAllowed | false | false | PASS |
| T-025 | control-restricted | dispatchEligible | false | false | PASS |
| T-025 | control-restricted | delivery | false | false | PASS |
| T-025 | control-restricted | event | false | false | PASS |
| T-025 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-025 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-025 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-025 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MOLERSKI_RADOVI"] | ["MOLERSKI_RADOVI"] | PASS |
| T-026 | fits | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-026 | fits | dispatchEligible | true | true | PASS (SHAPE_DEGRADED) |
| T-026 | fits | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-026 | fits | dispatchBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-026 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-026 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-026 | does-not-fit | responseAllowed | true | true | PASS |
| T-026 | does-not-fit | dispatchEligible | false | false | PASS |
| T-026 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-026 | does-not-fit | dispatchBlockers | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | PASS |
| T-026 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-026 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-026 | unknown-capability | responseAllowed | true | true | PASS |
| T-026 | unknown-capability | dispatchEligible | false | false | PASS |
| T-026 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-026 | unknown-capability | dispatchBlockers | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] | PASS |
| T-026 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-026 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-026 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-026 | control-restricted | responseAllowed | false | false | PASS |
| T-026 | control-restricted | dispatchEligible | false | false | PASS |
| T-026 | control-restricted | delivery | false | false | PASS |
| T-026 | control-restricted | event | false | false | PASS |
| T-026 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-026 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-026 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-026 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MOLERSKI_RADOVI"] | ["MOLERSKI_RADOVI"] | PASS |
| T-027 | fits | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-027 | fits | dispatchEligible | true | true | PASS (SHAPE_DEGRADED) |
| T-027 | fits | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-027 | fits | dispatchBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-027 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-027 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-027 | does-not-fit | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-027 | does-not-fit | dispatchEligible | false | false | PASS (SHAPE_DEGRADED) |
| T-027 | does-not-fit | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-027 | does-not-fit | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS (SHAPE_DEGRADED) |
| T-027 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-027 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-027 | unknown-capability | responseAllowed | true | true | PASS (SHAPE_DEGRADED) |
| T-027 | unknown-capability | dispatchEligible | false | false | PASS (SHAPE_DEGRADED) |
| T-027 | unknown-capability | hardBlockers | [] | [] | PASS (SHAPE_DEGRADED) |
| T-027 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS (SHAPE_DEGRADED) |
| T-027 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-027 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-027 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-027 | control-restricted | responseAllowed | false | false | PASS |
| T-027 | control-restricted | dispatchEligible | false | false | PASS |
| T-027 | control-restricted | delivery | false | false | PASS |
| T-027 | control-restricted | event | false | false | PASS |
| T-027 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-027 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-027 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-027 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | [] | [] | PASS |
| T-028 | fits | responseAllowed | true | true | PASS |
| T-028 | fits | dispatchEligible | true | true | PASS |
| T-028 | fits | hardBlockers | [] | [] | PASS |
| T-028 | fits | dispatchBlockers | [] | [] | PASS |
| T-028 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-028 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-028 | unknown-capability | responseAllowed | true | true | PASS |
| T-028 | unknown-capability | dispatchEligible | false | false | PASS |
| T-028 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-028 | unknown-capability | dispatchBlockers | ["OUTSIDE_AVAILABILITY"] | ["OUTSIDE_AVAILABILITY"] | PASS |
| T-028 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-028 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-028 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-028 | control-restricted | responseAllowed | false | false | PASS |
| T-028 | control-restricted | dispatchEligible | false | false | PASS |
| T-028 | control-restricted | delivery | false | false | PASS |
| T-028 | control-restricted | event | false | false | PASS |
| T-028 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-028 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-028 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-028 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["FIZICKI_POSLOVI"] | ["FIZICKI_POSLOVI"] | PASS |
| T-029 | fits | responseAllowed | true | true | PASS |
| T-029 | fits | dispatchEligible | true | true | PASS |
| T-029 | fits | hardBlockers | [] | [] | PASS |
| T-029 | fits | dispatchBlockers | [] | [] | PASS |
| T-029 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-029 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-029 | does-not-fit | responseAllowed | true | true | PASS |
| T-029 | does-not-fit | dispatchEligible | false | false | PASS |
| T-029 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-029 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-029 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-029 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-029 | unknown-capability | responseAllowed | true | true | PASS |
| T-029 | unknown-capability | dispatchEligible | false | false | PASS |
| T-029 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-029 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-029 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-029 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-029 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-029 | control-restricted | responseAllowed | false | false | PASS |
| T-029 | control-restricted | dispatchEligible | false | false | PASS |
| T-029 | control-restricted | delivery | false | false | PASS |
| T-029 | control-restricted | event | false | false | PASS |
| T-029 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-029 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-029 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-029 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["CISCENJE"] | ["CISCENJE"] | PASS |
| T-030 | fits | responseAllowed | true | true | PASS |
| T-030 | fits | dispatchEligible | true | true | PASS |
| T-030 | fits | hardBlockers | [] | [] | PASS |
| T-030 | fits | dispatchBlockers | [] | [] | PASS |
| T-030 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-030 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-030 | does-not-fit | responseAllowed | false | false | PASS |
| T-030 | does-not-fit | dispatchEligible | false | false | PASS |
| T-030 | does-not-fit | hardBlockers | ["MISSING_REQUIRED_TOOL"] | ["MISSING_REQUIRED_TOOL"] | PASS |
| T-030 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-030 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-030 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-030 | unknown-capability | responseAllowed | false | false | PASS |
| T-030 | unknown-capability | dispatchEligible | false | false | PASS |
| T-030 | unknown-capability | hardBlockers | ["MISSING_REQUIRED_TOOL"] | ["MISSING_REQUIRED_TOOL"] | PASS |
| T-030 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-030 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-030 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-030 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-030 | control-restricted | responseAllowed | false | false | PASS |
| T-030 | control-restricted | dispatchEligible | false | false | PASS |
| T-030 | control-restricted | delivery | false | false | PASS |
| T-030 | control-restricted | event | false | false | PASS |
| T-030 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-030 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-030 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-030 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["MOLERSKI_RADOVI"] | ["MOLERSKI_RADOVI"] | PASS |
| T-031 | fits | responseAllowed | true | true | PASS |
| T-031 | fits | dispatchEligible | true | true | PASS |
| T-031 | fits | hardBlockers | [] | [] | PASS |
| T-031 | fits | dispatchBlockers | [] | [] | PASS |
| T-031 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-031 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-031 | does-not-fit | responseAllowed | true | true | PASS |
| T-031 | does-not-fit | dispatchEligible | false | true | FINDING |
| T-031 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-031 | does-not-fit | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | [] | FINDING |
| T-031 | does-not-fit | eligible => delivered (derived invariant) | true | true | PASS |
| T-031 | does-not-fit | event iff delivery (derived invariant) | true | true | PASS |
| T-031 | unknown-capability | responseAllowed | true | true | PASS |
| T-031 | unknown-capability | dispatchEligible | false | false | PASS |
| T-031 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-031 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-031 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-031 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-031 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-031 | control-restricted | responseAllowed | false | false | PASS |
| T-031 | control-restricted | dispatchEligible | false | false | PASS |
| T-031 | control-restricted | delivery | false | false | PASS |
| T-031 | control-restricted | event | false | false | PASS |
| T-031 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-031 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-031 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-031 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | [] | ["MONTAZA_NAMESTAJA"] | FINDING |
| T-032 | fits | responseAllowed | true | true | PASS |
| T-032 | fits | dispatchEligible | true | true | PASS |
| T-032 | fits | hardBlockers | [] | [] | PASS |
| T-032 | fits | dispatchBlockers | [] | [] | PASS |
| T-032 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-032 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-032 | does-not-fit | responseAllowed | false | false | PASS |
| T-032 | does-not-fit | dispatchEligible | false | false | PASS |
| T-032 | does-not-fit | hardBlockers | ["MISSING_REQUIRED_LICENSE"] | ["MISSING_REQUIRED_LICENSE"] | PASS |
| T-032 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-032 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-032 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-032 | unknown-capability | responseAllowed | false | false | PASS |
| T-032 | unknown-capability | dispatchEligible | false | false | PASS |
| T-032 | unknown-capability | hardBlockers | ["MISSING_REQUIRED_LICENSE"] | ["MISSING_REQUIRED_LICENSE"] | PASS |
| T-032 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-032 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-032 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-032 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-032 | control-restricted | responseAllowed | false | false | PASS |
| T-032 | control-restricted | dispatchEligible | false | false | PASS |
| T-032 | control-restricted | delivery | false | false | PASS |
| T-032 | control-restricted | event | false | false | PASS |
| T-032 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-032 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-032 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-032 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["SELIDBE_PREVOZ"] | ["SELIDBE_PREVOZ"] | PASS |
| T-036 | fits | responseAllowed | true | true | PASS |
| T-036 | fits | dispatchEligible | true | true | PASS |
| T-036 | fits | hardBlockers | [] | [] | PASS |
| T-036 | fits | dispatchBlockers | [] | [] | PASS |
| T-036 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-036 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-036 | does-not-fit | responseAllowed | true | true | PASS |
| T-036 | does-not-fit | dispatchEligible | true | true | PASS |
| T-036 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-036 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-036 | does-not-fit | eligible => delivered (derived invariant) | true | true | PASS |
| T-036 | does-not-fit | event iff delivery (derived invariant) | true | true | PASS |
| T-036 | unknown-capability | responseAllowed | true | true | PASS |
| T-036 | unknown-capability | dispatchEligible | true | true | PASS |
| T-036 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-036 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-036 | unknown-capability | eligible => delivered (derived invariant) | true | true | PASS |
| T-036 | unknown-capability | event iff delivery (derived invariant) | true | true | PASS |
| T-036 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-036 | control-restricted | responseAllowed | false | false | PASS |
| T-036 | control-restricted | dispatchEligible | false | false | PASS |
| T-036 | control-restricted | delivery | false | false | PASS |
| T-036 | control-restricted | event | false | false | PASS |
| T-036 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-036 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-036 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-036 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["SELIDBE_PREVOZ"] | ["SELIDBE_PREVOZ"] | PASS |
| T-037 | fits | responseAllowed | true | true | PASS |
| T-037 | fits | dispatchEligible | true | true | PASS |
| T-037 | fits | hardBlockers | [] | [] | PASS |
| T-037 | fits | dispatchBlockers | [] | [] | PASS |
| T-037 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-037 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-037 | does-not-fit | responseAllowed | true | true | PASS |
| T-037 | does-not-fit | dispatchEligible | false | false | PASS |
| T-037 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-037 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-037 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-037 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-037 | unknown-capability | responseAllowed | true | true | PASS |
| T-037 | unknown-capability | dispatchEligible | false | false | PASS |
| T-037 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-037 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-037 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-037 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-037 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-037 | control-restricted | responseAllowed | false | false | PASS |
| T-037 | control-restricted | dispatchEligible | false | false | PASS |
| T-037 | control-restricted | delivery | false | false | PASS |
| T-037 | control-restricted | event | false | false | PASS |
| T-037 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-037 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-037 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-037 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["CISCENJE"] | ["CISCENJE"] | PASS |
| T-038 | fits | responseAllowed | true | true | PASS |
| T-038 | fits | dispatchEligible | true | true | PASS |
| T-038 | fits | hardBlockers | [] | [] | PASS |
| T-038 | fits | dispatchBlockers | [] | [] | PASS |
| T-038 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-038 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-038 | does-not-fit | responseAllowed | true | true | PASS |
| T-038 | does-not-fit | dispatchEligible | false | false | PASS |
| T-038 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-038 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-038 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-038 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-038 | unknown-capability | responseAllowed | true | true | PASS |
| T-038 | unknown-capability | dispatchEligible | false | false | PASS |
| T-038 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-038 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-038 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-038 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-038 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-038 | control-restricted | responseAllowed | false | false | PASS |
| T-038 | control-restricted | dispatchEligible | false | false | PASS |
| T-038 | control-restricted | delivery | false | false | PASS |
| T-038 | control-restricted | event | false | false | PASS |
| T-038 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-038 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-038 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-038 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["BASTA_DVORISTE"] | ["BASTA_DVORISTE"] | PASS |
| T-041 | fits | responseAllowed | true | true | PASS |
| T-041 | fits | dispatchEligible | true | true | PASS |
| T-041 | fits | hardBlockers | [] | [] | PASS |
| T-041 | fits | dispatchBlockers | [] | [] | PASS |
| T-041 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-041 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-041 | does-not-fit | responseAllowed | true | true | PASS |
| T-041 | does-not-fit | dispatchEligible | false | false | PASS |
| T-041 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-041 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-041 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-041 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-041 | unknown-capability | responseAllowed | true | true | PASS |
| T-041 | unknown-capability | dispatchEligible | false | false | PASS |
| T-041 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-041 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-041 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-041 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-041 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-041 | control-restricted | responseAllowed | false | false | PASS |
| T-041 | control-restricted | dispatchEligible | false | false | PASS |
| T-041 | control-restricted | delivery | false | false | PASS |
| T-041 | control-restricted | event | false | false | PASS |
| T-041 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-041 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-041 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-041 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["FIZICKI_POSLOVI"] | ["FIZICKI_POSLOVI"] | PASS |
| T-042 | fits | responseAllowed | true | true | PASS |
| T-042 | fits | dispatchEligible | true | true | PASS |
| T-042 | fits | hardBlockers | [] | [] | PASS |
| T-042 | fits | dispatchBlockers | [] | [] | PASS |
| T-042 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-042 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-042 | does-not-fit | responseAllowed | true | true | PASS |
| T-042 | does-not-fit | dispatchEligible | false | false | PASS |
| T-042 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-042 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-042 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-042 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-042 | unknown-capability | responseAllowed | true | true | PASS |
| T-042 | unknown-capability | dispatchEligible | false | false | PASS |
| T-042 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-042 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-042 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-042 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-042 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-042 | control-restricted | responseAllowed | false | false | PASS |
| T-042 | control-restricted | dispatchEligible | false | false | PASS |
| T-042 | control-restricted | delivery | false | false | PASS |
| T-042 | control-restricted | event | false | false | PASS |
| T-042 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-042 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-042 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-042 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["SELIDBE_PREVOZ"] | ["SELIDBE_PREVOZ"] | PASS |
| T-043 | fits | responseAllowed | true | true | PASS |
| T-043 | fits | dispatchEligible | true | true | PASS |
| T-043 | fits | hardBlockers | [] | [] | PASS |
| T-043 | fits | dispatchBlockers | [] | [] | PASS |
| T-043 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-043 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-043 | does-not-fit | responseAllowed | true | true | PASS |
| T-043 | does-not-fit | dispatchEligible | false | false | PASS |
| T-043 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-043 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-043 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-043 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-043 | unknown-capability | responseAllowed | true | true | PASS |
| T-043 | unknown-capability | dispatchEligible | false | false | PASS |
| T-043 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-043 | unknown-capability | dispatchBlockers | ["OUTSIDE_AVAILABILITY"] | ["OUTSIDE_AVAILABILITY"] | PASS |
| T-043 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-043 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-043 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-043 | control-restricted | responseAllowed | false | false | PASS |
| T-043 | control-restricted | dispatchEligible | false | false | PASS |
| T-043 | control-restricted | delivery | false | false | PASS |
| T-043 | control-restricted | event | false | false | PASS |
| T-043 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-043 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-043 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-043 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["BASTA_DVORISTE"] | ["BASTA_DVORISTE"] | PASS |
| T-044 | fits | responseAllowed | true | true | PASS |
| T-044 | fits | dispatchEligible | true | true | PASS |
| T-044 | fits | hardBlockers | [] | [] | PASS |
| T-044 | fits | dispatchBlockers | [] | [] | PASS |
| T-044 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-044 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-044 | does-not-fit | responseAllowed | true | true | PASS |
| T-044 | does-not-fit | dispatchEligible | false | false | PASS |
| T-044 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-044 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-044 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-044 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-044 | unknown-capability | responseAllowed | true | true | PASS |
| T-044 | unknown-capability | dispatchEligible | false | false | PASS |
| T-044 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-044 | unknown-capability | dispatchBlockers | ["OUTSIDE_AVAILABILITY"] | ["OUTSIDE_AVAILABILITY"] | PASS |
| T-044 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-044 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-044 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-044 | control-restricted | responseAllowed | false | false | PASS |
| T-044 | control-restricted | dispatchEligible | false | false | PASS |
| T-044 | control-restricted | delivery | false | false | PASS |
| T-044 | control-restricted | event | false | false | PASS |
| T-044 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-044 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-044 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-044 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["BASTA_DVORISTE"] | ["BASTA_DVORISTE"] | PASS |
| T-046 | fits | responseAllowed | true | true | PASS |
| T-046 | fits | dispatchEligible | true | true | PASS |
| T-046 | fits | hardBlockers | [] | [] | PASS |
| T-046 | fits | dispatchBlockers | [] | [] | PASS |
| T-046 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-046 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-046 | does-not-fit | responseAllowed | false | false | PASS |
| T-046 | does-not-fit | dispatchEligible | false | false | PASS |
| T-046 | does-not-fit | hardBlockers | ["INSUFFICIENT_EXPERIENCE"] | ["INSUFFICIENT_EXPERIENCE"] | PASS |
| T-046 | does-not-fit | dispatchBlockers | [] | [] | PASS |
| T-046 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-046 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-046 | unknown-capability | responseAllowed | false | false | PASS |
| T-046 | unknown-capability | dispatchEligible | false | false | PASS |
| T-046 | unknown-capability | hardBlockers | ["INSUFFICIENT_EXPERIENCE"] | ["INSUFFICIENT_EXPERIENCE"] | PASS |
| T-046 | unknown-capability | dispatchBlockers | [] | [] | PASS |
| T-046 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-046 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-046 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-046 | control-restricted | responseAllowed | false | false | PASS |
| T-046 | control-restricted | dispatchEligible | false | false | PASS |
| T-046 | control-restricted | delivery | false | false | PASS |
| T-046 | control-restricted | event | false | false | PASS |
| T-046 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-046 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-046 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-046 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | [] | [] | PASS |
| T-047 | fits | responseAllowed | true | true | PASS |
| T-047 | fits | dispatchEligible | true | true | PASS |
| T-047 | fits | hardBlockers | [] | [] | PASS |
| T-047 | fits | dispatchBlockers | [] | [] | PASS |
| T-047 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-047 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-047 | does-not-fit | responseAllowed | true | true | PASS |
| T-047 | does-not-fit | dispatchEligible | false | false | PASS |
| T-047 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-047 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-047 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-047 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-047 | unknown-capability | responseAllowed | true | true | PASS |
| T-047 | unknown-capability | dispatchEligible | false | false | PASS |
| T-047 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-047 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-047 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-047 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-047 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-047 | control-restricted | responseAllowed | false | false | PASS |
| T-047 | control-restricted | dispatchEligible | false | false | PASS |
| T-047 | control-restricted | delivery | false | false | PASS |
| T-047 | control-restricted | event | false | false | PASS |
| T-047 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-047 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-047 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-047 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["BASTA_DVORISTE"] | ["BASTA_DVORISTE"] | PASS |
| T-048 | fits | responseAllowed | true | true | PASS |
| T-048 | fits | dispatchEligible | true | true | PASS |
| T-048 | fits | hardBlockers | [] | [] | PASS |
| T-048 | fits | dispatchBlockers | [] | [] | PASS |
| T-048 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-048 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-048 | does-not-fit | responseAllowed | true | true | PASS |
| T-048 | does-not-fit | dispatchEligible | false | false | PASS |
| T-048 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-048 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-048 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-048 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-048 | unknown-capability | responseAllowed | true | true | PASS |
| T-048 | unknown-capability | dispatchEligible | false | false | PASS |
| T-048 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-048 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-048 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-048 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-048 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-048 | control-restricted | responseAllowed | false | false | PASS |
| T-048 | control-restricted | dispatchEligible | false | false | PASS |
| T-048 | control-restricted | delivery | false | false | PASS |
| T-048 | control-restricted | event | false | false | PASS |
| T-048 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-048 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-048 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-048 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["CISCENJE"] | ["CISCENJE"] | PASS |
| T-050 | fits | responseAllowed | true | true | PASS |
| T-050 | fits | dispatchEligible | true | true | PASS |
| T-050 | fits | hardBlockers | [] | [] | PASS |
| T-050 | fits | dispatchBlockers | [] | [] | PASS |
| T-050 | fits | eligible => delivered (derived invariant) | true | true | PASS |
| T-050 | fits | event iff delivery (derived invariant) | true | true | PASS |
| T-050 | does-not-fit | responseAllowed | true | true | PASS |
| T-050 | does-not-fit | dispatchEligible | false | false | PASS |
| T-050 | does-not-fit | hardBlockers | [] | [] | PASS |
| T-050 | does-not-fit | dispatchBlockers | ["OUTSIDE_PREFERRED_RADIUS"] | ["OUTSIDE_PREFERRED_RADIUS"] | PASS |
| T-050 | does-not-fit | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-050 | does-not-fit | event iff delivery (derived invariant) | false | false | PASS |
| T-050 | unknown-capability | responseAllowed | true | true | PASS |
| T-050 | unknown-capability | dispatchEligible | false | false | PASS |
| T-050 | unknown-capability | hardBlockers | [] | [] | PASS |
| T-050 | unknown-capability | dispatchBlockers | ["SERVICE_NOT_IN_WORK_PROFILE"] | ["SERVICE_NOT_IN_WORK_PROFILE"] | PASS |
| T-050 | unknown-capability | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-050 | unknown-capability | event iff delivery (derived invariant) | false | false | PASS |
| T-050 | control-restricted | hardBlockersInclude | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | ["ACCOUNT_OR_PROFILE_RESTRICTED"] | PASS |
| T-050 | control-restricted | responseAllowed | false | false | PASS |
| T-050 | control-restricted | dispatchEligible | false | false | PASS |
| T-050 | control-restricted | delivery | false | false | PASS |
| T-050 | control-restricted | event | false | false | PASS |
| T-050 | control-restricted | not eligible => not delivered (derived invariant) | false | false | PASS |
| T-050 | control-restricted | event iff delivery (derived invariant) | false | false | PASS |
| T-050 | - | dispatch_schedule row enqueued by the publish | true | true | PASS |
| T-050 | - | hidden kinds of the stored task (category + required skills) by private.work_kinds_v5 | ["PRANJE_PEGLANJE"] | ["PRANJE_PEGLANJE"] | PASS |

## Cases not run (every one has a reason)
- T-016 (TASK): review.state BLOCKED: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-017 (TASK): review.state BLOCKED: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-018 (TASK): review.state BLOCKED: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-019 (TASK): review.state COLLECTING: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-020 (TASK): review.state COLLECTING: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-021 (TASK): review.state COLLECTING: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-033 (TASK): review.state NEEDS_POLICY_REVIEW: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-034 (TASK): review.state NEEDS_POLICY_REVIEW: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-035 (TASK): review.state NEEDS_POLICY_REVIEW: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-039 (TASK): review.state COLLECTING: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-040 (TASK): review.state COLLECTING: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-045 (TASK): review.state COLLECTING: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- T-049 (TASK): review.state COLLECTING: the task is not published by the contract; its reference-worker eligibility classes are reported UNCONSUMED
- W-001 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-002 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-003 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-004 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-005 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-006 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-007 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-008 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-009 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-010 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-011 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-012 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-013 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-014 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-015 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED
- W-016 (WORKER): WORKER family (worker interview -> profile -> reference tasks) is not consumed by S03; its referenceTasks expectations are reported UNCONSUMED

## Cases refused by the product path (NOT compared)
None.

## POSITIVE_ONLY cases (the corpus gives them no matcher-level negative; compared, but an everyone-eligible matcher would pass them)
- T-004: the corpus gives no matcher-level negative for this case: does-not-fit differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"]; unknown-capability differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting, not by match_detail or the dispatch wave)
- T-005: the corpus gives no matcher-level negative for this case: does-not-fit differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"]; unknown-capability differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting, not by match_detail or the dispatch wave)
- T-036: the corpus gives no matcher-level negative for this case: does-not-fit differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"]; unknown-capability differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting, not by match_detail or the dispatch wave)

## SHAPE_DEGRADED cases (the schedule shape the corpus asked for could not be built: the task stores no window)
- T-003 (TOMORROW_FLEXIBLE): fits wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE; does-not-fit wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE
- T-006 (WEEK_FLEXIBLE): fits wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE
- T-007 (TODAY_FLEXIBLE): fits wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE
- T-008 (REMOTE_ANYTIME): fits wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE; does-not-fit wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE; unknown-capability wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE
- T-026 (FLEXIBLE): fits wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE
- T-027 (REMOTE_ANYTIME): fits wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE; does-not-fit wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE; unknown-capability wanted AVAILABLE_NOW_AND_SCHEDULED, got NONE

## Corpus expectations NOT consumed by S03 (reported, never dropped)
80 in total: busy x2, applicationTimeBlockers x7, eligibility:NOT_PUBLISHABLE x18, eligibility:NO_PUBLISHED_NEED x21, referenceTasks[].expect x32. Expectation leaves present 897, consumed 545 (validated at load only 109, assertable against the chain 436), actually compared with the chain at run time 436, not consumed 352.
- T-002 / does-not-fit: busy = OVERLAPS_TASK_WINDOW (a calendar-busy worker needs an Agreement over the task window (agreement_calendar_sync); S03 does not book workers, so the worker is not built and its expectation ({"hardBlockers":["CALENDAR_CONFLICT"]}) stays unverified)
- T-004 / does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply)
- T-004 / unknown-capability: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply)
- T-005 / does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply)
- T-005 / unknown-capability: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply)
- T-016 / fits: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-016 / does-not-fit: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-016 / unknown-capability: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-017 / fits: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-017 / does-not-fit: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-017 / unknown-capability: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-018 / fits: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-018 / does-not-fit: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-018 / unknown-capability: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state BLOCKED: the task is not published by the contract), so no worker can be matched)
- T-019 / fits: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-019 / does-not-fit: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-019 / unknown-capability: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-020 / fits: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-020 / does-not-fit: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-020 / unknown-capability: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-021 / fits: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-021 / does-not-fit: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-021 / unknown-capability: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-022 / does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply)
- T-028 / does-not-fit: busy = OVERLAPS_TASK_WINDOW (a calendar-busy worker needs an Agreement over the task window (agreement_calendar_sync); S03 does not book workers, so the worker is not built and its expectation ({"hardBlockers":["CALENDAR_CONFLICT"]}) stays unverified)
- T-033 / fits: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-033 / does-not-fit: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-033 / unknown-capability: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-034 / fits: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-034 / does-not-fit: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-034 / unknown-capability: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-035 / fits: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-035 / does-not-fit: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-035 / unknown-capability: eligibility:NOT_PUBLISHABLE = NOT_PUBLISHABLE (the case publishes no task (review.state NEEDS_POLICY_REVIEW: the task is not published by the contract), so no worker can be matched)
- T-036 / does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply)
- T-036 / unknown-capability: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting (rpc_submit_response / rpc_select_response), not by match_detail or the dispatch wave; S03 does not apply)
- T-039 / fits: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-039 / does-not-fit: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-039 / unknown-capability: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-040 / fits: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-040 / does-not-fit: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-040 / unknown-capability: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-045 / fits: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-045 / does-not-fit: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-045 / unknown-capability: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-049 / fits: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-049 / does-not-fit: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- T-049 / unknown-capability: eligibility:NO_PUBLISHED_NEED = NO_PUBLISHED_NEED (the case publishes no task (review.state COLLECTING: the task is not published by the contract), so no worker can be matched)
- W-001 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-001 / BLOCKED: referenceTasks[].expect = HARD_BLOCKED (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-002 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-002 / BLOCKED_AT_APPLICATION: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-003 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-003 / BLOCKED: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-004 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-004 / BLOCKED: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-005 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-005 / BLOCKED: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-006 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-006 / BLOCKED: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-007 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-007 / BLOCKED: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-008 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-008 / BLOCKED: referenceTasks[].expect = HARD_BLOCKED (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-009 / REACHABLE_WHEN_ACTIVE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-009 / BLOCKED_WHILE_DRAFT: referenceTasks[].expect = HARD_BLOCKED (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-010 / BLOCKED_WHILE_DRAFT: referenceTasks[].expect = HARD_BLOCKED (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-010 / NO_SERVICE_MATCH: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-011 / REACHABLE_WHEN_ACTIVE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-011 / BLOCKED_WHILE_DRAFT: referenceTasks[].expect = HARD_BLOCKED (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-012 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-012 / REACHABLE_VIA_KIND: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-013 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-013 / MANUAL_ONLY: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-014 / REACHABLE_VIA_KIND: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-014 / BLOCKED: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-015 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-015 / BLOCKED_AT_APPLICATION: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-016 / REACHABLE: referenceTasks[].expect = ELIGIBLE (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)
- W-016 / BLOCKED: referenceTasks[].expect = MANUAL_ONLY (WORKER family: a worker built from the interview and matched against reference tasks; S03 builds tasks first and does not consume this flow)

## How each task was built (product path or a labelled bypass)
- T-001: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-002: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | UNCONSUMED does-not-fit: busy = "OVERLAPS_TASK_WINDOW" \| worker does-not-fit not built: busy OVERLAPS_TASK_WINDOW: UNCONSUMED (S03 does not book workers)
- T-003: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | SHAPE_DEGRADED fits: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind TOMORROW_FLEXIBLE): built as available now only \| SHAPE_DEGRADED does-not-fit: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind TOMORROW_FLEXIBLE): built as available now only
- T-004: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | UNCONSUMED does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] \| UNCONSUMED unknown-capability: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] \| POSITIVE_ONLY: the corpus gives no matcher-level negative for this case: does-not-fit differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"]; unknown-capability differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting, not by match_detail or the dispatch wave)
- T-005: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | UNCONSUMED does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] \| UNCONSUMED unknown-capability: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] \| POSITIVE_ONLY: the corpus gives no matcher-level negative for this case: does-not-fit differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"]; unknown-capability differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting, not by match_detail or the dispatch wave)
- T-006: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | SHAPE_DEGRADED fits: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind WEEK_FLEXIBLE): built as available now only
- T-007: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | SHAPE_DEGRADED fits: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind TODAY_FLEXIBLE): built as available now only
- T-008: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | SHAPE_DEGRADED fits: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind REMOTE_ANYTIME): built as available now only \| SHAPE_DEGRADED does-not-fit: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind REMOTE_ANYTIME): built as available now only \| SHAPE_DEGRADED unknown-capability: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind REMOTE_ANYTIME): built as available now only
- T-009: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-010: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-011: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-012: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-013: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-014: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-015: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-022: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | UNCONSUMED does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"]
- T-023: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-024: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-025: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-026: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | SHAPE_DEGRADED fits: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind FLEXIBLE): built as available now only
- T-027: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | SHAPE_DEGRADED fits: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind REMOTE_ANYTIME): built as available now only \| SHAPE_DEGRADED does-not-fit: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind REMOTE_ANYTIME): built as available now only \| SHAPE_DEGRADED unknown-capability: the corpus asks for AVAILABLE_NOW_AND_SCHEDULED (a weekly rule or window covers the task time) but the task has no window (schedule kind REMOTE_ANYTIME): built as available now only
- T-028: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | UNCONSUMED does-not-fit: busy = "OVERLAPS_TASK_WINDOW" \| worker does-not-fit not built: busy OVERLAPS_TASK_WINDOW: UNCONSUMED (S03 does not book workers)
- T-029: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-030: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-031: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-032: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-036: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW) | UNCONSUMED does-not-fit: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] \| UNCONSUMED unknown-capability: applicationTimeBlockers = ["TEAM_CAPACITY_EXCEEDED"] \| POSITIVE_ONLY: the corpus gives no matcher-level negative for this case: does-not-fit differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"]; unknown-capability differs only by applicationTimeBlockers ["TEAM_CAPACITY_EXCEEDED"] (enforced when applying or selecting, not by match_detail or the dispatch wave)
- T-037: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-038: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-041: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-042: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-043: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-044: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-046: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-047: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-048: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- T-050: PRODUCT_PATH (synthetic: PROVIDER_OUTPUT_SYNTHETIC_PROPOSALS, EVALUATOR_DECISION_SYNTHETIC_ALLOW)
- profile bypass in T-010 / does-not-fit: app_profiles:exclusions
- profile bypass in T-046 / fits: app_profiles:years_experience
- profile bypass in T-046 / control-restricted: app_profiles:years_experience

Assertions: corpus expectation fields 436 (positive 291, negative 145; 331 distinct gates), derived invariants 292 (positive 86, negative 206), preconditions 257; on DEGRADED cases 0, on UNREACHABLE_STATE cases 0. Tasks: product 37, direct 0. Needs-path mode: product.

Chain stages (from the workflow): 01-dependencies exit=0 ; 02-live79 exit=0 ; 03-source147 exit=0 ; 04-dev-alpha-to-pkg026 exit=0 ; 05-pkg027 exit=0 ; 06-pkg028 exit=0 ; 07-pkg029 exit=0 ; 08-pkg030 exit=0 ; 09-pkg031 exit=0 ; 10-pkg032 exit=0 ; 11-pkg033 exit=0 ; 12-pkg034 exit=0 ; 13-pkg035 exit=0 ; 14-pkg037 exit=0 ; 15-pkg038 exit=0 ; 16-pkg039 exit=0 ; 17-pkg040 exit=0 ; 18-pkg042-to-pkg050 exit=0

## Findings (the matcher or the chain disagrees with the corpus, or the product path refused a READY case; none was adjusted and none was fixed in this slice)
- T-003 / fits / dispatchEligible: expected true, actual false [PRODUCT_PATH] {SHAPE_DEGRADED_WORKER}. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-003 / fits / dispatchBlockers: expected [], actual ["OUTSIDE_AVAILABILITY"] [PRODUCT_PATH] {SHAPE_DEGRADED_WORKER}. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-003 / does-not-fit / dispatchBlockers: expected ["OUTSIDE_PREFERRED_RADIUS"], actual ["OUTSIDE_AVAILABILITY","OUTSIDE_PREFERRED_RADIUS"] [PRODUCT_PATH] {SHAPE_DEGRADED_WORKER}. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-003 / unknown-capability / dispatchBlockers: expected ["OUTSIDE_AVAILABILITY"], actual ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] [PRODUCT_PATH]. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-006 / fits / dispatchEligible: expected true, actual false [PRODUCT_PATH] {SHAPE_DEGRADED_WORKER}. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-006 / fits / dispatchBlockers: expected [], actual ["OUTSIDE_AVAILABILITY"] [PRODUCT_PATH] {SHAPE_DEGRADED_WORKER}. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-006 / does-not-fit / dispatchBlockers: expected ["OUTSIDE_AVAILABILITY"], actual ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] [PRODUCT_PATH]. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-006 / unknown-capability / dispatchBlockers: expected ["OUTSIDE_AVAILABILITY"], actual ["CURRENT_AVAILABILITY_PAUSED","OUTSIDE_AVAILABILITY"] [PRODUCT_PATH]. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-031 / does-not-fit / dispatchEligible: expected false, actual true [PRODUCT_PATH]. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-031 / does-not-fit / dispatchBlockers: expected ["SERVICE_NOT_IN_WORK_PROFILE"], actual [] [PRODUCT_PATH]. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
- T-031 / - / hidden kinds of the stored task (category + required skills): expected [], actual ["MONTAZA_NAMESTAJA"] [PRODUCT_PATH]. Ran against matchDetail:38c7894a matchDetailForCalendarInterval:781956ca matchDetailWithoutCalendar:9180606a dispatchNextWave:1fd8c51e dispatchTick:e568b033 dispatchCheapCandidateAdmitted:0132fae3 candidateProfileIds:dca4ddc8 emitEvent:67413eff pushSuppression:0e027760 workKindsV5:2113eb46.
