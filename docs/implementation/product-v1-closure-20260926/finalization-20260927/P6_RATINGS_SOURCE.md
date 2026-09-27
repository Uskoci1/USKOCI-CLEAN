# P6 — avoid unused rating and Home urgency reads

2026-09-27. **SOURCE ONLY, UNVERIFIED.** No tests, types, build, device, provider, database, or proof execution. No new dependency or payment work. This note records repository source evidence, not a fresh live RPC attestation.

## Concrete change

The calendar and support Agreement picker do not consume rating eligibility. They previously used the same enriched reader as Home and Dogovori, issuing a review RPC for each completed Agreement until the existing budget expired.

- `src/data/ports.ts:68` adds an optional `includeRatings` read option, defaulting to the existing behavior.
- `src/data/agreementClientService.ts:569` retains the complete `ALL` page walk, mapping, account/revision checks and failure paths. Only explicit `includeRatings: false` skips rating enrichment. Every completed row then has `ocenaMoguca: false` and `stanjeProvereOcene: 'UNAVAILABLE'`; skipped knowledge never becomes `NOT_DUE`. No option enters the RPC arguments.
- `src/app/(app)/raspored.tsx:19` and the default reader in `src/ui/support/SupportNewScreen.tsx:48` opt out. Calendar consumes identity/version, participants, status, accepted time, price and locality (`src/ui/calendar/agenda.ts:56–123`). The support picker consumes identity/version, title and time (`SupportNewScreen.tsx:131–134,239–251`). All of these facts and rows remain.
- Home and Dogovori still call `mojiDogovori()` without an option. Their existing rating actions, exact-count/unknown behavior and authoritative review-screen recheck remain.

For these two non-rating consumers, Agreement reads change from **P + up to C RPCs to P**, where P is the list-page count and C is completed Agreements. The calendar still has its separate schedule read. No list cap was lowered; the existing twenty-page refusal is unchanged. This is removal of unnecessary work, not general growth closure.

## What remains

The production reader is `agreementClientService`, composed at `src/data/index.ts:68`; `supabaseIzvor` is not the owner of `mojiDogovori`. `agreementRatingsRead.ts:7–8,19–57` already provides four concurrent workers, a four-second enrichment deadline and account fencing. These bound waiting/concurrency, not total requests. The current per-Agreement authority is `rpc_get_my_agreement_review`; no existing batch review RPC was found in the inspected source. Completion alone cannot establish eligibility: the canonical review source checks both Agreement/execution completion and absence of the caller's review (`supabase/migrations/20260912100000_clean_pre_v3_reviews_authority.sql:118–135`, with later account-closure guards).

Home awaits four sections together (`src/app/(app)/index.tsx:33–39`): all own tasks, all own applications, the complete enriched Agreement walk, and `rpc_home_attention`. Counts, the soonest active Agreement and first-run state require those complete inputs today (`src/data/homeSnapshot.ts:106–131`). Ratings are unavailable if any completed row lacks an answer; no completed-history truncation or zero substitution is safe. Existing attention counts omit the full task/application section breakdown, next appointment and rating total; even its Agreement-more formula uses two rows while Home now shows one (`homeAttentionClientService.ts:6–23,58`). Reusing those totals as a replacement would change semantics.

Home also previously performed unused urgency enrichment: `needClientService.ts:143–154` called `readNeedUrgencies` after `rpc_list_my_tasks`. Its four workers issue up to U `fn_need_urgency` calls for distinct urgent IDs (`needUrgencyClientService.ts:8–24`), but Home composition never consumes urgency.

## Home urgency follow-up

Source now adds a separate optional `includeUrgency` flag to `mojePotrebe` in `src/data/ports.ts:45–46`. Only Home passes `{ includeUrgency: false }` (`src/app/(app)/index.tsx:35`). The actual owner, `needClientService.ts:143–155`, retains authentication, the identical `rpc_list_my_tasks` call, array validation and every `mapNeed` invocation. Explicit false bypasses only the enrichment helper and returns the existing `urgency` property as `undefined`, which the projection defines as unobserved (`src/contracts/projections.ts:54–55,75`). No false NORMAL/HITNO fact is introduced. Omitted/true keeps the previous behavior; `potreba(id)` and other `mojePotrebe()` callers are unchanged. `supabaseIzvor` excludes this method and was not edited.

Exact consumer inspection covered `composeHome`, `ownedTaskCounts`, `hasNeedAttention` and their `marketplaceItems` dependency (`homeSnapshot.ts:79–131`, `marketplaceView.ts:98–145`). Their counts, attention and first-run state do not read urgency. The Home presentation receives the composed snapshot, not task rows. The existing current-account/focus ownership and section failure/timeout behavior in Home remain. The fake/gallery adapter can ignore this read optimization without changing its fixtures.

Excluding authentication, Home therefore changes from **P + up to C + up to U + 3** RPCs to **P + up to C + 3**. This removes unused per-task requests without a list cap or invented total. Complete task/application payloads and completed-Agreement rating work remain; the next active Agreement can still wait on the other sections. This follow-up touches only `ports.ts`, `needClientService.ts`, the Home read call and this report; the earlier four-file rating patch is preserved.

## One next server contract

Propose an additive authenticated `rpc_home_overview_v1()` returning a single statement snapshot: `schemaVersion`, caller `accountId`, `asOf`, at most three authorized attention items plus exact attention count, at most one active Agreement appointment plus exact active count, exact task counts `{total,active,waiting,drafts,history}`, exact application counts `{total,attention,active,finished}`, exact `ratingsDue` and `ratingDueAgreementId` only when that count is one, and an explicit `firstRun` fact covering all three histories. Preserve current section predicates, attention priority, Agreement start-time ordering with existing created-at/id tie order, participant authorization and account-open restrictions. Return only appointment display facts and authorized IDs; no private contact or chat content. Review eligibility must reuse canonical rules, not merely completed status.

This is a bounded response proposal, not a bounded database-cost claim. A later candidate must pin fresh canonical definitions, preserve closure/certificate state, prove parity with current complete reads and review authority, and establish indexed query cost. Failure remains unavailable, never a fabricated zero. No SQL or client runtime for this proposed RPC is included. The separate Dogovori list still needs its own future review aggregate/paging work.

## Review status

Manual source inspection covers the explicit opt-out branches and all affected consumers. P3 independently reviewed the complete six-file source diff, including Home urgency, and found no concrete semantic regression: complete rows and owner checks remain, opt-out consumers do not use those fields, defaults retain rating counts, and neither option enters an RPC. No review checks were executed; runtime/performance acceptance remains unverified. Execution remains deferred by the owner.
