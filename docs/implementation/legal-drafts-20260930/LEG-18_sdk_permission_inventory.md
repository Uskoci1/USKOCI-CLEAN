# LEG-18 · Popis SDK-ova, dozvola, manifesta, licenci i porekla asseta

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-18 (master plan 16.2): „Android dozvole, iOS usage descriptions i privacy manifest, required-reason API provera, poreklo asseta i atribucije. Audit stvarnih release artefakata; minimalne dozvole i dozvoljena upotreba resursa.” |
| Status | DRAFT-FROM-CODE iz konfiguracije i zavisnosti. **Nije audit release artefakta**: potpisani AAB/IPA ne postoji u ovoj proveri, pa spajanje manifesta iz biblioteka ostaje `[[PROVERITI]]` |
| Izvor koda | `Uskoci1/USKOCI-CLEAN`, grana `work/uskoci-ui-unification-20260924`, commit `fc58f411598338c8589f5f177626a2790c92fb13`, pročitano 2026-09-30, samo za čitanje |
| Vezani nacrti | LEG-09, LEG-11, LEG-12; ulaz za LEG-16 (Apple App Privacy), LEG-17 (Google Data Safety) i LEG-19 |

## 1. Identitet aplikacije (izvor: `app.json`, `app.config.js`, `eas.json`)

| Stavka | Vrednost u kodu | Napomena |
|---|---|---|
| Naziv | „USKOČI”, slug `uskoci`, verzija `1.0.0` | |
| Android `applicationId` | `rs.uskoci.preview` (probni, `versionCode` 35); `rs.uskoci` samo za EAS profil `production` (paket prodavnice) | „package je trajan u Play Console”; odluka vlasnika 2026-09-23; `[[ODLUKA VLASNIKA: potvrditi konačni applicationId]]` |
| iOS `bundleIdentifier` | **nije podešen** (`app.json` ima samo ikonu za iOS) | red kontrole „iOS oznaka aplikacije: NIJE PODEŠENO” |
| EAS profili | `preview` (APK, interno), `production` (AAB, prodavnica, javni Supabase URL i anon ključ u `eas.json`) | anon ključ je javni (publishable); ne umnožavati u dokumentima |
| Šema veza | `uskociapp` | za duboke veze i potvrdu emaila |

## 2. Dozvole (Android i iOS)

### 2.1. Ono što konfiguracija u repozitorijumu izričito određuje

| Dozvola / opis | Gde | Stvarna upotreba u kodu |
|---|---|---|
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | `app.config.js` (`android.permissions`) | jedno očitavanje u prednjem planu posle dodira („U blizini”; predlog tačke zadatka); `nearbyCapture.ts`, `nativeCurrentLocation.ts` |
| Pozadinska lokacija, foreground servis, senzor kretanja | **isključeni** (`locationAlwaysPermission: false`, `isAndroidBackgroundLocationEnabled: false`, `isAndroidForegroundServiceEnabled: false`, `motionUsagePermission: false`) | nema pozadinskog praćenja |
| iOS `NSLocationWhenInUseUsageDescription` | „USKOČI koristi jednu lokaciju kada pritisneš „U blizini”, da prikaže mapu zadataka oko tebe.” | tačan opis |
| `RECORD_AUDIO` | `modules/uskoci-voice/android/src/main/AndroidManifest.xml` | govorni unos, samo Android, prolazni PCM; `UskociVoiceModule.kt` |
| Kamera (`cameraPermission`) | plugin `expo-image-picker` u `app.config.js`: „USKOČI koristi kameru kada želiš da dodaš fotografiju zadatka ili profila.” | fotografisanje za zadatak/profil |
| Fotografije (`photosPermission`) | isti plugin: „Izaberi fotografiju za svoj zadatak ili profil.” | izbor iz galerije |
| Mikrofon (`microphonePermission`) | isti plugin: „Drži mikrofon za razgovor sa USKOČI asistentom. Puštanje završava transkript koji možeš da izmeniš; poruku šalješ tek kada izabereš Pošalji.” | **razilazi se**: vidi 2.3 |

### 2.2. Ono što dolazi iz biblioteka i mora se pročitati iz spojenog manifesta izdanja

`[[PROVERITI: iz AndroidManifest.xml unutar potpisanog AAB-a, na primer alatom aapt2 dump permissions, i iz Info.plist unutar IPA]]`. Očekivano na osnovu zavisnosti (ne prihvatati bez provere):

| Biblioteka | Što može dodati |
|---|---|
| `expo-notifications` | dozvola za obaveštenja na Androidu 13+, opcije za pokretanje posle restarta, FCM prijem (`firebase_messaging_auto_init_enabled` i `firebase_analytics_collection_enabled` su postavljeni na `false` za obične probne gradnje, `plugins/withFirebaseEnrollmentDisabled.js`) |
| `expo-image-picker` | kamera; na Androidu i mikrofon kada je `microphonePermission` zadat |
| `@maplibre/maplibre-react-native` | mrežne i lokacione dozvole za prikaz mape i lokacioni menadžer |
| `react-native` / `@supabase/supabase-js` | internet, stanje mreže |
| iOS | `PrivacyInfo.xcprivacy` iz Expo/React Native modula i provera „required reason API” (npr. datoteke, vremenske oznake, sistemski podaci) iz stvarnog IPA `[[PROVERITI]]` |

### 2.3. Nalazi koji utiču na tačnost dozvola (BOTH-01 „Permission truthfulness”)

1. **Opis dozvole mikrofona ne odgovara ponašanju.** Tekst opisa kaže da se poruka šalje tek na „Pošalji”, a podrazumevano ponašanje je da puštanje odmah šalje tekst u razgovor (pregled je opcija; `src/features/voice/useHoldToTalk.ts:17`). Predlog teksta: LEG-12, N-03.
2. **Mikrofon na iOS-u nije potreban.** Govorni modul postoji samo za Android (`modules/uskoci-voice/expo-module.config.json`: `"platforms": ["android"]`), a `RECORD_AUDIO` već dolazi iz manifesta modula. Zadavanje `microphonePermission` u `expo-image-picker` dodaje opis za iOS mikrofon i (na Androidu) dozvolu koja se već navodi. `[[ODLUKA VLASNIKA / PROVERITI: ukloniti opis mikrofona za iOS dok govor ne postoji na iOS-u, i proveriti da li je Android dozvola potrebna dvaput]]`
3. **Nema pozadinskih režima ni servisa** u konfiguraciji; potvrditi u spojenom manifestu.
4. **Push u izdanju prodavnice nije konfigurisan** u repozitorijumu (`googleServicesFile` se briše za `rs.uskoci`; `app.config.js`). Ako push ulazi u prvo izdanje, dodati konfiguraciju paketa i ažurirati LEG-11 R-05.
5. Ograničena upotreba dozvole za fotografije: na Androidu 13+ izbor slike ide preko sistemskog izbornika bez široke dozvole; `[[PROVERITI: da li izdanje traži READ_MEDIA_* ili READ_EXTERNAL_STORAGE]]` (Google Play: „Photo/video minimum scope”, GPL-07).

## 3. SDK-ovi i šta rade sa podacima

Nema SDK-ova za analitiku, praćenje grešaka, oglašavanje ni atribuciju u `package.json` niti u kodu (pretraga `sentry`, `crashlytics`, `analytics`, `amplitude`, `mixpanel`, `segment`, `bugsnag`, `datadog` u `src/`, `package.json`, `app.config.js`: nema pogodaka osim naziva komponente „Segmented”). Firebase analitika je izričito isključena u probnim gradnjama. `[[PROVERITI: isto za spojeni izdavački artefakt]]`

| Biblioteka (verzija) | Šta radi | Podaci koji izlaze sa uređaja |
|---|---|---|
| `@supabase/supabase-js` (2.112.4) | prijava, čitanja i komande prema bazi, pozivi Edge funkcija, WebSocket za govor | svi podaci aplikacije (LEG-09); sesija u `AsyncStorage` |
| `@react-native-async-storage/async-storage` (3.1.1) | lokalno skladište: sesija, žurnali komandi, nacrti | ostaje na uređaju |
| `@maplibre/maplibre-react-native` (11.3.10) | prikaz mape, nativni lokacioni menadžer (jedno očitavanje za tačku zadatka) | IP i zahtevi pločica ka OpenFreeMap; koordinate ne izlaze osim kroz izričite komande zadatka |
| `expo-location` (57.0.20) | „U blizini”: jedno očitavanje u prednjem planu | ništa (ne čuva se, ne šalje) |
| `expo-notifications` (57.0.15) | dozvola, kanal, Expo push token | Expo token (server ga čuva) |
| `expo-image-picker` (57.0.17), `expo-image-manipulator` (57.0.17) | izbor/fotografisanje i priprema slike | slika prema `uskoci-media` (server je sanitizuje) |
| `expo-file-system` (57.0.6) | čuvanje izvezene kopije podataka na uređaj | ništa ka mreži |
| `expo-web-browser`, `expo-linking` (57.0.2, 57.0.8) | otvaranje pravnih dokumenata i spoljnih veza, dolazne veze | otvara se adresa koju korisnik izabere |
| `expo-device`, `expo-constants` | provera da li je stvaran uređaj, identitet gradnje, ID projekta | ID projekta Expo-a ide uz zahtev tokena |
| `lottie-react-native`, `phosphor-react-native`, `react-native-svg`, `expo-image`, `expo-blur`, `expo-glass-effect`, `expo-haptics`, `expo-symbols`, `expo-font` | prikaz i animacija | ništa |
| `react-native-reanimated`, `-gesture-handler`, `-screens`, `-safe-area-context`, `-worklets`, `@gorhom/bottom-sheet`, `expo-router`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `@expo/ui` | okvir i navigacija | ništa |
| `react-native-web`, `react-dom` | veb izgradnja (razvoj); nisu deo mobilnog izdanja | - |
| Nativni modul `UskociVoice` (Kotlin) | hvata PCM 16 kHz dok se drži mikrofon | zvuk ide funkciji `uskoci-speech-session` (prolazno) |

Serverske biblioteke koje nisu u aplikaciji: `@imagemagick/magick-wasm` 0.0.43 (Apache-2.0) se koristi u Edge funkciji `uskoci-media` za obradu slika (`supabase/functions/uskoci-media/index.ts`).

## 4. Licence

### 4.1. Direktne zavisnosti (izvor: `package-lock.json`, polje `license`)

Direktne zavisnosti su gotovo sve MIT; `lottie-react-native` i razvojne alatke (`typescript`, `@imagemagick/magick-wasm`) su Apache-2.0. Paket `decode-uri-component` je lokalni prilagodnik iz `vendor/decode-uri-component-compat` (privremeno rešenje za `query-string`, `vendor/decode-uri-component-compat/README.md`) i nema navedenu licencu u zaključanom popisu: `[[PROVERITI: licenca prilagodnika i izvornog paketa]]`.

| Grupa | Paket | Verzija (lock) | Licenca (lock) |
|---|---|---|---|
| runtime | `@expo/ui` | 57.0.14 | MIT |
| runtime | `@gorhom/bottom-sheet` | 5.2.14 | MIT |
| runtime | `@maplibre/maplibre-react-native` | 11.3.10 | MIT |
| runtime | `@react-native-async-storage/async-storage` | 3.1.1 | MIT |
| runtime | `@supabase/supabase-js` | 2.112.4 | MIT |
| runtime | `decode-uri-component` | - | `[[PROVERITI]]` |
| runtime | `expo` | 57.0.18 | MIT |
| runtime | `expo-blur` | 57.0.3 | MIT |
| runtime | `expo-constants` | 57.0.16 | MIT |
| runtime | `expo-device` | 57.0.1 | MIT |
| runtime | `expo-file-system` | 57.0.6 | MIT |
| runtime | `expo-font` | 57.0.2 | MIT |
| runtime | `expo-glass-effect` | 57.0.1 | MIT |
| runtime | `expo-haptics` | 57.0.2 | MIT |
| runtime | `expo-image` | 57.0.3 | MIT |
| runtime | `expo-image-manipulator` | 57.0.17 | MIT |
| runtime | `expo-image-picker` | 57.0.17 | MIT |
| runtime | `expo-linking` | 57.0.8 | MIT |
| runtime | `expo-location` | 57.0.20 | MIT |
| runtime | `expo-notifications` | 57.0.15 | MIT |
| runtime | `expo-router` | 57.0.17 | MIT |
| runtime | `expo-splash-screen` | 57.0.8 | MIT |
| runtime | `expo-status-bar` | 57.0.1 | MIT |
| runtime | `expo-symbols` | 57.0.2 | MIT |
| runtime | `expo-system-ui` | 57.0.3 | MIT |
| runtime | `expo-web-browser` | 57.0.2 | MIT |
| runtime | `lottie-react-native` | 7.3.8 | Apache-2.0 |
| runtime | `phosphor-react-native` | 3.0.6 | MIT |
| runtime | `react` | 19.2.3 | MIT |
| runtime | `react-dom` | 19.2.3 | MIT |
| runtime | `react-native` | 0.86.3 | MIT |
| runtime | `react-native-gesture-handler` | 2.32.0 | MIT |
| runtime | `react-native-reanimated` | 4.5.1 | MIT |
| runtime | `react-native-safe-area-context` | 5.7.0 | MIT |
| runtime | `react-native-screens` | 4.26.2 | MIT |
| runtime | `react-native-svg` | 15.15.4 | MIT |
| runtime | `react-native-web` | 0.21.2 | MIT |
| runtime | `react-native-worklets` | 0.10.1 | MIT |
| razvoj | `@imagemagick/magick-wasm` | 0.0.43 | Apache-2.0 |
| razvoj | `@types/jest` | 29.5.14 | MIT |
| razvoj | `@types/react` | 19.2.18 | MIT |
| razvoj | `jest` | 29.7.0 | MIT |
| razvoj | `jest-expo` | 57.0.5 | MIT |
| razvoj | `typescript` | 6.0.3 | Apache-2.0 |

### 4.2. Tranzitivne licence (proizvodna grana zaključanog popisa)

Raspodela po licenci: MIT 601, ISC 45, BSD-3-Clause 16, BSD-2-Clause 13, Apache-2.0 13, MPL-2.0 12, BlueOak-1.0.0 6, `(MIT OR CC0-1.0)` 2, Unlicense 2, 0BSD 2, „MIT AND Apache-2.0” 1, `(MIT OR Apache-2.0)` 1, CC0-1.0 1, CC-BY-4.0 1, Python-2.0 1, `(BSD-3-Clause OR GPL-2.0)` 1, bez navedene licence 2 (`decode-uri-component`, lokalni prilagodnik).

Paketi koji zaslužuju posebnu pažnju pri atribuciji: `lightningcss` i njegove platformske varijante (MPL-2.0; alat za izgradnju), `caniuse-lite` (CC-BY-4.0; podaci za alate), `node-forge` (`BSD-3-Clause OR GPL-2.0`, koristi se pod BSD-3-Clause), `argparse` (Python-2.0), `glob`, `minimatch`, `minipass`, `path-scurry`, `sax` (BlueOak-1.0.0). `[[PROVERITI: koji od tranzitivnih paketa se stvarno pakuje u mobilni izdavački artefakt; generisati punu atribuciju alatom za licence iz stvarne gradnje]]`

### 4.3. Šta treba da postoji u aplikaciji

Tekstovi licenci i obaveštenja (MIT, Apache-2.0 sa NOTICE, SIL OFL za font) treba da budu dostupni korisniku (npr. u „O aplikaciji”). U aplikaciji **nije pronađen** ekran sa licencama otvorenog koda (pretraga `licenc` u `src/app/(app)/profil/o-aplikaciji.tsx`: samo „Pravila i saglasnosti”, „Privatnost i podaci”, `BuildIdentity`). `[[ODLUKA VLASNIKA: dodati ekran ili vezu ka javnoj stranici sa atribucijama]]`

## 5. Poreklo asseta i atribucije

| Asset | Poreklo u repozitorijumu | Obaveza / otvoreno |
|---|---|---|
| Font Inter (Regular, Medium, SemiBold, Bold, ExtraBold) | `assets/fonts/inter/`, tekst licence `OFL.txt`: „SIL Open Font License, Version 1.1”, autorska prava „The Inter Project Authors” | licenca mora da prati distribuciju fonta; uključiti u atribucije |
| Znak USKOČI, ikonica aplikacije, splash | `assets/brand/app-icon/provenance.json`: izvedeno iz znaka „exact SPOJ V2 BrandMark paths”, bez prekrajanja; odluke vlasnika 2026-09-17 | vlasnički znak; `[[PROVERITI: prava na znak i registrovanje žiga, ako je relevantno]]` |
| Uvodne fotografije i beleške (`requester.webp`, `worker.jpg`, `requester-note.svg`, `worker-note.svg`) | `assets/brand/entry-v49/provenance.json`: uvezeno iz `USKOCI_SPOJ_V4_9_COMPOSITION.html` (SHA-256 izvora zapisan) | poreklo i prava na fotografije nisu zapisani; `[[PROVERITI: autor, licenca ili vlasništvo fotografija]]` |
| Lottie animacije (`assets/catalog27/*.json`, 5 datoteka) | nema zapisa o autoru u pregledanim datotekama | `[[PROVERITI: autor i licenca svake animacije]]` |
| Ikone činjenica (`FactArt`) i ilustracije | dvotonske ikone preuzete iz vlasničkog prototipa (V28) po odluci vlasnika | `[[PROVERITI: da li su ikone vlasničke]]` |
| Ikone `phosphor-react-native` | MIT (paket) | preporučena atribucija |
| Podloga mape | © OpenStreetMap, © OpenMapTiles, OpenFreeMap (u aplikaciji: `LocationOverviewMap.types.ts:34-38`) | obavezne atribucije već prikazane; ne uklanjati |
| Pretraga adresa | veza „LocationIQ · izvori podataka” (`WorkerAreaSearch.tsx:79`) | atribucija prikazana uz pretragu |

## 6. Audit izdavačkog artefakta (spisak za izvršenje)

1. Izgraditi potpisan AAB (`rs.uskoci`) i IPA; sačuvati SHA-256 i identitet gradnje (`BuildIdentity`).
2. Iz AAB izvući spojeni `AndroidManifest.xml` i popis dozvola; uporediti sa odeljcima 2.1-2.3; ukloniti nepotrebne dozvole.
3. Proveriti target API (Google: API 36 od 31.08.2026, master plan W01) i poravnanje nativnih biblioteka na 16 KB (W04).
4. Iz IPA izvući `Info.plist`, `PrivacyInfo.xcprivacy` (spojeno) i provere „required reason API” (APL-03, APL-04); minimalni iOS cilj proveriti na artefaktu, ne pretpostavljati (W02).
5. Generisati punu listu licenci iz stvarne gradnje i objaviti atribucije.
6. Uporediti rezultate sa LEG-09/11/12 i popuniti LEG-16/17 iz stvarnog popisa; dokumentovati razlike.
7. Potvrditi da izdanje ne sadrži DEV galerije i proof ulaze (master plan 17.2 „Build”). Dizajn rute (`src/app/dizajn-*.tsx`) postoje u repozitorijumu; prema komentaru u `src/app/dizajn-privatnost.tsx` dostupne su samo u internoj gradnji, a „the store package shows nothing”. `[[PROVERITI: na stvarnom izdanju]]`
