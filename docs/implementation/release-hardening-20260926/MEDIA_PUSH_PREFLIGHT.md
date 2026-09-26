# USKOČI release-hardening preflight — media i push

Checked: 2026-09-26T10:53:54Z  
Repository: `Uskoci1/USKOCI-CLEAN`  
Branch: `work/uskoci-ui-unification-20260924`  
Source/control base: `e996cbc7fbc4a74116b5ffacb210a4aad9e34450`  
Canonical DEV: `leqcwgzvjsxugfgzdmth`

Ovaj paket je samo analiza, dokaz i kontrolna evidencija. Nije menjan DEV, Edge, baza, podaci, provider podešavanja niti telefon. Nije poslato nijedno push obaveštenje i nijedan ključ nije čitan niti prikazan.

## 1. Početno vezivanje

- GitHub grana je neposredno pre ovog paketa i dalje bila na `e996cbc7fbc4a74116b5ffacb210a4aad9e34450`.
- DEV je ACTIVE_HEALTHY.
- Sveže: 202 migracije; poslednja `20260924202023`.
- `uskoci-media` je ACTIVE v12, deploy sha256 `abc12b7e8e2f843b155850ab848b64586b635efd8e10c6a403032e61d5826011`.
- `uskoci-push-transport` je ACTIVE v14.

## 2. MEDIA_COMMAND_CANCELLED — tačno stanje

GitHub entrypoint `supabase/functions/uskoci-media/index.ts` ima blob `544a5d2697be05302f115a65b088ec1e1ed39695`.

Byte/line poređenje sa objavljenom v12 funkcijom dalo je:
- shared `mediaImageSanitizer.mjs`: identičan;
- entrypoint: tačno **jedna** različita linija;
- GitHub safe-code lista sadrži `MEDIA_COMMAND_CANCELLED`;
- objavljena v12 safe-code lista ga nema.

Nema drugog skrivenog source drifta u tim dvema Edge datotekama.

### Dokaz testa koji već postoji

`src/data/__tests__/media-client.test.ts` ima eksplicitan PKG-046 regression: FunctionsHttpError sa `MEDIA_COMMAND_CANCELLED` mora da postane:
`MEDIA_COMMAND_CANCELLED / Ovo slanje je otkazano. Fotografija nije prihvaćena.`
bez novog RPC/upload pokušaja.

Isti media blob `544a5d26…` postoji na source-u `03cc3e48`, `a69a26c6` i `e996cbc7`. R19 full Jest zapis za source sa tim blobom je exit 0; aktuelni R19 zbir je 321 suites / 6,326 tests. Postojeći PKG-046 workflow dodatno ima disposable proof, ali njegov push trigger je vezan za staru integration granu i nije ponovo dispatch-ovan ovim paketom.

**Status:** source fix = NAPISAN I TESTIRAN; Edge v12 = NIJE PRIMENJEN.  
Sledeća serverska radnja je samo deploy tačnog GitHub Edge paketa, ali tek posle vlasnikovog `primeni`.

## 3. Push — ceo put i mesto prekida

### Događaji / delivery red

Sveže DEV stanje:
- PUSH CREATED: **10**;
- od njih `push_started_at is null`: **10**;
- push attempts: **0**;
- push readiness rows: **0**;
- PUSH SUPPRESSED iz ranijih događaja: **29**, razlog `PUSH_OFF`.

Deset nepotrošenih requester događaja:
- RESPONSE_RECEIVED: 4
- REVIEW_RECEIVED: 3
- MESSAGE_RECEIVED: 2
- COMPLETION_REQUIRED: 1

Najstariji je 23.09, najnoviji 25.09. Devet od deset nema expiry; jedan ističe 27.09. Zato se backlog ne sme pretpostaviti kao samoočišćen.

### Podešavanja / uređaj

Za R18 testni zadatak:
- requester ima sačuvano notification podešavanje i `push_enabled=true`;
- requester aktivni uređaji: **0**;
- requester neaktivni Android uređaji: **1**;
- worker nema sačuvan preference red, pa server default ostaje push off;
- worker aktivni uređaji: **0**.

Dakle nema nijednog aktivnog session-bound uređaja na koji bi transport smeo da šalje.

### Telefon / build

R19 phone APK je napravljen workflow-om `build-android-dev-apk.yml`, koji pre prebuild-a menja Android package u `rs.uskoci.dev`.

`app.config.js` dodaje preview Firebase `googleServicesFile` samo za `rs.uskoci.preview`; za ostale proof/dev pakete ga briše. `nativePushDevice.ts` eksplicitno vraća `UNCONFIGURED` kada Expo/Firebase provider ne može da izda token.

Zato je trenutni R19 APK validan za R19 UI/native dokaze, ali **nije push proof build**.

### Scheduler / Edge transport

Live `private.edge_worker_tick_v5` za PUSH:
- vidi upravo CREATED/unstarted redove;
- šalje `{"action":"tick"}` ka `uskoci-push-transport`.

Function logs pokazuju HTTP 200 poziv `uskoci-push-transport` praktično svakog minuta u pregledanom 24h prozoru.

Objavljeni v14 Edge kod ima:
`EXPO_PUSH_TRANSPORT_ENABLED === 'true'`.
Kada to nije true, `action=tick` odmah vraća `{kind:'DISABLED'}` sa HTTP 200, pre claim-a, provider IO i readiness upisa.

Da je SEND claim zaista radio nad ovih 10 redova, live `rpc_claim_push_transport` bi pri 0 aktivnih uređaja postavio te redove na SUPPRESSED / NO_ACTIVE_DEVICE. To se nije desilo: svi su i dalje CREATED/unstarted, attempts=0, readiness=0.

**Zaključak:** transport kill-switch je efektivno isključen prema tačnom live kodu i njegovim posmatranim efektima. Sama env/tajna vrednost nije čitana niti prikazana.

## 4. Dva nezavisna push bloka

1. **Server transport nije aktivan.**
2. **Trenutni R19 DEV APK nije konfigurisan kao push-capable Android build.**

Samo popravljanje jednog ne zatvara drugi.

Posebno: uključivanje transporta *posle* registracije vlasnikovog uređaja sada nije bezbedan test, jer 9 starih delivery redova nema expiry i mogli bi da budu poslati.

## 5. Ograničeni stvarni push scenario — pripremljen, NIJE izvršen

Ovo je jedini prihvatljiv redosled za owner test:

1. Transport ostaje off. Potvrditi da je broj aktivnih push uređaja na DEV-u 0.
2. Uz posebno `primeni`, bez aktivnog uređaja dozvoliti tačno jedan transport tick samo da postojeći unstarted backlog završi kao server-side suppressed/no-device. Očekivanje: provider attempts ostaju 0. Ako nije tako — stop.
3. Transport ponovo off. Proveriti da nema starog sendable backlog-a.
4. Napraviti namenski Android push-proof build čiji applicationId ima odgovarajući Firebase client. Ne koristiti `rs.uskoci.dev` kao dokaz.
5. Na vlasnikovom telefonu eksplicitno uključiti obaveštenja. Dokazati read-back: tačno jedan aktivan, session-bound Android device i odgovarajuća requester preference.
6. Dok je transport i dalje off, napraviti **tačno jedan** odobren novi događaj za vlasnikov nalog (najjednostavnije jedna test poruka iz postojećeg test Dogovora sa drugim odobrenim test nalogom).
7. Potvrditi da je nastao tačno jedan novi PUSH delivery za taj događaj.
8. Uz `primeni` otvoriti vrlo kratak transport prozor za taj jedan delivery; proveriti da nastane tačno jedan attempt, Expo ticket/receipt, bez drugih send attempt-a.
9. Na telefonu dokazati lock-screen prikaz, warm/cold tap, trenutni nalog i otvaranje Inbox-a/tačnog odredišta.
10. Ponovo isključiti transport i po potrebi opozvati proof device. Sačuvati source/build/device/provider receipt vezivanje.

Nema masovnog slanja, nema proizvedenih dodatnih događaja i nema aktiviranja bez preflight count-a.

## 6. Šta nije zatvoreno ovim paketom

- RC-02 media concurrency/lock-order proof.
- Interrupted/unknown media recovery u svim kombinacijama.
- Production Android push konfiguracija.
- iOS/APNs.
- Real push delivery — ovaj paket ga namerno nije izvršio.
- Ostali NEXT paketi: eligibility feedback E01/E02, deep-return performance, safety target name, avatar recovery, application facts, server paging/aggregates/chat/closure proposals.

## 7. Status paketa

- GitHub source: provereno.
- DEV: sveže read-only provereno.
- Media candidate: spreman za `primeni`, nije deploy-ovan.
- Push root cause: potvrđen do granice tajne/env vrednosti; env nije čitan.
- Push real test: bezbedan scenario pripremljen, nije izvršen.
- DEV/Edge mutations: **0**.
- Push sends: **0**.
