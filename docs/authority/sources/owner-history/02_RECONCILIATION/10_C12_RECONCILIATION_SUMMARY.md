# USKOČI — C12_n CONTINUATION CHAIN RECONCILIATION — WORKING CHECKPOINT

**Mode:** READ-ONLY forensic/semantic reconciliation.  
**GitHub/Supabase/RN writes:** NONE.  
**Final authority:** later final 21/21 owner decisions. C12_n is lineage/provenance and salvage input only.

## 1. Chain closed
- Logical revision nodes: **43** = CHECKPOINT + C12_1…C12_36 + C12_37_1…C12_37_6.
- Physical Library ZIP copies materialized: **86**.
- A/B physical pairs byte-identical by ZIP SHA-256: **43/43**.
- ZIP CRC/testzip: **PASS 86/86**.
- Logical internal entries across 43 primary copies: **7516**.
- Physical internal entry occurrences across 86 ZIP copies: **15032**.

## 2. Ledger append
Base count supplied at checkpoint: **1,564**.  
This pass adds:
- ZIP container rows: **86**;
- physical ZIP-entry rows: **15032**;
- total append: **15118**.

**Working exhaustive ledger count after this C12 ZIP-chain append = 16682.**

This count covers the ZIP containers and every internal entry exactly as required. SHA sidecar files are provenance artifacts for the later Library-wide physical-artifact pass and are not silently included in this number.

## 3. Hash-delta findings
The chain is cumulative until C12_37_5. No entry removals occur before that stage. C12_35 adds the ten visual reference PNGs; C12_37_5 removes those ten binaries from the ZIP while retaining the semantic visual-reference lineage. Physical removal is recorded as provenance, not interpreted as deletion of historical evidence.

Late-stage delta highlights:
- C12_35: 13 NEW, 12 MODIFIED — includes D-0138/D-0139 and ten visual boards.
- C12_36: 5 NEW, 11 MODIFIED — adds 118/119/120 functional-truth and screen-closure artifacts.
- C12_37_1: 2 NEW, 11 MODIFIED — D-0140.
- C12_37_2: 2 NEW, 11 MODIFIED — D-0141.
- C12_37_3: 2 NEW, 9 MODIFIED — D-0142; D-0050 superseded.
- C12_37_4: 2 NEW, 3 MODIFIED — D-0143; D-0051 superseded.
- C12_37_5: 2 NEW, 12 MODIFIED, 10 REMOVED — D-0144 + visual binary removal.
- C12_37_6: 2 NEW, 10 MODIFIED — D-0145.

## 4. Internal manifest verification
All ZIPs themselves are readable and pass testzip, but **internal 116 manifests are not uniformly trustworthy**.
- Stages with manifest mismatch: **5**.
- Manifest size mismatch rows: **52**.
- Manifest SHA mismatch rows: **42**.
- Missing manifest paths: **0**.

Important: this is **manifest staleness/inconsistency**, not ZIP corruption. See `05_C12_MANIFEST_DEFECTS.csv` for exact paths/hashes.

## 5. Decision-register integrity defect
C12 validation reports sometimes state that a decision was locked and documentation synchronized while the machine-readable CSV remained stale. Confirmed examples:
- **D-0069**: C12.4 Markdown/validation = OWNER_LOCKED; later CSV continues to say NEEDS_OWNER_DECISION.
- **D-0053**: Markdown = OWNER_LOCKED; final C12 CSV remains stale/open.
- C12.36 later rewrites several CSV status fields to `RECONCILED_*`/`SUPERSEDED_*`, while the Markdown table keeps older statuses.
- D-0140…D-0145 exist in the CSV and MD narrative/owner-lock sections, but are not represented as rows in the final Markdown table parser.

Therefore neither 105 CSV nor 105 Markdown is accepted alone as current truth. Their conflicts are retained in `09_C12_FINAL_REGISTER_MD_CSV_DIVERGENCES.csv` and resolved only through later owner authority / 21-of-21 canon.

## 6. Semantic reconciliation to final 21/21
Key surviving/remapped outcomes:
- **D-0145 KEEP:** no Krećem/Stigao/Počinjem canonical milestone state machine; `Završio sam` remains in final completion flow.
- **D-0144 KEEP:** active physical Dogovor may use explicit current-location snapshot with Worker consent; no background/live tracking.
- **D-0143 KEEP:** one event = one S06 inbox item, server event-level read state, explicit mark-all, stale-tap revalidation.
- **D-0142 KEEP:** near-me GPS transient only; saved work area explicit; REMOTE has no physical radius/pin.
- **D-0140 KEEP:** AI cannot invent publish safety/legal policy; server versioned policy authority fails closed when uncertain.
- **D-0141 DEFER_POLICY:** evidence/hold retention distinction survives; exact retention period is not invented.
- **D-0118 REMAP:** bounded settled-viewport refresh survives; old `Pretraži ovu oblast` action does not.
- **D-0121 SUPERSEDE presentation:** old stacked map+list primary layout is replaced by final W03 `Lista | Mapa`; synchronized data/context invariant survives.
- **D-0063/D-0078/D-0080 replacement lineage:** separate ReplacementEntitlement/countdown/marketplace is not restored. Salvage only same-Zadatak missing-capacity + cost-zero/idempotent ledger provenance compatible with final normal `Prijava → Selection` recovery.
- **D-0139 visual evidence REMAP:** boards stay donor/provenance; final V1 is LIGHT-FIRST Warm Dawn/brighter urban, not dark/noir/deep-green-dominant.
- **D-0117 DEFER_PAID / D-0075 KEEP:** V1 remains FREE/0 RSD with checkout disabled; future paid architecture requires separate authority.

Full per-decision treatment is in `07_C12_SEMANTIC_DECISION_RECONCILIATION_21_21.csv`.

## 7. C12.36 provenance treatment
`118/119/120` are useful forensic/gap artifacts, but their 30-screen universe, old role vocabulary and dedicated Replacement assumptions are **not current authority**. Final 21/21 overrides them with:
- 28 functional surfaces;
- `Zadatak → Prijava → Dogovor`;
- MENI TREBA / JA MOGU ordinary UI;
- final Dogovor `Pregled | Poruke` with chronology embedded;
- same-Zadatak missing-capacity recovery without separate user-facing Replacement subsystem.

## 8. Next exhaustive layer
C12_n chain is now structurally/hash reconciled and semantically mapped. Next read-only unit is the **27-Aug CLEAN continuation ZIP lineage**, then S01/S02/S03/S04 reference/build ZIPs, HTML reference lineage, Need visual lineage, Pass 06/08/09/10, and remaining unique technical/decision artifacts. No FINAL declaration yet.
