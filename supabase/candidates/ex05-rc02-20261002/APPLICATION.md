# RC02 — applied to canonical DEV

Owner explicitly approved **PRIMENI RC02 DEV** after receiving the candidate, wait-semantics limits and no-new-concurrency-proof disclosure. Applied at migration version20261002172532 to leqcwgzvjsxugfgzdmth from committed source7912806fef2b1e2b0a41b6b25d39663806cd2499.

Only public.rpc_cancel_media_upload(uuid,uuid) changed. Read-only preflight2026-10-02 17:25:11UTC matched7/7 pins. Postflight17:25:57UTC matched the new target body043f8cfb2cbe68e6f791e1be23ca14cc and six unchanged siblings; non-body catalog hashes/comments unchanged for all7. Current digest and both certificate bindings remain0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431; retention ready=true. Ledger222 total/74dev_alpha.

Exact committed candidate text without final LF was sent as one apply_migration statement. Stored ledger payload SHA2563b492a764ff27b9acac020d7ba72353b2c3c2c0a938a402c2f1aac91e74e9073 matches. [Application receipt](../../operations/dev-alpha/ledger/20261002_ex05_rc02_application.receipt.json).

This establishes application and metadata readback, not runtime concurrency or native acceptance. Earlier EX05-S02 run reproduced the bug, not this candidate's correction. Non-READY/tombstone cancellations now also wait on conversation. In-flight callers may retain the old body. Exact guarded revert restores the known inversion and was not applied. No business RPC, provider, Edge, production, data deletion or certificate rebind was performed.

APPROVAL.md, SOURCE_REVIEW.md and manifest.json describe the frozen preparation state; this application record supersedes their NOT APPLIED status without rewriting the approved executable artifacts.

