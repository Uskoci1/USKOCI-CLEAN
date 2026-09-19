# USKOČI — komanda za izvršavanje plana

Ovo je nastavak postojećeg USKOČI proizvoda, ne greenfield i ne design-only zadatak.
Pročitaj `USKOCI_MASTER_PLAN_2026-09-08.md`, `USKOCI_RADNI_PAKETI.json`,
`USKOCI_SURFACE_MASTER.json` i `USKOCI_PROVERE_I_IZVORI.json`.

## Polazna tačka

Repo `Uskoci1/USKOCI-CLEAN`, canonical `clean-alpha-backend`.
Poslednji read-only HEAD pri pisanju plana: `80572f53d6915ae6ff0c442053b61524d92c666e`.
Live project `leqcwgzvjsxugfgzdmth`: u tom snimku 87 migracija, head `20260907135905`.
Ovo su tragovi za proveru, ne komanda da se stanje vrati unazad ili da broj mora zauvek ostati 87/93.
Ne diraj legacy workspace. Ne menjaj originalni logo i brend novim generičkim AI assetima.

## Cilj

Završi postojeće funkcije od stvarnog ulaza do stvarnog korisničkog ishoda:
AI i ručni unos → potvrđeni podaci → Zadatak/profil → matching → obaveštenje
→ Prijava → izbor → Dogovor → poruke/izmene → završetak → ocena.
Završi i podršku, sigurnost, dostupnost/kalendar, nalog/podatke, HITNO i odobreni
monetizacioni scope uz efektivnu platformsku cenu 0 RSD.

## Način rada

1. Jednom uradi relevantan preflight i popuni stvarne razlike u registru, pa implementiraj.
2. W00 konsoliduje PR-ove i deployment manifest. Proveri #77–#79 i ranije kandidate;
   ne ponavljaj već završen posao i ne spajaj konfliktne promene naslepo.
3. W01 započinje pravi dizajn-sistem, originalni entry, tri-zone shell i auth/recovery.
   Dizajn se nastavlja uz svaki sledeći paket; W13 je završno ujednačavanje.
4. W02 uvodi usklađene zahteve/lokaciju/dostupnost i autoritet zauzetosti pre finalne selekcije.
5. W03/W04 završavaju stvarni AI Need i AI/ručni profil, potvrdu i sve relevantne upise.
6. W05 završava safety/publication/Q&A granice; W06/W07 discovery/matching/push;
   W08/W09 Prijavu/izbor/Dogovor; W10 reputaciju; W11 nalog i operacije;
   W12 HITNO i billing granice; W13 izdanje. Poštuj zavisnosti iz JSON-a.
7. Kada je legal/provider aktivacija blokirana, završi nezavisan tehnički posao i
   testiraj izolovano. Obeleži tačno šta nedostaje. Ne ubacuj izmišljena odobrenja.
8. Troši glavninu rada na kod, povezivanje i stvarne ekrane. Testiraj proporcionalno
   riziku. Ne ponavljaj ceo istorijski proof na svaku promenu dokumentacije.
9. Jedan vlasnik upravlja canonical integracijom i produkcijskim deploy-om.
   Nema paralelnih pisaca istog manifest/shared ugovora bez koordinacije.

## Nepromenljive granice

Jedan nalog, dve namere.
MENI TREBA: Zadaci | U / Novi | Dogovori.
JA MOGU: Prijave | U / Zadaci | Dogovori.
Zvonce → Inbox; avatar → Profil; Lista/Mapa u Zadacima.
Dogovor ima tačno Pregled | Poruke. Ne vraćaj R01/W01 Home tabove.
Za kratke radnje koristi kontekstni panel; ne pravi novi ekran za svaki RPC.
Originalni logo/naziv na ulazu su veliki, centralni malo iznad sredine,
bez odletanja u gornji levi ugao. Ispod: „Meni treba. Ja mogu.“.
AI predlaže; čovek potvrđuje; server validira i odlučuje o poslovnom upisu.
Ne izmišljaj veštine, adrese, naknade, licence, ocene ili verified bedževe.
Ne menja se istorijski snapshot Prijave kada korisnik izmeni profil.
Bez duplih komandi, lažnog uspeha, curenja privatnih podataka ili demonstracione
baze koja se neprimetno prikazuje kao živa.
Naplatna infrastruktura ne daje dozvolu za pozitivnu naplatu. Cena platforme ostaje 0 RSD.

## Deployment i bezbednost

Primenjene migracije su immutable. Nove su forward-only, sa tačnim zavisnostima.
Zbog istorijskih timestamp/provenance razlika ne radi db push naslepo.
Jedan dokazani deployment mehanizam evidentira istoriju. Ne dodaj ručno isti
history red koji deployment alat već upisuje. Preflight, rehearsal i postflight su obavezni.
Ovaj dokument sam ne ovlašćuje produkcijsku promociju; poštuj postojeći approval proces.
Proveri RLS i grants zajedno sa SECURITY DEFINER i API exposure putanjama.
Ne proglašavaj curenje samo zbog RLS=false; ne proglašavaj sigurnost samo zbog zatvorene tabele.
Provider ključevi ostaju van klijenta i logova. Test/demonstracioni podaci ostaju označeni.

## Izveštaj po zaokruženoj celini

Navedi: šta korisnik sada može; tačan commit/PR; migracije i okruženje;
koji UI i client su povezani; šta je stvarno dokazano i na kom uređaju;
šta je blokirano; tačan sledeći nedovršeni posao.
Ne poistovećuj napisano, merge-ovano, deploy-ovano, aktivirano i dokazano.
Ne daj procenat cele aplikacije bez merljive osnove.
Ne tvrdi da nastavljaš sam u pozadini nakon završenog odgovora.
