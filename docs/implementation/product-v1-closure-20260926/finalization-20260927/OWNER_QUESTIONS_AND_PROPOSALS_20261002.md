# Pitanja za vlasnika i predlog za svako (2026-10-02)

Odgovor na zahtev „pobroji sve i daj predloge za svako pitanje koje treba da odgovorim“. Ovo je **spisak za čitanje, ne tracker**: status ostaje u `docs/control/redovi.json`, plan u LIVE planu. **Ništa ovde nije tvoja odluka dok ne odgovoriš.** Svaki predlog je radna pretpostavka tima i primenjuje se samo kao takva (zapisuje se kao pretpostavka, ne kao odluka). Pitanja na koja si već odgovorio nisu ponovljena (`docs/implementation/v5-ai-first/OPEN_INPUTS.md`, `OWNER_DECISIONS_20260924.md`, zapisi u registru).

Odgovaranje: u interaktivnoj stranici (artefakt) svako pitanje ima unapred označen predlog; možeš da prihvatiš sve ili da promeniš pojedinačne, a odgovori se čuvaju. Ili jednim redom u četu, na primer `A01 A, A02 B, A03 A`. Brojevi: menja šta gradim sada 33, izgled aplikacije 19, pre javnog izdanja 21, telefon i b22 2 (ukupno 75).

Izvori: `EX05_CANONICAL_SCOPE_20261001.md` (odeljci 8 i 9), `EX06_CANONICAL_SCOPE_20261001.md` i blok `finalization.ex06` registra, `EX07_CANONICAL_SCOPE_20261001.md` (8 i 9), `EX09_CANONICAL_SCOPE_20261001.md` i blok `finalization.ex09`, `release-prep-20260930/OWNER_INPUTS_NEEDED.md`, `ui-ux-pass-20261002/UIUX_PLAN_AND_STATUS_20261002.md`, `supabase/proofs/d12/README_D12_CANDIDATE.md`, `research/PAYMENT_READY_ARCHITECTURE_20260923.md`.

## A. Menja šta gradim sada

Odluke koje utiču na posao koji se radi ovih dana. Dok ne odgovoriš, radim po predlogu i zapisujem ga kao radnu pretpostavku, ne kao tvoju odluku.

### Glas i čet

**A01 Kako se snima glasovna poruka u razgovoru o Dogovoru?**

Dva pravila se sukobljavaju: tvoje pravilo da držanje šalje pri otpuštanju (uz pristupačni režim pregleda) i karton D03 iz plana: dodir, pregled, Pošalji.

- A (**predlog**): Držiš pa otpustiš i šalje se; pristupačni režim zadržava pregled
- B: Uvek dodir, pregled, pa Pošalji

Zašto taj predlog: To je već tvoje pravilo i važi za AI diktiranje. Ista navika svuda. Otključava: Ekran glasa u razgovoru (B2-c). Izvor: EX-05 pitanje 7; AGENTS 3.6.3.

**A02 Tekst dozvole mikrofona za glasovne poruke**

Danas aplikacija ima samo tekst dozvole za AI asistenta. Za glas u razgovoru treba poseban tekst. Tekst zavisi od odgovora na A01.

- A (**predlog**): Prihvatam nacrt: „Mikrofon se koristi samo dok držiš dugme za snimanje glasovne poruke u razgovoru o Dogovoru.“
- B: Napisaću svoj tekst

Zašto taj predlog: Nacrt kaže samo ono što aplikacija stvarno radi i ne obećava ništa o čuvanju. Otključava: Ugradnja i dozvola na Androidu; iOS tekst posebno. Izvor: EX-05 pitanja 5 i 6; EX-09 pitanje 8.

**A03 Instalacija expo-audio (zvuk za glasovne poruke)**

Uslovno odobreno 30.9: provera kompatibilnosti sa Expo SDK i postojećim zvukom je napisana. Uz instalaciju ide premeštanje Android diktiranja iza jednog adaptera, sa listom od 7 provera na pravom telefonu.

- A (**predlog**): Da, odobravam instalaciju i premeštanje
- B: Ne još

Zašto taj predlog: Bez toga nema snimanja ni puštanja u razgovoru; drugi, paralelni zvučni sistem bio bi gori. Otključava: Nativno snimanje i puštanje (B2-b). Izvor: EX-05 pitanje 5; AGENTS 3.1.5; VOICE_AUDIO_STACK_DECISION_20260930.

**A04 Može li podrška da čuje prijavljenu glasovnu poruku?**

Potvrda o prijavi danas kaže da ne može. To je u neskladu sa kontrolom prodavnice za obradu prijava.

- A (**predlog**): Ne u V1; piše se kao poznato ograničenje
- B: Da, uz poseban pristup (novi paket i pravni tekst)

Zašto taj predlog: Najmanje otkrivanja i nema novog servera; ograničenje se otvoreno navodi. Otključava: Pravni tekst o glasu i kontrola GPL-06. Izvor: EX-05 pitanje 6.

**A05 Šta znači „brisanje“ glasovne poruke?**

Ne postoji brisanje pojedinačne poslate poruke. Postoji odbacivanje pre slanja i brisanje svega pri zatvaranju naloga.

- A (**predlog**): To je dovoljno za V1
- B: Treba i brisanje pojedinačne poslate poruke (novi serverski paket)

Zašto taj predlog: Plan ne traži poseban poziv za povlačenje poruke; manji obim. Otključava: Pravni tekst o glasu. Izvor: EX-05 pitanje 6.

**A06 Tekst koji vidi stara aplikacija: „Glasovna poruka. Ažuriraj aplikaciju da je poslušaš.“**

Staroj aplikaciji glasovna poruka ne može da se pusti, pa vidi ovaj tekst.

- A (**predlog**): Prihvatam
- B: Menjam tekst (upiši u napomenu)

Zašto taj predlog: Kratko, tačno, bez obećanja. Otključava: Ništa ne blokira; vidi se samo u starim verzijama. Izvor: EX-05 pitanje 6.

**A07 Grupni čet: šta je dovoljno za V1?**

Danas grupa radi samo kao tekst koji se osvežava dodirom. Grupni push, realtime ili mediji su novi serverski paket i mogu pomeriti sertifikat zatvaranja.

- A (**predlog**): Dovoljna je tekstualna grupa sa osvežavanjem na dodir
- B: Treba grupni push
- C: Treba realtime
- D: Treba i fotografije ili glas u grupi

Zašto taj predlog: Plan ne traži više; svaki dodatak bi pomerio sertifikat i tražio nov APK. Otključava: Obim grupe (EX-05 S13). Izvor: EX-05 pitanje 8.

**A08 Probe sa porukama, fotografijama i glasom na DEV-u**

Svaka poruka ili glasovni red na DEV-u je upis. Prvi glasovni red na DEV-u trajno zatvara čist povratak Voice B1 paketa (povratak odbija dok glas postoji).

- A (**predlog**): Odobravam svaku probu posebno, kad sam u prozoru sa telefonom; unapred ništa
- B: Odobravam unapred ove probe (upiši u napomenu)
- C: Ne radi probe na DEV-u

Zašto taj predlog: Tvoje pravilo od 30.9: upis na DEV traži tvoju prethodnu reč. Otključava: Dvouređajni dokaz četa (EX-05 S10–S13). Izvor: EX-05 pitanje 9; AGENTS 3.1.8.

### Pisani komentar uz ocenu (D12)

**A09 Odluka 16: komentar o osobi koju je autor blokirao**

Sada: ako autor blokira ocenjenu osobu, ona ne vidi komentar o sebi, ne zna da postoji i ne može da ga prijavi, a svi ostali ga vide sa imenom autora. Blok je besplatan i trenutan, a jedini lek je moderacija.

- A (**predlog**): Osoba vidi komentar, lice autora je sakriveno i može da ga prijavi (funkcija bez pomeranja sertifikata)
- B: Ostaje kako je (samo moderacija)
- C: Ne upisuj komentar kad je autor blokirao ocenjenu osobu
- D: A plus pravilo za operatera kod talasa prijava

Zašto taj predlog: Zatvara rupu da blok služi za javni komentar koji osoba ne može da ospori, bez nove sertifikacije. Otključava: Mali serverski kandidat (D12a) pre uključivanja komentara. Izvor: D12 README stavka 16.

**A10 Odluka 17: prosek i pojedinačne ocene uz komentar**

Prosek i broj ocena su javni, a uz komentar se vidi i ocena. Kod malo ocena iz toga se može izračunati ocena autora koji nije napisao komentar. Rečenica „ocene bez komentara ostaju samo u proseku“ nije tačna i ne sme se koristiti.

- A (**predlog**): Ostaje kako si odlučio (ocena se vidi uz tekst); u tekstovima ne obećavamo anonimnost
- B: Sakrij zvezde uz komentar (komentar bez ocene)
- C: Prikazuj komentare tek kad ocena ima dovoljno (ti odrediš prag)

Zašto taj predlog: Ocena uz tekst je tvoja odluka D-DEC-6; dovoljno je da se ne tvrdi anonimnost. Otključava: Tekstovi u aplikaciji i prodavnici. Izvor: D12 README stavka 17.

**A11 Odluka 7: jedna lista komentara pod oba lica osobe**

Isti komentari se vide i pod profilom kao tražilac i pod profilom kao radnik. Ko je video oba lica može da ih poveže.

- A: Jedna lista (kako je sada)
- B (**predlog**): Lista po ulozi: komentar o radniku samo pod radnikom, o tražiocu samo pod tražiocem (funkcija bez pomeranja sertifikata)

Zašto taj predlog: Tvoje pravilo da osoba ima dva lica; promena je jeftina dok komentara nema. Otključava: Isti mali kandidat kao odluka 16. Izvor: D12 README stavka 7; AGENTS 3.4.4.

**A12 Kada se pisani komentar uključuje za ljude?**

Server je primenjen na DEV-u, klijent je gotov iza isključene zastavice. Za prodavnicu fale pravni tekstovi (čuvanje, rokovi).

- A (**predlog**): Uključi samo u DEV APK za test sa tvojim nalozima; prodavnica isključena dok ne bude pravnih tekstova
- B: Isključeno svuda dok ne zatvorim odluke 16, 17 i 7
- C: Ne uključuj komentare u V1

Zašto taj predlog: Možeš da ga vidiš i probaš, a javno ništa ne izlazi bez tekstova. Otključava: Zastavica u DEV workflow-u. Izvor: EX-09 pitanje 9; D12 README stavka 14.

### Posao i podudaranje (EX-06)

**A13 Zadatak sa samo jednom granicom vremena (samo „od“ ili samo „do“)**

Danas se takav zadatak odbija za svakog radnika. Radniku se ne sme izmisliti druga granica.

- A (**predlog**): Poklapaj radnike čija dostupnost pokriva zadatu granicu; druga granica ostaje otvorena
- B: Ostaje odbijen za sve (kako je danas)

Zašto taj predlog: Isto načelo kao kod „sutra“: ne izmišljamo sate koje korisnik nije dao. Otključava: EX-06 popravka F4. Izvor: EX-06 ex06a, otvorena tačka F4.

**A14 „Sutra“ i „ove nedelje“: od kog dana se računa?**

Server računa od dana objave zadatka, a ekran od dana kad ga gledaš. Posle ponoći ta dva mogu da se razlikuju.

- A (**predlog**): Jedna istina na serveru: od dana objave; ekran samo prikazuje
- B: Od dana gledanja (kako ekran danas radi)

Zašto taj predlog: Dispečing mora da bude jedinstven; ekran ne sme da obećava drugo. Otključava: Mali klijentski popravak i tekst. Izvor: EX-06 ex06a, otvorena tačka D7.

**A15 Elektro i vodoinstalaterski radovi: običan ili regulisan posao?**

Izvori politike to ne odlučuju; svaki očekivani ishod u korpusu bio bi izmišljena politika.

- A (**predlog**): Ostaje „nepoznata vrsta“ dok ti ne odrediš politiku
- B: Običan posao: dodaj vrstu
- C: Regulisan posao: dodaj vrstu uz uslov (ti definišeš uslov)

Zašto taj predlog: Ne izmišljamo politiku za posao koji može da traži licencu. Otključava: Korpus i registar sinonima (S06). Izvor: EX-06 S02 otvoreno pitanje 1.

**A16 Nove vrste poslova iz korpusa: rad na daljinu, postavljanje podova, kućni ljubimci, pakovanje**

Devet slučajeva iz korpusa očekuje „nepoznato“ jer ove vrste ne postoje među jedanaest odobrenih.

- A (**predlog**): Ne dodaju se; ostaju „nepoznato“ dok ne pregledaš korpus
- B: Dodaj sve četiri
- C: Dodaj neke (napiši koje)

Zašto taj predlog: Jedna čudna potreba ne pravi novu kategoriju automatski; o novim vrstama odlučuješ ti. Otključava: Spisak vrsta u S06. Izvor: EX-06 S02 otvoreno pitanje 2; AGENTS 3.5.1.

**A17 Šta zatvara meru „relevantno obaveštenje“ za EX-06?**

Plan traži da trajna činjenica zaista dovede do relevantnog obaveštenja.

- A (**predlog**): Trajni događaj OPPORTUNITY_AVAILABLE koji stiže samo podobnim radnicima, vidi se u Inbox-u i otvara zadatak (bez push-a)
- B: Tek push na uređaju

Zašto taj predlog: To se meri bez Firebase-a; push ostaje poseban dokaz u EX-05. Otključava: Oblik završnog dokaza EX-06. Izvor: EX-06 pitanje 2.

**A18 Budžet za plaćeni AI test (EX-06 korpus i živi lanac)**

Nijedan plaćeni poziv ne ide bez dogovorenog provajdera, broja poziva i granice. Kod je vezan za jedan Gemini model, a svaka objava zadatka košta i drugi poziv (provera objave). Pitanje je i da li se tvoje korišćenje AI-ja na HONOR-u računa kao nov test.

- A (**predlog**): Nema plaćenih poziva dok ne dam provajdera, model, broj poziva, gornju granicu i naloge; korpus ostaje sintetički
- B: Dajem budžet (upiši u napomenu: provajder, model, broj poziva, gornja granica, nalozi)

Zašto taj predlog: Ne predlažem iznos u tvoje ime. Otključava: EX-06 S08 i živi lanac S09. Izvor: EX-06 pitanje 1; EX-09 pitanje 11.

**A19 Privatnost korpusa za AI**

Korpus je sintetički ili ga pišeš ti.

- A (**predlog**): Potvrđujem: korpus je samo sintetički ili moji tekstovi; nijedan stvarni tekst korisnika ne ide provajderu
- B: Dozvoljavam stvarne opise sa kartice A02 (napiši ko ih piše i da li je postojeće obaveštenje dovoljno)

Zašto taj predlog: Pravilo 3.4.2: sirovi razgovori ne idu u repozitorijum, a ni stvarni tekst trećoj strani bez obaveštenja. Otključava: Korpus i S08. Izvor: EX-06 pitanje 5.

**A20 Sme li javni naslov, zaokružena udaljenost ili cena na zaključan ekran?**

Važi samo ako push uđe u izdanje. Globalno pravilo zabranjuje tekst koji je korisnik sam napisao.

- A (**predlog**): Ne: ostaje opšti tekst obaveštenja
- B: Da, dozvoli naslov, udaljenost i cenu javnog zadatka

Zašto taj predlog: Najmanje otkrivanja na zaključanom ekranu. Otključava: Sadržaj push obaveštenja. Izvor: EX-06 pitanje 7.

**A21 HITNO (hitna objava) u V1?**

Politika je isključena: nema registra kategorija ni cenovne politike.

- A (**predlog**): Van V1; politika ostaje isključena
- B: U V1 uz tvoju politiku kategorija i cene

Zašto taj predlog: Ne postoji osnova za cenu ni za kategorije. Otključava: Obim V1 i tekstovi prodavnice. Izvor: EX-06 pitanje 4; EX-09 pitanje 9.

**A22 Podsetnik pre termina (P05) u V1?**

Nije implementiran (nema planera, događaja, primaoca ni push puta) i nijedan red ga ne poseduje.

- A (**predlog**): Eksplicitno odložen posle V1
- B: U V1 (novi planer, događaj i push put)

Zašto taj predlog: Nema puta do korisnika bez push-a; bolje vidljiva odluka nego tihi izostanak. Otključava: Obim V1. Izvor: EX-06 pitanje 3; EX-09 pitanje 9.

### Push obaveštenja

**A23 Push: kako se uključuje (ako uopšte)?**

Ne postoji mehanizam „jedan primalac, jedan događaj“. Globalno uključivanje je zabranjeno. Rečenicu u AGENTS 3.1.7 o „zero-device backlog retirement“ povukao je njen sopstveni izvor.

- A (**predlog**): Pripremi paket „jedan primalac, jedan događaj“ (kandidat, povratak, dokaz) umesto globalnog uključivanja i ispravi tu rečenicu u AGENTS.md
- B: Ne radi push dok ne odlučim da li ulazi u izdanje (R02)

Zašto taj predlog: To je jedini bezbedan put koji izvori dozvoljavaju. Otključava: EX-05 S06 i S12. Izvor: EX-05 pitanje 3a.

**A24 Zaostale push isporuke na DEV-u i primalac dokaza**

Na DEV-u stoje 2 stare isporuke za radnika i jedan nezavršen pokušaj od 26.9. Uključenje bi ih potrošilo ili poslalo ispred pravog događaja.

- A (**predlog**): Ne diraj ih; primalac dokaza je moj nalog; paket mora da zaobiđe nepovezane redove
- B: Obriši ih (uz moju posebnu reč)

Zašto taj predlog: Brisanje je upis na DEV i traži tvoju reč; zaobilaženje je bezbednije. Otključava: Dizajn paketa za push. Izvor: EX-05 pitanje 3b.

### Nalog, podrška i pravo (EX-07)

**A25 Kada se EX-07 (Nalog) smatra gotovim?**

Mera reda u planu je: nema aktivne lažne komande ni praznine u politici.

- A (**predlog**): Po meri reda: iskrene kontrole, jasni blokatori izdanja, pripremljene matrice i kandidati; dokaz sa telefona po kartici ide posebno
- B: Tek kada je svaka kartica N01–N10, S01, S02 gotova uz dokaz sa telefona za trenutni build

Zašto taj predlog: Telefon je redak; red se zatvara sa jasnim ograničenjima, ne lažnim zelenim. Otključava: Kad se EX-07 zatvara u registru. Izvor: EX-07 pitanje 1.

**A26 Šta sve pripada EX-07?**

Pored N01–N10, S01 i S02: S03/S04, B01–B03, P02/P03, bezbednosna polovina B08/N06, D12, prijava pitanja u Pitanjima i odgovorima, preuređenje huba i pregled Dogovora u profilu.

- A (**predlog**): N01–N10, S01, S02 i bezbednosna polovina N06; D12 ostaje u EX-04; „Prijava pitanja“ je otkrivena granica; hub i pregled Dogovora idu u UI prolaz
- B: Sve nabrojano u EX-07

Zašto taj predlog: Ne širimo obim pretpostavkama. Otključava: Granice EX-07. Izvor: EX-07 pitanje 2.

**A27 N10: otkrivanje zatvaranja naloga sa drugog uređaja**

Danas drugi uređaj ne vidi da zatvaranje teče. Rešenje pomera sertifikat zatvaranja (nov re-bind) i traži kompatibilan APK. D12 je već primenjen sa svojim re-bindom, pa N10 ide odvojeno.

- A (**predlog**): Pripremi kandidata i dokaz; primena samo uz tvoj poseban „PRIMENI“ koji imenuje re-bind
- B: Ne radi N10 u V1; ostaje kao poznato ograničenje

Zašto taj predlog: Pripremljen kandidat ništa ne menja dok ne kažeš „PRIMENI“. Otključava: EX-07 S07. Izvor: EX-07 pitanje 8.

**A28 Lični grad (N05): ko ga piše?**

Danas nema servera koji piše lični grad.

- A (**predlog**): U V1 samo prikaz, bez olovke za izmenu
- B: Serverski writer u V1 (novi paket)

Zašto taj predlog: Manji obim; novi paket može kasnije. Otključava: Ekran profila. Izvor: EX-07 pitanje 11.

**A29 Obaveštenja o izvozu, odgovoru podrške i završetku zatvaranja**

Za push treba promena CHECK-a i push put iz EX-05.

- A (**predlog**): U V1 samo status u aplikaciji; kvote prijava ostaju kako je prihvaćeno (AF-D17)
- B: Dodaj obaveštenja (push, promena CHECK-a i EX-05)

Zašto taj predlog: Push nije odlučen; status u aplikaciji je dovoljan i iskren. Otključava: EX-07 obim i push. Izvor: EX-07 pitanje 12.

**A30 Granica zatvaranja naloga sa slučajem podrške ili prijavom (AF-D22)**

Nalog sa bilo kojim slučajem podrške ili prijavom ostaje u stanju EXCEPTIONS_PENDING: obični podaci su obrisani, nema otkazivanja, a dokazi ostaju.

- A (**predlog**): Prihvatam i javno objavljujem ovu granicu
- B: Hoću pravila zadržavanja i oslobađanja dokaza (novi rad i pravni tekst)

Zašto taj predlog: To je ono što je izgrađeno; pravila oslobađanja dolaze kad ih pravnik odredi. Otključava: Javni tekst o zatvaranju naloga. Izvor: EX-07 pitanje 9.

**A31 Ko je operater podrške i bezbednosti?**

Za privatni test si ti jedini operater (AF-D18). Postavljanje operatera na DEV-u je upis koji traži tvoju reč i tvoj ključ (ključ nikad u čet).

- A (**predlog**): Ja sam jedini operater; grant se postavlja tek na moj „PRIMENI“; test nalozi autor i treći tek uz moje odobrenje
- B: Imenujem drugu osobu (upiši u napomenu)

Zašto taj predlog: Kako je već zapisano za privatni test. Otključava: EX-07 S05 i test prijave do odgovora. Izvor: EX-07 pitanje 3; AF-D18.

**A32 Jednokratan nalog na DEV-u za pravi izvoz i zatvaranje**

Za dokaz izvoza i zatvaranja do kraja treba nalog koji se stvarno briše. Nikad tvoj nalog.

- A (**predlog**): Da: jedan jednokratni nalog kad ti javim prozor
- B: Ne još

Zašto taj predlog: Jedini način da se pravi tok vidi do kraja bez rizika po tvoje podatke. Otključava: EX-07 S10 i dokaz zatvaranja posle re-binda. Izvor: EX-07 pitanje 4.

**A33 Pomoćne trake paralelno sa glavnim radom**

Dokumentacija, čitanje i probe na disposable bazi, bez upisa na DEV: EX-05 S00–S05 (i da EX-05 poseduje D03, D04, D05, P01 i čet-deo P04) i EX-09 S00–S11, iako izdanje ide poslednje u redosledu.

- A (**predlog**): Da, pokreni ih odmah
- B: Ne dok EX-04 i EX-06 ne završe

Zašto taj predlog: Nema rizika i skraćuje put do izdanja. Otključava: Pripremu izdanja i dokaze četa. Izvor: EX-05 pitanje 1; EX-09 pitanje 14.

## U. Izgled aplikacije

Pitanja iz UI plana i iz drugog dizajn predloga. Svako ima predlog koji se primenjuje kao A/B na dizajn-tabli dok ne odlučiš.

### Ikone i boje

**U01 Boja ikona**

Jedan brend ton u malim ikonama, narandžasta samo za ono što čeka. Pitanje je i koja zelena: FactArt #079C77 ili UI #076E4E.

- A (**predlog**): Da: jedan ton, UI zelena #076E4E, uz A/B karticu na dizajn-tabli
- B: Vrati dvotonske ikone (V28 izgled)

Zašto taj predlog: Ikone, naslovi i glavno dugme se slažu. Otključava: FactArt, tab bar, kartice. Izvor: UI plan pitanje 1.

### Početna

**U02 Vrata na Početnoj**

Fotografije iz ulaza (tražilac teal, radnik narandžasta) ili crteži izrađeni FactArt-om.

- A (**predlog**): Fotografije na ograničenim belim vratima; FactArt crteži kao rezerva ako ti se ne dopadnu na telefonu
- B: FactArt crteži

Zašto taj predlog: Tvoj ulaz već nosi fotografije; Početna dobija isti karakter. Otključava: UI talas 4. Izvor: UI plan pitanje 2.

### Ikone i boje

**U03 Ikona taba Dogovori**

Danas tri ikone liče na mehurić.

- A (**predlog**): Zadrži mehurić sa štiklom; ponude dobijaju cenovnu etiketu; rukovanje se pokazuje kao A/B
- B: Rukovanje (siluet brenda)

Zašto taj predlog: Uklanja trostruki sudar mehurića bez precrtavanja navigacione ikone. Otključava: Tab bar. Izvor: UI plan pitanje 3.

### Navigacija

**U04 Tab bar**

Lebdeća pilula rezerviše svoj pojas; zalepljen bar je običniji.

- A (**predlog**): Zalepljen pun širine 64 dp, samo ako geometrija lista Zadaci ostane ista
- B: Lebdeća pilula sa svojim pojasom

Zašto taj predlog: Čistiji prelaz i veća meta. Otključava: UI talas 6. Izvor: UI plan pitanje 4.

### Zadaci

**U05 Redosled u Zadaci**

Zaključana struktura kaže da su u Zadaci tuđi zadaci.

- A (**predlog**): Redosled sa servera ostaje, samo oznaka; bez menjanja redosleda
- B: Moji zadaci prvi
- C: Moji zadaci posle tuđih

Zašto taj predlog: Nema reorderovanja na klijentu. Otključava: Lista Zadaci. Izvor: UI plan pitanje 5.

**U06 Dodir na traku u Zadaci**

Danas jedan dodir otvara punu listu.

- A (**predlog**): Jedan dodir vodi na punu listu; dugme Mapa nestaje pri skrolu
- B: Poluskok sa vidljivom mapom

Zašto taj predlog: Zadržava poznato ponašanje. Otključava: UI talas 6. Izvor: UI plan pitanje 6.

**U07 Podloga mape**

Bele kontrole slabo se odvajaju od skoro bele mape.

- A (**predlog**): Bez promene palete; jače ivice kontrola; tamnija podloga kao A/B
- B: Tamnija topla neutralna podloga (oko #EDECE6)

Zašto taj predlog: Najmanja promena koja rešava čitljivost. Otključava: UI talas 7. Izvor: UI plan pitanje 7.

**U08 Prazno stanje u Zadaci**

Jedna primarna radnja po ekranu.

- A (**predlog**): Zeleno primarno „Osveži zadatke“ (tiho „Dopuni radni profil“)
- B: Redosled kao danas

Zašto taj predlog: Osvežavanje je ono što prazan ekran najčešće traži. Otključava: UI talas 6. Izvor: UI plan pitanje 8.

### Ikone i boje

**U09 Catalog27 slike (tvoji crteži)**

Tri ekrana koriste sjajne PNG slike drugačijeg izgleda.

- A (**predlog**): Povuci ih sa Podrška, Privatnost i Pravna dokumenta u korist FactArt-a; galerija ih zadržava
- B: Zadrži ih

Zašto taj predlog: Jedan sistem ikona. Otključava: UI talas 12. Izvor: UI plan pitanje 9.

### Pokret

**U10 Haptika**

Danas se oseti tik i pri običnoj navigaciji.

- A (**predlog**): Bez tika pri dodiru za navigaciju; tik samo za promene stanja i potvrđene ishode
- B: Kao do sada

Zašto taj predlog: Tik znači ishod, ne dodir. Otključava: UI talas 1 i 2. Izvor: UI plan pitanje 10.

### Dogovori

**U11 Poruke u Dogovoru**

Kanon traži vidljiv Pregled i Poruke, a ekran ih nema.

- A (**predlog**): Vidljiv tab „Poruke“ umesto ikone (menja raniju odluku tima R21)
- B: Ikona kao do sada

Zašto taj predlog: Čet je najčešći deo Dogovora. Otključava: UI talas 10. Izvor: UI plan pitanje 11.

**U12 Boja mog balona u razgovoru**

Dve zelene u istom ekranu.

- A (**predlog**): Objedini sa brend zelenom #076E4E (beli tekst, isti kontrast)
- B: Zadrži #07543F

Zašto taj predlog: Jedna zelena. Otključava: UI talas 11. Izvor: UI plan pitanje 12.

### Zadaci

**U13 Fotografija zadatka na kartici i cena na pinu mape**

Oba traže serverski kandidat i tvoje „primeni“. Fotografija na kartici obrće tvoje pravilo od 24.9. da se slike vide tek u detaljnom prikazu.

- A (**predlog**): Ne za sada
- B: Da, pripremi serverske kandidate (uz tvoje „primeni“)

Zašto taj predlog: Poštuje tvoje pravilo i ne otvara nov server. Otključava: UI talas 12. Izvor: UI plan pitanje 13.

### Predlog iz drugog dizajn prolaza

**U14 Naslovi i cene tintom umesto zelenom**

Predlog iz dizajn prolaza od 2.10. (artefakt 1Y6mDefL2ZReTPavyqZ1Lw); nisam ga proveravao.

- A (**predlog**): Zadrži zelene naslove (tvoj zapis: zeleni naslovi su izričito dobrodošli)
- B: Tinta

Zašto taj predlog: Poštuje tvoj zapisani izbor. Otključava: Kartica zadatka i detalj. Izvor: Dizajn prolaz 2.10., odluka 1.

**U15 Dogovor kao tamna „šumska“ površina (#0E3D37)**

Predlog iz istog prolaza; pravilo za čitanje je bela površina.

- A (**predlog**): Ne: Dogovor ostaje bela čitljiva površina; šumska kao A/B na tabli
- B: Da

Zašto taj predlog: Pravilo 3.6 traži bele površine za čitanje. Otključava: UI talas 10. Izvor: Dizajn prolaz 2.10., odluka 2.

**U16 Kapsule za akcije i segmente**

Isti prolaz predlaže kapsulu za svaku radnju.

- A (**predlog**): Kapsula za segmente (tabove) da; akcije kao A/B
- B: Sve kapsule
- C: Ne

Zašto taj predlog: Segmenti su deo plana (talas 8); akcije vidiš pre odluke. Otključava: UI talasi 8–10. Izvor: Dizajn prolaz 2.10., odluka 3.

**U17 Cena u kapsuli na pinu**

Traži odobrenje plana 14.6 i serverski podatak.

- A (**predlog**): Kasnije (talas 7), kao A/B
- B: Odmah

Zašto taj predlog: Pin je tvoja posebna odluka (6% veći, bela kapsula). Otključava: UI talas 7. Izvor: Dizajn prolaz 2.10., odluka 4.

**U18 Ravne ikone u tab baru**

Tab bar danas koristi 2.5D crteže.

- A (**predlog**): Da (talas 2.1 koristi ravni presek kad ikona nije izabrana)
- B: Ostaju 2.5D FactArt ikone

Zašto taj predlog: Čitljivije na 24 px i skladno sa planom. Otključava: UI talas 2. Izvor: Dizajn prolaz 2.10., odluka 5.

**U19 Offline izvor (nova zavisnost za stanje mreže)**

Danas nema izvora koji kaže da nema mreže.

- A (**predlog**): Ne sada; preporuka za kasnije
- B: Odobri zavisnost

Zašto taj predlog: Nova zavisnost traži tvoje odobrenje i nije hitna. Otključava: Stanja bez mreže. Izvor: Dizajn prolaz 2.10., odluka 6.

## R. Pre javnog izdanja

Treba ti ih zatvoriti pre prodavnica; ništa od ovoga ne blokira rad ovih dana osim R01 i R02.

### Obim i platforme

**R01 iOS u prvom izdanju?**

Nema Apple naloga, iOS identiteta ni iPhone-a. Od odgovora zavise glas i push na iOS-u i polovina svake kartice naloga.

- A (**predlog**): Ne: prvo Android; iOS je zapisano ograničenje
- B: Da: treba Apple nalog, bundle id i iPhone

Zašto taj predlog: Ništa od iOS-a danas ne postoji. Otključava: Obim izdanja i pisanje „obe platforme“. Izvor: EX-05 pitanje 4; EX-07 pitanje 1; EX-09 pitanja 1 i 14.

**R02 Push u prvom izdanju prodavnice?**

Paket rs.uskoci nema Firebase klijent; Firebase, FCM, Expo token i APNs su tvoji nalozi.

- A (**predlog**): Ne (dok ne postoji Firebase aplikacija za rs.uskoci)
- B: Da: Firebase Android aplikacija, FCM i Expo token

Zašto taj predlog: Bez naloga nema puta; P4 se zatvara na Android preview dokazu. Otključava: EX-05 S06 i S12, J14 i obaveštenja u izdanju. Izvor: EX-05 pitanje 2; EX-06 pitanje 2; EX-09 pitanje 7.

### Novac

**R03 Besplatno 0 RSD ili naknada pre prvog javnog izdanja?**

Cenovnik je na 0 RSD, plaćanje je isključeno. Ako je naknada obavezna pre izdanja, otvaraju se odluke P1–P12: ko plaća, cena, putanja plaćanja, povraćaji, fiskalizacija.

- A (**predlog**): Besplatno 0 RSD u prvom izdanju; plaćanje posle
- B: Naknada pre prvog javnog izdanja

Zašto taj predlog: Odlučio si 24.9. da plaćanje čeka proveru osnovnih tokova na telefonu. Otključava: Uslovi, tekstovi prodavnice, plaćanje. Izvor: EX-09 pitanje 2; PAYMENT_READY_ARCHITECTURE.

### Okruženje

**R04 Produkcija: gde živi?**

Nema produkcionog projekta, jedina organizacija je na besplatnom planu. Test svet (pkg029e) mora da se ukloni pre pravih korisnika.

- A (**predlog**): Novi zaseban Supabase projekat sa plaćenim planom i kopijama; DEV ostaje za test
- B: Formalna promocija DEV-a (čišćenje test podataka i uklanjanje pkg029e)

Zašto taj predlog: Preporuka plana; DEV nosi test podatke. Otključava: Paket promocije, review nalozi, produkcioni dokaz. Izvor: EX-09 pitanje 3.

### Prodavnice

**R05 Google Play nalog i paket**

Ime paketa je trajno u Play konzoli. Tip naloga i datum otvaranja određuju da li važi pravilo o 12 testera.

- A (**predlog**): Potvrđujem rs.uskoci kao trajan paket; javljam tip naloga i datum otvaranja
- B: Menjam ime paketa (pre prve objave)

Zašto taj predlog: Paket se već koristi u konfiguraciji. Otključava: Prvi upload i zatvoreno testiranje. Izvor: EX-09 pitanje 5.

### Pravo

**R06 Zemlje, minimalni uzrast i zabranjene vrste poslova**

RC2 predlaže 18+; aplikacija ne proverava uzrast.

- A (**predlog**): Srbija prvo; 18+ (dodaje se potvrda pri registraciji); spisak zabranjenih poslova pišem ja
- B: Drugo (upiši u napomenu)

Zašto taj predlog: Poklapa se sa predlogom RC2. Otključava: Prodavnice, LEG-19. Izvor: EX-09 pitanje 6; EX-07 pitanje 7.

**R07 Pravna forma i podaci operatera**

Operater nije registrovan. Tim ne izmišlja firmu, adresu, broj, mejl ni potpis.

- A (**predlog**): Dajem podatke kad registrujem firmu; do tada ostaju [[OPERATER]] polja
- B: Objavljujem kao fizičko lice (upiši podatke)

Zašto taj predlog: Koren svih pravnih tekstova. Otključava: Svi javni tekstovi i forme prodavnica. Izvor: EX-07 pitanje 5; EX-09 pitanje 4.

**R08 Domen, hosting i javne stranice**

Uslovi, Privatnost, Podrška i brisanje naloga treba da imaju javnu adresu.

- A (**predlog**): Kupujem domen; stranice idu na njega; fascikla USKOCI-SAJT/Vercel je domaćin (potvrdi)
- B: Drugo (upiši u napomenu)

Zašto taj predlog: Apple traži i sajt organizacije sa njenim domenom. Otključava: Javni URL-ovi u prodavnicama. Izvor: EX-09 pitanje 13.

**R09 Pošiljalac mejla i Supabase Auth**

Ugrađeni Supabase mejl radi samo za članove tima (2 poruke na sat).

- A (**predlog**): Podesiću pošiljaoca (SPF, DKIM, DMARC) i Auth (Site URL, lista preusmeravanja) kad domen postoji; tim priprema listu polja
- B: Drugo (upiši u napomenu)

Zašto taj predlog: Zavisi od domena. Otključava: Potvrda registracije i oporavak lozinke na pravom provajderu. Izvor: EX-07 pitanje 5.

**R10 Rokovi čuvanja (12 odluka u LEG-10) i pravni pregled**

Tim ne sme da izmisli brojeve rokova.

- A (**predlog**): Dajem uz pravnika; do tada mehanizam bez vrednosti
- B: Dajem sada (upiši u napomenu)

Zašto taj predlog: Brojeve određuje pravnik, ne tim. Otključava: Objava izvoza (N09), tekstovi o zatvaranju. Izvor: EX-07 pitanje 6; EX-09 pitanje 10.

**R11 Pravni registar i saglasnost**

Pravila bezbednosti i ADR kao aneks Uslova ili kao nova vrsta dokumenta (menja sertifikat i traži https adresu). Kada se traži saglasnost i šta pri odbijanju.

- A (**predlog**): Aneks Uslova; saglasnost pri prvom ulasku; bez saglasnosti nema pristupa; 18+
- B: Nova vrsta dokumenta

Zašto taj predlog: Ne pomera sertifikat. Otključava: Kapija saglasnosti. Izvor: EX-07 pitanje 7.

**R12 Brisanje naloga bez aplikacije (veb)**

Ljudi bez pristupa aplikaciji moraju moći da zatraže brisanje.

- A (**predlog**): Ručna obrada zahteva od operatera; identitet preko email adrese naloga; stranica se objavljuje tek kad domen postoji
- B: Drugo (upiši u napomenu)

Zašto taj predlog: Ne traži nove podatke ni zavisnosti. Otključava: LEG-08, GPL-04. Izvor: EX-07 pitanje 10.

### Operativa

**R13 Vidljivost padova i ANR-a**

Nova zavisnost menja odgovore u prodavnicama.

- A (**predlog**): Samo konzole prodavnica u prvom izdanju (bez nove zavisnosti)
- B: Odobri zavisnost za izveštavanje o padovima ili OTA (menja Data Safety i App Privacy)

Zašto taj predlog: Nema nove zavisnosti i novih odgovora. Otključava: Izbor alata za operativu. Izvor: EX-09 pitanje 12.

**R14 Geokoder i pločice mape za produkciju**

Državni registar adresa ili LocationIQ; javni OpenFreeMap nema SLA.

- A (**predlog**): Odluka pre javnog izdanja; do tada kao u internom testu
- B: LocationIQ plaćeni plan
- C: Državni registar adresa

Zašto taj predlog: Interni test ne traži izbor. Otključava: Pretraga mesta u produkciji. Izvor: Odluke vlasnika 24.9. (tačka 8); EX-09 kapija 20.

**R15 „U blizini“ (lokacija uređaja)**

Nova zavisnost expo-location i dozvola lokacije.

- A (**predlog**): Da, ali tek kad osnovni tokovi prođu na telefonu
- B: Ne u V1

Zašto taj predlog: Preporučeno posle osnovnih tokova. Otključava: Ekran Zadaci. Izvor: Odluke 24.9. (ostalo otvoreno).

### Novac

**R16 Plaćeni resursi**

Supabase plan sa kopijama, produkcioni Gemini nalog, LocationIQ, EAS plan, SMTP, domen, budžetski alarmi.

- A: Odobravam ove kategorije; iznose potvrđujem pri svakoj kupovini; budžetski alarmi se uključuju
- B (**predlog**): Odobravam pojedinačno, kad zatreba

Zašto taj predlog: Novac je tvoj; svaka kupovina ide uz tvoju reč. Otključava: Produkcija i izdanje. Izvor: EX-09 pitanje 11; ulaz 11.

### Pravo

**R17 Završni prolaz privatnosti (EX-08): kada?**

Dve grane (AI minimizacija konteksta i inventar procesora) čekaju taj prolaz.

- A (**predlog**): Posle UI prolaza, pre zamrzavanja kandidata za izdanje
- B: Posle prve interne objave

Zašto taj predlog: Forme prodavnica ne mogu biti konačne pre prolaza. Otključava: Data Safety i App Privacy odgovori. Izvor: AGENTS 4.5; EX-09 kapija 17.

### Operativa

**R18 Javni repozitorijum i dva procurela Google ključa**

Repozitorijum je javan; dva aktivna Google ključa su javno vidljiva (cleanup-inventory-20260930).

- A (**predlog**): Rotiram ili ograničavam oba ključa i prebacujem repozitorijum u privatan do izdanja
- B: Samo ključevi

Zašto taj predlog: Privatnost do izdanja bez troška. Otključava: Higijena naloga pre izdanja. Izvor: EX-09 pitanje 13 i kapija 22.

### Prodavnice

**R19 Konačna vizuelna referenca i tekstovi prodavnica**

Naziv, opis, ključne reči i screenshotovi.

- A (**predlog**): Odlučujem posle UI prolaza, kad je izgled zamrznut; pravi screenshotovi tek tada
- B: Odlučujem sada

Zašto taj predlog: Screenshotovi pre zamrzavanja izgleda bi se menjali. Otključava: Listing prodavnica. Izvor: Ulaz 14.

### Obim i platforme

**R20 Koje zastavice nosi javni build?**

Zastavice iza kojih stoje gotove funkcije (D12 komentar, EX-04 liste, glas...).

- A (**predlog**): Samo zastavice dokazane na telefonu; D12 komentar isključen dok A12 nije zatvoren
- B: Sve gotove zastavice uključene

Zašto taj predlog: Telefonski dokaz je uslov. Otključava: Sastav javnog builda. Izvor: EX-09 praznina G07.

**R21 Glasovne poruke u prvom izdanju: koje platforme?**

Pravilo kaže da su glasovne poruke obavezan deo V1.

- A (**predlog**): Samo Android dok iOS ne postoji
- B: Obe platforme
- C: Odloži glas iz prvog izdanja

Zašto taj predlog: Prati odgovor na R01. Otključava: Tekstovi prodavnice, dozvole. Izvor: EX-05 pitanje 4; EX-09 pitanje 8.

## T. Telefon i B22

Dve reči koje čekaju merenje na telefonu.

### B22

**T01 Zatvaranje B22 (Reanimated)**

Zakrpa uklanja poplavu loga (greške 2.699 → 0, log 465.742 → 1.100 linija). Za zatvaranje fale probe animacija P1, P2, P4 (oko 3 minuta) i tvoja reč.

- A (**predlog**): Zatvori B22 kad probe prođu; ja prijavim rezultate, ti kažeš reč
- B: Ne zatvaraj; zakrpa ostaje a B22 ostaje otvoren

Zašto taj predlog: Registar kaže da se B22 zatvara samo uz tvoju reč, posle probe. Otključava: Spisak blokatora izdanja. Izvor: B22 dokument 9.0; registar B22.

**T02 Promenljiva repozitorijuma RNR01_PUBLISH_PATCHED**

Određuje da li objavljeni dev APK nosi Reanimated zakrpu. To je podešavanje repozitorija i ne menjam ga bez tvoje reči.

- A (**predlog**): Postavi na „yes“ kad se B22 zatvori
- B: Ne postavljaj

Zašto taj predlog: Zakrpa je odobrena (reč „uvedi zakrpu“); objavljeni APK treba da je nosi. Otključava: Objavljeni dev APK. Izvor: B22 dokument; AGENTS 3.1.5.

## Radnje samo za tebe (nisu pitanja)

- Reč „sad“ od oko 3 minuta za probe B22 (P1, P2, P4) na ekranu Zadaci. USB otklanjanje grešaka uključeno, aplikacija otvorena na Početnoj, traka sa obaveštenjima zatvorena.
- Sesija osobe B na emulatoru (sesija je izgubljena 30.9) i treći nalog za grupu i negativne slučajeve, kad krenu dvouređajni testovi.
- Samo ako push uđe u izdanje: provera imena (ne vrednosti) EXPO_PUSH_TRANSPORT_ENABLED i EXPO_PUSH_MESSAGE_TARGET_ENABLED u Supabase konzoli.
- Rotiranje ili ograničavanje dva javno procurela Google API ključa (cleanup-inventory-20260930).
- Nalozi i ključevi tek kad odluke R01–R16 stignu (Apple, Google Play, Firebase i Expo token, EAS production, Supabase Auth, mejl i domen, Gemini naplata). Ništa od toga se ne šalje u četu.
- Na kraju: pokretanje eas build --profile production pod tvojim EAS nalogom i unos produkcionih review naloga samo u konzole prodavnica.

## Šta se događa dok ne odgovoriš

Radi se po predlogu kao po radnoj pretpostavci, a sve što je serverska primena ili promena na telefonu i dalje čeka tvoju posebnu reč („PRIMENI ...“, „sad“). Nijedan odgovor ovde ne zamenjuje tu reč.
