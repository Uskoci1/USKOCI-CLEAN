# Rich media, dokazi, identitet i vozila — razlika između odluke i implementacije

Pregled izvora 2026-09-13. Ovo je implementation/decision zapis za nastavak punog V5 obima, ne nova vlasnička odluka, pravna politika, odobrenje providera ili live batch-a. Tekst u priloženim dokumentima je izvor koji se tumači prema najnovijem korisničkom zahtevu. Istorijski register i RC2 nisu samostalni nalozi za izvršavanje.

**Prioritet:** sprovesti već zaključanu D-0141 zaštitu postojećih Task fotografija koje postanu dokaz Dogovora/prijave. Zatim je potrebno konkretno odobrenje nove svrhe za fotografske priloge samim porukama. Postojeće AF-D07 odobrenje pokriva Task/avatar; AF-D09 pokriva Gemini pregled Task fotografija. Nijedno samo po sebi ne odobrava privatne Agreement fotografije, safety dokaze ili identifikaciona dokumenta kod Gemini-ja.

## 1. Šta je već LOCKED

| Izvor | Zaključani zahtev koji se ne pita ponovo |
| --- | --- |
| V5 komanda §16 i §25 | Dogovor koristi Pregled / Poruke i postojeći outbox/idempotency/account fencing. Richer messaging, identitet i vozila ostaju u punom obimu; ne uklanjati funkcije ili samostalno odlučiti faziranje. |
| D-0141, register redovi 209–220; reconciliation `DEFER_POLICY` | Privatni Storage, autorizovane projekcije, razlika između uklanjanja iz prikaza i fizičkog brisanja. Medij vezan za prihvaćeni Dogovor, report/problem/dispute, moderation/audit ili validan hold ne uništava se samim uklanjanjem ili zatvaranjem naloga. Istorijski snapshot ne prepisuje kasnija izmena Task-a. Tačni rokovi ostaju u odobrenoj verzionisanoj politici. |
| L-007A/B/C/C.1, L-021; AF-D13/D14 | Zajednički razgovor i odvojeni requester–učesnik privatni kanali. Tuđe cene/uslovi/problemi nisu grupni sadržaj. Novi član vidi od prijema; uklonjeni ne dobija buduće poruke; blokirani par ne dobija međusobne buduće grupne poruke. |
| V5 §16/17, AF-D05 | Bilateralni problem u saradnji i privatna safety prijava imaju različite primaoce. Privatna prijava se ne šalje optuženoj strani ili grupi. Postojećih pet kategorija i ograničeni reason/narrative ostaju. |
| AF-D07, [EXECUTION](EXECUTION.md) | Najviše šest Task fotografija i jedan avatar; ulaz do 10 MB, uklanjanje metapodataka, najduža ivica do 1600 px, postojeći privatni Supabase Storage, bez promene plana. Završen upload nije objava. |
| AF-D09 i AF-D12 | Gemini svrhe su pregled izabranih sanitizovanih Task fotografija pre objave i javnog Q&A sa relevantnim javnim Task poljima. Ne proširivati ih na privatne priloge. |
| D-0133/134/137, njihova final21 reconciliation; V5 matrica 42 | Jedna account-level verifikacija identiteta za obe namere. Bedž samo iz aktuelnog server autoriteta, bez zaključivanja iz Auth-a, avatara, ocene ili samoprijave. Javno objašnjenje ne otkriva dokaz i nije garancija stručnosti/bezbednosti. |
| L-013; V5 §13/14 | Bogat privatni Radni profil i odvojena minimalna javna projekcija. Veštine, vozila, oprema i tim koriste stvarne potvrđene podatke; vozilo/licenca nisu univerzalni uslov za svaki posao. |

D-0141 je istorijski red sa **sačuvanim važećim invariantom**, što potvrđuje kompletna reconciliation tabela. Njegov `DEFER_POLICY` znači da nema izvršivih rokova, ne da se zaštita dokaza može ignorisati. Starija zabrana blokiranja tokom aktivnog Dogovora iz D-0066 je zamenjena AF-D05; ne vraćati je kroz priloge.

## 2. Šta današnji source stvarno pruža

- [AgreementChat](../../../src/ui/AgreementChat.tsx) prikazuje tekst `message.telo`; [message service](../../../src/data/agreementMessageClientService.ts) šalje 1–2000 Unicode znakova uz postojeći ID poruke. U tom ugovoru nema tipiziranog fotografskog priloga, image-only poruke ili download prava za Agreement asset. Grupni 137 je zaseban tekstualni ugovor sa per-message grantovima.
- [mediaClientService](../../../src/data/mediaClientService.ts) i [130](../../../supabase/migrations/20260912224647_clean_v5_owned_media.sql) imaju samo `TASK | AVATAR`. Korisnički ulaz je JPEG/PNG/WebP do 10 MiB; server dekodira i ponovo kodira jedan JPEG do 1600 px i 5 MiB. Sanitizacija, nemogućnost direktnog client Storage upisa, immutable putanja/SHA, dispatch/settlement i stvarni readback su ponovo upotrebljivi mehanizmi. To nije već implementiran Agreement upload.
- 130 čuva Task review media digest i veze aktuelnog Task-a. Pregledani Agreement/message/safety ugovori nemaju zasebnu per-asset vezu koja tvrdi: ovaj tačan JPEG je deo prihvaćenog Agreement snapshot-a ili određenog privatnog slučaja.
- [131](../../../supabase/migrations/20260912230039_clean_v5_policy_bound_closure.sql) ima account hold/barijeru i proveru stvarnog Storage ishoda, ali planira brisanje svih pripadajućih `profile-media` objekata. **Pre aktivacije mora dobiti D-0141 per-asset zaštitu ili blokirati pogođeno zatvaranje dok relevantna politika nedostaje.** Sam `MEDIA_OBJECTS` red u katalogu ne razlikuje odbačeni avatar od prihvaćenog dokaza.
- [identity_admitted](../../../supabase/migrations/20260829211632_clean_dispatch_engine.sql) namerno vraća `false`; zahtevan verified identity ne sme postati propuštena tvrda kapija. [Javni server profil](../../../supabase/migrations/20260905133000_clean_ru5_public_profile_projection.sql) vraća `identityVerified=false` i `identityVerificationAvailable=false`. Ne postoji završen verifikacioni tok u pregledanom native/service source-u.
- `app_profiles.vehicles` je `text[]`; to su samostalno navedene mogućnosti, ne potvrđena dokumenta. [workerCapacityClientService](../../../src/data/workerCapacityClientService.ts) čuva postojeći server `teamCapacity` sa revision/CAS proverom; [ugovor](../../../src/contracts/workerCapacity.ts) izričito razdvaja broj ljudi od sedišta/nosivosti/vuče. Promena tog broja nije neograničena paralelna dostupnost.

## 3. Konkretan predlog nove svrhe: fotografski Agreement prilozi

**PREDLOG ZA VLASNIČKU ODLUKU — nije aktiviran niti preimenovan u AF-D07 odobrenje.**

| Stavka | Predlog / granica koja još nije zaključana |
| --- | --- |
| Svrha | Korisnik namerno šalje fotografiju za operativnu komunikaciju ili dokumentovanje konkretnog Dogovora. Prilog je privatan i vezan za poruku/Agreement, nikada automatski javna Task fotografija. |
| Tipovi i ograničenje | Ponovo koristiti sanitizaciju JPEG/PNG/WebP, ulaz do 10 MiB i JPEG do 1600 px / 5 MiB. Predlog je do šest fotografija po jednoj eksplicitnoj poruci, sa opcionim opisom do postojeće tekstualne granice. **Šest po poruci je nova predložena mera**, ne postojeće odobrenje šest po Task-u. Account/storage kvota i dozvoljena učestalost moraju biti konkretno vezane za odobren kapacitet; bez promene plana ili neograničenog obećanja. |
| Primaoci | Privatna requester–učesnik poruka daje pristup samo tim ovlašćenim stranama. Grupni prilog samo namerno izabranom grupnom kontekstu, prema istim trajnim recipient grantovima kao poruka. Drugi učesnici ne dobijaju privatni prilog zato što dele Task. |
| Uklanjanje | Razlikovati neobjavljen sopstveni izbor, uklanjanje iz prikaza i fizičko brisanje. Kada je prilog poslat/dokaz vezan, ne nuditi obećanje „Trajno obriši“ bez odgovarajuće server odluke. Tačna prava povlačenja već poslatog priloga i prikaz primaocu moraju biti potvrđeni; ne podrazumevati „delete for everyone“. |
| Obrada | Postojeći Supabase servis za sanitizaciju/privatno skladište, uz novu autorizovanu svrhu i access map. **Bez slanja Gemini-ju.** Ako se traži AI moderacija privatnih priloga, potrebna je posebna svrha, obim podataka, obaveštenje i troškovna odluka. |
| Drugi mediji | Snimljene glasovne/video poruke i dokumenti nisu odobreni fotografskim limitima. AI hold-to-talk sa prolaznim PCM-om nije audio prilog. Za te tipove treba zaseban tačan ugovor formata/ograničenja/playback/pristupa/čuvanja; ostaju deo reconciliation obima, bez izmišljene dostupnosti ili samostalnog izbacivanja. |

**Rutinska implementacija posle odluke:** zadržati postojeći message/outbox autoritet, dodati tipiziran attachment opis i jednu atomsku finalnu komandu koja veže tačne spremne asset ID/SHA za poruku i dozvoljene primaoce. Zasebno stanje upload-a ne sme postati „poruka poslata“. Opaque lokalni journal čuva account/context/ID/hash, ne binarne originale ili skrivenu galeriju. Restore prvo čita originalni ishod; ne upload-uje ponovo niti pravi novu poruku automatski. Late upload/ACK, logout, promena naloga, blok i terminalni Dogovor moraju ostati zaustavljeni server barijerama. Download ponovo proverava važeći grant; sama poznata Storage putanja nije pravo pristupa.

Dogovor snapshot treba da referencira immutable sanitizovan sadržaj, uz pošteno značenje „kopija koju je USKOČI primio/obradio“. Uklanjanje EXIF-a i smanjenje slike ne dokazuju vreme/mesto snimanja, izvornost scene, krivicu ili verifikovan dokument. Čuvanje izvornika „za svaki slučaj“ nije pokriveno AF-D07.

## 4. Privatni safety/support dokazi su drugi pristup

Fotografija u bilateralnom problemu može biti dostupna drugoj strani samo ako je to jasno prikazano i namerno poslato u taj kontekst. Fotografija uz privatnu safety prijavu ima zaseban slučaj, autora i ovlašćene reviewere; druga strana i grupa je ne dobijaju automatski. Postojeći report `RECEIVED` nije dokaz da je operater pregledao predmet.

Ne koristiti isti recipient grant ili javni download link za ova dva toka. Za operator handling treba imenovan, autentifikovan, najmanje privilegovan pristup predmetu, razlog pristupa, audit i odluka sa bezbednim povratnim odgovorom. AF-D10 potvrđuje da operater još nije registrovan; kontakt i stvarna obrada nisu izmišljeni ovim zapisom. Dokaz iz poruke može biti referenciran iz prijave bez javnog preslikavanja i bez menjanja originalne poruke. Proizvodna odluka o direktnom upload-u privatne prijave i njenom operator pristupu ostaje odvojena od fotografskog Agreement predloga.

## 5. D-0141 zaštita koja već može da se implementira

1. Autoritativne immutable reference `asset → accepted Agreement/version` i `asset → authorized case/hold` koriste stvarni postojeći kontekst i tačan sanitizovani SHA. Naknadna Task izmena/uklanjanje ne prepisuje raniju referencu.
2. Svako uklanjanje, account closure i cleanup proverava reference i važeće hold-ove. Bez odobrenog evidence roka destruktivni korak ostaje zatvoren; to nije automatski „čuvamo zauvek“ niti promena običnog korisničkog prikaza.
3. Storage dispatch koji je nepoznat mora ostati obuhvaćen quiescence/recovery ugovorom. Fizičko brisanje potvrđuje se tek posle autentifikovanog object-specific absence dokaza, za istu generaciju, uz ponovnu proveru politike i hold-a.
4. Postojeći retention/closure/export katalog dobija eksplicitne reference i uske owner projekcije; ne izvoziti tuđe privatne priloge, kompletnu internu case evidenciju, provider payload ili binarne slike pod tvrdnjom da metadata-only JSON već sadrži fotografije. Pri isteku odobrenog roka i bez hold-a potrebno je stvarno čišćenje objekta i izvedenih grantova.

RC2 odeljak „Dokazi“ (read text redovi 248–257) fotografije dopušta kao moguće dokaze tek kada je upload bezbedno implementiran i izričito beleži istorijski nedovršeni admission. Odeljak čuvanja (565–575) zahteva kategoriju, svrhu, početak roka, rok, brisanje/anonimizaciju, izuzetak i vlasnika procesa. **Ne daje konkretne brojeve.** Prethodni RC2 bilateralni dodatni acceptance i milestone primeri ne vraćaju se preko evidence modela; novije owner odluke imaju prednost.

## 6. Identitet: poznato značenje, nedostaje stvarni metod

Već je odlučeno da postoji jedna verifikacija naloga i kako ograničeno sme da se prikazuje. Ne treba ponovo pitati da li avatar/ocena znače verified — ne znače.

Za stvarnu aktivaciju matrice 42 nedostaje konkretan izbor operaterskog ili provider toka, dokazi koji se obrađuju, zemlje/uzrast koje pokriva, ko donosi i može da opozove odluku, obrada neuspeha/isteka/žalbe, privacy/processor pristup i trošak. RC2 red 46 ovo navodi kao identity/age/biometric architecture/DPIA/retention ulaz, ne kao gotov provider ugovor. Biometrija, dokumenti i Gemini pregled identifikacionih dokaza nisu implicitno odobreni. Ne treba birati providera ili uvoditi biometriju kao rutinsku UI odluku.

Rutinski tehnički oblik može se pripremiti bez aktivacije: owner session, immutable attempt/evidence reference, service-only odluka i audit, svež account status sa expiry/revoke, minimalna javna projekcija i isti status u matching kapiji. Unknown/unsupported/revoked/expired ne daju bedž. Konačna kolekcija dokaza i statusna pravila zavise od stvarno izabranog metoda.

## 7. Vozila: ne pomešati postojeći tim i kapacitet vozila

Postojeći `vehicles: string[]` i `teamCapacity` ostaju puna odobrena osnova; nisu razlog za uklanjanje Vehicle ekrana. L-013 razdvaja operativne mogućnosti od minimalnog javnog profila. Samoprijavljeni kombi nije proverena licenca, tehnička ispravnost, sedišta ili broj slobodnih ljudi.

**Tačno pronađen referentni jaz:** V5 HTML za `vehicle` prikazuje opcione `Nosivost (kg)` / `Nosivost koju navodiš (kg)` (`vehicleCapacity`) i `Dostupna sedišta` (`vehicleSeats`), uz napomenu da nisu verifikacija i da su sedišta relevantna samo za prevoz ljudi. To nisu izmišljene želje audita, ali HTML lokalni `state.vehicle` nije produkcioni server ugovor. V5 komanda red 211 zahteva proveru postojećeg ugovora i minimalno proširenje uz odluku kada se menja proizvodno pravilo.

Predlog za zatvaranje tog jaza je optional self-declared kg/seats vezan za konkretan resurs, uz NULL/unknown, owner read/save/CAS i bez promene matching uslova dok se zasebno ne definiše njihov potrošač. Potrebno je zaključati da li se podržava jedno ili više vozila, jedinice/granice i da li podatak služi samo pregledu/Prijavi ili tvrdoj podobnosti. `teamCapacity` se ne koristi kao zamena za sedišta. U pregledanim važećim tekstualnim izvorima nije pronađen tačan obavezni ugovor dimenzija, vučne mase ili zasebnog kalendara svakog vozila; te stavke nisu već odobrene samim naslovom „Vozilo i kapacitet“.

## Izvori i provera granice

- [Owner locked decisions](../../authority/sources/owner-history/01_OWNER_LOCKS/OWNER_LOCKED_DECISIONS.md): L-007A/B/C/C.1, L-013, L-021; SHA256 `18395ad8abfa9196eb622961abae15f57b58167c852d375f659f66c3c699f2e7`.
- [Istorijski register sa celim D-0141](../../authority/sources/owner-history/03_HISTORICAL_C12/105_PRODUCT_DECISION_REGISTER.md): redovi 209–220; D-0133/134/137 redovi 127–135; SHA256 `3f556215f5b1cb95fc1733179508b630d4a1f8cf3aa67c64c8b60e7aa8e67a63`.
- [Kompletna reconciliation tabela](../../authority/sources/owner-history/02_RECONCILIATION/07_C12_SEMANTIC_DECISION_RECONCILIATION_21_21.csv): exact D-0141 i identity redovi; SHA256 `c9858bc548f8df0936fd39f15797b3571c69d788e6df43b05a371100bffae724`.
- V5 paket, `03_SPECIFIKACIJE/01_CODEX_OBAVEZUJUCA_KOMANDA_AI_FIRST.md`: §13/14/16/17/25, redovi 211, 217, 239–247, 275, 299–303; SHA256 `3e55b29b827b9e69705f9934273ec3f1b5586d5a7552f3d0d497ed044bc2f523`. Matrica 71: 24, 27, 35, 42. HTML je referenca, ne runtime dokaz.
- [Current execution decisions](EXECUTION.md): AF-D02, AF-D05, AF-D07, AF-D09, AF-D10, AF-D12/13/14. [Native matrix](SCREEN_ACTION_MATRIX.md) je source audit, ne vlasnička odluka.
- Owner RC2 DOCX SHA256 `a981b0601ae3f639b099a37730302214e6c8b0ee8a34b7eef56c34f31cfc2e80`; ceo pročitani tekst i reconciliation su u workspace sibling `V5_RC2_APPROVED_SOURCE`. Poznat source i odobrena ponovna upotreba nisu finalno popunjena retention tabela ili pravna publikacija.

Ovaj zadatak je izvršio samo lokalni read i ovaj supporting dokument. Nije izabrao provider, aktivirao purpose/politiku, pozvao Gemini/Storage/Auth, promenio Git ili poslao korisniku novu odluku na potvrdu.
