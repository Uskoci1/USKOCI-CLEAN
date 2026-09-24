# PKG-051 — platform price list (cenovnik) for Povezivanje and HITNO, every price 0 RSD, server only

**Status: written, proof pending, NOT applied.** Candidate `supabase/candidates/pkg051a_platform_price_list.sql`
(trimmed sha256 `affc2932ba32e950618b2aeca9c1d7016aec157af58f86ff971cacea4bd5f28a`, 39 679 characters, LF). Proof
`supabase/proofs/pkg051/pkg051_proof.mjs`, run by `.github/workflows/pkg051-platform-price-list-proof.yml`; no run yet.
Function-only plus four data rows: the certified closure digest (`cc248ff1…` on DEV) must **not** move, and the
candidate asserts that before and after. Nothing is applied to DEV; the owner applies it later with
"primeni pkg051a". Owner request 2026-09-24. No control row exists for payments yet; HITNO is A16.

| Function | Body md5 |
| --- | --- |
| `private.platform_payments_enabled()` | `f4998801754e272d2be0a42d9e52ca77` |
| `private.platform_price_canonical(text,integer,bigint,text,text,text,timestamptz,timestamptz,text)` | `dde80e0dcaffeb0dca25107e06a47e1f` |
| `private.platform_price_versions()` | `737e74c58cec244b7e15f90a95669163` |
| `private.platform_price_list_at(timestamptz)` | `16ce63c18f886210f120a9691403559f` |
| `private.platform_price_add_version(text,integer,bigint,text,text,timestamptz,text)` | `cd92f120495bf6b4cd550f558876d1b0` |

Seed version sha256: CONNECTION v1 `3df2b860def7e5a08b388caeaff1a19fb6e8fd678c9989b15b32d9624226b1f6`,
URGENT_BOOST v1 `4ed7b18ecad29f5005f17cc8e5f8ea6bc5e04f0924c67614ba6f3976de477abb`.

## What the owner asked

On 2026-09-24 the owner asked to set up the payment settings. Prices are added later as new ones, and everything
starts at 0 din. Earlier the same day he decided that the payment UX waits until the core flows are verified on a
phone, and that the payment architecture stays prepared ("7 DA"). So this package is server only. It adds a
versioned platform price list where every price is 0 RSD. A later price is added as a new version and never by
editing an old one.

## Why this storage

A price list needs a home the certificate tolerates. Three homes were considered:

| | **B, chosen: versioned rows in `private.marketplace_config`** | A: a new table `private.platform_price_versions` | Constants in function bodies |
| --- | --- | --- | --- |
| Closure certificate | **Does not move.** The schema digest hashes catalog objects of `public`/`private`, and the program digest hashes the 72 reviewed functions, trigger functions on redaction relations, and table ACL/RLS flags and trigger state. It never hashes data rows. New functions that are neither triggers nor in the roster are outside it (the PKG-047/050 precedent). | **Moves.** Re-binding it rewrites the body of `private.retention_ai_source_ready()` and updates `closure_source_v5` and `closure_erasure_source_v5`. Those are existing function bodies and tables, so this is **outside this package's boundary**, not a fallback. | Does not move. |
| Old versions | Tamper-evident: every version carries its own sha256 and its predecessor's. A head row names the latest version of each product. Every read and write re-verifies everything and fails closed on a broken chain. No trigger can guard the rows, because a trigger on a `private` table moves the certificate. | Triggers block edits (though the owner can still disable them). | Not editable, but also not addable: the owner could not add a version from the SQL editor. |
| Existing objects touched | Four **new data rows under new keys**. The table's DDL, ACL (`default`), RLS flags and its three existing rows (`dispatch_normal`, `dispatch_urgent`, `urgent_activation_policy`) stay byte-identical, and every existing reader filters by key. Every later price write adds a row and updates the head row. | Existing function body and two tables, as above. | None. |

**Boundary note, needs the owner's confirmation.** The package boundary says "no change to … any other existing …
table". B writes new rows into an existing table, and nothing else. The approved architecture already puts the
kill switch there (`PAYMENT_READY_ARCHITECTURE_20260923.md` §2.1, principle 7). If new rows under new keys are also
meant to be forbidden, no home is left inside the boundary. A new table would then need the owner's separate
approval of a certificate move, plus a function-body re-bind that this package may not make.

Also rejected: a table in a new schema or in `rls_private`. Either one slips past the certificate's completeness
purpose, and `rls_private` grants USAGE to `authenticated`.

## What changes

**Server, `pkg051a_platform_price_list.sql`.** Nothing existing reads any of it.

- **Four data rows** in `private.marketplace_config`:

  | key | value |
  | --- | --- |
  | `platform_price:CONNECTION:000001` | the CONNECTION v1 version value (below) |
  | `platform_price:URGENT_BOOST:000001` | the URGENT_BOOST v1 version value |
  | `platform_price_head` | `{"schema":"PLATFORM_PRICE_HEAD_V1","heads":{"CONNECTION":{"version":1,"sha256":…},"URGENT_BOOST":{"version":1,"sha256":…}}}` |
  | `platform_payments` | `{"schema":"PLATFORM_PAYMENTS_SWITCH_V1","enabled":false}` |

- **Five private functions**. Each has `set search_path = pg_catalog`, is SECURITY INVOKER, and runs
  `revoke all … from public, anon, authenticated, service_role`, so its ACL is exactly `{postgres=X/postgres}`.
  Only the database owner can execute them, which in practice means the SQL editor. PostgREST cannot see them,
  because `private` is not exposed and no role has USAGE on it.

  | Function | Kind | What it does |
  | --- | --- | --- |
  | `platform_payments_enabled()` | sql, stable | The kill switch. True only when the `platform_payments` row is exactly `{"schema":"PLATFORM_PAYMENTS_SWITCH_V1","enabled":true}` **and** `private.platform_charges` exists. No package has created that charge ledger, so one row edit alone cannot turn payments on. A missing row, `"true"` as a string, a missing schema, an extra key, a scalar or an array all mean off. |
  | `platform_price_canonical(…)` | sql, stable | The one canonical form of a version value and its sha256. It does no validation; callers validate first. |
  | `platform_price_versions()` | plpgsql, stable | **Integrity only.** It returns every stored version per product after verifying keys, content, self-hashes, the chain, the times and the head. Otherwise it raises `PRICE_LIST_INTEGRITY_FAILED`. |
  | `platform_price_list_at(p_at)` | plpgsql, stable | The list at one moment: `latestVersion`, `current` and `next` per product. It applies the kill switch. |
  | `platform_price_add_version(p_product, p_expected_latest_version, p_amount_minor, p_payer_role, p_unit_basis, p_effective_at default null, p_currency default 'RSD')` | plpgsql, volatile | **The only writer.** It appends version N+1 of one product and moves the head. It never edits a version. |

**App:** nothing. No screen, route, client call or build changes. The payment UX waits for the owner's phone
verification of the core flows.

## Contract

### A version (`PLATFORM_PRICE_V1`)

A stored version is exactly `private.platform_price_canonical(...)`, compared as jsonb text:

`{"schema":"PLATFORM_PRICE_V1","product","version","amountMinor","currency","payerRole","unitBasis","effectiveAt","recordedAt","previousSha256","sha256"}`

- `amountMinor`: RSD minor units, para (ISO 4217 exponent 2), so 99 RSD = 9900. The allowed range is 0 to
  10 000 000, a typo guard of 100 000 RSD. The free ledger's `platform_cost_rsd` is in whole dinars; the seed
  check multiplies it by 100.
- `currency`: `RSD` only.
- `payerRole`: `REQUESTER` or `WORKER`. A split waits for P2.
- `unitBasis`: `HEADCOUNT` (per person) or `FLAT` (once). `PRICE_BAND` waits for P3.
- `effectiveAt` and `recordedAt`: UTC text `YYYY-MM-DDTHH24:MI:SS.USZ` (microseconds, always `Z`), whatever the
  session time zone. `recordedAt` is the writer's `clock_timestamp()`, read **after** it holds the head lock.
- `previousSha256`: `null` for v1, otherwise the predecessor's `sha256`.
- `sha256`: the hex sha256 of the UTF-8 string
  `PLATFORM_PRICE_V1|product|version|amountMinor|currency|payerRole|unitBasis|effectiveAt|recordedAt|previousSha256`,
  with `previousSha256` empty for v1. It uses a fixed delimiter string instead of the jsonb text, so anyone can
  recompute it outside the database. The proof does exactly that.
- Keys: `platform_price:<PRODUCT>:<version, zero-padded to 6 digits>`. The version limit is 999 999 per product.

### Which version applies

- **Current at t:** the version with the **highest number** whose `effectiveAt ≤ t`.
- **Next at t:** whatever is current at `T`, the earliest `effectiveAt` among versions numbered above the current
  one. It is `null` if there is none.
- A new version may not start before it is recorded: the writer refuses `effectiveAt < recordedAt`, and the
  validator refuses it too. So `current(t)` for any t before a version was recorded never changes. The only
  exception is the moments between the writer's insert and its commit.
- To cancel a scheduled price, add a version with the old price and the same or an earlier time. Because the
  highest number wins, the scheduled version then never becomes current. The proof shows this.
- Before the seed moment (`2026-09-23T22:00:00Z`, 00:00 Belgrade on 2026-09-24) `current` is `null`. The free
  ledger governs anyway: the list is advisory, and every existing Agreement predates the seed.
- Anyone who later quotes a price must store `(product, version, sha256)` and never recompute a past price.

### Kill switch (fail closed)

- Payments count as on only when `platform_payments_enabled()` is true, as described above. This package leaves
  them off and never writes the enabled value.
- While payments are off, the writer refuses any `p_amount_minor > 0` with `PLATFORM_PAYMENTS_DISABLED`, and the
  list refuses to serve a price above 0 as `current` or `next`.
- **A version with amount 0 can always be appended.** Suppose payments were once on, a positive price exists, and
  payments are switched off in an emergency. The owner adds a 0 version and the list becomes readable again. The
  switch never locks the list for good. Integrity (`platform_price_versions`) is separate from this policy, so the
  writer checks only integrity before appending.
- Enabling payments is **not** part of this package. The package that creates `private.platform_charges` also
  defines the enabled state. Any other switch shape, such as the architecture's `environment` field, is a switch
  V2 and means replacing `platform_payments_enabled()`.

### Error codes

| Code | SQLSTATE | Raised by |
| --- | --- | --- |
| `PRICE_AS_OF_REQUIRED`, `PRICE_AS_OF_INVALID` (not finite) | 22023 | list |
| `PRICE_PRODUCT_UNKNOWN`, `PRICE_EXPECTED_VERSION_REQUIRED`, `PRICE_AMOUNT_INVALID`, `PRICE_CURRENCY_UNSUPPORTED`, `PRICE_PAYER_ROLE_INVALID`, `PRICE_UNIT_BASIS_INVALID`, `PRICE_EFFECTIVE_IN_PAST`, `PRICE_EFFECTIVE_TOO_FAR` (over 366 days ahead) | 22023 | writer |
| `PRICE_VERSION_STALE`, DETAIL `latest=N` | 40001 | writer |
| `PRICE_VERSION_LIMIT` | 54000 | writer |
| `PLATFORM_PAYMENTS_DISABLED`, DETAIL = product | 55000 | writer (a price above 0 requested); list (a price above 0 would be served) |
| `PRICE_LIST_INTEGRITY_FAILED`, DETAIL `KEY`, `CONTENT:<P>:<v>`, `GAP:<P>:<v>`, `CHAIN:<P>:<v>`, `TIME:<P>:<v>`, `PRODUCT_MISSING:<P>`, `HEAD:MISSING`, `HEAD:<P>` or `HEAD:SHAPE` | 55000 | versions, list, writer |
| `PKG051_*` (see the candidate) | 55000 | candidate only |

Every integrity failure is `PRICE_LIST_INTEGRITY_FAILED`. This includes a failing cast, such as a date like
`2026-02-30`: the per-row checks run inside one exception block.

### What the integrity check catches, and what it cannot

It catches the accidental hand edit: a changed field without a new hash, a re-hashed old version (its
successor's `previousSha256` no longer matches), a deleted latest version or head, a wrong head, a gap, an
unknown key, a malformed value, and a version that starts before it was recorded. After any of these, every read
and every write fails closed until the rows are repaired.

It is **tamper-evident, not tamper-proof**. The database owner can do two things that stay consistent, so they
cannot be detected:

- delete the newest versions and point the head back at an older version's stored `(version, sha256)`;
- rewrite the newest version through `platform_price_canonical` and update the head's hash.

The proof performs both and records that they pass. A table with triggers would not be absolute either, since
the owner can disable them. The only external anchor is outside the database: the writer returns the stored
version, including its `sha256`. Recording that answer in a repository receipt after each owner write makes a
later rewrite visible.

### Invariants

1. The free Povezivanje path is byte-identical: no DDL on any existing object; `rpc_select_response`
   (`7cbb8390…`), `reject_connection_ledger_mutation` (`577e554a…`) and
   `require_connection_activation_for_new_agreement` (`7eda7b4a…`) are pinned; the free policy row, its five
   lock CHECKs and three triggers are pinned by definition md5. No existing function reads the new keys, so a
   broken price list can never block a selection.
2. The certificate does not move, neither at apply nor on any later price write.
3. Append-only by the only writer. Detection limits are stated above.
4. The seed repeats today's canon. CONNECTION v1 = the free policy row: payer `REQUESTER` (canon C12,
   `beneficiary_role`), `HEADCOUNT`, 0. URGENT_BOOST v1 = 0, and HITNO's `chargesFee` is `false`. The URGENT_BOOST
   payer (`REQUESTER`) and basis (`FLAT`) are **placeholders**, not answers to P2, P3 or P12: HITNO has no unit
   basis today.
5. No account data: no account id, name or free text, so no dataset-catalog, redaction, export or retention entry
   is needed. That is also why no author is recorded for a version, only its time.
6. Access: only the database owner reads and writes. `anon`, `authenticated` and `service_role` can do neither,
   over REST or in SQL.

**Cost.** The validator re-hashes every version on every read and write. At one version a week that is trivial
for decades; the hard limit is 999 999 versions per product.

## Which source is authoritative

Today, and until a payment package says otherwise:

- **Povezivanje** is governed by `private.connection_policy_versions` (`REQUESTER_SELECTION_V1/1`,
  `PROMOTIONAL_FREE`, 0 RSD). Its CHECKs and the deferred Agreement trigger enforce it, and
  `rpc_select_response` reads it under a hard-coded key.
- **HITNO** is governed by `urgent_activation_policy` (off, empty category list, `chargesFee:false`).
  `rpc_activate_urgent` has no charge hook.

**The price list is advisory.** Nothing reads it, nothing charges from it, and no screen shows it. The payment
package should take its prices from these versions, copying the chain into its immutable tables if it wants
database-level immutability, instead of adding a second price field. The architecture document carries a dated
amendment saying so: `docs/implementation/research/PAYMENT_READY_ARCHITECTURE_20260923.md` §2.1. Without that,
the owner's versions would be dead data.

## Proof

`supabase/proofs/pkg051/pkg051_proof.mjs` runs on a disposable database with the real local Auth/PostgREST
stack, after the house replay (source147, every dev_alpha row up to PKG-040, then PKG-042a to PKG-050a inline with
their trimmed-sha pins; PKG-045b stays unapplied as on DEV). The price list is read and written as the database
owner through `psql`, the way the owner will use the SQL editor. Every refusal is matched by SQLSTATE and exact
message, and every write check compares all config rows before and after. Kinds: BASELINE holds on the
predecessor by design; NEW needs the candidate; NO_REGRESSION must hold before and after; TAMPER is a refusal
that rolls back.

1. `EXACT_PREDECESSOR_REPLAY_READY_CERTIFICATE_NO_PRICE_LIST` (baseline): six pinned predecessors; the
   certificate is ready and consistent in all three places, and the binding equals it; the five functions and four
   keys are absent; the free-path pins and the free policy row hold; the HITNO bodies, all config rows, the surface,
   one HITNO preview and one dispatch-reader probe are recorded.
2. `BASELINE_NOTHING_TO_READ_OR_WRITE_BEFORE` (baseline): the exact `42883` refusals are recorded.
3. `TAMPERS_ROLL_BACK_ATOMICALLY`: each tamper uses a unique anchor and aborts with its own `PKG051_*` code
   (SQLSTATE 55000). After each one, the surface, the certificate, every config row and the absence of the
   functions are unchanged. The tampers:
   - predecessor pin;
   - one body line;
   - `search_path`;
   - an extra grant;
   - a seed payer that disagrees with the free row (`FREE_POLICY_MISMATCH`);
   - an enabled switch seed **plus** a stand-in charge ledger created inside the same transaction
     (`KILL_SWITCH_NOT_CLOSED`: the only way to reach that defence-in-depth check, since without a ledger the
     switch stays off);
   - the same switch seed without a ledger (`SEED_MISMATCH`);
   - the HITNO fee expectation;
   - the clock;
   - a touched `dispatch_normal` row (`CONFIG_CHANGED`);
   - a changed existing function (`EXISTING_OBJECT_CHANGED`);
   - a changed certificate row (`CERTIFICATE_CHANGED`);
   - a foreign `platform_price:` row (`CONFIG_KEY_CONFLICT`).
4. `APPLIED_ONCE_FIVE_FUNCTIONS_FOUR_ROWS_CERTIFICATE_UNMOVED`: a second run gives `PKG051_ALREADY_APPLIED`.
   Exactly five function lines are added and none are removed. The certificate is deep-equal. Body md5s equal the
   pins, and the ACL is `{postgres=X/postgres}`. The four rows are exact, and the three old rows keep their value
   and `updated_at`.
5. `DISPATCH_AND_HITNO_READERS_UNCHANGED` (no regression): the same rolled-back dispatch-wave probe gives the same
   outcome before and after (`NORMAL`, first wave of `dispatch_normal`). A real requester's HITNO preview is
   identical before and after: not allowed, `URGENT_POLICY_DISABLED`, `URGENT_CATEGORIES_NOT_ADMITTED`,
   `chargesFee:false`.
6. `OWNER_READ_RETURNS_ZERO_RSD_FOR_BOTH_PRODUCTS`:
   - the list at the seed moment is deep-equal to the literal;
   - now: both products at v1, 0 RSD, `next` null, payments off;
   - before the seed: `current` null and `next` v1;
   - the hashes recompute in JavaScript;
   - a version given as `'2027-03-01 00:00 Europe/Belgrade'` lands at `2027-02-28T23:00:00.000000Z` (rolled back).
7. `SEED_MATCHES_FREE_POLICY_AND_HITNO_CONFIG`.
8. `FREE_SELECTION_PATH_UNCHANGED` (no regression): a real offer and a real selection create the Agreement and a
   `REQUESTER_SELECTION_V1/1`, 0 RSD, `SATISFIED` activation. The policy stays one row, an UPDATE still raises
   `CONNECTION_LEDGER_IMMUTABLE`, and the pins hold.
9. `POSITIVE_PRICE_REFUSED_WHILE_PAYMENTS_OFF_NOTHING_WRITTEN`: 1 para, 9900 now, 9900 in 30 days, and HITNO 19900.
10. `SWITCH_FAILS_CLOSED_AND_A_ZERO_VERSION_ALWAYS_APPENDS` (rolled back):
    - the switch stays off for a missing row, a string `"true"`, no schema, a scalar, an array, an extra
      `environment` key, and the exact enabled object without a charge ledger;
    - with a stand-in ledger, a positive current price is written and served;
    - switched off again, that price is hidden from reads and new positive writes are refused, and a 0 version
      restores the list;
    - a positive **scheduled** price is hidden the same way, and a 0 version cancels it for good.
11. `NEW_VERSIONS_APPEND_OLD_UNCHANGED_CURRENT_BY_EFFECTIVE_TIME`: v2 (WORKER/FLAT, +2 d) and v3
    (REQUESTER/HEADCOUNT, +1 d). The current price is v1 now and v3 from +1 d on. v2 never becomes current. v1's
    stored text is unchanged, and the head names v3.
12. `WRITER_AND_READER_REFUSE_BAD_INPUT_AND_WRITE_NOTHING`: every 22023 code, including `now()` as the start
    (already past), `±infinity`, and +400 days.
13. `SAME_CALL_TWICE_IS_STALE`: the second identical call gives `PRICE_VERSION_STALE`, `latest=2`.
14. `CONCURRENT_WRITERS_ONE_WINS`: `rt.lockedRace` observes a real `pg_blocking_pids` edge on the head row.
    Exactly one version is appended, and the loser is stale with `latest=4`.
15. `HAND_EDITS_FAIL_CLOSED_AND_THE_KNOWN_LIMIT_IS_RECORDED`:
    - the reader, the list and the writer all refuse with the same DETAIL for 14 hand edits (every reason above);
    - a consistent forged positive price is not served, and a 0 version still appends over it;
    - the two undetectable owner edits are performed and recorded as passing.
16. `API_AND_ROLES_CANNOT_REACH_THE_PRICE_LIST`:
    - over PostgREST, anon, a signed-in stranger and the service key each get `PGRST202` for all five functions;
    - in SQL, `anon`, `authenticated` and `service_role` each get `42501`;
    - the ACLs are exact, and the config table is still `rls=true:force=false:acl=default`.
17. `PRICE_WRITES_NEVER_MOVE_CERTIFICATE_OR_SURFACE` (no regression): after every committed write, the certificate
    and the surface are exactly where the application left them.

The proof cannot run locally: it needs Linux, Docker, the Supabase CLI and `psql`. After a green run, record
`PROOF_<runId>.json` next to this file (run, source sha256s, candidate trimmed sha, body md5s, seed shas, checks,
surface, closure before and after, known limits, notDone) and update the Status line.

## Kako dodaješ novu cenu

Šta radi „primeni pkg051a“: na serveru pravi cenovnik za Povezivanje (`CONNECTION`) i HITNO (`URGENT_BOOST`).
Obe cene su 0 RSD. Plaćanja ostaju isključena, aplikacija se ne menja, a sertifikat za brisanje naloga se ne
pomera. Cena iz cenovnika se još nigde ne naplaćuje i ne prikazuje. Dok poseban paket ne uključi plaćanja, možeš
da upišeš samo 0. Za svaki iznos veći od nule dobićeš `PLATFORM_PAYMENTS_DISABLED`, i tako treba da bude.

1. **Pogledaj cenovnik.** U Supabase-u otvori SQL Editor i pokreni `select private.platform_price_list_at(now());`.
   Za proizvod koji menjaš zapamti broj `latestVersion`. Pod `current` je cena koja sada važi, a pod `next`
   sledeća zakazana.
2. **Dodaj novu verziju.** Na primer:
   `select private.platform_price_add_version('CONNECTION', 1, 0, 'REQUESTER', 'HEADCOUNT', '2026-11-01 00:00 Europe/Belgrade');`
   Redom upisuješ:
   - proizvod;
   - `latestVersion` iz prvog koraka;
   - iznos u parama (99 dinara = 9900);
   - ko plaća: `REQUESTER` je onaj ko traži pomoć, `WORKER` je onaj ko uskače;
   - kako se računa: `HEADCOUNT` je po osobi, `FLAT` je jednom;
   - od kada važi.

   Vreme uvek piši sa `Europe/Belgrade`. Ako ga izostaviš, cena važi odmah. Ne upisuj `now()`: to je trenutak kad
   je upit počeo, pa ga server odbija kao prošlost. Server ti vraća upisanu verziju i njen `sha256`; sačuvaj taj
   odgovor.
3. **Proveri.** Ponovi prvi korak. Nova verzija je pod `next` dok ne dođe njeno vreme, a onda prelazi u
   `current`.
   - Uvek važi verzija sa najvećim brojem čije je vreme počelo. Zakazanu cenu zato otkazuješ tako što dodaš novu
     verziju sa starom cenom i ranijim vremenom, ili bez vremena.
   - Ako pogrešiš, dodaj još jednu verziju.
   - Ako dobiješ `PRICE_VERSION_STALE`, neko je, ili ti dvaput, već dodao verziju. Vrati se na prvi korak.
   - Redove `platform_price…` i `platform_payments` nikad ne menjaj i ne briši rukom. Cenovnik tada odbija svako
     čitanje i upis dok se ne popravi. Ta zaštita hvata slučajne izmene, a ne namerne.

## Open decisions

The owner decisions **P1 to P12** in `docs/implementation/research/PAYMENT_READY_ARCHITECTURE_20260923.md` §4 stay
open. This package decides none of them: which models and when, who pays, the price, the route, provider and
accounts, refunds, fiscal and legal matters, retention, the IAP package, hold timeouts, charge-backs, and the
HITNO price. It records only 0 and today's canon.

Package-level questions for the owner:

1. **Storage.** B (rows in `marketplace_config`) is the only home inside the boundary that leaves the certificate
   where it is. Are new rows under new keys in that existing table acceptable? See the boundary note above.
2. **Units.** Amounts are in para (×100). The free ledger counts whole dinars.
3. **Seed moment.** 2026-09-24 00:00 Belgrade, or the moment of application?
4. **Who reads the list.** Only the owner, in SQL, for now. An app-facing read waits for the payment UX and would
   follow the architecture's `rpc_read_connection_quote` (with `p_expected_user_id`).
5. **Typo cap.** 100 000 RSD per version.
6. **Allowed values for now.** Payers `REQUESTER` or `WORKER`; bases `HEADCOUNT` or `FLAT`.
7. **No author record.** Only times are kept, because an account id would make the list personal data. Is that
   acceptable, with a repository receipt per owner write as the record?
8. **Notice before a price change.** The `next` field and `recordedAt` are ready; the notice period is part of P7.

## Not in this package

- **Payments stay off.** Not included: enabling them, any charge path, a hold, a provider, an Edge function, a
  key, a `verify_jwt` change, a dependency or an app screen.
- **The free ledger is unchanged.** Nothing in `connection_policy_versions`, `connection_activations`,
  `rpc_select_response`, the Agreement trigger or the HITNO functions changes, and `chargesFee` is still only
  echoed.
- **Only one truth is enforced.** The live free path reads only `connection_policy_versions`, and the price list
  is a parallel record that nothing enforces yet.
- **Left for the enabling package:** what the reader does with positive prices after payments are switched off
  again, beyond "hide them until a 0 version is added".
- **Not done yet:** no CI run, no DEV application, no receipt, no control-table row. No phone test is needed,
  because no client changed.

## Application

Only after a green proof and the owner's **"primeni pkg051a"**. No certificate approval is needed, because the
certificate does not move.

1. Apply the exact file bytes as `dev_alpha_pkg051a_platform_price_list`.
2. Read back:
   - the five body md5s and `{postgres=X/postgres}`;
   - `prosecdef = false`, `proconfig = {search_path=pg_catalog}` and the volatilities;
   - the four rows (the two seed shas and the head);
   - `platform_price_list_at('2026-09-23T22:00:00Z')`;
   - the unchanged `cc248ff1…` in all three places;
   - the three pre-existing config rows (value and `updated_at`).
3. Write `supabase/operations/dev-alpha/ledger/2026MMDD_pkg051a_application.receipt.json` in the pkg050a
   (function-only) shape, plus `config{keysBefore, keysAfter, existingRowsMd5}` and `seed{sha256}`.
4. Refresh `docs/control/dev_snapshot.json`, add a control row, run `node scripts/control/osvezi.mjs`, and
   republish the table.
5. Add an AGENTS.md paragraph.

## Files

- `supabase/candidates/pkg051a_platform_price_list.sql`: the candidate, LF, pinned in `.gitattributes`.
- `supabase/proofs/pkg051/pkg051_proof.mjs`: the disposable proof.
- `.github/workflows/pkg051-platform-price-list-proof.yml`: the proof workflow, which runs on push to the listed
  branches when these files change, and on `workflow_dispatch`.
- `docs/implementation/research/PAYMENT_READY_ARCHITECTURE_20260923.md` §2.1: the dated amendment on the price
  source and the switch shape.
