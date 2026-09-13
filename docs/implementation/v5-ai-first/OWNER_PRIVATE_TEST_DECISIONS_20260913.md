# Owner decisions: connected private Android test first

## Latest supersession: AF-D26 BACKEND PROMOTION

The owner explicitly designates `leqcwgzvjsxugfgzdmth` as the canonical CLEAN
**DEV/ALPHA** project and authorizes all necessary verified migrations, RPCs,
Edge Functions, Storage buckets/policies, secrets and backend configuration on
that project to complete the connected V5 Android app. This supersedes AF-D25's
earlier interpretation that this same project could not be changed before the
APK test. No additional staging project is required when canonical DEV/ALPHA
can safely serve development and testing. Do not reset `uskoci-v0-e2e-lab` or
promote a donor project. Changes require reconstructible GitHub source and
tests/proof. Root remains the sole integrator/backend writer.

The separate prohibition now applies only to any distinct future PRODUCTION
project with real users. No such project is selected for mutation. Existing
accepted provider/privacy/temporary test budget constraints remain in effect.
The organization-selection question is resolved by this decision; do not ask
again or create a new paid project. The seven decisions below otherwise remain.

The owner's seven explicit decisions of2026-09-13 supersede conflicting earlier
V5/HTML/RC2 proposals and the former live-first rollout plan. They close product
inputs for this private-test cycle; do not reopen scope except a demonstrated
P0/P1 blocker for basic E2E, safety, data integrity or Android build.

1. **AF-D19 Urgent.** Keep the existing urgent status/flag in the ordinary
   Need → Application/Offer → Selection → Agreement flow. Distinguish it on
   cards/maps. Do not add the proposed6h/60min gate or a new urgent engine.
   Advanced arrival ETA, ETA/price/reputation comparison, dispatch and radius
   expansion are deferred until the owner's first connected APK test. Existing
   urgent is a blocker only if it breaks the basic flow.
2. **AF-D20 Test accounts and isolation.** Use the existing owner/test account
   and create one clearly labelled internal QA account in an isolated test or
   staging environment. It must not affect real reputation, statistics, ranking,
   billing or production notifications. No production-data copy/reset or reuse
   of an unrelated populated laboratory is implied by this approval.
3. **AF-D21 Private photographs.** Agreement/private chat supports at most6
   images per message,10MB per original, maximum1600px after resizing, and
   stripping EXIF/GPS/unneeded metadata. Private Storage only; no public URL.
   Access is limited to authorized participants of that Agreement and existing
   controlled support access. Use a reasonable server safety rate limit;
   the earlier12/day proposal is explicitly rejected as a product restriction.
   A higher temporary private-test safety limit may be chosen and calibrated.
4. **AF-D22 Retention.** No automatic30-day deletion of completed jobs,
   Agreements, messages or photographs. History stays available while the
   account exists. Do not hardcode unconditional forever retention. At account
   closure apply the privacy/closure flow to delete or anonymize personal/private
   content where applicable, with only necessary technical/legal exceptions.
   This decision does not invent particular legal exception durations.
5. **AF-D23 Identity and vehicles.** Self-reported identity for this test;
   external document/selfie/KYC is disabled/non-required and is not a release
   blocker. Never display a verified identity badge without actual verification.
   Email confirmation, Auth and session integrity remain required. Keep the
   simple vehicle type/name and existing capacity model; kg/seats are optional
   or later work, not mandatory additions.
6. **AF-D24 Media and voice.** This cycle supports photographs and voice input,
   without permanent audio messages, video, documents or arbitrary attachments.
   The latest voice instruction is hold-to-talk → speech-to-text → visible,
   editable text → explicit sending. Releasing finalizes the transcript; it
   does not send an AI turn or publish a Task. This supersedes the earlier
   automatic AI send-on-release behavior. Per-fact confirmations remain absent.
   Existing approved transient Google speech processing and shared test budget
   remain applicable.
7. **AF-D25 Deployment order.** Development, local tests, CI, staging, APK build
   and device proof are authorized. Production/live code, migrations and batch
   execution are prohibited until the owner receives and personally tests the
   connected isolated APK, then explicitly says **ODOBRAVAM LIVE DEPLOY**.
   Current objective: connected private-test APK → owner device test → fixes →
   only then a live decision. Earlier live candidates are historical preparation.

The following infrastructure observation is historical and does not block the
owner-designated canonical DEV/ALPHA target. Infrastructure access and verified environment identity are implementation
prerequisites, not new product choices. As of06:39UTC the only listed old lab
has229 migrations and224 Auth users; it is not a clean clone of CLEAN108.
Its data/schema have not been reset. Supabase tools require an owner organization
choice before checking new environment cost; AF-D26 removes that need.
No environment has been created, no QA account has been created, and production
has not been changed by these decisions being recorded.
