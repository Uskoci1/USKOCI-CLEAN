# USKOČI legal / privacy package: technical drafts (2026-09-30)

**Status: TECHNICAL DRAFTS, not legal advice.** Everything here waits for operator data and for review by a responsible person. Nothing in this folder is published, registered in the server legal registry, or wired into the app. No source, server, control-tracker or P6 file was touched: this folder is documentation only.

Public-text drafts and registers are written in Serbian (Latin script); this README is in English.

**Refresh 2026-10-02 (EX-07 slice S04, technical drafts only).** This folder was refreshed to the current canonical DEV facts and extended by two drafts: LEG-14 (moderation and support operations) and LEG-15 (rights requests and export, with the per-class export-versus-closure scope map for gap G16). Every edit is additive and dated: earlier text is kept, superseded paragraphs are marked "SUPERSEDED 2026-10-02", replacements are marked "ZAMENA 2026-10-02" (Serbian drafts), and the list of changed files with the reason for each is in `CHANGELOG_20261002.md`. Evidence: a read-only SELECT on canonical DEV `leqcwgzvjsxugfgzdmth` on 2026-10-02 (counts, constraints, function bodies and md5 pins only; no personal data and no user text) plus the repository at HEAD `0b9cd8c9`. Nothing here is published, registered in the server legal registry or wired into the app. No operator data, retention period, legal basis, processor contract, URL or counsel conclusion was invented (AGENTS.md 3.4.5): every operator fact is a `[[OPERATER: ...]]` placeholder. No text in this folder may claim that ratings left without a comment stay visible only in the aggregate: that is not true after D12 (owner-accepted consequence 17, `supabase/proofs/d12/README_D12_CANDIDATE.md`).

**Review fixes 2026-10-02 (after the owner decisions).** These drafts were written at `0b9cd8c9`; the owner decision record of 2026-10-02 (`docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`: all 75 proposals accepted at 11:02 Belgrade time) is reflected as listed in `CHANGELOG_20261002.md`, section "Review fixes (2026-10-02)". Decisions A04, A05, A09, A10, A11, A30, R06, R11 and R12 are recorded as dated lines "DECIDED by the owner 2026-10-02 (id)" next to the text they affect, and each such line says what it leaves open; R07 (operator data) and R10 (retention numbers) were re-checked and are already respected, because every operator fact and every retention period is still a placeholder. Where an older line in this folder still says "open" for a point that the record decides, the dated line governs. Every public-text draft stays DRAFT until legal review.


## 1. Scope and provenance

- **Task:** prepare deliverables LEG-01..LEG-20 of master plan chapters 15-16 (`docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`) as far as they can be grounded in what the code and existing documents really do today.
- **Code read (read-only):** canonical branch `work/uskoci-ui-unification-20260924` at commit `fc58f411598338c8589f5f177626a2790c92fb13`: `app.json`, `app.config.js`, `eas.json`, `package.json` / `package-lock.json`, `src/**`, `supabase/functions/**` (11 Edge functions), `supabase/migrations/**`, `supabase/candidates/**` (file list only), `modules/uskoci-voice/**`, `plugins/**`, `docs/**`. File references in the drafts are repository-relative paths at that commit (line numbers were checked against that commit).
- **RC2 legal text:** the RC2 master is **not in the repository**. It was read from the owner's local folder `C:\Users\user\Desktop\USKOCI ZAVRSAVANJE\V5_RC2_APPROVED_SOURCE\` (file `USKOCI_LEGAL_RELEASE_CANDIDATE_MASTER_RC2_2026-08-18.docx` and its `.read.txt`; SHA-256 of the DOCX `a981b0601ae3f639b099a37730302214e6c8b0ee8a34b7eef56c34f31cfc2e80`, of the `.read.txt` `513c9b00f387aabffd97d87d5d417f5aa4d327738ebbd98145be20b6056299ed`; both match the hashes recorded in repository documents such as `docs/implementation/v5-ai-first/RETENTION_ACTIVATION_GAPS.md`). RC2 calls itself "INTERNI RELEASE CANDIDATE / NOT LEGAL READY". These drafts do not change that status.
- **Documents named by the master plan but NOT found** (searched the repository, its git history, and Desktop/Downloads to depth 4): `USKOCI_LEGAL_RC2_OWNER_RECONCILED_2026-09-10.docx` (master plan L01), `USKOCI_DATA_FLOW_TRUTH_2026-09-27.md` (L03, 290 lines), `USKOCI_APPLE_GOOGLE_RELEASE_GATES_2026-09-28.md` (L02, 81 lines). Consequences: (a) the drafts derive from the 2026-08-18 RC2 master and cannot reflect any wording change made in the "owner-reconciled" version; (b) the processing and processor registers are built directly from code, and should be compared with the Data Flow Truth document when it is supplied; (c) the store-gate wording is taken from the master plan tables (chapter 18) only.
- **Method:** every factual statement carries a file reference. Where the repository does not fix a fact (operator identity, retention period, legal basis, region, contract, provider legal entity) the text uses `[[OPERATER: ...]]`, `[[ODLUKA VLASNIKA: ...]]` or `[[PROVERITI: ...]]`; nothing was invented. Retention numbers that appear in the matrix are copied from an earlier technical draft for counsel (`docs/implementation/v5-ai-first/legal/PRAVNIK_PODACI_I_ROKOVI_20260921.md`) and are labelled "predlog, nije odobren".
- **Public-text drafts** (LEG-02, 04, 05, 07, 08) start with the required banner, contain no internal implementation status, and end with an "INTERNO - ukloniti pre objave" traceability appendix that maps each section to the RC2 section and to code.

## 2. Index LEG-01 .. LEG-20

Status vocabulary: **DRAFT-FROM-CODE** (grounded in code/docs today), **DRAFT-FROM-RC2** (derived from the RC2 master text, adapted to the app), **DATA-PENDING-OWNER** (cannot be completed without owner/operator data or decisions), **NOT-STARTED**.

> **Update 2026-10-02:** the rows LEG-14 and LEG-15 below still say NOT-STARTED; that is **SUPERSEDED 2026-10-02**: both are drafted (section 2a). LEG-09, 10, 11, 12 and 13 were refreshed; LEG-02, 05 and 07 were cut to implemented behaviour; LEG-02, 04, 05, 07, 08, 09 and 10 carry the D12 consequences (section 2a).


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

### 2a. Status update 2026-10-02

| ID | File | Status 2026-10-02 | What changed |
|---|---|---|---|
| LEG-01 | `LEG-01_operator_data_checklist.md` | DATA-PENDING-OWNER (unchanged) | Section 7 adds the fields OP-50..OP-57 that LEG-14 and LEG-15 need; no field is filled |
| LEG-02 | `LEG-02_uslovi_koriscenja_nacrt.md` | DRAFT-FROM-RC2 + DATA-PENDING-OWNER (cut) | Sections 19, 22, 23, 25, 26, 27 cut to implemented behaviour (no priority handling, no suspension, no ADR notice, no emergency measure, decisions have effect NONE); D12 comment in section 23; closure-exception limit in section 27 |
| LEG-04 | `LEG-04_politika_privatnosti_nacrt.md` | DRAFT-FROM-RC2 (+ caveat kept) | Section 7 caveat KEPT until the final privacy pass; proposal for the voice paragraph (section 8); section 11 replaced for D12 |
| LEG-05 | `LEG-05_pravila_zajednice_i_bezbednosti_nacrt.md` | DRAFT-FROM-RC2 + DRAFT-FROM-CODE (cut) | Sections 9, 10, 11 cut to implemented behaviour |
| LEG-07 | `LEG-07_reklamacije_podrska_zalbe_nacrt.md` | DRAFT-FROM-RC2 + DATA-PENDING-OWNER (cut) | Sections 4, 5-6 (conditional ADR), 9, 10, 11 cut; quota-scope difference and closure-exception limit recorded |
| LEG-08 | `LEG-08_brisanje_naloga_javna_stranica_nacrt.md` | DRAFT-FROM-RC2 + DRAFT-FROM-CODE | Sections 5 and 6 supplemented (comment, voice, exceptions); web path still absent |
| LEG-09 | `LEG-09_processing_register.md` | DRAFT-FROM-CODE | Section 7: DEV facts, P-29 voice message, P-30 written comment, the 12 owner-accepted D12 consequences, EX-04 note, SUPERSEDED corrections (G-09, G-10, `public.needs`) |
| LEG-10 | `LEG-10_retention_deletion_matrix.md` | DRAFT-FROM-CODE; periods DATA-PENDING-OWNER | Section 7: mechanisms, classes 8, 9, 13, 15, E, decisions 13-18, closure exceptions, live catalog numbers (107 / 76 / 31) |
| LEG-11 | `LEG-11_processor_transfer_register.md` | DRAFT-FROM-CODE (caveats kept) | Section 7: no new processor, three private buckets, inventory re-read unchanged; caveats KEPT |
| LEG-12 | `LEG-12_ai_audio_location_notices.md` | DRAFT-FROM-CODE | Section 8: N-13 voice message, N-14 written comment |
| LEG-13 | `LEG-13_legal_ui_acceptance_matrix.md` | DRAFT-FROM-CODE | Section 6: acceptance contract re-read (0 documents, 0 acceptances, no command checks acceptance), new surfaces, decisions 7-8 |
| LEG-14 | `LEG-14_moderacija_i_podrska_operativni_postupci.md` | DRAFT-FROM-CODE; operator facts DATA-PENDING-OWNER (was NOT-STARTED) | New |
| LEG-15 | `LEG-15_zahtevi_lica_i_izvoz_nacrt.md` | DRAFT-FROM-CODE; procedures DATA-PENDING-OWNER (was NOT-STARTED) | New, with the export-versus-closure map (section 3, appendices A and B) |
| LEG-16, 17, 19, 20 | - | NOT-STARTED (unchanged) | LEG-16 and LEG-17 have a first draft in `docs/implementation/release-prep-20260930/DATA_DECLARATIONS_DRAFT.md` |
| LEG-18 | `LEG-18_sdk_permission_inventory.md` | unchanged | Not touched |


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

### 3a. Findings update 2026-10-02

1. **Finding 10 is SUPERSEDED 2026-10-02.** PKG-045b (P0 form) was applied on 2026-09-30 (`supabase/operations/dev-alpha/ledger/20260930_pkg045b_p0_application.receipt.json`). Read-only DEV read: `public.needs` has 41 columns; `authenticated` can select 38 of them, without `requester_account_id`, `remaining_search_closed_by_account_id` and `remaining_search_close_reason`; `anon` none.
2. Finding 5 re-read, unchanged: 0 legal document versions, 0 acceptances, 0 retention policy sets, 0 processor map sets; no function, policy, view or trigger checks acceptance; no function writes the legal document registry (a publication procedure is missing, EX-07 gap G07).
3. Finding 6 stays true (closure does not wait for a retention schedule), with a new limit: an account that has a support case or a safety report (as reporter or as the target) stops at `EXCEPTIONS_PENDING` after its ordinary data is erased; nothing releases the exception and there is no cancel (LEG-10 section 7.5, LEG-14 section 4.2, LEG-15 section 5). Never seen on DEV (0 closures); proven only on the disposable chain.
4. Finding 7 re-read, unchanged: the processor inventory has 4 rows (OpenAI still active and required; LocationIQ and OpenFreeMap absent); the two privacy branches remain deferred (AGENTS.md 4.5), so the LEG-04 section 7 and LEG-11 caveats are KEPT.
5. New: voice messages (Voice B1) are stored in the private bucket `agreement-voice`; they are not the dictation of finding 3 (LEG-09 P-29 versus P-07).
6. New: D12 written comments exist on DEV with the owner-accepted defaults, including the shadow comment next to a block and the public aggregate next to individual ratings (LEG-09 section 7.3.1).
7. New: the support quota exempts only `PRIVACY_RIGHTS` (plus safety cases); complaints and content notices consume it (LEG-14 section 4.1).
8. New: of the 76 relations in the closure program, 40 are not read by the export body, and 14 relations stay after closure and are not exported either (LEG-15 section 3).
9. New: the catalog description of the retention class `MEDIA_OBJECTS` still names only `profile-media` although the class also holds the voice upload table (text lag, no period set).


## 4. Open questions for the owner

Each question points to the file where it is used. "Answer" means the owner supplies the value or decides; where a lawyer is needed it is stated.

**A. Operator and publication**

1. Legal form, full name, address, PIB, registry number of the operator, or a decision to register before publication (LEG-01 OP-01..OP-05). AF-D10 says the operator is not registered.
2. Domain and hosting for the public pages (Terms, Privacy, support, deletion page) and the five contact channels: general, complaints, privacy, safety, legal/IP (LEG-01 OP-10..OP-16).
3. Named responsible persons: privacy/DPO (or a statement that none is required), moderation and support, incident/breach response (OP-07, OP-21, OP-25).
4. Countries where the app is offered, and the audience (18+ confirmed?) (OP-30; LEG-19).
5. Governing law and jurisdiction (OP-20).
6. Register of address: formal "Vi" as in RC2, or "ti" as in the app; also Cyrillic/English versions (OP-32).

   - **STATUS 2026-10-02: PARTLY DECIDED.** In-app copy uses "ti" (AGENTS.md 3.6.8); the new in-app notice proposals (LEG-12 N-13, N-14) follow it. The register of the PUBLIC legal texts ("ti", formal "Vi", Cyrillic and English versions) stays open for the owner and counsel (OP-32).

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

   - **STATUS 2026-10-02: DECIDED earlier by the owner (manual entry removed).** `docs/control/redovi.json`, blokade B02: "ručni unos je uklonjen odlukom (plan PKG-011)"; read-only DEV read 2026-10-02: no function with "manual" and "need" in its name exists in `public`. Adding a manual path would reverse that decision. Still open: the legal basis for AI text processing while AI is the only path (LEG-12 N-01, N-02).

17. Approve or change the proposed notice texts N-01..N-12 (LEG-12), including replacing the microphone permission string and removing the iOS microphone declaration until iOS voice exists (LEG-18 §2.3).
18. Integrate the two deferred privacy branches (`d18e830a` AI context minimization, `1ab01e78` processor inventory) **before** the public texts are frozen; until then LEG-04 §7 and LEG-11 carry caveats.
19. Design and own the out-of-app deletion request (who handles it, identity check without new data, same closure procedure, DSR record) (LEG-08 §3).
20. When acceptance is required (first entry, first action, publish) and what happens on refusal; age declaration mechanism (LEG-13 section 3).
21. Is push part of the first store release (needs FCM/APNs configuration for `rs.uskoci`)? (LEG-11 R-05.)
22. Voice messages between users: shipping status changes the privacy text (LEG-04 §8 marker).

   - **STATUS 2026-10-02: EXISTENCE DECIDED, WORDING OPEN.** Voice messages are mandatory V1 (AGENTS.md 3.5.1). The server package Voice B1 is applied on DEV (ledger 215, 2026-10-01); the client flag is recorded as off. Proposed wording: LEG-12 N-13 and the LEG-04 section 8 paragraph proposal. The owner's text and the iOS microphone text are still open.

23. Keep the public OpenFreeMap tile service or move to a contracted provider (LEG-11 R-07).
24. Ratings: text comment is not implemented; keep the public text to ratings and tags (LEG-02 §23).

   - **STATUS 2026-10-02: DECIDED and server applied.** On 2026-10-01 the owner decided that an optional written comment with the star rating is wanted in V1 (`docs/control/master-plan-live-state.json`, evidence id `OWNER-DECISION-D12-COMMENT-20261001`); the server package was applied on his words "PRIMENI D12 PISANI KOMENTAR" on 2026-10-02 (ledger 221). The advice "keep the public text to ratings and tags" (LEG-02 section 23) is **SUPERSEDED 2026-10-02**. The accepted consequences are in LEG-09 section 7.3.1. No client is confirmed shipped.

25. The server capability for one-time worker location sharing in an Agreement exists but no screen uses it: retire or finish (LEG-09 G-07).
26. Rule for inactive accounts that are never closed (LEG-10).

**D. Verification before publication**

27. Supabase plan, backup/PITR and log retention; whether a separate production project is created (LEG-10 section 5; master plan 17.1).
28. Read the actual release flags (push transport, message target, image review, Q&A classifier, speech, closure worker) at the release candidate (LEG-11).
29. Audit the signed AAB/IPA: merged manifest, privacy manifest, required-reason APIs, licences, exclusion of design routes (LEG-18 §6).
30. Compute and register version + SHA-256 for each published page, including the CRLF/LF question (LEG-13 §5.6).

### 4a. Status of the 30 numbered questions (2026-10-02)

The list above has **30 numbered questions** (A 1-8, B 9-15, C 16-26, D 27-30). Statuses are the team's reading of the repository and of the read-only DEV reads of 2026-10-02; "not re-checked" means the earlier statement was not re-verified in this refresh.

| # | Short title | Status 2026-10-02 | Where it stands |
|---|---|---|---|
| 1 | Operator legal form and data | OPEN | LEG-01 OP-01..OP-05; AF-D10 says the operator is not registered |
| 2 | Domain, hosting, five channels | OPEN | LEG-01 OP-10..OP-16 |
| 3 | Named responsible persons | OPEN | LEG-01 OP-07, OP-21, OP-25, new OP-50 |
| 4 | Countries and audience (18+) | OPEN (not re-checked) | LEG-01 OP-30; LEG-19 NOT-STARTED |
| 4 (update) | Countries and audience (18+) | **DECIDED by the owner 2026-10-02 (R06)**, details still `[[OPERATER]]`/`[[PROVERITI]]` | Serbia first; 18+ with a confirmation added at registration; the list of prohibited work kinds is written by the owner. Still open: the mechanism of the age confirmation (LEG-13 section 5, decision 3) and the operator data (LEG-01 OP-30); LEG-19 stays NOT-STARTED |
| 5 | Governing law | OPEN | LEG-01 OP-20 |
| 6 | Register "ti" or "Vi" | PARTLY DECIDED | in-app "ti"; public texts open |
| 7 | Owner-reconciled RC2 (2026-09-10) | OPEN (not re-searched) | the 2026-08-18 master stays the base |
| 8 | Data Flow Truth and store gates documents | OPEN (not re-searched) | LEG-11 section 0 |
| 9 | Retention periods and exceptions | OPEN | LEG-10 section 6 (12 decisions) and section 7.4 (decisions 13-18) |
| 10 | Legal basis per processing | OPEN | LEG-09, including the new rows P-29 and P-30 |
| 11 | Processor contracts and transfers | OPEN | LEG-11; no new processor since 2026-09-30 |
| 12 | DPIA | OPEN | LEG-09 section 4; now also relevant for the written comment and voice messages |
| 13 | Labour-ministry opinion | OPEN | LEG-02 section 6 |
| 14 | Consumer-law package, ADR | OPEN | no ADR text in the app (re-verified in `src/`, 2026-10-02); LEG-07 sections 5-6 are conditional |
| 15 | Annexes or separate documents | OPEN | the registry still admits only `TERMS` and `PRIVACY` (re-verified) |
| 15 (update) | Annexes or separate documents | **DECIDED by the owner 2026-10-02 (R11)**, details still `[[OPERATER]]`/`[[PROVERITI]]` | The legal registry is an annex of the Terms, not a new document kind. Consent at first entry; no access without consent; 18+. Still true on DEV: the registry admits only `TERMS` and `PRIVACY`, no function publishes a document (EX-07 G07) and no command checks acceptance; the server gate is a separate package that needs its own "PRIMENI" |
| 16 | Manual no-AI path | DECIDED (removed) | see the status line under question 16 |
| 17 | Notice texts N-01..N-12 | OPEN | plus the new N-13, N-14; the microphone permission string is unchanged |
| 18 | Two deferred privacy branches | DEFERRED by the owner | AGENTS.md 4.5: final whole-app privacy pass; caveats KEPT |
| 19 | Out-of-app deletion request | OPEN | still no page, form or intake (EX-07 G14); LEG-15 section 4 |
| 19 (update) | Out-of-app deletion request | **DECIDED by the owner 2026-10-02 (R12)**, details still `[[OPERATER]]`/`[[PROVERITI]]` | Manual processing by the operator; identity checked through the account e-mail address; the web page is published only when the domain exists. Still open: the channel (form or address), the answer deadline, the DSR record and who the operator is (LEG-01 OP-33, OP-53..OP-55); no page, form or intake exists yet (LEG-15 section 4) |
| 20 | When acceptance is required, age mechanism | OPEN | no command checks acceptance (re-verified); LEG-13 section 6.4 |
| 20 (update) | When acceptance is required, age mechanism | **DECIDED by the owner 2026-10-02 (R11, R06)**, details still `[[OPERATER]]`/`[[PROVERITI]]` | Consent at first entry; no access without consent; 18+ confirmation added at registration. Still open: the exact screens and texts, the age-confirmation mechanism and the server-side gate (a command check; separate package, own "PRIMENI"); today no command checks acceptance (LEG-13 section 6) |
| 21 | Push in the first release | OPEN | not re-read |
| 22 | Voice messages | EXISTENCE DECIDED, WORDING OPEN | see the status line under question 22 |
| 23 | OpenFreeMap or a contracted tile provider | OPEN (not re-checked) | LEG-11 R-07 |
| 24 | Rating comment | DECIDED, server applied | see the status line under question 24 |
| 25 | One-time worker location capability | OPEN (not re-checked) | LEG-09 G-07 |
| 26 | Inactive accounts rule | OPEN | LEG-10 decision 7 |
| 27 | Supabase plan, backups, logs | OPEN | LEG-10 section 5 |
| 28 | Release flags | OPEN (not re-read) | Edge environment flags cannot be read from outside |
| 29 | Signed AAB/IPA audit | OPEN | LEG-18 section 6 |
| 30 | Hash and version per published page | OPEN | LEG-13 section 5 |

Rows labelled "(update)" were added on 2026-10-02 after the owner decisions (`docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`); the original row above each of them is kept unchanged as history and the "(update)" row governs. Questions 31, 34 and 35 carry their dated status lines directly under the question (list E below).

**E. Added by the 2026-10-02 refresh (each one is an owner decision; none is answered here)**

31. Closure exceptions: accept and disclose the AF-D22 limit (an account with a support case or safety report, as reporter or as the target, stops at `EXCEPTIONS_PENDING`, no release, no cancel), or define release and retention rules for such evidence (LEG-10 decisions 5 and 15; LEG-14 section 4.2).

   - **STATUS 2026-10-02 (after the owner decisions): DECIDED by the owner (A30), first option.** The owner accepts the closure-exception limit (AF-D22) and will publish it in the public text; nothing is published yet and the text stays DRAFT until legal review. Still OPEN: the release rules (who releases an exception, and by which rule), the deadlines and the retention of evidence for such cases (LEG-10 decision 5 and the remainder of decision 15; LEG-01 OP-56).

32. Support quota scope: accept that `SERVICE_COMPLAINT` and `CONTENT_NOTICE` consume the ordinary quota (5 new cases per 24 hours, 60 seconds apart), or change the exempt list (a certified-function edit that moves the closure certificate), or provide an out-of-app channel (LEG-14 section 4.1).
33. Named support and moderation operator, intake channels, hours, emergency statement and escalation (LEG-01 OP-50..OP-52).
34. D12 communication: whether the shadow comment next to a block and the public aggregate next to individual ratings are disclosed to users; the comment retention period; the moderator; whether the author is notified (LEG-12 N-14; LEG-09 section 7.3.1).

   - **STATUS 2026-10-02 (after the owner decisions): PARTLY DECIDED (A09, A10, A11).** Until the follow-up D12a is applied (it is NOT applied, and no candidate for it exists in the working tree on 2026-10-02) DEV behaves as described in LEG-09 section 7.3.1. A09 will change point 16 (the reviewed person will see the comment when the author blocked them, with the author's face masked, and can report it) and A11 will change point 7 (the comment list becomes role-scoped); both need their own disposable proof and their own "PRIMENI D12a". A10 is accepted: the individual rating stays next to the comment, and NO text may promise anonymity (the sentence that ratings left without a comment stay visible only in the aggregate stays forbidden). Still open: the comment retention period, the moderator, whether the author is notified and the legal basis (LEG-12 N-14; LEG-09 section 7.3.1).

35. Voice message retention and withdrawal, and the notice N-13 (LEG-10 decision 13).

   - **STATUS 2026-10-02 (after the owner decisions): PARTLY DECIDED (A04, A05).** A05: "deleting" a voice message means discarding it before sending plus erasure at account closure, and that is enough for V1; withdrawing a message after it was sent is not a V1 function, so it is no longer an open question. A04: in the first release support cannot hear a reported voice message; this is written down as a known limitation and no text may suggest that support listens, not even manually (the word "automatski" in the earlier proposals is superseded in LEG-04 section 8, LEG-12 N-13 and LEG-14). Still open with counsel (R10): the retention period and form of the voice objects and upload rows, the legal basis, and the wording of the notice N-13 (LEG-10 decision 13; LEG-09 section 7.5).

36. Export scope: whether the export must include what others wrote about the person, whether the closure relations the export does not read are added, and the three export lifetimes (LEG-15 sections 3.4 and 8).
37. Rights requests without an account: operator, identity check, DSR record and deadline (LEG-01 OP-53..OP-55; LEG-15 section 4).
38. Whether acceptance of the Terms and Community Rules is a precondition for user-generated content (comment, voice message, report) (LEG-13 section 6.4).


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

### 5a. Tracker annotations: state 2026-10-02

**Not applied.** `docs/control/redovi.json` is the only status registry and is not a file of this folder, so none of the annotations below was applied; the root decides. They replace the table above where the facts moved:

| Row | Annotation (refreshed 2026-10-02) |
|---|---|
| N04 (legal documents and consent) | Reference this folder (LEG-02/04/05/07/08 drafts, cut to implemented behaviour 2026-10-02); status stays "waits for operator data and counsel". Acceptance is required by no command (re-verified); registration still shows a test-version line; 0 documents and 0 acceptances on DEV; no function writes the document registry (publication procedure missing). |
| N07 / N08 (report, support) | LEG-05 / LEG-07 cut to implemented behaviour (no priority handling, no suspension, no ADR text in the app, decisions have effect NONE); LEG-14 drafted. Still missing: named operator, channels, hours, emergency statement (0 operator grants, 0 cases, 0 reports on DEV). Quota scope differs from the accepted contract (LEG-14 section 4.1). |
| N09 (export) | Generation needs an active Privacy document and a retention schedule WITH the `export_delivery` binding for all 15 classes; projection `OWN_ACCOUNT_V5_10` (52 datasets); the processor map is not a precondition; no function publishes the binding. Export versus closure map: LEG-15 section 3 (40 closure relations are not read by the export; what others wrote about the person is not exported). |
| N10 (account deletion) | Closure does not depend on the retention schedule (event-bound adapter, `legalPolicyAttested` false), but the out-of-app path is missing (LEG-08 section 3) and an account with a support case or safety report (reporter or target) stops at `EXCEPTIONS_PENDING` with no release and no cancel (LEG-10 section 7.5; LEG-14 section 4.2). Never run on DEV (0 executions). |
| N11 (privacy and retention) | Findings G-01, G-02, G-05 and the retention decisions (LEG-10 section 6 and 7.4); the two privacy branches are deferred (AGENTS.md 4.5) and the LEG-04 section 7 and LEG-11 caveats are KEPT. |
| N02 (registration, email) | Email sender undecided (LEG-11 R-08); unchanged. |
| A03 (voice in conversation) | Dictation permission string mismatch unchanged (LEG-12 N-03, LEG-18 section 2.3); voice messages (Voice B1) need their own notice N-13 and microphone text. |
| A02 / B00 (AI conversations) | No pre-use notice for text AI; no manual alternative (LEG-12 N-01, N-02); unchanged. |
| P02 / P04 (notifications, sending) | Not re-read. |
| D12 (written comment) | The registry text "Pisani komentar ostaje poseban, neprimenjen server/schema/privacy/moderation paket" is STALE since 2026-10-02 (applied, ledger 221). Legal inputs stay open: basis, DPIA, retention period, moderator, author notification; the 12 owner-accepted consequences are in LEG-09 section 7.3.1. |
| "prodavnice" section | Privacy URL, terms/support URL and data forms: still NIJE; inputs prepared in LEG-01/09/11/12/18 and in `docs/implementation/release-prep-20260930/DATA_DECLARATIONS_DRAFT.md` (whose D12 note is also stale; not a file of this folder). |


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


### 6a. Files added or changed 2026-10-02

```
docs/implementation/legal-drafts-20260930/
  CHANGELOG_20261002.md                                  (new)
  LEG-14_moderacija_i_podrska_operativni_postupci.md     (new)
  LEG-15_zahtevi_lica_i_izvoz_nacrt.md                   (new)
  README.md, LEG-01, LEG-02, LEG-04, LEG-05, LEG-07, LEG-08,
  LEG-09, LEG-10, LEG-11, LEG-12, LEG-13                  (additive, dated edits)
  LEG-18_sdk_permission_inventory.md                     (not touched)
```

## 7. Suggested order of work

1. Owner supplies LEG-01 data and answers questions 1-8 (unblocks every public text).
2. Counsel reviews LEG-09/10/11 (bases, retention, contracts) and answers 9-15.
3. Owner decides the product items 16-26; the two deferred privacy branches are integrated and the registers re-read (LEG-09 section 6, LEG-11 section 6).
4. Remove all `[[...]]` markers and the traceability appendices, publish pages, compute hashes, register versions (LEG-13).
5. Fill LEG-16/17 from the final registers and the audited release artefact (LEG-18 section 6).

### 7a. Suggested order of work (refreshed 2026-10-02)

1. The owner supplies the LEG-01 data including OP-50..OP-57 and answers questions 1-8 (unblocks every public text).
2. Counsel reviews LEG-09, 10, 11, 14 and 15 and answers 9-15 and 31-32.
3. The owner decides the product items 16-26 and 33-38; the two deferred privacy branches are integrated at the final privacy pass and the registers are re-read (LEG-09 section 6, LEG-11 section 7.2).
4. Re-run the LEG-15 map whenever one of its five pinned functions changes (LEG-15 section 3.1).
5. Remove all `[[...]]` markers and the traceability appendices, publish the pages, compute hashes, register versions (LEG-13).
6. Fill LEG-16/17 from the final registers and the audited release artefact (LEG-18 section 6).

## 8. Evidence and limits of the 2026-10-02 refresh

- **What was read:** the repository at HEAD `0b9cd8c9` (branch `work/uskoci-ui-unification-20260924`) and canonical DEV `leqcwgzvjsxugfgzdmth` through read-only SELECT statements (counts, CHECK constraints, column lists, function and trigger metadata, function bodies and their md5, storage bucket configuration, the retention class texts, the export dataset catalog and the closure roster). No write, no DDL, no personal data and no user text.
- **Live numbers recorded:** ledger 221; certificate `0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431` (certified = live = bound, ready, 0 closures executing); 15 retention classes; closure catalog 107 relations, 76 in the roster, 31 outside (the scope record of 2026-10-01 says 106 and 75 because it predates D12); export projection `OWN_ACCOUNT_V5_10`, 52 datasets; 0 legal document versions, 0 retention policy sets, 0 processor map sets, 0 export artifacts, 0 support cases, 0 safety reports, 0 operator grants, 0 closure executions, 0 review comments, 0 voice uploads, 7 star reviews.
- **Not verified:** Edge function versions and environment flags (last recorded in the 2026-10-01 receipts); the Supabase Auth dashboard; the state of any client (flags, screens); hosted behaviour (no HTTP/JWT call of the new functions was made, nothing was exercised: 0 comments, 0 voice uploads, 0 cases); an actual closure or export (none has ever run on DEV). The LEG-15 relation map compares relation names and column names; it is not a per-dataset review and not a legal conclusion.
- **Not changed:** `docs/control/**`, the registry, any code, migration, candidate, proof, workflow, `AGENTS.md`, the release-prep folder and every file outside this folder.
