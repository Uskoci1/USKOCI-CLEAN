# Status 186 funkcija — V2

**Ovo nisu procenti završene aplikacije.** `prototype resolved` označava samo navedeni lokalni podskup. Izvorni kriterijumi ostaju neizmenjeni. `source_current` u JSON-u je istorijski snapshot iz handoff-a, ne nova live provera.

{'prototype resolved': 15, 'target shown': 127, 'open decision': 10, 'gated shown': 16, 'non-UI': 17, 'still missing': 1}

## F001 — Odobrena intro sekvenca
**Izvorni kriterijum:** Izvor i završni kadar imaju iste otiske pre i posle rada; promenjen je samo neophodan native adapter uz vizuelnu proveru.

**V2:** prototype resolved. Original source blocks/end render preserved. Choice sweep fixed. 41 pure math checks are not native motion/performance proof.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F002 — Prvi, ponovni ulazak i duboki link
**Izvorni kriterijum:** Prvi ulazak dobija intro; korisnik koji otvara postojeći Dogovor stiže do ovlašćenog cilja bez nepotrebne ceremonije.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F003 — Izbor i promena namere
**Izvorni kriterijum:** Isti nalog ima obe namere; povratak čuva dozvoljeni cilj i ne menja ulogu u već postojećem Dogovoru.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F004 — Prijava emailom i lozinkom
**Izvorni kriterijum:** Uspeh otvara traženi cilj; greška ostaje uz unos; dvostruki submit i promena naloga ne otvore tuđ cilj.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F005 — Registracija i potvrda emaila
**Izvorni kriterijum:** Unos, zahtev za potvrdu, ponovno slanje i potvrđena sesija odvojeni; zahtev za potvrdu nije dokaz potvrđenog naloga.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F006 — Dostupnost dodatnih Auth metoda
**Izvorni kriterijum:** OTP ili drugi provajder prikazuje se samo ako je servis stvarno raspoloživ; nema dekorativnih Google/Apple/telefon dugmadi.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F007 — Oporavak naloga
**Izvorni kriterijum:** Zahtev → email link → nova lozinka → povratak na prijavu; cold/warm, istekao i ponovo upotrebljen link provereni.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F008 — Istek sesije i odjava
**Izvorni kriterijum:** Zaštićena radnja zaustavljena, bez gubitka dozvoljenog nacrta; privatni podaci nisu dostupni drugom nalogu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F009 — Dozvole u trenutku potrebe
**Izvorni kriterijum:** Lokacija, mikrofon, kamera i push traže se zasebno; odbijanje ima smislen alternativni put.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F010 — Bezbednost sesija i ponovna autentikacija
**Izvorni kriterijum:** Osetljive radnje imaju stvarno serverom traženu potvrdu; ne prikazuje se izmišljena lista uređaja.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F011 — Profil centar
**Izvorni kriterijum:** Avatar otvara profil; namera, Radni profil, raspored, utisci, privatnost i podešavanja imaju jasan cilj i povratak.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F012 — Lični podaci
**Izvorni kriterijum:** Ime, grad, bio i dozvoljena polja čuvaju se za isti account; email i telefon ne postaju javni.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F013 — Profilna fotografija
**Izvorni kriterijum:** Izbor, pregled, upload, zamena i uklanjanje imaju status; potpisani pristup, stari fajl i keš obrađuju se odvojeno.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F014 — Javni profil obe strane
**Izvorni kriterijum:** Isti public-safe DTO daje osobu, grad, bio, dostupnu reputaciju; nema kopiranja sirovog app_profiles reda.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F015 — Veštine i usluge
**Izvorni kriterijum:** Dodavanje/uređivanje/uklanjanje preko razumljivih grupa; zajednička semantika sa zahtevima Zadatka i matching-om.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F016 — Alat, dozvole i iskustvo
**Izvorni kriterijum:** Samo relevantni urednici; samoprijava ne postaje verifikovan dokaz; zahtev za dozvolu dolazi iz policy-ja.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F017 — Vozila i kapaciteti
**Izvorni kriterijum:** Tip, teret ili sedišta traže se kada imaju smisla; ne popunjavaju se zamišljeni kilogrami ili brojevi iz reči kombi.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F018 — Tim i odgovorni nosilac
**Izvorni kriterijum:** Jedan nosilac navodi koliko ljudi obezbeđuje; nema obaveznog naloga ili imena svakog pomoćnika.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F019 — Aktivacija i obustavljen profil
**Izvorni kriterijum:** Pregled pre aktivacije, jasni minimumi, DRAFT/ACTIVE/SUSPENDED iz autoriteta; browsing dozvoljen pre prve Prijave.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F020 — Sačuvana oblast rada
**Izvorni kriterijum:** Grad/radijus/origin menja se eksplicitno; pretraga drugog grada ne prepisuje matching profil.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F021 — Potvrđen identitet i objašnjenje bedža
**Izvorni kriterijum:** Važeća server potvrda daje bedž na obe uloge; istek/opoziv ga uklanja; tap objašnjava usko značenje, ne garantuje bezbednost.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F022 — Početak i nastavak intervjua
**Izvorni kriterijum:** Povratak otvara isti razgovor i poslednji potvrđeni profil, a ne novi prazan intervju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F023 — Razumevanje veština i usluga
**Izvorni kriterijum:** AI izdvaja stvarno rečeno, prepoznaje sinonime preko zajedničke semantike i pita samo šta nedostaje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F024 — Pitanja o alatima, vozilu i timu
**Izvorni kriterijum:** Ne zaključuje nosivost, iskustvo ili broj ljudi iz posrednih nagoveštaja; traži potrebnu dopunu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F025 — Dostupnost iz prirodnog govora
**Izvorni kriterijum:** Posle posla ostaje neodređeno dok korisnik ne razjasni dane i prozore; čuva se vremenska zona.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F026 — Uređivanje tokom razgovora
**Izvorni kriterijum:** Ručna korekcija i AI predlog vide isti aktivni skup činjenica; zakasneli odgovor ne prepisuje noviju korekciju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F027 — Pregled i aktivacija profila
**Izvorni kriterijum:** Prihvata se prikazana verzija sposobnosti; provider rezultat sam ne aktivira profil.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F028 — Promena profila posle slanja Prijave
**Izvorni kriterijum:** Nova veština/profil ne prepisuje stare Prijave i njihove capability snapshot-e.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F029 — Novi razgovor i nastavak nacrta
**Izvorni kriterijum:** Jedan conversation ID po nacrtu; prekid, povratak i refresh ne kreiraju duplikat.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F030 — Tekstualni odgovor i sledeće pitanje
**Izvorni kriterijum:** Pitanje ostaje vidljivo; AI ne ponavlja svaku činjenicu kao praznu potvrdu; sadržaj se čuva na pravom razgovoru.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F031 — Jedinstveni živi predmet
**Izvorni kriterijum:** Kartica i razgovor prikazuju isto stanje; nema paralelnog price/time store-a sa drugačijim vrednostima.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F032 — Naslov, opis i kategorija
**Izvorni kriterijum:** Kratak smislen naslov i očuvan puni opis; kategorija validna i ne izmišlja novu publication dozvolu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F033 — Imam cenu ili tražim ponude
**Izvorni kriterijum:** Režim i iznos odvojeni; iznos u valuti, ne nejasan string; nema izmišljene AI cene.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F034 — Broj potrebnih ljudi
**Izvorni kriterijum:** Pozitivan ceo broj kad je poznat; nepoznato nije nula; potrebe i popunjenost nisu broj Prijava.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F035 — Zahtevi posla
**Izvorni kriterijum:** Veštine, alat, vozila, licence, iskustvo i bitni uslovi imaju tip/poreklo i odgovarajuća prava.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F036 — Termin i njegova nepreciznost
**Izvorni kriterijum:** Tačan interval, početak bez trajanja, datum, rok i fleksibilnost nisu isto; nema automatskog trajanja od jednog sata.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F037 — Ručni unos i korekcija
**Izvorni kriterijum:** Isti review/draft model; ručna forma nije prečica oko bezbednosne provere i potvrde.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F038 — Istorija razgovora
**Izvorni kriterijum:** Svi stvarni potezi dostupni na zahtev; povratak čuva aktivni unos i položaj, bez izlaganja privatnih facts javno.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F039 — Konačni ljudski pregled
**Izvorni kriterijum:** Jedna jasna završna kontrola prikazane verzije; nema potvrđivanja svake jasno prepoznate govorne reči.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F040 — Čuvanje nacrta
**Izvorni kriterijum:** Nacrt ostaje privatan, sa datumom/podacima; retry iste namere ne pravi novi Zadatak.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F041 — Izmena postojećeg Zadatka kroz isti editor
**Izvorni kriterijum:** Učita se tačan task ID/revizija; sačuva se nova revizija tog zadatka, ne novi draft bez veze.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F042 — Složena i višelokacijska potreba
**Izvorni kriterijum:** Jedna obaveza kroz više stanica ostaje jedan Zadatak; nezavisni izvođači/cene daju odvojene zadatke uz ljudsku potvrdu predloga.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F043 — Kontekstna dozvola i početak slušanja
**Izvorni kriterijum:** Jasan start i indikator pristupa mikrofonu; odbijena dozvola ostavlja kucanje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F044 — Waveform i živi transkript
**Izvorni kriterijum:** Talas reaguje na stvarni signal, interim reči se menjaju bez dupliranja; nema animacije koja lažno tvrdi da AI razume.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F045 — Granica govornog poteza
**Izvorni kriterijum:** Automatski završetak ili Završi ne zahtevaju još jedno Pošalji; eksplicitni start/stop su i dalje dostupni.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F046 — Razjašnjenje i finalna potvrda
**Izvorni kriterijum:** Nejasan termin/iznos se razjasni; samo konačni review daje ljudsku potvrdu za materijalni upis.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F047 — Otkaz, pozadina i promena naloga
**Izvorni kriterijum:** Audio i kasni callbacks prestaju; prethodni kucani nacrt ne nestaje, ni delimičan govor ne odlazi pogrešnom nalogu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F048 — Kamera/galerija i pregled priloga
**Izvorni kriterijum:** Svaki fajl ima pojedinačno pending/uspeh/grešku; neuspešna slika ne briše opis.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F049 — Upload, retry, zamena i uklanjanje
**Izvorni kriterijum:** Stable request/ref, dozvole, ograničenja formata i veličine; nema javnog upisa privatnog fajla.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F050 — Galerija u detalju i pristup medijima
**Izvorni kriterijum:** Signed/pravilno odobren prikaz, expiry i 403 imaju ponašanje; primarna browse kartica ostaje bez task thumbnail-a.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F051 — Životni vek medija
**Izvorni kriterijum:** Uklanjanje sa oglasa odvojeno od trajnog brisanja; prihvaćeni dokaz/legal hold ostaje samo po odobrenoj svrsi i roku.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F052 — Posao na jednoj lokaciji
**Izvorni kriterijum:** Grad/područje javno, precizna adresa posebno potvrđena i privatna.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F053 — Preuzimanje i dostava
**Izvorni kriterijum:** Početak i kraj pravilno označeni; radijus polazi od prve radne tačke, a ne korisnikovog trenutnog telefona.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F054 — Više stanica i rad u oblasti
**Izvorni kriterijum:** Čuva se redosled stanica i semantička oblast; jedna timska obaveza nije automatski više Dogovora.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F055 — Rad na daljinu
**Izvorni kriterijum:** Bez obavezne lokacije/GPS-a; prelazak u remote uklanja aktuelni privatni zahtev bez prepisivanja istorijskih dokaza.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F056 — Ručno potvrđivanje i resolver predlog
**Izvorni kriterijum:** Provider rezultat nije potvrđen unos; privatni tekst se ne šalje geocoder-u kao public query.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F057 — Blizu mene
**Izvorni kriterijum:** GPS se koristi privremeno i samo u traženom kontekstu; nema tihog background praćenja.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F058 — Sačuvaj oblast za rad
**Izvorni kriterijum:** Posebna eksplicitna radnja; browsing drugog grada i opoziv GPS dozvole ne menjaju već potvrđenu oblast.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F059 — Nedostajuća ili nevažeća tačka
**Izvorni kriterijum:** Zadatak ostaje u listi; prikaz objašnjava ograničenje mape, bez izmišljenog centra/grada.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F060 — Pregled objave i privatnosti
**Izvorni kriterijum:** Javni tekst/fotografije odvojeni od private exact/access; korisnik vidi stvarni sadržaj koji izlazi drugima.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F061 — ALLOW / CLARIFY / REVIEW / BLOCK
**Izvorni kriterijum:** Verzionisani policy autoritet, minimalna razjašnjenja, nema lažnog obećanja trajanja pregleda ni AI zakonskog improvizovanja.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F062 — Objava i potvrđeno javno stanje
**Izvorni kriterijum:** Tek receipt/readback daju status objave i distribuciju; unknown ostavlja proveru istog pokušaja.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F063 — Vlasnički detalj i stanje posla
**Izvorni kriterijum:** Nacrt/otvoren/popunjen/zatvoren jasno razlikovati; objavljen zadatak nije isto što i završena saradnja.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F064 — Pokrivenost i više Prijava
**Izvorni kriterijum:** 0/2, 1/2, 2/2 iz kanonske coverage projekcije; ne iz broja ponuda i ne iz review statistike.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F065 — Materijalna izmena i diff
**Izvorni kriterijum:** Stare nepodudarne Prijave traže pregled; prihvaćeni Dogovori ne prepisuju se izmenom oglasa.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F066 — Zatvaranje prijema preostalih mesta
**Izvorni kriterijum:** Prestaje nova prijava za nepopunjena mesta; postojeće saradnje ostaju vidljive i prate sopstveni lifecycle.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F067 — Otkaz Zadatka
**Izvorni kriterijum:** Prikazati stvarnu serversku posledicu za prijave/alokacije; ne poistovetiti sa otkazom svakog Dogovora bez dokaza.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F068 — Brisanje nacrta
**Izvorni kriterijum:** Samo dozvoljeni nacrt; potvrda posledice; disposable media se obrađuje po retention politici.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F069 — Istorija i povratak na isti posao
**Izvorni kriterijum:** Stari posao je pretraživ, sa svojim ID-jem i istorijom; kolekcijsko arhiviranje ne menja poslovno stanje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F070 — Javno tržište u obe namere
**Izvorni kriterijum:** Obe namere mogu istraživati isti javni skup; browsing ne daje pravo na Prijavu ili privatnu adresu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F071 — Kompaktna kartica i celi detalj
**Izvorni kriterijum:** Ista anatomija; kratak opis i kritični uslovi vidljivi, puni opis/galerija dostupni bez gubitka konteksta.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F072 — Lista / Mapa i odabrani pin
**Izvorni kriterijum:** Isti snapshot, kamera i selekcija; card tap i pin fokus ne otvaraju drugi posao.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F073 — Klasteri guste oblasti
**Izvorni kriterijum:** Cluster otvara/uvećava stvarnu grupu; nikad proizvoljno izabran skriveni Zadatak.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F074 — Pomeranje i osvežavanje mape
**Izvorni kriterijum:** Settled viewport/debounce; nema upita za svaki kadar. Raspored map/list/panel voditi kroz odluku X04.

**V2:** still missing. Local SVG pan/zoom/manual viewport-apply works and list subset is shared. Real geographic viewport, cartography/provider and X04 remain open; full function not closed.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F075 — Pretraga javnih zadataka
**Izvorni kriterijum:** Pretraga nad celim dozvoljenim query-jem, ne samo učitanom prvom stranom i ne nad privatnim adresama.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F076 — Filteri: gde, kada, način rada, cena i vrsta
**Izvorni kriterijum:** Jasan obim/valuta; unknown i OFFERS nisu nulta cena. Filteri zavise od raspoloživih potvrđenih polja.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F077 — Sortiranje i preporučeni redosled
**Izvorni kriterijum:** Najbolje za mene samo sa realnim server ranking-om; nema prikaza izmišljenog procenta ili CARD match razloga.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F078 — Dodaj zadatak iz map konteksta
**Izvorni kriterijum:** U/Novi ili kontekstna akcija; zadrži oblast kao predlog, ne kao automatski potvrđenu privatnu lokaciju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F079 — Vrati se iz detalja ili profila
**Izvorni kriterijum:** Isti filteri, redosled, scroll anchor i pin; nedostupan objekat ima eksplicitan ishod.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F080 — Moji zadaci: aktivni, nacrti i istorija
**Izvorni kriterijum:** Segmenti su pogledi nad pravim stanjima, a ne nova paralelna state machine.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F081 — Prijave: aktivne, za pregled, izabrane, zatvorene
**Izvorni kriterijum:** Prijave ne nestaju jer se namera promenila; izabrana vodi na pripadajući Dogovor.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F082 — Dogovori: aktivni i istorija
**Izvorni kriterijum:** Ja naručujem/ja radim je filter unutar istog naloga; jedan Dogovor se ne broji dvaput.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F083 — Pretraga sopstvenih zbirki
**Izvorni kriterijum:** Naslov, javno dozvoljen saradnik, oznaka i period; ne otkriva private susednog naloga ili skrivenog Q&A autora.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F084 — Treba moja radnja / nova informacija
**Izvorni kriterijum:** Odvojiti odluku od nepročitane poruke i termina uskoro; clear opis razloga, ne jedna neodređena tačka za sve.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F085 — Filteri i sortiranje kolekcija
**Izvorni kriterijum:** Statusi specifični modulu; vremenski filter kaže da li filtrira termin, objavu ili završetak.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F086 — Grupisanje po vremenu
**Izvorni kriterijum:** Aktivni po stvarnom terminu uz posebnu grupu bez satnice; istorija po mesecu događaja iz izabrane semantike.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F087 — Paginacija i virtualizacija
**Izvorni kriterijum:** Server filtering pre cursor-a, stabilno tie-break ID, provera deduplikacije i bez serije ulaznih animacija preko 600 redova.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F088 — Povratak, refresh i novi događaji
**Izvorni kriterijum:** Stari položaj/selektovani red ostaje; zakasneli rezultat starog query-ja ne prepiše novi filter/nalog.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F089 — Delimično učitano, prazno i greška
**Izvorni kriterijum:** Nema rezultata nije isto što i neuspela druga strana; retry stranice ne briše potvrđeni raniji sadržaj.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F090 — Pregled više Dogovora jednog Zadatka
**Izvorni kriterijum:** R04 sabira pokrivenost po autoritetu, a lista Dogovora zadržava svaku saradnju, svog partnera, cenu i verziju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F091 — Ulaz u Prijavu i provera uslova
**Izvorni kriterijum:** Nije sopstveni posao; aktuelni Need prima prijave; worker minimum zadovoljen; povratak iz dopune čuva cilj.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F092 — Ponuda i broj ljudi
**Izvorni kriterijum:** Cena za stvarni ponuđeni obim, slots unutar kapaciteta i preostalih mesta; timska i pojedinačna cena se ne izjednačavaju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F093 — Predloženi termin i napomena
**Izvorni kriterijum:** Eksplicitni interval odvojen od fleksibilnog; sadržaj ne menja oglas i čuva se uz verziju Prijave.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F094 — Pregled sposobnosti u Prijavi
**Izvorni kriterijum:** Prikaz samo self-declared snapshot-a relevantnog za tu Prijavu; kasniji profil ga ne prepisuje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F095 — AI pomoć za Prijavu
**Izvorni kriterijum:** Pomiriti D0055 sa novijim composer tokom; isti aggregate i završni ljudski send, bez drugog engine-a ili obaveznog novog intervjua napamet.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F096 — Slanje i potvrđeni rezultat
**Izvorni kriterijum:** Ista Prijava vidljiva worker-u i vlasniku; timeout/double tap ne stvaraju dve.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F097 — Moja Prijava i povlačenje
**Izvorni kriterijum:** Stanje iz autoriteta, razlog i posledica povlačenja; izabrana Prijava otvara Dogovor, ne obično brisanje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F098 — Promenjeni uslovi: zadrži/izmeni/povuci
**Izvorni kriterijum:** Prikaz diff-a, eksplicitno rebase ili nova verzija; ćutanje nije saglasnost i nema proizvoljnog expiry-ja.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F099 — Kandidati i pregled ponude
**Izvorni kriterijum:** Broj ponuda vidi ovlašćeni Naručilac; worker ne dobija tuđe prijave ili njihov tajni broj.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F100 — Poređenje dve ponude
**Izvorni kriterijum:** Upoređuju se cena/obim/termin/sposobnosti; lokalno poređenje nije serverski shortlist ili ranking upis.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F101 — Izbor tačne ponude
**Izvorni kriterijum:** CAS/revision/version/hash/idempotency; uspeh odmah CONFIRMED Dogovor, bez još jedne potvrde druge strane.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F102 — Konflikt, prepunjenost i ponovni izbor
**Izvorni kriterijum:** Prepunjeno ili zastarelo vraća pregled; više nezavisnih alokacija ima svoje Dogovore i ne prekoračuje kapacitet.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F103 — Promotivni pregled 0 RSD
**Izvorni kriterijum:** Jasno promo, bez izmišljene precrtane tarife, kartice i lažne bankarske uplate; jedno potvrđivanje Izbora.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F104 — Prikaz cene rada i platforme
**Izvorni kriterijum:** Dve stavke; rad se ne prikazuje kao plaćen platformi kada ga ona ne naplaćuje.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F105 — Quote/policy verzija i headcount
**Izvorni kriterijum:** Requester payer i covered-headcount nisu nova otvorena pitanja; konkretan budući iznos/config ostaje poseban.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F106 — Plaćena ponuda i metod plaćanja
**Izvorni kriterijum:** Samo odobren provider/channel i važeći quote; povratak na istog kandidata/reviziju, ne na prvi iz liste.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F107 — Obrada, odbijeno, odustajanje, unknown
**Izvorni kriterijum:** Jedan payment attempt i verifikovan status; ponovni ulaz ne duplira terećenje.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F108 — Plaćanje uspešno, Izbor konfliktan
**Izvorni kriterijum:** Nema lažnog Dogovora; receipt i recovery/kompenzacija po odobrenom pravilu.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F109 — Potvrda, istorija i odobreni finansijski dokumenti
**Izvorni kriterijum:** Aktivacioni receipt nije fiskalni račun; prikazuju se samo stvarno izdati dokumenti i odgovarajući iznosi.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F110 — Promena cenovnika i prestanak promocije
**Izvorni kriterijum:** Novi iznos pre saglasnosti; nema retroaktivne naplate starog nultog povezivanja niti obećanja da je svaka promena moguća bez app update-a.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F111 — Otkaz, refund i korekcija prava
**Izvorni kriterijum:** Odvojiti operativni otkaz, provider refund i podrškin correction; nema jednog dugmeta koje izmišlja sva tri ishoda.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F112 — Dogovori kao kartice iste porodice
**Izvorni kriterijum:** Naslov, prihvaćeni termin/cena, saradnik i moja uloga; broj ljudi je obim ove saradnje, ne globalno popunjeno/ukupno oglasa.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F113 — Pregled i ugovoreni sadržaj
**Izvorni kriterijum:** Tačna verzija vidljiva bez administrativnog dupliranja; kasniji edit oglasa ne prepisuje prihvaćeno.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F114 — Poruke i istorija
**Izvorni kriterijum:** Pristup učesnicima; chat ne zavisi od razmene telefona; čitanje starijih poruka ne briše aktivni composer.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F115 — Outbox i ponovni pokušaj poruke
**Izvorni kriterijum:** clientMessageId ostaje isti; potvrda poruke A ne briše nacrt B; read receipt nije izmišljen.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F116 — Deljenje i opoziv sopstvenog telefona
**Izvorni kriterijum:** Usmereno: deljenje mog broja ne otkriva tuđ; opoziv i terminalni pristup čiste prikaz i keš.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F117 — Otkrivanje tačne lokacije
**Izvorni kriterijum:** Samo dopušteni fizički Dogovor i pravi grant; remote ne traži adresu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F118 — Predlog promene cene/obima/termina
**Izvorni kriterijum:** Pregled sada/predloženo; expected version; promena cene ne izmišlja nepoznato trajanje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F119 — Prihvatanje, odbijanje ili zastarevanje predloga
**Izvorni kriterijum:** Druga strana prihvata; prihvat aktivira novu verziju i proverava booking bez nove petlje saglasnosti.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F120 — Problem u saradnji
**Izvorni kriterijum:** Problem flag odvojen od životnog stanja; zaustavlja automatski završetak i ima vezu ka pomoći, ne briše istoriju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F121 — Jednostrani otkaz Dogovora
**Izvorni kriterijum:** Druga strana nema veto; prikaz stvarne posledice za alokaciju/termin i obaveštenja, bez neodobrenog refund-a.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F122 — Završio sam / potvrdi završetak
**Izvorni kriterijum:** Worker otvara server window; requester može nezavisno potvrditi; nema obaveznih Krenuo/Stigao koraka.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F123 — Automatski završetak i terminalni prikaz
**Izvorni kriterijum:** Server rok i provera problema; klijent ne računa autoritativni kraj; release termina i prava dosledni.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F124 — Hronologija i sporni istorijski podaci
**Izvorni kriterijum:** Pregled sadrži stvarne događaje/verzije; kolekcijsko skrivanje ne uništava istoriju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F125 — Agenda sopstvenih saradnji
**Izvorni kriterijum:** Samo moji Dogovori; vreme iz accepted verzije, ne javni poslovi i izmenjeni roditeljski naslov.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F126 — Tačan termin i hard konflikt
**Izvorni kriterijum:** Samo dogovoren početak i kraj zauzimaju worker; paralelni upis ne napravi dvostruki booking.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F127 — Datum, rok, fleksibilno i nepoznato trajanje
**Izvorni kriterijum:** Ne popunjava satnicu celog dana/nedelje; posebna grupa bez tačnog termina.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F128 — Paralelni Naručilac
**Izvorni kriterijum:** Jedan Naručilac sme istovremeno ugovoriti različite ljude; bez lažnog requester busy gate-a.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F129 — Redovna nedeljna dostupnost
**Izvorni kriterijum:** Više prozora, period važenja i dani; save/readback iste verzije i zone.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F130 — Posebni datumi i preklapanje prozora
**Izvorni kriterijum:** AVAILABLE/UNAVAILABLE sa jasnom prednošću; noćni interval i susedni dani ne dupliraju slobodno vreme.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F131 — Dostupan sam ON/OFF
**Izvorni kriterijum:** ON traje do OFF/safety, bez proizvoljnog isteka; ne nadjačava rezervacije i UNAVAILABLE i ne uključuje HITNO.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F132 — OFF i budući poslovi
**Izvorni kriterijum:** OFF gasi neposredne proactive pozive, a čuva podobne buduće prilike i ručno istraživanje/prijavu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F133 — Izmena, otkaz i završetak u kalendaru
**Izvorni kriterijum:** Prihvaćena promena pomera rezervaciju uz konflikt; otkaz/završetak oslobađaju, istorija verzija ostaje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F134 — Drugi uređaj i DST
**Izvorni kriterijum:** Expected revision štiti upis; nepostojeće/dvosmislene civilne satnice ne postaju proizvoljan instant.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F135 — Ulaz posle dozvoljenog završetka
**Izvorni kriterijum:** CTA u završenom Dogovoru, zatim čeka na listi ako odloženo; ne blokira normalno korišćenje aplikacije.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F136 — Ocena i opcioni komentar
**Izvorni kriterijum:** 1–5, bez unapred izabranih zvezdica; stvaran ljudski komentar, bez AI izmišljanja utiska.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F137 — Jedinstven smer i retry
**Izvorni kriterijum:** Pravo autora na ovaj Dogovor i dozvoljeni smer; ponovljen submit ne pravi drugu ocenu.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F138 — Primljene i poslate recenzije
**Izvorni kriterijum:** Profil → Ocene: odvojeni pogledi; svaki vlasnički detalj zna odgovarajuću saradnju.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F139 — Javni sažetak i feed
**Izvorni kriterijum:** Prosek/broj i stvarne individualne recenzije ispod; bez komentara ostaje star-only unos.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F140 — Autor i starost recenzije
**Izvorni kriterijum:** Dozvoljeni javni avatar/ime i relativni dan/nedelja/mesec/godina iz timestamp-a; bez minuta/sati i privatne adrese.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F141 — Profil autora i povratak
**Izvorni kriterijum:** Tap samo avatar/ime otvara tačnog autora; Back vrati pregledani profil i prethodni scroll u recenzijama.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F142 — Broj završenih poslova i potvrđen identitet
**Izvorni kriterijum:** Broj distinct COMPLETED po ulozi odvojen od proseka/broja ocena; helper headcount ne proizvodi više reputacionih kredita.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F143 — Prijava recenzije, moderacija i nedostupno
**Izvorni kriterijum:** Stvarna promena podobnosti utiče na feed i aggregate; prijava sama nije automatsko brisanje. Novi korisnik ≠ nepovezan servis.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F144 — Rok, izmena, objava obe ocene i objedinjavanje
**Izvorni kriterijum:** Ne izmišljati rok niti blind-review model; ne menjati već potvrđen javni izgled. Zajednički account score vs prikazi uloga razrešiti eksplicitno.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F145 — Matching iz stvarnih sposobnosti
**Izvorni kriterijum:** Zahtevi, oblast, kapacitet i raspoloživost iz jedne semantike; nema izmišljene preporuke ili raw procenta.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F146 — Distribucija običnog posla
**Izvorni kriterijum:** Ko je podoban, kome event pripada i zašto je još akcioni podatak odvojiti od broja push pokušaja.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F147 — Inbox i status pročitano
**Izvorni kriterijum:** Jedan događaj ne postaje tri stavke zbog tri kanala; mark-read i mark-all imaju cutoff i owner opseg.

**V2:** prototype resolved. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F148 — Duboki link iz događaja
**Izvorni kriterijum:** Posle auth-a ponovo ovlastiti cilj; obrisan/stale/tuđ target daje jasan ishod, ne pogrešan ekran.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F149 — Preference po vrsti i kontekstu
**Izvorni kriterijum:** Kanali i događaji odvojeni od OS dozvole; drugi uređaj ne prepiše noviju reviziju tihim save-om.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F150 — Tihi sati i HITNO izuzetak
**Izvorni kriterijum:** Tihi sati važe; odvojen izričit urgent override je default OFF. Nije uključen samim Dostupan sam.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F151 — Push uređaj, isporuka i nevažeći token
**Izvorni kriterijum:** Registracija/opoziv po nalogu, ticket/receipt obrada, dead token, retry; nema garantovanog handset prijema iz server receipt-a.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F152 — Odložena isporuka i ponovno proveravanje
**Izvorni kriterijum:** Pre slanja posle tihih sati proveriti verziju, popunjenost i podobnost; stari posao se ne šalje kao sveža prilika.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F153 — Postavljanje anonimnog pitanja
**Izvorni kriterijum:** Sistem zadrži autora za abuse, Naručilac i javnost ga ne vide; nepovezan gate nije lažna uspešna objava.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F154 — Odgovor, izmena, odbijanje i prijava pitanja
**Izvorni kriterijum:** Javno tek odgovoreno; Izmenjeno marker i history; materijalna promena ne zaobilazi Need revision pravila.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F155 — Prijavi korisnika, sadržaj ili saradnju
**Izvorni kriterijum:** Pravi case ID/status i dokaz, ne prazna potvrda; bez obećanog vremena odgovora bez operativne službe.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F156 — Blokiranje i aktivni Dogovor
**Izvorni kriterijum:** D0066 ne finalizuje block pre terminalnog Dogovora, ali report ostaje dostupan; ne brisati dokaze i ne izmišljati suprotno pravilo.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F157 — Sankcije i žalba
**Izvorni kriterijum:** Jedan običan otkaz ne znači automatsku kaznu; ozbiljna mera nije samostalna konačna AI odluka; tekst i operaterski tok stvarni.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F158 — Potvrđen nedolazak i zamena
**Izvorni kriterijum:** Prijava no-show nije utvrđenje. Historijski replacement za istu oslobođenu alokaciju nosi otvorenu clean primenu i posebno pitanje fleksibilnog kraja.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F159 — Praćenje sopstvenog slučaja
**Izvorni kriterijum:** Korisnik vidi dozvoljen status i odgovor, a ne interne moderacione podatke drugih ljudi.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F160 — Pregled podobnosti i aktivacije
**Izvorni kriterijum:** Pravila, važenje i cena ako postoji moraju biti prikazani pre aktivnosti; nema samostalne AI odluke.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F161 — Poziv podobnom Uskočeru
**Izvorni kriterijum:** Relevantan task/time/oblast, preference i tiha pravila; nema prisile ni skrivenog urgent opt-in-a.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F162 — Mogu odmah i više odgovora
**Izvorni kriterijum:** Odgovor nije automatski dobijanje posla; isti revision/slots izbor, sprečeno prepunjavanje.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F163 — Istek, niko se nije javio i popunjeno
**Izvorni kriterijum:** Server status i razumljiva sledeća radnja; bez garancije da će pomoć stići.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F164 — Povratak u normalnu distribuciju
**Izvorni kriterijum:** Samo po odobrenom pravilu; ne kreira se neprimetno drugi Zadatak ili drugo terećenje.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F165 — Podešavanja i privatnost
**Izvorni kriterijum:** Javne i privatne stvari razumljive; svi ulazi imaju konkretan cilj, ne beskonačni placeholder ekran.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F166 — Pravne verzije i saglasnosti
**Izvorni kriterijum:** Odobren sadržaj/verzija i izdvojena saglasnost; samo otvaranje nije prihvatanje.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F167 — Zahtev, status i otkaz izvoza
**Izvorni kriterijum:** Pravi receipt/status; pozivanje REQUESTED ne prikazuje READY.

**V2:** prototype resolved. Scoped local request/cancel/re-request and account isolation checked. Original acceptance requires real receipt/status: still NOT proven.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F168 — Stvarna izvozna arhiva
**Izvorni kriterijum:** Generisan fajl, ograničen pristup, expiry/retry; drugi nalog nema pristup ni starom kešu.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F169 — Priprema zatvaranja naloga
**Izvorni kriterijum:** Aktivni Dogovori, dugovane radnje i posledice iz servera; bez proizvoljnog brisanja još živih obaveza.

**V2:** gated shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F170 — Izvršenje zatvaranja i opoziv
**Izvorni kriterijum:** Sesije, push i novi upisi zatvoreni, privatni cache očišćen; evidence hold po politici, ne sve zauvek ostaje niti sve odmah nestaje.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F171 — Storage cleanup i retention
**Izvorni kriterijum:** Odobreni rokovi/svrhe, audit brisanja i idempotentna obrada; ne uklanjati aktivne dokaze.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F172 — Moderacija, support i identity operacije
**Izvorni kriterijum:** Pravi red slučajeva, dozvole, radnje, trag i korisnički povratak; ne izmišljati operatera iza frontend poruke.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F173 — Worker jobs i oporavak poslova
**Izvorni kriterijum:** Auto-completion, dispatch, export i cleanup imaju ponovljivo izvršenje, monitoring i jasan failure recovery.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F174 — RLS/RPC i privatnost trećeg naloga
**Izvorni kriterijum:** Test kroz realni Auth/API, ne samo SQL admina; privatna lokacija, media, review author i export tačno po opsegu.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F175 — Pristupačnost i tekst
**Izvorni kriterijum:** Čitač ekrana, fokus, veliki font, kontrast, dugi nazivi, tastatura i smanjeno kretanje na stvarnim platformama.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F176 — Performanse i 600 stavki
**Izvorni kriterijum:** Profilisati listu/paginaciju/render, brz scroll i povratak, ne samo broj uspešnih testova.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F177 — Izolovan build i podudarnost okruženja
**Izvorni kriterijum:** Tačan commit, source/live/pending diferencija i ponovljiv test; ne maskirati nedostajući publish ručnim SQL fixture-om.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F178 — Promocija i bezbedan rollback
**Izvorni kriterijum:** Odobren test/preflight/postflight, stare migration bytes ne menjati, kompatibilni clients i odvojeni kill-switch po capability-ju.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F179 — Soft/obavezni update i restart
**Izvorni kriterijum:** Običan update nije prisilan; kritični min-version vodi u zvaničnu prodavnicu bez zahteva za destruktivnim resetom.

**V2:** target shown. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F180 — Store kandidati i izveštaj završetka
**Izvorni kriterijum:** Pravi Android/iOS dokaz i policy sadržaj; jasno šta radi, gde je dokazano i šta još nije aktivno.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F181 — NeedPlan kao organizaciona celina
**Izvorni kriterijum:** Više nezavisnih zadataka može imati umbrella projekciju; bez novog writable lifecycle-ja i bez obaveze posebnog V1 plan editora.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F182 — Ponavljajući zadaci i dupliranje
**Izvorni kriterijum:** Kalendar dostupnosti nije scheduler koji sam objavljuje nove poslove. Kopija traži novi pregled, nema nasleđenog izbora/naplate.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F183 — Paketi i pretplate
**Izvorni kriterijum:** Samo posle cenovnika/provider/store odluka; trenutna headcount/promo pravila ne izmišljaju novu pretplatu.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F184 — Organizacije i nalozi pomoćnika
**Izvorni kriterijum:** Team V0 ostaje nosilac + broj ljudi; posebni permissions/članstva nisu tihi dodatak profilu.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F185 — Balkan i više tržišta
**Izvorni kriterijum:** Mesto zadatka može biti odvojeno od autora; države, valute i legal politike nisu automatski aktivne time što mapa može da se pomeri.

**V2:** open decision. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.

## F186 — Novčanik, escrow, live praćenje i auto-selection
**Izvorni kriterijum:** Ne uvoditi iz ikone novčanika, GPS dozvole ili AI preporuke; to su posebni proizvodi/odluke, ne polish.

**V2:** non-UI. See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.

**Native / produkcija:** nije povezano ovom isporukom / nije menjano.
