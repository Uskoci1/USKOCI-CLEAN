# USKOČI — pre-HTML stabilizacija, 11.09.2026.

## Presuda i granica isporuke

Ovo je stvarna, proverena izmena postojećeg klijenta i ciljano read-only ispitivanje živog Supabase-a. Nije nova aplikacija, novi product master, redizajn ili potvrda da je cela vlasnikova komanda završena. Celokupan ugovoreni proizvod ostaje u obimu.

**Implementiran je ovaj paket stabilizacije; ostatak pre-HTML posla nije završen.** Produkcijska baza, glavna grana, PR100, pravila objave i naplata nisu menjani. Nema nove migracije, deployment-a, novog APK-a, poziva stvarnog AI/geocoding/push provajdera ili dokaza fizičkog telefona.

Radna grana: `work/pre-html-stabilization-20260911`. Polazi od PR100, pa nasledno sadrži PR99. To nisu dva nezavisno urađena paketa niti dva motora.

## 1. Poreklo izvora i dokazani kod

| Granica | Tačan identifikator |
|---|---|
| Glavna grana, proverena pre rada | `916ffb498ba5ad47a307a3c66477757b6753095a` |
| PR100 / polazni commit | `df167547c469f5b4cb5679058526b697dae8ba48` |
| Polazno Git stablo | `3bf12daa4546780622cc29c4f47b547c23cf5301` |
| Proveren source kandidat | `f41378558d0cf5dd224fba23d8b1b8ae2c751964` |
| Git stablo tog kandidata | `b456519bd738e94c959bc119b43350757a5d287e` |
| Runtime commit sa celim foreground dodatkom i uklonjenim donorima | `a90f8766a0f38f6c14719b2c8499006b46b43b99` |
| Runtime Git stablo | `dc649e08650fecba50f80f08ce2e37f680f75bb0` |
| Hosted source proveravanje | GitHub Actions `34621466621`, job `103336214456` |
| Originalni artifact | `10272875752`, `owner-completion-evidence-34621466621` |
| SHA256 artifact ZIP-a | `ee901d3eaaa17cfe3e52e074d801942de47fa3c3a685f52c87675030befcbe38` |

Lokalni izvor je obnovljen iz sačuvanog paketa i usklađen do identičnog polaznog Git stabla PR100. Zavisnosti i Node su iz ranije arhiviranog zaključanog okruženja. `package.json`, `package-lock.json`, originalna animacija i asset-extraction build put nisu menjani. Na čistom GitHub runner-u instalirane su iste zaključane zavisnosti.

## 2. Šta je sada novo

### 2.1. Pamćenje poslednje namere po nalogu

Dodat je `src/store/accountIntentPreference.ts`; postojeći `uloga.ts`, `sesija.ts` i root readiness koriste ga. Izbor se čuva lokalno pod ključem vezanim za konkretan nalog. Odjava resetuje prikaz, ali ne prepisuje poslednji izbor podrazumevanom vrednošću.

Obnova je vremenski ograničena. Kasni rezultat drugog naloga ili starog učitavanja ne menja novi izbor. Izričit izbor korisnika ima prednost čak i kada odabere istu, podrazumevanu nameru. Upisi istog naloga su serijalizovani; zastoj jednog naloga ne zaustavlja drugi. Root ne otvara pogrešan workspace dok se početna namera obnavlja.

Ovo je lokalna navigaciona preferencija, ne nova serverska uloga ili aktiviranje Radnog profila. Ne sinhronizuje automatski izbor između uređaja. Greška lokalnog čuvanja ne sprečava prijavljivanje; zato nije obećanje trajnog pamćenja pri neispravnom skladištu.

### 2.2. Novi Zadatak posle završenog razgovora

`nova.tsx` i postojeći `IntakePresentation` dobijaju radnju `Novi Zadatak` kada je stari razgovor COMPLETED ili ABANDONED. Novi ulaz uklanja stari resume parametar i pokreće zasebno, stabilno identifikovano otvaranje razgovora. Prethodni razgovor i nacrt se ne brišu niti ponovo otvaraju za pisanje.

Radnja ne prolazi dok prethodni zahtev ima nepoznat ishod, nalog/fokus nisu aktuelni ili razgovor još nije završen. Dvostruki dodir ne pravi dva nezavisna otvaranja. Dodate su provere i normalnog uspešnog slanja, ne samo naknadnog čitanja nepoznatog ishoda.

To je implementacija i komponentni dokaz. Stvarni drugi Zadatak kroz živu bazu i telefon još nije dokazan.

### 2.3. Bezbedne greške starih adaptera

Dodat je zajednički `legacyRpcFailure.ts`: tačan poznati simbolički naziv greške daje fiksnu korisničku poruku; nepoznat tekst daje bezbednu rezervnu poruku. SQLSTATE, detalji baze, adrese, hint-ovi i proizvoljan odgovor provajdera ne postaju tekst za korisnika.

Prilagođeni su `supabaseIzvor`, `agreementClientService`, `applicationClientService`, `contactClientService`, `ru4Production`, `productionAuthorityOverrides`, `aiCommandOverrides` i `aiProductionOverrides`. Postojeće posebno mapiranje kalendarskih grešaka je očuvano. Stari Edge adapter više ne čita proizvoljan neograničen JSON radi preuzimanja poruke.

### 2.4. Razumljiviji neuspeh razgovora

Aktuelni `aiNeedV2Production` razlikuje HTTP 401, 403, 429 i 502/503/504 preko statusa: pristup, ograničenje broja zahteva ili nedostupan servis. Ne čita privatno telo odgovora provajdera radi dijagnostike.

HTTP status nije potvrda upisa niti dozvola automatskog ponavljanja. Postojeći ograničeni 409 receipt i isti identifikator zahteva ostaju. Status 503 ne dokazuje koji je tačno konfiguracioni problem; prikazuje se nedostupnost, ne izmišljena dijagnoza.

### 2.5. Stari klijentski pozivi više ne upisuju

Legacy `posaljiPoruku` bez stabilnog ključa sada odbija takav upis sa `MESSAGE_RETRY_KEY_REQUIRED`. Pravi chat već koristi V2 outbox; nije prebačen na nov backend. Legacy `otvoriRazgovor` odbija sa `OWNED_CONVERSATION_REQUIRED`; pravi `/nova` koristi postojeći owned opener.

Tipovi i kompatibilni metodi ostaju označeni kao deprecated, ali ne pozivaju stare pisce. Nije izmišljen novi ključ za svaki stari pokušaj. Pozivi `rpc_send_agreement_message`, `rpc_ai_open_conversation` i `rpc_ai_open_need_conversation_v2` nemaju literalni netestni poziv u novom izvoru.

**Server nije zatvoren:** živa authenticated EXECUTE ovlašćenja za stare pisce nisu opozvana. To zahteva proveru stvarnih starih klijenata, integracioni test i usklađen rollout; nula poziva u ovom source snimku nije taj dokaz.

### 2.6. Penzionisana stara ruta i dva neupotrebljena donora

Stara `/prijave` ruta sa tvrdim identifikatorom `ormar` zamenjena je malim guard-ovanim preusmerenjem na prijavu ili redovni workspace. Stari URL ostaje obrađen; ne otvara drugi kandidatski tok niti nagađa Zadatak. Aktuelna ruta kandidata nije uklonjena.

Obrisani su samo `src/ui/entry/brandSvg.ts` i `src/ui/entry/figmaSplashTracks.ts`, bez production importera. Originalni V2 logo/motion nisu menjani. Istorijski HTML iz kog build izvlači potrebne resurse nije obrisan.

### 2.7. Sačuvani foreground push preuzet, ne napisan ponovo

Preuzet je petofajlni patch iz sačuvane grane `feat/v2-push-foreground-20260911` (`cba0a2645fdb31d9f19414ca7afe6a6bc93f1e0f`): owned foreground handler, njegovo uklanjanje pri promeni stanja i Android `channelId: default`, sa pripadajućim testovima.

To omogućava ispravan prikaz u otvorenoj aplikaciji kada stvarna isporuka bude povezana. Ne postavlja sender, raspored slanja ili FCM/APNs. Zadržani Inbox-only payload nije nova odluka da se odustane od planiranog direktnog otvaranja odgovarajućeg objekta.

### 2.8. Ponovljiv popis izvora

`scripts/pre_html_source_inventory.cjs` čita izvor preko postojećeg TypeScript parsera; ništa ne menja. U ovom snimku obuhvata 190 fajlova, 66 različitih RPC naziva / 71 literalno mesto poziva, pet dinamičkih RPC mesta, četiri Edge naziva i 22 pristupa tabelama.

Izdvaja preostala dinamička mesta i uslov pada ako se vrati literalni poziv jednog od tri penzionisana pisca ili import dva uklonjena donora. Ovo nije dokaz celog grafa poziva, dosegljivosti, živih dozvola ili bezbednosti svakog RPC-a. Više čitača istih podataka je dozvoljeno; problem su neusaglašena pravila upisa, ne sam broj čitača.

Pokretanje: `node scripts/pre_html_source_inventory.cjs inventory.json`.

## 3. Šta je nasleđeno, a nije nova zasluga ovog paketa

PR100 već nosi ispravno slanje `full_name` pri registraciji i popravljeni focused/background lifecycle. PR99 već nosi ponuđeni termin, nove kolekcije, Entry handoff i prethodni pin rad. Ovde su očuvani, ne napravljeni ponovo.

M05/M06 (`60a3ce68e52cbf461639f392db877d93ba0405c7`) i kandidat SQL109 su sačuvani u prethodnom handoff-u, ali nisu integrisani niti pušteni ovim paketom. Njihova nedovršena N05 provera nije preimenovana u PASS.

## 4. Živi Supabase — ciljano read-only ispitivanje

Projekat: `leqcwgzvjsxugfgzdmth`. Očitavanja 11.09.2026. između 15:29 i 15:54 UTC. Upiti su izvršeni u READ ONLY transakcijama nad katalozima i neosetljivim agregatima; bez korisničkih razgovora, tajni ili poslovnih mutacija.

| Provera | Zabeležen rezultat |
|---|---|
| Primenjene migracije | 108; poslednja live verzija `20260911031713` |
| Javne obične tabele | 31; sve imaju uključen RLS |
| Public/private SECURITY DEFINER bez eksplicitnog search_path | 0 |
| Nevalidni ili nedovršeni indeksi | 0 |
| Nevalidirane veze stranih ključeva | 0 |
| Potpuno jednake definicije indeksa po upoređenim kataloškim poljima | 0 |
| Public view-ovi | 0 |
| Private obične tabele sa SELECT privilegijom anon/authenticated | 0 |
| Public `rpc_` rutine | 108; ovo je odvojen broj od broja migracija |
| Anon-executable RPC | samo `rpc_get_legal_bundle` |
| Rutine sa `_service` nazivom dostupne anon/authenticated | 0 |
| Spremna aktivna pravila objave | 0 |
| Aktivni pravni dokumenti / objavljene aktivne retention politike | 0 / 0 |
| Raspored poslova | samo aktivni `uskoci_marketplace_tick`, svaki minut |
| pg_net | dostupan, nije instaliran; pg_cron i Vault jesu instalirani |

Edge inventar: `uskoci-ai-interview` v17, `uskoci-location-search` v2, `uskoci-publication-evaluate` v1, `uskoci-data-export-worker` v1 i `uskoci-data-export-download` v1. Push sender nije u postavljenim funkcijama.

Pregledani su potpisi, grant-ovi i MD5 definicija javnih RPC-a. Stari proposal writer je već zatvoren za klijenta; nije ponovo proglašen novom ranjivošću. Nasuprot tome, stari message/AI open pisci i dalje imaju authenticated pristup. Legacy `rpc_get_push_device` čitanje je dostupno authenticated, dok stari set nije: čitanje i pisanje se ne smeju pomešati.

Upit za strane ključeve bez punog, neparcijalnog indeksa na početnim kolonama vraća kandidate za dublje merenje. To nije dokaz da svi ti indeksi nedostaju ili da upiti sporo rade: postoje drugi i parcijalni indeksi i različiti obrasci upotrebe. Nije automatski dodat nijedan indeks. Nisu izmereni produkcijsko opterećenje ili svi EXPLAIN planovi.

**Ovi nalazi ne znače da je ceo RLS/RPC sistem bezbednosno sertifikovan.** Uključen RLS i fiksiran search_path su početne provere, ne dokaz ispravnosti svake politike. Nije ponovo dokazana byte parity svih 108 migracija niti izmenjena istorija live verzija.

## 5. Testovi — rezultati i sačuvani neuspesi

Konačan hosted rezultat na source kandidatu: **135/135 Jest paketa, 2758/2758 testova, 0 preskočenih; TypeScript PASS.** Originalni ZIP je preuzet i njegov SHA256 odgovara GitHub artifact digest-u. Receipt tree odgovara lokalno izračunatom stablu.

Poseban foreground Edge paket: **39/39 lokalnih Node provera**, sa simuliranim Expo transportom. Završni runtime tree dodaje dva već sačuvana Edge/proof bloba i uklanja dva neimportovana donora; to nije novi puni hosted test završnog commita. Tačan opseg dokaza ostaje razdvojen.

Tokom razvoja: 105 core provera, 78 foreground/session provera i 295 završnih pogođenih provera prolazili su u svojim grupama. To su preklapajući skupovi i ne sabiraju se sa 2758 kao nezavisni testovi.

Sačuvani su i neuspesi: novi route-test mock je prvobitno imao problem sa Jest hoisting-om; dva stara mock-a nisu znala za novi bind metode; stara očekivanja tražila su sirove greške i penzionisani route sadržaj. Ispravljeni su prema novim izričitim ugovorima i ponovo provereni samo pogođeni paketi. Jedan dovršen raniji full run imao je 2754/2755 PASS; preostalo je zastarelo route očekivanje koje je potom ispravljeno. Dva lokalna puna pokušaja zaustavila je granica izvršavanja; njih ne nazivamo PASS. Završni čist hosted run daje puni prolaz.

Pri connector prenosu jedne base64 poruke izgubljen je jedan znak. Hash provera je zaustavila pokušaj pre primene izvora. Verifier je normalizovao samo taj potpuno poznati SHA256 transportnog zahteva u nezavisno izračunati originalni SHA256. Ni patch hash, before/after hash svakog fajla, tree provera, zavisnosti ni testovi nisu oslabljeni. Promena tog kontrolnog runner-a nije deo runtime grane.

Nema native/Android/iOS, stvarnog provajdera, SQL integracionog, CodeQL ili produkcijskog E2E prihvatanja za ovaj novi paket. Postojeći Jest open-handle/Expo upozorenja nisu predstavljena kao uklonjena.

## 6. Otvoreno — bez skrivanja iza reči cleanup

| Posao | Stanje posle ovog paketa |
|---|---|
| Jedini Worker location i availability writer | Nije zatvoreno; opšti profil još upisuje deo tih podataka. Potrebna koordinisana izmena klijenta i forward SQL-a. |
| Server REVOKE tri stara pisca | Nije primenjen. Novi source nema literalne pozive, ali stari instalirani klijenti i integracioni dokaz ostaju. |
| Email potvrda i povratak na zaštićeni objekat posle prijave | Nisu dovršeni. Pamćenje namere nije zamena za te tokove. |
| M05/M06, SQL109, post-DONE pravilo, event semantika | Nisu integrisani niti rešeni ovim paketom. |
| Pravi AI/LocationIQ odgovor, aktivacija legitimne objave | Nisu izvršeni. Konfiguracija i odobreni sadržaj se ne izmišljaju. |
| Push sender, zaseban scheduler, bounded drain, stvarna isporuka | Nisu dovršeni. Integrisan je samo sačuvani foreground/channel deo. |
| team_capacity, zajednički lični podaci, Worker AI intervju | Preostala funkcionalna implementacija. |
| Ocene, safety/block/operator support, account closure | Preostala implementacija i stvarni postupci; nisu smanjeni na placeholder. |
| Slike/glas, grupni kanali, organizator obe namere, verifikacija | Ostaju u celom planu; nisu predmet ove završene podceline. |
| Novi HTML i objedinjavanje izgleda | Namerno se čeka novi korisnikov HTML; nema masovnog prepravljanja starih ekrana. |

Sledeći tehnički korak nije novi opšti audit: pregled ovog uskog delta paketa, provera aktuelnog stanja drugih grana, zatim usaglašavanje Worker pisaca i preostalih ključnih funkcija. Pre bilo kog canonical merge-a ili live revoke-a potrebne su njegove stvarne zavisne provere. Dokaz ovog paketa ne zamenjuje završni korisnički tok.
