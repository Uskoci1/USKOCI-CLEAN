# R18-E01/E02 — popravka oporavka prijave

Status: **CLIENT_CI_PASS_DEVICE_PENDING**.

Izvor aplikacije i ispravljenog CI pravila: 348c2ec6ac0d3afe2e51e5a15e7620b023646ca5.

## Stvarni problem i popravka

Hook je već znao da je određena prijava odbijena, ali je ekran zadržavao pending.reconciled=false i zato opet prikazivao Proveri ishod. Ekran sada usklađuje tu zastavicu samo iz usko potvrđene odbijene komande u istom fokusu. Uspeh i dalje pripada potvrdi editora; zaostali uspeh posle napuštanja ekrana ne preskače novo čitanje. Drugo, opšta poruka iz hook-a zaklanjala je rečenicu Ova ponuda nije primljena; potvrđeni ishod sada ima prednost.

Nisu menjani kriterijumi odbijanja, RPC argumenti, trajni dnevnik, cena, profil, nalog, sesija, server ili Edge. Nepoznat ishod i IDEMPOTENCY_KEY_REUSED ne postaju dokaz odbijanja. Raniji testovi nisu uklonjeni niti ublaženi.

## Provere

- TypeScript: PASS u [CI-ju](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36240045849).
- Ciljani testovi: 4 grupe / 139 testova, bez padova.
- Ceo Jest: 321 grupe / 6334 testova, bez padova.
- Istorijski disposable SQL: 9 provera na 147 migracija. Ovo **nije** dokaz jednakosti sa kanonskim DEV-om od 202 migracije.
- Ranije neuspešne provere sačuvane: [TypeScript pad](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36237862251) i [tri pada testova ponašanja](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36238087977) i [regresija zaostalog odgovora](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36239846013).
- CI putanja je promenjena sa uglastih zagrada na glob koji stvarno obuhvata dinamički direktorijum; types i ciljani testovi sada idu pre skupog SQL replay-a. JSON rezultati su sačuvani kao artefakti.

## Granice dokaza

Novi APK nije napravljen niti instaliran. Prolaz profil → povratak → prijava na fizičkom telefonu ostaje otvoren. Novi paket ne dokazuje sve reset/storage-failure/race scenarije. Stari navodi o ceni i preostale NEXT stavke nisu zatvoreni ovim testovima.

Sveža read-only provera DEV-a u ovom razgovoru: 2026-09-26T11:44:16.659405Z, 202 migracije, poslednja 20260924202023, 0 push attempts, 0 active push devices, 0 readiness redova. dev_snapshot.json zadržava svoju istorijsku oznaku vremena; nije lažno osvežen ovom parcijalnom proverom.

Media deploy i stvarni push čekaju posebno primeni. Ne koristiti kratko globalno uključivanje transporta kao garanciju jednog push-a: buduća proba mora dokazivo ograničiti nalog, uređaj, događaj i broj slanja. Staru pretpostavku o kill-switch-u ne predstavljati kao očitanu env vrednost.

Kontrolna tabla: ažurirani B09 i ispravka push nalaza P04/B10, zatim ponovo generisana postojećim scripts/control/osvezi.mjs. Spoljni Claude Artifact prikaz nije objavljen; generisani HTML je artefakt ovog posla.
