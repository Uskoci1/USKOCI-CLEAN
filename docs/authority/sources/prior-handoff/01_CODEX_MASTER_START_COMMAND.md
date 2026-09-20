# USKOČI — CODEX PRODUCT COMPLETION MASTER
## EXISTING PRODUCT · SPOJ V2 NATIVE PARITY · REUSE-FIRST · 80/20 IMPLEMENTATION · CONTINUOUS SAFE INTEGRATION

Ovo je DIREKTAN NASTAVAK postojećeg USKOČI proizvoda. Ne pravi greenfield, novi MASTER ni novi audit umesto implementacije. Preuzmi stvarni najnoviji proizvod i kontinuirano KODIRAJ, POVEZUJ, DOVRŠAVAJ, TESTIRAJ PAMETNO, MERGE-UJ i, gde je bezbedno, PROMOVIŠI backend infrastrukturu na live dok proizvod ne bude funkcionalno i vizuelno završen.

## 1. ULAZI I AUTHORITY
U workspace-u su tri ZIP-a:
1) `USKOCI_SPOJ_V2_KOMPLETAN_PAKET.zip` — visual/motion/surface authority. `prototype/USKOCI_SPOJ_V2.html` je aktivna vizuelna referenca. HTML mock/demo business ponašanje NIJE backend authority.
2) `USKOCI_KOMPLETAN_PLAN_2026-09-08.zip` — W00–W13 scope/dependencies/acceptance. Verifikuj SHA256.json i čitaj relevantne delove plana pre svakog većeg batch-a, ne ceo istorijski audit svaki put.
3) `USKOCI_CODEX_HANDOFF_2026-09-10.zip` — current cursor hint, owner batch/turbo overrides, reuse/donor rule i provider checklist.

Repo: `Uskoci1/USKOCI-CLEAN`
Canonical: `clean-alpha-backend`
Supabase: `leqcwgzvjsxugfgzdmth`

Prvo fetch/clone i fizički utvrdi najnoviji canonical HEAD, open/merged PR-ove, worktree, migration inventory, Edge Functions i live Supabase prefix. Handoff SHA je samo hint. Ako je projekat otišao dalje, nastavi od novijeg stvarnog stanja.

Business source-of-truth: latest explicit owner decisions → current CLEAN canon/contracts → master plan → verified implementation → donor samo kao reusable foundation.
Visual source-of-truth: SPOJ V2 → latest approved design decisions → već verno implementiran native UI.
Ako HTML i backend imaju konflikt: zadrži vizuelnu nameru HTML-a, ali koristi stvarni CLEAN domain/backend authority.

## 2. GLAVNI CILJ — ZAVRŠI TOKOVE
MENI TREBA: intro/intent → auth → AI/ručni unos → Need draft → real location/REMOTE → review → publication evaluator → bezbedna objava → lista/mapa → Q&A gde je dozvoljen → Prijave → izbor → Dogovor → Poruke → izmena/otkaz → završetak → ocena.

JA MOGU: intro/intent → auth → AI/ručni profil → skills/tools/vehicles/licenses/resources → service geography/radius → availability/Available Now → calendar → Zadaci → matching/discovery/map → Prijava → izbor → Dogovor → Poruke → završetak → reputacija.

SYSTEM: Inbox → push → safety/report/block/moderation/appeal → account closure → data export fulfillment → privacy/legal consent → retention execution → media/storage cleanup → operations/admin → release/store readiness.

Ne meri napredak brojem tabela, RPC-jeva, proof fajlova ili Markdown-a. Meri da li stvarni korisnički tok radi kroz aplikaciju i stvarni server authority.

## 3. SPOJ V2 → NATIVE REACT NATIVE
Ne koristi WebView kao finalno rešenje. Prenesi SPOJ V2 u postojeći Expo/React Native stack kao prave native komponente.

Obavezno pročitaj: `00_READ_FIRST.md`, `prototype/USKOCI_SPOJ_V2.html`, `docs/DESIGN_SYSTEM.md`, `docs/MOTION_SPEC.md`, `docs/NATIVE_TRANSFER.md`, `docs/BINDING_GUIDE.md`, `contracts/SCREEN_CONTRACTS_66.json`, `contracts/BINDING_MATRIX_66.json`, `contracts/FUNCTION_STATUS_186.json`, `docs/QA_ACCEPTANCE.md`, `native-starter/**`, `motion/**`, `assets/**`.

Originalni znak/lockup/intro NE crtati ponovo od oka. Reuse SVG/geometriju/timeline. Ulaz: veliki znak centralno malo iznad sredine, bez odletanja gore-levo; originalna animacija/namig/lockup; ispod „Meni treba. Ja mogu.“

Navigacija: MENI TREBA `Zadaci | U/Novi | Dogovori`; JA MOGU `Prijave | U/Zadaci | Dogovori`; zvonce→Inbox; avatar→Profil; Zadaci→Lista/Mapa; Dogovor→tačno `Pregled | Poruke`. Ne vraćaj stare Home tabove.

Vizuelni cilj: svetao, premium, ljudski marketplace; bez generičkog AI dashboard-a, neon efekata, slučajnih gradijenata i pretrpanih kartica. Implementiraj UI paralelno sa funkcijom. Ako SPOJ V2 ima očigledan UX problem, navedi kratko problem/predlog i pitaj owner-a samo ako je odluka stvarno neophodna.

## 4. REUSE-FIRST
Za svaki capability fizički proveri CLEAN/services/contracts/migrations/proofs i relevantne donore:
`REUSE EXISTING CLEAN → PORT/ADAPT VERIFIED DONOR → EXTEND EXISTING CANONICAL MODEL → WRITE NEW ONLY IF NECESSARY`.

Zabranjeno: paralelni calendar/location/profile/task model, duplicate tabela, blind donor copy, superseded semantika, menjanje istorijskog Application snapshot-a nakon izmene profila. Donor lineage zabeleži u postojećem provenance/ledger mehanizmu, ne u novom MASTER-u.

## 5. 80/20 IMPLEMENTATION MODE
Default obrazac `mala izmena → full npm → full replay → W01 → W02 → P2 → P3 → Android` je zabranjen.

Radi: `VEĆI KOHERENTAN BATCH → fast relevant checks → server+client+route/state+UI → jedan domain proof → merge → safe live promotion ako je primenljivo → postflight → sledeći batch`.

Tokom rada: TypeScript, relevant unit/contract/service test, relevant SQL admission, relevant privacy/security regression, build sanity samo kad je pogođen build/native. Android emulator/full W01/W02/P2/P3/historical reconstruction samo kad ih batch stvarno pogađa ili na velikom milestone/release gate-u. Nijedan postojeći proof ne briši.

## 6. GIT DISCIPLINA
Ne radi direktno na canonical-u. Ne force-push. Sačuvaj tuđe izmene. Koristi coherent batch branch. Checkpoint commit ne zahteva novi PR/full CI. PR tek na smislenoj review granici. Ne koristi komplikovane source-transfer/capsule rituale ako normalan branch/commit/PR radi. Očisti temp workflow/debug/mock pre merge-a.

Na početku posebno proveri PR #87 i sve novije PR-ove. Snapshot kaže da #87 tada nije bio gotov za merge; veruj trenutnom sadržaju, ne snapshot-u.

## 7. SUPABASE / LIVE
Applied migracije immutable; nove forward-only. Bez blind db push-a.

Za završen backend batch: exact canonical HEAD → fresh live prefix → order/checksum/raw bytes → no modified history → targeted disposable proof → no drift → merge → fresh live re-read → apply tačno dokazani forward batch → live smoke/postflight → continue.

LIVE != ACTIVATED. Schema/RPC/Edge može biti live dok capability ostaje gated.

Ne aktivirati bez uslova: positive charging, checkout/wallet/escrow/payout, blanket D0140 ALLOW, provider bez secret-a, fake verification, javni launch bez potrebnih pravnih/operator podataka. Platform fee = 0 RSD. HITNO ostaje FREE/0 RSD po owner canon-u i nikad ne zaobilazi safety.

## 8. LOCATION
Reuse postojeći W02 geography model. NON-REMOTE: text/AI/manual input → provider-neutral resolver → real candidate → map/pin-ready result → explicit confirmation → canonical resolved location. Exact address/coordinates PRIVATE; public samo privacy-safe approximate projection. Selected participant exact lokaciju dobija kroz confirmed Dogovor authority.

Worker: confirmed service base/area + radius, bez obavezne kućne adrese. Manual location mora raditi bez OS GPS permission. REMOTE ne zahteva GPS.

Ako geocoder/map provider nije odobren: završi provider-neutral boundary + manual/remote tok; blokiraj samo provider activation, ne ostatak proizvoda.

## 9. CALENDAR / AVAILABILITY — REUSE
Ne prepravljaj foundation. Samo confirmed exact start/end blokira worker-a. Flexible day/week/unknown time ne blokira dan. Requester može imati više različitih workera istovremeno. Flexible→exact tada proverava konflikt. Cancel/completion oslobađa interval. Available Now je discovery/notification intent, nije booking ni HITNO. OFF ne zabranjuje ručni marketplace browsing/apply. Poveži SPOJ UI na postojeći authority.

## 10. AI NEED — STVARNI PRODUCTION PUT
Ne pravi drugi AI engine. Reuse `ai_conversations`, `ai_messages`, `ai_structured_facts`, Need V2 review/save/edit authority, `uskoci-ai-interview` i postojeće provider adaptere.

Završi: authenticated user message → server-side provider call → stable request/turn id → timeout/error handling → schema-validated model suggestion → persisted message/facts → correction/supersession → review → human confirmation → server validation → real Need draft.

User message != model suggestion != confirmed business fact. AI ne objavljuje automatski, ne izmišlja confirmed location/licence/cenu/skill/verification/rating. Retry bez dupliranja. Account-switch isolation obavezan.

Media: real storage lifecycle, retry/failure, orphan cleanup. Voice: ako provider/prerequisites postoje, voice→server transcription→isti conversation flow; ako ne, bezbedan boundary i nastavi. OpenAI secret traži od owner-a tek kad je ostatak real-provider puta spreman.

## 11. AI + MANUAL WORKER PROFILE
AI i manual editor završavaju u ISTOM authoritative profile modelu. Skills/tools/vehicles/licenses/resources/team gde je relevantno/service geography/radius/availability/Available Now. Ne pitaj svakoga za nerelevantne podatke. `Profile ACTIVE`, `eligible for task`, `recommendations-ready` i `push-capable` nisu isto. Kasnija izmena profila ne menja istorijski Application snapshot.

## 12. PUBLICATION / D0140 / Q&A
Završi: Need draft → evaluator → policy result → safe publication → public Need → discovery/matching. D0140 ostaje safety authority; bez blanket ALLOW. Implementiraj dozvoljene tokove fail-closed za ostalo. Q&A poveži kada authority/rate uslovi postoje; ako stvarni spoljašnji input nedostaje, završi tehnički deo i precizno označi activation blocker.

## 13. DISCOVERY / MAP / MATCHING
Poveži SPOJ Lista/Mapa UX na stvarni backend. Matching koristi authoritative requirements, capabilities/resources, geography/radius/remote, availability, confirmed calendar occupancy, safety/block state i HITNO priority kada je dozvoljeno. Ne izmišljaj score podatke.

Mapa: provider-neutral dok provider nije odobren; premium pin styling prema SPOJ/design handoff-u; public pin ne otkriva exact address; omogući „dodaj Zadatak“ iz map konteksta prema odobrenom UX-u.

## 14. PUSH
Ne stati na events/deliveries/devices/attempts. Završi provider-neutral dispatcher: event → delivery → claim/lease → Expo/FCM/APNs send prema current architecture → receipt → retry/backoff → dead/invalid token cleanup. Supabase ostaje backend authority. Pravi device proof tek kada credentials postoje i transport je implementiran.

## 15. APPLICATION / SELECTION / AGREEMENT
Reuse postojeće proven tokove; ne prepisuj ih bez razloga. Poveži finalni SPOJ UI i zatvori sve loading/error/stale/session/network states.

Selection mora ostati concurrency-safe, calendar-safe, block/safety-safe i idempotent gde je potrebno. Agreement: tačno Pregled|Poruke, izmene/versioning, poruke, otkaz, completion, event emission. Historical snapshots immutable.

## 16. REVIEWS / REPUTATION
Završi realno: completed Agreement → bilateral review eligibility → jedna ukupna account reputacija + role-context breakdown → REVIEW_RECEIVED event → read projections → profile display contract/UI. Spreči duplikate/self-review/neeligible review.

## 17. SAFETY / SUPPORT / MODERATION
Završi: report → block → zabrana novog contact/matching/application → evidence preservation → moderation queue → temporary restriction → permanent sanction uz human review → appeal. Safety ima prioritet nad turbo režimom. Reuse RC2/Safety foundations gde postoje.

## 18. DATA EXPORT P2 — CEO TOK
Ne ostavljaj request/status/cancel. Završi koherentno: request → PROCESSING → allowed-data snapshot → export artifact → secure PRIVATE storage → owner-only short-lived delivery/download → READY → expiry → cleanup → retry/failure → audit. Bez public bucket-a, fake READY, beskonačnih artifact-a i cross-account pristupa.

## 19. RETENTION P3
Registry nije kraj. Implementiraj enforcement/execution prema već supplied owner/lawyer-reviewed pravilima. Legal hold ima prioritet. Reuse postojeći registry/authority; ne izmišljaj novu retention politiku.

## 20. ACCOUNT CLOSURE
Završi: user request → stop new marketplace activity → active Agreements resolution requirement → deletion/anonymization → retention exceptions/legal hold → storage cleanup → closure state → audit. Ne ostavljaj samo schema foundation.

## 21. RC2 LEGAL / CONSENT
RC2 je source za public Terms/Privacy/Safety/Support. Ne generiši nove generičke tekstove od nule. Ekstraktuj/finalizuj user-facing sadržaj, ukloni interne checkliste/source notes/benchmark napomene. Operator identity placeholders ne blokiraju engineering closure, ali public launch može ostati gated dok nedostaje stvarni operator podatak. Poveži consent/version acceptance sa auth/account tokom.

## 22. HITNO / MONEY
HITNO treba da postoji kao FREE/0 RSD launch capability prema current owner canon-u: ranking/dispatch/push priority/distance-availability weighting, bez safety bypass-a. Payment architecture ostaje future-ready, ali platform charging=0 RSD i checkout OFF. Task money ide direktno između korisnika u MVP/launch modelu dok owner ne promeni odluku.

## 23. OPERATIONAL / ADMIN / RELEASE
Završi minimalni stvarni ops/admin boundary potreban za moderation, failed jobs, export/retention/account operations i diagnostics. Ne pravi nepotreban enterprise dashboard.

Na velikom milestone-u pokreni JEDAN full gate: full TS/regression, migration replay/order/checksum, RLS/grants/account isolation/privacy/concurrency, P1/P2/P3/P4/D0140, W01/W02, notifications, AI, push, account, CodeQL, Android i relevantne physical-device journeys. Popravi konkretne kvarove i ponovi full gate tek na toj granici.

Release: production build/signing, privacy declarations, store checklist, runbook, crash diagnostics, no secrets in client, no positive charging, no privacy leak.

## 24. STATUSI — NIKAD IH NE MEŠAJ
Za svaki capability vodi samo u postojećem ledger-u:
`WRITTEN / MERGED / LIVE / UI_CONNECTED / PROVEN / ACTIVATED / DEVICE_PROVEN / STORE_READY`.

Ne tvrdi LIVE ako je samo source. Ne tvrdi ACTIVATED ako je provider/policy gated. Ne tvrdi PROVEN samo zato što build prolazi.

## 25. DOKUMENTACIJA — MINIMUM
Ne pravi paralelni MASTER. Koristi postojeći progress ledger. Ako SPOJ binding matrix može da se ažurira bez menjanja visual authority-ja, koristi je kao mapu `surface → native component → real service → backend authority → status`.

Dokumentacija je nusproizvod implementacije, ne glavni output.

## 26. KADA DA PITAŠ OWNER-A
Ne zaustavljaj se između normalnih koraka. Pitaj samo ako postoji stvarna nova odluka ili spoljašnji prerequisite koji ne možeš bezbedno zaključiti:
- missing production secret;
- izbor provider-a koji nije odobren;
- operator/legal factual value;
- destruktivna/nepovratna production akcija van već odobrenog promotion procesa;
- neusaglašiv source-of-truth konflikt;
- UX odluka koja stvarno menja product semantics.

Pitanje mora biti kratko i operativno: šta tačno treba, zašto, gde se konfiguriše i šta ćeš nastaviti čim dobiješ odgovor. Dok čekaš odgovor, nastavi sav nezavisan rad.

## 27. POČETNI EXECUTION REDOSLED
Nemoj mi prvo vratiti veliki plan. Uradi kratak readmission i odmah kodiraj.

1. Fetch current canonical/live; pročitaj sva tri paketa dovoljno da razumeš authority.
2. Pregledaj PR #87 i novije radove; sačuvaj korisno, odbaci temp/failed-transfer otpad.
3. Zatvori preostali W02/location/regional authority kao jedan coherent batch, uključujući provider-neutral resolved geography seam i SPOJ native binding koji ne zahteva neodobren provider.
4. Targeted proof → PR/merge → safe live promotion samo za tačno dokazani backward-compatible migration prefix → postflight.
5. Zatim idi na najveće stvarne product rupe, ne na mikro-audite: publication/evaluator, P2 export fulfillment, retention execution, AI production path, push, account/safety/reviews, prema dependency-ju i onome što CLEAN već ima.
6. Paralelno gradi native SPOJ V2 surface-e i povezuje ih na stvarne servise. Ne pravi 66 mrtvih ekrana; radi vertikalne tokove i shared components, pa širi coverage.
7. Kad naiđeš na secret/provider blocker, pitaj owner-a jednom i nastavi nezavisan batch.
8. Na velikom closure milestone-u odradi full integrated gate, zatim controlled live promotion/postflight i nastavi do store-ready stanja.

## 28. PRVI VERTIKALNI NATIVE TOK
Kao prvi vizuelno-funkcionalni cilj dovedi do production kvaliteta:
`Intro/Intent → Auth → Zadaci → Task detail → Apply/Application → Selection → Agreement Pregled/Poruke`, koristeći shared native components i stvarne CLEAN servise.

Paralelno zatvori `AI Need → Review → Draft → Location confirmation → Publication` čim backend prerequisites dozvole. Time dobijamo stvarnu aplikaciju, ne galeriju ekrana.

## 29. FINALNA DIREKTIVA
Radi kao PRODUCT COMPLETION ENGINE.

ZAVRŠAVAJ.
POVEZUJ.
REUSE-UJ.
KODIRAJ VIŠE NEGO ŠTO AUDITUJEŠ.
TESTIRAJ CILJANO TOKOM RADA.
MERGE-UJ KOHERENTNE BATCH-EVE.
PUŠTAJ BEZBEDNU INFRASTRUKTURU LIVE KADA JE DOKAZANA.
NE AKTIVIRAJ ONO ŠTO NEMA USLOVE.
NE ČEKAJ NOVO „NASTAVI“ IZMEĐU NORMALNIH JEDINICA.

Ako nešto fali u dizajnu ili funkciji, prvo proveri CLEAN + SPOJ + master + donor. Ako i dalje postoji stvarna odluka, predloži najbolje rešenje i pitaj owner-a. U svim ostalim slučajevima — implementiraj.

POČNI SADA OD STVARNOG NAJNOVIJEG STANJA.
