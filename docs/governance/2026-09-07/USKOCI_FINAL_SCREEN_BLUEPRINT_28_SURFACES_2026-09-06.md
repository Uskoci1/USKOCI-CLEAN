# USKOČI — FINAL SCREEN BLUEPRINT

## Osnova
Model proizvoda: **Zadatak → Prijava → Dogovor**. Aktivnih surface-a: **28**. Retired: S05, R01, W01.

### Navigacija
- MENI TREBA: **R03 Zadaci | U→R02 Novi | R08 Dogovori**
- JA MOGU: **W06 Prijave | U→W03 Zadaci | W07 Dogovori**
- Zvonce → S06; avatar → R09 ili W08; Profil nije bottom tab.
- Dogovor ima samo **Pregled | Poruke**; Hronologija je ugrađena u Pregled.
- Cela kartica je tappable kada postoji jedna prirodna destinacija.

## Živi objekti
1. **Zadatak / Task Object** — isti identitet kroz R02/R03/R04/W03/W04/W05/D02; menja se količina detalja, ne jezik.
2. **Prijava** — R05 i W06 su dve projekcije iste porodice.
3. **Dogovor Context** — isti masthead kroz D01/D02/D03/D05/D06.
4. **Profile Passport** — R06/R09/W08.
5. **Notification Row** — S06; svaki red vodi direktno na owning screen.
6. **Map Pin + Map Card** — isti query snapshot i sinhronizovan selection.
7. **Composer** — R02/W02/D03 dele isti primitive/retry behavior.
8. **Participant/Contact** — privatni podaci samo uz server-authorized grant.

# SHARED

## S01 — Cold start / intro
**Vidi:** grad + canonical USKOČI znak + brand motion; minimalan UI.
**Klik/izlaz:** normalno S02; validan deep link preskače intro.
**Back:** nema.
**States:** first_run, returning, reduced_motion, load_slow/load_fast.

## S02 — Trenutna namera
**Vidi:** MENI TREBA / JA MOGU + isti nalog.
**Klik:** requester intent → auth/requester cilj; worker intent → auth/worker cilj ili W02/W08 readiness.
**Back:** root; bez ponavljanja S01.
**States:** signed_out, signed_in, profile_not_ready_worker, loading/error/offline.

## S03 — Auth
**Vidi:** Prijava/Registracija, realna polja, 1 dominantan CTA, recovery/legal.
**Klik:** submit→sačuvani target; Telefon→S04 OTP; Forgot→S04; legal→S07/legal.
**Back:** S02 uz očuvan intent/return target.
**States:** loading, invalid, provider_error, offline, success.

## S04 — Potvrda / oporavak
**Vidi:** maskirani kontakt, OTP ili nova lozinka, confirm/save, resend cooldown.
**Klik:** potvrda→sačuvani target; resend→isto.
**Back:** tačan S03 kontekst.
**States:** waiting, expired, success, offline, error.

## S06 — Obaveštenja
**Vidi:** unread, Danas/Ranije, event rows, vreme.
**Klik:** Nova Prijava→R05; Izabrani ste→D01/W06; Nova poruka→D03; promena Zadatka→W04/W06; completion→D06; settings→S07.
**Back:** tačan source; cold deep link→authorized target/safe root.
**States:** loading, empty, error, offline, stale destination.

## S07 — Podešavanja
**Vidi:** nalog, bezbednost, obaveštenja, privatnost, legal, pomoć, odjava, danger zona.
**Klik:** row→scoped subview; support→case; logout→entry/auth; export/close samo kad backend postoji.
**Back:** subview→S07; S07→source.

# MENI TREBA

## R02 — AI Novi Zadatak
**Vidi:** živi Task Object gore (facts + Potvrđeno/Čeka), ispod conversation, suggestions, sticky composer, Pregledajte nacrt.
**Klik:** fact edit/confirm→isti tok; Send→AI turn; Review→R07.
**Back:** čuva conversation/facts, vraća source.
**States:** initial, working, review_ready, clarify, sending, review, blocked, offline, error.

## R03 — Zadaci
**Vidi:** header+bell/avatar; Čeka Vas/Aktivni/Završeni; task-centered cards; bottom nav.
**Klik:** card→R04; application attention→R05; U/Novi→R02; Dogovori→R08; bell→S06; avatar→R09.
**Back:** root.

## R04 — Zadatak workspace
**Vidi:** isti Task identity; Sledeći korak; Pokrivenost; Prijave; participants/Dogovor; secondary lifecycle actions.
**Klik:** Prijave→R05; Dogovor→D01; edit→R02/R07; close remaining→confirm; cancel→flow; publish samo kad authority dozvoli.
**Back:** isti R03 filter/scroll.
**States:** draft, published, partially_filled, full, closed, cancelled, loading/error/offline/stale.

## R05 — Prijave / izbor
**Vidi:** Potrebno/Dogovoreno/Preostalo; kandidat cards: identitet, real trust, cena, seats, time, resources, status.
**Klik:** identitet→R06; Izaberi→confirmation sheet; Potvrdite izbor→atomic selection→D01.
**Back:** isti R04 + candidate scroll.
**States:** loading, empty, selecting, unknown_outcome, stale, full, error/offline.

## R06 — Javni profil
**Vidi:** foto, ime/grad, realna reputacija ili no_reviews, bio, capabilities/resources samo ako postoje.
**Ne sme:** telefon, email, tačna adresa, dokumenti, fake verified/rating.
**Back:** tačan R05/W04 source.

## R07 — Human Review
**Vidi:** Šta/Gde/Kada/Ljudi/Cena/Uslovi; status facts; javno približno/privatno tačno.
**Klik:** Izmeni/Dopunite→R02; Sačuvaj nacrt→R04.
**Ne sme:** publish CTA.

## R08 — Dogovori MENI TREBA
**Vidi:** task-centered Dogovor cards; noviji spec: Čeka Vas/Aktivni/Završeni; participants/attention/unread.
**Klik:** card→D01; bell→S06; avatar→R09; Zadaci→R03; U/Novi→R02.
**Napomena:** formalno supersedovati stariji Aktivni/Završeni/Otkazani ako se potvrdi.

## R09 — Profil MENI TREBA
**Vidi:** own Profile Passport + mode switch + Javni profil/Recenzije/Podešavanja.
**Klik:** JA MOGU→W02 ako readiness fali, inače worker root; settings→S07.
**Back:** source.

# JA MOGU

## W02 — AI Radni profil
**Vidi:** živi Profile Object (skills/tools/vehicles/team/radius/experience/licences) + AI conversation.
**Klik:** Save→W08; Activate→preserved gated target ili W03.
**Back:** source; confirmed facts ostaju.
**Status:** design target dok runtime nije zatvoren.

## W03 — Zadaci Lista / Mapa
**Vidi:** jedan dataset, Lista|Mapa, filteri, Task cards/pins; bez Kombinovano.
**Klik:** card/selected map card→W04; Filteri→sheet; bell→S06; avatar→W08; Prijave→W06; Dogovori→W07.
**Back iz W04:** vraća filters/scroll/viewport/selection/sheet.

## W04 — Detalj Zadatka
**Vidi:** isti Task identity + price, coarse geo, time, seats, conditions, requester trust, media ako postoji, readiness.
**Klik:** Sastavi prijavu→W05; requester→public profile; blocker→W02; clarify samo kad feature live.
**Back:** isti W03 context.

## W05 — Sastavi Prijavu
**Vidi:** Need MINI + samo application fields (seats, price/offer, time gde važi, resources, note, summary).
**Klik:** Need MINI→W04; Send→W06; AI help samo kad runtime postoji.
**Back:** W04 + sačuvan draft.

## W06 — Moje Prijave
**Vidi:** Zadatak + poslati uslovi + status + next action.
**Klik:** selected→D01; stale→Zadrži/Izmeni(W05)/Povuci; obična card→W04/W05; U→W03; Dogovori→W07.
**States:** submitted, stale, selected, withdrawn, closed, loading/empty/error/offline.

## W07 — Dogovori JA MOGU
**Vidi:** task-centered cards sa samo viewer-authorized uslovima; Čeka Vas/Aktivni/Završeni.
**Klik:** card→D01; bell→S06; avatar→W08.
**Ne sme:** cene/privatni uslovi drugih worker-a.

## W08 — Radni profil
**Vidi:** Profile Passport + readiness + skills/vehicles/tools/team/experience/radius/availability.
**Klik:** availability/radius→W09; AI edit→W02 kad postoji; public profile→R06; settings→S07; MENI TREBA→R03.
**States:** ready, incomplete, editing, saving, error, offline.

## W09 — Dostupnost / kalendar
**Vidi:** Dostupan sam + weekly/dated availability + Dogovor hard blocks.
**Klik:** Dogovor block→D01; Dodajte nedostupnost→sheet; edit/delete own availability.
**Back:** W08 ili tačan W04/W05 conflict source.
**Napomena:** origin/radius/save treba uskladiti sa final override-om.

# DOGOVOR

## D01 — Dogovor shell
**Vidi stalno:** status, Zadatak, participants, price, time, geo/method, next action.
**Tabs:** Pregled→D02; Poruke→D03.
**Next action:** D05/D06.
**Back:** source; requester fallback R08, worker W07; posle selection ne vraća stale selectable candidate.

## D02 — Pregled
**Vidi:** isti masthead + participants + Vaši uslovi + contact/location grants + remaining capacity + embedded chronology + contextual actions.
**Klik:** participant→public profile; remaining→R05; contact grant→same; change/problem→D05; completion→D06; group/private chat→D03.

## D03 — Poruke
**Vidi:** isti masthead + authorized channel + thread + system events + composer + delivery/retry.
**Klik:** channel switch→isti D03; Send→isti D03; attach samo kad runtime postoji.
**States:** sending, send_fail/retry, loading, empty, offline, terminal_readonly.

## D04 — Hronologija embedded
**Vidi:** timeline događaja unutar D02; nema svoj tab/chrome.
**Klik:** message→D03; problem/cancel→D05; completion→D06; replacement→D05/R05.

## D05 — Izmena / problem / otkaz
**Vidi:** chooser Predložite izmenu / Imam problem / Želim da otkažem; zatim scoped form/sheet.
**Klik:** change send/accept/reject→D02; problem submit→D02; cancel→R08/W07; replacement→R05; support→S07.
**Back:** D02; stari uslovi ostaju dok command ne uspe.

## D06 — Završetak
**Vidi:** isti masthead + actor-specific completion. Worker: Završio sam. Requester: Potvrdi završetak / Prijavi problem.
**Klik:** worker done→same; requester confirm→completed; problem→D05; review samo kad backend postoji; Later→Dogovori.
**Back:** D02/D01; completed state ostaje authoritative.

# GLAVNI TOKOVI

**MENI TREBA:** S01→S02→S03/S04→R03→R02→R07→R04→R05→D01→D02↔D03→D05/D06→R08

**JA MOGU:** S01→S02→S03/S04→W02/W08 po readiness-u→W03→W04→W05→W06→D01→D02↔D03→D05/D06→W07

**PROFIL:** avatar→R09/W08→S07; mode switch menja prostor, ne nalog.

**OBAVEŠTENJA:** Bell→S06→tačan owning ekran.

# ODLUKE ZA FINALNI LOCK
1. S01/S02 CTA placement posle intro animacije.
2. R08/W07: formalni lock Čeka Vas/Aktivni/Završeni vs stariji filter model.
3. W09: visible controls uskladiti sa final override-om.
4. Finalni map pin artwork.

# FIGMA PRAVILO
Svaki ekran mora da se sklapa iz shared živih objekata, da prikazuje samo informacije relevantne za trenutni posao, da ima najviše jedan dominantan CTA, sve relevantne loading/empty/error/offline/stale varijante, tačan Back/return kontekst i nikada ne prikazuje gated funkciju kao live.
