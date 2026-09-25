# R16 — Discovery and the task decision

Owner resumed implementation after the R15 visual diagnosis. This is the first coherent batch from
`../design-diagnosis-20260925/REPORT.md`: DD-01–DD-05 and the root navigation's visual weight from DD-10.
Home, Agreement composition and AI draft/thread composition remain the second batch. R14-N01 stays open.

## Composition and purpose

| Surface | Decision served | Implemented composition |
| --- | --- | --- |
| Discovery | Find work worth opening and relate it to a place | One search/tool surface, quiet quick filters, clearer geographic park/water/road contrast, lighter branded pins and cluster circles, resizable results sheet retained. |
| Filters | Refine the current set without losing context | Time, work mode, people and price are open groups. Place suggestions and calendar alone expand locally. No automatic jump after a choice. One truthful apply/count action. |
| Task card | Understand work and terms at a glance | Short numeric terms sit beside a short work title when space permits. Verbal prices, long titles and larger text stack. Logistics stay complete. Person and capacity share the foot when room permits. |
| Selected map task | Decide whether to open the task while retaining place context | The same brief vocabulary, a full title/terms head clear of close, compact logistics, person and capacity. No task-photo carousel in the map preview. |
| Public and own task detail | Understand the work before choosing the next action | Genuine task photos, compact logistics and truthful price, work description and requirements before publisher context, then existing place/questions. Owner application entry and every guarded action remain. |

Alternatives and the reasons for this composition are recorded in the preceding diagnosis. White reading surfaces,
bundled Inter at ordinary sizes and meaningful colored FactArt remain. Depth is reserved for overlapping surfaces;
the map and root navigation no longer each demand an equally strong shadow. Amounts, offers and missing prices keep
their different meanings and weights. Existing sheet/camera/press motion and reduced-motion behavior remain.

## Authorized portraits and performance

Opportunity and detail projections carry an optional asset ID derived from the public profile already read by the
client. The existing v5 reference parser moved unchanged into a data helper; its old UI export remains compatible.
No extra list-profile call is added. The UI uses AuthorizedPhoto with both asset and profile ID; it retains focus
cleanup, account/revision binding, authorization checks, aborts and no persistent media cache. Missing/unreadable
portraits keep initials. The render window must not become an image-download window: only settled visible rows
(at most six), on a focused fully expanded sheet, mount portraits. Gorhom's content viewport uses its highest detent
even when physically half-exposed, so half-sheet native viewability alone is not trusted. Selecting a pin hides those row portraits; only
that preview may read its image. This bounds concurrent mounted readers, not a claim of byte-request deduplication.

## Verification and boundaries

Combined checks, APK attestations and actual native observations are recorded separately after execution. A source
change or passing test is not owner visual acceptance or whole-journey/store readiness. Do not infer live provider
behavior from the inert design gallery. Keep normal-size composition and narrow/large-text resilience separate.

No backend, migration, Edge, provider/prompt, payment, dependency or real business mutation. This batch preserves
all actual data, ownership, unknown-outcome recovery, safety commands and media authorization. Control generation
does not refresh the older DEV snapshot or prove remote dashboard publication.
