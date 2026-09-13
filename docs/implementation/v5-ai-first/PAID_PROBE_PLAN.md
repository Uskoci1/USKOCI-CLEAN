# Kontrolisana Gemini proba na canonical DEV/ALPHA

## Važeća odluka i dokazni status

Owner AF-D26 odobrava backend, konfiguraciju i završno povezano testiranje na
`leqcwgzvjsxugfgzdmth`. AF-D20 odobrava postojeći owner/test nalog i jedan jasno
obeležen interni QA nalog. Ne praviti dodatni staging niti ponovo tražiti
odobrenje providera, namene ili poznatih product odluka. Zaseban budući
production projekat sa stvarnim korisnicima nije cilj ove probe.

Izvor `3fa11c8b6c5357fb90a3f4fd05e80b5634a37619` prošao je FULL144
CI34748075434 sa34 stvarna izolovana bazna izveštaja. Njegove migracije109–144
stvarno su primenjene i nezavisno proverene na canonical DEV/ALPHA. Deset Edge
funkcija iz695f4df je postavljeno; provider pozivi, stvarna naplata i povezani
Android E2E još nisu izvršeni. Konačne probe
moraju vezati poslednji provereni Git izvor, stvarne Edge verzije i APK receipt;
144 nije unapred proglašen konačnim izvorom dok145/146 ispravke traju.

Već su odobreni `gemini-3.8-flash`, `gemini-3.5-transcribe-live`, Google paid
processing okvir, prolazan audio bez USKOČI arhive, provera izabranih Task
fotografija i javnog Q&A. Sve namene dele USD5 internih rezervacija; to nije
garantovan računovodstveni plafon. Kratke probe se izvode redom uz proveru stvarne
potrošnje posle svake. Privatne Agreement fotografije ne šalju se Gemini-ju.

AF-D24: hold-to-talk → završni vidljiv/izmenjiv tekst → izričito Pošalji.
Puštanje mikrofona završava transkript bez novog AI turn-a ili objave zadatka.
Ne uvodi se potvrđivanje svakog podatka.

## 1. Plaćeni projekat i tehnički preduslovi

Ranije je stvarno proveren `Uskoci-clean` / `gen-lang-client-0693119686`, broj
projekta705329837232, Paid Tier1 / Prepay USD5 / Auto-reload Off. Veza postojećeg
Supabase Gemini ključa sa tim plaćenim projektom proverena je u kontrolisanoj
memoriji. Ne prepisivati ključ, njegove delove, OAuth/JWT ili privatne odgovore
u dokumentaciju, shell argumente ili logove. Vlasnik ne treba ponovo da šalje ključ.

Pre prvog inference-a proveriti sveže dostupne metadata o plaćenom projektu,
postojećem ključu i dva tačna modela. Najviše po jedan `models.get` za svaki
odobreni model, sa ključem samo u header-u; izveštaj sadrži samo ime/verziju,
limite i podržane metode. Metadata odgovor nije dokaz srpskog streaming govora.
Ako model nije dostupan, ne zameniti model/provider niti koristiti plaćeni ping
kao nedokumentovan fallback. [Models API](https://ai.google.dev/api/models).

Ovaj turn ima zaustavljen Computer Use zbog nepouzdanog prepoznavanja browser
URL-a. Dostupni Supabase konektor nema set-secrets ni Auth-admin alat. Repo,
CI i dozvoljeni Supabase pozivi nastavljaju se. Potrebnu ručnu konfiguraciju
zatražiti tek kada je konkretan backend spreman; to je ograničenje alata, a ne
novo traženje već dobijene owner dozvole. Ne zaobilaziti blok browser pristupom,
izvlačenjem akreditiva ili dijagnostičkim endpoint-om koji vraća tajne.

## 2. Zatvoreni gate-ovi pre prve probe

- Kompletan izolovani dokaz konačnog izvora i proverena forward promocija na
  canonical DEV/ALPHA. Istorija108 i postojeći poslovni podaci se ne resetuju.
- Stvarni Auth/session nalog R je odobreni owner; W je jedan jasno označen
  internal QA nalog. Potvrđena email prijava i session integrity moraju raditi.
  Nema izmišljenog auth korisnika kroz direktan INSERT niti falsifikovanog JWT-a.
- Proveriti da Android i svih11 Edge funkcija koriste samo canonical DEV/ALPHA.
  Probni profili/Tasks imaju TEST / INTERNAL oznaku; nema production push-a,
  stvarne naplate, izmene stvarne reputacije ili slanja poruka drugim osobama.
- R mora imati stvarni ACTIVE Requester profil, W stvarni ACTIVE Worker profil
  kroz postojeći pregled i izričitu aktivaciju. DRAFT nije ACTIVE. Samoprijavljen
  identitet ne dobija verified badge niti obavezni KYC gate.
- SQL124/125 publication pravila ostaju postojeća izvršiva produktna pravila;
  ne seed-ovati sintetičku CI policy na DEV. Nepostojeći podaci neregistrovanog
  operatera se ne izmišljaju. Izvršiva closure/retention politika i istorija imaju
  svoje dokaze; uspeh objave nije pravna potvrda platforme.
- Stvarni SQL127 ledger se čita, ne resetuje. Allowlist sadrži samo R/W za ovu
  kontrolisanu probu; nepoznati raniji pokušaji zaustavljaju novu plaćenu operaciju.
- Tek posle zaštitne SQL127 šeme i konačnih Edge deploy-a postaviti odobrene
  vrednosti: `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`,
  `AI_TEST_BUDGET_REQUIRED=true`, `USKOCI_GEMINI_PAID_TEST_ENABLED=true`,
  `USKOCI_SPEECH_CONTROLLED_TEST_ENABLED=true`,
  `USKOCI_GEMINI_IMAGE_REVIEW_ENABLED=true`, `USKOCI_QA_CLASSIFIER_ENABLED=true`.
  SQL127 global enabled i allowlist proveriti pre inference-a. Bez OpenAI fallback-a.

## 3. Konkretan obim: USD 2.65 osnovno, najviše USD 2.90

SQL127 rezerviše USD 0.25 za svaki novi LLM operation i USD 0.20 za svaki novi STT operation. To nisu izmereni troškovi. Fiksni globalni plafon je USD 5, ne USD 5 po korisniku; nema refund-a ni posle timeout-a. Početni `R0` se čita iz servera: plan je moguć samo ako `R0 + 2.90 <= 5.00`. Predlog ne troši ceo preostali prostor ako je ranije bilo poziva.

USD 2.90 i raspored P1–P9/C1 su ograničenje odobrenog postupka, ne dodatna server kvota. SQL127 nema batch ID, listu dozvoljenih budućih operation ID-eva, ograničenje po endpoint-u ili automatski stop na USD 2.90; važeći allowlist nalog može eksplicitnim novim zahtevima trošiti ostatak globalnog plafona. Zato pre otvaranja admission-a proveriti ceo aktivni allowlist, ne samo dodati R/W, i navesti tačno odobreno početno/završno stanje. Nalozi se koriste isključivo za ovaj batch, jedna operacija u toku, bez nepoznatih ranijih provider pokušaja. Ako je zahtev da server sam sprovodi podlimit/broj probe ili tester-private vidljivost, sadašnji izvor to ne dokazuje i takav batch nije spreman bez zasebne konkretne izmene. Detalji flag/recovery granica su u [PAID_PROBE_CODE_REVIEW](PAID_PROBE_CODE_REVIEW.md).

Probe se rade redom, jedna aktivna UI operacija, bez paralelnog korišćenja AI Studio Playground-a ili drugih test klijenata. Svaki red ima pregled troška i SQL receipt-a pre narednog reda. Speech red unapred uračunava STT i kasniji eksplicitni AI Send. Samo puštanje mikrofona ne šalje AI zahtev; prvo proveriti vidljiv tekst i mogućnost izmene.

| Proba | Konkretna akcija kroz aplikaciju | Najviše novih LLM / STT | Rezervacija | Kumulativno |
| --- | --- | --- | --- | --- |
| P1 | R: novi Task A, jedna kratka kucana poruka za udaljenu lekturu probnog teksta | 1 / 0 | USD 0.25 | USD 0.25 |
| P2 | A: ručno dopuniti poznate nedostajuće podatke, otvoriti detaljan pregled; jednom „Objavi zadatak“ kroz acceptedReviewId tok, bez fotografije | 1 / 0 | USD 0.25 | USD 0.50 |
| P3 | R: novi Task B, jedna kucana poruka za udaljenu proveru prelomljenog probnog teksta; fotografija još ne šalje AI-u | 1 / 0 | USD 0.25 | USD 0.75 |
| P4 | B: držati mikrofon 6–10 sekundi, srpski dodatak zadatku; pustiti, proveriti izmenjiv final bez AI poziva, zatim jednom Pošalji i jedan odgovor | 1 / 1 | USD 0.45 | USD 1.20 |
| P5 | W: zaseban Worker AI razgovor, jedna kratka kucana poruka o kontrolisanom test profilu | 1 / 0 | USD 0.25 | USD 1.45 |
| P6 | W: držati mikrofon 6–10 sekundi za dodatak radnom profilu; pustiti, pregledati/izmeniti tekst, jednom Pošalji i jedan odgovor | 1 / 1 | USD 0.45 | USD 1.90 |
| P7 | B: dodati jednu sopstvenu neutralnu test fotografiju, sačekati READY; detaljan pregled i jedna „Objavi zadatak“ akcija | 1 / 0 | USD 0.25 | USD 2.15 |
| P8 | W: poslati jedno nematerijalno javno Q&A pitanje na B | 1 / 0 | USD 0.25 | USD 2.40 |
| P9 | R: odgovoriti jednom, bez promene dogovorenih uslova B | 1 / 0 | USD 0.25 | USD 2.65 |
| C1 | Samo ako je potreban stvarni odgovor na jedno CLARIFY pitanje: jedna dodatna eksplicitna kucana poruka u još otvorenom Task/Worker razgovoru. Nije ponovno slanje nepoznatog pokušaja. | 1 / 0 | USD 0.25 | najviše USD 2.90 |

Osnovno: 9 LLM + 2 STT = USD 2.65. Sa C1: 10 LLM + 2 STT = USD 2.90; pri `R0=0` ostaje USD 2.10 globalne rezervacije. Taj ostatak nije dozvola za nove probe. Izostavljen/odbijen poziv ne prebacuje automatski svoj slot drugoj probi. Ako je input potrebno promeniti posle nepoznatog ishoda, prvo postoji autoritativan receipt/cancel/abandon ishod; nema novog UUID radi zaobilaženja nepoznatog pokušaja.

C1 se, ako je potreban u ovom ograničenom DEV/ALPHA planu, umeće odmah posle odgovarajućeg CLARIFY ishoda, pre prihvatanja Task/Worker pregleda. Broj C1 nije zahtev da se na kraju otvara novi razgovor. Kada je taj slot iskorišćen, više nema dodatnih plaćenih dopuna u ovom batch-u.

Sadržaj kontrolisane DEV/ALPHA probe u već odobrenom okviru: A „Lektura kratkog probnog teksta na srpskom, rad na daljinu, jedan izvršilac, fleksibilan termin, cena po dogovoru.“ B „Provera čitljivosti probnog teksta na fotografiji, rad na daljinu, jedan izvršilac, fleksibilan termin, cena po dogovoru.“ Govor B: „Tekst je na srpskom. Potrebna mi je provera pravopisa i rasporeda pasusa.“ Worker tekst/govor mogu opisati samo odobrene test podatke; ne prepisivati stvarni profil neistinitim veštinama. Primer Q&A: „Da li je tekst na srpskom jeziku?“ / „Da, tekst je na srpskom jeziku, kao što piše u opisu.“ Ove probne objave ostaju na canonical DEV/ALPHA projektu i jasno nose oznaku TEST / INTERNAL; ne prenose se u zaseban production projekat. Konačan review ostaje stvarni native pregled; policy BLOCK/REVIEW/CLARIFY se ne pretvara u ALLOW radi prolaza probe.

Jedna fotografija sadrži samo vlasnikov neutralni probni tekst, bez osoba, kontakata, adresa, QR ili identifikacionih dokumenata. Koristi se postojeći AF-D07 sanitizer i privatni Storage; za ovu malu probu cilj je gotov JPEG do 512 KiB, uz postojeće produkcione maksimalne dimenzije 1600 px. Nema Google Files API, dodatnih slika, kamera/video/audio priloga ili nove svrhe. Sačuvati Worker profil samo jednom posle pregleda, kroz stvarni pregled i postojeću izričitu aktivaciju; prepare/save ne zovu provider.

## 4. Gde se stvarno troše rezervacije i šta osvežavanje radi

| Izvor | Stvarni provider operation / zaštita |
| --- | --- |
| `uskoci-ai-interview/index.ts` | Jedan `clientRequestId` = najviše jedan LLM reserve; SQL132 dispatch intent pre provider I/O. Streaming i običan V2 zahtev ne smeju biti dve test akcije za isti govor. |
| `uskoci-speech-session/index.ts` + `proxy.ts` + `holdToTalk.ts` | Jedan speech `operationId` = USD 0.20, čak i ako nema upotrebljivog finala. Release daje izmenjiv tekst bez AI ključa/poziva. Tek izričito Pošalji stvara AI `clientRequestId` = dodatnih USD 0.25. Za dve planirane probe najviše 2 session-a; nema reconnect-a ili session resumption-a. Izvor dozvoljava do 120 s capture / +15 s finalizing, ali ovaj batch govori samo 6–10 s. |
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
- Speech: na release završiti capture; interim mora poticati od stvarnog provider događaja, a final postati vidljiv izmenjiv tekst bez AI dispatch-a. Proveriti izmenu i tek izričitim Pošalji poslati jednom. Ako final izostane, sačuvati dopušteni editable fallback bez ponovnog snimanja u istoj probi. Posle restart-a ne obnoviti audio session; proveriti AI receipt ako je njegov key nastao.
- Publication: `rpc_read_ai_task_review`/`readLatest` čita isti command. Samo postojeći EVALUATED+ALLOW može nastaviti canonical publish bez nove inference; UNKNOWN ne postaje „objavljeno“. Drugi nalog proverava finalnu javnu projekciju i fotografiju.
- QA: najpre canonical SQL133 receipt, zatim SQL135 recovery. COMMITTED mora odgovarati originalnom owner/type/Task/revision/key/hash-u. Cancel može vratiti COMMITTED ako je objava već pobedila; nije refund. ABSENT ne daje dozvolu da se napravi novi key.

Posle svakog P/C reda root proverava SQL127 promenu i AI Studio korišćenje/Prepay balans za tačno dokazani projekat. Razdvojiti `reservedMaximum` od `observedProviderCharge`: USD 0.25 nije tvrdnja da je Google toliko naplatio. Google navodi približno 10 min latencije i moguća prekoračenja, a neki cost grafici kasne do 24 h; zato stari prikaz USD0 nije dokaz nulte potrošnje. Ako stvarni trošak još nije proverljiv, status je `SPEND_PENDING`, sledeći plaćeni red čeka osveženu evidenciju. [Google billing i processing times](https://ai.google.dev/gemini-api/docs/billing#processing-times).

STOP uslovi: nepoznata veza ključa/projekta; nedostupan isti model/gate/policy; neočekivan dodatni operation ID ili račun; dosegnut `R0 + 2.90`; nepoznat odgovor; privatni podatak izvan odobrenog payload-a; potreba za novim providerom, svrhom, retention ili troškom. Root zatvara admission za naredne plaćene probe po završetku ovog kontrolisanog plana, bez resetovanja ledger-a i bez brisanja dokaznih podataka. Probe ne brišu SQL139 zaštićene fotografije ili istoriju. Test Task se po proveri zaustavlja/zatvara samo postojećim vlasničkim radnjama kroz aplikaciju. Nema fizičkog brisanja istorije radi čišćenja probe.

Izvorna provera ovog plana: pet poziva `reserveAiTestBudget`, SQL127/126/128/132/135, native hold-release i Task/Worker/QA klijenti fizički pročitani. Brojevi su izvedeni iz stvarnog koda; nije izvršena nijedna proba niti napravljen izveštaj PASS za provider/model/naplatu.
