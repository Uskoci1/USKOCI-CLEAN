# USKOČI — CODEX AUTONOMOUS WHOLE-PRODUCT CLOSURE MASTER
## FORENSIC RE-ADMISSION ONCE → RECONSTRUCT EXACT CURRENT STATE → IMPLEMENT CONTINUOUSLY → TEST → PROVE → MERGE → PROMOTE SAFELY → CONTINUE
## EXECUTION-FIRST / NO RESTART / NO REINTERPRETATION / NO FAKE COMPLETENESS
## TARGET: COMPLETE PRODUCTION-READY / STORE-READY USKOČI PRODUCT

### CURRENT AUTHORITY PRECEDENCE ADDENDUM — 07.09.2026
Where this ultra master conflicts with newer physical/current authority, use this order:
1. fresh canonical GitHub + fresh authorized live Supabase for what is actually implemented/live;
2. 06.09 current product/UIUX reconstruction + final 28-surface blueprint for current user-facing navigation, terminology and screen contracts;
3. frozen 03.09 governing master for deeper product/system intent and historical authority where not superseded;
4. this execution master for operating method, autonomy, proof and closure discipline.
Never use an older textual cursor to overwrite newer canonical work.

Ovo je DIREKTAN NASTAVAK postojećeg USKOČI projekta.

OVO NIJE:
- novi projekat;
- greenfield;
- novi MVP;
- rewrite;
- design-only zadatak;
- audit-only zadatak;
- dokumentaciona sesija;
- novi pokušaj da rekonstruišeš proizvod po svom ukusu;
- dozvola da promeniš postojeću product semantiku;
- dozvola da odbaciš već dokazani kod;
- dozvola da izmisliš novi backend;
- dozvola da ponavljaš već zatvorene proof jedinice samo zato što ih nisi lično radio.

TVOJ POSAO JE:

PREUZMI POSTOJEĆI USKOČI TAČNO U STANJU U KOME SE SADA ZAISTA NALAZI,
POTPUNO GA RAZUMI,
REKONSTRUIŠI SVE ŠTO JE VEĆ IMPLEMENTIRANO I DOKAZANO,
UTVRDI TAČAN TRENUTNI CURSOR,
A ZATIM PREĐI U KONTINUIRANU FIZIČKU IMPLEMENTACIJU.

Kodiraj.
Povezuj.
Pokreći.
Testiraj.
Popravljaj.
Dokazuj.
Merge-uj.
Nastavljaj.

NE STAJ nakon prvog uspešnog PR-a.

NE završavaj sesiju samo zato što si završio jednu usku jedinicu ako postoji sledeća nezavisna jedinica koju možeš bezbedno nastaviti.

Glavni cilj nije „dobar audit“.

Glavni cilj je:

USKOČI KOJI JE STVARNO ZAVRŠEN PROIZVOD.

======================================================================
0. ABSOLUTNO PRVO — FIZIČKI UTVRDI TRENUTNO STANJE
======================================================================

Repository:

Uskoci1/USKOCI-CLEAN

Canonical branch je istorijski:

clean-alpha-backend

Poslednji poznati canonical HEAD u trenutku ovog handoff-a bio je:

6af6ab23118660840cce38d9f9befaec07b5df45

Tada su već bili merge-ovani:

PR #39 — N01 message counterpart events
PR #40 — N02 selected Worker event
PR #41 — N03 event-level Inbox backend
PR #42 — N02/N03 continuity reconciliation
PR #43 — N05 Agreement change events
PR #44 — N06 Expo push token registry

Tada je postojao OPEN PR:

#45 — N04: ship real mobile Inbox and bell with physical Android evidence

poznati head:
576e56b6f4da1db509f4a269962654ff928a1e3f

ALI OVO NIJE NAREĐENJE DA SE VRATIŠ NA TAJ HEAD.

OVO JE SAMO POSLEDNJI POZNATI CURSOR.

PRE NEGO ŠTO MENJAŠ BILO ŠTA:

1. fetch remote;
2. pročitaj stvarni clean-alpha-backend HEAD;
3. proveri PR #45;
4. proveri sve PR-ove nastale posle #45;
5. proveri poslednje canonical merge commit-e;
6. proveri relevantne GitHub Actions;
7. proveri da li postoje noviji status/handoff/proof dokumenti;
8. proveri live Supabase ako imaš autorizovan pristup.

Ako je projekat otišao dalje:

NASTAVI OD NAJNOVIJEG STVARNOG STANJA.

NIKADA ne vraćaj repository na SHA iz ovog prompta.

NIKADA ne overwrite-uj noviji rad starim cursor-om.

======================================================================
1. SAM POSTAVI CODEX WORKSPACE
======================================================================

Ne traži od korisnika da pravi lokalni USKOČI folder na Windows računaru.

Koristi svoj Codex workspace.

Sam:

- poveži/preuzmi GitHub repository;
- fetch relevant refs;
- checkout current canonical;
- pročitaj git history;
- instaliraj dependencies;
- koristi repo-defined Node/package manager setup;
- utvrdi Expo/React Native/Supabase tooling;
- pokreni osnovne validation komande;
- koristi postojeće CI/proof skripte.

Ako je potrebno napraviti branch:

napravi narrow implementation branch iz SVEŽEG canonical HEAD-a.

Ne pravi drugi USKOČI projekat.

Ne pravi paralelni „cleaner“ app.

Ne migriraj kod u novi framework bez ozbiljnog dokazanog razloga.

======================================================================
2. SUPABASE — FIZIČKI PROVERI PRISTUP
======================================================================

Canonical Supabase project je istorijski bio:

leqcwgzvjsxugfgzdmth

Ali prvo potvrdi stvarni project identity.

Ako environment ima:
- Supabase plugin;
- MCP;
- CLI;
- API;
- autorizovane environment credentials;
- drugi već postojeći bezbedan connector,

koristi postojeći pristup.

Ne traži od korisnika da ručno exportuje bazu ako pristup već postoji.

Ako nemaš live pristup:

jasno zabeleži da live read/write nije dostupan,
ali NE blokiraj source implementation koja može bezbedno da se radi i testira u disposable/local environment-u.

NIKADA ne izmišljaj live observations.

======================================================================
3. LIVE SUPABASE SAFETY MODEL
======================================================================

Za production Supabase koristi:

READ → COMPARE → PROVE → REVIEW → FORWARD PROMOTION → POSTFLIGHT

Ne:

GUESS → APPLY.

PHASE A — READ ONLY

Proveri relevantno:

- project identity;
- migration history;
- latest migration;
- schema;
- tables;
- indexes;
- RLS;
- policies;
- grants;
- RPC/function bodies/fingerprints;
- triggers;
- Edge deployment state;
- feature flags;
- marketplace config;
- gated inventories;
- relevant production counts samo ako su potrebni i bezbedni.

PHASE B — SOURCE

Implementiraj:

- forward candidate;
- tests;
- disposable reconstructed DB proof;
- mobile integration;
- CI.

PHASE C — LIVE PROMOTION

Samo ako:

- current live predecessor odgovara očekivanom;
- nema drift-a;
- candidate je green;
- regression je green;
- migration integrity je green;
- security je green;
- promotion je eksplicitно dozvoljen current governing pravilima.

Nikada:

- ne menjaj applied migration bytes;
- ne rewrite-uj migration history;
- ne briši production podatke da bi test prošao;
- ne koristi production kao sandbox;
- ne zaobilazi promotion gate.

======================================================================
4. URADI JEDAN FULL FORENSIC RE-ADMISSION — ONDA PRESTANI DA AUDITUJEŠ U KRUG
======================================================================

Pre velikog kodiranja uradi jedan dubok read.

Pronađi i pročitaj current relevant:

- AGENTS.md;
- HANDOFF;
- CURRENT STATUS;
- CURRENT CANON;
- machine-readable status/ledger;
- implementation tracking;
- proof ledger;
- migration manifest;
- Supabase proof docs;
- release gates;
- mobile architecture;
- UX/product canon;
- visual handoff;
- security decisions;
- AI decisions;
- HITNO decisions;
- monetization decisions.

Ako postoji sadržaj iz:

USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip

razumi ga.

Ali:

NOVIJI CANONICAL CODE + NOVIJI LIVING STATUS
pobeđuju stariji historical dokument.

Historical dokumentacija je istorija, ne automatski current authority.

Posle ovog full re-admission-a:

NE PONAVLJAJ FULL AUDIT pre svake naredne jedinice.

Radi samo narrow preflight.

======================================================================
5. REKONSTRUIŠI ŠTA USKOČI JESTE
======================================================================

USKOČI je marketplace:

„Čovek tamo gde Vi niste.“

Dve glavne uloge:

NARUČILAC
USKOČER

Jedan account može imati obe uloge.

Osnovni motor:

Naručilac
→ kreira Potrebu

Uskočer
→ vidi Priliku
→ prijavljuje se

Naručilac
→ vidi kandidate
→ bira

Selection
→ stvara Dogovor / Agreement

Dogovor
→ komunikacija
→ izvršenje
→ izmene
→ završetak
→ reputacija/review.

Ne pretvaraj USKOČI u:
- gig bidding clone;
- klasični e-commerce;
- delivery-only app;
- payment escrow app,
osim ako current canon eksplicitно kaže drugačije.

======================================================================
6. ZAKLJUČANA GLAVNA NAVIGACIJA — NOVIJI 06.09 CANON
======================================================================

VAŽNO: ova sekcija superseduje starije navigacione pretpostavke iz frozen mastera tamo gde se razlikuju.

User-facing mental model je:

Zadatak → Prijava → Dogovor

Jedan nalog; dve trenutne namere: MENI TREBA i JA MOGU.

MENI TREBA — finalna 3-zone navigacija:

Zadaci | U / Novi | Dogovori

JA MOGU — finalna 3-zone navigacija:

Prijave | U / Zadaci | Dogovori

Globalne ulazne površine:

- zvonce → S06 Obaveštenja / Inbox;
- avatar → R09 Profil MENI TREBA ili W08 Radni profil;
- Profil NIJE permanent bottom tab;
- nema permanent Početna;
- nema finalnog Kombinovano moda;
- Dogovor top IA je tačno Pregled | Poruke; Hronologija je embedded u Pregled.

Internal screens nisu dodatni top-level tabovi.

Ne menjaj navigation semantics zbog ličnog dizajnerskog ukusa.

Ako bilo koji stariji dokument navodi Početna/Potrebe/Profil kao permanent bottom tabs, ili Lista/Mapa/Kombinovano kao finalni discovery model, tretiraj to kao superseded UI/navigation lineage i primeni 06.09 UI/UX reconstruction + 28-surface blueprint.

======================================================================
7. NE PREPISUJ POSTOJEĆI MOTOR
======================================================================

Need → Response/Application → Selection → Agreement motor je već prošao ozbiljan rad.

Čuvaj postojeće dokazane osobine:

- revision/version semantics;
- stale guards;
- eligibility;
- idempotency;
- atomic selection;
- exact actor authority;
- cancellation behavior;
- activation;
- execution state;
- RLS;
- server-derived ownership;
- participant binding.

Ako nađeš bug:

NAĐI ROOT CAUSE
→ narrow repair
→ regression
→ proof.

Ne pravi novu arhitekturu samo zato što deluje elegantnije.

======================================================================
8. POSTOJEĆI PROOF SE POŠTUJE
======================================================================

Istorijski su već fizički dokazivani:

- dva različita stvarna Auth naloga;
- Worker Application;
- Requester candidate listing;
- Selection;
- Agreement creation;
- Dogovor opening;
- replay/idempotency;
- P0D03 0 RSD semantics;
- Android emulator UI journey;
- navigation safe-area;
- message durable event;
- selected Worker durable event;
- event Inbox backend;
- Agreement change events;
- revision-safe Expo token registry;
- mobile Inbox physical candidate.

Fizički proveri šta je zaista canonical.

Ako je proof:
- exact-head;
- artifact-reviewed;
- green;
- canonical;

ne ponavljaj isti proof bez razloga.

Regression čuva zatvorenu semantiku.

======================================================================
9. GLAVNI OPERATIVNI REŽIM: 85% IMPLEMENTACIJA
======================================================================

Od ovog trenutka radi približno:

85%:
- product code;
- backend;
- mobile;
- integration;
- tests;
- debugging;
- Android proof;
- CI;
- promotion.

15%:
- provenance;
- status;
- minimal docs;
- handoff.

Ne provodi sat vremena dokumentujući 15 minuta koda.

Ne pravi status dokument o status dokumentu.

Dokument služi da se rad nastavi.

KOD JE GLAVNI OUTPUT.

======================================================================
10. NE STAJ POSLE JEDNE JEDINICE
======================================================================

Standardni loop:

READ CURRENT HEAD
→ SELECT NEXT DEPENDENCY-SAFE UNIT
→ IMPLEMENT
→ TEST
→ PROVE
→ PR
→ GATES
→ MERGE
→ VERIFY CANONICAL
→ SELECT NEXT UNIT
→ CONTINUE.

Ako sledeća jedinica može da se radi:

NASTAVI.

Ne završavaj samo sa:

“PR opened, next steps are…”

Ako možeš da izvedeš next steps sada:
izvedi ih.

======================================================================
11. DEFINITION OF DONE
======================================================================

„Kod postoji“ != DONE.

Za user-facing production jedinicu, zavisno od rizika, traži:

- implementation;
- TypeScript/build;
- unit/contract tests;
- integration;
- RLS/security;
- replay/concurrency;
- rollback/failure;
- real Auth;
- mobile data path;
- Android runtime;
- backend postflight;
- CI;
- merge;
- production promotion ako pripada scope-u;
- live postflight.

Koristi proporcionalnost.

Ne pravi emulator proof za typo.

Ali ne proglašavaj veliki tok završen samo na Jest testu.

======================================================================
12. TRENUTNI PR/CURSOR
======================================================================

Ako je #45 i dalje OPEN:

prvo ga fizički pregledaj.

Proveri:

- diff;
- base;
- head;
- CI;
- CodeQL/security;
- exact Android artifact;
- proof claims;
- current canonical compatibility.

Ako je čist:

merge po postojećoj disciplini
→ canonical post-merge checks
→ nastavi.

Ako je #45 već merge-ovan:

ne vraćaj se na njega.

Ako je superseded:

koristi novu jedinicu.

======================================================================
13. NOTIFICATION / INBOX VERTICAL — ZAVRŠI GA END-TO-END
======================================================================

N01–N06 su foundation.

Cilj je:

DOMAIN ACTION
→ DURABLE EVENT
→ INBOX
→ UNREAD
→ PREFERENCES
→ TRANSPORT ELIGIBILITY
→ DEVICE TOKEN
→ DISPATCH
→ PROVIDER
→ TICKET
→ RECEIPT
→ RETRY
→ USER TAP
→ SAFE DEEP LINK.

Završi coverage za relevantne događaje:

- Application submitted;
- Selection;
- Agreement changes;
- messages;
- completion;
- cancellation;
- relevant trust/review actions;
- AI/HITNO ako zahtevaju event;
- system actions.

Čuvaj:

durable event čak i kada su transport preferences OFF,
ako je to current event model.

======================================================================
14. PUSH
======================================================================

Push registry != Push system.

Završi:

- permission request;
- Expo/native token acquisition;
- account-bound register;
- revision/CAS;
- revoke;
- token rotation;
- reinstall/rebind;
- logout;
- preference opt-in;
- per-category settings;
- quiet hours;
- dispatcher;
- provider call;
- ticket persistence;
- receipt checking;
- retry;
- permanent failure;
- stale token cleanup;
- cancellation;
- foreground;
- background;
- terminated app;
- deep links;
- privacy-safe notification body.

Registration NIKADA ne sme automatski uključiti opt-in ako product semantics to ne zahtevaju.

Ne stavljaj poverljive Dogovor detalje na lock screen.

======================================================================
15. CHAT — PRODUCTION-GRADE
======================================================================

Završi Agreement chat.

Potrebno:

- participant-only access;
- server authority;
- pagination;
- deterministic ordering;
- send;
- retry;
- duplicate-submit semantics;
- unread;
- read;
- counterpart event;
- push;
- lifecycle;
- terminal Agreement behavior;
- error states;
- offline behavior;
- refresh;
- account-switch safety.

Ako product canon zahteva attachments:

- storage;
- authorization;
- type;
- size;
- upload transaction semantics;
- orphan cleanup;
- signed/private access.

Ne pravi novi chat model ako current može da se proširi.

======================================================================
16. DOGOVOR / AGREEMENT
======================================================================

Dovrši zajedničku površinu.

Obe strane moraju imati konzistentan pogled na:

- current Agreement;
- version;
- status;
- terms;
- proposal;
- acceptance;
- rejection;
- history;
- execution;
- completion;
- cancellation.

Sačuvaj dokazani bilateralni Agreement-change model.

Ne vraćaj legacy unilateralni authority.

Posebno revalidiraj ako još postoji:

rpc_propose_agreement_change legacy

Ako nije bezbedan:
revoke/retire kroz current approved pattern.

======================================================================
17. COMPLETION
======================================================================

Implementiraj stvarni completion lifecycle.

Definiši prema current canon-u:

- ko inicira;
- ko potvrđuje;
- unilateral edge cases;
- timeout;
- cancellation vs completion;
- audit;
- notifications;
- review eligibility;
- state locking.

Ne koristi samo client-side status.

======================================================================
18. REVIEWS / REPUTATION
======================================================================

Ako nije završeno:

implementiraj pravi review system.

Potrebno:

- only eligible completed Agreement;
- reviewer/reviewee binding;
- one review per direction;
- rating bounds;
- optional text;
- replay protection;
- privacy;
- moderation;
- aggregate score;
- review count;
- public projection;
- profile integration;
- mobile UX.

Staro rating_worker polje nije dovoljan review sistem.

======================================================================
19. AVAILABILITY / CALENDAR
======================================================================

Završi server authority za availability.

Potrebno:

- recurring availability;
- overrides;
- unavailable;
- Agreement occupancy;
- timezone;
- overlap;
- reschedule;
- cancellation release;
- calendar screen;
- opportunity filtering/matching.

Ne dozvoli da dva korisnika uspešno rezervišu isti kapacitet ako canon to zabranjuje.

======================================================================
20. TEAM CAPACITY
======================================================================

Istorijski je postojao gap između:

covered_slots
i
team_capacity.

Fizički proveri trenutno stanje.

Ako gap postoji:

server-side authority mora proveriti stvarni kapacitet.

Concurrency test obavezan.

======================================================================
21. PUBLIC PROFILE / TRUST
======================================================================

Završi jasan split:

PRIVATE ACCOUNT DATA
vs
PUBLIC MARKETPLACE PROJECTION.

Public projection treba da izloži samo potrebne podatke:

- ime/display identity;
- photo;
- role;
- skills/capabilities;
- relevant vehicle/tools;
- rating/reviews;
- verification/trust state koji je zaista stvaran.

Ne otvaraj celu private profile tabelu.

======================================================================
22. IDENTITY
======================================================================

Identity ostaje fail-closed dok nije zaista admitted.

Ako:

identity_admitted=false

onda UI ne sme da tvrdi:

„Verifikovan“.

Ako implementiraš identity:

- provider/process;
- state machine;
- sensitive data isolation;
- public projection;
- revocation;
- error;
- privacy;
- audit.

======================================================================
23. STORAGE
======================================================================

Završi storage za realne product potrebe:

- profile media;
- Need media;
- chat;
- evidence ako postoji.

Za svaki bucket/path:

- owner/participant rules;
- private/public;
- MIME;
- size;
- malicious file handling;
- orphan cleanup;
- deletion;
- signed URL;
- cache semantics.

======================================================================
24. MAPA / LOKACIJA
======================================================================

Mapa placeholder NIJE završena funkcija.

Završi:

- actual map provider/component;
- pins;
- selected pin;
- cards;
- list/map parity;
- bounds;
- clustering gde ima smisla;
- geodesic distance;
- location permission;
- denied state;
- manual location;
- approximate privacy;
- exact location restrictions;
- loading/error;
- filters;
- opportunity matching.

Ne otkrivaj privatnu adresu nepotrebno pre Dogovora.

======================================================================
25. AI — DOVEDI GA DO REALNE KONTROLISANE UPOTREBE
======================================================================

AI ne treba trajno ostati dormant.

Ali AI nije database/business authority.

Primarne AI površine:

A. Worker AI interview
B. Need creation assistant
C. text → structured facts
D. category/skill suggestions
E. assistance/recommendations
F. moderation assistance gde je opravdano.

Arhitektura:

Mobile
→ authenticated server/Edge
→ model
→ structured validated result
→ human confirmation
→ normal business RPC.

NIKADA:

React Native OPENAI_API_KEY.

Secrets samo server-side.

Implementiraj:

- schema validation;
- timeouts;
- retries;
- malformed output;
- abuse controls;
- moderation;
- provenance;
- cost protection;
- fallback;
- human confirmation.

Proveri postojeći uskoci-ai-interview pre pravljenja novog AI backend-a.

Ako je postojao 502:
nađi root cause.

======================================================================
26. APPLICATION AI
======================================================================

Application AI ne aktiviraj samo prebacivanjem flag-a.

Prvo proveri:

- current product semantics;
- authority;
- moderation;
- structured output;
- confirmation;
- abuse;
- fail-safe;
- tests.

Zatim kontrolisano admit.

======================================================================
27. HITNO — PRIORITETNO DOVESTI DO AKTIVACIJE
======================================================================

Korisnik želi HITNO kao stvarnu funkciju.

Proveri current engine.

Istorijski je postojao:

enabled=false
allowedCategories=[]

Ako je i dalje tako:

dovrši pre aktivacije:

- eligible categories;
- category authority;
- UI;
- Worker eligibility;
- availability;
- radius;
- dispatch/matching;
- high-priority notifications;
- safety;
- abuse;
- cancellation;
- fallback;
- pricing/config.

Tek onda controlled activation.

Ne hardcode-uj HITNO policy po client ekranima.

======================================================================
28. MONETIZACIJA — TEHNIČKI PRODUCTION READY, EFEKTIVNO 0 RSD
======================================================================

Ovo je zaključana trenutna poslovna odluka:

MONETIZATION INFRASTRUCTURE TREBA DA BUDE PRODUCTION-READY.

ALI EFEKTIVNA PLATFORM CENA TRENUTNO OSTANE:

0 RSD.

Dok vlasnik proizvoda centralno ne promeni cenu.

Implementiraj gde je potrebno:

- marketplace pricing config;
- versioning;
- market/currency readiness;
- entitlement ledger;
- connection access;
- idempotency;
- grant;
- revoke;
- replacement;
- audit;
- reconciliation;
- provider abstraction;
- webhook safety;
- failure state.

Cena mora biti CENTRALNO KONFIGURABILNA.

Mobile release ne sme biti potreban da promenimo cenu sa 0 na buduću cenu.

Ne aktiviraj realno skidanje novca bez eksplicitne odluke.

======================================================================
29. PAYMENT PROVIDER
======================================================================

Ako provider još nije konačno odabran:

ne blokiraj domain architecture.

Napravi:

- provider-neutral contracts;
- charge intent/state;
- entitlement lifecycle;
- verified webhook boundary;
- replay/idempotency;
- reconciliation.

Ali ne izmišljaj provider-specific production credentials.

======================================================================
30. MULTI-MARKET
======================================================================

Istorijski je postojala Srbija/RSD pretpostavka.

Ne pravi nepotreban global rewrite.

Ali ne hardcode-uj nove monetization delove tako da zauvek spreče:

- country;
- currency;
- market;
- locale.

Srbija ostaje current launch market.

======================================================================
31. ACCOUNT / PRIVACY / DATA RIGHTS
======================================================================

Završi:

- logout;
- account switch;
- session lifecycle;
- push revoke;
- close account;
- delete/anonymize policy;
- retention;
- FK lifecycle;
- media cleanup;
- review/history semantics;
- legal records;
- confirmation;
- high-risk reauth.

Ne koristi slepi CASCADE DELETE.

======================================================================
32. NOTIFICATIONS SETTINGS
======================================================================

Napraviti stvarnu mobile settings površinu:

- category preferences;
- push;
- email/SMS ako stvarno postoje;
- quiet hours;
- urgent overrides gde canon dozvoljava;
- system permission state;
- device registration state.

UI state mora odgovarati backend authority.

======================================================================
33. SAFETY / ABUSE
======================================================================

Proveri product potrebe:

- report;
- block;
- moderation;
- abusive content;
- account restrictions;
- evidence;
- recovery.

Ne implementiraj pseudo-safety ekran bez server authority.

======================================================================
34. SECURITY — OBAVEZNA CROSS-CUTTING DISCIPLINA
======================================================================

Za svaku sensitive jedinicu proveri:

AUTHORIZATION:
- owner;
- participant;
- outsider;
- anon;
- role confusion.

DATABASE:
- RLS;
- grants;
- direct writes;
- search_path;
- SECURITY DEFINER/INVOKER.

STATE:
- stale version;
- replay;
- duplicate;
- concurrent request;
- transaction rollback.

DATA:
- private fields;
- token exposure;
- raw event payload;
- signed URLs.

CLIENT:
- no authority;
- no secrets;
- no fake success.

SERVER:
- server-derived recipient;
- server-derived price authority;
- server-derived Agreement binding.

======================================================================
35. MOBILE DATA LAYER
======================================================================

Čuvaj čistu putanju:

SCREEN
→ HOOK/MODEL
→ CLIENT SERVICE
→ RPC/API
→ SERVER AUTHORITY.

Ne vraćaj fake override data u production.

Razlikuj:

LOADING
EMPTY
ERROR
UNAVAILABLE
OFFLINE
STALE SESSION.

Ne pretvaraj error u [].

Ne prikazuj fabricated success.

======================================================================
36. SESSION SAFETY
======================================================================

Za async mobile tokove proveri:

- request započet na Account A;
- logout;
- Account B login;
- stari response ne sme da se objavi u Account B state.

Proveri:

- epoch/session ownership;
- cancellation;
- screen blur;
- unmount;
- late promise;
- navigation after logout.

Ovo je posebno važno za:

Inbox,
Chat,
Profile,
Agreement,
AI,
Push settings.

======================================================================
37. MOBILE DESIGN — FUNKCIONALNO PA FINALNO VRHUNSKI
======================================================================

USKOČI ne sme završiti kao generički Expo prototype.

Cilj:

- svetla dominantna podloga;
- white/ivory;
- forest/green;
- orange accent;
- čist;
- topao;
- moderan;
- mlad;
- pregledan;
- minimalan ali ne prazan;
- kvalitetan typography hierarchy;
- premium mobile spacing;
- jasni CTA;
- velika touch područja;
- prijatan motion gde doprinosi UX-u.

Ne pretrpavaj.

Ne koristi ogromne enterprise kartice svuda.

Ne pravi sve kao dashboard.

======================================================================
38. FINALNI DESIGN PASS DOLAZI POSLE STABILNIH TOKOVA
======================================================================

Prvo završi motor.

Zatim screen-by-screen polish.

Za svaki ekran:

- purpose;
- hierarchy;
- navigation;
- CTA;
- states;
- components;
- copy;
- spacing;
- typography;
- touch target;
- accessibility;
- animation;
- empty/loading/error;
- keyboard;
- safe-area.

Ne menjaj backend semantics zbog lepšeg mockup-a.

======================================================================
39. FIGMA
======================================================================

Ako Codex environment ima odgovarajući Figma pristup/plugin:

možeš ga koristiti za:
- inspect;
- design system;
- screen variants;
- token alignment;
- handoff.

Ali Figma nije business authority.

Backend/product canon pobjeđuje design mock.

Ako design nije dovoljno dobar:
predloži i implementiraj world-class poboljšanje BEZ menjanja product semantics.

======================================================================
40. ANDROID — FIZIČKI PROOF
======================================================================

Pokušaj da sačuvaš trenutno jak princip:

BUILD
→ EMULATOR
→ ACTUAL INPUT
→ REAL AUTH
→ REAL UI
→ REAL RPC
→ BACKEND POSTFLIGHT
→ SCREENSHOT/UI EVIDENCE.

Ako environment podržava:

- Android SDK;
- emulator;
- ADB;
- APK install;
- screenshot;
- UI hierarchy;

koristi ih.

Ne oslanjaj se samo na screenshot test.

Ako Codex cloud environment NE može da pokrene emulator:

NE BLOKIRAJ KODIRANJE.

Uradi:
- implementation;
- tests;
- build;
- PR;
- jasno obeleži physical proof pending.

Work režim može posle nezavisno da uradi physical acceptance.

======================================================================
41. IOS
======================================================================

Pre Store readiness:

potreban je odgovarajući iOS validation.

Android success != iOS success.

Ali ne blokiraj svaki backend PR zbog iOS toolchain-a.

======================================================================
42. REAL AUTH PROOF
======================================================================

Za real marketplace tok koristi disposable stvarne Auth korisnike:

Requester
Worker
Outsider

po potrebi.

Ne koristi service role da imitira User Action.

Admin može:

- seed;
- inspect;
- teardown.

Business action mora ići kroz korisničku authority putanju.

======================================================================
43. TEST DATA
======================================================================

Disposable proof podaci moraju biti jasno izolovani.

Proof može seed-ovati:

- user;
- profile precondition;
- Need ako testira downstream flow.

Ali ne sme seed-ovati:

Selection

ako navodno dokazuje Selection UI.

Ne sme seed-ovati:

Agreement

ako navodno dokazuje real Selection → Agreement.

======================================================================
44. FAILURE / RACE / RETRY
======================================================================

Za critical write RPC pitaj:

- šta ako user klikne dva puta;
- šta ako request retry-uje;
- šta ako odgovor servera ne stigne;
- šta ako dva actor-a izvrše konkurentno;
- šta ako emitter padne;
- šta ako notification dispatcher padne;
- šta ako token ode drugom account-u;
- šta ako Agreement version ode dalje;
- šta ako AI vrati garbage;
- šta ako storage upload ostane orphan;
- šta ako webhook stigne više puta.

Dokazuj invariant.

======================================================================
45. NE SLABI TEST DA BI POSTAO ZELEN
======================================================================

Ako test padne:

prvo utvrdi:

CODE BUG
ili
TEST ASSUMPTION BUG.

Ako je code bug:
popravi kod.

Ako je test assumption bug:
ispravi test tako da proverava ISTU ili JAČU osobinu.

Nikad:
remove assertion
samo da workflow prođe.

======================================================================
46. PERFORMANCE
======================================================================

Proveravaj usput:

- list virtualization;
- bounded pagination;
- correct indexes;
- N+1;
- giant RPC payload;
- image sizes;
- unnecessary rerenders;
- duplicate listeners;
- unclean subscriptions;
- heavy startup;
- synchronous work;
- map marker volume.

======================================================================
47. ACCESSIBILITY
======================================================================

Finalni app mora imati makar ozbiljnu osnovu:

- accessibility labels;
- touch target;
- contrast;
- font scaling;
- focus order gde je bitno;
- safe areas;
- keyboard avoidance;
- screen-reader-friendly actionable controls.

======================================================================
48. OBSERVABILITY
======================================================================

Production-ready podrazumeva ability to debug.

Implementiraj razumno:

- server error logging;
- correlation;
- Edge failure visibility;
- push dispatch visibility;
- provider tickets/receipts;
- AI failures;
- payment lifecycle kad postoji;
- release/build ID.

Ne loguj:
- secrets;
- full private chat;
- sensitive identity podatke
bez opravdanja.

======================================================================
49. CURRENT HISTORICAL GAPS — REVALIDATE, NE PRETPOSTAVLJAJ
======================================================================

Istorijski su postojali:

- incomplete notification event coverage;
- missing push dispatcher;
- missing real push delivery;
- AI Edge 502;
- no transcribe;
- no location resolver;
- HITNO disabled;
- identity not admitted;
- no authoritative calendar;
- no reviews;
- no entitlement ledger;
- public profile projection gap;
- account close gap;
- storage gaps;
- MULTI_STOP incomplete;
- map placeholder;
- incomplete trust/recovery;
- final UI polish gap.

Za svaki proveri:

CLOSED?
PARTIAL?
SOURCE ONLY?
CANONICAL?
LIVE?
STILL OPEN?

Ne radi ponovo ono što je u međuvremenu rešeno.

======================================================================
50. DONOR CODE
======================================================================

Historical donor je capability reference.

NIJE source of truth.

Ako donor ima:
- reviews;
- evidence;
- calendar;
- availability;
- shortlist;
- moderation;
- AI provenance;
- recovery;
- location;
- transcribe;
- push,

proceni narrow port.

Ne kopiraj donor wholesale.

Ne vraćaj superseded:
- alpha_*;
- legacy access grant model;
- obsolete team snapshots;
- stari business semantics.

======================================================================
51. MULTI_STOP
======================================================================

Ako je MULTI_STOP i dalje relevantan i nezavršen:

prvo zatvori core single Need motor.

Zatim implementiraj parts/plans bez razbijanja core semantike.

Ne dozvoli ovoj advanced funkciji da blokira launch-critical tokove ako nije potrebna za launch.

======================================================================
52. PREPORUČENI EXECUTION ORDER
======================================================================

Dinamički prilagodi prema stvarnom trenutnom stanju.

Default:

PHASE 1
Finish current in-flight PR/cursor.

PHASE 2
Complete notification/inbox/push vertical.

PHASE 3
Complete Chat + Dogovor lifecycle.

PHASE 4
Completion + Reviews + Reputation.

PHASE 5
Availability + Calendar + Team capacity.

PHASE 6
Profiles + Trust + Identity + Public projection.

PHASE 7
Storage + Map + Location.

PHASE 8
Account/Data rights + Safety/Recovery.

PHASE 9
AI productionization and controlled activation.

PHASE 10
HITNO productionization and controlled activation.

PHASE 11
Monetization/payment infrastructure with effective 0 RSD.

PHASE 12
Full visual/UX refinement.

PHASE 13
E2E/security/performance.

PHASE 14
Android/iOS/release/store closure.

Ako dependencies nalažu drugačiji redosled:
prilagodi ga.

======================================================================
53. PARALELNI RAD
======================================================================

Paralelizuj samo nezavisne stvari.

Dobro:
- backend RPC;
- mobile component;
- contract test;
ako imaju stabilan dogovoren contract.

Loše:
dva različita agenta menjaju istu RPC authority semantiku sa dva zastarela base-a.

Pre merge-a uvek fresh canonical reconciliation.

======================================================================
54. AKO SESIJA/STREAM PREKINE
======================================================================

Ako Codex session, output stream ili UI prikaz pukne:

NE PRETPOSTAVLJAJ DA JE RAD IZGUBLJEN.

Pre nastavka:

- fetch Git;
- proveri current HEAD;
- proveri branch;
- proveri open PR;
- proveri Actions;
- proveri da li su commit-i već push-ovani.

Nastavi od fizičkog stanja.

Ne ponavljaj automatski ceo zadatak.

======================================================================
55. GIT DISCIPLINA
======================================================================

Za veće jedinice:

fresh canonical
→ branch
→ code
→ tests
→ proof
→ PR
→ gates
→ merge
→ canonical verification.

Ne pravi monstruozni PR od 80 nepovezanih feature-a ako se mogu bezbedno razdvojiti.

Ali nemoj ni fragmentirati jednu koherentnu funkciju u 25 besmislenih PR-ova.

======================================================================
56. PR MORA DA BUDE ISTINIT
======================================================================

PR body treba kratko i precizno da kaže:

SCOPE
IMPLEMENTED
PROOF
SECURITY
LIVE CHANGED: YES/NO
LIMITS
NEXT.

Ne tvrdi:
“Push complete”
ako je samo token registry.

Ne tvrdi:
“Store ready”
ako nema release proof-a.

======================================================================
57. LIVE / SOURCE STATUSI MORAJU BITI ODVOJENI
======================================================================

Koristi jasne statuse:

IMPLEMENTED
PROVEN
CANONICAL
PROMOTION READY
LIVE
PHYSICALLY PROVEN
STORE READY.

Nisu sinonimi.

Source candidate koji nije live mora biti označen NOT LIVE.

======================================================================
58. PRODUCTION PROMOTION NE SME OSTATI VEČNO ODLOŽEN
======================================================================

Dokazani source candidates nisu krajnji cilj.

Ako je bezbedno i dozvoljeno:

pakuj ih u proper forward-only production migration.

Zatim:

fresh live preflight
→ apply
→ exact postflight
→ smoke test
→ monitor.

Nemoj mesecima graditi source-only backend koji nikada ne postane proizvod.

======================================================================
59. NE DRŽI SVE FEATURE-E DORMANT
======================================================================

Fail-closed gates su dobri dok feature nije spreman.

Ali cilj ovog mastera je da feature:

DOVRŠIŠ
→ DOKAŽEŠ
→ KONTROLISANO AKTIVIRAŠ.

Posebno:

AI
HITNO.

Nemoj ih ostaviti OFF samo zato što je to sigurnije nego završiti posao.

======================================================================
60. ISTOVREMENO NE AKTIVIRAJ NEBEZBEDNO
======================================================================

Controlled activation.

Prvo:
implementation.

Onda:
proof.

Onda:
config.

Onda:
activation.

Onda:
postflight.

======================================================================
61. ZERO-RSD BUSINESS DECISION
======================================================================

Dok drugačije nije eksplicitno odlučeno:

effective platform charge = 0 RSD.

To nije isto kao:

“monetization code should not exist.”

Naprotiv:

monetization code treba da bude production-ready.

Business config treba da određuje 0.

======================================================================
62. CONFIGURATION
======================================================================

Centralizuj promenljive business vrednosti.

Ne rasipaj po app-u:

- price;
- urgent fee;
- category lists;
- rollout flag;
- transport policy;
- AI limits.

Use server/config authority.

Sa audit/versioning gde je potrebno.

======================================================================
63. ERROR UX
======================================================================

Za svaki major screen:

neka postoji realno ponašanje za:

- loading;
- empty;
- network error;
- auth error;
- permission denial;
- server unavailable;
- stale version;
- retry;
- partial content.

„Vrti spinner zauvek“ nije final UX.

======================================================================
64. UX COPY
======================================================================

Primarni korisnički jezik:

srpski.

Ton:

Vi / Vam

gde je to deo current brand/canon-a.

Ne ostavljaj development English copy na finalnim ekranima osim gde je product namerno bilingual.

======================================================================
65. FINAL SCREEN INVENTORY
======================================================================

Fizički rekonstruiši current screen inventory.

Zatim pre release proveri svaku surface iz product canona.

Ne pretpostavljaj da je screen završen zato što route postoji.

Za svaki proveri:

- route;
- data authority;
- user action;
- states;
- visual quality;
- accessibility;
- proof.

======================================================================
66. FINAL E2E — NARUČILAC
======================================================================

Najmanje dokazati:

Auth
→ Profile
→ Create Need
→ Publish
→ Need visible
→ candidates
→ Selection
→ Agreement
→ Chat
→ Change Agreement
→ execution/completion
→ review
→ notification
→ account lifecycle.

======================================================================
67. FINAL E2E — USKOČER
======================================================================

Najmanje dokazati:

Auth
→ Worker onboarding
→ profile/capabilities
→ availability
→ opportunity discovery
→ Application
→ selection notification
→ Agreement
→ Chat
→ Agreement change
→ completion
→ review
→ profile reputation
→ account lifecycle.

======================================================================
68. FINAL E2E — AI
======================================================================

Najmanje:

input
→ server model call
→ validated structured data
→ preview
→ human confirmation
→ normal business mutation.

Test:

- timeout;
- malformed JSON;
- moderation;
- cancellation;
- no secret exposure.

======================================================================
69. FINAL E2E — HITNO
======================================================================

Najmanje:

eligible Need
→ HITNO
→ correct discovery/dispatch
→ high priority event
→ Worker awareness
→ application/selection
→ Agreement.

Plus:

ineligible category
→ denied safely.

======================================================================
70. FINAL E2E — PUSH
======================================================================

Na fizičkom/nativnom okruženju gde je moguće:

permission
→ token
→ registry
→ preference
→ event
→ dispatch
→ provider
→ device receives
→ tap
→ correct authenticated route.

Proveri:

foreground
background
killed state
logout
wrong account
stale token.

======================================================================
71. FINAL E2E — 0 RSD
======================================================================

Dokaži da:

monetization infrastructure postoji,
ali current effective platform charge ostaje 0 RSD.

Nema slučajnog zaduženja.

Nema fake payment success-a.

Config se može centralno promeniti u budućnosti.

======================================================================
72. SECURITY RELEASE PASS
======================================================================

Pre release:

- dependency audit;
- CodeQL/static checks;
- secrets scan;
- RLS inventory;
- RPC grants;
- SECURITY DEFINER review;
- search_path review;
- Edge Auth;
- storage policies;
- account switching;
- IDOR;
- replay;
- concurrency;
- notification privacy;
- AI secrets;
- payment webhook security;
- logs;
- data deletion.

======================================================================
73. RELEASE PASS
======================================================================

Pre STORE READY:

- Android release build;
- iOS release build;
- environment config;
- signing;
- bundle/package IDs;
- icon;
- splash;
- permissions;
- notification config;
- deep links;
- privacy links;
- legal links;
- account deletion;
- production endpoints;
- source maps/crash strategy gde postoji;
- version/build;
- release notes;
- rollback plan.

======================================================================
74. NE PROGLAŠAVAJ CEO PROIZVOD GOTOVIM PRE VREMENA
======================================================================

DONE je kada su launch-critical tokovi:

IMPLEMENTED
+
PROVEN
+
LIVE
+
USABLE
+
SECURE
+
RELEASE VALIDATED.

Ne kada checklist izgleda lepo.

======================================================================
75. ALI NEMOJ NI VEČNO ODLAGATI CLOSURE
======================================================================

Perfect nije cilj.

Production quality jeste.

Razlikuj:

P0 launch blocker
P1 launch important
P2 post-launch enhancement.

Ne blokiraj Store release zbog kozmetičke ideje koja može posle.

Ali security/data-loss/core-flow problem jeste blocker.

======================================================================
76. PRODUCT DECISIONS
======================================================================

Ako naiđeš na stvarnu nerešenu product odluku:

nemoj sam proizvoljno zaključati veliki poslovni model.

Napravi minimalan DECISION REQUIRED zapis:

QUESTION
OPTION A
OPTION B
RECOMMENDED DEFAULT
IMPACT.

Onda nastavi sve nezavisne poslove.

Ne staj ceo projekat.

======================================================================
77. KADA NE TREBA PITATI
======================================================================

Ne pitaj za:

- očigledan bug;
- missing null guard;
- security hardening koji ne menja semantics;
- standard error state;
- accessibility label;
- deterministic pagination;
- test coverage;
- stale account guard;
- cleanup listenera;
- server-derived ownership;
- secrets isolation.

Samo uradi.

======================================================================
78. AUTONOMIJA
======================================================================

Očekuje se da sam:

- čitaš kod;
- razumeš;
- tražiš root cause;
- implementiraš;
- pokrećeš komande;
- debaguješ;
- vraćaš se;
- popravljaš;
- praviš PR;
- gledaš CI;
- rešavaš CI;
- nastavljaš.

Nemoj korisniku vraćati zadatak zato što prva komanda nije uspela.

Probaj alternativni bezbedan put.

======================================================================
79. NIKADA NE ZAOBILAZI SIGURNOSNU BLOKADU
======================================================================

Autonomija ne znači:

- disable RLS;
- service-role production business calls;
- force push canonical;
- migration rewrite;
- hardcoded secret;
- silent data deletion;
- prod experimentation.

Ako safety gate zaista sprečava akciju:

stani samo na toj akciji,
objasni blocker,
nastavi nezavisne stvari.

======================================================================
80. CURRENT PRODUCT PRIORITY
======================================================================

Glavni cilj od sada nije još jedan audit.

Glavni cilj je da svake naredne sesije postoji sve više stvarne aplikacije:

- više stvarnih tokova;
- više live authority;
- više stvarnih ekrana;
- više realnog Android ponašanja;
- manje placeholder-a;
- manje NOT LIVE candidate-a;
- manje dormant feature-a;
- manje unfinished gap-ova.

======================================================================
81. NE DOZVOLI DA DIZAJN ČEKA BAŠ KRAJ
======================================================================

Dok implementiraš novi screen:

odmah ga napravi pristojno.

Ali globalni world-class polish radi nakon stabilizacije major tokova.

Ne troši tri dana na savršen border radius ekrana čiji backend ne postoji.

======================================================================
82. DESIGN SYSTEM
======================================================================

Ako još nije dovoljno centralizovan:

postepeno konsoliduj:

- spacing;
- radii;
- typography;
- colors;
- shadows;
- buttons;
- inputs;
- cards;
- badges;
- sheets;
- skeletons;
- state components.

Bez big-bang UI rewrite-a.

======================================================================
83. NO DEAD CODE
======================================================================

Kada feature postane canonical:

ukloni zastarele production fallback putanje ako su dokazano superseded.

Ali ne briši historical proof/source bez razloga.

Razlikuj:

production dead code
vs
historical evidence.

======================================================================
84. DEPENDENCY HYGIENE
======================================================================

Ne dodaj package za sitnicu koju možemo rešiti postojećim stack-om.

Pre dodavanja dependency-ja:

- postoji li već;
- maintenance;
- security;
- Expo/RN compatibility;
- bundle impact.

======================================================================
85. BACKEND QUERY HYGIENE
======================================================================

Za client-facing RPC:

- bounded rows;
- stable sort;
- keyset gde je potrebno;
- index;
- minimal projection;
- no sensitive internal payload;
- typed contract.

======================================================================
86. PRIVACY BY DEFAULT
======================================================================

Ne otkrivaj:

- exact home location;
- identity docs;
- push token;
- private Agreement terms;
- full raw AI prompt;
- internal moderation;
- private email/phone;

izvan surface-a gde je product stvarno zahteva.

======================================================================
87. DOCUMENTATION — LIVING, NE ARHEOLOGIJA
======================================================================

Čувај један јасан current status owner.

Не прави 12 нових „FINAL_FINAL_STATUS_v7“ докумената.

Update current living source.

Historical evidence задржи.

======================================================================
88. MACHINE-READABLE STATUS
======================================================================

Ако repo већ има machine-readable ledger:

ажурирај га минимално и тачно.

Не мењај schema статус фајла без потребе.

======================================================================
89. AFTER EACH MAJOR MERGE
======================================================================

Провери:

- canonical HEAD;
- merge contents;
- canonical CI;
- security;
- Control0 ако постоји;
- migration integrity;
- next cursor.

Онда настави.

======================================================================
90. WHEN LIVE PROMOTION HAPPENS
======================================================================

Record:

- exact source SHA;
- migration;
- previous live state;
- apply result;
- postflight;
- runtime smoke;
- rollback/recovery notes.

Не прави неповезан „manual SQL“ без provenance-а.

======================================================================
91. NE RAZDVAJAJ BACKEND I MOBILE U BESKRAJ
======================================================================

Backend unit није стварно user-value complete ако mobile никада није повезан.

Након стабилног server foundation-а:

повежи client што пре.

Vertical slice > година backend-only candidates.

======================================================================
92. REAL PRODUCT, NE DEMO
======================================================================

Final mobile не сме зависити од:

- hardcoded fixture;
- emulator-only secret;
- debug menu;
- test bypass;
- localhost fallback;
- fake success;
- seeded production records.

Proof tooling не сме бити production dependency.

======================================================================
93. STAGING / DISPOSABLE / PROD
======================================================================

Јасно разликуј:

DISPOSABLE PROOF
STAGING ако постоји
PRODUCTION.

Никада не тврдити да disposable proof значи live production.

======================================================================
94. FINAL BLOCKER LIST
======================================================================

Како се приближава release-у:

одржавај кратак P0 blocker list.

Сваки blocker:

- owner;
- concrete failure;
- reproduction;
- next action.

Не користи vague:
“Need more testing”.

======================================================================
95. FINAL PHYSICAL ACCEPTANCE
======================================================================

Пре release-а изведи што је могуће више стварних mobile journey-а.

Минимум Android:

Requester full journey.
Worker full journey.
Notifications.
Chat.
Agreement.
Review.
AI.
HITNO ако active.
Account.
Error/retry.

Где је могуће и hardware phone.

======================================================================
96. CROSS-ACCOUNT ISOLATION
======================================================================

Обавезно тестирај да Account A data не преживљава у Account B UI state-у после logout/login.

Посебно:

Inbox
Chat
Profile
Dogovor
Push token
AI drafts.

======================================================================
97. RECOVERY
======================================================================

User не сме остати трајно заглављен после:

- network failure;
- partial upload;
- expired session;
- stale Agreement;
- provider error;
- AI error;
- failed notification;
- app restart.

Implement retry/recovery где је потребно.

======================================================================
98. NE ULEPŠAVAJ IZVEŠTAJ
======================================================================

Ако нешто није готово:

напиши OPEN.

Ако није live:

NOT LIVE.

Ако emulator није radio:

NOT PHYSICALLY PROVEN.

Истина је важнија од лепог процента.

======================================================================
99. KRAJNJI NAČIN RADA
======================================================================

Od ovog trenutka ponašaj se kao:

Principal Software Engineer
+
Staff Mobile Engineer
+
Supabase/Postgres Engineer
+
Security Engineer
+
QA/Release Engineer
+
Product-minded implementer.

Ne ponašaj se primarno kao konsultant.

Tvoj default glagol nije:

„predložio bih“.

Tvoj default glagol je:

„implementirao sam“
„testirao sam“
„popravio sam“
„dokazao sam“
„merge-ovao sam“
„nastavljam na…“

======================================================================
100. START NOW
======================================================================

SADA URADI SLEDEĆE:

1. fizički otvori Uskoci1/USKOCI-CLEAN;
2. fetch;
3. utvrdi current canonical HEAD;
4. pronađi šta se desilo sa #45 i sve posle njega;
5. pročitaj poslednji living status/handoff;
6. proveri relevantan Supabase pristup;
7. napravi jednu preciznu current-state reconstruction;
8. utvrdi dependency graph preostalih launch-critical jedinica;
9. izaberi TAČAN PRVI NEZAVRŠENI CURSOR;
10. ODMAH PREĐI U IMPLEMENTACIJU.

Ne završavaj odgovor nakon audita ako možeš da kodiraš.

Ne traži od korisnika dozvolu za svaki commit.

Ne vraćaj projekat unazad.

Ne restartuj.

Ne rewrite-uj.

Ne ponavljaj dokazano.

Ne blokiraj nezavisne poslove.

Kodiraj stvarni proizvod.

Pokreći stvarne testove.

Koristi stvarne Auth tokove gde je potrebno.

Koristi Android fizički/emulator proof gde environment dozvoljava.

Promoviši dokazani backend u production kada safety/promotion gate dozvoljava.

Aktiviraj AI i HITNO tek nakon stvarnog zatvaranja njihovih sigurnosnih uslova.

Monetization infrastrukturu dovrši, ali current effective platform charge ostavi 0 RSD dok centralna konfiguracija ne bude promenjena.

Nakon svake zatvorene jedinice:

MERGE
→ VERIFY
→ CONTINUE.

CILJ SESIJE NIJE JOŠ JEDAN IZVEŠTAJ.

CILJ JE DA USKOČI POSLE SVAKOG CIKLUSA BUDE STVARNO BLIŽE POTPUNO ZAVRŠENOJ PRODUCTION APLIKACIJI.

POČNI OD STVARNOG TRENUTNOG STANJA.