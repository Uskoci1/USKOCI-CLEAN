# P0 — publication landing, 2026-09-27

Status: **SOURCE IMPLEMENTED / VERIFICATION PENDING**. Owner approved the six-step P0 flow with “Odobravam”. Existing task cards, selected-card composition, colours and screen layout remain unchanged. The separately approved white/orange pin is already in parent commit `f77fa452`.

| Field | This round |
| --- | --- |
| Problem | Confirmed publication required another open action; its selected task could open the public detail while the relation read lagged. Retained publication parameters could outlive the publishing account. A native map remount could repeat publication camera focus. |
| Cause | Publication route parameters carried intent without account-owned provenance; selected-camera focus was initialized anew inside each native map session. |
| Product decision | A publication completed on this review visit leads directly to its real public map/list context. Reopening an older published review retains its explicit open action. |
| UX/UI decision | Keep the owner's existing card. One camera move to the real approximate public point; point-free work appears first in the existing list. A tap opens owned detail; Back retains map/list state. |
| Implementation | An in-memory, latest-only publication handoff binds canonical readback to account ID and account revision. URL parameters cannot create it. Keep the fresh public read; one proven owner relationship supplements the optional relation overlay. The presentation owns camera consumption/retirement across native map remounts. |
| Files | `src/data/publicationHandoff.ts`; `src/app/(app)/pregled-zadatka.tsx`; `src/app/(app)/zadaci.tsx`; `src/ui/v2/DiscoveryMap.tsx`; `src/ui/v2/DiscoveryMap.types.ts`; `src/ui/v2/DiscoveryPresentation.tsx`. |
| Backend/RPC | No SQL, migrations, Edge deployment, certificate, key, dependency, provider or real-data changes. Existing publication/readback/public-list contracts remain. No fresh DEV audit in this round; bounded live evidence is in ROUND_01. |
| Tests | NOT RUN. Owner's separate test/typecheck/build/install gate remains. Historical green runs do not cover this source. Existing publication navigation fixtures must adopt the trusted handoff and automatic fresh-publication transition in the authorized verification round; prior selected-pin assertions still need alignment. |
| Device proof | NOT RUN. No screenshot or generated concept is claimed as native acceptance of this package. |
| Regression | Root source review plus independent read-only review of publication routes/helper and map callbacks. Review caught and corrected a retired native-map callback that could cancel a newer session's pending focus; retirement now checks native-session ownership. Runtime and native behavior remain unverified. No changes to TaskCard or DiscoveryPeek. |
| Git commit | The commit containing this file, based on `f77fa452`; source-only `[skip ci]` because test/build execution is deferred. |
| Status | P0 source package prepared, not READY or whole-product complete. |
| Next | Authorized consolidated verification of P0; meanwhile prepare the P1 map/search/filter/list proposal from the unchanged current composition. Any changed appearance/flow needs owner approval. |

## Preserved boundaries

- `PUBLISHED` and an owned read of the same task/revision precede the handoff. The handoff contains identifiers only, no task facts, private location or credentials.
- Account revision rejects logout and A→B→A; token refresh does not invalidate the same account. A newer publication supersedes the older in-memory handoff. An old/external URL remains ordinary Discovery, never proof of “you just published”.
- Public row presence proves the current public projection for the same task ID; it does not prove that the public list carries the owner-read revision, because that API does not return a revision.
- Read failure or a missing public row retains existing retry and owned-detail recovery. Neither manufactures a pin nor repeats publication.
- Camera acknowledgement means the native camera method was dispatched, not that the animation was visually accepted. A manual gesture/filter or loss of focus retires pending camera intent; Back uses the stored viewport.
- A selected row losing/changing its public point clears the stale selection. A fresh explicit publication can select its newly confirmed public point. Remote/point-free tasks never gain invented coordinates.
- Existing server filtering/5,000-row growth limits are still P1/P6 work. This source package does not claim scalability, all task variants or same-message push acceptance.

## Control table

The existing 62-row tracker and generated matrix are updated, without promoting test/device lights. A new Claude artifact import attempt in this round timed out at the supported file chooser; the remote page still displayed 2026-09-24 `b9aed185`. Remote publication is pending and is not implied by generating or committing `stanje.json`.
