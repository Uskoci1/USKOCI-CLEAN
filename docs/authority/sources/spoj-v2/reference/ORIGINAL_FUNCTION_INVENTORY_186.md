# USKOČI — kompletan funkcionalni obim narednog prolaza


186 stavki u 20 modula. Ovo su zahtevi i kriterijumi prihvatanja, ne spisak186 već implementiranih funkcija. E oznake su u evidence/SOURCES.json.


## M01 — Ulaz, nalog i kontinuitet

Radni paketi: W01. Površine: S01, S02, S03, S04, S05.

**Provereno stanje:** Postoje nativni Auth/oporavak i shell; odobreni intro je lokalni HTML resurs. Podrška svake Auth metode proverava se kroz dostupnost servisa, ne kroz nacrtano dugme.

**Podaci i autoritet:** Auth sesija → account/profile ID → namera → ovlašćeni return target. Lozinka i recovery token nisu tekst u trajnom UI store-u.

**Dizajn:** Intro ne menjati. Forme su mirne, jasne; izbor namere ne menja identitet. Tri vidljive navigacione zone.

**Izvori:** E01, E02, E04, E06.

### F001 — Odobrena intro sekvenca

**Obim:** `PRESERVE`. **Kriterijum zatvaranja:** Izvor i završni kadar imaju iste otiske pre i posle rada; promenjen je samo neophodan native adapter uz vizuelnu proveru.

### F002 — Prvi, ponovni ulazak i duboki link

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Prvi ulazak dobija intro; korisnik koji otvara postojeći Dogovor stiže do ovlašćenog cilja bez nepotrebne ceremonije.

### F003 — Izbor i promena namere

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Isti nalog ima obe namere; povratak čuva dozvoljeni cilj i ne menja ulogu u već postojećem Dogovoru.

### F004 — Prijava emailom i lozinkom

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Uspeh otvara traženi cilj; greška ostaje uz unos; dvostruki submit i promena naloga ne otvore tuđ cilj.

### F005 — Registracija i potvrda emaila

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Unos, zahtev za potvrdu, ponovno slanje i potvrđena sesija odvojeni; zahtev za potvrdu nije dokaz potvrđenog naloga.

### F006 — Dostupnost dodatnih Auth metoda

**Obim:** `CONDITIONAL`. **Kriterijum zatvaranja:** OTP ili drugi provajder prikazuje se samo ako je servis stvarno raspoloživ; nema dekorativnih Google/Apple/telefon dugmadi.

### F007 — Oporavak naloga

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Zahtev → email link → nova lozinka → povratak na prijavu; cold/warm, istekao i ponovo upotrebljen link provereni.

### F008 — Istek sesije i odjava

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Zaštićena radnja zaustavljena, bez gubitka dozvoljenog nacrta; privatni podaci nisu dostupni drugom nalogu.

### F009 — Dozvole u trenutku potrebe

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Lokacija, mikrofon, kamera i push traže se zasebno; odbijanje ima smislen alternativni put.

### F010 — Bezbednost sesija i ponovna autentikacija

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Osetljive radnje imaju stvarno serverom traženu potvrdu; ne prikazuje se izmišljena lista uređaja.

## M02 — Lični, javni i Radni profil

Radni paketi: W04, W10, W11. Površine: P01, P02, P03, P05, R06, W08.

**Provereno stanje:** Kanonski radni editor koristi ime, grad, bio i tekstualne nizove veština/alata/vozila. Javni DTO je namerno kompaktan; kompletni media/verifikacioni tokovi nisu dokazani.

**Podaci i autoritet:** Lični account podaci ≠ matching profil ≠ javni profil ≠ snapshot sposobnosti konkretne Prijave. Verification state pripada nalogu.

**Dizajn:** Identitet i kratak sažetak gore; uredive grupe ispod. Ne praviti veliki dashboard iz nepoznatih statistika.

**Izvori:** E02, E07, E13, E14, E18.

### F011 — Profil centar

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Avatar otvara profil; namera, Radni profil, raspored, utisci, privatnost i podešavanja imaju jasan cilj i povratak.

### F012 — Lični podaci

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Ime, grad, bio i dozvoljena polja čuvaju se za isti account; email i telefon ne postaju javni.

### F013 — Profilna fotografija

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Izbor, pregled, upload, zamena i uklanjanje imaju status; potpisani pristup, stari fajl i keš obrađuju se odvojeno.

### F014 — Javni profil obe strane

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Isti public-safe DTO daje osobu, grad, bio, dostupnu reputaciju; nema kopiranja sirovog app_profiles reda.

### F015 — Veštine i usluge

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Dodavanje/uređivanje/uklanjanje preko razumljivih grupa; zajednička semantika sa zahtevima Zadatka i matching-om.

### F016 — Alat, dozvole i iskustvo

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Samo relevantni urednici; samoprijava ne postaje verifikovan dokaz; zahtev za dozvolu dolazi iz policy-ja.

### F017 — Vozila i kapaciteti

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Tip, teret ili sedišta traže se kada imaju smisla; ne popunjavaju se zamišljeni kilogrami ili brojevi iz reči kombi.

### F018 — Tim i odgovorni nosilac

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Jedan nosilac navodi koliko ljudi obezbeđuje; nema obaveznog naloga ili imena svakog pomoćnika.

### F019 — Aktivacija i obustavljen profil

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Pregled pre aktivacije, jasni minimumi, DRAFT/ACTIVE/SUSPENDED iz autoriteta; browsing dozvoljen pre prve Prijave.

### F020 — Sačuvana oblast rada

**Obim:** `SOURCE_OR_PR`. **Kriterijum zatvaranja:** Grad/radijus/origin menja se eksplicitno; pretraga drugog grada ne prepisuje matching profil.

### F021 — Potvrđen identitet i objašnjenje bedža

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Važeća server potvrda daje bedž na obe uloge; istek/opoziv ga uklanja; tap objašnjava usko značenje, ne garantuje bezbednost.

## M03 — AI intervju za Radni profil

Radni paketi: W04. Površine: W02, W08, P03, VOICE01.

**Provereno stanje:** Lokalni prototip ima zaseban demo razgovor. Puni nativni AI worker interview, njegovo trajno čuvanje i provider tok nisu dokazani ovom revizijom.

**Podaci i autoritet:** Jedan resumable razgovor po subjektu → predložene sposobnosti → ljudski pregled → postojeći profil/availability/location autoritet.

**Dizajn:** Kompaktan profilni predmet, trenutno pitanje i odgovor. Ne koristiti predmet Zadatka niti pretrpanu formu kao razgovor.

**Izvori:** E02, E06, E07, E13, E14.

### F022 — Početak i nastavak intervjua

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Povratak otvara isti razgovor i poslednji potvrđeni profil, a ne novi prazan intervju.

### F023 — Razumevanje veština i usluga

**Obim:** `TARGET`. **Kriterijum zatvaranja:** AI izdvaja stvarno rečeno, prepoznaje sinonime preko zajedničke semantike i pita samo šta nedostaje.

### F024 — Pitanja o alatima, vozilu i timu

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Ne zaključuje nosivost, iskustvo ili broj ljudi iz posrednih nagoveštaja; traži potrebnu dopunu.

### F025 — Dostupnost iz prirodnog govora

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Posle posla ostaje neodređeno dok korisnik ne razjasni dane i prozore; čuva se vremenska zona.

### F026 — Uređivanje tokom razgovora

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Ručna korekcija i AI predlog vide isti aktivni skup činjenica; zakasneli odgovor ne prepisuje noviju korekciju.

### F027 — Pregled i aktivacija profila

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Prihvata se prikazana verzija sposobnosti; provider rezultat sam ne aktivira profil.

### F028 — Promena profila posle slanja Prijave

**Obim:** `CANON_RULE_TARGET_UI`. **Kriterijum zatvaranja:** Nova veština/profil ne prepisuje stare Prijave i njihove capability snapshot-e.

## M04 — AI i ručno stvaranje Zadatka

Radni paketi: W03. Površine: R02, R07, MEDIA01, VOICE01.

**Provereno stanje:** NEED_FACT_V2, razgovor, potvrda/korekcija i review/draft RPC-jevi postoje. Aktivna Edge funkcija nije dokaz stvarnog provider uspeha; produkciona objava i dalje ima gate.

**Podaci i autoritet:** Poruka → predlozi tipiziranih činjenica sa poreklom → aktivni review → human confirmation → draft/Needs. Javno i privatno odvojeno.

**Dizajn:** Mali isti TaskObject iznad vidljivog pitanja. Novac, ljudi i vreme čitljivi; detalji ne dominiraju. Bez zida poruka.

**Izvori:** E02, E07, E08, E16, E18.

### F029 — Novi razgovor i nastavak nacrta

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Jedan conversation ID po nacrtu; prekid, povratak i refresh ne kreiraju duplikat.

### F030 — Tekstualni odgovor i sledeće pitanje

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Pitanje ostaje vidljivo; AI ne ponavlja svaku činjenicu kao praznu potvrdu; sadržaj se čuva na pravom razgovoru.

### F031 — Jedinstveni živi predmet

**Obim:** `DESIGN_REQUIRED`. **Kriterijum zatvaranja:** Kartica i razgovor prikazuju isto stanje; nema paralelnog price/time store-a sa drugačijim vrednostima.

### F032 — Naslov, opis i kategorija

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Kratak smislen naslov i očuvan puni opis; kategorija validna i ne izmišlja novu publication dozvolu.

### F033 — Imam cenu ili tražim ponude

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Režim i iznos odvojeni; iznos u valuti, ne nejasan string; nema izmišljene AI cene.

### F034 — Broj potrebnih ljudi

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Pozitivan ceo broj kad je poznat; nepoznato nije nula; potrebe i popunjenost nisu broj Prijava.

### F035 — Zahtevi posla

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Veštine, alat, vozila, licence, iskustvo i bitni uslovi imaju tip/poreklo i odgovarajuća prava.

### F036 — Termin i njegova nepreciznost

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Tačan interval, početak bez trajanja, datum, rok i fleksibilnost nisu isto; nema automatskog trajanja od jednog sata.

### F037 — Ručni unos i korekcija

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Isti review/draft model; ručna forma nije prečica oko bezbednosne provere i potvrde.

### F038 — Istorija razgovora

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Svi stvarni potezi dostupni na zahtev; povratak čuva aktivni unos i položaj, bez izlaganja privatnih facts javno.

### F039 — Konačni ljudski pregled

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Jedna jasna završna kontrola prikazane verzije; nema potvrđivanja svake jasno prepoznate govorne reči.

### F040 — Čuvanje nacrta

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Nacrt ostaje privatan, sa datumom/podacima; retry iste namere ne pravi novi Zadatak.

### F041 — Izmena postojećeg Zadatka kroz isti editor

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Učita se tačan task ID/revizija; sačuva se nova revizija tog zadatka, ne novi draft bez veze.

### F042 — Složena i višelokacijska potreba

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Jedna obaveza kroz više stanica ostaje jedan Zadatak; nezavisni izvođači/cene daju odvojene zadatke uz ljudsku potvrdu predloga.

## M05 — Glas, fotografije i priloge

Radni paketi: W03, W04, W11. Površine: VOICE01, MEDIA01, S05.

**Provereno stanje:** Voice je označena skriptovana demonstracija, ne mikrofon ili STT. U live proveri nađen je samo private profile-media bucket; to ne dokazuje kompletan Task media pipeline.

**Podaci i autoritet:** Audio session ID + consent → interim/final transcript → isti AI conversation; private Storage refs → ovlašćeni prikaz, ne javni raw bucket.

**Dizajn:** Glas pretvara composer u jasno listening stanje. Efekat meri zvuk tek kad stvarno postoji mikrofon; sistem ne glumi razumevanje.

**Izvori:** E06, E08, E14, E18.

### F043 — Kontekstna dozvola i početak slušanja

**Obim:** `TARGET_PROVIDER`. **Kriterijum zatvaranja:** Jasan start i indikator pristupa mikrofonu; odbijena dozvola ostavlja kucanje.

### F044 — Waveform i živi transkript

**Obim:** `TARGET_PROVIDER`. **Kriterijum zatvaranja:** Talas reaguje na stvarni signal, interim reči se menjaju bez dupliranja; nema animacije koja lažno tvrdi da AI razume.

### F045 — Granica govornog poteza

**Obim:** `TARGET_PROVIDER`. **Kriterijum zatvaranja:** Automatski završetak ili Završi ne zahtevaju još jedno Pošalji; eksplicitni start/stop su i dalje dostupni.

### F046 — Razjašnjenje i finalna potvrda

**Obim:** `CANON_RULE_TARGET_UI`. **Kriterijum zatvaranja:** Nejasan termin/iznos se razjasni; samo konačni review daje ljudsku potvrdu za materijalni upis.

### F047 — Otkaz, pozadina i promena naloga

**Obim:** `TARGET_PROVIDER`. **Kriterijum zatvaranja:** Audio i kasni callbacks prestaju; prethodni kucani nacrt ne nestaje, ni delimičan govor ne odlazi pogrešnom nalogu.

### F048 — Kamera/galerija i pregled priloga

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Svaki fajl ima pojedinačno pending/uspeh/grešku; neuspešna slika ne briše opis.

### F049 — Upload, retry, zamena i uklanjanje

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Stable request/ref, dozvole, ograničenja formata i veličine; nema javnog upisa privatnog fajla.

### F050 — Galerija u detalju i pristup medijima

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Signed/pravilno odobren prikaz, expiry i 403 imaju ponašanje; primarna browse kartica ostaje bez task thumbnail-a.

### F051 — Životni vek medija

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Uklanjanje sa oglasa odvojeno od trajnog brisanja; prihvaćeni dokaz/legal hold ostaje samo po odobrenoj svrsi i roku.

## M06 — Geografija i mesto izvršenja

Radni paketi: W02, W06. Površine: M01, M02, R02, R04, W04, P03.

**Provereno stanje:** Postoje Need geography tipovi; PR85 sa ručnim public/private review i worker geo editorom je open draft. Nije spojen niti primenjen live u ovom snimku.

**Podaci i autoritet:** Lokacija autora ≠ lokacija posla. STATIONARY/POINT_TO_POINT/MULTI_STOP/AREA_BASED/REMOTE. Exact address/access notes privatni.

**Dizajn:** Prikaži gde se radi bez davanja lažne preciznosti; odsustvo pin-a ne znači udaljeni rad.

**Izvori:** E02, E05, E08, E14, E18.

### F052 — Posao na jednoj lokaciji

**Obim:** `SOURCE_OR_PR`. **Kriterijum zatvaranja:** Grad/područje javno, precizna adresa posebno potvrđena i privatna.

### F053 — Preuzimanje i dostava

**Obim:** `SOURCE_OR_PR`. **Kriterijum zatvaranja:** Početak i kraj pravilno označeni; radijus polazi od prve radne tačke, a ne korisnikovog trenutnog telefona.

### F054 — Više stanica i rad u oblasti

**Obim:** `SOURCE_OR_PR`. **Kriterijum zatvaranja:** Čuva se redosled stanica i semantička oblast; jedna timska obaveza nije automatski više Dogovora.

### F055 — Rad na daljinu

**Obim:** `SOURCE_OR_PR`. **Kriterijum zatvaranja:** Bez obavezne lokacije/GPS-a; prelazak u remote uklanja aktuelni privatni zahtev bez prepisivanja istorijskih dokaza.

### F056 — Ručno potvrđivanje i resolver predlog

**Obim:** `SOURCE_OR_PR`. **Kriterijum zatvaranja:** Provider rezultat nije potvrđen unos; privatni tekst se ne šalje geocoder-u kao public query.

### F057 — Blizu mene

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** GPS se koristi privremeno i samo u traženom kontekstu; nema tihog background praćenja.

### F058 — Sačuvaj oblast za rad

**Obim:** `SOURCE_OR_PR`. **Kriterijum zatvaranja:** Posebna eksplicitna radnja; browsing drugog grada i opoziv GPS dozvole ne menjaju već potvrđenu oblast.

### F059 — Nedostajuća ili nevažeća tačka

**Obim:** `CANON_RULE_TARGET_UI`. **Kriterijum zatvaranja:** Zadatak ostaje u listi; prikaz objašnjava ograničenje mape, bez izmišljenog centra/grada.

## M07 — Objava i životni ciklus Zadatka

Radni paketi: W05. Površine: R03, R04, R07, H01.

**Provereno stanje:** Objava i lifecycle RPC osnova postoje. U live je nula publication policy bundles; nacrtan Objavi CTA nije aktivacioni dokaz.

**Podaci i autoritet:** Tačan task/revision + potvrđen review + server policy decision → objava/odbijanje; posteri ne odlučuju ALLOW.

**Dizajn:** Detalj ima jedan naslov, cenu/ponude, vreme/mesto i kompaktnu pokrivenost; upravljanje je sekundarno.

**Izvori:** E02, E07, E08, E14, E18.

### F060 — Pregled objave i privatnosti

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Javni tekst/fotografije odvojeni od private exact/access; korisnik vidi stvarni sadržaj koji izlazi drugima.

### F061 — ALLOW / CLARIFY / REVIEW / BLOCK

**Obim:** `GATED`. **Kriterijum zatvaranja:** Verzionisani policy autoritet, minimalna razjašnjenja, nema lažnog obećanja trajanja pregleda ni AI zakonskog improvizovanja.

### F062 — Objava i potvrđeno javno stanje

**Obim:** `GATED`. **Kriterijum zatvaranja:** Tek receipt/readback daju status objave i distribuciju; unknown ostavlja proveru istog pokušaja.

### F063 — Vlasnički detalj i stanje posla

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Nacrt/otvoren/popunjen/zatvoren jasno razlikovati; objavljen zadatak nije isto što i završena saradnja.

### F064 — Pokrivenost i više Prijava

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** 0/2, 1/2, 2/2 iz kanonske coverage projekcije; ne iz broja ponuda i ne iz review statistike.

### F065 — Materijalna izmena i diff

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Stare nepodudarne Prijave traže pregled; prihvaćeni Dogovori ne prepisuju se izmenom oglasa.

### F066 — Zatvaranje prijema preostalih mesta

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Prestaje nova prijava za nepopunjena mesta; postojeće saradnje ostaju vidljive i prate sopstveni lifecycle.

### F067 — Otkaz Zadatka

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Prikazati stvarnu serversku posledicu za prijave/alokacije; ne poistovetiti sa otkazom svakog Dogovora bez dokaza.

### F068 — Brisanje nacrta

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Samo dozvoljeni nacrt; potvrda posledice; disposable media se obrađuje po retention politici.

### F069 — Istorija i povratak na isti posao

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Stari posao je pretraživ, sa svojim ID-jem i istorijom; kolekcijsko arhiviranje ne menja poslovno stanje.

## M08 — Istraživanje, lista i mapa

Radni paketi: W06. Površine: W03, W04, M01, M02, Q01, Q02.

**Provereno stanje:** Javna lista postoji; map PR67 je open draft i u pročitanom stanju nije mergeable. Starije i novije map-layout odluke treba izričito uskladiti.

**Podaci i autoritet:** Isti public-safe result snapshot za mapu/listu; query+scope+sort+viewport+cursor; isti Need ID i revision.

**Dizajn:** Činjenice i cena vode oko; marker je originalni simbol, ne novi billboard. Karta i njen detalj ne izmišljaju privatne podatke.

**Izvori:** E02, E07, E12, E14, E18.

### F070 — Javno tržište u obe namere

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Obe namere mogu istraživati isti javni skup; browsing ne daje pravo na Prijavu ili privatnu adresu.

### F071 — Kompaktna kartica i celi detalj

**Obim:** `DESIGN_REQUIRED`. **Kriterijum zatvaranja:** Ista anatomija; kratak opis i kritični uslovi vidljivi, puni opis/galerija dostupni bez gubitka konteksta.

### F072 — Lista / Mapa i odabrani pin

**Obim:** `PR_ONLY`. **Kriterijum zatvaranja:** Isti snapshot, kamera i selekcija; card tap i pin fokus ne otvaraju drugi posao.

### F073 — Klasteri guste oblasti

**Obim:** `PR_ONLY`. **Kriterijum zatvaranja:** Cluster otvara/uvećava stvarnu grupu; nikad proizvoljno izabran skriveni Zadatak.

### F074 — Pomeranje i osvežavanje mape

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Settled viewport/debounce; nema upita za svaki kadar. Raspored map/list/panel voditi kroz odluku X04.

### F075 — Pretraga javnih zadataka

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Pretraga nad celim dozvoljenim query-jem, ne samo učitanom prvom stranom i ne nad privatnim adresama.

### F076 — Filteri: gde, kada, način rada, cena i vrsta

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Jasan obim/valuta; unknown i OFFERS nisu nulta cena. Filteri zavise od raspoloživih potvrđenih polja.

### F077 — Sortiranje i preporučeni redosled

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Najbolje za mene samo sa realnim server ranking-om; nema prikaza izmišljenog procenta ili CARD match razloga.

### F078 — Dodaj zadatak iz map konteksta

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** U/Novi ili kontekstna akcija; zadrži oblast kao predlog, ne kao automatski potvrđenu privatnu lokaciju.

### F079 — Vrati se iz detalja ili profila

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Isti filteri, redosled, scroll anchor i pin; nedostupan objekat ima eksplicitan ishod.

## M09 — Kolekcije za 500–600+ stavki

Radni paketi: W06, W08, W09, W13. Površine: R03, W06, D01, Q01, Q02, S06, C01.

**Provereno stanje:** Ovo je traženo unapređenje, nije dokazano kao završen current. Kanonski Dogovori koriste ScrollView+map, a live own-list RPC potpisi nemaju paging/filter argumente.

**Podaci i autoritet:** Account i vrsta kolekcije određuju opseg; status/role/time/query/sort plus stable cursor. Broj učitanih redova nije broj svih rezultata.

**Dizajn:** Jedan collection obrazac, ali različiti poslovni filteri. Istorija se ne učitava kao 600 otvorenih detalja.

**Izvori:** E07, E09, E14, E18, E19.

### F080 — Moji zadaci: aktivni, nacrti i istorija

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** Segmenti su pogledi nad pravim stanjima, a ne nova paralelna state machine.

### F081 — Prijave: aktivne, za pregled, izabrane, zatvorene

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** Prijave ne nestaju jer se namera promenila; izabrana vodi na pripadajući Dogovor.

### F082 — Dogovori: aktivni i istorija

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** Ja naručujem/ja radim je filter unutar istog naloga; jedan Dogovor se ne broji dvaput.

### F083 — Pretraga sopstvenih zbirki

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** Naslov, javno dozvoljen saradnik, oznaka i period; ne otkriva private susednog naloga ili skrivenog Q&A autora.

### F084 — Treba moja radnja / nova informacija

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** Odvojiti odluku od nepročitane poruke i termina uskoro; clear opis razloga, ne jedna neodređena tačka za sve.

### F085 — Filteri i sortiranje kolekcija

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** Statusi specifični modulu; vremenski filter kaže da li filtrira termin, objavu ili završetak.

### F086 — Grupisanje po vremenu

**Obim:** `OWNER_REQUEST_TARGET`. **Kriterijum zatvaranja:** Aktivni po stvarnom terminu uz posebnu grupu bez satnice; istorija po mesecu događaja iz izabrane semantike.

### F087 — Paginacija i virtualizacija

**Obim:** `TARGET_ENGINEERING`. **Kriterijum zatvaranja:** Server filtering pre cursor-a, stabilno tie-break ID, provera deduplikacije i bez serije ulaznih animacija preko 600 redova.

### F088 — Povratak, refresh i novi događaji

**Obim:** `TARGET_ENGINEERING`. **Kriterijum zatvaranja:** Stari položaj/selektovani red ostaje; zakasneli rezultat starog query-ja ne prepiše novi filter/nalog.

### F089 — Delimično učitano, prazno i greška

**Obim:** `TARGET_ENGINEERING`. **Kriterijum zatvaranja:** Nema rezultata nije isto što i neuspela druga strana; retry stranice ne briše potvrđeni raniji sadržaj.

### F090 — Pregled više Dogovora jednog Zadatka

**Obim:** `CANON_RULE_TARGET_UI`. **Kriterijum zatvaranja:** R04 sabira pokrivenost po autoritetu, a lista Dogovora zadržava svaku saradnju, svog partnera, cenu i verziju.

## M10 — Prijava, kandidati i tačan Izbor

Radni paketi: W08. Površine: W05, W06, R05.

**Provereno stanje:** Kanonske projekcije i live application/candidate/select RPC-jevi postoje; poslednji HTML ima ograničene lokalne scenarije. AI Application intake istorijski zahtevan, noviji kratki composer opisan: odluka X06.

**Podaci i autoritet:** Need ID/revision → Application ID/version/hash + cena/slots/proposed interval/capability snapshot → Selection iste verzije.

**Dizajn:** Jedna porodica kartica; kandidat ima čoveka i njegov ponuđeni obim, ne tabelu nepotrebnih brojeva.

**Izvori:** E02, E07, E14, E18.

### F091 — Ulaz u Prijavu i provera uslova

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Nije sopstveni posao; aktuelni Need prima prijave; worker minimum zadovoljen; povratak iz dopune čuva cilj.

### F092 — Ponuda i broj ljudi

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Cena za stvarni ponuđeni obim, slots unutar kapaciteta i preostalih mesta; timska i pojedinačna cena se ne izjednačavaju.

### F093 — Predloženi termin i napomena

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Eksplicitni interval odvojen od fleksibilnog; sadržaj ne menja oglas i čuva se uz verziju Prijave.

### F094 — Pregled sposobnosti u Prijavi

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Prikaz samo self-declared snapshot-a relevantnog za tu Prijavu; kasniji profil ga ne prepisuje.

### F095 — AI pomoć za Prijavu

**Obim:** `RECONCILE`. **Kriterijum zatvaranja:** Pomiriti D0055 sa novijim composer tokom; isti aggregate i završni ljudski send, bez drugog engine-a ili obaveznog novog intervjua napamet.

### F096 — Slanje i potvrđeni rezultat

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Ista Prijava vidljiva worker-u i vlasniku; timeout/double tap ne stvaraju dve.

### F097 — Moja Prijava i povlačenje

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Stanje iz autoriteta, razlog i posledica povlačenja; izabrana Prijava otvara Dogovor, ne obično brisanje.

### F098 — Promenjeni uslovi: zadrži/izmeni/povuci

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Prikaz diff-a, eksplicitno rebase ili nova verzija; ćutanje nije saglasnost i nema proizvoljnog expiry-ja.

### F099 — Kandidati i pregled ponude

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Broj ponuda vidi ovlašćeni Naručilac; worker ne dobija tuđe prijave ili njihov tajni broj.

### F100 — Poređenje dve ponude

**Obim:** `DESIGN_PROPOSAL`. **Kriterijum zatvaranja:** Upoređuju se cena/obim/termin/sposobnosti; lokalno poređenje nije serverski shortlist ili ranking upis.

### F101 — Izbor tačne ponude

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** CAS/revision/version/hash/idempotency; uspeh odmah CONFIRMED Dogovor, bez još jedne potvrde druge strane.

### F102 — Konflikt, prepunjenost i ponovni izbor

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Prepunjeno ili zastarelo vraća pregled; više nezavisnih alokacija ima svoje Dogovore i ne prekoračuje kapacitet.

## M11 — Povezivanje i buduća naplata

Radni paketi: W08, W12. Površine: R05, D02, EXT-PAYMENT.

**Provereno stanje:** Live REQUESTER_SELECTION_V1 ima HEADCOUNT/PROMOTIONAL_FREE/0. Nisu dokazani pozitivan checkout, platni provider ili kompletno izdavanje plaćenih prava.

**Podaci i autoritet:** Requester + selected application/Need revision + covered headcount + policy version → activation record. Novac za rad odvojen od platform fee-a.

**Dizajn:** Pre potvrde: osoba, obim, termin, naknada rada, platforma i sada plaćaš. Bez trgovinskog wallet dashboard-a.

**Izvori:** E02, E14, E18.

### F103 — Promotivni pregled 0 RSD

**Obim:** `CANON_POLICY_TARGET_UI`. **Kriterijum zatvaranja:** Jasno promo, bez izmišljene precrtane tarife, kartice i lažne bankarske uplate; jedno potvrđivanje Izbora.

### F104 — Prikaz cene rada i platforme

**Obim:** `CANON_RULE_TARGET_UI`. **Kriterijum zatvaranja:** Dve stavke; rad se ne prikazuje kao plaćen platformi kada ga ona ne naplaćuje.

### F105 — Quote/policy verzija i headcount

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Requester payer i covered-headcount nisu nova otvorena pitanja; konkretan budući iznos/config ostaje poseban.

### F106 — Plaćena ponuda i metod plaćanja

**Obim:** `FUTURE_GATED`. **Kriterijum zatvaranja:** Samo odobren provider/channel i važeći quote; povratak na istog kandidata/reviziju, ne na prvi iz liste.

### F107 — Obrada, odbijeno, odustajanje, unknown

**Obim:** `FUTURE_GATED`. **Kriterijum zatvaranja:** Jedan payment attempt i verifikovan status; ponovni ulaz ne duplira terećenje.

### F108 — Plaćanje uspešno, Izbor konfliktan

**Obim:** `FUTURE_GATED`. **Kriterijum zatvaranja:** Nema lažnog Dogovora; receipt i recovery/kompenzacija po odobrenom pravilu.

### F109 — Potvrda, istorija i odobreni finansijski dokumenti

**Obim:** `FUTURE_GATED`. **Kriterijum zatvaranja:** Aktivacioni receipt nije fiskalni račun; prikazuju se samo stvarno izdati dokumenti i odgovarajući iznosi.

### F110 — Promena cenovnika i prestanak promocije

**Obim:** `FUTURE_GATED`. **Kriterijum zatvaranja:** Novi iznos pre saglasnosti; nema retroaktivne naplate starog nultog povezivanja niti obećanja da je svaka promena moguća bez app update-a.

### F111 — Otkaz, refund i korekcija prava

**Obim:** `RECONCILE`. **Kriterijum zatvaranja:** Odvojiti operativni otkaz, provider refund i podrškin correction; nema jednog dugmeta koje izmišlja sva tri ishoda.

## M12 — Dogovor kao radni prostor

Radni paketi: W09. Površine: D01, D02, D03, D04, D05, D06.

**Provereno stanje:** Postoje confirmed/awaiting/completed/cancelled, poruke, promene, kontakt, problem i completion autoritet. Konačni SPOJ binding i svi native edge tokovi nisu ponovo dokazani.

**Podaci i autoritet:** Agreement ID/version + accepted terms + participants + actor rights + server deadline. Parent task read ne sme menjati dogovorene podatke.

**Dizajn:** Poznata kartica posla plus saradnik/status; mali brojevi i novac visoko. Pregled/Poruke, bez zasebnog third-tab grafa.

**Izvori:** E02, E03, E07, E14, E18.

### F112 — Dogovori kao kartice iste porodice

**Obim:** `DESIGN_REQUIRED`. **Kriterijum zatvaranja:** Naslov, prihvaćeni termin/cena, saradnik i moja uloga; broj ljudi je obim ove saradnje, ne globalno popunjeno/ukupno oglasa.

### F113 — Pregled i ugovoreni sadržaj

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Tačna verzija vidljiva bez administrativnog dupliranja; kasniji edit oglasa ne prepisuje prihvaćeno.

### F114 — Poruke i istorija

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Pristup učesnicima; chat ne zavisi od razmene telefona; čitanje starijih poruka ne briše aktivni composer.

### F115 — Outbox i ponovni pokušaj poruke

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** clientMessageId ostaje isti; potvrda poruke A ne briše nacrt B; read receipt nije izmišljen.

### F116 — Deljenje i opoziv sopstvenog telefona

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Usmereno: deljenje mog broja ne otkriva tuđ; opoziv i terminalni pristup čiste prikaz i keš.

### F117 — Otkrivanje tačne lokacije

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Samo dopušteni fizički Dogovor i pravi grant; remote ne traži adresu.

### F118 — Predlog promene cene/obima/termina

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Pregled sada/predloženo; expected version; promena cene ne izmišlja nepoznato trajanje.

### F119 — Prihvatanje, odbijanje ili zastarevanje predloga

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Druga strana prihvata; prihvat aktivira novu verziju i proverava booking bez nove petlje saglasnosti.

### F120 — Problem u saradnji

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Problem flag odvojen od životnog stanja; zaustavlja automatski završetak i ima vezu ka pomoći, ne briše istoriju.

### F121 — Jednostrani otkaz Dogovora

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Druga strana nema veto; prikaz stvarne posledice za alokaciju/termin i obaveštenja, bez neodobrenog refund-a.

### F122 — Završio sam / potvrdi završetak

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Worker otvara server window; requester može nezavisno potvrditi; nema obaveznih Krenuo/Stigao koraka.

### F123 — Automatski završetak i terminalni prikaz

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Server rok i provera problema; klijent ne računa autoritativni kraj; release termina i prava dosledni.

### F124 — Hronologija i sporni istorijski podaci

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Pregled sadrži stvarne događaje/verzije; kolekcijsko skrivanje ne uništava istoriju.

## M13 — Raspored i dostupnost

Radni paketi: W02. Površine: C01, W09, W08, D02.

**Provereno stanje:** PR83 i PR84 MERGED u source; actual live 87 nema novu calendar/owned-editor authority. Postojanje starih tables nije promocija novih forwards.

**Podaci i autoritet:** Exact agreed interval → worker booking; preference rules/windows u IANA zoni → availability. Requester agenda nije booking gate.

**Dizajn:** Agenda prvo, Satnica za poznata vremena; nedeljni pregled i editor dostupnosti imaju svoje jasne ulaze.

**Izvori:** E03, E04, E10, E11, E14, E18.

### F125 — Agenda sopstvenih saradnji

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Samo moji Dogovori; vreme iz accepted verzije, ne javni poslovi i izmenjeni roditeljski naslov.

### F126 — Tačan termin i hard konflikt

**Obim:** `SOURCE_MERGED_NOT_LIVE`. **Kriterijum zatvaranja:** Samo dogovoren početak i kraj zauzimaju worker; paralelni upis ne napravi dvostruki booking.

### F127 — Datum, rok, fleksibilno i nepoznato trajanje

**Obim:** `SOURCE_MERGED_NOT_LIVE`. **Kriterijum zatvaranja:** Ne popunjava satnicu celog dana/nedelje; posebna grupa bez tačnog termina.

### F128 — Paralelni Naručilac

**Obim:** `OWNER_LOCKED_SOURCE`. **Kriterijum zatvaranja:** Jedan Naručilac sme istovremeno ugovoriti različite ljude; bez lažnog requester busy gate-a.

### F129 — Redovna nedeljna dostupnost

**Obim:** `SOURCE_MERGED_NOT_LIVE`. **Kriterijum zatvaranja:** Više prozora, period važenja i dani; save/readback iste verzije i zone.

### F130 — Posebni datumi i preklapanje prozora

**Obim:** `SOURCE_MERGED_NOT_LIVE`. **Kriterijum zatvaranja:** AVAILABLE/UNAVAILABLE sa jasnom prednošću; noćni interval i susedni dani ne dupliraju slobodno vreme.

### F131 — Dostupan sam ON/OFF

**Obim:** `OWNER_LOCKED_SOURCE`. **Kriterijum zatvaranja:** ON traje do OFF/safety, bez proizvoljnog isteka; ne nadjačava rezervacije i UNAVAILABLE i ne uključuje HITNO.

### F132 — OFF i budući poslovi

**Obim:** `OWNER_LOCKED_SOURCE`. **Kriterijum zatvaranja:** OFF gasi neposredne proactive pozive, a čuva podobne buduće prilike i ručno istraživanje/prijavu.

### F133 — Izmena, otkaz i završetak u kalendaru

**Obim:** `SOURCE_MERGED_NOT_LIVE`. **Kriterijum zatvaranja:** Prihvaćena promena pomera rezervaciju uz konflikt; otkaz/završetak oslobađaju, istorija verzija ostaje.

### F134 — Drugi uređaj i DST

**Obim:** `SOURCE_MERGED_NOT_LIVE`. **Kriterijum zatvaranja:** Expected revision štiti upis; nepostojeće/dvosmislene civilne satnice ne postaju proizvoljan instant.

## M14 — Recenzije, reputacija i utisci

Radni paketi: W10. Površine: D06, P04, R06, P01, S06.

**Provereno stanje:** Postoje placeholder polja u public/Agreement projekcijama. U fresh live popisu nema review engine-a. Istorijski owner register već određuje veliki deo prikaza.

**Podaci i autoritet:** Pravi COMPLETED Dogovor + autor/ocenjivani smer → review ID → moderaciona podobnost → proseci/lista/broj. Ne koristi proizvoljne demo ocene.

**Dizajn:** Kratka ocena iz Dogovora; javni pregled u profilu. Zvezdice i komentar nisu dugme koje otvara profil; avatar/ime jesu.

**Izvori:** E02, E07, E14, E15, E18.

### F135 — Ulaz posle dozvoljenog završetka

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** CTA u završenom Dogovoru, zatim čeka na listi ako odloženo; ne blokira normalno korišćenje aplikacije.

### F136 — Ocena i opcioni komentar

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** 1–5, bez unapred izabranih zvezdica; stvaran ljudski komentar, bez AI izmišljanja utiska.

### F137 — Jedinstven smer i retry

**Obim:** `TARGET_ENGINEERING`. **Kriterijum zatvaranja:** Pravo autora na ovaj Dogovor i dozvoljeni smer; ponovljen submit ne pravi drugu ocenu.

### F138 — Primljene i poslate recenzije

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Profil → Ocene: odvojeni pogledi; svaki vlasnički detalj zna odgovarajuću saradnju.

### F139 — Javni sažetak i feed

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Prosek/broj i stvarne individualne recenzije ispod; bez komentara ostaje star-only unos.

### F140 — Autor i starost recenzije

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Dozvoljeni javni avatar/ime i relativni dan/nedelja/mesec/godina iz timestamp-a; bez minuta/sati i privatne adrese.

### F141 — Profil autora i povratak

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Tap samo avatar/ime otvara tačnog autora; Back vrati pregledani profil i prethodni scroll u recenzijama.

### F142 — Broj završenih poslova i potvrđen identitet

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Broj distinct COMPLETED po ulozi odvojen od proseka/broja ocena; helper headcount ne proizvodi više reputacionih kredita.

### F143 — Prijava recenzije, moderacija i nedostupno

**Obim:** `TARGET_POLICY`. **Kriterijum zatvaranja:** Stvarna promena podobnosti utiče na feed i aggregate; prijava sama nije automatsko brisanje. Novi korisnik ≠ nepovezan servis.

### F144 — Rok, izmena, objava obe ocene i objedinjavanje

**Obim:** `OWNER_DECISION`. **Kriterijum zatvaranja:** Ne izmišljati rok niti blind-review model; ne menjati već potvrđen javni izgled. Zajednički account score vs prikazi uloga razrešiti eksplicitno.

## M15 — Inbox, push i distribucija prilika

Radni paketi: W06, W07. Površine: S06, S08, W03, W06, D02.

**Provereno stanje:** Inbox, preferencije i push registry postoje u live. Jedina izlistana Edge funkcija je AI interview; stvarni push dispatch/provider/handset nije potvrđen ovom proverom.

**Podaci i autoritet:** Business event → recipient delivery/inbox → current authorized target; transport ticket/receipt nije poslovni objekat.

**Dizajn:** Kratka radnja/događaj + prepoznatljiv predmet. Pažnja za odluku odvojena od informacije i rasporeda.

**Izvori:** E02, E07, E14, E18.

### F145 — Matching iz stvarnih sposobnosti

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Zahtevi, oblast, kapacitet i raspoloživost iz jedne semantike; nema izmišljene preporuke ili raw procenta.

### F146 — Distribucija običnog posla

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Ko je podoban, kome event pripada i zašto je još akcioni podatak odvojiti od broja push pokušaja.

### F147 — Inbox i status pročitano

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Jedan događaj ne postaje tri stavke zbog tri kanala; mark-read i mark-all imaju cutoff i owner opseg.

### F148 — Duboki link iz događaja

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Posle auth-a ponovo ovlastiti cilj; obrisan/stale/tuđ target daje jasan ishod, ne pogrešan ekran.

### F149 — Preference po vrsti i kontekstu

**Obim:** `CANON_PARTIAL`. **Kriterijum zatvaranja:** Kanali i događaji odvojeni od OS dozvole; drugi uređaj ne prepiše noviju reviziju tihim save-om.

### F150 — Tihi sati i HITNO izuzetak

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Tihi sati važe; odvojen izričit urgent override je default OFF. Nije uključen samim Dostupan sam.

### F151 — Push uređaj, isporuka i nevažeći token

**Obim:** `TARGET_PROVIDER`. **Kriterijum zatvaranja:** Registracija/opoziv po nalogu, ticket/receipt obrada, dead token, retry; nema garantovanog handset prijema iz server receipt-a.

### F152 — Odložena isporuka i ponovno proveravanje

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Pre slanja posle tihih sati proveriti verziju, popunjenost i podobnost; stari posao se ne šalje kao sveža prilika.

## M16 — Javna pitanja, bezbednost i podrška

Radni paketi: W05, W09, W11. Površine: S10, D05, W04, R04, EXT-QA.

**Provereno stanje:** Q&A i problem RPC osnova postoje, ali policy/admission i operativna podrška nisu time dokazani. Klijentski problem u Dogovoru nije ceo safety engine.

**Podaci i autoritet:** Question/answer current Need revision; system-only author. Safety case i problem flag različiti autoriteti; dokaz najmanje privilegovan.

**Dizajn:** Pomoć dostupna iz problema; ne skrivati sigurnosno bitne uslove u neprimetni +n radi kraće kartice.

**Izvori:** E02, E14, E18.

### F153 — Postavljanje anonimnog pitanja

**Obim:** `GATED`. **Kriterijum zatvaranja:** Sistem zadrži autora za abuse, Naručilac i javnost ga ne vide; nepovezan gate nije lažna uspešna objava.

### F154 — Odgovor, izmena, odbijanje i prijava pitanja

**Obim:** `GATED`. **Kriterijum zatvaranja:** Javno tek odgovoreno; Izmenjeno marker i history; materijalna promena ne zaobilazi Need revision pravila.

### F155 — Prijavi korisnika, sadržaj ili saradnju

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Pravi case ID/status i dokaz, ne prazna potvrda; bez obećanog vremena odgovora bez operativne službe.

### F156 — Blokiranje i aktivni Dogovor

**Obim:** `RECONCILE_OWNER_LOCK`. **Kriterijum zatvaranja:** D0066 ne finalizuje block pre terminalnog Dogovora, ali report ostaje dostupan; ne brisati dokaze i ne izmišljati suprotno pravilo.

### F157 — Sankcije i žalba

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Jedan običan otkaz ne znači automatsku kaznu; ozbiljna mera nije samostalna konačna AI odluka; tekst i operaterski tok stvarni.

### F158 — Potvrđen nedolazak i zamena

**Obim:** `HISTORICAL_TARGET_RECONCILE`. **Kriterijum zatvaranja:** Prijava no-show nije utvrđenje. Historijski replacement za istu oslobođenu alokaciju nosi otvorenu clean primenu i posebno pitanje fleksibilnog kraja.

### F159 — Praćenje sopstvenog slučaja

**Obim:** `TARGET_OPERATIONS`. **Kriterijum zatvaranja:** Korisnik vidi dozvoljen status i odgovor, a ne interne moderacione podatke drugih ljudi.

## M17 — HITNO kao ubrzana distribucija

Radni paketi: W12. Površine: H01, R04, W04, S08.

**Provereno stanje:** Live urgent_activation_policy.enabled=false i allowedCategories=[]; preview/activation RPC postoje. Eksperimentalni config brojevi nisu novo odobrenje.

**Podaci i autoritet:** Isti Need revision + approved policy + dispatch round + odgovori; isti Application/Selection/Agreement engine.

**Dizajn:** Vidljivo hitno tamo gde je važeće, bez countdown-a iz telefonskog sata ili širenja badge-a na svaku površinu.

**Izvori:** E02, E14, E18.

### F160 — Pregled podobnosti i aktivacije

**Obim:** `GATED`. **Kriterijum zatvaranja:** Pravila, važenje i cena ako postoji moraju biti prikazani pre aktivnosti; nema samostalne AI odluke.

### F161 — Poziv podobnom Uskočeru

**Obim:** `GATED`. **Kriterijum zatvaranja:** Relevantan task/time/oblast, preference i tiha pravila; nema prisile ni skrivenog urgent opt-in-a.

### F162 — Mogu odmah i više odgovora

**Obim:** `GATED`. **Kriterijum zatvaranja:** Odgovor nije automatski dobijanje posla; isti revision/slots izbor, sprečeno prepunjavanje.

### F163 — Istek, niko se nije javio i popunjeno

**Obim:** `GATED`. **Kriterijum zatvaranja:** Server status i razumljiva sledeća radnja; bez garancije da će pomoć stići.

### F164 — Povratak u normalnu distribuciju

**Obim:** `TARGET_POLICY`. **Kriterijum zatvaranja:** Samo po odobrenom pravilu; ne kreira se neprimetno drugi Zadatak ili drugo terećenje.

## M18 — Privatnost, pravila, podaci i zatvaranje naloga

Radni paketi: W11. Površine: S07, S09, S11, P01, EXT-LEGAL.

**Provereno stanje:** Postoje source ugovori i pending temelji za više data-rights/pravnih tokova. Live87 nije isto source promotion; zahtev za izvoz nije gotov fajl.

**Podaci i autoritet:** Account-owner request ledger → operativno izvršenje → receipt/download ili closure. Retention/evidence hold ne zaobilazi se UI brisanjem.

**Dizajn:** Jasni odvojeni koraci, bez lažnog Trajno obrisano, automatske saglasnosti ili download dugmeta bez fajla.

**Izvori:** E02, E14, E18, E20.

### F165 — Podešavanja i privatnost

**Obim:** `TARGET_BINDING`. **Kriterijum zatvaranja:** Javne i privatne stvari razumljive; svi ulazi imaju konkretan cilj, ne beskonačni placeholder ekran.

### F166 — Pravne verzije i saglasnosti

**Obim:** `SOURCE_PARTIAL_GATED`. **Kriterijum zatvaranja:** Odobren sadržaj/verzija i izdvojena saglasnost; samo otvaranje nije prihvatanje.

### F167 — Zahtev, status i otkaz izvoza

**Obim:** `SOURCE_PARTIAL`. **Kriterijum zatvaranja:** Pravi receipt/status; pozivanje REQUESTED ne prikazuje READY.

### F168 — Stvarna izvozna arhiva

**Obim:** `TARGET_OPERATIONS`. **Kriterijum zatvaranja:** Generisan fajl, ograničen pristup, expiry/retry; drugi nalog nema pristup ni starom kešu.

### F169 — Priprema zatvaranja naloga

**Obim:** `TARGET`. **Kriterijum zatvaranja:** Aktivni Dogovori, dugovane radnje i posledice iz servera; bez proizvoljnog brisanja još živih obaveza.

### F170 — Izvršenje zatvaranja i opoziv

**Obim:** `TARGET_OPERATIONS`. **Kriterijum zatvaranja:** Sesije, push i novi upisi zatvoreni, privatni cache očišćen; evidence hold po politici, ne sve zauvek ostaje niti sve odmah nestaje.

### F171 — Storage cleanup i retention

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Odobreni rokovi/svrhe, audit brisanja i idempotentna obrada; ne uklanjati aktivne dokaze.

## M19 — Operacije, pristupačnost i izdanje

Radni paketi: W00, W05, W07, W10, W11, W12, W13. Površine: S01, S05, S07, S09, S10, S11, EXT-RELEASE.

**Provereno stanje:** Postoje build/test/provenance mehanizmi. Ova revizija ne pokreće CI, migracije, store submission ili produkcionu aktivaciju.

**Podaci i autoritet:** Jedan source snapshot + migration manifest + runtime/environment ID + capability gates; operativni audit bez suvišnog PII.

**Dizajn:** U svakoj porodici ekrana pristupačnost i stvarna stanja su deo dizajna, ne naknadna dekoracija.

**Izvori:** E02, E06, E14, E18, E19, E21.

### F172 — Moderacija, support i identity operacije

**Obim:** `TARGET_OPERATIONS`. **Kriterijum zatvaranja:** Pravi red slučajeva, dozvole, radnje, trag i korisnički povratak; ne izmišljati operatera iza frontend poruke.

### F173 — Worker jobs i oporavak poslova

**Obim:** `TARGET_OPERATIONS`. **Kriterijum zatvaranja:** Auto-completion, dispatch, export i cleanup imaju ponovljivo izvršenje, monitoring i jasan failure recovery.

### F174 — RLS/RPC i privatnost trećeg naloga

**Obim:** `TARGET_VERIFICATION`. **Kriterijum zatvaranja:** Test kroz realni Auth/API, ne samo SQL admina; privatna lokacija, media, review author i export tačno po opsegu.

### F175 — Pristupačnost i tekst

**Obim:** `DESIGN_REQUIRED`. **Kriterijum zatvaranja:** Čitač ekrana, fokus, veliki font, kontrast, dugi nazivi, tastatura i smanjeno kretanje na stvarnim platformama.

### F176 — Performanse i 600 stavki

**Obim:** `TARGET_VERIFICATION`. **Kriterijum zatvaranja:** Profilisati listu/paginaciju/render, brz scroll i povratak, ne samo broj uspešnih testova.

### F177 — Izolovan build i podudarnost okruženja

**Obim:** `TARGET_VERIFICATION`. **Kriterijum zatvaranja:** Tačan commit, source/live/pending diferencija i ponovljiv test; ne maskirati nedostajući publish ručnim SQL fixture-om.

### F178 — Promocija i bezbedan rollback

**Obim:** `TARGET_OPERATIONS`. **Kriterijum zatvaranja:** Odobren test/preflight/postflight, stare migration bytes ne menjati, kompatibilni clients i odvojeni kill-switch po capability-ju.

### F179 — Soft/obavezni update i restart

**Obim:** `OWNER_LOCKED_TARGET`. **Kriterijum zatvaranja:** Običan update nije prisilan; kritični min-version vodi u zvaničnu prodavnicu bez zahteva za destruktivnim resetom.

### F180 — Store kandidati i izveštaj završetka

**Obim:** `TARGET_VERIFICATION`. **Kriterijum zatvaranja:** Pravi Android/iOS dokaz i policy sadržaj; jasno šta radi, gde je dokazano i šta još nije aktivno.

## M20 — Ograničeni budući obim — ne uvoditi krišom

Radni paketi: W00, W12, W13. Površine: EXT-SCOPE.

**Provereno stanje:** Ove teme se pojavljuju u istorijskim idejama ili predlozima. Nisu sve obavezne clean-V1 funkcije niti imaju potvrđen canonical ugovor.

**Podaci i autoritet:** Nova poslovna funkcija traži eksplicitnu odluku i mapiranje, ne samo nacrtan ekran.

**Dizajn:** Ne zatrpati jednostavnu aplikaciju projekt-menadžmentom ili finansijskim proizvodom.

**Izvori:** E02, E14, E18.

### F181 — NeedPlan kao organizaciona celina

**Obim:** `HISTORICAL_OPTIONAL`. **Kriterijum zatvaranja:** Više nezavisnih zadataka može imati umbrella projekciju; bez novog writable lifecycle-ja i bez obaveze posebnog V1 plan editora.

### F182 — Ponavljajući zadaci i dupliranje

**Obim:** `OWNER_SCOPE_DECISION`. **Kriterijum zatvaranja:** Kalendar dostupnosti nije scheduler koji sam objavljuje nove poslove. Kopija traži novi pregled, nema nasleđenog izbora/naplate.

### F183 — Paketi i pretplate

**Obim:** `FUTURE_POLICY`. **Kriterijum zatvaranja:** Samo posle cenovnika/provider/store odluka; trenutna headcount/promo pravila ne izmišljaju novu pretplatu.

### F184 — Organizacije i nalozi pomoćnika

**Obim:** `OPTIONAL_NOT_V1`. **Kriterijum zatvaranja:** Team V0 ostaje nosilac + broj ljudi; posebni permissions/članstva nisu tihi dodatak profilu.

### F185 — Balkan i više tržišta

**Obim:** `TARGET_SCOPE_RECONCILE`. **Kriterijum zatvaranja:** Mesto zadatka može biti odvojeno od autora; države, valute i legal politike nisu automatski aktivne time što mapa može da se pomeri.

### F186 — Novčanik, escrow, live praćenje i auto-selection

**Obim:** `NOT_AUTHORIZED`. **Kriterijum zatvaranja:** Ne uvoditi iz ikone novčanika, GPS dozvole ili AI preporuke; to su posebni proizvodi/odluke, ne polish.