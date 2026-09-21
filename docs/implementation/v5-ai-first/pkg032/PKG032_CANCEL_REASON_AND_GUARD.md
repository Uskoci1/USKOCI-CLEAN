# PKG-032: the cancellation reason is kept, and one guard is null-safe

**Owner decision, 2026-09-21.** The owner answered "odobravam sve" to item 8 of the written list: one round for 7.15
and 12.8, proven on a disposable database first, then applied.

## 7.15: the reason is kept (`pkg032a`)

**Before.** The app requires "Razlog otkazivanja" and `rpc_cancel_agreement` refuses an empty one, then throws it
away:
- no column holds it;
- the event payload is `{agreementId, state}`;
- the other party reads a fixed "Druga strana je otkazala Dogovor."

**After.** The reason is kept the way a reported problem already is (`rpc_report_problem`): as the canceller's own
message in the Agreement's conversation, "Otkazujem Dogovor. Razlog: …".
- It is written before the Agreement is cancelled, under the same conditions `rpc_report_problem` uses: no safety
  block between the two, and neither account in closure.
- It is cut to the 2,000 characters a message holds.
- The other party is told "Druga strana je otkazala Dogovor. Razlog je u Porukama."

**Why a message and not a new column:**
- Both parties and support already read the conversation.
- The account-closure erasure already covers `public.agreement_messages`.
- A new column would have moved the certified closure source and needed its own erasure rule.

## 12.8: the remaining-search guard is null-safe (`pkg032b`)

`private.guard_remaining_search_close_fields` raised only when
`current_setting('uskoci.need_lifecycle', true) <> 'CLOSE_REMAINING_SEARCH'`. With the setting unset, that comparison
is NULL, so an owner could stamp the three `remaining_search_*` columns of their own draft directly. It now uses
`is distinct from`, like every other guard in the schema.

The guard is a trigger function of `public.needs`, and the certified closure source digest includes the md5 of every
trigger function. So this fix moves the digest, and `pkg032b` binds the certificate to the new value in its three
places, as PKG-023f did:
- `private.closure_source_v5`;
- `private.closure_erasure_source_v5`;
- the constant inside `private.retention_ai_source_ready()`.

**What makes the re-binding honest**, all asserted inside the candidate:
- **Before:** live equals certified in all three places, the source is ready, and no closure is executing.
- **Isolation:**
  - the new digest differs from the old one;
  - restoring the old guard body inside the same transaction gives the old certified value back;
  - re-applying the fix gives the new value again.

  So the guard is the only thing the new value reflects.
- **After:**
  - the three places hold the new live value;
  - the readiness function changed only by its constant (masked md5 unchanged);
  - the source is ready;
  - the erasure binding carries the new value;
  - the guard is exactly the old body with the one comparison changed.

The erasure program itself (the redaction relations and patch) is not touched.

## Proof

- Workflow: `.github/workflows/pkg032-cancel-reason-guard-proof.yml`.
- Script: `supabase/proofs/pkg032/pkg032_proof.mjs`.
- The chain replays source 147 and every dev_alpha row through PKG-031, from the texts canonical DEV recorded. The
  certificate after the replay equals canonical DEV's in all three places.

**Before**
- The reason is thrown away, and the worker reads a fixed sentence.
- An owner stamps their own draft's server-owned columns directly.

**Apply**
- Tampered pins are refused and leave nothing behind, the certificate included.
- `pkg032a` does not move the certificate.
- `pkg032b` moves it once and binds it everywhere.
- Second applications are refused.
- The surface changes by exactly the cancel function, the guard and the readiness constant.

**After**
- The reason is the canceller's message, and the worker is told where.
- A 4,000-character reason is cut to 2,000, and the cancel still happens.
- A blocked pair gets no message, and its cancel behaves as before.
- The direct stamp is refused, and the server-owned path still writes.

**Closure**, on the re-bound certificate:
- A real account (Auth sign-up) works a task, then cancels it through the API with a reason.
- It closes end to end with the exact closure worker, called with the server key on `apikey` (PKG-030).
- Afterwards, not one message anywhere contains the reason.
