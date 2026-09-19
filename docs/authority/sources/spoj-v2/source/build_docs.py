from pathlib import Path
from collections import Counter
import json,hashlib,shutil,re
R=Path(__file__).resolve().parents[1]
OLD=R/'input/v1-evidence'
HAND=R/'input/original-handoff'
SHA='4bcc5dbf1128a4d081824797350b83a00127c21f'
URL=f'https://github.com/Uskoci1/USKOCI-CLEAN/blob/{SHA}/'
html=R/'prototype/USKOCI_SPOJ_V2.html';digest=hashlib.sha256(html.read_bytes()).hexdigest()
def write(p,s):
 p=R/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s.strip()+'\n')
shutil.copy2(HAND/'PLAN_AND_INVENTORY/POPIS_FUNKCIJA.md',R/'reference/ORIGINAL_FUNCTION_INVENTORY_186.md')
for name in ['LIVING_TASK_OBJECT_SPEC.md','AI_VOICE_INTERACTION.md']:
 shutil.copy2(HAND/'HISTORICAL_REFERENCE_ONLY'/name,R/'reference'/name)
for name in ['ACCEPTANCE_JOURNEYS.json','JOURNEY_DISPOSITION_35.json']:
 f=HAND/'CORE_SOURCE_REFERENCE_READ_ONLY/data'/name
 if f.exists():shutil.copy2(f,R/'reference'/name)
shutil.copy2(OLD/'OPEN_UX_ISSUES.md',R/'reference/V1_OPEN_UX_ISSUES.md')
cat=json.loads((R/'contracts/SCREEN_CATALOG_66.json').read_text())
metrics={x['key']:x for x in json.loads((R/'evidence/after_66.json').read_text())}
states=json.loads((R/'evidence/states_390.json').read_text())
special={
 'entry':('CHOICE_TRANSITION_REBUILT_ORIGINAL_INTRO_PRESERVED','Obe namere i footer nestaju potpuno; diskretan vektorski motiv; zaključana geometrija, namig i slogan ostaju.'),
 'chat':('CONVERSATION_HIERARCHY_REBUILT','Kompaktni prihvaćeni uslovi otvaraju detaljan sheet; više prostora za poruke; retry čuva isti pokušaj.'),
 'apply':('OFFER_SUMMARY_ADDED','Cena i broj ljudi prikazani i uz završnu radnju, 0 RSD naknada odvojeno. Jedno završno slanje.'),
 'map':('LOCAL_VIEWPORT_INTERACTION_ADDED','Pomeranje, zoom, eksplicitna pretraga oblasti i isti podskup u Listi; ostaje šema bez geografske infrastrukture.'),
 'discovery':('AREA_CONTEXT_PRESERVATION_ADDED','Lista objašnjava izbor oblasti sa mape; reset vraća skup bez brisanja podataka.'),
 'export':('LOCAL_REQUEST_CANCEL_LIFECYCLE_ADDED','Zahtev / otkaz / ponovni zahtev, odvojeno po lokalnom nalogu; nema lažne READY arhive.'),
 'task-fields':('SHARED_POLISH_AND_OPTIONAL_DISCLOSURE','Čitljiviji unos i progres; privatni detalji odvojeni kada panel postoji; čuvanje čuva isti aggregate.'),
 'task':('SOURCE_SEMANTIC_ALIGNMENT','Izmena Zadatka posle prvog Dogovora blokirana; promena ide kroz Dogovor, kao u proverenom V2 servisu.'),
 'review':('HIERARCHY_AND_SAVE_GUARD','Prikaz koraka; potvrda činjenica i provera nove saradnje pre čuvanja ne mogu biti zaobiđene.')}
# Group-level integration leads. Paths marked listed are NOT claimed audited/working.
groups={
 'auth':{'keys':['entry','auth','signup','recovery','permissions','auth-confirm','new-password','recovery-expired'], 'boundary':'Existing auth/entry/splash/recovery hooks and source availability','paths':['src/data/authClientService.ts','src/data/entryIntentClientService.ts','src/data/passwordRecoveryClientService.ts','src/ui/entry','src/ui/referenceEntry'],'level':'PATH_LISTED_READ_BEFORE_BINDING'},
 'need-v2':{'keys':['ai','review','task-fields','task-time'], 'boundary':'aiNeedV2Izvor: openConversation / loadConversation / sendMessage / confirmFact / correctFact / saveDraft / openEditConversation / confirmEdit','paths':['src/data/index.ts','src/data/aiNeedV2Production.ts'],'level':'CONTENT_READ_AT_SNAPSHOT'},
 'need-lifecycle':{'keys':['tasks','task'], 'boundary':'Existing Need read/lifecycle service and current publication authority; do not use legacy AI publish for V2','paths':['src/data/needClientService.ts','src/data/needLifecycleClientService.ts'],'level':'PATH_LISTED_READ_BEFORE_BINDING'},
 'market':{'keys':['discovery','map','search','filters','opportunity'],'boundary':'Public Need projection + public approximate geography, provider remains explicit integration gap','paths':['src/data/needClientService.ts','src/data/locationClientService.ts','src/data/locationResolver.ts'],'level':'PATH_LISTED_READ_BEFORE_BINDING'},
 'application':{'keys':['apply','application-time','applications','application','candidates','candidate','compare','payment'],'boundary':'Existing Izvor typed application/selection command; applicationClientService owns list/withdraw, not automatically submission','paths':['src/data/index.ts','src/data/ports.ts','src/data/applicationClientService.ts','src/data/candidateClientService.ts'],'level':'MIXED: INDEX_AND_LIST_WITHDRAW_CONTENT_READ; SUBMIT_SELECTION_RESOLVE'},
 'agreement':{'keys':['agreements','agreement','chat','changes','proposal','problem','cancel','complete'],'boundary':'Existing Agreement service + durable outbox/receipt owner; accepted snapshot not mutable Need','paths':['src/data/agreementClientService.ts','src/data/agreementMessageClientService.ts','src/data/agreementOutbox.ts','src/ui/AgreementChat.tsx'],'level':'PATH_LISTED_READ_BEFORE_BINDING'},
 'profile':{'keys':['profile','personal','worker','worker-ai','skills','vehicle','public'],'boundary':'Own/public/worker profile owners; worker AI provider is not demonstrated by HTML','paths':['src/data/ownProfileClientService.ts','src/data/publicProfileClientService.ts','src/data/index.ts'],'level':'INDEX_CONTENT_READ_OTHER_PATHS_LISTED'},
 'calendar':{'keys':['calendar','availability','exception'],'boundary':'Resolve existing availability/calendar authority from newest repo; do not build a parallel calendar','paths':['src/data/authAvailabilityClientService.ts','src/data/calendarErrors.ts'],'level':'PATH_LISTED_ONLY_NOT_CALENDAR_EXECUTION_PROOF'},
 'inbox':{'keys':['inbox','notifications'],'boundary':'Inbox event projections + preferences; push transport separate','paths':['src/data/inboxClientService.ts','src/data/notificationPreferencesClientService.ts'],'level':'PATH_LISTED_READ_BEFORE_BINDING'},
 'account':{'keys':['settings','privacy','export','closure','account','legal'],'boundary':'Current legal/export/closure contracts and server status, no fabricated processing/archive','paths':['src/data/dataExportClientService.ts','src/data/legalClientService.ts','src/data/retentionPolicyClientService.ts'],'level':'PATH_LISTED_READ_BEFORE_BINDING'},
 'pending':{'keys':['reviews','review-write','verify','support','blocked','qa','urgent','photo','voice','support-cases','support-case'],'boundary':'Capability / business policy / provider read-first; explicit gate where no supported authority','paths':['src/data/preselectionQaClientService.ts'],'level':'DO_NOT_INFER_ENGINE_FROM_HTML; QA_PATH_LISTED'},
 'studio':{'keys':['brand','components'],'boundary':'Reference/studio surfaces; not automatically production navigation','paths':[],'level':'NON_PRODUCTION_SURFACE'}
}
ss=[];bindings=[]
for i,c in enumerate(cat):
 key=c['key'];g=next((g for g,v in groups.items() if key in v['keys']),'pending');disposition,note=special.get(key,('REVIEWED_RETAINED_SHARED_POLISH','Zadržan fokus ovog ekrana; primenjeni zajednička tipografija, razmaci, tap-zone, kartice, fokus i reduced-motion pravila. Nije zasebno rekonstruisan ceo ekran.'))
 checks={w:any(x['key']==key and not x.get('errors') and not x.get('horizontalOverflow') for x in json.loads((R/f'evidence/responsive_{w}.json').read_text())) for w in ['360','320','320_large']}
 commands=[{'action':x['action'],'label':x['label'],'disabled_in_captured_state':x['disabled']} for x in metrics[key]['controls'] if x['action']]
 rec={**c,'historical_sourceRoute_only':c.get('sourceRoute'),'native_route_verified':False,'v2_disposition':disposition,'change_note':note,'normal_render':f'renders/after/{i+1:02d}_{key}.png','before_render':f'renders/before/{i+1:02d}_{key}.png','visual_review':'CONTACT_SHEET_REVIEWED_WITH_KEY_SCREEN_DETAIL','layout_checks':checks,'states_checked':[x['ui'] for x in states if x['key']==key],'controls_in_default_fixture':commands,'controls_warning':'Only captured default fixture; dynamic states/menus/actions must also be tested. Studio entry is not end-to-end navigation proof.','binding_group':g,'native_engine_binding':'NOT_IMPLEMENTED_BY_THIS_DELIVERY','full_acceptance':'NOT_CLAIMED'}
 ss.append(rec);bindings.append({'screen':key,'group':g,**{k:v for k,v in groups[g].items() if k!='keys'},'required_runtime_proof':'Authenticated real command, matching receipt and refetched projection, failure/stale/unknown, 2 accounts where applicable.'})
(R/'contracts/SCREEN_CONTRACTS_66.json').write_text(json.dumps(ss,ensure_ascii=False,indent=2))
(R/'contracts/BINDING_MATRIX_66.json').write_text(json.dumps({'snapshot_commit':SHA,'live_database_rechecked_this_delivery':False,'items':bindings},ensure_ascii=False,indent=2))
write('docs/SCREEN_REVIEW_66.md','# Pregled 66 površina\n\nSvaka površina je renderovana i pregledana. To nije tvrdnja da je svaka akcija/nativna integracija završena.\n\n'+'\n\n'.join(f'## {i+1:02d}. {x["name"]} (`{x["key"]}`)\n**Cilj:** {x["purpose"]}\n\n**Ovaj krug:** {x["change_note"]}\n\n**Prelazi i kontrole:** `contracts/SCREEN_CONTRACTS_66.json`; {len(x["controls_in_default_fixture"])} radnji u početnom fixture prikazu.\n\n**Stanja preglednika:** {", ".join(x["states_checked"]) or "normal / intro"}. Native ruta iz starog kataloga je samo trag za pronalaženje, ne potvrđena konačna ruta.' for i,x in enumerate(ss)))
fd=json.loads((OLD/'FUNCTION_STATUS_186.json').read_text())
for x in fd['items']:
 x['v2_status']=x['lineage_status'];x['v2_evidence_scope']='LOCAL HTML ONLY; no native/provider/server success inferred';x['v2_full_acceptance']='NOT_CLAIMED';x['v2_native']='NOT_INTEGRATED';x['v2_production']='UNCHANGED';x['v2_source_current_is_historical_snapshot']=True
 if x['id']=='F167':x['v2_status']='prototype resolved';x['v2_note']='Scoped local request/cancel/re-request and account isolation checked. Original acceptance requires real receipt/status: still NOT proven.'
 elif x['id']=='F074':x['v2_note']='Local SVG pan/zoom/manual viewport-apply works and list subset is shared. Real geographic viewport, cartography/provider and X04 remain open; full function not closed.'
 elif x['id']=='F001':x['v2_note']='Original source blocks/end render preserved. Choice sweep fixed. 41 pure math checks are not native motion/performance proof.'
 else:x['v2_note']='See original acceptance verbatim and screen contract. No upgrade of whole function status from visual polish alone.'
fd['v2_counts']=dict(Counter(x['v2_status'] for x in fd['items']));fd['v2_output_sha256']=digest;fd['basis']+=' V2: F167 only local subset upgraded; F074 remains open for real map. All original acceptance strings preserved.'
(R/'contracts/FUNCTION_STATUS_186.json').write_text(json.dumps(fd,ensure_ascii=False,indent=2))
write('docs/FUNCTION_STATUS_186.md','# Status 186 funkcija — V2\n\n**Ovo nisu procenti završene aplikacije.** `prototype resolved` označava samo navedeni lokalni podskup. Izvorni kriterijumi ostaju neizmenjeni. `source_current` u JSON-u je istorijski snapshot iz handoff-a, ne nova live provera.\n\n'+str(fd['v2_counts'])+'\n\n'+'\n\n'.join(f'## {x["id"]} — {x["name"]}\n**Izvorni kriterijum:** {x["acceptance"]}\n\n**V2:** {x["v2_status"]}. {x["v2_note"]}\n\n**Native / produkcija:** nije povezano ovom isporukom / nije menjano.' for x in fd['items']))
open_items=[x for x in fd['items'] if x['v2_status']=='open decision']
write('docs/OPEN_DECISIONS.md','# Otvorene odluke iz izvora\n\nNijedna nije rešena izmišljanjem vrednosti u HTML-u. Ne blokirati nepovezane ekrane; ne uključivati funkciju bez autoriteta.\n\n'+'\n\n'.join(f'## {x["id"]} — {x["name"]}\n{x["acceptance"]}' for x in open_items))
write('00_READ_FIRST.md',f'''# USKOČI SPOJ V2 — prototip + paket za nativni prenos

**Aktivna vizuelna referenca:** `prototype/USKOCI_SPOJ_V2.html`  
**SHA-256:** `{digest}`  
**Prethodna osnova:** `input/BASE_LINEAGE_V1.html` (nije nova referenca za dizajn).

Ovo je nastavak postojećeg proizvoda, ne nova aplikacija. Paket sadrži izvršiv HTML, 66 prikaza, status 186 funkcija, originalne SVG resurse, motion specifikaciju, geometrijski adapter i uputstvo za Codex.

## Šta prvo otvoriti
1. `prototype/USKOCI_SPOJ_V2.html` — stvarni lokalni prototip.
2. `ATLAS.html` — pre/posle svih 66 površina i kadrovi tokova.
3. `docs/WHAT_CHANGED.md` i `docs/READINESS.md` — šta je promenjeno i šta još nije završeno.
4. `01_CODEX_START_PROMPT.md` — početna komanda za rad u postojećem repo-u.
5. `docs/NATIVE_TRANSFER.md`, `docs/BINDING_GUIDE.md`, `docs/MOTION_SPEC.md`.
6. `contracts/SCREEN_CONTRACTS_66.json`, `contracts/FUNCTION_STATUS_186.json`, `docs/QA_ACCEPTANCE.md`.

## Nepromenjena granica
GitHub, Supabase, Figma i produkcioni Expo nisu menjani. HTML nema vezu sa pravim motorom. Ne unosi pravu lozinku u demonstraciju. Lokalni nalozi, razgovori, zahtevi, ocene i ponude nisu stvarni korisnici/podaci.

`native-starter/` je referentni početni kod, ne instalirana aplikacija. Čista geometrija je prevedena i proverena; TSX komponente nisu kompajlirane u canonical repo-u niti pokrenute na Android/iOS uređaju u ovom radu.

## Gde je autoritet
V2 određuje izgled i ponašanje prikaza. Postojeći kanon, RPC/servisi i odobrene poslovne odluke određuju šta se sme izvršiti. Server određuje prava, stanje, reviziju i ishod. Handoff ne daje dozvolu da se uključi HITNO, pozitivna naknada, stari AI publish, verification ili produkcijska objava bez kapija.

Prvobitni intro (sklapanje, namig, geometrija, wordmark, slogan) ostaje isti. Promenjen je samo eksplicitno zamereni prelaz posle izbora namere. Nema nove maskote ni povratka na odbačeni v1.5 pravac.

## Korišćenje u Codexu
Raspakuj ovaj folder na računar uz postojeći radni prostor. Otvori postojeći `USKOCI-CLEAN`, ne legacy aplikaciju. Prosledi sadržaj `01_CODEX_START_PROMPT.md` i stvarnu lokalnu putanju do ovog foldera. Codex treba da čita fajlove sa diska, ne da zaključuje UI iz jednog screenshot-a. Nije neophodno da ZIP direktno prihvati interfejs za upload.

Paket nije zamena za nove kodne provere: poslednji ovde proveren canonical commit je `{SHA}`. Radni prostor može biti noviji. Ne vraćati ga na taj commit.
''')
write('01_CODEX_START_PROMPT.md',f'''# USKOČI — PRENESI SPOJ V2 U POSTOJEĆI NATIVE PROIZVOD

Ovo je direktan nastavak mog postojećeg USKOČI-ja. Raspakovan paket USKOCI_SPOJ_V2_20260910 je priložen/na lokalnoj putanji koju sam ti dao. Prvo ga fizički otvori. Ne traži od mene da ručno prepisujem ono što možeš pročitati iz njegovih fajlova.

## 1. Nastavi ono što zaista postoji
Canonical projekat je `Uskoci1/USKOCI-CLEAN`, grana `clean-alpha-backend`. Poslednji read-only GitHub snapshot iz paketa je `{SHA}`, ali to NIJE zahtev da se resetuje repo ili da se zanemari noviji rad.

Pročitaj postojeći AGENTS.md, PRODUCT.md, governing docs, relevantne skills, package.json i aktuelni razvojni cursor. Zabeleži stvarnu putanju, origin, branch, HEAD i git status/diff. Sačuvaj tuđe i moje lokalne izmene. Bez reset --hard, clean, force push, promene projekta ili paralelnog modela podataka. Kada radi druga sesija, ne prepisuj njene fajlove; radi na bezbedno izdvojenim prezentacionim komponentama i prijavi stvarni presek konflikta.

Ne počinji novi Expo projekat. Ne prenosi na stari Firebase. Ne tretiraj mock izvor kao produkcijsku konfiguraciju. Ne menjaj dependency verzije samo zato što postoji noviji paket; proveri trenutni lockfile.

## 2. Pročitaj referencu u celini
Redom: 00_READ_FIRST.md → docs/READINESS.md → docs/WHAT_CHANGED.md → prototype/USKOCI_SPOJ_V2.html → ATLAS.html → docs/DESIGN_SYSTEM.md → docs/MOTION_SPEC.md → docs/NATIVE_TRANSFER.md → docs/BINDING_GUIDE.md → contracts/SCREEN_CONTRACTS_66.json → contracts/FUNCTION_STATUS_186.json → docs/QA_ACCEPTANCE.md → docs/OPEN_DECISIONS.md.

ATLAS prikazuje i nedostupna/empty stanja kada fixture nema ovlašćeni objekat. To nije dozvola da izmisliš podatak da bi ekran izgledao pun. `sourceRoute` u starom katalogu je istorijski trag za pronalaženje, ne naređenje da izmisliš ili dupliraš native rute.

## 3. Izvedi native UI, ne WebView omotač
HTML je interaktivna vizuelna specifikacija. Njegov monolitni globalni state, demo korisnici, lokalne komande, studio, timer-based provider imitacije i višestruki wrapper slojevi se NE kopiraju u produkcionu arhitekturu.

Izdvoji/preuzmi postojeće native shared komponente: AppShell, header, tri-zone bottom navigation, TaskCard, prihvaćeni AgreementContext, PersonCard, InboxItem, Field, PrimaryAction, sheet, empty-state, pending/error/stale/unknown/offline state. Zadrži postojeće servisne granice, auth lifecycle, recovery, outbox i zaštitu od zastarelog odgovora nakon promene naloga.

Prvo napravi vertikalan native tok sa stvarnim servisom, ne 66 nepovezanih slika. Zatim isti rečnik komponenti primeni na ostale površine. 66 HTML površina nisu obavezno 66 native ruta: neke su sheet, uslovno stanje ili studio-only referenca.

## 4. Brand i animacija bez gubitka
Koristi `assets/brand/`, `assets/icons/`, `assets/empty/`, `motion/` i `native-starter/`. Originalni znak i reč su SVG putanje, ne ponovo ukucan naziv ili novo generisan logo. Nikakva nova maskota. Ne rekonstruiši namig ili geometriju napamet.

Postojeći native entry/referenceEntry kod najpre proveri i ponovo upotrebi. Matematički adapter iz paketa je referenca za poređenje, ne zahtev da se zameni postojeći scene clock. Sklapanje i namig traju po originalnoj vremenskoj liniji; dokumentovan je i reduced-motion završni kadar.

Kada korisnik izabere Meni treba/Ja mogu, OBA sadržaja izbora i footer nestaju potpuno. Boja ide IZA nepomerenog belog logo panela; blag kontekstualni motiv je iza njega. Nema naziranih starih natpisa. Blokiraj dupli tap; prekid, promena naloga ili odlazak u pozadinu ne smeju kasnije otvoriti pogrešan auth cilj. Povratni deep link ne čeka intro samo da bi animacija bila odigrana.

## 5. Veži svaku radnju na postojeći autoritet
Za svako dugme popuni: ekran → korisnička namera → uslov dostupnosti → stvarni postojeći service/hook → payload/ID/revizija → pending → confirmed/error/stale/unknown → refetch → povratni kontekst → test.

U `src/data/index.ts` postoji kompoziciona granica i eksplicitna zabrana tihog pada sa pravog Supabase-a na fake source. Sačuvaj je. Novi AI Task tok koristi V2 izvor `aiNeedV2Izvor`; ne poveži ga preko starog `objaviPotrebu` / `rpc_ai_publish_need` zato što ime zvuči zgodno.

Source snapshot pokazuje i važnu zabranu: Zadatak se ne menja nakon prvog Dogovora. V2 HTML je sada usklađen. Promena prihvaćenog termina/cene/obima ide kroz odgovarajući Dogovor. Proveri najnoviji autoritet pre implementacije; konflikt prijavi eksplicitno, ne zaobiđi server.

Za application submit i exact selection pronađi tačan aktuelni Izvor član i typed command. `applicationClientService` iz proverenog snapshot-a sadrži mojePrijave i povuciPrijavu — samo njegovo postojanje nije dokaz da on poseduje slanje. Nema drugog command owner-a radi lepšeg UI-ja.

Izbor tačne Prijave vodi u CONFIRMED Dogovor sa accepted snapshot-om. Ne dodaj novi korak da Uskočer ponovo prihvata ono što je već ponudio. Ne menjaj prihvaćene uslove ažuriranjem profila ili originalnog Zadatka. Coverage 0/2 nije broj ponuda.

Za poruke reuse postojećeg outbox-a, client_request_id, retry/proveru istog pokušaja i odbacivanje zakašnjelog odgovora drugog naloga. Animacija nije potvrda servera.

Za funkciju čiji servis ne postoji: zabeleži konkretan nedostatak. Ne napravi toast koji kaže da je uspelo. Dovrši je samo u okviru već odobrenog backend plana i dozvoljenog okruženja, ili ostavi jasno capability-gated stanje sa korisničkim razlogom. Ovaj handoff ne daje samostalnu dozvolu za live migracije/aktivacije.

## 6. AI i uređajske funkcije zaista proveri
AI: pravi autorizovani Edge poziv → sačuvana poruka → činjenice/review → ljudska korekcija/potvrda → pravi nacrt → zasebna publication kapija. Bez provider ključa ili uspešnog odgovora ne tvrdi da AI radi. Ključevi ostaju na serveru, ne u HTML-u, mobilnom bundle-u, poruci ili izveštaju.

Voice: prava dozvola i snimanje/STT moraju biti posebno povezani; postojeći waveform je lokalni UX primer. Mapa: postojeća V2 šema nije MapLibre/Google mapa, geocoder ili GPS. Lokalni pan/zoom nije dokaz server query-ja. Push: prikazan inbox i token registry nisu dokaz isporuke na telefon.

Public približna oblast, private exact address, GPS uređaja i radna oblast Uskočera ostaju odvojeni. Kalendarska dostupnost nije već potvrđen Dogovor. Dostupan sam nije HITNO.

## 7. Proveravaj tokom izrade
Za svaku povezanu vertikalu: tipovi, postojeći unit/regression testovi, stvarni staging/test backend i dva ovlašćena test naloga, screenshot/native render poređenje, Back i Android hardware Back, tastatura, safe-area, large text, reduced motion, offline, stale revision, unknown outcome, dupli tap i account switch.

Stvarni dokaz osnovnog toka: nalog A napravi/potvrdi/objavi task u dozvoljenom okruženju → nalog B ga nađe i pošalje stvarnu ponudu → A izabere TAČNU ponudu → oboje otvore isti CONFIRMED Dogovor → poruka stigne drugoj strani → kontrolisana izmena → završetak → review tek kada su njen servis i politika stvarno spremni. Sačuvaj identifikatore i dokaze, ali ne tajne ili privatne sadržaje.

Ne zovi lokalni demo ili mocked unit test backend/native/provider dokazom. Ne proglasi aplikaciju završenom zato što postoji CTA ili atlas.

## 8. Isporuka i kontinuitet
Ne vraćaj još jedan opšti plan umesto koda. Posle kratkog preflight-a uradi prvi bezbedan implementacioni korak, proveri ga i nastavi. Za svaku celinu ažuriraj tabelu: REFERENCA / NATIVE UI / SERVICE BINDING / REAL TEST / OTVORENO. Prikaži stvarni diff, test izlaze, screenshots, nerešene tačke i sledeći tačan cursor.

Cena platforme ostaje PROMOTIONAL_FREE / 0 RSD; cena rada je odvojena. HITNO, pozitivni checkout, verification i production publication ne uključuju se vizuelnim redizajnom. Bez nove arhitekture, novog proizvoda i završavanja na planu.
''')
write('docs/READINESS.md','''# Da li je dokumentacija dovoljna za Codex?

**Za početak kontrolisanog native prenosa — da. Za tvrdnju da se ceo proizvod može automatski pretvoriti u završenu mobilnu aplikaciju — ne.**

## Sada postoji
Izvršiva referenca; uporediv atlas 66 površina; originalni kriterijumi svih 186 funkcija; konkretne kontrole početnih prikaza; globalni i konkretni lokalni testovi; originalni vektorski logo i ikonice; tačan vremenski tok originalnog intro-a; V2 izbor namere; početni native assets/komponente/matematički adapter; read-only servisni tragovi sa nivoom provere; pravila rada u postojećem repo-u; negativna stanja i završne kapije.

Paket je dovoljan da Codex ne mora ponovo da smišlja proizvod, logo, navigaciju, hijerarhiju kartica ili ponašanje osnovnih tokova. Može odmah da počne od postojećeg native shell-a i veže proverenu vertikalu.

## Šta još mora da utvrdi u repo-u
Tačne aktuelne rute i payload tipove za svaki command; koja implementacija poseduje mutate/read/receipt; stanje lokalnog worktree-a; koja migracija je stvarno live; raspoloživost AI/push/map/voice/provider-a; staging pristup; dozvole i build konfiguraciju. U ovom krugu pročitan je deo source-a, nije urađen kompletan novi backend audit.

Statusi target shown i prototype resolved ne znače native integrated. Niti jedan od 186 punih acceptance kriterijuma nije proglašen ispunjenim samo zbog ovog kruga. U ovoj isporuci nije izgrađen APK niti povezan novi native UI.

## Ne zahtevati savršen HTML pre prvog prenosa
Nije potrebno crtati beskonačno. Glavni UX ima dovoljno preciznu referencu za implementaciju. Tastaturu, realan scroll performans, safe-area, list virtualization, sistemske dozvole i native animaciju treba proveravati u pravoj aplikaciji, paralelno sa vizuelnim poređenjem. Takve probleme nije pošteno označiti kao rešene Chromium renderom.

## Tri kapije
**Početak prenosa:** ovaj paket + postojeći repo + pregled novijeg stvarnog stanja.  
**Funkcija završena:** native UI + postojeći/odobreno dovršen servis + ispravan povrat stanja + stvaran dokaz.  
**Aplikacija spremna:** kompletne vertikale, odluke/politike, provereni provider-i, realni uređaji, sigurnost/privatnost i release kapije.
''')
write('docs/WHAT_CHANGED.md','''# Stvarne izmene u V2

## Izbor namere
Potpuno se uklanjaju oba teksta izbora i footer. Nema preostalog 32% natpisa. Boja širi polje iza istog belog panela. Dodati su diskretni vektorski motivi: traženje pomoći i preuzimanje zadatka. Originalno sklapanje, namig, putanje i slogan nisu menjani. Dupli izbor, prekid i reduced motion su provereni lokalno.

## Poruke i ponude
Velika ponovljena kartica iznad chata zamenjena je kompaktnim prihvaćenim kontekstom. Detalji se otvaraju u sheet-u. Retry/outbox semantika nije zamenjena novom logikom. Prijava dobija živ sažetak cene i broja ljudi uz završno dugme, odvojeno od 0 RSD platformske naknade. Tastatura/fokus se ne prekidaju pri tom osvežavanju.

## Mapa i izvoz
Mapa dobija lokalni transform, drag, zoom, eksplicitnu pretragu oblasti, isti podskup u Listi i reset. Ne nazivamo šemu pravom kartografijom/GPS-om. Novi zadatak ostaje dostupan, bez duplog vidljivog CTA iza otvorenog pina.

Zahtev za izvoz može da se zatraži, otkaže uz potvrdu i ponovo zatraži. Stanje je odvojeno po lokalnom nalogu; offline radnja ne glumi uspeh. Nema izmišljene gotove arhive ili download-a.

## Usklađivanje sa motorom
Read-only provera aiNeedV2Production otkrila je da postojeći server autoritet odbija izmenu Zadatka nakon prvog Dogovora. V1 lokalni editExisting je to dozvoljavao. V2 sada blokira ulaz u tu izmenu i ponovo proverava zaključavanje pri čuvanju; usmerava na Dogovor. Ovo nije nova poslovna odluka.

## Zajednički vizuelni sloj
Ujednačene su kartice, podloge, senke, čitljivost metapodataka, naslovna hijerarhija, tap-zone, fokus, sticky akcije i sheet-ovi. Dodata je kratka navigaciona animacija koja se ne ponavlja pri svakom unosu. Svi prikazi su pregledani; nisu svi pojedinačno rekonstruisani. Inventar to izričito razlikuje.

## Paket za prenos
Izdvojeni su stvarni SVG resursi, originalna motion geometrija/vremenski tok, proverena čista TypeScript matematika i neintegrisane native prezentacione reference. Dodati su binding vodič, 66 screen ugovora, očuvani 186 kriterijumi, Codex početna komanda i konkretne acceptance kapije.
''')
write('docs/DESIGN_SYSTEM.md','''# SPOJ — vizuelni ugovor za native

Aktivni autoritet je izvršivi V2 HTML, ne ovaj tekst izdvojen od rendera. Nasleđeni izbor pravca nije ponovo otvoren.

Teal #2E7A6A, orange #FF7908, ink #143D35, canvas #FAFCFB, white #FFFFFF, soft #EEF5F1, line #E4EBE7. Cilj je svetao, topao, jasan interfejs. Narandžasta označava važnu radnju, ne sve elemente odjednom. Nema notebook/admin/CRM estetike, novih maskota ni dekorativnog stanja koje imitira događaj.

Referentne mere: body15, label12, screen title20, hero25; input radius11, button13, card18, sheet24; osnovni razmaci4/8/12/18/24. Tipografija se prilagođava korisničkom povećanju teksta. Ne fiksirati visinu teksta da bi screenshot ostao isti. Minimalna ciljana aktivna zona44, glavna akcija50. Ovo su projektni tokeni, ne sertifikat accessibility usklađenosti.

Jedna jasna primarna akcija po odluci. Sekundarne promene, filteri i dodatni uslovi ne smeju da budu iste težine kao završno slanje/potvrda. Status nije samo boja: tekst+ikona, potvrđeno od pravog stanja.

TaskCard prikazuje naslov, javnu približnu lokaciju, termin, cenu ili traženje ponuda, coverage, samo važne uslove. Candidate pokazuje konkretnu ponudu i obim. AgreementContext čita prihvaćeni snapshot; nikada automatski najnoviju parent karticu. U chatu ostaje kompaktan, detalji su na dodir.

Donja navigacija ostaje kanonska, sa jasno aktivnom zonom. Inbox ide preko zvona, profil preko avatara. Dogovor ima samo Pregled i Poruke. Prazni Zadaci/Prijave/Dogovori/Inbox koriste izvezenu postojeću porodicu ilustracija i odgovarajuću sledeću radnju, bez lažnih događaja.

Forma: trajna labela, objašnjen format/jedinica, inline greška uz polje, očuvana vrednost posle greške, jedna konačna potvrda. Cena ponude se ne deli samovoljno po osobi. Broj ljudi nije broj Prijava. Privatna lokacija ima različit tretman od javne oblasti.

Native parity se ocenjuje po hijerarhiji, geometriji znaka, razmacima, veličini i toku. Platformska metrika fontova i anti-aliasing neće nužno dati isti piksel. Font fajlovi nisu deo paketa. Najpre proveriti postojeće legalno dostupne font resurse u repo-u; bez tihog zamenskog fonta kada menja prelom/hijerarhiju.
''')
write('docs/MOTION_SPEC.md','''# Motion — originalni intro + V2 izbor

## Originalni intro: 4380 ms, geometrija zaključana
`motion/original-rIntroFrame.js` je izvučena originalna funkcija. `geometry.json` i `original-parts.json` sadrže viewBox, transform i geometriju delova. `html-reference-frames.json` beleži 39 uzoraka (13 vremena ×3 širine). `native-starter/BrandSceneMath.ts` je čista prenosiva matematika, proverena prema tim uzorcima.

| Vreme ms | Događaj |
|---|---|
| 40–760 | Spajanje krakova originalnog znaka |
| 80–650 | Ulazak kružnih delova |
| 630–900 | Mali donji deo |
| 760–1120 | Pin u znaku |
| 930–1240 | Osmeh |
| 1450–1550 / 1620–1750 | Zatvaranje / otvaranje jednog oka |
| 1920–2690 | Prelaz velikog centralnog znaka u originalni lockup |
| 2700–3200 | Otkrivanje SKOČI putanja |
| 3210–3500 | Slogan |
| 3590–4200 | Teal/narandžasta polja iza belog panela |
| 3980–4340 | Izbori i footer |
| 4380 | Završetak, omogućena interakcija |

Cubic ease-out u originalnoj geometriji: 1−(1−p)^3. Ne menjati poredak transformacija pojedinačnih SVG grupa, rotaciju ili lokalne centre. Podaci o box-u moraju biti u istom koordinatnom sistemu; ne primenjivati DOM offsete kao native safe-area vrednosti.

## Izbor namere: 760 ms
Na t=0 obe grupe izbora i footer postaju potpuno nevidljivi i neinteraktivni. Ne čuvati 32% opacity. Originalni beli panel/znak je iznad boje i motiva. Od110 do640 ms odabrana boja prelazi sa50% na100%, cubic-bezier(.2,.8,.2,1). Od250 do490 ms pojavljuje se kontekstualni motiv, bez teksta, sa SVG vidljivošću .085. Diskretni kružni obris ima belu liniju na .08. Nakon760 ms prelazi se na važeći auth cilj samo ako su nalog, revizija sesije i polazni ekran još isti.

Reduced motion: završni intro kadar odmah, izbor bez prostornog sweep-a. Otvaranje postojećeg autorizovanog deep link-a ne sme čekati ceremoniju. Dupli tap samo jednom, prekid/unmount/account switch/background poništava zakazanu navigaciju.

## Interijer
Navigation-only opacity/translateY5, 190 ms; pritisak110 ms. Ne animirati ponovo ceo ekran pri kucanju. Semantička promena činjenice može diskretno da se istakne; svetleći efekat ne predstavlja server potvrdu. Loading/voice valovi nisu dokaz provider rada.

## Granica native reference
`IntentSweepLayer.tsx` daje početnu prezentacionu implementaciju sa istim vremenskim intervalima. Nije povezana/kompajlirana u actual Expo repo-u. Caller mora da obezbedi slojeve belog panela, skrivanje izbora, dostupnost auth cilja, stable callbacks i tačno session ponašanje. JS-driver width u referenci treba profilisati na uređaju; optimizovati kroz ekvivalentan clip/transform tek uz dokaz jednakog kretanja.

41 provera čiste matematike nije dokaz native60fps, splash ponašanja ili Android/iOS rendera. Te kapije ostaju u `QA_ACCEPTANCE.md`.
''')
write('docs/NATIVE_TRANSFER.md','''# Kako se ovaj HTML prenosi u mobilnu aplikaciju

## Ne prenosi se jedna HTML stranica kao završeni native proizvod
Vizuelni tokeni → postojeći theme. SVG putanje → react-native-svg resursi. Layout → postojeće View/Text/ScrollView/FlatList/Pressable komponente. DOM sheet → postojeći native modal/sheet sa Back/focus pravilima. CSS motion → postojeći native scene clock/Reanimated/Animated. Inputi → native TextInput i prave tastature. Demo state/commands → NE PRENOSI SE; tu se koriste postojeći typed source/hook/RPC autoriteti.

Ne postavljati ceo proizvod u WebView radi lažnog identičnog screenshot-a. Specifičan već odobren web/native element u postojećem repo-u zahteva zasebnu odluku; ovaj paket ne uvodi WebView arhitekturu.

## Redosled
**A. Preflight i reuse.** Proveri najnoviji worktree, source ownership, entry/splash/recovery, source index, service contracts i sve postojeće UI komponente. Gde već postoji dobar hook/adapter, preuzmi ga.

**B. Shared presentation.** Tokeni, originalni assets, header/nav, field/action/sheet, TaskCard i accepted AgreementContext. Render poređenje sa V2 na referentnoj širini390 i uslovima320/360/large text.

**C. Prva stvarna vertikala.** Task projection → detalj → prava Prijava → exact izbor → CONFIRMED Dogovor → poruka. Ne povezivati fake source da bi izgledalo uspešno. Ako publication blokira novi test, koristi odobreno test okruženje i jasno označen postojeći fixture na tom okruženju; ne aktiviraj live politiku da prođe demo.

**D. Autoritativni unos i promene.** AI V2 poruke/činjenice/review/nacrt; objava je zasebna kapija. Izmene i završetak po server pravilima. Unknown outcome čuva isti requestId; nova poslovna namera dobija nov ID.

**E. Preostale celine.** Profili, kalendar, Inbox/preferences, prava mapa i lokacije, reviews, safety, account/export, voice/push. Radi po sposobnostima stvarnog motora, ne po broju nacrtanih dugmadi.

## Izgled plus ponašanje
Svaki native ekran mora čuvati entity ID, reviziju i permission kontekst. Povratak iz detalja čuva filtere, query, stranu liste, položaj scroll-a i aktivnu nameru. Pri promeni naloga se ne prikazuje odgovor/nacrt/receipt prethodnog naloga. Destructive action ima posledicu i potvrdu; cancel ne menja ostale podatke.

Soft keyboard ne sme prekriti aktivan unos ili dugme. Testirati Android Back (tastatura → sheet → screen), safe-area/statusbar, landscape ili eksplicitno podržanu orijentaciju, font scaling i duže stvarne stringove. DOM large-text simulation nije zamena za sistemski text scaling.

## Šta ponovo koristiti iz repozitorijuma
Read-only package snapshot već navodi react-native-svg, Reanimated, gesture-handler i safe-area-context u package.json; ne uvoditi novi framework za iste zadatke. Postoje src/ui/entry i src/ui/referenceEntry, kao i AgreementChat. Pročitaj ih pre zamene. Ne prenosi sedam generacija HTML wrappera u native codebase.

## Kritične razlike
Originalna SVG mapa je simbolična. Stvarna mapa mora dobiti provider, javne koordinate/oblasti, settled/debounced viewport query i privacy pravila. Nema lokacije bez dozvole ili ručnog izbora. Voice zahteva stvaran capture/STT. AI zahteva stvarni server/provider. Push zahteva stvarnu isporuku/receipt. Izvoz zahteva stvarnu arhivu i autorizovan vremenski ograničen pristup.

Native-starter komponente nisu dokaz da je išta od toga završeno. Njihov zadatak je da spreče gubitak geometrije/tajminga u prenosu.

## Tehnički izvori za adapter (spoljašnji, ne product canon)
Expo react-native-svg: https://docs.expo.dev/versions/latest/sdk/svg/  
Reanimated reduced motion: https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/  
React Native keyboard: https://reactnative.dev/docs/keyboardavoidingview  
React Native accessibility: https://reactnative.dev/docs/accessibility  
Codex AGENTS guidance: https://developers.openai.com/codex/guides/agents-md/

Koristiti verzije usklađene sa stvarnim repo lockfile-om. Dokumentacija ne daje ovlašćenje za nadogradnju dependencies-a ili promenu kanona.
''')
write('docs/BINDING_GUIDE.md',f'''# Veza prikaza i stvarnog motora

Read-only HEAD: `{SHA}`. Datum: 10.09.2026. Live Supabase nije ponovo upitan ovim krugom; nema nove tvrdnje o njegovoj spremnosti. `contracts/BINDING_MATRIX_66.json` razlikuje pročitano telo koda od samo pronađene putanje.

## Pročitane konkretne granice
`src/data/index.ts` eksplicitno sastavlja production source i zabranjuje tihi pad na lažni izvor kada Supabase nije konfigurisan. V2 AI je zaseban `aiNeedV2Izvor`.

`src/data/aiNeedV2Production.ts` poseduje openConversation/loadConversation/sendMessage/confirmFact/correctFact/saveDraft/openEditConversation/confirmEdit. `sendMessage` poziva uskoci-ai-interview, proverava V2 schema; review čita stvarne facts. SaveDraft potvrđuje rezultat. Edit nosi očekivanu reviziju i request ID, odbija promene nakon prvog Dogovora. Postojanje tog koda nije dokaz aktivnog provider-a ili živog ALLOW-a.

`src/data/applicationClientService.ts` poseduje mojePrijave (rpc_list_my_applications) i povuciPrijavu (rpc_withdraw_response, revizija/verzija/request ID). Ne pripisivati mu submission samo zato što se zove application service.

`src/data/productionAuthorityOverrides.ts` još sadrži legacy objaviPotrebu → rpc_ai_publish_need. Pročitani index izričito kaže da novi R02→R07 ide odvojenim V2 putem. Ovo je zamka pri naivnom mapiranju HTML dugmeta na prvo ime koje deluje odgovarajuće.

## Radni red za svaku akciju
Pronađi njen postojeći typed command u ports/contracts i stvarnog owner-a u kompozicionom index-u/hook-u. Read pre rendera; dostupnost prema server projection-u; korisnička potvrda tek nakon pregleda; stabilan request ID; pending bez duplog upisa; success tek po validiranom receipt-u; refetch authority projection-a; stale zahteva novi pregled; unknown proverava isti pokušaj. Ne pisati direktno u tabele da se zaobiđe RPC.

## Mapa grupa
'''+'\n\n'.join(f'### {g}\nPovršine: {", ".join(v["keys"])}.\n\n{v["boundary"]}.\n\nNivo izvora: **{v["level"]}**.\n\nTragovi: '+', '.join('`'+p+'`' for p in v['paths']) for g,v in groups.items())+f'''

## Source reference
{URL}src/data/index.ts  
{URL}src/data/aiNeedV2Production.ts  
{URL}src/data/applicationClientService.ts  
{URL}src/data/productionAuthorityOverrides.ts  
{URL}package.json

Ne koristiti ovaj snapshot kao razlog da se vrati HEAD ili pregazi noviji rad. Uputstvo za source reuse nije tvrdnja da je svaka funkcija live.
''')
write('docs/ACTION_CONTRACT.md','''# Ugovor svake radnje

JSON screen catalog beleži kontrole iz normalnog fixture prikaza, ne kompletan runtime call graph. Dynamic menus, drugi nalozi i alternate states zahtevaju dodatni pregled.

Za SVAKU native radnju sačuvati: stabilan UI action ID; nameru korisnika; entity/parent/version; nalog i role; permission/capability guard; ulazni validirani tip; postojeći service owner; read-before-write; requestId/receipt; potvrđeni ishod; refetch; error/stale/unknown ponašanje; cancel/Back; accessibility label; dokaz sa realnim izvorom.

Navigacijska radnja ne sme da usput potvrdi poslovnu promenu. Filter/paginacija ne smeju da izbrišu kolekciju. Success poruka ne sme da zameni rezultat komande. Izabrana ponuda ne sme da postane druga ponuda zbog novog sort-a. Checkbox potvrde se poništava kada se promene podaci koje korisnik potvrđuje. Retry iste namere koristi isti request ID; nova izmenjena namera nije isti retry.

Disabled/gated: objasni ljudski razlog u pravom kontekstu. Ne ostavljati dugme bez handlera ili sa console.log/toast lažnim uspehom. Prezentaciona stub funkcija mora biti eksplicitno dev-only. Svaka nepostojeća backend sposobnost ulazi u OPEN_GAPS; ne rešava se dekoracijom.

Production copy: ukloniti oznaku „demo“ tek kada postoji prava radnja i dokaz. Ne prepisivati „arhiva spremna“, „identitet potvrđen“, „poslato“ ili „objavljeno“ iz željenog vizuelnog stanja bez source potvrde. Razvojni nazivi RPC, gate kodovi i studio kontrole nisu namenjeni krajnjem korisniku.
''')
write('docs/QA_ACCEPTANCE.md','''# Acceptance za prenos i završavanje aplikacije

## Lokalni rezultati ove isporuke
42 postojeće regresione provere i37 novih V2 provera prolaze. Nove obuhvataju izbor namere bez ghost teksta, reduced/cancel/double-tap, izvoz/otkaz/izolaciju naloga/offline, lokalni map viewport/list parity, chat sheet/focus, sažetak ponude, source-aligned zaključavanje task edit-a i race pri čuvanju.

41 dodatna provera odnosi se SAMO na čistu matematičku jednakost SVG scene (39 frame uzoraka + reduced i invalid input), ne na native UI. 66 površina renderovano, proverene širine390/360/320 i320 sa uvećanim tekstom; 313 alternativnih stanja preglednika. Bez uočenog horizontalnog page overflow-a i JS pageerror-a u tim proverenim uslovima. Ovo nije dokaz svih kombinacija stanja, kontrasta, screen-reader ponašanja, fizičkog touch target-a ili performansi.

`evidence/` sadrži mašinske rezultate, `source/` skripte za ponavljanje. Početni fixture otvaran iz studija nije dokaz da je svaki ekran dostupan iz normalnog toka.

## Native kapije
A. Prvi/povratni ulazak, auth, validan/istekao recovery, dozvole u kontekstu. Intro geometrija, wink, slojevi, reduced-motion, background i povratni deep-link. Nema duple navigacije.

B. AI → stvarne facts → ljudska korekcija → review → stvarni nacrt. Provider unavailable/timeout/invalid-schema/clarify/block/offline imaju stvarno stanje. Tajne ne izlaze na klijent. Publikacija je odvojena i dozvoljena samo po autoritetu.

C. Dva stvarna test naloga: A dozvoljeno objavi; B nalazi isti task u javnoj listi/mapi, šalje ponudu sa cenom/ljudima/terminom; A vidi tačnu ponudu, bira konkretnu verziju; server vraća jedan CONFIRMED Agreement. Dupli tap/stale/overfill se ne završavaju drugom saradnjom.

D. Oba naloga čitaju identičan prihvaćeni snapshot. Naknadna izmena profila ili drugih objekata ga ne prepisuje. Task edit lock se proverava i pri ulazu i pri potvrdi. Uslovi se menjaju preko Agreement proposal autoriteta.

E. Poruka ide pravim drugim nalogom, ostaje posle reload-a, retry koristi isti request ID; account switch odbacuje kasni rezultat. Inbox događaj vodi u tačan Agreement i read scope je samo tog naloga. Push na telefonu se proverava odvojeno.

F. Predlog izmene/accept/reject/problem/cancel/completion čuvaju aktuelnu reviziju i prava. Review se povezuje tek po stvarnom završetku i odobrenoj politici. Nije dovoljno da zvezdice mogu da se kliknu.

G. Map provider: gerçekne javne koordinate/oblast, pan/zoom/settled query, ista lista, no-results, nema pina kada nema lokacije; ručni izbor i denied GPS ne glume dobijenu lokaciju; exact address ne ulazi u public kartu. Bez live tracking-a.

H. Kalendar: availability nije potvrđena obaveza; konflikt nije automatsko otkazivanje; availability ON nije HITNO. Prava lokalna zona/date boundary; uređajski picker i veliki tekst.

I. Export: REQUESTED nije READY; cancel receipt/status; file ownership i stvarni archive generator. Closure: preflight/aktivne saradnje/pravni retention i stvarni server job. Nema klijentskog brisanja naloga kao zamene.

J. Pravi Android, iOS kada je dostupno: system text scaling, screen reader labels/focus, keyboard, Back, safe-area, offline/reconnect, render/scroll i animacija. Screenshot porediti po ulozi i stanju, ne sa pogrešnim fixture nalogom.

## Kada je funkcija gotova
UI referenca + native implementation + stvarni service binding + pozitivni i negativni realni test + dokazi. Tek tada promeniti status te funkcije. Ne pretvarati status target shown u finished masovnom promenom kolone.
'''.replace('gerçekne','stvarne'))
write('docs/OPEN_GAPS.md','''# Šta nije zatvoreno ovim krugom

**Native povezivanje:** nijedan novi V2 ekran nije integrisan u Expo repo u ovom radu. Nema APK-a, iOS build-a, fizičkog E2E ili pravog provider poziva. Native-starter TSX nije kompajliran u actual repo-u; čista matematika jeste.

**Prava mapa:** lokalna šema sada reaguje na drag/zoom i izbor oblasti, ali nema tiles/provider, geocoder, stvarne geografije viewport-a, GPS-a ili query/paging-ja servera. F074 nije proglašen potpuno završenim. X04 odluka se ne skriva.

**Export:** F167 lokalna simulacija je popravljena. Pravi receipt, obrada, autorizacija arhive i stvarno preuzimanje ostaju na backendu.

**Uređaj i provajderi:** pravi AI task/worker AI, voice/STT, upload, push, reviews/safety/closure i ostale integracije se moraju potvrditi na najnovijem source-u i live/staging stanju. Ovaj dokument ne tvrdi da ništa od toga ne postoji: nije dokazano ovom isporukom.

**Poslovne odluke:** svih10 izvornih otvorenih odluka ostaje u OPEN_DECISIONS.md: dodatne Auth metode, AI pomoć u Prijavi, refund/correction, reputacija, blokiranje u aktivnom Dogovoru, no-show/replacement, NeedPlan, ponavljanja, pretplate i više tržišta.

**Prezentaciona validacija:** svi normalni prikazi pregledani su u atlasu; veći zahvati su na entry/chat/apply/map/export. Ostali koriste zajednički polish, nisu svi iznova projektovani. Chromium large-text je simulacija. Nisu završeni nezavisno korisničko testiranje, potpuna screen-reader provera, stvarna soft keyboard matrica, platform font parity ili native motion performanse.

**Kapije:** HITNO, pozitivna naplata i production publication ne postaju aktivni ovim radom. U otvorenom statusu prikaži razlog, ne lažan uspeh. Ne menjati server da bi se prilagodio neproverenom prototipu.
''')
write('docs/SOURCE_PROVENANCE.md',f'''# Izvori i granice

Input HTML SHA-256: `{hashlib.sha256((R/'input/BASE_LINEAGE_V1.html').read_bytes()).hexdigest()}`  
V2 output SHA-256: `{digest}`.

Read-only canonical GitHub: `{SHA}`. Pročitani branch metadata, package.json, src/data/index.ts, applicationClientService.ts, aiNeedV2Production.ts i productionAuthorityOverrides.ts. Pročitane su i liste putanja src/data i src/ui. Lista putanja nije test funkcionisanja.

Ova isporuka nije ponovo upitala live Supabase, nije primenila migracije, nije promenila source branch, nije menjala Figma-u. Brojevi testova iz merge poruke nisu ponovljeni ovde. Lokalni dokazi su isključivo u evidence/.

Originalni kriterijumi186 iz priloženog handoff-a ostaju verbatim. Sadržaji iz historical reference služe kao dopunska specifikacija Living Task/Voice, ne nova vizuelna vlast. Izvorni statusi source_current u istorijskom JSON-u moraju se ponovo proveriti pred integraciju.

Artefakti ne sadrže ključeve, credentials ili font fajlove. SVG resursi su izvučeni iz korisnikovog HTML-a; contextual motifs su novi mali vektorski elementi iz V2 koda. assets/manifest.json navodi poreklo i otiske.
''')
write('native-starter/README.md','''# Početni native reference adapteri

Ovo NIJE izmenjen produkcioni source niti završen native screen. Najpre pročitaj postojeći src/ui/entry, referenceEntry i njihove hooks/testove, pa reuse.

BrandMark.tsx / brandAssets.ts: tačne postojeće SVG putanje. IntentSweepLayer.tsx: prezentacioni izbor namere (hide oba sadržaja u parent-u, layer ispod belog logo panela, caller-owned auth cilj, reduced/cancel). tokens.ts: spoji u postojeći theme. BrandSceneMath.ts: čista originalna geometrija, bez DOM-a i navigacije.

Pure math TypeScript je kompajliran i41 proverom upoređen sa originalnom HTML scenom. React Native TSX se mora typecheck-ovati u stvarnom repo-u, renderovati i profilisati na uređaju. Ne pozivati ga native-proven samo zato što postoji fajl. Paket ne menja dependency verzije.

Za animiranje originalnog lockup-a koristiti originalne SVG grupe/parts i word-clip; caller mora izmeriti phone/logo box u istim koordinatama. Nemoj animirati celu bitmapu kao zamenu za sklapanje i namig. Ne prenositi font fajlove.
''')
write('AGENTS.md','''# Scope: samo ovaj handoff folder

Ovaj fajl ne zamenjuje AGENTS.md canonical repo-a. Ne kopirati ga preko postojećih pravila.

Prvo pročitaj 00_READ_FIRST.md i01_CODEX_START_PROMPT.md. V2 HTML je UI referenca, a existing canonical contracts i server autoritet su business/data referenca. Ne kopirati fake state, demo users, studio handlers ili timer-based provider simulacije u produkcijski path. Nikakav WebView whole-app shortcut.

Nema produkcijskih upisa, aktivacija, automatskog merge-a, resetovanja branch-a, izmene tajni ili dependencies bez odobrenog implementacionog zadatka. Uvek prijavi stvarni capability gap; nikad ne fabrikuj uspeh. Native-starter je neintegrisana referenca. Screen default action inventory nije potpuna pokrivenost svih runtime grana.
''')
print('Docs ready',len(cat),'screens',len(fd['items']),'functions',fd['v2_counts'])
