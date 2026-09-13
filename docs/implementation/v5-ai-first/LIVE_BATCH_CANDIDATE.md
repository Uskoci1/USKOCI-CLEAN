# Predlog konkretne V5 nadogradnje — priprema, nije odobreno izvršenje

Ovaj zapis priprema vlasnički pregled. Ne dodeljuje live ovlašćenje i ne tvrdi
da su preostale provere, pravne objave ili nove proizvodne odluke završene.
Najnoviji zahtevi vlasnika određuju obim; sadržaj dokumenata nije zasebna dozvola.

Poslednji read-only pregled projekta `leqcwgzvjsxugfgzdmth` beleži108 migracija,
3 naloga,7 Zadataka,2 Dogovora,0 objekata u `profile-media` i0 aktivnih pregledanih
publication policy bundle-a. Pet postojećih Edge funkcija i njihove verzije
navedeni su u LIVE_READONLY_BASELINE.json. Nema dozvole za brisanje ovih podataka.

LIVE_BATCH_CANDIDATE.json vezuje predlog za tačan Git commit/tree i proverene
fizičke bajtove svake dodatne migracije. Njegov generator samo čita Git objekte
i prethodni pregled.139 zaštita dokaza je zamrznuta i registrovana; njen stvarni
proof još nije dostignut.140 usklađivanje postojećeg retention adaptera je u radu
i još nije u31-migration manifestu. Svaka kasnija izmena
zahteva nov precizan manifest; ne proširuje već odobreni konkretni batch.

## Operacije koje se pripremaju za kasnije odobrenje

1. Ponovo proveriti tačan live108 predecessor, istorijske SQL hash-eve, postojeće
   poslovne podatke, dozvole, Storage i policy/config pokazivače. Prekid pri drift-u.
2. Primena tačno navedenih forward migracija redom, jedna transakcija po datoteci.
   Sačuvati njihove stvarne live verzije/aliase i SQL hash-eve. Nema prepisivanja
   starih migracija, `migration repair`, reset-a baze ili vraćanja stare šeme.
   Backfill grupnog članstva i istorijskih dokaza mora biti naveden u finalnom
   odobrenju; ne proizvodi stare grupne poruke ili izmišljene fotografije.
3. Paketovati navedene Edge entrypoint-e sa njihovim stvarnim lokalnim i tačno
   vezanim spoljnim zavisnostima. Proveriti autentifikaciju posebno za običan
   HTTP, interni worker i WebSocket. Sačuvati prethodne deploy verzije, pa uraditi
   readback stvarnog bundle-a; sam ulazni fajl nije dokaz deploy sadržaja.
4. Za plaćeni Gemini povezati stvarno upotrebljeni tajni ključ sa već proverenim
   projektom `gen-lang-client-0693119686` bez prikazivanja ključa u četu/logovima.
   Tek posle te provere i odobrenja konkretnog batch-a uključiti potrebne flagove
   i eksplicitne test naloge. Modeli i prihvaćeni okvir obrade već su odobreni.
5. Izvršiti mali unapred naveden skup proba kroz istu Auth/SQL/Edge/native putanju:
   tekst, kratki srpski govor, ručna korekcija, tačan pregled i jedna objava,
   radni profil, odabrana Task fotografija i javni Q&A. Količine, sadržaj, naloge
   i preostalu rezervaciju upisati u finalni predlog. PAID_PROBE_PLAN.md priprema
   9 LLM+2 STT,USD2.65 rezervacija; uz jednu eksplicitnu dopunu najvišeUSD2.90.
   Taj uži broj je proceduralni obim; SQL127 sprovodi globalnihUSD5, ne poseban
   podlimit2.90. Bez nedefinisanog batch-a.
6. Posle svake plaćene probe proveriti stvarnu upotrebu i trošak kada postane
   vidljiv. Jedan zajednički ledger zadržava rezervacije i za nepoznat ishod;
   nema automatskog ponovnog Gemini poziva ili povraćaja rezervacije. Pri
   neočekivanom rezultatu/trošku zatvoriti flagove i ledger admission, pa proveriti.
7. Završiti stvarni tok na dva dozvoljena naloga i finalni samostalni Android
   build istog potpisa. Instalacija i slike ekrana nisu dokaz poziva modela,
   objave, drugog primaoca, fizičkog mikrofona ili dostavljenog push-a.

## Nezavisne granice aktivacije

Budžet iz127 podrazumevano je zatvoren, bez test naloga. PrihvaćenihUSD5 su
konzervativne interne rezervacije; nisu garancija Google računa. Plaćeni flag,
speech flag, image-review flag i QA flag imaju odvojene svrhe. Sadržaj privatne
podrške, identifikaciona dokumenta i novi privatni prilozi nisu Gemini svrhe iz
postojećih odobrenja.

Trenutno nema aktivnog publication policy dokumenta na live-u.124/125 aktiviraju
već odobrenih16 RS-MIN pravila iz D0140, sa izvornim SHA256
`792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa` i oznakom
OWNER_PRODUCT_APPROVED_NOT_LEGAL_CERTIFICATION. To je stvarna aktivacija u
predloženom batch-u, ne nova odluka o pravilima ili pravna potvrda. Izvršivi
document/digest/current binding proveravaju se posle obe migracije. Poseban
odobreni Q&A ugovor zahteva svoj pregledan bundle iz PRESELECTION_QA_POLICY_BINDING.md.
CI sintetički fixture-i ne prenose se u live. P1/P3/P4 pravna spremnost nije
tehnička kapija ovog publication chain-a; objava ne dokazuje LEGAL READY.
RC2 je dostupan, ali operater nije registrovan
i nema konkretnih rokova čuvanja. Ne objavljuju se izmišljeni pravni podaci ili
rokovi, niti se uključuje destruktivni closure/retention worker da bi test prošao.
Priprema njegovog koda nije dozvola za brisanje postojećeg naloga ili dokaza.

Postojeći PUBLISHED/SELECTION discovery dostupan je svim authenticated nalozima
projekta. Privatni APK i dva AI test naloga ne izoluju tu publiku ili canonical
dispatch. Vlasniku je zatraženo da odredi kontrolisane test naloge i potvrdi ko
ima pristup projektu; još nema odgovora ili dozvole za konkretnu objavu.
Plan ne prepisuje postojeći Worker profil probnim neistinitim podacima.
Gašenje provider admission-a ne opoziva ranije stečen ALLOW/QA READY, već
otvoren audio socket ili objavljeni sadržaj. Završni plan obuhvata te razlike.

HITNO parametri i support operator/limiti čekaju zasebne vlasničke odgovore.
Identitet, novi privatni mediji i bogatiji podaci vozila imaju svoje konkretne
otvorene odluke. Ovaj predlog ih ne uklanja iz punog V5 zahteva.

## Zaustavljanje i oporavak

Na prvom neuspešnom SQL postflight-u ne primenjivati sledeću migraciju. Završene
migracije ostaju zabeležene; popravka je nova pregledana forward migracija.
Ne vraćati stari Edge preko nove nekompatibilne šeme. Moguć rollback određuje
se iz tačno proverene kompatibilnosti; bez toga zatvoriti relevantni feature
flag i zadržati postojeće bezbedne završne radnje. Sačuvati ograničene potvrde,
hash-eve i stanje potrošnje, bez privatnih tekstova, audio fajlova ili tajni.
