# USKOČI — kako se ekran slaže

**Vlasnikov pravac, 2026-09-20:** crna slova, zelena i narandžasta; lepe i jasne ikonice; veliki
jasni delovi; čist ekran sa što manje stvari na njemu; jasni tokovi.

Ovaj dokument pretvara to u pravila koja se **mogu prebrojati**, pa da se ne raspravlja o ukusu
nego o broju. Važi zajedno sa odeljkom **2A** iz
`docs/implementation/v5-ai-first/pkg023/PKG023_UX_DEFINICIJA_20260918.md` (jedan nalog, jedna
ljuska, odnos stoji na redu). Gde se njih dvoje sretnu, 2A odlučuje ko je ko, a ovaj dokument kako
to izgleda.

---

## 1. Boje — tri, i ništa više

Izvor je `src/ui/system/tokens.ts`. Ništa se ne upisuje ručno.

| uloga | token | vrednost |
| --- | --- | --- |
| slova | `sys.color.ink` | `#183A30` |
| tiha slova | `sys.color.muted` | `#586B62` |
| zelena — poverenje, orijentacija, ikonica koja nosi značenje | `sys.color.green` | `#176B55` |
| narandžasta — **samo radnja** | `sys.color.orange` | `#FF850F` |
| novac | `sys.color.money` | `#205C45` |
| podloga | `sys.color.surface` | `#FFFFFF` |

**Pravila:**

1. **Narandžasta znači „ovo traži tebe" — kao radnja ili kao oznaka pažnje. Nikad kao ukras.**
   Jedna narandžasta **radnja** po ekranu; ako ih ima pet, ne znači ništa. Radnja u redu liste nikad
   nije narandžasta — red se otvara, ne izvršava. Kao pažnja sme: tačka, ivica kartice koja te čeka,
   brojač pristiglih prijava. Ali **statična kutija sa uputstvom nije ni jedno ni drugo** — nju ne
   bojimo.
2. **Narandžasta nije boja slova.** Na beloj podlozi daje kontrast 2.4, što je kvar oka a ne stil.
   Tekst na narandžastoj je uvek `onOrange`.
3. **Krem palete nema.** Od 2026-09-20 je ostala samo u `src/ui/Text.tsx`, i to namerno: ona nosi
   tonove za tamne površine (ulaz, oporavak), koje nisu beli ekrani.

## 2. Kompozicija — redosled koji se ne menja

```
nadnaslov  →  NASLOV  →  jedna rečenica  →  sadržaj (ili prazno stanje)  →  jedna narandžasta radnja
```

Mere:

- najviše **dva reda kontrola** pre nego što počne sadržaj;
- naslov **ne ponavlja** ime taba ili dugmeta kojim si došao;
- prazno stanje ima ikonicu, jednu rečenicu i jednu radnju;
- sivo dugme uvek ima razlog pored sebe, i taj razlog **nikad nije uloga**;
- pun ekran (razgovor, pregled, nacrt) nema donju navigaciju.

## 3. Blok — veliki i jedan

**Jedna kartica = jedna misao.** Kartica koja se zove „Termin i poruka" nije blok nego fioka: reč
„Termin" se u njoj pojavi dvaput, a nijedna polovina nije cela misao. Dve kartice od po jedne
misli se čitaju brže nego jedna od dve.

Kartica: `card` iz `sys` — bela, ćošak 22, ivica `cardLine`, mek senka, unutra 18–20.
Razmak između kartica 14. Ništa se ne crta žicom (bez golog okvira bez senke).

## 4. Red u listi — samo ono po čemu se bira

Red postoji da bi se **skenirao**, ne da bi se pročitao. U njemu stoji isključivo ono što odlučuje
šta ćeš otvoriti prvo:

| stoji u redu | čeka na ekranu detalja |
| --- | --- |
| lice (fotografija 56) | termin |
| ime — `cardTitle`, 20/700 | navedene sposobnosti |
| ocena, uz zvezdicu | poruka uz prijavu |
| cena — `price`, 23, tabularne cifre, zelena para | dokazi i samoizjava |
| broj ljudi, uz ikonicu | |

**Ceo red je dugme.** Nema dugmeta u redu — to je duplo dodirno mesto na istom mestu i, kad je
narandžasto, zid narandžaste tamo gde se donosi jedna odluka.

**Značka stanja se pojavljuje samo kad odgovor nije običan.** „Poslata prijava" na svakom redu nije
podatak nego šum: to je obično stanje. Značka se vidi za `STALE`, `OVERFILL`, `SELECTED`,
`WITHDRAWN`, `CLOSED`, `FULL` — i tada je **cela traka**, ne čip stisnut u 45% širine.

## 5. Ikonice

Familija je **Phosphor** (`phosphor-react-native`, već u projektu, 40 ikonica u 40 fajlova).
Nova ikonica se ne crta ručno ako familija ima istu.

| | |
| --- | --- |
| veličina u redu/kartici | 16 |
| veličina uz naslov/radnju | 20–22 |
| zvezdica ocene | 13, `weight="fill"`, narandžasta |
| boja | `muted` kad prati tihi tekst, `green` kad nosi značenje |
| strelica „otvara se" | `CaretRight`, 20, `muted` |

**Ikonica nosi značenje ili je nema.** Sat uz termin, ljudi uz broj ljudi, kalendar uz datum —
da. Ikonica pored naslova zato što je prazno — ne.

**Otvoreno pitanje za vlasnika:** `src/ui/v2/icons.tsx` ručno crta četiri ikonice (`back`, `send`,
`chat`, `chevron`) iz originalnih SPOJ V2 fajlova, a Phosphor ima iste (`ArrowLeft`,
`PaperPlaneTilt`, `ChatCircle`, `CaretRight`). Tamo gde je ekran prerađen, `chevron` je prešao na
`CaretRight`. `send` još stoji, jer je dvotonska i stoji u narandžastom dugmetu. Odluka: da li i
ona prelazi.

## 6. Slova

Jedna lestvica, osam uloga, iz `sys.type`. Nema ručno upisane veličine.

| uloga | kad |
| --- | --- |
| `cardTitle` 20/700 | ime čoveka, naslov kartice |
| `priceLarge` 24 / `price` 23 / `priceSmall` 20 | novac, uvek tabularne cifre |
| `bodyStrong` | podatak koji se poredi |
| `body` | rečenica ekrana |
| `meta` | tiho objašnjenje |
| `label` | naziv ćelije u poređenju |

---

## 7. Šta je već primenjeno (2026-09-20)

### `src/ui/v2/ApplicationSelectionPresentation.tsx` — četiri ekrana u jednom fajlu

**Prijave (lista kandidata).** Red je imao devet linija i **svoje narandžasto dugme** — pet ponuda
je značilo pet narandžastih dugmadi na ekranu gde se donosi jedna odluka. Sada: lice 56, ime,
ocena sa zvezdicom, cena veliko, broj ljudi uz ikonicu, strelica. Ceo red je dugme. Značka stanja
samo kad nije obično. Termin, sposobnosti i poruka su prešli na ekran ponude.

**Uporedi.** Ćelija je imala četiri polja, a četvrto je bio slobodan tekst o sposobnostima — kod
svakog različite dužine, pa se kolone nisu poravnavale; a poređenje ima smisla samo ako se
poravnavaju. Ostala su tri: Ukupno, Ljudi, Termin. Cela ćelija je dugme.

**Tvoja prijava (kompozer).** Kartica „Termin i poruka" razdvojena u „Termin" i „Poruka uz
prijavu". Termin ima kalendar-ikonicu i `CaretRight`. Objašnjenje ispod polja za poruku je postalo
placeholder umesto još jedne rečenice na ekranu.

**Ponuda (detalj).** Imala je monogram dok lista pokazuje lice — isti čovek, dva ekrana, za oko
dva čoveka. Sada `ProfilePhoto` 64. Cena je dobila naslov („Ukupno za …") i `priceLarge`, a dve
lebdeće linije su postale dve označene ćelije sa ikonicama: Ljudi, Termin.

### `src/app/_layout.tsx`, `src/ui/Button.tsx`, `ResolvedPinMap`, `BuildIdentity`

Poslednje krem površine prešle na beli sistem. Sistemski splash je beo, naš je bio krem, aplikacija
opet bela — hladno startovanje je treperilo. Četiri ekrana bez sopstvene podloge (grupni razgovor,
izmene dogovora, lokacija dogovora, lista prijava) stajala su na krem podlozi sa belim karticama.

### `src/ui/v2/MyApplicationsPresentation.tsx` — Moje prijave

Sve što se čita da bi se prepoznala prijava — stanje, naslov, mesto, vreme, tvoja cena — jedan je
pritisak koji otvara **Zadatak** kojem prijava pripada. Ranije je to bio sitan zeleni red teksta
ispod kartice, i bio je jedini put nazad do Zadatka na koji si se prijavio. Radnje ispod ostaju
odvojene, da nijedno dodirno mesto ne stoji unutar drugog.

„Pregledaj izmene" je prestalo da bude narandžasto. Kartica koja te čeka već ima narandžastu
ivicu; narandžasto dugme unutar nje, na svakoj kartici taba „Čeka te", troši jedinu boju koja
treba da znači „ovo je korak". Sada je tamno, a jedina narandžasta na ekranu ostaje ona u praznom
stanju.

### Tri ekrana Dogovora dobila isti vrh

`AgreementActionsScreen`, `AgreementLocationScreen` i `GroupConversationScreen` crtali su svoj vrh:
zelena reč „Nazad" pored golog naslova od 26px, dok ceo ostatak aplikacije otvara sa strelicom
nazad, nadnaslovom i naslovom. Sada koriste `DetailTopBar`, nadnaslov je **Dogovor**, pa naslov
više ne mora da ponavlja tu reč („Izmene Dogovora" → **Izmene i otkazivanje**).

To su tri od četiri ekrana koji su istog dana stajali na krem podlozi — porodica Dogovora je bila
zapušteni ugao aplikacije.

### `src/ui/v2/PublicNeedPresentation.tsx` — Javni zadatak

Ekran je i pre bio tačan po pravilima: traka stanja, veliki naslov, četiri činjenice sa ikonicama,
dva reda koja se otvaraju, i **jedna** radnja u podnožju koju bira odnos (`OWNER` / `APPLIED` /
`UNKNOWN` / prijava). Jedno nije valjalo: onaj **ko objavljuje** bio je slovo u krugu, dok su ljudi
koji mu odgovaraju dva ekrana dalje prikazani fotografijom. Sada nosi svoju fotografiju
(`publicPhoto`, isti autorizovani put koji već koristi list javnog profila), ceo blok je pritisak
koji otvara javni profil, a zeleni red teksta ispod njega je nestao.

### `src/ui/v2/NeedPresentation.tsx` — tvoj zadatak

Kutija „Spremi zadatak za objavu" bila je obojena `orangeSoft`, a traka na vrhu već kaže da je
nacrt i podnožje već nosi korak u narandžastoj. Tri narandžaste stvari na jednom ekranu, nijedna od
njih korak. Kutija je sada obična kartica; nosi ono što je samo njeno — put ka izmeni nacrta.

### `src/ui/v2/IntakePresentation.tsx` — opcije razgovora

List „Opcije razgovora" počinjao je sa „Osveži razgovor", a jedino jako dugme u njemu bilo je
**„Novi Zadatak"**. Dakle, najglasnije što se nudi čoveku usred opisivanja zadatka bilo je da ga
napusti i počne drugi. Pregled je taj koji završava ovaj posao — sada je prvi i jak; počinjanje
iznova je obična tiha stavka pri dnu, pored odustajanja.

### `__mocks__/phosphor-react-native.js`

Ikonice su bile ručno izlistane u 37 test fajlova, pa se nijednom ekranu nije mogla dodati ikonica
bez rušenja suite-ova koji ikonice ni ne pominju — i to porukom koja pokazuje na ekran umesto na
mock. Jedan zajednički mock, kao onaj za reanimated pored njega.

## 8. Tri ispravke sopstvenog merenja

Brojalica nad kodom je gruba i tri puta je slagala. Zapisano je da se ne ponovi:

1. **„Izbor prijava, 96 elemenata"** — nije jedan ekran nego **četiri u jednom fajlu** (tvoja
   prijava, lista prijava, poređenje, ponuda). Nijedan pojedinačno nije imao 96.
2. **„`MarketplacePresentation`, tri reda kontrola pre sadržaja"** — netačno. Ima **jedan** stalni
   red (segment); pretraga i oblast se pojavljuju samo kad ih tražiš. Taj ekran je već
   disciplinovan — komentar u kodu izričito drži da prazno stanje nosi svoju radnju baš zato da se
   nikad ne vide dve narandžaste. Isto važi za `TaskCard`: on je već tačno ova anatomija.
3. **„~32 ekrana crtaju svoje zaglavlje"** (iz starijeg plana) — sada ih je **sedam**, a od toga su
   `auth`, `oporavak` i razgovor sa AI namerno drugačiji. Preostala četiri su obrađena ili
   trivijalna.

Zaključak: jezik kartice u aplikaciji **već postoji i tačan je**. Problem nije bio da ga nema, nego
da su pojedini ekrani odlutali od njega — i to baš oni na kojima se donosi odluka.

## 9. Otvoreno — tri rupe u podacima, ne u ekranima

Sve tri su provereno u kodu, ne pretpostavljene. Nijedna se ne može zatvoriti izmenom ekrana.

**1. Lice u Dogovoru.** `AgreementCollectionPresentation` i `AgreementPresentation` prikazuju slovo
u krugu. `UcesnikProjekcija.id` je **`requesterAccountId` / `workerAccountId`** —
`src/data/agreementClientService.ts:39-41`. To je id **naloga**, a `ProfilePhoto` traži id
**profila**. Čitanje sa pogrešnim id-em se ne sme ni pokušati. Potrebno: da čitanje Dogovora vrati
javni profilni id obe strane.

**2. Tvoj zadatak nema tačku.** `PrilikaProjekcija` (kako zadatak vidi stranac) nosi
`priblizno: {lat,lng}`, pa je javni detalj dobio mapu. `PotrebaProjekcija` (kako ga vidiš **ti**)
nema koordinate uopšte: `NeedTaskGeographyPoint` ima samo `label`, `city`, `area`. Posledica je
naopaka — stranac vidi tvoj zadatak na mapi, ti ne vidiš svoj.

**3. Slika na kartici u listi.** `MarketplaceItem` nema nijedno polje za fotografiju, pa kartica u
listi i na mapi ne može da prikaže sliku ni kad zadatak ima fotografije. Potrebno: jedna sličica po
zadatku u ograničenom čitanju liste.

## 10. Redosled za ostatak

Po tome koliko se viđa:

1. **Javna potreba** i **Potreba** — ekran na kom se odlučuje o prijavi
2. **Razgovor sa AI** (`IntakePresentation`)
3. **Dogovor** — radni prostor, prepiska, ocena, zatvaranje
4. **Podrška — detalj** (45 elemenata), **Pregled zadatka** (44), **Dostupnost** (43)
5. **Profil i 13 podekrana**
6. **Prijava/ulaz** — poslednje ostrvo; tamna površina ostaje namerno

Početna i ljuska se ne diraju dok ih drugi agent prerađuje po HTML pravcu od 2026-09-20.
