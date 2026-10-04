# EX-06 ex06d-F5 — already-applied worker admission

**Status: SOURCE CANDIDATE PREPARED / STATIC CHECK PENDING / DISPOSABLE PROOF PENDING / NOT APPLIED TO DEV.**

S04 finding F5 showed that a worker with a `SUBMITTED` application for the current task revision can still receive a new `OPPORTUNITY_AVAILABLE`. Fresh read-only DEV inspection on 2026-10-04 confirms the current gate `e51de37e0883fcd3cd4e6e3c42fb6ee1` has no `marketplace_responses` exclusion.

The minimal candidate changes only `private.dispatch_cheap_candidate_admitted(uuid,uuid)`: before the existing delivery-dedupe check it rejects an existing response for the same Need and exact revision in `SUBMITTED`, `DELIVERED`, `VIEWED`, `SHORTLISTED` or `SELECTED`. It intentionally does not redefine `DRAFT`, `WITHDRAWN`, `NOT_SELECTED`, `EXPIRED`, `STALE` or `STALE_REVIEW_REQUIRED`; those semantics are outside this proven F5 correction.

The existing partial unique index `marketplace_responses_one_live_per_worker_need (need_id, worker_account_id)` already covers the active-response lookup; no index/table change is proposed. Predicted body md5: `887c8b4c5cdc9062d04277bdd05d2167`. Closure digest stays `3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23`.

Before any DEV application, a disposable chain must reproduce R14, apply this candidate, prove `reached=false` and zero opportunity event/delivery for the already-submitted worker while controls still receive normal opportunities, then exact revert must reproduce F5.

DEV application is not authorized by this package. Proposed later approval wording: `PRIMENI EX-06 ex06d-F5`.
