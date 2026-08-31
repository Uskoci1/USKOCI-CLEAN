# USKOČI — HTML REFERENCA IZGLEDA APP

Status: **REFERENCE-ONLY / NOT PRODUCTION SOURCE**

Ovo je kanonska oznaka za poslednji veliki HTML vizuelni/UI/UX/motion prototip USKOČI aplikacije koji služi kao referenca pri prenosu u Expo/React Native.

## Izvorni artefakt

- originalni naziv: `USKOCI_WAVE_CL_UIUX_PROPOSAL_2026-08-29.html`
- željeni kanonski naziv u repou: `USKOCI_HTML_REFERENCA_IZGLEDA_APP.html`
- original SHA-256: `1a0a7eefff67bf452acc70fb901aa5a59c394300c3615ba5cb765f5e21590d65`
- originalna veličina: ~3.12 MB

## Šta predstavlja

Referentni HTML sadrži vizuelni i interakcijski smer za:

- S01/S02 ulaz i landing/splash scenu;
- S03/S04 auth, registraciju, OTP, recovery i kontinuitet povratka u prethodni tok;
- Requester tokove i AI Need razgovor sa live karticom;
- Worker tokove, Prilike, prijavu i worker profil;
- Dogovor porodicu ekrana;
- bottom navigation, kartice, tipografsku hijerarhiju, trust/forest/orange/cream sistem;
- motion, forward/back prostorne tranzicije, sheet ponašanje i mikrointerakcije;
- loading/error/offline/recovery/accessibility reference states.

## Pravilo korišćenja

Ovaj HTML je **vizuelna/UX referenca**, a ne produkcioni runtime i ne sme zameniti canonical Expo/React Native source, Supabase contracts, RLS, RPC ili server-side autoritet.

Pri prenosu ekrana u Expo/React Native važi kontrolno pravilo:

> Ako native ekran bez opravdanog razloga izgleda ili se ponaša lošije od odgovarajućeg HTML referentnog ekrana, ekran se ne smatra vizuelno zatvorenim.

Native implementacija mora preuzeti najbolje elemente ovog reference artefakta kroz reusable design-system komponente, a zatim ih povezati sa stvarnim canonical backend tokom.

## Fizički HTML fajl

Kompletan HTML artefakt je trenutno sačuvan van repoa pod gore navedenim izvornim nazivom. Ovaj indeks je dodat da se referenca više ne izgubi niti pomeša sa production source-om. Kada se fizički HTML doda u repo, treba da bude postavljen pod `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html` bez menjanja njegove produktne uloge.
