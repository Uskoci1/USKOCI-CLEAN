# Otvorena pitanja i granice posle LINEAGE 1

## Preostali lokalni funkcionalni nedostaci

**F074 — stvarno pomeranje mape i osvežavanje oblasti.** Pin, izbor, detalj, Lista/Mapa, filteri i dodavanje iz mape imaju lokalne prikaze. Sama mapa ostaje šematska SVG demonstracija, ne puna geografska površina za pan/zoom i „pretraži ovu oblast“. Nije zatvoreno tim što postoji lep pin.

**F167 — otkaz zahteva za izvoz.** Zahtev i ciljni status su prikazani; otkaz postojećeg zahteva nije povezan u trenutni lokalni tok. Stvarna generisana arhiva takođe nije deo ovog HTML-a (F168).

## Odluke koje nisu izmišljene

Politika vidljivosti i rokova ocena, AI pomoć baš za Prijavu, refund/otkaz prava kod buduće naplate, granice komunikacije blokiranih naloga u aktivnom Dogovoru, potvrđen nedolazak/zamena, organizacione celine potreba, ponavljajući zadaci i više tržišta ostaju prema izvornom kanonu i otvorenim odlukama. Ovaj vizuelni prolaz ih ne zatvara.

Pravni dokumenti, identitet, javni Q&A, publikacioni policy autoritet i HITNO nisu aktivirani. Nijedan novi ekran ne obećava da su te funkcije puštene.

## UX ograničenja provere

Svih 66 početnih prikaza pregledano je kao atlas. Izvršeno je i 313 alternativnih inspektorskih stanja, ali to nisu 313 različitih realnih mrežnih scenarija. Naknadni vizuelni pregled obuhvata glavne prazne, grešne, stale/offline/loading/unknown i flow prikaze, a ne svaku kombinaciju svih podataka.

U osnovnom atlasu zadržani su deterministički podaci prototipa. Pojedini detalji opravdano kažu „nije dostupno“ kada nije izabrana konkretna Prijava/recenzija/slučaj. Pravi lokalni scenario Dogovora prikazan je dodatno u odeljku tokova i `renders/states/`; nije ubačen izmišljen podatak samo radi punog ekrana.

Uvećavanje teksta je postojeći prototipski large-text režim (`--fs: 2`) na 320 px, ne Android sistemski font-scale niti dokaz čitača ekrana. Datumi koriste namernu horizontalnu listu kada ne staju. Pregled u stvarnom WebView-u, TalkBack/VoiceOver provera, nativna tastatura, safe-area različitih uređaja i stvarna mreža ostaju zasebna validacija.

Nije proglašeno potpuno zatvaranje svih 186 originalnih acceptance kriterijuma. Detaljni statusi razdvajaju lokalni završeni deo, ciljni prikaz, gate, ne-UI stavku, otvorenu odluku i nedostajući deo.
