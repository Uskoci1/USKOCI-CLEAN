# Why a saved draft can never be published — proven cause

Found on the owner's physical phone on 2026-09-18, with the exact attested APK
`c401baaa…` (commit `f1401ff`) installed. Nothing was changed to find this; the phone was
driven through the ordinary path and the server was read.

This supersedes the earlier explanation that the publish dead-end was "the AI does not ask for
the map pin". That explanation was wrong about the immediate cause.

## What the owner sees

Zadaci → Nacrti → open a draft → `Pregledaj za objavu`.

The review screen renders **blank** — no facts, no card, no location — above
*Server nije vratio potpunu potvrdu radnje. Osvežite prikaz pre ponovnog pokušaja.*
Pressing `Učitaj pregled i proveri ishod` changes it to
*Server je vratio nečitljive podatke. Pokušajte ponovo.* and stays there.

There is no way forward from that screen, and the draft screen behind it offers no location
control: the `Mesto: Lenke Dunđerski, Novi Sad` row is not clickable.

## The wire, in order

Every server call succeeded. From `edge_logs`:

| time (UTC) | call | status |
| --- | --- | --- |
| 22:41:42.458 | `rpc_ai_open_need_edit_conversation_v2` | 200 |
| 22:41:42.787 | `rpc_read_latest_ai_task_review` | 200 |
| 22:41:42.941 | `rpc_prepare_ai_task_review` | 200 |
| 22:42:06.862 | `rpc_read_latest_ai_task_review` | 200 |

So the server is not refusing anything. The client is discarding a successful response.

## The envelope the server produced

`private.ai_task_reviews` row `5fa0b716-2439-48bb-9142-53f8993ff5b8`, created 22:41:43, not
expired. It is **complete**:

- `missingRequired: []`
- `canAccept: true`
- `safety: "REVIEW"`
- 18 public facts plus 1 owner-private fact, every one `status: CONFIRMED`
- `location.geography` carries **both** ends: `start {area: "Lenke Dunđerski", city: "Novi Sad"}`,
  `end {area: "Petrovaradinska tvrđava", city: "Petrovaradin"}`, `mode: POINT_TO_POINT`
- `location.exactAddress: "Lenke Dunđerski 11, Novi Sad"`

The AI did collect the start and the end. The facts are not the problem.

## The one difference that breaks it

Two facts are serialised as Postgres timestamp text instead of ISO 8601:

```
"need.starts_at" : "2026-09-18 08:00:00+00"
"need.ends_at"   : "2026-09-18 11:00:00+00"
```

A space instead of `T`, and `+00` instead of `+00:00`.

The earlier envelope for the same need — `b2ed2a7d…`, built from the intake conversation, whose
facts carry `source: AI_INFERENCE` — had `"2026-09-18T10:00:00+02:00"`, and that one rendered.
That is why the review screen worked once and never again.

## Where the bad value comes from

`supabase/migrations/20260904230000_clean_ru4_ai_edit_conversation.sql:92-94`, carried forward
unchanged through three later redefinitions of the same function, the last being
`20260910144644_clean_w05_publication_evaluator_authority.sql:946-948`:

```sql
when 'need.starts_at' then
  if v_need.starts_at is not null then v_value:=to_jsonb(v_need.starts_at::text); v_display:=v_need.starts_at::text; end if;
when 'need.ends_at' then
  if v_need.ends_at is not null then v_value:=to_jsonb(v_need.ends_at::text); v_display:=v_need.ends_at::text; end if;
```

`timestamptz::text` renders `2026-09-18 08:00:00+00`. Without the cast,
`to_jsonb(timestamptz)` renders ISO 8601 with `T` and a full offset. Every other field in the
same `case` uses `to_jsonb(<native value>)` correctly; only these two cast to text first.

Confirmed live, not only in the migration files. Of every plpgsql function in `public` and
`private` whose body mentions `need.starts_at`, exactly one still carries the cast:

| function | `starts_at::text` | `ends_at::text` |
| --- | --- | --- |
| `public.rpc_ai_open_need_edit_conversation_v2` | **true** | **true** |
| `public.rpc_confirm_need_edit_from_review` | false | false |
| `public.rpc_save_need_draft_from_review` | false | false |
| `public.rpc_select_response` | false | false |
| `private.need_publication_fingerprint_snapshot` | false | false |
| `private.validate_need_v2_fact_pre_fastest_retirement` | false | false |

`rpc_ai_open_need_edit_conversation_v2` is exactly the call the app makes when a **saved
draft** is opened for review, which is why only saved drafts are affected.

## Why the whole screen goes blank rather than one row

`src/data/serverReceipt.ts:17`:

```ts
export function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
```

The pattern requires the literal `T` and an offset of `Z` or `±HH:MM`. The value fails on both
counts. Then, in `src/data/aiTaskReviewClientService.ts`:

- `validValue('need.starts_at', …)` → `timestamp(...)` → `false` (line 76)
- `fact(...)` returns `null` (line 88)
- `decodeAiTaskReview`: `all.some(x => !x)` → returns `null` for the **entire envelope** (line 106)
- the caller maps that to `TASK_REVIEW_INVALID_RESPONSE`, whose copy is
  *Server je vratio nečitljive podatke.*

One malformed field discards all nineteen. The screen has nothing left to draw.

Note also that the server validated its own value on the way in:
`20260904230000_clean_ru4_ai_edit_conversation.sql:114` calls
`private.validate_need_v2_fact(v_key, v_value)` and it passed. So the two validators disagree
about what a TIMESTAMPTZ fact looks like, and the looser one writes.

## The second blocker, behind this one

`private.need_publication_context` returns the same verdict for all three of the owner's
drafts:

```
NOT_READY / LOCATION_INCOMPLETE / missingSlots: ["start","end"]
```

The envelope has both ends as **text areas**, but `location.resolvedLocation` is `null` — there
are no geocoded points, and `public.needs.approximate_lat/lng` are null for all three. The
publish gate wants resolved points, not place names.

Whether the review screen itself offers the map pin cannot be determined while it renders
blank. `public.rpc_save_need_location_review` exists and takes a confirmed location, so the
path is present in the backend. The order matters: the timestamp defect must be cleared before
anything can be learned about the location step from the UI.

## Scope of the consequence

The three drafts, all `POINT_TO_POINT`, all with `has_approx_point = false`:

| need | created | review command state | published |
| --- | --- | --- | --- |
| Prevoz i prenos stvari: 4 kutije i 2 ormara | 2026-09-17 | `ACCEPTED` | null |
| Prevoz troseda sa Limana na Detelinaru | 2026-09-16 | `ACCEPTED` | null |
| Dostava punjača iz Novog Sada u Petrovaradin | 2026-09-07 | `ACCEPTED` | null |

All three review commands sit in `ACCEPTED` with `evaluation = null` and
`lease_expires_at = null`: accepted and never evaluated, because the client never got a
readable envelope to accept from.

## Proposed minimal fix — not applied

Two changes, neither touching a contract:

1. **Server.** Drop the `::text` cast in `rpc_ai_open_need_edit_conversation_v2` so
   `need.starts_at` and `need.ends_at` are emitted as `to_jsonb(<timestamptz>)`, matching every
   other writer of the same fact. `v_display` should get the same formatting the intake path
   uses rather than raw text.
2. **Guard.** Tighten `private.validate_need_v2_fact` so a TIMESTAMPTZ fact must be ISO 8601,
   making the server refuse to write what the client cannot read. Without this, the same class
   of defect can return through any new writer.

Both need owner approval as canonical DEV writes. A test should pin the exact string shape on
both sides, so the two validators can no longer drift.

---

# Applied, and proven on the same phone

Owner approved both changes on 2026-09-18 with four preconditions: exact preflight/digest guard,
disposable proof, a contract test for the ISO 8601 shape, and confirmation that no other writer
has the same defect. All four were met before the write.

## No other writer has it

- The registry has exactly **two** TIMESTAMPTZ keys for NEED_FACT_V2: `need.starts_at`, `need.ends_at`.
- Of every plpgsql function in `public` and `private`, exactly **one** carried the cast:
  `public.rpc_ai_open_need_edit_conversation_v2`.
- Stored rows split cleanly by writer, which corroborates it: 8 rows from `AI_INFERENCE` all ISO
  8601, 2 rows from `SYSTEM_DERIVED` both rejected. The 2 bad rows were written by the single
  diagnostic tap at 22:41:42.
- No data repair was needed. `rpc_ai_open_need_edit_conversation_v2` inserts a **new**
  `ai_conversations` row unconditionally - there is no reuse of an existing OPEN conversation - so
  the next open reseeds fresh facts and the superseded rows are never read by this flow again.
  This mattered: `rpc_prepare_ai_task_review` re-validates every fact while building the envelope,
  so had the old rows still been read, tightening the validator would have turned a blank screen
  into a hard error.

## Disposable proof, read-only

| form | renders | client accepts |
| --- | --- | --- |
| current `to_jsonb(x::text)` | `2026-09-18 08:00:00+00` | no |
| the live envelope that broke | `2026-09-18 08:00:00+00` | no |
| the earlier envelope that worked | `2026-09-18T10:00:00+02:00` | yes |
| proposed `to_jsonb(x)` | `2026-09-18T08:00:00+00:00` | **yes** |

The current form reproduced the live envelope character for character, so the reproduction was
exact rather than merely similar.

## The write

`dev_alpha_pkg021_need_timestamp_fact_iso8601`, version `20260917230145`, canonical DEV
`leqcwgzvjsxugfgzdmth`. Repo copy:
`supabase/migrations/20260917230145_dev_alpha_pkg021_need_timestamp_fact_iso8601.sql`.

Preflight refused to proceed unless `rpc_ai_open_need_edit_conversation_v2` hashed to
`b18fbaf486ab6acdc3e3bf105e37cb1b`, `validate_need_v2_fact` to
`fdeb471b2a4ddcea19ec1c0a75a2457e`, the defect was actually present, and the TIMESTAMPTZ key set
was still exactly two.

The function body was not retyped from memory. It is the block from the newest defining migration
with two lines changed; `diff` against the live block is 2 lines of 129. Minimality is then
**enforced** rather than asserted: a postcondition undoes exactly those two edits and requires the
result to hash back to the original digest, so the migration could not commit if any other
character in the body differed. It committed.

The validator rule was added in the **top** layer only. The historical chain is delegated to
unchanged, which the readback confirms by digest.

## Independent readback

Ten claims, all true, from a fresh query rather than the migration's own postconditions: the cast
is gone; the RPC seeds the native value; no function anywhere still casts; the validator carries
the new rule and still delegates; `_pre_country`, `_pre_location` and `_pre_fastest_retirement`
hash exactly as before; the registry still has two TIMESTAMPTZ keys; the RPC signature is
unchanged.

A separate probe confirmed behaviour, not just text: the validator now rejects
`2026-09-18 08:00:00+00`, `...T08:00:00+00` and `...T08:00:00`, and accepts `+00:00`, `+02:00`,
`Z`, fractional seconds and what the fixed seeding produces. Non-timestamp facts validate exactly
as before. `guard_ai_fact_schema_trg`, a BEFORE INSERT OR UPDATE trigger on
`public.ai_structured_facts`, calls this same layer, so the table itself now refuses a shape the
client cannot read.

## Contract test

`src/data/__tests__/need-timestamp-fact-contract.test.ts`, 11 tests.

Before the fix: 10 passed, 1 failed - the guard, on the real defect. After: 11 passed.

It pins both sides. Ten tests drive `decodeAiTaskReview` with a complete envelope whose only
variable is the timestamp string, including the assertion that one bad fact discards the **whole**
envelope, which is the amplification that turned a two-character slip into a blank screen. The
eleventh reads the newest migration that defines the RPC and asserts the executable seeding
statement, not the file text, because a migration that fixes this necessarily quotes the bad
pattern in its own comments and guards.

Neighbouring suites: `ai-task-review-client`, `draft-review-screen`, `reviews-authority`,
`aiNeedV2Ui`, `v5-review-screen` - 200 passed. One failure, `pkg003-manual-entry-source`, is the
known Windows CRLF artifact: it searches a file containing a literal `\n` in a file with 269 CRLF
lines, which this change did not touch (`git status` shows 0 modifications to it).

## The same physical-device flow, repeated

Same phone, same draft, same route: Zadaci → Nacrti → *Prevoz i prenos stvari* → `Pregledaj za
objavu`.

**Before:** blank screen, *Server nije vratio potpunu potvrdu radnje*, then *Server je vratio
necitljive podatke*, no way forward.

**After:** the review card renders in full - *Ovako ce drugi videti zadatak*, with Kategorija,
Bitni uslovi, Opis, Cena, Dozvole, Vestine, Alat, Vozilo, Termin, Pocetak
(`18. sep 2026 · 10:00:00 (vreme u Beogradu)`), Kraj (`13:00:00`), a Privatni podaci section with
`Tacna adresa: Lenke Dundjerski 11, Novi Sad`, photographs, the application deadline, an `Izmeni`
control on every row, and a live **`Objavi zadatak`** button.

`Objavi zadatak` was **not** pressed. Publishing is the owner's decision.

Server side, same RPC and same draft, before and after in one table:

| written | source | stored value | shape |
| --- | --- | --- | --- |
| 22:41:42 | SYSTEM_DERIVED | `2026-09-18 08:00:00+00` | rejected |
| 22:41:42 | SYSTEM_DERIVED | `2026-09-18 11:00:00+00` | rejected |
| **23:05:09** | SYSTEM_DERIVED | `2026-09-18T08:00:00+00:00` | **ISO 8601** |
| **23:05:09** | SYSTEM_DERIVED | `2026-09-18T11:00:00+00:00` | **ISO 8601** |

## Where the location blocker actually sits - diagnosis only, nothing changed

Stopped here, per the instruction not to move on to the location work.

`private.need_publication_context` still returns `NOT_READY / LOCATION_INCOMPLETE /
missingSlots: ["start","end"]` for all three drafts, because `location.resolvedLocation` is null
and `needs.approximate_lat/lng` are null. The gate wants geocoded points, not place names.

The parts exist but are not wired into this flow:

- `public.rpc_get_need_location_review` and `public.rpc_save_need_location_review` are live.
- `src/data/locationClientService.ts` calls both, and `mesto-zadatka.tsx` and
  `pregled-zadatka.tsx` both import it.
- `src/ui/location/LocationPointEditor.tsx` and `src/ui/location/ResolvedPinMap.tsx` exist and are
  rendered by `profil/lokacija.tsx`, `AgreementLocationScreen.tsx`, `AgreementPrivateLocation.tsx`
  and `WorkerAreaSearch.tsx`.
- But `mesto-zadatka.tsx` contains **zero** references to a map, to `resolvedLocation` or to the
  point editor. The address editor for a task is text only.

So the remaining gap is a wiring gap on the need path, not a missing capability, and the pin editor
already exists for profiles and agreements. That is the scope of the next package, when approved.
