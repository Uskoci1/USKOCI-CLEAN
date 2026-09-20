# Acceptance za prenos i završavanje aplikacije

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

G. Map provider: stvarne javne koordinate/oblast, pan/zoom/settled query, ista lista, no-results, nema pina kada nema lokacije; ručni izbor i denied GPS ne glume dobijenu lokaciju; exact address ne ulazi u public kartu. Bez live tracking-a.

H. Kalendar: availability nije potvrđena obaveza; konflikt nije automatsko otkazivanje; availability ON nije HITNO. Prava lokalna zona/date boundary; uređajski picker i veliki tekst.

I. Export: REQUESTED nije READY; cancel receipt/status; file ownership i stvarni archive generator. Closure: preflight/aktivne saradnje/pravni retention i stvarni server job. Nema klijentskog brisanja naloga kao zamene.

J. Pravi Android, iOS kada je dostupno: system text scaling, screen reader labels/focus, keyboard, Back, safe-area, offline/reconnect, render/scroll i animacija. Screenshot porediti po ulozi i stanju, ne sa pogrešnim fixture nalogom.

## Kada je funkcija gotova
UI referenca + native implementation + stvarni service binding + pozitivni i negativni realni test + dokazi. Tek tada promeniti status te funkcije. Ne pretvarati status target shown u finished masovnom promenom kolone.
