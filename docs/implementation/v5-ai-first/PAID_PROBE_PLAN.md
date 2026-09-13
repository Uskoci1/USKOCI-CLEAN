# Predlog malog Gemini testa kroz stvarnu aplikaciju

Pripremljeno 2026-09-13, samo pregled izvora i plan. Nisu pročitani ključevi, menjani secrets/config, pozvani modeli niti izvršen live batch. Aktuelni source kandidat je28c47c01a3637e67ce767910ed213477a9a933b1/SQL141. CI34734349508 je prošao11 source gates,185 Jest suites/3711 testova,686 Node testova i25 actual izveštaja do135;136 je stao na SQL timeout-u posle2 provere, pa137–141 nisu dostignuti. Konkretan batch još zahteva završne dokaze, APK i tačne test naloge.

Već odobreno: `gemini-3.8-flash`, `gemini-3.5-transcribe-live`, prihvaćen Google paid processing okvir, prolazan govor bez USKOČI audio arhive, AF-D09 pregled sanitizovanih Task fotografija, AF-D12 javni Q&A, zajednički interni test limit USD 5 i stvarna kontrola troška posle svake probe. Nema novih svrha/providera/cena. Paid1 / Prepay USD 5.00 / Auto-reload Off za `Uskoci-clean` / `gen-lang-client-0693119686` potvrdio je root u AI Studio; veza postojećeg Supabase `GEMINI_API_KEY` sa tim projektom još nije dokazana. Sufiks `…FZZg` je trag za nalaženje, ne dokaz identičnog ključa.

## 1. Najpre veza ključa i plaćenog projekta — bez prikazivanja tajne

Read-only UI provera13.09 ponovo prikazuje odobreni Uskoci-clean kao Tier1/Prepay.
Supabase secrets URL se, međutim, preusmerava na prijavu; raspoloživi Supabase
konektor nema secrets metadata API, a gcloud/Supabase CLI nisu u lokalnom PATH-u.
Vlasniku je poslat zahtev da se prijavi u postojeći Supabase kontrolni panel,
bez slanja tajni u čet. To nije dokaz podudarnosti ključa, nova uplata ili
odobrenje izmene konfiguracije. Izolovani CI i Android build nastavljaju se.

Predlog postupka za kasniji odobreni preflight, ne izvršen nalog:

1. Root sa već odobrenim read-only pristupom uzima samo metadata red `GEMINI_API_KEY` iz Supabase projekta `leqcwgzvjsxugfgzdmth`, uključujući njegov puni SHA256 digest. Ne čita ostale secret vrednosti i ne koristi `secrets set`. Supabase Management API vraća digeste, ne plaintext; to dokumentuje njegov [zvanični provider izvor](https://github.com/supabase/terraform-provider-supabase/blob/main/docs/resources/edge_function_secrets.md). CLI flagove prethodno proveriti preko lokalnog `--help`.
2. U Google metapodacima potvrditi baš ID `gen-lang-client-0693119686`, njegov project number i postojeći key resource u tom projektu. [Google keys.list](https://docs.cloud.google.com/api-keys/docs/reference/rest/v2/projects.locations.keys/list) daje projektno ograničen inventar. Prikaz imena projekta/sufiksa bez pune podudarnosti nije dovoljan. Ne kreirati drugi ključ ili billing projekat radi probe.
3. Kada konkretan preflight odobri tajnu samo u kontrolisanoj memoriji, kratak lokalni helper sa postojećim Google OAuth read-only pristupom poziva [getKeyString](https://docs.cloud.google.com/api-keys/docs/reference/rest/v2/projects.locations.keys/getKeyString) za tačno navedeni key resource. Potreban je postojeći `apikeys.keys.getKeyString` IAM permission. URL sadrži resource ID, ne API ključ. Helper odmah računa SHA256 iz vraćenih bajtova i poredi ceo digest sa Supabase digestom. Ne koristi `lookupKey?keyString=...`, clipboard, shell argument sa ključem, HTTP debug, ispis response-a ili fajl sa tajnom.
4. Helper sme da vrati samo `{projectId, projectNumber, keyResourceName, digestMatched, checkedAt}`; greška je neutralni kod. Key/OAuth token ostaju u memoriji, bez stdout/stderr/screenshot/log/traces, i brišu se iz dostupnih bafera u `finally`; to nije tvrdnja o garantovanom fizičkom brisanju svih kopija iz managed-runtime memorije. Nije potreban dijagnostički Edge deploy niti zamena postojećeg Supabase ključa da bi se proverila podudarnost.
5. Ako nema potrebnog Google pristupa, digest se razlikuje ili se key resource ne može sigurno vezati za pravi projekat, status je `KEY_PROJECT_ASSOCIATION_UNPROVEN` i plaćeni pozivi ostaju zatvoreni. Rotacija ključa/IAM/billing promena zahteva svoj konkretan batch, ne prikriven fallback. Neposredno pre probe ponovo proveriti isti digest, paid status i Auto-reload Off.

Proveriti i tip/restrikcije tog postojećeg ključa. Aktuelna [Google API key dokumentacija](https://ai.google.dev/gemini-api/docs/api-key) opisuje prelazak sa standardnih na authorization keys tokom septembra 2026; paid status sam ne dokazuje da stari ključ i dalje radi. Ovaj plan ne menja vrstu ključa i ne pretpostavlja uspešan pristup.

## 2. Metadata dostupnost modela i zatvoreni preduslovi

Posle dokazane veze ključa, u odobrenom read-only preflight-u najviše dva `models.get` zahteva, po jedan za tačno `models/gemini-3.8-flash` i `models/gemini-3.5-transcribe-live`, sa ključem samo u sanitizovanom `x-goog-api-key` header-u. Izlaz allowlist: ime/verzija modela, token limiti i podržane metode. [Models API](https://ai.google.dev/api/models) opisuje ove metadata pozive; oni nisu generisanje i ne troše SQL127 inference rezervaciju. Ako metadata nije dostupna, evidentirati neprovereno; ne zameniti model niti pokušati plaćeni „ping“. Live protokol i stvarni srpski interim/final potvrđuje tek odobrena audio proba. [Zvanični Live Transcribe ugovor](https://ai.google.dev/gemini-api/docs/live-api/live-transcribe) pokriva PCM16kHz, tekstualni izlaz i manual activityStart/activityEnd.

Pre aktivacije root vezuje konačne Edge verzije svih pet pozivalaca iz odeljka 4 i sve SQL/proof uslove. Sam broj migracija ili postojanje funkcije nije PASS. Za live test moraju biti imenovana dva postojeća kontrolisana naloga: `R` za naručioca i `W` za radnika/Q&A. Plan ne odobrava pravljenje naloga ili uzimanje kredencijala. Tačne UUID vrednosti ulaze u zaseban batch / SQL127 allowlist, nikada u javni test Task. Proveriti postojeću potrošnju, otvorene/unknown pokušaje i normalne AI/Q&A kvote; ništa se ne resetuje da bi test prošao.

R mora imati stvarni ACTIVE Requester profil za objavu. P8 zahteva stvarni ACTIVE Worker profil naloga W; čuvanje Worker pregleda kao DRAFT samo po sebi ne ispunjava taj uslov. Ako W nema ACTIVE profil, konkretan batch mora navesti stvarni pregled i odobreno čuvanje/aktivaciju profila pre P8, ili je QA scenario blokiran. To je postojeći produktni uslov, ne razlog za dodatni LLM poziv ili lažno podešavanje profila.

Task publication i Q&A traže svoj stvarni važeći izvršivi policy/context. Za osnovni RS Task već postoje odobrena produktna pravila: migracije124/125 aktiviraju i vezuju njihov izvršivi sadržaj; tačan forward paket ulazi u zasebno odobrenje live izvršenja. Ne treba ponovo odobravati poznata pravila niti koristiti sintetičke CI policy zapise. P1 Terms/Privacy, P3 retention i P4 processor mapa imaju odvojene ugovore: nedostajuća firma/kontakt/pravna objava nisu pronađeni kao tehnički uslov Task publication chain-a, a uspešna objava ne dokazuje pravnu spremnost platforme. Precizne kapije i preostali ulazi su u [PUBLICATION_ACTIVATION_READINESS](PUBLICATION_ACTIVATION_READINESS.md).

Konkretan live batch mora izričito navesti i odobriti stvarnu publiku objave i canonical dispatch. Na postojećem neizolovanom projektu `needs_public_discovery` omogućava drugim authenticated nalozima da vide `PUBLISHED|SELECTION`; SQL127 nema filter za njihovo čitanje ili sve primaoce dispatch-a. Privatna distribucija APK-a i AI allowlist zato ne izoluju vidljivost Task-a, fotografije ili javnog Q&A. Pre P2/P7/P8/P9 treba dokazati izolaciju celog okruženja ili odobriti opisanu stvarnu javnu objavu i dispatch na tom projektu. Ovaj plan ne uvodi novu politiku vidljivosti.

Potrebna eksplicitna konfiguracija u odobrenom batch-u: `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`, `AI_TEST_BUDGET_REQUIRED=true`, `USKOCI_GEMINI_PAID_TEST_ENABLED=true`; speech koristi `USKOCI_SPEECH_CONTROLLED_TEST_ENABLED=true`, fotografija `USKOCI_GEMINI_IMAGE_REVIEW_ENABLED=true`, Q&A `USKOCI_QA_CLASSIFIER_ENABLED=true`. To su potrebni gate-ovi, ne nalog da ih sada uključimo. SQL127 global `enabled` i tačan allowlist aktiviraju se tek po odobrenju; postojeći ključ se ne menja. Generički OpenAI/provider fallback nije deo ovog batch-a.

## 3. Konkretan obim: USD 2.65 osnovno, najviše USD 2.90

SQL127 rezerviše USD 0.25 za svaki novi LLM operation i USD 0.20 za svaki novi STT operation. To nisu izmereni troškovi. Fiksni globalni plafon je USD 5, ne USD 5 po korisniku; nema refund-a ni posle timeout-a. Početni `R0` se čita iz servera: plan je moguć samo ako `R0 + 2.90 <= 5.00`. Predlog ne troši ceo preostali prostor ako je ranije bilo poziva.

USD 2.90 i raspored P1–P9/C1 su ograničenje odobrenog postupka, ne dodatna server kvota. SQL127 nema batch ID, listu dozvoljenih budućih operation ID-eva, ograničenje po endpoint-u ili automatski stop na USD 2.90; važeći allowlist nalog može eksplicitnim novim zahtevima trošiti ostatak globalnog plafona. Zato pre otvaranja admission-a proveriti ceo aktivni allowlist, ne samo dodati R/W, i navesti tačno odobreno početno/završno stanje. Nalozi se koriste isključivo za ovaj batch, jedna operacija u toku, bez nepoznatih ranijih provider pokušaja. Ako je zahtev da server sam sprovodi podlimit/broj probe ili tester-private vidljivost, sadašnji izvor to ne dokazuje i takav batch nije spreman bez zasebne konkretne izmene. Detalji flag/recovery granica su u [PAID_PROBE_CODE_REVIEW](PAID_PROBE_CODE_REVIEW.md).

Probe se rade redom, jedna aktivna UI operacija, bez paralelnog korišćenja AI Studio Playground-a ili drugih test klijenata. Svaki red ima pregled troška i SQL receipt-a pre narednog reda. Speech red je jedna proba sa dva unapred uračunata poziva: korisnički ugovor puštanjem automatski šalje final tekst AI-u.

| Proba | Konkretna akcija kroz aplikaciju | Najviše novih LLM / STT | Rezervacija | Kumulativno |
| --- | --- | --- | --- | --- |
| P1 | R: novi Task A, jedna kratka kucana poruka za udaljenu lekturu probnog teksta | 1 / 0 | USD 0.25 | USD 0.25 |
| P2 | A: ručno dopuniti poznate nedostajuće podatke, otvoriti detaljan pregled; jednom „Objavi zadatak“ kroz acceptedReviewId tok, bez fotografije | 1 / 0 | USD 0.25 | USD 0.50 |
| P3 | R: novi Task B, jedna kucana poruka za udaljenu proveru prelomljenog probnog teksta; fotografija još ne šalje AI-u | 1 / 0 | USD 0.25 | USD 0.75 |
| P4 | B: držati mikrofon 6–10 sekundi, srpski dodatak zadatku; pustiti jednom, sačekati final i tačno jedan AI odgovor | 1 / 1 | USD 0.45 | USD 1.20 |
| P5 | W: zaseban Worker AI razgovor, jedna kratka kucana poruka o kontrolisanom test profilu | 1 / 0 | USD 0.25 | USD 1.45 |
| P6 | W: držati mikrofon 6–10 sekundi za dodatak radnom profilu; pustiti jednom i sačekati tačno jedan odgovor | 1 / 1 | USD 0.45 | USD 1.90 |
| P7 | B: dodati jednu sopstvenu neutralnu test fotografiju, sačekati READY; detaljan pregled i jedna „Objavi zadatak“ akcija | 1 / 0 | USD 0.25 | USD 2.15 |
| P8 | W: poslati jedno nematerijalno javno Q&A pitanje na B | 1 / 0 | USD 0.25 | USD 2.40 |
| P9 | R: odgovoriti jednom, bez promene dogovorenih uslova B | 1 / 0 | USD 0.25 | USD 2.65 |
| C1 | Samo ako je unapred deo konkretnog batch-a i potreban je stvarni odgovor na jedno CLARIFY pitanje: jedna dodatna eksplicitna kucana poruka u još otvorenom Task/Worker razgovoru. Nije ponovno slanje nepoznatog pokušaja. | 1 / 0 | USD 0.25 | najviše USD 2.90 |

Osnovno: 9 LLM + 2 STT = USD 2.65. Sa C1: 10 LLM + 2 STT = USD 2.90; pri `R0=0` ostaje USD 2.10 globalne rezervacije. Taj ostatak nije dozvola za nove probe. Izostavljen/odbijen poziv ne prebacuje automatski svoj slot drugoj probi. Ako je input potrebno promeniti posle nepoznatog ishoda, prvo postoji autoritativan receipt/cancel/abandon ishod; nema novog UUID radi zaobilaženja nepoznatog pokušaja.

C1 se, ako je potreban i odobren, umeće odmah posle odgovarajućeg CLARIFY ishoda, pre prihvatanja Task/Worker pregleda. Broj C1 nije zahtev da se na kraju otvara novi razgovor. Kada je taj slot iskorišćen, više nema dodatnih plaćenih dopuna u ovom batch-u.

Predlog sadržaja za konkretno vlasničko odobrenje batch-a: A „Lektura kratkog probnog teksta na srpskom, rad na daljinu, jedan izvršilac, fleksibilan termin, cena po dogovoru.“ B „Provera čitljivosti probnog teksta na fotografiji, rad na daljinu, jedan izvršilac, fleksibilan termin, cena po dogovoru.“ Govor B: „Tekst je na srpskom. Potrebna mi je provera pravopisa i rasporeda pasusa.“ Worker tekst/govor mogu opisati samo odobrene test podatke; ne prepisivati stvarni profil neistinitim veštinama. Primer Q&A: „Da li je tekst na srpskom jeziku?“ / „Da, tekst je na srpskom jeziku, kao što piše u opisu.“ To su predloženi javni test sadržaji, ne trenutno odobrene objave. Konačan review ostaje stvarni native pregled; policy BLOCK/REVIEW/CLARIFY se ne pretvara u ALLOW radi prolaza probe.

Jedna fotografija sadrži samo vlasnikov neutralni probni tekst, bez osoba, kontakata, adresa, QR ili identifikacionih dokumenata. Koristi se postojeći AF-D07 sanitizer i privatni Storage; za ovu malu probu cilj je gotov JPEG do 512 KiB, uz postojeće produkcione maksimalne dimenzije 1600 px. Nema Google Files API, dodatnih slika, kamera/video/audio priloga ili nove svrhe. Sačuvati Worker profil samo jednom posle pregleda, po konkretno odobrenom načinu DRAFT/ACTIVE; prepare/save ne zovu provider.

## 4. Gde se stvarno troše rezervacije i šta osvežavanje radi

| Izvor | Stvarni provider operation / zaštita |
| --- | --- |
| `uskoci-ai-interview/index.ts` | Jedan `clientRequestId` = najviše jedan LLM reserve; SQL132 dispatch intent pre provider I/O. Streaming i običan V2 zahtev ne smeju biti dve test akcije za isti govor. |
| `uskoci-speech-session/index.ts` + `proxy.ts` + `holdToTalk.ts` | Jedan speech `operationId` = USD 0.20, čak i ako nema upotrebljivog finala. Uspešan release pravi drugi, novi AI `clientRequestId` = dodatnih USD 0.25. Za dve planirane probe najviše 2 session-a; nema reconnect-a ili session resumption-a. Izvor dozvoljava do 120 s capture / +15 s finalizing, ali ovaj batch govori samo 6–10 s. |
| `uskoci-worker-interview/index.ts` | Jedan Worker `clientRequestId` = USD 0.25. Claim vraća postojeći turn bez novog reserve-a; PROCESSING/UNKNOWN nema retryAllowed. Worker `read/patch/prepare/save` su SQL-only. |
| `aiTaskReviewClientService.ts` + `pregled-zadatka.tsx` | Otvaranje/osvežavanje detaljnog pregleda može napraviti novi review envelope kroz SQL, ali ne poziva Gemini. „Objavi“ radi accept → evaluator → canonical publish. Naknadni `read/readLatest` ne pokreće evaluator. |
| `uskoci-publication-evaluate/index.ts` + SQL126 | Accepted review ima jedan durable evaluation attempt; njegov `attemptId` je LLM budget operation. Jedan zahtev sadrži javni Task tekst i sve izabrane fotografije, pa nije jedan poziv po slici. Same-command EVALUATING/UNKNOWN/EVALUATED readback ne daje novu claim. Nije dozvoljeno ponavljanje evaluacije sa novim review-em posle neuspeha u ovoj probi. |
| Legacy evaluator bez `acceptedReviewId` | Koristi novi `crypto.randomUUID()` za reserve pri svakom pozivu. Zato ovaj batch ne koristi taj endpoint oblik ili stari „evaluate again“ put. Širi globalni USD 5 ledger ga ipak broji; nije besplatan refresh. |
| `uskoci-qa-classify/index.ts` + SQL135 | Jedan ASK i jedan ANSWER imaju zasebne `classificationId` rezervacije. READY replay radi canonical SQL submit, bez novog Gemini-ja. `recover`, cancel i feed read ne klasifikuju. DISPOSITION ignore/report je SQL-only i nije zamena za QA probe. |
| `uskoci-media` / avatar / review edits | Sanitizacija, staging, Storage readback i ručni UI editor ne zovu Gemini. Photo Gemini poziv je tek gore navedena publication evaluation. Storage trošak se ne meri SQL127 ledger-om; nema promene Supabase plana. |

Nema automatskog plaćenog retry-a u odobrenom planu: HTTP timeout, 429, 5xx, nečitljiv provider JSON, prekid/focus/account promena ili nepoznat Storage/evaluation ishod prekidaju sledeću probu. Ne testirati recovery tako što se isti zahtev šalje novim ključem. Čitanje postojećeg receipt-a i pokretanje potpuno nove probe nisu ista stvar.

## 5. Evidencija, oporavak i završetak batch-a

Pre svake probe zabeležiti UTC vreme, konačan source/APK identity, account alias, conversation/Task/review ID, revision, unapred zabeležen ili server-vraćen opaque operation/clientRequest/attempt/classification ID, SQL rezervaciju pre/posle i stvarni zabeleženi ishod. Ne čuvati dodatne kopije plaintext poruka u command journal-u, audio, PCM, ključeve, JWT, pun provider body ili privatni context. Predloženi test sadržaj jeste unapred pregledljiv u ovom planu; stvarni final tekst ostaje u postojećem owned razgovoru.

- Task / SQL132: čitati tačan owned turn po conversation/key; uspešno završeni tekst/facts moraju postojati jednom. PROCESSING/UNKNOWN nije poziv da se ponovi inference.
- Worker / SQL128: `rpc_read_worker_ai` mora vratiti isti owned conversation/turn/attempt; SUCCEEDED i pregled/snimljen profil su odvojeni dokazi. Unknown ostaje closed do podržanog autoritativnog ishoda.
- Speech: na release završiti capture; interim mora poticati od stvarnog provider događaja i final otići jednom AI-u. Ako final izostane, sačuvati dopušteni editable fallback bez ponovnog snimanja u istoj probi. Posle restart-a ne obnoviti audio session; proveriti AI receipt ako je njegov key nastao.
- Publication: `rpc_read_ai_task_review`/`readLatest` čita isti command. Samo postojeći EVALUATED+ALLOW može nastaviti canonical publish bez nove inference; UNKNOWN ne postaje „objavljeno“. Drugi nalog proverava finalnu javnu projekciju i fotografiju.
- QA: najpre canonical SQL133 receipt, zatim SQL135 recovery. COMMITTED mora odgovarati originalnom owner/type/Task/revision/key/hash-u. Cancel može vratiti COMMITTED ako je objava već pobedila; nije refund. ABSENT ne daje dozvolu da se napravi novi key.

Posle svakog P/C reda root proverava SQL127 promenu i AI Studio korišćenje/Prepay balans za tačno dokazani projekat. Razdvojiti `reservedMaximum` od `observedProviderCharge`: USD 0.25 nije tvrdnja da je Google toliko naplatio. Google navodi približno 10 min latencije i moguća prekoračenja, a neki cost grafici kasne do 24 h; zato stari prikaz USD0 nije dokaz nulte potrošnje. Ako stvarni trošak još nije proverljiv, status je `SPEND_PENDING`, sledeći plaćeni red čeka osveženu evidenciju. [Google billing i processing times](https://ai.google.dev/gemini-api/docs/billing#processing-times).

STOP uslovi: nepoznata veza ključa/projekta; nedostupan isti model/gate/policy; neočekivan dodatni operation ID ili račun; dosegnut `R0 + 2.90`; nepoznat odgovor; privatni podatak izvan odobrenog payload-a; potreba za novim providerom, svrhom, retention ili troškom. Root zaključuje admission za naredne pozive u okviru odobrenog završnog config koraka, bez resetovanja ledger-a i bez brisanja dokaznih podataka. Probe ne brišu SQL139 zaštićene fotografije ili istoriju. Task terminalne akcije/uklanjanje iz prikaza su posebno navedene posledice u konkretnom batch-u, ne pretpostavljeno fizičko čišćenje.

Izvorna provera ovog plana: pet poziva `reserveAiTestBudget`, SQL127/126/128/132/135, native hold-release i Task/Worker/QA klijenti fizički pročitani. Brojevi su izvedeni iz stvarnog koda; nije izvršena nijedna proba niti napravljen izveštaj PASS za provider/model/naplatu.
