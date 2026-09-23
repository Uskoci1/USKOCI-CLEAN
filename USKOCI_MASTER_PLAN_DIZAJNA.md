# USKOČI — glavni plan dizajna (UI/UX nastavak)

Radna grana: `work/uskoci-ui-unification-20260924` (od `724f4ed1`; glavna grana `clean-alpha-backend` se ne dira).
Ovaj fajl je glavni plan za UI/UX nastavak. Detalji i slike: Claude Doc „USKOČI · Master dizajn“, kartica
„Plan ekrana (23. sep)“ (https://claude.ai/code/artifact/4e3c1c50-fa0b-48a7-b998-454e0b8b6923) i skice
(https://claude.ai/artifact/B2YMSAQVPz7iuq6TXHgZLf). Istraživanja: `docs/implementation/research/`.

Cilj: jedna ujednačena, moderna, premium, čista BELA aplikacija; tamnozelena osnova (`#076E4E` za glavnu radnju,
naslove i izbor), narandžasta samo kao kontrolisani akcenat (objava zadatka, „Čeka te“, „+“). Zadatak, Prijava i
Dogovor pripadaju istoj aplikaciji, ali svako ima jasnu namenu. Poslovna logika, statusi, navigacija, privatnost,
ID veze, baza i tokovi ostaju, osim kad je greška dokazana. Ništa se ne izmišlja: ocene, GPS, uspešan upis, status.

## 1. Audit (24. sep, merenje na `724f4ed1`)

**Dobro i ostaje**
- Jedan sistem boja i slova u `src/ui/system/tokens.ts` (`sys`), koji koristi 68 fajlova. Inter font, V28 paleta, provereni kontrasti.
- FactArt (24 dvobojne ikonice za činjenice) i Pictogram (46 slika za biranje), provereni na telefonu od 20 do 64 px.
- Server, zaštite i oporavak: svaki ekran čita i piše kroz postojeće klijente sa rokovima, revizijama i proverom naloga.
- Donja traka samo na glavnim ekranima (G.0). Novi detalj zadatka, kartica, alatke liste i pregled Dogovora (G.2, G.3, G.5, G.7) su mirniji i bez kutija.

**Konfliktno (isto rešeno na više načina)**
| Oblast | Stanje | Posledica |
| --- | --- | --- |
| Tokeni | `sys` u 68 fajlova, ali stari `theme/tokens` još u 14 (prijava, Press, Button, Text, Segmented, mapa), `aiFirst` i `v2` tokeni u 4 | dve lestvice boja i razmaka; AI ekran i fotografije boje iz trećeg izvora |
| Ručne boje | 23 ručna hex zapisa van tokena (Početna, ilustracija, Detail, Text, TaskCard, ulaz) | boje koje ne prate temu |
| Zaglavlja | 6 načina: `ScreenHeader` (3), `DetailTopBar` (19), `ProductHeader` (8), `AgreementPersonBar`, `SettingsScreen` zaglavlje (16), ručna zaglavlja (raspored, prijava) | različita visina, strelica i naslov od ekrana do ekrana |
| Prozori | 9 ručnih `Modal` (profil osobe, izbor prijave, kalendar, lokacija, zatvaranje naloga, pravna dokumenta, AI, pregled završetka) + 1 donji panel (`ProductSheet`) + 9 sistemskih `Alert.alert` potvrda | tri različita izgleda za istu stvar: „potvrdi“, „izaberi“, „pogledaj“ |
| Dugmad | `V2Action` (36 fajlova) i stari `Button` (3 fajla: lokacija rada, privatna lokacija, pretraga područja) | dva izgleda dugmeta |
| Otvaranje u mestu | 16 ručnih „otvori/zatvori“ blokova | različite strelice i razmaci |
| Smanjen pokret | 21 mesto, tri izvora (`motion.ts`, `useSystemReducedMotion`, Reanimated) | neki ekrani ignorišu podešavanje telefona |
| Kartice | TaskCard, kartica prijave, kartica Dogovora crtane odvojeno | nije jedan sistem |

**Zamenjuje se zajedničkom komponentom**
1. `ScreenChrome`: jedno zaglavlje za tri vrste ekrana — glavni (profil · znak · zvonce), detalj (strelica · naslov koji se pojavi pri pomeranju · „···“), tok (zatvori · korak). Zamenjuje `ScreenHeader`, `DetailTopBar`, `ProductHeader`, zaglavlje `SettingsScreen` i ručna zaglavlja.
2. `Sheet`: jedan donji panel (gorhom, odobren) sa varijantama `ActionSheet` („···“ radnje), `ConfirmSheet` (umesto `Alert.alert`), `PickerSheet` (izbor), `PeekSheet` (kartica tačke na mapi, bez zatamnjenja). Zamenjuje 9 `Modal` i 9 `Alert.alert`.
3. `Action`: jedno dugme (`V2Action` ostaje ime) sa jasnim stanjima: obično, isključeno uz razlog, u toku, greška, uspeh; dodir najmanje 48; stari `Button` se gasi.
4. `Disclosure`: jedno otvaranje u mestu sa istom strelicom i pokretom.
5. `CardFace`: jedna anatomija kartice (stanje → naslov → činjenice → uslovi → vrednost → dno) za Zadatak, Prijavu i Dogovor; svaka ima svoju boju namene (zadatak: cena zeleno; prijava: tvoja ponuda; Dogovor: osoba i termin).
6. `StateView`: prazno, učitavanje, greška i „bez veze“ na jedan način (ikonica, jedna rečenica, jedna radnja).
7. Tokeni: `theme/tokens`, `aiFirst` i `v2` tokeni se svode na `sys`; ručne hex boje idu u tokene.
8. Pokret: jedan izvor za „smanji pokret“, kratke tranzicije vezane samo za stvarnu promenu stanja.

## 2. Redosled (tvoj, 24. sep)

1. **Audit** — ovaj odeljak.
2. **Design system i zajedničke komponente** (tačke 1–8 iznad), uz tablu na emulatoru.
3. **Glavna navigacija, zaglavlja, donja traka:** Početna | Zadaci | Dogovori; Početna kao pregled (dva velika dugmeta, „Čeka te“, sledeći Dogovor, Moji zadaci, Moje prijave); „Moje aktivnosti“ se gasi; `/mapa` i `/prilike` vode na Zadatke.
4. **Mapa, tačka, filteri, Dodaj zadatak:** Zadaci kao jedan ekran (mapa preko celog ekrana, lista koja se izvlači odozdo), kartica tačke bez zatamnjenja, filteri u odeljcima (Kada · Gde se radi · Cena · Slobodna mesta), „+“ u zaglavlju liste; nazivi na mapi na srpskoj latinici; zadaci na istoj tački dostupni.
5. **Zadaci i Moje prijave:** kartica kao sistem, detalj zadatka (naslov u zaglavlju pri pomeranju, retke radnje iza „···“, razlog kad prijava nije moguća), moje prijave.
6. **AI Novi zadatak:** živa kartica nacrta, plutajuće polje za pisanje (+ · tekst · mikrofon · glas) po uzoru na Gemini, glasovni razgovor (govor aplikacije traži odobren paket).
7. **Pristigle prijave i izbor kandidata.**
8. **Dogovori, Pregled, Poruke.**
9. **Profil, radni profil, vozila, alat, tim** (biranje sa slikama u dve kolone).
10. **Kalendar, dostupnost, izuzeci.**
11. **Obaveštenja, podešavanja, privatnost, podrška.**
12. **Kompletna regresija i završni vizuelni polish.**

Svaka celina: tipovi i testovi → build → **emulator** (320 / 360 / 390 / 430 px, uvećan tekst, dugi nazivi) →
slika → odvojena kritika toka i izgleda → ispravka → nova slika → commit po celini. Ništa nije završeno samo zato
što test prolazi.

## 3. Šta ostaje vlasniku

Plaćanje (ko plaća, cena, dobavljač, Google Play naplata, fiskalni račun), pretraga adresa za javno puštanje
(plaćeni LocationIQ ili državni Adresni registar), paketi koji traže odobrenje (govor aplikacije, provera mreže),
serverski paketi (obaveštenja sa imenom, poslednja poruka na Dogovorima) i iste reči za vozila i alat kod pomoćnika.
Sve ostalo je odluka tima.
