# CURRENT_UI_STATE_GAP_MAP — 20260916

Curated per-surface states (from source reading) plus copy heuristics counts (loading/empty/error/retry/pending/unknown/offline/blocked/disabled/success). "n/a" = not applicable by design; "—" = not found in source (gap unless justified).

| Route | loading | empty | error | retry | pending | unknown | offline | blocked | success | a11y (label/role/state/live) | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | — | — | — | — | — | — | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/(app)/_layout` | — | — | — | — | — | — | — | heur 1 | — | 0/0/0/0rm | CURRENT_BUT_UI_WEAK |
| `/+native-intent` | — | — | — | — | — | — | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/_layout` | heur 3 | — | — | — | — | — | — | — | — | 1/0/0/0rm | CURRENT_COMPLETE |
| `/auth` | availability progressbar | n/a | availability error + retry; form alert live region | availability retry, resend OTP, new link | busy disables fields/buttons | n/a (Auth SDK either/or) | availability error copy 'Proverite vezu' | methods unavailable (Google/Apple hardcoded, phone/signup/re | poruka banner, RECOVERY_SENT, SIGNUP_NEXT_STEP | 2/12/3/0rm | CURRENT_COMPLETE |
| `/bezbednost` | 'Proveravam blokiranje…' | — | alerts | — | 'Proveri potvrdu prijave' | — | — | — | 'Prijava je primljena.' + Nova privatna prijava | 0/0/0/0rm | CURRENT_COMPLETE |
| `/dogovor/[id]` | AgreementStatus loading | — | AgreementStatus error + Ponovo učitaj | heur 19 | busy labels | AGREEMENT_ACTION_UNCONFIRMED / COMPLETION_NOT_CONFIRMED / PR | bounded 15s | — | heur 3 | 4/8/0/0rm | CURRENT_COMPLETE |
| `/dogovor/[id]/grupa` | refreshing | 'Još nema poruka…' | message | — | SENDING copy | Proveri prvobitno slanje / Ponovi slanje iste poruke | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/dogovor/[id]/izmene` | copy | — | + Ponovo učitaj Dogovor | — | SENDING copy | UNKNOWN → Proveri ishod / Ponovi istu radnju / Unesi prvobit | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/dogovor/[id]/lokacija` | copy | — | — | — | — | Proveri prvobitni zahtev / Zaustavi zahtev | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/dogovori` | yes | presentation | yes | — | — | — | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/fotografije-zadatka` | — | no photos | message | Nastavi slanje iste fotografije | unconfirmed upload; PROCESSING copy | MEDIA_NOT_FOUND vs unknown read copy | — | — | heur 4 | 0/0/0/0rm | CURRENT_BUT_UI_WEAK |
| `/mapa` | — | — | — | — | — | — | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/mesto-zadatka` | LocationScreen loading | — | LocationScreen error + retry | — | — | editor.uncertain passed to form | — | — | 'Lokacija je sačuvana u pregledu Zadatka.' | 0/1/0/0rm | CURRENT_COMPLETE |
| `/moje-prijave` | yes | presentation | editor.error / session.message | heur 5 | busy/inFlight | APPLICATION_OUTCOME_UNKNOWN + canRetry | bounded read | heur 1 | notice copies | 0/0/0/0rm | CURRENT_COMPLETE |
| `/nova` | IntakeUnavailable loading | n/a | IntakeUnavailable error + retry/back/recover; editor.error b | heur 6 | request.current → statusCopy (PROCESSING / retry saved / can | 'Ishod slanja nije potvrđen…' + showReadback | generic 'Proverite vezu' via unavailable | safety BLOCK → not writable; role guard via chooser | heur 3 | 0/0/0/0rm | CURRENT_COMPLETE |
| `/novi-zadatak` | — | — | alert text | — | busy label 'Otvaramo ručni unos…' | — | — | worker intent: 'Novi zadatak je dostupan u režimu MENI TREBA | — | 0/3/0/0rm | CURRENT_COMPLETE |
| `/obavestenja` | yes | illustration + CTA | page vs action copy + retry | heur 6 | acting spinner | — | — | — | — | 4/9/4/0rm | CURRENT_COMPLETE |
| `/oceni-dogovor` | spinner | — | alert + Proveri sačuvanu ocenu / Ponovo učitaj | — | 'Ponovi istu ocenu' | — | — | — | 'Ocena je sačuvana' (immutable) | 0/0/0/0rm | CURRENT_COMPLETE |
| `/oporavak` | verifying | — | alert + retry (VERIFY_UNAVAILABLE) + new link | heur 3 | saving busy | — | — | — | success stage | 2/4/0/0rm | CURRENT_COMPLETE |
| `/pitanja-zadatka` | busy | no questions | message copies | — | PROCESSING copy | 'Stanje radnje nije potvrđeno…' | — | limits/duplicate/materiality copies | receipt copies | 0/0/0/0rm | CURRENT_BUT_BINDING_INCOMPLETE |
| `/podrska` | SupportLoading | SupportEmpty | SupportNotice error | — | SENDING + SupportRecoveryPanel | ABSENT → 'Potvrda prethodne radnje još nije pronađena' + rep | — | capabilities.canCreate false copy | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/podrska/[id]` | SupportLoading | SupportEmpty | SupportNotice error | — | SENDING + SupportRecoveryPanel | ABSENT → 'Potvrda prethodne radnje još nije pronađena' + rep | — | capabilities.canCreate false copy | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/podrska/novi` | SupportLoading | SupportEmpty | SupportNotice error | — | SENDING + SupportRecoveryPanel | ABSENT → 'Potvrda prethodne radnje još nije pronađena' + rep | — | capabilities.canCreate false copy | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/podrska/operator` | SupportLoading | SupportEmpty | SupportNotice error | — | SENDING + SupportRecoveryPanel | ABSENT → 'Potvrda prethodne radnje još nije pronađena' + rep | — | capabilities.canCreate false copy | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/potrebe` | resource.loading | presentation | boolean error → presentation | — | n/a | — | timeout 15s → error | — | — | 0/0/0/0rm | CURRENT_BUT_UI_WEAK |
| `/potrebe/[id]/kandidati` | SelectionUnavailable loading | list presentation | READ_FAILED/UNAVAILABLE/STALE copy | heur 4 | busy/inFlight | uncertain → 'Aktuelno stanje je učitano…ponovite isti zahtev | — | — | confirmed → Otvori Dogovor | 0/0/0/0rm | CURRENT_COMPLETE |
| `/potrebe/[id]/pregled` | yes | — | editor.error (NEED_UNAVAILABLE, NEED_READ_TIMEOUT, NEED_READ | heur 5 | busy/terminalActive | REMAINING_SEARCH_CLOSE_NOT_CONFIRMED copy; editor.uncertain | timeout 15s copy | worker intent → no owner actions | heur 2 | 0/0/0/0rm | CURRENT_COMPLETE |
| `/pregled-nacrta` | spinner | 'Još nema podataka za pregled' | alert + 'Učitajte pregled ponovo' | heur 8 | saving label | — | heur 4 | safety copy | alreadySaved → 'Otvorite sačuvani Zadatak' | 4/8/1/0rm | LEGACY |
| `/pregled-zadatka` | spinner | 'Fotografije nisu dodate.' | footer alert + 'Učitaj pregled i proveri ishod' | — | busy spinner on publish | 'Objava još nije potvrđena. Proveri ishod…' + Proveri objavu | — | BLOCK outcome copy; unavailable identity requirement gate; c | 'Zadatak je objavljen.' → Otvori zadatak | 5/11/1/0rm | CURRENT_COMPLETE |
| `/prijave` | — | — | — | — | — | — | — | — | — | 0/0/0/0rm | LEGACY |
| `/prilike` | yes | yes | yes | — | — | — | timeout | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/prilike/[id]` | yes | n/a | yes + retry | heur 3 | heur 1 | — | — | apply gated by primaNovePrijave/deadline/intent | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/prilike/[id]/prijava` | SelectionUnavailable | — | validation/notice/editor.error | heur 6 | yes | 'Aktuelne Prijave su proverene…ponovite isti sačuvani zahtev | — | — | heur 2 | 0/0/0/0rm | CURRENT_COMPLETE |
| `/profil` | progressbar | 'Ime još nije uneto' | retry | heur 3 | busy | — | — | heur 2 | — | 1/3/0/0rm | CURRENT_BUT_UI_WEAK |
| `/profil/blokirani` | text | 'Na ovoj listi nema blokiranih korisnika.' | retry | heur 2 | — | — | — | heur 3 | — | 0/1/0/0rm | CURRENT_COMPLETE |
| `/profil/dostupnost` | yes | — | + Učitaj sačuvano stanje | heur 1 | — | — | — | requester intent copy + Otvori Profil | 'Dostupnost je sačuvana.' | 0/2/0/0rm | CURRENT_COMPLETE |
| `/profil/fotografija` | heur 5 | 'Profil nema novu fotografiju.' | notice | heur 4 | intent retained; 'Ponovi istu promenu' | heur 1 | — | — | 'Fotografija profila je sačuvana.' | 0/1/0/0rm | CURRENT_BUT_UI_WEAK |
| `/profil/izvoz` | spinner | — | panel + Učitajte stanje ponovo | heur 10 | 'Radnja je u toku…' / saving | fileReadbackRequired copy | heur 2 | — | notice copies incl. save outcomes | 1/2/0/0rm | CURRENT_COMPLETE |
| `/profil/lokacija` | LocationScreen | — | retry | — | — | uncertain disables | — | — | 'Područje rada je sačuvano.' | 0/2/0/0rm | CURRENT_COMPLETE |
| `/profil/o-aplikaciji` | — | — | — | — | — | — | — | — | — | 0/0/0/0rm | CURRENT_COMPLETE |
| `/profil/obavestenja` | — | — | 'Stanje nije potvrđeno…' + Proverite stanje | — | — | — | — | — | — | 1/2/0/0rm | CURRENT_COMPLETE |
| `/profil/podaci` | text | — | alert + Proveri sačuvane podatke | — | — | uncertain disables | — | — | 'Ime je sačuvano.' | 1/1/0/0rm | CURRENT_COMPLETE |
| `/profil/pravna` | spinner | — | alert | heur 4 | Proverite ishod / Ponovite isto prihvatanje | — | — | — | 'Prihvaćene su aktuelne verzije dokumenata.' | 1/2/0/0rm | CURRENT_COMPLETE |
| `/profil/privatnost` | progressbar | — | alerts | heur 2 | — | — | — | — | heur 1 | 2/5/1/0rm | CURRENT_BUT_BINDING_INCOMPLETE |
| `/profil/radnik` | WorkerProfileStatus | — | alert | heur 5 | Čuvamo profil… / retained attempt copy | PROFILE_UNCONFIRMED → Proverite sačuvani profil | — | status SUSPENDED handled by label | messages | 0/2/0/0rm | CURRENT_COMPLETE |
| `/profil/razgovor` | WorkerProfileStatus | — | alerts | heur 6 | statusCopy variants | UNKNOWN_OUTCOME copy | heur 1 | safety BLOCK/REVIEW, stale | 'Profil je sačuvan.' | 0/5/0/0rm | CURRENT_COMPLETE |
| `/raspored` | spinner + RefreshControl | 'Nema potvrđenih tačnih termina' | copy + Pokušaj ponovo | heur 3 | — | — | — | — | — | 7/9/1/0rm | CURRENT_COMPLETE |
| `/rucni-zadatak` | 'Učitavamo ručni unos' | fields empty; NEDOSTAJE badges | alert + Proveri ishod | heur 4 | per-field 'Ishod prethodnog čuvanja nije potvrđen' | editor.uncertain → canAct false | — | conversation not OPEN → MANUAL_TASK_CLOSED; safety BLOCK | SAČUVANO badges | 1/5/0/0rm | CURRENT_BUT_BINDING_INCOMPLETE |

## Cross-cutting UI-state findings

- Offline is never a dedicated state: every surface maps network failure to a generic error copy ("Proverite vezu…") with an explicit retry; no connectivity detector (`NetInfo`) exists. UX-002/UX-003 accept this only if the copy distinguishes read failure from unknown write outcome — the current copies do.
- Reduced motion is honoured only in `MarketplacePresentation` (modal animation) and the entry composition; other screens have no motion to reduce (mostly static V2 token layouts).
- 200% text: `/raspored` adapts its time rail to `fontScale`; other screens rely on default RN wrapping; no `maxFontSizeMultiplier` policy → UX-004 plan needed before any premium rework.
- Skeletons are not used anywhere; loading is spinner + copy (UX-002 allows skeleton only for known structure).
- Generic "settings list" presentation (`SettingsScreen/Panel/Row/Action`) carries safety, support, export, closure, legal, avatar, task photos and Q&A — functionally complete but visually weak for media and conversational surfaces.

