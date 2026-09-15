# AF-D22 adapter146: postojeći closure sa stvarnom redakcijom

Status: source kandidat, bez izvršenog146 SQL/hosted dokaza. Nije pravna potvrda, retention politika niti odluka o novom roku. Okidač je izričit owner closure događaj, `OWNER_AF_D22_EVENT_ERASURE_V1`, provenance `OWNER_AF_D22`, `legalPolicyAttested:false`.

Postojeći Auth/session, closure request/revision, opaque client key, generation/attempt, Storage i Auth potvrde ostaju autoriteti. Nova privatna evidencija nema narativ ni originalni payload. Klijent i dalje čuva samo postojeći opaque closure intent.

## RPC i redosled

Postojeći potpisi `rpc_review_account_closure_execution`, `rpc_start_account_closure_execution`, `rpc_read_account_closure_execution`, claim/dispatch/complete/finalize ostaju isti. Novi service-only poziv:

`rpc_redact_account_closure_step_service(p_account_id uuid, p_generation uuid, p_action_id uuid, p_attempt_id uuid)`

Svaki poziv obrađuje najviše100 redova jedne unapred određene relacije. Vraća tačno:

```ts
{
  accountId, generation, actionId, attemptId,
  kind: 'RELATIONAL_REDACT', state: 'DISPATCHED' | 'VERIFIED',
  rowsChanged, completedSteps, totalSteps, authoritative: true
}
```

`VERIFIED` važi tek kada su sve relacije pozitivno proverene. Izgubljen odgovor ponavlja isti generation/action/attempt, bez novog spoljnog DELETE. Worker ne može ručno potvrditi relacione korake kroz stari external-complete RPC.

1. Serijalizovati Support operator barrier → account closure → retention; zadržati aktivan posao, account-wide hold i nepoznate proizvođače kao prepreke.
2. Pozitivno potvrditi odsustvo svakog običnog owned Storage objekta. Nepoznati prethodni DELETE dobija samo proveru stanja.
3. Izvršiti ograničene relacione korake. Tačan PID/transaction/old-row hash/patch sertifikat omogućuje samo taj server-owned red kroz originalne immutable/domain triggere. Nema client flag-a, proizvoljnog SQL-a, isključenja triggera ili izmene FK autoriteta.
4. Ponovo proveriti novo dostupne odložene redove i scoped exceptions. Auth ostaje netaknut dok postoji izuzetak.
5. Tek zatim postojeći Auth soft-erasure poziv, provera metadata/session odsustva i kanonski CLOSED.

## Iskrene potvrde

Novi review dodaje `adapterVersion`, `exceptions`, `relationalAction:'ERASE_ORDINARY_PERSONAL_CONTENT'`; `retainedDatasets:null` ne izmišlja rokove. Media action je `DELETE_UNPROTECTED_OWNED_OBJECTS`. `ready:true` uz scoped exceptions dozvoljava obično delimično brisanje, ne završni Auth/CLOSED.

Novi EXECUTING progress ima tačno11 polja: `accountId`, `requestId`, `generation`, `state`, `policySha256`, `adapterVersion`, `ordinaryContentErased`, `completedSteps`, `totalSteps`, `exceptions`, `authoritative`.

Claim vraća `{kind:'EXCEPTIONS_PENDING',progress}` tek kada su ordinary koraci završeni, a Auth još nije dozvoljen. Razlozi su ograničeni na `SCOPED_EVIDENCE_REVIEW_REQUIRED`, `MEDIA_EVIDENCE_REVIEW_REQUIRED`, `HISTORY_ATTRIBUTION_REVIEW_REQUIRED`, `SHARED_DECISION_REVIEW_REQUIRED`. Bez tuđeg case ID-a, sadržaja ili izmišljene trajne zabrane. Dijalogu je dostupan postojeći Support izlaz; novi narativi moraju prestati na stvarnoj Auth dispatch granici. Read/cancel/recovery ostaju zasebni.

Novi CLOSED zadržava prethodnih11 polja, menja `relationalOutcome` na `ORDINARY_PERSONAL_CONTENT_ERASED`, `retainedDatasets:[]` i dodaje `adapterVersion`, `pseudonymousAuditRetained:true`, `exceptions:[]`. Tehnički ID-jevi ostaju minimalna povezana evidencija; rezultat ne tvrdi hard brisanje Auth subject-a. Stare receipt forme se strogo dekodiraju i ostaju nepromenjene.

Exact start replay proverava account/key/input hash i vraća sačuvanu metadata potvrdu čak i posle Auth erasure. Samo novi start zahteva još živu human session.

## Kopije, izuzeci i seal

Fiksni ordinary roster uklanja identifikatore profila/mirror-a, tekst poruka/fakata, tačnu geografiju, podatke review/candidate/receipt kopija i verifikovanog izvoza. State/NULL CHECK odnosi ostaju tačni. Export pointer se oslobađa pre brisanja njegovog artifact reda; self-FK ispravke se razvezuju kroz sve batch-eve pre brisanja referenciranog reda. Samo tačno izvedeni `needs.approx_geog` prati brisanje svojih koordinata i ima proveru završnog NULL-a.

Agreement `scope_note` nasleđuje autora tog polja kroz verzije; price-only proposer ne postaje autor tuđeg teksta. Minimalna identifikatorska mapa se snima pre promene hash/kopija i koristi i pri sledećem owner closure. Nejasno poreklo je scoped exception.

Namerno izdvojeni Support/safety/hold podaci ostaju stvarni izuzeci: uključuju operatorov sopstveni narativ u tuđem slučaju i njegov izvorni tekst sačuvan u tuđem izričito odabranom snapshot-u. To ne opravdava čuvanje svih nepovezanih podataka naloga.144 Agreement photo Storage guard dobija isti tačan AF22 object-scope predicate kao planer; legacy any-hold branch ostaje nepromenjen.

145 normalizovani retention source pin: `9da5b89c314e6a04b7ec48a16778eed2`.146 proverava trenutni dynamic source i sve postojeće trigger definicije, proširuje45 helper potpisa na72, dodaje tačnu funkcijsku metadata/ACL/RLS proveru i veže novi source SHA. P3 kandidat ne dobija nove relacije/FK ili širi purge opseg. Stare policy binding vrednosti postaju stale; nema automatske pravne aktivacije.

Closure katalog dodaje certificate/steps/field-attribution evidencije u `COMMAND_LEDGERS`; globalni technical source singleton nema lični sadržaj. Izvoz50→51 dodaje samo own `ownErasureSteps` (`generation`, `ordinal`, `state`, `rowsChanged`, `verifiedAt`), `OWN_ACCOUNT_V5_8`. Prethodnih50 projekcija ne širi tuđi sadržaj.

## Provera

Fokusirani worker/client/UI/source testovi su lokalni dokaz ugovora. `v5_account_erasure_proof.mjs` koristi stvarni disposable Auth/PostgREST/Storage/Postgres i eksplicitno označene istorijske fixture redove, bez provider poziva ili policy aktivacije. Njegov PASS može se prijaviti tek posle stvarnog source-bound izvršenja; samo napisani dokaz nije PASS.

Poznata konzervativna granica: trusted105 hold writer može postaviti novi scoped hold nakon146 start inventara, a pre Storage dispatch-a.139 tada beleži tačan evidence reference; dispatch vraća `CLOSURE_SCOPED_EXCEPTION`, postojeća radnja ostaje `PENDING` i unrelated relational koraci čekaju. Nema brisanja zaštićenog objekta, lažne `OBJECT_ABSENT` potvrde ili false `CLOSED`, ali automatski nastavak običnog brisanja u tom naknadnom interleaving-u nije završen. Po rootovoj odluci ostaje dokumentovana granica za prvi actual146 run; novi retained/skipped ishod zahteva zasebnu tehničku proveru i ovde nije uveden. Postojeći hold pre start-a i čist osnovni put imaju zasebne actual proof slučajeve.
