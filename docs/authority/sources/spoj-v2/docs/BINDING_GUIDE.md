# Veza prikaza i stvarnog motora

Read-only HEAD: `4bcc5dbf1128a4d081824797350b83a00127c21f`. Datum: 10.09.2026. Live Supabase nije ponovo upitan ovim krugom; nema nove tvrdnje o njegovoj spremnosti. `contracts/BINDING_MATRIX_66.json` razlikuje pročitano telo koda od samo pronađene putanje.

## Pročitane konkretne granice
`src/data/index.ts` eksplicitno sastavlja production source i zabranjuje tihi pad na lažni izvor kada Supabase nije konfigurisan. V2 AI je zaseban `aiNeedV2Izvor`.

`src/data/aiNeedV2Production.ts` poseduje openConversation/loadConversation/sendMessage/confirmFact/correctFact/saveDraft/openEditConversation/confirmEdit. `sendMessage` poziva uskoci-ai-interview, proverava V2 schema; review čita stvarne facts. SaveDraft potvrđuje rezultat. Edit nosi očekivanu reviziju i request ID, odbija promene nakon prvog Dogovora. Postojanje tog koda nije dokaz aktivnog provider-a ili živog ALLOW-a.

`src/data/applicationClientService.ts` poseduje mojePrijave (rpc_list_my_applications) i povuciPrijavu (rpc_withdraw_response, revizija/verzija/request ID). Ne pripisivati mu submission samo zato što se zove application service.

`src/data/productionAuthorityOverrides.ts` još sadrži legacy objaviPotrebu → rpc_ai_publish_need. Pročitani index izričito kaže da novi R02→R07 ide odvojenim V2 putem. Ovo je zamka pri naivnom mapiranju HTML dugmeta na prvo ime koje deluje odgovarajuće.

## Radni red za svaku akciju
Pronađi njen postojeći typed command u ports/contracts i stvarnog owner-a u kompozicionom index-u/hook-u. Read pre rendera; dostupnost prema server projection-u; korisnička potvrda tek nakon pregleda; stabilan request ID; pending bez duplog upisa; success tek po validiranom receipt-u; refetch authority projection-a; stale zahteva novi pregled; unknown proverava isti pokušaj. Ne pisati direktno u tabele da se zaobiđe RPC.

## Mapa grupa
### auth
Površine: entry, auth, signup, recovery, permissions, auth-confirm, new-password, recovery-expired.

Existing auth/entry/splash/recovery hooks and source availability.

Nivo izvora: **PATH_LISTED_READ_BEFORE_BINDING**.

Tragovi: `src/data/authClientService.ts`, `src/data/entryIntentClientService.ts`, `src/data/passwordRecoveryClientService.ts`, `src/ui/entry`, `src/ui/referenceEntry`

### need-v2
Površine: ai, review, task-fields, task-time.

aiNeedV2Izvor: openConversation / loadConversation / sendMessage / confirmFact / correctFact / saveDraft / openEditConversation / confirmEdit.

Nivo izvora: **CONTENT_READ_AT_SNAPSHOT**.

Tragovi: `src/data/index.ts`, `src/data/aiNeedV2Production.ts`

### need-lifecycle
Površine: tasks, task.

Existing Need read/lifecycle service and current publication authority; do not use legacy AI publish for V2.

Nivo izvora: **PATH_LISTED_READ_BEFORE_BINDING**.

Tragovi: `src/data/needClientService.ts`, `src/data/needLifecycleClientService.ts`

### market
Površine: discovery, map, search, filters, opportunity.

Public Need projection + public approximate geography, provider remains explicit integration gap.

Nivo izvora: **PATH_LISTED_READ_BEFORE_BINDING**.

Tragovi: `src/data/needClientService.ts`, `src/data/locationClientService.ts`, `src/data/locationResolver.ts`

### application
Površine: apply, application-time, applications, application, candidates, candidate, compare, payment.

Existing Izvor typed application/selection command; applicationClientService owns list/withdraw, not automatically submission.

Nivo izvora: **MIXED: INDEX_AND_LIST_WITHDRAW_CONTENT_READ; SUBMIT_SELECTION_RESOLVE**.

Tragovi: `src/data/index.ts`, `src/data/ports.ts`, `src/data/applicationClientService.ts`, `src/data/candidateClientService.ts`

### agreement
Površine: agreements, agreement, chat, changes, proposal, problem, cancel, complete.

Existing Agreement service + durable outbox/receipt owner; accepted snapshot not mutable Need.

Nivo izvora: **PATH_LISTED_READ_BEFORE_BINDING**.

Tragovi: `src/data/agreementClientService.ts`, `src/data/agreementMessageClientService.ts`, `src/data/agreementOutbox.ts`, `src/ui/AgreementChat.tsx`

### profile
Površine: profile, personal, worker, worker-ai, skills, vehicle, public.

Own/public/worker profile owners; worker AI provider is not demonstrated by HTML.

Nivo izvora: **INDEX_CONTENT_READ_OTHER_PATHS_LISTED**.

Tragovi: `src/data/ownProfileClientService.ts`, `src/data/publicProfileClientService.ts`, `src/data/index.ts`

### calendar
Površine: calendar, availability, exception.

Resolve existing availability/calendar authority from newest repo; do not build a parallel calendar.

Nivo izvora: **PATH_LISTED_ONLY_NOT_CALENDAR_EXECUTION_PROOF**.

Tragovi: `src/data/authAvailabilityClientService.ts`, `src/data/calendarErrors.ts`

### inbox
Površine: inbox, notifications.

Inbox event projections + preferences; push transport separate.

Nivo izvora: **PATH_LISTED_READ_BEFORE_BINDING**.

Tragovi: `src/data/inboxClientService.ts`, `src/data/notificationPreferencesClientService.ts`

### account
Površine: settings, privacy, export, closure, account, legal.

Current legal/export/closure contracts and server status, no fabricated processing/archive.

Nivo izvora: **PATH_LISTED_READ_BEFORE_BINDING**.

Tragovi: `src/data/dataExportClientService.ts`, `src/data/legalClientService.ts`, `src/data/retentionPolicyClientService.ts`

### pending
Površine: reviews, review-write, verify, support, blocked, qa, urgent, photo, voice, support-cases, support-case.

Capability / business policy / provider read-first; explicit gate where no supported authority.

Nivo izvora: **DO_NOT_INFER_ENGINE_FROM_HTML; QA_PATH_LISTED**.

Tragovi: `src/data/preselectionQaClientService.ts`

### studio
Površine: brand, components.

Reference/studio surfaces; not automatically production navigation.

Nivo izvora: **NON_PRODUCTION_SURFACE**.

Tragovi: 

## Source reference
https://github.com/Uskoci1/USKOCI-CLEAN/blob/4bcc5dbf1128a4d081824797350b83a00127c21f/src/data/index.ts  
https://github.com/Uskoci1/USKOCI-CLEAN/blob/4bcc5dbf1128a4d081824797350b83a00127c21f/src/data/aiNeedV2Production.ts  
https://github.com/Uskoci1/USKOCI-CLEAN/blob/4bcc5dbf1128a4d081824797350b83a00127c21f/src/data/applicationClientService.ts  
https://github.com/Uskoci1/USKOCI-CLEAN/blob/4bcc5dbf1128a4d081824797350b83a00127c21f/src/data/productionAuthorityOverrides.ts  
https://github.com/Uskoci1/USKOCI-CLEAN/blob/4bcc5dbf1128a4d081824797350b83a00127c21f/package.json

Ne koristiti ovaj snapshot kao razlog da se vrati HEAD ili pregazi noviji rad. Uputstvo za source reuse nije tvrdnja da je svaka funkcija live.
