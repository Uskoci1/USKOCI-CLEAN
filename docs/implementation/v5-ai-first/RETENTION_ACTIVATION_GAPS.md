# Retention: šta radi, šta nedostaje, šta zahteva odluku

Read-only pregled 2026-09-13, kroz source139. Ovo nije Retention V1 politika, odobrenje rokova, legal review ili live batch. Priloženi tekst je izvor; aktuelne eksplicitne vlasničke odluke imaju prednost. Nije menjan SQL, worker, policy, scheduler ili live stanje.

Noviji izvor28c47c01 sadrži forward140 za dole opisanu tačnu source/lock
kompatibilnost i141 koji taj guard ponovo vezuje za tri nove Worker turn kolone.
Time je inženjerska stavka1 implementirana u izvoru; njena actual SQL provera
još nije dostignuta u CI34734349508, koji je stao na136.141 izvoz ostaje42
dataset-a, sada OWN_ACCOUNT_V5_5 sa dodatnim owned cancelledAt. Ne uvodi novu
klasu, rok, retention consumer, policy aktivaciju ili relacioni purge. Ostale
granice i konkretni nedostajući policy ulazi u ovom pregledu ostaju otvoreni.

**Preostaju i inženjerski rad i konkretna pravila čuvanja.** Postoje mali AI purge adapter, brisanje privremene export kopije i policy-bound zatvaranje pristupa nalogu. Ne postoji opšti izvršilac isteka svih zadržanih podataka. Popunjavanje rokova samo po sebi neće implementirati to brisanje.

## Postojeća pravila koja se ne pitaju ponovo

- V5 puna komanda §20 zahteva stvarno nastavljivo zatvaranje, ownership, policy binding, obradu hold-a, receipts, Storage i Auth dokaz; izričito dopušta pripremu adaptera i disposable testove dok stvarni rokovi nedostaju. Izvoz nije brisanje. [V5 execution/provenance](EXECUTION.md).
- D-0141, [register §C12.37.2](../../authority/sources/owner-history/03_HISTORICAL_C12/105_PRODUCT_DECISION_REGISTER.md): običan disposable medij razlikuje se od prihvaćenog Agreement/report/problem/audit/hold dokaza. Uklanjanje iz prikaza nije fizičko uništenje. Kada odobren rok istekne i nema važećeg hold-a, server treba da obriše zadržani objekat i izvedene grantove. `DEFER_POLICY` čuva taj zahtev; ne odobrava ni trenutno brisanje ni „zauvek“.
- RC2 Privacy §15 zahteva kategoriju, svrhu, početak roka, trajanje, događaj brisanja/anonimizacije, izuzetak i owner-a procesa. §17 zahteva DSR evidenciju i stvaran account-deletion tok. RC2 ne sadrži popunjene numeričke rokove. Izvor je kompletan owner ZIP SHA256 `5863ad8e3d32858148bde2c24217650a3ef5bca6c62c4ef1d34133e10d909ff2`, master DOCX SHA256 `a981b0601ae3f639b099a37730302214e6c8b0ee8a34b7eef56c34f31cfc2e80`; puna provera je u sibling `V5_RC2_APPROVED_SOURCE/RECONCILIATION.md`, evidentirana u[EXECUTION](EXECUTION.md).
- AF-D02 već određuje prolazni audio bez USKOČI audio arhive; završni tekst ostaje u privatnom razgovoru. Gemini provider obrada i interni zajednički USD5 okvir su već odobreni. To ne određuje rokove za transkripte, činjenice, receipt-e ili Google sopstvene logove. AF-D07/09 određuju Task/avatar i Gemini Task-photo svrhe; ne određuju njihove retention rokove.
- Istorija Dogovora, blokiranje i promene grantova ostaju po poznatim pravilima. Istek prikaza/granta nije dokaz da je red ili objekat obrisan; privatna prijava se ne izvozi prijavljenoj strani. [Media/identity odluke](RICH_MEDIA_IDENTITY_DECISIONS.md).

## Aktuelni izvršivi obim

| Sloj | Stvarno implementirano | Granica |
| --- | --- | --- |
| Registar rasporeda | [P3 registry](../../../supabase/migrations/20260908150000_clean_p3_retention_schedule_registry.sql), `rpc_publish_retention_policy` / `rpc_get_retention_policy_status`: verzija, review/counsel referenca, datum i potpuna mapa aktivnih obaveznih klasa. | Tekstualni redovi ne izvršavaju brisanje. Nema prose→seconds parsera. Trenutni inventar ima15 klasa; njihovo pokrivanje nije isto što i15 izvršivih adaptera. |
| AI purge | [P3 executor105](../../../supabase/migrations/20260910162955_clean_p3_retention_execution_authority.sql): `P3_AI_ABANDONED_UNBOUND_V1`, claim/execute, due-at iz observed abandonment + odobrenih seconds, parent/account lock, hold/policy/source recheck i atomsko brisanje razgovora/poruka. Postoji bounded poziv iz `marketplace_tick`. | Samo `NEED_INTAKE`, pouzdano unbound poreklo, `ABANDONED`, bez Task/edit/fact/proposal/draft-save dokaza, bez REVIEW/BLOCK/proposed-fact poruka i do100 poruka. Worker PROFILE, prihvaćen Task i ostali AI/command podaci nisu obuhvaćeni. Postoji i aktuelna source-admission prepreka opisana ispod. |
| Export privremene kopije | [P2 delivery104](../../../supabase/migrations/20260910153005_clean_p2_export_delivery_authority.sql), `data_export_maintenance`, `rpc_claim_data_export_cleanup` / `rpc_complete_data_export_cleanup`, [stvarni worker](../../../supabase/functions/uskoci-data-export-worker/index.ts): prestanak download pristupa, uklanjanje privremenog SQL snapshot-a i Storage DELETE + provera odsustva konkretnog objekta. | Samo export kopija/snapshot. Ne briše izvorne podatke, sve export receipt-e ili audit. Download, artifact i snapshot imaju tri zasebne policy vrednosti; granice u validatoru nisu odobrena trajanja. |
| Account closure | [131](../../../supabase/migrations/20260912230039_clean_v5_policy_bound_closure.sql), [worker](../../../supabase/functions/uskoci-account-closure-worker/closure.ts): pregled, tačna generation/attempt potvrda, zabrana novih upisa/pristupa, enumeracija owned Storage, potvrđeno brisanje objekata i Auth `should_soft_delete:true`. | Receipt tačno kaže `AUTH_IDENTITY_ERASED_SUBJECT_RETAINED` i `RETAINED_RESTRICTED`. Auth subject UUID i aplikacioni relacioni podaci ostaju. Svaka podržana relaciona akcija je isključivo `RETAIN_RESTRICTED`; to nije opšta anonimizacija/hard-delete naloga. |
| Kasniji istek posle closure |131 `closure_assert_current_v5` proverava `requested_at + retentionSeconds`; istekao red zaustavlja nezavršeno izvršavanje sa `CLOSURE_RETAINED_RULE_DUE`. | Nema kasnijeg purge worker-a za završene `CLOSED` generacije; one vraćaju sačuvanu potvrdu. Nema implementacije brisanja/anonimizacije po isteku zadržanih klasa. `CLOSURE_REQUESTED` je actual admitted start, ne raniji preparation timestamp. |
| Media/evidence | [130](../../../supabase/migrations/20260912224647_clean_v5_owned_media.sql) ima immutable upload/settlement i detach; [139](../../../supabase/migrations/20260913005720_clean_v5_media_evidence_protection.sql) čuva accepted snapshots, private evidence refs, historical gaps, Storage/asset zaštitu i closure blocker. |139 nema release/purge writer. Istek generičkog hold-a ili završetak case-a ne uklanja immutable reference. Zaštićen owner ostaje blokiran za destruktivni closure dok odgovarajuća evidence politika/izvršilac ne postoji. To je zatvorena kapija, ne politika beskonačnog čuvanja. |
| Izvoz aktuelne šeme | [136](../../../supabase/migrations/20260913001000_clean_v5_owned_export_projection.sql) +137/138/139 daju42 dataset-a,15 klasa i `OWN_ACCOUNT_V5_4`; exact projection/source hash i reviewed INCLUDE/EXCLUDE. | Medij se izvozi kao dozvoljeni metadata, `bytesIncluded=false`. Širina izvoza nije dokaz širine purge-a. Aktuelni katalog ne sadrži budući operativni support ili identity provider dokaz. |

### Konkretna AI source-admission prepreka

`private.retention_ai_source_ready` u105 poredi tačan skup triggera, njihove tipove/body hash-eve i dozvoljava nula argumenata. [121](../../../supabase/migrations/20260912130000_clean_pre_v3_account_closure_preparation.sql), redovi218–220, dodaje `pre_v3_closure_ai_conversation`, `pre_v3_closure_ai_message`, `pre_v3_closure_ai_fact`; svi imaju tačno dva argumenta. [126](../../../supabase/migrations/20260912213702_clean_v5_review_acceptance.sql), redovi20–35, menja samo već provereni hash `guard_need_edit_base_marker`. Ne prihvata ova tri nova triggera. Iz tih izvora sledi da bi current schema i uz validnu politiku ostala `SOURCE_NOT_READY`; ovo nije izvršen live upit.

Forward kompatibilnost je već odobren correctness posao: prihvatiti isključivo pregledane tačne trigger definicije, argumente i helper izvore, uz zadržavanje svih starih shape/FK/partition/trigger zaštita. Ne koristiti generičko „sve trenutne triggere smatramo bezbednim“ niti osvežiti hash bez pregleda. Dodatno,105 claim uzima retention lock pre nego što121 job trigger traži closure lock, dok131 uzima closure→retention; to treba uskladiti pre otvaranja adaptera, uz stvaran konkurentan proof. Nije potrebna nova odluka o broju dana za implementaciju te popravke.

## Preostali inženjerski posao koji može da se pripremi sada

1. Popraviti gore opisanu P3 source/lock kompatibilnost u forward migraciji i dokazati da se ništa ne briše bez postojeće tačne politike; ne širiti kandidata na bound/Worker/evidence podatke.
2. Pripremiti policy-bound izvršenje isteka po dataset-u: tačan početni događaj, due-at, akcija, verzija politike i minimalni receipt. Za buduće odobrene delete/anonymize akcije obraditi stvarne FK i append-only granice, zajedničke Agreement podatke, sve kopije/izvedene grantove i ponovno proveriti hold pre poslednjeg upisa. Ne koristiti blind Auth cascade ili postojeći `RETAIN_RESTRICTED` kao zamenu za traženo brisanje.
3. Dopuniti139 izvršivim lifecycle-om dokaza tek prema tačnim pravilima: aktivne reference/izuzeci, pregledan završetak svrhe, svim referencama usklađen due-at i service-only odobrenje brisanja. Zatvoren report ili `active=false` na jednom hold-u ne znače da su ostale osnove prestale. Priprema adaptera može ostati bez aktivne politike.
4. Dodati cleanup odbačenog/nezavršenog Task/avatar medija van closure-a prema odobrenom početnom događaju i roku. Reuse130 dispatch/settlement; timeout ili odsutan objekat u jednom čitanju ne dokazuju da unknown upload neće kasnije završiti.131 zato već blokira DISPATCHING medij i neproveren stari export producer.
5. Definisati zasebne minimizovane purge ciljeve za Requester/Worker AI history, činjenice/preglede, Q&A classifier/commands, opaque idempotency tombstones, budget/audit metapodatke, legal acceptance, privatne lokacije, poruke i reputaciju. Minimizovan podatak i dalje ima svrhu/rok. Purge ne sme da omogući ponovnu naplatu ili oživi već izvršenu/cancelled komandu.
6. Integrisati bounded maintenance i nadzor stvarnih ishoda.105 je već u `marketplace_tick`: kasnije otvaranje source+policy kapije može pokrenuti brisanje kroz postojeći tick bez nove cron definicije. Export Storage worker i131 closure maintenance su zasebni pozivi;131 enable flag podrazumevano je zatvoren. Konkretan batch mora opisati i postojeće automatske pozivaoce.

Ovo su potrebne implementacije poznatih zahteva, ne zahtev da vlasnik projektuje lockove, adapter nazive ili SQL. Destruktivni scope i policy vrednosti ostaju neaktivirani do konkretnih odobrenja.

## Tačni nedostajući policy ulazi

Tražiti jedan popunjen, verzionisan **Retention V1 paket**, ne ponovnu načelnu dozvolu da se koristi već dostavljeni RC2:

| Ulaz | Potrebna konkretna vrednost/odluka |
| --- | --- |
| Sve kategorije/dataset-i | Svrha, tačan događaj početka, trajanje, konačna akcija DELETE/određena anonimizacija ili obrazloženo ograničeno zadržavanje, pravni/source osnov i odgovoran proces. Odobrenje mora pokrivati current šemu, ne samo stare nazive tabela. |
| Dokazi i izuzeci | Kada nastaje/prestaje legitimna evidence svrha; ko sme da postavi/proveri/oslobodi hold; kako se tretiraju nerešeni case/appeal i više osnova za isti objekat; rok/pregled izuzetka i minimalni dokaz izvršenja.139 tehnički nema ovlašćenje da sam donese te odluke. |
| AI/transkripti | Zasebna primena na disposable unbound razgovor, bound/accepted Task, Worker draft, finalne činjenice, nepoznate provider komande i safety/review dokaz. Odobren transient audio ne postaje dozvola da finalni tekst ostane neograničeno. |
| Export | `artifactLifetimeSeconds`, `snapshotLifetimeSeconds`, `downloadLifetimeSeconds`, tačno reviewed polja/izuzeci i rok za command/audit metadata. Tehnički maksimumi i lease/retry intervali nisu popunjena politika. |
| Account closure | Koja relaciona polja ostaju, zašto i koliko; koja se brišu/anonimizuju i kada; kako se čuvaju legitimni podaci druge strane i podnosi DSR posle gašenja Auth pristupa. Ne pristajati na131 model samo zato što jedini trenutno postoji. |
| Pravni binding | Stvarni operator/kontakti, finalna aktivna Privacy verzija/SHA i Terms gde ih adapter zahteva, tačna referenca pregleda i effective date. [Publication/legal razgraničenje](PUBLICATION_ACTIVATION_READINESS.md). Ne unositi fixture counsel/URL ili izmišljeno pravno lice. |
| Provider kopije | Aktuelni processor dogovor, njihove deletion/retention mogućnosti i potvrde tamo gde postoje. Lokalni DB/Storage purge nije dokaz brisanja Google/Supabase provider logova ili backup-a. Ne obećavati zero-retention/EU-only mimo već prihvaćenih činjenica. |

Brojevi u testovima, review expiry15 minuta, provider leases, retry60/120 sekundi, najduži dozvoljeni download/artifact prozor i rokovi za odgovor na reklamaciju **nisu odobreni retention rokovi**. Njihovo kopiranje bi proizvelo novu politiku bez odluke.

## Support i identity — ostaju zasebno otvoreni

[Support predlog](SUPPORT_CASE_CONTRACT_PROPOSAL.md) još čeka odobren operator/data scope i obične kvote. Postojeća privatna safety prijava i bilateralni problem već imaju source i ulaze u evidence model; budući operativni case/inbox/reply/appeal treba mapirati tek prema odobrenim primaocima i svrsi. Završetak slučaja nije automatski purge. Support SLA/kvota nije rok čuvanja; privatni tekst protiv vlasnika nije njegov export sadržaj.

[Identity opcije](IDENTITY_ACTIVATION_OPTIONS.md) ne biraju provider niti odobravaju obradu realnog dokumenta/selfija/biometrije. Ako se kasnije aktivira realna verifikacija, potrebno je tačno odobriti ko drži dokumente, lokalni minimalni status/ref, rokove i provider deletion/revocation ugovor. Ne dodavati realan identity dataset ili lažni verified status samo da bi15-class katalog izgledao potpun. Sandbox sa izmišljenim podacima ne dokazuje pravnu/tehničku spremnost obrade stvarnog identiteta.

## Dokaz pre aktivacije

Pored postojećih [P3 proof-ova](../../../supabase/proofs/legal/p3_retention_execution_proof.mjs), [131](../../../supabase/proofs/pre_v3/v5_account_closure_execution_proof.mjs) i [139](../../../supabase/proofs/pre_v3/v5_media_evidence_proof.mjs), svaki novi dataset zahteva stvaran disposable SQL/Storage/Auth proof svog obima: pre/na/posle roka, promenjena politika, aktivan/oslobođen hold, više referenci, closure/novi upis race, prekid i ista komanda, unknown I/O bez ponovnog destruktivnog dispatch-a, private/foreign izolacija i kasniji export bez obrisanog sadržaja. Posebno dokazati da kopije, grantovi i metadata ne ostaju nezaštićena rupa.

Zelena provera starog105 adaptera ili receipt `CLOSED` iz131 nije dokaz globalnog retention purge-a. Live aktivacija zahteva root-ov konkretan pregledan batch sa policy/source hash-evima, tačnim populacijama/akcijama, scheduler obimom i postflight dokazom. Sintetička disposable pravila ostaju test podaci.
