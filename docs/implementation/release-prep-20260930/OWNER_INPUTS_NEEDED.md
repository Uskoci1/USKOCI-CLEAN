# Ulazi koje može dati samo vlasnik (po prioritetu), 2026-09-30

Samo odluke i ulazi koje inženjering ne može da izmisli. Redosled prati zavisnost i rok izvršenja (verifikacija naloga i D-U-N-S mogu trajati nedeljama). Pristupni podaci i lozinke se ne šalju u poruke ni u repozitorijum (plan 5.2). Šifre: kontrole iz `STORE_GATES_STATUS.md`, redovi iz `RELEASE_CONFIG_MATRIX.md` (C-xx), polja iz `legal-drafts-20260930/LEG-01` (OP-xx).

1. **Pravni oblik i podaci operatera** ili odluka da se operater registruje pre objave (OP-01..OP-05, OP-07). Koren svega: određuje tip developer naloga (organizacija traži pravno lice), pravne tekstove i domen. Blokira LEG-02/04/05/07/08, pa APL-02, GPL-02, GPL-03, GPL-13.
2. **Google Play nalog:** tip (lični ili organizacija sa D-U-N-S brojem), verifikacija identiteta, naknada od 25 USD i potvrda paketa `rs.uskoci` (trajan u Play Console) (OP-41). Blokira GPL-13, prvi upload (GPL-01) i zatvoreno testiranje (BOTH-03), C-01.
3. **Apple Developer nalog** (lični ili organizacija sa pravnim licem, D-U-N-S brojem i javnim sajtom; 99 USD godišnje), odluka da li iOS ulazi u prvo izdanje, izbor iOS `bundleIdentifier` i iPhone za dokaz (OP-40). Blokira APL-01, APL-08, APL-10, C-02, C-08, C-38.
4. **Domen i hosting** za Privacy, Uslove, Podršku i stranicu za brisanje naloga (OP-16). Blokira C-40..C-44, GPL-03, APL-02, GPL-02, GPL-04; Apple traži i sajt organizacije sa njenim domenom.
5. **Produkciono okruženje:** novi zaseban Supabase projekat (uz plan i region) ili formalna promocija DEV-a, plus odobrenje troška. Blokira C-10..C-14, C-16..C-18 i sve što traži pravi backend (GPL-01, APL-08, GPL-10, BOTH-03).
6. **Najmanje 12 testera** i način njihovog uključivanja, ako je Google nalog lični i otvoren posle 13.11.2023. Blokira zahtev za produkcioni pristup (BOTH-03); 14-dnevno brojanje ne počinje dok ih nema.
7. **Pošiljalac emaila** za potvrdu registracije i oporavak lozinke, sa domenom (SPF, DKIM, DMARC) (OP-43). Blokira C-24 i red N02; ugrađeni Supabase email radi samo za članove tima (2 poruke na sat).
8. **Zemlje u kojima se nudi i uzrast** (npr. 18+) (OP-30). Blokira APL-09, GPL-08, GPL-09, LEG-19 i odluku o EU pravilima (DSA status trgovca).
9. **Odgovorna osoba i stvaran kanal** za prijave, moderaciju i podršku (OP-07, OP-10..OP-14). Blokira APL-06, GPL-06, C-47; bez njih „prijavi” nema ko da obradi.
10. **Rokovi čuvanja i pravni pregled** (12 odluka iz `LEG-10`, OP-34) i odobren disposable subjekat za probno brisanje naloga (nikad vlasnikov nalog). Blokira APL-05, GPL-04, izvoz podataka (N09) i objavu LEG-04.
11. **Plaćeni resursi i budžet:** Supabase plan sa kopijama (i PITR ili ne), produkcioni Google (Gemini) nalog i naplata, LocationIQ plan, EAS plan, SMTP, domen, budžetski alarmi (OP-35, OP-42). Blokira C-30, C-32, C-48, C-56.
12. **Push u prvom izdanju: da ili ne.** Ako da: Android aplikacija `rs.uskoci` u Firebase projektu, FCM i (za iOS) APNs ključevi u Expo nalogu. Blokira C-36..C-38 i redove P02..P04.
13. **Govor i tekstovi dozvola:** govor samo na Androidu ili izvan prve verzije, i odobrenje novih tekstova dozvola (`LEG-12` N-03). Blokira BOTH-01, BOTH-02, C-31, C-35.
14. **Konačna vizuelna referenca i tekstovi listinga:** jedna odluka o spornom pin/asset delu, naziv, opis i ključne reči za prodavnice. Blokira APL-10 i BOTH-02 (pravi screenshotovi tek kad je izgled zamrznut).
15. **Pristup i izdanje:** pokretanje `eas build --profile production` sa vlasnikovim EAS nalogom, produkcioni review nalozi upisani samo u konzole, priključen fizički Android (i iPhone ako iOS ulazi) za završni dokaz, i na kraju odobrenje kandidata, zemalja i trenutka submit-a (plan 20.2). Blokira GPL-01, APL-08, GPL-10, BOTH-03.

Nije na ovom spisku (inženjering): promena EAS provere za produkcioni projekat i iOS, dodavanje `EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL` u profil `production`, kapija saglasnosti, web put za brisanje, provera AAB-a i spojenog manifesta, nacrti odgovora za Data safety i App Privacy.
