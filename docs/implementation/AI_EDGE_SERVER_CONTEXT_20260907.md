# AI Edge server context — 2026-09-07

Status: **SOURCE IMPLEMENTED / CI MOCKED TRANSPORT PROVEN / CANONICAL INTEGRATION PENDING / NOT DEPLOYED / ACTUAL PROVIDER NOT PROVEN**.

The current interview Edge source sent the oldest40 conversation messages and then used their last30. A conversation longer than40 rows therefore omitted its newest context. It also supplied no current date/time reference for relative dates, and its catch logged arbitrary fetch/JSON exception messages that could include sensitive output.

The existing `uskoci-ai-interview` handler now queries `sequence_no.desc&limit=40`, reverses that window, and keeps the existing chronological newest30 provider window. The system instruction receives one server-generated UTC timestamp plus Europe/Belgrade local date/time and current UTC offset. Client date/time-zone fields cannot override this reference. The instruction requires clarification for another relevant zone, ambiguity or missing material details, and human confirmation of the proposed date/time. This reference does not confirm a Need fact, infer a missing duration or authorize publication. Target-date offsets still require correct provider interpretation and human review; these tests do not claim real model calendar reasoning.

The provider catch logs the fixed `AI_PROVIDER_FAILED` category. Existing HTTP adapters log only a fixed category plus numeric response status. Provider response bodies, transcripts, headers and thrown exception text are not logged by this path. Gemini-first routing, configured model lookup, header-only Gemini API key, OpenAI fallback and `store:false`, typed fact validation, existing service writer RPCs and owner conversation lookup remain unchanged. No new provider, key, backend, function slug, database migration or activation is introduced.

## Exact source and evidence boundary

Implementation base: canonical `9d245f3053c8e79370a73e82b12d4250e3ed94b7`. The [frozen file manifest](../../supabase/proofs/ai/ai_edge_context_files.json) records exact LF bytes and SHA-256 for the handler, unchanged shared fact registry, actual-handler tests, runner and workflow. The source proof checks these bytes before execution.

Local Node execution passed **17 actual-handler tests** and TypeScript. The tests transpile and evaluate the actual Edge entry and actual shared registry in a restricted VM. All environment values and every fetch are synthetic. They capture the real handler's database query, outbound provider request, validated proposal payload and existing writer request. The writer response is mocked; no actual database storage or provider call is claimed.

Covered cases: UTC/local midnight, year rollover and both Europe/Belgrade DST transitions; ignored client date override; newest30 chronological messages from a50-row history for both adapters; short history; legacy writer routing; typed people proposal parsing; header-only Gemini key and OpenAI `store:false`; network, HTTP, JSON and invalid-output failures with fixed logs and no writer request. These are meaningful transport and prompt checks, not a substitute for a real provider response or physical mobile flow.

The [source workflow](../../.github/workflows/ai-edge-context-proof.yml) installs locked dependencies, runs TypeScript, Deno module checking, the exact-handler tests and existing Jest regressions. Its artifact contains the source manifest verification and raw TAP output. It accepts no provider/database secrets and has no deployment step. The original current-source artifact and CI results were inspected as recorded below; the next canonical integration requires its own final-head gates.

## Inspected source proof

PR58 source head `ace37f2bb9c872fbc6f5395775e09e30851a0190`, run34123999844: Deno module check, TypeScript,17 actual-handler mocked-transport tests and37 suites/232 Jest tests **PASS**. Original artifact10019347995 ZIP SHA-256 `ce0b620be519f46e7710518f613a65bae2757c6b6d19286665642d031eaf35d2` matched GitHub metadata. The [original source report](evidence/ai-edge-context-20260907/proof-report.json), [raw TAP](evidence/ai-edge-context-20260907/handler-tests.tap), [artifact verification](evidence/ai-edge-context-20260907/verified-summary.json) and [evidence manifest](evidence/ai-edge-context-20260907/evidence-manifest.json) retain that exact boundary. Actual CodeQL analyses at this head: JavaScript1735948268=0 results/103 rules, Actions1735946868=0/23, Python1735946854=0/50; errors empty. No PRE-P4/canonical/production closure is inferred from these results; final canonical integration still follows.

First headfa4ccaea source run34123615442 passed its tests but CodeQL reported an incomplete URL-substring comparison in the synthetic routing test. The comparison now parses and checks the exact provider hostname. No alert suppression was used; production Edge bytes stayed unchanged at26,346 bytes / SHA-256 `4861e371c2da01122f013516826008e15a9c9a752f52188523510ff9b7da9704`. The first run and alert were retained separately in workspace evidence.

## Live boundary and next action

The separate read-only live observation on2026-09-07 found canonical project `leqcwgzvjsxugfgzdmth`, active `uskoci-ai-interview` v6 with JWT verification enabled, and secret names `GEMINI_API_KEY`/`GEMINI_MODEL`. Secret names establish metadata presence only, not usable values, model identity or successful provider access. The source comparison found a single terminal LF difference between deployed v6 and the observed canonical predecessor; it did not establish raw byte identity. No secret values were fetched or copied. This source branch makes no new live observation or deployment claim.

After exact source review, CI/CodeQL, merge and fresh v6 source/config review, promote only the reviewed handler and unchanged registry through the existing Edge path. Verify deployed source and JWT configuration afterward. The AI DRAFT BLOCK authority repair and client review/card integration are independent units with their own proof and promotion boundaries. Actual functional closure still requires a genuine user-controlled owner session, the user's intended draft, provider-generated proposals, human confirmation/correction and the resulting truthful DRAFT card. Production is not a synthetic fixture sandbox. No supplied private user text or address is included in this source proof.

## Fresh canonical integration

Final integration base is `f055d6415b5153aa6ef0db735d63dddea7806ead`, including accepted PR49, PR55, PR56 and D03 live86 provenance. All five frozen implementation/proof manifest hashes are unchanged; original evidence remains tied toace37f2. Source86/live86/pending0 is preserved with no SQL changes. Final integrated runtime proof and CI/CodeQL remain pending until actual execution; no deployment or new live observation is claimed.
