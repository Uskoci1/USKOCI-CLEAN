# R19 — bounded functional reconciliation

Inspection: 25 September 2026, approximately 21:00–21:10 UTC. This is a read-only reconciliation of selected high-impact paths, not a new claim to have read every file or tested the entire product. No runtime, DEV data, schema, Edge, key, account, device, provider or payment mutation belongs to this inspection. The R19 UI authors were editing concurrently; their uncommitted changes are identified as work in progress below.

## 1. Evidence hierarchy and exact versions

| Surface | Observed evidence | What it establishes / does not establish |
| --- | --- | --- |
| Local checkout | Detached HEAD `5ca735315684473a2e90e31325230c6d46636373`; previous runtime commit `74f514d79fa323e135c9ddc23a6cb6b5b934c730` | R18 runtime plus its committed documentation. R19 runtime changes are present in the working tree, not yet the installed build at this cutoff. Detached HEAD is an integration detail, not evidence that work is lost. |
| GitHub branch | `gh api repos/Uskoci1/USKOCI-CLEAN/branches/work%2Fuskoci-ui-unification-20260924` returned the same `5ca73531…` | The named remote branch contains the R18 checkpoint. This inspection did not fetch, merge, commit or push. |
| GitHub Actions | Fresh `gh run list`: R18 phone `36183495466` and emulator `36183499333` succeeded on `74f514d7`; PKG-051 proof `36183468260` also succeeded there | Build/proof status. The price-list proof is not evidence of a working paid checkout or store billing. Earlier R17/R16 APK runs in the seven-run sample were also green. This is not an assertion that every workflow in the repository was rerun. |
| Tests | R18 CHECKS/RECEIPT records clean types and 317 suites / 6,185 tests. Separate R19 TaskCard focused run observed 4 suites / 114 tests passing | Historical integrated R18 checks and one current scoped R19 check. This read-only reconciliation did not rerun the full suite. Read R19's final receipt for later integrated results. |
| Installed/native | R18 RECEIPT and REAL_JOURNEY bind phone and emulator APKs to the same source/tree, with different ABI-specific hashes | One real authorized REMOTE / end-only / one-person / OFFERS journey passed through publication, another account's offer, selection, both-direction messages, worker completion, requester confirmation and both saved ratings. Not whole-app, iOS, store or visual acceptance. |
| DEV ledger | Independent fresh read returned **202 = 147 source + 55 dev_alpha**, latest name `dev_alpha_pkg051a_platform_price_list` | Reconfirms ledger count/name. Does not prove all applied text hashes, data invariants or function bodies. Root's `LIVE_PREFLIGHT.json` records the same ledger and fresh Edge metadata. |
| DEV certificate | Fresh combined private-control query failed `42501: permission denied for function closure_source_digest_v5` | Neither current certificate equality nor retention readiness was measured by that query. No alternate privilege or credential path was attempted. |
| Historical DEV snapshot | `docs/control/dev_snapshot.json`, generated `2026-09-24T20:24:30Z`, ledger 202, matching `cc248ff…` digests, retention true, two active minute crons, 2,880 runs / zero failures in its window | Historical catalog/health evidence, not a continuously refreshed health check. Regenerating the control UI does not refresh these observations. |

The canonical entry is AGENTS.md's R18 paragraph, R18 RECEIPT/REAL_JOURNEY and the current master/research plan. The cloud handoff's “Current head” (`b4531ef`, September 24) and its earlier “done” rows are historical. Its instructions to install Nearby/remove the checkbox as unfinished are superseded by later source. The research PLAN/CURRENT_GAPS was written against R17: its DN-01 and unbounded-rating descriptions require the R18 corrections below.

## 2. What is genuinely connected now

| Capability | Current evidence | Remaining boundary |
| --- | --- | --- |
| One account, both sides | Discovery keeps own tasks visible and labeled; known own opens own management, other/unknown opens guarded detail. Account ID + revision and focus guards fence callbacks. `zadaci.tsx`, `taskRelation.ts`, `marketplaceView.ts` | An unknown relationship is not permission to apply. Full account-switch / third-account native isolation matrix remains unexecuted. |
| Discovery retry (DN-01) | Explicit refresh restarts both public tasks and relationship reads even with unchanged IDs. Coalescing and account/generation fences are in `focusedResource.ts` and route hooks | This corrects ownership/recovery, not server filtering, paging or large-catalogue cost. |
| Task → offer → Agreement → rating | R18's actual two-account journey confirms the specified path, including an eligibility refusal, correction of a real missing tool and a new successful offer | Only that scenario. Onsite/private address, team offers, competing offers, price-basis combinations, changed terms, cancellation and disputes need their own scenarios. `Zatvoren` is a grouped parent label, not proof of the raw parent database enum. |
| Human chat refresh | Route opts into retained data + coalesced refresh, has one bounded read deadline; outbox reconciles actual IDs and receipts. Late account responses cannot republish the retired view | Manual refresh worked in R18. Automatic incoming delivery, paging and precise read-through acknowledgement remain separate. |
| Review enrichment (RC-03) | `agreementRatingsRead.ts`: four concurrent reads, one 4-second pool budget, abort, account-revision checks and `UNAVAILABLE` state. Home does not turn an unknown rating total into zero | Still per-completed-Agreement reads. The budget starts **after** Agreement pagination. Four is per invocation, not a global cross-screen request cap. |
| Public safety entry | `useSafetyEntry.ts` resolves a public profile to an authorized target before `/bezbednost`; safety service validates account/target/revision/receipt. Existing task/profile entries are not missing features anymore | `SafetyScreen.tsx` still says generic “korisnik”, has no named-target display, and its block button invokes the mutation directly without a separate explicit confirmation. Moderation operation is not proved by a report form. |
| Nearby / private location | Nearby is lazy, explicit-tap foreground capture, one fresh result, timeout/retirement; camera target is in screen memory. Location saving routes still send `confirmed: true`. Current-location sharing is retired; private task address is a different contract | Permission-denied/resume/native map matrix remains. “Nearby” is not distance sorting or continuous tracking. |
| AI | One paid text interview worked in R18 and produced the reviewed task; structured correction/publication worked | This is not evidence for every category, worker interview, voice, provider interruption or broad conversational quality. The one-test provider permission has been fulfilled. |

## 3. One item versus 1,000: concrete cost model

These are deductions from the inspected loops, **not measured production load results**. Let N be returned tasks/Agreements, U distinct task publishers, H urgent tasks, C completed Agreements, and M returned chat messages.

| Path | One item | 1,000 items | Why the current bound is insufficient |
| --- | --- | --- | --- |
| Discovery task pages | One RPC | Five serial page RPCs at 200/page | `supabaseIzvor.otvorenePrilike` walks all pages before returning; max 25 pages, then explicit refusal, not silent truncation. Client sends cursor/limit but not bbox/filters. |
| Publisher enrichment | One public-profile RPC | Up to 1,000 **concurrent** public-profile RPCs for 1,000 different publishers | `safePublicProfiles` uses `Promise.all(ids.map(...))`, awaited before the list resolves. The six-visible-avatar rule bounds image mounting, **not** these metadata reads. This is an independently rechecked high-impact gap. |
| Relationship overlay | One RPC | Ten serial RPCs at 100 IDs each | The route's “visible” string currently contains all loaded IDs, not only visible rows. It is bounded per call but still scales with the full loaded catalogue. |
| Urgency enrichment | Zero or one RPC | Up to H extra RPCs, four in flight | `readNeedUrgencies` stops after failure/account retirement, but has no collection deadline of its own. The route's 15-second race prevents indefinite UI waiting; it does not abort all underlying Discovery reads. |
| Agreement collection | One page, plus one review read if completed | Ten serial pages plus up to C review reads completed/started within the enrichment budget | `mojiDogovori` still requests scope ALL, up to 20 pages of 100. Active work waits for the page walk; the review pool only bounds the next phase. |
| Home | Four top-level section reads | Still four top-level reads, but needs/applications/Agreements load complete collections underneath | `index.tsx` calls own needs, own applications, Agreements and server attention. `rpc_home_attention` does not make the other three counters/next-Agreement reads bounded. |
| Human chat | Small ascending table read, few mounted bubbles | Ascending query with **no explicit limit/cursor**, then every returned message rendered with `shown.map` in a ScrollView | A server-side REST cap may truncate the response; its current configured value was not measured. Either large mounting or incomplete history is possible. No claim is made that all messages beyond 1,000 are actually returned. |

R18's mock test explicitly exercises 500 completed Agreements and measures peak four with 500 total RPCs. It proves the mitigation's behavior, not database latency, battery cost, bandwidth or 1,000-user concurrency.

Next scaling package must provide server-filtered/cursor-based Discovery with matching counts and a bounded publisher projection; a review/collection aggregate; and chat latest/older pages paired with a displayed-message read boundary. Do not substitute a client limit that silently drops totals, old pending commands or active work. Do not simply forward the existing filter object and declare semantic parity.

The **live** `rpc_list_open_tasks_v3` body was read in full: filters are category, priceMode, urgentOnly, remote, startsFrom/startsTo; bbox is bounded; return is items/hasMore/asOf with no total count. Start-time predicates do not provide full flexible/end-only/date-overlap semantics. It is SECURITY INVOKER. It preserves public projection/RLS rather than exposing exact addresses. A new query contract must preserve all those privacy and missing-point distinctions.

## 4. Fresh scoped permission evidence

No write RPC was executed. Catalog and function-definition reads only, canonical DEV.

All ten inspected RPC signatures deny `anon` execution and allow `authenticated`: open-task list, task relations, Agreement page/workspace/review, message-read settlement, safety target/report, and the two legacy functions listed below. Grants alone are not authorization proof.

Five complete live bodies were read:

| Function | MD5 of pg_get_functiondef | Observed boundary |
| --- | --- | --- |
| `rpc_list_open_tasks_v3` | `8a47d061da5f9bd65b5e3cc6c947d5d7` | Auth required, invoker, allowlisted projection/filters, bounded page. |
| `rpc_get_my_task_relations` | `f6285bf8e21a6051b3cd80080ec0a113` | Auth required, 1–100 IDs, own requester rows or own worker responses only. Absent/non-owned IDs do not disclose another user's applications. |
| `rpc_get_agreement_workspace` | `899747f13ebc1c7d5a74795a7c5b0047` | Auth required; Agreement predicate includes caller as requester/worker. Phone disclosure additionally requires valid grant and status. actionState is delegated to the existing private helper. |
| `rpc_get_my_agreement_review` | `48c4595f23cbd834a34b92aff8cf7276` | Caller must be a participant. Own review only; completion and closure restrictions control eligibility. This remains one Agreement per request. |
| `rpc_mark_agreement_messages_read` | `430548576bfbeabb21cf73afc20da592` | Caller must be a participant; only caller's visible IN_APP message events for the Agreement settle. No timestamp/message-ID boundary: a newly arrived, unseen event can be included. This is notification settlement, not a counterpart read receipt. |

Live table catalog confirms RLS enabled on needs, agreements and agreement_messages. The message SELECT policy is participant-scoped, combined with a **RESTRICTIVE** `rpc_storage_account_open()` policy. This is evidence of intended isolation, not a third-account behavioral test or audit of every storage/private helper.

Legacy `rpc_ai_open_conversation(text)` and `rpc_send_agreement_message(uuid,text)` remain authenticated-callable in the fresh catalog. Their complete bodies were not reviewed in this pass; their existence does not by itself establish a vulnerability. Retirement needs a dependency/client compatibility/proof package, not deletion because the current UI uses newer paths.

Root's live Edge listing confirms eleven ACTIVE functions and their versions; no fresh byte-for-byte Edge body comparison or provider call belongs to this reconciliation. Private certificate/retention access remained unavailable. Do not report the historical snapshot as a fresh successful control.

## 5. Reconcile old findings rather than count them as current defects

R6 FINDINGS.json is a historical 181-item queue: 24 major, 22 previously checked/confirmed and 157 minor/polish. It is **not** a current count of 181 open bugs, nor proof that every item was fixed by later visual rounds. A bounded body recheck found:

| Historical claim | Current source observation |
| --- | --- |
| Candidate offer facts only in accessibilityHint | Corrected: `CandidateFace.tsx` puts full offer facts in accessibilityValue. |
| Root navigation ignores reduced motion | Corrected: `_layout.tsx` selects none vs slide from the reduced-motion state. |
| Chat refresh empties a successful transcript | Corrected by the R18 opt-in resource policy; paging/incoming remain open. |
| Own task must be excluded / same-ID relation retry missing | Superseded by owner's own-task rule and R18 implementation. |
| Unbounded simultaneous Agreement review enrichment | Mitigated by R18; total P+C cost remains. |
| Disabled task-detail primary uses opacity 0.45 | Mechanism remains at `ProductDetails.tsx:333`, with the white action text unchanged. No new numeric contrast/native measurement was performed. |
| Selection replaces the root tab navigator | `kandidati.tsx:142,155` still uses router.replace to root `/dogovor/[id]`. Back-stack concern remains; R18 opening the Agreement is not proof of the subsequent Back path. |
| Completion review is a hand-made Modal | Still present in `AgreementCompletionReview.tsx`; functional completion passed in R18. This is a composition/accessibility follow-up, not proof that completion is broken. |
| Formatter allocated per date conversion | `calendarPresentation.zonedParts` still constructs Intl.DateTimeFormat per call. Measure/cache with timezone/DST parity; do not claim measured typing lag from source alone. |
| Chat mounts entire returned transcript | Still present: ScrollView + shown.map; draft/outbox updates can rerender it. No native long-history benchmark was run. |

R18 adds real, scoped findings E01–E04 and V01–V03. At this cutoff, R19's uncommitted Segmented change explicitly clears the spoken badge text, so **E04 has a source candidate, not native closure yet**. Other R19 composition changes likewise need their own checks and same-source capture. Do not mark findings fixed from a changed filename alone.

## 6. Highest-impact remaining gates and order

1. **Feedback/recovery truth:** known eligibility refusal versus uncertain outcome (E01), allowlisted hard-blocker reason/correction path (E02), remote/end-only application projection (E03), spoken empty count (E04), docked multiline composer clipping (V01), selection success visibility and navigation return. Keep immutable pending-command identity and readback guards.
2. **Finish the coherent native composition batch:** task/Agreement distinction, map marker rendering, filters, task photos, AI correction and real people. Check one exact build at ordinary text first, then bounded narrow/large-text resilience. Preserve the R18 success path.
3. **Bounded data contracts:** Discovery including publisher fan-out, Agreement/ratings/Home aggregation, own tasks/applications projection parity, chat incoming/paging/read-through together. Disposable proof and explicit DEV application remain separate steps.
4. **Trust/privacy/account operations:** named safety target + block confirmation, moderation ownership, export/legal retention and cross-device closure recovery; photo cancellation lock-order finding RC-02 requires the dedicated concurrency proof. A worker accepting a key or an empty tick is not completed real export/closure.
5. **Delivery/product decisions:** real OS push registration → delivery → tap/deep link; reminders; urgency policy currently recorded disabled; rating comment contract (no matching comment candidate identified in the inspected candidate inventory); worker AI/provider quality; dictation permissions and iOS. Full spoken AI dialogue remains distinct from dictation and text answers.
6. **Release:** operator/legal publication and data forms; production environment and secrets owned/configured appropriately; exact signed AAB and iOS/TestFlight builds; payment model/provider and store-compatible implementation; third-account isolation, offline/replay/concurrency, performance and complete acceptance matrix. This pass makes no fresh legal/platform-policy determination.

Payment work/PKG-051 stays with its owner. A versioned price list, even with a passing proof, is not payment collection, refunds, receipts or store acceptance. The control table's historical payment proposals conflict in date/scope; settle the current commercial release decision explicitly rather than deriving it from whichever old paragraph an agent reads first.

## 7. Safe cleanup versus unsafe cleanup

Safe follow-up: add concise superseded-by links to old handoffs; move old “next” prose behind dated history; summarize the append-only `sledece` paragraphs while preserving evidence links; retire duplicate UI wrappers only after actual import/route/source-loader checks; remove generated local artifacts only through an explicit scoped maintenance task. Keep one control tracker.

Unsafe to do as aesthetic cleanup: delete compatibility routes/deep links, pending-command journals, account/generation guards, “unused” public RPCs, private closure helpers, proof loaders, migration files, test-source adapters or historical receipts. Do not delete the owner-authorized DEV test records or falsify them as real paid work. Never rewrite frozen/applied migrations or sweep concurrent agents' uncommitted files into a cleanup commit.

Control documentation already states that a route/import/RPC-name match and the presence of a test are structural indicators, not behavior. Several blocker descriptions still cite old APKs or say worker finish/both ratings were unproved; R18's scoped evidence supersedes those specific claims. Conversely, the current two-device checklist has only the listed R18 steps completed; no whole-plan green status is justified. The remote artifact upload was unconfirmed after its chooser timeout even though local generation succeeded.

## 8. Explicit coverage and remaining audit scope

Read: AGENTS entry, cloud current-head/continuation sections, control README/snapshot/row and gate metadata, R6 counts and major entries, research PLAN/CURRENT_GAPS, R18 REPORT/RECEIPT/NEXT/REAL_JOURNEY; current Discovery page/relationship/enrichment bodies, Agreement page/review pool, Home composition, message read/refresh/render/acknowledgement, public-profile and safety boundaries, Nearby capture, selected R6 accessibility/navigation/formatting bodies. Fresh GitHub branch/actions and the scoped DEV catalog/five bodies above were measured.

Not done: entire-repository semantic reread; all 181 findings; all stored procedures/RLS/grants/triggers/storage policies; all Edge deployed bytes; fresh certificate/retention success; load tests or EXPLAIN plans; provider/voice calls; device operations; third-party account attack tests; signed release/store checks. Those remain explicitly bounded next work, not implied by this report's existence.

Assessment: there is a coherent working product and a demonstrated narrow end-to-end path. The principal remaining work is predictable data loading, precise recovery/eligibility feedback, finished native composition, operational delivery and release evidence. Rebuilding the engine from zero is not supported by this inspection; declaring the app complete is not supported either.

## 9. R19 implementation addendum — 2026-09-25, after the inspection cutoff

The observation tables above remain the record of the inspected source. Two subsequent client-only
implementation changes must be tracked separately from their original findings:

- **Public-profile fan-out: mitigated in the R19 working tree.** `PROFILE_SCALING.md` records the exact
  patch and completed local checks: four simultaneous reads per invocation, one 4,000 ms enrichment
  deadline, deduplicated authors, transport abort, account-ID/revision retirement and late-answer
  fencing. Public tasks remain visible with unavailable optional metadata. Five focused suites / 84
  tests and the three W05 source-loader tests passed. This is still up to U individual profile reads,
  not a server aggregate, global connection cap or four-second bound on the entire Discovery read.
  Final integrated build and native acceptance are pending outside that focused evidence.
- **MEDIA_BINARY_READ: separate client transport defect fixed in source.** The root/media investigation
  identified that the actual Functions SDK treats the returned `image/jpeg` response as text, while the
  media reader requires a Blob. The replacement contextual read preserves the original JPEG bytes,
  existing session/account boundary and media limits. The actual-SDK regression fails on the old
  implementation and passes after the fix; 62 focused media tests pass. See MEDIA_BINARY_READ.md,
  MEDIA_BINARY_READ_PROOF.log and the independent BINARY_REVIEW.md for exact evidence and native
  fetch limitations. Native real-photo acceptance is pending.
  This does not establish a server authorization failure, missing real photos or invented image data.

Neither change applies a database migration, changes a public-profile permission, or supersedes the
unavailable fresh closure-certificate/retention evidence and remaining release gates above.
