# Final product phase — round 01, 2026-09-27

Status: **PIN SOURCE PREPARED / UNVERIFIED**. The owner approved only the pin treatment, explicitly rejected the generated card composition and instructed continuation of the broader mandate. All trial card/navigation edits were discarded back to the baseline. The only application change retained is `PricePill.tsx`. No backend, RPC or Edge implementation changes. Two read-only agents assisted the source inventory. No tests, build, installation, device interaction or paid application-AI call ran.

## Scope and evidence

- Local source: `5ce60c48f95395a502b80f7b38e8f22cf92a0644`; clean when read. GitHub `work/uskoci-ui-unification-20260924` returned the identical SHA from `git ls-remote`.
- Canonical DEV `leqcwgzvjsxugfgzdmth`: connector returned `ACTIVE_HEALTHY`, Frankfurt, PostgreSQL17.6.1.165. This is service metadata, not whole-product health.
- Live migration catalog:203 entries,55 with names beginning `dev_alpha_`. No statement that the remainder is the frozen source count.
- Live bodies read: `rpc_publish_accepted_ai_task_review` and `rpc_list_open_tasks_v3`. Definition MD5 respectively `461712281346eb5e7a9849102eef8335` and `8a47d061da5f9bd65b5e3cc6c947d5d7`. No writes or private records/keys read. No fresh closure-certificate or full-Edge attestation in this round.
- Historical two-account end-to-end: R18 `REAL_JOURNEY.md`, one remote/flexible/one-person/offers scenario through both ratings. Preserve it; it does not certify all variants or the newer P0 handoff.
- Historical R21 source `dcb19e97`: CI36279059657,323suites/6527tests; emulator APK36279078038 cold sheet, two deep returns and AI keyboard. No new test execution or phone proof here.

## Problem and cause

P0 already has substantive R21 code, not just a success toast: review checks its canonical publication receipt/owned revision, the explicit “Prikaži objavljen zadatak” action replaces review with Discovery, Discovery re-reads public rows and selects the actual task or prioritizes a point-free task. Account/focus fences and error/missing fallback exist.

Source findings at the SHA above, not device reproductions:

| ID | Cause / source | Proposed decision |
| --- | --- | --- |
| FIN-P0-01 | `src/app/(app)/zadaci.tsx:124`: selected public row is tappable before the separate relation read resolves; unknown is treated as non-owner and opens public detail. | An account-bound, confirmed publication context takes the owner directly to owned detail. Arbitrary URL parameters are never ownership proof. Ordinary tasks retain existing relation checks. |
| FIN-P0-02 | `DiscoveryMap.tsx:211`: publication focus is passed again on a map-session remount. `DiscoveryPresentation.tsx:350` invalidates missing IDs, not an ID that loses its public point. | Consume camera landing once. Subsequent Back preserves camera/sheet/list. Retire selection when its public point disappears; do not resurrect it on a later refresh. If the point changes, clear the map selection rather than move the user's camera unexpectedly. |
| FIN-P0-03 | `zadaci.tsx:23,45`: URL publication parameters survive independently of the publishing account. Public list rows lack revision; the revision parameter only keys the request. | Keep one account/session-bound confirmed handoff; retire it on account change. Preserve canonical receipt proof separately from latest public-row presence. Never label an arbitrary deep link “you just published”. |

The public reader `src/data/supabaseIzvor.ts:179` walks up to25×200 rows without sending `p_bbox` or `p_filters`. This is a real growth boundary, not a claim of measured production latency. Live v3 accepts category/priceMode/urgentOnly/remote/start-window filters and keyset cursor, but gives only `hasMore`, not a total. Bounding boxes are limited to3°latitude/5°longitude; bounding-box reads do not implement a combined remote+area stream. Local text/time/people filters are not equivalent to all server filters. Do not simply pass every client filter or infer totals from a page. Treat the coherent area + point-free projection/count/paging contract as P1/P6 work, separately proposed if backend changes are needed.

## P0 flow decision — proposed, not applied; original card retained

User job: “See the task I just published and know what I can do next.”

1. After a publication started here returns a canonical success and matching owned read, automatically replace review with the account-bound Discovery handoff. No extra success-screen button for the normal path. A restored old publication shows its existing explicit open action; do not unexpectedly navigate on recovery.
2. While the fresh public read is pending, distinguish known publication success from unresolved visibility. Do not publish again or create a fake card.
3. Public point present: one camera focus and the selected brand pin with the existing task card, unchanged. Tap the task → owned detail. Preserve existing browsing controls and tab orientation; do not add the rejected success header, replacement card or extra sheet action.
4. No public point: open the real list card first, no pin. Keep point-free/remote work reachable alongside area work, respecting explicit remote/on-site choices.
5. Missing/read failure: retain confirmed publication, offer read retry and owned detail; no invented map success. Closed/changed tasks use current server state.
6. On account switch, blur, manual pan/filter or a newer publication, retire stale intents. Once initial camera intent is consumed, Back preserves the user's view.

The supplied generated screenshot `PIN_COLOR_REFERENCE_CARD_REJECTED.png` is a concept edited from an existing native screenshot, not a device proof. Its task/date/map geography are illustrative. Implementation must retain the original vector BrandMark, real approximate geography and real facts; do not reproduce image-generator inaccuracies as new product truth. The owner rejected its card composition: do not build that sheet/card or navigation from this picture. Only the final pin treatment is accepted: pure-white capsule, original green/orange BrandMark, dark-orange selected label, soft orange halo,6% selected size increase. The original normal40dp/30dp-logo geometry and every existing task card remain. Date/time on one line when space permits. Capacity is `0/2` visually with full accessible meaning.

Alternatives considered: keep the separate success page (clear but extra action); temporary toast only (easy to miss, weak next step); selected task landing (chosen: demonstrates the result and keeps useful navigation). These flow changes are not in this pin-only source package. Before implementing a changed flow, present its precise steps under the owner approval rule; do not reuse the rejected card design.

## Design-system use

Use existing `src/ui/system/tokens.ts`, typography, `FactArt`, `BrandMark`, `TaskCard`, `PricePill`, shared sheets and motion. Do not introduce a second theme/icon family, oversized type, mint canvas, new dependencies or a fabricated 3D brand. Validate pixel details only when owner authorizes the consolidated verification round. Proposed motion: one short map ease + sheet reveal, never repeatedly recentering; reduced motion preserves the same state without animation.

## Execution map

Priority tags overlap existing62 control rows; they do not create a second tracker. `docs/control/FINALIZATION_MATRIX.md` is generated from each row's `finalization` fields. Unknown cells stay unknown; structural catalog/test-file presence is not behavioral proof.

| Order | Work |
| --- | --- |
| P0 | Confirmed publication → actual map/list task, account ownership, one-shot landing, owner detail. |
| P1 | Unified map/search/filter/list, pin hierarchy, count semantics, all empty/error/offline states. |
| P2 | Home/task/application/Agreement composition and navigation, then competing/group/changed/cancelled flows. |
| P3 | Private and group chat arrivals, exact read boundary, private paging, photos and voice lifecycle. Group older paging already exists; do not rebuild it blindly. |
| P4 | One real message → event → push → exact conversation/message → visible-message acknowledgement. Existing push proof used different events. |
| P5 | AI structured facts and taxonomy, worker interview/manual profile, hard matching eligibility + ranking. |
| P6 | Bounded query/page/count/aggregate contracts; no whole-dataset downloads or per-history-item waterfalls. |
| P7 | Every profile/settings/support/privacy/export/deletion/auth surface, operator/legal decisions and Android/iOS release. |

Deep surfaces explicitly retained: task photos/questions/public profile; application comparison/confirmation; Agreement terms/change/cancel/private contact/address/group/history/completion/rating; group participants/older paging/recovery; work area/capacity/availability; notification preferences/device registration; blocks/report/support case/operator; avatar/legal/consents/export/account deletion/recovery. Group-entry context-read error currently disappears silently (`GroupConversationEntry.tsx`); queue a deliberate retry state. Generic document attachments are not implemented; voice is not shipped. Do not infer them from photo support.

## Implementation / backend / acceptance / commit

- Implementation this round: source/live-contract inventory, updated work order, existing62-row tracker plus generated matrix, and `PricePill.tsx`. The white selected capsule has two restrained orange halo edges inside snapshot padding;6% enlargement is measured, not an overflowing transform or looping animation. Original brand/labels/urgency stay. All card/sheet/navigation prototypes from this round were discarded after the owner correction.
- Files: `src/ui/v2/discovery/PricePill.tsx`, this report/reference image, parent PLAN, AGENTS, `docs/control/redovi.json`, generator/readme and generated matrix/state.
- Backend/RPC: read-only evidence above; no deployment/certificate/key/provider changes.
- Tests: NOT RUN by latest owner instruction. Historical results remain historical.
- Device proof: NOT RUN. The proposal is not a screenshot of implemented behavior.
- Regression: not executed; preserve publication guards, account/focus/recovery and public-location precision in the proposed patch.
- Git commit: use the commit containing this file; it is a source-only pin change atop5ce60c48. Use the explicit `[skip ci]` marker because the owner has withheld test/build execution; do not treat skipped CI as acceptance. No force push. Existing `discovery-map-pills.test.tsx` assertions expect the retired green selected fill and will require the matching expectation change in the authorized test round.
- Status: pin implementation prepared, unverified; original card/navigation preserved. P0 findings remain OPEN. Other priorities are inventoried, not certified complete.
- Next: close FIN-P0-01–03 with the original card preserved and the precise flow proposal approved. Keep it unverified until owner requests targeted checks and consolidated full regression/APK/device proof; do not relabel unverified code READY.

## Control page publication

The refreshed state and generated HTML are committed locally. A fresh signed-in visit to the existing Claude artifact still showed the embedded 2026-09-24 state (`b9aed185`). The supported file-chooser upload timed out before selecting `stanje.json`; remote import is not confirmed. Do not report the artifact as refreshed. The local/generated matrix is current for this source-only round.
