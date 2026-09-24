# USKOČI — izveštaj za 24. 9. 2026 (rad u oblaku)

Grana: `work/uskoci-ui-unification-20260924`. Sve je na GitHubu; u `main` ništa nije spojeno. Server (Supabase DEV)
danas nije menjan: rađena je samo aplikacija.

Nastavak za bilo kog agenta (Claude Code ili Codex): `AGENTS.md` → `cloud-handoff/README.md`, odeljak „Current head“.

## 1. Šta je urađeno danas

Sve je u kodu i prolazi testove, ali **ništa od ovoga još nije viđeno na emulatoru ni telefonu**.

| Deo | Šta |
| --- | --- |
| Round 5c | Sitne ispravke iz provera u pet oblasti: profil (tastatura, fotografija), kalendar (kopiranje dana, čitač ekrana), obaveštenja (filter, pristupačnost), privatnost i podrška (spinner na pravom dugmetu, izvoz), Dogovori/ponude/Moje prijave. |
| Odluke vlasnika 1–7 | „Mogu odmah“ se čuva odmah; bez veština kandidata u ponudi; izvoz: „Ova kopija se ne može sačuvati.“; bez reči „server“; slike samo u detalju zadatka; geokoder i plaćanja kasnije. |
| Zadaci (Discovery V47) | Model kao Airbnb, izgled USKOČI: polje pretrage na mapi, pretraga po koracima (Gde, Kada sa kalendarom, Kako se radi, Koliko vas dolazi, Cena), brzi filteri, lista prati mapu, zadaci bez tačke ne nestaju, jedna kartica pina, dugme „Mapa“, pamćenje stanja. Tri nezavisna pregleda, 21 ispravka. |
| Round 6 | Slanje ponude kao korak plaćanja; ocena saradnje (osoba prva); pregled pre objave, mesto zadatka, fotografije; pitanja i odgovori, izmene i otkazivanje Dogovora, deljenje lokacije, grupni razgovor. Rađeno u tri paralelne sesije, svaka sa tri pregleda. Izveštaji: `r6-prijava/`, `r6-objava/`, `r6-dogovor-dodaci/`. |
| Sitnice | Jedno dugme za brisanje filtera svuda: „Obriši uslove“. |

**Provera:** tipovi čisti; ceo Jest 302 grupe / 5.882 testa; na GitHubu zeleno PKG-004, 005, 006, 007, 008, 010,
042, 046, 050; APK za emulator: run `36038648243`, artefakt `USKOCI-DEV-APK`.

## 2. Odluke vlasnika (večeras)

| # | Pitanje | Odluka | Stanje |
| --- | --- | --- | --- |
| 1 | „U blizini“ (lokacija telefona za mapu) | Da, odmah | nije urađeno |
| 2 | Deljenje lokacije u Dogovoru | Izbaciti „Trenutnu lokaciju“; tačna adresa ostaje | nije urađeno |
| 3 | Pisani komentar uz ocenu | Da | traži serverski paket; na DEV tek na „primeni“ |
| 4 | Kvačica pri čuvanju mesta | Izbaciti; „Sačuvaj mesto“ je potvrda | nije urađeno |
| 5 | Prošli posebni datumi | Ne brišu se sami | ništa ne treba menjati |
| 6 | Tempo zbog nedeljnog limita | bez odgovora | — |

Plaćanja: aplikacija ostaje besplatna; kasnije plaćeni dodaci kroz ažuriranje (Google Play naplata, npr. RevenueCat,
i/ili „USKOČI kredit“ na sajtu sa DinaCard/Visa). Cenovnik na 0 RSD (PKG-051) radi tvoja lokalna sesija.

## 3. Šta nije urađeno

1. Pregled na emulatoru za sve današnje ekrane (tvoj računar ili lokalna sesija).
2. Večerašnje odluke 1–4 iz tabele.
3. Provera celog app-a: 181 nalaz (`r6-sweep/FINDINGS.json`), od toga 24 ozbiljna (22 potvrđena, 2 neproverena),
   ostalih 157 neprovereno. Nijedan još nije ispravljen.
4. Serverske stvari iz kontrolne table: obaveštenja na telefon isključena, podsetnik pred termin, koraci napretka
   Dogovora, HITNO, serversko filtriranje i straničenje, dokaz da mejl za potvrdu stiže.
5. Za javnu objavu (tvoje): Play Console, produkciona baza, pravni dokumenti, praćenje padova, zatvoreni test
   (12 testera / 14 dana), model plaćanja.

Kontrolna tabla u repou (`docs/control`) je dopunjena za 23 reda. Nijedan od 62 koraka nije „gotov“ po pravilu
vlasnika, jer za trenutni build nema dokaza sa telefona.

## 4. Kako da preuzmeš na svoj računar

```
git fetch origin
git checkout work/uskoci-ui-unification-20260924
git pull
npm ci
```

Lokalna sesija koja radi PKG-051 treba pre svog push-a da spoji granu sa GitHuba (`git merge
origin/work/uskoci-ui-unification-20260924`), bez rebase i bez force push-a.

## 5. Preporučen redosled za Codex

1. Pregled APK-a na emulatoru i ispravke onoga što se vidi.
2. Odluke 4 (kvačica) i 2 („Trenutna lokacija“): male, samo aplikacija.
3. Odluka 1 („U blizini“): nova biblioteka `expo-location`, odobrena.
4. Ozbiljni nalazi iz provere celog app-a, pa ostali.
5. Odluka 3 (komentar uz ocenu): prvo serverski paket i dokaz, pa tvoje „primeni“, pa ekran.
