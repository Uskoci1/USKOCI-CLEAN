# USKOČI — jedinstven plan završavanja proizvoda

## Kod · Supabase · povezivanje · korisnički tokovi · originalni brend · UI/UX · izdanje

**Datum:** 8. septembar 2026.  
**Status dokumenta:** predlog izvršenja na osnovu priloženog izveštaja, prethodno potvrđenog product canona i ograničene nove read-only provere. Ovo nije tvrdnja da su planirane funkcije već implementirane.  
**Repo:** `Uskoci1/USKOCI-CLEAN` · **grana:** `clean-alpha-backend` · **Supabase:** `leqcwgzvjsxugfgzdmth`.

## 1. Šta ovim planom završavamo

Cilj nije još jedan backend temelj, još jedan Figma koncept ili još jedna lista nedostataka. Cilj je jedna stvarno upotrebljiva USKOČI aplikacija: Naručilac opisuje posao, potvrđuje Zadatak, sistem nalazi relevantne Uskočere, oni dobijaju obaveštenje i prijavljuju se, Naručilac bira, nastaje Dogovor, učesnici se sporazumevaju, izvršavaju posao, završavaju i ocenjuju saradnju. Sa druge strane, Uskočer ima profil i dostupnost koji stvarno utiču na preporuke i izbor. [A, L1645–L1675]

**Ne počinjemo ponovo.** Zadržavamo postojeći transactional core i dokazanu poslovnu semantiku; dopisujemo nedostajuće veze i funkcije. Ne gradimo novu bazu, novi paralelni AI engine ili novu navigaciju. Dizajn treba da bude originalan USKOČI, a ne dekoracija generičkog AI chat proizvoda.

Pravilo rada: **kratak pregled relevantnih zavisnosti → implementacija kompletnog imenovanog toka → povezivanje sa stvarnim UI-jem → ciljane provere → demonstracija → integracija i jasno označena aktivacija.** Veliki završni ciklus provere ostaje pred izdanje, ali bezbednost, integritet podataka i privatnost ne odlažu se do tada.

## 2. Osnova, proverene činjenice i granice

Priloženi `Pasted markdown(20260908-163659).md` ima 2.160 redova. On je osnovni izvor za obim i opis nedovršenih veza. Posebno su korišćeni lanci backend → client → UI, AI profili, matching/push i Product Surface Master. [A, L13–L45; L1687–L1711; L2092–L2158]

Dodatno je direktno pročitan canonical branch i postojeći `USKOCI_DESIGN_IMPLEMENTATION_GAP.md`. GitHub je u ovoj proveri vratio HEAD `80572f53d6915ae6ff0c442053b61524d92c666e`. Taj dokument u sebi zadržava stariju deklarisanu granicu posmatranja `38e9a38`; zato njegovi statusi ostaju **izvorni statusi**, a ne nova nezavisna potvrda svake funkcije. [G1, G2]

Ograničeni novi SQL pregled žive baze vratio je: **87 migracija**, head **`20260907135905`**, bez novih legal/retention/processor/export registara, bez `public.agreement_reviews`, sa **0 publication bundle redova** i **0 push device redova**. To potvrđuje da spojeni source kod i trenutno primenjena baza nisu ista faza isporuke. Rezultati su zapisani u `USKOCI_PROVERE_I_IZVORI.json`. Nisu čitani privatni sadržaji poruka ni ključevi.

U ovom koraku nisu izvršene remote izmene, promocije, novo kodiranje aplikacije ili uređajski E2E testovi. Nije ponovljena potpuna revizija svake DB funkcije i svakog source fajla. Ovaj paket je stvaran popunjen plan rada, ne lažni zapis završenog razvoja.

### 2.1 Šta u ranijem objašnjenju treba precizirati

**Broj zapisa nije dijagnoza.** Navod iz priloga o 0 assistant poruka znači da taj pregled nije pokazao trajno sačuvane AI odgovore. Sam po sebi ne dokazuje koji je uzrok, da ključ nedostaje, niti da nijedan izolovani/rollback test nikada nije odgovorio. Prvi AI zadatak je jedan stvarni instrumentirani poziv i provera celog puta. [A, L293–L323]

**Matching i push nisu ista funkcija.** Prazan push registry sprečava push ka uređaju, ali nije sam po sebi objašnjenje za prazan rezultat matching-a. Nezavisno proveriti candidate eligibility, ulazne podatke, publication, dispatch queue, preferences i transport. [A, L443–L516; modelno razjašnjenje]

**Isključen RLS nije automatski dokaz javnog curenja.** Za pet navedenih privatnih Q&A tabela nova provera pokazuje da `anon` i `authenticated` nemaju ni `USAGE` nad privatnom šemom ni direktne DML privilegije. To ne zatvara proveru svih SECURITY DEFINER putanja, ali pobija zaključak da su te tabele samo zbog RLS zastavice direktno otvorene klijentima. Potreban je ciljani permission/authority pregled, ne nasumična izmena šeme. [V1]

**Aktivan profil nije univerzalno kompletan profil.** Profil može biti dovoljan za jednu vrstu posla, nedovoljan za drugu i imati isključen push. Ne uvoditi jedno novo rigidno pravilo koje od svakog traži licencu, vozilo, minimalnu cenu i GPS. [A, L156–L244; predlog razdvajanja spremnosti]

**Dizajn se ne odlaže do kraja.** U prilogu završni UI pass dolazi posle svih funkcija. U ovom planu menjam redosled: osnovni brend, navigacija i komponente kreću u W01; svaki kasniji tok dobija svoj stvarni UI odmah. W13 je dorada i izjednačavanje kvaliteta, ne nova izrada 43 površine. Ovo je eksplicitna izmena predloga rada, ne navod da izvor već kaže isto. [A, L1514–L1547]

**Kalendar mora štititi izbor na vreme.** Autoritet zauzetosti i osnovni UI dolaze u W02, pre konačnog zatvaranja selekcije. U suprotnom bismo opet morali da rasklapamo već proglašen „završen“ izbor. [A, L727–L763; novi redosled]

## 3. Zašto je mnogo toga ostalo na pola — i šta menjamo

Izvor opisuje prvenstveno horizontalnu izgradnju: dobra šema, RPC i dokaz, ali bez završnog ekrana, popunjavanja ulaznih podataka ili spoljne isporuke. AI razgovor, dostupnost, geography i push imaju različite vrste prekida. [A, L13–L45; L1158–L1220]

To ne znači da je raniji rad izgubljen. Znači da je pogrešno brojati interne delove kao završene korisničke funkcije. Ovaj plan zato prati **roditeljski tok**, ne samo njegove migracije. Kada je dispatcher implementiran, beleži se „transport implementiran“; ceo tok „relevantan Zadatak stiže Uskočeru na telefon“ nije gotov dok ne prorade ulazni profil, matching, događaj, token, isporuka i otvaranje.

Za svaki paket postoje: odgovorni vlasnik, početni uslovi, postojeći deo koji ostaje, novi server/client/UI posao, demonstracija i granica aktivacije. Zavisnost od pravnika ili provajdera ne zaustavlja sav nezavisan razvoj: tehnički deo može stići do testiranog kandidata sa zatvorenom produkcijskom kapijom. Ali ta kapija ostaje javno vidljiva u evidenciji; ne sme se računati kao završen feature.

## 4. Šta ostaje zaključano

**Proizvod:** jedan nalog, dve namere, `Zadatak → Prijava → izbor → Dogovor`. Model novčanog povezivanja nije isto što i isplata naknade za rad. [A, L1697–L1699; L1055–L1075]

**Navigacija:** `MENI TREBA: Zadaci | U / Novi | Dogovori`; `JA MOGU: Prijave | U / Zadaci | Dogovori`. Zvonce otvara inbox, avatar Profil. `Lista | Mapa` živi unutar Zadataka za oba odgovarajuća opsega. R01/W01 Home koncepti su istorijski, ne obavezni nedostajući ekrani. [A, L1683–L1683; G2]

**Dogovor:** tačno `Pregled | Poruke`. Istorija, kontakt, promene, problem, završetak i ocena jesu sekcije/radnje, ne novi stalni tabovi. [A, L1895–L1918]

**Brend:** originalni USKOČI znak i početna animacija su polazište. Postojeći `src/ui/entry/BrandScene.tsx` i `EntryWelcome.tsx` moraju se pregledati pre bilo kakve zamene. Korisnikova poslednja vizuelna odluka ostaje: veliki logo/naziv malo iznad sredine, bez odletanja gore levo; ispod „Meni treba. Ja mogu.“. Stare alternative i raniji slogani nisu nova odluka. [G3; odluke iz razgovora]

**Cena platforme:** efektivno 0 RSD u aktivnoj besplatnoj konfiguraciji. Pozitivne cene, pretplate i proširen model naplate nisu prećutno odobreni ovim planom. [A, L1502–L1510]

## 5. Arhitektura koja dozvoljava jednostavan UI

Korisnik ne vidi tabele. Ekran prikazuje sažetak i akcije za trenutno stanje. Iza toga ide sledeći put:

`UI → state/hook/orkestrator → typed client service → RPC ili Edge → validacija i autoritativni upis → projekcija → osvežen UI`

AI se uklapa kao proizvođač **predloga činjenica**, ne kao samostalni vlasnik profila ili objave:

`poruka → AI predlog → provera strukture → pregled/korekcija korisnika → potvrda → autoritativni poslovni upis`

Događaji su poseban put:

`prihvaćena promena poslovnog stanja → događaj/outbox → preferences/eligibility → inbox/transport → deep link → ponovna provera pristupa`

Ovo je predlog pravila za usklađivanje postojećih slojeva, ne zahtev da se izbrišu postojeći legitimni servisi i projekcije. Ne uvoditi novu tabelu, novi status ili novi RPC naziv samo zato što lepo izgleda u planu. Za svaki novi simbol mora stajati da je **predlog novog ugovora**, a za postojeći tačan source i potpis.

### 5.1 Mapa podataka koju treba zatvoriti

| Podatak | Kako nastaje | Gde mu je autoritet | Ko ga koristi | Ključna zabrana |
|---|---|---|---|---|
| Zahtevi Zadatka | AI predlog + ljudska potvrda / ručna korekcija | Postojeći Need ugovor i njegove tabele | detalj, matching, Prijava, izbor | Ne čuvati nepotvrđenu pretpostavku kao korisnički zahtev. |
| Sposobnosti Uskočera | AI/ručni unos + potvrda | profile + resursi po važećem modelu | javni profil, matching, snapshot Prijave | Izmena profila ne prepisuje raniju Prijavu. |
| Približno mesto | korisnikov izbor + potvrđen resolver | postojeći geography autoritet | lista, mapa, matching | Ne odavati preciznu adresu u javnoj projekciji ili slici. |
| Precizna adresa i kontakt | ovlašćeni unos i grant | privatni podaci + directional grants | učesnici u dozvoljenom kontekstu | Ne zaključivati dozvolu iz slobodnog AI teksta. |
| Dostupnost i zauzetost | korisnik + stvarni Dogovori | availability i novi/dopunjeni commitment autoritet | kalendar, dispatch, izbor | UI upozorenje ne zamenjuje transakcijsku zaštitu. |
| Push uređaj | aplikacija posle sistemske dozvole | registry vezan za nalog/uređaj | dispatcher | Token prethodnog naloga ne sme dobijati tuđe poruke. |
| Ocena | ovlašćeni učesnik posle dozvoljenog ishoda | review ledger + agregati | profil, trust, matching | Bez lažnih zvezdica i klijentskog upisa proseka. |
| Cena povezivanja | server cenovnik + konkretan quote | verzija politike i receipt | izbor, UI, billing | Ne menjati istorijski dogovor zbog novog cenovnika. |

Ovo je traženi popis „ko popunjava bazu i ko posle čita“. Na istom principu treba evidentirati sva polja koja se otkriju u punom implementacionom pregledu. Bezvredan je backend filter čiji ulaz nijedan normalan korisnički tok ne može da popuni.

### 5.2 Šta znači završeno

Ne koristi se jedan neodređeni zeleni status. Svaka capability ima najmanje:

| Osa | Primer tačnog statusa |
|---|---|
| Kod | planirano / napisano / integrisano u canonical |
| Baza i servis | test okruženje / primenjeno u produkciji / nije primenjivo |
| UI | nema / povezano / dorada / nije potrebna korisnička površina |
| Dokaz | izvor pregledan / ciljani test / integracioni tok / fizički uređaj |
| Aktivacija | uključeno / tehnički spremno ali odobrenje nedostaje / namerno isključeno |

**Korisnički tok je završen** kada radi od svoje stvarne ulazne tačke do posledice koju obećava, sa ispravnim ovlašćenjima, obradom prekida i proverom na ciljnom izdanju. Internom worker-u ne izmišljamo ekran da bismo popunili matricu. Dokaz na jednom OS-u ne preimenujemo u dokaz na oba. Lokalni proof nije produkcijska aktivacija.

## 6. Kako ceo proizvod staje u jednostavnu aplikaciju

Tri zone ostaju spolja. Dubina postoji samo kada je korisniku potrebna.

**Zadaci / Naručilac:** moji nacrti, objavljeni i aktivni Zadaci; razumljive kartice sa sledećom potrebnom radnjom. Detalj sadrži upravljanje, kandidate i Q&A. Mapa koristi isti vlasnički opseg podataka.

**Zadaci / Uskočer:** zajednička pretraga i filteri za Listu/Mapu. Detalj objašnjava posao, uslove i mogućnost prijave. Sačuvani viewport i filteri olakšavaju povratak.

**Prijave:** jedna lista sa jednostavnim filterom i vidljivim „potrebno je da reagujete“. Promenjen Zadatak ne izgleda kao obična aktivna Prijava.

**Dogovori:** lista i kalendarska prečica. Jedan Dogovor ima Pregled i Poruke. Sledeća korisna radnja je vidljivija od administrativnih detalja.

**Profil:** lični podaci i promena namere, zatim najviše pet grupa: Lični profil, Šta nudim, Dostupnost, Podešavanja, Pomoć. Javni profil se prikazuje drugačije od privatnog urednika. Ocene i verifikacija otvaraju se u svom kontekstu, bez glavnog taba za svaku stavku.

**Podešavanja:** obaveštenja, privatnost/dokumenti/podaci i nalog. Izvoz podataka nije proizvodna zona; to je red sa stvarnim statusom i bezbednim preuzimanjem. Report i cancel nisu odvojene sekcije početnog ekrana; dolaze iz konkretnog objekta. [A, L1735–L1805; L1922–L1962]

Pravilo izbora površine: dug i fokusiran rad dobija ekran; kratka odluka dobija sheet; deo istog objekta dobija sekciju; retka administracija ide u Podešavanja. Ne gurati sve u sheet kada bi se izgubila čitljivost, tastatura ili istorija koraka.

## 7. Vizuelni pravac: originalan marketplace, ne AI šablon

### 7.1 Šta korisnik treba da oseti

**Svetlo, ljudski, pouzdano i živahno — ali mirno dok obavlja posao.** Originalnost dolazi iz USKOČI znaka, ritma kartica, tipografije, map pinova, dobrog jezika i stvarnih promena stanja. Ne iz stalno animiranih gradijenata.

Zadržati svetlu belu/toplu ivory osnovu i izražen tamni tekst. Narandžasti akcenat koristi se za ključni potez i brend, ne za svaku površinu. Statusne boje imaju pomoćnu ulogu, uz tekst/ikonu. Konačne HEX vrednosti uzeti iz odobrenog brand seta ili jasno označiti kao dizajnerski predlog; ovaj plan ne glumi da ima novu odobrenu paletu.

Kartice ne moraju sve imati ogroman radius i senku. Važnije su razlike između naslova, ključnog podatka i pomoćnog teksta. Ljudima, stvarnim poslovima, geografiji i kvalitetnim fotografijama dati prednost nad apstraktnim „AI“ simbolima. Prazan ekran treba da ponudi korisnu radnju, ne generičnu raketu i natpis „Unlock potential“.

### 7.2 Šest prepoznatljivih USKOČI elemenata

| Element | Dizajnerski zadatak | Poslovna granica |
|---|---|---|
| Originalni entry | Sačuvati znak, kompoziciju i nameru animacije; diskretno ubrzati povratni ulazak | Ne držati korisnika zarobljenog dok sesija već može da se otvori. |
| Centralno U | Prepoznatljiv oslonac navigacije sa jasnom oznakom namere | Za Naručioca kreiranje; za Uskočera Zadaci. Ne AI tab. |
| Kartica Zadatka | Veliki razumljiv naslov, termin/mesto/naknada, samo važan zahtev | Nema lažno popunjenih podataka radi lepšeg mockupa. |
| Živa review kartica | Pri promeni činjenice ista kartica diskretno ažurira konkretno polje | Nema potvrde da je sačuvano dok server to nije potvrdio. |
| Pin + mini-kartica | Pin izveden iz originalnog vizuelnog jezika, odabrano stanje i pregled posla | Lokacija je približna tamo gde politika to zahteva. |
| Dogovor sa dve celine | Miran Pregled i čist chat; važna radnja ispred istorije | Predlog izmene ne deluje kao prihvaćena izmena. |

### 7.3 Šest referentnih ekrana pre masovne izrade

Na stvarnim reprezentativnim podacima izraditi: **ulaz**, **Lista/Mapa Zadataka**, **AI razgovor sa pregledom**, **javni profil/kandidat**, **Pregled Dogovora**, **Poruke**. Onih šest moraju deliti isti sistem, a ne biti šest različitih stilova. Posle izbora jednog pravca razvijaju se sve ostale površine iz istih komponenti.

Ne raditi tri kompletna konkurentska dizajna cele aplikacije pa ih mesecima usklađivati. Mogu se uporediti ograničene varijacije nekoliko reprezentativnih ekrana, a zatim zaključati pravac i implementirati. To je predlog procesa koji sprečava beskonačni redizajn, ne ograničenje korisnikove slobode da kasnije promeni izgled.

### 7.4 Predlog motion pravila

Vremena ispod su **početne projektne mete za prototip**, ne postojeće vrednosti koda niti obećanje performansi.

| Događaj | Pokret | Početna meta |
|---|---|---|
| Pritisak dugmeta | Mala promena razmere/osvetljenja, bez pomeranja rasporeda | 100–140 ms |
| Otvaranje panela | Kratko izvlačenje koje čuva osećaj konteksta | 200–280 ms |
| Promena potvrđene činjenice | Diskretno isticanje samo promenjenog reda kartice | 180–260 ms |
| Izbor pina | Jasan prelaz selected stanja, mini-kartica bez skakanja mape | 160–240 ms |
| Važan uspeh | Jedna kratka potvrda, eventualno haptika gde ima smisla | do oko 350 ms |
| Smanjeno kretanje | Ukloniti dekorativne pomeraje, zadržati promenu stanja | po sistemskoj preferenci |

Ne animirati ceo feed posle svake poruke. Ne stavljati beskonačan puls na urgent label. Ne prikazivati lažni procenat AI razmišljanja ili izmišljeni broj „ljudi koji se trenutno javljaju“. Animacija pojašnjava događaj; ne zamenjuje ga.

### 7.5 Pristupačnost i jednostavnost su deo stila

Projektovati za čitljiv tekst, povećan sistemski font, VoiceOver/TalkBack, jasno fokusiranje, smanjeno kretanje i alternativu gestu. Kao internu mobilnu metu uzeti komforne dodirne zone oko 44–48 logičkih jedinica, uz proveru platforme; to nije isto što i tvrditi da su te jedinice WCAG CSS pikseli. Kontrast i web varijanta proveravaju se prema odgovarajućim WCAG kriterijumima. [W4]

„Jednostavno“ ovde znači: na prvom pogledu razumem **šta je ovo, šta je važno i šta sledeće mogu**. Napredne opcije postoje, ali ne opterećuju početni prikaz. Jednostavnost se ne dobija uklanjanjem error/empty/permission stanja.

## 8. Redosled rada i zavisnosti

Plan ima **14 radnih paketa W00–W13**. To su celine rada, ne 14 novih proizvoda. Detalji su u narednom poglavlju i u mašinski čitljivom `USKOCI_RADNI_PAKETI.json`.

**Glavni put:** W00 → W01 → W02 → W03/W04 → W05 → W06/W07 → W08 → W09 → W10 → W13.

**Paralelno, bez sukoba:** W07 transport može se pripremati uz test događaje dok nastaju profili i Zadaci; integraciono zatvaranje čeka stvaran izvor događaja. W11 podešavanja, podaci i operacije rade se paralelno od dostupnih autoriteta, ne ostavljaju se za poslednju noć. W12 HITNO i naplata dolaze kada bezbednost, selekcija i slanje imaju stvarnu osnovu. Dizajn je prisutan u svakom paketu od W01.

**Ne treba da baza, klijent, dizajn i marketing rade svaki po svojoj istini.** Postoji jedan integrator koji vodi canonical i promocije. Inženjer koji preuzima paket odgovara i za vezu do korisničkog ishoda; dizajner je vlasnik vizuelnog sistema i kvaliteta relevantnih površina. Kada radi jedan agent, preuzima ove uloge redom; kada ih radi više, ne menjaju istovremeno isti migration registry, ugovor ili shared component bez koordinacije.

## 9. Radni paketi — konkretni zahvati i uslovi završetka

### W00 — Konsolidacija postojećeg rada i jedan registar završavanja

**Zavisnosti:** Nema — početni paket

**Korisnički rezultat.** Postoji jedna verzija iz koje se gradi aplikacija i tačno se zna koji njen deo radi u kom okruženju.

**Zadržavamo.** Postojeći canonical, migracije, provenance, testovi i otvoreni PR-ovi; ne novi projekat i ne novi Supabase.

**Supabase i server.** Proveriti nove promene od ovog snimka. Dovršiti pregled i integraciju #77, #78, #79 ako su i dalje otvoreni; očistiti privremene reconciler workflow-e samo kada su zaista završili posao. Za ranije #67–#69/#59/#17 proveriti stvarni diff i zavisnosti umesto automatskog merge-a. Sačuvati tačne bajtove primenjenih migracija. Pending skup prvo primeniti na izolovanoj bazi u stvarnom redosledu. Zbog već evidentiranih različitih lokalnih/live timestamp-ova proveriti provenance mapiranje pre običnog db push-a. Produkciju ažurirati jednim kontrolisanim mehanizmom koji evidentira istoriju, bez paralelnog ručnog INSERT-a istih migracija. RLS/grants i command ownership proveriti odmah na visokorizičnim putanjama. Uvesti odgovarajuću zaštitu canonical grane, obavezne relevantne CI provere i kontrolisan deployment pristup; ne oslanjati se samo na dobrovoljni redosled rada.

**Klijent i povezivanje.** Zabeležiti build commit, backend release i uključene mogućnosti; proveriti da nema pogrešnog project ref-a, tajnog ključa u bundle-u ili prećutnog demo fallback-a. Registar isporuke vodi odvojeno: kod, integracija, test okruženje, produkcijska aktivacija, UI i uređaj.

**UI/UX.** Popuniti 43 postojeće površine iz ovog paketa stvarnim vezama; ne dodavati stare R01/W01 Home ekrane. Izdvojiti originalni logo i entry animaciju kao referentne assete, ne njihove nove AI kopije.

**Dokaz završetka.** Čista rekonstrukcija test baze; isto ponašanje ugovorenih komandi; tačan izveštaj primenjenih migracija; runnable build sa oznakom verzije. Nije potrebno ponavljati sve stare dokaze na svakoj dokumentacionoj izmeni.

**Granica i zavisnost.** Produkcijska promocija je zaseban odobren korak. Broj 87 ili 93 nije bezbednosni dokaz; proverava se tačan skup migracija i funkcija. Ovaj plan sam po sebi nije nalog za live write.


### W01 — Brend, osnovni dizajn-sistem, navigacija i pristup nalogu

**Zavisnosti:** W00

**Korisnički rezultat.** Korisnik ulazi u prepoznatljiv USKOČI, bira nameru i pouzdano se vraća tamo gde je krenuo.

**Zadržavamo.** Originalni logo, BrandScene/EntryWelcome, postojeća auth implementacija i potvrđeni shell sa tri zone.

**Supabase i server.** Dovršiti auth recovery, potvrdu naloga i upravljanje sesijom. Legal prihvatanje povezati sa verzijama dokumenata kada je bundle objavljen; ne praviti lažno prihvatanje. Dogovoriti koje komande zahtevaju ponovno prihvatanje i sprovesti to na serveru, ne samo checkbox-om.

**Klijent i povezivanje.** Zaštićene rute, return target, deep linkovi, promena namere i naloga, session refresh i čišćenje keša. Dozvole tražiti u trenutku konkretne koristi. Ne uključivati nedovršene OTP/social metode samo zato što provajder može da ih podrži.

**UI/UX.** Svetla topla osnova, čitljiva hijerarhija i narandžasti akcenat originalnog brenda. Napraviti početni komplet tokena i zajedničke komponente pre masovnog crtanja: dugme, polje, status, kartica, bottom sheet, list item, greška i prazno stanje. Logo i naziv u ulazu ostaju veliki, centralno malo iznad sredine; ispod „Meni treba. Ja mogu.“; bez odletanja u ugao.

**Dokaz završetka.** Novi nalog, povratni nalog, istekao recovery link, promena namere i otvaranje zaštićenog linka posle prijave. Provera tastature, većeg fonta, screen reader-a i isključene animacije.

**Granica i zavisnost.** Brend se ne menja bez eksplicitne odluke. Finalni pravni tekst nije zadatak za izmišljanje od strane dizajnera ili programera.


### W02 — Zajednički podaci: lokacija, zahtevi, dostupnost i kalendar

**Zavisnosti:** W00, W01

**Korisnički rezultat.** Zadatak i Uskočer imaju usklađene podatke o mestu, sposobnostima i terminu; kalendar štiti stvarni kapacitet.

**Zadržavamo.** need_geography, need_sensitive, worker_match_preferences, profile_availability_rules/windows i postojeći tipovi zahteva; njihov tačan vlasnik se najpre potvrđuje.

**Supabase i server.** Napraviti mapiranje polje → izvor unosa → autoritativno mesto čuvanja → potrošač. Ne uvoditi novu geo tabelu pored već postojeće bez razloga. Zajednički normalizovati kategorije, veštine, vozila, alat i licence za Zadatak i profil. Jasno odvojiti približnu javnu od precizne privatne lokacije; bez GPS-a ponuditi ručni unos i potvrdu. Čuvati vremensku zonu, trajanje i semantiku dostupnosti. Uvesti autoritet zauzetosti koji je vezan za Dogovor, sa atomskim proverama preklapanja/kapaciteta pri izboru i prihvatanju izmene, te oslobađanjem na otkazivanju i završetku. Tim nije automatski neograničen paralelni rad. Migracije za kalendar moraju doći posle odgovarajućih completion prethodnika.

**Klijent i povezivanje.** Jedni tipovi i validator za sve urednike; adapter za geokodiranje; ponovljivo čuvanje dostupnosti, izuzetaka i vremenskih prozora. Aktivni rasporedi se čitaju sa servera i osvežavaju posle promene Dogovora. Ne zamenjivati konflikt samo lokalnim upozorenjem.

**UI/UX.** Izbor lokacije je fokusiran sheet/ekran, termin ima jasne opcije, a napredni zahtevi otvaraju se samo po potrebi. Kalendar je agenda sa izborom dana/meseca iz Dogovora; Profil otvara uređivanje dostupnosti. Naručilac vidi svoje poslove, Uskočer i slobodne/zauzete intervale. Nema novog glavnog taba.

**Dokaz završetka.** Dva naloga i dve paralelne selekcije istog Uskočera u istom terminu; samo dopušteni kapacitet prolazi. Ručno uneta lokacija radi bez OS dozvole. Otkazivanje i prihvaćena promena zaista ažuriraju kalendar.

**Granica i zavisnost.** Pravila kapaciteta, privatnosti i potrebnih lokacija moraju pratiti canon. Posao na daljinu ne sme tražiti izmišljene GPS podatke. Izbor map renderera ne rešava izbor tiles/geokoding provajdera.


### W03 — AI Zadatak: razgovor, činjenice, mediji i upotrebljiv nacrt

**Zavisnosti:** W01, W02

**Korisnički rezultat.** Korisnik običnim jezikom opisuje posao, vidi kako nastaje kartica i potvrđuje baš ono što želi.

**Zadržavamo.** ai_conversations/messages/structured_facts, postojeći Need V2 review/save/edit ugovori i uskoci-ai-interview; ne drugi paralelni AI sistem.

**Supabase i server.** Prvo dijagnostikovati jedan stvarni provider zahtev i bezbedne logove: autentikacija, konfiguracija, timeout, validacija izlaza, upis odgovora i činjenica. Razdvojiti korisnikovu poruku, predlog modela i potvrđeni poslovni podatak. Tipizovan rezultat ne daje modelu pravo samostalne objave. Stabilan turn id i retry sprečavaju duple poruke, troškove i nacrte. Obraditi korekciju i supersession činjenica; spremiti verzionisani pregled pre potvrde. Fotografije: pravi storage lifecycle, bezbedne politike, metapodaci i cleanup. Glas: server transkripcija u isti razgovor, korisnik vidi i ispravlja tekst. Oba medijska kanala ne zaobilaze moderation i potvrdu.

**Klijent i povezivanje.** Jedan orkestrator razgovora koji čuva stanje, učitava nastavak, poziva Edge i osvežava karticu. Nema direktnog upisa autoritativnih činjenica sa ekrana. Prepoznatljivo razdvojiti sačuvano, čeka potvrdu i neuspešan upload. Retry ponavlja istu nameru; account switch prekida tuđ kontekst.

**UI/UX.** Kratka pitanja u vezi sa poslednjom porukom, ne AI esej. Na vrhu sažeta živa kartica, ispod razgovor; tastatura ne pokriva unos. Kartica otvara urednike za Mesto, Termin, Ljude, Uslove i Naknadu. „Potreban kombi“ je razumljiv uslov, ne JSON key. Nedostajuću cenu ne popunjavati izmišljenim iznosom. Sačuvajte nacrt nije isto dugme kao Objavite.

**Dokaz završetka.** Tekst i glas vode do istog potvrđenog nacrta; slika zaista postoji; prekid mreže ne briše unos; retry ne duplira; ponovni ulazak nastavlja pravi razgovor. Izmena postojećeg Zadatka poštuje reviziju.

**Granica i zavisnost.** Nacrt može biti dovršen i pre javne aktivacije objave. Provider uspeh ne proglašava se na osnovu samo postojanja Edge funkcije ili broja redova u tabeli. Prompts i konfiguracija ostaju verzionisani, ključevi server-side.


### W04 — AI i ručno upravljanje kompletnim profilom Uskočera

**Zavisnosti:** W01, W02, W03

**Korisnički rezultat.** Uskočer opisuje šta radi, gde i kada; potvrđeni podaci postaju upotrebljivi za relevantne Zadatke.

**Zadržavamo.** app_profiles, worker_match_preferences, profile_availability_*, own/public profile projekcije i zajednička AI infrastruktura iz W03.

**Supabase i server.** Dopuniti poseban profilni ugovor razgovora, ali ponovo koristiti transport, sigurnost i obradu činjenica. Uskladiti rad ručnog i AI unosa; atomski potvrditi međusobno zavisne podatke o profilu, geografiji i rasporedu. Jasno definisati „profil aktivan“, „sposoban za ovu prijavu“, „spreman za automatske preporuke“ i „push kanal dostupan“ kao različite stvari. Server vraća razloge nedostajućih podataka, a ne izmišljeni univerzalni procenat. Ne zahtevati vozilo/licencu/cenu unapred od osobe kojoj to nije relevantno. Ne uključivati PUSH ili HITNO pristanak zato što ih je model zaključio iz slobodnog teksta.

**Klijent i povezivanje.** Kartični urednici i AI potvrda koriste isti service boundary. Ukloniti nedosledne vlasničke upise samo uz proveru sadašnjeg ugovora, bez slepog ukidanja svih legitimnih direktnih čitanja. Izmena profila ne prepisuje istorijski snapshot već poslate Prijave. Javni profil čita samo dozvoljenu projekciju.

**UI/UX.** Profil centar ostaje kratak. „Šta nudim“ prikazuje Šta radim, Alat i vozila, Gde radim, Dostupnost i po potrebi Tim/Naknade/Uslovi. AI pomaže da se ovo popuni, ali korisnik uvek može direktno da izmeni karticu. Bez obrasca od 25 obaveznih polja i bez veština unetih kao nepregledan tekst sa zarezima.

**Dokaz završetka.** Rečenica o prevozu kombijem posle posla proizvodi odgovarajuće potvrđene podatke i relevantnost; ručna korekcija daje isti rezultat. Profil bez vozila nije blokiran za poslove kojima vozilo ne treba. Tuđa privatna polja nisu vidljiva.

**Granica i zavisnost.** PROFILE_READY_FOR_MATCHING u prilogu je cilj, ne dokaz da RPC sa tim imenom već postoji. Ne menjati ACTIVE semantiku u tišini. Minimalne obaveze zavise od stvarnog tipa usluge i odobrenog canona.


### W05 — Bezbednost, pravila objave, ceo život Zadatka i Q&A

**Zavisnosti:** W00, W01, W03

**Korisnički rezultat.** Naručilac može bezbedno da objavi, izmeni, otkaže i vodi Zadatak; korisnik može da prijavi zloupotrebu i dobije obradu.

**Zadržavamo.** Postojeći canonical publication, edit/cancel/delete RPC, policy bundle foundation, preselection Q&A i problem u Dogovoru.

**Supabase i server.** P5 report/block kao odvojen autoritet: ko može da prijavi koji objekat, evidence snapshot, pristup, limiti i operaterske odluke. Definisati primenu blokade na discovery, prijavu, izbor, Q&A i poruke; postojeći Dogovor ne sme nestati zajedno sa istorijom/dokazima. Publication evaluator mora vezati odluku za tačnu reviziju Zadatka, verziju politike, razlog i rok važenja. Proveriti ALLOW/BLOCK/CLARIFY/REVIEW i neuspešan evaluator. UI checkbox ne sme postati safety autoritet. Q&A zadržava privatnost identiteta pitaoca, moderaciju i granicu između pojašnjenja i materijalne izmene. Uključiti rate policy, ne samo report/block.

**Klijent i povezivanje.** Vezati Objavite, Izmenite, Otkažite i Obrišite nacrt na postojeće typed servise; završiti #78 binding. Receipt status je izvor istine za retry. Po objavi osvežiti listu, mapu i naredne događaje. Po materijalnoj izmeni zaštititi postojeće Dogovore i zahtevati potrebnu obnovu Prijava.

**UI/UX.** Na detalju jedna glavna radnja; retke i destruktivne radnje u ⋯ sa objašnjenjem posledice. Q&A je sekcija Zadatka, ne pre-Dogovor privatni chat. Prijavite otvara kratak kontekstni sheet. Potvrda objave vodi na stvarni objavljeni Zadatak, ne na lažni uspeh.

**Dokaz završetka.** Jedan Zadatak prolazi ceo ciklus nacrt → odluka → objava → izmena → ponovni pregled → otkazivanje. Proba starog review-a ne objavljuje noviju reviziju. Blokiran akter ne zaobilazi pravila drugim ekranom. Operater vidi i obrađuje prijavu.

**Granica i zavisnost.** Kod evaluator-a i screens mogu se završiti u izolovanom test okruženju bez lažnog pravnog odobrenja. Produkcijski ALLOW/Q&A se aktiviraju tek kada odobren sadržaj, enforcement, operacije i dokazi zaista postoje.


### W06 — Lista, mapa, pretraga, matching i kontrolisane preporuke

**Zavisnosti:** W02, W04, W05

**Korisnički rezultat.** Objavljen Zadatak je stvarno pronađiv; odgovarajućim ljudima se preporučuje iz proverljivih razloga.

**Zadržavamo.** Postojeće public/owner projekcije, match_detail, dispatch engine, dispatch_rounds, opportunity_deliveries i provereni delovi kandidatskih map PR-ova.

**Supabase i server.** Vezati isti model zahteva i profila za filtere, hard eligibility i ranking. Odvojiti pravo prijave od toga kome se šalje proaktivna preporuka. Uvažiti geografiju, intervale, kapacitet, blokade, zahteve i aktuelnu reviziju. Kod novih naloga bez ocena koristiti odobren neutralni tretman, ne izmišljenu reputaciju. Izgraditi indeksiranu pretragu/paging po stvarnim upitima i cache granice. Dispatch mora zabeležiti razlog slanja/neslanja, duplikate, istek i završetak potrage. Bazični engine prvo stvarno povezati; ADAPTIVE_DISPATCH predlog ne proglasiti implementiranim niti menjati pragove bez verzionisane odluke.

**Klijent i povezivanje.** Zajednički query/filter state za listu i mapu, stabilna paginacija, povratak sa detalja na sačuvani viewport i scroll. Provider adapter razdvaja render mape, tiles/style i geokodiranje. UI nikada ne dobija preciznu lokaciju bez prava.

**UI/UX.** Lista / Mapa, pretraga i jedan Filteri ulaz. Kartica: jasan naslov, termin, zona/udaljenost, naknada ili način dogovora, samo važan zahtev i glavni status. Mapa: mirna podloga, prepoznatljivi pinovi izvedeni iz brenda, cluster, selected pin i bottom sheet sa istim podacima. Nema izmišljene rute/ETA ni „najbolji za Vas“ bez osnova.

**Dokaz završetka.** Potvrđeni test profili sa različitim lokacijama i sposobnostima daju očekivane pozitivne i negativne rezultate. Lista i mapa prikazuju isti skup. Bez push dozvole i dalje rade ručna pretraga i dozvoljena prijava.

**Granica i zavisnost.** Za produkciju odabrati stvarni izvor tiles/style/geokodiranja, troškove, attribution i privatnost. MapLibre je renderer, ne garancija besplatnog neograničenog servisa. Napredna adaptivnost ostaje vidljiv backlog dok nije potvrđen njen obim.


### W07 — Obaveštenja: događaj → inbox → push → pravi ekran

**Zavisnosti:** W01, W05

**Korisnički rezultat.** Drugi telefon dobija relevantno obaveštenje i otvara baš odgovarajući Zadatak, Prijavu ili Dogovor.

**Zadržavamo.** Notification events, inbox, delivery/attempt tabele, push registry i preferences RPC-ovi; ponovo koristiti postojeći event ownership.

**Supabase i server.** Dopuniti emitovanje samo tamo gde nedostaje. Outbox/queue i dispatcher moraju imati atomsku rezervaciju posla, rok, retry sa odlaganjem i idempotentnost. Proveriti preferences, tihe sate, blokade i zastarelost objekta pre slanja. Uvesti slanje i obradu provider tickets/receipts, gašenje nevažećih tokena i operaterski signal za neuspehe. Ne obećavati exactly-once spoljne isporuke. Javni push payload minimizovati: ne slati privatnu adresu ili ceo razgovor na zaključani ekran.

**Klijent i povezivanje.** Permission flow, token registracija i obnova, vezivanje za nalog i uređaj, logout/unregister, više uređaja, app foreground/reconnect i cold-start deep link. Zadržati unread/paging stanje inbox-a. Preferences UI mora stvarno kontrolisati slanje.

**UI/UX.** Inbox je jednostavna lista događaja sa vremenom i jasnom sledećom radnjom. Tiha obaveštenja i izbor kategorija su u Podešavanjima. HITNO nikada ne daje lažno obećanje probijanja sistemskog Do Not Disturb režima.

**Dokaz završetka.** Objava/preporuka, nova Prijava, izbor, poruka, izmena Dogovora i završetak stižu u pravilnom kontekstu. Proveriti Android i iOS, ugašenu aplikaciju, odbijenu dozvolu, logout i zastareo link. Provider receipt nije dokaz da je čovek video poruku.

**Granica i zavisnost.** Potrebni su ispravni FCM/APNs/EAS credentials i device tokeni. Expo access token je obavezan kada je uključena dodatna push zaštita; nije univerzalna jedina blokada. Konektovanje transporta može početi paralelno sa W03/W04 uz sintetičke test događaje.


### W08 — Prijava, kandidati, izbor, kapacitet i povezivanje

**Zavisnosti:** W02, W04, W05, W06

**Korisnički rezultat.** Uskočer se prijavljuje, Naručilac razume kandidata i jednim izborom dobija jedan ispravan Dogovor.

**Zadržavamo.** Najzreliji transactional core: submit/withdraw, versions/snapshots, candidate projections, selection eligibility, idempotency i 0 RSD connection activation.

**Supabase i server.** Ne prepisivati validiranu selekciju; proširiti je samo potvrđenim nedostajućim guard-ovima za kalendar, block, pravila i kapacitet. Obezbediti dosledan redosled zaključavanja i atomsko nastajanje selekcije, Dogovora, rezervacije i connection receipt-a. Izmena profila ili Zadatka ne sme retroaktivno falsifikovati ono na šta je Prijava data. Trošak platforme odvojiti od naknade za rad. Ne vraćati penzionisani auto-selection model samo zbog ranijeg donor koda.

**Klijent i povezivanje.** Jedan request id za jednu nameru; proveriti status posle timeout-a. Obnovljiva Prijava na izmenjen Zadatak mora dobiti jasan compare/refresh tok. Kandidat se otvara kroz javnu projekciju, ne direktno iz private profila. Prelazak u Dogovor invalidira odgovarajuće liste na oba naloga.

**UI/UX.** Kratka Prijava iz već potvrđenog profila, bez ponovnog intervjua. Kandidati imaju sažeto zašto odgovaraju, uslove, termin i proverljivu reputaciju. Poređenje je opcija, ne velika tabelarna kontrolna tabla. Za više ljudi pokazati preostala mesta/kapacitet razumljivo.

**Dokaz završetka.** Dva simultana izbora, dvostruki tap, stale Prijava, blokiran kandidat i kalendarski konflikt. U dopuštenom slučaju oba naloga vide isti Dogovor, jedan connection receipt i odgovarajuću rezervaciju.

**Granica i zavisnost.** Novi UI ne sme promeniti poslovnu semantiku izbora. Postojanje 0 RSD receipt-a nije dokaz gotove plaćene naplate.


### W09 — Dogovor od prvog otvaranja do bezbednog završetka

**Zavisnosti:** W08, W07

**Korisnički rezultat.** Dvoje ljudi jasno vide šta su dogovorili, komuniciraju i završavaju posao bez kontradiktornih statusa.

**Zadržavamo.** Agreement workspace, versions, chat, directional contact grants, change proposals, cancellation i P0E completion popravke.

**Supabase i server.** Proveriti i primeniti tačne completion popravke na odgovarajuće okruženje. Predlog izmene nije promena dok ga druga strana ne prihvati; pri prihvatanju proveriti novi termin i kapacitet u istoj transakciji. Deljenje kontakta i precizne lokacije ostaje svrhovito, opozivo po postojećoj politici i nikada zaključeno iz same poruke. Automatski završetak, prijava problema i ručna potvrda moraju poštovati trenutno stanje i ne menjati već potvrđeno vreme. Otkazivanje/završetak usklađuju kalendar i događaje; redosled retry-ja ne oživljava terminalni Dogovor.

**Klijent i povezivanje.** Povezati sve stvarne komande na kontekstne radnje, stabilne retry receipts, poruke sa pending/failed/sent stanjem i realtime resync. Paginate istoriju. Ograničiti lokalni cache i očistiti ga pri promeni naloga. Ne koristiti optimistički COMPLETED bez serverske potvrde.

**UI/UX.** Unutar Dogovora tačno Pregled | Poruke. Pregled prvo daje šta, ko, kada, gde i cenu, zatim sledeću važnu radnju. Istorija je sklopiva sekcija. Predlog, kontakt, problem i potvrda završetka su fokusirani paneli, a ne dodatni glavni tabovi. Poruke ostaju najčistiji ekran.

**Dokaz završetka.** Otvoriti sa dva naloga: poruke, odobriti/odbiti izmenu, deliti/opozvati kontakt, prijaviti problem, potvrditi i automatski završiti. Testirati konkurentne završetke i pozive iz terminalnih stanja.

**Granica i zavisnost.** Problem u Dogovoru nije isto što i moderaciona prijava protiv korisnika. Zatvaranje posla ne sme automatski rešiti ili obrisati prijavljeni bezbednosni slučaj.


### W10 — Ocene, reputacija i proverljivo poverenje

**Zavisnosti:** W09, W05

**Korisnički rezultat.** Posle dozvoljenog završetka nastaje stvarna ocena koja gradi reputaciju, a bedževi imaju proverljiv smisao.

**Zadržavamo.** Postojeća rating polja/projekcije i identitetska granica; ne popunjavati ih lažnim prosekom radi demonstracije.

**Supabase i server.** Uvesti izvor ocena vezan za pravi Dogovor i pravo autora, jedinstvenost po dozvoljenom smeru, idempotentnost, moderaciono stanje i pouzdane agregate. Pravila rokova, izmena ocene, objave i uzajamnog ocenjivanja uzeti iz canona; gde fale, odvojiti predlog od aktivacije. Verifikacija zahteva operaterski ili provider tok, privatne dokaze, ograničene pristupe, expiry/revoke i minimalnu javnu projekciju. Matching koristi samo dozvoljeni verifikacioni/reputacioni rezultat.

**Klijent i povezivanje.** Poziv za ocenu iz konkretnog Dogovora, status poslato/neuspešno i proverljiv prikaz istorije. Verifikaciju učitavati sa servera; ne ostaviti trajni bedž u lokalnom state-u posle opoziva.

**UI/UX.** Kratko „Kako je prošlo?“ sa ocenom i opcionim komentarom. Novi član: „Još nema ocena“, ne lažnih pet zvezdica. Javno razlikovati potvrđen kontakt, provereni identitet i ocene; ne praviti jedan neodređeni „100% siguran“ bedž.

**Dokaz završetka.** Neučesnik ne može oceniti; retry ne duplira; nedozvoljeno stanje ne daje review pravo. Moderaciona promena dosledno utiče na agregate. Verifikacioni bedž nestaje kada autoritet više nije važeći.

**Granica i zavisnost.** Ako odobren verification provider/politika nedostaju, taj deo ostaje posebno označen BLOCKED_FOR_ACTIVATION, ne neprimetno završen. Ne obećavati bezbednost osobe na osnovu jednog bedža.


### W11 — Podešavanja, dokumenti, izvoz, zatvaranje naloga i operacije

**Zavisnosti:** W01, W05

**Korisnički rezultat.** Korisnik zaista upravlja nalogom i podacima, a platforma ima operatera koji obrađuje izuzetke.

**Zadržavamo.** P1/P2/P3/P4 foundation, postojeća preferences infrastruktura, public/private profile granice i auth lifecycle.

**Supabase i server.** Povezati objavljene verzije Uslova/Privatnosti sa evidencijom prihvatanja i odabranim command granicama. Popuniti stvarnu processor mapu i odobren retention raspored, bez proof fixture sadržaja u produkciji. Izvoz: minimalan per-account posao, worker koji pravi fajl, privatni storage, autorizovano dobijanje kratkotrajnog linka, expiry i cleanup; tuđe lične podatke iz zajedničkih razgovora/objekata rešiti eksplicitnom politikom. Zatvaranje: reauth, provera aktivnih obaveza, onemogućavanje novih radnji, sesije/push, dozvoljeno brisanje ili anonimizacija i pravno zadržavanje. Sprečiti trku između izvoza, zatvaranja i promene naloga. Operater dobija najmanji potreban pristup i audit.

**Klijent i povezivanje.** Settings, privatnost, dokumenti, export receipt/status/download i closure status koriste prave API rezultate. READY bez stvarnog dostupnog artefakta nikada ne nudi Preuzmite. Potvrda zatvaranja objašnjava posledice i preostale obaveze. Pomoć nije mrtav mailto ili nepostojeći tim.

**UI/UX.** U Profilu pet glavnih grupa, a detalji u Podešavanjima. Retki privacy tokovi nisu glavni navigacioni tabovi. Stanja zahteva su jednostavna: primljeno, obrada, spremno, potrebno je reagovati, završeno — mapirana na postojeću serversku semantiku, ne preimenovana u bazi bez razloga.

**Dokaz završetka.** Korisnik dobija stvarni izvoz samo svojih dozvoljenih podataka; drugi nalog ne može preuzeti; link i fajl ističu; closure poništava pristup; zakonski zadržane stavke nisu obrisane bez osnova. Operaterski slučaj se može obraditi od početka do kraja.

**Granica i zavisnost.** Sadržaj i pravni rokovi zahtevaju odobrene izvore. Tehnički pipeline može biti napravljen bez čekanja tih vrednosti; stvarna aktivacija ne sme koristiti proizvoljne retention rokove. Ne završavati privacy samo na tabeli zahteva.


### W12 — HITNO i naplata spremna za rad sa efektivnom cenom 0 RSD

**Zavisnosti:** W05, W07, W08, W09

**Korisnički rezultat.** HITNO je stvarna kontrolisana usluga, a cena platforme je centralno upravljiva i sada ostaje 0 RSD.

**Zadržavamo.** Postojeći urgent/dispatch engine, preview/activation ugovori i immutable promotional-free connection policy.

**Supabase i server.** HITNO preview proverava odobrene kategorije, radno vreme/rok, postojanje dopuštenih kandidata, preference i stvarni kanal slanja. Aktivacija je idempotentna; istek i zaustavljanje potrage rade; hitnost ne zaobilazi blokade, privatnost ili obaveznu kvalifikaciju. Cenovnik mora biti server-owned i verzionisan; čuvati konkretan quote/policy snapshot uz transakciju. Za odobreni plaćeni model implementirati provider adapter, webhook validaciju, idempotentnost, greške, povraćaje i reconciliation u sandbox-u. Efektivna platform cena ostaje 0, bez dummy charge-a i bez zahteva kartice u besplatnom toku. Ne uvoditi escrow/wallet/posredovanje naknade za rad bez posebne odluke.

**Klijent i povezivanje.** HITNO se pojavljuje samo kada preview i activation stanje dozvoljavaju. Prikaz razdvaja naknadu Uskočeru i platformsku naknadu. App ne prepisuje iznos iz lokalnog konstanta; obnavlja quote kada je istekao.

**UI/UX.** HITNO kao opcija na Zadatku sa mirnim objašnjenjem šta korisnik dobija i kada važi; bez crvenog haosa. U besplatnom toku jasno „Naknada platforme: 0 RSD“, a napredni billing detalji ostaju u nalogu. Cenovnik se ne menja tiho za već prihvaćene uslove.

**Dokaz završetka.** Stvaran HITNO događaj stiže dozvoljenom kandidatu i ističe kako treba. Ponovljena aktivacija ne naplaćuje/aktivira duplo. Besplatna selekcija ne poziva charge; test plaćenog toka obrađuje ponovljeni webhook i prekid.

**Granica i zavisnost.** Odvojiti FREE_READY, PAID_SANDBOX_VERIFIED i PAID_PRODUCTION_OFF. Plaćanje nije production-ready samo zato što postoji adapter. Pozitivna cena, provajder i konačna komercijalna pravila zahtevaju kontrolisanu aktivaciju, ne proizvoljno tumačenje plana.


### W13 — Završna vizuelna dorada, kvalitet, bezbednost i izdanje

**Zavisnosti:** W00, W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12

**Korisnički rezultat.** Cela aplikacija je jedna povezana, lepa i razumljiva celina, sa proverljivim izdanjem i operativnim oporavkom.

**Zadržavamo.** Dizajn-sistem i funkcionalni ekrani već građeni u prethodnim paketima; ovde nije dozvoljen novi masovni redizajn poslovne logike.

**Supabase i server.** Izmeriti realne upite, indekse i planove, isporuku redova, greške, rate limits, trošak AI-a i gužvu u redovima. Bezbednosno proveriti auth/RLS/grants/RPC/storage i servise. Podesiti monitoring bez suvišnih ličnih podataka, backup/restore proba, backward compatibility za stare mobilne verzije, kill switch i plan povratka aplikacije; SQL popravke su forward-only gde rollback ugrožava podatke.

**Klijent i povezivanje.** Ispraviti velike liste, map performance, sliku/keš, reconnect, deep links, race stanja i realne crash-eve. Izgraditi Android i iOS release kandidate, pravilne identifiers, signing i permission tekstove. Store uslove proveriti za konkretan nalog i datum izdanja umesto tvrdog oslanjanja na stare brojeve testera/dana.

**UI/UX.** Sve 43 površine i dopunske capability sekcije prolaze isti kvalitet: prostor, tipografija, copy, statusi, kontrast, veći font, čitači ekrana, tastatura, dozvole, offline i reduced motion. Uskladiti stvarne Figma komponente sa implementacijom. App icon, splash, store slike i promocija koriste originalni znak i iste boje.

**Dokaz završetka.** Jedan novi Naručilac i jedan novi Uskočer prolaze ceo tok bez SQL dopisivanja podataka. Završiti negativne scenarije, fizički push, kalendarske trke, account export/close i HITNO. Release zapis navodi build SHA, backend stanje, dokaze i aktivne funkcije; nema neobjašnjenih critical blokera.

**Granica i zavisnost.** Za funkciju koju poslovno odobrenje i dalje blokira pošteno navesti šta je završeno i šta nije aktivno. Store-ready se ne proglašava samo na osnovu tsc/Jest rezultata ili dizajnerskog prototipa.

## 10. Popunjen Product Surface Master — 43 postojeće površine

Statusi u tabeli su prijavljeni statusi iz postojećeg GAP registra i priloženog izveštaja; nisu obnovljeni E2E sertifikati. Predloženo UI mesto i zadaci za zatvaranje jesu novi deo ovog plana. Identifikatori R01/W01 izostavljeni su kao superseded. Tokovi za pravne dokumente, report/block, export i billing uklapaju se u pripadajuće površine — nemaju svaki po novi glavni ekran. Detaljnija acceptance polja dostupna su u JSON matrici. [G2; A, L1683–L1729]

| ID | Površina / korisnik | Izvorno stanje | Postojeća ruta | Predloženo mesto | Paket |
|---|---|---|---|---|---|
| S01 | Uvod i originalni brend / Oba | IMPLEMENTED u izvornom gap dokumentu | /auth | Uvod, bez nove navigacione zone | W01 |
| S02 | Izbor namere / Oba | PARTIAL | /auth | Meni treba / Ja mogu; promena kroz Profil | W01 |
| S03 | Prijava i registracija / Oba | IMPLEMENTED u izvornom gap dokumentu | /auth | Zaseban tok pre zaštićenih ekrana | W01 |
| S04 | Oporavak lozinke / Oba | NOT IMPLEMENTED | Nema završene rute | Podtok prijave | W01 |
| S05 | Dozvole u kontekstu / Oba | NOT IMPLEMENTED | Nema | Kratko objašnjenje pre sistemskog zahteva | W01 |
| S06 | Obaveštenja u aplikaciji / Oba | IMPLEMENTED u izvornom gap dokumentu | /obavestenja | Zvonce → inbox | W07 |
| S07 | Podešavanja / Oba | MISSING | Nema | Profil → Podešavanja | W11 |
| S08 | Podešavanja obaveštenja / Oba | BACKEND READY / UI MISSING | Nema | Podešavanja → Obaveštenja | W07 |
| S09 | Privatnost i podaci / Oba | NOT IMPLEMENTED; deo foundation koda naknadno merge-ovan | Nema | Podešavanja → Privatnost i podaci | W11 |
| S10 | Podrška i bezbednosni slučaj / Oba | PARTIAL; problem u Dogovoru nije opšti safety sistem | Nema samostalne rute | Kontekstni Prijavite / Pomoć; status slučaja u podršci | W05 |
| S11 | Nalog i zatvaranje / Oba | NOT IMPLEMENTED | Nema | Podešavanja → Nalog | W11 |
| R02 | AI unos i izmena Zadatka / Naručilac | PARTIAL | /nova | Centralno U / Novi → radni ekran | W03 |
| R03 | Moji Zadaci / Naručilac | IMPLEMENTED / NEEDS REDESIGN | /potrebe | Zadaci; Lista / Mapa nad mojim dozvoljenim projekcijama | W06 |
| R04 | Detalj i upravljanje Zadatkom / Naručilac | PARTIAL; edit binding #73 naknadno merge-ovan | /potrebe/[id]/pregled | Zadaci → detalj | W05 |
| R05 | Kandidati i izbor / Naručilac | IMPLEMENTED / NEEDS REDESIGN | /potrebe/[id]/kandidati | Detalj Zadatka → Prijave / Kandidati | W08 |
| R06 | Javni profil Uskočera / Oba | BACKEND READY / UI PARTIAL | Nema završene samostalne rute | Kandidat / Dogovor → javni profil | W04 |
| R07 | Pregled nacrta i potvrda / Naručilac | PARTIAL | /pregled-nacrta | Posle razgovora; povratak na korekciju | W03 |
| W02 | AI profil Uskočera / Uskočer | NOT IMPLEMENTED | Nema | Ja mogu → Dopunite profil | W04 |
| W03 | Otkrivanje Zadataka / Uskočer | PARTIAL; #67 kandidat, ne finalna integracija | /prilike | Centralno U / Zadaci; Lista / Mapa | W06 |
| W04 | Detalj prilike / Uskočer | PARTIAL; #68 kandidat | /prilike/[id] | Iz liste, pina ili obaveštenja | W06 |
| W05 | Prijava na Zadatak / Uskočer | IMPLEMENTED / NEEDS REDESIGN | /prilike/[id]/prijava | Detalj → Prijavite se | W08 |
| W06 | Moje prijave / Uskočer | IMPLEMENTED / NEEDS REDESIGN | /moje-prijave | Glavna zona Prijave | W08 |
| W08 | Uređivanje Uskočer profila / Uskočer | PARTIAL | /profil/radnik | Profil → Šta nudim | W04 |
| W09 | Dostupnost / Uskočer | BACKEND PARTIAL / UI MISSING | Nema | Profil → Dostupnost; prečica iz kalendara | W02 |
| D01 | Lista Dogovora / Oba | IMPLEMENTED / NEEDS REDESIGN | /dogovori | Glavna zona Dogovori; kalendarska prečica | W09 |
| D02 | Pregled Dogovora / Oba | IMPLEMENTED / PARTIAL | /dogovor/[id] | Dogovor → Pregled | W09 |
| D03 | Poruke Dogovora / Oba | IMPLEMENTED u izvornom gap dokumentu | /dogovor/[id], ugrađeno | Dogovor → Poruke | W09 |
| D04 | Istorija Dogovora / Oba | PARTIAL | Ugrađeno u Dogovor | Sekcija Pregleda, ne treći tab | W09 |
| D05 | Izmena, otkazivanje i problem / Oba | PARTIAL | Ugrađeno u Dogovor | Pregled → kontekstna akcija / sheet | W09 |
| D06 | Završetak i ocenjivanje / Oba | PARTIAL / REVIEW MISSING; #72 kod popravljen, live odvojeno | Ugrađeno u Dogovor | Pregled → potvrda; zatim ocena | W09 + W10 |
| M01 | Mapa Zadataka / Oba | PARTIAL / #67 PENDING | Nema završene samostalne rute | Lista / Mapa unutar Zadataka | W06 |
| M02 | Sažeta kartica pina / Oba | PARTIAL / #67 PENDING | Ugrađena površina | Donji panel izabranog pina | W06 |
| Q01 | Pretraga / Uskočer; po potrebi vlasnički opseg | NOT IMPLEMENTED u gap dokumentu | Nema | Unutar Zadataka, ne novi glavni tab | W06 |
| Q02 | Filteri / Oba, prema opsegu | NOT IMPLEMENTED u gap dokumentu | Nema | Kratak sheet iz Zadataka | W06 |
| P01 | Profil centar / Oba | PARTIAL | /profil | Avatar → Profil | W04 + W11 |
| P02 | Lični profil / Oba | PARTIAL | /profil, ograničeno | Profil → Lični podaci | W04 |
| P03 | Veštine, alat, licence, vozila / Uskočer | PARTIAL | Nema završene zasebne rute | Kartice unutar Šta nudim | W04 |
| P04 | Ocene i reputacija / Oba | NOT IMPLEMENTED | Nema | Javni i lični profil; istorija ocena | W10 |
| P05 | Verifikacija i poverenje / Oba | NOT IMPLEMENTED | Nema | Profil → Verifikacija; diskretan javni bedž | W10 |
| C01 | Kalendar Dogovora / Oba | BACKEND PARTIAL / UI MISSING | Nema | Dogovori → ikona kalendara; Profil → Dostupnost | W02 |
| MEDIA01 | Fotografije Zadatka / Naručilac | NOT IMPLEMENTED | Nema | Dodaj fotografiju u Zadatku; galerija u detalju | W03 |
| VOICE01 | Glasovni unos / Oba kroz odgovarajući AI tok | NOT IMPLEMENTED | Nema | Mikrofon u unosu, ne novi chat proizvod | W03 + W04 |
| H01 | HITNO / Naručilac; isporuka Uskočeru | CONFIG-DISABLED | Nema | Opcija u Zadatku + pregled aktivacije | W12 |


## 11. Povezivanje događaja: šta treba da osveži šta

Ovo je **ciljna matrica provere i povezivanja**, ne tvrdnja da su svi događaji i payload-i već implementirani. Nazive događaja preuzeti iz postojećeg registra; ne uvoditi drugi paralelni event sistem.

| Događaj | Šta se menja | Ko vidi posledicu | UI cilj | Provera |
|---|---|---|---|---|
| Potvrđen profil | profil/match/dostupnost prema ugovoru | vlasnik; matching servis | Profil / Šta nudim | Read-after-write potvrđuje iste podatke. |
| Objavljen Zadatak | javna projekcija i dispatch iniciranje | vlasnik i dopušteni kandidati | R04 / W04 | Objavu nije napravio samo optimistički UI. |
| Relevantna prilika | evidencija preporuke i isporuke | konkretan Uskočer | W04 | Nema ponavljanja ili slanja nakon isteka. |
| Nova Prijava | response/snapshot i candidate projekcija | Naručilac i autor | R05 / W06 | Oba konteksta dobijaju aktuelno stanje. |
| Materijalna izmena Zadatka | nova revizija i status postojećih Prijava | autor i relevantni prijavljeni | R04 / W06 | Stara potvrda ne važi prećutno za novi sadržaj. |
| Izbor | selection, Dogovor, rezervacija i receipt | učesnici | D02 | Nema duplog Dogovora niti prepunjenog termina. |
| Nova poruka | potvrđena poruka + događaj | učesnik, prema preferencama | D03 | Retry je ista poruka; privatnost payload-a. |
| Predlog izmene Dogovora | predlog, ne nova važeća verzija | druga strana | D05 unutar Pregleda | Pregled jasno označava šta čeka odluku. |
| Prihvaćena izmena | važeća verzija i nova rezervacija | učesnici | D02 / C01 | Provera konflikta i refund/quote pravila ako su primenljiva. |
| Završetak/otkazivanje | terminalni status, resursi, događaji | učesnici | D06 / C01 | Izostanak push-a ne menja serversku istinu. |
| Dozvoljena ocena | review i reputaciona projekcija | autor, primalac i javnost po politici | P04 / R06 | Samo dopušteni stvarni Dogovor. |
| Izvoz spreman | stvarni fajl i kontrolisana dostupnost | vlasnik naloga | S09 | Drugi nalog i istekao link nemaju pristup. |
| Zatvoren nalog | zabrana novih radnji, sesije/push, data lifecycle | vlasnik i ovlašćene operacije | S11 | Stari token i lokalni keš ne otvaraju zaštićene podatke. |

Push nije primarni izvor poslovne istine. Kada korisnik otvori obaveštenje, aplikacija ponovo čita trenutno stanje. Odložena poruka o Prijavi ne sme omogućiti izbor osobe koja više nije podobna.

## 12. UI stanja i veze koje nijedan ekran ne preskače

Za svaku relevantnu površinu odrediti: prvi ulazak, normalan prikaz, učitavanje, prazno stanje, spor odgovor, odbijena dozvola, mrežni prekid, istek sesije, zastarela revizija, pending komanda, uspeh i neuspeh. Ne nameće se besmislena kombinacija svima: mapa nema isti destructive state kao zatvaranje naloga.

**Čuvanje namere.** Kucani tekst, izabrani filteri i položaj liste ne nestaju zbog običnog povratka. Osetljivi podaci ne ostaju dostupni sledećem nalogu na istom telefonu.

**Pošten status.** „Sačuvano“ se prikazuje za potvrđen upis. AI može da „predloži“, poruka može da „čeka slanje“, fotografija može da „nije otpremljena“. Ne mešati ih sa konačnim rezultatom.

**Retry.** Posle timeout-a prvo utvrditi ishod ili ponoviti istu identifikovanu nameru. Ne praviti novu prijavu, Zadatak, poruku, naplatu ili ocenu samo zato što je mreža prekinuta.

**Deep link i uloga.** Pristup dolazi iz prijave i prava nad objektom, ne iz činjenice da je neko dobio URL. Povratak iz auth-a čuva dozvoljeni cilj; promena namere ne prepisuje ovlašćenja.

**Povratak.** Sa profila kandidata korisnik se vraća na tog kandidata, iz detalja na iste filtere i mapu, iz dopune podatka u isti AI pregled. Destruktivna radnja objašnjava posledice, ali ne traži tri nepotrebne potvrde.

**Reči u aplikaciji.** Korisnik čita „Zadatak“, „Prijava“, „Dogovor“, „Sačuvajte“, „Pogledajte izmene“, ne „RPC“, „receipt“, „policy bundle“ ili „gate“. Interni kodovi grešaka mapiraju se jednom na razumljiv tekst, uz bezbedan correlation id za podršku.

## 13. Raspodela rada: više implementacije, manje ponavljanja

Kao organizacionu metu koristiti korisnikov željeni odnos **oko 80% implementacije/povezivanja/dizajna i 20% potrebne provere/evidencije**. To nije razlog da se izbace rizični testovi, već zabrana da svakom malom PR-u prethodi ponovni višesatni pregled cele istorije.

Praktično: najviše dve nedovršene korisničke celine u paralelnom razvoju, plus povezani rad na dizajn-sistemu. Jedan čovek/agent vodi integraciju i produkcijsku promociju. Shared ugovori i isti fajlovi imaju jednog aktivnog vlasnika. Ako postoji blokada sadržaja/provajdera, završiti sve nezavisno, zabeležiti tačan nedostajući ulaz i preći na sledeći dozvoljeni zadatak — ne proglasiti blokirani tok završenim.

**Pre pisanja:** pročitati samo relevantni ugovor, trenutno stanje i zavisnosti. **Tokom pisanja:** implementirati server, client i relevantan UI kao jednu zaokruženu isporuku. **Posle:** ciljane provere i integraciona demonstracija; zatim CI i evidencija koja tačno imenuje ishod.

Teške istorijske rekonstrukcije pokretati kada se zaista menja migration stack ili autoritet koji zavisi od njega. Dokaz paketa mora biti vezan za sopstveni manifest i neophodan prethodnički skup; ne projektovati ga tako da njegova migracija zauvek mora biti poslednja u repou. Time se zadržavaju hash/provenance garancije bez stalnog ručnog popravljanja literalnih ukupnih brojeva pri svakom novom paketu.

Ne uvoditi masovne dependency upgrade-ove, novi state framework ili big-bang rewrite samo zato što „deluju modernije“. Potrebne kompatibilnosti proveravaju se ciljano. Broj testova i broj commit-ova nisu metrika upotrebljivosti.

### 13.1 Završni zapis svake radne sesije

Zapis treba da stane u jasnu karticu: **šta korisnik sada može**, koji kod je integrisan, šta je primenjeno u test/live bazi, koji ekran je povezan, šta je demonstrirano i na kom uređaju, šta je još blokirano, i tačan sledeći nedovršeni posao. Navesti poslednji stvarni commit/proveru, bez utiska da agent samostalno nastavlja između poruka.

## 14. Tehničke korekcije koje sprečavaju novi gubitak vremena

**Migracije.** Zvanični `supabase db push` sam evidentira uspešno primenjenu migraciju u istoriji i ima `--dry-run`. Zato uz tu putanju ne dodavati iste redove ručno. Kod ovog projekta prvo proveriti postojeće mapiranje istorijskih timestamp-ova; ne puštati standardni push naslepo preko već dokumentovanih razlika. `migration repair` nije način da se neproverena migracija proglasi primenjenom. [W1]

**Mape.** MapLibre dokumentacija razdvaja renderer od produkcionog izvora style/tiles. Za produkciju traži sopstveni izvor ili provajdera. Zbog toga „MapLibre/OSM bez ključa, troška i novog obrađivača“ nije dovoljna odluka za završeni USKOČI. Geokodiranje, privatnost zahteva, attribution i kapacitet razmatraju se zasebno. [W2]

**Push.** Expo access token je uslov kada se uključi enhanced push security. Potrebni su i odgovarajući credentials i token uređaja. Ticket/receipt potvrđuju delove serverskog puta; uspešan receipt ne garantuje da je telefon poruku primio ili prikazao. Ne obećavati exactly-once spoljne isporuke; koristiti idempotentnost i deduplikaciju u delovima pod našom kontrolom. [W3]

**Bezbednost baze.** Sva ozbiljna permission pitanja proveravaju se kroz šemu, grants, RLS, expose pravila i privilegovane funkcije zajedno. Ne kopirati automatsku remediation naredbu samo na osnovu oznake upozorenja. S druge strane, odsustvo direktnih privilegija nije razlog da se preskoči test svih RPC putanja. [V1; predlog kontrole]

## 15. Odluke vlasnika i ono što inženjer treba sam da završi

| Tema | Potreban stvarni ulaz | Šta može odmah da se izradi | Šta ostaje zatvoreno dok ulaz ne postoji |
|---|---|---|---|
| Uslovi i Privatnost | odobrene verzije, javne lokacije, datum važenja | registry, reader, acceptance, UI i test fixtures | Stvarno prihvatanje nepostojećeg pravnog sadržaja. |
| Objava/Q&A | odobren sadržaj pravila, rate/abuse politika, operaterska obrada | evaluator, command binding, UI, negative testovi | Produkcijski ALLOW i Q&A aktivacija. |
| AI | odobreni provajder(i), konfiguracija, bezbedan ključ i uslovi obrade | adapter, validacija, timeout, retry, UI i kontrolisani test | Neovlašćeno slanje stvarnih privatnih podataka ili lažan success. |
| Mapa/lokacija | produkcioni tiles/geokoding izvor, troškovi/uslovi/privatnost | provider adapter, UI, privacy-safe projections | Slanje produkcionih lokacija neodobrenom servisu. |
| HITNO | kategorije, pravila aktivacije, rokovi i eventualna cena | preview, mehanizam, UI i test okruženje | Javno uključenje pre stvarne spremnosti. |
| Čuvanje i brisanje | odobren raspored i izuzeci | pipeline, evidencija, suvi testovi, kontrola pristupa | Automatsko nepovratno brisanje po proizvoljnom roku. |
| Verifikacija | proverljiv metod/provajder i handling dokaza | kontrolisana integracija, statusi, privatni pristup | Javni bedž bez stvarne provere. |
| Pozitivna naplata | konačan model, provajder i odobren cenovnik | 0 RSD tok, quote/receipt model, plaćeni sandbox | Pozitivna produkcijska naplata. |

Ne treba vlasnik da odlučuje kako se zove svaki interni helper, kako izgleda retry backoff implementacija ili koji hook poziva reader. Tehnički izbori donose se uz jasne granice i obrazloženje. Kada izvor ne potvrđuje neki traženi obim — na primer auto-selection, novi payment model, organizacije ili nova semantika složenih poslova — to se vodi kao zasebna stavka za proveru canona, ne kao tiha „kreativna dorada“.

## 16. Milestones koji se vide na telefonu

| Milestone | Šta konkretno postoji | Šta se još ne tvrdi |
|---|---|---|
| M0 — Jedan polazni build | tačan source/backend zapis i minimalan brendirani shell | Da je cela aplikacija spremna. |
| M1 — Oba korisnika daju stvarne podatke | upotrebljiv AI/ručni profil, dostupnost, Zadatak, mediji i lokacija | Da je javna objava aktivna bez odobrenja. |
| M2 — Živa prva polovina tržišta | dozvoljena objava → relevantan kandidat → stvarna notifikacija → pravi detalj | Da svaki napredni režim dispatch-a već radi. |
| M3 — Zatvoren osnovni posao | Prijava → izbor → Dogovor → poruke/izmene → završetak → ocena, sa kalendarom | Da je plaćena naplata uključena. |
| M4 — Zaokružen nalog i operacije | preferences, podrška, privacy, export, closure, trust/HITNO po aktivacionim uslovima | Da je nerešen provider/legal gate čarobno nestao. |
| M5 — Kandidat za izdanje | ujednačen originalni UI, oba ciljna OS-a, relevantni E2E i operativni oporavak | Produkcijsko odobrenje nepostojećeg store naloga ili neizvršenog testa. |

Glavni demonstracioni scenario: **nalog A od nule napravi i objavi Zadatak; nalog B od nule potvrdi profil i dostupnost; B dobije relevantnu priliku i prijavi se; A ga bira; oba telefona vide isti Dogovor; razmene poruke, usaglase promenu, završe i ocene se.** Podaci se ne dopisuju ručno SQL-om da bi demonstracija uspela.

## 17. Provere završetka i izdavanja

Testovi se vezuju za rizik. Za transakcije obavezno proveriti idempotentnost, stale, ovlašćenja, kapacitet i paralelne upise. Za provider tok proveriti timeout, pogrešan izlaz, retry, rate limit i stvarnu isporuku. Za ekrane proveriti uobičajen tok, prazno stanje i važne granične slučajeve, bez 50 identičnih testova dekorativnog teksta.

| Scenario | Obavezni rezultat |
|---|---|
| Dva sveža naloga | kompletan glavni tok bez administrativnog pomaganja |
| Dvostruki tap / prekid mreže | nema duplog Zadatka, Prijave, izbora, poruke, ocene ili naplate |
| Paralelni izbori istog kapaciteta | samo dopušteni kapacitet; razumljiva poruka drugoj strani |
| Izmena i stara revizija | ne prihvata se nešto drugo od onoga što je korisnik video |
| Privatnost trećeg naloga | nema tuđih poruka, precizne adrese, export fajla ili verification dokaza |
| Push dok app ne radi | fizički prijem na ciljanom uređaju; tap otvara ovlašćen cilj |
| Nema GPS-a/mikrofona/push dozvole | dozvoljen alternativni tok, bez lažnog prikaza ili globalne blokade |
| Report/block i postojeći Dogovor | enforcement radi, istorija i pomoć ne nestaju |
| Otkazivanje / automatski završetak | terminalno stanje, vreme, kalendar i obaveštenja su dosledni |
| Export / closure | stvaran artefakt i dozvola; opozvane sesije; poštovan retention |
| HITNO | primenjena stvarna politika i rok, bez zaobilaženja sigurnosti |
| Cena 0 RSD | nema charge-a, kartica se ne traži; naknada za rad ostaje odvojena |
| Dostupnost i vizuelni kvalitet | čitač ekrana, veći font, kontrast, fokus, tastatura, reduced motion |
| Oporavak i stariji build | rollback aplikacije/kill switch i backward-compatible backend ne ruše podatke |

Pre javnog izdanja moraju postojati: radna podrška i moderacija, bezbedna produkcijska konfiguracija, sadržaj pravnih dokumenata, proverena data-rights obrada, monitoring i oporavak, release build i dokazi ciljnih platformi. Ne zaključavati unapred rokove store testiranja ili broj testera iz stare prepiske; proveriti uslove koji važe za konkretan nalog tada.

## 18. Tačan prvi redosled sledeće implementacione sesije

**Prvo W00.** Proveriti da li je source od `80572f53…` napredovao; potvrditi postojeće pending migracije i stvarne aktivacije. Ne vraćati repo na ovaj snimak. Dovršiti preostale PR-ove i provere samo tamo gde nisu završeni; privremene workflow-e ne ostavljati kao trajnu infrastrukturu.

**Zatim W01 i W02.** Zaključati originalni brand/shell i najvažnije komponente, auth/recovery i zajedničke podatke/kalendarski autoritet. To omogućava da AI Need i Worker profil odmah daju upotrebljive i međusobno usklađene podatke.

**W03 i W04 vode do M1.** Stvarni AI rezultat, potvrđen nacrt/profil, ručne korekcije, lokacija, raspored i relevantni resursi. Transport W07 može se nezavisno pripremati. W05 safety i evaluator grade se pre javne aktivacije.

**W05–W09 vode do M2 i M3.** Prava objava, matching, mapa, push, prijava, izbor, Dogovor i završetak. W11 account/legal/operacije ostaje aktivan paralelan posao. W10/W12 i W13 završavaju sve preostale dogovorene capability-je i izdanje.

Najvažnija promena u načinu izveštavanja: umesto „napisali smo još sedam RPC-ova“, sledeći izveštaj treba da kaže **„sada sa ovog ekrana uradite ovo, na drugom nalogu se desi ovo, a ovo još nije uključeno iz tog razloga“**.

## 19. Izvori i način čitanja paketa

**[A] Korisnikov prilog:** `Pasted markdown(20260908-163659).md`, 2.160 redova. Referentni opisi sačuvani su kao izvorni snapshot, ne kao nova tvrdnja da je svaka funkcija danas ponovo testirana. SHA-256 datoteke je u `USKOCI_PROVERE_I_IZVORI.json`.

**[G1] GitHub branch, direktno read-only očitanje u ovoj sesiji:** `Uskoci1/USKOCI-CLEAN`, `clean-alpha-backend`, HEAD `80572f53d6915ae6ff0c442053b61524d92c666e`.

**[G2] Repo dokument:** `docs/product-design-truth/USKOCI_DESIGN_IMPLEMENTATION_GAP.md` na istom commit-u. Iz njega je popunjeno 43 aktivnih površina; njegovo interno starije baseline obeležje nije prećutno promenjeno. Povezan ranije dostupan `USKOCI_SCREEN_INVENTORY.md` potvrđuje princip tri zone i excluded R01/W01.

**[G3] Potvrđeni repo tragovi brenda:** `src/ui/entry/BrandScene.tsx`, `src/ui/entry/EntryWelcome.tsx`. Njihovo postojanje je pročitano; ovaj dokument ne tvrdi da je ovde renderovana/proverena svaka animaciona putanja.

**[V1] Supabase:** ograničeni read-only SQL na `leqcwgzvjsxugfgzdmth`, migration/registry counts i schema/table privilegije pet privatnih Q&A tabela. Rezultati su izričito sačuvani u JSON provera. To nije sveobuhvatno security odobrenje.

**[W1] Zvanična Supabase CLI dokumentacija, pročitana 8. septembra 2026:** `https://supabase.com/docs/reference/cli/supabase-db-push`. Korišćena samo za preciziranje automatskog migration tracking-a, dry-run-a i razlike u odnosu na repair.

**[W2] Zvanična MapLibre React Native dokumentacija, pročitana 8. septembra 2026:** `https://maplibre.org/maplibre-react-native/docs/setup/getting-started/`. Korišćena za razliku između renderera i produkcionog style/tiles izvora; ne za odabir/odobrenje komercijalnog provajdera.

**[W3] Zvanična Expo dokumentacija, pročitana 8. septembra 2026:** `https://docs.expo.dev/push-notifications/sending-notifications/`. Korišćena za access token uslov, tickets/receipts i ograničenje garantovanja prijema.

**[W4] W3C WCAG 2.2:** `https://www.w3.org/TR/WCAG22/`. Korišćen kao referenca za kriterijume pristupačnosti; predložene mobilne mere nisu predstavljene kao identične CSS jedinicama standarda.

Svi ostali redosledi paketa, mesta panela, motion mete i konkretni acceptance scenariji su **predlozi ovog plana** izvedeni iz korisnikovog cilja. Oni ne predstavljaju već primenjene migracije, novo pravno odobrenje ili dozvolu da se izvorna product semantika menja bez odluke.
