# Round34 — P0 publication → exact public result → Discovery focus source proof

Date: 2026-09-28. Current branch source is code-equivalent to the tested client commit `b06480512d197168c0ef857bb151a0e143b3a667`; the later `a4ef830f` commit changes only control/evidence documentation.

## Question

After the explicit publication action, does the client require a real persisted Need, carry only that exact identity to Discovery, then surface the real public result as a selected pin/current existing card (or the truthful no-coordinate list group) without rewriting the person's filters?

## Existing implementation reviewed

### Review / publication route

`src/app/(app)/pregled-zadatka.tsx`

- the same immutable displayed review is accepted through the existing publication service;
- duplicate taps share the retained command identity;
- a command is not presented as published until the owner read returns the **same needId**, **same needRevision** and a published/open Need state;
- unknown outcomes stay recoverable rather than repeating the mutation;
- only that confirmed readback can create `publicationHandoff`;
- the handoff carries only account/revision + needId/revision navigation context, not private task facts/location;
- the route then replaces to `/zadaci` with the exact handoff token/id/revision.

### Discovery route

`src/app/(app)/zadaci.tsx` + `src/data/publicationHandoff.ts`

- URL identifiers alone cannot manufacture a trusted publication landing;
- the handoff must match the current account incarnation and exact Need/revision;
- Discovery performs a bounded exact public read of that Need independently of the ordinary collection;
- the exact row is merged without duplication and cannot be erased by an older/failed collection refresh;
- a newer explicit user search/navigation retires the automatic landing instead of silently rewriting their criteria;
- background/account/focus retirement is guarded.

### Existing Discovery presentation

`src/ui/v2/DiscoveryPresentation.tsx`

- a public point focuses the exact Need as `selectedId` and opens the existing approved Peek/card;
- when two Needs share a coordinate, the exact published Need still owns the card selection;
- remote/no-public-coordinate publication is promoted to the truthful FULL list group rather than receiving a synthetic pin;
- TaskCard/DiscoveryPeek are unchanged.

## Exact regression evidence

The exact full regression in GitHub Actions run [36400916665](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36400916665) included and passed all three boundaries:

- `src/data/__tests__/v5-review-screen.test.tsx` — **PASS**; includes matching owner Need/revision/state readback and creation/opening of the publication handoff.
- `src/data/__tests__/published-task-discovery-route.test.tsx` — **PASS**; includes exact public read, missing/error/retry, stale revision rejection, delayed read retirement, account/focus/background handling and preservation of user criteria.
- `src/data/__tests__/discovery-presentation.test.tsx` — **PASS**, focused suite **140/140**; includes exact published pin/card selection and remote/list behavior.
- Full Jest for the exact code candidate: **342 suites / 7,214 tests PASS**.

No production source change was added in Round34 because the requested P0 client chain is already implemented and covered. Changing it merely to create a new diff would increase risk without correcting a reproduced defect.

## Backend / deployment

No new backend package is required for this source proof. The previously recorded P0 exact Need public-read package is already applied on DEV and must not be re-applied. P6 bounded collection/search remains a separate open package.

## Native status

This remains **native pending**. The source tests do not prove that an installed build visibly lands on the pin/card after a real provider/server round trip, nor do they close Round33's FULL-return device reproduction. Exact-binary acceptance must combine:

1. publish from the review screen;
2. confirmed persisted Need ID/revision;
3. automatic landing in Discovery;
4. on-site: visible selected brand pin + existing approved Peek/card for that ID;
5. remote/no coordinate: visible correct group/card with no synthetic pin;
6. open detail and Back with stable viewport/list selection;
7. no freeze/ANR;
8. exact build/hash/device screenshot or video receipt.

Until that exists, A07/B04 remain SOURCE/CI proven and DEVICE pending, not READY.
