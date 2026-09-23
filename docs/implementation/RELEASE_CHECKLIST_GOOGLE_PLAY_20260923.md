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
