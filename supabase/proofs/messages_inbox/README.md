# Focused disposable conversations SQL proof

Prepared, NOT EXECUTED. This package does not alter the reader candidate. It is a focused PostgreSQL proof, not the full EX-04 canonical migration-chain proof.

From the repository root, after integration:

```sh
bash supabase/proofs/messages_inbox/run.sh
```

Or dispatch `.github/workflows/messages-inbox-sql-proof.yml` on the exact integrated branch. The workflow also starts on changes to this proof or the immutable candidate directory. It uses the repository's pinned checkout/setup-node/upload-artifact actions and the focused disposable Docker pattern already used by `supabase/proofs/postgrest/b24_40001_retry_proof.sh`. EX-04's exact-source binding, bounded failure artifacts and always-teardown requirements are retained. There is no npm install or new package dependency.

The runner creates a uniquely named PostgreSQL17 container, with network disabled, no published port and ephemeral tmpfs data. It never reads DB_URL, Supabase keys or a remote target. SQL reaches only that newly created container through docker exec. EXIT/INT/TERM cleanup removes it. The resolved image ID and PostgreSQL version are recorded; startup never silently falls back to another tag. The candidate path is fixed to `supabase/candidates/messages-inbox-01-20261003`.

`bind.mjs` verifies the normalized exact function SHA256 and its frozen body MD5, requires that the complete function body is present in `candidate.sql`, and extracts the exact owner/ACL statements from that approved source shape. It loads four saved private helper definitions without rewriting their bodies: `support_auth_v5`, `push_session_valid`, `closure_account_restricted` and `group_member_v5`. Their pinned body MD5s are verified before preparation and again in PostgreSQL after creation. Only those helper dependencies' table shapes and Supabase claim-accessor primitives are minimal fixture implementations.

The 47 executable SQL assertions cover:

- Actual CREATE FUNCTION and first/cursor-page execution, fixed definer owner/search_path and exact reader body.
- Denied anon/service role/direct table access; expected account mismatch, invalid/expired/missing session, banned caller and closure restriction through actual saved helper bodies.
- Positive private ownership on both Agreement sides, terminal history, multiple jobs with the same person, no-message exclusion and a stranger's empty page.
- Exact descending microsecond/kind C-collation/UUID order, complete walks at limits1/2/3/4/50, tail cursors, malformed/future cursors, timezone-equivalent cursor and a post-cutoff arrival.
- Group membership AND caller-owned route AND per-message visibility; hidden newer messages do not leak into latest or unread, and removal/visibility changes are rechecked.
- Private unread remains null; real group unread counts, voice preview suppression, photo caption codepoint bound, restricted counterpart identity and no listing ACK.

`report.json` can say PASS only if the SQL command succeeds, all47 unique assertion names are present, the explicit final sentinel exists and cleanup succeeds. A missing report/check file is a failure. Only bounded synthetic logs and metadata are uploaded. The fixture has no private/user-provided content.

Limits: the fixture schema is not the canonical predecessor chain; it omits unrelated columns, indexes, policies, triggers and certificates. The new function's exact body and ACL are installed, not the full candidate's deployment preflight/digest gates or revert. Request claims are fixture inputs; no GoTrue, JWT verification, PostgREST dispatch, Data API schema-cache behavior, concurrent session revocation or performance measurement is claimed. A PASS establishes the reader/helper SQL behavior on this explicitly scoped surface. It neither applies the candidate to DEV nor replaces its canonical preflight/postflight or native checks.

Source artifacts prepared by the subagent only. Root is sole integrator and decides the authorized CI dispatch/application sequence.
