# PKG-047 — the safety target of a public profile (F05 / B08 / N06 / N07 / PG01)

Status 2026-09-23: **proven on a disposable database, not applied.** Run `35805442368`, source `f0d7fb7b`,
all **10 checks PASS**, receipt `PROOF_35805442368.json`. The surface diff is exactly one added object —
`rpc_read_safety_target(p_profile_id uuid)`, body `4f4e88c2…`, security definer, `search_path=pg_catalog`,
ACL `{postgres, authenticated}` — and the certificate is byte-identical before and after. Application still
needs the owner's word.

## The defect

`rpc_submit_safety_report` and `rpc_set_account_block` are keyed by the target **account**, and that is right:
a person can show two faces (a `REQUESTER` and a `WORKER` profile on one account), and a block must follow the
person, not the face. But only two places hand the client an account id:

| place | what it gives | result |
| --- | --- | --- |
| `rpc_get_agreement_workspace` | `requesterAccountId`, `workerAccountId` | report/block work inside a Dogovor — the one entry that exists today (`src/app/dogovor/[id].tsx:341`) |
| `rpc_list_my_account_blocks` | the accounts you already blocked | unblocking works from `/profil/blokirani` |
| `rpc_get_public_profile` | `profileId` only | **no target** — an opportunity's poster cannot be reported |
| `rpc_list_need_candidates` | `workerProfileId` only | **no target** — a candidate cannot be reported |

So the screens where you actually meet a stranger carry no entry at all. `/bezbednost` itself already refuses a
missing or self target and says "Otvori bezbednost iz profila korisnika, Zadatka ili Dogovora" — an instruction
no screen could follow.

The server's own context rule was already generous enough: `private.safety_report_context_allowed` admits the
requester reporting someone who applied to their task, and a worker reporting the poster of a task that is
`PUBLISHED`/`SELECTION` even without applying. Nothing there needed changing.

## The owner's decision (2026-09-22)

Asked whether the app may learn the account behind a profile for this purpose, the owner chose **A — it may**,
for the reason that a Dogovor already makes exactly that disclosure. The alternative (profile-keyed writers, so
the id never leaves the server) was declined as three functions instead of one for the same outcome.

## The server change

One reader, `public.rpc_read_safety_target(p_profile_id uuid)`, authenticated only, security definer,
`search_path=pg_catalog`, `STABLE`:

- it repeats the visibility of `rpc_get_public_profile` exactly — active `REQUESTER`/`WORKER` profile, neither
  side closing or closed, same visibility world, no block in either direction — and returns **null**, never an
  error, when the profile is not a target. The caller's own account is null as well: a person is not their own
  safety target, which is the one deliberate difference from the public profile.
- it returns the caller's own outgoing choice (`blocked`, `revision`) so the block command has its
  `expectedRevision` without a second call. An incoming block is never disclosed, exactly as in
  `rpc_get_account_block`. Because a block in either direction already hides the profile, a returned target is
  never an active block; the revision still matters, so someone unblocked earlier can be blocked again.
- it writes nothing.

Because a block hides the profile, "unblock" stays where it already is: `/profil/blokirani`.

## The client change

| file | change |
| --- | --- |
| `src/data/safetyClientService.ts` | `readTarget(profileId)` with a strict receipt: the answer must name the same profile and an account that is not the caller's. A null answer is `available: false`, not a failure. |
| `src/ui/safety/useSafetyEntry.ts` | the screen-owned read: one call at a time, plain copy when there is no target, then `/bezbednost` with the resolved account and the task it was met in. |
| `src/ui/system/PublicProfileSheet.tsx` | the single entry: "Prijavi ili blokiraj", with the sentence that the report is private. |
| `src/ui/v2/PublicNeedPresentation.tsx`, `src/ui/v2/ApplicationSelectionPresentation.tsx` | pass the entry through to the sheet. |
| `src/app/(app)/prilike/[id].tsx` | the poster of the opportunity, with `needId` as context. |
| `src/app/(app)/potrebe/[id]/kandidati.tsx` | the candidate, with `needId` as context. |

No existing service, guard or recovery path changed, and the shipped `/bezbednost` screen is untouched.

## Files

| file | role |
| --- | --- |
| `supabase/candidates/pkg047a_safety_target.sql` | the candidate: predecessor pins (public profile `9ecc0b69…`, block reader `b91745f3…`, block writer `43b3b050…`, report writer `9249705c…`, the three visibility guards, the two relations), the function, the exact ACL, and the certificate asserted unchanged before and after |
| `supabase/proofs/pkg047/pkg047_proof.mjs` | the disposable proof, 10 checks |
| `.github/workflows/pkg047-safety-target-proof.yml` | the harness, plus types and three focused client suites |

## What the proof establishes

1. the exact predecessor chain (PKG-042a, PKG-045a, PKG-046a) with a ready, self-consistent certificate;
2. before: the app's call does not exist (PGRST202);
3. three tampers — a drifted predecessor, a changed body, a missing grant — each abort and leave the surface and
   the certificate untouched;
4. applied once, a second run refuses, exactly one object is added and **the certificate does not move**;
5. the target is the account behind the profile and agrees with `rpc_get_account_block`;
6. it resolves exactly what the public profile shows, and never the caller's own account. Every account is born
   with two faces — the auth trigger makes a REQUESTER profile, active at once, and a WORKER profile that stays
   a draft until its owner completes it — so the proof checks both: the published face resolves to the person,
   the unpublished one resolves to nobody and is not publicly visible either;
7. blocking through the resolved target hides both the profile and the target; the other side learns nothing;
   unblocking returns the target with the revision the next block needs;
8. the report the entry exists for is accepted with that target and stays private to its author;
9. anonymous and service callers are refused;
10. repeated reads write nothing and the certificate is exactly where it was.

## What it does not establish

No phone. No new APK is built here. The proof creates two real accounts and drives them through Auth and
PostgREST, but that is still not a person on a device, and it does not test the moderation that follows a
report —
`rpc_get_my_safety_report` remains an unused read with different semantics from a moderation outcome.

## Application

Only after the proof passes and the owner approves: apply the exact file bytes as
`dev_alpha_pkg047a_safety_target`, read back the body md5 `4f4e88c2f8bb5840bffe5bd1d97efde5`, the ACL
(`authenticated` only), `prosecdef`/`provolatile`/`proconfig`, and the unchanged certificate, then record the
receipt in `supabase/operations/dev-alpha/ledger/`.
