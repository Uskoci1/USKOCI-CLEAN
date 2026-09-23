# PKG-048 — the Zadatak and the Prijava a Dogovor grew out of (F12 / D02 / PG04)

Status 2026-09-23: **proven on a disposable database, not applied.** Run `35805788358`, source `48bc8155`, all **7 checks PASS**, receipt `PROOF_35805788358.json`. The surface
diff is exactly one rewritten function, `06a6485e…` → `afa60817…`, with its grants and the certificate
unchanged. Application still needs the owner's word.

## The defect

A Dogovor is the end of one lived flow: a Zadatak was published, someone sent a Prijava, it was selected.
`rpc_get_agreement_workspace` already joins `public.needs on n.id = a.need_id` and returns the task's title,
area, city, slots and start — so both people read the task's words on the Dogovor screen, but neither can
open the task itself, and the worker cannot open the offer they wrote. The screen has no ids to navigate
with, which is why the two ends of the flow stay unlinked and why D02 reads "Dogovor ne zna iz kog zadatka
i prijave je nastao".

## The change

Two keys, inserted before `createdAt` in the same document: `needId` (`a.need_id`) and `applicationId`
(`a.selected_response_id`). The body is otherwise verbatim — the transaction rewrites the live definition by
replacing one anchor that must occur exactly once, so no reviewed condition, join or authority is retyped.

**No new disclosure.** The function already refuses anyone but the two parties
(`v_uid in (a.requester_account_id, a.worker_account_id)`), and each side already owns its end: the requester
owns the task and selected that offer, the worker wrote that offer and applied to that task.

## What the proof establishes

Run `35805788358`, 7 of 7:

1. the exact predecessor chain (PKG-042a, PKG-045a, PKG-046a), the pinned workspace body `06a6485e…` and a
   ready certificate;
2. a real Dogovor made the real way — a published Zadatak, an offer through `rpc_submit_response`, a
   selection through `rpc_select_response` — and before the change its document carries the task's words but
   neither id;
3. three tampers — a drifted predecessor, an anchor that no longer occurs, a body that does not match the
   pin — each abort and leave the surface, the certificate and the live body untouched;
4. applied once, a second run refuses, exactly one function is rewritten, its grants are unchanged and the
   certificate does not move;
5. both sides now read `needId` and `applicationId`, and **everything else in the document is byte-identical
   to what it was**;
6. the two ids name the real rows each side already owns;
7. a stranger and an anonymous caller are still refused the whole document.

## What it does not establish

No phone, no new APK, and no client screen yet: the app decodes the two ids tolerantly, so the links appear
only once this is applied. It does not add arrival, movement or an ETA — the server still knows none of
those, and D02's other half (a progress view that shows only real states) is separate work.

## Application

Only after the proof passes and the owner approves: apply the exact file bytes as
`dev_alpha_pkg048a_agreement_source_links`, read back the body md5 `afa60817d35f0efd1317e4b9915aa872`, the
unchanged grants and the unchanged certificate, then record the receipt in
`supabase/operations/dev-alpha/ledger/`.
