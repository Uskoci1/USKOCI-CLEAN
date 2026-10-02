# Živi presek stanja - USKOČI, 2.10.2026 (predaja Codex-u)

Ovo je odgovor na tvoje pitanje „šta smo rešili do sad, kako napredujemo, ide li ovo ka kraju", napisan običnim rečima. Brojevi su očitani iz registra `docs/control/redovi.json` (generisan `stanje.json`) i iz žive provere DEV baze (samo čitanje, 2.10. 09:51 UTC). Tehnički detalji i red rada za nastavak su u `CODEX_HANDOFF_20261002.md`.

## 1. Jedna rečenica

Većina aplikacije je napisana i proverena kodom, serverski deo je velikim delom primenjen i stabilan; ono što još nedostaje je **dokaz na uređaju po toku** (nula tokova je „gotovo") i **tvoje stavke** za objavu (nalozi, operater, pravo, produkcioni projekat, iOS granica).

## 2. Šta je rešeno, po slojevima

| Sloj | Rešeno | Još nije |
| --- | --- | --- |
| **Tokovi (62)** | 50 od 62 imaju svih pet ne-telefonskih svetala zelenih (nacrt, ekran, kod, server, test): Put A 15/16, Put B 12/13, Dogovor 12/13, Početna i obaveštenja 3/5, Nalog i bezbednost 8/11, Sistem 0/4 | Telefon: 37 žuto (delimično viđeno), 24 sivo (nije viđeno), 1 zeleno. **0 tokova je „gotovo"** jer „gotovo" po tvom pravilu traži dokaz na uređaju za trenutnu verziju. Crveno: A16 HITNO (izbačeno iz V1 tvojom odlukom), B05 Pretraga i filteri, P05 Podsetnik (odloženo) |
| **Server (Supabase DEV)** | 221 migracija, sertifikat zatvaranja `0579191d` (živi = overeni), 0 neuspelih cron poslova od 2880 u 24 h, 246 funkcija (173 dostupne prijavljenom korisniku), 11 Edge funkcija. **Primenjeno tvojim rečima:** danas D12 (pisani komentar, server) i ex06a (prozor „sutra / ove nedelje" za radnike); juče B24, EX-04 (lične liste), Voice B1 (glasovne poruke) | Pripremljeno, ali **NE primenjeno**: ex06b (ćirilica / IKEA nazivi u poklapanju poslova) i EX-07 S06 (ime osobe u prijavi). Nisu još ni napisani: D12a, ex06c, N10, push (jedan primalac). Svaki traži prvo zeleni CI dokaz, pa tvoje „PRIMENI <ime paketa>" |
| **Klijent (aplikacija)** | Poruke pri neuspelom prijavljivanju (šest jasnih poruka, revidirano: u redu); tab traka i ikone (talas 2, u kodu); Moji zadaci tabovi popravljeni u kodu; komentar uz ocenu napisan iza **isključene** zastavice; ime u bezbednosnoj prijavi iza isključene zastavice; zakrpa B22 (poplava zapisa u logu nestala: 2.699 → 0 neuspelih linija na HONOR-u) | Ništa od ovoga (osim B22 zakrpe i UI talasa 1) nije u APK-u koji je na uređajima; nijedna nova jedinica nema dokaz na uređaju |
| **UI/UX** | Plan 12 talasa u repou; talas 1 viđen na telefonu i emulatoru; dva nezavisna kritičara pregledala 16 snimaka emulatora (61 nalaz, deset prioriteta svaki) | Talasi 3-12; ništa nije potvrđeno tvojim očima na novoj verziji |
| **Dokumenti** | 75 tvojih odluka zapisano i povezano; pravni nacrti (15 fajlova) svedeni na ono što aplikacija zaista radi (ispravka posle revizije u toku); registar i živi plan ažurirani; predaja za Codex | Pravni nacrti čekaju podatke operatera i pravnika; nijedna rupa se ne popunjava izmišljenim podacima |
| **Dokaz / QA** | Emulator `USKOCI_V5_TEST` je svakodnevni uređaj; vozači (skripte) u repou; HONOR samo na tvoje „sad" | Probe B22 (pomeranje lista, Mapa pilula, pin) nisu pokrenute; B22 nije zatvoren; CI dokazi za šest novih jedinica **nikad nisu pokrenuti** (push ih pokreće) |

## 3. Šta je urađeno u ovoj seriji

- Tvojih 75 odluka prihvaćeno i zapisano; AGENTS.md dopunjen (osim jedne rečenice koju sistem nije dozvolio).
- 11 jedinica rada (i skripte za emulator) predato i commit-ovano, sve na nivou **koda i testova** (nijedna nije u APK-u, nijedna nije pokrenuta u CI): prijava (poruke), UI talas 2, Moji zadaci, bezbednosno ime (EX-07 S06), dokaz za povratne linkove prijave (EX-07 S03), ex06b, D12 klijent, dva dokaza za poruke (EX-05 S01, S02), dokaz za dispečer (EX-06 S04), kritika emulatora.
- Provera celog projekta posle svih izmena koda: tipovi čisti (tsc), **jest 422 od 422 paketa, 9.236 testova prošlo** (to je provera na mašini, nije CI ni uređaj).
- Samo prijava (EX-07 S02) je prošla nezavisnu reviziju. Ostale čekaju reviziju i CI; to je prvi posao Codex-a.
- 42 commit-a danas, 350 fajlova, oko +68.000 linija (uglavnom dokazi, testovi i dokumenta).

## 4. Ide li ovo ka kraju?

**Da, put je poznat, ali dugi štap nije kod nego dokaz i tvoje stavke.**
- *Što tim može da završi sam:* UI talasi 3-12 (sa ispravkama iz kritike), šest serverskih paketa (dva pripremljena, četiri još nenapisana) do nivoa „spreman za tvoje PRIMENI", glasovne poruke (snimanje i slušanje), priprema izdanja, CI i revizije.
- *Što je dugi štap:* (1) dokaz na emulatoru/telefonu po toku (0 od 62 gotovo); (2) CI dokazi za svaki serverski paket pa tvoje „PRIMENI <ime>" po paketu; (3) UI talasi ne moraju da liče na tvoj ukus dok ih ne vidiš.
- *Što samo ti možeš:* rotacija dva procurela Google ključa, produkcioni Supabase projekat (nov, odvojen), nalog i unos u Google Play (paket `rs.uskoci`), operater / domen / pravni tekstovi, odluka o iOS-u, reč za zatvaranje B22 i „sad" za HONOR.
- *Rizik koji vidim:* broj neproverenih jedinica raste brže od provere. Zato je sledeći prioritet **CI dokazi + revizija + emulator**, ne novi paketi.

## 5. Otvorena pitanja za tebe (svako ima podrazumevani odgovor)

1. Poruka za zabranjen nalog pri prijavi (privatnost): ostaje posebna ili se spaja sa „pogrešna lozinka"? Predlog: **ostaje** posebna.
2. Da li javni profil mora da prikaže komentar pre uključivanja zastavice? Predlog: **da**.
3. ex06b: „ELEKTRO i VODOINSTALATER" (ostavio sam postojeća dva reda, ništa nisam dodavao), dvanaesta vrsta posla (predlog: ne), prihvatanje gubitka „sklapanje ormara / kreveta" (predlog: prihvati).
4. Da li želiš da UI odluke U01-U19 upišemo u AGENTS.md (sistem je prvi put odbio izmenu).

## 6. Kako se nastavlja

Codex nastavlja u **istom folderu i na istoj grani**. Komanda i tekst za lepljenje: `START_PROMPT_CODEX.md` (isti folder). Prvi korak je push i čitanje CI dokaza koje push pokreće (`CODEX_HANDOFF_20261002.md`, odeljak 6.A).
