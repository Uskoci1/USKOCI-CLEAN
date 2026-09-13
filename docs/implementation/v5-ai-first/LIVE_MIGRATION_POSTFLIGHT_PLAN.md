# V5 forward109–140: konkretni postflight i zaustavljanje

Plan za pregled, **nije odobrenje ni zapis izvršene migracije/deploy-a**. Pregledani sačuvani izvor je `8c250b23c00fe505fd6960b72213b1675e500c23`, tree `25c5246a1809c31db6fbf878d5f66f542ed8a570` (registrovani kandidati do140 i135 fixture ispravka).140 `20260913014627_clean_v5_retention_source_compatibility.sql` ima SHA256 `b5eaf6f7cad801aeaa6a6534b1f85e4a753817e9406d73ac7b4be17bb0e0c206`. Root i nezavisni review su završeni,10 focused source/admission provera prolazi;30-report actual CI34732513050 je u toku. Ne prihvatati radne bajtove umesto sačuvanog izvora.

Poslednji puni izolovani run [34732513050](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34732513050), na tačnom `8c250b23...`, ima11 source gates PASS,182 Jest suite/3637 testova i664 Node testa PASS;24 SQL reporta do134 PASS.135 ima8 PASS provera i actual Edge200, zatim pad proof poređenja internog receipt.ok sa klijentskom projekcijom. Ispravka samo tog poređenja sačuvana je u5737f43 (47 handler testova PASS);136–140 nisu dostignuti.141 Worker oporavak je nova pronađena source ispravka u radu i još nije u ovom32-migration manifestu. Nijedna od ovih činjenica nije live/provajder dokaz.

## 1. Poznato početno stanje i svež read-only dodatak

[LIVE_READONLY_BASELINE.json](LIVE_READONLY_BASELINE.json), posmatrano2026-09-13 01:20:27 UTC, beleži projekat `leqcwgzvjsxugfgzdmth`,108 migracija, head `20260911031713 clean_dispatch_need_lock_order`,3 naloga,7 Task-ova,2 Agreement-a,0 `profile-media` objekata i0 aktivnih pregledanih publication bundle-a. To nije odobrenje za menjanje tih podataka.

Root je naknadno2026-09-13 read-only proverio: tačno jedan cron job, `jobid=1`, `uskoci_marketplace_tick`, `* * * * *`, active=true, database/username=`postgres`, command MD5 `93518fd0382301fc76f79037123bccfc`. Boolean poređenje potvrđuje tačno `select private.marketplace_tick(25);`. Nema otvorenih `cron.job_run_details` redova u tom trenutku. `pg_roles.rolconfig` za authenticator nema `pgrst.db_pre_request`; relevantni `pg_db_role_setting` override-i takođe su prazni. Ovo **ne dokazuje** odsustvo spoljašnjeg PostgREST environment override-a, niti garantuje da se novi cron posao neće pokrenuti posle očitavanja.

Sve ove tačke osvežiti neposredno pre odobrenog izvršenja. Sačuvati ograničen inventar/hash-eve, bez SQL command teksta ako bi nepoznat posao mogao sadržati ključ, privatnih poruka ili tokena.

Dodatni read-only upiti u02:12:36 i02:13:05 UTC vratili su samo brojače i klasifikaciju, bez sadržaja/putanja:2 Agreement verzije,0 podobnih novih grupa/članstava,2 otvorena problem konteksta,0 aktivnih hold-ova,0 AI turn komandi i0 retention policy set-ova.119 safety i130 owned-media tabele još ne postoje na108. Obe prihvaćene izvorne photo liste rekonstruisane su kao dokazivo prazne. Ako se podaci ne promene i novi registri ostanu prazni,139 će dati2 RESOLVED prazna snapshot-a,0 UNRESOLVED,0 refs i0 istorijskih safety gap-ova. To je uslovna projekcija, ne izvršen backfill. Sačuvano u `LIVE_READONLY_BASELINE.json` readOnlyAddenda; osvežiti u dogovorenom mirnom prozoru.

## 2. Raspored koji već radi i šta aktivacija stvarno može pokrenuti

Aktuelni `private.marketplace_tick` već poziva, redom, `expire_lifecycle`, `dispatch_tick`, `rpc_tick_auto_completion`, `data_export_maintenance` i `retention_maintenance`. Izvor je [P3 execution105](../../../supabase/migrations/20260910162955_clean_p3_retention_execution_authority.sql);108 je kasnije popravio zaključavanje dispatch/expiry funkcija. Nema novog cron-a u109–139; draft140 takođe ne zakazuje posao.

| Postojeći/predloženi potrošač | Šta radi bez novog rasporeda | Kapija i postflight |
| --- | --- | --- |
| Minutni marketplace tick | Ističe rokove/obaveštenja, nastavlja dispatch, automatski završava podobne Agreement-e. To su postojeće poslovne izmene, ne read-only health check. | Uporediti aktivni job/command hash i status poslednjeg završetka. Ne pozivati tick ručno radi provere; najpre kontrolisati stvarnu publiku i eventualno održavanje. |
| Isti tick → `data_export_maintenance` | Briše istekao privremeni `snapshot_text`, označava READY export kao EXPIRED i opoziva download grant. Ne briše Storage objekat. Već nastale obaveze održavanja ne zavise od novog AI flaga. | Inventar postojećih export statusa, artifact/lease/expiry/cleanup brojača. Ne nazivati ga potpuno zatvorenim samo zato što novo generisanje export-a nije spremno. |
| Isti tick → `retention_maintenance` | Poziva claim i izvršava do25 podobnih P3 AI retention poslova. To može stvarno obrisati dozvoljeni napušteni, nevezani AI razgovor i njegove dozvoljene child redove. | Zahteva stvarni `retention_execution_binding` i podržan source/candidate/hold/closure ugovor.140 vraća podržan source; **ako već postoji validna izvršna politika, može ponovo otvoriti postojeći automatski potrošač**. Closure Edge flag nije kapija ovog SQL posla. |
| `uskoci-data-export-worker` | User `prepare/cleanup` obrađuje samo njegovu tačnu potvrdu; interni `tick` može pripremiti/počistiti postojeći red. Storage upload/delete se obavlja u Edge-u. | Nema posebnog enable env flaga u ovom source-u. Nova priprema je vezana za reviewed export/Privacy/source digest. Stari artifact cleanup ima sopstveni autoritet. Ne slati maintenance/tick kao bezazlen probe. |
| `uskoci-push-transport` | Service-only `tick` čita postojeće delivery/attempt ledgere i poziva Expo. `probe` upisuje readiness i kada je disabled. | `EXPO_PUSH_TRANSPORT_ENABLED` mora ostati false dok konkretan transport scenario nije odobren. Disabled `tick` ne radi DB/provider IO; `probe` nije read-only. Deployment sam ne uvodi raspored. |
| `uskoci-account-closure-worker` | Service-only jedan account/generation ili bounded maintenance1..8. Može obrisati pripremljene Storage objekte i soft-obrisati Auth identitet uz zadržan application subject. | `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED` default false, dodatno tačna izvršna politika, owned start/generation/dispatch, dokazni i hold guard-ovi.131 ne instalira cron; **ne uključivati** bez zasebne konkretne dozvole. |
| Publication/QA provider | Nema cron consumer-a za Gemini u pregledanom SQL-u. Postojeći korisnik/klijent ipak može inicirati poziv čim policy/source/env dozvole. |127 allowlist ograničava plaćeni AI poziv, ne javnost marketplace-a, čitanje objave ili sve legacy poslovne RPC-eve. |

Predlog finalnog batch-a treba da izričito obuhvati kratko održavanje postojećeg jobid1, očuvanje njegove tačne konfiguracije, proveru da se prethodna izvršenja stvarno završila i kasnije vraćanje njegovog prethodnog active stanja. Sama činjenica `end_time IS NULL`=0 pre pauze nije drain dokaz. Ako pauza nije u odobrenom batch-u ili se ne može bezbedno završiti drain, ne improvizovati `pg_terminate_backend`, ne povećavati lock timeout i ne menjati SQL radi prolaza. Ne zaustavljati zauvek auto-completion/expiry da bi se uklonio simptom.

## 3. Migracije koje menjaju više od dostupnosti novih RPC-eva

Sve datoteke primenjivati u tačnom redosledu iz obnovljenog [LIVE_BATCH_CANDIDATE.json](LIVE_BATCH_CANDIDATE.json); ova tabela nije zamena za32 pune datoteke i njihove hash-eve.

| Ordinal | Stvarni efekat koji mora biti vidljiv u odobrenju i postflight-u |
| --- | --- |
|109–110 |109 dodaje revision/owner capacity i edit read;110 uvodi strože single-writer profile/capacity/location/availability guard-ove.110 source izričito traži kompatibilan klijent/old-client admission. Broj naloga ne dokazuje da nema starih aktivnih klijenata. Ne primenjivati sa nekontrolisanim starim profile writer-om; dogovoreni migration window/klijenti moraju biti konkretni. |
|111–115 |Inbox read se vezuje za stvarne delivery redove; Agreement i lifecycle/replay writer-i dobijaju authority/version/receipt guard-ove. Ne pravi se istorijski inbox, novi Agreement acceptance ili prepisivanje događaja. Sačuvati broj i hash postojećih poslovnih/evidence redova; testirati dozvoljene read DTO-e odvojeno od mutacija. |
|116–119 |Owned requester identity DTO/komanda, precizniji event vocabulary i safety block/report autoritet. Postojeće bilateralne bezbedne završne radnje ostaju; ne uključuje se provider verifikacije identiteta niti se istorijski eventi prepisuju. |
|120–123 |Reviews reputacija dobija pravi writer i novu obaveznu retention kategoriju `AGREEMENT_REVIEWS` (time postojeća nepotpuna policy mapa može postati NOT_READY).121 zatvara owned write tokom closure;122–123 dodaju stvarnu push readiness evidenciju, inicijalno praznu/UNKNOWN. Ne seed-uju se reviews, izvršne retention odluke ili transport uspeh. |
|**124** |**Stvarno aktivira** `RS_PUBLICATION_POLICY_MINIMUM/RS/1`: reviewed/complete/active=true i datumi efektivnosti/pregleda/aktivacije. Precondition proverava postojeći source SHA `792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa`,16 pravila i zamrznute ishode. Ovo nije samo schema install. Root mora pregledati tačan upisani owner provenance; komentar u SQL-u nije nova live dozvola. P1/P3/P4 pravni sadržaj se ovime ne objavljuje. |
|**125** |Dodaje stvarne evaluator instructions/outcomes/safe codes svih16 pravila i `evaluatorContentSha256`; dokument postaje izvršiv.124 bez125 nije dovoljan. Posle125 postojeći evaluator/klijenti potencijalno mogu zatražiti stvarnu obradu; uporediti bundle/document digest i stvarne flagove pre završetka održavanja. |
|126–130 |Jedan detaljan review/accept/publish ugovor;127 seed-uje samo zatvorenUSD5 ledger (`enabled=false`, rezervacije0, bez allowlist naloga, price valid do2027-01-01).128 radni profil,129 legal/safety reads,130 privatni sanitizovani media upload/avatar/Task references.130 ne objavljuje stare objekte niti dodaje cleanup scheduler; auditirati postojeće Storage politike i neočekivane grantove. |
|**131** |Nove closure tabele i source binding; globalni authenticator `pgrst.db_pre_request=public.rpc_closure_api_guard`; restrictive authenticated SELECT politika na svim tadašnjim public RLS tabelama i restrictive Storage fence; čuva normalni Auth mirror, izuzetak samo za tačno dispatchovanu soft-erasure generaciju. Proveriti drugi pre-request hook/override pre primene, ne pregaziti ga. Sam source ne popunjava closure policy niti pokreće account erasure. |
|**132** |Postojeći `ai_need_turn_commands` dobijaju `provider_dispatched=true` konzervativno; novi redovi default=false. To je realan backfill nepoznatog ranijeg provider ishoda, ne dokaz da je provider stvarno pozvan. Oporavak starog nepoznatog turn-a ne sme automatski ponovo naplatiti poziv. Evidentirati broj postojećih PROCESSING/FAILED redova bez sadržaja. |
|133–135 |Owned Q&A recovery/numeric limiti i durable classifier/dispatch autoritet.135 ne seed-uje izvršivi QA policy dokument niti pregled/aktivaciju. Fixture `renderQaPolicyCandidate()`/is_reviewed=true iz CI-a nije live operacija. Nova klasifikacija/provider dispatch ostaje zatvorena dok poseban dokument, paid/QA flag,tačan budžet i worker/context nisu odobreni/spremni. Već postojeći READY zahtev može završiti kanonski upis sa flagovima OFF; gašenje nije opoziv ranije odluke. |
|136 |Menja export na37 fiksnih owned dataset-a, `USKOCI_EXPORT_DELIVERY_V2 / OWN_ACCOUNT_V5_1`, uz SHA šest compiled projekcija/sanitizera. Stara mapa ne dobija automatsko odobrenje nove projekcije. Nema snapshot/export zahteva ni novih rokova u migraciji. |
|**137** |Pravi praznu grupu za Task sa najmanje dva različita non-CANCELLED worker account-a i upisuje njihova postojeća Agreement članstva odsequence1. Završeni Agreement može biti član; terminal Task blokira buduće slanje. Nema kopiranja privatne istorije. Export postaje39/V5_2; nova recipient prava nastaju isključivo pri slanju, ne retroaktivno po unblock-u. Uneti konkretne brojeve grupa/članstava očekivane iz2 postojećih Agreement-a pre odobrenja. |
|138 |Dodaje owned privatni location snapshot/command i export41/V5_3. Nema backfill-a stvarnih koordinata ni automatskog GPS upita; postflight očekuje0 novih lokacijskih redova do eksplicitne user radnje. |
|**139** |Rekonstruiše snapshot za **svaku** postojeću Agreement verziju; postojeće safety report/problem/active hold veze postaju zaštita medijskog dokaza. Nedokaziva istorijska fotografija ostaje UNRESOLVED; istorijski Task-only safety kontekst pravi gap. Ni0 sadašnjih Storage objekata ne garantuje0 takvih snapshot/gap redova. Nema izmišljanja starih bajtova ili brisanja gap-a radi prolaza. Dodaje Storage/asset immutable guard-ove i export42/V5_4. |
|**140 — registrovan, actual CI u toku** |Narrow P3 source compatibility i shared closure lock u postojećim claim/execute/candidate putanjama. Isključuje7 novih non-FK command/review/media sidecar izvora iz starog volatile purge-a. Ne seed-uje rok/policy i ne menja raspored; može vratiti izvršnost **već** validne P3 politike. Posmatrani live ima0 takvih politika; finalno osvežiti pre admission-a. |

Proveriti da139 prethodni i140 konačni compiled closure source digest ostaju tačno vezani. SourceReady=true nije PolicyReady=true. Pri novoj obaveznoj kategoriji/projekciji očekivan NOT_READY ne „popravljati“ dopisivanjem lažnih pravnih podataka.

## 4. Jedanaest Edge entrypoint-a: konkretan auth/deploy ugovor

Repo pri pregledu nema `supabase/config.toml`. Zato finalni deploy manifest mora eksplicitno navesti auth podešavanje svake funkcije i stvarni readback. Predlog za **ovaj postojeći source/legacy key transport** je `verify_jwt=true` za svih11; kod i dalje proverava pravi Auth account ili tačno interni service credential. Ovo nije predlog migracije ključeva ili novog auth SDK-a.

| Funkcija | Handler/auth i namena | Predlog zatvorenog početnog stanja / poseban dokaz |
| --- | --- | --- |
|`uskoci-ai-interview` |User Bearer, stvarni Auth i owned intake,132 dispatch pre provider-a, stream ili istorijski HTTP. |Eksplicitno `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`, `AI_TEST_BUDGET_REQUIRED=true`, `USKOCI_GEMINI_PAID_TEST_ENABLED=false`;127 disabled. Sam paid=false nije potpuni legacy kill switch uz proizvoljan drugi provider/model ili auto-fallback. |
|`uskoci-worker-interview` |User Auth +owned PROFILE/session+revision; stvarni Gemini profil predlog. |Isti tačan provider/model i paid flag, closed127. Ne aktivira worker bez zasebne owned save komande. |
|`uskoci-publication-evaluate` |User Auth, tačan owned Need/review/policy context,126 eval claim/dispatch+127. |Paid=false; `USKOCI_GEMINI_IMAGE_REVIEW_ENABLED=false` do odobrene odabrane slike. Sama obična HTTP proba sa validnim review-em može rezervisati/pozvati model. |
|`uskoci-qa-classify` |User Auth +context/hash/classification/recovery+135 dispatch i127. |Paid=false; `USKOCI_QA_CLASSIFIER_ENABLED=false`; nedostajući reviewed QA dokument ostaje zatvoren. |
|`uskoci-location-search` |User Auth, bounded LocationIQ forward/reverse; read-only prema aplikacionoj bazi. |Postojeći provider/key, bez novog provider izbora. Stvarni query ipak izlazi LocationIQ-u i nije dokaz samo deploy-a. |
|`uskoci-media` |User Auth +owned Task/avatar scope; server derivative, Storage i durable key/recovery; bez Gemini. |Nema opšteg enable flaga. Proveriti tačan `npm:@imagemagick/magick-wasm@0.0.43`, `magick.wasm` asset i sve lokalne import-e u stvarnom bundle-u. Deno2.9.6 lokalni smoke ne dokazuje hosted bundler/Storage tok. |
|`uskoci-data-export-download` |User Auth +owned receipt/generation, kratki jednokratni DB grant i ponovna provera uz privatne bytes. |Nije čist read-only healthcheck: authorize kreira download grant. Za negativni anon test ne slati validan owned receipt. |
|`uskoci-data-export-worker` |Dual: user prepare/cleanup tačne potvrde ili interni service `tick`. `Transport.isInternal()` poredi ceo očekivani `SUPABASE_SERVICE_ROLE_KEY`, ne samo claim `role`. |Legacy service-role JWT ide samo interno u Bearer; handler ne prihvata običnog user-a za tick. Bez scheduler-a/maintenance poziva dok njihov scope nije odobren. |
|`uskoci-push-transport` |Samo exact service Bearer. User/anon ne smeju claim-ovati delivery. |`EXPO_PUSH_TRANSPORT_ENABLED=false`. Čuvati razliku probe-upis / ticket / provider receipt / stvarni uređaj. |
|`uskoci-account-closure-worker` |Samo exact service Bearer uz existing shared transport; nikad user-owned start preko Edge-a. |`USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED=false`. Bez maintenance smoke-a koji stvarno briše. |
|`uskoci-speech-session` |Native WS GET sa `Authorization` i `apikey` headers; URL sadrži samo opaque conversationId/operationId. Auth+owned OPEN conversation+127 pre upstream-a. |Paid=false i `USKOCI_SPEECH_CONTROLLED_TEST_ENABLED=false`; verify_jwt=true. Browser savet za token u URL/no-verify-jwt nije ovaj native transport. Kasnije stvarno proveriti hosted Upgrade i final frame/close; nema reconnect-a niti tokena u URL. |

Zvanična dokumentacija opisuje gateway i handler kao odvojene auth slojeve, pa gateway acceptance nije account autorizacija. Za novi API-key-only service obrazac dokumentovan je drugi transport; njega ovaj source ne implementira. [Supabase authorization headers](https://supabase.com/docs/guides/functions/auth-headers), [service auth](https://supabase.com/docs/guides/functions/auth). Browser WebSocket nema custom header opciju, ali postojeći React Native adapter je koristi; održavanje upgrade-a koristi `EdgeRuntime.waitUntil`. [Supabase WebSockets](https://supabase.com/docs/guides/functions/websockets).

Sačuvati stare5 Edge verzije/EZBR hash-eve iz baseline-a, a posle deploy-a svih11: version/status/verify_jwt/EZBR i sadržaj stvarnog bundle-a sa lokalnim i npm/WASM zavisnostima. Hash samo `index.ts` nije sufficient bundle dokaz. Ne koristiti `--no-verify-jwt` kao popravku gateway401 bez konkretnog transport/auth pregleda. Hosted asset nedostajanje ili gateway/handler auth mismatch zaustavlja rollout tog toka; ne premešta se provider key u APK.

Lokalni `scripts/prepare-v5-edge-payloads.cjs --source <40-char SHA>` sada priprema tačne MCP JSON payload-e iz Git objekata, bez uvoza/izvršenja product koda ili mreže. Za8c250b23:11 funkcija,29 per-function unosa/22 jedinstvena source fajla; svaki sadržaj i konačan payload imaju SHA256. Manifest u `artifacts/v5-edge-payloads/<SHA>/manifest.json` vezan je u LIVE_BATCH_CANDIDATE.json.7 usmerenih guard provera i nezavisan pregled prolaze. Eksterni `npm:@imagemagick/magick-wasm@0.0.43` i njegov `magick.wasm` zabeleženi su kao spoljne zavisnosti; **njihovi bajtovi nisu u lokalnim tekstualnim payload-ima**. Supabase zvanični [image-manipulation primer](https://supabase.com/docs/guides/functions/examples/image-manipulation) koristi npm WASM resolver, ali to ne zamenjuje hosted readback našeg bundla. Za zasebne lokalne WASM/static fajlove postoji drugačiji [static_files deployment ugovor](https://supabase.com/docs/guides/functions/wasm); ne dodavati ih API payload-u kao neproverenu zamenu.

## 5. Konkretni read-only upiti i očekivanja

Izvršavati kroz privilegovanu DB SQL konekciju (postgres/admin), samo blokove za tada postojeći ordinal; odsustvo pre140 nije dokaz pada140. Privatne tabele/helper-i nisu dostupni običnom anon/authenticated/service-role REST pozivu. Svaki rezultat vezati za server timestamp/project/history ordinal. Ovi upiti ne claim-uju posao, ne pozivaju tick, ne prave export grant i ne šalju provider zahtev.

**A — pre svakog koraka i finalno:** hash celog migration reda, bez transportovanja SQL tela. Svih prethodnih108 redova ostaje identično početnom snapshot-u; svaki novi red mora biti vezan za baš odobrenu datoteku/izvršene SQL bajtove. Ako hosted alat koristi drugi timestamp alias, sačuvati eksplicitnu mapu source↔live verzija; ne prepisivati istoriju.

```sql
select clock_timestamp() as observed_at, current_database();
select version,name,
 encode(sha256(convert_to(to_jsonb(m)::text,'UTF8')),'hex') as row_sha256
from supabase_migrations.schema_migrations m order by version;
select 'accounts' as kind,count(*) from public.app_accounts
union all select 'tasks',count(*) from public.needs
union all select 'agreements',count(*) from public.agreements
union all select 'agreement_versions',count(*) from public.agreement_versions
union all select 'profile_media_objects',count(*) from storage.objects where bucket_id='profile-media';
```

Brojači sami nisu dokaz očuvanja sadržaja. U unapred dogovorenom mirnom prozoru sačuvati per-row SHA za postojeće poslovne/immutable evidence tabele, bez plaintext izvoza; odvojiti poznate automatske status promene od neodobrenog backfill-a. Ne zahtevati isti status posle očekivanog minute tick-a, niti nepoznatu razliku proglasiti očekivanom bez poređenja.

**B — scheduler i PostgREST pre-request, pre131 i posle:**

```sql
select jobid,jobname,schedule,active,database,username,md5(command) as command_md5,
 command='select private.marketplace_tick(25);' as exact_marketplace_tick
from cron.job order by jobid;
select jobid,status,count(*) from cron.job_run_details
where end_time is null group by jobid,status order by jobid,status;
select setting as pre_request from pg_roles r
cross join lateral unnest(r.rolconfig) setting
where r.rolname='authenticator' and setting like 'pgrst.db_pre_request=%';
select coalesce(d.datname,'*') as database_name,coalesce(r.rolname,'*') as role_name,
 setting as pre_request from pg_db_role_setting s
left join pg_database d on d.oid=s.setdatabase left join pg_roles r on r.oid=s.setrole
cross join lateral unnest(s.setconfig) setting
where (s.setdatabase=0 or d.datname=current_database())
and (s.setrole=0 or r.rolname='authenticator') and setting like 'pgrst.db_pre_request=%';
```

Posle131 očekuje se tačan closure hook, bez suprotnih override-a. Migracija šalje oba `reload schema` i `reload config`; metadata nije dokaz da je svaki živi PostgREST worker prihvatio novu konfiguraciju. Actual Auth/RPC putanja mora dati dokaz pre aktivacije closure-a, bez zatvaranja postojećeg naloga radi „probe“.

**C — stvarna124/125 aktivacija, sadržaj i odvojena QA kapija:**

```sql
select policy_id,jurisdiction,version,is_active,is_reviewed,is_complete,
 reviewed_at,effective_from,activated_at,
 review_provenance->>'source_sha256' as source_sha256,
 review_provenance->>'evaluatorContentSha256' as evaluator_sha256,
 review_provenance->>'legal_certification' as legal_certification,
 private.publication_policy_bundle_ready(id,jurisdiction,statement_timestamp()) as ready,
 private.current_publication_policy_bundle(policy_id,jurisdiction,statement_timestamp())=id as current,
 private.publication_policy_document(id) is not null as executable
from private.publication_policy_bundles
where policy_id in('RS_PUBLICATION_POLICY_MINIMUM','PRESELECTION_QA_V1') order by policy_id,version;
select r.rule_id,r.rule_provenance->>'outcome' as owner_outcome,
 encode(sha256(convert_to(r.rule_provenance::text,'UTF8')),'hex') as rule_sha256
from private.publication_policy_rule_refs r join private.publication_policy_bundles b on b.id=r.bundle_id
where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1 order by r.rule_id;
```

Očekivati baš16 zamrznutih pravila;124 ready/current=true, a125 dodatno executable=true i tačan approved document digest. QA aktivacija nije implicitni očekivani rezultat ovog SQL paketa. Ne izvršavati posebni QA candidate generator ili126 publish RPC kao postflight.

**D — odvojene zatvorene kapije, post140 final:**

```sql
select enabled,ceiling_microusd,reserved_microusd,price_valid_until from private.ai_test_budget_v5;
select count(*) as admitted from private.ai_test_accounts_v5 where retired_at is null;
select kind,count(*) as reservations,sum(max_cost_microusd) as reserved_by_kind
from private.ai_test_reservations_v5 group by kind;
select private.retention_ai_source_ready() as retention_source_ready,
 private.retention_execution_binding() is not null as retention_policy_ready,
 private.data_export_policy_binding() is not null as export_policy_ready,
 private.closure_binding_v5() is not null as closure_policy_ready,
 (select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5() as closure_source_current,
 jsonb_array_length(private.data_export_dataset_catalog()) as export_dataset_count;
select policy_version,retired_at,retention_execution is not null as retention_configured,
 export_delivery is not null as export_configured,account_closure_execution is not null as closure_configured
from private.retention_policy_sets order by effective_at;
select key,value->>'enabled' as enabled,
 encode(sha256(convert_to(value::text,'UTF8')),'hex') as config_sha256
from private.marketplace_config where key='urgent_activation_policy';
```

Pre plaćenog batch-a očekivati127 disabled/0/0, ceiling5000000 i predviđen expiry. Ne resetovati ledger da proba stane u budžet.140 može imati source_ready=true uz sva tri policy_ready=false; to je ispravno zatvoreno stanje. Finalni export catalog posle139/140 ima42 dataset-a. Postojeći export/retention job i artifact brojači se porede odvojeno; null policy nije dozvola za brisanje njihove evidencije.

**E —137/139 backfill i138 bez izmišljenih koordinata:**

```sql
-- Pre137: očekivana prazna nova grupa po ovom skupu Task-ova.
select count(*) as eligible_group_tasks from (
 select need_id from public.agreements where status<>'CANCELLED'
 group by need_id having count(distinct worker_account_id)>=2
) n;
-- Posle137, pre bilo koje dogovorene poruke:
select count(*) as groups,coalesce(sum(sequence),0) as sequence_sum from private.group_conversations_v5;
select count(*) as memberships,min(joined_sequence),max(joined_sequence) from private.group_memberships_v5;
select count(*) as messages from private.group_messages_v5;
select count(*) as recipient_grants from private.group_message_visibility_v5;
-- Posle138, pre dobrovoljnog location send-a:
select count(*) as location_commands from private.agreement_location_commands;
select count(*) as location_points from private.agreement_location_points;
-- Posle139: jedan snapshot po postojećoj Agreement verziji; UNRESOLVED je stvaran rezultat.
select state,count(*) from private.agreement_media_snapshots_v5 group by state;
select count(*) as missing_version_snapshots from public.agreement_versions v
where not exists(select 1 from private.agreement_media_snapshots_v5 m
 where m.agreement_id=v.agreement_id and m.agreement_version=v.version);
select source_kind,count(*) from private.media_evidence_refs_v5 group by source_kind;
select reason,count(*) from private.media_evidence_gaps_v5 group by reason;
```

Za138 očekivanje je0 dok korisnik nije dobrovoljno poslao snimak. Za137 dodatno porediti account/profile/Agreement membership mapu uz owner-only dokaz, ne samo count. U finalnom batch-u navesti očekivane139 unresolved/gap brojeve iz pregleda pre-backfill izvora; ne određivati ih unapred iz0 Storage objekata.

**F — catalog/RLS/ACL, bez privatnih redova:**

```sql
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_any,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as user_any,
 has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE') as service_any
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='private' and c.relkind in('r','p') order by c.relname;
select schemaname,tablename,policyname,permissive,roles,cmd,
 md5(coalesce(qual,'')||'|'||coalesce(with_check,'')) as expression_md5
from pg_policies where policyname in('v5_closed_account_visibility','v5_closure_storage_fence')
order by schemaname,tablename,policyname;
select id,public from storage.buckets where id in('profile-media','data-export-artifacts');
```

Uporediti tačan catalog/ACL snapshot sa verifikovanim disposable final source-om i prethodnim live snapshot-om. Nije svaki istorijski private objekat nužno isti ACL obrazac; ne „popravljati“ nepoznati stari grant naslepo. Novi V5 private poslovni ledgeri ne dobijaju anon/authenticated/service direktni pristup. Posebno proveriti execute prava authenticated vs service-only RPC-a po zamrznutom SQL-u, kao i odsustvo PUBLIC execute na private helper-ima. Sve139 Storage zaštite moraju ostati pored postojećih owner politika; nijedna zaštitna politika sama ne daje novi javni pristup.

## 6. Redosled dokaza i stop ponašanje

1. **Pre odobrenja:**30 reporta tačnog sačuvanog140 izvora; pregled pune32 forward datoteke/11 bundle-a; sveži preflight, stvarna publika, stari klijenti, brojevi137/139 backfill-a i maintenance/restore obim. Ne koristiti sintetičke CI policy/pravne aktore u live-u.
2. **Pre migracija:** sačuvati history/counter/catalog/function/policy/scheduler/Edge metadata baseline i odobreni način quiescence-a. Zatvoriti samo konkretne unapred odobrene provider admission zastavice i ne menjati credentials/keys naslepo. Nemati nekontrolisan postojeći evaluator/klijent tokom124/125 aktivacije. Gore navedene nove zastavice važe za pregledani V5 source; ne pretpostavljati da ih prethodni deploy podržava bez njegovog zasebnog pregleda.
3. **Svaka transakcija:** tačni odobreni bajtovi, postojeći lock/statement timeout-i i ugrađeni predecessor/postcondition guard-ovi. Posle uspeha proveriti history append, prethodne hash-eve i ciljane postuslove. Prvi neuspeh zaustavlja sledeći korak. SQL greška/lock timeout nije dozvola za preskakanje guard-a ili historical rewrite.
4. **Ako DDL čeka:** sačuvati bounded pid/state/wait/relation/mode/blocking_pids metapodatke dok wait traje. Bez query teksta i credentials. U run34730098067 dva puta je131 imala lock_timeout, dok novi34731211318 isti SQL prolazi bez observed wait-a; konkretan istorijski blocker nije dokazan. Ne tvrditi da je problem uklonjen ili promeniti production SQL samo na osnovu prolaznog ponavljanja.
5. **Deploy i auth smoke:** prvo stvarni bundle/readback, zatim unapred dozvoljeni negative-auth/malformed-input testovi bez validnog owned mutation konteksta. Ne predstavljati push probe, export grant, maintenance tick, Storage upload ili WS rezervaciju kao read-only proveru. Prava pozitivna native/Edge/Auth/server/govor/fotografija/objava proba ostaje tačno opisana u plaćenom/poslovnom batch-u.
6. **Pre ponovnog puštanja rada:** svi osnovni read DTO/ACL/hook i source/binding rezultati zadovoljeni; scheduler vraćen u prethodno odobreno stanje tek kada ne može potrošiti neodobrenu otvorenu politiku. Ako mora ostati pauziran, eksplicitno evidentirati zastoj expiry/dispatch/completion/export/retention i naredni konkretni oporavak. Ne ostaviti korisniku privid normalnog automatskog rada.
7. **Incident/unknown:** zaustaviti nove odgovarajuće dispatch-e/admission, zadržati postojeće durable potvrde i pune rezervacije nepoznatog ishoda; prvo owned read/recovery. Već uspešne SQL migracije se ne „vraćaju“ `migration repair`, reset-om, brisanjem redova ili prepisivanjem hash-eva. Ispravka je nova pregledana forward migracija. Stari Edge bundle vraćati samo uz dokaz kompatibilnosti sa novom šemom; u suprotnom ostaviti konkretnu funkciju zatvorenu.

Ovaj plan ne zatvara preostale vlasničke/legal/identity/support/HITNO odluke i ne tvrdi live poziv modela, stvarnu objavu, fizički mikrofon/GPS ili dostavljen push. Instalabilni signed138 APK i UI snimci su poseban, već napravljen dokaz tačnog54abcbe izvora.
