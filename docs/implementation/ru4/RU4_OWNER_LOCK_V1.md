# USKOČI — RU-4 OWNER LOCK V1

**Status:** OWNER_LOCKED — 2026-09-04

## Purpose

This is the latest explicit owner decision for V1 Zadatak editing and supersedes older RU-4/COV-028 interpretations wherever they allowed a parent Zadatak to be materially edited after the first Dogovor was formed.

## 1. Edit boundary

A Zadatak may be edited only while **no Dogovor has ever been formed from that Zadatak**.

Once the first Dogovor is formed:

- the canonical Zadatak content/terms are locked for V1;
- the ordinary `Izmeni Zadatak` action is not available;
- remaining uncovered capacity may continue to receive Prijave under the same locked Zadatak terms;
- existing Dogovori remain immutable snapshots of the terms accepted when they were formed;
- cancellation/removal/replacement does not unlock the parent Zadatak for content editing.

If the requester wants materially different scope, price, schedule, geography, requirements or other task terms after the first Dogovor, they must either:

1. change the affected existing Dogovor through the governed Dogovor-change path when the change concerns already-selected participants; or
2. stop the remaining search and create a **new Zadatak** for materially different remaining work.

A future UX may offer `Napravi novi Zadatak iz ovog` to copy the old context and let AI ask only what should change. This is a new Zadatak, not a new revision under existing Dogovori.

## 2. Remaining capacity after first Dogovor

Example: requester asked for 3 people and formed Dogovor with 2.

The product truth remains:

`Dogovoreno 2/3 · traži se još 1`

The third slot stays attached to the same locked Zadatak and same task terms.

Requester may choose `Ne traži više nikoga` as a lifecycle/coverage action. This must close the remaining search without rewriting historical Zadatak terms or existing Dogovori.

## 3. Editing before first Dogovor

Before the first Dogovor exists, the requester may edit the Zadatak.

The target UX remains conversational:

`Izmeni Zadatak` -> AI conversation with the current Zadatak card prefilled -> AI asks what should change -> human reviews the proposed updated card -> human explicitly confirms the new version.

Opening the edit experience or chatting with AI does not itself mutate or unpublish the current Zadatak. The authoritative revision changes only after explicit human confirmation.

## 4. What happens to existing Prijave after a confirmed pre-Dogovor edit

A confirmed canonical Zadatak edit that changes task content/terms creates a new Zadatak revision and invalidates all existing unselected Prijave against the previous revision.

Those Prijave are **not deleted** and their history is preserved, but they are no longer selectable or shown as current active candidates to the requester.

Each affected worker must explicitly review the new revision and choose one of:

- `Prihvatam izmene` / keep the Prijava under the new revision;
- `Izmeni prijavu`;
- `Povuci prijavu`.

Until the worker explicitly confirms the new Zadatak revision, the old Prijava remains `STALE_REVIEW_REQUIRED` and must not reappear as a current selectable Prijava.

After explicit confirmation, the Prijava is rebound/rebased to the exact current Zadatak revision and may reappear in the requester candidate list if still otherwise eligible.

No AI, realtime event, client cache or server convenience path may silently reconfirm a worker on their behalf.

New workers who apply after the edit apply directly to the current revision and appear normally.

A display-only formatting correction that does not change canonical Zadatak facts/terms does not need to create a new business revision. Any confirmed edit that changes canonical task content/terms does.

## 5. Dogovor boundary

The existing final owner model remains:

- accepted core Dogovor terms are authoritative snapshots;
- minor operational clarifications may happen in Poruke;
- materially changed Dogovor scope/price/terms require explicit governed acceptance by the affected counterparty or a new Dogovor/new Zadatak path;
- later parent-Zadatak activity must never silently mutate accepted Dogovor truth.

## 6. Supersession map

KEEP from earlier RU-4/COV-028:

- owner-only edit authority;
- exact revision binding;
- stale/review-required Prijava state;
- human-readable diff;
- `Prihvatam izmene` / `Izmeni prijavu` / `Povuci prijavu`;
- stale Prijava cannot be selected;
- idempotency/concurrency/zero-residue proof requirements.

SUPERSEDE for V1:

- editing the parent Zadatak after any Dogovor has been formed;
- preserving selected Dogovori while simultaneously introducing different parent-Zadatak terms for remaining capacity;
- any UX that makes one Zadatak carry mixed old/new material terms across already-selected and future participants.

## 7. RU-4 implementation consequence

RU-4 is now simpler:

1. prove edit is allowed only when no Dogovor has ever been formed for the Zadatak;
2. prove confirmed pre-Dogovor edit creates the new revision and moves all old unselected Prijave to `STALE_REVIEW_REQUIRED`;
3. prove those Prijave stay absent from the current selectable candidate set until each worker explicitly reconfirms;
4. prove reconfirm/revise/withdraw is owner-of-Prijava only, exact-revision-bound and idempotent;
5. prove first Dogovor permanently closes ordinary Zadatak edit for V1;
6. prove remaining capacity stays on the locked Zadatak under unchanged terms;
7. prove `Ne traži više nikoga` closes only remaining search and does not rewrite historical terms;
8. keep live/canonical untouched until the revised RU-4 proof is green.

The existing `proof/ru4-material-revision-20260904` branch is proof history only until reconciled to this owner lock. Do not promote its older post-Dogovor-edit semantics.
