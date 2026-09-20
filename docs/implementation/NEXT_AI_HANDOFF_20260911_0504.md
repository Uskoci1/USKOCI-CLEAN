# USKOČI — SAFE HANDOFF

Snapshot: 2026-09-11T05:17:57.138Z (UTC). Samodovoljna predaja trenutnog stanja; bez novog razvoja.

## CURRENT CANONICAL

Repo: **Uskoci1/USKOCI-CLEAN**. Canonical grana: **clean-alpha-backend**. Fizički pročitan HEAD: **916ffb498ba5ad47a307a3c66477757b6753095a** (PR97).

Ova predaja je na grani **docs/safe-handoff-20260911**, zasnovanoj na PR99 product HEAD-u **58e842e883db71f9118efc474c5011f3b261824c**. Nije spojena u canonical samo radi zaustavljanja. Sledeći agent mora prvo fetch-ovati tu granu; stari canonical HANDOFF sam po sebi još ne sadrži ovu predaju. Tačan završni dokumentacioni commit dobija se sa `git rev-parse origin/docs/safe-handoff-20260911`.

Vlasnik je tražio SAFE STOP. Posle predaje nema novog razvoja, merge-a, migracije, deploy-a ili aktivacije dok vlasnik ne zatraži nastavak.

## CURRENT LIVE SUPABASE

Project ref: **leqcwgzvjsxugfgzdmth**, ACTIVE_HEALTHY, PostgreSQL17. Svež read-only upit u **2026-09-11 04:41:43.708899+00** potvrđuje **108 migracija**, head **20260911031713_clean_dispatch_need_lock_order**.

Canonical i PR99 imaju source108 i pending0. Sačuvana M05 grana ima source109 i tačno jedan kandidat: `20260911035330_clean_m05_agreement_change_authority.sql`, SHA256 `bc7dfa77aab4d035cf83ea4c2911aead669371a0fbfb2d18faa63b9b726cf435`. **SQL109 nije LIVE niti merged.** LIVE proposal/response tela još imaju stare MD5 vrednosti `1e7189bfb0f3baca51f24aca820d62c2` / `0bbfc5fd26c97bc5fe953561c2330c49`. SQL108 dispatch/expiry tela odgovaraju već prihvaćenim vrednostima.

| Edge | Verzija | Status | JWT |
| --- | --- | --- | --- |
| uskoci-ai-interview | 17 | ACTIVE | true |
| uskoci-location-search | 2 | ACTIVE | true |
| uskoci-publication-evaluate | 1 | ACTIVE | true |
| uskoci-data-export-worker | 1 | ACTIVE | true |
| uskoci-data-export-download | 1 | ACTIVE | true |

Push Edge nije deployovan. Svež upit u **2026-09-11 04:42:35.688265+00**: active legal documents0, publication bundles0, retention policies0, retention execution bindings0, push jobs0, push attempts0. Nisu čitane tajne ni vrednost EXPO_PUSH_TRANSPORT_ENABLED. Raniji tačni source readback dokazi za AI17/Location2 ostaju važeći u svom obimu; metadata nije dokaz uspešnog provider poziva.

## OPEN STACK

| PR | Grana | HEAD | Base | Stanje | Mergeability |
| --- | --- | --- | --- | --- | --- |
| 99 | feat/v2-native-journey-closure-20260911 | 58e842e883db71f9118efc474c5011f3b261824c | clean-alpha-backend | OPEN | MERGEABLE |
| 98 | feat/v2-signature-entry-auth-20260910 | aabe29aa26d2c5fcdcfc0edf03150ef6be09da37 | feat/v2-agreement-messages-20260910 | DRAFT | MERGEABLE |
| 96 | feat/v2-agreement-messages-20260910 | 1ec86c6711d868ba031258c2fe9c693140ba4a8d | feat/w03-ai-owned-intake-20260910 | OPEN | MERGEABLE |
| 95 | feat/locationiq-reverse-20260910 | 4dabe6bf23d6007168d31f925a1a6d1a8745b622 | feat/w03-ai-owned-intake-20260910 | DRAFT | MERGEABLE |
| 69 | fix/svg-web-accessibility-20260908 | c07dad963f2d1b8e5c07973df5bba9f99aa8bda3 | clean-alpha-backend | OPEN | MERGEABLE |
| 68 | feat/public-task-material-20260907 | da7ce1d5efe88c2f5022f813f84de52e436566cc | clean-alpha-backend | DRAFT | CONFLICTING |
| 67 | feat/shared-exploration-ui-20260907 | 37a8ec98b31c4c8d81e7c30808581cd6cdcccc1a | clean-alpha-backend | DRAFT | CONFLICTING |
| 59 | fix/ai-vertical-recovery-20260907 | 663b69bc9a007f29abd89ce2f2f8b9281e046bdf | clean-alpha-backend | OPEN | CONFLICTING |
| 17 | proof/ru5-c01-public-profile-20260905 | 4b2d3057f9c0cf2cbbd93a70468fb35123bc11a0 | clean-alpha-backend | DRAFT | CONFLICTING |

PR99 je aktivni integracioni kandidat. PR95/96/98 su još fizički otvoreni stari delovi stack-a; delovi su već preneti kroz PR97/PR99. Ne spajati ih naslepo. PR17/59/67/68/69 nisu zatvoreni ovom predajom; njihov stvarni diff i stari CI ostaju u manifestu. PR94 i PR97 nisu otvoreni.

PR99 PRE-P4 **34562268097** i CodeQL **34562265082** su PASS. Testirani merge commit `8741867596719121f7ffc3a52ecfabe987b3e1f7` ima isto stablo `8ed72f7910861b858aab3ea2691255ab5ec82b64` kao PR99 HEAD58e842e. Native run **34562264364 je FAIL**; zelen izvorni CI ne zatvara tu granicu.

## SAVED WORK / GIT HYGIENE

- M05 + M06: `feat/v2-agreement-changes-20260911` / **60a3ce68e52cbf461639f392db877d93ba0405c7**, commitovano i poslato na origin; nema novog PR-a. Uključuje M06 otkazivanje iz6451127/abdd0dd, M05 service/UI/SQL109 i usku ispravku notification-preferences fixture-a.
- Foreground push + Android kanal: `feat/v2-push-foreground-20260911` / **cba0a2645fdb31d9f19414ca7afe6a6bc93f1e0f**, pet koherentnih fajlova, commitovano i poslato; nije merged/deployovano.
- PR99: `feat/v2-native-journey-closure-20260911` / **58e842e883db71f9118efc474c5011f3b261824c**, zamrznut kod posle SAFE STOP.

Svaki worktree, HEAD, grana i porcelain status nalaze se u manifestu. Product worktree-i su čisti; trenutni dokumentacioni worktree se zatvara posebnim commitom. Ne brišite stare worktree-e radi urednosti. Privremeni runtime/artefakti su van Git-a u `work/`; ne kopirati node_modules, .env ili raw Auth logove. Bezbednost nastavka ne znači da je proizvod spreman za izdanje.

## WHAT ACTUALLY WORKS

Canonical ima stvarne Supabase vlasnike za Need, Prijavu, atomsku selekciju, zajednički Dogovor, poruke i completion, uz verzije, idempotency, participant RLS, privatne lokacije/kontakt i kalendarske provere. W03 owned intake, country/capability/location/availability/calendar foundations i većina V2 prezentacije su povezani sa postojećim servisima. Nije dozvoljen tihi produkcijski fallback na lažne podatke.

PR93/P3 i PR97 su završene integracione granice. SQL105–108 i AI17/Location2 tehnički deployment/readback su završeni. Odvojene ranije DB/Auth i native provere dokazuju svoje uske tokove. To nije dokaz kompletnog novog AI→objava→drugi nalog→review proizvoda, pravne aktivacije ili provider isporuke.

## WHAT IS PARTIAL / WHAT IS STILL MISSING

JSON manifest sadrži **46 capability zapisa**, svaki sa svih deset traženih osa: SERVER, CLIENT SERVICE, STATE/HOOK, SCREEN/UI, NAVIGATION, ERROR/LOADING/STALE/OFFLINE, TESTS, NATIVE PROOF, LIVE i ACTIVATED. PARTIAL označava nezavršen roditeljski tok; ne znači da treba ponovo praviti već završen backend.

| ID | Capability | Status roditeljskog toka |
| --- | --- | --- |
| W01-entry | Entry / intro / signature identity | PARTIAL |
| W01-auth | Login / signup / recovery / new password / expired link | PARTIAL |
| W01-intent | Single account / MENI TREBA / JA MOGU shell | PARTIAL |
| W03-ai | AI Novi Zadatak conversation | PARTIAL |
| W03-review | Human review / correction / draft / Need edit | PARTIAL |
| W02-location | Private address → resolver → pin / Remote | PARTIAL |
| W02-terms | Need schedule / people / tools / vehicle / team requirements | PARTIAL |
| W05-publication | Publication / policy evaluation / B06-B07 | BLOCKED |
| W06-discovery | Zadaci Lista / Mapa / search / pin preview | PARTIAL |
| W06-detail | Public Need detail / preselection Q&A | PARTIAL |
| W08-application | Prijava / price / slots / exact interval / withdraw | PARTIAL |
| W08-myapplications | Moje Prijave / stale compare / attention | PARTIAL |
| W08-candidates | Kandidati / comparison / public profile | PARTIAL |
| W08-selection | Izbor → shared CONFIRMED Dogovor | PARTIAL |
| W09-agreement | Dogovor Pregled / collection / history | PARTIAL |
| W09-chat | Poruke / retry / phone & exact location sharing | PARTIAL |
| M05-change | Izmena Dogovora / accept / reject / semantic replay | PARTIAL |
| M06-cancel | Otkazivanje Dogovora | PARTIAL |
| W05-need-cancel | Need cancellation / delete draft / close remaining search | PARTIAL |
| W09-problem | Problem / no-show / recovery | PARTIAL |
| W09-completion | Worker done / requester confirm / 48h / auto-close | PARTIAL |
| W10-reviews | Ocena / reputation / trust | BLOCKED |
| W04-manual | Manual Worker profile / activation | PARTIAL |
| W04-ai | AI Worker profile interview | MISSING |
| W04-resources | Worker skills / resources / tools / vehicle / team | PARTIAL |
| W02-availability | Availability / Available Now | PARTIAL |
| W02-calendar | Calendar / exact worker bookings | PARTIAL |
| W02-worker-geo | Worker operating area / country / radius | PARTIAL |
| W06-matching | Matching / dispatch / opportunity generation | PARTIAL |
| W07-inbox | Inbox / notifications / preferences | PARTIAL |
| W07-push | Expo push / foreground / Android channel | PARTIAL |
| W11-profile | Own Profile / public profile / Settings | PARTIAL |
| W12-hitno | HITNO / free launch / monetization | PARTIAL |
| W11-safety | Block / abuse report / moderation / appeals | MISSING |
| W11-support | Support / complaints / no-show resolution | MISSING |
| W11-closure | Account closure | BLOCKED |
| W11-export | Data export / native save | PARTIAL |
| W11-retention | Retention / holds / media cleanup | BLOCKED |
| W11-legal | Legal consent / Terms / Privacy / Safety / ADR | BLOCKED |
| W03-media | Task/profile media / voice / Storage lifecycle | PARTIAL |
| W11-ops | Admin / scheduler / release operations | PARTIAL |
| W13-monitoring | Crash / error monitoring | MISSING |
| W13-release | Preview / store / Android-iOS final gates | PARTIAL |
| W09-multi-person-chat | Multi-person Dogovor / group and private channels | MISSING |
| W10-verification | Verification / attestation / expiry / revoke | MISSING |
| W08-application-ai | Application AI / F095 reconciliation | BLOCKED |

Konkretne rupe: Need cancellation/delete-draft servisi nemaju native poziv; M06 Dogovor cancellation UI je sačuvan ali još nije canonical; Worker AI nije kompletan; višekorisnički Dogovor zahteva pravi task-centered group chat, privatne requester↔participant kanale, prekid čitanja budućih poruka po uklanjanju članstva i odvojene privatne uslove/lifecycle; bilateralni chat to ne dokazuje. Verifikacija/attestation je zasebna nezavršena celina, a F095 Application AI zahteva otvorenu reconciliation odluku bez drugog engine-a. Review engine i F144 pravila nisu zatvoreni; generic block/report/moderation, support/complaints, closure, potpuni media/voice tok, crash monitoring i store/ops nisu završeni. Prikaz ocene koja nije dostupna ne sme postati lažna zvezdica.

Read-only audit je našao i usku tehničku rupu: `useFocusedResource` osvežava na foreground, ali ne stopira/čisti na background; `raspored.tsx` ima zadržane direktne navigation callback-e bez foreground ograde. Postoje account/session/service/RLS ograde; nije opaženo stvarno curenje drugom nalogu. Ovo je zapis za kasniju ciljanu ispravku, ne izmena u SAFE STOP.

## CURRENT TWO-ACCOUNT JOURNEY / MAP LOCATION

**34562264364 / HEAD58e842e: FAIL, bez izuzetka.** Originalni narandžasti pin sa belom ivicom sada je vidljiv na PNG-u; status pokazuje **45.277831 / 19.752165** i centriranu mapu. Root je pregledao originalnu failure sliku. Android XML sadrži **0** čvorova sa oznakom `Oznaka izabrane tačke na mapi`. Zbog toga test nije pronašao stabilnu fizičku metu i **nije ni poslao drag**.

Failure: `drag_native_marker`, poruka `Actual full native marker hit target did not become stable`. Nisu dokazani start/end confirmation, save, B06/B07, objava, Prijava, Izbor, poruke/completion na istom AI-created Need-u u ovom run-u. Prethodni34558909215 zasebno je stigao do potvrđenog start formulara, ali uz nevidljiv pin; ne kombinovati različite run-ove u lažni kompletan tok.

Original artifact **10185302712**, **2,661,779B**, SHA256 **bba97594391b5acecd4738602cc142b624c54c5efaf73f34b8fa303bac53ecbf**. Admission SHA256 **512533b927a45ff164a483f5e0d026995ed1d2401ee198fd5f1b4e055e00fb42**; 19 build inputa,4 native inputa, SQL106→107→108 i stvarni handler/registry hashovi provereni. Putanja: `work/evidence/marketplace-run34562264364/`.

Fixture koristi dva prava disposable lokalna Auth naloga i DB, uz sintetički AI upstream i sintetičke pravne izvore. Nije production Auth, LocationIQ/OpenAI stvarni poziv, TLS policy gateway ili telefon na javnom push-u. LocationIQ Edge2 je deployovan; pozitivan Novi Sad address→server→provider→lat/lon→pin tok ostaje nedokazan. Ručni pin fallback i precizne/private naspram coarse/public koordinate ostaju obavezni.

## CURRENT DESIGN STATE

**FOUND EXACT ASSETS / FOUND MOTION / FOUND SCREENS.** Prihvaćen je opaženi Entry redosled i handoff; univerzalni NATIVE PARITY ostaje pending. Originalni V2 HTML, CSS/JS, SVG asseti, motion podaci,66-screen contracts, atlas i design pravila sada su u repo authority pack-u. Provereno je svih **483** fajla izvornog manifest-a. Originalni ZIP sa337 raster rendera je u prenosivom paketu; rasteri nisu ugrađeni kao native UI.

**Originalni timeline je4380ms**: parts40–1240, wink1450–1750, settle1920–2690, wordmark2700–3200, motto3210–3500, split3590–4200, choices3980–4340, enable4380. Izvor počinje belo: white panel opacity1/radius30 je rano belo-na-belom, bez senke. Senka `.045 * bg` nastaje sa split-om3590–4200, posle wordmark-a/moto-a. Ne praviti novu izmišljenu opacity animaciju niti t0 zeleno/narandžasto iz finalnog screenshota.

Run **34558907333**, source9cb32f2: root i nezavisni reviewer pregledali su **239 stvarnih PTS frejmova,18 gridova,13 PNG/XML parova i5 MP4**. Svih21 relevantnih inputa ostalo je isto na58e842e. Raw launcher/system splash ostaje u originalima; poređenje intro-a počinje prvim app-owned frejmom55 na7.863389s. Vide se razdvojeni delovi, sklapanje, wink/settle, wordmark, moto, zatim split/panel granica i izbori. Nema opaženog app-owned blank-a ni ranog vidljivog panela/senke. Oba intent sweep-a prvo skrivaju donje natpise; reduced motion ide direktno u Auth.

Ograničenja: promenljiv capture PTS ne dokazuje prvih41ms, tačno4380ms zidnog vremena ili60fps;1080×2400 native i390×844 reference nisu pixel-perfect poređenje. U raw Android snimcima je blago odsečen vrh status glyph-ova. Registration still pokriva gornji viewport, recovery je gated. Ostali ekrani koriste V2 design DNA; final mobile ergonomija/polish i potpuni device tokovi ostaju. Korisnikovi JPEG nazivi bez dostupnih bajtova nisu proglašeni pregledanim slikama.

Design synthesis08.09 je originalno označen kao predlog koji čeka owner selection. Čuva se kao SUPPORTING, uključujući korisnu analizu cancellation radnje; njegove4500ms/ODZIV/Onest alternative ne nadjačavaju kasnije izabrani SPOJ V2. Stari font/city extraction source ostaje potrebna build zavisnost, iako više nije vizuelni Entry autoritet.

## CURRENT AI / AGREEMENT / PUSH STATUS

W03 Need AI ima owned server/client i conversation-first UI; Edge17 je LIVE, stvarni production OpenAI uspeh nije dokazan. W04 ima manual Worker profile, dok kompletan Worker AI interview→human review→profile save nedostaje.

M06 cancellation UI je u remote60a, uz postojeći LIVE cancel RPC, nepromenjenu poslovnu semantiku i stvarni CANCELLED readback. Razlog se traži u UI, ali ga postojeći void RPC ne čuva; UI ne obećava istoriju razloga. M05 change ima poseban `dogovor/izmene/[id].tsx`, servis i SQL109 sa tačno dva funkcijska tela. PrviN05run34562190736 ostaje FAIL0/10,0/3, pre109apply. Ispravljen je samo test fixture da koristi postojeći N08 RPC umesto zabranjenog direktnog upsert-a. **N05run34562970333: completed / cancelled**. Run je završio **timeoutom od30 minuta**:1/10 opažena PASS grupa, bez finalnog M05 izveštaja i bez admitted lock grafova. Prva nedovršena grupa po source redosledu je ORIGINAL_SIBLING_ACCEPTANCE_DEADLOCK_ROLLS_BACK; tačan await nije opažen. SQL109 nije admitted. Original artifact10185621188 (36.903B), SHA25634b58188989d695a5787e107a417d1385f8c95e549f1203eb6ff7b25fb66d141. Ne pokretati novi run tokom predaje.

M05/M06 lokalno:237 relevantnih Jest provera, TSC, final Android static export5153 modula/33 asseta; kasnija preferences ispravka7 testova. Nema dedicated M05/M06 native/device dokaza. Problem report i completion postoje; to nije generic abuse, no-show case resolution ili moderation sistem.

Push: SQL107 LIVE; postoje registry, opt-in dozvola, preferences, logout revoke, tap→owned Inbox i source foreground/channel patchcba0a26. Taj patch je prošao78 Jest +39 sintetičkih Edge testova i TSC. Worker nije deployovan, runtime flag nije pročitan, scheduler jobs0. Nema realne Expo/FCM/APNs isporuke na telefonu. Deploy sam ne zatvara push parent flow.

## LEGAL / PRIVACY / RELEASE STATUS

RC2/RetentionV1 reuse approval već postoji. Nedostaje tačan odobreni sadržaj/pristup i reconciliation; poslednji Drive pokušaj nije bio prijavljen. Sačuvana stara legal constitution je draft, **nije RC2**. Ne tražiti ponovo odobrenje koje postoji, niti aktivirati placeholder Terms/Privacy/Safety/ADR. Fresh aktivni legal/publication/retention binding-i su0.

P2 export i ograničeni P3 AI retention su tehnički LIVE; stvarni native Save i production purge nisu dokazani/aktivirani. Review deadline/edit/publication F144 nema primljen odgovor; completion48h nije review deadline. Account closure mora čuvati obaveze i legal hold; support/monitoring/ops/store ostaju otvoreni.

Raniji automatski approval review blokirao je kombinovani adb/launch/Metro live-preview poziv i live Expo8093 podešavanje. Nije pokušavan workaround. Dozvoljeni static export i CI loopback dokazi su zasebni. Te blokirane radnje ne tretirati kao uspešne ili ponovo odobrene.

## AUTHORITY PACK / COMPLETE DECISIONS

Početi od [AUTHORITY_INDEX.md](../authority/AUTHORITY_INDEX.md) i [AUTHORITY_MANIFEST.json](../authority/AUTHORITY_MANIFEST.json). Oni povezuju originalne kompletne izvore, status važenja, SHA256 i provenance, ne novi master.

Sačuvani su final owner review21/21, full OWNER_LOCKED_DECISIONS, kasniji implementation closure03.09, **svih50 rekonciliranih decision rows**, njihova working-checkpoint provenance, stariji105 MD/CSV i112 specification, svih7 current-canon dokumenata i draft legal source. Provereno14 source fajlova naspram16 originalnih archive chains. Nije pronađeno50 originalnih poruka upitnika u19 jedinstvenih kontejnera; ne tvrditi da jesu. Aktuelne direktne user poruke i oba velika owner priloga čuvaju se verbatim.

Supersesije su eksplicitne: stare5-tab instrukcije,24h replacement entitlement/countdown, review tags i Google Maps ne nadjačavaju final21/21, RU4 lock i novije owner odluke. Synthesis proposal, istorijski donor HTML, stari package cursor-i i stari LIVE87 statusi jasno su označeni. U final21 originalu početna OPEN tabela pripada ranijem checkpoint-u u istom fajlu; kasniji pojedinačni zaključci i završna COMPLETE deklaracija imaju prednost. Originalni tekst se ne briše. AGENTS.md je kratka mapa; njegov prethodni dugi sadržaj sačuvan je kao HISTORICAL.

## EVIDENCE INDEX

| Dokaz | Run | Putanja |
| --- | --- | --- |
| LIVE108 | — | docs/implementation/evidence/live108-20260911/verification.json |
| fresh-live-safe-stop | — | embedded:supabase_live_snapshot |
| PR97-full | 34541247305 | work/evidence/pr97-run34541247305 |
| PR99-scoped | 34562268097 | work/evidence/pr97-run34562268097/root-scoped-review.json |
| Entry-accepted-observed | 34558907333 | work/evidence/pr98-run34558907333/motion-review-root.json |
| Entry-source | — | work/entry-auth-source/SOURCE-INVENTORY.json |
| Entry-user-view | — | outputs/USKOCI-entry-redosled-20260911.png; outputs/USKOCI-entry-auth-poredjenje-20260911.png |
| marketplace-current | 34562264364 | work/evidence/marketplace-run34562264364 |
| marketplace-prior-fail | 34558909215 | work/evidence/marketplace-run34558909215 |
| M05-first-fail | 34562190736 | work/evidence/m05-run34562190736/failure-admission.json |
| M05-current | 34562970333 | work/evidence/m05-run34562970333 |
| M05-M06-local | — | work/m05-agreement-prep/INTEGRATION-FREEZE.json |
| push-atomic | — | work/push-transport-prep/foreground-commit-freeze.json |

Manifest sadrži tačne ZIP/artifact/hash/source granice. `work/` i `outputs/` putanje polaze od `C:/Users/user/Documents/Codex/2026-09-10/ana`. GitHub originali se pribavljaju po artifact ID-u pre isteka; izvori/linkovi ostaju u predaji. Ne dodavati raw Auth logove niti ogromne video binarije u Git. Portable ZIP čuva potrebne source pakete, dokumentaciju, reference i sačuvane commit patch-eve.

## EXACT NEXT CURSOR

SAFE STOP remains in force. On owner resume, first read-only re-admit saved branches and LIVE108. Marketplace run34562264364 FAIL has a visibly rendered pin but no Android accessibility hit target; no drag was sent. Repair that exact native accessibility/gesture boundary while preserving real drag, E6, Auth and privacy checks. Separately diagnose N05run34562970333 cancelled by30-minute timeout after1 observed group, no final report/lock graphs; SQL109 is not admitted. No blind merge or duplicate dispatch during readmission.

1. Fetch/read this handoff branch and newest owner/authority sources; reread canonical/PRs/worktrees/Supabase metadata. If newer state differs, explain and preserve it.
2. Read retained original marketplace artifact10185302712 and admission for run34562264364. Pin is visible at45.277831/19.752165 but XML has no marker hit target. No drag or later same-Need lifecycle occurred; do not stitch previous runs into a passing journey.
3. After owner resumes, repair the observed marker accessibility/hit-target boundary from run34562264364. Pin rendering now works. Keep actual native drag and all strict location/Auth/privacy checks. No new development during SAFE STOP.
4. FinishPR99 integration onlyafteritsnativeboundaryandcurrentexactheadPRE/CodeQLpass; recordmergedSHA/tree. Do notreplayunchangedEntry orreapplySQL106108.
5. Read original N05run34562970333 artifact10185621188 and failure-admission.json:30-minute timeout after1 observed Auth/fixture group, no final M05 report and0 admitted lock graphs. After owner resume, diagnose earliest unfinished ORIGINAL_SIBLING_ACCEPTANCE_DEADLOCK_ROLLS_BACK; exact await is unobserved. Keep all10 groups/3 lock requirements; do not increase a timeout or weaken a gate without finding the cause.
6. Integrate savedM06cancel+M05change branch60a againstmergedPR99, preservingnativeMarkerfix. Runexistingrelevantchange/canceltests, fullmigration/security/CodeQLatthismajorboundary, thennativechange/cancelcounterpartyproof.
7. Onlyafteractual109admission+merge+existingcontrolledfreshpreflight, apply109onceandverifytwofunctionbodies/fullACL/history/businesspreservation. CurrentLIVE108containsoldM05owners; do notclaim109liveearlier.
8. Integrate savedforeground/channelcommitcba0a26 through existingN09checks. Keepworkerundeployed/unactivateduntilknownruntimeflag/configandcontrolledscheduler/providerdevicegate; no tokenloggingorimplicitoptin.
9. Usecompleteownerlock/50rowreconciliation/final21review+latestcommands tocloselegal/F144questionsonlyifanswerexists. MissingRC2text/Driveaccess and unansweredF144remainexplicitprerequisites; no newguessedpolicy.
10. Resume W03–W13 parent-flow closure from the gap matrix: Worker AI, Need cancel/delete, multi-person Dogovor group/private channels and membership cutoff, verification/attestation, F095 Application AI reconciliation, calendar background guards, reviews, safety/support/closure/media/ops, then whole same-AI-Need physical journey and release gates. Reuse existing owners and do not polish replaced legacy UI.

## DO NOT REPEAT

- PR93/P3 and SQL105 promotion complete; PR97 merged916ffb4; do not restart their DBproof infrastructure.
- SQL106/107/108 already LIVE with exact source hashes and recordedaliases; canonical108pending0. Never reapply them.
- AIv17 andLocationIQv2 exact deployment/readback complete; positiveproviderproof stilldifferent.
- OriginalV2 package483manifestfiles verified. Exactassetextraction and original Entry239frame/13pair/5recordingreview complete at9cb32f2;21bindingsunchangedto58e842e. Do not rerunEntry justfor map/docs.
- PR99 MyApplications/Agreementcollection/sourcefixesalreadywritten; do not reimplement. M06cancel andM05change preserved onremote60a; do not omit orrewritefromprototype.
- Foreground/channelpatchcba0a26 iscommitted/pushed, targeted117tests+TSC; notmerged/deployed/nativeproven.
- Oldfailed native34558909215,34544810119 andEntryfailures retainedunwaived. N05first34562190736FAILbefore109 notPASS.
- OpenoldPRs95/96/98containhistoricalstack; partsintegratedthrough97/99. Do notblindmerge themorconflicting17/59/67/68. PR69needsactualdiffreview, notassumedclosure.

## DO NOT CHANGE

- One account, two intentions: MENI TREBA / JA MOGU. Zadatak → Prijava → Izbor → immediatelyCONFIRMED Dogovor. No third acceptance.
- Requester bottomzones Zadaci | U/Novi | Dogovori; Worker Prijave | U/Zadaci | Dogovori. BellInbox/avatarProfile. Dogovor exactlyPregled | Poruke; actions are sections/routes.
- SPOJ V2 is visual/motion authority; CLEAN/Supabase business authority; actual newest explicit owner decision wins a textual conflict. Native Expo/RN/SVG/Reanimated only.
- Entry/Auth signature fidelity: original SVG/Č/colors/geometry, original4380ms sequence, no app-owned blank startup, no early visible shadow/panel, labels hidden during sweep. Do not restore old4500ms donor.
- One exact accepted interval hardbooks the worker only; requester may hold parallel Agreements. Flexible dates never block an invented whole day.
- Available Now is explicit/manual/off by default, separate fromHITNO, push permission and confirmed bookings.
- CountryRS explicit; private precise address/notes stay private; public projections coarse. Remote has no physical address/GPS/radius/distance/pin.
- LocationIQ server-side LOCATIONIQ_ACCESS_TOKEN viaDeno.env; fixedeu1search/reverse keyparameter. NoBearer or GEOCODER_BEARER_TOKEN; no client/repo/log/test secrets.
- OpenAI primary / ExpoPush / MapLibreOSM accepted by latest owner. Do not restore oldGoogleMaps choice. No newproviderselectionquestion.
- Human confirms AI facts; AI cannot publish/accept on behalf of user. Preserve typed validation, authorization/RLS, idempotency, exactversion and observedconcurrencychecks.
- FREElaunch effectiveplatform0RSD; paid/wallet/checkout OFF. No invented compensation/entitlement/window/policy or marketplace→employment conversion.
- Directionalphone/contact; one party sharing does not revealtheother. Privateaccess followsserverlifecycle/context.
- Completed-only reviews, 1–5 plus optionalcomment/accountaggregate; no inventedtags/averages. F144deadline/edit/publicationrulesstillpending; completion48h isnotreviewdeadline.
- RC2/RetentionV1 approval/reuse isalreadygiven; no repeatedapprovalquestion. Exactcontent/reconciliation/executionbindingsremainprerequisites, D0140 staysfailclosed.
- Block/closuremustpreserveactiveobligations/legalholds; Agreementproblemdoesnotreplacegenericabuse/moderation/support.
- Rootsoleintegrator/livewriter; isolatedownership; reuseexistingcode. Targeteddevchecks; fullsystemgate onlymajorintegration/completevertical/RC. LatestownerSAFE_STOP overridespriorcontinuousautonomy.
- Multi-person Need has participant-specific private terms and independent Agreement lifecycle. Require task-centered group chat plus requester↔participant private channels; membership removal cuts off future messages without exposing private participant prices/terms. Bilateral two-account proof cannot close multi-person scope (final21 items20/21, L-007A/B/C/C.1/L-021, OC-009).

## EXTERNAL FACT REQUIRED

- F144 review deadline/edit/publication rule answer: requested but not received; account-level reputation and completed-only eligibility remain locked.
- Approved RC2/Retention V1 executable content and latest owner reconciliation: approval/reuse is known; precise accessible legal text is still missing (Drive authentication failed previously).
- Push transport runtime switch value, authenticated recurring scheduler and actual FCM/APNs/EAS/provider delivery admission. Switch was not read; zero jobs is not proof of switchOFF.
- Actual production OpenAI/LocationIQ success and preview/physical device owner journey. Do not request passwords/JWT; use existing disposable proof mechanism within its authorized boundary.
- Full original approximately50-message questionnaire was not found: preserve all50 reconciled decision rows plus final21/21 owner review, with latest owner messages. Do not invent missing raw answers.
- Actual approved support destination/operator, monitoring configuration and store prerequisites not established by this snapshot.
- F095 Application AI reconciliation remains OPEN in the original V2 OPEN_DECISIONS: reconcile D0055 with the new composer, retain explicit human send and reuse the existing AI engine. Do not silently omit it or invent a second engine.

## FRESH AGENT READMISSION

Nezavisni agent je bez prethodnog chata i vanrepo scratch-a pročitao repo mapu i uspešno odgovorio: šta je USKOČI, oba korisnička toka, owner/design autoritet, canonical/live stanje, završene i nezavršene celine i tačan sledeći korak. Pronašao je tri ograničena izostavljanja: multi-person chat/privacy scope, verifikacija i F095, kao i stale OPEN tabelu u final21 originalu. Dopune su uključene u gap matrix i authority map. Proverio je177 putanja, dostupne raw hashove i interne linkove; root zatim proverava konačne hashove/ZIP. To potvrđuje upotrebljivu predaju, ne spremnost proizvoda za release.

## FIRST COMMAND FOR NEXT AGENT

> Nastavi postojeći USKOČI posle owner resume komande. Prvo read-only fetch docs/safe-handoff-20260911; pročitaj AGENTS, authority index, najnovije owner odluke, četiri continuity dokumenta i NEXT_AI snapshot/manifest. Fizički proveri canonical/PR/live/CI i oba postojeća run-a bez duplog dispatch-a. Nastavi od konkretnog marker AX failure-a i sačuvanog M05 stanja. Ne pravi novi master/arhitekturu i ne ponavljaj zatvorene promocije.

Početna komanda: `git fetch origin docs/safe-handoff-20260911 clean-alpha-backend`, zatim `git show origin/docs/safe-handoff-20260911:AGENTS.md`. Ostale readmission/test komande su u manifestu. Predaja je bezbedna za nastavak uz navedene granice; nije tvrdnja o spremnosti za store.
