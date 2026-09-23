# Google Play — šta je stvarno potrebno (23. 9. 2026)

Vlasnik je 23. 9. rekao da večeras šalje aplikaciju na Google Play. Ovo je tačno stanje i tačan spisak, bez ulepšavanja.

## Šta imamo
- Kod: grana `work/pre-v3-engine-integration-20260911`, tipovi čisti, 244 grupe / 4.764 testa, četiri CI dokaza zelena.
- Build: CI pravi **development APK** (`rs.uskoci.dev`, `assembleRelease`), i preview identitet `rs.uskoci.preview` u `app.json`. Prodavnica traži **AAB potpisan upload ključem** — toga još nema.
- `eas.json`: profil `preview` (interni APK) i od danas profil `production` (app-bundle, kredencijali kod vlasnika na EAS-u).

## Šta blokira JAVNU objavu (ne interni test)
| # | Blokada | Ko rešava |
| --- | --- | --- |
| 1 | Aplikacija radi nad **DEV/ALPHA** bazom (`leqcwgzvjsxugfgzdmth`); produkcioni projekat ne postoji (plan R8) | vlasnik odlučuje; inženjering priprema |
| 2 | Vlasnikovi nalozi su privremeno u TEST svetu (pkg029e) — pre pravih korisnika mora da se skine | inženjering, uz vlasnikovo „primeni“ |
| 3 | Pravni dokumenti (uslovi, privatnost) **nisu objavljeni**; prijava to i kaže | vlasnik / pravnik (R7) |
| 4 | Push obaveštenja isključena; bez njih app „ćuti“ | vlasnik uključuje prekidač |
| 5 | Nema praćenja padova u produkciji | novi paket → vlasnikovo odobrenje |
| 6 | Play Console: nalog, aplikacija, listing, screenshotovi, **URL politike privatnosti**, Data safety, content rating, ciljane zemlje | vlasnik |
| 7 | Upload ključ i potpisivanje: EAS kredencijali (`credentialsSource: remote`) ili keystore — **ne pravim ključeve ja** | vlasnik (EAS nalog) |
| 8 | Konačan `android.package` (`rs.uskoci`?), `version`/`versionCode` | vlasnik odlučuje |

## Šta je izvodljivo večeras
- **Interni test (internal testing track)** u Play Console: vlasnik napravi aplikaciju i doda testere; `eas build --profile production --platform android` sa njegovim nalogom pravi AAB; upload u internal track. Ne traži objavljene pravne dokumente ni javnu recenziju.
- Nije izvodljivo večeras: javna ili zatvorena objava koja prolazi Google recenziju (tačke 1, 3, 6).

## Redosled kad vlasnik odluči
1. Odluke: paket, verzija, interni test da/ne, zemlje.
2. `eas build --profile production --platform android` (vlasnikov EAS nalog).
3. Play Console: interni track, testeri, listing, privatnost URL (može i placeholder stranica koju vlasnik drži).
4. Dve prave osobe prođu put A i put B na dva telefona sa tim buildom (plan R9).
5. Tek posle: produkciona baza, pravni dokumenti, push, praćenje padova → zatvoreni test → javna objava.

## Pre `eas build --profile production` — obavezno (dopuna, 23. 9. uveče)
- **Adresa servera i javni ključ.** Aplikacija namerno puca pri pokretanju ako nema `EXPO_PUBLIC_SUPABASE_URL` i
  `EXPO_PUBLIC_SUPABASE_ANON_KEY` (nikad ne pada tiho na izmišljene podatke). CI build ih ima u svom workflow-u;
  profil `production` u `eas.json` ih **nema**. Vlasnik ih upisuje u EAS okruženje `production` (iste vrednosti kao
  CI build, jer interni test radi nad DEV bazom), ili mi kaže da ih upišem u `eas.json`. Upisivanje sam zaustavio
  jer je to odluka o produkcionom buildu.
- **Paket i Firebase.** `app.config.js` vezuje `google-services.json` samo za `rs.uskoci.preview`. Ako paket za
  prodavnicu bude drugi (npr. `rs.uskoci`), build prolazi, ali push za taj paket nema Firebase klijenta.
- **Ocena saradnje (RATING-DEAD-STARS-01) je zatvorena** na emulatoru, build `4e864a08`: zvezda, oznaka i dugme
  „Sačuvaj ocenu" rade na prvi dodir. Na telefonu prstom još nije probano.
- **EAS provera pre builda (ispravljeno večeras).** Skripta koja se pokreće na početku EAS builda puštala je samo
  `preview`, pa bi `eas build --profile production` pao odmah. Sada propušta tačno dva pregledana profila: `preview`
  (interni APK) i `production` (AAB za prodavnicu). Sve ostale provere ostaju iste za oba: projekat, paket
  `rs.uskoci.preview`, najmanji versionCode, kanonska adresa servera, oblik javnog ključa, zabrana lažnih podataka
  i Firebase klijent. Bez dve `EXPO_PUBLIC_…` promenljive u EAS okruženju `production` build se namerno zaustavlja.
- **Ime paketa je trajno u Play Console-u.** Provera trenutno traži `rs.uskoci.preview`. Ako aplikacija u
  prodavnici treba da bude `rs.uskoci`, to je odluka pre prvog uploada. Onda se menjaju `app.json`, ova provera
  i Firebase klijent.

## Odluke vlasnika, 23. 9. kasno uveče (urađeno)
- **Paket za prodavnicu: `rs.uskoci`.** Samo build za prodavnicu (EAS profil `production`) dobija to ime; interni APK
  i CI buildovi ostaju kako jesu. Push za `rs.uskoci` kasnije traži novu Android aplikaciju u Firebase konzoli.
- **Adresa servera i javni ključ** su upisani u `eas.json` za profil `production` (iste javne vrednosti kao CI build).
  Provera pre builda prolazi za profil `production`.
- **Preostaje vlasniku:** Play Console nalog i aplikacija, interni test sa testerima, i jedna komanda sa njegovog
  računara: `npx eas-cli build --profile production --platform android` (pravi AAB fajl za upload).
- **Javna objava kasnije:** novi lični Play nalozi moraju pre produkcije da imaju zatvoreni test sa najmanje 12
  testera tokom 14 dana (Google pravilo za lične naloge); organizacioni nalozi su izuzeti.
