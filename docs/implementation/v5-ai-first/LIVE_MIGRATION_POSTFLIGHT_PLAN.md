# V5 forward109–144: konkretni postflight i zaustavljanje

**Najnovija vlasnička odluka AF-D26:** `leqcwgzvjsxugfgzdmth` je canonical
DEV/ALPHA i dozvoljena je potrebna proverena backend promocija za povezani APK.
Ovaj projekat jeste naredni razvojni cilj; dodatni staging i novi blanket live
approval nisu potrebni. Zabrana do **ODOBRAVAM LIVE DEPLOY** ostaje samo za
zaseban budući production projekat. Tehnički preflight/postflight, tačan Git
izvor, izolovani dokazi, zaštita postojećih podataka i rekonstrukcija ostaju
obavezni. Istorijski zahtevi za dodatnu dozvolu ovog istog DEV cilja u nastavku
nisu aktivna kapija. Ovaj zapis sam ne tvrdi da je išta primenjeno.

Ovaj plan izvršava već odobrenu AF-D26 DEV/ALPHA promociju; nije zapis da je
izvršena. Poslednji sačuvani izvor pre integracije144 je78bbd1cb338e,
tree2ac97f7b45d9. Manifest na tom izvoru ima35 migracija109–143 i11 Edge
funkcija. Privatne Agreement fotografije144 su dodatni pregledani kandidat;
pre primene obnoviti manifest iz sačuvanog izvora koji ih stvarno sadrži.

Actual FULL143 run34744679836 na78 završio je07:20:28UTC FAIL:11 source
gates,190 Jest suites/3949 testova,740 Node testova PASS;135 je prošao pet
provera pa stao na LOCAL_RPC57014 statement timeout-u.136–143 nisu dostignuti.
Artifact SHA256745e632f5009c06e18408fae1d567e39e979ee0874ef777e512e6d00e0b7e868.
Ispituje se tačan poziv bez povećanja timeout-a. Raniji70 run34743587492 ima
27 actual izveštaja do137 PASS;138 je otkrio neusaglašeno očekivanje zatvorenog
HTTP korisnika.78 sadrži korekciju tih138/141/142 proof očekivanja i stvarno
143 povezivanje odobrenog support safe-exit-a u tačni HTTP pre-request guard.
Novi izvor mora proći FULL144/34 actual izveštaja. Pojedinačni stariji prolazi
nisu potvrda celog novog izvora.

Fresh canonical preflight07:14:22UTC:108 migracija,3 Auth naloga,7 Task-ova,
2 Agreement-a/verzije,0 profile-media objekata i0 retention politika; oba bucket-a
su private, postojeći cron i pet Edge verzija nepromenjeni. Svi108 predecessor-i
su provereni:87 istorijskih stored-statement MD5 i21 tačnih source/alias MD5.
Detalji su u DEV_ALPHA_PREFLIGHT_20260913.json; neposredno pre primene ponoviti
brojače/digest-e i uporediti novi drift. Nije bilo backend mutacija.

## 1. Poznato početno stanje i svež read-only dodatak

[LIVE_READONLY_BASELINE.json](LIVE_READONLY_BASELINE.json), posmatrano2026-09-13 01:20:27 UTC, beleži projekat `leqcwgzvjsxugfgzdmth`,108 migracija, head `20260911031713 clean_dispatch_need_lock_order`,3 naloga,7 Task-ova,2 Agreement-a,0 `profile-media` objekata i0 aktivnih pregledanih publication bundle-a. To nije odobrenje za menjanje tih podataka.

Root je naknadno2026-09-13 read-only proverio: tačno jedan cron job, `jobid=1`, `uskoci_marketplace_tick`, `* * * * *`, active=true, database/username=`postgres`, command MD5 `93518fd0382301fc76f79037123bccfc`. Boolean poređenje potvrđuje tačno `select private.marketplace_tick(25);`. Nema otvorenih `cron.job_run_details` redova u tom trenutku. `pg_roles.rolconfig` za authenticator nema `pgrst.db_pre_request`; relevantni `pg_db_role_setting` override-i takođe su prazni. Ovo **ne dokazuje** odsustvo spoljašnjeg PostgREST environment override-a, niti garantuje da se novi cron posao neće pokrenuti posle očitavanja.

Sve ove tačke osvežiti neposredno pre odobrenog izvršenja. Sačuvati ograničen inventar/hash-eve, bez SQL command teksta ako bi nepoznat posao mogao sadržati ključ, privatnih poruka ili tokena.

Dodatni read-only upiti u02:12:36 i02:13:05 UTC vratili su samo brojače i klasifikaciju, bez sadržaja/putanja:2 Agreement verzije,0 podobnih novih grupa/članstava,2 otvorena problem konteksta,0 aktivnih hold-ova,0 AI turn komandi i0 retention policy set-ova.119 safety i130 owned-media tabele još ne postoje na108. Obe prihvaćene izvorne photo liste rekonstruisane su kao dokazivo prazne. Ako se podaci ne promene i novi registri ostanu prazni,139 će dati2 RESOLVED prazna snapshot-a,0 UNRESOLVED,0 refs i0 istorijskih safety gap-ova. To je uslovna projekcija, ne izvršen backfill. Sačuvano u `LIVE_READONLY_BASELINE.json` readOnlyAddenda; osvežiti u dogovorenom mirnom prozoru.

## 2. Raspored koji već radi i šta aktivacija stvarno može pokrenuti

Aktuelni `private.marketplace_tick` već poziva, redom, `expire_lifecycle`, `dispatch_tick`, `rpc_tick_auto_completion`, `data_export_maintenance` i `retention_maintenance`. Izvor je [P3 execution105](../../../supabase/migrations/20260910162955_clean_p3_retention_execution_authority.sql);108 je kasnije popravio zaključavanje dispatch/expiry funkcija. Nema novog cron-a u109–144;140–144 ne menjaju postojeći raspored.

| Postojeći/predloženi potrošač | Šta radi bez novog rasporeda | Kapija i postflight |
| --- | --- | --- |
| Minutni marketplace tick | Ističe rokove/obaveštenja, nastavlja dispatch, automatski završava podobne Agreement-e. To su postojeće poslovne izmene, ne read-only health check. | Uporediti aktivni job/command hash i status poslednjeg završetka. Ne pozivati tick ručno radi provere; najpre kontrolisati stvarnu publiku i eventualno održavanje. |
| Isti tick → `data_export_maintenance` | Briše istekao privremeni `snapshot_text`, označava READY export kao EXPIRED i opoziva download grant. Ne briše Storage objekat. Već nastale obaveze održavanja ne zavise od novog AI flaga. | Inventar postojećih export statusa, artifact/lease/expiry/cleanup brojača. Ne nazivati ga potpuno zatvorenim samo zato što novo generisanje export-a nije spremno. |
| Isti tick → `retention_maintenance` | Poziva claim i izvršava do25 podobnih P3 AI retention poslova. To može stvarno obrisati dozvoljeni napušteni, nevezani AI razgovor i njegove dozvoljene child redove. | Zahteva stvarni `retention_execution_binding` i podržan source/candidate/hold/closure ugovor.140 vraća podržan source; **ako već postoji validna izvršna politika, može ponovo otvoriti postojeći automatski potrošač**. Closure Edge flag nije kapija ovog SQL posla. |
| `uskoci-data-export-worker` | User `prepare/cleanup` obrađuje samo njegovu tačnu potvrdu; interni `tick` može pripremiti/počistiti postojeći red. Storage upload/delete se obavlja u Edge-u. | Nema posebnog enable env flaga u ovom source-u. Nova priprema je vezana za reviewed export/Privacy/source digest. Stari artifact cleanup ima sopstveni autoritet. Ne slati maintenance/tick kao bezazlen probe. |
| `uskoci-push-transport` | Service-only `tick` čita postojeće delivery/attempt ledgere i poziva Expo. `probe` upisuje readiness i kada je disabled. | `EXPO_PUSH_TRANSPORT_ENABLED` mora ostati false dok konkretan transport scenario nije odobren. Disabled `tick` ne radi DB/provider IO; `probe` nije read-only. Deployment sam ne uvodi raspored. |
| `uskoci-account-closure-worker` | Service-only jedan account/generation ili bounded maintenance1..8. Može obrisati pripremljene Storage objekte i soft-obrisati Auth identitet uz zadržan application subject. | `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED` default false, dodatno tačna izvršna politika, owned start/generation/dispatch, dokazni i hold guard-ovi.131 ne instalira cron; **ne uključivati** bez zasebne konkretne dozvole. |
| Publication/QA provider | Nema cron consumer-a za Gemini u pregledanom SQL-u. Postojeći korisnik/klijent ipak može inicirati poziv čim policy/source/env dozvole. |127 allowlist ograničava plaćeni AI poziv, ne javnost marketplace-a, čitanje objave ili sve legacy poslovne RPC-eve. |
| Support143 | Authenticated autori mogu otvoriti sopstveni case čim se primene RPC grantovi; operatorov pristup zahteva zaseban aktivan singleton grant. Novi safety report dobija case atomskim trigger-om. |Nema support allowlist-a ili enable env flaga. Prazan/revoked operator grant ne zatvara author CREATE. Privatni APK i127 AI allowlist ne izoluju ovu publiku; finalni batch mora obuhvatiti stvarne postojeće naloge. |

Predlog finalnog batch-a treba da izričito obuhvati kratko održavanje postojećeg jobid1, očuvanje njegove tačne konfiguracije, proveru da se prethodna izvršenja stvarno završila i kasnije vraćanje njegovog prethodnog active stanja. Sama činjenica `end_time IS NULL`=0 pre pauze nije drain dokaz. Ako pauza nije u odobrenom batch-u ili se ne može bezbedno završiti drain, ne improvizovati `pg_terminate_backend`, ne povećavati lock timeout i ne menjati SQL radi prolaza. Ne zaustavljati zauvek auto-completion/expiry da bi se uklonio simptom.

## 3. Migracije koje menjaju više od dostupnosti novih RPC-eva

Sve datoteke primenjivati u tačnom redosledu iz obnovljenog [LIVE_BATCH_CANDIDATE.json](LIVE_BATCH_CANDIDATE.json); ova tabela nije zamena za36 punih datoteka i njihove hash-eve.

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
|**140 — registrovan, actual CI nastavak pending** |Narrow P3 source compatibility i shared closure lock u postojećim claim/execute/candidate putanjama. Isključuje7 novih non-FK command/review/media sidecar izvora iz starog volatile purge-a. Ne seed-uje rok/policy i ne menja raspored; može vratiti izvršnost **već** validne P3 politike. Posmatrani live ima0 takvih politika; finalno osvežiti pre admission-a. |
|**141 — registrovan, actual CI pending** |Postojeći `private.worker_ai_turns` dobija3 kolone: `provider_dispatched` se za stare redove konzervativno postavlja na true, za nove default=false; `cancelled_at` i `user_message_id` za stare ostaju null. Nema novih relacija/FK, brisanja poruka ni izmišljene veze sa starom porukom. Owned read/cancel i service dispatch koriste isti account/session/key autoritet. Otkazivanje pre dispatch-a trajno zatvara isti zahtev; nepoznat već dispatchovan zahtev ne dobija novu provider obradu. Samo dokazano otkazana poruka sa tačnom novom message-ID vezom izostaje iz budućeg provider konteksta, dok owned istorija ostaje.141 zahteva tačna128 claim/complete/context tela i tačno140 readiness telo, zatim osvežava tehnički closure digest i samo njegov vezani literal u140 guard-u. Ne menja allowlist, candidate, rokove ni policy redove. Export ostaje42 dataset-a, prelazi na `OWN_ACCOUNT_V5_5` i dodaje samo `cancelledAt` postojećem own `workerAiTurns`; provider metadata/request key/message veza ne ulaze u export. |
|**142 — registrovan, actual CI pending** |AF-D15 dozvoljava eksplicitno odustajanje i posle Task/Worker dispatch-a uz zadržanu potrošnju. Isti zahtev postaje terminalni FAILED sa `cancelled_at`; `provider_dispatched` i rezervacija ostaju. Ako completion pobedi, vraća se stvarni raniji receipt; ako cancel pobedi, kasni completion ne menja kandidat/profil/poruke. Nema novog provider poziva, retry-ja, refund-a, brisanja istorije, promene postojećih redova ili export42/V5_5. Menjaju se tačno cancellation constraints/helper-i i tehnički source seal, uz očuvanje140 guard-a. |
|**143 — registrovan, actual CI pending** |AF-D17/18 uvodi10 private RLS tabela za support, own/autorizovane operator RPC-eve, ne seed-uje operatora. Za svaki postojeći safety report pravi novi case RECEIVED/revision1/sequence1 i jedan početni event, **bez obzira na prethodni status report-a**; originalni report ostaje nepromenjen. Novi trigger-i nastavljaju atomsku vezu. Predate Task/review fotografije mogu dobiti143 evidence reference kroz postojeću139 zaštitu; nema novih upload-a ili automatskog prenosa celog chata. Svaki vlasnik case-a dobija `SUPPORT_RETENTION_POLICY_NOT_READY`, uključujući CLOSED case, dok nedostaje pregledan retention ugovor. Closure katalog dobija10 relacija u3 postojeće klase, export42→49/`OWN_ACCOUNT_V5_6`, a source roster6→33 tačna helper-a. Ne aktivira policy, Gemini, sankcije, objavu, push ili rokove čuvanja. |
|**144 — registrovan, actual CI pending** |Privatne bilateralne fotografije:1 private FORCE RLS upload tabela, eksplicitni message asset ID-evi, immutable Storage/asset/message granice,120/24h i12/min anti-abuse, novi photo RPC uz neizmenjene text writer-e. Oporavak čita isti dispatch; nema novog POST-a pri nepoznatom ishodu. Support prima samo odabrani message snapshot. Closure inventar dobija tačne Storage putanje, export49→50/V5_7, source seal33→45. Nema grupnih fotografija, Gemini obrade privatnih slika, javnih URL-ova, policy seed-a ili30-dnevnog brisanja istorije. |

Posle140 closure digest i dalje odgovara139 inventaru;141–143 ga namerno menjaju i tačno ponovo vezuju neizmenjeni140 guard. Ne očekivati isti139/141/143 digest. Stari closure source i export projection binding-i nisu prepisani niti odobreni ovom tehničkom izmenom i ostaju nevažeći za novu projekciju/inventar. Postojeća validna P3 retention politika ima zaseban ugovor: tehnička source kompatibilnost može ostaviti već dozvoljeni retention consumer izvršivim. SourceReady=true nije PolicyReady=true. Pri novoj obaveznoj kategoriji/projekciji očekivan NOT_READY ne „popravljati“ dopisivanjem lažnih pravnih podataka.

## 4. Jedanaest Edge entrypoint-a: konkretan auth/deploy ugovor

Repo pri pregledu nema `supabase/config.toml`. Zato finalni deploy manifest mora eksplicitno navesti auth podešavanje svake funkcije i stvarni readback. Predlog za **ovaj postojeći source/legacy key transport** je `verify_jwt=true` za svih11; kod i dalje proverava pravi Auth account ili tačno interni service credential. Ovo nije predlog migracije ključeva ili novog auth SDK-a.

| Funkcija | Handler/auth i namena | Predlog zatvorenog početnog stanja / poseban dokaz |
| --- | --- | --- |
|`uskoci-ai-interview` |User Bearer, stvarni Auth i owned intake,132 dispatch pre provider-a, stream ili istorijski HTTP. |Eksplicitno `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.8-flash`, `AI_TEST_BUDGET_REQUIRED=true`, `USKOCI_GEMINI_PAID_TEST_ENABLED=false`;127 disabled. Sam paid=false nije potpuni legacy kill switch uz proizvoljan drugi provider/model ili auto-fallback. |
|`uskoci-worker-interview` |User Auth +owned PROFILE/session+revision;141 durable claim, zaseban dispatch pre Gemini-ja i tačan recovery. |Isti tačan provider/model i paid flag, closed127. Zahteva141 RPC-eve; ne puštati novi handler na128 šemu niti uklanjati dispatch radi kompatibilnosti. Samo explicit owned save može sačuvati/aktivirati profil. |
|`uskoci-publication-evaluate` |User Auth, tačan owned Need/review/policy context,126 eval claim/dispatch+127. |Paid=false; `USKOCI_GEMINI_IMAGE_REVIEW_ENABLED=false` do odobrene odabrane slike. Sama obična HTTP proba sa validnim review-em može rezervisati/pozvati model. |
|`uskoci-qa-classify` |User Auth +context/hash/classification/recovery+135 dispatch i127. |Paid=false; `USKOCI_QA_CLASSIFIER_ENABLED=false`; nedostajući reviewed QA dokument ostaje zatvoren. |
|`uskoci-location-search` |User Auth, bounded LocationIQ forward/reverse; read-only prema aplikacionoj bazi. |Postojeći provider/key, bez novog provider izbora. Stvarni query ipak izlazi LocationIQ-u i nije dokaz samo deploy-a. |
|`uskoci-media` |User Auth +owned Task/avatar scope; server derivative, Storage i durable key/recovery; bez Gemini.143 dodaje čitanje tačno case-bound fotografije preko service RPC-a sa stvarnom human session/case/grant proverom. |Nema opšteg enable flaga. Proveriti tačan `npm:@imagemagick/magick-wasm@0.0.43`, `magick.wasm` asset i sve lokalne import-e u stvarnom bundle-u. Deno2.9.6 lokalni smoke ne dokazuje hosted bundler/Storage tok. Operator photo read upisuje audit; nije read-only DB smoke. |
|`uskoci-data-export-download` |User Auth +owned receipt/generation, kratki jednokratni DB grant i ponovna provera uz privatne bytes. |Nije čist read-only healthcheck: authorize kreira download grant. Za negativni anon test ne slati validan owned receipt. |
|`uskoci-data-export-worker` |Dual: user prepare/cleanup tačne potvrde ili interni service `tick`. `Transport.isInternal()` poredi ceo očekivani `SUPABASE_SERVICE_ROLE_KEY`, ne samo claim `role`. |Legacy service-role JWT ide samo interno u Bearer; handler ne prihvata običnog user-a za tick. Bez scheduler-a/maintenance poziva dok njihov scope nije odobren. |
|`uskoci-push-transport` |Samo exact service Bearer. User/anon ne smeju claim-ovati delivery. |`EXPO_PUSH_TRANSPORT_ENABLED=false`. Čuvati razliku probe-upis / ticket / provider receipt / stvarni uređaj. |
|`uskoci-account-closure-worker` |Samo exact service Bearer uz existing shared transport; nikad user-owned start preko Edge-a. |`USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED=false`. Bez maintenance smoke-a koji stvarno briše. |
|`uskoci-speech-session` |Native WS GET sa `Authorization` i `apikey` headers; URL sadrži samo opaque conversationId/operationId. Auth+owned OPEN conversation+127 pre upstream-a. |Paid=false i `USKOCI_SPEECH_CONTROLLED_TEST_ENABLED=false`; verify_jwt=true. Browser savet za token u URL/no-verify-jwt nije ovaj native transport. Kasnije stvarno proveriti hosted Upgrade i final frame/close; nema reconnect-a niti tokena u URL. |

Zvanična dokumentacija opisuje gateway i handler kao odvojene auth slojeve, pa gateway acceptance nije account autorizacija. Za novi API-key-only service obrazac dokumentovan je drugi transport; njega ovaj source ne implementira. [Supabase authorization headers](https://supabase.com/docs/guides/functions/auth-headers), [service auth](https://supabase.com/docs/guides/functions/auth). Browser WebSocket nema custom header opciju, ali postojeći React Native adapter je koristi; održavanje upgrade-a koristi `EdgeRuntime.waitUntil`. [Supabase WebSockets](https://supabase.com/docs/guides/functions/websockets).

Sačuvati stare5 Edge verzije/EZBR hash-eve iz baseline-a, a posle deploy-a svih11: version/status/verify_jwt/EZBR i sadržaj stvarnog bundle-a sa lokalnim i npm/WASM zavisnostima. Hash samo `index.ts` nije sufficient bundle dokaz. Ne koristiti `--no-verify-jwt` kao popravku gateway401 bez konkretnog transport/auth pregleda. Hosted asset nedostajanje ili gateway/handler auth mismatch zaustavlja rollout tog toka; ne premešta se provider key u APK.

Lokalni `scripts/prepare-v5-edge-payloads.cjs --source <40-char SHA>` priprema tačne MCP JSON payload-e iz Git objekata, bez uvoza/izvršenja product koda ili mreže. Za2b0542c0 manifest je regenerisan:11 funkcija,29 per-function unosa/22 jedinstvena source fajla; svaki sadržaj i konačan payload imaju SHA256. Manifest u `artifacts/v5-edge-payloads/2b0542c0401a51a30edaa3d67bdae0101e7a281d/manifest.json` ima SHA256 `e4ddecd15dfe73f695451efe193de751d2bf545d68426a4293ae5d1054728e2e` i vezan je u LIVE_BATCH_CANDIDATE.json. To je lokalna priprema, ne deploy potvrda. Eksterni `npm:@imagemagick/magick-wasm@0.0.43` i njegov `magick.wasm` zabeleženi su kao spoljne zavisnosti; **njihovi bajtovi nisu u lokalnim tekstualnim payload-ima**. Supabase zvanični [image-manipulation primer](https://supabase.com/docs/guides/functions/examples/image-manipulation) koristi npm WASM resolver, ali to ne zamenjuje hosted readback našeg bundla. Za zasebne lokalne WASM/static fajlove postoji drugačiji [static_files deployment ugovor](https://supabase.com/docs/guides/functions/wasm); ne dodavati ih API payload-u kao neproverenu zamenu.

## 5. Konkretni read-only upiti i očekivanja

Izvršavati kroz privilegovanu DB SQL konekciju (postgres/admin), samo blokove za tada postojeći ordinal;Worker tabele iz128 i nove kolone iz141 nisu dostupne u početnoj108 šemi. Privatne tabele/helper-i nisu dostupni običnom anon/authenticated/service-role REST pozivu. Svaki rezultat vezati za server timestamp/project/history ordinal. Ovi upiti ne claim-uju posao, ne pozivaju tick, ne prave export grant i ne šalju provider zahtev.

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

**D — odvojene zatvorene kapije, očekivanja po konkretnom koraku:**

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

Pre plaćenog batch-a očekivati127 disabled/0/0, ceiling5000000 i predviđen expiry, ako nije bilo zasebno odobrenih poziva; postojeće rezervacije sačuvati. Ne resetovati ledger da proba stane u budžet.140–143 mogu imati source_ready=true uz sva tri policy_ready=false; to je ispravno zatvoreno stanje. Neposredno posle141 i142 export katalog ima42 dataset-a/`OWN_ACCOUNT_V5_5`, sa istim own filtrom i cancellation timestamp-om u `workerAiTurns`. **Finalno posle143 očekivati49 dataset-a/`OWN_ACCOUNT_V5_6`**, sedam novih own support projekcija i nov compiled binding. Postojeći export/retention job i artifact brojači se porede odvojeno; null policy nije dozvola za brisanje njihove evidencije.

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


**G — tačan141 pre/postflight, bez slanja, otkazivanja ili provider poziva:**

Prvi blok izvršiti neposredno pre141 (posle140), pa isti blok ponoviti posle141 u dogovorenom mirnom prozoru. Worker tabela postoji od128; ne izvršavati ga na108. Sačuvati prethodni broj/core hash, stanje po stvarnom enum-u i policy hash. `UNKNOWN_OUTCOME` je izvedeno read stanje za istekli PROCESSING lease, nije vrednost SQL kolone `state`.

```sql
select count(*) as turns,
 encode(sha256(convert_to(coalesce(jsonb_agg(
  to_jsonb(t)-array['provider_dispatched','cancelled_at','user_message_id']
  order by t.turn_id),'[]'::jsonb)::text,'UTF8')),'hex') as prior_columns_sha256
from private.worker_ai_turns t;
select state,count(*) as turns,
 count(*) filter(where state='PROCESSING' and lease_expires_at<statement_timestamp()) as expired_processing
from private.worker_ai_turns group by state order by state;
select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(p) order by p.id),
 '[]'::jsonb)::text,'UTF8')),'hex') as policy_rows_sha256
from private.retention_policy_sets p;
select md5(replace(p.prosrc,s.sha256,'__SOURCE139_SHA256__'))
 ='75b560d9a71baa045f8e7f80cd77aada' as exact_140_guard,
 s.sha256=private.closure_source_digest_v5() as closure_source_current
from pg_proc p cross join private.closure_source_v5 s
where p.oid='private.retention_ai_source_ready()'::regprocedure and s.singleton;
```

Broj redova, `prior_columns_sha256`, stvarni state brojači i `policy_rows_sha256` ostaju isti kroz samu141; `expired_processing` može porasti samo protokom vremena i nije novi dispatch. Oba guard boolean-a moraju biti true pre i posle. Novi closure SHA se beleži kao namerna141 promena; njegovu vrednost porediti sa tačnim disposable141 izvornim inventarom. U catalog-u izF ne očekuje se nova privatna relacija.141 ne dodaje FK; postojeća Worker veza ka `worker_ai_sessions` ostaje, a incoming FK ka `ai_messages` mora ostati0 kako proverava sledeći blok.

Sledeći blok je **neposredno posle141, pre142** i pre bilo kog user/provider test slanja:

```sql
select a.attname,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull,
 pg_get_expr(d.adbin,d.adrelid) as default_expression
from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid='private.worker_ai_turns'::regclass and a.attnum>0 and not a.attisdropped
and a.attname in('provider_dispatched','cancelled_at','user_message_id') order by a.attname;
select count(*) filter(where provider_dispatched) as conservative_existing_dispatch,
 count(*) filter(where not provider_dispatched) as undispatched,
 count(*) filter(where cancelled_at is not null) as cancelled,
 count(*) filter(where user_message_id is not null) as linked_messages
from private.worker_ai_turns;
select count(*) as incoming_message_fks from pg_constraint
where contype='f' and confrelid='public.ai_messages'::regclass;
select pg_get_constraintdef(oid,true) as cancellation_constraint from pg_constraint
where conrelid='private.worker_ai_turns'::regclass and conname='worker_ai_turn_cancelled_fence';
select d->>'key' as dataset,d->'fields' as fields,d->>'ownershipFilter' as ownership_filter
from jsonb_array_elements(private.data_export_dataset_catalog()) d where d->>'key'='workerAiTurns';
```

Očekivati3 kolone: `provider_dispatched` boolean NOT NULL/default false; `cancelled_at` timestamptz i `user_message_id` uuid nullable/bez default-a. Neposredno posle mirne141 migracije `conservative_existing_dispatch` je prethodni broj turnova, a ostala3 brojača su0; true nije dokaz stvarnog poziva ili potrošnje. Incoming message FK count ostaje0. **Samo u141 stanju** constraint dozvoljava cancellation uz FAILED, provider_dispatched=false i completion_hash=null;142 namerno uklanja uslov provider_dispatched=false. Export fields su tačno `cancelledAt,conversationId,createdAt,id,state`, filter `t.account_id=REQUEST_ACCOUNT`; neposredno posle141 D pokazuje42 dataset-a/V5_5. To nije finalno143 očekivanje. Source/runtime oznaka potvrđuje se poređenjem zamrznutog compiled snapshot/policy-binding izvora; ne generisati stvarni export radi proveravanja verzije.

Za tačna141 execute prava koristiti samo metadata, bez poziva recovery/cancel/dispatch-a:

```sql
select x.signature,p.oid is not null as present,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as user_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute,
 exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
from (values
 ('private.worker_ai_turn_recovery_v5(uuid,uuid,uuid)'),
 ('public.rpc_read_worker_ai_turn_recovery(uuid,uuid,uuid)'),
 ('public.rpc_cancel_worker_ai_turn(uuid,uuid,uuid)'),
 ('public.rpc_dispatch_worker_ai_turn_service(uuid,uuid,uuid,uuid)'),
 ('public.rpc_read_worker_ai_context_service(uuid,uuid)')
) x(signature) left join pg_proc p on p.oid=to_regprocedure(x.signature) order by x.signature;
```

Svih5 signature-a mora postojati. Anon/PUBLIC su false za sve; authenticated true samo za owned read/cancel; service true samo za dispatch/context; private helper nema nijedan od navedenih grantova. Sama141 ne claim-uje Worker turn, ne poziva Gemini, ne zapisuje novu USER poruku niti učitava audio. Oporavak/cancel↔dispatch race i izostavljanje otkazanog teksta iz sledećeg provider konteksta pripadaju tačno vezanom actual141 CI dokazu i kasnijem posebno odobrenom native testu, ne ovim read-only upitima.

**H —142: promena ugovora odustajanja, bez odustajanja tokom postflight-a:**

[SQL142](../../../supabase/migrations/20260913044510_clean_v5_unknown_ai_turn_exit.sql) menja dve imenovane constraints i tačno pregledana Task/Worker recovery/cancel/complete tela. Pre i posle mirne primene sačuvati brojače i interne aggregate SHA256 postojećih `private.ai_need_turn_commands`, `private.worker_ai_turns`, vezanih poruka/kandidata,127 rezervacija i retention policy redova. U izlaz idu samo brojevi/hash-evi, bez UUID-eva komandi, narativa ili provider podataka. Sama migracija ne menja te redove: broj i hash moraju ostati isti; tehnički closure source hash se namerno menja.

```sql
select c.conrelid::regclass::text as relation,c.conname,c.convalidated,
 pg_get_constraintdef(c.oid,true) as constraint_definition
from pg_constraint c where
 (c.conrelid='private.ai_need_turn_commands'::regclass and c.conname='ai_need_turn_cancelled_check')
 or (c.conrelid='private.worker_ai_turns'::regclass and c.conname='worker_ai_turn_cancelled_fence')
order by relation;
select 'TASK' as kind,count(*) as turns,
 count(*) filter(where provider_dispatched) as dispatched,
 count(*) filter(where cancelled_at is not null) as cancelled,
 count(*) filter(where cancelled_at is not null and provider_dispatched) as cancelled_after_dispatch
from private.ai_need_turn_commands
union all
select 'WORKER',count(*),count(*) filter(where provider_dispatched),
 count(*) filter(where cancelled_at is not null),
 count(*) filter(where cancelled_at is not null and provider_dispatched)
from private.worker_ai_turns;
```

Oba constraints moraju biti validated. Finalno142/143: Task cancellation zahteva `state='FAILED' AND receipt IS NULL`; Worker zahteva `state='FAILED' AND completion_hash IS NULL`. Nijedan više ne zahteva `provider_dispatched=false`. Metadata/helper SHA porediti sa tačnim disposable142 izvorom; ACL ostaje isti. Izvršeni cancel nije read-only proba. Kasniji odobreni scenario dokazuje isti UUID, completion-vs-cancel race, terminalni owned recovery i odsustvo kasnog upisa. `canCancel=false`/`retry=false` posle terminalnog cancellation-a ne znači povraćaj novca ili prekid već prihvaćene Google obrade.127 admission/ledger ne menjati da bi se dokaz ostvario. Posle142 export ostaje42/V5_5;143 ga zatim menja.

**I —143: backfill i metadata-only postflight pre operatorskog granta:**

Pre143 (posle142, ne na108) sačuvati sledeće rezultate i prethodne source/policy/ACL hash-eve. Ako postojeći safety report ima RESOLVED ili IN_REVIEW status, njegov novi support case ipak počinje RECEIVED. To mora biti vidljivo u konačnom odobrenom backfill obimu; ne prevoditi stare statuse ili izmišljati ranije operatorske odluke. Po sadašnjem108 pregledu119 tabela još ne postoji, pa bi miran novi lanac mogao dati0; taj očekivani broj treba stvarno ponovo izmeriti neposredno pre143.

```sql
select status,count(*) as reports from private.safety_reports group by status order by status;
select count(*) as reports,
 encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb)::text,'UTF8')),'hex') as safety_rows_sha256
from private.safety_reports r;
```

Posle143 ponoviti isti hash upit. Originalni safety report redovi ostaju identični. Svaki dobija tačno jedan case i početni event sa originalnim owner-om/vremenom; narativ ostaje u originalnom safety report-u, ne u novom event body-ju. Sledeće SQL provere vraćaju samo brojače; ne pozivaju user/operator RPC, tick, grant ili upload:

```sql
select count(*) as cases,
 count(*) filter(where safety_report_id is not null) as linked_safety_cases,
 count(*) filter(where safety_report_id is null) as other_cases
from private.support_cases_v5;
select count(*) as invalid_safety_links from private.safety_reports r
left join private.support_cases_v5 c on c.safety_report_id=r.id
where c.id is null or c.account_id<>r.reporter_account_id
 or c.channel<>'SAFETY' or c.topic<>'SAFETY_REPORT' or c.ordinary
 or c.title<>r.reason or c.status<>'RECEIVED' or c.revision<>1 or c.sequence<>1
 or c.created_at<>r.created_at or c.updated_at<>r.created_at
 or c.context is distinct from jsonb_build_object('kind','SAFETY_REPORT','id',r.id,'revision',null,
  'content',jsonb_build_object('category',r.category,'needId',r.need_id,'agreementId',r.agreement_id,'createdAt',r.created_at))
 or (select count(*) from private.support_events_v5 e where e.case_id=c.id)<>1
 or not exists(select 1 from private.support_events_v5 e where e.case_id=c.id
  and e.sequence=1 and e.actor_account_id=r.reporter_account_id and e.author_role='AUTHOR'
  and e.kind='SAFETY_REPORT' and e.body is null and e.created_at=r.created_at
  and e.decision_id is null and e.appeal_id is null);
select 'operator_grants' as kind,count(*) from private.support_operator_grants_v5
union all select 'operator_audit',count(*) from private.support_operator_audit_v5
union all select 'grant_commands',count(*) from private.support_grant_commands_v5
union all select 'commands',count(*) from private.support_commands_v5
union all select 'read_markers',count(*) from private.support_read_markers_v5
union all select 'evidence',count(*) from private.support_evidence_v5
union all select 'decisions',count(*) from private.support_decisions_v5
union all select 'appeals',count(*) from private.support_appeals_v5;
select count(*) as support_media_refs from private.media_evidence_refs_v5 where source_kind='SUPPORT_CASE';
```

U mirnom migration-only prozoru očekivati `invalid_safety_links=0`, case/event broj jednak tačnom pre143 report broju, `other_cases=0` i sve ostale brojače0.143 backfill ne pravi SUPPORT_CASE media refs: postojeća139 safety zaštita ostaje, a143 refs nastaju tek kada korisnik namerno preda Task/review referencu. Neočekivanu konkurentnu novu komandu ne proglasiti backfill-om; zaustaviti sledeći korak i utvrditi izvor pre nastavka.

F proveru proširiti na tačno deset tabela: `support_operator_grants_v5`, `support_cases_v5`, `support_events_v5`, `support_decisions_v5`, `support_appeals_v5`, `support_evidence_v5`, `support_commands_v5`, `support_read_markers_v5`, `support_operator_audit_v5`, `support_grant_commands_v5`. Svih10 mora postojati u `private`, sa RLS i FORCE RLS, bez direktnog anon/authenticated/service SELECT/INSERT/UPDATE/DELETE i bez PUBLIC grantova. Proveriti i da sekvenca `support_cases_v5_case_number_seq` nije dodeljena tim ulogama. Tačne trigger/constraint/function hash-eve uporediti sa sačuvanim143 izvorom; source seal uključuje33 eksplicitna helper-a, ne proizvoljan wildcard.

Za public RPC-eve upotrebiti isti metadata obrazac izG, sa ovim tačnim potpisima:

| Potpis | Jedina runtime EXECUTE uloga |
| --- | --- |
| `public.rpc_support_set_operator_service_v5(uuid,boolean,integer,uuid)` | service_role |
| `public.rpc_support_media_service_v5(uuid,uuid,uuid,uuid)` | service_role |
| `public.rpc_support_submit_v5(uuid,uuid,text,uuid,integer,text)` | authenticated |
| `public.rpc_support_read_command_v5(uuid,uuid)` | authenticated |
| `public.rpc_support_cancel_command_v5(uuid,uuid)` | authenticated |
| `public.rpc_support_capabilities_v5(uuid)` | authenticated |
| `public.rpc_support_inbox_v5(uuid,text,text)` | authenticated |
| `public.rpc_support_detail_v5(uuid,uuid,text)` | authenticated |
| `public.rpc_support_mark_read_v5(uuid,uuid,text)` | authenticated |
| `public.rpc_support_find_context_v5(uuid,text,uuid)` | authenticated |

Anon/PUBLIC execute ostaju false, a private helper-i nemaju nijedan od tih runtime grantova. `private.closure_source_v5.sha256=private.closure_source_digest_v5()` i tačno normalizovani140 readiness guard moraju biti true; očekivati `retention_ai_source_ready=true`. Finalni export katalog mora imati49 dataset-a, sedam tačnih `ownSupport*` key/field/ownership allowlist-a i compiled `OWN_ACCOUNT_V5_6` verziju. Closure katalog mora uključiti svih10 novih relacija u postojećim AUDIT_SECURITY_LOGS/COMMAND_LEDGERS/NOTIFICATION_DELIVERY klasama. Retention policy redovi ostaju identični pre143 hash-u; export/closure izvršna kapija ostaje zatvorena bez nove pregledane mape. Ne generisati export, ne aktivirati sintetičku politiku i ne brisati case radi provere. `SUPPORT_RETENTION_POLICY_NOT_READY` je očekivani blokator za vlasnika svakog case-a, uključujući CLOSED; nije novi rok čuvanja.

**J — zaseban predlog operator grant/revoke i positive support probe:**

AF-D17/18 su već prihvaćene odluke o granicama i jednom vlasničkom operateru za privatni test; ne tražiti ih ponovo. Konkretan live batch treba da veže potvrđeni owner account, trenutnu grant revision, jedan command UUID i tačne kasnije probe. U ovom dokumentu nema stvarnog korisničkog UUID-a, email-a, tajnog ključa niti izvršenog API poziva.

Grant API je [SQL143, funkcija rpc_support_set_operator_service_v5](../../../supabase/migrations/20260913045824_clean_v5_support_case_authority.sql): `p_account_id uuid`, `p_active boolean`, `p_expected_revision integer`, `p_client_request_id uuid`; rezultat je `{accountId,purpose:'PRIVATE_TEST_OWNER_SUPPORT',active,revision,authoritative:true}`. Zahteva stvarni privilegovani service-role request kontekst. Običan postgres/MCP SELECT bez tog konteksta nije ekvivalent API pozivu; ne uklanjati role guard. Metod transporta i tajni credential ostaju u server izvršenju, van APK-a i logova.

1. Neposredno pre granta privilegovano pročitati samo metapodatke singleton-a i eventualnu potvrdu tačno planiranog opaque command-a. Samo ako singleton stvarno ne postoji, prvi grant koristi `p_expected_revision=0`, `p_active=true` i jedan unapred vezan UUID. Uspeh pravi1 singleton red,1 SERVICE_GRANT audit i1 grant command receipt; vraća revision1. Proveriti ceo receipt i stvarne metapodatke, ne email ili `user_metadata`.
2. Ako odgovor izostane, sačuvati isti key/args. Najpre pročitati tačan `support_grant_commands_v5` zapis i trenutni singleton kroz odobren privilegovani read. Isti key/args ima kanonski replay, dok drugačiji args odbijaju `SUPPORT_KEY_REUSED`; novi UUID nije automatski oporavak. Ako je account u međuvremenu closing, i identičan aktivacioni poziv može pasti pre replay-a, pa je read potvrde potreban. Sačuvati samo opaque receipt/revision/hash; ne objavljivati account identitet.
3. Postoji jedan singleton i jedan aktivan operator. Za opoziv je ista API sa `p_active=false`, **stvarno trenutnom revision** i zasebnim unapred odobrenim command UUID-em. Opoziv inkrementira revision i čuva audit/receipt/case/evidence. Promena naloga zahteva prvo opoziv starog granta. Race sa već commitovanom radnjom čuva postojeći receipt; grant revocation ne briše raniji odgovor ili već pročitani sadržaj. Pri unknown/stale stanju ne nagađati novu revision ili novi key.
4. `capabilities` i owned `findContext` mogu služiti unapred odobrenim authenticated read proverama. Operator OPERATOR/SAFETY inbox, čitanje tuđeg case detalja i case fotografije **upisuju audit**; `markRead` upisuje watermark. Uvrstiti ih kao konkretne operacije, ne metadata-only smoke. Grant nema pravo na ceo privatni chat, susednu neizabranu poruku, novi upload ili Gemini obradu support sadržaja.
5. Pozitivni scenario treba unapred navesti drugog kontrolisanog autora, jednu poruku ili Task/review referencu, CREATE→CLAIM→odgovor→DECIDE→APPEAL tok, opaque komande i očekivane receipts. Kada je operator i sam autor, viewerRole je AUTHOR; to nije nezavisna presuda sopstvenom zahtevu. Odluka ima `effect=NONE` i ne objavljuje Task/Q&A niti menja Agreement/sankciju. Nijedan scenario se ne izvršava samim ovim planom.

Autorstvo ostaje otvoreno svim stvarno authenticated nalozima projekta koji nisu pod izvršnim closure ograničenjem. **Prazan/opozvan operator grant nije author kill switch.** Nema support allowlist-a ili enable flaga; kontrolisana publika i miran prozor moraju biti konkretni. Stop obim treba unapred odvojiti na nove provider admission-e, eventualni operator revoke i postojeće author poslovne radnje. Ne uvoditi neodobren globalni prekid Auth-a, novu policy ili brisanje privatne evidencije kao improvizovani rollback.

## 6. Redosled dokaza i stop ponašanje

AF-D26 odobrava ovaj razvojni cilj i potrebne proverene backend operacije.
Dodatna staging/live dozvola se ne traži za canonical DEV/ALPHA. Za zaseban
budući production projekat ostaje posebna owner odluka.

1. **Pre primene:**34 PASS reporta tačnog sačuvanog izvora kroz144; pregled36 forward datoteka/11 bundle-a; sveži preflight, postojeći klijenti,137/139/143 backfill brojači i bezbedan maintenance/restore redosled. Trenutni78 run stao je135 i nije completePASS. Sintetičke CI policy/pravne aktore ne prenositi na DEV kao vlasnički pravni sadržaj.
2. **Pre migracija:** sačuvati history/counter/catalog/function/policy/scheduler/Edge metadata baseline i odobreni način quiescence-a. Zatvoriti samo konkretne unapred odobrene provider admission zastavice i ne menjati credentials/keys naslepo. Nemati nekontrolisan postojeći evaluator/klijent tokom124/125 aktivacije. Gore navedene nove zastavice važe za pregledani V5 source; ne pretpostavljati da ih prethodni deploy podržava bez njegovog zasebnog pregleda.
3. **Svaka transakcija:** tačni odobreni bajtovi, postojeći lock/statement timeout-i i ugrađeni predecessor/postcondition guard-ovi. Posle uspeha proveriti history append, prethodne hash-eve i ciljane postuslove. Prvi neuspeh zaustavlja sledeći korak. SQL greška/lock timeout nije dozvola za preskakanje guard-a ili historical rewrite.
4. **Ako DDL čeka:** sačuvati bounded pid/state/wait/relation/mode/blocking_pids metapodatke dok wait traje. Bez query teksta i credentials. U run34730098067 dva puta je131 imala lock_timeout, dok novi34731211318 isti SQL prolazi bez observed wait-a; konkretan istorijski blocker nije dokazan. Ne tvrditi da je problem uklonjen ili promeniti production SQL samo na osnovu prolaznog ponavljanja.
5. **Deploy i auth smoke:** prvo stvarni bundle/readback, zatim unapred dozvoljeni negative-auth/malformed-input testovi bez validnog owned mutation konteksta. Ne predstavljati push probe, export grant, maintenance tick, Storage upload ili WS rezervaciju kao read-only proveru. Prava pozitivna native/Edge/Auth/server/govor/fotografija/objava proba ostaje tačno opisana u plaćenom/poslovnom batch-u.
6. **Pre ponovnog puštanja rada:** svi osnovni read DTO/ACL/hook i source/binding rezultati zadovoljeni; scheduler vraćen u prethodno odobreno stanje tek kada ne može potrošiti neodobrenu otvorenu politiku. Ako mora ostati pauziran, eksplicitno evidentirati zastoj expiry/dispatch/completion/export/retention i naredni konkretni oporavak. Ne ostaviti korisniku privid normalnog automatskog rada.
7. **Incident/unknown:** zaustaviti nove odgovarajuće dispatch-e/admission, zadržati postojeće durable potvrde i pune rezervacije nepoznatog ishoda; prvo owned read/recovery.142 daje eksplicitno odustajanje uz zadržanu rezervaciju, ne automatski refund/retry. Za support grant/komandu primenitiJ: read tačnog key-a, eventualni zasebno odobren revoke sa stvarnom revision, bez brisanja audit/case/evidence. Opoziv operatora ne zatvara author CREATE. Već uspešne SQL migracije se ne „vraćaju“ `migration repair`, reset-om, brisanjem redova ili prepisivanjem hash-eva. Ispravka je nova pregledana forward migracija. Stari Edge bundle vraćati samo uz dokaz kompatibilnosti sa novom šemom; u suprotnom ostaviti konkretnu funkciju zatvorenu.

AF-D15–26 zatvaraju odustajanje, email Auth, support, privatne medije,
self-reported identity, Urgent obim, test naloge i canonical DEV promociju.
Ne pitati poznate odluke ponovo. Preostaju izvršna primena tih odluka,
applicable closure redakcija, provere hostovanog providera/Storage/Auth i stvarni
povezani native E2E. Raniji APK-ovi i snimci dokazuju samo sopstveni sačuvani
source/build/screen obim; ne potvrđuju završeni144 ni konačni povezani APK.
