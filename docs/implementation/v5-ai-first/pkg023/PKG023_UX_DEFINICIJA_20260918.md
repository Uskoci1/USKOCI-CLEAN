# USKOČI — definicija UI/UX i funkcije, pre menjanja ekrana

2026-09-18. Vlasnikov zahtev: *„nije samo do izgleda nego UI/UX i funkcija, funkcionalnost — svašta
treba da definišemo."* Ovo je taj sloj. Ne popravlja nijedan ekran; postavlja mere po kojima se
svaki ekran meri, pa tek onda menjamo.

Sve što je ovde tvrdnja o stanju provereno je danas na uređaju (20 ekrana, VKP-NX9) ili u živoj bazi
i logovima kanonskog DEV projekta. Nagađanja nema; gde ne znam, piše da ne znam.

---

## 1. Šta je ovaj proizvod, u jednoj rečenici

Čovek kaže šta mu treba svojim rečima, AI to pretvori u Zadatak, vlasnik potvrdi, Zadatak ide
ljudima koji mogu da ga urade, jedan se izabere, i nastane Dogovor.

Sve ostalo u aplikaciji postoji da bi taj lanac radio. Ekran koji ne služi tom lancu ili ga usporava
je kandidat za brisanje, ne za lepši raspored.

## 2. Jedan nalog, dva režima — i pravilo koje nedostaje

Nalog je jedan. Režima su dva: **MENI TREBA** (naručilac) i **JA MOGU** (uskočer).

Danas se to lomi na tri mesta, sva tri viđena na uređaju:

| Gde | Šta se desi |
| --- | --- |
| „Novi zadatak" u režimu JA MOGU | Dugme „Nastavi razgovorom" je sivo, piše „dostupan u režimu MENI TREBA", **a nema dugmeta da pređeš** |
| Lista `/potrebe` u režimu JA MOGU | Zaglavlje piše „Ja mogu · Zadaci", donja navigacija je radnička, a sadržaj je naručiočev |
| Nacrt zadatka u režimu JA MOGU | Provera „zašto ne može da se objavi" se **uopšte ne poziva**, pa ekran vrati staro obećanje „Sledeće: pregled i objava jednim korakom" |

**Pravilo koje uvodimo:** svaki ekran pripada tačno jednom režimu ili oba. Ako otvoriš ekran koji
pripada drugom režimu, ekran ti **na licu mesta nudi prelaz** („Ovo radiš kao naručilac — pređi u
MENI TREBA") i posle prelaza nastavlja tamo gde si krenuo. Nikad sivo dugme bez izlaza.

## 3. Anatomija ekrana

Jedan ekran u aplikaciji već je tačno ovakav — **Podrška**. Uzimamo ga kao meru:

```
nadnaslov (mala kapitalna reč: čemu ovaj ekran pripada)
NASLOV (šta je ovo)
jedna rečenica (šta se ovde dešava)
[opciono: tiha napomena — privatnost, ograničenje]
sadržaj — ili prazno stanje sa ikonom i jednom rečenicom
──────────
jedna narandžasta radnja
```

Pravila koja iz toga slede:

1. **Jedna narandžasta radnja po ekranu.** Sve ostalo je zeleni tekst ili tiho dugme.
2. **Najviše dva reda kontrola pre sadržaja.** Danas `/potrebe` ima tri (segment, brojač+pretraga+filter), pa prva kartica počinje na 40% ekrana.
3. **Naslov nikad ne ponavlja navigaciju.** Ako je tab „Zadaci", naslov nije opet „Zadaci".
4. **Sekundarni put ne stoji iznad glavnog.** Na Radnom profilu „Uredi profil kroz razgovor" sedi iznad imena i iznad svega — ide dole, uz ostale radnje.
5. **Puni ekran nema donju navigaciju.** Razgovor, Pregled i Nacrt danas je imaju; tap na tab usred razgovora je zamka.

## 4. Stanja — svaki ekran mora da ima svih pet

| Stanje | Pravilo | Danas |
| --- | --- | --- |
| Učitavanje | Ne prazno platno; naslov stoji, sadržaj se puni | uglavnom OK |
| Prazno | Kaže **šta će tu biti** i nudi **jednu radnju koja to puni** | OK na Podršci i Zadacima, nema ga na više lista |
| Greška | Kaže šta se desilo i šta ti možeš; nikad šifra | uglavnom OK |
| Neizvesno (server nije potvrdio) | Kaže da ishod nije potvrđen i nudi **ponovi isti zahtev**, nikad novi | OK, ovo je jača strana koda |
| Onemogućeno | **Uz sivo dugme mora da stoji razlog**, i po mogućstvu radnja koja razlog uklanja | **ne postoji** — „Objavi zadatak" je sivo bez ijedne reči zašto |

Poslednji red je najskuplji propust u aplikaciji. Sivo dugme bez razloga je ćorsokak.

## 5. Jezik

- **Obraćanje na „ti"** — urađeno danas, 977 linija, 104 fajla.
- **Nikad mašinska reč korisniku.** Danas se vide: `transport_selidbe`, „bez AI provajdera", „isti V2 nacrt", `Europe/Belgrade`.
- **Množina mora da valja.** Danas: „1 zadataka" na mapi.
- **Ne obećavaj ono što server nije potvrdio.** AI danas kaže „Sve ključne stavke su spremne, možete preći na Pregledaj zadatak" — a objava traži tačku na mapi koju AI i ne pominje.
- **Ne pretpostavljaj rod.** Rečenice tipa „Ako ste dobili poruku" prepisane su danas tako da nemaju rod.

## 6. Tokovi — i gde se svaki prekida

### 6.1 Ulaz → nalog
Radi. Ulazna kompozicija je zaključana (V4.9), prijava je posebna tamna površina.
Neodlučeno: da li tri nedostupna načina prijave (Google/Apple/Telefon) uopšte da se prikazuju.

### 6.2 Naručilac: ideja → razgovor → mesto → pregled → objava
Ovde je proizvod najtanji, i ovde su brojke najgore:

- **38 od 62 razgovora nema nijednu poruku.** Ekran se otvori i ništa se ne kaže. Danas je zbog toga sklonjena prazna kartica sa vrha i dodata tri početka.
- **Razgovor se otvara u bazi čim otvoriš ekran**, pre prve reči — otud 38 praznih redova. Predlog: red nastaje na prvu poruku. Veća izmena; dira govor, fotografije i idempotenciju.
- **Tačka na mapi je jedini razlog zašto objava nikad nije prošla.** Nijedan zadatak nikad nije imao potvrđenu tačku. Razgovor sad pita za nju i mapa dolazi u ćaskanje sa već pribodenom adresom.
- **Pregled seče vrednosti** („Dostava i kurirske" bez *usluge*) i ima **četiri ista zelena „Izmeni"** koja preotimaju pažnju od vrednosti.

### 6.3 Radnik: profil → dostupnost → područje → ponuda
- Radni profil je **NACRT**, i to je jedini razlog što mu se zadaci ne nude. Ekran radnog profila to sad kaže jasno; **hub Profil ne kaže ništa** — a to je ekran na koji prvo dođeš.
- Na Dostupnosti je „Dostupan sada" **uključeno** iako profil nije aktivan. Dva ekrana tvrde suprotno.
- 55% ekrana Dostupnosti ode pre prvog dana u nedelji.

### 6.4 Izbor → Dogovor → poruke → izmene → završetak → ocena
**Nikad nije prošlo sa dva prava čoveka.** Kod postoji i testovi prolaze, ali svaka procena ovog dela
je procena koda, ne iskustva. Dok se ne objavi jedan pravi zadatak, sve ovde je nedokazano.

### 6.5 Kad pukne
Danas dokazano: AI je pao dva puta (14:42 i 14:43, `AI_PROVIDER_FAILED`), a ekran je dva i po sata
pisao „AI još obrađuje poruku". Server namerno ne sme da proglasi neuspeh posle slanja provajderu —
ne zna šta je provajder uradio sa rezervisanom potrošnjom. Ali ekran sme da prestane da obećava.

**Pravilo:** kad ishod nije poznat, ekran kaže da nije poznat i nudi izlaz. Nikad „radim na tome"
kad niko ne radi ni na čemu.

## 7. Odluke vlasnika — donete 2026-09-18

| # | Pitanje | Odluka | Stanje |
| --- | --- | --- | --- |
| 1 | Da li „+“ vodi pravo u razgovor, bez ekrana izbora? | **Da**, i ručni unos se briše iz klijenta u celosti | urađeno |
| 2 | Šta se dešava kad otvoriš ekran druge namere? | **Ekran nudi prelaz na licu mesta** i ostaješ gde si | urađeno (`CrossIntentNotice`) |
| 3 | Kad razgovor nastaje u bazi? | **Na prvu poruku**, ne na otvaranje ekrana | urađeno |
| 4 | Da li se nedostupni načini prijave prikazuju? | **Ne.** Ostaje email i lozinka, uz jednu rečenicu | urađeno |
| 5 | Donja navigacija na punim ekranima? | **Ne.** Razgovor, Pregled, Mesto i Fotografije su puni ekrani | urađeno |
| 6 | Avatar: zaobljen kvadrat svuda? | već ujednačeno u PKG-022; posebna potvrda nije tražena | čeka |
| 7 | Prijava — svoja tamna površina ili u sistem? | ostaje svoja; njenih 27 veličina slova i 12 ćoškova još nisu u lestvici | čeka (Faza D) |


## 7a. Ruta `/pregled-nacrta` — ispravka od 2026-09-18

Drugi ekran za pregled (`R07`) je 18.09. obrisan iz izvora uz obrazloženje da ga je V5 zamenio.
**To nije bila moja odluka da donesem.** PKG-012 entry map ga vodi kao kandidata za penzionisanje
tek *„after parity with `/pregled-zadatka` and owner approval"*, broji nula stavki kao
retirement-eligible i izričito kaže da ništa u njemu ne odobrava brisanje. PKG-023 je NOT_STARTED.

GitHub PRE-P4 invariant `legacy routes resolve explicitly until PKG-023 retires them with parity and
approval` je zbog toga pao na `72d248a`.

Stanje posle ispravke:

- Ruta postoji ponovo i razrešava se izričito — kao `Redirect` na `/pregled-zadatka`, sa svojim
  `conversationId`. Stari dupli ekran se **ne** vraća kao proizvod.
- **Parity i dalje nije postignut.** `aiNeedV2Izvor.saveDraft` nema nijednog klijentskog pozivaoca,
  pa nijedan put ne čuva nacrt bez traženja objave. R07 je to umeo.
- Penzionisanje ostaje posao PKG-023: parity, pa vlasnikovo odobrenje, pa uklanjanje rute i njenog
  invarianta u istom koraku.

## 8. Redosled rada koji predlažem

1. **Ćorsokaci** — sivo dugme dobija razlog; „Novi zadatak" dobija prelaz režima; režim se ne lomi između ekrana.
2. **Istina na ekranu** — pregled prestaje da seče vrednosti; nacrt prestaje da obećava objavu koju ne može; mašinske reči napolje.
3. **Razgovor** — jedan ulaz umesto ekrana izbora; red u bazi tek na prvu poruku.
4. **Radnik** — hub kaže da je profil nacrt; „Dostupan sada" ne laže.
5. **Ostalo po nalazima revizije** — svih 10 porodica ekrana, po težini.

Tek posle 1–4 ima smisla dirati raspored ekrana koji nisu pokvareni, jer se do tada ne zna šta je
loš raspored a šta pokvarena funkcija.
