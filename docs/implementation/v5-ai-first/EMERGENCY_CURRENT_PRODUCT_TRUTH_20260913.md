> STOP checkpoint: backend schema through144 + standalone DEV budget configuration20260913100016 (145 history rows). Schema145–147 still NOT APPLIED. Real AI attempt1 FAILED503, not a paid provider call. Current APK944fee9 Gradle PASS; final attestation FAIL RECOVERY_REDIRECT_NOT_COMPILED; UNVERIFIED artifact saved, not installed on S23.

# USKOČI PRE-V3 / V5 — CURRENT PRODUCT TRUTH

Presek 2026-09-13 za emergency checkpoint. Ovo je pregled postojećih dokaza, bez novih poziva, testiranja uređaja ili proširenja proizvoda. Brojevi i nazivi svih 66 tokova prate vlasnikov emergency zahtev. Konačni Git HEAD i predati APK navode se u integratorovom zasebnom handoff-u.

**PROVEN LOCAL** u tabeli znači dokazani navedeni deo u disposable Auth/SQL/Storage okruženju, lokalnom testu ili emulatoru. Ne znači da je ceo mobilni tok dokazan. **PROVEN LIVE** zahteva stvarni korisnički tok na DEV-u; samo primenjena migracija, instalirana Edge funkcija ili uspešan read-only inventar nisu takav dokaz. Stvarna HTTP prijava potvrđenog QA naloga i otvaranje privatnog AI razgovora kasnije su prošli; to nije dokaz celih native tokova. Aktuelna AI proba je FAIL503, bez provider dispatch-a.

DEV/ALPHA projekat je `leqcwgzvjsxugfgzdmth`: primenjene su migracije do 144, deset Edge funkcija iz izvora `695f4df7033855bbac147076c4521e9c42a5cf47`. Kandidati 145, 146 i 147 nisu primenjeni. Ovo nije stanje buduće produkcije. Postojeći APK je iz `6d8f640f96f2034f56c2201a0b6082b82c50841b`; dokaz uređaja pokriva odjavljeni Entry/Auth na emulatoru, bez predaje login forme, bez prijavljenog HOME-a i bez Samsung S23 probe.

Poslednji pregledani CI `34749451460`, source `18916a438a7e695d2a3aaea95f823d9fc126a743`, ima svih 11 source gates PASS, 195 Jest suites / 4050 testova i 811 Node testova PASS. Ukupan run je **FAIL**: stvarni SQL niz prolazi do 131, zatim pada u 132 budget fixture delu nakon šest uspešnih provera; 133–145 nisu dostignuti. To nije potpuni green checkpoint. Stariji, tačno vezani source `3fa11c8b6c5357fb90a3f4fd05e80b5634a37619` ima ceo disposable niz do 144 PASS u run-u `34748075434`; taj rezultat ne preimenujemo u dokaz novijeg izvora ili stvarnog providera.

## Dokazi i skraćenice

- **C189** — [run34749451460-summary.json](../evidence/v5-ai-first-20260912/build-ci-control/run34749451460-summary.json). Imena `*-report.json` ispod su ključevi u njegovom `reports` objektu. Source testovi su zbirna regresija, ne dokaz mreže/uređaja.
- **C144** — [run34748075434-summary.json](../evidence/v5-ai-first-20260912/build-ci-control/run34748075434-summary.json). Istorijski disposable PASS do 144; providerCalled/liveAccess/deviceProven ostaju false. Sintetički provider odgovori ne predstavljaju Gemini poziv.
- **DEV144** — [DEV_ALPHA_PREFIX144_READ_ONLY_POSTFLIGHT_20260913.json](./DEV_ALPHA_PREFIX144_READ_ONLY_POSTFLIGHT_20260913.json) i [DEV_ALPHA_PROMOTION_EXECUTION_20260913.json](./DEV_ALPHA_PROMOTION_EXECUTION_20260913.json). Read-only postflight proverava stvarnu primenu/ACL/source; `businessRpcInvoked=false`, `providerCalled=false`, `authSubmitPerformed=false`. Posmatranje konfiguracije je vremenski ograničeno, nije trajna garancija runtime vrednosti.
- **APK6d** — [v5-6d8f640-visual-receipt.json](../../../artifacts/v5-native-smoke/v5-6d8f640-visual-receipt.json), `signedOutOnly=true`, `authSubmitted=false`, `providerCalled=false`, emulator `USKOCI_V5_TEST`, paket `rs.uskoci.preview`.
- **Closure** — [CLOSURE_EXECUTOR.md](./CLOSURE_EXECUTOR.md) i [ACCOUNT_ERASURE_API_146.md](./ACCOUNT_ERASURE_API_146.md): stari 131 adapter i novi, lokalni AF-D22 adapter moraju ostati odvojeni. Scheduler za closure maintenance nije postavljen; postojeći cron je samo marketplace tick.

## MENI TREBA

| # | Tok | Status | Dokaz / praktična granica |
|---|---|---|---|
| 1 | login / signup / session restore | PARTIAL | C189 Auth/session testovi i stvarni disposable Auth postoje; QA signup, email confirmation, password login i Auth GET user su naknadno dokazani HTTP200 na DEV-u; APK6d nije poslao login/signup. Prijavljena native sesija i restore na DEV-u nisu dokazani. |
| 2 | izbor MENI TREBA | PROVEN LOCAL | APK6d requester snimak dokazuje odjavljeni izbor i Auth navigaciju; ne dokazuje nastavak posle login-a. |
| 3 | AI unos zadatka | PARTIAL | C189 intake/recovery UI i SQL provere; C144 132 proverava stvarni handler uz sintetički provider. Nema prijavljenog native AI razgovora. |
| 4 | stvarni AI provider odgovor | FAIL | Stvarni QA Edge POST10:00 vraća503 AI_PROVIDER_NOT_CONFIGURED; recovery potvrđuje providerDispatched=false. Gemini nije pozvan. |
| 5 | strukturiranje AI razgovora u Need/Task podatke | PROVEN LOCAL | C144 `v5-ai-turn-recovery-report.json` i C189 `v5-review-acceptance-report.json`: strogi rezultat i kanonski upis nad stvarnim SQL-om, uz sintetički model. |
| 6 | ručni unos ako AI nije dostupan | PARTIAL | Native ručna korekcija/pregled postoje u source-u; nije dokazan kompletan prazan zadatak → svi obavezni podaci → objava dok je provider nedostupan. |
| 7 | čuvanje drafta | PROVEN LOCAL | C189 `v5-review-acceptance-report.json`: kanonski draft, owner/revision i replay ograde. Nema DEV native probe. |
| 8 | potvrda zadatka | PROVEN LOCAL | C189 isti 126 report: nepromenljiv serverski pregled i jedan konačni accept, bez potvrđivanja svakog fakta. Glas ne predstavlja objavu. |
| 9 | objava zadatka | PROVEN LOCAL | C189 124–126 reportovi proveravaju evaluator i kanonsku objavu/replay u disposable okruženju; DEV144 policy inventar nije dokaz stvarne objave A naloga. |
| 10 | prikaz zadatka | PROVEN LOCAL | C189 `need-lifecycle-report.json`, `provider-boundaries-report.json` i projekcioni testovi. Stvarni signed-in mobile prikaz nije proveren. |
| 11 | izmena zadatka | PROVEN LOCAL | C189 114/126: vezana izmena, revizija, stale/replay ograde; ručna lokacija ima native regresione provere, bez DEV uređaja. |
| 12 | otkazivanje / brisanje dozvoljenog zadatka | PARTIAL | C189 114/117 dokazuju dozvoljeno kanonsko otkazivanje i terminalne zabrane. To nije dokaz proizvoljnog fizičkog brisanja zadatka niti AF-D22 cleanup-a. |

## JA MOGU

| # | Tok | Status | Dokaz / praktična granica |
|---|---|---|---|
| 13 | worker profil | PROVEN LOCAL | C189 `worker-authority-report.json` i `v5-worker-profile-report.json`: zaseban profil/schema i kanonski save. Stvarni AI provider i native login nisu dokazani. |
| 14 | worker location | PROVEN LOCAL | C189 110: potvrđena lokacija i matching geografija iz istog izvora, owner/CAS provere. Nema stvarnog LocationIQ zahteva. |
| 15 | availability | PROVEN LOCAL | C189 110: pravila, izuzeci, replay i istovremena izmena lokacije/slobodnih termina. |
| 16 | team capacity | PROVEN LOCAL | C189 110: owner granice, stale/replay i konkurentni CAS. Nema native DEV probe. |
| 17 | lista/mapa zadataka | PARTIAL | Projekcije i render testovi u C189; nije proveren prijavljen Worker na stvarnoj DEV listi/mapi sa objavljenim zadatkom A. |
| 18 | otvaranje detalja zadatka | PROVEN LOCAL | C189 114/115 i native projekcioni testovi; pravo pristupa provereno lokalno, bez uređaja. |
| 19 | prijava na zadatak | PROVEN LOCAL | C189 `agreement-core-report.json` / `event-semantics-report.json`: stvarni Auth/RPC i prijava sa owner/revision ograničenjima. |
| 20 | povlačenje/izmena prijave ako je podržano | PROVEN LOCAL | C189 117: stvarni update, semantic/same-key replay i worker cancellation; dozvoljene izmene imaju stale/terminal ograde. |

## POVEZIVANJE

| # | Tok | Status | Dokaz / praktična granica |
|---|---|---|---|
| 21 | naručilac vidi prijave | PROVEN LOCAL | C189 113/115/117: owner projekcija i namerno otvaranje, bez označavanja iz prefetch-a. Nema DEV A/B uređajnog toka. |
| 22 | izbor Uskočera | PROVEN LOCAL | C189 `agreement-core-report.json`: kanonski izbor stvarnim Auth/RPC pozivima u disposable bazi. |
| 23 | nastanak Agreement-a | PROVEN LOCAL | C189 isti 113 report: Agreement nastaje kroz kanonski izbor, ne kroz drugi klijentski writer. |
| 24 | sprečavanje duplog izbora / race condition | PROVEN LOCAL | C189 113 i 110: konkurentni izbor/kapacitet i idempotentni rezultat dokazani u stvarnoj bazi. |
| 25 | Agreement detail | PROVEN LOCAL | C189 `agreement-client-report.json`: kanonska projekcija, učesnici i verzija. Native prikaz nije otvoren prijavljenim korisnikom na DEV-u. |
| 26 | poruke | PROVEN LOCAL | C189 113/115 za privatni tekst; C144 137/144 za grupu i privatne fotografije. Poslednji source nije dostigao 144; hosted media E2E i native poruke nisu dokazani. |
| 27 | predlog izmene dogovora | PROVEN LOCAL | C189 113/115: postojeći predlog i kanonska verzija/terms, bez drugog chat ili Agreement motora. |
| 28 | prihvatanje/odbijanje izmene | PROVEN LOCAL | C189 113/115: kanonski accept/reject i stale/replay. Nema prijavljenog A/B testa na uređaju. |
| 29 | završetak posla | PROVEN LOCAL | C189 113/115: worker završetak kroz postojeću lifecycle komandu. |
| 30 | potvrda završetka | PROVEN LOCAL | C189 113/115: requester potvrda i terminalna ograničenja u stvarnom SQL-u. |
| 31 | review/ocena ako postoji | PROVEN LOCAL | C189 `reviews-authority-report.json`: completed-agreement eligibility, privatnost, replay i zabrane. Nema DEV native ocene. |

## NOTIFIKACIJE

| # | Tok | Status | Dokaz / praktična granica |
|---|---|---|---|
| 32 | event se kreira | PROVEN LOCAL | C189 `event-semantics-report.json`: stvarni poslovni događaji, samo realne promene i jedan first-view događaj. Ovo nije push. |
| 33 | inbox notification se kreira | PROVEN LOCAL | C189 111/117: stvarni inbox redovi, unread/read-all, owner i pagination. Ovo nije dostava na telefon. |
| 34 | preferences/quiet-hours/suppression rade | PROVEN LOCAL | C189 117 `INBOX_SUPPRESSION_UNREAD_PAGINATION_READ_ALL_OWNER_INTENT_AND_QUIET_HOURS_REGRESSION` PASS. Nema realnog Expo transporta. |
| 35 | push device registracija | PARTIAL | C189 `push-device-client`, `native-push-device` testovi i 121 device/barrier SQL provere; stvarni token Samsung S23/Expo registracije nije pribavljen/dokazan. |
| 36 | Expo push dispatch | NOT TESTED | `EXPO_PUSH_TRANSPORT_ENABLED=false`; C189 123 dokazuje disabled/non-sending putanju i recheck pre provider IO. Nema poslatog stvarnog push-a. |
| 37 | Expo ticket | IMPLEMENTED BUT NOT PROVEN | `supabase/proofs/notifications/n09_push_transport_edge.test.mjs` proverava obrađivanje sintetičkih odgovora; nema stvarnog Expo ticket-a. Transport je isključen. |
| 38 | Expo receipt | IMPLEMENTED BUT NOT PROVEN | Isti N09 transport test; nema stvarnog receipt poll/readback dokaza sa Expo-a. |
| 39 | dead-token handling | PROVEN LOCAL | N09 i C189 source regresija proveravaju obradu simuliranog mrtvog tokena; nije observed rejection stvarnog uređaja. |
| 40 | foreground ponašanje u mobilnoj aplikaciji | PARTIAL | C189 `src/data/__tests__/push-runtime.test.tsx` i native push testovi; nijedna stvarna primljena foreground notifikacija nije prikazana na uređaju. |

## AI

| # | Tok | Status | Dokaz / praktična granica |
|---|---|---|---|
| 41 | GEMINI_API_KEY dostupnost runtime-u | IMPLEMENTED BUT NOT PROVEN | Vlasnik navodi podešene secrets; raniji names/digests inventar ne potvrđuje da trenutna Edge instanca uspešno koristi ključ. Vrednost nije čitana/logovana. |
| 42 | AI_PROVIDER=gemini | IMPLEMENTED BUT NOT PROVEN | Vlasnik je upravo prijavio ovu konfiguraciju; postojeći source podržava Gemini. Nema svežeg runtime izvršenja koje potvrđuje odabranu granu. |
| 43 | GEMINI_MODEL=gemini-3.8-flash | IMPLEMENTED BUT NOT PROVEN | Vlasnik je prijavio model; nema stvarnog model endpoint odgovora, pa dostupnost/prihvatanje modela nisu dokazani. |
| 44 | stvarni provider request | FAIL | Odobreni budžet sada enabled=true, samo potvrđeni QA admitovan, ali stvarni Edge POST503 nije došao do providera. Nema nove rezervacije/plaćenog odgovora. |
| 45 | stvarni odgovor na srpskom | IMPLEMENTED BUT NOT PROVEN | Srpski sintetički fixture-i nisu odgovor providera; nema sačuvanog bounded real-response dokaza. |
| 46 | strukturirani extraction rezultat | PROVEN LOCAL | C144 132/141 i C189 parser/Edge testovi proveravaju strogi JSON, context i upis. Rezultat stvarnog Gemini poziva nije dokazan. |
| 47 | fail-closed/fallback | PROVEN LOCAL | C189 provider-boundaries i AI testovi, C144 132/141/142: nevažeći/unknown odgovor nema slepu ponovnu naplatu ili objavu. Nema simuliranog provider fallback-a; kompletan manual-only tok ostaje granica reda 6. |
| 48 | QA classifier | PARTIAL | C144 135 dokaz koristi stvarni handler/SQL uz sintetički model. DEV144 nema aktivnu QA policy; owner-product aktivacija 147 nije primenjena, a stvarni Gemini QA poziv nije izvršen. |
| 49 | image review ako je deo proizvoda | IMPLEMENTED BUT NOT PROVEN | Source media/publication putanja i lokalni 130/139/144 dokazi postoje; nijedna odabrana fotografija nije stvarno pregledana Gemini-jem. Private Agreement fotografije se ne šalju modelu. |
| 50 | speech/voice controlled test ako postoji | IMPLEMENTED BUT NOT PROVEN | Hold-to-talk/native/session testovi postoje; nema stvarne transkripcije provajderom. Važeći owner UX: release → vidljiv izmenjiv tekst → eksplicitno Pošalji; release ne objavljuje i ne šalje AI poruku automatski. |

## LOKACIJA

| # | Tok | Status | Dokaz / praktična granica |
|---|---|---|---|
| 51 | LocationIQ request | IMPLEMENTED BUT NOT PROVEN | C189 `provider-boundaries-report.json` ima `providerCalled=false`; stvarni Edge/Auth adapter je proveren sa sintetičkim LocationIQ odgovorom. Nema stvarnog upstream poziva. |
| 52 | search | PROVEN LOCAL | C189 isti report: forward mapping i country/error granice, bez automatskog save-a; stvarni LocationIQ rezultat i uređaj nisu dokazani. |
| 53 | reverse geocoding | PROVEN LOCAL | C189 isti report: reverse mapping/strogi input uz sintetički upstream; nema stvarnog reverse zahteva. |
| 54 | čuvanje worker location | PROVEN LOCAL | C189 110/123: explicit canonical save, owner, revision/CAS i concurrent availability. |
| 55 | readback | PROVEN LOCAL | C189 110/123: stvarni SQL/client readback potvrđene worker lokacije, uz account fence. |
| 56 | prikaz/dispatch koriste isti izvor istine | PROVEN LOCAL | C189 110 `CONFIRMED_LOCATION_DISPLAY_EQUALS_MATCHING_GEOGRAPHY` PASS; nije merena stvarna mobilna mapa/dispatch u DEV A/B toku. |

## NALOG

| # | Tok | Status | Dokaz / praktična granica |
|---|---|---|---|
| 57 | requester profile | PROVEN LOCAL | C189 `requester-identity-report.json`: stvarni canonical client/RPC, replay i own-only projekcija. Nema prijavljenog uređaja. |
| 58 | worker profile | PROVEN LOCAL | C189 110/128; C144 141 recovery. Poseban owned profil je implementiran; stvarni provider/native profil nije dokazan. |
| 59 | logout/login | PARTIAL | C189 auth/session testovi; disposable Auth postoji. Nema stvarnog native logout→login ciklusa u APK6d. |
| 60 | account A → B → A | PARTIAL | C189 session epoch, owner/journal i late-result testovi; nije izvedena prijavljena A→B→A smena na telefonu ili emulatoru. |
| 61 | cold session restore | PARTIAL | C189 `src/store/__tests__/session-layout.test.tsx`, `session-epoch.test.ts`, `auth-runtime.test.ts`; APK6d cold restart je odjavljen, nije dokaz restore-a aktivne sesije. |
| 62 | account closure request | PROVEN LOCAL | C189 121: owned prepare, same-key recovery, ograničenja i stvarne account barrier races. Readiness/izvršenje na DEV-u nije dokazano. |
| 63 | closure execution | FAIL | DEV nema closure scheduler, postojeći 131 policy binding nije spreman za AF-D22; 146 nije primenjen/proveren actual SQL nizom. Sama Edge implementacija nije automatsko izvršenje. |
| 64 | Auth identity deletion | PARTIAL | C189 131 stvarno proverava Auth soft erasure, prazne metadata, 0 sesija, stari JWT/refresh denial u disposable okruženju. Potpuni novi 146 identifikatori/relational tok nije actual-proven ili LIVE. |
| 65 | dependent data cleanup / preservation po pravilima | PARTIAL | C144 139/144 dokazuju selected evidence/private media zaštitu; stari 131 zadržava relational sadržaj i ne ispunjava sam AF-D22. Novi 146 ordinary redaction/izuzeci su lokalni kandidat sa unit proverama, bez actual SQL PASS. |
| 66 | recovery/error handling | PARTIAL | C189 i C144 imaju konkretne lost-ACK, account switch, cancel/tombstone, Storage/Auth recovery i race dokaze; najnoviji actual 132 run ipak FAIL, 146 actual nije izvršen, a potpuni native restart/E2E nije potvrđen. |

## Granice zaključka

Kompletan `A login → kreiranje/objava → B login/prijava → A izbor → Agreement → poruke → završetak → ocena` nije izveden na DEV-u ili prijavljenoj native aplikaciji. Postoje dokazani disposable delovi, ali to nije jedan spojen korisnički E2E. Prva nedokazana granica na uređaju je već predaja login-a; realni AI/provider i DEV SQL budget admission su dodatne nezavisne granice. Nema osnova da se ostatak proglasi završenim zato što postoji RPC ili test fixture.

Notification domain i inbox imaju lokalne dokaze. Token registracija na stvarnom S23, Expo credentials/configuration, stvarni ticket/receipt i realna dostava nisu dokazani. Transport je isključen; nije dokazano da je flag jedina preostala prepreka.

Za 146 ostaje poznata konzervativna liveness granica: trusted scoped hold dodat posle start-a može zaustaviti pending Storage korak i time dalji obični cleanup. Ne prijavljuje se lažni CLOSED i ne briše se zaštićeni dokaz; ovo nije potvrda kompletnog privacy/closure E2E. Novi rokovi zadržavanja nisu izmišljeni.

Ovaj dokument nije odobrenje novog live batch-a, uključivanja push transporta ili tvrdnja da su vlasnikove upravo promenjene secrets vrednosti proverene u runtime-u. Za ključeve se ne prikazuju vrednosti.
