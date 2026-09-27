# Round 14 — approved Chat B3 application and bounded client integration

Date: 2026-09-27. Starting source: `dac4649e` in `work/uskoci-r6-integration`. The owner explicitly approved applying B3a/B3b after prerequisites, wiring the app and deploying exactly two prepared push body substitutions. **DEV applied; client wired; 11 distinct focused suites / 515 tests pass.** Both integration and final exact-source TypeScript checks PASS; commands and scope are recorded in `ROUND_14_CHECKS.json`. Source commit [`1005db3a`](https://github.com/Uskoci1/USKOCI-CLEAN/commit/1005db3acf43a55e319cc497040b8684ba6d2164) is pushed to `work/uskoci-ui-unification-20260924`.

## Problem, cause and product decision

The prior chat reader fetched an unbounded ascending transcript and its broad read writer could acknowledge incoming messages that the person had never displayed. A saved historical position also needed an authorized way to reopen its message without downloading the entire conversation. The B3 SQL proof had passed, but neither the live RPCs nor their client path existed.

Chat now reads pages of at most 50 messages and retains a contiguous snapshot of at most 200. Older/newer controls continue from exact server tuples; foreground return rereads the saved anchor through the bounded window. A newer reading gesture during pending paging keeps its anchor, and a removed anchor can recover to latest messages in one tap. A transient offline failure retains the current interval; an authority denial clears private rows.

Only measured incoming bubbles may reach the displayed-ID ACK. Visibility requires overlap of at least half the smaller of bubble height and viewport height, with native scroll observation for an overflowing transcript. A short transcript may use its complete measured geometry without a scroll. Geometry is invalidated when message sequence, body, photos, day labels or text scale changes. Loaded rows, page completion, day labels and programmatic scroll requests do not themselves mark a message read.

Confirmed outbox cache entries are no longer appended when their canonical rows are outside the bounded window. A newly confirmed send remains visible until its first exact canonical read; pending and unknown intents retain their existing recovery. TaskCard/DiscoveryPeek artwork and layout, dependencies and payment behavior are unchanged.

## DEV application

The [structured receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3_application.receipt.json) records immediate preflight, both applications and postflight for DEV project `leqcwgzvjsxugfgzdmth`.

| Package | DEV migration | Exact candidate SHA256 |
| --- | --- | --- |
| B3a history page and displayed-ID ACK | `20260927140148` / `dev_alpha_chat_b3a_private_history_read` | `7298317c474e0a1c670c82f8855811b783528427c5a9d9bab796534e67bd0bbc` |
| B3b exact-message window | `20260927140231` / `dev_alpha_chat_b3b_message_window` | `d57619fbf972120763861d2bf61fd02122e2b4d5b84fc3be3165404569243f0d` |

Ledger count moved 203→204→205. Preflight at 14:01:30 UTC confirmed expected RPC absence, the four predecessor body pins, both participant NOT NULL constraints and valid/ready message indexes. Postflight at 14:02:58 UTC confirms all three function body pins, `SECURITY DEFINER`, `search_path=pg_catalog`, owner `postgres`, authenticated EXECUTE and no anon/service-role EXECUTE. Existing helpers and frozen candidate/proof bytes were not rewritten.

Both closure certificate rows retain SHA256 `cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7` and row MD5 `2d506928a7f7216c9278bd37b18de76b`. The readiness-function definition retains MD5 `092bab686aa5e8c32ce528cbb9767447`. A direct private closure-helper query was refused with SQLSTATE `42501` by the read-only database role. The exact applied candidates then successfully ran their mandatory closure digest, certificate/binding and readiness pre/post guards inside their own migration transactions. No ACL expansion or certificate rebind was used.

The advisor comparison adds exactly the three expected authenticated SECURITY DEFINER notices for the new RPCs. After excluding observation timestamps, every other finding is unchanged. Existing warnings remain existing warnings; application does not resolve them.

## Push deployment

`uskoci-push-transport` moved v20→21. Only these formatter bodies changed:

| Event | Previous body | Deployed body |
| --- | --- | --- |
| `RESPONSE_VIEWED` | Naručilac je pregledao tvoju prijavu. | Tvoja prijava je pregledana. |
| `RESPONSE_NOT_SELECTED` | Za ovaj zadatak je izabran drugi uskočer. | Za ovaj zadatak je izabrana druga osoba. |

The entrypoint is byte-identical before/after. Formatter readback is exactly the previous source with those two replacements; titles, other copy and transport logic are unchanged. Existing `verify_jwt=false` and import-map settings are preserved. No provider test send was performed.

The receipt preserves hashes calculated from the saved deployed UTF-8 content before removing duplicated source. The deployed files use LF; local working copies match after CRLF→LF normalization, not byte-for-byte in their current working-tree encoding.

| Deployed file | Raw/LF SHA256 | Git blob SHA-1 of deployed bytes |
| --- | --- | --- |
| `functions/uskoci-push-transport/index.ts` | `1ae9e02fcb8ff6df2e97dcd7e1cc190862082f022e84c0ea067cc734a447da87` | `d27b8af89cf06f9bd20c01827a1026bfdfa0e6e4` |
| `functions/_shared/pushNotificationCopy.mjs` | `a14fa35d3428f25b55ec68ad0e10dd881de238dfde164f834651c06e121e7c57` | `841cd25f594eff738dfcc0ea112dc09a530e3f2a` |

These blob hashes identify content, not a claim that a particular Git commit was deployed. The receipt also retains both Edge bundle identities and the full compact migration/catalog observations.

## Implementation and files

- `src/data/agreementMessageHistoryService.ts`: strict owned page/window/displayed-ID ACK requests, raw microsecond timestamps, chronological/UUID tuple order, exact account/Agreement/target/receipt identities and the existing bounded photo metadata allowlist. Captured requests fence session changes, cancellation and missing receipts; there is no broad ACK fallback.
- `src/data/agreementHistoryModel.ts` and `src/hooks/useAgreementHistory.ts`: bounded contiguous retention, bidirectional continuation, ID deduplication, owned focus/foreground restore and coalesced incoming refresh. A disconnected newest probe exposes continuation without joining across an unseen gap. Authoritative removed boundaries prune retained rows; an older concurrent statement cannot overwrite newer window evidence.
- `src/app/dogovor/[id].tsx`: real B3 history integration and exact displayed-ID dispatch bound to account revision, Agreement, focus, tab visit, workspace readiness and current row snapshot. Existing send/photo reconciliation retains canonical sender/key/body/asset checks.
- `src/ui/AgreementChat.tsx`: measured visibility, layout invalidation, retained reading intent, older/newer/latest actions and outbox presentation that distinguishes historical cache from a newly confirmed send awaiting canonical read.
- Focused service, model, route, chat, outbox, incoming refresh, photo recovery and push runtime tests cover these boundaries. Frozen SQL/proof artifacts are unchanged; the application receipt records their exact live identities.

## Tests and regression evidence

**11 distinct focused suites / 515 tests PASS.** Integration and final exact-source TypeScript checks PASS (root session51194 exit0). `ROUND_14_CHECKS.json` records exact commands, chronology and source/check receipts.

| Focused group | Suites | Tests |
| --- | ---: | ---: |
| B3 history service | 1 | 82 |
| History model and two Agreement routes | 3 | 146 |
| Chat UI, thread and terminal photos | 3 | 62 |
| Outbox, incoming refresh hook and photo hook | 3 | 64 |
| Push runtime | 1 | 161 |

Regression coverage includes exact microseconds/ties, photo projection identity, 200-row eviction and continuation, current-visit ACK admission, stale callbacks/account ABA, timeouts, offline retention versus authority refusal, outbox cache resurfacing, one-tap removed-anchor recovery and user movement during pending pages. Independent review identified the outbox/anchor and boundary-removal cases before the final focused runs. Earlier runs and fixture corrections remain check history; repeat executions are not added to the unique-suite total.

## Native boundary, status and next work

No full Jest run, APK build/install, native scroll or viewability check, physical device/emulator acceptance, provider delivery, voice feature, real upload, query plan, large-history latency or growth acceptance is established by this application. No DEV fixture data was inserted. Mandatory voice and the canonical event-to-message resolver remain unfinished. Native/device/provider and current-app acceptance must use their own evidence, without promoting historical disposable or prior-APK success into this source's result.

This is implemented and focused-tested client source against applied DEV contracts, pushed as `1005db3a`. Next acceptance: actual native paging, position retention and measured ACKs on the resulting approved build. Ongoing source work remains the canonical event-to-message push resolver and continuous message arrival lifecycle. Query-cost evidence, mandatory voice and a canonical event-to-message resolver need their own work. Bounded rereads and newest probes do not establish gap-free realtime delivery: a late commit can appear behind an earlier cursor, and `asOf` is not a cross-request snapshot.

The three approved packages above no longer await the same application permission. Other server changes, dependencies, task-column privacy rollout conditions, closure/export and payments retain their independent scope and gates. Control/dashboard records are maintained separately; local generation remains distinct from remote publication.
