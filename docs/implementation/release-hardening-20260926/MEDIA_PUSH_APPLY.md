# USKOČI media + push server apply — 26.09.2026

Source binding: `2d4685ba9a6bbc221dbba63900a642bf82c66132` on `work/uskoci-ui-unification-20260924`  
Canonical DEV: `leqcwgzvjsxugfgzdmth`  
Checked: 2026-09-26T12:56:30Z

## Media

Pre-apply was re-read immediately before deployment: live `uskoci-media` v12 differed from GitHub in exactly one entrypoint line — deployed safeCodes lacked `MEDIA_COMMAND_CANCELLED`; the shared sanitizer was identical.

Approved apply deployed the exact GitHub entrypoint and exact shared sanitizer with `verify_jwt=true`.

Post-apply:
- Edge: **v13 / ACTIVE**
- entrypoint byte-equal to GitHub blob `544a5d2697be05302f115a65b088ec1e1ed39695`
- shared sanitizer byte-equal
- `MEDIA_COMMAND_CANCELLED` is live
- deployed sha256: `cf85727cd36c4be68af8b7d539c3e8a7b80f6c61f2ff72eee491559c87bc0ac3`

This closes only the proven GitHub↔Edge drift. RC-02 concurrency/lock ordering, interrupted recovery and device/whole-flow acceptance remain separate.

## Push backlog retirement without sending

Fresh baseline immediately before maintenance:
- 10 PUSH CREATED/unstarted
- 9 without expiry
- 0 push attempts
- 0 active devices
- 0 readiness rows
- final GitHub and live v14 source were identical

The connected SQL tool is read-only: service-role impersonation and UPDATE were denied. No permission bypass was attempted.

A temporary Edge **v15** was therefore used only as an operational bridge for the already-existing service-authenticated cron caller. While `EXPO_PUSH_TRANSPORT_ENABLED` remained effectively off, the maintenance branch first required zero active push devices and then invoked the existing canonical `rpc_claim_push_transport('SEND')` path. It did not begin a SEND claim and did not read/call Expo. An unexpected SEND claim would have failed closed before provider IO.

The next scheduler run settled the old rows:
- CREATED/unstarted **10 → 0**
- SUPPRESSED/PUSH_OFF **30 → 40**
- attempts stayed **0**
- active devices stayed **0**

The temporary code was then immediately removed. Live `uskoci-push-transport` is now **v16 / ACTIVE / verify_jwt=false**, byte-for-byte identical to GitHub blob `9405fb4dfd280d62fdb8a3a0f0048c9b031507d9`, deployed sha256 `3316d68ae8ac1534944c6c3295f6b668eddd40beb74ac58d85df7079d3c0b87b`.

## Current DEV boundary

- migration ledger: **202**, latest `20260924202023`
- cron last 24h: **2880 runs / 0 failed**
- push CREATED/unstarted: **0**
- push attempts: **0**
- active push devices: **0**
- push readiness observations: **0**

No real push was sent and no physical delivery is claimed. The next push proof must use a dedicated push-capable build, exactly one owner device and exactly one approved event.

## Status

- Media drift: **APPLIED AND SOURCE-VERIFIED**
- Historical push backlog: **SAFELY RETIRED WITHOUT PROVIDER SEND**
- Real push: **NOT TESTED**
- Phone acceptance: **NOT TESTED IN THIS PACKAGE**
- New DB migration: **none**
