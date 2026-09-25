# After the R17 device checkpoint

Preparation against source `8500bf29`, not implemented work or a fresh DEV attestation.
Keep `docs/control/redovi.json` as the single execution tracker. R17 composition and device evidence do not close
the following functional findings. The current batch's verified source remains frozen through device review.

1. **Discovery ownership recovery (DN-01).** `src/app/(app)/zadaci.tsx` refreshes the task read but a failed relation
   read with identical task IDs is not reliably retried. The owner permits own tasks to remain visible with a
   distinct label: preserve this preference, rather than hiding them. Add guarded joint refresh and honest
   confirmed-own/confirmed-other/unknown presentation. Preserve viewport/filter draft, account and generation
   retirement, and existing application guards. Prove same-ID retry, late results and account changes.
2. **Human chat refresh continuity.** `src/app/dogovor/[id].tsx` and `useFocusedResource` currently use a refresh mode
   that can clear the transcript. First add coalesced, non-destructive refresh with a separate refreshing state,
   preserving outbox identity, media and uncertainty recovery. Do not turn full-history polling into the final
   delivery mechanism. The current read in `supabaseIzvor.ts` has no explicit limit/cursor.
3. **Chat paging and exact read boundary together.** A latest/older page can use the existing authorized table
   fields, but requires raw timestamp/ID cursors and preserved history anchors. The PKG-050 RPC acknowledges the
   Agreement's message events without a displayed-message boundary. A safe high-water read receipt needs an
   additive server contract and concurrent-arrival proof before paging can retain correct acknowledgement.
   Notification settlement is not a counterparty read receipt. New server application remains owner-approved only.
4. **Rating-read load (RC-03).** `agreementClientService.ts` reads P Agreement pages plus C individual review RPCs,
   C being all returned completed Agreements. A bounded account-owned request pool limits concurrency, not the
   total count. Partial reads require an explicit unavailable rating state; do not silently report zero due or
   move an unknown completed Agreement into history. The existing list projection has no bulk own-review field.
   A true aggregate needs a separate server proposal. Verify strict receipts, deadline, late results and account
   switches before replacing the current reader.

These bounded source findings were rechecked during the R17 build. Read the durable source notes in [Discovery](NEXT_DISCOVERY.md),
[human chat](NEXT_CHAT.md) and [ratings](NEXT_RATINGS.md). They are recommendations, not device
reproductions. No new backend or client behavior was introduced by that preparation.

Continue the visual plan with safety/long forms and actual authentication/recovery context after accepting the
core compositions. Preserve white surfaces, ordinary strong typography, purpose-based screens and coherent APK
batches. Provider quality, voice, push, payments, operator/legal inputs, iOS and complete two-party journeys remain
distinct release work; none is certified by inert galleries or passing UI tests.
