# USKOČI — PUBLIC PRESELECTION Q&A CONTRACT — 2026-09-03

**Status:** `V1 LOCKED / IMPLEMENTATION REQUIRED`  
**Source lineage:** V16 `NEED-09`, dependency `B10`, donor M89/M100, reconciled under current 21/21 canon.

## 1. Purpose

Allow a Worker to clarify a public Zadatak before submitting a Prijava without opening an unrestricted preselection chat or leaking contact/private location.

## 2. Surfaces

### W04 — Zadatak detail
Section: `Pitanja i odgovori`.
- show current-revision public-safe Q&A;
- CTA `Postavite javno pitanje`;
- asker name/avatar is not shown;
- answer is attributed to `Objavio Zadatak` / requester context, not private contact identity.

### R04 — own Zadatak workspace
Section: `Pitanja`.
- unanswered first;
- current-revision answered below;
- answer composer is inline/sheet, not a new global screen;
- material-answer warning is explicit before revision flow.

## 3. Canonical objects

Target semantic objects (exact SQL names may be chosen in RU-4B):

`ClarificationQuestion`
- id;
- need_id;
- asked_against_revision;
- asker_account_id (private/server only);
- body;
- status `PENDING_POLICY | PUBLISHED | REVIEW | BLOCKED | STALE | CLOSED`;
- policy decision/rule references;
- created_at;
- semantic request ID/hash.

`ClarificationAnswer`
- id;
- question_id;
- responder_account_id (must own Zadatak);
- answered_against_revision;
- body;
- materiality `NON_MATERIAL | MATERIAL`;
- linked_need_revision if MATERIAL;
- status;
- policy decision/rule references;
- created_at;
- semantic request ID/hash.

## 4. Question command

Preconditions:
- auth valid;
- ACTIVE Worker profile;
- exact Zadatak revision is admitted/current and visible;
- not own Zadatak;
- no active block relation preventing interaction;
- rate/abuse gate passes;
- text is within bounded configured size.

Safety/privacy pipeline:
1. normalize text;
2. deterministic public-contact/privacy floors;
3. policy bundle selection for market/scope `PRESELECTION_QA`;
4. optional AI semantic interpretation against only supplied current policy rules;
5. server-final `ALLOW / CLARIFY / REVIEW / BLOCK`;
6. only ALLOW becomes public.

Event: `CLARIFICATION_CREATED`.
Recipient: Zadatak owner Inbox; push optional transport.

## 5. Public contact/privacy floor

At minimum, reject/rephrase public content containing:
- phone number;
- email address;
- social/user handle intended for contact;
- exact address/door/access code or other private access instruction;
- external coordination/payment/contact URL or instruction intended to bypass the connection boundary;
- third-party secret/private personal data.

This floor applies to both question and answer.

Coarse place names, task-relevant non-private details and legitimate public clarification are allowed when the D-0140 policy permits them.

## 6. Answer command

Only current Zadatak owner may answer.

### NON_MATERIAL
If answer merely explains existing canonical facts without changing them:
- run public-safe policy gate;
- append immutable answer;
- event `CLARIFICATION_ANSWERED`;
- notify original asker through event/Inbox;
- no Zadatak revision.

### MATERIAL
If answer changes price, schedule, route/geography, people/slots, hard requirements, critical conditions, execution mode or another fingerprinted material fact:
- answer cannot silently publish as current truth;
- create pending material patch/revision intent;
- route through canonical `REVISE_TO_DRAFT` + Human Review + D-0140 admission;
- old admitted revision becomes non-current according to RU-4 rules;
- unselected Applications bound to old material revision become stale;
- existing Agreements remain frozen;
- once new revision is admitted/published, current Q&A projection can expose the approved answer/current revision.

## 7. Revision behavior

Every question binds to `need_id + asked_against_revision`.

After material revision:
- unanswered old-revision questions become `STALE` for current projection;
- historical audit is preserved;
- current W04/R04 does not present stale Q&A as if it describes the new revision.

## 8. Abuse/block/report

- server retains asker identity even though UI is anonymous;
- account block prevents future preselection Q&A interaction;
- rate-limit and duplicate/spam detection are server-owned;
- moderation review may retain evidence according to current retention policy;
- blocked user is not told private moderation details.

## 9. No monetization bypass assumption

V1 is FREE/0 RSD, but public-contact restrictions are still required for privacy, safety, auditable marketplace behavior and future-compatible Povezivanje. They are not conditional on a current paid fee.

## 10. Proof

Required before production:
- requester/worker/attacker two-account matrix;
- question anonymity projection proof;
- phone/email/exact-address rejection proof;
- wrong-owner answer denial;
- stale-revision question denial/stale projection;
- material-answer revision + readmission proof;
- event/inbox dedupe;
- delayed push safe-deeplink reread;
- block/rate-limit proof;
- zero partial public row on policy/provider failure.
