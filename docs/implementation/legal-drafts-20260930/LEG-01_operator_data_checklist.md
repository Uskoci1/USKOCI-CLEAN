# LEG-01 · Podaci operatera: šta vlasnik mora da dostavi i gde se koristi

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-01 (master plan 16.2): „Pravo poslovno ime, oblik, adresa, registracioni/poreski podaci gde su primenljivi, kontakt i odgovorna osoba. Preuzeti stvarne podatke, ne izmišljati buduću firmu.” |
| Status | DATA-PENDING-OWNER: nijedan podatak operatera ne postoji u repozitorijumu |
| Provera | U kodu i dokumentima nema naziva firme, PIB-a, matičnog broja, adrese, domena ni adrese e-pošte za privatnost, podršku ili reklamacije (pretraga `PIB`, `matični broj`, `d.o.o`, adresa e-pošte i domen u `src/`, `supabase/`, `docs/`, `app.config.js`; jedini nalaz su primeri `ime@primer.rs` u `src/app/auth.tsx:359,496`). Odluka vlasnika AF-D10: „operator još nije registrovan” (`docs/implementation/v5-ai-first/OPEN_INPUTS.md`). |

## 0. Kako se koristi ovaj spisak

- Vlasnik dostavlja podatke kroz bezbedan kanal koji izabere (master plan 21.1: „Vlasnik kroz odabranu bezbednu predaju”). U repozitorijum ne idu lične isprave, brojevi računa, lozinke ni pristupni podaci konzola.
- Svako polje ima šifru `OP-xx`. U nacrtima stoji `[[OPERATER: ...]]` na mestu gde će se polje upotrebiti; kada se dostavi, menja se svuda odjednom.
- Podaci moraju biti **isti** u dokumentima, na sajtu i u konzolama prodavnica (master plan, LEG-01 dokaz).
- Ništa se ne izmišlja unapred. Ako operater još ne postoji kao pravno lice, prvo se odlučuje o obliku (OP-01), pa tek onda o ostalim poljima.

## 1. Identitet i registracija

| ID | Šta se traži | Zašto (izvor) | Gde se koristi | Status |
|---|---|---|---|---|
| OP-01 | **Pravni oblik operatera**: preduzetnik, društvo (d.o.o.) ili drugo; ili odluka da se pre objave registruje | RC2 P0: „Uneti pun identitet operatera: naziv/ime, pravna forma, PIB, matični broj ako postoji, sedište/adresa, kontakt” | svi javni dokumenti; Apple/Google nalog | `[[ODLUKA VLASNIKA]]` |
| OP-02 | **Puno poslovno ime** (ili ime i prezime, ako je fizičko lice) | RC2 Uslovi §1 | LEG-02 §1; LEG-04 §1; LEG-07; LEG-08; potpis pravnih dokumenata; prodavnice | `[[OPERATER]]` |
| OP-03 | **Adresa sedišta / poštanska adresa** | RC2 Uslovi §1; RC2 Reklamacije §14 („Poštanska adresa operatera”) | LEG-02; LEG-04; LEG-07; Google Play (adresa programera, kada je zahtevana); App Store Connect | `[[OPERATER]]` |
| OP-04 | **PIB** | RC2 P0 | LEG-02 §1; račun kada se naplata uvede | `[[OPERATER]]` |
| OP-05 | **Matični broj** (ako postoji) i registarski podaci (registar, datum, broj rešenja) gde su primenljivi | RC2 P0 | LEG-02 §1; prodavnice (verifikacija organizacije) | `[[OPERATER]]` |
| OP-06 | **Poreski i PDV status** | RC2 Uslovi §15-16 (naplata se ne uvodi bez fiskalnog rešenja); master plan 3.2 | potreban tek kada se uvede naplata; do tada „nije primenljivo” | `[[PROVERITI]]` |
| OP-07 | **Odgovorna osoba** (ime, funkcija) za: pravne dokumente, privatnost, moderaciju i podršku | master plan LEG-01, LEG-14 | interni registar (LEG-09 odeljak 4; LEG-14); ne mora se javno navesti | `[[OPERATER]]` |

## 2. Kontakti (RC2 traži razdvojene kanale)

Jedan generički „Kontaktirajte podršku” nije dovoljan (RC2 Reklamacije §1): postoje najmanje četiri različita slučaja sa različitim rokom i pristupom dokazima.

| ID | Kanal | Zašto (izvor) | Gde se koristi | Napomena |
|---|---|---|---|---|
| OP-10 | **Opšta pitanja** (email ili obrazac) | RC2 Uslovi §1 | LEG-02 §1, §34; podešavanja aplikacije; Apple „Support URL”; Google Play „kontakt e-pošta” | `[[OPERATER]]` |
| OP-11 | **Reklamacije na USKOČI uslugu** (email ili obrazac) + potvrda prijema i evidencioni broj | RC2 Uslovi §22, Reklamacije §3-4 | LEG-07 §2-4; aplikacija: tema „Reklamacija na USKOČI uslugu” (`src/ui/support/SupportPresentation.tsx:22`) | u aplikaciji već postoji unos predmeta; javni kanal van aplikacije nije određen |
| OP-12 | **Privatnost i prava lica** (email ili obrazac) | RC2 Privacy §1, §16-17 | LEG-04 §1, §14; LEG-08; LEG-15; App Privacy i Data Safety | u aplikaciji tema „Privatnost i prava” |
| OP-13 | **Bezbednost i nezakonit sadržaj** (email ili u aplikaciji) | RC2 Uslovi §1, Reklamacije §11 | LEG-05; LEG-07 §5 | u aplikaciji postoji privatna prijava sa 5 kategorija |
| OP-14 | **Pravo i autorska prava** (obaveštenje o nezakonitom sadržaju/IP) | RC2 Reklamacije §12, §14 | LEG-05; LEG-07 | u aplikaciji tema „Prijava sadržaja ili recenzije” |
| OP-15 | **Telefon** (ako se objavljuje) | zahtev konzola prodavnica `[[PROVERITI u konzoli]]` | App Store Connect (kontakt za pregled); Google Play (kontakt programera) | zavisi od tipa naloga |
| OP-16 | **Domen i javne adrese**: Uslovi, Politika privatnosti, podrška, stranica za brisanje naloga (HTTPS, bez instalirane aplikacije) | master plan 17.2 („Javni web”), LEG-08; registar dokumenata traži HTTPS adresu i SHA-256 (`supabase/migrations/20260908130000_clean_p1_legal_consent_ledger.sql`) | aplikacija (veze na dokumente), prodavnice | domen nije odabran; `[[ODLUKA VLASNIKA: domen i hosting]]` |

## 3. Pravna pitanja koja zavise od operatera

| ID | Šta se traži | Zašto (izvor) | Gde se koristi |
|---|---|---|---|
| OP-20 | **Merodavno pravo i nadležnost** (očekivano Republika Srbija) | RC2 Uslovi §32: „[MERODAVNO PRAVO OPERATERA]” | LEG-02 §32 |
| OP-21 | **Lice za zaštitu podataka**, ako je određeno ili obavezno; kontakt | RC2 Privacy §1 | LEG-04 §1; Google/Apple odgovori |
| OP-22 | **Predstavnik u drugoj državi**, ako se aplikacija nudi tamo gde se traži | `[[PROVERITI]]` posle odluke o zemljama (OP-30) | LEG-04 §1 |
| OP-23 | **Vansudsko rešavanje potrošačkih sporova**: potvrda da operater nastupa kao trgovac prema potrošaču, telo i veza na zvaničnu platformu | RC2 Reklamacije §6-7 („Finalna verzija mora sadržati stvarni identitet operatera i hyperlink ka zvaničnoj ADR platformi”) | LEG-07 §6; in-app tekst o ADR |
| OP-24 | **Mišljenje resornog ministarstva** o granici platforme i posredovanja u zapošljavanju, ili ograničenje koje to zatvara | RC2 P0 | LEG-02 §6 |
| OP-25 | **Postupak povrede podataka**: odgovorno lice, kontakt nadležnog organa, evidencija | RC2 Privacy §19 | interno; LEG-14 |

## 4. Poslovne odluke koje ulaze u dokumente

| ID | Odluka | Izvor | Gde se koristi |
|---|---|---|---|
| OP-30 | **Zemlje u kojima se aplikacija nudi** i uzrast (RC2 predviđa 18+) | RC2 Uslovi §4, §17; `docs/control/redovi.json` („Uzrast i vrste poslova: TVOJA ODLUKA”) | LEG-02 §4; LEG-19; prodavnice |
| OP-31 | **Bezplatan launch** (0 RSD) i tekst o budućoj naknadi | RC2 Uslovi §15; master plan 3.2 | LEG-02 §15; LEG-20 |
| OP-32 | **Jezik dokumenata** (srpska latinica; ćirilica i engleski po potrebi) i **obraćanje** („Vi” u pravnim tekstovima kao u RC2, „ti” kao u aplikaciji) | odluka nije zabeležena | svi javni dokumenti |
| OP-33 | **Vlasnik procesa za svaku klasu podataka** i ko odlučuje o zahtevu za brisanje/izvoz | RC2 Privacy §15 | LEG-10; LEG-15 |
| OP-34 | **Rokovi čuvanja** | LEG-10 odeljak 6 | LEG-04 §12; LEG-08 |
| OP-35 | **Ugovorne strane** kod davalaca (koje pravno lice je prihvatilo uslove Google-a, Supabase-a, Expo-a, LocationIQ-a) | LEG-11 | LEG-11; LEG-04 §8 |

## 5. Nalozi i konzole (potrebni za objavu, ne za tekst)

| ID | Šta se traži | Izvor | Gde se koristi |
|---|---|---|---|
| OP-40 | **Apple Developer** nalog (tip fizičko lice/organizacija, ime subjekta) i identitet aplikacije (`ios.bundleIdentifier` nije podešen u `app.json`) | master plan 17.2, 21.1; `docs/control/redovi.json` (prodavnice: „iOS oznaka aplikacije: NIJE PODEŠENO”) | App Store Connect; LEG-16, LEG-20 |
| OP-41 | **Google Play** nalog (tip, verifikacija; za nove lične naloge obavezno zatvoreno testiranje sa najmanje 12 testera 14 dana - master plan 18.1, W03, `[[PROVERITI]]`) i konačan `applicationId` (`rs.uskoci` za izdanje, `rs.uskoci.preview` je probni; `app.config.js`; „package je trajan”) | master plan 18.1; `app.config.js` | Play Console; LEG-17, LEG-20 |
| OP-42 | **Nalozi davalaca** na ime operatera: Supabase organizacija, Google (Gemini API, naplata), Expo/EAS (`owner: "sljivas-team"` u `app.json`), LocationIQ | LEG-11 | LEG-11; LEG-04 |
| OP-43 | **Pošiljalac email poruka** za registraciju i oporavak lozinke (adresa pošiljaoca, domen, SPF/DKIM) | `docs/control/redovi.json` (N02); master plan 17.2 („Auth / email”) | Supabase Auth; LEG-11 R-08 |
| OP-44 | **Nalozi za pregled prodavnica** (dva korisnička toka, bezbedno pripremljeni; pristupni podaci ostaju u konzoli, ne u dokumentu) | master plan LEG-20; 18.2 APL-08 | LEG-20 |

## 6. Kada je spisak zatvoren

Spisak je zatvoren kada:

1. su OP-01..OP-05 i OP-10..OP-13 popunjeni stvarnim podacima i potvrđeni od odgovornog lica;
2. je OP-16 (domen i javne adrese) odabran i adrese rade;
3. su OP-20..OP-25 ili popunjeni ili je upisano „nije primenljivo” sa obrazloženjem;
4. se isti podaci pojavljuju u nacrtima LEG-02/04/05/07/08, u aplikaciji i u konzolama;
5. je pravni pregled potvrdio sadržaj (ovaj plan nije novi pravni pregled - master plan 16.1).

Do tada se nijedan dokument iz ovog paketa ne objavljuje kao konačan, i ne unosi se izmišljen podatak (master plan 16.3, 16.4).
