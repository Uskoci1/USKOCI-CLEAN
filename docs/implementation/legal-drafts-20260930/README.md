# USKOČI legal / privacy package: technical drafts (2026-09-30)

**Status: TECHNICAL DRAFTS, not legal advice.** Everything here waits for operator data and for review by a responsible person. Nothing in this folder is published, registered in the server legal registry, or wired into the app. No source, server, control-tracker or P6 file was touched: this folder is documentation only.

Public-text drafts and registers are written in Serbian (Latin script); this README is in English.

## 1. Scope and provenance

- **Task:** prepare deliverables LEG-01..LEG-20 of master plan chapters 15-16 (`docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`) as far as they can be grounded in what the code and existing documents really do today.
- **Code read (read-only):** canonical branch `work/uskoci-ui-unification-20260924` at commit `fc58f411598338c8589f5f177626a2790c92fb13`: `app.json`, `app.config.js`, `eas.json`, `package.json` / `package-lock.json`, `src/**`, `supabase/functions/**` (11 Edge functions), `supabase/migrations/**`, `supabase/candidates/**` (file list only), `modules/uskoci-voice/**`, `plugins/**`, `docs/**`. File references in the drafts are repository-relative paths at that commit (line numbers were checked against that commit).
- **RC2 legal text:** the RC2 master is **not in the repository**. It was read from the owner's local folder `C:\Users\user\Desktop\USKOCI ZAVRSAVANJE\V5_RC2_APPROVED_SOURCE\` (file `USKOCI_LEGAL_RELEASE_CANDIDATE_MASTER_RC2_2026-08-18.docx` and its `.read.txt`; SHA-256 of the DOCX `a981b0601ae3f639b099a37730302214e6c8b0ee8a34b7eef56c34f31cfc2e80`, of the `.read.txt` `513c9b00f387aabffd97d87d5d417f5aa4d327738ebbd98145be20b6056299ed`; both match the hashes recorded in repository documents such as `docs/implementation/v5-ai-first/RETENTION_ACTIVATION_GAPS.md`). RC2 calls itself "INTERNI RELEASE CANDIDATE / NOT LEGAL READY". These drafts do not change that status.
- **Documents named by the master plan but NOT found** (searched the repository, its git history, and Desktop/Downloads to depth 4): `USKOCI_LEGAL_RC2_OWNER_RECONCILED_2026-09-10.docx` (master plan L01), `USKOCI_DATA_FLOW_TRUTH_2026-09-27.md` (L03, 290 lines), `USKOCI_APPLE_GOOGLE_RELEASE_GATES_2026-09-28.md` (L02, 81 lines). Consequences: (a) the drafts derive from the 2026-08-18 RC2 master and cannot reflect any wording change made in the "owner-reconciled" version; (b) the processing and processor registers are built directly from code, and should be compared with the Data Flow Truth document when it is supplied; (c) the store-gate wording is taken from the master plan tables (chapter 18) only.
- **Method:** every factual statement carries a file reference. Where the repository does not fix a fact (operator identity, retention period, legal basis, region, contract, provider legal entity) the text uses `[[OPERATER: ...]]`, `[[ODLUKA VLASNIKA: ...]]` or `[[PROVERITI: ...]]`; nothing was invented. Retention numbers that appear in the matrix are copied from an earlier technical draft for counsel (`docs/implementation/v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md`) and are labelled "predlog, nije odobren".
- **Public-text drafts** (LEG-02, 04, 05, 07, 08) start with the required banner, contain no internal implementation status, and end with an "INTERNO - ukloniti pre objave" traceability appendix that maps each section to the RC2 section and to code.

## 2. Index LEG-01 .. LEG-20

Status vocabulary: **DRAFT-FROM-CODE** (grounded in code/docs today), **DRAFT-FROM-RC2** (derived from the RC2 master text, adapted to the app), **DATA-PENDING-OWNER** (cannot be completed without owner/operator data or decisions), **NOT-STARTED**.

| ID | Deliverable (master plan) | File | Status | Notes |
|---|---|---|---|---|
| LEG-01 | Operator data | `LEG-01_operator_data_checklist.md` | DATA-PENDING-OWNER | 31 numbered fields (OP-xx), where each is used (documents, Apple/Google consoles). No operator data exists anywhere in the repository. |
| LEG-02 | Terms of Use V1 | `LEG-02_uslovi_koriscenja_nacrt.md` | DRAFT-FROM-RC2 + DATA-PENDING-OWNER | 34 sections; includes the content of LEG-03 (sections 8-13) and LEG-06 (19-21). Several RC2 P0 clauses have no counterpart in the app and are marked `[[PROVERITI]]`. |
| LEG-03 | Marketplace and Agreement rules | (inside LEG-02 §8-13) | DRAFT-FROM-RC2 | Can be split into an annex if preferred. |
| LEG-04 | Privacy Policy V1 | `LEG-04_politika_privatnosti_nacrt.md` | DRAFT-FROM-RC2 + DRAFT-FROM-CODE; DATA-PENDING-OWNER | 21 sections built from RC2 privacy text checked against code; retention numbers and processor contracts intentionally absent. |
| LEG-05 | Safety / Community / regulated services | `LEG-05_pravila_zajednice_i_bezbednosti_nacrt.md` | DRAFT-FROM-RC2 + DRAFT-FROM-CODE | Aligned with the owner-locked publication policy `RS-MIN-001..016`, not with RC2's internal status names. |
| LEG-06 | Cancellation, no-show, reliability | (inside LEG-02 §19-21) | DRAFT-FROM-RC2 | RC2 statements on reliability inputs do not match the CLEAN matching engine (see finding G-12). |
| LEG-07 | Complaints, support, appeals, ADR | `LEG-07_reklamacije_podrska_zalbe_nacrt.md` | DRAFT-FROM-RC2 + DATA-PENDING-OWNER | Uses the real topic and status names from the support screens; ADR platform link, deadlines mapping and channels pending. |
| LEG-08 | Public account-deletion page | `LEG-08_brisanje_naloga_javna_stranica_nacrt.md` | DRAFT-FROM-RC2 + DRAFT-FROM-CODE; DATA-PENDING-OWNER | The in-app path is described from the real closure flow. **The out-of-app (web) request path does not exist** and must be designed (Google Play requirement). |
| LEG-09 | Processing register | `LEG-09_processing_register.md` | DRAFT-FROM-CODE | 28 processing activities, subjects, access model, 13 findings (G-01..G-13). Legal bases only as RC2 proposals. |
| LEG-10 | Retention / deletion matrix | `LEG-10_retention_deletion_matrix.md` | DRAFT-FROM-CODE; retention periods DATA-PENDING-OWNER | What each mechanism really does today (closure, export cleanup, AI purge), 15 data classes, 12 open decisions, appendix with 98 relations. |
| LEG-11 | Processor / transfer register | `LEG-11_processor_transfer_register.md` | DRAFT-FROM-CODE; contracts/regions DATA-PENDING-OWNER | 8 recipients (Supabase, Google Gemini text and Live, Expo/FCM/APNs, LocationIQ, OpenFreeMap, email sender). |
| LEG-12 | AI, audio, location notices | `LEG-12_ai_audio_location_notices.md` | DRAFT-FROM-CODE | 12 notices with what is really sent; keeps existing owner-approved texts; flags gaps and one permission-text mismatch. |
| LEG-13 | Legal UI and acceptance | `LEG-13_legal_ui_acceptance_matrix.md` | DRAFT-FROM-CODE (bonus) | Current server contract and screens; target matrix is a proposal. |
| LEG-14 | Moderation / support operations | - | NOT-STARTED | Inputs: `docs/implementation/v5-ai-first/SUPPORT_CASE_CONTRACT_PROPOSAL.md`; needs a named responsible person and a real intake channel (LEG-01 OP-07). |
| LEG-15 | Rights requests / export | - | NOT-STARTED | Inputs ready: LEG-04 §15, LEG-08, LEG-10. Export cannot run until an active Privacy Policy and a retention schedule with the export binding are published (`EXPORT_POLICY_NOT_READY`). |
| LEG-16 | Apple App Privacy answers | - | NOT-STARTED | Inputs ready: LEG-09, LEG-11, LEG-12, LEG-18. Must be reviewed against the final build. |
| LEG-17 | Google Play Data Safety answers | - | NOT-STARTED | Same inputs. |
| LEG-18 | SDK / permission / manifest / licence | `LEG-18_sdk_permission_inventory.md` | DRAFT-FROM-CODE (bonus) | Config-derived; the real release-artefact audit (merged manifest, privacy manifest) is a listed checklist, not done. |
| LEG-19 | Age / content / audience | - | NOT-STARTED | Key input: the app has **no age check** although RC2 says 18+. |
| LEG-20 | Store / review package | - | NOT-STARTED | Depends on LEG-01, LEG-08, LEG-16/17. |

## 3. Findings while grounding the drafts

Details and file references are in LEG-09 section 5 (G-01..G-13) and LEG-12/LEG-18. The ones that most affect what may be written publicly:

1. Task-intake AI context sends every persisted fact except `need.resolved_location`. The standard "Mesto zadatka" step itself writes the private `need.exact_address` / `need.access_notes` as confirmed conversation facts, so every later AI message in that conversation carries them to Google. The fixing branch `d18e830a` is not integrated (owner deferred it) and does not filter text typed in the current message. No public text may say "the exact address never reaches Google".
2. There is **no notice** before the first text AI message (only voice and task-photo notices exist), and **no manual path** to create a task without AI (manual entry was removed), so consent cannot be the legal basis for AI processing as things stand.
3. The Android/iOS **microphone permission string contradicts** the real voice behaviour (release sends text immediately unless review is on), and iOS gets a microphone declaration although the voice module is Android-only.
4. **No age gate, no trader/non-trader declaration, no ranking explanation** in the app, although RC2 lists them as P0.
5. **Acceptance of Terms/Privacy is required by nothing** (no command checks it; registration shows only "Ovo je test verzija"). The registry has 0 published documents; it only knows `TERMS` and `PRIVACY`, so Community Rules/Complaints must be annexes or a new document kind is needed.
6. Account **closure does not depend on a published retention schedule** in the code (adapter 146 binds to the certified source, `legalPolicyAttested:false`; live behaviour was not exercised in this pass), but data **export does** (needs the schedule with the export binding + an active Privacy Policy). The out-of-app deletion path required by Google Play is missing.
7. The database processor inventory is stale (OpenAI active, LocationIQ absent, Expo inactive); the code only calls Google Gemini, LocationIQ, Expo Push and OpenFreeMap.
8. RC2's statements about HITNO weighting and "verifiable events" reliability come from the older R26.6 source; the CLEAN matching engine uses fixed weights and average rating only.
9. Store package `rs.uskoci` has no Firebase config, so push is not configured there; iOS bundle id is not set.
10. `public.needs` still grants broad SELECT (finding 7.17, PKG045b not applied).

## 4. Open questions for the owner

Each question points to the file where it is used. "Answer" means the owner supplies the value or decides; where a lawyer is needed it is stated.

**A. Operator and publication**

1. Legal form, full name, address, PIB, registry number of the operator, or a decision to register before publication (LEG-01 OP-01..OP-05). AF-D10 says the operator is not registered.
2. Domain and hosting for the public pages (Terms, Privacy, support, deletion page) and the five contact channels: general, complaints, privacy, safety, legal/IP (LEG-01 OP-10..OP-16).
3. Named responsible persons: privacy/DPO (or a statement that none is required), moderation and support, incident/breach response (OP-07, OP-21, OP-25).
4. Countries where the app is offered, and the audience (18+ confirmed?) (OP-30; LEG-19).
5. Governing law and jurisdiction (OP-20).
6. Register of address: formal "Vi" as in RC2, or "ti" as in the app; also Cyrillic/English versions (OP-32).
7. The **owner-reconciled RC2 (2026-09-10) DOCX** named in the master plan: please supply it, or confirm that the 2026-08-18 master (hash above) is the intended base.
8. Also missing: `USKOCI_DATA_FLOW_TRUTH_2026-09-27.md` and `USKOCI_APPLE_GOOGLE_RELEASE_GATES_2026-09-28.md`.

**B. Legal decisions (counsel needed)**

9. Retention periods and exceptions: the 12 decisions in LEG-10 section 6 (pseudonymous subject id after closure, Agreement evidence, exact address, consent proof, safety/support records, notification/technical logs, export file 7 days, inactive accounts, backups).
10. Legal basis per processing, especially AI text, voice, task-photo review, geocoding, push, map tiles (LEG-09 column "Osnov").
11. Processor contracts: which legal entity accepted the terms of Google (Gemini paid), Supabase, Expo, LocationIQ, and the email sender; production region; transfer mechanism outside Serbia (LEG-11 sections 2 and 5).
12. Is a DPIA required (location, AI, voice, free text with third-party data)? (LEG-09 section 4.)
13. Labour-ministry opinion or a counsel-backed restriction on the staffing/job-placement boundary (RC2 P0; LEG-02 §6).
14. Consumer-law package: trader/non-trader statement, ranking explanation, ADR obligation and the 8-day complaint mapping (RC2 P0; LEG-02 §7, §10; LEG-07 §4-6).
15. Whether Community Rules and Complaints are annexes of the Terms or separate registered documents (LEG-13 section 5).

**C. Product decisions surfaced by the drafts**

16. Add a manual, no-AI way to create a task, or keep AI as the only path and settle the legal basis accordingly (LEG-12 N-01).
17. Approve or change the proposed notice texts N-01..N-12 (LEG-12), including replacing the microphone permission string and removing the iOS microphone declaration until iOS voice exists (LEG-18 §2.3).
18. Integrate the two deferred privacy branches (`d18e830a` AI context minimization, `1ab01e78` processor inventory) **before** the public texts are frozen; until then LEG-04 §7 and LEG-11 carry caveats.
19. Design and own the out-of-app deletion request (who handles it, identity check without new data, same closure procedure, DSR record) (LEG-08 §3).
20. When acceptance is required (first entry, first action, publish) and what happens on refusal; age declaration mechanism (LEG-13 section 3).
21. Is push part of the first store release (needs FCM/APNs configuration for `rs.uskoci`)? (LEG-11 R-05.)
22. Voice messages between users: shipping status changes the privacy text (LEG-04 §8 marker).
23. Keep the public OpenFreeMap tile service or move to a contracted provider (LEG-11 R-07).
24. Ratings: text comment is not implemented; keep the public text to ratings and tags (LEG-02 §23).
25. The server capability for one-time worker location sharing in an Agreement exists but no screen uses it: retire or finish (LEG-09 G-07).
26. Rule for inactive accounts that are never closed (LEG-10).

**D. Verification before publication**

27. Supabase plan, backup/PITR and log retention; whether a separate production project is created (LEG-10 section 5; master plan 17.1).
28. Read the actual release flags (push transport, message target, image review, Q&A classifier, speech, closure worker) at the release candidate (LEG-11).
29. Audit the signed AAB/IPA: merged manifest, privacy manifest, required-reason APIs, licences, exclusion of design routes (LEG-18 §6).
30. Compute and register version + SHA-256 for each published page, including the CRLF/LF question (LEG-13 §5.6).

## 5. Proposed changes to the control tracker (NOT applied)

`docs/control/redovi.json` is the single tracker and was not modified. Suggested annotations for the next authorized refresh:

| Row | Suggested note |
|---|---|
| N04 (legal documents and consent) | Add reference to this folder (LEG-02/04/05/07/08 DRAFT-FROM-RC2); status stays "waits for operator data and counsel". Note that acceptance is required by no command and registration shows a test-version line. |
| N09 (export) | Add: generation also needs an active Privacy Policy and a retention schedule with the export binding; processor map is not a precondition. |
| N10 (account deletion) | Add: closure does not depend on the retention schedule, but the web deletion path required by Google Play is missing (LEG-08 §3). |
| N11 (privacy and retention) | Add findings G-01, G-02, G-05 and the closed list of 12 retention decisions (LEG-10). |
| N07 / N08 (report, support) | Add LEG-05 / LEG-07 drafts; operator intake and responsible person still missing (LEG-14). |
| N02 (registration, email) | Email sender undecided (LEG-11 R-08). |
| A03 (voice in conversation) | Permission string mismatch (LEG-12 N-03, LEG-18 §2.3). |
| A02 / B00 (AI conversations) | No pre-use notice for text AI; no manual alternative (LEG-12 N-01, N-02). |
| P02 / P04 (notifications, sending) | Push not configured for the store package; notice N-12. |
| "prodavnice" section | Privacy URL, terms/support URL, data forms: still NIJE; inputs prepared in LEG-01/09/11/12/18. |

## 6. Files

```
docs/implementation/legal-drafts-20260930/
  README.md
  LEG-01_operator_data_checklist.md
  LEG-02_uslovi_koriscenja_nacrt.md
  LEG-04_politika_privatnosti_nacrt.md
  LEG-05_pravila_zajednice_i_bezbednosti_nacrt.md
  LEG-07_reklamacije_podrska_zalbe_nacrt.md
  LEG-08_brisanje_naloga_javna_stranica_nacrt.md
  LEG-09_processing_register.md
  LEG-10_retention_deletion_matrix.md
  LEG-11_processor_transfer_register.md
  LEG-12_ai_audio_location_notices.md
  LEG-13_legal_ui_acceptance_matrix.md
  LEG-18_sdk_permission_inventory.md
```

## 7. Suggested order of work

1. Owner supplies LEG-01 data and answers questions 1-8 (unblocks every public text).
2. Counsel reviews LEG-09/10/11 (bases, retention, contracts) and answers 9-15.
3. Owner decides the product items 16-26; the two deferred privacy branches are integrated and the registers re-read (LEG-09 section 6, LEG-11 section 6).
4. Remove all `[[...]]` markers and the traceability appendices, publish pages, compute hashes, register versions (LEG-13).
5. Fill LEG-16/17 from the final registers and the audited release artefact (LEG-18 section 6).
