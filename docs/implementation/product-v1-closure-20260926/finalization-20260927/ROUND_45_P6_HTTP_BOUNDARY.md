# Round45 — real local Auth / PostgREST / current client wire

## Problem / user impact and decision

SQL role switching does not exercise GoTrue JWT issuance, HTTP role selection, PostgREST schema discovery, or the actual client decoder. The four-mode candidate remains quarantined until these boundaries and query cost/native ownership are proven. This package tests the first boundary without changing product screens or connecting the production reader.

## Exact implementation and proof

Tested commit bf4008d6757a92ef745bfac00907898f5e8760c6; Actions run 36444393395; 11 boundary groups PASS. Three distinct disposable users are created through the local Auth admin API solely as fixtures; three password logins and getUser reads establish real user JWTs. The service key is never used for marketplace reads. Four PUBLISHED and two non-public fixtures have a private sentinel; PAGE, EXACT_PUBLIC, MAP and PLACES go through actual anon-key authenticated PostgREST requests and the checked-out strict TypeScript decoders. PAGE and PLACES traverse real cursors; all three accounts must see only public exact tasks. Anonymous calls in every mode, malformed JWT, excessive limits, null input, the private account-ID column and other people's sensitive address rows are refused or hidden by the existing boundary.

The local candidate bytes are bound to Round44 SHA256 1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e. No SQL semantic change is made here. The runner allows only explicit loopback Auth/REST origins with redirects rejected. Fixture writes do not retry automatically. Public output contains hashes, boolean checks and counts, not passwords, JWTs, service keys, rows or addresses.

## Backend / environment / cleanup

Historical source147 plus PKG045b disposable baseline, not current DEV compatibility acceptance. Actual local PostgreSQL 17.6, Node v24.21.0, 47 local HTTP requests. Candidate functions are added only to the disposable stack, then explicitly removed. Existing public/private function definitions, ACL/RLS, column grants and closure certificate/readiness fingerprints are unchanged after removal. The isolated stack is stopped with no backup; test identities and rows do not leave it. No canonical DEV package, ledger write, paid provider, push flag, native dependency or payment change is involved.

## Checks / limits / regression

The 11 Round44 SQL groups remain separate exact-source evidence on 7b75631b, run36443089843. The previous malformed city fixture and aggregate PLACES-loop timeout remain historical failures, not retroactive successes. Round43's 347 suites / 7299 tests cover its exact client source; this SQL/HTTP harness does not claim a fresh full app regression or native pass.

Actual local Auth PASS is NOT signup/email-provider N02 PASS, password-recovery acceptance, application session A→B→A, or a two-user marketplace journey. Admin confirmation is fixture setup, not proof of delivered email. Removing local test resources is NOT product account deletion. Small HTTP fixtures are not performance/load or native acceptance.

## Control / status / next highest-impact action

B04/B05 are reconciled and the existing control generator runs before commit. Hosted control publication remains unverified. Status: P6 FOUR-MODE SQL + LOCAL AUTH/POSTGREST/CURRENT WIRE PASS; NOT APPLIED; NOT WIRED; P6 OPEN.

Next: current-predecessor compatibility and internal EXPLAIN ANALYZE BUFFERS, measured 30-sample query budgets across sparse/dense/skewed datasets, then paging ownership, stale-request fences and native map/locality adapters. Device tests, exact provider delivery, whole-app privacy/legal and stores remain separate. No owner approval is requested for mere proof preparation; a later canonical live apply still needs its specific authorization and procedure.
