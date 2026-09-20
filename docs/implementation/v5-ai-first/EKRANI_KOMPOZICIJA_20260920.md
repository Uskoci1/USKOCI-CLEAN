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

1. **Jedna narandžasta radnja po ekranu.** Ako ih ima pet, narandžasta ne znači ništa. Radnja u
   redu liste nikad nije narandžasta — red se otvara, ne izvršava.
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

### `__mocks__/phosphor-react-native.js`

Ikonice su bile ručno izlistane u 37 test fajlova, pa se nijednom ekranu nije mogla dodati ikonica
bez rušenja suite-ova koji ikonice ni ne pominju — i to porukom koja pokazuje na ekran umesto na
mock. Jedan zajednički mock, kao onaj za reanimated pored njega.

## 8. Redosled za ostatak

Po tome koliko se viđa:

1. **Moje prijave** — 50 elemenata, 6 narandžastih mesta u kodu
2. **Zadaci / Prilike / Mapa** (`MarketplacePresentation`) — 5 narandžastih, tri reda kontrola pre sadržaja
3. **Javna potreba** i **Potreba** — 4 i 2
4. **Razgovor sa AI** (`IntakePresentation`) — 4
5. **Dogovor** — radni prostor, prepiska, izmene, ocena
6. **Profil i sistemski ekrani**

Početna i ljuska se ne diraju dok ih drugi agent prerađuje po HTML pravcu od 2026-09-20.
