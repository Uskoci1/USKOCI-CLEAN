# USKOČI: podaci, obrađivači i rokovi čuvanja (nacrt za pravnika)

Stanje na dan 21.09.2026, test verzija. Pripremljeno iz stvarnog koda i baze, ne iz pretpostavki.

**Ovo nije pravni savet.** Kolona „Predlog roka" je tehnički predlog i da bi važila mora da je potvrdi pravnik. Gde
predloga nema, rok određuje pravnik. Ništa od ovoga još nije uključeno u aplikaciju: svi rokovi u bazi su prazni, pa
se automatski ništa ne briše.

## 1. Rukovalac (operater): nedostaje

Operater još nije registrovan (odluka vlasnika AF-D10). Za Uslove korišćenja i Politiku privatnosti potrebni su:
- naziv firme ili preduzetnika;
- adresa sedišta;
- matični broj i PIB;
- email za kontakt i za pitanja o podacima;
- lice za zaštitu podataka, ako postoji.

## 2. Ko još obrađuje podatke (obrađivači)

| obrađivač | šta radi | koje podatke dobija | gde |
| --- | --- | --- | --- |
| Supabase | baza, prijava (Auth), fajlovi, serverske funkcije | sve podatke aplikacije | region eu-central-1 (Frankfurt, EU) |
| Google (Gemini API) | AI razgovor za zadatak i za profil radnika; provera zadatka i fotografija pre objave; provera javnih pitanja i odgovora; govorni unos (pretvaranje govora u tekst) | tekst razgovora, izabrane fotografije, javni podaci zadatka, snimak govora dok se govori | Google |
| Expo, pa Google FCM (Android) i Apple APNs (iOS) | slanje push obaveštenja | token uređaja i uvek isti tekst „Imaš novo obaveštenje. Otvori aplikaciju.", bez ličnog sadržaja | Expo, Google, Apple |
| LocationIQ | pretraga adrese i pretvaranje u koordinate | upisana adresa ili deo adrese | eu1.locationiq.com (EU) |
| OpenFreeMap | prikaz mape u aplikaciji | IP adresa telefona i deo mape koji se gleda | tiles.openfreemap.org |

**Pitanje za pravnika:** da li za svakog od ovih treba poseban ugovor o obradi i da li se navode u Politici
privatnosti poimenično.

## 3. Vrste podataka i rokovi

**Šta je vlasnik već odlučio (AF-D22):**
- Istorija (završeni poslovi, dogovori, poruke, fotografije) ostaje dok nalog postoji, bez automatskog brisanja posle
  30 dana.
- Pri zatvaranju naloga lični sadržaj se briše ili anonimizuje, uz samo neophodne tehničke i pravne izuzetke.
- Ta odluka ne određuje trajanje izuzetaka. To određuje pravnik.

**Šta aplikacija danas radi pri zatvaranju naloga:**
- briše ime, email i telefon;
- briše lični sadržaj iz svih 15 vrsta ispod;
- zadržava samo pseudonimni identifikator, da bi zapisi druge strane ostali celi.

Za zapise koji su dokazi u sporu ili prijavi (bezbednost, podrška, zajedničke odluke) zatvaranje staje i traži
pregled; ne briše ih samo.

| # | vrsta | šta sadrži | zašto se čuva | predlog roka (potvrđuje pravnik) |
| --- | --- | --- | --- | --- |
| 1 | Nalog | ime, email, telefon, grad, datum otvaranja | prijava i kontakt | dok nalog postoji |
| 2 | Profili | prikazno ime, grad, veštine, opis, dostupnost, kalendar radnika | prikaz i spajanje posla i radnika | dok nalog postoji |
| 3 | Zadaci, javni deo | naslov, opis, termin, grad i područje, broj ljudi, cena | objava zadatka | dok nalog postoji (AF-D22) |
| 4 | Zadaci, privatni deo | tačna adresa, napomene za pristup, tačne koordinate, lokacija radnika podeljena tokom posla | izvršenje posla; vidi ih samo izabrani radnik | dok nalog postoji (AF-D22). **Pitanje:** da li tačnu adresu i podeljenu lokaciju treba brisati ranije, npr. kad se dogovor završi |
| 5 | Prijave i izbor | ponuda radnika (cena, poruka), izbor naručioca | tržište | dok nalog postoji |
| 6 | Pitanja i odgovori pre izbora | javna pitanja o zadatku i odgovori | dogovaranje | dok nalog postoji |
| 7 | Dogovori | uslovi, izmene, izvršenje, prijava problema | dokaz šta je dogovoreno | dok nalog postoji. **Pitanje:** koliko dugo posle zatvaranja naloga čuvati uslove dogovora kao dokaz |
| 8 | Poruke | poruke u dogovoru, grupne poruke, razlog otkazivanja | komunikacija dve strane | dok nalog postoji; pri zatvaranju se brišu (dokazano 21.09.2026) |
| 9 | Ocene | ocena i oznake saradnje | poverenje | dok nalog postoji |
| 10 | Pristanak na uslove | verzija i otisak dokumenta, vreme prihvatanja | dokaz pristanka | **Pitanje:** koliko dugo posle zatvaranja naloga (samo verzija, otisak i vreme, bez sadržaja) |
| 11 | Obaveštenja | naslov i tekst obaveštenja, stanje, token uređaja | obaveštavanje | predlog: istorija obaveštenja 12 meseci; token do odjave ili zatvaranja naloga |
| 12 | AI razgovori | tekst razgovora sa AI, predložene činjenice | pravljenje zadatka i profila | predlog: napušten razgovor koji nije postao zadatak 30 dana; ono što je postalo zadatak prati zadatak |
| 13 | Fotografije | fotografije zadatka, profila i dogovora | prikaz i dokaz | dok nalog postoji (AF-D22) |
| 14 | Tehnički zapisi | zapisi komandi (da se radnja ne izvrši dvaput), izvoz i zatvaranje naloga | pouzdanost i dokaz izvršenja | predlog: 12 meseci; zapisi o zatvaranju naloga duže (pravnik) |
| 15 | Bezbednost i podrška | prijave, blokiranja, slučajevi podrške, odluke i žalbe, dnevnik radnji | zaštita korisnika, rešavanje sporova | **Pitanje:** koliko dugo posle zatvaranja naloga, u pseudonimnom obliku |
| — | Fajl izvoza podataka | kopija podataka korisnika na njegov zahtev | pravo na kopiju podataka | predlog: fajl dostupan 7 dana, pa se briše |

## 4. Pitanja za pravnika, ukratko

1. Podaci o rukovaocu (odeljak 1).
2. Ugovori o obradi i navođenje obrađivača (odeljak 2).
3. Rokovi za redove 4, 7, 10 i 15: čuvanje posle zatvaranja naloga kao dokaz ili radi bezbednosti.
4. Potvrda ili izmena predloga za redove 11, 12 i 14 i za fajl izvoza.
5. Da li se na registraciji traži izričit pristanak ili je dovoljno obaveštenje. Aplikacija već ume da zabeleži
   pristanak na tačnu verziju oba dokumenta, čim budu objavljeni.
