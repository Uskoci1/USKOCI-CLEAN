# LEG-13 · Pravni ekrani i prihvatanje: matrica

> **TEHNIČKI NACRT - nije pravni savet; čeka podatke operatera i pregled odgovornog lica**

| | |
|---|---|
| Isporuka | LEG-13 (master plan 16.2, ciljni dokument `USKOCI_LEGAL_UI_COMPLIANCE_MATRIX_V1`): gde se koji dokument vidi i prihvata, koja verzija, potvrda, povratak i izmena uslova |
| Status | DRAFT-FROM-CODE (stanje danas); ciljna matrica je predlog i traži odluke vlasnika |
| Izvor koda | `Uskoci1/USKOCI-CLEAN`, grana `work/uskoci-ui-unification-20260924`, commit `fc58f411598338c8589f5f177626a2790c92fb13`, pročitano 2026-09-30, samo za čitanje |

## 1. Serverski ugovor prihvatanja (šta već postoji)

| Stavka | Stanje | Izvor |
|---|---|---|
| Vrste dokumenata u registru | samo `TERMS` i `PRIVACY` (provera `document_kind in ('TERMS','PRIVACY')`); jedan aktivan red po vrsti | `supabase/migrations/20260908130000_clean_p1_legal_consent_ledger.sql:34,43,50-53` |
| Šta registar čuva | oznaka verzije, SHA-256 sadržaja, javna HTTPS adresa, vreme objave i stupanja na snagu | isto; `src/contracts/legal.ts` |
| Čitanje | `rpc_get_legal_bundle()` čitljiv i anonimno; vraća `LEGAL_DOCUMENTS_NOT_PUBLISHED` dok obe vrste ne postoje | `docs/implementation/P1_LEGAL_CONSENT_20260908.md` |
| Prihvatanje | `rpc_accept_reviewed_legal_bundle(zahtev, sha_uslova, sha_privatnosti)` (samo prijavljen); nepromenljiv snimak oba dokumenta i hešova; ista komanda ponovljena vraća istu potvrdu; drugačiji heš od aktivnog daje `LEGAL_REVIEW_CHANGED` | `supabase/migrations/20260912222338_clean_v5_owner_safety_legal_reads.sql:44-88` |
| Nova verzija | poništava „prihvaćeno aktuelno”; novi zahtev beleži drugi red; stara komanda ne prihvata novu verziju bez prikaza | `P1_LEGAL_CONSENT_20260908.md`; `src/ui/legal/legalReview.ts:92,111` |
| Registar je prazan | 0 objavljenih dokumenata na razvojnom projektu (2026-09-29) | master plan, DB01 |
| Prihvatanje nije uslov ničega | „acceptance is not yet required by any command boundary”; ni objava zadatka ne proverava prihvatanje | `P1_LEGAL_CONSENT_20260908.md`; `docs/implementation/v5-ai-first/PUBLICATION_ACTIVATION_READINESS.md` (uvod) |

## 2. Gde se pravni sadržaj vidi i prihvata danas

| Ekran (ruta) | Šta prikazuje | Prihvatanje | Stanje / napomena |
|---|---|---|---|
| Registracija (`src/app/auth.tsx`) | Jedna rečenica: „Ovo je test verzija. Uslovi korišćenja i Politika privatnosti biće objavljeni pre javnog pokretanja.” (`:389`) | ne | nema veza ka dokumentima, nema polja saglasnosti. Komponenta `PublicLegalModal` (javni prikaz bez prihvatanja) postoji u `src/ui/legal/LegalDocuments.tsx`, ali je u pravoj aplikaciji nigde ne poziva (samo galerija `src/app/dizajn-privatnost.tsx`) |
| Profil → O aplikaciji (`/profil/o-aplikaciji`) | redovi „Pravila i saglasnosti” i „Privatnost i podaci” | ne | samo navigacija |
| Profil → Pravila i saglasnosti (`/profil/pravna`) | objavljeni dokumenti (otvaraju se u pregledaču), stanje prihvatanja, „Obrađivači podataka” (mapa obrade) | da: dugme „Prihvati pregledane dokumente”; oporavak: „Proveri ishod prihvatanja”, „Ponovi isto prihvatanje” | jedini pravi put prihvatanja; dok dokumenti nisu objavljeni piše „Uslovi korišćenja i Politika privatnosti još nisu objavljeni.” |
| Profil → Privatnost i podaci (`/profil/privatnost`) | rokovi čuvanja (kada su objavljeni), izvoz, zatvaranje naloga | ne | tekstovi zatvaranja naloga: LEG-10 odeljak 4 |
| Podrška (`/podrska`) | teme, stanja predmeta | ne | ne sadrži obaveštenje o vansudskom rešavanju (LEG-07 odeljak 6) |
| Razgovor sa AI (`/nova`, `/profil/razgovor`) | link „O govornom unosu i privatnosti” samo kada je govor dostupan | ne | ne postoji obaveštenje za tekstualni razgovor (LEG-12, N-01, N-02) |

## 3. Ciljna matrica (predlog za odluku)

Poredak objave iz master plana: tehnička istina → pravni osnov → čuvanje i obrađivači → javni tekst → verzija i heš → paket dokumenata → prikaz i prihvatanje u aplikaciji → odgovori za prodavnice → E2E.

| Mesto | Dokument | Radnja | Šta se beleži | Povratak | Preduslov |
|---|---|---|---|---|---|
| Registracija | Uslovi, Politika privatnosti | prikaz veza (javni prikaz bez prihvatanja); obaveštenje da se prihvatanje traži pri prvom ulasku, jer potvrda emaila mora da prethodi sesiji | ništa (nema naloga) | povratak u isti formular sa očuvanim poljima (već važi za javni prikaz) | objavljeni dokumenti (LEG-02, LEG-04) |
| Prvi ulaz posle potvrde (novo) | Uslovi + Politika (+ Pravila zajednice ako su deo Uslova) | izričito prihvatanje pregledanih dokumenata; izjava 18+ ako se uvede | verzija i heš oba dokumenta, vreme; izjava o uzrastu `[[ODLUKA VLASNIKA]]` | u aplikaciju; odbijanje = izlaz iz aplikacije/odjava, ne zaobilaženje | novi ekran + serverska kapija (danas ne postoji, vidi 1) |
| Promena verzije | isto | prikaz razlike i ponovno prihvatanje pre pogođenih funkcija | novi red prihvatanja | na ekran koji je korisnik napustio | serverska kapija po verziji |
| Profil → Pravila i saglasnosti | isto | pregled i prihvatanje (postoji) | isto | Profil | - |
| Objava zadatka i prijava | Uslovi (izvod), izjava trgovac/ne-trgovac, objašnjenje rangiranja | prikaz pre obavezivanja | izjava statusa (nije implementirano, RC2 P0) | isti tok | funkcije još ne postoje |
| Razgovor sa AI, govor, lokacija, push, fotografije | obaveštenja iz LEG-12 | prikaz pre prve upotrebe | ništa (obaveštenje, ne saglasnost) `[[PROVERITI]]` | isti ekran | tekstovi iz LEG-12 |
| Podrška | ADR obaveštenje, kontakti | prikaz | ništa | Podrška | LEG-07 |
| Zatvaranje naloga | LEG-08 tekst | postojeći tok | potvrda zatvaranja | - | tok postoji |
| Prodavnice | Politika privatnosti, brisanje naloga, podrška, uslovi | HTTPS adrese u konzolama | - | - | LEG-01 OP-16 |

## 4. Zahtevi koje matrica mora da ispuni (iz izvora)

- Pravno verzionisano prihvatanje Terms/Privacy uz vreme i verziju (RC2 P0); „nema lažnog prihvatanja” (GPL-05): ne beležiti saglasnost koju korisnik nije video.
- Server beleži odgovarajuću verziju; stari povratni poziv ne prihvata novu verziju bez prikaza (master plan LEG-13). Ovo je delom već ostvareno dvostrukim hešom (`LEGAL_REVIEW_CHANGED`).
- Saglasnost ne sme da bude opšta („blanket consent”): svaka obrada ima svoj osnov (RC2 Privacy §2, Uslovi §28).
- Objava zadatka i ostale komande danas ne zavise od prihvatanja; ako se uvede kapija, treba je dodati u serverske komande, ne samo u klijent.

## 5. Odluke i nedostaci

1. Da li se Pravila zajednice i bezbednosti i Reklamacije/podrška ugrađuju u Uslove ili se registar proširuje novom vrstom dokumenta (danas samo `TERMS` i `PRIVACY`): `[[ODLUKA VLASNIKA]]`.
2. Kada se traži prihvatanje (pri prvom ulasku, pri prvoj radnji, pri objavi) i šta se dešava ako korisnik odbije: `[[ODLUKA VLASNIKA]]`.
3. Izjava 18+ i mehanizam provere uzrasta (u kodu ne postoji): `[[ODLUKA VLASNIKA]]`; LEG-19.
4. Izjava trgovac/ne-trgovac i objašnjenje rangiranja pre obavezivanja (RC2 P0; ne postoji u aplikaciji).
5. Da li se javni prikaz dokumenata bez prijave (`PublicLegalModal`) uvodi na registraciju; potrebno je da dokumenti budu objavljeni.
6. Pravni tekst se čuva kao javna HTTPS stranica sa verzijom i SHA-256; hash se računa nad tačnim bajtovima objavljene stranice `[[PROVERITI: postupak izračunavanja i objave; kako se rešava CRLF/LF razlika koju dokumenti već pominju]]`.
