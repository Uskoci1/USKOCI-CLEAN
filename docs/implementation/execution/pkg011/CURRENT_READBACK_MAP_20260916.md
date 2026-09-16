# CURRENT_READBACK_MAP — 20260916

For every user-facing command: which server readback confirms success, how unknown outcomes are held, and how the exact command is retried. Rule observed everywhere (UX-001): pressed/busy ≠ success; success only after canonical readback; unknown outcomes keep the original command identity and require an explicit readback before any other write.

| Route | Command | Writer | Readback that confirms | Unknown / error handling | Idempotency |
|---|---|---|---|---|---|
| `/auth` | sign in | `authClientService.signInWithPassword` | onAuthStateChange session → RootLayout | safeAuthFailure: 429 rate, >=500 unavailable, generic per-operation copy; no raw Auth error | single in-flight via useAuthFormCommand |
| `/auth` | sign up | `authClientService.signUp (metadata first_name/last_name/full_name/city)` | hasSession false → SIGNUP_NEXT_STEP (confirmation copy) | safeAuthFailure SIGN_UP | — |
| `/auth` | phone OTP send/verify | `authClientService.sendPhoneOtp / verifyPhoneOtp` | faza OTP; session via Auth event | PHONE_SEND / PHONE_VERIFY copy | — |
| `/auth` | password recovery request | `authClientService.requestPasswordRecovery` | RECOVERY_SENT (neutral copy, no account enumeration) | PasswordRecoveryError SIGNED_IN|UNCONFIGURED|INVALID_EMAIL|ACCOUNT_CHANGED + recoveryError mapping | — |
| `/auth` | pre-auth intent | `entryIntentClientService.prepare → povratniCilj.prepare` | preparedIntent shown only after prepare succeeds | ENTRY_INTENT_STORAGE_TIMEOUT 5s, AUTH_ACCOUNT_CHANGED → 'Izbor nije sačuvan' | — |
| `/bezbednost` | block/unblock | `safetyClientService.setBlock({targetAccountId, blocked, expectedRevision, clientRequestId})` | editor data | — | — |
| `/bezbednost` | private safety report | `safetyClientService.report(frozen command)` | readReportCommand(requestId) receipt | — | id persisted before send; 'Ponovi isti zahtev' |
| `/dogovor/[id]` | share/revoke phone | `izvor.podeliTelefon / opoziviTelefon` | read() (AGREEMENT_ACTION_UNCONFIRMED otherwise) | — | — |
| `/dogovor/[id]` | mark work done / confirm completion | `izvor.oznaciZavrsetak / potvrdiZavrsetak (PKG-007: rpc_mark_work_done / rpc_confirm_completion)` | state AWAITING_REQUESTER|COMPLETED (worker) or COMPLETED (requester) else COMPLETION_NOT_CONFIRMED | — | — |
| `/dogovor/[id]` | report problem | `agreementProblemService.submit(id, narrative)` | stored report openedBy/openedAt match else PROBLEM_REPORT_UNCONFIRMED | — | retained narrative attempt |
| `/dogovor/[id]` | send message (+photos) | `outbox.sendDraft → agreementMessageClientService (clientMessageId)` | outbox.reconcile against server messages | READ_ONLY/NOT_AVAILABLE → refresh workspace; CAPACITY 50 unconfirmed | — |
| `/dogovor/[id]/grupa` | send group message | `service.send(journal, body)` | receipt → CONFIRMED; recover by journal | — | clientRequestId + bodySha256 (re-entry must match) |
| `/dogovor/[id]/grupa` | mark visible read | `service.markRead(groupId, ids ≤50)` | — | — | — |
| `/dogovor/[id]/izmene` | PROPOSE change (price/scope/window patch + reason) | `agreementChangeService.propose(IzmenaKomanda with clientRequestId, ocekivanaVerzija)` | readCommand by clientRequestId → CONFIRMED | — | journal hash; re-entry must match normalized hash |
| `/dogovor/[id]/izmene` | RESPOND accept/reject | `agreementChangeService.respond(proposal, accept)` | proposal status ACCEPTED|REJECTED | — | — |
| `/dogovor/[id]/izmene` | WITHDRAW | `agreementChangeService.withdraw(proposalId)` | status WITHDRAWN | — | — |
| `/dogovor/[id]/izmene` | CANCEL agreement | `agreementChangeService.cancel(agreementId, reason)` | agreementStatus CANCELLED (COMPLETED → REJECTED) | — | — |
| `/dogovor/[id]/lokacija` | SHARE one current location | `capture → service.write(journal, point)` | COMMITTED|CANCELLED | — | journal + inputSha256 |
| `/dogovor/[id]/lokacija` | REQUEST location | `service.write(journal, null)` | — | — | — |
| `/dogovor/[id]/lokacija` | cancel unknown | `service.write(j, null, account, true)` | — | — | — |
| `/fotografije-zadatka` | upload task photo | `mediaClientService.uploadTaskPhoto({conversationId, clientRequestId, ...})` | readUploadCommand / readTaskPhotos | — | retained clientRequestId; retry same photo |
| `/fotografije-zadatka` | cancel unconfirmed upload | `mediaClientService.cancelUploadCommand (PKG-008 candidate SQL, unapplied on DEV)` | — | — | — |
| `/fotografije-zadatka` | remove photo | `mediaClientService.removeTaskPhoto` | — | — | — |
| `/mesto-zadatka` | save need location | `needLocationClientService.save({conversationId, expectedRevision, confirmed:true, value})` | result.review | — | expectedRevision CAS |
| `/moje-prijave` | withdraw application | `izvor.povuciPrijavu({prijavaId, potrebaRevizija, prijavaVerzija, clientRequestId, razlog})` | receipt stanje WITHDRAWN + verzija check, then observed() on fresh list | — | frozen command; retry only same command when unknown |
| `/moje-prijave` | resolve changed application KEEP/UPDATE/WITHDRAW | `ru4Production.resolveChangedApplication(frozen command with expected versions)` | status SUBMITTED + version+1; observed() row match | errors map incl. RESPONSE_NOT_WITHDRAWABLE, RESPONSE_NOT_AWAITING_REVIEW, RESPONSE_ALREADY_CURRENT, INVALID_PROPOSED_WINDOW, SCOPE_NOTE_TOO_LONG(1200) | — |
| `/nova` | open conversation | `aiNeedV2Izvor.openConversation(openRequestId)` | — | — | openRequestId uuid per mount |
| `/nova` | send turn | `journal.save before I/O → aiNeedV2Izvor.sendMessage(conversationId, body, clientRequestId, stream)` | read() (recoverTurn + loadConversation); journal cleared only on cancelled|SUCCEEDED|terminal FAILED|ABANDONED | AI_LOCAL_INTENT_NOT_SAVED, AI_INTAKE_CHANGED, service Ishod codes | same clientRequestId replay (knownRetry) |
| `/nova` | cancel pending turn | `aiNeedV2Izvor.cancelTurn` | read(); completion may win race | — | — |
| `/nova` | abandon conversation | `aiNeedV2Izvor.abandonConversation` | read(); abandoning flag until confirmed | — | — |
| `/novi-zadatak` | open owned conversation for manual entry | `aiNeedV2Izvor.openConversation(openRequestId)` | conversationId → navigate | result.poruka | — |
| `/obavestenja` | open item (mark read + resolve target) | `model.open(item)` | target kind or UNAVAILABLE | — | — |
| `/obavestenja` | read all | `model.readAll` | — | — | — |
| `/oceni-dogovor` | submit review (rating 1-5, tags ≤ max) | `reviewsClientService.submit(command)` | context.review.reviewId === receipt.reviewId else REVIEW_READBACK_REQUIRED | — | clientRequestId retained |
| `/oporavak` | set new password | `recovery.save(password)` | state success | state.error.code incl. VERIFY_UNAVAILABLE (retry) | — |
| `/pitanja-zadatka` | ask / answer | `qaSubmissionClientService.submit` | consumeAi status COMMITTED|CANCELLED|REJECTED|STALE|PROCESSING|READY|ABSENT; finish() via matchesQaReceipt | — | journal + textSha256 must match on retry |
| `/pitanja-zadatka` | disposition IGNORE/REPORT | `preselectionQaClientService.dispositionQuestion` | qaRecoveryClientService.read; rejected set clears journal | — | — |
| `/pitanja-zadatka` | cancel classification | `qaSubmissionClientService.cancel` | — | — | — |
| `/podrska` | CREATE case (channel/topic/title/body/desiredOutcome/context/evidence) | `controller.submit('CREATE') → rpc_support_submit_v5` | consume(command COMMITTED|ABSENT|…) + readData | — | prepared intent; replay only when ABSENT |
| `/podrska` | AUTHOR_REPLY / APPEAL (author); CLAIM, OPERATOR_REPLY, REQUEST_INFO, DECIDE, CLAIM_APPEAL, DECIDE_APPEAL, CLOSE (operator) | `controller.submit(kind, payload) gated by supportActionAllowed(detail, kind)` | — | — | — |
| `/podrska` | cancel pending | `service.cancel` | — | — | — |
| `/podrska` | mark read | `service.markRead(caseId, sequence)` | — | — | — |
| `/podrska/[id]` | CREATE case (channel/topic/title/body/desiredOutcome/context/evidence) | `controller.submit('CREATE') → rpc_support_submit_v5` | consume(command COMMITTED|ABSENT|…) + readData | — | prepared intent; replay only when ABSENT |
| `/podrska/[id]` | AUTHOR_REPLY / APPEAL (author); CLAIM, OPERATOR_REPLY, REQUEST_INFO, DECIDE, CLAIM_APPEAL, DECIDE_APPEAL, CLOSE (operator) | `controller.submit(kind, payload) gated by supportActionAllowed(detail, kind)` | — | — | — |
| `/podrska/[id]` | cancel pending | `service.cancel` | — | — | — |
| `/podrska/[id]` | mark read | `service.markRead(caseId, sequence)` | — | — | — |
| `/podrska/novi` | CREATE case (channel/topic/title/body/desiredOutcome/context/evidence) | `controller.submit('CREATE') → rpc_support_submit_v5` | consume(command COMMITTED|ABSENT|…) + readData | — | prepared intent; replay only when ABSENT |
| `/podrska/novi` | AUTHOR_REPLY / APPEAL (author); CLAIM, OPERATOR_REPLY, REQUEST_INFO, DECIDE, CLAIM_APPEAL, DECIDE_APPEAL, CLOSE (operator) | `controller.submit(kind, payload) gated by supportActionAllowed(detail, kind)` | — | — | — |
| `/podrska/novi` | cancel pending | `service.cancel` | — | — | — |
| `/podrska/novi` | mark read | `service.markRead(caseId, sequence)` | — | — | — |
| `/podrska/operator` | CREATE case (channel/topic/title/body/desiredOutcome/context/evidence) | `controller.submit('CREATE') → rpc_support_submit_v5` | consume(command COMMITTED|ABSENT|…) + readData | — | prepared intent; replay only when ABSENT |
| `/podrska/operator` | AUTHOR_REPLY / APPEAL (author); CLAIM, OPERATOR_REPLY, REQUEST_INFO, DECIDE, CLAIM_APPEAL, DECIDE_APPEAL, CLOSE (operator) | `controller.submit(kind, payload) gated by supportActionAllowed(detail, kind)` | — | — | — |
| `/podrska/operator` | cancel pending | `service.cancel` | — | — | — |
| `/podrska/operator` | mark read | `service.markRead(caseId, sequence)` | — | — | — |
| `/potrebe/[id]/kandidati` | select application | `izvor.izaberiPrijavu(frozen IzborKomanda: potrebaId, potrebaRevizija, prijavaId, prijavaVerzija, prijavaHash, mesta, clientRequestId)` | receipt dogovorId; uncertain until reconciled; readSelectedAgreement for linked agreement | applicationSelectionErrors known refusals → reset; APPLICATION_SELECTION_UNCONFIRMED | frozen command replay same key |
| `/potrebe/[id]/kandidati` | mark offer viewed | `izvor.oznaciPrijavuVidjenom(prijavaId)` | viewed state; UNCONFIRMED copy; repeat only by explicit reopen | — | — |
| `/potrebe/[id]/pregled` | close remaining search | `ru4Production.closeRemainingSearch(needId, revision, clientRequestId)` | read(); confirmed only if remainingClosed true else REMAINING_SEARCH_CLOSE_NOT_CONFIRMED | — | retained attempt id |
| `/potrebe/[id]/pregled` | open edit conversation | `aiNeedV2Izvor.openEditConversation(needId)` | authoritative true, revision match else STALE_REVIEW_REQUIRED | — | — |
| `/potrebe/[id]/pregled` | lifecycle actions (publish/cancel/withdraw/delete draft) | `NeedLifecycleActions → needLifecycleController (PKG-004 verified)` | onRefresh | — | — |
| `/pregled-nacrta` | confirm fact | `aiNeedV2Izvor.confirmFact` | — | — | — |
| `/pregled-nacrta` | correct fact | `aiNeedV2Izvor.correctFact` | — | — | — |
| `/pregled-nacrta` | save draft | `aiNeedV2Izvor.saveDraft(conversationId, requestId)` | navigates to need pregled | — | — |
| `/pregled-nacrta` | confirm edit (bound need) | `aiNeedV2Izvor.confirmEdit(needId, reviewedRevision, conversationId, editRequestId)` | — | — | — |
| `/pregled-zadatka` | accept and publish | `aiTaskReviewClientService.acceptAndPublish({review, clientRequestId})` | command state PUBLISHED + need readback | result codes; resultCopy per evaluation outcome CLARIFY/REVIEW/BLOCK/NOT_READY | pending.id retained |
| `/pregled-zadatka` | resume same publication | `aiTaskReviewClientService.resume(command)` | — | — | — |
| `/pregled-zadatka` | correct fact / remove identity requirement | `aiNeedV2Izvor.correctFact` | — | — | — |
| `/pregled-zadatka` | propose location / deadline (re-prepare) | `prepare(...) with proposals` | — | — | — |
| `/pregled-zadatka` | open edit conversation | `aiNeedV2Izvor.openEditConversation(needId)` | — | — | — |
| `/prilike/[id]/prijava` | submit application | `journal.save before I/O → izvor.podnesiPrijavu(command)` | receipt; journal cleared on ok or known refusal after readback | — | same key+payload replay |
| `/profil` | logout | `authClientService.signOutLocal({accountId, accountRevision}) → revokePushBeforeLogout → auth.signOut(local)` | Auth event owns session cleanup | 'Odjava nije potvrđena. Pokušajte ponovo.' | — |
| `/profil` | intent switch | `postaviUlogu (local preference per account)` | n/a (local) | — | — |
| `/profil/dostupnost` | save availability | `workerAvailabilityClientService.save({expectedRevision, value})` | result.availability | — | — |
| `/profil/fotografija` | upload avatar | `mediaClientService.uploadAvatar({profileId, clientRequestId,...})` | — | — | — |
| `/profil/fotografija` | apply avatar | `mediaClientService.applyAvatar({profileId, assetId, expectedAvatarPath})` | — | — | — |
| `/profil/fotografija` | clear avatar | `mediaClientService.clearAvatar` | — | — | — |
| `/profil/fotografija` | discard candidate | `mediaClientService.discardAvatar(assetId)` | — | — | — |
| `/profil/izvoz` | request export | `exports.requestExport(key)` | clientRequestId match then read() | — | — |
| `/profil/izvoz` | prepare | `exports.prepareExport(receiptId)` | kind PROCESSING|READY|NOT_READY(code) | — | — |
| `/profil/izvoz` | cancel | `exports.cancelExport` | — | — | — |
| `/profil/izvoz` | revoke | `exports.revokeExport` | — | — | — |
| `/profil/izvoz` | download+save | `exports.downloadExport → Edge uskoci-data-export-download → saveDataExportFile` | sha256/md5/byteLength/receipt/generation match; bytes zeroed after | — | — |
| `/profil/lokacija` | save work area | `workerLocationClientService.save({expectedRevision, confirmed:true, value})` | result.location | — | — |
| `/profil/obavestenja` | save settings (in_app, categories, quiet hours, urgent override) | `notificationPreferencesClientService.save(accountId, role, payload, revision)` | — | — | — |
| `/profil/obavestenja` | enable/disable push for role | `pushDeviceClientService.set(scope, token, platform, enabled, revision) + preferences push_enabled` | — | — | — |
| `/profil/podaci` | save display name | `requesterProfileClientService.save({displayName, clientRequestId, expectedRevision})` | identity | — | — |
| `/profil/pravna` | accept reviewed bundle (terms+privacy sha256) | `legalClientService.acceptReviewedBundle(key, termsSha, privacySha)` | readAcceptance(key); receipt sha match | — | — |
| `/profil/privatnost` | prepare closure | `accountClosureClientService.prepare({expectedRevision, clientRequestId})` | readReceipt(found) | — | — |
| `/profil/privatnost` | start closure execution | `closureExecutionClientService.start(intent)` | read(clientRequestId) found/execution state; CLOSED terminal | — | — |
| `/profil/privatnost` | logout from device | `authClientService.signOutLocal` | — | — | — |
| `/profil/radnik` | save/activate worker profile | `izvor.azurirajRadnikProfil(AzurirajProfilKomanda incl. zavrsi)` | read() + workerReadbackMatches(expected) else PROFILE_UNCONFIRMED | — | same attempt replay 'Ponovi isto čuvanje' |
| `/profil/razgovor` | send turn | `journal.save → api.send` | read(); terminal states clear journal | — | — |
| `/profil/razgovor` | cancel turn | `api.cancelTurn` | — | — | — |
| `/profil/razgovor` | prepare review / patch candidate / save review (key per reviewId) / abandon | `api.prepare/patch/save/abandon` | read(); saved.reviewId match | — | — |
| `/rucni-zadatak` | save manual fact (15 scalar keys) | `manualNeedFactClientService.save({conversationId, clientRequestId, key, value, displayValue})` | read(); pending cleared only when manualNeedFactMatchesReadback | parse error copy per field; 'Prethodno čuvanje nema potvrđen ishod…' when value changed under pending; MANUAL_TASK_CHANGED/CLOSED | retained clientRequestId per key |

## Shared readback mechanisms

- `useOwnedEditor.save`: a rejected or thrown command sets `uncertain` + `reconcileRequired`; no further command until `refresh()` reads server state. Used by the AI intake, manual entry, reviews, Need detail, candidates, application composer, worker profile, locations, availability, avatar, export, safety, review.
- Durable command journals written **before** I/O: `aiTurnIntentJournal`, `workerAiTurnIntentJournal`, `applicationCommandJournal`, `qaIntentJournal`, `supportCaseJournal`, `closureIntentJournal`, `agreementActions journal (payload hash)`, `agreement-location journal (input sha256)`, `group-message journal (body sha256)`, `agreementPhotoJournal`, media upload pending journal, safety command id, avatar intent. Each is retired only by exact canonical readback (receipt id / state match), never by a transport ACK or timeout.
- Bounded reads (`Promise.race` 15 s) never claim server cancellation; copies say "proverite stanje" and offer an explicit readback action.

