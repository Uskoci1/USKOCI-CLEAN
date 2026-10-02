# D12 written comment with the star rating - CI proof PASSED, and the approval block for the owner (2026-10-02)

**Status: SOURCE + CI-PROVEN on a disposable chain. NOT applied to DEV. Nothing is applied without the owner's exact words "PRIMENI D12 PISANI KOMENTAR", and that block must NAME the certificate re-bind (below).**
Levels (LIVE plan 4.2): SOURCE yes | CI-PROVEN yes (disposable chain, real Auth and PostgREST) | DEV-APPLIED no | APP WIRED no (no client exists) | DEVICE no | RELEASE no.

## The proof (run `36957213904`, source `f36879aedb5e0a2299928bd1a4d4a93ec7a30187`, workflow `d12-review-comment-proof.yml`)
Result **PASS**: 46 named checks, 0 failures, 0 skipped, 32 refusals exercised, 21 residuals recorded (what a deterministic contact floor still lets through), 20 accounts created, 0 provider calls, no DEV access. The pin gate compared **47 of 47** pinned functions to the 2026-10-01 DEV readback (body and metadata): all equal. The chain is not DEV (it lacks pkg051a, PKG-045b P0, P6 rollout v3 and B24 Part 1) and its certificate is chain-internal, so the report says exactly that and claims nothing more.
What ran on a real database: the atomic application with the three-place certificate re-bind, the integrity guard, old-client parity (the legacy RPCs answer byte for byte as before), the gates (who may write, one review per side, only after a really completed Agreement), the validation matrix, visibility and RLS, moderation (hide/restore of the text only), two real closures (author and subject), the export (52 datasets), the revert and the re-apply, and the weakening probes (each guard shown to fail when removed).
History, kept honestly: the **first** CI run (`36949455489`, source `f8e36e52`) gave 42 passed, 2 failed, 1 skipped. Both failures were defects of the PROOF, not of the candidate: (1) the anonymous refusals of the legacy and the v2 function differ only in the function name inside the message, which the test compared raw; (2) a raw text hop lost a Unicode noncharacter (U+DFFFF). The proof now carries every text as ASCII both ways (base64 in, hex out) and measures the raw hops separately; the candidate bytes did not change (sha256 below). Reports: `supabase/proofs/d12/`, artifacts of both runs (`d12-report.json`, `d12-report.md`, the chain application files).

## Fresh read-only DEV preflight (2026-10-02 04:12:27 UTC, canonical DEV `leqcwgzvjsxugfgzdmth`, `supabase/proofs/d12/d12_preflight.readonly.sql`)
`problems: []`. 44 metadata pins and 46 body pins equal; certificate `58447d77...` = live = bound, `ready` true; no closure executing (0 of 0); 75 redaction relations, 52 export datasets, projection `70009062...`; **7 reviews** on DEV (baseline `3147107a54c973ab404245bd58deb361`); ledger **220** (latest `20261002022631`, the ex06a application, which touches none of the D12 pins). So the application would pass its predecessor gates now.

## What the application is (one guarded statement)
- `supabase/candidates/d12_review_comment.sql`: 684 lines, 77,613 bytes, sha256 `8a1ff92a88acf22678c820068791e14e610febde941b69d03f777b975da1daba`. Guarded text (integrity guard + candidate): 77,963 bytes, sha256 `bd632612001051618d472fe766cb5e1d3fe754d07ee079375620d550ed1667fd`; the guard refuses (`D12_APPLY_TEXT_INTEGRITY`) unless the received span equals the candidate (span 77,612 characters, sha256 `45548367b9a57ccad5c13016f8bc35a9634bcf8bb9bac93f9b9439e6254ae8cc`).
- Adds one table (`private.agreement_review_comments_v1`, forced RLS, no client grant), two triggers, six functions (guard trigger, text validator, `rpc_submit_agreement_review_v2`, `rpc_get_my_agreement_review_v2`, `rpc_list_review_comments_v1`, `rpc_moderate_review_comment_service_v1`), edits three certified closure functions and the export catalog/snapshot, one retention-class text, and **re-binds the closure certificate `58447d77...` inside the same statement** (closure_source_v5, closure_erasure_source_v5, the literal in `retention_ai_source_ready`). The old star functions stay byte-identical (old APKs keep working). Ledger 220 -> 221.
- Revert: `supabase/candidates/d12_review_comment_revert.sql` (sha256 `9d9d9cdb30437f583b4844a6025249ebe4a31f4da156b609c6364620f8659ca0`), proven on the chain, NOT applied. **Its window closes at the first stored comment or the first closure after the application**, whichever comes first; after that there is no clean way back.

## What the exact words must knowingly accept
The words are **"PRIMENI D12 PISANI KOMENTAR"** and they must NAME the certificate re-bind, for example: "PRIMENI D12 PISANI KOMENTAR, uključujući re-bind sertifikata zatvaranja 58447d77". Per `AGENTS.md` 3.1.4 a change that moves the certified closure digest needs an isolated recertification (done in the proof) and the owner's explicit approval; approval does not imply anything about the device.
Each item is a default the candidate IMPLEMENTS; the full text is "What the owner's PRIMENI must knowingly accept" in `supabase/proofs/d12/README_D12_CANDIDATE.md` (numbers below are that README's). Owner decisions D-DEC-2 (hide only the comment text, service role, no automatic access, no automatic moderation) and D-DEC-3 (only the existing report channels) are implemented as he gave them.
1. The certificate re-bind and the shrinking revert window (above).
2. One catalog text (retention class `AGREEMENT_REVIEWS`); NO retention period is set.
3. Export: the author's own comment is exported (`OWN_ACCOUNT_V5_9` -> `V5_10`); comments RECEIVED about a person are not, so the reviewed person cannot get a copy of what others wrote about them.
4. Closure of the REVIEWED person hides the comment at read time and keeps it without an end date until its author closes.
5. Closure of the AUTHOR erases the comment even for a protected Agreement (reading of the DEV bodies, not exercised by a run).
6. A commented review is individually attributable (stars + the reviewer's face + review id), published at once, no blind reveal.
7. D-DEC-7: one account-level list under BOTH profile faces, so an observer can link a person's two faces by comparing lists (a role-scoped list is a function-only change, not implemented).
8. Moderation: service role only, per review, text only, audited; no author notification, no operator, no response time, no automation, no AI.
9. The contact floor is a screen, not privacy protection (21 residuals measured).
10. The floor is shared with Q&A and chat; tightening it later can turn a lost-ack replay into a refusal.
11. Logs: the server log was not scanned; statement logging that prints bind parameters would contain comment text.
12. The account id inside `avatarPath` (as `rpc_get_public_profile` already returns it).
13. The closed text class (Unicode 17.0 default-ignorable code points refused; private use, noncharacters and unassigned are not covered).
14. Legal inputs stay open (retention period, lawful basis, DPIA, moderator, response time, author notification); the legal drafts carry additive D12 notes only.
15. Apply method: ONE guarded text, preflight `problems: []` immediately before, postflight `problems: []` after.
16. **Owner choice, default implemented = symmetric block rule (shadow comment):** when the AUTHOR blocks the reviewed person, that person cannot see the comment, cannot learn its id and cannot report it from the comment, while every third viewer still sees it; the only remedy is the audited HIDE. Options A (function-only: show to the reviewed person with the author's face masked), B (accept, default), C (write-time refusal), D (A plus an operator rule) are written in the README; NONE is implemented but B.
17. **Owner choice, default implemented = aggregate stays public:** `reviewCount` and `averageRating` stay public while the individual rating of every COMMENTED review is published; for fewer than about 100 reviews a reviewer who wrote no comment can be de-anonymised by subtraction. The sentence "star-only reviews stay aggregate-only" must not be used in any text.
18. A policy on the comment table is outside the certificate (known limit); covered by no client grant, forced RLS and the postflight.

## What applying does NOT give (read this before deciding)
- **Nothing visible.** No client exists: no screen writes or shows a comment, and no new APK has the capability test (`PGRST202` on `rpc_get_my_agreement_review_v2`). The star flow on the phones is unchanged. The first user-visible change needs a separate client round (the README's "Client contract").
- It moves the certificate and its revert window closes at the first comment, so applying it early buys no user value and shortens the time in which a clean undo exists. Items 16 and 17 and D-DEC-7 (item 7) are the real product decisions still open inside the candidate; changing any of them after the application is a new package (and, for the table-level ones, a new re-bind).
My recommendation (not a decision): decide items 16, 17 and 7 first, then apply together with the client round, so the proven window is used. If the owner prefers the server first, the block above is complete.

## Not proven
The Postgres server log; Storage object contents of an export artifact; author closure of a PROTECTED Agreement; a published export policy bound to the new projection; a non-ACTIVE author profile; the transport of the 77,963-byte guarded text through the real connector (the guard turns any changed byte into a refusal and the postflight into a named problem, so a bad transport cannot apply a different text); any native or device behaviour (there is no client).

## Not done
Nothing was applied to DEV or PROD, no flag, no APK, no Edge change, no phone. The revert is not applied. B09, ex06a and every other package are untouched by this block.
