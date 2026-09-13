# Preostali ulazi — bez ponavljanja prihvaćenih odluka

Stanje2026-09-13. Ovo je operativni spisak otvorenih ulaza, ne proizvodna odluka ili dozvola za izvršavanje. Prihvaćeni odgovori AF-D01…18 su u EXECUTION.md i imaju prednost nad starijim RC2/HTML detaljima. Protek vremena nije odgovor.

## Pitanja već poslata vlasniku, odgovor još nije primljen

| Ključ | Poslati predlog/traženi podatak | Zašto je potreban |
| --- | --- | --- |
| Urgent | Fizički Task koji prolazi postojeću proveru; početak u narednih6h ili TODAY_FLEXIBLE; trajanje najviše60min, skraćeno početkom/response deadline-om; cilj najmanje2 podobna kad postoje, bez garancije;0RSD i postojeći quiet hours. | Novi konkretni HITNO parametri, nisu određeni ranijim ugovorom. URGENT_CONTRACT_PROPOSAL.md. |
| TestAccounts | Vlasnik je naveo prvi nalog i tri kandidata za drugi. Read-only provera potvrdila je samo prvi postojeći nalog; ostale tri tačne adrese nisu pronađene. Potvrda kontrole nad ostalim postojećim nalozima nije primljena. Adrese nisu unesene u javni repozitorijum. | Precizan obim narednog live testa; AI allowlist i privatni APK nisu izolacija marketplace-a. Ovo pitanje samo ne odobrava live batch. |
| PrivatePhotos | Do6 po privatnoj/grupnoj poruci, do12 novih fotografija po nalogu/24h, ulaz10MB, uklanjanje metapodataka/1600px, postojeći privatni Storage i postojeća membership/block/evidence pravila; bez Gemini slanja. | Nova svrha privatnih priloga i njihove kvote. AF-D07/09 za Task/avatar ostaju već odobrene; ovo ih ne pita ponovo. |

## Odgovoreno u nastavku, ne pitati ponovo

- AF-D15 UnknownAiExit: vlasnik je odobrio odustajanje uz zadržanu potrošnju; candidate142 i native implementacija su završeni u lokalnom izvoru. Stvarne izolovane SQL provere i odobrenje konkretnog live paketa još nedostaju.
- AF-D16 AuthMethods: za sada samo email, bez aktivacije Google/Apple/SMS i bez novih naloga/troškova. To je izričito privremena vlasnička odluka; ne uklanja te mogućnosti iz budućeg obima.
- AF-D17 SupportLimits: prihvaćeni200/4000/1000 znakova,5 novih i50 dopuna po nalogu/rolling24h,60s između običnih novih zahteva, jedna otvorena žalba po odluci; safety/prava/privatnost izuzeti iz tih kvota.
- AF-D18 SupportScope: vlasnik prihvata jedini operaterski pristup za privatni test preko svog prijavljenog naloga, audit pristupa, poslati sadržaj/safety/izabrani dokazi, ručne odgovore i ponovni pregled; bez celog chata, Gemini obrade i novih sankcija. SQL, native tokovi i gateway su povezani u lokalnom izvoru; stvarne izolovane SQL/Storage provere čekaju. Grant i live batch nisu aktivirani.
- SupabasePanelAccess: vlasnik se prijavio. Read-only panel je pokazao postojeći GEMINI_API_KEY digest; poređenje u memoriji sa ključem iz plaćenog Uskoci-clean projekta705329837232/gen-lang-client-0693119686 se poklopilo. Posle greške root filtera ključ je prikazan u izlazu alata; vlasnik je odmah obavešten i izričito izabrao nastavak sa istim ključem umesto zamene. Ne pitati zamenu ponovo; vrednost se ne ponavlja niti unosi u repozitorijum. Nije bilo provider poziva, clipboard-a ili key fajla. Provera veze ne dokazuje model pristup niti odobrenje konkretne plaćene probe/live batch-a.

## Konkretni preostali ulazi koji još nisu odabrani/aktivirani

- Identitet: stvarni metod/provider, eligibility neregistrovanog operatera, tačan dokument/selfi/biometrija/privacy scope i zaseban trošak. IDENTITY_ACTIVATION_OPTIONS.md sadrži proverene opcije, ne izbor. Sandbox ne daje javni verified bedž i ne dokazuje stvarnu verifikaciju.
- Vozila: dodatni opcioni samoprijavljeni kg/sedišta za konkretan resurs; broj resursa, granice i dozvoljeni potrošač. Postojeći vehicles/teamCapacity se zadržavaju; sedišta nisu teamCapacity niti potvrda licence. RICH_MEDIA_IDENTITY_DECISIONS.md.
- Retention V1: stvarne svrhe, događaji početka, rokovi, delete/anonymize/ograničeno-zadržavanje akcije, hold/evidence release i odgovornosti; finalna Privacy/source/review veza. RC2 sadržaj je pronađen i pročitan; nije potrebno ponovo tražiti njegovu lokaciju. RETENTION_ACTIVATION_GAPS.md razdvaja ove ulaze od nezavršenog inženjerskog posla.
- Operater i javni pravni sadržaj: vlasnik je izričito rekao da operater još nije registrovan. Ne izmišljati firmu, adresu, broj, email ili counsel potpis. Ne ponavljati pitanje da li je registrovan bez novog konteksta. Izbor buduće forme/pravne objave ostaje stvaran ulaz.
- Ostali privatni mediji: audio/video/datoteke i direktni safety/support upload nisu odobreni fotografskim Task limitom ili prolaznim AI hold-to-talk audio tokom. Potreban je konkretan ugovor nove svrhe/tipova kada se aktiviraju.
- Live batch: pregledani tačan commit/tree, SQL/Edge hash-evi i podešavanja, policy/backfill/scheduler efekti, konkretni nalozi/publika i probe. LIVE_BATCH_CANDIDATE je priprema; odobrenje nije primljeno. Plaćeni provider i destruktivni worker-i nisu uključeni.

Tehničke ispravke, review, lokalni build i disposable provere poznatih ugovora nastavljaju se bez ponovnog pitanja. Nijedna otvorena stavka nije samovoljno izbačena iz punog V5 obima.
