# Završetak proizvoda i Android objava — ograničen pregled 2.10.2026.

Pregled izvora i postojećih dokaza, bez testova, build-a, uređaja, novih živih čitanja ili mutacija. Ovo je pomoćni nalaz za postojeći plan, ne novi registar. Kanonski status ostaje docs/control/redovi.json.

**Izvor:** a49132a8, „feat(ui): refine connected decisions and wire urgent review”; radno stablo bilo čisto pri ovom čitanju. **Poslednji ograničeno prihvaćen native prikaz:** 8d22ce0e, run37012789559, emulator USKOCI_V5_TEST. Današnje source izmene nisu viđene na uređaju. To nije tvrdnja da ranije poslovne funkcije ne rade.

## Šta ostaje prihvaćeno i ne radi se ponovo

- Vlasnik je lično koristio uspešan Android push. Istorijski dokaz isporuke/otvaranja Inbox-a ostaje; nema novog transporta, single-target projekta ili ponavljanja dokaza radi sigurnosti.
- AI je postojeća funkcija. Native 8d22ce0e potvrđuje kompaktniji početak, tastaturu, višeredni unos i capsule korekcije; ovaj posao ne zahteva novo plaćeno generisanje.
- Raniji stvarni R18 tok završio je objavu → prijavu → izbor → Dogovor → obe ocene. EX04 lične liste i P6/EX03 pretraga postoje. Ne graditi ponovo te celine.
- Latest source završava kompoziciju prijave/izbora/kandidata, jasniji moj zadatak, AI nacrt, razlikovanje predložene/potvrđene lokacije i notification settings. HITNO dobija meni, preview, potvrdu i zaštićen neizvestan ishod, ali bez uključivanja politike.
- Već odlučeno: Android prvi; Srbija; 18+; besplatan početak 0 RSD; trajni package rs.uskoci; NOV odvojen produkcioni Supabase projekat; vlasnik je operator podrške; crash uvid kroz store konzole. iOS, plaćanja i podsetnik P05 su odloženi. Najnovije „Uključi HITNO i push” menja stara odlaganja R02/A21.

Dokaz: docs/implementation/ui-ux-pass-20261002/UIUX_PLAN_AND_STATUS_20261002.md i VISUAL_FINISHING_20261002.md; OWNER_DECISIONS_20261002_ALL75.md čita se zajedno sa kasnijom izmenom obima.

## Stvarni korisnički preostali rad

Ovo su prepreke završetku prihvaćenog V1 obima ili poznati proizvodni defekti; nisu svi zasebni zahtevi prodavnice.

| Preostalo | Konkretan dokaz i granica | Sledeća implementabilna radnja |
| --- | --- | --- |
| Android glasovna poruka u Dogovoru | Voice B1 je već na DEV-u. src/features/voiceMessages ima composer/playback/ports; src/data/voiceMessagesGate.ts zavisi od EXPO_PUBLIC_VOICE_MESSAGES. U pregledanim production UI/rutama nema recorder/player povezivanja. AI govor nije zamena za ovu funkciju. | Završiti postojeći B2 native adapter i UI u Dogovoru iza postojećeg flag-a, koristeći odobren hold-to-talk/review ponašanje i audio arbiter. Bez novog audio steka ili ponovne primene B1. Objavni tekst mikrofona uskladiti sa stvarnim ponašanjem. |
| HITNO je povezan u source, nije aktivna završena funkcija | UrgentActivationActions.tsx i dva client servisa sada postoje. Policy-off nema aktivaciju. Postojeći activation ugovor nema trajan receipt pojedinačnog zahteva ni atomsko vezivanje pregledane policy verzije; active projection sam nije receipt. | Završiti postojeći imenovani HITNO paket sa stvarnom odabranom politikom kategorija/trajanja/cene i jasnim tretmanom ovog ugovornog ograničenja pre aktivacije. Do tada sačuvati OFF i sadašnji zabranu slepog ponavljanja; ne proglašavati sve završeno jer postoji dugme. Ne stvarati širi push projekat. |
| RC02 konflikt operacija nad fotografijom zadatka | Aktuelni UIUX presek vodi reprodukovan defekt. ex05/EX05_S02_RC02_ROUND_NOTE_20261002.md precizira obrnut red zaključavanja cancel READY fotografije: asset→conversation naspram conversation→asset. Taj raniji round note sam ne dokazuje kasniji run. | Iskoristiti postojeći poslednji RC02 rezultat i pripremiti usku promenu rpc_cancel_media_upload na jedinstven red zaključavanja. Ne otvarati novu media arhitekturu, ne ponavljati ceo dokaz radi sigurnosti. Kandidat/primena ostaju imenovani korak. |
| EX06 pronalaženje ljudi ima konkretne otvorene nalaze | EX06_CANONICAL_SCOPE_20261001.md, ex06/s03_run_36901457675/ i trenutni plan: relativni dan, jedna vremenska granica, alias kandidat i zabeleženi F5–F12. Lepši AI/push ne zatvaraju matcher. | Nastaviti postojeće ex06a/b/c nalaze po njihovoj poslednjoj dispoziciji: korišćenje dana objave, pokrivanje postojeće vremenske granice bez izmišljanja druge, uski alias popravak. Ne uvoditi nove kategorije ili novi korpus/projekat. |

D12 pisani komentar nije „nema servera”: Oct2 legal changelog beleži primenjen DEV deo. Klijentska završnica, javni prikaz/blokiranje i pravni tekst još određuju aktivaciju. Dovršiti postojeći D12 put po registru; ne primenjivati isti server paket ponovo. Grupa ostaje prihvaćeno tekstualna, sa ručnim osvežavanjem.

## Stvarne prepreke javnom izdanju

| Prepreka | Trenutni dokaz | Tačna naredna radnja |
| --- | --- | --- |
| Objavljeni pravni i operativni podaci + prvi ulaz | auth.tsx i dalje prikazuje „Ovo je test verzija…”. App layouts nemaju first-entry prihvatanje/18+ gate. Postoje profil/pravna, legalClientService, pregled tačnih hash-eva i acceptance recovery. LEG-13 Oct2 potvrđuje da komandna kapija i postupak publikacije nisu bili implementirani. | Popuniti stvarne operator/kontakt/domenske podatke i retention/processor odluke; dovršiti postojeće LEG02/04/05/07/08/10/11/14/15. Povezati postojeći legal review u prvi ulaz i 18+ po već prihvaćenoj R11; pripremiti odgovarajuću serversku kontrolu, bez lažne saglasnosti pre publikacije. |
| Privatnost pre objave i javni zahtev za brisanje | LEG08: out-of-app put ne postoji. LEG12/13: text-AI obaveštenje pre prvog unosa nije povezano; AiConversationShell prikazuje samo govorno obaveštenje kada p.voice postoji. Final EX08 je izričito ostavljen pre RC. | Zatvoriti konkretne postojeće EX08 grane, uskladiti stvarnu obradu sa LEG12 i povezati kratko obaveštenje za text AI. Završiti javnu HTTPS putanju zahteva za brisanje i kontakta podrške na vlasnikovom domenu. Ne obećavati potpunu likvidaciju kada prihvaćeni closure exceptions zadržavaju predmet. |
| Produkcioni projekat i prava konfiguracija store identiteta | eas.json production još navodi canonical DEV URL; scripts/check-eas-preview.cjs:77 ga izričito zahteva. app.config.js:49–59 dopušta Firebase samo preview identitetu i uklanja ga za rs.uskoci. | Kada vlasnik obezbedi već odlučeni novi PROD projekat i store Firebase identitet, promeniti environment i guard zajedno, sa stvarnim auth redirect/SMTP i odabranim map/geocoder podešavanjem. Povezati postojećeg push provajdera sa rs.uskoci; ovo ne poništava njegov uspešan preview/Android push. Postojanje naloga/ključeva u konzoli ovde nije provereno. |
| Konačna store predaja | Postoje listing/review/screenshot/data drafts; pregledani dokazi nemaju konačan potpisani produkcioni AAB za novu konfiguraciju i najnoviji source. Development APK nije objavni artifact. | Posle zatvaranja gornjih konkretnih prepreka zamrznuti jedan kandidat: potpisani AAB, njegov manifest/permissions i aktuelne Play zahteve proveriti u sklopu pakovanja; završiti Data Safety, reviewer access, listing i screenshot-e stvarnog finalnog izgleda; predaja kroz vlasnikovu konzolu. Nema predloga za dodatne opšte krugove testiranja. |

Spoljni podaci se ne izmišljaju: pravno lice/forma i kontakt; javni domain/hosting; konačni retention rokovi i pravni osnovi/ugovori obrađivača; owner-created PROD resurs; mail sender/Auth; Play account/verifikacija, signing i reviewer pristup; stvarni store Firebase binding. Već odlučene zemlje, uzrast, cena, platforma i package ne pitati ponovo. Vlasnik je prihvatio i higijenu dva ranije izložena Google ključa/repozitorijuma; proveriti njegov završni status, ne tvrditi iz lokalnog izvora da je ili nije obavljeno. Nijedan tajni ključ ne unositi u ovaj izveštaj.

Ovo je pregled projektnih release gate-ova, ne novo pravno mišljenje ni živa provera najnovije politike prodavnice. Konto-specifične Console zahteve rešiti pri predaji; ne prepisivati stare brojeve dana/testera kao današnje pravilo.

## Dorada i čišćenje bez širenja

- Discovery quick-control spacing, prelomi velikih iznosa, tiši refresh razgovora, ujednačenost radnog profila i podrške su postojeći vizuelni završni rad. Nisu sami po sebi novi release blocker bez konkretnog kvara/izgubljene radnje.
- Moj zadatak sada iskreno otvara opštu listu Dogovora kada su mesta popunjena; precizniji izbor povezanih Dogovora ostaje poboljšanje. Ne vraćati stari nalaz kao da izmena nije urađena.
- Ne zahtevati iPhone/APNs, plaćanja, P05, novu analytics/Sentry zavisnost, thumbnail na svakoj kartici ili motion remake da bi Android bio dovršen.
- SCREEN_ACTION_MATRIX.md iz v5-ai-first i donja istorijska wave tabela nisu tekuća istina. STORE_GATES_STATUS.md „0/28” nije 28 novootkrivenih prepreka; prepisuje stare odluke i nedostatak dokaza.
- Najmanje potrebno čišćenje: uskladiti postojeće release-prep dokumente sa novim source/owner opsegom; ukloniti prazne/pogrešne store tvrdnje; sačuvati receipt-e i donor reference. Ne brisati arhive, screenshot-e ili razvojne rute naslepo. Privatni native snimci ostaju van Git-a.

**Najkorisniji naredni potez:** završiti postojeće source integracije (glas/HITNO i konkretne RC02/EX06 popravke), a paralelno prikupiti samo nedostajuće spoljne vrednosti za jedan pravni/produkcioni paket. AI i Android push koristiti kao postojeći temelj, bez vraćanja rada na početak.


## Podaci vlasnika za objavu — dopuna 2.10.2026.

Vlasnik je potvrdio: **nema Google Play nalog, nema odvojen produkcioni Supabase, poseduje uskoci.rs, objavljuje kao fizičko lice.** To razrešava vrstu naloga: Personal. Ovaj odgovor nije nalog za kupovinu, otvaranje plaćenog projekta ili javno objavljivanje.

Javno HTTPS čitanje `https://uskoci.rs/` vratilo je200 i postojeću USKOČI prezentaciju na Vercel-u. U linkovima početne stranice nisu pronađeni privatnost, uslovi, podrška i zahtev za brisanje naloga. Time nije dokazano da takve stranice ne postoje na drugim putanjama. Nije menjan sajt niti DNS. Novi domen nije potreban; postojeći sajt može nositi ove objavne stranice nakon pripreme stvarnog sadržaja i pristupa njegovom projektu.

1. **Vlasnik:** otvori [Google Play Console](https://play.google.com/console/signup), izaberi Personal i svojim podacima završi registraciju, jednokratnih25USD i tražene provere identiteta/Android uređaja. Lozinke, kartica i identifikacioni dokumenti unose se direktno Google-u. [Zvanično uputstvo](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en).
2. **Rok za javnu objavu:** novi Personal nalog mora imati zatvoreno testiranje sa najmanje12 uključenih testera neprekidno14 dana pre podnošenja zahteva za produkcioni pristup. Rok počinje od njihovog uključenja u zatvoreni test, ne od dana otvaranja naloga. Zatim sledi Google pregled;14 dana nije obećanje datuma izlaska. [Zvaničan uslov](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
3. **Produkcioni Supabase:** postoji ranija odluka za odvojen projekat; konkretan projekat još ne postoji. Pripremiti prenos postojeće šeme/funkcija, Auth/mail, dozvoljenih callback adresa, tajni preko zaštićenog kanala i store konfiguracije, bez prenosa razvojnih naloga/razgovora. Tek konkretan paket i trošak idu na odobrenje. [Pro je od25USD mesečno](https://supabase.com/pricing), prvi projekat uključen, dodatni projekti od10USD mesečno; potrošnja i dodaci mogu povećati račun. Stvarna organizacija i ukupan račun još nisu odabrani.
4. **Sajt i pravni podaci:** koristiti postojeće nacrte i uskoci.rs. Još nedostaju potvrđeno ime operatora za javne tekstove, kontakt podrške, odgovarajući sadržaj i pristup projektu sajta. Ne izmišljati kontakt kao `podrska@uskoci.rs` dok sanduče nije stvarno podešeno. Planirane putanje za privatnost/uslove/podršku/brisanje nisu već objavljeni URL-ovi.

Lični Play nalog određuje Google nalog za objavu; sam po sebi nije pravna procena statusa pružaoca usluge. Nije popunjavan niti odobren pravni tekst sa pretpostavljenim ličnim podacima.

## Noviji nastavak istog dana

Vlasnik sada potvrđuje da je napravio Personal Google Play nalog i da je verifikacija u toku; raniji status da nalog ne postoji je prevaziđen. Završetak verifikacije nije potvrđen. B2 recorder/player i UI su sada povezani u Android izvoru, uz postojeći voice flag u DEV workflow-u; izvor nije dokaz rada na uređaju. Videti noviji nastavak u VISUAL_FINISHING_20261002.md.
