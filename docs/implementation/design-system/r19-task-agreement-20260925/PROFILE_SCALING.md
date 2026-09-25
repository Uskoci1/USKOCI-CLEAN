# R19 public profile enrichment bound

Date: 2026-09-25. Scope: client source and focused local verification only. No server, dependency,
device, credential, payment or provider changes. Final integrated tests, source attestation and native
verification belong to the R19 release receipt, not this note.

## Confirmed problem and resulting behavior

`supabaseIzvor.safePublicProfiles` previously deduplicated authors but used `Promise.all` over every
distinct author. A list with 1,000 different authors could therefore start 1,000 public-profile reads
at once, and one stalled read could prevent the otherwise valid task collection from returning.

The helper now delegates to `publicProfileEnrichment.ts`:

- At most four simultaneous reads per enrichment invocation, using the existing public-profile RPC.
- One 4,000 ms budget for the entire optional enrichment collection, starting after task pagination.
- No new queued read after the deadline or reader retirement. Pending transports receive an abort
  signal; a transport that ignores it cannot delay the collection beyond the budget or publish late data.
- One read per distinct nonempty author ID. There is no cross-account metadata cache.
- Reader identity and account revision are captured by `safePublicProfiles`. A change retires pending
  work and discards all metadata from that invocation, including an A -> B -> A change. The account
  watcher notices a fully stalled pool within 100 ms; each completed read also checks immediately.
- Successful metadata collected before a normal deadline remains available. Failed, malformed,
  skipped or timed-out profiles remain unavailable. Public tasks and their price, capacity, schedule,
  location and ownership contracts are not removed or rewritten because optional metadata failed.
- Unknown names remain the existing empty value; unknown ratings/review counts/portraits remain null.
  A disclosed real zero review count remains zero. No invented reputation is introduced.

`publicProfileClientService.javniProfil` accepts an optional `AbortSignal`. Existing one-argument
callers remain compatible. The same `rpc_get_public_profile` and unchanged projection validator still
own the public/private boundary. Direct profile-screen reads continue to surface failures; collection
enrichment alone degrades to unavailable metadata.

## Exact changed surfaces

- `src/data/publicProfileEnrichment.ts` — pure injected scheduler and deadline/retirement fence.
- `src/data/supabaseIzvor.ts` — current session binding and replacement of unbounded fan-out.
- `src/data/publicProfileClientService.ts` — optional transport abort and post-response abort check.
- `src/data/__tests__/public-profile-enrichment.test.ts` — bounded concurrency, failure and retirement.
- `src/data/__tests__/opportunities-read.test.ts` — explicit reader fixture, optional signal assertions,
  preservation of tasks on profile failure, and actual wrapper A -> B -> A retirement.
- `src/data/__tests__/task-detail-read.test.ts` — explicit reader fixture and optional signal assertion;
  existing public/private task projection assertions retained.
- `scripts/task_detail_read_preflight.mjs` and its test — the exact new source dependency is allowlisted,
  hashed in the existing source inventory, and supplied interval timers in the isolated VM. Existing
  read-only route/host guards and rejection of unknown source modules remain unchanged.

The source-loader search found this exact dependency in the W05 task-detail read loader. No other
proof loader was changed; no migration inventory or source-body pin was relaxed.

## Verification actually run

`npx jest --runInBand --testTimeout=30000 --runTestsByPath
src/data/__tests__/public-profile-enrichment.test.ts
src/data/__tests__/opportunities-read.test.ts
src/data/__tests__/task-detail-read.test.ts
src/data/__tests__/public-reputation-boundary.test.ts
src/data/__tests__/ru5-p0c01-public-profile.test.ts`

Result: **5 suites, 84 tests passed**.

`node --test scripts/task_detail_read_preflight.test.mjs`

Result: **3 tests passed**, including loading the current exact source dependency graph and retaining
the rejection of writes, arbitrary RPCs and nonlocal/redirected hosts.

The new fake-clock scenarios prove 1,000 unique mocked authors peak at four concurrent requests;
duplicates read once; a stalled collection returns at 4,000 ms with only its first four requests started;
late replies cannot change the returned map; successful partial metadata is kept; A -> B -> A discards
old data and prevents further queue starts; malformed/failed profiles still pass through the original
validation boundary; and abort reaches the RPC transport. These are deterministic local behavior tests,
not a measurement of production network throughput or database capacity.

`git diff --check` passed with only repository CRLF normalization warnings.

## Remaining scaling limits

This is a fan-out and latency mitigation, not a batch-read replacement. Up to U individual RPCs can still
run for U distinct authors before the shared deadline. Four is a per-invocation limit, not a global app
connection limit. Multiple independent readers can each own a pool. Profiles not reached within the
budget remain unavailable until a later list/detail refresh; this patch does not add background retries.

The task list still walks pages up to its existing 5,000-row guard, and urgency enrichment and task
pagination have their own behavior. This patch does not guarantee the entire discovery list returns
within four seconds. Server-side discovery parity, bounded/pageable message history and a server
aggregate for author metadata remain separate candidates requiring evidence and owner approval.

The earlier `FUNCTIONAL_RECONCILIATION.md` describes the pre-patch source cutoff correctly. Its
unbounded public-profile fan-out finding is now **mitigated in this R19 working-tree source**, not
asserted deployed, installed, fully load-tested or store-ready by this note.
