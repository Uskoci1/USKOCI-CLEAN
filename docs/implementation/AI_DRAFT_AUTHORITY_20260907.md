# AI DRAFT server authority — 2026-09-07

Status: SOURCE IMPLEMENTED / DISPOSABLE PROOF PENDING / NOT CANONICAL / NOT LIVE.

A confirmed V2 intake can receive a persisted BLOCK turn with no proposals while retaining its earlier confirmed facts. The existing review and direct DRAFT-save RPCs do not inspect that decision. The UI has a separate BLOCK check, so the server has not owned this restriction. The06.09 R02-E12 contract requires no save/publish bypass.

This forward unit changes only two existing owner RPCs. The review takes a conversation FOR SHARE lock, derives the latest supported ASSISTANT safety by descending sequence_no, returns it as `safety`, and marks BLOCK non-saveable. The DRAFT materializer rechecks the same safety under its existing conversation FOR UPDATE lock before new materialization and returns `P0001 / AI_NEED_DRAFT_BLOCKED`. It preserves previous successful semantic-command acknowledgments before that new-write gate.

Null/unsupported rows do not erase an earlier supported BLOCK. No supported decision falls back to REVIEW, preserving the current conservative display contract. REVIEW and CLARIFY retain their existing confirmed-DRAFT behavior; neither means publication approval. Invalid nonnull persisted safety remains constrained by the current table/writer contract.

The candidate and forward source are byte-identical: `20260907120000_clean_ai_need_draft_safety_authority.sql`,21,141 UTF-8 bytes, MD5 `d52caaa375623c9cfe93c8e536b3f55c`, SHA-256 `ee0077ae883328f865a73eed0ebab9434a8c2e47add750b055de45950e5a77d1`. Exact predecessor/function/ACL/search-path guards and5s lock/30s statement bounds protect admission. Registry, service writer, confirm/correct and publish functions are unchanged.

Proof entrypoint: `supabase/proofs/ai/ai_draft_authority_proof.mjs`; workflow: `.github/workflows/ai-draft-authority-proof.yml`; manifest: `supabase/proofs/ai/ai_draft_authority_files.json`. First isolated boundary reconstructs historical79 plus canonical N07/N08 to85, then applies this file as86. A later canonical D03 predecessor requires an additional integrated replay; no old source bytes or live aliases may be renumbered.

The runner uses real disposable Auth/PostgREST, reproduces the predecessor direct-save bypass, and tests BLOCK denial, previous-key acknowledgment, no orphan owner Need, null fallback, latest decision after40 messages, owner/outsider/anon/service authority, and four observed PostgreSQL holder/waiter interleavings. It records pg_blocking_pids and pending pg_locks while holders sleep. Review races test both committed BLOCK and new material pending facts. The workflow also runs existing RU2 correction/privacy/save/supersession regressions. Until original Actions artifacts are inspected, these are planned assertions, not claimed PASS results.

Local source checks: Node syntax,19 existing strict local-target guard tests and migration integrity PASS. No Docker/PostgreSQL runtime is installed on this Windows host; real disposable proof runs on the existing GitHub runner. No production or provider call occurred.

First run34120810444 at30b8fc1 failed in runner PREFLIGHT because its snapshot referenced `public.marketplace_config` instead of canonical `private.marketplace_config`. It reached no AI reproduction or candidate apply; the preceding N07/N08 stages passed. The runner reference is corrected and SQL diagnostics retain only SQLSTATE/query digest. The frozen migration bytes are unchanged; fresh runtime evidence is still required.

Limits retained: old human fact-first/conversation-second locks versus writer/save conversation-first ordering are unchanged, so global AI deadlock freedom is not claimed. Edge lacks durable turn idempotency, uses an old first40 history slice and has no server-date context; those are separate units. This SQL fix alone does not close actual provider execution, Android product proof or publication policy activation.

Live remains the observed85 migration boundary at `20260907102458_clean_n08_notification_preferences`; source baseline for this branch is canonical `9d245f3053c8e79370a73e82b12d4250e3ed94b7`. Source inventory here is86/live85/pending1. Follow fresh canonical→proof→review→forward-promotion. Do not apply from this pending checkpoint.
