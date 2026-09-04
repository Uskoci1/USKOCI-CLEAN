# USKOČI — RS PUBLICATION POLICY V1 RECONCILIATION

Status: `CANDIDATE / NO LIVE EFFECT`

## A. Owner-lockable platform/publication rules

These can be locked as USKOČI platform rules without claiming that every underlying activity is illegal under Serbian law:

- ordinary clear service Need is supported;
- classified sale/rental listings are not USKOČI inventory;
- spam, promotion, referral and unrelated advertising are not USKOČI inventory;
- financial/investment/credit/crypto solicitation is not USKOČI inventory;
- gambling/betting promotion is not USKOČI inventory;
- public profanity/vulgarity must be cleaned before publication;
- targeted harassment, humiliation, threats, violence and hateful abuse are not publishable;
- stalking, surveillance abuse and doxxing are not publishable;
- theft, fraud, forgery/evasion objectives are not publishable;
- exploitative sexual/trafficking/minor sexual content is not publishable;
- public exact contact/address/QR/identity-document leakage must be removed before publication;
- protected-trait preference is not an ordinary matching requirement; objective capability requirements are allowed;
- HITNO never bypasses publication policy;
- a content BLOCK is not automatically an account ban.

Primary archive support: V0.1 Allowed/Restricted/Prohibited + Safety/Community; V0.2 Task Gate; RC1/RC2 Safety/Moderation; later owner D-0140 decisions.

## B. Strong archive-supported V1 blocks

Archive research/product work already points strongly to a fail-closed launch position:

- illegal drugs / controlled-substance bypass — BLOCK;
- weapons/ammunition ordinary marketplace — BLOCK;
- pyrotechnics — BLOCK;
- tobacco/nicotine — BLOCK;
- controlled/narcotic medicine circumvention — BLOCK;
- known prohibited/dangerous transport contents — BLOCK.

These remain framed as USKOČI admission rules; any specific legal statement exposed to users must use approved wording/provenance.

## C. Keep non-publishable pending professional closure

Current candidate outcome is `REVIEW`, which means **no publication in V1** until the category has a reviewed operational/legal model:

- alcohol procurement/delivery;
- prescription pickup for another person;
- ordinary OTC pickup until conditional rule is closed;
- rubble/waste disposal and hazardous/special waste;
- passenger transport for compensation;
- systematic courier/postal service pattern;
- medical/health procedures;
- regulated professional services whose admission rule is not closed;
- childcare/vulnerable-person care beyond ordinary adult accompaniment;
- private security/guarding;
- employment/staffing patterns;
- large cash/advance/third-party money handling or official/legal act for another person;
- uncategorized clearly high-risk requests.

`REVIEW` must not promise that a human will review the case. Until a real queue/authority/audit exists, it means fail-closed/not publishable.

## D. Important distinctions preserved from the archive

### MOVE_ITEM != DISCARD_ITEM
Moving a television to another address can be an ordinary service Need. Discarding e-waste activates the waste boundary.

### One-off errand != courier product
A one-off handoff of an ordinary lawful item/key/document can be allowed. A standardized shipment-intake/tracking/SLA/COD/delivery product activates postal/courier review.

### Ordinary task != staffing/employment pattern
A one-off concrete task is not automatically employment. Business requester + repeated continuity + many workers + fixed shifts/control/discipline activates labor/staffing review.

### Objective capability != protected-trait preference
"Potrebno je podići 40 kg" can be a legitimate task requirement. "Hoću muškarca" is not an ordinary eligibility filter and must not be preserved covertly.

### Publication != performer licensing certification
Publication policy decides whether the Zadatak may appear on USKOČI. It does not certify that a later performer has every licence, permit, tax status, insurance or right-to-work condition unless USKOČI explicitly verifies that specific fact.

## E. Immediate technical consequence

The current B05 schema stores bundle metadata and rule references only. Before activation we still need a versioned rule-content registry/evaluator contract that can deterministically map structured Need facts to the rule IDs in `rs_publication_policy_v1_candidate.json`.

No production bundle should be activated and no production ALLOW should be issued from this candidate until that evaluator contract and review gates are proven.
