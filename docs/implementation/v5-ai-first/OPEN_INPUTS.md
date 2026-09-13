# Preostali ulazi — bez ponavljanja prihvaćenih odluka

Stanje2026-09-13. Ovo je operativni spisak otvorenih ulaza, ne proizvodna odluka ili dozvola za izvršavanje. Prihvaćeni odgovori AF-D01…14 su u EXECUTION.md i imaju prednost nad starijim RC2/HTML detaljima. Protek vremena nije odgovor.

## Pitanja već poslata vlasniku, odgovor još nije primljen

| Ključ | Poslati predlog/traženi podatak | Zašto je potreban |
| --- | --- | --- |
| Urgent | Fizički Task koji prolazi postojeću proveru; početak u narednih6h ili TODAY_FLEXIBLE; trajanje najviše60min, skraćeno početkom/response deadline-om; cilj najmanje2 podobna kad postoje, bez garancije;0RSD i postojeći quiet hours. | Novi konkretni HITNO parametri, nisu određeni ranijim ugovorom. URGENT_CONTRACT_PROPOSAL.md. |
| SupportScope | Vlasnikov autentifikovani nalog kao jedini operater privatnog testa; poslati slučajevi, postojeće safety prijave i izričito izabrani dokazi; audit pristupa, ručni odgovor/re-review. Bez automatskog čitanja cele prepiske, Gemini svrhe ili novih sankcija. | Novi konkretni primaoci i ovlašćenja operativne podrške. SUPPORT_CASE_CONTRACT_PROPOSAL.md. |
| SupportLimits | Naslov200, opis/odgovor/žalba4000, traženi ishod1000 znakova;5 novih+50 dopuna/rolling24h,60s između običnih novih slučajeva, jedna otvorena žalba po odluci. Safety/prava/privatnost nisu pod tim kvotama. | Nove brojčane granice obične podrške. |
| TestAccounts | Da li su sva3 postojeća naloga pod vlasnikovom kontrolom i koja2 su R/W; tražena imena/email, bez lozinki/ključeva. Objašnjeno da objavu vidi sva authenticated publika projekta. | Precizan obim narednog live testa; AI allowlist i privatni APK nisu izolacija marketplace-a. Ovo pitanje samo ne odobrava live batch. |
| PrivatePhotos | Do6 po privatnoj/grupnoj poruci, do12 novih fotografija po nalogu/24h, ulaz10MB, uklanjanje metapodataka/1600px, postojeći privatni Storage i postojeća membership/block/evidence pravila; bez Gemini slanja. | Nova svrha privatnih priloga i njihove kvote. AF-D07/09 za Task/avatar ostaju već odobrene; ovo ih ne pita ponovo. |
| AuthMethods | Koje dodatne Google/Apple/SMS načine vlasnik želi da aktivira i postoje li njegovi OAuth/Developer/SMS nalozi; bez ključeva u četu. Stvarni settings13.09.02:19UTC: email=true/confirmation required, phone/google/apple=false. | V5§9 zahteva odluku i konfiguraciju nedostajućih načina. Gemini odobrenje nije Auth provider/trošak odobrenje. SMS klijent postoji; OAuth klijent/callback nedostaje. |

## Konkretni preostali ulazi koji još nisu odabrani/aktivirani

- Identitet: stvarni metod/provider, eligibility neregistrovanog operatera, tačan dokument/selfi/biometrija/privacy scope i zaseban trošak. IDENTITY_ACTIVATION_OPTIONS.md sadrži proverene opcije, ne izbor. Sandbox ne daje javni verified bedž i ne dokazuje stvarnu verifikaciju.
- Vozila: dodatni opcioni samoprijavljeni kg/sedišta za konkretan resurs; broj resursa, granice i dozvoljeni potrošač. Postojeći vehicles/teamCapacity se zadržavaju; sedišta nisu teamCapacity niti potvrda licence. RICH_MEDIA_IDENTITY_DECISIONS.md.
- Retention V1: stvarne svrhe, događaji početka, rokovi, delete/anonymize/ograničeno-zadržavanje akcije, hold/evidence release i odgovornosti; finalna Privacy/source/review veza. RC2 sadržaj je pronađen i pročitan; nije potrebno ponovo tražiti njegovu lokaciju. RETENTION_ACTIVATION_GAPS.md razdvaja ove ulaze od nezavršenog inženjerskog posla.
- Operater i javni pravni sadržaj: vlasnik je izričito rekao da operater još nije registrovan. Ne izmišljati firmu, adresu, broj, email ili counsel potpis. Ne ponavljati pitanje da li je registrovan bez novog konteksta. Izbor buduće forme/pravne objave ostaje stvaran ulaz.
- Ostali privatni mediji: audio/video/datoteke i direktni safety/support upload nisu odobreni fotografskim Task limitom ili prolaznim AI hold-to-talk audio tokom. Potreban je konkretan ugovor nove svrhe/tipova kada se aktiviraju.
- Live batch: pregledani tačan commit/tree, SQL/Edge hash-evi i podešavanja, policy/backfill/scheduler efekti, konkretni nalozi/publika i probe. LIVE_BATCH_CANDIDATE je priprema; odobrenje nije primljeno. Plaćeni provider i destruktivni worker-i nisu uključeni.

Tehničke ispravke, review, lokalni build i disposable provere poznatih ugovora nastavljaju se bez ponovnog pitanja. Nijedna otvorena stavka nije samovoljno izbačena iz punog V5 obima.
